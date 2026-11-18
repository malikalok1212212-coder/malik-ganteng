// Cek status provider (GenCipta) tanpa memakai kredit: hanya tes koneksi ke host, tanpa key.
// Dianggap hidup bila host menjawab dengan status < 500; mati bila timeout, gagal koneksi, atau 5xx.
const cfg = require('./_config');
const TTL = 60 * 1000;
let cache = null;

async function ping(base) {
  const t = Date.now(), ac = new AbortController(), to = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(base, { method: 'GET', signal: ac.signal, redirect: 'manual' });
    return { ok: r.status < 500, ms: Date.now() - t };
  } catch (e) { return { ok: false, ms: Date.now() - t }; }
  finally { clearTimeout(to); }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  if (cache && Date.now() - cache.at < TTL) return res.status(200).json(cache.body);
  const gc = await ping(cfg.gcBase);
  const down = gc.ok ? [] : Object.keys(cfg.tools || {});
  const body = { ok: gc.ok, gencipta: gc.ok, down, at: Date.now() };
  cache = { at: Date.now(), body };
  return res.status(200).json(body);
};
