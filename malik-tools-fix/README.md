# Malik Tools

Website tools (TikTok Downloader, link WhatsApp) siap deploy di Vercel. Provider: **GenCipta** (api.gencipta.com). Beberapa tool (Reaksi Channel WhatsApp, jalur cadangan AM Premium) memakai provider **NexaDev** (`NEXADEV_API_KEY`, lihat `.env.example`).

## Deploy
1. Upload isi folder ini ke GitHub, lalu Import di Vercel (Framework: Other, tanpa build command).
2. Settings → Environment Variables: isi `GENCIPTA_API_KEY` (lihat `.env.example`).
3. Deploy.

## Penting
Endpoint mengikuti dokumentasi GenCipta: `GET https://gateway.gencipta.com/api/downloader/tiktok?url=`. API key dikirim lewat header `Authorization: Bearer` dan hanya ada di server, tidak pernah ke browser. Isi `ACCESS_CODE` bila halaman tidak boleh dipakai publik.

## Tambah tool
- Server: tambah entri di `api/_config.js` → `tools` (beri `gc: true`, `base`, `path`, `param`, dan `shape` untuk membaca balasan; tambah fungsi pembaca di `api/tool.js` bila format balasannya baru).
- Tampilan: tambah objek di array `TOOLS_FULL` pada `public/js/tools.js`, lalu jalankan `npm run sync` (menyalin id dan nama tool ke daftar ringkas `TOOL_IDX` di `public/js/core.js`; `npm run check` gagal bila lupa) dan `python3 scripts/build-seo.py`. Ikon dan kategori tetap diisi di `IC`, `META`, dan `CAT` pada `public/js/core.js`.

## Provider api-cloud
Tool dengan `ac: true` di `api/_config.js` memakai api-cloud.my.id (saat ini **IQC Dark**, `GET /canvas/iqcdark?text=`, balasan JSON `{ status, mime, base64 }` dibaca bentuk `cloudimg` di `api/tool.js`). `CLOUDAPI_API_KEY` opsional (kosong = dipanggil tanpa key); bila docs meminta key, isi di Vercel; bila Docs api-cloud memakai nama parameter kunci selain `apikey`, isi `CLOUDAPI_KEY_PARAM`. Status situs mengecek api-cloud terpisah dari GenCipta.

**AM Prem V2** (`GET /premium/amprem5?action=&email=&link=`, plan Pro & Enterprise api-cloud) memakai antarmuka dua langkah yang sama dengan AM Generator (id `am-premium2`, langkah `am-send2` dan `am-verif2`). Langkah 1 mengirim `action` kirim + `email`; langkah 2 mengirim `action` verifikasi + `email` + `link` dan memakai 1 limit harian (`CREDIT_TOOLS['am-verif2']`, harga bisa diatur developer). Nilai `action` bawaan `1` (Kirim link) dan `2` (Verifikasi) sesuai docs, ubah lewat `CLOUDAPI_AMPREM5_ACTION_SEND` / `CLOUDAPI_AMPREM5_ACTION_VERIF` bila docs berubah. Balasan dibaca bentuk `acam` di `api/tool.js` (hanya pesan status, email, dan data paket ringkas; `quota` dan `creator` dibuang). Jalur ini terpisah dari jalur cadangan GenCipta <-> NexaDev AM Generator.

**SW HD** (`GET /tools/swhd?url=&json=`, khusus plan Pro & Enterprise api-cloud; `url` = link gambar) menjernihkan dan memperbesar foto jadi HD. Server tidak mengirim `json` sehingga balasannya "File langsung" (gambar biner, bawaan docs); hasil di atas ±3,2 MB disimpan sementara di Blob (`bigToBlob`) seperti HD Gambar. Opsi JSON base64 (maks. 25 MB) juga terbaca bentuk `cloudimg`. Endpoint ini bisa memproses video juga, tetapi tool SW HD baru menerima gambar. Kunci tetap dari `CLOUDAPI_API_KEY` dan path bisa diganti lewat `CLOUDAPI_PATH_SWHD`.

**Duar Viral** (`GET /maker/duarviral?url=`, `url` = link gambar; foto yang diunggah pengguna otomatis dijadikan link oleh `api/upload.js`) membalas JSON `{ status, creator, result: "data:image/jpeg;base64,...", backgroundRemoved, quota }`. `result` dibaca bentuk `cloudimg` di `api/tool.js` (kini menerima `{ mime, base64 }` maupun `result` data URI); field `quota` dibuang dan tidak dikirim ke browser. **AM Find** (`GET /tools/amfind?url=`, `url` = link video TikTok, termasuk vt.tiktok.com) memindai komentar dan balasan untuk mencari link preset Alight Motion; balasan `{ status, creator, result:{ videoId, video, author, scanned, presets[] }, quota }` dibaca `amFind()` di `api/tool.js`. `presets` kosong berarti tidak ada preset di komentar (bukan error). Contoh uji dari terminal (Duar Viral): `curl -s "https://api-cloud.my.id/maker/duarviral?url=https://contoh.com/foto.jpg"`.

## Unggah foto
File foto sampai 50 MB diterima. Karena batas body fungsi Vercel 4,5 MB, foto di atas 4 MB dikecilkan otomatis di browser (maks. 3000 px, JPG) sebelum diunggah.

