/**
 * TerraMaps Battery Shield - Type Definitions
 * 
 * Defines state models, decoupled sensor interfaces, transition payloads,
 * and configuration options for the 3-level anti-battery-drain state machine.
 */

import type { GeoCoordinates, HexagonDiscoveryResult, ExplorationMetrics } from '../geo/types';

// ============================================================================
// STATE MACHINE STATES
// ============================================================================

/**
 * 3-Level State Machine for Battery-Shield Optimization:
 * 
 * - LEVEL_1_IDLE: GPS completely OFF (0% extra battery drain).
 *   Accelerometer/Pedometer listening for movement (> 15 steps).
 * 
 * - LEVEL_2_SAMPLING: Request a single pinpoint GPS coordinate.
 *   Process H3 hexagon and evaluate user speed.
 *   If speed > 3 km/h -> LEVEL_3_ACTIVE_ROUTE.
 *   Else -> Return to LEVEL_1_IDLE (turn off GPS).
 * 
 * - LEVEL_3_ACTIVE_ROUTE: GPS distance-based sampling every 25 meters.
 *   If speed drops below threshold or stops for timeout -> Return to LEVEL_1_IDLE.
 */
export enum BatteryShieldState {
  LEVEL_1_IDLE = 'LEVEL_1_IDLE',
  LEVEL_2_SAMPLING = 'LEVEL_2_SAMPLING',
  LEVEL_3_ACTIVE_ROUTE = 'LEVEL_3_ACTIVE_ROUTE',
}

// ============================================================================
// CONFIGURATION OPTIONS
// ============================================================================

export interface BatteryShieldConfig {
  /**
   * Number of steps detected in Level 1 before transitioning to Level 2 sampling.
   * Default: 15 steps.
   */
  stepThreshold: number;

  /**
   * Speed threshold in km/h to confirm walking/running/cycling movement in Level 2.
   * Speeds above this promote to Level 3; speeds below or equal return to Level 1.
   * Default: 3.0 km/h (~0.833 m/s).
   */
  speedThresholdKmH: number;

  /**
   * Distance filter in meters for continuous tracking in Level 3.
   * Default: 25 meters.
   */
  routeDistanceFilterMeters: number;

  /**
   * Idle timeout in milliseconds while in Level 3 before returning to Level 1
   * when stationary or low speed.
   * Default: 60000 ms (60 seconds).
   */
  stopDetectionTimeoutMs: number;

  /**
   * Number of consecutive low-speed location samples in Level 3 before returning to Level 1.
   * Default: 3 consecutive samples.
   */
  consecutiveLowSpeedThreshold: number;

  /**
   * H3 K-ring exploration vision radius (k=1 reveals center + 6 neighbors = 7 hexes).
   * Default: 1.
   */
  visionRadiusK: number;

  /**
   * Timeout in milliseconds when requesting a single GPS fix in Level 2.
   * Default: 10000 ms (10 seconds).
   */
  samplingTimeoutMs: number;
}

/**
 * Standard default configuration matching PROJECT_SPEC.md.
 */
export const DEFAULT_BATTERY_SHIELD_CONFIG: BatteryShieldConfig = {
  stepThreshold: 15,
  speedThresholdKmH: 3.0,
  routeDistanceFilterMeters: 25,
  stopDetectionTimeoutMs: 60000,
  consecutiveLowSpeedThreshold: 3,
  visionRadiusK: 1,
  samplingTimeoutMs: 10000,
};

// ============================================================================
// DECOUPLED SENSOR PROVIDER INTERFACES
// ============================================================================

/**
 * Step update callback emitting either cumulative or incremental steps.
 */
export type StepUpdateCallback = (stepDeltaOrTotal: number) => void;

/**
 * Pedometer / Accelerometer sensor provider interface.
 * Decoupled from expo-sensors for universal testing and portability.
 */
export interface IStepSensorProvider {
  /** Checks if the hardware sensor / permission is available on device */
  isAvailable(): Promise<boolean>;

  /** Starts listening to step events */
  startStepCounter(callback: StepUpdateCallback): Promise<void>;

  /** Stops listening to step events to conserve power */
  stopStepCounter(): Promise<void>;
}

/**
 * Location fix callback for continuous route tracking.
 */
export type LocationUpdateCallback = (coordinate: GeoCoordinates) => void;

/**
 * Geolocation provider interface.
 * Decoupled from expo-location for universal testing and portability.
 */
export interface ILocationProvider {
  /** Checks if GPS hardware and location permissions are enabled */
  isAvailable(): Promise<boolean>;

  /**
   * Obtains a single high-accuracy GPS fix (Nivel 2).
   * GPS hardware is powered down immediately after fix.
   */
  requestSingleAccurateFix(timeoutMs?: number): Promise<GeoCoordinates>;

  /**
   * Starts distance-based continuous GPS tracking (Nivel 3).
   * Samples strictly when the user has traveled the configured distance interval.
   */
  startDistanceTracking(
    distanceIntervalMeters: number,
    callback: LocationUpdateCallback
  ): Promise<void>;

  /** Completely disables continuous GPS tracking (Nivel 1 transition) */
  stopTracking(): Promise<void>;
}

// ============================================================================
// EVENTS, STATUS & LISTENERS
// ============================================================================

/**
 * State change event payload with technical reasoning.
 */
export interface StateTransitionEvent {
  from: BatteryShieldState;
  to: BatteryShieldState;
  reason: string;
  timestamp: number;
}

/**
 * Live status snapshot of the BatteryShield engine.
 */
export interface BatteryShieldStatus {
  currentState: BatteryShieldState;
  isRunning: boolean;
  accumulatedStepsInIdle: number;
  lastSpeedKmH: number | null;
  lastFixCoordinate: GeoCoordinates | null;
  lastFixTimestamp: number | null;
  consecutiveLowSpeedCount: number;
}

/**
 * External listeners attached to BatteryShield lifecycle.
 */
export interface BatteryShieldListeners {
  onStateChange?: (event: StateTransitionEvent) => void;
  onLocationSample?: (coord: GeoCoordinates, discovery: HexagonDiscoveryResult) => void;
  onMetricsUpdate?: (metrics: ExplorationMetrics) => void;
  onError?: (error: Error) => void;
}
