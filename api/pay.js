// Pembayaran koin lewat Meldapay (QRIS). Aksi: create, status, mine, cancel (pengguna login) dan hook (callback dari Meldapay).
// Alur: create -> tagihan + QRIS -> pengguna bayar -> status (polling) atau hook -> koin masuk ke saldo otomatis. Detail ada di _pay.js.
const { guard, clientIp } = require('./_http');
const { getUser, isOwner, roleOf, roleUntilOf } = require('./_auth');
const store = require('./_store');
const pay = require('./_pay');
const { plansOf } = require('./_plans');
const credits = require('./_credits');
const alog = require('./_log');
const rate = require('./_rate');
const { report } = require('./_err');

const safeUrl = (v, img) => { const x = typeof v === 'string' ? v.trim() : ''; return x.length <= 4000 && (/^https:\/\//i.test(x) || (img && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(x))) ? x : ''; };
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error, extra) => res.status(code).json({ ok: false, error, ...(extra || {}) });
  const action = String((req.query && req.query.action) || '');
  const body = () => { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b && typeof b === 'object' ? b : {}; };

  // ---- callback Meldapay (server ke server) ----
  if (action === 'hook') {
    if (req.method !== 'POST') return fail(405, 'Metode tidak didukung.');
    if (!pay.configured() || !store.ready()) return fail(503, 'Pembayaran belum aktif.');
    try {
      const raw = await pay.rawBody(req);
      const secret = process.env.MELDAPAY_WEBHOOK_SECRET || '';
      if (secret && !pay.verifySig(raw, req.headers['x-signature'], secret)) return fail(401, 'Invalid signature');
      let p; try { p = JSON.parse(raw.toString('utf8')); } catch (e) { return fail(400, 'Body bukan JSON.'); }
      const ev = String(p && p.event || ''), id = String(p && p.data && p.data.invoice_id || '');
      if (!pay.ID_RE.test(id) || !['deposit.paid', 'deposit.cancelled'].includes(ev)) return res.status(200).json({ ok: true, ignored: true });
      const o = await pay.getOrder(id);
      if (!o) return res.status(200).json({ ok: true, ignored: true }); // bukan tagihan Malik Tools (mis. milik toko bot)
      // Isi callback tidak dipercaya: status asli selalu dicek ulang ke Meldapay sebelum role diberikan.
      const r = await pay.sync(id, alog, { force: true, timeout: 3500 });
      return res.status(200).json({ ok: true, status: r && r.status });
    } catch (e) {
      await report('pay.hook', e);
      return fail(500, 'Gagal memproses callback.'); // Meldapay akan mengulang; polling pengguna juga jadi cadangan
    }
  }

  // ---- semua aksi lain: wajib login ----
  const me = getUser(req);
  if (!me) return fail(401, 'Masuk dulu supaya pembayaran tercatat di akunmu.');
  // ---- diagnosa gateway (khusus developer): buka /api/pay?action=diag di browser saat login sebagai developer ----
  // Mencoba membuat satu tagihan percobaan lalu langsung membatalkannya, dan menampilkan alasan asli bila gagal. API key tidak pernah ditampilkan.
  if (action === 'diag') {
    if (!isOwner(me.email)) return fail(403, 'Khusus developer.');
    const r0 = { configured: pay.configured(), redis: store.ready(), host: '' };
    try { r0.host = new URL((process.env.MELDAPAY_BASE_URL || 'https://meldapay.com').trim()).host; } catch (e) { r0.host = 'MELDAPAY_BASE_URL tidak valid'; }
    if (!r0.configured) return res.status(200).json({ ok: false, ...r0, hasil: 'MELDAPAY_APIKEY belum diisi di Vercel (atau belum redeploy).' });
    let amount = Math.floor(Number(req.query && req.query.amount)) || 0;
    if (!amount && store.ready()) { try { const pl = plansOf({ __plans: await store.getTool('__plans') }).filter((x) => x.price >= 1000)[0]; amount = pl ? pl.price : 0; } catch (e) { /* pakai bawaan */ } }
    amount = amount || 2500;
    const r = await pay.createInvoice(amount), j = r.j || {};
    const seen = { http: r.code, success: j.success, error: clip(r.error || j.error || j.message, 200), invoice_id: pay.ID_RE.test(String(j.invoice_id || '')) ? 'valid' : (j.invoice_id ? 'format tidak dikenal' : 'tidak ada'), amount: j.amount, fee: j.fee, total: j.total, ada_qris: !!(j.qris_image || j.payment_link) };
    let hasil = 'Tagihan percobaan berhasil dibuat.';
    if (!r.ok && !r.j && r.code === 502) hasil = 'Meldapay tidak menjawab (sudah dicoba 2 kali, masing-masing 15 detik): ' + (seen.error || 'timeout') + '. Ini masalah koneksi atau server Meldapay, bukan nominal. Coba buka meldapay.com di browser, cek status akun di dashboard mereka, dan ulangi beberapa menit lagi. Bila alamat API-nya berbeda dari meldapay.com, isi MELDAPAY_BASE_URL di Vercel.';
    else if (!r.ok || j.success === false) hasil = 'Meldapay menolak: ' + (seen.error || 'HTTP ' + r.code) + '. Cek API key, status akun Meldapay, dan nominal minimum.';
    else if (seen.invoice_id !== 'valid') hasil = 'Meldapay menjawab tetapi tanpa invoice_id yang valid.';
    else if (Math.floor(Number(j.amount)) !== amount) hasil = 'Nominal dari Meldapay (' + j.amount + ') tidak sama dengan harga paket (' + amount + '). Kode akan membatalkan tagihan.';
    if (seen.invoice_id === 'valid') { const c = await pay.cancelInvoice(String(j.invoice_id)).catch(() => null); seen.dibatalkan = !!(c && c.ok); }
    return res.status(200).json({ ok: hasil === 'Tagihan percobaan berhasil dibuat.', ...r0, nominal_uji: amount, jawaban: seen, hasil });
  }

  if (isOwner(me.email)) return fail(400, 'Akun developer tidak perlu membeli koin.');
  if (!pay.configured()) return fail(503, 'Pembayaran otomatis belum diaktifkan. Hubungi developer.');
  if (!store.ready()) return fail(500, 'Pembayaran butuh Upstash Redis.');
  const ip = clientIp(req);
  const account = async () => { const rec = await store.getUser(me.sub), role = roleOf(me.email, rec); return { role, roleUntil: roleUntilOf(me.email, rec), credit: credits.info(rec, role) }; };
  const out = async (o, extra) => res.status(200).json({ ok: true, order: o ? pay.view(o) : null, ...(o && o.status === 'done' ? await account() : {}), ...(extra || {}) });
  const settle = async (id) => { try { return await pay.sync(id, alog); } catch (e) { if (!e.soft) await report('pay.sync', e, id); return pay.getOrder(id); } };

  try {
    if (await store.isBanned(me.sub)) return fail(403, 'Akun ini diblokir oleh developer.');

    if (action === 'create' && req.method === 'POST') {
      if (await rate.limited('paycreate', me.sub, 6, 600) || await rate.limited('payip', ip, 30, 600)) return fail(429, 'Terlalu banyak permintaan. Coba lagi beberapa menit lagi.');
      const planId = clip(body().plan, 30);
      const plans = plansOf({ __plans: await store.getTool('__plans') });
      const plan = plans.find((x) => x.id === planId);
      if (!plan) return fail(400, 'Paket tidak ditemukan. Muat ulang halaman lalu pilih lagi.');
      if (!(plan.price >= 1000)) return fail(400, 'Paket ini tidak bisa dibayar online (harga di bawah Rp1.000). Hubungi developer.');
      // Tolak sebelum bayar bila paket tidak bisa diterapkan (mis. akun role OWNER), supaya uang tidak tertahan.
      const rec = await store.getUser(me.sub);
      const why = pay.applyPlan(JSON.parse(JSON.stringify(rec || {})), plan);
      if (why) return fail(409, why);
      // Pakai ulang tagihan yang masih berlaku untuk paket yang sama; paket lain: batalkan yang lama.
      for (const o of await pay.ordersOf(me.sub)) {
        if (o.status === 'paid') return out(await settle(o.id));
        if (o.status !== 'pending') continue;
        const cur = await settle(o.id);
        if (cur && cur.status === 'done') return out(cur);
        if (cur && cur.status === 'pending') {
          if (cur.plan.id === plan.id && cur.plan.price === plan.price && Date.now() - cur.ts < 8 * 60e3) return out(cur, { reused: true });
          await pay.cancelInvoice(cur.id).catch(() => {});
          await pay.mutateOrder(cur.id, (x) => (x.status === 'pending' ? { ...x, status: 'cancelled' } : null));
        }
      }
      const r = await pay.createInvoice(plan.price);
      const j = r.j || {}, id = String(j.invoice_id || '');
      if (!r.ok || j.success === false || !pay.ID_RE.test(id)) { await report('pay.create', r.error || ('Meldapay membalas ' + r.code + ': ' + clip(j.error || j.message, 120)), plan.id); return fail(502, 'Gagal membuat tagihan. Coba lagi sebentar lagi.'); }
      const amount = Math.floor(Number(j.amount)), fee = Math.max(0, Math.floor(Number(j.fee) || 0)), total = Math.floor(Number(j.total)) || amount + fee;
      if (amount !== plan.price) { await pay.cancelInvoice(id).catch(() => {}); await report('pay.create', 'nominal tagihan tidak cocok ' + amount + ' vs ' + plan.price, id); return fail(502, 'Gagal membuat tagihan. Coba lagi sebentar lagi.'); }
      const o = { id, sub: me.sub, email: me.email, name: clip(me.name, 60), plan: { id: plan.id, coins: plan.coins, price: plan.price }, amount, fee, total, qris: safeUrl(j.qris_image, true), link: safeUrl(j.payment_link), expiredAt: clip(j.expired_at, 40), status: 'pending', ts: Date.now() };
      if (!(await pay.saveNew(o))) return fail(500, 'Gagal menyimpan tagihan. Coba lagi.');
      return out(o);
    }

    if (action === 'status' && req.method === 'GET') {
      if (await rate.limited('paystatus', me.sub, 300, 600)) return fail(429, 'Terlalu sering mengecek. Tunggu sebentar.');
      const o = await pay.getOrder(String(req.query.id || ''));
      if (!o || o.sub !== me.sub) return fail(404, 'Tagihan tidak ditemukan.');
      return out(await settle(o.id));
    }

    if (action === 'mine' && req.method === 'GET') {
      if (await rate.limited('paymine', me.sub, 60, 600)) return fail(429, 'Terlalu sering mengecek. Tunggu sebentar.');
      const list = (await pay.ordersOf(me.sub)).filter((o) => o.status === 'pending' || o.status === 'paid').slice(0, 3);
      let latest = null;
      for (const o of list) { const cur = await settle(o.id); if (cur && !latest) latest = cur; }
      return out(latest && (latest.status === 'pending' || latest.status === 'paid' || latest.status === 'done') ? latest : null);
    }

    if (action === 'history' && req.method === 'GET') {
      if (await rate.limited('payhist', me.sub, 30, 600)) return fail(429, 'Terlalu sering mengecek. Tunggu sebentar.');
      const list = (await pay.ordersOf(me.sub)).filter((o) => ['done', 'paid', 'refused', 'expired'].includes(o.status))
        .map((o) => ({ id: o.id, status: o.status, coins: o.plan && o.plan.coins, role: o.plan && o.plan.role, days: o.plan && o.plan.days, total: o.total || o.amount, ts: o.ts }));
      return res.status(200).json({ ok: true, list });
    }

    if (action === 'cancel' && req.method === 'POST') {
      const o = await pay.getOrder(clip(body().id, 64));
      if (!o || o.sub !== me.sub) return fail(404, 'Tagihan tidak ditemukan.');
      const cur = await settle(o.id); // mungkin sudah dibayar
      if (!cur || cur.status !== 'pending') return out(cur);
      await pay.cancelInvoice(cur.id).catch(() => {});
      const after = await settle(cur.id); // bila pembatalan ditolak karena baru dibayar, ini menyelesaikannya
      if (after && after.status === 'pending') return out(await pay.mutateOrder(cur.id, (x) => (x.status === 'pending' ? { ...x, status: 'cancelled' } : null)));
      return out(after);
    }

    return fail(400, 'Aksi tidak dikenal.');
  } catch (e) {
    await report('pay.' + action, e);
    return fail(500, 'Terjadi kesalahan di server. Coba lagi sebentar lagi.');
  }
};
