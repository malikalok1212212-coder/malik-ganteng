const $=(r,s)=>r.querySelector(s);
const SVC={ok:null,down:[]};
function mtPill(){const hp=$(document,'.top .pill');if(!hp||hp.classList.contains('dev'))return;
 const bad=SVC.ok===false;hp.textContent=SVC.ok===null?'Memeriksa':bad?'Gangguan':'Operasional';
 hp.title=SVC.ok===null?'Memeriksa status layanan':bad?'Sebagian tool sedang gangguan: '+SVC.down.length+' tool terdampak':'Semua layanan operasional';
 hp.style.setProperty('--ok',bad?'var(--bad)':'');hp.classList.toggle('bad',bad)}
async function mtStatus(){try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw 0;const j=await r.json();SVC.ok=!!j.ok;SVC.down=j.down||[]}catch(e){SVC.ok=null}mtPill()}
mtStatus();setInterval(()=>{if(!document.hidden)mtStatus()},120000);

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function copy(t,b){const ok=()=>{const x=b.textContent;b.textContent='Tersalin';setTimeout(()=>b.textContent=x,1200)};
 try{navigator.clipboard.writeText(t).then(ok,fb)}catch(e){fb()}
 function fb(){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');ok()}catch(e){}a.remove()}}
function flat(o,p){let r=[];for(const k in o){const v=o[k],n=p?p+'.'+k:k;if(v&&typeof v==='object')r=r.concat(flat(v,n));else r.push([n,v])}return r}

// Terjemah label field dari API ke bahasa Indonesia (dipakai kartu hasil).
const LBL={title:'Judul',name:'Nama',description:'Deskripsi',desc:'Deskripsi',caption:'Keterangan',author:'Penulis',nickname:'Nama panggilan',username:'Username',uploader:'Pengunggah',artist:'Artis',album:'Album',duration:'Durasi',size:'Ukuran',quality:'Kualitas',resolution:'Resolusi',format:'Format',type:'Jenis',source:'Sumber',platform:'Platform',video:'Video',audio:'Audio',music:'Musik',image:'Gambar',images:'Gambar',photo:'Foto',thumbnail:'Thumbnail',thumb:'Thumbnail',cover:'Sampul',url:'Tautan',link:'Tautan',download:'Unduhan',views:'Dilihat',likes:'Suka',comments:'Komentar',shares:'Dibagikan',followers:'Pengikut',following:'Mengikuti',posts:'Postingan',points:'Poin',point:'Poin',total:'Total',price:'Harga',balance:'Saldo',country:'Negara',email:'Email',token:'Token',date:'Tanggal',created:'Dibuat',expired:'Kedaluwarsa',judul:'Judul',penulis:'Penulis',jenis:'Jenis',sumber:'Sumber',musik:'Musik',jumlah:'Jumlah',jumlah_foto:'Jumlah foto'};
const lbl=(w,fb)=>LBL[String(w).toLowerCase()]||fb;
// Rapikan data hasil: buang field teknis (status, author, waktu respons, limit, dll) dan beri label yang enak dibaca.
function cleanFlat(data){const TECH=/^(status|success|ok|author|creator|response_?time|limit_?remaining|limit_?deducted|status_?code|timestamp|elapsed|message|msg)$/i,SK=/^(data|result|results|response)$/i,
 hum=s=>/^\d+$/.test(s)?'#'+(+s+1):s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').trim().replace(/^./,c=>c.toUpperCase());
 return flat(data||{}).filter(x=>x[1]!==null&&x[1]!==undefined&&String(x[1]).trim()!=='').map(([k,v])=>{let s=k.split('.');while(s.length>1&&SK.test(s[0]))s.shift();return{raw:k,seg:s,v}})
 .filter(r=>!TECH.test(r.seg[r.seg.length-1])).map(r=>[lbl(r.seg[r.seg.length-1],hum(r.seg[r.seg.length-1])),r.v,r.raw])}

async function api0(tool,email,code,link,fields){
 try{const r=await fetch('/api/tool',{method:'POST',headers:{'Content-Type':'application/json','x-access-code':code||''},body:JSON.stringify({tool,input:email,link,fields})});
  const j=await r.json().catch(()=>({ok:false,error:'Respons server tidak valid.'}));j.code=r.status;return j}
 catch(e){return{ok:false,error:'Tidak bisa terhubung ke server.'}}}

function crHtml(c){if(c.unlimited)return'<b>Koin tak terbatas</b><span>Akun developer</span>';
 const n=c.left||0,fr=c.free||0,bc=c.coins||0,f=x=>x.toLocaleString('id-ID');
 let g='';if(fr>0)g='Gratis '+fr+' koin';else if(c.resetAt&&c.refill){const ms=Math.max(0,c.resetAt-Date.now()),h=Math.floor(ms/36e5),mi=Math.max(1,Math.ceil(ms%36e5/6e4));g='Gratis +'+c.refill+' koin dalam '+(h>0?h+' jam'+(mi<60?' '+mi+' mnt':''):mi+' mnt')}
 const sub=g+(bc>0?(g?' · ':'')+'Beli '+f(bc)+' (tidak hangus)':'');
 return'<b>'+(n>0?'Saldo '+f(n)+' koin':'Koin habis')+'</b><span>'+(sub?sub+' · ':'')+'<a href="#role">Beli koin</a></span>'}
async function crLoad(){
 try{const j=await(await fetch('/api/tool?credits=1',{credentials:'same-origin'})).json();return j.ok?j.credits:null}catch(e){return null}}
const MAXIN=50*1024*1024,LIMIT=3.9*1024*1024,VIDMAX=4.3*1024*1024;
const mb=n=>(n/1048576).toFixed(1).replace('.',',')+' MB';
async function prepare(file){
 if(file.size<=LIMIT&&/^image\/(jpeg|png|webp)$/.test(file.type))return file;
 let bmp;try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){throw new Error('Foto tidak bisa dibaca di browser ini. Coba simpan sebagai JPG atau PNG.')}
 let side=Math.min(3000,Math.max(bmp.width,bmp.height)),q=.9;
 for(let i=0;i<8;i++){
  const k=side/Math.max(bmp.width,bmp.height),w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  const png=i<4&&/^image\/(png|webp)$/.test(file.type); // PNG/WebP dicoba tetap PNG dulu supaya transparansi tidak jadi putih; baru JPG bila tetap terlalu besar
  if(!png){x.fillStyle='#fff';x.fillRect(0,0,w,h)}x.drawImage(bmp,0,0,w,h);
  const b=await new Promise(r=>c.toBlob(r,png?'image/png':'image/jpeg',q));
  if(b&&b.size<=LIMIT)return b;
  if(!png)q=Math.max(.72,q-.06);side=Math.round(side*.85)}
 throw new Error('Foto terlalu besar untuk dikecilkan. Coba foto dengan resolusi lebih kecil.')}
async function upload(blob,code){
 try{const r=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','x-access-code':code||''},body:blob});
  const j=await r.json().catch(()=>({ok:false,error:'Respons server tidak valid.'}));j.code=r.status;return j}
 catch(e){return{ok:false,error:'Tidak bisa terhubung ke server.'}}}

// Tombol Unduh untuk semua foto hasil tool (kategori mana pun). Satu penangan klik global lewat atribut data-unduh.
const IMGK=/(photo|foto|image|images|img|gambar|thumb|cover|avatar|pic|screenshot|slide)/i,IMGX=/\.(jpe?g|png|webp|gif|heic|avif)(\?|#|$)/i;
function isImg(k,v){v=String(v);return /^https?:\/\//i.test(v)&&(IMGX.test(v)||IMGK.test(String(k)))&&!/\.(mp4|mp3|m4a|webm|mov)(\?|#|$)/i.test(v)}
const DLI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
function unduhBtn(u,n,t){return `<button type="button" class="unb" data-unduh="${esc(u)}" data-n="${esc(n||'foto.jpg')}">${DLI}<span>${t||'Unduh Foto'}</span></button>`}
// Jenis media dari alamat atau nama field: gambar / video / audio. Dipakai untuk memilih tombol Unduh Foto, Unduh Video, atau Unduh Audio.
const VIDX=/\.(mp4|m4v|mov|webm|mkv)(\?|#|$)/i,AUDX=/\.(mp3|m4a|aac|opus|ogg|wav)(\?|#|$)/i,VIDK=/video|nowm|nwm|reel|mp4|(^|[^a-z])(vid|hd|sd|play)([^a-z]|$)/i,AUDK=/audio|musik|music|mp3|lagu/i;
function mediaKind(k,v){v=String(v||'');if(!/^(https?:\/\/|data:image\/|blob:)/i.test(v))return'';if(/^data:image\//i.test(v))return'image';if(AUDX.test(v))return'audio';if(VIDX.test(v))return'video';if(IMGX.test(v))return'image';k=String(k||'');if(AUDK.test(k)&&!VIDK.test(k))return'audio';if(IMGK.test(k))return'image';if(VIDK.test(k))return'video';return''}
const MEDIA_UI={image:['Unduh Foto','jpg'],video:['Unduh Video','mp4'],audio:['Unduh Audio','mp3']};
const PLI='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',PSI='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
function playBtn(u){return `<button type="button" class="unb" data-play="${esc(u)}">${PLI}<span>Putar Audio</span></button>`}
const WTI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>';
function vidHtml(u){return `<div class="mtvw"><video class="mtv" controls playsinline preload="metadata" referrerpolicy="no-referrer" src="${esc(u)}" onerror="this.parentNode.innerHTML='<p class=&quot;mtvn&quot;>Pratinjau tidak bisa diputar di sini. Kamu tetap bisa mengunduh videonya.</p>'"></video></div>`}
function audHtml(u,auto){return `<div class="mtaw"><audio class="mta" controls preload="${auto?'metadata':'none'}" referrerpolicy="no-referrer" src="${esc(u)}" onerror="this.parentNode.innerHTML='<p class=&quot;mtvn&quot;>Audio tidak bisa diputar di sini. Kamu tetap bisa mengunduhnya.</p>'"></audio></div>`}
const LKI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
function imgHtml(u){return `<div class="mtvw mtiw"><img class="mti" loading="lazy" referrerpolicy="no-referrer" alt="Foto" src="${esc(u)}" onerror="this.parentNode.innerHTML='<p class=&quot;mtvn&quot;>Pratinjau foto tidak bisa dimuat di sini. Kamu tetap bisa mengunduhnya.</p>'"></div>`}
function mediaBtn(k,v,base,force,auto,lb){const t=mediaKind(k,v)||(lb&&mediaKind(lb,v))||force||'';if(!t)return'';const nm=(base||String(k||'').split('.').pop().replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)||t)+'.'+MEDIA_UI[t][1];return (t==='audio'?audHtml(v,auto):'')+(t==='video'?(auto?vidHtml(v):`<button type="button" class="unb" data-watch="${esc(v)}">${WTI}<span>Tonton dulu</span></button>`):'')+(t==='image'?(auto?imgHtml(v):`<button type="button" class="unb" data-look="${esc(v)}">${LKI}<span>Lihat foto</span></button>`):'')+unduhBtn(v,nm,MEDIA_UI[t][0])}
// Putar Audio: satu pemutar bawaan (dengan geser/seek) muncul di bawah tombol yang diketuk; hanya satu lagu berbunyi sekaligus.
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-play]');if(!b)return;ev.preventDefault();ev.stopPropagation();
 const lab=(x,on,t)=>{x.innerHTML=(on?PSI:PLI)+'<span>'+(t||(on?'Jeda':'Putar Audio'))+'</span>'};
 const host=b.closest('.row,dd,li')||b.parentNode;let a=host.querySelector('audio.mtp');
 document.querySelectorAll('audio.mtp').forEach(x=>{if(x!==a)x.pause()});
 if(a){a.paused?a.play().catch(()=>{}):a.pause();return}
 a=document.createElement('audio');a.className='mtp';a.controls=true;a.preload='auto';a.setAttribute('playsinline','');a.style.cssText='flex:1 1 100%;width:100%;margin-top:10px;height:40px';
 a.onplay=()=>lab(b,true);a.onpause=()=>lab(b,false);a.onended=()=>lab(b,false);
 a.onerror=()=>{lab(b,false,'Gagal memutar, coba lagi');a.remove()};
 a.src=b.getAttribute('data-play');host.appendChild(a);lab(b,false,'Memuat...');a.play().catch(()=>lab(b,false))},true);
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-watch]');if(!b)return;ev.preventDefault();ev.stopPropagation();
 const host=b.closest('dd,li,.row')||b.parentNode;let w=host.querySelector('.mtvw');
 if(w){const v=w.querySelector('video');if(v)v.pause();w.remove();b.querySelector('span').textContent='Tonton dulu';return}
 document.querySelectorAll('.mtvw video').forEach(x=>x.pause());
 host.insertAdjacentHTML('beforeend',vidHtml(b.getAttribute('data-watch')));b.querySelector('span').textContent='Tutup video';const v=host.querySelector('.mtvw video');if(v)v.play().catch(()=>{})},true);
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-look]');if(!b)return;ev.preventDefault();ev.stopPropagation();
 const host=b.closest('dd,li,.row')||b.parentNode;let w=host.querySelector('.mtiw');
 if(w){w.remove();b.querySelector('span').textContent='Lihat foto';return}
 host.insertAdjacentHTML('beforeend',imgHtml(b.getAttribute('data-look')));b.querySelector('span').textContent='Tutup foto'},true);
document.addEventListener('play',e=>{document.querySelectorAll('audio.mta,audio.mtp,video.mtv').forEach(x=>{if(x!==e.target)x.pause()})},true);
// Chat: ketuk pesan untuk menampilkan aksi, ketuk di luar untuk menutup.
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;const on=document.querySelectorAll('.cpanel .cmsg.act');const b=t.closest('.cpanel .cb');
 if(!b){if(!t.closest('.cpanel .cmsg'))on.forEach(x=>x.classList.remove('act'));return}
 if(t.closest('a,button,img,[data-a],[data-go]'))return;const m=b.closest('.cmsg'),was=m.classList.contains('act');on.forEach(x=>x.classList.remove('act'));if(!was)m.classList.add('act')});
document.addEventListener('click',async ev=>{const b=ev.target.closest&&ev.target.closest('[data-unduh]');if(!b)return;ev.preventDefault();ev.stopPropagation();
 const u=b.getAttribute('data-unduh'),n=b.getAttribute('data-n')||'foto.jpg',t=b.innerHTML;b.disabled=true;b.textContent='Mengunduh...';
 if(/^(data|blob):/i.test(u)){const a=document.createElement('a');a.href=u;a.download=n;document.body.appendChild(a);a.click();a.remove();b.disabled=false;b.innerHTML=t;return}
 const own=u.indexOf(location.origin+'/api/audio?')===0;let nn=n;try{const q=await fetch(own?u+'&dl=1&n='+encodeURIComponent(nn):'/api/dl?u='+encodeURIComponent(u)+'&n='+encodeURIComponent(n),{credentials:'same-origin'});if(!q.ok)throw 0;if(own){const mm=/filename="([^"]+)"/.exec(q.headers.get('content-disposition')||'');if(mm)nn=mm[1]}const bl=await q.blob(),a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=nn;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(e){window.open(u,'_blank','noopener')}
 b.disabled=false;b.innerHTML=t},true);
// Sumber profil tunggal: pengguna masuk memakai data server (sama dengan Global Chat), tamu memakai data perangkat.
const pName=()=>(AUTH.user?AUTH.user.name:ls.get('mt_name'))||'';
const pPic=()=>(AUTH.user?(typeof AUTH.user.picture==='string'?AUTH.user.picture:''):ls.get('mt_photo'))||'';
/* Daftar ringkas tool (id + nama) untuk beranda, pencarian, dan dok. Kode lengkap tiap tool ada di js/tools.js
   dan baru dimuat saat tool dibuka. Dijaga sinkron oleh `npm run check` (perbaiki dengan `npm run sync`). */
