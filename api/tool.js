const cfg = require('./_config');
const { getUser, isOwner, loginRequired, roleOf } = require('./_auth');
const credits = require('./_credits');
const store = require('./_store');
const stats = require('./_stats');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { /* opsional */ }

const rate = require('./_rate');

// Respons fungsi Vercel dibatasi 4,5 MB. Base64 membesarkan data ±33%, jadi gambar mentah maksimal ±3,2 MB (≈4,3 MB setelah base64).
const MAX_IMG_RAW = 3200000;


// Kenali gambar dari byte awal (PNG, JPEG, WebP, GIF) bila provider membalas biner tanpa content-type gambar.
// Video biner (MP4 / WebM / MOV) dikenali dari byte awal bila content-type tidak jelas.
function sniffVideo(b) {
  if (!b || b.length < 12) return null;
  if (b.toString('ascii', 4, 8) === 'ftyp') return b.toString('ascii', 8, 12).startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}
function sniffImage(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  return null;
}
const PREFER = ['result', 'output', 'image', 'url', 'link'];
function findLink(v, skip) {
  if (typeof v === 'string') { const m = v.match(/https?:\/\/[^\s"'<>]+/); return m && m[0] !== skip ? m[0] : null; }
  if (v && typeof v === 'object') {
    for (const k of PREFER) if (k in v) { const f = findLink(v[k], skip); if (f) return f; }
    for (const k of Object.keys(v)) { const f = findLink(v[k], skip); if (f) return f; }
  }
  return null;
}


// ---- TikTok Downloader: ambil video / foto / musik dari berbagai bentuk balasan api-cloud ----
const IMG_EXT = /\.(jpe?g|png|webp|heic|avif)(\?|$)/i;
const VID_EXT = /\.(mp4|mov|webm)(\?|$)/i;
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
function pickUrl(it) {
  if (!it) return null;
  if (typeof it === 'string') return it;
  if (Array.isArray(it)) return pickUrl(it[0]);
  return it.url || it.display_url || it.image_url || it.imageUrl || it.download_url || it.src || it.link || pickUrl(it.url_list) || pickUrl(it.urlList) || null;
}
function tiktok(raw) {
  const r = (raw && (raw.data || raw.result)) || raw;
  if (!r || typeof r !== 'object') return null;
  const type = String(r.type || r.media_type || r.mediaType || '').toLowerCase();
  const photoType = /image|photo|slide|carousel/.test(type);
  let imgs = [];
  for (const c of [r.images, photoType ? r.download : null, r.photos, r.pictures, r.slides, r.slideshow, r.image_post && r.image_post.images, r.media && r.media.images]) {
    if (!c) continue;
    const urls = (Array.isArray(c) ? c : [c]).map(pickUrl).filter((u) => isHttp(u) && !VID_EXT.test(u));
    if (urls.length) { imgs = [...new Set(urls)]; break; }
  }
  let video = null;
  const vlist = [r.no_watermark, r.video, r.play, r.nowm, r.nwm, r.hd, r.download_url, r.video_data && r.video_data.nwm, typeof r.media === 'string' ? r.media : null, r.url, r.with_watermark];
  for (const v of vlist) { const u = pickUrl(v); if (isHttp(u) && !IMG_EXT.test(u)) { video = u; break; } }
  const mu = pickUrl(r.music) || pickUrl(r.audio) || (r.music_info && (pickUrl(r.music_info.play) || pickUrl(r.music_info.url)));
  const photo = photoType ? imgs.length > 0 : (/video/.test(type) ? false : (imgs.length && video ? imgs.length > 1 : imgs.length > 0));
  if (!photo && !video) return null;
  const a = r.author;
  const author = (a && (a.nickname || a.username || a.name)) || (typeof a === 'string' ? a : '') || r.nickname || '';
  const data = { judul: String(r.title || r.desc || r.caption || r.description || '').slice(0, 300), penulis: String(author || '').slice(0, 80), jenis: photo ? 'Foto slide' : 'Video' };
  if (photo) { data.jumlah_foto = imgs.length; imgs.slice(0, 20).forEach((u, i) => { data['foto_' + (i + 1)] = u; }); }
  else data.video = video;
  if (isHttp(mu)) data.musik = mu;
  return { link: photo ? imgs[0] : video, data };
}

// Telusuri JSON balasan provider (maks. kedalaman 7) dan kumpulkan URL media. Foto sampul/thumbnail dibuang bila ada video.
function deepMedia(raw) {
  const out = [], seen = new Set();
  const EXT = /\.(mp4|m4v|mov|webm|mp3|m4a|aac|opus|jpe?g|png|webp|heic|avif)(\?|#|$)/i;
  const KEY = /video|download|audio|media|image|photo|display|src|url|link|hd|sd/i;
  const BADK = /profile|avatar|pfp|favicon|logo|icon|emoji|sprite|permalink|shortcode|webpage|page_?url|source_?url|original_?url|post_?url/i;
  const walk = (v, key, depth) => {
    if (depth > 7 || out.length >= 40) return;
    if (typeof v === 'string') {
      if (!isHttp(v) || v.length > 2000 || seen.has(v)) return;
      const k = String(key || '');
      if (BADK.test(k)) return;
      if (/^https?:\/\/([^/]+\.)?instagram\.com\/(p|reel|reels|tv|stories)\//i.test(v)) return; // alamat halaman, bukan file
      if (EXT.test(v) || KEY.test(k)) { seen.add(v); out.push({ u: v, k }); }
      return;
    }
    if (Array.isArray(v)) { for (const x of v.slice(0, 40)) walk(x, key, depth + 1); return; }
    if (v && typeof v === 'object') { for (const k of Object.keys(v).slice(0, 60)) walk(v[k], k, depth + 1); }
  };
  walk(raw, '', 0);
  const hasVid = out.some((o) => /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(o.u) || /video/i.test(o.k));
  return hasVid ? out.filter((o) => !/thumb|cover|poster|preview|display/i.test(o.k) || /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(o.u)) : out;
}

// Pesan error provider + petunjuk tambahan bila ada (daftar nilai yang didukung, detail, alasan), supaya penyebab gagal terlihat.
function errText(data, fb) {
  let m = '';
  if (data && typeof data === 'object') {
    m = typeof data.result === 'string' ? data.result : (data.message || data.error || '');
    if (m && typeof m === 'object') m = m.message || JSON.stringify(m).slice(0, 160);
    const extra = [];
    const scan = (o, d) => {
      if (!o || typeof o !== 'object' || d > 2) return;
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (Array.isArray(v) && v.length && v.length <= 30 && v.every((x) => typeof x === 'string' && x.length <= 40) && /support|valid|allow|avail|types?|options?|enum|accept/i.test(k)) extra.push('didukung: ' + v.join(', '));
        else if (typeof v === 'string' && v && v !== m && v.length <= 200 && /^(detail|details|hint|reason|info|description|error_?description)$/i.test(k)) extra.push(v);
        else if (v && typeof v === 'object' && !Array.isArray(v)) scan(v, d + 1);
      }
    };
    scan(data, 0);
    if (extra.length) m = String(m || fb) + ' (' + extra.join('; ').slice(0, 300) + ')';
  } else if (typeof data === 'string') m = data;
  return String(m || fb).slice(0, 500);
}

// ---- Instagram Downloader (GenCipta /api/downloader/instagram-v2): data:{ metadata, author, media:{ thumbnail, thumbnails[], videos[{url,type,resolution}], images[]? } } ----
function gcInstagram(raw) {
  const d = raw && typeof raw === 'object' ? raw.data : null;
  const m = d && typeof d === 'object' && d.media && typeof d.media === 'object' ? d.media : null;
  if (!m) return null;
  const md = d.metadata && typeof d.metadata === 'object' ? d.metadata : {}, au = d.author && typeof d.author === 'object' ? d.author : {};
  const area = (o) => { const x = /(\d+)\s*x\s*(\d+)/.exec(String((o && (o.resolution || '')) || (o && o.width && o.height ? o.width + 'x' + o.height : ''))); return x ? +x[1] * +x[2] : 0; };
  const vids = (Array.isArray(m.videos) ? m.videos : []).filter((v) => v && isHttp(pickUrl(v))).sort((a, b) => area(b) - area(a));
  let imgs = [];
  for (const k of ['images', 'photos', 'pictures', 'slides', 'items']) {
    if (Array.isArray(m[k]) && m[k].length) { imgs = m[k].map((x) => pickUrl(x)).filter(isHttp); if (imgs.length) break; }
  }
  if (!vids.length && !imgs.length) { // post foto tunggal: pakai thumbnail beresolusi terbesar
    const th = (Array.isArray(m.thumbnails) ? m.thumbnails : []).filter((x) => x && isHttp(pickUrl(x))).sort((a, b) => area(b) - area(a));
    const u = th.length ? pickUrl(th[0]) : pickUrl(m.thumbnail);
    if (isHttp(u)) imgs = [u];
  }
  if (!vids.length && !imgs.length) return null;
  const data = {};
  if (md.caption) data.judul = String(md.caption).trim().slice(0, 300);
  const pen = au.username || au.fullName; if (pen) data.penulis = String(pen).slice(0, 80);
  data.jenis = vids.length ? 'Video' : (imgs.length > 1 ? 'Foto carousel' : 'Foto');
  if (vids.length) {
    if (vids[0].resolution) data.resolusi = String(vids[0].resolution).slice(0, 20);
    vids.slice(0, 10).forEach((v, i) => { data[i ? 'video_' + (i + 1) : 'video'] = pickUrl(v); });
  } else imgs.slice(0, 20).forEach((u, i) => { data['foto_' + (i + 1)] = u; });
  return { link: vids.length ? pickUrl(vids[0]) : imgs[0], data };
}

// ---- GetContact Verifikasi (GenCipta /api/getcontact/verification/start): link wa.me + kode, berlaku sekitar 15 menit ----
function gcGcStart(raw) {
  const d = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' ? raw.data : null;
  if (!d || typeof d.link !== 'string' || !/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(d.link) || !d.code) return null;
  const data = { kode: String(d.code).slice(0, 80) };
  if (d.phoneNumber) data.nomor = String(d.phoneNumber).slice(0, 20);
  const ex = Number(d.expiresIn); if (Number.isFinite(ex) && ex > 0) data.berlaku_detik = Math.min(ex, 86400);
  if (d.flowId) data.flow_id = String(d.flowId).slice(0, 80);
  return { link: d.link.slice(0, 2000), data };
}

// ---- AIO Downloader (Nexa /api/aio): rapikan daftar media (video / audio / foto) dari berbagai bentuk balasan ----
function aio(raw) {
  const r = (raw && (raw.data || raw.result)) || raw;
  if (!r || typeof r !== 'object') return null;
  // balasan { status, title, data:[{type,url}] }: daftar ada di data, info lain di level atas
  const root = Array.isArray(r) ? { ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}), medias: r } : r;
  let list = null;
  for (const k of ['download_links', 'medias', 'media', 'links', 'downloads', 'download', 'formats', 'urls', 'items', 'result', 'data']) {
    const c = root[k]; if (Array.isArray(c) && c.length) { list = c; break; }
  }
  const found = [];
  const kindOf = (u, hint) => {
    const h = String(hint || '').toLowerCase();
    if (IMG_EXT.test(u) || /image|photo|foto|(^|[^a-z])(jpe?g|png|webp|heic|avif)([^a-z]|$)/.test(h)) return 'foto';
    if (/audio|mp3|m4a|opus|aac|music/.test(h) && !/video|mp4/.test(h)) return 'audio';
    if (/\.(mp3|m4a|opus|aac)(\?|$)/i.test(u)) return 'audio';
    return 'video';
  };
  if (list) {
    for (const it of list) {
      const u = pickUrl(it); if (!isHttp(u)) continue;
      const o = (it && typeof it === 'object') ? it : {};
      const hint = [o.type, o.mime, o.mimeType, o.extension, o.ext, o.format, o.kind].filter(Boolean).join(' ');
      found.push({ u, kind: kindOf(u, hint), label: String(o.quality || o.resolution || o.label || o.format || o.ext || o.extension || (/\bHD\b/.test(String(o.type || '')) ? 'HD' : '')).slice(0, 20) });
    }
  } else {
    for (const [k, kind] of [['video', 'video'], ['no_watermark', 'video'], ['nowm', 'video'], ['hd', 'video'], ['sd', 'video'], ['url', null], ['download_url', null], ['audio', 'audio'], ['music', 'audio'], ['mp3', 'audio'], ['download', null], ['link', null], ['image', 'foto'], ['images', 'foto'], ['photos', 'foto']]) {
      const v = root[k];
      for (const it of (Array.isArray(v) ? v : [v])) {
        const u = pickUrl(it); if (!isHttp(u)) continue;
        found.push({ u, kind: kind || kindOf(u, ''), label: (k === 'hd' || k === 'sd') ? k.toUpperCase() : '' });
      }
    }
  }
  // Bentuk balasan tidak dikenal: telusuri seluruh JSON, ambil URL yang tampak seperti media (ekstensi file atau nama field unduhan)
  if (!found.length) {
    for (const d of deepMedia(raw)) found.push({ u: d.u, kind: kindOf(d.u, d.k), label: '' });
    if (!found.length) console.error('[aio] balasan tidak dikenal, kunci:', Object.keys(r).slice(0, 15).join(','));
  }
  const seen = new Set(), items = [];
  for (const f of found) { if (!seen.has(f.u)) { seen.add(f.u); items.push(f); } }
  if (!items.length) return null;
  const a = root.author;
  const data = { judul: String(root.title || root.desc || root.caption || root.description || root.name || '').slice(0, 300) };
  const pen = (a && (a.nickname || a.username || a.name)) || (typeof a === 'string' ? a : '') || root.nickname || root.uploader || (typeof root.artist === 'string' ? root.artist : (root.artist && root.artist.name) || '') || '';
  if (pen) data.penulis = String(pen).slice(0, 80);
  const src = root.source || root.platform || root.site || root.extractor || '';
  if (src && typeof src === 'string') data.sumber = src.slice(0, 40);
  const used = {};
  items.slice(0, 20).forEach((f) => {
    const base = f.kind + (f.label ? '_' + f.label.replace(/[^\w]+/g, '') : '');
    used[base] = (used[base] || 0) + 1;
    data[used[base] > 1 ? base + '_' + used[base] : base] = f.u;
  });
  if (!data.judul) delete data.judul;
  const first = items.find((f) => f.kind === 'video') || items.find((f) => f.kind === 'audio') || items[0];
  return { link: first.u, data };
}

// ---- TikTok Downloader (GenCipta /api/downloader/tiktok): data[] berisi watermark / nowatermark / nowatermark_hd ----
function gcTiktok(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const list = Array.isArray(raw.data) ? raw.data : [];
  const names = { nowatermark_hd: 'video_HD', nowatermark: 'video', watermark: 'video_watermark' };
  const order = ['nowatermark_hd', 'nowatermark', 'watermark'];
  const vids = {}, imgs = [];
  for (const it of list) {
    const u = it && it.url; if (!isHttp(u)) continue;
    const ty = String(it.type || '').toLowerCase();
    if (names[ty]) { if (!vids[ty]) vids[ty] = u; }
    else if (IMG_EXT.test(u) || /image|photo|slide/.test(ty)) imgs.push(u);
  }
  const a = raw.author || {};
  const data = { judul: String(raw.title || '').slice(0, 300) };
  const pen = a.nickname || a.fullname || a.username || ''; if (pen) data.penulis = String(pen).slice(0, 80);
  if (raw.duration) data.durasi = String(raw.duration).slice(0, 30);
  const seen = new Set();
  for (const ty of order) { if (vids[ty] && !seen.has(vids[ty])) { seen.add(vids[ty]); data[names[ty]] = vids[ty]; } }
  [...new Set(imgs)].slice(0, 20).forEach((u, i) => { data['foto_' + (i + 1)] = u; });
  const mu = raw.music_info && raw.music_info.url; if (isHttp(mu)) data.audio = mu;
  if (!data.judul) delete data.judul;
  const link = vids.nowatermark_hd || vids.nowatermark || vids.watermark || imgs[0] || null;
  return link ? { link, data } : null;
}

// ---- Spotify Track Search (GenCipta /api/spotify/search) ----
function gcSpotify(raw, origin) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.data)) return null;
  const data = {};
  let first = null, n = 0;
  for (const t of raw.data) {
    if (n >= 15) break;
    if (!t || !t.title) continue;
    const id = /^[A-Za-z0-9]{22}$/.test(String(t.id || '')) ? t.id : null;
    // Audio diputar/diunduh lewat /api/audio milik situs ini (key GenCipta tidak pernah ke browser). Akhiran .m4a agar dikenali sebagai audio.
    const url = id && origin ? origin + '/api/audio?id=' + id + '&x=.m4a' : (isHttp(t.spotify_url) ? t.spotify_url : null);
    if (!url) continue;
    n++;
    // tanpa titik di kunci (tampilan membaca titik sebagai tingkat bersarang)
    const label = n + ' \u00b7 ' + String(t.title).replace(/\./g, '').slice(0, 70) + (t.artist ? ' \u2013 ' + String(t.artist).replace(/\./g, '').slice(0, 50) : '') + (t.duration ? ' (' + t.duration + ')' : '');
    data[label] = url;
    if (!first) first = url;
  }
  return n ? { link: first, data } : null;
}

