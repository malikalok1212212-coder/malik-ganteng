// State owner / akun / chat disimpan di Upstash Redis, satu entri per field hash (user, tool, pesan), bukan satu file JSON.
// Antarmuka tetap load(k) / save(state, k): save hanya menulis entri yang berubah sejak load, jadi dua permintaan
// yang mengubah orang berbeda tidak lagi saling menimpa. Perubahan yang harus atomik (kredit) pakai mutateUser().
// Data lama di Vercel Blob diimpor otomatis sekali (HSETNX, tidak menimpa data yang sudah ada di Redis).
const crypto = require('crypto');
const R = require('./_redis');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { /* opsional */ }

const SPEC = { state: { maps: ['users', 'tools'], vals: ['announce'] }, acc: { maps: ['users', 'pending'], vals: [] }, chat: { maps: ['msgs'], vals: [], list: true } };
const key = (k, n) => 'mt:' + k + ':' + n;
const ready = () => R.configured();
const snaps = new WeakMap();
const inited = {}; // ensureInit cukup sekali per instance (hemat perintah Redis)
const dict = () => Object.create(null); // peta berkunci input pengguna: tanpa prototipe, jadi "__proto__" hanyalah kunci biasa

// ---- impor data lama dari Blob (satu kali) ----
const bname = (k) => 'admin/' + crypto.createHmac('sha256', process.env.SESSION_SECRET || 'x').update('mt-' + k).digest('hex').slice(0, 40) + '.json';
async function legacy(k) {
  if (!(blob && process.env.BLOB_READ_WRITE_TOKEN && process.env.SESSION_SECRET)) return null;
  let h;
  try { h = await blob.head(bname(k)); }
  catch (e) { if (e && (e.name === 'BlobNotFoundError' || /does not exist|not found/i.test(String(e.message)))) return null; throw e; }
  const r = await fetch(h.url + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('baca data lama gagal');
  return r.json();
}
async function ensureInit(k) {
  if (inited[k]) return;
  const [done] = await R.run([['EXISTS', key(k, 'init')]]);
  if (done === 1) { inited[k] = true; return; }
  const old = await legacy(k); // error jaringan dilempar: jangan tandai selesai, supaya data lama tidak hilang
  const sp = SPEC[k], cmds = [];
  if (old) {
    for (const n of sp.maps) {
      const src = sp.list ? Object.fromEntries((Array.isArray(old[n]) ? old[n] : []).map((m) => [m.id, m])) : (old[n] || {});
      for (const f of Object.keys(src)) cmds.push(['HSETNX', key(k, n), f, JSON.stringify(src[f])]);
    }
    for (const n of sp.vals) if (old[n] != null) cmds.push(['SETNX', key(k, n), JSON.stringify(old[n])]);
  }
  cmds.push(['SET', key(k, 'init'), '1']);
  for (let i = 0; i < cmds.length; i += 200) await R.run(cmds.slice(i, i + 200));
  inited[k] = true;
}

// Ambil beberapa pengguna saja (HMGET), tanpa memuat seluruh state. Hasil: { sub: rec }.
async function getUsers(subs) {
  const list = [...new Set((subs || []).filter(Boolean))];
  if (!list.length || !ready()) return {};
  await ensureInit('state');
  const [arr] = await R.run([['HMGET', key('state', 'users'), ...list]]);
  const out = dict();
  list.forEach((sub, i) => { try { if (arr && arr[i]) out[sub] = JSON.parse(arr[i]); } catch (e) { /* lewati */ } });
  return out;
}

// Satu pengguna. ttl > 0 (ms) memakai cache memori per instance, untuk jalur yang sering dipanggil (polling chat).
const ucache = new Map();
async function getUser(sub, ttl = 0) {
  if (!sub) return null;
  const hit = ttl > 0 && ucache.get(sub);
  if (hit && Date.now() - hit.t < ttl) return hit.rec;
  const rec = (await getUsers([sub]))[sub] || null;
  if (ttl > 0) { if (ucache.size > 500) ucache.clear(); ucache.set(sub, { t: Date.now(), rec }); }
  return rec;
}
// true bila akun diblokir. Error Redis dianggap tidak diblokir (sama seperti perilaku lama), supaya gangguan Redis tidak mengunci semua orang.
async function isBanned(sub, ttl = 0) { try { const u = await getUser(sub, ttl); return !!(u && u.banned); } catch (e) { return false; } }

// Tool kustom saja (tanpa memuat daftar pengguna). getTools() untuk daftar publik, getTool(id) untuk satu tool.
async function getTools() {
  if (!ready()) return null;
  await ensureInit('state');
  const [flat, ann] = await R.run([['HGETALL', key('state', 'tools')], ['GET', key('state', 'announce')]]);
  const tools = dict();
  for (let j = 0; j < (flat || []).length; j += 2) { try { tools[flat[j]] = JSON.parse(flat[j + 1]); } catch (e) { /* lewati */ } }
  let announce = null; try { announce = ann ? JSON.parse(ann) : null; } catch (e) { /* lewati */ }
  return { tools, announce };
}
async function getTool(id) {
  if (!id || !ready()) return null;
  await ensureInit('state');
  const [raw] = await R.run([['HGET', key('state', 'tools'), String(id)]]);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

// ---- baca ----
async function load(k = 'state') {
  if (!ready()) return null;
  const sp = SPEC[k];
  await ensureInit(k);
  const res = await R.run([...sp.maps.map((n) => ['HGETALL', key(k, n)]), ...sp.vals.map((n) => ['GET', key(k, n)])]);
  const maps = {}, vals = {}, snap = { maps: {}, vals: {} }; // kunci di sini nama internal tetap, bukan input pengguna
  sp.maps.forEach((n, i) => {
    const flat = res[i] || [], m = dict(), s = dict();
    for (let j = 0; j < flat.length; j += 2) { s[flat[j]] = flat[j + 1]; try { m[flat[j]] = JSON.parse(flat[j + 1]); } catch (e) { /* lewati entri rusak */ } }
    maps[n] = m; snap.maps[n] = s;
  });
  sp.vals.forEach((n, i) => { const v = res[sp.maps.length + i]; snap.vals[n] = v == null ? null : v; vals[n] = v == null ? null : JSON.parse(v); });
  const st = k === 'chat'
    ? { msgs: Object.values(maps.msgs).sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1)) }
    : k === 'acc' ? { users: maps.users, pending: maps.pending } : { users: maps.users, tools: maps.tools, announce: vals.announce };
  snaps.set(st, snap);
  return st;
}

