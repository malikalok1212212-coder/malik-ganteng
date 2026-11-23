// Web Push: kunci publik, simpan / hapus langganan perangkat, dan tes kirim. Pengirim sungguhan ada di _push.js (dipanggil api/chat.js).
const { guard } = require('./_http');
const { getUser } = require('./_auth');
const store = require('./_store');
const rate = require('./_rate');
const R = require('./_redis');
const W = require('./_webpush');
const P = require('./_push');

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const fail = (c, e) => res.status(c).json({ ok: false, error: e });
  try {
    const on = W.enabled() && R.configured();
    if (req.method === 'GET') return res.json({ ok: true, enabled: on, key: on ? W.cfg().pub : '' });
    if (req.method !== 'POST') return fail(405, 'Metode tidak didukung.');
    const me = getUser(req);
    if (!me) return fail(401, 'Masuk dulu untuk mengatur notifikasi.');
    if (!on) return fail(503, 'Notifikasi push belum diaktifkan di server.');
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (await rate.limited('push', me.sub, 20, 600)) return fail(429, 'Terlalu sering, coba lagi sebentar.');

    if (b.op === 'subscribe') {
      if (!W.okSub(b.sub)) return fail(400, 'Langganan tidak valid.');
      const rec = await store.getUser(me.sub).catch(() => null);
      const r = await P.add(me.sub, (rec && rec.dname) || me.name || String(me.email || '').split('@')[0], b.sub);
      return r.ok ? res.json({ ok: true }) : fail(409, r.error);
    }
    if (b.op === 'unsubscribe') {
      if (typeof b.endpoint !== 'string' || b.endpoint.length > 600) return fail(400, 'Data tidak valid.');
      await P.remove(me.sub, b.endpoint);
      return res.json({ ok: true });
    }
    if (b.op === 'test') {
      if (await rate.cooling('pushtest', me.sub, 15000)) return fail(429, 'Tunggu beberapa detik sebelum tes lagi.');
      const list = await P.mine(me.sub);
      if (!list.length) return fail(404, 'Belum ada perangkat yang berlangganan.');
      await P.deliver(list, { title: 'Tes notifikasi', body: 'Notifikasi push Malik Tools bekerja di perangkat ini.', url: '/#info', tag: 'mt-test' }, { ttl: 300 });
      return res.json({ ok: true, count: list.length });
    }
    return fail(400, 'Perintah tidak dikenal.');
  } catch (e) {
    require('./_err').report('push', e);
    return fail(500, 'Notifikasi bermasalah, coba lagi.');
  }
};
