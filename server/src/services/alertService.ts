import { queryAll, queryOne, execute, getSetting } from '../database/db.js';
import {
  AlertEventRecord,
  AlertRecord,
  AlertSeverity,
  ParameterCode,
  StationRecord,
  WATER_PARAMETERS,
} from '../types/index.js';
import { ThresholdEvaluationResult } from './thresholdService.js';

function generateAlertId(): string {
  const row = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM alerts');
  const nextNum = (row?.count ?? 0) + 1001;
  const suffix = Math.floor(100 + Math.random() * 900);
  return `ALT-${nextNum}-${suffix}`;
}

export function processThresholdViolationAlert(params: {
  station: StationRecord;
  parameter: ParameterCode;
  value: number;
  readingId: number;
  evalResult: ThresholdEvaluationResult;
  isSimulated: boolean;
  recordedAt?: string;
}): { alert: AlertRecord | null; isNew: boolean; wasEscalated: boolean } {
  const { station, parameter, value, readingId, evalResult, isSimulated, recordedAt } = params;

  if (!evalResult.severity || !evalResult.triggeredThreshold) {
    return { alert: null, isNew: false, wasEscalated: false };
  }

  const now = recordedAt || new Date().toISOString();
  const meta = WATER_PARAMETERS[parameter];
  const dedupKey = `${station.id}:${parameter}:${evalResult.thresholdDirection}`;

  // 1. Check for existing unresolved alert for this station + parameter
  const existingActive = queryOne<AlertRecord>(
    `SELECT * FROM alerts
     WHERE station_id = ? AND parameter = ? AND resolved = 0
     ORDER BY created_at DESC LIMIT 1`,
    [station.id, parameter]
  );

  if (existingActive) {
    const shouldEscalate =
      existingActive.severity === 'warning' && evalResult.severity === 'critical';

    const newSeverity: AlertSeverity = shouldEscalate ? 'critical' : existingActive.severity;
    const newTitle = `${newSeverity === 'critical' ? 'Critical' : 'Warning'}: ${meta.name} excursion at ${station.name}`;
    const newMessage = `${meta.name} measured ${value} ${meta.unit}, violating configured threshold (${evalResult.triggeredThreshold}).`;

    execute(
      `UPDATE alerts
       SET reading_id = ?,
           measured_value = ?,
           triggered_threshold = ?,
           threshold_direction = ?,
           severity = ?,
           title = ?,
           message = ?,
           occurrence_count = occurrence_count + 1,
           is_read = CASE WHEN ? = 1 THEN 0 ELSE is_read END,
           updated_at = ?
       WHERE id = ?`,
      [
        readingId,
        value,
        evalResult.triggeredThreshold,
        evalResult.thresholdDirection,
        newSeverity,
        newTitle,
        newMessage,
        shouldEscalate ? 1 : 0,
        now,
        existingActive.id,
      ]
    );

    if (shouldEscalate) {
      execute(
        `INSERT INTO alert_events (alert_id, event_type, actor, notes, created_at)
         VALUES (?, 'escalated', 'System Threshold Engine', ?, ?)`,
        [
          existingActive.id,
          `Escalated from WARNING to CRITICAL as ${meta.name} reached ${value} ${meta.unit} (${evalResult.triggeredThreshold}).`,
          now,
        ]
      );
    }

    const updated = queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [existingActive.id])!;
    return { alert: updated, isNew: false, wasEscalated: shouldEscalate };
  }

  // 2. Check cooldown against recently resolved alert of same dedup_key
  const cooldownMinutes = getSetting<number>('alert_cooldown_minutes', 2);
  if (cooldownMinutes > 0) {
    const recentResolved = queryOne<AlertRecord>(
      `SELECT * FROM alerts
       WHERE dedup_key = ? AND resolved = 1
       ORDER BY resolved_at DESC LIMIT 1`,
      [dedupKey]
    );
    if (recentResolved && recentResolved.resolved_at) {
      const elapsedMs = new Date(now).getTime() - new Date(recentResolved.resolved_at).getTime();
      if (elapsedMs >= 0 && elapsedMs < cooldownMinutes * 60 * 1000 && evalResult.severity !== 'critical') {
        return { alert: null, isNew: false, wasEscalated: false };
      }
    }
  }

  // 3. Create new alert
  const alertId = generateAlertId();
  const title = `${evalResult.severity === 'critical' ? 'Critical' : 'Warning'}: ${meta.name} excursion at ${station.name}`;
  const message = `${meta.name} measured ${value} ${meta.unit} at ${station.name} (${station.location_name}), exceeding configured limit ${evalResult.triggeredThreshold}.`;

  execute(
    `INSERT INTO alerts (
      id, station_id, reading_id, alert_type, parameter, measured_value, unit,
      triggered_threshold, threshold_direction, severity, title, message,
      is_simulated, is_read, acknowledged, resolved, dedup_key, occurrence_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'threshold_violation', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 1, ?, ?)`,
    [
      alertId,
      station.id,
      readingId,
      parameter,
      value,
      meta.unit,
      evalResult.triggeredThreshold,
      evalResult.thresholdDirection,
      evalResult.severity,
      title,
      message,
      isSimulated ? 1 : 0,
      dedupKey,
      now,
      now,
    ]
  );

  execute(
    `INSERT INTO alert_events (alert_id, event_type, actor, notes, created_at)
     VALUES (?, 'created', 'System Threshold Engine', ?, ?)`,
    [
      alertId,
      `Alert triggered automatically: ${meta.name} = ${value} ${meta.unit} (${evalResult.triggeredThreshold}).`,
      now,
    ]
  );

  const created = queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [alertId])!;
  return { alert: created, isNew: true, wasEscalated: false };
}

