import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Cpu,
  Save,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../services/api';
import { ThresholdRule } from '../types/index';
import { PARAMETER_METADATA } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const { user, refreshGlobalData, addToast } = useAppContext();

  const [activeTab, setActiveTab] = useState<'thresholds' | 'simulation' | 'iot'>('thresholds');
  const [thresholds, setThresholds] = useState<ThresholdRule[]>([]);
  const [loadingThresholds, setLoadingThresholds] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Simulation & system settings state
  const [sysSettings, setSysSettings] = useState({
    simulation_enabled: true,
    simulation_interval_ms: 5000,
    simulation_seed: 42069,
    simulation_anomaly_probability: 0.14,
    retention_max_rows_per_station: 2500,
    alert_cooldown_minutes: 2,
    organization_name: 'Clearwater Regional Watershed Authority (Demo Instance)',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const loadSettingsAndThresholds = async () => {
    setLoadingThresholds(true);
    try {
      const [tRes, sRes] = await Promise.all([api.getThresholds(), api.getSettings()]);
      setThresholds(tRes.thresholds || []);
      if (sRes.settings) {
        setSysSettings((prev) => ({
          ...prev,
          ...sRes.settings,
        }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingThresholds(false);
    }
  };

  useEffect(() => {
    loadSettingsAndThresholds();
  }, []);

  const handleRuleFieldChange = (
    id: number,
    field: keyof ThresholdRule,
    rawValue: string | boolean
  ) => {
    setThresholds((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (
          field === 'min_warning' ||
          field === 'max_warning' ||
          field === 'min_critical' ||
          field === 'max_critical'
        ) {
          const val =
            typeof rawValue === 'string' && rawValue.trim() === ''
              ? null
              : Number(rawValue);
          return { ...r, [field]: val };
        }
        if (field === 'enabled') {
          return { ...r, enabled: rawValue ? 1 : 0 };
        }
        return { ...r, [field]: rawValue };
      })
    );
  };

  const handleSaveRule = async (rule: ThresholdRule) => {
    setRuleError(null);
    setEditingRuleId(rule.id);
    try {
      const res = await api.updateThreshold(rule.id, {
        min_warning: rule.min_warning,
        max_warning: rule.max_warning,
        min_critical: rule.min_critical,
        max_critical: rule.max_critical,
        enabled: rule.enabled,
        benchmark_authority: rule.benchmark_authority,
        water_use_category: rule.water_use_category,
        jurisdiction: rule.jurisdiction,
        reference_source: rule.reference_source,
        notes: rule.notes,
      });
      setThresholds((prev) => prev.map((r) => (r.id === rule.id ? res.threshold : r)));
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'Threshold Rule Saved',
        message: `Updated ${PARAMETER_METADATA[rule.parameter]?.name || rule.parameter} monitoring boundaries.`,
      });
    } catch (err: any) {
      const msg = err?.message || 'Invalid threshold boundary range.';
      setRuleError(msg);
      addToast({
        type: 'warning',
        title: 'Threshold Validation Failed',
        message: msg,
      });
    } finally {
      setEditingRuleId(null);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateSettings(sysSettings);
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'System Settings Persisted',
        message: 'Simulation engine parameters and retention policies updated.',
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Settings Update Failed',
        message: err?.message || 'Could not update settings.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetDemoDb = async () => {
    try {
      await api.resetDemoDatabase();
      setResetConfirmOpen(false);
      await loadSettingsAndThresholds();
      await refreshGlobalData();
      addToast({
        type: 'info',
        title: 'Demo Database Re-Seeded',
        message: 'Restored default demonstration stations, thresholds, and historical readings.',
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Reset Failed',
        message: err?.message || 'Could not reset demo database.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('thresholds')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'thresholds'
                ? 'bg-navy-900 text-white dark:bg-sky-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Water-Quality Threshold Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulation')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'simulation'
                ? 'bg-navy-900 text-white dark:bg-sky-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Simulation Engine & Retention</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('iot')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'iot'
                ? 'bg-navy-900 text-white dark:bg-sky-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Real IoT Hardware & MQTT Integration Guide</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <span>
            Active Role: <strong>{user.role.toUpperCase()}</strong>
            {user.role !== 'admin' && ' (Read-Only Settings)'}
          </span>
        </div>
      </div>

      {/* TAB 1: CONFIGURABLE WATER-QUALITY THRESHOLDS */}
      {activeTab === 'thresholds' && (
        <section className="space-y-4">
          {/* Regulatory vs Operational Threshold Disclaimer */}
          <div className="bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-card p-4 text-xs text-amber-950 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Operational Monitoring Thresholds vs. Official Regulatory Standards
              </span>
            </div>
            <p className="leading-relaxed">
              The boundaries configured below are <strong>operational screening thresholds</strong> used by the AquaGuard Alert Engine for early anomaly detection. While seeded with reference benchmarks from the US EPA and WHO for freshwater aquatic life and intake screening, <strong>configured monitoring thresholds do not certify that a water body is safe for human drinking or bathing</strong>, which requires comprehensive microbiological, heavy-metal, and certified laboratory testing.
            </p>
          </div>

          {ruleError && (
            <div
              role="alert"
              className="p-4 rounded-card bg-red-50 border border-red-200 text-red-700 text-xs font-medium dark:bg-red-950/60 dark:border-red-800 dark:text-red-300"
            >
              <strong>Validation Rejected:</strong> {ruleError}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Parameter Threshold Rules Matrix
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure lower and upper Warning and Critical boundaries per parameter. Contradictory ranges (e.g., Lower Critical &gt; Lower Warning or Upper Warning &gt; Upper Critical) are automatically rejected.
                </p>
              </div>
            </div>

            {loadingThresholds ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Loading threshold rules...
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {thresholds.map((rule) => {
                  const meta = PARAMETER_METADATA[rule.parameter];
                  return (
                    <div
                      key={rule.id}
                      className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {meta?.name || rule.parameter}
                            </span>
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Unit: {rule.unit}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                rule.station_id
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                  : 'bg-navy-50 text-navy-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {rule.station_id
                                ? `Station Override: ${rule.station_id}`
                                : 'Global Watershed Default'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            <strong>Reference Benchmark:</strong> {rule.benchmark_authority} •{' '}
                            <strong>Category:</strong> {rule.water_use_category} •{' '}
                            <strong>Source:</strong> {rule.reference_source}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={user.role !== 'admin'}
                              checked={Boolean(rule.enabled)}
                              onChange={(e) =>
                                handleRuleFieldChange(rule.id, 'enabled', e.target.checked)
                              }
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <span>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                          </label>

                          <button
                            type="button"
                            disabled={user.role !== 'admin' || editingRuleId === rule.id}
                            onClick={() => handleSaveRule(rule)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-2xs disabled:opacity-40"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>
                              {editingRuleId === rule.id ? 'Saving...' : 'Save Rule'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Boundary Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1">
                            Lower Critical ({rule.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            disabled={user.role !== 'admin'}
                            value={rule.min_critical ?? ''}
                            onChange={(e) =>
                              handleRuleFieldChange(rule.id, 'min_critical', e.target.value)
                            }
                            placeholder="None"
                            aria-label={`${meta?.name} lower critical boundary`}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                            Lower Warning ({rule.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            disabled={user.role !== 'admin'}
                            value={rule.min_warning ?? ''}
                            onChange={(e) =>
                              handleRuleFieldChange(rule.id, 'min_warning', e.target.value)
                            }
                            placeholder="None"
                            aria-label={`${meta?.name} lower warning boundary`}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                            Upper Warning ({rule.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            disabled={user.role !== 'admin'}
                            value={rule.max_warning ?? ''}
                            onChange={(e) =>
                              handleRuleFieldChange(rule.id, 'max_warning', e.target.value)
                            }
                            placeholder="None"
                            aria-label={`${meta?.name} upper warning boundary`}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1">
                            Upper Critical ({rule.unit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            disabled={user.role !== 'admin'}
                            value={rule.max_critical ?? ''}
                            onChange={(e) =>
                              handleRuleFieldChange(rule.id, 'max_critical', e.target.value)
                            }
                            placeholder="None"
                            aria-label={`${meta?.name} upper critical boundary`}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Operational Notes
                          </label>
                          <input
                            type="text"
                            disabled={user.role !== 'admin'}
                            value={rule.notes || ''}
                            onChange={(e) =>
                              handleRuleFieldChange(rule.id, 'notes', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: SIMULATION ENGINE & DATA RETENTION */}
      {activeTab === 'simulation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveSystemSettings}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-4"
          >
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Simulation Engine & Database Retention Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control how AquaGuard generates time-varying synthetic sensor readings and enforces database storage bounds
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Simulation Tick Interval (ms) [2000 – 60000]
                </label>
                <input
                  type="number"
                  min={2000}
                  max={60000}
                  step={500}
                  disabled={user.role !== 'admin'}
                  value={sysSettings.simulation_interval_ms}
                  onChange={(e) =>
                    setSysSettings({
                      ...sysSettings,
                      simulation_interval_ms: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Deterministic PRNG Seed
                </label>
                <input
                  type="number"
                  disabled={user.role !== 'admin'}
                  value={sysSettings.simulation_seed}
                  onChange={(e) =>
                    setSysSettings({
                      ...sysSettings,
                      simulation_seed: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Anomaly Injection Probability (0.0 – 1.0)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  disabled={user.role !== 'admin'}
                  value={sysSettings.simulation_anomaly_probability}
                  onChange={(e) =>
                    setSysSettings({
                      ...sysSettings,
                      simulation_anomaly_probability: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Max Stored Readings per Station (Retention Policy)
                </label>
                <input
                  type="number"
                  min={100}
                  max={50000}
                  disabled={user.role !== 'admin'}
                  value={sysSettings.retention_max_rows_per_station}
                  onChange={(e) =>
                    setSysSettings({
                      ...sysSettings,
                      retention_max_rows_per_station: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Alert Deduplication Cooldown (Minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  disabled={user.role !== 'admin'}
                  value={sysSettings.alert_cooldown_minutes}
                  onChange={(e) =>
                    setSysSettings({
                      ...sysSettings,
                      alert_cooldown_minutes: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Organization Name (Report Header)
                </label>
                <input
                  type="text"
                  disabled={user.role !== 'admin'}
                  value={sysSettings.organization_name}
                  onChange={(e) =>
                    setSysSettings({
                      ...sysSettings,
                      organization_name: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={user.role !== 'admin' || savingSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : 'Save System Configuration'}</span>
              </button>
            </div>
          </form>

          {/* Reset Demo Database Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Reset Demonstration Watershed Data
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Re-initializes the SQLite database back to its clean seeded state (6 default watershed stations, 30-day multi-horizon readings, default EPA/WHO screening thresholds, and initial alerts).
              </p>
            </div>

            {!resetConfirmOpen ? (
              <button
                type="button"
                disabled={user.role !== 'admin'}
                onClick={() => setResetConfirmOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Demo Database to Defaults</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 space-y-3">
                <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                  Confirm database reset? Custom stations and alert edits will be replaced with the fresh seed dataset.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResetDemoDb}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REAL IOT HARDWARE & MQTT INTEGRATION GUIDE */}
      {activeTab === 'iot' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-sky-600" />
              <span>Real IoT Sensor Ingestion & Hardware Readiness Architecture</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              AquaGuard uses a unified ingestion service (`validateAndIngestReading`) that separates sensor transport from threshold evaluation and alerting.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Authenticated HTTP Sensor Ingestion (Active Now)
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                An ESP32, Arduino-compatible cellular gateway, or Raspberry Pi field logger can transmit real measurements directly to <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">POST /api/readings</code> using the configured <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">X-IoT-API-Key</code> header. Readings ingested with <code className="font-mono">data_source: "IOT_HTTP_INGEST"</code> and <code className="font-mono">is_simulated: false</code> are labeled <strong>GENUINE SENSOR TELEMETRY</strong> across the UI.
              </p>

              <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`curl -X POST http://localhost:4000/api/readings \\
  -H "Content-Type: application/json" \\
  -H "X-IoT-API-Key: ag-iot-device-ingest-key-demo-2026" \\
  -d '{
    "station_id": "STN-RIV-01",
    "parameter": "ph",
    "value": 7.28,
    "unit": "pH units",
    "data_source": "IOT_HTTP_INGEST",
    "is_simulated": false
  }'`}
              </pre>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                2. ESP32 / Arduino Firmware Snippet & MQTT Extension Point
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                In this local demonstration build, external MQTT brokers and physical serial drivers are not active. To connect an MQTT broker (e.g., Mosquitto / HiveMQ) in a field deployment, subscribe to <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">aquaguard/stations/+/telemetry</code> and forward parsed JSON messages to <code className="font-mono">validateAndIngestReading()</code> in <code className="font-mono">server/src/services/ingestionService.ts</code>.
              </p>

              <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`// ESP32 HTTP Telemetry Client Example (Arduino C++)
HTTPClient http;
http.begin("https://your-aquaguard-host/api/readings");
http.addHeader("Content-Type", "application/json");
http.addHeader("X-IoT-API-Key", IOT_DEVICE_API_KEY);

String payload = "{\\"station_id\\":\\"STN-RIV-01\\",\\"parameter\\":\\"turbidity\\","
                 "\\"value\\":" + String(measuredNtu, 2) + ","
                 "\\"data_source\\":\\"IOT_HTTP_INGEST\\",\\"is_simulated\\":false}";
int httpCode = http.POST(payload);
http.end();`}
              </pre>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
