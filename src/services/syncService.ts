/**
 * TerraMaps - Offline-First Sync Service
 * 
 * Gestiona la sincronización inteligente entre el almacenamiento local y Supabase.
 * Aplica estrategia de envío en lotes (batching) para optimizar el plan gratuito de Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { storageService } from './storage';
import { H3Index } from '@/core';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalAreaKm2: number;
  explorationLevel: number;
  rank: number;
  isCurrentUser?: boolean;
}

export interface TerritoryKingInfo {
  zoneId: string;
  kingUserId: string;
  kingUsername: string;
  hexCount: number;
  updatedAt: string;
}

const STORAGE_UNSYNCED_HEXES = '@terramaps_unsynced_hexes';

class SyncService {
  private _syncInProgress: boolean = false;
  private _unsyncedHexagons: Set<string> = new Set<string>();

  constructor() {
    this.loadPendingFromStorage();
  }

  private loadPendingFromStorage(): void {
    try {
      const stored = storageService.getItem(STORAGE_UNSYNCED_HEXES);
      if (stored) {
        const hexList: string[] = JSON.parse(stored);
        if (Array.isArray(hexList)) {
          for (const h of hexList) {
            this._unsyncedHexagons.add(h);
          }
        }
      }
    } catch {
      // Ignorar fallback
    }
  }

  private persistPendingToStorage(): void {
    try {
      storageService.setItem(
        STORAGE_UNSYNCED_HEXES,
        JSON.stringify(Array.from(this._unsyncedHexagons))
      );
    } catch {
      // Ignorar fallback
    }
  }

  /**
   * Registra nuevos hexágonos para sincronización diferida
   */
  public queueHexagonsForSync(hexIds: string[]): void {
    for (const id of hexIds) {
      this._unsyncedHexagons.add(id);
    }
    this.persistPendingToStorage();
  }

  /**
   * Sincroniza los hexágonos pendientes con Supabase en lotes
   */
  public async syncPendingHexagons(): Promise<{ synced: number; failed: number }> {
    if (!isSupabaseConfigured()) {
      return { synced: 0, failed: 0 };
    }

    if (this._syncInProgress || this._unsyncedHexagons.size === 0) {
      return { synced: 0, failed: 0 };
    }

    this._syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Usuario no autenticado aún; mantener en cola local
        this._syncInProgress = false;
        return { synced: 0, failed: 0 };
      }

      const hexesToSync = Array.from(this._unsyncedHexagons);
      const batchSize = 100;

      for (let i = 0; i < hexesToSync.length; i += batchSize) {
        const batch = hexesToSync.slice(i, i + batchSize);
        const rows = batch.map((hexId) => ({
          user_id: user.id,
          hex_id: hexId,
          unlocked_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('unlocked_hexagons')
          .upsert(rows, { onConflict: 'user_id,hex_id' });

        if (error) {
          console.warn('[SyncService] Batch sync error:', error.message);
          failed += batch.length;
        } else {
          synced += batch.length;
          // Eliminar del conjunto pendiente los exitosos
          for (const hex of batch) {
            this._unsyncedHexagons.delete(hex);
          }
          this.persistPendingToStorage();
        }
      }
    } catch (err) {
      console.warn('[SyncService] Sync exception:', err);
    } finally {
      this._syncInProgress = false;
    }

    return { synced, failed };
  }

  /**
   * Obtiene la tabla de líderes / ranking territorial
   */
  public async getTerritoryLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!isSupabaseConfigured()) {
      // Mock data local si Supabase no está conectado
      return this.getLocalMockLeaderboard();
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_area_km2, exploration_level')
        .order('total_area_km2', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return this.getLocalMockLeaderboard();
      }

      const { data: { user } } = await supabase.auth.getUser();

      return data.map((profile, index) => ({
        userId: profile.id,
        username: profile.username || 'Explorador Anónimo',
        avatarUrl: profile.avatar_url,
        totalAreaKm2: Number(profile.total_area_km2) || 0,
        explorationLevel: profile.exploration_level || 1,
        rank: index + 1,
        isCurrentUser: user?.id === profile.id,
      }));
    } catch {
      return this.getLocalMockLeaderboard();
    }
  }

  /**
   * Obtiene los datos del Rey del Barrio de la zona actual
   */
  public async getTerritoryKing(zoneId: string): Promise<TerritoryKingInfo | null> {
    if (!isSupabaseConfigured() || !zoneId) {
      return {
        zoneId: zoneId || 'zone_alpha',
        kingUserId: 'king_local',
        kingUsername: 'Conquistador Local',
        hexCount: 42,
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const { data, error } = await supabase
        .from('territory_kings')
        .select('zone_id, king_user_id, hex_count, updated_at, profiles(username)')
        .eq('zone_id', zoneId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        zoneId: data.zone_id,
        kingUserId: data.king_user_id,
        kingUsername: (data as any).profiles?.username || 'Defensor de Zona',
        hexCount: data.hex_count,
        updatedAt: data.updated_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Genera una clasificación local de demostración
   */
  private getLocalMockLeaderboard(): LeaderboardEntry[] {
    const stats = storageService.getStats();

    return [
      {
        userId: 'current_user',
        username: 'Tú (Explorador)',
        avatarUrl: null,
        totalAreaKm2: stats.totalAreaKm2,
        explorationLevel: stats.explorationLevel,
        rank: 1,
        isCurrentUser: true,
      },
      {
        userId: 'user_2',
        username: 'Valkyria_CDMX',
        avatarUrl: null,
        totalAreaKm2: Math.max(1.2, stats.totalAreaKm2 * 0.8),
        explorationLevel: 3,
        rank: 2,
      },
      {
        userId: 'user_3',
        username: 'HexHunter99',
        avatarUrl: null,
        totalAreaKm2: Math.max(0.6, stats.totalAreaKm2 * 0.5),
        explorationLevel: 2,
        rank: 3,
      },
    ];
  }
}

export const syncService = new SyncService();
