/**
 * TerraMaps Geo Core - Regional Landmarks & Historical Points of Interest
 * 
 * Define monumentos y puntos icónicos con coordenadas reales, categoría y
 * cálculo de distancia/desbloqueo territorial para dar propósito y metas de viaje al usuario.
 */

import { coordinateToH3 } from './h3Engine';
import { haversineDistanceMeters } from '../battery/batteryShield';

export interface RegionalLandmark {
  id: string;
  name: string;
  region?: string;
  category: 'monument' | 'culture' | 'park' | 'sports' | 'historic';
  categoryLabel: string;
  emoji: string;
  coordinates: [number, number]; // [lng, lat]
  h3Cell: string;
  description: string;
  xpBonus: number;
}

export const CDMX_LANDMARKS: RegionalLandmark[] = [
  {
    id: 'zocalo',
    name: 'Zócalo & Catedral Metropolitana',
    category: 'historic',
    categoryLabel: 'Centro Histórico',
    emoji: '👑',
    coordinates: [-99.1332, 19.4326],
    h3Cell: coordinateToH3(19.4326, -99.1332),
    description: 'Corazón político y cultural de México, fundado sobre la antigua Tenochtitlan.',
    xpBonus: 500,
  },
  {
    id: 'bellas_artes',
    name: 'Palacio de Bellas Artes',
    category: 'culture',
    categoryLabel: 'Arte y Ópera',
    emoji: '🏛️',
    coordinates: [-99.1412, 19.4352],
    h3Cell: coordinateToH3(19.4352, -99.1412),
    description: 'Obra cumbre de mármol de Carrara y vitrales Tiffany en la Alameda Central.',
    xpBonus: 350,
  },
  {
    id: 'monumento_revolucion',
    name: 'Monumento a la Revolución',
    category: 'monument',
    categoryLabel: 'Monumento Cívico',
    emoji: '🦅',
    coordinates: [-99.1545, 19.4362],
    h3Cell: coordinateToH3(19.4362, -99.1545),
    description: 'Mausoleo cúpula art déco de 67 metros de altura en la Plaza de la República.',
    xpBonus: 300,
  },
  {
    id: 'angel_independencia',
    name: 'Ángel de la Independencia',
    category: 'monument',
    categoryLabel: 'Emblema Nacional',
    emoji: '🗽',
    coordinates: [-99.1677, 19.4270],
    h3Cell: coordinateToH3(19.4270, -99.1677),
    description: 'Columna de la Victoria Alada sobre Paseo de la Reforma inaugurada en 1910.',
    xpBonus: 400,
  },
  {
    id: 'castillo_chapultepec',
    name: 'Castillo de Chapultepec',
    category: 'historic',
    categoryLabel: 'Historia Imperial',
    emoji: '🏰',
    coordinates: [-99.1818, 19.4204],
    h3Cell: coordinateToH3(19.4204, -99.1818),
    description: 'Único castillo real de la era monárquica construido en el continente americano.',
    xpBonus: 450,
  },
  {
    id: 'parque_mexico',
    name: 'Parque México (Condesa)',
    category: 'park',
    categoryLabel: 'Espacio Verde',
    emoji: '🌿',
    coordinates: [-99.1685, 19.4125],
    h3Cell: coordinateToH3(19.4125, -99.1685),
    description: 'Jardín art déco de la colonia Condesa, punto neurálgico de caminantes y ciclistas.',
    xpBonus: 250,
  },
  {
    id: 'coyoacan_frida',
    name: 'Casa Azul - Museo Frida Kahlo',
    category: 'culture',
    categoryLabel: 'Cultura y Pintura',
    emoji: '🎨',
    coordinates: [-99.1625, 19.3551],
    h3Cell: coordinateToH3(19.3551, -99.1625),
    description: 'Hogar histórico y museo de la célebre pintora mexicana en el barrio de Coyoacán.',
    xpBonus: 350,
  },
  {
    id: 'estadio_azteca',
    name: 'Estadio Azteca (Coloso de Santa Úrsula)',
    category: 'sports',
    categoryLabel: 'Catedral del Fútbol',
    emoji: '⚽',
    coordinates: [-99.1506, 19.3029],
    h3Cell: coordinateToH3(19.3029, -99.1506),
    description: 'Templo mundialista sede de dos finales de la Copa del Mundo (Pelé 1970, Maradona 1986).',
    xpBonus: 400,
  },
];