## Struktur front-end (modul lazy-load)
`public/index.html` hanya berisi kerangka halaman (sekitar 20 KB). Kodenya dipecah menjadi skrip biasa di `public/js/` yang berbagi satu lingkup global, jadi tidak ada `import`/`export` dan tidak ada langkah build:

| File | Isi | Dimuat |
|---|---|---|
| `core.js` | helper, ikon/kategori (`IC`, `META`, `CAT`), login, beli role, router, beranda, drawer, pengumuman, notifikasi chat, loader | selalu (`defer`) |
| `ui.js` | tombol melayang, dropdown kustom, Coba lagi, banner gangguan, tombol Bagikan | selalu (`defer`) |
| `tools.js` | pembangun tampilan semua tool dan array `TOOLS_FULL` | saat tool dibuka |
| `pages.js` | Changelog, Beli Role, Feedback, Stats, Profil | saat salah satunya dibuka |
| `chat.js` | halaman Global Chat | saat `#chat` dibuka |
| `dev.js` | panel Developer | saat `#owner` dibuka |

- `loadMod(nama)` di `core.js` memuat modul sekali saja dan dipakai `render()` dan `renderPage()`. Modul halaman mengisi `PAGES.<id>` (daftar id ke modul ada di `PAGE_MOD`). Bila unduhan gagal, halaman menampilkan tombol **Coba lagi**.
- Beranda memakai daftar ringkas `TOOL_IDX` (id dan nama) agar `tools.js` tidak perlu diunduh dulu. Setelah halaman selesai dimuat, browser mengunduh `tools.js`, `pages.js`, dan `chat.js` diam-diam saat menganggur (dilewati bila Data Saver atau koneksi 2G), sehingga ketukan berikutnya terasa instan. `dev.js` tidak diunduh lebih awal.
- Menambah modul baru: tambahkan berkas di `public/js/`, daftarkan di `MODS` (dan `PAGE_MOD` bila berupa halaman), lalu pastikan berkasnya mengisi `PAGES.<id>`.
- Nama `const`/`let` tingkat atas harus unik di semua file karena lingkupnya dipakai bersama.

## Halaman tambahan
**Riwayat hasil** (`#riwayat`, kode di `public/js/pages.js`, penangkap di `RH` pada `public/js/core.js`): foto dan video hasil tool dicatat otomatis di perangkat (IndexedDB `mt_riwayat`, maksimal 60 entri terbaru). Yang dicatat: tombol `data-unduh` bertipe foto/video dan hasil foto tool gambar (`.bax`/`.cmp`). Hasil berupa `data:`/`blob:` (maks. 8 MB) disimpan penuh sehingga tetap bisa diunduh setelah tutup tab; hasil berupa tautan luar hanya disimpan alamatnya (bisa kedaluwarsa, pratinjau diganti keterangan bila gagal dimuat). Beranda juga menampilkan bagian **Favorit** dan **Terakhir dipakai** (`mt_fav`, `mt_recent` di localStorage). Tombol bintang di daftar kategori tetap menyematkan tool.

Changelog, Feedback, Stats, dan Profil ada di `public/js/pages.js`. `CONTACT_WA` (di `public/js/core.js`) sudah diisi 6285772295147; dipakai untuk tombol Feedback dan Chat Developer. Entri changelog ada di array `CHANGELOG`. Stats dan Profil disimpan di browser tiap perangkat (localStorage).

## Sistem Developer
1. Isi `DEVELOPER_EMAILS` (email Google kamu, pisahkan koma bila lebih dari satu), pastikan Login Google dan Vercel Blob sudah aktif, lalu redeploy. `OWNER_EMAILS` lama tetap dibaca, jadi deploy yang sudah jalan tidak perlu diubah.
2. Masuk lewat Profil. Menu **Developer** muncul di menu samping.
3. Yang bisa dilakukan developer: melihat semua pengguna yang pernah login (jumlah masuk, terakhir aktif), mengirim peringatan (tampil sebagai popup sampai pengguna menekan "Saya mengerti"), memblokir atau membuka blokir, menghapus pengguna dari daftar, dan mengatur role pengguna. (Fitur tambah tool kustom dari panel sudah dihapus; tool baru ditambah lewat kode.)
4. Data developer disimpan di Upstash Redis (satu entri per pengguna/tool). Data lama di Vercel Blob diimpor otomatis sekali; `SESSION_SECRET` tetap dibutuhkan untuk impor itu dan untuk sesi, jadi jangan diganti. Pemblokiran hanya berlaku untuk pengguna yang login.

## Broadcast ke Saluran dan grup WhatsApp
Panel Developer, menu **Sistem**, tab **Broadcast**. Pesan (teks, gambar opsional) dikirim lewat bot Tamako MD ke Saluran dan/atau grup.

