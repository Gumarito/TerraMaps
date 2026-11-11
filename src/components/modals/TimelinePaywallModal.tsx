import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MapTheme } from '@/core/theme/mapThemes';
import { googleTimelineService, TimelineDetectedStats } from '@/services/googleTimelineService';
import { billingService, type CatalogPrice } from '@/services/billing';
import { useEntitlements } from '@/hooks/useEntitlements';

interface TimelinePaywallModalProps {
  visible: boolean;
  onClose: () => void;
  theme: MapTheme;
  onSuccessRestore?: (unlockedCount: number) => void;
}

export const TimelinePaywallModal: React.FC<TimelinePaywallModalProps> = ({
  visible,
  onClose,
  theme,
  onSuccessRestore,
}) => {
  const isLight = theme.mode === 'light';
  const [stats, setStats] = useState<TimelineDetectedStats>(() => googleTimelineService.getDetectedStats());
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [price, setPrice] = useState<CatalogPrice | null>(null);
  const entitlements = useEntitlements();
  const hasRealData = stats.dataSource === 'takeout';

  // Recargar estadísticas y precio vigente al abrir
  React.useEffect(() => {
    if (!visible) return;
    setStats(googleTimelineService.getDetectedStats());
    setStatusMessage(null);
    let cancelled = false;
    billingService.getCatalog().then((catalog) => {
      if (!cancelled) setPrice(catalog.timeline_lifetime ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const restoreNow = () => {
    const result = googleTimelineService.restoreHistoryToMap();
    setStatusMessage(result.message);
    setStats(googleTimelineService.getDetectedStats());
    if (result.success) {
      onSuccessRestore?.(result.unlockedCount);
      setTimeout(onClose, 2200);
    }
  };

  const handlePrimaryAction = async () => {
    // 1. Sin datos reales no se vende nada: primero importar el archivo.
    if (!hasRealData) {
      handleSelectRealFile();
      return;
    }

    // 2. Ya comprado (en este u otro dispositivo): restaurar directamente.
    if (entitlements.timelineRestore) {
      restoreNow();
      return;
    }

    // 3. Iniciar Stripe Checkout (pago único).
    setIsProcessing(true);
    setStatusMessage('Redirigiendo al pago seguro de Stripe…');
    const result = await billingService.startCheckout('timeline_lifetime');
    if (!result.ok) {
      setIsProcessing(false);
      if (result.code === 'ALREADY_PURCHASED') {
        restoreNow();
      } else {
        setStatusMessage(result.message);
      }
    }
  };

  const primaryLabel = !hasRealData
    ? 'Importar mi historial (Google Takeout)'
    : entitlements.timelineRestore
    ? 'Restaurar mi historial en el mapa'
    : `Recuperar Mi Historia${price ? ` (${price.formatted} ${price.currency.toUpperCase()})` : ''}`;

  const primarySubtext = !hasRealData
    ? 'Se procesa localmente en tu dispositivo'
    : entitlements.timelineRestore
    ? 'Compra verificada • Desbloqueo inmediato'
    : 'Pago único vitalicio • Procesado por Stripe';

  const handleSelectRealFile = () => {
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
          setStatusMessage('El archivo excede el límite de 25MB por seguridad.');
          return;
        }

        setIsProcessing(true);
        setStatusMessage(`Analizando ${file.name}...`);

        const reader = new FileReader();
        reader.onload = (event) => {
          setIsProcessing(false);
          const content = event.target?.result as string;
          if (content) {
            const parseResult = googleTimelineService.parseGoogleTakeoutJson(content);
            setStats(googleTimelineService.getDetectedStats());
            setStatusMessage(parseResult.message);
          }
        };
        reader.onerror = () => {
          setIsProcessing(false);
          setStatusMessage('Error al leer el archivo seleccionado.');
        };
        reader.readAsText(file);
      };
      input.click();
    } else {
      setStatusMessage('La importación del archivo de Google Takeout está disponible en la versión web.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isLight ? '#ffffff' : '#0f172a',
              borderColor: isLight ? '#e2e8f0' : '#1e293b',
            },
          ]}
        >
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>RECUPERACIÓN DE VIAJES</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: isLight ? '#64748b' : '#94a3b8' }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Título Principal Atractivo */}
            <Text style={[styles.title, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
              {hasRealData
                ? `Detectamos ${stats.yearsOfHistory} años de historia en tu Google Maps`
                : 'Recupera tu historial de Google Maps'}
            </Text>
            {!hasRealData && (
              <Text style={[styles.subtitle, { color: isLight ? '#64748b' : '#94a3b8', marginBottom: 8 }]}>
                Las cifras siguientes son una vista previa de ejemplo. Importa tu archivo de Google Takeout para ver tus datos reales.
              </Text>
            )}
            <Text style={[styles.subtitle, { color: isLight ? '#64748b' : '#94a3b8' }]}>
              {stats.isHomeCityUnlocked
                ? `Tu ciudad natal (${stats.homeCityName}) ya está iluminada. Desbloquea tus ${stats.foreignDistanceKm} km de viajes foráneos y vuelos.`
                : 'Recupera tus recorridos, ciudades y recuerdos para que cobren vida en tu mapa personal.'}
            </Text>

            {/* Banner de Estado del Bono de Ciudad Natal */}
            <View
              style={{
                backgroundColor: stats.isHomeCityUnlocked
                  ? (isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.12)')
                  : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)'),
                borderColor: stats.isHomeCityUnlocked ? '#10b981' : (isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'),
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: stats.isHomeCityUnlocked ? '#10b981' : (isLight ? '#0f172a' : '#ffffff') }}>
                  {stats.isHomeCityUnlocked ? '✓ BONO CIUDAD NATAL ACTIVO' : 'BONO DE BIENVENIDA DISPONIBLE'}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '600', color: isLight ? '#64748b' : '#94a3b8' }}>
                  {stats.isHomeCityUnlocked ? `${stats.homeCityHexagons.length} zonas gratis` : 'Gratis'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: isLight ? '#475569' : '#cbd5e1', marginTop: 4 }}>
                {stats.isHomeCityUnlocked
                  ? `Las calles y avenidas donde vives en ${stats.homeCityName} ya están despejadas. El paquete Pro desbloquea tus viajes nacionales e internacionales.`
                  : 'Puedes desbloquear sin costo todas las calles de tu ciudad principal como regalo de bienvenida.'}
              </Text>
            </View>

            {/* Tarjeta de Estadísticas Bloqueadas */}
            <View
              style={[
                styles.statsCard,
                {
                  backgroundColor: isLight ? '#f8fafc' : '#1e293b',
                  borderColor: isLight ? '#e2e8f0' : '#334155',
                },
              ]}
            >
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#00f5d4' }]}>
                    {stats.detectedHexagonsCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Sectores Urbanos
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                    {stats.citiesCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Ciudades
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#38bdf8' }]}>
                    {stats.countriesCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Países
                  </Text>
                </View>
              </View>

              {/* Nube de Ciudades Ocultas */}
              <View style={styles.citiesBox}>
                <Text style={[styles.citiesTitle, { color: isLight ? '#475569' : '#cbd5e1' }]}>
                  Lugares y Ciudades Detectadas:
                </Text>
                <View style={styles.chipsContainer}>
                  {stats.cities.map((city, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.chip,
                        { backgroundColor: isLight ? '#e2e8f0' : '#0f172a' },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: isLight ? '#1e293b' : '#94a3b8' }]}>
                        {city}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Ventajas Clave */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    No empieces desde cero
                  </Text>
                  <Text style={[styles.benefitDesc, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Desbloquea instantáneamente todas las calles y viajes que ya recorriste en tu vida real.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    Conquista Territorios Inmediatos
                  </Text>
                  <Text style={[styles.benefitDesc, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Sube de nivel de golpe y reclama el dominio de los sectores que visitas con frecuencia.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitTextCol}>
                  <Text style={[styles.benefitTitle, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    100% Privado en tu Dispositivo
                  </Text>
                  <Text style={[styles.benefitDesc, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                    Tu historial de ubicación se procesa localmente en tu teléfono y jamás se vende.
                  </Text>
                </View>
              </View>
            </View>

            {statusMessage && (
              <View
                style={[
                  styles.statusAlert,
                  {
                    backgroundColor: stats.isRestored ? '#065f46' : isLight ? '#f1f5f9' : '#1e293b',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusAlertText,
                    { color: stats.isRestored ? '#a7f3d0' : isLight ? '#0f172a' : '#38bdf8' },
                  ]}
                >
                  {statusMessage}
                </Text>
              </View>
            )}

            {/* Botón de Compra / Desbloqueo */}
            {stats.isRestored ? (
              <View style={styles.alreadyRestoredBox}>
                <Text style={styles.alreadyRestoredText}>
                  ¡Tu historial ya está desbloqueado y visible en el mapa!
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
                onPress={handlePrimaryAction}
                disabled={isProcessing}
                activeOpacity={0.88}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                    <Text style={styles.primaryButtonSubtext}>{primarySubtext}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Opciones Secundarias */}
            {!stats.isRestored && (
              <View style={styles.secondaryActions}>
                {hasRealData && (
                  <TouchableOpacity style={styles.textAction} onPress={handleSelectRealFile}>
                    <Text style={[styles.textActionLabel, { color: '#38bdf8' }]}>
                      Cargar otro archivo de historial (Google Takeout .json)
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.textAction}
                  onPress={onClose}
                >
                  <Text style={[styles.textActionLabel, { color: isLight ? '#94a3b8' : '#64748b' }]}>
                    Prefiero seguir explorando a pie
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '88%',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tagBadge: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.35)',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00f5d4',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  statsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLock: {
    fontSize: 14,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  citiesBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
    paddingTop: 12,
  },
  citiesTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  benefitsContainer: {
    marginBottom: 20,
    gap: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusAlert: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusAlertText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#00f5d4',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#00f5d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonSubtext: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.8,
  },
  alreadyRestoredBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  alreadyRestoredText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  secondaryActions: {
    marginTop: 16,
    alignItems: 'center',
    gap: 10,
  },
  textAction: {
    paddingVertical: 6,
  },
  textActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