// ---- tulis (hanya yang berubah) ----
async function save(state, k = 'state') {
  if (!ready()) throw new Error('Upstash Redis belum terhubung.');
  const sp = SPEC[k], snap = snaps.get(state) || { maps: {}, vals: {} }, next = { maps: {}, vals: {} }, cmds = [];
  for (const n of sp.maps) {
    const cur = sp.list ? Object.fromEntries((state[n] || []).map((m) => [m.id, m])) : (state[n] || dict());
    const old = snap.maps[n] || dict(), s = dict(), sets = [];
    for (const f of Object.keys(cur)) { const j = JSON.stringify(cur[f]); if (j === undefined) continue; s[f] = j; if (old[f] !== j) sets.push(f, j); }
    const dels = Object.keys(old).filter((f) => !(f in s));
    for (let i = 0; i < sets.length; i += 200) cmds.push(['HSET', key(k, n), ...sets.slice(i, i + 200)]);
    for (let i = 0; i < dels.length; i += 200) cmds.push(['HDEL', key(k, n), ...dels.slice(i, i + 200)]);
    next.maps[n] = s;
  }
  for (const n of sp.vals) {
    const j = state[n] == null ? null : JSON.stringify(state[n]);
    if (j !== (snap.vals[n] == null ? null : snap.vals[n])) cmds.push(j === null ? ['DEL', key(k, n)] : ['SET', key(k, n), j]);
    next.vals[n] = j;
  }
  try { if (cmds.length) await R.run(cmds); }
  catch (e) { console.error('[store.save]', e && e.message); throw e; }
  snaps.set(state, next);
}

// ---- ubah satu pengguna secara atomik (compare-and-set, ulang bila bentrok) ----
const CAS = "local c=redis.call('HGET',KEYS[1],ARGV[1]); if (c or '')==ARGV[2] then redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); return 1 end; return 0";
// fn(rec|null) mengubah/mengembalikan rec baru. Mengembalikan rec yang tersimpan.
async function mutateUser(sub, fn, tries = 12) {
  if (!ready()) throw new Error('Upstash Redis belum terhubung.');
  const hk = key('state', 'users');
  await ensureInit('state');
  for (let i = 0; i < tries; i++) {
    const [raw] = await R.run([['HGET', hk, sub]]);
    const rec = fn(raw ? JSON.parse(raw) : null);
    if (rec == null) return null; // fn memilih tidak menulis (mis. pengguna belum ada)
    const [ok] = await R.run([['EVAL', CAS, 1, hk, sub, raw || '', JSON.stringify(rec)]]);
    if (ok === 1) return rec;
    await new Promise((r) => setTimeout(r, Math.random() * 30 * (i + 1))); // jeda acak agar permintaan yang bentrok tidak berebut bersamaan
  }
  throw new Error('bentrok saat menyimpan, coba lagi');
}

module.exports = { load, save, ready, mutateUser, getUsers, getUser, isBanned, getTools, getTool };
