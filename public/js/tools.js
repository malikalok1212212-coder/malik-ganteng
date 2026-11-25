/* Modul tool: pembangun tampilan tiap jenis tool + daftar tool lengkap. Dimuat saat tool dibuka (lihat loadMod di core.js).
   Tambah tool baru di array TOOLS_FULL, lalu jalankan `npm run sync` agar daftar ringkas di core.js ikut diperbarui. */
function emailTool(id,btn){return `<label for="e">Email akun</label><input id="e" type="email" inputmode="email" autocomplete="off" placeholder="nama@email.com">
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="go">${btn}</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`}
function scCard(res,j){const s=j.sc;if(!s||!s.embed)return false;
 const emb='https://w.soundcloud.com/player/?url='+encodeURIComponent(s.embed)+'&color=%23ff7a1a&auto_play=false&hide_related=true&show_comments=false&show_reposts=false&visual=false';
 res.innerHTML=`<div class="out scc">${s.thumb?`<img class="scth" src="${esc(s.thumb)}" alt="" loading="lazy">`:''}<div class="scb"><b>${esc(s.title||'Lagu SoundCloud')}</b>${s.desc?`<small>${esc(s.desc)}</small>`:''}</div><iframe class="scpl" title="Pemutar SoundCloud" src="${esc(emb)}" allow="autoplay" loading="lazy"></iframe>${s.audio?`<audio controls preload="none" src="${esc(s.audio)}"></audio>`:''}<div class="row"><a class="btn primary" href="${esc(s.embed)}" target="_blank" rel="noopener noreferrer">Buka di SoundCloud</a>${s.audio?`<a class="btn" href="${esc(s.audio)}" download target="_blank" rel="noopener noreferrer">Unduh MP3</a>`:''}</div>${s.audio?'':'<p class="hint">SoundCloud tidak memberi file MP3 untuk lagu ini, jadi lagu hanya bisa diputar lewat pemutar di atas.</p>'}</div>`;return true}
function emailInit(r,id,showLink,check){
 const go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),e=$(r,'#e');
 const run=async()=>{const v=e.value.trim();const bad=check?check(v):(v?'':'Isi email terlebih dahulu.');if(bad){m.className='msg bad';m.textContent=bad;return}
  go.disabled=true;m.className='msg';m.textContent='Memproses...';res.innerHTML='';
  const j=await api(id,v,$(r,'#k').value);go.disabled=false;
  if(!j.ok){m.className='msg bad';m.textContent=j.error||'Gagal.';if(j.code===401)$(r,'#ac').style.display='block';return}
  m.className='msg good';
  if(id==='spotify-play'&&j.tracks&&spotCard(res,j)){m.textContent='Pilih lagu atau tekan tombol putar.';return}
  if(id==='soundcloud-dl'&&scCard(res,j)){m.textContent='Tekan tombol putar di pemutar.';return}
  if(showLink&&j.link){m.textContent='Link siap dipakai.';res.innerHTML=`<div class="out"><p class="okt"><span class="rck">✓</span>Hasil sudah siap. Ketuk tombol di bawah untuk membuka atau menyalinnya.</p><div class="row"><button class="primary" id="cp">Salin link</button><a class="btn" href="${esc(j.link)}" target="_blank" rel="noopener noreferrer">Buka link</a>${(()=>{const mk=(cleanFlat(j.data).find(x=>String(x[1])===String(j.link))||[])[2];return mediaBtn(mk,j.link,'',['aio-dl','tiktok-dl','youtube-dl','capcut-dl','fb-dl','ig-dl','dailymotion-dl'].includes(id)?'video':'',true)})()}${AUTH.user&&/^https:/.test(j.link)?'<button id="sh">Bagikan ke chat</button>':''}</div></div>`;{const cf=cleanFlat(j.data);if(cf.filter(x=>/^https?:\/\//.test(String(x[1]))).length>1)res.innerHTML+='<div class="out"><dl>'+cf.map(x=>/^https?:\/\//.test(String(x[1]))?`<dt>${esc(x[0])}</dt><dd><a href="${esc(x[1])}" target="_blank" rel="noopener noreferrer">Buka / unduh</a>${mediaBtn(x[2],x[1],'','',false,x[0])}</dd>`:`<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')+'</dl></div>'}$(r,'#cp').onclick=x=>copy(j.link,x.target);const sh=$(r,'#sh');if(sh)sh.onclick=async x=>{x.target.disabled=true;const q=await chat({text:String(j.link).slice(0,500)});x.target.disabled=false;x.target.textContent=q.ok?'Terkirim ke chat':'Gagal, coba lagi'};}
  else{m.textContent=showLink?'Permintaan berhasil, tetapi provider tidak mengirim link. Lihat detail di bawah.':'Data ditemukan.';
   if(id==='tiktok-stalker'&&stalkCard(res,j.data))return;
   if(id==='cek-situs'&&siteCard(res,j.data))return;
   resCard(res,j.data||{},id)}};
 go.onclick=run;e.onkeydown=ev=>{if(ev.key==='Enter')run()}}


// Spotify Play: pemutar bergaya aplikasi Spotify (Now Playing) + Dynamic Island.
const SPN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
SPPV='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2.5v14H6zM19 5v14L9.5 12z"/></svg>',
SPNX='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 5H18v14h-2.5zM5 5l9.5 7L5 19z"/></svg>',
SPSV=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>',
SPSH=SPSV('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
SPRP=SPSV('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>'),
SPR1=SPSV('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/><path d="M11 10l1.4-1v6.5" stroke-width="1.8"/>'),
SPHT=SPSV('<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 5 6.6 5c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.2 0 5.1 3 3.9 6.3-1.8 4.6-9.3 9.2-9.3 9.2z"/>'),
SPXI=SPSV('<path d="M6 6l12 12M18 6L6 18"/>'),
SPLK={get(){try{const a=JSON.parse(localStorage.getItem('mt_spk_like')||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}},set(a){try{localStorage.setItem('mt_spk_like',JSON.stringify(a.slice(-300)))}catch(e){}}},
SPG={stop:null},SPCC=new Map();
// Warna dominan cover (kanvas 24x24, piksel jenuh dibobot lebih besar). Bila server cover tidak mengizinkan CORS, kembali ke latar cover buram.
function spTint(u,cb){if(!u){cb(null);return}if(SPCC.has(u)){cb(SPCC.get(u));return}
 const im=new Image();im.crossOrigin='anonymous';im.referrerPolicy='no-referrer';
 im.onload=()=>{let r=null;try{const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,24,24);const d=x.getImageData(0,0,24,24).data;let R=0,G=0,B=0,W=0;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<200)continue;const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]),sat=mx?(mx-mn)/mx:0,w=Math.max(.02,.15+sat*sat*2-(mx>40?0:.1));R+=d[i]*w;G+=d[i+1]*w;B+=d[i+2]*w;W+=w}
  if(W){R/=W;G/=W;B/=W;const m=Math.max(R,G,B)||1,k=m<70?70/m:Math.min(1,150/m);r=[Math.min(255,Math.round(R*k)),Math.min(255,Math.round(G*k)),Math.min(255,Math.round(B*k))]}}catch(e){r=null}
  SPCC.set(u,r);cb(r)};
 im.onerror=()=>{SPCC.set(u,null);cb(null)};im.src=u}
// Dynamic Island: pil hitam di atas layar. Ringkas = cover + equalizer; ketuk (atau ganti lagu) = membesar dengan kontrol.
const SPI=(()=>{let el=null,ctl=null,tm=0,open=false;
 const q=s=>el.querySelector(s),fm=s=>{s=Math.floor(s);return isFinite(s)&&s>=0?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'0:00'};
 const img=(n,u)=>{n.innerHTML=u?`<img src="${esc(u)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:''};
 const collapse=()=>{clearTimeout(tm);open=false;if(el){el.classList.remove('open');el.setAttribute('aria-expanded','false')}};
 const expand=ms=>{if(!el)return;open=true;el.classList.add('open');el.setAttribute('aria-expanded','true');clearTimeout(tm);tm=setTimeout(collapse,ms||5000)};
 const mk=()=>{if(el)return;el=document.createElement('div');el.className='dyn';el.setAttribute('role','region');el.setAttribute('aria-label','Sedang diputar');el.setAttribute('aria-expanded','false');
  el.innerHTML=`<div class="dyc"><span class="dyi"><span class="dci"></span></span><span class="dyw" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><div class="dye"><button type="button" class="dyx" aria-label="Tutup pemutar">${SPXI}</button><div class="dyh"><span class="dyi dyl"><span class="dci"></span></span><div><b class="dti"></b><span class="dta"></span></div></div><div class="dyb"><span class="dtc">0:00</span><div class="dpb"><i></i></div><span class="dtd">0:00</span></div><div class="dyk"><button type="button" class="dkp" aria-label="Sebelumnya">${SPPV}</button><button type="button" class="dkl" aria-label="Putar">${PLI}</button><button type="button" class="dkn" aria-label="Berikutnya">${SPNX}</button></div></div>`;
  let sy=null,mv=false;const rs=()=>{sy=null;el.classList.remove('drag');el.style.removeProperty('--dy')};
  el.onpointerdown=e=>{if(e.target.closest('button'))return;sy=e.clientY;mv=false;try{el.setPointerCapture(e.pointerId)}catch(x){}};
  el.onpointermove=e=>{if(sy===null)return;const dy=e.clientY-sy;if(Math.abs(dy)>6){mv=true;el.classList.add('drag');el.style.setProperty('--dy',Math.max(-30,Math.min(30,dy*.45))+'px')}};
  el.onpointerup=e=>{if(sy===null)return;const dy=e.clientY-sy,m=mv;rs();if(m){setTimeout(()=>{mv=false},60);
    if(Math.abs(dy)>34){if(open)collapse();else if(dy<0){collapse();if(ctl&&ctl.close)ctl.close();el.classList.remove('show')}else expand(7000)}}};
  el.onpointercancel=rs;
  el.onclick=e=>{if(e.target.closest('button'))return;if(mv){mv=false;return}open?collapse():expand(7000)};
  const b=(s,f)=>{q(s).onclick=e=>{e.stopPropagation();f();if(open)expand(5000)}};
  b('.dkp',()=>ctl&&ctl.prev());b('.dkl',()=>ctl&&ctl.toggle());b('.dkn',()=>ctl&&ctl.next());
  q('.dyx').onclick=e=>{e.stopPropagation();collapse();if(ctl&&ctl.close)ctl.close();el.classList.remove('show')};
  document.addEventListener('pointerdown',e=>{if(open&&el&&!el.contains(e.target))collapse()});
  document.body.appendChild(el)};
 return{
  bind(c){ctl=c},
  show(){mk();requestAnimationFrame(()=>el.classList.add('show'))},
  hide(){if(el){collapse();el.classList.remove('show','spon')}},
  set(t,c,pop){mk();img(q('.dyi .dci'),c);img(q('.dyl .dci'),c);q('.dti').textContent=t.title||'';q('.dta').textContent=t.artist||'-';q('.dtd').textContent=t.duration||'0:00';q('.dtc').textContent='0:00';q('.dpb i').style.width='0%';if(pop)expand(3800)},
  playing(on){if(!el)return;el.classList.toggle('spon',on);const k=q('.dkl');k.innerHTML=on?PSI:PLI;k.setAttribute('aria-label',on?'Jeda':'Putar')},
  prog(c,d){if(!el)return;q('.dtc').textContent=fm(c);if(d>0)q('.dtd').textContent=fm(d);q('.dpb i').style.width=(d>0?Math.min(100,c/d*100):0)+'%'}}})();
// Perpustakaan Spotify Play: lagu disukai, playlist, dan terakhir diputar. Disimpan di perangkat (localStorage), tidak dikirim ke server.
const SPMO='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
SPQU=SPSV('<path d="M3 6h13M3 12h13M3 18h8"/><path d="M17 15l5 3-5 3z" fill="currentColor"/>'),
SPNT=SPSV('<path d="M4 5l9 7-9 7z"/><path d="M18 5v14"/>'),
SPPA=SPSV('<path d="M3 6h12M3 12h12M3 18h7"/><path d="M18 12v8M14 16h8"/>'),
SPLN=SPSV('<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'),
SPTR=SPSV('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
SPCK=SPSV('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
SPVL=SPSV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7"/>'),
SPVM=SPSV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
SPOK=t=>!!t&&typeof t.url==='string'&&typeof t.title==='string'&&(t.url.indexOf(location.origin+'/api/audio?')===0||/^https:\/\//i.test(t.url)),
SPSL=t=>({title:String(t.title).slice(0,120),artist:String(t.artist||'').slice(0,100),album:String(t.album||'').slice(0,100),duration:String(t.duration||'').slice(0,12),cover:/^https:\/\//i.test(t.cover||'')?String(t.cover).slice(0,500):'',url:t.url}),
SPDB={d:null,get(){if(SPDB.d)return SPDB.d;let o=null;try{o=JSON.parse(localStorage.getItem('mt_spk_lib')||'null')}catch(e){}
 if(!o||typeof o!=='object')o={};const ar=x=>Array.isArray(x)?x:[];
 SPDB.d={lt:ar(o.lt).filter(SPOK).map(SPSL),rc:ar(o.rc).filter(SPOK).map(SPSL),pl:ar(o.pl).filter(p=>p&&typeof p.id==='string'&&Array.isArray(p.t)).map(p=>({id:p.id.slice(0,24),n:String(p.n||'Playlist').slice(0,40),t:p.t.filter(SPOK).map(SPSL)}))};return SPDB.d},
 save(){const d=SPDB.get();try{localStorage.setItem('mt_spk_lib',JSON.stringify({lt:d.lt.slice(0,300),rc:d.rc.slice(0,30),pl:d.pl.slice(0,30).map(p=>({id:p.id,n:p.n,t:p.t.slice(0,300)}))}))}catch(e){}}};
function spotCard(res,j){const R=(j.tracks||[]).filter(t=>t&&t.url);if(!R.length)return false;
 if(SPG.stop){try{SPG.stop()}catch(e){}}
 const cov=t=>t.cover&&/^https:\/\//i.test(t.cover)?t.cover:'',fm=s=>{s=Math.floor(s);return isFinite(s)&&s>=0?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'0:00'};
 const nm=t=>(t.title+'-'+t.artist).replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'lagu';
 const img=u=>u?`<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:'';
 const qv=document.querySelector('#e'),qs=qv&&qv.value?qv.value.trim():'';
 res.innerHTML=`<div class="out spw"><div class="spn"><div class="spbg"></div><div class="spgr"></div><div class="sphd"><small>Memutar dari pencarian</small><b class="spq"></b></div><div class="spcv">${SPN}<span class="spci"></span></div>
<div class="spm"><div><b class="spti"></b><span class="spar"></span></div><button type="button" class="sphe" aria-label="Sukai lagu" aria-pressed="false">${SPHT}</button></div>
<input class="spr" type="range" min="0" max="1000" value="0" step="1" aria-label="Posisi lagu"><div class="spt"><span class="spcu">0:00</span><span class="spdu">0:00</span></div>
<div class="spc"><button type="button" class="sps" aria-label="Acak" aria-pressed="false">${SPSH}</button><button type="button" class="spv" aria-label="Sebelumnya">${SPPV}</button><button type="button" class="spp" aria-label="Putar">${PLI}</button><button type="button" class="spx" aria-label="Berikutnya">${SPNX}</button><button type="button" class="sprp" aria-label="Ulangi: mati" aria-pressed="false">${SPRP}</button></div>
<div class="spft"><button type="button" class="spdl" aria-label="Unduh audio" data-unduh="" data-n="lagu">${DLI}<span>Unduh MP3</span></button><button type="button" class="spsl" aria-label="Timer tidur">${SPCK}<span>Timer tidur</span></button><button type="button" class="spshr" aria-label="Salin link lagu">${SPLN}<span>Salin link</span></button></div>
<div class="spvr"><button type="button" class="spvm" aria-label="Bisukan">${SPVL}</button><input class="spvo" type="range" min="0" max="100" value="100" step="1" aria-label="Volume"></div>
<audio class="mtp" preload="none" playsinline></audio></div>
<div class="sptb" role="tablist" aria-label="Daftar lagu"><button type="button" role="tab" data-t="hasil" class="on" aria-selected="true">Hasil</button><button type="button" role="tab" data-t="antrean" aria-selected="false">Antrean<em class="spqn" hidden></em></button><button type="button" role="tab" data-t="lib" aria-selected="false">Perpustakaan</button></div>
<div class="spbody"></div></div>`;
 const q=s=>res.querySelector(s),a=q('audio'),rg=q('.spr'),pp=q('.spp'),hb=q('.sphe'),sb=q('.sps'),rb=q('.sprp'),W=q('.spw'),body=q('.spbody'),vo=q('.spvo'),vm=q('.spvm'),slB=q('.spsl'),slS=slB.querySelector('span');
 // T = daftar putar aktif (sumber: hasil, disukai, riwayat, atau playlist). Lagu antrean disisipkan tepat setelah lagu yang sedang diputar: ada qn lagu antrean di T[cur+1 .. cur+qn].
 let T=R.slice(),ctx='hasil',cur=0,qn=0,seek=false,shuf=false,rep=0,hist=[],likes=SPLK.get(),tint=0,playing=false,tab='hasil',lv=null,view={L:R,key:'hasil'},mt=null,slT=0,slI=0,slM=0,nT=0,lastRec='',vol=100,pre=60;
 q('.spq').textContent=qs||'Hasil pencarian';
 // Lembar menu dan notifikasi dipasang di body (bukan di dalam kartu) agar menempel di layar.
 const sh=document.createElement('div');sh.className='spsheet';sh.hidden=true;document.body.appendChild(sh);
 const tz=document.createElement('div');tz.className='sptoast';tz.setAttribute('role','status');document.body.appendChild(tz);
 const note=m=>{tz.textContent=m;tz.classList.add('show');clearTimeout(nT);nT=setTimeout(()=>tz.classList.remove('show'),1700)};
 const closeSh=()=>{sh.hidden=true;sh.innerHTML='';mt=null};
 const lnk=t=>{const m=/[?&]id=([A-Za-z0-9]{22})/.exec(t.url);return m?'https://open.spotify.com/track/'+m[1]:''};
 const cp=x=>{if(!x){note('Link tidak tersedia');return}try{navigator.clipboard.writeText(x).then(()=>note('Link disalin'),()=>note('Gagal menyalin'))}catch(e){note('Gagal menyalin')}};
 const rnd=()=>{if(T.length<2)return 0;let n;do{n=Math.floor(Math.random()*T.length)}while(n===cur);return n};
 const badge=()=>{const n=q('.spqn');n.textContent=qn||'';n.hidden=!qn};
 const ctxName=()=>ctx==='hasil'?'hasil pencarian':ctx==='liked'?'Lagu disukai':ctx==='recent'?'Terakhir diputar':((SPDB.get().pl.find(p=>'pl:'+p.id===ctx)||{}).n||'daftar putar');
 const setP=()=>{const d=a.duration,c=seek?rg.value/1000*(d||0):a.currentTime;const v=d>0?Math.min(1000,c/d*1000):0;if(!seek)rg.value=v;rg.style.setProperty('--p',(v/10)+'%');q('.spcu').textContent=fm(c);q('.spdu').textContent=d>0?fm(d):(T[cur].duration||'0:00');SPI.prog(c||0,d||0)};
 const syncHeart=anim=>{const lk=likes.includes(T[cur].url);if(anim){hb.classList.remove('on');void hb.offsetWidth}hb.classList.toggle('on',lk);hb.setAttribute('aria-pressed',lk?'true':'false');hb.setAttribute('aria-label',lk?'Hapus dari lagu disukai':'Sukai lagu')};
 const toggleLike=t=>{const u=t.url,d=SPDB.get(),i=likes.indexOf(u);if(i>=0){likes.splice(i,1);d.lt=d.lt.filter(x=>x.url!==u)}else{likes.push(u);d.lt.unshift(SPSL(t))}SPLK.set(likes);SPDB.save();syncHeart(T[cur]&&T[cur].url===u);if(tab==='lib')draw()};
 const rec=t=>{if(!t||t.url===lastRec)return;lastRec=t.url;const d=SPDB.get();d.rc=[SPSL(t)].concat(d.rc.filter(x=>x.url!==t.url)).slice(0,30);SPDB.save();if(tab==='lib'&&lv&&lv.k==='recent')draw()};
 // Daftar putar pribadi
 const plNew=name=>{name=String(name||'').trim().slice(0,40);if(!name){note('Isi nama playlist');return null}const d=SPDB.get();if(d.pl.length>=30){note('Maksimal 30 playlist');return null}const p={id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),n:name,t:[]};d.pl.push(p);SPDB.save();return p};
 const plAdd=(p,t)=>{if(p.t.some(x=>x.url===t.url)){note('Sudah ada di '+p.n);return}if(p.t.length>=300){note('Playlist penuh');return}p.t.push(SPSL(t));SPDB.save();note('Ditambahkan ke '+p.n)};
 // Antrean
 const qAdd=(t,front)=>{T.splice(cur+1+(front?0:qn),0,SPSL(t));qn++;badge();if(tab==='antrean')draw();note(front?'Diputar berikutnya':'Ditambahkan ke antrean')};
 // Tampilan daftar
 const rowH=(t,i)=>`<li data-i="${i}" tabindex="0" role="button" aria-label="Putar ${esc(t.title)}"><span class="tc">${SPN}${img(cov(t))}<span class="eq"><i></i><i></i><i></i></span></span><div class="ti"><b>${esc(t.title)}</b><span>${esc(t.artist||'-')}${t.album?' · '+esc(t.album):''}</span></div><span class="td">${esc(t.duration||'')}</span><button type="button" class="spmo" data-m="${i}" aria-label="Menu lagu ${esc(t.title)}">${SPMO}</button></li>`;
 const mark=()=>{const cu=T[cur];body.querySelectorAll('li[data-i]').forEach(l=>{const i=+l.getAttribute('data-i'),t=view.L[i];const on=view.key==='q'?i===cur:!!(t&&cu&&t.url===cu.url);l.classList.toggle('on',on);l.classList.toggle('spon',on&&playing)})};
 const qView=()=>{view={L:T,key:'q'};const nq=[],rest=[];for(let k=0;k<qn;k++)nq.push(rowH(T[cur+1+k],cur+1+k));for(let i=cur+1+qn;i<T.length&&rest.length<50;i++)rest.push(rowH(T[i],i));
  return `<div class="spcnt">Antrean</div><div class="spsub">Sedang diputar</div><ul class="spl">${rowH(T[cur],cur)}</ul>${qn?`<div class="spsub">Berikutnya dalam antrean<button type="button" class="spcl" data-clrq>Kosongkan</button></div><ul class="spl">${nq.join('')}</ul>`:''}${rest.length?`<div class="spsub">Berikutnya dari ${esc(ctxName())}</div><ul class="spl">${rest.join('')}</ul>`:''}${!qn&&!rest.length?'<p class="spem">Antrean kosong. Ketuk ⋯ pada lagu, lalu pilih Tambah ke antrean.</p>':''}`};
 const libTop=()=>{view={L:[],key:'lib'};const d=SPDB.get(),it=(k,id,ic,cl,t,s)=>`<li data-lv="${k}"${id?` data-id="${esc(id)}"`:''} tabindex="0" role="button"><span class="tc spic ${cl}">${ic}</span><div class="ti"><b>${esc(t)}</b><span>${s}</span></div></li>`;
  return `<div class="spcnt">Perpustakaan</div><ul class="spl">${it('liked','',SPHT,'spk',' Lagu disukai'.trim(),d.lt.length+' lagu')}${it('recent','',SPCK,'',' Terakhir diputar'.trim(),d.rc.length+' lagu')}${d.pl.map(p=>it('pl',p.id,SPN,'',p.n,'Playlist · '+p.t.length+' lagu')).join('')}</ul><div class="splf"><input type="text" maxlength="40" placeholder="Nama playlist baru" aria-label="Nama playlist baru"><button type="button" data-pc>Buat</button></div><p class="spem">Disimpan di perangkat ini saja.</p>`};
 const libSub=()=>{const d=SPDB.get();let L,name,key,p=null;
  if(lv.k==='liked'){L=d.lt;name='Lagu disukai';key='liked'}else if(lv.k==='recent'){L=d.rc;name='Terakhir diputar';key='recent'}
  else{p=d.pl.find(x=>x.id===lv.id);if(!p){lv=null;return libTop()}L=p.t;name=p.n;key='pl:'+p.id}
  view={L,key,p};
  return `<div class="sphd2"><button type="button" class="spbk" data-back aria-label="Kembali">‹</button><div><b>${esc(name)}</b><span>${L.length} lagu</span></div>${L.length?`<button type="button" class="sppa" data-playall>${PLI}<span>Putar</span></button>`:''}${p?`<button type="button" class="spdp" data-delpl aria-label="Hapus playlist">${SPTR}</button>`:''}</div>${L.length?`<ul class="spl">${L.map(rowH).join('')}</ul>`:'<p class="spem">Belum ada lagu.</p>'}`};
 const draw=()=>{let h;
  if(tab==='hasil'){view={L:R,key:'hasil'};h=`<div class="spcnt">Hasil pencarian</div><ul class="spl">${R.map(rowH).join('')}</ul>`}
  else if(tab==='antrean')h=qView();else h=lv?libSub():libTop();
  body.innerHTML=h;mark();
  res.querySelectorAll('.sptb button').forEach(b=>{const on=b.getAttribute('data-t')===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false')});badge()};
 const ui=on=>{playing=on;pp.innerHTML=on?PSI:PLI;pp.setAttribute('aria-label',on?'Jeda':'Putar');W.classList.toggle('plg',on);mark();SPI.playing(on)};
 const meta=(t,c)=>{const tk=++tint;spTint(c,rgb=>{if(tk!==tint)return;if(rgb){W.style.setProperty('--c','rgb('+rgb.join(',')+')');W.classList.add('hc')}else W.classList.remove('hc')});q('.spci').outerHTML=`<span class="spci">${img(c)}</span>`;q('.spbg').style.backgroundImage=c?`url("${c.replace(/["\\()\s]/g,encodeURIComponent)}")`:'none';
  q('.spti').textContent=t.title;q('.spar').textContent=t.artist||'-';syncHeart(false);
  const d=q('.spdl');d.setAttribute('data-unduh',t.url);d.setAttribute('data-n',nm(t));q('.spdu').textContent=t.duration||'0:00';
  if('mediaSession' in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist||'',album:t.album||'',artwork:c?[{src:c,sizes:'512x512'}]:[]})}catch(e){}}};
 const pick=(i,go,back)=>{const started=!!a.getAttribute('src'),old=cur;i=(i+T.length)%T.length;
  if(!back){if(i>old&&qn>0)qn=Math.max(0,qn-(i-old));else if(i<old)qn=0}
  cur=i;if(!back&&started&&old!==cur){hist.push(old);if(hist.length>50)hist.shift()}
  const t=T[cur],c=cov(t);meta(t,c);SPI.set(t,c,go);
  a.src=t.url;rg.value=0;setP();ui(false);if(tab==='antrean')draw();else badge();
  if(go){pp.disabled=true;a.play().catch(()=>{ui(false)}).finally(()=>{pp.disabled=false})}};
 // Putar dari daftar L (indeks i); antrean yang sudah ada tetap dibawa.
 const playFrom=(L,key,i)=>{const keep=T.slice(cur+1,cur+1+qn);T=L.slice();ctx=key;cur=i;hist=[];T.splice(cur+1,0,...keep);pick(cur,true,true)};
 meta(T[0],cov(T[0]));
 const toggle=()=>{if(!a.getAttribute('src')){pick(cur,true);return}a.paused?a.play().catch(()=>{}):a.pause()};
 const prev=()=>{if(a.currentTime>3){a.currentTime=0}else if(hist.length){qn=0;pick(hist.pop(),true,true)}else pick(cur-1,true)};
 const next=()=>pick(qn>0?cur+1:(shuf?rnd():cur+1),true);
 const rowGo=i=>{if(view.key==='q'){if(i===cur&&a.getAttribute('src'))toggle();else pick(i,true);return}
  const t=view.L[i];if(!t)return;const cu=T[cur];if(a.getAttribute('src')&&cu&&cu.url===t.url){toggle();return}playFrom(view.L,view.key,i)};
 // Menu lagu (⋯)
 const shHead=t=>`<div class="spsh"><span class="tc">${SPN}${img(cov(t))}</span><div><b>${esc(t.title)}</b><span>${esc(t.artist||'-')}</span></div></div>`;
 const openMenu=(t,i)=>{let rmL='';const lk=likes.includes(t.url);
  if(view.key==='q'&&i>cur&&i<=cur+qn)rmL='Hapus dari antrean';else if(view.key==='liked')rmL='Hapus dari lagu disukai';else if(view.key==='recent')rmL='Hapus dari riwayat';else if(view.p)rmL='Hapus dari playlist';
  mt={t,i,key:view.key,p:view.p};
  sh.innerHTML=`<div class="spsb" data-close></div><div class="spsp" role="dialog" aria-label="Menu lagu">${shHead(t)}<button type="button" data-a="next">${SPNT}Putar berikutnya</button><button type="button" data-a="queue">${SPQU}Tambah ke antrean</button><button type="button" data-a="like">${SPHT}${lk?'Hapus dari lagu disukai':'Sukai lagu'}</button><button type="button" data-a="pl">${SPPA}Tambah ke playlist</button>${lnk(t)?`<button type="button" data-a="link">${SPLN}Salin link Spotify</button>`:''}${rmL?`<button type="button" data-a="rm">${SPTR}${rmL}</button>`:''}<button type="button" data-unduh="${esc(t.url)}" data-n="${esc(nm(t))}">${DLI}Unduh MP3</button></div>`;
  sh.hidden=false};
 const plSheet=()=>{const d=SPDB.get(),t=mt.t;sh.querySelector('.spsp').innerHTML=`${shHead(t)}<div class="spsh2">Tambah ke playlist</div>${d.pl.map(p=>`<button type="button" data-pa="${esc(p.id)}">${SPN}<span>${esc(p.n)}</span><small>${p.t.some(x=>x.url===t.url)?'✓ ':''}${p.t.length} lagu</small></button>`).join('')}<div class="splf"><input type="text" maxlength="40" placeholder="Nama playlist baru" aria-label="Nama playlist baru"><button type="button" data-pn>Buat</button></div>`};
 const rmFrom=m=>{const t=m.t,i=m.i,d=SPDB.get();
  if(m.key==='q'){T.splice(i,1);qn=Math.max(0,qn-1)}
  else if(m.key==='liked')toggleLike(t);
  else if(m.key==='recent'){d.rc=d.rc.filter(x=>x.url!==t.url);SPDB.save()}
  else if(m.p){m.p.t.splice(i,1);SPDB.save()}
  draw()};
 sh.onclick=e=>{const b=e.target.closest('button,[data-close]');if(!b||!mt)return;
  if(b.hasAttribute('data-close')){closeSh();return}
  const t=mt.t,ac=b.getAttribute('data-a');
  if(ac==='next'){qAdd(t,true);closeSh()}
  else if(ac==='queue'){qAdd(t,false);closeSh()}
  else if(ac==='like'){toggleLike(t);closeSh()}
  else if(ac==='link'){const l=lnk(t);closeSh();cp(l)}
  else if(ac==='rm'){const m=mt;closeSh();rmFrom(m)}
  else if(ac==='pl')plSheet();
  else if(b.hasAttribute('data-pa')){const p=SPDB.get().pl.find(x=>x.id===b.getAttribute('data-pa'));closeSh();if(p){plAdd(p,t);if(tab==='lib')draw()}}
  else if(b.hasAttribute('data-pn')){const p=plNew(sh.querySelector('input').value);if(p){closeSh();plAdd(p,t);if(tab==='lib')draw()}}};
 sh.onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();const b=sh.querySelector('[data-pn]');if(b)b.click()}else if(e.key==='Escape')closeSh()};
 window.addEventListener('hashchange',closeSh);
 body.onclick=e=>{const t=e.target;
  const mo=t.closest('.spmo');if(mo){e.stopPropagation();const i=+mo.getAttribute('data-m'),tr=view.L[i];if(tr)openMenu(tr,i);return}
  if(t.closest('[data-back]')){lv=null;draw();return}
  if(t.closest('[data-playall]')){if(view.L.length)playFrom(view.L,view.key,0);return}
  if(t.closest('[data-delpl]')){const p=view.p;if(p&&confirm('Hapus playlist "'+p.n+'"?')){const d=SPDB.get();d.pl=d.pl.filter(x=>x!==p);SPDB.save();lv=null;draw()}return}
  if(t.closest('[data-clrq]')){T.splice(cur+1,qn);qn=0;draw();return}
  if(t.closest('[data-pc]')){const inp=body.querySelector('.splf input');if(plNew(inp.value))draw();return}
  const lb=t.closest('li[data-lv]');if(lb){lv={k:lb.getAttribute('data-lv'),id:lb.getAttribute('data-id')};draw();return}
  const li=t.closest('li[data-i]');if(li)rowGo(+li.getAttribute('data-i'))};
 body.onkeydown=e=>{if(e.target.tagName==='INPUT'){if(e.key==='Enter'){e.preventDefault();const b=body.querySelector('[data-pc]');if(b)b.click()}return}
  if(e.key!=='Enter'&&e.key!==' ')return;const li=e.target.closest&&e.target.closest('li');if(!li||e.target.closest('.spmo'))return;e.preventDefault();li.click()};
 q('.sptb').onclick=e=>{const b=e.target.closest('button');if(!b)return;const n=b.getAttribute('data-t');if(n==='lib'&&tab==='lib')lv=null;tab=n;draw()};
 // Kontrol utama
 pp.onclick=toggle;q('.spv').onclick=prev;q('.spx').onclick=next;
 hb.onclick=()=>{toggleLike(T[cur]);if(navigator.vibrate){try{navigator.vibrate(10)}catch(e){}}};
 sb.onclick=()=>{shuf=!shuf;sb.classList.toggle('on',shuf);sb.setAttribute('aria-pressed',shuf?'true':'false');sb.setAttribute('aria-label',shuf?'Acak: nyala':'Acak: mati')};
 rb.onclick=()=>{rep=(rep+1)%3;rb.classList.toggle('on',rep>0);rb.innerHTML=rep===2?SPR1:SPRP;rb.setAttribute('aria-pressed',rep>0?'true':'false');rb.setAttribute('aria-label',['Ulangi: mati','Ulangi: semua lagu','Ulangi: satu lagu'][rep])};
 q('.spshr').onclick=()=>cp(lnk(T[cur]));
 // Timer tidur: mati, 15, 30, 60 menit
 const slSet=m=>{clearTimeout(slT);clearInterval(slI);slM=m;
  if(!m){slS.textContent='Timer tidur';slB.classList.remove('on');return}
  const end=Date.now()+m*60000;slB.classList.add('on');
  slT=setTimeout(()=>{a.pause();slSet(0);note('Timer tidur: pemutar dijeda')},m*60000);
  const tk=()=>{slS.textContent='Tidur '+fm(Math.max(0,Math.round((end-Date.now())/1000)))};tk();slI=setInterval(tk,1000)};
 slB.onclick=()=>{const o=[0,15,30,60],n=o[(o.indexOf(slM)+1)%o.length];slSet(n);note(n?'Timer tidur '+n+' menit':'Timer tidur mati')};
 // Volume (di layar sentuh volume diatur lewat tombol perangkat, jadi barisnya disembunyikan lewat CSS)
 try{const sv=localStorage.getItem('mt_spk_vol');if(sv!==null&&isFinite(+sv)&&+sv>=0&&+sv<=100)vol=+sv}catch(e){}
 const setVol=v=>{vol=v;a.volume=v/100;vo.value=v;vo.style.setProperty('--p',v+'%');vm.innerHTML=v>0?SPVL:SPVM;vm.setAttribute('aria-label',v>0?'Bisukan':'Nyalakan suara');try{localStorage.setItem('mt_spk_vol',String(v))}catch(e){}};
 vo.oninput=()=>setVol(+vo.value);vm.onclick=()=>{if(vol>0){pre=vol;setVol(0)}else setVol(pre||60)};setVol(vol);
 a.onplay=()=>{ui(true);SPI.show();rec(T[cur])};a.onpause=()=>ui(false);
 a.onended=()=>{if(rep===2){a.currentTime=0;a.play().catch(()=>{});return}
  if(shuf&&T.length>1&&!qn){pick(rnd(),true);return}
  if(cur<T.length-1)pick(cur+1,true);else if(rep===1)pick(0,true);else{ui(false);a.currentTime=0;setP()}};
 a.ontimeupdate=()=>{setP();if('mediaSession' in navigator&&navigator.mediaSession.setPositionState&&a.duration>0){try{navigator.mediaSession.setPositionState({duration:a.duration,position:Math.min(a.currentTime,a.duration),playbackRate:1})}catch(e){}}};a.onloadedmetadata=setP;a.ondurationchange=setP;
 a.onerror=()=>{ui(false);const m=res.isConnected?document.querySelector('#m'):null;if(m){m.className='msg bad';m.textContent='Lagu ini tidak bisa diputar. Coba lagu lain atau unduh dulu.'}};
 rg.oninput=()=>{seek=true;setP()};rg.onchange=()=>{if(a.duration>0)a.currentTime=rg.value/1000*a.duration;seek=false;setP()};
 SPI.bind({toggle,prev,next,close:()=>a.pause()});
 SPG.stop=()=>{a.onerror=null;a.onpause=null;a.onplay=null;a.onended=null;a.ontimeupdate=null;a.pause();a.removeAttribute('src');try{a.load()}catch(e){}clearTimeout(slT);clearInterval(slI);clearTimeout(nT);window.removeEventListener('hashchange',closeSh);sh.remove();tz.remove();SPI.hide()};
 if('mediaSession' in navigator){try{const ms=navigator.mediaSession;ms.setActionHandler('play',()=>toggle());ms.setActionHandler('pause',()=>a.pause());ms.setActionHandler('previoustrack',prev);ms.setActionHandler('nexttrack',next);ms.setActionHandler('seekto',e=>{if(a.duration>0&&typeof e.seekTime==='number')a.currentTime=Math.min(a.duration,Math.max(0,e.seekTime))})}catch(e){}}
 draw();
 return true}
