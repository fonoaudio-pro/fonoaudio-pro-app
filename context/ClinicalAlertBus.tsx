import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ClinicalAlert, ClinicalAlertFilter, matchesFilter, sortAlertsByPriority, AlertDisposition } from '../types/clinical_alert';
import { useSettings } from './SettingsContext';

const STORAGE_KEY = 'fonoaudio-alerts';
const SNOOZE_CHECK_INTERVAL_MS = 60_000;

interface ClinicalAlertMetrics {
  totalCreated: number;
  totalDeduplicated: number;
  byDisposition: Record<AlertDisposition, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  criticalVisible: number;
  criticalResolved: number;
  criticalResolutionRatio: number;
}

interface ClinicalAlertBusValue {
  alerts: ClinicalAlert[];
  addAlert: (alert: Omit<ClinicalAlert, 'id' | 'createdAt' | 'disposition'>) => void;
  dismissAlert: (id: string) => void;
  snoozeAlert: (id: string, hours: number) => void;
  applyAlert: (id: string) => void;
  ignoreAlert: (id: string) => void;
  getAlerts: (filter?: ClinicalAlertFilter) => ClinicalAlert[];
  getAlertCount: (filter?: ClinicalAlertFilter) => number;
  hasCritical: boolean;
  metrics: ClinicalAlertMetrics;
}

const ClinicalAlertBusContext = createContext<ClinicalAlertBusValue | null>(null);

let alertIdCounter = 0;
function generateAlertId(): string {
  return `alert_${Date.now()}_${++alertIdCounter}`;
}

function semanticKey(alert: Omit<ClinicalAlert, 'id' | 'createdAt' | 'disposition'>): string {
  return `${alert.patientId || '_all'}|${alert.category}|${alert.title}`;
}

function loadPersistedAlerts(): ClinicalAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a: any) => a && a.id && a.disposition);
  } catch {
    return [];
  }
}

function persistAlerts(alerts: ClinicalAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch { /* quota exceeded — silent */ }
}

export function ClinicalAlertBusProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>(loadPersistedAlerts);
  const { settings } = useSettings();
  const canAutoAlert = settings.assistant.permissions.canAutoAlert;
  const proactivity = settings.assistant.proactivity;
  const createdCountRef = useRef(0);
  const dedupCountRef = useRef(0);

  // Persist on every change
  useEffect(() => {
    persistAlerts(alerts);
  }, [alerts]);

  // Snooze reactivation check
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setAlerts(prev => prev.map(a => {
        if (a.disposition === 'snoozed' && a.snoozedUntil && new Date(a.snoozedUntil) <= now) {
          return { ...a, disposition: 'pending' as AlertDisposition, snoozedUntil: undefined };
        }
        return a;
      }));
    }, SNOOZE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const addAlert = useCallback((alert: Omit<ClinicalAlert, 'id' | 'createdAt' | 'disposition'>) => {
    if (!canAutoAlert) return;
    if (proactivity === 'minimal' && alert.category !== 'red_flag') return;

    setAlerts(prev => {
      // Semantic dedup: same patient + category + title = same alert
      const key = semanticKey(alert);
      const exists = prev.some(a => {
        const existingKey = semanticKey(a);
        return existingKey === key && (a.disposition === 'pending' || a.disposition === 'snoozed');
      });
      if (exists) {
        dedupCountRef.current++;
        return prev;
      }

      createdCountRef.current++;
      const newAlert: ClinicalAlert = {
        ...alert,
        id: generateAlertId(),
        createdAt: new Date().toISOString(),
        disposition: 'pending',
      };
      return sortAlertsByPriority([newAlert, ...prev]);
    });
  }, [canAutoAlert, proactivity]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id !== id) return a;
      // Never fully discard a red_flag — only dismiss from view
      if (a.category === 'red_flag') {
        return { ...a, disposition: 'dismissed' as AlertDisposition };
      }
      return { ...a, disposition: 'dismissed' as AlertDisposition };
    }));
  }, []);

  const snoozeAlert = useCallback((id: string, hours: number) => {
    const until = new Date(Date.now() + hours * 3600000).toISOString();
    setAlerts(prev => prev.map(a => {
      if (a.id !== id) return a;
      // Red flags cannot be snoozed — they require immediate action
      if (a.category === 'red_flag' && a.severity === 'critical') return a;
      return { ...a, disposition: 'snoozed' as AlertDisposition, snoozedUntil: until };
    }));
  }, []);

  const applyAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, disposition: 'applied' as AlertDisposition } : a));
  }, []);

  const ignoreAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id !== id) return a;
      // Critical red flags cannot be ignored
      if (a.category === 'red_flag' && a.severity === 'critical') return a;
      return { ...a, disposition: 'ignored' as AlertDisposition };
    }));
  }, []);

  const getAlerts = useCallback((filter?: ClinicalAlertFilter): ClinicalAlert[] => {
    const now = new Date();
    const visible = alerts.filter(a => {
      if (a.disposition === 'snoozed' && a.snoozedUntil) {
        return new Date(a.snoozedUntil) <= now;
      }
      return a.disposition === 'pending';
    });
    if (!filter) return sortAlertsByPriority(visible);
    return sortAlertsByPriority(visible.filter(a => matchesFilter(a, filter)));
  }, [alerts]);

  const getAlertCount = useCallback((filter?: ClinicalAlertFilter): number => {
    return getAlerts(filter).length;
  }, [getAlerts]);

  const hasCritical = useMemo(() => {
    return alerts.some(a => a.severity === 'critical' && a.disposition === 'pending');
  }, [alerts]);

  const metrics = useMemo((): ClinicalAlertMetrics => {
    const byDisposition = { pending: 0, applied: 0, snoozed: 0, ignored: 0, dismissed: 0 };
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let criticalVisible = 0;
    let criticalResolved = 0;

    for (const a of alerts) {
      byDisposition[a.disposition]++;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      bySource[a.source] = (bySource[a.source] || 0) + 1;
      if (a.severity === 'critical') {
        if (a.disposition === 'pending') criticalVisible++;
        else if (['applied', 'dismissed', 'ignored'].includes(a.disposition)) criticalResolved++;
      }
    }

    return {
      totalCreated: createdCountRef.current,
      totalDeduplicated: dedupCountRef.current,
      byDisposition,
      bySeverity,
      byCategory,
      bySource,
      criticalVisible,
      criticalResolved,
      criticalResolutionRatio: criticalVisible + criticalResolved > 0
        ? criticalResolved / (criticalVisible + criticalResolved)
        : 0,
    };
  }, [alerts]);

  return (
    <ClinicalAlertBusContext.Provider value={{
      alerts, addAlert, dismissAlert, snoozeAlert, applyAlert, ignoreAlert,
      getAlerts, getAlertCount, hasCritical, metrics,
    }}>
      {children}
    </ClinicalAlertBusContext.Provider>
  );
}

export function useClinicalAlerts(): ClinicalAlertBusValue {
  const ctx = useContext(ClinicalAlertBusContext);
  if (!ctx) throw new Error('useClinicalAlerts must be used within ClinicalAlertBusProvider');
  return ctx;
}
