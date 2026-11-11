import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
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
          <View style={[styles.header, { borderBottomColor: p.hairline }]}>
            <View style={styles.headerText}>
              {eyebrow ? <Text style={[styles.eyebrow, { color: p.subtext }]}>{eyebrow}</Text> : null}
              <Text style={[styles.title, { color: p.text }]}>{title}</Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: p.raised, borderColor: p.hairline }]}
              onPress={onClose}
              accessibilityLabel="Cerrar"
              activeOpacity={0.8}
            >
              <Text style={[styles.closeGlyph, { color: p.text }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/** Tarjeta interna con superficie elevada y borde fino. */
export const SurfaceCard: React.FC<{ theme?: MapTheme; children: React.ReactNode; style?: object }> = ({
  theme,
  children,
  style,
}) => {
  const p = modalPalette(theme);
  return <View style={[styles.surfaceCard, { backgroundColor: p.raised, borderColor: p.hairline }, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  card: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { width: '100%', maxWidth: 520, alignSelf: 'center' as const } : null),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginBottom: space.xs,
  },
  title: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
  closeBtn: {
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
  body: { padding: space.xl, gap: space.md },
  surfaceCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.lg,
    gap: space.sm,
  },
});
