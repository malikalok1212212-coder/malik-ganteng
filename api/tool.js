const { guard, clientIp } = require('./_http');
const cfg = require('./_config');
const { getUser, isOwner, loginRequired, roleOf } = require('./_auth');
const credits = require('./_credits');
const store = require('./_store');
const R = require('./_redis');
const stats = require('./_stats');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { /* opsional */ }

const rate = require('./_rate');
const { report } = require('./_err');

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
function sniffAudio(b) {
  if (!b || b.length < 12) return null;
  if (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  if (b.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg';
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

// ---- Dailymotion Downloader (GenCipta /api/downloader/dailymotion): data{ title, thumbnail, duration, qualities[{quality,url,type}] } ----
function gcDailymotion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
  const list = (Array.isArray(d.qualities) ? d.qualities : []).filter((q) => q && isHttp(q.url));
  const isMp4 = (q) => !/mpegurl|m3u8/i.test(String(q.type || '') + q.url);
  let vids = list.filter(isMp4);
  if (!vids.length) vids = list;
  if (!vids.length) return null;
  vids = vids.slice().sort((a, b) => (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0));
  const data = {};
  if (d.title) data.judul = String(d.title).slice(0, 300);
  const sec = Math.round(Number(d.duration));
  if (sec > 0) data.durasi = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  if (isHttp(d.thumbnail)) data.thumbnail = d.thumbnail;
  const used = {};
  for (const q of vids.slice(0, 8)) {
    const lb = String(q.quality || '').replace(/[^A-Za-z0-9]/g, '');
    const base = 'video_' + (lb ? (/^\d+$/.test(lb) ? lb + 'p' : lb) : 'video');
    used[base] = (used[base] || 0) + 1;
    data[used[base] > 1 ? base + '_' + used[base] : base] = q.url;
  }
  return { link: vids[0].url, data };
}
function gcSoundcloud(raw, input) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
  const host = (u) => { try { return new URL(String(u)).hostname; } catch (e) { return ''; } };
  // Halaman lagu di soundcloud.com (m.soundcloud.com dinormalkan). Tautan pendek on.soundcloud.com tidak bisa dipakai untuk pemutar.
  const page = (u) => { try { const x = new URL(String(u)); if (!/(^|\.)soundcloud\.com$/i.test(x.hostname) || /^on\./i.test(x.hostname)) return ''; x.hostname = 'soundcloud.com'; x.search = ''; x.hash = ''; return x.toString(); } catch (e) { return ''; } };
  const embed = page(d.source_url) || page(input);
  // Hanya file audio asli yang dianggap unduhan. "Listen in app" dan halaman soundloadmate.com bukan file.
  const audio = (Array.isArray(d.downloads) ? d.downloads : []).map((q) => q && q.link)
    .find((u) => isHttp(u) && (/\.(mp3|m4a|aac|ogg|wav)(\?|#|$)/i.test(u) || /(^|\.)sndcdn\.com$/i.test(host(u)))) || '';
  if (!embed && !audio) return null;
  const title = d.title ? String(d.title).slice(0, 300) : '';
  const desc = d.description && !/Play over [\d.,]+ million tracks/i.test(String(d.description)) ? String(d.description).slice(0, 300) : '';
  const thumb = isHttp(d.thumb) ? d.thumb : '';
  const data = {};
  if (title) data.judul = title;
  if (desc) data.deskripsi = desc;
  if (embed) data.link_soundcloud = embed;
  if (audio) data.audio_mp3 = audio;
  return { link: audio || embed, data, sc: { title, desc, thumb, embed, audio } };
}

// ---- Spotify Track Search (GenCipta /api/spotify/search) ----
function gcSpotify(raw, origin) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.data)) return null;
  const data = {};
  const tracks = [];
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
    // Data terstruktur untuk pemutar custom di browser (cover, judul, artis). Hanya alamat https yang diteruskan.
    const cover = isHttp(t.cover_url) && /^https:/i.test(String(t.cover_url)) ? String(t.cover_url).slice(0, 500) : '';
    tracks.push({ title: String(t.title).slice(0, 120), artist: String(t.artist || '').slice(0, 100), album: String(t.album || '').slice(0, 100), duration: String(t.duration || '').slice(0, 12), cover, url });
  }
  return n ? { link: first, data, tracks } : null;
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

// ---- AM Generator jalur NexaDev (GET /am/send/ dan /am/verif/): { status, statusCode, message, result:{ email, orderId, status } }. orderId dan data internal lain tidak diteruskan ----
const nxKey = () => process.env.NEXADEV_API_KEY || '';
const acKey = () => process.env.CLOUDAPI_API_KEY || '';
function nxAmSend(raw, email) {
  if (!raw || typeof raw !== 'object' || raw.status !== true || (Number(raw.statusCode) >= 400)) return null;
  const data = { status: String(raw.message || 'Email verifikasi terkirim.').slice(0, 200) };
  if (email) data.email = String(email).slice(0, 120);
  return { link: null, data };
}
function nxAmVerif(raw, email) {
  if (!raw || typeof raw !== 'object' || raw.status !== true || (Number(raw.statusCode) >= 400)) return null;
  const r = raw.result && typeof raw.result === 'object' ? raw.result : {};
  const data = { status: String(raw.message || 'Verifikasi berhasil.').slice(0, 200) };
  const em = r.email || email;
  if (em) data.email = String(em).slice(0, 120);
  if (r.status) data.status_premium = String(r.status).slice(0, 40);
  return { link: null, data };
}
// ---- AM Prem V2 (api-cloud GET /premium/amprem5): balasan { status, creator, message | result, quota }. Hanya teks status dan data ringkas yang diteruskan; quota, creator, token, dan id internal dibuang ----
function acAm(raw, email, verify) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const sv = (v, n) => (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/\s+/g, ' ').trim().slice(0, n) : '';
  const r = raw.result !== undefined && raw.result !== null ? raw.result : raw.data;
  const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  const msg = sv(raw.message, 200) || sv(r, 200) || sv(o.message, 200);
  const data = { status: msg || (verify ? 'Verifikasi berhasil.' : 'Email verifikasi terkirim.') };
  const em = sv(o.email, 120) || (email ? String(email).slice(0, 120) : '');
  if (em) data.email = em;
  if (verify) {
    const nama = sv(o.displayName || o.name, 80), paket = sv(o.planName || o.plan, 80), jenis = sv(o.subscriptionType, 80);
    const st = sv(o.membershipStatus || o.status, 40), tgl = sv(o.validUntil || o.expiredAt || o.expires || o.expired, 40);
    if (nama) data.nama = nama; if (paket) data.paket = paket; if (jenis) data.jenis = jenis; if (st) data.status_premium = st; if (tgl) data.berlaku_hingga = tgl;
  }
  return { link: null, data };
}
// Urutan jalur AM: yang terakhir berhasil dipakai lebih dulu, jadi bila GenCipta error otomatis pindah ke NexaDev dan sebaliknya.
// AM_PROVIDER=gencipta atau nexadev mengunci jalur pertama (bawaan: auto). Disimpan di Redis (mt:prov:am) agar sama di semua instance.
let amMem = { v: '', at: 0 };
const amPin = () => { const p = String(process.env.AM_PROVIDER || '').toLowerCase(); return p === 'gencipta' ? 'gc' : p === 'nexadev' ? 'nx' : ''; };
async function amPref() {
  const pin = amPin(); if (pin) return pin;
  if (amMem.at && Date.now() - amMem.at < 20000) return amMem.v;
  let v = '';
  if (store.ready()) { try { const [x] = await R.run([['GET', 'mt:prov:am']]); v = x === 'nx' ? 'nx' : x === 'gc' ? 'gc' : ''; } catch (e) { /* Redis bermasalah: pakai urutan bawaan */ } }
  amMem = { v, at: Date.now() };
  return v;
}
async function amSetPref(v) {
  if (amPin() || (amMem.at && Date.now() - amMem.at < 20000 && amMem.v === v)) return;
  amMem = { v, at: Date.now() };
  if (store.ready()) { try { await R.run([['SET', 'mt:prov:am', v]]); } catch (e) { /* abaikan */ } }
}

