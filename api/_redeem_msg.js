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
    kuota: spec.max <= 1 ? 'Hanya 1 orang' : spec.max + ' orang pertama',
    kedaluwarsa: spec.exp > 0 ? fmtDate(spec.exp) : '',
    catatan: spec.note || '',
    link: SITE + '/#profil'
  };
}

const STYLES = {
  // Ramai dan menarik perhatian, cocok untuk giveaway / grup besar
  hype(f) {
    return [
      '🎁 *KODE REDEEM BARU!* 🎁',
      '',
      'Ada kode ' + f.role + ' gratis dari *Malik Tools* ✨',
      '',
      '🔑 Kode:',
      '```' + f.kode + '```',
      '',
      '👑 Hadiah: *' + f.role + '*',
      '⏳ Masa aktif: *' + f.durasi + '*',
      '⚡ Jatah: *' + f.limit + '*',
      '👥 Kuota: *' + f.kuota + '* (siapa cepat dia dapat)',
      f.kedaluwarsa ? '🕒 Berlaku sampai: *' + f.kedaluwarsa + '*' : null,
      f.catatan ? '📝 ' + f.catatan : null,
      '',
      '📲 *Cara tukar:*',
      '1. Buka ' + SITE,
      '2. Masuk ke akunmu, lalu buka *Profil*',
      '3. Tempel kode di kotak *Punya kode redeem?*',
      '4. Ketuk *Tukar*',
      '',
      '_Satu akun hanya bisa memakai satu kali. Buruan sebelum kehabisan!_ 🚀'
    ];
  },
  // Rapi dan sopan, cocok untuk Saluran resmi
  rapi(f) {
    return [
      '*🎟️ Kode Redeem Malik Tools*',
      '',
      'Halo semuanya! Developer membagikan kode untuk mengaktifkan ' + f.role + ' di akun kamu.',
      '',
      '*Kode*',
      '```' + f.kode + '```',
      '',
      '*Detail*',
      '• Role: ' + f.role,
      '• Masa aktif: ' + f.durasi,
      '• Limit: ' + f.limit,
      '• Kuota: ' + f.kuota,
      f.kedaluwarsa ? '• Berlaku sampai: ' + f.kedaluwarsa : null,
      f.catatan ? '• Catatan: ' + f.catatan : null,
      '',
      '*Cara menukar*',
      'Masuk ke ' + SITE + ', buka Profil, lalu isi kode di kotak "Punya kode redeem?".',
      '',
      '_Satu akun satu kali pakai. Terima kasih sudah memakai Malik Tools._ 🙏'
    ];
  },
  // Pendek, cocok untuk grup yang tidak mau pesan panjang
  singkat(f) {
    return [
      '🎁 *Kode ' + f.role + ' gratis!*',
      '```' + f.kode + '```',
      '⏳ ' + f.durasi + ' · ⚡ ' + f.limit + ' · 👥 ' + f.kuota,
      f.kedaluwarsa ? '🕒 Sampai ' + f.kedaluwarsa : null,
      '',
      'Tukar di ' + SITE + ' (Profil → kode redeem).'
    ];
  }
};

const STYLE_IDS = Object.keys(STYLES);

// custom = teks kustom dari developer (boleh kosong). Penanda yang tidak dikenal dibiarkan apa adanya.
function build(spec, pretty, style, custom) {
  const f = facts(spec, pretty);
  const c = String(custom || '').trim();
  if (c) return c.replace(/\{(kode|role|durasi|limit|kuota|kedaluwarsa|catatan|link)\}/g, (m, k) => f[k]).slice(0, 2000);
  const fn = STYLES[style] || STYLES.hype;
  return fn(f).filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { build, STYLE_IDS, SITE };
