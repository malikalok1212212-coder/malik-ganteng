// Putar (M4A, /api/spotify/stream) / unduh (MP3, /api/spotify/download) audio Spotify dari GenCipta. Endpoint GenCipta butuh API key di header, jadi audio
// diambil server lalu di-stream ke browser (tanpa ditampung di memori). Mendukung Range supaya bisa digeser (seek).
const { Readable } = require('stream');
const cfg = require('./_config');
const { getUser, loginRequired, isOwner } = require('./_auth');
const store = require('./_store');
const rate = require('./_rate');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });
  if (req.method !== 'GET') return fail(405, 'Metode tidak diizinkan.');
  if (!cfg.gcKey) return fail(500, 'GENCIPTA_API_KEY belum diatur di Environment Variables Vercel.');
  const who = getUser(req);
  if (loginRequired() && !who) return fail(401, 'Masuk dulu untuk memutar audio.');
  if (who && !isOwner(who.email) && await store.isBanned(who.sub)) return fail(403, 'Akun kamu diblokir oleh developer.');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (await rate.limited('audio', ip, 40, 60)) return fail(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');

  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return fail(400, 'ID lagu tidak valid.'); // hanya ID track Spotify; alamat lain tidak diterima

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  res.on('close', () => { clearTimeout(timer); ctrl.abort(); });
  try {
    // Putar = /spotify/stream (M4A). Unduh = /spotify/download (MP3); bila gagal, jatuh ke stream agar unduhan tetap jalan.
    const paths = req.query.dl ? ['/api/spotify/download', '/api/spotify/stream'] : ['/api/spotify/stream'];
    let r = null, ct = '', msg = '';
    for (const path of paths) {
      const u = new URL(cfg.gcBase + path);
      u.searchParams.set('url', 'https://open.spotify.com/track/' + id);
      const headers = { Authorization: 'Bearer ' + cfg.gcKey, Accept: 'audio/*, */*' };
      if (/^bytes=\d*-\d*$/.test(String(req.headers.range || ''))) headers.Range = req.headers.range;
      r = await fetch(u, { headers, signal: ctrl.signal });
      ct = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if ((r.status === 200 || r.status === 206) && /^(audio|video|application\/octet-stream)/.test(ct) && r.body) { msg = ''; break; }
      msg = 'Audio tidak bisa diambil (status ' + r.status + ').';
      try { const j = await r.json(); if (j && (j.message || j.error)) msg = String(j.message || j.error).slice(0, 200); } catch (e) { /* bukan JSON */ }
      r = null;
    }
    if (!r) return fail(502, msg || 'Audio tidak bisa diambil.');
    const type = ct.startsWith('audio/') ? ct : 'audio/mp4';
    res.statusCode = r.status;
    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    for (const h of ['content-length', 'content-range']) { const v = r.headers.get(h); if (v) res.setHeader(h, v); }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.query.dl) {
      const ext = /mpeg|mp3/.test(type) ? 'mp3' : 'm4a';
      const name = String(req.query.n || 'spotify').replace(/\.[A-Za-z0-9]+$/, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'spotify';
      res.setHeader('Content-Disposition', 'attachment; filename="' + name + '.' + ext + '"');
    }
    const body = Readable.fromWeb(r.body);
    body.on('error', () => res.destroy());
    body.pipe(res);
  } catch (e) {
    console.error('[audio]', e && e.message);
    if (!res.headersSent) return fail(502, 'Audio tidak bisa diambil.');
    res.destroy();
  }
};
