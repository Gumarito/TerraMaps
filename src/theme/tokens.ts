/**
 * Tokens de diseño "Obsidian & Titanium".
 * Escala de espaciado de 4px, radios homogéneos, tipografía y colores sobrios.
 */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  caption: 10,
  small: 12,
  body: 14,
  title: 16,
  display: 20,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '800',
} as const;

export const colors = {
  obsidian: '#0b0f19',
  obsidianRaised: 'rgba(15, 23, 42, 0.6)',
  titanium: '#94a3b8',
  titaniumDim: '#64748b',
  textPrimary: '#ffffff',
  hairline: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.15)',
  backdrop: 'rgba(5, 8, 15, 0.85)',
  accent: '#00f5d4',
  ember: '#f97316',
  gold: '#eab308',
  danger: '#f87171',
} as const;

export const size = {
  /** Botón circular flotante (FAB / iconos HUD). */
  fab: 42,
  fabIcon: 20,
  hudIcon: 36,
} as const;
