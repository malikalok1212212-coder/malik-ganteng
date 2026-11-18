# Malik Tools

Website tools (TikTok Downloader, link WhatsApp) siap deploy di Vercel. Provider: **GenCipta** (api.gencipta.com). Semua tool Nexa sudah dihapus.

## Deploy
1. Upload isi folder ini ke GitHub, lalu Import di Vercel (Framework: Other, tanpa build command).
2. Settings → Environment Variables: isi `GENCIPTA_API_KEY` (lihat `.env.example`).
3. Deploy.

## Penting
Endpoint mengikuti dokumentasi GenCipta: `GET https://gateway.gencipta.com/api/downloader/tiktok?url=`. API key dikirim lewat header `Authorization: Bearer` dan hanya ada di server, tidak pernah ke browser. Isi `ACCESS_CODE` bila halaman tidak boleh dipakai publik.

## Tambah tool
- Server: tambah entri di `api/_config.js` → `tools` (beri `gc: true`, `base`, `path`, `param`, dan `shape` untuk membaca balasan; tambah fungsi pembaca di `api/tool.js` bila format balasannya baru).
- Tampilan: tambah objek di array `tools` pada `public/index.html`.

## Unggah foto
File foto sampai 50 MB diterima. Karena batas body fungsi Vercel 4,5 MB, foto di atas 4 MB dikecilkan otomatis di browser (maks. 3000 px, JPG) sebelum diunggah.

## Halaman tambahan
Changelog, Feedback, Stats, dan Profil ada di `public/index.html`. `CONTACT_WA` (di `public/index.html`) sudah diisi 6285772295147; dipakai untuk tombol Feedback dan Chat Developer. Entri changelog ada di array `CHANGELOG`. Stats dan Profil disimpan di browser tiap perangkat (localStorage).

## Sistem Developer
1. Isi `DEVELOPER_EMAILS` (email Google kamu, pisahkan koma bila lebih dari satu), pastikan Login Google dan Vercel Blob sudah aktif, lalu redeploy. `OWNER_EMAILS` lama tetap dibaca, jadi deploy yang sudah jalan tidak perlu diubah.
2. Masuk lewat Profil. Menu **Developer** muncul di menu samping.
3. Yang bisa dilakukan developer: melihat semua pengguna yang pernah login (jumlah masuk, terakhir aktif), mengirim peringatan (tampil sebagai popup sampai pengguna menekan "Saya mengerti"), memblokir atau membuka blokir, menghapus pengguna dari daftar, dan mengatur role pengguna. (Fitur tambah tool kustom dari panel sudah dihapus; tool baru ditambah lewat kode.)
4. Data developer disimpan di Upstash Redis (satu entri per pengguna/tool). Data lama di Vercel Blob diimpor otomatis sekali; `SESSION_SECRET` tetap dibutuhkan untuk impor itu dan untuk sesi, jadi jangan diganti. Pemblokiran hanya berlaku untuk pengguna yang login.

## Kredit harian
Saat ini semua tool gratis (`CREDIT_TOOLS` di `api/_credits.js` kosong); developer tetap bisa memberi harga per tool lewat panel Tools. Kredit dikembalikan kalau provider gagal. Jatah per 24 jam: **Member 5**, **Premium 15**, **VIP 30**, **Developer tidak memakai kredit sama sekali (tanpa batas, kotak kredit disembunyikan)**. Reset 24 jam dihitung sejak kredit pertama dipakai. AM Premium wajib login karena kredit dicatat per akun (di Upstash Redis bersama data developer, jadi Redis harus aktif; pemotongan kredit atomik). Jatah bisa diubah lewat env `CREDIT_MEMBER`, `CREDIT_PREMIUM`, `CREDIT_VIP`; tool lain yang berkredit diatur di `api/_credits.js` (`CREDIT_TOOLS`).

## Role
Di panel Developer tab Pengguna, tiap pengguna punya pilihan role: **Member** (bawaan semua pengguna), **Premium**, dan **VIP**. Role tampil sebagai badge di Profil dan Family. **Developer** otomatis untuk email di `DEVELOPER_EMAILS` dan tidak bisa diubah dari panel. **Masa aktif role:** saat memilih Premium atau VIP, developer juga memilih durasi (1 hari, 1 minggu, 2 minggu, 1 bulan, atau **Permanen**; bawaan 1 minggu). Waktu habis disimpan di `roleUntil` pada data pengguna. Begitu lewat, `roleOf()` otomatis menganggap pengguna Member (badge dan jatah kredit ikut kembali), tanpa cron. Role lama yang dibuat sebelum fitur ini tidak punya `roleUntil`, jadi tetap permanen. Memberi ulang role menghitung durasi dari sekarang (bukan menambah sisa). Pilih Member untuk mencabut role kapan saja. Masa aktif tampil di panel developer, Profil, dan halaman Beli Role. Saat ini role hanya berupa badge, belum membuka atau membatasi fitur. Badge di pesan chat lama tidak ikut berubah, hanya pesan baru yang memakai role terbaru.

