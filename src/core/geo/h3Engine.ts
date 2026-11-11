/**
 * TerraMaps Geo Core - H3 Mathematical Engine
 * 
 * High-performance, mathematically rigorous implementation of Uber H3 spatial indexation.
 * Default Resolution: 9 (Radius ~105m, edge ~174m, area ~0.1007 km²).
 * 
 * Features:
 * - O(1) in-memory storage & lookup with Set<string>.
 * - Vision radius generation via gridDisk (K-ring).
 * - GeoJSON boundary extraction with closed LinearRing compliance (RFC 7946).
 * - Exact and nominal area accumulation.
 * - State management and new territory discovery detection.
 */

import {
  latLngToCell,
  cellToLatLng,
  cellToBoundary,
  cellsToMultiPolygon,
  gridDisk,
  cellArea,
  isValidCell,
  getResolution,
} from 'h3-js';

import {
  DEFAULT_H3_RESOLUTION,
  H3_RES_9_CONSTANTS,
  type GeoCoordinates,
  type H3Index,
  type H3Resolution,
  type HexagonCell,
  type HexagonDiscoveryResult,
  type ExplorationMetrics,
  type LngLatTuple,
  type LatLngTuple,
} from './types';

// ============================================================================
// PURE MATHEMATICAL FUNCTIONS
// ============================================================================

/**
 * Validates whether a string is a syntactically valid H3 cell index.
 * Optionally checks if the index matches the expected resolution.
 * 
 * @param hexId H3 cell string identifier
 * @param expectedResolution Optional resolution constraint (e.g. 9)
 */
