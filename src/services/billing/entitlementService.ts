/**
 * TerraMaps — Entitlement Service
 *
 * Fuente única de verdad en el cliente sobre qué puede usar el usuario.
 * - Lee los derechos desde Supabase (`get_my_entitlements`), alimentado por el webhook de Stripe.
 * - Cachea el último snapshot verificado para funcionar sin conexión, con límites estrictos:
 *   PRO solo se respeta offline hasta `current_period_end + 3 días` y si se verificó hace < 7 días.
 * - Se revalida al iniciar sesión, al cambiar de usuario y al volver la app a primer plano.
 *
 * Nota: el estado local nunca concede acceso por sí mismo; solo replica lo que confirmó el servidor.
 */

import { AppState, type AppStateStatus } from 'react-native';
import { supabase, isSupabaseConfigured } from '../supabase';
import { storageService } from '../storage';
import { authService } from '../authService';
import { safeJsonParse } from '@/core/security';
import { PRO_FEATURES, type PremiumFeature, type SubscriptionPlanKey } from './plans';

const CACHE_KEY = '@terramaps_entitlements_v1';
const LEGACY_LOCAL_PRO_KEYS = ['@terramaps_terra_pro_active', '@terramaps_terra_pro_expiry_ts'];

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFLINE_PERIOD_GRACE_MS = 3 * DAY_MS;
const OFFLINE_MAX_STALENESS_MS = 7 * DAY_MS;
const MIN_FOREGROUND_REFRESH_MS = 60 * 1000;

export type EntitlementSource = 'server' | 'cache' | 'none';

export interface EntitlementSnapshot {
  isPro: boolean;
  proPlan: SubscriptionPlanKey | null;
  proStatus: string | null;
  proCurrentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  timelineRestore: boolean;
  hasBillingAccount: boolean;
  /** true si existe una sesión de Supabase con la que se puede comprar/verificar. */
  canTransact: boolean;
  isAnonymousAccount: boolean;
  source: EntitlementSource;
  verifiedAt: number | null;
}

interface CachedEntitlements {
  userId: string;
  verifiedAt: number;
  isPro: boolean;
  proPlan: SubscriptionPlanKey | null;
  proStatus: string | null;
  proCurrentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  timelineRestore: boolean;
  hasBillingAccount: boolean;
}

type Listener = (snapshot: EntitlementSnapshot) => void;

const EMPTY_SNAPSHOT: EntitlementSnapshot = {
  isPro: false,
  proPlan: null,
  proStatus: null,
  proCurrentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  timelineRestore: false,
  hasBillingAccount: false,
  canTransact: false,
  isAnonymousAccount: true,
  source: 'none',
  verifiedAt: null,
};

/**
 * FASE DE PRUEBAS: desbloquea todo lo PRO en cualquier build para que se puedan probar las skins
 * y funciones en el móvil. DEBE ponerse en `false` antes de publicar en tiendas: con `false`,
 * solo `__DEV__` conserva el acceso y producción depende exclusivamente del servidor.
 */
const PREVIEW_UNLOCK_ALL_PRO = true;

/** Acceso PRO ilimitado: siempre en `__DEV__`, y en builds de prueba mientras `PREVIEW_UNLOCK_ALL_PRO`. */
export const DEV_UNLIMITED_PRO: boolean = __DEV__ || PREVIEW_UNLOCK_ALL_PRO;

const DEV_PRO_SNAPSHOT: EntitlementSnapshot = {
  isPro: true,
  proPlan: 'pro_annual',
  proStatus: 'active',
  proCurrentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  timelineRestore: true,
  hasBillingAccount: false,
  canTransact: false,
  isAnonymousAccount: true,
  source: 'none',
  verifiedAt: null,
};

function parseServerPayload(raw: unknown, userId: string): CachedEntitlements | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.user_id !== userId) return null;

  const plan = data.pro_plan === 'pro_monthly' || data.pro_plan === 'pro_annual' ? data.pro_plan : null;
  const periodEnd = typeof data.pro_current_period_end === 'string' ? Date.parse(data.pro_current_period_end) : NaN;

  return {
    userId,
    verifiedAt: Date.now(),
    isPro: data.is_pro === true,
    proPlan: plan,
    proStatus: typeof data.pro_status === 'string' ? data.pro_status : null,
    proCurrentPeriodEnd: Number.isFinite(periodEnd) ? periodEnd : null,
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    timelineRestore: data.timeline_restore === true,
    hasBillingAccount: data.has_billing_account === true,
  };
}

class EntitlementService {
  private listeners = new Set<Listener>();
  private snapshot: EntitlementSnapshot = DEV_UNLIMITED_PRO ? DEV_PRO_SNAPSHOT : EMPTY_SNAPSHOT;
  private cached: CachedEntitlements | null = null;
  private sessionUserId: string | null = null;
  private inflight: Promise<EntitlementSnapshot> | null = null;
  private lastRefreshAt = 0;
  private started = false;

