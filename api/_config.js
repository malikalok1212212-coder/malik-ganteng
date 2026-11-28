// Semua pengaturan provider ada di sini. Tambah tool baru = tambah satu entri di "tools".
// Provider: GenCipta (https://api.gencipta.com/id/docs). Kunci dikirim lewat header Authorization: Bearer, hanya dari server.
const GC_BASE = (process.env.GENCIPTA_BASE_URL || 'https://gateway.gencipta.com').replace(/\/$/, '');
const NX_BASE = (process.env.NEXADEV_BASE_URL || 'https://api.nexadev.my.id').replace(/\/$/, '');
// api-cloud.my.id (paket Pro). Kunci hanya dari env CLOUDAPI_API_KEY (server), nama parameter kunci bisa diubah lewat CLOUDAPI_KEY_PARAM.
const AC_BASE = (process.env.CLOUDAPI_BASE_URL || 'https://api-cloud.my.id').replace(/\/$/, '');
const AC_KEY_PARAM = process.env.CLOUDAPI_KEY_PARAM || 'apikey';
module.exports = {
  gcBase: GC_BASE,
  gcKey: process.env.GENCIPTA_API_KEY || '',
  nxBase: NX_BASE,
  acBase: AC_BASE,
  // Jalur cadangan dua arah GenCipta <-> NexaDev untuk tool dengan id yang sama. Sengaja BUKAN bagian dari "tools":
  // pengguna tidak bisa memanggilnya langsung (harga/limit tetap mengikuti id tool aslinya). Dipakai oleh api/tool.js dan api/status.js.
  // NexaDev: GET /am/send/?key=&email=  dan  GET /am/verif/?key=&email=&link=  (kunci dari env NEXADEV_API_KEY)
  alts: {
    'am-send': { nx: true, base: NX_BASE, type: 'email', path: process.env.NEXADEV_PATH_AM_SEND || '/am/send/', method: 'GET', param: 'email', keyParam: 'key', shape: 'nxamsend', timeout: 25000 },
    'am-verif': { nx: true, base: NX_BASE, type: 'email-link', path: process.env.NEXADEV_PATH_AM_VERIF || '/am/verif/', method: 'GET', param: 'email', linkParam: 'link', keyParam: 'key', shape: 'nxamverif', timeout: 32000 }
  },
  tools: {
    // GET /api/spotify/search?q=&limit= -> { status, query, total, data:[{ id, title, artist, album, duration, cover_url, spotify_url, stream_url }] }
    // stream_url butuh API key di header, jadi tidak diberikan ke browser. Unduh/stream menyusul dari endpoint Spotify lain.
    'spotify-play': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_SPOTIFY_SEARCH || '/api/spotify/search', method: 'GET', param: 'q', qs: { limit: '10' }, shape: 'gcspotify', timeout: 30000 },
    // Search Anime (GenCipta, kategori Anime): GET /api/anime/search?q= -> { status, data:{ success, query, total, results:[{ title, slug, link, poster, status, rating, genres[] }] }, creator }
    // Nama parameter bawaan q (juga dikirim sebagai query supaya aman); ubah lewat GENCIPTA_PARAM_ANIME bila docs memakai nama lain.
    'anime-search': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_ANIME_SEARCH || '/api/anime/search', method: 'GET', param: process.env.GENCIPTA_PARAM_ANIME || 'q', paramAlt: 'query', shape: 'gcanime', timeout: 30000, pattern: /^[\s\S]{2,80}$/, patternMsg: 'Judul anime 2 sampai 80 karakter.' },
    // Anime Ongoing (GenCipta, kategori Anime): GET /api/anime/ongoing?page= -> { status, data:{ success, page, hasNext, total, anime:[{ title, slug, current_episode, release_day, link, poster }] }, creator }
    // Input tool = nomor halaman (1, 2, ...). Path bisa diganti lewat GENCIPTA_PATH_ANIME_ONGOING.
    'anime-ongoing': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_ANIME_ONGOING || '/api/anime/ongoing', method: 'GET', param: 'page', shape: 'gcanimeongoing', timeout: 30000, pattern: /^\d{1,3}$/, patternMsg: 'Nomor halaman harus angka 1 sampai 999.' },
    // Anime Completed (GenCipta, kategori Anime): GET /api/anime/completed?page= -> daftar anime tamat (bentuk balasan seperti ongoing; pembaca toleran terhadap nama field)
    'anime-completed': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_ANIME_COMPLETED || '/api/anime/completed', method: 'GET', param: 'page', shape: 'gcanimecompleted', timeout: 30000, pattern: /^\d{1,3}$/, patternMsg: 'Nomor halaman harus angka 1 sampai 999.' },
    // Anime Episode (GenCipta, kategori Anime): GET /api/anime/episode?slug= -> { status, data:{ success, title, current_url, default_stream, navigation:{ previous, next, all_episodes }, total_mirrors, mirrors[], total_downloads, downloads[] }, creator }
    // Input = slug episode Otakudesu atau link episode. Nama parameter bawaan slug; ubah lewat GENCIPTA_PARAM_ANIME_EPISODE bila docs memakai nama lain (mis. url).
    'anime-episode': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_ANIME_EPISODE || '/api/anime/episode', method: 'GET', param: process.env.GENCIPTA_PARAM_ANIME_EPISODE || 'slug', shape: 'gcanimeepisode', timeout: 30000, pattern: /^(?:[a-z0-9][a-z0-9_-]{2,160}|https:\/\/\S{8,300})$/i, patternMsg: 'Isi slug episode (contoh: boruto-episode-1-sub-indo) atau link episode Otakudesu.' },
    // Anime Batch (GenCipta, kategori Anime): GET /api/anime/batch?slug= -> { status, data:{ success, title, batch_url, total_downloads, downloads[] }, creator }. Input = slug batch Otakudesu atau link batch.
    'anime-batch': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_ANIME_BATCH || '/api/anime/batch', method: 'GET', param: process.env.GENCIPTA_PARAM_ANIME_BATCH || 'slug', shape: 'gcanimebatch', timeout: 30000, pattern: /^(?:[a-z0-9][a-z0-9_-]{2,160}|https:\/\/\S{8,300})$/i, patternMsg: 'Isi slug batch (contoh: boruto-batch-sub-indo) atau link batch Otakudesu.' },
    // api-cloud: GET /komik/mangaplus?type=home&lang=ind&apikey= -> { status, type, lang, result:{ daily_updates[{title_id,title,chapter_id,number,name}], ranking[{title_id,title,author,thumbnail}], latest_updates[] }, quota }. type lain (update 24 jam, unggulan, daftar judul, cari, detail, chapter) belum dipakai.
    // Kode bahasa: hanya ind yang sudah terbukti dari contoh docs; sisanya (eng, esp, fra, por, rus, tha, vie, deu) perkiraan dan perlu dicek bila provider menolak.
    'mangaplus': { ac: true, base: AC_BASE, type: 'multi', path: process.env.CLOUDAPI_PATH_MANGAPLUS || '/komik/mangaplus', method: 'GET', keyParam: AC_KEY_PARAM, shape: 'acmangaplus', timeout: 40000, qs: { type: 'home' },
      fields: [{ key: 'lang', label: 'Bahasa', kind: 'enum', opts: ['ind', 'eng', 'esp', 'fra', 'por', 'rus', 'tha', 'vie', 'deu'] }] },
    // Langkah 1: POST /api/am-generator/send-link  body JSON { email } -> { success, email, message }
    'am-send': { gc: true, base: GC_BASE, type: 'email', path: process.env.GENCIPTA_PATH_AM_SEND || '/api/am-generator/send-link', method: 'POST', body: { email: 'email' }, shape: 'gcamsend', timeout: 30000 },
    // Langkah 2: POST /api/am-generator/verify-link  body JSON { email, magicLink } -> { success, message, data:{ email, planName, membershipStatus, validUntil, ... } }
    'am-verif': { gc: true, base: GC_BASE, type: 'email-link', path: process.env.GENCIPTA_PATH_AM_VERIF || '/api/am-generator/verify-link', method: 'POST', body: { email: 'email', link: 'magicLink' }, shape: 'gcamverif', timeout: 45000 },
    // GET /api/downloader/tiktok?url=  -> { status, title, duration, data:[{type:watermark|nowatermark|nowatermark_hd,url}], music_info:{url}, author:{nickname} }
    'tiktok-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_TIKTOK || '/api/downloader/tiktok', method: 'GET', param: 'url', shape: 'gctiktok', timeout: 40000, host: /(^|\.)tiktok\.com$/i, hostMsg: 'Link harus dari TikTok (tiktok.com, vt.tiktok.com, atau vm.tiktok.com).' }
    ,
    // TikTok Downloader V2 (NexaDev, tanpa key): GET /api/snaptik/?url=  -> { status, title, thumbnail, download_links:[{type,url}] } (MP4, MP4 HD, MP3)
    'tiktok-dl2': { nx: true, noKey: true, base: NX_BASE, type: 'url', path: process.env.NEXADEV_PATH_TIKTOK2 || '/api/snaptik/', method: 'GET', param: 'url', shape: 'nxtiktok', timeout: 35000, host: /(^|\.)tiktok\.com$/i, hostMsg: 'Link harus dari TikTok (tiktok.com, vt.tiktok.com, atau vm.tiktok.com).' },
    // AM Preset (NexaDev, tanpa key): GET /api/ampreset?url=  -> { ok, author, video, total, types{xml,5mb}, presets:[{type,url,download,commenter,detail,source,byAuthor,pinned}], scanned } (memindai komentar, balasan, dan bio)
    'am-preset': { nx: true, noKey: true, base: NX_BASE, type: 'url', path: process.env.NEXADEV_PATH_AMPRESET || '/api/ampreset', method: 'GET', param: 'url', shape: 'nxampreset', timeout: 45000, host: /(^|\.)tiktok\.com$/i, hostMsg: 'Link harus dari TikTok (tiktok.com, vt.tiktok.com, atau vm.tiktok.com).' },
    // Cari Komik (NexaDev, tanpa key, kategori Anime): GET /komik?q=  -> { success, source, query, total, results:[{title,link,slug,cover,type,latestChapter,rating}] }
    'komik-search': { nx: true, noKey: true, base: NX_BASE, type: 'text', path: process.env.NEXADEV_PATH_KOMIK || '/komik', method: 'GET', param: 'q', shape: 'nxkomik', timeout: 30000, pattern: /^[\s\S]{2,80}$/, patternMsg: 'Judul komik 2 sampai 80 karakter.' },
    // GET /api/downloader/instagram-v2?url=[&type=] (reels, video, foto, carousel, DP, stories, highlights). Balasan: { status, data:{ metadata, author, media:{ thumbnail, thumbnails[], videos[{url,type,resolution}] } } }, dibaca gcInstagram (cadangan: pembaca umum aio).
    'ig-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_INSTAGRAM || '/api/downloader/instagram-v2', method: 'GET', param: 'url', shape: 'gcinstagram', timeout: 45000, host: /(^|\.)instagram\.com$/i, hostMsg: 'Link harus dari Instagram (instagram.com).' },
    // GET /api/downloader/mediafire?url= -> { status, data:{ fileName, fileSize, fileExtension, directDownloadUrl, mediafireUrl, requiresLogin, isPasswordProtected } }
    'mediafire-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_MEDIAFIRE || '/api/downloader/mediafire', method: 'GET', param: 'url', shape: 'file', timeout: 45000, host: /(^|\.)mediafire\.com$/i, hostMsg: 'Link harus dari Mediafire (mediafire.com).' },
    // GET /api/downloader/dailymotion?url= -> { status, creator, data:{ title, thumbnail, duration(detik), qualities:[{ quality, url, type }] } }
    'dailymotion-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_DAILYMOTION || '/api/downloader/dailymotion', method: 'GET', param: 'url', shape: 'gcdailymotion', timeout: 45000, host: /(^|\.)(dailymotion\.com|dai\.ly)$/i, hostMsg: 'Link harus dari Dailymotion (dailymotion.com atau dai.ly).' },
    // GET /api/downloader/soundcloud?url= -> { status, data:{ source_url, title, thumb, description, downloads:[{quality,link}] } }. Provider tidak selalu memberi file MP3 langsung.
    'soundcloud-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_SOUNDCLOUD || '/api/downloader/soundcloud', method: 'GET', param: 'url', shape: 'gcsoundcloud', timeout: 45000, host: /(^|\.)(soundcloud\.com|snd\.sc)$/i, hostMsg: 'Link harus dari SoundCloud (soundcloud.com atau on.soundcloud.com).' },
    // GET /api/downloader/youtube?url=&raw=false -> { meta:{title,uploader,duration_string,...}, formats:{progressive[],video_only[],audio_only[]}, best:{...} }
    'youtube-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_YOUTUBE || '/api/downloader/youtube', method: 'GET', param: 'url', qs: { raw: 'false' }, shape: 'gcyoutube', timeout: 50000, host: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i, hostMsg: 'Link harus dari YouTube (youtube.com atau youtu.be).' }
    ,
    // GET /api/v2/maker/brat?text=&emojiStyle=&background=&color= -> gambar (PNG) langsung. Kunci tetap dari GENCIPTA_API_KEY (server), tidak pernah dikirim ke browser.
    'brat-v1': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_BRAT || '/api/v2/maker/brat', method: 'GET', qs: { emojiStyle: 'apple' }, shape: 'image', timeout: 30000,
      fields: [
        { key: 'text', label: 'Teks', req: true, max: 300 },
        { key: 'background', label: 'Warna latar', kind: 'color', max: 7 },
        { key: 'color', label: 'Warna teks', kind: 'color', max: 7 }
      ] }
    ,
    // GET /api/maker/bratvid?text=&background=&color= -> video (MP4) langsung, dikirim ke browser sebagai data URI (maksimal ±3,2 MB).
    'bratvid': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_BRATVID || '/api/maker/bratvid', method: 'GET', shape: 'video', timeout: 40000,
      fields: [
        { key: 'text', label: 'Teks', req: true, max: 300 },
        { key: 'background', label: 'Warna latar', kind: 'color', max: 7 },
        { key: 'color', label: 'Warna teks', kind: 'color', max: 7 }
      ] }
    ,
    // GET /api/maker/fake-ch-ios?avatar=&name=&followers=&time= -> gambar (mockup Info Saluran WhatsApp iOS) langsung.
    'fake-channel': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_FAKECH || '/api/maker/fake-ch-ios', method: 'GET', shape: 'image', timeout: 40000,
      fields: [
        { key: 'avatar', label: 'Foto profil', req: true, kind: 'url', max: 2000 },
        { key: 'name', label: 'Nama saluran', req: true, max: 60 },
        { key: 'followers', label: 'Pengikut', req: true, max: 20 },
        { key: 'time', label: 'Jam status bar', req: true, max: 8 }
      ] }
    ,
    // GET /api/maker/fake-call-ios?avatar=&name=&duration= -> gambar (mockup layar panggilan WhatsApp iOS) langsung.
    'fake-call': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_FAKECALL || '/api/maker/fake-call-ios', method: 'GET', shape: 'image', timeout: 40000,
      fields: [
        { key: 'avatar', label: 'Foto profil', req: true, kind: 'url', max: 2000 },
        { key: 'name', label: 'Nama kontak', req: true, max: 60 },
        { key: 'duration', label: 'Durasi panggilan', req: true, max: 10 }
      ] }
    ,
    // GET /api/maker/jarvis-meme?text= -> gambar meme Jarvis (teks otomatis dibungkus dan disesuaikan ukurannya) langsung.
    'jarvis-meme': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_JARVIS || '/api/maker/jarvis-meme', method: 'GET', shape: 'image', timeout: 30000,
      fields: [
        { key: 'text', label: 'Teks meme', req: true, max: 300 }
      ] }
    ,
    // GET /api/maker/igqc?text=&image=&time= -> gambar (mockup Instagram Quick Chat: pesan, gambar opsional, jam menu, bar reaksi emoji) langsung. Semua parameter opsional.
    'igqc': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_IGQC || '/api/maker/igqc', method: 'GET', shape: 'image', timeout: 40000,
      fields: [
        { key: 'text', label: 'Pesan', max: 300 },
        { key: 'image', label: 'Gambar', kind: 'url', max: 2000 },
        { key: 'time', label: 'Jam menu', max: 20 }
      ] }
    ,
    // GET /api/tools/image-to-prompt?url= -> { status, result: "teks prompt" }
    'image-to-prompt': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_IMG2PROMPT || '/api/tools/image-to-prompt', method: 'GET', param: 'url', shape: 'gcprompt', timeout: 50000 }
    ,
    // POST /api/tools/bypass-cf  body JSON { url, sitekey? } -> { status, token, mode_used, duration }. Token Turnstile sekali pakai, cepat kedaluwarsa. Tidak diulang otomatis.
    'bypass-cf': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_BYPASSCF || '/api/tools/bypass-cf', method: 'POST', shape: 'gcbypass', timeout: 50000,
      fields: [
        { key: 'url', label: 'Link situs target', req: true, kind: 'url', max: 2000 },
        { key: 'sitekey', label: 'Site key', max: 100 }
      ] }
    ,
    // GET /api/v2/tools/upscale?url= -> gambar PNG biner langsung (2x). Lambat (±25 detik). Hasil besar (>3,2 MB) disimpan sementara di Blob uploads/ lalu dikirim sebagai link.
    // POST /api/tools/amdata  body JSON { url } (link share Alight Motion) -> { status, provider, data:{ result, info:{ title, size, amVersionString, amPlatform, downloads, likes, shareDate:{_seconds}, requiredEffects[], projects[], largeThumbUrl }, download, freeUserMaxDownloadSize } }
    'am-data': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_AMDATA || '/api/tools/amdata', method: 'POST', body: { url: 'url' }, shape: 'gcamdata', timeout: 45000, host: /(^|\.)(alightcreative\.com|alightmotion\.com)$/i, hostMsg: 'Link harus berupa link share Alight Motion (alightcreative.com/am/share/...).' },
    // GET /api/tools/removebg?url= -> PNG transparan biner langsung. Hasil besar (>3,2 MB) disimpan sementara di Blob uploads/.
    'hapus-background': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_REMOVEBG || '/api/tools/removebg', method: 'GET', shape: 'image', timeout: 45000, bigToBlob: true,
      fields: [
        { key: 'url', label: 'Gambar', req: true, kind: 'url', max: 2000 }
      ] }
    ,
    // POST /api/v2/maker/carbon  body JSON { code } -> gambar (Carbon, kode dengan syntax highlight) langsung. Lambat (±10 detik).
    'carbon': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_CARBON || '/api/v2/maker/carbon', method: 'POST', shape: 'image', timeout: 50000, bigToBlob: true,
      fields: [
        { key: 'code', label: 'Kode', req: true, max: 5000 }
      ] }
    ,
    // POST /api/getcontact/verification/start  body JSON { phone: '+62...' } -> { status, data:{ flowId, phoneNumber, link (wa.me), code, expiresIn (detik) } }. Tidak memakai kuota API.
    // Pengguna harus mengirim pesan WhatsApp yang sudah disiapkan (link wa.me) sebelum langkah cek. Endpoint cek belum dipasang (dokumentasinya belum ada).
    'getcontact-start': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_GC_START || '/api/getcontact/verification/start', method: 'POST', body: { phone: 'phone' }, phone: true, pattern: /^\+\d{8,15}$/, patternMsg: 'Nomor tidak valid. Contoh: +6281234567890 atau 081234567890.', shape: 'gcgcstart', timeout: 35000 }
    ,
    'upscale': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_UPSCALE || '/api/v2/tools/upscale', method: 'GET', shape: 'image', timeout: 52000, bigToBlob: true,
      fields: [
        { key: 'url', label: 'Gambar', req: true, kind: 'url', max: 2000 }
      ] }
    ,
    // GET /api/tools/toqr?... -> gambar QR Code PNG biner langsung (Content-Type image/png). Cepat. Nama parameter teks dikirim sebagai text, url, dan target sekaligus supaya cocok dengan dokumentasi gateway.
    'qr-code': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_TOQR || '/api/tools/toqr', method: 'GET', shape: 'image', timeout: 30000,
      fields: [
        { key: 'text', label: 'Target URL/Teks', req: true, max: 1000, as: ['text', 'url', 'target'] }
      ] }
    ,
    // GET /api/tools/ssweb?url=&viewport=&fullpage= -> gambar screenshot situs (PNG/JPG) biner langsung. viewport: pc | tablet | android. fullpage: true | false. Hasil besar (>3,2 MB) disimpan sementara di Blob uploads/.
    'ssweb': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_SSWEB || '/api/tools/ssweb', method: 'GET', shape: 'image', timeout: 52000, bigToBlob: true,
      fields: [
        { key: 'url', label: 'Link situs', req: true, kind: 'url', max: 2000 },
        { key: 'viewport', label: 'Viewport', kind: 'enum', opts: ['pc', 'tablet', 'android'] },
        { key: 'fullpage', label: 'Full page', kind: 'enum', opts: ['true', 'false'], as: ['fullpage', 'fullPage', 'full_page'] }
      ] }
    ,
    // GET /api/tools/tts-google?text=&language= -> audio MP3 biner langsung (Google TTS / Gemini). Cepat (<1 detik untuk teks pendek). language contoh: ja-JP.
    'tts-google': { gc: true, base: GC_BASE, type: 'multi', path: process.env.GENCIPTA_PATH_TTSGOOGLE || '/api/tools/tts-google', method: 'GET', shape: 'image', timeout: 40000,
      fields: [
        { key: 'text', label: 'Teks', req: true, max: 1000, as: ['text', 'input'] },
        { key: 'language', label: 'Bahasa', kind: 'enum', opts: ['ja-JP', 'id-ID', 'en-US', 'en-GB', 'ko-KR', 'zh-CN', 'ar-XA', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'ru-RU', 'th-TH', 'vi-VN', 'tr-TR'] }
      ] }
    ,
    // GET /api/tools/web/open-graph?url= -> { hybridGraph, openGraph, htmlInferred, requestInfo, ... } metadata situs. requestInfo tidak ditampilkan ke pengguna.
    'open-graph': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_OPENGRAPH || '/api/tools/web/open-graph', method: 'GET', param: 'url', shape: 'gcopengraph', timeout: 40000 }
    ,
    // api-cloud: GET /canvas/iqcdark?text=&image=&time= (image dan time opsional) -> { status, creator, mime:'image/png', base64:'...' } (gambar kartu chat gelap). status:false -> { error }.
    'iqc-dark': { ac: true, base: AC_BASE, type: 'multi', path: process.env.CLOUDAPI_PATH_IQCDARK || '/canvas/iqcdark', method: 'GET', keyParam: AC_KEY_PARAM, shape: 'cloudimg', bigToBlob: true, timeout: 45000,
      fields: [
        { key: 'text', label: 'Pesan', req: true, max: 300 },
        { key: 'image', label: 'Gambar', kind: 'url', max: 2000 },
        { key: 'time', label: 'Jam', max: 20 }
      ] }
    ,
    // api-cloud: GET /maker/duarviral?url= (url = link gambar) -> { status, creator, result:'data:image/jpeg;base64,...', backgroundRemoved, quota:{...} }. Gambar orang/karakter ditempel ke latar ledakan.
    // result berupa data URI, dibaca bentuk 'cloudimg' di tool.js (juga menerima { mime, base64 }); quota tidak diteruskan ke browser. status:false -> { error }.
    'duar-viral': { ac: true, base: AC_BASE, type: 'multi', path: process.env.CLOUDAPI_PATH_DUARVIRAL || '/maker/duarviral', method: 'GET', keyParam: AC_KEY_PARAM, shape: 'cloudimg', bigToBlob: true, timeout: 50000,
      fields: [
        { key: 'url', label: 'Gambar', req: true, kind: 'url', max: 2000 }
      ] }
    ,
    // api-cloud (plan Pro & Enterprise): GET /tools/swhd?url=&json= -> jernihkan dan upscale gambar atau video jadi HD. url = link langsung file JPG/PNG/WebP atau video MP4/MOV/WebM (hasil video biner >3,2 MB juga disimpan sementara di Blob). json dikosongkan = "File langsung" (bawaan docs, gambar biner);
    // dipakai agar hasil besar bisa disimpan sementara di Blob (bigToBlob) dan tidak kena batas ±3,2 MB data URI. Opsi "JSON base64" (maks. 25 MB) juga terbaca bentuk cloudimg. Kunci hanya dari env CLOUDAPI_API_KEY (server).
    'swhd': { ac: true, base: AC_BASE, type: 'multi', path: process.env.CLOUDAPI_PATH_SWHD || '/tools/swhd', method: 'GET', keyParam: AC_KEY_PARAM, shape: 'cloudimg', bigToBlob: true, timeout: 55000,
      fields: [
        { key: 'url', label: 'Foto atau video', req: true, kind: 'url', max: 2000 }
      ] }
    ,
    // api-cloud (plan Pro & Enterprise) AM Prem V2 = Amprem V5: GET /premium/amprem5?action=&email=&link=. Dua langkah, sama seperti AM Generator:
    // langkah 1 (kirim link verifikasi ke email) lalu langkah 2 (verifikasi link dari email, memakai 1 koin). action 1 = Kirim link, action 2 = Verifikasi (sesuai docs api-cloud). Nilai bisa diubah lewat env bila docs berubah.
    'am-send2': { ac: true, base: AC_BASE, type: 'email', path: process.env.CLOUDAPI_PATH_AMPREM5 || '/premium/amprem5', method: 'GET', param: 'email', keyParam: AC_KEY_PARAM, qs: { action: process.env.CLOUDAPI_AMPREM5_ACTION_SEND || '1' }, shape: 'acam', timeout: 40000 },
    'am-verif2': { ac: true, base: AC_BASE, type: 'email-link', path: process.env.CLOUDAPI_PATH_AMPREM5 || '/premium/amprem5', method: 'GET', param: 'email', linkParam: 'link', keyParam: AC_KEY_PARAM, qs: { action: process.env.CLOUDAPI_AMPREM5_ACTION_VERIF || '2' }, shape: 'acam', timeout: 55000 }
    ,
    // api-cloud: GET /canvas/quotecard?text=&bold=&json=&template=&apikey= (text wajib; bold 0|1; template 1-5, kosong = default). json=0 -> gambar langsung (image/jpeg), dibaca sebagai biner di api/tool.js.
    'quote-card': { ac: true, base: AC_BASE, type: 'multi', path: process.env.CLOUDAPI_PATH_QUOTECARD || '/canvas/quotecard', method: 'GET', keyParam: AC_KEY_PARAM, shape: 'cloudimg', bigToBlob: true, timeout: 45000, qs: { json: '0' },
      fields: [
        { key: 'text', label: 'Teks', req: true, max: 200 },
        { key: 'bold', label: 'Gaya teks', kind: 'enum', opts: ['0', '1'] },
        { key: 'template', label: 'Template', kind: 'enum', opts: ['1', '2', '3', '4', '5'] }
      ] }
    ,
    // api-cloud: GET /tools/amfind?url= (link video TikTok) -> { status, creator, result:{ videoId, video, author, scanned:{comments,replies}, presets:[] }, quota }. Memindai komentar mencari link preset Alight Motion. status:false -> { error }.
    'am-find': { ac: true, base: AC_BASE, type: 'url', path: process.env.CLOUDAPI_PATH_AMFIND || '/tools/amfind', method: 'GET', param: 'url', keyParam: AC_KEY_PARAM, shape: 'amfind', timeout: 60000, host: /(^|\.)tiktok\.com$/i, hostMsg: 'Link harus dari TikTok (tiktok.com, vt.tiktok.com, atau vm.tiktok.com).' }
    ,
    // api-cloud: GET /tools/storyclean?mode=story&apikey= -> { status, creator, result:{ mode, job, filename, type, bytes, status:'ready', code, note } }. Membuat job dan kode; kode dikirim pengguna ke bot WhatsApp BOT-1. status:false -> { error }.
    'story-clean': { ac: true, base: AC_BASE, type: 'multi', path: process.env.CLOUDAPI_PATH_STORYCLEAN || '/tools/storyclean', method: 'GET', keyParam: AC_KEY_PARAM, shape: 'storyclean', timeout: 40000,
      fields: [
        { key: 'mode', label: 'Mode', req: true, kind: 'enum', opts: ['story'] }
      ] }
    ,
    // Cek Situs: dikerjakan langsung oleh server ini (tanpa provider), lihat siteCheck() di tool.js.
    'cek-situs': { local: 'sitecheck', type: 'url' },
    // NexaDev: GET /api/rch?key=&url=&reaction= (kunci dari env NEXADEV_API_KEY, ditangani di api/tool.js)
    'rch': { local: 'nexarch', type: 'multi' }
    ,
    // api-cloud (plan Pro): V2 GET /tools/rch?link=&emoji= dan V3 GET /tools/reactch-v4?url=&reaction=. Koin sama dengan Reaksi Channel (lihat _credits.js). Ditangani reactChannelCloud() di api/tool.js.
    'rch2': { local: 'nexarch', variant: 'v2', type: 'multi' }
    ,
    'rch3': { local: 'nexarch', variant: 'v3', type: 'multi' }
  }
};
