import Dexie, { type EntityTable } from 'dexie';

export type LineSystem = 'copper' | 'alu' | 'hose' | 'refrigerant' | 'electric';

export type CatalogCategory =
  | 'heatpump'
  | 'dhw_heatpump'
  | 'ac'
  | 'buffer'
  | 'pipe'
  | 'fitting'
  | 'adapter'
  | 'electric'
  | 'mounting'
  | 'insulation';

export type ComponentSubType =
  | 'hp_outdoor_mono'
  | 'hp_outdoor_split'
  | 'hp_indoor_tank'
  | 'hp_indoor_wall'
  | 'dhw_hp'
  | 'buffer_heating'
  | 'tank_dhw'
  | 'mag_heating'
  | 'mag_dhw'
  | 'sludge_separator'
  | 'microbubble_separator'
  | 'coarse_filter'
  | 'water_filter'
  | 'diff_pressure_valve'
  | 'frost_valve'
  | 'filling_station'
  | 'heat_meter'
  | 'heat_meter_vl_sensor'
  | 'three_way_valve'
  | 'pump_group'
  | 'safety_group'
  | 'thermostatic_mixer'
  | 'condensate_drain'
  | 'flex_hose'
  | 'elbow_90'
  | 'adapter_transition'
  | 'tee_piece'
  | 'pipe_article'
  | 'busbar'
  | 'control_terminal'
  | 'sub_distribution'
  | 'sub_distribution_1r'
  | 'rcd_fi'
  | 'breaker_ls'
  | 'surge_protector'
  | 'heating_rod'
  | 'chassis_heater'
  | 'pcb_extension'
  | 'network_module'
  | 'sensor_indoor'
  | 'sensor_outdoor'
  | 'mount_ground'
  | 'mount_wall'
  | 'mount_foundation'
  | 'insulation_part'
  | 'insulation_pipe'
  | 'other';

export const COMPONENT_SUBTYPE_LABELS: Record<ComponentSubType, string> = {
  hp_outdoor_mono: 'WP Außengerät (Monoblock)',
  hp_outdoor_split: 'WP Außengerät (Semisplit)',
  hp_indoor_tank: 'WP Innengerät (mit WW-Tank)',
  hp_indoor_wall: 'WP Innengerät (Wandgerät ohne Tank)',
  dhw_hp: 'Brauchwasser-Wärmepumpe',
  buffer_heating: 'Rücklauf-Pufferspeicher (Abtauhilfe)',
  tank_dhw: 'Warmwasserspeicher (extern)',
  mag_heating: 'Ausdehnungsgefäß (MAG Heizung)',
  mag_dhw: 'Ausdehnungsgefäß (MAG Sanitär)',
  sludge_separator: 'Schlamm- & Magnetitabscheider',
  microbubble_separator: 'Mikroblasenabscheider',
  coarse_filter: 'Grobpartikelfilter / Schmutzfänger',
  water_filter: 'Trinkwasserfilter',
  diff_pressure_valve: 'Differenzdruck-Überströmventil',
  frost_valve: 'Frostschutzventil (Einzelventil)',
  filling_station: 'Befüllstation',
  heat_meter: 'Wärmemengenzähler + Einbauset (Rücklauf)',
  heat_meter_vl_sensor: 'WMZ-Einbauset Fühler-Kugelhahn (Vorlauf)',
  three_way_valve: '3-Wege-Umschaltventil',
  pump_group: 'Heizkreis-Pumpengruppe',
  safety_group: 'Sicherheitsgruppe / Überdruckventil',
  thermostatic_mixer: 'Thermisches Mischventil',
  condensate_drain: 'Kondensat-Abflussgarnitur',
  flex_hose: 'Panzerschlauch (Einzelschlauch)',
  elbow_90: 'Bogen / Winkel 90°',
  adapter_transition: 'Übergangsstück / Adapter',
  tee_piece: 'T-Stück (Abzweig)',
  pipe_article: 'Rohr / Leitung (Meterware)',
  busbar: 'Phasenschiene / Sammelschiene',
  control_terminal: 'Anschlussklemmen Steuerleitung',
  sub_distribution: 'IP-Unterverteilung 2-reihig (WP)',
  sub_distribution_1r: 'IP-Unterverteilung 1-reihig (BWWP)',
  rcd_fi: 'FI-Schutzschalter (RCD)',
  breaker_ls: 'Leitungsschutzschalter (Sicherung)',
  surge_protector: 'Überspannungsschutz',
  heating_rod: 'Elektro-Heizstab (WW-Speicher)',
  chassis_heater: 'Zusatz-Gehäuse-/Wannenheizung WP',
  pcb_extension: 'Erweiterungsplatine',
  network_module: 'Netzwerk- / Internetmodul',
  sensor_indoor: 'Temperatursensor Innen / Speicher',
  sensor_outdoor: 'Temperatursensor Außen',
  mount_ground: 'Bodenkonsole / Bigfoot-Dämpfer',
  mount_wall: 'Wandhalterung / Konsole',
  mount_foundation: 'Betonfundament',
  insulation_part: 'Dämmschale für Bauteil / Armatur',
  insulation_pipe: 'Rohrisolierung (Meterware)',
  other: 'Sonstiges Bauteil',
};

export const LINE_SYSTEM_CONFIG: Record<
  LineSystem,
  {
    label: string;
    medium: 'water' | 'refrigerant' | 'electric';
    color: string;
    dimensions: string[];
    meterPrices: Record<string, number>;
  }
> = {
  copper: {
    label: 'Kupferrohr',
    medium: 'water',
    color: '#b45309',
    dimensions: ['15mm', '18mm', '22mm', '28mm', '35mm', '42mm'],
    meterPrices: {
      '15mm': 8.5,
      '18mm': 10.9,
      '22mm': 14.2,
      '28mm': 19.8,
      '35mm': 27.5,
      '42mm': 36.0,
    },
  },
  alu: {
    label: 'Alu-Verbundrohr',
    medium: 'water',
    color: '#0284c7',
    dimensions: ['16x2', '20x2', '26x3', '32x3', '40x3.5'],
    meterPrices: {
      '16x2': 3.2,
      '20x2': 4.8,
      '26x3': 7.9,
      '32x3': 11.5,
      '40x3.5': 17.9,
    },
  },
  hose: {
    label: 'Flex- / Panzerschlauch',
    medium: 'water',
    color: '#475569',
    dimensions: ['DN25 (1")', 'DN32 (1 1/4")'],
    meterPrices: {
      'DN25 (1")': 54.0,
      'DN32 (1 1/4")': 68.0,
    },
  },
  refrigerant: {
    label: 'Kältemittelleitung',
    medium: 'refrigerant',
    color: '#10b981',
    dimensions: ['1/4" + 3/8"', '1/4" + 1/2"', '3/8" + 5/8"'],
    meterPrices: {
      '1/4" + 3/8"': 16.5,
      '1/4" + 1/2"': 19.5,
      '3/8" + 5/8"': 26.0,
    },
  },
  electric: {
    label: 'Elektroleitung',
    medium: 'electric',
    color: '#eab308',
    dimensions: ['3x1.5', '3x2.5', '5x1.5', '5x2.5', '5x4.0', '5x6.0', 'Bus 2x2x0.8'],
    meterPrices: {
      '3x1.5': 1.4,
      '3x2.5': 2.2,
      '5x1.5': 2.5,
      '5x2.5': 3.8,
      '5x4.0': 6.4,
      '5x6.0': 9.8,
      'Bus 2x2x0.8': 1.2,
    },
  },
};

