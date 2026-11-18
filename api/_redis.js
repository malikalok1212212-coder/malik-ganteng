// Klien Upstash Redis lewat REST (tanpa dependensi). Env otomatis dari Vercel Marketplace (KV_REST_API_*) atau Upstash langsung.
const URL_ = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const configured = () => !!(URL_ && TOKEN);

// cmds = [['HGET','k','f'], ...] -> array hasil, urutan sama. Error jaringan/perintah dilempar.
async function run(cmds) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds), cache: 'no-store'
  });
  if (!r.ok) throw new Error('redis http ' + r.status);
  const out = await r.json();
  return out.map((x) => { if (x && x.error) throw new Error('redis: ' + x.error); return x.result; });
}
module.exports = { configured, run };
