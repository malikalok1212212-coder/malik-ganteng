// Masukan (feedback) dikirim langsung ke server, disimpan di Redis (500 terakhir), dibaca developer di panel Developer > Masukan.
const crypto = require('crypto');
const { getUser, isOwner, loginRequired } = require('./_auth');
const R = require('./_redis');
const rate = require('./_rate');

const KEY = 'mt:fb', MAX = 500;
const CATS = ['Bug report', 'Saran fitur', 'Pertanyaan', 'Lainnya'];
const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (c, e) => res.status(c).json({ ok: false, error: e });
  const me = getUser(req);
  const action = String((req.query && req.query.action) || '');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    if (!R.configured()) return fail(500, 'Masukan butuh Upstash Redis.');

    // Developer: baca daftar masukan
    if (req.method === 'GET') {
      if (!me || !isOwner(me.email)) return fail(403, 'Khusus developer.');
      const [raw] = await R.run([['LRANGE', KEY, 0, MAX - 1]]);
      const items = [];
      for (const x of raw || []) { try { items.push(JSON.parse(x)); } catch (e) { /* lewati */ } }
      return res.status(200).json({ ok: true, items });
    }
    if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');

    // Developer: hapus satu masukan
    if (action === 'del') {
      if (!me || !isOwner(me.email)) return fail(403, 'Khusus developer.');
      const id = clip(body.id, 40);
      if (!id) return fail(400, 'ID tidak valid.');
      const [raw] = await R.run([['LRANGE', KEY, 0, MAX - 1]]);
      const hit = (raw || []).find((x) => { try { return JSON.parse(x).id === id; } catch (e) { return false; } });
      if (hit) await R.run([['LREM', KEY, 1, hit]]);
      return res.status(200).json({ ok: true });
    }

    // Pengguna: kirim masukan
    if (loginRequired() && !me) return fail(401, 'Masuk dulu untuk mengirim masukan.');
    const ip = String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim();
    const rid = me ? crypto.createHash('sha256').update(String(me.sub)).digest('hex').slice(0, 16) : crypto.createHash('sha256').update('ip-' + ip).digest('hex').slice(0, 16);
    const subject = clip(body.subject, 80), message = clip(body.message, 800);
    if (!subject || message.length < 3) return fail(400, 'Isi subjek dan pesan dulu.');
    if (await rate.cooling('fb', rid, 20000)) return fail(429, 'Tunggu sebentar sebelum mengirim lagi.');
    if (await rate.limited('fb', rid, 5, 3600)) return fail(429, 'Terlalu banyak masukan dalam satu jam. Coba lagi nanti.');
    const rec = {
      id: Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      ts: Date.now(),
      cat: CATS.includes(body.cat) ? body.cat : 'Lainnya',
      tool: clip(body.tool, 60) || 'Lainnya',
      subject, message,
      from: me ? clip((me.name || '') + (me.email ? ' <' + me.email + '>' : ''), 120) || 'Pengguna' : 'Tamu'
    };
    await R.run([['LPUSH', KEY, JSON.stringify(rec)], ['LTRIM', KEY, 0, MAX - 1]]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[feedback]', e && e.message);
    return fail(500, 'Masukan belum bisa dikirim. Coba lagi sebentar.');
  }
};
