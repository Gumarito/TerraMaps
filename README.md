# 🗺️ TerraMaps — App Móvil Social con Niebla de Guerra (Fog of War)

> **"El mundo real convertido en tu propio videojuego de exploración."**
> Una aplicación móvil gamificada para **iOS y Android** donde caminas por tu ciudad para despejar una niebla oscura, desbloquear territorios, competir con tus amigos por ser el *"Rey del Barrio"* y presumir tus conquistas en redes sociales.

---

## 🌟 1. Visión y Propósito del Proyecto

* **Misión:** Transformar los traslados diarios, caminatas, viajes y paseos en una aventura visual adictiva tipo RPG, compitiendo amistosamente con tu círculo social.
* **Propuesta Única de Valor (vs. Fog of World):**
  * **Acceso 100% Gratuito:** Elimina la barrera de los \$29.99 USD de *Fog of World*.
  * **Capa Social y Viral:** En lugar de ser una experiencia solitaria, aquí juegas con tus amigos, compites por coronas territoriales y presumes tus estadísticas en Instagram Stories y TikTok.
  * **Batería Blindada (Battery-Shield):** A diferencia de apps que devoran la batería con GPS continuo, TerraMaps utiliza geofencing inteligente y podómetro/acelerómetro para reducir el consumo hasta un **85%**.
  * **Costo Operativo $0.00 USD:** Construido enteramente sobre tecnologías de código abierto y capas gratuitas serverless (OpenStreetMap, MapLibre GL, Uber H3, Supabase).

---

## 🚀 2. Stack Tecnológico de Costo Cero

| Área | Tecnología | Justificación y Costo |
| :--- | :--- | :--- |
| **Framework Móvil** | **React Native + Expo (TypeScript)** | Código unificado que compila nativamente a **Android (APK/AAB)** e **iOS (IPA)**. |
| **Motor de Mapas** | **MapLibre GL Mobile** | Motor de mapas vectorial de alto rendimiento 100% libre y gratuito (sin cuotas de Mapbox/Google). |
| **Tiles de Mapa** | **OpenStreetMap / Protomaps PMTiles** | Mapas globales sin límites de facturación, con soporte para caché offline. |
| **Motor de Niebla** | **Uber H3 (`h3-js`)** | Sistema de indexación geoespacial hexagonal. Desbloquear áreas ocupa solo bytes de memoria y 0.02ms de CPU. |
| **Almacenamiento Local** | **WatermelonDB / SQLite (Expo)** | Persistencia ultrarrápida en el celular del usuario (Offline-First). |
| **Backend & Social** | **Supabase Free Tier (PostgreSQL + PostGIS)** | Gestión de amigos, perfiles y rankings de hasta 50,000 usuarios activos mensuales a costo \$0. |
| **Monetización** | **Google AdMob / Monetag Rewarded Ads** | Anuncios de video remunerados de alto eCPM (\$15-\$30) para drones exploradores. |

---

## 📈 3. Fases de Desarrollo

* **Fase 1: Motor Central & Niebla Hexagonal (Cero Batería)**
  * Inicialización de Expo + MapLibre GL + Uber H3.
  * Capa de niebla oscura shader que se disuelve al detectar movimiento.
  * Algoritmo de geofencing con podómetro (reposo de GPS cuando el usuario está quieto).
* **Fase 2: Gamificación & Red Social (Flexing)**
  * Perfiles de usuario con avatar 3D y porcentaje de ciudad explorada.
  * Mecánica del *"Rey del Barrio"* (corona visible en parques/distritos para quien más hexágonos desbloquee).
  * Lista de amigos y tabla de clasificación semanal.
* **Fase 3: Motor Viral de Historias (Social Flex Cards)**
  * Generador de tarjetas visuales estéticas tipo *Spotify Wrapped* listas para compartir en Instagram Stories, TikTok y WhatsApp con código de referido.
* **Fase 4: Economía y Monetización**
  * Drones / Globos Exploradores para desbloquear zonas inaccesibles mediante anuncios Rewarded (15s) o gemas.
  * Tienda de Skins de Niebla (Cyberpunk Neón, Papiro Antiguo, Galaxia).
  * Suscripción Terra PRO (\$1.99 USD / mes).

---

## 💳 4. Pagos y Suscripciones (Stripe)

**Arquitectura:** Stripe es la fuente de verdad. El cliente nunca ve la clave secreta ni decide precios; solo envía la clave del plan.

```
App (web) ──► Edge Function `billing` ──► Stripe Checkout / Customer Portal
                                              │
Stripe ──(webhook firmado)──► Edge Function `stripe-webhook` ──► tablas billing_* (service_role)
                                                                     │
App ◄── RPC `get_my_entitlements()` (RLS, solo lectura) ◄────────────┘
```

| Pieza | Ruta |
| :--- | :--- |
| Esquema + RLS + RPC de derechos | `supabase/migrations/20261110000000_stripe_billing.sql` |
| Checkout, Portal, catálogo de precios | `supabase/functions/billing/index.ts` |
| Webhook (firma, idempotencia, re-sync) | `supabase/functions/stripe-webhook/index.ts` |
| Derechos en el cliente (caché offline acotada) | `src/services/billing/entitlementService.ts` |
| Control de acceso a capas prémium | `src/services/billing/accessControl.ts` |
| Paywall de suscripción | `src/components/modals/ProPaywallModal.tsx` |

**Productos:** `pro_monthly` y `pro_annual` (suscripción Terra PRO) y `timeline_lifetime` (pago único, Paquete Viajero del Tiempo).
**Terra PRO desbloquea:** skins `access: 'pro'`, modos de niebla `isPremium`, radar de dron extendido y drones sin enfriamiento.

### Puesta en marcha

1. En Stripe crea 3 precios (mensual, anual, pago único) y activa el **Customer Portal** (cancelación y cambio de plan).
2. Aplica la migración: `supabase db push`.
3. Copia `supabase/functions/.env.example` → `supabase/functions/.env`, rellena y ejecuta `supabase secrets set --env-file supabase/functions/.env`.
4. Despliega:
   ```bash
   supabase functions deploy billing
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
5. En Stripe → Webhooks, apunta a `https://<ref>.supabase.co/functions/v1/stripe-webhook` con los eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created|updated|deleted`, `charge.refunded`.
6. Prueba local: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook` y tarjeta `4242 4242 4242 4242`.

> **Tiendas móviles:** Apple y Google exigen su sistema de compras para contenido digital. Por eso Checkout solo está activo en **web**; en iOS/Android la app respeta los derechos comprados en web, pero no vende (ver `EXPO_PUBLIC_ENABLE_NATIVE_STRIPE_CHECKOUT`).
