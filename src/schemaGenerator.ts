import { type Node, type Edge } from '@xyflow/react';
import {
  LINE_SYSTEM_CONFIG,
  findInsulationForArticle,
  type CatalogItem,
  type ComponentSubType,
  type LineSystem,
} from './db';

const HOSE_DIMENSION_BY_PORT: Record<string, string> = {
  '1_Zoll_IG': 'DN25 (1")',
  '1_1/4_Zoll_IG': 'DN32 (1 1/4")',
};
const BUS_CABLE = 'Bus 2x2x0.8';
const COLUMN_STEP = 520;

export interface HeatPumpOptions {
  design: 'monoblock' | 'semisplit';
  monoId: number;
  splitOutId: number;
  splitInId: number;
  splitIndoorMode: 'with_tank' | 'wall_only';
  lineSystem: 'copper' | 'alu';
  dimension: string;
  bufferId: number;
  dhwMode: 'none' | 'internal' | 'external';
  dhwTankId: number;
  dhwHeatingRod: boolean;
  mountId: number;
  magHeatId: number;
  magDhwId: number;
  frostValves: boolean;
  flexHoses: boolean;
  microbubble: boolean;
  sludgeSeparator: boolean;
  coarseFilter: boolean;
  heatMeter: boolean;
  diffValve: boolean;
  fillingStation: boolean;
  heatingCircuit: boolean;
  insulation: boolean;
  chassisHeater: boolean;
  subDistribution: boolean;
  surgeProtector: boolean;
  rcdId: number;
  breakerWpId: number;
  breakerHeaterId: number;
  breakerRodId: number;
  extensionPcb: boolean;
  networkModule: boolean;
  outdoorSensor: boolean;
  indoorSensorCount: number;
}

export interface BwwpOptions {
  bwwpId: number;
  lineSystem: 'copper' | 'alu';
  dimension: string;
  magId: number;
  waterFilter: boolean;
  safetyGroup: boolean;
  condensateDrain: boolean;
  subDistribution: boolean;
  insulation: boolean;
}

export interface GeneratedSchema {
  nodes: Node[];
  edges: Edge[];
  /** Hinweise, z.B. wenn ein benötigter Artikel im Katalog fehlt oder inaktiv ist. */
  warnings: string[];
}

export function createSchemaNode(
  item: CatalogItem,
  catalog: CatalogItem[],
  x: number,
  y: number,
  pipeDim?: string,
  includeInsulation = false
): Node {
  const variant = item.isDynamicSize && pipeDim ? item.variants?.find((v) => v.dimension === pipeDim) : undefined;
  const articleNumber = variant ? variant.articleNumber : item.articleNumber;
  const insulation = findInsulationForArticle(catalog, articleNumber);

  return {
    id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type: 'hvac',
    position: { x, y },
    data: {
      catalogId: item.id,
      label: item.name,
      category: item.category,
      componentType: item.componentType,
      manufacturer: item.manufacturer,
      isActive: item.isActive ?? true,
      lineSystem: item.lineSystem,
      price: variant?.price !== undefined ? variant.price : item.price,
      imageBase64: item.imageBase64,
      documents: item.documents || [],
      isMultiPort: item.isMultiPort ?? (item.ports && item.ports.length > 0),
      ports: item.ports || [],
      leftLabel: item.leftLabel || 'Eingang',
      leftMedium: item.leftMedium || 'water',
      leftDim: item.leftDim || '',
      rightLabel: item.rightLabel || 'Ausgang',
      rightMedium: item.rightMedium || 'water',
      rightDim: item.rightDim || '',
      isDynamicSize: item.isDynamicSize,
      variants: item.variants || [],
      activeDimension: item.isDynamicSize ? pipeDim : undefined,
      activeArticleNumber: articleNumber,
      activeSupplierLink: variant?.supplierLink || item.supplierLink,
      matchingInsulationArticle: insulation?.articleNumber,
      matchingInsulationName: insulation?.name,
      includeInsulation: Boolean(includeInsulation && insulation),
    },
  };
}

