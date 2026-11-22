/* UI tambahan: tombol melayang, dropdown kustom, Coba lagi / banner gangguan / Bagikan. Dimuat setelah core.js. */
(function(){const f=document.getElementById('fabs'),up=document.getElementById('fup'),ch=document.getElementById('fchat');if(!f)return;
 const sync=()=>{const g=document.querySelector('.gate'),gateOn=!!g&&g.getClientRects().length>0;f.hidden=location.hash==='#chat'||gateOn;{const h=location.hash.slice(1);ch.style.display=(h===''||h==='changelog'||h==='stats')?'':'none'}up.classList.toggle('on',scrollY>400)};
 ch.onclick=()=>{location.hash='#chat'};
 up.onclick=()=>{scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 addEventListener('scroll',()=>{up.classList.toggle('on',scrollY>400);const m=document.documentElement.scrollHeight-innerHeight;up.style.setProperty('--p',m>0?Math.min(100,Math.round(scrollY/m*100)):0)},{passive:true});
 addEventListener('hashchange',sync);try{new MutationObserver(sync).observe(document.body,{childList:true})}catch(e){setInterval(sync,1500)}setTimeout(sync,600);sync();
})();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

/* dropdown kustom: ganti popup bawaan browser dengan bottom sheet */
(function(){
 const CH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',CK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
 let scrim,sheet,cur=null,prevFocus=null;
 const build=()=>{if(sheet)return;scrim=document.createElement('div');scrim.className='ddscrim';sheet=document.createElement('div');sheet.className='ddsheet';sheet.setAttribute('role','listbox');document.body.append(scrim,sheet);scrim.onclick=close;
  addEventListener('keydown',e=>{if(e.key==='Escape'&&cur)close()})};
 const label=s=>{const o=s.options[s.selectedIndex];return o?o.textContent:''};
 function close(){if(!cur)return;const b=cur.btn;sheet.classList.remove('on');scrim.classList.remove('on');b.setAttribute('aria-expanded','false');document.documentElement.style.overflow='';cur=null;try{b.focus({preventScroll:true})}catch(e){}}
 function open(s,b){build();cur={s,btn:b};b.textContent='';
  const lb=s.id&&document.querySelector('label[for="'+s.id+'"]'),title=(lb&&lb.textContent.replace(/^\s*[•·]\s*/,'').trim())||'Pilih';
  const tc=getComputedStyle(b).getPropertyValue('--tc')||'#5be59c';sheet.style.setProperty('--tc',tc.trim()||'#5be59c');
  sheet.innerHTML='<div class="dh2"><i></i><b></b></div><div class="dl2"></div>';sheet.querySelector('b').textContent=title;
  const L=sheet.querySelector('.dl2');
  [...s.options].forEach((o,i)=>{const x=document.createElement('button');x.type='button';x.className='do';x.setAttribute('role','option');x.setAttribute('aria-selected',i===s.selectedIndex);x.innerHTML='<span></span><em>'+CK+'</em>';x.firstChild.textContent=o.textContent;x.firstChild.style.flex='1';x.firstChild.style.minWidth='0';
   x.onclick=()=>{s.selectedIndex=i;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));paint(s);close()};L.append(x)});
  b.innerHTML='';paint(s);b.setAttribute('aria-expanded','true');document.documentElement.style.overflow='hidden';
  requestAnimationFrame(()=>{scrim.classList.add('on');sheet.classList.add('on');const a=L.querySelector('[aria-selected="true"]');if(a)a.scrollIntoView({block:'center'})})}
 function paint(s){const b=s._ddb;if(!b)return;b.innerHTML='<span></span>'+CH;b.firstChild.textContent=label(s)}
 function enhance(s){if(s._ddb||s.multiple||s.closest('.owp,.rrow,.dd'))return;
  const w=document.createElement('div');w.className='dd';s.parentNode.insertBefore(w,s);
  const b=document.createElement('button');b.type='button';b.className='ddb';b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');
  const lb=s.id&&document.querySelector('label[for="'+s.id+'"]');if(lb)b.setAttribute('aria-label',lb.textContent.trim()+': '+label(s));
  w.append(b,s);s.tabIndex=-1;s.setAttribute('aria-hidden','true');s._ddb=b;paint(s);
  b.onclick=()=>open(s,b);s.addEventListener('change',()=>paint(s));
  if(lb)lb.addEventListener('click',e=>{e.preventDefault();b.click()})}
 const scan=r=>(r||document).querySelectorAll('select').forEach(enhance);
 const start=()=>{scan();try{new MutationObserver(()=>scan()).observe(document.getElementById('c')?document.body:document.body,{childList:true,subtree:true})}catch(e){setInterval(scan,800)}};
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',start);else start();
})();

