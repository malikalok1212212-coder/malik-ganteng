// Pemeriksa teks Saluran WhatsApp sebelum dikirim. Filter otomatis WhatsApp pernah salah menilai pesan info
// (contoh emoji wajah genit + daftar level/biaya) sebagai "Adult sexual solicitation". Fungsi ini hanya memberi peringatan.
const EMOJI_RISK = /[\u{1F633}\u{1F61C}\u{1F92A}\u{1F60F}\u{1F618}\u{1F970}\u{1F975}\u{1F979}\u{1F608}\u{1F346}\u{1F351}\u{1F4A6}\u{1F445}\u{1F48B}\u{1F51E}]/gu;
const WORD_RISK = /\b(sex|seks|bokep|open bo|bo\s?an|esek|ngentot|colmek|hot|panas|vcs|pap|nude|telanjang|18\+|dewasa)\b/i;

function check(text) {
  const t = String(text || '');
  const issues = [];
  const em = t.match(EMOJI_RISK);
  if (em) issues.push('emoji berisiko (' + Array.from(new Set(em)).join(' ') + '): ganti dengan 👍 ❤️ 🔥 😂');
  if (WORD_RISK.test(t)) issues.push('kata berisiko: ' + t.match(WORD_RISK)[0]);
  return issues;
}
module.exports = { check };
