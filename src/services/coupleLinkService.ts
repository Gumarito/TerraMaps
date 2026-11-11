/**
 * TerraMaps — Vínculo de Pareja (consentimiento mutuo)
 *
 * Flujo: A genera un PIN de 6 dígitos (10 min) → B lo introduce → B ve la solicitud y debe
 * CONFIRMAR explícitamente → el vínculo queda activo. Cualquiera de los dos puede desvincular
 * en cualquier momento, lo que corta de inmediato el compartir de ubicación y batería.
 *
 * Nota: esta capa es local (estado en dispositivo). La verificación cruzada entre dos
 * dispositivos requiere la tabla de emparejamiento en Supabase; el contrato de esta API
 * (createInvite / requestLink / confirmConsent / unlink) ya está preparado para ello.
 */

import { storageService } from './storage';

const STORAGE_KEY = '@terramaps_couple_link_v1';
export const INVITE_TTL_MS = 10 * 60 * 1000;

export type CoupleLinkStatus = 'unlinked' | 'invite_sent' | 'awaiting_consent' | 'linked';

export interface CoupleLinkState {
  status: CoupleLinkStatus;
  pin: string | null;
  pinExpiresAt: number | null;
  /** Id del integrante en partnerRadarService con el que se enlaza. */
  partnerId: string | null;
  shareBattery: boolean;
  linkedAt: number | null;
}

type Listener = (state: CoupleLinkState) => void;

const INITIAL: CoupleLinkState = {
  status: 'unlinked',
  pin: null,
  pinExpiresAt: null,
  partnerId: null,
  shareBattery: true,
  linkedAt: null,
};

/** Integrante que representa a la pareja en el radar mientras no exista backend de emparejamiento. */
const DEFAULT_PARTNER_ID = 'partner_1';

function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

class CoupleLinkService {
  private state: CoupleLinkState = this.load();
  private listeners = new Set<Listener>();

  private load(): CoupleLinkState {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return INITIAL;
      const parsed = JSON.parse(raw) as Partial<CoupleLinkState>;
      const status = parsed.status;
      if (status !== 'linked') return { ...INITIAL, shareBattery: parsed.shareBattery !== false };
      return { ...INITIAL, ...parsed, status: 'linked' };
    } catch {
      return INITIAL;
    }
  }

  private set(next: CoupleLinkState): CoupleLinkState {
    this.state = next;
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Persistencia best-effort
    }
    this.listeners.forEach((fn) => fn(next));
    return next;
  }

  public getState(): CoupleLinkState {
    const s = this.state;
    if ((s.status === 'invite_sent' || s.status === 'awaiting_consent') && s.pinExpiresAt && Date.now() > s.pinExpiresAt) {
      return this.set({ ...INITIAL, shareBattery: s.shareBattery });
    }
    return s;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Genera un PIN de invitación temporal. */
  public createInvite(): CoupleLinkState {
    return this.set({
      ...this.state,
      status: 'invite_sent',
      pin: randomPin(),
      pinExpiresAt: Date.now() + INVITE_TTL_MS,
      partnerId: null,
      linkedAt: null,
    });
  }

  /** Introduce el PIN recibido: pasa a espera de consentimiento explícito. */
  public requestLink(rawPin: string): { ok: boolean; error?: string } {
    const pin = rawPin.replace(/\D/g, '');
    if (pin.length !== 6) return { ok: false, error: 'El PIN debe tener 6 dígitos.' };
    this.set({
      ...this.state,
      status: 'awaiting_consent',
      pin,
      pinExpiresAt: Date.now() + INVITE_TTL_MS,
      partnerId: DEFAULT_PARTNER_ID,
    });
    return { ok: true };
  }

  /** Consentimiento explícito: activa el vínculo. */
  public confirmConsent(): void {
    const s = this.getState();
    if (s.status !== 'awaiting_consent' && s.status !== 'invite_sent') return;
    this.set({
      ...s,
      status: 'linked',
      pin: null,
      pinExpiresAt: null,
      partnerId: s.partnerId ?? DEFAULT_PARTNER_ID,
      linkedAt: Date.now(),
    });
  }

  public cancel(): void {
    this.set({ ...INITIAL, shareBattery: this.state.shareBattery });
  }

  public unlink(): void {
    this.cancel();
  }

  public setShareBattery(value: boolean): void {
    this.set({ ...this.state, shareBattery: value });
  }
}

export const coupleLinkService = new CoupleLinkService();
