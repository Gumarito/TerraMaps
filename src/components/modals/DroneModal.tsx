import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { monetizationService, DRONE_COOLDOWN_MS } from '@/services/monetizationService';
import { adService } from '@/services/adService';

export interface DroneModalProps {
  visible: boolean;
  onClose: () => void;
  onDeploy: (kRing: number) => void | Promise<void>;
  accentColor?: string;
  cooldownSeconds?: number;
  currentCoords?: [number, number]; // [lng, lat]
}

const { width } = Dimensions.get('window');
const RADAR_SIZE = Math.min(width - 80, 240);

export const DroneModal: React.FC<DroneModalProps> = ({
  visible,
  onClose,
  onDeploy,
  accentColor = '#00f5d4',
  cooldownSeconds,
  currentCoords = [-99.1332, 19.4326],
}) => {
  // Configuración de K-Ring: 2 (táctico estándar) o 3 (largo alcance)
  const [selectedKRing, setSelectedKRing] = useState<number>(2);
  const [remainingCooldown, setRemainingCooldown] = useState<number>(0);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isWatchingAd, setIsWatchingAd] = useState<boolean>(false);

  // Animaciones tácticas
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const blipAnim = useRef(new Animated.Value(0.2)).current;

  // Radar sweep animation loop
  useEffect(() => {
    let sweepLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;
    let blipLoop: Animated.CompositeAnimation | null = null;

    if (visible) {
      // Rotación continua del haz del radar (3.2 segundos por ciclo completo)
      rotateAnim.setValue(0);
      sweepLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3200,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      sweepLoop.start();

      // Pulso concéntrico
      pulseAnim.setValue(1);
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      pulseLoop.start();

      // Parpadeo de objetivos detectados en radar
      blipAnim.setValue(0.2);
      blipLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(blipAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(blipAnim, {
            toValue: 0.2,
            duration: 900,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      blipLoop.start();
    }

    return () => {
      sweepLoop?.stop();
      pulseLoop?.stop();
      blipLoop?.stop();
    };
  }, [visible, rotateAnim, pulseAnim, blipAnim]);

  // Sincronización del temporizador de enfriamiento
  useEffect(() => {
    if (!visible) return;

    if (cooldownSeconds !== undefined) {
      setRemainingCooldown(cooldownSeconds);
    } else {
      const remainingMs = monetizationService.getRemainingCooldownMs();
      setRemainingCooldown(Math.ceil(remainingMs / 1000));
    }
  }, [visible, cooldownSeconds]);

  // Contador regresivo en tiempo real
  useEffect(() => {
    if (!visible || remainingCooldown <= 0) return;

    const timer = setInterval(() => {
      setRemainingCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, remainingCooldown]);

  const isReady = remainingCooldown <= 0 && !isDeploying && !isWatchingAd;
  const isTerraPro = monetizationService.isTerraPro();

  // Formato HH:MM:SS o MM:SS
  const formatTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const handleLaunch = async () => {
    if (!isReady && !isTerraPro) return;

    setIsDeploying(true);
    try {
      await onDeploy(selectedKRing);
    } finally {
      setIsDeploying(false);
      onClose();
    }
  };

  const handleWatchAd = async () => {
    setIsWatchingAd(true);
    try {
      const result = await adService.requestRewardedAd('drone');
      if (result.success) {
        await onDeploy(selectedKRing);
        onClose();
      }
    } finally {
      setIsWatchingAd(false);
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Métricas según el k-ring seleccionado
  const kRingConfig = {
    2: {
      name: 'PULSO TÁCTICO RECON',
      radiusMeters: 350,
      hexCount: 19,
      areaKm2: '1.95',
      signalRange: 'ALTO (ÓPTIMO)',
    },
    3: {
      name: 'BARRIDO ORBITAL AMPLIO',
      radiusMeters: 550,
      hexCount: 37,
      areaKm2: '3.89',
      signalRange: 'EXTREMO (MÁX)',
    },
  }[selectedKRing as 2 | 3];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: `${accentColor}40` }]}>
          {/* Header Cyberpunk */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isReady || isTerraPro ? '#10b981' : '#ffb703' },
                  ]}
                />
                <Text style={styles.systemTag}>SYS.DRONE // RECON-MK3</Text>
              </View>
              <Text style={[styles.title, { color: accentColor }]}>🛸 DRON DE EXPLORACIÓN</Text>
              <Text style={styles.subtitle}>Despliegue aéreo de escaneo de niebla territorial</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Visual interactiva de Escáner / Radar */}
            <View style={styles.radarWrapper}>
              <Animated.View
                style={[
                  styles.radarCircle,
                  {
                    width: RADAR_SIZE,
                    height: RADAR_SIZE,
                    borderRadius: RADAR_SIZE / 2,
                    borderColor: `${accentColor}40`,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                {/* Anillos concéntricos de k-ring */}
                <View
                  style={[
                    styles.ringInner,
                    {
                      width: RADAR_SIZE * 0.4,
                      height: RADAR_SIZE * 0.4,
                      borderRadius: (RADAR_SIZE * 0.4) / 2,
                      borderColor: `${accentColor}30`,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.ringInner,
                    {
                      width: RADAR_SIZE * 0.7,
                      height: RADAR_SIZE * 0.7,
                      borderRadius: (RADAR_SIZE * 0.7) / 2,
                      borderColor: selectedKRing === 2 ? accentColor : `${accentColor}30`,
                      borderWidth: selectedKRing === 2 ? 1.5 : 1,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.ringInner,
                    {
                      width: RADAR_SIZE * 0.96,
                      height: RADAR_SIZE * 0.96,
                      borderRadius: (RADAR_SIZE * 0.96) / 2,
                      borderColor: selectedKRing === 3 ? '#ffb703' : `${accentColor}20`,
                      borderWidth: selectedKRing === 3 ? 1.5 : 1,
                    },
                  ]}
                />

                {/* Retículas y Ejes en cruz */}
                <View style={[styles.axisLine, styles.axisH, { backgroundColor: `${accentColor}25` }]} />
                <View style={[styles.axisLine, styles.axisV, { backgroundColor: `${accentColor}25` }]} />

                {/* Coordenadas tácticas en esquinas del radar */}
                <Text style={[styles.radarCornerText, styles.rTop]}>N 000°</Text>
                <Text style={[styles.radarCornerText, styles.rRight]}>E 090°</Text>
                <Text style={[styles.radarCornerText, styles.rBottom]}>S 180°</Text>
                <Text style={[styles.radarCornerText, styles.rLeft]}>W 270°</Text>

                {/* Marcadores / Blips de Hexágonos detectados */}
                <Animated.View
                  style={[
                    styles.radarBlip,
                    {
                      top: RADAR_SIZE * 0.28,
                      right: RADAR_SIZE * 0.3,
                      backgroundColor: accentColor,
                      opacity: blipAnim,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.radarBlip,
                    {
                      bottom: RADAR_SIZE * 0.26,
                      left: RADAR_SIZE * 0.25,
                      backgroundColor: '#ffb703',
                      opacity: blipAnim,
                    },
                  ]}
                />

                {/* Haz rotativo del radar */}
                <Animated.View
                  style={[
                    styles.radarSweep,
                    {
                      width: RADAR_SIZE / 2,
                      height: 2,
                      backgroundColor: accentColor,
                      shadowColor: accentColor,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.9,
                      shadowRadius: 8,
                      transform: [
                        { translateX: RADAR_SIZE / 4 },
                        { rotate: spin },
                        { translateX: -RADAR_SIZE / 4 },
                      ],
                    },
                  ]}
                />

                {/* Centro del radar (Posición del operador) */}
                <View style={[styles.radarCenter, { backgroundColor: accentColor }]}>
                  <View style={styles.radarCenterPulse} />
                </View>
              </Animated.View>

              {/* Telemetría del operador */}
              <View style={styles.telemetryBar}>
                <Text style={styles.telemetryText}>
                  GPS: {currentCoords[1].toFixed(4)}, {currentCoords[0].toFixed(4)} | ALT: 45m | FREQ: 5.8 GHz
                </Text>
              </View>
            </View>

            {/* Indicador de Estado: Listo vs Cooldown */}
            <View
              style={[
                styles.statusContainer,
                {
                  borderColor:
                    isReady || isTerraPro ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 183, 3, 0.4)',
                  backgroundColor:
                    isReady || isTerraPro ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 183, 3, 0.08)',
                },
              ]}
            >
              <View style={styles.statusInfoRow}>
                <View>
                  <Text style={styles.statusHeaderLabel}>ESTADO DE HANGAR</Text>
                  <Text
                    style={[
                      styles.statusTitle,
                      { color: isReady || isTerraPro ? '#10b981' : '#ffb703' },
                    ]}
                  >
                    {isDeploying
                      ? '⚡ DESPLEGANDO VECTOR...'
                      : isWatchingAd
                      ? '📺 CONECTANDO ENLACE PATROCINADO...'
                      : isTerraPro
                      ? '⭐ DRON TERRA PRO (VUELO ILIMITADO)'
                      : isReady
                      ? '⚡ SISTEMA LISTO (VUELO GRATUITO)'
                      : `⏳ ENFRIAMIENTO ACTIVO: ${formatTime(remainingCooldown)}`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadgePill,
                    { borderColor: isReady || isTerraPro ? '#10b981' : '#ffb703' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgePillText,
                      { color: isReady || isTerraPro ? '#10b981' : '#ffb703' },
                    ]}
                  >
                    {isReady || isTerraPro ? 'DISPONIBLE' : 'ENFRIAMIENTO'}
                  </Text>
                </View>
              </View>

              {/* Barra de progreso de recarga */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        isReady || isTerraPro
                          ? '100%'
                          : `${Math.max(
                              4,
                              ((DRONE_COOLDOWN_MS / 1000 - remainingCooldown) /
                                (DRONE_COOLDOWN_MS / 1000)) *
                                100
                            )}%`,
                      backgroundColor: isReady || isTerraPro ? '#10b981' : '#ffb703',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Selector de Potencia / Radio K-Ring */}
            <Text style={styles.sectionHeader}>ALCANCE DE BARRIDO SÓNICO (K-RING)</Text>
            <View style={styles.kRingSelectorRow}>
              {/* Opción K-Ring = 2 */}
              <TouchableOpacity
                style={[
                  styles.kRingCard,
                  selectedKRing === 2 && [styles.kRingCardSelected, { borderColor: accentColor }],
                ]}
                onPress={() => setSelectedKRing(2)}
                activeOpacity={0.8}
              >
                <View style={styles.kRingHeader}>
                  <Text style={[styles.kRingBadge, selectedKRing === 2 && { color: accentColor }]}>
                    K-RING 2
                  </Text>
                  {selectedKRing === 2 && <Text style={{ color: accentColor }}>●</Text>}
                </View>
                <Text style={styles.kRingTitle}>TÁCTICO REGULAR</Text>
                <Text style={styles.kRingStat}>📡 Radio: ~350m</Text>
                <Text style={styles.kRingStat}>🔷 19 Hexágonos</Text>
                <Text style={styles.kRingStat}>🗺️ ~1.95 km²</Text>
              </TouchableOpacity>

              {/* Opción K-Ring = 3 */}
              <TouchableOpacity
                style={[
                  styles.kRingCard,
                  selectedKRing === 3 && [styles.kRingCardSelected, { borderColor: '#ffb703' }],
                ]}
                onPress={() => setSelectedKRing(3)}
                activeOpacity={0.8}
              >
                <View style={styles.kRingHeader}>
                  <Text style={[styles.kRingBadge, selectedKRing === 3 && { color: '#ffb703' }]}>
                    K-RING 3
                  </Text>
                  {selectedKRing === 3 && <Text style={{ color: '#ffb703' }}>●</Text>}
                </View>
                <Text style={styles.kRingTitle}>ALCANCE AMPLIO</Text>
                <Text style={styles.kRingStat}>📡 Radio: ~550m</Text>
                <Text style={styles.kRingStat}>🔷 37 Hexágonos</Text>
                <Text style={styles.kRingStat}>🗺️ ~3.89 km²</Text>
              </TouchableOpacity>
            </View>

            {/* Ficha técnica del despliegue */}
            <View style={styles.techDetailsCard}>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>MODO SELECCIONADO:</Text>
                <Text style={[styles.techValue, { color: selectedKRing === 2 ? accentColor : '#ffb703' }]}>
                  {kRingConfig.name}
                </Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>COBERTURA ESTIMADA:</Text>
                <Text style={styles.techValue}>
                  {kRingConfig.hexCount} hexágonos ({kRingConfig.areaKm2} km²)
                </Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>INTENSIDAD DE SEÑAL:</Text>
                <Text style={styles.techValue}>{kRingConfig.signalRange}</Text>
              </View>
            </View>

            {/* Botón de Lanzamiento Primario */}
            {isReady || isTerraPro ? (
              <TouchableOpacity
                style={[
                  styles.launchBtn,
                  {
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                  },
                ]}
                disabled={isDeploying}
                onPress={handleLaunch}
                activeOpacity={0.85}
              >
                <Text style={styles.launchBtnText}>
                  {isDeploying
                    ? 'TRANSMITIENDO PULSO...'
                    : `🚀 DESPLEGAR DRON (K-RING ${selectedKRing})`}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.cooldownActionsContainer}>
                {/* Opción de anuncio rewarded sin costo para saltar el cooldown */}
                <TouchableOpacity
                  style={[styles.watchAdBtn, { borderColor: '#ffb703' }]}
                  disabled={isWatchingAd}
                  onPress={handleWatchAd}
                  activeOpacity={0.85}
                >
                  <Text style={styles.watchAdBtnText}>
                    {isWatchingAd
                      ? 'CONECTANDO ANUNCIO PATROCINADO...'
                      : `📺 DESPEGAR AHORA (VER CORTO PATROCINADO)`}
                  </Text>
                  <Text style={styles.watchAdSub}>Sin costo monetario // Recompensa inmediata</Text>
                </TouchableOpacity>

                <View style={styles.cooldownWaitPill}>
                  <Text style={styles.cooldownWaitText}>
                    O espera el enfriamiento: {formatTime(remainingCooldown)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>CANCELAR OPERACIÓN</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#0b0f19',
    borderRadius: 22,
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  systemTag: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  radarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  radarCircle: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ringInner: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  axisLine: {
    position: 'absolute',
  },
  axisH: {
    width: '100%',
    height: 1,
  },
  axisV: {
    height: '100%',
    width: 1,
  },
  radarCornerText: {
    position: 'absolute',
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  rTop: { top: 6 },
  rRight: { right: 6 },
  rBottom: { bottom: 6 },
  rLeft: { left: 6 },
  radarBlip: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  radarSweep: {
    position: 'absolute',
    borderRadius: 1,
  },
  radarCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarCenterPulse: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  telemetryBar: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  telemetryText: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  statusContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  statusInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusHeaderLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  sectionHeader: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  kRingSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  kRingCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  kRingCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  kRingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kRingBadge: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  kRingTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  kRingStat: {
    color: '#94a3b8',
    fontSize: 10,
    marginVertical: 1,
  },
  techDetailsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  techLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
  },
  techValue: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  launchBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  launchBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cooldownActionsContainer: {
    gap: 8,
  },
  watchAdBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 183, 3, 0.12)',
  },
  watchAdBtnText: {
    color: '#ffb703',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  watchAdSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
  },
  cooldownWaitPill: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cooldownWaitText: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
