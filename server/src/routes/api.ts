import { Router, Request, Response } from 'express';
import {
  ALL_PARAMETER_CODES,
  ParameterCode,
  WATER_PARAMETERS,
} from '../types/index.js';
import {
  getSetting,
  setSetting,
  queryAll,
} from '../database/db.js';
import {
  authenticateUser,
  switchDemoRole,
} from '../services/authService.js';
import {
  requireAdmin,
  requireAuth,
  requireIoTIngestOrAuth,
} from '../middleware/authMiddleware.js';
import {
  createStation,
  deleteStation,
  getDashboardSummary,
  getStationById,
  listStations,
  updateStation,
} from '../services/stationService.js';
import {
  listThresholdRules,
  updateThresholdRuleById,
  upsertStationThresholdRule,
} from '../services/thresholdService.js';
import {
  acknowledgeAlert,
  getAlertDetails,
  listAlerts,
  markAllAlertsAsRead,
  reopenAlert,
  resolveAlert,
} from '../services/alertService.js';
import {
  enforceRetentionPolicy,
  validateAndIngestReading,
} from '../services/ingestionService.js';
import {
  buildMonitoringReportData,
  generateAlertsCsv,
  generateReadingsCsv,
  getAnalyticsSummary,
  queryReadings,
} from '../services/analyticsService.js';
import { simulationEngine } from '../simulation/simulationEngine.js';
import { seedDatabaseIfNeeded } from '../database/seed.js';

export const apiRouter = Router();

// 1. Health & Metadata
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'AquaGuard Telemetry & Water Quality API',
    version: '1.0.0',
    demoMode: process.env.DEMO_MODE !== 'false',
    simulation: simulationEngine.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/parameters', (_req: Request, res: Response) => {
  res.json({
    parameters: Object.values(WATER_PARAMETERS),
  });
});

// 2. Authentication & Role Management
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, email, password } = req.body || {};
  const identifier = username || email;
  if (!identifier || !password) {
    res.status(400).json({ error: 'Username/email and password are required.' });
    return;
  }

  const authResult = authenticateUser(String(identifier), String(password));
  if (!authResult) {
    res.status(401).json({ error: 'Invalid credentials. Check your username/email and password.' });
    return;
  }

  res.json(authResult);
});

apiRouter.post('/auth/switch-role', (req: Request, res: Response) => {
  const { role } = req.body || {};
  if (role !== 'admin' && role !== 'operator') {
    res.status(400).json({ error: "Role must be 'admin' or 'operator'." });
    return;
  }

  const switched = switchDemoRole(role);
  if (!switched) {
    res.status(403).json({ error: 'Demo role switching is only available in local demonstration mode.' });
    return;
  }

  res.json(switched);
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  res.json({
    user: req.user || null,
    demoMode: process.env.DEMO_MODE !== 'false',
  });
});

// 3. Dashboard Summary
apiRouter.get('/dashboard/summary', (_req: Request, res: Response) => {
  const summary = getDashboardSummary();
  res.json({
    ...summary,
    simulation: simulationEngine.getStatus(),
  });
});

// 4. Stations CRUD
apiRouter.get('/stations', (req: Request, res: Response) => {
  const stations = listStations({
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    connectivity: typeof req.query.connectivity === 'string' ? req.query.connectivity : undefined,
    sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined,
    sortDir: req.query.sortDir === 'desc' ? 'desc' : 'asc',
  });
  res.json({ stations, total: stations.length });
});

apiRouter.get('/stations/:id', (req: Request, res: Response) => {
  const station = getStationById(req.params.id);
  if (!station) {
    res.status(404).json({ error: `Monitoring station '${req.params.id}' not found.` });
    return;
  }
  const stationAlerts = listAlerts({ stationId: station.id, limit: 25 });
  const thresholds = listThresholdRules(station.id);
  res.json({
    station,
    alerts: stationAlerts.alerts,
    thresholds,
  });
});

apiRouter.post('/stations', requireAdmin, (req: Request, res: Response) => {
  const result = createStation(req.body || {});
  if (result.errors) {
    res.status(400).json({ error: result.errors[0], errors: result.errors });
    return;
  }
  res.status(201).json({ station: result.station });
});

apiRouter.patch('/stations/:id', requireAdmin, (req: Request, res: Response) => {
  const result = updateStation(req.params.id, req.body || {});
  if (result.errors) {
    const status = result.errors[0]?.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.errors[0], errors: result.errors });
    return;
  }
  res.json({ station: result.station });
});

apiRouter.delete('/stations/:id', requireAdmin, (req: Request, res: Response) => {
  const result = deleteStation(req.params.id);
  if (!result.deleted) {
    res.status(404).json({ error: result.error || 'Station not found.' });
    return;
  }
  res.json({ deleted: true, id: req.params.id });
});

