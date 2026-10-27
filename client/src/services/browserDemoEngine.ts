import {
  AlertEventItem,
  AlertItem,
  DashboardSummaryResponse,
  ParameterCode,
  SensorCapability,
  SensorReading,
  SimulationStatus,
  Station,
  ThresholdRule,
  TimeRangeOption,
  UserSession,
} from '../types/index';
import { ALL_PARAMETERS_LIST, PARAMETER_METADATA } from '../utils/formatters';

const STORAGE_KEY = 'aquaguard_browser_db_v1';

interface BrowserDbState {
  stations: Station[];
  readings: SensorReading[];
  thresholds: ThresholdRule[];
  alerts: AlertItem[];
  alertEvents: Record<string, AlertEventItem[]>;
  settings: Record<string, any>;
  simulation: SimulationStatus;
  nextReadingId: number;
  nextAlertNum: number;
}

function createInitialBrowserDb(): BrowserDbState {
  const now = new Date();
  const thresholds: ThresholdRule[] = ALL_PARAMETERS_LIST.map((meta, idx) => ({
    id: idx + 1,
    station_id: null,
    parameter: meta.code,
    unit: meta.unit,
    min_warning: meta.defaultThresholds.min_warning,
    max_warning: meta.defaultThresholds.max_warning,
    min_critical: meta.defaultThresholds.min_critical,
    max_critical: meta.defaultThresholds.max_critical,
    enabled: 1,
    benchmark_authority: meta.defaultThresholds.benchmark_authority,
    water_use_category: meta.defaultThresholds.water_use_category,
    jurisdiction: meta.defaultThresholds.jurisdiction,
    reference_source: meta.defaultThresholds.reference_source,
    notes: meta.defaultThresholds.notes,
    updated_at: now.toISOString(),
  }));

  const stationDefs = [
    {
      id: 'STN-RIV-01',
      name: 'Clearwater Headwaters North',
      code: 'CW-UP-01',
      station_type: 'River upstream monitoring point',
      location_name: 'Sector A1 — Upper Gorge Forestry Bridge (Demo Location)',
      water_body: 'Clearwater River Basin (Upper Reach)',
      latitude: 45.5428,
      longitude: -122.7245,
      connectivity_status: 'online' as const,
      overall_status: 'normal' as const,
      wqi_score: 94.2,
      description: 'Reference upstream baseline station located above urban and agricultural inputs.',
      caps: [
        { parameter: 'ph' as ParameterCode, baseline: 7.42, var: 0.14 },
        { parameter: 'turbidity' as ParameterCode, baseline: 1.65, var: 0.45 },
        { parameter: 'dissolved_oxygen' as ParameterCode, baseline: 9.15, var: 0.35 },
        { parameter: 'tds' as ParameterCode, baseline: 148, var: 14 },
        { parameter: 'temperature' as ParameterCode, baseline: 14.8, var: 0.8 },
        { parameter: 'conductivity' as ParameterCode, baseline: 245, var: 20 },
        { parameter: 'nitrate' as ParameterCode, baseline: 1.15, var: 0.25 },
      ],
    },
    {
      id: 'STN-RIV-02',
      name: 'Confluence Valley Downstream',
      code: 'CW-DN-02',
      station_type: 'River downstream monitoring point',
      location_name: 'Sector B4 — Valley Agricultural Weir (Demo Location)',
      water_body: 'Clearwater River Basin (Lower Valley)',
      latitude: 45.5122,
      longitude: -122.6584,
      connectivity_status: 'online' as const,
      overall_status: 'warning' as const,
      wqi_score: 76.4,
      description: 'Downstream station capturing mixed agricultural return flow and urban tributaries.',
      caps: [
        { parameter: 'ph' as ParameterCode, baseline: 7.68, var: 0.22 },
        { parameter: 'turbidity' as ParameterCode, baseline: 6.4, var: 1.1 },
        { parameter: 'dissolved_oxygen' as ParameterCode, baseline: 6.8, var: 0.45 },
        { parameter: 'tds' as ParameterCode, baseline: 385, var: 28 },
        { parameter: 'temperature' as ParameterCode, baseline: 19.2, var: 1.1 },
        { parameter: 'conductivity' as ParameterCode, baseline: 640, var: 42 },
        { parameter: 'nitrate' as ParameterCode, baseline: 9.2, var: 0.9 },
        { parameter: 'phosphate' as ParameterCode, baseline: 0.12, var: 0.03 },
        { parameter: 'bod' as ParameterCode, baseline: 3.8, var: 0.6 },
      ],
    },
    {
      id: 'STN-IND-03',
      name: 'Apex Chemical Park Outfall #4',
      code: 'IND-APX-03',
      station_type: 'Industrial discharge monitoring point',
      location_name: 'Sector C2 — East Industrial Corridor Culvert (Demo Location)',
      water_body: 'East Industrial Canal -> Clearwater River',
      latitude: 45.5289,
      longitude: -122.6312,
      connectivity_status: 'online' as const,
      overall_status: 'critical' as const,
      wqi_score: 52.8,
      description: 'High-frequency compliance sonde monitoring industrial process water discharge.',
      caps: [
        { parameter: 'ph' as ParameterCode, baseline: 9.18, var: 0.25 },
        { parameter: 'turbidity' as ParameterCode, baseline: 11.5, var: 2.2 },
        { parameter: 'dissolved_oxygen' as ParameterCode, baseline: 4.8, var: 0.55 },
        { parameter: 'tds' as ParameterCode, baseline: 840, var: 65 },
        { parameter: 'temperature' as ParameterCode, baseline: 25.4, var: 1.4 },
        { parameter: 'conductivity' as ParameterCode, baseline: 1690, var: 110 },
        { parameter: 'ammonia' as ParameterCode, baseline: 2.65, var: 0.35 },
        { parameter: 'phosphate' as ParameterCode, baseline: 0.24, var: 0.05 },
        { parameter: 'bod' as ParameterCode, baseline: 8.6, var: 1.2 },
      ],
    },
    {
      id: 'STN-WWT-04',
      name: 'Metro South WWTP Effluent Channel',
      code: 'WWT-MS-04',
      station_type: 'Wastewater treatment outlet',
      location_name: 'Sector D1 — Municipal Tertiary Outfall Flume (Demo Location)',
      water_body: 'Clearwater River Mixing Zone South',
      latitude: 45.4895,
      longitude: -122.6421,
      connectivity_status: 'online' as const,
      overall_status: 'warning' as const,
      wqi_score: 79.5,
      description: 'Monitors treated municipal effluent post-UV disinfection prior to diffuser discharge.',
      caps: [
        { parameter: 'ph' as ParameterCode, baseline: 7.18, var: 0.18 },
        { parameter: 'turbidity' as ParameterCode, baseline: 3.4, var: 0.7 },
        { parameter: 'dissolved_oxygen' as ParameterCode, baseline: 6.4, var: 0.4 },
        { parameter: 'tds' as ParameterCode, baseline: 465, var: 30 },
        { parameter: 'temperature' as ParameterCode, baseline: 20.8, var: 0.9 },
        { parameter: 'nitrate' as ParameterCode, baseline: 6.8, var: 0.8 },
        { parameter: 'phosphate' as ParameterCode, baseline: 0.24, var: 0.04 },
        { parameter: 'ammonia' as ParameterCode, baseline: 0.42, var: 0.12 },
        { parameter: 'bod' as ParameterCode, baseline: 4.5, var: 0.7 },
      ],
    },
    {
      id: 'STN-RES-05',
      name: 'Pinecrest Highland Reservoir Buoy B2',
      code: 'RES-PC-05',
      station_type: 'Reservoir monitoring point',
      location_name: 'Sector A3 — Deep Basin Anchored Telemetry Buoy (Demo Location)',
      water_body: 'Pinecrest Storage Reservoir',
      latitude: 45.5582,
      longitude: -122.689,
      connectivity_status: 'online' as const,
      overall_status: 'normal' as const,
      wqi_score: 93.1,
      description: 'Floating multiparameter profiling buoy tracking reservoir stratification and DO.',
      caps: [
        { parameter: 'ph' as ParameterCode, baseline: 7.52, var: 0.12 },
        { parameter: 'turbidity' as ParameterCode, baseline: 1.35, var: 0.35 },
        { parameter: 'dissolved_oxygen' as ParameterCode, baseline: 8.65, var: 0.3 },
        { parameter: 'tds' as ParameterCode, baseline: 175, var: 12 },
        { parameter: 'temperature' as ParameterCode, baseline: 16.4, var: 0.7 },
        { parameter: 'conductivity' as ParameterCode, baseline: 295, var: 18 },
        { parameter: 'phosphate' as ParameterCode, baseline: 0.045, var: 0.012 },
      ],
    },
    {
      id: 'STN-INT-06',
      name: 'Municipal Waterworks Intake Gate 1',
      code: 'INT-MW-06',
      station_type: 'Water treatment intake',
      location_name: 'Sector B1 — Raw Water Pump Station Forebay (Demo Location)',
      water_body: 'Clearwater River Intake Channel',
      latitude: 45.534,
      longitude: -122.6715,
      connectivity_status: 'offline' as const,
      overall_status: 'offline' as const,
      wqi_score: 88.0,
      description: 'Early-warning raw water intake screening station. Currently in simulated telemetry drop state.',
      caps: [
        { parameter: 'ph' as ParameterCode, baseline: 7.38, var: 0.15 },
        { parameter: 'turbidity' as ParameterCode, baseline: 2.2, var: 0.5 },
        { parameter: 'dissolved_oxygen' as ParameterCode, baseline: 8.1, var: 0.35 },
        { parameter: 'tds' as ParameterCode, baseline: 215, var: 18 },
        { parameter: 'temperature' as ParameterCode, baseline: 17.1, var: 0.8 },
        { parameter: 'conductivity' as ParameterCode, baseline: 355, var: 22 },
        { parameter: 'nitrate' as ParameterCode, baseline: 2.1, var: 0.35 },
        { parameter: 'ammonia' as ParameterCode, baseline: 0.11, var: 0.04 },
      ],
    },
  ];

  const readings: SensorReading[] = [];
  let readingId = 1;
  const timeOffsetsMin = [
    1440 * 14,
    1440 * 7,
    1440 * 3,
    1440 * 2,
    1440,
    720,
    360,
    240,
    120,
    60,
    45,
    30,
    15,
    5,
    0,
  ];

  const stations: Station[] = stationDefs.map((def, sIdx) => {
    const capabilities: SensorCapability[] = def.caps.map((c, cIdx) => {
      const meta = PARAMETER_METADATA[c.parameter];
      return {
        id: sIdx * 20 + cIdx + 1,
        station_id: def.id,
        parameter: c.parameter,
        unit: meta.unit,
        data_source_type: meta.defaultSourceType,
        sensor_model: meta.defaultSensorModel,
        is_enabled: 1,
        baseline_value: c.baseline,
        variation_range: c.var,
      };
    });

    const latestReadings: Record<string, SensorReading> = {};

    for (const offset of timeOffsetsMin) {
      if (def.connectivity_status === 'offline' && offset < 240) continue;
      const ts = new Date(now.getTime() - offset * 60000).toISOString();

      for (const cap of capabilities) {
        const meta = PARAMETER_METADATA[cap.parameter];
        const wave = Math.sin(offset / 180) * (cap.variation_range * 0.35);
        const val = Number((cap.baseline_value + wave).toFixed(meta.precision));
        const qStatus = evaluateValueStatus(val, meta.code, thresholds);

        const rec: SensorReading = {
          id: readingId++,
          station_id: def.id,
          station_name: def.name,
          water_body: def.water_body,
          parameter: cap.parameter,
          value: val,
          unit: meta.unit,
          quality_status: qStatus,
          data_source:
            cap.data_source_type === 'lab_manual_sample' ? 'LAB_MANUAL' : 'DEMO_SIMULATION',
          is_simulated: 1,
          recorded_at: ts,
          created_at: ts,
          previous_value: cap.baseline_value,
          trend_delta: Number((val - cap.baseline_value).toFixed(meta.precision)),
          warning_limit:
            meta.defaultThresholds.max_warning !== null
              ? `≤ ${meta.defaultThresholds.max_warning} ${meta.unit}`
              : `≥ ${meta.defaultThresholds.min_warning} ${meta.unit}`,
          critical_limit:
            meta.defaultThresholds.max_critical !== null
              ? `> ${meta.defaultThresholds.max_critical} ${meta.unit}`
              : `< ${meta.defaultThresholds.min_critical} ${meta.unit}`,
        };
        readings.push(rec);
        latestReadings[cap.parameter] = rec;
      }
    }

    return {
      id: def.id,
      name: def.name,
      code: def.code,
      station_type: def.station_type,
      location_name: def.location_name,
      water_body: def.water_body,
      latitude: def.latitude,
      longitude: def.longitude,
      is_fictional_location: 1,
      connectivity_status: def.connectivity_status,
      overall_status: def.overall_status,
      wqi_score: def.wqi_score,
      firmware_version: 'v3.6.0-SolarIoT',
      sampling_interval_sec: 5,
      description: def.description,
      last_seen_at:
        def.connectivity_status === 'offline'
          ? new Date(now.getTime() - 4 * 3600000).toISOString()
          : now.toISOString(),
      created_at: new Date(now.getTime() - 30 * 86400000).toISOString(),
      updated_at: now.toISOString(),
      capabilities,
      latestReadings,
      activeAlertsCount: def.id === 'STN-IND-03' ? 2 : def.id === 'STN-RIV-02' || def.id === 'STN-WWT-04' || def.id === 'STN-INT-06' ? 1 : 0,
      criticalAlertsCount: def.id === 'STN-IND-03' ? 2 : 0,
    };
  });

  const alerts: AlertItem[] = [
    {
      id: 'ALT-1001-412',
      station_id: 'STN-IND-03',
      station_name: 'Apex Chemical Park Outfall #4',
      water_body: 'East Industrial Canal -> Clearwater River',
      location_name: 'Sector C2 — East Industrial Corridor Culvert (Demo Location)',
      reading_id: 1,
      alert_type: 'threshold_violation',
      parameter: 'ammonia',
      measured_value: 2.65,
      unit: 'mg/L',
      triggered_threshold: '> 2.0 mg/L (Upper Critical Limit)',
      threshold_direction: 'above_max_critical',
      severity: 'critical',
      title: 'Critical: Ammonia Nitrogen (NH₃-N) excursion at Apex Chemical Park Outfall #4',
      message: 'Ammonia Nitrogen measured 2.65 mg/L at Apex Chemical Park Outfall #4, exceeding critical threshold (> 2.0 mg/L).',
      is_simulated: 1,
      is_read: 0,
      acknowledged: 0,
      acknowledged_by: null,
      acknowledged_at: null,
      resolved: 0,
      resolved_by: null,
      resolved_at: null,
      resolution_notes: null,
      dedup_key: 'STN-IND-03:ammonia:above_max_critical',
      occurrence_count: 2,
      created_at: new Date(now.getTime() - 12 * 60000).toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'ALT-1002-519',
      station_id: 'STN-IND-03',
      station_name: 'Apex Chemical Park Outfall #4',
      water_body: 'East Industrial Canal -> Clearwater River',
      location_name: 'Sector C2 — East Industrial Corridor Culvert (Demo Location)',
      reading_id: 2,
      alert_type: 'threshold_violation',
      parameter: 'ph',
      measured_value: 9.18,
      unit: 'pH units',
      triggered_threshold: '> 9.0 pH units (Upper Critical Limit)',
      threshold_direction: 'above_max_critical',
      severity: 'critical',
      title: 'Critical: pH Level alkaline excursion at Apex Chemical Park Outfall #4',
      message: 'pH Level measured 9.18 pH units at Apex Chemical Park Outfall #4, exceeding upper critical limit (> 9.0 pH units).',
      is_simulated: 1,
      is_read: 0,
      acknowledged: 0,
      acknowledged_by: null,
      acknowledged_at: null,
      resolved: 0,
      resolved_by: null,
      resolved_at: null,
      resolution_notes: null,
      dedup_key: 'STN-IND-03:ph:above_max_critical',
      occurrence_count: 1,
      created_at: new Date(now.getTime() - 10 * 60000).toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'ALT-1003-628',
      station_id: 'STN-RIV-02',
      station_name: 'Confluence Valley Downstream',
      water_body: 'Clearwater River Basin (Lower Valley)',
      location_name: 'Sector B4 — Valley Agricultural Weir (Demo Location)',
      reading_id: 3,
      alert_type: 'threshold_violation',
      parameter: 'turbidity',
      measured_value: 6.4,
      unit: 'NTU',
      triggered_threshold: '> 5.0 NTU (Upper Warning Limit)',
      threshold_direction: 'above_max_warning',
      severity: 'warning',
      title: 'Warning: Turbidity excursion at Confluence Valley Downstream',
      message: 'Turbidity measured 6.4 NTU at Confluence Valley Downstream, exceeding warning limit (> 5.0 NTU).',
      is_simulated: 1,
      is_read: 0,
      acknowledged: 0,
      acknowledged_by: null,
      acknowledged_at: null,
      resolved: 0,
      resolved_by: null,
      resolved_at: null,
      resolution_notes: null,
      dedup_key: 'STN-RIV-02:turbidity:above_max_warning',
      occurrence_count: 1,
      created_at: new Date(now.getTime() - 25 * 60000).toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'ALT-1004-740',
      station_id: 'STN-INT-06',
      station_name: 'Municipal Waterworks Intake Gate 1',
      water_body: 'Clearwater River Intake Channel',
      location_name: 'Sector B1 — Raw Water Pump Station Forebay (Demo Location)',
      reading_id: null,
      alert_type: 'station_offline',
      parameter: 'connectivity',
      measured_value: null,
      unit: 'status',
      triggered_threshold: 'Heartbeat Timeout (> 15 min)',
      threshold_direction: 'offline',
      severity: 'warning',
      title: 'Telemetry Offline: Municipal Waterworks Intake Gate 1 unreachable',
      message: 'Station Municipal Waterworks Intake Gate 1 (STN-INT-06) missed scheduled telemetry heartbeats and is marked OFFLINE.',
      is_simulated: 1,
      is_read: 0,
      acknowledged: 1,
      acknowledged_by: 'Marcus Chen (Shift Telemetry Operator)',
      acknowledged_at: new Date(now.getTime() - 60 * 60000).toISOString(),
      resolved: 0,
      resolved_by: null,
      resolved_at: null,
      resolution_notes: null,
      dedup_key: 'STN-INT-06:connectivity:offline',
      occurrence_count: 1,
      created_at: new Date(now.getTime() - 180 * 60000).toISOString(),
      updated_at: now.toISOString(),
    },
  ];

  const alertEvents: Record<string, AlertEventItem[]> = {};
  for (const a of alerts) {
    alertEvents[a.id] = [
      {
        id: 1,
        alert_id: a.id,
        event_type: 'created',
        actor: 'System Threshold Engine',
        notes: `Alert triggered automatically (${a.triggered_threshold}).`,
        created_at: a.created_at,
      },
    ];
  }

  return {
    stations,
    readings,
    thresholds,
    alerts,
    alertEvents,
    settings: {
      simulation_enabled: true,
      simulation_interval_ms: 5000,
      simulation_seed: 42069,
      simulation_anomaly_probability: 0.14,
      retention_max_rows_per_station: 2500,
      alert_cooldown_minutes: 2,
      organization_name: 'Clearwater Regional Watershed Authority (Demo Instance)',
    },
    simulation: {
      isRunning: true,
      tickCount: 1,
      lastTickAt: now.toISOString(),
      intervalMs: 5000,
      seed: 42069,
      anomalyProbability: 0.14,
      retentionMaxRowsPerStation: 2500,
      recentNewAlerts: [],
    },
    nextReadingId: readingId,
    nextAlertNum: 1005,
  };
}

