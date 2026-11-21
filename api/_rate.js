// Pembatas laju terpusat di Redis (berlaku lintas instance serverless). Bila Redis belum diatur / error, jatuh ke memori.
const R = require('./_redis');
const mem = new Map(); // fallback bila Redis mati: nama+id -> { t, exp }
function sweep(now) { if (mem.size < 500) return; for (const [k, v] of mem) if (v.exp < now) mem.delete(k); } // entri kedaluwarsa dibuang agar memori tidak membengkak

// true = kena batas. Jendela tetap: maksimal `max` permintaan per `sec` detik untuk id tertentu.
async function limited(name, id, max, sec) {
  const now = Date.now();
  if (R.configured()) {
    try {
      const k = 'mt:rl:' + name + ':' + id + ':' + Math.floor(now / (sec * 1000));
      const [n] = await R.run([['INCR', k], ['EXPIRE', k, sec + 5]]);
      return n > max;
    } catch (e) { console.error('[rate]', e && e.message); }
  }
  sweep(now);
  const e = mem.get(name + id), list = ((e && e.t) || []).filter((t) => now - t < sec * 1000);
  list.push(now); mem.set(name + id, { t: list, exp: now + sec * 1000 });
  return list.length > max;
}

// true = masih dalam masa jeda (tolak). Bila lolos, jeda `ms` mulai dihitung.
async function cooling(name, id, ms) {
  const now = Date.now();
  if (R.configured()) {
    try { const [ok] = await R.run([['SET', 'mt:cd:' + name + ':' + id, '1', 'NX', 'PX', ms]]); return ok !== 'OK'; }
    catch (e) { console.error('[rate]', e && e.message); }
  }
  sweep(now);
  const k = 'cd:' + name + id, e = mem.get(k);
  if (e && now - e.t < ms) return true;
  mem.set(k, { t: now, exp: now + ms }); return false;
}
// Hitung percobaan secara atomik (INCR) dan kembalikan angka terbarunya. Dipakai untuk batas salah kode / salah sandi,
// supaya permintaan paralel tidak bisa melewati batas. ttlSec dipasang hanya saat kunci baru dibuat.
// Bila Redis error, dilempar: pemanggil harus menolak (gagal tertutup), bukan melonggarkan batas.
async function hit(name, id, ttlSec) {
  const k = 'mt:try:' + name + ':' + id;
  const [n] = await R.run([['INCR', k], ['EXPIRE', k, ttlSec, 'NX']]);
  return Number(n);
}
async function peek(name, id) { const [n] = await R.run([['GET', 'mt:try:' + name + ':' + id]]); return Number(n) || 0; }
async function clear(name, id) { await R.run([['DEL', 'mt:try:' + name + ':' + id]]); }
module.exports = { limited, cooling, hit, peek, clear };
