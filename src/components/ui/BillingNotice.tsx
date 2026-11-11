import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type BillingNoticeTone = 'pending' | 'success' | 'warning';

export interface BillingNoticeProps {
  tone: BillingNoticeTone;
  message: string;
  onDismiss: () => void;
}

const TONE_COLORS: Record<BillingNoticeTone, { bg: string; border: string; text: string }> = {
  pending: { bg: 'rgba(15, 23, 42, 0.94)', border: 'rgba(56, 189, 248, 0.5)', text: '#38bdf8' },
  success: { bg: 'rgba(6, 78, 59, 0.94)', border: 'rgba(16, 185, 129, 0.6)', text: '#a7f3d0' },
  warning: { bg: 'rgba(69, 39, 3, 0.94)', border: 'rgba(245, 158, 11, 0.6)', text: '#fcd34d' },
};

/** Aviso flotante del resultado de un pago (confirmación del webhook, cancelación, etc.). */
export const BillingNotice: React.FC<BillingNoticeProps> = ({ tone, message, onDismiss }) => {
  const colors = TONE_COLORS[tone];
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border }]}
        onPress={onDismiss}
        activeOpacity={0.9}
        accessibilityRole="alert"
      >
        {tone === 'pending' && <ActivityIndicator size="small" color={colors.text} />}
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
        {tone !== 'pending' && <Text style={[styles.dismiss, { color: colors.text }]}>✕</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 64, left: 16, right: 16, alignItems: 'center', zIndex: 50 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 420,
  },
  text: { flexShrink: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  dismiss: { fontSize: 12, fontWeight: '900', paddingLeft: 4 },
});
