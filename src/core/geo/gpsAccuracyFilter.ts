/**
 * TerraMaps Geo Core - GPS Accuracy & Kinematic Teleportation Filter
 * 
 * Resuelve la queja #1 de Fog of World y Strut:
 * Saltos erráticos de GPS cuando el usuario entra en túneles, metro o cañones urbanos,
 * trazando líneas rectas irreales ("efecto fantasma") que arruinan el mapa.
 * 
 * Funcionalidades:
 * 1. Descarte de lecturas con baja precisión horizontal (> 45m).
 * 2. Speed-Gate Filter: Comprueba si la aceleración o velocidad entre puntos consecutivos
 *    supera límites físicos humanos/vehiculares según el modo de transporte activo.
 * 3. Detección y rechazo de picos de teletransporte (Spikes).
 */

import { haversineDistanceMeters } from '../battery/batteryShield';
import { validateCoordinates } from '../security';

export interface RawGpsPoint {
  latitude: number;
  longitude: number;
  timestampMs: number;
  accuracyMeters?: number;
  speedMps?: number;
}

export interface GpsFilterResult {
  isValid: boolean;
  isSpike: boolean;
  rejectedReason?: string;
  smoothedPoint: [number, number]; // [lng, lat]
  calculatedSpeedKmh: number;
}

export interface GpsFilterConfig {
  maxAccuracyMeters: number;     // Máximo error de satélite tolerado (default: 45m)
  maxGroundSpeedKmh: number;     // Velocidad terrestre máxima creíble (default: 160 km/h)
  maxFlightSpeedKmh: number;     // Velocidad aérea máxima creíble (default: 950 km/h)
  minTimeDeltaMs: number;        // Tiempo mínimo entre lecturas (default: 300ms)
}

export const DEFAULT_GPS_FILTER_CONFIG: GpsFilterConfig = {
  maxAccuracyMeters: 45,
  maxGroundSpeedKmh: 160,
  maxFlightSpeedKmh: 950,
  minTimeDeltaMs: 300,
};

export class GpsAccuracyFilter {
  private lastAcceptedPoint: RawGpsPoint | null = null;
  private config: GpsFilterConfig;

  constructor(config: Partial<GpsFilterConfig> = {}) {
    this.config = { ...DEFAULT_GPS_FILTER_CONFIG, ...config };
  }

  /**
   * Procesa un punto GPS entrante y determina si debe registrarse en el motor H3.
   */
  public processPoint(
    point: RawGpsPoint,
    isFlightMode: boolean = false
  ): GpsFilterResult {
    // 1. Validación de elipsoide WGS84 y números finitos
    if (!validateCoordinates(point.latitude, point.longitude)) {
      return {
        isValid: false,
        isSpike: true,
        rejectedReason: 'Coordenadas fuera de rango WGS84 o no numéricas.',
        smoothedPoint: [point.longitude, point.latitude],
        calculatedSpeedKmh: 0,
      };
    }

    // 2. Comprobación de precisión horizontal del satélite
    if (point.accuracyMeters !== undefined && point.accuracyMeters > this.config.maxAccuracyMeters) {
      return {
        isValid: false,
        isSpike: false,
        rejectedReason: `Precisión deficiente (${Math.round(point.accuracyMeters)}m > ${this.config.maxAccuracyMeters}m).`,
        smoothedPoint: [point.longitude, point.latitude],
        calculatedSpeedKmh: 0,
      };
    }

    // Si es el primer punto, se acepta como ancla inicial
    if (!this.lastAcceptedPoint) {
      this.lastAcceptedPoint = point;
      return {
        isValid: true,
        isSpike: false,
        smoothedPoint: [point.longitude, point.latitude],
        calculatedSpeedKmh: 0,
      };
    }

    // 3. Cálculo de cinemática respecto al último punto válido
    const dtSeconds = Math.max(0.1, (point.timestampMs - this.lastAcceptedPoint.timestampMs) / 1000);
    const distanceMeters = haversineDistanceMeters(
      { latitude: this.lastAcceptedPoint.latitude, longitude: this.lastAcceptedPoint.longitude },
      { latitude: point.latitude, longitude: point.longitude }
    );

    const speedMps = distanceMeters / dtSeconds;
    const speedKmh = speedMps * 3.6;

    const speedLimit = isFlightMode ? this.config.maxFlightSpeedKmh : this.config.maxGroundSpeedKmh;

    // 4. Speed-Gate: Detección de teletransporte anómalo
    if (speedKmh > speedLimit) {
      return {
        isValid: false,
        isSpike: true,
        rejectedReason: `Salto anómalo detectado: ${Math.round(speedKmh)} km/h excede el límite (${speedLimit} km/h).`,
        smoothedPoint: [this.lastAcceptedPoint.longitude, this.lastAcceptedPoint.latitude],
        calculatedSpeedKmh: speedKmh,
      };
    }

    // Punto aceptado y validado
    this.lastAcceptedPoint = point;

    return {
      isValid: true,
      isSpike: false,
      smoothedPoint: [point.longitude, point.latitude],
      calculatedSpeedKmh: Math.round(speedKmh * 10) / 10,
    };
  }

  /**
   * Restablece el estado del filtro (útil tras pausar tracking o teletransporte simulado deliberado)
   */
  public reset(anchorPoint?: RawGpsPoint): void {
    this.lastAcceptedPoint = anchorPoint || null;
  }
}

export const gpsAccuracyFilter = new GpsAccuracyFilter();