export function triggerStationOfflineAlert(
  station: StationRecord,
  isSimulated = true,
  customTimestamp?: string
): AlertRecord {
  const now = customTimestamp || new Date().toISOString();
  const dedupKey = `${station.id}:connectivity:offline`;

  const existing = queryOne<AlertRecord>(
    `SELECT * FROM alerts WHERE station_id = ? AND alert_type = 'station_offline' AND resolved = 0 LIMIT 1`,
    [station.id]
  );
  if (existing) {
    execute('UPDATE alerts SET occurrence_count = occurrence_count + 1, updated_at = ? WHERE id = ?', [
      now,
      existing.id,
    ]);
    return queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [existing.id])!;
  }

  const alertId = generateAlertId();
  const title = `Telemetry Offline: ${station.name} unreachable`;
  const message = `Station ${station.name} (${station.id}) missed scheduled telemetry heartbeats and is marked OFFLINE.`;

  execute(
    `INSERT INTO alerts (
      id, station_id, reading_id, alert_type, parameter, measured_value, unit,
      triggered_threshold, threshold_direction, severity, title, message,
      is_simulated, is_read, acknowledged, resolved, dedup_key, occurrence_count,
      created_at, updated_at
    ) VALUES (?, ?, NULL, 'station_offline', 'connectivity', NULL, 'status', 'Heartbeat Timeout (> 15 min)', 'offline', 'warning', ?, ?, ?, 0, 0, 0, ?, 1, ?, ?)`,
    [alertId, station.id, title, message, isSimulated ? 1 : 0, dedupKey, now, now]
  );

  execute(
    `INSERT INTO alert_events (alert_id, event_type, actor, notes, created_at)
     VALUES (?, 'created', 'Telemetry Watchdog', ?, ?)`,
    [alertId, 'Station telemetry heartbeat lost; connectivity alert raised.', now]
  );

  return queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [alertId])!;
}

