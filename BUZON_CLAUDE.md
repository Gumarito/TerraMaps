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

### Voto técnico: rediseño UI/UX, `Cambios.md` (10 puntos) y liderazgo de diseño

**Alcance de esta revisión:** leí `Cambios.md` y la lista de componentes de `src/components`. No audité el código de cada punto. Los diagnósticos de abajo son hipótesis por síntoma y hay que confirmarlas al abrir cada archivo. No se modificó ningún archivo salvo este buzón.

**Diagnóstico por punto**

| # | Diagnóstico | Dónde mirar | Acción |
|---|---|---|---|
| 1 | Pide "sin curvas ni esquinas", lo cual se contradice. Lo más probable es que quiera bordes orgánicos sin picos ni artefactos. Chaikin con pocas pasadas deja esquinas en las uniones de corredores. | `src/core/geo/fogGeoJSON.ts` (`organicSmoothPolygon`) | Preguntar al usuario qué quiere (¿contorno continuo suave?). Subir pasadas de Chaikin, unir círculos y corredores antes de suavizar. |
| 2 | Las métricas se recalculan solo cuando se desbloquea una celda. Tienen que salir de un `onLocationUpdate` continuo (Pedometer y delta de GPS), independiente del descubrimiento. | `MapHUD.tsx`, `transportClassifier.ts` | Estado `sessionMetrics` actualizado por tick. Ver la definición de km abajo. |
| 3 | El botón de sincronizar redes sociales no abre nada. Sobra el buscador. | `FriendsModal.tsx` | Botón abre hoja de vinculación (OAuth o deep link). Se elimina el buscador. |
| 4 | "Autenticación y contactos" está duplicado en Perfil y Amigos. | `ProfileModal.tsx`, `FriendsModal.tsx` | Dejar la sección solo en Amigos. Perfil muestra únicamente el estado. |
| 5 | Falta un sistema de diseño. Cada pantalla define sus estilos. | todos los modales | Ver propuesta de tokens abajo. |
| 6 | Radar activo pasa a ser "Modo Fantasma", solo premium. | `MapHUD.tsx` | Depende del punto 7. Sin vínculo no tiene sentido. |
| 7 | Falta la función central: vínculo de pareja. | nuevo `LinkModal` | Reemplaza el botón Lugares. Ver riesgos de privacidad abajo. |
| 8 | El icono de la diana es demasiado pequeño dentro del contenedor. | `MapHUD.tsx` | Icono al ~45-50% del contenedor, que debe medir ~40-44 px. |
| 9 | Racha: volver a solo número y llama. | `MapHUD.tsx` | Cambio mínimo. |
| 10 | Los límites de no premium bloquean la prueba de skins. | `ThemeSelectorModal.tsx` | Flag solo de desarrollo (`__DEV__`) que desbloquea todo. Nunca en producción. |

**Definición propuesta para los km del punto 2 (confusos hoy):**
- `km recorridos` = distancia caminada en la sesión, acumulada por GPS con filtro de ruido.
- `km² descubiertos` = área de niebla despejada. Es otra unidad y va en otro lugar.
- Se muestran etiquetados. Ninguna métrica depende de que se despeje una celda.

**Votos técnicos**

1. **Lugares y Monumentos: de acuerdo con el usuario, se elimina.** No escala a escala global, y el costo de datos y almacenamiento es alto. Se reemplaza por el vínculo de pareja (punto 7). Si más adelante se quiere algo de ese tipo, se puede usar una fuente abierta como OSM o Wikidata, cargada bajo demanda y sin empaquetar.
2. **Botón "PASO" verde:** es herramienta de desarrollo. Propongo esconderlo tras `__DEV__` y excluirlo del build de producción. No hay que borrarlo, nos sirve para probar sin caminar.
3. **Vínculo de pareja y Modo Fantasma: de acuerdo con la idea, con un límite que no es opcional.**
   - Google Play y Apple tienen políticas explícitas contra el stalkerware. El diseño tiene que ser de consentimiento mutuo: ambos aceptan, cualquiera puede romper el vínculo, y existe un indicador visible mientras se comparte la ubicación.
   - El Modo Fantasma es compatible con eso, porque lo controla quien comparte. Al activarlo, la pareja ve "ubicación pausada" y no el último dato fresco. No se debe fingir que la ubicación sigue en vivo.
   - La ficha de la tienda y el marketing no deben usar el ángulo de parejas "tóxicas". Una app de vigilancia entre parejas se rechaza o se retira. Se vende como "exploren juntos". Esto no cambia la funcionalidad, solo el posicionamiento. Pido al usuario que lo confirme.
   - Esto es un cambio de esquema en la base de datos (tabla de vínculos, consentimiento, RLS en Supabase). Por la regla 1 de `AGENTS.md`, requiere revisión previa mía antes de ejecutarse.
