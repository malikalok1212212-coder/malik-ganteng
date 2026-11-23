const test = require('node:test'), assert = require('node:assert');
process.env.DEVELOPER_EMAILS = 'dev@contoh.id';
process.env.BOT_WEBHOOK_URL = 'https://bot.contoh.id';
process.env.BOT_SECRET = 'rahasia-bot';
const { fake, mailbox, call } = require('./helpers');
const auth = require('../api/auth'), admin = require('../api/admin');
const cookieOf = (r) => String(r.headers['set-cookie'] || '').split(';')[0];

// Bot palsu: semua panggilan ke bot.contoh.id dijawab di sini
let botCalls = [], botMode = 'ok';
const realFetch = global.fetch;
global.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.hostname !== 'bot.contoh.id') return realFetch(url, init);
  const body = init.body ? JSON.parse(init.body) : null;
  botCalls.push({ path: u.pathname + u.search, method: init.method, headers: init.headers, body });
  const json = (status, o) => ({ ok: status < 400, status, json: async () => o });
  if (botMode === 'down') throw Object.assign(new Error('x'), { cause: { code: 'ECONNREFUSED' } });
  if (botMode === 'wrongkey') return json(401, { success: false, error: 'Unauthorized' });
  if (botMode === 'old') return json(404, {});
  if (u.pathname === '/api/broadcast/groups') return json(200, { success: true, channel: { id: '1@newsletter', name: 'Saluran Uji' }, groups: [{ id: '1@g.us', name: 'A', size: 5, blacklisted: false }] });
  if (u.pathname === '/api/broadcast/send') return botMode === 'busy' ? json(409, { success: false, error: 'Masih ada broadcast yang berjalan.' }) : json(200, { success: true, id: 'job1', total: 1, channel: !!body.channel, delayMs: body.delayMs || 5000 });
  if (u.pathname === '/api/broadcast/status') return json(200, { success: true, job: { id: 'job1', state: 'running', total: 1, done: 0, ok: 0, fail: 0, channel: 'menunggu', errors: [] } });
  if (u.pathname === '/api/broadcast/stop') return json(200, { success: true, job: { id: 'job1', state: 'running' } });
  return json(404, {});
};

let devCookie = '', userCookie = '';
async function login(username, email) {
  await call(auth, { query: { action: 'register' }, body: { username, email, password: 'rahasia123' } });
  const code = mailbox.filter((m) => m.to === email).pop().code;
  return cookieOf(await call(auth, { query: { action: 'verify' }, body: { email, code } }));
}
const adm = (action, o = {}) => call(admin, { query: { action, ...(o.query || {}) }, method: o.method || 'POST', body: o.body, cookie: o.cookie === undefined ? devCookie : o.cookie });

test.beforeEach(async () => {
  fake.reset(); mailbox.length = 0; botCalls = []; botMode = 'ok';
  devCookie = await login('dev', 'dev@contoh.id');
  userCookie = await login('biasa', 'biasa@contoh.id');
});

test('broadcast: pengguna biasa dan tamu ditolak', async () => {
  for (const [a, m, b] of [['bcgroups', 'GET'], ['bcsend', 'POST', { text: 'hi', channel: true }], ['bcstop', 'POST', { id: 'job1' }], ['bcstatus', 'GET']]) {
    assert.equal((await adm(a, { method: m, body: b, cookie: userCookie })).status, 403, a + ' user');
    assert.equal((await adm(a, { method: m, body: b, cookie: '' })).status, 403, a + ' tamu');
  }
  assert.equal(botCalls.length, 0);
});

test('broadcast: developer melihat daftar grup', async () => {
  const r = await adm('bcgroups', { method: 'GET' });
  assert.equal(r.status, 200); assert.equal(r.body.groups.length, 1); assert.equal(r.body.channel.name, 'Saluran Uji');
  assert.equal(botCalls[0].headers['x-internal-key'], 'rahasia-bot');
});

