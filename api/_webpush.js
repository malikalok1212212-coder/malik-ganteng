// Web Push tanpa dependensi (paket `web-push` tidak dipakai): VAPID (RFC 8292, ES256) + enkripsi aes128gcm (RFC 8291).
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url, buat dengan `node scripts/vapid.js`), VAPID_SUBJECT (mailto: atau https:).
const crypto = require('crypto');

const unb = (s) => Buffer.from(String(s || ''), 'base64url');
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
const cfg = () => ({
  pub: String(process.env.VAPID_PUBLIC_KEY || '').trim(),
  prv: String(process.env.VAPID_PRIVATE_KEY || '').trim(),
  sub: String(process.env.VAPID_SUBJECT || '').trim() || 'mailto:admin@maliktools.biz.id'
});
const enabled = () => { const c = cfg(); return unb(c.pub).length === 65 && unb(c.prv).length === 32; };

// Hanya layanan push resmi browser yang boleh dihubungi (cegah SSRF lewat endpoint buatan).
const HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.microsoft\.com$/];
function okEndpoint(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && !x.port && HOSTS.some((r) => r.test(x.hostname)) && String(u).length <= 600; } catch (e) { return false; }
}
// Bentuk langganan yang valid: p256dh 65 byte (diawali 0x04), auth 16 byte.
function okSub(s) {
  return !!s && okEndpoint(s.endpoint) && !!s.keys && unb(s.keys.p256dh).length === 65 && unb(s.keys.p256dh)[0] === 4 && unb(s.keys.auth).length === 16;
}

function vapidHeader(endpoint, c, now) {
  const pub = unb(c.pub);
  const key = crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: c.prv, x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url') } });
  const h = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor((now || Date.now()) / 1000) + 12 * 3600, sub: c.sub })).toString('base64url');
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + p), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return 'vapid t=' + h + '.' + p + '.' + sig + ', k=' + c.pub;
}

// Enkripsi payload untuk satu langganan. `fix` hanya untuk tes (kunci ECDH dan salt tetap).
function encrypt(sub, payload, fix) {
  const ua = unb(sub.keys.p256dh), auth = unb(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (fix && fix.priv) ecdh.setPrivateKey(fix.priv); else ecdh.generateKeys();
  const as = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua);
  const ikm = hkdf(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32);
  const salt = (fix && fix.salt) || crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const ci = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([ci.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), ci.final(), ci.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([as.length]), as, ct]);
}

// -> { ok, gone } ; gone = langganan sudah tidak berlaku (404/410) dan harus dihapus.
async function send(sub, data, opt) {
  const c = cfg();
  if (!enabled() || !okSub(sub)) return { ok: false, gone: !okSub(sub) };
  try {
    const body = encrypt(sub, JSON.stringify(data));
    const r = await fetch(sub.endpoint, {
      method: 'POST', body, signal: AbortSignal.timeout(8000),
      headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String((opt && opt.ttl) || 3600), Urgency: (opt && opt.urgency) || 'normal', Authorization: vapidHeader(sub.endpoint, c) }
    });
    return { ok: r.status >= 200 && r.status < 300, gone: r.status === 404 || r.status === 410, status: r.status };
  } catch (e) { return { ok: false, gone: false }; }
}

module.exports = { enabled, cfg, okEndpoint, okSub, encrypt, vapidHeader, send };
