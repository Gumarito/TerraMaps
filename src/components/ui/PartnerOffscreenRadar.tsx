import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import type { MapTheme } from '@/core/theme/mapThemes';
import { colors, fontSize, fontWeight, size } from '@/theme/tokens';

export interface RadarViewport {
  center: [number, number]; // [lng, lat]
  bounds: [number, number, number, number]; // [oeste, sur, este, norte]
}

interface PartnerOffscreenRadarProps {
  theme: MapTheme;
  viewport: RadarViewport | null;
  partnerName: string;
  partnerCoordinates: [number, number]; // [lng, lat]
  distanceText: string;
  onPress?: () => void;
  /** Margen reservado arriba/abajo para HUD y barra inferior. */
  insetTop?: number;
  insetBottom?: number;
}

const EDGE_PADDING = 28;

/**
 * Flecha flotante en el borde del mapa que apunta hacia la pareja cuando queda fuera del viewport.
 * Se oculta sola cuando la pareja está visible.
 */
export const PartnerOffscreenRadar: React.FC<PartnerOffscreenRadarProps> = ({
  theme,
  viewport,
  partnerName,
  partnerCoordinates,
  distanceText,
  onPress,
  insetTop = 70,
  insetBottom = 150,
}) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  let marker: React.ReactNode = null;
  if (viewport && box.w > 0) {
    const [west, south, east, north] = viewport.bounds;
    const [plng, plat] = partnerCoordinates;
    const inside = plng >= west && plng <= east && plat >= south && plat <= north;

    if (!inside) {
      // Dirección en pantalla (x → este, y → sur) desde el centro del viewport.
      const dx = plng - viewport.center[0];
      const dy = -(plat - viewport.center[1]);
      // Escala lng→px ≈ ancho_px / ancho_lng; lat igual con su altura (Mercator local: relación constante).
      const pxPerLng = box.w / Math.max(1e-9, east - west);
      const pxPerLat = box.h / Math.max(1e-9, north - south);
      const vx = dx * pxPerLng;
      const vy = dy * pxPerLat;
      const angleDeg = (Math.atan2(vy, vx) * 180) / Math.PI;

      const cx = box.w / 2;
      const cy = (insetTop + (box.h - insetBottom)) / 2;
      const halfW = box.w / 2 - EDGE_PADDING;
      const halfH = (box.h - insetBottom - insetTop) / 2 - EDGE_PADDING / 2;
      const scale = Math.min(
        vx !== 0 ? halfW / Math.abs(vx) : Infinity,
        vy !== 0 ? halfH / Math.abs(vy) : Infinity
      );
      const x = cx + vx * scale;
      const y = cy + vy * scale;

      marker = (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          accessibilityLabel={`${partnerName} a ${distanceText}`}
          style={[styles.marker, { left: x - 22, top: y - 22 }]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.hudBackground, borderColor: theme.accentColor },
            ]}
          >
            <Text style={[styles.initial, { color: theme.textColor }]}>{partnerName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text
            style={[
              styles.arrow,
              {
                color: theme.accentColor,
                // ▶ apunta a +x; se rota hacia la pareja y se desplaza al exterior del avatar.
                transform: [{ rotate: `${angleDeg}deg` }, { translateX: 30 }],
              },
            ]}
          >
            ▶
          </Text>
          <View style={[styles.distancePill, { backgroundColor: theme.hudBackground, borderColor: theme.borderColor }]}>
            <Text style={[styles.distanceText, { color: theme.textColor }]}>{distanceText}</Text>
          </View>
        </TouchableOpacity>
      );
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {marker}
    </View>
  );
};

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: size.fab + 2,
    height: size.fab + 2,
    borderRadius: (size.fab + 2) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  initial: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  arrow: { position: 'absolute', fontSize: fontSize.body },
  distancePill: {
    position: 'absolute',
    bottom: -18,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.obsidianRaised,
  },
  distanceText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
});
