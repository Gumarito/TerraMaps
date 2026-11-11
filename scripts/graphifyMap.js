/**
 * Graphify Local Engine - Deterministic Codebase Knowledge Graph
 * 
 * Escanea instantáneamente el árbol de archivos TypeScript/JavaScript del proyecto,
 * extrae exportaciones, importaciones y relaciones arquitectónicas sin gastar tokens,
 * y genera un mapa compacto en .agents/memory/CODEBASE_GRAPH.md.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const OUTPUT_DIR = path.join(ROOT_DIR, '.agents', 'memory');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'CODEBASE_GRAPH.md');

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function analyzeFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  const imports = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const exports = [];
  const exportRegex = /export\s+(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  return { relPath, lines, imports, exports };
}

function buildGraph() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = [path.join(ROOT_DIR, 'App.tsx'), ...scanDirectory(SRC_DIR)].filter((f) =>
    fs.existsSync(f)
  );

  const nodes = files.map(analyzeFile);

  let md = `# 🕸️ Graphify — Mapa Estructural Determinista del Código\n\n`;
  md += `> Generado automáticamente en 0 tokens. Úsalo para conocer todas las conexiones, símbolos exportados y dependencias sin escanear archivos completos.\n\n`;
  md += `| Archivo | Líneas | Símbolos Exportados | Dependencias Clave |\n`;
  md += `| :--- | :---: | :--- | :--- |\n`;

  for (const n of nodes) {
    const expStr = n.exports.slice(0, 6).join(', ') || 'default';
    const impStr = n.imports.filter((i) => i.startsWith('.') || i.startsWith('@/')).join(', ') || 'ninguna interna';
    md += `| \`${n.relPath}\` | ${n.lines} | \`${expStr}\` | \`${impStr}\` |\n`;
  }

  fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
  console.log(`✅ [Graphify] Grafo de código actualizado en: ${OUTPUT_FILE} (${nodes.length} módulos indexados)`);
}

if (require.main === module) {
  buildGraph();
}

module.exports = { buildGraph };
