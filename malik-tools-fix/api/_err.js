// Pemantauan error ringan: simpan 200 error terakhir di Redis (dibaca developer lewat admin?action=errors)
// dan, bila ERROR_WEBHOOK_URL diisi (Discord / Slack / layanan lain yang menerima JSON), kirim pemberitahuan.
// Dibatasi: pesan yang sama hanya dikirim ke webhook sekali per 10 menit, supaya gangguan provider tidak membanjiri.
const R = require('./_redis');
const KEY = 'mt:errs', MAX = 200;
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);

async function report(where, err, extra) {
  const msg = clip(err && err.message ? err.message : err, 300);
  console.error('[' + where + ']', msg);
  if (!R.configured()) return;
  try {
    const rec = { ts: Date.now(), where: clip(where, 60), msg, extra: extra ? clip(typeof extra === 'string' ? extra : JSON.stringify(extra), 200) : undefined };
    const cmds = [['LPUSH', KEY, JSON.stringify(rec)], ['LTRIM', KEY, 0, MAX - 1]];
    const hook = process.env.ERROR_WEBHOOK_URL;
    let fresh = false;
    if (hook) {
      const sig = Buffer.from(rec.where + '|' + msg).toString('base64').slice(0, 60);
      const [ok] = await R.run([['SET', 'mt:errhook:' + sig, '1', 'NX', 'EX', 600]]);
      fresh = ok === 'OK';
    }
    await R.run(cmds);
    if (fresh) {
      const text = '[Malik Tools] ' + rec.where + ': ' + msg;
      fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, text }) }).catch(() => {});
    }
  } catch (e) { /* pemantau tidak boleh menjatuhkan permintaan */ }
}
async function list(limit = 100) {
  const [raw] = await R.run([['LRANGE', KEY, 0, Math.min(limit, MAX) - 1]]);
  return (raw || []).map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
}
async function clear() { await R.run([['DEL', KEY]]); }
module.exports = { report, list, clear };
