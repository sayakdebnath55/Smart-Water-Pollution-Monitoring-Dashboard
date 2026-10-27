import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Wifi,
  AlertTriangle,
  OctagonAlert,
  Gauge,
  Clock,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  CORE_OVERVIEW_PARAMETERS,
  formatLocalDateTime,
  formatParameterValue,
  formatRelativeTime,
  formatShortTime,
  getWqiClassification,
  PARAMETER_METADATA,
} from '../utils/formatters';
import {
  ConnectivityBadge,
  DemoProvenanceBadge,
  InfoTooltip,
  StatusBadge,
} from '../components/StatusBadge';

export const OverviewPage: React.FC = () => {
  const {
    summary,
    loadingSummary,
    errorSummary,
    openAlertModal,
    triggerSimulationStep,
  } = useAppContext();
  const navigate = useNavigate();

  // Trend chart controls
  const [selectedParam, setSelectedParam] = useState<ParameterCode>('ph');
  const [selectedStationId, setSelectedStationId] = useState<string>('STN-IND-03');
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('24h');
  const [trendSeries, setTrendSeries] = useState<SensorReading[]>([]);
  const [loadingTrend, setLoadingTrend] = useState<boolean>(false);

  // Station Overview table controls
  const [stationSearch, setStationSearch] = useState('');
  const [stationStatusFilter, setStationStatusFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<'id' | 'name' | 'wqi_score' | 'overall_status'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Fetch time-series data for the selected parameter, station, and time range
  useEffect(() => {
    let cancelled = false;
    setLoadingTrend(true);
    api
      .getReadings({
        stationId: selectedStationId,
        parameter: selectedParam,
        range: timeRange,
        limit: 400,
      })
      .then((res) => {
        if (!cancelled) {
          setTrendSeries(res.series || []);
        }
      })
      .catch(() => {
        if (!cancelled) setTrendSeries([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTrend(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedParam, selectedStationId, timeRange, summary?.kpis?.lastDataUpdate]);

  const stations = summary?.stations || [];
  const kpis = summary?.kpis;
  const dist = summary?.statusDistribution || { normal: 0, warning: 0, critical: 0, offline: 0 };
  const totalDist = Math.max(1, dist.normal + dist.warning + dist.critical + dist.offline);

  const paramMeta = PARAMETER_METADATA[selectedParam];

  // Filter and sort stations for the overview table
  const filteredStations = useMemo(() => {
    const list = stations.filter((s) => {
      if (stationStatusFilter !== 'all') {
        if (stationStatusFilter === 'attention') {
          if (s.overall_status === 'normal') return false;
        } else if (s.overall_status !== stationStatusFilter) {
          return false;
        }
      }
      if (stationSearch.trim() !== '') {
        const q = stationSearch.toLowerCase();
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.water_body.toLowerCase().includes(q) ||
          s.location_name.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'wqi_score') {
        cmp = a.wqi_score - b.wqi_score;
      } else if (sortColumn === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortColumn === 'overall_status') {
        const order: Record<string, number> = { critical: 1, warning: 2, offline: 3, normal: 4 };
        cmp = (order[a.overall_status] || 5) - (order[b.overall_status] || 5);
      } else {
        cmp = a.id.localeCompare(b.id);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [stations, stationSearch, stationStatusFilter, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredStations.length / pageSize));
  const paginatedStations = filteredStations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (col: 'id' | 'name' | 'wqi_score' | 'overall_status') => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  if (loadingSummary && !summary) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Initializing AquaGuard Watershed Telemetry & Demonstration Data...
        </p>
      </div>
    );
  }

  if (errorSummary && !summary) {
    return (
      <div className="p-6 rounded-card bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
        <h2 className="text-base font-bold">Telemetry Connection Error</h2>
        <p className="text-sm mt-1">{errorSummary}</p>
      </div>
    );
  }

  const wqiClass = getWqiClassification(kpis?.averageWqi || 0);

  return (
    <div className="space-y-6">
      {/* Top Disclosure Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <DemoProvenanceBadge />
          <span>
            Clearwater River Basin Demonstration Network — Live synthetic sensor telemetry updating every 5 seconds.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => triggerSimulationStep()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Poll Sensors Now</span>
          </button>
        </div>
      </div>

      {/* A. Summary KPI Cards (6 cards) */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Total Monitoring Stations */}
        <button
          type="button"
          onClick={() => navigate('/stations')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-card p-4 shadow-xs transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Stations
            </span>
            <div className="p-2 rounded-lg bg-navy-50 dark:bg-slate-800 text-navy-700 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {kpis?.totalStations ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Watershed Network</span>
              <span className="text-sky-600 dark:text-sky-400 font-medium">View all →</span>
            </div>
          </div>
        </button>

        {/* 2. Active Stations */}
        <button
          type="button"
          onClick={() => navigate('/stations?connectivity=online')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-card p-4 shadow-xs transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Active Stations
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
              {kpis?.activeStations ?? 0}
              <span className="text-sm font-normal text-slate-400">
                /{kpis?.totalStations ?? 0}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>{kpis?.offlineStations ?? 0} offline</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {kpis && kpis.totalStations > 0
                  ? `${Math.round((kpis.activeStations / kpis.totalStations) * 100)}% online`
                  : '0%'}
              </span>
            </div>
          </div>
        </button>

        {/* 3. Stations Requiring Attention */}
        <button
          type="button"
          onClick={() => navigate('/stations?status=attention')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 rounded-card p-4 shadow-xs transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Requiring Attention
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
              {kpis?.stationsRequiringAttention ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {dist.warning} warn • {dist.critical} crit • {dist.offline} off
              </span>
            </div>
          </div>
        </button>

        {/* 4. Critical Active Alerts */}
        <button
          type="button"
          onClick={() => navigate('/alerts?severity=critical&status=active')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-600 rounded-card p-4 shadow-xs transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Critical Active Alerts
            </span>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400">
              <OctagonAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
              {kpis?.criticalActiveAlerts ?? 0}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>+{kpis?.warningActiveAlerts ?? 0} warnings</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">
                {kpis?.alerts24hDelta !== undefined && kpis.alerts24hDelta >= 0
                  ? `+${kpis.alerts24hDelta} vs prior 24h`
                  : `${kpis?.alerts24hDelta ?? 0} vs prior 24h`}
              </span>
            </div>
          </div>
        </button>

        {/* 5. Average Water Quality Index */}
        <button
          type="button"
          onClick={() => navigate('/analytics')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 rounded-card p-4 shadow-xs transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Average WQI</span>
              <InfoTooltip text="Composite Water Quality Index (0–100) computed from latest parameter sub-indices across online stations." />
            </span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {kpis?.averageWqi ?? 0}
              </span>
              <span className="text-xs font-semibold text-slate-500">{wqiClass.label}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">24h Compliance Δ</span>
              <span
                className={`inline-flex items-center gap-0.5 font-mono font-semibold ${
                  (kpis?.wqiTrendDelta ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {(kpis?.wqiTrendDelta ?? 0) >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>
                  {(kpis?.wqiTrendDelta ?? 0) >= 0
                    ? `+${kpis?.wqiTrendDelta}%`
                    : `${kpis?.wqiTrendDelta}%`}
                </span>
              </span>
            </div>
          </div>
        </button>

        {/* 6. Last Data Update */}
        <button
          type="button"
          onClick={() => navigate('/live')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 rounded-card p-4 shadow-xs transition-all flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Last Data Update
            </span>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold font-mono text-slate-900 dark:text-white truncate">
              {formatRelativeTime(kpis?.lastDataUpdate)}
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-500 truncate">
              {formatLocalDateTime(kpis?.lastDataUpdate)}
            </div>
          </div>
        </button>
      </section>

      {/* B. Water-Quality Trends & C. Station Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* B. Water-quality trends chart (8 columns) */}
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Water-Quality Parameter Trends
                  </h2>
                  <InfoTooltip text={paramMeta.environmentalSignificance} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {paramMeta.name} ({paramMeta.unit}) — Gap-aware time series from stored records
                </p>
              </div>

              {/* Station Selector & Time Range Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Select monitoring station for trend chart"
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.code} — {st.name}
                    </option>
                  ))}
                </select>

                <div
                  className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5"
                  role="group"
                  aria-label="Chart time range filter"
                >
                  {(
                    [
                      { id: '1h', label: 'Last Hour' },
                      { id: '24h', label: '24 Hours' },
                      { id: '7d', label: '7 Days' },
                      { id: '30d', label: '30 Days' },
                    ] as Array<{ id: TimeRangeOption; label: string }>
                  ).map((tr) => (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => setTimeRange(tr.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                        timeRange === tr.id
                          ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Parameter Pill Selector (pH, Turbidity, DO, TDS, Water Temperature) */}
            <div className="flex flex-wrap items-center gap-2 py-3">
              {CORE_OVERVIEW_PARAMETERS.map((code) => {
                const m = PARAMETER_METADATA[code];
                const active = selectedParam === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedParam(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-navy-900 text-white border-navy-900 dark:bg-sky-600 dark:border-sky-500'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {m.shortName}{' '}
                    <span className="opacity-75 font-mono text-[11px]">({m.unit})</span>
                  </button>
                );
              })}
            </div>

            {/* Chart Area */}
            <div className="h-72 w-full mt-2">
              {loadingTrend && trendSeries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Loading historical sensor records...
                </div>
              ) : trendSeries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No measurements recorded in this time window
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    The selected station may be offline during this window (e.g., Last Hour on an offline intake station). Switch to Last 24 Hours or Last 7 Days to inspect historical telemetry.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trendSeries.map((r) => ({
                      ...r,
                      timeLabel: formatShortTime(r.recorded_at, timeRange),
                    }))}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="overviewParamGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      domain={['auto', 'auto']}
                      unit={` ${paramMeta.unit}`}
                      width={80}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const row = payload[0].payload as SensorReading;
                        if (row.is_gap || row.value === null) {
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-slate-700">
                              Telemetry Gap — Missing Measurements
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
                            <div className="flex items-center gap-2 pt-0.5">
                              <span>Status: {row.quality_status.toUpperCase()}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-indigo-300">
                                {row.is_simulated ? 'DEMO DATA' : 'SENSOR'}
                              </span>
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
                        label={{
                          value: `Warn High (${paramMeta.defaultThresholds.max_warning})`,
                          position: 'insideTopRight',
                          fill: '#d97706',
                          fontSize: 10,
                        }}
                      />
                    )}
                    {paramMeta.defaultThresholds.max_critical !== null && (
                      <ReferenceLine
                        y={paramMeta.defaultThresholds.max_critical}
                        stroke="#dc2626"
                        strokeDasharray="4 4"
                        label={{
                          value: `Crit High (${paramMeta.defaultThresholds.max_critical})`,
                          position: 'insideTopRight',
                          fill: '#dc2626',
                          fontSize: 10,
                        }}
                      />
                    )}
                    {paramMeta.defaultThresholds.min_warning !== null && (
                      <ReferenceLine
                        y={paramMeta.defaultThresholds.min_warning}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                        label={{
                          value: `Warn Low (${paramMeta.defaultThresholds.min_warning})`,
                          position: 'insideBottomRight',
                          fill: '#d97706',
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0284c7"
                      strokeWidth={2.2}
                      fillOpacity={1}
                      fill="url(#overviewParamGrad)"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing <strong>{trendSeries.filter((r) => !r.is_gap).length}</strong> stored records for{' '}
              <strong>{selectedStationId}</strong>
            </span>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/live?stationId=${encodeURIComponent(selectedStationId)}&parameter=${selectedParam}`
                )
              }
              className="text-sky-600 dark:text-sky-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Open in Live Monitoring Console</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </section>

        {/* C. Station Status Distribution (4 columns) */}
        <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Station Status Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Proportion of monitoring stations by operational health state
              </p>
            </div>

            {/* Stacked Progress Bar */}
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                {dist.normal > 0 && (
                  <div
                    style={{ width: `${(dist.normal / totalDist) * 100}%` }}
                    className="bg-emerald-600 h-full"
                    title={`Normal: ${dist.normal}`}
                  />
                )}
                {dist.warning > 0 && (
                  <div
                    style={{ width: `${(dist.warning / totalDist) * 100}%` }}
                    className="bg-amber-500 h-full"
                    title={`Warning: ${dist.warning}`}
                  />
                )}
                {dist.critical > 0 && (
                  <div
                    style={{ width: `${(dist.critical / totalDist) * 100}%` }}
                    className="bg-red-600 h-full"
                    title={`Critical: ${dist.critical}`}
                  />
                )}
                {dist.offline > 0 && (
                  <div
                    style={{ width: `${(dist.offline / totalDist) * 100}%` }}
                    className="bg-slate-400 h-full"
                    title={`Offline: ${dist.offline}`}
                  />
                )}
              </div>
            </div>

            {/* Distribution Breakdown Rows */}
            <div className="space-y-2.5 pt-2">
              {[
                {
                  key: 'normal',
                  label: 'Normal / Healthy',
                  desc: 'All monitored parameters within operational thresholds',
                  count: dist.normal,
                  pct: Math.round((dist.normal / totalDist) * 100),
                },
                {
                  key: 'warning',
                  label: 'Warning Condition',
                  desc: 'One or more parameters crossed warning boundary',
                  count: dist.warning,
                  pct: Math.round((dist.warning / totalDist) * 100),
                },
                {
                  key: 'critical',
                  label: 'Critical Excursion',
                  desc: 'Immediate pollution threshold violation active',
                  count: dist.critical,
                  pct: Math.round((dist.critical / totalDist) * 100),
                },
                {
                  key: 'offline',
                  label: 'Offline / Telemetry Lost',
                  desc: 'Station missed scheduled telemetry heartbeats',
                  count: dist.offline,
                  pct: Math.round((dist.offline / totalDist) * 100),
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(`/stations?status=${item.key}`)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-700 bg-slate-50/60 dark:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.key} />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {item.desc}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                      {item.count}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{item.pct}%</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Geospatial Station Distribution</span>
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Open Interactive Map →
            </button>
          </div>
        </section>
      </div>

      {/* D. Recent Pollution Alerts */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Pollution Alerts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any alert row to open its full diagnostic inspection and resolution workflow
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
          >
            Manage All Alerts →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50">
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Station Name</th>
                <th className="py-2.5 px-3">Measured Value</th>
                <th className="py-2.5 px-3">Configured Limit</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Alert Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(summary?.recentAlerts || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No pollution alerts recorded.
                  </td>
                </tr>
              ) : (
                (summary?.recentAlerts || []).map((alert) => {
                  const pMeta =
                    alert.parameter !== 'connectivity'
                      ? PARAMETER_METADATA[alert.parameter]
                      : null;
                  return (
                    <tr
                      key={alert.id}
                      onClick={() => openAlertModal(alert.id)}
                      className="hover:bg-sky-50/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={alert.severity} />
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {pMeta ? pMeta.name : 'Telemetry Connectivity'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {alert.station_name || alert.station_id}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {alert.station_id}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {alert.measured_value !== null
                          ? `${alert.measured_value} ${alert.unit}`
                          : 'OFFLINE'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {alert.triggered_threshold}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatLocalDateTime(alert.created_at)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
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
                              : 'Unacknowledged'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* E. Monitoring Stations Overview Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Monitoring Stations Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Latest sonde readings, connectivity heartbeats, and composite condition across stations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stationSearch}
                onChange={(e) => {
                  setStationSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search station name or ID..."
                aria-label="Search stations in overview table"
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <select
              aria-label="Filter stations by status"
              value={stationStatusFilter}
              onChange={(e) => {
                setStationStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
            >
              <option value="all">All Conditions ({stations.length})</option>
              <option value="normal">Normal</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="offline">Offline</option>
              <option value="attention">Requiring Attention</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50">
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Station ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Station & Water Body</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">Connectivity</th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSort('overall_status')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Condition</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleSort('wqi_score')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>WQI</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3">pH</th>
                <th className="py-2.5 px-3">Turbidity</th>
                <th className="py-2.5 px-3">Dissolved O₂</th>
                <th className="py-2.5 px-3">Temp</th>
                <th className="py-2.5 px-3">Last Seen</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedStations.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">
                    No monitoring stations match the current search or filter.
                  </td>
                </tr>
              ) : (
                paginatedStations.map((st) => {
                  const phVal = st.latestReadings['ph']?.value;
                  const turbVal = st.latestReadings['turbidity']?.value;
                  const doVal = st.latestReadings['dissolved_oxygen']?.value;
                  const tempVal = st.latestReadings['temperature']?.value;

                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                        {st.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {st.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{st.water_body}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <ConnectivityBadge status={st.connectivity_status} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={st.overall_status} />
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {st.wqi_score}
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {formatParameterValue('ph', phVal)}
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {turbVal !== undefined ? `${formatParameterValue('turbidity', turbVal)} NTU` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {doVal !== undefined ? `${formatParameterValue('dissolved_oxygen', doVal)} mg/L` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {tempVal !== undefined ? `${formatParameterValue('temperature', tempVal)} °C` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(st.last_seen_at)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/stations?stationId=${encodeURIComponent(st.id)}`)
                          }
                          className="px-2.5 py-1 rounded-md text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500">
          <div>
            Showing{' '}
            <strong>
              {filteredStations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong>{Math.min(currentPage * pageSize, filteredStations.length)}</strong> of{' '}
            <strong>{filteredStations.length}</strong> stations
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
