import React, { useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { MAP_THEMES, MapTheme } from '@/core/theme/mapThemes';
import { monetizationService } from '@/services/monetizationService';
import { storageService } from '@/services/storage';
import { adService } from '@/services/adService';
import { getThemeLockReason } from '@/services/billing';
import { useEntitlements } from '@/hooks/useEntitlements';

interface ThemeSelectorModalProps {
  visible: boolean;
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onClose: () => void;
  /** Abre el paywall de Terra PRO al tocar una skin prémium bloqueada. */
  onRequestUpgrade?: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  visible,
  currentThemeId,
  onSelectTheme,
  onClose,
  onRequestUpgrade,
}) => {
  const entitlements = useEntitlements();
  const [, setAdUnlockTick] = useState(0);
  const stats = storageService.getStats();
  const skinMap = new Map(monetizationService.getTacticalSkins(stats).map((s) => [s.id, s]));
  const themes = Object.values(MAP_THEMES);
  const anyLocked = themes.some((t) => getThemeLockReason(t.id) !== null);

  const handleUnlockWithAd = async () => {
    const res = await adService.requestRewardedAd('theme');
    if (res.success) {
      setAdUnlockTick((n) => n + 1); // fuerza re-evaluación de bloqueos
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>TEMAS & SKINS DEL MAPA</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            <View style={styles.themesContainer}>
              {themes.map((theme: MapTheme) => {
                const isSelected = theme.id === currentThemeId;
                const lockReason = getThemeLockReason(theme.id);
                const isUnlocked = lockReason === null;
                const lockedDescription =
                  lockReason === 'pro'
                    ? 'Skin exclusiva de Terra PRO. Toca para desbloquear.'
                    : skinMap.get(theme.id)?.unlockCriteriaText || theme.description;

                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.themeItem,
                      isSelected && { borderColor: theme.glowColor, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
                      !isUnlocked && styles.lockedThemeItem,
                    ]}
                    onPress={() => {
                      if (isUnlocked) {
                        onSelectTheme(theme.id);
                        onClose();
                      } else if (lockReason === 'pro' && onRequestUpgrade) {
                        onClose();
                        onRequestUpgrade();
                      }
                    }}
                    activeOpacity={isUnlocked || lockReason === 'pro' ? 0.8 : 1}
                    accessibilityState={{ disabled: !isUnlocked, selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.colorPreview,
                        { backgroundColor: theme.glowColor },
                        !isUnlocked && { opacity: 0.35 },
                      ]}
                    />
                    <View style={styles.themeInfo}>
                      <View style={styles.nameRow}>
                        <Text
                          style={[
                            styles.themeName,
                            isSelected && { color: theme.glowColor },
                            !isUnlocked && { color: '#94a3b8' },
                          ]}
                        >
                          {theme.name}
                        </Text>
                        {lockReason === 'pro' && (
                          <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                          </View>
                        )}
                        {lockReason === 'progress' && (
                          <View style={styles.lockedBadge}>
                            <Text style={styles.lockedBadgeText}>BLOQUEADO</Text>
                          </View>
                        )}
                        {isUnlocked && theme.access === 'pro' && entitlements.isPro && (
                          <View style={styles.proBadge}>
                            <Text style={styles.proBadgeText}>PRO</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.themeDescription}>
                        {isUnlocked ? theme.description : lockedDescription}
                      </Text>
                    </View>
                    {isSelected && <Text style={[styles.checkIcon, { color: theme.glowColor }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              {anyLocked && !entitlements.isPro && onRequestUpgrade && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => {
                    onClose();
                    onRequestUpgrade();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.upgradeTitle}>Desbloquear todas con Terra PRO</Text>
                  <Text style={styles.upgradeSub}>Acceso permanente mientras tu suscripción esté activa</Text>
                </TouchableOpacity>
              )}

              {anyLocked && !entitlements.isPro && (
                <TouchableOpacity
                  style={styles.rewardAdButton}
                  onPress={handleUnlockWithAd}
                  activeOpacity={0.8}
                >
                  <View style={styles.rewardTag}>
                    <Text style={styles.rewardTagText}>ACCESO</Text>
                  </View>
                  <View style={styles.rewardAdTextCol}>
                    <Text style={styles.rewardAdTitle}>Desbloquear todos los estilos (24h)</Text>
                    <Text style={styles.rewardAdSub}>Ver anuncio voluntario sin costo</Text>
                  </View>
                </TouchableOpacity>
              )}
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
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#0b0f19',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 20,
    maxHeight: '85%',
  },
  scrollList: {
    maxHeight: 460,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 13,
  },
  themesContainer: {
    gap: 10,
    paddingBottom: 8,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  themeDescription: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
  lockedThemeItem: {
    opacity: 0.65,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  lockedBadgeText: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  proBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.5)',
  },
  proBadgeText: {
    color: '#eab308',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  upgradeButton: {
    backgroundColor: '#eab308',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  upgradeTitle: {
    color: '#0b0f19',
    fontSize: 14,
    fontWeight: '800',
  },
  upgradeSub: {
    color: '#0b0f19',
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
  rewardAdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.35)',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  rewardTag: {
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    borderColor: '#00f5d4',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rewardTagText: {
    color: '#00f5d4',
    fontSize: 10,
    fontWeight: '800',
  },
  rewardAdTextCol: {
    flex: 1,
  },
  rewardAdTitle: {
    color: '#00f5d4',
    fontSize: 13,
    fontWeight: '700',
  },
  rewardAdSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
});