function stalkCard(res,raw){const d=raw&&typeof raw.data==='object'&&raw.data?raw.data:raw;if(!d||typeof d!=='object'||(!d.username&&!d.name))return false;
 const n=v=>(v===undefined||v===null||v==='')?'-':(/^\d+$/.test(String(v))?nf(+v):esc(v)),un=String(d.username||'').replace(/[^A-Za-z0-9._]/g,''),ph=typeof d.photo==='string'&&/^https:\/\//.test(d.photo)?d.photo:'';
 const st=[['Postingan',d.posts],['Pengikut',d.followers],['Mengikuti',d.following],['Suka',d.likes]];
 res.innerHTML=`<div class="out skc"><div class="skh">${ph?`<img src="${esc(ph)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:`<span class="ska">${esc((d.name||un||'?').charAt(0).toUpperCase())}</span>`}<div class="skn"><b>${esc(d.name||un)}</b><small>@${esc(un)}</small><div class="skt">${d.verified?'<span class="ok">Terverifikasi</span>':''}${d.private?'<span>Privat</span>':''}</div></div></div><div class="skg">${st.map(x=>`<div><b>${n(x[1])}</b><span>${x[0]}</span></div>`).join('')}</div>${d.bio?`<p class="skb">${esc(d.bio)}</p>`:''}<div class="row">${un?`<a class="btn primary" href="https://www.tiktok.com/@${esc(un)}" target="_blank" rel="noopener noreferrer">Buka profil</a>`:''}<button type="button" id="skc">Salin username</button>${ph?unduhBtn(ph,'foto-profil-'+(un||'tiktok')+'.jpg','Unduh Foto'):''}</div></div>`;
 const b=res.querySelector('#skc');if(b)b.onclick=x=>copy('@'+un,x.target);return true}
function slopCard(res,raw){const d=raw&&typeof raw.result==='object'&&raw.result?raw.result:raw;if(!d||typeof d!=='object'||typeof d.score!=='number')return false;
 const sc=Math.max(0,Math.min(100,Math.round(d.score))),col=sc<=30?'#4fd69a':sc<=60?'#ffc83d':'#ff6b6b',lbl=sc<=30?'Kemungkinan buatan manusia':sc<=60?'Campuran / tidak pasti':'Kemungkinan buatan AI',
 cf={high:'Tinggi',medium:'Sedang',low:'Rendah'}[String(d.confidence).toLowerCase()]||esc(d.confidence||'-'),sv={high:'TINGGI',medium:'SEDANG',low:'RENDAH'},
 a=d.analysis&&typeof d.analysis==='object'?d.analysis:{},https=u=>typeof u==='string'&&/^https:\/\//.test(u),
 sig=(arr,ai)=>Array.isArray(arr)&&arr.length?`<ul class="sll">${arr.slice(0,8).map(x=>`<li>${ai&&x.severity?`<span class="sv">${sv[String(x.severity).toLowerCase()]||esc(x.severity)}</span>`:''}${esc(x.signal||'')}${x.evidence?`<small>${esc(x.evidence)}</small>`:''}</li>`).join('')}</ul>`:'<p>Tidak ada.</p>',
 shot=https(d.screenshotDisplayUrl)?`<img class="sls" src="${esc(d.screenshotDisplayUrl)}" alt="Tangkapan layar situs" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:'';
 res.innerHTML=`<div class="out rescard slc"><div class="slg"><div class="slr" style="--c:${col};--p:${sc}"><b>${sc}</b></div><div class="slv"><strong>${esc(d.verdict||lbl)}</strong><span>${lbl} · keyakinan ${cf}</span>${typeof d.remaining==='number'&&d.limit?`<span>Sisa pindai: ${d.remaining} dari ${d.limit}</span>`:''}</div></div>${d.summary?`<p>${esc(d.summary)}</p>`:''}${a.verdict_detail?`<p>${esc(a.verdict_detail)}</p>`:''}${a.visual_notes?`<h4>Catatan tampilan</h4><p>${esc(a.visual_notes)}</p>`:''}<h4>Sinyal AI</h4>${sig(a.ai_signals,true)}<h4>Sinyal manusia</h4>${sig(a.human_signals,false)}${shot}<div class="row">${https(d.reportUrl)?`<a class="btn primary" href="${esc(d.reportUrl)}" target="_blank" rel="noopener noreferrer">Buka laporan</a>`:''}<button type="button" id="slc">Salin ringkasan</button>${shot?unduhBtn(d.screenshotDisplayUrl,'tangkapan-layar.jpg','Unduh Foto'):''}</div></div>`;
 const b=res.querySelector('#slc');if(b)b.onclick=x=>copy('Skor slop '+sc+'/100 - '+(d.verdict||lbl)+(d.title?' ('+d.title+')':'')+(https(d.reportUrl)?'\n'+d.reportUrl:''),x.target);return true}
function resCard(res,data,id){
 const hum=s=>/^\d+$/.test(s)?'#'+(+s+1):s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').trim().replace(/^./,c=>c.toUpperCase());
 let rows=flat(data).filter(x=>x[1]!==null&&x[1]!==undefined&&String(x[1]).trim()!=='');
 const seg=k=>k.split('.'),skip=/^(data|result|results|response)$/i;
 rows=rows.map(([k,v])=>{let s=seg(k);while(s.length>1&&skip.test(s[0]))s.shift();return{k:s,v}});
 // Hasil berhasil: sembunyikan data teknis (status, author, waktu respons, limit, kode status, timestamp) dan nilai ganda (idr/equivalent bila sudah ada versi formatted)
 const TECH=/^(status|success|ok|author|creator|response_?time|limit_?remaining|limit_?deducted|status_?code|timestamp|elapsed|message|msg)$/i,nl=r=>String(r.k[r.k.length-1]).toLowerCase().replace(/[_-]/g,'');
 const NS=new Set(rows.map(nl));
 rows=rows.filter(r=>{const n=nl(r);if(TECH.test(String(r.k[r.k.length-1])))return false;if(!/formatted$/.test(n)&&NS.has(n.replace(/(idr|equivalent)$/,'')+'formatted'))return false;return true});
 const last={};rows.forEach(r=>{const l=r.k[r.k.length-1];last[l]=(last[l]||0)+1});
 rows.forEach(r=>{r.l=(last[r.k[r.k.length-1]]>1?r.k:[r.k[r.k.length-1]]).map(hum).join(' › ');r.l=r.l.replace(/\s+formatted$/i,'');if(r.k.length&&last[r.k[r.k.length-1]]===1)r.l=lbl(r.k[r.k.length-1],r.l)});
 const isNum=v=>typeof v==='number'||/^-?\d+(\.\d+)?$/.test(String(v));
 const fmt=v=>typeof v==='boolean'?(v?'Ya':'Tidak'):isNum(v)&&String(v).replace(/\D/g,'').length<16?Number(v).toLocaleString('id-ID'):String(v);
 const main=rows.find(r=>isNum(r.v)&&/point|total|hasil|result|nilai|harga|price|saldo|limit|prime/i.test(r.k.join('.')))||rows.find(r=>isNum(r.v));
 const rest=rows.filter(r=>r!==main);
 const okv=v=>/^(ok|success|sukses|berhasil|true|aktif|active)$/i.test(String(v)),badv=v=>/^(fail|failed|error|gagal|false|expired|inactive)$/i.test(String(v));
 const val=r=>{const v=r.v;if(/^https?:\/\//i.test(String(v)))return`<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">Buka / unduh</a>${mediaBtn(r.k.join('.'),v,'','',false,r.l)}`;if(okv(v)||badv(v))return`<span class="rcs ${okv(v)?'g':'b'}">${esc(typeof v==='boolean'?fmt(v):v)}</span>`;return esc(fmt(v))};
 res.innerHTML=`<div class="out rescard"><div class="rch"><span class="rck">✓</span><b>Hasil cek</b></div>${main?`<div class="rcm"><span>${esc(main.l)}</span><strong>${esc(fmt(main.v))}</strong></div>`:''}${rest.length?`<ul class="rcl">${rest.map(r=>`<li><span>${esc(r.l)}</span><b>${val(r)}</b></li>`).join('')}</ul>`:''}<div class="row"><button type="button" id="rcp">Salin hasil</button></div></div>`;
 const b=res.querySelector('#rcp');if(b)b.onclick=x=>copy(rows.map(r=>r.l+': '+fmt(r.v)).join('\n'),x.target)}

function imgTool(o){return{id:o.id,name:o.name,desc:o.desc,
 html:()=>`<label class="drop" id="dz" for="f"><img class="dthumb" id="dt" alt="" hidden>${svg(IC.up)}<span><b>Pilih foto dari perangkat</b><span id="fi">JPG, PNG, atau WebP, sampai 50 MB. Foto besar dikecilkan otomatis.</span></span></label><input id="f" type="file" accept="image/*">
<label for="u">Atau link gambar</label><input id="u" type="url" inputmode="url" autocomplete="off" placeholder="https://contoh.com/foto.jpg"><div class="lpv" id="lpv" hidden><img alt="Pratinjau link"></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="go">${o.btn}</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),u=$(r,'#u'),f=$(r,'#f'),fi=$(r,'#fi');
  const hint=fi.textContent;
  const dz=$(r,'#dz');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('on')}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();if(!f.files.length)dz.classList.remove('on')}));
  dz.addEventListener('drop',e=>{const x=e.dataTransfer&&e.dataTransfer.files[0];if(x){const dt=new DataTransfer();dt.items.add(x);f.files=dt.files;f.onchange()}});
  f.onchange=()=>{const x=f.files[0];dz.classList.toggle('on',!!x);const dt=$(r,'#dt');if(dt.dataset.u)URL.revokeObjectURL(dt.dataset.u);if(x){dt.dataset.u=URL.createObjectURL(x);dt.src=dt.dataset.u;dt.hidden=false}else{dt.hidden=true;dt.removeAttribute('src');delete dt.dataset.u}dz.classList.toggle('has',!!x);fi.textContent=x?x.name+' · '+mb(x.size)+(x.size>LIMIT?' · akan dikecilkan otomatis':''):hint};
  const fail=(t,c)=>{res.innerHTML='';go.disabled=false;m.className='msg bad';m.textContent=t||'Gagal.';if(c===401)$(r,'#ac').style.display='block'};
  const run=async()=>{const file=f.files[0],v=u.value.trim();
   if(!file&&!/^https?:\/\//i.test(v)){m.className='msg bad';m.textContent='Pilih foto atau isi link gambar yang diawali https://';return}
   if(file&&file.size>MAXIN){m.className='msg bad';m.textContent='Ukuran foto maksimal 50 MB.';return}
   go.disabled=true;m.className='msg';res.innerHTML=skx(typeof o!=='undefined'&&o?o.id:'',2);
   let src=v,orig=v;
   if(file){orig=URL.createObjectURL(file);
     m.textContent='Menyiapkan foto...';let blob;
     try{blob=await prepare(file)}catch(e){return fail(e.message)}
     m.textContent='Mengunggah '+mb(blob.size)+'...';
     const up=await upload(blob,$(r,'#k').value);
     if(!up.ok)return fail(up.error,up.code);
     src=up.url}
   m.textContent=o.wait;
   const j=await api(o.id,src||'https://contoh.com/foto.jpg',$(r,'#k').value);go.disabled=false;
   if(!j.ok)return fail(j.error,j.code);
   if(!j.link)return fail('Provider tidak mengirim gambar hasil. Cek foto atau link, lalu coba lagi.');
   m.className='msg good';m.textContent=o.ok;
   const http=/^https?:/.test(j.link),isVid=!!o.vid&&(/^data:video\//i.test(j.link)||VIDX.test(j.link)),dn=isVid?o.dl.replace(/\.\w+$/,'.mp4'):o.dl,dlh=http?'/api/dl?u='+encodeURIComponent(j.link)+'&n='+encodeURIComponent(dn):j.link;
   res.innerHTML=`<div class="out"><div class="cmp"><figure><img src="${esc(orig)}" alt="Gambar asli"><figcaption>Asli</figcaption></figure><figure><img${o.chk?' class="chk"':''} src="${esc(j.link)}" alt="Hasil"><figcaption>Hasil</figcaption></figure></div><div class="row"><a class="btn primary dlb" id="dl" href="${esc(dlh)}" download="${o.dl}">${DLI}Unduh Foto</a>${http?'<button id="cp">Salin link</button>':''}</div></div>`;
   res.querySelectorAll('.cmp img').forEach(im=>{im.onclick=()=>{const lb=document.createElement('div');lb.className='lbx';lb.innerHTML='<img alt="">'+unduhBtn(im.src,o.dl||'foto.jpg','Unduh Foto');lb.firstChild.src=im.src;if(im.classList.contains('chk'))lb.firstChild.className='chk';lb.onclick=e=>{if(!(e.target.closest&&e.target.closest('.unb')))lb.remove()};document.body.appendChild(lb)}});const cp=$(r,'#cp');if(cp)cp.onclick=x=>copy(j.link,x.target);const dl=$(r,'#dl');if(dl&&http)dl.onclick=async ev=>{ev.preventDefault();const t=dl.innerHTML;dl.textContent='Mengunduh...';try{const q=await fetch(dlh,{credentials:'same-origin'});if(!q.ok)throw 0;const bl=await q.blob(),a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=dn;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(e){window.open(j.link,'_blank','noopener')}dl.innerHTML=t}};
  u.addEventListener('change',()=>{const p=$(r,'#lpv'),im=p.firstChild,v=u.value.trim();if(!/^https?:\/\//i.test(v)){p.hidden=true;return}im.onload=()=>{p.hidden=false};im.onerror=()=>{p.hidden=true};im.src=v});go.onclick=run;u.onkeydown=ev=>{if(ev.key==='Enter')run()}}}}
function baEl(a,b,chk,lb){const e=document.createElement('div');e.className='bax';
e.innerHTML=`<div class="bst"><div class="bl"><img alt="Asli" draggable="false"></div><div class="bl al${chk?' chk':''}"><img alt="Hasil" draggable="false"></div><i class="bhd"></i><span class="blb a">BEFORE · ASLI</span><span class="blb b">AFTER · ${lb||'HASIL'}</span></div><div class="bab"><button type="button" data-z="-" aria-label="Perkecil">−</button><output>Pas</output><button type="button" data-z="+" aria-label="Perbesar">+</button><button type="button" data-z="0">Pas</button></div><div class="bax-r"><label>Zoom</label><input class="zr" type="range" min="1" max="12" step="0.1" value="1" aria-label="Zoom"></div><div class="bax-r"><label>Before / After</label><input class="pr" type="range" min="0" max="100" value="50" aria-label="Before / After"></div>`;
const st=e.querySelector('.bst'),[i1,i2]=st.querySelectorAll('img'),al=e.querySelector('.al'),hd=e.querySelector('.bhd'),rg=e.querySelector('.pr'),zr=e.querySelector('.zr'),zo=e.querySelector('output');let P=.5,z=1,tx=0,ty=0,dg=0;const pt=new Map();
i1.src=a;i2.src=b;i1.onload=()=>{st.style.aspectRatio=i1.naturalWidth+'/'+i1.naturalHeight};
const ap=()=>{const w=st.clientWidth,h=st.clientHeight;z=Math.min(12,Math.max(1,z));tx=Math.min(0,Math.max(w-w*z,tx));ty=Math.min(0,Math.max(h-h*z,ty));i1.style.transform=i2.style.transform=`translate(${tx}px,${ty}px) scale(${z})`;al.style.clipPath=`inset(0 0 0 ${P*100}%)`;hd.style.left=P*100+'%';rg.value=P*100;zr.value=z;zo.textContent=z<1.05?'Pas':z.toFixed(1)+'×'};
const zm=(x,y,n)=>{n=Math.min(12,Math.max(1,n));const k=n/z;tx=x-(x-tx)*k;ty=y-(y-ty)*k;z=n;ap()};
new ResizeObserver(ap).observe(st);rg.oninput=()=>{P=rg.value/100;ap()};zr.oninput=()=>zm(st.clientWidth/2,st.clientHeight/2,+zr.value);
e.querySelector('.bab').onclick=ev=>{const d=ev.target.dataset.z;if(!d)return;const w=st.clientWidth,h=st.clientHeight;if(d==='0'){z=1;tx=ty=0;ap()}else zm(w/2,h/2,d==='+'?z*1.5:z/1.5)};
st.onpointerdown=ev=>{st.setPointerCapture(ev.pointerId);pt.set(ev.pointerId,[ev.clientX,ev.clientY]);dg=ev.target===hd?1:0};
st.onpointermove=ev=>{const o=pt.get(ev.pointerId);if(!o)return;const r=st.getBoundingClientRect();
if(pt.size===2){const q=[...pt].find(x=>x[0]!==ev.pointerId)[1];zm((ev.clientX+q[0])/2-r.left,(ev.clientY+q[1])/2-r.top,z*Math.hypot(ev.clientX-q[0],ev.clientY-q[1])/(Math.hypot(o[0]-q[0],o[1]-q[1])||1))}
else if(dg){P=Math.min(1,Math.max(0,(ev.clientX-r.left-st.clientLeft)/st.clientWidth));ap()}else{tx+=ev.clientX-o[0];ty+=ev.clientY-o[1];ap()}pt.set(ev.pointerId,[ev.clientX,ev.clientY])};
st.onpointerup=st.onpointercancel=ev=>pt.delete(ev.pointerId);
st.onwheel=ev=>{ev.preventDefault();const r=st.getBoundingClientRect();zm(ev.clientX-r.left,ev.clientY-r.top,z*Math.exp(-ev.deltaY*.002))};return e}
function amTool(o){return {id:o.id,name:o.name,desc:o.desc,
  html:()=>`<p class="crd" id="crd" role="status">Memuat saldo koin...</p>
<section class="amstep"><div class="amh"><span class="sn">1</span><div class="amt"><b>Kirim email verifikasi</b><small>Alight Motion mengirim email ke alamat ini.</small></div></div>
<label class="vh" for="e">Email akun</label><input id="e" type="email" inputmode="email" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="nama@email.com">
<div class="row"><button class="primary" id="go">Kirim email</button></div><p class="msg" id="m" role="status"></p></section>
<section class="amstep"><div class="amh"><span class="sn">2</span><div class="amt"><b>Aktifkan Pro</b><small>Buka email tadi, salin link-nya, lalu tempel di sini.</small></div><button type="button" class="amps" id="ps"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2"/></svg>Tempel</button></div>
<label class="vh" for="lk">Link atau kode dari email</label><textarea id="lk" rows="3" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Tempel link atau kode dari email"></textarea>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="vf">Verifikasi</button></div><p class="msg" id="m2" role="status"></p></section><div id="res"></div>`,
 init:r=>{const e=$(r,'#e'),lk=$(r,'#lk'),res=$(r,'#res'),cd=$(r,'#crd');
  const showCr=c=>{if(!cd)return;if(!c||c.unlimited){cd.style.display='none';return}cd.style.display='';cd.classList.toggle('low',!c.unlimited&&c.left===0);
   if(c.unlimited){cd.innerHTML='<b>Koin tak terbatas</b><span>Akun developer</span>';return}
   cd.innerHTML=crHtml(c)};
  fetch('/api/tool?credits=1',{credentials:'same-origin'}).then(x=>x.json()).then(j=>showCr(j.ok?j.credits:null)).catch(()=>showCr(null));
  const show=(j,ok,m)=>{m.className='msg good';m.textContent=ok;
   const cf=cleanFlat(j.data).filter(x=>String(x[1])!==String(j.link||'')),http=j.link&&/^https?:/i.test(j.link);
   res.innerHTML=(j.link||cf.length)?`<div class="out rescard"><div class="rch"><span class="rck">✓</span><b>Berhasil</b></div>${cf.length?`<ul class="rcl">${cf.map(x=>`<li><span>${esc(x[0])}</span><b>${esc(x[1])}</b></li>`).join('')}</ul>`:''}${j.link?`<div class="row">${http?`<a class="btn primary" href="${esc(j.link)}" target="_blank" rel="noopener noreferrer">Buka link</a>`:''}<button type="button" id="cp">Salin link</button></div>`:''}</div>`:'';
   const c=$(r,'#cp');if(c)c.onclick=x=>copy(j.link,x.target)};
  const run=async(btn,m,tool,okText,link)=>{const v=e.value.trim();
   if(!v){m.className='msg bad';m.textContent='Isi email terlebih dahulu.';return}
   if(link!==undefined&&!link){m.className='msg bad';m.textContent='Tempel link atau kode dari email.';return}
   btn.disabled=true;m.className='msg';m.textContent='Memproses...';res.innerHTML='';
   const j=await api(tool,v,$(r,'#k').value,link);btn.disabled=false;
   if(j.credits)showCr(j.credits);
   if(!j.ok){m.className='msg bad';m.textContent=j.error||'Gagal.';if(j.code===401&&!/Masuk dulu/.test(j.error||''))$(r,'#ac').style.display='block';return}
   show(j,okText,m);if(tool===o.S)setTimeout(()=>lk.scrollIntoView({block:'center',behavior:'smooth'}),250)};
  $(r,'#go').onclick=ev=>run(ev.target,$(r,'#m'),o.S,'Email terkirim. Buka email, salin link-nya, lalu tempel di langkah 2.');
  $(r,'#vf').onclick=ev=>run(ev.target,$(r,'#m2'),o.V,'Permintaan verifikasi terkirim.',lk.value.trim());
  $(r,'#ps').onclick=async()=>{const m=$(r,'#m2');try{const t=(await navigator.clipboard.readText()).trim();if(!t)throw 0;lk.value=t;lk.focus();m.className='msg';m.textContent=''}catch(x){m.className='msg bad';m.textContent='Clipboard tidak bisa dibaca. Tempel manual di kolom di atas.'}};
  e.onkeydown=ev=>{if(ev.key==='Enter')$(r,'#go').click()}}}}
function canvasTool(o){const nowT=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+'.'+String(d.getMinutes()).padStart(2,'0')};
return{id:o.id,name:o.name,desc:o.desc,
 html:()=>o.fields.map(f=>f.select?`<label for="t-${f.key}">${f.label}</label><select id="t-${f.key}">${f.select.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('')}</select>`:f.photo?`<label for="p-${f.key}">${f.label}</label><label class="drop" id="dz-${f.key}" for="p-${f.key}">${svg(IC.up)}<span><b>${f.vid?'Pilih foto atau video dari perangkat':'Pilih foto dari perangkat'}</b><span id="fi-${f.key}">${f.vid?'Foto: JPG, PNG, WebP (sampai 50 MB, dikecilkan otomatis). Video: MP4, MOV, WebM sampai 4 MB. Video lebih besar? Pakai link di bawah.':'JPG, PNG, atau WebP, sampai 50 MB. Foto besar dikecilkan otomatis.'}</span></span></label><input id="p-${f.key}" type="file" accept="${f.vid?'image/*,video/mp4,video/quicktime,video/webm':'image/*'}"><label for="u-${f.key}">${f.vid?'Atau link foto / video':'Atau link gambar'}</label><input id="u-${f.key}" type="url" inputmode="url" autocomplete="off" placeholder="${f.vid?'https://contoh.com/video.mp4':'https://contoh.com/foto.jpg'}">`:f.area?`<label for="t-${f.key}">${f.label}</label><textarea id="t-${f.key}" rows="9" maxlength="${f.max||2000}" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" wrap="off" style="font-family:'Space Mono',monospace;font-size:14px;line-height:1.5;min-height:170px;resize:vertical;white-space:pre;overflow:auto" placeholder="${esc(f.ph||'')}">${esc(f.val||'')}</textarea>`:`<label for="t-${f.key}">${f.label}</label><input id="t-${f.key}" type="text" maxlength="${f.max||100}" autocomplete="off" value="${esc(f.time?nowT():(f.val||''))}" placeholder="${esc(f.ph||'')}">`).join('')+`<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div><div class="row"><button class="primary" id="go">${o.btn}</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res');
  o.fields.filter(f=>f.photo).forEach(f=>{const fi=$(r,'#fi-'+f.key),fl=$(r,'#p-'+f.key),dz=$(r,'#dz-'+f.key),h=fi.textContent;fl.onchange=()=>{const x=fl.files[0];dz.classList.toggle('on',!!x);fi.textContent=x?x.name+' · '+mb(x.size):h}});
  const fail=(t,c)=>{res.innerHTML='';go.disabled=false;m.className='msg bad';m.textContent=t||'Gagal.';if(c===401)$(r,'#ac').style.display='block'};
  const bad=t=>{m.className='msg bad';m.textContent=t};const lim=j=>{const c=j&&j.credits;return c&&!c.unlimited&&c.left!=null?' Saldo koin: '+c.left+'.':''};
  go.onclick=async()=>{const code=$(r,'#k').value,vals={};
   for(const f of o.fields){
    if(f.photo){const file=$(r,'#p-'+f.key).files[0],v=$(r,'#u-'+f.key).value.trim();
     if(!file&&!/^https?:\/\//i.test(v)){if(f.req)return bad(f.label+': pilih foto atau isi link gambar yang diawali https://');continue}
     if(file&&f.vid&&/^video\//i.test(file.type)&&file.size>VIDMAX)return bad(f.label+': video dari perangkat maksimal 4 MB. Untuk video lebih besar, unggah dulu lalu tempel link langsungnya (berakhiran .mp4).');
     if(file&&file.size>MAXIN)return bad(f.label+': ukuran foto maksimal 50 MB.');
     vals[f.key]=file||v||''}
    else{const v=$(r,'#t-'+f.key).value.trim();if(!v&&f.req)return bad(f.label+' wajib diisi.');if(v)vals[f.key]=v}}
   go.disabled=true;m.className='msg';res.innerHTML=skx(typeof o!=='undefined'&&o?o.id:'');
   let orig='';{const pf=o.fields.find(f=>f.photo),pv=pf&&vals[pf.key];if(pv&&!(typeof pv!=='string'&&/^video\//i.test(pv.type))&&!(typeof pv==='string'&&VIDX.test(pv)))orig=typeof pv==='string'?pv:URL.createObjectURL(pv)}
   const fields={};
   for(const f of o.fields){let v=vals[f.key];if(v===undefined||v==='')continue;
    if(f.photo&&typeof v!=='string'){{const isV=/^video\//i.test(v.type);m.textContent=isV?'Menyiapkan video...':'Menyiapkan foto...';let blob;try{blob=isV?v:await prepare(v)}catch(e){return fail(e.message)}m.textContent='Mengunggah '+mb(blob.size)+'...';const up=await upload(blob,code);if(!up.ok)return fail(up.error,up.code);v=up.url}}
    fields[f.key]=v}
   m.textContent=o.wait;
   const j=await api(o.id,'',code,'',fields);go.disabled=false;
   if(!j.ok)return fail(j.error,j.code);
   if(!j.link&&o.data){m.className='msg good';m.textContent=o.ok+lim(j);resCard(res,j.data||{},o.id);return}
   if(!j.link)return fail('Provider tidak mengirim gambar hasil. Cek isian, lalu coba lagi.');
   m.className='msg good';m.textContent=o.ok+lim(j);
   const http=/^https?:/.test(j.link),isVid=!!o.video||(!!o.vid&&(/^data:video\//i.test(j.link)||VIDX.test(j.link))),dn=o.dl,dlh=http?'/api/dl?u='+encodeURIComponent(j.link)+'&n='+encodeURIComponent(o.dl):j.link;
   res.innerHTML=o.audio?`<div class="out"><div class="cmp"><figure><audio src="${esc(j.link)}" controls preload="auto" style="width:100%"></audio><figcaption>Hasil suara</figcaption></figure></div><div class="row"><a class="btn primary dlb" id="dl" href="${esc(dlh)}" download="${o.dl}">${DLI}Unduh Audio</a>${http?'<button id="cp">Salin link</button>':''}</div></div>`:(o.video||isVid)?`<div class="out"><div class="cmp"><figure><video src="${esc(j.link)}" controls playsinline loop autoplay muted style="width:100%;border-radius:12px;background:#000"></video><figcaption>Hasil</figcaption></figure></div><div class="row"><a class="btn primary dlb" id="dl" href="${esc(dlh)}" download="${dn}">${DLI}Unduh Video</a>${http?'<button id="cp">Salin link</button>':''}</div></div>`:`<div class="out"><div class="cmp"><figure><img src="${esc(j.link)}" alt="Hasil"><figcaption>Hasil</figcaption></figure></div><div class="row"><a class="btn primary dlb" id="dl" href="${esc(dlh)}" download="${o.dl}">${DLI}Unduh Foto</a>${http?'<button id="cp">Salin link</button>':''}</div></div>`;
   if(o.ba&&orig&&!o.audio&&!o.video&&!isVid){const cm=res.querySelector('.cmp');if(cm){cm.innerHTML='';cm.style.display='block';cm.append(baEl(orig,j.link,o.chk,o.lbl))}}
   const im=res.querySelector('.cmp img');if(im)im.onclick=()=>{const lb=document.createElement('div');lb.className='lbx';lb.innerHTML='<img alt="">'+unduhBtn(im.src,o.dl||'foto.jpg','Unduh Foto');lb.firstChild.src=im.src;lb.onclick=e=>{if(!(e.target.closest&&e.target.closest('.unb')))lb.remove()};document.body.appendChild(lb)};
   const cp=$(r,'#cp');if(cp)cp.onclick=x=>copy(j.link,x.target);const dl=$(r,'#dl');
   if(dl&&http)dl.onclick=async ev=>{ev.preventDefault();const t=dl.innerHTML;dl.textContent='Mengunduh...';try{const q=await fetch(dlh,{credentials:'same-origin'});if(!q.ok)throw 0;const bl=await q.blob(),a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download=o.dl;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(e){window.open(j.link,'_blank','noopener')}dl.innerHTML=t}}}}}
// Tool analisis gambar (hasil teks): pilih foto dari perangkat (diunggah sementara ke Blob) atau tempel link gambar.
function promptTool(o){return{id:o.id,name:o.name,desc:o.desc,
 html:()=>`<label class="drop" id="dz" for="f"><img class="dthumb" id="dt" alt="" hidden>${svg(IC.up)}<span><b>Pilih foto dari perangkat</b><span id="fi">JPG, PNG, atau WebP, sampai 50 MB. Foto besar dikecilkan otomatis.</span></span></label><input id="f" type="file" accept="image/*">
<label for="u">Atau link gambar</label><input id="u" type="url" inputmode="url" autocomplete="off" placeholder="https://contoh.com/foto.jpg">
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="go">${o.btn}</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),u=$(r,'#u'),f=$(r,'#f'),fi=$(r,'#fi'),dz=$(r,'#dz'),hint=fi.textContent;
  f.onchange=()=>{const x=f.files[0],dt=$(r,'#dt');dz.classList.toggle('on',!!x);dz.classList.toggle('has',!!x);if(dt.dataset.u)URL.revokeObjectURL(dt.dataset.u);
   if(x){dt.dataset.u=URL.createObjectURL(x);dt.src=dt.dataset.u;dt.hidden=false}else{dt.hidden=true;dt.removeAttribute('src');delete dt.dataset.u}
   fi.textContent=x?x.name+' · '+mb(x.size)+(x.size>LIMIT?' · akan dikecilkan otomatis':''):hint};
  const fail=(t,c)=>{res.innerHTML='';go.disabled=false;m.className='msg bad';m.textContent=t||'Gagal.';if(c===401)$(r,'#ac').style.display='block'};
  const run=async()=>{const file=f.files[0],v=u.value.trim();
   if(!file&&!/^https?:\/\//i.test(v)){m.className='msg bad';m.textContent='Pilih foto atau isi link gambar yang diawali https://';return}
   if(file&&file.size>MAXIN){m.className='msg bad';m.textContent='Ukuran foto maksimal 50 MB.';return}
   go.disabled=true;m.className='msg';res.innerHTML=skx(typeof o!=='undefined'&&o?o.id:'');
   let src=v;
   if(file){m.textContent='Menyiapkan foto...';let blob;try{blob=await prepare(file)}catch(e){return fail(e.message)}
    m.textContent='Mengunggah '+mb(blob.size)+'...';const up=await upload(blob,$(r,'#k').value);if(!up.ok)return fail(up.error,up.code);src=up.url}
   m.textContent=o.wait;
   const j=await api(o.id,src||'https://contoh.com/foto.jpg',$(r,'#k').value);go.disabled=false;
   if(!j.ok)return fail(j.error,j.code);
   const p=String((j.data&&(j.data.prompt||j.data.result))||'').trim();
   if(!p)return fail('Provider tidak mengirim prompt. Cek foto atau link, lalu coba lagi.');
   m.className='msg good';m.textContent='Prompt siap.';
   res.innerHTML=`<div class="out rescard"><div class="rch"><span class="rck">✓</span><b>Prompt</b></div><p style="white-space:pre-wrap;line-height:1.6;margin:12px 0;user-select:text;-webkit-user-select:text">${esc(p)}</p><div class="row"><button class="primary" id="cp">Salin prompt</button></div></div>`;
   $(r,'#cp').onclick=x=>copy(p,x.target)};
  go.onclick=run;u.onkeydown=ev=>{if(ev.key==='Enter')run()}}}}