function evaluateValueStatus(
  value: number,
  param: ParameterCode,
  thresholds: ThresholdRule[]
): 'normal' | 'warning' | 'critical' {
  const rule = thresholds.find((t) => t.parameter === param && t.enabled);
  if (!rule) return 'normal';
  if (
    (rule.min_critical !== null && value < rule.min_critical) ||
    (rule.max_critical !== null && value > rule.max_critical)
  ) {
    return 'critical';
  }
  if (
    (rule.min_warning !== null && value < rule.min_warning) ||
    (rule.max_warning !== null && value > rule.max_warning)
  ) {
    return 'warning';
  }
  return 'normal';
}

function loadState(): BrowserDbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as BrowserDbState;
    }
  } catch {
    // ignore
  }
  const initial = createInitialBrowserDb();
  saveState(initial);
  return initial;
}

function saveState(state: BrowserDbState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const browserDemoEngine = {
  getDashboardSummary(): DashboardSummaryResponse {
    const state = loadState();
    // Advance simulation tick automatically if running and >4s elapsed
    if (state.simulation.isRunning) {
      const lastMs = state.simulation.lastTickAt
        ? new Date(state.simulation.lastTickAt).getTime()
        : 0;
      if (Date.now() - lastMs >= 4500) {
        this.stepSimulation();
      }
    }
    const fresh = loadState();
    const stations = fresh.stations;
    const totalStations = stations.length;
    const activeStations = stations.filter((s) => s.connectivity_status === 'online').length;
    const statusDistribution = {
      normal: stations.filter((s) => s.overall_status === 'normal').length,
      warning: stations.filter((s) => s.overall_status === 'warning').length,
      critical: stations.filter((s) => s.overall_status === 'critical').length,
      offline: stations.filter((s) => s.overall_status === 'offline').length,
    };
    const onlineStations = stations.filter((s) => s.connectivity_status === 'online');
    const averageWqi =
      onlineStations.length > 0
        ? Number(
            (
              onlineStations.reduce((acc, s) => acc + s.wqi_score, 0) / onlineStations.length
            ).toFixed(1)
          )
        : 0;

    const activeAlerts = fresh.alerts.filter((a) => !a.resolved);
    const critCount = activeAlerts.filter((a) => a.severity === 'critical').length;
    const warnCount = activeAlerts.filter((a) => a.severity === 'warning').length;
    const unreadCount = activeAlerts.filter((a) => !a.is_read).length;

    return {
      kpis: {
        totalStations,
        activeStations,
        offlineStations: totalStations - activeStations,
        stationsRequiringAttention:
          statusDistribution.warning + statusDistribution.critical + statusDistribution.offline,
        criticalActiveAlerts: critCount,
        warningActiveAlerts: warnCount,
        unreadAlertsCount: unreadCount,
        averageWqi,
        wqiTrendDelta: 1.4,
        alerts24hDelta: activeAlerts.length,
        lastDataUpdate: fresh.simulation.lastTickAt || new Date().toISOString(),
      },
      statusDistribution,
      recentAlerts: fresh.alerts.slice(0, 8),
      stations,
      simulation: fresh.simulation,
    };
  },

  stepSimulation(options?: {
    forceAnomaly?: boolean;
    stationId?: string;
    parameter?: ParameterCode;
  }) {
    const state = loadState();
    const now = new Date().toISOString();
    const newAlerts: AlertItem[] = [];
    let generatedReadingsCount = 0;

    for (const st of state.stations) {
      if (st.connectivity_status === 'offline') continue;
      if (options?.stationId && options.stationId !== st.id) continue;

      for (const cap of st.capabilities) {
        if (!cap.is_enabled) continue;
        if (options?.parameter && options.parameter !== cap.parameter) continue;

        const meta = PARAMETER_METADATA[cap.parameter];
        const prev = st.latestReadings[cap.parameter]?.value ?? cap.baseline_value;
        let nextVal =
          prev +
          (cap.baseline_value - prev) * 0.35 +
          (Math.random() - 0.5) * cap.variation_range * 0.5;

        if (options?.forceAnomaly) {
          const rule = state.thresholds.find((t) => t.parameter === cap.parameter);
          if (rule?.max_critical !== null && rule?.max_critical !== undefined) {
            nextVal = rule.max_critical * 1.12;
          } else if (rule?.min_critical !== null && rule?.min_critical !== undefined) {
            nextVal = rule.min_critical * 0.85;
          }
        }

        nextVal = Math.max(
          meta.minAllowedValue,
          Math.min(meta.maxAllowedValue, Number(nextVal.toFixed(meta.precision)))
        );

        const qStatus = evaluateValueStatus(nextVal, cap.parameter, state.thresholds);
        const rec: SensorReading = {
          id: state.nextReadingId++,
          station_id: st.id,
          station_name: st.name,
          water_body: st.water_body,
          parameter: cap.parameter,
          value: nextVal,
          unit: meta.unit,
          quality_status: qStatus,
          data_source: 'DEMO_SIMULATION',
          is_simulated: 1,
          recorded_at: now,
          created_at: now,
          previous_value: prev,
          trend_delta: Number((nextVal - prev).toFixed(meta.precision)),
          warning_limit: st.latestReadings[cap.parameter]?.warning_limit || 'Configured',
          critical_limit: st.latestReadings[cap.parameter]?.critical_limit || 'Configured',
        };

        state.readings.push(rec);
        st.latestReadings[cap.parameter] = rec;
        st.last_seen_at = now;
        generatedReadingsCount++;

        if (qStatus === 'critical' || qStatus === 'warning') {
          const existing = state.alerts.find(
            (a) => a.station_id === st.id && a.parameter === cap.parameter && !a.resolved
          );
          if (!existing) {
            const alertId = `ALT-${state.nextAlertNum++}-${Math.floor(100 + Math.random() * 899)}`;
            const newAlert: AlertItem = {
              id: alertId,
              station_id: st.id,
              station_name: st.name,
              water_body: st.water_body,
              location_name: st.location_name,
              reading_id: rec.id,
              alert_type: 'threshold_violation',
              parameter: cap.parameter,
              measured_value: nextVal,
              unit: meta.unit,
              triggered_threshold: `${qStatus.toUpperCase()} Threshold Exceeded`,
              threshold_direction: 'excursion',
              severity: qStatus,
              title: `${qStatus === 'critical' ? 'Critical' : 'Warning'}: ${meta.name} excursion at ${st.name}`,
              message: `${meta.name} measured ${nextVal} ${meta.unit} at ${st.name}.`,
              is_simulated: 1,
              is_read: 0,
              acknowledged: 0,
              acknowledged_by: null,
              acknowledged_at: null,
              resolved: 0,
              resolved_by: null,
              resolved_at: null,
              resolution_notes: null,
              dedup_key: `${st.id}:${cap.parameter}`,
              occurrence_count: 1,
              created_at: now,
              updated_at: now,
            };
            state.alerts.unshift(newAlert);
            state.alertEvents[alertId] = [
              {
                id: 1,
                alert_id: alertId,
                event_type: 'created',
                actor: 'System Threshold Engine',
                notes: newAlert.message,
                created_at: now,
              },
            ];
            newAlerts.push(newAlert);
          }
        }
      }
    }

    state.simulation.tickCount++;
    state.simulation.lastTickAt = now;
    saveState(state);
    return {
      generatedReadingsCount,
      newAlerts,
      timestamp: now,
      simulation: state.simulation,
    };
  },

  toggleSimulation(enabled?: boolean): SimulationStatus {
    const state = loadState();
    state.simulation.isRunning =
      enabled !== undefined ? Boolean(enabled) : !state.simulation.isRunning;
    saveState(state);
    return state.simulation;
  },

  getStations(params?: { search?: string; status?: string; connectivity?: string }) {
    const state = loadState();
    const list = state.stations.filter((s) => {
      if (params?.status && params.status !== 'all') {
        if (params.status === 'attention') {
          if (s.overall_status === 'normal') return false;
        } else if (s.overall_status !== params.status) return false;
      }
      if (
        params?.connectivity &&
        params.connectivity !== 'all' &&
        s.connectivity_status !== params.connectivity
      ) {
        return false;
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
        );
      }
      return true;
    });
    return { stations: list, total: list.length };
  },

  getStationById(id: string) {
    const state = loadState();
    const station = state.stations.find((s) => s.id === id) || state.stations[0];
    const alerts = state.alerts.filter((a) => a.station_id === station.id);
    return { station, alerts, thresholds: state.thresholds };
  },

  createStation(payload: any) {
    const state = loadState();
    const now = new Date().toISOString();
    const id = payload.id || `STN-NEW-${state.stations.length + 1}`;
    const caps: SensorCapability[] = (payload.supported_parameters || ['ph', 'turbidity']).map(
      (p: ParameterCode, idx: number) => {
        const m = PARAMETER_METADATA[p];
        return {
          id: Date.now() + idx,
          station_id: id,
          parameter: p,
          unit: m.unit,
          data_source_type: m.defaultSourceType,
          sensor_model: m.defaultSensorModel,
          is_enabled: 1,
          baseline_value: m.defaultBaseline,
          variation_range: m.defaultVariation,
        };
      }
    );
    const station: Station = {
      id,
      name: payload.name || 'New Station',
      code: payload.code || 'CW-NEW',
      station_type: payload.station_type || 'River upstream monitoring point',
      location_name: payload.location_name || 'Watershed Demo Point',
      water_body: payload.water_body || 'Clearwater River Basin',
      latitude: Number(payload.latitude) || 45.53,
      longitude: Number(payload.longitude) || -122.66,
      is_fictional_location: 1,
      connectivity_status: payload.connectivity_status || 'online',
      overall_status: payload.connectivity_status === 'offline' ? 'offline' : 'normal',
      wqi_score: 92.0,
      firmware_version: 'v3.6.0-SolarIoT',
      sampling_interval_sec: 5,
      description: payload.description || '',
      last_seen_at: now,
      created_at: now,
      updated_at: now,
      capabilities: caps,
      latestReadings: {},
      activeAlertsCount: 0,
      criticalAlertsCount: 0,
    };
    state.stations.push(station);
    saveState(state);
    return { station };
  },

  updateStation(id: string, payload: any) {
    const state = loadState();
    const idx = state.stations.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Station not found');
    const st = state.stations[idx];
    const updated: Station = {
      ...st,
      ...payload,
      overall_status:
        payload.connectivity_status === 'offline'
          ? 'offline'
          : payload.connectivity_status === 'online' && st.overall_status === 'offline'
            ? 'normal'
            : st.overall_status,
      updated_at: new Date().toISOString(),
    };
    state.stations[idx] = updated;
    saveState(state);
    return { station: updated };
  },

  deleteStation(id: string) {
    const state = loadState();
    state.stations = state.stations.filter((s) => s.id !== id);
    state.readings = state.readings.filter((r) => r.station_id !== id);
    state.alerts = state.alerts.filter((a) => a.station_id !== id);
    saveState(state);
    return { deleted: true, id };
  },

  getReadings(params?: {
    stationId?: string;
    parameter?: string;
    range?: TimeRangeOption;
    qualityStatus?: string;
  }) {
    const state = loadState();
    const rows = state.readings.filter((r) => {
      if (params?.stationId && params.stationId !== 'all' && r.station_id !== params.stationId) {
        return false;
      }
      if (params?.parameter && params.parameter !== 'all' && r.parameter !== params.parameter) {
        return false;
      }
      if (
        params?.qualityStatus &&
        params.qualityStatus !== 'all' &&
        r.quality_status !== params.qualityStatus
      ) {
        return false;
      }
      return true;
    });
    return {
      readings: rows,
      series: rows,
      total: rows.length,
      timeBounds: {
        startIso: new Date(Date.now() - 86400000).toISOString(),
        endIso: new Date().toISOString(),
        label: params?.range || '24h',
      },
    };
  },

  ingestReading(payload: {
    station_id: string;
    parameter: ParameterCode;
    value: number;
    data_source?: any;
    is_simulated?: boolean;
  }) {
    const state = loadState();
    const st = state.stations.find((s) => s.id === payload.station_id);
    if (!st) throw new Error('Station not found');
    const meta = PARAMETER_METADATA[payload.parameter];
    const now = new Date().toISOString();
    const qStatus = evaluateValueStatus(payload.value, payload.parameter, state.thresholds);
    const reading: SensorReading = {
      id: state.nextReadingId++,
      station_id: st.id,
      station_name: st.name,
      water_body: st.water_body,
      parameter: payload.parameter,
      value: payload.value,
      unit: meta.unit,
      quality_status: qStatus,
      data_source: payload.data_source || 'LAB_MANUAL',
      is_simulated: payload.is_simulated ? 1 : 0,
      recorded_at: now,
      created_at: now,
    };
    state.readings.push(reading);
    st.latestReadings[payload.parameter] = reading;
    saveState(state);
    return { success: true, reading, alert: null, isNewAlert: false };
  },

  getAlerts(params?: {
    stationId?: string;
    severity?: string;
    status?: string;
    parameter?: string;
    search?: string;
  }) {
    const state = loadState();
    const filtered = state.alerts.filter((a) => {
      if (params?.stationId && params.stationId !== 'all' && a.station_id !== params.stationId)
        return false;
      if (params?.severity && params.severity !== 'all' && a.severity !== params.severity)
        return false;
      if (params?.parameter && params.parameter !== 'all' && a.parameter !== params.parameter)
        return false;
      if (params?.status && params.status !== 'all') {
        if (params.status === 'active' && a.resolved) return false;
        if (params.status === 'unacknowledged' && (a.resolved || a.acknowledged)) return false;
        if (params.status === 'acknowledged' && (a.resolved || !a.acknowledged)) return false;
        if (params.status === 'resolved' && !a.resolved) return false;
        if (params.status === 'unread' && a.is_read) return false;
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        return (
          a.id.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          (a.station_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    const active = state.alerts.filter((a) => !a.resolved);
    return {
      alerts: filtered,
      total: filtered.length,
      unreadCount: active.filter((a) => !a.is_read).length,
      activeCriticalCount: active.filter((a) => a.severity === 'critical').length,
      activeWarningCount: active.filter((a) => a.severity === 'warning').length,
    };
  },

  getAlertDetails(id: string) {
    const state = loadState();
    const alert = state.alerts.find((a) => a.id === id) || state.alerts[0];
    const events = state.alertEvents[alert.id] || [];
    return { alert, events };
  },

  acknowledgeAlert(id: string, notes?: string) {
    const state = loadState();
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) throw new Error('Alert not found');
    const now = new Date().toISOString();
    alert.acknowledged = 1;
    alert.acknowledged_by = 'Operator';
    alert.acknowledged_at = now;
    alert.is_read = 1;
    alert.updated_at = now;
    state.alertEvents[id] = [
      ...(state.alertEvents[id] || []),
      {
        id: Date.now(),
        alert_id: id,
        event_type: 'acknowledged',
        actor: 'Operator',
        notes: notes || 'Alert acknowledged.',
        created_at: now,
      },
    ];
    saveState(state);
    return { alert, details: { alert, events: state.alertEvents[id] } };
  },

  resolveAlert(id: string, resolutionNotes?: string) {
    const state = loadState();
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) throw new Error('Alert not found');
    const now = new Date().toISOString();
    alert.resolved = 1;
    alert.resolved_by = 'Operator';
    alert.resolved_at = now;
    alert.resolution_notes = resolutionNotes || 'Resolved.';
    alert.acknowledged = 1;
    alert.is_read = 1;
    alert.updated_at = now;
    state.alertEvents[id] = [
      ...(state.alertEvents[id] || []),
      {
        id: Date.now(),
        alert_id: id,
        event_type: 'resolved',
        actor: 'Operator',
        notes: alert.resolution_notes,
        created_at: now,
      },
    ];
    saveState(state);
    return { alert, details: { alert, events: state.alertEvents[id] } };
  },

  reopenAlert(id: string, notes?: string) {
    const state = loadState();
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) throw new Error('Alert not found');
    const now = new Date().toISOString();
    alert.resolved = 0;
    alert.is_read = 0;
    alert.updated_at = now;
    state.alertEvents[id] = [
      ...(state.alertEvents[id] || []),
      {
        id: Date.now(),
        alert_id: id,
        event_type: 'reopened',
        actor: 'Operator',
        notes: notes || 'Reopened.',
        created_at: now,
      },
    ];
    saveState(state);
    return { alert, details: { alert, events: state.alertEvents[id] } };
  },

  markAllAlertsRead() {
    const state = loadState();
    state.alerts.forEach((a) => {
      a.is_read = 1;
    });
    saveState(state);
    return { updatedCount: state.alerts.length };
  },

  getThresholds(stationId?: string) {
    const state = loadState();
    const list = stationId
      ? state.thresholds.filter((t) => !t.station_id || t.station_id === stationId)
      : state.thresholds;
    return { thresholds: list };
  },

  updateThreshold(id: number, payload: Partial<ThresholdRule>) {
    const state = loadState();
    const idx = state.thresholds.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Threshold rule not found');
    const merged = { ...state.thresholds[idx], ...payload };
    if (
      merged.min_critical !== null &&
      merged.min_warning !== null &&
      merged.min_critical > merged.min_warning
    ) {
      throw new Error('Lower critical boundary cannot be greater than lower warning boundary.');
    }
    if (
      merged.max_warning !== null &&
      merged.max_critical !== null &&
      merged.max_warning > merged.max_critical
    ) {
      throw new Error('Upper warning boundary cannot be greater than upper critical boundary.');
    }
    state.thresholds[idx] = merged;
    saveState(state);
    return { threshold: merged };
  },

  upsertStationThreshold(payload: Partial<ThresholdRule> & { parameter: ParameterCode }) {
    const state = loadState();
    const meta = PARAMETER_METADATA[payload.parameter];
    const newRule: ThresholdRule = {
      id: Date.now(),
      station_id: payload.station_id || null,
      parameter: payload.parameter,
      unit: meta.unit,
      min_warning: payload.min_warning ?? null,
      max_warning: payload.max_warning ?? null,
      min_critical: payload.min_critical ?? null,
      max_critical: payload.max_critical ?? null,
      enabled: 1,
      benchmark_authority: 'Configured Station Override',
      water_use_category: meta.defaultThresholds.water_use_category,
      jurisdiction: meta.defaultThresholds.jurisdiction,
      reference_source: 'Station Override',
      notes: payload.notes || '',
      updated_at: new Date().toISOString(),
    };
    state.thresholds.push(newRule);
    saveState(state);
    return { threshold: newRule };
  },

  getAnalyticsSummary(params?: { stationId?: string; parameter?: ParameterCode }) {
    const state = loadState();
    const selectedParam = params?.parameter || 'ph';
    const meta = PARAMETER_METADATA[selectedParam];

    const parameterStatistics = ALL_PARAMETERS_LIST.map((m) => {
      const rows = state.readings.filter(
        (r) =>
          r.parameter === m.code &&
          (!params?.stationId || params.stationId === 'all' || r.station_id === params.stationId)
      );
      if (rows.length === 0) {
        return {
          parameter: m.code,
          name: m.name,
          shortName: m.shortName,
          unit: m.unit,
          count: 0,
          min: null,
          max: null,
          avg: null,
          warningCount: 0,
          criticalCount: 0,
          anomalyCount: 0,
          anomalyRatePct: 0,
        };
      }
      const vals = rows.map((r) => r.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(m.precision));
      const warningCount = rows.filter((r) => r.quality_status === 'warning').length;
      const criticalCount = rows.filter((r) => r.quality_status === 'critical').length;
      const anomalyCount = warningCount + criticalCount;
      return {
        parameter: m.code,
        name: m.name,
        shortName: m.shortName,
        unit: m.unit,
        count: rows.length,
        min,
        max,
        avg,
        warningCount,
        criticalCount,
        anomalyCount,
        anomalyRatePct: Number(((anomalyCount / rows.length) * 100).toFixed(1)),
      };
    });

    const stationComparisons = state.stations
      .filter((s) => s.capabilities.some((c) => c.parameter === selectedParam && c.is_enabled))
      .map((s) => {
        const rows = state.readings.filter(
          (r) => r.station_id === s.id && r.parameter === selectedParam
        );
        const vals = rows.map((r) => r.value);
        return {
          station_id: s.id,
          station_name: s.name,
          station_code: s.code,
          overall_status: s.overall_status,
          connectivity_status: s.connectivity_status,
          sample_count: rows.length,
          min_val: vals.length ? Math.min(...vals) : null,
          max_val: vals.length ? Math.max(...vals) : null,
          avg_val: vals.length
            ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(meta.precision))
            : null,
          anomaly_count: rows.filter((r) => r.quality_status !== 'normal').length,
          unit: meta.unit,
        };
      });

    const dailySummaries = [
      {
        bucket: new Date().toISOString().slice(0, 10),
        sample_count: 42,
        avg_val: meta.defaultBaseline,
        min_val: Number((meta.defaultBaseline - meta.defaultVariation * 0.5).toFixed(meta.precision)),
        max_val: Number((meta.defaultBaseline + meta.defaultVariation * 0.5).toFixed(meta.precision)),
        anomalies: 2,
      },
    ];

    const alertsBySeverityAndStation = state.stations.map((s) => ({
      station_id: s.id,
      station_name: s.name,
      warning_alerts: state.alerts.filter((a) => a.station_id === s.id && a.severity === 'warning')
        .length,
      critical_alerts: state.alerts.filter(
        (a) => a.station_id === s.id && a.severity === 'critical'
      ).length,
    }));

    const availabilitySummaries = state.stations.map((s) => ({
      station_id: s.id,
      station_name: s.name,
      connectivity_status: s.connectivity_status,
      iot_probe_count: s.capabilities.filter((c) => c.data_source_type === 'continuous_iot_probe')
        .length,
      specialized_analyzer_count: s.capabilities.filter(
        (c) => c.data_source_type === 'specialized_analyzer'
      ).length,
      lab_sample_count: s.capabilities.filter((c) => c.data_source_type === 'lab_manual_sample')
        .length,
      recorded_samples_in_window: state.readings.filter((r) => r.station_id === s.id).length,
      availability_pct: s.connectivity_status === 'offline' ? 76.5 : 99.4,
      missing_data_notes:
        s.connectivity_status === 'offline'
          ? 'Station OFFLINE — missing recent telemetry intervals.'
          : 'Continuous telemetry normal.',
    }));

    return {
      selectedParameter: meta,
      parameterStatistics,
      dailySummaries,
      weeklySummaries: dailySummaries,
      monthlySummaries: dailySummaries,
      stationComparisons,
      alertsBySeverityAndStation,
      availabilitySummaries,
    };
  },

  getReportPreview(params: {
    stationIds?: string[];
    parameters?: ParameterCode[];
    includeAlerts?: boolean;
    reportMode?: 'summary' | 'detailed';
    title?: string;
  }) {
    const state = loadState();
    const stIds = params.stationIds || state.stations.map((s) => s.id);
    const pCodes = params.parameters || ALL_PARAMETERS_LIST.map((p) => p.code);
    const selectedStations = state.stations.filter((s) => stIds.includes(s.id));
    const readings = state.readings.filter(
      (r) => stIds.includes(r.station_id) && pCodes.includes(r.parameter)
    );

    const parameterStatistics: any[] = [];
    for (const s of selectedStations) {
      for (const p of pCodes) {
        const rows = readings.filter((r) => r.station_id === s.id && r.parameter === p);
        if (rows.length === 0) continue;
        const meta = PARAMETER_METADATA[p];
        const vals = rows.map((r) => r.value);
        parameterStatistics.push({
          station_id: s.id,
          station_name: s.name,
          parameter: p,
          parameter_name: meta.name,
          unit: meta.unit,
          sample_count: rows.length,
          min_val: Math.min(...vals),
          max_val: Math.max(...vals),
          avg_val: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(meta.precision)),
          anomaly_count: rows.filter((r) => r.quality_status !== 'normal').length,
        });
      }
    }

    return {
      reportTitle: params.title || 'AquaGuard Environmental Water Quality Monitoring Report',
      generatedAt: new Date().toISOString(),
      organizationName: state.settings.organization_name,
      reportMode: params.reportMode || 'summary',
      timeBounds: {
        startIso: new Date(Date.now() - 7 * 86400000).toISOString(),
        endIso: new Date().toISOString(),
        label: 'Selected Window',
      },
      containsSimulatedData: true,
      simulatedDataDisclosure:
        'DEMO DATA DISCLOSURE: This report contains simulated demonstration sensor measurements generated by the AquaGuard Simulation Engine.',
      stationSummaries: selectedStations.map((s) => ({
        ...s,
        readings_in_period: readings.filter((r) => r.station_id === s.id).length,
        alerts_in_period: state.alerts.filter((a) => a.station_id === s.id).length,
      })),
      parameterStatistics,
      readings,
      totalReadingsCount: readings.length,
      alerts: state.alerts.filter((a) => stIds.includes(a.station_id)),
      missingDataNotes: selectedStations
        .filter((s) => s.connectivity_status === 'offline')
        .map((s) => ({
          station_id: s.id,
          station_name: s.name,
          status: 'OFFLINE',
          note: `Station ${s.name} experienced telemetry disconnection.`,
        })),
    };
  },

  getSettings() {
    const state = loadState();
    return {
      settings: state.settings,
      rawSettings: [],
      simulation: state.simulation,
    };
  },

  updateSettings(payload: Record<string, unknown>) {
    const state = loadState();
    state.settings = { ...state.settings, ...payload };
    saveState(state);
    return {
      updated: true,
      simulation: state.simulation,
      settings: state.settings,
    };
  },

  resetDemoDatabase() {
    const initial = createInitialBrowserDb();
    saveState(initial);
    return { reset: true, message: 'Demonstration database reset to default seeded state.' };
  },

  switchDemoRole(role: 'admin' | 'operator'): { user: UserSession; token: string } {
    const user: UserSession =
      role === 'admin'
        ? {
            userId: 1,
            username: 'admin',
            email: 'admin@aquaguard.local',
            fullName: 'Dr. Elena Vance (Lead Hydrologist / Admin)',
            role: 'admin',
          }
        : {
            userId: 2,
            username: 'operator',
            email: 'operator@aquaguard.local',
            fullName: 'Marcus Chen (Shift Telemetry Operator)',
            role: 'operator',
          };
    return { user, token: `demo-token-${role}` };
  },
};
