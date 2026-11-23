// Cek ringan tanpa dependensi: sintaks api/*.js, public/js/*.js dan skrip inline di index.html, daftar tool ringkas sinkron, versi cocok, tidak ada x-forwarded-for mentah.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'); let bad = 0;
const fail = (m) => { console.error('GAGAL:', m); bad++; };
for (const f of fs.readdirSync(path.join(root, 'api')).filter((x) => x.endsWith('.js'))) {
  try { cp.execFileSync(process.execPath, ['--check', path.join(root, 'api', f)], { stdio: 'pipe' }); } catch (e) { fail('sintaks api/' + f); }
  const src = fs.readFileSync(path.join(root, 'api', f), 'utf8');
  if (f !== '_http.js' && /x-forwarded-for/i.test(src)) fail('api/' + f + ' memakai x-forwarded-for langsung (pakai clientIp dari _http.js)');
  if (/module\.exports = async \(req, res\)/.test(src) && f !== 'cleanup.js' && f !== '_status.js' && !/guard\(req, res\)/.test(src)) fail('api/' + f + ' belum memanggil guard() (cek Origin)');
}
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  const tmp = path.join(os.tmpdir(), 'mt-inline-' + i + '.js'); fs.writeFileSync(tmp, m[1]);
  try { cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); } catch (e) { fail('sintaks skrip inline #' + i + ' di index.html'); }
});
for (const f of fs.readdirSync(path.join(root, 'public', 'js')).filter((x) => x.endsWith('.js'))) {
  try { cp.execFileSync(process.execPath, ['--check', path.join(root, 'public', 'js', f)], { stdio: 'pipe' }); } catch (e) { fail('sintaks public/js/' + f); }
}
{
  const { toolIndex, block, current } = require('./_idx');
  try { if (current() !== block(toolIndex())) fail('TOOL_IDX di public/js/core.js tidak sama dengan tools.js (jalankan: npm run sync)'); } catch (e) { fail(e.message); }
}
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) fail('kurung kurawal style.css tidak seimbang');
const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8').match(/style\.css\?v=(\d+)/), ix = html.match(/style\.css\?v=(\d+)/);
if (sw && ix && sw[1] !== ix[1]) fail('versi style.css di sw.js (' + sw[1] + ') tidak sama dengan index.html (' + ix[1] + ')');
const swJs = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
for (const n of ['core', 'ui']) {
  const a = swJs.match(new RegExp('/js/' + n + '\\.js\\?v=(\\d+)')), b = html.match(new RegExp('/js/' + n + '\\.js\\?v=(\\d+)'));
  if (!b) fail('index.html tidak memuat /js/' + n + '.js?v=');
  else if (!a || a[1] !== b[1]) fail('versi ' + n + '.js di sw.js tidak sama dengan index.html');
}
{ // service worker: modul lazy dan berkas shell yang di-precache harus ada dan versinya sama dengan core.js
  const ver = (html.match(/\/js\/core\.js\?v=(\d+)/) || [])[1];
  for (const n of ['tools', 'pages', 'chat']) {
    const m = swJs.match(new RegExp('/js/' + n + '\\.js\\?v=(\\d+)'));
    if (!m) fail('sw.js tidak me-precache /js/' + n + '.js (mode offline)'); else if (m[1] !== ver) fail('versi ' + n + '.js di sw.js (' + m[1] + ') tidak sama dengan core.js (' + ver + ')');
  }
  for (const f of ['offline.html', 'sw.js', 'manifest.webmanifest']) if (!fs.existsSync(path.join(root, 'public', f))) fail('public/' + f + ' tidak ada');
  if (!/addEventListener\('push'/.test(swJs)) fail('sw.js tidak punya handler push');
}
if (bad) process.exit(1); console.log('Semua cek lolos.');
