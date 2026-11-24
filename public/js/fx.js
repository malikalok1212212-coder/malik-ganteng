/* Efek gerak Malik Tools: Lenis (scroll mulus untuk mouse/trackpad) + muncul halus saat di-scroll.
   v392: tanpa library animasi. Elemen yang SUDAH terlihat tidak pernah disembunyikan (tidak ada kedipan);
   hanya elemen di bawah layar yang disembunyikan sebentar lalu muncul lembut (CSS transition) saat mendekat.
   Aman dilewati: gerak dikurangi / hemat data / error apa pun membuat konten tampil normal.
   Tidak ada const/let tingkat atas (lingkup global dipakai bersama), semua di dalam IIFE. */
(function(){
  'use strict';
  var mq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');
  if(mq&&mq.matches)return;
  var cn=navigator.connection||{};
  if(cn.saveData||/(^|-)2g$/.test(cn.effectiveType||''))return;

  var LENIS='https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js';

  function load(src){
    return new Promise(function(ok,no){
      var s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';
      s.onload=ok;s.onerror=no;document.head.appendChild(s);
    });
  }

  /* 1) Lenis: scroll mulus untuk mouse/trackpad. Sentuhan tetap scroll native supaya terasa pas di HP. */
  function startLenis(){
    if(typeof window.Lenis!=='function')return;
    var root=document.documentElement,
        lenis=new window.Lenis({
          lerp:.12,
          smoothWheel:true,
          // area yang punya scroll sendiri (menu samping, sheet, textarea, chat) jangan dibajak
          prevent:function(n){return !!(n.closest&&n.closest('.drw,.gate,.ls,.osl,.lbx,textarea,select,[data-lenis-prevent]'))}
        });
    window.mtLenis=lenis;
    var st=document.createElement('style');st.textContent='html.lenis,html.lenis body{height:auto}.lenis.lenis-smooth{scroll-behavior:auto!important}';document.head.appendChild(st);
    function raf(t){lenis.raf(t);requestAnimationFrame(raf)}
    requestAnimationFrame(raf);
    // Drawer/sheet mengunci scroll lewat html{overflow:hidden}: hentikan Lenis selama itu.
    function sync(){if(root.style.overflow==='hidden')lenis.stop();else lenis.start()}
    new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['style']});
    // Pindah halaman (hash): mulai dari atas tanpa animasi.
    addEventListener('hashchange',function(){lenis.scrollTo(0,{immediate:true})});
  }

  /* 2) Muncul halus: kartu/baris tool di bawah layar naik pelan saat mendekat. */
  function startReveal(){
    var main=document.getElementById('main');
    if(!main)return;
    var SEL='.lhc,.lhs,.lhq,.lhi,.lhab,#hot .hc,.nxg,.tr,.card',pend=[],raf=0,tick=0;
    function vh(){return window.innerHeight||document.documentElement.clientHeight||700}

    function show(el,k){
      if(k)el.style.transitionDelay=Math.min(k,5)*45+'ms';
      el.classList.remove('rv0');el.classList.add('rv1');
      setTimeout(function(){el.classList.remove('rv1');el.style.transitionDelay=''},900+Math.min(k,5)*45);
    }
    function check(){
      raf=0;
      if(!pend.length)return;
      var lim=vh()*.96,k=0;
      for(var i=0;i<pend.length;i++){
        var el=pend[i];
        if(!el.isConnected){pend.splice(i--,1);continue}
        if(el.getBoundingClientRect().top<lim){pend.splice(i--,1);show(el,k++)}
      }
    }
    function soon(){if(!raf)raf=requestAnimationFrame(check)}

    function hide(el){
      if(el.dataset.fx)return;el.dataset.fx='1';
      // sudah terlihat (atau di atas layar): biarkan, supaya tidak ada kedipan hilang-muncul
      if(el.getBoundingClientRect().top<vh()*.96)return;
      el.classList.add('rv0');pend.push(el);
    }
    function scan(root){
      if(!root||root.nodeType!==1)return;
      if(root.matches&&root.matches(SEL))hide(root);
      var l=root.querySelectorAll?root.querySelectorAll(SEL):[];
      for(var i=0;i<l.length;i++)hide(l[i]);
    }

    scan(main);
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++)for(var j=0;j<ms[i].addedNodes.length;j++)scan(ms[i].addedNodes[j]);
      soon();
    }).observe(main,{childList:true,subtree:true});
    addEventListener('scroll',soon,{passive:true});
    addEventListener('resize',soon,{passive:true});
    addEventListener('touchmove',soon,{passive:true});
    // buka/tutup kategori mengubah tinggi halaman tanpa scroll: cek lagi sesudah animasinya
    main.addEventListener('click',function(){setTimeout(soon,80);setTimeout(soon,480)},true);
    // jaring pengaman: tidak ada elemen yang bisa tertinggal tersembunyi
    tick=setInterval(function(){if(pend.length)check()},700);
    setTimeout(function(){while(pend.length){var el=pend.pop();el.classList.remove('rv0')}},15000);
  }

  try{startReveal()}catch(e){
    document.querySelectorAll('.rv0').forEach(function(el){el.classList.remove('rv0')});
  }

  function boot(){load(LENIS).then(startLenis,function(){})}
  // Tunggu halaman (dan loader awal) selesai, lalu jalan saat browser menganggur.
  function idle(){(window.requestIdleCallback||function(f){setTimeout(f,300)})(boot,{timeout:2500})}
  if(document.readyState==='complete')idle();else addEventListener('load',idle,{once:true});
})();
