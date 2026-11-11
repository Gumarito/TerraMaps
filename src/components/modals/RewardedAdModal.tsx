import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { adService, AdRewardState } from '../../services/adService';
import { audioFeedback } from '../../utils/audioFeedback';

interface RewardedAdModalProps {
  accentColor?: string;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  accentColor = '#00f5d4',
}) => {
  const [adState, setAdState] = useState<AdRewardState>(adService.getAdState());

  useEffect(() => {
    return adService.subscribe((state) => {
      setAdState(state);
      if (state.secondsRemaining === 1) {
        audioFeedback.playDiscoverySound();
      }
    });
  }, []);

  if (!adState.isShowingAd) {
    return null;
  }

  const getRewardTitle = () => {
    switch (adState.currentRewardType) {
      case 'drone':
        return '⚡ Recarga Express de Dron Explorador';
      case 'theme':
        return '🎨 Desbloqueo de Estilos de Mapa (24h)';
      case 'streak_shield':
        return '🛡️ Escudo Protector de Racha';
      default:
        return '🎁 Recompensa de Exploración';
    }
  };

  return (
    <Modal
      visible={adState.isShowingAd}
      transparent
      animationType="fade"
      onRequestClose={() => adService.cancelAd()}
    >
      <View style={styles.backdrop}>
        <View style={styles.adCard}>
          {/* Header con patrocinador */}
          <View style={styles.topBadgeRow}>
            <View style={styles.sponsorBadge}>
              <Text style={styles.sponsorBadgeText}>PATROCINADO</Text>
            </View>
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>
                Recompensa en {adState.secondsRemaining}s
              </Text>
            </View>
          </View>

          {/* Icono animado y título de recompensa */}
          <View style={styles.contentArea}>
            <View style={[styles.glowRing, { borderColor: accentColor }]}>
              <Text style={styles.mainEmoji}>
                {adState.currentRewardType === 'drone'
                  ? '⚡'
                  : adState.currentRewardType === 'theme'
                  ? '🎨'
                  : '🛡️'}
              </Text>
            </View>

            <Text style={styles.rewardTitle}>{getRewardTitle()}</Text>

            <View style={styles.sponsorInfoCard}>
              <Text style={styles.sponsorName}>{adState.sponsorName}</Text>
              <Text style={styles.sponsorTagline}>{adState.sponsorTagline}</Text>
            </View>

            <View style={styles.loadingRow}>
              <ActivityIndicator color={accentColor} size="small" />
              <Text style={styles.rewardNotice}>
                Mantén la app abierta para recibir tu recompensa
              </Text>
            </View>
          </View>

          {/* Botón de cerrar voluntario con advertencia */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => adService.cancelAd()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Omitir anuncio (sin recompensa)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  adCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sponsorBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sponsorBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timerBadge: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    color: '#00f5d4',
    fontSize: 12,
    fontWeight: '700',
  },
  contentArea: {
    alignItems: 'center',
    marginVertical: 8,
  },
  glowRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 16,
  },
  mainEmoji: {
    fontSize: 32,
  },
  rewardTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  sponsorInfoCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sponsorName: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sponsorTagline: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rewardNotice: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
});
