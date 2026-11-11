/**
 * TerraMaps - Supabase Client Configuration
 * 
 * Arquitectura Cero Costo: Diseñado para operar 100% dentro del Free Tier de Supabase.
 * Soporta autenticación anónima y almacenamiento seguro.
 */

import { createClient } from '@supabase/supabase-js';

// Variables de entorno de Expo (fallback a credenciales dummy si no están configuradas)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) &&
    !process.env.EXPO_PUBLIC_SUPABASE_URL?.includes('your-project')
  );
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
