import {
  AlertEventItem,
  AlertItem,
  DashboardSummaryResponse,
  ParameterCode,
  SensorReading,
  SimulationStatus,
  Station,
  ThresholdRule,
  TimeRangeOption,
  UserSession,
} from '../types/index';
import { browserDemoEngine } from './browserDemoEngine';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

let useBrowserFallback = false;

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('aquaguard_auth_token');
    const role = localStorage.getItem('aquaguard_demo_role') || 'admin';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    headers['X-Demo-Role'] = role;
  } catch {
    // ignore storage errors
  }
  return headers;
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  fallbackFn?: () => T | Promise<T>
): Promise<T> {
  if (useBrowserFallback && fallbackFn) {
    return fallbackFn();
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Static host (e.g., GitHub Pages) returned HTML 404 instead of JSON API
      if (fallbackFn) {
        useBrowserFallback = true;
        return fallbackFn();
      }
    }

    if (!res.ok) {
      let errorMessage = `Request failed with status ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody && errBody.error) {
          errorMessage = errBody.error;
        }
      } catch {
        // ignore json parse failure
      }
      throw new Error(errorMessage);
    }

    return res.json() as Promise<T>;
  } catch (err: any) {
    // If network/fetch failed (e.g., static deployment without backend server), activate browser engine
    if (
      fallbackFn &&
      (useBrowserFallback ||
        err instanceof TypeError ||
        String(err?.message || '').includes('Failed to fetch') ||
        String(err?.message || '').includes('status 404'))
    ) {
      useBrowserFallback = true;
      return fallbackFn();
    }
    throw err;
  }
}

export const api = {
  // Dashboard
  getDashboardSummary: () =>
    requestJson<DashboardSummaryResponse>('/dashboard/summary', {}, () =>
      browserDemoEngine.getDashboardSummary()
    ),

  // Auth & Role
  login: (identifier: string, password: string) =>
    requestJson<{ user: UserSession; token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username: identifier, password }),
      },
      () =>
        browserDemoEngine.switchDemoRole(
          identifier.toLowerCase().includes('operator') ? 'operator' : 'admin'
        )
    ),

  switchDemoRole: (role: 'admin' | 'operator') =>
    requestJson<{ user: UserSession; token: string }>(
      '/auth/switch-role',
      {
        method: 'POST',
        body: JSON.stringify({ role }),
      },
      () => browserDemoEngine.switchDemoRole(role)
    ),

  getMe: () =>
    requestJson<{ user: UserSession | null; demoMode: boolean }>('/auth/me', {}, () => ({
      user: browserDemoEngine.switchDemoRole('admin').user,
      demoMode: true,
    })),

  // Stations
  getStations: (params?: {
    search?: string;
    status?: string;
    connectivity?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.connectivity) q.set('connectivity', params.connectivity);
    if (params?.sortBy) q.set('sortBy', params.sortBy);
    if (params?.sortDir) q.set('sortDir', params.sortDir);
    const qs = q.toString();
    return requestJson<{ stations: Station[]; total: number }>(
      `/stations${qs ? `?${qs}` : ''}`,
      {},
      () => browserDemoEngine.getStations(params)
    );
  },

  getStationById: (id: string) =>
    requestJson<{
      station: Station;
      alerts: AlertItem[];
      thresholds: ThresholdRule[];
    }>(`/stations/${encodeURIComponent(id)}`, {}, () => browserDemoEngine.getStationById(id)),

  createStation: (payload: Record<string, unknown>) =>
    requestJson<{ station: Station }>(
      '/stations',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => browserDemoEngine.createStation(payload)
    ),

  updateStation: (id: string, payload: Record<string, unknown>) =>
    requestJson<{ station: Station }>(
      `/stations/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      () => browserDemoEngine.updateStation(id, payload)
    ),

  deleteStation: (id: string) =>
    requestJson<{ deleted: boolean; id: string }>(
      `/stations/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
      () => browserDemoEngine.deleteStation(id)
    ),

  // Readings
  getReadings: (params?: {
    stationId?: string;
    parameter?: string;
    range?: TimeRangeOption;
    startDate?: string;
    endDate?: string;
    qualityStatus?: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.stationId) q.set('stationId', params.stationId);
    if (params?.parameter) q.set('parameter', params.parameter);
    if (params?.range) q.set('range', params.range);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.qualityStatus) q.set('qualityStatus', params.qualityStatus);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return requestJson<{
      readings: SensorReading[];
      series: SensorReading[];
      total: number;
      timeBounds: { startIso: string; endIso: string; label: string };
    }>(`/readings${qs ? `?${qs}` : ''}`, {}, () => browserDemoEngine.getReadings(params));
  },

  ingestReading: (payload: {
    station_id: string;
    parameter: ParameterCode;
    value: number;
    unit?: string;
    data_source?: 'DEMO_SIMULATION' | 'IOT_HTTP_INGEST' | 'LAB_MANUAL';
    is_simulated?: boolean;
  }) =>
    requestJson<{
      success: boolean;
      reading: SensorReading;
      alert?: AlertItem | null;
      isNewAlert?: boolean;
    }>(
      '/readings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => browserDemoEngine.ingestReading(payload)
    ),

  // Alerts
  getAlerts: (params?: {
    stationId?: string;
    severity?: string;
    status?: string;
    parameter?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.stationId) q.set('stationId', params.stationId);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    if (params?.parameter) q.set('parameter', params.parameter);
    if (params?.search) q.set('search', params.search);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return requestJson<{
      alerts: AlertItem[];
      total: number;
      unreadCount: number;
      activeCriticalCount: number;
      activeWarningCount: number;
    }>(`/alerts${qs ? `?${qs}` : ''}`, {}, () => browserDemoEngine.getAlerts(params));
  },

  getAlertDetails: (id: string) =>
    requestJson<{ alert: AlertItem; events: AlertEventItem[] }>(
      `/alerts/${encodeURIComponent(id)}`,
      {},
      () => browserDemoEngine.getAlertDetails(id)
    ),

  acknowledgeAlert: (id: string, notes?: string) =>
    requestJson<{ alert: AlertItem; details: { alert: AlertItem; events: AlertEventItem[] } }>(
      `/alerts/${encodeURIComponent(id)}/acknowledge`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      },
      () => browserDemoEngine.acknowledgeAlert(id, notes)
    ),

  resolveAlert: (id: string, resolutionNotes?: string) =>
    requestJson<{ alert: AlertItem; details: { alert: AlertItem; events: AlertEventItem[] } }>(
      `/alerts/${encodeURIComponent(id)}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ resolution_notes: resolutionNotes }),
      },
      () => browserDemoEngine.resolveAlert(id, resolutionNotes)
    ),

  reopenAlert: (id: string, notes?: string) =>
    requestJson<{ alert: AlertItem; details: { alert: AlertItem; events: AlertEventItem[] } }>(
      `/alerts/${encodeURIComponent(id)}/reopen`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      },
      () => browserDemoEngine.reopenAlert(id, notes)
    ),

  markAllAlertsRead: () =>
    requestJson<{ updatedCount: number }>(
      '/alerts/mark-all-read',
      {
        method: 'POST',
      },
      () => browserDemoEngine.markAllAlertsRead()
    ),

  // Thresholds
  getThresholds: (stationId?: string) => {
    const qs = stationId ? `?stationId=${encodeURIComponent(stationId)}` : '';
    return requestJson<{ thresholds: ThresholdRule[] }>(`/thresholds${qs}`, {}, () =>
      browserDemoEngine.getThresholds(stationId)
    );
  },

  updateThreshold: (id: number, payload: Partial<ThresholdRule>) =>
    requestJson<{ threshold: ThresholdRule }>(
      `/thresholds/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      () => browserDemoEngine.updateThreshold(id, payload)
    ),

  upsertStationThreshold: (payload: Partial<ThresholdRule> & { parameter: ParameterCode }) =>
    requestJson<{ threshold: ThresholdRule }>(
      '/thresholds',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => browserDemoEngine.upsertStationThreshold(payload)
    ),

  // Analytics
  getAnalyticsSummary: (params?: {
    stationId?: string;
    parameter?: ParameterCode;
    range?: TimeRangeOption;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.stationId) q.set('stationId', params.stationId);
    if (params?.parameter) q.set('parameter', params.parameter);
    if (params?.range) q.set('range', params.range);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return requestJson<any>(`/analytics/summary${qs ? `?${qs}` : ''}`, {}, () =>
      browserDemoEngine.getAnalyticsSummary(params)
    );
  },

  // Reports
  getReportPreview: (params: {
    range?: TimeRangeOption;
    startDate?: string;
    endDate?: string;
    stationIds?: string[];
    parameters?: ParameterCode[];
    includeAlerts?: boolean;
    reportMode?: 'summary' | 'detailed';
    title?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.range) q.set('range', params.range);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    if (params.stationIds && params.stationIds.length > 0) {
      q.set('stationIds', params.stationIds.join(','));
    }
    if (params.parameters && params.parameters.length > 0) {
      q.set('parameters', params.parameters.join(','));
    }
    if (params.includeAlerts !== undefined) {
      q.set('includeAlerts', String(params.includeAlerts));
    }
    if (params.reportMode) q.set('reportMode', params.reportMode);
    if (params.title) q.set('title', params.title);
    return requestJson<any>(`/reports/preview?${q.toString()}`, {}, () =>
      browserDemoEngine.getReportPreview(params)
    );
  },

  downloadReportCsvUrl: (params: {
    type: 'readings' | 'alerts';
    range?: TimeRangeOption;
    startDate?: string;
    endDate?: string;
    stationIds?: string[];
    parameters?: ParameterCode[];
  }) => {
    const q = new URLSearchParams();
    q.set('format', 'csv');
    q.set('type', params.type);
    if (params.range) q.set('range', params.range);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    if (params.stationIds && params.stationIds.length > 0) {
      q.set('stationIds', params.stationIds.join(','));
    }
    if (params.parameters && params.parameters.length > 0) {
      q.set('parameters', params.parameters.join(','));
    }
    return `${API_BASE}/reports/export?${q.toString()}`;
  },

  // Simulation & Settings
  getSimulationStatus: () =>
    requestJson<SimulationStatus>('/simulation/status', {}, () =>
      browserDemoEngine.getDashboardSummary().simulation
    ),

  toggleSimulation: (enabled?: boolean) =>
    requestJson<SimulationStatus>(
      '/simulation/toggle',
      {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      },
      () => browserDemoEngine.toggleSimulation(enabled)
    ),

  stepSimulation: (options?: {
    forceAnomaly?: boolean;
    stationId?: string;
    parameter?: ParameterCode;
  }) =>
    requestJson<{
      generatedReadingsCount: number;
      newAlerts: AlertItem[];
      timestamp: string;
      simulation: SimulationStatus;
    }>(
      '/simulation/step',
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      },
      () => browserDemoEngine.stepSimulation(options)
    ),

  getSettings: () =>
    requestJson<{
      settings: Record<string, any>;
      rawSettings: Array<{ key: string; value: string; description: string; updated_at: string }>;
      simulation: SimulationStatus;
    }>('/settings', {}, () => browserDemoEngine.getSettings()),

  updateSettings: (payload: Record<string, unknown>) =>
    requestJson<{ updated: boolean; simulation: SimulationStatus; settings: Record<string, any> }>(
      '/settings',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      () => browserDemoEngine.updateSettings(payload)
    ),

  resetDemoDatabase: () =>
    requestJson<{ reset: boolean; message: string }>(
      '/database/reset-demo',
      {
        method: 'POST',
      },
      () => browserDemoEngine.resetDemoDatabase()
    ),
};