// ---- Image to Prompt (GenCipta /api/tools/image-to-prompt) ----
function gcPrompt(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const t = typeof raw.result === 'string' ? raw.result : (raw.result && typeof raw.result.prompt === 'string' ? raw.result.prompt : (typeof raw.prompt === 'string' ? raw.prompt : ''));
  if (!t.trim()) return null;
  return { link: null, data: { prompt: t.trim().slice(0, 4000) } };
}
// ---- Open Graph Scraper (GenCipta /api/tools/web/open-graph): metadata situs (judul, deskripsi, gambar, favicon). requestInfo dan originalUrl dari provider sengaja dibuang ----
function amFind(raw) {
  // api-cloud /tools/amfind: { status, result:{ videoId, video:{url,comments}, author:{uniqueId,bio,bioLink}, scanned:{comments,replies}, presets:[...] } }
  const r = raw && typeof raw === 'object' && raw.result && typeof raw.result === 'object' ? raw.result : null;
  if (!r || (!r.video && !r.author && !r.videoId)) return null;
  const data = {};
  const v = r.video && typeof r.video === 'object' ? r.video : {}, a = r.author && typeof r.author === 'object' ? r.author : {}, sc = r.scanned && typeof r.scanned === 'object' ? r.scanned : {};
  if (a.uniqueId) data.akun = '@' + String(a.uniqueId).slice(0, 60);
  if (r.videoId) data.id_video = String(r.videoId).slice(0, 30);
  if (isHttp(v.url)) data.url = v.url;
  if (v.description) data.deskripsi = String(v.description).slice(0, 300);
  if (a.bio) data.bio = String(a.bio).slice(0, 300);
  if (isHttp(a.bioLink)) data.link_bio = a.bioLink;
  if (Number.isFinite(Number(sc.comments))) data.komentar_dipindai = String(Number(sc.comments));
  if (Number.isFinite(Number(sc.replies))) data.balasan_dipindai = String(Number(sc.replies));
  const list = Array.isArray(r.presets) ? r.presets : [];
  data.jumlah_preset = String(list.length);
  list.slice(0, 20).forEach((it, i) => {
    let t = '';
    if (typeof it === 'string') t = it;
    else if (it && typeof it === 'object') {
      const u = [it.url, it.link, it.shareUrl, it.share, it.href].find((x) => isHttp(x)) || '';
      const n = [it.title, it.name, it.text, it.comment].find((x) => typeof x === 'string' && x.trim()) || '';
      t = (n ? String(n).trim().slice(0, 120) + (u ? ' - ' : '') : '') + u;
      if (!t) { const f = Object.values(it).find((x) => isHttp(x)); if (f) t = f; }
    }
    if (t.trim()) data['preset_' + (i + 1)] = t.trim().slice(0, 500);
  });
  if (!list.length) data.catatan = 'Tidak ada link preset di komentar video ini.';
  return { link: null, data };
}
function gcOpenGraph(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw.hybridGraph || raw.openGraph || raw.htmlInferred ? raw : (raw.result && typeof raw.result === 'object' ? raw.result : (raw.data && typeof raw.data === 'object' ? raw.data : raw));
  const srcs = [r.hybridGraph, r.openGraph, r.htmlInferred].filter((x) => x && typeof x === 'object');
  if (!srcs.length) return null;
  const pick = (k) => { for (const o of srcs) { const v = o[k]; if (typeof v === 'string' && v.trim()) return v.trim(); } return ''; };
  const imgOf = () => { for (const o of srcs) { const v = o.image; if (typeof v === 'string' && isHttp(v)) return v; if (v && typeof v === 'object' && isHttp(v.url)) return v.url; } return ''; };
  const data = {};
  const title = pick('title'); if (title) data.judul = title.slice(0, 300);
  const desc = pick('description'); if (desc) data.deskripsi = desc.slice(0, 600);
  const site = pick('site_name'); if (site) data.sumber = site.slice(0, 100);
  const type = pick('type'); if (type) data.jenis = type.slice(0, 30);
  const loc = pick('locale'); if (loc) data.bahasa = loc.slice(0, 20);
  const img = imgOf(); if (img) data.image = img;
  const w = pick('imageWidth'), h = pick('imageHeight'); if (w && h) data.ukuran_gambar = (w + ' x ' + h).slice(0, 20);
  const u = pick('url') || (typeof r.url === 'string' ? r.url : ''); if (isHttp(u)) data.url = u;
  const fav = pick('favicon'); if (isHttp(fav)) data.favicon = fav;
  return Object.keys(data).length ? { link: null, data } : null;
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
    return { msg: 'Provider memblokir akses dari server (verifikasi Cloudflare). Coba lagi nanti atau pakai tool lain.', cf: true };
  if (status === 429) return { msg: 'Provider membatasi permintaan (HTTP 429). Coba lagi beberapa saat lagi.' };
  if (status >= 500) return { msg: 'Server provider sedang down atau sibuk (HTTP ' + status + '). Coba lagi beberapa saat lagi.', transient: true };
  return { msg: 'Provider membalas halaman yang tidak dikenali (HTTP ' + status + '). Coba lagi nanti.' };
}


