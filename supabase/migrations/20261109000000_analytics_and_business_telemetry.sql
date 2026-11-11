-- ============================================================================
-- TERRAMAPS — Analytics & Business Decision Intelligence Schema
-- Migración: 20261109000000_analytics_and_business_telemetry.sql
-- 
-- Diseñado para capturar todas las estadísticas clave de exploración,
-- movilidad, salud (calorías/METs), radar social y embudo de monetización
-- para la toma de decisiones estratégicas, financieras y de producto.
-- ============================================================================

-- 1. ANALÍTICA DE TERRITORIO Y EXPANSIÓN POR USUARIO
CREATE TABLE IF NOT EXISTS public.user_territory_analytics (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_explored_km2 NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL,
    urban_coverage_percent NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    rural_coverage_percent NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    favorite_municipality TEXT,
    favorite_city TEXT DEFAULT 'CDMX',
    exploration_velocity_km2_week NUMERIC(8, 4) DEFAULT 0.0000 NOT NULL,
    total_active_exploration_days INTEGER DEFAULT 1 NOT NULL,
    landmarks_discovered_count INTEGER DEFAULT 0 NOT NULL,
    last_explored_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. TELEMETRÍA DE MOVILIDAD DIARIA Y SALUD (CALORÍAS, METs, EMISIONES)
CREATE TABLE IF NOT EXISTS public.daily_mobility_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    walk_km NUMERIC(8, 3) DEFAULT 0.000 NOT NULL,
    run_km NUMERIC(8, 3) DEFAULT 0.000 NOT NULL,
    vehicle_km NUMERIC(8, 3) DEFAULT 0.000 NOT NULL,
    flight_km NUMERIC(10, 3) DEFAULT 0.000 NOT NULL,
    active_movement_seconds INTEGER DEFAULT 0 NOT NULL,
    estimated_calories_kcal NUMERIC(8, 1) DEFAULT 0.0 NOT NULL,
    co2_saved_kg NUMERIC(6, 2) DEFAULT 0.00 NOT NULL,
    avg_speed_kmh NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    max_speed_kmh NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_daily_mobility UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mobility_user_date ON public.daily_mobility_telemetry(user_id, date);
CREATE INDEX IF NOT EXISTS idx_mobility_date ON public.daily_mobility_telemetry(date);

-- 3. ANALÍTICA DE MONUMENTOS Y PATROCINIOS B2B (TRAFICO PEATONAL / DWELL TIME)
CREATE TABLE IF NOT EXISTS public.landmark_discoveries_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    landmark_id VARCHAR(64) NOT NULL,
    landmark_category VARCHAR(32) NOT NULL, -- 'CULTURAL', 'HISTORICAL', 'LUXURY', 'SPONSOR_B2B'
    coordinates_lat NUMERIC(9, 6) NOT NULL,
    coordinates_lng NUMERIC(9, 6) NOT NULL,
    dwell_time_seconds INTEGER DEFAULT 0 NOT NULL,
    is_sponsored_b2b BOOLEAN DEFAULT FALSE NOT NULL,
    discovered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_landmark_analytics_user ON public.landmark_discoveries_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_landmark_analytics_id ON public.landmark_discoveries_analytics(landmark_id);
CREATE INDEX IF NOT EXISTS idx_landmark_analytics_sponsored ON public.landmark_discoveries_analytics(is_sponsored_b2b);

-- 4. TELEMETRÍA DEL RADAR SOCIAL Y SEGURIDAD MULTIJUGADOR
CREATE TABLE IF NOT EXISTS public.social_radar_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id VARCHAR(64) NOT NULL,
    radar_active_seconds INTEGER DEFAULT 0 NOT NULL,
    active_partners_count INTEGER DEFAULT 0 NOT NULL,
    pings_sent INTEGER DEFAULT 0 NOT NULL,
    battery_shield_mode VARCHAR(24) DEFAULT 'BALANCED' NOT NULL,
    device_platform VARCHAR(16) NOT NULL, -- 'web', 'ios', 'android'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_radar_user ON public.social_radar_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_social_radar_created ON public.social_radar_telemetry(created_at);

-- 5. EVENTOS DEL EMBUDO DE MONETIZACIÓN (CONVERSIÓN, PAYWALL, REVENUE)
CREATE TABLE IF NOT EXISTS public.monetization_funnel_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id VARCHAR(64) NOT NULL,
    event_name VARCHAR(64) NOT NULL, -- 'PAYWALL_VIEW', 'PLAN_CLICKED', 'CHECKOUT_START', 'PAYMENT_SUCCESS', 'PAYMENT_FAILURE', 'REWARDED_AD_WATCHED'
    tier_id VARCHAR(32),            -- 'PRO_MONTHLY', 'PRO_ANNUAL', 'TIMELINE_RESTORE_LIFETIME'
    gross_amount_usd NUMERIC(8, 2) DEFAULT 0.00,
    app_store_fee_usd NUMERIC(8, 2) DEFAULT 0.00, -- 15% Comisión Apple/Google Small Business
    net_revenue_usd NUMERIC(8, 2) DEFAULT 0.00,
    currency VARCHAR(8) DEFAULT 'USD',
    payment_provider VARCHAR(32) DEFAULT 'STRIPE', -- 'STRIPE', 'APPLE_IAP', 'GOOGLE_PLAY'
    error_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monetization_event_name ON public.monetization_funnel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_monetization_user ON public.monetization_funnel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_monetization_created ON public.monetization_funnel_events(created_at);

-- 6. TABLA CONSOLIDADA DE MÉTRICAS DIARIAS PARA EL FUNDADOR (KPIs EJECUTIVOS)
CREATE TABLE IF NOT EXISTS public.aggregate_daily_business_metrics (
    date DATE PRIMARY KEY,
    dau_count INTEGER DEFAULT 0 NOT NULL,
    mau_count INTEGER DEFAULT 0 NOT NULL,
    new_signups INTEGER DEFAULT 0 NOT NULL,
    total_km2_unlocked_today NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL,
    paying_subscribers_active INTEGER DEFAULT 0 NOT NULL,
    gross_revenue_usd NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    net_revenue_usd NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    server_tile_cost_usd NUMERIC(10, 4) DEFAULT 0.0000 NOT NULL,
    ebitda_margin_percent NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.user_territory_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_mobility_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landmark_discoveries_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_radar_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregate_daily_business_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas por usuario (Los usuarios leen/escriben su propia telemetría)
CREATE POLICY "Users can manage own territory analytics"
    ON public.user_territory_analytics FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own daily mobility"
    ON public.daily_mobility_telemetry FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own landmark discoveries"
    ON public.landmark_discoveries_analytics FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert social radar telemetry"
    ON public.social_radar_telemetry FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own social radar telemetry"
    ON public.social_radar_telemetry FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can log monetization events"
    ON public.monetization_funnel_events FOR INSERT TO authenticated, anon
    WITH CHECK (true);

-- Vistas ejecutivas para panel de administración
CREATE OR REPLACE VIEW public.view_founder_daily_executive_kpis AS
SELECT
    d.date,
    COUNT(DISTINCT m.user_id) AS active_explorers,
    COALESCE(SUM(m.walk_km), 0) AS total_walked_km,
    COALESCE(SUM(m.estimated_calories_kcal), 0) AS total_calories_burned,
    COALESCE(SUM(f.net_revenue_usd), 0) AS total_net_revenue_usd
FROM (
    SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, '1 day')::date AS date
) d
LEFT JOIN public.daily_mobility_telemetry m ON m.date = d.date
LEFT JOIN public.monetization_funnel_events f ON DATE(f.created_at) = d.date AND f.event_name = 'PAYMENT_SUCCESS'
GROUP BY d.date
ORDER BY d.date DESC;
