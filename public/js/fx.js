/* Efek gerak Malik Tools: Lenis (smooth scroll) + Motion (animasi masuk dan hover).
   Aman dilewati: tanpa library (offline, diblokir, gerak dikurangi) konten tetap tampil normal.
   Tidak ada const/let tingkat atas (lingkup global dipakai bersama), semua di dalam IIFE. */
(function(){
  'use strict';
  var mq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');
  if(mq&&mq.matches)return;
  var cn=navigator.connection||{};
  if(cn.saveData||/(^|-)2g$/.test(cn.effectiveType||''))return;

  var LENIS='https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js',
      MOTION='https://cdn.jsdelivr.net/npm/motion@12.23.0/dist/motion.js';

  function load(src){
    return new Promise(function(ok,no){
      var s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';
      s.onload=ok;s.onerror=no;document.head.appendChild(s);
    });
  }

  /* 1) Lenis: smooth scroll untuk mouse/trackpad. Sentuhan tetap scroll native supaya terasa pas di HP. */
  function startLenis(){
    if(typeof window.Lenis!=='function')return;
    var root=document.documentElement,
        lenis=new window.Lenis({
          lerp:.1,
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

  /* 2) Motion: kartu/baris tool masuk bertahap saat terlihat + hover halus (hanya perangkat dengan mouse). */
  function startMotion(){
    var M=window.Motion;
    if(!M||typeof M.animate!=='function'||typeof M.inView!=='function')return;
    var animate=M.animate,inView=M.inView,SEL='.lhc,.lhs,.lhq,.lhi,.lhab,#hot .hc,.nxg,.tr,.card',n=0,reset=0;
    var canHover=window.matchMedia&&matchMedia('(hover:hover)').matches;

    function reveal(el){
      if(el.dataset.fx)return;el.dataset.fx='1';
      var stop;
      stop=inView(el,function(){
        // urutan masuk: elemen yang muncul di frame yang sama dikasih jeda bertahap (maks. 8)
        var i=Math.min(n++,8);
        if(!reset)reset=requestAnimationFrame(function(){n=0;reset=0});
        var a=animate(el,{opacity:[0,1],y:[18,0],scale:[.985,1]},{duration:.58,delay:i*.055,ease:'easeOut'});
        var clear=function(){el.style.opacity='';el.style.transform=''};
        if(a&&a.then)a.then(clear,clear);
        setTimeout(function(){if(stop)stop()},0); // cukup sekali per elemen
      },{amount:.15});
      if(canHover){
        el.addEventListener('pointerenter',function(e){
          if(e.pointerType==='touch')return;
          animate(el,{y:-4,scale:1.012},{type:'spring',stiffness:360,damping:26});
        });
        el.addEventListener('pointerleave',function(e){
          if(e.pointerType==='touch')return;
          var a=animate(el,{y:0,scale:1},{type:'spring',stiffness:360,damping:28}),
              clear=function(){el.style.transform=''};
          if(a&&a.then)a.then(clear,clear);
        });
      }
    }

    function scan(root){
      if(!root||root.nodeType!==1)return;
      if(root.matches&&root.matches(SEL))reveal(root);
      var l=root.querySelectorAll?root.querySelectorAll(SEL):[];
      for(var i=0;i<l.length;i++)reveal(l[i]);
    }
    var main=document.getElementById('main');
    if(!main)return;
    scan(main);
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++)for(var j=0;j<ms[i].addedNodes.length;j++)scan(ms[i].addedNodes[j]);
    }).observe(main,{childList:true,subtree:true});
  }

  function boot(){
    // Lenis dan Motion dimuat paralel; yang gagal dilewati tanpa mengganggu yang lain.
    load(LENIS).then(startLenis,function(){});
    load(MOTION).then(startMotion,function(){});
  }

  // Tunggu halaman (dan loader awal) selesai, lalu jalan saat browser menganggur.
  function idle(){(window.requestIdleCallback||function(f){setTimeout(f,300)})(boot,{timeout:2500})}
  if(document.readyState==='complete')idle();else addEventListener('load',idle,{once:true});
})();
