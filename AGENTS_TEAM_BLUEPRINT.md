# 🤖 TerraMaps — Arquitectura Multi-Agente y Flota NVIDIA NIM (2026)

> **Estrategia Híbrida de Agentes:** Combina la orquestación nativa de Antigravity con la flota en vivo de **NVIDIA NIM (Generación 2026)** alojada en `https://integrate.api.nvidia.com/v1`, aplicando el principio **YAGNI (Ponytail)** y verificación estricta de tipos (**Addy Osmani Skills**).

---

## 👥 1. Jerarquía de Agentes y Modelos 2026

```
                         ┌─────────────────────────────────────────┐
                         │        ANTIGRAVITY / TECH LEAD          │
                         │   (Gemini 4 Argon High / Claude Opus)   │
                         └────────────────────┬────────────────────┘
        ┌─────────────────────────┬───────────┴───────────┬─────────────────────────┐
        ▼                         ▼                       ▼                         ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│    GEO-ENGINE     │   │     MOBILE-UI     │   │   BACKEND-SYNC    │   │  SPATIAL-SENSOR   │
│ Nemotron-3 Ultra  │   │ Nemotron 3.5 VL   │   │ DeepSeek v4.1     │   │ Cosmos Reason 2   │
│   550B (A55B)     │   │   120B (A12B)     │   │   Flash / Laguna  │   │       (8B)        │
│ • Matemáticas H3  │   │ • Simplicidad UX  │   │ • Supabase & RLS  │   │ • Cinemática GPS  │
│ • RFC 7946 GeoJSON│   │ • Modo Claro/Osc. │   │ • Cola Offline    │   │ • Battery-Shield  │
└───────────────────┘   └───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## 🛠️ 2. Matriz de Modelos 2026 Verificados en Vivo (`GET /v1/models`)

| Rol (`--role`) | Modelo ID en NVIDIA NIM | Capacidad / Arquitectura | Misión en TerraMaps |
| :--- | :--- | :--- | :--- |
| **`architect`** | `nvidia/nemotron-3-ultra-550b-a55b` | 550B MoE (55B activos), Mamba-2 + Transformer, 1M contexto | Geometría esférica H3, algoritmos de máscara inversa GeoJSON y arquitectura general. |
| **`coder`** | `deepseek-ai/deepseek-v4.1-flash` *(Fallback: `poolside/laguna-xs-2.1`)* | MoE de código cuantizado en NVFP4 sobre Blackwell | Implementación limpia en TypeScript, React Native y optimización de hooks. |
| **`frontier`** | `mistralai/mistral-large-4-1t-a52b` *(Fallback: `moonshotai/kimi-k2.6`)* | 1 Trillón de parámetros MoE (52B activos) | Refactorizaciones de múltiples archivos y lógica de sincronización distribuida. |
| **`vision`** | `nvidia/nemotron-3.5-super-vl-120b-a12b` | 120B Vision-Language MoE (12B activos) | Diseño minimalista ("Don't Make Me Think"), temas Claro/Oscuro y simulador móvil. |
| **`spatial`** | `nvidia/cosmos-reason2-8b` | World Foundation & Physical Reasoning Model | Máquina de estados Battery-Shield de 3 niveles, filtros Haversine y podómetro. |
| **`fast`** | `nvidia/nemotron-3.5-lightning-30b-a3b` *(Fallback: `z-ai/glm-5.3-flash`)* | 30B MoE ultra-rápido (3B activos) | Validaciones instantáneas, pruebas unitarias y formateo de esquemas. |

---

## 🚀 3. Comandos Rápidos de Ejecución

### Iniciar Servidor en Vivo (Web + Simulador de Celular)
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
& "C:\Program Files\nodejs\npx.cmd" expo start --web
```

### Ejecutar Suite de Verificación Matemática (20 Aserciones)
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit
```

### Consultar la Flota NVIDIA NIM 2026
```powershell
# Ver los 84+ modelos activos en tiempo real:
& "C:\Program Files\nodejs\node.exe" scripts/nvidiaReasoner.js --list

# Invocar a un especialista:
& "C:\Program Files\nodejs\node.exe" scripts/nvidiaReasoner.js --role=architect "Tu consulta técnica"
```

---

## 🛡️ 4. Coordinación CLI con Claude Code (Sonnet / Fable 5.2) y Copilot Fusion

Además de la flota NVIDIA NIM, el **Tech Lead (Antigravity / Gemini)** coordina a **Claude Code** y **GitHub Copilot CLI** mediante el archivo `AGENT_SYNC.md` bajo las reglas de `AGENTS.md`:

| Nivel | Agente CLI | Uso Autorizado | Restricciones de Seguridad |
| :--- | :--- | :--- | :--- |
| **Tech Lead** | **Antigravity (Gemini 3.8 / 4 Argon)** | Dirección arquitectónica, creación de rama/commit `agent/<agente>/<tarea>` y despacho único (máx. 2 rondas). | Pide permiso al usuario antes de cada llamada CLI. Nunca lee ni toca `.env*`. |
| **Ejecución y Auditoría** | **Claude Code (`--model sonnet`)** | Tareas con `Modelo recomendado: normal` en `AGENT_SYNC.md` (backend, refactorizaciones, verificación `tsc` y tests). | Gobernado por `.claude/settings.json`. Solo permite `Bash(npx tsc *)`, `Bash(node scripts/runTests.js)`, `Bash(git status*)`, `Bash(git diff*)`. |
| **Arma Especialista** | **Claude Fable 5.2 (`--model fable`)** | **Solo** tareas marcadas con `Modelo recomendado: Fable` + autorización explícita del usuario. | Mismos candados de `.claude/settings.json`. Prohibido llamar a Copilot o Gemini. |
| **Asistente Rápido** | **Copilot Fusion (`copilot -p`)** | Cambios rápidos de UI, textos y datos pequeños. | Prohibido `--allow-all-tools`. Usa `--allow-tool` puntuales y `--deny-tool` contra `.env*`, `rm`, `git push` y otros CLIs. |

