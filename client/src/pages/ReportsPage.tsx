import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Check,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../services/api';
import { ParameterCode, TimeRangeOption } from '../types/index';
import {
  ALL_PARAMETERS_LIST,
  formatLocalDateTime,
} from '../utils/formatters';
import {
  ConnectivityBadge,
  DemoProvenanceBadge,
  StatusBadge,
} from '../components/StatusBadge';

export const ReportsPage: React.FC = () => {
  const { summary, addToast } = useAppContext();
  const stations = summary?.stations || [];

  const [reportTitle, setReportTitle] = useState(
    'AquaGuard Watershed Environmental Quality & Alert Compliance Report'
  );
  const [range, setRange] = useState<TimeRangeOption>('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([
    'STN-RIV-01',
    'STN-RIV-02',
    'STN-IND-03',
    'STN-WWT-04',
    'STN-RES-05',
    'STN-INT-06',
  ]);
  const [selectedParams, setSelectedParams] = useState<ParameterCode[]>([
    'ph',
    'turbidity',
    'dissolved_oxygen',
    'tds',
    'temperature',
    'conductivity',
    'nitrate',
    'phosphate',
    'ammonia',
    'bod',
  ]);
  const [includeAlerts, setIncludeAlerts] = useState(true);
  const [reportMode, setReportMode] = useState<'summary' | 'detailed'>('summary');

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadReportPreview = async () => {
    setLoading(true);
    try {
      const data = await api.getReportPreview({
        range: startDate ? undefined : range,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
        stationIds: selectedStationIds,
        parameters: selectedParams,
        includeAlerts,
        reportMode,
        title: reportTitle,
      });
      setReportData(data);
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Report Generation Error',
        message: err?.message || 'Could not generate report preview.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportPreview();
  }, [range, startDate, endDate, selectedStationIds, selectedParams, includeAlerts, reportMode]);

  const toggleStation = (id: string) => {
    setSelectedStationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleParam = (code: ParameterCode) => {
    setSelectedParams((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleDownloadCsv = async (type: 'readings' | 'alerts') => {
    if (selectedStationIds.length === 0 || selectedParams.length === 0) {
      addToast({
        type: 'warning',
        title: 'Selection Required',
        message: 'Select at least one monitoring station and one parameter before exporting.',
      });
      return;
    }

    setExporting(true);
    try {
      const url = api.downloadReportCsvUrl({
        type,
        range: startDate ? undefined : range,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
        stationIds: selectedStationIds,
        parameters: selectedParams,
      });

      const res = await fetch(url);
      let csvText = '';
      if (res.ok && (res.headers.get('content-type') || '').includes('text/csv')) {
        csvText = await res.text();
      } else if (reportData) {
        // Fallback client-side RFC-4180 CSV generation for static hosts
        const escapeCsv = (v: unknown) => {
          const s = v === null || v === undefined ? '' : String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        };
        if (type === 'readings') {
          const header = [
            'Reading ID',
            'Timestamp',
            'Station ID',
            'Station Name',
            'Parameter',
            'Value',
            'Unit',
            'Quality Status',
            'Data Source',
          ].join(',');
          const rows = (reportData.readings || []).map((r: any) =>
            [
              r.id,
              r.recorded_at,
              r.station_id,
              r.station_name,
              r.parameter,
              r.value,
              r.unit,
              r.quality_status,
              'DEMO DATA (SIMULATED)',
            ]
              .map(escapeCsv)
              .join(',')
          );
          csvText = [header, ...rows].join('\r\n');
        } else {
          const header = [
            'Alert ID',
            'Created Timestamp',
            'Severity',
            'Station ID',
            'Parameter',
            'Measured Value',
            'Triggered Threshold',
            'Title',
          ].join(',');
          const rows = (reportData.alerts || []).map((a: any) =>
            [
              a.id,
              a.created_at,
              a.severity,
              a.station_id,
              a.parameter,
              a.measured_value ?? '',
              a.triggered_threshold,
              a.title,
            ]
              .map(escapeCsv)
              .join(',')
          );
          csvText = [header, ...rows].join('\r\n');
        }
      } else {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `aquaguard-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      addToast({
        type: 'success',
        title: 'CSV Export Downloaded',
        message: `Successfully exported ${type === 'readings' ? 'sensor measurements' : 'pollution alerts'} to CSV.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'CSV Export Failed',
        message: err?.message || 'Unable to download CSV export.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!reportData) return;
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header Banner
      doc.setFillColor(15, 37, 64); // Deep Navy Blue
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('AquaGuard — Intelligent Water Quality Monitoring', 14, 13);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(reportData.reportTitle || reportTitle, 14, 20);
      doc.setFontSize(8);
      doc.text(
        `Generated: ${formatLocalDateTime(reportData.generatedAt)} | Window: ${reportData.timeBounds?.label || range} | Mode: ${reportMode.toUpperCase()}`,
        14,
        27
      );

      // Demo Data Disclosure Box
      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(165, 180, 252);
      doc.rect(14, 36, 182, 14, 'FD');
      doc.setTextColor(49, 46, 129);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('DEMO DATA DISCLOSURE (SIMULATED TELEMETRY):', 17, 41);
      doc.setFont('helvetica', 'normal');
      const splitDisclosure = doc.splitTextToSize(
        reportData.simulatedDataDisclosure ||
          'Contains simulated demonstration sensor readings. Do not use for official regulatory certification.',
        176
      );
      doc.text(splitDisclosure, 17, 45);

      // Section 1: Station Summary
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Monitoring Stations Summary', 14, 58);

      autoTable(doc, {
        startY: 61,
        head: [['Station ID', 'Station Name', 'Water Body', 'Connectivity', 'Status', 'WQI', 'Samples', 'Alerts']],
        body: (reportData.stationSummaries || []).map((s: any) => [
          s.id,
          s.name,
          s.water_body,
          s.connectivity_status.toUpperCase(),
          s.overall_status.toUpperCase(),
          String(s.wqi_score),
          String(s.readings_in_period),
          String(s.alerts_in_period),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [15, 37, 64] },
      });

      let currentY = (doc as any).lastAutoTable.finalY + 8;

      // Section 2: Parameter Statistics
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Parameter Statistical Summary', 14, currentY);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Station ID', 'Parameter', 'Unit', 'Samples', 'Min', 'Mean', 'Max', 'Anomalies']],
        body: (reportData.parameterStatistics || []).slice(0, 35).map((p: any) => [
          p.station_id,
          p.parameter_name,
          p.unit,
          String(p.sample_count),
          String(p.min_val),
          String(p.avg_val),
          String(p.max_val),
          String(p.anomaly_count),
        ]),
        styles: { fontSize: 7, cellPadding: 1.8 },
        headStyles: { fillColor: [2, 132, 199] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // Section 3: Alerts in Period
      if (includeAlerts && (reportData.alerts || []).length > 0) {
        if (currentY > 235) {
          doc.addPage();
          currentY = 18;
        }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('3. Pollution Alerts Recorded in Period', 14, currentY);

        autoTable(doc, {
          startY: currentY + 3,
          head: [['Alert ID', 'Severity', 'Station', 'Parameter', 'Measured', 'Threshold', 'Status']],
          body: (reportData.alerts || []).slice(0, 25).map((a: any) => [
            a.id,
            a.severity.toUpperCase(),
            a.station_id,
            a.parameter,
            a.measured_value !== null ? `${a.measured_value} ${a.unit}` : 'OFFLINE',
            a.triggered_threshold,
            a.resolved ? 'RESOLVED' : a.acknowledged ? 'ACK' : 'ACTIVE',
          ]),
          styles: { fontSize: 7, cellPadding: 1.8 },
          headStyles: { fillColor: [185, 28, 28] },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // Section 4: Missing-Data Notes
      if ((reportData.missingDataNotes || []).length > 0) {
        if (currentY > 245) {
          doc.addPage();
          currentY = 18;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('4. Missing-Data & Sensor Capability Notes', 14, currentY);

        autoTable(doc, {
          startY: currentY + 3,
          head: [['Station', 'Category', 'Diagnostic Note']],
          body: (reportData.missingDataNotes || []).map((n: any) => [
            `${n.station_name} (${n.station_id})`,
            n.status,
            n.note,
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [71, 85, 105] },
        });
      }

      const filename = `aquaguard-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

      addToast({
        type: 'success',
        title: 'PDF Report Generated',
        message: `Downloaded formatted report (${filename}).`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'PDF Export Error',
        message: err?.message || 'Could not generate PDF report.',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Configuration Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Configure Water-Quality Monitoring Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize report scope, time window, stations, and parameters before exporting CSV or formatted PDF
            </p>
          </div>
          <DemoProvenanceBadge />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left column: Title, Range, Mode */}
          <div className="lg:col-span-5 space-y-3.5">
            <div>
              <label
                htmlFor="report-title-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Report Title
              </label>
              <input
                id="report-title-input"
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preset Window
                </label>
                <select
                  aria-label="Report preset time range"
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value as TimeRangeOption);
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="1h">Last 1 Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Report Mode
                </label>
                <select
                  aria-label="Report detail mode"
                  value={reportMode}
                  onChange={(e) => setReportMode(e.target.value as 'summary' | 'detailed')}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
                >
                  <option value="summary">Executive Summary Mode</option>
                  <option value="detailed">Detailed Audit Mode (Full Logs)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Custom Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Custom End Date (Optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAlerts}
                onChange={(e) => setIncludeAlerts(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Include Pollution Alerts & Resolution Log in Report</span>
            </label>
          </div>

          {/* Middle column: Station Selection */}
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Stations ({selectedStationIds.length}/{stations.length})
              </span>
              <div className="space-x-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedStationIds(stations.map((s) => s.id))}
                  className="text-sky-600 hover:underline font-medium"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStationIds([])}
                  className="text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {stations.map((s) => {
                const checked = selectedStationIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStation(s.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      checked
                        ? 'bg-sky-50 border-sky-400 text-sky-900 dark:bg-sky-950/60 dark:border-sky-600 dark:text-sky-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="truncate">
                      {s.code} — {s.name}
                    </span>
                    {checked && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right column: Parameter Selection */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Parameters ({selectedParams.length}/10)
              </span>
              <div className="space-x-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedParams(ALL_PARAMETERS_LIST.map((p) => p.code))}
                  className="text-sky-600 hover:underline font-medium"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedParams([])}
                  className="text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {ALL_PARAMETERS_LIST.map((p) => {
                const checked = selectedParams.includes(p.code);
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => toggleParam(p.code)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                      checked
                        ? 'bg-sky-50 border-sky-400 text-sky-900 dark:bg-sky-950/60 dark:border-sky-600 dark:text-sky-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="truncate">{p.shortName}</span>
                    {checked && <Check className="w-3 h-3 text-sky-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Export Buttons Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={loadReportPreview}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Report Preview</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleDownloadCsv('readings')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Measurements CSV</span>
            </button>

            <button
              type="button"
              disabled={exporting}
              onClick={() => handleDownloadCsv('alerts')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export Alerts CSV</span>
            </button>

            <button
              type="button"
              disabled={exporting || !reportData}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-navy-900 hover:bg-navy-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white shadow-xs disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>Download Formatted PDF Report</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live Document Preview */}
      {loading && !reportData ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Compiling monitoring report preview...
        </div>
      ) : (
        reportData && (
          <section
            aria-label="Monitoring Report Live Preview"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-md space-y-6"
          >
            {/* Document Header */}
            <div className="border-b-2 border-navy-900 dark:border-sky-600 pb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  {reportData.organizationName}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {reportData.reportTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Period: <strong>{reportData.timeBounds?.label}</strong> (
                  {formatLocalDateTime(reportData.timeBounds?.startIso)} —{' '}
                  {formatLocalDateTime(reportData.timeBounds?.endIso)})
                </p>
              </div>
              <div className="text-right text-xs font-mono text-slate-500">
                <div>Generated: {formatLocalDateTime(reportData.generatedAt)}</div>
                <div>Mode: {reportData.reportMode?.toUpperCase()}</div>
                <div>Total Readings: {reportData.totalReadingsCount ?? 0}</div>
              </div>
            </div>

            {/* Simulated Data Disclosure Box */}
            {reportData.containsSimulatedData && (
              <div className="p-3.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">
                    Simulated Demonstration Data Disclosure
                  </strong>
                  <span>{reportData.simulatedDataDisclosure}</span>
                </div>
              </div>
            )}

            {/* 1. Station Summary Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Selected Monitoring Stations Summary ({reportData.stationSummaries?.length || 0})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                      <th className="py-2 px-3">Station ID</th>
                      <th className="py-2 px-3">Station Name</th>
                      <th className="py-2 px-3">Water Body</th>
                      <th className="py-2 px-3">Connectivity</th>
                      <th className="py-2 px-3">Condition</th>
                      <th className="py-2 px-3">WQI</th>
                      <th className="py-2 px-3">Readings in Period</th>
                      <th className="py-2 px-3">Alerts in Period</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(reportData.stationSummaries || []).map((st: any) => (
                      <tr key={st.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-sky-700 dark:text-sky-400">
                          {st.id}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{st.name}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {st.water_body}
                        </td>
                        <td className="py-2.5 px-3">
                          <ConnectivityBadge status={st.connectivity_status} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={st.overall_status} />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold">{st.wqi_score}</td>
                        <td className="py-2.5 px-3 font-mono">{st.readings_in_period}</td>
                        <td className="py-2.5 px-3 font-mono">{st.alerts_in_period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Chart of Station WQI & Readings Volume */}
            {(reportData.stationSummaries || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  2. Watershed Station WQI & Alert Comparison Chart
                </h3>
                <div className="h-56 w-full bg-slate-50/60 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.stationSummaries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                      <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="wqi_score" name="Water Quality Index (WQI)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="alerts_in_period" name="Alerts in Period" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 3. Parameter Statistics Table */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                3. Parameter Statistics by Station ({reportData.parameterStatistics?.length || 0} series)
              </h3>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Station</th>
                      <th className="py-2 px-3">Parameter</th>
                      <th className="py-2 px-3">Unit</th>
                      <th className="py-2 px-3">Samples</th>
                      <th className="py-2 px-3">Min</th>
                      <th className="py-2 px-3">Mean</th>
                      <th className="py-2 px-3">Max</th>
                      <th className="py-2 px-3">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(reportData.parameterStatistics || []).map((ps: any, idx: number) => (
                      <tr key={`${ps.station_id}-${ps.parameter}-${idx}`}>
                        <td className="py-2 px-3 font-mono font-semibold">{ps.station_id}</td>
                        <td className="py-2 px-3 font-semibold">{ps.parameter_name}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{ps.unit}</td>
                        <td className="py-2 px-3 font-mono">{ps.sample_count}</td>
                        <td className="py-2 px-3 font-mono">{ps.min_val}</td>
                        <td className="py-2 px-3 font-mono font-bold text-sky-700 dark:text-sky-400">
                          {ps.avg_val}
                        </td>
                        <td className="py-2 px-3 font-mono">{ps.max_val}</td>
                        <td className="py-2 px-3 font-mono">
                          {ps.anomaly_count > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-bold">
                              {ps.anomaly_count}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Alerts Included in Period */}
            {includeAlerts && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  4. Pollution Alerts Generated During Period ({reportData.alerts?.length || 0})
                </h3>
                {(reportData.alerts || []).length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No pollution alerts generated during the selected period.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Alert ID</th>
                          <th className="py-2 px-3">Severity</th>
                          <th className="py-2 px-3">Station</th>
                          <th className="py-2 px-3">Parameter</th>
                          <th className="py-2 px-3">Measured</th>
                          <th className="py-2 px-3">Threshold</th>
                          <th className="py-2 px-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(reportData.alerts || []).map((a: any) => (
                          <tr key={a.id}>
                            <td className="py-2 px-3 font-mono font-bold">{a.id}</td>
                            <td className="py-2 px-3">
                              <StatusBadge status={a.severity} />
                            </td>
                            <td className="py-2 px-3">{a.station_name || a.station_id}</td>
                            <td className="py-2 px-3">{a.parameter}</td>
                            <td className="py-2 px-3 font-mono">
                              {a.measured_value !== null ? `${a.measured_value} ${a.unit}` : 'OFFLINE'}
                            </td>
                            <td className="py-2 px-3 font-mono">{a.triggered_threshold}</td>
                            <td className="py-2 px-3 font-mono">
                              {formatLocalDateTime(a.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. Missing-Data Notes */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>5. Missing-Data & Sensor Capability Notes</span>
              </h3>
              {(reportData.missingDataNotes || []).length === 0 ? (
                <p className="text-xs text-slate-500">
                  No missing telemetry intervals or unsupported sensor exclusions detected for the selected scope.
                </p>
              ) : (
                <div className="space-y-2">
                  {(reportData.missingDataNotes || []).map((note: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-start justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white mr-2">
                          {note.station_name} ({note.station_id}) — [{note.status}]:
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">{note.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      )}
    </div>
  );
};
