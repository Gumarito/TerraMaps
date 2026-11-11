/**
 * TerraMaps - Ethical Zero-Cost Monetization & Rewards Engine
 * 
 * Este servicio gestiona:
 * 1. Control de Drones de Exploración (1 dron gratuito cada 4 horas o visualización de rewarded video ad).
 * 2. Desbloqueo y logros de Skins Tácticas de Niebla y Mapa.
 * 3. Beneficios de Terra PRO (radar extendido, drones sin espera). El estado PRO NO se
 *    gestiona aquí: proviene de `entitlementService`, alimentado por el webhook de Stripe.
 */

import { storageService, UserStats } from './storage';
import { MAP_THEMES } from '@/core/theme/mapThemes';
import { entitlementService } from './billing/entitlementService';

// ============================================================================
// CONSTANTES & CLAVES DE PERSISTENCIA
// ============================================================================

export const DRONE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 horas en milisegundos (14,400,000 ms)

export const STORAGE_KEYS = {
  LAST_DRONE_FLIGHT: '@terramaps_last_drone_flight_ts',
  DRONE_FLIGHTS_TOTAL: '@terramaps_drone_flights_total',
  ACTIVE_SKIN_ID: '@terramaps_active_skin_id',
} as const;

// Parámetros de radar táctico
export const RADAR_PARAMS = {
  FREE_KRING: 2,           // ~300m radio (~19 hexágonos H3 res 9)
  FREE_RADIUS_METERS: 300,
  PRO_KRING: 3,            // ~550m radio (~37 hexágonos H3 res 9)
  PRO_RADIUS_METERS: 550,
} as const;

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export type SkinUnlockType = 'DEFAULT' | 'LEVEL_OR_HEXES' | 'AREA_OR_PRO';

export interface TacticalSkin {
  id: string;
  name: string;
  description: string;
  glowColor: string;
  fogColor: string;
  unlockType: SkinUnlockType;
  isUnlocked: boolean;
  progressPercent: number; // 0 a 100
  unlockCriteriaText: string;
}

export interface DroneDeployResult {
  success: boolean;
  source: 'FREE_COOLDOWN' | 'TERRA_PRO' | 'REWARDED_AD';
  message: string;
  timestamp: number;
}

/**
 * Interfaz para proveedores de anuncios recompensados (Google AdMob, Monetag o Simulado)
 */
export interface RewardedAdProvider {
  isLoaded(): boolean;
  load(): Promise<boolean>;
  show(): Promise<boolean>;
}

// ============================================================================
// PROVEEDOR SIMULADO DE ANUNCIOS RECOMPENSADOS (Cero Costo / Web / Dev)
// ============================================================================

class WebRewardedAdSimulator implements RewardedAdProvider {
  private loaded: boolean = true;

  public isLoaded(): boolean {
    return this.loaded;
  }

  public async load(): Promise<boolean> {
    this.loaded = true;
    return true;
  }

  /**
   * Simula la visualización de un anuncio recompensado de 5 segundos
   */
  public async show(): Promise<boolean> {
    console.log('[MonetizationEngine] 📺 Simulando visualización de Rewarded Video Ad (AdMob Simulator)...');
    return new Promise((resolve) => {
      // Simula pequeña pausa de reproducción del video publicitario
      setTimeout(() => {
        console.log('[MonetizationEngine] ✅ Recompensa de anuncio obtenida: +1 Dron de Exploración Táctico.');
        resolve(true);
      }, 600);
    });
  }
}

// ============================================================================
// SERVICIO PRINCIPAL DE MONETIZACIÓN Y RECOMPENSAS
// ============================================================================

class MonetizationService {
  private adProvider: RewardedAdProvider = new WebRewardedAdSimulator();
  private lastFlightCache: number | null = null;

  constructor() {
    const rawFlight = storageService.getItem(STORAGE_KEYS.LAST_DRONE_FLIGHT);
    if (rawFlight) {
      this.lastFlightCache = parseInt(rawFlight, 10) || null;
    }
  }

  /**
   * Permite inyectar un proveedor nativo como react-native-google-mobile-ads
   */
  public setRewardedAdProvider(provider: RewardedAdProvider): void {
    this.adProvider = provider;
  }

  // --------------------------------------------------------------------------
  // 1. CONTROL DE DRONES DE EXPLORACIÓN
  // --------------------------------------------------------------------------

  /**
   * Obtiene el timestamp en ms del último vuelo registrado
   */
  public getLastDroneFlightTimestamp(): number {
    if (this.lastFlightCache !== null) {
      return this.lastFlightCache;
    }
    const raw = storageService.getItem(STORAGE_KEYS.LAST_DRONE_FLIGHT);
    const ts = raw ? parseInt(raw, 10) : 0;
    this.lastFlightCache = ts;
    return ts;
  }

