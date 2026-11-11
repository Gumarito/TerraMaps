import React, { useEffect, useRef, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { FeatureCollection, Geometry } from 'geojson';
import type { TrackedPartner } from '@/services/partnerRadarService';
import type { LandmarkDiscoveryStatus } from '@/core/geo/regionalLandmarks';
import { FogVisualMode, FOG_STYLE_PRESETS } from '@/core/theme/mapThemes';

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
  /** Se emite en cada movimiento de cámara con el viewport visible. */
  onViewportChange?: (viewport: MapViewport) => void;
}

export interface MapViewport {
  center: [number, number]; // [lng, lat]
  bounds: [number, number, number, number]; // [oeste, sur, este, norte]
}

declare global {
  interface Window {
    maplibregl?: any;
  }
}

/**
 * Oculta/muestra un marcador HTML según el zoom. MapLibre posiciona el elemento raíz con
 * `style.transform` (translate): tocarlo lo manda a la esquina (0,0), detrás del HUD.
 * Por eso el efecto visual va en el hijo interno y solo `display` en el raíz.
 */
function applyMarkerCulling(root: HTMLElement | undefined, hide: boolean): void {
  if (!root) return;
  root.style.display = hide ? 'none' : 'flex';
  const inner = root.firstElementChild as HTMLElement | null;
  if (inner) {
    inner.style.opacity = hide ? '0' : '1';
    inner.style.pointerEvents = hide ? 'none' : 'auto';
    inner.style.transform = hide ? 'scale(0.5)' : 'scale(1)';
  }
}