function estimateNodeHeight(item: CatalogItem): number {
  const portCount = item.isMultiPort === false ? 1 : Math.max(item.ports?.length ?? 0, 1);
  return 120 + portCount * 50 + (item.imageBase64 ? 72 : 0);
}

function fixedDimensionOf(node: Node, handleId: string): string | undefined {
  if (node.data.isMultiPort) {
    const portId = handleId.replace(/-in$/, '').replace(/-out$/, '');
    const ports = node.data.ports as { id: string; fixedDimension?: string }[];
    return ports.find((p) => p.id === portId)?.fixedDimension;
  }
  return (handleId.includes('left') ? node.data.leftDim : node.data.rightDim) as string | undefined;
}

/** Baukasten mit gemeinsamer Knoten-, Leitungs- und Adapterlogik für beide Assistenten. */
function createBuilder(catalog: CatalogItem[]) {
  const active = catalog.filter((c) => c.isActive !== false);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const warnings: string[] = [];
  let bottom = 0;

  const bySubType = (type: ComponentSubType) => active.find((c) => c.componentType === type);
  const byId = (id: number) => active.find((c) => c.id === Number(id));

  const place = (item: CatalogItem, x: number, y: number, pipeDim?: string, insulate = false, name?: string) => {
    const node = createSchemaNode(name ? { ...item, name } : item, catalog, x, y, pipeDim, insulate);
    nodes.push(node);
    bottom = Math.max(bottom, y + estimateNodeHeight(item));
    return node;
  };

  const adaptersFor = (source: Node, sourceHandle: string, target: Node, targetHandle: string, sys: LineSystem, dim: string) => {
    if (sys === 'electric' || sys === 'hose') return [];
    const adapterItems = active.filter((c) => c.category === 'adapter' && c.lineSystem === sys);
    const result: { name: string; articleNumber: string; supplierLink?: string; imageBase64?: string; price?: number }[] = [];

    for (const [node, handle] of [[source, sourceHandle], [target, targetHandle]] as const) {
      const fixedDim = fixedDimensionOf(node, handle);
      if (!fixedDim || fixedDim === dim) continue;
      const key = `${dim}_to_${fixedDim}`;
      for (const adapter of adapterItems) {
        const variant = adapter.variants?.find((v) => v.dimension === key);
        if (variant) {
          result.push({
            name: `${adapter.name} (${dim} ➔ ${fixedDim})`,
            articleNumber: variant.articleNumber,
            supplierLink: variant.supplierLink || adapter.supplierLink,
            imageBase64: adapter.imageBase64,
            price: variant.price ?? adapter.price ?? 0,
          });
          break;
        }
      }
    }
    return result;
  };

  const connect = (source: Node, sourceHandle: string, target: Node, targetHandle: string, sys: LineSystem, dim: string, insulate = false) => {
    const isPipe = sys === 'copper' || sys === 'alu';
    edges.push({
      id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      source: source.id,
      sourceHandle,
      target: target.id,
      targetHandle,
      style: { strokeWidth: 3, stroke: LINE_SYSTEM_CONFIG[sys].color },
      data: {
        lineSystem: sys,
        dimension: dim,
        lengthMeters: 0,
        includePipeInsulation: insulate && isPipe,
        adapters: adaptersFor(source, sourceHandle, target, targetHandle, sys, dim),
      },
    });
  };

  return { nodes, edges, warnings, bySubType, byId, place, connect, getBottom: () => bottom };
}

interface ChainPart {
  node: Node;
  inHandle: string;
  outHandle: string;
  isHose?: boolean;
}

const THROUGH = { inHandle: 'left-port', outHandle: 'right-port' };
const TEE = { inHandle: 'a-in', outHandle: 'b-out' };

