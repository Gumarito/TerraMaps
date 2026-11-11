import React, { useRef, useMemo, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Geometry } from 'geojson';
import type { TrackedPartner } from '@/services/partnerRadarService';
import type { LandmarkDiscoveryStatus } from '@/core/geo/regionalLandmarks';
import type { FogVisualMode } from '@/core/theme/mapThemes';

export const DEFAULT_DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export interface TerraMapProps {
  userCoordinates?: [number, number]; // [longitude, latitude]
  fogGeoJSON: FeatureCollection<Geometry>;
  invertedFogGeoJSON?: FeatureCollection<Geometry>;
  glowBorderGeoJSON?: FeatureCollection<Geometry>;
  routePathGeoJSON?: FeatureCollection<Geometry>;
  mapStyleURL?: string;
  glowColor?: string;
  fogColor?: string;
  fogOpacity?: number;
  accentColor?: string;
  onMapLoaded?: () => void;
  zoomLevel?: number;
  recenterTrigger?: number;
  partners?: TrackedPartner[];
  landmarks?: LandmarkDiscoveryStatus[];
  fogVisualMode?: FogVisualMode;
  onViewportChange?: (viewport: { center: [number, number]; bounds: [number, number, number, number] }) => void;
}

const TerraMapNativeComponent: React.FC<TerraMapProps> = ({
  userCoordinates = [-99.1332, 19.4326], // Default: CDMX (Longitud, Latitud)
  fogGeoJSON,
  invertedFogGeoJSON,
  glowBorderGeoJSON,
  routePathGeoJSON,
  mapStyleURL = DEFAULT_DARK_MAP_STYLE,
  glowColor = '#00f5d4',
  fogColor = '#0f172a',
  fogOpacity = 0.55,
  accentColor = '#00f5d4',
  onMapLoaded,
  zoomLevel = 15.5,
}) => {
  const cameraRef = useRef<any>(null);

  const fogFillStyle = useMemo(() => ({
    fillColor: glowColor,
    fillOpacity: 0.20,
  }), [glowColor]);

  const glowBorderStyle = useMemo(() => ({
    lineColor: glowColor,
    lineWidth: 2.5,
    lineOpacity: 0.90,
    lineBlur: 1.5,
  }), [glowColor]);

  const routeLineStyle = useMemo(() => ({
    lineColor: '#f97316',
    lineWidth: 4.0,
    lineOpacity: 0.92,
  }), []);

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        {...({ styleURL: mapStyleURL } as any)}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={false}
        onDidFinishLoadingMap={onMapLoaded}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          zoomLevel={zoomLevel}
          centerCoordinate={userCoordinates}
          animationMode="easeTo"
          animationDuration={350}
        />

        {/* Capa de Territorio Revelado */}
        {fogGeoJSON && (
          <MapLibreGL.ShapeSource id="unlockedHexagonsSource" shape={fogGeoJSON}>
            <MapLibreGL.FillLayer
              id="unlockedHexagonsFill"
              style={fogFillStyle}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Capa de Resplandor Táctico (Glow Borders) */}
        {glowBorderGeoJSON && (
          <MapLibreGL.ShapeSource id="glowBordersSource" shape={glowBorderGeoJSON}>
            <MapLibreGL.LineLayer
              id="glowBordersLine"
              style={glowBorderStyle}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Capa de Ruta GPS Activa */}
        {routePathGeoJSON && (
          <MapLibreGL.ShapeSource id="routePathSource" shape={routePathGeoJSON}>
            <MapLibreGL.LineLayer
              id="routePathLine"
              style={routeLineStyle}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Marcador Táctico de Posición del Jugador */}
        <MapLibreGL.PointAnnotation
          id="playerMarker"
          coordinate={userCoordinates}
        >
          <View style={[styles.playerPulseOuter, { borderColor: accentColor }]}>
            <View style={[styles.playerPulseCore, { backgroundColor: accentColor }]} />
          </View>
        </MapLibreGL.PointAnnotation>
      </MapLibreGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  map: {
    flex: 1,
  },
  playerPulseOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 245, 212, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  playerPulseCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
});

export const TerraMap = memo(TerraMapNativeComponent);