1. Pasang `tamako-internal-api.js` terbaru di bot (`src/lib/`), lalu restart bot. Tidak ada env baru: memakai `BOT_WEBHOOK_URL` dan `BOT_SECRET` yang sama dengan pengumuman tool baru (`BOT_SECRET` harus sama dengan `BOT_INTERNAL_API_KEY` di bot).
2. Buka tab Broadcast. Daftar grup dimuat dari bot. Centang **Saluran** dan/atau grup tujuan (bawaan: semua grup terpilih; ada pencarian, Pilih semua, dan Kosongkan). Grup yang masuk blacklist JPM (`jpmBlacklist` di bot) tampil redup dan selalu dilewati.
3. Atur jeda antar grup (3 sampai 30 detik; bot memaksa minimal 3 detik, bawaan mengikuti jeda JPM) supaya nomor bot aman dari dianggap spam. Ketuk **Kirim broadcast**, konfirmasi, lalu pantau progres. Tombol **Hentikan** menghentikan sisa kiriman; pesan yang sudah terkirim tidak bisa ditarik.
4. Pengiriman berjalan di bot (bukan di Vercel), jadi tidak kena batas waktu fungsi. Saluran dikirim lebih dulu, lalu grup satu per satu. Hanya satu broadcast yang boleh berjalan, dan tidak berjalan bersamaan dengan JPM/Auto JPM. Progres hilang bila bot restart.
5. Gambar disimpan sementara di Vercel Blob folder `bc/` (maks. sekitar 2,5 MB), diambil bot, dan dihapus otomatis oleh cron `api/cleanup.js` setelah 2 jam. Bot hanya mau mengambil gambar dari host Blob.
6. Setiap broadcast dan penghentiannya tercatat di tab Log. Batas: 5 broadcast per menit per akun developer.

Endpoint bot (semua butuh header `x-internal-key`): `GET /api/broadcast/groups`, `POST /api/broadcast/send`, `GET /api/broadcast/status?id=`, `POST /api/broadcast/stop`. Endpoint lama `/api/channel/broadcast` (notifikasi pembelian) dan `/api/channel/new-tool` tidak berubah.

## Limit harian
Saat ini semua tool gratis (`CREDIT_TOOLS` di `api/_credits.js` kosong); developer tetap bisa memberi harga per tool lewat panel Tools. Limit dikembalikan kalau provider gagal. Jatah per 24 jam: **Member 5**, **Premium 15**, **VIP 30**, **Developer tidak memakai limit sama sekali (tanpa batas, kotak limit disembunyikan)**. Reset 24 jam dihitung sejak limit pertama dipakai. AM Premium wajib login karena limit dicatat per akun (di Upstash Redis bersama data developer, jadi Redis harus aktif; pemotongan limit atomik). Jatah bisa diubah lewat env `CREDIT_MEMBER`, `CREDIT_PREMIUM`, `CREDIT_VIP`; tool lain yang berlimit diatur di `api/_credits.js` (`CREDIT_TOOLS`).

## Role
Di panel Developer tab Pengguna, tiap pengguna punya pilihan role: **Member** (bawaan semua pengguna), **Premium**, dan **VIP**. Role tampil sebagai badge di Profil dan Global Chat. **Developer** otomatis untuk email di `DEVELOPER_EMAILS` dan tidak bisa diubah dari panel. **Masa aktif role:** saat memilih Premium atau VIP, developer juga memilih durasi (1 hari, 1 minggu, 2 minggu, 1 bulan, atau **Permanen**; bawaan 1 minggu). Waktu habis disimpan di `roleUntil` pada data pengguna. Begitu lewat, `roleOf()` otomatis menganggap pengguna Member (badge dan jatah limit ikut kembali), tanpa cron. Role lama yang dibuat sebelum fitur ini tidak punya `roleUntil`, jadi tetap permanen. Memberi ulang role menghitung durasi dari sekarang (bukan menambah sisa). Pilih Member untuk mencabut role kapan saja. Masa aktif tampil di panel developer, Profil, dan halaman Beli Role. Saat ini role hanya berupa badge, belum membuka atau membatasi fitur. Badge di pesan chat lama tidak ikut berubah, hanya pesan baru yang memakai role terbaru.

### Nonaktifkan tool sementara
Panel Developer tab **Tools** punya tombol **Nonaktifkan sementara** / **Aktifkan lagi** per tool (mis. saat provider AM Preset error). Tool yang nonaktif tampil dengan label NONAKTIF, halamannya menampilkan pesan gangguan, dan server menolak pemakaiannya (503) untuk semua pengguna kecuali developer, yang tetap bisa menguji. Daftar tersimpan di Upstash Redis (kunci `__off`). Menonaktifkan AM Premium mematikan langkah kirim dan verifikasi sekaligus.

### Paket harga role
Di panel Developer tab **Harga** kamu mengatur paket yang dijual di halaman Beli Role: role (Premium/VIP), masa aktif (hari), harga (Rp), dan **limit AM Premium per hari**. Contoh: 1 hari, Rp1.000, 5 limit. Maksimal 12 paket, tersimpan di Upstash Redis (kunci `__plans` di data tool). Tanpa pengaturan, bawaannya Premium 7 hari Rp2.500 (15 limit) dan VIP 7 hari Rp5.000 (30 limit). Di tab Pengguna ada pilihan **Paket**: role, masa aktif, dan jatah limit per hari (`crMax`) diaktifkan sekaligus; jatah itu ikut hilang saat role habis atau diubah manual (kembali ke `CREDIT_*`). Pembayaran tetap manual lewat WhatsApp.

## Kode redeem
Pengguna yang sudah login bisa menukar kode di halaman **Beli Role** atau **Profil** (kotak "Punya kode redeem?") untuk mendapat Premium atau VIP tanpa aktivasi manual. Developer membuat kode di panel Developer tab **Kode**: pilih role, masa aktif (hari, 0 = permanen), limit AM Premium per hari (0 = jatah bawaan role), batas pemakaian per kode, jumlah kode (1-50 sekaligus), tanggal kedaluwarsa (opsional), catatan, dan kode kustom (opsional, hanya untuk 1 kode). Format otomatis `MT-XXXX-XXXX-XXXX`; huruf besar/kecil dan tanda hubung tidak berpengaruh saat menukar.