/* v182e: dropdown kustom untuk semua <select> */
(function(){
 var sel=null,box=null,bd=null;
 function lab(s){var l=s.id&&document.querySelector('label[for="'+(window.CSS&&CSS.escape?CSS.escape(s.id):s.id)+'"]');
  if(!l){var p=s.parentElement;l=p&&p.querySelector('label')}
  var t=(l&&l.textContent||s.getAttribute('aria-label')||'Pilih').replace(/\s+/g,' ').trim();return t||'Pilih'}
 function close(){if(!box)return;var b=box,d=bd,s=sel;box=bd=sel=null;if(s)s.classList.remove('cs-open');b.classList.remove('on');d.classList.remove('on');setTimeout(function(){b.remove();d.remove()},260)}
 function open(s){
  if(box)close();sel=s;s.classList.add('cs-open');
  bd=document.createElement('div');bd.className='csb';
  box=document.createElement('div');box.className='css'+(s.closest('.owp')?' y':'');box.setAttribute('role','dialog');box.setAttribute('aria-label',lab(s));
  var h=document.createElement('div');h.className='hd';box.appendChild(h);
  var t=document.createElement('div');t.className='tt';t.textContent=lab(s);box.appendChild(t);
  var ls=document.createElement('div');ls.className='ls';ls.setAttribute('role','listbox');
  Array.prototype.forEach.call(s.options,function(o,i){
   if(o.hidden)return;
   var b=document.createElement('button');b.type='button';b.className='op';b.setAttribute('role','option');
   b.setAttribute('aria-selected',String(i===s.selectedIndex));
   var sp=document.createElement('span');sp.textContent=o.textContent;b.appendChild(sp);
   var ck=document.createElement('i');ck.className='ck';b.appendChild(ck);
   if(o.disabled)b.disabled=true;
   b.onclick=function(){var t=s;close();if(t.selectedIndex!==i){t.selectedIndex=i;t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}))}};
   ls.appendChild(b)});
  box.appendChild(ls);
  bd.onclick=close;
  document.body.appendChild(bd);document.body.appendChild(box);
  requestAnimationFrame(function(){bd.classList.add('on');box.classList.add('on');var a=ls.querySelector('[aria-selected=true]');if(a)ls.scrollTop=Math.max(0,a.offsetTop-ls.clientHeight/2+25)})}
 function hit(x,y){var all=document.querySelectorAll('select:not([multiple]):not([disabled])');
  for(var i=0;i<all.length;i++){var s=all[i];if(s._ddb||s.closest('.dd'))continue;if(!s.getClientRects().length)continue;var r=s.getBoundingClientRect();
   if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){var el=document.elementFromPoint(x,y);if(el&&(s===el||s.contains(el)||(s.parentElement&&s.parentElement.contains(el))))return s}}return null}
 document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.css'))return;var s=hit(e.clientX,e.clientY);if(s){e.preventDefault();open(s)}},true);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&box){close();return}
  var a=document.activeElement;if(a&&a.tagName==='SELECT'&&!a.multiple&&!a._ddb&&!a.closest('.dd')&&(e.key==='Enter'||e.key===' '||e.key==='ArrowDown')){e.preventDefault();open(a)}});
})();

document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#lhs');if(!b)return;var m=document.getElementById('mn');if(m)m.click();setTimeout(function(){var i=document.querySelector('#drw .sr input');if(i)i.focus()},320)});

