import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './hooks/useAppContext';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { StationsPage } from './pages/StationsPage';
import { MapPage } from './pages/MapPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const basename = window.location.pathname.startsWith(
    '/Smart-Water-Pollution-Monitoring-Dashboard'
  )
    ? '/Smart-Water-Pollution-Monitoring-Dashboard'
    : '/';

  return (
    <AppProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="live" element={<LiveMonitoringPage />} />
            <Route path="stations" element={<StationsPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