const TOOL_IDX=[
['am-premium','AM Generator'],
['am-premium2','AM Prem V2'],
['spotify-play','Spotify Play'],
['ig-dl','Instagram Downloader'],
['mediafire-dl','Mediafire Downloader'],
['youtube-dl','YouTube Downloader'],
['hapus-background','Hapus Background'],
['tts-google','Google TTS (Gemini)'],
['ssweb','Website Screenshot'],
['rch','Reaksi Channel WhatsApp'],
['rch2','Reaksi Channel WhatsApp V2'],
['rch3','Reaksi Channel WhatsApp V3'],
['qr-code','QR Code Generator'],
['upscale','HD Gambar'],
['swhd','SW HD'],
['brat-v1','Brat Generator V1'],
['bratvid','Brat Video Generator'],
['fake-channel','Fake Channel WhatsApp'],
['fake-call','Fake Call WhatsApp'],
['jarvis-meme','Jarvis Meme'],
['igqc','Instagram Quick Chat'],
['iqc-dark','IQC Dark'],
['duar-viral','Duar Viral'],
['quote-card','Quoted Card IG Viral'],
['carbon','Carbon Code'],
['soundcloud-dl','SoundCloud Player'],
['dailymotion-dl','Dailymotion Downloader'],
['tiktok-dl','TikTok Downloader'],
['open-graph','Open Graph Scraper'],
['cek-situs','Cek Situs'],
['konversi-gambar','Konversi Gambar'],
['am-find','AM Find'],
['am-data','Alight Motion Data'],
['image-to-prompt','Image to Prompt'],
['getcontact-start','GetContact Verifikasi'],
['bypass-cf','Bypass Cloudflare Turnstile'],
['link-wa','Link WhatsApp'],
['kompres-gambar','Kompres Gambar'],
['kalkulator-cicilan','Kalkulator Cicilan'],
['generator-password','Generator Password'],
['pengubah-satuan','Pengubah Satuan'],
['hitung-kata','Hitung Kata'],
['kalkulator-zakat','Kalkulator Zakat'],
['tanda-tangan','Generator Tanda Tangan'],
['kalkulator-umur','Kalkulator Umur'],
['kalkulator-diskon','Kalkulator Diskon'],
['kalkulator-bmi','Kalkulator BMI'],
['split-bill','Pemisah Tagihan'],
['nomor-acak','Nomor Acak dan Undian'],
['daftar-tugas','Daftar Tugas'],
['kode-warna','Kode Warna dan Palet'],
['hitung-hari','Penghitung Hari'],
['pembersih-teks','Pembersih Teks'],
['kalkulator-kalori','Kalkulator Kalori Harian'],
['json-formatter','JSON Formatter'],
['encode-decode','Encode dan Decode'],
['generator-hash','Generator Hash'],
['konversi-timestamp','Konversi Timestamp'],
['angka-terbilang','Angka ke Terbilang'],
['meme-maker','Meme Maker'],
['sticker-wa','Pembuat Stiker WhatsApp'],
['watermark-foto','Watermark Foto'],
['avatar-bulat','Avatar Bulat'],
['story-teks','Story Teks'],
['kalkulator-persen','Kalkulator Persen'],
['konversi-huruf','Ubah Gaya Huruf'],
['timer-pomodoro','Timer Pomodoro'],
['gradient-maker','Gradient Maker'],
['putar-foto','Putar dan Balik Foto'],
['angka-romawi','Angka Romawi'],
['kalkulator-tabungan','Kalkulator Tabungan'],
['generator-uuid','Generator UUID'],
['stopwatch','Stopwatch'],
['bandingkan-teks','Bandingkan Teks'],
['cek-kontras','Cek Kontras Warna'],
['filter-foto','Filter Foto'],
['kolase-foto','Kolase Foto']
];
const tools=TOOL_IDX.map(([id,name])=>({id,name}));
const svg=p=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const IC={
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
 logo:'<path d="M4 18l1.5-9 4.5 4 2-7 2 7 4.5-4L20 18z"/><path d="M4 21h16"/>',up:'<path d="M12 16V5M7 10l5-5 5 5M5 19h14"/>',
 'am-premium':'<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>',
 'am-preset':'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
 'cek-prime':'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1 1.3-1.7 3-1.7s3 .7 3 1.7-1.3 1.7-3 1.7-3 .7-3 1.7 1.3 1.7 3 1.7 3-.7 3-1.7"/>',
 'am-verif':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
 'am-send':'<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>',
 'magic-link':'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 'cek-status':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
 'bypass-link':'<path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/>',
 'react-channel':'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
 'aio-dl':'<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>',
 'capcut-dl':'<path d=\"M12 3v12M7 11l5 5 5-5\"/><path d=\"M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4\"/>',
 'fb-dl':'<path d=\"M12 3v12M7 11l5 5 5-5\"/><path d=\"M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4\"/>',
 'ig-dl':'<path d=\"M12 3v12M7 11l5 5 5-5\"/><path d=\"M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4\"/>',
 'spotify-play':'<path d=\"M12 3v12M7 11l5 5 5-5\"/><path d=\"M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4\"/>',
 'iqc-dark':'<rect x=\"3\" y=\"4\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M7 21h10M12 18v3\"/><path d=\"M7 14l3-4 3 3 2-2 3 3\"/>',
 'duar-viral':'<path d=\"M12 3c1 3 5 5 5 9a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 2.500 1.500 2.500C11 8 11 5 12 3z\"/><path d=\"M5 21h14\"/>',
 'quote-card':'<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"M9 10c-1.500 0-2 1-2 2.500S8 15 9 15M16 10c-1.500 0-2 1-2 2.500S15 15 16 15\"/>',
 'fake-call':'<path d=\"M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z\"/>',
 'tiktok-stalker':'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
 'netflix-token':'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
 'wink':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'hd-gambar':'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
 'hapus-background':'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="M20 15l-4-4-9 9"/>',
 'link-wa':'<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>',
 go:'<path d="M5 12h14M13 6l6 6-6 6"/>',home:'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',chev:'<path d="M9 6l6 6-6 6"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',changelog:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 16V9a3 3 0 0 1 3-3h7"/>',feedback:'<path d="M4 5h16v11H9l-5 4z"/>',stats:'<path d="M5 20V10M12 20V4M19 20v-7"/>',profil:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'};
Object.assign(IC,{
 'am-premium':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
 'am-premium2':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
 'am-verif':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
 'am-send':'<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>',
 'ig-dl':'<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.8 7.2h.01"/>',
 'mediafire-dl':'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
 'dailymotion-dl':'<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
 'soundcloud-dl':'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
 'youtube-dl':'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>',
 'tiktok-dl':'<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.4 2.1 4 4.5 4.2"/>',
 'capcut-dl':'<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 18M8 15.5L20 6"/>',
 'fb-dl':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>',
 'ig-dl':'<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.8 7.2h.01"/>',
 'mediafire-dl':'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
 'dailymotion-dl':'<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
 'soundcloud-dl':'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
 'spotify-play':'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
 'brat-v1':'<path d="M5 6h14v12H5z"/><path d="M8.5 10h7M8.5 14h4"/>',
 'bratvid':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/>',
 'fake-channel':'<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 9a4 4 0 010 6M18 6.5a8 8 0 010 11"/>',
 'jarvis-meme':'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M7.5 7h9"/><circle cx="12" cy="15" r="2.5"/>',
 'igqc':'<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.8 7.2h.01"/>',
 'carbon':'<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M14 5l-4 14"/>',
 'open-graph':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
 'cek-situs':'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
 'konversi-gambar':'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
 'am-data':'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M8 14h4M8 16.5h2.5"/>',
 'am-find':'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.500-4.500"/><path d="M9 11h4M11 9v4"/>',
 'getcontact-start':'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
 'tts-google':'<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
 'ssweb':'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 8h18"/><path d="M9 21h6M12 17v4"/>',
 'rch':'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
 'rch2':'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
 'rch3':'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
 'qr-code':'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v3"/>',
 'upscale':'<path d="M4 14v6h6"/><path d="M20 10V4h-6"/><path d="M4 20l7-7"/><path d="M20 4l-7 7"/>',
 'swhd':'<path d="M12 3l1.800 4.700L18.500 9.500l-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800z"/><path d="M18 15l.8 2.200L21 18l-2.200.8L18 21l-.8-2.200L15 18l2.200-.8z"/>',
 'image-to-prompt':'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.5"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
 'bypass-cf':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><rect x="9.5" y="11" width="5" height="4" rx="1"/><path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11"/>'});
IC.riwayat='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
const META={
 'cek-prime':{c:'#4fd69a',tab:'Prime',note:'GRATIS',lead:'Cek kalkulasi dan status point prime'},
 'am-preset':{c:'#4fd69a',tab:'Preset',note:'GRATIS',lead:'Ambil link preset AM dari komentar atau bio TikTok'},
 'am-premium':{c:'#4fd69a',note:'1 KOIN',tab:'AM',lead:'Kirim email aktivasi, lalu verifikasi dengan link dari email'},
 'am-premium2':{c:'#4fd69a',note:'1 KOIN',tab:'AM V2',lead:'Jalur V2: kirim email aktivasi, lalu verifikasi dengan link dari email'},
 'am-verif':{c:'#4fd69a',tab:'Verif',lead:'Tempel link dari email untuk aktivasi AM Premium'},
 'am-send':{c:'#4fd69a',tab:'Kirim',lead:'Kirim verifikasi/aktivasi akun AM Premium ke email'},
 'magic-link':{c:'#ffc83d',note:'VIA API',tab:'Magic',lead:'Link login Alight Motion untuk sebuah akun'},
 'cek-status':{c:'#4fd69a',note:'VIA API',tab:'Status',lead:'Cek status premium dan masa berlakunya'},
 'hapus-background':{c:'#4fd69a',note:'GRATIS',tab:'BG',lead:'Foto jadi transparan, unggah file atau link'},
 'bypass-link':{c:'#4fd69a',note:'GRATIS',tab:'Bypass',lead:'Lewati Linkvertise, Safelink, dan link pendek lain'},
 'react-channel':{c:'#ffc83d',note:'GRATIS',tab:'React',lead:'Kirim reaction emoji ke pesan channel WhatsApp'},
 'aio-dl':{c:'#4fd69a',note:'GRATIS',tab:'AIO',lead:'Unduh video, audio, atau reels dari banyak platform'},
 'am-premium':{c:'#4fd69a',note:'1 KOIN',tab:'AM',lead:'Kirim email verifikasi, lalu aktifkan Pro dengan link dari email'},
 'am-premium2':{c:'#4fd69a',note:'1 KOIN',tab:'AM V2',lead:'Jalur V2: kirim email verifikasi, lalu aktifkan Pro dengan link dari email'},
 'am-verif':{c:'#4fd69a',tab:'Verif',lead:'Tempel link dari email untuk aktivasi AM Generator'},
 'am-send':{c:'#4fd69a',tab:'Kirim',lead:'Kirim email verifikasi Alight Motion'},
 'ig-dl':{c:'#4fd69a',note:'GRATIS',tab:'Instagram',lead:'Foto, video, Reels, dan Carousel Instagram'},
 'mediafire-dl':{c:'#4fd69a',note:'GRATIS',tab:'Mediafire',lead:'Link unduh langsung Mediafire beserta info file'},

 'dailymotion-dl':{c:'#4fd69a',note:'GRATIS',tab:'Dailymotion',lead:'Video Dailymotion pilihan kualitas sampai 1080p'},
 'soundcloud-dl':{c:'#4fd69a',note:'GRATIS',tab:'SoundCloud',lead:'Putar lagu SoundCloud lewat pemutar resmi'},
 'youtube-dl':{c:'#4fd69a',note:'GRATIS',tab:'YouTube',lead:'Video dan audio YouTube, pilih kualitas'},
 'tiktok-dl':{c:'#4fd69a',note:'GRATIS',tab:'TikTok',lead:'Video TikTok tanpa watermark, HD dan audio'},
 'capcut-dl':{c:'#4fd69a',note:'GRATIS',tab:'CapCut',lead:'Video dan template CapCut tanpa watermark'},
 'fb-dl':{c:'#4fd69a',note:'GRATIS',tab:'Facebook',lead:'Video Facebook publik kualitas SD/HD'},
 'ig-dl':{c:'#4fd69a',note:'GRATIS',tab:'Instagram',lead:'Foto, video, Reels, dan Carousel Instagram'},
 'mediafire-dl':{c:'#4fd69a',note:'GRATIS',tab:'Mediafire',lead:'Link unduh langsung Mediafire beserta info file'},

 'dailymotion-dl':{c:'#4fd69a',note:'GRATIS',tab:'Dailymotion',lead:'Video Dailymotion pilihan kualitas sampai 1080p'},
 'soundcloud-dl':{c:'#4fd69a',note:'GRATIS',tab:'SoundCloud',lead:'Putar lagu SoundCloud lewat pemutar resmi'},
 'spotify-play':{c:'#4fd69a',note:'GRATIS',tab:'Spotify',lead:'Cari lagu Spotify, putar dan unduh MP3'},
 'igqc':{c:'#4fd69a',note:'GRATIS',tab:'IGQC',lead:'Mockup menu pesan Instagram dengan pesan, gambar, dan bar reaksi'},
 'carbon':{c:'#4fd69a',note:'GRATIS',tab:'Carbon',lead:'Ubah kode jadi gambar bergaya Carbon'},
 'jarvis-meme':{c:'#4fd69a',note:'GRATIS',tab:'Jarvis',lead:'Meme Jarvis dengan teks sendiri yang otomatis menyesuaikan ukuran'},
 'fake-channel':{c:'#25d366',note:'GRATIS',tab:'Saluran',lead:'Mockup Info Saluran WhatsApp iOS dengan foto, nama, dan pengikut'},
 'bratvid':{c:'#4fd69a',note:'GRATIS',tab:'BratVid',lead:'Video teks gaya Brat dengan warna latar dan teks pilihan'},
 'brat-v1':{c:'#4fd69a',note:'GRATIS',tab:'Brat',lead:'Gambar teks gaya Brat dengan warna latar dan teks pilihan'},
 'iqc-dark':{c:'#4fd69a',note:'GRATIS',tab:'IQC',lead:'Kartu kutipan chat tema gelap dengan gambar dan waktu'},
 'duar-viral':{c:'#4fd69a',note:'GRATIS',tab:'Duar',lead:'Tempel fotomu ke latar ledakan api ala meme viral'},
 'quote-card':{c:'#4fd69a',note:'GRATIS',tab:'Quote',lead:'Kartu kutipan ala status WA/IG dengan teks sendiri'},
 'fake-call':{c:'#25d366',note:'GRATIS',tab:'Call',lead:'Mockup layar panggilan WhatsApp iOS dengan foto, nama, dan durasi'},
 'tiktok-stalker':{c:'#4fd69a',note:'GRATIS',tab:'Stalker',lead:'Lihat detail profil akun TikTok dari username'},
 'netflix-token':{c:'#ff5d6c',note:'GRATIS',tab:'Netflix',lead:'Buat token Netflix untuk negara pilihanmu'},
 'wink':{c:'#4fd69a',note:'GRATIS',tab:'Wink',lead:'Animasikan foto wajah jadi kedipan mata dengan AI'},
 'hd-gambar':{c:'#4fd69a',note:'GRATIS',tab:'HD',lead:'Perjelas dan perbesar resolusi foto dengan AI'},
 'open-graph':{c:'#4fd69a',note:'GRATIS',tab:'OG',lead:'Judul, deskripsi, dan gambar pratinjau dari link situs'},
 'cek-situs':{c:'#4fd69a',note:'GRATIS',tab:'Cek Situs',lead:'Status online, waktu respons, redirect, dan SSL'},
 'konversi-gambar':{c:'#4fd69a',note:'GRATIS',tab:'Konversi',lead:'Ubah format dan kecilkan ukuran gambar di perangkatmu'},
 'am-data':{c:'#4fd69a',note:'GRATIS',tab:'AM Data',lead:'Metadata proyek, UID, dan PID dari link share Alight Motion'},
 'am-find':{c:'#4fd69a',note:'GRATIS',tab:'AM Find',lead:'Cari link preset Alight Motion di komentar video TikTok'},
 'getcontact-start':{c:'#4fd69a',note:'GRATIS',tab:'GetContact',lead:'Mulai verifikasi GetContact lewat WhatsApp'},
 'tts-google':{c:'#4fd69a',note:'GRATIS',tab:'TTS',lead:'Ubah teks jadi suara natural dengan Gemini, hasil MP3'},
 'ssweb':{c:'#4fd69a',note:'GRATIS',tab:'SS Web',lead:'Screenshot situs web dengan tampilan PC, Tablet, atau Android'},
 'qr-code':{c:'#4fd69a',note:'GRATIS',tab:'QR',lead:'Ubah link atau teks jadi QR Code PNG'},
 'rch':{c:'#ffc83d',note:'3 KOIN',tab:'Reaksi',lead:'Kirim reaksi emoji ke postingan channel WhatsApp'},
 'rch2':{c:'#ffc83d',note:'3 KOIN',tab:'Reaksi V2',lead:'Kirim reaksi emoji ke postingan channel WhatsApp'},
 'rch3':{c:'#ffc83d',note:'3 KOIN',tab:'Reaksi V3',lead:'Kirim reaksi emoji ke postingan channel WhatsApp'},
 'upscale':{c:'#4fd69a',note:'GRATIS',tab:'HD',lead:'Perbesar dan perjelas gambar 2x dengan AI'},
 'swhd':{c:'#4fd69a',note:'GRATIS',tab:'HD',lead:'Jernihkan foto atau video jadi HD dengan AI'},
 'image-to-prompt':{c:'#4fd69a',note:'GRATIS',tab:'Prompt',lead:'Ubah gambar jadi prompt AI yang detail'},
 'bypass-cf':{c:'#ffc83d',note:'GRATIS',tab:'Turnstile',lead:'Token Cloudflare Turnstile untuk sebuah situs'},
 'link-wa':{c:'#25d366',note:'DI BROWSER',tab:'WA',lead:'Link chat WhatsApp dengan pesan yang sudah terisi'}};
IC.owner='<path d="M4 19h16M4 8l4 4 4-7 4 7 4-4-2 11H6z"/>';IC.chat=IC.feedback||IC.go;IC.role=IC.owner;IC.custom=IC.go;
META['kompres-gambar']={c:'#4fd69a',note:'GRATIS',tab:'Kompres',lead:'Kecilkan foto sampai di bawah batas KB yang kamu mau'};
META['kalkulator-cicilan']={c:'#4fd69a',note:'GRATIS',tab:'Cicilan',lead:'Hitung cicilan KPR, kendaraan, atau pinjaman'};
META['generator-password']={c:'#4fd69a',note:'GRATIS',tab:'Password',lead:'Buat password acak yang kuat di perangkatmu'};
META['pengubah-satuan']={c:'#4fd69a',note:'GRATIS',tab:'Satuan',lead:'Ubah satuan panjang, berat, suhu, dan lainnya'};
META['hitung-kata']={c:'#ffc83d',note:'GRATIS',tab:'Kata',lead:'Hitung kata, karakter, dan waktu baca teks'};
Object.assign(IC,{'kompres-gambar':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 12l3 3 5-6"/>','kalkulator-cicilan':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>','generator-password':'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>','pengubah-satuan':'<path d="M4 8h14l-4-4M20 16H6l4 4"/>','hitung-kata':'<path d="M4 6h16M4 12h10M4 18h14"/>'});
META['kalkulator-zakat']={c:'#4fd69a',note:'GRATIS',tab:'Zakat',lead:'Hitung zakat penghasilan, maal, dan emas'};
META['tanda-tangan']={c:'#4fd69a',note:'GRATIS',tab:'TTD',lead:'Gambar tanda tangan, unduh PNG transparan'};
META['kalkulator-umur']={c:'#4fd69a',note:'GRATIS',tab:'Umur',lead:'Hitung umur tepat dan ulang tahun berikutnya'};
META['kalkulator-diskon']={c:'#ffc83d',note:'GRATIS',tab:'Diskon',lead:'Harga akhir setelah diskon dan PPN 11%'};
Object.assign(IC,{'kalkulator-zakat':'<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>','tanda-tangan':'<path d="M3 17c3-6 5-9 7-9s0 8 3 8 3-5 5-5 2 3 3 3"/><path d="M3 21h18"/>','kalkulator-umur':'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>','kalkulator-diskon':'<path d="M5 19L19 5"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'});
META['kalkulator-bmi']={c:'#4fd69a',note:'GRATIS',tab:'BMI',lead:'Hitung BMI dan rentang berat badan normal'};
META['split-bill']={c:'#4fd69a',note:'GRATIS',tab:'Patungan',lead:'Bagi tagihan ke beberapa orang, termasuk pajak'};
META['nomor-acak']={c:'#4fd69a',note:'GRATIS',tab:'Acak',lead:'Acak angka atau undi pemenang dari daftar nama'};
META['daftar-tugas']={c:'#4fd69a',note:'GRATIS',tab:'Tugas',lead:'Catat tugas dan daftar belanja di browser'};
Object.assign(IC,{'kalkulator-bmi':'<path d="M12 4v16M5 20h14"/><path d="M6 9l6-3 6 3"/><path d="M4 14h4M16 14h4"/>','split-bill':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>','nomor-acak':'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="12" cy="12" r="1"/>','daftar-tugas':'<path d="M5 7l2 2 3-4M5 16l2 2 3-4M13 8h6M13 17h6"/>'});
META['kode-warna']={c:'#4fd69a',note:'GRATIS',tab:'Warna',lead:'Kode HEX, RGB, HSL, dan palet warna serasi'};
META['hitung-hari']={c:'#4fd69a',note:'GRATIS',tab:'Hari',lead:'Selisih hari antar tanggal dan tambah hari'};
META['pembersih-teks']={c:'#4fd69a',note:'GRATIS',tab:'Teks',lead:'Hapus baris kosong, duplikat, dan emoji sekali klik'};
META['kalkulator-kalori']={c:'#4fd69a',note:'GRATIS',tab:'Kalori',lead:'Perkiraan kebutuhan kalori harian (BMR dan TDEE)'};
Object.assign(IC,{'kode-warna':'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a3 3 0 0 0 3-3c0-5-3.5-9-8-9z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="11" r="1"/>','hitung-hari':'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h3M13 14h3M8 17h3"/>','pembersih-teks':'<path d="M5 6h14M5 12h9M5 18h6"/><path d="M16 15l4 4M20 15l-4 4"/>','kalkulator-kalori':'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2-1-3-.5-5 1-8z"/>'});
META['json-formatter']={c:'#ffc83d',note:'GRATIS',tab:'JSON',lead:'Rapikan, padatkan, dan cek JSON valid'};
META['encode-decode']={c:'#4fd69a',note:'GRATIS',tab:'Encode',lead:'Base64 dan URL encode atau decode teks'};
META['generator-hash']={c:'#4fd69a',note:'GRATIS',tab:'Hash',lead:'Hash SHA-256 dan lainnya dari teks atau file'};
META['konversi-timestamp']={c:'#4fd69a',note:'GRATIS',tab:'Timestamp',lead:'Unix timestamp ke tanggal dan sebaliknya'};
META['angka-terbilang']={c:'#4fd69a',note:'GRATIS',tab:'Terbilang',lead:'Ubah angka jadi tulisan untuk kwitansi'};
Object.assign(IC,{'json-formatter':'<path d="M8 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3"/>','encode-decode':'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>','generator-hash':'<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>','konversi-timestamp':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>','angka-terbilang':'<path d="M4 6h16M4 12h10M4 18h7"/><path d="M16 17l2 2 4-5"/>'});
Object.assign(IC,{'meme-maker':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M8 16h8"/>','sticker-wa':'<path d="M5 4h9l5 5v9a2 2 0 0 1-2 2H5z"/><path d="M14 4v5h5"/><circle cx="10" cy="14" r="2.500"/>','watermark-foto':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 16l4-8 4 8M9.500 13h5"/>','avatar-bulat':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.500 18c1.200-2.500 3-3.500 5.500-3.500s4.300 1 5.500 3.500"/>','story-teks':'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M10 9h4M10 12h4M10 15h2"/>'});
META['meme-maker']={c:'#4fd69a',note:'GRATIS',tab:'Meme',lead:'Teks atas dan bawah di foto, gaya meme klasik'};
META['sticker-wa']={c:'#4fd69a',note:'GRATIS',tab:'Stiker',lead:'Foto jadi stiker 512 px transparan'};
META['watermark-foto']={c:'#4fd69a',note:'GRATIS',tab:'Watermark',lead:'Tempel teks watermark di foto'};
META['avatar-bulat']={c:'#4fd69a',note:'GRATIS',tab:'Avatar',lead:'Foto profil bulat dengan bingkai'};
META['kalkulator-persen']={c:'#ffc83d',note:'GRATIS',tab:'Persen',lead:'Hitung persen, kenaikan, dan penurunan'};
META['konversi-huruf']={c:'#4fd69a',note:'GRATIS',tab:'Huruf',lead:'Besar, kecil, camelCase, snake_case, slug, dan aLaY'};
META['timer-pomodoro']={c:'#4fd69a',note:'GRATIS',tab:'Timer',lead:'Fokus 25 menit, istirahat 5 menit'};
META['gradient-maker']={c:'#4fd69a',note:'GRATIS',tab:'Gradasi',lead:'Wallpaper gradasi dua warna, unduh PNG'};
META['putar-foto']={c:'#4fd69a',note:'GRATIS',tab:'Putar',lead:'Putar dan balik foto, unduh hasilnya'};
META['angka-romawi']={c:'#ffc83d',note:'GRATIS',tab:'Romawi',lead:'Angka biasa ke Romawi dan sebaliknya'};
META['kalkulator-tabungan']={c:'#4fd69a',note:'GRATIS',tab:'Tabungan',lead:'Hitung bunga majemuk dan hasil menabung'};
META['generator-uuid']={c:'#4fd69a',note:'GRATIS',tab:'UUID',lead:'Buat UUID v4 acak, satu atau banyak'};
META['stopwatch']={c:'#4fd69a',note:'GRATIS',tab:'Stopwatch',lead:'Stopwatch dengan putaran dan salin waktu'};
META['bandingkan-teks']={c:'#4fd69a',note:'GRATIS',tab:'Banding',lead:'Lihat beda dua teks baris demi baris'};
META['cek-kontras']={c:'#4fd69a',note:'GRATIS',tab:'Kontras',lead:'Cek rasio kontras WCAG teks dan latar'};
META['filter-foto']={c:'#4fd69a',note:'GRATIS',tab:'Filter',lead:'Kecerahan, kontras, saturasi, hitam putih, sepia'};
META['kolase-foto']={c:'#4fd69a',note:'GRATIS',tab:'Kolase',lead:'Gabungkan 2 sampai 4 foto jadi satu'};
Object.assign(IC,{'angka-romawi':'<path d="M6 5v14M12 5l-3 14M12 5l3 14M18 5v14"/>','kalkulator-tabungan':'<path d="M4 18h16"/><path d="M6 15l4-4 3 3 5-6"/><path d="M15 8h3v3"/>','generator-uuid':'<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10v4M12 10v4M16 10v4"/>','stopwatch':'<circle cx="12" cy="13" r="7"/><path d="M12 13V9M9.5 3h5M18 6l1.5-1.5"/>','bandingkan-teks':'<path d="M5 6h6v12H5zM13 6h6v12h-6z"/><path d="M7 10h2M15 10h2M15 14h2"/>','cek-kontras':'<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>','filter-foto':'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 15l5-4 4 3 3-2 4 3"/><circle cx="9" cy="9" r="1"/>','kolase-foto':'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="16" height="7" rx="1"/>'});
Object.assign(IC,{'kalkulator-persen':'<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>','konversi-huruf':'<path d="M4 18l4-12 4 12M5.5 14h5"/><path d="M15 9h5M17.5 9v9"/>','timer-pomodoro':'<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9.5 3h5"/>','gradient-maker':'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 16l6-6 4 4 6-6"/>','putar-foto':'<rect x="5" y="7" width="14" height="10" rx="2"/><path d="M4 4v4h4M20 20v-4h-4"/>'});
META['story-teks']={c:'#4fd69a',note:'GRATIS',tab:'Story',lead:'Teks di latar gradasi untuk story dan status'};
const CAT={'rch':'tools','rch2':'tools','rch3':'tools','am-premium':'am','am-premium2':'am','cek-prime':'tools','hapus-background':'tools','hd-gambar':'tools','swhd':'tools','wink':'tools','netflix-token':'tools','tiktok-stalker':'tools','am-preset':'tools','igqc':'canvas','carbon':'canvas','jarvis-meme':'canvas','fake-channel':'canvas','bratvid':'canvas','brat-v1':'canvas','iqc-dark':'canvas','duar-viral':'canvas','quote-card':'canvas','fake-call':'canvas','meme-maker':'canvas','sticker-wa':'canvas','watermark-foto':'canvas','avatar-bulat':'canvas','story-teks':'canvas','aio-dl':'dl','tiktok-dl':'dl','dailymotion-dl':'dl','soundcloud-dl':'dl','youtube-dl':'dl','mediafire-dl':'dl','ig-dl':'dl','capcut-dl':'dl','fb-dl':'dl','ig-dl':'dl','mediafire-dl':'dl','spotify-play':'spotify','bypass-link':'tools','image-to-prompt':'tools','bypass-cf':'tools','upscale':'tools','qr-code':'tools','ssweb':'tools','cek-situs':'tools','konversi-gambar':'util','kompres-gambar':'util','kalkulator-cicilan':'util','generator-password':'util','pengubah-satuan':'util','hitung-kata':'util','kalkulator-zakat':'util','tanda-tangan':'util','kalkulator-umur':'util','kalkulator-diskon':'util','kalkulator-bmi':'util','split-bill':'util','nomor-acak':'util','daftar-tugas':'util','kode-warna':'util','hitung-hari':'util','pembersih-teks':'util','kalkulator-kalori':'util','json-formatter':'util','encode-decode':'util','generator-hash':'util','konversi-timestamp':'util','angka-terbilang':'util','open-graph':'tools','tts-google':'tools','getcontact-start':'gc','am-data':'tools','am-find':'tools','link-wa':'util','react-channel':'tools','kalkulator-persen':'util','konversi-huruf':'util','timer-pomodoro':'tools','gradient-maker':'canvas','putar-foto':'canvas','angka-romawi':'util','kalkulator-tabungan':'util','generator-uuid':'util','stopwatch':'tools','bandingkan-teks':'tools','cek-kontras':'tools','filter-foto':'canvas','kolase-foto':'canvas'};
Object.values(META).forEach(m=>m.c='#4fd69a');
const FL=[['all','Semua'],['tools','Tools'],['dl','Downloader'],['canvas','Maker'],['util','Utilitas'],['fav','Favorit']],FC={all:'#4fd69a',tools:'#ff9a4d',dl:'#8f9aff',canvas:'#ff9a4d',util:'#4fd69a',fav:'#ff9a4d'},FI={all:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',fav:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'};
const CATS=[
 {k:'dl',n:'Downloader',d:'Unduh video, audio, dan reels',c:'#4fd69a',i:'<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>'},
 {k:'spotify',n:'Spotify',d:'Cari lagu, streaming, dan unduh MP3',c:'#4fd69a',i:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'},
 {k:'canvas',n:'Maker',d:'Buat gambar, sticker, dan konten',c:'#4fd69a',i:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 21h10M12 18v3"/><path d="M7 14l3-4 3 3 2-2 3 3"/>'},
 {k:'am',n:'AM Generator',d:'Aktifkan Alight Motion Pro via email',c:'#4fd69a',i:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'},
 {k:'tools',n:'Tools',d:'Utilitas, konversi, dan link',c:'#4fd69a',i:'<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>'},
 {k:'util',n:'Utilitas',d:'Kalkulator dan alat bantu harian',c:'#4fd69a',i:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>'},
 {k:'gc',n:'GetContact',d:'Cari profil dan tag nomor',c:'#4fd69a',i:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>'}
];
const catOf=t=>CATS.some(c=>c.k===CAT[t.id])?CAT[t.id]:'tools';
let hq='';let flt='all';const nxo=new Set(['tools','util']),NXN=Object.assign({fav:'Favorit'},Object.fromEntries(CATS.map(c=>[c.k,c.n])));let nxFirst=true;
const main=$(document,'#main'),dock=$(document,'#dock'),root=document.documentElement;
const LOGO='/logo.jpg?v=331',LOGO_HTML=`<img src="${LOGO}" alt="" width="36" height="36" onerror="this.replaceWith(document.createTextNode('M'))">`;
$(document,'#logo').innerHTML=LOGO_HTML;
function buildDock(){dock.innerHTML=tools.map(t=>`<a href="#${t.id}" data-id="${t.id}" style="--tc:${META[t.id].c}">${svg(IC[t.id])}${esc(META[t.id].tab)}</a>`).join('');const cur=location.hash.slice(1);dock.querySelectorAll('a').forEach(a=>{if(a.dataset.id===cur)a.setAttribute('aria-current','page')})}
buildDock();
new MutationObserver(()=>{const a=dock.querySelector('[aria-current=page]');if(a)dock.scrollTo({left:a.offsetLeft-(dock.clientWidth-a.offsetWidth)/2,behavior:'smooth'})}).observe(dock,{attributes:true,subtree:true,attributeFilter:['aria-current']});
const light=()=>root.dataset.theme==='light';
const themeIcon=()=>{$(document,'#th').innerHTML=svg(light()?IC.moon:IC.sun);const m=document.querySelector('meta[name=theme-color]');if(m)m.content=light()?'#f7f0df':'#15130e'};
try{const s=localStorage.getItem('theme');if(s)root.dataset.theme=s}catch(e){}
if(!root.dataset.theme)root.dataset.theme='dark';
$(document,'#th').onclick=()=>{const n=light()?'dark':'light';root.dataset.theme=n;try{localStorage.setItem('theme',n)}catch(e){}themeIcon()};
themeIcon();
const CONTACT_WA='6285772295147';
const ls={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
const nf=n=>Number(n).toLocaleString('id-ID');
function rec(tool,ok){const k=tool==='am-send'||tool==='am-verif'?'am-premium':tool==='am-send2'||tool==='am-verif2'?'am-premium2':tool,s=ls.get('mt_stats')||{},r=s[k]||{ok:0,err:0};ok?r.ok++:r.err++;s[k]=r;ls.set('mt_stats',s)}
async function api(...a){const j=await api0(...a);rec(a[0],!!(j&&j.ok));return j}
const shell=(bar,body)=>`<section class="panel"><div class="bar"><span>${bar}</span></div><div class="in">${body}</div></section>`;
const hero=(ic,h,sub)=>`<div class="thero"><span class="tile">${svg(IC[ic])}</span><div><h2>${h}</h2><p class="sub">${sub}</p></div></div>`;
const AUTH={user:null,clientId:'',requireLogin:false,ready:false};
async function authLoad(){const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),6000);try{const r=await fetch('/api/auth?action=me',{credentials:'same-origin',signal:ac.signal}),j=await r.json();AUTH.user=j.user||null;AUTH.clientId=j.clientId||'';AUTH.requireLogin=!!j.requireLogin}catch(e){}clearTimeout(tm);AUTH.ready=true}
let RDM_NOTE='';
const kpretty=c=>/^MT[A-Z0-9]{12}$/.test(c)?'MT-'+c.slice(2,6)+'-'+c.slice(6,10)+'-'+c.slice(10):c;
const redeemBox=()=>{const u=AUTH.user;if(u&&(u.isOwner||u.role==='owner'))return'';
 if(!u)return'<div class="rdm"><h3 class="sech">Punya kode redeem?</h3><p class="hint" style="margin:0">Masuk dulu lewat <a href="#profil">Profil</a> untuk menukar kode jadi koin.</p></div>';
 return'<div class="rdm"><h3 class="sech">Punya kode redeem?</h3><p class="hint">Masukkan kode dari developer untuk menambah koin di akunmu.</p><div class="rdr"><input id="rdc" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ketik kode di sini" aria-label="Kode redeem"><button type="button" class="primary" id="rdb">Tukar</button></div><p class="msg" id="rdm" role="status"></p></div>'};
async function authRedeem(code){
 const r=await fetch('/api/auth?action=redeem',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({code})}),j=await r.json().catch(()=>({}));
 if(!j.ok)throw new Error(j.error||'Gagal memakai kode.');return j}
async function payApi(action,q,body){const r=await fetch('/api/pay?action='+action+(q||''),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,credentials:'same-origin',body:body?JSON.stringify(body):undefined}),j=await r.json().catch(()=>({}));if(!j.ok)throw new Error(j.error||'Tidak bisa terhubung ke server.');return j}
// Bayar koin lewat QRIS (Meldapay): buat tagihan -> tampilkan QRIS -> cek status berkala -> koin masuk otomatis
function payInit(r,getPick,refresh){const b=$(r,'#rpay'),box=$(r,'#rpp');if(!b||!box)return;
 let tm=0,ord=null,ticks=0,cd=0;
 const stop=()=>{clearInterval(tm);tm=0;clearInterval(cd);cd=0},alive=()=>{if(!r.isConnected)stop();return r.isConnected};
 const say=(t,c)=>{const m=$(box,'#rps');if(m){m.className='msg'+(c?' '+c:'');m.textContent=t}};
 const bad=t=>{stop();box.classList.remove('qpo');box.hidden=false;box.innerHTML='<p class="msg bad" role="status" style="margin:0">'+esc(t)+'</p>'};
 const fin=j=>{stop();AUTH.user.role=j.role;AUTH.user.roleUntil=j.roleUntil||0;const p=j.order.plan,cr=j.credit;RDM_NOTE='Pembayaran berhasil. '+(p.coins?'+'+Number(p.coins).toLocaleString('id-ID')+' koin masuk ke saldomu'+(cr&&cr.left!=null?' (saldo '+Number(cr.left).toLocaleString('id-ID')+' koin)':'')+'.'+(j.role==='vip'?' Kamu sekarang VIP.':''):String(p.role||'').toUpperCase()+(p.role==='owner'?' permanen':' '+dlbl(p.days))+' aktif di akunmu.');renderPage('role');try{dList()}catch(e){}};
 const check=async man=>{if(!ord||!alive())return;try{const j=await payApi('status','&id='+encodeURIComponent(ord.id));if(alive())handle(j)}catch(e){if(man)say(e.message,'bad')}};
 const draw=o=>{ord=o;const p=o.plan,ok=/^(https:|data:image\/)/.test(o.qris||''),lk=/^https:/.test(o.link||''),sv=/^data:image\//.test(o.qris||''),
   nm=p.coins?Number(p.coins).toLocaleString('id-ID')+' koin':String(p.role||'').toUpperCase()+(p.role==='owner'?' · permanen':' · '+dlbl(p.days));
  box.classList.add('qpo');box.hidden=false;
  box.innerHTML=`<div class="qp"><div class="qp-top"><b>Bayar dengan QRIS</b><span class="qp-cd" id="qpcd" hidden>Sisa <b>--:--</b></span></div><div class="qp-amt"><small>Total bayar</small><b>${rp(o.total)}</b><div class="qp-chips"><span>${esc(nm)}</span>${p.coins?'<span class="v">Akun jadi VIP</span>':''}</div><small class="qp-bd">Harga ${rp(o.amount)} + biaya ${rp(o.fee)}</small></div>${ok?`<div class="qp-fr"><i></i><i></i><i></i><i></i><div class="qp-qr"><img src="${esc(o.qris)}" alt="Kode QRIS pembayaran" width="260" height="260"></div><small class="qp-lb">QRIS · semua e-wallet dan m-banking</small></div>`:''}<p class="msg" id="rps" role="status">${o.status==='paid'?'Pembayaran diterima, menambahkan koin...':'Menunggu pembayaran...'}</p><ol class="qp-st"><li><i>1</i>Buka e-wallet atau m-banking</li><li><i>2</i>Scan QR, bayar sesuai total</li><li><i>3</i>Koin masuk otomatis</li></ol><div class="qp-btns">${lk?`<a class="btn primary w" href="${esc(o.link)}" target="_blank" rel="noopener noreferrer">Buka halaman bayar</a>`:''}<button type="button" id="rpcopy">Salin nominal</button>${sv?`<a class="btn" href="${esc(o.qris)}" download="QRIS-Malik-Tools.png">Simpan QR</a>`:''}<button type="button" id="rpc">Cek status</button><button type="button" id="rpx">Batalkan</button></div><p class="qp-ft">Bayar tepat sesuai total (sudah termasuk biaya). Koin masuk sendiri setelah pembayaran terbaca, tidak perlu kirim bukti.</p></div>`;
  clearInterval(cd);cd=0;const ex=Date.parse(o.expiredAt||''),ce=$(box,'#qpcd'); // hitung mundur hanya bila waktu kedaluwarsa masuk akal (maks. 60 menit ke depan)
  if(ce&&ex>Date.now()&&ex-Date.now()<=60*6e4){const nb=ce.querySelector('b'),tick=()=>{const s=Math.max(0,Math.round((ex-Date.now())/1000));nb.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');ce.classList.toggle('low',s<120);if(s<=0){clearInterval(cd);cd=0;check(false)}};ce.hidden=false;tick();cd=setInterval(()=>{if(alive())tick()},1000)}
  if(!tm){ticks=0;tm=setInterval(()=>{if(!alive())return;if(++ticks>260){stop();say('Pengecekan otomatis berhenti. Ketuk Cek status bila sudah membayar.');return}if(document.visibilityState==='visible')check(false)},4500)}};
 const handle=j=>{const o=j.order;if(!o)return;if(o.status==='done')return fin(j);if(o.status==='pending'||o.status==='paid'){if(!ord||ord.id!==o.id||!$(box,'#rps'))draw(o);else{ord=o;say(o.status==='paid'?'Pembayaran diterima, menambahkan koin...':'Menunggu pembayaran...')}return}
  ord=null;bad(o.status==='expired'?'Tagihan sudah kedaluwarsa. Pilih paket lalu bayar lagi.':o.status==='cancelled'?'Tagihan dibatalkan.':o.note||'Pembayaran diterima tetapi koin belum masuk. Hubungi developer dan sebutkan ID tagihan '+o.id+'.')};
 box.onclick=async e=>{const t=e.target.closest('button');if(!t||!ord)return;
  if(t.id==='rpc'){say('Memeriksa pembayaran...');check(true)}
  if(t.id==='rpcopy'){const done=()=>{t.textContent='Tersalin ✓';setTimeout(()=>{if(t.isConnected)t.textContent='Salin nominal'},1800)};try{navigator.clipboard.writeText(String(ord.total)).then(done,()=>{})}catch(er){}}
  if(t.id==='rpx'){t.disabled=true;try{handle(await payApi('cancel','',{id:ord.id}))}catch(er){say(er.message,'bad');t.disabled=false}}};
 b.onclick=async()=>{const id=getPick();if(!id||b.dataset.busy==='1')return;b.dataset.busy='1';refresh();b.textContent='Membuat tagihan...';
  try{const j=await payApi('create','',{plan:id});if(!alive())return;if(j.order&&j.order.status==='done')fin(j);else{ord=null;box.innerHTML='';handle(j)}}catch(e){bad(e.message)}
  finally{b.dataset.busy='';if(alive())refresh()}};
 payApi('mine').then(j=>{if(alive()&&j.order)handle(j)}).catch(()=>{})}
function redeemInit(r,page){const i=$(r,'#rdc'),b=$(r,'#rdb'),m=$(r,'#rdm');if(!i||!b||!m)return;
 const say=(t,c)=>{m.className='msg'+(c?' '+c:'');m.textContent=t};
 if(RDM_NOTE){say(RDM_NOTE,'good');RDM_NOTE=''}
 const go=async()=>{const code=i.value.trim();if(!code){say('Masukkan kode dulu.','bad');return}
  b.disabled=true;say('Memeriksa kode...');
  try{const j=await authRedeem(code);AUTH.user.role=j.role;AUTH.user.roleUntil=j.roleUntil||0;RDM_NOTE=j.message;renderPage(page);try{dList()}catch(e){}}
  catch(e){say(e.message||'Gagal memakai kode.','bad');b.disabled=false}};
 b.onclick=go;i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go()}}}
async function authLogout(){try{await fetch('/api/auth?action=logout',{method:'POST',credentials:'same-origin'})}catch(e){}AUTH.user=null}
async function authGoogle(credential){const r=await fetch('/api/auth?action=google',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({credential})}),j=await r.json().catch(()=>({}));if(!j.ok)throw new Error(j.error||'Gagal masuk.');AUTH.user=j.user}
function loadGis(){return new Promise((ok,no)=>{if(window.google&&google.accounts&&google.accounts.id)return ok();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
const authT0=performance.now();const authP=authLoad().then(()=>Math.round(performance.now()-authT0));authP.then(()=>{const h=location.hash.slice(1);if(h==='profil'||h==='role')renderPage(h)});
/* ===== Pemuat modul (lazy) ===== */
const MV=(document.currentScript&&/[?&]v=([\w.-]+)/.exec(document.currentScript.src)||[])[1]||'0';
const MODS={tools:'/js/tools.js',pages:'/js/pages.js',chat:'/js/chat.js',dev:'/js/dev.js'},MODP={};
const PAGE_MOD={riwayat:'pages',changelog:'pages',role:'pages',feedback:'pages',stats:'pages',info:'pages',profil:'pages',chat:'chat',owner:'dev'};
const PAGES={};let RT=0;
function loadMod(n){return MODP[n]||(MODP[n]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=MODS[n]+'?v='+MV;s.onload=()=>ok();s.onerror=()=>{delete MODP[n];s.remove();no(new Error('Modul '+n+' gagal dimuat'))};document.head.appendChild(s)}))}
const modFail=()=>'<section class="panel"><div class="in"><p class="msg bad" role="status">Halaman gagal dimuat. Periksa koneksi internet.</p><div class="row"><button class="primary" type="button" data-mretry>Coba lagi</button></div></div></section>';
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-mretry]'))route()});
/* Unduh diam-diam saat browser menganggur, supaya ketukan berikutnya terasa instan tanpa memberatkan pembukaan beranda. */
function idleLoad(){const c=navigator.connection||{};if(c.saveData||/^(slow-2g|2g)$/.test(c.effectiveType||''))return;
 const go=()=>{['tools','pages','chat'].forEach((n,i)=>setTimeout(()=>loadMod(n).catch(()=>{}),i*400))};
 (window.requestIdleCallback||setTimeout)(go,{timeout:6000})}
addEventListener('load',idleLoad);
async function renderPage(id){const rt=++RT;if(!PAGES[id]){dock.hidden=true;main.innerHTML='<p class="msg" role="status">Memuat…</p>';try{await loadMod(PAGE_MOD[id])}catch(e){if(rt===RT)main.innerHTML=modFail();return}if(rt!==RT)return}const p=PAGES[id];dock.hidden=true;main.style.setProperty('--tc',PGC[id]||'#4fd69a');$(document,'#logo').innerHTML=svg(IC.back);main.classList.toggle('chatp',id==='chat');main.innerHTML=p.html();p.init&&p.init(main);document.title=p.title+' – Malik Tools';scrollTo(0,0)}
const DCATS=CATS.map(c=>[c.k,c.n]);
const drw=$(document,'#drw'),scrim=$(document,'#scrim'),mn=$(document,'#mn');
let dq='',dopen=new Set(['tools']);
const PGC={chat:'#4fd69a',role:'#ffc83d',changelog:'#4fd69a',feedback:'#4fd69a',stats:'#4fd69a',info:'#4fd69a',riwayat:'#4fd69a',profil:'#4fd69a'},DCOL=Object.fromEntries(CATS.map(c=>[c.k,c.c]));
drw.innerHTML=`<div class="dp" id="dprof"></div><a class="dl" id="dhome" href="#"><span class="ic">${svg(IC.home)}</span>Beranda</a><div class="dh"><span>Halaman</span></div>${[['chat','Global Chat'],['role','Beli Koin'],['changelog','Changelog'],['feedback','Feedback'],['stats','Stats'],['info','Info'],['riwayat','Riwayat'],['profil','Profil']].map(x=>`<a class="dl" href="#${x[0]}" data-pg="${x[0]}" style="--c:${PGC[x[0]]}"><span class="ic">${svg(IC[x[0]])}</span>${x[1]}</a>`).join('')}<a class="dl" id="downer" href="#owner" data-pg="owner" style="display:none;--c:#ffc83d"><span class="ic">${svg(IC.owner)}</span>Developer<span class="tg2" style="margin-left:auto">ADMIN</span></a><div class="dh"><span>Komunitas</span></div>${[['https://whatsapp.com/channel/0029VbEOTvX6GcGLFkDqfv22','Saluran','#25d366','<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 9a4 4 0 010 6M18 6.5a8 8 0 010 11"/>'],[`https://wa.me/${CONTACT_WA}`,'Chat Developer','#5cd0d8','<path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>']].map(x=>`<a class="dl" href="${x[0]}" target="_blank" rel="noopener noreferrer" style="--c:${x[2]}"><span class="ic">${svg(x[3])}</span>${x[1]}<span class="ext" aria-hidden="true">↗</span></a>`).join('')}<div class="dh"><span>Informasi</span></div>${[['/tentang','Tentang','<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'],['/privasi','Privasi','<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>'],['/syarat','Syarat','<path d="M7 3h8l4 4v14H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'],['/bantuan','Bantuan','<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>']].map(x=>`<a class="dl" href="${x[0]}" style="--c:#8f9aff"><span class="ic">${svg(x[2])}</span>${x[1]}</a>`).join('')}<div class="dh"><span>Kategori</span><button type="button" id="dall"></button></div><div class="sr">${svg(IC.search)}<input id="dq" type="search" placeholder="Cari tool..." autocomplete="off" aria-label="Cari tool"></div><div id="dlist"></div><div class="dfoot"><b>Malik Tools</b><span>Gratis, cepat, tanpa ribet<br>Dibuat oleh Malik</span></div>`;
const DI=Object.fromEntries(CATS.map(c=>[c.k,c.i])),DD=Object.fromEntries(CATS.map(c=>[c.k,c.d]));
const dLbl=()=>{$(drw,'#dall').textContent=dopen.size===DCATS.length?'Tutup semua':'Buka semua'};
const hl=(t,q)=>{t=esc(t);if(!q||/[&<>"']/.test(q))return t;const i=t.toLowerCase().indexOf(q);return i<0?t:t.slice(0,i)+'<mark>'+t.slice(i,i+q.length)+'</mark>'+t.slice(i+q.length)};
function dList(){const cur=location.hash.slice(1),q=dq.trim().toLowerCase();
 {const u=AUTH.user,nm=pName()||'Tamu',ph=pPic(),rl=u?roleB(u.isOwner?'developer':u.role):null;
  $(drw,'#dprof').innerHTML=`<span class="av">${ph?`<img src="${esc(ph)}" alt="" referrerpolicy="no-referrer">`:esc(nm.charAt(0).toUpperCase())}</span><div class="g"><b>${esc(nm)}${u?vchk(u.isOwner?'developer':u.role):''}</b>${u?`<span class="tg2 ${rl[1]}">${rl[0]}</span>${cbadge(u.badge)}`:'<small>Belum masuk</small>'}</div>${u?'<button type="button" id="dout" aria-label="Keluar">Keluar</button>':''}`}
 const ow=AUTH.user&&AUTH.user.isOwner;$(drw,'#downer').style.display=ow?'':'none';const hp=$(document,'.top .pill');if(hp){if(ow){hp.textContent='Developer';hp.classList.toggle('dev',true);hp.title='Mode Developer'}else{hp.classList.toggle('dev',false);mtPill()}}
 $(drw,'#dhome').toggleAttribute('aria-current',!cur);drw.querySelectorAll('[data-pg]').forEach(a=>a.dataset.pg===cur?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));if(!cur)$(drw,'#dhome').setAttribute('aria-current','page');
 dLbl();$(drw,'#dall').style.visibility=q?'hidden':'';
 const out=DCATS.map(([k,n])=>{const tot=tools.filter(t=>catOf(t)===k),ts=tot.filter(t=>!q||(t.name+' '+META[t.id].lead).toLowerCase().includes(q));if(!ts.length&&(q||tot.length))return'';const op=!!tot.length&&(!!q||dopen.has(k));
  return `<section class="cg${op?' on':''}" style="--tc:${DCOL[k]}"><button type="button" class="cat" data-k="${k}" aria-expanded="${op}"><span class="ci">${svg(DI[k])}</span><span class="ct"><b>${n}</b><small>${DD[k]}</small></span><em>${tot.length?(q?ts.length+'/':'')+tot.length:'Segera'}</em>${svg(IC.chev)}</button><div class="sub2"><div>${ts.map(t=>`<a class="dl" href="#${t.id}" style="--c:${META[t.id].c}"${cur===t.id?' aria-current="page"':''}><span class="ic">${svg(IC[t.id])}</span><span class="tx"><b>${hl(t.name,q)}</b><small>${esc(META[t.id].lead)}</small></span></a>`).join('')}</div></div></section>`}).join('');
 $(drw,'#dlist').innerHTML=out||'<div class="emp">Tidak ada tool yang cocok<small>Coba kata kunci lain</small></div>'}
function setDrawer(on){
 if(on){root.style.setProperty('--hh',$(document,'.top').getBoundingClientRect().bottom+'px');dList()}
 drw.classList.toggle('on',on);if(on){drw.classList.add('anim');clearTimeout(setDrawer.t);setDrawer.t=setTimeout(()=>drw.classList.remove('anim'),900);drw.querySelectorAll('.dp,.st,.dl,.dh,.sr,.cg').forEach((e,i)=>e.style.setProperty('--i',Math.min(i,14)))}scrim.classList.toggle('on',on);
 mn.setAttribute('aria-expanded',on);mn.setAttribute('aria-label',on?'Tutup menu':'Buka menu');mn.innerHTML=svg(on?IC.close:IC.menu);
 document.documentElement.style.overflow=on?'hidden':''}
mn.innerHTML=svg(IC.menu);
mn.onclick=()=>setDrawer(!drw.classList.contains('on'));
scrim.onclick=()=>setDrawer(false);
addEventListener('keydown',e=>{if(e.key==='Escape'&&drw.classList.contains('on')){setDrawer(false);mn.focus()}});
drw.addEventListener('click',e=>{
 if(e.target.id==='dout'){authLogout().then(()=>location.reload());return}
 if(e.target.closest('a')){setDrawer(false);return}
 const c=e.target.closest('.cat');if(c){const k=c.dataset.k,o=!dopen.has(k);o?dopen.add(k):dopen.delete(k);c.parentNode.classList.toggle('on',o);c.setAttribute('aria-expanded',o);dLbl();return}
 if(e.target.id==='dall'){dopen=dopen.size===DCATS.length?new Set():new Set(DCATS.map(x=>x[0]));dList()}});
$(drw,'#dq').oninput=e=>{dq=e.target.value;dList()};
const TIPS=['Ketuk ☆ di tool untuk menyimpannya ke favorit.','Foto besar dikecilkan otomatis sebelum diunggah.','Ngobrol bareng di Global Chat lewat menu samping.','Hasil tool bisa disalin sekali ketuk.','Ganti tema terang/gelap lewat tombol matahari di atas.'];
function welcomeHtml(){const u=AUTH.user,h=new Date().getHours(),g=h<4?'Selamat malam':h<11?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam',n=pName()||'Tamu',st=ls.get('mt_stats')||{},vs=Object.values(st),ok=vs.reduce((a,x)=>a+x.ok,0),all=ok+vs.reduce((a,x)=>a+x.err,0),fv=(ls.get('mt_fav')||[]).length,d=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'}),tip=TIPS[Math.floor(Date.now()/864e5)%TIPS.length];
 const nm=esc(n.split(' ')[0]);
 const ini=esc((n.trim()[0]||'T').toUpperCase()),emo=h<4?'🌙':h<11?'☀️':h<15?'🌤️':h<18?'🌇':'🌙';
 const stat=(v,l,c)=>`<div class="hst" style="--c:${c}"><b>${nf(v)}</b><small>${l}</small></div>`;
 const qa=(href,ic,l,c)=>`<a class="lhq" href="#${href}" style="--c:${c}"><span>${svg(IC[ic])}</span><b>${l}</b></a>`;
 return `<section class="lh" aria-label="Sambutan"><div class="lhc"><div class="lht"><div><small>${esc(d)}</small><h2>${g},<span class="lhe" aria-hidden="true"> ${emo}</span><b>${nm}</b></h2></div><span class="lha" aria-hidden="true">${emo}</span></div><p class="lhtip"><span class="lhtag">TIPS</span><span class="lhtxt">${esc(tip)}</span></p></div><label class="lhs" id="lhs2" for="hq">${svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input id="hq" type="search" autocomplete="off" enterkeyhint="search" placeholder="Cari tool..." aria-label="Cari tool"></label>${u&&!u.isOwner?'<a class="cbal chm" id="hcb" href="#role" aria-label="Saldo koin, ketuk untuk beli koin"><small>SALDO KOIN</small><b id="hcv">...</b></a>':''}<div class="lhg">${qa('chat','chat','Global Chat',PGC.chat)}${qa('role','role','Beli Koin',PGC.role)}${qa('stats','stats','Stats',PGC.stats)}${qa('profil','profil','Profil',PGC.profil)}</div><div class="lhi"><span style="--c:#4fd69a"><b>${nf(all)}</b>dipakai</span><span style="--c:#4fd69a"><b>${nf(ok)}</b>berhasil</span><span style="--c:#4fd69a"><b>${nf(fv)}</b>favorit</span><button type="button" id="hgo">Semua tool &darr;</button></div><section class="lhab" aria-label="Tentang Malik Tools"><h3>Apa itu Malik Tools?</h3><p>Kumpulan tool online dalam satu tempat: downloader, maker, Spotify, GetContact, dan utilitas lainnya. Langsung dipakai dari HP, tanpa instal aplikasi.</p><div class="lhabc"><span>Gratis</span><span>Cepat</span><span>Tanpa ribet</span></div></section></section>`}
function countUp(r){r.querySelectorAll('[data-n]').forEach(e=>{const n=+e.dataset.n;if(!n||matchMedia('(prefers-reduced-motion: reduce)').matches){e.textContent=nf(n);return}const t0=performance.now();(function f(t){const k=Math.min(1,(t-t0)/700);e.textContent=nf(Math.round(n*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(f)})(t0)})}
function stepify(r){r.querySelectorAll('label').forEach(l=>{const m=l.textContent.match(/^\s*(\d)\s*[·.]\s*(.+)$/);if(m&&!l.children.length){l.classList.add('hs');l.innerHTML=`<span class="sn">${m[1]}</span>`;l.append(m[2])}})}
/* Share Target PWA: link yang dibagikan dari aplikasi lain dibuka di tool yang cocok dan kolom link terisi otomatis */
(function(){try{const q=new URLSearchParams(location.search),raw=(q.get('url')||'')+' '+(q.get('text')||''),m=raw.match(/https?:\/\/[^\s]+/);if(!m||!(q.has('url')||q.has('text')))return;
 const link=m[0],h=(()=>{try{return new URL(link).hostname.replace(/^www\.|^m\./,'')}catch(e){return ''}})(),MAP=[[/(^|\.)(tiktok\.com)$/,'tiktok-dl'],[/(^|\.)instagram\.com$/,'ig-dl'],[/(^|\.)(youtube\.com|youtu\.be)$/,'youtube-dl'],[/(^|\.)mediafire\.com$/,'mediafire-dl'],[/(^|\.)(dailymotion\.com|dai\.ly)$/,'dailymotion-dl'],[/(^|\.)soundcloud\.com$/,'soundcloud-dl']],hit=MAP.find(x=>x[0].test(h)),id=hit&&tools.some(t=>t.id===hit[1])?hit[1]:'';
 history.replaceState(null,'','/'+(id?'#'+id:''));if(!id)return;
 const ob=new MutationObserver(()=>{const e=document.getElementById('e');if(e&&!e.value){e.value=link;e.dispatchEvent(new Event('input',{bubbles:true}));ob.disconnect()}});ob.observe(main,{childList:true,subtree:true});setTimeout(()=>ob.disconnect(),8000)}catch(e){}})();
async function histLoad(r){const u=AUTH.user;if(!u||u.isOwner||!PAYON)return;try{const j=await fetch('/api/pay?action=history',{credentials:'same-origin'}).then(x=>x.json());if(!j.ok||!j.list||!j.list.length)return;
 const st={done:'Berhasil',paid:'Diproses',refused:'Perlu bantuan',expired:'Kedaluwarsa'};
 const box=document.createElement('section');box.className='rhist';box.setAttribute('aria-label','Riwayat pembelian');
 box.innerHTML='<h3 class="sech">Riwayat pembelian</h3>'+j.list.map(o=>`<p class="note" style="margin:6px 0"><b>${o.coins?esc(Number(o.coins).toLocaleString('id-ID'))+' koin':esc(String(o.role||'').toUpperCase())}</b>${!o.coins&&o.days?' '+esc(dlbl(o.days)):''} &middot; ${rp(o.total||0)} &middot; ${esc(st[o.status]||o.status)} &middot; ${new Date(o.ts).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</p>`).join('')+'<p class="hint">Ada masalah dengan pembayaran? Hubungi developer dan sebutkan tanggalnya.</p>';
 const c=r.querySelector('.rcards');(c||r).after(box)}catch(e){}}
async function render(){const rt=++RT;
 main.classList.remove('chatp');const hid=location.hash.slice(1);if(PAGE_MOD[hid]){renderPage(hid);return}
 let t=tools.find(x=>x.id===location.hash.slice(1));
 if(t&&!t.html){dock.hidden=true;main.innerHTML='<p class="msg" role="status">Memuat…</p>';try{await loadMod('tools')}catch(e){if(rt===RT)main.innerHTML=modFail();return}if(rt!==RT)return;t=tools.find(x=>x.id===location.hash.slice(1))}
 if(!t){delete main.dataset.tool;dock.hidden=true;$(document,'#logo').innerHTML=LOGO_HTML;document.title='Malik Tools';
  hq='';main.innerHTML=`${welcomeHtml()}${annHtml()}<div id="hot"></div><div class="nxl" id="bn" role="list" aria-label="Kategori tool"></div><div class="live" id="live" hidden></div><p class="foot">Dibuat oleh Malik</p><nav class="foot2" aria-label="Informasi"><a href="/tentang">Tentang</a><a href="/privasi">Privasi</a><a href="/syarat">Syarat</a><a href="/bantuan">Bantuan</a></nav>`;liveDraw();
  const draw=()=>{const fv=ls.get('mt_fav')||[],chev=svg('<path d="M6 9l6 6 6-6"/>'),go=svg('<path d="M9 6l6 6-6 6"/>');
   const star=svg('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>');
   const row=x=>{const m=META[x.id],f=fv.includes(x.id),nt=(m.note||'GRATIS'),kr=/koin/i.test(nt);return `<a class="tr" role="listitem" href="#${x.id}" style="--tc:${m.c}"><span class="tri" aria-hidden="true">${svg(IC[x.id]||IC.go)}</span><span class="trb"><span class="trh"><b>${esc(x.name)}${isNew(x.id)?'<span class="nwb">BARU</span>':''}</b><span class="trn${kr?' k':''}">${esc(nt.toLowerCase())}</span></span><span class="trd">${esc(m.lead)}</span></span><span class="trf${f?' on':''}" data-fav="${x.id}" role="button" aria-label="Favorit ${esc(x.name)}" aria-pressed="${f}">${star}</span><span class="trg" aria-hidden="true">${go}</span></a>`};
   const srt=l=>l.slice().sort((p,q)=>fv.includes(q.id)-fv.includes(p.id)),G=CATS.map(c=>[c.k,c.n.toUpperCase(),c.c,c.i,srt(tools.filter(x=>catOf(x)===c.k))]);
   $(main,'#bn').className='nxl'+(nxFirst?' in':'');
   {const qq=hq.trim().toLowerCase();{const hh=$(main,'#hot');if(hh)hh.innerHTML=qq?'':hotHtml()}if(qq){const ms=tools.filter(x=>(x.name+' '+META[x.id].lead+' '+META[x.id].tab).toLowerCase().includes(qq));$(main,'#bn').className='nxl in';$(main,'#bn').innerHTML=ms.length?`<section class="nxg open" role="listitem" style="--tc:#9aa;--i:0"><div class="nxb"><div class="nxin">${ms.map(row).join('')}</div></div></section>`:`<div class="es" role="status">${svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8.5 11h5"/>')}<b>Tool tidak ditemukan</b><span>Coba kata lain, misalnya "QR", "gambar", atau "suara".</span></div>`;return}}
   $(main,'#bn').innerHTML=G.map((g,i)=>{const k=g[0],n=g[4].length,o=n>0&&nxo.has(k);
    return `<section class="nxg${o?' open':''}" role="listitem" style="--tc:${g[2]};--i:${i}"><button type="button" class="nxh" data-g="${k}"${n?'':' disabled'} aria-expanded="${o}" aria-controls="nx-${k}"><span class="nxi">${svg(g[3])}</span><span class="nxt"><b>${g[1]}</b><small>${n?n+' tool':'Segera hadir'}</small></span><span class="nxc" aria-hidden="true"${n?'':' style="visibility:hidden"'}>${chev}</span></button><div class="nxb" id="nx-${k}"><div class="nxin">${g[4].map(row).join('')}</div></div></section>`}).join('');nxFirst=false};
  {const hv=$(main,'#hcv');if(hv)crLoad().then(c=>{const e=$(main,'#hcv');if(e)e.textContent=c?(c.unlimited?'Tak terbatas':Number(c.left||0).toLocaleString('id-ID')+' koin'):'-'})}
  const hg=$(main,'#hgo');if(hg)hg.onclick=()=>{const b=$(main,'#bn');if(b)b.scrollIntoView({behavior:'smooth',block:'start'})};
  const ap=$(main,'.apo');if(ap){ap.querySelector('.x').onclick=()=>{try{sessionStorage.setItem('mt_ann',String(ANN.ts))}catch(e){}ap.remove()};ap.querySelector('img').onclick=e=>{const d=document.createElement('div');d.className='lbx';d.innerHTML=`<img src="${esc(e.target.src)}" alt="Poster">${unduhBtn(e.target.src,'poster.jpg','Unduh Foto')}`;d.onclick=ev=>{if(!(ev.target.closest&&ev.target.closest('.unb')))d.remove()};document.body.appendChild(d)}}
  annToast();
  {const hqi=$(main,'#hq');if(hqi)hqi.oninput=()=>{hq=hqi.value;draw()}}
  $(main,'#bn').onclick=ev=>{const f=ev.target.closest('[data-fav]');if(f){ev.preventDefault();const id=f.dataset.fav,l=ls.get('mt_fav')||[],i=l.indexOf(id);i>-1?l.splice(i,1):l.push(id);ls.set('mt_fav',l);draw();return}
   const h=ev.target.closest('.nxh');if(!h)return;const g=h.parentElement,k=h.dataset.g,o=!g.classList.contains('open');g.classList.toggle('open',o);h.setAttribute('aria-expanded',o);o?nxo.add(k):nxo.delete(k)};
  draw();
  countUp(main);scrollTo(0,0);return}
 const m=META[t.id];dock.hidden=true;$(document,'#logo').innerHTML=svg(IC.back);
 dock.querySelectorAll('a').forEach(a=>a.dataset.id===t.id?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
 main.dataset.tool=t.id;main.style.setProperty('--tc',ACC||m.c);bump(t.id);
 main.innerHTML=`<section class="panel"><div class="bar"><span>${esc(m.tab.toUpperCase())}</span>${m.note?`<span class="pill">${esc(m.note)}</span>`:''}</div><div class="in"><div class="thero"><span class="tile">${svg(IC[t.id])}</span><div><h2>${esc(t.name)}</h2><p class="sub">${esc(t.desc)}</p></div></div><div id="c">${isOff(t.id)?offH:t.html()}</div></div></section>`;
 if(!isOff(t.id)){t.init($(main,'#c'));stepify($(main,'#c'));try{xtras(t)}catch(e){}}document.title=t.name+' – Malik Tools';scrollTo(0,0)}

// ---- Tautan antar tool + riwayat input (disimpan di perangkat, bukan di server) ----
const FLD={'qr-code':'#t-text','ssweb':'#t-url','open-graph':'#e','cek-situs':'#e','tts-google':'#t-text'};
const CROSS={'ssweb':[['qr-code','Buat QR dari link ini'],['open-graph','Lihat metadata situs'],['cek-situs','Cek status situs']],
 'open-graph':[['ssweb','Screenshot situs ini'],['qr-code','Buat QR dari link ini'],['cek-situs','Cek status situs']],
 'cek-situs':[['ssweb','Screenshot situs ini'],['open-graph','Lihat metadata situs'],['qr-code','Buat QR dari link ini']]};
function xtras(t){const fid=FLD[t.id];if(!fid)return;const c=$(main,'#c'),res=c&&c.querySelector('#res');if(!res)return;
 const inputs=()=>[...c.querySelectorAll('input[id^="t-"],textarea[id^="t-"],select[id^="t-"],#e')].filter(el=>el.type!=='password');
 try{const p=JSON.parse(sessionStorage.getItem('mt_pre')||'null');if(p&&p.id===t.id){sessionStorage.removeItem('mt_pre');const el=c.querySelector(fid);if(el&&p.v){el.value=p.v}}}catch(e){}
 const box=document.createElement('div');box.className='xtr';res.after(box);
 const H=()=>{const a=ls.get('mt_hist')||{};return Array.isArray(a[t.id])?a[t.id]:[]},W=l=>{const a=ls.get('mt_hist')||{};a[t.id]=l;ls.set('mt_hist',a)};
 const lab=h=>{const v=h[fid.slice(1)]||Object.values(h)[0]||'';return String(v).replace(/^https?:\/\/(www\.)?/i,'').slice(0,34)||'(kosong)'};
 const draw=()=>{const done=!!res.children.length&&!res.querySelector('.sk'),hs=H(),ln=done?(CROSS[t.id]||[]):[];
  box.innerHTML=(ln.length?`<div class="xh">Lanjutkan dengan</div><div class="xc">${ln.map((l,i)=>`<button type="button" data-x="${i}">${esc(l[1])}</button>`).join('')}</div>`:'')
   +(hs.length?`<div class="xh">Riwayat terakhir <button type="button" class="xd" data-clr="1">Hapus</button></div><div class="xc">${hs.map((h,i)=>`<button type="button" data-h="${i}">${esc(lab(h))}</button>`).join('')}</div>`:'')};
 box.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.x!==undefined){const l=(CROSS[t.id]||[])[+b.dataset.x],src=c.querySelector(fid);if(!l)return;{let v=src?src.value.trim():'';if(v&&!/^https?:\/\//i.test(v))v='https://'+v;try{sessionStorage.setItem('mt_pre',JSON.stringify({id:l[0],v}))}catch(e){}}location.hash='#'+l[0];return}
  if(b.dataset.clr){W([]);draw();return}
  if(b.dataset.h!==undefined){const h=H()[+b.dataset.h];if(!h)return;inputs().forEach(el=>{if(h[el.id]!==undefined)el.value=h[el.id]});const f=c.querySelector(fid);if(f){f.scrollIntoView({block:'center',behavior:'smooth'});try{f.focus({preventScroll:true})}catch(e){}}}};
 let last='';
 const save=()=>{if(!res.children.length||res.querySelector('.sk'))return;const cur={};inputs().forEach(el=>{if(el.id)cur[el.id]=String(el.value).slice(0,300)});if(!Object.values(cur).some(Boolean))return;
  const key=JSON.stringify(cur);if(key===last)return;last=key;const hs=H().filter(h=>JSON.stringify(h)!==key);hs.unshift(cur);W(hs.slice(0,8))};
 new MutationObserver(()=>{save();draw()}).observe(res,{childList:true,subtree:true});draw()}

// ---- v201: langkah proses, kartu Cek Situs, Baru/Populer, aksen, PWA, tarik-segarkan, getar ----
const STEPS={'ssweb':['Membuka situs','Mengambil tangkapan layar','Merapikan hasil'],'qr-code':['Membaca teks','Membuat QR Code'],'tts-google':['Menyiapkan teks','Menyintesis suara','Mengemas audio'],'hapus-background':['Mengunggah foto','Memisahkan objek','Menyiapkan hasil'],'quote-card':['Membaca teks','Menata kartu kutipan','Merapikan hasil'],'duar-viral':['Mengunggah foto','Memisahkan objek','Menempel ke latar ledakan'],'hd-gambar':['Mengunggah foto','Menajamkan detail','Menyiapkan hasil'],'upscale':['Mengunggah foto','Menajamkan detail 2x','Menyiapkan hasil'],'swhd':['Mengunggah file','Menjernihkan detail','Menyiapkan hasil HD'],
'iqc-dark':['Membaca pesan','Menyusun kartu chat gelap','Merapikan hasil'],'igqc':['Membaca isian','Menyusun menu pesan','Merapikan hasil'],'fake-call':['Membaca nama dan durasi','Menyusun layar panggilan','Merapikan hasil'],'fake-channel':['Membaca info saluran','Menyusun halaman saluran','Merapikan hasil'],'brat-v1':['Membaca teks','Menyusun gaya Brat','Merapikan hasil'],'bratvid':['Membaca teks','Merender video Brat','Mengemas MP4'],'jarvis-meme':['Membaca teks','Menempel ke meme','Merapikan hasil'],'carbon':['Membaca kode','Memberi warna sintaks','Merender gambar'],
'tiktok-dl':['Membaca link TikTok','Mengambil video tanpa watermark','Menyiapkan unduhan'],'ig-dl':['Membaca link Instagram','Mengambil foto atau video','Menyiapkan unduhan'],'fb-dl':['Membaca link Facebook','Mengambil video','Menyiapkan unduhan'],'capcut-dl':['Membaca link CapCut','Mengambil template','Menyiapkan unduhan'],'youtube-dl':['Membaca link YouTube','Mengambil video dan audio','Menyiapkan unduhan'],'mediafire-dl':['Membaca link Mediafire','Mengambil link file','Menyiapkan unduhan'],'dailymotion-dl':['Membaca link Dailymotion','Mengambil pilihan kualitas','Menyiapkan unduhan'],'soundcloud-dl':['Membaca link SoundCloud','Mencari audio','Menyiapkan pemutar'],'spotify-play':['Mencari lagu','Mengambil audio','Menyiapkan pemutar'],
'rch':['Membaca link postingan','Mengirim reaksi','Menunggu konfirmasi'],'rch2':['Membaca link postingan','Mengirim reaksi lewat jalur V2','Menunggu konfirmasi'],'rch3':['Membaca link postingan','Mengirim reaksi lewat jalur V3','Menunggu konfirmasi'],'am-premium':['Menyiapkan permintaan','Menghubungi server Alight Motion','Menunggu konfirmasi'],'am-premium2':['Menyiapkan permintaan','Menghubungi jalur Amprem V5','Menunggu konfirmasi'],'am-find':['Membuka video TikTok','Memindai komentar dan balasan','Mengumpulkan link preset'],'am-data':['Membaca link share','Mengambil metadata proyek','Menyiapkan hasil'],'cek-situs':['Menghubungi situs','Mengukur waktu respons','Memeriksa SSL'],'open-graph':['Membuka halaman','Membaca metadata','Menyiapkan hasil'],'image-to-prompt':['Membaca gambar','Menganalisis isi','Menulis prompt'],'bypass-cf':['Membuka situs target','Menyelesaikan tantangan','Menyiapkan token'],'getcontact-start':['Menyiapkan verifikasi','Membuat link dan kode','Menyiapkan pesan']};
/* Tampilan loading menyesuaikan kategori: judul, langkah bawaan, ikon, dan bentuk placeholder (gambar, video, audio, data). */
const LDCAT={canvas:{t:'Meracik gambar',s:['Membaca isianmu','Menggambar di kanvas','Merapikan hasil']},dl:{t:'Mengambil media',s:['Membaca link','Mengambil dari sumber','Menyiapkan unduhan']},spotify:{t:'Mencari lagu',s:['Mencari lagu','Mengambil audio','Menyiapkan pemutar']},am:{t:'Mengaktifkan Alight Motion',s:['Menyiapkan permintaan','Menghubungi server','Menunggu konfirmasi']},tools:{t:'Memproses permintaan',s:['Mengirim permintaan','Memproses','Menyiapkan hasil']},util:{t:'Menghitung',s:['Membaca isian','Memproses','Menyiapkan hasil']}};
const LDVID=new Set(['bratvid','tiktok-dl','ig-dl','fb-dl','capcut-dl','youtube-dl','dailymotion-dl']),LDAUD=new Set(['tts-google','spotify-play','soundcloud-dl']),LDTXT=new Set(['cek-situs','open-graph','am-premium','am-premium2','am-find','am-data','rch','rch2','rch3','image-to-prompt','bypass-cf','getcontact-start','mediafire-dl']);
/* Subjudul loading hidup: langkah yang sedang jalan + detik berjalan, dan kabar bila prosesnya lama. Berhenti sendiri saat kotak loading hilang. */
let LDT=0;
function ldTick(){const els=document.querySelectorAll('.ldt small[data-s]');if(!els.length){clearInterval(LDT);LDT=0;return}
 els.forEach(el=>{const e=(Date.now()-(+el.dataset.s))/1000,st=el.dataset.st.split('|'),d=el.dataset.d.split(',').map(Number);let k=0;d.forEach((x,i)=>{if(e>=x)k=i});
  const sec=Math.floor(e)+' dtk',t=e<12?st[k]+' · '+sec:e<25?'Masih diproses, tunggu sebentar · '+sec:e<45?'Agak lama, server sedang sibuk · '+sec:'Hampir habis waktu. Kalau gagal, tekan Coba lagi · '+sec;
  if(el.textContent!==t)el.textContent=t})}
function skx(id,n){const cat=LDCAT[typeof CAT!=='undefined'&&CAT[id]]||{t:'Memproses permintaan',s:['Mengirim permintaan','Memproses','Menyiapkan hasil']},st=STEPS[id]||cat.s,dl=id==='ssweb'?[0,2.5,7]:[0,1.6,4.5];
 const kind=LDVID.has(id)?'vid':LDAUD.has(id)?'aud':LDTXT.has(id)?'txt':'img';
 const ic=typeof IC!=='undefined'&&IC[id]?svg(IC[id]):'';
 const ph=kind==='aud'?'<div class="sk sk-aud" aria-hidden="true">'+Array.from({length:28},(_,k)=>'<b style="--i:'+k+'"></b>').join('')+'</div>'
  :kind==='txt'?'<div class="sk sk-txt" aria-hidden="true"><b style="--w:46%"></b><b style="--w:92%"></b><b style="--w:78%"></b><b style="--w:60%"></b></div>'
  :'<div class="sk sk-'+kind+'" aria-hidden="true">'+(kind==='vid'?'<svg viewBox="0 0 24 24"><path d="M9 7l8 5-8 5z"/></svg>':'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/></svg>')+'</div>';
 if(!LDT)LDT=setInterval(ldTick,1000);
 return `<div class="out ld-${kind}"><div class="ldh"><span class="ldi" aria-hidden="true">${ic}</span><div class="ldt"><b>${esc(cat.t)}</b><small data-s="${Date.now()}" data-st="${esc(st.join('|'))}" data-d="${st.map((_,i)=>dl[i]!==undefined?dl[i]:i*3).join(',')}">${esc(st[0])}</small></div></div><div class="ldbar" aria-hidden="true"><i></i></div><ol class="mtprc" aria-live="polite">${st.map((x,i)=>`<li style="--d:${dl[i]!==undefined?dl[i]:i*3}s;--n:${i<st.length-1?(dl[i+1]!==undefined?dl[i+1]:(i+1)*3):999}s"><i></i>${esc(x)}</li>`).join('')}</ol><div class="cmp">${ph.repeat(kind==='img'?(n||1):1)}</div></div>`}
function siteCard(res,d){if(!d||typeof d!=='object'||!d.status)return false;
 const st=String(d.status),off=/^Offline/.test(st),ms=parseInt(d.waktu_respons,10)||0,code=+d.kode_http||0;
 const lv=off||code>=500?'bad':(code>=400||ms>=2500)?'warn':ms>=800?'mid':'ok',col={ok:'#4fd69a',mid:'#ffc83d',warn:'#ffc83d',bad:'#ff6b6b'}[lv];
 const lab=off?'Offline':code>=500?'Server bermasalah':code>=400?'Online, halaman bermasalah':ms>=2500?'Online, tapi lambat':'Online';
 const sub=off?(d.alasan||'Tidak bisa terhubung.'):'HTTP '+code+' · '+(d.waktu_respons||'-');
 const days=parseInt(d.ssl_sisa_hari,10),sslOk=/^Valid/.test(d.ssl||''),sc=!d.ssl?'':!sslOk&&/^Tidak valid/.test(d.ssl)?'bad':Number.isFinite(days)?(days<=7?'bad':days<=30?'warn':'ok'):(sslOk?'ok':'');
 const it=[];const add=(l,v,c,w)=>{if(v!==undefined&&v!==null&&String(v)!=='')it.push(`<div${w?' class="w"':''}><span>${l}</span><b${c?` class="${c}"`:''}>${esc(v)}</b></div>`)};
 if(!off){add('Kode HTTP',d.kode_http,code>=400?'warn':'ok');add('Waktu respons',d.waktu_respons,ms>=2500?'warn':'ok');add('SSL',d.ssl,sc);add('Sisa masa SSL',d.ssl_sisa_hari,sc);add('Berlaku hingga',d.ssl_berlaku_hingga);add('Penerbit SSL',d.ssl_penerbit);add('TLS',d.protokol_tls);add('Alamat IP',d.alamat_ip);add('Server',d.server);add('Jenis konten',d.jenis_konten);add('Redirect',d.redirect);add('URL akhir',d.url_akhir,'',true)}
 else add('Alamat',d.url,'',true);
 const txt='Cek situs: '+lab+' - '+sub+(d.ssl?' - SSL '+d.ssl:'');
 res.innerHTML=`<div class="out sitec"><div class="scs" style="--c:${col}"><span class="scd"></span><div><strong>${esc(lab)}</strong><small>${esc(sub)}</small></div></div>${off?'':`<div class="scbar" aria-hidden="true"><i style="width:${Math.max(6,Math.min(100,Math.round(ms/30)))}%;background:${col}"></i></div>`}<div class="scg">${it.join('')}</div><div class="row"><button type="button" id="scc">Salin ringkasan</button></div></div>`;
 const b=res.querySelector('#scc');if(b)b.onclick=x=>copy(txt,x.target);return true}
const NEWT={'angka-romawi':'2026-11-22','kalkulator-tabungan':'2026-11-22','generator-uuid':'2026-11-22','stopwatch':'2026-11-22','bandingkan-teks':'2026-11-22','cek-kontras':'2026-11-22','filter-foto':'2026-11-22','kolase-foto':'2026-11-22','kalkulator-persen':'2026-11-22','konversi-huruf':'2026-11-22','timer-pomodoro':'2026-11-22','gradient-maker':'2026-11-22','putar-foto':'2026-11-22','meme-maker':'2026-11-21','sticker-wa':'2026-11-21','watermark-foto':'2026-11-21','avatar-bulat':'2026-11-21','story-teks':'2026-11-21','rch2':'2026-11-21','rch3':'2026-11-21','rch':'2026-11-19','qr-code':'2026-11-19','ssweb':'2026-11-19','tts-google':'2026-11-19','open-graph':'2026-11-19','cek-situs':'2026-11-19','konversi-gambar':'2026-11-19','kompres-gambar':'2026-11-21','kalkulator-cicilan':'2026-11-21','generator-password':'2026-11-21','pengubah-satuan':'2026-11-21','hitung-kata':'2026-11-21','kalkulator-zakat':'2026-11-21','tanda-tangan':'2026-11-21','kalkulator-umur':'2026-11-21','kalkulator-diskon':'2026-11-21','kalkulator-bmi':'2026-11-21','split-bill':'2026-11-21','nomor-acak':'2026-11-21','daftar-tugas':'2026-11-21','kode-warna':'2026-11-21','hitung-hari':'2026-11-21','pembersih-teks':'2026-11-21','kalkulator-kalori':'2026-11-21','json-formatter':'2026-11-21','encode-decode':'2026-11-21','generator-hash':'2026-11-21','konversi-timestamp':'2026-11-21','angka-terbilang':'2026-11-21'};
const isNew=id=>NEWT[id]&&(Date.now()-Date.parse(NEWT[id]))<14*864e5;
function bump(id){const u=ls.get('mt_use')||{};u[id]=(u[id]||0)+1;ls.set('mt_use',u);ls.set('mt_recent',[id,...(ls.get('mt_recent')||[]).filter(x=>x!==id)].slice(0,8))}
function hotHtml(){const by=id=>tools.find(x=>x.id===id),card=(x,i,a,bd)=>{const m=META[x.id];return `<a class="hc" href="#${x.id}" style="--tc:${m.c}"><span class="tri" aria-hidden="true">${svg(IC[x.id]||IC.go)}</span><b>${esc(x.name)}${bd&&isNew(x.id)?'<span class="nwb">BARU</span>':''}</b><small>${esc(m.lead)}</small></a>`};
 const fv=(ls.get('mt_fav')||[]).map(by).filter(Boolean).slice(0,4),rc=(ls.get('mt_recent')||[]).map(by).filter(x=>x&&!fv.includes(x)).slice(0,4),nw=tools.filter(x=>isNew(x.id)).slice(0,4),use=ls.get('mt_use')||{},pp=Object.entries(use).filter(e=>by(e[0])).sort((a,b)=>b[1]-a[1]).map(e=>by(e[0])).filter(x=>!nw.includes(x)&&!fv.includes(x)&&!rc.includes(x)).slice(0,4);
 const out=[];if(fv.length)out.push(`<section><div class="hh">Favorit</div><div class="hr">${fv.map(x=>card(x)).join('')}</div></section>`);if(rc.length)out.push(`<section><div class="hh">Terakhir dipakai</div><div class="hr">${rc.map(x=>card(x)).join('')}</div></section>`);if(nw.length)out.push(`<section><div class="hh">Baru</div><div class="hr">${nw.map(card).join('')}</div></section>`);
 if(pp.length)out.push(`<section><div class="hh">Paling sering kamu pakai</div><div class="hr">${pp.map((x,i,a)=>card(x,i,a,true)).join('')}</div></section>`);return out.join('')}

/* ===== Riwayat hasil (foto dan video), disimpan di perangkat lewat IndexedDB ===== */
const RH=(()=>{const N=60,MAXB=8*1048576;let dbp=null,q=0;
 const open=()=>dbp||(dbp=new Promise((ok,no)=>{try{const r=indexedDB.open('mt_riwayat',1);r.onupgradeneeded=()=>r.result.createObjectStore('r',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}}));
 const tx=async(m,f)=>{const d=await open();return new Promise((ok,no)=>{const t=d.transaction('r',m),r=f(t.objectStore('r'));t.oncomplete=()=>ok(r&&r.result);t.onerror=t.onabort=()=>no(t.error)})};
 const list=()=>tx('readonly',s=>s.getAll()).then(a=>(a||[]).sort((x,y)=>y.ts-x.ts)).catch(()=>[]);
 const del=id=>tx('readwrite',s=>s.delete(id)).catch(()=>{});
 const clear=()=>tx('readwrite',s=>s.clear()).catch(()=>{});
 const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)};
 const toBlob=async u=>{if(/^data:/i.test(u)){const i=u.indexOf(','),h=u.slice(5,i),mt=h.split(';')[0]||'application/octet-stream';if(!/;base64/i.test(h))return new Blob([decodeURIComponent(u.slice(i+1))],{type:mt});const b=atob(u.slice(i+1)),a=new Uint8Array(b.length);for(let k=0;k<b.length;k++)a[k]=b.charCodeAt(k);return new Blob([a],{type:mt})}return await(await fetch(u)).blob()};
 async function add(o){try{const e={tool:o.tool,name:o.name,kind:o.kind,ts:Date.now()};
  if(/^(data|blob):/i.test(o.url)){const b=await toBlob(o.url);if(!b||!b.size||b.size>MAXB)return;e.blob=b;e.id=o.tool+'|b'+hash(o.name+':'+b.size+':'+b.type)}
  else if(/^https?:/i.test(o.url)){e.url=o.url;e.id=o.tool+'|u'+hash(o.url)}else return;
  await tx('readwrite',s=>s.put(e));const a=await list();for(const x of a.slice(N))await del(x.id)}catch(x){}}
 const kindOf=(u,n)=>mediaKind('',u)||(VIDX.test(n)?'video':IMGX.test(n)?'image':'');
 function scan(){q=0;const t=main.dataset.tool;if(!t||location.hash.slice(1)!==t)return;
  main.querySelectorAll('[data-unduh]:not([data-rh])').forEach(b=>{b.setAttribute('data-rh','1');const u=b.getAttribute('data-unduh')||'',n=b.getAttribute('data-n')||'',k=kindOf(u,n);if(k==='image'||k==='video')add({tool:t,name:n||t,kind:k,url:u})});
  main.querySelectorAll('.out .bax .al img:not([data-rh]),.out .cmp figure:last-child img:not([data-rh])').forEach(im=>{const u=im.currentSrc||im.getAttribute('src')||'';if(!u)return;im.setAttribute('data-rh','1');add({tool:t,name:'hasil-'+t+'.png',kind:'image',url:u})})}
 new MutationObserver(()=>{if(!q)q=setTimeout(scan,500)}).observe(main,{childList:true,subtree:true});
 return{list,del,clear,add}})();
// v298: pengunjung online (anonim, tanpa akun)
let LIVE=null,liveT=0,liveShown=0,liveInit=false;const liveSeen=new Set();let LIVEH=[];try{LIVEH=JSON.parse(sessionStorage.getItem('mt_lvh')||'[]').filter(x=>Number.isFinite(x)).slice(-24)}catch(e){}
function livePid(){let v=ls.get('mt_pid');if(!v||typeof v!=='string'||v.length<8){v=Array.from(crypto.getRandomValues(new Uint8Array(9)),b=>(b%36).toString(36)).join('')+Date.now().toString(36);ls.set('mt_pid',v)}return v}
function liveAgo(s){return s<6?'baru saja':s<60?s+' dtk lalu':Math.floor(s/60)+' mnt lalu'}
function liveCount(el,to){const from=liveShown;liveShown=to;if(from===to||matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=to;return}
 const t0=performance.now(),d=Math.min(900,300+Math.abs(to-from)*40),st=n=>{const k=Math.min(1,(n-t0)/d);el.textContent=Math.round(from+(to-from)*(1-Math.pow(1-k,3)));if(k<1&&el.isConnected)requestAnimationFrame(st)};requestAnimationFrame(st)}
function liveDraw(){const el=document.getElementById('live');if(!el)return;
 if(!LIVE||!LIVE.ok){el.hidden=true;return}
 const nm=id=>{const t=tools.find(x=>x.id===id);return t?t.name:''},now=Date.now();
 const COL=['#4fd69a','#ffc83d','#ff8fb8','#5cd0d8','#ff9a4d','#8f9aff','#ff7a7a'],P='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/></svg>';
 const n=LIVE.online,sh=Math.min(n,8),av=Array.from({length:sh},(_,k)=>`<i style="--k:${k};background:${COL[k%COL.length]}">${P}</i>`).join('')+(n>sh?`<em>+${n-sh}</em>`:'');
 const H=LIVEH.slice(-24),dlt=H.length>1?n-H[H.length-2]:0,pk=Math.max(1,LIVE.peak||n),pct=Math.min(100,Math.round(n/pk*100)),stt=n>1&&n>=pk?['rekor','Rekor hari ini']:pct>=70?['ramai','Ramai']:pct>=35?['normal','Normal']:['tenang','Tenang'],first=!liveInit;liveInit=true;
 let spark='';if(H.length>=3){const lo=Math.min(...H),hi=Math.max(...H,lo+2),X=i=>(i/(H.length-1)*200).toFixed(1),Y=v=>(44-(v-lo)/(hi-lo)*38).toFixed(1),pts=H.map((v,i)=>X(i)+' '+Y(v));spark=`<div class="lvg" aria-hidden="true"><svg viewBox="0 0 200 48" preserveAspectRatio="none"><path class="a" d="M${pts.join(' L')} L200 48 L0 48 Z"/><path class="l" d="M${pts.join(' L')}"/></svg><i class="lvq" style="top:${(Y(H[H.length-1])/48*100).toFixed(1)}%"></i></div>`}
 const fd=(LIVE.feed||[]).map(e=>({id:e[0],at:now-e[1]*1000,n:nm(e[0])})).filter(e=>e.n);
 const rows=fd.map(e=>{const k=e.id+'|'+Math.round(e.at/1000),isn=!liveSeen.has(k);liveSeen.add(k);const m=META[e.id]||{c:'#4fd69a'};
  return `<div class="lvi${isn&&liveSeen.size>fd.length?' new':''}" style="--tc:${m.c}"><span class="tri" aria-hidden="true">${svg(IC[e.id]||IC.go)}</span><div><b>${esc(e.n)}</b><small data-at="${e.at}">${liveAgo(Math.round((now-e.at)/1000))}</small></div></div>`}).join('');
 el.hidden=false;
 const W='M0 24 H34 L40 24 L46 8 L54 40 L61 16 L66 24 H108 L114 24 L120 12 L127 34 L132 24 H200';
 const nf=v=>Number(v||0).toLocaleString('id-ID');
 const tl=(LIVE.tools||[]).map(e=>[nm(e[0]),e[1]]).filter(e=>e[0]),mx=Math.max(1,...tl.map(e=>e[1]));
 const bars=tl.length?`<div class="lvs"><small>Paling ramai sekarang</small><div class="lvr">${tl.map(e=>`<div><span>${esc(e[0])}</span><em>${e[1]}</em><i style="--w:${Math.max(14,Math.round(e[1]/mx*100))}%"></i></div>`).join('')}</div></div>`:'';
 const kp=`<div class="lvk"><div><b>${nf(LIVE.uv)}</b><span>Pengunjung<br>hari ini</span></div><div><b>${nf(LIVE.opens)}</b><span>Tool dibuka<br>hari ini</span></div><div><b>${nf(LIVE.peak)}</b><span>Puncak<br>online</span></div></div>`;
 el.innerHTML=`<div class="lvin${first?' in0':''}"><div class="lvh"><span class="lvp"><i class="lvd"></i>LIVE</span><b class="lvm" data-s="${stt[0]}">${stt[1]}</b></div><div class="lvb"><div class="lvn" id="lvn">${liveShown||n}</div><div class="lvt">orang online<br>sekarang${dlt?`<em class="lvdl ${dlt>0?'up':'dn'}">${dlt>0?'▲':'▼'} ${Math.abs(dlt)}</em>`:''}<small>di Malik Tools</small></div>${spark||`<svg class="lvw" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true"><path class="g" d="${W}"/><path d="${W}"/></svg>`}</div><div class="lva" aria-hidden="true">${av}</div><div class="lvmt"><span>Keramaian vs puncak hari ini</span><em>${pct}%</em><i style="--w:${pct}%"></i></div>${kp}${bars}<div class="lvf"><small>Baru saja dibuka</small>${rows||'<p class="lve">Belum ada aktivitas. Buka satu tool, nanti muncul di sini.</p>'}</div><p class="lvx">Anonim: tanpa nama, tanpa akun. Diperbarui otomatis.</p></div>`;
 liveCount(el.querySelector('#lvn'),n)}
async function livePing(ev){if(document.hidden)return;if(ev!==true&&Date.now()-liveT<12000)return;liveT=Date.now();
 const h=location.hash.slice(1),t=tools.some(x=>x.id===h)?h:'';
 try{const r=await fetch('/api/presence?id='+encodeURIComponent(livePid())+(t?'&t='+encodeURIComponent(t):'')+(t&&ev===true?'&ev=1':''),{cache:'no-store'});LIVE=await r.json();if(LIVE&&LIVE.ok){LIVEH.push(LIVE.online);LIVEH=LIVEH.slice(-24);try{sessionStorage.setItem('mt_lvh',JSON.stringify(LIVEH))}catch(e){}}}catch(e){LIVE=null}
 liveDraw()}
setInterval(()=>livePing(),15000);addEventListener('hashchange',()=>setTimeout(()=>livePing(tools.some(x=>x.id===location.hash.slice(1))),400));document.addEventListener('visibilitychange',()=>{if(!document.hidden)livePing()});setTimeout(()=>livePing(),1500);
setInterval(()=>{document.querySelectorAll('#live [data-at]').forEach(e=>{e.textContent=liveAgo(Math.max(0,Math.round((Date.now()-Number(e.dataset.at))/1000)))})},1000);
let ACC='';
const vib=p=>{try{if(navigator.vibrate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate(p)}catch(e){}};
let dpr=null;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
 isStd=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,
 pwaCan=()=>!isStd()&&(!!dpr||isIOS);
const PWA_IMG='/icon-192.png?v=332';
function pwaSheet(){if(document.getElementById('pws'))return;const d=document.createElement('div');d.id='pws';d.className='pws';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Cara pasang ke layar utama');
 const shr='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>',pls='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',ok='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
 const steps=isIOS?[[shr,'Ketuk tombol <b>Bagikan</b> di bawah Safari'],[pls,'Pilih <b>Tambah ke Layar Utama</b>'],[ok,'Ketuk <b>Tambah</b>, selesai']]:[[shr,'Buka menu <b>⋮</b> di pojok kanan atas browser'],[pls,'Pilih <b>Pasang aplikasi</b> atau <b>Tambahkan ke layar utama</b>'],[ok,'Ketuk <b>Pasang</b>, selesai']];
 d.innerHTML=`<div class="pwsc"><span class="pwsg" aria-hidden="true"></span><div class="pwsh"><img src="${PWA_IMG}" alt="" width="64" height="64"><div><b>Pasang Malik Tools</b><small>${isIOS?'Di iPhone lewat Safari':'Lewat menu browser'}</small></div></div><ol class="pwsl">${steps.map((x,i)=>`<li><span class="pwsn">${x[0]}</span><span>${x[1]}</span></li>`).join('')}</ol><button type="button" class="pwsx">Mengerti</button></div>`;
 const bye=()=>{d.classList.add('out');setTimeout(()=>d.remove(),220)};d.onclick=e=>{if(e.target===d||e.target.closest('.pwsx'))bye()};document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('in'))}
async function pwaGo(){if(dpr){const e=dpr;dpr=null;try{e.prompt();await e.userChoice}catch(x){}pwaSync();return}pwaSheet()}
function pwaSync(){const on=pwaCan();document.querySelectorAll('.pwab').forEach(b=>b.hidden=!on);}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();dpr=e;pwaSync()});
addEventListener('appinstalled',()=>{dpr=null;pwaSync()});
function drawerExtras(){const d=document.getElementById('drw');if(!d||d.querySelector('#pwab'))return;const dl0=d.querySelector('#dall'),ft=dl0&&dl0.closest('.dh');if(!ft)return;
 const w=document.createElement('div');w.innerHTML=`<button type="button" class="pwab" id="pwab" hidden><img src="${PWA_IMG}" alt="" width="44" height="44"><span><b>Pasang ke layar utama</b><small>Jadi aplikasi di HP-mu</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;
 while(w.firstChild)ft.before(w.firstChild);
 const pb=d.querySelector('#pwab');pb.hidden=!pwaCan();pb.onclick=pwaGo}
// getar kecil saat hasil muncul
try{new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType===1&&n.matches&&(n.matches('.out')||n.querySelector('.out'))&&!n.querySelector('.sk')&&!n.querySelector('.mtprc')){vib(12);return}}}).observe(document.getElementById('main'),{childList:true,subtree:true})}catch(e){}
// tarik untuk segarkan (beranda)
(()=>{let y0=0,dy=0,on=false;const el=document.createElement('div');el.className='ptr';el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.6-5.9"/><path d="M20 4v5h-5"/></svg>';document.body.appendChild(el);
 const home=()=>!location.hash.slice(1)&&scrollY<=0;
 const ptrCls=()=>document.documentElement.classList.toggle('ptrh',!location.hash.slice(1));ptrCls();addEventListener('hashchange',ptrCls);
 addEventListener('touchstart',e=>{if(!home()||e.touches.length!==1||(e.target.closest&&e.target.closest('.drw,.scrim,.mdl,.lbx,[role=dialog]')))return;y0=e.touches[0].clientY;dy=0;on=true;const hd=document.querySelector('.top');el.style.top=((hd?hd.getBoundingClientRect().bottom:60)-38)+'px'},{passive:true});
 addEventListener('touchmove',e=>{if(!on)return;dy=e.touches[0].clientY-y0;if(dy<=0){el.style.opacity=0;return}el.classList.remove('on');const p=Math.min(dy,110);el.style.opacity=Math.min(1,p/70);el.style.transform=`translateY(${Math.min(p*.5,54)}px) rotate(${p*3}deg)`},{passive:true});
 addEventListener('touchend',async()=>{if(!on)return;on=false;el.classList.add('on');if(dy>85&&home()){vib(15);el.classList.add('spin');el.style.opacity=1;el.style.transform='translateY(54px)';try{sessionStorage.setItem('mt_ld','1')}catch(e){}setTimeout(()=>location.reload(),350)}else{el.style.opacity=0;el.style.transform='translateY(0)'}dy=0},{passive:true})})();
try{drawerExtras()}catch(e){}
function route(){const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(document.startViewTransition&&!calm&&main.innerHTML){const vt=document.startViewTransition(render);vt.ready.catch(()=>{});vt.finished.catch(()=>{})}
 else{render();if(!calm){main.classList.remove('fade');void main.offsetWidth;main.classList.add('fade')}}}

/* ===== Sistem developer ===== */
const ROLEMAP={developer:['DEVELOPER','dv rl-dev'],owner:['OWNER','o rl-own'],premium:['PREMIUM','g rl-pre'],vip:['VIP','r rl-vip'],member:['MEMBER','b rl-mem']};
const roleB=r=>ROLEMAP[r]||ROLEMAP.member;
// Centang verified untuk Developer dan Owner; badge kustom dari developer (teks + warna dari daftar server)
const vchk=r=>r==='developer'||r==='owner'?'<svg class="vck" viewBox="0 0 24 24" role="img" aria-label="Terverifikasi"><title>Terverifikasi</title><path fill="#1d9bf0" d="M12 1.8l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.2l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z"/><path d="M8 12.3l2.7 2.7L16.2 9.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>':'';
const BCOL=[['Kuning','#ffc83d'],['Hijau','#4fd69a'],['Merah','#ff6b6b'],['Biru','#5cd0d8'],['Ungu','#8f9aff'],['Pink','#ff8fb8'],['Cyan','#5cd0d8'],['Oranye','#ff9a4d'],['Putih','#e8e8f0']];
const cbadge=b=>b&&b.t&&BCOL.some(x=>x[1]===b.c)?`<span class="tg2 tgc" style="--rc:${b.c}">${esc(b.t)}</span>`:'';
const roleLeft=ts=>{if(!ts)return 'Permanen';const d=Math.max(0,Math.ceil((ts-Date.now())/864e5));return 'Sampai '+new Date(ts).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})+(d?' ('+d+' hari lagi)':'')};
const roleDurs=[[1,'1 hari'],[7,'1 minggu (7 hari)'],[14,'2 minggu (14 hari)'],[30,'1 bulan (30 hari)'],[0,'Permanen']];
async function adm(a,b){
 try{const r=await fetch('/api/admin?action='+a,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:b?JSON.stringify(b):undefined});return await r.json()}catch(e){return{ok:false,error:'Tidak bisa terhubung ke server.'}}}
let ANN=null;
const POSTER_OK=u=>typeof u==='string'&&/^(https:\/\/|data:image\/)/.test(u);
const annHtml=()=>{try{if(!ANN||sessionStorage.getItem('mt_ann')===String(ANN.ts))return'';
 if(POSTER_OK(ANN.img))return `<div class="apo" role="status"><button type="button" class="x" aria-label="Tutup">×</button><img src="${esc(ANN.img)}" alt="Poster pengumuman"><div class="apd">${unduhBtn(ANN.img,'poster.jpg','Unduh Foto')}</div>${ANN.title||ANN.text||ANN.link?`<div class="apb">${ANN.title?`<h3>${esc(ANN.title)}</h3>`:''}${ANN.text?`<p>${esc(ANN.text)}</p>`:''}${/^https:\/\//.test(ANN.link||'')?`<a class="btn primary" href="${esc(ANN.link)}" target="_blank" rel="noopener noreferrer">${esc(ANN.btn||'Buka')}</a>`:''}</div>`:''}</div>`;
 return ''}catch(e){return''}};
// v329: pengumuman teks (toast) hidup di body, ditandai sudah tampil begitu muncul, jadi gambar ulang beranda tidak memunculkannya lagi
function annToast(){try{if(!ANN||POSTER_OK(ANN.img)||!(ANN.text||ANN.title))return;const k=String(ANN.ts);if(sessionStorage.getItem('mt_ann')===k||document.querySelector('.ann'))return;sessionStorage.setItem('mt_ann',k);
 const an=document.createElement('div');an.className='ann';an.setAttribute('role','status');an.innerHTML=`<span><b>${esc(ANN.title||'PENGUMUMAN')}</b>${esc(ANN.text||'')}</span><button type="button" aria-label="Tutup">×</button>`;
 const bye=()=>{if(!an.isConnected||an.classList.contains('out'))return;an.classList.add('out');setTimeout(()=>an.remove(),260)};
 const tp=document.querySelector('.top');an.style.top=((tp?tp.getBoundingClientRect().bottom:60)+8)+'px';an.querySelector('button').onclick=bye;document.body.appendChild(an);setTimeout(bye,9000)}catch(e){}}
let PAYON=false,CUST=[],PRICES={},OFF=[],PLANS=[[20,2000],[50,5000],[350,10000],[500,20000],[600,35000],[700,36000],[800,37000],[900,38000],[1000,39000],[1500,42000]].map(x=>({id:'c'+x[0],coins:x[0],price:x[1]}));
const isOff=id=>!(AUTH.user&&AUTH.user.isOwner)&&OFF.includes(PK(id)),OFFS=id=>id==='am-premium'?['am-send','am-verif']:id==='am-premium2'?['am-send2','am-verif2']:[PK(id)],offH='<p class="msg bad" style="display:block">Tool ini sedang dinonaktifkan sementara karena ada gangguan. Coba lagi nanti ya.</p><div class="row"><a class="btn" href="#">Kembali ke beranda</a></div>';
const rp=n=>'Rp'+Number(n).toLocaleString('id-ID'),dlbl=d=>d>=30&&d%30===0?d/30+' bulan':d>=7&&d%7===0?d/7+' minggu':d+' hari';
const PK=id=>({'am-premium':'am-verif','am-premium2':'am-verif2'}[id]||id),crOf=id=>{const k=PK(id);return Object.prototype.hasOwnProperty.call(PRICES,k)?PRICES[k]:(k==='rch'||k==='rch2'||k==='rch3'?3:k==='am-verif'||k==='am-verif2'?1:0)};
function applyPrices(){tools.forEach(t=>{if(t.id==='link-wa'||!META[t.id])return;const n=crOf(t.id);META[t.id].note=OFF.includes(PK(t.id))?'NONAKTIF':n>0?n+' KOIN':'GRATIS'})}
async function loadCustom(){const j=await adm('tools');if(!j.ok)return;ANN=j.announce||null;PRICES=j.prices||{};PLANS=j.plans||PLANS;PAYON=!!j.pay;OFF=j.off||[];applyPrices();if(location.hash==='#role')renderPage('role');
 CUST.forEach(id=>{const i=tools.findIndex(t=>t.id===id);if(i>-1)tools.splice(i,1);delete META[id];delete CAT[id]});CUST=[];
 if((j.tools||[]).length)await loadMod('tools');
 (j.tools||[]).forEach(c=>{if(tools.some(t=>t.id===c.id))return;tools.push(linkTool({id:c.id,name:c.name,desc:c.desc,label:c.label,ph:c.ph,btn:c.btn,text:c.type==='text'}));const w=c.name.split(/\s+/)[0];META[c.id]={c:'#4fd69a',tab:w.length<=9?w:w.slice(0,8)+'…',note:c.credit>0?c.credit+' LIMIT':'GRATIS',lead:c.desc.slice(0,90)};CAT[c.id]=c.cat;IC[c.id]=IC[{akun:'am-send',img:'hd-gambar',link:'bypass-link'}[c.cat]]||IC.go;CUST.push(c.id)});
 buildDock();try{dList()}catch(e){}
 const d=$(document,'#dcnt');if(d)d.textContent=tools.length+' tool · '+DCATS.length+' kategori'}
function mconfirm(title,msg,yes,danger){return new Promise(res=>{const d=document.createElement('div');d.className='cfm'+(danger===false?' ok':'');d.setAttribute('role','alertdialog');d.setAttribute('aria-modal','true');
 d.innerHTML=`<div class="box"><div class="ic">${danger===false?'?':'🗑'}</div><h3>${esc(title)}</h3><p>${esc(msg||'')}</p><div class="acts"><button type="button" class="no">Batal</button><button type="button" class="yes">${esc(yes||'Hapus')}</button></div></div>`;
 const done=v=>{d.remove();document.removeEventListener('keydown',kd);res(v)},kd=e=>{if(e.key==='Escape')done(false)};
 d.onclick=e=>{if(e.target===d)done(false)};d.querySelector('.no').onclick=()=>done(false);d.querySelector('.yes').onclick=()=>done(true);
 document.addEventListener('keydown',kd);document.body.appendChild(d);d.querySelector('.no').focus()})}
function showWarn(t,pv){const d=document.createElement('div');d.className='wmod';d.setAttribute('role','alertdialog');
 d.innerHTML=`<section class="panel"><div class="bar"><span>PERINGATAN DARI DEVELOPER</span>${pv?'<span class="pill">PRATINJAU TAMPILAN USER</span>':''}</div><div class="in"><p style="margin:0 0 16px;font-size:16px;line-height:1.5">${esc(t)}</p><div class="row"><button class="primary" style="--tc:#ffc83d">Saya mengerti</button></div></div></section>`;
 const b=d.querySelector('button');b.onclick=async()=>{d.remove();if(!pv)await adm('ack',{})};document.body.appendChild(d);b.focus()}
const slug=v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);
authP.then(()=>{dList();if(location.hash.slice(1)==='owner')renderPage('owner');if(AUTH.user&&AUTH.user.warning)showWarn(AUTH.user.warning)});
loadCustom().then(()=>{if(!PAGE_MOD[location.hash.slice(1)])route()});

/* ===== Global Chat ===== */
async function chat(b,v,bf){
 try{const r=await fetch('/api/chat'+(!b?(v?'?v='+encodeURIComponent(v):bf?'?before='+bf:''):''),{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:b?JSON.stringify(b):undefined});return await r.json()}catch(e){return{ok:false,error:'Tidak bisa terhubung ke server.'}}}
authP.then(()=>{if(location.hash.slice(1)==='chat')renderPage('chat')});
authP.then(()=>PUSH.sync());
const mentionsMe=m=>{const u=AUTH.user;if(!u||!m||m.mine||(m.sub&&m.sub===u.sub))return false;if(m.all)return true;const n=(u.name||'').split(' ')[0].toLowerCase();return !!n&&!!m.text&&m.text.toLowerCase().includes('@'+n)};
const notifOn=()=>ls.get('mt_notif')!==false;
function showNotif(title,body){try{if(!('Notification' in window)||Notification.permission!=='granted')return;const o={body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'mt-chat',renotify:true,data:{url:'/#chat'}};
 if(navigator.serviceWorker&&navigator.serviceWorker.ready)navigator.serviceWorker.ready.then(r=>r.showNotification(title,o)).catch(()=>{try{new Notification(title,o)}catch(e){}});else new Notification(title,o)}catch(e){}}
/* ===== Web Push (notifikasi saat situs ditutup; pengirim ada di api/_push.js) ===== */
const PUSH={
 ok:()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window,
 post:async b=>{try{const r=await fetch('/api/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return await r.json()}catch(e){return{ok:false,error:'Tidak bisa terhubung ke server.'}}},
 cfg:async()=>{try{return await(await fetch('/api/push',{credentials:'same-origin'})).json()}catch(e){return{ok:false}}},
 cur:async()=>{try{return await(await navigator.serviceWorker.ready).pushManager.getSubscription()}catch(e){return null}},
 // quiet=true: jangan memunculkan permintaan izin (dipakai sinkron otomatis); hanya jalan bila izin sudah diberikan.
 on:async quiet=>{
  if(!PUSH.ok())return{ok:false,error:'Browser ini belum mendukung push. Di iPhone, pasang Malik Tools ke Layar Utama dulu.'};
  if(!AUTH.user)return{ok:false,error:'Masuk dulu untuk mengaktifkan notifikasi.'};
  if(Notification.permission==='denied')return{ok:false,error:'Izin notifikasi diblokir di pengaturan browser.'};
  if(Notification.permission!=='granted'){if(quiet)return{ok:false};let p='';try{p=await Notification.requestPermission()}catch(e){}if(p!=='granted')return{ok:false,error:'Izin notifikasi tidak diberikan.'}}
  const c=await PUSH.cfg();if(!c.enabled||!c.key)return{ok:false,error:'Push belum diaktifkan di server.'};
  try{const reg=await navigator.serviceWorker.ready,key=Uint8Array.from(atob(c.key.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
   let s=await reg.pushManager.getSubscription();
   if(s&&s.options&&s.options.applicationServerKey&&btoa(String.fromCharCode(...new Uint8Array(s.options.applicationServerKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==c.key){await s.unsubscribe();s=null}
   if(!s)s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   const j=await PUSH.post({op:'subscribe',sub:s.toJSON()});
   if(!j.ok){try{await s.unsubscribe()}catch(e){}return{ok:false,error:j.error||'Gagal menyimpan langganan.'}}
   ls.set('mt_push',true);return{ok:true}}catch(e){return{ok:false,error:'Gagal mengaktifkan push di perangkat ini.'}}},
 off:async()=>{ls.set('mt_push',false);try{const s=await PUSH.cur();if(s){const ep=s.endpoint;await s.unsubscribe();if(AUTH.user)await PUSH.post({op:'unsubscribe',endpoint:ep})}}catch(e){}return{ok:true}},
 sync:async()=>{if(ls.get('mt_push')&&PUSH.ok()&&AUTH.user&&Notification.permission==='granted')PUSH.on(true)}
};
function inToast(title,body){const old=document.querySelector('.ntf');if(old)old.remove();const d=document.createElement('div');d.className='ntf';d.setAttribute('role','status');
 d.innerHTML=`<i aria-hidden="true">${svg('<path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4"/>')}</i><div style="min-width:0"><b>${esc(title)}</b><span>${esc(body)}</span></div>`;
 d.onclick=()=>{d.remove();location.hash='#chat'};document.body.appendChild(d);setTimeout(()=>d.remove(),7000)}
// Cek pesan baru yang menyebut kamu atau menandai semua orang. Pemakaian pertama hanya mencatat batas waktu (tanpa banjir notifikasi).
function notifyScan(list){const u=AUTH.user;if(!u||!Array.isArray(list)||!list.length)return;
 const last=+ls.get('mt_nseen')||0,mx=list.reduce((a,m)=>Math.max(a,+m.ts||0),0);if(mx>last)ls.set('mt_nseen',mx);if(!last)return;
 const hits=list.filter(m=>(+m.ts||0)>last&&mentionsMe(m));if(!hits.length||!notifOn())return;
 if(location.hash==='#chat'&&!document.hidden)return; // sedang membaca Global Chat, pesannya sudah disorot
 const m=hits[hits.length-1],nm=(m.name||'Seseorang').split(' ')[0];
 const title=hits.length>1?hits.length+' pesan menyebutmu di Global Chat':(m.all?nm+' menandai semua orang':nm+' menyebut kamu'),body=(m.text||'').slice(0,90);
 if(document.hidden)showNotif(title,body);else inToast(title,body)}
function chatDot(on){document.querySelectorAll('#mn,#fchat,.dl[data-pg="chat"]').forEach(e=>e.classList.toggle('nw',on));
 try{const b=document.title.replace(/^\(\*\) /,'');document.title=on?'(*) '+b:b;if(navigator.setAppBadge){on?navigator.setAppBadge():navigator.clearAppBadge()}}catch(e){}}
authP.then(()=>{if(!AUTH.user)return;const scan=async()=>{try{const r2=await fetch('/api/chat',{credentials:'same-origin'});const j2=await r2.json();if(j2.ok){notifyScan(j2.messages);return j2.v}}catch(e){}return''};
 const tick=async()=>{if(location.hash==='#chat'&&!document.hidden)return;if(document.hidden&&!(notifOn()&&'Notification' in window&&Notification.permission==='granted'))return;try{const r=await fetch('/api/chat?peek=1&v='+encodeURIComponent(window.CHATV||''),{credentials:'same-origin'});const j=await r.json();if(!j.ok)return;if(!window.CHATV){window.CHATV=j.v;if(!ls.get('mt_nseen'))await scan();return}if(!j.same){chatDot(true);if(notifOn()){const v=await scan();window.CHATV=v||j.v}}}catch(e){}};tick();setInterval(tick,45000)});
addEventListener('hashchange',route);route();

// ===== Gerbang login: tanpa akun, halaman tidak bisa dipakai =====
(function(){
 const T={login:['Selamat datang','Masuk untuk membuka Malik Tools.'],register:['Buat akun','Daftar dengan email aktif. Kode verifikasi dikirim lewat email.'],verify:['Cek email kamu','Masukkan kode 6 digit yang dikirim ke '],forgot:['Lupa kata sandi','Kami kirim kode ke email akunmu.'],reset:['Kata sandi baru','Masukkan kode dari email dan kata sandi baru.']};
 const EYE=svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
 let g=null,view='login',ctx={};
 const post=async(a,b)=>{const r=await fetch('/api/auth?action='+a,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(!j.ok)throw new Error(j.error||'Gagal. Coba lagi.');return j};
 const done=()=>{try{sessionStorage.setItem('mt_ld','1')}catch(e){}location.reload()};
 const pw=(id,ac,ph)=>`<label for="${id}">${ph}</label><div class="pwf fw">${IC.l}<input id="${id}" type="password" autocomplete="${ac}" maxlength="72" required><button type="button" class="eye" data-eye="${id}" aria-label="Tampilkan kata sandi">${EYE}</button></div>`;
 const IC={u:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),m:svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>'),l:svg('<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')};
 const fld=(id,lb,ac,ex,ic)=>`<label for="${id}">${lb}</label><div class="fw${ic?'':' nof'}">${ic||''}<input id="${id}" autocomplete="${ac}" required ${ex||''}></div>`;
 const forms={
  login:()=>`<div class="gg" id="gbtn2"><span class="ggv"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.2 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Lanjutkan dengan Google</span><div class="ggr"></div></div><div class="or">atau pakai username</div><form id="gf">${fld('f1','Username atau email','username','maxlength="120" autocapitalize="none" spellcheck="false"',IC.u)}${pw('f2','current-password','Kata sandi')}<div class="fr"><button type="button" class="lk" data-go="forgot">Lupa kata sandi?</button></div><button class="primary" style="--tc:#5cd0d8">Masuk</button><p class="msg" id="gm" role="status"></p></form>`,
  register:()=>`<div class="gg" id="gbtn2"><span class="ggv"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.2 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Lanjutkan dengan Google</span><div class="ggr"></div></div><div class="or">atau daftar manual</div><form id="gf">${fld('f1','Username','username','maxlength="20" autocapitalize="none" spellcheck="false" placeholder="huruf kecil, angka, _"',IC.u)}${fld('f3','Email','email','type="email" maxlength="120"',IC.m)}${pw('f2','new-password','Kata sandi (min. 8 karakter)')}<button class="primary" style="--tc:#5cd0d8">Kirim kode verifikasi</button><p class="msg" id="gm" role="status"></p></form>`,
  verify:()=>`<form id="gf">${fld('f1','Kode verifikasi','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}" class="cd" placeholder="000000"')}<button class="primary" style="--tc:#5cd0d8">Verifikasi & masuk</button><p class="msg" id="gm" role="status"></p></form><p class="ft"><button type="button" class="lk" id="rs">Kirim ulang kode</button><br><button type="button" class="lk" data-go="register">Ganti email</button></p>`,
  forgot:()=>`<form id="gf">${fld('f1','Email akun','email','type="email" maxlength="120"',IC.m)}<button class="primary" style="--tc:#5cd0d8">Kirim kode</button><p class="msg" id="gm" role="status"></p></form><p class="ft"><button type="button" class="lk" data-go="login">Kembali masuk</button></p>`,
  reset:()=>`<form id="gf">${fld('f1','Kode dari email','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}" class="cd" placeholder="000000"')}${pw('f2','new-password','Kata sandi baru (min. 8 karakter)')}<button class="primary" style="--tc:#5cd0d8">Simpan & masuk</button><p class="msg" id="gm" role="status"></p></form><p class="ft"><button type="button" class="lk" data-go="login">Kembali masuk</button></p>`
 };
 const submit={
  login:async v=>{await post('login',{id:v.f1,password:v.f2});done()},
  register:async v=>{await post('register',{username:v.f1,email:v.f3,password:v.f2});ctx.email=v.f3.trim().toLowerCase();go('verify')},
  verify:async v=>{await post('verify',{email:ctx.email,code:v.f1});done()},
  forgot:async v=>{await post('forgot',{email:v.f1});ctx.email=v.f1.trim().toLowerCase();go('reset','Jika email terdaftar, kode sudah dikirim.')},
  reset:async v=>{await post('reset',{email:ctx.email,code:v.f1,password:v.f2});done()}
 };
 function go(v,note){view=v;draw();if(note)say(note,'good')}
 function say(t,c){const m=g.querySelector('#gm');if(m){m.textContent=t;m.className='msg'+(c?' '+c:'')}}
 function draw(){
  const seg=(view==='login'||view==='register')?`<div class="seg" role="tablist"><button type="button" role="tab" data-go="login"${view==='login'?' class="on" aria-selected="true"':''}>Masuk</button><button type="button" role="tab" data-go="register"${view==='register'?' class="on" aria-selected="true"':''}>Daftar</button></div>`:'';
  g.querySelector('.gc').innerHTML=seg+`<h2>${T[view][0]}</h2><p class="gs">${T[view][1]}${view==='verify'?'<b></b>':''}</p>`+forms[view]();
  if(view==='verify')g.querySelector('.gs b').textContent=ctx.email;
  const f=g.querySelector('#gf');
  if(f)f.onsubmit=async e=>{e.preventDefault();const v={};f.querySelectorAll('input').forEach(i=>v[i.id]=i.value.trim());if(v.f2!==undefined)v.f2=f.querySelector('#f2').value;
   const b=f.querySelector('button.primary');b.disabled=true;say('Memproses...');
   try{await submit[view](v)}catch(x){say(x.message,'bad');b.disabled=false}};
  const rs=g.querySelector('#rs');if(rs)rs.onclick=async()=>{try{await post('resend',{email:ctx.email});say('Kode baru dikirim.','good')}catch(x){say(x.message,'bad')}};
  const gb=g.querySelector('#gbtn2');
  if(gb){const gone=()=>{const o=gb.nextElementSibling;gb.remove();if(o&&o.classList.contains('or'))o.remove()};if(!AUTH.clientId)gone();else loadGis().then(()=>{google.accounts.id.initialize({client_id:AUTH.clientId,callback:async x=>{try{await authGoogle(x.credential);done()}catch(e){say(e.message,'bad')}},auto_select:false});google.accounts.id.renderButton(gb.querySelector('.ggr'),{type:'standard',theme:'outline',size:'large',shape:'pill',text:'continue_with',width:Math.max(200,Math.min(400,gb.clientWidth||300))})}).catch(gone)}
  const fi=g.querySelector('#f1');if(fi&&view!=='login'&&view!=='register')fi.focus();
 }
 function open(){
  if(g)return;
  g=document.createElement('div');g.className='gate';g.setAttribute('role','dialog');g.setAttribute('aria-modal','true');g.setAttribute('aria-label','Masuk');
  g.innerHTML='<div class="gb"><div class="gbr"><img src="/logo.jpg?v=331" alt="" width="56" height="56"><span>Malik Tools<small>Tools gratis, langsung dari HP</small></span></div><div class="gc"></div><p class="gl">Dengan masuk, kamu setuju dengan <a href="/syarat" target="_blank" rel="noopener">Syarat Penggunaan</a> dan <a href="/privasi" target="_blank" rel="noopener">Kebijakan Privasi</a>.</p><div class="chips" aria-hidden="true"><span style="--c:#4fd69a">AM Premium</span><span style="--c:#4fd69a">Hapus BG</span><span style="--c:#4fd69a">HD Gambar</span><span style="--c:#ff8fb8">Bypass Link</span><span style="--c:#8f9aff">Global Chat</span></div></div>';
  g.addEventListener('click',e=>{const t=e.target.closest('[data-go],[data-eye]');if(!t)return;
   if(t.dataset.go){go(t.dataset.go)}
   else{const i=g.querySelector('#'+t.dataset.eye);i.type=i.type==='password'?'text':'password'}});
  document.body.appendChild(g);draw();
 }
 authP.then(()=>{if(AUTH.requireLogin&&!AUTH.user)open()});
})();
const CHANNEL_URL='https://whatsapp.com/channel/0029VbEOTvX6GcGLFkDqfv22';
function mtChannel(){
 try{if(localStorage.getItem('mt_chf')==='1')return}catch(e){}
 if(!/^https:\/\/(www\.)?whatsapp\.com\/channel\/[\w-]+$/i.test(CHANNEL_URL)||/ISI_LINK/.test(CHANNEL_URL))return;
 if(document.querySelector('.gate,.fcm'))return;
 const m=document.createElement('div');m.className='fcm';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','fct1');m.setAttribute('aria-describedby','fcd1');
 m.innerHTML='<div class="fcc"><button type="button" class="fcx" id="fcx" aria-label="Tutup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="fca"><img src="/logo.jpg?v=331" alt="" width="84" height="84"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></i></div><p class="fce">Channel Resmi</p><h2 id="fct1">Follow Malik Tools</h2><p class="fcd" id="fcd1">Biar tidak ketinggalan info dan kode dari kami, follow channel WhatsApp resmi Malik Tools.</p><ul class="fcl"><li>Info terbaru Malik Tools</li><li>Kode redeem Premium atau VIP</li></ul><div class="fcb"><a class="fcg" id="fcf" href="'+CHANNEL_URL+'" target="_blank" rel="noopener noreferrer">Follow Channel<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a><button type="button" class="fcs" id="fcn">Nanti saja</button></div></div>';
 document.body.appendChild(m);
 const prev=document.activeElement;
 const close=f=>{if(f===true)try{localStorage.setItem('mt_chf','1')}catch(e){}document.removeEventListener('keydown',key);m.classList.remove('on');setTimeout(()=>{m.remove();if(prev&&prev.focus)try{prev.focus()}catch(e){}},220)};
 const key=e=>{if(e.key==='Escape')close();else if(e.key==='Tab'){const f=[...m.querySelectorAll('a[href],button')];if(!f.length)return;const a=f[0],z=f[f.length-1],c=document.activeElement;if(e.shiftKey&&c===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&c===z){e.preventDefault();a.focus()}}};
 document.addEventListener('keydown',key);
 m.querySelector('#fcn').onclick=()=>close();
 m.querySelector('#fcx').onclick=()=>close();
 m.querySelector('#fcf').onclick=()=>{try{localStorage.setItem('mt_chf','1')}catch(e){}setTimeout(()=>close(true),300)};
 m.addEventListener('click',e=>{if(e.target===m)close()});
 requestAnimationFrame(()=>{m.classList.add('on');m.querySelector('#fcf').focus()});
}
const LOADER_ON=true,LOADER_MS=1900;
function mtLoader(){
 const ld=document.getElementById('ld');if(!ld)return;
 const root=document.documentElement,done=()=>{ld.remove();root.classList.remove('ldon');setTimeout(()=>root.classList.remove('ldin'),1900);setTimeout(mtChannel,400)};
 if(!LOADER_ON||root.classList.contains('noload')){done();return}
 root.classList.add('ldon');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,sleep=ms=>new Promise(r=>setTimeout(r,ms));
 // buka pertama di sesi = intro penuh; refresh berikutnya = versi singkat
 let seen=false;try{seen=sessionStorage.getItem('mt_seen')==='1';sessionStorage.setItem('mt_seen','1')}catch(e){}
 const MS=reduce?400:seen?700:LOADER_MS;
 const bar=$(ld,'.ivbar'),msg=$(ld,'.ivm');
 // bar empat warna yang terisi mengikuti langkah muat
 let shown=0,target=0,raf=0,closed=false;
 const paint=()=>{shown=reduce?target:shown+(target-shown)*.16;if(target-shown<.004)shown=target;bar.style.setProperty('--p',shown.toFixed(3));if(shown<1)raf=requestAnimationFrame(paint)};
 raf=requestAnimationFrame(paint);
 // tirai belah: salin isi jadi dua separuh (atas dan bawah), lalu buka ke atas dan ke bawah
 const out=async()=>{
  if(closed)return;closed=true;cancelAnimationFrame(raf);
  root.classList.add('ldin');
  if(reduce){ld.classList.add('out');await sleep(260);done();return}
  const st=$(ld,'.ivs'),half=c=>{const h=document.createElement('div'),k=st.cloneNode(true);h.className='ivh '+c;h.setAttribute('aria-hidden','true');const b=k.querySelector('.ivsk');if(b)b.remove();k.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));h.appendChild(k);return h};
  ld.append(half('t'),half('b'));st.remove();ld.classList.add('split');
  void ld.offsetWidth;
  requestAnimationFrame(()=>requestAnimationFrame(()=>ld.classList.add('out')));
  await sleep(900);done()};
 $(ld,'#sk').onclick=out;
 (async()=>{
  try{
   const timed=f=>new Promise(r=>f(()=>r(1)));
   const logo=timed(d=>{const i=new Image();i.onload=i.onerror=d;i.src=LOGO});
   const img=timed(d=>{const i=new Image(),a=document.querySelector('.ban-art');i.onload=i.onerror=d;i.src=a?a.src:'hero.jpg?v=252b'});
   const fonts=(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>1);
   const steps=[authP,logo,img,fonts,timed(d=>setTimeout(d,0))];
   const slot=reduce?0:seen?0:Math.max(180,Math.round((MS-900)/steps.length));
   let n=0;
   for(let i=0;i<steps.length;i++){
    if(closed)return;
    await Promise.all([Promise.race([steps[i],sleep(2500)]),sleep(slot)]);
    if(closed)return;n++;target=n/steps.length;
   }
   if(closed)return;
   target=1;msg.textContent=tools.length+' tool siap dipakai';
   await sleep(reduce?100:seen?150:450);
  }catch(e){}
  out();
 })();
 setTimeout(done,MS+4500);
}
// Loader baru jalan setelah pengguna login (layar login tampil dulu), sekali per sesi.
(function(){const root=document.documentElement,l=document.getElementById('ld');
 if(root.classList.contains('noload')){if(l)l.remove();root.classList.remove('ldwait');setTimeout(mtChannel,800);return}
 const start=()=>{root.classList.remove('ldwait','ldgate');mtLoader()};
 const chk=()=>{if(AUTH.user){start();return}root.classList.add('ldgate');const iv=setInterval(()=>{if(AUTH.user){clearInterval(iv);start()}},400)};
 Promise.resolve(authP).then(chk,chk)})();
