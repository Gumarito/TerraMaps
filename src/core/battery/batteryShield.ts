/**
 * TerraMaps Battery Shield - 3-Level State Machine
 * 
 * Mathematical and algorithmic engine designed to slash mobile battery drain
 * from continuous GPS tracking by over 80%.
 * 
 * State Logic:
 * ┌──────────────────────────────────────┐
 * │           NIVEL 1: REPOSO            │
 * │  • GPS apagado (0% consumo extra)    │
 * │  • Solo escucha acelerómetro         │
 * └──────────────────┬───────────────────┘
 *                    │
 *     Detecta > 15 pasos de caminata
 *                    │
 *                    ▼
 * ┌──────────────────────────────────────┐
 * │          NIVEL 2: MUESTREO           │
 * │  • Solicita 1 coordenada GPS         │
 * │  • Desbloquea hexágono H3 actual     │
 * │  • Comprueba si el usuario se mueve  │
 * └──────────────────┬───────────────────┘
 *                    │
 *           ¿Velocidad > 3 km/h?
 *                   ╱ ╲
 *            SÍ    ╱   ╲   NO (Se detuvo)
 *                 ▼     ▼
 * ┌──────────────────────────┐   ┌──────────────────────────┐
 * │   NIVEL 3: RUTA ACTIVA   │   │  VUELTA A REPOSO (NIVEL 1)│
 * │ • Muestreo cada 25m      │   │ • GPS se apaga de nuevo  │
 * └──────────────────────────┘   └──────────────────────────┘
 */

import type { H3Engine } from '../geo/h3Engine';
import type { GeoCoordinates } from '../geo/types';
import {
  BatteryShieldState,
  DEFAULT_BATTERY_SHIELD_CONFIG,
  type BatteryShieldConfig,
  type BatteryShieldListeners,
  type BatteryShieldStatus,
  type ILocationProvider,
  type IStepSensorProvider,
  type StateTransitionEvent,
} from './types';

// ============================================================================
// GEODESIC & KINEMATIC UTILITIES
// ============================================================================

const EARTH_RADIUS_METERS = 6371000.0;
const DEG_TO_RAD = Math.PI / 180.0;

/**
 * Calculates Great-Circle distance in meters between two geodetic coordinates
 * using the Haversine formula.
 */
