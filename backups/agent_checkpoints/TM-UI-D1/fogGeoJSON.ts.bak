/**
 * TerraMaps Geo Core - Fog of War GeoJSON Generator
 * 
 * High-performance GeoJSON generator tailored for MapLibre GL.
 * Produces:
 * 1. Inverted Fog Mask (GeoJSON Polygon with holes) styled with dark color (#0b0f19)
 *    and 0.88 opacity, exposing the underlying base map strictly inside unlocked hexagons.
 * 2. Neon Glow Borders for unlocked hexagons (LineString/Polygon features with glow properties).
 * 3. Individual Unlocked Hexagons FeatureCollection for custom styling and animations.
 * 
 * Optimization:
 * - RFC 7946 Winding Order normalization (Exterior ring CCW, interior holes CW).
 * - Multi-level caching/memoization by version to achieve 60 FPS without garbage collection spikes.
 * - Optional spatial viewport culling to avoid sending off-screen polygons to the GPU.
 */

import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
  LineString,
  Position,
} from 'geojson';

import {
  h3ToBoundary,
  h3ToCenterCoordinate,
  cellsToMergedPolygons,
} from './h3Engine';

import type {
  H3Index,
  BoundingBox,
  BoundingBoxTuple,
  FogRenderOptions,
  FogMapData,
  FogFeatureProperties,
  GlowBorderProperties,
  HexagonFeatureProperties,
  LngLatTuple,
} from './types';

// ============================================================================
// CONSTANTS & DEFAULTS
// ============================================================================

export const DEFAULT_FOG_OPTIONS: Required<Omit<FogRenderOptions, 'viewportBounds'>> = {
  fogColor: '#0b0f19',
  fogOpacity: 0.88,
  glowColor: '#00f0ff', // Cyberpunk neon cyan
  glowWidth: 2.5,
  // Web Mercator default projection bounds [-180, -85.051129, 180, 85.051129]
  worldBounds: [-180, -85.051129, 180, 85.051129],
};

// Cache de límites de celdas H3 para evitar repetir cálculos trigonométricos
const cellBoundaryCache = new Map<string, LngLatTuple[]>();

function getFastHexBoundary(hexId: H3Index): LngLatTuple[] {
  let b = cellBoundaryCache.get(hexId);
  if (!b) {
    b = h3ToBoundary(hexId, true);
    if (cellBoundaryCache.size > 20000) {
      cellBoundaryCache.clear();
    }
    cellBoundaryCache.set(hexId, b);
  }
  return b;
}

// ============================================================================
// GEOMETRIC & WINDING UTILITIES (RFC 7946)
// ============================================================================

/**
 * Computes the signed area of a 2D planar polygon ring using the Shoelace formula.
 * - Positive area: Counter-Clockwise (CCW)
 * - Negative area: Clockwise (CW)
 */
export function calculateSignedArea(ring: Position[]): number {
  const n = ring.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    area += p1[0] * p2[1] - p2[0] * p1[1];
  }

  return area / 2;
}

/**
 * Enforces RFC 7946 winding order on a coordinate ring.
 * - Exterior rings MUST be Counter-Clockwise (CCW -> signedArea > 0).
 * - Interior hole rings MUST be Clockwise (CW -> signedArea < 0).
 */
export function enforceWindingOrder(
  ring: LngLatTuple[],
  shouldBeClockwise: boolean
): LngLatTuple[] {
  const signedArea = calculateSignedArea(ring);
  const isCurrentlyClockwise = signedArea < 0;

  if (isCurrentlyClockwise !== shouldBeClockwise) {
    // Clone and reverse to avoid mutating caller data
    return [...ring].reverse() as LngLatTuple[];
  }
  return ring;
}

/**
 * Chaikin's Corner Cutting Smoothing Algorithm
 * Convierte cualquier contorno angular o poligonal en curvas fluidas, suaves y orgánicas.
 * Reemplaza cada esquina rígida de 120° con dos vértices interpolados a 1/4 y 3/4.
 * Garantiza cierre del polígono y elimina toda estética de panal de abejas o hexágonos rígidos.
 */
