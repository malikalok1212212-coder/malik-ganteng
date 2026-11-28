const V='mt-v219',CORE=['/','/offline.html','/style.css?v=484','/js/core.js?v=485','/js/ui.js?v=485','/icon-192.png?v=464','/yuu.jpg','/icon-192.png?v=464','/favicon.ico?v=464','/favicon-32.png','/hero.jpg','/bg.jpg'],LAZY=['/js/fx.js?v=392','/js/sholat.js?v=490','/js/guide.js?v=464','/pemandu.png?v=464','/js/tools.js?v=485','/js/pages.js?v=485','/js/chat.js?v=485'];
// Pasang: shell wajib lengkap, modul lazy (Tools, Halaman, Chat) dicoba terpisah supaya satu kegagalan tidak menggagalkan install. Hasilnya: situs bisa dibuka tanpa internet.
const pre=c=>c.addAll(CORE).then(()=>Promise.all(LAZY.map(u=>c.add(u).catch(()=>{}))));
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(pre).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
const put=(r,res)=>{if(res&&res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res};
// Jaringan dulu; bila lambat (>3 dtk) atau mati, pakai cache. `last` = cadangan terakhir bila cache juga tidak punya.
function netFirst(r,last){
  return new Promise(ok=>{
    let done=false;
    const fall=()=>caches.match(r).then(m=>m||last());
    const t=setTimeout(()=>{fall().then(m=>{if(m&&!done){done=true;ok(m)}})},1200);
    fetch(r).then(res=>{clearTimeout(t);put(r,res);if(!done){done=true;ok(res)}}).catch(()=>{clearTimeout(t);if(!done){done=true;fall().then(m=>ok(m||Response.error()))}});
  });
}
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  // Gambar statis: tampil langsung dari cache, diperbarui diam-diam di belakang.
  if(/\.(jpg|jpeg|png|webp|svg|ico)$/i.test(u.pathname)){
    e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>put(r,res)).catch(()=>m);return m||net}));
    return;
  }
  // Pindah halaman: beranda (termasuk ?url= dari Bagikan) memakai shell '/', halaman lain memakai /offline.html bila belum pernah dibuka.
  if(r.mode==='navigate'){
    e.respondWith(netFirst(r,()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match(u.pathname==='/'?'/':'/offline.html'))));
    return;
  }
  if(u.search.indexOf('v=')>-1&&/\.(css|js)$/i.test(u.pathname)){
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>put(r,res))));
    return;
  }
  e.respondWith(netFirst(r,()=>undefined));
});

// Segarkan cache offline dari halaman Info: kosongkan lalu unduh ulang shell dan modul.
self.addEventListener('message',e=>{
  const d=e.data||{},p=e.ports&&e.ports[0];
  if(d.type==='skip'){self.skipWaiting();return}
  if(d.type==='refresh')e.waitUntil(caches.open(V).then(async c=>{for(const k of await c.keys())await c.delete(k);await pre(c);return(await c.keys()).length}).then(n=>p&&p.postMessage({ok:true,n}),()=>p&&p.postMessage({ok:false})));
});

// Web Push: notifikasi masuk saat situs ditutup. Bila jendela situs sedang terlihat, popup di dalam situs yang menangani (tanpa dobel).
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():''}}
  const url=typeof d.url==='string'&&d.url.charAt(0)==='/'?d.url:'/#chat';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    if(cs.some(c=>c.visibilityState==='visible'&&c.focused))return;
    return self.registration.showNotification(String(d.title||'Malik Tools').slice(0,80),{body:String(d.body||'').slice(0,120),icon:'/icon-192.png?v=464',badge:'/icon-192.png?v=464',tag:String(d.tag||'mt-chat'),renotify:true,data:{url}});
  }));
});
// Kunci langganan diganti browser: daftar ulang otomatis supaya push tidak berhenti diam-diam.
self.addEventListener('pushsubscriptionchange',e=>{
  e.waitUntil((async()=>{
    let key=e.oldSubscription&&e.oldSubscription.options&&e.oldSubscription.options.applicationServerKey;
    if(!key){const j=await(await fetch('/api/push',{credentials:'same-origin'})).json();if(!j.key)return;key=Uint8Array.from(atob(j.key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
    const s=await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await fetch('/api/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'subscribe',sub:s.toJSON()})});
  })().catch(()=>{}));
});

self.addEventListener('notificationclick',e=>{e.notification.close();const u=(e.notification.data&&e.notification.data.url)||'/#chat';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c){if(c.navigate)c.navigate(u).catch(()=>{});return c.focus()}}return self.clients.openWindow(u)}))});
