import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { storageService, UserStats } from '@/services/storage';
import { audioFeedback } from '@/utils/audioFeedback';
import { MapTheme } from '@/core/theme/mapThemes';
import { authService } from '@/services/authService';
import type { TerraBadge } from '@/services/achievementsService';
import type { RegionalExplorationStats } from '@/services/regionalMetrics';
import { useEntitlements } from '@/hooks/useEntitlements';

const PRO_EXPLORATION_RADIUS_M = 85;

export interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
  username?: string;
  userStats?: UserStats;
  theme?: MapTheme;
  badges?: TerraBadge[];
  regionalStats?: RegionalExplorationStats;
  onOpenThemes?: () => void;
  onToggleThemeMode?: () => void;
  onTogglePartnerRadar?: () => void;
  isPartnerRadarActive?: boolean;
  /** Abre el paywall / gestión de Terra PRO. */
  onOpenProPaywall?: () => void;
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  requiredHexagons: number;
  icon: string;
  category: string;
}

const BADGES: BadgeDefinition[] = [
  {
    id: 'first_steps',
    title: 'Primeros Pasos',
    description: 'Primer contacto territorial. Niebla de guerra inicial dispersada.',
    requiredHexagons: 1,
    icon: '👣',
    category: 'INICIACIÓN',
  },
  {
    id: 'urban_walker',
    title: 'Caminante Urbano',
    description: 'Exploración de múltiples manzanas y corredores urbanos.',
    requiredHexagons: 50,
    icon: '🏙️',
    category: 'PATRULLA',
  },
  {
    id: 'district_conqueror',
    title: 'Conquistador de Barrio',
    description: 'Dominio táctico y consolidación de un distrito metropolitano completo.',
    requiredHexagons: 200,
    icon: '🛡️',
    category: 'VANGUARDIA',
  },
  {
    id: 'legendary_cartographer',
    title: 'Cartógrafo Legendario',
    description: 'Maestría geográfica absoluta. Registro cartográfico de élite.',
    requiredHexagons: 1000,
    icon: '👑',
    category: 'ÉLITE',
  },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  accentColor = '#00f5d4',
  username = 'Explorador',
  userStats,
  theme,
  badges,
  regionalStats,
  onOpenThemes,
  onToggleThemeMode,
  onTogglePartnerRadar,
  isPartnerRadarActive = true,
  onOpenProPaywall,
}) => {
  const isLight = theme?.mode === 'light';
  const entitlements = useEntitlements();
  const effectiveAccent = isLight ? (theme?.accentColor || '#2563eb') : accentColor;

  // Estadísticas del explorador
  const currentStats: UserStats = userStats || storageService.getStats();
  const [isMuted, setIsMuted] = useState<boolean>(audioFeedback.getIsMuted());
  const [explorationRadius, setExplorationRadius] = useState<number>(() => {
    try {
      const saved = storageService.getItem('@terramaps_exploration_radius');
      return saved ? parseInt(saved, 10) : 45; // Valor medio equilibrado por defecto
    } catch {
      return 45;
    }
  });
  const [userWeightKg, setUserWeightKg] = useState<string>(() => {
    try {
      return storageService.getItem('@terramaps_user_weight') || '70';
    } catch {
      return '70';
    }
  });
  const [userHeightCm, setUserHeightCm] = useState<string>(() => {
    try {
      return storageService.getItem('@terramaps_user_height') || '175';
    } catch {
      return '175';
    }
  });
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState<boolean>(false);

  const handleSelectRadius = (radius: number) => {
    if (radius >= PRO_EXPLORATION_RADIUS_M && !entitlements.isPro) {
      onOpenProPaywall?.();
      return;
    }
    setExplorationRadius(radius);
    try {
      storageService.setItem('@terramaps_exploration_radius', radius.toString());
    } catch {
      // No-op
    }
  };

  const handleSaveWeight = (val: string) => {
    setUserWeightKg(val);
    try {
      storageService.setItem('@terramaps_user_weight', val);
    } catch {
      // No-op
    }
  };

  const handleSaveHeight = (val: string) => {
    setUserHeightCm(val);
    try {
      storageService.setItem('@terramaps_user_height', val);
    } catch {
      // No-op
    }
  };

  const handleDeleteAccount = async () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      await authService.signOut();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      setIsDeleteModalVisible(false);
    }
  };

  const handleToggleMute = () => {
    const nextState = !isMuted;
    audioFeedback.setMuted(nextState);
    setIsMuted(nextState);
    if (!nextState) {
      audioFeedback.playDiscoverySound();
    }
  };

  const totalHex = currentStats.totalHexagons;
  const totalArea = currentStats.totalAreaKm2;
  const streakDays = currentStats.currentStreakDays || 1;
  const level = currentStats.explorationLevel || Math.max(1, Math.floor(Math.sqrt(totalHex / 5)));

  // Cálculo de progreso hacia el siguiente nivel
  const currentLevelMinHex = Math.pow(level, 2) * 5;
  const nextLevelMinHex = Math.pow(level + 1, 2) * 5;
  const progressInLevel = Math.max(0, totalHex - currentLevelMinHex);
  const neededForNextLevel = Math.max(1, nextLevelMinHex - currentLevelMinHex);
  const levelProgressPercent = Math.min(100, Math.round((progressInLevel / neededForNextLevel) * 100));

  const getTacticalRankTitle = (lvl: number): string => {
    if (lvl >= 10) return 'Trotamundos Legendario';
    if (lvl >= 7) return 'Maestro Cartógrafo';
    if (lvl >= 5) return 'Guía Territorial';
    if (lvl >= 3) return 'Pionero Urbano';
    if (lvl >= 2) return 'Caminante Activo';
    return 'Explorador Novato';
  };

  const unlockedBadgesCount = BADGES.filter((b) => totalHex >= b.requiredHexagons).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isLight ? '#ffffff' : '#0b0f19',
              borderColor: isLight ? '#e2e8f0' : `${effectiveAccent}40`,
            },
          ]}
        >
          {/* Header del Perfil */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)' },
            ]}
          >
            <View>
              <Text style={[styles.title, { color: effectiveAccent }]}>CUENTA & PERFIL</Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: isLight ? '#64748b' : '#94a3b8' },
                ]}
              >
                Estadísticas y logros de exploración
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)' },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.closeBtnText,
                  { color: isLight ? '#0f172a' : '#ffffff' },
                ]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Tarjeta de Identidad */}
            <View
              style={[
                styles.operatorCard,
                {
                  backgroundColor: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.75)',
                  borderColor: isLight ? '#e2e8f0' : `${effectiveAccent}30`,
                },
              ]}
            >
              <View style={styles.avatarContainer}>
                <View
                  style={[
                    styles.avatarFrame,
                    {
                      borderColor: effectiveAccent,
                      backgroundColor: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.5)',
                    },
                  ]}
                >
                  <Text style={styles.avatarGlyph}>⚡</Text>
                </View>
                <View style={[styles.levelTagBadge, { backgroundColor: effectiveAccent }]}>
                  <Text style={[styles.levelTagText, { color: isLight ? '#ffffff' : '#000000' }]}>
                    NV.{level}
                  </Text>
                </View>
              </View>

              <View style={styles.operatorDetails}>
                <Text
                  style={[
                    styles.callsignText,
                    { color: isLight ? '#0f172a' : '#ffffff' },
                  ]}
                >
                  {username}
                </Text>
                <Text
                  style={[
                    styles.rankTitleText,
                    { color: isLight ? '#d97706' : '#ffb703' },
                  ]}
                >
                  {getTacticalRankTitle(level)}
                </Text>

                {/* Barra de progreso de nivel */}
                <View style={styles.levelProgressWrapper}>
                  <View style={styles.levelProgressHeader}>
                    <Text
                      style={[
                        styles.levelProgressLabel,
                        { color: isLight ? '#64748b' : '#94a3b8' },
                      ]}
                    >
                      PROGRESO AL NIVEL {level + 1}
                    </Text>
                    <Text
                      style={[
                        styles.levelProgressVal,
                        { color: isLight ? '#0f172a' : '#ffffff' },
                      ]}
                    >
                      {levelProgressPercent}%
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressBarTrack,
                      { backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)' },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${levelProgressPercent}%`, backgroundColor: effectiveAccent },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.levelProgressHint,
                      { color: isLight ? '#64748b' : '#94a3b8' },
                    ]}
                  >
                    {totalHex} / {nextLevelMinHex} zonas para subir de nivel
                  </Text>
                </View>
              </View>
            </View>

            {/* Terra PRO: estado de suscripción y acceso al paywall / portal */}
            {onOpenProPaywall && (
              <TouchableOpacity
                style={[
                  styles.proCard,
                  {
                    backgroundColor: entitlements.isPro
                      ? (isLight ? 'rgba(234, 179, 8, 0.10)' : 'rgba(234, 179, 8, 0.08)')
                      : (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'),
                    borderColor: entitlements.isPro ? 'rgba(234, 179, 8, 0.5)' : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'),
                  },
                ]}
                onPress={() => {
                  onClose();
                  onOpenProPaywall();
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.proCardTitle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                    {entitlements.isPro ? 'Terra PRO activo' : 'Terra PRO'}
                  </Text>
                  <Text style={[styles.proCardSub, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    {entitlements.isPro
                      ? entitlements.cancelAtPeriodEnd
                        ? 'Cancelada · conservas el acceso hasta fin de periodo'
                        : `Plan ${entitlements.proPlan === 'pro_annual' ? 'anual' : 'mensual'} · gestionar pagos y facturas`
                      : 'Skins exclusivas, niebla avanzada y radar extendido'}
                  </Text>
                </View>
                <Text style={[styles.proCardAction, { color: '#eab308' }]}>
                  {entitlements.isPro ? 'Gestionar ›' : 'Mejorar ›'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Selector de Skins Cosméticas (GTA, Minecraft, Cyberpunk, Obsidian) */}
            {onOpenThemes && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginVertical: 10,
                }}
                onPress={() => {
                  onClose();
                  onOpenThemes();
                }}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                    Skins del Mapa & Cosméticos
                  </Text>
                  <Text style={{ fontSize: 10, color: isLight ? '#64748b' : '#94a3b8', marginTop: 1 }}>
                    GTA Los Santos, Minecraft, Cyberpunk 2077
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: effectiveAccent, fontWeight: '800', flexShrink: 0, textAlign: 'right' }}>Cambiar ›</Text>
              </TouchableOpacity>
            )}

            {/* Ajustes de Visualización & Radar (Ocultos de la barra principal para mantenerla limpia) */}
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {onToggleThemeMode && (
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)',
                  }}
                  onPress={onToggleThemeMode}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13 }}>{isLight ? '🌙' : '☀️'}</Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isLight ? '#0f172a' : '#ffffff',
                    }}
                  >
                    Modo {isLight ? 'Oscuro' : 'Claro'}
                  </Text>
                </TouchableOpacity>
              )}

              {onTogglePartnerRadar && (
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: isPartnerRadarActive
                      ? (isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.18)')
                      : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)'),
                    borderColor: isPartnerRadarActive
                      ? '#10b981'
                      : (isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'),
                  }}
                  onPress={onTogglePartnerRadar}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13 }}>{isPartnerRadarActive ? '🛰️' : '📡'}</Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isPartnerRadarActive ? '#10b981' : (isLight ? '#0f172a' : '#ffffff'),
                    }}
                  >
                    Radar {isPartnerRadarActive ? 'Activo' : 'Pausado'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Grid de 4 Estadísticas Clave */}
            <Text
              style={[
                styles.sectionHeader,
                { color: isLight ? '#475569' : '#64748b' },
              ]}
            >
              RESUMEN GENERAL
            </Text>
            <View style={styles.statsGrid}>
              {/* Stat 1: Nivel */}
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: isLight ? '#64748b' : '#94a3b8' },
                  ]}
                >
                  NIVEL
                </Text>
                <Text style={[styles.statValue, { color: effectiveAccent }]}>Nv. {level}</Text>
                <Text
                  style={[
                    styles.statSub,
                    { color: isLight ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  Rango explorador
                </Text>
              </View>

              {/* Stat 2: Racha de Días */}
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: isLight ? '#64748b' : '#94a3b8' },
                  ]}
                >
                  RACHA ACTIVA
                </Text>
                <Text style={[styles.statValue, { color: isLight ? '#d97706' : '#ffb703' }]}>
                  {streakDays} {streakDays === 1 ? 'DÍA' : 'DÍAS'}
                </Text>
                <Text
                  style={[
                    styles.statSub,
                    { color: isLight ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  Días consecutivos
                </Text>
              </View>

              {/* Stat 3: Sectores Explorados */}
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: isLight ? '#64748b' : '#94a3b8' },
                  ]}
                >
                  SECTORES
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: isLight ? '#0f172a' : '#ffffff' },
                  ]}
                >
                  {totalHex}
                </Text>
                <Text
                  style={[
                    styles.statSub,
                    { color: isLight ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  Cuadrantes (~100k m²)
                </Text>
              </View>

              {/* Stat 4: Área Total en el Mundo */}
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statLabel,
                    { color: isLight ? '#64748b' : '#94a3b8' },
                  ]}
                >
                  ÁREA GLOBAL
                </Text>
                <Text style={[styles.statValue, { color: effectiveAccent }]}>
                  {totalArea.toFixed(2)}{' '}
                  <Text style={styles.statUnit}>km²</Text>
                </Text>
                <Text
                  style={[
                    styles.statSub,
                    { color: isLight ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  Total en el mundo
                </Text>
              </View>
            </View>

            {/* Conquista Territorial y Métricas de Salud */}
            {regionalStats && (
              <View
                style={[
                  styles.operatorCard,
                  {
                    marginTop: 12,
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.75)',
                    borderColor: isLight ? '#e2e8f0' : `${effectiveAccent}30`,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 8,
                  },
                ]}
              >
                <Text style={[styles.sectionHeader, { color: isLight ? '#475569' : '#64748b', marginHorizontal: 0 }]}>
                  CONQUISTA REGIONAL & SALUD
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 13, color: isLight ? '#0f172a' : '#ffffff', fontWeight: '700' }}>
                    Ciudad de México:
                  </Text>
                  <Text style={{ fontSize: 13, color: effectiveAccent, fontWeight: '800' }}>
                    {regionalStats.cityFormatted}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 13, color: isLight ? '#0f172a' : '#ffffff', fontWeight: '700' }}>
                    Alcaldía Cuauhtémoc:
                  </Text>
                  <Text style={{ fontSize: 13, color: effectiveAccent, fontWeight: '800' }}>
                    {regionalStats.boroughFormatted}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 13, color: isLight ? '#0f172a' : '#ffffff', fontWeight: '700' }}>
                    República Mexicana:
                  </Text>
                  <Text style={{ fontSize: 13, color: isLight ? '#0284c7' : '#38bdf8', fontWeight: '800' }}>
                    {regionalStats.countryFormatted}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 13, color: isLight ? '#0f172a' : '#ffffff', fontWeight: '700' }}>
                    Calorías Estimadas:
                  </Text>
                  <Text style={{ fontSize: 13, color: '#f97316', fontWeight: '800' }}>
                    {regionalStats.caloriesBurned} kcal
                  </Text>
                </View>
              </View>
            )}

            {/* Insignias de Honor */}
            <View style={styles.badgeSectionHeaderRow}>
              <Text
                style={[
                  styles.sectionHeader,
                  { color: isLight ? '#475569' : '#64748b' },
                ]}
              >
                LOGROS & INSIGNIAS
              </Text>
              <Text style={[styles.badgeCounter, { color: effectiveAccent }]}>
                {badges ? badges.filter((b) => b.isUnlocked).length : unlockedBadgesCount} / {badges ? badges.length : BADGES.length} DESBLOQUEADOS
              </Text>
            </View>

            <View style={styles.badgesList}>
              {(badges && badges.length > 0 ? badges : BADGES.map((b) => ({
                id: b.id,
                title: b.title,
                iconEmoji: b.icon,
                description: b.description,
                requiredMetric: b.requiredHexagons,
                currentMetric: totalHex,
                isUnlocked: totalHex >= b.requiredHexagons,
                progressPercent: Math.min(100, Math.round((totalHex / b.requiredHexagons) * 100)),
              }))).map((badge) => {
                const { isUnlocked, progressPercent } = badge;

                return (
                  <View
                    key={badge.id}
                    style={[
                      styles.badgeCard,
                      {
                        backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                        borderColor: isLight
                          ? (isUnlocked ? effectiveAccent : '#e2e8f0')
                          : (isUnlocked ? effectiveAccent : 'rgba(255, 255, 255, 0.08)'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.badgeIconCircle,
                        isUnlocked
                          ? {
                              backgroundColor: isLight
                                ? 'rgba(37, 99, 235, 0.12)'
                                : 'rgba(0, 245, 212, 0.15)',
                              borderColor: effectiveAccent,
                            }
                          : {
                              backgroundColor: isLight
                                ? '#e2e8f0'
                                : 'rgba(255, 255, 255, 0.05)',
                              borderColor: isLight ? '#cbd5e1' : '#475569',
                            },
                      ]}
                    >
                      <Text style={[styles.badgeIconText, !isUnlocked && { opacity: 0.35 }]}>
                        {badge.iconEmoji}
                      </Text>
                    </View>

                    <View style={styles.badgeInfo}>
                      <View style={styles.badgeTitleRow}>
                        <Text
                          style={[
                            styles.badgeTitle,
                            {
                              color: isLight
                                ? (isUnlocked ? '#0f172a' : '#64748b')
                                : (isUnlocked ? '#ffffff' : '#94a3b8'),
                            },
                          ]}
                        >
                          {badge.title}
                        </Text>
                        <View
                          style={[
                            styles.badgeStatusPill,
                            isUnlocked
                              ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }
                              : {
                                  backgroundColor: isLight
                                    ? '#e2e8f0'
                                    : 'rgba(255, 255, 255, 0.05)',
                                  borderColor: isLight ? '#cbd5e1' : '#475569',
                                },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeStatusPillText,
                              { color: isUnlocked ? '#10b981' : (isLight ? '#64748b' : '#94a3b8') },
                            ]}
                          >
                            {isUnlocked ? '✓ LOGRADO' : `🔒 ${badge.currentMetric}/${badge.requiredMetric}`}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.badgeDescription,
                          { color: isLight ? '#475569' : '#94a3b8' },
                        ]}
                      >
                        {badge.description}
                      </Text>

                      {!isUnlocked && (
                        <View style={styles.badgeProgressContainer}>
                          <View
                            style={[
                              styles.badgeProgressBar,
                              { backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)' },
                            ]}
                          >
                            <View
                              style={[
                                styles.badgeProgressFill,
                                {
                                  width: `${progressPercent}%`,
                                  backgroundColor: isLight ? '#d97706' : '#ffb703',
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.badgeProgressText,
                              { color: isLight ? '#64748b' : '#94a3b8' },
                            ]}
                          >
                            {badge.currentMetric} / {badge.requiredMetric} ({progressPercent}%)
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Configuración de Sonido */}
            <View
              style={[
                styles.soundSettingsRow,
                {
                  backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                },
              ]}
            >
              <View style={styles.soundSettingsInfo}>
                <Text
                  style={[
                    styles.soundSettingsTitle,
                    { color: isLight ? '#0f172a' : '#f8fafc' },
                  ]}
                >
                  Efectos de Sonido
                </Text>
                <Text
                  style={[
                    styles.soundSettingsDesc,
                    { color: isLight ? '#64748b' : '#94a3b8' },
                  ]}
                >
                  Tono armónico al descubrir zonas
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.soundToggleBtn,
                  {
                    backgroundColor: isMuted
                      ? (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)')
                      : effectiveAccent,
                  },
                ]}
                onPress={handleToggleMute}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.soundToggleText,
                    {
                      color: isMuted
                        ? (isLight ? '#475569' : '#64748b')
                        : (isLight ? '#ffffff' : '#0b0f19'),
                    },
                  ]}
                >
                  {isMuted ? 'Silenciado' : 'Activo'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Radio de Exploración Configurable - Barra Deslizadora Escalonada */}
            <View
              style={{
                backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                marginTop: 10,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: isLight ? '#475569' : '#94a3b8' }}>
                  RADIO DE DESPEJE TÁCTICO
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: effectiveAccent }}>
                  {explorationRadius} METROS
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: isLight ? '#64748b' : '#cbd5e1', marginBottom: 12 }}>
                Amplitud del haz de descubrimiento al caminar o conducir:
              </Text>

              {/* Slider Track Escalonado Interactivo */}
              <View style={{ position: 'relative', height: 28, justifyContent: 'center', marginBottom: 8 }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.12)',
                    width: '100%',
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: effectiveAccent,
                      width: `${Math.round(((explorationRadius - 30) / (85 - 30)) * 100)}%`,
                    }}
                  />
                </View>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingHorizontal: 2,
                  }}
                >
                  {[30, 45, 60, 85].map((val) => {
                    const isPassed = explorationRadius >= val;
                    return (
                      <TouchableOpacity
                        key={val}
                        onPress={() => handleSelectRadius(val)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: isPassed ? effectiveAccent : (isLight ? '#cbd5e1' : '#334155'),
                          borderWidth: 2,
                          borderColor: isLight ? '#ffffff' : '#0b0f19',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Etiquetas de Pasos del Slider */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[
                  { r: 30, label: '30m (Caminata)' },
                  { r: 45, label: '45m (Estándar)' },
                  { r: 60, label: '60m (Bici)' },
                  { r: 85, label: '85m (Pro)' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.r}
                    onPress={() => handleSelectRadius(item.r)}
                    style={{ paddingVertical: 2 }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: explorationRadius === item.r ? '800' : '500',
                        color: explorationRadius === item.r ? effectiveAccent : (isLight ? '#64748b' : '#94a3b8'),
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Parámetros Antropométricos (Salud & Precisión de Calorías) */}
            <View
              style={{
                backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                marginTop: 2,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 0.8,
                  color: isLight ? '#475569' : '#94a3b8',
                  marginBottom: 4,
                }}
              >
                PERFIL FÍSICO (CALORÍAS & BIOMETRÍA)
              </Text>
              <Text style={{ fontSize: 11, color: isLight ? '#64748b' : '#cbd5e1', marginBottom: 12 }}>
                Ajusta tu peso y altura para calcular tu gasto calórico real (MET):
              </Text>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? '#475569' : '#94a3b8', marginBottom: 4 }}>
                    PESO CORPORAL (KG)
                  </Text>
                  <TextInput
                    style={{
                      height: 38,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)',
                      backgroundColor: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                      color: isLight ? '#0f172a' : '#ffffff',
                      paddingHorizontal: 12,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                    value={userWeightKg}
                    onChangeText={handleSaveWeight}
                    keyboardType="numeric"
                    placeholder="70"
                    placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? '#475569' : '#94a3b8', marginBottom: 4 }}>
                    ESTATURA (CM)
                  </Text>
                  <TextInput
                    style={{
                      height: 38,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)',
                      backgroundColor: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                      color: isLight ? '#0f172a' : '#ffffff',
                      paddingHorizontal: 12,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                    value={userHeightCm}
                    onChangeText={handleSaveHeight}
                    keyboardType="numeric"
                    placeholder="175"
                    placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  />
                </View>
              </View>
            </View>

            {/* Zona de Cumplimiento Legal y Borrado de Cuenta (Exigencia Apple/Google) */}
            <View
              style={{
                marginTop: 6,
                marginBottom: 12,
                alignItems: 'center',
              }}
            >
              {!isDeleteModalVisible ? (
                <TouchableOpacity
                  onPress={() => setIsDeleteModalVisible(true)}
                  style={{ paddingVertical: 6 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#ef4444' }}>
                    Eliminar cuenta y borrar todos mis datos
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444', textAlign: 'center', marginBottom: 8 }}>
                    ¿Eliminar permanentemente todos tus trayectos y zonas?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: '#ef4444',
                      }}
                      onPress={handleDeleteAccount}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#ffffff' }}>Confirmar borrado</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                      onPress={() => setIsDeleteModalVisible(false)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isLight ? '#0f172a' : '#ffffff' }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Botón de cierre */}
            <TouchableOpacity
              style={[
                styles.closeExpedienteBtn,
                {
                  backgroundColor: isLight ? effectiveAccent : 'transparent',
                  borderColor: effectiveAccent,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.closeExpedienteBtnText,
                  { color: isLight ? '#ffffff' : effectiveAccent },
                ]}
              >
                VOLVER AL MAPA
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  proCardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  proCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  proCardAction: {
    fontSize: 13,
    fontWeight: '800',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  operatorCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarFrame: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGlyph: {
    fontSize: 26,
  },
  levelTagBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  levelTagText: {
    fontSize: 9,
    fontWeight: '900',
  },
  operatorDetails: {
    flex: 1,
  },
  callsignText: {
    fontSize: 15,
    fontWeight: '900',
  },
  rankTitleText: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  levelProgressWrapper: {
    width: '100%',
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  levelProgressLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  levelProgressVal: {
    fontSize: 9,
    fontWeight: '900',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  levelProgressHint: {
    fontSize: 9,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 2,
  },
  statUnit: {
    fontSize: 11,
  },
  statSub: {
    fontSize: 9,
  },
  badgeSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeCounter: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgesList: {
    gap: 8,
    marginBottom: 16,
  },
  badgeCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  badgeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  badgeIconText: {
    fontSize: 20,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  badgeStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeStatusPillText: {
    fontSize: 8,
    fontWeight: '800',
  },
  badgeDescription: {
    fontSize: 11,
    lineHeight: 15,
  },
  badgeProgressContainer: {
    marginTop: 6,
  },
  badgeProgressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  badgeProgressText: {
    fontSize: 9,
    marginTop: 2,
  },
  soundSettingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  soundSettingsInfo: {
    flex: 1,
  },
  soundSettingsTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  soundSettingsDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  soundToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  soundToggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeExpedienteBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 4,
  },
  closeExpedienteBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
