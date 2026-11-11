import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { storageService, UserStats } from '@/services/storage';
import { audioFeedback } from '@/utils/audioFeedback';
import { MapTheme } from '@/core/theme/mapThemes';
import { authService } from '@/services/authService';
import type { TerraBadge } from '@/services/achievementsService';
import type { RegionalExplorationStats } from '@/services/regionalMetrics';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ModalShell, SurfaceCard, SectionLabel, StatTile, Tag, DataRow, ActionButton, modalPalette } from '../ui/ModalShell';
import { colors, fontSize, fontWeight, radius, size, space } from '@/theme/tokens';

const PRO_EXPLORATION_RADIUS_M = 85;

const RADIUS_OPTIONS: ReadonlyArray<{ r: number; label: string; hint: string }> = [
  { r: 30, label: '30 m', hint: 'Caminata' },
  { r: 45, label: '45 m', hint: 'Estándar' },
  { r: 60, label: '60 m', hint: 'Bici' },
  { r: 85, label: '85 m', hint: 'Pro' },
];

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
  /** Abre el panel de herramientas (Limpiar Mapa / Teletransporte). */
  onOpenDevTools?: () => void;
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  requiredHexagons: number;
}

const BADGES: BadgeDefinition[] = [
  { id: 'first_steps', title: 'Primeros Pasos', description: 'Primer contacto territorial. Niebla inicial dispersada.', requiredHexagons: 1 },
  { id: 'urban_walker', title: 'Caminante Urbano', description: 'Exploración de múltiples manzanas y corredores urbanos.', requiredHexagons: 50 },
  { id: 'district_conqueror', title: 'Conquistador de Barrio', description: 'Consolidación de un distrito metropolitano completo.', requiredHexagons: 200 },
  { id: 'legendary_cartographer', title: 'Cartógrafo Legendario', description: 'Maestría geográfica absoluta. Registro de élite.', requiredHexagons: 1000 },
];

