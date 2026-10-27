import { queryAll, queryOne, execute, getSetting } from '../database/db.js';
import {
  ALL_PARAMETER_CODES,
  AlertRecord,
  ParameterCode,
  ReadingDataSource,
  SensorCapabilityRecord,
  SensorReadingRecord,
  StationRecord,
  WATER_PARAMETERS,
} from '../types/index.js';
import {
  computeSubIndexWqi,
  evaluateStationReading,
} from './thresholdService.js';
import {
  processThresholdViolationAlert,
  recalculateStationOverallStatus,
} from './alertService.js';

export interface IngestReadingInput {
  station_id: string;
  parameter: string;
  value: number;
  unit?: string;
  data_source?: ReadingDataSource;
  is_simulated?: boolean;
  recorded_at?: string;
  skipAlertGeneration?: boolean;
  deferStationMetricsUpdate?: boolean;
}

export interface IngestReadingResult {
  success: boolean;
  errors?: string[];
  reading?: SensorReadingRecord;
  alert?: AlertRecord | null;
  isNewAlert?: boolean;
  wasEscalated?: boolean;
}

export function validateAndIngestReading(input: IngestReadingInput): IngestReadingResult {
  const errors: string[] = [];

  if (!input.station_id || typeof input.station_id !== 'string') {
    return { success: false, errors: ['station_id is required.'] };
  }

  const station = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [
    input.station_id.trim(),
  ]);
  if (!station) {
    return { success: false, errors: [`Monitoring station '${input.station_id}' does not exist.`] };
  }

  if (!ALL_PARAMETER_CODES.includes(input.parameter as ParameterCode)) {
    return {
      success: false,
      errors: [
        `Unsupported parameter '${input.parameter}'. Allowed parameters: ${ALL_PARAMETER_CODES.join(', ')}.`,
      ],
    };
  }

  const paramCode = input.parameter as ParameterCode;
  const meta = WATER_PARAMETERS[paramCode];

  const capability = queryOne<SensorCapabilityRecord>(
    'SELECT * FROM sensor_capabilities WHERE station_id = ? AND parameter = ?',
    [station.id, paramCode]
  );

  if (!capability || !capability.is_enabled) {
    return {
      success: false,
      errors: [
        `Station '${station.name}' (${station.id}) is not configured to measure parameter '${meta.name}' (${paramCode}).`,
      ],
    };
  }

  if (typeof input.value !== 'number' || Number.isNaN(input.value) || !Number.isFinite(input.value)) {
    return { success: false, errors: ['Measurement value must be a valid finite number.'] };
  }

  if (input.value < meta.minAllowedValue || input.value > meta.maxAllowedValue) {
    return {
      success: false,
      errors: [
        `Value ${input.value} ${meta.unit} for ${meta.name} is outside physical range [${meta.minAllowedValue}, ${meta.maxAllowedValue}].`,
      ],
    };
  }

  if (input.unit && input.unit.trim() !== '' && input.unit.trim() !== meta.unit) {
    errors.push(
      `Invalid unit '${input.unit}' for ${meta.name}. Expected '${meta.unit}'.`
    );
    return { success: false, errors };
  }

  const recordedAt = input.recorded_at || new Date().toISOString();
  if (Number.isNaN(new Date(recordedAt).getTime())) {
    return { success: false, errors: [`Invalid ISO timestamp '${recordedAt}'.`] };
  }

  const dataSource: ReadingDataSource = input.data_source || 'DEMO_SIMULATION';
  const isSimulated =
    input.is_simulated !== undefined
      ? input.is_simulated
      : dataSource === 'DEMO_SIMULATION' || dataSource === 'HISTORICAL_SEED';

  const roundedValue = Number(input.value.toFixed(meta.precision));
  const evalResult = evaluateStationReading(station.id, paramCode, roundedValue);

  const insertRes = execute(
    `INSERT INTO sensor_readings (
      station_id, parameter, value, unit, quality_status, data_source, is_simulated, recorded_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      station.id,
      paramCode,
      roundedValue,
      meta.unit,
      evalResult.qualityStatus,
      dataSource,
      isSimulated ? 1 : 0,
      recordedAt,
      new Date().toISOString(),
    ]
  );

  const reading = queryOne<SensorReadingRecord>('SELECT * FROM sensor_readings WHERE id = ?', [
    insertRes.lastInsertRowid,
  ])!;

  let alertResult: { alert: AlertRecord | null; isNew: boolean; wasEscalated: boolean } = {
    alert: null,
    isNew: false,
    wasEscalated: false,
  };

  if (!input.skipAlertGeneration && evalResult.severity) {
    alertResult = processThresholdViolationAlert({
      station,
      parameter: paramCode,
      value: roundedValue,
      readingId: reading.id,
      evalResult,
      isSimulated,
      recordedAt,
    });
  }

  // Update station WQI, last_seen_at, and overall_status unless deferred by bulk seed
  if (!input.deferStationMetricsUpdate) {
    updateStationMetricsAfterReading(station.id, recordedAt);
  }

  return {
    success: true,
    reading,
    alert: alertResult.alert,
    isNewAlert: alertResult.isNew,
    wasEscalated: alertResult.wasEscalated,
  };
}

export function updateStationMetricsAfterReading(stationId: string, recordedAt?: string): void {
  const station = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId]);
  if (!station) return;

  const latestReadings = queryAll<{ parameter: ParameterCode; value: number; quality_status: string }>(
    `SELECT sr.parameter, sr.value, sr.quality_status
     FROM sensor_readings sr
     INNER JOIN (
       SELECT parameter, MAX(recorded_at) as max_time
       FROM sensor_readings
       WHERE station_id = ?
       GROUP BY parameter
     ) latest ON sr.parameter = latest.parameter AND sr.recorded_at = latest.max_time
     WHERE sr.station_id = ?`,
    [stationId, stationId]
  );

  let wqiScore = station.wqi_score;
  if (latestReadings.length > 0) {
    const subScores = latestReadings.map((r) => {
      const evalRes = evaluateStationReading(stationId, r.parameter, r.value);
      return computeSubIndexWqi(r.parameter, r.value, evalRes);
    });
    const avgScore = subScores.reduce((acc, v) => acc + v, 0) / subScores.length;
    const minScore = Math.min(...subScores);
    // Weighted composite WQI: 65% average + 35% worst parameter so a critical parameter pulls WQI down realistically
    wqiScore = Number((avgScore * 0.65 + minScore * 0.35).toFixed(1));
  }

  const lastSeen =
    recordedAt && (!station.last_seen_at || recordedAt > station.last_seen_at)
      ? recordedAt
      : station.last_seen_at || new Date().toISOString();

  execute(
    'UPDATE stations SET wqi_score = ?, last_seen_at = ?, updated_at = ? WHERE id = ?',
    [wqiScore, lastSeen, new Date().toISOString(), stationId]
  );

  recalculateStationOverallStatus(stationId);
}

export function enforceRetentionPolicy(): number {
  const maxRowsPerStation = getSetting<number>('retention_max_rows_per_station', 2500);
  if (!maxRowsPerStation || maxRowsPerStation < 100) return 0;

  const stations = queryAll<{ id: string }>('SELECT id FROM stations');
  let totalDeleted = 0;

  for (const st of stations) {
    const countRow = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM sensor_readings WHERE station_id = ?',
      [st.id]
    );
    const currentCount = countRow?.count ?? 0;
    if (currentCount > maxRowsPerStation) {
      const excess = currentCount - maxRowsPerStation;
      const res = execute(
        `DELETE FROM sensor_readings
         WHERE id IN (
           SELECT id FROM sensor_readings
           WHERE station_id = ?
           ORDER BY recorded_at ASC
           LIMIT ?
         )`,
        [st.id, excess]
      );
      totalDeleted += res.changes;
    }
  }
  return totalDeleted;
}
