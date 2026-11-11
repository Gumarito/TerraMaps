/**
 * TerraMaps - Local Storage & Persistence Service
 * 
 * Ofrece persistencia ultraligera para los hexágonos desbloqueados.
 * Diseñado para O(1) lookups, caching de estadísticas y persistencia debounced en Web.
 */

import {
  validateSafeStorageKey,
  validateH3Index,
  safeJsonParse,
} from '@/core/security';

export interface UserStats {
  totalHexagons: number;
  totalAreaM2: number;
  totalAreaKm2: number;
  formattedArea: string;
  currentStreakDays: number;
  explorationLevel: number;
}

const STORAGE_KEY_HEXES = '@terramaps_unlocked_hexagons';
const STORAGE_KEY_STATS = '@terramaps_user_stats';

// Área realista de visión a nivel de calle (cobertura visual de banqueta y arroyo vehicular: ~1,250 m²)
export const REALISTIC_STREET_AREA_M2 = 1250;
export const H3_RES_9_AREA_KM2 = 0.00125;

class StorageService {
  private inMemoryHexagons: Set<string> = new Set<string>();
  private inMemoryStore: Map<string, string> = new Map<string, string>();
  private cachedStats: UserStats | null = null;
  private cachedStatsHexCount: number = -1;
  private persistTimeout: any = null;

