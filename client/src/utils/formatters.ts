import {
  DataSourceType,
  ParameterCode,
  ParameterMetadata,
  ReadingDataSource,
} from '../types/index';

export const PARAMETER_METADATA: Record<ParameterCode, ParameterMetadata> = {
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
      reference_source: 'US EPA Gold Book / WHO Guidelines for Drinking-water Quality',
      notes: 'Two-sided operational range (6.5–8.5 pH units).',
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
      notes: 'Upper-bound threshold (≤ 5.0 NTU normal).',
    },
  },
  dissolved_oxygen: {
    code: 'dissolved_oxygen',
    name: 'Dissolved Oxygen (DO)',
    shortName: 'Dissolved O₂',
    unit: 'mg/L',
    description: 'Concentration of free oxygen dissolved in water available for fish and aerobic microbes.',
    environmentalSignificance:
      'Depleted DO (< 5.5 mg/L) causes hypoxia; levels below 4.0 mg/L can trigger fish kills.',
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
      notes: 'Lower-bound threshold: lower values indicate hypoxia risk.',
    },
  },
  tds: {
    code: 'tds',
    name: 'Total Dissolved Solids (TDS)',
    shortName: 'TDS',
    unit: 'mg/L',
    description: 'Combined content of all inorganic salts and small organic matter dissolved in water.',
    environmentalSignificance:
      'Elevated TDS indicates mineral leaching, agricultural return flow, or industrial brine.',
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
      reference_source: 'EPA National Secondary Drinking Water Regulations',
      notes: 'Operational screening boundary for dissolved mineral load.',
    },
  },
  temperature: {
    code: 'temperature',
    name: 'Water Temperature',
    shortName: 'Temperature',
    unit: '°C',
    description: 'Thermal state of the water column influencing dissolved oxygen solubility and metabolic rates.',
    environmentalSignificance:
      'Thermal pollution from cooling water outfalls reduces oxygen capacity and stresses coldwater species.',
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
      notes: 'Monitors both intake icing risk and thermal plumes.',
    },
  },
  conductivity: {
    code: 'conductivity',
    name: 'Electrical Conductivity (EC)',
    shortName: 'Conductivity',
    unit: 'µS/cm',
    description: 'Ability of water to conduct electrical current, directly proportional to dissolved ion concentration.',
    environmentalSignificance:
      'Rapid shifts in conductivity serve as an early indicator of chemical spills or illicit discharges.',
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
      'Excess nitrate from fertilizer runoff or effluent drives eutrophication and algal blooms.',
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
      reference_source: 'EPA Nutrient Criteria Technical Guidance Manual',
      notes: 'Measured by specialized UV analyzer or scheduled laboratory grab sample.',
    },
  },
  phosphate: {
    code: 'phosphate',
    name: 'Phosphate (PO₄³⁻)',
    shortName: 'Phosphate',
    unit: 'mg/L',
    description: 'Dissolved reactive phosphorus measured by automated wet-chemistry analyzer or lab assay.',
    environmentalSignificance:
      'Limiting nutrient in freshwater ecosystems; small increases accelerate algae growth.',
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
      reference_source: 'EPA Gold Book Phosphorus Guidance',
      notes: 'Measured via automated colorimetric wet-chemistry cycle or lab analysis.',
    },
  },
  ammonia: {
    code: 'ammonia',
    name: 'Ammonia Nitrogen (NH₃-N)',
    shortName: 'Ammonia',
    unit: 'mg/L',
    description: 'Reduced nitrogen compound originating from raw sewage, agricultural waste, or industrial processes.',
    environmentalSignificance:
      'Acutely toxic to fish even at low concentrations, especially at elevated pH and temperature.',
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
      benchmark_authority: 'US EPA Aquatic Life Criteria for Ammonia',
      water_use_category: 'Freshwater Aquatic Toxicity & Effluent Screening',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'EPA-822-R-13-001 Aquatic Life Criteria for Ammonia',
      notes: 'Elevated ammonia strongly indicates untreated sewage or chemical discharge.',
    },
  },
  bod: {
    code: 'bod',
    name: 'Biochemical Oxygen Demand (BOD₅)',
    shortName: 'BOD₅',
    unit: 'mg/L',
    description: 'Dissolved oxygen required by aerobic microorganisms to decompose organic matter over 5 days at 20°C.',
    environmentalSignificance:
      'Primary indicator of organic pollution strength in wastewater effluent and receiving waters.',
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
      benchmark_authority: 'Clean Water Act / APHA BOD Reference',
      water_use_category: 'Ambient Stream Health & WWTP Effluent Screening',
      jurisdiction: 'Demonstration Watershed Standard',
      reference_source: 'APHA Standard Methods 5210',
      notes: 'Typically derived from laboratory 5-day incubation or optical surrogate analyzer.',
    },
  },
};

export const ALL_PARAMETERS_LIST: ParameterMetadata[] = Object.values(PARAMETER_METADATA);

export const CORE_OVERVIEW_PARAMETERS: ParameterCode[] = [
  'ph',
  'turbidity',
  'dissolved_oxygen',
  'tds',
  'temperature',
];

export function formatLocalDateTime(iso?: string | null): string {
  if (!iso) return 'Never / No Telemetry';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatShortTime(iso?: string | null, range?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (range === '7d' || range === '30d') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Offline / Unknown';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'Unknown';
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function formatParameterValue(param: ParameterCode | string, value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const meta = PARAMETER_METADATA[param as ParameterCode];
  if (!meta) return Number(value).toFixed(2);
  return Number(value).toFixed(meta.precision);
}

export function getDataSourceLabel(sourceType?: DataSourceType | ReadingDataSource): {
  label: string;
  shortLabel: string;
  description: string;
} {
  switch (sourceType) {
    case 'continuous_iot_probe':
      return {
        label: 'IoT Continuous Sonde Probe',
        shortLabel: 'IoT Probe',
        description: 'High-frequency in-situ electrochemical or optical submersible probe.',
      };
    case 'specialized_analyzer':
      return {
        label: 'Specialized Wet-Chem / UV Analyzer',
        shortLabel: 'Field Analyzer',
        description: 'Automated field cabinet analyzer (UV spectral or colorimetric cycle).',
      };
    case 'lab_manual_sample':
    case 'LAB_MANUAL':
      return {
        label: 'Laboratory / Grab Sample Assay',
        shortLabel: 'Lab / Grab Sample',
        description: 'Manual field grab sample or laboratory incubation assay (e.g., 5-day BOD₅).',
      };
    case 'IOT_HTTP_INGEST':
      return {
        label: 'Authenticated HTTP IoT Telemetry',
        shortLabel: 'IoT HTTP Ingest',
        description: 'Ingested via authenticated REST API endpoint.',
      };
    default:
      return {
        label: 'Simulated Demo Telemetry',
        shortLabel: 'Demo Simulation',
        description: 'Synthetic time-varying reading generated by the built-in AquaGuard Demo Engine.',
      };
  }
}

export function getWqiClassification(wqi: number): {
  label: string;
  status: 'normal' | 'warning' | 'critical';
  description: string;
} {
  if (wqi >= 85) {
    return {
      label: 'Good / Healthy',
      status: 'normal',
      description: 'Parameters well within configured operational screening ranges.',
    };
  }
  if (wqi >= 65) {
    return {
      label: 'Marginal / Fair',
      status: 'warning',
      description: 'One or more parameters approaching or crossing warning boundaries.',
    };
  }
  return {
    label: 'Poor / Degraded',
    status: 'critical',
    description: 'Significant threshold excursions detected; immediate investigation advised.',
  };
}
