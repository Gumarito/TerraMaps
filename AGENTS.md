# AGENTS.md — Constitución Multi-Agente de TerraMaps

> **Proyecto:** TerraMaps (React Native / Expo Web / Uber H3 / MapLibre GL / Supabase)
> **Coordinación Central:** Orquestación Hub-and-Spoke dirigida por **Antigravity (Tech Lead)** mediante `AGENT_SYNC.md`.

---

## 1. Jerarquía Oficial y Roles

| Rol | Agente / Modelo | Responsabilidad | Canal de Comunicación |
| :--- | :--- | :--- | :--- |
| **Tech Lead & Orquestador** | **Antigravity** (`Gemini 3.8 Flash` diario / `Gemini 4 Argon` bajo demanda) | Define la arquitectura, diseña tareas en `AGENT_SYNC.md`, crea checkpoints Git (`agent/<agente>/<tarea>`), consulta decisiones mayores con Claude y valida resultados. | `AGENT_SYNC.md` / `BUZON_CLAUDE.md` / Chat |
| **Ingeniero de Backend, Scripts y Auditoría** | **Claude Code CLI** (`--model sonnet` por defecto) | **Tiene voz y voto técnico.** Ejecuta tareas asignadas, emite opiniones de arquitectura en `BUZON_CLAUDE.md`, refactoriza módulos y verifica con `tsc` y tests. | `BUZON_CLAUDE.md` / `AGENT_SYNC.md` |
| **Arma Especialista (Complejidad Extrema)** | **Claude Fable 5.2** (`--model fable`) | Reservado **exclusivamente** para tareas marcadas con `Modelo recomendado: Fable` y con autorización explícita del usuario (geometría esférica H3 crítica, concurrencia o bugs severos). | `BUZON_CLAUDE.md` / `AGENT_SYNC.md` |
| **Asistente Rápido** | **Copilot Fusion CLI** (`copilot -p`) | Ajustes puntuales de UI, estilos, traducciones, refactorizaciones pequeñas y autocompletado. | `BUZON_COPILOT.md` / `AGENT_SYNC.md` |

---

## 2. Reglas de Seguridad, Despacho y Control de Versiones (Obligatorias)

1. **Voz y Voto de Claude (Consultas Previas a Cambios Mayores):**
   - Antes de ejecutar cambios estructurales de arquitectura (esquema de base de datos, motor de renderizado MapLibre, pipeline de empaquetado nativo o refactorizaciones multi-módulo), el Tech Lead consulta a Claude para que revise el enfoque y deje su voto técnico en `BUZON_CLAUDE.md`.
2. **Ahorro de Tokens y Eficiencia Extrema (Headroom + Ponytail):**
   - Claude y Copilot deben aplicar lectura quirúrgica (`headroom-context-optimizer`) y cambios mínimos necesarios (`ponytail`), evitando volcar archivos enteros o explicaciones redundantes.
3. **Despacho Exclusivo (Hub-and-Spoke):**
   - **Solo Antigravity (Tech Lead) o el usuario despachan tareas.**
   - **Prohibido el encadenamiento entre agentes:** Claude nunca invoca a `copilot` ni a `gemini` por CLI; Copilot nunca invoca a `claude` ni a `gemini`.
   - **Máximo 2 rondas por tarea:** Si tras 2 iteraciones de ejecución/corrección una tarea no queda resuelta, el agente debe detenerse, documentar el bloqueo en `BUZON_CLAUDE.md` y devolver el control al Tech Lead.
2. **Permiso Explícito del Usuario (Protección de Cuota):**
   - Antigravity debe pedir permiso explícito al usuario antes de ejecutar cualquier llamada a `claude -p` o `copilot -p`.
   - El modelo `Fable` (`--model fable`) jamás se invoca sin que la tarea tenga `Modelo recomendado: Fable` en `AGENT_SYNC.md` y el usuario lo autorice expresamente.
3. **Checkpoint Git Previo a Delegación:**
   - Antes de despachar cualquier tarea que modifique archivos, se debe hacer un commit limpio o crear/cambiar a una rama `agent/<agente>/<id-tarea>` (ej. `agent/claude/TM-001`) para garantizar reversión inmediata.
