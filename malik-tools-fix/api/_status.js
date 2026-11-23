// Cek status provider (GenCipta, dan NexaDev bila kuncinya diisi) tanpa memakai kredit: hanya tes koneksi ke host, tanpa key.
// Dianggap hidup bila host menjawab dengan status < 500; mati bila timeout, gagal koneksi, atau 5xx.
const cfg = require('./_config');
const R = require('./_redis');
const AUTO_KEY = 'mt:autooff', FAIL_KEY = 'mt:autooff:fails';
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
  const nxOn = !!process.env.NEXADEV_API_KEY;
  const [gc, nx] = await Promise.all([ping(cfg.gcBase), nxOn ? ping(cfg.nxBase) : Promise.resolve({ ok: false, ms: 0 })]);
  // Tool dengan jalur cadangan (AM Premium) baru dianggap gangguan bila GenCipta dan NexaDev sama-sama mati
  const acOn = Object.values(cfg.tools || {}).some((t) => t.ac);
  const ac = acOn ? await ping(cfg.acBase) : { ok: false, ms: 0 };
  const acTools = Object.keys(cfg.tools || {}).filter((n) => cfg.tools[n].ac);
  // Tool GenCipta (dan cadangannya) dinilai dari GenCipta; tool api-cloud dinilai dari api-cloud
  const down = (gc.ok ? [] : Object.keys(cfg.tools || {}).filter((n) => !acTools.includes(n) && !(cfg.alts && cfg.alts[n] && nxOn && nx.ok)))
    .concat(acOn && !ac.ok ? acTools : []);
  const body = { ok: gc.ok, gencipta: gc.ok, nexadev: nxOn ? nx.ok : null, apicloud: acOn ? ac.ok : null, down, at: Date.now() };
  cache = { at: Date.now(), body };
  // Opsional (env AUTO_OFF=1): tool yang providernya mati 3 kali cek berturut-turut ditutup otomatis, dibuka lagi saat pulih.
  if (process.env.AUTO_OFF === '1' && R.configured()) {
    try {
      if (down.length) {
        const [n] = await R.run([['INCR', FAIL_KEY], ['EXPIRE', FAIL_KEY, 900]]);
        if (n >= 3) await R.run([['SET', AUTO_KEY, JSON.stringify(down), 'EX', 600]]);
      } else await R.run([['DEL', FAIL_KEY], ['DEL', AUTO_KEY]]);
    } catch (e) { /* abaikan */ }
  }
  return res.status(200).json(body);
};
