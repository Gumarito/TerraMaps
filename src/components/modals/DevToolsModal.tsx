import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { MapTheme } from '@/core/theme/mapThemes';
import { ModalShell, SurfaceCard, modalPalette } from '../ui/ModalShell';
import { colors, fontSize, fontWeight, radius, size, space } from '@/theme/tokens';

interface DevToolsModalProps {
  visible: boolean;
  onClose: () => void;
  theme?: MapTheme;
  onClearMap: () => void;
  onTeleport: (lng: number, lat: number) => void;
}

export const TELEPORT_PRESETS: ReadonlyArray<{ name: string; lng: number; lat: number }> = [
  { name: 'Torreón', lng: -103.4068, lat: 25.5428 },
  { name: 'CDMX', lng: -99.1332, lat: 19.4326 },
  { name: 'Monterrey', lng: -100.3161, lat: 25.6866 },
  { name: 'Guadalajara', lng: -103.3496, lat: 20.6597 },
];

export const DevToolsModal: React.FC<DevToolsModalProps> = ({ visible, onClose, theme, onClearMap, onTeleport }) => {
  const p = modalPalette(theme);
  const [confirmClear, setConfirmClear] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    onClearMap();
    setConfirmClear(false);
    flash('Mapa reiniciado: sectores explorados en cero.');
  };

  const handleManual = () => {
    const la = parseFloat(lat.replace(',', '.'));
    const lo = parseFloat(lng.replace(',', '.'));
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      flash('Coordenadas inválidas (lat ±90, lng ±180).');
      return;
    }
    onTeleport(lo, la);
    flash(`Teletransporte a ${la.toFixed(4)}, ${lo.toFixed(4)}.`);
  };

  const chip = [styles.chip, { backgroundColor: p.surface, borderColor: p.border }];
  const input = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.surface }];

  return (
    <ModalShell visible={visible} onClose={onClose} theme={theme} eyebrow="HERRAMIENTAS" title="Panel del Explorador">
      <SurfaceCard theme={theme}>
        <Text style={[styles.cardTitle, { color: p.text }]}>◎ Teletransporte</Text>
        <View style={styles.chipRow}>
          {TELEPORT_PRESETS.map((c) => (
            <TouchableOpacity
              key={c.name}
              style={chip}
              activeOpacity={0.8}
              onPress={() => {
                onTeleport(c.lng, c.lat);
                flash(`Teletransporte a ${c.name}.`);
              }}
            >
              <Text style={[styles.chipText, { color: p.text }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            style={[input, styles.flex]}
            value={lat}
            onChangeText={setLat}
            placeholder="Latitud"
            placeholderTextColor={p.subtext}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[input, styles.flex]}
            value={lng}
            onChangeText={setLng}
            placeholder="Longitud"
            placeholderTextColor={p.subtext}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <TouchableOpacity style={[styles.btn, { backgroundColor: p.accent }]} onPress={handleManual} activeOpacity={0.85}>
          <Text style={[styles.btnText, { color: p.onAccent }]}>Ir a coordenadas</Text>
        </TouchableOpacity>
      </SurfaceCard>

      <SurfaceCard theme={theme}>
        <Text style={[styles.cardTitle, { color: p.text }]}>◫ Limpiar Mapa</Text>
        <Text style={[styles.cardText, { color: p.subtext }]}>
          Borra todos los sectores explorados y los contadores del día para empezar desde cero. No se puede deshacer.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: confirmClear ? colors.danger : p.raised, borderColor: colors.danger, borderWidth: 1 }]}
          onPress={handleClear}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: confirmClear ? colors.obsidian : colors.danger }]}>
            {confirmClear ? 'Toca de nuevo para confirmar' : 'Limpiar Mapa'}
          </Text>
        </TouchableOpacity>
      </SurfaceCard>

      {message && <Text style={[styles.cardText, { color: p.accent, textAlign: 'center' }]}>{message}</Text>}
    </ModalShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
  cardTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  cardText: { fontSize: fontSize.small, lineHeight: 18 },
  input: {
    minHeight: size.fab,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: fontSize.body,
  },
  btn: {
    minHeight: size.fab,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
});
