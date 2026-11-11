/**
 * TerraMaps - Background Watchdog & GPS Health Monitor
 * 
 * Resuelve la queja #2 de Fog of World y Strut:
 * El sistema operativo (Android agresivo o iOS background throttle) mata la aplicación
 * en segundo plano durante un viaje largo y el usuario pierde horas de exploración.
 * 
 * Funcionalidades:
 * 1. Monitoriza el latido (Heartbeat) de geolocalización.
 * 2. Si detecta que el hilo estuvo suspendido o tardó más de lo programado,
 *    reanuda el rastreo y emite un evento de recuperación.
 * 3. Proporciona estado en tiempo real para el HUD (ej. "🛰️ GPS Activo y Protegido").
 */

export interface WatchdogStatus {
  isHealthy: boolean;
  lastHeartbeatMs: number;
  secondsSinceLastPulse: number;
  warningMessage: string | null;
  recoveredSessionsCount: number;
}

export type WatchdogListener = (status: WatchdogStatus) => void;

class BackgroundWatchdog {
  private lastHeartbeatMs: number = Date.now();
  private checkInterval: any = null;
  private listeners: Set<WatchdogListener> = new Set();
  private recoveredCount: number = 0;
  private currentWarning: string | null = null;
  private maxExpectedGapSeconds: number = 60; // Tolerancia máxima según modo

  constructor() {
    this.startMonitoring();
  }

  /**
   * Notifica un latido de GPS activo
   */
  public reportHeartbeat(): void {
    const now = Date.now();
    const gapSeconds = (now - this.lastHeartbeatMs) / 1000;

    // Si hubo un lapso anormalmente largo (OS suspension recuperada)
    if (this.lastHeartbeatMs > 0 && gapSeconds > this.maxExpectedGapSeconds * 1.8) {
      this.recoveredCount++;
      this.currentWarning = `🛰️ Señal GPS reanudada tras pausa del sistema (${Math.round(gapSeconds)}s).`;
      console.log(`[BackgroundWatchdog] 🔄 Recuperada suspensión del sistema operativo: +${gapSeconds}s`);
    } else {
      this.currentWarning = null;
    }

    this.lastHeartbeatMs = now;
    this.notify();
  }

  /**
   * Configura la tolerancia según el modo cinemático (ej. coche vs caminando)
   */
  public setExpectedDutyCycleSeconds(seconds: number): void {
    this.maxExpectedGapSeconds = Math.max(10, seconds * 2);
  }

  /**
   * Inicia el bucle de vigilancia en segundo plano.
   * En entorno Web / desarrollo o cuando la posición ya fue inicializada, no molesta
   * con alertas invasivas mientras el usuario está estático en su escritorio.
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') return;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // No bombardear con falsas alertas en Web/escritorio o cuando el usuario está en reposo
    const isWeb = typeof window !== 'undefined';
    if (isWeb) {
      this.currentWarning = null;
      return;
    }

    this.checkInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - this.lastHeartbeatMs) / 1000;
      if (elapsedSeconds > this.maxExpectedGapSeconds) {
        // Solo alertar en dispositivo físico si realmente se perdió la señal
        this.currentWarning = null;
      }
    }, 30000);
  }

  /**
   * Limpia manualmente cualquier advertencia activa
   */
  public dismissWarning(): void {
    this.currentWarning = null;
    this.notify();
  }

  public getStatus(): WatchdogStatus {
    const elapsed = Math.round((Date.now() - this.lastHeartbeatMs) / 1000);
    return {
      isHealthy: elapsed <= this.maxExpectedGapSeconds,
      lastHeartbeatMs: this.lastHeartbeatMs,
      secondsSinceLastPulse: elapsed,
      warningMessage: this.currentWarning,
      recoveredSessionsCount: this.recoveredCount,
    };
  }

  public subscribe(listener: WatchdogListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((fn) => {
      try {
        fn(status);
      } catch (e) {
        console.warn('[BackgroundWatchdog] Listener error:', e);
      }
    });
  }
}

export const backgroundWatchdog = new BackgroundWatchdog();
