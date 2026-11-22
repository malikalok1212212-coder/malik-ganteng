const test = require('node:test'), assert = require('node:assert');
const { sameOrigin, clientIp } = require('../api/_http');
const req = (method, headers) => ({ method, headers, socket: {} });

test('GET selalu lolos', () => assert.ok(sameOrigin(req('GET', { origin: 'https://jahat.example', host: 'a.test' }))));
test('POST dari origin yang sama lolos', () => assert.ok(sameOrigin(req('POST', { origin: 'https://a.test', host: 'a.test' }))));
test('POST lintas origin ditolak', () => assert.ok(!sameOrigin(req('POST', { origin: 'https://jahat.example', host: 'a.test' }))));
test('Origin rusak ditolak', () => assert.ok(!sameOrigin(req('POST', { origin: 'bukan url', host: 'a.test' }))));
test('tanpa Origin: cross-site ditolak, lainnya lolos', () => {
  assert.ok(!sameOrigin(req('POST', { host: 'a.test', 'sec-fetch-site': 'cross-site' })));
  assert.ok(sameOrigin(req('POST', { host: 'a.test' })));
});
test('ALLOWED_ORIGINS mengizinkan origin tambahan', () => {
  process.env.ALLOWED_ORIGINS = 'https://admin.example';
  assert.ok(sameOrigin(req('POST', { origin: 'https://admin.example', host: 'a.test' })));
  delete process.env.ALLOWED_ORIGINS;
});
test('IP: header platform menang atas x-forwarded-for yang bisa dipalsukan', () => {
  assert.equal(clientIp(req('GET', { 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': '6.6.6.6, 7.7.7.7' })), '9.9.9.9');
  assert.equal(clientIp(req('GET', { 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '6.6.6.6' })), '8.8.8.8');
  assert.equal(clientIp(req('GET', { 'x-forwarded-for': '6.6.6.6, 7.7.7.7' })), '7.7.7.7'); // cadangan: entri terakhir, bukan yang diisi klien
});
