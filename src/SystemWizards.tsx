import { useState, useMemo, useEffect } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import {
  LINE_SYSTEM_CONFIG,
  type CatalogItem,
  type LineSystem,
  type ComponentSubType,
} from './db';
import { generateBwwpSchema, generateHeatPumpSchema } from './schemaGenerator';
import { Flame, Droplets, Wind, Wand2, Zap, Gauge, AlertCircle } from 'lucide-react';

/** Auswahl noch nicht vorbelegt; 0 bedeutet bewusst "Ohne". */
const NOT_PRESET = -1;

interface Props {
  catalog: CatalogItem[];
  onApplyWizard: (nodes: Node[], edges: Edge[], defaultSys: LineSystem, defaultDim: string, warnings: string[]) => void;
}

export function SystemWizards({ catalog, onApplyWizard }: Props) {
  const [activeWizard, setActiveWizard] = useState<'hp' | 'dhw' | 'ac'>('hp');

  // Deduplizierter aktiver Katalog (verhindert doppelte BWWP-Modelle)
  const activeCatalog = useMemo(() => {
    const seen = new Set<string>();
    return catalog.filter((i) => {
      if (i.isActive === false) return false;
      const key = (i.articleNumber || i.name).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [catalog]);

  const bySubType = (st: ComponentSubType) => activeCatalog.filter((i) => i.componentType === st);

  const monoUnits = useMemo(() => bySubType('hp_outdoor_mono'), [activeCatalog]);
  const splitOutUnits = useMemo(() => bySubType('hp_outdoor_split'), [activeCatalog]);
  const splitInTankUnits = useMemo(() => bySubType('hp_indoor_tank'), [activeCatalog]);
  const splitInWallUnits = useMemo(() => bySubType('hp_indoor_wall'), [activeCatalog]);
  const bufferTanks = useMemo(() => bySubType('buffer_heating'), [activeCatalog]);
  const dhwTanks = useMemo(() => bySubType('tank_dhw'), [activeCatalog]);
  const magHeatItems = useMemo(() => bySubType('mag_heating'), [activeCatalog]);
  const magDhwItems = useMemo(() => bySubType('mag_dhw'), [activeCatalog]);
  const mountItems = useMemo(() => activeCatalog.filter((i) => i.category === 'mounting'), [activeCatalog]);
  const rcdItems = useMemo(() => bySubType('rcd_fi'), [activeCatalog]);
  const breakerItems = useMemo(() => bySubType('breaker_ls'), [activeCatalog]);
  const bwwpAll = useMemo(() => bySubType('dhw_hp'), [activeCatalog]);

  // WP State
  const [hpDesign, setHpDesign] = useState<'monoblock' | 'semisplit'>('monoblock');
  const [selectedMonoId, setSelectedMonoId] = useState<number>(0);
  const [selectedSplitOutId, setSelectedSplitOutId] = useState<number>(0);
  const [splitIndoorMode, setSplitIndoorMode] = useState<'with_tank' | 'wall_only'>('with_tank');
  const [selectedSplitInId, setSelectedSplitInId] = useState<number>(0);
  const [hpLineSystem, setHpLineSystem] = useState<'copper' | 'alu'>('copper');
  const [hpDimension, setHpDimension] = useState<string>('28mm');

  const [selectedBufferId, setSelectedBufferId] = useState<number>(NOT_PRESET);
  const [dhwMode, setDhwMode] = useState<'none' | 'internal' | 'external'>('external');
  const [selectedDhwTankId, setSelectedDhwTankId] = useState<number>(0);
  const [dhwExtraHeatingRod, setDhwExtraHeatingRod] = useState<boolean>(true);
  const [selectedMountId, setSelectedMountId] = useState<number>(NOT_PRESET);

  const [selectedMagHeatId, setSelectedMagHeatId] = useState<number>(NOT_PRESET);
  const [selectedMagDhwId, setSelectedMagDhwId] = useState<number>(NOT_PRESET);
  const [useFrostValves, setUseFrostValves] = useState<boolean>(true);
  const [useFlexHose, setUseFlexHose] = useState<boolean>(true);
  const [useMicrobubble, setUseMicrobubble] = useState<boolean>(true);
  const [useSludgeSep, setUseSludgeSep] = useState<boolean>(true);
  const [useCoarseFilter, setUseCoarseFilter] = useState<boolean>(true);
  const [useHeatMeter, setUseHeatMeter] = useState<boolean>(true);
  const [useDiffValve, setUseDiffValve] = useState<boolean>(true);
  const [useFillingStation, setUseFillingStation] = useState<boolean>(true);
  const [useSecondCircuit, setUseSecondCircuit] = useState<boolean>(true);
  const [includeInsulation, setIncludeInsulation] = useState<boolean>(true);
  const [useChassisHeater, setUseChassisHeater] = useState<boolean>(true);

  const [useSubDistribution, setUseSubDistribution] = useState<boolean>(true);
  const [useSurgeProtector, setUseSurgeProtector] = useState<boolean>(true);
  const [selectedRcdId, setSelectedRcdId] = useState<number>(0);
  const [selectedBreakerWpId, setSelectedBreakerWpId] = useState<number>(0);
  const [selectedBreakerHeaterId, setSelectedBreakerHeaterId] = useState<number>(0);
  const [selectedBreakerDhwRodId, setSelectedBreakerDhwRodId] = useState<number>(0);
  const [useExtensionPcb, setUseExtensionPcb] = useState<boolean>(true);
  const [useNetworkMod, setUseNetworkMod] = useState<boolean>(true);
  const [useOutdoorSensor, setUseOutdoorSensor] = useState<boolean>(true);
  const [indoorSensorCount, setIndoorSensorCount] = useState<number>(1);

  // BWWP State
  const [bwwpManufacturer, setBwwpManufacturer] = useState<'Panasonic' | 'LG'>('Panasonic');
  const [selectedBwwpId, setSelectedBwwpId] = useState<number>(0);
  const [bwwpLineSystem, setBwwpLineSystem] = useState<'copper' | 'alu'>('alu');
  const [bwwpDimension, setBwwpDimension] = useState<string>('20x2');
  const [selectedBwwpMagId, setSelectedBwwpMagId] = useState<number>(NOT_PRESET);
  const [bwwpWaterFilter, setBwwpWaterFilter] = useState<boolean>(true);
  const [bwwpSafetyGroup, setBwwpSafetyGroup] = useState<boolean>(true);
  const [bwwpCondensateDrain, setBwwpCondensateDrain] = useState<boolean>(true);
  const [bwwpSubDistribution, setBwwpSubDistribution] = useState<boolean>(true);
  const [bwwpIncludeInsulation, setBwwpIncludeInsulation] = useState<boolean>(true);

  const bwwpFilteredByBrand = useMemo(
    () => bwwpAll.filter((i) => (i.manufacturer || '').toLowerCase() === bwwpManufacturer.toLowerCase()),
    [bwwpAll, bwwpManufacturer]
  );

  useEffect(() => {
    if (monoUnits.length > 0 && !selectedMonoId) setSelectedMonoId(monoUnits[1]?.id || monoUnits[0].id!);
    if (splitOutUnits.length > 0 && !selectedSplitOutId) setSelectedSplitOutId(splitOutUnits[1]?.id || splitOutUnits[0].id!);
    const indoorUnits = splitIndoorMode === 'with_tank' ? splitInTankUnits : splitInWallUnits;
    if (indoorUnits.length > 0 && !indoorUnits.some((u) => u.id === selectedSplitInId)) {
      setSelectedSplitInId(indoorUnits[0].id!);
    }
    if (bufferTanks.length > 0 && selectedBufferId === NOT_PRESET) setSelectedBufferId(bufferTanks[1]?.id || bufferTanks[0].id!);
    if (dhwTanks.length > 0 && !selectedDhwTankId) setSelectedDhwTankId(dhwTanks[0].id!);
    if (mountItems.length > 0 && selectedMountId === NOT_PRESET) setSelectedMountId(mountItems[0].id!);
    if (magHeatItems.length > 0 && selectedMagHeatId === NOT_PRESET) setSelectedMagHeatId(magHeatItems[0].id!);
    if (magDhwItems.length > 0 && selectedMagDhwId === NOT_PRESET) setSelectedMagDhwId(magDhwItems[0].id!);
    if (magDhwItems.length > 0 && selectedBwwpMagId === NOT_PRESET) setSelectedBwwpMagId(magDhwItems[0].id!);
    if (rcdItems.length > 0 && !selectedRcdId) setSelectedRcdId(rcdItems[0].id!);
    if (breakerItems.length > 0) {
      if (!selectedBreakerWpId) setSelectedBreakerWpId(breakerItems[0].id!);
      if (!selectedBreakerHeaterId) setSelectedBreakerHeaterId(breakerItems[0].id!);
      if (!selectedBreakerDhwRodId) setSelectedBreakerDhwRodId(breakerItems[0].id!);
    }
  }, [monoUnits, splitOutUnits, splitInTankUnits, splitInWallUnits, splitIndoorMode, bufferTanks, dhwTanks, mountItems, magHeatItems, magDhwItems, rcdItems, breakerItems]);

  useEffect(() => {
    if (bwwpFilteredByBrand.length > 0 && !bwwpFilteredByBrand.some((u) => u.id === selectedBwwpId)) {
      setSelectedBwwpId(bwwpFilteredByBrand[0].id!);
    }
  }, [bwwpFilteredByBrand, selectedBwwpId]);

  const handleGenerateHeatPump = () => {
    const schema = generateHeatPumpSchema(activeCatalog, {
      design: hpDesign,
      monoId: selectedMonoId,
      splitOutId: selectedSplitOutId,
      splitInId: selectedSplitInId,
      splitIndoorMode,
      lineSystem: hpLineSystem,
      dimension: hpDimension,
      bufferId: selectedBufferId,
      dhwMode,
      dhwTankId: selectedDhwTankId,
      dhwHeatingRod: dhwExtraHeatingRod,
      mountId: selectedMountId,
      magHeatId: selectedMagHeatId,
      magDhwId: selectedMagDhwId,
      frostValves: useFrostValves,
      flexHoses: useFlexHose,
      microbubble: useMicrobubble,
      sludgeSeparator: useSludgeSep,
      coarseFilter: useCoarseFilter,
      heatMeter: useHeatMeter,
      diffValve: useDiffValve,
      fillingStation: useFillingStation,
      heatingCircuit: useSecondCircuit,
      insulation: includeInsulation,
      chassisHeater: useChassisHeater,
      subDistribution: useSubDistribution,
      surgeProtector: useSurgeProtector,
      rcdId: selectedRcdId,
      breakerWpId: selectedBreakerWpId,
      breakerHeaterId: selectedBreakerHeaterId,
      breakerRodId: selectedBreakerDhwRodId,
      extensionPcb: useExtensionPcb,
      networkModule: useNetworkMod,
      outdoorSensor: useOutdoorSensor,
      indoorSensorCount,
    });
    if (schema) onApplyWizard(schema.nodes, schema.edges, hpLineSystem, hpDimension, schema.warnings);
  };

  const handleGenerateBwwp = () => {
    const schema = generateBwwpSchema(activeCatalog, {
      bwwpId: selectedBwwpId,
      lineSystem: bwwpLineSystem,
      dimension: bwwpDimension,
      magId: selectedBwwpMagId,
      waterFilter: bwwpWaterFilter,
      safetyGroup: bwwpSafetyGroup,
      condensateDrain: bwwpCondensateDrain,
      subDistribution: bwwpSubDistribution,
      insulation: bwwpIncludeInsulation,
    });
    if (schema) onApplyWizard(schema.nodes, schema.edges, bwwpLineSystem, bwwpDimension, schema.warnings);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Assistenten-Auswahl (WP & BWWP ohne Untertext, Klimaanlage "Aktuell noch in Arbeit") */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveWizard('hp')}
          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer ${
            activeWizard === 'hp' ? 'border-sky-600 bg-sky-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="bg-sky-600 text-white p-2.5 rounded-xl shrink-0"><Flame className="w-6 h-6" /></div>
          <div className="font-bold text-slate-900">1. Wärmepumpen-Assistent</div>
        </button>

        <button
          onClick={() => setActiveWizard('dhw')}
          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer ${
            activeWizard === 'dhw' ? 'border-emerald-600 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl shrink-0"><Droplets className="w-6 h-6" /></div>
          <div className="font-bold text-slate-900">2. Brauchwasser-WP Assistent</div>
        </button>

        <button
          onClick={() => setActiveWizard('ac')}
          className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3.5 cursor-pointer ${
            activeWizard === 'ac' ? 'border-amber-600 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0"><Wind className="w-6 h-6" /></div>
          <div>
            <div className="font-bold text-slate-900">3. Klimaanlagen-Assistent</div>
            <p className="text-xs text-slate-600 mt-0.5">Aktuell noch in Arbeit</p>
          </div>
        </button>
      </div>

      {activeWizard === 'hp' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Panasonic Wärmepumpen-Assistent (Generation J & Generation L)</h2>
              <p className="text-xs text-slate-500">Alle auswählbaren Geräte und Zubehörteile stammen live aus deinem aktiven Teilekatalog.</p>
            </div>
            <button
              onClick={handleGenerateHeatPump}
              className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Wand2 className="w-4 h-4" /> Schema & Teileliste generieren
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><Flame className="w-4 h-4 text-sky-600" /> 1. Wärmepumpe & Speicher</h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setHpDesign('monoblock'); if (dhwMode === 'internal') setDhwMode('external'); }}
                  className={`p-2 rounded-lg border font-bold cursor-pointer ${hpDesign === 'monoblock' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'}`}
                >
                  Gen J Monoblock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHpDesign('semisplit');
                    if (splitIndoorMode === 'with_tank' && dhwMode === 'external') setDhwMode('internal');
                  }}
                  className={`p-2 rounded-lg border font-bold cursor-pointer ${hpDesign === 'semisplit' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'}`}
                >
                  Gen L Semisplit
                </button>
              </div>

              {hpDesign === 'monoblock' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monoblock-Modell</label>
                  <select
                    value={selectedMonoId}
                    onChange={(e) => setSelectedMonoId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    {monoUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.price} €)</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-white rounded-lg border border-sky-200">
                  <select
                    value={selectedSplitOutId}
                    onChange={(e) => setSelectedSplitOutId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    {splitOutUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.price} €)</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSplitIndoorMode('with_tank');
                        setDhwMode('internal');
                        if (splitInTankUnits[0]?.id) setSelectedSplitInId(splitInTankUnits[0].id);
                      }}
                      className={`p-1.5 rounded border text-[11px] font-semibold cursor-pointer ${splitIndoorMode === 'with_tank' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-700 border-slate-300'}`}
                    >
                      Mit WW-Tank
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitIndoorMode('wall_only');
                        setDhwMode('external');
                        if (splitInWallUnits[0]?.id) setSelectedSplitInId(splitInWallUnits[0].id);
                      }}
                      className={`p-1.5 rounded border text-[11px] font-semibold cursor-pointer ${splitIndoorMode === 'wall_only' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-700 border-slate-300'}`}
                    >
                      Wandgerät ohne Tank
                    </button>
                  </div>
                  <select
                    value={selectedSplitInId}
                    onChange={(e) => setSelectedSplitInId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    {(splitIndoorMode === 'with_tank' ? splitInTankUnits : splitInWallUnits).map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.price} €)</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Montageart Außengerät</label>
                <select
                  value={selectedMountId}
                  onChange={(e) => setSelectedMountId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                >
                  <option value={0}>Ohne Montagematerial</option>
                  {mountItems.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.price} €)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verrohrung</label>
                  <select
                    value={hpLineSystem}
                    onChange={(e) => {
                      const sys = e.target.value as 'copper' | 'alu';
                      setHpLineSystem(sys);
                      setHpDimension(sys === 'copper' ? '28mm' : '26x3');
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    <option value="copper">Kupferrohr</option>
                    <option value="alu">Alu-Verbundrohr</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Größe</label>
                  <select
                    value={hpDimension}
                    onChange={(e) => setHpDimension(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    {LINE_SYSTEM_CONFIG[hpLineSystem].dimensions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rücklauf-Pufferspeicher (Abtauhilfe im Rücklauf)</label>
                  <select
                    value={selectedBufferId}
                    onChange={(e) => setSelectedBufferId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    <option value={0}>Ohne Rücklauf-Puffer</option>
                    {bufferTanks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.price} €)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warmwasserspeicher</label>
                  <select
                    value={dhwMode}
                    onChange={(e) => setDhwMode(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    <option value="none">Ohne Warmwasser</option>
                    <option value="external">Externer Warmwasserspeicher (+ 3-Wege-Ventil)</option>
                    {hpDesign === 'semisplit' && splitIndoorMode === 'with_tank' && (
                      <option value="internal">Intern im Kombi-Hydromodul (185L)</option>
                    )}
                  </select>
                </div>

                {dhwMode === 'external' && (
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                    <select
                      value={selectedDhwTankId}
                      onChange={(e) => setSelectedDhwTankId(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded p-1.5 font-semibold"
                    >
                      {dhwTanks.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.price} €)</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={dhwExtraHeatingRod} onChange={(e) => setDhwExtraHeatingRod(e.target.checked)} />
                      <span className="font-medium">E-Heizstab im WW-Speicher (+ extra Sicherung)</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><Gauge className="w-4 h-4 text-sky-600" /> 2. Hydraulik & Dämmung</h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MAG Heizung</label>
                  <select
                    value={selectedMagHeatId}
                    onChange={(e) => setSelectedMagHeatId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-semibold"
                  >
                    <option value={0}>Ohne MAG</option>
                    {magHeatItems.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.price} €)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MAG Sanitär</label>
                  <select
                    value={selectedMagDhwId}
                    onChange={(e) => setSelectedMagDhwId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-semibold"
                  >
                    <option value={0}>Ohne MAG</option>
                    {magDhwItems.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.price} €)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 bg-emerald-50 p-2 rounded-lg border border-emerald-300 cursor-pointer">
                  <input type="checkbox" checked={includeInsulation} onChange={(e) => setIncludeInsulation(e.target.checked)} />
                  <span className="font-bold text-emerald-950">Dämmung / Isolierung für Rohre & Armaturen hinzufügen</span>
                </label>
                {[
                  { state: useFrostValves, setter: setUseFrostValves, label: '2x Frostschutzventil direkt am Außengerät (VL & RL)' },
                  { state: useFlexHose, setter: setUseFlexHose, label: '2x Panzerschlauch am Außengerät vor Hausrohr (VL & RL)' },
                  { state: useMicrobubble, setter: setUseMicrobubble, label: 'Mikroblasenabscheider im Vorlauf' },
                  { state: useSludgeSep, setter: setUseSludgeSep, label: 'Magnetit- & Schlammabscheider im Rücklauf' },
                  { state: useCoarseFilter, setter: setUseCoarseFilter, label: 'Grobpartikelfilter / Superfilter im Rücklauf' },
                  { state: useHeatMeter, setter: setUseHeatMeter, label: 'Wärmemengenzähler + 2-teiliges Einbauset (VL-Fühler & RL-Zähler)' },
                  { state: useDiffValve, setter: setUseDiffValve, label: 'Differenzdruck-Überströmventil' },
                  { state: useFillingStation, setter: setUseFillingStation, label: 'Heizungs-Befüllstation VDI 2035' },
                  { state: useSecondCircuit, setter: setUseSecondCircuit, label: 'Heizkreis-Pumpengruppe / Heizkreis' },
                ].map((opt, idx) => (
                  <label key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={opt.state} onChange={(e) => opt.setter(e.target.checked)} />
                    <span className="font-medium text-slate-800">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> 3. Einzel-Elektrik & Zusatzteile</h3>

              <label className="flex items-center gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-300 cursor-pointer">
                <input type="checkbox" checked={useSubDistribution} onChange={(e) => setUseSubDistribution(e.target.checked)} />
                <span className="font-bold text-amber-950">Separate IP65 Unterverteilung (2-reihig)</span>
              </label>

              <label className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={useSurgeProtector} onChange={(e) => setUseSurgeProtector(e.target.checked)} />
                <span className="font-medium">Überspannungsschutz Typ 1+2</span>
              </label>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">FI-Schutzschalter</label>
                <select
                  value={selectedRcdId}
                  onChange={(e) => setSelectedRcdId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-semibold"
                >
                  {rcdItems.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.price} €)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sicherung WP</label>
                  <select
                    value={selectedBreakerWpId}
                    onChange={(e) => setSelectedBreakerWpId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-semibold"
                  >
                    {breakerItems.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sicherung Heizstab</label>
                  <select
                    value={selectedBreakerHeaterId}
                    onChange={(e) => setSelectedBreakerHeaterId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-semibold"
                  >
                    {breakerItems.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                {[
                  { state: useChassisHeater, setter: setUseChassisHeater, label: 'Panasonic Zusatz-Gehäuse-/Bodenwannenheizung' },
                  { state: useExtensionPcb, setter: setUseExtensionPcb, label: 'Panasonic Erweiterungsplatine (CZ-NS5P)' },
                  { state: useNetworkMod, setter: setUseNetworkMod, label: 'Panasonic Smart Cloud Modul (CZ-TAW1B)' },
                  { state: useOutdoorSensor, setter: setUseOutdoorSensor, label: 'Außentemperaturfühler (PAW-A2W-TSOD)' },
                ].map((opt, idx) => (
                  <label key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={opt.state} onChange={(e) => opt.setter(e.target.checked)} />
                    <span className="font-medium text-slate-800">{opt.label}</span>
                  </label>
                ))}
                <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                  <span className="font-medium">Temperatursensoren Innen / Speicher:</span>
                  <select
                    value={indoorSensorCount}
                    onChange={(e) => setIndoorSensorCount(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-1 font-semibold"
                  >
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} Stück</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeWizard === 'dhw' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Brauchwasser-Wärmepumpen-Assistent (Panasonic & LG)</h2>
              <p className="text-xs text-slate-500">Alle auswählbaren Geräte und Zubehörteile stammen live aus deinem aktiven Teilekatalog.</p>
            </div>
            <button
              onClick={handleGenerateBwwp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Wand2 className="w-4 h-4" /> BWWP-Schema generieren
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">1. Hersteller, Modell & Verrohrung</h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBwwpManufacturer('Panasonic')}
                  className={`p-2 rounded-lg border font-bold cursor-pointer ${bwwpManufacturer === 'Panasonic' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`}
                >
                  Panasonic
                </button>
                <button
                  type="button"
                  onClick={() => setBwwpManufacturer('LG')}
                  className={`p-2 rounded-lg border font-bold cursor-pointer ${bwwpManufacturer === 'LG' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`}
                >
                  LG
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Modell & Tankgröße</label>
                <select
                  value={selectedBwwpId}
                  onChange={(e) => setSelectedBwwpId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                >
                  {bwwpFilteredByBrand.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} [{b.articleNumber}] – {b.price} €</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Leitungsart</label>
                  <select
                    value={bwwpLineSystem}
                    onChange={(e) => {
                      const sys = e.target.value as 'copper' | 'alu';
                      setBwwpLineSystem(sys);
                      setBwwpDimension(sys === 'copper' ? '22mm' : '20x2');
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    <option value="copper">Kupferrohr</option>
                    <option value="alu">Alu-Verbundrohr</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rohrgröße</label>
                  <select
                    value={bwwpDimension}
                    onChange={(e) => setBwwpDimension(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    {LINE_SYSTEM_CONFIG[bwwpLineSystem].dimensions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">2. Zubehör, MAG, Dämmung & Elektro</h3>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ausdehnungsgefäß (MAG Sanitär)</label>
                <select
                  value={selectedBwwpMagId}
                  onChange={(e) => setSelectedBwwpMagId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                >
                  <option value={0}>Ohne MAG</option>
                  {magDhwItems.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} – {m.price} €</option>
                  ))}
                </select>
              </div>

              {[
                { state: bwwpIncludeInsulation, setter: setBwwpIncludeInsulation, label: 'Dämmung / Isolierung für Rohre hinzufügen' },
                { state: bwwpWaterFilter, setter: setBwwpWaterFilter, label: 'Trinkwasserfilter mit Druckminderer' },
                { state: bwwpSafetyGroup, setter: setBwwpSafetyGroup, label: 'Sicherheitsgruppe / Überdruckventil (6 bar)' },
                { state: bwwpCondensateDrain, setter: setBwwpCondensateDrain, label: 'Kondensat-Abflussgarnitur mit Siphon' },
                { state: bwwpSubDistribution, setter: setBwwpSubDistribution, label: 'Separate IP65 Unterverteilung (1-reihig) hinzufügen' },
              ].map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                  <input type="checkbox" checked={opt.state} onChange={(e) => opt.setter(e.target.checked)} />
                  <span className="font-medium text-slate-800">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeWizard === 'ac' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Klimaanlagen-Assistent</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Aktuell noch in Arbeit</p>
        </div>
      )}
    </div>
  );
}