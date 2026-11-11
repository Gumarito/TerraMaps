---
name: headroom-context-optimizer
description: Reglas de compresión de contexto e higiene de tokens estilo Headroom. Evita inflar la ventana de contexto con logs gigantes, JSON crudos o lecturas completas de archivos grandes.
---

# Headroom — Optimización y Compresión de Tokens

1. **Lectura Quirúrgica de Archivos:** Nunca leas un archivo completo de más de 150 líneas si solo necesitas inspeccionar una función. Usa `StartLine` y `EndLine` apoyándote en el índice de Graphify (`.agents/memory/CODEBASE_GRAPH.md`).
2. **Filtrado de Comandos de Terminal:** Al ejecutar comandos que puedan escupir cientos de líneas, filtra la salida con `Select-Object -First 30` o `Select-String "error|warning"`.
3. **Cero Repetición de Código:** Nunca repitas bloques enteros de código en tus respuestas al usuario; usa enlaces clicables a las líneas exactas del archivo.
