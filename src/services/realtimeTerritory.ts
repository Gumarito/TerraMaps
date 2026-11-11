/**
 * TerraMaps - Realtime Territory & Social Exploration Service
 * 
 * Arquitectura Cero Costo (Supabase Free Tier):
 * - Canal Realtime multiplexado único para evitar exceder el límite de 200 conexiones concurrentes.
 * - Suscripción eficiente a cambios de Postgres ('postgres_changes') en 'territory_kings'.
 * - Detección y alerta inmediata cuando el "Rey del Barrio" cambia de manos (Coronado, Destronado, Usurpado).
 * - Suscripción a hexágonos de amigos ('unlocked_hexagons') para niebla compartida social.
 * - Gestión de ciclo de vida automática (auto-unsubscribe cuando no hay observadores activos).
 * - Resiliencia offline y emulador de eventos para pruebas sin conexión.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { authService } from './authService';
import {
  sanitizeUsername,
  sanitizeString,
} from '@/core/security';

export type KingChangeType = 'CROWNED' | 'DETHRONED' | 'USURPED' | 'STRENGTHENED';

export interface TerritoryKingData {
  zoneId: string;
  kingUserId: string | null;
  kingUsername: string;
  hexCount: number;
  updatedAt: string;
}

export interface KingChangeEvent {
  zoneId: string;
  previousKingId: string | null;
  previousKingUsername?: string;
  newKingId: string | null;
  newKingUsername: string;
  hexCount: number;
  changeType: KingChangeType;
  isCurrentUserNewKing: boolean;
  isCurrentUserDethroned: boolean;
  message: string;
  timestamp: string;
}

export interface FriendHexagonEvent {
  userId: string;
  username: string;
  hexId: string;
  unlockedAt: string;
}

export type TerritoryAlertCallback = (event: KingChangeEvent) => void;
export type FriendHexCallback = (event: FriendHexagonEvent) => void;

class RealtimeTerritoryService {
  private channel: RealtimeChannel | null = null;
  private kingListeners: Set<TerritoryAlertCallback> = new Set<TerritoryAlertCallback>();
  private friendHexListeners: Set<FriendHexCallback> = new Set<FriendHexCallback>();
  private activeFriendIds: Set<string> = new Set<string>();

  // Caché de reyes de zona para calcular transiciones y comparaciones
  private zoneKingsCache: Map<string, { kingUserId: string | null; username: string }> = new Map();
  // Caché de nombres de usuario para evitar lecturas excesivas a la tabla 'profiles'
  private usernameCache: Map<string, string> = new Map();

  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 3;

  /**
   * Suscribe un callback para recibir alertas de cambios en el "Rey del Barrio"
   * Devuelve una función para cancelar la suscripción
   */
  public subscribeToTerritoryKings(callback: TerritoryAlertCallback): () => void {
    this.kingListeners.add(callback);
    this.ensureRealtimeConnection();

    return () => {
      this.kingListeners.delete(callback);
      this.checkAndCleanupChannel();
    };
  }

  /**
   * Suscribe un callback para ver la exploración de hexágonos de amigos en tiempo real
   */
  public subscribeToFriendHexagons(
    friendUserIds: string[],
    callback: FriendHexCallback
  ): () => void {
    for (const id of friendUserIds) {
      this.activeFriendIds.add(id);
    }
    this.friendHexListeners.add(callback);
    this.ensureRealtimeConnection();

    return () => {
      this.friendHexListeners.delete(callback);
      this.checkAndCleanupChannel();
    };
  }

  /**
   * Inicializa el canal Realtime de Supabase (canal multiplexado único para optimizar Free Tier)
   */
  private ensureRealtimeConnection(): void {
    if (this.channel || !isSupabaseConfigured()) {
      return;
    }

    try {
      this.channel = supabase
        .channel('terramaps_realtime_territory')
        // 1. Escuchar cambios de coronas en 'territory_kings'
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'territory_kings',
          },
          (payload) => {
            this.handleTerritoryKingChange(payload);
          }
        )
        // 2. Escuchar hexágonos descubiertos por amigos en 'unlocked_hexagons'
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'unlocked_hexagons',
          },
          (payload) => {
            this.handleUnlockedHexagonInsert(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.isConnected = true;
            this.connectionRetries = 0;
            console.log('[RealtimeTerritory] Conectado exitosamente al canal en tiempo real.');
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            this.isConnected = false;
            console.warn(`[RealtimeTerritory] Error en canal Realtime (${status}).`);
            this.handleReconnect();
          } else if (status === 'CLOSED') {
            this.isConnected = false;
          }
        });
    } catch (err) {
      console.warn('[RealtimeTerritory] Error inicializando suscripción en tiempo real:', err);
      this.isConnected = false;
    }
  }

  /**
   * Procesa un evento de la tabla 'territory_kings'
   */
  private async handleTerritoryKingChange(payload: any): Promise<void> {
    const newRecord = payload.new;
    const oldRecord = payload.old;

    if (!newRecord || !newRecord.zone_id) {
      return;
    }

    const zoneId = newRecord.zone_id;
    const newKingId: string | null = newRecord.king_user_id || null;
    const hexCount: number = Number(newRecord.hex_count) || 0;
    const currentUserId = authService.getCurrentUserId();

    // Obtener información del rey anterior (desde caché local o payload)
    const cachedPrevious = this.zoneKingsCache.get(zoneId);
    const previousKingId: string | null = oldRecord?.king_user_id ?? cachedPrevious?.kingUserId ?? null;
    const previousKingUsername = cachedPrevious?.username ? sanitizeUsername(cachedPrevious.username) : undefined;

    // Obtener o resolver nombre del nuevo rey con sanitización estricta
    let newKingUsername = 'Explorador Desconocido';
    if (newKingId) {
      if (currentUserId && newKingId === currentUserId) {
        newKingUsername = sanitizeUsername(authService.getProfile()?.username || 'Tú');
      } else {
        const resolved = await this.resolveUsername(newKingId);
        newKingUsername = sanitizeUsername(resolved);
      }
    }

    // Actualizar caché
    this.zoneKingsCache.set(zoneId, { kingUserId: newKingId, username: newKingUsername });

    // Determinar tipo de cambio
    const isCurrentUserNewKing = Boolean(currentUserId && newKingId === currentUserId);
    const isCurrentUserDethroned = Boolean(currentUserId && previousKingId === currentUserId && newKingId !== currentUserId);

    let changeType: KingChangeType = 'USURPED';
    let alertMessage = '';

    const safeZoneTag = sanitizeString(zoneId.slice(-6), 10);

    if (isCurrentUserNewKing && previousKingId !== currentUserId) {
      changeType = 'CROWNED';
      alertMessage = `👑 ¡Eres el nuevo Rey del Barrio en la zona ${safeZoneTag}! Conquistaste ${hexCount} hexágonos.`;
    } else if (isCurrentUserDethroned) {
      changeType = 'DETHRONED';
      alertMessage = `⚔️ ¡Alerta táctica! ${newKingUsername} te ha destronado en el barrio ${safeZoneTag}.`;
    } else if (previousKingId === newKingId) {
      changeType = 'STRENGTHENED';
      alertMessage = `🛡️ ${newKingUsername} fortaleció su territorio (${hexCount} hexágonos).`;
    } else {
      changeType = 'USURPED';
      alertMessage = `👑 ${newKingUsername} arrebató la corona de la zona ${safeZoneTag}.`;
    }

    const event: KingChangeEvent = {
      zoneId: sanitizeString(zoneId, 32),
      previousKingId,
      previousKingUsername,
      newKingId,
      newKingUsername,
      hexCount,
      changeType,
      isCurrentUserNewKing,
      isCurrentUserDethroned,
      message: sanitizeString(alertMessage, 200),
      timestamp: newRecord.updated_at || new Date().toISOString(),
    };

    // Emitir alerta a todos los observadores registrados
    for (const listener of this.kingListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RealtimeTerritory] Error en listener de territorio:', err);
      }
    }
  }

  /**
   * Procesa un evento de inserción en 'unlocked_hexagons' para amigos
   */
  private async handleUnlockedHexagonInsert(payload: any): Promise<void> {
    const record = payload.new;
    if (!record || !record.user_id || !record.hex_id) {
      return;
    }

    const currentUserId = authService.getCurrentUserId();
    // No alertar sobre hexágonos propios
    if (record.user_id === currentUserId) {
      return;
    }

    // Si tenemos una lista de amigos activa y el usuario no está en ella, omitir
    if (this.activeFriendIds.size > 0 && !this.activeFriendIds.has(record.user_id)) {
      return;
    }

    const username = await this.resolveUsername(record.user_id);
    const friendEvent: FriendHexagonEvent = {
      userId: record.user_id,
      username,
      hexId: record.hex_id,
      unlockedAt: record.unlocked_at || new Date().toISOString(),
    };

    for (const listener of this.friendHexListeners) {
      try {
        listener(friendEvent);
      } catch (err) {
        console.error('[RealtimeTerritory] Error en listener de amigo:', err);
      }
    }
  }

  /**
   * Resuelve el nombre de usuario de un ID con caché local para ahorrar cuota
   */
  private async resolveUsername(userId: string): Promise<string> {
    if (this.usernameCache.has(userId)) {
      return this.usernameCache.get(userId)!;
    }

    if (!isSupabaseConfigured()) {
      return `Explorador_${userId.slice(0, 4)}`;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

      const name = data?.username || `Explorador_${userId.slice(0, 4)}`;
      this.usernameCache.set(userId, name);
      return name;
    } catch {
      return `Explorador_${userId.slice(0, 4)}`;
    }
  }

  /**
   * Maneja la reconexión inteligente si se pierde el WebSocket
   */
  private handleReconnect(): void {
    if (this.connectionRetries >= this.MAX_RETRIES) {
      console.warn('[RealtimeTerritory] Límite de reconexiones alcanzado. Modo offline activo.');
      return;
    }

    this.connectionRetries++;
    const delay = Math.pow(2, this.connectionRetries) * 1000;
    setTimeout(() => {
      if (this.kingListeners.size > 0 || this.friendHexListeners.size > 0) {
        this.teardownChannel();
        this.ensureRealtimeConnection();
      }
    }, delay);
  }

  /**
   * Limpia el canal si ya no quedan listeners activos (ahorro estricto de Free Tier)
   */
  private checkAndCleanupChannel(): void {
    if (this.kingListeners.size === 0 && this.friendHexListeners.size === 0) {
      this.teardownChannel();
    }
  }

  private teardownChannel(): void {
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch (err) {
        console.warn('[RealtimeTerritory] Error desmontando canal:', err);
      }
      this.channel = null;
      this.isConnected = false;
    }
  }

  /**
   * Simula un cambio de Rey del Barrio para pruebas visuales en UI y modo offline
   */
  public simulateKingUsurpation(
    zoneId: string = '87268580cffffff',
    rivalUsername: string = 'Kaiser_Cyberpunk',
    hexCount: number = 64
  ): void {
    const currentUserId = authService.getCurrentUserId() || 'local_user';
    const isDestronado = true;
    const safeRival = sanitizeUsername(rivalUsername, 'Rival_Táctico');
    const safeZone = sanitizeString(zoneId, 32);

    const event: KingChangeEvent = {
      zoneId: safeZone,
      previousKingId: currentUserId,
      previousKingUsername: sanitizeUsername(authService.getProfile()?.username || 'Tú'),
      newKingId: 'simulated_rival_id',
      newKingUsername: safeRival,
      hexCount,
      changeType: 'DETHRONED',
      isCurrentUserNewKing: false,
      isCurrentUserDethroned: isDestronado,
      message: `⚔️ ¡Alerta táctica! ${safeRival} te ha destronado en el barrio ${safeZone.slice(-6)}.`,
      timestamp: new Date().toISOString(),
    };

    for (const listener of this.kingListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RealtimeTerritory] Error en simulación:', err);
      }
    }
  }

  /**
   * Estado de conectividad de Realtime
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const realtimeTerritoryService = new RealtimeTerritoryService();