const readStored = (key: string, fallback: string): string => {
  try {
    return storageService.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key: string, value: string): void => {
  try {
    storageService.setItem(key, value);
  } catch {
    // No-op: almacenamiento no disponible.
  }
};

const getRankTitle = (lvl: number): string => {
  if (lvl >= 10) return 'Trotamundos Legendario';
  if (lvl >= 7) return 'Maestro Cartógrafo';
  if (lvl >= 5) return 'Guía Territorial';
  if (lvl >= 3) return 'Pionero Urbano';
  if (lvl >= 2) return 'Caminante Activo';
  return 'Explorador Novato';
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
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
  onOpenDevTools,
}) => {
  const p = modalPalette(theme);
  const entitlements = useEntitlements();

  const currentStats: UserStats = userStats || storageService.getStats();
  const [isMuted, setIsMuted] = useState<boolean>(audioFeedback.getIsMuted());
  const [explorationRadius, setExplorationRadius] = useState<number>(() => {
    const parsed = parseInt(readStored('@terramaps_exploration_radius', '45'), 10);
    return Number.isFinite(parsed) ? parsed : 45;
  });
  const [userWeightKg, setUserWeightKg] = useState<string>(() => readStored('@terramaps_user_weight', '70'));
  const [userHeightCm, setUserHeightCm] = useState<string>(() => readStored('@terramaps_user_height', '175'));
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const handleSelectRadius = (r: number) => {
    if (r >= PRO_EXPLORATION_RADIUS_M && !entitlements.isPro) {
      onOpenProPaywall?.();
      return;
    }
    setExplorationRadius(r);
    writeStored('@terramaps_exploration_radius', r.toString());
  };

  const handleDeleteAccount = async () => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.clear();
      await authService.signOut();
      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') window.location.reload();
    } catch {
      setConfirmDelete(false);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    audioFeedback.setMuted(next);
    setIsMuted(next);
    if (!next) audioFeedback.playDiscoverySound();
  };

  const totalHex = currentStats.totalHexagons;
  const totalArea = currentStats.totalAreaKm2;
  const streakDays = currentStats.currentStreakDays || 1;
  const level = currentStats.explorationLevel || Math.max(1, Math.floor(Math.sqrt(totalHex / 5)));

  const currentLevelMinHex = Math.pow(level, 2) * 5;
  const nextLevelMinHex = Math.pow(level + 1, 2) * 5;
  const progressInLevel = Math.max(0, totalHex - currentLevelMinHex);
  const neededForNextLevel = Math.max(1, nextLevelMinHex - currentLevelMinHex);
  const levelProgressPercent = Math.min(100, Math.round((progressInLevel / neededForNextLevel) * 100));

  const badgeList =
    badges && badges.length > 0
      ? badges
      : BADGES.map((b) => ({
          id: b.id,
          title: b.title,
          iconEmoji: '',
          description: b.description,
          requiredMetric: b.requiredHexagons,
          currentMetric: totalHex,
          isUnlocked: totalHex >= b.requiredHexagons,
          progressPercent: Math.min(100, Math.round((totalHex / b.requiredHexagons) * 100)),
        }));
  const unlockedCount = badgeList.filter((b) => b.isUnlocked).length;

  const field = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.surface }];

  return (
    <ModalShell visible={visible} onClose={onClose} theme={theme} eyebrow="EXPEDIENTE PERSONAL" title="Cuenta & Perfil">
      {/* Identidad */}
      <SurfaceCard theme={theme} tone="hero" style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={[styles.monogram, { borderColor: p.accent }]}>
            <Text style={[styles.monogramText, { color: p.text }]}>{username.trim().charAt(0).toUpperCase() || 'E'}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
              {username}
            </Text>
            <Text style={[styles.rank, { color: p.gold }]}>{getRankTitle(level)}</Text>
          </View>
          <View style={styles.levelBlock}>
            <Text style={[styles.levelLabel, { color: p.subtext }]}>NIVEL</Text>
            <Text style={[styles.levelValue, { color: p.accent }]}>{level}</Text>
          </View>
        </View>
        <View style={styles.progressMeta}>
          <Text style={[styles.metaText, { color: p.subtext }]}>PROGRESO AL NIVEL {level + 1}</Text>
          <Text style={[styles.metaText, { color: p.text }]}>{levelProgressPercent}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: p.hairline }]}>
          <View style={[styles.fill, { width: `${levelProgressPercent}%`, backgroundColor: p.accent }]} />
        </View>
        <Text style={[styles.metaText, { color: p.subtext }]}>
          {totalHex} / {nextLevelMinHex} sectores para el siguiente nivel
        </Text>
      </SurfaceCard>

      {/* Terra PRO */}
      {onOpenProPaywall && (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={() => {
            onClose();
            onOpenProPaywall();
          }}
        >
          <SurfaceCard theme={theme} accentBorder={entitlements.isPro ? p.gold : undefined} style={styles.rowCard}>
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Text style={[styles.rowTitle, { color: p.text }]}>Terra PRO</Text>
                {entitlements.isPro ? <Tag theme={theme} label="ACTIVO" color={p.gold} /> : null}
              </View>
              <Text style={[styles.rowSub, { color: p.subtext }]}>
                {entitlements.isPro
                  ? entitlements.cancelAtPeriodEnd
                    ? 'Cancelada · acceso hasta fin de periodo'
                    : `Plan ${entitlements.proPlan === 'pro_annual' ? 'anual' : 'mensual'} · pagos y facturas`
                  : 'Skins exclusivas, niebla avanzada y radio extendido'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: p.gold }]}>›</Text>
          </SurfaceCard>
        </TouchableOpacity>
      )}

      {/* Métricas */}
      <SectionLabel theme={theme}>RESUMEN</SectionLabel>
      <View style={styles.tiles}>
        <StatTile theme={theme} label="NIVEL" value={`${level}`} note="Rango explorador" emphasis />
        <StatTile theme={theme} label="RACHA" value={`${streakDays}`} unit={streakDays === 1 ? 'día' : 'días'} note="Consecutivos" />
        <StatTile theme={theme} label="SECTORES" value={`${totalHex}`} note="Cuadrantes explorados" />
        <StatTile theme={theme} label="ÁREA GLOBAL" value={totalArea.toFixed(2)} unit="km²" note="Total en el mundo" emphasis />
      </View>

      {regionalStats && (
        <SurfaceCard theme={theme} style={styles.noGap}>
          <DataRow theme={theme} label="Ciudad de México" value={regionalStats.cityFormatted} valueColor={p.accent} />
          <DataRow theme={theme} label="Alcaldía Cuauhtémoc" value={regionalStats.boroughFormatted} valueColor={p.accent} />
          <DataRow theme={theme} label="República Mexicana" value={regionalStats.countryFormatted} />
          <DataRow theme={theme} label="Calorías estimadas" value={`${regionalStats.caloriesBurned} kcal`} valueColor={colors.ember} last />
        </SurfaceCard>
      )}

      {/* Logros */}
      <SectionLabel theme={theme} right={`${unlockedCount} / ${badgeList.length}`}>
        LOGROS
      </SectionLabel>
      <View style={styles.badges}>
        {badgeList.map((badge) => (
          <SurfaceCard
            key={badge.id}
            theme={theme}
            style={[styles.rowCard, !badge.isUnlocked && styles.lockedBadge]}
            accentBorder={badge.isUnlocked ? p.accent : undefined}
          >
            <View style={[styles.badgeGlyph, { borderColor: badge.isUnlocked ? p.accent : p.border }]}>
              <Text style={[styles.badgeGlyphText, { color: badge.isUnlocked ? p.accent : p.subtext }]}>
                {badge.isUnlocked ? '◈' : '◇'}
              </Text>
            </View>
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
                  {badge.title}
                </Text>
                {badge.isUnlocked ? <Tag theme={theme} label="LOGRADO" color={p.positive} /> : null}
              </View>
              <Text style={[styles.rowSub, { color: p.subtext }]}>{badge.description}</Text>
              {!badge.isUnlocked && (
                <View style={styles.badgeProgress}>
                  <View style={[styles.trackThin, { backgroundColor: p.hairline }]}>
                    <View style={[styles.fill, { width: `${badge.progressPercent}%`, backgroundColor: p.gold }]} />
                  </View>
                  <Text style={[styles.metaText, { color: p.subtext }]}>
                    {badge.currentMetric} / {badge.requiredMetric}
                  </Text>
                </View>
              )}
            </View>
          </SurfaceCard>
        ))}
      </View>

      {/* Preferencias */}
      <SectionLabel theme={theme}>PREFERENCIAS</SectionLabel>
      {onOpenThemes && (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={() => {
            onClose();
            onOpenThemes();
          }}
        >
          <SurfaceCard theme={theme} style={styles.rowCard}>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: p.text }]}>Skins del Mapa</Text>
              <Text style={[styles.rowSub, { color: p.subtext }]}>Colección cartográfica y acabados</Text>
            </View>
            <Text style={[styles.chevron, { color: p.accent }]}>›</Text>
          </SurfaceCard>
        </TouchableOpacity>
      )}

      <View style={styles.inlineGap}>
        {onToggleThemeMode && (
          <ActionButton
            theme={theme}
            label={p.isLight ? 'Modo oscuro' : 'Modo claro'}
            onPress={onToggleThemeMode}
            style={styles.flex}
          />
        )}
        {onTogglePartnerRadar && (
          <ActionButton
            theme={theme}
            label={isPartnerRadarActive ? 'Radar activo' : 'Radar en pausa'}
            onPress={onTogglePartnerRadar}
            style={[styles.flex, isPartnerRadarActive && { borderColor: p.positive }]}
          />
        )}
      </View>

      <SurfaceCard theme={theme}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={[styles.rowTitle, { color: p.text }]}>Efectos de sonido</Text>
            <Text style={[styles.rowSub, { color: p.subtext }]}>Tono armónico al descubrir zonas</Text>
          </View>
          <ActionButton
            theme={theme}
            compact
            variant={isMuted ? 'quiet' : 'primary'}
            label={isMuted ? 'Silenciado' : 'Activo'}
            onPress={handleToggleMute}
          />
        </View>
      </SurfaceCard>

      {/* Radio de exploración: control segmentado */}
      <SurfaceCard theme={theme}>
        <View style={styles.rowBetween}>
          <Text style={[styles.rowTitle, { color: p.text }]}>Radio de despeje</Text>
          <Text style={[styles.rowTitle, { color: p.accent }]}>{explorationRadius} m</Text>
        </View>
        <Text style={[styles.rowSub, { color: p.subtext }]}>Amplitud del haz de descubrimiento al desplazarte.</Text>
        <View style={[styles.segment, { borderColor: p.border }]}>
          {RADIUS_OPTIONS.map((opt, i) => {
            const active = explorationRadius === opt.r;
            const locked = opt.r >= PRO_EXPLORATION_RADIUS_M && !entitlements.isPro;
            return (
              <TouchableOpacity
                key={opt.r}
                style={[
                  styles.segmentItem,
                  i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.border },
                  active && { backgroundColor: p.accent },
                ]}
                onPress={() => handleSelectRadius(opt.r)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Radio ${opt.label}, ${opt.hint}`}
              >
                <Text style={[styles.segmentLabel, { color: active ? p.onAccent : locked ? p.subtext : p.text }]}>{opt.label}</Text>
                <Text style={[styles.segmentHint, { color: active ? p.onAccent : p.subtext }]}>{locked ? 'PRO' : opt.hint}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SurfaceCard>

      {/* Biometría */}
      <SurfaceCard theme={theme}>
        <Text style={[styles.rowTitle, { color: p.text }]}>Perfil físico</Text>
        <Text style={[styles.rowSub, { color: p.subtext }]}>Peso y estatura para calcular tu gasto calórico real.</Text>
        <View style={styles.inlineGap}>
          <View style={styles.flex}>
            <Text style={[styles.fieldLabel, { color: p.subtext }]}>PESO (KG)</Text>
            <TextInput
              style={field}
              value={userWeightKg}
              onChangeText={(v) => {
                setUserWeightKg(v);
                writeStored('@terramaps_user_weight', v);
              }}
              keyboardType="numeric"
              placeholder="70"
              placeholderTextColor={p.subtext}
            />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.fieldLabel, { color: p.subtext }]}>ESTATURA (CM)</Text>
            <TextInput
              style={field}
              value={userHeightCm}
              onChangeText={(v) => {
                setUserHeightCm(v);
                writeStored('@terramaps_user_height', v);
              }}
              keyboardType="numeric"
              placeholder="175"
              placeholderTextColor={p.subtext}
            />
          </View>
        </View>
      </SurfaceCard>

      {/* Pie: herramientas y zona legal */}
      <SectionLabel theme={theme}>AVANZADO</SectionLabel>
      {onOpenDevTools && (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Abrir herramientas del explorador"
          onPress={onOpenDevTools}
        >
          <SurfaceCard theme={theme} style={styles.rowCard}>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: p.text }]}>Herramientas del explorador</Text>
              <Text style={[styles.rowSub, { color: p.subtext }]}>Teletransporte y limpieza del mapa</Text>
            </View>
            <Text style={[styles.chevron, { color: p.subtext }]}>›</Text>
          </SurfaceCard>
        </TouchableOpacity>
      )}

      {!confirmDelete ? (
        <TouchableOpacity onPress={() => setConfirmDelete(true)} style={styles.deleteLink} activeOpacity={0.7} accessibilityRole="button">
          <Text style={[styles.deleteText, { color: colors.danger }]}>Eliminar cuenta y borrar todos mis datos</Text>
        </TouchableOpacity>
      ) : (
        <SurfaceCard theme={theme} accentBorder={colors.danger}>
          <Text style={[styles.rowTitle, { color: colors.danger }]}>¿Eliminar permanentemente tus trayectos y zonas?</Text>
          <Text style={[styles.rowSub, { color: p.subtext }]}>Esta acción no se puede deshacer.</Text>
          <View style={styles.inlineGap}>
            <ActionButton theme={theme} variant="danger" label="Confirmar borrado" onPress={handleDeleteAccount} style={styles.flex} />
            <ActionButton theme={theme} label="Cancelar" onPress={() => setConfirmDelete(false)} style={styles.flex} />
          </View>
        </SurfaceCard>
      )}
    </ModalShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noGap: { gap: 0, paddingVertical: space.xs },
  hero: { gap: space.sm, padding: space.lg + 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  monogram: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
  name: { fontSize: fontSize.display, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  rank: { fontSize: fontSize.small, fontWeight: fontWeight.medium, letterSpacing: 0.5, marginTop: 2 },
  levelBlock: { alignItems: 'flex-end' },
  levelLabel: { fontSize: 9, fontWeight: fontWeight.medium, letterSpacing: 2 },
  levelValue: { fontSize: 30, fontWeight: fontWeight.bold, letterSpacing: -1, lineHeight: 34 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 9, fontWeight: fontWeight.medium, letterSpacing: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackThin: { height: 3, borderRadius: 2, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inlineGap: { flexDirection: 'row', gap: space.sm },
  rowTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
  rowSub: { fontSize: fontSize.small, lineHeight: 17, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: fontWeight.regular },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badges: { gap: space.sm },
  lockedBadge: { opacity: 0.8 },
  badgeGlyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyphText: { fontSize: fontSize.title },
  badgeProgress: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space.xs },
  segmentItem: { flex: 1, minHeight: size.fab + 6, alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm },
  segmentLabel: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
  segmentHint: { fontSize: 9, fontWeight: fontWeight.medium, letterSpacing: 0.5, marginTop: 1 },
  fieldLabel: { fontSize: 9, fontWeight: fontWeight.medium, letterSpacing: 1.5, marginBottom: space.xs, marginTop: space.xs },
  input: {
    minHeight: size.fab,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
  deleteLink: { alignItems: 'center', paddingVertical: space.md },
  deleteText: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
});
