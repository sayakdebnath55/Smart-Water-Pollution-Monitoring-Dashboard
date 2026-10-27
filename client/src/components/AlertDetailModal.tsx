import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  MapPin,
  RotateCcw,
  ShieldAlert,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertEventItem, AlertItem } from '../types/index';
import { api } from '../services/api';
import { useAppContext } from '../hooks/useAppContext';
import { StatusBadge, DemoProvenanceBadge } from './StatusBadge';
import { formatLocalDateTime, PARAMETER_METADATA } from '../utils/formatters';

export const AlertDetailModal: React.FC = () => {
  const { selectedAlertId, closeAlertModal, refreshGlobalData, addToast } = useAppContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertItem | null>(null);
  const [events, setEvents] = useState<AlertEventItem[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAlertId) {
      setAlert(null);
      setEvents([]);
      setNotes('');
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getAlertDetails(selectedAlertId)
      .then((res) => {
        if (cancelled) return;
        setAlert(res.alert);
        setEvents(res.events || []);
        setNotes(res.alert.resolution_notes || '');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load alert details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAlertId]);

  if (!selectedAlertId) return null;

  const handleAcknowledge = async () => {
    if (!alert) return;
    setSubmitting(true);
    try {
      const res = await api.acknowledgeAlert(
        alert.id,
        notes.trim() || 'Acknowledged by operator via alert inspection modal.'
      );
      setAlert(res.details.alert);
      setEvents(res.details.events);
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'Alert Acknowledged',
        message: `Alert ${alert.id} marked as acknowledged.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not acknowledge alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!alert) return;
    setSubmitting(true);
    try {
      const res = await api.resolveAlert(
        alert.id,
        notes.trim() || 'Resolved after verifying sensor readings stabilized.'
      );
      setAlert(res.details.alert);
      setEvents(res.details.events);
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'Alert Resolved',
        message: `Alert ${alert.id} has been resolved and archived to history.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not resolve alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!alert) return;
    setSubmitting(true);
    try {
      const res = await api.reopenAlert(
        alert.id,
        notes.trim() || 'Reopened for additional water quality verification.'
      );
      setAlert(res.details.alert);
      setEvents(res.details.events);
      await refreshGlobalData();
      addToast({
        type: 'info',
        title: 'Alert Reopened',
        message: `Alert ${alert.id} is active again.`,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not reopen alert.');
    } finally {
      setSubmitting(false);
    }
  };

  const paramMeta =
    alert && alert.parameter !== 'connectivity'
      ? PARAMETER_METADATA[alert.parameter]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-2xl w-full max-w-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <div>
              <h2 id="alert-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Pollution Alert Inspection — {selectedAlertId}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Threshold excursion diagnostics, station provenance, and resolution audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAlertModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            aria-label="Close alert details modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-5">
          {loading && (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading alert diagnostics...
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm dark:bg-red-950/50 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {alert && !loading && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={alert.severity} size="md" />
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      alert.resolved
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : alert.acknowledged
                          ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
                          : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {alert.resolved
                      ? 'Resolved'
                      : alert.acknowledged
                        ? 'Acknowledged'
                        : 'Unacknowledged (Action Required)'}
                  </span>
                  <DemoProvenanceBadge isSimulated={alert.is_simulated} />
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Occurrences: {alert.occurrence_count}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {alert.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {alert.message}
                </p>
              </div>

              {/* Key Telemetry Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 text-sm">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Affected Monitoring Station
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>
                      {alert.station_name || alert.station_id} ({alert.station_id})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeAlertModal();
                      navigate(`/stations?stationId=${encodeURIComponent(alert.station_id)}`);
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
                  >
                    <span>Open Station Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Parameter & Triggered Limit
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {paramMeta ? paramMeta.name : 'Station Telemetry Connectivity'}
                  </div>
                  <div className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                    Measured:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {alert.measured_value !== null ? `${alert.measured_value} ${alert.unit}` : 'Offline'}
                    </strong>{' '}
                    | Limit: <strong>{alert.triggered_threshold}</strong>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Created Timestamp
                  </span>
                  <div className="font-mono text-xs text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatLocalDateTime(alert.created_at)}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Last Updated Timestamp
                  </span>
                  <div className="font-mono text-xs text-slate-800 dark:text-slate-200 mt-0.5">
                    {formatLocalDateTime(alert.updated_at)}
                  </div>
                </div>
              </div>

              {/* Operator Notes & Action Controls */}
              <div className="space-y-2">
                <label
                  htmlFor="alert-operator-notes"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Operator Investigation / Resolution Notes
                </label>
                <textarea
                  id="alert-operator-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter root-cause observations, corrective actions, or sensor calibration notes..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Notification Channel: <strong>Dashboard Console Only</strong> (Local Demo Mode)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!alert.acknowledged && !alert.resolved && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleAcknowledge}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs disabled:opacity-50"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Acknowledge Alert</span>
                      </button>
                    )}

                    {!alert.resolved && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleResolve}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve Alert</span>
                      </button>
                    )}

                    {Boolean(alert.resolved) && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleReopen}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen Alert</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Alert Lifecycle & Audit Log ({events.length})</span>
                </h4>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-xs"
                    >
                      <div>
                        <span className="font-semibold uppercase text-sky-700 dark:text-sky-400 mr-2">
                          [{ev.event_type}]
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {ev.actor}
                        </span>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{ev.notes}</p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {formatLocalDateTime(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
