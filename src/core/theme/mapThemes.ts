/**
 * TerraMaps - Map & Fog Visual Themes
 * 
 * Soporta Modo Claro (Luz de día) y Modo Oscuro (Noche) que se sincroniza
 * con el sistema del celular, además de temas estilizados.
 */

/** free: siempre disponible · progress: se gana explorando · pro: requiere Terra PRO */
export type ThemeAccess = 'free' | 'progress' | 'pro';

export interface MapTheme {
  id: string;
  access: ThemeAccess;
  name: string;
  mode: 'light' | 'dark';
  description: string;
  fogColor: string;
  fogOpacity: number;
  glowColor: string;
  glowWidth: number;
  mapStyleURL: string;
  accentColor: string;
  hudBackground: string;
  cardBackground: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export type FogVisualMode = 'translucent' | 'blur' | 'clear' | 'dark' | 'realistic_mist';

export interface FogStylePreset {
  id: FogVisualMode;
  name: string;
  icon: string;
  description: string;
  opacity: number;
  isPremium: boolean;
}

export const FOG_STYLE_PRESETS: Record<FogVisualMode, FogStylePreset> = {
  translucent: {
    id: 'translucent',
    name: 'Velo Sutil',
    icon: '◈',
    description: 'Niebla ligera que deja entrever las calles debajo.',
    opacity: 0.45,
    isPremium: false,
  },
  blur: {
    id: 'blur',
    name: 'Borroso',
    icon: '◇',
    description: 'Difuminado suave que revela nitidez solo donde caminas.',
    opacity: 0.68,
    isPremium: true,
  },
  clear: {
    id: 'clear',
    name: 'Claridad',
    icon: '○',
    description: 'Mapa visible para ubicarse, con bordes neón en lo conquistado.',
    opacity: 0.12,
    isPremium: false,
  },
  dark: {
    id: 'dark',
    name: 'Oscuridad',
    icon: '●',
    description: 'Niebla clásica opaca estilo estrategia en tiempo real.',
    opacity: 0.96,
    isPremium: false,
  },
  realistic_mist: {
    id: 'realistic_mist',
    name: 'Neblina Real',
    icon: '◌',
    description: 'Velo atmosférico volumétrico con difuminado suave en los bordes.',
    opacity: 0.52,
    isPremium: true,
  },
};

export const MAP_THEMES: Record<string, MapTheme> = {
  // MODO EJECUTIVO PREMIUM (Obsidiana Profunda & Titanio Satinado - "Gente de Buen Perfil")
  OBSIDIAN_TITANIUM: {
    id: 'OBSIDIAN_TITANIUM',
    access: 'free',
    name: 'Obsidian & Titanio',
    mode: 'dark',
    description: 'Estética de alta relojería suiza y aviación privada. Velo de terciopelo obsidiana con halo de titanio satinado.',
    fogColor: '#05070a',
    fogOpacity: 0.76,
    glowColor: '#e2e8f0', // Titanio satinado suave
    glowWidth: 3.5,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    accentColor: '#10b981', // Joya esmeralda sutil para estado activo
    hudBackground: 'rgba(10, 15, 26, 0.90)',
    cardBackground: '#0b101b',
    textColor: '#f8fafc',
    subtextColor: '#94a3b8',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  // MODO CLARO (Blanco / Día) - Mapa Positron limpio y niebla de bruma traslúcida
  LIGHT_EXPLORER: {
    id: 'LIGHT_EXPLORER',
    access: 'free',
    name: 'Modo Claro',
    mode: 'light',
    description: 'Bruma gris traslúcida de alta visibilidad que deja entrever las calles.',
    fogColor: '#64748b',
    fogOpacity: 0.36,
    glowColor: '#2563eb',
    glowWidth: 2.8,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    accentColor: '#2563eb',
    hudBackground: 'rgba(255, 255, 255, 0.94)',
    cardBackground: '#ffffff',
    textColor: '#0f172a',
    subtextColor: '#475569',
    borderColor: '#e2e8f0',
  },

  // MODO OSCURO (Noche) - Velo nocturno traslúcido de alto contraste
  DARK_CYBER: {
    id: 'DARK_CYBER',
    access: 'free',
    name: 'Modo Oscuro',
    mode: 'dark',
    description: 'Velo azul noche traslúcido que revela el mapa urbano y resplandor neón.',
    fogColor: '#0f172a',
    fogOpacity: 0.60,
    glowColor: '#00f5d4',
    glowWidth: 2.5,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    accentColor: '#00f5d4',
    hudBackground: 'rgba(15, 23, 42, 0.94)',
    cardBackground: '#111827',
    textColor: '#f8fafc',
    subtextColor: '#94a3b8',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  // TEMA VOYAGER CARTOGRÁFICO
  ANTIQUE_PARCHMENT: {
    id: 'ANTIQUE_PARCHMENT',
    access: 'progress',
    name: 'Papiro Clásico',
    mode: 'dark',
    description: 'Estética de expedición clásica con tonos cálidos.',
    fogColor: '#1c1510',
    fogOpacity: 0.89,
    glowColor: '#eab308',
    glowWidth: 2.2,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    accentColor: '#eab308',
    hudBackground: 'rgba(30, 22, 17, 0.94)',
    cardBackground: '#261b14',
    textColor: '#fef3c7',
    subtextColor: '#a8a29e',
    borderColor: 'rgba(234, 179, 8, 0.25)',
  },

  // COSMÉTICO 1: GTA RADAR LOS SANTOS
  GTA_LOS_SANTOS: {
    id: 'GTA_LOS_SANTOS',
    access: 'pro',
    name: 'Los Santos (GTA)',
    mode: 'dark',
    description: 'Mini-mapa satelital de alto contraste, halo ámbar y radar táctico estilo GTA V.',
    fogColor: '#0a0d14',
    fogOpacity: 0.82,
    glowColor: '#eab308', // Amarillo ámbar característico del GPS de GTA
    glowWidth: 3.8,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    accentColor: '#22c55e', // Verde dólar de misión
    hudBackground: 'rgba(12, 16, 24, 0.92)',
    cardBackground: '#0e1420',
    textColor: '#f8fafc',
    subtextColor: '#94a3b8',
    borderColor: 'rgba(234, 179, 8, 0.35)',
  },

  // COSMÉTICO 2: MINECRAFT
  MINECRAFT_VOXEL: {
    id: 'MINECRAFT_VOXEL',
    access: 'pro',
    name: 'Minecraft',
    mode: 'dark',
    description: 'Velo de roca profunda con aureola de esmeralda y brújula de expedición.',
    fogColor: '#181512',
    fogOpacity: 0.85,
    glowColor: '#4ade80', // Verde bloque de pasto y esmeralda
    glowWidth: 3.2,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    accentColor: '#22c55e',
    hudBackground: 'rgba(26, 22, 18, 0.94)',
    cardBackground: '#211c16',
    textColor: '#fef9c3',
    subtextColor: '#d1d5db',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },

  // COSMÉTICO 3: CYBERPUNK 2077 NIGHT CITY
  CYBERPUNK_NIGHT_CITY: {
    id: 'CYBERPUNK_NIGHT_CITY',
    access: 'pro',
    name: 'Night City (Cyberpunk)',
    mode: 'dark',
    description: 'Velo de matriz holo-óptica roja y halo láser carmesí con azul Kiroshi.',
    fogColor: '#070509',
    fogOpacity: 0.84,
    glowColor: '#f43f5e', // Láser carmesí Arasaka
    glowWidth: 4.0,
    mapStyleURL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    accentColor: '#06b6d4', // Azul óptica Kiroshi
    hudBackground: 'rgba(15, 10, 20, 0.94)',
    cardBackground: '#130d1a',
    textColor: '#ffe4e6',
    subtextColor: '#fda4af',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
};

export const DEFAULT_DARK_THEME_ID = 'OBSIDIAN_TITANIUM';
export const DEFAULT_LIGHT_THEME_ID = 'LIGHT_EXPLORER';
export const DEFAULT_THEME_ID = 'OBSIDIAN_TITANIUM';
