# 🕸️ Graphify — Mapa Estructural Determinista del Código

> Generado automáticamente en 0 tokens. Úsalo para conocer todas las conexiones, símbolos exportados y dependencias sin escanear archivos completos.

| Archivo | Líneas | Símbolos Exportados | Dependencias Clave |
| :--- | :---: | :--- | :--- |
| `App.tsx` | 213 | `default` | `./src/components/map/TerraMap, ./src/components/ui/MapHUD, ./src/components/ui/MobileDeviceSimulator, ./src/components/modals, ./src/components/modals/TimelinePaywallModal, ./src/hooks/useTerraTracker, ./src/core/theme/mapThemes, ./src/services/authService` |
| `src/components/map/TerraMap.native.tsx` | 146 | `DEFAULT_DARK_MAP_STYLE, TerraMapProps, TerraMap` | `ninguna interna` |
| `src/components/map/TerraMap.tsx` | 7 | `TerraMap` | `./TerraMap.web, ./TerraMap.native` |
| `src/components/map/TerraMap.web.tsx` | 364 | `DEFAULT_DARK_MAP_STYLE, TerraMapProps, TerraMap` | `ninguna interna` |
| `src/components/modals/DroneModal.tsx` | 883 | `DroneModalProps, DroneModal` | `@/services/monetizationService, @/services/adService` |
| `src/components/modals/FriendsModal.tsx` | 652 | `FriendEntry, FriendsModal` | `@/core/theme/mapThemes, @/core/security` |
| `src/components/modals/index.ts` | 9 | `default` | `./LeaderboardModal, ./ThemeSelectorModal, ./DroneModal, ./ProfileModal, ./RoutesHistoryModal, ./SocialShareModal, ./FriendsModal, ./RewardedAdModal` |
| `src/components/modals/LeaderboardModal.tsx` | 199 | `LeaderboardModal` | `@/services/syncService` |
| `src/components/modals/ProfileModal.tsx` | 908 | `ProfileModalProps, ProfileModal` | `@/services/storage, @/utils/audioFeedback, @/core/theme/mapThemes` |
| `src/components/modals/RewardedAdModal.tsx` | 229 | `RewardedAdModal` | `../../services/adService, ../../utils/audioFeedback` |
| `src/components/modals/RoutesHistoryModal.tsx` | 594 | `TimeFilter, RoutesHistoryModal` | `../../services/routeTrackerService, ../../core/theme/mapThemes, ../ui/SponsorBanner` |
| `src/components/modals/SocialShareModal.tsx` | 345 | `SocialShareModal` | `@/services/storage` |
| `src/components/modals/ThemeSelectorModal.tsx` | 246 | `ThemeSelectorModal` | `@/core/theme/mapThemes, @/services/monetizationService, @/services/storage, @/services/adService` |
| `src/components/modals/TimelinePaywallModal.tsx` | 510 | `TimelinePaywallModal` | `@/core/theme/mapThemes, @/services/googleTimelineService, @/services/monetizationService` |
| `src/components/ui/MapHUD.tsx` | 565 | `MapHUD` | `@/core/theme/mapThemes, @/services/transportClassifier, ./TimelineCartelBanner` |
| `src/components/ui/MobileDeviceSimulator.tsx` | 266 | `MobileDeviceSimulator` | `ninguna interna` |
| `src/components/ui/SponsorBanner.tsx` | 69 | `SponsorBanner` | `ninguna interna` |
| `src/components/ui/TimelineCartelBanner.tsx` | 141 | `TimelineCartelBanner` | `@/core/theme/mapThemes, @/services/googleTimelineService` |
| `src/core/battery/batteryShield.ts` | 461 | `haversineDistanceMeters, speedMpsToKmh, calculateSpeedKmH, BatteryShield` | `../geo/h3Engine, ../geo/types, ./types` |
| `src/core/battery/expoProviders.ts` | 131 | `ExpoStepSensorProvider, ExpoLocationProvider` | `../geo/types, ./types` |
| `src/core/battery/index.ts` | 9 | `default` | `./types, ./batteryShield, ./mockProviders, ./expoProviders` |
| `src/core/battery/mockProviders.ts` | 109 | `MockStepSensorProvider, MockLocationProvider` | `../geo/types, ./types` |
| `src/core/battery/types.ts` | 189 | `BatteryShieldState, BatteryShieldConfig, DEFAULT_BATTERY_SHIELD_CONFIG, StepUpdateCallback, IStepSensorProvider, LocationUpdateCallback` | `../geo/types` |
| `src/core/geo/fogGeoJSON.ts` | 379 | `DEFAULT_FOG_OPTIONS, calculateSignedArea, enforceWindingOrder, isHexagonInBounds, generateInvertedFogGeoJSON, generateGlowBorderGeoJSON` | `./h3Engine, ./types` |
| `src/core/geo/gpsAccuracyFilter.ts` | 139 | `RawGpsPoint, GpsFilterResult, GpsFilterConfig, DEFAULT_GPS_FILTER_CONFIG, GpsAccuracyFilter, gpsAccuracyFilter` | `../battery/batteryShield, ../security` |
| `src/core/geo/h3Engine.ts` | 476 | `isValidHexagonId, coordinateToH3, geoCoordinateToH3, h3ToCenterCoordinate, h3ToBoundary, getVisionRadiusHexagons` | `./types` |
| `src/core/geo/index.ts` | 9 | `default` | `./types, ./h3Engine, ./fogGeoJSON, ./gpsAccuracyFilter` |
| `src/core/geo/streetWaypoints.ts` | 100 | `StreetWaypoint, STREET_WAYPOINTS, StreetWalkingRouter, streetWalkingRouter` | `ninguna interna` |
| `src/core/geo/types.ts` | 241 | `GeoCoordinates, LatLngTuple, LngLatTuple, BoundingBoxTuple, BoundingBox, H3Index` | `ninguna interna` |
| `src/core/index.ts` | 11 | `default` | `./geo, ./battery, ./security` |
| `src/core/security/index.ts` | 2 | `default` | `./securityEngine` |
| `src/core/security/securityEngine.ts` | 160 | `validateH3Index, sanitizeString, sanitizeUsername, validateSafeStorageKey, safeJsonParse, validateCoordinates` | `ninguna interna` |
| `src/core/tests/mathVerification.ts` | 539 | `VerificationResult` | `../geo/h3Engine, ../geo/types, ../geo/fogGeoJSON, ../battery/batteryShield, ../battery/types, ../battery/mockProviders, ../security` |
| `src/core/theme/mapThemes.ts` | 88 | `MapTheme, MAP_THEMES, DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, DEFAULT_THEME_ID` | `ninguna interna` |
| `src/hooks/useTerraTracker.ts` | 584 | `UseTerraTrackerReturn, useTerraTracker` | `@/services/storage, @/services/syncService, @/services/monetizationService, @/services/authService, @/services/realtimeTerritory, @/services/routeTrackerService, @/services/streakService, @/utils/audioFeedback, @/core/geo/streetWaypoints, @/services/transportClassifier, @/services/backgroundWatchdog, @/core, @/core/battery/types, @/core/theme/mapThemes` |
| `src/services/adService.ts` | 203 | `RewardType, AdRewardResult, AdRewardState, adService` | `./storage, ./streakService, ./monetizationService` |
| `src/services/authService.ts` | 483 | `UserProfile, AuthStateListener, authService` | `./supabase, ./storage, @/core/security` |
| `src/services/backgroundWatchdog.ts` | 115 | `WatchdogStatus, WatchdogListener, backgroundWatchdog` | `ninguna interna` |
| `src/services/googleTimelineService.ts` | 367 | `TIMELINE_STORAGE_KEYS, TimelineDetectedStats, googleTimelineService` | `@/core/geo/h3Engine, ./storage, @/core/security` |
| `src/services/index.ts` | 11 | `default` | `./storage, ./supabase, ./syncService, ./monetizationService, ./authService, ./realtimeTerritory` |
| `src/services/monetizationService.ts` | 526 | `DRONE_COOLDOWN_MS, STORAGE_KEYS, RADAR_PARAMS, TerraProStatus, SkinUnlockType, TacticalSkin` | `./storage, @/core/theme/mapThemes, ./googleTimelineService` |
| `src/services/realtimeTerritory.ts` | 388 | `KingChangeType, TerritoryKingData, KingChangeEvent, FriendHexagonEvent, TerritoryAlertCallback, FriendHexCallback` | `./supabase, ./authService, @/core/security` |
| `src/services/routeTrackerService.ts` | 315 | `RoutePoint, RecordedRoute, routeTrackerService` | `./storage, ../core/battery/batteryShield, @/core/security` |
| `src/services/storage.ts` | 282 | `UserStats, REALISTIC_STREET_AREA_M2, H3_RES_9_AREA_KM2, storageService` | `@/core/security` |
| `src/services/streakService.ts` | 155 | `StreakData, StreakListener, streakService` | `./storage` |
| `src/services/supabase.ts` | 29 | `isSupabaseConfigured, supabase` | `ninguna interna` |
| `src/services/syncService.ts` | 247 | `LeaderboardEntry, TerritoryKingInfo, syncService` | `./supabase, ./storage, @/core` |
| `src/services/transportClassifier.ts` | 100 | `TransportType, TransportState, classifyTransportSpeed` | `ninguna interna` |
| `src/utils/audioFeedback.ts` | 161 | `audioFeedback` | `ninguna interna` |
| `src/utils/security.ts` | 6 | `default` | `@/core/security` |
