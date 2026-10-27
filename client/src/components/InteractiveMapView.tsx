import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Search,
  ExternalLink,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  OctagonAlert,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Station } from '../types/index';
import { StatusBadge, ConnectivityBadge, DemoProvenanceBadge } from './StatusBadge';
import {
  formatLocalDateTime,
  formatRelativeTime,
  PARAMETER_METADATA,
} from '../utils/formatters';

interface InteractiveMapViewProps {
  stations: Station[];
  initialSelectedStationId?: string | null;
  onSelectStationForDetails?: (station: Station) => void;
  heightClass?: string;
}

function getMarkerHtml(station: Station, isSelected: boolean): string {
  const status = station.overall_status;
  let bg = '#059669'; // Green: Normal
  let border = '#10b981';
  let glyph = '✓';

  if (status === 'critical') {
    bg = '#dc2626'; // Red: Critical
    border = '#f87171';
    glyph = '!';
  } else if (status === 'warning') {
    bg = '#d97706'; // Amber: Warning
    border = '#fbbf24';
    glyph = '▲';
  } else if (status === 'offline') {
    bg = '#64748b'; // Gray: Offline
    border = '#94a3b8';
    glyph = '×';
  }

  const ring = isSelected
    ? `box-shadow: 0 0 0 5px rgba(14, 165, 233, 0.45), 0 6px 16px rgba(15,23,42,0.35); transform: scale(1.15);`
    : `box-shadow: 0 3px 10px rgba(15,23,42,0.3);`;

  return `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="
        width:34px;
        height:34px;
        border-radius:9999px;
        background:${bg};
        border:2.5px solid ${isSelected ? '#0ea5e9' : border};
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:700;
        font-size:13px;
        transition:all 0.15s ease;
        ${ring}
      ">
        <span>${glyph}</span>
      </div>
      <div style="
        margin-top:2px;
        padding:1px 6px;
        border-radius:4px;
        background:rgba(15, 23, 42, 0.88);
        color:#f8fafc;
        font-size:10px;
        font-family:monospace;
        font-weight:600;
        white-space:nowrap;
        border:1px solid rgba(148,163,184,0.35);
      ">
        ${station.code}
      </div>
    </div>
  `;
}

