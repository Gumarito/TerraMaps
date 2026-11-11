/**
 * TerraMaps — Catálogo de planes y funciones prémium (solo presentación).
 *
 * Los precios autoritativos viven en Stripe y se leen desde `billing/catalog`;
 * el cliente únicamente envía la clave del plan al iniciar el pago.
 */

export type PlanKey = 'pro_monthly' | 'pro_annual' | 'timeline_lifetime';
export type SubscriptionPlanKey = Exclude<PlanKey, 'timeline_lifetime'>;

/** Funciones del producto sujetas a control de acceso. */
export type PremiumFeature =
  | 'premium_skins'      // Skins de mapa exclusivas
  | 'premium_fog_modes'  // Modos de niebla avanzados (Neblina Real, Borroso)
  | 'extended_radar'     // Radar de dron K-Ring 3 (~550 m)
  | 'unlimited_drones'   // Drones sin enfriamiento
  | 'timeline_restore';  // Restaurar historial de Google Maps (compra única)

/** Funciones incluidas en la suscripción Terra PRO. */
export const PRO_FEATURES: readonly PremiumFeature[] = [
  'premium_skins',
  'premium_fog_modes',
  'extended_radar',
  'unlimited_drones',
];

export const PRO_FEATURE_COPY: ReadonlyArray<{ feature: PremiumFeature; title: string; description: string }> = [
  {
    feature: 'premium_skins',
    title: 'Skins exclusivas del mapa',
    description: 'Acceso permanente a todos los estilos cartográficos prémium.',
  },
  {
    feature: 'premium_fog_modes',
    title: 'Niebla avanzada',
    description: 'Modos Neblina Real y Borroso con difuminado volumétrico.',
  },
  {
    feature: 'extended_radar',
    title: 'Radar extendido',
    description: 'Pulso de dron de ~550 m frente a los 300 m estándar.',
  },
  {
    feature: 'unlimited_drones',
    title: 'Drones sin espera',
    description: 'Despliega drones de exploración sin enfriamiento de 4 horas.',
  },
];

export const ANALYTICS_TIER_BY_PLAN: Record<PlanKey, 'PRO_MONTHLY' | 'PRO_ANNUAL' | 'TIMELINE_RESTORE_LIFETIME'> = {
  pro_monthly: 'PRO_MONTHLY',
  pro_annual: 'PRO_ANNUAL',
  timeline_lifetime: 'TIMELINE_RESTORE_LIFETIME',
};

export interface CatalogPrice {
  plan: PlanKey;
  amount: number;
  currency: string;
  interval: 'month' | 'year' | null;
  /** Precio formateado para la UI, p. ej. "$1.99". */
  formatted: string;
}

export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}
