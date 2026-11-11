/**
 * TerraMaps Battery Shield - Mock & Test Providers
 * 
 * In-memory simulators for ILocationProvider and IStepSensorProvider.
 * Used for automated verification tests, simulated routing, and headless execution.
 */

import type { GeoCoordinates } from '../geo/types';
import type {
  ILocationProvider,
  IStepSensorProvider,
  LocationUpdateCallback,
  StepUpdateCallback,
} from './types';

/**
 * Mock Step Sensor Provider for simulating steps in test and simulator environments.
 */
export class MockStepSensorProvider implements IStepSensorProvider {
  private _isListening: boolean = false;
  private _callback: StepUpdateCallback | null = null;
  public available: boolean = true;

  public async isAvailable(): Promise<boolean> {
    return this.available;
  }

  public async startStepCounter(callback: StepUpdateCallback): Promise<void> {
    this._isListening = true;
    this._callback = callback;
  }

  public async stopStepCounter(): Promise<void> {
    this._isListening = false;
    this._callback = null;
  }

  public get isListening(): boolean {
    return this._isListening;
  }

  /**
   * Simulates the user walking by emitting steps.
   */
  public emitSteps(steps: number): void {
    if (this._isListening && this._callback) {
      this._callback(steps);
    }
  }
}

/**
 * Mock Location Provider for simulating GPS fixes, route walking, and speed.
 */
export class MockLocationProvider implements ILocationProvider {
  public available: boolean = true;
  private _isTracking: boolean = false;
  private _trackingCallback: LocationUpdateCallback | null = null;
  private _currentFix: GeoCoordinates = {
    latitude: 40.7128,
    longitude: -74.006,
    speed: 1.0,
    timestamp: Date.now(),
  };

  public setNextFix(fix: Partial<GeoCoordinates>): void {
    this._currentFix = {
      ...this._currentFix,
      ...fix,
      timestamp: fix.timestamp ?? Date.now(),
    };
  }

  public async isAvailable(): Promise<boolean> {
    return this.available;
  }

  public async requestSingleAccurateFix(_timeoutMs?: number): Promise<GeoCoordinates> {
    return { ...this._currentFix, timestamp: Date.now() };
  }

  public async startDistanceTracking(
    _distanceIntervalMeters: number,
    callback: LocationUpdateCallback
  ): Promise<void> {
    this._isTracking = true;
    this._trackingCallback = callback;
  }

  public async stopTracking(): Promise<void> {
    this._isTracking = false;
    this._trackingCallback = null;
  }

  public get isTracking(): boolean {
    return this._isTracking;
  }

  /**
   * Simulates a distance trigger by emitting a coordinate.
   */
  public emitLocationUpdate(coord: GeoCoordinates): void {
    if (this._isTracking && this._trackingCallback) {
      this._currentFix = coord;
      this._trackingCallback(coord);
    }
  }
}