Aturan: satu pengguna hanya bisa memakai satu kode **satu kali**; kode berhenti bekerja bila kuota habis, kedaluwarsa, atau dihapus. Role yang sama diperpanjang dari sisa masa aktif (limit per hari mengikuti nilai terbesar); Premium ke VIP dihitung dari sekarang; pengguna yang sedang VIP tidak bisa memakai kode Premium; role permanen menolak kode role yang sama; akun developer dan akun yang diblokir tidak bisa memakai kode. Percobaan dibatasi 10 kali per 10 menit per akun. Penghapusan kode tidak mencabut role yang sudah diaktifkan. Tombol **Pemakai** di tiap kode menunjukkan siapa saja yang sudah memakainya, dan semua pembuatan, penghapusan, dan penukaran tercatat di tab Log.

Data di Upstash Redis: `mt:redeem:codes` (hash kode), `mt:redeem:used` (hash jumlah pakai, diubah atomik lewat skrip Lua), `mt:redeem:by:KODE` (set pengguna yang sudah memakai). Maksimal 3000 kode tersimpan. Tidak ada env baru dan tidak ada fungsi Vercel baru (aksi `redeem` ada di `api/auth.js`, manajemen kode di `api/admin.js`).

### Umumkan kode redeem otomatis (WhatsApp)
Di panel Developer tab **Kode redeem** ada bagian **Umumkan otomatis (WhatsApp)**: centang **Saluran** dan/atau **Semua grup**, pilih gaya teks (Rapi, Ringkas, Singkat; semuanya netral tanpa kata promosi) atau tulis teks sendiri dengan penanda `{kode} {role} {durasi} {limit} {kuota} {kedaluwarsa} {catatan} {link}`, lalu **Buat kode**. Bot mengirim pengumuman lewat endpoint broadcast yang sudah ada (tanpa env baru; `SITE_URL` opsional untuk link di teks). Opsi **Sertakan gambar poster otomatis** (aktif secara bawaan) membuat poster 1080x1350 di browser dari kode yang baru jadi (kode, role, masa aktif, limit, kuota, kedaluwarsa), lalu mengirimnya bersama teks lewat aksi `codeannounce`; gambar disimpan sementara di Vercel Blob `bc/` (butuh Blob terhubung, sama seperti Broadcast). Hanya untuk 1 kode. Bila pengiriman gagal, kode tetap dibuat dan panel menampilkan alasannya. Teks ada di `api/_redeem_msg.js`; tombol **Lihat pratinjau** memakai aksi `codepreview`.

## Pengumuman dan Favorit
Developer bisa memasang pengumuman (maks. 300 karakter) di panel Developer tab Pengumuman. Tampil di beranda dan bisa ditutup per sesi. Pengguna bisa menandai tool favorit dengan ☆, tersimpan di perangkat masing-masing, dan tool favorit naik ke atas daftar.

## Global Chat
Halaman **Global Chat** ada di menu samping. Semua orang bisa membaca, kirim pesan wajib login Google. Nama dan foto Google tampil publik di chat. Ada balas, tag `@nama`, badge role (DEVELOPER, PREMIUM, VIP, MEMBER), jeda 2 detik per pengguna, pengguna yang diblokir tidak bisa kirim, dan developer bisa menghapus pesan. Pesan disimpan (200 terakhir) di Upstash Redis dan dimuat ulang tiap 5 detik.

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
Semua orang yang membuka situs harus masuk dulu. Layar login muncul di atas halaman, dan server juga menolak (401) pemakaian tool, unggah foto, dan Global Chat tanpa sesi login. Isi `REQUIRE_LOGIN=0` hanya bila situs ingin dibuka untuk tamu.

Cara masuk: **Google** atau **username + kata sandi**. Daftar akun baru memakai email, lalu kode 6 digit dikirim lewat SMTP dan harus dimasukkan sebelum akun dibuat. Ada juga **Lupa kata sandi** (kode reset lewat email).

### Pengaturan SMTP (Environment Variables Vercel)
`SMTP_HOST`, `SMTP_PORT` (465 SSL atau 587 STARTTLS), `SMTP_USER`, `SMTP_PASS`, opsional `SMTP_FROM`, `SMTP_SECURE`, `APP_NAME`. Untuk Gmail pakai App Password (bukan kata sandi biasa) dengan host `smtp.gmail.com`, port 465. Setelah mengisi, redeploy dan jalankan `npm install` (dependensi baru: `nodemailer`).

### Catatan keamanan
- Kata sandi disimpan sebagai hash scrypt + salt acak, bukan teks asli. Akun disimpan di Upstash Redis, seperti data developer.
- Kode berlaku 10 menit, maksimal 5 kali salah, kirim ulang minimal jeda 1 menit. Akun dikunci 10 menit setelah 8 kali salah kata sandi.
- Respons Lupa kata sandi sama untuk email terdaftar maupun tidak, agar email tidak bisa ditebak.
- Pengguna username/password muncul di panel Developer, bisa diblokir, diberi peringatan, dan diberi role seperti pengguna Google.
- Penyimpanan akun memakai file JSON tunggal. Untuk ribuan pengguna sebaiknya pindah ke database (Redis/Postgres).


