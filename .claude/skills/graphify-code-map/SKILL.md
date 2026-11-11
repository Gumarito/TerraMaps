---
name: graphify-code-map
description: Genera y consulta el grafo determinista de dependencias, exportaciones y arquitectura del proyecto (.agents/memory/CODEBASE_GRAPH.md) sin gastar tokens releyendo archivos.
---

# Graphify — Grafo de Conocimiento del Código

Antes de escanear múltiples archivos del repositorio, lee siempre `.agents/memory/CODEBASE_GRAPH.md` para conocer exactamente qué módulos existen, cuántas líneas tienen, qué símbolos exportan y de qué módulos dependen.

## Cómo actualizar el grafo tras añadir o modificar archivos:
```powershell
& "C:\Program Files\nodejs\node.exe" scripts/graphifyMap.js
```
