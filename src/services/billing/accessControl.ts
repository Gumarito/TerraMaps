/**
 * TerraMaps — Control de acceso a capas y estilos prémium del mapa.
 *
 * Punto único de decisión para la UI y el render del mapa. Combina:
 *  - Terra PRO (entitlement verificado por servidor)
 *  - Desbloqueo temporal por anuncio recompensado (24 h, solo skins)
 *  - Desbloqueo por progreso de exploración (skins "progress")
 */

import { MAP_THEMES, FOG_STYLE_PRESETS, type FogVisualMode } from '@/core/theme/mapThemes';
import { adService } from '../adService';
import { monetizationService } from '../monetizationService';
import { entitlementService } from './entitlementService';
import type { PremiumFeature } from './plans';

export type LockReason = 'pro' | 'progress' | null;

export function hasFeature(feature: PremiumFeature): boolean {
  return entitlementService.has(feature);
}

/** Motivo por el que un tema está bloqueado, o null si es utilizable. */
export function getThemeLockReason(themeId: string): LockReason {
  const theme = MAP_THEMES[themeId];
  if (!theme || theme.access === 'free') return null;
  if (__DEV__) return null; // En desarrollo todas las skins se pueden probar sin restricciones.
  if (hasFeature('premium_skins') || adService.getAreThemesUnlockedByAd()) return null;
  if (theme.access === 'progress') return monetizationService.isSkinUnlocked(themeId) ? null : 'progress';
  return 'pro';
}

export function canUseTheme(themeId: string): boolean {
  return getThemeLockReason(themeId) === null;
}

/** Devuelve el tema solicitado si está permitido; si no (p. ej. PRO expiró), el de respaldo. */
export function resolveAccessibleThemeId(requestedId: string, fallbackId: string): string {
  return MAP_THEMES[requestedId] && canUseTheme(requestedId) ? requestedId : fallbackId;
}

export function canUseFogMode(mode: FogVisualMode): boolean {
  const preset = FOG_STYLE_PRESETS[mode];
  return !!preset && (!preset.isPremium || hasFeature('premium_fog_modes'));
}

export function resolveAccessibleFogMode(mode: FogVisualMode, fallback: FogVisualMode = 'translucent'): FogVisualMode {
  return canUseFogMode(mode) ? mode : fallback;
}

/** Siguiente modo de niebla disponible en el ciclo, omitiendo los bloqueados. */
export function nextAccessibleFogMode(current: FogVisualMode, order: readonly FogVisualMode[]): FogVisualMode {
  const start = Math.max(0, order.indexOf(current));
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step) % order.length];
    if (canUseFogMode(candidate)) return candidate;
  }
  return current;
}
