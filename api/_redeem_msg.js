// Teks pengumuman kode redeem untuk Saluran dan grup WhatsApp (format WhatsApp: *tebal*, _miring_, ```monospace```).
// Dipakai admin.js saat developer mencentang "Umumkan otomatis". Teks kustom boleh memakai penanda:
//   {kode} {role} {durasi} {limit} {kuota} {kedaluwarsa} {catatan} {link}
const SITE = (process.env.SITE_URL || 'https://www.maliktools.biz.id').replace(/\/+$/, '');

const TZ = 'Asia/Jakarta';
const fmtDate = (ms) => {
  try {
    return new Date(ms).toLocaleString('id-ID', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\./g, ':') + ' WIB';
  } catch (e) { return new Date(ms).toISOString(); }
};

// Bahan teks dari data kode: semuanya sudah berupa kalimat siap pakai
function facts(spec, pretty) {
  const role = String(spec.role || '').toUpperCase();
  return {
    kode: pretty,
    role,
    durasi: spec.days > 0 ? spec.days + ' hari' : 'Permanen',
    limit: spec.credit > 0 ? spec.credit + ' limit/hari' : 'Limit bawaan ' + role,
    kuota: spec.max <= 1 ? '1 akun' : spec.max + ' akun',
    kedaluwarsa: spec.exp > 0 ? fmtDate(spec.exp) : '',
    catatan: spec.note || '',
    link: SITE + '/#profil'
  };
}

// Catatan: teks sengaja dibuat netral. Hindari kata promosi (gratis, hadiah, giveaway, siapa cepat dia dapat) dan
// tautan di dalam pesan Saluran, karena filter otomatis WhatsApp pernah salah menilainya sebagai "Adult sexual solicitation".
// Nama gaya (hype, rapi, singkat) dipertahankan supaya pengaturan lama tetap jalan; isinya sudah diseragamkan.
const STYLES = {
  // Ringkas dengan sedikit emoji
  hype(f) {
    return [
      '*Kode Redeem Malik Tools*',
      '',
      'Kode baru untuk mengaktifkan ' + f.role + ' di akun kamu.',
      '',
      'Kode:',
      '```' + f.kode + '```',
      '',
      '• Akses: ' + f.role,
      '• Masa aktif: ' + f.durasi,
      '• Limit: ' + f.limit,
      '• Batas pemakaian: ' + f.kuota,
      f.kedaluwarsa ? '• Berlaku sampai: ' + f.kedaluwarsa : null,
      f.catatan ? '• Catatan: ' + f.catatan : null,
      '',
      '*Cara memakai*',
      '1. Buka aplikasi Malik Tools',
      '2. Masuk ke akunmu, lalu buka menu Profil',
      '3. Isi kode di kotak "Punya kode redeem?"',
      '4. Ketuk Tukar',
      '',
      '_Satu akun hanya dapat memakai satu kali._'
    ];
  },
  // Rapi dan sopan, cocok untuk Saluran resmi (gaya bawaan)
  rapi(f) {
    return [
      '*Kode Redeem Malik Tools*',
      '',
      'Developer membagikan kode untuk mengaktifkan ' + f.role + ' di akun kamu.',
      '',
      '*Kode*',
      '```' + f.kode + '```',
      '',
      '*Detail*',
      '• Akses: ' + f.role,
      '• Masa aktif: ' + f.durasi,
      '• Limit: ' + f.limit,
      '• Batas pemakaian: ' + f.kuota,
      f.kedaluwarsa ? '• Berlaku sampai: ' + f.kedaluwarsa : null,
      f.catatan ? '• Catatan: ' + f.catatan : null,
      '',
      '*Cara memakai*',
      'Buka aplikasi Malik Tools, masuk ke menu Profil, lalu isi kode di kotak "Punya kode redeem?".',
      '',
      '_Satu akun hanya dapat memakai satu kali. Terima kasih sudah memakai Malik Tools._'
    ];
  },
  // Pendek, cocok untuk grup yang tidak mau pesan panjang
  singkat(f) {
    return [
      '*Kode ' + f.role + ' Malik Tools*',
      '```' + f.kode + '```',
      f.durasi + ' · ' + f.limit + ' · batas ' + f.kuota,
      f.kedaluwarsa ? 'Sampai ' + f.kedaluwarsa : null,
      '',
      'Cara memakai: menu Profil, isi kotak "Punya kode redeem?".'
    ];
  }
};

const STYLE_IDS = Object.keys(STYLES);

// custom = teks kustom dari developer (boleh kosong). Penanda yang tidak dikenal dibiarkan apa adanya.
function build(spec, pretty, style, custom) {
  const f = facts(spec, pretty);
  const c = String(custom || '').trim();
  if (c) return c.replace(/\{(kode|role|durasi|limit|kuota|kedaluwarsa|catatan|link)\}/g, (m, k) => f[k]).slice(0, 2000);
  const fn = STYLES[style] || STYLES.rapi;
  return fn(f).filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { build, STYLE_IDS, SITE };
