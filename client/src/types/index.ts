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
export type TimeRangeOption = '1h' | '24h' | '7d' | '30d';

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

export interface SensorCapability {
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

export interface SensorReading {
  id: number;
  station_id: string;
  station_name?: string;
  water_body?: string;
  parameter: ParameterCode;
  value: number;
  unit: string;
  quality_status: QualityStatus;
  data_source: ReadingDataSource;
  is_simulated: number;
  recorded_at: string;
  created_at: string;
  previous_value?: number | null;
  trend_delta?: number | null;
  warning_limit?: string | null;
  critical_limit?: string | null;
  is_gap?: boolean;
}

export interface Station {
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
  capabilities: SensorCapability[];
  latestReadings: Record<string, SensorReading>;
  activeAlertsCount: number;
  criticalAlertsCount: number;
}

export interface ThresholdRule {
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

export interface AlertItem {
  id: string;
  station_id: string;
  reading_id: number | null;
  alert_type: 'threshold_violation' | 'station_offline' | 'sensor_fault';
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

export interface AlertEventItem {
  id: number;
  alert_id: string;
  event_type: 'created' | 'acknowledged' | 'resolved' | 'reopened' | 'escalated' | 'note_added';
  actor: string;
  notes: string;
  created_at: string;
}

export interface SimulationStatus {
  isRunning: boolean;
  tickCount: number;
  lastTickAt: string | null;
  intervalMs: number;
  seed: number;
  anomalyProbability: number;
  retentionMaxRowsPerStation: number;
  recentNewAlerts: AlertRecordSummary[];
}

export type AlertRecordSummary = AlertItem;

export interface DashboardSummaryResponse {
  kpis: {
    totalStations: number;
    activeStations: number;
    offlineStations: number;
    stationsRequiringAttention: number;
    criticalActiveAlerts: number;
    warningActiveAlerts: number;
    unreadAlertsCount: number;
    averageWqi: number;
    wqiTrendDelta: number;
    alerts24hDelta: number;
    lastDataUpdate: string;
  };
  statusDistribution: {
    normal: number;
    warning: number;
    critical: number;
    offline: number;
  };
  recentAlerts: AlertItem[];
  stations: Station[];
  simulation: SimulationStatus;
}

export interface UserSession {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'operator';
}
