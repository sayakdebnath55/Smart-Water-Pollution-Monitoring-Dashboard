import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  CheckCheck,
  BellRing,
  Zap,
} from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../services/api';
import { AlertItem } from '../types/index';
import {
  ALL_PARAMETERS_LIST,
  formatLocalDateTime,
  PARAMETER_METADATA,
} from '../utils/formatters';
import { DemoProvenanceBadge, StatusBadge } from '../components/StatusBadge';

export const AlertsPage: React.FC = () => {
  const {
    summary,
    openAlertModal,
    refreshGlobalData,
    triggerSimulationStep,
    addToast,
  } = useAppContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const stations = summary?.stations || [];

  const [severityFilter, setSeverityFilter] = useState(
    searchParams.get('severity') || 'all'
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || 'all'
  );
  const [stationFilter, setStationFilter] = useState(
    searchParams.get('stationId') || 'all'
  );
  const [parameterFilter, setParameterFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    unreadCount: 0,
    activeCriticalCount: 0,
    activeWarningCount: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAlerts({
        severity: severityFilter,
        status: statusFilter,
        stationId: stationFilter,
        parameter: parameterFilter,
        search: searchQuery,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
        limit: 150,
      });
      setAlerts(res.alerts || []);
      setCounts({
        total: res.total,
        unreadCount: res.unreadCount,
        activeCriticalCount: res.activeCriticalCount,
        activeWarningCount: res.activeWarningCount,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [
    severityFilter,
    statusFilter,
    stationFilter,
    parameterFilter,
    searchQuery,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, summary?.kpis?.lastDataUpdate]);

  const handleQuickAcknowledge = async (alert: AlertItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.acknowledgeAlert(alert.id, 'Acknowledged from Alerts Console table.');
      await fetchAlerts();
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'Alert Acknowledged',
        message: `${alert.id} marked as acknowledged.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Action Failed',
        message: err?.message || 'Could not acknowledge alert.',
      });
    }
  };

  const handleQuickResolve = async (alert: AlertItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.resolveAlert(
        alert.id,
        'Resolved from Alerts Console after verifying telemetry recovery.'
      );
      await fetchAlerts();
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'Alert Resolved',
        message: `${alert.id} marked as resolved.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Action Failed',
        message: err?.message || 'Could not resolve alert.',
      });
    }
  };

  const handleQuickReopen = async (alert: AlertItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.reopenAlert(alert.id, 'Reopened from Alerts Console for review.');
      await fetchAlerts();
      await refreshGlobalData();
      addToast({
        type: 'info',
        title: 'Alert Reopened',
        message: `${alert.id} returned to active alerts.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Action Failed',
        message: err?.message || 'Could not reopen alert.',
      });
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllAlertsRead();
    await fetchAlerts();
    await refreshGlobalData();
    addToast({
      type: 'info',
      title: 'Notifications Cleared',
      message: 'All unread alerts marked as read.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Active Critical Alerts</span>
            <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
              {counts.activeCriticalCount}
            </div>
          </div>
          <StatusBadge status="critical" size="md" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Active Warning Alerts</span>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {counts.activeWarningCount}
            </div>
          </div>
          <StatusBadge status="warning" size="md" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Unread Alerts</span>
            <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
              {counts.unreadCount}
            </div>
          </div>
          <button
            type="button"
            disabled={counts.unreadCount === 0}
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 disabled:opacity-40"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Notification Dispatch</span>
            <BellRing className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
            External SMS/Email is not configured in local demo mode. Alerts are delivered in this console with deduplication & cooldown protection.
          </p>
        </div>
      </div>

      {/* Filters & Actions Toolbar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Quick Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter alerts by lifecycle status">
            {[
              { id: 'all', label: 'All History' },
              { id: 'active', label: 'Active (Unresolved)' },
              { id: 'unacknowledged', label: 'Unacknowledged' },
              { id: 'acknowledged', label: 'Acknowledged' },
              { id: 'resolved', label: 'Resolved History' },
              { id: 'unread', label: 'Unread Only' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setSearchParams({ status: tab.id, severity: severityFilter });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-navy-900 text-white border-navy-900 dark:bg-sky-600 dark:border-sky-500'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => triggerSimulationStep({ forceAnomaly: true })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Trigger Demo Threshold Violation</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alert ID, station, parameter, or message..."
              aria-label="Search alerts"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <select
            aria-label="Filter by severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
          </select>

          <select
            aria-label="Filter by station"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="all">All Stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by parameter"
            value={parameterFilter}
            onChange={(e) => setParameterFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
          >
            <option value="all">All Parameters</option>
            <option value="connectivity">Connectivity / Offline</option>
            {ALL_PARAMETERS_LIST.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Start date filter"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs"
            />
            <input
              type="date"
              aria-label="End date filter"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </section>

      {/* Alerts Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Alert ID & Severity</th>
                <th className="py-3 px-4">Affected Station</th>
                <th className="py-3 px-4">Parameter</th>
                <th className="py-3 px-4">Measured vs Threshold</th>
                <th className="py-3 px-4">Created Timestamp</th>
                <th className="py-3 px-4">Lifecycle Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No pollution alerts match the selected filters.
                  </td>
                </tr>
              ) : (
                alerts.map((al) => {
                  const pMeta =
                    al.parameter !== 'connectivity'
                      ? PARAMETER_METADATA[al.parameter]
                      : null;
                  return (
                    <tr
                      key={al.id}
                      onClick={() => openAlertModal(al.id)}
                      className={`hover:bg-sky-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        !al.is_read && !al.resolved ? 'bg-sky-50/25 dark:bg-sky-950/15' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={al.severity} />
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {al.id}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <DemoProvenanceBadge isSimulated={al.is_simulated} compact />
                          {al.occurrence_count > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                              ×{al.occurrence_count} deduplicated
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {al.station_name || al.station_id}
                        </div>
                        <div className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                          {al.station_id}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {pMeta ? pMeta.name : 'Station Connectivity'}
                        </div>
                        <div className="text-[11px] text-slate-500">{al.title}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {al.measured_value !== null
                            ? `${al.measured_value} ${al.unit}`
                            : 'TELEMETRY OFFLINE'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Limit: {al.triggered_threshold}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatLocalDateTime(al.created_at)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            al.resolved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : al.acknowledged
                                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
                                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {al.resolved
                            ? 'Resolved'
                            : al.acknowledged
                              ? 'Acknowledged'
                              : 'Unacknowledged'}
                        </span>
                        {al.resolution_notes && (
                          <div className="text-[11px] text-slate-500 mt-1 max-w-[200px] truncate">
                            Note: {al.resolution_notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAlertModal(al.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Inspect full alert details and audit trail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!al.acknowledged && !al.resolved && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickAcknowledge(al, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Acknowledge</span>
                            </button>
                          )}

                          {!al.resolved && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickResolve(al, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Resolve</span>
                            </button>
                          )}

                          {Boolean(al.resolved) && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickReopen(al, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reopen</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
