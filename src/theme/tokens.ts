/**
 * Jetons de design de Plateau.
 * Une seule source de vérité : aucune couleur ne doit être écrite en dur ailleurs.
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfacePressed: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  danger: string;
  warning: string;
  gold: string;
  shadow: string;
  scrim: string;
  /** Damier / plateaux de jeu */
  boardLight: string;
  boardDark: string;
  boardEdge: string;
  /** Tapis de cartes */
  felt: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#F4F4F7',
    bgElevated: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#ECECF2',
    surfacePressed: '#E2E2EA',
    border: '#E3E3EB',
    borderStrong: '#C9C9D6',
    text: '#111119',
    textDim: '#61616F',
    textFaint: '#9494A4',
    accent: '#5A56D6',
    accentSoft: '#E8E7FB',
    onAccent: '#FFFFFF',
    success: '#118A5C',
    danger: '#C93544',
    warning: '#B76E12',
    gold: '#C8901A',
    shadow: 'rgba(17, 17, 40, 0.10)',
    scrim: 'rgba(10, 10, 20, 0.45)',
    boardLight: '#EFE2CB',
    boardDark: '#B58863',
    boardEdge: '#8A6644',
    felt: '#1F7A52',
  },
  dark: {
    bg: '#0B0B11',
    bgElevated: '#13131B',
    surface: '#16161F',
    surfaceAlt: '#1F1F2A',
    surfacePressed: '#282835',
    border: '#282833',
    borderStrong: '#3A3A4A',
    text: '#F2F2F7',
    textDim: '#A2A2B4',
    textFaint: '#6D6D82',
    accent: '#8B7DFF',
    accentSoft: '#241F45',
    onAccent: '#0B0B11',
    success: '#3DD39A',
    danger: '#FF6B78',
    warning: '#E8A33D',
    gold: '#E3B341',
    shadow: 'rgba(0, 0, 0, 0.55)',
    scrim: 'rgba(0, 0, 0, 0.62)',
    boardLight: '#6E6455',
    boardDark: '#40382F',
    boardEdge: '#2A241D',
    felt: '#15503A',
  },
};

/** Échelle d'espacement (multiples de 4). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const font = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  h2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '500' as const },
  label: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.2 },
  mono: { fontSize: 16, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
} as const;

export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 380,
} as const;