export const REGIONAL_LANDMARKS: RegionalLandmark[] = [
  ...CDMX_LANDMARKS,
  {
    id: 'torreon_cristo_noas',
    name: 'Cristo de las Noas',
    region: 'Torreón',
    category: 'monument',
    categoryLabel: 'Monumento Regional',
    emoji: '◈',
    coordinates: [-103.4473, 25.5358],
    h3Cell: coordinateToH3(25.5358, -103.4473),
    description: 'Monumento monumental de Torreón con vista panorámica de la Comarca Lagunera.',
    xpBonus: 400,
  },
  {
    id: 'torreon_plaza_mayor',
    name: 'Plaza Mayor de Torreón',
    region: 'Torreón',
    category: 'historic',
    categoryLabel: 'Centro Cívico',
    emoji: '◫',
    coordinates: [-103.4552, 25.5428],
    h3Cell: coordinateToH3(25.5428, -103.4552),
    description: 'Plaza cívica del centro de Torreón, reconocible por su identidad urbana contemporánea.',
    xpBonus: 300,
  },
  {
    id: 'monterrey_parque_fundidora',
    name: 'Parque Fundidora',
    region: 'Monterrey',
    category: 'park',
    categoryLabel: 'Patrimonio Industrial',
    emoji: '◎',
    coordinates: [-100.2837, 25.6786],
    h3Cell: coordinateToH3(25.6786, -100.2837),
    description: 'Parque urbano construido sobre la antigua Fundidora de Fierro y Acero de Monterrey.',
    xpBonus: 350,
  },
  {
    id: 'monterrey_macroplaza',
    name: 'Macroplaza',
    region: 'Monterrey',
    category: 'historic',
    categoryLabel: 'Plaza Cívica',
    emoji: '◈',
    coordinates: [-100.309, 25.6667],
    h3Cell: coordinateToH3(25.6667, -100.309),
    description: 'Gran espacio público del centro de Monterrey, rodeado de edificios históricos y culturales.',
    xpBonus: 300,
  },
  {
    id: 'guadalajara_hospicio_cabanas',
    name: 'Hospicio Cabañas',
    region: 'Guadalajara',
    category: 'culture',
    categoryLabel: 'Patrimonio Cultural',
    emoji: '◫',
    coordinates: [-103.3384, 20.6769],
    h3Cell: coordinateToH3(20.6769, -103.3384),
    description: 'Complejo histórico y museo declarado Patrimonio Mundial por la UNESCO.',
    xpBonus: 400,
  },
  {
    id: 'guadalajara_minerva',
    name: 'Glorieta de La Minerva',
    region: 'Guadalajara',
    category: 'monument',
    categoryLabel: 'Emblema Urbano',
    emoji: '◎',
    coordinates: [-103.3917, 20.6736],
    h3Cell: coordinateToH3(20.6736, -103.3917),
    description: 'Monumento icónico de Guadalajara dedicado a la diosa romana de la sabiduría.',
    xpBonus: 350,
  },
  {
    id: 'cancun_torre_escenica',
    name: 'Torre Escénica de Cancún',
    region: 'Cancún',
    category: 'monument',
    categoryLabel: 'Mirador Costero',
    emoji: '◈',
    coordinates: [-86.7442, 21.1619],
    h3Cell: coordinateToH3(21.1619, -86.7442),
    description: 'Mirador giratorio con vistas de la zona hotelera y el litoral del Caribe mexicano.',
    xpBonus: 400,
  },
];

export interface LandmarkDiscoveryStatus {
  landmark: RegionalLandmark;
  isDiscovered: boolean;
  distanceMeters: number;
}

export function evaluateLandmarksDiscovery(
  unlockedHexes: Set<string> | string[],
  userLat: number,
  userLng: number
): LandmarkDiscoveryStatus[] {
  const hexSet = Array.isArray(unlockedHexes) ? new Set(unlockedHexes) : unlockedHexes;
  return REGIONAL_LANDMARKS.map((lm) => {
    const isDiscovered = hexSet.has(lm.h3Cell);
    const distanceMeters = Math.round(
      haversineDistanceMeters(
        { latitude: userLat, longitude: userLng },
        { latitude: lm.coordinates[1], longitude: lm.coordinates[0] }
      )
    );
    return {
      landmark: lm,
      isDiscovered,
      distanceMeters,
    };
  });
}
