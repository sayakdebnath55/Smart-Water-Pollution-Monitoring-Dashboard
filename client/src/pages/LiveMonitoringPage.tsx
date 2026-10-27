import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play,
  Pause,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  FlaskConical,
  Clock,
  Sliders,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../services/api';
import {
  ParameterCode,
  SensorReading,
  TimeRangeOption,
} from '../types/index';
import {
  ALL_PARAMETERS_LIST,
  formatLocalDateTime,
  formatParameterValue,
  formatShortTime,
  PARAMETER_METADATA,
} from '../utils/formatters';
import {
  ConnectivityBadge,
  DemoProvenanceBadge,
  InfoTooltip,
  SensorSourceBadge,
  StatusBadge,
} from '../components/StatusBadge';

export const LiveMonitoringPage: React.FC = () => {
  const {
    summary,
    isSimulationRunning,
    toggleSimulation,
    triggerSimulationStep,
    refreshGlobalData,
    addToast,
    openAlertModal,
  } = useAppContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const stations = summary?.stations || [];

  const initialStId = searchParams.get('stationId') || stations[0]?.id || 'STN-IND-03';
  const initialParam = (searchParams.get('parameter') as ParameterCode) || 'ph';

  const [selectedStationId, setSelectedStationId] = useState<string>(initialStId);
  const [selectedParam, setSelectedParam] = useState<ParameterCode>(initialParam);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('1h');
  const [comparisonMode, setComparisonMode] = useState<'prev' | 'window_avg'>('prev');

  const [historicalSeries, setHistoricalSeries] = useState<SensorReading[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);

  // Manual Lab / Grab Sample Modal state
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [labValue, setLabValue] = useState<string>('');
  const [submittingLab, setSubmittingLab] = useState(false);

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) || stations[0] || null,
    [stations, selectedStationId]
  );

  // Ensure selectedParam is supported by the station when switching stations
  useEffect(() => {
    if (!selectedStation) return;
    const enabledCaps = selectedStation.capabilities.filter((c) => c.is_enabled);
    if (
      enabledCaps.length > 0 &&
      !enabledCaps.some((c) => c.parameter === selectedParam)
    ) {
      setSelectedParam(enabledCaps[0].parameter);
    }
  }, [selectedStation, selectedParam]);

  // Fetch historical readings for the selected station + parameter + timeRange
  useEffect(() => {
    if (!selectedStation) return;
    let cancelled = false;
    setLoadingSeries(true);

    api
      .getReadings({
        stationId: selectedStation.id,
        parameter: selectedParam,
        range: timeRange,
        limit: 500,
      })
      .then((res) => {
        if (!cancelled) {
          setHistoricalSeries(res.series || []);
        }
      })
      .catch(() => {
        if (!cancelled) setHistoricalSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSeries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStation?.id, selectedParam, timeRange, summary?.kpis?.lastDataUpdate]);

  const validReadings = useMemo(
    () => historicalSeries.filter((r) => !r.is_gap && r.value !== null),
    [historicalSeries]
  );

  const windowAverage = useMemo(() => {
    if (validReadings.length === 0) return null;
    const sum = validReadings.reduce((acc, r) => acc + r.value, 0);
    return sum / validReadings.length;
  }, [validReadings]);

  const handleStationChange = (id: string) => {
    setSelectedStationId(id);
    setSearchParams({ stationId: id, parameter: selectedParam });
  };

  const handleParamChange = (param: ParameterCode) => {
    setSelectedParam(param);
    setSearchParams({ stationId: selectedStationId, parameter: param });
  };

  const handleSubmitLabSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStation) return;
    const num = Number(labValue);
    if (Number.isNaN(num)) return;

    setSubmittingLab(true);
    try {
      const res = await api.ingestReading({
        station_id: selectedStation.id,
        parameter: selectedParam,
        value: num,
        data_source: 'LAB_MANUAL',
        is_simulated: false,
      });
      setLabModalOpen(false);
      setLabValue('');
      await refreshGlobalData();

      if (res.alert && res.isNewAlert) {
        addToast({
          type: res.alert.severity === 'critical' ? 'critical' : 'warning',
          title: 'Threshold Violation on Lab Sample',
          message: res.alert.title,
          alertId: res.alert.id,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Manual Measurement Recorded',
          message: `Logged ${num} ${PARAMETER_METADATA[selectedParam].unit} for ${PARAMETER_METADATA[selectedParam].name}.`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Invalid Measurement',
        message: err?.message || 'Failed to record measurement.',
      });
    } finally {
      setSubmittingLab(false);
    }
  };

  const paramMeta = PARAMETER_METADATA[selectedParam];
  const enabledCapSet = new Set(
    (selectedStation?.capabilities || []).filter((c) => c.is_enabled).map((c) => c.parameter)
  );

  return (
    <div className="space-y-6">
      {/* Control Header Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label
              htmlFor="live-station-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Monitoring Station
            </label>
            <select
              id="live-station-select"
              value={selectedStation?.id || ''}
              onChange={(e) => handleStationChange(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white min-w-[250px]"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.name} ({s.overall_status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="live-comparison-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Trend Comparison Basis
            </label>
            <select
              id="live-comparison-select"
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as 'prev' | 'window_avg')}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
            >
              <option value="prev">Delta vs Previous Sample</option>
              <option value="window_avg">Delta vs Selected Period Mean</option>
            </select>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Time Window
            </span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
              {(
                [
                  { id: '1h', label: '1h' },
                  { id: '24h', label: '24h' },
                  { id: '7d', label: '7d' },
                  { id: '30d', label: '30d' },
                ] as Array<{ id: TimeRangeOption; label: string }>
              ).map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => setTimeRange(tr.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    timeRange === tr.id
                      ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Simulation Engine Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <DemoProvenanceBadge />

          <button
            type="button"
            onClick={toggleSimulation}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              isSimulationRunning
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
            }`}
          >
            {isSimulationRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Demo Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Demo Stream</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              triggerSimulationStep({
                stationId: selectedStation?.id,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Readings</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerSimulationStep({
                forceAnomaly: true,
                stationId: selectedStation?.id,
                parameter: selectedParam,
              })
            }
            title="Simulate a controlled threshold excursion for the selected station and parameter"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulate Anomaly</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLabValue(String(paramMeta.defaultBaseline));
              setLabModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
            <span>Log Lab Sample</span>
          </button>
        </div>
      </section>

      {/* Station Telemetry Header Banner */}
      {selectedStation && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                {selectedStation.id} ({selectedStation.code})
              </span>
              <ConnectivityBadge status={selectedStation.connectivity_status} />
              <StatusBadge status={selectedStation.overall_status} />
              <span className="text-xs text-slate-500">
                • {selectedStation.station_type}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {selectedStation.name} — {selectedStation.water_body}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedStation.location_name} • Firmware: <span className="font-mono">{selectedStation.firmware_version}</span>
            </p>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                Supported Sensors
              </span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {enabledCapSet.size} <span className="text-xs font-normal text-slate-500">/ 10 parameters</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                Station WQI Score
              </span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {selectedStation.wqi_score}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* All 10 Water-Quality Parameters Grid (Supported vs Not Equipped clearly distinguished) */}
      <section aria-label="Station Sensor Parameter Cards">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            <span>
              Parameter Telemetry Matrix (Click any supported parameter to inspect live time-series)
            </span>
          </h3>
          <span className="text-xs text-slate-500">
            Showing sensor source classification & configured limits
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {ALL_PARAMETERS_LIST.map((meta) => {
            const cap = selectedStation?.capabilities.find(
              (c) => c.parameter === meta.code && c.is_enabled
            );
            const reading = selectedStation?.latestReadings[meta.code];
            const isSelected = selectedParam === meta.code;

            if (!cap) {
              // Parameter not supported on this station
              return (
                <div
                  key={meta.code}
                  className="rounded-card border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 flex flex-col justify-between opacity-70"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {meta.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Not Equipped
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Station {selectedStation?.code} does not carry a sensor or scheduled assay for {meta.shortName} ({meta.unit}).
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] font-mono text-slate-400">
                    Unit: {meta.unit}
                  </div>
                </div>
              );
            }

            const prevVal = reading?.previous_value;
            const delta =
              comparisonMode === 'prev'
                ? reading?.trend_delta ?? 0
                : isSelected && windowAverage !== null && reading
                  ? Number((reading.value - windowAverage).toFixed(meta.precision))
                  : reading?.trend_delta ?? 0;

            return (
              <button
                key={meta.code}
                type="button"
                onClick={() => handleParamChange(meta.code)}
                className={`text-left rounded-card border p-4 transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-2 border-sky-600 dark:border-sky-400 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300 shadow-xs'
                }`}
              >
                <div className="space-y-2.5 w-full">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {meta.name}
                      </span>
                      <div className="mt-1">
                        <SensorSourceBadge sourceType={cap.data_source_type} />
                      </div>
                    </div>
                    <StatusBadge
                      status={
                        selectedStation?.connectivity_status === 'offline'
                          ? 'offline'
                          : reading?.quality_status || 'normal'
                      }
                    />
                  </div>

                  {/* Current Value & Unit */}
                  <div className="pt-1 flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                        {reading ? formatParameterValue(meta.code, reading.value) : '—'}
                      </span>
                      <span className="ml-1 text-xs font-mono text-slate-500">
                        {meta.unit}
                      </span>
                    </div>

                    {/* Trend Indicator */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${
                          delta === 0
                            ? 'text-slate-400'
                            : delta > 0
                              ? 'text-sky-600 dark:text-sky-400'
                              : 'text-teal-600 dark:text-teal-400'
                        }`}
                      >
                        {delta > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : delta < 0 ? (
                          <TrendingDown className="w-3.5 h-3.5" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                        <span>{delta > 0 ? `+${delta}` : delta}</span>
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Prev: {prevVal !== null && prevVal !== undefined ? `${prevVal}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Threshold Limits & Timestamp Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 w-full space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Warn Limit:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {reading?.warning_limit || 'Configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Crit Limit:</span>
                    <span className="font-mono text-red-600 dark:text-red-400">
                      {reading?.critical_limit || 'Configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 pt-0.5 font-mono text-[10px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {reading ? formatShortTime(reading.recorded_at) : 'No sample'}
                    </span>
                    <span>{reading?.is_simulated ? 'DEMO DATA' : 'VERIFIED'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Time-Series Chart + Historical Readings Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Time-series chart (7 cols) */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {paramMeta.name} ({paramMeta.unit}) — Live Telemetry Curve
                  </h3>
                  <InfoTooltip text={paramMeta.description} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {paramMeta.environmentalSignificance}
                </p>
              </div>
              <DemoProvenanceBadge compact />
            </div>

            <div className="h-80 w-full mt-4">
              {loadingSeries && historicalSeries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Loading parameter telemetry...
                </div>
              ) : historicalSeries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No measurements available for {paramMeta.name} in the {timeRange} window
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    If this station is offline or uses periodic laboratory grab samples (such as BOD₅), switch the time window to <strong>24h</strong> or <strong>7d</strong> to view prior measurements.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={historicalSeries.map((r) => ({
                      ...r,
                      timeLabel: formatShortTime(r.recorded_at, timeRange),
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      minTickGap={25}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      domain={['auto', 'auto']}
                      width={65}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row = payload[0].payload as SensorReading;
                        if (row.is_gap || row.value === null) {
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs">
                              Telemetry Gap — No reading recorded
                            </div>
                          );
                        }
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1">
                            <div className="font-mono text-[11px] text-slate-300">
                              {formatLocalDateTime(row.recorded_at)}
                            </div>
                            <div className="font-bold text-sm text-sky-300">
                              {paramMeta.name}: {row.value} {row.unit}
                            </div>
                            <div>Quality Status: {row.quality_status.toUpperCase()}</div>
                            <div className="font-mono text-[10px] text-indigo-300">
                              Source: {row.data_source} ({row.is_simulated ? 'DEMO DATA' : 'VERIFIED'})
                            </div>
                          </div>
                        );
                      }}
                    />
                    {paramMeta.defaultThresholds.max_warning !== null && (
                      <ReferenceLine
                        y={paramMeta.defaultThresholds.max_warning}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                      />
                    )}
                    {paramMeta.defaultThresholds.max_critical !== null && (
                      <ReferenceLine
                        y={paramMeta.defaultThresholds.max_critical}
                        stroke="#dc2626"
                        strokeDasharray="4 4"
                      />
                    )}
                    {paramMeta.defaultThresholds.min_warning !== null && (
                      <ReferenceLine
                        y={paramMeta.defaultThresholds.min_warning}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0284c7"
                      strokeWidth={2.4}
                      dot={{ r: 2.5, fill: '#0284c7' }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Period Mean:{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {windowAverage !== null
                  ? `${formatParameterValue(selectedParam, windowAverage)} ${paramMeta.unit}`
                  : '—'}
              </strong>
            </span>
            <span>
              Samples in window: <strong>{validReadings.length}</strong>
            </span>
          </div>
        </section>

        {/* Historical Values Table (5 cols) */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Historical Measurement Log
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Most recent stored readings for {paramMeta.shortName} on {selectedStation?.code}
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {validReadings.length} records
              </span>
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="py-2 px-2.5">Timestamp</th>
                    <th className="py-2 px-2.5">Value</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {validReadings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        No historical readings in selected range.
                      </td>
                    </tr>
                  ) : (
                    [...validReadings]
                      .reverse()
                      .slice(0, 40)
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {formatLocalDateTime(r.recorded_at)}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-900 dark:text-white">
                            {formatParameterValue(selectedParam, r.value)} {r.unit}
                          </td>
                          <td className="py-2 px-2.5">
                            <StatusBadge status={r.quality_status} />
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[10px] text-slate-500">
                            {r.is_simulated ? 'DEMO SIM' : r.data_source}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            Retention Policy: Automatic FIFO cleanup retains up to{' '}
            <strong>{summary?.simulation?.retentionMaxRowsPerStation || 2500}</strong> rows per station.
          </div>
        </section>
      </div>

      {/* Manual Lab / Grab Sample Modal */}
      {labModalOpen && selectedStation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Log Laboratory / Manual Grab Sample
            </h3>
            <p className="text-xs text-slate-500">
              Submit a verified manual measurement for <strong>{paramMeta.name}</strong> at{' '}
              <strong>{selectedStation.name}</strong>. Threshold evaluation will run immediately.
            </p>
            <form onSubmit={handleSubmitLabSample} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Measured Value ({paramMeta.unit}) [Allowed: {paramMeta.minAllowedValue} – {paramMeta.maxAllowedValue}]
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={labValue}
                  onChange={(e) => setLabValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLabModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLab}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {submittingLab ? 'Recording...' : 'Record Sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
