import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { MapTheme, FogVisualMode, FOG_STYLE_PRESETS } from '@/core/theme/mapThemes';
import { TransportState } from '@/services/transportClassifier';
import { RegionalExplorationStats } from '@/services/regionalMetrics';
import { TimelineCartelBanner } from './TimelineCartelBanner';
import { colors, fontSize, size, space } from '@/theme/tokens';

export interface MapHUDProps {
  theme: MapTheme;
  totalAreaKm2: number;
  formattedArea?: string;
  unlockedCount: number;
  streakDays?: number;
  isTodayActive?: boolean;
  transportState?: TransportState;
  regionalStats?: RegionalExplorationStats;
  fogVisualMode?: FogVisualMode;
  isPartnerRadarActive?: boolean;
  onRecenter: () => void;
  onOpenCouple?: () => void;
  isCoupleLinked?: boolean;
  /** Herramientas secretas (Limpiar Mapa / Teletransporte): pulsación larga sobre la marca. */
  onOpenDevTools?: () => void;
  onOpenProfile?: () => void;
  onToggleThemeMode?: () => void;
  onOpenThemeSelector?: () => void;
  onSimulateWalk?: () => void;
  onCycleTransport?: () => void;
  onCycleFogVisualMode?: () => void;
  onTogglePartnerRadar?: () => void;
  onOpenRoutes?: () => void;
  onOpenShare?: () => void;
  onOpenFriends?: () => void;
  onOpenTimelinePaywall?: () => void;
  currentHexId?: string | null;
  watchdogWarning?: string | null;
}

