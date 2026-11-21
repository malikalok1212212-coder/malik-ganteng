// Cek ringan tanpa dependensi: sintaks semua api/*.js, skrip inline di index.html, versi cocok, tidak ada x-forwarded-for mentah.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'); let bad = 0;
const fail = (m) => { console.error('GAGAL:', m); bad++; };
for (const f of fs.readdirSync(path.join(root, 'api')).filter((x) => x.endsWith('.js'))) {
  try { cp.execFileSync(process.execPath, ['--check', path.join(root, 'api', f)], { stdio: 'pipe' }); } catch (e) { fail('sintaks api/' + f); }
  const src = fs.readFileSync(path.join(root, 'api', f), 'utf8');
  if (f !== '_http.js' && /x-forwarded-for/i.test(src)) fail('api/' + f + ' memakai x-forwarded-for langsung (pakai clientIp dari _http.js)');
  if (/module\.exports = async \(req, res\)/.test(src) && f !== 'cleanup.js' && f !== 'status.js' && !/guard\(req, res\)/.test(src)) fail('api/' + f + ' belum memanggil guard() (cek Origin)');
}
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
  const tmp = path.join(os.tmpdir(), 'mt-inline-' + i + '.js'); fs.writeFileSync(tmp, m[1]);
  try { cp.execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); } catch (e) { fail('sintaks skrip inline #' + i + ' di index.html'); }
});
const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
if ((css.match(/{/g) || []).length !== (css.match(/}/g) || []).length) fail('kurung kurawal style.css tidak seimbang');
const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8').match(/style\.css\?v=(\d+)/), ix = html.match(/style\.css\?v=(\d+)/);
if (sw && ix && sw[1] !== ix[1]) fail('versi style.css di sw.js (' + sw[1] + ') tidak sama dengan index.html (' + ix[1] + ')');
if (bad) process.exit(1); console.log('Semua cek lolos.');
