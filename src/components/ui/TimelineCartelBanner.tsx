import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MapTheme } from '@/core/theme/mapThemes';
import { googleTimelineService, TimelineDetectedStats } from '@/services/googleTimelineService';

interface TimelineCartelBannerProps {
  theme: MapTheme;
  onOpenPaywall: () => void;
}

export const TimelineCartelBanner: React.FC<TimelineCartelBannerProps> = ({
  theme,
  onOpenPaywall,
}) => {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<TimelineDetectedStats | null>(null);

  useEffect(() => {
    const shouldShow = googleTimelineService.shouldShowBanner();
    if (shouldShow) {
      setStats(googleTimelineService.getDetectedStats());
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    googleTimelineService.dismissBanner();
    setVisible(false);
  };

  if (!visible || !stats || stats.isRestored) {
    return null;
  }

  const isLight = theme.mode === 'light';

  return (
    <View
      style={[
        styles.cartelContainer,
        {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.94)',
          borderColor: isLight ? 'rgba(226, 232, 240, 0.9)' : 'rgba(51, 65, 85, 0.9)',
          shadowColor: isLight ? '#64748b' : '#000000',
        },
      ]}
    >
      <View style={styles.leftCol}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>🧭</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.centerCol}
        activeOpacity={0.8}
        onPress={onOpenPaywall}
      >
        <Text style={[styles.title, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
          Tienes {stats.yearsOfHistory} años de historia en Google Maps
        </Text>
        <Text style={[styles.subtitle, { color: isLight ? '#475569' : '#94a3b8' }]}>
          {stats.citiesCount} ciudades y {stats.detectedHexagonsCount} zonas listas para desbloquear.
        </Text>
        <Text style={styles.ctaText}>
          Toca para recuperarlos al instante →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.closeText, { color: isLight ? '#94a3b8' : '#64748b' }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cartelContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  leftCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 245, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.4)',
  },
  iconEmoji: {
    fontSize: 20,
  },
  centerCol: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00f5d4',
    marginTop: 3,
  },
  closeBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
