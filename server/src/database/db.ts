import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType, StatementSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => DatabaseSyncType;
};

let dbInstance: DatabaseSyncType | null = null;

export function getDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  return path.resolve(process.cwd(), 'server', 'data', 'aquaguard.sqlite');
}

export function getDb(): DatabaseSyncType {
  if (!dbInstance) {
    const dbPath = getDbPath();
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    dbInstance = new DatabaseSync(dbPath);
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function createMemoryDb(): DatabaseSyncType {
  return new DatabaseSync(':memory:');
}

export function setDbInstance(customDb: DatabaseSyncType): void {
  dbInstance = customDb;
  initSchema(dbInstance);
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore if already closed
    }
    dbInstance = null;
  }
}

export function initSchema(db: DatabaseSyncType): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operator')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      station_type TEXT NOT NULL,
      location_name TEXT NOT NULL,
      water_body TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      is_fictional_location INTEGER NOT NULL DEFAULT 1,
      connectivity_status TEXT NOT NULL DEFAULT 'online' CHECK(connectivity_status IN ('online', 'offline')),
      overall_status TEXT NOT NULL DEFAULT 'normal' CHECK(overall_status IN ('normal', 'warning', 'critical', 'offline')),
      wqi_score REAL NOT NULL DEFAULT 90.0,
      firmware_version TEXT NOT NULL DEFAULT 'v3.4.2-IoT',
      sampling_interval_sec INTEGER NOT NULL DEFAULT 5,
      description TEXT NOT NULL DEFAULT '',
      last_seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sensor_capabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      parameter TEXT NOT NULL,
      unit TEXT NOT NULL,
      data_source_type TEXT NOT NULL DEFAULT 'continuous_iot_probe' CHECK(data_source_type IN ('continuous_iot_probe', 'specialized_analyzer', 'lab_manual_sample')),
      sensor_model TEXT NOT NULL DEFAULT 'Standard Probe',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      baseline_value REAL NOT NULL,
      variation_range REAL NOT NULL,
      UNIQUE(station_id, parameter)
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      parameter TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      quality_status TEXT NOT NULL DEFAULT 'normal' CHECK(quality_status IN ('normal', 'warning', 'critical', 'fault')),
      data_source TEXT NOT NULL DEFAULT 'DEMO_SIMULATION' CHECK(data_source IN ('DEMO_SIMULATION', 'IOT_HTTP_INGEST', 'LAB_MANUAL', 'HISTORICAL_SEED')),
      is_simulated INTEGER NOT NULL DEFAULT 1,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_readings_station_param_time ON sensor_readings(station_id, parameter, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON sensor_readings(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_readings_param_time ON sensor_readings(parameter, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS threshold_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
      parameter TEXT NOT NULL,
      unit TEXT NOT NULL,
      min_warning REAL,
      max_warning REAL,
      min_critical REAL,
      max_critical REAL,
      enabled INTEGER NOT NULL DEFAULT 1,
      benchmark_authority TEXT NOT NULL DEFAULT 'Configured Monitoring Threshold',
      water_use_category TEXT NOT NULL DEFAULT 'Surface Water Screening',
      jurisdiction TEXT NOT NULL DEFAULT 'Demonstration Watershed',
      reference_source TEXT NOT NULL DEFAULT 'Custom Operational Threshold',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(station_id, parameter)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      reading_id INTEGER REFERENCES sensor_readings(id) ON DELETE SET NULL,
      alert_type TEXT NOT NULL DEFAULT 'threshold_violation' CHECK(alert_type IN ('threshold_violation', 'station_offline', 'sensor_fault')),
      parameter TEXT NOT NULL,
      measured_value REAL,
      unit TEXT NOT NULL DEFAULT '',
      triggered_threshold TEXT NOT NULL,
      threshold_direction TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('warning', 'critical')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_simulated INTEGER NOT NULL DEFAULT 1,
      is_read INTEGER NOT NULL DEFAULT 0,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      dedup_key TEXT NOT NULL,
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_station_status ON alerts(station_id, resolved, severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_dedup ON alerts(dedup_key, resolved);

    CREATE TABLE IF NOT EXISTS alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK(event_type IN ('created', 'acknowledged', 'resolved', 'reopened', 'escalated', 'note_added')),
      actor TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS application_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function normalizeRow<T>(row: unknown): T {
  if (!row || typeof row !== 'object') return row as T;
  return { ...(row as Record<string, unknown>) } as T;
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt: StatementSync = db.prepare(sql);
  const rows = stmt.all(...(params as Array<string | number | bigint | null | Uint8Array>));
  return rows.map((r) => normalizeRow<T>(r));
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const db = getDb();
  const stmt: StatementSync = db.prepare(sql);
  const row = stmt.get(...(params as Array<string | number | bigint | null | Uint8Array>));
  if (!row) return undefined;
  return normalizeRow<T>(row);
}

export function execute(
  sql: string,
  params: unknown[] = []
): { changes: number; lastInsertRowid: number } {
  const db = getDb();
  const stmt: StatementSync = db.prepare(sql);
  const res = stmt.run(...(params as Array<string | number | bigint | null | Uint8Array>));
  return {
    changes: Number(res.changes),
    lastInsertRowid: Number(res.lastInsertRowid),
  };
}

export function runInTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getSetting<T = string>(key: string, defaultValue: T): T {
  const row = queryOne<{ value: string }>('SELECT value FROM application_settings WHERE key = ?', [key]);
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as unknown as T;
  }
}

export function setSetting(key: string, value: unknown, description = ''): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const now = new Date().toISOString();
  execute(
    `INSERT INTO application_settings (key, value, description, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       description = CASE WHEN excluded.description != '' THEN excluded.description ELSE application_settings.description END,
       updated_at = excluded.updated_at`,
    [key, serialized, description, now]
  );
}
