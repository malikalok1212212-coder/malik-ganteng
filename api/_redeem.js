// Kode redeem untuk role Premium / VIP. Disimpan di Upstash Redis:
//   mt:redeem:codes  (hash)  KODE -> JSON { code, role, days, credit, max, exp, note, ts, by }
//   mt:redeem:used   (hash)  KODE -> jumlah pemakaian (angka, diubah atomik lewat Lua)
//   mt:redeem:by:KODE (set)  sub pengguna yang sudah memakai kode itu (satu pengguna = satu kali per kode)
// Kode kanonik = huruf besar + angka tanpa tanda baca ("mt-abcd-efgh" dan "MTABCDEFGH" dianggap sama).
const crypto = require('crypto');
const R = require('./_redis');

const H = 'mt:redeem:codes', U = 'mt:redeem:used', S = (c) => 'mt:redeem:by:' + c;
const DAY = 24 * 60 * 60 * 1000;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 karakter, tanpa I dan O (mudah tertukar dengan 1 dan 0)
const MAX_CODES = 3000;

const canon = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
const pretty = (c) => (/^MT[A-Z0-9]{12}$/.test(c) ? 'MT-' + c.slice(2, 6) + '-' + c.slice(6, 10) + '-' + c.slice(10) : c);
const gen = () => { let s = ''; for (let i = 0; i < 12; i++) s += ALPHA[crypto.randomInt(ALPHA.length)]; return 'MT' + s; };
const roleName = (r) => String(r || '').toUpperCase();

// Ambil jatah satu pemakaian secara atomik: cek ada, tidak kedaluwarsa, pengguna belum pernah pakai, kuota masih ada.
const CLAIM = "local raw=redis.call('HGET',KEYS[1],ARGV[1]); if not raw then return {'NOCODE'} end; local c=cjson.decode(raw); local exp=tonumber(c['exp']) or 0; if exp>0 and exp<=tonumber(ARGV[3]) then return {'EXPIRED'} end; if redis.call('SISMEMBER',KEYS[3],ARGV[2])==1 then return {'DUP'} end; local used=tonumber(redis.call('HGET',KEYS[2],ARGV[1]) or '0'); local max=tonumber(c['max']) or 1; if used>=max then return {'EMPTY'} end; redis.call('HINCRBY',KEYS[2],ARGV[1],1); redis.call('SADD',KEYS[3],ARGV[2]); return {'OK',raw}";
// Batalkan jatah yang sudah diambil (dipakai bila role gagal diterapkan).
const RELEASE = "if redis.call('SREM',KEYS[3],ARGV[2])==1 then local u=tonumber(redis.call('HGET',KEYS[2],ARGV[1]) or '0'); if u>0 then redis.call('HINCRBY',KEYS[2],ARGV[1],-1) end end; return 1";

const MSG = {
  NOCODE: 'Kode tidak ditemukan. Cek lagi penulisannya.',
  EXPIRED: 'Kode ini sudah kedaluwarsa.',
  DUP: 'Kamu sudah pernah memakai kode ini.',
  EMPTY: 'Kode ini sudah habis dipakai.'
};

async function claim(code, sub, now = Date.now()) {
  const [res] = await R.run([['EVAL', CLAIM, 3, H, U, S(code), code, String(sub), String(now)]]);
  const tag = Array.isArray(res) ? res[0] : '';
  if (tag !== 'OK') return { error: MSG[tag] || 'Kode tidak bisa dipakai.' };
  let c; try { c = JSON.parse(res[1]); } catch (e) { return { error: 'Data kode rusak. Hubungi developer.' }; }
  return { c };
}
const release = (code, sub) => R.run([['EVAL', RELEASE, 3, H, U, S(code), code, String(sub)]]);

// Terapkan kode ke data pengguna (rec diubah langsung). Mengembalikan teks alasan bila ditolak, atau null bila berhasil.
// roleActive dari _auth: true bila Premium/VIP masih berlaku.
function apply(rec, c, now, roleActive) {
  const cur = roleActive(rec, now) ? rec.role : 'member';
  const ms = c.days > 0 ? c.days * DAY : 0;
  if (cur === 'vip' && c.role === 'premium') return 'Kamu sedang VIP. Kode Premium tidak bisa dipakai selama VIP masih aktif.';
  if (cur === c.role) {
    if (!rec.roleUntil) return 'Role ' + roleName(cur) + ' kamu sudah permanen, kode ini tidak perlu dipakai.';
    if (ms === 0) delete rec.roleUntil; else rec.roleUntil += ms; // role sama: masa aktif diperpanjang dari sisa waktu
    if (c.credit > 0) rec.crMax = Math.max(rec.crMax || 0, c.credit);
  } else { // member -> role baru, atau Premium -> VIP: dihitung dari sekarang
    rec.role = c.role;
    if (ms === 0) delete rec.roleUntil; else rec.roleUntil = now + ms;
    if (c.credit > 0) rec.crMax = c.credit; else delete rec.crMax;
  }
  return null;
}
const describe = (c, extended) => roleName(c.role) + (c.days > 0 ? ' ' + c.days + ' hari' : ' permanen') + (extended ? ' (masa aktif diperpanjang)' : '');

const state = (c, used, now) => (c.exp > 0 && c.exp <= now ? 'kedaluwarsa' : used >= c.max ? 'habis' : 'aktif');

async function list(now = Date.now()) {
  const [codes, used] = await R.run([['HGETALL', H], ['HGETALL', U]]);
  const u = {};
  for (let i = 0; i < (used || []).length; i += 2) u[used[i]] = parseInt(used[i + 1], 10) || 0;
  const out = [];
  for (let i = 0; i < (codes || []).length; i += 2) {
    let c; try { c = JSON.parse(codes[i + 1]); } catch (e) { continue; }
    const n = u[c.code] || 0;
    out.push({ ...c, pretty: pretty(c.code), used: n, status: state(c, n, now) });
  }
  return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// spec: { role, days, credit, max, exp, note, by }. custom = kode buatan sendiri (hanya untuk n = 1).
async function create(spec, n, custom) {
  const [len] = await R.run([['HLEN', H]]);
  if ((len || 0) + n > MAX_CODES) return { error: 'Terlalu banyak kode tersimpan (maksimal ' + MAX_CODES + '). Hapus kode lama dulu.' };
  const made = [], ts = Date.now();
  for (let round = 0; round < 4 && made.length < n; round++) {
    const want = n - made.length, batch = [];
    while (batch.length < want) { const c = custom || gen(); if (!batch.includes(c)) batch.push(c); if (custom) break; }
    const res = await R.run(batch.map((code) => ['HSETNX', H, code, JSON.stringify({ code, ...spec, ts })]));
    batch.forEach((code, i) => { if (res[i] === 1) made.push(code); });
    if (custom && !made.length) return { error: 'Kode kustom itu sudah ada. Pakai kode lain.' };
  }
  if (made.length < n) return { error: 'Gagal membuat semua kode, coba lagi.', made };
  return { made };
}

async function remove(code) {
  const [gone] = await R.run([['HDEL', H, code], ['HDEL', U, code], ['DEL', S(code)]]);
  return gone === 1;
}
async function users(code) { const [m] = await R.run([['SMEMBERS', S(code)]]); return m || []; }
async function get(code) { const [raw] = await R.run([['HGET', H, code]]); try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

module.exports = { canon, pretty, claim, release, apply, describe, list, create, remove, users, get, roleName };