// ---- Cek Situs (lokal, tanpa provider): status HTTP, waktu respons, redirect, dan info SSL ----
// Aman dari SSRF: alamat internal/pribadi diblokir, IP hasil DNS dikunci ke koneksi, hanya port 80/443, redirect dicek ulang tiap lompatan.
const scDns = require('dns').promises, scNet = require('net'), scHttp = require('http'), scHttps = require('https');
const SC_BL = new scNet.BlockList();
[['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]].forEach(([a, p]) => SC_BL.addSubnet(a, p, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32]].forEach(([a, p]) => SC_BL.addSubnet(a, p, 'ipv6'));
function scPrivate(addr, fam) {
  const m = String(addr).match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (m) return SC_BL.check(m[1], 'ipv4');
  try { return SC_BL.check(addr, Number(fam) === 6 ? 'ipv6' : 'ipv4'); } catch (e) { return true; }
}
function scClean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n || 120); }
function scPortOk(u) { return !u.port || u.port === '80' || u.port === '443'; }
async function scHop(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const lit = scNet.isIP(host);
  const addrs = lit ? [{ address: host, family: lit }] : await scDns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((x) => scPrivate(x.address, x.family))) { const e = new Error('blocked'); e.code = 'EBLOCKED'; throw e; }
  const a = addrs[0], isHttps = u.protocol === 'https:', mod = isHttps ? scHttps : scHttp;
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = mod.request({
      host, port: u.port || (isHttps ? 443 : 80), path: (u.pathname || '/') + (u.search || ''), method: 'GET', timeout: 9000,
      headers: { 'User-Agent': 'MalikTools-SiteCheck/1.0', Accept: '*/*' }, rejectUnauthorized: false, servername: lit ? undefined : host,
      lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: a.address, family: a.family }]) : cb(null, a.address, a.family))
    }, (r) => {
      const ms = Date.now() - t0, sk = r.socket;
      let cert = null, authorized = null, authErr = null, proto = null;
      if (isHttps && sk && sk.getPeerCertificate) { try { cert = sk.getPeerCertificate(); authorized = sk.authorized; authErr = sk.authorizationError; proto = sk.getProtocol(); } catch (e) { /* abaikan */ } }
      r.destroy();
      resolve({ status: r.statusCode, headers: r.headers || {}, ms, ip: a.address, cert, authorized, authErr, proto, https: isHttps });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end();
  });
}
function scReason(e) {
  const c = e && e.code;
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return 'Domain tidak ditemukan (DNS gagal).';
  if (c === 'ECONNREFUSED') return 'Koneksi ditolak oleh server.';
  if (c === 'ETIMEDOUT') return 'Server tidak merespons dalam 9 detik.';
  if (c === 'ECONNRESET') return 'Koneksi diputus oleh server.';
  return 'Tidak bisa terhubung' + (c ? ' (' + scClean(c, 30) + ')' : '') + '.';
}
async function siteCheck(input) {
  let u;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) return { ok: false, code: 400, error: 'Link situs harus diawali http:// atau https://.' };
  try { u = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input); } catch (e) { return { ok: false, code: 400, error: 'Link situs tidak valid.' }; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return { ok: false, code: 400, error: 'Link situs tidak valid.' };
  if (!scPortOk(u)) return { ok: false, code: 400, error: 'Hanya port web standar (80 dan 443) yang bisa diperiksa.' };
  const t0 = Date.now(); let hops = 0, last = null, cur = u, first = null;
  try {
    for (;;) {
      const r = await scHop(cur); if (!first) first = r; last = r;
      const loc = r.status >= 300 && r.status < 400 && r.headers.location;
      if (!loc || hops >= 5 || Date.now() - t0 > 20000) break;
      let nx; try { nx = new URL(loc, cur); } catch (e) { break; }
      if (!/^https?:$/.test(nx.protocol) || !scPortOk(nx)) break;
      cur = nx; hops++;
    }
  } catch (e) {
    if (e && e.code === 'EBLOCKED') return { ok: false, code: 400, error: 'Alamat ini tidak bisa diperiksa (alamat internal atau pribadi).' };
    return { ok: true, data: { status: 'Offline', alasan: scReason(e), url: scClean(cur.href, 200) } };
  }
  const st = last.status, d = {};
  d.status = st < 400 ? 'Online' : st < 500 ? 'Online, tapi halaman bermasalah (HTTP ' + st + ')' : 'Server bermasalah (HTTP ' + st + ')';
  d.kode_http = String(st);
  d.waktu_respons = last.ms + ' ms' + (last.ms < 800 ? ' (cepat)' : last.ms < 2500 ? ' (sedang)' : ' (lambat)');
  d.alamat_ip = scClean(last.ip, 60);
  if (hops) d.redirect = hops + ' kali';
  if (hops || cur.href !== u.href) d.url_akhir = scClean(cur.href, 200);
  if (last.headers.server) d.server = scClean(last.headers.server, 60);
  if (last.headers['content-type']) d.jenis_konten = scClean(String(last.headers['content-type']).split(';')[0], 60);
  if (last.https && last.cert && last.cert.valid_to) {
    d.ssl = last.authorized ? 'Valid' : 'Tidak valid' + (last.authErr ? ' (' + scClean(last.authErr.message || last.authErr, 60) + ')' : '');
    const dt = Date.parse(last.cert.valid_to);
    if (Number.isFinite(dt)) { d.ssl_berlaku_hingga = new Date(dt).toISOString().slice(0, 10); d.ssl_sisa_hari = String(Math.floor((dt - Date.now()) / 864e5)) + ' hari'; }
    const iss = last.cert.issuer && (last.cert.issuer.O || last.cert.issuer.CN); if (iss) d.ssl_penerbit = scClean(iss, 60);
    if (last.proto) d.protokol_tls = scClean(last.proto, 20);
  } else if (!last.https) d.ssl = 'Tidak memakai HTTPS';
  return { ok: true, data: d };
}