const TerraMapComponent: React.FC<TerraMapProps> = ({
  userCoordinates = [-99.1332, 19.4326],
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
  recenterTrigger,
  partners,
  landmarks,
  fogVisualMode = 'translucent',
  onViewportChange,
}) => {
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const playerMarkerRef = useRef<any>(null);
  const partnerMarkersRef = useRef<Map<string, any>>(new Map());
  const landmarkMarkersRef = useRef<Map<string, any>>(new Map());

  // Mantener referencias actualizadas en memoria para evitar closures desactualizadas
  const fogGeoJSONRef = useRef(fogGeoJSON);
  fogGeoJSONRef.current = fogGeoJSON;
  const invertedFogRef = useRef(invertedFogGeoJSON);
  invertedFogRef.current = invertedFogGeoJSON;
  const glowBorderRef = useRef(glowBorderGeoJSON);
  glowBorderRef.current = glowBorderGeoJSON;
  const routePathRef = useRef(routePathGeoJSON);
  routePathRef.current = routePathGeoJSON;

  // Seguimiento de referencias previas para aplicar actualizaciones quirúrgicas a fuentes MapLibre
  const prevInvertedRef = useRef<FeatureCollection<Geometry> | undefined>(undefined);
  const prevFogRef = useRef<FeatureCollection<Geometry> | undefined>(undefined);
  const prevGlowRef = useRef<FeatureCollection<Geometry> | undefined>(undefined);
  const prevRouteRef = useRef<FeatureCollection<Geometry> | undefined>(undefined);
  const rafIdRef = useRef<number | null>(null);

  const effectiveFogOpacity = fogVisualMode && FOG_STYLE_PRESETS[fogVisualMode]
    ? FOG_STYLE_PRESETS[fogVisualMode].opacity
    : fogOpacity;

  // Carga e inicialización de MapLibre GL JS en Web
  useEffect(() => {
    let isCancelled = false;

    // Inyectar CSS de MapLibre si no existe
    if (!document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (isCancelled || !mapContainerRef.current || !window.maplibregl) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = new window.maplibregl.Map({
        container: mapContainerRef.current,
        style: mapStyleURL,
        center: userCoordinates,
        zoom: zoomLevel,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on('load', () => {
        if (isCancelled) return;

        // 1. Capa de Niebla Invertida Traslúcida (Velo gris/nocturno suave sobre lo no explorado)
        const currentInverted = invertedFogRef.current || invertedFogGeoJSON;
        if (currentInverted) {
          map.addSource('invertedFogSource', {
            type: 'geojson',
            data: currentInverted,
          });

          map.addLayer({
            id: 'invertedFogFill',
            type: 'fill',
            source: 'invertedFogSource',
            paint: {
              'fill-color': fogColor,
              'fill-opacity': fogOpacity,
            },
          });
          prevInvertedRef.current = currentInverted;
        }

        // 2. Fuente y capa de territorio revelado (fluido, sin cuadrículas rígidas)
        const currentFogData = fogGeoJSONRef.current || fogGeoJSON;
        map.addSource('unlockedHexagonsSource', {
          type: 'geojson',
          data: currentFogData,
        });

        map.addLayer({
          id: 'unlockedHexagonsFill',
          type: 'fill',
          source: 'unlockedHexagonsSource',
          paint: {
            'fill-color': glowColor,
            'fill-opacity': 0.10,
          },
        });
        prevFogRef.current = currentFogData;

        // 3. Resplandor auroral orgánico sobre el perímetro exterior (fluido, continuo, sin hexágonos)
        const currentGlowData = glowBorderRef.current || glowBorderGeoJSON;
        if (currentGlowData) {
          map.addSource('glowBordersSource', {
            type: 'geojson',
            data: currentGlowData,
          });

          map.addLayer({
            id: 'glowBordersLine',
            type: 'line',
            source: 'glowBordersSource',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': glowColor,
              'line-width': 4.5,
              'line-opacity': 0.45,
              'line-blur': 8.0,
            },
          });
          prevGlowRef.current = currentGlowData;
        }

        // 4. Fuente y capas de rutas: Terrestre (Naranja) y Vuelos Aéreos (Azul Celeste Estratosférico)
        const currentRouteData = routePathRef.current || routePathGeoJSON;
        map.addSource('routePathSource', {
          type: 'geojson',
          data: currentRouteData || { type: 'FeatureCollection', features: [] },
        });

        // 4.1. Capa de Ruta Terrestre (Caminata, Trote, Bici, Automóvil)
        map.addLayer({
          id: 'routePathLine',
          type: 'line',
          source: 'routePathSource',
          filter: ['!=', ['get', 'transportMode'], 'flight'],
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#f97316', // Naranja atlético de ruta activa
            'line-width': 4.0,
            'line-opacity': 0.92,
          },
        });

        // 4.2. Resplandor de Vuelos en Avión (Aviation Aurora Glow)
        map.addLayer({
          id: 'flightPathGlow',
          type: 'line',
          source: 'routePathSource',
          filter: ['==', ['get', 'transportMode'], 'flight'],
          paint: {
            'line-color': '#38bdf8',
            'line-width': 9.0,
            'line-blur': 6.0,
            'line-opacity': 0.45,
          },
        });

        // 4.3. Corredor Aéreo de Vuelos en Avión (Línea discontinua celestial de aviación)
        map.addLayer({
          id: 'flightPathLine',
          type: 'line',
          source: 'routePathSource',
          filter: ['==', ['get', 'transportMode'], 'flight'],
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#38bdf8', // Azul celestial de aviación
            'line-width': 3.5,
            'line-opacity': 0.95,
            'line-dasharray': [3, 2],
          },
        });
        prevRouteRef.current = currentRouteData;

        // 5. Marcador del jugador
        const el = document.createElement('div');
        el.className = 'player-tactical-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = accentColor;
        el.style.border = '2px solid #ffffff';
        el.style.boxShadow = `0 0 16px ${accentColor}`;

        playerMarkerRef.current = new window.maplibregl.Marker({ element: el })
          .setLngLat(userCoordinates)
          .addTo(map);

        // Nivel de detalle (LOD) & Culling por zoom: Oculta marcadores al alejarse para mantener el mapa limpio y despejado
        const updateZoomCulling = () => {
          const z = map.getZoom();
          const shouldHide = z < 13.2;

          partnerMarkersRef.current.forEach((marker) => applyMarkerCulling(marker.getElement(), shouldHide));
          landmarkMarkersRef.current.forEach((marker) => applyMarkerCulling(marker.getElement(), shouldHide));
        };

        map.on('zoom', updateZoomCulling);
        updateZoomCulling();

        // Viewport en vivo para el radar de pareja fuera de pantalla
        const emitViewport = () => {
          const b = map.getBounds();
          const c = map.getCenter();
          onViewportChangeRef.current?.({
            center: [c.lng, c.lat],
            bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          });
        };
        map.on('move', emitViewport);
        emitViewport();

        onMapLoaded?.();
      });
    };

    if (window.maplibregl) {
      initMap();
    } else {
      let script = document.getElementById('maplibre-gl-js') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'maplibre-gl-js';
        script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
        script.async = true;
        script.onload = () => initMap();
        document.body.appendChild(script);
      } else {
        script.addEventListener('load', initMap);
      }
    }

    return () => {
      isCancelled = true;
      partnerMarkersRef.current.forEach((marker) => marker.remove());
      partnerMarkersRef.current.clear();
      landmarkMarkersRef.current.forEach((marker) => marker.remove());
      landmarkMarkersRef.current.clear();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapStyleURL]);

  // Actualizar datos de capas GeoJSON quirúrgicamente con coalescencia via requestAnimationFrame
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const updateDirtySources = () => {
      try {
        if (!map.isStyleLoaded()) return;

        // Actualizar solo las fuentes cuyos datos hayan cambiado por referencia
        if (invertedFogGeoJSON && invertedFogGeoJSON !== prevInvertedRef.current) {
          const invertedSource = map.getSource('invertedFogSource');
          if (invertedSource) {
            invertedSource.setData(invertedFogGeoJSON);
            prevInvertedRef.current = invertedFogGeoJSON;
          }
        }

        if (fogGeoJSON && fogGeoJSON !== prevFogRef.current) {
          const hexSource = map.getSource('unlockedHexagonsSource');
          if (hexSource) {
            hexSource.setData(fogGeoJSON);
            prevFogRef.current = fogGeoJSON;
          }
        }

        if (glowBorderGeoJSON && glowBorderGeoJSON !== prevGlowRef.current) {
          const glowSource = map.getSource('glowBordersSource');
          if (glowSource) {
            glowSource.setData(glowBorderGeoJSON);
            prevGlowRef.current = glowBorderGeoJSON;
          }
        }

        if (routePathGeoJSON && routePathGeoJSON !== prevRouteRef.current) {
          const routeSource = map.getSource('routePathSource');
          if (routeSource) {
            routeSource.setData(routePathGeoJSON);
            prevRouteRef.current = routePathGeoJSON;
          }
        }
      } catch {
        // Fallback seguro
      }
    };

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (map.isStyleLoaded()) {
        updateDirtySources();
      } else {
        map.once('load', updateDirtySources);
      }
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [fogGeoJSON, invertedFogGeoJSON, glowBorderGeoJSON, routePathGeoJSON]);

  // Actualizar colores del tema y modo de niebla visual reactivamente
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (map.getLayer('invertedFogFill')) {
        map.setPaintProperty('invertedFogFill', 'fill-color', fogColor);
        map.setPaintProperty('invertedFogFill', 'fill-opacity', effectiveFogOpacity);
      }
      if (map.getLayer('unlockedHexagonsFill')) {
        map.setPaintProperty('unlockedHexagonsFill', 'fill-color', glowColor);
      }
      if (map.getLayer('glowBordersLine')) {
        map.setPaintProperty('glowBordersLine', 'line-color', glowColor);
        if (fogVisualMode === 'realistic_mist') {
          map.setPaintProperty('glowBordersLine', 'line-blur', 14.0);
          map.setPaintProperty('glowBordersLine', 'line-width', 7.5);
          map.setPaintProperty('glowBordersLine', 'line-opacity', 0.60);
        } else {
          map.setPaintProperty('glowBordersLine', 'line-blur', 8.0);
          map.setPaintProperty('glowBordersLine', 'line-width', 4.5);
          map.setPaintProperty('glowBordersLine', 'line-opacity', 0.45);
        }
      }
      if (playerMarkerRef.current) {
        const el = playerMarkerRef.current.getElement();
        if (el) {
          el.style.backgroundColor = accentColor;
          el.style.boxShadow = `0 0 16px ${accentColor}`;
        }
      }
    } catch {
      // Ignorar recarga
    }
  }, [glowColor, accentColor, fogColor, effectiveFogOpacity]);

  // Recenter instantáneo guiado a la ubicación del usuario
  useEffect(() => {
    if (!recenterTrigger) return;
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({
        center: userCoordinates,
        zoom: zoomLevel || 15.5,
        duration: 750,
        essential: true,
      });
    }
  }, [recenterTrigger]);

  // Marcadores de amigos / pareja en modo multijugador radar
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.maplibregl) return;

    const currentMap = partnerMarkersRef.current;
    const incoming = partners || [];
    const incomingIds = new Set(incoming.map((p) => p.id));

    // Eliminar marcadores obsoletos
    currentMap.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        currentMap.delete(id);
      }
    });

    incoming.forEach((partner) => {
      const existing = currentMap.get(partner.id);
      const initials = partner.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const isZoomCulled = map.getZoom() < 13.2;
      const initialDisplay = isZoomCulled ? 'none' : 'flex';
      const initialOpacity = isZoomCulled ? '0' : '1';
      const initialPointer = isZoomCulled ? 'none' : 'auto';
      const initialTransform = isZoomCulled ? 'scale(0.5)' : 'scale(1)';

      const innerHtml = `
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(12, 16, 29, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
          padding: 5px 11px;
          border-radius: 18px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          cursor: pointer;
          white-space: nowrap;
          opacity: ${initialOpacity};
          pointer-events: ${initialPointer};
          transform: ${initialTransform};
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        ">
          <div style="
            width: 22px;
            height: 22px;
            border-radius: 11px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 9px;
            color: #f8fafc;
            position: relative;
            letter-spacing: 0.5px;
          ">
            ${initials}
            <div style="
              position: absolute;
              bottom: -1px;
              right: -1px;
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: #10b981;
              border: 1px solid #0c101d;
            "></div>
          </div>
          <div style="display: flex; flex-direction: column; line-height: 1.2;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-weight: 700; font-size: 11px; color: #f8fafc;">${partner.name}</span>
              <span style="font-size: 9px; font-weight: 500; color: #94a3b8;">• ${partner.relation.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '').trim()}</span>
            </div>
            <span style="font-size: 9px; font-weight: 500; color: #64748b;">
              ${partner.speedKmh > 0 ? `${partner.speedKmh} km/h` : 'En reposo'}
            </span>
          </div>
        </div>
      `;

      if (!existing) {
        const el = document.createElement('div');
        el.className = 'terramaps-partner-marker';
        el.style.display = initialDisplay;
        el.innerHTML = innerHtml;
        const marker = new window.maplibregl.Marker({ element: el })
          .setLngLat(partner.coordinates)
          .addTo(map);
        currentMap.set(partner.id, marker);
      } else {
        existing.setLngLat(partner.coordinates);
        const el = existing.getElement();
        if (el) {
          el.style.display = initialDisplay;
          el.innerHTML = innerHtml;
        }
      }
    });
  }, [partners]);

  // Marcadores de Puntos de Interés y Monumentos Regionales
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.maplibregl) return;

    const currentMap = landmarkMarkersRef.current;
    const incoming = landmarks || [];
    const incomingIds = new Set(incoming.map((l) => l.landmark.id));

    currentMap.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        currentMap.delete(id);
      }
    });

    incoming.forEach((item) => {
      const { landmark, distanceMeters } = item;
      const isUnlocked = item.isDiscovered || (item as any).isUnlocked;
      const existing = currentMap.get(landmark.id);

      const isZoomCulled = map.getZoom() < 13.0;
      const initialDisplay = isZoomCulled ? 'none' : 'flex';
      const initialOpacity = isZoomCulled ? '0' : '1';
      const initialPointer = isZoomCulled ? 'none' : 'auto';
      const initialTransform = isZoomCulled ? 'scale(0.5)' : 'scale(1)';

      const innerHtml = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(10, 15, 29, 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid ${isUnlocked ? 'rgba(212, 175, 55, 0.45)' : 'rgba(255, 255, 255, 0.1)'};
          box-shadow: ${isUnlocked ? '0 4px 18px rgba(212, 175, 55, 0.2)' : '0 4px 14px rgba(0,0,0,0.4)'};
          padding: 4px 10px;
          border-radius: 14px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          white-space: nowrap;
          cursor: pointer;
          opacity: ${initialOpacity};
          pointer-events: ${initialPointer};
          transform: ${initialTransform};
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        " title="${landmark.name} - ${landmark.description}">
          <span style="font-size: 12px; opacity: ${isUnlocked ? '1' : '0.6'};">${landmark.emoji}</span>
          <span style="color: ${isUnlocked ? '#fef08a' : '#cbd5e1'}; font-weight: 700; font-size: 10px; max-width: 100px; overflow: hidden; text-overflow: ellipsis;">${landmark.name.split(' ')[0]}</span>
          <span style="font-size: 8px; font-weight: 800; color: ${isUnlocked ? '#10b981' : '#64748b'}; letter-spacing: 0.3px;">${isUnlocked ? 'DESCUBIERTO' : `${Math.round(distanceMeters)}m`}</span>
        </div>
      `;

      if (!existing) {
        const el = document.createElement('div');
        el.className = 'terramaps-landmark-marker';
        el.style.display = initialDisplay;
        el.innerHTML = innerHtml;
        const marker = new window.maplibregl.Marker({ element: el })
          .setLngLat(landmark.coordinates)
          .addTo(map);
        currentMap.set(landmark.id, marker);
      } else {
        const el = existing.getElement();
        if (el) {
          el.style.display = initialDisplay;
          el.innerHTML = innerHtml;
        }
      }
    });
  }, [landmarks]);

  // Actualizar posición de la cámara y marcador del jugador (suave y evitando cálculos duplicados)
  const prevCoordsRef = useRef<[number, number]>(userCoordinates);
  useEffect(() => {
    const [lng, lat] = userCoordinates;
    const [prevLng, prevLat] = prevCoordsRef.current;

    // Evitar trabajo si las coordenadas son idénticas
    if (lng === prevLng && lat === prevLat) return;
    prevCoordsRef.current = userCoordinates;

    const map = mapInstanceRef.current;
    if (map) {
      // easeTo es significativamente más eficiente y fluido para movimiento a pie que flyTo
      map.easeTo({ center: userCoordinates, duration: 450, essential: true });
    }
    if (playerMarkerRef.current) {
      playerMarkerRef.current.setLngLat(userCoordinates);
    }
  }, [userCoordinates]);

  return (
    <View style={styles.container}>
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </View>
  );
};

export const TerraMap = memo(TerraMapComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
