const crypto = require('crypto');
const { getUser, isOwner, roleOf, loginRequired } = require('./_auth');
const store = require('./_store');
const R = require('./_redis');
const alog = require('./_log');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { /* opsional */ }

const rate = require('./_rate'); // jeda kirim per pengguna, terpusat di Redis
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const STICKERS = 30; // jumlah sticker di index.html (STK), id valid 0..29
const RX = ['👍', '❤️', '😂', '🔥', '🙏']; // reaksi yang diizinkan
const VK = 'mt:chat:ver'; // naik tiap ada perubahan chat; klien membandingkannya agar polling murah
const getVer = async () => { try { const [v] = await R.run([['GET', VK]]); return v || '0'; } catch (e) { return ''; } };
const bump = async () => { try { const [v] = await R.run([['INCR', VK]]); return String(v); } catch (e) { return ''; } };
const OK_ = 'mt:chat:online'; // zset pengguna yang sedang membuka Family (skor = waktu terakhir terlihat)
const MK = 'mt:chat:mutes', TK = 'mt:chat:typing'; // mute per akun (hash) dan "sedang mengetik" (zset, kedaluwarsa 6 detik)
const BAD = (process.env.CHAT_BAD_WORDS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); // kata terlarang, pisah koma di env Vercel
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BADRX = BAD.length ? new RegExp(BAD.map(esc).join('|'), 'gi') : null;
const clean = (t) => (BADRX ? t.replace(BADRX, (m) => '*'.repeat(m.length)) : t);
const MAX_IMG = 1.5 * 1024 * 1024; // foto sudah dikecilkan di browser, ini batas pengaman