## Beli role otomatis (Meldapay QRIS)
Halaman **Beli Role** punya tombol *Bayar dengan QRIS*. Server membuat tagihan di Meldapay, pengguna scan QRIS, dan role (Premium, VIP, Owner sesuai paket di panel Developer) aktif otomatis. Tanpa `MELDAPAY_APIKEY`, tombol tidak muncul dan halaman memakai alur lama (chat developer, role diaktifkan manual).

1. Daftar di meldapay.com, buka menu **Profil**, salin **API Key** dan **Webhook Secret**.
2. Isi di Vercel: `MELDAPAY_APIKEY`, `MELDAPAY_WEBHOOK_SECRET`. Lalu redeploy.
3. Di Profil Meldapay, isi **Callback URL**: `https://DOMAINMU/api/pay?action=hook`. Callback opsional: tanpa itu role tetap aktif lewat pengecekan status otomatis saat pengguna masih di halaman, atau saat ia membuka Beli Role lagi. Meldapay hanya punya satu Callback URL per akun; bila akun yang sama dipakai bot toko, biarkan Callback URL milik bot (callback untuk tagihan yang bukan milik Malik Tools diabaikan dengan aman).
4. Keamanan: isi callback tidak dipercaya. Setiap klaim "paid" dicek ulang ke API Meldapay dengan API key rahasia, dan nominalnya harus cocok dengan paket. Tanda tangan `X-Signature` (HMAC-SHA256) diverifikasi bila `MELDAPAY_WEBHOOK_SECRET` diisi.
5. Harga memakai paket di panel Developer (Harga paket, minimal Rp1.000 untuk dijual online). Biaya Meldapay ditambahkan di atas harga dan tampil di kartu QRIS. Memperpanjang role yang sama menambah masa aktif; Premium tidak bisa dibeli saat VIP aktif (ditolak sebelum bayar).
6a. **Diagnosa gateway (khusus developer):** login sebagai developer lalu buka `https://DOMAINMU/api/pay?action=diag` (opsional `&amount=5000`). Server membuat satu tagihan percobaan, langsung membatalkannya, dan menampilkan hasil: API key terisi atau tidak, balasan Meldapay (HTTP, error, nominal, biaya), dan kesimpulan penyebab bila gagal. API key tidak pernah ditampilkan.
6. Tiap pembayaran tercatat di tab Log (oleh `meldapay`). Bila ada yang dibayar tetapi gagal diterapkan, log menulis **DIBAYAR TAPI GAGAL DITERAPKAN** beserta ID tagihan, dan pengguna diminta menghubungi developer. Data tagihan ada di Redis `mt:pay:orders`.

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


## Panel Developer: statistik, filter, limit, log, cadangan
- **Tata letak (v219):** menu jadi 4 grup: **Ringkasan** (4 kartu angka + statistik), **Pengguna** (Daftar, Kode redeem), **Toko** (Tools, Harga, Pengumuman), **Sistem** (Log, Cadangan). Daftar pengguna memakai kartu ringkas (nama, role, status, terakhir aktif, limit); ketuk kartu untuk membuka sheet berisi role, paket, limit, badge, peringatan, riwayat, dan zona berbahaya (blokir, hapus) di bagian bawah. Filter lengkap (Role, Status, Terakhir aktif) ada di tombol **Filter**; chip cepat untuk Segera habis, Baru habis, Diperingati, Diblokir. Hanya tampilan yang berubah, API dan data tidak.
- **Kartu ringkasan:** Pengguna, Aktif hari ini, Baru hari ini, Role habis ≤3 hari, Diperingati, Diblokir. Hari dihitung WIB. "Aktif" memakai `lastSeen`, yang kini diperbarui paling sering tiap 30 menit saat pengguna membuka situs (sebelumnya hanya saat login).
- **Tab Statistik (global):** pemakaian tool hari ini / 7 hari, berhasil vs gagal, pengguna aktif per hari, dan penanda **BERMASALAH** (hari ini gagal ≥3 kali dan ≥30%) atau **PERLU DICEK** (≥2 kali dan ≥15%) beserta pesan gagal terakhir. "Gagal" hanya gangguan provider (timeout, 5xx, koneksi); input salah tidak dihitung. Pemakaian developer tidak dihitung. Data di Redis (`mt:stat:*`), disimpan 40 hari.
- **Role habis:** di tab Pengguna ada chip **Habis ≤3 hari** dan **Baru habis** (14 hari terakhir), diurutkan dari yang paling mendesak. Kartu pengguna menampilkan sisa/lewat hari untuk menawarkan perpanjangan.
- **Filter pengguna:** cari, Role, Status (diblokir/diperingati/normal), Terakhir aktif (hari ini, 7, 30, >30 hari), dan Reset filter.
- **Limit:** tombol **+ Limit** (bonus 1-999, dipakai lebih dulu, tidak ikut reset 24 jam, dikembalikan bila provider gagal) dan **Reset limit** (pemakaian 24 jam jadi nol). Sisa limit tampil di kartu pengguna.
- **Log aktivitas:** tab Log dan tombol **Riwayat** per pengguna. Mencatat role (plus paket dan harga), limit, blokir, peringatan, hapus pengguna, harga/paket/tool nonaktif, pengumuman, serta mute dan hapus pesan chat. 1000 catatan terakhir (`mt:log`).
- **Moderasi Global Chat:** hapus pesan, sematkan (maks. 3), dan mute sementara ada di menu pesan di halaman Global Chat (bukan di panel Developer). Mute kini minta durasi (1-10080 menit) dan bisa dicabut dari menu yang sama.
- **Pengumuman:** kolom **Mulai tampil**, **Berakhir otomatis**, dan **Tampilkan ke** role tertentu (kosong = semua). Dicek di server saat halaman dimuat; developer tetap melihat semuanya di panel, lengkap dengan status.
- **Cadangan:** tab Cadangan mengunduh pengguna (CSV) dan cadangan lengkap (JSON: pengguna, paket, harga, tool nonaktif, pengumuman, log). Kata sandi akun dan foto tidak ikut. Belum ada fitur impor.

