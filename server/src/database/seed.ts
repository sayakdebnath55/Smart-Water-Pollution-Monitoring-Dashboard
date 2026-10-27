import {
  queryOne,
  execute,
  runInTransaction,
  setSetting,
} from './db.js';
import {
  ALL_PARAMETER_CODES,
  DataSourceType,
  ParameterCode,
  WATER_PARAMETERS,
} from '../types/index.js';
import { hashPassword } from '../services/authService.js';
import {
  validateAndIngestReading,
  updateStationMetricsAfterReading,
} from '../services/ingestionService.js';
import {
  acknowledgeAlert,
  resolveAlert,
  triggerStationOfflineAlert,
} from '../services/alertService.js';
import { SeededPRNG } from '../simulation/simulationEngine.js';

interface SeedStationDef {
  id: string;
  name: string;
  code: string;
  station_type: string;
  location_name: string;
  water_body: string;
  latitude: number;
  longitude: number;
  connectivity_status: 'online' | 'offline';
  firmware_version: string;
  sampling_interval_sec: number;
  description: string;
  capabilities: Array<{
    parameter: ParameterCode;
    data_source_type?: DataSourceType;
    sensor_model?: string;
    baseline_value: number;
    variation_range: number;
  }>;
}

const SEED_STATIONS: SeedStationDef[] = [
  {
    id: 'STN-RIV-01',
    name: 'Clearwater Headwaters North',
    code: 'CW-UP-01',
    station_type: 'River upstream monitoring point',
    location_name: 'Sector A1 — Upper Gorge Forestry Bridge (Demo Location)',
    water_body: 'Clearwater River Basin (Upper Reach)',
    latitude: 45.5428,
    longitude: -122.7245,
    connectivity_status: 'online',
    firmware_version: 'v3.6.0-SolarIoT',
    sampling_interval_sec: 5,
    description:
      'Reference upstream baseline station located above urban and agricultural inputs. Powered by solar telemetry array.',
    capabilities: [
      { parameter: 'ph', baseline_value: 7.42, variation_range: 0.14 },
      { parameter: 'turbidity', baseline_value: 1.65, variation_range: 0.45 },
      { parameter: 'dissolved_oxygen', baseline_value: 9.15, variation_range: 0.35 },
      { parameter: 'tds', baseline_value: 148, variation_range: 14 },
      { parameter: 'temperature', baseline_value: 14.8, variation_range: 0.8 },
      { parameter: 'conductivity', baseline_value: 245, variation_range: 20 },
      { parameter: 'nitrate', baseline_value: 1.15, variation_range: 0.25 },
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
    connectivity_status: 'online',
    firmware_version: 'v3.6.0-SolarIoT',
    sampling_interval_sec: 5,
    description:
      'Downstream station capturing mixed agricultural return flow and urban stormwater tributaries.',
    capabilities: [
      { parameter: 'ph', baseline_value: 7.68, variation_range: 0.22 },
      { parameter: 'turbidity', baseline_value: 6.4, variation_range: 1.1 },
      { parameter: 'dissolved_oxygen', baseline_value: 6.8, variation_range: 0.45 },
      { parameter: 'tds', baseline_value: 385, variation_range: 28 },
      { parameter: 'temperature', baseline_value: 19.2, variation_range: 1.1 },
      { parameter: 'conductivity', baseline_value: 640, variation_range: 42 },
      { parameter: 'nitrate', baseline_value: 9.2, variation_range: 0.9 },
      { parameter: 'phosphate', baseline_value: 0.12, variation_range: 0.03 },
      {
        parameter: 'bod',
        data_source_type: 'lab_manual_sample',
        baseline_value: 3.8,
        variation_range: 0.6,
      },
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
    connectivity_status: 'online',
    firmware_version: 'v4.0.1-IndGuard',
    sampling_interval_sec: 5,
    description:
      'High-frequency compliance sonde monitoring permitted industrial cooling and neutralized process water discharge.',
    capabilities: [
      { parameter: 'ph', baseline_value: 8.75, variation_range: 0.35 },
      { parameter: 'turbidity', baseline_value: 11.5, variation_range: 2.2 },
      { parameter: 'dissolved_oxygen', baseline_value: 4.8, variation_range: 0.55 },
      { parameter: 'tds', baseline_value: 840, variation_range: 65 },
      { parameter: 'temperature', baseline_value: 25.4, variation_range: 1.4 },
      { parameter: 'conductivity', baseline_value: 1580, variation_range: 110 },
      { parameter: 'ammonia', baseline_value: 2.35, variation_range: 0.35 },
      { parameter: 'phosphate', baseline_value: 0.24, variation_range: 0.05 },
      {
        parameter: 'bod',
        data_source_type: 'specialized_analyzer',
        sensor_model: 'BioLum Optical BOD-Surrogate Sonde',
        baseline_value: 8.6,
        variation_range: 1.2,
      },
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
    connectivity_status: 'online',
    firmware_version: 'v3.8.4-SCADA-Bridge',
    sampling_interval_sec: 5,
    description:
      'Monitors treated municipal effluent post-UV disinfection prior to river diffuser discharge.',
    capabilities: [
      { parameter: 'ph', baseline_value: 7.18, variation_range: 0.18 },
      { parameter: 'turbidity', baseline_value: 3.4, variation_range: 0.7 },
      { parameter: 'dissolved_oxygen', baseline_value: 6.4, variation_range: 0.4 },
      { parameter: 'tds', baseline_value: 465, variation_range: 30 },
      { parameter: 'temperature', baseline_value: 20.8, variation_range: 0.9 },
      { parameter: 'nitrate', baseline_value: 6.8, variation_range: 0.8 },
      { parameter: 'phosphate', baseline_value: 0.18, variation_range: 0.04 },
      { parameter: 'ammonia', baseline_value: 0.42, variation_range: 0.12 },
      {
        parameter: 'bod',
        data_source_type: 'lab_manual_sample',
        baseline_value: 4.5,
        variation_range: 0.7,
      },
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
    connectivity_status: 'online',
    firmware_version: 'v3.6.0-BuoyLink',
    sampling_interval_sec: 5,
    description:
      'Floating multiparameter profiling buoy tracking stratification, dissolved oxygen, and nutrient stability in raw storage reservoir.',
    capabilities: [
      { parameter: 'ph', baseline_value: 7.52, variation_range: 0.12 },
      { parameter: 'turbidity', baseline_value: 1.35, variation_range: 0.35 },
      { parameter: 'dissolved_oxygen', baseline_value: 8.65, variation_range: 0.3 },
      { parameter: 'tds', baseline_value: 175, variation_range: 12 },
      { parameter: 'temperature', baseline_value: 16.4, variation_range: 0.7 },
      { parameter: 'conductivity', baseline_value: 295, variation_range: 18 },
      { parameter: 'phosphate', baseline_value: 0.045, variation_range: 0.012 },
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
    connectivity_status: 'offline',
    firmware_version: 'v3.4.2-IoT',
    sampling_interval_sec: 5,
    description:
      'Early-warning raw water intake screening station before coagulation/filtration plant. Currently in simulated telemetry drop state.',
    capabilities: [
      { parameter: 'ph', baseline_value: 7.38, variation_range: 0.15 },
      { parameter: 'turbidity', baseline_value: 2.2, variation_range: 0.5 },
      { parameter: 'dissolved_oxygen', baseline_value: 8.1, variation_range: 0.35 },
      { parameter: 'tds', baseline_value: 215, variation_range: 18 },
      { parameter: 'temperature', baseline_value: 17.1, variation_range: 0.8 },
      { parameter: 'conductivity', baseline_value: 355, variation_range: 22 },
      { parameter: 'nitrate', baseline_value: 2.1, variation_range: 0.35 },
      { parameter: 'ammonia', baseline_value: 0.11, variation_range: 0.04 },
    ],
  },
];

export function seedDatabaseIfNeeded(forceReset = false): void {
  if (forceReset) {
    runInTransaction(() => {
      execute('DELETE FROM alert_events');
      execute('DELETE FROM alerts');
      execute('DELETE FROM sensor_readings');
      execute('DELETE FROM sensor_capabilities');
      execute('DELETE FROM threshold_rules');
      execute('DELETE FROM stations');
      execute('DELETE FROM users');
      execute('DELETE FROM application_settings');
    });
  }

  const existingStations = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM stations');
  if ((existingStations?.count ?? 0) > 0) {
    return;
  }

  const prng = new SeededPRNG(42069);
  const now = new Date();

  runInTransaction(() => {
    // 1. Application Settings
    setSetting('simulation_enabled', true, 'Enable near-real-time demo sensor simulation');
    setSetting('simulation_interval_ms', 5000, 'Simulation update interval in milliseconds');
    setSetting('simulation_seed', 42069, 'Deterministic PRNG seed for simulation engine');
    setSetting('simulation_anomaly_probability', 0.14, 'Probability of controlled anomaly injection per cycle');
    setSetting('retention_max_rows_per_station', 2500, 'Maximum stored readings per station before FIFO pruning');
    setSetting('alert_cooldown_minutes', 2, 'Deduplication cooldown window in minutes after alert resolution');
    setSetting(
      'organization_name',
      'Clearwater Regional Watershed Authority (Demo Instance)',
      'Organization name displayed on monitoring reports'
    );
    setSetting(
      'external_notifications_enabled',
      false,
      'External email/SMS dispatch (Dashboard-only mode in local demo)'
    );

    // 2. Demo Users (Admin & Operator)
    const adminHash = hashPassword('AdminDemo2026!', 'a1b2c3d4e5f60718293a4b5c6d7e8f90');
    const operatorHash = hashPassword('OperatorDemo2026!', 'f0e9d8c7b6a594837261504f3e2d1c0b');

    execute(
      `INSERT INTO users (username, email, password_hash, full_name, role, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?),
              (?, ?, ?, ?, 'operator', ?)`,
      [
        'admin',
        'admin@aquaguard.local',
        adminHash,
        'Dr. Elena Vance (Lead Hydrologist / Admin)',
        now.toISOString(),
        'operator',
        'operator@aquaguard.local',
        operatorHash,
        'Marcus Chen (Shift Telemetry Operator)',
        now.toISOString(),
      ]
    );

    // 3. Global Threshold Rules for all 10 parameters
    for (const code of ALL_PARAMETER_CODES) {
      const meta = WATER_PARAMETERS[code];
      const def = meta.defaultThresholds;
      execute(
        `INSERT INTO threshold_rules (
          station_id, parameter, unit, min_warning, max_warning, min_critical, max_critical,
          enabled, benchmark_authority, water_use_category, jurisdiction, reference_source, notes, updated_at
        ) VALUES (NULL, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          meta.unit,
          def.min_warning,
          def.max_warning,
          def.min_critical,
          def.max_critical,
          def.benchmark_authority,
          def.water_use_category,
          def.jurisdiction,
          def.reference_source,
          def.notes,
          now.toISOString(),
        ]
      );
    }

    // 4. Stations & Sensor Capabilities
    for (const st of SEED_STATIONS) {
      const lastSeen =
        st.connectivity_status === 'offline'
          ? new Date(now.getTime() - 4 * 3600 * 1000).toISOString()
          : now.toISOString();

      execute(
        `INSERT INTO stations (
          id, name, code, station_type, location_name, water_body,
          latitude, longitude, is_fictional_location, connectivity_status,
          overall_status, wqi_score, firmware_version, sampling_interval_sec,
          description, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 90.0, ?, ?, ?, ?, ?, ?)`,
        [
          st.id,
          st.name,
          st.code,
          st.station_type,
          st.location_name,
          st.water_body,
          st.latitude,
          st.longitude,
          st.connectivity_status,
          st.connectivity_status === 'offline' ? 'offline' : 'normal',
          st.firmware_version,
          st.sampling_interval_sec,
          st.description,
          lastSeen,
          new Date(now.getTime() - 35 * 86400 * 1000).toISOString(),
          now.toISOString(),
        ]
      );

      for (const cap of st.capabilities) {
        const meta = WATER_PARAMETERS[cap.parameter];
        execute(
          `INSERT INTO sensor_capabilities (
            station_id, parameter, unit, data_source_type, sensor_model,
            is_enabled, baseline_value, variation_range
          ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            st.id,
            cap.parameter,
            meta.unit,
            cap.data_source_type || meta.defaultSourceType,
            cap.sensor_model || meta.defaultSensorModel,
            cap.baseline_value,
            cap.variation_range,
          ]
        );
      }
    }

    // 5. Generate Multi-Horizon Historical Readings (30d, 7d, 24h, and last 1h)
    const timeOffsetsMinutes: number[] = [];
    // Past 30 days to 7 days: every 24 hours (23 points)
    for (let d = 30; d > 7; d--) {
      timeOffsetsMinutes.push(d * 24 * 60);
    }
    // Past 7 days to 24 hours: every 6 hours (24 points)
    for (let h = 7 * 24; h > 24; h -= 6) {
      timeOffsetsMinutes.push(h * 60);
    }
    // Past 24 hours to 1 hour: every 2 hours (12 points)
    for (let h = 24; h > 1; h -= 2) {
      timeOffsetsMinutes.push(h * 60);
    }
    // Past 60 minutes: every 5 minutes (12 points)
    for (let m = 60; m >= 0; m -= 5) {
      timeOffsetsMinutes.push(m);
    }

    for (const st of SEED_STATIONS) {
      for (const offsetMin of timeOffsetsMinutes) {
        // Offline station STN-INT-06 stopped reporting 4 hours (240 minutes) ago
        if (st.connectivity_status === 'offline' && offsetMin < 240) {
          continue;
        }

        const timestamp = new Date(now.getTime() - offsetMin * 60 * 1000).toISOString();
        const isLatestTick = offsetMin === 0;
        const isRecentTick = offsetMin <= 15;

        for (const cap of st.capabilities) {
          // Lab manual samples only recorded on >= 6 hour intervals + latest
          if (cap.data_source_type === 'lab_manual_sample' && offsetMin > 0 && offsetMin % 360 !== 0) {
            continue;
          }

          const meta = WATER_PARAMETERS[cap.parameter];
          const diurnalWave = Math.sin((offsetMin / 1440) * Math.PI * 2) * (cap.variation_range * 0.45);
          const randomJitter = (prng.next() - 0.5) * cap.variation_range * 0.9;
          let value = cap.baseline_value + diurnalWave + randomJitter;

          // Inject deliberate, realistic pollution events on the latest ticks for demonstration
          if (st.id === 'STN-IND-03' && isRecentTick) {
            if (cap.parameter === 'ammonia') value = 2.65; // Critical (> 2.0 mg/L)
            if (cap.parameter === 'conductivity') value = 1690; // Critical (> 1500 uS/cm)
            if (cap.parameter === 'ph') value = 9.18; // Critical (> 9.0 pH units)
          } else if (st.id === 'STN-RIV-02' && isRecentTick) {
            if (cap.parameter === 'turbidity') value = 7.85; // Warning (> 5.0 NTU)
            if (cap.parameter === 'nitrate') value = 10.4; // Warning (> 8.0 mg/L)
          } else if (st.id === 'STN-WWT-04' && isRecentTick) {
            if (cap.parameter === 'phosphate') value = 0.24; // Warning (> 0.15 mg/L)
          }

          value = Math.max(
            meta.minAllowedValue,
            Math.min(meta.maxAllowedValue, Number(value.toFixed(meta.precision)))
          );

          validateAndIngestReading({
            station_id: st.id,
            parameter: cap.parameter,
            value,
            unit: meta.unit,
            data_source:
              cap.data_source_type === 'lab_manual_sample' ? 'LAB_MANUAL' : 'DEMO_SIMULATION',
            is_simulated: true,
            recorded_at: timestamp,
            // Generate alerts only on recent window or specific historical events to keep initial alert feed clean & meaningful
            skipAlertGeneration: !isLatestTick && offsetMin !== 720 && offsetMin !== 2880,
            deferStationMetricsUpdate: !isLatestTick,
          });
        }
      }

      updateStationMetricsAfterReading(st.id);
    }

    // 6. Trigger Offline Alert for STN-INT-06
    const offlineStation = queryOne<any>("SELECT * FROM stations WHERE id = 'STN-INT-06'");
    if (offlineStation) {
      triggerStationOfflineAlert(
        offlineStation,
        true,
        new Date(now.getTime() - 3.5 * 3600 * 1000).toISOString()
      );
    }

    // 7. Acknowledge one warning alert and resolve one historical alert so all alert states are demonstrated
    const warningAlert = queryOne<{ id: string }>(
      "SELECT id FROM alerts WHERE station_id = 'STN-WWT-04' AND resolved = 0 LIMIT 1"
    );
    if (warningAlert) {
      acknowledgeAlert(
        warningAlert.id,
        'Marcus Chen (Shift Telemetry Operator)',
        'Acknowledged elevated tertiary ortho-phosphate; chemical dosing pump B2 adjustment in progress.'
      );
    }

    const olderAlert = queryOne<{ id: string }>(
      'SELECT id FROM alerts ORDER BY created_at ASC LIMIT 1'
    );
    if (olderAlert && olderAlert.id !== warningAlert?.id) {
      resolveAlert(
        olderAlert.id,
        'Dr. Elena Vance (Lead Hydrologist / Admin)',
        'Verified transient stormwater flush; sensor recalibrated and subsequent readings returned within normal limits.'
      );
    }
  });
}
