const { guard, clientIp } = require('./_http');
const crypto = require('crypto');
const { sign, getUser, cookie, secret, MAX_AGE, isOwner, roleActive, roleOf, roleUntilOf, badgeOf, loginRequired, hashPw, checkPw } = require('./_auth');
const store = require('./_store');
const stats = require('./_stats');
const mail = require('./_mail');
const redeem = require('./_redeem');
const credits = require('./_credits');
const alog = require('./_log');

const rate = require('./_rate');
const R = require('./_redis');
const { report } = require('./_err');


const sha = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const allowedEmail = (email) => {
  const allow = (process.env.ALLOWED_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !allow.length || allow.includes(String(email).toLowerCase());
};
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const USER_RE = /^[a-z0-9_]{3,20}$/;
const CODE_TTL = 10 * 60 * 1000;

// Catat pengguna di daftar developer + cek blokir, lalu pasang cookie sesi.
async function startSession(res, user) {
  const now = Math.floor(Date.now() / 1000);
  const owner = isOwner(user.email);
  let role = roleOf(user.email), roleUntil = 0, badge = null;
  try {
    if (store.ready()) {
      let banned = false;
      // Satu pengguna saja, atomik (tanpa memuat seluruh daftar). Mengembalikan null = diblokir, tidak ada yang ditulis.
      const rec = await store.mutateUser(user.sub, (u) => {
        u = u || { firstSeen: Date.now(), logins: 0 };
        if (u.banned && !owner) { banned = true; return null; }
        Object.assign(u, { email: user.email, name: user.name, picture: user.picture, lastSeen: Date.now() });
        u.logins = (u.logins || 0) + 1;
        return u;
      });
      if (banned) return { error: 'Akun ini diblokir oleh developer.' };
      if (rec) { role = roleOf(user.email, rec); roleUntil = roleUntilOf(user.email, rec); badge = badgeOf(rec); }
    }
  } catch (e) { /* login tetap jalan bila penyimpanan bermasalah */ }
  res.setHeader('Set-Cookie', cookie(sign({ ...user, iat: now, exp: now + MAX_AGE }), MAX_AGE));
  return { user: { ...user, isOwner: owner, role, roleUntil, badge } };
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });
  const action = String((req.query && req.query.action) || '');
  const clientId = process.env.GOOGLE_CLIENT_ID || '';

  // Cek sesi + info konfigurasi untuk tombol login
  if (action === 'me' && req.method === 'GET') {
    let user = getUser(req);
    if (user) {
      user = { ...user, isOwner: isOwner(user.email), role: roleOf(user.email) };
      try { const u = await store.getUser(user.sub); if (u && u.warning) user.warning = u.warning; if (u && !isOwner(user.email) && Date.now() - (u.lastSeen || 0) > 30 * 60e3) { // tandai aktif (paling sering tiap 30 menit), untuk statistik dan filter terakhir aktif
        await Promise.all([store.mutateUser(user.sub, (r) => { if (!r) return null; r.lastSeen = Date.now(); return r; }).catch(() => {}), stats.active(user.sub)]);
      }
      if (u) { user.role = roleOf(user.email, u); user.roleUntil = roleUntilOf(user.email, u); user.badge = badgeOf(u); if (u.dname) user.name = u.dname; if (typeof u.dpic === 'string') user.picture = u.dpic; } } catch (e) { /* abaikan */ }
    }
    return res.status(200).json({ ok: true, user, clientId, requireLogin: loginRequired(), smtp: mail.ready() });
  }

  // Simpan nama tampilan + foto profil di server supaya ikut tampil di Global Chat
  if (action === 'profile' && req.method === 'POST') {
    const me = getUser(req);
    if (!me) return fail(401, 'Masuk dulu.');
    if (!store.ready()) return fail(500, 'Profil butuh Upstash Redis.');
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    b = b || {};
    try {
      let blob = null; try { blob = require('@vercel/blob'); } catch (e) { /* opsional */ }
      let newPic; // undefined = foto tidak diubah
      if (typeof b.photo === 'string') {
        if (b.photo === '') newPic = '';
        else {
          const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.photo);
          if (!m) return fail(415, 'Format foto tidak didukung.');
          const buf = Buffer.from(m[1], 'base64');
          if (buf.length > 300 * 1024) return fail(413, 'Foto terlalu besar.');
          if (!(buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return fail(415, 'Format foto tidak didukung.');
          if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) return fail(500, 'Foto profil butuh Vercel Blob.');
          newPic = (await blob.put('avatar/foto.jpg', buf, { access: 'public', addRandomSuffix: true, contentType: 'image/jpeg' })).url;
        }
      }
      let old;
      const rec = await store.mutateUser(me.sub, (u) => {
        u = u || { firstSeen: Date.now(), logins: 0, email: me.email };
        if (typeof b.name === 'string') {
          const n = b.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
          if (n) u.dname = n; else delete u.dname;
        }
        old = u.dpic;
        if (newPic !== undefined) u.dpic = newPic;
        return u;
      });
      if (newPic !== undefined && old && old !== newPic && /blob\.vercel-storage\.com\/avatar\//.test(old) && blob) { try { await blob.del(old); } catch (e) { /* abaikan */ } }
      return res.status(200).json({ ok: true, name: rec.dname || me.name, picture: typeof rec.dpic === 'string' ? rec.dpic : (me.picture || '') });
    } catch (e) { console.error('[profile]', e && e.message); return fail(500, 'Gagal menyimpan profil. Coba lagi.'); }
  }

  // Tukar kode redeem -> Premium / VIP. Wajib login; satu pengguna hanya bisa memakai satu kode sekali.
  if (action === 'redeem' && req.method === 'POST') {
    const me = getUser(req);
    if (!me) return fail(401, 'Masuk dulu supaya kode bisa dipakai di akunmu.');
    if (isOwner(me.email)) return fail(400, 'Akun developer tidak perlu memakai kode.');
    if (!store.ready()) return fail(500, 'Kode redeem butuh Upstash Redis.');
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    const code = redeem.canon(b && b.code);
    if (code.length < 4) return fail(400, 'Masukkan kode redeem dulu.');
    const ip = clientIp(req);
    if (await rate.limited('redeem', me.sub, 10, 600) || await rate.limited('redeemip', ip, 40, 600)) return fail(429, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    try {
      if (await store.isBanned(me.sub)) return fail(403, 'Akun ini diblokir oleh developer.');
      const cl = await redeem.claim(code, me.sub);
      if (cl.error) return fail(400, cl.error);
      let refuse = '', extended = false;
      let rec = null;
      try {
        rec = await store.mutateUser(me.sub, (r) => {
          r = r || { firstSeen: Date.now(), logins: 0, email: me.email, name: me.name };
          if (r.banned) { refuse = 'Akun ini diblokir oleh developer.'; return null; }
          extended = roleActive(r) && r.role === cl.c.role;
          const why = redeem.apply(r, cl.c, Date.now(), roleActive);
          if (why) { refuse = why; return null; }
          return r;
        });
      } catch (e) { await redeem.release(code, me.sub).catch(() => {}); throw e; }
      if (!rec) { await redeem.release(code, me.sub).catch(() => {}); return fail(409, refuse || 'Kode tidak bisa dipakai.'); }
      const role = roleOf(me.email, rec);
      await alog.add({ by: 'redeem', act: 'redeem', sub: me.sub, email: me.email, name: rec.dname || rec.name || me.name, detail: redeem.pretty(code) + ' -> ' + redeem.describe(cl.c, extended) });
      return res.status(200).json({ ok: true, role, roleUntil: roleUntilOf(me.email, rec), credit: credits.info(rec, role), message: 'Kode berhasil dipakai. ' + redeem.describe(cl.c, extended) + ' aktif di akunmu.' });
    } catch (e) { console.error('[redeem]', e && e.message); return fail(500, 'Gagal memakai kode, coba lagi sebentar lagi.'); }
  }

  if (action === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(200).json({ ok: true });
  }

  if (action === 'google' && req.method === 'POST') {
    if (!clientId) return fail(500, 'GOOGLE_CLIENT_ID belum diatur di Environment Variables Vercel.');
    if (!secret()) return fail(500, 'SESSION_SECRET belum diatur (minimal 32 karakter).');
    const ip = clientIp(req);
    if (await rate.limited('auth', ip, 10, 60)) return fail(429, 'Terlalu banyak percobaan. Coba lagi sebentar lagi.');

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const credential = body && body.credential;
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) return fail(400, 'Token Google tidak ada.');

    let info;
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
      info = await r.json();
      if (!r.ok) throw new Error('ditolak');
    } catch { return fail(401, 'Token Google tidak valid.'); }

    const now = Math.floor(Date.now() / 1000);
    const issOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    if (info.aud !== clientId || !issOk || Number(info.exp) <= now || String(info.email_verified) !== 'true' || !info.sub || !info.email)
      return fail(401, 'Token Google tidak valid.');

    if (!allowedEmail(info.email)) return fail(403, 'Akun ini belum diizinkan.');

    const out = await startSession(res, { sub: info.sub, email: info.email, name: info.name || info.email, picture: info.picture || '' });
    if (out.error) return fail(403, out.error);
    return res.status(200).json({ ok: true, user: out.user });
  }

  // ---------- Akun username + kata sandi (verifikasi email lewat SMTP) ----------
  // Penyimpanan: satu entri per akun (Redis hash). Tulisan memakai compare-and-set per entri, pembuatan akun memakai HSETNX,
  // dan hitungan percobaan salah (kode 6 digit, kata sandi) memakai INCR atomik, jadi permintaan paralel tidak bisa menimpa
  // data atau melewati batas percobaan.
  if (req.method === 'POST' && ['register', 'verify', 'resend', 'login', 'forgot', 'reset', 'email', 'emailconfirm', 'delete'].includes(action)) {
    if (!secret()) return fail(500, 'SESSION_SECRET belum diatur (minimal 32 karakter).');
    if (!store.ready()) return fail(500, 'Penyimpanan akun butuh Upstash Redis.');
    const ip = clientIp(req);
    if (await rate.limited('auth', ip, 10, 60)) return fail(429, 'Terlalu banyak percobaan. Coba lagi sebentar lagi.');
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    b = b || {};
    const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
    const needMail = () => (mail.ready() ? null : fail(503, 'Pengiriman email (SMTP) belum diatur di server.'));
    const findUser = async (id) => (await store.accGet('users', id)) || (EMAIL_RE.test(id) ? await store.accByEmail(id) : null);
    const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const TRY_TTL = Math.ceil(CODE_TTL / 1000) + 60, MAX_TRIES = 5, MAX_FAILS = 8;
    const sessionFor = async (u) => {
      const out = await startSession(res, { sub: 'u:' + u.username, email: u.email, name: u.username, picture: '' });
      if (out.error) return fail(403, out.error);
      return res.status(200).json({ ok: true, user: out.user });
    };
    const resv = (name) => 'mt:acc:resv:' + name; // pemesanan username selama kode verifikasi berlaku

    try {
      if (action === 'register') {
        const no = needMail(); if (no) return no;
        const username = str(b.username, 40).toLowerCase(), email = str(b.email, 120).toLowerCase(), password = String(b.password || '');
        if (!USER_RE.test(username)) return fail(400, 'Username 3-20 karakter: huruf kecil, angka, atau garis bawah.');
        if (!EMAIL_RE.test(email)) return fail(400, 'Format email tidak valid.');
        if (password.length < 8 || password.length > 72) return fail(400, 'Kata sandi 8-72 karakter.');
        if (!allowedEmail(email)) return fail(403, 'Email ini belum diizinkan.');
        if (await store.accGet('users', username)) return fail(409, 'Username sudah dipakai.');
        if (await store.accByEmail(email)) return fail(409, 'Email sudah terdaftar. Silakan masuk.');
        if (await rate.cooling('reg', email, 60000)) return fail(429, 'Tunggu 1 menit sebelum meminta kode lagi.');
        // pesan username secara atomik: dua orang yang mendaftar bersamaan tidak bisa memegang username yang sama
        const [got] = await R.run([['SET', resv(username), email, 'NX', 'PX', CODE_TTL]]);
        if (got !== 'OK') { const [who] = await R.run([['GET', resv(username)]]); if (who !== email) return fail(409, 'Username sedang dipakai pendaftar lain.'); }
        const old = await store.accGet('pending', email);
        if (old && old.username !== username) await R.run([['DEL', resv(old.username)]]);
        const code = newCode(), salt = crypto.randomBytes(16).toString('hex');
        const rec = { username, email, salt, hash: hashPw(password, salt), codeHash: sha(code + email), exp: Date.now() + CODE_TTL, sentAt: Date.now() };
        try { await mail.sendCode(email, code, 'verify'); }
        catch (e) { await R.run([['DEL', resv(username)], ['DEL', 'mt:cd:reg:' + email]]).catch(() => {}); return fail(502, 'Gagal mengirim email. Periksa pengaturan SMTP atau alamat email.'); }
        await store.accMutate('pending', email, () => rec);
        await rate.clear('ver', email);
        return res.status(200).json({ ok: true, email });
      }

      if (action === 'resend') {
        const no = needMail(); if (no) return no;
        const email = str(b.email, 120).toLowerCase(), p = await store.accGet('pending', email);
        if (!p) return fail(404, 'Pendaftaran tidak ditemukan. Daftar ulang.');
        if (await rate.cooling('reg', email, 60000)) return fail(429, 'Tunggu 1 menit sebelum meminta kode lagi.');
        const code = newCode();
        try { await mail.sendCode(email, code, 'verify'); } catch (e) { return fail(502, 'Gagal mengirim email.'); }
        await store.accMutate('pending', email, (r) => (r ? Object.assign(r, { codeHash: sha(code + email), exp: Date.now() + CODE_TTL, sentAt: Date.now() }) : null));
        await R.run([['PEXPIRE', resv(p.username), CODE_TTL]]).catch(() => {});
        await rate.clear('ver', email);
        return res.status(200).json({ ok: true });
      }

      if (action === 'verify') {
        const email = str(b.email, 120).toLowerCase(), code = str(b.code, 10), p = await store.accGet('pending', email);
        if (!p || p.exp < Date.now()) return fail(400, 'Kode kedaluwarsa. Minta kode baru.');
        // INCR dulu, baru bandingkan: setiap tebakan (termasuk yang paralel) dihitung atomik sebelum kodenya diperiksa
        const n = await rate.hit('ver', email, TRY_TTL);
        if (n > MAX_TRIES) { await store.accDel('pending', email); await R.run([['DEL', resv(p.username)]]).catch(() => {}); return fail(429, 'Terlalu banyak salah. Daftar ulang.'); }
        if (sha(code + email) !== p.codeHash) return fail(400, 'Kode salah.');
        // klaim email dulu (HSETNX), lalu username (HSETNX): keduanya atomik, jadi tidak ada akun ganda
        const [em] = await R.run([['HSETNX', 'mt:acc:email', email, p.username]]);
        if (em !== 1) { await store.accDel('pending', email); return fail(409, 'Akun sudah ada. Silakan masuk.'); }
        const u = { username: p.username, email, salt: p.salt, hash: p.hash, created: Date.now() };
        if (!(await store.accCreate('users', u.username, u))) { await store.accUnindexEmail(email); await store.accDel('pending', email); return fail(409, 'Username sudah dipakai. Daftar ulang dengan username lain.'); }
        await store.accDel('pending', email);
        await Promise.all([rate.clear('ver', email), R.run([['DEL', resv(u.username)]]).catch(() => {})]);
        return sessionFor(u);
      }

      if (action === 'login') {
        const id = str(b.id, 120).toLowerCase(), password = String(b.password || '').slice(0, 200);
        const u = id && await findUser(id);
        const BAD = 'Username atau kata sandi salah. Setelah beberapa kali salah, akun dikunci sementara selama 10 menit.'; // sama untuk akun tidak ada, salah sandi, atau terkunci
        if (!u) return fail(401, BAD);
        const n = await rate.hit('lf', u.username, 600); // atomik: 8 tebakan per 10 menit per akun, termasuk yang dikirim paralel
        if (n > MAX_FAILS) return fail(401, BAD);
        if (!checkPw(password, u.salt, u.hash)) return fail(401, BAD);
        await rate.clear('lf', u.username);
        return sessionFor(u);
      }

      if (action === 'forgot') {
        const no = needMail(); if (no) return no;
        const email = str(b.email, 120).toLowerCase(), u = EMAIL_RE.test(email) && await store.accByEmail(email);
        if (u && !(await rate.cooling('forgot', email, 60000))) { // respons sama agar email tidak bisa ditebak
          const code = newCode(), reset = { codeHash: sha(code + email), exp: Date.now() + CODE_TTL, sentAt: Date.now() };
          try { await mail.sendCode(email, code, 'reset'); } catch (e) { return fail(502, 'Gagal mengirim email.'); }
          await store.accMutate('users', u.username, (r) => { if (!r) return null; r.reset = reset; return r; });
          await rate.clear('rst', email);
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'reset') {
        const email = str(b.email, 120).toLowerCase(), code = str(b.code, 10), password = String(b.password || '');
        const u = EMAIL_RE.test(email) ? await store.accByEmail(email) : null, r = u && u.reset;
        if (password.length < 8 || password.length > 72) return fail(400, 'Kata sandi baru 8-72 karakter.');
        if (!r || r.exp < Date.now()) return fail(400, 'Kode salah atau kedaluwarsa.');
        const n = await rate.hit('rst', email, TRY_TTL);
        if (n > MAX_TRIES) { await store.accMutate('users', u.username, (x) => { if (x) delete x.reset; return x; }); return fail(429, 'Terlalu banyak salah. Minta kode baru.'); }
        if (sha(code + email) !== r.codeHash) return fail(400, 'Kode salah atau kedaluwarsa.');
        const salt = crypto.randomBytes(16).toString('hex'), hash = hashPw(password, salt);
        // kode sekali pakai: hanya berhasil bila permintaan reset yang sama masih tersimpan
        const rec = await store.accMutate('users', u.username, (x) => {
          if (!x || !x.reset || x.reset.codeHash !== r.codeHash) return null;
          x.salt = salt; x.hash = hash; delete x.reset; return x;
        });
        if (!rec) return fail(400, 'Kode salah atau kedaluwarsa.');
        await Promise.all([rate.clear('rst', email), rate.clear('lf', u.username)]);
        return sessionFor(rec);
      }

      // ---- butuh sesi: ganti email (akun username) dan hapus akun sendiri ----
      if (action === 'email' || action === 'emailconfirm' || action === 'delete') {
        const me = getUser(req);
        if (!me) return fail(401, 'Masuk dulu.');
        const isPw = typeof me.sub === 'string' && me.sub.startsWith('u:');
        const uname = isPw ? me.sub.slice(2) : '';

        if (action === 'email' || action === 'emailconfirm') {
          if (!isPw) return fail(400, 'Email akun Google diatur lewat Google.');
          const no = needMail(); if (no) return no;
          const u = await store.accGet('users', uname);
          if (!u) return fail(404, 'Akun tidak ditemukan.');
          if (action === 'email') {
            const email = str(b.email, 120).toLowerCase();
            if (!EMAIL_RE.test(email)) return fail(400, 'Format email tidak valid.');
            if (!allowedEmail(email)) return fail(403, 'Email ini belum diizinkan.');
            if (email === u.email) return fail(400, 'Itu sudah email akunmu.');
            if (await store.accByEmail(email)) return fail(409, 'Email itu sudah dipakai akun lain.');
            if (!checkPw(String(b.password || '').slice(0, 200), u.salt, u.hash)) return fail(401, 'Kata sandi salah.');
            if (await rate.cooling('chg', uname, 60000)) return fail(429, 'Tunggu 1 menit sebelum meminta kode lagi.');
            const code = newCode(), change = { email, codeHash: sha(code + email), exp: Date.now() + CODE_TTL };
            try { await mail.sendCode(email, code, 'verify'); } catch (e) { return fail(502, 'Gagal mengirim email.'); }
            await store.accMutate('users', uname, (r) => { if (!r) return null; r.change = change; return r; });
            await rate.clear('chgtry', uname);
            return res.status(200).json({ ok: true, email });
          }
          const ch = u.change, code = str(b.code, 10);
          if (!ch || ch.exp < Date.now()) return fail(400, 'Kode kedaluwarsa. Minta kode baru.');
          if (await rate.hit('chgtry', uname, TRY_TTL) > MAX_TRIES) { await store.accMutate('users', uname, (r) => { if (r) delete r.change; return r; }); return fail(429, 'Terlalu banyak salah. Ulangi dari awal.'); }
          if (sha(code + ch.email) !== ch.codeHash) return fail(400, 'Kode salah.');
          const [claimed] = await R.run([['HSETNX', 'mt:acc:email', ch.email, uname]]);
          if (claimed !== 1) return fail(409, 'Email itu sudah dipakai akun lain.');
          const rec = await store.accMutate('users', uname, (r) => { if (!r || !r.change || r.change.codeHash !== ch.codeHash) return null; r.email = ch.email; delete r.change; return r; });
          if (!rec) { await store.accUnindexEmail(ch.email); return fail(400, 'Kode kedaluwarsa. Minta kode baru.'); }
          await store.accUnindexEmail(u.email);
          await store.mutateUser(me.sub, (r) => { if (!r) return null; r.email = ch.email; return r; }).catch(() => {});
          return sessionFor(rec); // sesi baru memakai email baru
        }

        // delete: hapus akun dan data pribadinya. Akun username wajib kata sandi; akun Google wajib mengetik HAPUS.
        if (isOwner(me.email)) return fail(400, 'Akun developer tidak bisa dihapus dari sini.');
        if (isPw) {
          const u = await store.accGet('users', uname);
          if (!u || !checkPw(String(b.password || '').slice(0, 200), u.salt, u.hash)) return fail(401, 'Kata sandi salah.');
        } else if (str(b.confirm, 10).toUpperCase() !== 'HAPUS') return fail(400, 'Ketik HAPUS untuk mengonfirmasi.');
        if (await rate.limited('del', me.sub, 5, 600)) return fail(429, 'Terlalu banyak percobaan. Coba lagi nanti.');
        let pic = '';
        try { const rec = await store.getUser(me.sub); pic = rec && typeof rec.dpic === 'string' ? rec.dpic : ''; } catch (e) { /* abaikan */ }
        if (isPw) { const u = await store.accGet('users', uname); await store.accDeleteAll(uname, u && u.email); }
        await R.run([['HDEL', 'mt:state:users', me.sub], ['DEL', 'mt:try:lf:' + uname]]);
        if (/blob\.vercel-storage\.com\/avatar\//.test(pic)) { try { require('@vercel/blob').del(pic); } catch (e) { /* abaikan */ } }
        await alog.add({ by: 'self', act: 'delete', sub: me.sub, email: me.email, name: me.name, detail: 'hapus akun sendiri' });
        res.setHeader('Set-Cookie', cookie('', 0));
        return res.status(200).json({ ok: true });
      }
    } catch (e) { console.error('[auth]', e && e.message); report('auth.' + action, e); return fail(500, 'Terjadi kesalahan server. Coba lagi.'); }
  }

  return fail(action ? 405 : 404, 'Aksi tidak dikenal.');
};