export interface PortDefinition {
  id: string;
  label: string;
  medium: 'water' | 'refrigerant' | 'electric';
  fixedDimension?: string;
  side?: 'left' | 'right' | 'both';
}

export interface DimensionVariant {
  dimension: string;
  articleNumber: string;
  supplierLink?: string;
  price?: number;
}

export interface CatalogDocument {
  id: string;
  name: string;
  dataBase64: string;
}

export interface CatalogItem {
  id?: number;
  name: string;
  category: CatalogCategory;
  componentType?: ComponentSubType;
  manufacturer?: string;
  series?: string;
  design?: 'monoblock' | 'semisplit';
  powerKw?: number;
  volumeL?: number;
  isActive?: boolean;
  lineSystem?: LineSystem;
  articleNumber: string;
  supplierLink: string;
  price?: number;
  imageBase64?: string;
  documents?: CatalogDocument[];
  linkedArticleNumber?: string;
  linkedPipeSystem?: LineSystem;
  linkedPipeDimension?: string;
  isMultiPort?: boolean;
  ports: PortDefinition[];
  leftLabel?: string;
  leftMedium?: 'water' | 'refrigerant' | 'electric';
  leftDim?: string;
  rightLabel?: string;
  rightMedium?: 'water' | 'refrigerant' | 'electric';
  rightDim?: string;
  isDynamicSize: boolean;
  variants?: DimensionVariant[];
}

export interface CustomBomItem {
  id: string;
  name: string;
  articleNumber: string;
  quantity: number;
  unit: 'Stk' | 'm';
  unitPrice: number;
  supplierLink?: string;
  imageBase64?: string;
  documents?: CatalogDocument[];
}

export interface SavedProject {
  id?: number;
  name: string;
  updatedAt: string;
  defaultSystem: LineSystem;
  defaultDimension: string;
  diagramNodes: any[];
  diagramEdges: any[];
  bomOverrides?: Record<string, { quantity?: number; deleted?: boolean }>;
  customBomItems?: CustomBomItem[];
}

const db = new Dexie('WPPlanerDatabase') as Dexie & {
  catalog: EntityTable<CatalogItem, 'id'>;
  projects: EntityTable<SavedProject, 'id'>;
};

db.version(9).stores({
  catalog:
    '++id, name, category, componentType, manufacturer, isActive, lineSystem, articleNumber, linkedArticleNumber',
  projects: '++id, name, updatedAt',
});

