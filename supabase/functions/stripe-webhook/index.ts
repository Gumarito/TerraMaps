/**
 * TerraMaps — Edge Function `stripe-webhook`
 *
 * Desplegar SIN verificación de JWT (Stripe no envía token de Supabase):
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Eventos a habilitar en el endpoint de Stripe:
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   charge.refunded
 *
 * Seguridad: se verifica la firma `Stripe-Signature` sobre el cuerpo crudo.
 * Idempotencia: cada evento se registra en stripe_webhook_events; además todos los
 * handlers re-sincronizan el estado desde la API de Stripe (tolerantes a desorden).
 */

import Stripe from 'npm:stripe@17.7.0';
import {
  findUserIdByCustomer,
  planKeyForPrice,
  stripe,
  supabaseAdmin,
  toMajorUnits,
} from '../_shared/billing.ts';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

// ----------------------------------------------------------------------------
// Suscripciones
// ----------------------------------------------------------------------------

async function syncSubscription(subscriptionId: string): Promise<void> {
  // Siempre leer el estado vigente: los eventos pueden llegar desordenados.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = idOf(sub.customer)!;
  const userId = sub.metadata?.supabase_user_id || (await findUserIdByCustomer(customerId));
  if (!userId) {
    throw new Error(`Subscription ${sub.id} has no resolvable user (customer ${customerId})`);
  }

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? '';
  const planKey = planKeyForPrice(priceId);
  if (planKey !== 'pro_monthly' && planKey !== 'pro_annual') {
    console.warn('[stripe-webhook] Ignoring subscription with unknown price', { sub: sub.id, priceId });
    return;
  }

  // API ≥ 2025-03-31 mueve current_period_end a los items; se soportan ambas formas.
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;

  const { error } = await supabaseAdmin.from('billing_subscriptions').upsert(
    {
      id: sub.id,
      user_id: userId,
      stripe_customer_id: customerId,
      status: sub.status,
      plan_key: planKey,
      price_id: priceId,
      current_period_end: unixToIso(periodEnd),
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: unixToIso(sub.canceled_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Compras únicas
// ----------------------------------------------------------------------------

async function recordOneTimePurchase(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid') return; // pagos asíncronos llegan después
  const userId = session.metadata?.supabase_user_id || session.client_reference_id;
  const productKey = session.metadata?.plan_key;
  if (!userId || productKey !== 'timeline_lifetime') {
    console.warn('[stripe-webhook] Payment session without valid metadata', { session: session.id });
    return;
  }

  const { error } = await supabaseAdmin.from('billing_purchases').upsert(
    {
      id: session.id,
      user_id: userId,
      product_key: productKey,
      stripe_payment_intent_id: idOf(session.payment_intent),
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'paid',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

async function handleRefund(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId || !charge.refunded) return; // reembolsos parciales conservan el acceso
  const { error } = await supabaseAdmin
    .from('billing_purchases')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntentId);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Telemetría de negocio (no bloqueante)
// ----------------------------------------------------------------------------

const TIER_BY_PLAN: Record<string, string> = {
  pro_monthly: 'PRO_MONTHLY',
  pro_annual: 'PRO_ANNUAL',
  timeline_lifetime: 'TIMELINE_RESTORE_LIFETIME',
};

async function logPaymentSuccess(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const currency = session.currency ?? 'usd';
    const gross = toMajorUnits(session.amount_total ?? 0, currency);
    await supabaseAdmin.from('monetization_funnel_events').insert({
      user_id: session.metadata?.supabase_user_id || session.client_reference_id || null,
      session_id: session.id,
      event_name: 'PAYMENT_SUCCESS',
      tier_id: TIER_BY_PLAN[session.metadata?.plan_key ?? ''] ?? null,
      gross_amount_usd: gross,           // importe en `currency` (columna heredada)
      app_store_fee_usd: 0,              // comisiones de Stripe no disponibles en este evento
      net_revenue_usd: gross,
      currency: currency.toUpperCase(),
      payment_provider: 'STRIPE',
    });
  } catch (err) {
    console.warn('[stripe-webhook] Telemetry insert failed', (err as Error)?.message);
  }
}

// ----------------------------------------------------------------------------
// Router de eventos
// ----------------------------------------------------------------------------

async function processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        await syncSubscription(idOf(session.subscription)!);
      } else if (session.mode === 'payment') {
        await recordOneTimePurchase(session);
      }
      if (session.payment_status === 'paid') await logPaymentSuccess(session);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription((event.data.object as Stripe.Subscription).id);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object as Stripe.Charge);
      break;
    default:
      // Evento no suscrito: se reconoce para que Stripe no reintente.
      break;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook not configured', { status: 500 });
  }

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    console.warn('[stripe-webhook] Invalid signature', (err as Error)?.message);
    return new Response('Invalid signature', { status: 400 });
  }

  const { data: seen } = await supabaseAdmin
    .from('stripe_webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (seen) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });

  try {
    await processEvent(event);
  } catch (err) {
    // 500 → Stripe reintentará con backoff exponencial.
    console.error('[stripe-webhook] Processing failed', { id: event.id, type: event.type, message: (err as Error)?.message });
    return new Response('Processing failed', { status: 500 });
  }

  await supabaseAdmin
    .from('stripe_webhook_events')
    .upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