export const InteractiveMapView: React.FC<InteractiveMapViewProps> = ({
  stations,
  initialSelectedStationId,
  onSelectStationForDetails,
  heightClass = 'h-[620px]',
}) => {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedStationId || (stations[0]?.id ?? null)
  );
  const [tileError, setTileError] = useState(false);

  const filteredStations = stations.filter((s) => {
    if (statusFilter !== 'all' && s.overall_status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.location_name.toLowerCase().includes(q) ||
        s.water_body.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedStation =
    stations.find((s) => s.id === selectedId) || filteredStations[0] || null;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [45.525, -122.668],
        zoom: 12,
        zoomControl: true,
      });

      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      });

      tileLayer.on('tileerror', () => {
        setTileError(true);
      });

      tileLayer.addTo(map);
      mapInstanceRef.current = map;
    } catch (err) {
      console.warn('[AquaGuard Map] Fallback mode active:', err);
      setTileError(true);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize markers whenever filteredStations or selectedId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersMapRef.current.forEach((marker) => marker.remove());
    markersMapRef.current.clear();

    filteredStations.forEach((st) => {
      const isSelected = st.id === (selectedStation?.id ?? null);
      const icon = L.divIcon({
        className: 'aquaguard-marker-icon',
        html: getMarkerHtml(st, isSelected),
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });

      const marker = L.marker([st.latitude, st.longitude], { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedId(st.id);
      });

      markersMapRef.current.set(st.id, marker);
    });
  }, [filteredStations, selectedStation?.id]);

  const handleSelectStation = (station: Station) => {
    setSelectedId(station.id);
    const map = mapInstanceRef.current;
    if (map) {
      try {
        map.flyTo([station.latitude, station.longitude], 13, { duration: 0.6 });
      } catch {
        // ignore if map not ready
      }
    }
  };

  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredStations.length === 0) return;
    try {
      const bounds = L.latLngBounds(filteredStations.map((s) => [s.latitude, s.longitude]));
      map.fitBounds(bounds, { padding: [45, 45] });
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Controls & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stations by name, ID, code, or river reach..."
              aria-label="Search monitoring stations on map"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter map markers by status">
            {[
              { id: 'all', label: 'All Stations', count: stations.length },
              {
                id: 'normal',
                label: 'Normal',
                count: stations.filter((s) => s.overall_status === 'normal').length,
              },
              {
                id: 'warning',
                label: 'Warning',
                count: stations.filter((s) => s.overall_status === 'warning').length,
              },
              {
                id: 'critical',
                label: 'Critical',
                count: stations.filter((s) => s.overall_status === 'critical').length,
              },
              {
                id: 'offline',
                label: 'Offline',
                count: stations.filter((s) => s.overall_status === 'offline').length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  statusFilter === tab.id
                    ? 'bg-navy-800 text-white border-navy-800 dark:bg-sky-600 dark:border-sky-500'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DemoProvenanceBadge compact />
          <button
            type="button"
            onClick={handleFitAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Navigation className="w-3.5 h-3.5 text-sky-600" />
            <span>Fit Watershed</span>
          </button>
        </div>
      </div>

      {/* Main Map + Synchronized Station List & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Adjacent Synchronized Station List (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Station Directory ({filteredStations.length})
            </span>
            <span className="text-[11px] text-slate-500">Click to focus</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[560px]">
            {filteredStations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No stations match the active filter criteria.
              </div>
            ) : (
              filteredStations.map((st) => {
                const isSelected = selectedStation?.id === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectStation(st)}
                    className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-sky-50/90 dark:bg-sky-950/40 border-l-4 border-sky-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                        {st.id} ({st.code})
                      </span>
                      <StatusBadge status={st.overall_status} />
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {st.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {st.water_body}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>WQI: <strong>{st.wqi_score}</strong></span>
                      <span>{formatRelativeTime(st.last_seen_at)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Interactive Leaflet Map Canvas (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs overflow-hidden flex flex-col relative">
          {tileError && (
            <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-between">
              <span>
                Offline map tile fallback active — interactive station coordinates and telemetry markers remain operational.
              </span>
            </div>
          )}

          <div
            ref={mapContainerRef}
            className={`w-full ${heightClass} z-10 bg-slate-100 dark:bg-slate-800`}
            aria-label="Interactive OpenStreetMap monitoring stations map"
          />

          {/* Map Legend Bar */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Marker Legend:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Normal</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-amber-600 inline-block" />
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Warning</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                <OctagonAlert className="w-3 h-3 text-red-600" />
                <span>Critical</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-500 inline-block" />
                <WifiOff className="w-3 h-3 text-slate-500" />
                <span>Offline</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Fictional Demonstration Watershed Coordinates</span>
            </span>
          </div>
        </div>

        {/* Selected Station Telemetry Side Panel (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs p-5 flex flex-col justify-between space-y-4">
          {!selectedStation ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Select a monitoring station marker or list item to inspect live readings.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Header */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                      {selectedStation.id} • {selectedStation.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ConnectivityBadge status={selectedStation.connectivity_status} />
                      <StatusBadge status={selectedStation.overall_status} />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedStation.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{selectedStation.location_name}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>
                      Coords: {selectedStation.latitude.toFixed(4)}°N, {selectedStation.longitude.toFixed(4)}°E
                    </span>
                    {Boolean(selectedStation.is_fictional_location) && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-sans">
                        Fictional Demo Location
                      </span>
                    )}
                  </div>
                </div>

                {/* Active Alerts Summary Banner */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Water Quality Index</span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {selectedStation.wqi_score}
                      <span className="text-xs font-normal text-slate-500"> / 100</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">Active Station Alerts</span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        selectedStation.activeAlertsCount > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {selectedStation.activeAlertsCount}
                    </span>
                  </div>
                </div>

                {/* Latest Readings Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Latest Sensor Readings
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Updated: {formatLocalDateTime(selectedStation.last_seen_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {selectedStation.capabilities
                      .filter((c) => c.is_enabled)
                      .map((cap) => {
                        const reading = selectedStation.latestReadings[cap.parameter];
                        const meta = PARAMETER_METADATA[cap.parameter];
                        return (
                          <div
                            key={cap.parameter}
                            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                {meta?.shortName || cap.parameter}
                              </span>
                              <StatusBadge
                                status={
                                  selectedStation.connectivity_status === 'offline'
                                    ? 'offline'
                                    : reading?.quality_status || 'normal'
                                }
                              />
                            </div>
                            <div className="mt-1.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                              {reading ? `${reading.value} ${reading.unit}` : 'No reading'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectStationForDetails) {
                      onSelectStationForDetails(selectedStation);
                    } else {
                      navigate(`/stations?stationId=${encodeURIComponent(selectedStation.id)}`);
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                >
                  <span>Open Full Station Details</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/live?stationId=${encodeURIComponent(selectedStation.id)}`)
                  }
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Live Stream
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
