import { queryAll, queryOne, execute, runInTransaction } from '../database/db.js';
import {
  ALL_PARAMETER_CODES,
  DataSourceType,
  ParameterCode,
  SensorCapabilityRecord,
  SensorReadingRecord,
  StationRecord,
  WATER_PARAMETERS,
} from '../types/index.js';
import {
  recalculateStationOverallStatus,
  triggerStationOfflineAlert,
} from './alertService.js';
import {
  getEffectiveThresholdRule,
  validateThresholdConfig,
} from './thresholdService.js';
import {
  updateStationMetricsAfterReading,
  validateAndIngestReading,
} from './ingestionService.js';

export interface StationWithDetails extends StationRecord {
  capabilities: SensorCapabilityRecord[];
  latestReadings: Record<string, SensorReadingRecord & { previous_value?: number | null; trend_delta?: number | null; warning_limit?: string | null; critical_limit?: string | null }>;
  activeAlertsCount: number;
  criticalAlertsCount: number;
}

export function listStations(filter?: {
  search?: string;
  status?: string;
  connectivity?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): StationWithDetails[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.status && filter.status !== 'all') {
    if (filter.status === 'attention') {
      conditions.push("overall_status IN ('warning', 'critical', 'offline')");
    } else {
      conditions.push('overall_status = ?');
      params.push(filter.status);
    }
  }

  if (filter?.connectivity && filter.connectivity !== 'all') {
    conditions.push('connectivity_status = ?');
    params.push(filter.connectivity);
  }

  if (filter?.search && filter.search.trim() !== '') {
    const q = `%${filter.search.trim()}%`;
    conditions.push(
      '(id LIKE ? OR name LIKE ? OR code LIKE ? OR location_name LIKE ? OR water_body LIKE ? OR station_type LIKE ?)'
    );
    params.push(q, q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const allowedSorts: Record<string, string> = {
    id: 'id',
    name: 'name',
    overall_status: "CASE overall_status WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 WHEN 'offline' THEN 3 ELSE 4 END",
    wqi_score: 'wqi_score',
    last_seen_at: 'last_seen_at',
    water_body: 'water_body',
  };
  const sortCol = allowedSorts[filter?.sortBy || 'id'] || 'id';
  const sortDir = filter?.sortDir === 'desc' ? 'DESC' : 'ASC';

  const stations = queryAll<StationRecord>(
    `SELECT * FROM stations ${whereClause} ORDER BY ${sortCol} ${sortDir}`,
    params
  );

  return stations.map((st) => enrichStationWithDetails(st));
}

export function getStationById(stationId: string): StationWithDetails | null {
  const station = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId]);
  if (!station) return null;
  return enrichStationWithDetails(station);
}

export function enrichStationWithDetails(station: StationRecord): StationWithDetails {
  const capabilities = queryAll<SensorCapabilityRecord>(
    'SELECT * FROM sensor_capabilities WHERE station_id = ? ORDER BY id ASC',
    [station.id]
  );

  const latestReadingsMap: StationWithDetails['latestReadings'] = {};

  for (const cap of capabilities) {
    const recentTwo = queryAll<SensorReadingRecord>(
      `SELECT * FROM sensor_readings
       WHERE station_id = ? AND parameter = ?
       ORDER BY recorded_at DESC, id DESC
       LIMIT 2`,
      [station.id, cap.parameter]
    );

    if (recentTwo.length > 0) {
      const latest = recentTwo[0];
      const prev = recentTwo.length > 1 ? recentTwo[1] : null;
      const rule = getEffectiveThresholdRule(station.id, cap.parameter);

      let warningLimit: string | null = null;
      let criticalLimit: string | null = null;
      if (rule) {
        if (rule.min_warning !== null && rule.max_warning !== null) {
          warningLimit = `${rule.min_warning} – ${rule.max_warning} ${rule.unit}`;
        } else if (rule.max_warning !== null) {
          warningLimit = `≤ ${rule.max_warning} ${rule.unit}`;
        } else if (rule.min_warning !== null) {
          warningLimit = `≥ ${rule.min_warning} ${rule.unit}`;
        }

        if (rule.min_critical !== null && rule.max_critical !== null) {
          criticalLimit = `< ${rule.min_critical} or > ${rule.max_critical} ${rule.unit}`;
        } else if (rule.max_critical !== null) {
          criticalLimit = `> ${rule.max_critical} ${rule.unit}`;
        } else if (rule.min_critical !== null) {
          criticalLimit = `< ${rule.min_critical} ${rule.unit}`;
        }
      }

      latestReadingsMap[cap.parameter] = {
        ...latest,
        previous_value: prev ? prev.value : null,
        trend_delta: prev ? Number((latest.value - prev.value).toFixed(3)) : 0,
        warning_limit: warningLimit,
        critical_limit: criticalLimit,
      };
    }
  }

  const alertCounts = queryOne<{ activeCount: number; critCount: number }>(
    `SELECT
       COUNT(*) as activeCount,
       SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critCount
     FROM alerts
     WHERE station_id = ? AND resolved = 0`,
    [station.id]
  );

  return {
    ...station,
    capabilities,
    latestReadings: latestReadingsMap,
    activeAlertsCount: alertCounts?.activeCount ?? 0,
    criticalAlertsCount: alertCounts?.critCount ?? 0,
  };
}

