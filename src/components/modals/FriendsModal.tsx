import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MapTheme } from '@/core/theme/mapThemes';
import { colors, radius, size, space } from '@/theme/tokens';
import { authService } from '@/services/authService';

export interface FriendProfile {
  id: string;
  name: string;
  username: string;
  initials: string;
  km2: number;
  relation: string;
  isOnline: boolean;
  commonPlaces: string[];
  friendOnlyPlaces: string[];
}

interface FriendsModalProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
  userKm2?: number;
  theme?: MapTheme;
}

type SocialProviderId = 'google' | 'microsoft' | 'facebook' | 'instagram';

const SOCIAL_PROVIDERS: ReadonlyArray<{ id: SocialProviderId; label: string; dotColor: string }> = [
  { id: 'google', label: 'Google', dotColor: '#ea4335' },
  { id: 'microsoft', label: 'Microsoft', dotColor: '#0284c7' },
  { id: 'facebook', label: 'Facebook', dotColor: '#1877f2' },
  { id: 'instagram', label: 'Instagram', dotColor: '#e1306c' },
];

const INITIAL_FRIENDS:FriendProfile[] = [
  {
    id: 'f1',
    name: 'Sofía Morales',
    username: 'SofiaM',
    initials: 'SM',
    km2: 3.42,
    relation: 'Amiga',
    isOnline: true,
    commonPlaces: ['Palacio de Bellas Artes', 'Zócalo Capitalino', 'Alameda Central'],
    friendOnlyPlaces: ['Bosque de Chapultepec', 'Coyoacán Histórico', 'Monumento a la Revolución'],
  },
  {
    id: 'f2',
    name: 'Valentina Rossi',
    username: 'Valentina',
    initials: 'VR',
    km2: 4.18,
    relation: 'Pareja',
    isOnline: true,
    commonPlaces: ['Paseo de la Reforma', 'Ángel de la Independencia', 'Polanco'],
    friendOnlyPlaces: ['Museo Soumaya', 'Castillo de Chapultepec'],
  },
  {
    id: 'f3',
    name: 'Carlos Ruiz',
    username: 'CarlosR',
    initials: 'CR',
    km2: 1.85,
    relation: 'Colega',
    isOnline: false,
    commonPlaces: ['Calle Madero', 'Eje Central'],
    friendOnlyPlaces: ['Roma Norte', 'Parque México', 'Fuente de Cibeles'],
  },
  {
    id: 'f4',
    name: 'David Vega',
    username: 'DavidV',
    initials: 'DV',
    km2: 1.15,
    relation: 'Compañero',
    isOnline: false,
    commonPlaces: ['Monumento a la Revolución'],
    friendOnlyPlaces: ['Colonia Condesa', 'Jardín Centenario'],
  },
];

