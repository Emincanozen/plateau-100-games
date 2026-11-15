import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palettes, space, radius, font, duration, type Palette, type ThemeName } from './tokens';
import { useSettings } from '@/engine/settings';

export interface Theme {
  name: ThemeName;
  c: Palette;
  space: typeof space;
  radius: typeof radius;
  font: typeof font;
  duration: typeof duration;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { settings } = useSettings();

  const name: ThemeName =
    settings.theme === 'system' ? (system === 'light' ? 'light' : 'dark') : settings.theme;

  const value = useMemo<Theme>(
    () => ({ name, c: palettes[name], space, radius, font, duration }),
    [name],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  return ctx;
}

/** Raccourci : uniquement la palette. */
export function useColors(): Palette {
  return useTheme().c;
}
