const { guard, clientIp } = require('./_http');
const cfg = require('./_config');
const { getUser, isOwner, ROLES, ASSIGN_ROLES, BADGE_COLORS, badgeOf, roleOf, roleUntilOf } = require('./_auth');
const R = require('./_redis');
const store = require('./_store');
const errlog = require('./_err');
const rate = require('./_rate');
const credits = require('./_credits');
const stats = require('./_stats');
const alog = require('./_log');
const redeem = require('./_redeem');
const bc = require('./_bc');
const rmsg = require('./_redeem_msg');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { /* opsional */ }

// Poster pengumuman: gambar data-URI dari browser (sudah dikecilkan) disimpan di Vercel Blob folder poster/
function sniff(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length > 12 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
async function dropPoster(url) { // hanya file poster/ di host Blob, best effort
  try {
    const u = new URL(url);
    if (blob && process.env.BLOB_READ_WRITE_TOKEN && u.protocol === 'https:' && /\.public\.blob\.vercel-storage\.com$/.test(u.hostname) && /^\/poster\//.test(u.pathname)) await blob.del(url);
  } catch (e) { /* abaikan */ }
}

async function dropBc(url) { // gambar broadcast sementara di Blob folder bc/ (best effort)
  try {
    const u = new URL(url);
    if (blob && process.env.BLOB_READ_WRITE_TOKEN && u.protocol === 'https:' && /\.public\.blob\.vercel-storage\.com$/.test(u.hostname) && /^\/bc\//.test(u.pathname)) await blob.del(url);
  } catch (e) { /* abaikan */ }
}

// Simpan gambar broadcast (data URI dari browser) sementara di Vercel Blob folder bc/. Mengembalikan { url } atau { code, error }.
async function putBcImage(dataUri) {
  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) return { code: 500, error: 'Gambar butuh Vercel Blob (Storage) yang sudah terhubung.' };
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUri || ''));
  if (!m) return { code: 415, error: 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 2.5 * 1024 * 1024) return { code: 413, error: 'Gambar terlalu besar (maksimal sekitar 2,5 MB).' };
  const type = sniff(buf);
  if (!type) return { code: 415, error: 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.' };
  return { url: (await blob.put('bc/bc.' + type.ext, buf, { access: 'public', addRandomSuffix: true, contentType: type.mime })).url };
}

// Umumkan satu kode redeem ke Saluran / semua grup lewat bot (teks + gambar poster opsional).
// Tidak melempar: hasilnya { ok, id, total, channel } atau { ok:false, error }. Kegagalan di sini tidak boleh membatalkan kode.
async function announceCode(me, spec, code, an, img) {
  const pretty = redeem.pretty(code);
  const ch = !!(an && an.channel === true), gr = !!(an && an.groups === true);
  if (!ch && !gr) return { ok: false, error: 'Pilih Saluran dan/atau Semua grup.' };
  let image = '';
  if (img) {
    const up = await putBcImage(img);
    if (up.error) return { ok: false, error: up.error };
    image = up.url;
  }
  const style = rmsg.STYLE_IDS.includes(an.style) ? an.style : 'rapi';
  const text = rmsg.build(spec, pretty, style, clip(an.text, 2000));
  const dsec = Math.floor(Number(an.delay));
  const delayMs = Number.isFinite(dsec) && dsec > 0 ? Math.min(60, Math.max(3, dsec)) * 1000 : 0;
  const key = 'code:' + code + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 6);
  const r = await bc.send({ text, image, channel: ch, mode: gr ? 'all' : 'none', pick: [], exclude: [], delayMs }, key);
  if (!r.ok) { if (image) await dropBc(image); return { ok: false, error: r.error }; }
  const d = r.data || {};
  await alog.add({ by: me.email, act: 'broadcast', detail: 'Kode ' + pretty + ' diumumkan' + (image ? ' + poster' : '') + ' · ' + [ch ? 'saluran' : '', gr ? 'semua grup (' + (d.total || 0) + ')' : ''].filter(Boolean).join(' + ') });
  return { ok: true, id: d.id || '', total: d.total || 0, channel: !!d.channel };
}

// Harga tool yang diatur developer: { idTool: jumlahKoin }. 0 = gratis. Tool tanpa entri memakai harga bawaan.
function pricesOf(m) {
  const out = {};
  for (const id of Object.keys(m || {})) {
    if (!Object.prototype.hasOwnProperty.call(cfg.tools, id)) continue;
    const n = parseInt(m[id] && m[id].credit, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 99) out[id] = n;
  }
  return out;
}

