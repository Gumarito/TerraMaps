# AGENT_SYNC.md — Tablero de Sincronización Multi-Agente (TerraMaps)

> **Protocolo de Uso:**
> 1. **Tech Lead (Antigravity / Gemini)** redacta las tareas en `## 1. Pendiente`, asigna el agente (`Claude` o `Copilot`) y define `Modelo recomendado: normal` o `Modelo recomendado: Fable`.
> 2. **Antes de delegar:** Crear commit o rama `agent/<agente>/<id-tarea>` y solicitar permiso explícito al usuario.
> 3. **Límite de iteración:** Máximo **2 rondas** por tarea. Claude y Copilot no se invocan entre sí.
> 4. Al terminar, el agente ejecutor mueve la tarea a `## 3. Hecho` indicando archivos tocados y salida de `npx tsc --noEmit` y `node scripts/runTests.js`.
> 5. **Debate y decisiones:** el canal Claude ⇄ Antigravity es `AGENT_CHAT.md`. Antigravity lo lee **antes de actuar en cada mensaje del usuario** y no despacha una tarea mientras haya mensajes bloqueantes abiertos que la afecten.

---

## 1. Pendiente

### [TM-003] Optimización de unión topológica en corredores H3 masivos (+50,000 celdas)
- **Agente asignado:** Claude
- **Modelo recomendado:** Fable
- **Rama sugerida:** `agent/claude/TM-003`
- **Archivos objetivo:** `src/core/geo/fogGeoJSON.ts`
- **Descripción:** *(Reservar para cuando se requiera escalar a historiales de +10 años)* Optimizar la detección de anillos interiores (huecos de niebla no explorada dentro de una ciudad rodeada de sectores desbloqueados) manteniendo el suavizado `organicSmoothPolygon` en menos de 16ms por frame.
- **Criterio de aceptación:** Benchmark < 16ms para 10,000 celdas, `npx tsc --noEmit` (0 errores) y `node scripts/runTests.js` (100% PASS). *(Requiere autorización explícita del usuario para usar `--model fable`)*.

---

## 2. En curso

*(Ninguna tarea en curso actualmente)*

---

## 3. Hecho

### [TM-005] Servicio de Sincronización en la Nube con Supabase Realtime
- **Agente asignado:** Claude Code (`--model sonnet`)
- **Archivos creados:** `src/services/supabaseSync.ts`, `src/services/__tests__/supabaseSync.test.ts`
- **Resultado:** `HexSyncEngine` (inyectable) con cola persistente, lotes de 100, debounce 5s, reintento con backoff exponencial (máx. 5) y suscripción Realtime filtrada por `user_id` con reconexión. Instancia lista: `supabaseSync`.
- **Validación:**
  - `npx tsc --noEmit`: 0 errores en `src/`; 1 error preexistente fuera de alcance en `backups/agent_checkpoints/TM-005/routeTrackerService.ts` (import roto en una copia de respaldo).
  - `node scripts/runTests.js`: NO ejecutado. La suite nueva (`runSupabaseSyncVerification`) no está enganchada a `src/core/tests/mathVerification.ts` y no se ha podido correr aquí (pendiente del Tech Lead).

### [TM-004] Integración de `expo-task-manager` y Foreground Service en segundo plano
- **Agente asignado:** Claude Code (`--model sonnet`)
- **Archivos modificados:** `package.json`, `src/core/battery/expoProviders.ts`, `src/components/modals/OnboardingModal.tsx`
- **Resultado:**
  - `TaskManager.defineTask` registrado para `terramaps-background-location` con notificación persistente: *"TerraMaps · Expedición activa — Registrando territorio explorado"*.
  - Flujo de permisos en dos pasos implementado en `OnboardingModal` (foreground -> explicación sobria -> background).
  - Verificaciones: `npx tsc --noEmit` (**0 errores**) y `node scripts/runTests.js` (**74/74 PASS, 100%**). Reporte en `BUZON_CLAUDE.md`.

### [TM-002] Expansión del catálogo de Monumentos e Hitos Regionales (México)
- **Agente asignado:** Copilot
- **Archivos modificados:** `src/services/regionalMetrics.ts`, `src/core/geo/regionalLandmarks.ts`, `src/components/modals/LandmarksModal.tsx`
- **Resultado:**
  - Añadidos Cristo de las Noas y Plaza Mayor de Torreón; Parque Fundidora y Macroplaza de Monterrey; Hospicio Cabañas y La Minerva de Guadalajara; y Torre Escénica de Cancún.
  - El descubrimiento usa el catálogo regional sin alterar el conjunto de invariantes de CDMX.
  - El modal identifica la región de cada lugar y usa símbolos geométricos sobrios en los nuevos marcadores.
  - `npx tsc --noEmit`: OK (0 errores).
  - `node scripts/runTests.js`: Verificado por Tech Lead (**74/74 aserciones PASS, 100%**). Reportado en `BUZON_COPILOT.md`.

### [TM-001] Configuración de empaquetado nativo Android (EAS Build / APK)
- **Agente asignado:** Claude Code (`--model sonnet`)
- **Archivos creados/modificados:** `app.json`, `eas.json`
- **Resultado:**
  - `app.json`: Agregados permisos Android 14 `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_LOCATION`, más configuración completa del plugin `expo-location`.
  - `eas.json`: Creado con perfil `preview` (`buildType: "apk"`, `distribution: "internal"`) para generar el instalable directo en tu teléfono Android, y perfil `production` (`buildType: "app-bundle"`) para Google Play.
  - Validaciones: `npx expo config --type public` (OK) y `npx tsc --noEmit` (0 errores).

### [TM-000] Infraestructura y Jerarquía Multi-Agente v1.0
- **Agente asignado:** Antigravity (Tech Lead)
- **Modelo recomendado:** normal
- **Resultado:** Creados `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` y `AGENT_SYNC.md`. Verificados en terminal `claude -p` y `copilot -p` con restricciones de seguridad reales y bloqueo de `.env*`.

---

## 4. Registro de Herramientas Instaladas (Nivel Proyecto)

| Proyecto | Elemento | Tipo | Ubicación | Para qué sirve |
| :--- | :--- | :--- | :--- | :--- |
| **TerraMaps** | `headroom-context-optimizer` | Skill | `.claude/skills/headroom-context-optimizer/SKILL.md` | Higiene de contexto y lectura quirúrgica por líneas; evita lecturas masivas y ahorra tokens. |
| **TerraMaps** | `ponytail` | Skill | `.claude/skills/ponytail/SKILL.md` | Modo Senior Dev YAGNI: cambios mínimos, código limpio y directo sin sobreingeniería. |
| **TerraMaps** | `graphify-code-map` | Skill | `.claude/skills/graphify-code-map/SKILL.md` | Consulta directa de arquitectura en `.agents/memory/CODEBASE_GRAPH.md` en $O(1)$. |
| **TerraMaps** | `settings.json` | Config | `.claude/settings.json` | Lista blanca de comandos (`tsc`, `tests`, `git`) y bloqueo duro de `.env*` y comandos destructivos. |

