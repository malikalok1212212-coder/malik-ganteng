const test = require('node:test'), assert = require('node:assert'), crypto = require('crypto');
const { fake, call } = require('./helpers');
process.env.MELDAPAY_APIKEY = 'kunci-tes'; process.env.MELDAPAY_WEBHOOK_SECRET = 'rahasia-webhook';
const pay = require('../api/pay');
const store = require('../api/_store');
const { sign } = require('../api/_auth');
const P = require('../api/_pay');
const { START } = require('../api/_credits');

// Meldapay palsu: id tagihan -> { amount, status }
const mel = { n: 0, inv: new Map(), calls: [] };
const redisFetch = global.fetch;
global.fetch = async (url, init) => {
  const u = String(url);
  if (!u.startsWith('https://meldapay.com')) return redisFetch(url, init);
  const q = new URL(u).searchParams; mel.calls.push(new URL(u).pathname);
  assert.equal(q.get('apikey'), 'kunci-tes');
  const json = (b, ok = true, status = 200) => ({ ok, status, json: async () => b });
  if (u.includes('/api/invoice/status')) { const i = mel.inv.get(q.get('invoice_id')); return i ? json({ invoice_id: q.get('invoice_id'), amount: i.amount, status: i.status }) : json({ error: 'nf' }, false, 404); }
  if (u.includes('/api/invoice/cancel')) { const i = mel.inv.get(q.get('invoice_id')); if (i.status !== 'pending') return json({ success: false }, false, 400); i.status = 'cancelled'; return json({ success: true }); }
  if (u.includes('/api/invoice')) { const amount = Number(q.get('amount')), id = 'INVTES' + (++mel.n); mel.inv.set(id, { amount, status: 'pending' }); return json({ success: true, invoice_id: id, amount, fee: Math.round(amount * 0.01), total: amount + Math.round(amount * 0.01), qris_image: 'https://x/q.png', payment_link: 'https://x/p', expired_at: '2026-01-01 10:10:00' }); }
  throw new Error('url tidak dikenal ' + u);
};

const cookieFor = (sub, email) => 'mt_session=' + sign({ sub, email, name: 'Budi', exp: Math.floor(Date.now() / 1000) + 3600 });
const ck = cookieFor('u:budi', 'budi@contoh.id');
const act = (action, o = {}) => call(pay, { ...o, query: { action, ...(o.query || {}) } });
const hook = (event, id, secret = 'rahasia-webhook') => {
  const raw = JSON.stringify({ event, data: { invoice_id: id, amount: 2500 }, timestamp: new Date().toISOString() });
  return call(pay, { query: { action: 'hook' }, body: raw, headers: { origin: undefined, 'x-signature': crypto.createHmac('sha256', secret).update(raw).digest('hex') } });
};
const stat = (id) => { P.lastCheck.clear(); return act('status', { method: 'GET', query: { id }, cookie: ck }); };
const userRec = async (sub) => (await store.getUser(sub));

test.beforeEach(() => { P.lastCheck.clear(); fake.reset(); mel.n = 0; mel.inv.clear(); mel.calls.length = 0; });

test('perlu login', async () => { assert.equal((await act('create', { body: { plan: 'c20' } })).status, 401); });

test('paket koin bawaan mengikuti daftar harga', async () => {
  const { DEFAULT_PLANS } = require('../api/_plans');
  const want = { 20: 2000, 50: 5000, 350: 10000, 500: 20000, 600: 35000, 700: 36000, 800: 37000, 900: 38000, 1000: 39000, 1500: 42000 };
  assert.equal(DEFAULT_PLANS.length, 10);
  for (const p of DEFAULT_PLANS) assert.equal(p.price, want[p.coins], p.coins + ' koin');
});

test('beli 20 koin: tagihan, bayar, koin masuk otomatis, tidak ganda', async () => {
  const c = await act('create', { body: { plan: 'c20' }, cookie: ck });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.order.status, 'pending'); assert.equal(c.body.order.amount, 2000); assert.equal(c.body.order.total, 2020);
  assert.equal(c.body.order.plan.coins, 20);
  const id = c.body.order.id;
  let s = await act('status', { method: 'GET', query: { id }, cookie: ck });
  assert.equal(s.body.order.status, 'pending');
  mel.inv.get(id).status = 'paid';
  s = await stat(id);
  assert.equal(s.body.order.status, 'done'); assert.equal(s.body.credit.coins, START + 20);
  const rec = await userRec('u:budi');
  assert.equal(rec.coin, START + 20); assert.equal(rec.role, 'vip', 'pembeli koin otomatis menjadi VIP'); assert.equal(rec.roleUntil, undefined, 'VIP permanen');
  await stat(id); await hook('deposit.paid', id);
  assert.equal((await userRec('u:budi')).coin, START + 20, 'tidak boleh ditambah dua kali');
});

test('dua pengecekan bersamaan: koin hanya ditambahkan sekali', async () => {
  const c = await act('create', { body: { plan: 'c500' }, cookie: ck }), id = c.body.order.id;
  mel.inv.get(id).status = 'paid';
  await Promise.all([1, 2, 3, 4].map(() => hook('deposit.paid', id))); // hook memaksa cek ke Meldapay, jadi benar-benar berebut
  const rec = await userRec('u:budi');
  assert.equal(rec.coin, START + 500); assert.equal(rec.po.filter((x) => x === id).length, 1);
});