export interface CreateStationInput {
  id?: string;
  name: string;
  code: string;
  station_type: string;
  location_name: string;
  water_body: string;
  latitude: number;
  longitude: number;
  is_fictional_location?: boolean;
  connectivity_status?: 'online' | 'offline';
  firmware_version?: string;
  sampling_interval_sec?: number;
  description?: string;
  supported_parameters: Array<
    | ParameterCode
    | {
        parameter: ParameterCode;
        data_source_type?: DataSourceType;
        sensor_model?: string;
        baseline_value?: number;
        variation_range?: number;
      }
  >;
}

export function createStation(input: CreateStationInput): {
  station?: StationWithDetails;
  errors?: string[];
} {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length < 3) {
    errors.push('Station name must be at least 3 characters.');
  }
  if (!input.code || input.code.trim().length < 2) {
    errors.push('Station code must be at least 2 characters.');
  }
  if (!input.location_name || input.location_name.trim().length < 3) {
    errors.push('Monitoring location description is required.');
  }
  if (!input.water_body || input.water_body.trim().length < 2) {
    errors.push('Water body or facility name is required.');
  }
  if (
    typeof input.latitude !== 'number' ||
    Number.isNaN(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90
  ) {
    errors.push('Latitude must be a valid coordinate between -90 and 90.');
  }
  if (
    typeof input.longitude !== 'number' ||
    Number.isNaN(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    errors.push('Longitude must be a valid coordinate between -180 and 180.');
  }
  if (!Array.isArray(input.supported_parameters) || input.supported_parameters.length === 0) {
    errors.push('Select at least one supported sensor parameter for the station.');
  }

  if (errors.length > 0) return { errors };

  const stationId =
    input.id && input.id.trim() !== ''
      ? input.id.trim().toUpperCase()
      : `STN-${input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${Math.floor(10 + Math.random() * 89)}`;

  const existingId = queryOne('SELECT id FROM stations WHERE id = ?', [stationId]);
  if (existingId) {
    return { errors: [`A station with ID '${stationId}' already exists.`] };
  }

  const existingCode = queryOne('SELECT id FROM stations WHERE UPPER(code) = UPPER(?)', [
    input.code.trim(),
  ]);
  if (existingCode) {
    return { errors: [`A station with code '${input.code.trim()}' already exists.`] };
  }

  const now = new Date().toISOString();
  const connStatus = input.connectivity_status || 'online';

  runInTransaction(() => {
    execute(
      `INSERT INTO stations (
        id, name, code, station_type, location_name, water_body,
        latitude, longitude, is_fictional_location, connectivity_status,
        overall_status, wqi_score, firmware_version, sampling_interval_sec,
        description, last_seen_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 92.0, ?, ?, ?, ?, ?, ?)`,
      [
        stationId,
        input.name.trim(),
        input.code.trim().toUpperCase(),
        input.station_type || 'River upstream monitoring point',
        input.location_name.trim(),
        input.water_body.trim(),
        input.latitude,
        input.longitude,
        input.is_fictional_location === false ? 0 : 1,
        connStatus,
        connStatus === 'offline' ? 'offline' : 'normal',
        input.firmware_version || 'v3.6.0-SolarIoT',
        input.sampling_interval_sec || 5,
        input.description || '',
        connStatus === 'online' ? now : null,
        now,
        now,
      ]
    );

    for (const item of input.supported_parameters) {
      const paramCode = typeof item === 'string' ? item : item.parameter;
      if (!ALL_PARAMETER_CODES.includes(paramCode)) continue;
      const meta = WATER_PARAMETERS[paramCode];
      const sourceType =
        typeof item === 'object' && item.data_source_type
          ? item.data_source_type
          : meta.defaultSourceType;
      const sensorModel =
        typeof item === 'object' && item.sensor_model
          ? item.sensor_model
          : meta.defaultSensorModel;
      const baseline =
        typeof item === 'object' && typeof item.baseline_value === 'number'
          ? item.baseline_value
          : meta.defaultBaseline;
      const variation =
        typeof item === 'object' && typeof item.variation_range === 'number'
          ? item.variation_range
          : meta.defaultVariation;

      execute(
        `INSERT INTO sensor_capabilities (
          station_id, parameter, unit, data_source_type, sensor_model,
          is_enabled, baseline_value, variation_range
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [stationId, paramCode, meta.unit, sourceType, sensorModel, baseline, variation]
      );

      if (connStatus === 'online') {
        validateAndIngestReading({
          station_id: stationId,
          parameter: paramCode,
          value: baseline,
          unit: meta.unit,
          data_source: 'DEMO_SIMULATION',
          is_simulated: true,
          recorded_at: now,
        });
      }
    }

    if (connStatus === 'offline') {
      const stRecord = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId])!;
      triggerStationOfflineAlert(stRecord, true, now);
    }
  });

  const created = getStationById(stationId)!;
  return { station: created };
}

export function updateStation(
  stationId: string,
  updates: Partial<CreateStationInput>
): { station?: StationWithDetails; errors?: string[] } {
  const existing = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId]);
  if (!existing) {
    return { errors: [`Station '${stationId}' not found.`] };
  }

  const errors: string[] = [];
  if (updates.name !== undefined && updates.name.trim().length < 3) {
    errors.push('Station name must be at least 3 characters.');
  }
  if (
    updates.latitude !== undefined &&
    (Number.isNaN(updates.latitude) || updates.latitude < -90 || updates.latitude > 90)
  ) {
    errors.push('Latitude must be between -90 and 90.');
  }
  if (
    updates.longitude !== undefined &&
    (Number.isNaN(updates.longitude) || updates.longitude < -180 || updates.longitude > 180)
  ) {
    errors.push('Longitude must be between -180 and 180.');
  }

  if (errors.length > 0) return { errors };

  const now = new Date().toISOString();
  const nextConn = updates.connectivity_status ?? existing.connectivity_status;

  runInTransaction(() => {
    execute(
      `UPDATE stations
       SET name = ?,
           code = ?,
           station_type = ?,
           location_name = ?,
           water_body = ?,
           latitude = ?,
           longitude = ?,
           connectivity_status = ?,
           firmware_version = ?,
           sampling_interval_sec = ?,
           description = ?,
           last_seen_at = CASE WHEN ? = 'online' AND ? = 'offline' THEN ? ELSE last_seen_at END,
           updated_at = ?
       WHERE id = ?`,
      [
        updates.name ? updates.name.trim() : existing.name,
        updates.code ? updates.code.trim().toUpperCase() : existing.code,
        updates.station_type ?? existing.station_type,
        updates.location_name ? updates.location_name.trim() : existing.location_name,
        updates.water_body ? updates.water_body.trim() : existing.water_body,
        updates.latitude ?? existing.latitude,
        updates.longitude ?? existing.longitude,
        nextConn,
        updates.firmware_version ?? existing.firmware_version,
        updates.sampling_interval_sec ?? existing.sampling_interval_sec,
        updates.description ?? existing.description,
        nextConn,
        existing.connectivity_status,
        now,
        now,
        stationId,
      ]
    );

    if (Array.isArray(updates.supported_parameters) && updates.supported_parameters.length > 0) {
      const requestedParams = new Set<ParameterCode>();
      for (const item of updates.supported_parameters) {
        const paramCode = typeof item === 'string' ? item : item.parameter;
        if (!ALL_PARAMETER_CODES.includes(paramCode)) continue;
        requestedParams.add(paramCode);

        const meta = WATER_PARAMETERS[paramCode];
        const existingCap = queryOne<SensorCapabilityRecord>(
          'SELECT * FROM sensor_capabilities WHERE station_id = ? AND parameter = ?',
          [stationId, paramCode]
        );

        if (existingCap) {
          const sourceType =
            typeof item === 'object' && item.data_source_type
              ? item.data_source_type
              : existingCap.data_source_type;
          const baseline =
            typeof item === 'object' && typeof item.baseline_value === 'number'
              ? item.baseline_value
              : existingCap.baseline_value;

          execute(
            `UPDATE sensor_capabilities
             SET is_enabled = 1, data_source_type = ?, baseline_value = ?
             WHERE id = ?`,
            [sourceType, baseline, existingCap.id]
          );
        } else {
          const sourceType =
            typeof item === 'object' && item.data_source_type
              ? item.data_source_type
              : meta.defaultSourceType;
          const baseline =
            typeof item === 'object' && typeof item.baseline_value === 'number'
              ? item.baseline_value
              : meta.defaultBaseline;

          execute(
            `INSERT INTO sensor_capabilities (
              station_id, parameter, unit, data_source_type, sensor_model,
              is_enabled, baseline_value, variation_range
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            [
              stationId,
              paramCode,
              meta.unit,
              sourceType,
              meta.defaultSensorModel,
              baseline,
              meta.defaultVariation,
            ]
          );

          if (nextConn === 'online') {
            validateAndIngestReading({
              station_id: stationId,
              parameter: paramCode,
              value: baseline,
              unit: meta.unit,
              data_source: 'DEMO_SIMULATION',
              is_simulated: true,
              recorded_at: now,
            });
          }
        }
      }

      // Disable capabilities not in the updated list
      const allStationCaps = queryAll<SensorCapabilityRecord>(
        'SELECT * FROM sensor_capabilities WHERE station_id = ?',
        [stationId]
      );
      for (const cap of allStationCaps) {
        if (!requestedParams.has(cap.parameter)) {
          execute('UPDATE sensor_capabilities SET is_enabled = 0 WHERE id = ?', [cap.id]);
        }
      }
    }

    if (nextConn === 'offline' && existing.connectivity_status !== 'offline') {
      const updatedSt = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId])!;
      triggerStationOfflineAlert(updatedSt, true, now);
    } else if (nextConn === 'online' && existing.connectivity_status === 'offline') {
      // Auto-resolve offline alerts when station comes back online
      execute(
        `UPDATE alerts
         SET resolved = 1,
             resolved_by = 'Telemetry Watchdog',
             resolved_at = ?,
             resolution_notes = 'Station re-established telemetry connection.'
         WHERE station_id = ? AND alert_type = 'station_offline' AND resolved = 0`,
        [now, stationId]
      );
    }

    recalculateStationOverallStatus(stationId);
    updateStationMetricsAfterReading(stationId);
  });

  return { station: getStationById(stationId)! };
}