// NexaDev: kirim reaksi emoji ke postingan channel WhatsApp. Kunci hanya dari env NEXADEV_API_KEY (server), tidak pernah ke browser.
// V2 dan V3 lewat api-cloud (kunci CLOUDAPI_API_KEY): V2 = GET /tools/rch?link=&emoji= (maks. 6 emoji), V3 = GET /tools/reactch-v4?url=&reaction= (1 emoji).
// Balasan memuat quota + apikey: tidak pernah diteruskan ke browser.
async function reactChannelCloud(f, variant) {
  const key = process.env.CLOUDAPI_API_KEY || '';
  if (!key) return { ok: false, code: 500, error: 'CLOUDAPI_API_KEY belum diatur di Environment Variables Vercel.' };
  const base = (process.env.CLOUDAPI_BASE_URL || 'https://api-cloud.my.id').replace(/\/$/, '');
  const url = String(f.url || '').trim();
  if (!/^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]{10,40}\/\d{1,12}$/.test(url))
    return { ok: false, code: 400, error: 'Link harus link postingan channel WhatsApp, contoh https://whatsapp.com/channel/XXXX/123 (ada angka di belakang).' };
  const v3 = variant === 'v3';
  const list = String(f.reaction || '').split(/[,，\s]+/).map(x => x.trim()).filter(Boolean);
  if (!list.length || list.length > (v3 ? 1 : 6)) return { ok: false, code: 400, error: v3 ? 'Isi 1 emoji saja.' : 'Isi 1 sampai 6 emoji, pisahkan dengan koma.' };
  if (!list.every(e => e.length <= 16 && /^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]+$/u.test(e)))
    return { ok: false, code: 400, error: 'Reaksi harus berupa emoji saja' + (v3 ? '.' : ', pisahkan dengan koma.') };
  const reaction = list.join(',');
  const u = new URL(base + (v3 ? '/tools/reactch-v4' : '/tools/rch'));
  u.searchParams.set(process.env.CLOUDAPI_KEY_PARAM || 'apikey', key);
  u.searchParams.set(v3 ? 'url' : 'link', url);
  u.searchParams.set(v3 ? 'reaction' : 'emoji', reaction);
  const o = (process.env.CLOUDAPI_ORIGIN || 'https://maliktools.biz.id').trim().replace(/\/$/, '');
  const headers = { Accept: 'application/json', 'x-api-key': key, 'User-Agent': process.env.CLOUDAPI_UA || 'MalikTools/1.0 (API client)', ...(!o || o === '-' ? {} : { Origin: o, Referer: o + '/' }) };
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 52000);
  let j;
  try {
    const r = await fetch(u, { signal: ac.signal, headers });
    const t = await r.text();
    try { j = JSON.parse(t); } catch { return { ok: false, code: 502, error: 'Provider mengirim balasan yang tidak bisa dibaca. Coba lagi nanti.' }; }
  } catch (e) {
    return { ok: false, code: 504, error: 'Provider tidak merespons. Coba lagi sebentar lagi.' };
  } finally { clearTimeout(tm); }
  const res = j && j.result;
  if (!j || j.status !== true || !res || typeof res !== 'object') {
    const msg = String((j && (j.error || j.message)) || (res && res.message) || '');
    if (/limit|quota|habis|plan|pro\b/i.test(msg)) return { ok: false, code: 503, error: 'Kuota atau plan provider sedang bermasalah. Hubungi developer.' };
    if (/timed out|timeout/i.test(msg)) return { ok: false, code: 504, error: 'Provider tidak merespons (timeout). Pastikan link postingan benar, lalu coba lagi.' };
    return { ok: false, code: 502, error: 'Reaksi gagal dikirim. Pastikan link postingan channel benar dan masih ada.' };
  }
  const wt = String(res.responseTime || j.time || '').slice(0, 20);
  return { ok: true, data: { status: v3 ? 'Reaksi terkirim' : (String(res.message || '').slice(0, 60) || 'Reaksi sedang diproses'), postingan: url, reaksi: reaction, ...(wt ? { waktu_respons: wt } : {}) } };
}

