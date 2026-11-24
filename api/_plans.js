// Paket koin yang dijual (diatur developer): { id, coins, price (Rp) }. Dipakai panel developer (admin.js) dan pembayaran (pay.js).
// Bawaan mengikuti daftar harga Nexa React. Paket lama (role/hari/limit) otomatis diabaikan dan diganti paket bawaan ini.
const DEFAULT_PLANS = [
  { id: 'c20', coins: 20, price: 2000 }, { id: 'c50', coins: 50, price: 5000 },
  { id: 'c350', coins: 350, price: 10000 }, { id: 'c500', coins: 500, price: 20000 },
  { id: 'c600', coins: 600, price: 35000 }, { id: 'c700', coins: 700, price: 36000 },
  { id: 'c800', coins: 800, price: 37000 }, { id: 'c900', coins: 900, price: 38000 },
  { id: 'c1000', coins: 1000, price: 39000 }, { id: 'c1500', coins: 1500, price: 42000 }
];
const MAX_PLANS = 20;
function cleanPlans(a) {
  const out = [], seen = new Set();
  for (const p of Array.isArray(a) ? a : []) {
    if (!p) continue;
    const coins = Math.floor(Number(p.coins)), price = Math.floor(Number(p.price));
    if (!(coins >= 1 && coins <= 1000000 && price >= 0 && price <= 1e8)) continue;
    let id = String(p.id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || ('p' + out.length);
    while (seen.has(id)) id += 'x';
    seen.add(id); out.push({ id, coins, price });
    if (out.length >= MAX_PLANS) break;
  }
  return out;
}
const plansOf = (m) => {
  const e = m && m.__plans;
  if (!e || !Array.isArray(e.list)) return DEFAULT_PLANS;
  if (!e.list.length) return []; // developer sengaja mengosongkan daftar paket
  const l = cleanPlans(e.list);
  return l.length ? l : DEFAULT_PLANS; // daftar lama (role/hari/limit) tidak berlaku lagi
};
module.exports = { DEFAULT_PLANS, MAX_PLANS, cleanPlans, plansOf };
