import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MapTheme } from '@/core/theme/mapThemes';
import { useEntitlements } from '@/hooks/useEntitlements';
import { analyticsDatabaseService } from '@/services/analyticsDatabaseService';
import {
  billingService,
  entitlementService,
  PRO_FEATURE_COPY,
  type CatalogPrice,
  type PlanKey,
  type PremiumFeature,
  type SubscriptionPlanKey,
} from '@/services/billing';

export interface ProPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  theme: MapTheme;
  /** Función que motivó la apertura; se resalta en la lista de beneficios. */
  highlightFeature?: PremiumFeature | null;
}

const PLAN_ORDER: SubscriptionPlanKey[] = ['pro_annual', 'pro_monthly'];

function annualSavingsPercent(prices: Partial<Record<PlanKey, CatalogPrice>>): number | null {
  const monthly = prices.pro_monthly;
  const annual = prices.pro_annual;
  if (!monthly || !annual || monthly.currency !== annual.currency || monthly.amount <= 0) return null;
  const pct = Math.round((1 - annual.amount / (monthly.amount * 12)) * 100);
  return pct > 0 ? pct : null;
}

function formatDate(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const ProPaywallModal: React.FC<ProPaywallModalProps> = ({ visible, onClose, theme, highlightFeature }) => {
  const isLight = theme.mode === 'light';
  const entitlements = useEntitlements();
  const [prices, setPrices] = useState<Partial<Record<PlanKey, CatalogPrice>>>({});
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey>('pro_annual');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);

  const availability = useMemo(() => billingService.getAvailability(), []);
  const savings = annualSavingsPercent(prices);

  useEffect(() => {
    if (!visible) return;
    setMessage(null);
    analyticsDatabaseService.recordMonetizationEvent({ eventName: 'PAYWALL_VIEW' }).catch(() => {});
    let cancelled = false;
    billingService.getCatalog().then((catalog) => {
      if (cancelled) return;
      setPrices(catalog);
      if (availability.ok && !catalog.pro_monthly && !catalog.pro_annual) {
        setMessage({ tone: 'error', text: 'No pudimos cargar los precios. Revisa tu conexión e inténtalo de nuevo.' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, availability.ok]);

  const colors = {
    sheet: isLight ? '#ffffff' : '#0f172a',
    border: isLight ? '#e2e8f0' : '#1e293b',
    card: isLight ? '#f8fafc' : '#1e293b',
    text: isLight ? '#0f172a' : '#f8fafc',
    sub: isLight ? '#64748b' : '#94a3b8',
    accent: theme.accentColor,
    onAccent: isLight ? '#ffffff' : '#0b0f19',
  };

  const handleSubscribe = async () => {
    setIsBusy(true);
    setMessage({ tone: 'info', text: 'Redirigiendo al pago seguro de Stripe…' });
    analyticsDatabaseService
      .recordMonetizationEvent({ eventName: 'PLAN_CLICKED', tierId: selectedPlan === 'pro_annual' ? 'PRO_ANNUAL' : 'PRO_MONTHLY' })
      .catch(() => {});
    const result = await billingService.startCheckout(selectedPlan);
    if (!result.ok) {
      setIsBusy(false);
      setMessage({ tone: 'error', text: result.message });
    }
    // En éxito el navegador abandona la página; no se restablece el estado.
  };

  const handleManage = async () => {
    setIsBusy(true);
    const result = await billingService.openCustomerPortal();
    if (!result.ok) {
      setIsBusy(false);
      setMessage({ tone: 'error', text: result.message });
    }
  };

  const handleVerify = async () => {
    setIsBusy(true);
    setMessage({ tone: 'info', text: 'Verificando tus compras…' });
    const snap = await entitlementService.refresh();
    setIsBusy(false);
    setMessage(
      snap.isPro
        ? { tone: 'success', text: 'Terra PRO está activo en esta cuenta.' }
        : { tone: 'info', text: 'No encontramos una suscripción activa para esta cuenta.' }
    );
  };

  const renderPlan = (plan: SubscriptionPlanKey) => {
    const price = prices[plan];
    const isSelected = selectedPlan === plan;
    const isAnnual = plan === 'pro_annual';
    return (
      <TouchableOpacity
        key={plan}
        style={[
          styles.planCard,
          { backgroundColor: colors.card, borderColor: isSelected ? colors.accent : colors.border },
        ]}
        onPress={() => setSelectedPlan(plan)}
        activeOpacity={0.85}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
      >
        <View style={[styles.radio, { borderColor: isSelected ? colors.accent : colors.sub }]}>
          {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
        </View>
        <View style={styles.planTextCol}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planTitle, { color: colors.text }]}>{isAnnual ? 'Anual' : 'Mensual'}</Text>
            {isAnnual && savings !== null && (
              <View style={[styles.savingsBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.savingsText, { color: colors.onAccent }]}>AHORRA {savings}%</Text>
              </View>
            )}
          </View>
          <Text style={[styles.planSub, { color: colors.sub }]}>
            {isAnnual ? 'Un pago al año' : 'Facturación mensual'}
          </Text>
        </View>
        <Text style={[styles.planPrice, { color: colors.text }]}>
          {price ? `${price.formatted}${isAnnual ? '/año' : '/mes'}` : '—'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.sheet, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.tag, { borderColor: colors.accent }]}>
              <Text style={[styles.tagText, { color: colors.accent }]}>TERRA PRO</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Cerrar">
              <Text style={[styles.closeText, { color: colors.sub }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {entitlements.isPro ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Terra PRO está activo</Text>
                <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.statusLine, { color: colors.text }]}>
                    Plan {entitlements.proPlan === 'pro_annual' ? 'anual' : 'mensual'}
                    {entitlements.proStatus === 'past_due' ? ' · pago pendiente' : ''}
                  </Text>
                  {entitlements.proCurrentPeriodEnd && (
                    <Text style={[styles.statusSub, { color: colors.sub }]}>
                      {entitlements.cancelAtPeriodEnd ? 'Acceso hasta el ' : 'Se renueva el '}
                      {formatDate(entitlements.proCurrentPeriodEnd)}
                    </Text>
                  )}
                  {entitlements.proStatus === 'past_due' && (
                    <Text style={[styles.statusSub, { color: '#f59e0b' }]}>
                      No pudimos cobrar tu última renovación. Actualiza tu método de pago para no perder el acceso.
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Desbloquea el mapa completo</Text>
                <Text style={[styles.subtitle, { color: colors.sub }]}>
                  Capas, estilos y herramientas avanzadas para explorar tu ciudad.
                </Text>
              </>
            )}

            <View style={styles.features}>
              {PRO_FEATURE_COPY.map((item) => {
                const highlighted = item.feature === highlightFeature;
                return (
                  <View
                    key={item.feature}
                    style={[
                      styles.featureRow,
                      highlighted && { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                    <View style={styles.featureTextCol}>
                      <Text style={[styles.featureTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.featureDesc, { color: colors.sub }]}>{item.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {!entitlements.isPro && availability.ok && (
              <View style={styles.plans}>{PLAN_ORDER.map(renderPlan)}</View>
            )}

            {!entitlements.isPro && !availability.ok && (
              <View style={[styles.notice, { backgroundColor: colors.card }]}>
                <Text style={[styles.noticeText, { color: colors.sub }]}>{availability.message}</Text>
              </View>
            )}

            {!entitlements.isPro && availability.ok && entitlements.isAnonymousAccount && (
              <View style={[styles.notice, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Text style={[styles.noticeText, { color: '#f59e0b' }]}>
                  Usas una cuenta invitada. Vincula tu correo en Perfil para conservar Terra PRO si cambias de dispositivo.
                </Text>
              </View>
            )}

            {message && (
              <View style={[styles.notice, { backgroundColor: colors.card }]}>
                <Text
                  style={[
                    styles.noticeText,
                    { color: message.tone === 'error' ? '#ef4444' : message.tone === 'success' ? '#10b981' : colors.sub },
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            )}

            {entitlements.isPro ? (
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: colors.accent }, isBusy && styles.disabled]}
                onPress={handleManage}
                disabled={isBusy}
                activeOpacity={0.88}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={[styles.ctaText, { color: colors.onAccent }]}>Gestionar suscripción</Text>
                )}
              </TouchableOpacity>
            ) : (
              availability.ok && (
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: colors.accent }, (isBusy || !prices[selectedPlan]) && styles.disabled]}
                  onPress={handleSubscribe}
                  disabled={isBusy || !prices[selectedPlan]}
                  activeOpacity={0.88}
                >
                  {isBusy ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <Text style={[styles.ctaText, { color: colors.onAccent }]}>Continuar al pago seguro</Text>
                  )}
                </TouchableOpacity>
              )
            )}

            {!entitlements.isPro && (
              <TouchableOpacity style={styles.textAction} onPress={handleVerify} disabled={isBusy}>
                <Text style={[styles.textActionLabel, { color: colors.accent }]}>Ya pagué · Verificar mi compra</Text>
              </TouchableOpacity>
            )}

            {!entitlements.isPro && availability.ok && (
              <Text style={[styles.legal, { color: colors.sub }]}>
                Suscripción con renovación automática hasta que la canceles. Puedes cancelar en cualquier momento desde
                Perfil → Terra PRO; conservarás el acceso hasta el final del periodo pagado. Pagos procesados por Stripe.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '90%',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  closeBtn: { padding: 6 },
  closeText: { fontSize: 20, fontWeight: '700' },
  scroll: { paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  statusCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginVertical: 12, gap: 4 },
  statusLine: { fontSize: 14, fontWeight: '700' },
  statusSub: { fontSize: 12, lineHeight: 17 },
  features: { gap: 6, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 8, borderRadius: 12 },
  check: { fontSize: 14, fontWeight: '900', marginTop: 1 },
  featureTextCol: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700' },
  featureDesc: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  plans: { gap: 10, marginBottom: 14 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planTextCol: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  planTitle: { fontSize: 15, fontWeight: '800' },
  planSub: { fontSize: 11, marginTop: 2 },
  planPrice: { fontSize: 14, fontWeight: '800' },
  savingsBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  savingsText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  notice: { borderRadius: 12, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
  cta: { paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  textAction: { alignItems: 'center', paddingVertical: 12 },
  textActionLabel: { fontSize: 12, fontWeight: '700' },
  legal: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