### Nonaktifkan tool sementara
Panel Developer tab **Tools** punya tombol **Nonaktifkan sementara** / **Aktifkan lagi** per tool (mis. saat provider AM Preset error). Tool yang nonaktif tampil dengan label NONAKTIF, halamannya menampilkan pesan gangguan, dan server menolak pemakaiannya (503) untuk semua pengguna kecuali developer, yang tetap bisa menguji. Daftar tersimpan di Upstash Redis (kunci `__off`). Menonaktifkan AM Premium mematikan langkah kirim dan verifikasi sekaligus.

### Paket harga role
Di panel Developer tab **Harga** kamu mengatur paket yang dijual di halaman Beli Role: role (Premium/VIP), masa aktif (hari), harga (Rp), dan **kredit AM Premium per hari**. Contoh: 1 hari, Rp1.000, 5 kredit. Maksimal 12 paket, tersimpan di Upstash Redis (kunci `__plans` di data tool). Tanpa pengaturan, bawaannya Premium 7 hari Rp2.500 (15 kredit) dan VIP 7 hari Rp5.000 (30 kredit). Di tab Pengguna ada pilihan **Paket**: role, masa aktif, dan jatah kredit per hari (`crMax`) diaktifkan sekaligus; jatah itu ikut hilang saat role habis atau diubah manual (kembali ke `CREDIT_*`). Pembayaran tetap manual lewat WhatsApp.

## Kode redeem
Pengguna yang sudah login bisa menukar kode di halaman **Beli Role** atau **Profil** (kotak "Punya kode redeem?") untuk mendapat Premium atau VIP tanpa aktivasi manual. Developer membuat kode di panel Developer tab **Kode**: pilih role, masa aktif (hari, 0 = permanen), kredit AM Premium per hari (0 = jatah bawaan role), batas pemakaian per kode, jumlah kode (1-50 sekaligus), tanggal kedaluwarsa (opsional), catatan, dan kode kustom (opsional, hanya untuk 1 kode). Format otomatis `MT-XXXX-XXXX-XXXX`; huruf besar/kecil dan tanda hubung tidak berpengaruh saat menukar.

Aturan: satu pengguna hanya bisa memakai satu kode **satu kali**; kode berhenti bekerja bila kuota habis, kedaluwarsa, atau dihapus. Role yang sama diperpanjang dari sisa masa aktif (kredit per hari mengikuti nilai terbesar); Premium ke VIP dihitung dari sekarang; pengguna yang sedang VIP tidak bisa memakai kode Premium; role permanen menolak kode role yang sama; akun developer dan akun yang diblokir tidak bisa memakai kode. Percobaan dibatasi 10 kali per 10 menit per akun. Penghapusan kode tidak mencabut role yang sudah diaktifkan. Tombol **Pemakai** di tiap kode menunjukkan siapa saja yang sudah memakainya, dan semua pembuatan, penghapusan, dan penukaran tercatat di tab Log.

Data di Upstash Redis: `mt:redeem:codes` (hash kode), `mt:redeem:used` (hash jumlah pakai, diubah atomik lewat skrip Lua), `mt:redeem:by:KODE` (set pengguna yang sudah memakai). Maksimal 3000 kode tersimpan. Tidak ada env baru dan tidak ada fungsi Vercel baru (aksi `redeem` ada di `api/auth.js`, manajemen kode di `api/admin.js`).

## Pengumuman dan Favorit
Developer bisa memasang pengumuman (maks. 300 karakter) di panel Developer tab Pengumuman. Tampil di beranda dan bisa ditutup per sesi. Pengguna bisa menandai tool favorit dengan ☆, tersimpan di perangkat masing-masing, dan tool favorit naik ke atas daftar.