async function reactChannel(f, variant) {
  if (variant === 'v2' || variant === 'v3') return reactChannelCloud(f, variant);
  const key = process.env.NEXADEV_API_KEY || '';
  if (!key) return { ok: false, code: 500, error: 'NEXADEV_API_KEY belum diatur di Environment Variables Vercel.' };
  const base = (process.env.NEXADEV_BASE_URL || 'https://api.nexadev.my.id').replace(/\/$/, '');
  const url = String(f.url || '').trim();
  if (!/^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]{10,40}\/\d{1,12}$/.test(url))
    return { ok: false, code: 400, error: 'Link harus link postingan channel WhatsApp, contoh https://whatsapp.com/channel/XXXX/123 (ada angka di belakang).' };
  const list = String(f.reaction || '').split(/[,，\s]+/).map(x => x.trim()).filter(Boolean);
  if (!list.length || list.length > 6) return { ok: false, code: 400, error: 'Isi 1 sampai 6 emoji, pisahkan dengan koma.' };
  if (!list.every(e => e.length <= 16 && /^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]+$/u.test(e)))
    return { ok: false, code: 400, error: 'Reaksi harus berupa emoji saja, pisahkan dengan koma.' };
  const reaction = list.join(',');
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 52000);
  let j;
  try {
    const r = await fetch(base + '/api/rch?key=' + encodeURIComponent(key) + '&url=' + encodeURIComponent(url) + '&reaction=' + encodeURIComponent(reaction), { signal: ac.signal, headers: { Accept: 'application/json' } });
    const t = await r.text();
    try { j = JSON.parse(t); } catch { return { ok: false, code: 502, error: 'Provider mengirim balasan yang tidak bisa dibaca. Coba lagi nanti.' }; }
  } catch (e) {
    return { ok: false, code: 504, error: 'Provider tidak merespons. Coba lagi sebentar lagi.' };
  } finally { clearTimeout(tm); }
  const res = j && j.result;
  if (!res || res.success !== true) {
    const msg = String((res && res.message) || (j && (j.message || j.error)) || '');
    if (/limit|quota|habis/i.test(msg)) return { ok: false, code: 503, error: 'Kuota provider sedang habis. Hubungi developer.' };
    if (/timed out|timeout/i.test(msg)) return { ok: false, code: 504, error: 'Provider tidak merespons (timeout). Pastikan link postingan benar, lalu coba lagi.' };
    return { ok: false, code: 502, error: 'Reaksi gagal dikirim. Pastikan link postingan channel benar dan masih ada.' };
  }
  return { ok: true, data: { status: 'Reaksi terkirim', postingan: url, reaksi: reaction, waktu_respons: String((j && j.response_time) || '') } };
}

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const fail = (code, error) => res.status(code).json({ ok: false, error });

  if (req.method === 'GET' && req.query && req.query.credits) { // saldo koin pengguna yang sedang masuk
    const u = getUser(req);
    if (!u) return fail(401, 'Masuk dulu untuk melihat koin.');
    try {
      const rec = await store.getUser(u.sub);
      return res.status(200).json({ ok: true, credits: credits.info(rec, roleOf(u.email, rec)) });
    } catch (e) { return fail(503, 'Data koin belum bisa dibaca.'); }
  }
  if (req.method !== 'POST') return fail(405, 'Metode tidak diizinkan.');
  if (process.env.ACCESS_CODE && req.headers['x-access-code'] !== process.env.ACCESS_CODE)
    return fail(401, 'Kode akses salah atau belum diisi.');
  if (loginRequired() && !getUser(req))
    return fail(401, 'Masuk dulu untuk memakai tool ini.');
  const ip = clientIp(req);
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
    if (process.env.AUTO_OFF === '1') {
      try {
        const R = require('./_redis'); const [raw] = await R.run([['GET', 'mt:autooff']]);
        const l = raw ? JSON.parse(raw) : [];
        if (Array.isArray(l) && l.includes(tid)) return fail(503, 'Provider tool ini sedang gangguan, jadi dijeda otomatis. Coba lagi beberapa menit lagi.');
      } catch (e) { /* biarkan lewat */ }
    }
  }
  if (tool.local === 'sitecheck') {
    const in0 = String(body.input || '').trim();
    if (!in0 || in0.length > 2000) return fail(400, 'Isi link situs yang mau diperiksa.');
    const r = await siteCheck(in0);
    if (!r.ok) return fail(r.code || 400, r.error);
    return res.status(200).json({ ok: true, link: null, data: r.data });
  }
  if (tool.local === 'nexarch') {
    if (await rate.limited('rch', ip, 4, 600)) return fail(429, 'Terlalu sering. Tunggu beberapa menit sebelum mengirim reaksi lagi.');
    const fl = body.fields && typeof body.fields === 'object' ? body.fields : {};
    // Koin (saldo yang sama dengan AM Generator). Dipotong dulu, dikembalikan bila reaksi gagal.
    let price = credits.cost(tid, null), reserved = 0, fromBonus = 0, cr = null;
    if (store.ready()) {
      try { const ov = await store.getTool(tid); const n = ov ? parseInt(ov.credit, 10) : NaN; if (Number.isFinite(n)) price = Math.max(0, Math.min(99, n)); }
      catch (e) { /* Redis bermasalah: pakai harga bawaan */ }
    }
    if (price) {
      if (!me) return fail(401, 'Masuk dulu untuk memakai tool ini.');
      if (isOwner(me.email)) cr = credits.info(null, 'developer');
      else if (store.ready()) {
        try {
          const rec = await store.mutateUser(me.sub, (r0) => {
            r0 = r0 || { firstSeen: Date.now(), logins: 0, email: me.email, name: me.name };
            const ci = credits.info(r0, roleOf(me.email, r0));
            if (!ci.unlimited) {
              if (ci.left < price) { const err = new Error('NOCREDIT'); err.ci = ci; throw err; }
              fromBonus = credits.charge(r0, price);
            }
            return r0;
          });
          reserved = price; cr = credits.info(rec, roleOf(me.email, rec));
        } catch (e) {
          if (e && e.message === 'NOCREDIT')
            return res.status(429).json({ ok: false, error: 'Koin tidak cukup. Tool ini butuh ' + price + ' koin, saldomu ' + (e.ci && e.ci.left != null ? e.ci.left : 0) + '. Beli koin di menu Beli Koin.', need: price, credits: e.ci });
          return fail(503, 'Data koin belum bisa dibaca. Coba lagi sebentar lagi.');
        }
      }
    }
    let r;
    try { r = await reactChannel(fl, tool.variant); } catch (e) { r = { ok: false, code: 504, error: 'Gagal menghubungi provider.' }; }
    if (!r.ok) {
      if (reserved) {
        try { await store.mutateUser(me.sub, (r0) => { if (!r0) return null; credits.refund(r0, reserved, Date.now(), fromBonus); return r0; }); }
        catch (e) { console.error('[refund]', e && e.message); }
      }
      return fail(r.code || 400, r.error);
    }
    return res.status(200).json({ ok: true, link: null, data: r.data, credits: cr });
  }
  const altCfg = Object.prototype.hasOwnProperty.call(cfg.alts || {}, tid) ? cfg.alts[tid] : null; // jalur cadangan dua arah (AM Premium)
  if (tool.ac) { /* key api-cloud opsional: bila CLOUDAPI_API_KEY kosong, dipanggil tanpa key seperti contoh di docs */ }
  else if (!cfg.gcKey && !(altCfg && nxKey())) return fail(500, 'GENCIPTA_API_KEY belum diatur di Environment Variables Vercel.');

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
  if (price) { // tool yang memakai koin: wajib login. Koin dipotong atomik dulu; bila provider gagal, dikembalikan di blok finally
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
          return res.status(429).json({ ok: false, error: 'Koin tidak cukup. Tool ini butuh ' + price + ' koin, saldomu ' + (e.ci && e.ci.left != null ? e.ci.left : 0) + '. Beli koin di menu Beli Koin.', need: price, credits: e.ci });
        return fail(503, 'Data koin belum bisa dibaca. Coba lagi sebentar lagi.');
      }
    }
  }

  // Whitelist domain api-cloud: backend mengirim Origin/Referer situs sendiri (ubah lewat CLOUDAPI_ORIGIN, kosongkan "-" untuk mematikan)
  const acOriginHeaders = () => { const o = (process.env.CLOUDAPI_ORIGIN || 'https://maliktools.biz.id').trim().replace(/\/$/, ''); return !o || o === '-' ? {} : { Origin: o, Referer: o + '/' }; };
  const mkHeaders = (t) => ({ ...(t.ac ? (acKey() ? { 'x-api-key': acKey() } : {}) : t.gc ? { Authorization: 'Bearer ' + cfg.gcKey } : t.base ? {} : { Authorization: 'Bearer ' + cfg.key, 'x-api-key': cfg.key }), 'User-Agent': t.ac ? (process.env.CLOUDAPI_UA || 'MalikTools/1.0 (API client)') : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', Accept: 'application/json, text/plain, */*', ...(t.ac ? acOriginHeaders() : {}) });

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
        if (t.keyParam && !t.gc && !(t.ac && !acKey())) u.searchParams.set(t.keyParam, t.ac ? acKey() : t.nx ? nxKey() : cfg.key);
        if (multi) { for (const k of Object.keys(multi)) { const fd = (tool.fields || []).find(x => x.key === k); const names = fd && Array.isArray(fd.as) ? fd.as : [k]; for (const n of names) u.searchParams.set(n, multi[k]); } }
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
      if (r.ok && (ct.startsWith('image/') || ct.startsWith('video/') || ct.startsWith('audio/') || /octet-stream|binary/i.test(ct) || !ct)) { // gambar atau video langsung (biner)
        const buf = Buffer.from(await r.arrayBuffer());
        const mime = (ct.startsWith('image/') || ct.startsWith('video/') || ct.startsWith('audio/')) ? ct.split(';')[0] : (sniffImage(buf) || sniffVideo(buf) || sniffAudio(buf));
        if (mime) {
          if (buf.length > MAX_IMG_RAW) {
            // Hasil besar (mis. upscale): simpan sementara di Blob uploads/ (dibersihkan cron) dan kirim linknya
            if (t.bigToBlob && blob && process.env.BLOB_READ_WRITE_TOKEN && /^(image|video)\//.test(mime) && buf.length <= 40 * 1024 * 1024) {
              try {
                const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[mime] || (mime.startsWith('video/') ? 'mp4' : 'png');
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
      if (hp) { const ray = r.headers.get('cf-ray'); return { ok: false, code: 502, error: hp.msg + (ray && /Cloudflare/.test(hp.msg) ? ' (Ray ID: ' + ray + ')' : ''), retry: true, transient: !!hp.transient, cf: !!hp.cf }; }
      let data; try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 500) }; }
      if (data && (data.status === false || data.success === false)) // provider membalas HTTP 200 tetapi status:false
        return { ok: false, code: 502, error: errText(data, 'Provider menolak permintaan.'), retry: true };
      if (!r.ok) return { ok: false, code: 502, error: errText(data, 'Provider menolak permintaan (' + r.status + ').'), retry: true, transient: r.status >= 500 };
      if (t.shape === 'cloudimg') { // api-cloud: { status, mime, base64 } atau { status, result:'data:image/...;base64,...' } -> data URI. Field lain (mis. quota) tidak diteruskan ke browser.
        const raw = data && typeof data.base64 === 'string' ? data.base64 : (data && typeof data.result === 'string' ? data.result : '');
        const b64 = raw.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
        const dm = /^data:(image\/(?:png|jpe?g|webp|gif));base64,/i.exec(raw.trim());
        const mm = data && /^image\/(png|jpe?g|webp|gif)$/i.test(String(data.mime || '')) ? String(data.mime).toLowerCase() : (dm ? dm[1].toLowerCase() : 'image/png');
        if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return { ok: false, code: 502, error: 'Provider tidak mengembalikan gambar. Coba lagi.', retry: true };
        if (b64.length > MAX_IMG_RAW * 1.34) return { ok: false, code: 502, error: 'Hasil gambar terlalu besar untuk ditampilkan (maksimal sekitar 3,2 MB).' };
        return { ok: true, link: 'data:' + mm + ';base64,' + b64, data: {} };
      }
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
        return { ok: true, link: x.link, data: x.data, tracks: x.tracks };
      }
      if (t.shape === 'gcamsend' || t.shape === 'gcamverif') {
        const x = t.shape === 'gcamsend' ? gcAmSend(data) : gcAmVerif(data);
        if (!x) return { ok: false, code: 502, error: 'Balasan provider tidak dikenali. Coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'acam') {
        const x = acAm(data, input, t.type === 'email-link');
        if (!x) return { ok: false, code: 502, error: 'Balasan provider tidak dikenali. Coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'nxamsend' || t.shape === 'nxamverif') {
        const x = t.shape === 'nxamsend' ? nxAmSend(data, input) : nxAmVerif(data, input);
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
      if (t.shape === 'amfind') {
        const x = amFind(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan data video. Pastikan link TikTok publik, lalu coba lagi.', retry: true };
        return { ok: true, link: null, data: x.data };
      }
      if (t.shape === 'gcopengraph') {
        const x = gcOpenGraph(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan metadata Open Graph. Pastikan link situs benar dan bisa dibuka publik, lalu coba lagi.', retry: true };
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
      if (t.shape === 'gcdailymotion') {
        const x = gcDailymotion(data);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan link unduhan. Pastikan video Dailymotion publik, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data };
      }
      if (t.shape === 'gcsoundcloud') {
        const x = gcSoundcloud(data, input);
        if (!x) return { ok: false, code: 502, error: 'Provider tidak mengembalikan data lagu. Pastikan link SoundCloud publik, lalu coba lagi.', retry: true };
        return { ok: true, link: x.link, data: x.data, sc: x.sc };
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
    let chain = [tool];
    const fb = tool.fallback && cfg.key && Object.prototype.hasOwnProperty.call(cfg.tools, tool.fallback) ? cfg.tools[tool.fallback] : null;
    if (fb) chain.push(fb);
    if (altCfg) { // GenCipta <-> NexaDev: hanya jalur yang kuncinya ada; yang terakhir berhasil dipakai lebih dulu
      chain = [tool, altCfg].filter((t) => (t.nx ? !!nxKey() : !!cfg.gcKey));
      if (chain.length > 1 && (await amPref()) === 'nx') chain.reverse();
    }
    // Kegagalan sementara (HTTP 5xx / koneksi putus) diulang otomatis, tetapi hanya untuk tool yang aman diulang (t.retries).
    const run = async (t, minLeft, cap) => {
      let o = null;
      for (let n = 0; n <= Math.max(t.retries || 0, 3); n++) {
        const left = BUDGET - (Date.now() - T0);
        if (left < (n === 0 ? minLeft : 6000)) break;
        o = await attempt(t, Math.max(3000, Math.min(t.timeout || 25000, left, cap || 1e9)));
        // Blokir Cloudflare bersifat acak per permintaan dan permintaannya belum diproses provider, jadi aman diulang otomatis (maks. 3x) untuk semua tool
        if (o.ok || !((o.transient && n < (t.retries || 0)) || (o.cf && n < 3))) break;
        await new Promise((r) => setTimeout(r, o.cf ? 600 : 1200));
      }
      return o;
    };
    let out = null, first = null, wi = 0;
    for (let i = 0; i < chain.length; i++) {
      const o = await run(chain[i], i === 0 ? 0 : 8000, i === 0 && altCfg && chain.length > 1 ? 32000 : 0); // jalur pertama dibatasi 32 dtk supaya jalur cadangan masih kebagian waktu
      if (!o) break;
      out = o; wi = i;
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
    if (altCfg && chain.length > 1) await amSetPref(chain[wi].nx ? 'nx' : 'gc');
    return res.status(200).json({ ok: true, link: out.link, data: out.data, tracks: out.tracks, credits: cr });
  } catch (e) {
    sMsg = 'Gagal menghubungi provider';
    report('tool.' + tid, e);
    return fail(504, 'Gagal menghubungi provider.');
  } finally {
    if (!done && sKind === 'e' && !(me && isOwner(me.email))) report('tool.' + tid, sMsg || 'provider error'); // kegagalan provider langsung terpantau
    if (!(me && isOwner(me.email))) await stats.record(tid, done ? 'o' : sKind, me && me.sub, sMsg); // statistik global; tes developer tidak dihitung
    if (reserved && !done) { // provider gagal / timeout / hasil ditolak: koin yang sudah dipotong dikembalikan
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
