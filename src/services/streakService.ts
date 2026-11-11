import { storageService } from './storage';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // Formato YYYY-MM-DD
  todayDiscoveredCount: number;
  shieldCount: number; // Escudos para proteger la racha si un día no se camina
  isTodayActive: boolean;
}

const STREAK_STORAGE_KEY = '@terramaps_streak_data';

export type StreakListener = (data: StreakData) => void;

class StreakService {
  private data: StreakData = {
    currentStreak: 1,
    longestStreak: 1,
    lastActiveDate: null,
    todayDiscoveredCount: 0,
    shieldCount: 1,
    isTodayActive: false,
  };

  private listeners: Set<StreakListener> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private getYesterdayString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  private loadFromStorage(): void {
    const stored = storageService.getItem(STREAK_STORAGE_KEY);
    const today = this.getTodayString();
    const yesterday = this.getYesterdayString();

    if (stored) {
      try {
        const parsed: Partial<StreakData> = JSON.parse(stored);
        this.data = {
          currentStreak: parsed.currentStreak ?? 1,
          longestStreak: parsed.longestStreak ?? 1,
          lastActiveDate: parsed.lastActiveDate ?? null,
          todayDiscoveredCount: parsed.lastActiveDate === today ? (parsed.todayDiscoveredCount ?? 0) : 0,
          shieldCount: parsed.shieldCount ?? 1,
          isTodayActive: parsed.lastActiveDate === today,
        };

        // Verificar si la racha se rompió por inactividad
        if (this.data.lastActiveDate && this.data.lastActiveDate !== today && this.data.lastActiveDate !== yesterday) {
          // Pasaron 2 o más días sin registrarse
          if (this.data.shieldCount > 0) {
            // El escudo protegió la racha
            this.data.shieldCount -= 1;
          } else {
            // Racha reseteada a 1
            this.data.currentStreak = 1;
          }
        }
      } catch {
        // En caso de corrupción, mantener defaults
      }
    } else {
      // Primera vez: día 1
      this.data.lastActiveDate = today;
      this.data.isTodayActive = true;
      this.data.todayDiscoveredCount = 1;
    }
    this.saveToStorage();
  }

  private saveToStorage(): void {
    storageService.setItem(STREAK_STORAGE_KEY, JSON.stringify(this.data));
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.data });
      } catch {
        // Ignorar fallas en listeners externos
      }
    }
  }

  public getStreakData(): StreakData {
    return { ...this.data };
  }

  public recordDiscovery(hexCount: number = 1): { streakIncreased: boolean; data: StreakData } {
    const today = this.getTodayString();
    const yesterday = this.getYesterdayString();
    let streakIncreased = false;

    if (this.data.lastActiveDate === today) {
      // Ya estaba activo hoy, solo sumamos hexágonos
      this.data.todayDiscoveredCount += hexCount;
    } else {
      // Primera actividad del día
      if (this.data.lastActiveDate === yesterday) {
        // Racha consecutiva
        this.data.currentStreak += 1;
        if (this.data.currentStreak > this.data.longestStreak) {
          this.data.longestStreak = this.data.currentStreak;
        }
        streakIncreased = true;
      } else if (this.data.lastActiveDate === null) {
        this.data.currentStreak = 1;
      } else {
        // Se perdió el día de ayer
        if (this.data.shieldCount > 0) {
          this.data.shieldCount -= 1;
          this.data.currentStreak += 1;
        } else {
          this.data.currentStreak = 1;
        }
      }

      this.data.lastActiveDate = today;
      this.data.todayDiscoveredCount = hexCount;
      this.data.isTodayActive = true;
    }

    this.saveToStorage();
    return { streakIncreased, data: { ...this.data } };
  }

  public addShield(): void {
    this.data.shieldCount += 1;
    this.saveToStorage();
  }

  public subscribe(listener: StreakListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.data });
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const streakService = new StreakService();
