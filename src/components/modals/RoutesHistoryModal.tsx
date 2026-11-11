import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { routeTrackerService, RecordedRoute } from '../../services/routeTrackerService';
import { MapTheme } from '../../core/theme/mapThemes';

export type QuickPeriod = 'all' | 'today' | 'week' | 'month';

interface RoutesHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  theme: MapTheme;
  onSelectRouteOnMap?: (route: RecordedRoute) => void;
}

export const RoutesHistoryModal: React.FC<RoutesHistoryModalProps> = ({
  visible,
  onClose,
  theme,
  onSelectRouteOnMap,
}) => {
  const [routes, setRoutes] = useState<RecordedRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('all');
  const [specificDate, setSpecificDate] = useState<string>(''); // YYYY-MM-DD

  useEffect(() => {
    if (visible) {
      loadRoutes();
    }
  }, [visible]);

  const loadRoutes = async () => {
    const list = await routeTrackerService.getRoutes();
    setRoutes(list);
  };

  const handleDelete = async (id: string) => {
    await routeTrackerService.deleteRoute(id);
    await loadRoutes();
    if (selectedRouteId === id) setSelectedRouteId(null);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours}h ${remMins}m ${s}s`;
    }
    return `${mins}m ${s}s`;
  };

  // Filtrado reactivo por período comprimido o fecha específica seleccionada
  const filteredRoutes = useMemo(() => {
    const now = Date.now();
    return routes.filter((r) => {
      // Si el usuario seleccionó una fecha específica del año (YYYY-MM-DD)
      if (specificDate) {
        const routeDateStr = new Date(r.startTime).toISOString().slice(0, 10);
        return routeDateStr === specificDate;
      }

      if (quickPeriod === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        const routeDateStr = new Date(r.startTime).toISOString().slice(0, 10);
        return routeDateStr === todayStr;
      }
      if (quickPeriod === 'week') {
        return r.startTime >= now - 7 * 24 * 3600 * 1000;
      }
      if (quickPeriod === 'month') {
        return r.startTime >= now - 30 * 24 * 3600 * 1000;
      }
      return true;
    });
  }, [routes, quickPeriod, specificDate]);

  const totalDistanceKm = filteredRoutes.reduce((acc, r) => acc + r.distanceMeters / 1000, 0);
  const totalSeconds = filteredRoutes.reduce((acc, r) => acc + r.durationSeconds, 0);
  const totalNewAreaKm2 = filteredRoutes.reduce((acc, r) => acc + (r.newAreaKm2 || 0), 0);

  const isLight = theme.mode === 'light';

  // Fechas únicas disponibles en el historial para selector rápido
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => {
      const d = new Date(r.startTime).toISOString().slice(0, 10);
      set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [routes]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerSubtitle, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                HISTORIAL DE EXPEDICIONES
              </Text>
              <Text style={[styles.title, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                Desglose de Rutas
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeText, { color: isLight ? '#64748b' : '#94a3b8' }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filtro Comprimido Elegante: Selector de Período y Selector de Fecha Específica */}
          <View style={styles.filterSection}>
            <View style={styles.periodRow}>
              {[
                { id: 'all', label: 'Todas' },
                { id: 'today', label: 'Hoy' },
                { id: 'week', label: '7 días' },
                { id: 'month', label: 'Este mes' },
              ].map((p) => {
                const isSelected = !specificDate && quickPeriod === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.periodPill,
                      {
                        backgroundColor: isSelected
                          ? theme.accentColor
                          : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)'),
                        borderColor: isSelected ? theme.accentColor : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'),
                      },
                    ]}
                    onPress={() => {
                      setSpecificDate('');
                      setQuickPeriod(p.id as QuickPeriod);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.periodPillText,
                        {
                          color: isSelected
                            ? (isLight ? '#ffffff' : '#0b0f19')
                            : (isLight ? '#475569' : '#cbd5e1'),
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selector de Día Específico del Año */}
            <View style={styles.dateSelectorRow}>
              <Text style={[styles.dateSelectorLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                Día específico:
              </Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  style={{
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.06)',
                    color: isLight ? '#0f172a' : '#ffffff',
                    border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableDates.map((dateStr) => {
                    const isSelected = specificDate === dateStr;
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[
                          styles.dateChip,
                          {
                            backgroundColor: isSelected ? theme.accentColor : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'),
                            borderColor: isSelected ? theme.accentColor : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'),
                          },
                        ]}
                        onPress={() => setSpecificDate(isSelected ? '' : dateStr)}
                      >
                        <Text style={[styles.dateChipText, { color: isSelected ? '#0b0f19' : (isLight ? '#0f172a' : '#fff') }]}>
                          {dateStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {specificDate ? (
                <TouchableOpacity
                  onPress={() => setSpecificDate('')}
                  style={styles.clearDateBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearDateText}>Limpiar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Resumen General Limpio */}
          <View
            style={[
              styles.summaryBar,
              {
                backgroundColor: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                borderColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)',
              },
            ]}
          >
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                {filteredRoutes.length}
              </Text>
              <Text style={[styles.summaryLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                TRAYECTOS
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: theme.accentColor }]}>
                {totalDistanceKm.toFixed(2)} km
              </Text>
              <Text style={[styles.summaryLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                DISTANCIA
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                {formatSeconds(totalSeconds)}
              </Text>
              <Text style={[styles.summaryLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                TIEMPO TOTAL
              </Text>
            </View>
          </View>

          {/* Lista Desglosada de Rutas */}
          <ScrollView style={styles.routesList} showsVerticalScrollIndicator={false}>
            {filteredRoutes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                  {specificDate
                    ? `No hay trayectos registrados el ${specificDate}. Selecciona otra fecha o pulsa "Todas".`
                    : 'Aún no se han registrado expediciones en este período.'}
                </Text>
              </View>
            ) : (
              filteredRoutes.map((route) => {
                const isExpanded = selectedRouteId === route.id;
                const distanceKm = (route.distanceMeters / 1000).toFixed(2);
                const paceMinPerKm =
                  route.distanceMeters > 0
                    ? (route.durationSeconds / (route.distanceMeters / 1000) / 60).toFixed(1)
                    : '0.0';

                return (
                  <View
                    key={route.id}
                    style={[
                      styles.routeCard,
                      {
                        backgroundColor: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                        borderColor: isExpanded
                          ? theme.accentColor
                          : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'),
                      },
                    ]}
                  >
                    {/* Fila Principal de la Ruta */}
                    <TouchableOpacity
                      onPress={() => setSelectedRouteId(isExpanded ? null : route.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={styles.titleCol}>
                          <Text style={[styles.routeTitle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                            {route.title}
                          </Text>
                          <Text style={[styles.routeDate, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                            {route.dateFormatted}
                          </Text>
                        </View>
                        <Text style={[styles.expandArrow, { color: theme.accentColor }]}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </View>

                      {/* Métricas Principales (Sin Emojis) */}
                      <View style={styles.metricsRow}>
                        <View style={styles.metricItem}>
                          <Text style={[styles.metricLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                            DURACIÓN
                          </Text>
                          <Text style={[styles.metricValue, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                            {formatSeconds(route.durationSeconds)}
                          </Text>
                        </View>

                        <View style={styles.metricItem}>
                          <Text style={[styles.metricLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                            DISTANCIA
                          </Text>
                          <Text style={[styles.metricValue, { color: theme.accentColor }]}>
                            {distanceKm} km
                          </Text>
                        </View>

                        <View style={styles.metricItem}>
                          <Text style={[styles.metricLabel, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                            VEL. MEDIA
                          </Text>
                          <Text style={[styles.metricValue, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                            {route.avgSpeedKmh} km/h
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Desglose Expandido: Ver Trayectoria en el Mapa */}
                    {isExpanded && (
                      <View
                        style={[
                          styles.breakdownDetails,
                          { borderTopColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)' },
                        ]}
                      >
                        <View style={styles.detailGrid}>
                          <View style={styles.detailBox}>
                            <Text style={[styles.detailLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                              Ritmo Medio
                            </Text>
                            <Text style={[styles.detailVal, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                              {paceMinPerKm} min/km
                            </Text>
                          </View>

                          <View style={styles.detailBox}>
                            <Text style={[styles.detailLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                              Velocidad Máxima
                            </Text>
                            <Text style={[styles.detailVal, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                              {route.maxSpeedKmh} km/h
                            </Text>
                          </View>

                          <View style={styles.detailBox}>
                            <Text style={[styles.detailLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                              Terreno Explorado
                            </Text>
                            <Text style={[styles.detailVal, { color: theme.accentColor }]}>
                              +{route.newAreaKm2} km²
                            </Text>
                          </View>

                          <View style={styles.detailBox}>
                            <Text style={[styles.detailLbl, { color: isLight ? '#64748b' : '#94a3b8' }]}>
                              Zonas H3
                            </Text>
                            <Text style={[styles.detailVal, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                              {route.newHexCount} zonas
                            </Text>
                          </View>
                        </View>

                        {/* Botón Principal: Ver Trayectoria en el Mapa */}
                        <View style={styles.cardActionsRow}>
                          {onSelectRouteOnMap && (
                            <TouchableOpacity
                              style={[styles.viewOnMapBtn, { backgroundColor: theme.accentColor }]}
                              onPress={() => {
                                onSelectRouteOnMap(route);
                                onClose();
                              }}
                              activeOpacity={0.85}
                            >
                              <Text
                                style={[
                                  styles.viewOnMapBtnText,
                                  { color: isLight ? '#ffffff' : '#0b0f19' },
                                ]}
                              >
                                Ver Trayectoria en el Mapa
                              </Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDelete(route.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.deleteBtnText}>Eliminar registro</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Botón Inferior */}
          <TouchableOpacity
            style={[
              styles.closeModalBtn,
              {
                backgroundColor: theme.accentColor,
              },
            ]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.closeModalBtnText,
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterSection: {
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillText: {
    fontSize: 11,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  dateSelectorLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  dateChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  clearDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearDateText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryLbl: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  routesList: {
    maxHeight: 380,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  routeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleCol: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  routeDate: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  expandArrow: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  breakdownDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailBox: {
    width: '48%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  detailLbl: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  viewOnMapBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnMapBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteBtnText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  closeModalBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  closeModalBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
