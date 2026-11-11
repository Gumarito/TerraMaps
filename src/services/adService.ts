/**
 * TerraMaps - Universal Ad Service (Rewarded Ads & Discreet Banners)
 * 
 * Diseñado para generar ingresos sostenibles con cero fricción:
 * 1. Rewarded Ads: Videos cortos voluntarios a cambio de recompensas reales
 *    (Recargar Dron de Exploración, Desbloquear Temas 24h, Escudo de Racha).
 * 2. Banners Nativos: Ubicados exclusivamente en vistas secundarias (Historial de Rutas).
 * 3. Híbrido Web & Nativo: Enlace directo a AdMob en móvil y simulador publicitario limpio en Web.
 */

import { storageService } from './storage';
import { streakService } from './streakService';
import { monetizationService } from './monetizationService';

export type RewardType = 'drone' | 'theme' | 'streak_shield';

export interface AdRewardResult {
  success: boolean;
  rewardType: RewardType;
  message: string;
}

export interface AdRewardState {
  isShowingAd: boolean;
  currentRewardType: RewardType | null;
  secondsRemaining: number;
  sponsorName: string;
  sponsorTagline: string;
}

const STORAGE_KEY_UNLOCKED_THEMES_EXPIRY = '@terramaps_theme_ad_expiry';
const STORAGE_KEY_ADS_WATCHED_TODAY = '@terramaps_ads_watched_today';

type AdListener = (state: AdRewardState) => void;

class AdService {
  private listeners: Set<AdListener> = new Set();
  private state: AdRewardState = {
    isShowingAd: false,
    currentRewardType: null,
    secondsRemaining: 0,
    sponsorName: 'Outdoor Gear & GPS Tech',
    sponsorTagline: 'Equipamiento ultraligero para exploradores urbanos y senderistas.',
  };

  private timerInterval: any = null;
  private resolveAdPromise: ((result: AdRewardResult) => void) | null = null;

  constructor() {
    this.checkExpiredThemes();
  }

  private checkExpiredThemes(): void {
    const expiryStr = storageService.getItem(STORAGE_KEY_UNLOCKED_THEMES_EXPIRY);
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (Date.now() > expiry) {
        storageService.removeItem(STORAGE_KEY_UNLOCKED_THEMES_EXPIRY);
      }
    }
  }

  public getAreThemesUnlockedByAd(): boolean {
    const expiryStr = storageService.getItem(STORAGE_KEY_UNLOCKED_THEMES_EXPIRY);
    if (!expiryStr) return false;
    const expiry = parseInt(expiryStr, 10);
    return Date.now() < expiry;
  }

  public getAdState(): AdRewardState {
    return { ...this.state };
  }

  public subscribe(listener: AdListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch {
        // Ignorar
      }
    }
  }

  /**
   * Dispara un Rewarded Ad interactivo
   */
  public requestRewardedAd(rewardType: RewardType): Promise<AdRewardResult> {
    if (this.state.isShowingAd) {
      return Promise.resolve({
        success: false,
        rewardType,
        message: 'Ya hay un anuncio en reproducción.',
      });
    }

    return new Promise((resolve) => {
      this.resolveAdPromise = resolve;
      this.state = {
        isShowingAd: true,
        currentRewardType: rewardType,
        secondsRemaining: 6, // 6 segundos en entorno web/simulado
        sponsorName: 'Explora+ Outdoors',
        sponsorTagline: 'Zapatos de trekking y mapas topográficos de alta resistencia.',
      };
      this.notify();

      if (this.timerInterval) clearInterval(this.timerInterval);

      this.timerInterval = setInterval(() => {
        if (this.state.secondsRemaining > 1) {
          this.state.secondsRemaining -= 1;
          this.notify();
        } else {
          // Completado
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          this.grantReward(rewardType);
        }
      }, 1000);
    });
  }

  public cancelAd(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const rewardType = this.state.currentRewardType || 'drone';
    this.state = {
      isShowingAd: false,
      currentRewardType: null,
      secondsRemaining: 0,
      sponsorName: '',
      sponsorTagline: '',
    };
    this.notify();

    if (this.resolveAdPromise) {
      this.resolveAdPromise({
        success: false,
        rewardType,
        message: 'Anuncio omitido antes de tiempo. No se entregó la recompensa.',
      });
      this.resolveAdPromise = null;
    }
  }

  private grantReward(rewardType: RewardType): void {
    let message = '¡Recompensa desbloqueada!';

    if (rewardType === 'drone') {
      // Recarga inmediata del Dron
      monetizationService.resetDroneCooldown();
      message = '⚡ ¡Dron Explorador recargado y listo para desplegar!';
    } else if (rewardType === 'theme') {
      // Desbloquea todos los temas durante 24 horas
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      storageService.setItem(STORAGE_KEY_UNLOCKED_THEMES_EXPIRY, expiry.toString());
      message = '🎨 ¡Todos los estilos de mapa desbloqueados por 24 horas!';
    } else if (rewardType === 'streak_shield') {
      // Otorga 1 escudo de racha
      streakService.addShield();
      message = '🛡️ ¡Escudo de Racha activado para proteger tu progreso!';
    }

    // Registrar anuncio visto hoy
    try {
      const todayCount = parseInt(storageService.getItem(STORAGE_KEY_ADS_WATCHED_TODAY) || '0', 10);
      storageService.setItem(STORAGE_KEY_ADS_WATCHED_TODAY, (todayCount + 1).toString());
    } catch {
      // Ignorar
    }

    this.state = {
      isShowingAd: false,
      currentRewardType: null,
      secondsRemaining: 0,
      sponsorName: '',
      sponsorTagline: '',
    };
    this.notify();

    if (this.resolveAdPromise) {
      this.resolveAdPromise({
        success: true,
        rewardType,
        message,
      });
      this.resolveAdPromise = null;
    }
  }
}

export const adService = new AdService();
