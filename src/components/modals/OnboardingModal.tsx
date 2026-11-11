import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MapTheme } from '@/core/theme/mapThemes';
import { requestForegroundStep, requestBackgroundStep } from '@/core/battery/expoProviders';
import { storageService } from '@/services/storage';
import { googleTimelineService } from '@/services/googleTimelineService';

export const ONBOARDING_STORAGE_KEY = '@terramaps_onboarding_completed_v1';

interface OnboardingModalProps {
  visible: boolean;
  onFinish: () => void;
  theme: MapTheme;
  onBonusUnlocked?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  visible,
  onFinish,
  theme,
  onBonusUnlocked,
}) => {
  const [step, setStep] = useState<number>(1);
  const [bonusClaimed, setBonusClaimed] = useState<boolean>(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);
  const [permStep, setPermStep] = useState<'foreground' | 'background' | 'done' | 'denied'>('foreground');

  const isLight = theme.mode === 'light';

  const handleClaimHomeCityBonus = () => {
    const res = googleTimelineService.unlockHomeCityFreeBonus();
    if (res.success) {
      setBonusClaimed(true);
      setBonusMsg(`¡Bono activado! Se iluminaron ${res.unlockedCount} zonas históricas en tu ciudad principal.`);
      onBonusUnlocked?.();
    }
  };

  const handleForegroundPermission = async () => {
    const ok = await requestForegroundStep();
    setPermStep(ok ? 'background' : 'denied');
  };

  const handleBackgroundPermission = async () => {
    const ok = await requestBackgroundStep();
    setPermStep(ok ? 'done' : 'denied');
  };

  const handleComplete = () => {
    try {
      storageService.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // No-op
    }
    onFinish();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleComplete}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isLight ? '#ffffff' : '#0b0f19',
              borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.12)',
            },
          ]}
        >
          {/* Header con indicador de pasos */}
          <View style={styles.header}>
            <View style={styles.stepDotsRow}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        s === step
                          ? theme.accentColor
                          : s < step
                          ? (isLight ? '#94a3b8' : 'rgba(255, 255, 255, 0.4)')
                          : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'),
                      width: s === step ? 22 : 6,
                    },
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity onPress={handleComplete} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                Omitir
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* PASO 1: LA PREMISA */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                      borderColor: isLight ? '#2563eb' : 'rgba(255, 255, 255, 0.15)',
                    },
                  ]}
                >
                  <Text style={[styles.badgeSymbol, { color: theme.accentColor }]}>⚑</Text>
                </View>

                <Text style={[styles.stepSubtitle, { color: theme.accentColor }]}>
                  EXPEDICIÓN EN EL MUNDO REAL
                </Text>
                <Text style={[styles.stepTitle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                  El mundo está oculto bajo un velo.
                </Text>

                <Text style={[styles.stepParagraph, { color: isLight ? '#475569' : '#cbd5e1' }]}>
                  Cada calle, avenida y parque que recorres en tu vida cotidiana despeja la niebla
                  de forma permanente, revelando tu mapa personal de territorio explorado.
                </Text>

                <View
                  style={[
                    styles.infoHighlightBox,
                    {
                      backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                      borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                    },
                  ]}
                >
                  <Text style={[styles.highlightText, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    Tus viajes en automóvil, caminatas, bicicleta y vuelos aéreos se graban de forma
                    diferenciada sin alterar tu privacidad.
                  </Text>
                </View>
              </View>
            )}

            {/* PASO 2: EL BONO DE BIENVENIDA (CIUDAD NATAL) */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)',
                      borderColor: '#10b981',
                    },
                  ]}
                >
                  <Text style={[styles.badgeSymbol, { color: '#10b981' }]}>◎</Text>
                </View>

                <Text style={[styles.stepSubtitle, { color: '#10b981' }]}>
                  BONO EXCLUSIVO DE BIENVENIDA
                </Text>
                <Text style={[styles.stepTitle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                  Desbloquea tu ciudad natal gratis.
                </Text>

                <Text style={[styles.stepParagraph, { color: isLight ? '#475569' : '#cbd5e1' }]}>
                  A través del registro de movilidad de tu dispositivo o historial de Google Maps,
                  iluminamos de inmediato todas las calles y avenidas donde vives o frecuentas.
                </Text>

                <View
                  style={[
                    styles.bonusBox,
                    {
                      backgroundColor: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.06)',
                      borderColor: isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.25)',
                    },
                  ]}
                >
                  <Text style={[styles.bonusTitle, { color: isLight ? '#166534' : '#6ee7b7' }]}>
                    Lo que obtienes de cortesía:
                  </Text>
                  <Text style={[styles.bonusItem, { color: isLight ? '#15803d' : '#a7f3d0' }]}>
                    ✓ 100% de tus calles transitadas en tu ciudad principal.
                  </Text>
                  <Text style={[styles.bonusItem, { color: isLight ? '#15803d' : '#a7f3d0' }]}>
                    ✓ Desbloqueo de avenidas y zonas transitadas en tu área local habitual.
                  </Text>
                  <Text style={[styles.bonusNote, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Tus viajes foráneos a otras ciudades, carreteras y playas quedarán registrados
                    esperando para cuando decidas desbloquear Terra Pro.
                  </Text>

                  {!bonusClaimed ? (
                    <TouchableOpacity
                      style={[styles.claimBonusBtn, { backgroundColor: '#10b981' }]}
                      onPress={handleClaimHomeCityBonus}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.claimBonusBtnText}>Reclamar Bono de Ciudad Natal</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.bonusClaimedTag}>
                      <Text style={styles.bonusClaimedText}>✓ Bono activado en tu mapa</Text>
                    </View>
                  )}
                </View>

                {bonusMsg && <Text style={styles.bonusSuccessMsg}>{bonusMsg}</Text>}
              </View>
            )}

            {/* PASO 3: EXPLORACIÓN EN SEGUNDO PLANO Y BATERÍA */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: isLight ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                      borderColor: '#38bdf8',
                    },
                  ]}
                >
                  <Text style={[styles.badgeSymbol, { color: '#38bdf8' }]}>✦</Text>
                </View>

                <Text style={[styles.stepSubtitle, { color: '#38bdf8' }]}>
                  MOTOR BATTERY-SHIELD
                </Text>
                <Text style={[styles.stepTitle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                  Exploración silenciosa y eficiente.
                </Text>

                <Text style={[styles.stepParagraph, { color: isLight ? '#475569' : '#cbd5e1' }]}>
                  Puedes guardar el teléfono en tu bolsillo y caminar con la pantalla apagada.
                  TerraMaps ajusta dinámicamente la precisión de los satélites para consumir menos del 1%
                  de batería durante todo el día.
                </Text>

                <View
                  style={[
                    styles.infoHighlightBox,
                    {
                      backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                      borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                    },
                  ]}
                >
                  <Text style={[styles.highlightText, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    Tus coordenadas nunca salen de tu dispositivo y no se venden a redes de publicidad.
                    Tu mapa es exclusivamente tuyo.
                  </Text>
                </View>

                {Platform.OS !== 'web' && (
                  <View
                    style={[
                      styles.infoHighlightBox,
                      {
                        backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                        borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                      },
                    ]}
                  >
                    <Text style={[styles.permTitle, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                      ◈ Permisos de ubicación
                    </Text>

                    {permStep === 'foreground' && (
                      <>
                        <Text style={[styles.permNote, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                          Paso 1 de 2 · Permite el acceso a tu ubicación mientras usas la app.
                        </Text>
                        <TouchableOpacity
                          style={[styles.permBtn, { borderColor: theme.accentColor }]}
                          onPress={handleForegroundPermission}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.permBtnText, { color: theme.accentColor }]}>
                            › Permitir ubicación
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {permStep === 'background' && (
                      <>
                        <Text style={[styles.permNote, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                          Paso 2 de 2 · Para explorar con la pantalla apagada, elige «Permitir
                          todo el tiempo» en Ajustes. Se mostrará una notificación persistente
                          mientras la expedición esté activa.
                        </Text>
                        <TouchableOpacity
                          style={[styles.permBtn, { borderColor: theme.accentColor }]}
                          onPress={handleBackgroundPermission}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.permBtnText, { color: theme.accentColor }]}>
                            › Permitir en segundo plano
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {permStep === 'done' && (
                      <Text style={[styles.permNote, { color: '#10b981' }]}>
                        ◎ Seguimiento en segundo plano habilitado.
                      </Text>
                    )}

                    {permStep === 'denied' && (
                      <Text style={[styles.permNote, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                        Permiso no concedido. La exploración funcionará solo con la app abierta;
                        puedes habilitarlo luego en Ajustes.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Botones de Navegación Inferiores */}
          <View style={styles.footerRow}>
            {step > 1 && (
              <TouchableOpacity
                style={[
                  styles.backBtn,
                  {
                    backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
                    borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)',
                  },
                ]}
                onPress={() => setStep(step - 1)}
                activeOpacity={0.8}
              >
                <Text style={[styles.backBtnText, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                  Atrás
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: theme.accentColor },
                step === 1 && { flex: 1 },
              ]}
              onPress={() => {
                if (step < 3) {
                  setStep(step + 1);
                } else {
                  handleComplete();
                }
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: isLight ? '#ffffff' : '#0b0f19' },
                ]}
              >
                {step === 3 ? 'Comenzar Expedición' : 'Continuar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepDotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepDot: {
    height: 6,
    borderRadius: 3,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentScroll: {
    maxHeight: 420,
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  badgeSymbol: {
    fontSize: 22,
    fontWeight: '800',
  },
  stepSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  stepParagraph: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  infoHighlightBox: {
    width: '100%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  highlightText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '500',
  },
  bonusBox: {
    width: '100%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  bonusTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  bonusItem: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  bonusNote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  claimBonusBtn: {
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  claimBonusBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  bonusClaimedTag: {
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    marginTop: 4,
  },
  bonusClaimedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  bonusSuccessMsg: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 8,
    textAlign: 'center',
  },
  permTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  permNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  permBtn: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  backBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 2,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
