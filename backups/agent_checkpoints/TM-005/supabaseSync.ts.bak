/**
 * TerraMaps - Supabase Hex Sync (TM-005)
 *
 * Sincronizador bidireccional de celdas H3 exploradas:
 * - Subida por lotes con debounce (no satura la red mientras caminas).
 * - Cola persistente (sobrevive reinicios) con reintento y backoff exponencial.
 * - Suscripción Realtime a `unlocked_hexagons` del propio usuario (otros dispositivos).
 *
 * El motor (`HexSyncEngine`) recibe sus dependencias por inyección para poder probarse sin red.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { storageService } from './storage';

const STORAGE_PENDING_KEY = '@terramaps_supabase_sync_pending';

export const SYNC_BATCH_SIZE = 100;
export const SYNC_DEBOUNCE_MS = 5000;
export const SYNC_MAX_RETRIES = 5;
const SYNC_BASE_BACKOFF_MS = 2000;
const SYNC_MAX_BACKOFF_MS = 60000;
const REALTIME_MAX_RETRIES = 5;

export interface HexRow {
  user_id: string;
  hex_id: string;
  unlocked_at: string;
}

export type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED';

export interface RealtimeHandle {
  unsubscribe: () => void;
}

/** Abstracción mínima de red; la implementación real usa el cliente de Supabase. */
export interface SyncTransport {
  getUserId: () => Promise<string | null>;
  upsertHexes: (rows: HexRow[]) => Promise<{ errorMessage: string | null }>;
  subscribeUserHexes: (
    userId: string,
    onInsert: (hexId: string) => void,
    onStatus: (status: RealtimeStatus) => void
  ) => RealtimeHandle;
}

export interface SyncStorage {
  load: () => string[];
  save: (hexIds: string[]) => void;
}

export interface SyncTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface SyncEngineOptions {
  batchSize?: number;
  debounceMs?: number;
  maxRetries?: number;
  isValidHex?: (hexId: string) => boolean;
  now?: () => Date;
}

export interface FlushResult {
  synced: number;
  failed: number;
}

export type RemoteHexCallback = (hexId: string) => void;

