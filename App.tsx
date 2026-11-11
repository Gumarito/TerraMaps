import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, useColorScheme, PanResponder } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { TerraMap } from './src/components/map/TerraMap';
import { MapHUD } from './src/components/ui/MapHUD';
import { MobileDeviceSimulator } from './src/components/ui/MobileDeviceSimulator';
import {
  ProfileModal,
  RoutesHistoryModal,
  SocialShareModal,
  FriendsModal,
  RewardedAdModal,
  ThemeSelectorModal,
  CoupleLinkModal,
  DevToolsModal,
  OnboardingModal,
} from './src/components/modals';
import { PartnerOffscreenRadar, type RadarViewport } from './src/components/ui/PartnerOffscreenRadar';
import { coupleLinkService, type CoupleLinkState } from './src/services/coupleLinkService';
import { haversineDistanceMeters } from './src/core/battery/batteryShield';
import { ONBOARDING_STORAGE_KEY } from './src/components/modals/OnboardingModal';
import { storageService } from './src/services/storage';
import { TimelinePaywallModal } from './src/components/modals/TimelinePaywallModal';
import { ProPaywallModal } from './src/components/modals/ProPaywallModal';
import { BillingNotice, type BillingNoticeTone } from './src/components/ui/BillingNotice';
import { useTerraTracker } from './src/hooks/useTerraTracker';
import { useEntitlements } from './src/hooks/useEntitlements';
import {
  MAP_THEMES,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  FogVisualMode,
} from './src/core/theme/mapThemes';
import { authService } from './src/services/authService';
import { googleTimelineService } from './src/services/googleTimelineService';
import {
  billingService,
  entitlementService,
  nextAccessibleFogMode,
  resolveAccessibleFogMode,
  resolveAccessibleThemeId,
  type PremiumFeature,
} from './src/services/billing';

const FOG_MODE_CYCLE: readonly FogVisualMode[] = ['translucent', 'realistic_mist', 'blur', 'clear', 'dark'];