export function chaikinSmooth(ring: LngLatTuple[], iterations: number = 3): LngLatTuple[] {
  if (ring.length < 4) return ring;
  let pts = ring;

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: LngLatTuple[] = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const q: LngLatTuple = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
      const r: LngLatTuple = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
      smoothed.push(q, r);
    }
    if (smoothed.length > 0) {
      smoothed.push([smoothed[0][0], smoothed[0][1]]);
    }
    pts = smoothed;
  }
  return pts;
}

/**
 * Transforma cualquier contorno hexagonal rígido en un círculo u óvalo orgánico uniforme.
 * - Si es una celda aislada o pequeña (<= 7 vértices): Genera un círculo perfecto uniforme de 28 puntos
 *   con radio reducido al ~55% del hexágono real (~85 metros), tal como requiere el usuario.
 * - Si es un territorio continuo: Densifica los bordes cada ~15m, contrae los vértices suavemente
 *   hacia el centroide y aplica Chaikin iterativo para crear un corredor fluido sin aristas.
 */
export function organicSmoothPolygon(ring: LngLatTuple[]): LngLatTuple[] {
  if (ring.length < 4) return ring;

  let sumLng = 0;
  let sumLat = 0;
  const count = ring.length - 1;
  for (let i = 0; i < count; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  const cLng = sumLng / count;
  const cLat = sumLat / count;

  // 1. Celda aislada (1 hexágono = 6 caras + cierre = 7 vértices): Producir círculo uniforme de 85m
  if (count <= 7) {
    const pointsCount = 28;
    const circle: LngLatTuple[] = [];
    const latRad = (cLat * Math.PI) / 180;
    const radiusMeters = 85; // ~mitad de los límites del hexágono real (174m -> 85m)
    const deltaLat = radiusMeters / 111320;
    const deltaLng = radiusMeters / (111320 * Math.cos(latRad));

    for (let i = 0; i < pointsCount; i++) {
      const angle = (i * 2 * Math.PI) / pointsCount;
      circle.push([
        cLng + deltaLng * Math.cos(angle),
        cLat + deltaLat * Math.sin(angle),
      ]);
    }
    circle.push([circle[0][0], circle[0][1]]);
    return circle;
  }

  // 2. Territorio compuesto: Subdivisión densa de segmentos para eliminar líneas rectas largas
  const densePts: LngLatTuple[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const p0 = ring[i];
    const p1 = ring[i + 1];
    densePts.push(p0);

    for (let step = 1; step <= 3; step++) {
      const t = step / 4;
      const interpLng = p0[0] + t * (p1[0] - p0[0]);
      const interpLat = p0[1] + t * (p1[1] - p0[1]);
      // Contracción sutil hacia el centroide para redondear salientes
      const roundedLng = cLng + (interpLng - cLng) * 0.90;
      const roundedLat = cLat + (interpLat - cLat) * 0.90;
      densePts.push([roundedLng, roundedLat]);
    }
  }
  densePts.push([densePts[0][0], densePts[0][1]]);

  return chaikinSmooth(densePts, 3);
}

/**
 * Determines whether an H3 cell centroid falls within a geographic bounding box.
 * Used for camera viewport clipping.
 */
export function isHexagonInBounds(hexId: H3Index, bbox: BoundingBox): boolean {
  const center = h3ToCenterCoordinate(hexId);
  // Add a small buffer (~300m ~= 0.003 deg) to prevent edge clipping
  const buffer = 0.003;
  return (
    center.longitude >= bbox.minLng - buffer &&
    center.longitude <= bbox.maxLng + buffer &&
    center.latitude >= bbox.minLat - buffer &&
    center.latitude <= bbox.maxLat + buffer
  );
}

// ============================================================================
// GEOJSON LAYER GENERATORS - MAPA ORGÁNICO FLUIDO (SIN HEXÁGONOS)
// ============================================================================

/**
 * Genera la máscara de Niebla de Guerra Invertida Continua y Orgánica.
 * 
 * Enfoque Matemático:
 * 1. Fusiona todas las celdas contiguas con cellsToMergedPolygons (disuelve aristas internas).
 * 2. Suaviza el contorno perimetral con el algoritmo de Chaikin (elimina esquinas de 120°).
 * 3. Troquela los agujeros en el velo de niebla con orientación Clockwise (CW RFC 7946).
 * El mapa base subyacente se revela como un corredor fluido y orgánico, no como hexágonos.
 */
export function generateInvertedFogGeoJSON(
  unlockedHexagons: Iterable<H3Index>,
  options: FogRenderOptions = {}
): FeatureCollection<Polygon, FogFeatureProperties> {
  const fogColor = options.fogColor ?? DEFAULT_FOG_OPTIONS.fogColor;
  const fogOpacity = options.fogOpacity ?? DEFAULT_FOG_OPTIONS.fogOpacity;
  const worldBounds = options.worldBounds ?? DEFAULT_FOG_OPTIONS.worldBounds;

  // 1. Exterior World Ring (CCW order)
  const [minX, minY, maxX, maxY] = worldBounds;
  const exteriorRing: LngLatTuple[] = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ];
  const normalizedExterior = enforceWindingOrder(exteriorRing, false); // CCW

  // 2. Interior Rings (Agujeros suaves de territorio explorado, CW order)
  const polygonRings: Position[][] = [normalizedExterior];
  const mergedPolygons = cellsToMergedPolygons(unlockedHexagons);

  for (const polyCoords of mergedPolygons) {
    if (polyCoords.length > 0) {
      const exteriorOfComponent = polyCoords[0];
      if (exteriorOfComponent.length >= 4) {
        const smoothed = organicSmoothPolygon(exteriorOfComponent as LngLatTuple[]);
        const normalizedHole = enforceWindingOrder(smoothed, true); // CW
        polygonRings.push(normalizedHole);
      }
    }
  }

  const fogFeature: Feature<Polygon, FogFeatureProperties> = {
    type: 'Feature',
    id: 'fog-of-war-mask',
    geometry: {
      type: 'Polygon',
      coordinates: polygonRings,
    },
    properties: {
      fillColor: fogColor,
      fillOpacity: fogOpacity,
      isFogMask: true,
    },
  };

  return {
    type: 'FeatureCollection',
    features: [fogFeature],
  };
}