// 5. Sensor Readings & Ingestion
apiRouter.get('/readings', (req: Request, res: Response) => {
  const data = queryReadings({
    stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
    parameter: typeof req.query.parameter === 'string' ? req.query.parameter : undefined,
    range: (req.query.range as '1h' | '24h' | '7d' | '30d') || undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    qualityStatus: typeof req.query.qualityStatus === 'string' ? req.query.qualityStatus : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(data);
});

apiRouter.get('/stations/:id/readings', (req: Request, res: Response) => {
  const station = getStationById(req.params.id);
  if (!station) {
    res.status(404).json({ error: `Station '${req.params.id}' not found.` });
    return;
  }
  const data = queryReadings({
    stationId: req.params.id,
    parameter: typeof req.query.parameter === 'string' ? req.query.parameter : undefined,
    range: (req.query.range as '1h' | '24h' | '7d' | '30d') || undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(data);
});

apiRouter.post('/readings', requireIoTIngestOrAuth, (req: Request, res: Response) => {
  const body = req.body || {};
  const hasIoTKey = Boolean(req.headers['x-iot-api-key']);
  const dataSource =
    body.data_source || (hasIoTKey ? 'IOT_HTTP_INGEST' : 'LAB_MANUAL');
  const isSimulated =
    body.is_simulated !== undefined
      ? Boolean(body.is_simulated)
      : dataSource === 'DEMO_SIMULATION';

  const result = validateAndIngestReading({
    station_id: body.station_id,
    parameter: body.parameter,
    value: Number(body.value),
    unit: body.unit,
    data_source: dataSource,
    is_simulated: isSimulated,
    recorded_at: body.recorded_at,
  });

  if (!result.success) {
    res.status(400).json({
      error: result.errors?.[0] || 'Invalid reading payload.',
      errors: result.errors,
    });
    return;
  }

  res.status(201).json(result);
});

// 6. Alerts Management
apiRouter.get('/alerts', (req: Request, res: Response) => {
  const data = listAlerts({
    stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
    severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
    status: (req.query.status as any) || 'all',
    parameter: typeof req.query.parameter === 'string' ? req.query.parameter : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(data);
});

apiRouter.get('/alerts/:id', (req: Request, res: Response) => {
  const details = getAlertDetails(req.params.id);
  if (!details) {
    res.status(404).json({ error: `Alert '${req.params.id}' not found.` });
    return;
  }
  res.json(details);
});

apiRouter.patch('/alerts/:id', requireAuth, (req: Request, res: Response) => {
  const { action, notes, resolution_notes } = req.body || {};
  const actor = req.user?.fullName || 'Operator';

  if (action === 'acknowledge') {
    const updated = acknowledgeAlert(req.params.id, actor, notes);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }
    res.json({ alert: updated });
    return;
  }

  if (action === 'resolve') {
    const updated = resolveAlert(req.params.id, actor, resolution_notes || notes);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }
    res.json({ alert: updated });
    return;
  }

  if (action === 'reopen') {
    const updated = reopenAlert(req.params.id, actor, notes);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }
    res.json({ alert: updated });
    return;
  }

  res.status(400).json({ error: "Invalid action. Supported actions: 'acknowledge', 'resolve', 'reopen'." });
});

apiRouter.post('/alerts/:id/acknowledge', requireAuth, (req: Request, res: Response) => {
  const actor = req.user?.fullName || req.body?.actor || 'Operator';
  const notes = req.body?.notes || 'Alert acknowledged via operator dashboard.';
  const updated = acknowledgeAlert(req.params.id, actor, notes);
  if (!updated) {
    res.status(404).json({ error: `Alert '${req.params.id}' not found.` });
    return;
  }
  res.json({ alert: updated, details: getAlertDetails(req.params.id) });
});

apiRouter.post('/alerts/:id/resolve', requireAuth, (req: Request, res: Response) => {
  const actor = req.user?.fullName || req.body?.actor || 'Operator';
  const notes =
    req.body?.resolution_notes ||
    req.body?.notes ||
    'Resolved following parameter verification and stabilization.';
  const updated = resolveAlert(req.params.id, actor, notes);
  if (!updated) {
    res.status(404).json({ error: `Alert '${req.params.id}' not found.` });
    return;
  }
  res.json({ alert: updated, details: getAlertDetails(req.params.id) });
});

apiRouter.post('/alerts/:id/reopen', requireAuth, (req: Request, res: Response) => {
  const actor = req.user?.fullName || req.body?.actor || 'Operator';
  const notes = req.body?.notes || 'Reopened for follow-up sensor inspection.';
  const updated = reopenAlert(req.params.id, actor, notes);
  if (!updated) {
    res.status(404).json({ error: `Alert '${req.params.id}' not found.` });
    return;
  }
  res.json({ alert: updated, details: getAlertDetails(req.params.id) });
});

apiRouter.post('/alerts/mark-all-read', requireAuth, (_req: Request, res: Response) => {
  const count = markAllAlertsAsRead();
  res.json({ updatedCount: count });
});

// 7. Threshold Rules Configuration
apiRouter.get('/thresholds', (req: Request, res: Response) => {
  const stationId = typeof req.query.stationId === 'string' ? req.query.stationId : undefined;
  const thresholds = listThresholdRules(stationId);
  res.json({ thresholds });
});

apiRouter.put('/thresholds/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid threshold ID.' });
    return;
  }
  const result = updateThresholdRuleById(id, req.body || {});
  if (result.errors) {
    const status = result.errors[0]?.includes('not found') ? 404 : 400;
    res.status(status).json({ error: result.errors[0], errors: result.errors });
    return;
  }
  res.json({ threshold: result.rule });
});