export interface ListAlertsFilter {
  stationId?: string;
  severity?: string;
  status?: 'all' | 'active' | 'unacknowledged' | 'acknowledged' | 'resolved' | 'unread';
  parameter?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function listAlerts(filter: ListAlertsFilter = {}): {
  alerts: AlertRecord[];
  total: number;
  unreadCount: number;
  activeCriticalCount: number;
  activeWarningCount: number;
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.stationId && filter.stationId !== 'all') {
    conditions.push('a.station_id = ?');
    params.push(filter.stationId);
  }

  if (filter.severity && filter.severity !== 'all') {
    conditions.push('a.severity = ?');
    params.push(filter.severity);
  }

  if (filter.parameter && filter.parameter !== 'all') {
    conditions.push('a.parameter = ?');
    params.push(filter.parameter);
  }

  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'active') {
      conditions.push('a.resolved = 0');
    } else if (filter.status === 'unacknowledged') {
      conditions.push('a.resolved = 0 AND a.acknowledged = 0');
    } else if (filter.status === 'acknowledged') {
      conditions.push('a.resolved = 0 AND a.acknowledged = 1');
    } else if (filter.status === 'resolved') {
      conditions.push('a.resolved = 1');
    } else if (filter.status === 'unread') {
      conditions.push('a.is_read = 0');
    }
  }

  if (filter.startDate) {
    conditions.push('a.created_at >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push('a.created_at <= ?');
    params.push(filter.endDate);
  }

  if (filter.search && filter.search.trim() !== '') {
    const q = `%${filter.search.trim()}%`;
    conditions.push(
      '(a.id LIKE ? OR a.title LIKE ? OR a.message LIKE ? OR s.name LIKE ? OR a.station_id LIKE ? OR a.parameter LIKE ?)'
    );
    params.push(q, q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(500, Math.max(1, filter.limit || 100));
  const offset = Math.max(0, filter.offset || 0);

  const countRow = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM alerts a
     LEFT JOIN stations s ON a.station_id = s.id
     ${whereClause}`,
    params
  );

  const alerts = queryAll<AlertRecord>(
    `SELECT a.*, s.name as station_name, s.water_body, s.location_name
     FROM alerts a
     LEFT JOIN stations s ON a.station_id = s.id
     ${whereClause}
     ORDER BY a.resolved ASC,
              CASE WHEN a.severity = 'critical' THEN 0 ELSE 1 END ASC,
              a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const unreadRow = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM alerts WHERE is_read = 0 AND resolved = 0'
  );
  const critRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM alerts WHERE resolved = 0 AND severity = 'critical'"
  );
  const warnRow = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM alerts WHERE resolved = 0 AND severity = 'warning'"
  );

  return {
    alerts,
    total: countRow?.total ?? 0,
    unreadCount: unreadRow?.count ?? 0,
    activeCriticalCount: critRow?.count ?? 0,
    activeWarningCount: warnRow?.count ?? 0,
  };
}

export function getAlertDetails(alertId: string): {
  alert: AlertRecord;
  events: AlertEventRecord[];
} | null {
  const alert = queryOne<AlertRecord>(
    `SELECT a.*, s.name as station_name, s.water_body, s.location_name
     FROM alerts a
     LEFT JOIN stations s ON a.station_id = s.id
     WHERE a.id = ?`,
    [alertId]
  );
  if (!alert) return null;

  const events = queryAll<AlertEventRecord>(
    'SELECT * FROM alert_events WHERE alert_id = ? ORDER BY created_at ASC, id ASC',
    [alertId]
  );

  return { alert, events };
}

export function acknowledgeAlert(
  alertId: string,
  actor = 'Operator',
  notes = 'Alert acknowledged via monitoring console.'
): AlertRecord | null {
  const existing = queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [alertId]);
  if (!existing) return null;

  const now = new Date().toISOString();
  execute(
    `UPDATE alerts
     SET acknowledged = 1,
         acknowledged_by = ?,
         acknowledged_at = ?,
         is_read = 1,
         updated_at = ?
     WHERE id = ?`,
    [actor, now, now, alertId]
  );

  execute(
    `INSERT INTO alert_events (alert_id, event_type, actor, notes, created_at)
     VALUES (?, 'acknowledged', ?, ?, ?)`,
    [alertId, actor, notes || 'Alert acknowledged.', now]
  );

  return getAlertDetails(alertId)?.alert || null;
}

