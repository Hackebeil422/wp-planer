import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type OnConnect,
  type OnConnectStart,
  type OnReconnect,
  type IsValidConnection,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import {
  db,
  seedInitialCatalog,
  findInsulationForArticle,
  findPipeArticle,
  LINE_SYSTEM_CONFIG,
  COMPONENT_SUBTYPE_LABELS,
  type CatalogItem,
  type LineSystem,
  type PortDefinition,
  type SavedProject,
  type ComponentSubType,
  type CustomBomItem,
} from './db';
import { HvacNode } from './HvacNode';
import { CatalogManager } from './CatalogManager';
import { SystemWizards } from './SystemWizards';
import { BomAndExport, calculateBomRows, type SchemaImage } from './BomAndExport';
import { createSchemaNode } from './schemaGenerator';
import { openDataUrl } from './filePreview';
import {
  Fan,
  Plus,
  Trash2,
  Settings2,
  CheckCircle2,
  Database,
  LayoutGrid,
  AlertTriangle,
  ShieldAlert,
  Wand2,
  ClipboardList,
  FileDown,
  RefreshCw,
  ArrowLeftRight,
  X,
  FilePlus2,
  ExternalLink,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';

interface AdapterMatch {
  portLabel: string;
  targetFixedDim: string;
  adapterName: string;
  articleNumber: string;
  supplierLink?: string;
  imageBase64?: string;
  price?: number;
  missingInCatalog?: boolean;
}

interface PendingAdapterPrompt {
  edgeParams: any;
  lineSystem: LineSystem;
  dimension: string;
  lengthMeters?: number;
  includePipeInsulation?: boolean;
  sourceDesc: string;
  targetDesc: string;
  adapters: AdapterMatch[];
  isExistingEdgeId?: string;
}

type MediaFilter = 'all' | 'water' | 'electric' | 'refrigerant';

/** Eingang und Ausgang desselben Anschlusses gelten als ein Punkt. */
const normalizePortHandle = (handle: string | null | undefined) =>
  (handle || '').replace(/-in$/, '').replace(/-out$/, '');

function nodeUsesMedium(data: Node['data'], medium: MediaFilter): boolean {
  if (medium === 'all') return true;
  const isMultiPort = data.isMultiPort ?? ((data.ports as PortDefinition[]) || []).length > 0;
  if (isMultiPort) return ((data.ports as PortDefinition[]) || []).some((p) => p.medium === medium);
  return (data.leftMedium || 'water') === medium || (data.rightMedium || 'water') === medium;
}

/** Inhalt eines Projekts ohne Ansichtszustand wie Auswahl oder gemessene Größen. */
function projectSignature(
  nodes: Node[],
  edges: Edge[],
  overrides: Record<string, { quantity?: number; deleted?: boolean }>,
  customItems: CustomBomItem[]
): string {
  return JSON.stringify([
    nodes.map((n) => [n.id, n.position, n.data]),
    edges.map((e) => [e.id, e.source, e.sourceHandle, e.target, e.targetHandle, e.data]),
    overrides,
    customItems,
  ]);
}

const EMPTY_PROJECT_SIGNATURE = projectSignature([], [], {}, []);

export default function App() {
  const [activeTab, setActiveTab] = useState<'canvas' | 'wizards' | 'bom' | 'export' | 'catalog'>('canvas');
  const [projectName, setProjectName] = useState<string>('Neues Projekt');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [bomOverrides, setBomOverrides] = useState<Record<string, { quantity?: number; deleted?: boolean }>>({});
  const [customBomItems, setCustomBomItems] = useState<CustomBomItem[]>([]);

  const [defaultSystem, setDefaultSystem] = useState<'copper' | 'alu'>('copper');
  const [defaultDimension, setDefaultDimension] = useState<string>('28mm');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [pdfMediaChoice, setPdfMediaChoice] = useState<MediaFilter>('all');
  const [isExporting, setIsExporting] = useState(false);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all');

  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingAdapterPrompt | null>(null);
  const [swapTargetNodeId, setSwapTargetNodeId] = useState<string | null>(null);

  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const edgeReconnectSuccessful = useRef(true);
  const reconnectingEdgeIdRef = useRef<string | null>(null);
  const savedSignatureRef = useRef(EMPTY_PROJECT_SIGNATURE);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  /** Leitung, die gerade durch Ziehen an ihrem belegten Anschluss umgesteckt wird. */
  const movingEdgeRef = useRef<{ edge: Edge; nodeId: string; handleId: string } | null>(null);

  const nodeTypes = useMemo(() => ({ hvac: HvacNode }), []);

  const getEdgeLabelProps = useCallback(
    (sys: LineSystem, dim: string, adaptersCount: number, lengthMeters?: number, insulated?: boolean) => {
      const sysConfig = LINE_SYSTEM_CONFIG[sys];
      const adapterBadge = adaptersCount > 0 ? ` (+${adaptersCount} Adapter)` : '';
      const hasLength = lengthMeters !== undefined && Number(lengthMeters) > 0;
      const lengthBadge = hasLength ? ` • ✓ ${Number(lengthMeters)}m` : '';
      const isoBadge = insulated ? ' • [Iso]' : '';

      return {
        label: `${sysConfig.label}: ${dim}${adapterBadge}${lengthBadge}${isoBadge}`,
        labelStyle: { fill: '#0f172a', fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: '#cbd5e1', strokeWidth: 1 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
      };
    },
    []
  );

  const findMatchingPartInsulation = useCallback(
    (artNo: string, itemsList: CatalogItem[]) => findInsulationForArticle(itemsList, artNo),
    []
  );

  const loadSavedProjects = useCallback(async () => {
    const list = await db.projects.orderBy('id').reverse().toArray();
    setSavedProjects(list);
  }, []);

  const loadCatalog = useCallback(
    async (resetCanvas = false) => {
      const items = await db.catalog.toArray();
      setCatalog(items);

      if (resetCanvas) {
        setNodes([]);
        setEdges([]);
        setBomOverrides({});
        setCustomBomItems([]);
      } else {
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            const updatedItem = items.find((i) => i.id === n.data.catalogId);
            if (!updatedItem) return n;
            const activeDim = n.data.activeDimension as string | undefined;
            const matchedVar =
              updatedItem.isDynamicSize && activeDim
                ? updatedItem.variants?.find((v) => v.dimension === activeDim)
                : undefined;
            const actArt = matchedVar ? matchedVar.articleNumber : updatedItem.articleNumber;
            const matchIns = findMatchingPartInsulation(actArt, items);

            return {
              ...n,
              data: {
                ...n.data,
                label: updatedItem.name,
                category: updatedItem.category,
                componentType: updatedItem.componentType,
                manufacturer: updatedItem.manufacturer,
                isActive: updatedItem.isActive ?? true,
                price: matchedVar?.price !== undefined ? matchedVar.price : updatedItem.price,
                imageBase64: updatedItem.imageBase64,
                documents: updatedItem.documents || [],
                isMultiPort: updatedItem.isMultiPort ?? (updatedItem.ports && updatedItem.ports.length > 0),
                ports: updatedItem.ports || [],
                leftLabel: updatedItem.leftLabel || 'Eingang',
                leftMedium: updatedItem.leftMedium || 'water',
                leftDim: updatedItem.leftDim || '',
                rightLabel: updatedItem.rightLabel || 'Ausgang',
                rightMedium: updatedItem.rightMedium || 'water',
                rightDim: updatedItem.rightDim || '',
                variants: updatedItem.variants || [],
                activeArticleNumber: actArt,
                activeSupplierLink: matchedVar?.supplierLink || updatedItem.supplierLink,
                matchingInsulationArticle: matchIns?.articleNumber,
                matchingInsulationName: matchIns?.name,
              },
            };
          })
        );
      }
      return items;
    },
    [findMatchingPartInsulation]
  );

  useEffect(() => {
    async function init() {
      await seedInitialCatalog();
      await loadCatalog(false);
      await loadSavedProjects();
    }
    init();
  }, [loadCatalog, loadSavedProjects]);

  useEffect(() => {
    const handleDeleteNode = (e: any) => {
      const nodeId = e.detail.id;
      const connected = edges.filter((ed) => ed.source === nodeId || ed.target === nodeId).length;
      if (
        connected > 0 &&
        !confirm(`Beim Löschen dieses Bauteils werden auch ${connected} angeschlossene Leitung(en) entfernt. Fortfahren?`)
      ) {
        return;
      }
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((ed) => ed.source !== nodeId && ed.target !== nodeId));
    };

    const handleDuplicateNode = (e: any) => {
      const nodeId = e.detail.id;
      const nodeToCopy = nodes.find((n) => n.id === nodeId);
      if (!nodeToCopy) return;
      setNodes((nds) => [
        ...nds,
        {
          ...nodeToCopy,
          id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          position: { x: nodeToCopy.position.x + 40, y: nodeToCopy.position.y + 40 },
        },
      ]);
    };

    const handleSwapNode = (e: any) => setSwapTargetNodeId(e.detail.id);

    const handleToggleInsulation = (e: any) => {
      const nodeId = e.detail.id;
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, includeInsulation: !n.data.includeInsulation } } : n))
      );
    };

    window.addEventListener('hvac-delete-node', handleDeleteNode as EventListener);
    window.addEventListener('hvac-duplicate-node', handleDuplicateNode as EventListener);
    window.addEventListener('hvac-swap-node', handleSwapNode as EventListener);
    window.addEventListener('hvac-toggle-insulation', handleToggleInsulation as EventListener);

    return () => {
      window.removeEventListener('hvac-delete-node', handleDeleteNode as EventListener);
      window.removeEventListener('hvac-duplicate-node', handleDuplicateNode as EventListener);
      window.removeEventListener('hvac-swap-node', handleSwapNode as EventListener);
      window.removeEventListener('hvac-toggle-insulation', handleToggleInsulation as EventListener);
    };
  }, [nodes, edges]);

  const getPortInfo = useCallback(
    (nodeId: string, handleId: string | null | undefined): { node?: Node; port?: PortDefinition } => {
      if (!handleId) return {};
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return {};

      if (node.data.isMultiPort) {
        const portId = handleId.replace(/-in$/, '').replace(/-out$/, '');
        const ports = (node.data.ports as PortDefinition[]) || [];
        return { node, port: ports.find((p) => p.id === portId) };
      } else {
        const isLeft = handleId.includes('left');
        return {
          node,
          port: {
            id: handleId,
            label: isLeft ? (node.data.leftLabel as string) || 'Eingang' : (node.data.rightLabel as string) || 'Ausgang',
            medium: isLeft ? (node.data.leftMedium as any) || 'water' : (node.data.rightMedium as any) || 'water',
            fixedDimension: isLeft ? (node.data.leftDim as string) || undefined : (node.data.rightDim as string) || undefined,
          },
        };
      }
    },
    [nodes]
  );

  /** Beim Umstecken wird aus "gezogener Anschluss > Ziel" die neue Lage der bestehenden Leitung. */
  const resolveMovedConnection = useCallback((connection: Connection): Connection => {
    const moving = movingEdgeRef.current;
    if (!moving) return connection;

    const dragStartIsSource =
      connection.source === moving.nodeId && connection.sourceHandle === moving.handleId;
    const newNode = dragStartIsSource ? connection.target : connection.source;
    const newHandle = dragStartIsSource ? connection.targetHandle : connection.sourceHandle;

    const edge = moving.edge;
    const movedEndIsSource =
      edge.source === moving.nodeId && normalizePortHandle(edge.sourceHandle) === normalizePortHandle(moving.handleId);

    return movedEndIsSource
      ? { source: newNode, sourceHandle: newHandle, target: edge.target, targetHandle: edge.targetHandle ?? null }
      : { source: edge.source, sourceHandle: edge.sourceHandle ?? null, target: newNode, targetHandle: newHandle };
  }, []);

  const isValidConnection: IsValidConnection = useCallback(
    (rawConnection) => {
      const connection = resolveMovedConnection(rawConnection as Connection);
      if (connection.source === connection.target) return false;

      const srcBase = normalizePortHandle(connection.sourceHandle);
      const tgtBase = normalizePortHandle(connection.targetHandle);

      const handleAlreadyOccupied = edges.some((e) => {
        if (reconnectingEdgeIdRef.current && e.id === reconnectingEdgeIdRef.current) return false;
        const eSrc = normalizePortHandle(e.sourceHandle);
        const eTgt = normalizePortHandle(e.targetHandle);
        const srcBusy =
          (e.source === connection.source && eSrc === srcBase) ||
          (e.target === connection.source && eTgt === srcBase);
        const tgtBusy =
          (e.source === connection.target && eSrc === tgtBase) ||
          (e.target === connection.target && eTgt === tgtBase);
        return srcBusy || tgtBusy;
      });

      if (handleAlreadyOccupied) {
        setConnectionWarning('Anschluss bereits belegt! Für eine Abzweigung wird ein T-Stück benötigt.');
        return false;
      }

      const sourceInfo = getPortInfo(connection.source, connection.sourceHandle);
      const targetInfo = getPortInfo(connection.target, connection.targetHandle);
      if (!sourceInfo.port || !targetInfo.port) return false;

      if (sourceInfo.port.medium !== targetInfo.port.medium) {
        const mediumNames: Record<string, string> = { water: 'Wasser', electric: 'Strom', refrigerant: 'Kältemittel' };
        setConnectionWarning(
          `Verbindung gesperrt: ${mediumNames[sourceInfo.port.medium]} kann nicht mit ${mediumNames[targetInfo.port.medium]} verbunden werden!`
        );
        return false;
      }

      setConnectionWarning(null);
      return true;
    },
    [edges, getPortInfo, resolveMovedConnection]
  );

  useEffect(() => {
    if (!connectionWarning) return;
    const timer = setTimeout(() => setConnectionWarning(null), 4000);
    return () => clearTimeout(timer);
  }, [connectionWarning]);

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onReconnectStart = useCallback((_: any, edge: Edge) => {
    edgeReconnectSuccessful.current = false;
    reconnectingEdgeIdRef.current = edge.id;
  }, []);

  const onReconnectEnd = useCallback((_: any, _edge: Edge, _handleType: any, connectionState?: { isValid?: boolean | null }) => {
    if (!edgeReconnectSuccessful.current && !connectionState?.isValid) {
      setConnectionWarning('Leitung bleibt am alten Anschluss. Zum Löschen die Leitung anklicken und den Papierkorb nutzen.');
    }
    edgeReconnectSuccessful.current = true;
    reconnectingEdgeIdRef.current = null;
  }, []);

  const evaluateConnectionAdapters = useCallback(
    (
      sourceNodeId: string,
      sourceHandleId: string | null,
      targetNodeId: string,
      targetHandleId: string | null,
      lineSys: LineSystem,
      pipeDim: string
    ): AdapterMatch[] => {
      if (lineSys === 'electric' || lineSys === 'hose') return [];

      const matches: AdapterMatch[] = [];
      const adapterCatalogItems = catalog.filter(
        (c) =>
          c.isActive !== false &&
          c.category === 'adapter' &&
          (!c.lineSystem || c.lineSystem === lineSys)
      );

      const checkEnd = (nodeId: string, handleId: string | null) => {
        const { node, port } = getPortInfo(nodeId, handleId);
        if (!node || !port || !port.fixedDimension) return;
        if (port.fixedDimension === pipeDim) return;

        const lookupKey = `${pipeDim}_to_${port.fixedDimension}`;
        let foundVariant: any = null;
        let foundItem: CatalogItem | null = null;

        for (const adapterItem of adapterCatalogItems) {
          const variant = adapterItem.variants?.find((v) => v.dimension === lookupKey);
          if (variant) {
            foundVariant = variant;
            foundItem = adapterItem;
            break;
          }
        }

        if (foundVariant && foundItem) {
          matches.push({
            portLabel: `${node.data.label} (${port.label})`,
            targetFixedDim: port.fixedDimension,
            adapterName: `${foundItem.name} (${pipeDim} ➔ ${port.fixedDimension})`,
            articleNumber: foundVariant.articleNumber,
            supplierLink: foundVariant.supplierLink || foundItem.supplierLink,
            imageBase64: foundItem.imageBase64,
            price: foundVariant.price ?? foundItem.price ?? 0,
            missingInCatalog: false,
          });
        } else {
          matches.push({
            portLabel: `${node.data.label} (${port.label})`,
            targetFixedDim: port.fixedDimension,
            adapterName: `Übergang ${pipeDim} auf ${port.fixedDimension}`,
            articleNumber: `ADAPT-${pipeDim}-${port.fixedDimension}`,
            price: 15.0,
            missingInCatalog: true,
          });
        }
      };

      checkEnd(sourceNodeId, sourceHandleId);
      checkEnd(targetNodeId, targetHandleId);
      return matches;
    },
    [catalog, getPortInfo]
  );

  const syncDynamicNodeSize = useCallback(
    (nodeId: string, lineSys: LineSystem, newDim: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId && node.data.isDynamicSize) {
            let targetCatalogItem: CatalogItem | undefined;
            if (node.data.lineSystem && node.data.lineSystem !== lineSys) {
              targetCatalogItem = catalog.find(
                (c) =>
                  c.isActive !== false &&
                  c.componentType === node.data.componentType &&
                  c.lineSystem === lineSys
              );
            }

            const baseData = targetCatalogItem
              ? {
                  ...node.data,
                  catalogId: targetCatalogItem.id,
                  label: targetCatalogItem.name,
                  lineSystem: targetCatalogItem.lineSystem,
                  variants: targetCatalogItem.variants || [],
                  price: targetCatalogItem.price,
                  activeArticleNumber: targetCatalogItem.articleNumber,
                }
              : node.data;

            const variants = (baseData.variants as any[]) || [];
            const matched = variants.find((v) => v.dimension === newDim);

            return {
              ...node,
              data: {
                ...baseData,
                activeDimension: newDim,
                price: matched?.price !== undefined ? matched.price : baseData.price,
                activeArticleNumber: matched ? matched.articleNumber : baseData.activeArticleNumber,
                activeSupplierLink: matched?.supplierLink || baseData.activeSupplierLink,
              },
            };
          }
          return node;
        })
      );
    },
    [catalog]
  );

  const detectInitialSystem = useCallback(
    (sourceNodeId: string, sourceHandleId: string | null): { sys: LineSystem; dim: string } => {
      const { port } = getPortInfo(sourceNodeId, sourceHandleId);
      if (port?.medium === 'electric') {
        return { sys: 'electric', dim: port.fixedDimension || '3x2.5' };
      }
      if (port?.medium === 'refrigerant') {
        return { sys: 'refrigerant', dim: '1/4" + 3/8"' };
      }
      return { sys: defaultSystem, dim: defaultDimension };
    },
    [getPortInfo, defaultSystem, defaultDimension]
  );

  const finalizeConnection = useCallback(
    (promptData: PendingAdapterPrompt, includeAdapters: boolean) => {
      const sysConfig = LINE_SYSTEM_CONFIG[promptData.lineSystem];
      const chosenAdapters = includeAdapters
        ? promptData.adapters.map((a) => ({
            name: a.adapterName,
            articleNumber: a.articleNumber,
            supplierLink: a.supplierLink,
            imageBase64: a.imageBase64,
            price: a.price ?? 15.0,
          }))
        : [];

      const lengthM = promptData.lengthMeters || 0;
      const isInsulated = Boolean(promptData.includePipeInsulation);
      const labelProps = getEdgeLabelProps(
        promptData.lineSystem,
        promptData.dimension,
        chosenAdapters.length,
        lengthM,
        isInsulated
      );

      if (promptData.isExistingEdgeId) {
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === promptData.isExistingEdgeId
              ? {
                  ...edge,
                  ...labelProps,
                  source: promptData.edgeParams.source,
                  sourceHandle: promptData.edgeParams.sourceHandle,
                  target: promptData.edgeParams.target,
                  targetHandle: promptData.edgeParams.targetHandle,
                  style: { strokeWidth: 3, stroke: sysConfig.color },
                  data: {
                    ...edge.data,
                    lineSystem: promptData.lineSystem,
                    dimension: promptData.dimension,
                    adapters: chosenAdapters,
                  },
                }
              : edge
          )
        );
      } else {
        const newEdge: Edge = {
          ...promptData.edgeParams,
          id: `edge_${Date.now()}`,
          ...labelProps,
          style: { strokeWidth: 3, stroke: sysConfig.color },
          data: {
            lineSystem: promptData.lineSystem,
            dimension: promptData.dimension,
            lengthMeters: 0,
            includePipeInsulation: false,
            adapters: chosenAdapters,
          },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      }

      syncDynamicNodeSize(promptData.edgeParams.source, promptData.lineSystem, promptData.dimension);
      syncDynamicNodeSize(promptData.edgeParams.target, promptData.lineSystem, promptData.dimension);
      setPendingPrompt(null);
    },
    [getEdgeLabelProps, syncDynamicNodeSize]
  );

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      edgeReconnectSuccessful.current = true;
      const sys = (oldEdge.data?.lineSystem as LineSystem) || 'copper';
      const dim = (oldEdge.data?.dimension as string) || defaultDimension;
      const sourceInfo = getPortInfo(newConnection.source, newConnection.sourceHandle);
      const targetInfo = getPortInfo(newConnection.target, newConnection.targetHandle);
      const adapters = evaluateConnectionAdapters(
        newConnection.source,
        newConnection.sourceHandle,
        newConnection.target,
        newConnection.targetHandle,
        sys,
        dim
      );

      const prompt: PendingAdapterPrompt = {
        edgeParams: newConnection,
        lineSystem: sys,
        dimension: dim,
        lengthMeters: Number(oldEdge.data?.lengthMeters) || 0,
        includePipeInsulation: Boolean(oldEdge.data?.includePipeInsulation),
        sourceDesc: `${sourceInfo.node?.data.label} (${sourceInfo.port?.fixedDimension || 'Dynamisch'})`,
        targetDesc: `${targetInfo.node?.data.label} (${targetInfo.port?.fixedDimension || 'Dynamisch'})`,
        adapters,
        isExistingEdgeId: oldEdge.id,
      };

      if (adapters.length > 0) setPendingPrompt(prompt);
      else finalizeConnection(prompt, false);
    },
    [defaultDimension, getPortInfo, evaluateConnectionAdapters, finalizeConnection]
  );

  const onConnectStart: OnConnectStart = useCallback(
    (_, { nodeId, handleId }) => {
      if (!nodeId || !handleId) return;
      const base = normalizePortHandle(handleId);
      const edge = edges.find(
        (e) =>
          (e.source === nodeId && normalizePortHandle(e.sourceHandle) === base) ||
          (e.target === nodeId && normalizePortHandle(e.targetHandle) === base)
      );
      if (edge) {
        movingEdgeRef.current = { edge, nodeId, handleId };
        reconnectingEdgeIdRef.current = edge.id;
      }
    },
    [edges]
  );

  const onConnectEnd = useCallback(() => {
    movingEdgeRef.current = null;
    reconnectingEdgeIdRef.current = null;
  }, []);

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (movingEdgeRef.current) {
        onReconnect(movingEdgeRef.current.edge, resolveMovedConnection(params));
        return;
      }

      const { sys, dim } = detectInitialSystem(params.source, params.sourceHandle);
      const sourceInfo = getPortInfo(params.source, params.sourceHandle);
      const targetInfo = getPortInfo(params.target, params.targetHandle);

      const requiredAdapters = evaluateConnectionAdapters(
        params.source,
        params.sourceHandle,
        params.target,
        params.targetHandle,
        sys,
        dim
      );

      const promptObj: PendingAdapterPrompt = {
        edgeParams: params,
        lineSystem: sys,
        dimension: dim,
        sourceDesc: `${sourceInfo.node?.data.label} (${sourceInfo.port?.fixedDimension || 'Dynamisch'})`,
        targetDesc: `${targetInfo.node?.data.label} (${targetInfo.port?.fixedDimension || 'Dynamisch'})`,
        adapters: requiredAdapters,
      };

      if (requiredAdapters.length > 0) {
        setPendingPrompt(promptObj);
      } else {
        finalizeConnection(promptObj, false);
      }
    },
    [detectInitialSystem, getPortInfo, evaluateConnectionAdapters, finalizeConnection, onReconnect, resolveMovedConnection]
  );

  const updateEdgeSystemAndDim = (edgeId: string, newSys: LineSystem, newDim: string) => {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const requiredAdapters = evaluateConnectionAdapters(
      edge.source,
      edge.sourceHandle || null,
      edge.target,
      edge.targetHandle || null,
      newSys,
      newDim
    );

    const sourceInfo = getPortInfo(edge.source, edge.sourceHandle);
    const targetInfo = getPortInfo(edge.target, edge.targetHandle);

    const promptObj: PendingAdapterPrompt = {
      edgeParams: {
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle,
      },
      lineSystem: newSys,
      dimension: newDim,
      lengthMeters: Number(edge.data?.lengthMeters) || 0,
      includePipeInsulation: Boolean(edge.data?.includePipeInsulation),
      sourceDesc: `${sourceInfo.node?.data.label} (${sourceInfo.port?.fixedDimension || 'Dynamisch'})`,
      targetDesc: `${targetInfo.node?.data.label} (${targetInfo.port?.fixedDimension || 'Dynamisch'})`,
      adapters: requiredAdapters,
      isExistingEdgeId: edgeId,
    };

    if (requiredAdapters.length > 0) {
      setPendingPrompt(promptObj);
    } else {
      finalizeConnection(promptObj, false);
    }
  };

  const updateEdgeLengthAndInsulation = (
    edgeId: string,
    lengthMeters: number,
    includePipeInsulation: boolean
  ) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const sys = (edge.data?.lineSystem as LineSystem) || 'copper';
        const dim = (edge.data?.dimension as string) || '28mm';
        const adapters = (edge.data?.adapters as any[]) || [];
        return {
          ...edge,
          ...getEdgeLabelProps(sys, dim, adapters.length, lengthMeters, includePipeInsulation),
          data: {
            ...edge.data,
            lengthMeters,
            includePipeInsulation,
          },
        };
      })
    );
  };

  const handleSystemChange = (sys: 'copper' | 'alu') => {
    setDefaultSystem(sys);
    setDefaultDimension(sys === 'copper' ? '28mm' : '26x3');
  };

  const handleConvertAllWaterPipes = () => {
    const targetSys = defaultSystem;
    const targetDim = defaultDimension;
    const sysCfg = LINE_SYSTEM_CONFIG[targetSys];

    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const currentSys = edge.data?.lineSystem as LineSystem;
        if (currentSys !== 'copper' && currentSys !== 'alu') return edge;

        const newAdapters = evaluateConnectionAdapters(
          edge.source,
          edge.sourceHandle || null,
          edge.target,
          edge.targetHandle || null,
          targetSys,
          targetDim
        ).map((a) => ({
          name: a.adapterName,
          articleNumber: a.articleNumber,
          supplierLink: a.supplierLink,
          imageBase64: a.imageBase64,
          price: a.price ?? 15.0,
        }));

        const lengthM = Number(edge.data?.lengthMeters) || 0;
        const isIns = Boolean(edge.data?.includePipeInsulation);

        return {
          ...edge,
          ...getEdgeLabelProps(targetSys, targetDim, newAdapters.length, lengthM, isIns),
          style: { strokeWidth: 3, stroke: sysCfg.color },
          data: {
            ...edge.data,
            lineSystem: targetSys,
            dimension: targetDim,
            adapters: newAdapters,
          },
        };
      })
    );

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (!node.data.isDynamicSize || node.data.lineSystem === 'hose') return node;

        let targetCatalogItem: CatalogItem | undefined;
        if (node.data.lineSystem && node.data.lineSystem !== targetSys) {
          targetCatalogItem = catalog.find(
            (c) =>
              c.isActive !== false &&
              c.componentType === node.data.componentType &&
              c.lineSystem === targetSys
          );
        }

        const baseData = targetCatalogItem
          ? {
              ...node.data,
              catalogId: targetCatalogItem.id,
              label: targetCatalogItem.name,
              lineSystem: targetCatalogItem.lineSystem,
              variants: targetCatalogItem.variants || [],
              price: targetCatalogItem.price,
              activeArticleNumber: targetCatalogItem.articleNumber,
            }
          : node.data;

        const variants = (baseData.variants as any[]) || [];
        const matched = variants.find((v) => v.dimension === targetDim);

        return {
          ...node,
          data: {
            ...baseData,
            activeDimension: targetDim,
            price: matched?.price !== undefined ? matched.price : baseData.price,
            activeArticleNumber: matched ? matched.articleNumber : baseData.activeArticleNumber,
            activeSupplierLink: matched?.supplierLink || baseData.activeSupplierLink,
          },
        };
      })
    );
  };

  const hasUnsavedWork = () => {
    const signature = projectSignature(nodes, edges, bomOverrides, customBomItems);
    return signature !== EMPTY_PROJECT_SIGNATURE && signature !== savedSignatureRef.current;
  };

  const confirmDiscardChanges = (actionLabel: string) => {
    if (!hasUnsavedWork()) return true;
    return confirm(
      `Achtung: Beim Ausführen von "${actionLabel}" gehen deine ungespeicherten Änderungen im Schema und in der Teileliste verloren. Möchtest du wirklich fortfahren?`
    );
  };

  useEffect(() => {
    const warnBeforeLeaving = (e: BeforeUnloadEvent) => {
      const signature = projectSignature(nodes, edges, bomOverrides, customBomItems);
      if (signature !== EMPTY_PROJECT_SIGNATURE && signature !== savedSignatureRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [nodes, edges, bomOverrides, customBomItems]);

  const handleBeforeDelete = async ({ nodes: deletedNodes, edges: deletedEdges }: { nodes: Node[]; edges: Edge[] }) => {
    if (deletedNodes.length === 0 && deletedEdges.length === 0) return false;
    return confirm(
      `${deletedNodes.length} Bauteil(e) und ${deletedEdges.length} Leitung(en) wirklich löschen?`
    );
  };

  const swapTargetNode = useMemo(
    () => nodes.find((n) => n.id === swapTargetNodeId),
    [nodes, swapTargetNodeId]
  );

  const swapCandidates = useMemo(() => {
    if (!swapTargetNode) return [];
    const subType = swapTargetNode.data.componentType as ComponentSubType | undefined;
    const cat = swapTargetNode.data.category;

    return catalog.filter((item) => {
      if (item.isActive === false) return false;
      if (item.id === swapTargetNode.data.catalogId) return false;
      if (subType && subType !== 'other') {
        return item.componentType === subType;
      }
      return item.category === cat;
    });
  }, [catalog, swapTargetNode]);

  const executeSwapNode = (replacement: CatalogItem) => {
    if (!swapTargetNodeId) return;
    const pipeDim = defaultDimension;
    const matchedVariant = replacement.isDynamicSize
      ? replacement.variants?.find((v) => v.dimension === pipeDim)
      : undefined;
    const actArt = matchedVariant ? matchedVariant.articleNumber : replacement.articleNumber;
    const matchIns = findMatchingPartInsulation(actArt, catalog);

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== swapTargetNodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            catalogId: replacement.id,
            label: replacement.name,
            category: replacement.category,
            componentType: replacement.componentType,
            manufacturer: replacement.manufacturer,
            isActive: replacement.isActive ?? true,
            lineSystem: replacement.lineSystem,
            price: matchedVariant?.price !== undefined ? matchedVariant.price : replacement.price,
            imageBase64: replacement.imageBase64,
            documents: replacement.documents || [],
            isMultiPort: replacement.isMultiPort ?? (replacement.ports && replacement.ports.length > 0),
            ports: replacement.ports || [],
            leftLabel: replacement.leftLabel || 'Eingang',
            leftMedium: replacement.leftMedium || 'water',
            leftDim: replacement.leftDim || '',
            rightLabel: replacement.rightLabel || 'Ausgang',
            rightMedium: replacement.rightMedium || 'water',
            rightDim: replacement.rightDim || '',
            isDynamicSize: replacement.isDynamicSize,
            variants: replacement.variants || [],
            activeDimension: replacement.isDynamicSize ? pipeDim : undefined,
            activeArticleNumber: actArt,
            activeSupplierLink: matchedVariant?.supplierLink || replacement.supplierLink,
            matchingInsulationArticle: matchIns?.articleNumber,
            matchingInsulationName: matchIns?.name,
          },
        };
      })
    );
    setSwapTargetNodeId(null);
  };

  const addNodeToCanvas = (item: CatalogItem) => {
    const initialDim =
      item.lineSystem === 'copper' || item.lineSystem === 'alu'
        ? defaultDimension
        : item.lineSystem
        ? LINE_SYSTEM_CONFIG[item.lineSystem].dimensions[0]
        : defaultDimension;

    // Neue Bauteile landen im sichtbaren Bereich, auch wenn die Ansicht verschoben wurde.
    const canvasRect = canvasWrapperRef.current?.getBoundingClientRect();
    const center =
      canvasRect && flowInstanceRef.current
        ? flowInstanceRef.current.screenToFlowPosition({
            x: canvasRect.left + canvasRect.width / 2,
            y: canvasRect.top + canvasRect.height / 2,
          })
        : { x: 300, y: 200 };
    const newNode = createSchemaNode(
      item,
      catalog,
      center.x - 130 + Math.random() * 80,
      center.y - 100 + Math.random() * 80,
      initialDim
    );
    setNodes((nds) => [...nds, newNode]);
  };

  const handleApplyWizard = async (
    newNodes: Node[],
    newEdges: Edge[],
    sys: LineSystem,
    dim: string,
    warnings: string[] = []
  ) => {
    if (!confirmDiscardChanges('Assistenten-Schema generieren')) return;

    if (sys === 'copper' || sys === 'alu') {
      setDefaultSystem(sys);
      setDefaultDimension(dim);
    }
    const styledEdges = newEdges.map((e) => {
      const eSys = (e.data?.lineSystem as LineSystem) || sys;
      const eDim = (e.data?.dimension as string) || dim;
      const adaptersLen = ((e.data?.adapters as any[]) || []).length;
      const lenM = Number(e.data?.lengthMeters) || 0;
      const isIns = Boolean(e.data?.includePipeInsulation);
      return {
        ...e,
        ...getEdgeLabelProps(eSys, eDim, adaptersLen, lenM, isIns),
      };
    });

    setNodes(newNodes);
    setEdges(styledEdges);
    setBomOverrides({});
    setCustomBomItems([]);
    setSelectedEdgeId(null);
    await loadCatalog(false);
    setActiveTab('canvas');
    if (warnings.length > 0) setConnectionWarning(warnings.join(' '));
  };

  const handleSaveProjectLocal = async () => {
    await db.projects.add({
      name: projectName || 'Unbenanntes Projekt',
      updatedAt: new Date().toLocaleString('de-DE'),
      defaultSystem,
      defaultDimension,
      diagramNodes: nodes,
      diagramEdges: edges,
      bomOverrides,
      customBomItems,
    });
    savedSignatureRef.current = projectSignature(nodes, edges, bomOverrides, customBomItems);
    await loadSavedProjects();
  };

  const handleLoadProjectData = (
    name: string,
    loadedNodes: Node[],
    loadedEdges: Edge[],
    sys: LineSystem,
    dim: string,
    overrides: Record<string, { quantity?: number; deleted?: boolean }> = {},
    customItems: CustomBomItem[] = []
  ) => {
    if (!confirmDiscardChanges(`Projekt "${name}" öffnen`)) return false;

    setProjectName(name);
    if (sys === 'copper' || sys === 'alu') {
      setDefaultSystem(sys);
      setDefaultDimension(dim);
    }
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setBomOverrides(overrides);
    setCustomBomItems(customItems);
    setSelectedEdgeId(null);
    savedSignatureRef.current = projectSignature(loadedNodes, loadedEdges, overrides, customItems);
    setActiveTab('canvas');
    return true;
  };

  const handleDeleteSavedProject = async (id: number) => {
    if (!confirm('Gespeichertes Projekt wirklich aus der lokalen Datenbank löschen?')) return;
    await db.projects.delete(id);
    await loadSavedProjects();
  };

  /** Rendert das gesamte Schema (nicht nur den sichtbaren Ausschnitt) als Bild. */
  const captureCanvasImage = async (requestedMediaFilter: MediaFilter = 'all'): Promise<SchemaImage | null> => {
    if (nodes.length === 0) return null;
    const previousTab = activeTab;
    const previousMedia = mediaFilter;
    const padding = 40;

    setIsExporting(true);
    setActiveTab('canvas');
    setMediaFilter(requestedMediaFilter);

    try {
      await new Promise((r) => setTimeout(r, 800));

      const viewport = canvasWrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewport) return null;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      viewport.querySelectorAll<HTMLElement>('.react-flow__node').forEach((el) => {
        const node = nodes.find((n) => n.id === el.dataset.id);
        if (!node) return;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + el.offsetWidth);
        maxY = Math.max(maxY, node.position.y + el.offsetHeight);
      });
      if (minX === Infinity) return null;

      const width = Math.ceil(maxX - minX + padding * 2);
      const height = Math.ceil(maxY - minY + padding * 2);

      const dataUrl = await toPng(viewport, {
        width,
        height,
        backgroundColor: '#ffffff',
        pixelRatio: Math.min(2, 8000 / Math.max(width, height)),
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${padding - minX}px, ${padding - minY}px) scale(1)`,
        },
      });
      return { dataUrl, width, height };
    } catch (error) {
      console.error('Schema konnte nicht gerendert werden', error);
      return null;
    } finally {
      setMediaFilter(previousMedia);
      setActiveTab(previousTab);
      setIsExporting(false);
    }
  };

  const filteredSidebarCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (item.isActive === false) return false;
      if (item.category === 'adapter' || item.category === 'pipe') return false;

      const matchesSearch =
        item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.articleNumber.toLowerCase().includes(catalogSearch.toLowerCase());

      const matchesCategory =
        catalogCategoryFilter === 'all' || item.category === catalogCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [catalog, catalogSearch, catalogCategoryFilter]);

  const displayedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        hidden: isExporting && !nodeUsesMedium(n.data, mediaFilter),
        data: {
          ...n.data,
          activeMediaFilter: mediaFilter,
          isExporting,
        },
      })),
    [nodes, mediaFilter, isExporting]
  );

  const displayedEdges = useMemo(
    () =>
      edges.map((e) => {
        if (mediaFilter === 'all') return { ...e, hidden: false };
        const sys = (e.data?.lineSystem as LineSystem) || 'copper';
        const edgeMedium = LINE_SYSTEM_CONFIG[sys]?.medium || 'water';
        return {
          ...e,
          hidden: edgeMedium !== mediaFilter,
        };
      }),
    [edges, mediaFilter]
  );

  const autoInsulationItems = useMemo(() => {
    const list: CustomBomItem[] = [];

    for (const n of nodes) {
      if (n.data?.includeInsulation && n.data?.matchingInsulationArticle) {
        const insItem = catalog.find((c) => c.articleNumber === n.data.matchingInsulationArticle);
        if (insItem) {
          list.push({
            id: `node_${n.id}`,
            name: insItem.name,
            articleNumber: insItem.articleNumber,
            quantity: 1,
            unit: 'Stk',
            unitPrice: Number(insItem.price) || 0,
            supplierLink: insItem.supplierLink,
            imageBase64: insItem.imageBase64,
            documents: insItem.documents,
          });
        }
      }
    }

    for (const e of edges) {
      const lenM = Number(e.data?.lengthMeters) || 0;
      if (e.data?.includePipeInsulation && lenM > 0) {
        const sys = (e.data?.lineSystem as LineSystem) || 'copper';
        const dim = (e.data?.dimension as string) || '';
        const pipeIns = findInsulationForArticle(catalog, findPipeArticle(catalog, sys, dim).variant?.articleNumber, { sys, dim });
        if (pipeIns) {
          list.push({
            id: `edge_${e.id}`,
            name: pipeIns.name,
            articleNumber: pipeIns.articleNumber,
            quantity: lenM,
            unit: 'm',
            unitPrice: Number(pipeIns.price) || 0,
            supplierLink: pipeIns.supplierLink,
            imageBase64: pipeIns.imageBase64,
            documents: pipeIns.documents,
          });
        }
      }
    }

    return list;
  }, [nodes, edges, catalog]);

  const liveBomRows = useMemo(
    () => calculateBomRows(nodes, edges, catalog, customBomItems, bomOverrides, autoInsulationItems),
    [nodes, edges, catalog, customBomItems, bomOverrides, autoInsulationItems]
  );

  const liveTotalNet = useMemo(() => liveBomRows.reduce((sum, r) => sum + r.totalPrice, 0), [liveBomRows]);
  const liveTotalGross = liveTotalNet * 1.19;

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeSystem = (selectedEdge?.data?.lineSystem as LineSystem) || 'copper';
  const selectedEdgeAdapters = ((selectedEdge?.data?.adapters as any[]) || []);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 relative">
      {isExporting && (
        <div className="fixed inset-0 bg-white/90 z-[60] flex items-center justify-center text-sm font-bold text-slate-700">
          PDF wird erzeugt …
        </div>
      )}

      {connectionWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-bounce">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{connectionWarning}</span>
        </div>
      )}

      {swapTargetNode && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-sky-600" />
                  Bauteil tauschen: {swapTargetNode.data.label as string}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Typ:{' '}
                  {COMPONENT_SUBTYPE_LABELS[
                    (swapTargetNode.data.componentType as ComponentSubType) || 'other'
                  ] || (swapTargetNode.data.category as string)}
                </p>
              </div>
              <button
                onClick={() => setSwapTargetNodeId(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {swapCandidates.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  Keine weiteren aktiven Bauteile desselben Typs im Teilekatalog gefunden.
                </p>
              ) : (
                swapCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    onClick={() => executeSwapNode(cand)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 transition-all flex justify-between items-center gap-3 cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{cand.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">Art.-Nr: {cand.articleNumber}</div>
                    </div>
                    <span className="font-bold text-xs text-emerald-700 shrink-0">
                      {Number(cand.price || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {pendingPrompt && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl shrink-0"><AlertTriangle className="w-6 h-6" /></div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Abweichende Anschlüsse erkannt – Adapter hinzufügen?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Du verbindest <strong>{pendingPrompt.sourceDesc}</strong> über{' '}
                  <strong>{LINE_SYSTEM_CONFIG[pendingPrompt.lineSystem].label} ({pendingPrompt.dimension})</strong>{' '}
                  mit <strong>{pendingPrompt.targetDesc}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-bold text-slate-700">Benötigte Übergangsstücke:</div>
              {pendingPrompt.adapters.map((ad, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                    ad.missingInCatalog ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{ad.adapterName}</div>
                    <div className="text-[11px] text-slate-500">Anschluss: {ad.portLabel}</div>
                  </div>
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {ad.articleNumber}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingPrompt(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={() => finalizeConnection(pendingPrompt, false)}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
              >
                Ohne Adapter
              </button>
              <button
                onClick={() => finalizeConnection(pendingPrompt, true)}
                className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Adapter hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-wrap justify-between items-center gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 text-white p-2.5 rounded-xl shadow-xs flex items-center justify-center relative">
              <Fan className="w-6 h-6 animate-[spin_12s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Wärmepumpen- und Klimaanlagenplaner
                </h1>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-sky-400 px-2 py-0.5 rounded-full">
                  by JD
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Mit Planungsassistent, Schematischen Zeichnungen, Teilelisten und Preisberechnung
              </p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'canvas' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Schema-Editor
            </button>
            <button
              onClick={() => setActiveTab('wizards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'wizards' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" /> Assistenten
            </button>
            <button
              onClick={() => setActiveTab('bom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'bom' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" /> Teileliste ({liveBomRows.length})
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'export' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileDown className="w-3.5 h-3.5" /> Export & Projekte
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'catalog' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Teilekatalog ({catalog.length})
            </button>
          </nav>
        </div>

        {activeTab === 'canvas' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (confirmDiscardChanges('Neue leere Zeichnung starten')) {
                  savedSignatureRef.current = EMPTY_PROJECT_SIGNATURE;
                  flowInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 });
                  setNodes([]);
                  setEdges([]);
                  setBomOverrides({});
                  setCustomBomItems([]);
                  setSelectedEdgeId(null);
                }
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Zeichenfläche leeren"
            >
              <FilePlus2 className="w-3.5 h-3.5" /> Leere Seite
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              {(
                [
                  { id: 'all', label: 'Alle Medien' },
                  { id: 'water', label: 'Wasser' },
                  { id: 'electric', label: 'Strom' },
                  { id: 'refrigerant', label: 'Kältemittel' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMediaFilter(m.id)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    mediaFilter === m.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600">Verrohrung:</span>
              <select
                value={defaultSystem}
                onChange={(e) => handleSystemChange(e.target.value as 'copper' | 'alu')}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white font-bold"
              >
                <option value="copper">Kupferrohr</option>
                <option value="alu">Alu-Verbundrohr</option>
              </select>

              <select
                value={defaultDimension}
                onChange={(e) => setDefaultDimension(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white font-bold"
              >
                {LINE_SYSTEM_CONFIG[defaultSystem].dimensions.map((dim) => (
                  <option key={dim} value={dim}>
                    {dim}
                  </option>
                ))}
              </select>

              <button
                onClick={handleConvertAllWaterPipes}
                className="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                title="Stellt alle Wasserleitungen und Fittings im Schema auf das gewählte System um"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Alle Rohre umstellen
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Bleibt eingehängt, damit ein offenes Formular beim Tabwechsel nicht verloren geht. */}
      <div className="flex-1 overflow-y-auto" hidden={activeTab !== 'catalog'}>
        <CatalogManager catalog={catalog} onCatalogUpdated={() => loadCatalog(false)} />
      </div>

      {activeTab === 'catalog' ? null : activeTab === 'wizards' ? (
        <div className="flex-1 overflow-y-auto">
          <SystemWizards catalog={catalog} onApplyWizard={handleApplyWizard} />
        </div>
      ) : activeTab === 'bom' || activeTab === 'export' ? (
        <div className="flex-1 overflow-y-auto">
          <BomAndExport
            mode={activeTab}
            projectName={projectName}
            onProjectNameChange={setProjectName}
            nodes={nodes}
            edges={edges}
            catalog={catalog}
            defaultSystem={defaultSystem}
            defaultDimension={defaultDimension}
            savedProjects={savedProjects}
            onSaveProjectLocal={handleSaveProjectLocal}
            onLoadProjectData={handleLoadProjectData}
            onDeleteSavedProject={handleDeleteSavedProject}
            onCaptureCanvasImage={captureCanvasImage}
            onCatalogUpdated={() => loadCatalog(false)}
            bomOverrides={bomOverrides}
            onBomOverridesChange={setBomOverrides}
            customBomItems={customBomItems}
            autoInsulationItems={autoInsulationItems}
            onCustomBomItemsChange={setCustomBomItems}
            pdfMediaChoice={pdfMediaChoice}
            onPdfMediaChoiceChange={setPdfMediaChoice}
            onProjectExported={() => {
              savedSignatureRef.current = projectSignature(nodes, edges, bomOverrides, customBomItems);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 overflow-hidden">
          <div ref={canvasWrapperRef} className="md:col-span-3 h-full relative border-r border-slate-200">
            <ReactFlow
              nodes={displayedNodes}
              edges={displayedEdges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                flowInstanceRef.current = instance as unknown as ReactFlowInstance;
              }}
              connectionMode={ConnectionMode.Loose}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              edgesReconnectable={true}
              onReconnectStart={onReconnectStart}
              reconnectRadius={16}
              onReconnect={onReconnect}
              onReconnectEnd={onReconnectEnd}
              onBeforeDelete={handleBeforeDelete}
              isValidConnection={isValidConnection}
              onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
              onPaneClick={() => setSelectedEdgeId(null)}
              fitView
              minZoom={0.1}
            >
              <Background gap={16} size={1} />
              <Controls />
            </ReactFlow>
          </div>

          <div className="bg-white p-4 overflow-hidden flex flex-col gap-3 border-l border-slate-200 h-full">
            {selectedEdge && (
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-2.5 shrink-0 max-h-[52%] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-sky-600" />
                    Leitung konfigurieren
                  </h3>
                  <button
                    onClick={() => {
                      if (!confirm('Diese Leitung inklusive Länge und Adaptern wirklich löschen?')) return;
                      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                      setSelectedEdgeId(null);
                    }}
                    className="text-red-600 hover:bg-red-100 p-1 rounded cursor-pointer"
                    title="Leitung löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Material / System:</label>
                    <select
                      value={selectedEdgeSystem}
                      onChange={(e) => {
                        const newSys = e.target.value as LineSystem;
                        const firstDim = LINE_SYSTEM_CONFIG[newSys].dimensions[0];
                        updateEdgeSystemAndDim(selectedEdge.id, newSys, firstDim);
                      }}
                      className="w-full border border-sky-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
                    >
                      {Object.entries(LINE_SYSTEM_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Dimension:</label>
                    <select
                      value={(selectedEdge.data?.dimension as string) || ''}
                      onChange={(e) => updateEdgeSystemAndDim(selectedEdge.id, selectedEdgeSystem, e.target.value)}
                      className="w-full border border-sky-300 rounded-lg p-1.5 text-xs bg-white font-semibold"
                    >
                      {LINE_SYSTEM_CONFIG[selectedEdgeSystem].dimensions.map((dim) => (
                        <option key={dim} value={dim}>{dim}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-sky-200 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-800 flex justify-between">
                    <span>Leitungslänge für Teileliste (m):</span>
                    {Number(selectedEdge.data?.lengthMeters) > 0 && (
                      <span className="text-emerald-700 flex items-center gap-0.5">
                        ✓ Erfasst ({selectedEdge.data?.lengthMeters as number} m)
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="z.B. 4.5"
                      value={(selectedEdge.data?.lengthMeters as number) || ''}
                      onChange={(e) =>
                        updateEdgeLengthAndInsulation(
                          selectedEdge.id,
                          parseFloat(e.target.value) || 0,
                          Boolean(selectedEdge.data?.includePipeInsulation)
                        )
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs font-bold"
                    />
                    <span className="text-xs font-semibold text-slate-500">Meter</span>
                  </div>

                  {(selectedEdgeSystem === 'copper' || selectedEdgeSystem === 'alu') && (
                    <label className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-[11px] font-semibold text-emerald-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedEdge.data?.includePipeInsulation)}
                        onChange={(e) =>
                          updateEdgeLengthAndInsulation(
                            selectedEdge.id,
                            Number(selectedEdge.data?.lengthMeters) || 0,
                            e.target.checked
                          )
                        }
                      />
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      Rohrdämmung für dieses Teilstück berechnen
                    </label>
                  )}
                  {Boolean(selectedEdge.data?.includePipeInsulation) && !(Number(selectedEdge.data?.lengthMeters) > 0) && (
                    <p className="text-[11px] text-amber-800">
                      Rohr und Rohrdämmung erscheinen in der Teileliste, sobald eine Länge eingetragen ist.
                    </p>
                  )}
                </div>

                {selectedEdgeAdapters.length > 0 && (
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1.5">
                    <div className="text-[11px] font-bold text-amber-900">
                      Verbaute Adapter an dieser Leitung ({selectedEdgeAdapters.length}):
                    </div>
                    {selectedEdgeAdapters.map((ad: any, i: number) => {
                      const catMatch = catalog.find(
                        (c) => c.articleNumber === ad.articleNumber || c.variants?.some((v) => v.articleNumber === ad.articleNumber)
                      );
                      const link = ad.supplierLink || catMatch?.supplierLink;
                      const img = ad.imageBase64 || catMatch?.imageBase64;

                      return (
                        <div key={i} className="flex justify-between items-center gap-2 bg-amber-50/60 p-1.5 rounded border border-amber-200 text-[11px]">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate">{ad.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{ad.articleNumber}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 bg-white hover:bg-sky-50 text-sky-600 rounded border border-slate-200"
                                title="Adapter beim Händler öffnen"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {img && (
                              <button
                                onClick={() => openDataUrl(img)}
                                className="p-1 bg-white hover:bg-sky-50 text-slate-700 rounded border border-slate-200 cursor-pointer"
                                title="Adapter-Bild öffnen"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 shrink-0">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bauteile hinzufügen</h2>
              <input
                type="text"
                placeholder="Suche nach Name oder Art.-Nr..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'Alle' },
                  { id: 'heatpump', label: 'WP' },
                  { id: 'dhw_heatpump', label: 'BWWP' },
                  { id: 'buffer', label: 'Speicher' },
                  { id: 'fitting', label: 'Fittings' },
                  { id: 'mounting', label: 'Montage' },
                  { id: 'insulation', label: 'Dämmung' },
                  { id: 'electric', label: 'Elektro' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCatalogCategoryFilter(cat.id)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      catalogCategoryFilter === cat.id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {filteredSidebarCatalog.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Keine passenden aktiven Bauteile gefunden.</p>
              ) : (
                filteredSidebarCatalog.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addNodeToCanvas(item)}
                    className="w-full text-left p-2.5 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-lg text-xs transition-colors group flex items-center gap-2.5 cursor-pointer"
                  >
                    {item.imageBase64 && (
                      <img
                        src={item.imageBase64}
                        alt={item.name}
                        className="w-8 h-8 object-contain bg-white rounded border border-slate-200 p-0.5 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 flex justify-between items-center gap-1">
                        <span className="truncate">{item.name}</span>
                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-sky-600 shrink-0" />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-1.5 items-center justify-between">
                        <span className="font-mono">{item.articleNumber}</span>
                        {item.price !== undefined && item.price > 0 && (
                          <span className="font-bold text-emerald-700">
                            {Number(item.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 shrink-0 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Verbaute Positionen:</span>
                <span className="font-bold text-slate-900">{liveBomRows.length} Pos.</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-950">Gesamtsumme (Netto):</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {liveTotalNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Inkl. 19% MwSt. (Brutto):</span>
                <span className="font-bold text-slate-700">
                  {liveTotalGross.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}