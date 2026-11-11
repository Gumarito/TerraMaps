/**
 * TerraMaps - Regional Metrics & Health/Calories Engine
 * 
 * Calcula:
 * 1. Porcentaje de exploración territorial real:
 *    - Municipio / Alcaldía local (ej. Cuauhtémoc: ~32.4 km²)
 *    - Ciudad / Metrópoli (ej. Ciudad de México: ~1,485 km²)
 *    - País (ej. México: ~1,972,550 km²)
 * 2. Estimación de gasto calórico por actividad física y distancia diaria acumulada.
 * 3. Tiempo activo transcurrido en movimiento.
 */

// Áreas geográficas oficiales en metros cuadrados (m²)
export const REGIONAL_AREAS_M2 = {
  BOROUGH_CUAUHTEMOC_M2: 32.4 * 1_000_000,     // 32.4 km²
  CITY_CDMX_M2: 1_485 * 1_000_000,             // 1,485 km²
  COUNTRY_MEXICO_M2: 1_972_550 * 1_000_000,     // 1.97M km² (1,972,550 km² * 10^6 m²/km²)
};

export const REGIONAL_CITY_NAMES = [
  'Ciudad de México',
  'Torreón',
  'Monterrey',
  'Guadalajara',
  'Cancún',
] as const;

export interface RegionalMonumentCoordinate {
  id: string;
  name: string;
  city: (typeof REGIONAL_CITY_NAMES)[number];
  coordinates: readonly [longitude: number, latitude: number]; // WGS84 [lng, lat]
}

export const REGIONAL_MONUMENT_COORDINATES: readonly RegionalMonumentCoordinate[] = [
  {
    id: 'torreon_cristo_noas',
    name: 'Cristo de las Noas',
    city: 'Torreón',
    coordinates: [-103.4473, 25.5358],
  },
  {
    id: 'torreon_plaza_mayor',
    name: 'Plaza Mayor de Torreón',
    city: 'Torreón',
    coordinates: [-103.4552, 25.5428],
  },
  {
    id: 'monterrey_parque_fundidora',
    name: 'Parque Fundidora',
    city: 'Monterrey',
    coordinates: [-100.2837, 25.6786],
  },
  {
    id: 'monterrey_macroplaza',
    name: 'Macroplaza',
    city: 'Monterrey',
    coordinates: [-100.309, 25.6667],
  },
  {
    id: 'guadalajara_hospicio_cabanas',
    name: 'Hospicio Cabañas',
    city: 'Guadalajara',
    coordinates: [-103.3384, 20.6769],
  },
  {
    id: 'guadalajara_minerva',
    name: 'Glorieta de La Minerva',
    city: 'Guadalajara',
    coordinates: [-103.3917, 20.6736],
  },
  {
    id: 'cancun_torre_escenica',
    name: 'Torre Escénica de Cancún',
    city: 'Cancún',
    coordinates: [-86.7442, 21.1619],
  },
] as const;

export interface RegionalExplorationStats {
  boroughName: string;
  boroughPercent: number;        // ej. 0.12%
  boroughFormatted: string;      // ej. "0.12%"
  cityName: string;
  cityPercent: number;           // ej. 0.02%
  cityFormatted: string;         // ej. "0.02%"
  countryName: string;
  countryPercent: number;        // ej. 0.0001%
  countryFormatted: string;
  caloriesBurned: number;        // ej. 184 kcal
  dailyDistanceKm: number;       // ej. 2.8 km
  activeTimeFormatted: string;   // ej. "42 min"
  estimatedSteps: number;        // ej. 3680 pasos
  regionalCities: readonly string[];
}

export function calculateRegionalMetrics(
  totalAreaM2: number,
  dailyDistanceMeters: number = 0,
  activeSeconds: number = 0
): RegionalExplorationStats {
  // 1. Porcentajes de conquista territorial
  const boroughPct = Math.min(100, (totalAreaM2 / REGIONAL_AREAS_M2.BOROUGH_CUAUHTEMOC_M2) * 100);
  const cityPct = Math.min(100, (totalAreaM2 / REGIONAL_AREAS_M2.CITY_CDMX_M2) * 100);
  const countryPct = Math.min(100, (totalAreaM2 / REGIONAL_AREAS_M2.COUNTRY_MEXICO_M2) * 100);

  // 2. Estimación calórica y contador de pasos (longitud de zancada promedio = 0.762m => 1312 pasos/km)
  const distKm = dailyDistanceMeters > 0 ? dailyDistanceMeters / 1000 : (totalAreaM2 / 1250) * 0.035;
  const steps = Math.max(120, Math.round(distKm * 1312));
  const calories = Math.round(distKm * 65);

  // 3. Formateo de tiempo activo
  const mins = activeSeconds > 0 ? Math.floor(activeSeconds / 60) : Math.round(distKm * 12);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const timeFormatted = hours > 0 ? `${hours}h ${remMins}m` : `${Math.max(1, remMins)} min`;

  return {
    boroughName: 'Alcaldía Cuauhtémoc',
    boroughPercent: boroughPct,
    boroughFormatted: boroughPct < 0.01 ? `${boroughPct.toFixed(3)}%` : `${boroughPct.toFixed(2)}%`,
    cityName: 'Ciudad de México',
    cityPercent: cityPct,
    cityFormatted: cityPct < 0.01 ? `${cityPct.toFixed(4)}%` : `${cityPct.toFixed(2)}%`,
    countryName: 'México',
    countryPercent: countryPct,
    countryFormatted: countryPct < 0.0001 ? '<0.001%' : `${countryPct.toFixed(4)}%`,
    caloriesBurned: Math.max(15, calories),
    dailyDistanceKm: Math.round(distKm * 10) / 10,
    activeTimeFormatted: timeFormatted,
    estimatedSteps: steps,
    regionalCities: REGIONAL_CITY_NAMES,
  };
}
