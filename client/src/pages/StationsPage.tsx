import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ArrowUpDown,
  Edit3,
  Trash2,
  Eye,
  MapPin,
  Sliders,
  ShieldAlert,
  Activity,
  X,
  Check,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { api } from '../services/api';
import {
  AlertItem,
  ParameterCode,
  SensorReading,
  Station,
  ThresholdRule,
} from '../types/index';
import {
  ALL_PARAMETERS_LIST,
  formatLocalDateTime,
  formatParameterValue,
  formatRelativeTime,
  PARAMETER_METADATA,
} from '../utils/formatters';
import {
  ConnectivityBadge,
  DemoProvenanceBadge,
  SensorSourceBadge,
  StatusBadge,
} from '../components/StatusBadge';

const STATION_TYPES = [
  'River upstream monitoring point',
  'River downstream monitoring point',
  'Industrial discharge monitoring point',
  'Wastewater treatment outlet',
  'Reservoir monitoring point',
  'Water treatment intake',
];

export const StationsPage: React.FC = () => {
  const { summary, user, refreshGlobalData, addToast, openAlertModal } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const stations = summary?.stations || [];

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [connectivityFilter, setConnectivityFilter] = useState(
    searchParams.get('connectivity') || 'all'
  );
  const [sortCol, setSortCol] = useState<'id' | 'name' | 'overall_status' | 'last_seen_at'>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Detailed Station Inspector Drawer / Modal
  const [inspectedStationId, setInspectedStationId] = useState<string | null>(
    searchParams.get('stationId') || null
  );
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'history' | 'alerts' | 'thresholds'>(
    'overview'
  );
  const [stationReadings, setStationReadings] = useState<SensorReading[]>([]);
  const [stationAlerts, setStationAlerts] = useState<AlertItem[]>([]);
  const [stationThresholds, setStationThresholds] = useState<ThresholdRule[]>([]);

  // Add / Edit Station Modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    code: '',
    station_type: STATION_TYPES[0],
    location_name: '',
    water_body: '',
    latitude: 45.535,
    longitude: -122.665,
    connectivity_status: 'online' as 'online' | 'offline',
    firmware_version: 'v3.6.0-SolarIoT',
    sampling_interval_sec: 5,
    description: '',
    supported_parameters: ['ph', 'turbidity', 'dissolved_oxygen', 'tds', 'temperature'] as ParameterCode[],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);

  // Delete Confirmation Modal
  const [stationToDelete, setStationToDelete] = useState<Station | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Station-specific threshold override form state
  const [overrideParam, setOverrideParam] = useState<ParameterCode>('turbidity');
  const [overrideMinWarn, setOverrideMinWarn] = useState<string>('');
  const [overrideMaxWarn, setOverrideMaxWarn] = useState<string>('4.5');
  const [overrideMinCrit, setOverrideMinCrit] = useState<string>('');
  const [overrideMaxCrit, setOverrideMaxCrit] = useState<string>('12.0');
  const [overrideNotes, setOverrideNotes] = useState<string>('Station-specific operational threshold');
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    const qSt = searchParams.get('stationId');
    if (qSt) setInspectedStationId(qSt);
  }, [searchParams]);

  const inspectedStation = useMemo(
    () => stations.find((s) => s.id === inspectedStationId) || null,
    [stations, inspectedStationId]
  );

  // Load detailed history, alerts, and thresholds when a station is inspected
  useEffect(() => {
    if (!inspectedStationId) return;
    let cancelled = false;

    Promise.all([
      api.getStationById(inspectedStationId),
      api.getReadings({ stationId: inspectedStationId, range: '24h', limit: 120 }),
    ])
      .then(([detailRes, readingsRes]) => {
        if (cancelled) return;
        setStationAlerts(detailRes.alerts || []);
        setStationThresholds(detailRes.thresholds || []);
        setStationReadings((readingsRes.readings || []).slice().reverse());
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, [inspectedStationId, summary?.kpis?.lastDataUpdate]);

  const filteredStations = useMemo(() => {
    const list = stations.filter((s) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'attention') {
          if (s.overall_status === 'normal') return false;
        } else if (s.overall_status !== statusFilter) {
          return false;
        }
      }
      if (connectivityFilter !== 'all' && s.connectivity_status !== connectivityFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.location_name.toLowerCase().includes(q) ||
          s.water_body.toLowerCase().includes(q) ||
          s.station_type.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortCol === 'last_seen_at') {
        cmp = (a.last_seen_at || '').localeCompare(b.last_seen_at || '');
      } else if (sortCol === 'overall_status') {
        const rank: Record<string, number> = { critical: 1, warning: 2, offline: 3, normal: 4 };
        cmp = (rank[a.overall_status] || 5) - (rank[b.overall_status] || 5);
      } else {
        cmp = a.id.localeCompare(b.id);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [stations, searchQuery, statusFilter, connectivityFilter, sortCol, sortDir]);

  const handleSort = (col: 'id' | 'name' | 'overall_status' | 'last_seen_at') => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const openCreateModal = () => {
    setEditingStation(null);
    setFormError(null);
    setFormData({
      id: `STN-NEW-0${stations.length + 1}`,
      name: '',
      code: `CW-ST-0${stations.length + 1}`,
      station_type: STATION_TYPES[0],
      location_name: '',
      water_body: 'Clearwater River Basin',
      latitude: 45.535,
      longitude: -122.665,
      connectivity_status: 'online',
      firmware_version: 'v3.6.0-SolarIoT',
      sampling_interval_sec: 5,
      description: '',
      supported_parameters: ['ph', 'turbidity', 'dissolved_oxygen', 'tds', 'temperature'],
    });
    setFormModalOpen(true);
  };

  const openEditModal = (station: Station) => {
    setEditingStation(station);
    setFormError(null);
    setFormData({
      id: station.id,
      name: station.name,
      code: station.code,
      station_type: station.station_type,
      location_name: station.location_name,
      water_body: station.water_body,
      latitude: station.latitude,
      longitude: station.longitude,
      connectivity_status: station.connectivity_status,
      firmware_version: station.firmware_version,
      sampling_interval_sec: station.sampling_interval_sec,
      description: station.description,
      supported_parameters: station.capabilities
        .filter((c) => c.is_enabled)
        .map((c) => c.parameter),
    });
    setFormModalOpen(true);
  };

  const toggleFormParameter = (code: ParameterCode) => {
    setFormData((prev) => {
      const exists = prev.supported_parameters.includes(code);
      if (exists) {
        return {
          ...prev,
          supported_parameters: prev.supported_parameters.filter((p) => p !== code),
        };
      }
      return {
        ...prev,
        supported_parameters: [...prev.supported_parameters, code],
      };
    });
  };

  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingForm(true);

    try {
      if (editingStation) {
        await api.updateStation(editingStation.id, formData);
        addToast({
          type: 'success',
          title: 'Station Updated',
          message: `Station ${editingStation.name} (${editingStation.id}) saved to database.`,
        });
      } else {
        const res = await api.createStation(formData);
        addToast({
          type: 'success',
          title: 'Monitoring Station Created',
          message: `Station ${res.station.name} (${res.station.id}) initialized with ${res.station.capabilities.length} sensors.`,
        });
      }
      setFormModalOpen(false);
      await refreshGlobalData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save station.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleQuickToggleConnectivity = async (station: Station) => {
    const nextConn = station.connectivity_status === 'online' ? 'offline' : 'online';
    try {
      await api.updateStation(station.id, { connectivity_status: nextConn });
      await refreshGlobalData();
      addToast({
        type: nextConn === 'online' ? 'success' : 'warning',
        title: `Station Marked ${nextConn.toUpperCase()}`,
        message: `${station.name} connectivity changed to ${nextConn}.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Permission Denied or Update Failed',
        message: err?.message || 'Administrator role required.',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!stationToDelete) return;
    setDeleting(true);
    try {
      await api.deleteStation(stationToDelete.id);
      if (inspectedStationId === stationToDelete.id) {
        setInspectedStationId(null);
      }
      setStationToDelete(null);
      await refreshGlobalData();
      addToast({
        type: 'info',
        title: 'Station Removed',
        message: `Station ${stationToDelete.name} and its associated records were safely removed.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Deletion Failed',
        message: err?.message || 'Could not delete station.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveStationThresholdOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedStation) return;
    setSavingOverride(true);
    try {
      await api.upsertStationThreshold({
        station_id: inspectedStation.id,
        parameter: overrideParam,
        min_warning: overrideMinWarn.trim() !== '' ? Number(overrideMinWarn) : null,
        max_warning: overrideMaxWarn.trim() !== '' ? Number(overrideMaxWarn) : null,
        min_critical: overrideMinCrit.trim() !== '' ? Number(overrideMinCrit) : null,
        max_critical: overrideMaxCrit.trim() !== '' ? Number(overrideMaxCrit) : null,
        enabled: 1,
        notes: overrideNotes,
      });
      const detailRes = await api.getStationById(inspectedStation.id);
      setStationThresholds(detailRes.thresholds || []);
      await refreshGlobalData();
      addToast({
        type: 'success',
        title: 'Station Threshold Saved',
        message: `Updated ${PARAMETER_METADATA[overrideParam].name} limits for ${inspectedStation.name}.`,
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Invalid Threshold Configuration',
        message: err?.message || 'Check boundary ordering.',
      });
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by station ID, name, code, or water body..."
              aria-label="Search monitoring stations"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <select
            aria-label="Filter by station status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="all">All Statuses ({stations.length})</option>
            <option value="normal">Normal</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="offline">Offline</option>
            <option value="attention">Requiring Attention</option>
          </select>

          <select
            aria-label="Filter by connectivity"
            value={connectivityFilter}
            onChange={(e) => setConnectivityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium"
          >
            <option value="all">Online & Offline</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/map')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-600" />
            <span>View on Map</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={user.role !== 'admin'}
            title={
              user.role !== 'admin'
                ? 'Switch to Administrator role to add stations'
                : 'Add a new monitoring station'
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Station</span>
          </button>
        </div>
      </section>

      {/* Stations Registry Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Station ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Station Name & Type</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Monitoring Location</th>
                <th className="py-3 px-4">Water Body / Facility</th>
                <th className="py-3 px-4">Online Status</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('overall_status')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Overall Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Supported Sensors</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('last_seen_at')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Latest Measurement</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No monitoring stations found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStations.map((st) => {
                  const enabledCaps = st.capabilities.filter((c) => c.is_enabled);
                  const isSelected = inspectedStation?.id === st.id;
                  return (
                    <tr
                      key={st.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-sky-50/70 dark:bg-sky-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                        <div>{st.id}</div>
                        <div className="text-[10px] text-slate-400">{st.code}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{st.name}</div>
                        <div className="text-[11px] text-slate-500">{st.station_type}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-[210px]">
                        <div className="truncate text-slate-700 dark:text-slate-300">
                          {st.location_name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {st.latitude.toFixed(4)}°N, {st.longitude.toFixed(4)}°E
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {st.water_body}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <ConnectivityBadge status={st.connectivity_status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={st.overall_status} />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {enabledCaps.map((c) => (
                            <span
                              key={c.parameter}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {PARAMETER_METADATA[c.parameter]?.shortName || c.parameter}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div>{formatRelativeTime(st.last_seen_at)}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatLocalDateTime(st.last_seen_at)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedStationId(st.id);
                              setSearchParams({ stationId: st.id });
                            }}
                            title="Inspect station details, history, alerts, and thresholds"
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={user.role !== 'admin'}
                            onClick={() => handleQuickToggleConnectivity(st)}
                            title={
                              st.connectivity_status === 'online'
                                ? 'Simulate station offline drop'
                                : 'Bring station online'
                            }
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40"
                          >
                            {st.connectivity_status === 'online' ? (
                              <WifiOff className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Wifi className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={user.role !== 'admin'}
                            onClick={() => openEditModal(st)}
                            title="Edit station configuration & sensor capabilities"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={user.role !== 'admin'}
                            onClick={() => setStationToDelete(st)}
                            title="Delete monitoring station"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-800 disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Station Detail Inspector Panel */}
      {inspectedStation && (
        <section
          aria-label="Selected Station Detailed Profile"
          className="bg-white dark:bg-slate-900 border-2 border-sky-600/80 dark:border-sky-500/80 rounded-card p-5 shadow-md space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                  {inspectedStation.id} ({inspectedStation.code})
                </span>
                <ConnectivityBadge status={inspectedStation.connectivity_status} />
                <StatusBadge status={inspectedStation.overall_status} />
                <DemoProvenanceBadge compact />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {inspectedStation.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {inspectedStation.location_name} • {inspectedStation.water_body} •{' '}
                {inspectedStation.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate(`/live?stationId=${encodeURIComponent(inspectedStation.id)}`)
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
              >
                Open Live Stream
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectedStationId(null);
                  setSearchParams({});
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Close station inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Inspector Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            {[
              { id: 'overview', label: 'Configured Sensors & Latest Values', icon: Sliders },
              {
                id: 'history',
                label: `Measurement History (${stationReadings.length})`,
                icon: Activity,
              },
              {
                id: 'alerts',
                label: `Station Alerts (${stationAlerts.length})`,
                icon: ShieldAlert,
              },
              {
                id: 'thresholds',
                label: 'Station Threshold Overrides',
                icon: Edit3,
              },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectorTab(t.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    inspectorTab === t.id
                      ? 'bg-navy-900 text-white dark:bg-sky-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Overview & Capabilities */}
          {inspectorTab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {inspectedStation.capabilities
                .filter((c) => c.is_enabled)
                .map((cap) => {
                  const meta = PARAMETER_METADATA[cap.parameter];
                  const latest = inspectedStation.latestReadings[cap.parameter];
                  return (
                    <div
                      key={cap.parameter}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {meta?.name || cap.parameter}
                        </span>
                        <StatusBadge status={latest?.quality_status || 'normal'} />
                      </div>
                      <SensorSourceBadge sourceType={cap.data_source_type} />
                      <div className="text-xl font-bold font-mono text-slate-900 dark:text-white pt-1">
                        {latest
                          ? `${formatParameterValue(cap.parameter, latest.value)} ${cap.unit}`
                          : 'No reading'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Model: {cap.sensor_model}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Tab 2: Measurement History */}
          {inspectorTab === 'history' && (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Parameter</th>
                    <th className="py-2 px-3">Value</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stationReadings.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-mono">{formatLocalDateTime(r.recorded_at)}</td>
                      <td className="py-2 px-3 font-semibold">
                        {PARAMETER_METADATA[r.parameter]?.name || r.parameter}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold">
                        {r.value} {r.unit}
                      </td>
                      <td className="py-2 px-3">
                        <StatusBadge status={r.quality_status} />
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{r.data_source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Station Alerts */}
          {inspectorTab === 'alerts' && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stationAlerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No pollution alerts recorded for this station.
                </div>
              ) : (
                stationAlerts.map((al) => (
                  <div
                    key={al.id}
                    onClick={() => openAlertModal(al.id)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={al.severity} />
                        <span className="font-bold text-slate-900 dark:text-white">{al.title}</span>
                      </div>
                      <p className="text-slate-500">{al.message}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {formatLocalDateTime(al.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Station-Specific Threshold Overrides */}
          {inspectorTab === 'thresholds' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-2 max-h-72 overflow-y-auto">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Effective Threshold Rules for {inspectedStation.name}
                </h4>
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500">
                    <tr>
                      <th className="py-2 px-2.5">Parameter</th>
                      <th className="py-2 px-2.5">Scope</th>
                      <th className="py-2 px-2.5">Warning Band</th>
                      <th className="py-2 px-2.5">Critical Band</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stationThresholds.map((tr) => (
                      <tr key={tr.id}>
                        <td className="py-2 px-2.5 font-semibold">
                          {PARAMETER_METADATA[tr.parameter]?.name || tr.parameter}
                        </td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              tr.station_id
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {tr.station_id ? 'Station Override' : 'Global Default'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-mono">
                          {tr.min_warning ?? '—'} to {tr.max_warning ?? '—'} {tr.unit}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-red-600 dark:text-red-400">
                          {tr.min_critical ?? '—'} / {tr.max_critical ?? '—'} {tr.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form
                onSubmit={handleSaveStationThresholdOverride}
                className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Configure Station-Specific Override
                </h4>
                <div>
                  <label className="block text-xs font-semibold mb-1">Parameter</label>
                  <select
                    value={overrideParam}
                    onChange={(e) => setOverrideParam(e.target.value as ParameterCode)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                  >
                    {ALL_PARAMETERS_LIST.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Min Warning</label>
                    <input
                      type="number"
                      step="any"
                      value={overrideMinWarn}
                      onChange={(e) => setOverrideMinWarn(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Max Warning</label>
                    <input
                      type="number"
                      step="any"
                      value={overrideMaxWarn}
                      onChange={(e) => setOverrideMaxWarn(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Min Critical</label>
                    <input
                      type="number"
                      step="any"
                      value={overrideMinCrit}
                      onChange={(e) => setOverrideMinCrit(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Max Critical</label>
                    <input
                      type="number"
                      step="any"
                      value={overrideMaxCrit}
                      onChange={(e) => setOverrideMaxCrit(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Rule Notes</label>
                  <input
                    type="text"
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingOverride || user.role !== 'admin'}
                  className="w-full py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
                >
                  {savingOverride ? 'Saving Override...' : 'Save Station Threshold Override'}
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {/* Add / Edit Station Modal */}
      {formModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-2xl w-full max-w-2xl p-6 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingStation
                  ? `Edit Monitoring Station — ${editingStation.id}`
                  : 'Register New Monitoring Station'}
              </h3>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStation} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Station ID</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingStation)}
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Short Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Connectivity</label>
                  <select
                    value={formData.connectivity_status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        connectivity_status: e.target.value as 'online' | 'offline',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  >
                    <option value="online">Online (Active Telemetry)</option>
                    <option value="offline">Offline (Simulated Drop)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Station Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Oakridge Tributary Weir"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Station Category</label>
                  <select
                    value={formData.station_type}
                    onChange={(e) => setFormData({ ...formData, station_type: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  >
                    {STATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Monitoring Location</label>
                  <input
                    type="text"
                    required
                    value={formData.location_name}
                    onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                    placeholder="e.g. Sector E2 — North Bridge Pier (Demo)"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Water Body or Facility</label>
                  <input
                    type="text"
                    required
                    value={formData.water_body}
                    onChange={(e) => setFormData({ ...formData, water_body: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData({ ...formData, latitude: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData({ ...formData, longitude: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Supported Sensor Parameters ({formData.supported_parameters.length} selected)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_PARAMETERS_LIST.map((m) => {
                    const checked = formData.supported_parameters.includes(m.code);
                    return (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => toggleFormParameter(m.code)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          checked
                            ? 'bg-sky-50 border-sky-400 text-sky-900 dark:bg-sky-950/60 dark:border-sky-600 dark:text-sky-200'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="truncate">
                          {m.shortName} ({m.unit})
                        </span>
                        {checked && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {savingForm
                    ? 'Saving...'
                    : editingStation
                      ? 'Save Station Changes'
                      : 'Create Monitoring Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Station Confirmation Modal */}
      {stationToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400">
              Confirm Station Deletion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <strong>
                {stationToDelete.name} ({stationToDelete.id})
              </strong>
              ? All associated sensor capabilities, readings, and station alerts will be cascade-deleted cleanly.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStationToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? 'Deleting...' : 'Delete Station'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
