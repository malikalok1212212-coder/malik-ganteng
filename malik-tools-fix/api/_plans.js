// Paket role yang dijual (diatur developer): { id, role: premium|vip|owner, days, price (Rp), credit (limit per hari) }.
// Owner: permanen, tanpa limit (days/credit hanya pengisi). Dipakai panel developer (admin.js) dan pembayaran (pay.js).
const DEFAULT_PLANS = [{ id: 'premium-7', role: 'premium', days: 7, price: 2500, credit: 15 }, { id: 'vip-7', role: 'vip', days: 7, price: 5000, credit: 30 }];
function cleanPlans(a) {
  const out = [], seen = new Set();
  for (const p of Array.isArray(a) ? a : []) {
    if (!p || !['premium', 'vip', 'owner'].includes(p.role)) continue;
    const isO = p.role === 'owner';
    const days = isO ? 3650 : Math.floor(Number(p.days)), price = Math.floor(Number(p.price)), credit = isO ? 999 : Math.floor(Number(p.credit));
    if (!(days >= 1 && days <= 3650 && price >= 0 && price <= 1e8 && credit >= 1 && credit <= 999)) continue;
    let id = String(p.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || ('p' + out.length);
    while (seen.has(id)) id += 'x';
    seen.add(id); out.push({ id, role: p.role, days, price, credit });
    if (out.length >= 12) break;
  }
  return out;
}
const plansOf = (m) => { const e = m && m.__plans; return e && Array.isArray(e.list) ? cleanPlans(e.list) : DEFAULT_PLANS; };
module.exports = { DEFAULT_PLANS, cleanPlans, plansOf };
