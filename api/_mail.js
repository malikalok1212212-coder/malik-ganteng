// Pengiriman email lewat SMTP (nodemailer). Atur SMTP_* di Environment Variables Vercel.
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { /* belum terpasang */ }

const ready = () => !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let tx = null;
function transport() {
  if (tx) return tx;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === '1' : port === 465;
  tx = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
  });
  return tx;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Email berisi kode 6 digit (verifikasi pendaftaran / reset kata sandi).
async function sendCode(to, code, purpose) {
  if (!ready()) throw new Error('SMTP belum diatur di server.');
  const app = process.env.APP_NAME || 'Malik Tools';
  const title = purpose === 'reset' ? 'Atur ulang kata sandi' : 'Verifikasi email';
  const lead = purpose === 'reset' ? 'Pakai kode ini untuk mengatur ulang kata sandi akunmu.' : 'Pakai kode ini untuk menyelesaikan pendaftaran akunmu.';
  const from = process.env.SMTP_FROM || ('"' + app + '" <' + process.env.SMTP_USER + '>');
  await transport().sendMail({
    from, to,
    subject: code + ' adalah kode ' + app + ' kamu',
    text: title + '\n\n' + lead + '\nKode: ' + code + '\nBerlaku 10 menit. Abaikan email ini jika bukan kamu yang meminta.',
    html: '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:3px solid #07100b;border-radius:16px">' +
      '<h2 style="margin:0 0 8px">' + esc(title) + '</h2><p style="color:#516a5c;margin:0 0 16px">' + esc(lead) + '</p>' +
      '<div style="font:700 32px monospace;letter-spacing:8px;background:#eaf2ed;border-radius:12px;padding:14px;text-align:center">' + esc(code) + '</div>' +
      '<p style="color:#516a5c;font-size:13px;margin:16px 0 0">Berlaku 10 menit. Abaikan email ini jika bukan kamu yang meminta.</p></div>'
  });
}

module.exports = { ready, sendCode };