## NexaDev (Reaksi Channel WhatsApp)
Tool `rch` memakai NexaDev (`api/tool.js` fungsi `reactChannel`). Isi `NEXADEV_API_KEY` di Vercel (opsional `NEXADEV_BASE_URL`), lalu redeploy. Dibatasi 4 kali per 10 menit per IP supaya kuota provider tidak habis. Tool GenCipta lain tidak terpengaruh.

## Role Owner, centang verified, badge kustom
- **Owner** dipilih di panel Developer tab Pengguna (pilihan Role). Tanpa durasi (selalu permanen, pilihan durasi disembunyikan), **limit tak terbatas**, dan dapat **centang verified** biru seperti Developer. Owner bukan Developer: tidak bisa membuka panel Developer. Kode redeem tidak berlaku untuk Owner.
- **Badge kustom**: di tiap pengguna ada kotak Badge kustom (teks maks. 14 karakter, 9 pilihan warna). Tampil di samping badge role di Global Chat, Profil, dan menu samping; hapus lewat tombol Hapus badge. Berlaku juga di pesan lama dan langsung memuat ulang chat. Tercatat di tab Log.
- Istilah "kredit" di seluruh situs kini bernama **limit** (nama env `CREDIT_*` tidak berubah).

## Tag semua dan notifikasi Global Chat
- **@semua** (juga `@everyone` / `@all`): hanya Developer yang menandai semua orang (Owner tidak). Dari akun lain, tulisan itu hanya teks biasa. Saat mengetik `@` muncul saran `@semua`. Pesannya diberi tanda `all` di server, jadi tidak bisa dipalsukan dari browser.
- **Notifikasi** (lonceng di header Global Chat, bawaan aktif): saat ada pesan yang menyebut `@nama` kamu atau `@semua`, muncul popup di dalam situs; bila izin notifikasi browser diberikan dan tab ada di latar belakang, muncul notifikasi browser (ketuk untuk membuka Global Chat). Pengecekan memakai polling 45 detik yang sudah ada, jadi tidak menambah beban saat situs ditutup.
- Saat situs/tab benar-benar ditutup, notifikasi dikirim lewat **Web Push** (lihat bagian di bawah). Tanpa kunci VAPID, hanya polling di atas yang jalan.

## AM Premium: jalur cadangan GenCipta dan NexaDev
- Tool **AM Premium** (`am-send` dan `am-verif`) memakai dua provider yang saling menggantikan: **GenCipta** dan **NexaDev** (`GET /am/send/` dan `GET /am/verif/`, kunci dari `NEXADEV_API_KEY`).
- Bila provider yang sedang dipakai error (HTTP 5xx, `status:false`, diblokir Cloudflare, atau timeout), permintaan **otomatis diulang ke provider satunya** dalam satu klik pengguna. Limit pengguna hanya dipotong sekali, dan dikembalikan bila keduanya gagal.
- Jalur yang **terakhir berhasil** dipakai lebih dulu (disimpan di Redis, kunci `mt:prov:am`). Jadi GenCipta error -> pindah ke NexaDev, lalu NexaDev error -> balik ke GenCipta. Isi `AM_PROVIDER=gencipta` atau `nexadev` untuk mengunci urutan pertama (yang satunya tetap jadi cadangan).
- Cukup satu kunci pun jalan: tanpa `NEXADEV_API_KEY` hanya GenCipta dipakai, tanpa `GENCIPTA_API_KEY` hanya NexaDev. Jalur cadangan tidak bisa dipanggil langsung dari browser; harga dan limit tetap mengikuti tool aslinya.
- Penanda gangguan (`/api/status`) untuk tool ini baru menyala bila GenCipta dan NexaDev sama-sama mati.
- NexaDev memotong 5 kredit akunmu per panggilan; pantau saldonya di dashboard Nexa.



## Diblokir Cloudflare (api-cloud)
Tool api-cloud kini memakai User-Agent `MalikTools/1.0 (API client)` (bukan penyamaran Chrome, karena sidik jari koneksi Node tidak cocok dengan Chrome dan sering memicu tantangan Cloudflare). Bila provider meminta User-Agent tertentu agar dilewatkan, isi env `CLOUDAPI_UA`. Pesan blokir kini memuat Ray ID Cloudflare untuk dilaporkan ke pemilik API. Bila tetap diblokir, pemilik API perlu mengecualikan permintaan ber-header `x-api-key` (atau IP Vercel) dari tantangan di WAF/Bot Fight Mode mereka.

