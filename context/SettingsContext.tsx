import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../types/settings';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SettingsContextValue {
  settings: UserSettings;
  update: <K extends keyof UserSettings>(section: K, value: Partial<UserSettings[K]>) => void;
  set: (s: UserSettings) => void;
  status: SaveStatus;
  lastSaved: Date | null;
}

const STORAGE_KEY = 'fonoaudio-settings';
const SAVE_DELAY_MS = 800;

function deepMerge<T>(base: T, partial: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(partial) as (keyof T)[]) {
    const val = partial[key];
    if (val === undefined) continue;
    if (
      typeof val === 'object' && val !== null && !Array.isArray(val) &&
      typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])
    ) {
      (result as any)[key] = deepMerge(base[key], val as any);
    } else {
      (result as any)[key] = val;
    }
  }
  return result;
}

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_SETTINGS };
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_USER_SETTINGS, parsed);
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

function persistSettings(s: UserSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(<K extends keyof UserSettings>(section: K, value: Partial<UserSettings[K]>) => {
    setSettings(prev => deepMerge(prev, { [section]: value } as any));
  }, []);

  const set = useCallback((s: UserSettings) => {
    setSettings(s);
  }, []);

  // Auto-persist on change with debounce
  useEffect(() => {
    if (saveTimer) clearTimeout(saveTimer);
    setStatus('saving');
    const timer = setTimeout(() => {
      const ok = persistSettings(settings);
      setStatus(ok ? 'saved' : 'error');
      if (ok) setLastSaved(new Date());
      setTimeout(() => setStatus('idle'), 2000);
    }, SAVE_DELAY_MS);
    setSaveTimer(timer);
    return () => clearTimeout(timer);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, update, set, status, lastSaved }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
