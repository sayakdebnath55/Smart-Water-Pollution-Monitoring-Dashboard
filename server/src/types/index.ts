export type ParameterCode =
  | 'ph'
  | 'turbidity'
  | 'dissolved_oxygen'
  | 'tds'
  | 'temperature'
  | 'conductivity'
  | 'nitrate'
  | 'phosphate'
  | 'ammonia'
  | 'bod';

export type DataSourceType =
  | 'continuous_iot_probe'
  | 'specialized_analyzer'
  | 'lab_manual_sample';

export type ReadingDataSource =
  | 'DEMO_SIMULATION'
  | 'IOT_HTTP_INGEST'
  | 'LAB_MANUAL'
  | 'HISTORICAL_SEED';

export type QualityStatus = 'normal' | 'warning' | 'critical' | 'fault';

export type StationOverallStatus = 'normal' | 'warning' | 'critical' | 'offline';
export type ConnectivityStatus = 'online' | 'offline';

export type AlertSeverity = 'warning' | 'critical';
export type AlertType = 'threshold_violation' | 'station_offline' | 'sensor_fault';

export interface ParameterMetadata {
  code: ParameterCode;
  name: string;
  shortName: string;
  unit: string;
  description: string;
  environmentalSignificance: string;
  defaultSourceType: DataSourceType;
  defaultSensorModel: string;
  minAllowedValue: number;
  maxAllowedValue: number;
  defaultBaseline: number;
  defaultVariation: number;
  precision: number;
  thresholdType: 'two_sided' | 'upper_only' | 'lower_only';
  defaultThresholds: {
    min_warning: number | null;
    max_warning: number | null;
    min_critical: number | null;
    max_critical: number | null;
    benchmark_authority: string;
    water_use_category: string;
    jurisdiction: string;
    reference_source: string;
    notes: string;
  };
}

