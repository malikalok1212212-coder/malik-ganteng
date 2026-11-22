// Daftar ringkas tool (id + nama) untuk beranda disalin dari public/js/tools.js ke public/js/core.js (TOOL_IDX).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const TOOLS = path.join(root, 'public', 'js', 'tools.js'), CORE = path.join(root, 'public', 'js', 'core.js');
function toolIndex() {
  const src = fs.readFileSync(TOOLS, 'utf8'), i = src.indexOf('const TOOLS_FULL=[');
  if (i < 0) throw new Error("'const TOOLS_FULL=[' tidak ditemukan di public/js/tools.js");
  const seen = new Set(), out = [];
  for (const m of src.slice(i).matchAll(/\{id:'([a-z0-9-]+)',name:'((?:[^'\\]|\\.)*)'/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push([m[1], m[2]]); }
  }
  return out;
}
const block = (idx) => 'const TOOL_IDX=[\n' + idx.map(([i, n]) => `['${i}','${n}']`).join(',\n') + '\n];\n';
const BLOCK_RE = /const TOOL_IDX=\[[\s\S]*?\n(?=const tools=TOOL_IDX)/;
function current() { const m = fs.readFileSync(CORE, 'utf8').match(BLOCK_RE); return m ? m[0] : null; }
module.exports = { toolIndex, block, BLOCK_RE, current, CORE };
