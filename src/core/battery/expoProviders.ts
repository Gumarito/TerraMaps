/**
 * TerraMaps Battery Shield - Expo Hardware Adapters
 * 
 * Production-ready implementations of ILocationProvider and IStepSensorProvider
 * wrapping 'expo-location' and 'expo-sensors' (Pedometer).
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Pedometer } from 'expo-sensors';

import type { GeoCoordinates } from '../geo/types';
import type {
  ILocationProvider,
  IStepSensorProvider,
  LocationUpdateCallback,
  StepUpdateCallback,
} from './types';

/** Identificador de la tarea de ubicación en segundo plano. */
export const BACKGROUND_LOCATION_TASK = 'terramaps-background-location';

type BackgroundLocationListener = (coords: GeoCoordinates) => void;

/** Listeners activos; vive a nivel de módulo porque defineTask se registra una sola vez. */
const backgroundListeners = new Set<BackgroundLocationListener>();

interface BackgroundLocationTaskData {
  locations?: Location.LocationObject[];
}

if (Platform.OS !== 'web') {
  // defineTask debe ejecutarse en el ámbito global del módulo (antes de render).
  TaskManager.defineTask<BackgroundLocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    for (const loc of data.locations) {
      const coords: GeoCoordinates = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      };
      backgroundListeners.forEach((fn) => fn(coords));
    }
  });
}

/**
 * Permisos en dos pasos (Android 11+): primero primer plano, luego segundo plano.
 * El segundo paso redirige al usuario a Ajustes, por eso se invoca por separado.
 */
export async function requestForegroundStep(): Promise<boolean> {
  try {
    const res = await Location.requestForegroundPermissionsAsync();
    return res.status === 'granted';
  } catch {
    return false;
  }
}

export async function requestBackgroundStep(): Promise<boolean> {
  try {
    const res = await Location.requestBackgroundPermissionsAsync();
    return res.status === 'granted';
  } catch {
    return false;
  }
}

/** Inicia el seguimiento con pantalla apagada y notificación persistente sobria. */
export async function startBackgroundTracking(
  distanceIntervalMeters: number,
  listener: BackgroundLocationListener
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;

  backgroundListeners.add(listener);
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: distanceIntervalMeters,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TerraMaps · Expedición activa',
      notificationBody: 'Registrando territorio explorado',
      notificationColor: '#0b0f19',
    },
  });
  return true;
}

export async function stopBackgroundTracking(listener?: BackgroundLocationListener): Promise<void> {
  if (listener) backgroundListeners.delete(listener);
  else backgroundListeners.clear();
  if (backgroundListeners.size > 0 || Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

/**
 * Hardware step sensor adapter backed by Expo Pedometer.
 */
export class ExpoStepSensorProvider implements IStepSensorProvider {
  private _subscription: { remove: () => void } | null = null;

  public async isAvailable(): Promise<boolean> {
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  }

  public async startStepCounter(callback: StepUpdateCallback): Promise<void> {
    await this.stopStepCounter();
    const isAvail = await this.isAvailable();
    if (!isAvail) return;

    this._subscription = Pedometer.watchStepCount((result) => {
      if (typeof result.steps === 'number') {
        callback(result.steps);
      }
    });
  }

  public async stopStepCounter(): Promise<void> {
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }
  }
}

/**
 * Hardware GPS location adapter backed by Expo Location.
 */
export class ExpoLocationProvider implements ILocationProvider {
  private _locationSubscription: Location.LocationSubscription | null = null;

  public async isAvailable(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        return req.status === 'granted';
      }
      return true;
    } catch {
      return false;
    }
  }

  public async requestSingleAccurateFix(timeoutMs: number = 10000): Promise<GeoCoordinates> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      throw new Error('Location permissions not granted or sensor unavailable');
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: timeoutMs,
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      timestamp: pos.timestamp,
    };
  }

  public async startDistanceTracking(
    distanceIntervalMeters: number,
    callback: LocationUpdateCallback
  ): Promise<void> {
    await this.stopTracking();

    const isAvail = await this.isAvailable();
    if (!isAvail) {
      throw new Error('Location permissions not granted');
    }

    this._locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: distanceIntervalMeters,
      },
      (loc) => {
        callback({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          timestamp: loc.timestamp,
        });
      }
    );
  }

  public async stopTracking(): Promise<void> {
    if (this._locationSubscription) {
      this._locationSubscription.remove();
      this._locationSubscription = null;
    }
  }
}
