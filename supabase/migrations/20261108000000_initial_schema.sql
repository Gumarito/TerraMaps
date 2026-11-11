-- ============================================================================
-- TERRAMAPS — Supabase Zero-Cost PostgreSQL / PostGIS Schema
-- Arquitectura de alto rendimiento para persistencia de hexágonos Uber H3
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE PERFILES DE JUGADORES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    total_area_km2 NUMERIC(10, 4) DEFAULT 0.0000 NOT NULL,
    exploration_level INTEGER DEFAULT 1 NOT NULL,
    streak_days INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. TABLA DE HEXÁGONOS DESBLOQUEADOS (Índice B-Tree ultrarrápido para H3 de 15 caracteres)
CREATE TABLE IF NOT EXISTS public.unlocked_hexagons (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hex_id VARCHAR(15) NOT NULL, -- Ej: '89268580cbfffff'
    unlocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, hex_id)
);

-- Índices B-Tree optimizados para consultas por usuario y por hexágono global
CREATE INDEX IF NOT EXISTS idx_unlocked_hexagons_user ON public.unlocked_hexagons(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_hexagons_hex ON public.unlocked_hexagons(hex_id);

-- 3. TABLA DE REYES DE ZONA ("Rey del Barrio" / Territory Kings)
CREATE TABLE IF NOT EXISTS public.territory_kings (
    zone_id VARCHAR(15) PRIMARY KEY, -- H3 de menor resolución (ej. Res 6/7 que agrupa barrios)
    king_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    hex_count INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. TABLA DE AMISTADES / RED SOCIAL
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('PENDING', 'ACCEPTED', 'BLOCKED')) DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_friend_pair UNIQUE (user_id_1, user_id_2),
    CONSTRAINT no_self_friendship CHECK (user_id_1 <> user_id_2)
);

-- ============================================================================
-- POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_hexagons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_kings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Profiles: Cualquiera puede ver perfiles públicos; solo el dueño puede editar el suyo
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Unlocked Hexagons: Los hexágonos son visibles según privacidad (por defecto públicos para niebla compartida)
CREATE POLICY "Hexagons viewable by authenticated users" 
    ON public.unlocked_hexagons FOR SELECT TO authenticated USING (true);

-- Solo el usuario autenticado puede insertar sus propios hexágonos descubiertos
CREATE POLICY "Users can only insert their own unlocked hexagons" 
    ON public.unlocked_hexagons FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- Territory Kings: Vista pública
CREATE POLICY "Territory kings are viewable by everyone" 
    ON public.territory_kings FOR SELECT USING (true);

-- ============================================================================
-- FUNCIÓN TRIGGER: ACTUALIZACIÓN AUTOMÁTICA DE ESTADÍSTICAS DEL PERFIL
-- Cada hexágono Res 9 suma aproximadamente ~0.1053 km²
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_hexagon_unlocked()
RETURNS TRIGGER AS $$
DECLARE
    hex_area_km2 CONSTANT NUMERIC := 0.1053;
BEGIN
    UPDATE public.profiles
    SET 
        total_area_km2 = total_area_km2 + hex_area_km2,
        exploration_level = GREATEST(1, FLOOR(SQRT((
            SELECT COUNT(*) FROM public.unlocked_hexagons WHERE user_id = NEW.user_id
        ) / 5.0))),
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_hexagon_unlocked
    AFTER INSERT ON public.unlocked_hexagons
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_hexagon_unlocked();
