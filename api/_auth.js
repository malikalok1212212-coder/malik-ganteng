const crypto = require('crypto');
const COOKIE = 'mt_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

const b64u = (s) => Buffer.from(s).toString('base64url');
function secret() { const s = process.env.SESSION_SECRET || ''; return s.length >= 32 ? s : null; }
const mac = (body, sec) => crypto.createHmac('sha256', sec).update(body).digest();

function sign(payload) {
  const sec = secret();
  if (!sec) throw new Error('SESSION_SECRET belum diatur (minimal 32 karakter).');
  const body = b64u(JSON.stringify(payload));
  return body + '.' + mac(body, sec).toString('base64url');
}

function verify(token) {
  const sec = secret();
  if (!sec || !token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const want = mac(body, sec);
  let got; try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Math.floor(Date.now() / 1000) ? p : null;
  } catch { return null; }
}

function readCookie(req, name) {
  const hit = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  if (!hit) return '';
  try { return decodeURIComponent(hit.slice(name.length + 1)); } catch { return ''; } // cookie rusak (mis. '%') dianggap tidak ada, bukan error 500
}

function getUser(req) {
  const p = verify(readCookie(req, COOKIE));
  return p ? { sub: p.sub, email: p.email, name: p.name, picture: p.picture } : null;
}

const cookie = (value, maxAge) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// Developer = email di DEVELOPER_EMAILS (OWNER_EMAILS lama tetap dibaca agar deploy lama tidak putus).
const devList = () => ((process.env.DEVELOPER_EMAILS || '') + ',' + (process.env.OWNER_EMAILS || '')).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const isOwner = (email) => !!email && devList().includes(String(email).toLowerCase());

// Role yang bisa diberikan developer ke pengguna. Developer ditentukan dari env, bukan dari daftar ini.
const ROLES = ['member', 'premium', 'vip']; // member = role bawaan semua pengguna
// Masa aktif role: rec.roleUntil = waktu habis (ms). Kosong/0 = permanen. Yang sudah lewat otomatis dianggap member (tanpa cron).
const roleActive = (rec, now = Date.now()) => !!(rec && ['premium', 'vip'].includes(rec.role) && !(rec.roleUntil && rec.roleUntil <= now));
const roleOf = (email, rec) => (isOwner(email) ? 'developer' : (roleActive(rec) ? rec.role : 'member'));
const roleUntilOf = (email, rec) => (!isOwner(email) && roleActive(rec) && rec.roleUntil ? rec.roleUntil : 0); // 0 = permanen / bukan role berbayar

// Login wajib secara bawaan. Isi REQUIRE_LOGIN=0 hanya bila halaman memang ingin dibuka untuk tamu.
const loginRequired = () => process.env.REQUIRE_LOGIN !== '0';

const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
function checkPw(pw, salt, hash) {
  try { const a = Buffer.from(hashPw(pw, salt), 'hex'), b = Buffer.from(String(hash), 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); } catch { return false; }
}

module.exports = { loginRequired, hashPw, checkPw, isOwner, ROLES, roleActive, roleOf, roleUntilOf, sign, verify, getUser, cookie, secret, MAX_AGE };
