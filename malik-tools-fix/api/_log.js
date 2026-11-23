// Catatan aktivitas developer (siapa memberi role apa, memblokir siapa, kapan). Daftar di Redis, 1000 entri terakhir.
const R = require('./_redis');
const KEY = 'mt:log', MAX = 1000;

// e: { by, act, sub?, email?, name?, detail? }
async function add(e) {
  if (!R.configured()) return;
  try {
    const rec = { ts: Date.now(), by: String(e.by || '').slice(0, 80), act: String(e.act || '').slice(0, 20), sub: e.sub ? String(e.sub).slice(0, 60) : undefined, email: e.email ? String(e.email).slice(0, 80) : undefined, name: e.name ? String(e.name).slice(0, 60) : undefined, detail: e.detail ? String(e.detail).slice(0, 200) : undefined };
    await R.run([['LPUSH', KEY, JSON.stringify(rec)], ['LTRIM', KEY, 0, MAX - 1]]);
  } catch (err) { console.error('[log]', err && err.message); }
}

// Terbaru dulu. sub = hanya satu pengguna.
async function list(sub, limit = 200) {
  const [raw] = await R.run([['LRANGE', KEY, 0, MAX - 1]]);
  const out = [];
  for (const x of raw || []) {
    let o; try { o = JSON.parse(x); } catch (e) { continue; }
    if (sub && o.sub !== sub) continue;
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}
module.exports = { add, list };
