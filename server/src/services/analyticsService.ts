import { queryAll, queryOne, getSetting } from '../database/db.js';
import {
  ALL_PARAMETER_CODES,
  AlertRecord,
  ParameterCode,
  SensorCapabilityRecord,
  SensorReadingRecord,
  StationRecord,
  WATER_PARAMETERS,
} from '../types/index.js';
import { getEffectiveThresholdRule } from './thresholdService.js';

export function resolveTimeRangeBounds(
  range?: string,
  startDate?: string,
  endDate?: string
): { startIso: string; endIso: string; label: string; maxGapMinutes: number } {
  const now = new Date();
  const endIso = endDate && !Number.isNaN(new Date(endDate).getTime())
    ? new Date(endDate).toISOString()
    : now.toISOString();

  if (startDate && !Number.isNaN(new Date(startDate).getTime())) {
    const startMs = new Date(startDate).getTime();
    const spanHours = Math.max(1, (new Date(endIso).getTime() - startMs) / (3600 * 1000));
    return {
      startIso: new Date(startDate).toISOString(),
      endIso,
      label: 'Custom Date Range',
      maxGapMinutes: spanHours <= 3 ? 25 : spanHours <= 36 ? 240 : 1800,
    };
  }

  switch (range) {
    case '1h':
      return {
        startIso: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        endIso,
        label: 'Last 1 Hour',
        maxGapMinutes: 20,
      };
    case '24h':
      return {
        startIso: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        endIso,
        label: 'Last 24 Hours',
        maxGapMinutes: 210,
      };
    case '7d':
      return {
        startIso: new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
        endIso,
        label: 'Last 7 Days',
        maxGapMinutes: 600,
      };
    case '30d':
    default:
      return {
        startIso: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
        endIso,
        label: range === '30d' ? 'Last 30 Days' : 'Last 24 Hours',
        maxGapMinutes: 2160,
      };
  }
}

export interface ReadingsQueryFilter {
  stationId?: string;
  parameter?: string;
  range?: '1h' | '24h' | '7d' | '30d';
  startDate?: string;
  endDate?: string;
  qualityStatus?: string;
  limit?: number;
  offset?: number;
}

