import { storageService } from './storage';
import { haversineDistanceMeters } from '../core/battery/batteryShield';
import {
  sanitizeString,
  safeJsonParse,
  validateCoordinates,
} from '@/core/security';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
}

export interface RecordedRoute {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  newHexCount: number;
  newAreaKm2: number;
  coordinates: [number, number][]; // [lng, lat]
  dateFormatted: string;
}

const STORAGE_ROUTES_KEY = '@terramaps_recorded_routes_v1';

class RouteTrackerService {
  private isRecording: boolean = false;
  private currentRouteId: string | null = null;
  private startTime: number = 0;
  private points: RoutePoint[] = [];
  private initialHexCount: number = 0;
  private currentNewHexCount: number = 0;
  private currentTotalDistance: number = 0;
  private maxSpeedMps: number = 0;
  private listeners: Array<(state: { isRecording: boolean; elapsedSeconds: number; distanceMeters: number }) => void> = [];
  private timerInterval: any = null;

  constructor() {
    this.seedInitialRoutesIfEmpty();
  }

  private seedInitialRoutesIfEmpty() {
    try {
      const stored = storageService.getItem(STORAGE_ROUTES_KEY);
      if (!stored) {
        const sampleRoutes: RecordedRoute[] = [
          {
            id: 'route_sample_1',
            title: 'Expedición Matutina por el Parque',
            startTime: Date.now() - 86400000 * 1.5,
            endTime: Date.now() - 86400000 * 1.5 + 1850000,
            durationSeconds: 1850, // ~30 min 50 seg
            distanceMeters: 2420, // 2.42 km
            avgSpeedKmh: 4.7,
            maxSpeedKmh: 6.2,
            newHexCount: 14,
            newAreaKm2: 1.41,
            coordinates: [
              [-99.1332, 19.4326],
              [-99.1340, 19.4335],
              [-99.1355, 19.4348],
              [-99.1370, 19.4360],
              [-99.1382, 19.4372],
            ],
            dateFormatted: 'Ayer, 08:30 hrs',
          },
          {
            id: 'route_sample_2',
            title: 'Conquista del Centro Histórico',
            startTime: Date.now() - 86400000 * 0.4,
            endTime: Date.now() - 86400000 * 0.4 + 2700000,
            durationSeconds: 2700, // 45 min
            distanceMeters: 3850, // 3.85 km
            avgSpeedKmh: 5.1,
            maxSpeedKmh: 7.0,
            newHexCount: 22,
            newAreaKm2: 2.21,
            coordinates: [
              [-99.1332, 19.4326],
              [-99.1320, 19.4310],
              [-99.1305, 19.4295],
              [-99.1280, 19.4270],
            ],
            dateFormatted: 'Hoy, 12:15 hrs',
          },
        ];
        storageService.setItem(STORAGE_ROUTES_KEY, JSON.stringify(sampleRoutes));
      }
    } catch {
      // Ignorar fallas de seed
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getElapsedSeconds(): number {
    if (!this.isRecording) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public getCurrentDistanceMeters(): number {
    return this.currentTotalDistance;
  }

  public startRecording(currentHexCount: number = 0): void {
    if (this.isRecording) return;

    this.isRecording = true;
    this.currentRouteId = `route_${Date.now()}`;
    this.startTime = Date.now();
    this.points = [];
    this.initialHexCount = currentHexCount;
    this.currentNewHexCount = 0;
    this.currentTotalDistance = 0;
    this.maxSpeedMps = 0;

    this.timerInterval = setInterval(() => {
      this.notifyListeners();
    }, 1000);

    this.notifyListeners();
  }

  public addLocationPoint(
    latitude: number,
    longitude: number,
    speedMps: number = 0,
    newHexUnlocked: boolean = false
  ): void {
    if (!this.isRecording) return;

    const now = Date.now();
    const newPoint: RoutePoint = {
      latitude,
      longitude,
      timestamp: now,
      speed: speedMps,
    };

    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1];
      const dist = haversineDistanceMeters(
        { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
        { latitude, longitude }
      );
      // Evitar jitter de GPS
      if (dist >= 1.5 && dist < 500) {
        this.currentTotalDistance += dist;
      }
    }

    if (speedMps > this.maxSpeedMps) {
      this.maxSpeedMps = speedMps;
    }

    if (newHexUnlocked) {
      this.currentNewHexCount += 1;
    }

    this.points.push(newPoint);
    this.notifyListeners();
  }

  public async stopRecording(customTitle?: string): Promise<RecordedRoute | null> {
    if (!this.isRecording) return null;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const endTime = Date.now();
    const durationSeconds = Math.max(1, Math.floor((endTime - this.startTime) / 1000));
    const distanceKm = this.currentTotalDistance / 1000;
    const hours = durationSeconds / 3600;
    const avgSpeedKmh = hours > 0 ? parseFloat((distanceKm / hours).toFixed(1)) : 0;
    const maxSpeedKmh = parseFloat((this.maxSpeedMps * 3.6).toFixed(1));
    const newAreaKm2 = parseFloat((this.currentNewHexCount * 0.1007).toFixed(2));

    const date = new Date(this.startTime);
    const dateFormatted = `${date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
    })}, ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs`;

    const safeTitle = customTitle
      ? sanitizeString(customTitle, 60)
      : `Expedición de ${(durationSeconds / 60).toFixed(0)} min`;

    // Limitar coordenadas por ruta (máx 5000 puntos) para proteger almacenamiento
    const coordinates: [number, number][] = this.points
      .slice(0, 5000)
      .filter((p) => validateCoordinates(p.latitude, p.longitude))
      .map((p) => [
        parseFloat(p.longitude.toFixed(5)),
        parseFloat(p.latitude.toFixed(5)),
      ]);

    const newRoute: RecordedRoute = {
      id: this.currentRouteId || `route_${Date.now()}`,
      title: safeTitle,
      startTime: this.startTime,
      endTime,
      durationSeconds,
      distanceMeters: Math.round(this.currentTotalDistance),
      avgSpeedKmh,
      maxSpeedKmh,
      newHexCount: this.currentNewHexCount,
      newAreaKm2,
      coordinates,
      dateFormatted,
    };

    // Guardar en Storage
    await this.saveRoute(newRoute);

    // Reset
    this.isRecording = false;
    this.currentRouteId = null;
    this.points = [];
    this.notifyListeners();

    return newRoute;
  }

  public async getRoutes(): Promise<RecordedRoute[]> {
    try {
      const stored = storageService.getItem(STORAGE_ROUTES_KEY);
      if (!stored) return [];
      const list = safeJsonParse<RecordedRoute[]>(stored, [], 5 * 1024 * 1024);
      if (!Array.isArray(list)) return [];

      // Validar cada ruta recuperada
      const validatedList = list.filter((r) => (
        r &&
        typeof r.id === 'string' &&
        typeof r.title === 'string' &&
        Number.isFinite(r.startTime) &&
        Number.isFinite(r.distanceMeters) &&
        Array.isArray(r.coordinates)
      )).map((r) => ({
        ...r,
        title: sanitizeString(r.title, 60),
      }));

      return validatedList.sort((a, b) => b.startTime - a.startTime);
    } catch {
      return [];
    }
  }

  public async saveRoute(route: RecordedRoute): Promise<void> {
    try {
      if (!route || typeof route.id !== 'string') return;
      const sanitizedRoute: RecordedRoute = {
        ...route,
        title: sanitizeString(route.title, 60),
      };

      const existing = await this.getRoutes();
      // Limitar a 100 rutas más recientes para proteger la cuota local
      const updated = [sanitizedRoute, ...existing.filter((r) => r.id !== route.id)].slice(0, 100);
      storageService.setItem(STORAGE_ROUTES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Error al guardar ruta:', err);
    }
  }

  public async deleteRoute(id: string): Promise<void> {
    try {
      const existing = await this.getRoutes();
      const updated = existing.filter((r) => r.id !== id);
      storageService.setItem(STORAGE_ROUTES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Error al eliminar ruta:', err);
    }
  }

  public subscribe(
    callback: (state: { isRecording: boolean; elapsedSeconds: number; distanceMeters: number }) => void
  ): () => void {
    this.listeners.push(callback);
    callback({
      isRecording: this.isRecording,
      elapsedSeconds: this.getElapsedSeconds(),
      distanceMeters: this.currentTotalDistance,
    });
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    const state = {
      isRecording: this.isRecording,
      elapsedSeconds: this.getElapsedSeconds(),
      distanceMeters: this.currentTotalDistance,
    };
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export const routeTrackerService = new RouteTrackerService();