4. **Liderazgo del diseño: voto por Claude como ejecutor principal, con Antigravity como director de visión.**
   - La razón es práctica. El resultado actual lo dejó el Tech Lead, el propio documento dice "has fracasado en el diseño", y su cuota Gemini está al 28%. Claude tiene 89% y es más fuerte escribiendo estilos de React Native coherentes.
   - Hay un sesgo que debo declarar: yo soy parte interesada en este voto. Lo mitiga dividir el trabajo como se indica abajo y revisar el resultado con capturas.
   - Fable no hace falta. Es trabajo de UI, no geometría H3 ni concurrencia. Queda sin invocar.
5. **Herramientas y plugins: casi nada que instalar.**
   - Un plugin de diseño no arregla la falta de criterio ni de sistema. Lo que falta es un sistema de tokens y un bucle de verificación visual.
   - Propongo crear `src/theme/tokens.ts` (colores Obsidian & Titanium, escala de espaciado de 4 px, radios, tipografía, elevaciones) y un `DESIGN.md` corto con reglas de uso. Todos los componentes importan de ahí.
   - Para verificar: capturas de la versión web con el skill `run` y comparación antes/después. Sin dependencias nuevas.
   - Descarto Figma y otros plugins pesados: gastan tokens y no cambian el resultado. Pido que Antigravity valide con el usuario antes de añadir cualquier dependencia visual.

**División de trabajo propuesta**

| Fase | Responsable | Contenido |
|---|---|---|
| D0 | Antigravity | Dirección de visión: 3-5 referencias, paleta y tono en `DESIGN.md`. Costo de cuota bajo. |
| D1 | Claude | `tokens.ts` + componentes base (`Button`, `Card`, `Chip`, `HudButton`). |
| D2 | Claude | Puntos 8, 9, 2, 4, 10 (cambios pequeños, aplican tokens). |
| D3 | Claude | Punto 3 (vincular redes) y punto 7 (vínculo de pareja) tras mi revisión del esquema. |
| D4 | Antigravity | Punto 1 (geometría de niebla) junto con mi revisión de `fogGeoJSON.ts`. Si el contorno resulta crítico, evaluar Fable. |
| D5 | Copilot | Traducciones (pre-lanzamiento punto 5) y ajustes de estilo menores una vez que existan los tokens. |
| Cierre | Claude | `tsc` 0 errores, `runTests.js` 74/74, capturas web antes/después. |

Máximo 2 rondas por fase, según las reglas. Antes de despachar cada tarea hay checkpoint en rama `agent/claude/<id>`.

**Pre-lanzamiento (resumen):** compatibilidad Android/iOS, rendimiento y batería, seguridad, traducción y anti-copia entran después del rediseño. Sobre "difícil de copiar para otras IA": se puede ofuscar el build (Hermes y minificación) pero no impedir que se copie el diseño visible. No lo prometería. La protección real está en el servidor: lógica de negocio y premium en Supabase, no en el cliente.

**Preguntas para el usuario (antes de empezar):**
1. Punto 1: ¿qué quiere decir exactamente "que deje de ser curvo, que no tenga esquinas"?
2. ¿Confirma el posicionamiento de pareja como "exploren juntos" con consentimiento mutuo, en lugar de "parejas tóxicas"?
3. ¿Qué referencias de diseño le gustan (apps o capturas)? Eso acelera D0 más que cualquier herramienta.

---

## 2. Reportes de Ejecución y Auditorías

### Reporte TM-005: Sincronización por lotes y Realtime con Supabase
- **Agente:** Claude Code (`--model sonnet`)
- **Archivos:** `src/services/supabaseSync.ts` (nuevo), `src/services/__tests__/supabaseSync.test.ts` (nuevo). No se tocó `.env*`.
- **Diseño:** `HexSyncEngine` recibe transporte, storage y timers por inyección (testeable sin red). Cola en `@terramaps_supabase_sync_pending`; lotes de 100 con `upsert` (`ignoreDuplicates`); debounce 5 s; backoff 2 s→60 s, máx. 5 reintentos; `notifyOnline()` reanuda. Realtime: canal `terramaps_sync_<userId>` con filtro `user_id=eq.<id>`, reconexión con backoff, cierre al quedar sin listeners.
- **Salida `npx tsc --noEmit`:**
  ```
  backups/agent_checkpoints/TM-005/routeTrackerService.ts(2,41): error TS2307: Cannot find module '../core/battery/batteryShield' or its corresponding type declarations.
  ```
  Sin errores en `src/`. El único error es preexistente, en una copia de respaldo. No lo toqué.
- **Sin verificar:**
  - La suite no se ejecutó (el entorno pidió aprobación para correr node). `node scripts/runTests.js` tampoco se corrió.
  - `runSupabaseSyncVerification()` no está enganchada a `mathVerification.ts`. Hay que llamarla desde `runAllVerifications`, y eso cambia el total de 74 aserciones.
