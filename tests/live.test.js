const test = require('node:test'), assert = require('node:assert');
const { fake, call } = require('./helpers');
process.env.DEVELOPER_EMAILS = 'dev@contoh.id';
const { sign } = require('../api/_auth'), store = require('../api/_store');
const presence = require('../api/presence'), admin = require('../api/admin');

const cookieFor = (sub, email, name) => { const now = Math.floor(Date.now() / 1000); return 'mt_session=' + encodeURIComponent(sign({ sub, email, name, iat: now, exp: now + 3600 })); };
const ping = (id, { tool, cookie } = {}) => call(presence, { method: 'GET', query: { id, ...(tool ? { t: tool, ev: '1' } : {}) }, cookie });
const live = (query = {}) => call(admin, { method: 'GET', query: { action: 'live', ...query }, cookie: cookieFor('dev1', 'dev@contoh.id', 'Dev') });

test.beforeEach(async () => {
  fake.reset();
  await store.mutateUser('u1', () => ({ firstSeen: Date.now(), email: 'rina@contoh.id', name: 'Rina', role: 'vip', roleUntil: Date.now() + 864e5 }));
  await store.mutateUser('u2', () => ({ firstSeen: Date.now(), email: 'budi@contoh.id', name: 'Budi', dname: 'Budi Santoso', dpic: 'https://img.contoh.id/budi.jpg' }));
});

test('presence: respons publik hanya angka, tanpa nama atau akun', async () => {
  const r = await ping('tamu00000001', { tool: 'qr-code' });
  assert.equal(r.body.ok, true);
  const j = JSON.stringify(r.body);
  assert.ok(!/members|sub|email|rina/i.test(j), 'tidak boleh membocorkan akun: ' + j);
});

test('live: daftar pengguna login online, tamu dihitung terpisah, satu akun banyak tab jadi satu baris', async () => {
  await ping('tamu00000001', { tool: 'qr-code' });
  await ping('rinatab000001', { tool: 'tiktok-dl2', cookie: cookieFor('u1', 'rina@contoh.id', 'Rina') });
  await ping('rinatab000002', { cookie: cookieFor('u1', 'rina@contoh.id', 'Rina') });
  await ping('budi000000001', { tool: 'upscale', cookie: cookieFor('u2', 'budi@contoh.id', 'Budi') });
  const r = await live({ lite: '1' });
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.equal(r.body.online, 4);
  assert.equal(r.body.members.length, 2);
  assert.equal(r.body.guests, 2);
  const rina = r.body.members.find((m) => m.sub === 'u1'), budi = r.body.members.find((m) => m.sub === 'u2');
  assert.equal(rina.name, 'Rina'); assert.equal(rina.role, 'vip'); assert.equal(rina.tabs, 2);
  assert.equal(budi.name, 'Budi Santoso'); assert.equal(budi.pic, 'https://img.contoh.id/budi.jpg'); assert.equal(budi.tool, 'upscale');
  assert.ok(r.body.tools.length >= 1 && r.body.feed.length >= 1);
  assert.equal(r.body.feed[0].length, 3, 'feed memuat penanda waktu mentah');
  assert.equal(r.body.days, undefined, 'mode lite melewatkan statistik 7 hari');
});

test('live: tanpa lite ikut mengirim statistik 7 hari', async () => {
  await ping('tamu00000001');
  const r = await live();
  assert.equal(r.body.ok, true); assert.ok(Array.isArray(r.body.days));
});

test('live: gambar profil bukan https tidak diteruskan', async () => {
  await store.mutateUser('u2', (u) => { u.dpic = 'data:image/png;base64,AAAA'; return u; });
  await ping('budi000000001', { cookie: cookieFor('u2', 'budi@contoh.id', 'Budi') });
  const r = await live({ lite: '1' });
  assert.equal(r.body.members[0].pic, '');
});

test('live: hanya developer yang boleh membaca', async () => {
  await ping('rinatab000001', { cookie: cookieFor('u1', 'rina@contoh.id', 'Rina') });
  const r = await call(admin, { method: 'GET', query: { action: 'live' }, cookie: cookieFor('u1', 'rina@contoh.id', 'Rina') });
  assert.notEqual(r.status, 200); assert.equal(r.body.members, undefined);
  const anon = await call(admin, { method: 'GET', query: { action: 'live' } });
  assert.notEqual(anon.status, 200);
});

test('presence: keluar dari akun menghapus pemetaan akun di tab yang sama', async () => {
  await ping('rinatab000001', { cookie: cookieFor('u1', 'rina@contoh.id', 'Rina') });
  await ping('rinatab000001'); // id sama, sudah logout
  const r = await live({ lite: '1' });
  assert.equal(r.body.members.length, 0); assert.equal(r.body.guests, 1);
});