/**
 * Wärmepumpe mit Puffer in Reihe nach BWP-Leitfaden Hydraulik, Schema 2:
 *
 * Vorlauf:  WP > Frostschutzventil > Panzerschlauch > Mikroblasenabscheider > WMZ-Set Vorlauf
 *           > 3-Wege-Ventil > (A) T-Stück Überströmventil > Heizkreis
 *                             (B) Warmwasserspeicher
 * Rücklauf: Heizkreis > T-Stück Überströmventil > Puffer > T-Stück WW-Rücklauf > Grobfilter
 *           > Schlammabscheider > WMZ > T-Stück Befüllung > T-Stück MAG > Panzerschlauch
 *           > Frostschutzventil > WP
 *
 * Der WW-Rücklauf mündet hinter dem Puffer, damit er nicht durch den Puffer strömt.
 * Das MAG sitzt im Rücklauf nah an der Wärmepumpe.
 */
export function generateHeatPumpSchema(catalog: CatalogItem[], o: HeatPumpOptions): GeneratedSchema | null {
  const b = createBuilder(catalog);
  const { place, connect, bySubType, byId, warnings } = b;
  const sys = o.lineSystem;
  const dim = o.dimension;
  const insulate = o.insulation;

  const VL_Y = 0;
  const BYPASS_Y = 340;
  const RL_Y = 560;
  const BRANCH_Y = 880;

  /** Frostschutzventil und Panzerschlauch in der Größe des Geräteanschlusses. */
  const outdoorRunParts = (unit: Node) => {
    const waterPort = ((unit.data.ports as { medium: string; fixedDimension?: string }[]) || []).find(
      (p) => p.medium === 'water'
    );
    const pick = (type: ComponentSubType) => {
      const candidates = active(catalog).filter((c) => c.componentType === type);
      return candidates.find((c) => c.leftDim === waterPort?.fixedDimension) ?? candidates[0];
    };
    const items = [o.frostValves ? pick('frost_valve') : undefined, o.flexHoses ? pick('flex_hose') : undefined].filter(
      (item): item is CatalogItem => Boolean(item)
    );
    return {
      items,
      hoseDimension: HOSE_DIMENSION_BY_PORT[items[0]?.leftDim ?? ''] ?? 'DN32 (1 1/4")',
    };
  };

  // --- Wärmeerzeuger ---
  let outdoor: Node;
  let hydronic: Node;
  let chainStartX = 520;

  if (o.design === 'monoblock') {
    const unit = byId(o.monoId) ?? bySubType('hp_outdoor_mono');
    if (!unit) return null;
    outdoor = place(unit, 0, 60, dim);
    hydronic = outdoor;
  } else {
    const outItem = byId(o.splitOutId) ?? bySubType('hp_outdoor_split');
    const inItem = byId(o.splitInId) ?? bySubType(o.splitIndoorMode === 'with_tank' ? 'hp_indoor_tank' : 'hp_indoor_wall');
    if (!outItem || !inItem) return null;
    outdoor = place(outItem, 0, 60, dim);
    const runParts = outdoorRunParts(outdoor);
    const indoorX = 520 + runParts.items.length * COLUMN_STEP;
    hydronic = place(inItem, indoorX, 60, dim);

    // Zwischen Außen- und Innengerät läuft Wasser: Armaturen direkt am Außengerät, danach festes Rohr.
    const addOutdoorRun = (outHandle: string, inHandle: string, y: number, label: string) => {
      let previous = outdoor;
      let previousHandle = outHandle;
      runParts.items.forEach((item, index) => {
        const node = place(item, 520 + index * COLUMN_STEP, y, dim, insulate, `${item.name} (${label})`);
        connect(previous, previousHandle, node, 'left-port', 'hose', runParts.hoseDimension);
        previous = node;
        previousHandle = 'right-port';
      });
      connect(previous, previousHandle, hydronic, inHandle, sys, dim, insulate);
    };
    addOutdoorRun('vl_sp-out', 'vl_in-in', VL_Y, 'Vorlauf');
    addOutdoorRun('rl_sp-out', 'rl_in-in', RL_Y, 'Rücklauf');
    connect(outdoor, 'bus_out-out', hydronic, 'bus_in-in', 'electric', BUS_CABLE);
    chainStartX = indoorX + COLUMN_STEP;
  }

  if (o.mountId > 0) {
    const mount = byId(o.mountId);
    if (mount) place(mount, 0, 520);
  }

  const teeItem = active(catalog).find((c) => c.componentType === 'tee_piece' && c.lineSystem === sys);
  const placeTee = (x: number, y: number, name: string): Node | null => {
    if (!teeItem) {
      warnings.push(`Kein aktives T-Stück für ${LINE_SYSTEM_CONFIG[sys].label} im Katalog: ${name} konnte nicht angebunden werden.`);
      return null;
    }
    return place(teeItem, x, y, dim, false, `${teeItem.name} (${name})`);
  };

  // Bei Semisplit sitzen diese Teile bereits zwischen Außen- und Innengerät.
  const monoblockRun = o.design === 'monoblock' ? outdoorRunParts(outdoor) : { items: [], hoseDimension: '' };

  // --- Vorlauf ---
  let vlX = chainStartX;
  const vlChain: ChainPart[] = [];
  const addVl = (item: CatalogItem | undefined, handles: { inHandle: string; outHandle: string }, opts: { name?: string; isHose?: boolean; insulate?: boolean } = {}) => {
    if (!item) return null;
    const node = place(item, vlX, VL_Y, dim, opts.insulate ?? insulate, opts.name);
    vlChain.push({ node, ...handles, isHose: opts.isHose });
    vlX += COLUMN_STEP;
    return node;
  };

  for (const item of monoblockRun.items) addVl(item, THROUGH, { name: `${item.name} (Vorlauf)`, isHose: true });
  if (o.microbubble) addVl(bySubType('microbubble_separator'), THROUGH);
  const wmzVl = o.heatMeter ? addVl(bySubType('heat_meter_vl_sensor'), { inHandle: 'in-in', outHandle: 'out-out' }) : null;

  const usesExternalTank = o.dhwMode === 'external' && !(o.design === 'semisplit' && o.splitIndoorMode === 'with_tank');
  const valve = usesExternalTank
    ? addVl(bySubType('three_way_valve'), { inHandle: 'ab-in', outHandle: 'a-out' })
    : null;

  const circuitItem = o.heatingCircuit ? bySubType('pump_group') : undefined;
  const diffValveItem = o.diffValve ? bySubType('diff_pressure_valve') : undefined;

  let bypassVl: Node | null = null;
  if (diffValveItem && circuitItem) {
    bypassVl = placeTee(vlX, VL_Y, 'Überströmventil Vorlauf');
    if (bypassVl) {
      vlChain.push({ node: bypassVl, ...TEE });
      vlX += COLUMN_STEP;
    }
  }

  // --- Rücklauf (von der Wärmepumpe aus nach außen aufgebaut) ---
  let rlX = chainStartX;
  const rlChain: ChainPart[] = [];
  const addRl = (item: CatalogItem | undefined, handles: { inHandle: string; outHandle: string }, opts: { name?: string; isHose?: boolean; insulate?: boolean } = {}) => {
    if (!item) return null;
    const node = place(item, rlX, RL_Y, dim, opts.insulate ?? insulate, opts.name);
    rlChain.push({ node, ...handles, isHose: opts.isHose });
    rlX += COLUMN_STEP;
    return node;
  };
  const addRlTee = (name: string) => {
    const node = placeTee(rlX, RL_Y, name);
    if (node) {
      rlChain.push({ node, ...TEE });
      rlX += COLUMN_STEP;
    }
    return node;
  };

  for (const item of monoblockRun.items) addRl(item, THROUGH, { name: `${item.name} (Rücklauf)`, isHose: true });

  const magHeatItem = o.magHeatId > 0 ? byId(o.magHeatId) : undefined;
  if (magHeatItem) {
    const x = rlX;
    const tee = addRlTee('MAG');
    const mag = place(magHeatItem, x, BRANCH_Y, dim, false);
    if (tee) connect(tee, 'c-out', mag, 'in-in', sys, dim, insulate);
  }

  const fillItem = o.fillingStation ? bySubType('filling_station') : undefined;
  if (fillItem) {
    const x = rlX;
    const tee = addRlTee('Befüllung');
    const station = place(fillItem, x, BRANCH_Y);
    if (tee) connect(tee, 'c-out', station, 'right-port', sys, dim);
  }

  const wmzRl = o.heatMeter ? addRl(bySubType('heat_meter'), { inHandle: 'left-in', outHandle: 'right-out' }) : null;
  if (wmzRl && wmzVl) {
    // Der Temperatursensor am Zähler steckt im Einbauset-Teil im Vorlauf.
    connect(wmzRl, 'sens_out-in', wmzVl, 'sens-in', 'electric', BUS_CABLE);
  }

  if (o.sludgeSeparator) addRl(bySubType('sludge_separator'), THROUGH);
  if (o.coarseFilter) addRl(bySubType('coarse_filter'), THROUGH);

  // WW-Speicher: Rücklauf mündet hinter dem Puffer in Richtung Wärmepumpe.
  const tankItem = usesExternalTank && o.dhwTankId > 0 ? byId(o.dhwTankId) : undefined;
  let tank: Node | null = null;
  let tankX = 0;
  if (tankItem) {
    tankX = rlX;
    const tee = addRlTee('WW-Rücklauf');
    tank = place(tankItem, tankX, BRANCH_Y);
    if (valve) connect(valve, 'b-out', tank, 'wt_vl-in', sys, dim, insulate);
    if (tee) connect(tee, 'c-out', tank, 'wt_rl-in', sys, dim, insulate);
  }

  const bufferItem = o.bufferId > 0 ? byId(o.bufferId) : undefined;
  if (bufferItem) addRl(bufferItem, THROUGH);

  let bypassRl: Node | null = null;
  if (diffValveItem && circuitItem) bypassRl = addRlTee('Überströmventil Rücklauf');

  // --- Stränge durchverbinden ---
  const connectChain = (chain: ChainPart[], startHandle: string) => {
    let previous = hydronic;
    let previousHandle = startHandle;
    for (const part of chain) {
      const lineSys: LineSystem = part.isHose ? 'hose' : sys;
      const lineDim = part.isHose ? monoblockRun.hoseDimension : dim;
      connect(previous, previousHandle, part.node, part.inHandle, lineSys, lineDim, !part.isHose && insulate);
      previous = part.node;
      previousHandle = part.outHandle;
    }
    return { node: previous, handle: previousHandle };
  };

  const vlEnd = connectChain(vlChain, 'vl-out');
  const rlEnd = connectChain(rlChain, 'rl-out');

  // --- Heizkreis und Überströmventil ---
  const circuitX = Math.max(vlX, rlX);
  let circuit: Node | null = null;
  if (circuitItem) {
    circuit = place(circuitItem, circuitX, VL_Y, dim, insulate);
    connect(vlEnd.node, vlEnd.handle, circuit, 'vl-in', sys, dim, insulate);
    connect(rlEnd.node, rlEnd.handle, circuit, 'rl-in', sys, dim, insulate);
  }

  if (diffValveItem) {
    const bypass = place(diffValveItem, circuitX - COLUMN_STEP, BYPASS_Y, dim, insulate);
    if (bypassVl && bypassRl) {
      connect(bypassVl, 'c-out', bypass, 'left-port', sys, dim, insulate);
      connect(bypass, 'right-port', bypassRl, 'c-out', sys, dim, insulate);
    } else if (!circuitItem) {
      connect(vlEnd.node, vlEnd.handle, bypass, 'left-port', sys, dim, insulate);
      connect(bypass, 'right-port', rlEnd.node, rlEnd.handle, sys, dim, insulate);
    }
  }

  // --- Anbauten am Warmwasserspeicher ---
  let rodNode: Node | null = null;
  const magDhwItem = o.magDhwId > 0 && o.dhwMode !== 'none' ? byId(o.magDhwId) : undefined;
  if (tank) {
    if (magDhwItem) {
      const mag = place(magDhwItem, tankX + COLUMN_STEP, BRANCH_Y);
      connect(tank, 'kw-out', mag, 'in-in', sys, dim, insulate);
    }
    const rodItem = o.dhwHeatingRod ? bySubType('heating_rod') : undefined;
    if (rodItem) {
      rodNode = place(rodItem, tankX + COLUMN_STEP, BRANCH_Y + 200);
      connect(rodNode, 'el_tank-out', tank, 'el_rod-in', 'electric', '3x2.5');
    }
  } else if (magDhwItem) {
    // Kombi-Innengerät: Das Sanitär-MAG hängt am Kaltwasseranschluss des integrierten Speichers.
    const mag = place(magDhwItem, rlX, BRANCH_Y);
    const hasColdWater = ((hydronic.data.ports as { id: string }[]) || []).some((p) => p.id === 'kw');
    if (hasColdWater) connect(hydronic, 'kw-out', mag, 'in-in', sys, dim, insulate);
  }

  // --- Elektrik: links Zusatzteile, rechts daneben die Teile aus der Unterverteilung ---
  const electricTop = b.getBottom() + 80;
  const col1X = 0;
  const col2X = 520;
  let col1Y = electricTop;
  let col2Y = electricTop;

  const placeCol1 = (item: CatalogItem, name?: string) => {
    const node = place(item, col1X, col1Y, undefined, false, name);
    col1Y += estimateNodeHeight(item) + 30;
    return node;
  };
  const placeCol2 = (item: CatalogItem, name?: string) => {
    const node = place(item, col2X, col2Y, undefined, false, name);
    col2Y += estimateNodeHeight(item) + 30;
    return node;
  };

  // Zusatzteile hängen über Anschlussklemmen an der Regelung.
  const terminalItem = bySubType('control_terminal');
  const pcbItem = o.extensionPcb ? bySubType('pcb_extension') : undefined;
  const networkItem = o.networkModule ? bySubType('network_module') : undefined;
  const outdoorSensorItem = o.outdoorSensor ? bySubType('sensor_outdoor') : undefined;
  const indoorSensorItem = o.indoorSensorCount > 0 ? bySubType('sensor_indoor') : undefined;
  const chassisItem = o.chassisHeater ? bySubType('chassis_heater') : undefined;
  const needsTerminal = Boolean(
    pcbItem || networkItem || outdoorSensorItem || indoorSensorItem || chassisItem || valve || circuit
  );

  let terminal: Node | null = null;
  let nextClamp = 1;
  if (needsTerminal) {
    if (terminalItem) {
      terminal = placeCol1(terminalItem);
      connect(hydronic, 'bus-out', terminal, 'in-in', 'electric', BUS_CABLE);
    } else {
      warnings.push('Keine aktiven Anschlussklemmen im Katalog: Zusatzteile wurden nicht mit der Regelung verbunden.');
    }
  }
  const toTerminal = (node: Node, handle: string, cable: string) => {
    if (terminal) connect(terminal, `out_${nextClamp++}-out`, node, handle, 'electric', cable);
  };

  if (valve) toTerminal(valve, 'm-in', '3x1.5');
  if (circuit) toTerminal(circuit, 'el-in', '3x1.5');
  if (chassisItem) toTerminal(placeCol1(chassisItem), 'el-in', '3x1.5');
  if (pcbItem) toTerminal(placeCol1(pcbItem), 'bus-in', BUS_CABLE);
  if (networkItem) toTerminal(placeCol1(networkItem), 'bus-in', BUS_CABLE);
  if (outdoorSensorItem) toTerminal(placeCol1(outdoorSensorItem), 's-in', BUS_CABLE);
  if (indoorSensorItem) {
    for (let i = 1; i <= o.indoorSensorCount; i++) {
      const sensor = placeCol1(indoorSensorItem, `${indoorSensorItem.name} #${i}`);
      toTerminal(sensor, 's-in', BUS_CABLE);
      if (i === 1 && tank) connect(sensor, 'mount-out', tank, 'sens-in', 'electric', BUS_CABLE);
    }
  }

  // Unterverteilung: Einspeisung > Überspannungsschutz + FI > Phasenschiene > LS-Schalter
  const busbarItem = bySubType('busbar');
  const subDistribution = o.subDistribution ? bySubType('sub_distribution') : undefined;
  const uv = subDistribution ? placeCol2(subDistribution) : null;
  const rcdItem = o.rcdId > 0 ? byId(o.rcdId) : undefined;
  const surgeItem = o.surgeProtector ? bySubType('surge_protector') : undefined;

  let rcdFeed: { node: Node; handle: string } | null = uv ? { node: uv, handle: 'out-out' } : null;
  if (surgeItem) {
    const surge = placeCol2(surgeItem);
    if (busbarItem) {
      const feedBar = placeCol2(busbarItem, `${busbarItem.name} (Einspeisung)`);
      if (uv) connect(uv, 'out-out', feedBar, 'in-in', 'electric', '5x4.0');
      connect(feedBar, 'out_1-out', surge, 'p-out', 'electric', '5x4.0');
      rcdFeed = { node: feedBar, handle: 'out_2-out' };
    }
  }

  const breakerTargets: { id: number; name: string; target: Node; handle: string }[] = [];
  breakerTargets.push({
    id: o.breakerWpId,
    name: 'Verdichter WP',
    target: outdoor,
    handle: o.design === 'monoblock' ? 'el_1-out' : 'el_out-out',
  });
  breakerTargets.push({
    id: o.breakerHeaterId,
    name: 'Heizstab WP',
    target: hydronic,
    handle: o.design === 'monoblock' ? 'el_2-out' : 'el_heat-out',
  });
  if (rodNode) breakerTargets.push({ id: o.breakerRodId, name: 'WW-Speicher Heizstab', target: rodNode, handle: 'el-in' });

  const rcd = rcdItem ? placeCol2(rcdItem) : null;
  if (rcd && rcdFeed) connect(rcdFeed.node, rcdFeed.handle, rcd, 'left-port', 'electric', '5x4.0');

  const breakerBar = rcd && busbarItem ? placeCol2(busbarItem, `${busbarItem.name} (Sicherungen)`) : null;
  if (rcd && breakerBar) connect(rcd, 'right-port', breakerBar, 'in-in', 'electric', '5x4.0');
  if (rcd && !busbarItem) warnings.push('Keine aktive Phasenschiene im Katalog: Sicherungen wurden nicht mit dem FI verbunden.');

  breakerTargets.forEach((entry, index) => {
    const item = entry.id > 0 ? byId(entry.id) : undefined;
    if (!item) return;
    const breaker = placeCol2(item, `${item.name} (${entry.name})`);
    if (breakerBar) connect(breakerBar, `out_${index + 1}-out`, breaker, 'left-port', 'electric', '3x2.5');
    connect(breaker, 'right-port', entry.target, entry.handle, 'electric', '3x2.5');
  });

  return { nodes: b.nodes, edges: b.edges, warnings };
}