apiRouter.post('/thresholds', requireAdmin, (req: Request, res: Response) => {
  const body = req.body || {};
  const result = upsertStationThresholdRule({
    station_id: body.station_id || null,
    parameter: body.parameter,
    min_warning: body.min_warning ?? null,
    max_warning: body.max_warning ?? null,
    min_critical: body.min_critical ?? null,
    max_critical: body.max_critical ?? null,
    enabled: body.enabled ?? true,
    benchmark_authority: body.benchmark_authority,
    water_use_category: body.water_use_category,
    jurisdiction: body.jurisdiction,
    reference_source: body.reference_source,
    notes: body.notes,
  });

  if (result.errors) {
    res.status(400).json({ error: result.errors[0], errors: result.errors });
    return;
  }
  res.status(201).json({ threshold: result.rule });
});

// 8. Analytics & Historical Trends
apiRouter.get('/analytics/summary', (req: Request, res: Response) => {
  const summary = getAnalyticsSummary({
    stationId: typeof req.query.stationId === 'string' ? req.query.stationId : undefined,
    parameter: (req.query.parameter as ParameterCode) || undefined,
    range: (req.query.range as '1h' | '24h' | '7d' | '30d') || undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
  });
  res.json(summary);
});

// 9. Reports & Exports (CSV / JSON for PDF builder)
apiRouter.get('/reports/preview', (req: Request, res: Response) => {
  const stationIds =
    typeof req.query.stationIds === 'string' && req.query.stationIds.trim() !== ''
      ? req.query.stationIds.split(',').map((s) => s.trim())
      : undefined;
  const parameters =
    typeof req.query.parameters === 'string' && req.query.parameters.trim() !== ''
      ? (req.query.parameters.split(',').map((p) => p.trim()) as ParameterCode[])
      : undefined;

  const report = buildMonitoringReportData({
    range: (req.query.range as '1h' | '24h' | '7d' | '30d') || undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    stationIds,
    parameters,
    includeAlerts: req.query.includeAlerts !== 'false',
    reportMode: req.query.reportMode === 'detailed' ? 'detailed' : 'summary',
    title: typeof req.query.title === 'string' ? req.query.title : undefined,
  });

  res.json(report);
});

