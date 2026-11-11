import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Share,
  Platform,
  ScrollView,
} from 'react-native';
import { UserStats } from '@/services/storage';
import { monetizationService } from '@/services/monetizationService';
import { analyticsDatabaseService } from '@/services/analyticsDatabaseService';

interface SocialShareModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
  username?: string;
  stats: UserStats;
  currentHexId: string | null;
  kingTitle?: string;
  streakDays?: number;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  visible,
  onClose,
  accentColor = '#10b981',
  username = 'Explorador',
  stats,
  currentHexId,
  kingTitle = 'Pionero Urbano',
  streakDays = 1,
}) => {
  const isProUser = monetizationService.isPro();
  const [isUnlockedViaAd, setIsUnlockedViaAd] = useState<boolean>(false);
  const [isPlayingAd, setIsPlayingAd] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(5);
  const [copied, setCopied] = useState<boolean>(false);

  const isUnlocked = isProUser || isUnlockedViaAd;

  // Cálculos realistas de Flex / Presunción de Viajes
  const totalKm2 = stats.totalAreaKm2;
  const worldPercent = (totalKm2 / 510072000) * 100;
  const mexicoPercent = (totalKm2 / 1972550) * 100;
  const cdmxPercent = (totalKm2 / 1485) * 100;
  const citiesCount = Math.max(1, Math.floor(stats.explorationLevel / 2));
  const estimatedCalories = Math.round(stats.totalHexagons * 18.5);
  const flightKm = (stats as any).flightKm || Math.round(stats.explorationLevel * 240);

  const worldDisplay = worldPercent < 0.0001 ? `${worldPercent.toFixed(6)}%` : `${worldPercent.toFixed(4)}%`;
  const mexicoDisplay = mexicoPercent < 0.001 ? `${mexicoPercent.toFixed(4)}%` : `${mexicoPercent.toFixed(2)}%`;

  const storyShareText = `🗺️ He conquistado el ${mexicoDisplay} de México en TerraMaps este mes (${stats.formattedArea || `${totalKm2.toFixed(2)} km²`}). 🔥 ${streakDays} días explorando y ${estimatedCalories} kcal quemadas. ¿Cuánto de tu ciudad has descubierto? https://terramaps.app`;

  const handleWatchRewardedAd = () => {
    setIsPlayingAd(true);
    setAdCountdown(5);

    analyticsDatabaseService.recordMonetizationEvent({
      eventName: 'REWARDED_AD_WATCHED',
      grossAmountUsd: 0.02, // eCPM estimado de $20 USD
    });

    const interval = setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsPlayingAd(false);
          setIsUnlockedViaAd(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleShareToChannel = async (channel: 'whatsapp' | 'instagram' | 'general') => {
    if (!isUnlocked) {
      handleWatchRewardedAd();
      return;
    }

    try {
      if (channel === 'whatsapp' && Platform.OS === 'web') {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(storyShareText)}`;
        window.open(url, '_blank');
        return;
      }

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: 'TerraMaps — Historia de Viajes y Conquista',
          text: storyShareText,
          url: 'https://terramaps.app',
        });
      } else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(storyShareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        await Share.share({
          message: storyShareText,
          title: 'TerraMaps — Conquista Territorial',
        });
      }
    } catch {
      // Ignorar cancelación del diálogo nativo
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerBadge}>📱 HISTORIAS DE INSTAGRAM & WHATSAPP</Text>
              <Text style={styles.title}>Presume tus Viajes</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Tarjeta Vertical Proporción 9:16 Estilo Instagram Story */}
            <View style={styles.storyCardContainer}>
              <View style={styles.storyCardInner}>
                {/* Branding Top */}
                <View style={styles.storyBrandRow}>
                  <View style={styles.brandGroup}>
                    <View style={[styles.brandDot, { backgroundColor: accentColor }]} />
                    <Text style={styles.brandName}>TerraMaps</Text>
                  </View>
                  <View style={styles.badgeProCapsule}>
                    <Text style={styles.badgeProText}>{isProUser ? '💎 PRO' : 'EXPEDITION'}</Text>
                  </View>
                </View>

                {/* Perfil del Explorador */}
                <View style={styles.storyProfileRow}>
                  <View style={[styles.storyAvatar, { borderColor: accentColor }]}>
                    <Text style={styles.storyAvatarText}>
                      {username.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.storyUsername}>@{username}</Text>
                    <Text style={styles.storyRank}>{kingTitle} • Racha {streakDays}d</Text>
                  </View>
                </View>

                {/* Gran Métrica Central de Presunción */}
                <View style={styles.heroFlexCard}>
                  <Text style={styles.heroFlexSubtitle}>CONQUISTA TERRITORIAL ESTE MES</Text>
                  <Text style={styles.heroFlexBigNumber}>{stats.formattedArea || `${totalKm2.toFixed(2)} km²`}</Text>
                  <View style={styles.heroComparisonPill}>
                    <Text style={styles.heroComparisonText}>
                      🇲🇽 {mexicoDisplay} de México • 🌍 {worldDisplay} del Mundo
                    </Text>
                  </View>
                </View>

                {/* Grid 2x2 de Estadísticas Flex */}
                <View style={styles.flexGrid}>
                  <View style={styles.flexStatBox}>
                    <Text style={styles.flexStatEmoji}>🏙️</Text>
                    <Text style={styles.flexStatVal}>{citiesCount} {citiesCount === 1 ? 'Ciudad' : 'Ciudades'}</Text>
                    <Text style={styles.flexStatLbl}>Exploradas</Text>
                  </View>

                  <View style={styles.flexStatBox}>
                    <Text style={styles.flexStatEmoji}>🔥</Text>
                    <Text style={styles.flexStatVal}>{estimatedCalories} kcal</Text>
                    <Text style={styles.flexStatLbl}>Quemadas a pie</Text>
                  </View>

                  <View style={styles.flexStatBox}>
                    <Text style={styles.flexStatEmoji}>✈️</Text>
                    <Text style={styles.flexStatVal}>{flightKm} km</Text>
                    <Text style={styles.flexStatLbl}>En vuelos aéreos</Text>
                  </View>

                  <View style={styles.flexStatBox}>
                    <Text style={styles.flexStatEmoji}>🗺️</Text>
                    <Text style={styles.flexStatVal}>{stats.totalHexagons}</Text>
                    <Text style={styles.flexStatLbl}>Sectores revelados</Text>
                  </View>
                </View>

                {/* Footer de la Historia */}
                <View style={styles.storyFooter}>
                  <Text style={styles.storyFooterUrl}>terramaps.app • Descubre tu ciudad sin niebla</Text>
                </View>

                {/* Velo de Bloqueo si NO está desbloqueado */}
                {!isUnlocked && (
                  <View style={styles.lockedOverlay}>
                    <Text style={styles.lockedEmoji}>🔒</Text>
                    <Text style={styles.lockedTitle}>Historia en Alta Calidad</Text>
                    <Text style={styles.lockedSubtitle}>
                      Desbloquea gratis con 1 video corto para subir a Instagram Stories, WhatsApp y Facebook.
                    </Text>

                    <TouchableOpacity
                      style={styles.watchAdBtn}
                      onPress={handleWatchRewardedAd}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.watchAdBtnText}>🎬 Ver Anuncio de 5s (Desbloqueo Gratis)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Modal de Reproducción de Video Patrocinado Simulado */}
            {isPlayingAd && (
              <View style={styles.adPlaybackOverlay}>
                <View style={styles.adBox}>
                  <View style={styles.adHeader}>
                    <Text style={styles.adBadge}>ANUNCIO PATROCINADO</Text>
                    <Text style={styles.adCountdownText}>Cerrando en {adCountdown}s</Text>
                  </View>
                  <View style={styles.adCreativeArea}>
                    <Text style={styles.adIcon}>🏔️</Text>
                    <Text style={styles.adSponsorTitle}>TerraMaps Haute Expedition Gear</Text>
                    <Text style={styles.adSponsorDesc}>
                      Indumentaria y equipo de exploración urbana resistente a condiciones extremas.
                    </Text>
                  </View>
                  <View style={styles.adProgressTrack}>
                    <View style={[styles.adProgressFill, { width: `${((5 - adCountdown) / 5) * 100}%` }]} />
                  </View>
                </View>
              </View>
            )}

            {/* Botones de Compartir en Redes Sociales */}
            <View style={styles.shareButtonsGroup}>
              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: '#25d366' }]}
                onPress={() => handleShareToChannel('whatsapp')}
                activeOpacity={0.85}
              >
                <Text style={styles.socialShareBtnText}>💬 Estado de WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: '#e1306c' }]}
                onPress={() => handleShareToChannel('instagram')}
                activeOpacity={0.85}
              >
                <Text style={styles.socialShareBtnText}>📸 Historia de Instagram</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: '#1877f2' }]}
                onPress={() => handleShareToChannel('general')}
                activeOpacity={0.85}
              >
                <Text style={styles.socialShareBtnText}>
                  {copied ? '✅ ¡Copiado al Portapapeles!' : '📘 Facebook / Más Redes'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    backgroundColor: '#0a0d16',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerBadge: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollBody: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  storyCardContainer: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#05070a',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  storyCardInner: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
  },
  storyBrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brandName: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  badgeProCapsule: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeProText: {
    color: '#fef08a',
    fontSize: 9,
    fontWeight: '800',
  },
  storyProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  storyAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  storyUsername: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  storyRank: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  heroFlexCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  heroFlexSubtitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroFlexBigNumber: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroComparisonPill: {
    marginTop: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroComparisonText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '700',
  },
  flexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flexStatBox: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  flexStatEmoji: {
    fontSize: 14,
    marginBottom: 2,
  },
  flexStatVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  flexStatLbl: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '600',
  },
  storyFooter: {
    alignItems: 'center',
    marginTop: 6,
  },
  storyFooterUrl: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 7, 12, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
  },
  lockedEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  lockedTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  lockedSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  watchAdBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  watchAdBtnText: {
    color: '#05070a',
    fontSize: 11,
    fontWeight: '900',
  },
  adPlaybackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 100,
  },
  adBox: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 18,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  adBadge: {
    color: '#eab308',
    fontSize: 9,
    fontWeight: '800',
  },
  adCountdownText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
  },
  adCreativeArea: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  adIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  adSponsorTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  adSponsorDesc: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  adProgressTrack: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    marginTop: 14,
    overflow: 'hidden',
  },
  adProgressFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  shareButtonsGroup: {
    width: '100%',
    gap: 8,
  },
  socialShareBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  socialShareBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