- **Pendiente para integrarlo:** `syncService.ts` sigue teniendo su propio sync con otra clave de cola (`@terramaps_unsynced_hexes`). Decidir si `supabaseSync` lo reemplaza y llamar a `enqueue()` donde se desbloquean celdas. No exporté el módulo en `services/index.ts` para evitar colisiones.

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

### Reporte D1 + D2: tokens y ajustes de HUD / selector de skins
- **Agente:** Claude Code (Sonnet). Sin tocar `.env*`.
- **D1:** `src/theme/tokens.ts` (nuevo): `space` (escala 4px), `radius`, `fontSize`, `fontWeight`, `colors` (Obsidian & Titanium), `size` (FAB 42, icono 20). Los componentes base (`Button`, `Card`, `Chip`, `HudButton`) NO se crearon todavía.
- **Punto 8 (FAB):** `MapHUD.tsx`, botón 42px, glifo `◎` de 20px con `lineHeight`, `textAlign` y `includeFontPadding: false` para centrarlo. Sin verificar visualmente en dispositivo.
- **Punto 9 (racha):** solo `🔥 N`, sin caja ni borde. Atenuado si hoy no hay actividad. Nota: AGENTS.md prohíbe emojis en la UI; se usó 🔥 porque el usuario lo pidió expresamente. Si se prefiere un símbolo geométrico, es un cambio de una línea.
- **Punto 2 (km/pasos/kcal):** causa raíz en `regionalMetrics.ts`: cuando la distancia era 0 se estimaba por área de celdas (y había mínimos de 120 pasos / 15 kcal). Ahora solo dependen de `routeDistanceMeters` (movimiento real). La píldora muestra km (2 decimales), pasos y kcal.
- **Punto 10:** `accessControl.ts`: `getThemeLockReason` devuelve `null` si `__DEV__`, así modal y `App.tsx` (`resolveAccessibleThemeId`) coinciden. `ThemeSelectorModal.tsx`: ScrollView con `flexShrink`, `nestedScrollEnabled` y sin `maxHeight` fijo de 460.
- **Verificación:** `npx tsc --noEmit` 0 errores; `node scripts/runTests.js` 74/74.
- **Pendiente:** punto 4, componentes base de D1, capturas web antes/después.

---

## [2026-11-10] Informe /goal — Ingeniero de Interfaz y Diseño Principal

**Verificación:** `npx tsc --noEmit` → 0 errores · `node scripts/runTests.js` → 74/74.

| # | Estado | Cambio |
|---|--------|--------|
| 1 | OK | Barra superior: botones 42px (`size.hudIcon`), glifos 19px (`size.hudGlyph`) en `tokens.ts`/`MapHUD.tsx`. |
| 2 | OK | Eliminado tab "Lugares", `LandmarksModal.tsx`, su export y su estado en `App.tsx`. (Se conservan los marcadores de monumentos del mapa y `regionalLandmarks`; no son navegación.) |
| 3 | OK | Tab "Pareja" → `CoupleLinkModal` + `coupleLinkService` (PIN 6 dígitos, TTL 10 min, consentimiento explícito, desvincular, compartir batería, estado/batería/distancia). |
| 4 | OK | Amigos: eliminado input "Conectar con @usuario…"; quedan botones directos Google/Microsoft/Facebook/Instagram + sincronizar contactos. |
| 5 | OK | Perfil: eliminado el bloque "Autenticación & Contactos" y sus handlers/estado. |
| 6 | OK | `DEV_UNLIMITED_PRO = __DEV__` en `entitlementService.ts`: snapshot `isPro/timelineRestore = true`, `has()` siempre true, skins sin bloqueo (`accessControl.ts`). **Solo en dev**: producción sigue dependiendo del servidor (no se hardcodeó PRO en release). |
| 7 | OK (web) | `PartnerOffscreenRadar`: flecha + inicial + distancia en el borde cuando la pareja vinculada sale del viewport. `TerraMap.web` emite `onViewportChange`. |
| 8 | OK | Pulsación larga (0.9 s) sobre la marca "TerraMaps" abre `DevToolsModal`: Limpiar Mapa (doble toque de confirmación) y Teletransporte (Torreón, CDMX, Monterrey, Guadalajara + lat/lng manual). Hook: `teleportTo`, `clearExploredMap`. |
| 9 | OK | `regionalStats` usa `liveDistanceMeters` (suma por cada paso del simulador) → km, pasos y kcal se mueven en vivo, sin necesidad de grabar ruta. |
| 10 | Parcial | Nuevos `ModalShell`/`SurfaceCard` con tokens; `FriendsModal` migrado a tokens (backdrop, radios, espaciado, cierre 42px). Resto de modales (Profile, Routes, Share…) aún con valores sueltos. |