  /**
   * Obtiene un valor arbitrario por clave (Web localStorage con fallback in-memory)
   * Valida estrictamente la clave para prevenir prototype pollution y path traversal.
   */
  public getItem(key: string): string | null {
    if (!validateSafeStorageKey(key)) {
      console.warn(`[StorageService] Clave de almacenamiento rechazada por seguridad: "${key}"`);
      return null;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      } catch {
        // Fallback
      }
    }
    return this.inMemoryStore.get(key) ?? null;
  }

  /**
   * Guarda un valor arbitrario por clave.
   * Aplica límite de tamaño por payload (5MB) para evitar DoS por cuota agotada de localStorage.
   */
  public setItem(key: string, value: string): void {
    if (!validateSafeStorageKey(key)) {
      console.warn(`[StorageService] Clave rechazada al guardar: "${key}"`);
      return;
    }

    const MAX_VALUE_SIZE = 5 * 1024 * 1024; // 5MB
    if (typeof value !== 'string' || value.length > MAX_VALUE_SIZE) {
      console.warn(`[StorageService] Valor rechazado para "${key}": excede el límite de 5MB.`);
      return;
    }

    this.inMemoryStore.set(key, value);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (err: any) {
        // Manejo elegante de QuotaExceededError
        if (err?.name === 'QuotaExceededError' || err?.code === 22) {
          console.warn('[StorageService] Quota de localStorage excedida. Operando en modo memoria.');
        }
      }
    }
  }

  /**
   * Elimina un valor almacenado por clave
   */
  public removeItem(key: string): void {
    if (!validateSafeStorageKey(key)) {
      return;
    }
    this.inMemoryStore.delete(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Fallback
      }
    }
  }

  public loadUnlockedHexagonsSync(): Set<string> {
    try {
      if (this.inMemoryHexagons.size > 0) {
        return this.inMemoryHexagons;
      }
      const raw = this.getItem(STORAGE_KEY_HEXES);
      if (raw) {
        const parsed = safeJsonParse<unknown[]>(raw, [], 15 * 1024 * 1024);
        if (Array.isArray(parsed)) {
          const MAX_HEXES = 500000;
          for (let i = 0; i < parsed.length && this.inMemoryHexagons.size < MAX_HEXES; i++) {
            const h = parsed[i];
            if (typeof h === 'string' && validateH3Index(h)) {
              this.inMemoryHexagons.add(h);
            }
          }
        }
      }
      return this.inMemoryHexagons;
    } catch {
      return this.inMemoryHexagons;
    }
  }

  /**
   * Carga los hexágonos iniciales en memoria con validación estricta de esquemas
   */
  public async loadUnlockedHexagons(): Promise<Set<string>> {
    try {
      if (this.inMemoryHexagons.size > 0) {
        return this.inMemoryHexagons;
      }

      const raw = this.getItem(STORAGE_KEY_HEXES);
      if (raw) {
        const parsed = safeJsonParse<unknown[]>(raw, [], 15 * 1024 * 1024);
        if (Array.isArray(parsed)) {
          const MAX_HEXES = 500000;
          for (let i = 0; i < parsed.length && this.inMemoryHexagons.size < MAX_HEXES; i++) {
            const h = parsed[i];
            if (typeof h === 'string' && validateH3Index(h)) {
              this.inMemoryHexagons.add(h);
            }
          }
        }
      }

      return this.inMemoryHexagons;
    } catch (error) {
      console.warn('[StorageService] Error loading hexagons:', error);
      return this.inMemoryHexagons;
    }
  }

  /**
   * Guarda de forma atómica nuevos hexágonos con persistencia debounced
   * Valida estrictamente cada hexágono H3 antes de insertarlo.
   */
  public async saveHexagons(newHexes: string[]): Promise<void> {
    if (!Array.isArray(newHexes)) return;

    let addedAny = false;
    const MAX_HEXES = 500000;

    for (const h of newHexes) {
      if (typeof h === 'string' && validateH3Index(h)) {
        if (!this.inMemoryHexagons.has(h) && this.inMemoryHexagons.size < MAX_HEXES) {
          this.inMemoryHexagons.add(h);
          addedAny = true;
        }
      }
    }

    if (!addedAny) return;

    // Invalidar cache de stats
    this.cachedStats = null;

    // Debounce la serialización a localStorage para ahorrar CPU
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(() => {
      this.flushHexagonsToDisk();
    }, 250);
  }

  /**
   * Elimina hexágonos específicos del almacenamiento persistente (Goma de Borrar / Limpieza Táctica)
   * Recalcula estadísticas y programa la sincronización.
   */
  public removeHexagons(hexIdsToRemove: string[]): number {
    if (!Array.isArray(hexIdsToRemove) || hexIdsToRemove.length === 0) return 0;

    let removedCount = 0;
    for (const h of hexIdsToRemove) {
      if (this.inMemoryHexagons.delete(h)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.cachedStats = null;
      this.cachedStatsHexCount = -1;
      if (this.persistTimeout) {
        clearTimeout(this.persistTimeout);
      }
      this.persistTimeout = setTimeout(() => {
        this.flushHexagonsToDisk();
      }, 250);
    }

    return removedCount;
  }

  /**
   * Escribe inmediatamente el conjunto de hexágonos a almacenamiento persistente.
   */
  public flushHexagonsToDisk(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    try {
      this.setItem(STORAGE_KEY_HEXES, JSON.stringify(Array.from(this.inMemoryHexagons)));
    } catch (e) {
      console.warn('[StorageService] Error persisting hexagons:', e);
    }
  }

  /**
   * Obtiene las estadísticas acumuladas (Memoizado en O(1))
   */
  public getStats(): UserStats {
    const totalHex = this.inMemoryHexagons.size;
    if (this.cachedStats && this.cachedStatsHexCount === totalHex) {
      return this.cachedStats;
    }

    const totalAreaM2 = totalHex * REALISTIC_STREET_AREA_M2;
    const totalAreaKm2 = Number((totalAreaM2 / 1000000).toFixed(4));
    const formattedArea =
      totalAreaM2 < 10000
        ? `${Math.round(totalAreaM2).toLocaleString('es-MX')} m²`
        : `${(totalAreaM2 / 1000000).toFixed(2)} km²`;
    const level = Math.max(1, Math.floor(Math.sqrt(totalHex / 5)));

    const freshStats: UserStats = {
      totalHexagons: totalHex,
      totalAreaM2,
      totalAreaKm2,
      formattedArea,
      currentStreakDays: 1,
      explorationLevel: level,
    };

    this.cachedStats = freshStats;
    this.cachedStatsHexCount = totalHex;

    return freshStats;
  }

  /**
   * Comprueba si un hexágono ya fue descubierto (O(1))
   */
  public isUnlocked(hexId: string): boolean {
    return this.inMemoryHexagons.has(hexId);
  }

  /**
   * Devuelve todos los hexágonos en un array
   */
  public getAllHexagons(): string[] {
    return Array.from(this.inMemoryHexagons);
  }
}

export const storageService = new StorageService();