**Quoted Card IG Viral** (`GET /canvas/quotecard?text=&bold=&json=0&template=`, `bold` 0 atau 1, `template` 1 sampai 5, kosong = default) membalas gambar `image/jpeg` langsung. Backend selalu mengirim `json=0`, hasilnya dibaca sebagai biner di `api/tool.js`. Kunci memakai `CLOUDAPI_API_KEY` di environment Vercel (jangan ditaruh di kode). Path bisa diubah lewat `CLOUDAPI_PATH_QUOTECARD`.

**Reaksi Channel V2 dan V3** (api-cloud, plan Pro): V2 `GET /tools/rch?link=&emoji=` (maks. 6 emoji, dipisah koma), V3 `GET /tools/reactch-v4?url=&reaction=` (1 emoji). Keduanya lewat `reactChannelCloud()` di `api/tool.js`, memakai `CLOUDAPI_API_KEY`, dan limit harian yang sama dengan Reaksi Channel dan semua versi (termasuk Reaksi Channel versi 1) memakai 3 limit per kirim (id tool `rch2` dan `rch3` di `api/_credits.js`). Field `quota` (berisi apikey) dari balasan provider dibuang dan tidak dikirim ke browser.

## SEO dan CSS
- `public/style.css` berisi semua CSS (dulu 32 blok `<style>` di `index.html`), urutan asli dipertahankan karena urutan menentukan prioritas. Tiap bagian diberi penanda `/* ===== nama ===== */`. Ubah tampilan di file ini; naikkan angka `?v=` di `index.html` dan `SHELL` di `public/sw.js` agar cache pengguna ikut baru.
- Setiap tool punya halaman pencarian sendiri di `/tools/<id>` (judul, deskripsi, data terstruktur). Setelah menambah atau mengubah tool, jalankan `python3 scripts/build-seo.py` untuk membuat ulang halaman tool, `sitemap.xml`, dan `robots.txt`.
- Setelah deploy, daftarkan `https://www.maliktools.biz.id/sitemap.xml` di Google Search Console.

## Halaman informasi
`/tentang`, `/privasi`, `/syarat`, `/bantuan` dibuat oleh `scripts/build-seo.py` (isi teksnya ada di skrip itu). Tautannya ada di footer beranda, menu samping (Informasi), layar masuk, dan footer halaman tool. Untuk Login Google, isi alamat `/privasi` dan `/syarat` di OAuth consent screen. Baca ulang isinya dan sesuaikan bila ada data atau aturan yang berubah.

## Tool Maker di browser
Meme Maker, Pembuat Stiker WhatsApp, Watermark Foto, Avatar Bulat, dan Story Teks jalan penuh di canvas browser (tidak ada API, tidak ada limit, foto tidak diunggah). Semuanya ada di array `TOOLS_FULL` (`public/js/tools.js`) pada `public/index.html`, kategori `canvas` (Maker). Setelah menambah tool, jalankan `python3 scripts/build-seo.py`.


## Keamanan (v322+)
- **Akun**: satu entri per akun di Redis (`mt:acc:users`, `mt:acc:pending`, indeks email `mt:acc:email`). Pembuatan akun memakai `HSETNX`, perubahan memakai compare-and-set per entri, dan username yang sedang menunggu verifikasi dipesan atomik. Dua pendaftar bersamaan tidak bisa saling menimpa.
- **Batas percobaan** kode verifikasi (5), kode reset (5), dan kata sandi (8 per 10 menit per akun) dihitung dengan Redis `INCR` atomik (`api/_rate.js` → `hit()`), jadi permintaan paralel tidak bisa melewatinya. Bila Redis error, permintaan ditolak (gagal tertutup).
- **Anti-CSRF**: semua endpoint non-GET memanggil `guard()` (`api/_http.js`): header `Origin` harus sama dengan host situs. Tanpa Origin, `Sec-Fetch-Site: cross-site` ditolak. Origin tambahan (mis. domain admin lain) diisi di env `ALLOWED_ORIGINS` (dipisah koma).
- **IP klien** diambil dari `x-vercel-forwarded-for` / `x-real-ip` (diisi platform), bukan `x-forwarded-for` mentah.
- **XSS**: `esc()` di `public/js/core.js` kini juga meng-escape tanda kutip tunggal. CSP masih memakai `'unsafe-inline'` untuk script karena `index.html` memakai ratusan handler inline; menghapusnya butuh memindahkan semuanya ke file JS terpisah dengan event delegation (belum dikerjakan).

## Akun sendiri
Pengguna bisa **ganti email** (akun username/sandi, lewat kode ke email baru) dan **hapus akun** sendiri dari Profil. Hapus akun menghapus entri akun, data pengguna di Redis, dan foto profil; tercatat di log developer. Akun developer tidak bisa dihapus dari sini.

## Laporan pesan dan pemantauan error
- Pengguna bisa **Laporkan** pesan Global Chat (menu pesan). Laporan masuk antrean `mt:chat:reports` (30 hari). Developer membaca lewat `GET /api/admin?action=reports`, menutup lewat `POST action=dismissreport` (`id` atau `msg`).
- Error server (kegagalan provider, error API) disimpan 200 terakhir di `mt:errs`: `GET /api/admin?action=errors`, bersihkan dengan `POST action=clearerrors`. Isi env `ERROR_WEBHOOK_URL` (Discord/Slack) untuk pemberitahuan langsung; pesan yang sama hanya dikirim sekali per 10 menit.

