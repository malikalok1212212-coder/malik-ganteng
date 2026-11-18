const V='mt-v48',SHELL=['/','/logo.jpg','/icon-192.png','/hero.jpg','/bg.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
const put=(r,res)=>{if(res&&res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res};
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  // Gambar statis: tampil langsung dari cache, diperbarui diam-diam di belakang.
  if(/\.(jpg|jpeg|png|webp|svg|ico)$/i.test(u.pathname)){
    e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>put(r,res)).catch(()=>m);return m||net}));
    return;
  }
  // Halaman: ambil versi terbaru; bila jaringan lambat (>3 dtk) atau mati, pakai cache.
  e.respondWith(new Promise(ok=>{
    let done=false;
    const fall=()=>caches.match(r).then(m=>m||caches.match('/'));
    const t=setTimeout(()=>{fall().then(m=>{if(m&&!done){done=true;ok(m)}})},3000);
    fetch(r).then(res=>{clearTimeout(t);put(r,res);if(!done){done=true;ok(res)}}).catch(()=>{clearTimeout(t);if(!done){done=true;fall().then(m=>ok(m||Response.error()))}});
  }));
});
