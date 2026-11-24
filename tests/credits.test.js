const test = require('node:test'), assert = require('node:assert');
const credits = require('../api/_credits');
const redeem = require('../api/_redeem');
const { START, FREE_START, FREE_RESET } = credits;

test('saldo awal: pengguna baru mendapat koin awal, data lama membawa limit bonus', () => {
  assert.equal(credits.info(null, 'member').coins, START);
  assert.equal(credits.info({ crBonus: 7, cr: { used: 3, at: Date.now() + 1e6 }, crMax: 30 }, 'vip').coins, START + 7);
});

test('developer dan owner tanpa batas', () => {
  assert.equal(credits.info(null, 'developer').unlimited, true);
  assert.equal(credits.info({}, 'owner').unlimited, true);
});

test('potong, kembalikan, tambah, atur; tidak pernah negatif; saldo beli tidak reset sendiri', () => {
  const t = Date.now(), r = { crBonus: 2, cr: { used: 1, at: 1 }, crMax: 15 };
  const f = credits.charge(r, 3, t); // jatah gratis dipakai lebih dulu, saldo tidak tersentuh
  assert.equal(f, 3); assert.equal(r.coin, START + 2); assert.equal(r.fd, FREE_START - 3);
  assert.equal(r.cr, undefined); assert.equal(r.crBonus, undefined); assert.equal(r.crMax, undefined);
  credits.refund(r, 3, t + 1000, f); assert.equal(r.fd, FREE_START); assert.equal(r.coin, START + 2);
  credits.add(r, 100); assert.equal(r.coin, START + 102);
  credits.charge(r, 99999, t + 2000); assert.equal(r.coin, 0); assert.equal(r.fd, 0);
  credits.set(r, 40); assert.equal(credits.info(r, 'member', t + 3000).coins, 40);
  assert.equal(credits.info({ coin: 0 }, 'member').coins, 0, 'saldo 0 tidak diisi ulang koin awal');
});

test('jatah gratis: awal 5, tidak menumpuk selama masih ada, habis lalu 24 jam baru diisi 3', () => {
  const t = 1e12, H = 3600e3, r = {};
  assert.equal(FREE_START, 5); assert.equal(FREE_RESET, 3);
  let ci = credits.info(r, 'member', t);
  assert.equal(ci.free, FREE_START); assert.equal(ci.left, FREE_START + START); assert.equal(ci.resetAt, null);
  assert.equal(credits.charge(r, 3, t), 3);
  // sisa 2: lewat 24 jam, 48 jam, seminggu pun tidak ada reset dan tidak ada tambahan
  for (const h of [1, 24, 48, 168]) { ci = credits.info(r, 'member', t + h * H); assert.equal(ci.free, 2, h + ' jam'); assert.equal(ci.resetAt, null); }
  credits.add(r, 10); // saldo beli tidak ikut campur
  assert.equal(credits.charge(r, 2 + 4, t + 30 * H), 2); // habiskan jatah, sisanya dari saldo
  assert.equal(r.fd, 0); assert.equal(r.coin, START + 10 - 4); assert.equal(r.fr, t + 30 * H + 24 * H, 'hitung mundur mulai saat habis');
  ci = credits.info(r, 'member', t + 31 * H);
  assert.equal(ci.free, 0); assert.equal(ci.resetAt, t + 54 * H); assert.equal(ci.refill, FREE_RESET);
  assert.equal(credits.info(r, 'member', t + 54 * H - 1).free, 0, 'belum 24 jam sejak habis');
  ci = credits.info(r, 'member', t + 54 * H);
  assert.equal(ci.free, FREE_RESET, 'isi ulang 3, bukan 5'); assert.equal(ci.coins, START + 6, 'saldo beli tidak ikut reset');
  assert.equal(credits.charge(r, 1, t + 60 * H), 1); assert.equal(r.fd, FREE_RESET - 1); assert.equal(r.fr, undefined, 'masih ada sisa: tanpa hitung mundur');
  assert.equal(credits.info(r, 'member', t + 200 * H).free, FREE_RESET - 1, 'tetap tidak menumpuk');
  // memakai saldo beli saat jatah habis tidak memperpanjang hitung mundur
  const q = {}; credits.charge(q, FREE_START, t); const fr0 = q.fr; credits.add(q, 5); credits.charge(q, 2, t + 5 * H);
  assert.equal(q.fr, fr0); assert.equal(q.coin, START + 5 - 2);
  // refund: jatah kembali dan hitung mundur batal; refund saat jatah yang diambil 0 hanya mengembalikan saldo
  const z = {}; const fz = credits.charge(z, FREE_START, t); assert.equal(z.fd, 0);
  credits.refund(z, FREE_START, t + 1000, fz); assert.equal(z.fd, FREE_START); assert.equal(z.fr, undefined);
  assert.equal(credits.info(null, 'developer').free, null);
});

test('kode redeem: koin saja, role saja, dan keduanya', () => {
  const act = () => false, r = {};
  assert.equal(redeem.apply(r, { coins: 50 }, Date.now(), act), null); assert.equal(r.coin, START + 50); assert.equal(r.role, undefined);
  const r2 = {}; assert.equal(redeem.apply(r2, { role: 'vip', days: 7, coins: 10 }, Date.now(), act), null);
  assert.equal(r2.role, 'vip'); assert.equal(r2.coin, START + 10); assert.ok(r2.roleUntil > Date.now());
  assert.ok(redeem.apply({}, { credit: 15 }, Date.now(), act), 'kode lama tanpa koin dan tanpa role ditolak');
  assert.equal(redeem.describe({ coins: 50 }), '+50 koin masuk ke saldo');
});

test('pembeli koin jadi VIP; kode Premium gratis untuk akun VIP tetap memberi koin tanpa menurunkan role', () => {
  const P = require('../api/_pay'), { roleActive } = require('../api/_auth'), now = Date.now(), act = roleActive;
  const m = {}; assert.equal(P.applyPlan(m, { id: 'c20', coins: 20, price: 2000 }, now), null);
  assert.equal(m.role, 'vip'); assert.equal(m.roleUntil, undefined); assert.equal(m.coin, START + 20);
  const p = { role: 'premium', roleUntil: now + 5 * 864e5 }; // Premium berbatas -> naik VIP permanen
  assert.equal(P.applyPlan(p, { id: 'c50', coins: 50, price: 5000 }, now), null);
  assert.equal(p.role, 'vip'); assert.equal(p.roleUntil, undefined); assert.equal(p.coin, START + 50);
  assert.equal(P.applyPlan(p, { id: 'c20', coins: 20, price: 2000 }, now), null); assert.equal(p.coin, START + 70, 'beli lagi: koin bertambah, tetap VIP');
  const o = { role: 'owner' }; assert.ok(P.applyPlan(o, { id: 'c20', coins: 20, price: 2000 }, now), 'owner tidak perlu beli');
  const c = { code: 'X', role: 'premium', days: 30, coins: 15 };
  assert.equal(redeem.apply(m, c, now, act), null); assert.equal(m.role, 'vip', 'tidak diturunkan'); assert.equal(m.coin, START + 35);
  assert.equal(redeem.describe(c, false), '+15 koin masuk ke saldo dan role tetap VIP');
  assert.ok(redeem.apply(m, { role: 'premium', days: 30 }, now, act), 'kode Premium tanpa koin ditolak untuk VIP');
  const f = {}; assert.equal(redeem.apply(f, { role: 'premium', days: 7, coins: 100 }, now, act), null);
  assert.equal(f.role, 'premium'); assert.equal(f.coin, START + 100, 'member memakai kode Premium gratis: dapat Premium dan koin bebas');
});
