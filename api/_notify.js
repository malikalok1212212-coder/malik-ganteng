// Kirim kabar ke bot WhatsApp (Tamako MD: POST /api/channel/new-tool, header x-internal-key). Gagal kirim tidak boleh menggagalkan simpan tool.
// Hanya data publik tool yang dikirim (path/param internal tidak ikut). Hingga 3 percobaan untuk kegagalan pasti (bukan timeout). Header x-idempotency-key dikirim agar bot bisa menolak pesan ganda.
function slim(p) {
  if (!p || !p.tool) return p;
  const t = p.tool;
  return Object.assign({}, p, { tool: { id: t.id, name: t.name, desc: t.desc, cat: t.cat, type: t.type } });
}
// Alasan gagal yang jelas (bukan sekadar "tidak terjangkau")
function why(e) {
  const c = (e && e.cause && (e.cause.code || e.cause.message)) || (e && e.code) || '';
  if (e && e.name === 'AbortError') return 'bot tidak menjawab dalam 9 detik (timeout). Pesan mungkin tetap terkirim, cek Saluran dulu sebelum kirim ulang';
  if (/ENOTFOUND|EAI_AGAIN/.test(c)) return 'alamat bot tidak ditemukan (domain salah / DNS belum aktif)';
  if (/ECONNREFUSED/.test(c)) return 'koneksi ditolak (server API bot mati atau port salah)';
  if (/ECONNRESET|UND_ERR_SOCKET/.test(c)) return 'koneksi diputus oleh bot (cek http/https dan port)';
  if (/ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/.test(c)) return 'koneksi ke bot kena timeout (port tertutup / firewall)';
  if (/CERT|SSL|TLS|self.signed/i.test(c)) return 'sertifikat HTTPS bot bermasalah (' + c + ')';
  return 'bot tidak terjangkau' + (c ? ' (' + c + ')' : '');
}
// Rapikan BOT_WEBHOOK_URL: tambahkan https:// bila lupa, tolak alamat lokal (Vercel tidak bisa menjangkau localhost)
function baseUrl() {
  let b = (process.env.BOT_WEBHOOK_URL || '').trim().replace(/\/+$/, '');
  if (!b) return { error: 'BOT_WEBHOOK_URL belum diisi' };
  if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
  let u;
  try { u = new URL(b); } catch (e) { return { error: 'BOT_WEBHOOK_URL tidak valid' }; }
  if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || u.hostname.endsWith('.local'))
    return { error: 'BOT_WEBHOOK_URL (' + u.hostname + ') alamat lokal, Vercel tidak bisa menjangkaunya. Pakai domain/IP publik bot' };
  return { base: b };
}
async function once(url, secret, body, key) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-key': secret, 'x-bot-secret': secret, 'x-idempotency-key': key },
      body, signal: ctrl.signal
    });
    let detail = ''; if (!r.ok) { try { const j = await r.json(); detail = j && j.error ? String(j.error).slice(0, 120) : ''; } catch (e) { /* bukan JSON */ } }
    const reason = r.ok ? '' : r.status === 401 || r.status === 403 ? 'bot menolak kunci (BOT_SECRET harus sama dengan BOT_INTERNAL_API_KEY di bot)' : r.status === 404 ? 'bot membalas 404 (endpoint ' + new URL(url).pathname + ' belum ada di bot)' : r.status === 400 ? 'bot menolak data tool' + (detail ? ': ' + detail : '') : 'bot membalas ' + r.status + (detail ? ': ' + detail : '');
    return { sent: r.ok, reason, retry: r.status >= 500 };
  } catch (e) {
    // Timeout tidak diulang otomatis: bot bisa saja sudah mengirim, mengulang berisiko pesan ganda di Saluran
    return { sent: false, reason: why(e), retry: !(e && e.name === 'AbortError') };
  } finally { clearTimeout(t); }
}
async function notify(payload) {
  const secret = process.env.BOT_SECRET || '';
  const b = baseUrl();
  if (b.error) return { sent: false, reason: b.error };
  if (!secret) return { sent: false, reason: 'BOT_SECRET belum diisi' };
  const path = process.env.BOT_WEBHOOK_PATH || '/api/channel/new-tool';
  const body = JSON.stringify(slim(payload));
  const key = String((payload && (payload.key || (payload.tool && payload.tool.id))) || '') + ':' + Date.now();
  // Maksimal 3 percobaan (jeda 1 dtk, lalu 2 dtk) hanya untuk kegagalan pasti: koneksi gagal, DNS, 5xx
  let r;
  for (let i = 0; i < 3; i++) {
    r = await once(b.base + path, secret, body, key);
    if (r.sent || !r.retry) break;
    if (i < 2) await new Promise(s => setTimeout(s, 1000 * (i + 1)));
  }
  return { sent: r.sent, reason: r.reason };
}
// Tes koneksi: hanya mengecek bot bisa dijangkau (status apa pun = terjangkau), tidak mengirim pengumuman
notify.ping = async function () {
  const b = baseUrl();
  if (b.error) return { ok: false, reason: b.error };
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 8000);
  try { const r = await fetch(b.base + (process.env.BOT_WEBHOOK_PATH || '/api/channel/new-tool'), { method: 'GET', signal: ctrl.signal }); return { ok: true, reason: 'bot terjangkau (status ' + r.status + ')' }; }
  catch (e) { return { ok: false, reason: why(e) }; }
  finally { clearTimeout(t); }
};
module.exports = notify;
