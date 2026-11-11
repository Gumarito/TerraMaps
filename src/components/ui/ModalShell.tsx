import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { MapTheme } from '@/core/theme/mapThemes';
import { colors, fontSize, fontWeight, radius, size, space } from '@/theme/tokens';

/** Paleta semántica de modal derivada de tokens.ts según el modo claro/oscuro del tema. */
export function modalPalette(theme?: MapTheme) {
  const isLight = theme?.mode === 'light';
  return {
    isLight,
    surface: isLight ? '#ffffff' : '#0c101d',
    raised: isLight ? '#f1f5f9' : colors.obsidianRaised,
    hairline: isLight ? '#e2e8f0' : colors.hairline,
    border: isLight ? '#cbd5e1' : colors.border,
    text: isLight ? '#0f172a' : colors.textPrimary,
    subtext: isLight ? '#64748b' : colors.titanium,
    accent: isLight ? theme?.accentColor ?? '#2563eb' : theme?.accentColor ?? colors.accent,
    onAccent: isLight ? '#ffffff' : colors.obsidian,
    gradient: (isLight ? ['#ffffff', '#f1f5f9'] : [colors.cardGradientFrom, colors.cardGradientTo]) as [string, string],
    gold: isLight ? '#a16207' : colors.goldSoft,
    positive: isLight ? '#047857' : colors.emerald,
  };
}

interface ModalShellProps {
  visible: boolean;
  onClose: () => void;
  theme?: MapTheme;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}

/** Contenedor ejecutivo común: backdrop, tarjeta, cabecera con cierre y cuerpo desplazable. */
export const ModalShell: React.FC<ModalShellProps> = ({ visible, onClose, theme, eyebrow, title, children }) => {
  const p = modalPalette(theme);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grabber, { backgroundColor: p.border }]} />
          <View style={[styles.header, { borderBottomColor: p.hairline }]}>
            <View style={styles.headerText}>
              {eyebrow ? <Text style={[styles.eyebrow, { color: p.subtext }]}>{eyebrow}</Text> : null}
              <Text style={[styles.title, { color: p.text }]}>{title}</Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: p.raised, borderColor: p.hairline }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              activeOpacity={0.8}
            >
              <Text style={[styles.closeGlyph, { color: p.subtext }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

interface SurfaceCardProps {
  theme?: MapTheme;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'hero' aplica un micro-gradiente sobrio; 'plain' usa superficie elevada plana. */
  tone?: 'plain' | 'hero';
  /** Borde de acento sutil (p. ej. elemento seleccionado). */
  accentBorder?: string;
}

/** Tarjeta interna con superficie elevada, borde fino y micro-gradiente opcional. */
export const SurfaceCard: React.FC<SurfaceCardProps> = ({ theme, children, style, tone = 'plain', accentBorder }) => {
  const p = modalPalette(theme);
  const borderColor = accentBorder ?? p.hairline;
  if (tone === 'hero') {
    return (
      <LinearGradient
        colors={p.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.surfaceCard, { borderColor }, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  return <View style={[styles.surfaceCard, { backgroundColor: p.raised, borderColor }, style]}>{children}</View>;
};

/** Rótulo de sección en versalitas con tracking amplio y filete opcional a la derecha. */
export const SectionLabel: React.FC<{ theme?: MapTheme; children: string; right?: string }> = ({
  theme,
  children,
  right,
}) => {
  const p = modalPalette(theme);
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: p.subtext }]}>{children}</Text>
      <View style={[styles.sectionRule, { backgroundColor: p.hairline }]} />
      {right ? <Text style={[styles.sectionRight, { color: p.accent }]}>{right}</Text> : null}
    </View>
  );
};

/** Métrica de tablero: etiqueta mínima, cifra dominante y unidad/nota discreta. */
export const StatTile: React.FC<{
  theme?: MapTheme;
  label: string;
  value: string;
  unit?: string;
  note?: string;
  emphasis?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ theme, label, value, unit, note, emphasis, style }) => {
  const p = modalPalette(theme);
  return (
    <View style={[styles.tile, { backgroundColor: p.raised, borderColor: p.hairline }, style]}>
      <Text style={[styles.tileLabel, { color: p.subtext }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.tileValue, { color: emphasis ? p.accent : p.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={[styles.tileUnit, { color: p.subtext }]}> {unit}</Text> : null}
      </Text>
      {note ? (
        <Text style={[styles.tileNote, { color: p.subtext }]} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  );
};

/** Etiqueta compacta de estado: contorno fino, sin relleno chillón. */
export const Tag: React.FC<{ theme?: MapTheme; label: string; color?: string }> = ({ theme, label, color }) => {
  const p = modalPalette(theme);
  const c = color ?? p.subtext;
  return (
    <View style={[styles.tag, { borderColor: c }]}>
      <Text style={[styles.tagText, { color: c }]}>{label}</Text>
    </View>
  );
};

/** Fila de datos clave → valor con filete inferior. */
export const DataRow: React.FC<{ theme?: MapTheme; label: string; value: string; valueColor?: string; last?: boolean }> = ({
  theme,
  label,
  value,
  valueColor,
  last,
}) => {
  const p = modalPalette(theme);
  return (
    <View style={[styles.dataRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.hairline }]}>
      <Text style={[styles.dataLabel, { color: p.subtext }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: valueColor ?? p.text }]}>{value}</Text>
    </View>
  );
};

/**
 * Botón sobrio. 'primary' es un acento acotado (no ocupa toda la tarjeta con color plano);
 * 'quiet' es contorno fino; 'danger' es contorno rojo.
 */
export const ActionButton: React.FC<{
  theme?: MapTheme;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'quiet' | 'danger';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ theme, label, onPress, variant = 'quiet', compact, style }) => {
  const p = modalPalette(theme);
  const bg = variant === 'primary' ? p.accent : 'transparent';
  const fg = variant === 'primary' ? p.onAccent : variant === 'danger' ? colors.danger : p.text;
  const bd = variant === 'primary' ? p.accent : variant === 'danger' ? colors.danger : p.border;
  return (
    <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact, { backgroundColor: bg, borderColor: bd }, style]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  card: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { width: '100%', maxWidth: 520, alignSelf: 'center' as const } : null),
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: space.sm,
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    letterSpacing: 2,
    marginBottom: space.xs,
  },
  title: { fontSize: fontSize.display, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  closeBtn: {
    width: size.fab - 6,
    height: size.fab - 6,
    borderRadius: (size.fab - 6) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
  body: { padding: space.xl, paddingBottom: space.xxl, gap: space.md },
  surfaceCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.sm,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  sectionLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: 2 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionRight: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: 1 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: 2,
  },
  tileLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: 1.5 },
  tileValue: { fontSize: 22, fontWeight: fontWeight.bold, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: fontSize.small, fontWeight: fontWeight.regular, letterSpacing: 0 },
  tileNote: { fontSize: fontSize.caption, fontWeight: fontWeight.regular },
  tag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: { fontSize: 9, fontWeight: fontWeight.medium, letterSpacing: 1 },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm + 2,
  },
  dataLabel: { fontSize: fontSize.small, fontWeight: fontWeight.regular },
  dataValue: { fontSize: fontSize.body, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'] },
  btn: {
    minHeight: size.fab,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnCompact: { minHeight: 34, paddingHorizontal: space.md, borderRadius: radius.sm },
  btnText: { fontSize: fontSize.small, fontWeight: fontWeight.medium, letterSpacing: 0.5 },
});
