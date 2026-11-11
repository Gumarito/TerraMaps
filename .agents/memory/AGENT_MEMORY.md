# 🧠 MEMORIA PERMANENTE DEL PROYECTO (DIRECTIVAS DE EFICIENCIA)

> **Mandato Supremo del Usuario:**
> *"El propósito es ser lo más eficiente posible sin desperdiciar tokens. Para esto puedes usar todas las herramientas que consideres necesarias, mandar instrucciones a Copilot, usar agentes, skills, la IA de NVIDIA y todo lo que consideres."*

---

## 1. Reglas de Eficiencia & Cero Desperdicio de Tokens (Headroom + Ponytail)

1. **Lectura Quirúrgica (No volcar archivos enteros):**
   - Siempre que se inspeccione código, usar `StartLine` y `EndLine` para leer únicamente las funciones o interfaces relevantes.
   - Usar `CODEBASE_GRAPH.md` para consultar dependencias y exportaciones en $O(1)$ sin re-leer archivos completos.

2. **Acción Directa y Concisión:**
   - La respuesta más corta y precisa que resuelva el problema al 100% es la mejor.
   - Cero rodeos, cero explicaciones teóricas redundantes cuando el código o la acción habla por sí misma.
   - Principio YAGNI: no crear capas de abstracción o wrappers vacíos si no son estrictamente necesarios.

---

## 2. Orquestación Multi-Agente & Herramientas Externas

1. **Delegación a Subagentes Especializados:**
   - Para auditorías pesadas, búsquedas extensas o tareas de seguridad/rendimiento que generen logs masivos, invocar subagentes en segundo plano (`invoke_subagent`). Esto mantiene el contexto del hilo principal limpio y enfocado.

2. **Coordinación con GitHub Copilot (`.github/copilot-instructions.md`):**
   - Guiar a Copilot mediante instrucciones claras en el repositorio para que genere autocompletados consistentes con la arquitectura de TerraMaps (H3 Res 9, Battery Shield, storage memoizado, sanitización de seguridad).

3. **Flota de Modelos NVIDIA NIM / Brev:**
   - Aprovechar el router [`scripts/nvidiaReasoner.js`](../../scripts/nvidiaReasoner.js) y las credenciales de Brev cuando se requiera razonamiento extra de modelos de última generación (Nemotron-3 Ultra 550B, DeepSeek v4.1 Flash, Mistral Large 1T, Cosmos Reason 2) sin agotar cuotas primarias.

---

## 3. Invariantes Técnicos de TerraMaps

* **H3 Resolution 9:** Unidad atómica territorial ($1,250\text{ m}^2$ huella de calle / $100,718\text{ m}^2$ celda matemática).
* **Battery-Shield 3.0:** Control de duty-cycling del GPS según velocidad cinemática (Inmóvil, Caminando, Corriendo, Bici, Auto, Vuelo).
* **Niebla Translúcida:** Velo orgánico sutil sin tapar la ciudad underneath.
* **Seguridad Estricta:** Coordenadas WGS84 acotadas, índices H3 de 15 caracteres hexadecimales, JSON payloads con límite de 25MB y neutralización de Prototype Pollution.
* **Verificación Continua:** Todo cambio debe verificar `npx tsc --noEmit` (0 errores) y pasar la suite `scripts/runTests.js` (100% PASS).

---

## 4. Jerarquía Tridente CLI (Antigravity + Claude Code/Fable 5.2 + Copilot Fusion)

1. **Roles y Protección de Cuota Semanal:**
   - **Tech Lead:** Antigravity (`Gemini 3.8 Flash` por defecto para proteger la cuota semanal; `Gemini 4 Argon` solo bajo demanda arquitectónica).
   - **Backend, Scripts y Auditoría:** `claude` en terminal (`--model sonnet` para tareas `normal`; `--model fable` para **Fable 5.2** **exclusivamente** en tareas marcadas con `Modelo recomendado: Fable` y con autorización explícita del usuario).
   - **Asistente Rápido:** `copilot` en terminal para cambios pequeños, UI puntual y catálogos JSON.
2. **Reglas de Despacho y Seguridad Real:**
   - **Solo Antigravity despacha** (con permiso previo del usuario antes de cada llamada CLI). Claude y Copilot no se llaman entre sí; máximo **2 rondas** por tarea.
   - **Checkpoint Git obligatorio:** Hacer commit o crear rama `agent/<agente>/<tarea>` antes de cada delegación.
   - **Bloqueo duro de `.env*` y comandos destructivos:** Aplicado en `.claude/settings.json` (`permissions.deny`), en `--allowedTools` acotados (`npx tsc`, `node scripts/runTests.js`, `git status`, `git diff`) y en `--deny-tool` de Copilot (prohibido `--allow-all-tools`).
