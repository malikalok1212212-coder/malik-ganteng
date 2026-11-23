// Redis palsu di memori (cukup untuk perintah yang dipakai api/*.js) dipasang lewat fetch, tanpa jaringan.
const hashes = new Map(), kv = new Map(), lists = new Map(), exp = new Map(), sets = new Map();
const S = (k) => { if (!sets.has(k)) sets.set(k, new Set()); return sets.get(k); };
const H = (k) => { if (!hashes.has(k)) hashes.set(k, new Map()); return hashes.get(k); };
function alive(k) { const e = exp.get(k); if (e && e <= Date.now()) { exp.delete(k); kv.delete(k); hashes.delete(k); lists.delete(k); sets.delete(k); } }
function exec([cmd, ...a]) {
  cmd = String(cmd).toUpperCase(); if (a[0] !== undefined && cmd !== 'EVAL') alive(String(a[0]));
  switch (cmd) {
    case 'HGET': { const h = hashes.get(a[0]); return h && h.has(String(a[1])) ? h.get(String(a[1])) : null; }
    case 'HMGET': { const h = hashes.get(a[0]); return a.slice(1).map((f) => (h && h.has(String(f)) ? h.get(String(f)) : null)); }
    case 'HSET': { let n = 0; for (let i = 1; i < a.length; i += 2) { if (!H(a[0]).has(String(a[i]))) n++; H(a[0]).set(String(a[i]), String(a[i + 1])); } return n; }
    case 'HSETNX': { if (H(a[0]).has(String(a[1]))) return 0; H(a[0]).set(String(a[1]), String(a[2])); return 1; }
    case 'HDEL': { let n = 0; for (const f of a.slice(1)) if (H(a[0]).delete(String(f))) n++; return n; }
    case 'HVALS': return [...(hashes.get(a[0]) || new Map()).values()];
    case 'SADD': { let n = 0; for (const m of a.slice(1)) if (!S(a[0]).has(String(m))) { S(a[0]).add(String(m)); n++; } return n; }
    case 'SREM': { let n = 0; for (const m of a.slice(1)) if (S(a[0]).delete(String(m))) n++; return n; }
    case 'SISMEMBER': return S(a[0]).has(String(a[1])) ? 1 : 0;
    case 'SCARD': return S(a[0]).size;
    case 'SMEMBERS': return [...S(a[0])];
    case 'HGETALL': { const out = []; for (const [f, v] of hashes.get(a[0]) || []) out.push(f, v); return out; }
    case 'EXISTS': return (kv.has(a[0]) || (hashes.get(a[0]) && hashes.get(a[0]).size) ? 1 : 0);
    case 'GET': return kv.has(a[0]) ? kv.get(a[0]) : null;
    case 'SET': {
      const nx = a.map(String).includes('NX'); if (nx && kv.has(a[0])) return null;
      kv.set(a[0], String(a[1])); const i = a.map(String).indexOf('PX'), j = a.map(String).indexOf('EX');
      if (i > 0) exp.set(a[0], Date.now() + Number(a[i + 1])); if (j > 0) exp.set(a[0], Date.now() + Number(a[j + 1]) * 1000); return 'OK';
    }
    case 'DEL': { let n = 0; for (const k of a) { if (kv.delete(k) | hashes.delete(k) | lists.delete(k) | sets.delete(k)) n++; } return n; }
    case 'INCR': { const v = (Number(kv.get(a[0])) || 0) + 1; kv.set(a[0], String(v)); return v; }
    case 'EXPIRE': case 'PEXPIRE': { const nx = a.map(String).includes('NX'); if (nx && exp.has(a[0])) return 0; exp.set(a[0], Date.now() + Number(a[1]) * (cmd === 'EXPIRE' ? 1000 : 1)); return 1; }
    case 'LPUSH': { const l = lists.get(a[0]) || []; l.unshift(a[1]); lists.set(a[0], l); return l.length; }
    case 'LTRIM': { const l = lists.get(a[0]) || []; lists.set(a[0], l.slice(Number(a[1]), Number(a[2]) + 1)); return 'OK'; }
    case 'LRANGE': return (lists.get(a[0]) || []).slice(Number(a[1]), Number(a[2]) === -1 ? undefined : Number(a[2]) + 1);
    case 'EVAL': { // skrip compare-and-set di _store.js: KEYS[1]=hash, ARGV = field, nilai lama, nilai baru
      const [, , hk, f, old, nw] = a; const cur = H(hk).get(String(f));
      if ((cur || '') === old) { H(hk).set(String(f), nw); return 1; } return 0;
    }
    default: throw new Error('perintah belum didukung di fake-redis: ' + cmd);
  }
}
function install() {
  process.env.KV_REST_API_URL = 'http://fake-redis.local'; process.env.KV_REST_API_TOKEN = 't';
  global.fetch = async (url, init) => {
    if (!String(url).startsWith('http://fake-redis.local')) throw new Error('fetch tidak diizinkan di tes: ' + url);
    const cmds = JSON.parse(init.body); const out = [];
    for (const c of cmds) { try { out.push({ result: exec(c) }); } catch (e) { out.push({ error: e.message }); } }
    return { ok: true, status: 200, json: async () => out };
  };
}
function reset() { hashes.clear(); kv.clear(); lists.clear(); exp.clear(); sets.clear(); }
module.exports = { install, reset, exec };
