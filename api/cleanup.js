// Cron Vercel: hapus foto sementara di uploads/ yang tidak sempat dihapus oleh tool (pengguna upload lalu pergi).
// Butuh env CRON_SECRET (Vercel otomatis mengirimnya sebagai Authorization: Bearer ...).
const AGE = 2 * 60 * 60 * 1000;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const s = process.env.CRON_SECRET;
  if (!s || req.headers.authorization !== 'Bearer ' + s) return res.status(401).json({ ok: false });
  let blob; try { blob = require('@vercel/blob'); } catch (e) { return res.status(500).json({ ok: false }); }
  try {
    const old = []; let cursor;
    do {
      const r = await blob.list({ prefix: 'uploads/', cursor, limit: 1000 });
      for (const b of r.blobs) if (Date.now() - new Date(b.uploadedAt).getTime() > AGE) old.push(b.url);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    for (let i = 0; i < old.length; i += 100) await blob.del(old.slice(i, i + 100));
    return res.status(200).json({ ok: true, deleted: old.length });
  } catch (e) { console.error('[cleanup]', e && e.message); return res.status(500).json({ ok: false }); }
};
