/**
 * TerraMaps - Achievements & Badges Gamification Engine
 * 
 * Gestiona insignias por:
 * 1. Distancia en vuelo / avión
 * 2. Ciudades exploradas
 * 3. Zonas urbanas y hexágonos conquistados
 * 4. Monumentos históricos descubiertos
 * 5. Calorías quemadas a pie
 * 6. Racha diaria de exploración
 */

import { storageService, UserStats } from './storage';

export interface TerraBadge {
  id: string;
  title: string;
  category: 'flight' | 'cities' | 'territory' | 'fitness' | 'streak' | 'history';
  iconEmoji: string;
  description: string;
  requiredMetric: number;
  currentMetric: number;
  isUnlocked: boolean;
  progressPercent: number;
}

export const ACHIEVEMENTS_STORAGE_KEY = '@terramaps_unlocked_achievements';

export class AchievementsService {
  /**
   * Evalúa y devuelve el catálogo completo de logros contra las estadísticas actuales
   */
  public getAchievements(
    userStats: UserStats,
    flightKm: number = 0,
    citiesCount: number = 1,
    discoveredLandmarksCount: number = 0,
    streakDays: number = 1,
    caloriesBurned: number = 0
  ): TerraBadge[] {
    const badges: Array<{
      id: string;
      title: string;
      category: TerraBadge['category'];
      iconEmoji: string;
      description: string;
      required: number;
      current: number;
    }> = [
      {
        id: 'flight_pilot',
        title: 'Piloto de Cielos',
        category: 'flight',
        iconEmoji: '✈️',
        description: 'Vuela más de 500 km en viajes aéreos registrados.',
        required: 500,
        current: Math.round(flightKm),
      },
      {
        id: 'cities_conqueror',
        title: 'Trotamundos',
        category: 'cities',
        iconEmoji: '🏙️',
        description: 'Explora y desbloquea territorio en al menos 3 ciudades.',
        required: 3,
        current: citiesCount,
      },
      {
        id: 'territory_baron',
        title: 'Señor Feudal',
        category: 'territory',
        iconEmoji: '👑',
        description: 'Conquista 50 sectores urbanos en el mapa.',
        required: 50,
        current: userStats.totalHexagons,
      },
      {
        id: 'territory_emperor',
        title: 'Emperador del Mapa',
        category: 'territory',
        iconEmoji: '🌍',
        description: 'Conquista 200 sectores urbanos.',
        required: 200,
        current: userStats.totalHexagons,
      },
      {
        id: 'calorie_burner',
        title: 'Máquina Metabólica',
        category: 'fitness',
        iconEmoji: '🔥',
        description: 'Quema 300 kcal explorando a pie o en bicicleta.',
        required: 300,
        current: caloriesBurned,
      },
      {
        id: 'streak_master',
        title: 'Explorador Incansable',
        category: 'streak',
        iconEmoji: '⚡',
        description: 'Mantén una racha de 7 días consecutivos saliendo a explorar.',
        required: 7,
        current: streakDays,
      },
      {
        id: 'history_buff',
        title: 'Arqueólogo Urbano',
        category: 'history',
        iconEmoji: '🏛️',
        description: 'Descubre al menos 3 monumentos históricos de la ciudad.',
        required: 3,
        current: discoveredLandmarksCount,
      },
    ];

    return badges.map((b) => {
      const isUnlocked = b.current >= b.required;
      const progressPercent = Math.min(100, Math.round((b.current / b.required) * 100));
      return {
        id: b.id,
        title: b.title,
        category: b.category,
        iconEmoji: b.iconEmoji,
        description: b.description,
        requiredMetric: b.required,
        currentMetric: b.current,
        isUnlocked,
        progressPercent,
      };
    });
  }
}

export const achievementsService = new AchievementsService();