export function deleteStation(stationId: string): { deleted: boolean; error?: string } {
  const existing = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId]);
  if (!existing) {
    return { deleted: false, error: `Station '${stationId}' not found.` };
  }

  runInTransaction(() => {
    // Foreign keys have ON DELETE CASCADE, ensuring no orphaned readings, capabilities, thresholds, or alerts
    execute('DELETE FROM stations WHERE id = ?', [stationId]);
  });

  return { deleted: true };
}

export function getDashboardSummary() {
  const stations = listStations();
  const totalStations = stations.length;
  const activeStations = stations.filter((s) => s.connectivity_status === 'online').length;
  const stationsRequiringAttention = stations.filter(
    (s) => s.overall_status === 'warning' || s.overall_status === 'critical' || s.overall_status === 'offline'
  ).length;

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
            onlineStations.reduce((sum, s) => sum + s.wqi_score, 0) / onlineStations.length
          ).toFixed(1)
        )
      : 0;

  // Compute historical WQI comparison (24h ago vs current) from actual stored readings
  const nowMs = Date.now();
  const twentyFourHoursAgoIso = new Date(nowMs - 24 * 3600 * 1000).toISOString();
  const fortyEightHoursAgoIso = new Date(nowMs - 48 * 3600 * 1000).toISOString();

  const recentNormalRatioRow = queryOne<{ total: number; normalCount: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN quality_status = 'normal' THEN 1 ELSE 0 END) as normalCount
     FROM sensor_readings
     WHERE recorded_at >= ?`,
    [twentyFourHoursAgoIso]
  );

  const priorNormalRatioRow = queryOne<{ total: number; normalCount: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN quality_status = 'normal' THEN 1 ELSE 0 END) as normalCount
     FROM sensor_readings
     WHERE recorded_at >= ? AND recorded_at < ?`,
    [fortyEightHoursAgoIso, twentyFourHoursAgoIso]
  );

  const recentCompliancePct =
    recentNormalRatioRow && recentNormalRatioRow.total > 0
      ? (recentNormalRatioRow.normalCount / recentNormalRatioRow.total) * 100
      : 90;
  const priorCompliancePct =
    priorNormalRatioRow && priorNormalRatioRow.total > 0
      ? (priorNormalRatioRow.normalCount / priorNormalRatioRow.total) * 100
      : recentCompliancePct;

  const wqiTrendDelta = Number((recentCompliancePct - priorCompliancePct).toFixed(1));

  const critAlertRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM alerts WHERE resolved = 0 AND severity = 'critical'"
  );
  const warnAlertRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM alerts WHERE resolved = 0 AND severity = 'warning'"
  );
  const unreadAlertRow = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM alerts WHERE resolved = 0 AND is_read = 0'
  );

  const alertsLast24hRow = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM alerts WHERE created_at >= ?',
    [twentyFourHoursAgoIso]
  );
  const alertsPrior24hRow = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM alerts WHERE created_at >= ? AND created_at < ?',
    [fortyEightHoursAgoIso, twentyFourHoursAgoIso]
  );

  const alerts24hDelta = (alertsLast24hRow?.count ?? 0) - (alertsPrior24hRow?.count ?? 0);

  const latestReadingRow = queryOne<{ max_time: string }>(
    'SELECT MAX(recorded_at) as max_time FROM sensor_readings'
  );

  const recentAlerts = queryAll(
    `SELECT a.*, s.name as station_name, s.water_body, s.location_name
     FROM alerts a
     LEFT JOIN stations s ON a.station_id = s.id
     ORDER BY a.resolved ASC,
              CASE WHEN a.severity = 'critical' THEN 0 ELSE 1 END ASC,
              a.created_at DESC
     LIMIT 8`
  );

  return {
    kpis: {
      totalStations,
      activeStations,
      offlineStations: totalStations - activeStations,
      stationsRequiringAttention,
      criticalActiveAlerts: critAlertRow?.count ?? 0,
      warningActiveAlerts: warnAlertRow?.count ?? 0,
      unreadAlertsCount: unreadAlertRow?.count ?? 0,
      averageWqi,
      wqiTrendDelta,
      alerts24hDelta,
      lastDataUpdate: latestReadingRow?.max_time || new Date().toISOString(),
    },
    statusDistribution,
    recentAlerts,
    stations,
  };
}