  constructor() {
    for (const key of LEGACY_LOCAL_PRO_KEYS) storageService.removeItem(key);
    this.cached = this.readCache();
  }

  /** Arranca la sincronización automática. Idempotente. */
  public start(): void {
    if (this.started) return;
    this.started = true;

    authService.onAuthStateChange((profile) => {
      const nextUserId = profile?.id ?? null;
      if (nextUserId !== this.sessionUserId) {
        this.refresh().catch(() => {});
      }
    });

    AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && Date.now() - this.lastRefreshAt > MIN_FOREGROUND_REFRESH_MS) {
        this.refresh().catch(() => {});
      }
    });

    this.refresh().catch(() => {});
  }

  public getSnapshot(): EntitlementSnapshot {
    return this.snapshot;
  }

  public has(feature: PremiumFeature): boolean {
    if (DEV_UNLIMITED_PRO) return true;
    if (feature === 'timeline_restore') return this.snapshot.timelineRestore;
    return this.snapshot.isPro && PRO_FEATURES.includes(feature);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Revalida contra el servidor. Las llamadas concurrentes comparten la misma petición. */
  public refresh(): Promise<EntitlementSnapshot> {
    if (!this.inflight) {
      this.inflight = this.doRefresh().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  /**
   * Tras volver de Stripe Checkout el webhook puede tardar unos segundos.
   * Reintenta hasta que `predicate` se cumpla o se agoten los intentos.
   */
  public async waitFor(
    predicate: (snapshot: EntitlementSnapshot) => boolean,
    { attempts = 10, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {}
  ): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      const snap = await this.refresh();
      if (predicate(snap)) return true;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  private async doRefresh(): Promise<EntitlementSnapshot> {
    this.lastRefreshAt = Date.now();

    if (!isSupabaseConfigured()) {
      this.sessionUserId = null;
      return this.publish(EMPTY_SNAPSHOT);
    }

    let userId: string | null = null;
    let isAnonymous = true;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user.id ?? null;
      isAnonymous = data.session?.user.is_anonymous ?? true;
    } catch {
      userId = null;
    }

    this.sessionUserId = userId;
    if (!userId) {
      return this.publish(EMPTY_SNAPSHOT);
    }

    if (this.cached && this.cached.userId !== userId) {
      this.clearCache();
    }

    try {
      const { data, error } = await supabase.rpc('get_my_entitlements');
      if (error) throw error;
      const parsed = parseServerPayload(data, userId);
      if (!parsed) throw new Error('Respuesta de entitlements inválida');
      this.writeCache(parsed);
      return this.publish(this.toSnapshot(parsed, 'server', isAnonymous));
    } catch (err) {
      console.warn('[EntitlementService] Verificación remota fallida, usando caché acotada:', (err as Error)?.message);
      if (this.cached && this.cached.userId === userId) {
        return this.publish(this.toSnapshot(this.cached, 'cache', isAnonymous));
      }
      return this.publish({ ...EMPTY_SNAPSHOT, canTransact: true, isAnonymousAccount: isAnonymous });
    }
  }

  private toSnapshot(data: CachedEntitlements, source: EntitlementSource, isAnonymous: boolean): EntitlementSnapshot {
    const now = Date.now();
    let isPro = data.isPro;

    if (source === 'cache' && isPro) {
      const tooStale = now - data.verifiedAt > OFFLINE_MAX_STALENESS_MS;
      const periodOver = data.proCurrentPeriodEnd !== null && now > data.proCurrentPeriodEnd + OFFLINE_PERIOD_GRACE_MS;
      isPro = !tooStale && !periodOver;
    }

    return {
      isPro,
      proPlan: isPro ? data.proPlan : null,
      proStatus: isPro ? data.proStatus : null,
      proCurrentPeriodEnd: isPro ? data.proCurrentPeriodEnd : null,
      cancelAtPeriodEnd: isPro && data.cancelAtPeriodEnd,
      timelineRestore: data.timelineRestore,
      hasBillingAccount: data.hasBillingAccount,
      canTransact: true,
      isAnonymousAccount: isAnonymous,
      source,
      verifiedAt: data.verifiedAt,
    };
  }

  private publish(incoming: EntitlementSnapshot): EntitlementSnapshot {
    const next = DEV_UNLIMITED_PRO ? { ...DEV_PRO_SNAPSHOT, canTransact: incoming.canTransact } : incoming;
    this.snapshot = next;
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch (err) {
        console.error('[EntitlementService] Listener error:', err);
      }
    }
    return next;
  }

  private readCache(): CachedEntitlements | null {
    const raw = storageService.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse<CachedEntitlements | null>(raw, null, 16 * 1024);
    return parsed && typeof parsed.userId === 'string' && typeof parsed.verifiedAt === 'number' ? parsed : null;
  }

  private writeCache(data: CachedEntitlements): void {
    this.cached = data;
    storageService.setItem(CACHE_KEY, JSON.stringify(data));
  }

  private clearCache(): void {
    this.cached = null;
    storageService.removeItem(CACHE_KEY);
  }
}

export const entitlementService = new EntitlementService();