4. **Blindaje de Secretos y Comandos (`.claude/settings.json`):**
   - **Prohibición absoluta sobre `.env*`:** Ningún agente puede leer, imprimir, modificar ni borrar archivos `.env` o `.env.*`.
   - **Bash restringido en Claude:** En modo no interactivo solo se habilitan herramientas de edición y comandos seguros (`Bash(npx tsc *)`, `Bash(node scripts/runTests.js)`, `Bash(git status*)`, `Bash(git diff*)`). Nunca usar `Bash` sin restricciones ni `--dangerously-skip-permissions`.
   - **Flags restringidos en Copilot:** Nunca usar `--allow-all-tools` ni `--yolo`. Usar siempre `--allow-tool` específicos combinados con `--deny-tool` para bloquear borrados (`rm`, `Remove-Item`), `git push`, `git reset`, lectura de `.env*` e invocación de otros CLIs.

---

## 3. Comandos Oficiales de Despacho No Interactivo

### Para Claude Code (`normal` = Sonnet / `Fable` = Fable 5.2)
```powershell
# Modo Normal (Sonnet)
$null | claude -p "Ejecuta la tarea TM-XXX de AGENT_SYNC.md y actualiza su estado" --model sonnet --permission-mode acceptEdits --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "Bash(npx tsc *)" "Bash(node scripts/runTests.js)" "Bash(git status*)" "Bash(git diff*)"

# Modo Fable 5.2 (SOLO con tarea marcada Fable + autorización explícita del usuario)
$null | claude -p "Ejecuta la tarea crítica TM-XXX de AGENT_SYNC.md" --model fable --permission-mode acceptEdits --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "Bash(npx tsc *)" "Bash(node scripts/runTests.js)" "Bash(git status*)" "Bash(git diff*)"
```

### Para Copilot Fusion CLI
```powershell
copilot -p "Ejecuta la tarea TM-XXX de AGENT_SYNC.md" -s --trust-folder --allow-tool="write" --allow-tool="shell(npx tsc:*)" --allow-tool="shell(node scripts/runTests.js)" --allow-tool="shell(git status)" --allow-tool="shell(git diff)" --deny-tool="shell(rm:*)" --deny-tool="shell(Remove-Item:*)" --deny-tool="shell(git push:*)" --deny-tool="shell(git reset:*)" --deny-tool="shell(claude:*)" --deny-tool="shell(copilot:*)" --deny-tool="shell(*.env*)"
```

---

## 4. Invariantes Técnicos y de Producto de TerraMaps

1. **Estética Ejecutiva ("Obsidian & Titanium"):**
   - Interfaz sobria de alta relojería/aviación privada. **Prohibido usar emojis infantiles** en la UI; emplear únicamente símbolos geométricos limpios (`◫`, `◈`, `◎`, `›`).
   - El HUD superior debe mantener `paddingTop: 16` en web para no empujar los botones hacia abajo en pantallas móviles.
2. **Geometría Orgánica Circular (Cero Hexágonos Visibles):**
   - Aunque el índice espacial subyacente es **Uber H3 Resolución 9** (`validateH3Index()`), la visualización en `src/core/geo/fogGeoJSON.ts` (`organicSmoothPolygon`) debe renderizar sectores aislados como **círculos uniformes de 28 vértices y 85m de radio** (~55% del ancho de celda) y corredores multi-celda suavizados con Chaikin (3 pasadas + densificación cada 15m).
3. **Modos de Niebla y Skins:**
   - Soportar los 4 modos de niebla en `mapThemes.ts`: `translucent_veil`, `dense_fog`, `realistic_mist` (Neblina Real con blur dinámico de 14px) y `perimeter_only`.
   - La skin de bloques se denomina **"Minecraft"** (sin la palabra "Voxel").
4. **Biometría, Pasos y Battery-Shield 3.0:**
   - Respetar las bandas cinemáticas de `transportClassifier.ts` y el radio táctico configurable (`[30m, 45m, 60m, 85m]`, por defecto `45m`, persistido en `@terramaps_exploration_radius`).
   - Cálculo continuo de pasos (`estimatedSteps`) y calorías personalizadas según peso (kg) y estatura (cm) del usuario.
5. **Privacidad y Monetización de Historial (Google Takeout):**
   - El análisis de `Records.json` es 100% local en el dispositivo.
   - **Bono de Ciudad Natal:** Desbloquea gratis únicamente los sectores dentro de la ciudad más frecuentada por el usuario; los viajes a otras ciudades/países permanecen bajo el paywall de la Cápsula del Tiempo ($4.99 USD).
6. **Barra de Calidad Innegociable:**
   - Cero `@ts-ignore`, cero `any` sin justificar.
   - `npx tsc --noEmit` debe finalizar con **0 errores**.
   - `node scripts/runTests.js` debe pasar el **100% de las aserciones (74/74)**.
   - Para lectura eficiente de dependencias, consultar `.agents/memory/CODEBASE_GRAPH.md` antes de abrir múltiples archivos.
