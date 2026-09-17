import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadJSON, saveJSON } from './storage';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  haptics: boolean;
  sound: boolean;
  reduceMotion: boolean;
  /** Affiche les règles automatiquement à la première partie d'un jeu. */
  autoRules: boolean;
}

const DEFAULTS: Settings = {
  theme: 'system',
  haptics: true,
  sound: true,
  reduceMotion: false,
  autoRules: true,
};

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const Ctx = createContext<SettingsCtx>({ settings: DEFAULTS, ready: false, set: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadJSON<Partial<Settings>>('settings', {}).then((stored) => {
      if (!alive) return;
      setSettings({ ...DEFAULTS, ...stored });
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const set = useCallback<SettingsCtx['set']>((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      void saveJSON('settings', next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, set }), [settings, ready, set]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}