// ---- AM Generator (GenCipta). Token akun (idToken, refreshToken) dan data pribadi lain TIDAK diteruskan ke browser ----
function gcAmSend(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = { status: String(raw.message || 'Email verifikasi terkirim.').slice(0, 200) };
  if (raw.email) data.email = String(raw.email).slice(0, 120);
  return { link: null, data };
}
function gcAmVerif(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const data = { status: String(raw.message || 'Verifikasi berhasil.').slice(0, 200) };
  if (d.email) data.email = String(d.email).slice(0, 120);
  if (d.displayName) data.nama = String(d.displayName).trim().slice(0, 80);
  if (d.planName) data.paket = String(d.planName).slice(0, 80);
  if (d.subscriptionType) data.jenis = String(d.subscriptionType).slice(0, 80);
  if (d.membershipStatus) data.status_premium = String(d.membershipStatus).slice(0, 40);
  if (d.validUntil) data.berlaku_hingga = String(d.validUntil).slice(0, 40);
  return { link: null, data };
}

// ---- Image to Prompt (GenCipta /api/tools/image-to-prompt) ----
function gcPrompt(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = typeof raw.result === 'string' ? raw.result : (raw.result && typeof raw.result.prompt === 'string' ? raw.result.prompt : (typeof raw.prompt === 'string' ? raw.prompt : ''));
  if (!t.trim()) return null;
  return { link: null, data: { prompt: t.trim().slice(0, 4000) } };
}
// ---- Bypass Cloudflare Turnstile (GenCipta /api/tools/bypass-cf) ----
function gcBypass(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.token !== 'string' || !raw.token) return null;
  const data = { token: raw.token.slice(0, 4000) };
  if (raw.mode_used) data.mode = String(raw.mode_used).slice(0, 40);
  if (raw.duration) data.durasi = String(raw.duration).slice(0, 20);
  return { link: null, data };
}

