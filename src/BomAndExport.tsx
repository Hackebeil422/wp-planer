import { useMemo, useState } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import {
  db,
  LINE_SYSTEM_CONFIG,
  findPipeArticle,
  pipeArticleNumber,
  type CatalogItem,
  type LineSystem,
  type SavedProject,
  type CustomBomItem,
} from './db';
import * as XLSX from 'xlsx';
import { openDataUrl } from './filePreview';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Upload,
  Save,
  FolderOpen,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Layers,
  Plus,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';

export interface BomRow {
  id: string;
  pos: number;
  group: 'Gerät / Bauteil' | 'Adapter / Übergang' | 'Rohr- / Elektroleitung' | 'Dämmung' | 'Manuell';
  name: string;
  articleNumber: string;
  quantity: number;
  unit: 'Stk' | 'm';
  unitPrice: number;
  totalPrice: number;
  supplierLink?: string;
  imageBase64?: string;
  documents?: any[];
  isInactive?: boolean;
}

export interface SchemaImage {
  dataUrl: string;
  width: number;
  height: number;
}

type BomOverrides = Record<string, { quantity?: number; deleted?: boolean }>;
type MediaFilter = 'all' | 'water' | 'electric' | 'refrigerant';

const MEDIA_LABELS: Record<MediaFilter, string> = {
  all: 'Alle Medien',
  water: 'Nur Wasser',
  electric: 'Nur Elektrik',
  refrigerant: 'Nur Kältemittel',
};

/** Fasst alle Positionen zusammen; eine manuelle Menge gilt für die gesamte Zeile. */
function buildAllBomRows(
  nodes: Node[],
  edges: Edge[],
  catalog: CatalogItem[],
  customItems: CustomBomItem[],
  overrides: BomOverrides,
  autoInsulationItems: CustomBomItem[]
): BomRow[] {
  const map = new Map<string, Omit<BomRow, 'pos' | 'totalPrice'>>();

  const addRow = (key: string, row: Omit<BomRow, 'pos' | 'totalPrice' | 'id'>) => {
    const existing = map.get(key);
    if (existing) existing.quantity += row.quantity;
    else map.set(key, { ...row, id: key });
  };

  for (const node of nodes) {
    const d = node.data || {};
    const artNo = (d.activeArticleNumber as string) || 'OHNE-NR';
    const name = d.activeDimension ? `${d.label} (${d.activeDimension})` : (d.label as string);
    addRow(`NODE_${artNo}_${name}`, {
      group: 'Gerät / Bauteil',
      name,
      articleNumber: artNo,
      quantity: 1,
      unit: 'Stk',
      unitPrice: Number(d.price) || 0,
      supplierLink: d.activeSupplierLink as string,
      imageBase64: d.imageBase64 as string,
      documents: (d.documents as any[]) || [],
      isInactive: d.isActive === false,
    });
  }

  for (const edge of edges) {
    for (const ad of (edge.data?.adapters as any[]) || []) {
      const artNo = ad.articleNumber || 'ADAPTER';
      const name = ad.name || 'Übergangsstück';
      const catalogItem = catalog.find(
        (c) => c.articleNumber === artNo || c.variants?.some((v) => v.articleNumber === artNo)
      );
      const variant = catalogItem?.variants?.find((v) => v.articleNumber === artNo);
      addRow(`ADAPT_${artNo}_${name}`, {
        group: 'Adapter / Übergang',
        name,
        articleNumber: artNo,
        quantity: 1,
        unit: 'Stk',
        unitPrice: Number(ad.price) || variant?.price || catalogItem?.price || 0,
        supplierLink: ad.supplierLink || variant?.supplierLink || catalogItem?.supplierLink,
        imageBase64: ad.imageBase64 || catalogItem?.imageBase64,
        documents: catalogItem?.documents || [],
      });
    }
  }

  for (const edge of edges) {
    const lengthM = Number(edge.data?.lengthMeters) || 0;
    if (lengthM <= 0) continue;
    const sys = (edge.data?.lineSystem as LineSystem) || 'copper';
    const dim = (edge.data?.dimension as string) || '';
    const { item, variant } = findPipeArticle(catalog, sys, dim);
    addRow(`PIPE_${sys}_${dim}`, {
      group: 'Rohr- / Elektroleitung',
      name: `${item?.name || LINE_SYSTEM_CONFIG[sys]?.label || sys} (${dim})`,
      articleNumber: variant?.articleNumber || pipeArticleNumber(sys, dim),
      quantity: lengthM,
      unit: 'm',
      unitPrice: variant?.price ?? LINE_SYSTEM_CONFIG[sys]?.meterPrices?.[dim] ?? 0,
      supplierLink: variant?.supplierLink || item?.supplierLink,
      imageBase64: item?.imageBase64,
      documents: item?.documents || [],
    });
  }

  for (const item of autoInsulationItems) {
    addRow(`INS_${item.articleNumber}`, {
      group: 'Dämmung',
      name: item.name,
      articleNumber: item.articleNumber,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      supplierLink: item.supplierLink,
      imageBase64: item.imageBase64,
      documents: item.documents || [],
    });
  }

  for (const item of customItems) {
    addRow(`CUSTOM_${item.id}`, {
      group: 'Manuell',
      name: item.name,
      articleNumber: item.articleNumber,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      supplierLink: item.supplierLink,
      imageBase64: item.imageBase64,
      documents: item.documents || [],
    });
  }

  return Array.from(map.values()).map((row, idx) => {
    const quantity = Math.round((overrides[row.id]?.quantity ?? row.quantity) * 100) / 100;
    return { ...row, quantity, totalPrice: quantity * row.unitPrice, pos: idx + 1 };
  });
}