export function isValidHexagonId(
  hexId: string,
  expectedResolution?: H3Resolution
): boolean {
  if (!hexId || typeof hexId !== 'string' || hexId.length < 15) {
    return false;
  }
  try {
    if (!isValidCell(hexId)) {
      return false;
    }
    if (expectedResolution !== undefined) {
      return getResolution(hexId) === expectedResolution;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts WGS-84 coordinates to an Uber H3 cell index.
 * 
 * @param latitude Latitude in decimal degrees [-90, 90]
 * @param longitude Longitude in decimal degrees [-180, 180]
 * @param resolution H3 resolution [0..15], defaults to 9 (~0.1 km²)
 * @returns H3 hexadecimal string index
 */
export function coordinateToH3(
  latitude: number,
  longitude: number,
  resolution: H3Resolution = DEFAULT_H3_RESOLUTION
): H3Index {
  if (latitude < -90 || latitude > 90) {
    throw new RangeError(`Latitude out of range [-90, 90]: ${latitude}`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError(`Longitude out of range [-180, 180]: ${longitude}`);
  }
  return latLngToCell(latitude, longitude, resolution);
}

/**
 * Converts a GeoCoordinates object to an H3 cell index.
 */
export function geoCoordinateToH3(
  coord: GeoCoordinates,
  resolution: H3Resolution = DEFAULT_H3_RESOLUTION
): H3Index {
  return coordinateToH3(coord.latitude, coord.longitude, resolution);
}

/**
 * Computes the centroid (geographic center) coordinate for a given H3 cell.
 * 
 * @param hexId H3 cell index
 * @returns Center coordinate in GeoCoordinates format
 */
export function h3ToCenterCoordinate(hexId: H3Index): GeoCoordinates {
  const [lat, lng] = cellToLatLng(hexId);
  return {
    latitude: lat,
    longitude: lng,
  };
}

/**
 * Computes the polygon perimeter boundary of an H3 cell in GeoJSON format.
 * Coordinates are returned in [longitude, latitude] order as specified by RFC 7946.
 * 
 * @param hexId H3 cell index
 * @param ensureClosed When true, guarantees that ring[0] === ring[last] (7 vertices)
 * @returns Array of [lng, lat] coordinate tuples
 */
export function h3ToBoundary(
  hexId: H3Index,
  ensureClosed: boolean = true
): LngLatTuple[] {
  // formatAsGeoJson = true returns coordinates as [lng, lat]
  const boundary = cellToBoundary(hexId, true) as LngLatTuple[];

  if (ensureClosed && boundary.length > 0) {
    const first = boundary[0];
    const last = boundary[boundary.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      boundary.push([first[0], first[1]]);
    }
  }

  return boundary;
}

/**
 * Combina un conjunto de celdas H3 en MultiPolígonos unificados (disolución de fronteras internas).
 * Elimina completamente las aristas internas entre hexágonos vecinos, produciendo
 * únicamente el contorno exterior continuo del territorio explorado.
 * 
 * @param hexIds Iterable de índices H3
 * @returns Array de coordenadas de polígonos GeoJSON [ [ [lng, lat], ... ], ... ]
 */
export function cellsToMergedPolygons(hexIds: Iterable<H3Index>): LngLatTuple[][][] {
  const idsArray = Array.isArray(hexIds) ? hexIds : Array.from(hexIds);
  if (idsArray.length === 0) return [];
  try {
    return cellsToMultiPolygon(idsArray, true) as LngLatTuple[][][];
  } catch (err) {
    console.warn('[H3Engine] Error al fusionar polígonos:', err);
    return [];
  }
}

/**
 * Computes the vision radius (K-ring neighborhood) around an H3 cell.
 * - k = 0: Returns [origin] (1 hexagon)
 * - k = 1: Returns origin + 6 adjacent neighbors (7 hexagons)
 * - k = 2: Returns 19 hexagons
 * - Formula: Total cells = 1 + 3 * k * (k + 1)
 * 
 * @param centerHexId Origin H3 index
 * @param kRingRadius Radial distance in hexagonal steps (default: 1)
 * @returns Array of H3 indices within distance k
 */
export function getVisionRadiusHexagons(
  centerHexId: H3Index,
  kRingRadius: number = 1
): H3Index[] {
  if (kRingRadius < 0) {
    throw new RangeError(`kRingRadius must be >= 0, got ${kRingRadius}`);
  }
  return gridDisk(centerHexId, kRingRadius);
}

/**
 * Calculates nominal discovered area in square kilometers using H3 Res 9 average.
 * Execution time: O(1).
 * 
 * @param hexagonCount Number of unlocked hexagons
 * @param resolution Resolution used (defaults to 9)
 * @returns Area in square kilometers
 */
export function calculateNominalAreaKm2(
  hexagonCount: number,
  resolution: H3Resolution = DEFAULT_H3_RESOLUTION
): number {
  if (hexagonCount <= 0) return 0;
  if (resolution === DEFAULT_H3_RESOLUTION) {
    return hexagonCount * H3_RES_9_CONSTANTS.AVG_AREA_KM2;
  }
  // Fallback for custom resolutions:
  // Approximate earth area ~510,065,623 km2 divided by number of cells (8 * 7^res + 2)
  const cellCountAtRes = 2 + 120 * Math.pow(7, resolution - 1);
  const approxAvgArea = 510065623.0 / cellCountAtRes;
  return hexagonCount * approxAvgArea;
}

/**
 * Calculates the exact geodesic surface area in square kilometers for an array of H3 cells.
 * Useful for high-precision territorial reporting.
 * 
 * @param hexIds Iterable of H3 indices
 * @returns Exact aggregate area in square kilometers
 */
export function calculateExactAreaKm2(hexIds: Iterable<H3Index>): number {
  let totalArea = 0;
  for (const hex of hexIds) {
    try {
      totalArea += cellArea(hex, 'km2');
    } catch {
      totalArea += H3_RES_9_CONSTANTS.AVG_AREA_KM2;
    }
  }
  return totalArea;
}

/**
 * Converts an H3 index into a full HexagonCell entity with geometry and center.
 */
export function h3ToHexagonCell(
  hexId: H3Index,
  unlockedAt?: number
): HexagonCell {
  return {
    id: hexId,
    center: h3ToCenterCoordinate(hexId),
    boundary: h3ToBoundary(hexId, true),
    areaKm2: H3_RES_9_CONSTANTS.AVG_AREA_KM2,
    unlockedAt,
  };
}

// ============================================================================
// H3 ENGINE CLASS (STATEFUL & OPTIMIZED)
// ============================================================================

/**
 * H3Engine
 * 
 * Stateful, high-performance engine for managing the user's unlocked territory.
 * Holds unlocked cells in an internal Set<string> for instantaneous O(1) checks.
 * Manages monotonic versioning so downstream consumers (GeoJSON fog builders)
 * can skip work when no new territory has been discovered.
 */
export class H3Engine {
  private readonly _resolution: H3Resolution;
  private readonly _unlockedHexSet: Set<H3Index>;
  private _lastUnlockedHexId: H3Index | null = null;
  private _lastUnlockedTimestamp: number | null = null;
  private _version: number = 0;
  private _cachedUnlockedArray: H3Index[] | null = null;

  /**
   * Initializes the H3 Engine.
   * 
   * @param initialHexagons Optional set/array of previously persisted hex IDs
   * @param resolution H3 grid resolution (default: 9)
   */
  constructor(
    initialHexagons?: Iterable<H3Index>,
    resolution: H3Resolution = DEFAULT_H3_RESOLUTION
  ) {
    this._resolution = resolution;
    this._unlockedHexSet = new Set<H3Index>();

    if (initialHexagons) {
      this.importHexagons(initialHexagons);
    }
  }

  /** Current H3 grid resolution */
  public get resolution(): H3Resolution {
    return this._resolution;
  }

  /** Monotonic revision number incremented on every new discovery */
  public get version(): number {
    return this._version;
  }

  /** Total count of uniquely discovered hexagons */
  public get discoveredCount(): number {
    return this._unlockedHexSet.size;
  }

  /**
   * Checks whether a specific hexagon has already been unlocked in O(1) time.
   */
  public hasHexagon(hexId: H3Index): boolean {
    return this._unlockedHexSet.has(hexId);
  }

  /**
   * Unlocks a single hexagon manually.
   * 
   * @returns true if the hexagon was new and added, false if already unlocked.
   */
  public addHexagon(hexId: H3Index, timestamp: number = Date.now()): boolean {
    if (!isValidHexagonId(hexId, this._resolution)) {
      return false;
    }

    if (this._unlockedHexSet.has(hexId)) {
      return false;
    }

    this._unlockedHexSet.add(hexId);
    this._lastUnlockedHexId = hexId;
    this._lastUnlockedTimestamp = timestamp;
    this._cachedUnlockedArray = null;
    this._version++;
    return true;
  }

  /**
   * Batch adds multiple hexagons (e.g. from server synchronization or storage load).
   * 
   * @returns Number of newly added hexagons
   */
  public addHexagons(
    hexIds: Iterable<H3Index>,
    timestamp: number = Date.now()
  ): number {
    let addedCount = 0;
    for (const hex of hexIds) {
      if (isValidHexagonId(hex, this._resolution) && !this._unlockedHexSet.has(hex)) {
        this._unlockedHexSet.add(hex);
        this._lastUnlockedHexId = hex;
        addedCount++;
      }
    }

    if (addedCount > 0) {
      this._lastUnlockedTimestamp = timestamp;
      this._cachedUnlockedArray = null;
      this._version++;
    }

    return addedCount;
  }

  /**
   * Core tracking handler: Processes a raw GPS coordinate fix.
   * Computes the current H3 cell and K-ring vision radius, unlocks missing cells,
   * and reports new discoveries and current exploration metrics.
   * 
   * @param coord Geodetic GPS fix
   * @param kRingRadius Vision radius in hexagonal cells (default: 1 -> 7 cells)
   * @returns HexagonDiscoveryResult
   */
  public processLocation(
    coord: GeoCoordinates,
    kRingRadius: number = 1
  ): HexagonDiscoveryResult {
    const currentHex = coordinateToH3(
      coord.latitude,
      coord.longitude,
      this._resolution
    );

    const visibleHexes = getVisionRadiusHexagons(currentHex, kRingRadius);
    const newlyUnlockedHexes: H3Index[] = [];
    const now = coord.timestamp ?? Date.now();

    for (const hex of visibleHexes) {
      if (!this._unlockedHexSet.has(hex)) {
        this._unlockedHexSet.add(hex);
        newlyUnlockedHexes.push(hex);
      }
    }

    const isNewDiscovery = newlyUnlockedHexes.length > 0;

    if (isNewDiscovery) {
      this._lastUnlockedHexId = newlyUnlockedHexes[newlyUnlockedHexes.length - 1];
      this._lastUnlockedTimestamp = now;
      this._cachedUnlockedArray = null;
      this._version++;
    }

    const metrics = this.getMetrics();

    return {
      isNewDiscovery,
      newlyUnlockedHexes,
      currentHex,
      visibleHexes,
      metrics,
    };
  }

  /**
   * Computes current aggregated exploration metrics.
   * 
   * @param totalRegionAreaKm2 Optional reference area (e.g., city territory in km2)
   */
  public getMetrics(totalRegionAreaKm2?: number): ExplorationMetrics {
    const totalCount = this._unlockedHexSet.size;
    const totalAreaKm2 = calculateNominalAreaKm2(totalCount, this._resolution);

    let percentageOfRegion: number | undefined;
    if (totalRegionAreaKm2 && totalRegionAreaKm2 > 0) {
      percentageOfRegion = Math.min(100, (totalAreaKm2 / totalRegionAreaKm2) * 100);
    }

    return {
      totalUnlockedHexagons: totalCount,
      totalAreaKm2,
      lastUnlockedHexId: this._lastUnlockedHexId,
      lastUnlockedTimestamp: this._lastUnlockedTimestamp,
      percentageOfRegion,
    };
  }

  /**
   * Returns a snapshot of all unlocked hexagon indices as an array of strings.
   * Cached by version for O(1) performance without redundant array copies.
   */
  public getUnlockedHexagons(): H3Index[] {
    if (!this._cachedUnlockedArray) {
      this._cachedUnlockedArray = Array.from(this._unlockedHexSet);
    }
    return this._cachedUnlockedArray;
  }

  /**
   * Returns a direct read-only view of the internal Set for ultra-fast O(1) lookups.
   */
  public getUnlockedSet(): ReadonlySet<H3Index> {
    return this._unlockedHexSet;
  }

  /**
   * Checks if an H3 cell index is currently unlocked in O(1).
   */
  public isUnlocked(hexId: H3Index): boolean {
    return this._unlockedHexSet.has(hexId);
  }

  /**
   * Exports the unlocked hexagons as a JSON-serializable string array.
   */
  public exportSerialized(): H3Index[] {
    return this.getUnlockedHexagons();
  }

  /**
   * Imports a list of hexagons (e.g. from SQLite / Supabase cache).
   */
  public importHexagons(hexIds: Iterable<H3Index>): number {
    return this.addHexagons(hexIds);
  }

  /**
   * Elimina hexágonos específicos del motor (Goma de Borrar Táctica / Corrección de Trazos).
   * Incrementa la versión e invalida el array cacheado.
   */
  public removeHexagons(hexIds: Iterable<H3Index>): number {
    let removedCount = 0;
    for (const h of hexIds) {
      if (this._unlockedHexSet.delete(h)) {
        removedCount++;
      }
    }
    if (removedCount > 0) {
      this._version++;
      this._cachedUnlockedArray = null;
    }
    return removedCount;
  }

  /**
   * Resets all unlocked territory (useful for account logout or resets).
   */
  public clear(): void {
    this._unlockedHexSet.clear();
    this._lastUnlockedHexId = null;
    this._lastUnlockedTimestamp = null;
    this._cachedUnlockedArray = null;
    this._version++;
  }
}

/**
 * Default singleton instance of the H3 Engine (Resolution 9).
 */
export const h3Engine = new H3Engine();

