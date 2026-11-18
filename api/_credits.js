// Kredit harian per pengguna. Hanya tool di CREDIT_TOOLS yang memakai kredit; tool lain gratis.
// Jatah per role bisa diubah lewat env: CREDIT_MEMBER, CREDIT_PREMIUM, CREDIT_VIP.
// Reset 24 jam dihitung sejak kredit pertama dipakai (bukan jam 00.00).
const DAY = 24 * 60 * 60 * 1000;
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };
const LIMITS = {
  member: num(process.env.CREDIT_MEMBER, 5),
  premium: num(process.env.CREDIT_PREMIUM, 15),
  vip: num(process.env.CREDIT_VIP, 30)
};
// Dipotong saat verifikasi AM Generator (langkah 2) berhasil. Tool lain gratis. Developer bisa mengatur harga lewat panel Tools.
const CREDIT_TOOLS = { 'am-verif': 1 };
// Harga tool: bawaan dari CREDIT_TOOLS (hanya kunci miliknya sendiri), tool kustom dari field `credit` yang diisi developer.
const cost = (id, custom) => {
  if (custom) { const n = parseInt(custom.credit, 10); return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 1; }
  return Object.prototype.hasOwnProperty.call(CREDIT_TOOLS, id) ? CREDIT_TOOLS[id] : 0;
};

// rec = data pengguna di state developer; role dari roleOf().
function info(rec, role, now = Date.now()) {
  if (role === 'developer') return { unlimited: true, left: null, max: null, resetAt: null };
  let max = LIMITS[role] !== undefined ? LIMITS[role] : LIMITS.member;
  if (role !== 'member' && rec && rec.crMax > 0) max = rec.crMax; // jatah per hari dari paket yang dibeli (diatur developer)
  const c = rec && rec.cr;
  const active = !!(c && c.at > now);
  const used = active ? c.used : 0;
  const bonus = rec && rec.crBonus > 0 ? rec.crBonus : 0; // kredit tambahan dari developer (kompensasi), tidak ikut reset 24 jam
  return { unlimited: false, max: max + bonus, left: Math.max(0, max - used) + bonus, bonus, resetAt: active && used > 0 ? c.at : null };
}

// Kredit bonus dipakai lebih dulu. Mengembalikan jumlah yang diambil dari bonus (untuk refund yang tepat).
function charge(rec, n = 1, now = Date.now()) {
  const fromBonus = Math.min(rec.crBonus > 0 ? rec.crBonus : 0, n);
  if (fromBonus) { rec.crBonus -= fromBonus; if (rec.crBonus <= 0) delete rec.crBonus; }
  n -= fromBonus;
  if (n > 0) { const c = rec.cr; if (c && c.at > now) c.used += n; else rec.cr = { used: n, at: now + DAY }; }
  return fromBonus;
}

// Kembalikan kredit yang sudah dipesan bila provider gagal. Jendela 24 jam yang sudah lewat tidak dikembalikan (sudah reset sendiri).
function refund(rec, n = 1, now = Date.now(), fromBonus = 0) {
  if (rec && fromBonus > 0) { rec.crBonus = (rec.crBonus || 0) + fromBonus; n -= fromBonus; }
  const c = rec && rec.cr;
  if (n <= 0 || !c || c.at <= now) return;
  c.used = Math.max(0, c.used - n);
  if (c.used === 0) delete rec.cr; // tanpa pemakaian, hitung mundur 24 jam ikut batal
}

module.exports = { LIMITS, cost, info, charge, refund };
