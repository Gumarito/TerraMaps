/**
 * TerraMaps — Billing Service (Stripe Checkout + Customer Portal)
 *
 * Toda operación sensible ocurre en la Edge Function `billing` (clave secreta de Stripe
 * jamás llega al cliente). Aquí solo se solicita la sesión y se redirige al usuario.
 *
 * Plataformas: en iOS/Android la venta de contenido digital debe pasar por la tienda
 * (App Store 3.1.1 / Google Play Billing). Por eso Checkout solo se habilita en web, salvo
 * que se active explícitamente EXPO_PUBLIC_ENABLE_NATIVE_STRIPE_CHECKOUT=true para mercados
 * donde esté permitido. Los derechos adquiridos en web se respetan en todas las plataformas.
 */

import { Linking, Platform } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';
import { analyticsDatabaseService } from '../analyticsDatabaseService';
import { entitlementService } from './entitlementService';
import { ANALYTICS_TIER_BY_PLAN, formatPrice, type CatalogPrice, type PlanKey } from './plans';

export type BillingErrorCode =
  | 'NOT_CONFIGURED'
  | 'PLATFORM_UNSUPPORTED'
  | 'AUTH_REQUIRED'
  | 'ALREADY_SUBSCRIBED'
  | 'ALREADY_PURCHASED'
  | 'NO_BILLING_ACCOUNT'
  | 'NETWORK'
  | 'UNKNOWN';

export type BillingResult = { ok: true } | { ok: false; code: BillingErrorCode; message: string };

export type CheckoutReturn = { status: 'success' | 'cancel'; plan: PlanKey | null };

const NATIVE_CHECKOUT_ENABLED = process.env.EXPO_PUBLIC_ENABLE_NATIVE_STRIPE_CHECKOUT === 'true';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || '';
const CATALOG_TTL_MS = 10 * 60 * 1000;
const PLAN_KEYS: readonly PlanKey[] = ['pro_monthly', 'pro_annual', 'timeline_lifetime'];

function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && (PLAN_KEYS as readonly string[]).includes(value);
}

async function toBillingError(error: unknown): Promise<{ code: BillingErrorCode; message: string }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await (error.context as Response).json();
      const code = body?.error?.code as BillingErrorCode | undefined;
      const message = typeof body?.error?.message === 'string' ? body.error.message : 'No fue posible completar la operación.';
      return { code: code ?? 'UNKNOWN', message };
    } catch {
      return { code: 'UNKNOWN', message: 'No fue posible completar la operación.' };
    }
  }
  return { code: 'NETWORK', message: 'Sin conexión con el servidor de pagos. Revisa tu red e inténtalo de nuevo.' };
}

class BillingService {
  private catalog: { at: number; prices: Partial<Record<PlanKey, CatalogPrice>> } | null = null;

  /** Indica si en esta plataforma/entorno se puede iniciar un pago. */
  public getAvailability(): BillingResult {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'Los pagos no están disponibles en este entorno.' };
    }
    if (Platform.OS !== 'web' && !NATIVE_CHECKOUT_ENABLED) {
      return {
        ok: false,
        code: 'PLATFORM_UNSUPPORTED',
        message: 'Las compras no están disponibles en esta versión de la app. Si ya eres PRO, tu acceso se sincroniza con tu cuenta.',
      };
    }
    return { ok: true };
  }

  public async getCatalog(): Promise<Partial<Record<PlanKey, CatalogPrice>>> {
    if (this.catalog && Date.now() - this.catalog.at < CATALOG_TTL_MS) return this.catalog.prices;
    if (!isSupabaseConfigured()) return {};

    const { data, error } = await supabase.functions.invoke('billing/catalog', { method: 'GET' });
    if (error || !Array.isArray(data?.prices)) return this.catalog?.prices ?? {};

    const prices: Partial<Record<PlanKey, CatalogPrice>> = {};
    for (const entry of data.prices as Array<Record<string, unknown>>) {
      const plan = entry?.plan;
      if (!isPlanKey(plan) || typeof entry.amount !== 'number' || typeof entry.currency !== 'string') continue;
      prices[plan] = {
        plan,
        amount: entry.amount,
        currency: entry.currency,
        interval: entry.interval === 'month' || entry.interval === 'year' ? entry.interval : null,
        formatted: formatPrice(entry.amount, entry.currency),
      };
    }
    this.catalog = { at: Date.now(), prices };
    return prices;
  }

  /** Crea la Checkout Session en el servidor y redirige a Stripe. */
  public async startCheckout(plan: PlanKey): Promise<BillingResult> {
    const availability = this.getAvailability();
    if (!availability.ok) return availability;

    const snapshot = await entitlementService.refresh();
    if (!snapshot.canTransact) {
      return { ok: false, code: 'AUTH_REQUIRED', message: 'Necesitas conexión y una sesión activa para comprar.' };
    }

    const tierId = ANALYTICS_TIER_BY_PLAN[plan];
    analyticsDatabaseService.recordMonetizationEvent({ eventName: 'CHECKOUT_START', tierId }).catch(() => {});

    const { data, error } = await supabase.functions.invoke('billing/checkout', {
      body: { plan, returnUrl: this.getReturnUrl() },
    });

    if (error || typeof data?.url !== 'string') {
      const failure = error ? await toBillingError(error) : { code: 'UNKNOWN' as const, message: 'Respuesta inesperada del servidor de pagos.' };
      analyticsDatabaseService
        .recordMonetizationEvent({ eventName: 'PAYMENT_FAILURE', tierId, errorCode: failure.code })
        .catch(() => {});
      return { ok: false, ...failure };
    }

    await this.redirect(data.url);
    return { ok: true };
  }

  /** Abre el Customer Portal de Stripe (cambiar plan, método de pago, cancelar, facturas). */
  public async openCustomerPortal(): Promise<BillingResult> {
    if (!isSupabaseConfigured()) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'Los pagos no están disponibles en este entorno.' };
    }
    const { data, error } = await supabase.functions.invoke('billing/portal', {
      body: { returnUrl: this.getReturnUrl() },
    });
    if (error || typeof data?.url !== 'string') {
      return { ok: false, ...(error ? await toBillingError(error) : { code: 'UNKNOWN' as const, message: 'No fue posible abrir el portal.' }) };
    }
    await this.redirect(data.url);
    return { ok: true };
  }

  /**
   * Lee y limpia los parámetros `?checkout=` que Stripe añade al volver a la app (web).
   * Debe llamarse una sola vez al montar la app.
   */
  public consumeCheckoutReturn(): CheckoutReturn | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('checkout');
    if (status !== 'success' && status !== 'cancel') return null;

    const planParam = url.searchParams.get('plan');
    ['checkout', 'plan', 'session_id'].forEach((p) => url.searchParams.delete(p));
    window.history.replaceState(window.history.state, '', url.toString());

    return { status, plan: isPlanKey(planParam) ? planParam : null };
  }

  private getReturnUrl(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}`;
    }
    return APP_URL;
  }

  private async redirect(url: string): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(url);
      return;
    }
    await Linking.openURL(url);
  }
}

export const billingService = new BillingService();
