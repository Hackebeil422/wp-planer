import { useMemo, useState } from 'react';
import {
  db,
  resetCatalogToDefaults,
  LINE_SYSTEM_CONFIG,
  COMPONENT_SUBTYPE_LABELS,
  type CatalogItem,
  type PortDefinition,
  type DimensionVariant,
  type CatalogDocument,
  type LineSystem,
  type CatalogCategory,
  type ComponentSubType,
} from './db';
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Image as ImageIcon,
  Save,
  X,
  RotateCcw,
  FileText,
  Search,
  CheckCircle2,
  Ban,
} from 'lucide-react';

interface Props {
  catalog: CatalogItem[];
  onCatalogUpdated: (resetCanvas?: boolean) => void;
}

const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  heatpump: 'Wärmepumpen',
  dhw_heatpump: 'Brauchwasser-WP',
  ac: 'Klimaanlagen',
  buffer: 'Speicher',
  pipe: 'Rohre / Leitungen',
  fitting: 'Fittings / Ventile / Filter',
  adapter: 'Adapter',
  electric: 'Elektro',
  mounting: 'Montagematerial',
  insulation: 'Dämmung',
};

const EMPTY_ITEM: CatalogItem = {
  name: '',
  category: 'heatpump',
  componentType: 'other',
  manufacturer: '',
  series: '',
  isActive: true,
  lineSystem: undefined,
  articleNumber: '',
  supplierLink: '',
  price: 0,
  imageBase64: '',
  documents: [],
  isMultiPort: true,
  isDynamicSize: false,
  ports: [
    { id: 'vl', label: 'Vorlauf', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
    { id: 'rl', label: 'Rücklauf', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
    { id: 'el', label: 'Strom', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
  ],
  leftLabel: 'Eingang',
  leftMedium: 'water',
  leftDim: '',
  rightLabel: 'Ausgang',
  rightMedium: 'water',
  rightDim: '',
  variants: [],
};

export function CatalogManager({ catalog, onCatalogUpdated }: Props) {
  const [editingItem, setEditingItem] = useState<CatalogItem>(EMPTY_ITEM);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formBaseline, setFormBaseline] = useState(JSON.stringify(EMPTY_ITEM));

  const linkableArticles = useMemo(() => {
    const groups = new Map<string, { articleNumber: string; label: string }[]>();
    for (const item of catalog) {
      if (item.category === 'insulation' || item.category === 'adapter') continue;
      const group = groups.get(CATEGORY_LABELS[item.category]) ?? [];
      if (item.isDynamicSize && item.variants && item.variants.length > 0) {
        for (const v of item.variants) {
          group.push({ articleNumber: v.articleNumber, label: `${item.name} ${v.dimension} [${v.articleNumber}]` });
        }
      } else {
        group.push({ articleNumber: item.articleNumber, label: `${item.name} [${item.articleNumber}]` });
      }
      groups.set(CATEGORY_LABELS[item.category], group);
    }
    return Array.from(groups.entries());
  }, [catalog]);

  const linkedArticleKnown = linkableArticles.some(([, items]) =>
    items.some((i) => i.articleNumber === editingItem.linkedArticleNumber)
  );

  /** Fragt nach, bevor ungespeicherte Eingaben im Formular verworfen werden. */
  const confirmLeaveForm = () =>
    JSON.stringify(editingItem) === formBaseline ||
    confirm('Deine ungespeicherten Eingaben in diesem Bauteil gehen verloren. Fortfahren?');

  const openForm = (item: CatalogItem) => {
    setEditingItem(item);
    setFormBaseline(JSON.stringify(item));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingItem((prev) => ({ ...prev, imageBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const newDoc: CatalogDocument = {
        id: `doc_${Date.now()}`,
        name: file.name,
        dataBase64: reader.result as string,
      };
      setEditingItem((prev) => ({
        ...prev,
        documents: [...(prev.documents || []), newDoc],
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = (docId: string) => {
    setEditingItem((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((d) => d.id !== docId),
    }));
  };

  const addPort = () => {
    const newPort: PortDefinition = {
      id: `port_${Date.now()}`,
      label: 'Neuer Anschluss',
      medium: 'water',
      fixedDimension: '1_Zoll_IG',
      side: 'right',
    };
    setEditingItem((prev) => ({ ...prev, ports: [...prev.ports, newPort] }));
  };

  const updatePort = (index: number, field: keyof PortDefinition, value: any) => {
    const updated = [...editingItem.ports];
    updated[index] = { ...updated[index], [field]: value };
    setEditingItem((prev) => ({ ...prev, ports: updated }));
  };

  const removePort = (index: number) => {
    setEditingItem((prev) => ({
      ...prev,
      ports: prev.ports.filter((_, idx) => idx !== index),
    }));
  };

  const addVariant = () => {
    const defaultDim = editingItem.lineSystem
      ? LINE_SYSTEM_CONFIG[editingItem.lineSystem].dimensions[0]
      : '28mm';
    const newVar: DimensionVariant = {
      dimension: defaultDim,
      articleNumber: '',
      supplierLink: '',
      price: 0,
    };
    setEditingItem((prev) => ({
      ...prev,
      variants: [...(prev.variants || []), newVar],
    }));
  };

  const updateVariant = (index: number, field: keyof DimensionVariant, value: any) => {
    const updated = [...(editingItem.variants || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditingItem((prev) => ({ ...prev, variants: updated }));
  };

  const removeVariant = (index: number) => {
    setEditingItem((prev) => ({
      ...prev,
      variants: (prev.variants || []).filter((_, idx) => idx !== index),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem.name.trim()) return;

    if (editingItem.id) {
      await db.catalog.put(editingItem);
    } else {
      await db.catalog.add(editingItem);
    }

    openForm(EMPTY_ITEM);
    setIsEditing(false);
    onCatalogUpdated(false);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (confirm('Dieses Bauteil wirklich aus dem Katalog löschen?')) {
      await db.catalog.delete(id);
      onCatalogUpdated(false);
    }
  };

  const toggleActiveStatus = async (item: CatalogItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.id) return;
    const updatedStatus = !(item.isActive ?? true);
    await db.catalog.update(item.id, { isActive: updatedStatus });
    onCatalogUpdated(false);
  };

  const handleResetDefaults = async () => {
    if (
      confirm(
        'Katalog auf den Standard zurücksetzen? Alle eigenen Bauteile, Preise, Links, Bilder und Dokumente im Katalog werden dabei unwiderruflich gelöscht.'
      )
    ) {
      await resetCatalogToDefaults();
      onCatalogUpdated(true);
    }
  };

  const startEdit = (item: CatalogItem) => {
    if (!confirmLeaveForm()) return;
    openForm({
      ...item,
      isActive: item.isActive ?? true,
      isMultiPort: item.isMultiPort ?? (item.ports && item.ports.length > 0),
      ports: item.ports || [],
      variants: item.variants || [],
      documents: item.documents || [],
      leftLabel: item.leftLabel || 'Eingang',
      leftMedium: item.leftMedium || 'water',
      leftDim: item.leftDim || '',
      rightLabel: item.rightLabel || 'Ausgang',
      rightMedium: item.rightMedium || 'water',
      rightDim: item.rightDim || '',
    });
    setIsEditing(true);
  };

  const filteredCatalog = catalog.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      categoryFilter === 'all' || item.category === categoryFilter;

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? item.isActive !== false
        : item.isActive === false;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const needsLineSystem = ['pipe', 'fitting', 'adapter'].includes(editingItem.category);
  const isInsulationCategory = editingItem.category === 'insulation';

  return (
    <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Linke Spalte: Suchfunktion, Filter & Bauteile-Liste */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col h-[82vh]">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            Teilekatalog ({filteredCatalog.length} / {catalog.length})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleResetDefaults}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Standard laden
            </button>
            <button
              onClick={() => {
                if (!confirmLeaveForm()) return;
                openForm(EMPTY_ITEM);
                setIsEditing(true);
              }}
              className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Neues Bauteil
            </button>
          </div>
        </div>

        {/* Such- und Filterleiste */}
        <div className="space-y-2.5 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Suche nach Name, Hersteller oder Artikel-Nr..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'Alle' },
                { id: 'heatpump', label: 'WP' },
                { id: 'dhw_heatpump', label: 'BWWP' },
                { id: 'buffer', label: 'Speicher' },
                { id: 'pipe', label: 'Rohre' },
                { id: 'fitting', label: 'Fittings' },
                { id: 'adapter', label: 'Adapter' },
                { id: 'mounting', label: 'Montage' },
                { id: 'insulation', label: 'Dämmung' },
                { id: 'electric', label: 'Elektro' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                Aktiv
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                  statusFilter === 'inactive' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                Inaktiv
              </button>
            </div>
          </div>
        </div>

        {/* Scrollbare Liste */}
        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
          {filteredCatalog.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-10">
              Keine passenden Bauteile im Katalog gefunden.
            </p>
          ) : (
            filteredCatalog.map((item) => {
              const isInactive = item.isActive === false;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isInactive
                      ? 'bg-amber-50/40 border-amber-200 opacity-75'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {item.imageBase64 ? (
                      <img
                        src={item.imageBase64}
                        alt={item.name}
                        className="w-11 h-11 object-contain bg-white rounded-lg border border-slate-200 p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate flex items-center gap-2">
                        <span className="truncate">{item.name}</span>
                        {isInactive && (
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {item.articleNumber || 'Variabel'}
                        </span>
                        {item.manufacturer && (
                          <span className="bg-sky-50 text-sky-800 px-1.5 py-0.5 rounded font-medium">
                            {item.manufacturer}
                          </span>
                        )}
                        {item.price !== undefined && item.price > 0 && (
                          <span className="font-semibold text-emerald-700">
                            {Number(item.price).toLocaleString('de-DE', {
                              style: 'currency',
                              currency: 'EUR',
                            })}
                          </span>
                        )}
                        {item.documents && item.documents.length > 0 && (
                          <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {item.documents.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => toggleActiveStatus(item, e)}
                      className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                        isInactive
                          ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      title={isInactive ? 'Auf Aktiv schalten' : 'Auf Inaktiv schalten'}
                    >
                      {isInactive ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    {item.supplierLink && (
                      <a
                        href={item.supplierLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-slate-500 hover:text-sky-600 hover:bg-white rounded-lg"
                        title="Händler-Link öffnen"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 text-slate-600 hover:text-sky-600 hover:bg-white rounded-lg cursor-pointer"
                      title="Bearbeiten"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg cursor-pointer"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Rechte Spalte: Formular zum Bearbeiten / Erstellen */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-[82vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            {editingItem.id ? 'Bauteil bearbeiten' : 'Neues Bauteil anlegen'}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                if (!confirmLeaveForm()) return;
                openForm(EMPTY_ITEM);
                setIsEditing(false);
              }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bezeichnung *
            </label>
            <input
              type="text"
              required
              placeholder="z.B. EPP-Dämmschale für Schlammabscheider"
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategorie
              </label>
              <select
                value={editingItem.category}
                onChange={(e) => {
                  const cat = e.target.value as CatalogCategory;
                  const isThroughPart = ['fitting', 'adapter', 'pipe'].includes(cat);
                  setEditingItem({
                    ...editingItem,
                    category: cat,
                    isMultiPort: !isThroughPart,
                    lineSystem: isThroughPart ? editingItem.lineSystem || 'copper' : undefined,
                  });
                }}
                className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white text-xs font-semibold"
              >
                <option value="heatpump">Wärmepumpe</option>
                <option value="dhw_heatpump">Brauchwasser-WP</option>
                <option value="ac">Klimaanlage</option>
                <option value="buffer">Speicher (Puffer/WW)</option>
                <option value="fitting">Fitting / Ventil / Filter</option>
                <option value="adapter">Übergangsstück / Adapter</option>
                <option value="pipe">Rohr / Leitung</option>
                <option value="mounting">Montagematerial</option>
                <option value="insulation">Dämmung / Isolierung</option>
                <option value="electric">Elektro / Verteilung</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bauteil-Typ
              </label>
              <select
                value={editingItem.componentType || 'other'}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    componentType: e.target.value as ComponentSubType,
                  })
                }
                className="w-full border border-slate-300 rounded-lg px-2 py-2 bg-white text-xs font-semibold"
              >
                {Object.entries(COMPONENT_SUBTYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SPEZIFISCHE FELDER FÜR DÄMMUNG (INSULATION) */}
          {isInsulationCategory && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-emerald-950 block">
                Dämmungs-Verknüpfung:
              </span>
              <div>
                <label htmlFor="linked-article" className="block text-[11px] font-semibold text-emerald-900 mb-1">
                  Gehört zu Artikel:
                </label>
                <select
                  id="linked-article"
                  value={editingItem.linkedArticleNumber || ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, linkedArticleNumber: e.target.value || undefined })
                  }
                  className="w-full border border-emerald-300 rounded-lg px-2 py-1.5 bg-white text-xs font-semibold"
                >
                  <option value="">Keinem Artikel zugeordnet</option>
                  {editingItem.linkedArticleNumber && !linkedArticleKnown && (
                    <option value={editingItem.linkedArticleNumber}>
                      {editingItem.linkedArticleNumber} (nicht mehr im Katalog)
                    </option>
                  )}
                  {linkableArticles.map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map((article) => (
                        <option key={article.articleNumber} value={article.articleNumber}>
                          {article.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hersteller</label>
              <input
                type="text"
                placeholder="Panasonic"
                value={editingItem.manufacturer || ''}
                onChange={(e) => setEditingItem({ ...editingItem, manufacturer: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Baureihe</label>
              <input
                type="text"
                placeholder="Gen J"
                value={editingItem.series || ''}
                onChange={(e) => setEditingItem({ ...editingItem, series: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={editingItem.isActive !== false ? 'active' : 'inactive'}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, isActive: e.target.value === 'active' })
                }
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-xs font-semibold"
              >
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Netto-Preis (€)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editingItem.price || ''}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold text-emerald-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Artikel-Nr.
              </label>
              <input
                type="text"
                placeholder="WH-MDC05J3E5"
                value={editingItem.articleNumber}
                onChange={(e) => setEditingItem({ ...editingItem, articleNumber: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>

          {needsLineSystem && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <label className="block text-xs font-bold text-emerald-950 mb-1">
                Zugehöriges Leitungssystem:
              </label>
              <select
                value={editingItem.lineSystem || 'copper'}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    lineSystem: e.target.value as LineSystem,
                  })
                }
                className="w-full border border-emerald-300 rounded-lg px-3 py-1.5 bg-white font-semibold text-xs"
              >
                {Object.entries(LINE_SYSTEM_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Artikelbild</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Datenblatt (PDF)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleDocumentUpload}
                className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 cursor-pointer"
              />
            </div>
          </div>

          {editingItem.documents && editingItem.documents.length > 0 && (
            <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">Hinterlegte Dokumente:</span>
              {editingItem.documents.map((doc) => (
                <div key={doc.id} className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-200">
                  <span className="truncate max-w-[200px]">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => removeDocument(doc.id)}
                    className="text-red-500 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.isDynamicSize}
                  onChange={(e) => setEditingItem({ ...editingItem, isDynamicSize: e.target.checked })}
                />
                Mehrere Größen (Varianten)
              </label>
              {editingItem.isDynamicSize && (
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-900 px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Größe hinzufügen
                </button>
              )}
            </div>

            {editingItem.isDynamicSize && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(editingItem.variants || []).map((variant, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-1 items-center bg-white p-2 rounded border border-slate-200 text-xs"
                  >
                    <input
                      type="text"
                      aria-label="Größe"
                      placeholder="Größe"
                      value={variant.dimension}
                      onChange={(e) => updateVariant(idx, 'dimension', e.target.value)}
                      className="col-span-3 border border-slate-300 rounded px-1.5 py-1"
                    />
                    <input
                      type="text"
                      aria-label="Artikel-Nr."
                      placeholder="Artikel-Nr."
                      value={variant.articleNumber}
                      onChange={(e) => updateVariant(idx, 'articleNumber', e.target.value)}
                      className="col-span-3 border border-slate-300 rounded px-1.5 py-1 font-mono"
                    />
                    <input
                      type="number"
                      step="0.01"
                      aria-label="Preis"
                      placeholder="Preis"
                      value={variant.price ?? ''}
                      onChange={(e) => updateVariant(idx, 'price', parseFloat(e.target.value) || 0)}
                      className="col-span-2 border border-slate-300 rounded px-1.5 py-1"
                    />
                    <input
                      type="url"
                      aria-label="Händler-Link"
                      placeholder="Link"
                      value={variant.supplierLink || ''}
                      onChange={(e) => updateVariant(idx, 'supplierLink', e.target.value)}
                      className="col-span-3 border border-slate-300 rounded px-1.5 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      title="Größe entfernen"
                      className="col-span-1 text-red-500 hover:text-red-700 flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">Anschlüsse & Ports:</span>
              <button
                type="button"
                onClick={addPort}
                className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-900 px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Anschluss hinzufügen
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {editingItem.ports.map((port, idx) => (
                <div
                  key={port.id}
                  className="grid grid-cols-12 gap-1 items-center bg-white p-2 rounded border border-slate-200 text-xs"
                >
                  <input
                    type="text"
                    placeholder="Name"
                    value={port.label}
                    onChange={(e) => updatePort(idx, 'label', e.target.value)}
                    className="col-span-3 border border-slate-300 rounded px-1.5 py-1"
                  />
                  <select
                    value={port.medium}
                    onChange={(e) => updatePort(idx, 'medium', e.target.value)}
                    className="col-span-3 border border-slate-300 rounded px-1 py-1 bg-white font-medium"
                  >
                    <option value="water">Wasser</option>
                    <option value="refrigerant">Kälte</option>
                    <option value="electric">Strom</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Maß (1_Zoll_IG)"
                    value={port.fixedDimension || ''}
                    onChange={(e) => updatePort(idx, 'fixedDimension', e.target.value)}
                    className="col-span-3 border border-slate-300 rounded px-1.5 py-1"
                  />
                  <select
                    value={port.side || 'right'}
                    onChange={(e) => updatePort(idx, 'side', e.target.value)}
                    className="col-span-2 border border-slate-300 rounded px-1 py-1 bg-white"
                  >
                    <option value="left">Links</option>
                    <option value="right">Rechts</option>
                    <option value="both">Beide</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removePort(idx)}
                    className="col-span-1 text-red-500 hover:text-red-700 flex justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {editingItem.id ? 'Änderungen speichern' : 'Im Katalog speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}