### Limitaciones honestas
- **QR no implementado**: no hay librería QR en el proyecto; solo PIN.
- **Vínculo de pareja es local**: la confirmación entre dos dispositivos reales requiere tabla de emparejamiento en Supabase (la API del servicio ya está preparada). Hoy enlaza con el integrante simulado `partner_1`.
- **GPS real**: el contador en vivo se alimenta del simulador; no hay `watchPosition` continuo en el hook (solo lectura inicial).
- El radar fuera de pantalla solo funciona en web; `TerraMap.native` no emite viewport ni dibuja socios.
- El tab Pareja usa el glifo `∞`; la racha del HUD aún usa 🔥 (pendiente por invariante de estética).

---

## Rediseño integral de interfaz premium (2026-11-10)

Verificación: `npx tsc --noEmit` = 0 errores · `node scripts/runTests.js` = 74/74. **No probado visualmente en dispositivo** (no se lanzó la app); falta validar en el móvil.

| # | Estado | Detalle |
|---|--------|---------|
| 1 | OK (causa raíz) | La etiqueta de la pareja quedaba tras el logo porque `updateZoomCulling` (`TerraMap.web.tsx`) escribía `style.transform = scale(..)` en el elemento raíz del marcador; MapLibre posiciona ese mismo elemento con `transform: translate`, así que el marcador caía en (0,0). Nuevo `applyMarkerCulling`: solo `display` en el raíz y opacidad/escala en el hijo interno (también para monumentos). Además el radar fuera de pantalla reserva `insetTop=96` / `insetBottom=170` para no tapar header ni barra. |
| 2 | OK | Eliminado el `onLongPress` del logo (ahora es una `View` estática) y la prop `onOpenDevTools` del HUD. Nueva fila "Herramientas del explorador" en el pie de Perfil (sección AVANZADO) → abre `DevToolsModal` (Limpiar Mapa / Teletransporte). |
| 3 | OK | `ThemeSelectorModal` rehecho: cuadrícula de tarjetas con miniatura (gradiente, retícula de calles, zona despejada con halo, marcador y cinta de paleta niebla·halo·acento), etiquetas de contorno fino (ACTIVA / PRO / POR PROGRESO) en vez de badges amarillos. Recibe `theme` para modo claro/oscuro. |
| 3b | **ATENCIÓN** | Acceso Pro automático: `PREVIEW_UNLOCK_ALL_PRO = true` en `entitlementService.ts` (`DEV_UNLIMITED_PRO = __DEV__ \|\| PREVIEW_UNLOCK_ALL_PRO`). Esto desbloquea todo lo PRO **también en builds de producción**. **Poner en `false` antes de publicar en tiendas.** |
| 4 | OK | `ProfileModal` rehecho: tarjeta hero con micro-gradiente (monograma, rango, nivel dominante, progreso), fila Terra PRO, StatTiles, datos regionales en `DataRow`, logros con glifos `◈/◇` (sin emojis), control segmentado para el radio (30/45/60/85 m, 85 sigue siendo PRO), biometría, sonido. Sin verdes fosforescentes ni bordes de 1.5px; hairlines y acento del tema. |
| 5 | OK | `RoutesHistoryModal` y `FriendsModal` migrados a `ModalShell`/`SurfaceCard`. Eliminados los botones "Volver al Mapa" (el cierre es la ✕ de la cabecera); acciones compactas ("Ver en el mapa", "Eliminar"); período como control segmentado; métricas en columnas. |
| 6 | OK | Skills aplicadas como criterio (jerarquía, targets ≥42px, `accessibilityRole/State`, estados vacíos). No se ejecutó la revisión formal `code-review-and-quality`. |

### Cambios de base
- `tokens.ts`: `emerald`, `goldSoft`, `cardGradientFrom/To`.
- `ModalShell.tsx` ahora exporta además: `SectionLabel`, `StatTile`, `Tag`, `DataRow`, `ActionButton` y `SurfaceCard` con `tone="hero"` (usa `expo-linear-gradient`, ya instalado). `modalPalette` suma `gradient`, `gold`, `positive`.
- HUD: racha con glifo `◆` en vez de 🔥 (cierra la deuda de estética del punto anterior).

### Pendiente / no cubierto
- `SocialShareModal`, `CoupleLinkModal`, `ProPaywallModal`, `TimelinePaywallModal`, `OnboardingModal`, `LeaderboardModal`, `DroneModal` siguen con estilos propios (fuera del alcance pedido).
- `achievementsService` aún devuelve `iconEmoji`; Perfil ya no lo muestra, pero otros consumidores podrían.
- La pareja solo se dibuja en web; `TerraMap.native` sigue sin marcadores de socios.
