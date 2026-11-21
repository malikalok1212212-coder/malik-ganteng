const test = require('node:test'), assert = require('node:assert');
const { fake, mailbox, call } = require('./helpers');
const auth = require('../api/auth');
const post = (action, body, extra = {}) => call(auth, { query: { action }, body, ...extra });
const cookieOf = (r) => String(r.headers['set-cookie'] || '').split(';')[0];

async function signup(username, email, password = 'rahasia123') {
  const r = await post('register', { username, email, password });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const code = mailbox.filter((m) => m.to === email).pop().code;
  return { code };
}

test.beforeEach(() => { fake.reset(); mailbox.length = 0; });

test('daftar, verifikasi, lalu masuk', async () => {
  const { code } = await signup('budi', 'budi@contoh.id');
  const v = await post('verify', { email: 'budi@contoh.id', code });
  assert.equal(v.status, 200); assert.ok(cookieOf(v).startsWith('mt_session='));
  assert.equal((await post('login', { id: 'budi', password: 'rahasia123' })).status, 200);
  assert.equal((await post('login', { id: 'budi@contoh.id', password: 'rahasia123' })).status, 200);
});

test('permintaan lintas origin ditolak (CSRF)', async () => {
  const r = await post('login', { id: 'x', password: 'y' }, { headers: { origin: 'https://jahat.example' } });
  assert.equal(r.status, 403);
});

test('dua pendaftar bersamaan dengan username sama: hanya satu yang dapat', async () => {
  const [a, b] = await Promise.all([
    post('register', { username: 'sama', email: 'a@contoh.id', password: 'rahasia123' }),
    post('register', { username: 'sama', email: 'b@contoh.id', password: 'rahasia123' })
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
});

test('dua pendaftar berbeda bersamaan tidak saling menimpa', async () => {
  await Promise.all([
    post('register', { username: 'ani', email: 'ani@contoh.id', password: 'rahasia123' }),
    post('register', { username: 'ina', email: 'ina@contoh.id', password: 'rahasia123' })
  ]);
  const c1 = mailbox.find((m) => m.to === 'ani@contoh.id').code, c2 = mailbox.find((m) => m.to === 'ina@contoh.id').code;
  const [v1, v2] = await Promise.all([post('verify', { email: 'ani@contoh.id', code: c1 }), post('verify', { email: 'ina@contoh.id', code: c2 })]);
  assert.equal(v1.status, 200); assert.equal(v2.status, 200);
  assert.equal((await post('login', { id: 'ani', password: 'rahasia123' })).status, 200);
  assert.equal((await post('login', { id: 'ina', password: 'rahasia123' })).status, 200);
});

test('batas 5 percobaan kode tidak bisa dilewati lewat permintaan paralel', async () => {
  const { code } = await signup('cici', 'cici@contoh.id');
  const wrong = code === '000000' ? '111111' : '000000';
  const burst = await Promise.all(Array.from({ length: 20 }, () => post('verify', { email: 'cici@contoh.id', code: wrong })));
  assert.ok(burst.every((r) => r.status !== 200));
  // setelah terkunci, kode yang benar pun ditolak
  const late = await post('verify', { email: 'cici@contoh.id', code });
  assert.notEqual(late.status, 200);
});

test('kode benar berhasil setelah beberapa salah (di bawah batas)', async () => {
  const { code } = await signup('dedi', 'dedi@contoh.id');
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 3; i++) assert.equal((await post('verify', { email: 'dedi@contoh.id', code: wrong })).status, 400);
  assert.equal((await post('verify', { email: 'dedi@contoh.id', code })).status, 200);
});

test('login: tebakan sandi paralel dibatasi 8, lalu akun terkunci', async () => {
  const { code } = await signup('eka', 'eka@contoh.id'); await post('verify', { email: 'eka@contoh.id', code });
  const burst = await Promise.all(Array.from({ length: 30 }, () => post('login', { id: 'eka', password: 'salah-terus' })));
  assert.ok(burst.every((r) => r.status === 401));
  assert.equal((await post('login', { id: 'eka', password: 'rahasia123' })).status, 401); // terkunci, sandi benar pun ditolak
});

test('reset sandi: kode sekali pakai', async () => {
  const { code } = await signup('fani', 'fani@contoh.id'); await post('verify', { email: 'fani@contoh.id', code });
  await post('forgot', { email: 'fani@contoh.id' });
  const rc = mailbox.filter((m) => m.kind === 'reset').pop().code;
  const [a, b] = await Promise.all([post('reset', { email: 'fani@contoh.id', code: rc, password: 'sandibaru123' }), post('reset', { email: 'fani@contoh.id', code: rc, password: 'sandilain456' })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
});

test('hapus akun sendiri', async () => {
  const { code } = await signup('gita', 'gita@contoh.id');
  const v = await post('verify', { email: 'gita@contoh.id', code });
  const ck = cookieOf(v);
  assert.equal((await post('delete', { password: 'salah' }, { cookie: ck })).status, 401);
  assert.equal((await post('delete', { password: 'rahasia123' }, { cookie: ck })).status, 200);
  assert.equal((await post('login', { id: 'gita', password: 'rahasia123' })).status, 401);
  // username dan email bisa dipakai lagi (jeda 1 menit antar permintaan kode tetap berlaku, jadi dilewati di tes)
  fake.exec(['DEL', 'mt:cd:reg:gita@contoh.id']);
  assert.equal((await post('register', { username: 'gita', email: 'gita@contoh.id', password: 'rahasia123' })).status, 200);
});

test('ganti email lewat kode', async () => {
  const { code } = await signup('hadi', 'hadi@contoh.id');
  const ck = cookieOf(await post('verify', { email: 'hadi@contoh.id', code }));
  assert.equal((await post('email', { email: 'baru@contoh.id', password: 'salah' }, { cookie: ck })).status, 401);
  assert.equal((await post('email', { email: 'baru@contoh.id', password: 'rahasia123' }, { cookie: ck })).status, 200);
  const c2 = mailbox.filter((m) => m.to === 'baru@contoh.id').pop().code;
  assert.equal((await post('emailconfirm', { code: c2 }, { cookie: ck })).status, 200);
  assert.equal((await post('login', { id: 'baru@contoh.id', password: 'rahasia123' })).status, 200);
  assert.equal((await post('login', { id: 'hadi@contoh.id', password: 'rahasia123' })).status, 401);
});
