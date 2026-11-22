// Pembayaran role lewat Meldapay (QRIS). Tagihan dibuat di server, role diaktifkan otomatis setelah Meldapay melapor "paid".
// Redis:
//   mt:pay:orders     (hash)  invoice_id -> JSON pesanan { id, sub, email, name, plan, amount, fee, total, qris, link, expiredAt, status, ts, ... }
//   mt:pay:ul:<sub>   (list)  invoice_id terbaru milik pengguna (maks. 10)
// status pesanan: pending -> paid (sedang diterapkan) -> done | refused (dibayar tapi role ditolak, perlu ditangani developer)
//                 pending -> expired | cancelled
// Kunci keamanan: webhook TIDAK dipercaya begitu saja. Setiap klaim "paid" dicek ulang ke API Meldapay memakai API key rahasia kita.
const crypto = require('crypto');
const R = require('./_redis');
const redeem = require('./_redeem');
const store = require('./_store');
const { roleActive } = require('./_auth');

const OKEY = 'mt:pay:orders', ULIST = (s) => 'mt:pay:ul:' + s;
const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const FINAL = new Set(['done', 'expired', 'cancelled', 'refused']);
const LEASE_MS = 45000;

const apiKey = () => process.env.MELDAPAY_APIKEY || '';
const base = () => (process.env.MELDAPAY_BASE_URL || 'https://meldapay.com').trim().replace(/\/+$/, '');
const configured = () => !!apiKey();