test('webhook: tanda tangan salah ditolak, bukan tagihan kita diabaikan, palsu tanpa pembayaran asli tidak memberi koin', async () => {
  const c = await act('create', { body: { plan: 'c20' }, cookie: ck }), id = c.body.order.id;
  assert.equal((await hook('deposit.paid', id, 'salah')).status, 401);
  assert.equal((await hook('deposit.paid', 'INVLAIN99')).body.ignored, true);
  assert.equal((await hook('deposit.paid', id)).status, 200); // tanda tangan benar, tapi Meldapay bilang masih pending
  assert.equal((await userRec('u:budi')), null);
  mel.inv.get(id).status = 'paid';
  const h = await hook('deposit.paid', id);
  assert.equal(h.body.status, 'done'); assert.equal((await userRec('u:budi')).coin, START + 20);
});

test('beli berkali-kali: koin menumpuk, tidak hangus; role OWNER ditolak sebelum bayar', async () => {
  let c = await act('create', { body: { plan: 'c20' }, cookie: ck }); mel.inv.get(c.body.order.id).status = 'paid';
  await stat(c.body.order.id);
  c = await act('create', { body: { plan: 'c50' }, cookie: ck }); mel.inv.get(c.body.order.id).status = 'paid';
  await stat(c.body.order.id);
  assert.equal((await userRec('u:budi')).coin, START + 70);
  await store.mutateUser('u:budi', (r) => { r.role = 'owner'; return r; });
  const r = await act('create', { body: { plan: 'c20' }, cookie: ck });
  assert.equal(r.status, 409); assert.equal(mel.inv.size, 2, 'tidak ada tagihan baru');
});

test('pesanan lama (role) yang sudah dibayar tetap diselesaikan sebagai role', async () => {
  const id = 'INVLAMA1';
  await P.saveNew({ id, sub: 'u:budi', email: 'budi@contoh.id', name: 'Budi', plan: { id: 'premium-7', role: 'premium', days: 7, credit: 15, price: 2500 }, amount: 2500, fee: 25, total: 2525, status: 'pending', ts: Date.now() });
  mel.inv.set(id, { amount: 2500, status: 'paid' });
  const s = await stat(id);
  assert.equal(s.body.order.status, 'done');
  const rec = await userRec('u:budi'); assert.equal(rec.role, 'premium');
});

test('tagihan dipakai ulang untuk paket sama, dibatalkan bila ganti paket', async () => {
  const a = await act('create', { body: { plan: 'c20' }, cookie: ck }), b = await act('create', { body: { plan: 'c20' }, cookie: ck });
  assert.equal(a.body.order.id, b.body.order.id); assert.equal(b.body.reused, true);
  const c = await act('create', { body: { plan: 'c500' }, cookie: ck });
  assert.notEqual(c.body.order.id, a.body.order.id); assert.equal(mel.inv.get(a.body.order.id).status, 'cancelled');
});

test('tagihan orang lain tidak bisa dilihat; developer tidak perlu beli', async () => {
  const a = await act('create', { body: { plan: 'c20' }, cookie: ck });
  const lain = await act('status', { method: 'GET', query: { id: a.body.order.id }, cookie: cookieFor('u:ani', 'ani@contoh.id') });
  assert.equal(lain.status, 404);
  process.env.DEVELOPER_EMAILS = 'dev@contoh.id';
  assert.equal((await act('create', { body: { plan: 'c20' }, cookie: cookieFor('g:1', 'dev@contoh.id') })).status, 400);
  delete process.env.DEVELOPER_EMAILS;
});

test('batalkan tagihan; kedaluwarsa tercatat', async () => {
  const a = await act('create', { body: { plan: 'c20' }, cookie: ck }), id = a.body.order.id;
  const x = await act('cancel', { body: { id }, cookie: ck }); assert.equal(x.body.order.status, 'cancelled');
  const b = await act('create', { body: { plan: 'c500' }, cookie: ck }); mel.inv.get(b.body.order.id).status = 'expired';
  assert.equal((await stat(b.body.order.id)).body.order.status, 'expired');
});

test('diag: khusus developer, membuat dan membatalkan tagihan percobaan', async () => {
  assert.equal((await act('diag', { method: 'GET', cookie: ck })).status, 403);
  process.env.DEVELOPER_EMAILS = 'dev@contoh.id';
  const d = await act('diag', { method: 'GET', cookie: cookieFor('u:dev', 'dev@contoh.id') });
  delete process.env.DEVELOPER_EMAILS;
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.ok, true); assert.equal(d.body.jawaban.dibatalkan, true);
  assert.ok(!JSON.stringify(d.body).includes('kunci-tes'));
});

test('buat tagihan: timeout Meldapay diulang sekali lalu berhasil', async () => {
  const real = global.fetch; let n = 0;
  global.fetch = async (url, init) => { if (String(url).startsWith('https://meldapay.com/api/invoice?') && ++n === 1) { const e = new Error('abort'); e.name = 'AbortError'; throw e; } return real(url, init); };
  try {
    const c = await act('create', { body: { plan: 'c20' }, cookie: ck });
    assert.equal(c.status, 200, JSON.stringify(c.body)); assert.equal(n, 2);
  } finally { global.fetch = real; }
});
