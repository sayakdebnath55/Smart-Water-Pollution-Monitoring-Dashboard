import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Activity,
  ShieldAlert,
  Wifi,
} from 'lucide-react';
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
  formatShortTime,
  PARAMETER_METADATA,
} from '../utils/formatters';
import {
  ConnectivityBadge,
  DemoProvenanceBadge,
  InfoTooltip,
  StatusBadge,
} from '../components/StatusBadge';

export const AnalyticsPage: React.FC = () => {
  const { summary } = useAppContext();
  const stations = summary?.stations || [];

  const [stationId, setStationId] = useState<string>('all');
  const [parameter, setParameter] = useState<ParameterCode>('ph');
  const [range, setRange] = useState<TimeRangeOption>('7d');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summaryGranularity, setSummaryGranularity] = useState<'daily' | 'weekly' | 'monthly'>(
    'daily'
  );

  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [timeSeries, setTimeSeries] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.getAnalyticsSummary({
        stationId,
        parameter,
        range,
        status: statusFilter,
      }),
      api.getReadings({
        stationId: stationId === 'all' ? stations[0]?.id || 'STN-RIV-01' : stationId,
        parameter,
        range,
        qualityStatus: statusFilter,
        limit: 500,
      }),
    ])
      .then(([summaryRes, readingsRes]) => {
        if (cancelled) return;
        setAnalyticsData(summaryRes);
        setTimeSeries(readingsRes.series || []);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [stationId, parameter, range, statusFilter, summary?.kpis?.lastDataUpdate]);

  const paramMeta = PARAMETER_METADATA[parameter];
  const selectedParamStats = (analyticsData?.parameterStatistics || []).find(
    (p: any) => p.parameter === parameter
  );

  const activePeriodSummaries =
    summaryGranularity === 'daily'
      ? analyticsData?.dailySummaries || []
      : summaryGranularity === 'weekly'
        ? analyticsData?.weeklySummaries || []
        : analyticsData?.monthlySummaries || [];

  return (
    <div className="space-y-6">
      {/* Analytics Filter Toolbar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label
              htmlFor="analytics-station-filter"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
            >
              Monitoring Station
            </label>
            <select
              id="analytics-station-filter"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Watershed Stations (Aggregate)</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="analytics-param-filter"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
            >
              Water-Quality Parameter
            </label>
            <select
              id="analytics-param-filter"
              value={parameter}
              onChange={(e) => setParameter(e.target.value as ParameterCode)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
            >
              {ALL_PARAMETERS_LIST.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="analytics-status-filter"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
            >
              Quality Status Filter
            </label>
            <select
              id="analytics-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
            >
              <option value="all">All Quality States</option>
              <option value="normal">Normal Readings Only</option>
              <option value="warning">Warning Excursions Only</option>
              <option value="critical">Critical Excursions Only</option>
            </select>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Date Range Window
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
                  onClick={() => setRange(tr.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    range === tr.id
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

        <DemoProvenanceBadge />
      </section>

      {/* Selected Parameter Key Statistics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">
            {paramMeta.shortName} Mean Value
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {selectedParamStats?.avg !== null && selectedParamStats?.avg !== undefined
              ? `${selectedParamStats.avg} ${paramMeta.unit}`
              : '—'}
          </div>
          <span className="text-[11px] text-slate-400">
            Across {selectedParamStats?.count ?? 0} stored samples
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">
            Minimum Recorded
          </span>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-400 mt-1">
            {selectedParamStats?.min !== null && selectedParamStats?.min !== undefined
              ? `${selectedParamStats.min} ${paramMeta.unit}`
              : '—'}
          </div>
          <span className="text-[11px] text-slate-400">Lower bound in period</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">
            Maximum Recorded
          </span>
          <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 mt-1">
            {selectedParamStats?.max !== null && selectedParamStats?.max !== undefined
              ? `${selectedParamStats.max} ${paramMeta.unit}`
              : '—'}
          </div>
          <span className="text-[11px] text-slate-400">Peak value in period</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">
            Anomaly Excursion Count
          </span>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {selectedParamStats?.anomalyCount ?? 0}
          </div>
          <span className="text-[11px] text-slate-400">
            {selectedParamStats?.warningCount ?? 0} warning • {selectedParamStats?.criticalCount ?? 0} critical
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">
            Anomaly Rate (%)
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {selectedParamStats?.anomalyRatePct ?? 0}%
          </div>
          <span className="text-[11px] text-slate-400">Proportion of out-of-range samples</span>
        </div>
      </section>

      {/* Row 1: Parameter Time-Series Trend + Station-to-Station Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Time-series chart (7 cols) */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {paramMeta.name} ({paramMeta.unit}) — Historical Distribution
                </h2>
                <InfoTooltip text={paramMeta.environmentalSignificance} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {stationId === 'all'
                  ? `Showing reference station (${stations[0]?.name || 'STN-RIV-01'}) time-series`
                  : `Showing stored records for ${stationId}`}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Unit: {paramMeta.unit}</span>
          </div>

          <div className="h-72 w-full">
            {loading && timeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Loading historical series...
              </div>
            ) : timeSeries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Insufficient Data for Selected Station / Window
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  This station either does not support {paramMeta.name} or was offline during the selected time window. No synthetic historical values are invented.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeSeries.map((r) => ({
                    ...r,
                    timeLabel: formatShortTime(r.recorded_at, range),
                  }))}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={25} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={['auto', 'auto']} width={65} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0].payload as SensorReading;
                      if (row.is_gap || row.value === null) {
                        return (
                          <div className="bg-slate-900 text-white p-2 rounded text-xs">
                            Telemetry Gap
                          </div>
                        );
                      }
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1">
                          <div className="font-mono text-[11px] text-slate-300">
                            {formatLocalDateTime(row.recorded_at)}
                          </div>
                          <div className="font-bold text-teal-300">
                            {paramMeta.name}: {row.value} {row.unit}
                          </div>
                          <div>Quality: {row.quality_status.toUpperCase()}</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0d9488"
                    strokeWidth={2.2}
                    fill="url(#analyticsGrad)"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Station-to-Station Comparison for Selected Parameter (5 cols) */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-3">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-600" />
              <span>Station-to-Station Comparison ({paramMeta.shortName})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparing Min / Mean / Max in identical units ({paramMeta.unit}) across equipped stations
            </p>
          </div>

          <div className="h-72 w-full">
            {(analyticsData?.stationComparisons || []).length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No stations equipped with {paramMeta.name}.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData?.stationComparisons || []}
                  margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                  <XAxis dataKey="station_code" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={55} />
                  <Tooltip
                    formatter={(val: any) => [`${val ?? 'No Data'} ${paramMeta.unit}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="min_val" name={`Min (${paramMeta.unit})`} fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avg_val" name={`Mean (${paramMeta.unit})`} fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="max_val" name={`Max (${paramMeta.unit})`} fill="#0f2540" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Row 2: Daily / Weekly / Monthly Aggregated Summaries + Alert Frequency by Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily / Weekly / Monthly Summary Chart & Table (7 cols) */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>Aggregated Temporal Summaries ({paramMeta.name})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Roll-up statistics grouped by day, ISO week, or calendar month
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
              {(
                [
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSummaryGranularity(g.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    summaryGranularity === g.id
                      ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2 px-3">Period Bucket</th>
                  <th className="py-2 px-3">Samples</th>
                  <th className="py-2 px-3">Mean ({paramMeta.unit})</th>
                  <th className="py-2 px-3">Min ({paramMeta.unit})</th>
                  <th className="py-2 px-3">Max ({paramMeta.unit})</th>
                  <th className="py-2 px-3">Anomalies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activePeriodSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No aggregated records in this window.
                    </td>
                  </tr>
                ) : (
                  [...activePeriodSummaries].reverse().map((row: any) => (
                    <tr key={row.bucket} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {row.bucket}
                      </td>
                      <td className="py-2 px-3 font-mono">{row.sample_count}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-sky-700 dark:text-sky-400">
                        {row.avg_val}
                      </td>
                      <td className="py-2 px-3 font-mono">{row.min_val}</td>
                      <td className="py-2 px-3 font-mono">{row.max_val}</td>
                      <td className="py-2 px-3 font-mono">
                        {row.anomalies > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {row.anomalies}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Alert Frequency by Severity & Station (5 cols) */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-3">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Alert Frequency by Severity & Station</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution of warning and critical alerts generated across stations
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analyticsData?.alertsBySeverityAndStation || []}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <YAxis
                  dataKey="station_id"
                  type="category"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={80}
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="warning_alerts" name="Warning Alerts" stackId="a" fill="#d97706" />
                <Bar dataKey="critical_alerts" name="Critical Alerts" stackId="a" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 3: All 10 Parameters Statistical Matrix */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            All-Parameter Statistical Summary Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Computed from stored database measurements within the selected time window (units explicitly labeled; incompatible units are never averaged together)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Sample Count</th>
                <th className="py-2.5 px-3">Average</th>
                <th className="py-2.5 px-3">Minimum</th>
                <th className="py-2.5 px-3">Maximum</th>
                <th className="py-2.5 px-3">Warning Excursions</th>
                <th className="py-2.5 px-3">Critical Excursions</th>
                <th className="py-2.5 px-3">Anomaly Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(analyticsData?.parameterStatistics || []).map((stat: any) => (
                <tr
                  key={stat.parameter}
                  onClick={() => setParameter(stat.parameter)}
                  className={`cursor-pointer transition-colors ${
                    stat.parameter === parameter
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                    {stat.name}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-500">{stat.unit}</td>
                  <td className="py-3 px-3 font-mono">{stat.count}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-sky-700 dark:text-sky-400">
                    {stat.avg !== null ? `${stat.avg} ${stat.unit}` : 'No Data'}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {stat.min !== null ? `${stat.min} ${stat.unit}` : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {stat.max !== null ? `${stat.max} ${stat.unit}` : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {stat.warningCount}
                  </td>
                  <td className="py-3 px-3 font-mono text-red-600 dark:text-red-400 font-semibold">
                    {stat.criticalCount}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <StatusBadge
                      status={
                        stat.criticalCount > 0
                          ? 'critical'
                          : stat.warningCount > 0
                            ? 'warning'
                            : stat.count === 0
                              ? 'offline'
                              : 'normal'
                      }
                      customLabel={`${stat.anomalyRatePct}%`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 4: Missing-Data & Sensor Availability Summary */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-teal-600" />
              <span>Missing-Data & Sensor Availability Audit</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Telemetry uptime, sensor source breakdown (IoT probes vs Field Analyzers vs Lab Grab Samples), and dropout diagnostics
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3">Connectivity</th>
                <th className="py-2.5 px-3">Sensor Breakdown</th>
                <th className="py-2.5 px-3">Samples in Window</th>
                <th className="py-2.5 px-3">Est. Availability</th>
                <th className="py-2.5 px-3">Missing-Data & Sampling Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(analyticsData?.availabilitySummaries || []).map((av: any) => (
                <tr key={av.station_id}>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {av.station_name}
                    </div>
                    <div className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                      {av.station_id}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <ConnectivityBadge status={av.connectivity_status} />
                  </td>
                  <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                    {av.iot_probe_count} IoT Probes • {av.specialized_analyzer_count} Analyzers •{' '}
                    {av.lab_sample_count} Lab Assays
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">
                    {av.recorded_samples_in_window}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">
                    <span
                      className={
                        av.availability_pct >= 95
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {av.availability_pct}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-md">
                    {av.missing_data_notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
