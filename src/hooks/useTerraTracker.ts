import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { storageService, UserStats } from '@/services/storage';
import { syncService } from '@/services/syncService';
import { monetizationService } from '@/services/monetizationService';
import { authService } from '@/services/authService';
import { realtimeTerritoryService, KingChangeEvent } from '@/services/realtimeTerritory';
import { routeTrackerService, RecordedRoute } from '@/services/routeTrackerService';
import { streakService, StreakData } from '@/services/streakService';
import { audioFeedback } from '@/utils/audioFeedback';
import { streetWalkingRouter } from '@/core/geo/streetWaypoints';
import {
  classifyTransportSpeed,
  TransportState,
  TransportType,
} from '@/services/transportClassifier';
import { backgroundWatchdog } from '@/services/backgroundWatchdog';
import {
  h3Engine,
  coordinateToH3,
  fogGeoJSONBuilder,
  gpsAccuracyFilter,
  type GeoCoordinates,
} from '@/core';
import { BatteryShieldState } from '@/core/battery/types';
import { MapTheme, FogVisualMode } from '@/core/theme/mapThemes';
import { partnerRadarService, TrackedPartner } from '@/services/partnerRadarService';
import { evaluateLandmarksDiscovery, LandmarkDiscoveryStatus } from '@/core/geo/regionalLandmarks';
import { calculateRegionalMetrics, RegionalExplorationStats } from '@/services/regionalMetrics';
import { achievementsService, TerraBadge } from '@/services/achievementsService';
import { analyticsDatabaseService } from '@/services/analyticsDatabaseService';

export interface UseTerraTrackerReturn {
  coordinates: [number, number]; // [lng, lat]
  currentHexId: string | null;
  sectorName: string;
  batteryState: BatteryShieldState;
  speedKmh: number;
  stats: UserStats;
  streak: StreakData;
  transportState: TransportState;
  fogGeoJSON: FeatureCollection<Geometry>;
  invertedFogGeoJSON: FeatureCollection<Geometry>;
  glowBorderGeoJSON: FeatureCollection<Geometry>;
  routePathGeoJSON: FeatureCollection<Geometry>;
  kingTitle: string;
  territoryAlert: string | null;
  watchdogWarning: string | null;
  isReady: boolean;
  // Rutas
  isRecordingRoute: boolean;
  routeElapsedSeconds: number;
  routeDistanceMeters: number;
  startRoute: () => void;
  stopRoute: (title?: string) => Promise<RecordedRoute | null>;
  inspectRouteOnMap: (route: RecordedRoute) => void;
  clearInspectedRoute: () => void;
  // Multijugador, Métricas Regionales y Niebla
  recenterTrigger: number;
  regionalStats: RegionalExplorationStats;
  partners: TrackedPartner[];
  isPartnerRadarActive: boolean;
  togglePartnerRadar: () => void;
  landmarks: LandmarkDiscoveryStatus[];
  fogVisualMode: FogVisualMode;
  setFogVisualMode: (mode: FogVisualMode) => void;
  badges: TerraBadge[];
  // Acciones
  pulseExplore: () => void;
  simulateWalk: (mode?: TransportType) => void;
  cycleTransportMode: () => void;
  recenter: () => void;
  refreshAllHexagonsFromStorage: () => void;
  dismissTerritoryAlert: () => void;
  simulateKingAlert: () => void;
}