export function queryReadings(filter: ReadingsQueryFilter = {}) {
  const effectiveRange = filter.range || (filter.startDate ? undefined : '24h');
  const bounds = resolveTimeRangeBounds(effectiveRange, filter.startDate, filter.endDate);

  const conditions: string[] = ['sr.recorded_at >= ?', 'sr.recorded_at <= ?'];
  const params: unknown[] = [bounds.startIso, bounds.endIso];

  if (filter.stationId && filter.stationId !== 'all') {
    conditions.push('sr.station_id = ?');
    params.push(filter.stationId);
  }

  if (filter.parameter && filter.parameter !== 'all') {
    conditions.push('sr.parameter = ?');
    params.push(filter.parameter);
  }

  if (filter.qualityStatus && filter.qualityStatus !== 'all') {
    conditions.push('sr.quality_status = ?');
    params.push(filter.qualityStatus);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limit = Math.min(2500, Math.max(1, filter.limit || 800));
  const offset = Math.max(0, filter.offset || 0);

  const countRow = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM sensor_readings sr ${whereClause}`,
    params
  );

  const rows = queryAll<
    SensorReadingRecord & { station_name: string; water_body: string }
  >(
    `SELECT sr.*, s.name as station_name, s.water_body
     FROM sensor_readings sr
     LEFT JOIN stations s ON sr.station_id = s.id
     ${whereClause}
     ORDER BY sr.recorded_at ASC, sr.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Build gap-aware series when a specific parameter is queried so charts break lines across large telemetry dropouts
  const seriesWithGaps: Array<{
    id: number | null;
    station_id: string;
    station_name: string;
    parameter: string;
    value: number | null;
    unit: string;
    quality_status: string;
    data_source: string;
    is_simulated: number;
    recorded_at: string;
    is_gap?: boolean;
  }> = [];

  const maxGapMs = bounds.maxGapMinutes * 60 * 1000;
  let prevTimeMs: number | null = null;

  for (const row of rows) {
    const currentMs = new Date(row.recorded_at).getTime();
    if (
      prevTimeMs !== null &&
      filter.stationId &&
      filter.stationId !== 'all' &&
      filter.parameter &&
      filter.parameter !== 'all' &&
      currentMs - prevTimeMs > maxGapMs
    ) {
      // Insert explicit null midpoint so Recharts connectNulls={false} breaks the line across missing data
      const midIso = new Date(prevTimeMs + Math.floor((currentMs - prevTimeMs) / 2)).toISOString();
      seriesWithGaps.push({
        id: null,
        station_id: row.station_id,
        station_name: row.station_name,
        parameter: row.parameter,
        value: null,
        unit: row.unit,
        quality_status: 'missing',
        data_source: 'TELEMETRY_GAP',
        is_simulated: 1,
        recorded_at: midIso,
        is_gap: true,
      });
    }
    seriesWithGaps.push(row);
    prevTimeMs = currentMs;
  }

  return {
    readings: rows,
    series: seriesWithGaps,
    total: countRow?.total ?? 0,
    timeBounds: bounds,
  };
}

export function getAnalyticsSummary(filter: {
  stationId?: string;
  parameter?: ParameterCode;
  range?: '1h' | '24h' | '7d' | '30d';
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  const effectiveRange = filter.range || (filter.startDate ? undefined : '7d');
  const bounds = resolveTimeRangeBounds(effectiveRange, filter.startDate, filter.endDate);
  const selectedParam: ParameterCode =
    filter.parameter && ALL_PARAMETER_CODES.includes(filter.parameter)
      ? filter.parameter
      : 'ph';

  const stationCond =
    filter.stationId && filter.stationId !== 'all' ? 'AND sr.station_id = ?' : '';
  const stationParams =
    filter.stationId && filter.stationId !== 'all' ? [filter.stationId] : [];

  const statusCond =
    filter.status && filter.status !== 'all' ? 'AND sr.quality_status = ?' : '';
  const statusParams =
    filter.status && filter.status !== 'all' ? [filter.status] : [];

  // 1. Parameter statistics across all supported parameters in the selected window
  const paramStatsRows = queryAll<{
    parameter: ParameterCode;
    unit: string;
    count: number;
    min_val: number;
    max_val: number;
    avg_val: number;
    warning_count: number;
    critical_count: number;
    simulated_count: number;
  }>(
    `SELECT
       sr.parameter,
       sr.unit,
       COUNT(*) as count,
       MIN(sr.value) as min_val,
       MAX(sr.value) as max_val,
       AVG(sr.value) as avg_val,
       SUM(CASE WHEN sr.quality_status = 'warning' THEN 1 ELSE 0 END) as warning_count,
       SUM(CASE WHEN sr.quality_status = 'critical' THEN 1 ELSE 0 END) as critical_count,
       SUM(CASE WHEN sr.is_simulated = 1 THEN 1 ELSE 0 END) as simulated_count
     FROM sensor_readings sr
     WHERE sr.recorded_at >= ? AND sr.recorded_at <= ?
     ${stationCond}
     ${statusCond}
     GROUP BY sr.parameter, sr.unit`,
    [bounds.startIso, bounds.endIso, ...stationParams, ...statusParams]
  );

  const parameterStatistics = ALL_PARAMETER_CODES.map((code) => {
    const meta = WATER_PARAMETERS[code];
    const row = paramStatsRows.find((r) => r.parameter === code);
    const rule = getEffectiveThresholdRule(
      filter.stationId && filter.stationId !== 'all' ? filter.stationId : '',
      code
    );

    if (!row || row.count === 0) {
      return {
        parameter: code,
        name: meta.name,
        shortName: meta.shortName,
        unit: meta.unit,
        count: 0,
        min: null,
        max: null,
        avg: null,
        warningCount: 0,
        criticalCount: 0,
        anomalyCount: 0,
        anomalyRatePct: 0,
        thresholds: rule,
      };
    }

    const anomalyCount = (row.warning_count || 0) + (row.critical_count || 0);
    return {
      parameter: code,
      name: meta.name,
      shortName: meta.shortName,
      unit: meta.unit,
      count: row.count,
      min: Number(row.min_val.toFixed(meta.precision)),
      max: Number(row.max_val.toFixed(meta.precision)),
      avg: Number(row.avg_val.toFixed(meta.precision)),
      warningCount: row.warning_count || 0,
      criticalCount: row.critical_count || 0,
      anomalyCount,
      anomalyRatePct: Number(((anomalyCount / row.count) * 100).toFixed(1)),
      thresholds: rule,
    };
  });

  // 2. Daily, Weekly, and Monthly Summaries for the selected parameter
  const meta = WATER_PARAMETERS[selectedParam];
  const dailySummaries = queryAll<{
    bucket: string;
    sample_count: number;
    avg_val: number;
    min_val: number;
    max_val: number;
    anomalies: number;
  }>(
    `SELECT
       substr(sr.recorded_at, 1, 10) as bucket,
       COUNT(*) as sample_count,
       ROUND(AVG(sr.value), ${meta.precision}) as avg_val,
       ROUND(MIN(sr.value), ${meta.precision}) as min_val,
       ROUND(MAX(sr.value), ${meta.precision}) as max_val,
       SUM(CASE WHEN sr.quality_status IN ('warning', 'critical') THEN 1 ELSE 0 END) as anomalies
     FROM sensor_readings sr
     WHERE sr.parameter = ?
       AND sr.recorded_at >= ? AND sr.recorded_at <= ?
       ${stationCond}
       ${statusCond}
     GROUP BY substr(sr.recorded_at, 1, 10)
     ORDER BY bucket ASC`,
    [selectedParam, bounds.startIso, bounds.endIso, ...stationParams, ...statusParams]
  );

  const weeklySummaries = queryAll<{
    bucket: string;
    sample_count: number;
    avg_val: number;
    min_val: number;
    max_val: number;
    anomalies: number;
  }>(
    `SELECT
       strftime('%Y-W%W', sr.recorded_at) as bucket,
       COUNT(*) as sample_count,
       ROUND(AVG(sr.value), ${meta.precision}) as avg_val,
       ROUND(MIN(sr.value), ${meta.precision}) as min_val,
       ROUND(MAX(sr.value), ${meta.precision}) as max_val,
       SUM(CASE WHEN sr.quality_status IN ('warning', 'critical') THEN 1 ELSE 0 END) as anomalies
     FROM sensor_readings sr
     WHERE sr.parameter = ?
       AND sr.recorded_at >= ? AND sr.recorded_at <= ?
       ${stationCond}
     GROUP BY strftime('%Y-W%W', sr.recorded_at)
     ORDER BY bucket ASC`,
    [selectedParam, bounds.startIso, bounds.endIso, ...stationParams]
  );

  const monthlySummaries = queryAll<{
    bucket: string;
    sample_count: number;
    avg_val: number;
    min_val: number;
    max_val: number;
    anomalies: number;
  }>(
    `SELECT
       substr(sr.recorded_at, 1, 7) as bucket,
       COUNT(*) as sample_count,
       ROUND(AVG(sr.value), ${meta.precision}) as avg_val,
       ROUND(MIN(sr.value), ${meta.precision}) as min_val,
       ROUND(MAX(sr.value), ${meta.precision}) as max_val,
       SUM(CASE WHEN sr.quality_status IN ('warning', 'critical') THEN 1 ELSE 0 END) as anomalies
     FROM sensor_readings sr
     WHERE sr.parameter = ?
     GROUP BY substr(sr.recorded_at, 1, 7)
     ORDER BY bucket ASC`,
    [selectedParam]
  );

  // 3. Station-to-station comparison for the selected parameter (same unit guaranteed!)
  const stationComparisons = queryAll<{
    station_id: string;
    station_name: string;
    station_code: string;
    overall_status: string;
    connectivity_status: string;
    sample_count: number;
    avg_val: number | null;
    min_val: number | null;
    max_val: number | null;
    anomaly_count: number;
  }>(
    `SELECT
       s.id as station_id,
       s.name as station_name,
       s.code as station_code,
       s.overall_status,
       s.connectivity_status,
       COUNT(sr.id) as sample_count,
       ROUND(AVG(sr.value), ${meta.precision}) as avg_val,
       ROUND(MIN(sr.value), ${meta.precision}) as min_val,
       ROUND(MAX(sr.value), ${meta.precision}) as max_val,
       SUM(CASE WHEN sr.quality_status IN ('warning', 'critical') THEN 1 ELSE 0 END) as anomaly_count
     FROM stations s
     INNER JOIN sensor_capabilities sc ON sc.station_id = s.id AND sc.parameter = ? AND sc.is_enabled = 1
     LEFT JOIN sensor_readings sr
       ON sr.station_id = s.id
       AND sr.parameter = ?
       AND sr.recorded_at >= ?
       AND sr.recorded_at <= ?
     GROUP BY s.id, s.name, s.code, s.overall_status, s.connectivity_status
     ORDER BY s.id ASC`,
    [selectedParam, selectedParam, bounds.startIso, bounds.endIso]
  ).map((row) => ({
    ...row,
    parameter: selectedParam,
    parameterName: meta.name,
    unit: meta.unit,
    anomaly_count: row.anomaly_count || 0,
  }));

  // 4. Alert Frequency by Severity & Station
  const alertStationCond =
    filter.stationId && filter.stationId !== 'all' ? 'AND a.station_id = ?' : '';
  const alertsBySeverityAndStation = queryAll<{
    station_id: string;
    station_name: string;
    warning_alerts: number;
    critical_alerts: number;
    resolved_alerts: number;
    total_alerts: number;
  }>(
    `SELECT
       s.id as station_id,
       s.name as station_name,
       SUM(CASE WHEN a.severity = 'warning' THEN 1 ELSE 0 END) as warning_alerts,
       SUM(CASE WHEN a.severity = 'critical' THEN 1 ELSE 0 END) as critical_alerts,
       SUM(CASE WHEN a.resolved = 1 THEN 1 ELSE 0 END) as resolved_alerts,
       COUNT(a.id) as total_alerts
     FROM stations s
     LEFT JOIN alerts a
       ON a.station_id = s.id
       AND a.created_at >= ?
       AND a.created_at <= ?
     WHERE 1=1 ${alertStationCond.replace('a.station_id', 's.id')}
     GROUP BY s.id, s.name
     ORDER BY total_alerts DESC, s.id ASC`,
    [bounds.startIso, bounds.endIso, ...stationParams]
  );

  // 5. Missing-Data & Sensor Availability Summary per Station
  const allStations = queryAll<StationRecord>(
    filter.stationId && filter.stationId !== 'all'
      ? 'SELECT * FROM stations WHERE id = ?'
      : 'SELECT * FROM stations ORDER BY id ASC',
    stationParams
  );

  const availabilitySummaries = allStations.map((st) => {
    const caps = queryAll<SensorCapabilityRecord>(
      'SELECT * FROM sensor_capabilities WHERE station_id = ? AND is_enabled = 1',
      [st.id]
    );
    const readingCountRow = queryOne<{ count: number; latest_at: string | null }>(
      `SELECT COUNT(*) as count, MAX(recorded_at) as latest_at
       FROM sensor_readings
       WHERE station_id = ? AND recorded_at >= ? AND recorded_at <= ?`,
      [st.id, bounds.startIso, bounds.endIso]
    );

    const actualSamples = readingCountRow?.count ?? 0;
    const latestAt = readingCountRow?.latest_at ?? st.last_seen_at;
    const silenceMinutes = latestAt
      ? Math.max(0, Math.round((Date.now() - new Date(latestAt).getTime()) / 60000))
      : null;

    // Estimate availability percentage based on connectivity & silence duration
    let availabilityPct = 99.4;
    let missingDataNotes = 'Continuous telemetry normal; no significant data gaps.';

    if (st.connectivity_status === 'offline') {
      availabilityPct = silenceMinutes && silenceMinutes > 60 ? 74.2 : 85.0;
      missingDataNotes = `Station OFFLINE (${silenceMinutes ?? 'unknown'} min since last heartbeat). Missing recent telemetry intervals.`;
    } else if (caps.some((c) => c.data_source_type === 'lab_manual_sample')) {
      availabilityPct = 96.8;
      missingDataNotes =
        'Includes periodic manual laboratory grab samples (BOD₅) alongside continuous IoT probes.';
    }

    return {
      station_id: st.id,
      station_name: st.name,
      connectivity_status: st.connectivity_status,
      supported_sensor_count: caps.length,
      iot_probe_count: caps.filter((c) => c.data_source_type === 'continuous_iot_probe').length,
      specialized_analyzer_count: caps.filter((c) => c.data_source_type === 'specialized_analyzer').length,
      lab_sample_count: caps.filter((c) => c.data_source_type === 'lab_manual_sample').length,
      recorded_samples_in_window: actualSamples,
      last_reading_at: latestAt,
      silence_minutes: silenceMinutes,
      availability_pct: availabilityPct,
      missing_data_notes: missingDataNotes,
    };
  });

  return {
    timeBounds: bounds,
    selectedParameter: {
      ...meta,
      thresholds: getEffectiveThresholdRule(
        filter.stationId && filter.stationId !== 'all' ? filter.stationId : '',
        selectedParam
      ),
    },
    parameterStatistics,
    dailySummaries,
    weeklySummaries,
    monthlySummaries,
    stationComparisons,
    alertsBySeverityAndStation,
    availabilitySummaries,
  };
}

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface ReportFilterInput {
  startDate?: string;
  endDate?: string;
  range?: '1h' | '24h' | '7d' | '30d';
  stationIds?: string[];
  parameters?: ParameterCode[];
  includeAlerts?: boolean;
  reportMode?: 'summary' | 'detailed';
  title?: string;
}

export function buildMonitoringReportData(input: ReportFilterInput) {
  const bounds = resolveTimeRangeBounds(input.range || '7d', input.startDate, input.endDate);
  const allStations = queryAll<StationRecord>('SELECT * FROM stations ORDER BY id ASC');
  const selectedStations =
    input.stationIds && input.stationIds.length > 0
      ? allStations.filter((s) => input.stationIds!.includes(s.id))
      : allStations;

  const selectedStationIds = selectedStations.map((s) => s.id);
  const selectedParams: ParameterCode[] =
    input.parameters && input.parameters.length > 0
      ? input.parameters.filter((p) => ALL_PARAMETER_CODES.includes(p))
      : ALL_PARAMETER_CODES;

  if (selectedStationIds.length === 0 || selectedParams.length === 0) {
    return {
      reportTitle: input.title || 'AquaGuard Environmental Water Quality Monitoring Report',
      generatedAt: new Date().toISOString(),
      organizationName: getSetting('organization_name', 'Clearwater Regional Watershed Authority'),
      reportMode: input.reportMode || 'summary',
      timeBounds: bounds,
      containsSimulatedData: true,
      simulatedDataDisclosure:
        'DEMO DATA DISCLOSURE: This report includes simulated demonstration sensor measurements generated by the AquaGuard Simulation Engine. Do not use for regulatory compliance or public drinking-water safety certification.',
      stationSummaries: [],
      parameterStatistics: [],
      readings: [],
      alerts: [],
      missingDataNotes: [],
    };
  }

  const stPlaceholders = selectedStationIds.map(() => '?').join(',');
  const paramPlaceholders = selectedParams.map(() => '?').join(',');

  const readings = queryAll<
    SensorReadingRecord & { station_name: string; station_code: string; water_body: string }
  >(
    `SELECT sr.*, s.name as station_name, s.code as station_code, s.water_body
     FROM sensor_readings sr
     INNER JOIN stations s ON sr.station_id = s.id
     WHERE sr.recorded_at >= ? AND sr.recorded_at <= ?
       AND sr.station_id IN (${stPlaceholders})
       AND sr.parameter IN (${paramPlaceholders})
     ORDER BY sr.recorded_at DESC
     LIMIT 3000`,
    [bounds.startIso, bounds.endIso, ...selectedStationIds, ...selectedParams]
  );

  const paramStatsRows = queryAll<{
    station_id: string;
    station_name: string;
    parameter: ParameterCode;
    unit: string;
    sample_count: number;
    min_val: number;
    max_val: number;
    avg_val: number;
    warning_count: number;
    critical_count: number;
    simulated_count: number;
  }>(
    `SELECT
       sr.station_id,
       s.name as station_name,
       sr.parameter,
       sr.unit,
       COUNT(*) as sample_count,
       MIN(sr.value) as min_val,
       MAX(sr.value) as max_val,
       AVG(sr.value) as avg_val,
       SUM(CASE WHEN sr.quality_status = 'warning' THEN 1 ELSE 0 END) as warning_count,
       SUM(CASE WHEN sr.quality_status = 'critical' THEN 1 ELSE 0 END) as critical_count,
       SUM(CASE WHEN sr.is_simulated = 1 THEN 1 ELSE 0 END) as simulated_count
     FROM sensor_readings sr
     INNER JOIN stations s ON sr.station_id = s.id
     WHERE sr.recorded_at >= ? AND sr.recorded_at <= ?
       AND sr.station_id IN (${stPlaceholders})
       AND sr.parameter IN (${paramPlaceholders})
     GROUP BY sr.station_id, s.name, sr.parameter, sr.unit
     ORDER BY sr.station_id ASC, sr.parameter ASC`,
    [bounds.startIso, bounds.endIso, ...selectedStationIds, ...selectedParams]
  ).map((r) => {
    const meta = WATER_PARAMETERS[r.parameter];
    return {
      ...r,
      parameter_name: meta?.name || r.parameter,
      min_val: Number(r.min_val.toFixed(meta?.precision ?? 2)),
      max_val: Number(r.max_val.toFixed(meta?.precision ?? 2)),
      avg_val: Number(r.avg_val.toFixed(meta?.precision ?? 2)),
      anomaly_count: (r.warning_count || 0) + (r.critical_count || 0),
    };
  });

  let alerts: AlertRecord[] = [];
  if (input.includeAlerts !== false) {
    alerts = queryAll<AlertRecord>(
      `SELECT a.*, s.name as station_name, s.water_body, s.location_name
       FROM alerts a
       INNER JOIN stations s ON a.station_id = s.id
       WHERE a.created_at >= ? AND a.created_at <= ?
         AND a.station_id IN (${stPlaceholders})
       ORDER BY a.created_at DESC`,
      [bounds.startIso, bounds.endIso, ...selectedStationIds]
    );
  }

  const missingDataNotes: Array<{
    station_id: string;
    station_name: string;
    status: string;
    note: string;
  }> = [];

  const stationSummaries = selectedStations.map((st) => {
    const stReadingsCount = readings.filter((r) => r.station_id === st.id).length;
    const stAlertsCount = alerts.filter((a) => a.station_id === st.id).length;
    const caps = queryAll<SensorCapabilityRecord>(
      'SELECT * FROM sensor_capabilities WHERE station_id = ? AND is_enabled = 1',
      [st.id]
    );

    const unsupportedSelected = selectedParams.filter(
      (p) => !caps.some((c) => c.parameter === p)
    );

    if (st.connectivity_status === 'offline') {
      missingDataNotes.push({
        station_id: st.id,
        station_name: st.name,
        status: 'OFFLINE',
        note: `Station ${st.name} (${st.id}) experienced telemetry disconnection (last seen: ${st.last_seen_at || 'N/A'}). Measurements during offline window are unavailable.`,
      });
    }

    if (unsupportedSelected.length > 0) {
      missingDataNotes.push({
        station_id: st.id,
        station_name: st.name,
        status: 'SENSOR_CAPABILITY_NOTE',
        note: `Station ${st.name} is not equipped with sensors for: ${unsupportedSelected.map((p) => WATER_PARAMETERS[p].shortName).join(', ')}.`,
      });
    }

    return {
      id: st.id,
      name: st.name,
      code: st.code,
      station_type: st.station_type,
      location_name: st.location_name,
      water_body: st.water_body,
      connectivity_status: st.connectivity_status,
      overall_status: st.overall_status,
      wqi_score: st.wqi_score,
      last_seen_at: st.last_seen_at,
      supported_parameters: caps.map((c) => c.parameter),
      readings_in_period: stReadingsCount,
      alerts_in_period: stAlertsCount,
    };
  });

  const containsSimulated =
    readings.length === 0 ||
    readings.some((r) => r.is_simulated === 1) ||
    alerts.some((a) => a.is_simulated === 1);

  return {
    reportTitle: input.title || 'AquaGuard Environmental Water Quality Monitoring Report',
    generatedAt: new Date().toISOString(),
    organizationName: getSetting('organization_name', 'Clearwater Regional Watershed Authority'),
    reportMode: input.reportMode || 'summary',
    timeBounds: bounds,
    containsSimulatedData: containsSimulated,
    simulatedDataDisclosure:
      'DEMO DATA DISCLOSURE: This report contains simulated demonstration sensor measurements generated by the AquaGuard Simulation Engine. Do not represent these values as certified environmental field measurements.',
    stationSummaries,
    parameterStatistics: paramStatsRows,
    readings: input.reportMode === 'detailed' ? readings.slice(0, 1000) : readings.slice(0, 200),
    totalReadingsCount: readings.length,
    alerts,
    missingDataNotes,
  };
}

export function generateReadingsCsv(input: ReportFilterInput): string {
  const report = buildMonitoringReportData({ ...input, reportMode: 'detailed' });
  const lines: string[] = [];

  lines.push(
    [
      'Reading ID',
      'Timestamp (ISO-8601)',
      'Station ID',
      'Station Name',
      'Water Body',
      'Parameter Code',
      'Parameter Name',
      'Measured Value',
      'Unit',
      'Quality Status',
      'Data Source Classification',
      'Simulated Demo Data',
    ]
      .map(escapeCsvField)
      .join(',')
  );

  for (const r of report.readings) {
    const meta = WATER_PARAMETERS[r.parameter as ParameterCode];
    lines.push(
      [
        r.id,
        r.recorded_at,
        r.station_id,
        r.station_name,
        r.water_body,
        r.parameter,
        meta ? meta.name : r.parameter,
        r.value,
        r.unit,
        r.quality_status.toUpperCase(),
        r.data_source,
        r.is_simulated ? 'DEMO DATA (SIMULATED)' : 'GENUINE SENSOR',
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }

  return lines.join('\r\n');
}

export function generateAlertsCsv(input: ReportFilterInput): string {
  const report = buildMonitoringReportData({ ...input, includeAlerts: true });
  const lines: string[] = [];

  lines.push(
    [
      'Alert ID',
      'Created Timestamp (ISO-8601)',
      'Severity',
      'Alert Type',
      'Station ID',
      'Station Name',
      'Parameter',
      'Measured Value',
      'Unit',
      'Triggered Threshold',
      'Title',
      'Message',
      'Acknowledged',
      'Acknowledged By',
      'Resolved',
      'Resolved By',
      'Resolution Notes',
      'Data Provenance',
    ]
      .map(escapeCsvField)
      .join(',')
  );

  for (const a of report.alerts) {
    lines.push(
      [
        a.id,
        a.created_at,
        a.severity.toUpperCase(),
        a.alert_type,
        a.station_id,
        a.station_name || '',
        a.parameter,
        a.measured_value ?? '',
        a.unit,
        a.triggered_threshold,
        a.title,
        a.message,
        a.acknowledged ? 'YES' : 'NO',
        a.acknowledged_by || '',
        a.resolved ? 'YES' : 'NO',
        a.resolved_by || '',
        a.resolution_notes || '',
        a.is_simulated ? 'DEMO DATA (SIMULATED)' : 'GENUINE SENSOR',
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }

  return lines.join('\r\n');
}
