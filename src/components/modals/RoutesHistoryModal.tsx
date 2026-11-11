import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { routeTrackerService, RecordedRoute } from '../../services/routeTrackerService';
import { MapTheme } from '../../core/theme/mapThemes';
import { ModalShell, SurfaceCard, SectionLabel, StatTile, DataRow, ActionButton, modalPalette } from '../ui/ModalShell';
import { fontSize, fontWeight, radius, space } from '@/theme/tokens';

export type QuickPeriod = 'all' | 'today' | 'week' | 'month';

interface RoutesHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  theme: MapTheme;
  onSelectRouteOnMap?: (route: RecordedRoute) => void;
}

const PERIODS: ReadonlyArray<{ id: QuickPeriod; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: '7 días' },
  { id: 'month', label: 'Mes' },
];

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const formatSeconds = (sec: number): string => {
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m ${s}s`;
};

export const RoutesHistoryModal: React.FC<RoutesHistoryModalProps> = ({ visible, onClose, theme, onSelectRouteOnMap }) => {
  const p = modalPalette(theme);
  const [routes, setRoutes] = useState<RecordedRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('all');
  const [specificDate, setSpecificDate] = useState<string>(''); // YYYY-MM-DD

  const loadRoutes = async () => setRoutes(await routeTrackerService.getRoutes());

  useEffect(() => {
    if (visible) void loadRoutes();
  }, [visible]);

  const handleDelete = async (id: string) => {
    await routeTrackerService.deleteRoute(id);
    await loadRoutes();
    if (selectedRouteId === id) setSelectedRouteId(null);
  };

  const filteredRoutes = useMemo(() => {
    const now = Date.now();
    return routes.filter((r) => {
      if (specificDate) return isoDay(r.startTime) === specificDate;
      if (quickPeriod === 'today') return isoDay(r.startTime) === isoDay(now);
      if (quickPeriod === 'week') return r.startTime >= now - 7 * 24 * 3600 * 1000;
      if (quickPeriod === 'month') return r.startTime >= now - 30 * 24 * 3600 * 1000;
      return true;
    });
  }, [routes, quickPeriod, specificDate]);

  const totalDistanceKm = filteredRoutes.reduce((acc, r) => acc + r.distanceMeters / 1000, 0);
  const totalSeconds = filteredRoutes.reduce((acc, r) => acc + r.durationSeconds, 0);

  const availableDates = useMemo(
    () => Array.from(new Set(routes.map((r) => isoDay(r.startTime)))).sort().reverse(),
    [routes]
  );

  return (
    <ModalShell visible={visible} onClose={onClose} theme={theme} eyebrow="HISTORIAL DE EXPEDICIONES" title="Desglose de Rutas">
      {/* Período: control segmentado */}
      <View style={[styles.segment, { borderColor: p.border }]}>
        {PERIODS.map((per, i) => {
          const active = !specificDate && quickPeriod === per.id;
          return (
            <TouchableOpacity
              key={per.id}
              style={[
                styles.segmentItem,
                i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.border },
                active && { backgroundColor: p.accent },
              ]}
              onPress={() => {
                setSpecificDate('');
                setQuickPeriod(per.id);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, { color: active ? p.onAccent : p.text }]}>{per.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Día específico */}
      <View style={styles.dateRow}>
        <Text style={[styles.dateLabel, { color: p.subtext }]}>DÍA</Text>
        {Platform.OS === 'web' ? (
          <input
            type="date"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
            style={{
              backgroundColor: p.raised,
              color: p.text,
              border: `1px solid ${p.border}`,
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {availableDates.length === 0 ? (
              <Text style={[styles.dateLabel, { color: p.subtext }]}>Sin fechas registradas</Text>
            ) : (
              availableDates.map((d) => {
                const active = specificDate === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, { borderColor: active ? p.accent : p.border, backgroundColor: active ? p.accent : 'transparent' }]}
                    onPress={() => setSpecificDate(active ? '' : d)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, { color: active ? p.onAccent : p.text }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
        {specificDate ? (
          <TouchableOpacity onPress={() => setSpecificDate('')} activeOpacity={0.7} hitSlop={8}>
            <Text style={[styles.clear, { color: p.subtext }]}>Limpiar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Resumen */}
      <View style={styles.tiles}>
        <StatTile theme={theme} label="TRAYECTOS" value={`${filteredRoutes.length}`} style={styles.tile3} />
        <StatTile theme={theme} label="DISTANCIA" value={totalDistanceKm.toFixed(1)} unit="km" emphasis style={styles.tile3} />
        <StatTile theme={theme} label="TIEMPO" value={formatSeconds(totalSeconds)} style={styles.tile3} />
      </View>

      <SectionLabel theme={theme} right={`${filteredRoutes.length}`}>
        EXPEDICIONES
      </SectionLabel>

      {filteredRoutes.length === 0 ? (
        <SurfaceCard theme={theme}>
          <Text style={[styles.empty, { color: p.subtext }]}>
            {specificDate
              ? `No hay trayectos el ${specificDate}. Elige otra fecha o vuelve a "Todas".`
              : 'Aún no hay expediciones registradas en este período.'}
          </Text>
        </SurfaceCard>
      ) : (
        filteredRoutes.map((route) => {
          const isExpanded = selectedRouteId === route.id;
          const km = route.distanceMeters / 1000;
          const pace = km > 0 ? (route.durationSeconds / km / 60).toFixed(1) : '0.0';
          return (
            <SurfaceCard key={route.id} theme={theme} accentBorder={isExpanded ? p.accent : undefined} style={styles.routeCard}>
              <TouchableOpacity
                onPress={() => setSelectedRouteId(isExpanded ? null : route.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.routeHead}>
                  <View style={styles.flex}>
                    <Text style={[styles.routeTitle, { color: p.text }]} numberOfLines={1}>
                      {route.title}
                    </Text>
                    <Text style={[styles.routeDate, { color: p.subtext }]}>{route.dateFormatted}</Text>
                  </View>
                  <Text style={[styles.chevron, { color: p.subtext }]}>{isExpanded ? '⌃' : '⌄'}</Text>
                </View>
                <View style={styles.metrics}>
                  <Metric label="DURACIÓN" value={formatSeconds(route.durationSeconds)} color={p.text} sub={p.subtext} />
                  <Metric label="DISTANCIA" value={`${km.toFixed(2)} km`} color={p.accent} sub={p.subtext} />
                  <Metric label="VEL. MEDIA" value={`${route.avgSpeedKmh} km/h`} color={p.text} sub={p.subtext} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.detail}>
                  <DataRow theme={theme} label="Ritmo medio" value={`${pace} min/km`} />
                  <DataRow theme={theme} label="Velocidad máxima" value={`${route.maxSpeedKmh} km/h`} />
                  <DataRow theme={theme} label="Terreno explorado" value={`+${route.newAreaKm2} km²`} valueColor={p.accent} />
                  <DataRow theme={theme} label="Zonas descubiertas" value={`${route.newHexCount}`} last />
                  <View style={styles.actions}>
                    {onSelectRouteOnMap && (
                      <ActionButton
                        theme={theme}
                        variant="primary"
                        compact
                        label="Ver en el mapa"
                        onPress={() => {
                          onSelectRouteOnMap(route);
                          onClose();
                        }}
                      />
                    )}
                    <ActionButton theme={theme} variant="danger" compact label="Eliminar" onPress={() => handleDelete(route.id)} />
                  </View>
                </View>
              )}
            </SurfaceCard>
          );
        })
      )}
    </ModalShell>
  );
};

const Metric: React.FC<{ label: string; value: string; color: string; sub: string }> = ({ label, value, color, sub }) => (
  <View style={styles.metric}>
    <Text style={[styles.metricLabel, { color: sub }]}>{label}</Text>
    <Text style={[styles.metricValue, { color }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: 1.5 },
  chipRow: { gap: space.xs, alignItems: 'center' },
  chip: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  clear: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile3: { flexBasis: 0, flexGrow: 1, paddingHorizontal: space.md },
  empty: { fontSize: fontSize.small, lineHeight: 18, textAlign: 'center', paddingVertical: space.lg },
  routeCard: { gap: space.sm },
  routeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  routeTitle: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  routeDate: { fontSize: fontSize.small, marginTop: 2 },
  chevron: { fontSize: fontSize.title, marginLeft: space.sm },
  metrics: { flexDirection: 'row' },
  metric: { flex: 1 },
  metricLabel: { fontSize: 9, fontWeight: fontWeight.medium, letterSpacing: 1.5, marginBottom: 2 },
  metricValue: { fontSize: fontSize.body, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  detail: { marginTop: space.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.md },
});