const MONO_PORTS: PortDefinition[] = [
  { id: 'vl', label: 'Vorlauf (1 1/4" AG)', medium: 'water', fixedDimension: '1_1/4_Zoll_IG', side: 'right' },
  { id: 'rl', label: 'Rücklauf (1 1/4" AG)', medium: 'water', fixedDimension: '1_1/4_Zoll_IG', side: 'right' },
  { id: 'el_1', label: 'Netzanschluss 1 (Verdichter)', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
  { id: 'el_2', label: 'Netzanschluss 2 (Heizstab)', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
  { id: 'bus', label: 'Steuerung / Fühler / Bus', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'right' },
];

const SPLIT_OUT_PORTS: PortDefinition[] = [
  { id: 'vl_sp', label: 'Vorlauf (1" AG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
  { id: 'rl_sp', label: 'Rücklauf (1" AG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
  { id: 'el_out', label: 'Netzanschluss Außengerät', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
  { id: 'bus_out', label: 'Verbindungsleitung Innengerät', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'right' },
];

const BWWP_PORTS: PortDefinition[] = [
  { id: 'kw', label: 'Kaltwasser Eingang (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' },
  { id: 'ww', label: 'Warmwasser Ausgang (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'right' },
  { id: 'kond', label: 'Kondensatablauf', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' },
  { id: 'el', label: 'Netzanschluss 230V', medium: 'electric', fixedDimension: '3x1.5', side: 'left' },
];

export const DEFAULT_ITEMS: CatalogItem[] = [
  {
    name: 'Panasonic Aquarea Gen J Monoblock 5 kW',
    category: 'heatpump',
    componentType: 'hp_outdoor_mono',
    manufacturer: 'Panasonic',
    series: 'Generation J',
    design: 'monoblock',
    powerKw: 5,
    isActive: true,
    articleNumber: 'WH-MDC05J3E5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 3890.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: MONO_PORTS,
  },
  {
    name: 'Panasonic Aquarea Gen J Monoblock 7 kW',
    category: 'heatpump',
    componentType: 'hp_outdoor_mono',
    manufacturer: 'Panasonic',
    series: 'Generation J',
    design: 'monoblock',
    powerKw: 7,
    isActive: true,
    articleNumber: 'WH-MDC07J3E5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 4290.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: MONO_PORTS,
  },
  {
    name: 'Panasonic Aquarea Gen J Monoblock 9 kW',
    category: 'heatpump',
    componentType: 'hp_outdoor_mono',
    manufacturer: 'Panasonic',
    series: 'Generation J',
    design: 'monoblock',
    powerKw: 9,
    isActive: true,
    articleNumber: 'WH-MDC09J3E5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 4690.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: MONO_PORTS,
  },
  {
    name: 'Panasonic Aquarea Gen L Außengerät 5 kW (Semisplit)',
    category: 'heatpump',
    componentType: 'hp_outdoor_split',
    manufacturer: 'Panasonic',
    series: 'Generation L',
    design: 'semisplit',
    powerKw: 5,
    isActive: true,
    articleNumber: 'WH-WDG05LE5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 3550.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: SPLIT_OUT_PORTS,
  },
  {
    name: 'Panasonic Aquarea Gen L Außengerät 7 kW (Semisplit)',
    category: 'heatpump',
    componentType: 'hp_outdoor_split',
    manufacturer: 'Panasonic',
    series: 'Generation L',
    design: 'semisplit',
    powerKw: 7,
    isActive: true,
    articleNumber: 'WH-WDG07LE5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 3950.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: SPLIT_OUT_PORTS,
  },
  {
    name: 'Panasonic Aquarea Gen L Außengerät 9 kW (Semisplit)',
    category: 'heatpump',
    componentType: 'hp_outdoor_split',
    manufacturer: 'Panasonic',
    series: 'Generation L',
    design: 'semisplit',
    powerKw: 9,
    isActive: true,
    articleNumber: 'WH-WDG09LE5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 4390.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: SPLIT_OUT_PORTS,
  },
  {
    name: 'Panasonic Gen L Kombi-Hydromodul (Innengerät MIT 185L WW-Tank)',
    category: 'heatpump',
    componentType: 'hp_indoor_tank',
    manufacturer: 'Panasonic',
    series: 'Generation L',
    design: 'semisplit',
    volumeL: 185,
    isActive: true,
    articleNumber: 'WH-ADC0509L3E5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 3890.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'vl_in', label: 'VL vom Außengerät (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'rl_in', label: 'RL zum Außengerät (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'bus_in', label: 'Bus Außengerät', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
      { id: 'vl', label: 'Vorlauf Heizung (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'rl', label: 'Rücklauf Heizung (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'el_heat', label: 'Netz Heizstab 230V', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
      { id: 'bus', label: 'Steuerung / Fühler', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'right' },
      { id: 'kw', label: 'Kaltwasser Eingang (PWC)', medium: 'water', side: 'right' },
      { id: 'ww', label: 'Warmwasser Ausgang (PWH)', medium: 'water', side: 'right' },
    ],
  },
  {
    name: 'Panasonic Gen L Wand-Hydromodul (Innengerät OHNE WW-Tank)',
    category: 'heatpump',
    componentType: 'hp_indoor_wall',
    manufacturer: 'Panasonic',
    series: 'Generation L',
    design: 'semisplit',
    isActive: true,
    articleNumber: 'WH-SDC0509L3E5',
    supplierLink: 'https://www.aircon.panasonic.eu',
    price: 2190.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'vl_in', label: 'VL vom Außengerät (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'rl_in', label: 'RL zum Außengerät (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'bus_in', label: 'Bus Außengerät', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
      { id: 'vl', label: 'Vorlauf Heizung (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'rl', label: 'Rücklauf Heizung (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'el_heat', label: 'Netz Heizstab 230V', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
      { id: 'bus', label: 'Steuerung / Fühler', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'right' },
    ],
  },
  {
    name: 'Panasonic Brauchwasser-WP P-DHW100AE5 (100L Wand)',
    category: 'dhw_heatpump',
    componentType: 'dhw_hp',
    manufacturer: 'Panasonic',
    volumeL: 100,
    isActive: true,
    articleNumber: 'P-DHW100AE5',
    supplierLink: '',
    price: 1690.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: BWWP_PORTS,
  },
  {
    name: 'Panasonic Brauchwasser-WP P-DHW150AE5 (150L Wand)',
    category: 'dhw_heatpump',
    componentType: 'dhw_hp',
    manufacturer: 'Panasonic',
    volumeL: 150,
    isActive: true,
    articleNumber: 'P-DHW150AE5',
    supplierLink: '',
    price: 1850.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: BWWP_PORTS,
  },
  {
    name: 'Panasonic Brauchwasser-WP P-DHW200CAE5 (200L Stand)',
    category: 'dhw_heatpump',
    componentType: 'dhw_hp',
    manufacturer: 'Panasonic',
    volumeL: 200,
    isActive: true,
    articleNumber: 'P-DHW200CAE5',
    supplierLink: '',
    price: 2190.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: BWWP_PORTS,
  },
  {
    name: 'Panasonic Brauchwasser-WP P-DHW260CAE5 (270L Stand)',
    category: 'dhw_heatpump',
    componentType: 'dhw_hp',
    manufacturer: 'Panasonic',
    volumeL: 270,
    isActive: true,
    articleNumber: 'P-DHW260CAE5',
    supplierLink: '',
    price: 2450.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: BWWP_PORTS,
  },
  {
    name: 'LG Dual-Inverter Brauchwasser-WP WH20S (200L)',
    category: 'dhw_heatpump',
    componentType: 'dhw_hp',
    manufacturer: 'LG',
    volumeL: 200,
    isActive: true,
    articleNumber: 'WH20STR2.FA',
    supplierLink: '',
    price: 2150.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: BWWP_PORTS,
  },
  {
    name: 'LG Dual-Inverter Brauchwasser-WP WH27S (270L)',
    category: 'dhw_heatpump',
    componentType: 'dhw_hp',
    manufacturer: 'LG',
    volumeL: 270,
    isActive: true,
    articleNumber: 'WH27STR2.FA',
    supplierLink: '',
    price: 2390.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: BWWP_PORTS,
  },
  {
    name: 'Rücklauf-Pufferspeicher 50L (Reihenpuffer / Abtauhilfe)',
    category: 'buffer',
    componentType: 'buffer_heating',
    volumeL: 50,
    isActive: true,
    articleNumber: 'PS-RL-50L',
    supplierLink: '',
    price: 389.0,
    isMultiPort: false,
    leftLabel: 'Ausgang zur WP (1")',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Eingang vom Heizkreis (1")',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Rücklauf-Pufferspeicher 100L (Reihenpuffer / Abtauhilfe)',
    category: 'buffer',
    componentType: 'buffer_heating',
    volumeL: 100,
    isActive: true,
    articleNumber: 'PS-100-ISO',
    supplierLink: '',
    price: 540.0,
    isMultiPort: false,
    leftLabel: 'Ausgang zur WP (1")',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Eingang vom Heizkreis (1")',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Rücklauf-Pufferspeicher 200L (Reihenpuffer / Abtauhilfe)',
    category: 'buffer',
    componentType: 'buffer_heating',
    volumeL: 200,
    isActive: true,
    articleNumber: 'PS-200-ISO',
    supplierLink: '',
    price: 760.0,
    isMultiPort: false,
    leftLabel: 'Ausgang zur WP (1")',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Eingang vom Heizkreis (1")',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'WP-Warmwasserspeicher 200L (Großflächen-Wärmetauscher)',
    category: 'buffer',
    componentType: 'tank_dhw',
    volumeL: 200,
    isActive: true,
    articleNumber: 'WW-WP-200',
    supplierLink: '',
    price: 1090.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'wt_vl', label: 'Register VL (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'wt_rl', label: 'Register RL (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'el_rod', label: 'E-Heizstab Muffe', medium: 'electric', fixedDimension: '3x2.5', side: 'left' },
      { id: 'sens', label: 'Tauchhülse WW-Fühler', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
      { id: 'kw', label: 'Kaltwasser Eingang (PWC)', medium: 'water', side: 'right' },
      { id: 'ww', label: 'Warmwasser Ausgang (PWH)', medium: 'water', side: 'right' },
    ],
  },
  {
    name: 'WP-Warmwasserspeicher 300L (Großflächen-Wärmetauscher)',
    category: 'buffer',
    componentType: 'tank_dhw',
    volumeL: 300,
    isActive: true,
    articleNumber: 'WW-WP-300',
    supplierLink: '',
    price: 1290.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'wt_vl', label: 'Register VL (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'wt_rl', label: 'Register RL (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'el_rod', label: 'E-Heizstab Muffe', medium: 'electric', fixedDimension: '3x2.5', side: 'left' },
      { id: 'sens', label: 'Tauchhülse WW-Fühler', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
      { id: 'kw', label: 'Kaltwasser Eingang (PWC)', medium: 'water', side: 'right' },
      { id: 'ww', label: 'Warmwasser Ausgang (PWH)', medium: 'water', side: 'right' },
    ],
  },
  {
    name: 'Frostschutzventil 1 1/4" (am Außengerät)',
    category: 'fitting',
    componentType: 'frost_valve',
    isActive: true,
    articleNumber: 'FROST-VALVE-114',
    supplierLink: '',
    price: 109.5,
    isMultiPort: false,
    leftLabel: 'WP-Seite 1 1/4"',
    leftMedium: 'water',
    leftDim: '1_1/4_Zoll_IG',
    rightLabel: 'Rohr-Seite 1 1/4"',
    rightMedium: 'water',
    rightDim: '1_1/4_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Panzerschlauch 1 1/4" (1000mm schwingungsentkoppelt)',
    category: 'fitting',
    componentType: 'flex_hose',
    lineSystem: 'hose',
    isActive: true,
    articleNumber: 'FLEX-DN32-1M',
    supplierLink: '',
    price: 69.0,
    isMultiPort: false,
    leftLabel: 'Außengerät / Frostventil',
    leftMedium: 'water',
    leftDim: '1_1/4_Zoll_IG',
    rightLabel: 'Übergang Hausrohr',
    rightMedium: 'water',
    rightDim: '1_1/4_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Mikroblasenabscheider 1" IG (im Vorlauf)',
    category: 'fitting',
    componentType: 'microbubble_separator',
    isActive: true,
    articleNumber: 'MIKRO-SEP-1Z',
    supplierLink: '',
    price: 118.0,
    isMultiPort: false,
    leftLabel: 'Eingang 1"',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Ausgang 1"',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'WMZ-Einbauset Teil 1: Kugelhahn mit Fühleraufnahme (Vorlauf)',
    category: 'fitting',
    componentType: 'heat_meter_vl_sensor',
    isActive: true,
    articleNumber: 'WMZ-SET-VL-1Z',
    supplierLink: '',
    price: 39.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'in', label: 'Vorlauf Eingang (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'out', label: 'Vorlauf Ausgang (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'sens', label: 'WMZ Vorlauffühler (M10)', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
    ],
  },
  {
    name: 'Wärmemengenzähler Qn 2,5 + Einbauset Teil 2 (Rücklauf)',
    category: 'fitting',
    componentType: 'heat_meter',
    isActive: true,
    articleNumber: 'WMZ-QN25-1Z',
    supplierLink: '',
    price: 215.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'left', label: 'Zur WP (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'right', label: 'Vom Heizkreis (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'sens_out', label: 'Fühlerkabel zum Vorlauf', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
    ],
  },
  {
    name: 'Magnetit- & Schlammabscheider 1" IG (im Rücklauf)',
    category: 'fitting',
    componentType: 'sludge_separator',
    isActive: true,
    articleNumber: 'FILT-MAG-1Z',
    supplierLink: '',
    price: 185.0,
    isMultiPort: false,
    leftLabel: 'Ausgang zur WP 1"',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Eingang Rücklauf 1"',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Grobpartikelfilter / Superfilter 1" IG mit Kugelhahn',
    category: 'fitting',
    componentType: 'coarse_filter',
    isActive: true,
    articleNumber: 'FILT-GROB-1Z',
    supplierLink: '',
    price: 78.0,
    isMultiPort: false,
    leftLabel: 'Ausgang 1"',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Eingang 1"',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: '3-Wege-Umschaltventil 1" inkl. Stellmotor (HZ / WW)',
    category: 'fitting',
    componentType: 'three_way_valve',
    isActive: true,
    articleNumber: 'VALVE-3WAY-1Z',
    supplierLink: '',
    price: 149.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'ab', label: 'AB Eingang von WP (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'a', label: 'A Heizkreis Vorlauf (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'b', label: 'B Warmwasser-Speicher (1")', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'right' },
      { id: 'm', label: 'Stellmotor 230V', medium: 'electric', fixedDimension: '3x1.5', side: 'left' },
    ],
  },
  {
    name: 'Differenzdruck-Überströmventil 3/4" (zwischen VL & RL)',
    category: 'fitting',
    componentType: 'diff_pressure_valve',
    isActive: true,
    articleNumber: 'DIFF-UEV-34',
    supplierLink: '',
    price: 68.0,
    isMultiPort: false,
    leftLabel: 'Vom Vorlauf',
    leftMedium: 'water',
    leftDim: '3/4_Zoll_IG',
    rightLabel: 'In den Rücklauf',
    rightMedium: 'water',
    rightDim: '3/4_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Heizungs-Befüllstation (Systemtrenner BA + Entsalzung VDI 2035)',
    category: 'fitting',
    componentType: 'filling_station',
    isActive: true,
    articleNumber: 'FILL-VDI2035',
    supplierLink: '',
    price: 329.0,
    isMultiPort: false,
    leftLabel: 'Trinkwasser 3/4"',
    leftMedium: 'water',
    leftDim: '3/4_Zoll_IG',
    rightLabel: 'Anschluss Rücklauf 3/4"',
    rightMedium: 'water',
    rightDim: '3/4_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'MAG Heizung 25L inkl. Kappenventil',
    category: 'fitting',
    componentType: 'mag_heating',
    volumeL: 25,
    isActive: true,
    articleNumber: 'MAG-HEIZ-25L',
    supplierLink: '',
    price: 98.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Anschluss Rücklauf (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' }],
  },
  {
    name: 'MAG Heizung 35L inkl. Kappenventil',
    category: 'fitting',
    componentType: 'mag_heating',
    volumeL: 35,
    isActive: true,
    articleNumber: 'MAG-HEIZ-35L',
    supplierLink: '',
    price: 118.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Anschluss Rücklauf (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' }],
  },
  {
    name: 'MAG Heizung 50L inkl. Kappenventil',
    category: 'fitting',
    componentType: 'mag_heating',
    volumeL: 50,
    isActive: true,
    articleNumber: 'MAG-HEIZ-50L',
    supplierLink: '',
    price: 154.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Anschluss Rücklauf (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' }],
  },
  {
    name: 'MAG Sanitär / Brauchwasser 12L (durchströmt, DVGW)',
    category: 'fitting',
    componentType: 'mag_dhw',
    volumeL: 12,
    isActive: true,
    articleNumber: 'MAG-TW-12L',
    supplierLink: '',
    price: 119.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Anschluss Kaltwasser (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' }],
  },
  {
    name: 'MAG Sanitär / Brauchwasser 18L (durchströmt, DVGW)',
    category: 'fitting',
    componentType: 'mag_dhw',
    volumeL: 18,
    isActive: true,
    articleNumber: 'MAG-TW-18L',
    supplierLink: '',
    price: 145.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Anschluss Kaltwasser (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' }],
  },
  {
    name: 'MAG Sanitär / Brauchwasser 25L (durchströmt, DVGW)',
    category: 'fitting',
    componentType: 'mag_dhw',
    volumeL: 25,
    isActive: true,
    articleNumber: 'MAG-TW-25L',
    supplierLink: '',
    price: 169.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Anschluss Kaltwasser (3/4")', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'left' }],
  },
  {
    name: 'Heizkreis-Pumpengruppe / Heizkreisverteiler',
    category: 'fitting',
    componentType: 'pump_group',
    isActive: true,
    articleNumber: 'HK-PUMP-MIX-2',
    supplierLink: '',
    price: 465.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'vl', label: 'Heizkreis Vorlauf (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'rl', label: 'Heizkreis Rücklauf (1" IG)', medium: 'water', fixedDimension: '1_Zoll_IG', side: 'left' },
      { id: 'el', label: 'Netzanschluss Pumpe 230V', medium: 'electric', fixedDimension: '3x1.5', side: 'left' },
    ],
  },
  {
    name: 'Trinkwasser-Rückspülfilter mit Druckminderer 3/4"',
    category: 'fitting',
    componentType: 'water_filter',
    isActive: true,
    articleNumber: 'TW-FILT-34',
    supplierLink: '',
    price: 215.0,
    isMultiPort: false,
    leftLabel: 'Stadtwasser',
    leftMedium: 'water',
    leftDim: '3/4_Zoll_IG',
    rightLabel: 'Gefiltert',
    rightMedium: 'water',
    rightDim: '3/4_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Sicherheitsgruppe / Überdruckventil 6 bar (Brauchwasser)',
    category: 'fitting',
    componentType: 'safety_group',
    isActive: true,
    articleNumber: 'TW-SAFE-6BAR',
    supplierLink: '',
    price: 119.0,
    isMultiPort: false,
    leftLabel: 'Kaltwasser Ein',
    leftMedium: 'water',
    leftDim: '3/4_Zoll_IG',
    rightLabel: 'Zum Speicher',
    rightMedium: 'water',
    rightDim: '3/4_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Kondensat-Abflussgarnitur mit Trichtersiphon',
    category: 'fitting',
    componentType: 'condensate_drain',
    isActive: true,
    articleNumber: 'KONDENS-SIPHON',
    supplierLink: '',
    price: 42.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'in', label: 'Kondensateinlauf', medium: 'water', fixedDimension: '3/4_Zoll_IG', side: 'right' }],
  },
  {
    name: 'Bigfoot Bodenkonsole / Gummidämpfer-Set (600mm)',
    category: 'mounting',
    componentType: 'mount_ground',
    isActive: true,
    articleNumber: 'MOUNT-BIGFOOT-600',
    supplierLink: '',
    price: 149.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Fertig-Betonfundament Set (2x Blockstein für WP)',
    category: 'mounting',
    componentType: 'mount_foundation',
    isActive: true,
    articleNumber: 'MOUNT-BETON-SET',
    supplierLink: '',
    price: 229.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Schwerlast-Wandkonsole inkl. Schwingungsdämpfern',
    category: 'mounting',
    componentType: 'mount_wall',
    isActive: true,
    articleNumber: 'MOUNT-WAND-HD',
    supplierLink: '',
    price: 135.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'IP65 Feuchtraum-Unterverteilung 2-reihig (24 TE für WP)',
    category: 'electric',
    componentType: 'sub_distribution',
    isActive: true,
    articleNumber: 'UV-IP65-2R',
    supplierLink: '',
    price: 89.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'in', label: 'Zuleitung Hauptverteilung', medium: 'electric', fixedDimension: '5x6.0', side: 'left' },
      { id: 'out', label: 'Abgang zu Einzelsicherungen', medium: 'electric', fixedDimension: '5x4.0', side: 'right' },
    ],
  },
  {
    name: 'IP65 Feuchtraum-Unterverteilung 1-reihig (12 TE für BWWP)',
    category: 'electric',
    componentType: 'sub_distribution_1r',
    isActive: true,
    articleNumber: 'UV-IP65-1R',
    supplierLink: '',
    price: 49.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'in', label: 'Zuleitung', medium: 'electric', fixedDimension: '3x2.5', side: 'left' },
      { id: 'out', label: 'Abgang', medium: 'electric', fixedDimension: '3x2.5', side: 'right' },
    ],
  },
  {
    name: 'FI-Schutzschalter Typ B (Allstromsensitiv 40A/30mA)',
    category: 'electric',
    componentType: 'rcd_fi',
    isActive: true,
    articleNumber: 'FI-TYP-B-40A',
    supplierLink: '',
    price: 289.0,
    isMultiPort: false,
    leftLabel: 'Zugang',
    leftMedium: 'electric',
    leftDim: '5x4.0',
    rightLabel: 'Abgang',
    rightMedium: 'electric',
    rightDim: '5x2.5',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'FI-Schutzschalter Typ A (Standard 40A/30mA)',
    category: 'electric',
    componentType: 'rcd_fi',
    isActive: true,
    articleNumber: 'FI-TYP-A-40A',
    supplierLink: '',
    price: 44.0,
    isMultiPort: false,
    leftLabel: 'Zugang',
    leftMedium: 'electric',
    leftDim: '3x2.5',
    rightLabel: 'Abgang',
    rightMedium: 'electric',
    rightDim: '3x2.5',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Überspannungsschutz Kombiableiter Typ 1+2',
    category: 'electric',
    componentType: 'surge_protector',
    isActive: true,
    articleNumber: 'SPD-TYP12-HAGER',
    supplierLink: '',
    price: 195.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'p', label: 'Netzschutz', medium: 'electric', fixedDimension: '5x4.0', side: 'right' }],
  },
  {
    name: 'LS-Schalter B16A 1-polig (230V)',
    category: 'electric',
    componentType: 'breaker_ls',
    isActive: true,
    articleNumber: 'LS-B16-1P',
    supplierLink: '',
    price: 6.5,
    isMultiPort: false,
    leftLabel: 'Eingang',
    leftMedium: 'electric',
    leftDim: '3x2.5',
    rightLabel: 'Verbraucher',
    rightMedium: 'electric',
    rightDim: '3x2.5',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'LS-Schalter B16A 3-polig (400V)',
    category: 'electric',
    componentType: 'breaker_ls',
    isActive: true,
    articleNumber: 'LS-B16-3P',
    supplierLink: '',
    price: 24.9,
    isMultiPort: false,
    leftLabel: 'Eingang',
    leftMedium: 'electric',
    leftDim: '5x2.5',
    rightLabel: 'Verbraucher',
    rightMedium: 'electric',
    rightDim: '5x2.5',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Einschraub-Heizstab 3,0 kW für externen WW-Speicher',
    category: 'electric',
    componentType: 'heating_rod',
    isActive: true,
    articleNumber: 'HEIZSTAB-WW-3KW',
    supplierLink: '',
    price: 169.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'el', label: 'Anschluss 230V', medium: 'electric', fixedDimension: '3x2.5', side: 'left' },
      { id: 'el_tank', label: 'Einbau im Speicher', medium: 'electric', side: 'right' },
    ],
  },
  {
    name: 'Panasonic Zusatz-Gehäuse-/Bodenwannenheizung (Frostschutz)',
    category: 'electric',
    componentType: 'chassis_heater',
    manufacturer: 'Panasonic',
    isActive: true,
    articleNumber: 'CZ-NE3P',
    supplierLink: '',
    price: 139.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'el', label: 'Anschluss im Außengerät', medium: 'electric', fixedDimension: '3x1.5', side: 'left' }],
  },
  {
    name: 'Panasonic Zusatzplatine CZ-NS4P / CZ-NS5P (Erweiterung)',
    category: 'electric',
    componentType: 'pcb_extension',
    manufacturer: 'Panasonic',
    isActive: true,
    articleNumber: 'CZ-NS5P',
    supplierLink: '',
    price: 249.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'bus', label: 'Systembus WP', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' }],
  },
  {
    name: 'Panasonic Aquarea Smart Cloud Modul (LAN/WLAN)',
    category: 'electric',
    componentType: 'network_module',
    manufacturer: 'Panasonic',
    isActive: true,
    articleNumber: 'CZ-TAW1B',
    supplierLink: '',
    price: 175.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 'bus', label: 'CN-CNT Anschluss', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' }],
  },
  {
    name: 'Temperatursensor Innen / Puffer / Warmwasserspeicher',
    category: 'electric',
    componentType: 'sensor_indoor',
    isActive: true,
    articleNumber: 'PAW-A2W-TSBU',
    supplierLink: '',
    price: 49.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 's', label: 'Fühlerleitung', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' },
      { id: 'mount', label: 'Messstelle (Tauchhülse)', medium: 'electric', side: 'right' },
    ],
  },
  {
    name: 'Außentemperaturfühler (Witterungsführung)',
    category: 'electric',
    componentType: 'sensor_outdoor',
    isActive: true,
    articleNumber: 'PAW-A2W-TSOD',
    supplierLink: '',
    price: 45.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [{ id: 's', label: 'Fühlerleitung', medium: 'electric', fixedDimension: 'Bus 2x2x0.8', side: 'left' }],
  },
  {
    name: 'EPP-Dämmschale für Schlamm- & Magnetitabscheider 1"',
    category: 'insulation',
    componentType: 'insulation_part',
    linkedArticleNumber: 'FILT-MAG-1Z',
    isActive: true,
    articleNumber: 'ISO-FILT-MAG-1Z',
    supplierLink: '',
    price: 29.5,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'EPP-Dämmschale für Mikroblasenabscheider 1"',
    category: 'insulation',
    componentType: 'insulation_part',
    linkedArticleNumber: 'MIKRO-SEP-1Z',
    isActive: true,
    articleNumber: 'ISO-MIKRO-1Z',
    supplierLink: '',
    price: 26.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'EPP-Dämmschale für Grobpartikelfilter 1"',
    category: 'insulation',
    componentType: 'insulation_part',
    linkedArticleNumber: 'FILT-GROB-1Z',
    isActive: true,
    articleNumber: 'ISO-GROB-1Z',
    supplierLink: '',
    price: 19.8,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'EPP-Dämmschale für 3-Wege-Umschaltventil 1"',
    category: 'insulation',
    componentType: 'insulation_part',
    linkedArticleNumber: 'VALVE-3WAY-1Z',
    isActive: true,
    articleNumber: 'ISO-3WAY-1Z',
    supplierLink: '',
    price: 22.0,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Kautschuk-Isolierung für Panzerschlauch DN32 (UV-geschützt)',
    category: 'insulation',
    componentType: 'insulation_part',
    linkedArticleNumber: 'FLEX-DN32-1M',
    isActive: true,
    articleNumber: 'ISO-FLEX-DN32',
    supplierLink: '',
    price: 18.5,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'GEG 100% Rohrdämmung Kautschuk/Alukaschiert (für Kupfer 22mm)',
    category: 'insulation',
    componentType: 'insulation_pipe',
    linkedPipeSystem: 'copper',
    linkedPipeDimension: '22mm',
    isActive: true,
    articleNumber: 'ISO-CU-22-100',
    supplierLink: '',
    price: 6.9,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'GEG 100% Rohrdämmung Kautschuk/Alukaschiert (für Kupfer 28mm)',
    category: 'insulation',
    componentType: 'insulation_pipe',
    linkedPipeSystem: 'copper',
    linkedPipeDimension: '28mm',
    isActive: true,
    articleNumber: 'ISO-CU-28-100',
    supplierLink: '',
    price: 8.5,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'GEG 100% Rohrdämmung Kautschuk/Alukaschiert (für Kupfer 35mm)',
    category: 'insulation',
    componentType: 'insulation_pipe',
    linkedPipeSystem: 'copper',
    linkedPipeDimension: '35mm',
    isActive: true,
    articleNumber: 'ISO-CU-35-100',
    supplierLink: '',
    price: 10.9,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'GEG 100% Rohrdämmung (für Alu-Verbund 20x2)',
    category: 'insulation',
    componentType: 'insulation_pipe',
    linkedPipeSystem: 'alu',
    linkedPipeDimension: '20x2',
    isActive: true,
    articleNumber: 'ISO-ALU-20-100',
    supplierLink: '',
    price: 6.2,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'GEG 100% Rohrdämmung (für Alu-Verbund 26x3)',
    category: 'insulation',
    componentType: 'insulation_pipe',
    linkedPipeSystem: 'alu',
    linkedPipeDimension: '26x3',
    isActive: true,
    articleNumber: 'ISO-ALU-26-100',
    supplierLink: '',
    price: 7.9,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'GEG 100% Rohrdämmung (für Alu-Verbund 32x3)',
    category: 'insulation',
    componentType: 'insulation_pipe',
    linkedPipeSystem: 'alu',
    linkedPipeDimension: '32x3',
    isActive: true,
    articleNumber: 'ISO-ALU-32-100',
    supplierLink: '',
    price: 9.8,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Kupferbogen 90° (Press)',
    category: 'fitting',
    componentType: 'elbow_90',
    lineSystem: 'copper',
    isActive: true,
    articleNumber: 'CU-BOGEN-VAR',
    supplierLink: '',
    price: 6.8,
    isMultiPort: false,
    leftLabel: 'Eingang',
    leftMedium: 'water',
    rightLabel: 'Ausgang',
    rightMedium: 'water',
    isDynamicSize: true,
    ports: [],
    variants: [
      { dimension: '15mm', articleNumber: 'CU-90-15', price: 2.9 },
      { dimension: '18mm', articleNumber: 'CU-90-18', price: 3.6 },
      { dimension: '22mm', articleNumber: 'CU-90-22', price: 4.5 },
      { dimension: '28mm', articleNumber: 'CU-90-28', price: 6.8 },
      { dimension: '35mm', articleNumber: 'CU-90-35', price: 12.4 },
    ],
  },
  {
    name: 'Alu-Verbund Presswinkel 90°',
    category: 'fitting',
    componentType: 'elbow_90',
    lineSystem: 'alu',
    isActive: true,
    articleNumber: 'ALU-WINKEL-VAR',
    supplierLink: '',
    price: 8.9,
    isMultiPort: false,
    leftLabel: 'Eingang',
    leftMedium: 'water',
    rightLabel: 'Ausgang',
    rightMedium: 'water',
    isDynamicSize: true,
    ports: [],
    variants: [
      { dimension: '16x2', articleNumber: 'ALU-90-16', price: 5.2 },
      { dimension: '20x2', articleNumber: 'ALU-90-20', price: 6.9 },
      { dimension: '26x3', articleNumber: 'ALU-90-26', price: 8.9 },
      { dimension: '32x3', articleNumber: 'ALU-90-32', price: 14.5 },
    ],
  },
  {
    name: 'Übergang Kupfer auf Außengewinde',
    category: 'adapter',
    componentType: 'adapter_transition',
    lineSystem: 'copper',
    isActive: true,
    articleNumber: 'ADAPT-CU-AG',
    supplierLink: '',
    price: 15.0,
    isMultiPort: false,
    isDynamicSize: true,
    ports: [],
    variants: [
      { dimension: '22mm_to_3/4_Zoll_IG', articleNumber: 'CU-AD-22-34Z', price: 12.5 },
      { dimension: '22mm_to_1_Zoll_IG', articleNumber: 'CU-AD-22-1Z', price: 14.2 },
      { dimension: '28mm_to_3/4_Zoll_IG', articleNumber: 'CU-AD-28-34Z', price: 14.5 },
      { dimension: '28mm_to_1_Zoll_IG', articleNumber: 'CU-AD-28-1Z', price: 16.2 },
      { dimension: '28mm_to_1_1/4_Zoll_IG', articleNumber: 'CU-AD-28-114Z', price: 19.8 },
    ],
  },
  {
    name: 'Übergang Alu-Verbund auf Außengewinde',
    category: 'adapter',
    componentType: 'adapter_transition',
    lineSystem: 'alu',
    isActive: true,
    articleNumber: 'ADAPT-ALU-AG',
    supplierLink: '',
    price: 16.5,
    isMultiPort: false,
    isDynamicSize: true,
    ports: [],
    variants: [
      { dimension: '20x2_to_3/4_Zoll_IG', articleNumber: 'ALU-AD-20-34Z', price: 11.9 },
      { dimension: '20x2_to_1_Zoll_IG', articleNumber: 'ALU-AD-20-1Z', price: 13.5 },
      { dimension: '26x3_to_3/4_Zoll_IG', articleNumber: 'ALU-AD-26-34Z', price: 15.2 },
      { dimension: '26x3_to_1_Zoll_IG', articleNumber: 'ALU-AD-26-1Z', price: 16.8 },
      { dimension: '26x3_to_1_1/4_Zoll_IG', articleNumber: 'ALU-AD-26-114Z', price: 21.4 },
      { dimension: '32x3_to_1_Zoll_IG', articleNumber: 'ALU-AD-32-1Z', price: 19.9 },
      { dimension: '32x3_to_1_1/4_Zoll_IG', articleNumber: 'ALU-AD-32-114Z', price: 24.9 },
    ],
  },
];

/** Artikelnummer eines Rohrartikels je System und Dimension. */
export function pipeArticleNumber(sys: LineSystem, dim: string): string {
  return `ROHR-${sys.toUpperCase()}-${dim.replace(/[^a-zA-Z0-9]/g, '')}`;
}

function buildPipeItems(): CatalogItem[] {
  return (Object.keys(LINE_SYSTEM_CONFIG) as LineSystem[]).map((sys) => {
    const cfg = LINE_SYSTEM_CONFIG[sys];
    return {
      name: cfg.label,
      category: 'pipe',
      componentType: 'pipe_article',
      lineSystem: sys,
      isActive: true,
      articleNumber: `ROHR-${sys.toUpperCase()}`,
      supplierLink: '',
      price: 0,
      isMultiPort: true,
      isDynamicSize: true,
      ports: [],
      variants: cfg.dimensions.map((dimension) => ({
        dimension,
        articleNumber: pipeArticleNumber(sys, dimension),
        price: cfg.meterPrices[dimension] ?? 0,
      })),
    };
  });
}

function buildTeeItem(sys: 'copper' | 'alu', name: string, prefix: string, prices: number[]): CatalogItem {
  return {
    name,
    category: 'fitting',
    componentType: 'tee_piece',
    lineSystem: sys,
    isActive: true,
    articleNumber: `${prefix}-VAR`,
    supplierLink: '',
    price: prices[0],
    isMultiPort: true,
    isDynamicSize: true,
    ports: [
      { id: 'a', label: 'Durchgang', medium: 'water', side: 'left' },
      { id: 'b', label: 'Durchgang', medium: 'water', side: 'right' },
      { id: 'c', label: 'Abzweig', medium: 'water', side: 'right' },
    ],
    variants: LINE_SYSTEM_CONFIG[sys].dimensions.map((dimension, idx) => ({
      dimension,
      articleNumber: `${prefix}-${dimension.replace(/[^a-zA-Z0-9]/g, '')}`,
      price: prices[idx] ?? prices[prices.length - 1],
    })),
  };
}

function numberedPorts(count: number, label: string): PortDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `out_${i + 1}`,
    label: `${label} ${i + 1}`,
    medium: 'electric' as const,
    side: 'right' as const,
  }));
}

/** Seit Katalogstand 9 neu hinzugekommene Standardartikel. */
const ITEMS_SINCE_V9: CatalogItem[] = [
  {
    name: 'Frostschutzventil 1" (am Außengerät)',
    category: 'fitting',
    componentType: 'frost_valve',
    isActive: true,
    articleNumber: 'FROST-VALVE-1Z',
    supplierLink: '',
    price: 89.5,
    isMultiPort: false,
    leftLabel: 'WP-Seite 1"',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Rohr-Seite 1"',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Panzerschlauch 1" (1000mm schwingungsentkoppelt)',
    category: 'fitting',
    componentType: 'flex_hose',
    lineSystem: 'hose',
    isActive: true,
    articleNumber: 'FLEX-DN25-1M',
    supplierLink: '',
    price: 55.0,
    isMultiPort: false,
    leftLabel: 'Außengerät / Frostventil',
    leftMedium: 'water',
    leftDim: '1_Zoll_IG',
    rightLabel: 'Übergang Hausrohr',
    rightMedium: 'water',
    rightDim: '1_Zoll_IG',
    isDynamicSize: false,
    ports: [],
  },
  {
    name: 'Kautschuk-Isolierung für Panzerschlauch DN25 (UV-geschützt)',
    category: 'insulation',
    componentType: 'insulation_part',
    linkedArticleNumber: 'FLEX-DN25-1M',
    isActive: true,
    articleNumber: 'ISO-FLEX-DN25',
    supplierLink: '',
    price: 15.5,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [],
  },
  ...buildPipeItems(),
  buildTeeItem('copper', 'T-Stück Kupfer (Press)', 'CU-T', [6.5, 7.9, 9.5, 12.9, 21.5, 34.0]),
  buildTeeItem('alu', 'T-Stück Alu-Verbund (Press)', 'ALU-T', [7.9, 9.9, 14.5, 22.9, 39.0]),
  {
    name: 'Phasenschiene / Sammelschiene (Unterverteilung)',
    category: 'electric',
    componentType: 'busbar',
    isActive: true,
    articleNumber: 'PHASENSCHIENE-6',
    supplierLink: '',
    price: 9.9,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'in', label: 'Einspeisung', medium: 'electric', side: 'left' },
      ...numberedPorts(6, 'Abgang'),
    ],
  },
  {
    name: 'Anschlussklemmen Steuerleitung (Abzweigdose)',
    category: 'electric',
    componentType: 'control_terminal',
    isActive: true,
    articleNumber: 'KLEMMEN-STEUER-10',
    supplierLink: '',
    price: 12.5,
    isMultiPort: true,
    isDynamicSize: false,
    ports: [
      { id: 'in', label: 'Von Regelung (Bus)', medium: 'electric', side: 'left' },
      ...numberedPorts(10, 'Klemme'),
    ],
  },
];

