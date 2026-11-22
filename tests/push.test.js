const test = require('node:test'), assert = require('node:assert');
const crypto = require('crypto');
const { fake, call } = require('./helpers');
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
process.env.VAPID_PUBLIC_KEY = ecdh.getPublicKey().toString('base64url');
process.env.VAPID_PRIVATE_KEY = ecdh.getPrivateKey().toString('base64url');
const W = require('../api/_webpush'), P = require('../api/_push'), push = require('../api/push'), { sign } = require('../api/_auth');
const u = (s) => Buffer.from(s, 'base64url');

const cookieFor = (sub, name) => { const now = Math.floor(Date.now() / 1000); return 'mt_session=' + encodeURIComponent(sign({ sub, email: sub + '@contoh.id', name, iat: now, exp: now + 3600 })); };
let n = 0;
const newSub = (host = 'fcm.googleapis.com') => { // langganan palsu lengkap dengan kunci penerima asli
  const k = crypto.createECDH('prime256v1'); k.generateKeys();
  return { endpoint: 'https://' + host + '/fcm/send/' + (++n), keys: { p256dh: k.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
};
const sent = []; const realFetch = global.fetch;
test.beforeEach(() => {
  fake.reset(); sent.length = 0;
  global.fetch = async (url, init) => {
    if (String(url).startsWith('https://fcm.googleapis.com/')) { sent.push({ url: String(url), init }); return { ok: true, status: 201 }; }
    return realFetch(url, init);
  };
});

test('enkripsi aes128gcm cocok dengan vektor RFC 8291', () => {
  const sub = { keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } };
  const body = W.encrypt(sub, 'When I grow up, I want to be a watermelon', { priv: u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), salt: u('DGv6ra1nlYgDCS1FRnbzlw') });
  assert.equal(body.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('hanya endpoint layanan push resmi yang diterima (anti-SSRF)', () => {
  assert.ok(W.okEndpoint('https://fcm.googleapis.com/fcm/send/x'));
  assert.ok(W.okEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
  for (const bad of ['https://evil.example/x', 'http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.example/x', 'https://fcm.googleapis.com:8443/x']) assert.equal(W.okEndpoint(bad), false, bad);
});

test('berlangganan butuh login dan langganan valid', async () => {
  assert.equal((await call(push, { body: { op: 'subscribe', sub: newSub() } })).status, 401);
  const c = cookieFor('akun1', 'Budi Santoso');
  assert.equal((await call(push, { cookie: c, body: { op: 'subscribe', sub: { endpoint: 'https://evil.example/x', keys: {} } } })).status, 400);
  assert.equal((await call(push, { cookie: c, body: { op: 'subscribe', sub: newSub() } })).status, 200);
});

test('maksimal 5 perangkat per akun, berhenti berlangganan membebaskan slot', async () => {
  const c = cookieFor('akun2', 'Ani'), subs = [1, 2, 3, 4, 5].map(() => newSub());
  for (const s of subs) assert.equal((await call(push, { cookie: c, body: { op: 'subscribe', sub: s } })).status, 200);
  assert.equal((await call(push, { cookie: c, body: { op: 'subscribe', sub: newSub() } })).status, 409);
  assert.equal((await call(push, { cookie: c, body: { op: 'subscribe', sub: subs[0] } })).status, 200); // perangkat yang sama boleh daftar ulang
  await call(push, { cookie: c, body: { op: 'unsubscribe', endpoint: subs[0].endpoint } });
  assert.equal((await call(push, { cookie: c, body: { op: 'subscribe', sub: newSub() } })).status, 200);
});

test('notifyChat: @nama hanya ke yang disebut, @semua ke semua, pengirim dilewati', async () => {
  for (const [sub, name] of [['a', 'Budi Santoso'], ['b', 'Citra Dewi'], ['c', 'Dimas']]) await call(push, { cookie: cookieFor(sub, name), body: { op: 'subscribe', sub: newSub() } });
  await P.notifyChat({ sub: 'c', name: 'Dimas', text: 'halo @budi apa kabar' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(sent[0].init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  sent.length = 0;
  await P.notifyChat({ sub: 'c', name: 'Dimas', text: 'tanpa mention' }); assert.equal(sent.length, 0);
  await P.notifyChat({ sub: 'c', name: 'Dimas', text: '@semua rapat', all: true }); assert.equal(sent.length, 2); // a dan b, bukan pengirim c
  sent.length = 0;
  await P.notifyChat({ sub: 'c', name: 'Dimas', text: '@semua palsu' }); assert.equal(sent.length, 0); // tanpa penanda all dari server = teks biasa
});

test('langganan kedaluwarsa (410) dibuang otomatis', async () => {
  const c = cookieFor('x1', 'Eko'); await call(push, { cookie: c, body: { op: 'subscribe', sub: newSub() } });
  global.fetch = async (url, init) => String(url).startsWith('https://fcm.googleapis.com/') ? { ok: false, status: 410 } : realFetch(url, init);
  await P.notifyChat({ sub: 'y', name: 'Fani', text: 'hai @eko' });
  global.fetch = realFetch;
  assert.equal((await P.mine('x1')).length, 0);
});

test('hapus akun membuang semua langganannya', async () => {
  const c = cookieFor('z1', 'Gita'); await call(push, { cookie: c, body: { op: 'subscribe', sub: newSub() } });
  assert.equal((await P.mine('z1')).length, 1);
  await P.purgeUser('z1');
  assert.equal((await P.mine('z1')).length, 0);
});

test('GET menampilkan kunci publik tanpa login', async () => {
  const r = await call(push, { method: 'GET' });
  assert.equal(r.body.enabled, true); assert.equal(r.body.key, process.env.VAPID_PUBLIC_KEY);
});