function sniff(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length > 12 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
// Hapus file foto chat dari Blob (best effort, tidak menggagalkan chat)
async function dropImgs(msgs) {
  const urls = msgs.map((m) => m.img).filter(Boolean);
  if (!urls.length || !blob || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try { await blob.del(urls); } catch (e) { /* abaikan */ }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (c, e) => res.status(c).json({ ok: false, error: e });
  const me = getUser(req);
  if (loginRequired() && !me) return fail(401, 'Masuk dulu untuk membuka chat.');
  // ID akun (sub) tidak dikirim ke klien: diganti uid acak turunan + penanda mine untuk pesan milik peminta
  const uidOf = (s) => crypto.createHmac('sha256', process.env.SESSION_SECRET || 'x').update('uid-' + String(s)).digest('hex').slice(0, 12);
  const typers = async () => { // nama yang sedang mengetik (selain peminta)
    try {
      const r = await R.run([['ZREMRANGEBYSCORE', TK, 0, Date.now() - 6000], ['ZRANGE', TK, 0, -1]]);
      return (r[1] || []).map((x) => String(x).split('|')).filter((x) => !me || x[0] !== uidOf(me.sub)).map((x) => x[1]).slice(0, 3);
    } catch (e) { return []; }
  };
  const presCmds = () => [...(me ? [['ZADD', OK_, Date.now(), uidOf(me.sub)]] : []), ['ZREMRANGEBYSCORE', OK_, 0, Date.now() - 45000], ['ZCARD', OK_], ['EXPIRE', OK_, 120]];
  const online = async () => { try { const r = await R.run(presCmds()); return Number(r[r.length - 2]) || 0; } catch (e) { return 0; } };
  try {
    if (!store.ready()) return fail(500, 'Chat butuh Upstash Redis.');
    // Akun diblokir tidak boleh membaca maupun mengirim. Polling ringan (peek) memakai cache 20 detik agar tidak menambah beban Redis.
    const owner = !!me && isOwner(me.email);
    let rec = null;
    if (me && !owner) {
      rec = await store.getUser(me.sub, req.method === 'GET' && req.query && req.query.peek ? 20000 : 0).catch(() => null);
      if (rec && rec.banned) return fail(403, 'Akun kamu diblokir oleh developer.');
    }
    // Polling murah: klien kirim ?v=<versi>. Bila belum ada perubahan, cukup 1 perintah Redis (tanpa memuat 200 pesan).
    if (req.method === 'GET' && req.query && req.query.peek) { let pv = '', ty = [], on = 0;
      try { // versi + yang sedang mengetik dalam 1 kali jalan ke Redis (sebelumnya 2)
        const pc = presCmds(); const r = await R.run([['GET', VK], ['ZREMRANGEBYSCORE', TK, 0, Date.now() - 6000], ['ZRANGE', TK, 0, -1], ...pc]);
        pv = r[0] || '0'; on = Number(r[r.length - 2]) || 0;
        ty = (r[2] || []).map((x) => String(x).split('|')).filter((x) => !me || x[0] !== uidOf(me.sub)).map((x) => x[1]).slice(0, 3);
      } catch (e) { pv = ''; }
      return res.status(200).json({ ok: true, v: pv, same: String(req.query.v) === pv, typing: ty, online: on }); } // cek ada pesan baru (1 perintah Redis)
    let ver0 = '';
    if (req.method === 'GET') { ver0 = await getVer(); if (ver0 && req.query && String(req.query.v) === ver0) return res.status(200).json({ ok: true, same: true, v: ver0, typing: await typers(), online: await online() }); }
    const st = await store.load('chat');
    const out = async (v, list, extra) => {
      const msgs = list || st.msgs.slice(-60);
      // Nama + foto terbaru dari profil, hanya untuk pengirim pesan yang tampil (bukan seluruh pengguna)
      const prof = await store.getUsers(msgs.map((m) => m.sub)).catch(() => ({}));
      const fresh = (m) => { const u = prof[m.sub]; if (!u) return m; const o = { ...m }; if (u.dname) o.name = u.dname; if (typeof u.dpic === 'string') o.pic = u.dpic; return o; };
      const rxOut = (m) => { const o = {}; for (const [e, a] of Object.entries(m.rx || {})) if (a.length) o[e] = { n: a.length, me: !!me && a.includes(me.sub) }; return Object.keys(o).length ? o : undefined; };
      const pub = (m) => { const o = fresh(m); const { sub, rx, ...rest } = o; return { ...rest, rx: rxOut(m), uid: uidOf(sub), mine: !!me && sub === me.sub }; };
      return res.status(200).json({ ok: true, messages: msgs.map(pub), v: v || ver0, more: !list && st.msgs.length > 60, typing: await typers(), online: await online(), ...extra });
    };
    if (req.method === 'GET') { // ?before=<ts>: halaman pesan yang lebih lama (40 per muat)
      const bf = Number(req.query && req.query.before);
      if (bf) { const older = st.msgs.filter((m) => m.ts < bf); return out(undefined, older.slice(-40), { more: older.length > 40 }); }
      return out();
    }
    if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');
    if (!me) return fail(403, 'Masuk dulu untuk mengirim pesan.');
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    b = b || {};

    if (!owner && b.op !== 'delete' && b.op !== 'react') { // akun yang di-mute tidak bisa mengirim, mengedit, atau mengetik
      const mu = await R.run([['HGET', MK, me.sub]]).then((r) => Number(r[0]) || 0).catch(() => 0);
      if (mu > Date.now()) return fail(403, 'Kamu di-mute developer, sisa ' + Math.max(1, Math.ceil((mu - Date.now()) / 60000)) + ' menit.');
    }
    if (b.op === 'typing') {
      await R.run([['ZADD', TK, Date.now(), uidOf(me.sub) + '|' + clip(me.name || String(me.email).split('@')[0], 40).split(' ')[0]], ['EXPIRE', TK, 30]]).catch(() => {});
      return res.status(200).json({ ok: true });
    }
    if (b.op === 'edit') { // pesan teks milik sendiri (developer: siapa pun)
      const m = st.msgs.find((x) => x.id === b.id);
      if (!m) return fail(404, 'Pesan sudah tidak ada.');
      if (!owner && m.sub !== me.sub) return fail(403, 'Kamu hanya bisa mengedit pesanmu sendiri.');
      if (!m.text || Number.isInteger(m.stk)) return fail(400, 'Hanya pesan teks yang bisa diedit.');
      const t = clean(clip(b.text, 500));
      if (!t) return fail(400, 'Pesan kosong.');
      if (t !== m.text) { m.text = t; m.edited = true; await store.save(st, 'chat'); return out(await bump()); }
      return out(await getVer());
    }
    if (b.op === 'pin') { // hanya developer, maksimal 3 pesan tersemat
      if (!owner) return fail(403, 'Hanya developer yang bisa menyematkan pesan.');
      const m = st.msgs.find((x) => x.id === b.id);
      if (!m) return fail(404, 'Pesan sudah tidak ada.');
      if (!m.pin && st.msgs.filter((x) => x.pin).length >= 3) return fail(400, 'Maksimal 3 pesan tersemat. Lepas salah satu dulu.');
      if (m.pin) delete m.pin; else m.pin = true;
      await store.save(st, 'chat');
      return out(await bump());
    }
    if (b.op === 'mute' || b.op === 'unmute') { // hanya developer; target dipilih lewat id pesan
      if (!owner) return fail(403, 'Hanya developer yang bisa mute.');
      const m = st.msgs.find((x) => x.id === b.id);
      if (!m) return fail(404, 'Pesan sudah tidak ada.');
      if (m.sub === me.sub || m.role === 'developer') return fail(400, 'Akun developer tidak bisa di-mute.');
      if (b.op === 'mute') { const mins = Math.max(1, Math.min(10080, parseInt(b.min, 10) || 60)); await R.run([['HSET', MK, m.sub, Date.now() + mins * 60000]]); await alog.add({ by: me.email, act: 'mute', sub: m.sub, name: m.name, detail: mins + ' menit' }); }
      else { await R.run([['HDEL', MK, m.sub]]); await alog.add({ by: me.email, act: 'unmute', sub: m.sub, name: m.name }); }
      return out(await getVer());
    }

    if (b.op === 'delete') { // developer boleh hapus pesan siapa pun; pengguna hanya pesannya sendiri
      const gone = st.msgs.filter((m) => m.id === b.id);
      if (!owner && gone.some((m) => m.sub !== me.sub)) return fail(403, 'Kamu hanya bisa menghapus pesanmu sendiri.');
      if (!gone.length) return out(await getVer());
      st.msgs = st.msgs.filter((m) => m.id !== b.id);
      await store.save(st, 'chat');
      const nv = await bump();
      await dropImgs(gone);
      if (owner) for (const g of gone) if (g.sub !== me.sub) await alog.add({ by: me.email, act: 'chat-del', sub: g.sub, name: g.name, detail: (g.text || (g.img ? '[Foto]' : '[Sticker]')).slice(0, 100) });
      return out(nv);
    }

    if (b.op === 'react') {
      if (!RX.includes(b.e)) return fail(400, 'Reaksi tidak dikenal.');
      if (!owner && await rate.cooling('rx', me.sub, 400)) return fail(429, 'Pelan-pelan.');
      const m = st.msgs.find((x) => x.id === b.id);
      if (!m) return fail(404, 'Pesan sudah tidak ada.');
      m.rx = m.rx || {};
      const a = m.rx[b.e] = m.rx[b.e] || [];
      const k = a.indexOf(me.sub);
      if (k > -1) a.splice(k, 1); else if (a.length < 100) a.push(me.sub);
      if (!a.length) delete m.rx[b.e];
      await store.save(st, 'chat');
      return out(await bump());
    }

    const text = clean(clip(b.text, 500));
    const stk = b.stk === undefined || b.stk === null ? null : Number(b.stk);
    const hasImg = typeof b.img === 'string' && b.img.length > 0;
    if (stk !== null && (!Number.isInteger(stk) || stk < 0 || stk >= STICKERS)) return fail(400, 'Sticker tidak dikenal.');
    if (!text && !hasImg && stk === null) return fail(400, 'Pesan kosong.');

    if (!owner) {
      if (await rate.cooling('chat', me.sub, 2000)) return fail(429, 'Pelan-pelan, tunggu sebentar.');
      if (hasImg && await rate.cooling('img', me.sub, 8000)) return fail(429, 'Tunggu beberapa detik sebelum kirim foto lagi.');
    }

    let imgUrl = '';
    if (hasImg) {
      if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) return fail(500, 'Kirim foto butuh Vercel Blob.');
      const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.img);
      if (!m) return fail(415, 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length > MAX_IMG) return fail(413, 'Foto terlalu besar.');
      const type = sniff(buf);
      if (!type) return fail(415, 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
      const up = await blob.put('chat/foto.' + type.ext, buf, { access: 'public', addRandomSuffix: true, contentType: type.mime });
      imgUrl = up.url;
    }

    const pr = await store.getUser(me.sub).catch(() => null); // profil terbaru (nama + foto) agar sama dengan halaman Profil
    const r = b.replyTo && st.msgs.find((m) => m.id === b.replyTo);
    const now = Date.now();
    const msg = {
      id: now.toString(36) + Math.random().toString(36).slice(2, 6), ts: now, sub: me.sub,
      name: clip((pr && pr.dname) || me.name || String(me.email).split('@')[0], 40), pic: pr && typeof pr.dpic === 'string' ? pr.dpic : (me.picture || ''),
      role: roleOf(me.email, rec), text,
      reply: r ? { name: r.name, text: (r.text || (r.img ? '[Foto]' : '[Sticker]')).slice(0, 80) } : null
    };
    if (imgUrl) msg.img = imgUrl;
    if (stk !== null) msg.stk = stk;
    st.msgs.push(msg);
    const dropped = st.msgs.length > 200 ? st.msgs.slice(0, st.msgs.length - 200) : [];
    st.msgs = st.msgs.slice(-200);
    await store.save(st, 'chat');
    const nv = await bump();
    await dropImgs(dropped);
    return out(nv);
  } catch (e) {
    console.error('[chat]', e && e.name, e && e.message);
    return fail(500, 'Chat bermasalah, coba lagi.');
  }
};