test('broadcast: validasi input', async () => {
  assert.equal((await adm('bcsend', { body: { channel: true } })).status, 400);           // pesan kosong
  assert.equal((await adm('bcsend', { body: { text: 'hi' } })).status, 400);              // tanpa target
  assert.equal((await adm('bcsend', { body: { text: 'hi', mode: 'pick', pick: ['bukan-id'] } })).status, 400); // pilihan kosong setelah disaring
  assert.equal((await adm('bcsend', { body: { text: 'hi', channel: true, img: 'data:text/html;base64,AAAA' } })).status, 500); // tanpa Blob
  assert.equal(botCalls.length, 0);
});

test('broadcast: kirim ke saluran + grup, jeda dibatasi 3-60 detik', async () => {
  const r = await adm('bcsend', { body: { text: 'Halo', channel: true, mode: 'all', delay: 1 } });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.id, 'job1');
  const sent = botCalls[0];
  assert.equal(sent.path, '/api/broadcast/send'); assert.equal(sent.body.delayMs, 3000); assert.equal(sent.body.mode, 'all');
  assert.ok(sent.headers['x-idempotency-key']);
  assert.equal((await adm('bcsend', { body: { text: 'Halo', mode: 'all', delay: 999 } })).status, 200);
  assert.equal(botCalls[1].body.delayMs, 60000);
});

test('broadcast: pilih grup menyaring id yang tidak valid', async () => {
  await adm('bcsend', { body: { text: 'x', mode: 'pick', pick: ['120363111111111111@g.us', 'x@s.whatsapp.net', '../etc'], exclude: ['120363999999999999@g.us', 'a'] } });
  assert.deepEqual(botCalls[0].body.pick, ['120363111111111111@g.us']); assert.deepEqual(botCalls[0].body.exclude, ['120363999999999999@g.us']);
});

test('broadcast: tercatat di log developer', async () => {
  await adm('bcsend', { body: { text: 'Pesan penting', channel: true } });
  const l = await adm('log', { method: 'GET' });
  assert.ok(l.body.log.some((x) => x.act === 'broadcast' && /Pesan penting/.test(x.detail)));
});

test('broadcast: status, hentikan, dan batas laju', async () => {
  assert.equal((await adm('bcstatus', { method: 'GET', query: { id: 'job1' } })).body.job.state, 'running');
  assert.equal((await adm('bcstatus', { method: 'GET' })).status, 400);
  assert.equal((await adm('bcstop', { body: { id: 'job1' } })).status, 200);
  assert.ok((await adm('log', { method: 'GET' })).body.log.some((x) => x.act === 'broadcast-stop'));
  let last; for (let i = 0; i < 7; i++) last = await adm('bcsend', { body: { text: 'spam', channel: true } });
  assert.equal(last.status, 429);
});

test('broadcast: pesan galat bot yang jelas', async () => {
  botMode = 'down'; let r = await adm('bcsend', { body: { text: 'x', channel: true } });
  assert.equal(r.status, 502); assert.match(r.body.error, /koneksi ditolak/);
  botMode = 'wrongkey'; r = await adm('bcgroups', { method: 'GET' }); assert.match(r.body.error, /BOT_SECRET/);
  botMode = 'old'; r = await adm('bcgroups', { method: 'GET' }); assert.match(r.body.error, /restart bot/);
  botMode = 'busy'; r = await adm('bcsend', { body: { text: 'x', channel: true } });
  assert.equal(r.status, 409); assert.match(r.body.error, /berjalan/);
});

test('broadcast: BOT_WEBHOOK_URL kosong dijelaskan', async () => {
  const keep = process.env.BOT_WEBHOOK_URL; delete process.env.BOT_WEBHOOK_URL;
  const r = await adm('bcgroups', { method: 'GET' }); process.env.BOT_WEBHOOK_URL = keep;
  assert.equal(r.status, 502); assert.match(r.body.error, /BOT_WEBHOOK_URL belum diisi/);
});
