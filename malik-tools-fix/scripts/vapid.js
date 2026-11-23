// Buat pasangan kunci VAPID untuk Web Push: node scripts/vapid.js
// Salin hasilnya ke Environment Variables Vercel (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT), lalu redeploy.
const c = require('crypto'), e = c.createECDH('prime256v1'); e.generateKeys();
console.log('VAPID_PUBLIC_KEY=' + e.getPublicKey().toString('base64url'));
console.log('VAPID_PRIVATE_KEY=' + e.getPrivateKey().toString('base64url'));
console.log('VAPID_SUBJECT=mailto:emailkamu@contoh.com');
console.log('\nJangan bagikan VAPID_PRIVATE_KEY. Mengganti kunci membuat semua langganan lama tidak berlaku (pengguna perlu mengaktifkan ulang).');