DEFAULT_ITEMS.push(...ITEMS_SINCE_V9);

// Rohrdämmung hängt jetzt an den Rohrartikeln aus dem Katalog.
for (const item of DEFAULT_ITEMS) {
  if (item.linkedPipeSystem && item.linkedPipeDimension && !item.linkedArticleNumber) {
    item.linkedArticleNumber = pipeArticleNumber(item.linkedPipeSystem, item.linkedPipeDimension);
  }
}

/** Rohrartikel + Variante für System und Dimension (falls im Katalog vorhanden). */
export function findPipeArticle(catalog: CatalogItem[], sys: LineSystem, dim: string) {
  const item = catalog.find((c) => c.category === 'pipe' && c.lineSystem === sys);
  return { item, variant: item?.variants?.find((v) => v.dimension === dim) };
}

/** Passende Dämmung für einen Artikel; ältere Einträge nutzen noch System + Dimension. */
export function findInsulationForArticle(
  catalog: CatalogItem[],
  articleNumber: string | undefined,
  pipe?: { sys: LineSystem; dim: string }
): CatalogItem | undefined {
  const active = catalog.filter((c) => c.isActive !== false && c.category === 'insulation');
  const byArticle = articleNumber
    ? active.find((c) => c.linkedArticleNumber === articleNumber)
    : undefined;
  if (byArticle || !pipe) return byArticle;
  return active.find(
    (c) => !c.linkedArticleNumber && c.linkedPipeSystem === pipe.sys && c.linkedPipeDimension === pipe.dim
  );
}

