const { put } = require('@vercel/blob');
const { getUser, loginRequired, isOwner } = require('./_auth');
const store = require('./_store');
const rate = require('./_rate');

// Batas body fungsi Vercel adalah 4,5 MB. Browser mengecilkan foto besar sebelum dikirim ke sini.
const MAX = 4.4 * 1024 * 1024;

function sniff(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length > 12 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });

  if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');
  if (process.env.ACCESS_CODE && req.headers['x-access-code'] !== process.env.ACCESS_CODE)
    return fail(401, 'Kode akses salah atau belum diisi.');
  if (loginRequired() && !getUser(req))
    return fail(401, 'Masuk dulu untuk memakai tool ini.');
  const who = getUser(req);
  if (who && !isOwner(who.email) && await store.isBanned(who.sub)) return fail(403, 'Akun kamu diblokir oleh developer.');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (await rate.limited('upload', ip, 20, 60)) return fail(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return fail(500, 'Vercel Blob belum terhubung. Buat Blob store di tab Storage lalu connect ke project ini.');
  if (Number(req.headers['content-length'] || 0) > MAX) return fail(413, 'Ukuran file terlalu besar.');

  try {
    const chunks = []; let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX) return fail(413, 'Ukuran file terlalu besar.');
      chunks.push(c);
    }
    const buf = Buffer.concat(chunks);
    const type = sniff(buf);
    if (!type) return fail(415, 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
    const blob = await put('uploads/foto.' + type.ext, buf, { access: 'public', addRandomSuffix: true, contentType: type.mime });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    return fail(500, 'Gagal menyimpan foto sementara.');
  }
};
