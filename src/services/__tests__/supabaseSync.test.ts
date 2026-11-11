/**
 * TM-005 - Verificación de HexSyncEngine (lotes, debounce, reintento, Realtime).
 * Sin red: transporte, storage y timers son falsos.
 */

import {
  HexSyncEngine,
  type HexRow,
  type RealtimeStatus,
  type SyncStorage,
  type SyncTimers,
  type SyncTransport,
} from '../supabaseSync';

export interface SyncTestResult {
  suiteName: string;
  passed: boolean;
  assertions: number;
  failures: string[];
}

interface Harness {
  engine: HexSyncEngine;
  upserts: HexRow[][];
  saved: string[][];
  subscribes: number;
  unsubscribes: number;
  setUpsertError: (msg: string | null) => void;
  setUser: (id: string | null) => void;
  emitInsert: (hex: string) => void;
  emitStatus: (s: RealtimeStatus) => void;
  advance: (ms: number) => void;
}

function createHarness(initial: string[] = []): Harness {
  let upsertError: string | null = null;
  let userId: string | null = 'user-1';
  let onInsert: (hex: string) => void = () => undefined;
  let onStatus: (s: RealtimeStatus) => void = () => undefined;
  let clock = 0;
  let nextId = 1;
  const scheduled = new Map<number, { at: number; fn: () => void }>();

  const h: Harness = {
    engine: undefined as unknown as HexSyncEngine,
    upserts: [],
    saved: [],
    subscribes: 0,
    unsubscribes: 0,
    setUpsertError: (m) => { upsertError = m; },
    setUser: (id) => { userId = id; },
    emitInsert: (hex) => onInsert(hex),
    emitStatus: (s) => onStatus(s),
    advance: (ms) => {
      clock += ms;
      for (const [id, t] of Array.from(scheduled)) {
        if (t.at <= clock) {
          scheduled.delete(id);
          t.fn();
        }
      }
    },
  };

  const transport: SyncTransport = {
    getUserId: async () => userId,
    upsertHexes: async (rows) => {
      h.upserts.push(rows);
      return { errorMessage: upsertError };
    },
    subscribeUserHexes: (_u, ins, st) => {
      h.subscribes++;
      onInsert = ins;
      onStatus = st;
      return { unsubscribe: () => { h.unsubscribes++; } };
    },
  };
  const store: SyncStorage = { load: () => initial, save: (ids) => { h.saved.push(ids); } };
  const timers: SyncTimers = {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      scheduled.set(id, { at: clock + ms, fn });
      return id;
    },
    clearTimeout: (handle) => { scheduled.delete(handle as number); },
  };

  h.engine = new HexSyncEngine(transport, store, timers, {
    batchSize: 3,
    debounceMs: 1000,
    maxRetries: 2,
    isValidHex: (x) => x.startsWith('89'),
  });
  return h;
}

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

export async function runSupabaseSyncVerification(): Promise<SyncTestResult> {
  const failures: string[] = [];
  let assertions = 0;
  const check = (cond: boolean, msg: string): void => {
    assertions++;
    if (!cond) failures.push(msg);
  };

  // 1. Lotes + validación + deduplicación
  {
    const h = createHarness();
    h.engine.enqueue(['89a', '89b', '89c', '89d', '89e', 'bad', '89a']);
    check(h.engine.getPendingCount() === 5, 'filtra inválidos y duplicados');
    const r = await h.engine.flush();
    check(r.synced === 5 && r.failed === 0, 'sube las 5 celdas');
    check(h.upserts.length === 2 && h.upserts[0].length === 3 && h.upserts[1].length === 2, 'divide en lotes de 3 + 2');
    check(h.engine.getPendingCount() === 0, 'cola vacía tras éxito');
    check(h.upserts[0][0].user_id === 'user-1', 'rows incluyen user_id');
  }

  // 2. Debounce: ráfagas producen un solo envío
  {
    const h = createHarness();
    h.engine.enqueue(['89a']);
    h.advance(500);
    h.engine.enqueue(['89b']);
    h.advance(600);
    await tick();
    check(h.upserts.length === 0, 'debounce se reinicia con nuevas celdas');
    h.advance(500);
    await tick();
    check(h.upserts.length === 1 && h.upserts[0].length === 2, 'un único envío tras inactividad');
  }

  // 3. Fallo: conserva cola, reintenta con backoff y se detiene en maxRetries
  {
    const h = createHarness();
    h.setUpsertError('offline');
    h.engine.enqueue(['89a']);
    const r = await h.engine.flush();
    check(r.failed === 1 && r.synced === 0, 'reporta fallo');
    check(h.engine.getPendingCount() === 1, 'conserva celda fallida');
    h.setUpsertError(null);
    h.advance(2000); // backoff 1.er reintento
    await tick();
    check(h.engine.getPendingCount() === 0, 'reintento automático recupera la cola');
  }
  {
    const h = createHarness();
    h.setUpsertError('offline');
    h.engine.enqueue(['89a']);
    await h.engine.flush();           // fallo 1 -> retry en 2s
    h.advance(2000); await tick();    // fallo 2 -> retry en 4s
    h.advance(4000); await tick();    // fallo 3 -> excede maxRetries(2), sin más retry
    const calls = h.upserts.length;
    h.advance(120000); await tick();
    check(h.upserts.length === calls, 'deja de reintentar tras maxRetries');
    h.setUpsertError(null);
    h.engine.notifyOnline();
    await tick(); await tick();
    check(h.engine.getPendingCount() === 0, 'notifyOnline reanuda y vacía la cola');
  }

  // 4. Sin sesión: no sube y conserva
  {
    const h = createHarness(['89a']);
    h.setUser(null);
    const r = await h.engine.flush();
    check(r.synced === 0 && h.upserts.length === 0 && h.engine.getPendingCount() === 1, 'sin usuario conserva cola');
  }

  // 5. Cola persistida se restaura y se persiste al subir
  {
    const h = createHarness(['89a', 'zzz']);
    check(h.engine.getPendingCount() === 1, 'restaura cola persistida validando');
    await h.engine.flush();
    check(h.saved.length > 0 && h.saved[h.saved.length - 1].length === 0, 'persiste cola vacía tras subir');
  }

  // 6. Realtime: entrega, reconexión y cierre
  {
    const h = createHarness();
    const got: string[] = [];
    const off = h.engine.subscribeRemote((hex) => got.push(hex));
    await tick();
    check(h.subscribes === 1, 'abre un canal');
    h.emitStatus('SUBSCRIBED');
    check(h.engine.isRealtimeConnected(), 'marca conectado');
    h.emitInsert('89x');
    h.emitInsert('invalid');
    check(got.length === 1 && got[0] === '89x', 'entrega solo celdas válidas');

    h.emitStatus('CHANNEL_ERROR');
    check(!h.engine.isRealtimeConnected(), 'marca desconectado en error');
    h.advance(2000); await tick();
    check(h.subscribes === 2 && h.unsubscribes === 1, 'reconecta recreando el canal');

    off();
    check(h.unsubscribes === 2, 'cierra canal sin listeners');
    h.advance(120000); await tick();
    check(h.subscribes === 2, 'no reconecta tras cancelar');
  }

  return { suiteName: 'Supabase Hex Sync: Batching, Debounce, Retry & Realtime', passed: failures.length === 0, assertions, failures };
}