export function resolveAlert(
  alertId: string,
  actor = 'Operator',
  resolutionNotes = 'Resolved following parameter stabilization.'
): AlertRecord | null {
  const existing = queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [alertId]);
  if (!existing) return null;

  const now = new Date().toISOString();
  execute(
    `UPDATE alerts
     SET resolved = 1,
         resolved_by = ?,
         resolved_at = ?,
         resolution_notes = ?,
         acknowledged = 1,
         acknowledged_by = COALESCE(acknowledged_by, ?),
         acknowledged_at = COALESCE(acknowledged_at, ?),
         is_read = 1,
         updated_at = ?
     WHERE id = ?`,
    [actor, now, resolutionNotes, actor, now, now, alertId]
  );

  execute(
    `INSERT INTO alert_events (alert_id, event_type, actor, notes, created_at)
     VALUES (?, 'resolved', ?, ?, ?)`,
    [alertId, actor, resolutionNotes || 'Alert marked resolved.', now]
  );

  // Recalculate station status when an alert is resolved
  recalculateStationOverallStatus(existing.station_id);

  return getAlertDetails(alertId)?.alert || null;
}

export function reopenAlert(
  alertId: string,
  actor = 'Operator',
  notes = 'Alert reopened for further investigation.'
): AlertRecord | null {
  const existing = queryOne<AlertRecord>('SELECT * FROM alerts WHERE id = ?', [alertId]);
  if (!existing) return null;

  const now = new Date().toISOString();
  execute(
    `UPDATE alerts
     SET resolved = 0,
         resolved_by = NULL,
         resolved_at = NULL,
         is_read = 0,
         updated_at = ?
     WHERE id = ?`,
    [now, alertId]
  );

  execute(
    `INSERT INTO alert_events (alert_id, event_type, actor, notes, created_at)
     VALUES (?, 'reopened', ?, ?, ?)`,
    [alertId, actor, notes, now]
  );

  recalculateStationOverallStatus(existing.station_id);

  return getAlertDetails(alertId)?.alert || null;
}

export function markAllAlertsAsRead(): number {
  const res = execute('UPDATE alerts SET is_read = 1 WHERE is_read = 0');
  return res.changes;
}

export function recalculateStationOverallStatus(stationId: string): void {
  const station = queryOne<StationRecord>('SELECT * FROM stations WHERE id = ?', [stationId]);
  if (!station) return;

  if (station.connectivity_status === 'offline') {
    execute("UPDATE stations SET overall_status = 'offline', updated_at = ? WHERE id = ?", [
      new Date().toISOString(),
      stationId,
    ]);
    return;
  }

  // Check latest reading per enabled capability + active unresolved alerts
  const latestReadings = queryAll<{ parameter: string; quality_status: string }>(
    `SELECT sr.parameter, sr.quality_status
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

  const activeAlerts = queryAll<{ severity: string }>(
    'SELECT severity FROM alerts WHERE station_id = ? AND resolved = 0',
    [stationId]
  );

  let nextStatus: 'normal' | 'warning' | 'critical' = 'normal';

  if (
    latestReadings.some((r) => r.quality_status === 'critical') ||
    activeAlerts.some((a) => a.severity === 'critical')
  ) {
    nextStatus = 'critical';
  } else if (
    latestReadings.some((r) => r.quality_status === 'warning') ||
    activeAlerts.some((a) => a.severity === 'warning')
  ) {
    nextStatus = 'warning';
  }

  execute('UPDATE stations SET overall_status = ?, updated_at = ? WHERE id = ?', [
    nextStatus,
    new Date().toISOString(),
    stationId,
  ]);
}
