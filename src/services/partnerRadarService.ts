/**
 * TerraMaps - Partner & Live Friends Radar Service (Modo Multijugador / Pareja)
 * 
 * Permite visualizar en el mapa a amigos y pareja en tiempo real:
 * - Avatar y nombre con apodo afectivo o badge.
 * - Modo de transporte activo (🚗 Auto, 🚶 Caminando, 🚴 Bici, ✈️ Vuelo).
 * - Nivel exacto de batería del celular (ej. 🔋 78%) y si está cargando.
 * - Velocidad instantánea en km/h.
 * - Dirección estimada y última actualización ("En vivo", "Hace 2 min").
 */

export interface TrackedPartner {
  id: string;
  name: string;
  relation: string; // '❤️ Pareja' | '🚴 Amigo' | '🏠 Familia'
  avatarEmoji: string;
  coordinates: [number, number]; // [lng, lat]
  transportMode: 'car' | 'walk' | 'bike' | 'flight' | 'still';
  transportEmoji: string;
  speedKmh: number;
  batteryPercent: number;
  isCharging: boolean;
  addressName: string;
  lastUpdatedText: string;
}

export type PartnerRadarListener = (partners: TrackedPartner[]) => void;

class PartnerRadarService {
  private isRadarEnabled: boolean = true;
  private partners: TrackedPartner[] = [];
  private listeners: Set<PartnerRadarListener> = new Set();
  private updateInterval: any = null;

  constructor() {
    this.initializeDefaultPartners();
    this.startSimulationUpdates();
  }

  private initializeDefaultPartners(): void {
    this.partners = [
      {
        id: 'partner_1',
        name: 'Valentina',
        relation: '❤️ Pareja',
        avatarEmoji: '👩‍🦰',
        coordinates: [-99.1677, 19.4270], // Cerca del Ángel de la Independencia
        transportMode: 'car',
        transportEmoji: '🚗',
        speedKmh: 42.5,
        batteryPercent: 84,
        isCharging: true,
        addressName: 'Paseo de la Reforma, Juárez',
        lastUpdatedText: 'En vivo',
      },
      {
        id: 'friend_2',
        name: 'Carlos Ruiz',
        relation: '🚴 Amigo',
        avatarEmoji: '🧔',
        coordinates: [-99.1625, 19.4180], // Roma Norte
        transportMode: 'bike',
        transportEmoji: '🚴',
        speedKmh: 18.2,
        batteryPercent: 57,
        isCharging: false,
        addressName: 'Álvaro Obregón, Roma Norte',
        lastUpdatedText: 'Hace 3 min',
      },
      {
        id: 'friend_3',
        name: 'Sofía M.',
        relation: '🏃 Amiga',
        avatarEmoji: '👱‍♀️',
        coordinates: [-99.1412, 19.4352], // Bellas Artes
        transportMode: 'walk',
        transportEmoji: '🚶',
        speedKmh: 4.8,
        batteryPercent: 91,
        isCharging: false,
        addressName: 'Av. Juárez, Alameda Central',
        lastUpdatedText: 'En vivo',
      },
    ];
  }

  private startSimulationUpdates(): void {
    if (typeof window === 'undefined') return;

    this.updateInterval = setInterval(() => {
      if (!this.isRadarEnabled) return;

      // Micro-desplazamiento en tiempo real para dar vida al mapa
      this.partners = this.partners.map((p) => {
        const deltaLng = (Math.random() - 0.48) * 0.0004;
        const deltaLat = (Math.random() - 0.48) * 0.0004;
        return {
          ...p,
          coordinates: [p.coordinates[0] + deltaLng, p.coordinates[1] + deltaLat],
          speedKmh: Math.max(0, Math.round((p.speedKmh + (Math.random() - 0.5) * 4) * 10) / 10),
        };
      });

      this.notify();
    }, 6000);
  }

  public getPartners(): TrackedPartner[] {
    return this.isRadarEnabled ? this.partners : [];
  }

  public getIsRadarEnabled(): boolean {
    return this.isRadarEnabled;
  }

  public toggleRadar(): boolean {
    this.isRadarEnabled = !this.isRadarEnabled;
    this.notify();
    return this.isRadarEnabled;
  }

  public subscribe(listener: PartnerRadarListener): () => void {
    this.listeners.add(listener);
    listener(this.getPartners());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const list = this.getPartners();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch (err) {
        console.warn('[PartnerRadarService] Listener error:', err);
      }
    });
  }
}

export const partnerRadarService = new PartnerRadarService();
