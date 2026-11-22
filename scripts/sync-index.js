// Jalankan setiap menambah, mengganti nama, atau menghapus tool di public/js/tools.js:  npm run sync
const fs = require('fs'), { toolIndex, block, BLOCK_RE, CORE } = require('./_idx');
const idx = toolIndex(), src = fs.readFileSync(CORE, 'utf8');
if (!BLOCK_RE.test(src)) { console.error('Blok TOOL_IDX tidak ditemukan di public/js/core.js'); process.exit(1); }
const next = src.replace(BLOCK_RE, () => block(idx));
if (next === src) console.log('Daftar tool sudah sinkron (' + idx.length + ' tool).');
else { fs.writeFileSync(CORE, next); console.log('core.js diperbarui: ' + idx.length + ' tool.'); }
