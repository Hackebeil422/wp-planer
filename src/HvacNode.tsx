import { Handle, Position } from '@xyflow/react';
import {
  ExternalLink,
  Trash2,
  Copy,
  FileText,
  ArrowLeftRight,
  AlertTriangle,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import type { CatalogDocument, PortDefinition } from './db';
import { openDataUrl } from './filePreview';

/**
 * Eingang links. React Flow zeichnet eine Leitung nur, wenn ihr Start ein Ausgang ist.
 * Der unsichtbare Ausgang mit gleicher ID sorgt dafür, dass auch Leitungen zwischen zwei
 * Eingängen sichtbar bleiben.
 */
function InputHandle({ id, color }: { id: string; color: string }) {
  const style = { background: color, width: 11, height: 11, left: -7 };
  return (
    <>
      <Handle
        type="source"
        position={Position.Left}
        id={id}
        isConnectableStart={false}
        style={{ ...style, opacity: 0, pointerEvents: 'none' }}
      />
      <Handle type="target" position={Position.Left} id={id} style={style} />
    </>
  );
}

const ACTION_BUTTON = 'p-1 rounded transition-colors cursor-pointer inline-flex';

export function HvacNode({
  data,
  selected,
  id,
}: {
  data: any;
  selected?: boolean;
  id: string;
}) {
  const documents: CatalogDocument[] = data.documents || [];
  const ports: PortDefinition[] = data.ports || [];
  const isMultiPort = data.isMultiPort ?? ports.length > 0;
  const isInactive = data.isActive === false;
  const activeMediaFilter: 'all' | 'water' | 'electric' | 'refrigerant' =
    data.activeMediaFilter || 'all';

  const getMediumColor = (medium: string) => {
    if (medium === 'water') return '#0284c7'; // Blau
    if (medium === 'electric') return '#eab308'; // Gelb
    return '#10b981'; // Grün (Kälte)
  };

  const fireNodeEvent = (eventName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent(eventName, { detail: { id } }));
  };

  // Prüft, ob das gesamte Bauteil im aktuellen Medien-Filter ausgegraut werden soll
  const nodeMatchesMediaFilter = () => {
    if (activeMediaFilter === 'all') return true;
    if (isMultiPort) {
      if (ports.length === 0) return true;
      return ports.some((p) => p.medium === activeMediaFilter);
    }
    return (
      (data.leftMedium || 'water') === activeMediaFilter ||
      (data.rightMedium || 'water') === activeMediaFilter
    );
  };

  const isDimmedByFilter = !nodeMatchesMediaFilter();

  return (
    <div
      className={`bg-white border-2 rounded-lg shadow-md min-w-[255px] transition-all ${
        isInactive
          ? 'border-amber-500 ring-2 ring-amber-200'
          : selected
          ? 'border-sky-600 ring-2 ring-sky-200'
          : 'border-slate-300'
      } ${isDimmedByFilter ? 'opacity-25 pointer-events-none' : 'opacity-100'}`}
    >
      {/* Inaktiv-Banner, falls Teil im Katalog deaktiviert wurde */}
      {isInactive && (
        <div className="bg-amber-500 text-white px-2.5 py-1 text-[10px] font-bold flex items-center justify-between gap-1 rounded-t-sm">
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Bauteil im Katalog INAKTIV
          </span>
          <button
            onClick={(e) => fireNodeEvent('hvac-swap-node', e)}
            className="bg-white text-amber-900 px-1.5 py-0.5 rounded text-[9px] font-extrabold hover:bg-amber-50"
          >
            Jetzt tauschen
          </button>
        </div>
      )}

      {/* Kopfzeile */}
      <div
        className={`bg-slate-800 text-white px-3 py-1.5 ${
          isInactive ? '' : 'rounded-t-md'
        } text-xs font-bold flex justify-between items-center gap-2`}
      >
        <span className="truncate max-w-[170px]" title={data.label}>
          {data.label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded font-normal">
            {data.activeArticleNumber || 'Variabel'}
          </span>
        </div>
      </div>

      {data.price !== undefined && data.price > 0 && (
        <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 text-[11px]">
          <span className="font-semibold text-emerald-700">
            {Number(data.price).toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
            })}
          </span>
        </div>
      )}

      {/* Artikelbild */}
      {data.imageBase64 && (
        <div className="bg-white border-b border-slate-100 p-2 flex justify-center">
          <img
            src={data.imageBase64}
            alt={data.label}
            className="h-14 object-contain rounded"
          />
        </div>
      )}

      {/* Anschlüsse (OHNE doppelte Punkte im Kasten!) */}
      <div className="p-2.5 space-y-2">
        {data.activeDimension && (
          <div className="text-[11px] bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-200 font-medium text-center">
            Größe: {data.activeDimension}
          </div>
        )}

        {isMultiPort ? (
          ports.length > 0 ? (
            <div className="space-y-1.5">
              {ports.map((port) => {
                const side = port.side || 'both';
                const showLeft = side === 'left' || side === 'both';
                const showRight = side === 'right' || side === 'both';
                const portHiddenByFilter =
                  activeMediaFilter !== 'all' &&
                  port.medium !== activeMediaFilter;

                return (
                  <div
                    key={port.id}
                    className={`relative flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200 transition-opacity ${
                      portHiddenByFilter ? 'opacity-25' : 'opacity-100'
                    }`}
                  >
                    {showLeft && (
                      <InputHandle id={`${port.id}-in`} color={getMediumColor(port.medium)} />
                    )}

                    <div
                      className={`flex flex-col w-full px-1 ${
                        side === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <span className="font-medium text-slate-700">
                        {port.label}
                      </span>
                      {port.fixedDimension && (
                        <span className="text-[10px] text-slate-400">
                          Anschluss: {port.fixedDimension}
                        </span>
                      )}
                    </div>

                    {showRight && (
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`${port.id}-out`}
                        style={{
                          background: getMediumColor(port.medium),
                          width: 11,
                          height: 11,
                          right: -7,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic text-center py-1">
              Montage- / Zubehörteil (ohne Leitungsanschluss)
            </div>
          )
        ) : (
          /* Durchgangs-Bauteil: Exakt 1 Punkt links & 1 Punkt rechts */
          <div className="relative flex items-center justify-between text-xs bg-slate-50 px-2.5 py-2 rounded border border-slate-200 gap-3">
            <InputHandle id="left-port" color={getMediumColor(data.leftMedium || 'water')} />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800">
                {data.leftLabel || 'Eingang'}
              </span>
              <span className="text-[10px] text-slate-500">
                Links: {data.leftDim || data.activeDimension || 'Dynamisch'}
              </span>
            </div>

            <div className="text-slate-300 font-bold">➔</div>

            <div className="flex flex-col text-right">
              <span className="font-semibold text-slate-800">
                {data.rightLabel || 'Ausgang'}
              </span>
              <span className="text-[10px] text-slate-500">
                Rechts: {data.rightDim || data.activeDimension || 'Dynamisch'}
              </span>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id="right-port"
              style={{
                background: getMediumColor(data.rightMedium || 'water'),
                width: 11,
                height: 11,
                right: -7,
              }}
            />
          </div>
        )}

        {data.includeInsulation && (
          <div className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-medium flex items-center gap-1">
            <Layers className="w-3 h-3 shrink-0" />
            <span className="truncate" title={data.matchingInsulationName}>
              {data.matchingInsulationName}
            </span>
          </div>
        )}

        {/* Links: Händler, Bild, Dokumente. Rechts: Dämmung, Tauschen, Kopieren, Löschen */}
        {!data.isExporting && (
          <div className="nodrag nopan pt-1.5 border-t border-slate-100 flex justify-between items-center gap-1">
            <div className="flex items-center gap-1">
              {data.activeSupplierLink && (
                <a
                  href={data.activeSupplierLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`${ACTION_BUTTON} bg-slate-100 hover:bg-sky-100 text-sky-700`}
                  title="Beim Händler öffnen"
                  aria-label="Beim Händler öffnen"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {data.imageBase64 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDataUrl(data.imageBase64);
                  }}
                  className={`${ACTION_BUTTON} bg-slate-100 hover:bg-sky-100 text-slate-700`}
                  title="Bild öffnen"
                  aria-label="Bild öffnen"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
              )}
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    openDataUrl(doc.dataBase64);
                  }}
                  className={`${ACTION_BUTTON} bg-slate-100 hover:bg-sky-100 text-emerald-700`}
                  title={`Dokument öffnen: ${doc.name}`}
                  aria-label={`Dokument öffnen: ${doc.name}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {data.matchingInsulationArticle && (
                <button
                  onClick={(e) => fireNodeEvent('hvac-toggle-insulation', e)}
                  className={`${ACTION_BUTTON} ${
                    data.includeInsulation
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                  title={
                    data.includeInsulation
                      ? `Dämmung entfernen: ${data.matchingInsulationName}`
                      : `Dämmung hinzufügen: ${data.matchingInsulationName}`
                  }
                  aria-label={data.includeInsulation ? 'Dämmung entfernen' : 'Dämmung hinzufügen'}
                  aria-pressed={Boolean(data.includeInsulation)}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => fireNodeEvent('hvac-swap-node', e)}
                className={`${ACTION_BUTTON} bg-sky-50 hover:bg-sky-100 text-sky-700`}
                title="Gegen anderes passendes Bauteil tauschen"
                aria-label="Bauteil tauschen"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => fireNodeEvent('hvac-duplicate-node', e)}
                className={`${ACTION_BUTTON} bg-slate-100 hover:bg-slate-200 text-slate-700`}
                title="Bauteil kopieren"
                aria-label="Bauteil kopieren"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => fireNodeEvent('hvac-delete-node', e)}
                className={`${ACTION_BUTTON} bg-red-50 hover:bg-red-100 text-red-700`}
                title="Bauteil löschen"
                aria-label="Bauteil löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}