## Family
Halaman **Family** ada di menu samping. Semua orang bisa membaca, kirim pesan wajib login Google. Nama dan foto Google tampil publik di chat. Ada balas, tag `@nama`, badge role (DEVELOPER, PREMIUM, VIP, MEMBER), jeda 2 detik per pengguna, pengguna yang diblokir tidak bisa kirim, dan developer bisa menghapus pesan. Pesan disimpan (200 terakhir) di Upstash Redis dan dimuat ulang tiap 5 detik.

### Foto dan sticker di chat
Tombol kamera mengirim foto (JPG, PNG, WebP). Foto dikecilkan di browser (maks. 1280 px, JPG) lalu disimpan di Vercel Blob folder `chat/`, jeda 8 detik per pengguna. Foto ikut terhapus dari Blob saat developer menghapus pesannya atau saat pesan lama terpotong dari 200 pesan terakhir. Alamat foto bersifat publik bagi yang punya link. Tombol senyum membuka 30 sticker bawaan (24 emoji dan 6 stiker teks). Untuk menambah sticker, ubah array `STK` di `public/index.html` dan angka `STICKERS` di `api/chat.js`.

## Login Google
1. Buka console.cloud.google.com, pilih atau buat project, lalu isi OAuth consent screen.
2. APIs & Services > Credentials > Create credentials > OAuth client ID > Web application.
3. Authorized JavaScript origins: isi alamat situs (contoh `https://nama-kamu.vercel.app`, plus domain sendiri bila ada). Redirect URI tidak perlu diisi.
4. Di Vercel > Settings > Environment Variables isi `GOOGLE_CLIENT_ID` (Client ID dari langkah 3) dan `SESSION_SECRET` (acak, minimal 32 karakter, mis. hasil `openssl rand -hex 32`), lalu redeploy.
5. Opsional: `ALLOWED_EMAILS` membatasi ke email tertentu.

Selama consent screen berstatus Testing, hanya akun yang didaftarkan sebagai test user yang bisa masuk. Ubah ke Production agar terbuka untuk umum.

## Wajib login + akun username/password + SMTP
Semua orang yang membuka situs harus masuk dulu. Layar login muncul di atas halaman, dan server juga menolak (401) pemakaian tool, unggah foto, dan Family tanpa sesi login. Isi `REQUIRE_LOGIN=0` hanya bila situs ingin dibuka untuk tamu.

Cara masuk: **Google** atau **username + kata sandi**. Daftar akun baru memakai email, lalu kode 6 digit dikirim lewat SMTP dan harus dimasukkan sebelum akun dibuat. Ada juga **Lupa kata sandi** (kode reset lewat email).

### Pengaturan SMTP (Environment Variables Vercel)
`SMTP_HOST`, `SMTP_PORT` (465 SSL atau 587 STARTTLS), `SMTP_USER`, `SMTP_PASS`, opsional `SMTP_FROM`, `SMTP_SECURE`, `APP_NAME`. Untuk Gmail pakai App Password (bukan kata sandi biasa) dengan host `smtp.gmail.com`, port 465. Setelah mengisi, redeploy dan jalankan `npm install` (dependensi baru: `nodemailer`).

### Catatan keamanan
- Kata sandi disimpan sebagai hash scrypt + salt acak, bukan teks asli. Akun disimpan di Upstash Redis, seperti data developer.
- Kode berlaku 10 menit, maksimal 5 kali salah, kirim ulang minimal jeda 1 menit. Akun dikunci 10 menit setelah 8 kali salah kata sandi.
- Respons Lupa kata sandi sama untuk email terdaftar maupun tidak, agar email tidak bisa ditebak.
- Pengguna username/password muncul di panel Developer, bisa diblokir, diberi peringatan, dan diberi role seperti pengguna Google.
- Penyimpanan akun memakai file JSON tunggal. Untuk ribuan pengguna sebaiknya pindah ke database (Redis/Postgres).


## Notifikasi tool baru ke bot WhatsApp
Saat Developer menambah tool kustom, server mengirim pengumuman ke bot WhatsApp (POST `/api/channel/new-tool`, header `x-internal-key`). Isi di Vercel:
- `BOT_WEBHOOK_URL`: alamat publik API internal bot, contoh `https://bot.cloudstore.my.id`
- `BOT_SECRET`: sama dengan `BOT_INTERNAL_API_KEY` di `.env` bot
- `BOT_WEBHOOK_PATH` (opsional): bawaan `/api/channel/new-tool`

