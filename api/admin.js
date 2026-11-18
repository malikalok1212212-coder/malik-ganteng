const cfg = require('./_config');
const { getUser, isOwner, ROLES, roleOf, roleUntilOf } = require('./_auth');
const store = require('./_store');
const rate = require('./_rate');
const credits = require('./_credits');
const stats = require('./_stats');
const alog = require('./_log');
const redeem = require('./_redeem');
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

// Harga tool yang diatur developer: { idTool: jumlahKredit }. 0 = gratis. Tool tanpa entri memakai harga bawaan.
function pricesOf(m) {
  const out = {};
  for (const id of Object.keys(m || {})) {
    if (!Object.prototype.hasOwnProperty.call(cfg.tools, id)) continue;
    const n = parseInt(m[id] && m[id].credit, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 99) out[id] = n;
  }
  return out;
}

// Paket role yang dijual (diatur developer): { id, role: premium|vip, days, price (Rp), credit (kredit AM Premium per hari) }.
const DEFAULT_PLANS = [{ id: 'premium-7', role: 'premium', days: 7, price: 2500, credit: 15 }, { id: 'vip-7', role: 'vip', days: 7, price: 5000, credit: 30 }];
function cleanPlans(a) {
  const out = [], seen = new Set();
  for (const p of Array.isArray(a) ? a : []) {
    if (!p || !['premium', 'vip'].includes(p.role)) continue;
    const days = Math.floor(Number(p.days)), price = Math.floor(Number(p.price)), credit = Math.floor(Number(p.credit));
    if (!(days >= 1 && days <= 3650 && price >= 0 && price <= 1e8 && credit >= 1 && credit <= 999)) continue;
    let id = String(p.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || ('p' + out.length);
    while (seen.has(id)) id += 'x';
    seen.add(id); out.push({ id, role: p.role, days, price, credit });
    if (out.length >= 12) break;
  }
  return out;
}
const plansOf = (m) => { const e = m && m.__plans; return e && Array.isArray(e.list) ? cleanPlans(e.list) : DEFAULT_PLANS; };

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
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
      if (await rate.limited('tools', ip, 60, 60)) return fail(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
      const st = await store.getTools(); // hanya pengumuman dan harga tool, tanpa memuat daftar pengguna
      let ann = st ? st.announce : null;
      if (ann && Array.isArray(ann.roles) && ann.roles.length) { // pengumuman khusus role: cek role pembaca
        let role = 'member';
        if (me) { try { role = roleOf(me.email, await store.getUser(me.sub)); } catch (e) { /* anggap member */ } } else role = '';
        ann = annVisible(ann, role);
      } else ann = annVisible(ann, 'member');
      return res.status(200).json({ ok: true, tools: [], prices: pricesOf(st && st.tools), plans: plansOf(st && st.tools), off: offOf(st && st.tools), announce: ann });
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
    if (['codes', 'codeinfo', 'codegen', 'codedel'].includes(action)) {
      if (!store.ready()) return fail(500, 'Upstash Redis belum diatur, kode redeem belum bisa disimpan.');
      if (action === 'codes' && req.method === 'GET') return res.status(200).json({ ok: true, now: Date.now(), codes: await redeem.list() });
      if (action === 'codeinfo' && req.method === 'GET') {
        const subs = await redeem.users(redeem.canon(req.query && req.query.code));
        const us = subs.length ? await store.getUsers(subs) : {};
        return res.status(200).json({ ok: true, users: subs.map((sub) => ({ sub, name: us[sub] && (us[sub].dname || us[sub].name), email: us[sub] && us[sub].email })) });
      }
      if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');
      if (action === 'codegen') {
        const role = body.role, days = Math.floor(Number(body.days)), credit = Math.floor(Number(body.credit) || 0), max = Math.floor(Number(body.max) || 1), n = Math.floor(Number(body.count) || 1);
        if (!['premium', 'vip'].includes(role)) return fail(400, 'Role kode harus Premium atau VIP.');
        if (!(days >= 0 && days <= 3650)) return fail(400, 'Masa aktif harus 0 (permanen) sampai 3650 hari.');
        if (!(credit >= 0 && credit <= 999)) return fail(400, 'Kredit per hari harus 0 (bawaan role) sampai 999.');
        if (!(max >= 1 && max <= 10000)) return fail(400, 'Batas pemakaian harus 1 sampai 10000.');
        if (!(n >= 1 && n <= 50)) return fail(400, 'Jumlah kode harus 1 sampai 50.');
        const exp = Math.floor(Number(body.exp)) || 0;
        if (exp && !(exp > Date.now() && exp < 4e12)) return fail(400, 'Waktu kedaluwarsa harus di masa depan.');
        const custom = body.custom ? redeem.canon(body.custom) : '';
        if (custom && (n !== 1 || custom.length < 4 || custom.length > 24)) return fail(400, 'Kode kustom hanya untuk 1 kode, 4 sampai 24 huruf atau angka.');
        const spec = { role, days, credit, max, exp, note: clip(body.note, 60), by: me.email };
        const out = await redeem.create(spec, n, custom);
        if (out.error) return fail(out.made && out.made.length ? 500 : 400, out.error);
        await alog.add({ by: me.email, act: 'code-gen', detail: out.made.length + ' kode ' + role.toUpperCase() + ' ' + (days ? days + ' hari' : 'permanen') + ', ' + max + 'x pakai' + (spec.note ? ' (' + spec.note + ')' : '') });
        return res.status(200).json({ ok: true, codes: out.made.map(redeem.pretty) });
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

    const st = await store.load();
    if (!st) return fail(500, 'Upstash Redis belum diatur, data developer belum bisa disimpan.');

    if (action === 'overview' && req.method === 'GET') {
      const now = Date.now();
      const users = Object.entries(st.users).map(([sub, u]) => {
        const role = roleOf(u.email, u), o = { sub, ...u, owner: isOwner(u.email), role, roleUntil: roleUntilOf(u.email, u) };
        if (!o.owner && ['premium', 'vip'].includes(u.role) && u.roleUntil && u.roleUntil <= now) o.lapsed = { role: u.role, at: u.roleUntil }; // role sudah habis (otomatis jadi member)
        o.credit = credits.info(u, role);
        delete o.cr; delete o.crBonus; delete o.picture; delete o.dpic; // hemat ukuran; info kredit sudah ada di o.credit
        return o;
      }).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
      return res.status(200).json({ ok: true, store: true, now, dayStart: stats.dayStart(now), users, tools: [], prices: pricesOf(st.tools), plans: plansOf(st.tools), off: offOf(st.tools), announce: st.announce, annState: annState(st.announce, now) });
    }
    if (action === 'stats' && req.method === 'GET') { // statistik global 7 hari
      try { return res.status(200).json({ ok: true, now: Date.now(), dayStart: stats.dayStart(), ...(await stats.summary(7)) }); }
      catch (e) { return fail(500, 'Statistik belum bisa dibaca. Pastikan Upstash Redis aktif.'); }
    }
    if (action === 'log' && req.method === 'GET') { // catatan aktivitas, opsional per pengguna (?sub=)
      try { return res.status(200).json({ ok: true, log: await alog.list(String((req.query && req.query.sub) || ''), 300) }); }
      catch (e) { return fail(500, 'Catatan aktivitas belum bisa dibaca.'); }
    }
    if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');

    const logIt = (act, u, sub, detail) => alog.add({ by: me.email, act, sub, email: u && u.email, name: u && (u.dname || u.name), detail });

    if (action === 'user') {
      const u = st.users[body.sub];
      if (!u) return fail(404, 'Pengguna tidak ditemukan.');
      const op = body.op;
      if ((op === 'ban' || op === 'remove' || op === 'warn' || op === 'role' || op === 'credit') && isOwner(u.email)) return fail(400, 'Akun developer tidak bisa diubah.');
      let detail = '';
      if (op === 'credit') { // kompensasi kredit: tambah (bonus, dipakai lebih dulu) atau reset pemakaian harian. Atomik, tidak menimpa data lain.
        const mode = body.mode, n = Math.floor(Number(body.n));
        if (mode !== 'add' && mode !== 'reset') return fail(400, 'Mode kredit tidak dikenal.');
        if (mode === 'add' && !(n >= 1 && n <= 999)) return fail(400, 'Jumlah kredit harus 1 sampai 999.');
        const rec = await store.mutateUser(body.sub, (r) => {
          if (!r) return null;
          if (mode === 'reset') delete r.cr; else r.crBonus = Math.min(9999, (r.crBonus || 0) + n);
          return r;
        });
        if (!rec) return fail(404, 'Pengguna tidak ditemukan.');
        await logIt('credit', u, body.sub, mode === 'reset' ? 'Reset pemakaian kredit harian' : '+' + n + ' kredit bonus' + (body.note ? ' (' + clip(body.note, 80) + ')' : ''));
        return res.status(200).json({ ok: true, credit: credits.info(rec, roleOf(u.email, rec)) });
      }
      if (op === 'warn') { const t = clip(body.text, 300); if (!t) return fail(400, 'Isi peringatan dulu.'); u.warning = t; u.warnedAt = Date.now(); detail = t; }
      else if (op === 'unwarn') delete u.warning;
      else if (op === 'role') {
        if (!ROLES.includes(body.role)) return fail(400, 'Role tidak dikenal.');
        const was = roleOf(u.email, u);
        if (body.role === 'member') { delete u.role; delete u.roleUntil; delete u.crMax; detail = 'Role dicabut (sebelumnya ' + was.toUpperCase() + ')'; }
        else {
          // days: jumlah hari masa aktif (1-3650), 0 = permanen. Tanpa days = 7 hari. Memberi ulang role = hitung dari sekarang.
          const plan = body.plan ? plansOf(st.tools).find((x) => x.id === body.plan && x.role === body.role) : null;
          if (body.plan && !plan) return fail(400, 'Paket tidak ditemukan. Simpan daftar paket dulu.');
          const days = plan ? plan.days : (body.days === undefined ? 7 : Math.floor(Number(body.days)));
          if (!Number.isFinite(days) || days < 0 || days > 3650) return fail(400, 'Durasi harus 0 (permanen) sampai 3650 hari.');
          u.role = body.role;
          if (plan) u.crMax = plan.credit; else delete u.crMax; // paket = jatah kredit per hari sendiri; tanpa paket = jatah bawaan role
          if (days === 0) delete u.roleUntil; else u.roleUntil = Date.now() + days * 24 * 60 * 60 * 1000;
          detail = body.role.toUpperCase() + (days === 0 ? ' permanen' : ' ' + days + ' hari') + (plan ? ', paket ' + plan.id + ' (Rp' + plan.price + ')' : '') + (was !== 'member' ? '; sebelumnya ' + was.toUpperCase() : '');
        }
      }
      else if (op === 'ban') u.banned = true;
      else if (op === 'unban') delete u.banned;
      else if (op === 'remove') { if (u.banned) return fail(400, 'Pengguna ini sedang diblokir. Menghapusnya akan menghilangkan blokir, jadi buka blokir dulu bila memang ingin menghapus.'); delete st.users[body.sub]; }
      else return fail(400, 'Aksi tidak dikenal.');
      await store.save(st);
      await logIt(op, u, body.sub, detail);
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

    if (action === 'plans') { // simpan daftar paket harga role
      if (!Array.isArray(body.plans) || body.plans.length > 12) return fail(400, 'Daftar paket tidak valid (maksimal 12 paket).');
      const list = cleanPlans(body.plans);
      if (list.length !== body.plans.length) return fail(400, 'Ada paket yang tidak valid. Durasi 1-3650 hari, harga 0-100.000.000, kredit 1-999 per hari.');
      st.tools.__plans = { id: '__plans', list };
      await store.save(st);
      await logIt('plans', null, undefined, list.length + ' paket disimpan');
      return res.status(200).json({ ok: true });
    }

    if (action === 'price') { // atur tool gratis atau berkredit
      const id = String(body.tool || '');
      if (!Object.prototype.hasOwnProperty.call(cfg.tools, id)) return fail(400, 'Tool tidak dikenal.');
      const n = Math.floor(Number(body.credit));
      if (!Number.isFinite(n) || n < 0 || n > 99) return fail(400, 'Biaya harus angka 0 sampai 99 kredit.');
      st.tools[id] = { id, credit: n };
      await store.save(st);
      await logIt('price', null, undefined, id + ' = ' + n + ' kredit');
      return res.status(200).json({ ok: true });
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
    console.error('[admin]', e && e.name, e && e.message);
    return fail(500, 'Penyimpanan bermasalah, coba lagi.');
  }
};
