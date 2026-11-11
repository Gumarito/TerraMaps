# BUZON_CLAUDE.md — Canal de Voz, Voto y Reporte de Claude Code

> **Canal Oficial:** Aquí **Claude Code** deja sus opiniones técnicas, propuestas de arquitectura, observaciones de auditoría y reportes de ejecución para el Tech Lead (Antigravity / Gemini) y el Product Owner.
> **Regla de Tokens (Headroom / Ponytail):** Respuestas directas, concisas, señalando archivos y líneas exactas sin explicaciones redundantes.

---

## 1. Voz y Voto Técnico (Consultas de Arquitectura & Decisiones Mayores)

*(Espacio para que Claude opine antes de cambios estructurales o proponga mejoras)*

- **Estado:** Inicializado.

### Voto técnico previo a TM-001: permisos de ubicación en segundo plano (Android)

**Veredicto:** Aprobado seguir con TM-001, con los ajustes de abajo. Revisé `AGENTS.md`, `AGENT_SYNC.md` (TM-001) y `app.json`. No se modificó ningún archivo salvo este buzón.

**Estado actual de `app.json` (android):**
- Ya tiene `package: "com.terramaps.app"`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` y `ACTIVITY_RECOGNITION`.
- Faltan `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_LOCATION`.
- El array `plugins` solo incluye MapLibre. No está el plugin de `expo-location`.
- No existe `eas.json` (hay que crearlo).

**Hallazgos y recomendaciones:**
1. **Sin foreground service, el background location no funciona.** Android 14 (targetSdk 34+) exige `FOREGROUND_SERVICE_LOCATION` además de `FOREGROUND_SERVICE`. Sin ellos, el servicio falla con `SecurityException`. Hay que añadirlos como pide la tarea.
2. **Falta la dependencia `expo-task-manager`.** `package.json` solo tiene `expo-location ~18.0.5` y `expo-sensors`. `startLocationUpdatesAsync` necesita `TaskManager.defineTask`. `src/core/battery/expoProviders.ts` solo usa `expo-location` y `expo-sensors` en primer plano. TM-001 deja los permisos listos, pero el tracking en segundo plano no existirá hasta que se instale `expo-task-manager`. Es un cambio de código fuera del alcance de TM-001. Propongo una tarea aparte (TM-004).
3. **Añadir el plugin `expo-location` en `plugins`.** Se configura así:
   `["expo-location", { "isAndroidBackgroundLocationEnabled": true, "isAndroidForegroundServiceEnabled": true, "locationAlwaysAndWhenInUsePermission": "..." }]`
   Esto inyecta los permisos y el servicio al hacer prebuild. Si se declaran a mano y también por plugin, no hay conflicto porque Expo deduplica, pero el plugin es la fuente de verdad. También cubre iOS (`UIBackgroundModes: location`).
4. **Política de Google Play.**
   - Se necesita el formulario de Declaración de Permisos de Ubicación y un video demo. Esto aplica a la ruta `production` (AAB para Play Store).
   - Los textos de iOS ya justifican el uso. El texto actual dice "con acelerómetro". Para Play, conviene que diga claramente que la ubicación en segundo plano es la función principal (despejar niebla caminando).
   - Hace falta una notificación persistente visible del foreground service (título y texto sobrios, sin emojis, según el invariante de estética).
5. **Flujo de permisos en runtime.** Android 11+ obliga a pedir primero foreground (`requestForegroundPermissionsAsync`) y después background (`requestBackgroundPermissionsAsync`) en dos pasos. El segundo lleva al usuario a Ajustes. Hay que mostrar una pantalla explicativa antes del segundo paso.
6. **`ACTIVITY_RECOGNITION`.** Es permiso de runtime desde Android 10. Es necesario para el `Pedometer` y para suspender el GPS (Battery-Shield 3.0). Hay que pedirlo explícitamente. Mantenerlo.
7. **Batería (Battery-Shield 3.0).** Usar `accuracy: Balanced` y `distanceInterval` acorde al radio táctico (por defecto 45 m). Considerar pedir exención de optimización de batería solo si hay evidencia de que el SO mata el servicio (Xiaomi, Samsung). No pedirla por defecto, porque Play la restringe.

**Plan sugerido para `eas.json` (TM-001):**
- `preview`: `distribution: "internal"`, `android.buildType: "apk"`.
- `production`: `android.buildType: "apk"` si el objetivo es instalación directa, como indica la tarea. Para Play Store se necesitará `app-bundle`. Lo señalo como decisión pendiente del Tech Lead.
- Opcional: `autoIncrement` en `production`.

**Riesgos:**
- `npx tsc --noEmit` no valida `app.json`. Se verifica con `npx expo config --type public`, que no está en la lista de comandos permitidos. Pido al Tech Lead que lo autorice, o lo verifico solo con un parseo JSON.
- `newArchEnabled: true` con `@maplibre/maplibre-react-native`: hay que confirmar compatibilidad de versión antes del primer build EAS.

**Decisiones que necesito del Tech Lead antes de empezar:**
1. ¿`production` queda en APK (instalación directa) o se prepara AAB para Play?
2. ¿Se abre TM-004 para `expo-task-manager` y el flujo de permisos en runtime?
3. ¿Se autoriza `npx expo config` para validar?

---

## 2. Reportes de Ejecución y Auditorías

### Reporte TM-004: Integración de expo-task-manager y Foreground Service
- **Agente:** Claude Code (`--model sonnet`)
- **Archivos editados:** `package.json`, `src/core/battery/expoProviders.ts`, `src/components/modals/OnboardingModal.tsx`
- **Cambios realizados:**
  - Registrado `TaskManager.defineTask` con nombre `terramaps-background-location` y notificación persistente sobria de sistema: `«TerraMaps · Expedición activa» / «Registrando territorio explorado»` (sin emojis).
  - Flujo en dos pasos en el Onboarding de permisos: primero primer plano, luego explicación sobria para seleccionar "Permitir todo el tiempo" en Ajustes de Android.
  - Paquete `expo-task-manager` instalado y tipos corregidos a `async`.
- **Validaciones verificadas:**
  - `npx tsc --noEmit`: **0 errores**.
  - `node scripts/runTests.js`: **74/74 PASS (100%)**.
- **Estado final:** ✅ Tarea TM-004 completada y verificada.

### Reporte TM-001: Configuración de empaquetado nativo Android (EAS Build / APK)
- **Agente:** Claude Code (`--model sonnet`)
- **Archivos editados/creados:**
  - `app.json`: Inyectados permisos Android 14 (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`) y plugin `expo-location` (`isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true`).
  - `eas.json` (nuevo): Perfil `preview` genera archivo `.apk` instalable directamente en Android; perfil `production` configurado con `.aab` para Google Play Store.