// ---- klien Meldapay (API key dikirim lewat query sesuai dokumentasi; jangan pernah mencatat URL-nya) ----
async function mp(method, path, params, ms = 12000) {
  const key = apiKey();
  if (!key) return { ok: false, code: 503, error: 'MELDAPAY_APIKEY belum diisi di Vercel.' };
  const qs = new URLSearchParams({ apikey: key, ...params }).toString();
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(base() + path + '?' + qs, { method, headers: { accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' });
    let j = {}; try { j = await r.json(); } catch (e) { /* bukan JSON */ }
    return { ok: r.ok, code: r.status, j };
  } catch (e) {
    return { ok: false, code: 502, error: e && e.name === 'AbortError' ? 'Meldapay tidak menjawab (timeout).' : 'Meldapay tidak terjangkau.' };
  } finally { clearTimeout(t); }
}
const createInvoice = (amount) => mp('GET', '/api/invoice', { amount: String(amount) });
const invoiceStatus = (id, ms) => mp('GET', '/api/invoice/status', { invoice_id: id }, ms);
const cancelInvoice = (id) => mp('POST', '/api/invoice/cancel', { invoice_id: id }, 8000);

// ---- tanda tangan webhook: HMAC-SHA256 dari body mentah, hex huruf kecil, dibandingkan constant-time ----
function verifySig(raw, sig, secret) {
  if (!secret || !sig) return false;
  const want = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(String(sig).trim().toLowerCase()), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Body mentah persis seperti dikirim Meldapay. Urutan: rawBody -> stream -> body string/Buffer -> JSON.stringify (cadangan, bisa beda spasi).
async function rawBody(req) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return Buffer.from(req.rawBody);
  if (typeof req.on === 'function' && req.readable && !req.readableEnded && !req.complete) {
    try {
      const chunks = []; let n = 0;
      await new Promise((ok, no) => {
        const t = setTimeout(() => no(new Error('timeout baca body')), 3000);
        req.on('data', (c) => { n += c.length; if (n > 65536) { clearTimeout(t); no(new Error('body terlalu besar')); } else chunks.push(c); });
        req.on('end', () => { clearTimeout(t); ok(); }); req.on('error', (e) => { clearTimeout(t); no(e); });
      });
      if (chunks.length) return Buffer.concat(chunks);
    } catch (e) { /* jatuh ke cadangan */ }
  }
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  return Buffer.alloc(0);
}

// ---- pesanan ----
const CAS = "local c=redis.call('HGET',KEYS[1],ARGV[1]); if (c or '')==ARGV[2] then redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); return 1 end; return 0";
async function getOrder(id) {
  if (!ID_RE.test(String(id || ''))) return null;
  const [raw] = await R.run([['HGET', OKEY, id]]);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
// fn(order) -> order baru, atau null = jangan tulis. Compare-and-set, diulang bila bentrok. Mengembalikan order tersimpan (atau null).
async function mutateOrder(id, fn, tries = 10) {
  for (let i = 0; i < tries; i++) {
    const [raw] = await R.run([['HGET', OKEY, id]]);
    if (!raw) return null;
    const next = fn(JSON.parse(raw));
    if (next == null) return null;
    const [ok] = await R.run([['EVAL', CAS, 1, OKEY, id, raw, JSON.stringify(next)]]);
    if (ok === 1) return next;
    await new Promise((r) => setTimeout(r, Math.random() * 30 * (i + 1)));
  }
  throw new Error('bentrok saat menyimpan pesanan');
}
async function saveNew(o) {
  const [ok] = await R.run([['HSETNX', OKEY, o.id, JSON.stringify(o)]]);
  if (ok !== 1) return false;
  await R.run([['LPUSH', ULIST(o.sub), o.id], ['LTRIM', ULIST(o.sub), 0, 9]]);
  return true;
}
async function ordersOf(sub) {
  const [ids] = await R.run([['LRANGE', ULIST(sub), 0, 9]]);
  if (!ids || !ids.length) return [];
  const [arr] = await R.run([['HMGET', OKEY, ...ids]]);
  return (arr || []).map((x) => { try { return x ? JSON.parse(x) : null; } catch (e) { return null; } }).filter(Boolean);
}
// Data yang boleh dilihat pengguna.
const view = (o) => ({ id: o.id, status: o.status, plan: o.plan, amount: o.amount, fee: o.fee, total: o.total, qris: o.qris, link: o.link, ts: o.ts, note: o.status === 'refused' ? 'Pembayaran diterima tetapi role belum bisa diaktifkan otomatis. Hubungi developer dengan menyebut ID tagihan ini.' : undefined });

// ---- terapkan paket ke data pengguna (rec diubah langsung). Teks alasan bila ditolak, null bila berhasil ----
function applyPlan(rec, plan, now = Date.now()) {
  const cur = roleActive(rec, now) ? rec.role : 'member';
  if (cur === 'owner') return 'Role OWNER sudah punya limit tak terbatas, tidak perlu membeli role lagi.';
  if (plan.role === 'owner') { rec.role = 'owner'; delete rec.roleUntil; delete rec.crMax; delete rec.cr; delete rec.crBonus; return null; }
  return redeem.apply(rec, { role: plan.role, days: plan.days, credit: plan.credit }, now, roleActive);
}

// ---- selesaikan pesanan yang sudah dibayar (aman dipanggil berulang dan bersamaan: hanya satu pemenang) ----
async function fulfill(id, alog) {
  const now = Date.now();
  let won = false;
  const o = await mutateOrder(id, (x) => {
    if (x.status === 'pending') { won = true; return { ...x, status: 'paid', paidAt: now, lease: now }; }
    if (x.status === 'paid' && now - (x.lease || x.paidAt || 0) > LEASE_MS) { won = true; return { ...x, lease: now }; } // penerap sebelumnya mati di tengah jalan: ambil alih
    return null;
  });
  if (!won) return o || await getOrder(id);
  let state = 'applied', why = '';
  try {
    await store.mutateUser(o.sub, (r) => {
      r = r || { firstSeen: now, logins: 0, email: o.email, name: o.name };
      r.po = Array.isArray(r.po) ? r.po : [];
      if (r.po.includes(o.id)) { state = 'dup'; return null; } // sudah pernah diterapkan (idempoten)
      why = applyPlan(r, o.plan, now);
      if (why) { state = 'refused'; return null; }
      r.po.push(o.id); if (r.po.length > 20) r.po = r.po.slice(-20);
      return r;
    });
  } catch (e) { throw e; } // tetap 'paid' + lease: percobaan berikutnya mengambil alih setelah LEASE_MS
  const final = await mutateOrder(id, (x) => ({ ...x, status: state === 'refused' ? 'refused' : 'done', doneAt: Date.now(), why: why || undefined }));
  const d = o.plan.role.toUpperCase() + (o.plan.role === 'owner' ? ' permanen' : ' ' + o.plan.days + ' hari');
  if (alog) await alog.add({ by: 'meldapay', act: 'bayar', sub: o.sub, email: o.email, name: o.name, detail: state === 'refused' ? 'DIBAYAR TAPI GAGAL DITERAPKAN (' + why + ') ' + d + ', Rp' + o.total + ', invoice ' + o.id : d + ', Rp' + o.total + ' (paket ' + o.plan.id + '), invoice ' + o.id + (state === 'dup' ? ' (sudah diterapkan sebelumnya)' : '') });
  if (state !== 'refused') await R.run([['INCR', 'mt:chat:ver']]).catch(() => {}); // Global Chat memuat ulang badge/role baru
  return final;
}

// ---- cocokkan pesanan dengan status asli di Meldapay, lalu selesaikan bila sudah dibayar ----
const lastCheck = new Map();
async function sync(id, alog, opts = {}) {
  let o = await getOrder(id);
  if (!o || (FINAL.has(o.status) && o.status !== 'refused')) return o;
  if (o.status === 'refused') return o;
  if (o.status === 'paid') return fulfill(id, alog); // sudah dibayar, tinggal diterapkan (atau diambil alih)
  const t = lastCheck.get(id) || 0;
  if (!opts.force && Date.now() - t < 2500) return o; // jangan membanjiri Meldapay saat polling
  lastCheck.set(id, Date.now()); if (lastCheck.size > 500) lastCheck.clear();
  const r = await invoiceStatus(id, opts.timeout);
  if (!r.ok) { const e = new Error(r.error || ('Meldapay membalas ' + r.code)); e.soft = true; throw e; }
  const st = String(r.j && r.j.status || '').toLowerCase();
  if (st === 'paid') {
    const amt = Number(r.j.amount);
    if (Number.isFinite(amt) && amt !== o.amount) { const e = new Error('nominal tagihan tidak cocok (' + amt + ' vs ' + o.amount + ')'); e.mismatch = true; throw e; }
    return fulfill(id, alog);
  }
  if (st === 'expired' || st === 'cancelled') return (await mutateOrder(id, (x) => (x.status === 'pending' ? { ...x, status: st } : null))) || await getOrder(id);
  return o;
}

module.exports = { lastCheck, configured, createInvoice, invoiceStatus, cancelInvoice, verifySig, rawBody, getOrder, mutateOrder, saveNew, ordersOf, view, applyPlan, fulfill, sync, ID_RE, FINAL };
