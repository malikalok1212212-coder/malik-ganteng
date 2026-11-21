// Bantuan HTTP bersama: IP klien yang tidak mudah dipalsukan + pengecekan Origin (anti-CSRF).

// Urutan: header yang diisi platform (Vercel menimpa nilainya, klien tidak bisa memalsukan) lebih dulu.
// x-forwarded-for hanya cadangan, dan diambil entri TERAKHIR (yang ditambahkan proxy terdekat), bukan yang pertama.
function clientIp(req) {
  const h = (req && req.headers) || {};
  const one = (v) => String(v || '').split(',')[0].trim();
  const direct = one(h['x-vercel-forwarded-for']) || one(h['x-real-ip']);
  if (direct) return direct.slice(0, 64);
  const xff = String(h['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (xff.length ? xff[xff.length - 1] : (req && req.socket && req.socket.remoteAddress) || 'x').slice(0, 64);
}

// true = boleh lanjut. Metode aman (GET/HEAD/OPTIONS) selalu lolos.
// Browser selalu mengirim Origin pada POST lintas situs; bila ada, hostnya harus sama dengan host situs ini
// (atau ada di ALLOWED_ORIGINS, dipisah koma). Tanpa Origin (curl, server-ke-server) dipakai Sec-Fetch-Site sebagai cadangan.
function sameOrigin(req) {
  const m = String(req.method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
  const h = req.headers || {};
  const origin = String(h.origin || '');
  if (origin) {
    let host; try { host = new URL(origin).host; } catch (e) { return false; }
    const mine = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
    if (host === mine) return true;
    const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
    return extra.some((x) => { try { return new URL(x).host === host; } catch (e) { return x === host; } });
  }
  const site = String(h['sec-fetch-site'] || '');
  return !site || site === 'same-origin' || site === 'none';
}

// Pakai di awal handler: if (!guard(req, res)) return;
function guard(req, res) {
  if (sameOrigin(req)) return true;
  res.setHeader('Cache-Control', 'no-store');
  res.status(403).json({ ok: false, error: 'Permintaan ditolak (asal tidak cocok).' });
  return false;
}

module.exports = { clientIp, sameOrigin, guard };