- **Validación del Tech Lead (Antigravity):**
  - `npx expo config --type public`: **100% OK** (JSON válido sin advertencias).
  - `npx tsc --noEmit`: **0 errores**.
- **Estado final:** ✅ Tarea TM-001 completada y verificada.

### TM-001 — Implementado, validación PENDIENTE
- `app.json`: añadidos `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_LOCATION` a `android.permissions`; plugin `expo-location` con `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true` y `locationAlwaysAndWhenInUsePermission`.
- `eas.json` (nuevo): `preview` = `distribution: internal` + `buildType: apk`; `production` = `buildType: app-bundle` (AAB).
- **No se pudo ejecutar** `npx expo config --type public` ni `npx tsc --noEmit`: el entorno de PowerShell pidió aprobación manual y se denegó. Ambos resultados quedan sin verificar. No se tocó código TS, por lo que no se espera regresión en `tsc`.
- Pendiente: que el Tech Lead o el usuario ejecute ambos comandos, o autorice su ejecución, antes de mover TM-001 a Hecho.

### TM-004 — Implementado, validación PENDIENTE
- `package.json`: `expo-task-manager ~12.0.6` añadido a mano (SDK 52). **No instalado**: `npm install` y `npx expo install` pidieron aprobación manual.
- `expoProviders.ts`: `TaskManager.defineTask('terramaps-background-location')` a nivel de módulo (solo no-web), listeners en un `Set` (sin fugas: `stopBackgroundTracking` los elimina y detiene la tarea cuando no quedan). `startBackgroundTracking` usa `foregroundService` con notificación sobria («TerraMaps · Expedición activa», sin emojis). Helpers `requestForegroundStep` / `requestBackgroundStep`.
- `OnboardingModal.tsx`: en el paso 3, bloque de permisos en dos pasos (primer plano → explicación → segundo plano/Ajustes), oculto en web, con símbolos `◈ › ◎`.
- Nota: `startBackgroundTracking` aún no está conectado al motor Battery-Shield; no estaba en el alcance.
- **No se ejecutaron** `npx tsc --noEmit` ni `node scripts/runTests.js` (aprobación manual requerida). Sin instalar el paquete, `tsc` fallará en el import de `expo-task-manager`.
- Pendiente: `npx expo install expo-task-manager`, `npx tsc --noEmit`, `node scripts/runTests.js` (74/74).

---

## 3. Bloqueos, Deuda Técnica o Riesgos Detectados

*(Si tras 2 rondas algo no funciona o se detecta un riesgo en librerías o concurrencia, Claude lo documenta aquí)*