/**
 * Genera el Halo de Borde Perimetral Orgánico (Aura atmosférica).
 * Traza ÚNICAMENTE el perímetro exterior fusionado del territorio explorado.
 * Cero líneas internas entre celdas; aspecto continuo de expedición de alta gama.
 */
export function generateGlowBorderGeoJSON(
  unlockedHexagons: Iterable<H3Index>,
  options: FogRenderOptions = {}
): FeatureCollection<LineString, GlowBorderProperties> {
  const glowColor = options.glowColor ?? DEFAULT_FOG_OPTIONS.glowColor;
  const glowWidth = options.glowWidth ?? DEFAULT_FOG_OPTIONS.glowWidth;

  const features: Feature<LineString, GlowBorderProperties>[] = [];
  const mergedPolygons = cellsToMergedPolygons(unlockedHexagons);

  let compIdx = 0;
  for (const polyCoords of mergedPolygons) {
    if (polyCoords.length > 0) {
      const exteriorOfComponent = polyCoords[0];
      if (exteriorOfComponent.length >= 4) {
        const smoothed = organicSmoothPolygon(exteriorOfComponent as LngLatTuple[]);
        features.push({
          type: 'Feature',
          id: `glow-perimeter-${compIdx++}`,
          geometry: {
            type: 'LineString',
            coordinates: smoothed,
          },
          properties: {
            stroke: glowColor,
            strokeWidth: glowWidth,
            glowIntensity: 1.0,
          },
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Genera las zonas exploradas como polígonos orgánicos continuos (sin cuadrícula hexagonal).
 */
export function generateUnlockedHexagonsGeoJSON(
  unlockedHexagons: Iterable<H3Index>,
  options: FogRenderOptions = {}
): FeatureCollection<Polygon, HexagonFeatureProperties> {
  const features: Feature<Polygon, HexagonFeatureProperties>[] = [];
  const mergedPolygons = cellsToMergedPolygons(unlockedHexagons);
  const now = Date.now();

  let zoneIdx = 0;
  for (const polyCoords of mergedPolygons) {
    if (polyCoords.length > 0) {
      const exterior = polyCoords[0];
      if (exterior.length >= 4) {
        const smoothed = organicSmoothPolygon(exterior as LngLatTuple[]);
        features.push({
          type: 'Feature',
          id: `organic-zone-${zoneIdx}`,
          geometry: {
            type: 'Polygon',
            coordinates: [smoothed],
          },
          properties: {
            hexId: `organic-zone-${zoneIdx++}`,
            unlockedAt: now,
          },
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Builds the complete unified FogMapData bundle containing all MapLibre GL layers.
 */
export function buildFogMapData(
  unlockedHexagons: Iterable<H3Index>,
  version: number = 0,
  options: FogRenderOptions = {}
): FogMapData {
  const fogLayerGeoJSON = generateInvertedFogGeoJSON(unlockedHexagons, options);
  const glowBorderGeoJSON = generateGlowBorderGeoJSON(unlockedHexagons, options);
  const unlockedHexagonsGeoJSON = generateUnlockedHexagonsGeoJSON(unlockedHexagons, options);

  return {
    fogLayerGeoJSON,
    glowBorderGeoJSON,
    unlockedHexagonsGeoJSON,
    version,
    generatedAt: Date.now(),
  };
}

// ============================================================================
// STATEFUL MEMOIZED BUILDER (PERFORMANCE OPTIMIZATION)
// ============================================================================

/**
 * FogGeoJSONBuilder
 * 
 * Stateful builder with memoization cache.
 * Avoids rebuilding heavy GeoJSON geometries if neither the engine version
 * nor the rendering configuration has changed.
 * This directly prevents bridge serialization overhead and GC pauses in React Native.
 */
export class FogGeoJSONBuilder {
  private _cachedData: FogMapData | null = null;
  private _cachedVersion: number = -1;
  private _cachedOptionsKey: string = '';

  /**
   * Generates or returns cached FogMapData.
   * If version and options match the cache, returns the existing instance in O(1).
   * 
   * @param unlockedHexagons Iterable of unlocked H3 hex IDs
   * @param version Monotonic version counter from H3Engine
   * @param options Styling options
   */
  public getFogMapData(
    unlockedHexagons: Iterable<H3Index>,
    version: number,
    options: FogRenderOptions = {}
  ): FogMapData {
    const fColor = options.fogColor ?? DEFAULT_FOG_OPTIONS.fogColor;
    const fOpacity = options.fogOpacity ?? DEFAULT_FOG_OPTIONS.fogOpacity;
    const gColor = options.glowColor ?? DEFAULT_FOG_OPTIONS.glowColor;
    const gWidth = options.glowWidth ?? DEFAULT_FOG_OPTIONS.glowWidth;
    const vpKey = options.viewportBounds
      ? `${options.viewportBounds.minLng},${options.viewportBounds.minLat},${options.viewportBounds.maxLng},${options.viewportBounds.maxLat}`
      : 'none';
    const optionsKey = `${fColor}_${fOpacity}_${gColor}_${gWidth}_${vpKey}`;

    if (
      this._cachedData !== null &&
      this._cachedVersion === version &&
      this._cachedOptionsKey === optionsKey
    ) {
      return this._cachedData;
    }

    const freshData = buildFogMapData(unlockedHexagons, version, options);

    this._cachedData = freshData;
    this._cachedVersion = version;
    this._cachedOptionsKey = optionsKey;

    return freshData;
  }

  /**
   * Invalidates internal cache, forcing recalculation on next query.
   */
  public invalidate(): void {
    this._cachedData = null;
    this._cachedVersion = -1;
    this._cachedOptionsKey = '';
  }
}

/**
 * Default singleton instance of the Fog GeoJSON Builder.
 */
export const fogGeoJSONBuilder = new FogGeoJSONBuilder();

