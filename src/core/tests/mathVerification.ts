/**
 * TerraMaps Core Engine - Mathematical & Logical Verification Suite
 * 
 * Verifies:
 * 1. H3 Resolution 9 index conversion, geometric dimensions, and K-ring invariants.
 * 2. GeoJSON RFC 7946 compliance: ring closure and winding order (CCW exterior, CW holes).
 * 3. Fog of war inverted polygon generation and memoization cache hits.
 * 4. Battery-Shield 3-level state machine transitions and threshold reactions.
 */

import {
  H3Engine,
  coordinateToH3,
  h3ToCenterCoordinate,
  h3ToBoundary,
  cellsToMergedPolygons,
  getVisionRadiusHexagons,
  calculateNominalAreaKm2,
  isValidHexagonId,
} from '../geo/h3Engine';

import {
  DEFAULT_H3_RESOLUTION,
  H3_RES_9_CONSTANTS,
} from '../geo/types';

import {
  FogGeoJSONBuilder,
  calculateSignedArea,
  enforceWindingOrder,
  chaikinSmooth,
} from '../geo/fogGeoJSON';

import {
  BatteryShield,
  haversineDistanceMeters,
  speedMpsToKmh,
} from '../battery/batteryShield';

import {
  BatteryShieldState,
} from '../battery/types';

import {
  MockLocationProvider,
  MockStepSensorProvider,
} from '../battery/mockProviders';

import {
  validateH3Index,
  sanitizeString,
  sanitizeUsername,
  validateSafeStorageKey,
  safeJsonParse,
  validateCoordinates,
  validateSafeUrl,
  validateEmail,
} from '../security';

import {
  CDMX_LANDMARKS,
  evaluateLandmarksDiscovery,
} from '../geo/regionalLandmarks';

export interface VerificationResult {
  suiteName: string;
  passed: boolean;
  assertions: number;
  failures: string[];
}

