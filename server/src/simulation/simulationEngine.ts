import { queryAll, getSetting, setSetting } from '../database/db.js';
import {
  AlertRecord,
  ParameterCode,
  SensorCapabilityRecord,
  StationRecord,
  WATER_PARAMETERS,
} from '../types/index.js';
import {
  enforceRetentionPolicy,
  validateAndIngestReading,
} from '../services/ingestionService.js';
import { getEffectiveThresholdRule } from '../services/thresholdService.js';

export class SeededPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public nextGaussian(): number {
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

class SimulationEngine {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private tickCount = 0;
  private lastTickAt: string | null = null;
  private prng: SeededPRNG;
  private recentNewAlerts: AlertRecord[] = [];
  private lastValues: Map<string, number> = new Map();

  constructor() {
    const initialSeed = Number(process.env.SIMULATION_SEED || 42069);
    this.prng = new SeededPRNG(initialSeed);
  }

  public initialize(): void {
    const seed = getSetting<number>('simulation_seed', Number(process.env.SIMULATION_SEED || 42069));
    this.prng.setSeed(seed);
    const enabled = getSetting<boolean>(
      'simulation_enabled',
      process.env.SIMULATION_ENABLED !== 'false'
    );
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  public start(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const intervalMs = Math.max(
      2000,
      getSetting<number>('simulation_interval_ms', Number(process.env.SIMULATION_INTERVAL_MS || 5000))
    );
    this.isRunning = true;
    setSetting('simulation_enabled', true, 'Whether near-real-time demo sensor simulation is active');

    this.timer = setInterval(() => {
      try {
        this.runSimulationTick();
      } catch (err) {
        console.error('[SimulationEngine] Error during tick:', err);
      }
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    setSetting('simulation_enabled', false, 'Whether near-real-time demo sensor simulation is active');
  }

  public setSeed(seed: number): void {
    this.prng.setSeed(seed);
    setSetting('simulation_seed', seed, 'Deterministic PRNG seed for demo simulation');
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
      lastTickAt: this.lastTickAt,
      intervalMs: getSetting<number>('simulation_interval_ms', 5000),
      seed: getSetting<number>('simulation_seed', 42069),
      anomalyProbability: getSetting<number>('simulation_anomaly_probability', 0.12),
      retentionMaxRowsPerStation: getSetting<number>('retention_max_rows_per_station', 2500),
      recentNewAlerts: this.recentNewAlerts.slice(0, 10),
    };
  }

  public runSimulationTick(options?: {
    forceAnomaly?: boolean;
    targetStationId?: string;
    targetParameter?: ParameterCode;
    customTimestamp?: string;
  }): {
    generatedReadingsCount: number;
    newAlerts: AlertRecord[];
    timestamp: string;
  } {
    const now = options?.customTimestamp || new Date().toISOString();
    const anomalyProb = getSetting<number>('simulation_anomaly_probability', 0.12);

    const onlineStations = queryAll<StationRecord>(
      options?.targetStationId
        ? "SELECT * FROM stations WHERE id = ? AND connectivity_status = 'online'"
        : "SELECT * FROM stations WHERE connectivity_status = 'online'",
      options?.targetStationId ? [options.targetStationId] : []
    );

    let generatedReadingsCount = 0;
    const newAlerts: AlertRecord[] = [];

    for (const station of onlineStations) {
      const capabilities = queryAll<SensorCapabilityRecord>(
        'SELECT * FROM sensor_capabilities WHERE station_id = ? AND is_enabled = 1',
        [station.id]
      );

      for (const cap of capabilities) {
        if (options?.targetParameter && cap.parameter !== options.targetParameter) {
          continue;
        }

        // Lab manual samples or specialized analyzers update slightly less frequently on auto-ticks unless targeted
        if (
          !options?.forceAnomaly &&
          !options?.targetParameter &&
          cap.data_source_type === 'lab_manual_sample' &&
          this.tickCount % 3 !== 0
        ) {
          continue;
        }

        const meta = WATER_PARAMETERS[cap.parameter];
        const key = `${station.id}:${cap.parameter}`;
        const prevVal = this.lastValues.get(key) ?? cap.baseline_value;

        // Mean-reverting Ornstein-Uhlenbeck process around station baseline
        const meanReversion = (cap.baseline_value - prevVal) * 0.35;
        const noise = this.prng.nextGaussian() * (cap.variation_range * 0.25);
        let nextVal = prevVal + meanReversion + noise;

        // Only inject automatic background anomalies on industrial/downstream stations occasionally,
        // or on any targeted station when forceAnomaly is explicitly requested by the user.
        const isHighRiskStation =
          station.id === 'STN-IND-03' || station.id === 'STN-RIV-02' || station.id === 'STN-WWT-04';
        const shouldInjectAnomaly =
          Boolean(options?.forceAnomaly) ||
          (isHighRiskStation &&
            this.tickCount > 0 &&
            this.tickCount % 6 === 0 &&
            this.prng.next() < anomalyProb * 0.35);

        if (shouldInjectAnomaly) {
          const rule = getEffectiveThresholdRule(station.id, cap.parameter);
          if (rule) {
            const isCriticalPush = options?.forceAnomaly || this.prng.next() < 0.45;
            if (isCriticalPush && rule.max_critical !== null) {
              nextVal = rule.max_critical * this.prng.nextRange(1.04, 1.22);
            } else if (isCriticalPush && rule.min_critical !== null) {
              nextVal = rule.min_critical * this.prng.nextRange(0.75, 0.94);
            } else if (rule.max_warning !== null) {
              nextVal = rule.max_warning * this.prng.nextRange(1.03, 1.15);
            } else if (rule.min_warning !== null) {
              nextVal = rule.min_warning * this.prng.nextRange(0.84, 0.96);
            }
          }
        }

        // Clamp within physical bounds
        nextVal = Math.max(
          meta.minAllowedValue,
          Math.min(meta.maxAllowedValue, Number(nextVal.toFixed(meta.precision)))
        );

        this.lastValues.set(key, nextVal);

        const res = validateAndIngestReading({
          station_id: station.id,
          parameter: cap.parameter,
          value: nextVal,
          unit: meta.unit,
          data_source: 'DEMO_SIMULATION',
          is_simulated: true,
          recorded_at: now,
        });

        if (res.success) {
          generatedReadingsCount++;
          if (res.alert && (res.isNewAlert || res.wasEscalated)) {
            newAlerts.push(res.alert);
            this.recentNewAlerts.unshift(res.alert);
            if (this.recentNewAlerts.length > 25) {
              this.recentNewAlerts.pop();
            }
          }
        }
      }
    }

    this.tickCount++;
    this.lastTickAt = now;

    // Periodically run retention cleanup every 15 ticks
    if (this.tickCount % 15 === 0) {
      enforceRetentionPolicy();
    }

    return {
      generatedReadingsCount,
      newAlerts,
      timestamp: now,
    };
  }
}

export const simulationEngine = new SimulationEngine();