// TikTok Downloader V2 (NexaDev SnapTik): tampilan dark elevated, semua ikon SVG. Server mengirim data { judul, thumbnail, video_HD, video, audio, foto_N }.
const TK2P={down:'<path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14"/>',link:'<path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5"/>',
paste:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>',x:'<path d="M18 6L6 18M6 6l12 12"/>',
video:'<rect x="2" y="5" width="14" height="14" rx="3"/><path d="M16 10l6-3v10l-6-3"/>',hd:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M7 9v6M11 9v6M7 12h4M15 15V9h1.5a3 3 0 010 6H15z"/>',
music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',img:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',check:'<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
alert:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',loader:'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
drop:'<path d="M12 2.7s7 7.2 7 12.3a7 7 0 01-14 0c0-5.1 7-12.3 7-12.3z"/><path d="M4 4l16 16"/>',play:'<path d="M7 4l13 8-13 8z" fill="currentColor"/>',file:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>'};
const tk2I=(n,c)=>'<svg class="tk2i'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+TK2P[n]+'</svg>';
function tk2Css(){if(document.getElementById('tk2css'))return;const s=document.createElement('style');s.id='tk2css';
 s.textContent='.tk2{--s1:#11131a;--s2:#171a23;--s3:#1e222d;--bg:#0b0c10;--ln:rgba(255,255,255,.07);--ln2:rgba(255,255,255,.13);--tx:#eef0f6;--mu:#8b91a3;--dm:#5d6377;--ac:#7c5cff;--ac2:#22d3ee;color:var(--tx);text-align:left}'
 +'.tk2 *{box-sizing:border-box}.tk2i{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}.tk2i.sm{width:16px;height:16px}.tk2i.spin{animation:tk2sp .8s linear infinite}@keyframes tk2sp{to{transform:rotate(360deg)}}'
 +'.tk2 .card{background:linear-gradient(180deg,var(--s2),var(--s1));border:1px solid var(--ln);border-radius:18px;box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 18px 40px -18px rgba(0,0,0,.8),0 2px 6px rgba(0,0,0,.4)}'
 +'.tk2 .form{padding:14px}.tk2 .fld{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--ln);border-radius:14px;padding:0 6px 0 14px;height:52px;transition:.2s}.tk2 .fld:focus-within{border-color:var(--ac);box-shadow:0 0 0 4px rgba(124,92,255,.18)}.tk2 .fld>.tk2i{color:var(--dm)}'
 +'.tk2 .fld input{flex:1;min-width:0;width:auto;height:auto;margin:0;padding:0;background:none;border:0;outline:0;box-shadow:none;color:var(--tx);font:inherit;font-size:15px}.tk2 .fld input::placeholder{color:var(--dm)}'
 +'.tk2 .ib{width:38px;height:38px;min-width:0;padding:0;margin:0;border-radius:10px;border:0;background:var(--s3);color:var(--mu);display:grid;place-items:center;cursor:pointer}.tk2 .ib:hover{color:var(--tx)}.tk2 .ib[hidden]{display:none}'
 +'.tk2 .gob{margin:12px 0 0;width:100%;height:52px;border:0;border-radius:14px;cursor:pointer;color:#fff;font-weight:600;font-size:15px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px;background:linear-gradient(135deg,var(--ac),#5b8cff 60%,var(--ac2));box-shadow:0 12px 26px -10px rgba(124,92,255,.8),0 1px 0 rgba(255,255,255,.3) inset;transition:.15s}.tk2 .gob:hover{filter:brightness(1.08)}.tk2 .gob:active{transform:scale(.99)}.tk2 .gob:disabled{opacity:.6;cursor:wait}'
 +'.tk2 .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.tk2 .chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mu);background:var(--s1);border:1px solid var(--ln);padding:6px 11px;border-radius:99px}.tk2 .chip .tk2i{color:var(--ac2);width:15px;height:15px}'
 +'.tk2 .sec{margin-top:16px}.tk2 .err{display:flex;gap:12px;padding:14px;border-radius:14px;color:#fecaca;font-size:14px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22)}.tk2 .err .tk2i{color:#f87171;margin-top:1px}'
 +'.tk2 .skel{padding:14px;display:flex;gap:14px}.tk2 .sk{background:linear-gradient(90deg,var(--s2),var(--s3),var(--s2));background-size:200% 100%;animation:tk2sh 1.2s infinite;border-radius:12px}@keyframes tk2sh{to{background-position:-200% 0}}'
 +'.tk2 .res{overflow:hidden;animation:tk2up .35s ease both}@keyframes tk2up{from{opacity:0;transform:translateY(10px)}}.tk2 .media{display:flex;gap:14px;padding:14px}'
 +'.tk2 .th{width:104px;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:var(--s3);flex:none;display:grid;place-items:center;color:var(--dm);border:1px solid var(--ln);position:relative}.tk2 .th img{width:100%;height:100%;object-fit:cover;display:block}'
 +'.tk2 .th .pl{position:absolute;right:6px;bottom:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);display:grid;place-items:center;color:#fff}'
 +'.tk2 .mt{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}.tk2 .mt h3{margin:0;font-size:15px;line-height:1.4;font-weight:600;color:var(--tx);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}'
 +'.tk2 .tg{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}.tk2 .tag{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--mu);background:var(--bg);border:1px solid var(--ln);padding:4px 9px;border-radius:99px}.tk2 .tag .tk2i{color:#34d399}'
 +'.tk2 .dl{border-top:1px solid var(--ln);padding:12px;display:grid;gap:10px}.tk2 .dlt{font-size:12px;color:var(--dm);text-transform:uppercase;letter-spacing:.08em;padding:2px 4px}'
 +'.tk2 .row2{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border:1px solid var(--ln);border-radius:14px;transition:.15s}.tk2 .row2:hover{border-color:var(--ln2);transform:translateY(-1px)}'
 +'.tk2 .ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none}.tk2 .ico.v{background:rgba(124,92,255,.15);color:#a794ff}.tk2 .ico.h{background:rgba(34,211,238,.13);color:#22d3ee}.tk2 .ico.a{background:rgba(52,211,153,.13);color:#34d399}.tk2 .ico.o{background:var(--s3);color:var(--mu)}'
 +'.tk2 .rt{min-width:0;flex:1}.tk2 .rt b{display:block;font-size:14px;font-weight:600;color:var(--tx)}.tk2 .rt small{color:var(--dm);font-size:12px}.tk2 .act{display:flex;gap:6px}'
 +'.tk2 .tkb{height:38px;padding:0 14px;margin:0;border-radius:11px;border:0;cursor:pointer;font-weight:600;font-size:13px;font-family:inherit;display:inline-flex;align-items:center;gap:7px;color:#fff;background:linear-gradient(135deg,var(--ac),#5b8cff);box-shadow:0 8px 18px -8px rgba(124,92,255,.8)}.tk2 .tkb:hover{filter:brightness(1.1)}.tk2 .tkb:disabled{opacity:.6;cursor:wait}'
 +'.tk2 .tkb.g{background:var(--s3);box-shadow:none;color:var(--mu);padding:0;width:38px;justify-content:center}.tk2 .tkb.g:hover{color:var(--tx)}'
 +'.tk2 .row2{flex-wrap:wrap}.tk2 .pv{flex:1 1 100%;order:9;min-width:0}.tk2 .pv .mtvw,.tk2 .pv .mtaw{margin:0!important;order:0;width:100%}.tk2 .pv .mtvn{margin:0}.tk2 .pv video{width:100%;max-height:62vh;border-radius:12px;background:#000;display:block}.tk2 .pv audio{width:100%;display:block}.tk2 .pv img{max-width:100%;height:auto;border-radius:12px;display:block;margin:0 auto}'
+'/* v432: lawan aturan global .card (flex) dan input/button ber-!important supaya form tool tidak meluber */'
 +'.tk2{width:100%;max-width:100%;min-width:0;overflow-x:clip}'
 +'.tk2 .card:not(#_):not(#__):not(#___):not(#____){display:block!important;width:100%;max-width:100%;min-width:0;margin:0!important;padding:0!important;transform:none!important;align-items:stretch!important;gap:0!important;text-decoration:none}'
 +'.tk2 .card.form:not(#_):not(#__):not(#___):not(#____){padding:14px!important;overflow:hidden}'
 +'.tk2 .fld:not(#_):not(#__):not(#___):not(#____){display:flex!important;align-items:center;gap:10px;width:100%;max-width:100%;min-width:0;margin:0!important;box-sizing:border-box}'
 +'.tk2 .fld input:not(#_):not(#__):not(#___):not(#____){flex:1 1 0!important;width:auto!important;min-width:0!important;height:100%!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;outline:0!important;color:var(--tx)!important;font-size:16px!important;text-overflow:ellipsis}'
 +'.tk2 .fld input:not(#_):not(#__):not(#___):not(#____):focus{background:transparent!important;border:0!important;box-shadow:none!important}'
 +'.tk2 .ib:not(#_):not(#__):not(#___):not(#____),.tk2 .tkb.g:not(#_):not(#__):not(#___):not(#____){flex:none!important;border:0!important;box-shadow:none!important;transform:none!important}'
 +'.tk2 .gob:not(#_):not(#__):not(#___):not(#____){display:flex!important;width:100%!important;border:0!important;transform:none}'
 +'.tk2 .res.card:not(#_):not(#__):not(#___):not(#____){display:block!important;overflow:hidden}'
 +'.tk2 .media,.tk2 .dl,.tk2 .row2{max-width:100%;min-width:0}'
 +'@media(max-width:380px){.tk2 .th{width:84px}.tk2 .tkb span{display:none}.tk2 .tkb{padding:0;width:38px;justify-content:center}}';
 document.head.appendChild(s)}
function tk2Html(){return `<div class="tk2"><div class="card form"><div class="fld">${tk2I('link')}<input id="e" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://vt.tiktok.com/..." aria-label="Link TikTok"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button><button type="button" class="ib" id="tkp" aria-label="Tempel">${tk2I('paste','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('down')}<span>Ambil video</span></button>
<div class="chips"><span class="chip">${tk2I('drop')}Tanpa watermark</span><span class="chip">${tk2I('hd')}Kualitas HD</span><span class="chip">${tk2I('music')}Audio MP3</span></div></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function tk2Card(res,d){
 const slug=(String(d.judul||'tiktok').replace(/#\S+/g,'').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,40)||'tiktok');
 const rows=[];
 if(d.video_HD)rows.push(['h','hd','Video HD','MP4 · tanpa watermark',d.video_HD,slug+'-hd.mp4']);
 if(d.video)rows.push(['v','video','Video','MP4 · tanpa watermark',d.video,slug+'.mp4']);
 if(d.audio)rows.push(['a','music','Audio','MP3',d.audio,slug+'.mp3']);
 Object.keys(d).filter(k=>/^foto_\d+$/.test(k)).forEach((k,i)=>rows.push(['o','img','Foto '+(i+1),'JPG',d[k],slug+'-'+(i+1)+'.jpg']));
 if(!rows.length){res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>Tidak ada tautan unduhan. Pastikan video TikTok publik.</div></div>`;return}
 const th=d.thumbnail&&/^https:/.test(d.thumbnail)?`<img src="${esc(d.thumbnail)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:tk2I('video');
 res.innerHTML=`<section class="sec card res"><div class="media"><div class="th">${th}<span class="pl">${tk2I('play','sm')}</span></div><div class="mt"><h3>${esc(d.judul||'Video TikTok')}</h3><div class="tg"><span class="tag">${tk2I('check','sm')}Siap diunduh</span><span class="tag">${tk2I('file','sm')}${rows.length} file</span></div></div></div>
<div class="dl"><div class="dlt">Pilih format</div>${rows.map((x,i)=>`<div class="row2"><div class="ico ${x[0]}">${tk2I(x[1])}</div><div class="rt"><b>${x[2]}</b><small>${x[3]}</small></div><div class="act"><button type="button" class="tkb g" data-tkw="${i}" aria-label="Putar dulu sebelum unduh" title="Putar dulu">${tk2I('play','sm')}</button><button type="button" class="tkb g" data-tkc="${i}" aria-label="Salin link">${tk2I('copy','sm')}</button><button type="button" class="tkb" data-unduh="${esc(x[4])}" data-n="${esc(x[5])}">${tk2I('down','sm')}<span>Unduh</span></button></div></div>`).join('')}</div></section>`;
 res.querySelectorAll('img').forEach(i=>{i.onerror=()=>i.remove()});
 res.querySelectorAll('[data-tkc]').forEach(b=>{b.onclick=()=>{const u=rows[+b.dataset.tkc][4],ok=()=>{b.innerHTML=tk2I('check','sm');setTimeout(()=>{b.innerHTML=tk2I('copy','sm')},1200)};(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(ok,()=>{})}});
 // Pratinjau: video/audio/foto diputar langsung di bawah barisnya (satu yang aktif sekaligus)
 const stopM=el=>el.querySelectorAll('video,audio').forEach(x=>x.pause());
 res.querySelectorAll('[data-tkw]').forEach(b=>{b.onclick=()=>{
  const i=+b.dataset.tkw,row=b.closest('.row2'),old=row.querySelector('.pv');
  if(old){stopM(old);old.remove();b.innerHTML=tk2I('play','sm');return}
  res.querySelectorAll('.pv').forEach(p=>{stopM(p);const ob=p.closest('.row2').querySelector('[data-tkw]');p.remove();if(ob)ob.innerHTML=tk2I('play','sm')});
  const c=rows[i][0],u=rows[i][4];
  row.insertAdjacentHTML('beforeend','<div class="pv">'+(c==='a'?audHtml(u,true):c==='o'?imgHtml(u):vidHtml(u))+'</div>');
  b.innerHTML=tk2I('x','sm');
  const m=row.querySelector('.pv video,.pv audio');if(m)m.play().catch(()=>{});
 }});
 const thb=res.querySelector('.th'),f1=res.querySelector('[data-tkw]');
 if(thb&&f1&&(rows[0][0]==='h'||rows[0][0]==='v')){thb.style.cursor='pointer';thb.onclick=()=>f1.click()}
}
function tk2Init(r){
 tk2Css();
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx'),pst=$(r,'#tkp');
 const sync=()=>{clr.hidden=!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Memproses...</span>':tk2I('down')+'<span>Ambil video</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const run=async()=>{
  const v=e.value.trim();m.textContent='';
  if(!/^https?:\/\//i.test(v))return bad('Isi link TikTok yang diawali https://');
  setGo(true);res.innerHTML='<div class="sec card skel"><div class="sk" style="width:104px;height:138px"></div><div style="flex:1;display:grid;gap:10px;align-content:start"><div class="sk" style="height:16px"></div><div class="sk" style="height:16px;width:75%"></div><div class="sk" style="height:26px;width:40%"></div></div></div>';
  const j=await api('tiktok-dl2',v,$(r,'#k').value);setGo(false);
  if(!j.ok){bad(j.error||'Gagal.');if(j.code===401)$(r,'#ac').style.display='block';return}
  tk2Card(res,j.data||{})};
 e.oninput=sync;e.onkeydown=ev=>{if(ev.key==='Enter')run()};
 clr.onclick=()=>{e.value='';sync();e.focus()};
 pst.onclick=()=>{if(!navigator.clipboard||!navigator.clipboard.readText){e.focus();return}navigator.clipboard.readText().then(t=>{e.value=t.trim();sync();if(/tiktok\.com/i.test(t))run()}).catch(()=>e.focus())};
 go.onclick=run;sync()}
// AM Preset (NexaDev): cari link preset Alight Motion di komentar, balasan, dan bio video TikTok. Memakai gaya dan ikon TikTok V2 (.tk2).
Object.assign(TK2P,{user:'<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
heart:'<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 5 6.6 5c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.2 0 5.1 3 3.9 6.3-1.8 4.6-9.3 9.2-9.3 9.2z"/>',chat:'<path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.4A8 8 0 1121 12z"/>',
ext:'<path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>',pin:'<path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3z"/>',scan:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
code:'<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7.5L12 12.5l8.7-5M12 22V12.5"/>',star:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
badge:'<path d="M12 2l2.4 2.1 3.2-.2.9 3.1 2.7 1.8-1 3 1 3-2.7 1.8-.9 3.1-3.2-.2L12 22l-2.4-2.1-3.2.2-.9-3.1L2.8 15l1-3-1-3 2.7-1.8.9-3.1 3.2.2z"/><path d="M9 12l2 2 4-4"/>'});
function ampCss(){tk2Css();if(document.getElementById('ampcss'))return;const s=document.createElement('style');s.id='ampcss';
 s.textContent='.amp a.tkb{text-decoration:none}.amp .acr{display:flex;align-items:center;gap:12px;padding:14px}.amp .aav{width:48px;height:48px;border-radius:50%;background:var(--s3);flex:none;display:grid;place-items:center;overflow:hidden;color:var(--dm);border:1px solid var(--ln2)}.amp .aav img{width:100%;height:100%;object-fit:cover;display:block}'
 +'.amp .acr .anm{min-width:0;flex:1}.amp .acr b{display:block;font-size:15px;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.amp .acr small{display:block;color:var(--mu);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
 +'.amp .avd{display:flex;gap:12px;padding:0 14px 14px}.amp .avd .th{width:76px;align-self:flex-start}.amp .avd .avt{min-width:0;flex:1}.amp .avd p{margin:0;font-size:13px;color:var(--mu);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}.amp .ast{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.amp .ast .tag .tk2i{color:var(--ac2)}'
 +'.amp .tabs{display:flex;gap:8px;flex-wrap:wrap;padding:2px 4px 2px}.amp .tab{height:34px;padding:0 13px;margin:0;border-radius:99px;border:1px solid var(--ln);background:var(--bg);color:var(--mu);font-weight:600;font-size:12.5px;font-family:inherit;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.amp .tab.on{background:rgba(124,92,255,.18);border-color:var(--ac);color:#d6ccff}'
 +'.amp .apr{padding:14px;background:var(--bg);border:1px solid var(--ln);border-radius:14px;display:grid;gap:12px;transition:.15s}.amp .apr:hover{border-color:var(--ln2)}.amp .apr[hidden]{display:none}.amp .apr .atop{display:flex;align-items:center;gap:12px}'
 +'.amp .apr .tg{margin:0;display:flex;flex-wrap:wrap;gap:6px}.amp .apr .tag .tk2i{color:#a794ff}.amp .apr .dt{margin:0;font-size:13px;color:var(--mu);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}'
 +'.amp .apr .abt{display:flex;gap:8px}.amp .apr .tkb.main{flex:1;justify-content:center}.amp .none{padding:18px;text-align:center;color:var(--dm);font-size:13px}';
 document.head.appendChild(s)}
function ampHtml(){return `<div class="tk2 amp"><div class="card form"><div class="fld">${tk2I('link')}<input id="e" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://vt.tiktok.com/..." aria-label="Link TikTok"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button><button type="button" class="ib" id="tkp" aria-label="Tempel">${tk2I('paste','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('scan')}<span>Cari preset</span></button>
<div class="chips"><span class="chip">${tk2I('chat')}Komentar dan balasan</span><span class="chip">${tk2I('code')}XML</span><span class="chip">${tk2I('box')}5MB</span></div></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
const ampN=v=>{v=Number(v)||0;const f=(x,u)=>(Math.round(x*10)/10).toString().replace('.',',')+' '+u;return v>=1e6?f(v/1e6,'jt'):v>=1e3?f(v/1e3,'rb'):String(v)};
const ampSrc={comment:'Komentar',reply:'Balasan',bio:'Bio',author:'Bio'};
// Susun tampilan hasil (HTML saja, tanpa menyentuh DOM)
function ampResult(d){
 const a=d.penulis||{},v=d.video||{},ps=Array.isArray(d.preset)?d.preset.filter(p=>p&&/^https:/.test(p.unduh||'')):[],sc=d.dipindai||{};
 if(!ps.length)return`<div class="sec err" role="alert">${tk2I('alert')}<div>Tidak ada link preset di video ini.</div></div>`;
 const kinds=[...new Set(ps.map(p=>p.jenis))],lab=k=>k==='5mb'?'5MB':String(k||'xml').toUpperCase();
 const av=a.avatar&&/^https:/.test(a.avatar)?`<img src="${esc(a.avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:tk2I('user');
 const cv=v.cover&&/^https:/.test(v.cover)?`<img src="${esc(v.cover)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:tk2I('video');
 const tabs=kinds.length>1?`<div class="tabs" role="tablist"><button type="button" class="tab on" data-ft="all">${tk2I('star','sm')}Semua ${ps.length}</button>${kinds.map(k=>`<button type="button" class="tab" data-ft="${esc(k)}">${tk2I(k==='5mb'?'box':'code','sm')}${lab(k)} ${ps.filter(p=>p.jenis===k).length}</button>`).join('')}</div>`:'';
 const rows=ps.map((p,i)=>`<div class="apr" data-t="${esc(p.jenis)}"><div class="atop"><div class="ico ${p.jenis==='5mb'?'h':'v'}">${tk2I(p.jenis==='5mb'?'box':'code')}</div><div class="rt"><b>Preset ${lab(p.jenis)}</b><small>${p.pengirim?esc(p.pengirim):'Tanpa nama'}</small></div></div>
<div class="tg"><span class="tag">${tk2I('chat','sm')}${esc(ampSrc[p.sumber]||(p.sumber?p.sumber.charAt(0).toUpperCase()+p.sumber.slice(1):'Komentar'))}</span>${p.pin?`<span class="tag">${tk2I('pin','sm')}Disematkan</span>`:''}${p.kreator?`<span class="tag">${tk2I('badge','sm')}Dari kreator</span>`:''}</div>
${p.detail?`<p class="dt">${esc(p.detail)}</p>`:''}
<div class="abt"><a class="tkb main" href="${esc(p.unduh)}" target="_blank" rel="noopener noreferrer">${tk2I('down','sm')}<span>Unduh</span></a><a class="tkb g" href="${esc(p.url||p.unduh)}" target="_blank" rel="noopener noreferrer" aria-label="Buka tautan" title="Buka tautan">${tk2I('ext','sm')}</a><button type="button" class="tkb g" data-ampc="${i}" aria-label="Salin link" title="Salin link">${tk2I('copy','sm')}</button></div></div>`).join('');
 return`<section class="sec card res"><div class="acr"><div class="aav">${av}</div><div class="anm"><b>${esc(a.nama||a.username||'Kreator TikTok')}</b><small>${a.username?'@'+esc(a.username):''}</small></div><span class="tag">${tk2I('check','sm')}${ps.length} preset</span></div>
<div class="avd"><div class="th">${cv}</div><div class="avt"><p>${esc(v.judul||'Video TikTok')}</p><div class="ast"><span class="tag">${tk2I('eye','sm')}${ampN(v.tayang)}</span><span class="tag">${tk2I('heart','sm')}${ampN(v.suka)}</span><span class="tag">${tk2I('chat','sm')}${ampN(v.komentar)}</span></div></div></div>
<div class="dl"><div class="dlt">Preset ditemukan${sc.komentar||sc.balasan?' · '+(sc.komentar||0)+' komentar, '+(sc.balasan||0)+' balasan dipindai':''}</div>${tabs}${rows}</div></section>`}
function ampCard(res,d){
 res.innerHTML=ampResult(d);res.querySelectorAll('.card').forEach(c=>{c.dataset.fx='1'});const ps=(d.preset||[]).filter(p=>p&&/^https:/.test(p.unduh||''));
 res.querySelectorAll('img').forEach(i=>{i.onerror=()=>i.remove()});
 res.querySelectorAll('[data-ft]').forEach(b=>{b.onclick=()=>{res.querySelectorAll('[data-ft]').forEach(x=>x.classList.toggle('on',x===b));res.querySelectorAll('.apr').forEach(r=>{r.hidden=b.dataset.ft!=='all'&&r.dataset.t!==b.dataset.ft})}});
 res.querySelectorAll('[data-ampc]').forEach(b=>{b.onclick=()=>{const u=ps[+b.dataset.ampc].unduh,ok=()=>{b.innerHTML=tk2I('check','sm');setTimeout(()=>{b.innerHTML=tk2I('copy','sm')},1200)};(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(ok,()=>{})}})}
function ampInit(r){
 ampCss();
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx'),pst=$(r,'#tkp');
 const sync=()=>{clr.hidden=!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Memindai komentar...</span>':tk2I('scan')+'<span>Cari preset</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const run=async()=>{
  const v=e.value.trim();m.textContent='';
  if(!/^https?:\/\//i.test(v))return bad('Isi link TikTok yang diawali https://');
  setGo(true);res.innerHTML='<div class="sec card skel"><div class="sk" style="width:48px;height:48px;border-radius:50%"></div><div style="flex:1;display:grid;gap:10px;align-content:start"><div class="sk" style="height:16px;width:55%"></div><div class="sk" style="height:14px"></div><div class="sk" style="height:14px;width:70%"></div><div class="sk" style="height:38px;margin-top:6px"></div></div></div>';
  const j=await api('am-preset',v,$(r,'#k').value);setGo(false);
  if(!j.ok){bad(j.error||'Gagal.');if(j.code===401)$(r,'#ac').style.display='block';return}
  ampCard(res,j.data||{})};
 e.oninput=sync;e.onkeydown=ev=>{if(ev.key==='Enter')run()};
 clr.onclick=()=>{e.value='';sync();e.focus()};
 pst.onclick=()=>{if(!navigator.clipboard||!navigator.clipboard.readText){e.focus();return}navigator.clipboard.readText().then(t=>{e.value=t.trim();sync();if(/tiktok\.com/i.test(t))run()}).catch(()=>e.focus())};
 go.onclick=run;sync()}
// Cari Komik (NexaDev, kategori Anime): cari judul komik, tampil kartu cover dengan rating. Memakai gaya dan ikon TikTok V2 (.tk2).
Object.assign(TK2P,{book:'<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',sort:'<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',layers:'<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'});
function kmkCss(){tk2Css();if(document.getElementById('kmkcss'))return;const s=document.createElement('style');s.id='kmkcss';
 s.textContent='.kmk .kh{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}.kmk .kh b{display:block;font-size:15px;color:var(--tx)}.kmk .kh small{color:var(--mu);font-size:12.5px}'
 +'.kmk .tabs{display:flex;gap:8px}.kmk .tab{height:34px;padding:0 13px;margin:0;border-radius:99px;border:1px solid var(--ln);background:var(--bg);color:var(--mu);font-weight:600;font-size:12.5px;font-family:inherit;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.kmk .tab.on{background:rgba(124,92,255,.18);border-color:var(--ac);color:#d6ccff}'
 +'.kmk .kg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(min-width:560px){.kmk .kg{grid-template-columns:repeat(3,minmax(0,1fr))}}'
 +'.kmk .kc{display:flex;flex-direction:column;background:linear-gradient(180deg,var(--s2),var(--s1));border:1px solid var(--ln);border-radius:16px;overflow:hidden;text-decoration:none;color:var(--tx);box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 14px 30px -16px rgba(0,0,0,.8);transition:.15s;animation:tk2up .35s ease both}.kmk .kc:hover{transform:translateY(-2px);border-color:var(--ln2)}'
 +'.kmk .cv{position:relative;aspect-ratio:3/4;background:var(--s3);display:grid;place-items:center;color:var(--dm)}.kmk .cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}'
 +'.kmk .rt2{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,.62);color:#fde68a;font-size:12px;font-weight:700;padding:4px 8px;border-radius:99px}.kmk .rt2 .tk2i{width:13px;height:13px;fill:#fde68a;stroke:#fde68a}'
 +'.kmk .kb{padding:10px 11px 12px;display:grid;gap:8px}.kmk .kb b{font-size:13px;line-height:1.35;font-weight:600;color:var(--tx);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;min-height:2.7em}'
 +'.kmk .km{display:flex;flex-wrap:wrap;gap:5px}.kmk .km span{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--mu);background:var(--bg);border:1px solid var(--ln);padding:3px 8px;border-radius:99px}.kmk .km .tk2i{width:12px;height:12px;color:var(--ac2)}'
 +'.kmk .rd{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--ac),#5b8cff);color:#fff;font-size:12.5px;font-weight:600}'
 +'.kmk .nt{display:flex;gap:8px;align-items:flex-start;margin:12px 2px 0;font-size:12px;color:var(--dm);line-height:1.5}.kmk .nt .tk2i{width:15px;height:15px;margin-top:2px}';
 document.head.appendChild(s)}
function kmkHtml(){return `<div class="tk2 kmk"><div class="card form"><div class="fld">${tk2I('scan')}<input id="e" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Cari judul komik, contoh: nano" aria-label="Judul komik"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('book')}<span>Cari komik</span></button>
<div class="chips"><span class="chip">${tk2I('img')}Cover</span><span class="chip">${tk2I('star')}Rating</span><span class="chip">${tk2I('book')}Komikindo</span></div>
<p class="nt">${tk2I('info')}<span>Hasil diambil apa adanya dari Komikindo. Sebagian judul bisa berkonten dewasa (18+).</span></p></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function kmkGrid(list){return list.map((k,i)=>`<a class="kc" style="animation-delay:${Math.min(i,12)*30}ms" href="${esc(k.link)}" target="_blank" rel="noopener noreferrer"><div class="cv">${tk2I('book')}${k.cover&&/^https:/.test(k.cover)?`<img src="${esc(k.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}${k.rating?`<span class="rt2">${tk2I('star')}${Number(k.rating).toFixed(1).replace('.',',')}</span>`:''}</div><div class="kb"><b>${esc(k.judul)}</b>${k.jenis||k.bab?`<div class="km">${k.jenis?`<span>${tk2I('layers')}${esc(k.jenis)}</span>`:''}${k.bab?`<span>${tk2I('clock')}${esc(k.bab)}</span>`:''}</div>`:''}<span class="rd">${tk2I('book','sm')}Baca${tk2I('ext','sm')}</span></div></a>`).join('')}
function kmkResult(d,mode){
 const all=Array.isArray(d.hasil)?d.hasil.filter(k=>k&&k.judul&&/^https:/.test(k.link||'')):[];
 if(!all.length)return`<div class="sec err" role="alert">${tk2I('alert')}<div>Komik tidak ditemukan. Coba judul lain.</div></div>`;
 const list=mode==='rt'?all.slice().sort((a,b)=>(b.rating||0)-(a.rating||0)):all;
 return`<section class="sec"><div class="kh"><div><b>${all.length} komik</b><small>untuk “${esc(d.kata||'')}” · ${esc(d.sumber||'Komikindo')}</small></div><div class="tabs" role="tablist"><button type="button" class="tab${mode==='rt'?'':' on'}" data-ks="src">${tk2I('sort','sm')}Urutan</button><button type="button" class="tab${mode==='rt'?' on':''}" data-ks="rt">${tk2I('star','sm')}Rating</button></div></div><div class="kg">${kmkGrid(list)}</div></section>`}
function kmkCard(res,d){
 const draw=mode=>{res.innerHTML=kmkResult(d,mode);res.querySelectorAll('img').forEach(i=>{i.onerror=()=>i.remove()});res.querySelectorAll('[data-ks]').forEach(b=>{b.onclick=()=>{if(!b.classList.contains('on'))draw(b.dataset.ks)}})};
 draw('src')}
function kmkInit(r){
 kmkCss();
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx');
 const sync=()=>{clr.hidden=!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Mencari...</span>':tk2I('book')+'<span>Cari komik</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const run=async()=>{
  const v=e.value.trim();m.textContent='';
  if(v.length<2)return bad('Isi judul komik minimal 2 huruf.');
  setGo(true);res.innerHTML='<div class="sec kg">'+'<div class="card" style="aspect-ratio:3/4.6"><div class="sk" style="width:100%;height:100%"></div></div>'.repeat(4)+'</div>';
  const j=await api('komik-search',v,$(r,'#k').value);setGo(false);
  if(!j.ok){bad(j.error||'Gagal.');if(j.code===401)$(r,'#ac').style.display='block';return}
  kmkCard(res,j.data||{})};
 e.oninput=sync;e.onkeydown=ev=>{if(ev.key==='Enter')run()};
 clr.onclick=()=>{e.value='';sync();e.focus()};
 go.onclick=run;sync()}
// Search Anime (GenCipta, kategori Anime): cari judul anime, tampil kartu poster dengan rating, status, dan genre. UI dark elevated (basis .tk2).
Object.assign(TK2P,{tv:'<rect x="2" y="7" width="20" height="14" rx="3"/><path d="M8 2l4 5 4-5"/>',tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5"/>',spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'});
function aniCss(){tk2Css();if(document.getElementById('anicss'))return;const s=document.createElement('style');s.id='anicss';
 s.textContent='.ani .hero{display:flex;align-items:center;gap:12px;padding:14px 14px 0}.ani .hero .hi{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--ac),#5b8cff 60%,var(--ac2));box-shadow:0 10px 22px -10px rgba(124,92,255,.9),0 1px 0 rgba(255,255,255,.3) inset;flex:none}.ani .hero b{display:block;font-size:16px;color:var(--tx)}.ani .hero small{color:var(--mu);font-size:12.5px;line-height:1.4}'
 +'.ani .sg{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ani .sgb{height:32px;padding:0 12px;margin:0;border-radius:99px;border:1px solid var(--ln);background:var(--bg);color:var(--mu);font:inherit;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:.15s}.ani .sgb:hover{color:var(--tx);border-color:var(--ln2);transform:translateY(-1px)}.ani .sgb .tk2i{width:14px;height:14px;color:var(--ac2)}'
 +'.ani .bar{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}.ani .bar b{display:block;font-size:15px;color:var(--tx)}.ani .bar small{color:var(--mu);font-size:12.5px}.ani .bar em{font-style:normal;color:#d6ccff}'
 +'.ani .tabs{display:flex;gap:6px;flex-wrap:wrap}.ani .tab{height:34px;padding:0 13px;margin:0;border-radius:99px;border:1px solid var(--ln);background:var(--bg);color:var(--mu);font-weight:600;font-size:12.5px;font-family:inherit;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:.15s}.ani .tab:hover{color:var(--tx)}.ani .tab.on{background:rgba(124,92,255,.18);border-color:var(--ac);color:#d6ccff;box-shadow:0 0 0 3px rgba(124,92,255,.12)}.ani .tab .n{font-size:11px;opacity:.75}'
 +'.ani .ag{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media(min-width:640px){.ani .ag{grid-template-columns:repeat(2,minmax(0,1fr))}}'
 +'.ani .ac{display:flex;gap:13px;padding:12px;background:linear-gradient(180deg,var(--s2),var(--s1));border:1px solid var(--ln);border-radius:18px;text-decoration:none;color:var(--tx);box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 16px 34px -18px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.35);transition:.18s;animation:tk2up .35s ease both}.ani .ac:hover{transform:translateY(-3px);border-color:var(--ln2);box-shadow:0 1px 0 rgba(255,255,255,.07) inset,0 22px 40px -16px rgba(0,0,0,.9),0 0 0 1px rgba(124,92,255,.25)}'
 +'.ani .pv{position:relative;width:96px;aspect-ratio:3/4.2;border-radius:14px;overflow:hidden;background:var(--s3);border:1px solid var(--ln);flex:none;display:grid;place-items:center;color:var(--dm)}.ani .pv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}.ani .pv::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.55));pointer-events:none}'
 +'.ani .rt2{position:absolute;left:6px;bottom:6px;z-index:1;display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,.68);color:#fde68a;font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:99px}.ani .rt2 .tk2i{width:12px;height:12px;fill:#fde68a;stroke:#fde68a}'
 +'.ani .ab{min-width:0;flex:1;display:flex;flex-direction:column;gap:9px}.ani .ab h3{margin:0;font-size:14.5px;line-height:1.4;font-weight:600;color:var(--tx);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}'
 +'.ani .st{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:99px;border:1px solid var(--ln);background:var(--bg);color:var(--mu)}.ani .st i{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}.ani .st.on{color:#34d399;background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.25)}.ani .st.ok{color:#22d3ee;background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.25)}.ani .st.dr{color:#f87171;background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.25)}'
 +'.ani .gn{display:flex;flex-wrap:wrap;gap:5px}.ani .gn span{display:inline-flex;align-items:center;font-size:11px;color:var(--mu);background:var(--bg);border:1px solid var(--ln);padding:3px 9px;border-radius:99px}'
 +'.ani .go2{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--ac),#5b8cff);color:#fff;font-size:12.5px;font-weight:600;box-shadow:0 8px 18px -8px rgba(124,92,255,.8)}'
 +'.ani .nt{display:flex;gap:8px;align-items:flex-start;margin:12px 2px 0;font-size:12px;color:var(--dm);line-height:1.5}.ani .nt .tk2i{width:15px;height:15px;margin-top:2px}'
 +'.ani .empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:26px 16px;color:var(--mu);font-size:13.5px}.ani .empty .tk2i{width:30px;height:30px;color:var(--dm)}'
 +'@media(max-width:380px){.ani .pv{width:82px}}';
 document.head.appendChild(s)}
function aniHtml(){return `<div class="tk2 ani"><div class="card form"><div class="fld">${tk2I('scan')}<input id="e" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Cari judul anime, contoh: naruto" aria-label="Judul anime"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('tv')}<span>Cari anime</span></button>
<div class="sg" aria-label="Coba cari">${['Naruto','One Piece','Bleach','Jujutsu Kaisen'].map(x=>`<button type="button" class="sgb" data-q="${x}">${tk2I('spark')}${x}</button>`).join('')}</div>
<div class="chips"><span class="chip">${tk2I('img')}Poster</span><span class="chip">${tk2I('star')}Rating</span><span class="chip">${tk2I('tag')}Genre</span><span class="chip">${tk2I('tv')}Otakudesu</span></div>
<p class="nt">${tk2I('info')}<span>Hasil diambil apa adanya dari Otakudesu. Tombol Tonton membuka halaman anime di situs sumber.</span></p></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function aniStat(t){const x=String(t||'').toLowerCase();return/ongoing|tayang|berjalan/.test(x)?['on','Tayang']:/complete|tamat|selesai|finish/.test(x)?['ok','Tamat']:/drop/.test(x)?['dr','Drop']:['',String(t||'')]}
function aniGrid(list){return list.map((a,i)=>{const st=aniStat(a.status);return`<a class="ac" style="animation-delay:${Math.min(i,12)*30}ms" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer"><div class="pv">${tk2I('tv')}${a.poster&&/^https:/.test(a.poster)?`<img src="${esc(a.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}${a.rating?`<span class="rt2">${tk2I('star')}${Number(a.rating).toFixed(1).replace('.',',')}</span>`:''}</div><div class="ab"><h3>${esc(a.judul)}</h3>${st[1]?`<span class="st ${st[0]}"><i></i>${esc(st[1])}</span>`:''}${a.genre&&a.genre.length?`<div class="gn">${a.genre.slice(0,5).map(g=>`<span>${esc(g)}</span>`).join('')}</div>`:''}<span class="go2">${tk2I('play','sm')}Tonton${tk2I('ext','sm')}</span></div></a>`}).join('')}
function aniResult(d,sf,mode){
 const all=Array.isArray(d.hasil)?d.hasil.filter(a=>a&&a.judul&&/^https:/.test(a.link||'')):[];
 if(!all.length)return`<div class="sec err" role="alert">${tk2I('alert')}<div>Anime tidak ditemukan. Coba judul lain.</div></div>`;
 const keys=['on','ok','dr'],cnt={on:0,ok:0,dr:0};all.forEach(a=>{const k=aniStat(a.status)[0];if(cnt[k]!=null)cnt[k]++});
 let list=sf?all.filter(a=>aniStat(a.status)[0]===sf):all;if(mode==='rt')list=list.slice().sort((a,b)=>(b.rating||0)-(a.rating||0));
 const lbl={on:'Tayang',ok:'Tamat',dr:'Drop'},tb=(k,ic,t,n)=>`<button type="button" class="tab${sf===k?' on':''}" data-af="${k}">${ic?tk2I(ic,'sm'):''}${t}${n!=null?` <span class="n">${n}</span>`:''}</button>`;
 return`<section class="sec"><div class="bar"><div><b>${all.length} anime</b><small>untuk “<em>${esc(d.kata||'')}</em>” · Otakudesu</small></div><div class="tabs" role="tablist">${tb('', 'layers','Semua',all.length)}${keys.filter(k=>cnt[k]).map(k=>tb(k,'',lbl[k],cnt[k])).join('')}<button type="button" class="tab${mode==='rt'?' on':''}" data-am="rt">${tk2I('star','sm')}Rating</button></div></div>${list.length?`<div class="ag">${aniGrid(list)}</div>`:`<div class="card empty">${tk2I('filter')}<span>Tidak ada anime dengan status ini.</span></div>`}</section>`}
function aniCard(res,d){
 let sf='',mode='src';
 const draw=()=>{res.innerHTML=aniResult(d,sf,mode);res.querySelectorAll('img').forEach(i=>{i.onerror=()=>i.remove()});
  res.querySelectorAll('[data-af]').forEach(b=>{b.onclick=()=>{sf=b.dataset.af;draw()}});
  res.querySelectorAll('[data-am]').forEach(b=>{b.onclick=()=>{mode=mode==='rt'?'src':'rt';draw()}})};
 draw()}
function aniInit(r){
 aniCss();
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx');
 const sync=()=>{clr.hidden=!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Mencari...</span>':tk2I('tv')+'<span>Cari anime</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const run=async()=>{
  const v=e.value.trim();m.textContent='';
  if(v.length<2)return bad('Isi judul anime minimal 2 huruf.');
  setGo(true);res.innerHTML='<div class="sec ag">'+'<div class="card skel"><div class="sk" style="width:96px;height:134px;border-radius:14px"></div><div style="flex:1;display:grid;gap:10px;align-content:start"><div class="sk" style="height:16px;width:80%"></div><div class="sk" style="height:22px;width:35%"></div><div class="sk" style="height:14px"></div><div class="sk" style="height:36px;margin-top:6px"></div></div></div>'.repeat(4)+'</div>';
  const j=await api('anime-search',v,$(r,'#k').value);setGo(false);
  if(!j.ok){bad(j.error||'Gagal.');if(j.code===401)$(r,'#ac').style.display='block';return}
  aniCard(res,j.data||{})};
 e.oninput=sync;e.onkeydown=ev=>{if(ev.key==='Enter')run()};
 clr.onclick=()=>{e.value='';sync();e.focus()};
 r.querySelectorAll('[data-q]').forEach(b=>{b.onclick=()=>{e.value=b.dataset.q;sync();run()}});
 go.onclick=run;sync()}
/* Anime Ongoing + Completed: daftar anime per halaman. Tampilan memakai kelas yang sama dengan Search Anime (aniCss). Input API = nomor halaman. */
const ONG_D=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu','Random'];
const ONG_T={'anime-ongoing':{done:false,ph:'Filter judul di daftar tayang',lead:'Daftar rilisan anime yang sedang tayang, diambil apa adanya dari Otakudesu. Tombol Tonton membuka halaman anime di situs sumber.',chips:[['img','Poster'],['play','Episode terbaru'],['clock','Hari rilis'],['tv','Otakudesu']],cnt:'anime tayang',empty:'Belum ada anime tayang yang bisa ditampilkan.'},
 'anime-completed':{done:true,ph:'Filter judul di daftar tamat',lead:'Daftar anime yang sudah tamat, diambil apa adanya dari Otakudesu. Tombol Tonton membuka halaman anime di situs sumber.',chips:[['img','Poster'],['layers','Jumlah episode'],['star','Rating'],['tv','Otakudesu']],cnt:'anime tamat',empty:'Belum ada anime tamat yang bisa ditampilkan.'}};
function ongHtml(id){const c=ONG_T[id];return `<div class="tk2 ani"><div class="card form"><div class="fld">${tk2I('scan')}<input id="e" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${c.ph}" aria-label="Filter judul anime"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('tv')}<span>Muat ulang</span></button>
<div class="chips">${c.chips.map(x=>`<span class="chip">${tk2I(x[0])}${x[1]}</span>`).join('')}</div>
<p class="nt">${tk2I('info')}<span>${c.lead}</span></p></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function ongEps(v){const x=String(v||'').trim(),n=x.match(/^(\d+)(?:\s*episode)?$/i);return n?n[1]+' eps':x.replace(/^Episode\s*/i,'Eps ')}
function ongGrid(list,done){return list.map((a,i)=>{const bd=done&&a.rating?`${tk2I('star')}${Number(a.rating).toFixed(1).replace('.',',')}`:a.episode?`${tk2I('play','sm')}${esc(ongEps(a.episode))}`:'';
 const pill=done?`<span class="st ok"><i></i>Tamat${a.episode?' · '+esc(ongEps(a.episode)):''}</span>`:a.hari?`<span class="st on"><i></i>${a.hari==='Random'?'Jadwal acak':'Tiap '+esc(a.hari)}</span>`:'';
 return`<a class="ac" style="animation-delay:${Math.min(i,12)*30}ms" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer"><div class="pv">${tk2I('tv')}${a.poster&&/^https:/.test(a.poster)?`<img src="${esc(a.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}${bd?`<span class="rt2">${bd}</span>`:''}</div><div class="ab"><h3>${esc(a.judul)}</h3>${pill}<span class="go2">${tk2I('play','sm')}Tonton${tk2I('ext','sm')}</span></div></a>`}).join('')}
function ongResult(st){
 const c=ONG_T[st.id],all=st.list;
 if(!all.length)return`<div class="sec err" role="alert">${tk2I('alert')}<div>${c.empty}</div></div>`;
 const q=st.q.trim().toLowerCase(),base=q?all.filter(a=>a.judul.toLowerCase().includes(q)):all,cnt={};
 if(!c.done)base.forEach(a=>{cnt[a.hari]=(cnt[a.hari]||0)+1});
 const days=ONG_D.filter(d=>cnt[d]),day=days.includes(st.day)?st.day:'',srt=c.done&&st.mode==='rt',f=day?base.filter(a=>a.hari===day):base,list=srt?f.slice().sort((a,b)=>(b.rating||0)-(a.rating||0)):f;
 const tb=(k,t,n)=>`<button type="button" class="tab${day===k?' on':''}" data-od="${k}">${t} <span class="n">${n}</span></button>`;
 const tabs=c.done?`<button type="button" class="tab${srt?' on':''}" data-om="rt">${tk2I('star','sm')}Rating</button>`:`${tb('','Semua',base.length)}${days.map(d=>tb(d,d,cnt[d])).join('')}`;
 return`<section class="sec"><div class="bar"><div><b>${base.length} ${c.cnt}</b><small>${q?'untuk “<em>'+esc(st.q.trim())+'</em>” · ':''}Otakudesu · ${st.page} halaman dimuat</small></div><div class="tabs" role="tablist">${tabs}</div></div>${list.length?`<div class="ag">${ongGrid(list,c.done)}</div>`:`<div class="card empty">${tk2I('filter')}<span>Tidak ada anime yang cocok.</span></div>`}${st.next?`<div style="margin-top:14px"><button type="button" class="gob" id="more">${tk2I('down')}<span>Muat lebih banyak</span></button></div>`:''}</section>`}
function ongInit(r,id){
 aniCss();
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx'),st={id,list:[],day:'',mode:'src',q:'',page:0,next:false};
 const sync=()=>{clr.hidden=!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Memuat...</span>':tk2I('tv')+'<span>Muat ulang</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const draw=()=>{res.innerHTML=ongResult(st);res.querySelectorAll('img').forEach(i=>{i.onerror=()=>i.remove()});
  res.querySelectorAll('[data-od]').forEach(b=>{b.onclick=()=>{st.day=b.dataset.od;draw()}});
  res.querySelectorAll('[data-om]').forEach(b=>{b.onclick=()=>{st.mode=st.mode==='rt'?'src':'rt';draw()}});
  const mb=res.querySelector('#more');if(mb)mb.onclick=()=>{mb.disabled=true;mb.innerHTML=tk2I('loader','spin')+'<span>Memuat...</span>';load(st.page+1,true)}};
 const load=async(p,add)=>{
  m.textContent='';
  if(!add){setGo(true);res.innerHTML='<div class="sec ag">'+'<div class="card skel"><div class="sk" style="width:96px;height:134px;border-radius:14px"></div><div style="flex:1;display:grid;gap:10px;align-content:start"><div class="sk" style="height:16px;width:80%"></div><div class="sk" style="height:22px;width:35%"></div><div class="sk" style="height:14px"></div><div class="sk" style="height:36px;margin-top:6px"></div></div></div>'.repeat(4)+'</div>'}
  const j=await api(id,String(p),$(r,'#k').value);if(!add)setGo(false);
  if(!j.ok){if(j.code===401)$(r,'#ac').style.display='block';if(add){m.textContent=j.error||'Gagal memuat halaman berikutnya.';draw()}else bad(j.error||'Gagal.');return}
  const d=j.data||{},h=Array.isArray(d.hasil)?d.hasil.filter(a=>a&&a.judul&&/^https:/.test(a.link||'')):[];
  if(add){const seen=new Set(st.list.map(a=>a.link));h.forEach(a=>{if(!seen.has(a.link))st.list.push(a)})}else{st.list=h;st.day=''}
  st.page=p;st.next=d.adaLagi===true;draw()};
 e.oninput=()=>{sync();st.q=e.value;if(st.list.length)draw()};e.onkeydown=ev=>{if(ev.key==='Enter')e.blur()};
 clr.onclick=()=>{e.value='';st.q='';sync();e.focus();if(st.list.length)draw()};
 go.onclick=()=>load(1,false);sync();load(1,false)}
/* Anime Episode: ambil server streaming, mirror, dan unduhan satu episode Otakudesu lewat slug atau link episode. Tampilan memakai kelas Search Anime (aniCss) plus gaya .ep. Server dibuka di tab baru (iframe pihak ketiga tidak diizinkan oleh CSP). */
Object.assign(TK2P,{epPrv:'<path d="M15 18l-6-6 6-6"/>',epNxt:'<path d="M9 18l6-6-6-6"/>',epFilm:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 4v5M16 4v5"/><path d="M10.5 13.2l4 2.4-4 2.4z"/>',epSrv:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>'});
function epCss(){aniCss();if(document.getElementById('epcss'))return;const s=document.createElement('style');s.id='epcss';
 s.textContent='.ep .eh{display:flex;align-items:center;gap:12px;margin-bottom:12px}.ep .ehi{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--ac),#5b8cff 60%,var(--ac2));box-shadow:0 10px 22px -10px rgba(124,92,255,.9),0 1px 0 rgba(255,255,255,.3) inset;flex:none}.ep .eh h3{margin:0;font-size:16px;line-height:1.35;color:var(--tx);word-break:break-word}.ep .eh small{display:block;margin-top:3px;color:var(--mu);font-size:12.5px}'
 +'.ep .ea{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.ep .ea a{flex:1 1 150px;text-decoration:none;margin:0}.ep .go3{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;border-radius:11px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font-size:12.5px;font-weight:600}'
 +'.ep .en{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}.ep .en .tab{text-decoration:none}.ep .en .tab[disabled]{opacity:.4;cursor:default}'
 +'.ep .h4{display:flex;align-items:center;gap:7px;margin:16px 2px 10px;font-size:13.5px;font-weight:700;color:var(--tx)}.ep .h4 .tk2i{width:15px;height:15px;color:var(--ac2)}.ep .h4 .n{font-size:11.5px;color:var(--mu);font-weight:600}'
 +'.ep .eg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}@media(min-width:640px){.ep .eg{grid-template-columns:repeat(3,minmax(0,1fr))}}'
 +'.ep .em{display:flex;align-items:center;gap:8px;min-width:0;padding:11px 12px;border-radius:14px;border:1px solid var(--ln);background:linear-gradient(180deg,var(--s2),var(--s1));color:var(--tx);text-decoration:none;font-size:13px;font-weight:600;transition:.15s;animation:tk2up .35s ease both}.ep .em:hover{transform:translateY(-2px);border-color:var(--ln2)}.ep .em span{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ep .em small{display:block;color:var(--mu);font-weight:500;font-size:11px}.ep .em .tk2i{width:14px;height:14px;color:var(--ac2);flex:none}'
 +'.ep .eb{padding:12px;margin-bottom:10px}.ep .eb b{display:block;font-size:13.5px;color:var(--tx);margin-bottom:9px}.ep .el{display:flex;flex-wrap:wrap;gap:6px}.ep .ec{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:99px;border:1px solid var(--ln);background:var(--bg);color:var(--mu);text-decoration:none;font-size:12.5px;font-weight:600;transition:.15s}.ep .ec:hover{color:var(--tx);border-color:var(--ln2)}.ep .ec .tk2i{width:13px;height:13px;color:var(--ac2)}';
 document.head.appendChild(s)}
function epHtml(id){const B=id==='anime-batch';return `<div class="tk2 ani ep"><div class="card form"><div class="fld">${tk2I('link')}<input id="e" type="text" inputmode="url" enterkeyhint="go" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${B?'Slug atau link batch, contoh: boruto-batch-sub-indo':'Slug atau link episode, contoh: boruto-episode-1-sub-indo'}" aria-label="${B?'Slug atau link batch':'Slug atau link episode'}"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button><button type="button" class="ib" id="tkp" aria-label="Tempel">${tk2I('paste','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('epFilm')}<span>${B?'Ambil batch':'Ambil episode'}</span></button>
<div class="chips">${B?`<span class="chip">${tk2I('layers')}Satu paket</span><span class="chip">${tk2I('down')}Unduhan</span><span class="chip">${tk2I('tv')}Otakudesu</span>`:`<span class="chip">${tk2I('play')}Streaming</span><span class="chip">${tk2I('epSrv')}Mirror server</span><span class="chip">${tk2I('down')}Unduhan</span><span class="chip">${tk2I('tv')}Otakudesu</span>`}</div>
<p class="nt">${tk2I('info')}<span>${B?'Slug ada di bagian akhir link batch Otakudesu, misalnya otakudesu.blog/batch/<b>boruto-batch-sub-indo</b>. Link unduhan dibuka di situs sumber.':'Slug ada di bagian akhir link episode Otakudesu, misalnya otakudesu.blog/episode/<b>boruto-episode-1-sub-indo</b>. Server dan unduhan dibuka di situs sumber.'}</span></p></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function epResult(d){
 const hs=u=>/^https:/.test(u||''),mir=(Array.isArray(d.mirror)?d.mirror:[]).filter(x=>x&&hs(x.url)),dl=(Array.isArray(d.unduh)?d.unduh:[]).map(g=>({grup:g&&g.grup,tautan:(g&&Array.isArray(g.tautan)?g.tautan:[]).filter(l=>l&&hs(l.url))})).filter(g=>g.tautan.length),nv=d.nav||{},nd=dl.reduce((a,g)=>a+g.tautan.length,0);
 const lnk=(u,ic,t,cls)=>`<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${tk2I(ic,'sm')}${t}${tk2I('ext','sm')}</a>`;
 const nb=(sl,ic,t,right)=>sl?`<button type="button" class="tab" data-ep="${esc(sl)}">${right?t+tk2I(ic,'sm'):tk2I(ic,'sm')+t}</button>`:`<button type="button" class="tab" disabled>${right?t+tk2I(ic,'sm'):tk2I(ic,'sm')+t}</button>`;
 return`<section class="sec"><div class="eh"><span class="ehi">${tk2I('epFilm')}</span><div><h3>${esc(d.judul||d.slug||'Episode')}</h3><small>Otakudesu · ${mir.length?mir.length+' server · ':''}${nd} link unduhan</small></div></div>`
 +`<div class="ea">${hs(d.stream)?lnk(d.stream,'play','Tonton sekarang','go2'):''}${hs(d.sumber)?lnk(d.sumber,'link','Buka di Otakudesu','go3'):''}</div>`
 +((nv.sebelumnya||nv.berikutnya||hs(nv.semua))?`<div class="en">${nb(nv.sebelumnya,'epPrv','Sebelumnya',false)}${hs(nv.semua)?lnk(nv.semua,'layers','Semua episode','tab'):''}${nb(nv.berikutnya,'epNxt','Berikutnya',true)}</div>`:'')
 +(mir.length?`<div class="h4">${tk2I('epSrv')}Server streaming <span class="n">${mir.length}</span></div><div class="eg">${mir.map((m,i)=>`<a class="em" style="animation-delay:${Math.min(i,12)*30}ms" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${tk2I('play','sm')}<span>${esc(m.nama||'Server '+(i+1))}${m.kualitas?`<small>${esc(m.kualitas)}</small>`:''}</span>${tk2I('ext','sm')}</a>`).join('')}</div>`:'')
 +(dl.length?`<div class="h4">${tk2I('down')}Unduhan <span class="n">${nd}</span></div>${dl.map(g=>`<div class="card eb"><b>${esc(g.grup||'Unduhan')}</b><div class="el">${g.tautan.map(l=>`<a class="ec" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${tk2I('down','sm')}${esc(l.nama||'Unduh')}</a>`).join('')}</div></div>`).join('')}`:'')
 +`</section>`}
function epInit(r,id){
 epCss();const B=id==='anime-batch',LB=B?'Ambil batch':'Ambil episode';
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx'),pst=$(r,'#tkp');
 const sync=()=>{clr.hidden=!e.value;pst.hidden=!!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Mengambil...</span>':tk2I('epFilm')+'<span>'+LB+'</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const run=async()=>{
  const v=e.value.trim();m.textContent='';
  if(!/^(https:\/\/\S{8,300}|[a-z0-9][a-z0-9_-]{2,160})$/i.test(v))return bad(B?'Isi slug batch (contoh: boruto-batch-sub-indo) atau link batch Otakudesu.':'Isi slug episode (contoh: boruto-episode-1-sub-indo) atau link episode Otakudesu.');
  setGo(true);res.innerHTML='<div class="sec"><div class="card skel"><div class="sk" style="width:44px;height:44px;border-radius:14px"></div><div style="flex:1;display:grid;gap:10px;align-content:start"><div class="sk" style="height:16px;width:70%"></div><div class="sk" style="height:36px"></div><div class="sk" style="height:36px"></div></div></div></div>';
  const j=await api(id,v,$(r,'#k').value);setGo(false);
  if(!j.ok){bad(j.error||'Gagal.');if(j.code===401)$(r,'#ac').style.display='block';return}
  res.innerHTML=epResult(j.data||{});
  res.querySelectorAll('[data-ep]').forEach(b=>{b.onclick=()=>{e.value=b.dataset.ep;sync();run()}})};
 e.oninput=sync;e.onkeydown=ev=>{if(ev.key==='Enter')run()};
 clr.onclick=()=>{e.value='';sync();e.focus()};
 pst.onclick=async()=>{try{const t=await navigator.clipboard.readText();if(t){e.value=t.trim();sync();e.focus()}}catch(x){m.textContent='Izin tempel ditolak. Tempel manual ke kolom di atas.'}};
 go.onclick=run;sync()}
/* MangaPlus (api-cloud /komik/mangaplus, type=home): update 24 jam, terbaru, dan ranking. Kartu memakai kelas Search Anime (aniCss). Baca/Buka membuka mangaplus.shueisha.co.jp di tab baru. */
function mpCss(){aniCss();if(document.getElementById('mpcss'))return;const s=document.createElement('style');s.id='mpcss';
 s.textContent='.mp .mpl{display:flex;align-items:center;gap:10px;margin-bottom:12px}.mp .mpl label{font-size:12.5px;color:var(--mu);font-weight:600;flex:none}.mp .mpl select{flex:1;min-width:0;height:42px;padding:0 12px;border-radius:12px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);font:inherit;font-size:14px}.mp .rk{position:absolute;left:6px;top:6px;z-index:1;background:rgba(0,0,0,.7);color:#fff;font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:99px}.mp .bb{color:var(--mu);font-size:12.5px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}.mp .au{color:var(--dm);font-size:11.5px}';
 document.head.appendChild(s)}
function mpHtml(){return `<div class="tk2 ani mp"><div class="card form"><div class="mpl"><label for="lg">Bahasa</label><select id="lg" aria-label="Bahasa"><option value="ind">Indonesia</option><option value="eng">English</option><option value="esp">Español</option><option value="fra">Français</option><option value="por">Português</option><option value="rus">Русский</option><option value="tha">ไทย</option><option value="vie">Tiếng Việt</option><option value="deu">Deutsch</option></select></div>
<div class="fld">${tk2I('scan')}<input id="e" type="text" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Filter judul di daftar" aria-label="Filter judul"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I('epFilm')}<span>Muat ulang</span></button>
<div class="chips"><span class="chip">${tk2I('clock')}Update 24 jam</span><span class="chip">${tk2I('star')}Ranking</span><span class="chip">${tk2I('img')}Cover</span></div>
<p class="nt">${tk2I('info')}<span>Daftar beranda MangaPlus apa adanya dari provider, kadang bercampur beberapa bahasa. Tombol Baca membuka situs resmi MangaPlus.</span></p></div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function mpGrid(list,rank){return list.map((a,i)=>`<a class="ac" style="animation-delay:${Math.min(i,12)*30}ms" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer"><div class="pv">${tk2I('tv')}${a.poster&&/^https:/.test(a.poster)?`<img src="${esc(a.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}${rank?`<span class="rk">#${i+1}</span>`:''}</div><div class="ab"><h3>${esc(a.judul)}</h3>${!rank&&(a.nomor||a.nama)?`<span class="bb">${esc([a.nomor,a.nama].filter(Boolean).join(' · '))}</span>`:''}${a.penulis?`<span class="au">${esc(a.penulis)}</span>`:''}<span class="go2">${tk2I(rank?'link':'play','sm')}${rank?'Buka':'Baca'}${tk2I('ext','sm')}</span></div></a>`).join('')}
function mpResult(st){
 const d=st.data,tabs=[['update','Update 24 jam',d.update],['terbaru','Terbaru',d.terbaru],['ranking','Ranking',d.ranking]].filter(t=>t[2].length),tab=tabs.some(t=>t[0]===st.tab)?st.tab:(tabs[0]||[''])[0];
 if(!tabs.length)return`<div class="sec err" role="alert">${tk2I('alert')}<div>Tidak ada data yang bisa ditampilkan.</div></div>`;
 const q=st.q.trim().toLowerCase(),src=(tabs.find(t=>t[0]===tab)||[])[2]||[],list=q?src.filter(a=>a.judul.toLowerCase().includes(q)):src;
 return`<section class="sec"><div class="bar"><div><b>${list.length} judul</b><small>${q?'untuk “<em>'+esc(st.q.trim())+'</em>” · ':''}MangaPlus</small></div><div class="tabs" role="tablist">${tabs.map(t=>`<button type="button" class="tab${t[0]===tab?' on':''}" data-mt="${t[0]}">${t[1]} <span class="n">${t[2].length}</span></button>`).join('')}</div></div>${list.length?`<div class="ag">${mpGrid(list,tab==='ranking')}</div>`:`<div class="card empty">${tk2I('filter')}<span>Tidak ada judul yang cocok.</span></div>`}</section>`}
function mpInit(r){
 mpCss();
 const e=$(r,'#e'),go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),clr=$(r,'#tkx'),lg=$(r,'#lg'),st={data:null,tab:'update',q:''};
 const sync=()=>{clr.hidden=!e.value},setGo=b=>{go.disabled=b;go.innerHTML=b?tk2I('loader','spin')+'<span>Memuat...</span>':tk2I('epFilm')+'<span>Muat ulang</span>'};
 const bad=t=>{res.innerHTML=`<div class="sec err" role="alert">${tk2I('alert')}<div>${esc(t)}</div></div>`};
 const draw=()=>{res.innerHTML=mpResult(st);res.querySelectorAll('img').forEach(i=>{i.onerror=()=>i.remove()});res.querySelectorAll('[data-mt]').forEach(b=>{b.onclick=()=>{st.tab=b.dataset.mt;draw()}})};
 const run=async()=>{
  m.textContent='';setGo(true);res.innerHTML='<div class="sec ag">'+'<div class="card skel"><div class="sk" style="width:96px;height:134px;border-radius:14px"></div><div style="flex:1;display:grid;gap:10px;align-content:start"><div class="sk" style="height:16px;width:80%"></div><div class="sk" style="height:14px;width:55%"></div><div class="sk" style="height:36px;margin-top:6px"></div></div></div>'.repeat(4)+'</div>';
  const j=await api('mangaplus','',$(r,'#k').value,'',{lang:lg.value});setGo(false);
  if(!j.ok){bad(j.error||'Gagal.');if(j.code===401)$(r,'#ac').style.display='block';return}
  st.data=j.data||{update:[],terbaru:[],ranking:[]};st.tab='update';draw()};
 e.oninput=()=>{sync();st.q=e.value;if(st.data)draw()};e.onkeydown=ev=>{if(ev.key==='Enter')e.blur()};
 clr.onclick=()=>{e.value='';st.q='';sync();e.focus();if(st.data)draw()};
 lg.onchange=run;go.onclick=run;sync();run()}
// Tampilan downloader (gaya TikTok V2) untuk tool berbasis link: kolom link + tempel/hapus, tombol gradien, chip fitur. ID elemen sama dengan emailInit (#e #k #ac #go #m #res).
function dlShell(o){const ch=(o.chips||[]).map(c=>`<span class="chip">${tk2I(c[0])}${c[1]}</span>`).join('');
 return `<div class="tk2"><div class="card form"><div class="fld">${tk2I(o.ic||'link')}<input id="e" type="${o.text?'text':'url'}" inputmode="${o.text?'text':'url'}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${o.val||''}" placeholder="${o.ph||'https://...'}" aria-label="${o.label||'Link'}"><button type="button" class="ib" id="tkx" aria-label="Hapus" hidden>${tk2I('x','sm')}</button><button type="button" class="ib" id="tkp" aria-label="Tempel">${tk2I('paste','sm')}</button></div>
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<button type="button" class="gob" id="go">${tk2I(o.gi||'down')}<span>${o.btn||'Ambil'}</span></button>${ch?`<div class="chips">${ch}</div>`:''}</div>
<p class="msg" id="m" role="status"></p><div id="res"></div></div>`}
function dlWire(r){tk2gCss();const e=$(r,'#e'),clr=$(r,'#tkx'),pst=$(r,'#tkp'),go=$(r,'#go');if(!e||!clr||!pst)return;
 const sync=()=>{clr.hidden=!e.value};e.addEventListener('input',sync);sync();
 clr.onclick=()=>{e.value='';sync();e.focus()};
 pst.onclick=()=>{if(!navigator.clipboard||!navigator.clipboard.readText){e.focus();return}navigator.clipboard.readText().then(t=>{e.value=t.trim();sync();if(/^https?:\/\//i.test(e.value))go.click()}).catch(()=>e.focus())}}
function linkTool(o){return{id:o.id,name:o.name,desc:o.desc,
 html:o.dl?()=>dlShell(o):()=>`<label for="e">${o.label||'Link yang mau dilewati'}</label><input id="e" type="${o.text?'text':'url'}" inputmode="${o.text?'text':'url'}" autocomplete="off" value="${o.val||''}" placeholder="${o.ph||'https://linkvertise.com/...'}">
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="go">${o.btn||'Lewati link'}</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{if(o.dl)dlWire(r);return emailInit(r,o.id,!o.nolink,o.text?(v=>v?'':'Isi dulu.'):(v=>/^https?:\/\//i.test(v)?'':'Isi link yang diawali https://'))}}}
const fmtIn=el=>{el.oninput=()=>{const v=el.value.replace(/\D/g,'').slice(0,13);el.value=v?Number(v).toLocaleString('id-ID'):''}},numVal=el=>Number(el.value.replace(/\D/g,''))||0;
const mkBad=(m,t)=>{m.className='msg bad';m.textContent=t};
const mkImg=(f,cb)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);cb(i)};i.onerror=()=>{URL.revokeObjectURL(u);cb(null)};i.src=u};
const mkLoad=(r,sel,m,cb)=>{$(r,sel).onchange=e=>{const f=e.target.files[0];if(!f)return;if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type))return mkBad(m,'Format harus JPG, PNG, atau WebP.');if(f.size>MAXIN)return mkBad(m,'Ukuran foto maksimal 50 MB.');mkImg(f,i=>{if(!i)return mkBad(m,'Foto tidak bisa dibaca.');m.className='msg';m.textContent='';cb(i)})}};
const mkDl=(cv,name,type,m,msg)=>cv.toBlob(b=>{if(!b)return mkBad(m,'Gagal membuat file.');const n=b.type===type?name:name.replace(/\.\w+$/,'.png'),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);m.className='msg';m.textContent=msg},type,.92);
const mkDrop=(id,t)=>`<label class="drop" for="${id}">${svg(IC.up)}<span><b>${t}</b><span>JPG, PNG, atau WebP.</span></span></label><input id="${id}" type="file" accept="image/*">`;
const mkWrap=(x,t,mw)=>{const o=[];t.split('\n').forEach(p=>{let c='';p.split(/\s+/).forEach(q=>{const n=c?c+' '+q:q;if(c&&x.measureText(n).width>mw){o.push(c);c=q}else c=n});o.push(c)});return o};
const MKGR=[['Hijau malam','#0f766e','#4fd69a'],['Senja','#ff9a4d','#db2777'],['Samudra','#1d4ed8','#06b6d4'],['Ungu neon','#7c3aed','#ec4899'],['Fajar','#ffc83d','#ef4444'],['Gelap','#0a0a0b','#3f3f46']];
const TOOLS_FULL=[
amTool({id:'am-premium',name:'AM Generator',desc:'Aktifkan Alight Motion Pro lewat email verifikasi. Setiap aktivasi memakai 1 koin.',S:'am-send',V:'am-verif'}),
amTool({id:'am-premium2',name:'AM Prem V2',desc:'Aktifkan Alight Motion Pro lewat jalur V2 (Amprem V5): kirim email verifikasi, lalu verifikasi link dari email. Setiap aktivasi memakai 1 koin.',S:'am-send2',V:'am-verif2'}),
linkTool({id:'spotify-play',name:'Spotify Play',desc:'Cari lagu Spotify berdasarkan judul atau artis, lalu putar atau unduh audionya (MP3).',label:'Judul lagu atau artis',ph:'Apa yang ingin kamu putar?',btn:'Cari lagu',text:true}),
linkTool({id:'ig-dl',name:'Instagram Downloader',dl:true,ic:'link',chips:[['img','Foto dan Reels'],['video','Video'],['file','Carousel']],desc:'Unduh foto, video, Reels, atau Carousel Instagram secara instan.',label:'Link Instagram',ph:'https://www.instagram.com/reel/...',btn:'Ambil media'}),
linkTool({id:'mediafire-dl',name:'Mediafire Downloader',dl:true,ic:'link',chips:[['file','Nama dan ukuran file'],['down','Link unduh langsung']],desc:'Ambil link unduh langsung dari URL Mediafire, lengkap dengan nama file, ukuran, dan tipe file.',label:'Link Mediafire',ph:'https://www.mediafire.com/file/...',btn:'Ambil link unduh'}),
linkTool({id:'youtube-dl',name:'YouTube Downloader',dl:true,ic:'link',chips:[['video','Video 360p'],['hd','Resolusi tinggi'],['music','Audio M4A']],desc:'Unduh video YouTube (360p dengan suara, atau resolusi tinggi tanpa suara) dan audio M4A.',label:'Link YouTube',ph:'https://www.youtube.com/watch?v=...',btn:'Ambil video'}),
canvasTool({id:'hapus-background',name:'Hapus Background',desc:'Hapus latar belakang foto otomatis dan hasilkan PNG transparan.',btn:'Hapus background',wait:'Menghapus background, mohon tunggu...',ok:'Gambar transparan siap diunduh.',dl:'hapus-background.png',ba:true,chk:true,lbl:'TRANSPARAN',fields:[{key:'url',label:'Gambar',photo:true,req:true}]}),
canvasTool({id:'tts-google',name:'Google TTS (Gemini)',desc:'Ubah teks menjadi suara natural dengan mesin Gemini milik Google. Hasil berupa audio MP3.',btn:'Buat suara',wait:'Membuat suara...',ok:'Suara siap diputar dan diunduh.',dl:'tts.mp3',audio:true,fields:[{key:'text',label:'Teks',req:true,area:true,max:1000,val:'Konbanwa, genki desu ka?',ph:'Tulis teks yang ingin dibacakan'},{key:'language',label:'Bahasa',select:[['ja-JP','Japanese (ja-JP)'],['id-ID','Indonesian (id-ID)'],['en-US','English US (en-US)'],['en-GB','English UK (en-GB)'],['ko-KR','Korean (ko-KR)'],['zh-CN','Chinese (zh-CN)'],['ar-XA','Arabic (ar-XA)'],['hi-IN','Hindi (hi-IN)'],['es-ES','Spanish (es-ES)'],['fr-FR','French (fr-FR)'],['de-DE','German (de-DE)'],['pt-BR','Portuguese (pt-BR)'],['ru-RU','Russian (ru-RU)'],['th-TH','Thai (th-TH)'],['vi-VN','Vietnamese (vi-VN)'],['tr-TR','Turkish (tr-TR)']]}]}),
canvasTool({id:'ssweb',name:'Website Screenshot',desc:'Tangkap screenshot situs web, bisa satu halaman penuh, dengan tampilan PC, Tablet, atau Android. Prosesnya bisa sampai 30 detik.',btn:'Ambil screenshot',wait:'Mengambil screenshot, mohon tunggu...',ok:'Screenshot siap diunduh.',dl:'screenshot.png',fields:[{key:'url',label:'Link situs',req:true,max:2000,val:'https://',ph:'https://contoh.com'},{key:'viewport',label:'Viewport',select:[['pc','PC'],['tablet','Tablet'],['android','Android']]},{key:'fullpage',label:'Full page',select:[['true','Ya, satu halaman penuh'],['false','Tidak, hanya layar pertama']]}]}),
canvasTool({id:'rch',name:'Reaksi Channel WhatsApp',desc:'Kirim reaksi emoji ke postingan channel WhatsApp. Tempel link postingan (yang ada angka di belakangnya) dan pilih emoji. Tiap kirim memakai 3 koin. Prosesnya bisa sampai 30 detik.',btn:'Kirim reaksi',wait:'Mengirim reaksi, mohon tunggu...',ok:'Reaksi terkirim.',data:true,fields:[{key:'url',label:'Link postingan channel',req:true,max:300,val:'https://whatsapp.com/channel/',ph:'https://whatsapp.com/channel/XXXX/123'},{key:'reaction',label:'Emoji (pisahkan dengan koma, maks. 6)',req:true,max:60,val:'😂,🤣',ph:'😂,🤣,❤️'}]}),
canvasTool({id:'rch2',name:'Reaksi Channel WhatsApp V2',desc:'Kirim reaksi emoji ke postingan channel WhatsApp. Tempel link postingan (yang ada angka di belakangnya) dan pilih emoji. Memakai jalur server lain (maks. 6 emoji). Tiap kirim memakai 3 koin. Prosesnya bisa sampai 30 detik.',btn:'Kirim reaksi',wait:'Mengirim reaksi, mohon tunggu...',ok:'Reaksi terkirim.',data:true,fields:[{key:'url',label:'Link postingan channel',req:true,max:300,val:'https://whatsapp.com/channel/',ph:'https://whatsapp.com/channel/XXXX/123'},{key:'reaction',label:'Emoji (pisahkan dengan koma, maks. 6)',req:true,max:60,val:'😂,🤣',ph:'😂,🤣,❤️'}]}),
canvasTool({id:'rch3',name:'Reaksi Channel WhatsApp V3',desc:'Kirim reaksi emoji ke postingan channel WhatsApp. Tempel link postingan (yang ada angka di belakangnya) dan pilih emoji. Memakai jalur server lain (1 emoji). Tiap kirim memakai 3 koin. Prosesnya bisa sampai 30 detik.',btn:'Kirim reaksi',wait:'Mengirim reaksi, mohon tunggu...',ok:'Reaksi terkirim.',data:true,fields:[{key:'url',label:'Link postingan channel',req:true,max:300,val:'https://whatsapp.com/channel/',ph:'https://whatsapp.com/channel/XXXX/123'},{key:'reaction',label:'Emoji (1 saja)',req:true,max:60,val:'😂',ph:'😂'}]}),
canvasTool({id:'qr-code',name:'QR Code Generator',desc:'Ubah link atau teks apa saja menjadi gambar QR Code PNG berkualitas tinggi.',btn:'Buat QR Code',wait:'Membuat QR Code...',ok:'QR Code siap diunduh.',dl:'qrcode.png',fields:[{key:'text',label:'Target URL/Teks',req:true,max:1000,val:'https://gencipta.com',ph:'https://contoh.com atau teks bebas'}]}),
canvasTool({id:'upscale',name:'HD Gambar',desc:'Perbesar dan perjelas gambar beresolusi rendah 2x dengan AI. Prosesnya bisa sampai 30 detik.',btn:'Perbesar gambar',wait:'Memperbesar gambar, mohon tunggu...',ok:'Gambar siap diunduh.',dl:'upscale.png',ba:true,lbl:'HD 2×',fields:[{key:'url',label:'Gambar',photo:true,req:true}]}),
canvasTool({id:'swhd',name:'SW HD',desc:'Jernihkan dan perbesar foto atau video jadi HD dengan AI. Cocok untuk foto atau video buram dan beresolusi rendah. Prosesnya bisa sampai 1 menit.',btn:'Jadikan HD',wait:'Menjernihkan foto atau video, mohon tunggu...',ok:'Hasil HD siap diunduh.',dl:'sw-hd.png',ba:true,lbl:'SW HD',vid:true,fields:[{key:'url',label:'Foto atau video',req:true,photo:true,vid:true}]}),
canvasTool({id:'brat-v1',name:'Brat Generator V1',desc:'Buat gambar teks gaya Brat (Charli XCX) dengan warna latar dan warna teks sesuka hati.',btn:'Buat gambar',wait:'Membuat gambar...',ok:'Gambar siap diunduh.',dl:'brat.png',fields:[{key:'text',label:'Teks',req:true,max:300,val:'Hello World',ph:'Hello World'},{key:'background',label:'Warna latar (hex)',max:7,val:'#ffffff',ph:'#ffffff'},{key:'color',label:'Warna teks (hex)',max:7,val:'#000000',ph:'#000000'}]}),
canvasTool({id:'bratvid',name:'Brat Video Generator',desc:'Buat video teks gaya Brat (Charli XCX) dengan warna latar dan warna teks sesuka hati.',btn:'Buat video',wait:'Membuat video...',ok:'Video siap diunduh.',dl:'brat.mp4',video:true,fields:[{key:'text',label:'Teks',req:true,max:300,val:'Malik Ganteng',ph:'Malik Ganteng'},{key:'background',label:'Warna latar (hex)',max:7,val:'#ffffff',ph:'#ffffff'},{key:'color',label:'Warna teks (hex)',max:7,val:'#000000',ph:'#000000'}]}),
canvasTool({id:'fake-channel',name:'Fake Channel WhatsApp',desc:'Buat mockup halaman Info Saluran WhatsApp iOS dengan foto profil, nama saluran, jumlah pengikut, dan jam status bar.',btn:'Buat mockup',wait:'Membuat mockup...',ok:'Mockup siap diunduh.',dl:'saluran.png',fields:[{key:'avatar',label:'Foto profil',photo:true,req:true},{key:'name',label:'Nama saluran',req:true,max:60,ph:'RINA IMUP'},{key:'followers',label:'Pengikut',req:true,max:20,val:'3.621',ph:'3.621'},{key:'time',label:'Jam status bar',req:true,max:8,time:true,ph:'13.10'}]}),
canvasTool({id:'fake-call',name:'Fake Call WhatsApp',desc:'Buat mockup layar panggilan WhatsApp iOS dengan foto profil, nama kontak, dan durasi panggilan.',btn:'Buat mockup',wait:'Membuat mockup...',ok:'Mockup siap diunduh.',dl:'panggilan.png',fields:[{key:'avatar',label:'Foto profil',photo:true,req:true},{key:'name',label:'Nama kontak',req:true,max:60,ph:'my heart ❤️'},{key:'duration',label:'Durasi panggilan',req:true,max:10,val:'01:00:39',ph:'01:00:39'}]}),
canvasTool({id:'jarvis-meme',name:'Jarvis Meme',desc:'Buat meme Jarvis dengan teks sendiri. Teks otomatis dibungkus dan disesuaikan ukurannya.',btn:'Buat meme',wait:'Membuat meme...',ok:'Meme siap diunduh.',dl:'jarvis-meme.png',fields:[{key:'text',label:'Teks meme',req:true,max:300,val:'Jarvis, tolong diapakan dulu apa itu biar ga apa kali',ph:'Jarvis, tolong ...'}]}),
canvasTool({id:'igqc',name:'Instagram Quick Chat',desc:'Buat mockup menu pesan Instagram (Quick Chat) dengan pesan, gambar, jam menu, dan bar reaksi emoji. Semua isian opsional, isi minimal satu.',btn:'Buat mockup',wait:'Membuat mockup...',ok:'Mockup siap diunduh.',dl:'igqc.png',fields:[{key:'text',label:'Pesan',max:300,ph:'Ini tuh namanya pap dari my mbg yh 🌹🌹'},{key:'image',label:'Gambar (opsional)',photo:true},{key:'time',label:'Jam menu',max:20,ph:'SAB 15.28'}]}),
canvasTool({id:'iqc-dark',name:'IQC Dark',desc:'Buat kartu kutipan chat bertema gelap dengan pesan, gambar opsional, dan jam.',btn:'Buat gambar',wait:'Membuat gambar...',ok:'Gambar siap diunduh.',dl:'iqc-dark.png',fields:[{key:'text',label:'Pesan',req:true,max:300,ph:'Halo, ini contoh pesan'},{key:'image',label:'Gambar (opsional)',photo:true},{key:'time',label:'Jam',max:20,time:true,ph:'20.20'}]}),
canvasTool({id:'duar-viral',name:'Duar Viral',desc:'Tempel fotomu ke latar ledakan api ala meme viral. Latar foto dihapus otomatis, hasil siap diunduh.',btn:'Buat gambar',wait:'Membuat gambar, mohon tunggu...',ok:'Gambar siap diunduh.',dl:'duar-viral.jpg',fields:[{key:'url',label:'Gambar',photo:true,req:true}]}),
canvasTool({id:'quote-card',name:'Quoted Card IG Viral',desc:'Tulis teks pendek di atas latar tetap jadi kartu kutipan ala status WA/IG. Latar selalu sama, yang bisa diganti hanya teksnya.',btn:'Buat gambar',wait:'Membuat gambar...',ok:'Gambar siap diunduh.',dl:'quote-card.jpg',fields:[{key:'text',label:'Teks',req:true,max:200,ph:'malik ganteng'},{key:'bold',label:'Gaya teks',select:[['0','Normal'],['1','Tebal']]},{key:'template',label:'Template',select:[['','Default'],['1','Template 1 (asli)'],['2','Template 2'],['3','Template 3 (ayam)'],['4','Template 4'],['5','Template 5']]}]}),
canvasTool({id:'carbon',name:'Carbon Code',desc:'Ubah potongan kode menjadi gambar bersyntax highlight bergaya Carbon. Prosesnya bisa sampai 15 detik.',btn:'Buat gambar',wait:'Membuat gambar, mohon tunggu...',ok:'Gambar siap diunduh.',dl:'carbon.png',fields:[{key:'code',label:'Kode',req:true,area:true,max:5000,val:"console.log('Hello Carbon!');",ph:'Tempel kode di sini'}]}),
linkTool({id:'soundcloud-dl',name:'SoundCloud Player',dl:true,ic:'link',gi:'play',chips:[['play','Putar langsung'],['music','Unduh MP3 bila ada']],desc:'Putar lagu SoundCloud langsung di sini lewat pemutar resmi. Bila provider menyediakan file MP3, tombol unduh ikut muncul.',label:'Link SoundCloud',ph:'https://soundcloud.com/...',btn:'Putar lagu'}),
linkTool({id:'dailymotion-dl',name:'Dailymotion Downloader',dl:true,ic:'link',chips:[['hd','1080p, 720p, 480p'],['video','Judul dan durasi']],desc:'Ambil link unduh video Dailymotion publik dalam beberapa kualitas (1080p, 720p, 480p) beserta judul dan durasi.',label:'Link Dailymotion',ph:'https://www.dailymotion.com/video/...',btn:'Ambil video'}),
linkTool({id:'tiktok-dl',name:'TikTok Downloader',dl:true,ic:'link',chips:[['drop','Tanpa watermark'],['hd','Kualitas HD'],['music','Audio MP3']],desc:'Unduh video TikTok tanpa watermark, termasuk versi HD dan audio MP3.',label:'Link TikTok',ph:'https://vt.tiktok.com/...',btn:'Ambil video'}),
{id:'tiktok-dl2',name:'TikTok Downloader V2',desc:'Unduh video TikTok tanpa watermark lewat jalur Nexa: pilih MP4, MP4 HD, atau audio MP3.',html:tk2Html,init:tk2Init},
{id:'am-preset',name:'AM Preset',desc:'Cari link preset Alight Motion (XML dan 5MB) dari komentar, balasan, dan bio video TikTok.',html:ampHtml,init:ampInit},
{id:'anime-search',name:'Search Anime',desc:'Cari anime berdasarkan judul dari Otakudesu, lengkap dengan poster, rating, status, genre, dan tombol tonton.',html:aniHtml,init:aniInit},
{id:'anime-ongoing',name:'Anime Ongoing',desc:'Daftar anime yang sedang tayang dari Otakudesu, lengkap dengan poster, episode terbaru, dan hari rilis.',html:()=>ongHtml('anime-ongoing'),init:r=>ongInit(r,'anime-ongoing')},
{id:'anime-completed',name:'Anime Completed',desc:'Daftar anime yang sudah tamat dari Otakudesu, lengkap dengan poster, jumlah episode, dan rating.',html:()=>ongHtml('anime-completed'),init:r=>ongInit(r,'anime-completed')},
{id:'anime-episode',name:'Anime Episode',desc:'Ambil server streaming, mirror, dan link unduhan satu episode anime dari Otakudesu lewat slug atau link episode.',html:()=>epHtml('anime-episode'),init:r=>epInit(r,'anime-episode')},
{id:'anime-batch',name:'Anime Batch',desc:'Ambil link unduhan batch (seluruh episode dalam satu paket) dari Otakudesu lewat slug atau link batch.',html:()=>epHtml('anime-batch'),init:r=>epInit(r,'anime-batch')},
{id:'komik-search',name:'Cari Komik',desc:'Cari komik berdasarkan judul dari Komikindo, lengkap dengan cover, rating, dan tombol baca.',html:kmkHtml,init:kmkInit},
{id:'mangaplus',name:'MangaPlus',desc:'Daftar beranda MangaPlus: update 24 jam, chapter terbaru, dan ranking judul, lengkap dengan cover dan tombol baca.',html:mpHtml,init:mpInit},
linkTool({id:'open-graph',name:'Open Graph Scraper',desc:'Ambil metadata Open Graph sebuah situs: judul, deskripsi, gambar pratinjau, dan favicon.',label:'Link situs',ph:'https://contoh.com',btn:'Ambil metadata',nolink:true}),
linkTool({id:'cek-situs',name:'Cek Situs',desc:'Periksa apakah sebuah situs online: status HTTP, waktu respons, redirect, dan masa berlaku SSL.',label:'Alamat situs',ph:'contoh.com atau https://contoh.com',btn:'Periksa situs',nolink:true,text:true}),
{id:'konversi-gambar',name:'Konversi Gambar',desc:'Ubah format gambar (JPG, PNG, WebP), kecilkan ukuran file, atau atur lebar. Diproses di perangkatmu, tidak diunggah ke server.',
 html:()=>`<label class="drop" id="cvd" for="cvf">${svg(IC.up)}<span><b>Pilih gambar dari perangkat</b><span id="cvi">JPG, PNG, atau WebP, sampai 50 MB.</span></span></label><input id="cvf" type="file" accept="image/*">
<label for="cvt">Format hasil</label><select id="cvt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>
<label for="cvq">Kualitas JPG dan WebP: <span id="cvqv">80</span>%</label><input id="cvq" type="range" min="30" max="100" value="80">
<label for="cvw">Lebar maksimal (px), kosongkan jika tidak diubah</label><input id="cvw" type="number" inputmode="numeric" min="16" max="8000" placeholder="contoh: 1080">
<div class="row"><button class="primary" id="go">Konversi</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const f=$(r,'#cvf'),dz=$(r,'#cvd'),fi=$(r,'#cvi'),h0=fi.textContent,m=$(r,'#m'),res=$(r,'#res'),q=$(r,'#cvq'),qv=$(r,'#cvqv');let prev='';
  q.oninput=()=>{qv.textContent=q.value};
  f.onchange=()=>{const x=f.files[0];dz.classList.toggle('on',!!x);fi.textContent=x?x.name+' · '+mb(x.size):h0};
  $(r,'#go').onclick=async()=>{const x=f.files[0],bad=t=>{m.className='msg bad';m.textContent=t};
   if(!x)return bad('Pilih gambar dulu.');
   if(!/^image\/(jpeg|png|webp)$/.test(x.type))return bad('Format harus JPG, PNG, atau WebP.');
   if(x.size>MAXIN)return bad('Ukuran gambar maksimal 50 MB.');
   m.className='msg';m.textContent='Memproses...';
   try{const bm=await createImageBitmap(x);let w=bm.width,hh=bm.height;const mw=parseInt($(r,'#cvw').value,10);if(mw>0&&mw<w){hh=Math.max(1,Math.round(hh*mw/w));w=mw}
    const cv=document.createElement('canvas');cv.width=w;cv.height=hh;const cx=cv.getContext('2d'),type=$(r,'#cvt').value;
    if(type==='image/jpeg'){cx.fillStyle='#fff';cx.fillRect(0,0,w,hh)}
    cx.drawImage(bm,0,0,w,hh);if(bm.close)bm.close();
    const blob=await new Promise(ok=>cv.toBlob(ok,type,q.value/100));if(!blob)throw new Error('x');
    if(prev)URL.revokeObjectURL(prev);prev=URL.createObjectURL(blob);
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type],base=(x.name.replace(/\.[^.]+$/,'')||'gambar').slice(0,60),
     diff=blob.size<x.size?'hemat '+Math.round((1-blob.size/x.size)*100)+'%':'lebih besar '+Math.round((blob.size/x.size-1)*100)+'%';
    res.innerHTML=`<div class="out"><div class="cmp"><figure><img src="${prev}" alt="Hasil konversi"><figcaption>${w} x ${hh} px · ${mb(blob.size)} (${diff})</figcaption></figure></div><div class="row"><a class="btn primary dlb" href="${prev}" download="${esc(base)}.${ext}">${DLI}Unduh ${ext.toUpperCase()}</a></div></div>`;
    m.textContent='Selesai. Ukuran awal '+mb(x.size)+'.'}
   catch(e){res.innerHTML='';bad('Gambar tidak bisa diproses. Coba file lain.')}}}},
linkTool({id:'am-find',name:'AM Find',desc:'Cari link preset Alight Motion di komentar dan balasan sebuah video TikTok. Prosesnya bisa sampai satu menit.',label:'Link video TikTok',ph:'https://vt.tiktok.com/...',btn:'Cari preset',nolink:true}),
linkTool({id:'am-data',name:'Alight Motion Data',desc:'Ambil metadata proyek, UID, dan PID dari link share Alight Motion. Berguna untuk analisis atau pengelolaan preset.',label:'Link share Alight Motion',ph:'https://alightcreative.com/am/share/u/.../p/...',btn:'Ambil data',nolink:true}),
promptTool({id:'image-to-prompt',name:'Image to Prompt',desc:'Analisis sebuah gambar lalu hasilkan prompt teks AI yang detail untuk menggambarkannya.',btn:'Buat prompt',wait:'Menganalisis gambar, mohon tunggu...'}),
{id:'getcontact-start',name:'GetContact Verifikasi',desc:'Mulai verifikasi GetContact lewat WhatsApp: dapatkan link dan kode, lalu kirim pesan yang sudah disiapkan dari nomor yang sama.',
 html:()=>`<label for="ph">Nomor WhatsApp</label><input id="ph" type="tel" inputmode="tel" autocomplete="off" placeholder="+6281234567890">
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="go">Mulai verifikasi</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res'),ph=$(r,'#ph'),bad=t=>{m.className='msg bad';m.textContent=t};let tm=0;
  const run=async()=>{const v=ph.value.trim();if(!/^\+?[\d\s().-]{8,20}$/.test(v))return bad('Isi nomor WhatsApp, contoh +6281234567890 atau 081234567890.');
   clearInterval(tm);go.disabled=true;m.className='msg';m.textContent='Memulai verifikasi...';res.innerHTML='';
   const j=await api('getcontact-start',v,$(r,'#k').value);go.disabled=false;
   if(!j.ok){bad(j.error||'Gagal.');if(j.code===401&&!/Masuk dulu/.test(j.error||''))$(r,'#ac').style.display='block';return}
   const d=j.data||{},link=String(j.link||''),kode=String(d.kode||'');
   if(!/^https:\/\//.test(link)||!kode)return bad('Provider tidak mengirim link verifikasi. Coba lagi.');
   m.className='msg good';m.textContent='Verifikasi dimulai. Kirim pesan WhatsApp-nya sebelum waktu habis.';
   const end=Date.now()+(+d.berlaku_detik||900)*1e3;
   res.innerHTML=`<div class="out rescard"><div class="rch"><span class="rck">✓</span><b>Siap dikirim</b></div><ul class="rcl"><li><span>Nomor</span><b>${esc(d.nomor||v)}</b></li><li><span>Kode</span><b style="word-break:break-all;user-select:text;-webkit-user-select:text">${esc(kode)}</b></li><li><span>Berlaku</span><b id="gcx">-</b></li>${d.flow_id?`<li><span>Flow ID</span><b style="word-break:break-all;user-select:text;-webkit-user-select:text">${esc(d.flow_id)}</b></li>`:''}</ul><p class="sub" style="margin:10px 0">Ketuk Buka WhatsApp, kirim pesan yang sudah terisi tanpa diubah dari nomor yang sama, lalu kembali ke aplikasi GetContact.</p><div class="row"><a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Buka WhatsApp</a><button type="button" id="cpk">Salin kode</button><button type="button" id="cpl">Salin link</button></div></div>`;
   $(r,'#cpk').onclick=e=>copy(kode,e.target);$(r,'#cpl').onclick=e=>copy(link,e.target);
   const cx=$(r,'#gcx'),tick=()=>{if(!cx.isConnected){clearInterval(tm);return}const s=Math.max(0,Math.ceil((end-Date.now())/1e3));cx.textContent=s?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'Habis, ulangi dari awal';if(!s)clearInterval(tm)};tick();tm=setInterval(tick,1000)};
  go.onclick=run;ph.onkeydown=ev=>{if(ev.key==='Enter')run()}}},
{id:'bypass-cf',name:'Bypass Cloudflare Turnstile',desc:'Buat token Cloudflare Turnstile yang valid untuk sebuah situs. Token sekali pakai dan cepat kedaluwarsa, jadi langsung dipakai.',
 html:()=>`<label for="u">Link situs target</label><input id="u" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://contoh.com/">
<label for="sk">Site key (opsional)</label><input id="sk" type="text" maxlength="100" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="0x4AAAAAAA...">
<div id="ac"><label for="k">Kode akses</label><input id="k" type="password" autocomplete="off"></div>
<div class="row"><button class="primary" id="go">Buat token</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const go=$(r,'#go'),m=$(r,'#m'),res=$(r,'#res');
  const run=async()=>{const u=$(r,'#u').value.trim(),sk=$(r,'#sk').value.trim();
   if(!/^https?:\/\//i.test(u)){m.className='msg bad';m.textContent='Isi link situs yang diawali https://';return}
   go.disabled=true;m.className='msg';m.textContent='Membuat token, biasanya 5 sampai 15 detik...';res.innerHTML='';
   const f={url:u};if(sk)f.sitekey=sk;
   const j=await api('bypass-cf','',$(r,'#k').value,'',f);go.disabled=false;
   if(!j.ok){m.className='msg bad';m.textContent=j.error||'Gagal.';if(j.code===401&&!/Masuk dulu/.test(j.error||''))$(r,'#ac').style.display='block';return}
   const d=j.data||{};m.className='msg good';m.textContent='Token siap. Langsung pakai sebelum kedaluwarsa.';
   res.innerHTML=`<div class="out"><code style="display:block;word-break:break-all;max-height:9em;overflow:auto">${esc(d.token||'')}</code><div class="row"><button class="primary" id="cp">Salin token</button></div>${d.mode||d.durasi?`<dl>${d.mode?`<dt>Mode</dt><dd>${esc(d.mode)}</dd>`:''}${d.durasi?`<dt>Durasi</dt><dd>${esc(d.durasi)}</dd>`:''}</dl>`:''}</div>`;
   $(r,'#cp').onclick=x=>copy(d.token||'',x.target)};
  go.onclick=run;$(r,'#u').onkeydown=ev=>{if(ev.key==='Enter')run()}}},
{id:'link-wa',name:'Link WhatsApp',desc:'Buat link chat WhatsApp dengan pesan yang sudah terisi. Diproses di browser.',
 html:()=>`<label for="n">Nomor WhatsApp</label>
<div class="phone"><span class="cc">+62</span><input id="n" inputmode="tel" autocomplete="off" placeholder="812 3456 7890"></div>
<label for="t">Pesan (opsional)</label><textarea id="t" maxlength="500" placeholder="Tulis pesan pembuka..."></textarea>
<div class="chips" id="ch"><button type="button">Halo, saya mau tanya</button><button type="button">Mau order</button><button type="button">Info harga dong</button></div>
<div class="wa"><div class="hd"><b id="pn">+62 ...</b><span>online</span></div><div class="bd"><p class="bub" id="pv"></p></div></div>
<div class="out"><code id="o">Isi nomor untuk membuat link.</code><div class="row"><button class="primary" id="cp">Salin link</button><a class="btn wag" id="op" target="_blank" rel="noopener noreferrer" href="#">Buka WhatsApp</a></div></div>`,
 init:r=>{const n=$(r,'#n'),t=$(r,'#t'),o=$(r,'#o'),op=$(r,'#op'),pv=$(r,'#pv'),pn=$(r,'#pn');let url='';
  const up=()=>{let d=n.value.replace(/\D/g,'');if(d.startsWith('0'))d='62'+d.slice(1);else if(!d.startsWith('62'))d='62'+d;
   const ok=d.length>=10&&d.length<=15&&n.value.replace(/\D/g,'').length>0;
   url=ok?'https://wa.me/'+d+(t.value?'?text='+encodeURIComponent(t.value):''):'';
   o.textContent=url||'Isi nomor untuk membuat link.';op.href=url||'#';op.setAttribute('aria-disabled',url?'false':'true');
   pn.textContent=ok?'+'+d.replace(/^(\d{2})(\d{3})(\d{4})(\d*)$/,'$1 $2-$3-$4').replace(/-$/,''):'+62 ...';
   pv.textContent=t.value||'Pesan kamu tampil di sini';pv.classList.toggle('ph',!t.value)};
  n.oninput=t.oninput=up;
  $(r,'#ch').onclick=e=>{if(e.target.tagName==='BUTTON'){t.value=e.target.textContent;up()}};
  $(r,'#cp').onclick=e=>{if(url)copy(url,e.target)};up()}},
{id:'kompres-gambar',name:'Kompres Gambar',desc:'Kecilkan foto sampai di bawah batas ukuran yang kamu tentukan, misalnya 200 KB untuk formulir online. Diproses di perangkatmu, tidak diunggah ke server.',
 html:()=>`<label class="drop" id="kgd" for="kgf">${svg(IC.up)}<span><b>Pilih foto dari perangkat</b><span id="kgi">JPG, PNG, atau WebP, sampai 50 MB.</span></span></label><input id="kgf" type="file" accept="image/*">
<label for="kgs">Ukuran maksimal hasil (KB)</label><input id="kgs" type="number" inputmode="numeric" min="10" max="10000" value="200">
<div class="chips" id="kgc"><button type="button">100 KB</button><button type="button">200 KB</button><button type="button">500 KB</button><button type="button">1000 KB</button></div>
<label for="kgt">Format hasil</label><select id="kgt"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select>
<div class="row"><button class="primary" id="go">Kompres</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const f=$(r,'#kgf'),dz=$(r,'#kgd'),fi=$(r,'#kgi'),h0=fi.textContent,m=$(r,'#m'),res=$(r,'#res'),s=$(r,'#kgs');let prev='';
  const fs=n=>n>=1048576?mb(n):Math.round(n/1024)+' KB';
  f.onchange=()=>{const x=f.files[0];dz.classList.toggle('on',!!x);fi.textContent=x?x.name+' · '+fs(x.size):h0};
  $(r,'#kgc').onclick=e=>{if(e.target.tagName==='BUTTON')s.value=parseInt(e.target.textContent,10)};
  $(r,'#go').onclick=async()=>{const x=f.files[0],bad=t=>{m.className='msg bad';m.textContent=t};
   if(!x)return bad('Pilih foto dulu.');
   if(!/^image\/(jpeg|png|webp)$/.test(x.type))return bad('Format harus JPG, PNG, atau WebP.');
   if(x.size>MAXIN)return bad('Ukuran foto maksimal 50 MB.');
   const kb=parseInt(s.value,10);if(!(kb>=10&&kb<=10000))return bad('Isi batas ukuran antara 10 dan 10000 KB.');
   m.className='msg';m.textContent='Memproses...';res.innerHTML='';
   try{const bm=await createImageBitmap(x),type=$(r,'#kgt').value,target=kb*1024;let scale=1,out=null,ow=0,oh=0;
    for(let i=0;i<10&&!out;i++){
     const w=Math.max(16,Math.round(bm.width*scale)),h=Math.max(16,Math.round(bm.height*scale));
     const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');
     cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(bm,0,0,w,h);
     const enc=q=>new Promise(ok=>cv.toBlob(ok,type,q));
     let b=await enc(.92);
     if(b&&b.size<=target){out=b}
     else{let lo=.3,hi=.92,lb=await enc(lo);
      if(lb&&lb.size<=target){out=lb;for(let k=0;k<6;k++){const mid=(lo+hi)/2,mb2=await enc(mid);if(mb2&&mb2.size<=target){out=mb2;lo=mid}else hi=mid}}}
     if(out){ow=w;oh=h}else scale*=.8}
    if(bm.close)bm.close();
    if(!out)return bad('Batas '+kb+' KB terlalu kecil untuk foto ini. Coba naikkan batasnya.');
    if(prev)URL.revokeObjectURL(prev);prev=URL.createObjectURL(out);
    const ext=type==='image/webp'?'webp':'jpg',base=(x.name.replace(/\.[^.]+$/,'')||'foto').slice(0,60),
     diff=out.size<x.size?'hemat '+Math.round((1-out.size/x.size)*100)+'%':'tidak lebih kecil dari aslinya';
    res.innerHTML=`<div class="out"><div class="cmp"><figure><img src="${prev}" alt="Hasil kompres"><figcaption>${ow} x ${oh} px · ${fs(out.size)} (${diff})</figcaption></figure></div><div class="row"><a class="btn primary dlb" href="${prev}" download="${esc(base)}-kompres.${ext}">${DLI}Unduh ${ext.toUpperCase()}</a></div></div>`;
    m.textContent='Selesai. Ukuran awal '+fs(x.size)+', sekarang '+fs(out.size)+'.'}
   catch(e){bad('Foto tidak bisa diproses. Coba foto lain.')}}}},
{id:'svg-ke-xml',name:'SVG ke XML Alight Motion',desc:'Ubah file SVG atau foto berwarna (PNG, JPG, WebP) jadi layer vektor XML untuk Alight Motion: atur durasi, FPS, ukuran kanvas, jumlah warna, dan detail, lalu periksa layernya sebelum mengunduh. Diproses di perangkatmu, tidak diunggah ke server.',
 html:()=>`<label class="drop" id="sxd" for="sxf">${svg(IC.up)}<span><b>Pilih file SVG atau foto</b><span id="sxi">SVG, PNG, JPG, atau WebP, maksimal 10 MB. Untuk SVG, ubah teks menjadi outline dulu.</span></span></label><input id="sxf" type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp,text/xml,application/xml">
<div class="chips"><button type="button" id="sxs">Coba file contoh</button></div>
<div id="sxo" hidden><label for="sxk">Jumlah warna</label><select id="sxk"><option>8</option><option>12</option><option>16</option><option selected>24</option><option>32</option><option>48</option><option>64</option><option>96</option><option>128</option></select>
<label for="sxq">Detail</label><select id="sxq"><option value="rendah">Ringan (cepat, file kecil)</option><option value="sedang" selected>Sedang</option><option value="tinggi">Tinggi (lambat, file besar)</option></select>
<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sxb" checked> Ilustrasi bersih (warna rata, tanpa pinggiran piksel)</label>
<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sxg" checked> Pertahankan garis tipis (outline)</label>
<p class="msg">Foto dipecah jadi bentuk berwarna yang bertumpuk. Makin banyak warna dan detail, makin mirip aslinya tapi makin berat di Alight Motion.</p></div>
<label for="sxu">Durasi (detik)</label><input id="sxu" type="number" inputmode="decimal" min="0.5" max="600" step="0.5" value="3">
<label for="sxp">FPS</label><select id="sxp"><option>24</option><option>25</option><option selected>30</option><option>50</option><option>60</option></select>
<label for="sxc">Ukuran kanvas</label><select id="sxc"><option value="auto">Otomatis (ikuti SVG)</option><option value="1080x1080">1080 x 1080 (1:1)</option><option value="1080x1920">1080 x 1920 (9:16)</option><option value="1920x1080">1920 x 1080 (16:9)</option><option value="custom">Kustom</option></select>
<div id="sxw" hidden><label for="sxx">Lebar (px)</label><input id="sxx" type="number" inputmode="numeric" min="16" max="8192" value="1080"><label for="sxy">Tinggi (px)</label><input id="sxy" type="number" inputmode="numeric" min="16" max="8192" value="1080"></div>
<label for="sxh">Bentuk berlubang</label><select id="sxh"><option value="pecah">Pecah per bidang (seperti file contoh)</option><option value="jembatan">Jembatan (1 layer per bentuk)</option></select>
<label for="sxr">Warna gradasi</label><select id="sxr"><option value="sedang" selected>Sedang (pita warna bertumpuk)</option><option value="tinggi">Halus (lapisan lebih banyak)</option><option value="rendah">Ringan (lapisan sedikit)</option><option value="rata">Warna rata-rata (1 warna per bentuk)</option></select>
<div class="row"><button class="primary" id="go">Buat XML</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const f=$(r,'#sxf'),dz=$(r,'#sxd'),fi=$(r,'#sxi'),h0=fi.textContent,m=$(r,'#m'),res=$(r,'#res'),cs=$(r,'#sxc');let url='',useSample=false;
  cs.onchange=()=>{$(r,'#sxw').hidden=cs.value!=='custom'};
  const isImg=x=>!!x&&(/^image\/(png|jpe?g|webp)$/.test(x.type)||/\.(png|jpe?g|webp)$/i.test(x.name));
  f.onchange=()=>{const x=f.files[0];useSample=false;dz.classList.toggle('on',!!x);fi.textContent=x?x.name+' · '+(x.size>=1048576?mb(x.size):Math.round(x.size/1024)+' KB'):h0;$(r,'#sxo').hidden=!isImg(x);if(isImg(x))$(r,'#sxh').value='jembatan'};
  $(r,'#sxs').onclick=()=>{f.value='';$(r,'#sxo').hidden=true;useSample=true;dz.classList.add('on');fi.textContent='contoh.svg (file contoh)';m.className='msg';m.textContent='File contoh dipilih. Ketuk Buat XML.'};
  $(r,'#go').onclick=async()=>{const x=f.files[0],bad=t=>{m.className='msg bad';m.textContent=t};
   if(!x&&!useSample)return bad('Pilih file SVG atau foto dulu.');
   const ras=isImg(x);
   if(x&&!ras&&!/\.svg$/i.test(x.name)&&x.type!=='image/svg+xml')return bad('Formatnya harus SVG, PNG, JPG, atau WebP.');
   if(x&&x.size>10*1048576)return bad('Ukuran file maksimal 10 MB.');
   const dur=parseFloat($(r,'#sxu').value);if(!(dur>=0.5&&dur<=600))return bad('Durasi antara 0,5 dan 600 detik.');
   let cw=0,ch=0;if(cs.value==='custom'){cw=parseInt($(r,'#sxx').value,10);ch=parseInt($(r,'#sxy').value,10);if(!(cw>=16&&cw<=8192&&ch>=16&&ch<=8192))return bad('Lebar dan tinggi kanvas antara 16 dan 8192 px.')}
   m.className='msg';m.textContent='Memproses...';res.innerHTML='';
   try{await loadMod('svgam');await new Promise(k=>setTimeout(k,30));
    const base=(x?x.name.replace(/\.[^.]+$/,''):'contoh').replace(/[^\w\- ]+/g,'-').trim().slice(0,40)||(ras?'foto':'svg'),opt={title:base,duration:dur,fps:parseInt($(r,'#sxp').value,10),canvas:cs.value,width:cw,height:ch,holes:$(r,'#sxh').value,grad:$(r,'#sxr').value};
    let out;
    if(ras){
     const det=$(r,'#sxq').value,u=URL.createObjectURL(x);let im;
     try{im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('Foto tidak bisa dibuka. Coba foto lain.'));i.src=u})}finally{setTimeout(()=>URL.revokeObjectURL(u),2000)}
     const iw=im.naturalWidth,ih=im.naturalHeight,k=Math.min(1,SVGAM.PHOTO_DETAIL[det].side/Math.max(iw,ih)),W=Math.max(2,Math.round(iw*k)),H=Math.max(2,Math.round(ih*k)),c=document.createElement('canvas');
     c.width=W;c.height=H;const cx=c.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';cx.drawImage(im,0,0,W,H);
     out=await SVGAM.fromImageAsync(cx.getImageData(0,0,W,H).data,W,H,Object.assign(opt,{colors:parseInt($(r,'#sxk').value,10),detail:det,bersih:$(r,'#sxb').checked,ink:$(r,'#sxg').checked&&!$(r,'#sxb').checked,srcW:iw,srcH:ih,onStep:t=>{m.textContent=t}}))}
    else out=SVGAM.convert(x?await x.text():SVGAM.SAMPLE,opt);
    const md=out.model,st=out.stats;
    const sw=l=>{const a=parseInt(l.fill.slice(1,3),16)/255;return 'rgba('+parseInt(l.fill.slice(3,5),16)+','+parseInt(l.fill.slice(5,7),16)+','+parseInt(l.fill.slice(7,9),16)+','+a+')'};
    res.innerHTML=`<div class="out"><div class="chk" style="border-radius:12px;overflow:hidden"><canvas id="sxv" style="display:block;width:100%;height:auto" aria-label="Pratinjau hasil"></canvas></div>
<p class="msg" id="sxn"></p>${out.warnings.length?'<ul>'+out.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':''}
<p><b>Layer (${md.layers.length})</b>${md.layers.length>1?' · centang yang mau dibawa ke Alight Motion':' · akan dibawa ke Alight Motion'}</p>
<div id="sxl">${md.layers.map((l,i)=>`<label>${md.layers.length>1?`<input type="checkbox" data-i="${i}" checked>`:''} <span style="display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;border:1px solid rgba(128,128,128,.5);background:${sw(l)}"></span> ${esc(l.label)} · ${l.rings.length} bidang · ${l.rings.reduce((s,q)=>s+q.length,0)} titik</label>`).join('')}</div>
<div class="row"><a class="btn primary dlb" id="sxa" href="#">${DLI}Unduh XML</a></div>
<p class="msg">Impor file XML ke Alight Motion, lalu periksa bentuk, warna, dan urutan layer. ${ras?'Hasil foto berupa bentuk berwarna datar bertumpuk, jadi gradasi halus tampak seperti poster.':'Garis (stroke), teks, gradasi, dan efek belum ikut diubah.'}</p></div>`;
    const cv=$(res,'#sxv'),sc=Math.min(1,900/Math.max(md.width,md.height));cv.width=Math.round(md.width*sc);cv.height=Math.round(md.height*sc);
    const dl=$(res,'#sxa'),info=$(res,'#sxn');
    const upd=()=>{const cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height);SVGAM.draw(cx,md,sc);
     const on=md.layers.filter(l=>l.on!==false);if(url)URL.revokeObjectURL(url);
     if(!on.length){dl.removeAttribute('href');dl.classList.add('off');dl.style.opacity='.45';dl.style.pointerEvents='none';info.textContent='Pilih minimal satu layer.';return}
     const xml=SVGAM.toXML(md);url=URL.createObjectURL(new Blob([xml],{type:'application/xml'}));dl.href=url;dl.download=base+'.xml';dl.classList.remove('off');dl.style.opacity='';dl.style.pointerEvents='';
     info.textContent=md.width+' x '+md.height+' px · '+Math.round(md.totalTime/10)/100+' detik · '+md.fps+' FPS · '+on.length+' layer · '+on.reduce((s,l)=>s+l.rings.length,0)+' bidang · XML '+Math.max(1,Math.round(xml.length/1024))+' KB'};
    $(res,'#sxl').onchange=e=>{const i=e.target.dataset&&e.target.dataset.i;if(i===undefined)return;md.layers[+i].on=e.target.checked;upd()};
    upd();m.textContent='Selesai. '+st.layers+' layer, '+st.pieces+' bidang.'}
   catch(e){bad(e&&e.message&&!/^Modul /.test(e.message)?e.message:'SVG tidak bisa diproses. Coba file lain atau muat ulang halaman.')}}}},
{id:'kalkulator-cicilan',name:'Kalkulator Cicilan',desc:'Hitung cicilan bulanan KPR, kendaraan, atau pinjaman dengan bunga anuitas atau flat, lengkap dengan tabel angsuran. Diproses di browser.',
 html:()=>`<label for="cp">Harga atau jumlah pinjaman (Rp)</label><input id="cp" inputmode="numeric" autocomplete="off" placeholder="500.000.000">
<label for="cd">Uang muka: <span id="cdv">20</span>%</label><input id="cd" type="range" min="0" max="90" step="5" value="20">
<label for="cb">Bunga per tahun (%)</label><input id="cb" inputmode="decimal" autocomplete="off" value="8">
<label for="ct">Tenor (tahun)</label><input id="ct" type="number" inputmode="decimal" min="0.5" max="30" step="0.5" value="15">
<label for="cj">Jenis bunga</label><select id="cj"><option value="a">Anuitas atau efektif (KPR, bank)</option><option value="f">Flat (kendaraan, multiguna)</option></select>
<div class="row"><button class="primary" id="go">Hitung cicilan</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const p=$(r,'#cp'),d=$(r,'#cd'),m=$(r,'#m'),res=$(r,'#res');
  p.oninput=()=>{const v=p.value.replace(/\D/g,'').slice(0,13);p.value=v?Number(v).toLocaleString('id-ID'):''};
  d.oninput=()=>{$(r,'#cdv').textContent=d.value};
  $(r,'#go').onclick=()=>{const bad=t=>{m.className='msg bad';m.textContent=t;res.innerHTML=''};
   const price=Number(p.value.replace(/\D/g,'')),dp=Number(d.value),rate=parseFloat($(r,'#cb').value.replace(',','.')),yrs=parseFloat($(r,'#ct').value),flat=$(r,'#cj').value==='f';
   if(!(price>0))return bad('Isi harga atau jumlah pinjaman dulu.');
   if(!(rate>=0&&rate<=100))return bad('Bunga harus antara 0 dan 100 persen per tahun.');
   if(!(yrs>=0.5&&yrs<=30))return bad('Tenor harus antara 0,5 dan 30 tahun.');
   const n=Math.round(yrs*12),loan=price*(1-dp/100),i=rate/100/12;let pmt;
   if(flat)pmt=(loan+loan*(rate/100)*(n/12))/n;else pmt=i===0?loan/n:loan*i/(1-Math.pow(1+i,-n));
   const total=pmt*n,bunga=total-loan;let bal=loan,rows='';
   for(let k=1;k<=Math.min(12,n);k++){const it=flat?loan*rate/100/12:bal*i,pr=pmt-it;bal=Math.max(0,bal-pr);rows+=`<tr><td>${k}</td><td>${rp(Math.round(pr))}</td><td>${rp(Math.round(it))}</td><td>${rp(Math.round(bal))}</td></tr>`}
   m.className='msg';m.textContent='';
   res.innerHTML=`<div class="out"><p class="hint" style="margin:0">Cicilan per bulan selama ${n} bulan</p><p style="font-size:28px;font-weight:800;margin:4px 0 12px">${rp(Math.round(pmt))}</p>
<table class="ktb"><tr><th>Pinjaman</th><td>${rp(Math.round(loan))}</td></tr><tr><th>Uang muka</th><td>${rp(Math.round(price-loan))}</td></tr><tr><th>Total bunga</th><td>${rp(Math.round(bunga))}</td></tr><tr><th>Total yang dibayar</th><td>${rp(Math.round(total))}</td></tr></table>
<details style="margin-top:12px"><summary>Tabel angsuran 12 bulan pertama</summary><div style="overflow-x:auto"><table class="ktb"><tr><th>Bulan</th><th>Pokok</th><th>Bunga</th><th>Sisa</th></tr>${rows}</table></div></details>
<p class="hint" style="margin:12px 0 0">Ini perkiraan. Biaya provisi, administrasi, dan asuransi dari bank belum dihitung.</p></div>`}}},
{id:'generator-password',name:'Generator Password',desc:'Buat password acak yang kuat dengan panjang dan jenis karakter pilihanmu. Dibuat di perangkatmu, tidak dikirim ke server.',
 html:()=>`<label for="gl">Panjang: <span id="glv">16</span> karakter</label><input id="gl" type="range" min="8" max="64" value="16">
<label><input type="checkbox" id="gu" checked> Huruf besar (A-Z)</label>
<label><input type="checkbox" id="gk" checked> Huruf kecil (a-z)</label>
<label><input type="checkbox" id="gn" checked> Angka (0-9)</label>
<label><input type="checkbox" id="gs" checked> Simbol (!@#$)</label>
<label><input type="checkbox" id="gm"> Hindari karakter mirip (0, O, 1, l, I)</label>
<div class="out"><code id="o"></code><p class="hint" id="st" style="margin:0 0 12px"></p><div class="row"><button class="primary" id="cp">Salin password</button><button id="rg" type="button">Buat ulang</button></div></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const o=$(r,'#o'),st=$(r,'#st'),m=$(r,'#m'),L=$(r,'#gl');let pw='';
  const rnd=n=>{const a=new Uint32Array(1),lim=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=lim);return a[0]%n};
  const gen=()=>{let sets=[['gu','ABCDEFGHIJKLMNOPQRSTUVWXYZ'],['gk','abcdefghijklmnopqrstuvwxyz'],['gn','0123456789'],['gs','!@#$%^&*()-_=+[]{};:,.?']].filter(x=>$(r,'#'+x[0]).checked).map(x=>x[1]);
   if($(r,'#gm').checked)sets=sets.map(s=>s.replace(/[0O1lI|]/g,''));
   if(!sets.length){pw='';o.textContent='Pilih minimal satu jenis karakter.';st.textContent='';return}
   m.textContent='';const len=+L.value,pool=sets.join(''),c=sets.map(s=>s[rnd(s.length)]);
   while(c.length<len)c.push(pool[rnd(pool.length)]);
   for(let i=c.length-1;i>0;i--){const j=rnd(i+1);[c[i],c[j]]=[c[j],c[i]]}
   pw=c.join('');o.textContent=pw;
   const bits=Math.round(len*Math.log2(pool.length));st.textContent='Kekuatan: '+(bits<40?'lemah':bits<60?'cukup':bits<80?'kuat':'sangat kuat')+' (sekitar '+bits+' bit)'};
  L.oninput=()=>{$(r,'#glv').textContent=L.value;gen()};
  r.querySelectorAll('input[type=checkbox]').forEach(c=>c.onchange=gen);
  $(r,'#rg').onclick=gen;
  $(r,'#cp').onclick=e=>{if(pw)copy(pw,e.target)};gen()}},
{id:'pengubah-satuan',name:'Pengubah Satuan',desc:'Ubah satuan panjang, berat, suhu, volume, luas, kecepatan, data, dan waktu dengan cepat. Diproses di browser.',
 html:()=>`<label for="uk">Jenis</label><select id="uk"></select>
<label for="uv">Nilai</label><input id="uv" inputmode="decimal" autocomplete="off" value="1">
<label for="ua">Dari</label><select id="ua"></select>
<label for="ub">Ke</label><select id="ub"></select>
<div class="row"><button type="button" id="sw">Tukar satuan</button></div>
<div class="out"><code id="o"></code><div class="row"><button class="primary" id="cp">Salin hasil</button></div></div>`,
 init:r=>{const U={'Panjang':[['mm',.001],['cm',.01],['m',1],['km',1000],['inci',.0254],['kaki',.3048],['yard',.9144],['mil',1609.344]],
   'Berat':[['mg',1e-6],['g',.001],['kg',1],['ton',1000],['ons',.0283495],['pon (lb)',.45359237]],
   'Suhu':[['Celsius'],['Fahrenheit'],['Kelvin']],
   'Volume':[['ml',.001],['liter',1],['m³',1000],['sendok teh',.00492892],['sendok makan',.0147868],['cangkir',.236588],['galon AS',3.78541]],
   'Luas':[['cm²',1e-4],['m²',1],['hektare',1e4],['km²',1e6],['are',100],['kaki²',.092903],['acre',4046.86]],
   'Kecepatan':[['m/s',1],['km/jam',1/3.6],['mil/jam',.44704],['knot',.514444]],
   'Data':[['bit',.125],['byte',1],['KB',1024],['MB',1048576],['GB',1073741824],['TB',1099511627776]],
   'Waktu':[['detik',1],['menit',60],['jam',3600],['hari',86400],['minggu',604800],['bulan (30 hari)',2592000],['tahun (365 hari)',31536000]]};
  const k=$(r,'#uk'),a=$(r,'#ua'),b=$(r,'#ub'),v=$(r,'#uv'),o=$(r,'#o');let out='';
  k.innerHTML=Object.keys(U).map(x=>`<option>${x}</option>`).join('');
  const fill=()=>{const h=U[k.value].map((x,i)=>`<option value="${i}">${esc(x[0])}</option>`).join('');a.innerHTML=h;b.innerHTML=h;b.value=U[k.value].length>1?'1':'0';calc()};
  const fmt=n=>Number(n.toPrecision(10)).toLocaleString('id-ID',{maximumFractionDigits:8});
  const calc=()=>{const x=parseFloat(v.value.replace(',','.'));if(!isFinite(x)){out='';o.textContent='Isi nilai angka.';return}
   const s=U[k.value],i=+a.value,j=+b.value;let y;
   if(k.value==='Suhu'){const c=i===0?x:i===1?(x-32)*5/9:x-273.15;y=j===0?c:j===1?c*9/5+32:c+273.15}
   else y=x*s[i][1]/s[j][1];
   out=fmt(y)+' '+s[j][0];o.textContent=fmt(x)+' '+s[i][0]+' = '+out};
  k.onchange=fill;a.onchange=b.onchange=v.oninput=calc;
  $(r,'#sw').onclick=()=>{const t=a.value;a.value=b.value;b.value=t;calc()};
  $(r,'#cp').onclick=e=>{if(out)copy(out,e.target)};fill()}},
{id:'hitung-kata',name:'Hitung Kata',desc:'Hitung kata, karakter, kalimat, dan perkiraan waktu baca dari teks. Bisa juga mengubah huruf besar atau kecil. Diproses di browser.',
 html:()=>`<label for="t">Teks</label><textarea id="t" rows="8" placeholder="Tempel atau ketik teks di sini..."></textarea>
<div class="chips" id="hc"><button type="button" data-a="u">HURUF BESAR</button><button type="button" data-a="l">huruf kecil</button><button type="button" data-a="t">Kapital Tiap Kata</button><button type="button" data-a="s">Rapikan spasi</button></div>
<div class="out"><table class="ktb"><tr><th>Kata</th><td id="w">0</td></tr><tr><th>Karakter</th><td id="c">0</td></tr><tr><th>Karakter tanpa spasi</th><td id="cs">0</td></tr><tr><th>Kalimat</th><td id="k">0</td></tr><tr><th>Paragraf</th><td id="p">0</td></tr><tr><th>Waktu baca</th><td id="rt">0 detik</td></tr></table></div>`,
 init:r=>{const t=$(r,'#t');
  const up=()=>{const s=t.value,w=(s.trim().match(/\S+/g)||[]).length,sec=Math.round(w/200*60);
   $(r,'#w').textContent=w.toLocaleString('id-ID');$(r,'#c').textContent=s.length.toLocaleString('id-ID');$(r,'#cs').textContent=s.replace(/\s/g,'').length.toLocaleString('id-ID');
   $(r,'#k').textContent=(s.match(/[^.!?\n]+[.!?]*/g)||[]).filter(x=>/\w/.test(x)).length;
   $(r,'#p').textContent=s.split(/\n\s*\n/).filter(x=>x.trim()).length;
   $(r,'#rt').textContent=sec<60?sec+' detik':Math.floor(sec/60)+' menit '+(sec%60)+' detik'};
  t.oninput=up;
  $(r,'#hc').onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(!a)return;let s=t.value;
   if(a==='u')s=s.toUpperCase();else if(a==='l')s=s.toLowerCase();
   else if(a==='t')s=s.toLowerCase().replace(/(^|\s)(\S)/g,(_,x,y)=>x+y.toUpperCase());
   else s=s.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
   t.value=s;up()};up()}},
{id:'kalkulator-zakat',name:'Kalkulator Zakat',desc:'Hitung zakat penghasilan, zakat maal (tabungan dan harta), atau zakat emas berdasarkan nisab 85 gram emas. Diproses di browser.',
 html:()=>`<label for="zj">Jenis zakat</label><select id="zj"><option value="p">Zakat penghasilan</option><option value="m">Zakat maal (tabungan dan harta)</option><option value="e">Zakat emas</option></select>
<label for="zg">Harga emas per gram hari ini (Rp)</label><input id="zg" inputmode="numeric" autocomplete="off" placeholder="1.500.000">
<div id="zf-p"><label for="zp">Penghasilan per bulan (Rp)</label><input id="zp" inputmode="numeric" autocomplete="off" placeholder="10.000.000"><label for="zb">Bonus atau penghasilan lain per bulan (Rp)</label><input id="zb" inputmode="numeric" autocomplete="off" placeholder="0"></div>
<div id="zf-m" hidden><label for="zh">Total harta yang sudah dimiliki 1 tahun (Rp)</label><input id="zh" inputmode="numeric" autocomplete="off" placeholder="150.000.000"><label for="zu">Utang yang jatuh tempo (Rp)</label><input id="zu" inputmode="numeric" autocomplete="off" placeholder="0"></div>
<div id="zf-e" hidden><label for="zw">Emas yang disimpan 1 tahun (gram)</label><input id="zw" inputmode="decimal" autocomplete="off" placeholder="100"></div>
<div class="row"><button class="primary" id="go">Hitung zakat</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const m=$(r,'#m'),res=$(r,'#res'),j=$(r,'#zj');
  ['#zg','#zp','#zb','#zh','#zu'].forEach(x=>fmtIn($(r,x)));
  j.onchange=()=>{['p','m','e'].forEach(k=>{$(r,'#zf-'+k).hidden=k!==j.value});res.innerHTML='';m.textContent=''};
  $(r,'#go').onclick=()=>{const bad=t=>{m.className='msg bad';m.textContent=t;res.innerHTML=''};
   const gold=numVal($(r,'#zg'));if(!(gold>0))return bad('Isi harga emas per gram dulu. Cek harga terbaru di situs toko emas.');
   const nisab=85*gold,k=j.value;let basis,limit,label,zakat,wajib,note;
   if(k==='p'){basis=numVal($(r,'#zp'))+numVal($(r,'#zb'));if(!(basis>0))return bad('Isi penghasilan per bulan.');limit=nisab/12;label='Penghasilan per bulan';wajib=basis>=limit;zakat=basis*.025;note='Nisab per bulan dihitung dari nisab setahun (85 gram emas) dibagi 12.'}
   else if(k==='m'){basis=numVal($(r,'#zh'))-numVal($(r,'#zu'));if(!(basis>0))return bad('Isi total harta, dikurangi utang yang jatuh tempo.');limit=nisab;label='Harta bersih';wajib=basis>=limit;zakat=basis*.025;note='Harta wajib sudah dimiliki penuh selama satu tahun (haul).'}
   else{const w=parseFloat($(r,'#zw').value.replace(',','.'));if(!(w>0))return bad('Isi jumlah emas dalam gram.');basis=w;limit=85;label='Emas';wajib=w>=85;zakat=w*.025*gold;note='Emas wajib sudah disimpan selama satu tahun (haul).'}
   m.className='msg';m.textContent='';
   const fb=k==='e'?basis.toLocaleString('id-ID')+' gram':rp(Math.round(basis)),fl=k==='e'?'85 gram':rp(Math.round(limit));
   res.innerHTML=`<div class="out"><p class="hint" style="margin:0">${wajib?'Zakat yang perlu dikeluarkan':'Belum mencapai nisab'}</p><p style="font-size:28px;font-weight:800;margin:4px 0 12px">${wajib?(k==='e'?rp(Math.round(zakat)):rp(Math.round(zakat))):'Rp0'}</p>
<table class="ktb"><tr><th>${label}</th><td>${fb}</td></tr><tr><th>Batas nisab</th><td>${fl}</td></tr><tr><th>Nisab setahun (85 g emas)</th><td>${rp(Math.round(nisab))}</td></tr><tr><th>Tarif</th><td>2,5%</td></tr></table>
<p class="hint" style="margin:12px 0 0">${note} Ini perkiraan. Untuk kepastian, tanyakan ke BAZNAS atau lembaga zakat terdekat.</p></div>`}}},
{id:'tanda-tangan',name:'Generator Tanda Tangan',desc:'Gambar tanda tangan dengan jari atau mouse, lalu unduh sebagai PNG berlatar transparan yang dipotong rapi. Diproses di perangkatmu.',
 html:()=>`<canvas id="sg" width="720" height="280" style="width:100%;aspect-ratio:720/280;background:#fff;border-radius:12px;touch-action:none;display:block;cursor:crosshair" aria-label="Area menggambar tanda tangan"></canvas>
<label for="sc">Warna tinta</label><select id="sc"><option value="#111111">Hitam</option><option value="#1e3a8a">Biru tua</option><option value="#7f1d1d">Merah tua</option></select>
<label for="sw">Ketebalan: <span id="swv">4</span></label><input id="sw" type="range" min="2" max="10" value="4">
<div class="row"><button class="primary" id="dl">Unduh PNG</button><button type="button" id="cl">Hapus</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#sg'),cx=cv.getContext('2d'),m=$(r,'#m');let on=false,last=null,box=null;
  const pos=e=>{const b=cv.getBoundingClientRect();return[(e.clientX-b.left)*cv.width/b.width,(e.clientY-b.top)*cv.height/b.height]};
  const st=()=>{cx.strokeStyle=$(r,'#sc').value;cx.lineWidth=+$(r,'#sw').value*1.6;cx.lineCap='round';cx.lineJoin='round'};
  const mark=p=>{const w=cx.lineWidth;box=box?[Math.min(box[0],p[0]-w),Math.min(box[1],p[1]-w),Math.max(box[2],p[0]+w),Math.max(box[3],p[1]+w)]:[p[0]-w,p[1]-w,p[0]+w,p[1]+w]};
  cv.onpointerdown=e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);on=true;st();last=pos(e);mark(last);cx.beginPath();cx.arc(last[0],last[1],cx.lineWidth/2,0,7);cx.fillStyle=cx.strokeStyle;cx.fill();m.textContent=''};
  cv.onpointermove=e=>{if(!on)return;const p=pos(e);cx.beginPath();cx.moveTo(last[0],last[1]);cx.lineTo(p[0],p[1]);cx.stroke();mark(p);last=p};
  cv.onpointerup=cv.onpointercancel=()=>{on=false};
  $(r,'#sw').oninput=()=>{$(r,'#swv').textContent=$(r,'#sw').value};
  $(r,'#cl').onclick=()=>{cx.clearRect(0,0,cv.width,cv.height);box=null;m.textContent=''};
  $(r,'#dl').onclick=()=>{if(!box){m.className='msg bad';m.textContent='Gambar tanda tangan dulu.';return}
   const pad=16,x=Math.max(0,box[0]-pad),y=Math.max(0,box[1]-pad),w=Math.min(cv.width,box[2]+pad)-x,h=Math.min(cv.height,box[3]+pad)-y;
   const o=document.createElement('canvas');o.width=Math.round(w);o.height=Math.round(h);o.getContext('2d').drawImage(cv,x,y,w,h,0,0,o.width,o.height);
   o.toBlob(b=>{if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='tanda-tangan.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);m.className='msg';m.textContent='Tanda tangan diunduh sebagai PNG transparan.'},'image/png')}}},
{id:'kalkulator-umur',name:'Kalkulator Umur',desc:'Hitung umur tepat dalam tahun, bulan, dan hari, lengkap dengan hari lahir dan hitung mundur ulang tahun berikutnya. Diproses di browser.',
 html:()=>`<label for="ub">Tanggal lahir</label><input id="ub" type="date">
<label for="ua">Hitung sampai tanggal</label><input id="ua" type="date">
<div class="out"><code id="o">Isi tanggal lahir untuk melihat umur.</code><table class="ktb" id="tb" hidden></table></div>`,
 init:r=>{const b=$(r,'#ub'),a=$(r,'#ua'),o=$(r,'#o'),tb=$(r,'#tb'),n=new Date();
  a.value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  const P=s=>{const x=s.split('-').map(Number);return{y:x[0],m:x[1],d:x[2]}},U=p=>Date.UTC(p.y,p.m-1,p.d),HR=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const calc=()=>{if(!b.value||!a.value){tb.hidden=true;o.textContent='Isi tanggal lahir untuk melihat umur.';return}
   const B=P(b.value),A=P(a.value);if(U(B)>U(A)){tb.hidden=true;o.textContent='Tanggal lahir harus sebelum tanggal hitung.';return}
   let y=A.y-B.y,mo=A.m-B.m,d=A.d-B.d;let my=A.y,mm=A.m-1;while(d<0){mo--;d+=new Date(Date.UTC(my,mm,0)).getUTCDate();mm--;if(mm<1){mm=12;my--}}while(mo<0){y--;mo+=12}
   const tot=Math.floor((U(A)-U(B))/864e5);let nx=Date.UTC(A.y,B.m-1,B.d);if(nx<U(A))nx=Date.UTC(A.y+1,B.m-1,B.d);const left=Math.round((nx-U(A))/864e5);
   o.textContent=y+' tahun '+mo+' bulan '+d+' hari';tb.hidden=false;
   tb.innerHTML=`<tr><th>Total hari</th><td>${tot.toLocaleString('id-ID')}</td></tr><tr><th>Total minggu</th><td>${Math.floor(tot/7).toLocaleString('id-ID')}</td></tr><tr><th>Total bulan</th><td>${(y*12+mo).toLocaleString('id-ID')}</td></tr><tr><th>Hari lahir</th><td>${HR[new Date(U(B)).getUTCDay()]}</td></tr><tr><th>Ulang tahun berikutnya</th><td>${left===0?'Hari ini':left+' hari lagi'}</td></tr>`};
  b.oninput=a.oninput=calc;calc()}},
{id:'kalkulator-diskon',name:'Kalkulator Diskon',desc:'Hitung harga setelah diskon, diskon bertingkat, dan PPN 11 persen, lengkap dengan jumlah yang dihemat. Diproses di browser.',
 html:()=>`<label for="dh">Harga satuan (Rp)</label><input id="dh" inputmode="numeric" autocomplete="off" placeholder="250.000">
<label for="dq">Jumlah barang</label><input id="dq" type="number" inputmode="numeric" min="1" max="100000" value="1">
<label for="d1">Diskon (%)</label><input id="d1" inputmode="decimal" autocomplete="off" placeholder="20">
<label for="d2">Diskon tambahan (%), opsional</label><input id="d2" inputmode="decimal" autocomplete="off" placeholder="0">
<label><input type="checkbox" id="dp"> Tambahkan PPN 11%</label>
<div class="out"><code id="o">Isi harga untuk melihat hasil.</code><table class="ktb" id="tb" hidden></table></div>`,
 init:r=>{const h=$(r,'#dh'),o=$(r,'#o'),tb=$(r,'#tb');fmtIn(h);
  const pc=id=>{const v=parseFloat($(r,id).value.replace(',','.'));return isFinite(v)?Math.min(100,Math.max(0,v)):0};
  const calc=()=>{const p=numVal(h),q=Math.max(1,parseInt($(r,'#dq').value,10)||1);if(!(p>0)){tb.hidden=true;o.textContent='Isi harga untuk melihat hasil.';return}
   const base=p*q,a1=base*(1-pc('#d1')/100),a2=a1*(1-pc('#d2')/100),ppn=$(r,'#dp').checked?a2*.11:0,fin=a2+ppn;
   o.textContent=rp(Math.round(fin));tb.hidden=false;
   tb.innerHTML=`<tr><th>Harga normal</th><td>${rp(Math.round(base))}</td></tr><tr><th>Setelah diskon</th><td>${rp(Math.round(a2))}</td></tr><tr><th>Kamu hemat</th><td>${rp(Math.round(base-a2))} (${(base?(1-a2/base)*100:0).toLocaleString('id-ID',{maximumFractionDigits:1})}%)</td></tr>${ppn?`<tr><th>PPN 11%</th><td>${rp(Math.round(ppn))}</td></tr>`:''}<tr><th>Total bayar</th><td>${rp(Math.round(fin))}</td></tr>`};
  r.querySelectorAll('input').forEach(i=>{i.oninput=i.onchange=calc});calc()}},
{id:'kalkulator-bmi',name:'Kalkulator BMI',desc:'Hitung indeks massa tubuh (BMI) dari tinggi dan berat badan, lengkap dengan rentang berat badan normal untuk tinggimu. Diproses di browser.',
 html:()=>`<label for="bt">Tinggi badan (cm)</label><input id="bt" type="number" inputmode="decimal" min="100" max="250" step="0.1" placeholder="165">
<label for="bw">Berat badan (kg)</label><input id="bw" type="number" inputmode="decimal" min="20" max="300" step="0.1" placeholder="60">
<div class="row"><button class="primary" id="go">Hitung BMI</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const m=$(r,'#m'),res=$(r,'#res');
  $(r,'#go').onclick=()=>{const bad=t=>{m.className='msg bad';m.textContent=t;res.innerHTML=''};
   const h=parseFloat($(r,'#bt').value.replace(',','.')),w=parseFloat($(r,'#bw').value.replace(',','.'));
   if(!(h>=100&&h<=250))return bad('Isi tinggi badan antara 100 dan 250 cm.');
   if(!(w>=20&&w<=300))return bad('Isi berat badan antara 20 dan 300 kg.');
   const hm=h/100,bmi=w/(hm*hm),cat=bmi<18.5?'Berat badan kurang':bmi<25?'Berat badan normal':bmi<30?'Berat badan berlebih':'Obesitas',
    lo=18.5*hm*hm,hi=24.9*hm*hm,f=n=>n.toLocaleString('id-ID',{maximumFractionDigits:1});
   m.className='msg';m.textContent='';
   res.innerHTML=`<div class="out"><p class="hint" style="margin:0">${cat}</p><p style="font-size:28px;font-weight:800;margin:4px 0 12px">BMI ${f(bmi)}</p>
<table class="ktb"><tr><th>Berat normal untuk ${f(h)} cm</th><td>${f(lo)} sampai ${f(hi)} kg</td></tr><tr><th>Kurang</th><td>di bawah 18,5</td></tr><tr><th>Normal</th><td>18,5 sampai 24,9</td></tr><tr><th>Berlebih</th><td>25 sampai 29,9</td></tr><tr><th>Obesitas</th><td>30 atau lebih</td></tr></table>
<p class="hint" style="margin:12px 0 0">Kategori mengikuti standar WHO untuk orang dewasa. BMI hanya gambaran kasar dan bukan diagnosis, jadi tanyakan ke dokter untuk penilaian kesehatanmu.</p></div>`}}},
{id:'split-bill',name:'Pemisah Tagihan',desc:'Bagi tagihan makan atau patungan ke beberapa orang, termasuk pajak dan service charge, dengan opsi pembulatan. Diproses di browser.',
 html:()=>`<label for="sb">Total tagihan sebelum pajak (Rp)</label><input id="sb" inputmode="numeric" autocomplete="off" placeholder="450.000">
<label for="sp">Pajak (%)</label><input id="sp" inputmode="decimal" autocomplete="off" value="10">
<label for="ss">Service charge (%)</label><input id="ss" inputmode="decimal" autocomplete="off" value="0">
<label for="sn">Jumlah orang</label><input id="sn" type="number" inputmode="numeric" min="1" max="500" value="2">
<label><input type="checkbox" id="sr" checked> Bulatkan ke atas per Rp1.000</label>
<div class="out"><code id="o">Isi total tagihan untuk melihat hasil.</code><table class="ktb" id="tb" hidden></table><div class="row" id="cr" hidden><button class="primary" id="cp">Salin hasil</button></div></div>`,
 init:r=>{const b=$(r,'#sb'),o=$(r,'#o'),tb=$(r,'#tb'),cr=$(r,'#cr');let txt='';fmtIn(b);
  const pc=id=>{const v=parseFloat($(r,id).value.replace(',','.'));return isFinite(v)?Math.min(100,Math.max(0,v)):0};
  const calc=()=>{const base=numVal(b),n=Math.max(1,Math.min(500,parseInt($(r,'#sn').value,10)||1));
   if(!(base>0)){tb.hidden=true;cr.hidden=true;txt='';o.textContent='Isi total tagihan untuk melihat hasil.';return}
   const svc=base*pc('#ss')/100,tax=(base+svc)*pc('#sp')/100,total=base+svc+tax;let per=total/n;if($(r,'#sr').checked)per=Math.ceil(per/1000)*1000;
   const pay=per*n;o.textContent=rp(Math.round(per))+' per orang';txt='Tagihan '+rp(Math.round(total))+' dibagi '+n+' orang: '+rp(Math.round(per))+' per orang';
   tb.hidden=false;cr.hidden=false;
   tb.innerHTML=`<tr><th>Tagihan awal</th><td>${rp(Math.round(base))}</td></tr>${svc?`<tr><th>Service charge</th><td>${rp(Math.round(svc))}</td></tr>`:''}${tax?`<tr><th>Pajak</th><td>${rp(Math.round(tax))}</td></tr>`:''}<tr><th>Total tagihan</th><td>${rp(Math.round(total))}</td></tr><tr><th>Jumlah orang</th><td>${n}</td></tr><tr><th>Terkumpul dari semua</th><td>${rp(Math.round(pay))}</td></tr>`};
  r.querySelectorAll('input').forEach(i=>{const f=i.oninput;i.oninput=e=>{if(f)f(e);calc()};i.onchange=calc});
  $(r,'#cp').onclick=e=>{if(txt)copy(txt,e.target)};calc()}},
{id:'nomor-acak',name:'Nomor Acak dan Undian',desc:'Acak angka dalam rentang tertentu atau undi pemenang dari daftar nama. Hasil adil karena memakai pengacak aman dari browser.',
 html:()=>`<label for="nm">Mode</label><select id="nm"><option value="a">Angka acak</option><option value="n">Undi dari daftar nama</option></select>
<div id="fa"><label for="n1">Angka terkecil</label><input id="n1" type="number" inputmode="numeric" value="1"><label for="n2">Angka terbesar</label><input id="n2" type="number" inputmode="numeric" value="100"><label for="nc">Berapa angka</label><input id="nc" type="number" inputmode="numeric" min="1" max="1000" value="1"><label><input type="checkbox" id="nu" checked> Tanpa angka kembar</label></div>
<div id="fn" hidden><label for="nl">Daftar nama (satu nama per baris)</label><textarea id="nl" rows="6" placeholder="Andi&#10;Budi&#10;Citra"></textarea><label for="nw">Jumlah pemenang</label><input id="nw" type="number" inputmode="numeric" min="1" max="1000" value="1"></div>
<div class="row"><button class="primary" id="go">Acak sekarang</button></div><p class="msg" id="m" role="status"></p>
<div class="out" id="ou" hidden><code id="o"></code><div class="row"><button type="button" id="cp">Salin hasil</button></div></div>`,
 init:r=>{const m=$(r,'#m'),o=$(r,'#o'),ou=$(r,'#ou'),md=$(r,'#nm');let txt='';
  const rnd=n=>{const a=new Uint32Array(1),lim=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=lim);return a[0]%n};
  const pick=(arr,k)=>{const c=arr.slice();for(let i=0;i<k;i++){const j=i+rnd(c.length-i);[c[i],c[j]]=[c[j],c[i]]}return c.slice(0,k)};
  md.onchange=()=>{$(r,'#fa').hidden=md.value!=='a';$(r,'#fn').hidden=md.value!=='n';ou.hidden=true;m.textContent=''};
  $(r,'#go').onclick=()=>{const bad=t=>{m.className='msg bad';m.textContent=t;ou.hidden=true};let out;
   if(md.value==='a'){const lo=parseInt($(r,'#n1').value,10),hi=parseInt($(r,'#n2').value,10),k=parseInt($(r,'#nc').value,10),u=$(r,'#nu').checked;
    if(!isFinite(lo)||!isFinite(hi)||!(k>=1&&k<=1000))return bad('Isi angka terkecil, terbesar, dan jumlahnya (1 sampai 1000).');
    if(lo>hi)return bad('Angka terkecil harus lebih kecil dari angka terbesar.');
    if(Math.abs(lo)>1e9||Math.abs(hi)>1e9)return bad('Rentang angka maksimal 1 miliar.');
    const size=hi-lo+1;if(u&&k>size)return bad('Rentang hanya berisi '+size+' angka, kurang dari '+k+'. Kecilkan jumlahnya atau izinkan angka kembar.');
    if(!u){out=Array.from({length:k},()=>lo+rnd(size))}
    else if(size<=100000){out=pick(Array.from({length:size},(_,i)=>lo+i),k)}
    else{const s=new Set();while(s.size<k)s.add(lo+rnd(size));out=[...s]}
    out=out.map(x=>x.toLocaleString('id-ID')).join(', ')}
   else{const names=$(r,'#nl').value.split('\n').map(x=>x.trim()).filter(Boolean),k=parseInt($(r,'#nw').value,10);
    if(names.length<1)return bad('Isi daftar nama dulu.');
    if(!(k>=1))return bad('Isi jumlah pemenang.');
    if(k>names.length)return bad('Jumlah pemenang melebihi jumlah nama ('+names.length+').');
    out=pick(names,k).map((x,i)=>(k>1?(i+1)+'. ':'')+x).join('\n')}
   txt=out;o.textContent=out;o.style.whiteSpace='pre-wrap';ou.hidden=false;m.className='msg';m.textContent=''};
  $(r,'#cp').onclick=e=>{if(txt)copy(txt,e.target)}}},
{id:'daftar-tugas',name:'Daftar Tugas',desc:'Catat tugas atau daftar belanja, centang yang sudah selesai. Tersimpan di browser perangkatmu, tidak dikirim ke server.',
 html:()=>`<label for="tt">Tugas baru</label><input id="tt" maxlength="120" autocomplete="off" placeholder="Contoh: beli beras 5 kg">
<div class="row"><button class="primary" id="ta">Tambah</button><button type="button" id="tc">Hapus yang selesai</button></div>
<p class="hint" id="tn" style="margin:12px 0 4px"></p><ul id="tl" style="list-style:none;margin:0;padding:0"></ul>`,
 init:r=>{const K='mt_todo',inp=$(r,'#tt'),ul=$(r,'#tl'),tn=$(r,'#tn');let items=Array.isArray(ls.get(K))?ls.get(K).filter(x=>x&&typeof x.t==='string'):[];
  const save=()=>ls.set(K,items);
  const draw=()=>{const left=items.filter(x=>!x.d).length;tn.textContent=items.length?left+' belum selesai dari '+items.length+' tugas':'Belum ada tugas. Tambahkan yang pertama.';
   ul.innerHTML=items.map((x,i)=>`<li style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bd)"><input type="checkbox" data-i="${i}" ${x.d?'checked':''} aria-label="Selesai"><span style="flex:1;word-break:break-word;${x.d?'text-decoration:line-through;opacity:.6':''}">${esc(x.t)}</span><button type="button" data-x="${i}" aria-label="Hapus tugas">×</button></li>`).join('')};
  const add=()=>{const t=inp.value.trim().slice(0,120);if(!t)return;items.unshift({t,d:false});if(items.length>200)items.length=200;inp.value='';save();draw();inp.focus()};
  $(r,'#ta').onclick=add;inp.onkeydown=e=>{if(e.key==='Enter')add()};
  $(r,'#tc').onclick=()=>{items=items.filter(x=>!x.d);save();draw()};
  ul.onchange=e=>{const i=e.target.dataset&&e.target.dataset.i;if(i===undefined||!items[i])return;items[i].d=e.target.checked;save();draw()};
  ul.onclick=e=>{const i=e.target.dataset&&e.target.dataset.x;if(i===undefined)return;items.splice(+i,1);save();draw()};draw()}},
{id:'kode-warna',name:'Kode Warna dan Palet',desc:'Pilih warna lalu dapatkan kode HEX, RGB, dan HSL, plus palet warna serasi yang bisa disalin satu per satu. Diproses di browser.',
 html:()=>`<label for="cw">Pilih warna</label><input id="cw" type="color" value="#8f9aff" style="width:100%;height:56px;padding:4px">
<label for="ch">Atau tulis kode HEX</label><input id="ch" autocomplete="off" maxlength="7" value="#8f9aff" placeholder="#8f9aff">
<div class="out"><table class="ktb"><tr><th>HEX</th><td id="vh"></td></tr><tr><th>RGB</th><td id="vr"></td></tr><tr><th>HSL</th><td id="vl"></td></tr></table></div>
<div id="pal"></div>`,
 init:r=>{const cw=$(r,'#cw'),ch=$(r,'#ch'),pal=$(r,'#pal');
  const h2r=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),r2h=(a,b,c)=>'#'+[a,b,c].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');
  const r2l=(R,G,B)=>{R/=255;G/=255;B/=255;const mx=Math.max(R,G,B),mn=Math.min(R,G,B),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===R?(G-B)/d+(G<B?6:0):mx===G?(B-R)/d+2:(R-G)/d+4;h*=60}return[h,s*100,l*100]};
  const l2h=(h,s,l)=>{h=((h%360)+360)%360;s/=100;l/=100;const f=n=>{const k=(n+h/30)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return r2h(f(0)*255,f(8)*255,f(4)*255)};
  const ink=hx=>{const[R,G,B]=h2r(hx).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});const L=.2126*R+.7152*G+.0722*B;return(L+.05)/.05>=1.05/(L+.05)?'#111111':'#ffffff'};
  const sw=(hx,t)=>`<button type="button" data-c="${hx}" style="background:${hx};color:${ink(hx)};min-width:92px;padding:14px 8px;border-radius:10px;border:1px solid var(--bd);flex:1 1 92px">${hx.toUpperCase()}</button>`;
  const row=(t,a)=>`<p class="hint" style="margin:16px 0 6px">${t}</p><div style="display:flex;flex-wrap:wrap;gap:8px">${a.map(x=>sw(x)).join('')}</div>`;
  const draw=hx=>{const[R,G,B]=h2r(hx),[H,S,L]=r2l(R,G,B);
   $(r,'#vh').textContent=hx.toUpperCase();$(r,'#vr').textContent='rgb('+R+', '+G+', '+B+')';$(r,'#vl').textContent='hsl('+Math.round(H)+', '+Math.round(S)+'%, '+Math.round(L)+'%)';
   pal.innerHTML=row('Lebih terang dan lebih gelap',[l2h(H,S,85),l2h(H,S,70),hx,l2h(H,S,35),l2h(H,S,20)])+row('Komplementer',[hx,l2h(H+180,S,L)])+row('Analog',[l2h(H-30,S,L),hx,l2h(H+30,S,L)])+row('Triad',[hx,l2h(H+120,S,L),l2h(H+240,S,L)])};
  const norm=v=>{v=v.trim().replace(/^#/,'');if(/^[0-9a-fA-F]{3}$/.test(v))v=v.split('').map(c=>c+c).join('');return/^[0-9a-fA-F]{6}$/.test(v)?'#'+v.toLowerCase():''};
  cw.oninput=()=>{ch.value=cw.value;draw(cw.value)};
  ch.oninput=()=>{const n=norm(ch.value);if(n){cw.value=n;draw(n)}};
  r.onclick=e=>{const b=e.target.closest&&e.target.closest('button[data-c]');if(b)copy(b.dataset.c.toUpperCase(),b)};
  draw(cw.value)}},
{id:'hitung-hari',name:'Penghitung Hari',desc:'Hitung selisih hari antara dua tanggal (termasuk hari kerja) atau cari tanggal setelah sekian hari. Diproses di browser.',
 html:()=>`<label for="hm">Mode</label><select id="hm"><option value="s">Selisih dua tanggal</option><option value="t">Tambah atau kurangi hari</option></select>
<label for="h1">Tanggal awal</label><input id="h1" type="date">
<div id="fs"><label for="h2">Tanggal akhir</label><input id="h2" type="date"></div>
<div id="ft" hidden><label for="hn">Jumlah hari (minus untuk mundur)</label><input id="hn" type="number" inputmode="numeric" min="-36500" max="36500" value="30"></div>
<div class="out"><code id="o">Isi tanggal untuk melihat hasil.</code><table class="ktb" id="tb" hidden></table></div>`,
 init:r=>{const hm=$(r,'#hm'),h1=$(r,'#h1'),h2=$(r,'#h2'),o=$(r,'#o'),tb=$(r,'#tb'),n=new Date();
  h1.value=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  const P=s=>{const x=s.split('-').map(Number);return{y:x[0],m:x[1],d:x[2]}},U=p=>Date.UTC(p.y,p.m-1,p.d),L=u=>new Date(u).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const calc=()=>{$(r,'#fs').hidden=hm.value!=='s';$(r,'#ft').hidden=hm.value!=='t';
   if(!h1.value){tb.hidden=true;o.textContent='Isi tanggal untuk melihat hasil.';return}
   if(hm.value==='t'){const k=parseInt($(r,'#hn').value,10);if(!isFinite(k)||Math.abs(k)>36500){tb.hidden=true;o.textContent='Isi jumlah hari antara -36500 dan 36500.';return}
    const u=U(P(h1.value))+k*864e5;o.textContent=L(u);tb.hidden=true;return}
   if(!h2.value){tb.hidden=true;o.textContent='Isi tanggal akhir untuk melihat selisih.';return}
   let A=P(h1.value),B=P(h2.value);if(U(A)>U(B))[A,B]=[B,A];
   const tot=Math.round((U(B)-U(A))/864e5);let y=B.y-A.y,mo=B.m-A.m,d=B.d-A.d,my=B.y,mm=B.m-1;
   while(d<0){mo--;d+=new Date(Date.UTC(my,mm,0)).getUTCDate();mm--;if(mm<1){mm=12;my--}}while(mo<0){y--;mo+=12}
   let kerja=0;for(let i=0;i<=tot&&i<=200000;i++){const w=new Date(U(A)+i*864e5).getUTCDay();if(w!==0&&w!==6)kerja++}
   o.textContent=tot.toLocaleString('id-ID')+' hari';tb.hidden=false;
   tb.innerHTML=`<tr><th>Dalam tahun, bulan, hari</th><td>${y} tahun ${mo} bulan ${d} hari</td></tr><tr><th>Dalam minggu</th><td>${Math.floor(tot/7).toLocaleString('id-ID')} minggu ${tot%7} hari</td></tr><tr><th>Hari kerja (Senin sampai Jumat)</th><td>${kerja.toLocaleString('id-ID')} hari</td></tr><tr><th>Dari</th><td>${L(U(A))}</td></tr><tr><th>Sampai</th><td>${L(U(B))}</td></tr>`};
  r.querySelectorAll('input,select').forEach(i=>{i.oninput=i.onchange=calc});calc()}},
{id:'pembersih-teks',name:'Pembersih Teks',desc:'Rapikan teks sekali klik: hapus baris kosong atau duplikat, hapus emoji, buang nomor di awal baris, urutkan, dan balik urutan. Diproses di browser.',
 html:()=>`<label for="t">Teks</label><textarea id="t" rows="9" placeholder="Tempel teks di sini..."></textarea>
<div class="chips" id="hc"><button type="button" data-a="blank">Hapus baris kosong</button><button type="button" data-a="dup">Hapus baris duplikat</button><button type="button" data-a="emoji">Hapus emoji</button><button type="button" data-a="space">Rapikan spasi</button><button type="button" data-a="num">Buang nomor/bullet</button><button type="button" data-a="az">Urutkan A-Z</button><button type="button" data-a="rev">Balik urutan baris</button></div>
<div class="row"><button class="primary" id="cp">Salin hasil</button><button type="button" id="un">Urungkan</button></div><p class="hint" id="st" style="margin:12px 0 0"></p>`,
 init:r=>{const t=$(r,'#t'),st=$(r,'#st');let prev=null;
  const info=()=>{const l=t.value?t.value.split('\n').length:0;st.textContent=l+' baris, '+t.value.length.toLocaleString('id-ID')+' karakter'};
  const A={blank:s=>s.split('\n').filter(x=>x.trim()).join('\n'),
   dup:s=>{const seen=new Set();return s.split('\n').filter(x=>{const k=x.trim();if(!k)return true;if(seen.has(k))return false;seen.add(k);return true}).join('\n')},
   emoji:s=>s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,''),
   space:s=>s.replace(/[ \t]+/g,' ').split('\n').map(x=>x.trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim(),
   num:s=>s.split('\n').map(x=>x.replace(/^\s*(?:\d+[.)]|[-*\u2022])\s+/,'')).join('\n'),
   az:s=>s.split('\n').sort((a,b)=>a.localeCompare(b,'id')).join('\n'),
   rev:s=>s.split('\n').reverse().join('\n')};
  t.oninput=info;
  $(r,'#hc').onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(!a||!A[a])return;prev=t.value;t.value=A[a](t.value);info()};
  $(r,'#un').onclick=()=>{if(prev===null)return;const c=t.value;t.value=prev;prev=c;info()};
  $(r,'#cp').onclick=e=>{if(t.value)copy(t.value,e.target)};info()}},
{id:'kalkulator-kalori',name:'Kalkulator Kalori Harian',desc:'Perkirakan kebutuhan energi harian (BMR dan TDEE) dari umur, tinggi, berat, dan tingkat aktivitas. Diproses di browser.',
 html:()=>`<label for="kg">Jenis kelamin</label><select id="kg"><option value="m">Laki-laki</option><option value="f">Perempuan</option></select>
<label for="ku">Umur (tahun)</label><input id="ku" type="number" inputmode="numeric" min="15" max="90" placeholder="25">
<label for="kt">Tinggi badan (cm)</label><input id="kt" type="number" inputmode="decimal" min="120" max="230" placeholder="165">
<label for="kw">Berat badan (kg)</label><input id="kw" type="number" inputmode="decimal" min="30" max="250" placeholder="60">
<label for="ka">Aktivitas</label><select id="ka"><option value="1.2">Jarang bergerak (kerja duduk, tanpa olahraga)</option><option value="1.375">Ringan (olahraga 1 sampai 3 kali seminggu)</option><option value="1.55" selected>Sedang (olahraga 3 sampai 5 kali seminggu)</option><option value="1.725">Aktif (olahraga 6 sampai 7 kali seminggu)</option><option value="1.9">Sangat aktif (kerja fisik berat)</option></select>
<div class="row"><button class="primary" id="go">Hitung kebutuhan kalori</button></div><p class="msg" id="m" role="status"></p><div id="res"></div>`,
 init:r=>{const m=$(r,'#m'),res=$(r,'#res');
  $(r,'#go').onclick=()=>{const bad=t=>{m.className='msg bad';m.textContent=t;res.innerHTML=''};
   const u=parseFloat($(r,'#ku').value),h=parseFloat($(r,'#kt').value.replace(',','.')),w=parseFloat($(r,'#kw').value.replace(',','.')),act=parseFloat($(r,'#ka').value),male=$(r,'#kg').value==='m';
   if(!(u>=15&&u<=90))return bad('Isi umur antara 15 dan 90 tahun.');
   if(!(h>=120&&h<=230))return bad('Isi tinggi badan antara 120 dan 230 cm.');
   if(!(w>=30&&w<=250))return bad('Isi berat badan antara 30 dan 250 kg.');
   const bmr=10*w+6.25*h-5*u+(male?5:-161),tdee=bmr*act,f=n=>Math.round(n).toLocaleString('id-ID');
   m.className='msg';m.textContent='';
   res.innerHTML=`<div class="out"><p class="hint" style="margin:0">Perkiraan kebutuhan energi per hari</p><p style="font-size:28px;font-weight:800;margin:4px 0 12px">${f(tdee)} kkal</p>
<table class="ktb"><tr><th>BMR (energi saat istirahat)</th><td>${f(bmr)} kkal</td></tr><tr><th>TDEE (dengan aktivitas)</th><td>${f(tdee)} kkal</td></tr></table>
<p class="hint" style="margin:12px 0 0">Angka ini perkiraan untuk menjaga berat badan saat ini, memakai rumus Mifflin-St Jeor. Kebutuhan tiap orang berbeda, jadi tanyakan ke dokter atau ahli gizi sebelum mengubah pola makan.</p></div>`}}},
{id:'json-formatter',name:'JSON Formatter',desc:'Rapikan, padatkan, dan periksa JSON apakah valid. Diproses di browser, data tidak dikirim ke server.',
 html:()=>`<label for="t">JSON</label><textarea id="t" rows="10" spellcheck="false" placeholder='{"nama":"Malik","tool":53}'></textarea>
<label for="sp">Indentasi</label><select id="sp"><option value="2">2 spasi</option><option value="4">4 spasi</option><option value="t">Tab</option></select>
<div class="row"><button class="primary" id="go">Rapikan</button><button type="button" id="mn">Padatkan</button><button type="button" id="cp">Salin</button></div><p class="msg" id="m" role="status"></p>
<p class="hint" style="margin:0">Angka lebih dari 15 digit bisa berubah saat diproses karena batas presisi JavaScript.</p>`,
 init:r=>{const t=$(r,'#t'),m=$(r,'#m'),sp=$(r,'#sp');
  const run=min=>{if(!t.value.trim()){m.className='msg bad';m.textContent='Tempel JSON dulu.';return}
   try{const o=JSON.parse(t.value);t.value=min?JSON.stringify(o):JSON.stringify(o,null,sp.value==='t'?'\t':+sp.value);m.className='msg';m.textContent=min?'JSON valid dan sudah dipadatkan.':'JSON valid dan sudah dirapikan.'}
   catch(e){m.className='msg bad';m.textContent='JSON tidak valid: '+e.message}};
  $(r,'#go').onclick=()=>run(false);$(r,'#mn').onclick=()=>run(true);
  $(r,'#cp').onclick=e=>{if(t.value)copy(t.value,e.target)}}},
{id:'encode-decode',name:'Encode dan Decode',desc:'Ubah teks ke Base64 atau URL encoding, dan kembalikan lagi. Mendukung huruf Indonesia dan emoji. Diproses di browser.',
 html:()=>`<label for="em">Jenis</label><select id="em"><option value="b">Base64</option><option value="u">URL (persen)</option></select>
<label for="t">Teks</label><textarea id="t" rows="6" spellcheck="false" placeholder="Tempel teks di sini..."></textarea>
<div class="row"><button class="primary" id="en">Encode</button><button type="button" id="de">Decode</button></div><p class="msg" id="m" role="status"></p>
<div class="out" id="ou" hidden><code id="o" style="white-space:pre-wrap"></code><div class="row"><button class="primary" id="cp">Salin hasil</button></div></div>`,
 init:r=>{const t=$(r,'#t'),m=$(r,'#m'),o=$(r,'#o'),ou=$(r,'#ou'),md=$(r,'#em');let out='';
  const b64e=s=>{const b=new TextEncoder().encode(s);let x='';for(let i=0;i<b.length;i++)x+=String.fromCharCode(b[i]);return btoa(x)};
  const b64d=s=>{let x=s.replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');while(x.length%4)x+='=';const bin=atob(x);return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))};
  const go=d=>{if(!t.value){m.className='msg bad';m.textContent='Isi teks dulu.';ou.hidden=true;return}
   try{out=md.value==='b'?(d?b64d(t.value):b64e(t.value)):(d?decodeURIComponent(t.value):encodeURIComponent(t.value));o.textContent=out;ou.hidden=false;m.className='msg';m.textContent=d?'Berhasil di-decode.':'Berhasil di-encode.'}
   catch(e){ou.hidden=true;m.className='msg bad';m.textContent=md.value==='b'?'Teks bukan Base64 yang valid.':'Teks bukan URL encoding yang valid.'}};
  $(r,'#en').onclick=()=>go(false);$(r,'#de').onclick=()=>go(true);
  $(r,'#cp').onclick=e=>{if(out)copy(out,e.target)}}},
{id:'generator-hash',name:'Generator Hash',desc:'Hitung hash SHA-1, SHA-256, SHA-384, dan SHA-512 dari teks atau file, misalnya untuk memeriksa keaslian unduhan. Diproses di perangkatmu.',
 html:()=>`<label for="t">Teks</label><textarea id="t" rows="4" spellcheck="false" placeholder="Ketik teks untuk dihitung hash-nya..."></textarea>
<label class="drop" id="hd" for="hf"><span><b>Atau pilih file</b><span id="hi">Sampai 50 MB, tidak diunggah ke server.</span></span></label><input id="hf" type="file">
<p class="msg" id="m" role="status"></p><div class="out" id="ou" hidden></div>`,
 init:r=>{const t=$(r,'#t'),f=$(r,'#hf'),m=$(r,'#m'),ou=$(r,'#ou'),hi=$(r,'#hi'),h0=hi.textContent;let tok=0;
  const hx=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const run=async()=>{const my=++tok,x=f.files[0];let data,src;
   if(!(window.crypto&&crypto.subtle)){m.className='msg bad';m.textContent='Browser ini tidak mendukung perhitungan hash. Buka lewat HTTPS.';return}
   if(x){if(x.size>MAXIN){m.className='msg bad';m.textContent='Ukuran file maksimal 50 MB.';ou.hidden=true;return}data=await x.arrayBuffer();src='File: '+x.name}
   else if(t.value){data=new TextEncoder().encode(t.value);src='Teks ('+data.length+' byte)'}
   else{ou.hidden=true;m.textContent='';return}
   const A=['SHA-1','SHA-256','SHA-384','SHA-512'],H=await Promise.all(A.map(a=>crypto.subtle.digest(a,data).then(hx)));
   if(my!==tok)return;m.className='msg';m.textContent=src;ou.hidden=false;
   ou.innerHTML=A.map((a,i)=>`<p class="hint" style="margin:${i?14:0}px 0 4px">${a}</p><code style="display:block;word-break:break-all;margin-bottom:8px">${H[i]}</code><button type="button" data-c="${H[i]}">Salin ${a}</button>`).join('')};
  t.oninput=()=>{if(f.value)f.value='';hi.textContent=h0;run()};
  f.onchange=()=>{const x=f.files[0];hi.textContent=x?x.name+' · '+mb(x.size):h0;if(x)t.value='';run()};
  ou.onclick=e=>{const b=e.target.closest&&e.target.closest('button[data-c]');if(b)copy(b.dataset.c,b)}}},
{id:'konversi-timestamp',name:'Konversi Timestamp',desc:'Ubah Unix timestamp ke tanggal dan jam yang mudah dibaca, atau tanggal ke timestamp. Mendukung detik dan milidetik. Diproses di browser.',
 html:()=>`<label for="ts">Unix timestamp (detik atau milidetik)</label><input id="ts" inputmode="numeric" autocomplete="off" placeholder="1763700000">
<div class="row"><button type="button" id="nw">Pakai waktu sekarang</button></div>
<div class="out"><table class="ktb" id="t1"></table></div>
<label for="dt">Tanggal dan jam (waktu lokal)</label><input id="dt" type="datetime-local">
<div class="out"><table class="ktb" id="t2"></table></div>`,
 init:r=>{const ts=$(r,'#ts'),dt=$(r,'#dt'),t1=$(r,'#t1'),t2=$(r,'#t2'),tz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){return'lokal'}})();
  const F=(d,z)=>d.toLocaleString('id-ID',{dateStyle:'full',timeStyle:'long',timeZone:z});
  const c1=()=>{const v=ts.value.replace(/\D/g,'');if(!v){t1.innerHTML='<tr><th>Hasil</th><td>Isi timestamp di atas.</td></tr>';return}
   const n=Number(v),ms=n>=1e11?n:n*1000,d=new Date(ms);
   if(!isFinite(d.getTime())){t1.innerHTML='<tr><th>Hasil</th><td>Timestamp di luar jangkauan.</td></tr>';return}
   t1.innerHTML=`<tr><th>Dibaca sebagai</th><td>${n>=1e11?'milidetik':'detik'}</td></tr><tr><th>Waktu lokal (${esc(tz)})</th><td>${esc(F(d))}</td></tr><tr><th>UTC</th><td>${esc(F(d,'UTC'))}</td></tr><tr><th>ISO 8601</th><td>${d.toISOString()}</td></tr>`};
  const c2=()=>{const d=new Date(dt.value);if(!dt.value||!isFinite(d.getTime())){t2.innerHTML='<tr><th>Hasil</th><td>Isi tanggal dan jam di atas.</td></tr>';return}
   const ms=d.getTime();t2.innerHTML=`<tr><th>Timestamp (detik)</th><td>${Math.floor(ms/1000)}</td></tr><tr><th>Timestamp (milidetik)</th><td>${ms}</td></tr>`};
  const now=()=>{const n=new Date();ts.value=Math.floor(n.getTime()/1000);dt.value=new Date(n.getTime()-n.getTimezoneOffset()*6e4).toISOString().slice(0,16);c1();c2()};
  ts.oninput=c1;dt.oninput=dt.onchange=c2;$(r,'#nw').onclick=now;now()}},
{id:'angka-terbilang',name:'Angka ke Terbilang',desc:'Ubah angka menjadi tulisan dalam bahasa Indonesia, cocok untuk kwitansi dan surat. Contoh: 1.250.000 menjadi satu juta dua ratus lima puluh ribu rupiah.',
 html:()=>`<label for="an">Angka</label><input id="an" inputmode="numeric" autocomplete="off" placeholder="1.250.000">
<label><input type="checkbox" id="ar" checked> Tambahkan kata "rupiah"</label>
<div class="out"><code id="o" style="white-space:pre-wrap">Isi angka untuk melihat terbilang.</code><div class="row"><button class="primary" id="cp">Salin terbilang</button></div></div>`,
 init:r=>{const a=$(r,'#an'),o=$(r,'#o');let txt='';
  const S=['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
  const tb=n=>{if(n<12)return S[n];if(n<20)return S[n-10]+' belas';if(n<100)return S[Math.floor(n/10)]+' puluh'+(n%10?' '+S[n%10]:'');
   if(n<200)return'seratus'+(n%100?' '+tb(n%100):'');if(n<1e3)return S[Math.floor(n/100)]+' ratus'+(n%100?' '+tb(n%100):'');
   if(n<2e3)return'seribu'+(n%1e3?' '+tb(n%1e3):'');if(n<1e6)return tb(Math.floor(n/1e3))+' ribu'+(n%1e3?' '+tb(n%1e3):'');
   if(n<1e9)return tb(Math.floor(n/1e6))+' juta'+(n%1e6?' '+tb(n%1e6):'');if(n<1e12)return tb(Math.floor(n/1e9))+' miliar'+(n%1e9?' '+tb(n%1e9):'');
   return tb(Math.floor(n/1e12))+' triliun'+(n%1e12?' '+tb(n%1e12):'')};
  const calc=()=>{const v=a.value.replace(/\D/g,'').slice(0,15);a.value=v?Number(v).toLocaleString('id-ID'):'';
   if(!v){txt='';o.textContent='Isi angka untuk melihat terbilang.';return}
   const n=Number(v),w=n===0?'nol':tb(n);txt=w.charAt(0).toUpperCase()+w.slice(1)+($(r,'#ar').checked?' rupiah':'');o.textContent=txt};
  a.oninput=calc;$(r,'#ar').onchange=calc;$(r,'#cp').onclick=e=>{if(txt)copy(txt,e.target)}}},
{id:'meme-maker',name:'Meme Maker',desc:'Pasang teks atas dan bawah di foto jadi meme klasik bergaya Impact. Hasilnya langsung terlihat saat kamu mengetik. Diproses di perangkatmu.',
 html:()=>`${mkDrop('mf','Pilih foto meme')}
<label for="mt">Teks atas</label><input id="mt" maxlength="80" placeholder="Pas lagi santai">
<label for="mb">Teks bawah</label><input id="mb" maxlength="80" placeholder="Eh tiba-tiba ada tugas">
<canvas id="cv" style="width:100%;border-radius:12px;display:none;margin-top:12px"></canvas>
<div class="row"><button class="primary" id="dl">Unduh meme</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let im=null;
  const draw=()=>{if(!im)return;const s=Math.min(1,1080/im.width),w=Math.round(im.width*s),h=Math.round(im.height*s);cv.width=w;cv.height=h;const x=cv.getContext('2d');x.drawImage(im,0,0,w,h);
   const fs=Math.round(w/9);x.font=`900 ${fs}px Impact,"Arial Black",sans-serif`;x.textAlign='center';x.lineJoin='round';x.lineWidth=fs/6;x.strokeStyle='#000';x.fillStyle='#fff';
   const put=(t,top)=>{t=t.toUpperCase().trim();if(!t)return;const ls=mkWrap(x,t,w*.94);ls.forEach((l,i)=>{const y=top?fs*1.05+i*fs*1.05:h-fs*.3-(ls.length-1-i)*fs*1.05;x.strokeText(l,w/2,y);x.fillText(l,w/2,y)})};
   put($(r,'#mt').value,1);put($(r,'#mb').value,0)};
  mkLoad(r,'#mf',m,i=>{im=i;cv.style.display='block';draw()});r.addEventListener('input',draw);
  $(r,'#dl').onclick=()=>{if(!im)return mkBad(m,'Pilih foto dulu.');draw();mkDl(cv,'meme.jpg','image/jpeg',m,'Meme diunduh.')}}},
{id:'sticker-wa',name:'Pembuat Stiker WhatsApp',desc:'Ubah foto jadi stiker berukuran 512 x 512 dengan latar transparan, pilih bentuk asli, bulat, atau kotak membulat, plus garis tepi putih. Diproses di perangkatmu.',
 html:()=>`${mkDrop('sf','Pilih gambar stiker')}
<label for="ss">Bentuk</label><select id="ss"><option value="a">Asli (tanpa dipotong)</option><option value="c">Bulat</option><option value="r">Kotak membulat</option></select>
<label for="so">Garis tepi putih</label><select id="so"><option value="1">Ya</option><option value="0">Tidak</option></select>
<canvas id="cv" width="512" height="512" style="width:100%;max-width:320px;aspect-ratio:1;border-radius:12px;display:none;margin:12px auto 0;background:repeating-conic-gradient(#8884 0 25%,#0000 0 50%) 0 0/20px 20px"></canvas>
<div class="row"><button class="primary" id="dl">Unduh stiker</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let im=null;
  const draw=()=>{if(!im)return;const x=cv.getContext('2d'),S=512,P=16,st=document.createElement('canvas');st.width=st.height=S;const g=st.getContext('2d'),sh=$(r,'#ss').value,iw=im.width,ih=im.height;
   if(sh==='a'){const s=Math.min((S-2*P)/iw,(S-2*P)/ih);g.drawImage(im,(S-iw*s)/2,(S-ih*s)/2,iw*s,ih*s)}
   else{g.save();g.beginPath();if(sh==='c')g.arc(S/2,S/2,S/2-P,0,7);else g.roundRect(P,P,S-2*P,S-2*P,70);g.clip();const s=Math.max((S-2*P)/iw,(S-2*P)/ih);g.drawImage(im,(S-iw*s)/2,(S-ih*s)/2,iw*s,ih*s);g.restore()}
   x.clearRect(0,0,S,S);
   if($(r,'#so').value==='1'){const w=document.createElement('canvas');w.width=w.height=S;const q=w.getContext('2d');q.drawImage(st,0,0);q.globalCompositeOperation='source-in';q.fillStyle='#fff';q.fillRect(0,0,S,S);for(let a=0;a<28;a++)x.drawImage(w,Math.cos(a/28*6.2832)*8,Math.sin(a/28*6.2832)*8)}
   x.drawImage(st,0,0)};
  mkLoad(r,'#sf',m,i=>{im=i;cv.style.display='block';draw()});r.addEventListener('input',draw);
  $(r,'#dl').onclick=()=>{if(!im)return mkBad(m,'Pilih gambar dulu.');draw();mkDl(cv,'stiker.webp','image/webp',m,'Stiker diunduh. Impor ke WhatsApp lewat aplikasi pembuat stiker.')}}},
{id:'watermark-foto',name:'Watermark Foto',desc:'Tempel teks watermark di foto: pojok, tengah, atau berulang miring menutupi seluruh foto. Atur warna, ukuran, dan transparansinya. Diproses di perangkatmu.',
 html:()=>`${mkDrop('wf','Pilih foto')}
<label for="wt">Teks watermark</label><input id="wt" maxlength="40" value="@maliktools">
<label for="wp">Posisi</label><select id="wp"><option value="br">Pojok kanan bawah</option><option value="bl">Pojok kiri bawah</option><option value="c">Tengah</option><option value="t">Berulang miring</option></select>
<label for="wc">Warna</label><select id="wc"><option value="#ffffff">Putih</option><option value="#000000">Hitam</option></select>
<label for="wz">Ukuran</label><input id="wz" type="range" min="2" max="12" value="5">
<label for="wo">Transparansi</label><input id="wo" type="range" min="10" max="100" value="60">
<canvas id="cv" style="width:100%;border-radius:12px;display:none;margin-top:12px"></canvas>
<div class="row"><button class="primary" id="dl">Unduh foto</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let im=null;
  const draw=()=>{if(!im)return;const s=Math.min(1,2400/Math.max(im.width,im.height)),w=Math.round(im.width*s),h=Math.round(im.height*s);cv.width=w;cv.height=h;const x=cv.getContext('2d');x.drawImage(im,0,0,w,h);
   const t=$(r,'#wt').value.trim();if(!t)return;const fs=Math.max(12,w*$(r,'#wz').value/100),p=$(r,'#wp').value,col=$(r,'#wc').value;
   x.font=`700 ${fs}px system-ui,Arial,sans-serif`;x.globalAlpha=$(r,'#wo').value/100;x.fillStyle=col;x.shadowColor=col==='#ffffff'?'#0008':'#fff8';x.shadowBlur=fs/8;
   if(p==='t'){x.save();x.translate(w/2,h/2);x.rotate(-.5);x.textAlign='center';const gx=x.measureText(t).width+fs*2,gy=fs*3,R=Math.hypot(w,h);for(let yy=-R,k=0;yy<R;yy+=gy,k++)for(let xx=-R;xx<R;xx+=gx)x.fillText(t,xx+(k%2?gx/2:0),yy);x.restore()}
   else{x.textAlign=p==='br'?'right':p==='bl'?'left':'center';const px=p==='br'?w-fs*.6:p==='bl'?fs*.6:w/2,py=p==='c'?h/2+fs/3:h-fs*.6;x.fillText(t,px,py)}};
  mkLoad(r,'#wf',m,i=>{im=i;cv.style.display='block';draw()});r.addEventListener('input',draw);
  $(r,'#dl').onclick=()=>{if(!im)return mkBad(m,'Pilih foto dulu.');draw();mkDl(cv,'watermark.jpg','image/jpeg',m,'Foto berwatermark diunduh.')}}},
{id:'avatar-bulat',name:'Avatar Bulat',desc:'Potong foto jadi foto profil bulat atau kotak membulat dengan bingkai warna. Geser dan zoom foto sampai pas, lalu unduh PNG 1024 px. Diproses di perangkatmu.',
 html:()=>`${mkDrop('af','Pilih foto profil')}
<label for="as">Bentuk</label><select id="as"><option value="c">Bulat</option><option value="r">Kotak membulat</option></select>
<label for="ar">Bingkai</label><select id="ar"><option value="">Tanpa bingkai</option><option value="#ffffff">Putih</option><option value="#111111">Hitam</option><option value="#4fd69a">Hijau</option></select>
<label for="az">Zoom</label><input id="az" type="range" min="100" max="300" value="100">
<canvas id="cv" width="600" height="600" style="width:100%;max-width:320px;aspect-ratio:1;display:none;margin:12px auto 0;touch-action:none;cursor:grab;background:repeating-conic-gradient(#8884 0 25%,#0000 0 50%) 0 0/20px 20px;border-radius:12px"></canvas>
<p class="hint" id="ah" hidden>Geser foto di dalam bingkai untuk mengatur posisinya.</p>
<div class="row"><button class="primary" id="dl">Unduh avatar</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let im=null,ox=0,oy=0,on=null;
  const paint=(c,S)=>{c.width=c.height=S;const x=c.getContext('2d');if(!im)return;const col=$(r,'#ar').value,rw=col?S*.035:0,sc=S/Math.min(im.width,im.height)*($(r,'#az').value/100),mx=Math.max(0,(im.width*sc-S)/2/S),my=Math.max(0,(im.height*sc-S)/2/S);
   ox=Math.max(-mx,Math.min(mx,ox));oy=Math.max(-my,Math.min(my,oy));
   const pth=i=>{x.beginPath();if($(r,'#as').value==='c')x.arc(S/2,S/2,S/2-i,0,7);else x.roundRect(i,i,S-2*i,S-2*i,S*.22)};
   x.save();pth(rw);x.clip();x.drawImage(im,S/2+ox*S-im.width*sc/2,S/2+oy*S-im.height*sc/2,im.width*sc,im.height*sc);x.restore();
   if(col){pth(rw/2);x.lineWidth=rw;x.strokeStyle=col;x.stroke()}};
  const draw=()=>paint(cv,600);
  mkLoad(r,'#af',m,i=>{im=i;ox=oy=0;cv.style.display='block';$(r,'#ah').hidden=false;draw()});r.addEventListener('input',draw);
  cv.onpointerdown=e=>{on=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'};
  cv.onpointermove=e=>{if(!on)return;const b=cv.getBoundingClientRect();ox+=(e.clientX-on[0])/b.width;oy+=(e.clientY-on[1])/b.height;on=[e.clientX,e.clientY];draw()};
  cv.onpointerup=cv.onpointercancel=()=>{on=null;cv.style.cursor='grab'};
  $(r,'#dl').onclick=()=>{if(!im)return mkBad(m,'Pilih foto dulu.');const o=document.createElement('canvas');paint(o,1024);mkDl(o,'avatar.png','image/png',m,'Avatar diunduh sebagai PNG transparan.')}}},
{id:'story-teks',name:'Story Teks',desc:'Tulis teks di atas latar gradasi untuk status, story, atau postingan. Pilih rasio 9:16, 4:5, atau 1:1, lalu unduh sebagai PNG. Diproses di perangkatmu.',
 html:()=>`<label for="st">Teks</label><textarea id="st" rows="4" maxlength="400" placeholder="Tulis kata-katamu di sini"></textarea>
<label for="sr">Rasio</label><select id="sr"><option value="1080x1920">Story 9:16</option><option value="1080x1350">Postingan 4:5</option><option value="1080x1080">Persegi 1:1</option></select>
<label for="sg">Latar</label><select id="sg">${MKGR.map((g,i)=>`<option value="${i}">${g[0]}</option>`).join('')}</select>
<label for="sk">Warna teks</label><select id="sk"><option value="#ffffff">Putih</option><option value="#111111">Hitam</option></select>
<label for="sz">Ukuran teks</label><input id="sz" type="range" min="4" max="14" value="8">
<canvas id="cv" style="width:100%;max-width:300px;border-radius:12px;display:block;margin:12px auto 0"></canvas>
<div class="row"><button class="primary" id="dl">Unduh gambar</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');
  const draw=()=>{const [w,h]=$(r,'#sr').value.split('x').map(Number),g=MKGR[$(r,'#sg').value];cv.width=w;cv.height=h;const x=cv.getContext('2d'),gr=x.createLinearGradient(0,0,w,h);gr.addColorStop(0,g[1]);gr.addColorStop(1,g[2]);x.fillStyle=gr;x.fillRect(0,0,w,h);
   const raw=$(r,'#st').value.trim(),fs=w*$(r,'#sz').value/100;x.font=`800 ${fs}px system-ui,Arial,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillStyle=$(r,'#sk').value;x.globalAlpha=raw?1:.45;
   const ls=mkWrap(x,raw||'Tulis teks kamu',w*.82),lh=fs*1.3,y0=h/2-(ls.length-1)*lh/2;ls.forEach((l,i)=>x.fillText(l,w/2,y0+i*lh))};
  draw();r.addEventListener('input',draw);
  $(r,'#dl').onclick=()=>{if(!$(r,'#st').value.trim())return mkBad(m,'Tulis teks dulu.');draw();mkDl(cv,'story-teks.png','image/png',m,'Gambar diunduh.')}}},
{id:'kalkulator-persen',name:'Kalkulator Persen',desc:'Hitung persen dengan cepat: berapa X persen dari Y, A adalah berapa persen dari B, dan kenaikan atau penurunan dari nilai lama ke nilai baru. Diproses di browser.',
 html:()=>`<label for="pm">Jenis hitungan</label><select id="pm"><option value="a">X persen dari Y</option><option value="b">A adalah berapa persen dari B</option><option value="c">Naik atau turun berapa persen</option></select>
<label for="p1" id="l1"></label><input id="p1" inputmode="decimal" autocomplete="off" placeholder="0">
<label for="p2" id="l2"></label><input id="p2" inputmode="decimal" autocomplete="off" placeholder="0">
<div class="out"><code id="o">-</code><div class="row"><button class="primary" id="cp" type="button">Salin hasil</button></div></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const o=$(r,'#o'),m=$(r,'#m');let res='';
  const L={a:['Persen (X)','Dari angka (Y)'],b:['Angka (A)','Dari total (B)'],c:['Nilai lama','Nilai baru']};
  const num=v=>parseFloat(String(v).trim().replace(/\./g,'').replace(',','.')),fmt=n=>n.toLocaleString('id-ID',{maximumFractionDigits:4});
  const calc=()=>{const k=$(r,'#pm').value;$(r,'#l1').textContent=L[k][0];$(r,'#l2').textContent=L[k][1];
   const a=num($(r,'#p1').value),b=num($(r,'#p2').value);res='';m.textContent='';
   if(isNaN(a)||isNaN(b)){o.textContent='-';return}
   if(k==='a')res=fmt(a/100*b);
   else if(k==='b'){if(b===0){o.textContent='Total tidak boleh 0';return}res=fmt(a/b*100)+'%'}
   else{if(a===0){o.textContent='Nilai lama tidak boleh 0';return}const d=(b-a)/Math.abs(a)*100;res=(d>=0?'Naik ':'Turun ')+fmt(Math.abs(d))+'%'}
   o.textContent=res};
  r.addEventListener('input',calc);calc();
  $(r,'#cp').onclick=e=>{if(res)copy(res,e.target);else mkBad(m,'Isi angka dulu.')}}},
{id:'konversi-huruf',name:'Ubah Gaya Huruf',desc:'Ubah teks ke HURUF BESAR, huruf kecil, Huruf Awal Kapital, camelCase, snake_case, kebab-case, slug URL, dan gaya aLaY. Salin hasilnya satu per satu. Diproses di browser.',
 html:()=>`<label for="kt">Teks</label><textarea id="kt" rows="4" placeholder="Tulis atau tempel teks di sini"></textarea><div id="kr"></div>`,
 init:r=>{const kr=$(r,'#kr'),kt=$(r,'#kt');
  const words=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const S=[['HURUF BESAR',s=>s.toUpperCase()],['huruf kecil',s=>s.toLowerCase()],['Huruf Awal Kapital',s=>s.toLowerCase().replace(/(^|[\s(\-])(\S)/g,(a,b,c)=>b+c.toUpperCase())],['Kalimat',s=>s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu,(a,b,c)=>b+c.toUpperCase())],
   ['camelCase',s=>{const w=words(s);return w.map((x,i)=>i?x[0].toUpperCase()+x.slice(1):x).join('')}],['snake_case',s=>words(s).join('_')],['kebab-case',s=>words(s).join('-')],['Slug URL',s=>words(s).join('-')],
   ['aLaY',s=>[...s.toLowerCase()].map((c,i)=>i%2?c.toUpperCase():c).join('')]];
  let outs=[];
  const draw=()=>{const v=kt.value;outs=S.map(x=>v.trim()?x[1](v):'');
   kr.innerHTML=S.map((x,i)=>`<p class="hint" style="margin:14px 0 4px">${x[0]}</p><div class="out"><code>${esc(outs[i])||'-'}</code><div class="row"><button type="button" data-i="${i}">Salin</button></div></div>`).join('')};
  kt.oninput=draw;draw();
  kr.onclick=e=>{const i=e.target.dataset&&e.target.dataset.i;if(i===undefined||!outs[i])return;copy(outs[i],e.target)}}},
{id:'timer-pomodoro',name:'Timer Pomodoro',desc:'Fokus 25 menit lalu istirahat 5 menit, atau atur durasimu sendiri. Timer tetap akurat walau layar dikunci sebentar dan bergetar saat waktu habis. Diproses di browser.',
 html:()=>`<label for="tf">Fokus (menit)</label><input id="tf" type="number" inputmode="numeric" min="1" max="180" value="25">
<label for="tb">Istirahat (menit)</label><input id="tb" type="number" inputmode="numeric" min="1" max="60" value="5">
<div class="out" style="text-align:center"><p class="hint" id="tm" style="margin:0">Fokus</p><code id="tt" style="font-size:48px;display:block;padding:8px 0">25:00</code><p class="hint" id="tc" style="margin:0 0 12px">Sesi fokus selesai: 0</p>
<div class="row"><button class="primary" id="ts" type="button">Mulai</button><button id="tr" type="button">Reset</button></div></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const tt=$(r,'#tt'),tm=$(r,'#tm'),tc=$(r,'#tc'),ts=$(r,'#ts'),m=$(r,'#m');let mode='f',left=0,end=0,iv=null,done=0;
  const mins=()=>Math.max(1,Math.min(mode==='f'?180:60,+$(r,mode==='f'?'#tf':'#tb').value||1));
  const show=()=>{const s=Math.max(0,Math.ceil(left/1000));tt.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');tm.textContent=mode==='f'?'Fokus':'Istirahat';tc.textContent='Sesi fokus selesai: '+done};
  const stop=()=>{clearInterval(iv);iv=null;ts.textContent='Mulai'};
  const tick=()=>{if(!r.isConnected)return stop();left=end-Date.now();if(left<=0){if(mode==='f')done++;mode=mode==='f'?'b':'f';left=mins()*60000;end=Date.now()+left;try{navigator.vibrate&&navigator.vibrate([300,150,300])}catch(e){}m.className='msg ok';m.textContent=mode==='b'?'Waktunya istirahat.':'Waktunya fokus lagi.'}show()};
  const reset=()=>{stop();mode='f';left=mins()*60000;m.textContent='';show()};
  ts.onclick=()=>{if(iv){left=end-Date.now();stop();ts.textContent='Lanjut';return}m.textContent='';if(left<=0)left=mins()*60000;end=Date.now()+left;iv=setInterval(tick,250);ts.textContent='Jeda';tick()};
  $(r,'#tr').onclick=reset;$(r,'#tf').onchange=$(r,'#tb').onchange=()=>{if(!iv)reset()};reset()}},
{id:'gradient-maker',name:'Gradient Maker',desc:'Buat wallpaper atau latar gradasi dua warna dengan sudut dan rasio pilihanmu, lalu unduh sebagai PNG. Cocok untuk latar story dan layar HP. Diproses di perangkatmu.',
 html:()=>`<label for="g1">Warna awal</label><input id="g1" type="color" value="#4fd69a" style="width:100%;height:48px;padding:4px">
<label for="g2">Warna akhir</label><input id="g2" type="color" value="#8f9aff" style="width:100%;height:48px;padding:4px">
<label for="ga">Sudut: <span id="gav">135</span> derajat</label><input id="ga" type="range" min="0" max="360" value="135">
<label for="gr">Ukuran</label><select id="gr"><option value="1080x1920">Wallpaper HP 9:16</option><option value="1080x1350">Postingan 4:5</option><option value="1080x1080">Persegi 1:1</option><option value="1920x1080">Layar lebar 16:9</option></select>
<canvas id="cv" style="width:100%;max-width:300px;max-height:420px;border-radius:12px;display:block;margin:12px auto 0;object-fit:contain"></canvas>
<div class="row"><button class="primary" id="dl" type="button">Unduh gambar</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');
  const draw=()=>{const [w,h]=$(r,'#gr').value.split('x').map(Number),a=$(r,'#ga').value*Math.PI/180,c=Math.cos(a),s=Math.sin(a),L=Math.abs(w*s)+Math.abs(h*c);
   cv.width=w;cv.height=h;const x=cv.getContext('2d'),g=x.createLinearGradient(w/2-s*L/2,h/2+c*L/2,w/2+s*L/2,h/2-c*L/2);g.addColorStop(0,$(r,'#g1').value);g.addColorStop(1,$(r,'#g2').value);x.fillStyle=g;x.fillRect(0,0,w,h);$(r,'#gav').textContent=$(r,'#ga').value};
  draw();r.addEventListener('input',draw);
  $(r,'#dl').onclick=()=>{draw();mkDl(cv,'gradient.png','image/png',m,'Gambar diunduh.')}}},
{id:'putar-foto',name:'Putar dan Balik Foto',desc:'Putar foto 90 derajat ke kiri atau kanan dan balik secara horizontal atau vertikal, lalu unduh hasilnya. Foto tidak diunggah, semuanya diproses di perangkatmu.',
 html:()=>`${mkDrop('pf','Pilih foto')}
<div class="row"><button type="button" data-a="l">Putar kiri</button><button type="button" data-a="r">Putar kanan</button><button type="button" data-a="h">Balik horizontal</button><button type="button" data-a="v">Balik vertikal</button></div>
<canvas id="cv" style="width:100%;max-width:320px;max-height:420px;display:none;margin:12px auto 0;border-radius:12px;object-fit:contain"></canvas>
<div class="row"><button class="primary" id="dl" type="button">Unduh foto</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let im=null,rot=0,fh=1,fv=1;
  const draw=()=>{if(!im)return;const k=Math.min(1,4096/Math.max(im.width,im.height)),W=Math.round(im.width*k),H=Math.round(im.height*k),sw=rot%2;
   cv.width=sw?H:W;cv.height=sw?W:H;const x=cv.getContext('2d');x.save();x.translate(cv.width/2,cv.height/2);x.rotate(rot*Math.PI/2);x.scale(fh,fv);x.drawImage(im,-W/2,-H/2,W,H);x.restore()};
  mkLoad(r,'#pf',m,i=>{im=i;rot=0;fh=fv=1;m.textContent='';cv.style.display='block';draw()});
  r.onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(!a)return;if(!im)return mkBad(m,'Pilih foto dulu.');
   if(a==='l')rot=(rot+3)%4;else if(a==='r')rot=(rot+1)%4;else if(a==='h')rot%2?fv*=-1:fh*=-1;else rot%2?fh*=-1:fv*=-1;draw()};
  $(r,'#dl').onclick=()=>{if(!im)return mkBad(m,'Pilih foto dulu.');draw();mkDl(cv,'foto.png','image/png',m,'Foto diunduh.')}}},
{id:'angka-romawi',name:'Angka Romawi',desc:'Ubah angka biasa ke angka Romawi dan sebaliknya, untuk 1 sampai 3999. Ketik salah satunya, hasilnya langsung muncul. Diproses di browser.',
 html:()=>`<label for="rv">Angka atau angka Romawi</label><input id="rv" autocomplete="off" autocapitalize="characters" placeholder="Contoh: 2026 atau MMXXVI">
<div class="out"><code id="o">-</code><div class="row"><button class="primary" id="cp" type="button">Salin hasil</button></div></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const o=$(r,'#o'),m=$(r,'#m');let res='';
  const T=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  const to=n=>{let s='';T.forEach(([v,c])=>{while(n>=v){s+=c;n-=v}});return s};
  const from=s=>{const V={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let n=0;for(let i=0;i<s.length;i++){const a=V[s[i]],b=V[s[i+1]]||0;n+=a<b?-a:a}return n};
  const calc=()=>{const v=$(r,'#rv').value.trim().toUpperCase();res='';m.textContent='';
   if(!v){o.textContent='-';return}
   if(/^\d+$/.test(v)){const n=+v;if(n<1||n>3999){o.textContent='Isi 1 sampai 3999';return}res=to(n)}
   else if(/^[IVXLCDM]+$/.test(v)){const n=from(v);if(n<1||n>3999||to(n)!==v){o.textContent='Angka Romawi tidak valid';return}res=String(n)}
   else{o.textContent='Isi angka atau huruf I V X L C D M';return}
   o.textContent=res};
  $(r,'#rv').oninput=calc;calc();
  $(r,'#cp').onclick=e=>{if(res)copy(res,e.target);else mkBad(m,'Isi dulu.')}}},
{id:'kalkulator-tabungan',name:'Kalkulator Tabungan',desc:'Hitung hasil tabungan atau investasi dengan bunga majemuk: setoran awal, setoran tiap bulan, bunga per tahun, dan lama menabung. Diproses di browser.',
 html:()=>`<label for="ta">Setoran awal (Rp)</label><input id="ta" inputmode="numeric" autocomplete="off" value="1000000">
<label for="tb">Setoran tiap bulan (Rp)</label><input id="tb" inputmode="numeric" autocomplete="off" value="500000">
<label for="tr">Bunga atau imbal hasil per tahun (%)</label><input id="tr" inputmode="decimal" autocomplete="off" value="6">
<label for="ty">Lama menabung (tahun)</label><input id="ty" inputmode="numeric" autocomplete="off" value="5">
<div class="out"><table class="ktb"><tr><th>Total akhir</th><td id="o1"></td></tr><tr><th>Total setoran</th><td id="o2"></td></tr><tr><th>Bunga didapat</th><td id="o3"></td></tr></table></div><p class="hint">Perkiraan: bunga dihitung per bulan dan setoran bulanan masuk di akhir bulan.</p>`,
 init:r=>{const num=v=>{const n=parseFloat(String(v).replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n},rp=n=>'Rp '+Math.round(n).toLocaleString('id-ID');
  const calc=()=>{const P=num($(r,'#ta').value),M=num($(r,'#tb').value),i=num($(r,'#tr').value)/1200,n=Math.min(100,Math.max(0,Math.round(num($(r,'#ty').value))))*12;
   const g=Math.pow(1+i,n),fv=i?P*g+M*(g-1)/i:P+M*n,dep=P+M*n;
   $(r,'#o1').textContent=rp(fv);$(r,'#o2').textContent=rp(dep);$(r,'#o3').textContent=rp(fv-dep)};
  r.addEventListener('input',calc);calc()}},
{id:'generator-uuid',name:'Generator UUID',desc:'Buat UUID versi 4 acak, satu atau banyak sekaligus, dengan pilihan huruf besar dan tanpa tanda hubung. Dibuat di perangkatmu.',
 html:()=>`<label for="un">Jumlah: <span id="unv">5</span></label><input id="un" type="range" min="1" max="50" value="5">
<label><input type="checkbox" id="uu"> Huruf besar</label><label><input type="checkbox" id="uh"> Tanpa tanda hubung</label>
<div class="out"><code id="o" style="white-space:pre-wrap;word-break:break-all"></code><div class="row"><button class="primary" id="cp" type="button">Salin semua</button><button id="rg" type="button">Buat ulang</button></div></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const o=$(r,'#o');let txt='';
  const one=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
  const gen=()=>{$(r,'#unv').textContent=$(r,'#un').value;let a=Array.from({length:+$(r,'#un').value},one);if($(r,'#uh').checked)a=a.map(x=>x.replace(/-/g,''));if($(r,'#uu').checked)a=a.map(x=>x.toUpperCase());txt=a.join('\n');o.textContent=txt};
  $(r,'#un').oninput=gen;$(r,'#uu').onchange=$(r,'#uh').onchange=gen;$(r,'#rg').onclick=gen;$(r,'#cp').onclick=e=>copy(txt,e.target);gen()}},
{id:'stopwatch',name:'Stopwatch',desc:'Stopwatch akurat dengan putaran (lap): mulai, jeda, catat putaran, dan salin daftar waktunya. Diproses di browser.',
 html:()=>`<div class="out" style="text-align:center"><code id="sw" style="font-size:44px;display:block;padding:8px 0">00:00.00</code>
<div class="row"><button class="primary" id="ss" type="button">Mulai</button><button id="sl" type="button">Putaran</button><button id="sr" type="button">Reset</button></div></div>
<div id="lp"></div><div class="row"><button id="cp" type="button">Salin putaran</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const sw=$(r,'#sw'),ss=$(r,'#ss'),lp=$(r,'#lp'),m=$(r,'#m');let acc=0,t0=0,iv=null,laps=[];
  const cur=()=>acc+(iv?performance.now()-t0:0);
  const f=ms=>{const c=Math.floor(ms/10)%100,s=Math.floor(ms/1000)%60,mi=Math.floor(ms/60000)%60,h=Math.floor(ms/3600000);return(h?h+':'+String(mi).padStart(2,'0'):String(mi).padStart(2,'0'))+':'+String(s).padStart(2,'0')+'.'+String(c).padStart(2,'0')};
  const paint=()=>{if(!r.isConnected){clearInterval(iv);iv=null;return}sw.textContent=f(cur())};
  const list=()=>{lp.innerHTML=laps.map((x,i)=>`<p class="hint" style="margin:6px 0">Putaran ${i+1}: <b>${f(x.l)}</b> (total ${f(x.t)})</p>`).reverse().join('')};
  ss.onclick=()=>{if(iv){acc+=performance.now()-t0;clearInterval(iv);iv=null;ss.textContent='Lanjut';paint()}else{t0=performance.now();iv=setInterval(paint,30);ss.textContent='Jeda'}};
  $(r,'#sl').onclick=()=>{const t=cur();if(t<=0)return;laps.push({t,l:t-(laps.length?laps[laps.length-1].t:0)});list()};
  $(r,'#sr').onclick=()=>{clearInterval(iv);iv=null;acc=0;laps=[];ss.textContent='Mulai';sw.textContent=f(0);list();m.textContent=''};
  $(r,'#cp').onclick=e=>{if(!laps.length)return mkBad(m,'Belum ada putaran.');copy(laps.map((x,i)=>'Putaran '+(i+1)+': '+f(x.l)+' (total '+f(x.t)+')').join('\n'),e.target)}}},
{id:'bandingkan-teks',name:'Bandingkan Teks',desc:'Tempel dua versi teks lalu lihat baris mana yang ditambah, dihapus, atau sama. Cocok untuk membandingkan draf, kode, atau daftar. Diproses di browser.',
 html:()=>`<label for="d1">Teks asli</label><textarea id="d1" rows="5" placeholder="Tempel teks pertama"></textarea>
<label for="d2">Teks baru</label><textarea id="d2" rows="5" placeholder="Tempel teks kedua"></textarea>
<div class="row"><button class="primary" id="go" type="button">Bandingkan</button></div><p class="msg" id="m" role="status"></p><div id="rs"></div>`,
 init:r=>{const m=$(r,'#m'),rs=$(r,'#rs');
  $(r,'#go').onclick=()=>{const a=$(r,'#d1').value.split('\n'),b=$(r,'#d2').value.split('\n');m.className='msg';m.textContent='';
   if(a.length>1500||b.length>1500)return mkBad(m,'Maksimal 1500 baris per teks.');
   const n=a.length,k=b.length,W=k+1,L=new Uint16Array((n+1)*W);
   for(let i=n-1;i>=0;i--)for(let j=k-1;j>=0;j--)L[i*W+j]=a[i]===b[j]?L[(i+1)*W+j+1]+1:Math.max(L[(i+1)*W+j],L[i*W+j+1]);
   const out=[];let i=0,j=0,add=0,del=0;
   while(i<n&&j<k){if(a[i]===b[j]){out.push([' ',a[i]]);i++;j++}else if(L[(i+1)*W+j]>=L[i*W+j+1]){out.push(['-',a[i]]);i++;del++}else{out.push(['+',b[j]]);j++;add++}}
   while(i<n){out.push(['-',a[i++]]);del++}while(j<k){out.push(['+',b[j++]]);add++}
   m.className='msg ok';m.textContent=add||del?add+' baris ditambah, '+del+' baris dihapus.':'Kedua teks sama persis.';
   const bg={'+':'#4fd69a33','-':'#ff6b6b33',' ':'transparent'};
   rs.innerHTML='<div class="out" style="padding:0;overflow:auto"><div style="font-family:ui-monospace,monospace;font-size:13px;min-width:max-content">'+out.map(x=>`<div style="background:${bg[x[0]]};padding:2px 10px;white-space:pre-wrap">${x[0]===' '?'&nbsp;':x[0]} ${esc(x[1])}</div>`).join('')+'</div></div>'}}},
{id:'cek-kontras',name:'Cek Kontras Warna',desc:'Cek rasio kontras warna teks dan latar sesuai standar WCAG (AA dan AAA) supaya tulisan mudah dibaca, lengkap dengan pratinjau langsung. Diproses di browser.',
 html:()=>`<label for="k1">Warna teks</label><input id="k1" type="color" value="#111111" style="width:100%;height:48px;padding:4px">
<label for="k2">Warna latar</label><input id="k2" type="color" value="#4fd69a" style="width:100%;height:48px;padding:4px">
<div id="kp" style="margin:12px 0;padding:18px;border-radius:12px;border:1px solid var(--bd)"><b style="font-size:22px">Contoh teks besar</b><p style="margin:6px 0 0">Contoh teks biasa untuk melihat keterbacaan.</p></div>
<div class="out"><table class="ktb"><tr><th>Rasio</th><td id="kr"></td></tr><tr><th>Teks biasa AA</th><td id="a1"></td></tr><tr><th>Teks biasa AAA</th><td id="a2"></td></tr><tr><th>Teks besar AA</th><td id="a3"></td></tr><tr><th>Teks besar AAA</th><td id="a4"></td></tr></table></div>`,
 init:r=>{const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
  const calc=()=>{const a=$(r,'#k1').value,b=$(r,'#k2').value,l1=lum(a),l2=lum(b),ra=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05),ok=v=>ra>=v?'Lulus':'Tidak lulus';
   const kp=$(r,'#kp');kp.style.color=a;kp.style.background=b;
   $(r,'#kr').textContent=ra.toFixed(2)+' : 1';$(r,'#a1').textContent=ok(4.5);$(r,'#a2').textContent=ok(7);$(r,'#a3').textContent=ok(3);$(r,'#a4').textContent=ok(4.5)};
  r.addEventListener('input',calc);calc()}},
{id:'filter-foto',name:'Filter Foto',desc:'Atur kecerahan, kontras, dan saturasi foto, atau pakai gaya hitam putih dan sepia, lalu unduh hasilnya. Foto tidak diunggah, semuanya diproses di perangkatmu.',
 html:()=>`${mkDrop('ff','Pilih foto')}
<label for="fs">Gaya</label><select id="fs"><option value="">Asli</option><option value="g">Hitam putih</option><option value="s">Sepia</option></select>
<label for="fb">Kecerahan</label><input id="fb" type="range" min="-100" max="100" value="0">
<label for="fc">Kontras</label><input id="fc" type="range" min="-100" max="100" value="0">
<label for="fa">Saturasi</label><input id="fa" type="range" min="0" max="200" value="100">
<canvas id="cv" style="width:100%;max-width:320px;max-height:420px;display:none;margin:12px auto 0;border-radius:12px;object-fit:contain"></canvas>
<div class="row"><button class="primary" id="dl" type="button">Unduh foto</button><button id="rs" type="button">Atur ulang</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let im=null,raf=0;
  const draw=()=>{if(!im)return;const k=Math.min(1,2400/Math.max(im.width,im.height)),W=Math.round(im.width*k),H=Math.round(im.height*k);cv.width=W;cv.height=H;const x=cv.getContext('2d');x.drawImage(im,0,0,W,H);
   const st=$(r,'#fs').value,br=+$(r,'#fb').value*2.55,c=+$(r,'#fc').value*2.55,sa=$(r,'#fa').value/100,f=259*(c+255)/(255*(259-c));
   if(!st&&!br&&!c&&sa===1)return;const d=x.getImageData(0,0,W,H),p=d.data;
   for(let i=0;i<p.length;i+=4){let R=p[i],G=p[i+1],B=p[i+2];const l=.299*R+.587*G+.114*B;
    if(st==='g'){R=G=B=l}else if(st==='s'){const a=.393*R+.769*G+.189*B,b=.349*R+.686*G+.168*B,e=.272*R+.534*G+.131*B;R=a;G=b;B=e}
    if(sa!==1){const q=.299*R+.587*G+.114*B;R=q+(R-q)*sa;G=q+(G-q)*sa;B=q+(B-q)*sa}
    p[i]=f*(R-128)+128+br;p[i+1]=f*(G-128)+128+br;p[i+2]=f*(B-128)+128+br}
   x.putImageData(d,0,0)};
  const soon=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)};
  mkLoad(r,'#ff',m,i=>{im=i;cv.style.display='block';draw()});r.addEventListener('input',soon);
  $(r,'#rs').onclick=()=>{$(r,'#fs').value='';$(r,'#fb').value=0;$(r,'#fc').value=0;$(r,'#fa').value=100;draw()};
  $(r,'#dl').onclick=()=>{if(!im)return mkBad(m,'Pilih foto dulu.');draw();mkDl(cv,'foto-filter.jpg','image/jpeg',m,'Foto diunduh.')}}},
{id:'kolase-foto',name:'Kolase Foto',desc:'Gabungkan 2 sampai 4 foto jadi satu kolase: berjajar, bertumpuk, atau kisi. Atur jarak dan warna latar, lalu unduh PNG. Diproses di perangkatmu.',
 html:()=>`${mkDrop('kf','Pilih 2 sampai 4 foto').replace('type="file"','type="file" multiple')}
<label for="kl">Susunan</label><select id="kl"><option value="g">Kisi</option><option value="h">Berjajar</option><option value="v">Bertumpuk</option></select>
<label for="kz">Ukuran</label><select id="kz"><option value="1080x1080">Persegi 1:1</option><option value="1080x1350">Postingan 4:5</option><option value="1080x1920">Story 9:16</option></select>
<label for="kg">Jarak: <span id="kgv">12</span> px</label><input id="kg" type="range" min="0" max="60" value="12">
<label for="kc">Warna latar</label><input id="kc" type="color" value="#ffffff" style="width:100%;height:44px;padding:4px">
<canvas id="cv" style="width:100%;max-width:320px;max-height:420px;display:none;margin:12px auto 0;border-radius:12px;object-fit:contain"></canvas>
<div class="row"><button class="primary" id="dl" type="button">Unduh kolase</button></div><p class="msg" id="m" role="status"></p>`,
 init:r=>{const cv=$(r,'#cv'),m=$(r,'#m');let ims=[];
  const cells=(n,l,W,H,g)=>{const o=[];if(l==='h'){const w=(W-g*(n+1))/n;for(let i=0;i<n;i++)o.push([g+i*(w+g),g,w,H-2*g])}
   else if(l==='v'){const h=(H-g*(n+1))/n;for(let i=0;i<n;i++)o.push([g,g+i*(h+g),W-2*g,h])}
   else{const cols=n===1?1:2,rows=Math.ceil(n/cols),w=(W-g*(cols+1))/cols,h=(H-g*(rows+1))/rows;for(let i=0;i<n;i++){const rr=Math.floor(i/cols),cc=i%cols,last=i===n-1&&n%2===1&&n>1;o.push([last?g:g+cc*(w+g),g+rr*(h+g),last?W-2*g:w,h])}}return o};
  const draw=()=>{if(!ims.length)return;const [W,H]=$(r,'#kz').value.split('x').map(Number),g=+$(r,'#kg').value;$(r,'#kgv').textContent=g;cv.width=W;cv.height=H;const x=cv.getContext('2d');x.fillStyle=$(r,'#kc').value;x.fillRect(0,0,W,H);
   cells(ims.length,$(r,'#kl').value,W,H,g).forEach((c,i)=>{const im=ims[i],s=Math.max(c[2]/im.width,c[3]/im.height),w=im.width*s,h=im.height*s;x.save();x.beginPath();x.rect(c[0],c[1],c[2],c[3]);x.clip();x.drawImage(im,c[0]+(c[2]-w)/2,c[1]+(c[3]-h)/2,w,h);x.restore()})};
  $(r,'#kf').onchange=e=>{const fs=[...e.target.files].slice(0,4);if(fs.length<2)return mkBad(m,'Pilih minimal 2 foto.');
   if(fs.some(f=>!/^image\/(jpeg|png|webp|gif)$/.test(f.type)))return mkBad(m,'Format harus JPG, PNG, atau WebP.');if(fs.some(f=>f.size>MAXIN))return mkBad(m,'Ukuran foto maksimal 50 MB.');
   Promise.all(fs.map(f=>new Promise(ok=>mkImg(f,ok)))).then(a=>{if(a.some(x=>!x))return mkBad(m,'Ada foto yang tidak bisa dibaca.');ims=a;m.className='msg';m.textContent='';cv.style.display='block';draw()})};
  r.addEventListener('input',draw);
  $(r,'#dl').onclick=()=>{if(!ims.length)return mkBad(m,'Pilih foto dulu.');draw();mkDl(cv,'kolase.png','image/png',m,'Kolase diunduh.')}}},
];