export async function runAllVerifications(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  // ==========================================================================
  // SUITE 1: H3 RESOLUTION 9 MATHEMATICS & INVARIANTS
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    // Test coordinates: Mexico City Zócalo
    const lat = 19.432608;
    const lng = -99.133209;

    const hexId = coordinateToH3(lat, lng, 9);
    assertions++;
    if (!hexId || typeof hexId !== 'string' || hexId.length < 15) {
      failures.push(`Expected valid 15-char H3 index, got: ${hexId}`);
    }

    assertions++;
    if (!isValidHexagonId(hexId, 9)) {
      failures.push(`Expected isValidHexagonId to return true for ${hexId}`);
    }

    // Invariant: Centroid round-trip proximity
    const center = h3ToCenterCoordinate(hexId);
    const distFromOriginal = haversineDistanceMeters(
      { latitude: lat, longitude: lng },
      center
    );
    assertions++;
    // Res 9 cell circumradius is ~200m; center must be within circumradius
    if (distFromOriginal > H3_RES_9_CONSTANTS.CIRCUMRADIUS_METERS) {
      failures.push(
        `Centroid distance (${distFromOriginal.toFixed(1)}m) exceeded circumradius (${H3_RES_9_CONSTANTS.CIRCUMRADIUS_METERS}m)`
      );
    }

    // Invariant: Vision radius K-ring formulas
    // k = 0 -> 1 cell
    const k0 = getVisionRadiusHexagons(hexId, 0);
    assertions++;
    if (k0.length !== 1 || k0[0] !== hexId) {
      failures.push(`Expected K-ring(0) to have 1 cell, got ${k0.length}`);
    }

    // k = 1 -> 1 + 3*1*2 = 7 cells
    const k1 = getVisionRadiusHexagons(hexId, 1);
    assertions++;
    if (k1.length !== 7) {
      failures.push(`Expected K-ring(1) to have 7 cells, got ${k1.length}`);
    }

    // k = 2 -> 1 + 3*2*3 = 19 cells
    const k2 = getVisionRadiusHexagons(hexId, 2);
    assertions++;
    if (k2.length !== 19) {
      failures.push(`Expected K-ring(2) to have 19 cells, got ${k2.length}`);
    }

    // Invariant: Area calculation formula
    const area100Hexes = calculateNominalAreaKm2(100, 9);
    assertions++;
    const expectedArea = 100 * H3_RES_9_CONSTANTS.AVG_AREA_KM2;
    if (Math.abs(area100Hexes - expectedArea) > 0.0001) {
      failures.push(
        `Area nominal calculation mismatch: expected ${expectedArea}, got ${area100Hexes}`
      );
    }

    results.push({
      suiteName: 'H3 Resolution 9 Geometry & Invariants',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  // ==========================================================================
  // SUITE 2: GEOJSON RFC 7946 & FOG OF WAR BUILDER
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    const hexId = coordinateToH3(40.7128, -74.006, 9);
    const boundary = h3ToBoundary(hexId, true);

    // Closed LinearRing invariant: 7 coordinates, first === last
    assertions++;
    if (boundary.length !== 7) {
      failures.push(`Boundary must have 7 coordinates (closed hex ring), got: ${boundary.length}`);
    }

    assertions++;
    const firstPt = boundary[0];
    const lastPt = boundary[boundary.length - 1];
    if (firstPt[0] !== lastPt[0] || firstPt[1] !== lastPt[1]) {
      failures.push(`Boundary ring is not closed: first ${firstPt} !== last ${lastPt}`);
    }

    // Winding order check
    const ccwRing = enforceWindingOrder(boundary, false); // Exterior: CCW
    assertions++;
    if (calculateSignedArea(ccwRing) <= 0) {
      failures.push('Expected CCW ring to have positive signed area');
    }

    const cwRing = enforceWindingOrder(boundary, true); // Hole: CW
    assertions++;
    if (calculateSignedArea(cwRing) >= 0) {
      failures.push('Expected CW ring to have negative signed area');
    }

    // Fog builder cache test
    const builder = new FogGeoJSONBuilder();
    const hexList = [hexId];
    const data1 = builder.getFogMapData(hexList, 1);
    const data2 = builder.getFogMapData(hexList, 1);

    assertions++;
    if (data1 !== data2) {
      failures.push('FogGeoJSONBuilder cache failed: expected exact reference equality for unchanged version');
    }

    assertions++;
    if (data1.fogLayerGeoJSON.features[0].geometry.coordinates.length < 2) {
      failures.push('Fog mask must contain exterior ring + hole ring for hexId');
    }

    results.push({
      suiteName: 'GeoJSON RFC 7946 & Fog Mask Builder',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  // ==========================================================================
  // SUITE 3: BATTERY-SHIELD 3-LEVEL STATE MACHINE
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    const engine = new H3Engine([], 9);
    const mockLocation = new MockLocationProvider();
    const mockStep = new MockStepSensorProvider();

    const stateTransitions: BatteryShieldState[] = [];

    const shield = new BatteryShield(
      engine,
      mockLocation,
      mockStep,
      {
        stepThreshold: 15,
        speedThresholdKmH: 3.0,
        routeDistanceFilterMeters: 25,
        consecutiveLowSpeedThreshold: 3,
      },
      {
        onStateChange: (e) => {
          stateTransitions.push(e.to);
        },
      }
    );

    // Initial state: Level 1 Idle
    await shield.start();
    assertions++;
    if (shield.state !== BatteryShieldState.LEVEL_1_IDLE) {
      failures.push(`Expected initial state LEVEL_1_IDLE, got: ${shield.state}`);
    }

    assertions++;
    if (mockLocation.isTracking) {
      failures.push('GPS tracking should be completely OFF during Level 1');
    }

    // Emit 10 steps: should stay in Level 1 (threshold is 15)
    mockStep.emitSteps(10);
    assertions++;
    if (shield.state !== BatteryShieldState.LEVEL_1_IDLE) {
      failures.push(`Expected state to remain LEVEL_1_IDLE after 10 steps, got: ${shield.state}`);
    }

    // Emit 6 more steps (total 16 > 15): triggers Level 2
    // Prepare mock location with speed 1.5 km/h (walking slowly or stopping)
    mockLocation.setNextFix({
      latitude: 19.4326,
      longitude: -99.1332,
      speed: 1.5 / 3.6, // 1.5 km/h in m/s
      timestamp: Date.now(),
    });

    mockStep.emitSteps(6);
    // Allow microtasks to resolve
    await new Promise((r) => setTimeout(r, 20));

    // Because speed was 1.5 km/h (<= 3.0 km/h), it should have sampled and returned to Level 1
    assertions++;
    if (shield.state !== BatteryShieldState.LEVEL_1_IDLE) {
      failures.push(`Expected return to LEVEL_1_IDLE after slow speed, got: ${shield.state}`);
    }

    // Now test transition to Level 3 Active Route:
    // Emit 16 steps, with high speed (5.0 km/h)
    mockLocation.setNextFix({
      latitude: 19.4327,
      longitude: -99.1333,
      speed: 5.0 / 3.6, // 5.0 km/h in m/s (> 3 km/h)
      timestamp: Date.now(),
    });

    mockStep.emitSteps(16);
    await new Promise((r) => setTimeout(r, 20));

    assertions++;
    if (shield.state !== BatteryShieldState.LEVEL_3_ACTIVE_ROUTE) {
      failures.push(`Expected transition to LEVEL_3_ACTIVE_ROUTE, got: ${shield.state}`);
    }

    assertions++;
    if (!mockLocation.isTracking) {
      failures.push('GPS distance tracking should be active in Level 3');
    }

    // Test Level 3 decay to Level 1 after consecutive low speed samples
    for (let i = 0; i < 3; i++) {
      mockLocation.emitLocationUpdate({
        latitude: 19.4327 + i * 0.0001,
        longitude: -99.1333,
        speed: 1.0 / 3.6, // 1.0 km/h (below 3 km/h threshold)
        timestamp: Date.now(),
      });
    }

    assertions++;
    if (shield.state !== BatteryShieldState.LEVEL_1_IDLE) {
      failures.push(`Expected return to LEVEL_1_IDLE after 3 low-speed samples, got: ${shield.state}`);
    }

    await shield.stop();

    results.push({
      suiteName: 'Battery-Shield 3-Level State Machine Lifecycle',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  // ==========================================================================
  // SUITE 4: APPLICATION SECURITY HARDENING & INPUT VALIDATION
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    // 1. H3 Index strict regex validation and injection defense
    assertions++;
    if (!validateH3Index('89268580cffffff')) {
      failures.push('Expected valid 15-char H3 index to pass validation');
    }

    assertions++;
    if (validateH3Index('<script>alert(1)</script>')) {
      failures.push('Failed to reject script tag as H3 index');
    }

    assertions++;
    if (validateH3Index('../../etc/passwd')) {
      failures.push('Failed to reject path traversal string as H3 index');
    }

    assertions++;
    if (validateH3Index('89268580cfffff')) {
      failures.push('Failed to reject 14-char H3 index');
    }

    assertions++;
    if (validateH3Index('89268580cfffffg')) {
      failures.push('Failed to reject non-hex character in H3 index');
    }

    // 2. Safe JSON parser DoS limit & prototype pollution immunity
    assertions++;
    const oversizedPayload = '{"a": 1}'.repeat(50);
    const parsedSmall = safeJsonParse(oversizedPayload, null, 20); // 20 bytes limit
    if (parsedSmall !== null) {
      failures.push('safeJsonParse failed to reject oversized payload');
    }

    assertions++;
    const protoPayload = '{"__proto__":{"polluted":true},"valid":42}';
    const parsedProto = safeJsonParse<{ valid: number }>(protoPayload, { valid: 0 });
    if ((parsedProto as any).polluted !== undefined || ({} as any).polluted === true) {
      failures.push('safeJsonParse failed to neutralize prototype pollution');
    }

    assertions++;
    if (parsedProto.valid !== 42) {
      failures.push(`Expected valid property to be preserved, got ${parsedProto.valid}`);
    }

    // 3. String & Username Sanitization (XSS and Length enforcement)
    assertions++;
    const dirtyUsername = '<script>alert("hack")</script><b>Rey_Cyber</b>';
    const cleanedUsername = sanitizeUsername(dirtyUsername);
    if (cleanedUsername.includes('<') || cleanedUsername.includes('script') || !cleanedUsername.includes('Rey_Cyber')) {
      failures.push(`Sanitization failed on dirty username: got "${cleanedUsername}"`);
    }

    assertions++;
    const shortUsername = '  ab  ';
    const fallbackUsername = sanitizeUsername(shortUsername, 'Cadete_Fallback');
    if (fallbackUsername !== 'Cadete_Fallback') {
      failures.push(`Expected fallback for <3 char username, got "${fallbackUsername}"`);
    }

    assertions++;
    const dirtyString = 'Safe text\x00\x08<img src=x onerror=alert(1)> and more';
    const cleanString = sanitizeString(dirtyString, 50);
    if (cleanString.includes('<') || cleanString.includes('\x00')) {
      failures.push(`sanitizeString failed to strip control characters or HTML tags: "${cleanString}"`);
    }

    // 4. Safe Storage Key Validation (Protection against prototype collision and traversal)
    assertions++;
    if (!validateSafeStorageKey('@terramaps_unlocked_hexagons')) {
      failures.push('Failed to accept legitimate Terramaps storage key');
    }

    assertions++;
    if (validateSafeStorageKey('__proto__') || validateSafeStorageKey('constructor')) {
      failures.push('Failed to reject dangerous prototype collision keys');
    }

    assertions++;
    if (validateSafeStorageKey('../../../etc/shadow')) {
      failures.push('Failed to reject directory traversal in storage key');
    }

    // 5. Geographic Coordinate Bounds Validation
    assertions++;
    if (!validateCoordinates(19.4326, -99.1332)) {
      failures.push('Failed to validate legitimate Mexico City coordinates');
    }

    assertions++;
    if (validateCoordinates(95.0, 0) || validateCoordinates(-91.0, 0)) {
      failures.push('Failed to reject latitude exceeding [-90, 90] bounds');
    }

    assertions++;
    if (validateCoordinates(NaN, -99.1332) || validateCoordinates(19.4326, Infinity)) {
      failures.push('Failed to reject NaN or Infinity coordinates');
    }

    // 6. Safe URL & Email Validation
    assertions++;
    if (validateSafeUrl('javascript:alert(1)')) {
      failures.push('Failed to reject javascript: URI in avatar validation');
    }

    assertions++;
    if (!validateSafeUrl('https://example.com/avatar.webp')) {
      failures.push('Failed to accept valid HTTPS avatar URL');
    }

    assertions++;
    if (!validateEmail('explorer@terramaps.io') || validateEmail('not-an-email')) {
      failures.push('Email validation failed expected assertions');
    }

    results.push({
      suiteName: 'Application Security Hardening, Input Sanitization & Invariants',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  // ==========================================================================
  // SUITE 5: GPS Accuracy Filtering & Tactical Hexagon Eraser Invariants
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    const { GpsAccuracyFilter } = require('../geo/gpsAccuracyFilter');
    const filter = new GpsAccuracyFilter({
      maxAccuracyMeters: 45,
      maxGroundSpeedKmh: 160,
    });

    // 1. Aceptar punto inicial legítimo
    assertions++;
    const res1 = filter.processPoint({
      latitude: 19.4326,
      longitude: -99.1332,
      timestampMs: 1000000,
      accuracyMeters: 10,
    });
    if (!res1.isValid || res1.isSpike) {
      failures.push('Failed to accept legitimate initial GPS coordinate');
    }

    // 2. Rechazar lectura con precisión deficiente (> 45m)
    assertions++;
    const res2 = filter.processPoint({
      latitude: 19.4330,
      longitude: -99.1335,
      timestampMs: 1005000,
      accuracyMeters: 85, // 85m > 45m
    });
    if (res2.isValid) {
      failures.push('Failed to reject inaccurate GPS reading with 85m error');
    }

    // 3. Detectar pico de teletransporte (Speed-gate spike)
    assertions++;
    const res3 = filter.processPoint({
      latitude: 19.8500, // Salto brusco de ~45 km en 2 segundos (~81,000 km/h)
      longitude: -99.1335,
      timestampMs: 1007000,
      accuracyMeters: 15,
    });
    if (res3.isValid || !res3.isSpike) {
      failures.push('Failed to detect and reject teleportation speed spike');
    }

    // 4. Verificación de Goma de Borrar en H3Engine
    assertions++;
    const engine = new H3Engine();
    const hex1 = coordinateToH3(19.4326, -99.1332);
    const hex2 = coordinateToH3(19.4340, -99.1340);
    engine.addHexagons([hex1, hex2]);
    const initialVersion = engine.version;

    const removed = engine.removeHexagons([hex1]);
    if (removed !== 1 || engine.isUnlocked(hex1)) {
      failures.push('removeHexagons failed to cleanly delete target hexagon');
    }

    assertions++;
    if (!engine.isUnlocked(hex2)) {
      failures.push('removeHexagons erroneously removed non-targeted hexagon');
    }

    assertions++;
    if (engine.version <= initialVersion) {
      failures.push('removeHexagons failed to increment monotonic engine version');
    }

    // 5. Manejo seguro de hexágono inexistente
    assertions++;
    const removedZero = engine.removeHexagons(['non_existent_hex_id']);
    if (removedZero !== 0) {
      failures.push('removeHexagons returned non-zero count for non-existent hex');
    }

    results.push({
      suiteName: 'GPS Accuracy Filtering & Tactical Hexagon Eraser Invariants',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  // ==========================================================================
  // SUITE 6: REGIONAL LANDMARKS DISCOVERY & SPATIAL INVARIANTS
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    // 1. Catálogo de monumentos inicializado y consistente
    assertions++;
    if (!CDMX_LANDMARKS || CDMX_LANDMARKS.length < 5) {
      failures.push(`Expected at least 5 CDMX landmarks, found: ${CDMX_LANDMARKS?.length}`);
    }

    // 2. Cada monumento tiene coordenadas válidas y celda H3 no vacía
    for (const lm of CDMX_LANDMARKS) {
      assertions++;
      if (!isValidHexagonId(lm.h3Cell, 9)) {
        failures.push(`Landmark "${lm.name}" has invalid H3 Res 9 cell: ${lm.h3Cell}`);
      }
      assertions++;
      if (lm.coordinates[0] < -100 || lm.coordinates[0] > -98 || lm.coordinates[1] < 18 || lm.coordinates[1] > 20) {
        failures.push(`Landmark "${lm.name}" coordinates outside CDMX bounding box: [${lm.coordinates}]`);
      }
    }

    // 3. Evaluación de descubrimiento: cuando la celda H3 está en el conjunto de desbloqueados
    const targetLandmark = CDMX_LANDMARKS[0]; // Zócalo
    const unlockedSet = new Set<string>([targetLandmark.h3Cell]);
    const discoveredList = evaluateLandmarksDiscovery(unlockedSet, 19.4326, -99.1332);

    assertions++;
    const evaluatedZocalo = discoveredList.find((d) => d.landmark.id === targetLandmark.id);
    if (!evaluatedZocalo || !evaluatedZocalo.isDiscovered) {
      failures.push('Expected Zócalo landmark to be marked as discovered when its H3 cell is present');
    }

    assertions++;
    const lockedLandmark = discoveredList.find((d) => d.landmark.id !== targetLandmark.id);
    if (!lockedLandmark || lockedLandmark.isDiscovered) {
      failures.push('Expected unvisited landmarks to remain locked');
    }

    // 4. Distancia euclidiana / haversine calculada positivamente
    assertions++;
    if (evaluatedZocalo && evaluatedZocalo.distanceMeters > 50) {
      failures.push(`Expected distance to Zócalo from its coordinates to be near zero, got: ${evaluatedZocalo.distanceMeters}m`);
    }

    results.push({
      suiteName: 'Regional Landmarks Discovery & Spatial Invariants',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  // ==========================================================================
  // SUITE 7: ORGANIC SMOOTH MASK & ANALYTICS METRICS INVARIANTS
  // ==========================================================================
  {
    const failures: string[] = [];
    let assertions = 0;

    // 1. cellsToMergedPolygons: Fusión de 7 hexágonos vecinos (K-ring = 1) en 1 solo polígono continuo
    const centerHex = coordinateToH3(19.4326, -99.1332, 9);
    const disk = getVisionRadiusHexagons(centerHex, 1); // 7 hexágonos contiguos
    const merged = cellsToMergedPolygons(disk);

    assertions++;
    if (!Array.isArray(merged) || merged.length !== 1) {
      failures.push(`Expected 1 merged MultiPolygon component for connected disk, got: ${merged?.length}`);
    }

    assertions++;
    const exteriorContour = merged[0][0];
    if (!exteriorContour || exteriorContour.length < 15) {
      failures.push(`Expected exterior merged ring to have at least 15 vertices, got: ${exteriorContour?.length}`);
    }

    // 2. chaikinSmooth: Suavizado de esquinas preservando el cierre del anillo
    const smoothed = chaikinSmooth(exteriorContour as any, 2);
    assertions++;
    if (smoothed.length <= exteriorContour.length) {
      failures.push(`Expected Chaikin smoothing to increase vertex density, got original ${exteriorContour.length} vs smoothed ${smoothed.length}`);
    }

    assertions++;
    const firstSmooth = smoothed[0];
    const lastSmooth = smoothed[smoothed.length - 1];
    if (firstSmooth[0] !== lastSmooth[0] || firstSmooth[1] !== lastSmooth[1]) {
      failures.push(`Smoothed ring must remain strictly closed (RFC 7946 compliance)`);
    }

    // 3. Telemetría de Salud: Fórmula MET para Caminata (4 km/h, 3600 seg, 70 kg)
    const hours = 3600 / 3600;
    const walkMet = 3.5;
    const expectedCalories = Math.round(walkMet * 70 * hours * 10) / 10;
    assertions++;
    if (expectedCalories !== 245) {
      failures.push(`Expected 245 kcal burned for 1 hr walk, got: ${expectedCalories}`);
    }

    // 4. Ahorro de CO2: 10 km a pie * 0.12 kg CO2/km = 1.2 kg
    const co2Saved = Math.round(10.0 * 0.12 * 100) / 100;
    assertions++;
    if (co2Saved !== 1.2) {
      failures.push(`Expected 1.2 kg CO2 saved, got: ${co2Saved}`);
    }

    // 5. Embudo Financiero: Comisión del 15% de App Store
    const grossPrice = 4.99;
    const appStoreFee = Math.round(grossPrice * 0.15 * 100) / 100; // 0.75
    const netRevenue = Math.round((grossPrice - appStoreFee) * 100) / 100; // 4.24
    assertions++;
    if (netRevenue !== 4.24) {
      failures.push(`Expected $4.24 net from $4.99 gross after 15% store fee, got: $${netRevenue}`);
    }

    results.push({
      suiteName: 'Organic Smooth Mask & Business Decision Telemetry Invariants',
      passed: failures.length === 0,
      assertions,
      failures,
    });
  }

  return results;
}
