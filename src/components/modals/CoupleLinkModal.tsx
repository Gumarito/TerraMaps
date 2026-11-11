import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import type { MapTheme } from '@/core/theme/mapThemes';
import type { TrackedPartner } from '@/services/partnerRadarService';
import { coupleLinkService, type CoupleLinkState } from '@/services/coupleLinkService';
import { ModalShell, SurfaceCard, modalPalette } from '../ui/ModalShell';
import { fontSize, fontWeight, radius, size, space } from '@/theme/tokens';

interface CoupleLinkModalProps {
  visible: boolean;
  onClose: () => void;
  theme?: MapTheme;
  /** Pareja en vivo (solo se usa cuando el vínculo está activo). */
  partner?: TrackedPartner | null;
  distanceText?: string | null;
}

function useCoupleState(): CoupleLinkState {
  const [state, setState] = useState<CoupleLinkState>(() => coupleLinkService.getState());
  useEffect(() => coupleLinkService.subscribe(setState), []);
  return state;
}

function formatRemaining(expiresAt: number | null, now: number): string {
  if (!expiresAt) return '';
  const secs = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

export const CoupleLinkModal: React.FC<CoupleLinkModalProps> = ({ visible, onClose, theme, partner, distanceText }) => {
  const p = modalPalette(theme);
  const state = useCoupleState();
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state.status !== 'invite_sent' && state.status !== 'awaiting_consent') return;
    const id = setInterval(() => {
      setNow(Date.now());
      coupleLinkService.getState(); // expira el PIN si corresponde
    }, 1000);
    return () => clearInterval(id);
  }, [state.status]);

  const primaryBtn = [styles.btn, { backgroundColor: p.accent }];
  const ghostBtn = [styles.btn, { backgroundColor: p.raised, borderColor: p.border, borderWidth: 1 }];

  const handleRequest = () => {
    const res = coupleLinkService.requestLink(pinInput);
    setError(res.ok ? null : res.error ?? 'PIN inválido.');
    if (res.ok) setPinInput('');
  };

  return (
    <ModalShell visible={visible} onClose={onClose} theme={theme} eyebrow="CONSENTIMIENTO MUTUO" title="Vínculo de Pareja">
      {state.status === 'unlinked' && (
        <>
          <SurfaceCard theme={theme}>
            <Text style={[styles.cardTitle, { color: p.text }]}>◈ Genera tu PIN</Text>
            <Text style={[styles.cardText, { color: p.subtext }]}>
              Comparte un PIN de 6 dígitos con tu pareja. Caduca en 10 minutos y ambos deben confirmar el vínculo.
            </Text>
            <TouchableOpacity style={primaryBtn} onPress={() => coupleLinkService.createInvite()} activeOpacity={0.85}>
              <Text style={[styles.btnText, { color: p.onAccent }]}>Generar PIN</Text>
            </TouchableOpacity>
          </SurfaceCard>

          <SurfaceCard theme={theme}>
            <Text style={[styles.cardTitle, { color: p.text }]}>◫ Tengo un PIN</Text>
            <TextInput
              style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.surface }]}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="000000"
              placeholderTextColor={p.subtext}
              keyboardType="number-pad"
              maxLength={6}
            />
            {error && <Text style={[styles.cardText, { color: '#f87171' }]}>{error}</Text>}
            <TouchableOpacity style={ghostBtn} onPress={handleRequest} activeOpacity={0.85}>
              <Text style={[styles.btnText, { color: p.text }]}>Enlazar</Text>
            </TouchableOpacity>
          </SurfaceCard>
        </>
      )}

      {state.status === 'invite_sent' && (
        <SurfaceCard theme={theme}>
          <Text style={[styles.eyebrow, { color: p.subtext }]}>PIN DE INVITACIÓN</Text>
          <Text style={[styles.pin, { color: p.accent }]}>{state.pin}</Text>
          <Text style={[styles.cardText, { color: p.subtext }]}>
            Expira en {formatRemaining(state.pinExpiresAt, now)}. Tu pareja debe introducirlo en su app.
          </Text>
          <TouchableOpacity style={primaryBtn} onPress={() => coupleLinkService.confirmConsent()} activeOpacity={0.85}>
            <Text style={[styles.btnText, { color: p.onAccent }]}>Mi pareja ya lo introdujo · Confirmar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ghostBtn} onPress={() => coupleLinkService.cancel()} activeOpacity={0.85}>
            <Text style={[styles.btnText, { color: p.text }]}>Cancelar</Text>
          </TouchableOpacity>
        </SurfaceCard>
      )}

      {state.status === 'awaiting_consent' && (
        <SurfaceCard theme={theme}>
          <Text style={[styles.cardTitle, { color: p.text }]}>Solicitud de vínculo</Text>
          <Text style={[styles.cardText, { color: p.subtext }]}>
            Al aceptar, tu pareja verá tu ubicación en vivo{state.shareBattery ? ' y el nivel de tu batería' : ''}, y tú la suya.
            Puedes desvincular en cualquier momento.
          </Text>
          <TouchableOpacity style={primaryBtn} onPress={() => coupleLinkService.confirmConsent()} activeOpacity={0.85}>
            <Text style={[styles.btnText, { color: p.onAccent }]}>Acepto compartir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ghostBtn} onPress={() => coupleLinkService.cancel()} activeOpacity={0.85}>
            <Text style={[styles.btnText, { color: p.text }]}>Rechazar</Text>
          </TouchableOpacity>
        </SurfaceCard>
      )}

      {state.status === 'linked' && (
        <>
          <SurfaceCard theme={theme}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: p.accent }]}>
                <Text style={[styles.avatarText, { color: p.onAccent }]}>{(partner?.name ?? 'P').charAt(0)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: p.text }]}>{partner?.name ?? 'Pareja vinculada'}</Text>
                <Text style={[styles.cardText, { color: p.subtext }]}>
                  {partner ? `${partner.lastUpdatedText} · ${partner.addressName}` : 'Sin señal reciente'}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          <View style={styles.row}>
            <SurfaceCard theme={theme} style={styles.flex}>
              <Text style={[styles.eyebrow, { color: p.subtext }]}>BATERÍA</Text>
              <Text style={[styles.metric, { color: p.text }]}>
                {partner ? `${partner.batteryPercent}%${partner.isCharging ? ' · cargando' : ''}` : '—'}
              </Text>
            </SurfaceCard>
            <SurfaceCard theme={theme} style={styles.flex}>
              <Text style={[styles.eyebrow, { color: p.subtext }]}>DISTANCIA</Text>
              <Text style={[styles.metric, { color: p.text }]}>{distanceText ?? '—'}</Text>
            </SurfaceCard>
          </View>

          <SurfaceCard theme={theme}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: p.text }]}>Compartir mi batería</Text>
                <Text style={[styles.cardText, { color: p.subtext }]}>Tu pareja verá tu nivel de carga.</Text>
              </View>
              <Switch
                value={state.shareBattery}
                onValueChange={(v) => coupleLinkService.setShareBattery(v)}
                trackColor={{ true: p.accent, false: p.border }}
              />
            </View>
          </SurfaceCard>

          <TouchableOpacity style={ghostBtn} onPress={() => coupleLinkService.unlink()} activeOpacity={0.85}>
            <Text style={[styles.btnText, { color: '#f87171' }]}>Desvincular pareja</Text>
          </TouchableOpacity>
        </>
      )}
    </ModalShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  cardText: { fontSize: fontSize.small, lineHeight: 18 },
  eyebrow: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, letterSpacing: 1 },
  pin: { fontSize: 40, fontWeight: fontWeight.bold, letterSpacing: 8, textAlign: 'center', paddingVertical: space.md },
  metric: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
  input: {
    minHeight: size.fab + 2,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: fontSize.title,
    letterSpacing: 4,
    textAlign: 'center',
  },
  btn: {
    minHeight: size.fab + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
  avatar: { width: size.fab + 6, height: size.fab + 6, borderRadius: (size.fab + 6) / 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
});
