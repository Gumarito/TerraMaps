/**
 * TerraMaps — Código compartido de facturación para Supabase Edge Functions (Deno).
 *
 * Secretos requeridos (supabase secrets set ...):
 *   STRIPE_SECRET_KEY              sk_live_... / sk_test_...
 *   STRIPE_WEBHOOK_SECRET          whsec_...
 *   STRIPE_PRICE_PRO_MONTHLY       price_...  (recurrente mensual)
 *   STRIPE_PRICE_PRO_ANNUAL        price_...  (recurrente anual)
 *   STRIPE_PRICE_TIMELINE_LIFETIME price_...  (pago único)
 *   BILLING_ALLOWED_ORIGINS        https://app.terramaps.com,http://localhost:8081
 * Opcionales:
 *   STRIPE_AUTOMATIC_TAX           "true" para activar Stripe Tax en Checkout
 * Inyectados automáticamente por Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import Stripe from 'npm:stripe@17.7.0';
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.48.1';

export type PlanKey = 'pro_monthly' | 'pro_annual' | 'timeline_lifetime';
export type SubscriptionPlanKey = Exclude<PlanKey, 'timeline_lifetime'>;

export interface PlanConfig {
  key: PlanKey;
  priceId: string;
  mode: 'subscription' | 'payment';
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

export const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
  httpClient: Stripe.createFetchHttpClient(),
  appInfo: { name: 'TerraMaps' },
});

export const supabaseAdmin: SupabaseClient = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Catálogo autoritativo: el cliente solo envía la clave del plan, nunca un price_id. */
export const PLANS: Record<PlanKey, PlanConfig> = {
  pro_monthly: { key: 'pro_monthly', priceId: requireEnv('STRIPE_PRICE_PRO_MONTHLY'), mode: 'subscription' },
  pro_annual: { key: 'pro_annual', priceId: requireEnv('STRIPE_PRICE_PRO_ANNUAL'), mode: 'subscription' },
  timeline_lifetime: { key: 'timeline_lifetime', priceId: requireEnv('STRIPE_PRICE_TIMELINE_LIFETIME'), mode: 'payment' },
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
}

export function planKeyForPrice(priceId: string): PlanKey | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceId === priceId) return plan.key;
  }
  return null;
}

// ----------------------------------------------------------------------------
// HTTP helpers (CORS restringido a orígenes permitidos)
// ----------------------------------------------------------------------------

const ALLOWED_ORIGINS = (Deno.env.get('BILLING_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export function isAllowedOrigin(origin: string | null): origin is string {
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(req: Request, status: number, code: string, message: string): Response {
  return json(req, status, { error: { code, message } });
}

/**
 * Valida que la URL de retorno pertenezca a un origen permitido.
 * Evita open-redirects usando Checkout como trampolín.
 */
export function sanitizeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (!isAllowedOrigin(url.origin)) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Autenticación del usuario a partir del JWT de Supabase
// ----------------------------------------------------------------------------

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// ----------------------------------------------------------------------------
// Cliente de Stripe ↔ usuario
// ----------------------------------------------------------------------------

export async function getOrCreateCustomer(user: User): Promise<string> {
  const { data: existing, error } = await supabaseAdmin
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create(
    {
      email: user.email || undefined,
      metadata: { supabase_user_id: user.id },
    },
    { idempotencyKey: `terramaps-customer-${user.id}` },
  );

  const { error: insertError } = await supabaseAdmin
    .from('billing_customers')
    .upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (insertError) throw insertError;

  // Releer por si una petición concurrente ganó la carrera.
  const { data: row, error: rereadError } = await supabaseAdmin
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();
  if (rereadError) throw rereadError;
  return row.stripe_customer_id;
}

export async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('billing_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

// ----------------------------------------------------------------------------
// Monedas sin decimales (Stripe expresa importes en la unidad mínima)
// ----------------------------------------------------------------------------

const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

export function toMajorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : amount / 100;
}