## Tes, CI, dan build
- `npm test` menjalankan tes (`node:test`, tanpa dependensi, Redis palsu di memori) untuk alur akun, batas percobaan paralel, dan pengecekan Origin. `npm run check` memeriksa sintaks `api/*.js` dan skrip inline, memastikan `guard()` terpasang, dan versi `style.css` di `sw.js` cocok. CI GitHub Actions (`.github/workflows/ci.yml`) menjalankan keduanya di tiap push.
- **CSS**: sumber ada di `src/style.css`; setelah mengubahnya jalankan `python3 scripts/minify-css.py` (hasil ke `public/style.css`), lalu naikkan angka `?v=` di `index.html` dan `sw.js`. Hal yang sama untuk `/js/core.js?v=` dan `/js/ui.js?v=` setiap file di `public/js/` berubah (`npm run check` memastikan angkanya sama di kedua tempat; modul lazy otomatis memakai angka dari `core.js`).
- Beranda punya daftar tool statis (`<main id="main">` berisi h1 dan tautan ke `/tools/*`) yang terbaca crawler dan diganti JS saat halaman dirender.


## Auto-nonaktif provider (opsional)
Isi env `AUTO_OFF=1` di Vercel. `api/status.js` (dipanggil klien tiap beberapa menit) menghitung cek gagal berturut-turut; setelah 3 kali, tool yang providernya mati dijeda otomatis (Redis `mt:autooff`, kedaluwarsa 10 menit) dan dibuka lagi saat pulih. Developer tetap bisa menguji. Tanpa env ini perilaku lama (hanya banner gangguan).

## Share Target dan Riwayat pembelian
`manifest.webmanifest` punya `share_target` (GET `/?url=&text=`); `index.html` mengarahkan link ke tool yang cocok dan mengisi kolom link. `GET /api/pay?action=history` memberi riwayat pembelian role pengguna (maks 10 terakhir) untuk halaman Beli Role.

## Halaman Info, Web Push, dan mode offline (v362)
Satu paket karena ketiganya menyentuh service worker (`public/sw.js`, cache `mt-v108`).

**Halaman Info** (`#info`, menu samping, modul `pages.js`): versi, mode buka (aplikasi/browser), status koneksi, jumlah berkas cache offline + tombol **Segarkan cache offline**, dan pengaturan **notifikasi push** (aktifkan/matikan, kirim tes), plus tautan Tentang, Privasi, Syarat, Bantuan, Changelog.

**Mode offline**
- `sw.js` me-precache shell (`/`, `/offline.html`, CSS, `core.js`, `ui.js`, gambar) dan modul lazy `tools.js`, `pages.js`, `chat.js` (modul `dev.js` sengaja tidak). Modul lazy dicoba satu per satu, jadi satu kegagalan tidak menggagalkan install.
- Pindah halaman: jaringan dulu (maks. 3 dtk), lalu cache. Beranda (termasuk `/?url=` dari Bagikan) jatuh ke shell `/`; halaman lain yang belum pernah dibuka jatuh ke `/offline.html`. Permintaan `/api/*` tidak pernah di-cache.
- Banner **Kamu sedang offline** (`ui.js`) muncul saat koneksi putus. `npm run check` memastikan versi modul di `sw.js` sama dengan `core.js`.
- Setiap `core.js`/`ui.js`/modul/CSS berubah: naikkan `?v=` di `index.html` **dan** `sw.js` (`CORE`/`LAZY`) lalu `V` (nama cache).

**Web Push** (tanpa paket `web-push`: VAPID ES256 + enkripsi `aes128gcm` RFC 8291 ditulis dengan `crypto` Node di `api/_webpush.js`, diuji dengan vektor RFC)
1. Jalankan `node scripts/vapid.js`, isi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`) di Vercel, lalu redeploy. Mengganti kunci mematikan semua langganan lama (pengguna aktifkan ulang).
2. Pengguna masuk, lalu aktifkan lewat lonceng Global Chat atau halaman Info. Perangkat mendaftar ke `POST /api/push` (`op: subscribe`); `GET /api/push` memberi kunci publik.
3. Setelah pesan chat tersimpan, `api/chat.js` memanggil `notifyChat()` (`api/_push.js`): `@semua` (hanya yang bertanda `all` dari server, jadi tidak bisa dipalsukan) ke semua langganan, `@namaDepan` ke pemilik nama itu, pengirim dilewati. Langganan yang dibalas 404/410 dibuang otomatis.
4. Redis: `mt:push:subs` (hash, id = sha256 endpoint) dan `mt:push:u:<uid>` (set, maks. **5 perangkat** per akun). Hapus akun ikut membuang langganannya.
- Keamanan: endpoint hanya diterima dari layanan push resmi (FCM, Mozilla, Apple, Windows) lewat HTTPS tanpa port (anti-SSRF); `subscribe` butuh login dan dibatasi 20 per 10 menit; tes kirim dijeda 15 dtk.
- Bila jendela situs sedang terlihat, push tidak ditampilkan (popup di dalam situs yang menangani, tanpa dobel). `pushsubscriptionchange` mendaftarkan ulang otomatis.
- iPhone: push hanya jalan setelah Malik Tools dipasang ke Layar Utama (iOS 16.4+).