export const WATER_PARAMETERS: Record<ParameterCode, ParameterMetadata> = {
  ph: {
    code: 'ph',
    name: 'pH Level',
    shortName: 'pH',
    unit: 'pH units',
    description: 'Logarithmic measure of hydrogen ion concentration indicating acidity or alkalinity.',
    environmentalSignificance:
      'Extreme pH values (< 6.0 or > 9.0) increase toxicity of ammonia and heavy metals and stress aquatic biota.',
    defaultSourceType: 'continuous_iot_probe',
    defaultSensorModel: 'AquaSense Pro Glass-Electrode pH-420',
    minAllowedValue: 0,
    maxAllowedValue: 14,
    defaultBaseline: 7.35,
    defaultVariation: 0.25,
    precision: 2,
    thresholdType: 'two_sided',
    defaultThresholds: {
      min_warning: 6.5,
      max_warning: 8.5,
      min_critical: 6.0,
      max_critical: 9.0,
      benchmark_authority: 'US EPA / WHO Surface Water Reference',
      water_use_category: 'Freshwater Aquatic Life & Raw Intake Screening',
      jurisdiction: 'International / Federal Demonstration Reference',
      reference_source: 'US EPA Gold Book / WHO Guidelines for Drinking-water Quality (Screening)',
      notes: 'Two-sided operational range. Both acidic (<6.5) and alkaline (>8.5) excursions require review.',
    },
  },
  turbidity: {
    code: 'turbidity',
    name: 'Turbidity',
    shortName: 'Turbidity',
    unit: 'NTU',
    description: 'Optical measurement of water cloudiness caused by suspended silt, clay, organic matter, and microbes.',
    environmentalSignificance:
      'High turbidity blocks light penetration for aquatic plants and shields pathogens from disinfection.',
    defaultSourceType: 'continuous_iot_probe',
    defaultSensorModel: 'OptiClear ISO-7027 Nephelometer',
    minAllowedValue: 0,
    maxAllowedValue: 1000,
    defaultBaseline: 2.4,
    defaultVariation: 0.9,
    precision: 2,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 5.0,
      min_critical: null,
      max_critical: 15.0,
      benchmark_authority: 'US EPA / ISO 7027 Operational Benchmark',
      water_use_category: 'Surface Water & Treatment Intake Screening',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA Ambient Water Quality Criteria Recommendations',
      notes: 'Upper-bound threshold. Spikes often indicate stormwater runoff, erosion, or industrial discharge.',
    },
  },
  dissolved_oxygen: {
    code: 'dissolved_oxygen',
    name: 'Dissolved Oxygen (DO)',
    shortName: 'Dissolved O₂',
    unit: 'mg/L',
    description: 'Concentration of free, non-compound oxygen dissolved in water available for fish and aerobic bacteria.',
    environmentalSignificance:
      'Depleted DO (< 5.0 mg/L) causes hypoxia; levels below 3.5 mg/L can trigger fish kills and anaerobic odors.',
    defaultSourceType: 'continuous_iot_probe',
    defaultSensorModel: 'LumiDO Optical Fluorescence Sensor',
    minAllowedValue: 0,
    maxAllowedValue: 25,
    defaultBaseline: 8.2,
    defaultVariation: 0.6,
    precision: 2,
    thresholdType: 'lower_only',
    defaultThresholds: {
      min_warning: 5.5,
      max_warning: null,
      min_critical: 4.0,
      max_critical: null,
      benchmark_authority: 'US EPA Aquatic Life Criteria',
      water_use_category: 'Warm/Coldwater Fishery Protection',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA 440/5-86-003 Ambient Water Quality Criteria for Dissolved Oxygen',
      notes: 'Lower-bound threshold: lower values indicate worse water quality (oxygen depletion).',
    },
  },
  tds: {
    code: 'tds',
    name: 'Total Dissolved Solids (TDS)',
    shortName: 'TDS',
    unit: 'mg/L',
    description: 'Combined content of all inorganic salts (calcium, magnesium, potassium, sodium, chlorides) and small organics.',
    environmentalSignificance:
      'Elevated TDS indicates mineral leaching, agricultural return flow, road-salt runoff, or industrial brine.',
    defaultSourceType: 'continuous_iot_probe',
    defaultSensorModel: 'CondSense TDS-800 Multiparameter Sonde',
    minAllowedValue: 0,
    maxAllowedValue: 10000,
    defaultBaseline: 245,
    defaultVariation: 25,
    precision: 1,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 500,
      min_critical: null,
      max_critical: 1000,
      benchmark_authority: 'US EPA Secondary / WHO Aesthetic Benchmark',
      water_use_category: 'Freshwater Intake & General Watershed Screening',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA National Secondary Drinking Water Regulations (SMCL Screening)',
      notes: 'Operational screening boundary for dissolved mineral load.',
    },
  },
  temperature: {
    code: 'temperature',
    name: 'Water Temperature',
    shortName: 'Temperature',
    unit: '°C',
    description: 'Thermal state of the water column influencing dissolved oxygen solubility, metabolic rates, and chemical kinetics.',
    environmentalSignificance:
      'Thermal pollution from cooling water outfalls or urban runoff reduces oxygen capacity and disrupts aquatic life cycles.',
    defaultSourceType: 'continuous_iot_probe',
    defaultSensorModel: 'PT1000 Titanium Thermistor Probe',
    minAllowedValue: -5,
    maxAllowedValue: 60,
    defaultBaseline: 18.5,
    defaultVariation: 1.2,
    precision: 1,
    thresholdType: 'two_sided',
    defaultThresholds: {
      min_warning: 2.0,
      max_warning: 26.0,
      min_critical: 0.5,
      max_critical: 31.0,
      benchmark_authority: 'Regional Watershed Thermal Management Guideline',
      water_use_category: 'Temperate Surface Water & Thermal Outfall Monitoring',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'CWA Section 316(a) Thermal Effluent Screening Reference',
      notes: 'Monitors both freezing risk at intakes and thermal discharge plumes.',
    },
  },
  conductivity: {
    code: 'conductivity',
    name: 'Electrical Conductivity (EC)',
    shortName: 'Conductivity',
    unit: 'µS/cm',
    description: 'Ability of water to pass an electrical current, directly proportional to ionic concentration.',
    environmentalSignificance:
      'Rapid shifts in conductivity serve as an early indicator of chemical spills, illicit discharges, or wastewater bypass.',
    defaultSourceType: 'continuous_iot_probe',
    defaultSensorModel: 'TetraCon 4-Electrode Graphite Cell',
    minAllowedValue: 0,
    maxAllowedValue: 20000,
    defaultBaseline: 410,
    defaultVariation: 40,
    precision: 0,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 800,
      min_critical: null,
      max_critical: 1500,
      benchmark_authority: 'US EPA / European Surface Water Screening',
      water_use_category: 'Freshwater Stream & Industrial Outfall Monitoring',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA Field Operations Manual for Wadeable Streams',
      notes: 'Baseline freshwater streams typically range 150–600 µS/cm.',
    },
  },
  nitrate: {
    code: 'nitrate',
    name: 'Nitrate (NO₃⁻-N)',
    shortName: 'Nitrate',
    unit: 'mg/L',
    description: 'Oxidized nitrogen nutrient measured via UV spectral absorption or ion-selective analyzer.',
    environmentalSignificance:
      'Excess nitrate from fertilizer runoff or wastewater effluent drives eutrophication and harmful algal blooms.',
    defaultSourceType: 'specialized_analyzer',
    defaultSensorModel: 'SpectraUV NO3 Optical Nitrate Analyzer',
    minAllowedValue: 0,
    maxAllowedValue: 200,
    defaultBaseline: 2.8,
    defaultVariation: 0.7,
    precision: 2,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 8.0,
      min_critical: null,
      max_critical: 15.0,
      benchmark_authority: 'US EPA / WHO Nitrogen Screening Benchmark',
      water_use_category: 'Raw Surface Water & Nutrient Management',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA Nutrient Criteria Technical Guidance Manual: Rivers and Streams',
      notes: 'Measured by specialized UV analyzer or scheduled laboratory grab sample.',
    },
  },
  phosphate: {
    code: 'phosphate',
    name: 'Phosphate (PO₄³⁻)',
    shortName: 'Phosphate',
    unit: 'mg/L',
    description: 'Dissolved reactive phosphorus measured by automated wet-chemistry analyzer or laboratory assay.',
    environmentalSignificance:
      'Limiting nutrient in most freshwater ecosystems; small increases accelerate algae growth and oxygen depletion.',
    defaultSourceType: 'specialized_analyzer',
    defaultSensorModel: 'ChemCycle Auto-Colorimetric PO4 Unit',
    minAllowedValue: 0,
    maxAllowedValue: 50,
    defaultBaseline: 0.06,
    defaultVariation: 0.03,
    precision: 3,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 0.15,
      min_critical: null,
      max_critical: 0.45,
      benchmark_authority: 'US EPA Ecoregional Nutrient Benchmark',
      water_use_category: 'Eutrophication Prevention & Effluent Control',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA Gold Book Phosphorus Guidance for Flowing Waters & Reservoirs',
      notes: 'Measured via automated colorimetric wet-chemistry cycle or manual lab analysis.',
    },
  },
  ammonia: {
    code: 'ammonia',
    name: 'Ammonia Nitrogen (NH₃-N)',
    shortName: 'Ammonia',
    unit: 'mg/L',
    description: 'Reduced nitrogen compound originating from raw sewage, livestock waste, or industrial chemical processes.',
    environmentalSignificance:
      'Acutely toxic to fish even at low concentrations, especially when water pH and temperature are elevated.',
    defaultSourceType: 'specialized_analyzer',
    defaultSensorModel: 'IonSelect NH4/NH3 Gas-Sensing Analyzer',
    minAllowedValue: 0,
    maxAllowedValue: 100,
    defaultBaseline: 0.18,
    defaultVariation: 0.08,
    precision: 2,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 0.6,
      min_critical: null,
      max_critical: 2.0,
      benchmark_authority: 'US EPA Aquatic Life Ambient Water Quality Criteria for Ammonia',
      water_use_category: 'Freshwater Aquatic Toxicity & Effluent Screening',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA-822-R-13-001 Aquatic Life Criteria for Ammonia (pH 7.5, 20°C baseline)',
      notes: 'Elevated ammonia strongly indicates untreated sewage or industrial nitrogen discharge.',
    },
  },
  bod: {
    code: 'bod',
    name: 'Biochemical Oxygen Demand (BOD₅)',
    shortName: 'BOD₅',
    unit: 'mg/L',
    description: 'Amount of dissolved oxygen required by aerobic microorganisms to decompose organic matter over 5 days at 20°C.',
    environmentalSignificance:
      'Primary indicator of organic pollution strength in wastewater effluent and downstream receiving waters.',
    defaultSourceType: 'lab_manual_sample',
    defaultSensorModel: 'Standard Methods 5210B Lab Assay / UV-Fluorescence Surrogate',
    minAllowedValue: 0,
    maxAllowedValue: 500,
    defaultBaseline: 2.2,
    defaultVariation: 0.8,
    precision: 2,
    thresholdType: 'upper_only',
    defaultThresholds: {
      min_warning: null,
      max_warning: 5.0,
      min_critical: null,
      max_critical: 12.0,
      benchmark_authority: 'Clean Water Act / HACH Environmental BOD Reference',
      water_use_category: 'Ambient Stream Health & WWTP Effluent Screening',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'APHA Standard Methods 5210 / Unpolluted vs Moderately Polluted Stream Index',
      notes: 'Typically derived from laboratory 5-day incubation or calibrated optical surrogate analyzer.',
    },
  },
};

