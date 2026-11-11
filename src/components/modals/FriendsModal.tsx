import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MapTheme } from '@/core/theme/mapThemes';
import { authService } from '@/services/authService';
import { ModalShell, SurfaceCard, SectionLabel, Tag, ActionButton, modalPalette } from '../ui/ModalShell';
import { fontSize, fontWeight, radius, space } from '@/theme/tokens';

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

const INITIAL_FRIENDS: FriendProfile[] = [
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

const PlaceList: React.FC<{ places: string[]; dot: string; text: string; border: string; bg: string }> = ({
  places,
  dot,
  text,
  border,
  bg,
}) => (
  <View style={styles.placesGrid}>
    {places.map((place) => (
      <View key={place} style={[styles.place, { borderColor: border, backgroundColor: bg }]}>
        <View style={[styles.placeDot, { backgroundColor: dot }]} />
        <Text style={[styles.placeText, { color: text }]}>{place}</Text>
      </View>
    ))}
  </View>
);

export const FriendsModal: React.FC<FriendsModalProps> = ({ visible, onClose, userKm2 = 0.52, theme }) => {
  const p = modalPalette(theme);
  const [friends, setFriends] = useState<FriendProfile[]>(INITIAL_FRIENDS);
  const [selectedFriendId, setSelectedFriendId] = useState<string>('f1');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedFriend = friends.find((f) => f.id === selectedFriendId) || friends[0];

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleSocialLogin = async (provider: SocialProviderId) => {
    const res = await authService.signInWithSocialProvider(provider);
    if (res.success) flash(`Cuenta vinculada con ${provider.toUpperCase()}.`);
  };

  const handleSyncSocial = async () => {
    const res = await authService.syncSocialContacts('all');
    if (!res.success) return;
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
      const existing = new Set(prev.map((x) => x.username.toLowerCase()));
      return [...prev, ...newEntries.filter((e) => !existing.has(e.username.toLowerCase()))];
    });
    flash(`${res.syncedCount} amigos de Facebook e Instagram sincronizados.`);
  };

  const maxKm2 = Math.max(userKm2, selectedFriend.km2, 0.1);
  const userPercent = Math.min(100, Math.round((userKm2 / maxKm2) * 100));
  const friendPercent = Math.min(100, Math.round((selectedFriend.km2 / maxKm2) * 100));
  const placeBg = p.isLight ? '#ffffff' : 'rgba(255,255,255,0.04)';

  return (
    <ModalShell visible={visible} onClose={onClose} theme={theme} eyebrow="COMPARATIVA DE EXPLORACIÓN" title="Lugares & Contactos">
      {/* Selector de contactos */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsRow}>
        {friends.map((friend) => {
          const active = friend.id === selectedFriend.id;
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.contact, { borderColor: active ? p.accent : p.hairline, backgroundColor: active ? p.raised : 'transparent' }]}
              onPress={() => setSelectedFriendId(friend.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.avatar, { borderColor: active ? p.accent : p.border }]}>
                <Text style={[styles.avatarText, { color: active ? p.accent : p.text }]}>{friend.initials}</Text>
                {friend.isOnline && <View style={[styles.online, { backgroundColor: p.positive, borderColor: p.surface }]} />}
              </View>
              <View>
                <Text style={[styles.contactName, { color: p.text }]} numberOfLines={1}>
                  {friend.name}
                </Text>
                <Text style={[styles.contactRel, { color: p.subtext }]}>{friend.relation}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Comparativa */}
      <SurfaceCard theme={theme} tone="hero">
        <View style={styles.rowBetween}>
          <Text style={[styles.eyebrow, { color: p.subtext }]}>TERRITORIO EXPLORADO</Text>
          <Text style={[styles.eyebrow, { color: p.subtext }]}>@{selectedFriend.username}</Text>
        </View>
        <Bar label="Tú" value={`${userKm2.toFixed(2)} km²`} percent={userPercent} color={p.accent} text={p.text} track={p.hairline} />
        <Bar
          label={selectedFriend.name}
          value={`${selectedFriend.km2.toFixed(2)} km²`}
          percent={friendPercent}
          color={p.isLight ? '#94a3b8' : 'rgba(255,255,255,0.45)'}
          text={p.text}
          track={p.hairline}
        />
      </SurfaceCard>

      {/* Lugares */}
      <SectionLabel theme={theme} right={`${selectedFriend.commonPlaces.length} en común`}>
        EN COMÚN
      </SectionLabel>
      <SurfaceCard theme={theme}>
        <PlaceList places={selectedFriend.commonPlaces} dot={p.positive} text={p.text} border={p.hairline} bg={placeBg} />
      </SurfaceCard>

      <SectionLabel theme={theme} right="por descubrir">
        {`DESCUBIERTOS POR ${selectedFriend.name.split(' ')[0].toUpperCase()}`}
      </SectionLabel>
      <SurfaceCard theme={theme}>
        <Text style={[styles.hint, { color: p.subtext }]}>
          Zonas que {selectedFriend.name} ya desbloqueó y aún no has explorado.
        </Text>
        <PlaceList places={selectedFriend.friendOnlyPlaces} dot={p.accent} text={p.subtext} border={p.hairline} bg={placeBg} />
      </SurfaceCard>

      {/* Conexiones */}
      <SectionLabel theme={theme}>CONEXIONES</SectionLabel>
      <ActionButton theme={theme} variant="primary" label="Sincronizar amigos de Facebook e Instagram" onPress={handleSyncSocial} />
      <View style={styles.socialGrid}>
        {SOCIAL_PROVIDERS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.social, { borderColor: p.border }]}
            onPress={() => handleSocialLogin(item.id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Vincular ${item.label}`}
          >
            <View style={[styles.socialDot, { backgroundColor: item.dotColor }]} />
            <Text style={[styles.socialText, { color: p.text }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {successMsg ? <Tag theme={theme} label={successMsg.toUpperCase()} color={p.positive} /> : null}
    </ModalShell>
  );
};

const Bar: React.FC<{ label: string; value: string; percent: number; color: string; text: string; track: string }> = ({
  label,
  value,
  percent,
  color,
  text,
  track,
}) => (
  <View style={styles.bar}>
    <View style={styles.rowBetween}>
      <Text style={[styles.barLabel, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.barValue, { color }]}>{value}</Text>
    </View>
    <View style={[styles.track, { backgroundColor: track }]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  contactsRow: { gap: space.sm, paddingVertical: space.xs },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  online: { position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  contactName: { fontSize: fontSize.small, fontWeight: fontWeight.bold, maxWidth: 110 },
  contactRel: { fontSize: fontSize.caption, marginTop: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: 1.5 },
  bar: { gap: 6, marginTop: space.sm },
  barLabel: { flex: 1, fontSize: fontSize.small, fontWeight: fontWeight.medium },
  barValue: { fontSize: fontSize.small, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  hint: { fontSize: fontSize.small, lineHeight: 17 },
  placesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeDot: { width: 5, height: 5, borderRadius: 3 },
  placeText: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  social: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  socialDot: { width: 7, height: 7, borderRadius: 4 },
  socialText: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
});