const MapHUDComponent: React.FC<MapHUDProps> = ({
  theme,
  totalAreaKm2,
  formattedArea,
  unlockedCount,
  streakDays = 1,
  isTodayActive = false,
  transportState,
  regionalStats,
  fogVisualMode = 'translucent',
  isPartnerRadarActive = true,
  onRecenter,
  onOpenCouple,
  isCoupleLinked = false,
  onOpenDevTools,
  onOpenProfile,
  onToggleThemeMode,
  onOpenThemeSelector,
  onSimulateWalk,
  onCycleTransport,
  onCycleFogVisualMode,
  onTogglePartnerRadar,
  onOpenRoutes,
  onOpenShare,
  onOpenFriends,
  onOpenTimelinePaywall,
  currentHexId,
  watchdogWarning,
}) => {
  const isLight = theme.mode === 'light';
  const [isWarningDismissed, setIsWarningDismissed] = useState<boolean>(false);

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      {/* 1. BARRA SUPERIOR MINIMALISTA */}
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.brandGroup}>
          <TouchableOpacity
            activeOpacity={1}
            delayLongPress={900}
            onLongPress={onOpenDevTools}
            style={[
              styles.brandCapsule,
              {
                backgroundColor: theme.hudBackground,
                borderColor: theme.borderColor,
              },
            ]}
          >
            <View style={[styles.brandDot, { backgroundColor: theme.accentColor }]} />
            <Text style={[styles.brandName, { color: theme.textColor }]}>TerraMaps</Text>
          </TouchableOpacity>

          {streakDays > 0 && (
            <View style={styles.streakCapsule} accessibilityLabel={`Racha de ${streakDays} días`}>
              <Text style={[styles.streakEmoji, !isTodayActive && { opacity: 0.5 }]}>🔥</Text>
              <Text
                style={[
                  styles.streakText,
                  { color: isTodayActive ? colors.ember : theme.textColor },
                ]}
              >
                {streakDays}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.topIconsGroup}>
          {/* 1. Skins Cosméticas del Mapa (Generador clave de ingresos y personalización) */}
          {onOpenThemeSelector && (
            <TouchableOpacity
              style={[
                styles.iconBtn,
                { backgroundColor: theme.hudBackground, borderColor: theme.borderColor },
              ]}
              onPress={onOpenThemeSelector}
              activeOpacity={0.8}
              accessibilityLabel="Skins cosméticas del mapa"
            >
              <Text style={[styles.iconBtnSymbol, { color: theme.textColor }]}>◫</Text>
            </TouchableOpacity>
          )}

          {/* 2. Velo de Niebla (Cambio rápido entre desconocido negro/opaco y translúcido) */}
          {onCycleFogVisualMode && (
            <TouchableOpacity
              style={[
                styles.iconBtn,
                { backgroundColor: theme.hudBackground, borderColor: theme.borderColor },
              ]}
              onPress={onCycleFogVisualMode}
              activeOpacity={0.8}
              accessibilityLabel="Modo visual de velo de niebla"
            >
              <Text style={[styles.iconBtnSymbol, { color: theme.accentColor }]}>
                {fogVisualMode ? FOG_STYLE_PRESETS[fogVisualMode]?.icon || '◈' : '◈'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Cartel Publicitario / Paywall Discreto si corresponde */}
      {onOpenTimelinePaywall && (
        <TimelineCartelBanner
          theme={theme}
          onOpenPaywall={() => onOpenTimelinePaywall()}
        />
      )}

      {/* Alerta del Watchdog GPS (Silenciado en web/escritorio para evitar molestias visuales) */}
      {watchdogWarning && !isWarningDismissed && Platform.OS !== 'web' && (
        <TouchableOpacity
          style={styles.watchdogAlertPill}
          onPress={() => setIsWarningDismissed(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.watchdogAlertText}>{watchdogWarning}</Text>
          <Text style={styles.watchdogDismissText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* 2. ZONA INTERMEDIA FLOTANTE: Píldora de Estadísticas y Botón FAB de Recentrado */}
      <View style={styles.midFloatingArea} pointerEvents="box-none">
        {regionalStats && (
          <TouchableOpacity
            style={[
              styles.activityPill,
              {
                backgroundColor: theme.hudBackground,
                borderColor: theme.borderColor,
                shadowColor: isLight ? '#94a3b8' : '#000000',
              },
            ]}
            onPress={onOpenShare}
            activeOpacity={0.85}
          >
            <Text style={[styles.activityValue, { color: theme.textColor }]}>
              {regionalStats.dailyDistanceKm.toFixed(2)} km
            </Text>
            <View
              style={[
                styles.pillDivider,
                { backgroundColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' },
              ]}
            />
            <Text style={[styles.activitySub, { color: theme.accentColor }]}>
              {regionalStats.estimatedSteps.toLocaleString()} pasos
            </Text>
            <View
              style={[
                styles.pillDivider,
                { backgroundColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' },
              ]}
            />
            <Text style={[styles.activitySub, { color: colors.ember, fontWeight: '800' }]}>
              {regionalStats.caloriesBurned} kcal
            </Text>
          </TouchableOpacity>
        )}

        {/* Botón flotante para recentrar el mapa en ti */}
        <TouchableOpacity
          style={[
            styles.floatingRecenterFab,
            {
              backgroundColor: theme.hudBackground,
              borderColor: theme.borderColor,
              shadowColor: isLight ? '#94a3b8' : '#000000',
            },
          ]}
          onPress={onRecenter}
          activeOpacity={0.8}
          accessibilityLabel="Recentrar en mi ubicación"
        >
          <Text style={[styles.floatingRecenterSymbol, { color: theme.textColor }]}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* 3. BARRA DE NAVEGACIÓN INFERIOR ESTILO INSTAGRAM / FACEBOOK */}
      <View
        style={[
          styles.bottomTabBar,
          {
            backgroundColor: theme.hudBackground,
            borderTopColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
          },
        ]}
      >
        {/* Tab 1: Vínculo de Pareja (consentimiento mutuo) */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={onOpenCouple}
          activeOpacity={0.7}
          accessibilityLabel="Vínculo de pareja"
        >
          <Text style={[styles.tabIcon, { color: isCoupleLinked ? theme.accentColor : theme.subtextColor }]}>∞</Text>
          <Text style={[styles.tabLabel, { color: isCoupleLinked ? theme.accentColor : theme.subtextColor }]}>
            Pareja
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Amigos & Contactos */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={onOpenFriends}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconWrapper}>
            <Text style={[styles.tabIcon, { color: theme.subtextColor }]}>☵</Text>
            {isPartnerRadarActive && <View style={styles.tabNotificationDot} />}
          </View>
          <Text style={[styles.tabLabel, { color: theme.subtextColor }]}>
            Amigos
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Botón Central Cinético (Paso GPS / Modo) */}
        {onSimulateWalk && (
          <TouchableOpacity
            style={[
              styles.centerTabBtn,
              {
                backgroundColor: theme.accentColor,
                shadowColor: theme.accentColor,
              },
            ]}
            onPress={() => onSimulateWalk()}
            activeOpacity={0.85}
            accessibilityLabel="Registrar paso cinético"
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: isLight ? '#ffffff' : '#0b0f19' }}>
              {transportState?.type === 'car'
                ? 'AUTO'
                : transportState?.type === 'bike'
                ? 'BICI'
                : transportState?.type === 'flight'
                ? 'VUELO'
                : transportState?.type === 'run'
                ? 'CORRER'
                : 'PASO'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Tab 4: Rutas & Historial */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={onOpenRoutes}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, { color: theme.subtextColor }]}>∿</Text>
          <Text style={[styles.tabLabel, { color: theme.subtextColor }]}>
            Rutas
          </Text>
        </TouchableOpacity>

        {/* Tab 5: Perfil & Cuenta */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={onOpenProfile}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, { color: theme.subtextColor }]}>◯</Text>
          <Text style={[styles.tabLabel, { color: theme.subtextColor }]}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 10,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: size.hudIcon,
    borderRadius: size.hudIcon / 2,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  streakCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  streakEmoji: {
    fontSize: fontSize.body,
  },
  streakText: {
    fontSize: fontSize.body,
    fontWeight: '800',
  },
  topIconsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: size.hudIcon,
    height: size.hudIcon,
    borderRadius: size.hudIcon / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconBtnSymbol: {
    width: size.hudIcon,
    fontSize: size.hudGlyph,
    lineHeight: size.hudIcon - 2, // centra el glifo (borde de 1px)
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  watchdogAlertPill: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.18)',
    borderColor: '#eab308',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  watchdogAlertText: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: '700',
  },
  watchdogDismissText: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 4,
  },
  midFloatingArea: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  activityEmoji: {
    fontSize: 13,
  },
  activityValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  activitySub: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillDivider: {
    width: 1,
    height: 14,
  },
  floatingRecenterFab: {
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingRecenterSymbol: {
    width: size.fab,
    fontSize: size.fabIcon,
    lineHeight: size.fab - 2, // compensa el borde de 1px para centrar el glifo
    fontWeight: '400',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  bottomTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 68,
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIconWrapper: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 18,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabNotificationDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  centerTabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  centerTabEmoji: {
    fontSize: 22,
  },
});

export const MapHUD = React.memo(MapHUDComponent);