export const ALL_PARAMETER_CODES: ParameterCode[] = Object.keys(WATER_PARAMETERS) as ParameterCode[];

export interface StationRecord {
  id: string;
  name: string;
  code: string;
  station_type: string;
  location_name: string;
  water_body: string;
  latitude: number;
  longitude: number;
  is_fictional_location: number;
  connectivity_status: ConnectivityStatus;
  overall_status: StationOverallStatus;
  wqi_score: number;
  firmware_version: string;
  sampling_interval_sec: number;
  description: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SensorCapabilityRecord {
  id: number;
  station_id: string;
  parameter: ParameterCode;
  unit: string;
  data_source_type: DataSourceType;
  sensor_model: string;
  is_enabled: number;
  baseline_value: number;
  variation_range: number;
}

export interface SensorReadingRecord {
  id: number;
  station_id: string;
  parameter: ParameterCode;
  value: number;
  unit: string;
  quality_status: QualityStatus;
  data_source: ReadingDataSource;
  is_simulated: number;
  recorded_at: string;
  created_at: string;
}

export interface ThresholdRuleRecord {
  id: number;
  station_id: string | null;
  parameter: ParameterCode;
  unit: string;
  min_warning: number | null;
  max_warning: number | null;
  min_critical: number | null;
  max_critical: number | null;
  enabled: number;
  benchmark_authority: string;
  water_use_category: string;
  jurisdiction: string;
  reference_source: string;
  notes: string;
  updated_at: string;
}

export interface AlertRecord {
  id: string;
  station_id: string;
  reading_id: number | null;
  alert_type: AlertType;
  parameter: ParameterCode | 'connectivity';
  measured_value: number | null;
  unit: string;
  triggered_threshold: string;
  threshold_direction: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  is_simulated: number;
  is_read: number;
  acknowledged: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved: number;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  dedup_key: string;
  occurrence_count: number;
  created_at: string;
  updated_at: string;
  station_name?: string;
  water_body?: string;
  location_name?: string;
}

export interface AlertEventRecord {
  id: number;
  alert_id: string;
  event_type: 'created' | 'acknowledged' | 'resolved' | 'reopened' | 'escalated' | 'note_added';
  actor: string;
  notes: string;
  created_at: string;
}

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'admin' | 'operator';
  created_at: string;
  last_login_at: string | null;
}