const SEED_VERSION_KEY = 'wp_planer_seed_v11_loaded';
const PREVIOUS_SEED_VERSION_KEYS = ['wp_planer_seed_v9_loaded', 'wp_planer_seed_v10_loaded'];

async function removeDuplicateArticles() {
  const existing = await db.catalog.toArray();
  const seen = new Set<string>();
  const duplicateIds: number[] = [];
  for (const item of existing) {
    const key = (item.articleNumber || item.name).trim().toLowerCase();
    if (seen.has(key) && item.id) duplicateIds.push(item.id);
    else seen.add(key);
  }
  if (duplicateIds.length > 0) await db.catalog.bulkDelete(duplicateIds);
}

async function runSeed() {
  await removeDuplicateArticles();

  const existing = await db.catalog.toArray();
  const alreadySeeded = localStorage.getItem(SEED_VERSION_KEY);
  if (alreadySeeded && existing.length > 0) return;

  // Beim Update nur neue Artikel ergänzen, damit gelöschte Standardteile nicht zurückkehren.
  const isUpdateFromV9 = existing.length > 0 && PREVIOUS_SEED_VERSION_KEYS.some((key) => localStorage.getItem(key));
  const itemsToAdd = isUpdateFromV9 ? ITEMS_SINCE_V9 : DEFAULT_ITEMS;

  for (const def of itemsToAdd) {
    const found = existing.find((ex) => ex.articleNumber.toLowerCase() === def.articleNumber.toLowerCase());
    if (!found) await db.catalog.add(def);
  }

  // Bestehende Standardartikel ergänzen, ohne eigene Änderungen zu überschreiben.
  for (const def of DEFAULT_ITEMS) {
    const found = existing.find((ex) => ex.articleNumber.toLowerCase() === def.articleNumber.toLowerCase());
    if (!found?.id) continue;
    const changes: Partial<CatalogItem> = {};
    if (def.linkedArticleNumber && !found.linkedArticleNumber) {
      changes.linkedArticleNumber = def.linkedArticleNumber;
    }
    if (def.isMultiPort && found.ports) {
      const missing = def.ports.filter((p) => !found.ports.some((fp) => fp.id === p.id));
      if (missing.length > 0) changes.ports = [...found.ports, ...missing];
    }
    if (Object.keys(changes).length > 0) await db.catalog.update(found.id, changes);
  }

  localStorage.setItem(SEED_VERSION_KEY, 'true');
}

let seedPromise: Promise<void> | null = null;

/** Läuft pro Seitenaufruf nur einmal; parallele Läufe erzeugten sonst doppelte Artikel. */
export function seedInitialCatalog(): Promise<void> {
  seedPromise ??= runSeed();
  return seedPromise;
}

export async function resetCatalogToDefaults() {
  await db.catalog.clear();
  await db.catalog.bulkAdd(DEFAULT_ITEMS);
  localStorage.setItem(SEED_VERSION_KEY, 'true');
}

export { db };