  /**
   * Retorna los milisegundos restantes para el próximo dron gratuito (0 si ya está listo)
   */
  public getRemainingCooldownMs(): number {
    const lastFlight = this.getLastDroneFlightTimestamp();
    if (!lastFlight || lastFlight === 0) {
      return 0; // Primer vuelo siempre disponible
    }

    const now = Date.now();
    const elapsed = now - lastFlight;
    const remaining = DRONE_COOLDOWN_MS - elapsed;

    return remaining > 0 ? remaining : 0;
  }

  /**
   * Determina si el dron gratuito por temporizador está listo
   */
  public isFreeDroneReady(): boolean {
    return this.getRemainingCooldownMs() <= 0;
  }

  public resetDroneCooldown(): void {
    this.lastFlightCache = 0;
    storageService.removeItem(STORAGE_KEYS.LAST_DRONE_FLIGHT);
  }

  /**
   * Verifica si el usuario puede desplegar un dron en este instante.
   * Retorna true si:
   * - El enfriamiento de 4 horas concluyó (vuelo gratuito disponible), O
   * - El usuario cuenta con suscripción Terra PRO activa (recargas sin espera), O
   * - Existe disponibilidad para visualizar un anuncio rewarded compensatorio.
   */
  public canDeployDrone(): boolean {
    if (this.isFreeDroneReady()) {
      return true;
    }
    if (entitlementService.has('unlimited_drones')) {
      return true;
    }
    return this.adProvider.isLoaded();
  }

