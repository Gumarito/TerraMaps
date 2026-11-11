-- ============================================================================
-- TERRAMAPS — Stripe Billing: clientes, suscripciones, compras únicas y entitlements
-- Migración: 20261110000000_stripe_billing.sql
--
-- Principio: Stripe es la fuente de verdad. Estas tablas son un espejo que SOLO
-- escribe el webhook (service_role). Los clientes solo pueden LEER sus filas y
-- consultar sus derechos de acceso vía public.get_my_entitlements().
-- ============================================================================

-- 1. MAPEO USUARIO ↔ CLIENTE DE STRIPE
CREATE TABLE IF NOT EXISTS public.billing_customers (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. SUSCRIPCIONES (espejo de Stripe Subscription)
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id TEXT PRIMARY KEY,                               -- sub_...
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'incomplete', 'incomplete_expired', 'trialing', 'active',
        'past_due', 'canceled', 'unpaid', 'paused'
    )),
    plan_key TEXT NOT NULL CHECK (plan_key IN ('pro_monthly', 'pro_annual')),
    price_id TEXT NOT NULL,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user ON public.billing_subscriptions(user_id);

-- 3. COMPRAS ÚNICAS (p. ej. Paquete Viajero del Tiempo)
CREATE TABLE IF NOT EXISTS public.billing_purchases (
    id TEXT PRIMARY KEY,                               -- cs_... (Checkout Session)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_key TEXT NOT NULL CHECK (product_key IN ('timeline_lifetime')),
    stripe_payment_intent_id TEXT UNIQUE,
    amount_total INTEGER NOT NULL DEFAULT 0,           -- unidad mínima de la moneda
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('paid', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_purchases_user ON public.billing_purchases(user_id);

-- 4. IDEMPOTENCIA DE WEBHOOKS (Stripe reintenta y puede duplicar eventos)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id TEXT PRIMARY KEY,                               -- evt_...
    type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- RLS: lectura propia, escritura exclusiva de service_role (sin políticas de escritura)
-- ============================================================================

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing customer"
    ON public.billing_customers FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions"
    ON public.billing_subscriptions FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own purchases"
    ON public.billing_purchases FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- stripe_webhook_events: sin políticas → inaccesible para anon/authenticated.

-- ============================================================================
-- ENTITLEMENTS: única puerta de lectura de derechos para el cliente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH sub AS (
        SELECT s.*
        FROM public.billing_subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.status IN ('active', 'trialing', 'past_due')
          AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
        ORDER BY s.current_period_end DESC NULLS LAST
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'user_id', auth.uid(),
        'is_pro', EXISTS (SELECT 1 FROM sub),
        'pro_plan', (SELECT plan_key FROM sub),
        'pro_status', (SELECT status FROM sub),
        'pro_current_period_end', (SELECT current_period_end FROM sub),
        'cancel_at_period_end', COALESCE((SELECT cancel_at_period_end FROM sub), FALSE),
        'timeline_restore', EXISTS (
            SELECT 1 FROM public.billing_purchases p
            WHERE p.user_id = auth.uid()
              AND p.product_key = 'timeline_lifetime'
              AND p.status = 'paid'
        ),
        'has_billing_account', EXISTS (
            SELECT 1 FROM public.billing_customers c WHERE c.user_id = auth.uid()
        ),
        'server_time', NOW()
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;

-- ============================================================================
-- ENDURECIMIENTO DEL EMBUDO DE MONETIZACIÓN
-- Antes cualquier cliente podía insertar 'PAYMENT_SUCCESS' y falsear ingresos.
-- Ahora los eventos de pago solo los registra el webhook (service_role).
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can log monetization events" ON public.monetization_funnel_events;

CREATE POLICY "Clients can log non-payment funnel events"
    ON public.monetization_funnel_events FOR INSERT TO authenticated, anon
    WITH CHECK (
        event_name IN ('PAYWALL_VIEW', 'PLAN_CLICKED', 'CHECKOUT_START', 'PAYMENT_FAILURE', 'REWARDED_AD_WATCHED')
        AND (user_id IS NULL OR user_id = auth.uid())
        AND (
            -- Estimación de eCPM de anuncios: importes simbólicos acotados
            (event_name = 'REWARDED_AD_WATCHED' AND COALESCE(gross_amount_usd, 0) BETWEEN 0 AND 0.10)
            -- Resto del embudo: nunca transporta ingresos
            OR (COALESCE(gross_amount_usd, 0) = 0 AND COALESCE(net_revenue_usd, 0) = 0)
        )
    );
