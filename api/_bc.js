// Pemanggil API broadcast di bot WhatsApp (Tamako MD): daftar grup, mulai, status, hentikan.
// Memakai BOT_WEBHOOK_URL + BOT_SECRET yang sama dengan pengumuman tool baru. Tanpa percobaan ulang otomatis,
// karena mengulang permintaan "mulai" berisiko pesan ganda di Saluran dan grup.
const notify = require('./_notify');

async function call(method, path, body, headers, timeoutMs) {
  const secret = process.env.BOT_SECRET || '';
  const b = notify.baseUrl();
  if (b.error) return { ok: false, code: 503, error: b.error };
  if (!secret) return { ok: false, code: 503, error: 'BOT_SECRET belum diisi.' };
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
  try {
    const r = await fetch(b.base + path, {
      method,
      headers: Object.assign({ 'content-type': 'application/json', 'x-internal-key': secret, 'x-bot-secret': secret }, headers || {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    let j = {}; try { j = await r.json(); } catch (e) { /* bukan JSON */ }
    if (!r.ok) {
      const why = r.status === 404 && !j.error ? 'Endpoint broadcast belum ada di bot. Pasang file bot terbaru (tamako-internal-api.js) lalu restart bot.'
        : r.status === 401 || r.status === 403 ? 'Bot menolak kunci (BOT_SECRET harus sama dengan BOT_INTERNAL_API_KEY di bot).'
        : j.error ? String(j.error).slice(0, 200) : 'Bot membalas ' + r.status + '.';
      return { ok: false, code: r.status === 409 ? 409 : 502, error: why };
    }
    return { ok: true, data: j };
  } catch (e) {
    return { ok: false, code: 502, error: notify.why(e) };
  } finally { clearTimeout(t); }
}

module.exports = {
  groups: () => call('GET', '/api/broadcast/groups', null, null, 25000),
  send: (payload, key) => call('POST', '/api/broadcast/send', payload, { 'x-idempotency-key': key }, 30000),
  status: (id) => call('GET', '/api/broadcast/status?id=' + encodeURIComponent(id)),
  stop: (id) => call('POST', '/api/broadcast/stop', { id })
};
