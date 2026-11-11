/**
 * TerraMaps Geo Core - Type Definitions
 * 
 * Mathematical and geospatial types for Uber H3 hexagon indexation,
 * GeoJSON Fog of War layers, coordinate manipulation, and exploration metrics.
 */

import type {
  Feature,
  FeatureCollection,
  Geometry,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
  Position,
} from 'geojson';

// ============================================================================
// 1. GEODETIC & COORDINATE TYPES
// ============================================================================

/**
 * Standard WGS-84 Geodetic Coordinates.
 */
export interface GeoCoordinates {
  /** Latitude in decimal degrees [-90.0, 90.0] */
  latitude: number;
  /** Longitude in decimal degrees [-180.0, 180.0] */
  longitude: number;
  /** Altitude in meters above WGS84 ellipsoid (optional) */
  altitude?: number | null;
  /** Horizontal accuracy in meters (optional) */
  accuracy?: number | null;
  /** Speed in meters per second (optional) */
  speed?: number | null;
  /** Heading / bearing in degrees [0, 360) clockwise from true north (optional) */
  heading?: number | null;
  /** UTC timestamp in milliseconds */
  timestamp?: number;
}

/**
 * Coordinates in [Latitude, Longitude] order (Used natively by Uber H3 algorithms).
 */
export type LatLngTuple = [latitude: number, longitude: number];

/**
 * Coordinates in [Longitude, Latitude] order (Used natively by GeoJSON / MapLibre GL).
 */
export type LngLatTuple = [longitude: number, latitude: number];

/**
 * Geographic 2D Bounding Box in WGS-84 [minLng, minLat, maxLng, maxLat].
 */
export type BoundingBoxTuple = [
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
];

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// ============================================================================
// 2. UBER H3 HEXAGON TYPES & CONSTANTS
// ============================================================================

/**
 * Standard H3 Index string representation (e.g. "89268580cbfffff").
 * Resolution 9 produces 15-character hexadecimal identifiers.
 */
export type H3Index = string;

/**
 * Supported H3 resolution range [0..15].
 */
export type H3Resolution = number;

/**
 * Default H3 resolution for TerraMaps.
 * Resolution 9:
 * - Average Area: ~0.1007 km² (~100,718 m²)
 * - Average Edge Length: ~174.4 meters
 * - Average Hexagon Inradius (apothem): ~105 meters
 * - Circumradius (center to vertex): ~201 meters
 */
export const DEFAULT_H3_RESOLUTION: H3Resolution = 9;

/**
 * Mathematical constants for Uber H3 Resolution 9 geometry.
 */
export const H3_RES_9_CONSTANTS = {
  /** Average cell area in square kilometers */
  AVG_AREA_KM2: 0.100718021,
  /** Average cell area in square meters */
  AVG_AREA_M2: 100718.021,
  /** Approximate inradius (apothem) in meters (~105m) */
  INRADIUS_METERS: 105.0,
  /** Approximate edge length in meters (~174.4m) */
  EDGE_LENGTH_METERS: 174.375,
  /** Approximate circumradius in meters (~201m) */
  CIRCUMRADIUS_METERS: 201.35,
} as const;

/**
 * Representation of a single hexagonal cell with geospatial metadata.
 */
export interface HexagonCell {
  /** Unique H3 hexadecimal index (Res 9) */
  id: H3Index;
  /** Geographic center coordinate */
  center: GeoCoordinates;
  /** Closed polygonal ring coordinates in GeoJSON format [lng, lat][] (7 vertices) */
  boundary: LngLatTuple[];
  /** Exact or nominal area in square kilometers */
  areaKm2: number;
  /** Timestamp when the hexagon was first unlocked */
  unlockedAt?: number;
}

// ============================================================================
// 3. EXPLORATION & DISCOVERY METRICS
// ============================================================================

/**
 * Aggregate exploration metrics for the local player or territory.
 */
export interface ExplorationMetrics {
  /** Total count of uniquely unlocked H3 hexagons */
  totalUnlockedHexagons: number;
  /** Total uncovered area in square kilometers (N * Area Res 9) */
  totalAreaKm2: number;
  /** Last unlocked hexagon index */
  lastUnlockedHexId: H3Index | null;
  /** Timestamp of the most recent discovery */
  lastUnlockedTimestamp: number | null;
  /** Optional ratio of conquest relative to a defined city/region */
  percentageOfRegion?: number;
}

/**
 * Result payload returned whenever a location coordinate is processed.
 */
export interface HexagonDiscoveryResult {
  /** True if at least one brand new hexagon was unlocked in this processing step */
  isNewDiscovery: boolean;
  /** List of newly unlocked hexagon indices in this step */
  newlyUnlockedHexes: H3Index[];
  /** Center H3 hexagon at current GPS coordinate */
  currentHex: H3Index;
  /** Complete list of visible hexagons (center + K-ring neighborhood) */
  visibleHexes: H3Index[];
  /** Updated exploration metrics */
  metrics: ExplorationMetrics;
}

// ============================================================================
// 4. MAPLIBRE GL & GEOJSON FOG OF WAR TYPES
// ============================================================================

/**
 * Properties attached to individual unlocked hexagon features in GeoJSON.
 */
export interface HexagonFeatureProperties {
  hexId: H3Index;
  unlockedAt: number;
  isRecent?: boolean;
}

/**
 * Properties attached to glow border line features in GeoJSON.
 */
export interface GlowBorderProperties {
  stroke: string;
  strokeWidth: number;
  glowIntensity: number;
}

/**
 * Properties attached to the dark fog inverted polygon.
 */
export interface FogFeatureProperties {
  fillColor: string;
  fillOpacity: number;
  isFogMask: true;
}

/**
 * Configuration options for generating Fog of War and Glow GeoJSON layers.
 */
export interface FogRenderOptions {
  /** Fog color in hex format (Default: '#0b0f19') */
  fogColor?: string;
  /** Fog opacity [0.0 - 1.0] (Default: 0.88) */
  fogOpacity?: number;
  /** Glow border color in hex format (Default: '#00f0ff' neon cyan) */
  glowColor?: string;
  /** Glow border line width (Default: 2.5) */
  glowWidth?: number;
  /**
   * World bounding box for the exterior fog mask.
   * Defaults to Web Mercator limits [-180, -85.051129, 180, 85.051129].
   */
  worldBounds?: BoundingBoxTuple;
  /** Optional viewport bounding box to clip/filter hexagons for high FPS */
  viewportBounds?: BoundingBox;
}

/**
 * Unified GeoJSON bundle ready to be consumed by MapLibre GL sources.
 */
export interface FogMapData {
  /**
   * Fog mask: An inverted polygon covering the map bounds with holes
   * for every unlocked hexagon. Fill color #0b0f19 at 0.88 opacity.
   */
  fogLayerGeoJSON: FeatureCollection<Polygon | MultiPolygon, FogFeatureProperties>;

  /**
   * Border glow: Polyline/Polygon perimeters of unlocked hexagons styled with neon stroke.
   */
  glowBorderGeoJSON: FeatureCollection<LineString | MultiLineString | Polygon, GlowBorderProperties>;

  /**
   * Individual unlocked hexagons as polygons for selective highlight, radar, or animation.
   */
  unlockedHexagonsGeoJSON: FeatureCollection<Polygon, HexagonFeatureProperties>;

  /** Monotonic revision number incremented on changes (avoids redundant re-renders) */
  version: number;

  /** Timestamp of generation */
  generatedAt: number;
}