Hanya id, nama, deskripsi, kategori, dan tipe tool yang dikirim. Gagal kirim tidak membatalkan simpan tool; sistem mencoba ulang sekali. Bila tetap gagal, panel menampilkan alasannya, dan menonaktifkan lalu mengaktifkan kembali tool tersebut akan mengirim ulang pengumuman (hanya untuk tool yang belum pernah berhasil diumumkan).

## Upstash Redis dan pembersihan foto

1. Vercel → Storage/Marketplace → Upstash Redis → Create, lalu Connect ke project (otomatis mengisi `KV_REST_API_URL` dan `KV_REST_API_TOKEN`).
2. Isi `CRON_SECRET` (acak). Cron harian `/api/cleanup` (03.00 UTC) menghapus foto di `uploads/` yang lebih tua dari 2 jam dan tidak terhapus oleh tool.
3. Pembatas laju (login, tool, unggah, jeda chat) kini memakai Redis, jadi berlaku lintas instance. Tanpa Redis ia jatuh ke memori.
4. Redeploy. Saat pertama kali dibuka, data lama di Blob (state/akun/chat) diimpor otomatis tanpa menimpa data yang sudah ada di Redis. Blob tetap dipakai untuk foto.

## Jalur cadangan dan pesan error provider
- Balasan HTML dari provider (halaman Cloudflare "Just a moment...", 503, dll) tidak lagi tampil mentah. Pengguna melihat pesan singkat yang jelas.
- Kegagalan sementara provider (HTTP 5xx, koneksi putus) diulang otomatis untuk tool yang aman diulang (IQC Dark, Fake Call) lewat `retries` di `api/_config.js`. Tool yang berefek samping (kirim email, buat token) tidak diulang.
- Total waktu satu permintaan dijaga di bawah 57 detik (`maxDuration` `api/tool.js` di `vercel.json` = 60 detik).


## Panel Developer: statistik, filter, kredit, log, cadangan
- **Kartu ringkasan:** Pengguna, Aktif hari ini, Baru hari ini, Role habis ≤3 hari, Diperingati, Diblokir. Hari dihitung WIB. "Aktif" memakai `lastSeen`, yang kini diperbarui paling sering tiap 30 menit saat pengguna membuka situs (sebelumnya hanya saat login).
- **Tab Statistik (global):** pemakaian tool hari ini / 7 hari, berhasil vs gagal, pengguna aktif per hari, dan penanda **BERMASALAH** (hari ini gagal ≥3 kali dan ≥30%) atau **PERLU DICEK** (≥2 kali dan ≥15%) beserta pesan gagal terakhir. "Gagal" hanya gangguan provider (timeout, 5xx, koneksi); input salah tidak dihitung. Pemakaian developer tidak dihitung. Data di Redis (`mt:stat:*`), disimpan 40 hari.
- **Role habis:** di tab Pengguna ada chip **Habis ≤3 hari** dan **Baru habis** (14 hari terakhir), diurutkan dari yang paling mendesak. Kartu pengguna menampilkan sisa/lewat hari untuk menawarkan perpanjangan.
- **Filter pengguna:** cari, Role, Status (diblokir/diperingati/normal), Terakhir aktif (hari ini, 7, 30, >30 hari), dan Reset filter.
- **Kredit:** tombol **+ Kredit** (bonus 1-999, dipakai lebih dulu, tidak ikut reset 24 jam, dikembalikan bila provider gagal) dan **Reset kredit** (pemakaian 24 jam jadi nol). Sisa kredit tampil di kartu pengguna.
- **Log aktivitas:** tab Log dan tombol **Riwayat** per pengguna. Mencatat role (plus paket dan harga), kredit, blokir, peringatan, hapus pengguna, harga/paket/tool nonaktif, pengumuman, serta mute dan hapus pesan chat. 1000 catatan terakhir (`mt:log`).
- **Moderasi Family:** hapus pesan, sematkan (maks. 3), dan mute sementara ada di menu pesan di halaman Family (bukan di panel Developer). Mute kini minta durasi (1-10080 menit) dan bisa dicabut dari menu yang sama.
- **Pengumuman:** kolom **Mulai tampil**, **Berakhir otomatis**, dan **Tampilkan ke** role tertentu (kosong = semua). Dicek di server saat halaman dimuat; developer tetap melihat semuanya di panel, lengkap dengan status.
- **Cadangan:** tab Cadangan mengunduh pengguna (CSV) dan cadangan lengkap (JSON: pengguna, paket, harga, tool nonaktif, pengumuman, log). Kata sandi akun dan foto tidak ikut. Belum ada fitur impor.
