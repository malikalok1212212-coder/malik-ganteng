// Unduh gambar / video / audio hasil tool sebagai file (bukan membuka link). Tombol "Unduh Gambar" dan "Unduh Video" memanggil ini
// karena atribut download diabaikan browser untuk alamat milik domain lain. Media diambil server lalu dikirim dengan
// Content-Disposition: attachment (di-stream, tidak ditampung di memori).
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const { getUser, loginRequired, isOwner } = require('./_auth');
const store = require('./_store');
const rate = require('./_rate');

const MAX = 150 * 1024 * 1024;
const EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a',
};
const MEDIA_EXT = /\.(jpe?g|png|webp|gif|avif|mp4|m4v|mov|webm|mkv|mp3|m4a|aac|ogg|wav)(\?|#|$)/i;

// IPv6 -> 8 hextet (tanpa memakai pustaka). Mengembalikan null bila bentuknya tidak valid.
function v6parts(ip) {
  let v = ip.toLowerCase().split('%')[0];
  const dot = v.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dot) { const o = dot[2].split('.').map(Number); if (o.some((x) => x > 255)) return null; v = dot[1] + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16); }
  const halves = v.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [], tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const all = [...head, ...Array(fill).fill('0'), ...tail].map((x) => parseInt(x, 16));
  return all.length === 8 && all.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff) ? all : null;
}
const v4of = (hi, lo) => [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');

function priv(ip) { // alamat dalam/loopback/link-local/multicast: tolak (cegah SSRF)
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const p = v6parts(String(ip));
  if (!p) return true; // bentuk tidak dikenal: tolak
  if (p.every((x) => x === 0) || (p.slice(0, 7).every((x) => x === 0) && p[7] === 1)) return true; // :: dan ::1
  if (p.slice(0, 5).every((x) => x === 0) && p[5] === 0xffff) return priv(v4of(p[6], p[7])); // ::ffff:a.b.c.d / ::ffff:7f00:1
  if (p.slice(0, 6).every((x) => x === 0)) return true; // ::/96 (IPv4-compatible, usang)
  if (p[0] === 0x64 && p[1] === 0xff9b && p.slice(2, 6).every((x) => x === 0)) return priv(v4of(p[6], p[7])); // NAT64
  if (p[0] === 0x2002) return priv(v4of(p[1], p[2])); // 6to4
  if ((p[0] & 0xfe00) === 0xfc00 || (p[0] & 0xffc0) === 0xfe80 || (p[0] & 0xffc0) === 0xfec0 || (p[0] & 0xff00) === 0xff00) return true; // ULA, link-local, site-local, multicast
  return false;
}

// Pencarian DNS yang ikut divalidasi saat KONEKSI: alamat yang dipakai untuk menyambung adalah alamat yang sudah dicek,
// jadi DNS tidak bisa menjawab publik saat dicek lalu internal saat di-fetch (DNS rebinding).
function safeLookup(hostname, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  dns.lookup(hostname, { all: true }).then((addrs) => {
    if (!addrs.length || addrs.some((a) => priv(a.address))) return cb(new Error('alamat tidak diizinkan'));
    if (opts && opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  }, (e) => cb(e));
}
function get(u, timeoutMs) { // GET tanpa redirect, mengembalikan IncomingMessage
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const rq = lib.request(u, { method: 'GET', lookup: safeLookup, timeout: timeoutMs, headers: { 'User-Agent': 'MalikTools/1.0', Accept: '*/*' } }, resolve);
    rq.on('timeout', () => rq.destroy(new Error('timeout')));
    rq.on('error', reject);
    rq.end();
  });
}

function badUrl(u) { // pesan galat bila alamat tidak boleh dipakai, '' bila aman
  if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== '80' && u.port !== '443') || u.username || u.password) return 'Alamat file tidak diizinkan.';
  const h = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(h) && priv(h)) return 'Alamat file tidak diizinkan.';
  return '';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });
  if (req.method !== 'GET') return fail(405, 'Metode tidak diizinkan.');
  const who = getUser(req);
  if (loginRequired() && !who) return fail(401, 'Masuk dulu untuk mengunduh.');
  if (who && !isOwner(who.email) && await store.isBanned(who.sub)) return fail(403, 'Akun kamu diblokir oleh developer.');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (await rate.limited('dl', ip, 30, 60)) return fail(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');

  let u;
  try { u = new URL(String(req.query.u || '')); } catch (e) { return fail(400, 'Alamat file tidak valid.'); }
  let bad = badUrl(u); if (bad) return fail(400, bad);

  try {
    let r = await get(u, 20000), hop = 0;
    // CDN video sering mengalihkan (redirect) ke alamat lain: ikuti maksimal 4 kali, tiap lompatan divalidasi ulang.
    while ([301, 302, 303, 307, 308].includes(r.statusCode || 0) && r.headers.location && hop < 4) {
      r.destroy();
      try { u = new URL(r.headers.location, u); } catch (e) { return fail(502, 'File tidak bisa diambil.'); }
      bad = badUrl(u); if (bad) return fail(400, bad);
      r = await get(u, 20000); hop++;
    }
    const code = r.statusCode || 0;
    if (code < 200 || code >= 300) { r.destroy(); return fail(502, 'File tidak bisa diambil (status ' + code + ').'); }
    let type = String(r.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const okType = /^(image|video|audio)\//.test(type);
    // Sebagian CDN mengirim video sebagai octet-stream: terima hanya bila alamatnya jelas berakhiran media.
    if (!okType && !(/^(application|binary)\/octet-stream$/.test(type) && MEDIA_EXT.test(u.pathname))) { r.destroy(); return fail(415, 'Hasil bukan gambar, video, atau audio.'); }
    const len = Number(r.headers['content-length'] || 0);
    if (len > MAX) { r.destroy(); return fail(413, 'File terlalu besar (maksimal 150 MB).'); }
    let name = String(req.query.n || 'hasil').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 60) || 'hasil';
    let ext = EXT[type];
    if (!ext) { const m = u.pathname.match(MEDIA_EXT); ext = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : ''; }
    if (!okType) type = ({ mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' })[ext] || 'application/octet-stream';
    if (ext) name = name.replace(/\.[A-Za-z0-9]+$/, '') + '.' + ext;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (len) res.setHeader('Content-Length', String(len));
    let size = 0;
    r.on('data', (c) => { size += c.length; if (size > MAX) { r.destroy(); res.destroy(); } });
    r.on('error', () => res.destroy());
    r.pipe(res);
  } catch (e) { console.error('[dl]', e && e.message); if (!res.headersSent) return fail(502, 'File tidak bisa diambil.'); res.destroy(); }
};