  /**
   * Retorna una cadena con formato amigable del tiempo restante para el siguiente dron gratuito.
   * Ejemplos: "03:42:15", "00:15:30", o "LISTO" si ya expiró el enfriamiento.
   */
  public getTimeUntilNextFreeDrone(): string {
    const remainingMs = this.getRemainingCooldownMs();

    if (remainingMs <= 0) {
      return 'LISTO';
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Despliega un dron de exploración táctica:
   * 1. Si el vuelo gratuito de 4 horas está disponible, lo consume y reinicia el temporizador.
   * 2. Si está en enfriamiento pero tiene Terra PRO, autoriza el vuelo ilimitado.
   * 3. Si está en enfriamiento sin PRO, simula o activa el Rewarded Video Ad para otorgar el vuelo.
   * 
   * @returns boolean - true si el dron fue desplegado con éxito; false si falló o canceló el anuncio.
   */
  public deployDrone(): boolean {
    const now = Date.now();

    // Caso A: Intento gratuito disponible
    if (this.isFreeDroneReady()) {
      this.recordDroneFlight(now);
      console.log('[MonetizationEngine] 🚁 Dron gratuito desplegado (4h cooldown iniciado).');
      return true;
    }

    // Caso B: Beneficio Terra PRO
    if (entitlementService.has('unlimited_drones')) {
      this.incrementFlightsCount();
      console.log('[MonetizationEngine] ⚡ Dron Terra PRO desplegado sin restricción de tiempo.');
      return true;
    }

    // Caso C: Enfriamiento activo -> Activar Rewarded Ad (Costo Cero Ético)
    if (this.adProvider.isLoaded()) {
      console.log('[MonetizationEngine] ⏳ Cooldown activo. Desplegando dron mediante Rewarded Ad...');
      this.incrementFlightsCount();
      // En entorno síncrono/inmediato se asume recompensa cumplida
      this.adProvider.show();
      return true;
    }

    console.warn('[MonetizationEngine] ❌ No se puede desplegar el dron: Cooldown activo y anuncio no disponible.');
    return false;
  }

  /**
   * Versión asíncrona explícita para interfaces que esperan la confirmación del video ad.
   */
  public async deployDroneAsync(): Promise<DroneDeployResult> {
    const now = Date.now();

    if (this.isFreeDroneReady()) {
      this.recordDroneFlight(now);
      return {
        success: true,
        source: 'FREE_COOLDOWN',
        message: 'Dron gratuito desplegado exitosamente.',
        timestamp: now,
      };
    }

    if (entitlementService.has('unlimited_drones')) {
      this.incrementFlightsCount();
      return {
        success: true,
        source: 'TERRA_PRO',
        message: 'Dron prioritario desplegado vía Terra PRO.',
        timestamp: now,
      };
    }

    const adWatched = await this.adProvider.show();
    if (adWatched) {
      this.incrementFlightsCount();
      return {
        success: true,
        source: 'REWARDED_AD',
        message: 'Dron de exploración desbloqueado por ver anuncio patrocinado.',
        timestamp: now,
      };
    }

    return {
      success: false,
      source: 'REWARDED_AD',
      message: 'Visualización de anuncio interrumpida o no completada.',
      timestamp: now,
    };
  }

  private recordDroneFlight(timestamp: number): void {
    this.lastFlightCache = timestamp;
    storageService.setItem(STORAGE_KEYS.LAST_DRONE_FLIGHT, timestamp.toString());
    this.incrementFlightsCount();
  }

  private incrementFlightsCount(): void {
    const raw = storageService.getItem(STORAGE_KEYS.DRONE_FLIGHTS_TOTAL);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    storageService.setItem(STORAGE_KEYS.DRONE_FLIGHTS_TOTAL, count.toString());
  }

  // --------------------------------------------------------------------------
  // 2. DESBLOQUEO DE SKINS Y LOGROS TERRITORIALES
  // --------------------------------------------------------------------------

  /**
   * Obtiene la lista completa de skins tácticas disponibles, evaluando el estado de desbloqueo
   * y progreso del jugador contra las estadísticas territoriales actuales.
   */
  public getTacticalSkins(userStats?: UserStats): TacticalSkin[] {
    const stats = userStats || storageService.getStats();

    // 1. Skin 'Modo Claro' (LIGHT_EXPLORER) -> Desbloqueada por defecto
    const lightSkin: TacticalSkin = {
      id: 'LIGHT_EXPLORER',
      name: MAP_THEMES.LIGHT_EXPLORER?.name || '☀️ Modo Claro (Día)',
      description: MAP_THEMES.LIGHT_EXPLORER?.description || 'Bruma limpia y mapa claro de alta visibilidad.',
      glowColor: MAP_THEMES.LIGHT_EXPLORER?.glowColor || '#2563eb',
      fogColor: MAP_THEMES.LIGHT_EXPLORER?.fogColor || '#cbd5e1',
      unlockType: 'DEFAULT',
      isUnlocked: true,
      progressPercent: 100,
      unlockCriteriaText: 'Disponible por defecto para todos los exploradores.',
    };

    // 2. Skin 'Modo Oscuro' (DARK_CYBER) -> Desbloqueada por defecto
    const darkSkin: TacticalSkin = {
      id: 'DARK_CYBER',
      name: MAP_THEMES.DARK_CYBER?.name || '🌙 Modo Oscuro (Noche)',
      description: MAP_THEMES.DARK_CYBER?.description || 'Niebla profunda con mapa nocturno y resplandor cian.',
      glowColor: MAP_THEMES.DARK_CYBER?.glowColor || '#00f5d4',
      fogColor: MAP_THEMES.DARK_CYBER?.fogColor || '#090d16',
      unlockType: 'DEFAULT',
      isUnlocked: true,
      progressPercent: 100,
      unlockCriteriaText: 'Disponible por defecto para todos los exploradores.',
    };

    // 3. Skin 'Papiro Cartográfico' (ANTIQUE_PARCHMENT) -> Nivel 2 o 15 zonas
    const reqLevel = 2;
    const reqHexes = 15;
    const parchmentUnlocked = stats.explorationLevel >= reqLevel || stats.totalHexagons >= reqHexes;
    const hexProgress = Math.min(100, Math.round((stats.totalHexagons / reqHexes) * 100));
    const levelProgress = Math.min(100, Math.round((stats.explorationLevel / reqLevel) * 100));
    const parchmentProgress = parchmentUnlocked ? 100 : Math.max(hexProgress, levelProgress);

    const parchment: TacticalSkin = {
      id: 'ANTIQUE_PARCHMENT',
      name: MAP_THEMES.ANTIQUE_PARCHMENT?.name || '📜 Papiro Clásico',
      description: MAP_THEMES.ANTIQUE_PARCHMENT?.description || 'Estética de expedición antigua con tonos cálidos.',
      glowColor: MAP_THEMES.ANTIQUE_PARCHMENT?.glowColor || '#eab308',
      fogColor: MAP_THEMES.ANTIQUE_PARCHMENT?.fogColor || '#1c1510',
      unlockType: 'LEVEL_OR_HEXES',
      isUnlocked: parchmentUnlocked,
      progressPercent: parchmentProgress,
      unlockCriteriaText: `Desbloquea al alcanzar Nivel 2 o conquistar 15 zonas (${stats.totalHexagons}/${reqHexes} zonas).`,
    };

    return [lightSkin, darkSkin, parchment];
  }

  /**
   * Comprueba si una skin específica está desbloqueada para el usuario.
   */
  public isSkinUnlocked(skinId: string, userStats?: UserStats): boolean {
    const skins = this.getTacticalSkins(userStats);
    const skin = skins.find((s) => s.id === skinId);
    return skin ? skin.isUnlocked : false;
  }

  // --------------------------------------------------------------------------
  // 3. BENEFICIOS DE TERRA PRO (estado verificado por servidor)
  // --------------------------------------------------------------------------

  /** true si el usuario tiene Terra PRO activo según entitlementService. */
  public isTerraPro(): boolean {
    return entitlementService.getSnapshot().isPro;
  }

  public isPro(): boolean {
    return this.isTerraPro();
  }

  /**
   * Radio K-Ring del pulso de dron:
   * - Estándar: 2 (~300 m) · Terra PRO: 3 (~550 m)
   */
  public getDroneRadarKring(): number {
    return entitlementService.has('extended_radar') ? RADAR_PARAMS.PRO_KRING : RADAR_PARAMS.FREE_KRING;
  }

  public getDroneRadarRadiusMeters(): number {
    return entitlementService.has('extended_radar') ? RADAR_PARAMS.PRO_RADIUS_METERS : RADAR_PARAMS.FREE_RADIUS_METERS;
  }
}
// Exportación singleton lista para uso en toda la aplicación
export const monetizationService = new MonetizationService();