const defaultTimers: SyncTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class HexSyncEngine {
  private readonly pending = new Set<string>();
  private readonly remoteListeners = new Set<RemoteHexCallback>();
  private readonly batchSize: number;
  private readonly debounceMs: number;
  private readonly maxRetries: number;
  private readonly isValidHex: (hexId: string) => boolean;
  private readonly now: () => Date;

  private debounceHandle: unknown = null;
  private retryHandle: unknown = null;
  private flushing = false;
  private failureStreak = 0;

  private realtime: RealtimeHandle | null = null;
  private realtimeUserId: string | null = null;
  private realtimeRetries = 0;
  private realtimeRetryHandle: unknown = null;
  private connected = false;

  constructor(
    private readonly transport: SyncTransport,
    private readonly store: SyncStorage,
    private readonly timers: SyncTimers = defaultTimers,
    options: SyncEngineOptions = {}
  ) {
    this.batchSize = options.batchSize ?? SYNC_BATCH_SIZE;
    this.debounceMs = options.debounceMs ?? SYNC_DEBOUNCE_MS;
    this.maxRetries = options.maxRetries ?? SYNC_MAX_RETRIES;
    this.isValidHex = options.isValidHex ?? ((h) => typeof h === 'string' && h.length > 0 && h.length <= 15);
    this.now = options.now ?? (() => new Date());

    for (const hex of this.store.load()) {
      if (this.isValidHex(hex)) this.pending.add(hex);
    }
  }

  /** Encola celdas nuevas; la subida ocurre tras `debounceMs` de inactividad. */
  public enqueue(hexIds: readonly string[]): void {
    let added = false;
    for (const id of hexIds) {
      if (this.isValidHex(id) && !this.pending.has(id)) {
        this.pending.add(id);
        added = true;
      }
    }
    if (!added) return;
    this.persist();
    this.scheduleFlush(this.debounceMs);
  }

  public getPendingCount(): number {
    return this.pending.size;
  }

  public isRealtimeConnected(): boolean {
    return this.connected;
  }

  /** Sube todo lo pendiente en lotes. Un lote fallido permanece en cola. */
  public async flush(): Promise<FlushResult> {
    this.cancelTimer('debounceHandle');
    if (this.flushing || this.pending.size === 0) return { synced: 0, failed: 0 };

    this.flushing = true;
    let synced = 0;
    let failed = 0;

    try {
      const userId = await this.transport.getUserId();
      if (!userId) return { synced: 0, failed: 0 }; // sin sesión: se conserva la cola

      const all = Array.from(this.pending);
      for (let i = 0; i < all.length; i += this.batchSize) {
        const batch = all.slice(i, i + this.batchSize);
        const stamp = this.now().toISOString();
        const rows: HexRow[] = batch.map((hex_id) => ({ user_id: userId, hex_id, unlocked_at: stamp }));

        let errorMessage: string | null;
        try {
          ({ errorMessage } = await this.transport.upsertHexes(rows));
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : 'network error';
        }

        if (errorMessage) {
          failed += batch.length;
        } else {
          synced += batch.length;
          for (const hex of batch) this.pending.delete(hex);
          this.persist();
        }
      }
    } finally {
      this.flushing = false;
    }

    if (failed > 0) {
      this.failureStreak++;
      if (this.failureStreak <= this.maxRetries) {
        const delay = Math.min(SYNC_BASE_BACKOFF_MS * 2 ** (this.failureStreak - 1), SYNC_MAX_BACKOFF_MS);
        this.scheduleFlush(delay, 'retryHandle');
      }
    } else if (synced > 0) {
      this.failureStreak = 0;
    }

    return { synced, failed };
  }

  /** Suscribe a inserciones remotas del propio usuario. Devuelve la función de cancelación. */
  public subscribeRemote(callback: RemoteHexCallback): () => void {
    this.remoteListeners.add(callback);
    void this.ensureRealtime();
    return () => {
      this.remoteListeners.delete(callback);
      if (this.remoteListeners.size === 0) this.stopRealtime();
    };
  }

  /** Cancela timers y canal Realtime. */
  public dispose(): void {
    this.cancelTimer('debounceHandle');
    this.cancelTimer('retryHandle');
    this.remoteListeners.clear();
    this.stopRealtime();
  }

  /** Reintenta ahora (p. ej. al recuperar conectividad). */
  public notifyOnline(): void {
    this.failureStreak = 0;
    this.cancelTimer('retryHandle');
    void this.flush();
    if (this.remoteListeners.size > 0 && !this.realtime) void this.ensureRealtime();
  }

  private async ensureRealtime(): Promise<void> {
    if (this.realtime || this.remoteListeners.size === 0) return;
    const userId = await this.transport.getUserId();
    // Re-comprobar: pudo cancelarse o suscribirse en paralelo durante el await.
    if (!userId || this.realtime || this.remoteListeners.size === 0) return;

    this.realtimeUserId = userId;
    this.realtime = this.transport.subscribeUserHexes(
      userId,
      (hexId) => this.handleRemoteInsert(hexId),
      (status) => this.handleRealtimeStatus(status)
    );
  }

  private handleRemoteInsert(hexId: string): void {
    if (!this.isValidHex(hexId)) return;
    for (const listener of this.remoteListeners) {
      try {
        listener(hexId);
      } catch (err) {
        console.error('[SupabaseSync] Error en listener remoto:', err);
      }
    }
  }

  private handleRealtimeStatus(status: RealtimeStatus): void {
    if (status === 'SUBSCRIBED') {
      this.connected = true;
      this.realtimeRetries = 0;
      return;
    }
    this.connected = false;
    if (status === 'CLOSED' && !this.realtime) return; // cierre voluntario
    if (this.realtimeRetries >= REALTIME_MAX_RETRIES || this.remoteListeners.size === 0) return;

    this.realtimeRetries++;
    const delay = Math.min(1000 * 2 ** this.realtimeRetries, SYNC_MAX_BACKOFF_MS);
    this.cancelTimer('realtimeRetryHandle');
    this.realtimeRetryHandle = this.timers.setTimeout(() => {
      this.realtimeRetryHandle = null;
      this.teardownRealtime();
      void this.ensureRealtime();
    }, delay);
  }

  private stopRealtime(): void {
    this.cancelTimer('realtimeRetryHandle');
    this.teardownRealtime();
    this.realtimeRetries = 0;
  }

  private teardownRealtime(): void {
    const handle = this.realtime;
    this.realtime = null;
    this.realtimeUserId = null;
    this.connected = false;
    if (handle) {
      try {
        handle.unsubscribe();
      } catch (err) {
        console.warn('[SupabaseSync] Error cerrando canal:', err);
      }
    }
  }

  private scheduleFlush(ms: number, slot: 'debounceHandle' | 'retryHandle' = 'debounceHandle'): void {
    this.cancelTimer(slot);
    this[slot] = this.timers.setTimeout(() => {
      this[slot] = null;
      void this.flush();
    }, ms);
  }

  private cancelTimer(slot: 'debounceHandle' | 'retryHandle' | 'realtimeRetryHandle'): void {
    if (this[slot] !== null) {
      this.timers.clearTimeout(this[slot]);
      this[slot] = null;
    }
  }

  private persist(): void {
    try {
      this.store.save(Array.from(this.pending));
    } catch {
      // Persistencia best-effort: la cola en memoria sigue siendo válida.
    }
  }
}

// ---------------------------------------------------------------------------
// Implementaciones reales (Supabase + storageService)
// ---------------------------------------------------------------------------

interface UnlockedHexInsertRecord {
  hex_id?: unknown;
}

const supabaseTransport: SyncTransport = {
  getUserId: async () => {
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  },

  upsertHexes: async (rows) => {
    const { error } = await supabase
      .from('unlocked_hexagons')
      .upsert(rows, { onConflict: 'user_id,hex_id', ignoreDuplicates: true });
    return { errorMessage: error ? error.message : null };
  },

  subscribeUserHexes: (userId, onInsert, onStatus) => {
    const channel: RealtimeChannel = supabase
      .channel(`terramaps_sync_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'unlocked_hexagons', filter: `user_id=eq.${userId}` },
        (payload) => {
          const hexId = (payload.new as UnlockedHexInsertRecord).hex_id;
          if (typeof hexId === 'string') onInsert(hexId);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          onStatus(status);
        }
      });
    return { unsubscribe: () => void supabase.removeChannel(channel) };
  },
};

const storageBackedQueue: SyncStorage = {
  load: () => {
    const raw = storageService.getItem(STORAGE_PENDING_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
    } catch {
      return [];
    }
  },
  save: (hexIds) => storageService.setItem(STORAGE_PENDING_KEY, JSON.stringify(hexIds)),
};

export const supabaseSync = new HexSyncEngine(supabaseTransport, storageBackedQueue);