export function useTerraTracker(theme?: MapTheme): UseTerraTrackerReturn {
  // Coordenadas iniciales por defecto (ej. CDMX: Longitud -99.1332, Latitud 19.4326)
  const [coordinates, setCoordinates] = useState<[number, number]>([-99.1332, 19.4326]);
  const [currentHexId, setCurrentHexId] = useState<string | null>(null);
  const [batteryState, setBatteryState] = useState<BatteryShieldState>(BatteryShieldState.LEVEL_1_IDLE);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [stats, setStats] = useState<UserStats>(storageService.getStats());
  const [streak, setStreak] = useState<StreakData>(streakService.getStreakData());
  const [isReady, setIsReady] = useState<boolean>(false);
  const [kingTitle, setKingTitle] = useState<string>('Defensor de Zona');
  const [territoryAlert, setTerritoryAlert] = useState<string | null>(null);
  const [watchdogWarning, setWatchdogWarning] = useState<string | null>(null);
  const alertTimeoutRef = useRef<any>(null);

  // Gatillo de recentrado explícito para la cámara MapLibre
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);

  // Modo visual de la niebla territorial
  const [fogVisualMode, setFogVisualMode] = useState<FogVisualMode>('translucent');

  // Modo Multijugador / Radar de Pareja y Amigos
  const [isPartnerRadarActive, setIsPartnerRadarActive] = useState<boolean>(true);
  const [partners, setPartners] = useState<TrackedPartner[]>(() => partnerRadarService.getPartners());

  useEffect(() => {
    const unsub = partnerRadarService.subscribe((list) => {
      setPartners(list);
    });
    return unsub;
  }, []);

  const togglePartnerRadar = useCallback(() => {
    const active = partnerRadarService.toggleRadar();
    setIsPartnerRadarActive(active);
  }, []);

  // Estado de grabación de ruta
  const [isRecordingRoute, setIsRecordingRoute] = useState<boolean>(false);
  const [routeElapsedSeconds, setRouteElapsedSeconds] = useState<number>(0);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number>(0);
  const activeRouteCoordsRef = useRef<[number, number][]>([]);

  // Capas GeoJSON para MapLibre GL (precargadas síncronamente para evitar mapa vacío en inicio)
  const [fogGeoJSON, setFogGeoJSON] = useState<FeatureCollection<Geometry>>(() => {
    const existing = storageService.loadUnlockedHexagonsSync();
    if (existing.size === 0) {
      const initialLoc: GeoCoordinates = { latitude: 19.4326, longitude: -99.1332 };
      const discovery = h3Engine.processLocation(initialLoc, 1);
      storageService.saveHexagons(discovery.newlyUnlockedHexes);
    } else {
      h3Engine.importHexagons(existing);
    }
    const unlockedHexes = h3Engine.getUnlockedHexagons();
    const mapData = fogGeoJSONBuilder.getFogMapData(
      unlockedHexes,
      h3Engine.version,
      {
        glowColor: theme?.glowColor ?? '#00f5d4',
        glowWidth: theme?.glowWidth ?? 2.5,
        fogColor: theme?.fogColor ?? '#0b0f19',
        fogOpacity: theme?.fogOpacity ?? 0.88,
      }
    );
    return mapData.unlockedHexagonsGeoJSON as FeatureCollection<Geometry>;
  });

  const [glowBorderGeoJSON, setGlowBorderGeoJSON] = useState<FeatureCollection<Geometry>>(() => {
    const unlockedHexes = h3Engine.getUnlockedHexagons();
    const mapData = fogGeoJSONBuilder.getFogMapData(
      unlockedHexes,
      h3Engine.version,
      {
        glowColor: theme?.glowColor ?? '#00f5d4',
        glowWidth: theme?.glowWidth ?? 2.5,
        fogColor: theme?.fogColor ?? '#0b0f19',
        fogOpacity: theme?.fogOpacity ?? 0.88,
      }
    );
    return mapData.glowBorderGeoJSON as FeatureCollection<Geometry>;
  });

  const [invertedFogGeoJSON, setInvertedFogGeoJSON] = useState<FeatureCollection<Geometry>>(() => {
    const unlockedHexes = h3Engine.getUnlockedHexagons();
    const mapData = fogGeoJSONBuilder.getFogMapData(
      unlockedHexes,
      h3Engine.version,
      {
        glowColor: theme?.glowColor ?? '#00f5d4',
        glowWidth: theme?.glowWidth ?? 2.5,
        fogColor: theme?.fogColor ?? '#0f172a',
        fogOpacity: theme?.fogOpacity ?? 0.60,
      }
    );
    return mapData.fogLayerGeoJSON as FeatureCollection<Geometry>;
  });

  const [selectedTransportMode, setSelectedTransportMode] = useState<TransportType>('walk');
  const [routePathGeoJSON, setRoutePathGeoJSON] = useState<FeatureCollection<Geometry>>({
    type: 'FeatureCollection',
    features: [],
  });

  const lastCoordsRef = useRef<[number, number]>(coordinates);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Helper para refrescar GeoJSON desde H3Engine
  const refreshMapLayers = useCallback(() => {
    const currentTheme = themeRef.current;
    const unlockedHexes = h3Engine.getUnlockedHexagons();
    const mapData = fogGeoJSONBuilder.getFogMapData(
      unlockedHexes,
      h3Engine.version,
      {
        glowColor: currentTheme?.glowColor ?? '#00f5d4',
        glowWidth: currentTheme?.glowWidth ?? 2.5,
        fogColor: currentTheme?.fogColor ?? '#0b0f19',
        fogOpacity: currentTheme?.fogOpacity ?? 0.88,
      }
    );

    setFogGeoJSON(mapData.unlockedHexagonsGeoJSON as FeatureCollection<Geometry>);
    setInvertedFogGeoJSON(mapData.fogLayerGeoJSON as FeatureCollection<Geometry>);
    setGlowBorderGeoJSON(mapData.glowBorderGeoJSON as FeatureCollection<Geometry>);
    setStats(storageService.getStats());
  }, []);

  // Actualizar capas cuando cambian las propiedades visuales del tema
  useEffect(() => {
    if (isReady) {
      refreshMapLayers();
    }
  }, [theme?.mode, theme?.glowColor, theme?.fogColor, theme?.fogOpacity, isReady, refreshMapLayers]);

  // Suscripción al servicio de grabación de rutas
  useEffect(() => {
    const unsub = routeTrackerService.subscribe((state) => {
      setIsRecordingRoute(state.isRecording);
      setRouteElapsedSeconds(state.elapsedSeconds);
      setRouteDistanceMeters(state.distanceMeters);
    });
    const unsubStreak = streakService.subscribe((streakData) => {
      setStreak(streakData);
    });
    const unsubWatchdog = backgroundWatchdog.subscribe((status) => {
      setWatchdogWarning(status.warningMessage);
    });
    return () => {
      unsub();
      unsubStreak();
      unsubWatchdog();
    };
  }, []);

  // Inicializar autenticación, almacenamiento, mapa y suscripción en tiempo real
  useEffect(() => {
    let isMounted = true;

    async function initializeTracker() {
      // 1. Inicializar sesión de autenticación (Guest Auth o Supabase)
      await authService.initializeAuth();

      const persistedHexes = await storageService.loadUnlockedHexagons();

      if (persistedHexes.size === 0) {
        // Desbloqueo inicial de cortesía (k-ring = 1 alrededor del jugador)
        const [lng, lat] = lastCoordsRef.current;
        const initialLoc: GeoCoordinates = { latitude: lat, longitude: lng };
        const discovery = h3Engine.processLocation(initialLoc, 1);
        await storageService.saveHexagons(discovery.newlyUnlockedHexes);
        syncService.queueHexagonsForSync(discovery.newlyUnlockedHexes);
        streakService.recordDiscovery(discovery.newlyUnlockedHexes.length);
      } else {
        h3Engine.importHexagons(persistedHexes);
      }

      // Sincronizar pendientes con la nube en segundo plano
      syncService.syncPendingHexagons().catch(() => {});

      if (isMounted) {
        const [lng, lat] = lastCoordsRef.current;
        const currentHex = coordinateToH3(lat, lng);
        setCurrentHexId(currentHex);

        refreshMapLayers();
        setIsReady(true);

        // Consultar Rey de Zona actual
        if (currentHex) {
          syncService.getTerritoryKing(currentHex).then((king) => {
            if (isMounted && king) {
              const currentUserId = authService.getCurrentUserId();
              if (currentUserId && king.kingUserId === currentUserId) {
                setKingTitle(`👑 ¡Eres el Rey! (${king.hexCount} zonas)`);
              } else {
                setKingTitle(`👑 Rey: ${king.kingUsername} (${king.hexCount} zonas)`);
              }
            }
          });
        }
      }

      // Intentar obtener geolocalización real del navegador si el usuario lo permite
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMounted) return;
            const filterRes = gpsAccuracyFilter.processPoint({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyMeters: pos.coords.accuracy,
              timestampMs: pos.timestamp || Date.now(),
            });

            if (!filterRes.isValid) {
              console.warn('[TerraTracker] Coordenada GPS descartada por filtro:', filterRes.rejectedReason);
              return;
            }

            backgroundWatchdog.reportHeartbeat();

            const realLng = pos.coords.longitude;
            const realLat = pos.coords.latitude;
            const newCoords: [number, number] = [realLng, realLat];
            setCoordinates(newCoords);
            lastCoordsRef.current = newCoords;

            const initialLoc: GeoCoordinates = { latitude: realLat, longitude: realLng };
            const discovery = h3Engine.processLocation(initialLoc, 1);
            if (discovery.isNewDiscovery) {
              storageService.saveHexagons(discovery.newlyUnlockedHexes);
              syncService.queueHexagonsForSync(discovery.newlyUnlockedHexes);
              streakService.recordDiscovery(discovery.newlyUnlockedHexes.length);
              refreshMapLayers();
              audioFeedback.playDiscoverySound();
            }

            const hex = coordinateToH3(realLat, realLng);
            setCurrentHexId(hex);
          },
          () => {
            // Silencioso fallback
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }

    initializeTracker();

    // 2. Suscripción en tiempo real a 'territory_kings' con Supabase Realtime
    const unsubscribeKing = realtimeTerritoryService.subscribeToTerritoryKings((event: KingChangeEvent) => {
      if (!isMounted) return;

      setTerritoryAlert(event.message);

      if (event.isCurrentUserNewKing) {
        setKingTitle(`👑 ¡Eres el Rey! (${event.hexCount} zonas)`);
      } else if (event.isCurrentUserDethroned) {
        setKingTitle(`⚔️ Destronado por ${event.newKingUsername}`);
      } else {
        setKingTitle(`👑 Rey: ${event.newKingUsername} (${event.hexCount} zonas)`);
      }

      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      alertTimeoutRef.current = setTimeout(() => {
        if (isMounted) setTerritoryAlert(null);
      }, 6000);
    });

    return () => {
      isMounted = false;
      unsubscribeKing();
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, [refreshMapLayers]);

  // Radar Pulse (simula pulso de dron táctico)
  const pulseExplore = useCallback(() => {
    if (!monetizationService.canDeployDrone()) {
      return;
    }

    const deployed = monetizationService.deployDrone();
    if (!deployed) return;

    audioFeedback.playDroneRadarSound();

    const [lng, lat] = coordinates;
    const currentLoc: GeoCoordinates = { latitude: lat, longitude: lng };
    const kring = monetizationService.getDroneRadarKring();
    const discovery = h3Engine.processLocation(currentLoc, kring);

    if (discovery.isNewDiscovery) {
      storageService.saveHexagons(discovery.newlyUnlockedHexes);
      syncService.queueHexagonsForSync(discovery.newlyUnlockedHexes);
      streakService.recordDiscovery(discovery.newlyUnlockedHexes.length);
      refreshMapLayers();
      audioFeedback.playDiscoverySound();

      if (routeTrackerService.getIsRecording()) {
        routeTrackerService.addLocationPoint(lat, lng, 0, true);
      }
    }
  }, [coordinates, refreshMapLayers]);

  // Iniciar / Detener grabación de ruta
  const startRoute = useCallback(() => {
    const currentCount = h3Engine.getUnlockedHexagons().length;
    activeRouteCoordsRef.current = [coordinates];
    setRoutePathGeoJSON({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [coordinates],
          },
          properties: {},
        },
      ],
    });
    routeTrackerService.startRecording(currentCount);
    audioFeedback.playRouteStartSound();
  }, [coordinates]);

  const stopRoute = useCallback(async (title?: string) => {
    const route = await routeTrackerService.stopRecording(title);
    audioFeedback.playRouteFinishSound();
    return route;
  }, []);

  const inspectRouteOnMap = useCallback((route: RecordedRoute) => {
    if (!route.coordinates || route.coordinates.length === 0) return;
    setRoutePathGeoJSON({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates,
          },
          properties: {
            transportMode: (route as any).transportMode || (route.avgSpeedKmh > 200 ? 'flight' : 'ground'),
          },
        },
      ],
    });
    // Centrar mapa en el inicio de la ruta
    setCoordinates(route.coordinates[0]);
  }, []);

  const clearInspectedRoute = useCallback(() => {
    setRoutePathGeoJSON({
      type: 'FeatureCollection',
      features: [],
    });
  }, []);

  // Simulador de Movimiento Cinético (Caminata, Trote, Bici, Auto, Avión)
  // Sanitiza el argumento para evitar crashes si React Native pasa un GestureResponderEvent
  const simulateWalk = useCallback((modeInput?: any) => {
    const validMode: TransportType =
      typeof modeInput === 'string' && ['walk', 'run', 'bike', 'car', 'flight'].includes(modeInput)
        ? (modeInput as TransportType)
        : selectedTransportMode;

    const speedConfig = {
      still: { speedMps: 0, speedKmh: 0, stepCount: 0 },
      walk: { speedMps: 1.35, speedKmh: 4.8, stepCount: 1 },
      run: { speedMps: 3.20, speedKmh: 11.5, stepCount: 2 },
      bike: { speedMps: 6.10, speedKmh: 22.0, stepCount: 3 },
      car: { speedMps: 15.3, speedKmh: 55.0, stepCount: 6 },
      flight: { speedMps: 97.2, speedKmh: 350.0, stepCount: 16 },
    }[validMode];

    const prevCoords = lastCoordsRef.current;
    streetWalkingRouter.setPosition(prevCoords);
    let nextCoords = prevCoords;
    for (let i = 0; i < speedConfig.stepCount; i++) {
      nextCoords = streetWalkingRouter.nextStep();
    }

    const [nextLng, nextLat] = nextCoords;

    const filterRes = gpsAccuracyFilter.processPoint(
      {
        latitude: nextLat,
        longitude: nextLng,
        timestampMs: Date.now(),
        accuracyMeters: 5,
      },
      validMode === 'flight'
    );

    if (!filterRes.isValid && filterRes.isSpike) {
      console.warn('[TerraTracker] Salto anómalo bloqueado por filtro:', filterRes.rejectedReason);
      return;
    }

    backgroundWatchdog.reportHeartbeat();

    lastCoordsRef.current = nextCoords;
    setCoordinates(nextCoords);

    const currentLoc: GeoCoordinates = {
      latitude: nextLat,
      longitude: nextLng,
      speed: speedConfig.speedMps,
    };
    const discovery = h3Engine.processLocation(currentLoc, 1);

    if (discovery.isNewDiscovery) {
      storageService.saveHexagons(discovery.newlyUnlockedHexes);
      syncService.queueHexagonsForSync(discovery.newlyUnlockedHexes);
      streakService.recordDiscovery(discovery.newlyUnlockedHexes.length);
      refreshMapLayers();
      audioFeedback.playDiscoverySound();
    }

    // Registrar telemetría de movilidad diaria y calorías
    analyticsDatabaseService.recordMobility({
      speedKmh: speedConfig.speedKmh,
      distanceDeltaKm: (speedConfig.speedMps * 2.5) / 1000,
      durationDeltaSeconds: 3,
      transportMode: validMode === 'walk' ? 'WALKING' : validMode === 'run' ? 'RUNNING' : validMode === 'flight' ? 'FLIGHT' : 'VEHICLE',
    });

    // Si está grabando ruta, registrar punto y actualizar línea GeoJSON en vivo
    if (routeTrackerService.getIsRecording()) {
      routeTrackerService.addLocationPoint(
        nextLat,
        nextLng,
        speedConfig.speedMps,
        discovery.isNewDiscovery
      );
      activeRouteCoordsRef.current.push(nextCoords);
      setRoutePathGeoJSON({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [...activeRouteCoordsRef.current],
            },
            properties: {
              transportMode: validMode === 'flight' ? 'flight' : 'ground',
            },
          },
        ],
      });
    }

    const currentHex = coordinateToH3(nextLat, nextLng);
    setCurrentHexId(currentHex);
    setBatteryState(BatteryShieldState.LEVEL_3_ACTIVE_ROUTE);
    setSpeedKmh(speedConfig.speedKmh);
  }, [refreshMapLayers, selectedTransportMode]);

  const cycleTransportMode = useCallback(() => {
    const modes: TransportType[] = ['walk', 'run', 'bike', 'car', 'flight'];
    setSelectedTransportMode((prev) => {
      const idx = modes.indexOf(prev);
      const nextMode = modes[(idx + 1) % modes.length];
      const speeds = {
        still: 0,
        walk: 4.8,
        run: 11.5,
        bike: 22.0,
        car: 55.0,
        flight: 350.0,
      };
      setSpeedKmh(speeds[nextMode]);
      return nextMode;
    });
  }, []);

  const recenter = useCallback(() => {
    setCoordinates([...lastCoordsRef.current]);
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  const refreshAllHexagonsFromStorage = useCallback(() => {
    const persistedHexes = storageService.loadUnlockedHexagonsSync();
    h3Engine.importHexagons(persistedHexes);
    refreshMapLayers();
  }, [refreshMapLayers]);

  const dismissTerritoryAlert = useCallback(() => {
    setTerritoryAlert(null);
  }, []);

  const simulateKingAlert = useCallback(() => {
    realtimeTerritoryService.simulateKingUsurpation();
  }, []);

  const sectorName = currentHexId ? `Sector Urbano ${currentHexId.slice(-4).toUpperCase()}` : 'Buscando satélites...';
  const transportState = classifyTransportSpeed(speedKmh);

  // Métricas Territoriales y de Salud (Calorías, % CDMX, % Cuauhtémoc, Distancia Diaria)
  const regionalStats = useMemo(() => {
    return calculateRegionalMetrics(stats.totalAreaM2, routeDistanceMeters, routeElapsedSeconds);
  }, [stats.totalAreaM2, routeDistanceMeters, routeElapsedSeconds]);

  // Monumentos y Puntos de Interés Regionales
  const landmarks = useMemo(() => {
    const unlockedHexes = h3Engine.getUnlockedHexagons();
    return evaluateLandmarksDiscovery(unlockedHexes, coordinates[1], coordinates[0]);
  }, [coordinates, stats.totalHexagons]);

  // Logros e Insignias del Explorador
  const badges = useMemo(() => {
    const discoveredLandmarksCount = landmarks.filter((l) => l.isDiscovered).length;
    return achievementsService.getAchievements(
      stats,
      (stats as any).flightKm || 0,
      1,
      discoveredLandmarksCount,
      streak.currentStreak,
      regionalStats.caloriesBurned
    );
  }, [stats, streak.currentStreak, landmarks, regionalStats.caloriesBurned]);

  return {
    coordinates,
    currentHexId,
    sectorName,
    batteryState,
    speedKmh,
    stats,
    streak,
    transportState,
    fogGeoJSON,
    invertedFogGeoJSON,
    glowBorderGeoJSON,
    routePathGeoJSON,
    kingTitle,
    territoryAlert,
    watchdogWarning,
    isReady,
    isRecordingRoute,
    routeElapsedSeconds,
    routeDistanceMeters,
    startRoute,
    stopRoute,
    inspectRouteOnMap,
    clearInspectedRoute,
    recenterTrigger,
    regionalStats,
    partners,
    isPartnerRadarActive,
    togglePartnerRadar,
    landmarks,
    fogVisualMode,
    setFogVisualMode,
    badges,
    pulseExplore,
    simulateWalk,
    cycleTransportMode,
    recenter,
    refreshAllHexagonsFromStorage,
    dismissTerritoryAlert,
    simulateKingAlert,
  };
}