/* v312: Coba lagi, banner gangguan per tool, tombol Bagikan */
(function(){
var ERR=/provider|cloudflare|terlalu lama|gagal menghubungi|server provider|http 5|tidak mengembalikan|coba lagi/i,busy=false,tick=0;
var SHI='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2"/></svg>';
function msgOf(el){return el.closest('.panel')||document}
function retry(m){
  var nx=m.nextElementSibling;
  var show=m.classList.contains('bad')&&ERR.test(m.textContent||'')&&!!msgOf(m).querySelector('#go');
  if(show&&!(nx&&nx.classList.contains('rtry'))){
    var b=document.createElement('button');b.type='button';b.className='rtry';b.textContent='\u21BB Coba lagi';
    b.onclick=function(){var go=msgOf(m).querySelector('#go');b.remove();if(go&&!go.disabled)go.click()};
    m.after(b);
  }else if(!show&&nx&&nx.classList.contains('rtry'))nx.remove();
}
function warn(){
  var mn=document.getElementById('main'),id=mn&&mn.dataset.tool,pn=mn&&mn.querySelector('.panel .in'),w=mn&&mn.querySelector('.svcw');
  var down=typeof SVC!=='undefined'&&SVC.down&&id&&SVC.down.indexOf(id)>-1;
  if(down&&pn&&!w){var d=document.createElement('div');d.className='svcw';d.setAttribute('role','status');d.textContent='Provider tool ini sedang gangguan. Hasil bisa gagal, coba lagi beberapa saat lagi.';pn.prepend(d)}
  else if(!down&&w)w.remove();
}
function share(){
  document.querySelectorAll('.out .row').forEach(function(row){
    if(row.querySelector('.shr'))return;
    var dl=row.querySelector('#dl'),out=row.closest('.out'),img=out&&(out.querySelector('.bax .al img')||Array.prototype.slice.call(out.querySelectorAll('.cmp img')).pop());
    if(!dl||!img)return;
    var b=document.createElement('button');b.type='button';b.className='btn dlb shr';b.innerHTML=SHI+'Bagikan';
    b.onclick=async function(){
      var m=document.getElementById('m'),src=img.currentSrc||img.src,t=b.innerHTML;
      try{
        var blob=await (await fetch(src,{credentials:'same-origin'})).blob();
        var ext=(blob.type.split('/')[1]||'png').replace('jpeg','jpg'),f=new File([blob],'malik-tools.'+ext,{type:blob.type||'image/png'});
        if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Malik Tools'});return}
        var ol='';try{ol=new URL(dl.href,location.href).searchParams.get('u')||''}catch(e){}
        if(/^https?:/.test(ol)){window.open('https://wa.me/?text='+encodeURIComponent(ol+'\n\nDibuat dengan Malik Tools'),'_blank','noopener');return}
        if(m){m.className='msg';m.textContent='Browser ini belum mendukung Bagikan. Pakai tombol Unduh Foto lalu kirim dari galeri.'}
      }catch(e){if(e&&e.name==='AbortError')return;if(m){m.className='msg bad';m.textContent='Gagal membagikan. Coba Unduh Foto lalu kirim dari galeri.'}}
      b.innerHTML=t;
    };
    dl.after(b);
  });
}
function scan(){
  busy=false;
  document.querySelectorAll('#main p.msg').forEach(retry);
  warn();share();
}
new MutationObserver(function(){if(busy)return;busy=true;requestAnimationFrame(scan)}).observe(document.getElementById('main')||document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
setInterval(function(){tick++;if(typeof mtStatus==='function'&&tick%6===0)mtStatus();warn()},10000);
})();

/* Banner offline: muncul saat koneksi putus, hilang sendiri saat tersambung lagi. */
(function(){let b=null;const show=()=>{if(b)return;b=document.createElement('div');b.className='offb';b.setAttribute('role','status');b.textContent='Kamu sedang offline. Halaman yang pernah dibuka tetap bisa dipakai.';document.body.appendChild(b)},hide=()=>{if(b){b.remove();b=null}};
 addEventListener('offline',show);addEventListener('online',hide);if(!navigator.onLine)show()})();
