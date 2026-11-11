import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MAP_THEMES, MapTheme } from '@/core/theme/mapThemes';
import { monetizationService } from '@/services/monetizationService';
import { storageService } from '@/services/storage';
import { adService } from '@/services/adService';
import { getThemeLockReason } from '@/services/billing';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ModalShell, SurfaceCard, ActionButton, Tag, modalPalette } from '../ui/ModalShell';
import { colors, fontSize, fontWeight, radius, space } from '@/theme/tokens';

interface ThemeSelectorModalProps {
  visible: boolean;
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onClose: () => void;
  /** Tema activo, para teñir el modal (claro/oscuro). */
  theme?: MapTheme;
  /** Abre el paywall de Terra PRO al tocar una skin prémium bloqueada. */
  onRequestUpgrade?: () => void;
}

/** Vista previa en miniatura: terreno con niebla, calles, zona despejada con halo y marcador. */
const MapSwatch: React.FC<{ skin: MapTheme; dimmed: boolean }> = ({ skin, dimmed }) => {
  const light = skin.mode === 'light';
  const ground = light ? '#e8edf3' : skin.fogColor;
  const lift = light ? '#f8fafc' : skin.hudBackground;
  const street = light ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.10)';
  return (
    <LinearGradient colors={[lift, ground]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.swatch, dimmed && styles.dimmed]}>
      {/* Retícula de calles */}
      <View style={[styles.street, styles.streetH1, { backgroundColor: street }]} />
      <View style={[styles.street, styles.streetH2, { backgroundColor: street }]} />
      <View style={[styles.street, styles.streetV1, { backgroundColor: street }]} />
      <View style={[styles.street, styles.streetDiag, { backgroundColor: street }]} />
      {/* Zona despejada con halo de la skin */}
      <View style={[styles.halo, { borderColor: skin.glowColor, shadowColor: skin.glowColor }]}>
        <View style={[styles.haloFill, { backgroundColor: skin.glowColor }]} />
      </View>
      <View style={[styles.pin, { backgroundColor: skin.accentColor, borderColor: light ? '#ffffff' : skin.fogColor }]} />
      {/* Cinta de paleta: niebla · halo · acento */}
      <View style={styles.paletteStrip}>
        {[skin.fogColor, skin.glowColor, skin.accentColor].map((c, i) => (
          <View key={i} style={[styles.paletteChip, { backgroundColor: c }]} />
        ))}
      </View>
    </LinearGradient>
  );
};

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  visible,
  currentThemeId,
  onSelectTheme,
  onClose,
  theme,
  onRequestUpgrade,
}) => {
  const entitlements = useEntitlements();
  const [, setAdUnlockTick] = useState(0);
  const p = modalPalette(theme);
  const stats = storageService.getStats();
  const skinMap = new Map(monetizationService.getTacticalSkins(stats).map((s) => [s.id, s]));
  const themes = Object.values(MAP_THEMES);
  const anyLocked = themes.some((t) => getThemeLockReason(t.id) !== null);

  const handleUnlockWithAd = async () => {
    const res = await adService.requestRewardedAd('theme');
    if (res.success) setAdUnlockTick((n) => n + 1); // fuerza re-evaluación de bloqueos
  };

  return (
    <ModalShell visible={visible} onClose={onClose} theme={theme} eyebrow="COLECCIÓN CARTOGRÁFICA" title="Skins del Mapa">
      <View style={styles.grid}>
        {themes.map((skin: MapTheme) => {
          const isSelected = skin.id === currentThemeId;
          const lockReason = getThemeLockReason(skin.id);
          const isUnlocked = lockReason === null;
          const blurb =
            lockReason === 'progress'
              ? skinMap.get(skin.id)?.unlockCriteriaText || skin.description
              : skin.description;

          return (
            <TouchableOpacity
              key={skin.id}
              style={styles.cell}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${skin.name}${isSelected ? ', activa' : ''}${isUnlocked ? '' : ', bloqueada'}`}
              accessibilityState={{ selected: isSelected, disabled: !isUnlocked && lockReason !== 'pro' }}
              onPress={() => {
                if (isUnlocked) {
                  onSelectTheme(skin.id);
                  onClose();
                } else if (lockReason === 'pro' && onRequestUpgrade) {
                  onClose();
                  onRequestUpgrade();
                }
              }}
            >
              <SurfaceCard theme={theme} style={styles.card} accentBorder={isSelected ? skin.glowColor : undefined}>
                <MapSwatch skin={skin} dimmed={!isUnlocked} />
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
                    {skin.name}
                  </Text>
                  {isSelected ? <Text style={[styles.check, { color: skin.glowColor }]}>◈</Text> : null}
                </View>
                <Text style={[styles.blurb, { color: p.subtext }]} numberOfLines={3}>
                  {blurb}
                </Text>
                <View style={styles.tagRow}>
                  {isSelected ? <Tag theme={theme} label="ACTIVA" color={p.positive} /> : null}
                  {skin.access === 'pro' ? <Tag theme={theme} label={isUnlocked ? 'PRO · INCLUIDA' : 'PRO'} color={p.gold} /> : null}
                  {lockReason === 'progress' ? <Tag theme={theme} label="POR PROGRESO" color={colors.danger} /> : null}
                </View>
              </SurfaceCard>
            </TouchableOpacity>
          );
        })}
      </View>

      {anyLocked && !entitlements.isPro && (
        <SurfaceCard theme={theme} tone="hero" accentBorder={p.gold}>
          <Text style={[styles.upTitle, { color: p.text }]}>Terra PRO</Text>
          <Text style={[styles.upSub, { color: p.subtext }]}>
            Todas las skins, niebla avanzada y radio extendido mientras tu suscripción esté activa.
          </Text>
          <View style={styles.upActions}>
            {onRequestUpgrade && (
              <ActionButton
                theme={theme}
                variant="primary"
                label="Ver planes"
                style={styles.flex}
                onPress={() => {
                  onClose();
                  onRequestUpgrade();
                }}
              />
            )}
            <ActionButton theme={theme} label="Anuncio · 24 h" style={styles.flex} onPress={handleUnlockWithAd} />
          </View>
        </SurfaceCard>
      )}
    </ModalShell>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { flexBasis: '47%', flexGrow: 1 },
  card: { padding: space.sm, gap: space.xs },
  swatch: {
    height: 84,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: space.xs,
  },
  dimmed: { opacity: 0.45 },
  street: { position: 'absolute' },
  streetH1: { left: 0, right: 0, top: 22, height: 1 },
  streetH2: { left: 0, right: 0, top: 58, height: 1 },
  streetV1: { top: 0, bottom: 0, left: 46, width: 1 },
  streetDiag: { left: -10, width: 140, top: 40, height: 1, transform: [{ rotate: '-28deg' }] },
  halo: {
    position: 'absolute',
    left: 22,
    top: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  haloFill: { width: '100%', height: '100%', borderRadius: 24, opacity: 0.12 },
  pin: {
    position: 'absolute',
    left: 42,
    top: 40,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  paletteStrip: { position: 'absolute', right: space.sm, bottom: space.sm, flexDirection: 'row', gap: 3 },
  paletteChip: { width: 9, height: 9, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  name: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: -0.1 },
  check: { fontSize: fontSize.body },
  blurb: { fontSize: fontSize.caption, lineHeight: 14, paddingHorizontal: space.xs, minHeight: 42 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingHorizontal: space.xs, paddingBottom: space.xs, minHeight: 22 },
  upTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  upSub: { fontSize: fontSize.small, lineHeight: 18 },
  upActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  flex: { flex: 1 },
});