export function haversineDistanceMeters(
  coord1: GeoCoordinates,
  coord2: GeoCoordinates
): number {
  const lat1 = coord1.latitude * DEG_TO_RAD;
  const lon1 = coord1.longitude * DEG_TO_RAD;
  const lat2 = coord2.latitude * DEG_TO_RAD;
  const lon2 = coord2.longitude * DEG_TO_RAD;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLon = Math.sin(dLon / 2);

  const a =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Converts meters per second to kilometers per hour.
 */
export function speedMpsToKmh(speedMps: number): number {
  return speedMps * 3.6;
}

/**
 * Calculates velocity in km/h between two timestamped coordinates.
 * Returns 0 if time difference is invalid or <= 0.
 */
export function calculateSpeedKmH(
  current: GeoCoordinates,
  previous: GeoCoordinates | null
): number {
  // If GPS device directly reported a valid non-negative speed
  if (current.speed !== undefined && current.speed !== null && current.speed >= 0) {
    return speedMpsToKmh(current.speed);
  }

  // Fallback to Haversine displacement over delta time
  if (!previous || !current.timestamp || !previous.timestamp) {
    return 0;
  }

  const deltaSeconds = (current.timestamp - previous.timestamp) / 1000.0;
  if (deltaSeconds <= 0.1) {
    return 0;
  }

  const distanceMeters = haversineDistanceMeters(previous, current);
  const speedMps = distanceMeters / deltaSeconds;
  return speedMpsToKmh(speedMps);
}

// ============================================================================
// BATTERY SHIELD STATE MACHINE
// ============================================================================

export class BatteryShield {
  private readonly _h3Engine: H3Engine;
  private readonly _locationProvider: ILocationProvider;
  private readonly _stepSensor: IStepSensorProvider;
  private readonly _config: BatteryShieldConfig;
  private readonly _listeners: BatteryShieldListeners;

  // Machine state
  private _state: BatteryShieldState = BatteryShieldState.LEVEL_1_IDLE;
  private _isRunning: boolean = false;
  private _isTransitioning: boolean = false;

  // Tracking metrics
  private _stepBaseline: number | null = null;
  private _accumulatedStepsInIdle: number = 0;
  private _lastFixCoordinate: GeoCoordinates | null = null;
  private _lastFixTimestamp: number | null = null;
  private _lastSpeedKmH: number | null = null;
  private _consecutiveLowSpeedCount: number = 0;
  private _stationaryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    h3Engine: H3Engine,
    locationProvider: ILocationProvider,
    stepSensor: IStepSensorProvider,
    config: Partial<BatteryShieldConfig> = {},
    listeners: BatteryShieldListeners = {}
  ) {
    this._h3Engine = h3Engine;
    this._locationProvider = locationProvider;
    this._stepSensor = stepSensor;
    this._config = { ...DEFAULT_BATTERY_SHIELD_CONFIG, ...config };
    this._listeners = listeners;
  }

  // ==========================================================================
  // GETTERS & STATUS
  // ==========================================================================

  public get state(): BatteryShieldState {
    return this._state;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get config(): Readonly<BatteryShieldConfig> {
    return this._config;
  }

  public getStatus(): BatteryShieldStatus {
    return {
      currentState: this._state,
      isRunning: this._isRunning,
      accumulatedStepsInIdle: this._accumulatedStepsInIdle,
      lastSpeedKmH: this._lastSpeedKmH,
      lastFixCoordinate: this._lastFixCoordinate,
      lastFixTimestamp: this._lastFixTimestamp,
      consecutiveLowSpeedCount: this._consecutiveLowSpeedCount,
    };
  }

  // ==========================================================================
  // LIFECYCLE CONTROLS
  // ==========================================================================

  /**
   * Starts the Battery-Shield system in LEVEL_1_IDLE.
   */
  public async start(): Promise<void> {
    if (this._isRunning) return;
    this._isRunning = true;
    await this.enterLevel1Idle('SYSTEM_STARTED');
  }

  /**
   * Completely stops all tracking, powers down GPS, unregisters sensors.
   */
  public async stop(): Promise<void> {
    if (!this._isRunning) return;
    this._isRunning = false;
    this.clearStationaryTimer();

    try {
      await Promise.allSettled([
        this._locationProvider.stopTracking(),
        this._stepSensor.stopStepCounter(),
      ]);
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * Manually triggers a single high-accuracy GPS fix (e.g. user opens map).
   */
  public async forceSample(): Promise<void> {
    if (!this._isRunning) return;
    await this.performLevel2Sampling('USER_FORCE_SAMPLE');
  }

  // ==========================================================================
  // LEVEL 1: REPOSO (IDLE)
  // ==========================================================================

  private async enterLevel1Idle(reason: string): Promise<void> {
    const prevState = this._state;
    this._state = BatteryShieldState.LEVEL_1_IDLE;

    // Reset idle accumulation metrics
    this._stepBaseline = null;
    this._accumulatedStepsInIdle = 0;
    this._consecutiveLowSpeedCount = 0;
    this.clearStationaryTimer();

    this.notifyStateChange(prevState, BatteryShieldState.LEVEL_1_IDLE, reason);

    try {
      // 1. Ensure GPS is completely turned off (0% extra battery drain)
      await this._locationProvider.stopTracking();

      // 2. Start pedometer / accelerometer listener
      const available = await this._stepSensor.isAvailable();
      if (!available) {
        // Fallback: If hardware pedometer unavailable, stay idle or sample intermittently
        return;
      }

      await this._stepSensor.startStepCounter(this.handleStepUpdate.bind(this));
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * Handles raw step updates from the accelerometer/pedometer.
   */
  private handleStepUpdate(stepValue: number): void {
    if (this._state !== BatteryShieldState.LEVEL_1_IDLE || !this._isRunning) {
      return;
    }

    // Support both cumulative hardware counters and delta counters
    if (this._stepBaseline === null) {
      // If sensor emits a large cumulative number (e.g. 1024), store baseline
      if (stepValue > 50) {
        this._stepBaseline = stepValue;
        this._accumulatedStepsInIdle = 0;
        return;
      }
      this._stepBaseline = 0;
      this._accumulatedStepsInIdle = stepValue;
    } else if (this._stepBaseline > 0) {
      // Cumulative mode: delta from baseline
      this._accumulatedStepsInIdle = Math.max(0, stepValue - this._stepBaseline);
    } else {
      // Incremental mode: accumulate
      this._accumulatedStepsInIdle += stepValue;
    }

    // Check transition condition: > 15 steps
    if (this._accumulatedStepsInIdle >= this._config.stepThreshold) {
      void this.transitionFromLevel1ToLevel2();
    }
  }

  private async transitionFromLevel1ToLevel2(): Promise<void> {
    if (this._isTransitioning) return;
    this._isTransitioning = true;

    try {
      // Mute step sensor during GPS acquisition
      await this._stepSensor.stopStepCounter();
      await this.performLevel2Sampling(
        `STEP_THRESHOLD_EXCEEDED (${this._accumulatedStepsInIdle} steps)`
      );
    } catch (err) {
      this.handleError(err);
      // Fallback return to Level 1
      await this.enterLevel1Idle('ERROR_DURING_LEVEL_1_TO_2_TRANSITION');
    } finally {
      this._isTransitioning = false;
    }
  }

  // ==========================================================================
  // LEVEL 2: MUESTREO (SAMPLING)
  // ==========================================================================

  private async performLevel2Sampling(reason: string): Promise<void> {
    const prevState = this._state;
    this._state = BatteryShieldState.LEVEL_2_SAMPLING;
    this.notifyStateChange(prevState, BatteryShieldState.LEVEL_2_SAMPLING, reason);

    try {
      // Request 1 single high-accuracy GPS fix
      const fix = await this._locationProvider.requestSingleAccurateFix(
        this._config.samplingTimeoutMs
      );

      // Process H3 hex exploration
      const discovery = this._h3Engine.processLocation(
        fix,
        this._config.visionRadiusK
      );

      // Evaluate speed
      const speedKmH = calculateSpeedKmH(fix, this._lastFixCoordinate);
      this._lastSpeedKmH = speedKmH;
      this._lastFixCoordinate = fix;
      this._lastFixTimestamp = fix.timestamp ?? Date.now();

      // Emit discovery and metrics
      this._listeners.onLocationSample?.(fix, discovery);
      this._listeners.onMetricsUpdate?.(discovery.metrics);

      // Branching decision:
      // ¿Velocidad > 3 km/h?
      if (speedKmH > this._config.speedThresholdKmH) {
        // SÍ -> Promover a NIVEL 3: RUTA ACTIVA
        await this.enterLevel3ActiveRoute(
          `SPEED_EXCEEDED_THRESHOLD (${speedKmH.toFixed(1)} km/h > ${this._config.speedThresholdKmH} km/h)`
        );
      } else {
        // NO (Se detuvo o fue un falso positivo de movimiento) -> VUELTA A NIVEL 1
        await this.enterLevel1Idle(
          `SPEED_BELOW_THRESHOLD (${speedKmH.toFixed(1)} km/h <= ${this._config.speedThresholdKmH} km/h)`
        );
      }
    } catch (err) {
      this.handleError(err);
      // If GPS lock timed out or failed, conserve power by returning to Level 1
      await this.enterLevel1Idle('GPS_SAMPLING_FAILED');
    }
  }

  // ==========================================================================
  // LEVEL 3: RUTA ACTIVA (ACTIVE ROUTE)
  // ==========================================================================

  private async enterLevel3ActiveRoute(reason: string): Promise<void> {
    const prevState = this._state;
    this._state = BatteryShieldState.LEVEL_3_ACTIVE_ROUTE;
    this._consecutiveLowSpeedCount = 0;
    this.notifyStateChange(prevState, BatteryShieldState.LEVEL_3_ACTIVE_ROUTE, reason);

    try {
      // Start distance-based tracking every 25 meters
      await this._locationProvider.startDistanceTracking(
        this._config.routeDistanceFilterMeters,
        this.handleRouteLocationUpdate.bind(this)
      );

      // Arm watchdog timer for stationary timeout
      this.resetStationaryTimer();
    } catch (err) {
      this.handleError(err);
      await this.enterLevel1Idle('ROUTE_TRACKING_FAILED_TO_START');
    }
  }

  /**
   * Distance-filtered GPS update received during active route.
   */
  private handleRouteLocationUpdate(fix: GeoCoordinates): void {
    if (this._state !== BatteryShieldState.LEVEL_3_ACTIVE_ROUTE || !this._isRunning) {
      return;
    }

    // Process H3 hex exploration
    const discovery = this._h3Engine.processLocation(
      fix,
      this._config.visionRadiusK
    );

    // Compute velocity
    const speedKmH = calculateSpeedKmH(fix, this._lastFixCoordinate);
    this._lastSpeedKmH = speedKmH;
    this._lastFixCoordinate = fix;
    this._lastFixTimestamp = fix.timestamp ?? Date.now();

    this._listeners.onLocationSample?.(fix, discovery);
    this._listeners.onMetricsUpdate?.(discovery.metrics);

    // Speed evaluation:
    if (speedKmH > this._config.speedThresholdKmH) {
      // Active movement sustained -> reset decay counters
      this._consecutiveLowSpeedCount = 0;
      this.resetStationaryTimer();
    } else {
      // Speed decayed below threshold
      this._consecutiveLowSpeedCount++;
      if (this._consecutiveLowSpeedCount >= this._config.consecutiveLowSpeedThreshold) {
        // User stopped walking/moving -> Return to Level 1
        void this.enterLevel1Idle(
          `CONSECUTIVE_LOW_SPEED_THRESHOLD_REACHED (${this._consecutiveLowSpeedCount} samples)`
        );
      }
    }
  }

  // ==========================================================================
  // TIMERS & HELPERS
  // ==========================================================================

  private resetStationaryTimer(): void {
    this.clearStationaryTimer();
    this._stationaryTimer = setTimeout(() => {
      if (this._state === BatteryShieldState.LEVEL_3_ACTIVE_ROUTE && this._isRunning) {
        void this.enterLevel1Idle('STATIONARY_TIMEOUT_EXPIRED');
      }
    }, this._config.stopDetectionTimeoutMs);
  }

  private clearStationaryTimer(): void {
    if (this._stationaryTimer !== null) {
      clearTimeout(this._stationaryTimer);
      this._stationaryTimer = null;
    }
  }

  private notifyStateChange(
    from: BatteryShieldState,
    to: BatteryShieldState,
    reason: string
  ): void {
    const event: StateTransitionEvent = {
      from,
      to,
      reason,
      timestamp: Date.now(),
    };
    this._listeners.onStateChange?.(event);
  }

  private handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this._listeners.onError?.(err);
  }
}
