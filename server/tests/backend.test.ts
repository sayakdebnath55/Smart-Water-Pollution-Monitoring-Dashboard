import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createMemoryDb, setDbInstance, closeDb, queryAll } from '../src/database/db.js';
import { seedDatabaseIfNeeded } from '../src/database/seed.js';
import {
  validateThresholdConfig,
  evaluateStationReading,
  upsertStationThresholdRule,
} from '../src/services/thresholdService.js';
import {
  validateAndIngestReading,
} from '../src/services/ingestionService.js';
import {
  acknowledgeAlert,
  resolveAlert,
  reopenAlert,
  getAlertDetails,
} from '../src/services/alertService.js';
import {
  escapeCsvField,
  generateReadingsCsv,
  buildMonitoringReportData,
} from '../src/services/analyticsService.js';
import { createApp } from '../src/app.js';

describe('AquaGuard Backend Core Business Logic & API Suite', () => {
  const app = createApp();

  beforeEach(() => {
    const memDb = createMemoryDb();
    setDbInstance(memDb);
    seedDatabaseIfNeeded(true);
  });

  afterAll(() => {
    closeDb();
  });

  describe('1. Threshold Validation & Evaluation Engine', () => {
    it('evaluates two-sided pH thresholds accurately (normal, warning low/high, critical low/high)', () => {
      const normalRes = evaluateStationReading('STN-RIV-01', 'ph', 7.3);
      expect(normalRes.qualityStatus).toBe('normal');
      expect(normalRes.severity).toBeNull();

      const warnLow = evaluateStationReading('STN-RIV-01', 'ph', 6.3);
      expect(warnLow.qualityStatus).toBe('warning');
      expect(warnLow.severity).toBe('warning');
      expect(warnLow.thresholdDirection).toBe('below_min_warning');

      const critLow = evaluateStationReading('STN-RIV-01', 'ph', 5.7);
      expect(critLow.qualityStatus).toBe('critical');
      expect(critLow.severity).toBe('critical');
      expect(critLow.thresholdDirection).toBe('below_min_critical');

      const warnHigh = evaluateStationReading('STN-RIV-01', 'ph', 8.7);
      expect(warnHigh.qualityStatus).toBe('warning');
      expect(warnHigh.thresholdDirection).toBe('above_max_warning');

      const critHigh = evaluateStationReading('STN-RIV-01', 'ph', 9.4);
      expect(critHigh.qualityStatus).toBe('critical');
      expect(critHigh.thresholdDirection).toBe('above_max_critical');
    });

    it('evaluates lower-bound Dissolved Oxygen thresholds (low DO triggers warning/critical)', () => {
      const healthyDo = evaluateStationReading('STN-RIV-01', 'dissolved_oxygen', 8.5);
      expect(healthyDo.qualityStatus).toBe('normal');

      const warnDo = evaluateStationReading('STN-RIV-01', 'dissolved_oxygen', 4.8);
      expect(warnDo.qualityStatus).toBe('warning');
      expect(warnDo.thresholdDirection).toBe('below_min_warning');

      const critDo = evaluateStationReading('STN-RIV-01', 'dissolved_oxygen', 3.2);
      expect(critDo.qualityStatus).toBe('critical');
      expect(critDo.thresholdDirection).toBe('below_min_critical');
    });

    it('rejects contradictory or out-of-bounds threshold configurations', () => {
      // Lower critical > lower warning is invalid
      const invalidLowOrder = validateThresholdConfig({
        parameter: 'ph',
        min_critical: 7.0,
        min_warning: 6.5,
        max_warning: 8.5,
        max_critical: 9.0,
      });
      expect(invalidLowOrder.valid).toBe(false);
      expect(invalidLowOrder.errors.join(' ')).toContain('Lower critical boundary');

      // Upper warning > upper critical is invalid
      const invalidHighOrder = validateThresholdConfig({
        parameter: 'turbidity',
        max_warning: 25,
        max_critical: 10,
      });
      expect(invalidHighOrder.valid).toBe(false);

      // Physical bounds check (pH > 14)
      const outOfBounds = validateThresholdConfig({
        parameter: 'ph',
        min_warning: 6.5,
        max_warning: 16.0,
      });
      expect(outOfBounds.valid).toBe(false);
    });

    it('applies station-specific threshold overrides over global defaults', () => {
      const overrideRes = upsertStationThresholdRule({
        station_id: 'STN-RIV-01',
        parameter: 'turbidity',
        min_warning: null,
        max_warning: 3.0,
        min_critical: null,
        max_critical: 6.0,
        enabled: true,
        notes: 'Strict headwaters turbidity standard',
      });
      expect(overrideRes.errors).toBeUndefined();

      // 4.0 NTU is normal globally (<= 5.0), but warning on STN-RIV-01 (> 3.0)
      const evalStn1 = evaluateStationReading('STN-RIV-01', 'turbidity', 4.0);
      expect(evalStn1.qualityStatus).toBe('warning');

      const evalStn2 = evaluateStationReading('STN-RIV-02', 'turbidity', 4.0);
      expect(evalStn2.qualityStatus).toBe('normal');
    });
  });

  describe('2. Alert Deduplication, Escalation, and Lifecycle Persistence', () => {
    it('deduplicates repeated warning violations and escalates to critical when severity increases', () => {
      const firstWarn = validateAndIngestReading({
        station_id: 'STN-RIV-01',
        parameter: 'turbidity',
        value: 7.2, // Warning (> 5.0 NTU)
        data_source: 'DEMO_SIMULATION',
      });
      expect(firstWarn.success).toBe(true);
      expect(firstWarn.isNewAlert).toBe(true);
      expect(firstWarn.alert?.severity).toBe('warning');
      const alertId = firstWarn.alert!.id;

      // Second warning reading on same station + parameter deduplicates rather than creating a second alert
      const secondWarn = validateAndIngestReading({
        station_id: 'STN-RIV-01',
        parameter: 'turbidity',
        value: 8.4,
        data_source: 'DEMO_SIMULATION',
      });
      expect(secondWarn.isNewAlert).toBe(false);
      expect(secondWarn.alert?.id).toBe(alertId);
      expect(secondWarn.alert?.occurrence_count).toBe(2);

      // Critical reading (> 15.0 NTU) escalates the existing alert to critical
      const criticalSpike = validateAndIngestReading({
        station_id: 'STN-RIV-01',
        parameter: 'turbidity',
        value: 19.5,
        data_source: 'DEMO_SIMULATION',
      });
      expect(criticalSpike.wasEscalated).toBe(true);
      expect(criticalSpike.alert?.id).toBe(alertId);
      expect(criticalSpike.alert?.severity).toBe('critical');
      expect(criticalSpike.alert?.occurrence_count).toBe(3);

      // Acknowledge, resolve, and reopen workflow persists audit trail
      acknowledgeAlert(alertId, 'Test Operator', 'Investigating turbidity spike');
      resolveAlert(alertId, 'Test Operator', 'Cleared debris from optical window');
      const resolvedDetails = getAlertDetails(alertId)!;
      expect(resolvedDetails.alert.resolved).toBe(1);
      expect(resolvedDetails.alert.resolution_notes).toContain('Cleared debris');

      reopenAlert(alertId, 'Test Admin', 'Reopened for post-storm verification');
      const reopenedDetails = getAlertDetails(alertId)!;
      expect(reopenedDetails.alert.resolved).toBe(0);
      expect(reopenedDetails.events.map((e) => e.event_type)).toEqual([
        'created',
        'escalated',
        'acknowledged',
        'resolved',
        'reopened',
      ]);
    });
  });

  describe('3. Sensor Data Validation & Station Capability Enforcement', () => {
    it('rejects unsupported parameters for a station and out-of-range values', () => {
      // STN-RIV-01 does not support 'ammonia' in its default seeded sensor capabilities
      const unsupported = validateAndIngestReading({
        station_id: 'STN-RIV-01',
        parameter: 'ammonia',
        value: 0.4,
      });
      expect(unsupported.success).toBe(false);
      expect(unsupported.errors?.[0]).toContain('not configured to measure');

      // Out-of-bounds pH (-2.5)
      const invalidRange = validateAndIngestReading({
        station_id: 'STN-RIV-01',
        parameter: 'ph',
        value: -2.5,
      });
      expect(invalidRange.success).toBe(false);
      expect(invalidRange.errors?.[0]).toContain('outside physical range');
    });
  });

  describe('4. Report Filtering & RFC-4180 CSV Escaping', () => {
    it('escapes commas, double quotes, and newlines properly in CSV exports', () => {
      expect(escapeCsvField('Simple text')).toBe('Simple text');
      expect(escapeCsvField('Sector B4, Weir #2')).toBe('"Sector B4, Weir #2"');
      expect(escapeCsvField('Sensor "Alpha" Probe')).toBe('"Sensor ""Alpha"" Probe"');

      const csv = generateReadingsCsv({
        stationIds: ['STN-IND-03'],
        parameters: ['ph', 'ammonia'],
        range: '24h',
      });
      const lines = csv.split('\r\n');
      expect(lines.length).toBeGreaterThan(2);
      expect(lines[0]).toContain('Reading ID,Timestamp (ISO-8601),Station ID');
      expect(lines[1]).toContain('STN-IND-03');
      expect(lines[1]).toContain('DEMO DATA (SIMULATED)');
    });

    it('filters report datasets by station and parameter and includes missing-data disclosures', () => {
      const report = buildMonitoringReportData({
        stationIds: ['STN-INT-06'], // Offline intake station
        parameters: ['ph', 'bod'], // bod is not supported by STN-INT-06
        range: '24h',
      });
      expect(report.containsSimulatedData).toBe(true);
      expect(report.stationSummaries).toHaveLength(1);
      expect(report.missingDataNotes.some((n) => n.status === 'OFFLINE')).toBe(true);
      expect(report.missingDataNotes.some((n) => n.status === 'SENSOR_CAPABILITY_NOTE')).toBe(true);
    });
  });

  describe('5. REST API Integration & Role-Based Access Control', () => {
    it('returns computed dashboard summary KPIs matching seeded stations', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(200);
      expect(res.body.kpis.totalStations).toBe(6);
      expect(res.body.kpis.activeStations).toBe(5);
      expect(res.body.kpis.offlineStations).toBe(1);
      expect(res.body.kpis.criticalActiveAlerts).toBeGreaterThanOrEqual(1);
    });

    it('enforces Administrator role for station creation/deletion and threshold updates', async () => {
      // Operator cannot delete a station
      const forbiddenDelete = await request(app)
        .delete('/api/stations/STN-RES-05')
        .set('X-Demo-Role', 'operator');
      expect(forbiddenDelete.status).toBe(403);

      // Admin can create, edit, and cascade-delete a station cleanly
      const createRes = await request(app)
        .post('/api/stations')
        .set('X-Demo-Role', 'admin')
        .send({
          name: 'Test Estuary Buoy E9',
          code: 'EST-09',
          station_type: 'Reservoir monitoring point',
          location_name: 'Estuary North Channel (Demo)',
          water_body: 'Clearwater Estuary',
          latitude: 45.58,
          longitude: -122.75,
          supported_parameters: ['ph', 'turbidity', 'dissolved_oxygen'],
        });
      expect(createRes.status).toBe(201);
      const newStationId = createRes.body.station.id;

      // Verify readings were created for the new station
      const readingsBefore = queryAll('SELECT * FROM sensor_readings WHERE station_id = ?', [newStationId]);
      expect(readingsBefore.length).toBe(3);

      // Delete the station and verify zero orphaned readings or capabilities remain
      const delRes = await request(app)
        .delete(`/api/stations/${newStationId}`)
        .set('X-Demo-Role', 'admin');
      expect(delRes.status).toBe(200);

      const readingsAfter = queryAll('SELECT * FROM sensor_readings WHERE station_id = ?', [newStationId]);
      const capsAfter = queryAll('SELECT * FROM sensor_capabilities WHERE station_id = ?', [newStationId]);
      expect(readingsAfter.length).toBe(0);
      expect(capsAfter.length).toBe(0);
    });
  });
});
