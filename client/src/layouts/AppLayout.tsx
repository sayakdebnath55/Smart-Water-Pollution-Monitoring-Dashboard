import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Radio,
  MapPin,
  ShieldAlert,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  Play,
  Pause,
  Droplets,
  UserCheck,
  ChevronRight,
  CheckCheck,
  Sparkles,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { StatusBadge } from '../components/StatusBadge';
import { AlertDetailModal } from '../components/AlertDetailModal';
import { formatLocalDateTime, formatRelativeTime } from '../utils/formatters';
import { api } from '../services/api';

interface NavItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  badgeCount?: number;
}

export const AppLayout: React.FC = () => {
  const {
    summary,
    user,
    theme,
    toggleTheme,
    switchRole,
    loginWithCredentials,
    isSimulationRunning,
    toggleSimulation,
    refreshGlobalData,
    openAlertModal,
    toasts,
    dismissToast,
  } = useAppContext();

  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('admin@aquaguard.local');
  const [loginPassword, setLoginPassword] = useState('AdminDemo2026!');
  const [loginError, setLoginError] = useState<string | null>(null);

  const activeAlertsCount =
    (summary?.kpis?.criticalActiveAlerts || 0) + (summary?.kpis?.warningActiveAlerts || 0);
  const unreadCount = summary?.kpis?.unreadAlertsCount || 0;

  const navItems: NavItem[] = [
    { label: 'Overview', path: '/', icon: LayoutDashboard },
    { label: 'Live Monitoring', path: '/live', icon: Activity },
    { label: 'Monitoring Stations', path: '/stations', icon: Radio },
    { label: 'Interactive Map', path: '/map', icon: MapPin },
    {
      label: 'Pollution Alerts',
      path: '/alerts',
      icon: ShieldAlert,
      badgeCount: activeAlertsCount > 0 ? activeAlertsCount : undefined,
    },
    { label: 'Analytics & Trends', path: '/analytics', icon: BarChart3 },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const getPageMeta = () => {
    const p = location.pathname;
    if (p === '/') return { title: 'Watershed Overview', crumb: 'Executive Summary & Telemetry' };
    if (p.startsWith('/live')) return { title: 'Live Water-Quality Monitoring', crumb: 'Near-Real-Time Sonde Stream' };
    if (p.startsWith('/stations')) return { title: 'Monitoring Stations', crumb: 'Station Registry & Sensor Capabilities' };
    if (p.startsWith('/map')) return { title: 'Interactive Monitoring Map', crumb: 'Geospatial Watershed View' };
    if (p.startsWith('/alerts')) return { title: 'Pollution Alerts Management', crumb: 'Threshold Violations & Incident Log' };
    if (p.startsWith('/analytics')) return { title: 'Analytics & Historical Trends', crumb: 'Statistical Distributions & Comparisons' };
    if (p.startsWith('/reports')) return { title: 'Monitoring Reports & Exports', crumb: 'Compliance Summaries, CSV & PDF' };
    if (p.startsWith('/settings')) return { title: 'Thresholds & System Settings', crumb: 'Rules, Simulation & IoT Readiness' };
    return { title: 'AquaGuard Console', crumb: 'Dashboard' };
  };

  const pageMeta = getPageMeta();

  const handleMarkAllRead = async () => {
    await api.markAllAlertsRead();
    await refreshGlobalData();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await loginWithCredentials(loginEmail, loginPassword);
      setLoginModalOpen(false);
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-navy-900 text-slate-100 border-r border-navy-800 transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800/80 bg-navy-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-md shrink-0">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  <span>AquaGuard</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  Intelligent Water Quality Monitoring
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-navy-800"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-navy-800/80 hover:text-white'
                  }`
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!sidebarCollapsed && item.badgeCount !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                    {item.badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer: Demo Provenance & Collapse Button */}
        <div className="p-3 border-t border-navy-800/80 bg-navy-950/30 space-y-2">
          {!sidebarCollapsed && (
            <div className="p-2.5 rounded-lg bg-navy-800/70 border border-navy-700 text-xs text-slate-300">
              <div className="flex items-center justify-between font-semibold text-sky-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>DEMO TELEMETRY</span>
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSimulationRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Simulated sensor stream active ({isSimulationRunning ? '5s cycle' : 'Paused'}). Ready for HTTP/MQTT IoT ingest.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden lg:flex w-full items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-navy-800 transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-navy-800 dark:text-sky-400">AquaGuard</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{pageMeta.crumb}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {pageMeta.title}
              </h1>
            </div>
          </div>

          {/* Right Topbar Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Demo Mode Indicator & Quick Simulation Toggle */}
            <div className="hidden md:flex items-center gap-2 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 px-2.5 py-1 rounded-full">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSimulationRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                DEMO MODE: {isSimulationRunning ? 'LIVE SIM' : 'PAUSED'}
              </span>
              <button
                type="button"
                onClick={toggleSimulation}
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                title={isSimulationRunning ? 'Pause 5-second demo simulation' : 'Resume demo simulation'}
              >
                {isSimulationRunning ? (
                  <>
                    <Pause className="w-3 h-3 text-amber-600" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-emerald-600" />
                    <span>Resume</span>
                  </>
                )}
              </button>
            </div>

            {/* Last Data Update Timestamp */}
            <div className="hidden xl:flex flex-col items-end text-right px-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Last Data Update
              </span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                {summary?.kpis?.lastDataUpdate
                  ? formatRelativeTime(summary.kpis.lastDataUpdate)
                  : 'Syncing...'}
              </span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifDropdownOpen((v) => !v);
                  setProfileDropdownOpen(false);
                }}
                className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                aria-label={`Notifications (${unreadCount} unread)`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Pollution Alert Notifications
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {unreadCount} unread • {activeAlertsCount} active
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {(summary?.recentAlerts || []).length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No recent alerts recorded.
                      </div>
                    ) : (
                      (summary?.recentAlerts || []).slice(0, 6).map((al) => (
                        <button
                          key={al.id}
                          type="button"
                          onClick={() => {
                            setNotifDropdownOpen(false);
                            openAlertModal(al.id);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start justify-between gap-2 ${
                            !al.is_read && !al.resolved ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <StatusBadge status={al.severity} />
                              <span className="text-[11px] font-mono text-slate-500">
                                {al.station_id}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {al.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatLocalDateTime(al.created_at)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifDropdownOpen(false);
                        navigate('/alerts');
                      }}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                    >
                      View All Pollution Alerts →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* User Profile & Role Switcher Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileDropdownOpen((v) => !v);
                  setNotifDropdownOpen(false);
                }}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                aria-label="User Profile and Access Role Menu"
              >
                <div className="w-6 h-6 rounded-full bg-navy-800 text-white flex items-center justify-center font-bold text-[11px]">
                  {user.role === 'admin' ? 'AD' : 'OP'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="font-semibold text-slate-900 dark:text-white leading-none">
                    {user.role === 'admin' ? 'Administrator' : 'Operator'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[110px]">
                    {user.username}
                  </div>
                </div>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xl z-50 p-4 space-y-3">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {user.fullName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    <span className="mt-1.5 inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">
                      Role: {user.role}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Quick Demo Role Switcher
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        switchRole('admin');
                        setProfileDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border ${
                        user.role === 'admin'
                          ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/60 dark:border-sky-700 dark:text-sky-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>Administrator (Full CRUD)</span>
                      {user.role === 'admin' && <UserCheck className="w-4 h-4 text-sky-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        switchRole('operator');
                        setProfileDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border ${
                        user.role === 'operator'
                          ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/60 dark:border-sky-700 dark:text-sky-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>Operator (Monitor & Alerts)</span>
                      {user.role === 'operator' && <UserCheck className="w-4 h-4 text-sky-600" />}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setLoginModalOpen(true);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In with Credentials</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>AquaGuard</strong> — Smart Water Pollution Monitoring Dashboard • Built for Environmental Telemetry & Demonstration
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono">DEMO DATA DISCLOSURE: Simulated Telemetry Active</span>
          </div>
        </footer>
      </div>

      {/* Global Alert Inspection Modal */}
      <AlertDetailModal />

      {/* Credential Login Modal */}
      {loginModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                AquaGuard Operator Authentication
              </h2>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authenticate using local demonstration accounts verified via server-side scrypt password hashes.
            </p>

            {loginError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                <div className="font-semibold">Demo Credentials (Click to autofill):</div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('admin@aquaguard.local');
                    setLoginPassword('AdminDemo2026!');
                  }}
                  className="block text-sky-600 hover:underline font-mono"
                >
                  Admin: admin@aquaguard.local / AdminDemo2026!
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('operator@aquaguard.local');
                    setLoginPassword('OperatorDemo2026!');
                  }}
                  className="block text-sky-600 hover:underline font-mono"
                >
                  Operator: operator@aquaguard.local / OperatorDemo2026!
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Stack */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl shadow-lg border text-xs transition-all ${
              t.type === 'critical'
                ? 'bg-red-950 text-white border-red-700'
                : t.type === 'warning'
                  ? 'bg-amber-950 text-white border-amber-700'
                  : t.type === 'success'
                    ? 'bg-emerald-950 text-white border-emerald-700'
                    : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div className="min-w-0">
              <div className="font-bold">{t.title}</div>
              <p className="text-slate-200 mt-0.5 leading-snug">{t.message}</p>
              {t.alertId && (
                <button
                  type="button"
                  onClick={() => {
                    openAlertModal(t.alertId!);
                    dismissToast(t.id);
                  }}
                  className="mt-1.5 inline-block font-semibold underline text-sky-300 hover:text-white"
                >
                  Inspect Alert Details →
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-white shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
