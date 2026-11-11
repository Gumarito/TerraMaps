import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';

interface MobileDeviceSimulatorProps {
  children: React.ReactNode;
  accentColor?: string;
  isLightMode?: boolean;
}

export const MobileDeviceSimulator: React.FC<MobileDeviceSimulatorProps> = ({
  children,
  accentColor = '#00f5d4',
  isLightMode = false,
}) => {
  const { width, height } = useWindowDimensions();
  const [forceMobileFrame, setForceMobileFrame] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const isDesktopWeb = Platform.OS === 'web' && width > 540;

  if (!isDesktopWeb || !forceMobileFrame) {
    return <View style={styles.nativeContainer}>{children}</View>;
  }

  // Dimensiones simuladas de iPhone 16 Pro / Galaxy S24
  const phoneWidth = 390;
  const phoneHeight = Math.min(844, height - 60);
  const statusTextColor = isLightMode ? '#0f172a' : '#ffffff';

  return (
    <View style={styles.desktopCanvas}>
      {/* Barra superior de información del simulador en PC */}
      <View style={styles.simulatorHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
          <Text style={styles.headerTitle}>TERRAMAPS</Text>
          <Text style={styles.headerSubtitle}>SIMULADOR MÓVIL EN VIVO</Text>
        </View>

        <TouchableOpacity
          style={[styles.toggleBtn, { borderColor: accentColor }]}
          onPress={() => setForceMobileFrame(!forceMobileFrame)}
        >
          <Text style={[styles.toggleBtnText, { color: accentColor }]}>
            {forceMobileFrame ? '⛶ Pantalla Completa' : '📱 Marco Celular'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chasis físico del Smartphone */}
      <View
        style={[
          styles.phoneChassis,
          {
            width: phoneWidth,
            height: phoneHeight,
            borderColor: '#2d3748',
          },
        ]}
      >
        {/* Dynamic Island / Notch superior */}
        <View style={styles.phoneNotch}>
          <View style={styles.notchCamera} />
          <View style={[styles.notchSensor, { backgroundColor: accentColor }]} />
        </View>

        {/* Barra de estado simulada del celular */}
        <View style={styles.phoneStatusBar}>
          <Text style={[styles.phoneTimeText, { color: statusTextColor }]}>{currentTime}</Text>
          <View style={styles.phoneStatusIcons}>
            <Text style={[styles.phoneIconText, { color: statusTextColor }]}>5G</Text>
            <Text style={[styles.phoneIconText, { color: statusTextColor }]}>📶</Text>
            <Text style={[styles.phoneIconText, { color: statusTextColor }]}>🔋 98%</Text>
          </View>
        </View>

        {/* Pantalla del Celular interactiva */}
        <View style={styles.phoneScreen}>
          {children}
        </View>

        {/* Home Indicator inferior */}
        <View style={styles.phoneHomeBarContainer}>
          <View
            style={[
              styles.phoneHomeBar,
              { backgroundColor: isLightMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)' },
            ]}
          />
        </View>
      </View>

      <Text style={styles.footerHelp}>
        Haz clic y arrastra dentro del mapa para explorar. Usa los controles para iniciar rutas, simular caminatas y desplegar drones.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  nativeContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  desktopCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#07090e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  simulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 390,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginRight: 6,
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  phoneChassis: {
    position: 'relative',
    borderRadius: 44,
    borderWidth: 4,
    backgroundColor: '#000000',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 28,
    elevation: 25,
  },
  phoneNotch: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -55,
    width: 110,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#000000',
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  notchCamera: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#334155',
  },
  notchSensor: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
  phoneStatusBar: {
    position: 'absolute',
    top: 8,
    left: 20,
    right: 20,
    height: 28,
    zIndex: 99998,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  phoneTimeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  phoneStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneIconText: {
    fontSize: 10,
    fontWeight: '600',
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#0b0f19',
  },
  phoneHomeBarContainer: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99998,
    pointerEvents: 'none',
  },
  phoneHomeBar: {
    width: 130,
    height: 4,
    borderRadius: 2,
  },
  footerHelp: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 420,
  },
});