// ---- Alight Motion Data (GenCipta /api/tools/amdata): metadata proyek, UID, dan PID dari link share ----
function gcAmData(raw, inputUrl) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.data && typeof raw.data === 'object' ? raw.data : {};
  const i = d.info && typeof d.info === 'object' ? d.info : null;
  if (!i) return null;
  const data = {};
  if (i.title) data.judul = String(i.title).trim().slice(0, 200);
  const m = String(inputUrl || '').match(/\/share\/u\/([^/?#]+)\/p\/([^/?#]+)/);
  if (m) { data.uid = m[1].slice(0, 80); data.pid = m[2].slice(0, 80); }
  if (Number(i.size)) data.ukuran = (Number(i.size) / 1048576).toFixed(2).replace('.', ',') + ' MB';
  if (i.amVersionString) data.versi_am = String(i.amVersionString).slice(0, 40);
  if (i.amPlatform) data.platform = String(i.amPlatform).slice(0, 20);
  if (Number.isFinite(Number(i.downloads))) data.unduhan = String(Number(i.downloads));
  if (Number.isFinite(Number(i.likes))) data.suka = String(Number(i.likes));
  const sec = i.shareDate && Number(i.shareDate._seconds);
  if (sec) data.dibagikan = new Date(sec * 1000).toISOString().slice(0, 10);
  if (Array.isArray(i.requiredEffects)) data.jumlah_efek = String(i.requiredEffects.length);
  if (Array.isArray(i.projects) && i.projects.length) data.jumlah_proyek = String(i.projects.length);
  if (d.download) data.unduh_diizinkan = String(d.download).slice(0, 30);
  if (Number(d.freeUserMaxDownloadSize)) data.batas_unduh_gratis = (Number(d.freeUserMaxDownloadSize) / 1048576).toFixed(1).replace('.', ',') + ' MB';
  const th = i.largeThumbUrl || i.medThumbUrl || i.smallThumbUrl; if (isHttp(th)) data.thumbnail = th;
  return Object.keys(data).length ? { link: null, data } : null;
}

// ---- YouTube Downloader (GenCipta /api/downloader/youtube) ----
// Hanya link yang bisa diunduh langsung (protokol https). Format HLS (m3u8) tidak bisa disimpan dari browser, jadi dilewati.
function gcYoutube(raw) {
  if (!raw || typeof raw !== 'object' || !raw.formats) return null;
  const m = raw.meta || {}, f = raw.formats || {};
  const direct = (l) => (Array.isArray(l) ? l : []).filter((x) => x && isHttp(x.url) && (!x.protocol || x.protocol === 'https'));
  const h = (x) => Number(x.height) || 0, size = (x) => Number(x.filesize) || 0;
  const mb = (x) => (size(x) ? ' ' + (size(x) / 1048576).toFixed(1) + 'MB' : '');
  const data = { judul: String(m.title || '').slice(0, 300) };
  const pen = m.uploader || m.channel; if (pen) data.penulis = String(pen).slice(0, 80);
  if (m.duration_string) data.durasi = String(m.duration_string).slice(0, 12);
  if (m.view_count) data.dilihat = Number(m.view_count).toLocaleString('id-ID');
  const th = (Array.isArray(m.thumbnails) ? m.thumbnails : []).filter((t) => t && isHttp(t.url) && /\.jpe?g(\?|$)/i.test(t.url)).sort((a, b) => (b.preference || 0) - (a.preference || 0))[0];
  if (th) data.thumbnail = th.url;
  // video + suara (siap putar)
  const prog = direct(f.progressive).sort((a, b) => h(b) - h(a));
  const seen = new Set();
  for (const x of prog) { const k = 'video_' + (h(x) || 'sd') + 'p'; if (!seen.has(k)) { seen.add(k); data[k + mb(x).replace(' ', '_')] = x.url; } }
  // audio saja: m4a terbaik, lalu webm terbaik
  const aud = direct(f.audio_only).sort((a, b) => (Number(b.abr || b.tbr) || 0) - (Number(a.abr || a.tbr) || 0));
  const m4a = aud.find((x) => x.ext === 'm4a'), web = aud.find((x) => x.ext !== 'm4a');
  if (m4a) data['audio_m4a' + mb(m4a).replace(' ', '_')] = m4a.url;
  if (web) data['audio_' + (web.ext || 'webm') + mb(web).replace(' ', '_')] = web.url;
  // video tanpa suara (resolusi tinggi, mp4 saja), maksimal 3 resolusi teratas
  const vo = direct(f.video_only).filter((x) => x.ext === 'mp4').sort((a, b) => h(b) - h(a) || size(b) - size(a));
  const vs = new Set();
  for (const x of vo) { const k = 'video_' + h(x) + 'p_senyap'; if (h(x) && !vs.has(k) && vs.size < 3) { vs.add(k); data[k + mb(x).replace(' ', '_')] = x.url; } }
  if (!data.judul) delete data.judul;
  const first = prog.find((x) => x.url) || aud[0] || vo[0];
  const link = first ? first.url : null;
  return link ? { link, data } : null;
}

// ---- Mediafire (Nexa /api/mediafire): info file (nama, ukuran, tipe) + link unduh. url bisa null bila provider gagal bypass ----
function fileInfo(raw) {
  const r = (raw && (raw.data || raw.result)) || raw;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const url = [r.directDownloadUrl, r.url, r.download, r.download_url, r.link].find((u) => isHttp(u)) || null;
  const name = r.fileName || r.title || r.filename || r.file_name || r.name || '';
  if (!url && !name) return null;
  const data = {};
  if (name) data.nama_file = String(name).slice(0, 300);
  const size = r.fileSize || r.size; if (size) data.ukuran = String(size).slice(0, 30);
  if (r.mime || r.mimetype) data.tipe = String(r.mime || r.mimetype).slice(0, 80);
  const ext = r.fileExtension || r.extension || r.ext; if (ext) data.ekstensi = String(ext).slice(0, 20);
  if (r.isPasswordProtected === true) data.catatan = 'File dilindungi kata sandi, unduhan mungkin gagal.';
  if (url) data.unduh = url;
  return { link: url, data };
}

// Provider yang membalas JSON dengan gambar berupa data URI (mis. {"result":"data:image/jpeg;base64,..."}): ambil sebagai link gambar
function findDataImage(v, depth) {
  if (typeof v === 'string') return /^data:image\/(jpe?g|png|webp|gif);base64,/i.test(v) ? v : null;
  if (!v || typeof v !== 'object' || (depth || 0) > 3) return null;
  for (const k of PREFER) if (k in v) { const f = findDataImage(v[k], (depth || 0) + 1); if (f) return f; }
  for (const k of Object.keys(v)) { const f = findDataImage(v[k], (depth || 0) + 1); if (f) return f; }
  return null;
}
function stripDataImage(v, img, depth) {
  if (typeof v === 'string') return v === img ? '(gambar)' : v;
  if (!v || typeof v !== 'object' || (depth || 0) > 3) return v;
  const o = Array.isArray(v) ? [] : {};
  for (const k of Object.keys(v)) o[k] = stripDataImage(v[k], img, (depth || 0) + 1);
  return o;
}

// Balasan HTML dari provider (halaman Cloudflare "Just a moment...", 503, dll) tidak boleh tampil mentah ke pengguna
function htmlProblem(status, text) {
  const t = String(text || '').slice(0, 3000);
  if (!/^\s*<(!doctype|html|head|body|\?xml)/i.test(t)) return null;
  if (/just a moment|challenges\.cloudflare\.com|cf[-_]chl|attention required|enable javascript and cookies/i.test(t))
    return { msg: 'Provider memblokir akses dari server (verifikasi Cloudflare). Coba lagi nanti atau pakai tool lain.' };
  if (status === 429) return { msg: 'Provider membatasi permintaan (HTTP 429). Coba lagi beberapa saat lagi.' };
  if (status >= 500) return { msg: 'Server provider sedang down atau sibuk (HTTP ' + status + '). Coba lagi beberapa saat lagi.', transient: true };
  return { msg: 'Provider membalas halaman yang tidak dikenali (HTTP ' + status + '). Coba lagi nanti.' };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });

  if (req.method === 'GET' && req.query && req.query.credits) { // sisa kredit pengguna yang sedang masuk
    const u = getUser(req);
    if (!u) return fail(401, 'Masuk dulu untuk melihat kredit.');
    try {
      const rec = await store.getUser(u.sub);
      return res.status(200).json({ ok: true, credits: credits.info(rec, roleOf(u.email, rec)) });
    } catch (e) { return fail(503, 'Data kredit belum bisa dibaca.'); }
  }
  if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');
  if (process.env.ACCESS_CODE && req.headers['x-access-code'] !== process.env.ACCESS_CODE)
    return fail(401, 'Kode akses salah atau belum diisi.');
  if (loginRequired() && !getUser(req))
    return fail(401, 'Masuk dulu untuk memakai tool ini.');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (await rate.limited('tool', ip, 20, 60)) return fail(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  // Nama tool datang dari pengguna: hanya kunci milik sendiri yang sah ("constructor", "__proto__" bukan tool)
  const tid = typeof body.tool === 'string' ? body.tool : '';
  let tool = Object.prototype.hasOwnProperty.call(cfg.tools, tid) ? cfg.tools[tid] : null;
  const custom = null;
  const me = getUser(req);
  if (me && !isOwner(me.email) && await store.isBanned(me.sub)) return fail(403, 'Akun kamu diblokir oleh developer.');
  if (!tool) return fail(400, 'Tool tidak dikenal.');
  if (store.ready() && !(me && isOwner(me.email))) { // dinonaktifkan sementara oleh developer (developer sendiri tetap bisa mencoba)
    try { const o = await store.getTool('__off'); if (o && Array.isArray(o.list) && o.list.includes(tid)) return fail(503, 'Tool ini sedang dinonaktifkan sementara karena ada gangguan. Coba lagi nanti.'); }
    catch (e) { /* Redis bermasalah: biarkan lewat */ }
  }
  if (!cfg.gcKey) return fail(500, 'GENCIPTA_API_KEY belum diatur di Environment Variables Vercel.');

  let input = String(body.input !== undefined ? body.input : body.email || '').trim();
  let link2 = '', multi = null;
  if (tool.type === 'email' || tool.type === 'email-link') {
    input = input.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input)) return fail(400, 'Format email tidak valid.');
    if (tool.type === 'email-link') {
      link2 = String(body.link || '').trim();
      if (!link2 || link2.length > 2000) return fail(400, 'Isi link atau kode verifikasi dari email (maksimal 2000 karakter).');
    }
  } else if (tool.type === 'text') {
    if (!input || input.length > 500) return fail(400, 'Isi teks (maksimal 500 karakter).');
    if (tool.stripAt) input = input.replace(/^@+/, '');
    if (tool.phone) { // nomor telepon: buang spasi/tanda, 08xx -> +628xx, 628xx -> +628xx
      let d = input.replace(/[\s().-]/g, '');
      if (/^00\d/.test(d)) d = '+' + d.slice(2); else if (/^0\d/.test(d)) d = '+62' + d.slice(1); else if (/^8\d{8,12}$/.test(d)) d = '+62' + d; else if (/^\d/.test(d)) d = '+' + d;
      input = d;
    }
    if (tool.upper) input = input.toUpperCase();
    if (tool.pattern && !tool.pattern.test(input)) return fail(400, tool.patternMsg || 'Format isian tidak valid.');
  } else if (tool.type === 'multi') {
    const fl = body.fields && typeof body.fields === 'object' ? body.fields : {};
    multi = {};
    for (const f of tool.fields) {
      const v = String(fl[f.key] === undefined || fl[f.key] === null ? '' : fl[f.key]).trim();
      if (!v) { if (f.req) return fail(400, f.label + ' wajib diisi.'); continue; }
      if (v.length > (f.max || 2000)) return fail(400, f.label + ' terlalu panjang (maksimal ' + (f.max || 2000) + ' karakter).');
      if (f.kind === 'color' && !/^#[0-9a-fA-F]{6}$/.test(v)) return fail(400, f.label + ' harus kode hex 6 digit, contoh #ffffff.');
      if (f.kind === 'digits' && !/^\d{1,12}$/.test(v)) return fail(400, f.label + ' harus berupa angka.');
      if (f.kind === 'enum' && !(f.opts || []).includes(v)) return fail(400, f.label + ' tidak valid.');
      if (f.kind === 'url') { try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return fail(400, f.label + ' harus berupa link yang diawali https://'); } }
      multi[f.key] = v;
    }
    if (!Object.keys(multi).length) return fail(400, 'Isi minimal satu isian.');
    if (typeof tool.check === 'function') { const cm = tool.check(multi); if (cm) return fail(400, cm); }
    input = Object.values(multi)[0] || '';
  } else if (tool.type === 'number') {
    if (!/^\d{1,9}$/.test(input)) return fail(400, 'Jumlah point harus berupa angka.');
  } else {
    try { const u = new URL(input); if (!/^https?:$/.test(u.protocol)) throw 0; if (tool.host && !tool.host.test(u.hostname)) return fail(400, tool.hostMsg || 'Link harus dari TikTok (tiktok.com, vt.tiktok.com, atau tt.site).'); } catch { return fail(400, 'Link tidak valid. Gunakan link yang diawali https://'); }
    if (tool.extra) { // parameter kedua (mis. emoji reaction)
      link2 = String(body.link || '').trim();
      if (!link2 || link2.length > 20) return fail(400, 'Isi emoji reaction (maksimal 20 karakter).');
    }
  }

  // Harga: pengaturan developer (panel Tools) lebih dulu, bila tidak ada pakai harga bawaan
  let price = credits.cost(tid, custom);
  if (store.ready()) {
    try { const ov = await store.getTool(tid); const n = ov ? parseInt(ov.credit, 10) : NaN; if (Number.isFinite(n)) price = Math.max(0, Math.min(99, n)); }
    catch (e) { /* Redis bermasalah: pakai harga bawaan */ }
  }
  let reserved = 0, fromBonus = 0, done = false, cr = null, sKind = 'e', sMsg = '';
  if (price) { // tool berkredit: wajib login. Kredit dipesan (dipotong) atomik dulu; bila provider gagal, dikembalikan di blok finally
    if (!me) return fail(401, 'Masuk dulu untuk memakai tool ini.');
    if (isOwner(me.email)) cr = credits.info(null, 'developer');
    else if (store.ready()) {
      try {
        const rec = await store.mutateUser(me.sub, (r) => {
          r = r || { firstSeen: Date.now(), logins: 0, email: me.email, name: me.name };
          const ci = credits.info(r, roleOf(me.email, r));
          if (!ci.unlimited) {
            if (ci.left < price) { const err = new Error('NOCREDIT'); err.ci = ci; throw err; }
            fromBonus = credits.charge(r, price);
          }
          return r;
        });
        reserved = price; cr = credits.info(rec, roleOf(me.email, rec));
      } catch (e) {
        if (e && e.message === 'NOCREDIT')
          return res.status(429).json({ ok: false, error: 'Kredit harian habis. Kredit kembali setelah 24 jam sejak pemakaian pertama.', credits: e.ci });
        return fail(503, 'Data kredit belum bisa dibaca. Coba lagi sebentar lagi.');
      }
    }
  }

  const mkHeaders = (t) => ({ ...(t.gc ? { Authorization: 'Bearer ' + cfg.gcKey } : t.base ? {} : { Authorization: 'Bearer ' + cfg.key, 'x-api-key': cfg.key }), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json, text/plain, */*' });

  // Satu percobaan ke satu provider. Hasil: { ok:true, link, data } atau { ok:false, code, error, retry }.
  // retry:true = kegagalan di sisi provider (boleh dicoba lewat jalur cadangan).
  async function attempt(t, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const headers = mkHeaders(t);
    try {
      let r;
      if (t.method === 'GET') {
        const u = new URL((t.base || cfg.base) + t.path);
        if (t.keyParam && !t.gc) u.searchParams.set(t.keyParam, cfg.key);
        if (multi) { for (const k of Object.keys(multi)) u.searchParams.set(k, multi[k]); }
        else { u.searchParams.set(t.param, input); if (t.linkParam) u.searchParams.set(t.linkParam, link2); }
        if (t.qs) for (const k of Object.keys(t.qs)) u.searchParams.set(k, t.qs[k]);
        r = await fetch(u, { headers, signal: ctrl.signal });
      } else {
        const bodyObj = {};
        if (multi) Object.assign(bodyObj, multi); // tool 'multi' dengan POST: kirim semua isian sebagai JSON
        else for (const [k, v] of Object.entries(t.body || { email: 'email' })) bodyObj[v] = k === 'link' ? link2 : input;
        r = await fetch((t.base || cfg.gcBase) + t.path, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj), signal: ctrl.signal
        });
      }
      const ct = r.headers.get('content-type') || '';
      let text;
      if (r.ok && (ct.startsWith('image/') || ct.startsWith('video/') || /octet-stream|binary/i.test(ct) || !ct)) { // gambar atau video langsung (biner)
        const buf = Buffer.from(await r.arrayBuffer());
        const mime = (ct.startsWith('image/') || ct.startsWith('video/')) ? ct.split(';')[0] : (sniffImage(buf) || sniffVideo(buf));
        if (mime) {
          if (buf.length > MAX_IMG_RAW) {
            // Hasil besar (mis. upscale): simpan sementara di Blob uploads/ (dibersihkan cron) dan kirim linknya
            if (t.bigToBlob && blob && process.env.BLOB_READ_WRITE_TOKEN && mime.startsWith('image/') && buf.length <= 40 * 1024 * 1024) {
              try {
                const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[mime] || 'png';
                const put = await blob.put('uploads/hasil.' + ext, buf, { access: 'public', addRandomSuffix: true, contentType: mime });
                return { ok: true, link: put.url, data: {} };
              } catch (e) { return { ok: false, code: 502, error: 'Hasil terlalu besar dan gagal disimpan sementara. Coba gambar yang lebih kecil.' }; }
            }
            return { ok: false, code: 502, error: 'Hasil terlalu besar untuk ditampilkan (maksimal sekitar 3,2 MB).' };
          }
          return { ok: true, link: 'data:' + mime + ';base64,' + buf.toString('base64'), data: {} };
        }
        text = buf.toString('utf8'); // bukan gambar: lanjut sebagai teks/JSON
      } else text = await r.text();
      const hp = htmlProblem(r.status, text);
      if (hp) return { ok: false, code: 502, error: hp.msg, retry: true, transient: !!hp.transient };
      let data; try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 500) }; }
      if (data && (data.status === false || data.success === false)) // provider membalas HTTP 200 tetapi status:false
        return { ok: false, code: 502, error: errText(data, 'Provider menolak permintaan.'), retry: true };
      if (!r.ok) return { ok: false, code: 502, error: errText(data, 'Provider menolak permintaan (' + r.status + ').'), retry: true, transient: r.status >= 500 };
      const dimg = findDataImage(data);
      if (dimg) {
        if (dimg.length > MAX_IMG_RAW * 1.34) return { ok: false, code: 502, error: 'Hasil gambar terlalu besar untuk ditampilkan (maksimal sekitar 3,2 MB).' };
        return { ok: true, link: dimg, data: stripDataImage(data, dimg) };
      }
      if (t.shape === 'tiktok') {
        const x = tiktok(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan video atau foto. Pastikan link TikTok publik, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'gcspotify') {
        const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
        const x = gcSpotify(data, /^[A-Za-z0-9.-]+(:\d+)?$/.test(host) ? 'https://' + host : '');
        if (!x) return { ok: false, code: 404, error: 'Lagu tidak ditemukan. Coba judul atau nama artis lain.' };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'gcamsend' || t.shape === 'gcamverif') {
        const x = t.shape === 'gcamsend' ? gcAmSend(data) : gcAmVerif(data);
        if (!x) return { ok: false, code: 502, error: 'Balasan provider tidak dikenali. Coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'gcyoutube') {
        const x = gcYoutube(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan link unduhan. Pastikan video YouTube publik, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'gcamdata') {
        const x = gcAmData(data, input);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan data proyek. Pastikan link share Alight Motion benar dan publik, lalu coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'gcprompt') {
        const x = gcPrompt(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan prompt. Pastikan link gambar publik dan langsung menuju file gambar, lalu coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'gcbypass') {
        const x = gcBypass(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan token. Cek link situs (dan site key bila diisi), lalu coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'gctiktok') {
        const x = gcTiktok(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan video. Pastikan link TikTok publik, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'file') {
        const x = fileInfo(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan info file. Pastikan link Mediafire publik, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'gcgcstart') {
        const x = gcGcStart(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan link verifikasi. Cek nomor (format +62...), lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'gcinstagram') {
        const x = gcInstagram(data) || aio(data); // bentuk lain (mis. carousel dengan kunci berbeda): pembaca umum
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan media. Pastikan link Instagram publik dan didukung, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'aio') {
        const x = aio(data);
        if (x && t.noAuthor) delete x.data.penulis; // field author dari provider = nama API, bukan pembuat video
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan media. Pastikan link publik dan didukung, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      return { ok: true, link: (t.type === 'email-link' || t.type === 'number') ? null : findLink(data, t.type === 'url' ? input : null), data };
    } catch (e) {
      const to = e && e.name === 'AbortError';
      return { ok: false, code: 504, error: to ? 'Provider terlalu lama merespons.' : 'Gagal menghubungi provider.', retry: true, transient: !to };
    } finally { clearTimeout(timer); }
  }

  try {
    // Jalur utama, lalu jalur cadangan (tool.fallback, mis. AIO Nexa) bila provider utama gagal/diblokir.
    // Total waktu dijaga di bawah batas fungsi Vercel (45 detik).
    const T0 = Date.now(), BUDGET = 57000;
    const chain = [tool];
    const fb = tool.fallback && cfg.key && Object.prototype.hasOwnProperty.call(cfg.tools, tool.fallback) ? cfg.tools[tool.fallback] : null;
    if (fb) chain.push(fb);
    // Kegagalan sementara (HTTP 5xx / koneksi putus) diulang otomatis, tetapi hanya untuk tool yang aman diulang (t.retries).
    const run = async (t, minLeft) => {
      let o = null;
      for (let n = 0; n <= (t.retries || 0); n++) {
        const left = BUDGET - (Date.now() - T0);
        if (left < (n === 0 ? minLeft : 6000)) break;
        o = await attempt(t, Math.max(3000, Math.min(t.timeout || 25000, left)));
        if (o.ok || !o.transient || n === (t.retries || 0)) break;
        await new Promise((r) => setTimeout(r, 1200));
      }
      return o;
    };
    let out = null, first = null;
    for (let i = 0; i < chain.length; i++) {
      const o = await run(chain[i], i === 0 ? 0 : 8000);
      if (!o) break;
      out = o;
      if (out.ok || !out.retry) break;
      if (i === 0) first = out;
    }
    if (!out) { sMsg = 'Provider terlalu lama merespons'; return fail(504, 'Provider terlalu lama merespons.'); }
    if (!out.ok) {
      let msg = out.error;
      if (first && first !== out) msg = (first.error + ' Jalur cadangan juga gagal: ' + out.error).slice(0, 400);
      if (out.retry) { sKind = 'e'; sMsg = String(msg).slice(0, 160); } else sKind = 'r'; // retry = gangguan di sisi provider; selain itu hanya ditolak (input salah, hasil kosong)
      return fail(out.code, msg);
    }
    done = true;
    return res.status(200).json({ ok: true, link: out.link, data: out.data, credits: cr });
  } catch (e) {
    sMsg = 'Gagal menghubungi provider';
    return fail(504, 'Gagal menghubungi provider.');
  } finally {
    if (!(me && isOwner(me.email))) await stats.record(tid, done ? 'o' : sKind, me && me.sub, sMsg); // statistik global; tes developer tidak dihitung
    if (reserved && !done) { // provider gagal / timeout / hasil ditolak: kredit yang sudah dipesan dikembalikan
      try { await store.mutateUser(me.sub, (r) => { if (!r) return null; credits.refund(r, reserved, Date.now(), fromBonus); return r; }); }
      catch (e) { console.error('[refund]', e && e.message); }
    }
    // foto yang diunggah dari perangkat dihapus lagi setelah diproses
    // Hanya file di folder uploads/ pada host Blob yang boleh dihapus (bukan avatar/chat/data milik orang lain)
    const cands = multi ? Object.values(multi) : (tool.type === 'url' ? [input] : []);
    for (const c of cands) {
      let up = null; try { up = new URL(c); } catch (e) { /* bukan URL */ }
      if (blob && up && up.protocol === 'https:' && /\.public\.blob\.vercel-storage\.com$/.test(up.hostname) && /^\/uploads\/[^/]+$/.test(up.pathname)) {
        try { await blob.del(c); } catch (e) { /* abaikan */ }
      }
    }
  }
};
