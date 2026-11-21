const { guard } = require('./_http');
// Pengunjung online (anonim): tiap tab mengirim denyut ringan; yang diam > 100 detik dianggap pergi.
// Tanpa akun dan tanpa IP: hanya id acak dari browser + id tool yang sedang dibuka.
const R = require('./_redis');
const ZK = 'mt:pres:site', HK = 'mt:pres:tool', FK = 'mt:pres:feed', PK = 'mt:pres:peak', WIN = 100000;
let cache = { at: 0, tools: [] };

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (!R.configured()) return res.status(200).json({ ok: false });
  const q = req.query || {};
  const id = String(q.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  const tool = /^[a-z0-9-]{1,40}$/.test(String(q.t || '')) ? String(q.t) : '';
  const now = Date.now();
  try {
    const day = new Date(now + 7 * 3600e3).toISOString().slice(0, 10); // hari menurut WIB
    const UV = 'mt:pres:uv:' + day, OP = 'mt:pres:op:' + day;
    const cmds = [];
    if (id.length >= 8) { cmds.push(['ZADD', ZK, now, id]); cmds.push(tool ? ['HSET', HK, id, tool] : ['HDEL', HK, id]); cmds.push(['PFADD', UV, id]); }
    if (tool && String(q.ev) === '1') cmds.push(['LPUSH', FK, tool + '|' + now], ['LTRIM', FK, 0, 19], ['EXPIRE', FK, 3600], ['INCR', OP]);
    cmds.push(['ZREMRANGEBYSCORE', ZK, 0, now - WIN], ['ZCARD', ZK], ['EXPIRE', ZK, 300], ['EXPIRE', HK, 300], ['EXPIRE', UV, 172800], ['EXPIRE', OP, 172800], ['PFCOUNT', UV], ['GET', OP], ['ZSCORE', PK, day], ['LRANGE', FK, 0, 9]);
    const r = await R.run(cmds);
    const n = cmds.length, online = Number(r[n - 9]) || 0;
    const uv = Number(r[n - 4]) || 0, opens = Number(r[n - 3]) || 0;
    let peak = Number(r[n - 2]) || 0;
    if (online > peak) { peak = online; R.run([['ZADD', PK, 'GT', online, day], ['EXPIRE', PK, 172800]]).catch(() => {}); }
    const feed = (r[n - 1] || []).map((x) => String(x).split('|')).map((x) => [x[0], Math.max(0, Math.round((now - Number(x[1])) / 1000))]).filter((x) => /^[a-z0-9-]{1,40}$/.test(x[0]) && x[1] < 900).slice(0, 6);
    if (now - cache.at > 20000) { // hitung sebaran tool paling jarang: sekali per 20 detik per instance
      cache.at = now;
      try {
        const [ids] = await R.run([['ZRANGE', ZK, 0, 299]]);
        const live = ids || [];
        const [hs] = live.length ? await R.run([['HMGET', HK, ...live]]) : [[]];
        const cnt = {};
        (hs || []).forEach((t) => { if (t) cnt[t] = (cnt[t] || 0) + 1; });
        cache.tools = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4);
        if (Math.random() < 0.1) { // bersihkan sisa id lama di hash
          const [old] = await R.run([['ZRANGE', ZK, 0, -1]]);
          const [all] = await R.run([['HKEYS', HK]]);
          const set = new Set(old || []); const dead = (all || []).filter((k) => !set.has(k)).slice(0, 200);
          if (dead.length) await R.run([['HDEL', HK, ...dead]]);
        }
      } catch (e) { /* sebaran opsional */ }
    }
    return res.status(200).json({ ok: true, online: Math.max(1, online), tools: cache.tools, feed, uv: Math.max(uv, online), opens, peak: Math.max(1, peak) });
  } catch (e) { return res.status(200).json({ ok: false }); }
};
