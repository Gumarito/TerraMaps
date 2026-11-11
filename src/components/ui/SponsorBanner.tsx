import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface SponsorBannerProps {
  isLightMode?: boolean;
}

export const SponsorBanner: React.FC<SponsorBannerProps> = ({ isLightMode = false }) => {
  return (
    <View
      style={[
        styles.bannerCard,
        {
          backgroundColor: isLightMode ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
          borderColor: isLightMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.07)',
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.adTag}>
          <Text style={styles.adTagText}>ANUNCIO</Text>
        </View>
        <Text style={[styles.brandTitle, { color: isLightMode ? '#334155' : '#94a3b8' }]}>
          Outdoor Compass Pro
        </Text>
      </View>
      <Text style={[styles.adCopy, { color: isLightMode ? '#64748b' : '#64748b' }]}>
        Navega sin conexión en tus expediciones con mapas topográficos offline.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  adTag: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  adCopy: {
    fontSize: 11,
    lineHeight: 15,
  },
});
