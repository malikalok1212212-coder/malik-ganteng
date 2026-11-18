// Semua pengaturan provider ada di sini. Tambah tool baru = tambah satu entri di "tools".
// Provider: GenCipta (https://api.gencipta.com/id/docs). Kunci dikirim lewat header Authorization: Bearer, hanya dari server.
const GC_BASE = (process.env.GENCIPTA_BASE_URL || 'https://gateway.gencipta.com').replace(/\/$/, '');
module.exports = {
  gcBase: GC_BASE,
  gcKey: process.env.GENCIPTA_API_KEY || '',
  tools: {
    // GET /api/spotify/search?q=&limit= -> { status, query, total, data:[{ id, title, artist, album, duration, cover_url, spotify_url, stream_url }] }
    // stream_url butuh API key di header, jadi tidak diberikan ke browser. Unduh/stream menyusul dari endpoint Spotify lain.
    'spotify-play': { gc: true, base: GC_BASE, type: 'text', path: process.env.GENCIPTA_PATH_SPOTIFY_SEARCH || '/api/spotify/search', method: 'GET', param: 'q', qs: { limit: '10' }, shape: 'gcspotify', timeout: 30000 },
    // Langkah 1: POST /api/am-generator/send-link  body JSON { email } -> { success, email, message }
    'am-send': { gc: true, base: GC_BASE, type: 'email', path: process.env.GENCIPTA_PATH_AM_SEND || '/api/am-generator/send-link', method: 'POST', body: { email: 'email' }, shape: 'gcamsend', timeout: 30000 },
    // Langkah 2: POST /api/am-generator/verify-link  body JSON { email, magicLink } -> { success, message, data:{ email, planName, membershipStatus, validUntil, ... } }
    'am-verif': { gc: true, base: GC_BASE, type: 'email-link', path: process.env.GENCIPTA_PATH_AM_VERIF || '/api/am-generator/verify-link', method: 'POST', body: { email: 'email', link: 'magicLink' }, shape: 'gcamverif', timeout: 45000 },
    // GET /api/downloader/tiktok?url=  -> { status, title, duration, data:[{type:watermark|nowatermark|nowatermark_hd,url}], music_info:{url}, author:{nickname} }
    'tiktok-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_TIKTOK || '/api/downloader/tiktok', method: 'GET', param: 'url', shape: 'gctiktok', timeout: 40000, host: /(^|\.)tiktok\.com$/i, hostMsg: 'Link harus dari TikTok (tiktok.com, vt.tiktok.com, atau vm.tiktok.com).' }
    ,
    // GET /api/downloader/instagram-v2?url=[&type=] (reels, video, foto, carousel, DP, stories, highlights). Balasan: { status, data:{ metadata, author, media:{ thumbnail, thumbnails[], videos[{url,type,resolution}] } } }, dibaca gcInstagram (cadangan: pembaca umum aio).
    'ig-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_INSTAGRAM || '/api/downloader/instagram-v2', method: 'GET', param: 'url', shape: 'gcinstagram', timeout: 45000, host: /(^|\.)instagram\.com$/i, hostMsg: 'Link harus dari Instagram (instagram.com).' },
    // GET /api/downloader/mediafire?url= -> { status, data:{ fileName, fileSize, fileExtension, directDownloadUrl, mediafireUrl, requiresLogin, isPasswordProtected } }
    'mediafire-dl': { gc: true, base: GC_BASE, type: 'url', path: process.env.GENCIPTA_PATH_MEDIAFIRE || '/api/downloader/mediafire', method: 'GET', param: 'url', shape: 'file', timeout: 45000, host: /(^|\.)mediafire\.com$/i, hostMsg: 'Link harus dari Mediafire (mediafire.com).' },
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
  }
};
