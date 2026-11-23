// Statistik global (semua pengguna) di Upstash Redis. Hari dihitung zona WIB (UTC+7).
// mt:stat:d:<hari>  hash: u:<tool> = percobaan, o:<tool> = sukses, e:<tool> = gagal di sisi provider (timeout, 5xx, koneksi)
// mt:stat:u:<hari>  HyperLogLog pengguna aktif hari itu (perkiraan, galat sekitar 1%)
// mt:stat:last      hash: <tool> = { ts, msg } kegagalan provider terakhir
// Semua fungsi best effort: bila Redis bermasalah, tool dan login tetap jalan.
const R = require('./_redis');
const WIB = 7 * 3600e3, DAY = 864e5, KEEP = 40 * 86400;
const dayKey = (t = Date.now()) => new Date(t + WIB).toISOString().slice(0, 10).replace(/-/g, '');
const dayStart = (t = Date.now()) => Math.floor((t + WIB) / DAY) * DAY - WIB;
const dk = (d) => 'mt:stat:d:' + d, uk = (d) => 'mt:stat:u:' + d;
const safe = (s) => String(s).replace(/[^a-z0-9_-]/gi, '').slice(0, 40);

// kind: 'o' sukses, 'e' gagal provider, 'r' ditolak biasa (input salah, hasil kosong): dihitung sebagai percobaan saja
async function record(tool, kind, sub, msg) {
  if (!R.configured()) return;
  try {
    const d = dayKey(), t = safe(tool), cmds = [['HINCRBY', dk(d), 'u:' + t, 1], ['EXPIRE', dk(d), KEEP]];
    if (kind === 'o' || kind === 'e') cmds.push(['HINCRBY', dk(d), kind + ':' + t, 1]);
    if (kind === 'e') cmds.push(['HSET', 'mt:stat:last', t, JSON.stringify({ ts: Date.now(), msg: String(msg || '').slice(0, 160) })]);
    if (sub) cmds.push(['PFADD', uk(d), String(sub)], ['EXPIRE', uk(d), KEEP]);
    await R.run(cmds);
  } catch (e) { console.error('[stats]', e && e.message); }
}

// Pengguna aktif: dicatat paling sering sekali per 30 menit per pengguna (dipanggil dari auth, bukan tiap permintaan).
async function active(sub) {
  if (!R.configured() || !sub) return;
  try { await R.run([['PFADD', uk(dayKey()), String(sub)], ['EXPIRE', uk(dayKey()), KEEP]]); } catch (e) { /* abaikan */ }
}

// 7 hari terakhir (terbaru di akhir): [{ day, active, tools: { id: { u, o, e } } }] + kegagalan terakhir per tool
async function summary(n = 7) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(dayKey(Date.now() - i * DAY));
  const cmds = [];
  for (const d of days) cmds.push(['HGETALL', dk(d)], ['PFCOUNT', uk(d)]);
  cmds.push(['HGETALL', 'mt:stat:last']);
  const r = await R.run(cmds);
  const out = days.map((day, i) => {
    const flat = r[i * 2] || [], tools = {};
    for (let j = 0; j < flat.length; j += 2) {
      const [k, t] = String(flat[j]).split(':');
      if (!t || !['u', 'o', 'e'].includes(k)) continue;
      (tools[t] = tools[t] || { u: 0, o: 0, e: 0 })[k] = Number(flat[j + 1]) || 0;
    }
    return { day, active: Number(r[i * 2 + 1]) || 0, tools };
  });
  const lf = r[days.length * 2] || [], last = {};
  for (let j = 0; j < lf.length; j += 2) { try { last[lf[j]] = JSON.parse(lf[j + 1]); } catch (e) { /* lewati */ } }
  return { days: out, last };
}

module.exports = { record, active, summary, dayStart, dayKey };
