---
name: nvidia-nim-fleet
description: Orquesta y delega tareas a la flota de modelos 2026 de NVIDIA NIM (Nemotron-3 Ultra 550B, DeepSeek v4.1 Flash, Mistral Large 4 1T, Nemotron 3.5 Super VL 120B, Kimi k2.6, Poolside Laguna 2.1 y Cosmos Reason 2). Úsalo cuando se requiera potencia extra sin gastar tokens principales o para consultar el catálogo en vivo de build.nvidia.com.
---

# Flota de Agentes NVIDIA NIM (Catálogo en Vivo 2026)

Esta skill conecta a Antigravity con el endpoint en vivo `https://integrate.api.nvidia.com/v1` mediante el enrutador [`scripts/nvidiaReasoner.js`](../../../scripts/nvidiaReasoner.js).

## 1. Matriz de Modelos 2026 Activos (No usar modelos obsoletos de 2024/2025)

| Rol (`--role`) | Modelo ID Exacto en NVIDIA NIM | Arquitectura / Capacidad | Cuándo Usarlo |
| :--- | :--- | :--- | :--- |
| **`architect`** | `nvidia/nemotron-3-ultra-550b-a55b` | 550B MoE (55B activos), Mamba-2 + Transformer, 1M contexto | Arquitectura compleja, matemáticas H3, diseño de sistemas y orquestación. |
| **`coder`** | `deepseek-ai/deepseek-v4.1-flash` *(Fallback: `poolside/laguna-xs-2.1`)* | MoE de generación de código de ultra-baja latencia | Implementar funciones en TypeScript, React Native, SQL y corrección de bugs. |
| **`frontier`** | `mistralai/mistral-large-4-1t-a52b` *(Fallback: `moonshotai/kimi-k2.6`)* | 1 Trillón de parámetros MoE (52B activos) | Lógica full-stack pesada, refactorizaciones grandes y análisis profundo. |
| **`vision`** | `nvidia/nemotron-3.5-super-vl-120b-a12b` | 120B Vision-Language MoE (12B activos) | Diseño UX/UI, auditoría de pantallas móviles y flujos multimodales. |
| **`spatial`** | `nvidia/cosmos-reason2-8b` | World Foundation & Physical Reasoning Model | Cinemática GPS, física de sensores, acelerómetro y ahorro de batería. |
| **`fast`** | `nvidia/nemotron-3.5-lightning-30b-a3b` *(Fallback: `z-ai/glm-5.3-flash`)* | 30B MoE ultra-ligero (3B activos) | Tareas rápidas, formateo de JSON, validaciones y llamadas frecuentes. |

## 2. Comandos de Ejecución para Agentes

- **Listar los 84+ modelos activos en tiempo real:**
  ```powershell
  & "C:\Program Files\nodejs\node.exe" scripts/nvidiaReasoner.js --list
  ```
- **Delegar una tarea a un especialista de la flota:**
  ```powershell
  & "C:\Program Files\nodejs\node.exe" scripts/nvidiaReasoner.js --role=architect "Analiza la complejidad espacial de..."
  ```

## 3. Reglas de Disciplina (Inspiradas en Ponytail + Addy Osmani + NeMo Agent Toolkit)
1. **Principio YAGNI (Ponytail):** Prohibido crear abstracciones innecesarias, envoltorios vacíos o sobre-ingeniería. Escribir el código más simple, legible y directo que resuelva el problema.
2. **Validación Continua (Addy Osmani):** Todo cambio en TypeScript debe pasar `npx tsc --noEmit` con 0 errores antes de darse por terminado.
3. **Economía de Contexto (Headroom):** No volcar archivos completos ni logs masivos al contexto si basta con leer las líneas relevantes.
