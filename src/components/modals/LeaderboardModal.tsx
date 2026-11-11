import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import { syncService, LeaderboardEntry } from '@/services/syncService';

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  visible,
  onClose,
  accentColor = '#00f5d4',
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (visible) {
      syncService.getTerritoryLeaderboard(15).then(setLeaderboard);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: accentColor }]}>👑 RANKING TERRITORIAL</Text>
              <Text style={styles.subtitle}>Conquistadores y Reyes de Zona</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Leaderboard List */}
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.row, item.isCurrentUser && styles.currentUserRow]}>
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankText, item.rank <= 3 && styles.topRankText]}>
                    {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                  </Text>
                </View>

                <View style={styles.userContainer}>
                  <Text style={[styles.usernameText, item.isCurrentUser && { color: accentColor }]}>
                    {item.username}
                  </Text>
                  <Text style={styles.levelText}>Nivel {item.explorationLevel}</Text>
                </View>

                <View style={styles.areaContainer}>
                  <Text style={styles.areaValueText}>{item.totalAreaKm2.toFixed(2)}</Text>
                  <Text style={styles.areaUnitText}>km²</Text>
                </View>
              </View>
            )}
          />

          {/* Close button */}
          <TouchableOpacity style={[styles.actionBtn, { borderColor: accentColor }]} onPress={onClose}>
            <Text style={[styles.actionBtnText, { color: accentColor }]}>VOLVER AL MAPA</Text>
          </TouchableOpacity>
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
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  currentUserRow: {
    borderColor: 'rgba(0, 245, 212, 0.4)',
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rankText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  topRankText: {
    fontSize: 18,
  },
  userContainer: {
    flex: 1,
    paddingLeft: 8,
  },
  usernameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  levelText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  areaContainer: {
    alignItems: 'flex-end',
  },
  areaValueText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  areaUnitText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  actionBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
});