// Paket koin yang dijual: lihat _plans.js (dipakai bersama pay.js).
const { DEFAULT_PLANS, MAX_PLANS, cleanPlans, plansOf } = require('./_plans');

// Tool yang dinonaktifkan sementara oleh developer: daftar id tool server. Disimpan di data tool dengan kunci khusus __off.
const offOf = (m) => { const e = m && m.__off; return e && Array.isArray(e.list) ? e.list.filter((id) => Object.prototype.hasOwnProperty.call(cfg.tools, id)) : []; };

// Pengumuman terjadwal: from (mulai tampil), until (kedaluwarsa otomatis), roles (kosong = semua). Developer selalu melihatnya.
function annVisible(a, role, now = Date.now()) {
  if (!a) return null;
  if (a.from && a.from > now) return null;
  if (a.until && a.until <= now) return null;
  if (Array.isArray(a.roles) && a.roles.length && role !== 'developer' && !a.roles.includes(role)) return null;
  return a;
}
const annState = (a, now = Date.now()) => (!a ? '' : a.from && a.from > now ? 'terjadwal' : a.until && a.until <= now ? 'berakhir' : 'aktif');

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });
  const action = String((req.query && req.query.action) || '');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const me = getUser(req);

  try {
    // Publik: pengumuman aktif
    if (action === 'tools' && req.method === 'GET') {
      const ip = clientIp(req);
      if (await rate.limited('tools', ip, 60, 60)) return fail(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
      const st = await store.getTools(); // hanya pengumuman dan harga tool, tanpa memuat daftar pengguna
      let ann = st ? st.announce : null;
      if (ann && Array.isArray(ann.roles) && ann.roles.length) { // pengumuman khusus role: cek role pembaca
        let role = 'member';
        if (me) { try { role = roleOf(me.email, await store.getUser(me.sub)); } catch (e) { /* anggap member */ } } else role = '';
        ann = annVisible(ann, role);
      } else ann = annVisible(ann, 'member');
      return res.status(200).json({ ok: true, tools: [], prices: pricesOf(st && st.tools), plans: plansOf(st && st.tools), off: offOf(st && st.tools), announce: ann, pay: !!process.env.MELDAPAY_APIKEY });
    }

    // Pengguna: tandai peringatan sudah dibaca
    if (action === 'ack' && req.method === 'POST') {
      if (!me) return fail(403, 'Belum masuk.');
      if (store.ready()) await store.mutateUser(me.sub, (r) => { if (!r || !r.warning) return null; delete r.warning; return r; }); // satu pengguna, tanpa memuat semua
      return res.status(200).json({ ok: true });
    }

    // Selanjutnya khusus developer
    if (!me || !isOwner(me.email)) return fail(403, 'Khusus developer.');
    // Kode redeem (Premium / VIP): buat, lihat, hapus. Tidak perlu memuat seluruh daftar pengguna.
    if (['codes', 'codeinfo', 'codegen', 'codedel', 'codepreview', 'codeannounce'].includes(action)) {
      if (!store.ready()) return fail(500, 'Upstash Redis belum diatur, kode redeem belum bisa disimpan.');
      if (action === 'codes' && req.method === 'GET') return res.status(200).json({ ok: true, now: Date.now(), codes: await redeem.list() });
      if (action === 'codeinfo' && req.method === 'GET') {
        const subs = await redeem.users(redeem.canon(req.query && req.query.code));
        const us = subs.length ? await store.getUsers(subs) : {};
        return res.status(200).json({ ok: true, users: subs.map((sub) => ({ sub, name: us[sub] && (us[sub].dname || us[sub].name), email: us[sub] && us[sub].email })) });
      }
      if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');
      if (action === 'codepreview') { // pratinjau teks pengumuman tanpa membuat kode
        const style = rmsg.STYLE_IDS.includes(body.style) ? body.style : 'rapi';
        const spec = { role: ['premium', 'vip'].includes(body.role) ? body.role : '', days: Math.max(0, Math.floor(Number(body.days)) || 0), coins: Math.max(0, Math.floor(Number(body.coins)) || 0), max: Math.max(1, Math.floor(Number(body.max)) || 1), exp: Math.floor(Number(body.exp)) || 0, note: clip(body.note, 60) };
        const shown = body.custom ? redeem.pretty(redeem.canon(body.custom)) : 'MT-ABCD-EFGH-JKLM';
        return res.status(200).json({ ok: true, text: rmsg.build(spec, shown, style, clip(body.text, 2000)) });
      }
      if (action === 'codeannounce') { // umumkan kode yang sudah dibuat, dengan gambar poster (dibuat di browser setelah kode jadi)
        const code = redeem.canon(body.code), c = code ? await redeem.get(code) : null;
        if (!c) return fail(404, 'Kode tidak ditemukan.');
        if (await rate.limited('bcsend', me.sub || me.email, 5, 60)) return fail(429, 'Terlalu cepat. Tunggu sebentar sebelum kirim lagi.');
        const an = body.announce && typeof body.announce === 'object' ? body.announce : {};
        const announce = await announceCode(me, c, code, an, typeof an.img === 'string' ? an.img : '');
        return res.status(200).json({ ok: true, announce });
      }
      if (action === 'codegen') {
        const role = ['premium', 'vip'].includes(body.role) ? body.role : '', coins = Math.floor(Number(body.coins) || 0), days = role ? Math.floor(Number(body.days) || 0) : 0, max = Math.floor(Number(body.max) || 1), n = Math.floor(Number(body.count) || 1);
        if (body.role && !role) return fail(400, 'Role kode harus Premium, VIP, atau kosong (hanya koin).');
        if (!(coins >= 0 && coins <= 100000)) return fail(400, 'Koin per kode harus 0 sampai 100.000.');
        if (!coins && !role) return fail(400, 'Isi jumlah koin, atau pilih role.');
        if (!(days >= 0 && days <= 3650)) return fail(400, 'Masa aktif harus 0 (permanen) sampai 3650 hari.');
        if (!(max >= 1 && max <= 10000)) return fail(400, 'Batas pemakaian harus 1 sampai 10000.');
        if (!(n >= 1 && n <= 50)) return fail(400, 'Jumlah kode harus 1 sampai 50.');
        const exp = Math.floor(Number(body.exp)) || 0;
        if (exp && !(exp > Date.now() && exp < 4e12)) return fail(400, 'Waktu kedaluwarsa harus di masa depan.');
        const custom = body.custom ? redeem.canon(body.custom) : '';
        if (custom && (n !== 1 || custom.length < 4 || custom.length > 24)) return fail(400, 'Kode kustom hanya untuk 1 kode, 4 sampai 24 huruf atau angka.');
        const spec = { coins, role, days, max, exp, note: clip(body.note, 60), by: me.email };
        // Umumkan otomatis ke Saluran / grup WhatsApp (opsional). Divalidasi sebelum kode dibuat; kegagalan kirim tidak membatalkan kode.
        const an = body.announce && typeof body.announce === 'object' ? body.announce : null;
        const anCh = !!(an && an.channel === true), anGr = !!(an && an.groups === true);
        const want = !!(an && (anCh || anGr));
        if (want && n !== 1) return fail(400, 'Umumkan otomatis hanya untuk 1 kode. Ubah jumlah kode jadi 1.');
        if (want && await rate.limited('bcsend', me.sub || me.email, 5, 60)) return fail(429, 'Terlalu cepat. Tunggu sebentar sebelum membuat kode yang diumumkan lagi.');
        const out = await redeem.create(spec, n, custom);
        if (out.error) return fail(out.made && out.made.length ? 500 : 400, out.error);
        await alog.add({ by: me.email, act: 'code-gen', detail: out.made.length + ' kode ' + role.toUpperCase() + ' ' + (days ? days + ' hari' : 'permanen') + ', ' + max + 'x pakai' + (spec.note ? ' (' + spec.note + ')' : '') });
        const announce = want ? await announceCode(me, spec, out.made[0], an, '') : null;
        return res.status(200).json({ ok: true, codes: out.made.map(redeem.pretty), announce });
      }
      if (action === 'codedel') {
        const code = redeem.canon(body.code);
        const c = code ? await redeem.get(code) : null;
        if (!c) return fail(404, 'Kode tidak ditemukan.');
        await redeem.remove(code);
        await alog.add({ by: me.email, act: 'code-del', detail: redeem.pretty(code) + ' (' + redeem.roleName(c.role) + ') dihapus' });
        return res.status(200).json({ ok: true });
      }
    }

    // Real-time untuk panel developer: pengunjung online, kunjungan hari ini, tool yang sedang dibuka, dan pengguna login yang sedang online.
    // ?lite=1 (dipakai polling tiap beberapa detik) melewatkan statistik 7 hari supaya ringan. Tanpa memuat seluruh daftar pengguna.
    if (action === 'live' && req.method === 'GET') {
      if (!R.configured()) return fail(500, 'Upstash Redis belum diatur.');
      try {
        const now = Date.now(), WIN = 100000, day = new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
        const ZK = 'mt:pres:site', HK = 'mt:pres:tool', SK = 'mt:pres:sub', FK = 'mt:pres:feed', PK = 'mt:pres:peak';
        const lite = String((req.query && req.query.lite) || '') === '1';
        const [online, flat, uv, opens, peak, feedRaw] = await R.run([
          ['ZCOUNT', ZK, now - WIN, '+inf'], ['ZRANGEBYSCORE', ZK, now - WIN, '+inf', 'WITHSCORES', 'LIMIT', 0, 300],
          ['PFCOUNT', 'mt:pres:uv:' + day], ['GET', 'mt:pres:op:' + day], ['ZSCORE', PK, day], ['LRANGE', FK, 0, 9]
        ]);
        const ids = [], seen = {};
        for (let i = 0; i + 1 < (flat || []).length; i += 2) { ids.push(flat[i]); seen[flat[i]] = Number(flat[i + 1]) || now; }
        let tools = [], members = [];
        if (ids.length) {
          const [hs, ss] = await R.run([['HMGET', HK, ...ids], ['HMGET', SK, ...ids]]);
          const cnt = {}, subs = {};
          (hs || []).forEach((t) => { if (t && /^[a-z0-9-]{1,40}$/.test(t)) cnt[t] = (cnt[t] || 0) + 1; });
          tools = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6);
          ids.forEach((id, i) => { const sub = ss && ss[i]; if (!sub) return; // satu akun bisa punya banyak tab: ambil denyut terbaru dan tool-nya
            const t = hs && hs[i] && /^[a-z0-9-]{1,40}$/.test(hs[i]) ? hs[i] : '', at = seen[id];
            if (!subs[sub] || at > subs[sub].at) subs[sub] = { at, tool: t || (subs[sub] && subs[sub].tool) || '', tabs: (subs[sub] ? subs[sub].tabs : 0) + 1 }; else subs[sub].tabs++; });
          const recs = await store.getUsers(Object.keys(subs));
          members = Object.keys(subs).map((sub) => {
            const rec = recs[sub] || {}, email = rec.email || '', pic = typeof rec.dpic === 'string' && rec.dpic ? rec.dpic : (rec.picture || '');
            return { sub, name: String(rec.dname || rec.name || email.split('@')[0] || 'Pengguna').slice(0, 40), role: roleOf(email, rec), pic: /^https:\/\/[^\s"'<>]{1,300}$/.test(pic) ? pic : '', tool: subs[sub].tool, tabs: subs[sub].tabs, ago: Math.max(0, Math.round((now - subs[sub].at) / 1000)) };
          }).sort((a, b) => a.ago - b.ago).slice(0, 40);
        }
        const feed = (feedRaw || []).map((x) => String(x).split('|')).map((x) => [x[0], Math.max(0, Math.round((now - Number(x[1])) / 1000)), Number(x[1]) || 0]).filter((x) => /^[a-z0-9-]{1,40}$/.test(x[0]) && x[1] < 900).slice(0, 8); // [tool, detik lalu, waktu mentah]
        const on = Number(online) || 0, out = { ok: true, now, dayStart: stats.dayStart(now), online: on, members, guests: Math.max(0, on - members.length), uv: Math.max(Number(uv) || 0, on), opens: Number(opens) || 0, peak: Math.max(Number(peak) || 0, on), tools, feed };
        if (!lite) { const sm = await stats.summary(7); out.days = sm.days; out.last = sm.last; }
        return res.status(200).json(out);
      } catch (e) { return fail(500, 'Data real-time belum bisa dibaca.'); }
    }

    const st = await store.load();
    if (!st) return fail(500, 'Upstash Redis belum diatur, data developer belum bisa disimpan.');

    if (action === 'overview' && req.method === 'GET') {
      const now = Date.now();
      const users = Object.entries(st.users).map(([sub, u]) => {
        const role = roleOf(u.email, u), o = { sub, ...u, owner: isOwner(u.email), role, roleUntil: roleUntilOf(u.email, u) };
        if (!o.owner && ['premium', 'vip'].includes(u.role) && u.roleUntil && u.roleUntil <= now) o.lapsed = { role: u.role, at: u.roleUntil }; // role sudah habis (otomatis jadi member)
        o.credit = credits.info(u, role);
        delete o.cr; delete o.crBonus; delete o.crMax; delete o.coin; delete o.fd; delete o.fr; delete o.picture; delete o.dpic; // hemat ukuran; saldo koin sudah ada di o.credit
        return o;
      }).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
      return res.status(200).json({ ok: true, store: true, now, dayStart: stats.dayStart(now), users, tools: [], prices: pricesOf(st.tools), plans: plansOf(st.tools), off: offOf(st.tools), announce: st.announce, annState: annState(st.announce, now) });
    }
    if (action === 'stats' && req.method === 'GET') { // statistik global 7 hari
      try { return res.status(200).json({ ok: true, now: Date.now(), dayStart: stats.dayStart(), ...(await stats.summary(7)) }); }
      catch (e) { return fail(500, 'Statistik belum bisa dibaca. Pastikan Upstash Redis aktif.'); }
    }
    if (action === 'reports' && req.method === 'GET') { // laporan pesan Global Chat dari pengguna
      try {
        const [flat] = await R.run([['HGETALL', 'mt:chat:reports']]);
        const list = []; for (let j = 0; j < (flat || []).length; j += 2) { try { list.push(JSON.parse(flat[j + 1])); } catch (e) { /* lewati */ } }
        return res.status(200).json({ ok: true, reports: list.sort((x, y) => y.ts - x.ts).slice(0, 200) });
      } catch (e) { return fail(500, 'Laporan belum bisa dibaca.'); }
    }
    if (action === 'errors' && req.method === 'GET') { // error server terakhir (provider gagal, kesalahan API)
      try { return res.status(200).json({ ok: true, errors: await errlog.list(100) }); }
      catch (e) { return fail(500, 'Catatan error belum bisa dibaca.'); }
    }
    if (action === 'log' && req.method === 'GET') { // catatan aktivitas, opsional per pengguna (?sub=)
      try { return res.status(200).json({ ok: true, log: await alog.list(String((req.query && req.query.sub) || ''), 300) }); }
      catch (e) { return fail(500, 'Catatan aktivitas belum bisa dibaca.'); }
    }
    // Broadcast ke bot WhatsApp (saluran + grup): daftar grup dan progres. Hanya developer (sudah dicek di atas).
    if (action === 'bcgroups' && req.method === 'GET') {
      const r = await bc.groups();
      if (!r.ok) return fail(r.code === 409 ? 409 : 502, r.error);
      return res.status(200).json({ ok: true, channel: r.data.channel || null, groups: Array.isArray(r.data.groups) ? r.data.groups : [] });
    }
    if (action === 'bcstatus' && req.method === 'GET') {
      const id = String((req.query && req.query.id) || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
      if (!id) return fail(400, 'ID broadcast kosong.');
      const r = await bc.status(id);
      if (!r.ok) return fail(r.code === 409 ? 409 : 502, r.error);
      return res.status(200).json({ ok: true, job: r.data.job });
    }
    if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');

    if (action === 'dismissreport') { // tutup laporan (setelah pesannya dihapus / dianggap aman); id satu laporan atau msg = semua laporan pesan itu
      const [flat] = await R.run([['HGETALL', 'mt:chat:reports']]);
      const del = []; for (let j = 0; j < (flat || []).length; j += 2) { if (flat[j] === String(body.id || '') || (body.msg && flat[j].split(':')[0] === String(body.msg))) del.push(flat[j]); }
      if (del.length) await R.run([['HDEL', 'mt:chat:reports', ...del]]);
      return res.status(200).json({ ok: true, closed: del.length });
    }
    if (action === 'clearerrors') { await errlog.clear(); return res.status(200).json({ ok: true }); }

    const logIt = (act, u, sub, detail) => alog.add({ by: me.email, act, sub, email: u && u.email, name: u && (u.dname || u.name), detail });

    if (action === 'user') {
      const u = st.users[body.sub];
      if (!u) return fail(404, 'Pengguna tidak ditemukan.');
      const op = body.op;
      if ((op === 'ban' || op === 'remove' || op === 'warn' || op === 'role' || op === 'credit') && isOwner(u.email)) return fail(400, 'Akun developer tidak bisa diubah.');
      let detail = '';
      if (op === 'credit') { // koin pengguna: tambah (kompensasi/hadiah), kurangi, atau atur saldo persis. Atomik, tidak menimpa data lain.
        const mode = body.mode, n = Math.floor(Number(body.n));
        if (!['add', 'sub', 'set'].includes(mode)) return fail(400, 'Mode koin tidak dikenal.');
        if (mode === 'set' ? !(n >= 0 && n <= 1000000) : !(n >= 1 && n <= 100000)) return fail(400, mode === 'set' ? 'Saldo koin harus 0 sampai 1.000.000.' : 'Jumlah koin harus 1 sampai 100.000.');
        let before = 0;
        const rec = await store.mutateUser(body.sub, (r) => {
          if (!r) return null;
          before = credits.balanceOf(r);
          if (mode === 'add') credits.add(r, n); else if (mode === 'sub') credits.set(r, Math.max(0, before - n)); else credits.set(r, n);
          return r;
        });
        if (!rec) return fail(404, 'Pengguna tidak ditemukan.');
        await logIt('credit', u, body.sub, (mode === 'add' ? '+' + n + ' koin' : mode === 'sub' ? '-' + n + ' koin' : 'Saldo koin diatur ke ' + n) + ' (sebelumnya ' + before + ')' + (body.note ? ' (' + clip(body.note, 80) + ')' : ''));
        return res.status(200).json({ ok: true, credit: credits.info(rec, roleOf(u.email, rec)) });
      }
      if (op === 'warn') { const t = clip(body.text, 300); if (!t) return fail(400, 'Isi peringatan dulu.'); u.warning = t; u.warnedAt = Date.now(); detail = t; }
      else if (op === 'unwarn') delete u.warning;
      else if (op === 'role') {
        if (!ASSIGN_ROLES.includes(body.role)) return fail(400, 'Role tidak dikenal.');
        const was = roleOf(u.email, u);
        if (body.role === 'member') { delete u.role; delete u.roleUntil; detail = 'Role dicabut (sebelumnya ' + was.toUpperCase() + ')'; }
        else if (body.role === 'owner') { u.role = 'owner'; delete u.roleUntil; delete u.crMax; delete u.cr; delete u.crBonus; detail = 'OWNER (permanen, koin tak terbatas)' + (was !== 'member' ? '; sebelumnya ' + was.toUpperCase() : ''); } // owner: tanpa durasi
        else {
          // days: jumlah hari masa aktif (1-3650), 0 = permanen. Tanpa days = 7 hari. Memberi ulang role = hitung dari sekarang. Role kini hanya badge (tidak memberi koin).
          const days = body.days === undefined ? 7 : Math.floor(Number(body.days));
          if (!Number.isFinite(days) || days < 0 || days > 3650) return fail(400, 'Durasi harus 0 (permanen) sampai 3650 hari.');
          u.role = body.role;
          if (days === 0) delete u.roleUntil; else u.roleUntil = Date.now() + days * 24 * 60 * 60 * 1000;
          detail = body.role.toUpperCase() + (days === 0 ? ' permanen' : ' ' + days + ' hari') + (was !== 'member' ? '; sebelumnya ' + was.toUpperCase() : '');
        }
      }
      else if (op === 'badge') { // badge kustom di samping role: teks maks. 14 karakter + warna dari daftar. Teks kosong = hapus badge.
        const t = clip(String(body.text == null ? '' : body.text).replace(/[\u0000-\u001f<>]/g, ''), 14);
        if (!t) { if (!u.badge) return fail(400, 'Pengguna ini belum punya badge kustom.'); delete u.badge; detail = 'Badge kustom dihapus'; }
        else {
          const c = String(body.color || '').toLowerCase();
          if (!BADGE_COLORS.includes(c)) return fail(400, 'Warna badge tidak dikenal.');
          u.badge = { t, c }; detail = 'Badge kustom "' + t + '" ' + c;
        }
      }
      else if (op === 'ban') u.banned = true;
      else if (op === 'unban') delete u.banned;
      else if (op === 'remove') { if (u.banned) return fail(400, 'Pengguna ini sedang diblokir. Menghapusnya akan menghilangkan blokir, jadi buka blokir dulu bila memang ingin menghapus.'); delete st.users[body.sub]; }
      else return fail(400, 'Aksi tidak dikenal.');
      await store.save(st);
      await logIt(op, u, body.sub, detail);
      if (op === 'role' || op === 'badge') await R.run([['INCR', 'mt:chat:ver']]).catch(() => {}); // chat Global Chat memuat ulang supaya badge/role baru langsung tampil
      return res.status(200).json({ ok: true });
    }

    if (action === 'toggle') { // nonaktifkan / aktifkan lagi tool sementara
      const ids = Array.isArray(body.tools) ? body.tools.map(String) : [];
      if (!ids.length || ids.length > 4 || ids.some((id) => !Object.prototype.hasOwnProperty.call(cfg.tools, id))) return fail(400, 'Tool tidak dikenal.');
      const set = new Set(offOf(st.tools));
      for (const id of ids) { if (body.off) set.add(id); else set.delete(id); }
      st.tools.__off = { id: '__off', list: [...set] };
      await store.save(st);
      await logIt(body.off ? 'tool-off' : 'tool-on', null, undefined, ids.join(', '));
      return res.status(200).json({ ok: true });
    }

    if (action === 'plans') { // simpan daftar paket koin
      if (!Array.isArray(body.plans) || body.plans.length > MAX_PLANS) return fail(400, 'Daftar paket tidak valid (maksimal ' + MAX_PLANS + ' paket).');
      const list = cleanPlans(body.plans);
      if (list.length !== body.plans.length) return fail(400, 'Ada paket yang tidak valid. Koin 1-1.000.000 dan harga 0-100.000.000.');
      st.tools.__plans = { id: '__plans', list };
      await store.save(st);
      await logIt('plans', null, undefined, list.length + ' paket disimpan');
      return res.status(200).json({ ok: true });
    }

    if (action === 'price') { // atur tool gratis atau memakai koin
      const id = String(body.tool || '');
      if (!Object.prototype.hasOwnProperty.call(cfg.tools, id)) return fail(400, 'Tool tidak dikenal.');
      const n = Math.floor(Number(body.credit));
      if (!Number.isFinite(n) || n < 0 || n > 99) return fail(400, 'Biaya harus angka 0 sampai 99 koin.');
      st.tools[id] = { id, credit: n };
      await store.save(st);
      await logIt('price', null, undefined, id + ' = ' + n + ' koin');
      return res.status(200).json({ ok: true });
    }

    if (action === 'bcsend') { // kirim broadcast ke saluran dan/atau grup lewat bot; berjalan di bot, panel memantau progresnya
      if (await rate.limited('bcsend', me.sub || me.email, 5, 60)) return fail(429, 'Terlalu cepat. Tunggu sebentar sebelum kirim lagi.');
      const text = clip(body.text, 2000);
      if (body.channel === true && body.force !== true) { // cegah teks yang pernah dianggap melanggar pedoman Saluran
        const risk = require('./_bcsafe').check(text);
        if (risk.length) return fail(422, 'Teks berisiko ditolak filter Saluran WhatsApp: ' + risk.join('; ') + '.');
      }
      const mode = ['all', 'pick', 'none'].includes(body.mode) ? body.mode : 'none';
      const wantCh = body.channel === true;
      const ids = (a) => (Array.isArray(a) ? a : []).map(String).filter((x) => /^[0-9-]{5,40}@g\.us$/.test(x)).slice(0, 600);
      const pick = ids(body.pick), exclude = ids(body.exclude);
      if (!text && !(typeof body.img === 'string' && body.img)) return fail(400, 'Isi pesan atau pilih gambar dulu.');
      if (!wantCh && mode === 'none') return fail(400, 'Pilih target: saluran dan/atau grup.');
      if (mode === 'pick' && !pick.length) return fail(400, 'Pilih minimal satu grup, atau ganti ke "Semua grup".');
      const dsec = Math.floor(Number(body.delay));
      const delayMs = Number.isFinite(dsec) && dsec > 0 ? Math.min(60, Math.max(3, dsec)) * 1000 : 0;
      let image = '';
      if (typeof body.img === 'string' && body.img) { // gambar disimpan sementara di Vercel Blob (folder bc/), bot mengambilnya dari sana
        if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) return fail(500, 'Gambar butuh Vercel Blob (Storage) yang sudah terhubung.');
        const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.img);
        if (!m) return fail(415, 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
        const buf = Buffer.from(m[1], 'base64');
        if (buf.length > 2.5 * 1024 * 1024) return fail(413, 'Gambar terlalu besar (maksimal sekitar 2,5 MB).');
        const type = sniff(buf);
        if (!type) return fail(415, 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
        image = (await blob.put('bc/bc.' + type.ext, buf, { access: 'public', addRandomSuffix: true, contentType: type.mime })).url;
      }
      const key = 'bc:' + me.sub + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
      const r = await bc.send({ text, image, channel: wantCh, mode, pick, exclude, delayMs }, key);
      if (!r.ok) { if (image) await dropBc(image); return fail(r.code === 409 ? 409 : 502, r.error); }
      const d = r.data || {};
      await logIt('broadcast', null, undefined, (text || '[gambar]').slice(0, 60) + ' · ' + [wantCh ? 'saluran' : '', mode === 'all' ? 'semua grup (' + (d.total || 0) + ')' : mode === 'pick' ? pick.length + ' grup dipilih' : ''].filter(Boolean).join(' + ') + (exclude.length ? ' · ' + exclude.length + ' dikecualikan' : ''));
      return res.status(200).json({ ok: true, id: d.id || '', total: d.total || 0, channel: !!d.channel, delayMs: d.delayMs || 0, duplicate: !!d.duplicate });
    }
    if (action === 'bcstop') {
      const id = String(body.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
      const r = await bc.stop(id);
      if (!r.ok) return fail(502, r.error);
      await logIt('broadcast-stop', null, undefined, 'Broadcast dihentikan (' + id + ')');
      return res.status(200).json({ ok: true, job: r.data.job });
    }

    if (action === 'announce') {
      const t = clip(body.text, 300), title = clip(body.title, 60);
      const link = /^https:\/\/[^\s]{4,290}$/.test(clip(body.link, 300)) ? clip(body.link, 300) : '', btn = clip(body.btn, 24) || 'Buka';
      const old = st.announce && st.announce.img || '';
      let img = body.keepImg ? old : '';
      if (typeof body.img === 'string' && body.img) {
        if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) return fail(500, 'Poster butuh Vercel Blob (Storage) yang sudah terhubung.');
        const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.img);
        if (!m) return fail(415, 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
        const buf = Buffer.from(m[1], 'base64');
        if (buf.length > 2.5 * 1024 * 1024) return fail(413, 'Gambar poster terlalu besar (maksimal sekitar 2,5 MB).');
        const type = sniff(buf);
        if (!type) return fail(415, 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
        img = (await blob.put('poster/poster.' + type.ext, buf, { access: 'public', addRandomSuffix: true, contentType: type.mime })).url;
      }
      const now = Date.now();
      const from = Math.floor(Number(body.from)) || 0, until = Math.floor(Number(body.until)) || 0;
      if (from && !(from > 1e12 && from < 4e12)) return fail(400, 'Waktu mulai tidak valid.');
      if (until && !(until > 1e12 && until < 4e12)) return fail(400, 'Waktu berakhir tidak valid.');
      if (until && until <= now) return fail(400, 'Waktu berakhir sudah lewat.');
      if (from && until && until <= from) return fail(400, 'Waktu berakhir harus setelah waktu mulai.');
      const roles = (Array.isArray(body.roles) ? body.roles : []).filter((x, i, a) => ROLES.includes(x) && a.indexOf(x) === i);
      st.announce = (t || img || title) ? { title, text: t, img, link, btn, ts: now, ...(from ? { from } : {}), ...(until ? { until } : {}), ...(roles.length && roles.length < ROLES.length ? { roles } : {}) } : null;
      await store.save(st);
      await logIt(st.announce ? 'announce' : 'announce-del', null, undefined, st.announce ? (title || t).slice(0, 60) + (from ? ' · mulai ' + new Date(from).toISOString() : '') + (until ? ' · sampai ' + new Date(until).toISOString() : '') + (roles.length && roles.length < ROLES.length ? ' · untuk ' + roles.join('/') : '') : 'Pengumuman dihapus');
      if (old && old !== img) await dropPoster(old);
      return res.status(200).json({ ok: true });
    }

    return fail(action ? 405 : 404, 'Aksi tidak dikenal.');
  } catch (e) {
    errlog.report('admin', e);
    return fail(500, 'Penyimpanan bermasalah, coba lagi.');
  }
};
