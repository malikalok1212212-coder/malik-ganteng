// Koin pengguna. Ada dua sumber:
//   1) Jatah gratis (`fd` = sisa jatah, `fr` = waktu reset): akun mendapat jatah awal COIN_FREE_START koin (bawaan 5).
//      Jatah dipakai lebih dulu. Selama jatah MASIH ADA tidak ada reset dan tidak ada penambahan (tidak menumpuk).
//      Begitu jatah habis, hitung mundur 24 jam dimulai; setelah itu jatah diisi COIN_FREE_RESET koin (bawaan 3), dan seterusnya
//      (habis -> tunggu 24 jam -> 3 koin). Akun developer/owner tanpa batas.
//   2) Saldo koin (`coin`): hasil beli / kode redeem / kompensasi developer. TIDAK reset dan TIDAK hangus; baru dipakai setelah jatah gratis habis.
// Hanya tool di CREDIT_TOOLS (atau yang diberi harga developer di panel Tools) yang memakai koin; tool lain gratis.
// Koin awal sekali pakai (COIN_START) bawaan 0 karena sudah diganti jatah awal; isi angka bila ingin bonus tambahan untuk akun baru.
// Data lama dari sistem limit harian: sisa "limit bonus" (crBonus) otomatis dihitung sebagai koin saat saldo pertama kali dibuat.
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };
const START = num(process.env.COIN_START, 0);
const FREE_START = num(process.env.COIN_FREE_START, 5); // jatah gratis awal (sekali, belum pernah habis)
const FREE_RESET = num(process.env.COIN_FREE_RESET, 3); // isi ulang setelah jatah habis dan 24 jam berlalu
const WINDOW = 24 * 60 * 60 * 1000;
const MAXC = 10000000; // batas saldo, mencegah angka tak wajar
// Dipotong saat verifikasi AM Generator / AM Prem V2 (langkah 2) berhasil dan saat Reaksi Channel terkirim. Tool lain gratis. Developer bisa mengatur harga lewat panel Tools.
const CREDIT_TOOLS = { 'am-verif': 1, 'am-verif2': 1, 'rch': 3, 'rch2': 3, 'rch3': 3 };
// Harga tool (dalam koin): bawaan dari CREDIT_TOOLS (hanya kunci miliknya sendiri), tool kustom dari field `credit` yang diisi developer.
const cost = (id, custom) => {
  if (custom) { const n = parseInt(custom.credit, 10); return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 1; }
  return Object.prototype.hasOwnProperty.call(CREDIT_TOOLS, id) ? CREDIT_TOOLS[id] : 0;
};

// Saldo koin yang dibeli / didapat (di luar jatah gratis).
const balanceOf = (rec) => (rec && Number.isFinite(rec.coin) ? Math.max(0, Math.floor(rec.coin)) : START + (rec && rec.crBonus > 0 ? Math.floor(rec.crBonus) : 0));
// Buat saldo tersimpan (sekali) dan buang sisa data sistem limit harian.
function seed(rec) { rec.coin = balanceOf(rec); delete rec.cr; delete rec.crBonus; delete rec.crMax; return rec.coin; }

// Jatah gratis saat ini: { left, resetAt }.
//  - belum pernah memakai jatah: FREE_START
//  - jatah masih ada: sisanya (tidak ada reset, tidak ada tambahan)
//  - jatah habis dan 24 jam belum lewat: 0, dengan resetAt = waktu isi ulang
//  - jatah habis dan 24 jam sudah lewat: FREE_RESET (diterapkan sungguhan saat koin dipakai berikutnya)
function freeOf(rec, now = Date.now()) {
  if (!rec || !Number.isFinite(rec.fd)) return { left: FREE_START, resetAt: null };
  const fd = Math.max(0, Math.floor(rec.fd));
  if (fd > 0) return { left: fd, resetAt: null };
  if (!Number.isFinite(rec.fr) || now >= rec.fr) return { left: FREE_RESET, resetAt: null };
  return { left: 0, resetAt: rec.fr };
}

// rec = data pengguna di state developer; role dari roleOf(). Bentuk balasan:
// { unlimited, coins (saldo beli), free (jatah gratis saat ini), refill (jumlah isi ulang berikutnya), left (free + coins), resetAt (ms, null bila jatah masih ada) }.
// `left` = total koin yang bisa dipakai sekarang (pemeriksaan di tool.js memakai ini).
function info(rec, role, now = Date.now()) {
  if (role === 'developer' || role === 'owner') return { unlimited: true, coins: null, free: null, refill: null, left: null, max: null, resetAt: null }; // developer & owner: tanpa batas
  const b = balanceOf(rec), f = freeOf(rec, now);
  return { unlimited: false, coins: b, free: f.left, refill: FREE_RESET, left: b + f.left, max: null, resetAt: f.resetAt };
}

// Potong n koin (pemanggil sudah memastikan total cukup): jatah gratis lebih dulu, sisanya dari saldo.
// Mengembalikan jumlah yang diambil dari jatah gratis (dioper ke refund() bila provider gagal).
function charge(rec, n = 1, now = Date.now()) {
  const b = seed(rec);
  let fd = freeOf(rec, now).left; // jatah efektif (termasuk isi ulang yang sudah jatuh tempo)
  const take = Math.min(Math.max(0, n), fd);
  fd -= take;
  rec.fd = fd;
  if (fd > 0) delete rec.fr; // masih ada: tidak ada hitung mundur
  else if (take > 0) rec.fr = now + WINDOW; // baru saja habis: mulai hitung mundur 24 jam
  rec.coin = Math.max(0, b - (n - take));
  return take;
}
// Kembalikan koin yang sudah dipotong bila provider gagal. fromFree = bagian yang tadi diambil dari jatah gratis: kembali ke jatah
// (hitung mundur dibatalkan karena jatah ada lagi); sisanya kembali ke saldo.
function refund(rec, n = 1, now = Date.now(), fromFree = 0) {
  if (!rec || !(n > 0)) return;
  const b = seed(rec);
  const f = Math.min(n, Math.max(0, Math.floor(Number(fromFree)) || 0));
  if (f > 0) {
    rec.fd = Math.min(Math.max(FREE_START, FREE_RESET), (Number.isFinite(rec.fd) ? Math.max(0, Math.floor(rec.fd)) : 0) + f);
    if (rec.fd > 0) delete rec.fr;
  }
  rec.coin = Math.min(MAXC, b + (n - f));
}
// Tambah koin ke saldo (pembelian, kode redeem, kompensasi developer). Tidak menyentuh jatah gratis.
function add(rec, n) { const b = seed(rec); rec.coin = Math.min(MAXC, b + Math.max(0, Math.floor(Number(n)) || 0)); return rec.coin; }
// Atur saldo persis (developer). Hanya saldo; jatah gratis tidak diubah.
function set(rec, n) { seed(rec); rec.coin = Math.max(0, Math.min(MAXC, Math.floor(Number(n)) || 0)); return rec.coin; }

module.exports = { START, FREE_START, FREE_RESET, WINDOW, MAXC, cost, info, charge, refund, add, set, balanceOf };
