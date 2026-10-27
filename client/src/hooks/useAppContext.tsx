import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  AlertItem,
  DashboardSummaryResponse,
  ParameterCode,
  UserSession,
} from '../types/index';
import { api } from '../services/api';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  alertId?: string;
}

interface AppContextValue {
  summary: DashboardSummaryResponse | null;
  loadingSummary: boolean;
  errorSummary: string | null;
  user: UserSession;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  switchRole: (role: 'admin' | 'operator') => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<void>;
  isSimulationRunning: boolean;
  toggleSimulation: () => Promise<void>;
  triggerSimulationStep: (options?: {
    forceAnomaly?: boolean;
    stationId?: string;
    parameter?: ParameterCode;
  }) => Promise<void>;
  refreshGlobalData: () => Promise<void>;
  selectedAlertId: string | null;
  openAlertModal: (alertId: string) => void;
  closeAlertModal: () => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_ADMIN_USER: UserSession = {
  userId: 1,
  username: 'admin',
  email: 'admin@aquaguard.local',
  fullName: 'Dr. Elena Vance (Lead Hydrologist / Admin)',
  role: 'admin',
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  const [user, setUser] = useState<UserSession>(() => {
    try {
      const savedUser = localStorage.getItem('aquaguard_user');
      if (savedUser) return JSON.parse(savedUser);
    } catch {
      // ignore
    }
    return DEFAULT_ADMIN_USER;
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('aquaguard_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const seenCriticalAlertIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('aquaguard_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshGlobalData = useCallback(async () => {
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
      setErrorSummary(null);

      // Track critical alerts and show toast for any brand-new critical demo alerts after initial load
      const currentCriticals = (data.recentAlerts || []).filter(
        (a: AlertItem) => a.severity === 'critical' && !a.resolved
      );

      if (!initialLoadDoneRef.current) {
        currentCriticals.forEach((a) => seenCriticalAlertIdsRef.current.add(a.id));
        if (data.simulation?.recentNewAlerts) {
          data.simulation.recentNewAlerts.forEach((a) => seenCriticalAlertIdsRef.current.add(a.id));
        }
        initialLoadDoneRef.current = true;
      } else {
        for (const alert of currentCriticals) {
          if (!seenCriticalAlertIdsRef.current.has(alert.id)) {
            seenCriticalAlertIdsRef.current.add(alert.id);
            addToast({
              type: 'critical',
              title: 'New Critical Demo Alert',
              message: `${alert.title} (${alert.measured_value ?? ''} ${alert.unit})`,
              alertId: alert.id,
            });
          }
        }
      }
    } catch (err: any) {
      setErrorSummary(err?.message || 'Unable to reach AquaGuard backend server.');
    } finally {
      setLoadingSummary(false);
    }
  }, [addToast]);

  useEffect(() => {
    refreshGlobalData();
  }, [refreshGlobalData]);

  // Poll every 5 seconds while simulation is active
  const isSimulationRunning = summary?.simulation?.isRunning ?? true;
  useEffect(() => {
    if (!isSimulationRunning) return;
    const interval = setInterval(() => {
      refreshGlobalData();
    }, 5000);
    return () => clearInterval(interval);
  }, [isSimulationRunning, refreshGlobalData]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const switchRole = useCallback(
    async (role: 'admin' | 'operator') => {
      const res = await api.switchDemoRole(role);
      setUser(res.user);
      try {
        localStorage.setItem('aquaguard_user', JSON.stringify(res.user));
        localStorage.setItem('aquaguard_auth_token', res.token);
        localStorage.setItem('aquaguard_demo_role', res.user.role);
      } catch {
        // ignore
      }
      addToast({
        type: 'info',
        title: `Switched Role to ${res.user.role === 'admin' ? 'Administrator' : 'Operator'}`,
        message: `Active user: ${res.user.fullName}`,
      });
    },
    [addToast]
  );

  const loginWithCredentials = useCallback(
    async (identifier: string, password: string) => {
      const res = await api.login(identifier, password);
      setUser(res.user);
      try {
        localStorage.setItem('aquaguard_user', JSON.stringify(res.user));
        localStorage.setItem('aquaguard_auth_token', res.token);
        localStorage.setItem('aquaguard_demo_role', res.user.role);
      } catch {
        // ignore
      }
      addToast({
        type: 'success',
        title: 'Signed In Successfully',
        message: `Authenticated as ${res.user.fullName} (${res.user.role.toUpperCase()})`,
      });
    },
    [addToast]
  );

  const toggleSimulation = useCallback(async () => {
    try {
      const nextState = !isSimulationRunning;
      await api.toggleSimulation(nextState);
      await refreshGlobalData();
      addToast({
        type: 'info',
        title: nextState ? 'Demo Simulation Resumed' : 'Demo Simulation Paused',
        message: nextState
          ? 'Near-real-time synthetic sensor readings are updating every 5 seconds.'
          : 'Automatic demo sensor updates are paused.',
      });
    } catch (err: any) {
      addToast({
        type: 'warning',
        title: 'Simulation Toggle Failed',
        message: err?.message || 'Could not update simulation state.',
      });
    }
  }, [isSimulationRunning, refreshGlobalData, addToast]);

  const triggerSimulationStep = useCallback(
    async (options?: {
      forceAnomaly?: boolean;
      stationId?: string;
      parameter?: ParameterCode;
    }) => {
      try {
        const res = await api.stepSimulation(options);
        await refreshGlobalData();
        if (res.newAlerts && res.newAlerts.length > 0) {
          const first = res.newAlerts[0];
          seenCriticalAlertIdsRef.current.add(first.id);
          addToast({
            type: first.severity === 'critical' ? 'critical' : 'warning',
            title: `${first.severity.toUpperCase()} Alert Triggered`,
            message: first.title,
            alertId: first.id,
          });
        } else {
          addToast({
            type: 'success',
            title: 'Telemetry Readings Updated',
            message: `Generated ${res.generatedReadingsCount} new simulated sensor measurements.`,
          });
        }
      } catch (err: any) {
        addToast({
          type: 'warning',
          title: 'Refresh Failed',
          message: err?.message || 'Could not generate simulation step.',
        });
      }
    },
    [refreshGlobalData, addToast]
  );

  const openAlertModal = useCallback((alertId: string) => {
    setSelectedAlertId(alertId);
  }, []);

  const closeAlertModal = useCallback(() => {
    setSelectedAlertId(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        summary,
        loadingSummary,
        errorSummary,
        user,
        theme,
        toggleTheme,
        switchRole,
        loginWithCredentials,
        isSimulationRunning,
        toggleSimulation,
        triggerSimulationStep,
        refreshGlobalData,
        selectedAlertId,
        openAlertModal,
        closeAlertModal,
        toasts,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return ctx;
}
