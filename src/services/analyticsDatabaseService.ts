/**
 * TerraMaps - Analytics & Business Decision Intelligence Service
 * 
 * Gestiona el registro, almacenamiento local offline-first y sincronización
 * con Supabase de todas las métricas de negocio, salud y telemetría territorial:
 * 1. Movilidad y Calorías (Fórmula MET científica + Ahorro de CO2)
 * 2. Crecimiento territorial y cobertura regional
 * 3. Telemetría de contactos y radar social
 * 4. Embudo de monetización y comisiones de App Store / Google Play (15%)
 * 5. Dashboard ejecutivo para toma de decisiones del fundador
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { storageService } from './storage';

export interface DailyMobilityRecord {
  date: string; // YYYY-MM-DD
  walkKm: number;
  runKm: number;
  vehicleKm: number;
  flightKm: number;
  activeSeconds: number;
  estimatedCaloriesKcal: number;
  co2SavedKg: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
}

export interface LandmarkAnalyticsRecord {
  landmarkId: string;
  category: 'CULTURAL' | 'HISTORICAL' | 'LUXURY' | 'SPONSOR_B2B';
  latitude: number;
  longitude: number;
  dwellTimeSeconds: number;
  isSponsoredB2B: boolean;
}

export interface MonetizationEventRecord {
  eventName: 'PAYWALL_VIEW' | 'PLAN_CLICKED' | 'CHECKOUT_START' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILURE' | 'REWARDED_AD_WATCHED';
  tierId?: 'PRO_MONTHLY' | 'PRO_ANNUAL' | 'TIMELINE_RESTORE_LIFETIME';
  grossAmountUsd?: number;
  currency?: string;
  paymentProvider?: 'STRIPE' | 'APPLE_IAP' | 'GOOGLE_PLAY';
  errorCode?: string;
}

export interface ExecutiveDecisionDashboard {
  totalExploredKm2: number;
  totalWalkedKm: number;
  totalCaloriesBurnedKcal: number;
  totalCo2SavedKg: number;
  estimatedActiveUsersDau: number;
  monetizationFunnel: {
    paywallImpressions: number;
    checkoutInitiated: number;
    paidConversions: number;
    grossRevenueUsd: number;
    appStoreFeesUsd: number;
    netRevenueUsd: number;
    conversionRatePercent: number;
  };
  unitEconomics: {
    serverCostEstimateUsd: number;
    netMarginPercent: number;
    runwayStatus: 'PROFITABLE' | 'BREAKEVEN' | 'INVESTMENT_PHASE';
  };
}

const STORAGE_KEY_MOBILITY = '@terramaps_analytics_mobility_v1';
const STORAGE_KEY_MONETIZATION = '@terramaps_analytics_monetization_v1';
const STORAGE_KEY_LANDMARKS = '@terramaps_analytics_landmarks_v1';

class AnalyticsDatabaseService {
  private sessionId: string = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  /**
   * Calcula el gasto calórico aproximado según el Equivalente Metabólico de la Tarea (MET)
   * Referencia ACSM:
   * - Caminata: MET 3.5 (~245 kcal/h para 70 kg)
   * - Carrera: MET 8.0 (~560 kcal/h)
   * - Bicicleta / Rápido: MET 6.0 (~420 kcal/h)
   * - Vehículo / Pasivo: MET 1.3
   */
  public calculateCaloriesBurned(speedKmh: number, durationSeconds: number, weightKg: number = 70): number {
    if (durationSeconds <= 0) return 0;
    const hours = durationSeconds / 3600;

    let met = 1.3;
    if (speedKmh > 0.5 && speedKmh < 6.0) {
      met = 3.5; // Caminata
    } else if (speedKmh >= 6.0 && speedKmh < 14.0) {
      met = 8.0; // Trote / Carrera
    } else if (speedKmh >= 14.0 && speedKmh < 28.0) {
      met = 6.0; // Ciclismo urbano
    }

    // Fórmula estándar: Calorías = MET * Peso (kg) * Horas
    return Math.round(met * weightKg * hours * 10) / 10;
  }

  /**
   * Calcula el CO2 evitado en kilogramos al caminar en lugar de usar automóvil particular
   * (Factor promedio: 120g CO2 / km vehicular según Agencia Europea de Medio Ambiente)
   */
  public calculateCo2SavedKg(walkKm: number, runKm: number): number {
    const totalHumanKm = walkKm + runKm;
    return Math.round(totalHumanKm * 0.12 * 100) / 100;
  }

  /**
   * Registra o actualiza la telemetría de movilidad del día de hoy
   */
  public async recordMobility(params: {
    speedKmh: number;
    distanceDeltaKm: number;
    durationDeltaSeconds: number;
    transportMode: 'WALKING' | 'RUNNING' | 'CYCLING' | 'VEHICLE' | 'FLIGHT';
  }): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.getTodayMobility(today);

    let walkKm = existing.walkKm;
    let runKm = existing.runKm;
    let vehicleKm = existing.vehicleKm;
    let flightKm = existing.flightKm;

    if (params.transportMode === 'WALKING') walkKm += params.distanceDeltaKm;
    else if (params.transportMode === 'RUNNING') runKm += params.distanceDeltaKm;
    else if (params.transportMode === 'FLIGHT') flightKm += params.distanceDeltaKm;
    else vehicleKm += params.distanceDeltaKm;

    const activeSeconds = existing.activeSeconds + params.durationDeltaSeconds;
    const caloriesBurned = existing.estimatedCaloriesKcal + this.calculateCaloriesBurned(params.speedKmh, params.durationDeltaSeconds);
    const co2Saved = this.calculateCo2SavedKg(walkKm, runKm);
    const maxSpeed = Math.max(existing.maxSpeedKmh, params.speedKmh);
    const totalDist = walkKm + runKm + vehicleKm + flightKm;
    const avgSpeed = activeSeconds > 0 ? (totalDist / (activeSeconds / 3600)) : 0;

    const updated: DailyMobilityRecord = {
      date: today,
      walkKm: Math.round(walkKm * 1000) / 1000,
      runKm: Math.round(runKm * 1000) / 1000,
      vehicleKm: Math.round(vehicleKm * 1000) / 1000,
      flightKm: Math.round(flightKm * 1000) / 1000,
      activeSeconds,
      estimatedCaloriesKcal: Math.round(caloriesBurned * 10) / 10,
      co2SavedKg: co2Saved,
      avgSpeedKmh: Math.round(avgSpeed * 10) / 10,
      maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    };

    // Guardar en almacenamiento local
    storageService.setItem(`${STORAGE_KEY_MOBILITY}_${today}`, JSON.stringify(updated));

    // Si Supabase está configurado, sincronizar asíncronamente
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('daily_mobility_telemetry').upsert({
            user_id: user.id,
            date: today,
            walk_km: updated.walkKm,
            run_km: updated.runKm,
            vehicle_km: updated.vehicleKm,
            flight_km: updated.flightKm,
            active_movement_seconds: updated.activeSeconds,
            estimated_calories_kcal: updated.estimatedCaloriesKcal,
            co2_saved_kg: updated.co2SavedKg,
            avg_speed_kmh: updated.avgSpeedKmh,
            max_speed_kmh: updated.maxSpeedKmh,
          }, { onConflict: 'user_id,date' });
        }
      } catch (err) {
        // Modo offline silencioso
      }
    }
  }

  /**
   * Obtiene las métricas de movilidad registradas para la fecha indicada
   */
  public getTodayMobility(dateStr?: string): DailyMobilityRecord {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const raw = storageService.getItem(`${STORAGE_KEY_MOBILITY}_${date}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // Fallback
      }
    }
    return {
      date,
      walkKm: 0,
      runKm: 0,
      vehicleKm: 0,
      flightKm: 0,
      activeSeconds: 0,
      estimatedCaloriesKcal: 0,
      co2SavedKg: 0,
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
    };
  }

  /**
   * Registra un evento del embudo de monetización con deducción automática del 15% de comisión
   */
  public async recordMonetizationEvent(event: MonetizationEventRecord): Promise<void> {
    const gross = event.grossAmountUsd || 0;
    const appStoreFee = Math.round(gross * 0.15 * 100) / 100; // 15% Apple/Google Small Business Fee
    const netRevenue = Math.round((gross - appStoreFee) * 100) / 100;

    const payload = {
      ...event,
      sessionId: this.sessionId,
      grossAmountUsd: gross,
      appStoreFeeUsd: appStoreFee,
      netRevenueUsd: netRevenue,
      timestamp: new Date().toISOString(),
    };

    // Almacenamiento local para métricas agregadas inmediatas
    const historyRaw = storageService.getItem(STORAGE_KEY_MONETIZATION);
    const history: any[] = historyRaw ? JSON.parse(historyRaw) : [];
    history.push(payload);
    if (history.length > 500) history.shift();
    storageService.setItem(STORAGE_KEY_MONETIZATION, JSON.stringify(history));

    // Sincronizar en Supabase si está disponible
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('monetization_funnel_events').insert({
          user_id: user?.id ?? null,
          session_id: this.sessionId,
          event_name: event.eventName,
          tier_id: event.tierId ?? null,
          gross_amount_usd: gross,
          app_store_fee_usd: appStoreFee,
          net_revenue_usd: netRevenue,
          currency: event.currency || 'USD',
          payment_provider: event.paymentProvider || 'STRIPE',
          error_code: event.errorCode ?? null,
        });
      } catch {
        // Offline
      }
    }
  }

  /**
   * Registra el descubrimiento de un monumento o punto patrocinado B2B
   */
  public async recordLandmarkDiscovery(landmark: LandmarkAnalyticsRecord): Promise<void> {
    const raw = storageService.getItem(STORAGE_KEY_LANDMARKS);
    const list: LandmarkAnalyticsRecord[] = raw ? JSON.parse(raw) : [];
    list.push(landmark);
    storageService.setItem(STORAGE_KEY_LANDMARKS, JSON.stringify(list));

    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('landmark_discoveries_analytics').insert({
            user_id: user.id,
            landmark_id: landmark.landmarkId,
            landmark_category: landmark.category,
            coordinates_lat: landmark.latitude,
            coordinates_lng: landmark.longitude,
            dwell_time_seconds: landmark.dwellTimeSeconds,
            is_sponsored_b2b: landmark.isSponsoredB2B,
          });
        }
      } catch {
        // Offline
      }
    }
  }

  /**
   * Genera el resumen consolidado de negocio para la toma de decisiones del fundador
   */
  public getExecutiveDecisionDashboard(): ExecutiveDecisionDashboard {
    const todayMobility = this.getTodayMobility();
    const stats = storageService.getStats();

    // Análisis del embudo
    const rawEvents = storageService.getItem(STORAGE_KEY_MONETIZATION);
    const events: any[] = rawEvents ? JSON.parse(rawEvents) : [];

    const impressions = events.filter((e) => e.eventName === 'PAYWALL_VIEW').length;
    const checkouts = events.filter((e) => e.eventName === 'CHECKOUT_START').length;
    const paid = events.filter((e) => e.eventName === 'PAYMENT_SUCCESS');

    const grossRev = paid.reduce((acc, curr) => acc + (curr.grossAmountUsd || 0), 0);
    const fees = paid.reduce((acc, curr) => acc + (curr.appStoreFeeUsd || 0), 0);
    const netRev = Math.round((grossRev - fees) * 100) / 100;
    const conversion = impressions > 0 ? (paid.length / impressions) * 100 : 0;

    // Costo de servidor estimado (Carto/Protomaps tiles cacheados: <$0.0005 USD/usuario)
    const activeUsers = Math.max(1, stats.explorationLevel);
    const serverCost = Math.round(activeUsers * 0.0005 * 1000) / 1000;
    const netMargin = grossRev > 0 ? ((netRev - serverCost) / grossRev) * 100 : 99.0;

    return {
      totalExploredKm2: stats.totalAreaKm2,
      totalWalkedKm: todayMobility.walkKm,
      totalCaloriesBurnedKcal: todayMobility.estimatedCaloriesKcal,
      totalCo2SavedKg: todayMobility.co2SavedKg,
      estimatedActiveUsersDau: activeUsers,
      monetizationFunnel: {
        paywallImpressions: impressions,
        checkoutInitiated: checkouts,
        paidConversions: paid.length,
        grossRevenueUsd: Math.round(grossRev * 100) / 100,
        appStoreFeesUsd: Math.round(fees * 100) / 100,
        netRevenueUsd: netRev,
        conversionRatePercent: Math.round(conversion * 10) / 10,
      },
      unitEconomics: {
        serverCostEstimateUsd: serverCost,
        netMarginPercent: Math.round(netMargin * 10) / 10,
        runwayStatus: netRev >= serverCost ? 'PROFITABLE' : 'INVESTMENT_PHASE',
      },
    };
  }
}

export const analyticsDatabaseService = new AnalyticsDatabaseService();