export function calculateBomRows(
  nodes: Node[],
  edges: Edge[],
  catalog: CatalogItem[],
  customItems: CustomBomItem[],
  overrides: BomOverrides,
  autoInsulationItems: CustomBomItem[] = []
): BomRow[] {
  return buildAllBomRows(nodes, edges, catalog, customItems, overrides, autoInsulationItems)
    .filter((row) => !overrides[row.id]?.deleted)
    .map((row, idx) => ({ ...row, pos: idx + 1 }));
}

/** Mengenfeld: übernimmt erst beim Verlassen, damit Leeren beim Tippen nichts löscht. */
function QuantityInput({ value, unit, onCommit }: { value: number; unit: string; onCommit: (qty: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseFloat(draft.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && parsed !== value) onCommit(parsed);
    setDraft(null);
  };

  return (
    <input
      type="number"
      step={unit === 'm' ? '0.5' : '1'}
      min="0"
      aria-label="Menge"
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="w-16 border border-slate-300 rounded px-2 py-1 text-center font-bold text-xs bg-white"
    />
  );
}

/** Die PDF-Standardschrift kennt z.B. den Pfeil nicht und würde Zeichensalat ausgeben. */
const pdfText = (text: string) => text.replace(/➔/g, '->').replace(/•/g, '-');

interface Props {
  mode: 'bom' | 'export';
  projectName: string;
  onProjectNameChange: (name: string) => void;
  nodes: Node[];
  edges: Edge[];
  catalog: CatalogItem[];
  defaultSystem: LineSystem;
  defaultDimension: string;
  savedProjects: SavedProject[];
  onSaveProjectLocal: () => void;
  onLoadProjectData: (
    name: string,
    nodes: Node[],
    edges: Edge[],
    sys: LineSystem,
    dim: string,
    overrides: Record<string, { quantity?: number; deleted?: boolean }>,
    customItems: CustomBomItem[]
  ) => boolean;
  onDeleteSavedProject: (id: number) => void;
  onCaptureCanvasImage: (mediaFilter: MediaFilter) => Promise<SchemaImage | null>;
  onCatalogUpdated: () => Promise<any>;
  bomOverrides: Record<string, { quantity?: number; deleted?: boolean }>;
  onBomOverridesChange: (overrides: Record<string, { quantity?: number; deleted?: boolean }>) => void;
  customBomItems: CustomBomItem[];
  autoInsulationItems: CustomBomItem[];
  onCustomBomItemsChange: (items: CustomBomItem[]) => void;
  pdfMediaChoice: MediaFilter;
  onPdfMediaChoiceChange: (choice: MediaFilter) => void;
  onProjectExported: () => void;
}

export function BomAndExport({
  mode,
  projectName,
  onProjectNameChange,
  nodes,
  edges,
  catalog,
  defaultSystem,
  defaultDimension,
  savedProjects,
  onSaveProjectLocal,
  onLoadProjectData,
  onDeleteSavedProject,
  onCaptureCanvasImage,
  onCatalogUpdated,
  bomOverrides,
  onBomOverridesChange,
  customBomItems,
  autoInsulationItems,
  onCustomBomItemsChange,
  pdfMediaChoice,
  onPdfMediaChoiceChange,
  onProjectExported,
}: Props) {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Neuer manueller Artikel Form State
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomArtNo, setNewCustomArtNo] = useState('');
  const [newCustomQty, setNewCustomQty] = useState(1);
  const [newCustomUnit, setNewCustomUnit] = useState<'Stk' | 'm'>('Stk');
  const [newCustomPrice, setNewCustomPrice] = useState(0);
  const [newCustomLink, setNewCustomLink] = useState('');
  const [addSource, setAddSource] = useState<'catalog' | 'manual'>('catalog');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogPickKey, setCatalogPickKey] = useState('');

  const bomRows = useMemo(
    () => calculateBomRows(nodes, edges, catalog, customBomItems, bomOverrides, autoInsulationItems),
    [nodes, edges, catalog, customBomItems, bomOverrides, autoInsulationItems]
  );

  const removedRows = useMemo(
    () =>
      buildAllBomRows(nodes, edges, catalog, customBomItems, bomOverrides, autoInsulationItems).filter(
        (row) => bomOverrides[row.id]?.deleted
      ),
    [nodes, edges, catalog, customBomItems, bomOverrides, autoInsulationItems]
  );

  const edgesWithoutLength = useMemo(
    () => edges.filter((e) => !(Number(e.data?.lengthMeters) > 0)).length,
    [edges]
  );

  const catalogOptions = useMemo(() => {
    const options: { key: string; name: string; articleNumber: string; price: number; unit: 'Stk' | 'm'; link?: string; item: CatalogItem }[] = [];
    for (const item of catalog) {
      if (item.isActive === false) continue;
      const unit: 'Stk' | 'm' = item.category === 'pipe' || item.componentType === 'insulation_pipe' ? 'm' : 'Stk';
      if (item.variants && item.variants.length > 0) {
        for (const v of item.variants) {
          options.push({
            key: `${item.id}_${v.articleNumber}`,
            name: `${item.name} (${v.dimension.replace('_to_', ' auf ').replace(/_/g, ' ')})`,
            articleNumber: v.articleNumber,
            price: v.price ?? item.price ?? 0,
            unit,
            link: v.supplierLink || item.supplierLink,
            item,
          });
        }
      } else {
        options.push({
          key: `${item.id}`,
          name: item.name,
          articleNumber: item.articleNumber,
          price: item.price ?? 0,
          unit,
          link: item.supplierLink,
          item,
        });
      }
    }
    const query = catalogQuery.trim().toLowerCase();
    return query
      ? options.filter((o) => o.name.toLowerCase().includes(query) || o.articleNumber.toLowerCase().includes(query))
      : options;
  }, [catalog, catalogQuery]);

  const totalNet = useMemo(() => bomRows.reduce((sum, r) => sum + r.totalPrice, 0), [bomRows]);
  const totalGross = totalNet * 1.19;

  const showToast = (msg: string) => {
    setExportStatus(msg);
    setTimeout(() => setExportStatus(null), 4000);
  };

  const handleQuantityChange = (rowId: string, quantity: number) => {
    onBomOverridesChange({ ...bomOverrides, [rowId]: { quantity, deleted: false } });
  };

  const handleRestoreRow = (rowId: string) => {
    const updated = { ...bomOverrides };
    delete updated[rowId];
    onBomOverridesChange(updated);
  };

  const handleDeleteRow = (rowId: string) => {
    const updated = { ...bomOverrides, [rowId]: { ...(bomOverrides[rowId] || {}), deleted: true } };
    onBomOverridesChange(updated);
  };

  const resetAddForm = () => {
    setNewCustomName('');
    setNewCustomArtNo('');
    setNewCustomQty(1);
    setNewCustomPrice(0);
    setNewCustomLink('');
    setCatalogQuery('');
    setCatalogPickKey('');
    setShowAddModal(false);
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    let newItem: CustomBomItem;
    if (addSource === 'catalog') {
      const pick = catalogOptions.find((o) => o.key === catalogPickKey);
      if (!pick) return;
      newItem = {
        id: `custom_${Date.now()}`,
        name: pick.name,
        articleNumber: pick.articleNumber,
        quantity: newCustomQty,
        unit: pick.unit,
        unitPrice: pick.price,
        supplierLink: pick.link,
        imageBase64: pick.item.imageBase64,
        documents: pick.item.documents,
      };
    } else {
      if (!newCustomName.trim()) return;
      newItem = {
        id: `custom_${Date.now()}`,
        name: newCustomName,
        articleNumber: newCustomArtNo || 'MANUELL',
        quantity: newCustomQty,
        unit: newCustomUnit,
        unitPrice: newCustomPrice,
        supplierLink: newCustomLink,
      };
    }
    onCustomBomItemsChange([...customBomItems, newItem]);
    resetAddForm();
    showToast('Artikel erfolgreich zur Teileliste hinzugefügt!');
  };

  // =========================================================
  // EXPORT 1: PROJEKT ALS .JSON & IMPORT
  // =========================================================
  const handleExportProjectJson = () => {
    const payload = {
      app: 'WP-Klima-Planer-by-JD',
      version: 9,
      exportedAt: new Date().toISOString(),
      projectName: projectName || 'Unbenanntes Projekt',
      defaultSystem,
      defaultDimension,
      nodes,
      edges,
      customCatalog: catalog,
      bomOverrides,
      customBomItems,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'Projekt').replace(/\s+/g, '_')}.wpproj.json`;
    a.click();
    URL.revokeObjectURL(url);
    onProjectExported();
    showToast('Projektdatei (.wpproj.json) erfolgreich heruntergeladen!');
  };

  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.nodes || !parsed.edges) {
          alert('Ungültige Projektdatei.');
          return;
        }
        const loaded = onLoadProjectData(
          parsed.projectName || 'Importiertes Projekt',
          parsed.nodes,
          parsed.edges,
          parsed.defaultSystem || 'copper',
          parsed.defaultDimension || '28mm',
          parsed.bomOverrides || {},
          parsed.customBomItems || []
        );
        if (!loaded) return;

        if (Array.isArray(parsed.customCatalog)) {
          const existing = await db.catalog.toArray();
          const newItems = parsed.customCatalog.filter(
            (imp: CatalogItem) => !existing.some((ex) => ex.articleNumber === imp.articleNumber && ex.name === imp.name)
          );
          if (newItems.length > 0) {
            await db.catalog.bulkAdd(newItems.map(({ id, ...rest }: CatalogItem) => rest));
            await onCatalogUpdated();
          }
        }
      } catch (err) {
        alert('Fehler beim Lesen der Projektdatei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // =========================================================
  // EXPORT 2: EXCEL-EXPORT (.xlsx) MIT LINK-SPALTE
  // =========================================================
  const handleExportExcel = () => {
    const worksheetData = [
      ['Wärmepumpen- und Klimaanlagenplaner – by JD'],
      [`Projekt: ${projectName || 'Unbenannt'}`, `Datum: ${new Date().toLocaleDateString('de-DE')}`],
      [],
      ['Pos.', 'Kategorie', 'Bezeichnung', 'Artikel-Nr.', 'Menge', 'Einheit', 'Einzelpreis (€ netto)', 'Gesamtpreis (€ netto)', 'Händler-Link'],
      ...bomRows.map((r) => [
        r.pos,
        r.group,
        r.name,
        r.articleNumber,
        r.quantity,
        r.unit,
        Number(r.unitPrice.toFixed(2)),
        Number(r.totalPrice.toFixed(2)),
        r.supplierLink || '',
      ]),
      [],
      ['', '', '', '', '', '', 'Gesamtsumme (Netto):', Number(totalNet.toFixed(2))],
      ['', '', '', '', '', '', 'zzgl. 19% MwSt.:', Number((totalGross - totalNet).toFixed(2))],
      ['', '', '', '', '', '', 'Gesamtsumme (Brutto):', Number(totalGross.toFixed(2))],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 44 },
      { wch: 18 },
      { wch: 10 },
      { wch: 8 },
      { wch: 22 },
      { wch: 18 },
      { wch: 50 },
    ];

    // Händler-Links anklickbar machen (Datenzeilen beginnen in Excel-Zeile 5).
    bomRows.forEach((row, index) => {
      if (row.supplierLink) {
        const cell = ws[XLSX.utils.encode_cell({ r: index + 4, c: 8 })];
        if (cell) cell.l = { Target: row.supplierLink };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teileliste');
    XLSX.writeFile(wb, `${(projectName || 'Projekt').replace(/\s+/g, '_')}_Teileliste.xlsx`);
    showToast('Excel-Teileliste (.xlsx) erfolgreich exportiert!');
  };

  // PDF Tabellen-Renderer (Mit breiteren Spalten für €-Beträge ohne Umbruch)
  const NO_SCHEMA_MESSAGE =
    'Das Schema konnte nicht erzeugt werden. Prüfe, ob es Bauteile für das gewählte Medium enthält.';

  /** Fügt das Schema unverzerrt und mittig in die Querformat-Seite ein. */
  const addSchemaToPdf = (doc: jsPDF, image: SchemaImage) => {
    const maxWidth = 277;
    const maxHeight = 170;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    doc.addImage(image.dataUrl, 'PNG', 10 + (maxWidth - width) / 2, 25 + (maxHeight - height) / 2, width, height);
  };

  const renderBomTableToPdf = (doc: jsPDF, startY: number) => {
    doc.setFontSize(14);
    doc.text(`Teileliste & Kalkulation – Projekt: ${projectName || 'Unbenannt'}`, 14, startY);
    doc.setFontSize(9);
    doc.text(
      `Erstellt mit Wärmepumpen- und Klimaanlagenplaner (by JD) am ${new Date().toLocaleDateString('de-DE')}`,
      14,
      startY + 6
    );

    autoTable(doc, {
      startY: startY + 11,
      head: [['Pos.', 'Typ', 'Bezeichnung', 'Art.-Nr.', 'Menge', 'Einzel (€)', 'Gesamt (€)']],
      body: bomRows.map((r) => [
        r.pos,
        r.group,
        pdfText(r.name),
        r.articleNumber,
        `${r.quantity.toLocaleString('de-DE')} ${r.unit}`,
        r.unitPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        r.totalPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]),
      foot: [
        [
          { content: 'Summe Netto:', colSpan: 5, styles: { halign: 'right' } },
          { content: `${totalNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, colSpan: 2, styles: { halign: 'right' } },
        ],
        [
          { content: 'Summe Brutto (inkl. 19 % MwSt.):', colSpan: 5, styles: { halign: 'right' } },
          { content: `${totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, colSpan: 2, styles: { halign: 'right' } },
        ],
      ],
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [2, 132, 199] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 26 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 30 },
        4: { cellWidth: 16 },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
      },
    });
  };

  // =========================================================
  // EXPORT 3: PDF EXPORT – NUR SCHEMA (Mit Medien-Auswahl & sauberen Labels ohne schwarze Balken)
  // =========================================================
  const handleExportPdfSchemaOnly = async () => {
    showToast('Erzeuge hochauflösendes Schema-PDF...');
    const image = await onCaptureCanvasImage(pdfMediaChoice);
    if (!image) {
      alert(NO_SCHEMA_MESSAGE);
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(
      `Schema (${MEDIA_LABELS[pdfMediaChoice]}): ${projectName || 'Unbenannt'}`,
      14,
      14
    );
    doc.setFontSize(9);
    doc.text(
      `Wärmepumpen- und Klimaanlagenplaner (by JD) – Stand: ${new Date().toLocaleDateString('de-DE')}`,
      14,
      20
    );

    addSchemaToPdf(doc, image);
    doc.save(`${(projectName || 'Projekt').replace(/\s+/g, '_')}_Schema_${pdfMediaChoice}.pdf`);
    showToast('PDF (Schema) erfolgreich heruntergeladen!');
  };

  // =========================================================
  // EXPORT 4: PDF EXPORT – NUR TEILELISTE
  // =========================================================
  const handleExportPdfBomOnly = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    renderBomTableToPdf(doc, 16);
    doc.save(`${(projectName || 'Projekt').replace(/\s+/g, '_')}_Teileliste.pdf`);
    showToast('PDF (Teileliste) erfolgreich heruntergeladen!');
  };

  // =========================================================
  // EXPORT 5: PDF EXPORT – SCHEMA + TEILELISTE (KOMBI)
  // =========================================================
  const handleExportPdfCombined = async () => {
    showToast('Erzeuge Kombi-PDF (Schema + Teileliste)...');
    const image = await onCaptureCanvasImage(pdfMediaChoice);
    if (!image) {
      alert(NO_SCHEMA_MESSAGE);
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(`1. Schema (${MEDIA_LABELS[pdfMediaChoice]}): ${projectName || 'Unbenannt'}`, 14, 14);
    doc.setFontSize(9);
    doc.text(
      `Wärmepumpen- und Klimaanlagenplaner (by JD) – Stand: ${new Date().toLocaleDateString('de-DE')}`,
      14,
      20
    );
    addSchemaToPdf(doc, image);

    doc.addPage('a4', 'portrait');
    renderBomTableToPdf(doc, 16);

    doc.save(`${(projectName || 'Projekt').replace(/\s+/g, '_')}_Komplettmappe_${pdfMediaChoice}.pdf`);
    showToast('Kombi-PDF (Schema + Teileliste) erfolgreich heruntergeladen!');
  };

  // =========================================================
  // ANSICHT A: REITER "TEILELISTE" (EDITIERBAR MIT ICONS)
  // =========================================================
  if (mode === 'bom') {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6 relative">
        {exportStatus && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-md flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{exportStatus}</span>
          </div>
        )}

        {/* Modal zum manuellen Hinzufügen von Artikeln */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Artikel zur Teileliste hinzufügen
              </h3>
              <form onSubmit={handleAddCustomItem} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                  {(
                    [
                      { id: 'catalog', label: 'Aus Teilekatalog' },
                      { id: 'manual', label: 'Freier Artikel' },
                    ] as const
                  ).map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setAddSource(source.id)}
                      className={`py-1.5 rounded-md font-bold cursor-pointer ${
                        addSource === source.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>

                {addSource === 'catalog' ? (
                  <>
                    <input
                      type="text"
                      placeholder="Suche nach Name oder Artikel-Nr..."
                      aria-label="Katalog durchsuchen"
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-1">
                      {catalogOptions.length === 0 && (
                        <p className="text-slate-400 italic text-center py-4">Keine passenden Artikel gefunden.</p>
                      )}
                      {catalogOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setCatalogPickKey(option.key)}
                          className={`w-full text-left p-2 rounded-md border flex justify-between items-center gap-2 cursor-pointer ${
                            catalogPickKey === option.key
                              ? 'border-sky-500 bg-sky-50'
                              : 'border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-800 truncate">{option.name}</span>
                            <span className="block font-mono text-[10px] text-slate-500">{option.articleNumber}</span>
                          </span>
                          <span className="font-bold text-emerald-700 shrink-0">
                            {option.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Menge</label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={newCustomQty}
                        onChange={(e) => setNewCustomQty(parseFloat(e.target.value) || 1)}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold"
                      />
                    </div>
                  </>
                ) : (
                  <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bezeichnung *</label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Spezial-Kugelhahn 1 Zoll"
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Artikel-Nr.</label>
                    <input
                      type="text"
                      placeholder="ART-12345"
                      value={newCustomArtNo}
                      onChange={(e) => setNewCustomArtNo(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Einheit</label>
                    <select
                      value={newCustomUnit}
                      onChange={(e) => setNewCustomUnit(e.target.value as 'Stk' | 'm')}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-xs font-semibold"
                    >
                      <option value="Stk">Stk (Stück)</option>
                      <option value="m">m (Meter)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Menge</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={newCustomQty}
                      onChange={(e) => setNewCustomQty(parseFloat(e.target.value) || 1)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Einzelpreis Netto (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newCustomPrice}
                      onChange={(e) => setNewCustomPrice(parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Händler-Link (optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newCustomLink}
                    onChange={(e) => setNewCustomLink(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                  </>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetAddForm}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={addSource === 'catalog' && !catalogPickKey}
                    className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer"
                  >
                    Hinzufügen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Stück- & Teileliste ({bomRows.length} Positionen)
              </h2>
              <p className="text-xs text-slate-500">
                Du kannst Mengen direkt anpassen, Positionen löschen oder manuell Artikel hinzufügen.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Artikel hinzufügen
              </button>

              <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
                <div>
                  <div className="text-[11px] text-emerald-800 font-semibold">Gesamtsumme (Netto)</div>
                  <div className="text-lg font-extrabold text-emerald-900">
                    {totalNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>
                <div className="border-l border-emerald-200 pl-4">
                  <div className="text-[11px] text-slate-600 font-semibold">Inkl. 19% MwSt. (Brutto)</div>
                  <div className="text-sm font-bold text-slate-800">
                    {totalGross.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {edgesWithoutLength > 0 && (
            <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
              {edgesWithoutLength} Leitung(en) haben noch keine Länge. Rohre, Kabel und Rohrdämmung erscheinen hier erst,
              wenn du im Schema-Editor eine Länge einträgst.
            </p>
          )}

          {removedRows.length > 0 && (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
              <div className="font-bold text-slate-700">Entfernte Positionen ({removedRows.length}):</div>
              {removedRows.map((row) => (
                <div key={row.id} className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 truncate">{row.name}</span>
                  <button
                    onClick={() => handleRestoreRow(row.id)}
                    className="text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen
                  </button>
                </div>
              ))}
            </div>
          )}

          {bomRows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm italic">
              Noch keine Bauteile in der Teileliste vorhanden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="py-2.5 px-3 font-bold">Pos.</th>
                    <th className="py-2.5 px-3 font-bold">Kategorie</th>
                    <th className="py-2.5 px-3 font-bold">Bezeichnung & Links</th>
                    <th className="py-2.5 px-3 font-bold">Artikel-Nr.</th>
                    <th className="py-2.5 px-3 font-bold text-center">Menge anpassen</th>
                    <th className="py-2.5 px-3 font-bold text-right">Einzelpreis</th>
                    <th className="py-2.5 px-3 font-bold text-right">Gesamt (Netto)</th>
                    <th className="py-2.5 px-3 font-bold text-center">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bomRows.map((row) => (
                    <tr key={row.id} className={row.isInactive ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                      <td className="py-2.5 px-3 font-semibold text-slate-500">{row.pos}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.group === 'Rohr- / Elektroleitung'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.group === 'Dämmung'
                              ? 'bg-teal-100 text-teal-800'
                              : row.group === 'Adapter / Übergang'
                              ? 'bg-amber-100 text-amber-800'
                              : row.group === 'Manuell'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {row.group}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.name}</span>
                          <div className="flex items-center gap-1">
                            {row.supplierLink && (
                              <a
                                href={row.supplierLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 hover:text-sky-800 p-0.5"
                                title="Beim Händler öffnen"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {row.imageBase64 && (
                              <button
                                onClick={() => openDataUrl(row.imageBase64!)}
                                className="text-slate-600 hover:text-sky-600 p-0.5 cursor-pointer"
                                title="Artikelbild öffnen"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {row.documents &&
                              row.documents.map((doc: any) => (
                                <button
                                  key={doc.id}
                                  onClick={() => openDataUrl(doc.dataBase64)}
                                  className="text-emerald-600 hover:text-emerald-800 p-0.5 cursor-pointer"
                                  title={`Dokument öffnen: ${doc.name}`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              ))}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{row.articleNumber}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <QuantityInput
                            value={row.quantity}
                            unit={row.unit}
                            onCommit={(qty) => handleQuantityChange(row.id, qty)}
                          />
                          <span className="text-slate-500 font-semibold">{row.unit}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {row.unitPrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                        {row.totalPrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Aus Teileliste entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================
  // ANSICHT B: REITER "EXPORT & PROJEKTE" (MIT MEDIEN-AUSWAHL FÜR SCHEMA-PDF)
  // =========================================================
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {exportStatus && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-md flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{exportStatus}</span>
        </div>
      )}

      {/* Projektname & Lokales Speichern / Öffnen */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Projekt speichern & laden</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Aktueller Projektname / Bauvorhaben
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="z.B. BV Müller – Panasonic 7 kW"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-semibold"
            />
          </div>

          <button
            onClick={() => {
              onSaveProjectLocal();
              showToast('Projekt in der lokalen Datenbank gespeichert!');
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Im Browser speichern
          </button>

          <label className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> Projektdatei (.json) von anderem Gerät öffnen
            <input type="file" accept=".json" onChange={handleImportProjectJson} className="hidden" />
          </label>
        </div>

        {savedProjects.length > 0 && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700">Zuletzt auf diesem Gerät gespeicherte Projekte:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {savedProjects.map((proj) => (
                <div key={proj.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{proj.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {proj.updatedAt} • {proj.diagramNodes?.length || 0} Bauteile
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const loaded = onLoadProjectData(
                          proj.name,
                          proj.diagramNodes,
                          proj.diagramEdges,
                          proj.defaultSystem || 'copper',
                          proj.defaultDimension || '28mm',
                          proj.bomOverrides || {},
                          proj.customBomItems || []
                        );
                        if (loaded) showToast(`Projekt "${proj.name}" geladen!`);
                      }}
                      className="bg-sky-100 hover:bg-sky-200 text-sky-900 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> Laden
                    </button>
                    <button onClick={() => proj.id && onDeleteSavedProject(proj.id)} className="text-slate-400 hover:text-red-600 p-1.5 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PDF Medien-Auswahl & die 5 Export-Optionen */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">5 Export-Möglichkeiten (Projekt, Excel & PDF)</h2>
            <p className="text-xs text-slate-500">Wähle unten das Format oder filtere das Schema-PDF nach Medien.</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">Medien-Filter für Schema-PDFs:</span>
            <select
              value={pdfMediaChoice}
              onChange={(e) => onPdfMediaChoiceChange(e.target.value as MediaFilter)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 bg-white font-bold text-xs"
            >
              <option value="all">Alle Medien</option>
              <option value="water">Nur Wasser</option>
              <option value="electric">Nur Elektrik</option>
              <option value="refrigerant">Nur Kältemittel</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={handleExportProjectJson}
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-sky-600 bg-slate-50 hover:bg-sky-50/40 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="bg-slate-800 text-white p-3 rounded-xl"><Download className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-sm text-slate-900">1. Projekt exportieren (.json)</div>
                <p className="text-xs text-slate-600 mt-1">Speichert Zeichnung, Leitungen, manuelle Artikel und individuelle Einstellungen als Datei.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-700">Projektdatei herunterladen ➔</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50/40 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="bg-emerald-600 text-white p-3 rounded-xl"><FileSpreadsheet className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-sm text-slate-900">2. Excel-Export (.xlsx)</div>
                <p className="text-xs text-slate-600 mt-1">Excel-Tabelle aller verbauten Teile, Adapter, Rohrmeter, Preise und direkter Händler-Links.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700">Excel-Liste erzeugen ➔</span>
          </button>

          <button
            onClick={handleExportPdfSchemaOnly}
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-sky-600 bg-slate-50 hover:bg-sky-50/40 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="bg-sky-600 text-white p-3 rounded-xl"><FileText className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-sm text-slate-900">3. PDF-Export: Schema ({MEDIA_LABELS[pdfMediaChoice]})</div>
                <p className="text-xs text-slate-600 mt-1">DIN-A4-Querformat-PDF der Zeichnung gefiltert nach dem gewählten Medium.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-700">Schema-PDF erstellen ➔</span>
          </button>

          <button
            onClick={handleExportPdfBomOnly}
            className="p-5 rounded-2xl border-2 border-slate-200 hover:border-sky-600 bg-slate-50 hover:bg-sky-50/40 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="bg-sky-600 text-white p-3 rounded-xl"><FileText className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-sm text-slate-900">4. PDF-Export: Teileliste</div>
                <p className="text-xs text-slate-600 mt-1">Übersichtliche PDF-Stückliste im Hochformat mit allen Positionen, Preisen und Summen.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-700">Teilelisten-PDF erstellen ➔</span>
          </button>

          <button
            onClick={handleExportPdfCombined}
            className="p-5 rounded-2xl border-2 border-amber-300 hover:border-amber-600 bg-amber-50/50 hover:bg-amber-50 text-left transition-all flex flex-col justify-between gap-4 md:col-span-2 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="bg-amber-600 text-white p-3 rounded-xl"><Layers className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-sm text-slate-900">5. PDF-Export: Schema + Teileliste (Komplettmappe)</div>
                <p className="text-xs text-slate-600 mt-1">Kombiniertes PDF: Seite 1 enthält das Schema im Querformat ({MEDIA_LABELS[pdfMediaChoice]}), ab Seite 2 folgt die Teile- und Preisliste.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-800">Kombi-PDF (Schema + Teileliste) erstellen ➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}