/**
 * TerraMaps — Edge Function `billing`
 *
 *   GET  /billing/catalog   → precios vigentes desde Stripe (público, cacheado 10 min)
 *   POST /billing/checkout  → crea una Stripe Checkout Session  { plan, returnUrl }
 *   POST /billing/portal    → crea una sesión del Customer Portal { returnUrl }
 *
 * Checkout y Portal exigen el JWT del usuario de Supabase (Authorization: Bearer ...).
 */

import type Stripe from 'npm:stripe@17.7.0';
import {
  PLANS,
  type PlanKey,
  corsHeaders,
  errorResponse,
  getAuthenticatedUser,
  getOrCreateCustomer,
  isPlanKey,
  json,
  sanitizeReturnUrl,
  stripe,
  supabaseAdmin,
  toMajorUnits,
} from '../_shared/billing.ts';

const AUTOMATIC_TAX = Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true';
const DEFAULT_RETURN_URL = (Deno.env.get('BILLING_ALLOWED_ORIGINS') ?? '').split(',')[0]?.trim() ?? '';
const CATALOG_TTL_MS = 10 * 60 * 1000;

interface CatalogEntry {
  plan: PlanKey;
  amount: number;          // unidades mayores (p. ej. 1.99)
  currency: string;        // ISO 4217 en minúsculas
  interval: 'month' | 'year' | null;
}

let catalogCache: { at: number; entries: CatalogEntry[] } | null = null;

async function getCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.entries;

  const entries = await Promise.all(
    Object.values(PLANS).map(async (plan): Promise<CatalogEntry> => {
      const price = await stripe.prices.retrieve(plan.priceId);
      const interval = price.recurring?.interval;
      return {
        plan: plan.key,
        amount: toMajorUnits(price.unit_amount ?? 0, price.currency),
        currency: price.currency,
        interval: interval === 'month' || interval === 'year' ? interval : null,
      };
    }),
  );
  catalogCache = { at: Date.now(), entries };
  return entries;
}

async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('billing_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function hasPaidPurchase(userId: string, productKey: PlanKey): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('billing_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('product_key', productKey)
    .eq('status', 'paid')
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function handleCheckout(req: Request): Promise<Response> {
  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse(req, 401, 'AUTH_REQUIRED', 'Inicia sesión para continuar con el pago.');

  const body = await readJsonBody(req);
  if (!isPlanKey(body.plan)) return errorResponse(req, 400, 'INVALID_PLAN', 'Plan no válido.');
  const plan = PLANS[body.plan];

  const returnUrl = sanitizeReturnUrl(body.returnUrl) ?? sanitizeReturnUrl(DEFAULT_RETURN_URL);
  if (!returnUrl) return errorResponse(req, 400, 'INVALID_RETURN_URL', 'URL de retorno no permitida.');

  if (plan.mode === 'subscription' && (await hasActiveSubscription(user.id))) {
    return errorResponse(req, 409, 'ALREADY_SUBSCRIBED', 'Ya tienes Terra PRO activo. Gestiona tu plan desde tu perfil.');
  }
  if (plan.mode === 'payment' && (await hasPaidPurchase(user.id, plan.key))) {
    return errorResponse(req, 409, 'ALREADY_PURCHASED', 'Ya adquiriste este paquete.');
  }

  const customerId = await getOrCreateCustomer(user);
  const metadata = { supabase_user_id: user.id, plan_key: plan.key };
  const separator = returnUrl.includes('?') ? '&' : '?';

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: plan.mode,
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${returnUrl}${separator}checkout=success&plan=${plan.key}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}${separator}checkout=cancel&plan=${plan.key}`,
    metadata,
    allow_promotion_codes: true,
    automatic_tax: { enabled: AUTOMATIC_TAX },
    ...(AUTOMATIC_TAX ? { customer_update: { address: 'auto' as const } } : {}),
    ...(plan.mode === 'subscription'
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata } }),
  };

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) return errorResponse(req, 502, 'CHECKOUT_UNAVAILABLE', 'No fue posible iniciar el pago.');
  return json(req, 200, { url: session.url, sessionId: session.id });
}

async function handlePortal(req: Request): Promise<Response> {
  const user = await getAuthenticatedUser(req);
  if (!user) return errorResponse(req, 401, 'AUTH_REQUIRED', 'Inicia sesión para gestionar tu suscripción.');

  const body = await readJsonBody(req);
  const returnUrl = sanitizeReturnUrl(body.returnUrl) ?? sanitizeReturnUrl(DEFAULT_RETURN_URL);
  if (!returnUrl) return errorResponse(req, 400, 'INVALID_RETURN_URL', 'URL de retorno no permitida.');

  const { data: customer, error } = await supabaseAdmin
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!customer) return errorResponse(req, 404, 'NO_BILLING_ACCOUNT', 'Aún no tienes compras asociadas a esta cuenta.');

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: returnUrl,
  });
  return json(req, 200, { url: session.url });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (route === 'catalog' && req.method === 'GET') return json(req, 200, { prices: await getCatalog() });
    if (route === 'checkout' && req.method === 'POST') return await handleCheckout(req);
    if (route === 'portal' && req.method === 'POST') return await handlePortal(req);
    return errorResponse(req, 404, 'NOT_FOUND', 'Ruta no encontrada.');
  } catch (err) {
    // Nunca exponer detalles internos de Stripe/DB al cliente.
    console.error('[billing] Unhandled error', { route, message: (err as Error)?.message });
    return errorResponse(req, 500, 'INTERNAL', 'Error interno al procesar el pago. Inténtalo de nuevo.');
  }
});