export const FriendsModal: React.FC<FriendsModalProps> = ({
  visible,
  onClose,
  accentColor = '#00f5d4',
  userKm2 = 0.52,
  theme,
}) => {
  const isLight = theme?.mode === 'light';
  const effectiveAccent = isLight ? (theme?.accentColor || '#2563eb') : accentColor;

  const [friends, setFriends] = useState<FriendProfile[]>(INITIAL_FRIENDS);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('f1');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedFriend = friends.find((f) => f.id === selectedFriendId) || friends[0];

  const handleSocialLogin = async (provider: SocialProviderId) => {
    const res = await authService.signInWithSocialProvider(provider);
    if (res.success) {
      setSuccessMsg(`Cuenta vinculada con ${provider.toUpperCase()}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleSyncSocial = async () => {
    const res = await authService.syncSocialContacts('all');
    if (res.success) {
      const newEntries: FriendProfile[] = res.friends.map((f) => ({
        id: `social_${f.username}`,
        name: f.name,
        username: f.username,
        initials: f.initials,
        km2: f.km2,
        relation: f.source,
        isOnline: true,
        commonPlaces: f.commonPlaces,
        friendOnlyPlaces: ['Coyoacán Histórico', 'Monumento a la Revolución'],
      }));

      setFriends((prev) => {
        const existing = new Set(prev.map((p) => p.username.toLowerCase()));
        const toAdd = newEntries.filter((e) => !existing.has(e.username.toLowerCase()));
        return [...prev, ...toAdd];
      });

      setSuccessMsg(`${res.syncedCount} amigos de Facebook e Instagram sincronizados.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const maxKm2 = Math.max(userKm2, selectedFriend.km2, 0.1);
  const userPercent = Math.min(100, Math.round((userKm2 / maxKm2) * 100));
  const friendPercent = Math.min(100, Math.round((selectedFriend.km2 / maxKm2) * 100));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isLight ? '#ffffff' : '#0c101d',
              borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.12)',
            },
          ]}
        >
          {/* Header Ejecutivo */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)' },
            ]}
          >
            <View>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isLight ? '#64748b' : '#94a3b8' },
                ]}
              >
                COMPARATIVA DE EXPLORACIÓN
              </Text>
              <Text
                style={[
                  styles.title,
                  { color: isLight ? '#0f172a' : '#ffffff' },
                ]}
              >
                Lugares & Contactos
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text
                style={[
                  styles.closeText,
                  { color: isLight ? '#64748b' : '#94a3b8' },
                ]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Carrusel de Contactos / Selector Limpio */}
          <View style={styles.contactsSelectorWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsRow}>
              {friends.map((friend) => {
                const isSelected = friend.id === selectedFriend.id;
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={[
                      styles.contactChip,
                      {
                        backgroundColor: isSelected
                          ? (isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(255, 255, 255, 0.08)')
                          : (isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'),
                        borderColor: isSelected
                          ? effectiveAccent
                          : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'),
                      },
                    ]}
                    onPress={() => setSelectedFriendId(friend.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.chipAvatar,
                        {
                          backgroundColor: isSelected ? effectiveAccent : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipAvatarText,
                          { color: isSelected ? '#0b0f19' : (isLight ? '#475569' : '#f8fafc') },
                        ]}
                      >
                        {friend.initials}
                      </Text>
                      {friend.isOnline && <View style={styles.chipOnlineBadge} />}
                    </View>
                    <View style={styles.chipInfo}>
                      <Text
                        style={[
                          styles.chipName,
                          { color: isLight ? '#0f172a' : '#ffffff', fontWeight: isSelected ? '700' : '500' },
                        ]}
                        numberOfLines={1}
                      >
                        {friend.name}
                      </Text>
                      <Text
                        style={[
                          styles.chipRelation,
                          { color: isLight ? '#64748b' : '#94a3b8' },
                        ]}
                      >
                        {friend.relation}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Tarjeta de Comparativa Territorial */}
            <View
              style={[
                styles.comparisonBox,
                {
                  backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                },
              ]}
            >
              <View style={styles.comparisonHeader}>
                <Text
                  style={[
                    styles.comparisonSectionTitle,
                    { color: isLight ? '#334155' : '#cbd5e1' },
                  ]}
                >
                  TERRITORIO EXPLORADO
                </Text>
                <Text
                  style={[
                    styles.comparisonSubtitle,
                    { color: isLight ? '#64748b' : '#94a3b8' },
                  ]}
                >
                  Tú vs @{selectedFriend.username}
                </Text>
              </View>

              {/* Barra Tú */}
              <View style={styles.statProgressRow}>
                <View style={styles.statLabels}>
                  <Text style={[styles.statName, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    Tú
                  </Text>
                  <Text style={[styles.statValue, { color: effectiveAccent }]}>
                    {userKm2.toFixed(2)} km²
                  </Text>
                </View>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)' },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      { width: `${userPercent}%`, backgroundColor: effectiveAccent },
                    ]}
                  />
                </View>
              </View>

              {/* Barra Amigo */}
              <View style={[styles.statProgressRow, { marginTop: 12 }]}>
                <View style={styles.statLabels}>
                  <Text style={[styles.statName, { color: isLight ? '#0f172a' : '#f8fafc' }]}>
                    {selectedFriend.name}
                  </Text>
                  <Text style={[styles.statValue, { color: isLight ? '#475569' : '#94a3b8' }]}>
                    {selectedFriend.km2.toFixed(2)} km²
                  </Text>
                </View>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)' },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${friendPercent}%`,
                        backgroundColor: isLight ? '#94a3b8' : 'rgba(255, 255, 255, 0.4)',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* SECCIÓN 1: Lugares en Común (Coincidencias de Exploración) */}
            <View
              style={[
                styles.placesSection,
                {
                  backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                },
              ]}
            >
              <View style={styles.placesSectionHeader}>
                <Text
                  style={[
                    styles.placesSectionTitle,
                    { color: isLight ? '#0f172a' : '#f8fafc' },
                  ]}
                >
                  Lugares en Común
                </Text>
                <View
                  style={[
                    styles.matchBadge,
                    {
                      backgroundColor: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.18)',
                      borderColor: '#10b981',
                    },
                  ]}
                >
                  <Text style={styles.matchBadgeText}>
                    {selectedFriend.commonPlaces.length} zonas coincidentes
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.placesSectionHint,
                  { color: isLight ? '#64748b' : '#94a3b8' },
                ]}
              >
                Puntos de interés y monumentos descubiertos por ambos:
              </Text>

              <View style={styles.placesTagsGrid}>
                {selectedFriend.commonPlaces.map((place, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.placeTagCard,
                      {
                        backgroundColor: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                      },
                    ]}
                  >
                    <View style={styles.placeDotShared} />
                    <Text
                      style={[
                        styles.placeTagText,
                        { color: isLight ? '#0f172a' : '#f8fafc' },
                      ]}
                    >
                      {place}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* SECCIÓN 2: Lugares Descubiertos por tu Amigo (Inspiración para ti) */}
            <View
              style={[
                styles.placesSection,
                {
                  backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                  marginTop: 12,
                },
              ]}
            >
              <View style={styles.placesSectionHeader}>
                <Text
                  style={[
                    styles.placesSectionTitle,
                    { color: isLight ? '#0f172a' : '#f8fafc' },
                  ]}
                >
                  Descubiertos por {selectedFriend.name}
                </Text>
                <View
                  style={[
                    styles.unlockedBadge,
                    {
                      backgroundColor: isLight ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                      borderColor: '#38bdf8',
                    },
                  ]}
                >
                  <Text style={styles.unlockedBadgeText}>Por descubrir</Text>
                </View>
              </View>

              <Text
                style={[
                  styles.placesSectionHint,
                  { color: isLight ? '#64748b' : '#94a3b8' },
                ]}
              >
                Zonas que {selectedFriend.name} ya desbloqueó y aún no has explorado:
              </Text>

              <View style={styles.placesTagsGrid}>
                {selectedFriend.friendOnlyPlaces.map((place, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.placeTagCard,
                      {
                        backgroundColor: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                        borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
                      },
                    ]}
                  >
                    <View style={styles.placeDotFriend} />
                    <Text
                      style={[
                        styles.placeTagText,
                        { color: isLight ? '#475569' : '#cbd5e1' },
                      ]}
                    >
                      {place}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Formulario minimalista para añadir contactos */}
            <View style={styles.addContactContainer}>
              <TouchableOpacity
                style={{
                  backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)',
                  borderWidth: 1,
                  borderColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
                onPress={handleSyncSocial}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isLight ? '#2563eb' : '#38bdf8',
                  }}
                >
                  Sincronizar amigos de Facebook e Instagram
                </Text>
              </TouchableOpacity>

              {/* Vinculación directa de redes sociales (única entrada de autenticación/contactos) */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SOCIAL_PROVIDERS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{
                      flex: 1,
                      minWidth: '46%',
                      minHeight: 44,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onPress={() => handleSocialLogin(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.dotColor }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isLight ? '#0f172a' : '#f8fafc' }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {successMsg && (
                <Text style={[styles.successBanner, { color: effectiveAccent }]}>
                  {successMsg}
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Botón Inferior */}
          <TouchableOpacity
            style={[styles.backToMapBtn, { backgroundColor: effectiveAccent }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.backToMapBtnText,
                { color: isLight ? '#ffffff' : '#0b0f19' },
              ]}
            >
              Volver al Mapa
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  contactsSelectorWrapper: {
    marginTop: 14,
    marginBottom: 6,
  },
  contactsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chipAvatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  chipOnlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: '#0c101d',
  },
  chipInfo: {
    justifyContent: 'center',
  },
  chipName: {
    fontSize: 12,
  },
  chipRelation: {
    fontSize: 10,
    fontWeight: '500',
  },
  scrollBody: {
    maxHeight: 400,
    marginTop: 8,
  },
  comparisonBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  comparisonSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  comparisonSubtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  statProgressRow: {
    width: '100%',
  },
  statLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  statName: {
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  placesSection: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  placesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placesSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  matchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  unlockedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  unlockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
  },
  placesSectionHint: {
    fontSize: 11,
    marginTop: 4,
    marginBottom: 10,
  },
  placesTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  placeTagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
  },
  placeDotShared: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  placeDotFriend: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
  },
  placeTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addContactContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  addBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  successBanner: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  backToMapBtn: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  backToMapBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