apiRouter.get('/reports/export', (req: Request, res: Response) => {
  const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'csv';
  const type = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'readings';
  const stationIds =
    typeof req.query.stationIds === 'string' && req.query.stationIds.trim() !== ''
      ? req.query.stationIds.split(',').map((s) => s.trim())
      : undefined;
  const parameters =
    typeof req.query.parameters === 'string' && req.query.parameters.trim() !== ''
      ? (req.query.parameters.split(',').map((p) => p.trim()) as ParameterCode[])
      : undefined;

  const filterInput = {
    range: (req.query.range as '1h' | '24h' | '7d' | '30d') || undefined,
    startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
    stationIds,
    parameters,
    includeAlerts: req.query.includeAlerts !== 'false',
    reportMode: (req.query.reportMode === 'detailed' ? 'detailed' : 'summary') as 'summary' | 'detailed',
    title: typeof req.query.title === 'string' ? req.query.title : undefined,
  };

  if (format === 'csv') {
    const csvContent =
      type === 'alerts'
        ? generateAlertsCsv(filterInput)
        : generateReadingsCsv(filterInput);
    const filename = `aquaguard-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
    return;
  }

  const reportData = buildMonitoringReportData(filterInput);
  res.json(reportData);
});

// 10. Simulation Controls & Application Settings
apiRouter.get('/simulation/status', (_req: Request, res: Response) => {
  res.json(simulationEngine.getStatus());
});

apiRouter.post('/simulation/toggle', requireAuth, (req: Request, res: Response) => {
  const { enabled } = req.body || {};
  const current = simulationEngine.getStatus().isRunning;
  const targetState = enabled !== undefined ? Boolean(enabled) : !current;

  if (targetState) {
    simulationEngine.start();
  } else {
    simulationEngine.stop();
  }

  res.json(simulationEngine.getStatus());
});

apiRouter.post('/simulation/step', requireAuth, (req: Request, res: Response) => {
  const { forceAnomaly, stationId, parameter } = req.body || {};
  const result = simulationEngine.runSimulationTick({
    forceAnomaly: Boolean(forceAnomaly),
    targetStationId: stationId && stationId !== 'all' ? String(stationId) : undefined,
    targetParameter:
      parameter && ALL_PARAMETER_CODES.includes(parameter)
        ? (parameter as ParameterCode)
        : undefined,
  });

  res.json({
    ...result,
    simulation: simulationEngine.getStatus(),
  });
});

apiRouter.get('/settings', (_req: Request, res: Response) => {
  const rows = queryAll<{ key: string; value: string; description: string; updated_at: string }>(
    'SELECT * FROM application_settings ORDER BY key ASC'
  );
  const settingsMap: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      settingsMap[r.key] = JSON.parse(r.value);
    } catch {
      settingsMap[r.key] = r.value;
    }
  }
  res.json({
    settings: settingsMap,
    rawSettings: rows,
    simulation: simulationEngine.getStatus(),
  });
});

apiRouter.put('/settings', requireAdmin, (req: Request, res: Response) => {
  const updates = req.body || {};

  if (updates.simulation_interval_ms !== undefined) {
    const val = Number(updates.simulation_interval_ms);
    if (Number.isNaN(val) || val < 2000 || val > 60000) {
      res.status(400).json({ error: 'Simulation interval must be between 2000 ms (2s) and 60000 ms (60s).' });
      return;
    }
    setSetting('simulation_interval_ms', val);
  }

  if (updates.simulation_seed !== undefined) {
    const seed = Number(updates.simulation_seed);
    if (!Number.isNaN(seed)) {
      simulationEngine.setSeed(seed);
    }
  }

  if (updates.simulation_anomaly_probability !== undefined) {
    const prob = Number(updates.simulation_anomaly_probability);
    if (Number.isNaN(prob) || prob < 0 || prob > 1) {
      res.status(400).json({ error: 'Anomaly probability must be between 0.0 and 1.0.' });
      return;
    }
    setSetting('simulation_anomaly_probability', prob);
  }

  if (updates.retention_max_rows_per_station !== undefined) {
    const maxRows = Number(updates.retention_max_rows_per_station);
    if (Number.isNaN(maxRows) || maxRows < 100 || maxRows > 50000) {
      res.status(400).json({ error: 'Retention limit must be between 100 and 50,000 rows per station.' });
      return;
    }
    setSetting('retention_max_rows_per_station', maxRows);
    enforceRetentionPolicy();
  }

  if (updates.alert_cooldown_minutes !== undefined) {
    const cd = Number(updates.alert_cooldown_minutes);
    if (Number.isNaN(cd) || cd < 0 || cd > 1440) {
      res.status(400).json({ error: 'Alert cooldown must be between 0 and 1440 minutes.' });
      return;
    }
    setSetting('alert_cooldown_minutes', cd);
  }

  if (typeof updates.organization_name === 'string') {
    setSetting('organization_name', updates.organization_name.trim());
  }

  if (updates.simulation_enabled !== undefined) {
    if (updates.simulation_enabled) {
      simulationEngine.start();
    } else {
      simulationEngine.stop();
    }
  } else if (simulationEngine.getStatus().isRunning) {
    // Restart timer if interval changed while running
    simulationEngine.start();
  }

  res.json({
    updated: true,
    simulation: simulationEngine.getStatus(),
    settings: {
      simulation_enabled: getSetting('simulation_enabled', true),
      simulation_interval_ms: getSetting('simulation_interval_ms', 5000),
      simulation_seed: getSetting('simulation_seed', 42069),
      simulation_anomaly_probability: getSetting('simulation_anomaly_probability', 0.14),
      retention_max_rows_per_station: getSetting('retention_max_rows_per_station', 2500),
      alert_cooldown_minutes: getSetting('alert_cooldown_minutes', 2),
      organization_name: getSetting('organization_name', 'Clearwater Regional Watershed Authority'),
    },
  });
});

apiRouter.post('/database/reset-demo', requireAdmin, (_req: Request, res: Response) => {
  const wasRunning = simulationEngine.getStatus().isRunning;
  simulationEngine.stop();
  seedDatabaseIfNeeded(true);
  if (wasRunning) {
    simulationEngine.start();
  }
  res.json({
    reset: true,
    message: 'Demonstration database reset to default seeded state.',
  });
});