function active(catalog: CatalogItem[]) {
  return catalog.filter((c) => c.isActive !== false);
}

/**
 * Brauchwasser-Wärmepumpe:
 * Kaltwasser > Filter mit Druckminderer > T-Stück MAG > Sicherheitsgruppe > BWWP
 * Das Sanitär-MAG sitzt auf der Kaltwasserseite, nicht am Warmwasser-Ausgang.
 */
export function generateBwwpSchema(catalog: CatalogItem[], o: BwwpOptions): GeneratedSchema | null {
  const b = createBuilder(catalog);
  const { place, connect, bySubType, byId, warnings } = b;
  const sys = o.lineSystem;
  const dim = o.dimension;
  const insulate = o.insulation;

  const bwwpItem = byId(o.bwwpId);
  if (!bwwpItem) return null;

  const WATER_Y = 0;
  let x = 0;
  const chain: { node: Node; inHandle: string; outHandle: string }[] = [];

  if (o.waterFilter) {
    const item = bySubType('water_filter');
    if (item) {
      chain.push({ node: place(item, x, WATER_Y, dim, insulate), ...THROUGH });
      x += COLUMN_STEP;
    }
  }

  const magItem = o.magId > 0 ? byId(o.magId) : undefined;
  if (magItem) {
    const teeItem = active(catalog).find((c) => c.componentType === 'tee_piece' && c.lineSystem === sys);
    const mag = place(magItem, x, 340);
    if (teeItem) {
      const tee = place(teeItem, x, WATER_Y, dim, false, `${teeItem.name} (MAG)`);
      chain.push({ node: tee, ...TEE });
      connect(tee, 'c-out', mag, 'in-in', sys, dim, insulate);
      x += COLUMN_STEP;
    } else {
      warnings.push(`Kein aktives T-Stück für ${LINE_SYSTEM_CONFIG[sys].label} im Katalog: Das MAG konnte nicht angebunden werden.`);
    }
  }

  if (o.safetyGroup) {
    const item = bySubType('safety_group');
    if (item) {
      chain.push({ node: place(item, x, WATER_Y, dim, insulate), ...THROUGH });
      x += COLUMN_STEP;
    }
  }

  const bwwpNode = place(bwwpItem, x, WATER_Y, dim, insulate);
  chain.push({ node: bwwpNode, inHandle: 'kw-in', outHandle: 'ww-out' });
  for (let i = 0; i < chain.length - 1; i++) {
    connect(chain[i].node, chain[i].outHandle, chain[i + 1].node, chain[i + 1].inHandle, sys, dim, insulate);
  }

  if (o.condensateDrain) {
    const item = bySubType('condensate_drain');
    if (item) {
      const drain = place(item, Math.max(x - COLUMN_STEP, 0), 340);
      connect(drain, 'in-out', bwwpNode, 'kond-in', sys, dim);
    }
  }

  // Elektrik: einreihige Unterverteilung > FI > LS > BWWP
  const electricTop = b.getBottom() + 80;
  let elY = electricTop;
  const placeElectric = (item: CatalogItem, name?: string) => {
    const node = place(item, 0, elY, undefined, false, name);
    elY += 180;
    return node;
  };

  const uvItem = o.subDistribution ? bySubType('sub_distribution_1r') : undefined;
  const uv = uvItem ? placeElectric(uvItem) : null;

  const rcds = active(catalog).filter((c) => c.componentType === 'rcd_fi');
  const rcdItem = rcds.find((c) => c.articleNumber.includes('TYP-A')) ?? rcds[0];
  const rcd = rcdItem ? placeElectric(rcdItem) : null;
  if (uv && rcd) connect(uv, 'out-out', rcd, 'left-port', 'electric', '3x2.5');

  const breakers = active(catalog).filter((c) => c.componentType === 'breaker_ls');
  const breakerItem = breakers.find((c) => c.articleNumber.includes('1P')) ?? breakers[0];
  if (breakerItem) {
    const breaker = placeElectric(breakerItem, `${breakerItem.name} (BWWP 230V)`);
    if (rcd) connect(rcd, 'right-port', breaker, 'left-port', 'electric', '3x2.5');
    connect(breaker, 'right-port', bwwpNode, 'el-in', 'electric', '3x1.5');
  }

  return { nodes: b.nodes, edges: b.edges, warnings };
}