export default function App() {
  const systemColorScheme = useColorScheme();
  const initialThemeId = systemColorScheme === 'light' ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID;
  const entitlements = useEntitlements();

  const [currentThemeId, setCurrentThemeId] = useState<string>(initialThemeId);
  // Si el tema elegido deja de estar permitido (p. ej. PRO expiró) se usa el tema por defecto.
  const activeThemeId = resolveAccessibleThemeId(currentThemeId, initialThemeId);
  const activeTheme = MAP_THEMES[activeThemeId] || MAP_THEMES[DEFAULT_DARK_THEME_ID];
  const [currentUsername, setCurrentUsername] = useState<string>('Explorador');
  const [proPaywall, setProPaywall] = useState<{ visible: boolean; feature: PremiumFeature | null }>({
    visible: false,
    feature: null,
  });
  const [billingNotice, setBillingNotice] = useState<{ tone: BillingNoticeTone; message: string } | null>(null);
  const openProPaywall = useCallback((feature: PremiumFeature | null = null) => {
    setProPaywall({ visible: true, feature });
  }, []);

  // Modales esenciales
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [routesModalVisible, setRoutesModalVisible] = useState<boolean>(false);
  const [shareModalVisible, setShareModalVisible] = useState<boolean>(false);
  const [friendsModalVisible, setFriendsModalVisible] = useState<boolean>(false);
  const [timelinePaywallVisible, setTimelinePaywallVisible] = useState<boolean>(false);
  const [themeSelectorVisible, setThemeSelectorVisible] = useState<boolean>(false);
  const [coupleModalVisible, setCoupleModalVisible] = useState<boolean>(false);
  const [devToolsVisible, setDevToolsVisible] = useState<boolean>(false);
  const [viewport, setViewport] = useState<RadarViewport | null>(null);
  const [coupleState, setCoupleState] = useState<CoupleLinkState>(() => coupleLinkService.getState());
  useEffect(() => coupleLinkService.subscribe(setCoupleState), []);
  const [onboardingVisible, setOnboardingVisible] = useState<boolean>(() => {
    try {
      return storageService.getItem(ONBOARDING_STORAGE_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const {
    coordinates,
    currentHexId,
    stats,
    streak,
    transportState,
    fogGeoJSON,
    invertedFogGeoJSON,
    glowBorderGeoJSON,
    routePathGeoJSON,
    simulateWalk,
    cycleTransportMode,
    inspectRouteOnMap,
    recenter,
    recenterTrigger,
    teleportTo,
    clearExploredMap,
    regionalStats,
    partners,
    isPartnerRadarActive,
    togglePartnerRadar,
    landmarks,
    fogVisualMode,
    setFogVisualMode,
    badges,
    refreshAllHexagonsFromStorage,
    watchdogWarning,
  } = useTerraTracker(activeTheme);

  // Pareja vinculada (solo con consentimiento mutuo confirmado) y su distancia al jugador.
  const linkedPartner =
    coupleState.status === 'linked' ? partners.find((p) => p.id === coupleState.partnerId) ?? null : null;
  let partnerDistanceText: string | null = null;
  if (linkedPartner) {
    const meters = haversineDistanceMeters(
      { latitude: coordinates[1], longitude: coordinates[0] },
      { latitude: linkedPartner.coordinates[1], longitude: linkedPartner.coordinates[0] }
    );
    partnerDistanceText = meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  }

  // Modos de niebla prémium solo se renderizan con Terra PRO.
  const effectiveFogMode = resolveAccessibleFogMode(fogVisualMode);

  const handleCycleFogVisualMode = () => {
    setFogVisualMode(nextAccessibleFogMode(effectiveFogMode, FOG_MODE_CYCLE));
  };

  // Retorno desde Stripe Checkout: esperar confirmación del webhook antes de anunciar el éxito.
  useEffect(() => {
    const checkoutReturn = billingService.consumeCheckoutReturn();
    if (!checkoutReturn) return;

    if (checkoutReturn.status === 'cancel') {
      setBillingNotice({ tone: 'warning', message: 'Pago cancelado. No se realizó ningún cargo.' });
      return;
    }

    const isTimeline = checkoutReturn.plan === 'timeline_lifetime';
    setBillingNotice({ tone: 'pending', message: 'Confirmando tu pago con Stripe…' });
    entitlementService
      .waitFor((snap) => (isTimeline ? snap.timelineRestore : snap.isPro))
      .then((confirmed) => {
        setBillingNotice(
          confirmed
            ? {
                tone: 'success',
                message: isTimeline ? '¡Compra confirmada! Restaurando tu historial…' : '¡Bienvenido a Terra PRO! Todas las capas prémium están activas.',
              }
            : {
                tone: 'warning',
                message: 'Tu pago se está procesando. El acceso se activará en cuanto Stripe lo confirme.',
              }
        );
      });
  }, []);

  // Paquete Viajero del Tiempo: restaurar automáticamente cuando el servidor confirma la compra.
  useEffect(() => {
    if (!entitlements.timelineRestore) return;
    const stats = googleTimelineService.getDetectedStats();
    if (stats.isRestored || stats.dataSource !== 'takeout') return;
    const result = googleTimelineService.restoreHistoryToMap();
    if (result.success) {
      refreshAllHexagonsFromStorage();
      setBillingNotice({ tone: 'success', message: result.message });
    }
  }, [entitlements.timelineRestore, refreshAllHexagonsFromStorage]);

  // Gesto táctil estilo Instagram: Deslizar a la izquierda abre Amigos, a la derecha lo cierra
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Detectar si es un swipe horizontal deliberado (mayor a 25px y poco movimiento vertical)
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 45;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Swipe hacia la izquierda: abrir pantalla de amigos
          setFriendsModalVisible(true);
        } else if (gestureState.dx > 50) {
          // Swipe hacia la derecha: cerrar amigos
          setFriendsModalVisible(false);
        }
      },
    })
  ).current;

  // Sincronizar automáticamente con el tema del celular
  useEffect(() => {
    if (systemColorScheme === 'light') {
      setCurrentThemeId(DEFAULT_LIGHT_THEME_ID);
    } else {
      setCurrentThemeId(DEFAULT_DARK_THEME_ID);
    }
  }, [systemColorScheme]);

  useEffect(() => {
    return authService.onAuthStateChange((profile) => {
      if (profile?.username) {
        setCurrentUsername(profile.username);
      }
    });
  }, []);

  const handleToggleThemeMode = () => {
    if (activeTheme.mode === 'light') {
      setCurrentThemeId(DEFAULT_DARK_THEME_ID);
    } else {
      setCurrentThemeId(DEFAULT_LIGHT_THEME_ID);
    }
  };

  const handleMapTabPress = useCallback(() => {
    setRoutesModalVisible(false);
    setFriendsModalVisible(false);
    setProfileModalVisible(false);
    setShareModalVisible(false);
    setTimelinePaywallVisible(false);
    setThemeSelectorVisible(false);
    setCoupleModalVisible(false);
    setProPaywall({ visible: false, feature: null });
  }, []);

  return (
    <MobileDeviceSimulator
      accentColor={activeTheme.accentColor}
      isLightMode={activeTheme.mode === 'light'}
    >
      <View
        style={[styles.root, { backgroundColor: activeTheme.fogColor }]}
        {...panResponder.panHandlers}
      >
        <StatusBar style={activeTheme.mode === 'light' ? 'dark' : 'light'} translucent />

        {/* Mapa Base MapLibre GL con Niebla Orgánica, Marcadores de Amigos y Monumentos */}
        <TerraMap
          userCoordinates={coordinates}
          fogGeoJSON={fogGeoJSON}
          invertedFogGeoJSON={invertedFogGeoJSON}
          glowBorderGeoJSON={glowBorderGeoJSON}
          routePathGeoJSON={routePathGeoJSON}
          mapStyleURL={activeTheme.mapStyleURL}
          glowColor={activeTheme.glowColor}
          fogColor={activeTheme.fogColor}
          fogOpacity={activeTheme.fogOpacity}
          accentColor={activeTheme.accentColor}
          recenterTrigger={recenterTrigger}
          partners={partners}
          landmarks={landmarks}
          fogVisualMode={effectiveFogMode}
          onViewportChange={setViewport}
        />

        {/* Radar fuera de pantalla: flecha hacia la pareja cuando queda fuera del viewport */}
        {linkedPartner && partnerDistanceText && (
          <PartnerOffscreenRadar
            theme={activeTheme}
            viewport={viewport}
            partnerName={linkedPartner.name}
            partnerCoordinates={linkedPartner.coordinates}
            distanceText={partnerDistanceText}
            onPress={() => setCoupleModalVisible(true)}
            insetTop={96}
            insetBottom={170}
          />
        )}

        {/* Head-Up Display (HUD) con Métricas Regionales, Calorías y Modos */}
        <MapHUD
          theme={activeTheme}
          totalAreaKm2={stats.totalAreaKm2}
          formattedArea={stats.formattedArea}
          unlockedCount={stats.totalHexagons}
          streakDays={streak.currentStreak}
          isTodayActive={streak.isTodayActive}
          transportState={transportState}
          regionalStats={regionalStats}
          fogVisualMode={effectiveFogMode}
          isPartnerRadarActive={isPartnerRadarActive}
          onRecenter={recenter}
          onOpenCouple={() => setCoupleModalVisible(true)}
          isCoupleLinked={coupleState.status === 'linked'}
          onOpenProfile={() => setProfileModalVisible(true)}
          onToggleThemeMode={handleToggleThemeMode}
          onOpenThemeSelector={() => setThemeSelectorVisible(true)}
          onSimulateWalk={() => simulateWalk()}
          onCycleTransport={cycleTransportMode}
          onCycleFogVisualMode={handleCycleFogVisualMode}
          onTogglePartnerRadar={togglePartnerRadar}
          onOpenRoutes={() => setRoutesModalVisible(true)}
          onOpenShare={() => setShareModalVisible(true)}
          onOpenFriends={() => setFriendsModalVisible(true)}
          onOpenTimelinePaywall={() => setTimelinePaywallVisible(true)}
          currentHexId={currentHexId}
          watchdogWarning={watchdogWarning}
        />

        {/* Modal de Perfil & Logros (Renderizado bajo demanda para máxima fluidez) */}
        {profileModalVisible && (
          <ProfileModal
            visible={profileModalVisible}
            onClose={() => setProfileModalVisible(false)}
            accentColor={activeTheme.accentColor}
            username={currentUsername}
            userStats={stats}
            theme={activeTheme}
            badges={badges}
            regionalStats={regionalStats}
            onOpenThemes={() => setThemeSelectorVisible(true)}
            onToggleThemeMode={handleToggleThemeMode}
            onTogglePartnerRadar={togglePartnerRadar}
            isPartnerRadarActive={isPartnerRadarActive}
            onOpenProPaywall={() => openProPaywall()}
            onOpenDevTools={() => {
              setProfileModalVisible(false);
              setDevToolsVisible(true);
            }}
          />
        )}

        {/* Modal de Desglose de Rutas & Filtros de Tiempo */}
        {routesModalVisible && (
          <RoutesHistoryModal
            visible={routesModalVisible}
            onClose={() => setRoutesModalVisible(false)}
            theme={activeTheme}
            onSelectRouteOnMap={inspectRouteOnMap}
          />
        )}

        {/* Modal de Desplazamiento Estilo Instagram: Amigos & Comparativa de Lugares */}
        {friendsModalVisible && (
          <FriendsModal
            visible={friendsModalVisible}
            onClose={() => setFriendsModalVisible(false)}
            accentColor={activeTheme.accentColor}
            userKm2={stats.totalAreaKm2}
            theme={activeTheme}
          />
        )}

        {/* Modal de Compartir en Redes Sociales */}
        {shareModalVisible && (
          <SocialShareModal
            visible={shareModalVisible}
            onClose={() => setShareModalVisible(false)}
            accentColor={activeTheme.accentColor}
            username={currentUsername}
            stats={stats}
            currentHexId={currentHexId}
            streakDays={streak.currentStreak}
          />
        )}

        {/* Modal Paywall Máquina del Tiempo / Google Maps Timeline */}
        {timelinePaywallVisible && (
          <TimelinePaywallModal
            visible={timelinePaywallVisible}
            onClose={() => setTimelinePaywallVisible(false)}
            theme={activeTheme}
            onSuccessRestore={() => refreshAllHexagonsFromStorage()}
          />
        )}

        {/* Vínculo de Pareja (PIN + consentimiento mutuo, estado y batería) */}
        {coupleModalVisible && (
          <CoupleLinkModal
            visible={coupleModalVisible}
            onClose={() => setCoupleModalVisible(false)}
            theme={activeTheme}
            partner={linkedPartner}
            distanceText={partnerDistanceText}
          />
        )}

        {/* Herramientas del explorador: Limpiar Mapa / Teletransporte (acceso desde el pie del Perfil) */}
        {devToolsVisible && (
          <DevToolsModal
            visible={devToolsVisible}
            onClose={() => setDevToolsVisible(false)}
            theme={activeTheme}
            onClearMap={clearExploredMap}
            onTeleport={teleportTo}
          />
        )}

        {/* Modal de Selección de Temas y Skins de Videojuegos */}
        {themeSelectorVisible && (
          <ThemeSelectorModal
            visible={themeSelectorVisible}
            theme={activeTheme}
            currentThemeId={activeThemeId}
            onSelectTheme={(themeId) => setCurrentThemeId(themeId)}
            onClose={() => setThemeSelectorVisible(false)}
            onRequestUpgrade={() => openProPaywall('premium_skins')}
          />
        )}

        {/* Paywall de suscripción Terra PRO (Stripe Checkout / Customer Portal) */}
        {proPaywall.visible && (
          <ProPaywallModal
            visible={proPaywall.visible}
            onClose={() => setProPaywall({ visible: false, feature: null })}
            theme={activeTheme}
            highlightFeature={proPaywall.feature}
          />
        )}

        {billingNotice && (
          <BillingNotice
            tone={billingNotice.tone}
            message={billingNotice.message}
            onDismiss={() => setBillingNotice(null)}
          />
        )}

        {/* Motor Global de Anuncios Recompensados */}
        <RewardedAdModal accentColor={activeTheme.accentColor} />

        {/* Onboarding de Bienvenida con Bono de Ciudad Natal */}
        {onboardingVisible && (
          <OnboardingModal
            visible={onboardingVisible}
            onFinish={() => setOnboardingVisible(false)}
            theme={activeTheme}
            onBonusUnlocked={() => refreshAllHexagonsFromStorage()}
          />
        )}
      </View>
    </MobileDeviceSimulator>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
});