/* Skin umum gaya TikTok V2 untuk semua tool selain yang sudah memakai .tk2 sendiri: hanya mengubah tampilan elemen bersama (label, kolom isi, tombol, kartu hasil), isi dan logika tool tidak berubah. */
function tk2gCss(){if(document.getElementById('tk2gcss'))return;tk2Css();const s=document.createElement('style');s.id='tk2gcss';
 const HV='html:not(#_):not(#__):not(#___):not(#____):not(#_____):root:root:root:root:root ',g=x=>x.split('|').map(a=>HV+'.tk2g '+a.trim()).join(',');
 const TX='input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([type=button]):not([type=submit]):not([type=hidden])|select|textarea';
 const R=[
 [g('label:not(.drop):not(.hs):not(.chk):not(:has(input))'),'display:block;margin:16px 0 8px;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--mu);text-transform:none;letter-spacing:.01em'],
 [g('label:not(.drop):not(.hs):not(.chk):not(:has(input)):first-child'),'margin-top:0'],
 [g(TX),'width:100%;max-width:100%;min-width:0;height:52px;margin:0;padding:0 14px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:14px;font-family:inherit;font-size:16px;line-height:1.4;outline:0;box-shadow:none;transition:border-color .2s,box-shadow .2s'],
 [g('textarea'),'height:auto;min-height:108px;padding:14px;line-height:1.55;resize:vertical'],
 [g('select'),'appearance:none;-webkit-appearance:none;padding-right:40px;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%238b91a3%27 stroke-width=%272.2%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;background-size:18px'],
 [g('input:focus|select:focus|textarea:focus'),'border-color:var(--ac);box-shadow:0 0 0 4px rgba(124,92,255,.18);background:var(--bg)'],
 [g('input::placeholder|textarea::placeholder'),'color:var(--dm)'],
 [g('input[type=range]'),'width:100%;accent-color:var(--ac);background:none;border:0;height:28px;padding:0'],
 [g('input[type=color]'),'width:100%;height:46px;padding:4px;background:var(--bg);border:1px solid var(--ln);border-radius:12px'],
 [g('.drop'),'display:flex;align-items:center;gap:12px;padding:16px;margin:0 0 14px;background:var(--bg);color:var(--tx);border:1.5px dashed var(--ln2);border-radius:16px;transition:.2s'],
 [g('.drop.on|.drop.has|.drop:hover'),'border-color:var(--ac);background:rgba(124,92,255,.07)'],
 [g('.drop svg'),'color:var(--ac2)'],
 [g('.drop span span'),'color:var(--mu)'],
 [g('.row'),'gap:10px;margin-top:14px'],
 [g('label:has(input[type=checkbox])|label:has(input[type=radio])'),'display:flex;align-items:center;gap:10px;margin:10px 0;color:var(--tx);font-size:14px;font-weight:500;text-transform:none;letter-spacing:0'],
 [g('input[type=checkbox]|input[type=radio]'),'accent-color:var(--ac);width:20px;height:20px;min-width:20px;flex:none;margin:0;padding:0'],
 [g('.row button|.row .btn|button.sec|.btn:not(.primary)'),'min-height:46px;padding:0 16px;border-radius:12px;background:var(--s3)!important;color:var(--tx)!important;border:1px solid var(--ln)!important;font-family:inherit;font-weight:600;font-size:14px;box-shadow:none!important;text-transform:none;letter-spacing:0'],
 [g('button.primary|.btn.primary|#go'),'width:100%;min-height:52px;padding:0 18px;border:0!important;border-radius:14px;color:#fff!important;font-family:inherit;font-weight:600;font-size:15px;text-transform:none;letter-spacing:0;background:linear-gradient(135deg,var(--ac),#5b8cff 60%,var(--ac2))!important;box-shadow:0 12px 26px -10px rgba(124,92,255,.8),0 1px 0 rgba(255,255,255,.3) inset!important;transition:filter .15s,transform .15s'],
 [g('button.primary:hover|.btn.primary:hover'),'filter:brightness(1.08)'],
 [g('button.primary:active|.btn.primary:active'),'transform:scale(.99)'],
 [g('button:disabled'),'opacity:.6;cursor:wait'],
 [g('.msg'),'margin:12px 2px 0;font-size:13px;line-height:1.5;color:var(--mu)'],
 [g('.msg:empty'),'display:none'],
 [g('.msg.good'),'color:#34d399'],
 [g('.msg.bad'),'padding:12px 14px;margin:12px 0 0;border-radius:14px;color:#fecaca;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22)'],
 [g('.out'),'margin-top:16px;padding:14px;background:linear-gradient(180deg,var(--s2),var(--s1));border:1px solid var(--ln);border-radius:18px;color:var(--tx);box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 18px 40px -18px rgba(0,0,0,.8),0 2px 6px rgba(0,0,0,.4);animation:tk2up .35s ease both'],
 [g('.out.rescard|.rescard'),'border:1px solid var(--ln)!important;border-left:1px solid var(--ln)!important;border-radius:18px;padding:0!important'],
 [g('.rch'),'display:flex;align-items:center;gap:10px;padding:14px;font-size:15px;color:var(--tx)'],
 [g('.rck'),'display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(52,211,153,.15);color:#34d399;font-size:13px;flex:none'],
 [g('.rcm'),'padding:4px 14px 14px;display:flex;flex-direction:column;gap:2px'],
 [g('.rcm span'),'font-size:12px;color:var(--dm);text-transform:uppercase;letter-spacing:.08em'],
 [g('.rcm strong'),'font-size:30px;line-height:1.1;background:linear-gradient(135deg,#a794ff,var(--ac2));-webkit-background-clip:text;background-clip:text;color:transparent'],
 [g('.rcl'),'list-style:none;margin:0;padding:0'],
 [g('.rcl li'),'display:flex;justify-content:space-between;gap:14px;padding:11px 14px;border-top:1px solid var(--ln);font-size:14px'],
 [g('.rcl li span'),'color:var(--mu);flex:none'],
 [g('.rcl li b'),'color:var(--tx);font-weight:600;text-align:right;min-width:0;word-break:break-word'],
 [g('.rcl a'),'color:#a794ff'],
 [g('.rescard .row'),'padding:12px 14px;border-top:1px solid var(--ln)'],
 [g('.cmp img|.out img:not(.scth)'),'border-radius:12px;border:1px solid var(--ln)'],
 [g('.cmp figcaption'),'color:var(--dm);font-size:12px;text-align:center;margin-top:6px'],
 [g('.out code|.out pre'),'display:block;padding:12px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px'],
 [g('.out video|.out audio'),'width:100%;border-radius:12px;display:block'],
 [g('.unb|.dlb'),'display:flex;align-items:center;justify-content:center;gap:9px;min-height:50px;border-radius:14px;border:0!important;color:#fff!important;font-weight:600;font-size:15px;background:linear-gradient(135deg,var(--ac),#5b8cff)!important;box-shadow:0 10px 22px -10px rgba(124,92,255,.8)!important']
 ];
 s.textContent=R.map(x=>x[0]+'{'+x[1]+'}').join('\n');document.head.appendChild(s)}
{const NAT=new Set(['tiktok-dl2','am-preset','anime-search','anime-ongoing','anime-completed','anime-episode','anime-batch','komik-search','mangaplus']);
 TOOLS_FULL.forEach(t=>{if(NAT.has(t.id)||typeof t.init!=='function')return;const i0=t.init;t.init=function(r){r.classList.add('tk2','tk2g');tk2gCss();return i0.apply(this,arguments)}})}


/* gabungkan ke daftar ringkas: tool bawaan diganti versi lengkap, tool kustom (bila ada) dipertahankan */
{const ex=tools.filter(t=>!TOOLS_FULL.some(f=>f.id===t.id));tools.splice(0,tools.length,...TOOLS_FULL,...ex)}
