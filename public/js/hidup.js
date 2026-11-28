/* Header hidup: animasi halus di bilah atas (logo berkilau, denyut status/mahkota, ikon tema berputar,
   riak sentuhan, garis progres scroll). Semua gerak hanya aktif jika HP tidak memilih "kurangi gerakan".
   Tidak ada const/let tingkat atas (lingkup global dipakai bersama), semua di dalam IIFE. */
(function () {
  'use strict';
  if (window.__mtHidup) return; window.__mtHidup = 1;
  var css = '@media (prefers-reduced-motion:no-preference){'
    /* masuk: tombol/logo muncul bergantian */
    + '.top>*{animation:mtin .55s cubic-bezier(.2,.9,.25,1.15) backwards}'
    + '.top>:nth-child(2){animation-delay:.06s}.top>:nth-child(3){animation-delay:.12s}.top>:nth-child(4){animation-delay:.18s}'
    + '@keyframes mtin{from{opacity:0;transform:translateY(-14px) scale(.86)}}'
    /* logo: kilau lewat + denyut cahaya aksen */
    + '.top .logo{position:relative;animation:mtglow 3.6s ease-in-out infinite;transition:transform .2s}'
    + '.top .logo:after{content:"";position:absolute;inset:-30% -60%;pointer-events:none;background:linear-gradient(110deg,transparent 42%,rgba(255,255,255,.6) 50%,transparent 58%);transform:translateX(-110%);animation:mtglint 5.2s ease-in-out 1.4s infinite}'
    + '.top .logo.mtpop{animation:mtpop .5s cubic-bezier(.3,1.5,.5,1)}'
    + '@keyframes mtglow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--acc,#e5232e) 0%,transparent)}50%{box-shadow:0 0 14px 1px color-mix(in srgb,var(--acc,#e5232e) 55%,transparent)}}'
    + '@keyframes mtglint{0%,62%{transform:translateX(-110%)}100%{transform:translateX(110%)}}'
    + '@keyframes mtpop{0%{transform:scale(1)}35%{transform:scale(.84) rotate(-6deg)}70%{transform:scale(1.14) rotate(4deg)}100%{transform:scale(1)}}'
    /* titik status / mahkota: cincin denyut + mahkota bergoyang */
    + '.top .pill{position:relative;overflow:visible}'
    + '.top .pill:after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #4fd69a;opacity:0;pointer-events:none;animation:mtping 2.8s ease-out infinite}'
    + 'html .top .pill:before{animation:mtbeat 2.8s ease-in-out infinite}'
    + 'html .top .pill.dev:before{animation:mtcrown 4.2s ease-in-out infinite;transform-origin:50% 85%}'
    + '@keyframes mtping{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(1.32);opacity:0}}'
    + '@keyframes mtbeat{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}'
    + '@keyframes mtcrown{0%,78%,100%{transform:rotate(0) scale(1)}83%{transform:rotate(-14deg) scale(1.14)}89%{transform:rotate(12deg) scale(1.14)}94%{transform:rotate(-5deg) scale(1.06)}}'
    /* ikon tema: sinar matahari berputar pelan, berputar cepat saat diketuk */
    + 'html[data-theme="dark"] .top #th svg{animation:mtspin 26s linear infinite}'
    + '.top #th.mtspin svg{animation:mtspin2 .65s cubic-bezier(.3,1.4,.5,1)}'
    + '@keyframes mtspin{to{transform:rotate(360deg)}}'
    + '@keyframes mtspin2{from{transform:rotate(-200deg) scale(.5)}to{transform:rotate(0) scale(1)}}'
    /* riak sentuhan di tombol header */
    + '.top .ib{position:relative;overflow:hidden}'
    + '.mtrp{position:absolute;border-radius:50%;pointer-events:none;background:color-mix(in srgb,var(--acc,#e5232e) 45%,transparent);transform:scale(0);animation:mtrp .6s ease-out forwards}'
    + '@keyframes mtrp{to{transform:scale(1);opacity:0}}'
    + '}'
    /* garis progres scroll di dasar header */
    + '.mtsp{position:absolute;left:0;right:0;bottom:0;height:2px;pointer-events:none;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,var(--acc,#e5232e),#f6d58a);opacity:0;transition:opacity .25s}'
    + '.top.mtsc .mtsp{opacity:1}';
  var st = document.createElement('style'); st.id = 'mtcss'; st.textContent = css; document.head.appendChild(st);

  function boot() {
    var top = document.querySelector('header.top'); if (!top) return;
    var bar = document.createElement('i'); bar.className = 'mtsp'; bar.setAttribute('aria-hidden', 'true'); top.appendChild(bar);
    var raf = 0, el = null;
    function upd() {
      raf = 0;
      var h = 0, y = 0;
      if (!el || el === document || el === document.documentElement || el === document.body) {
        var de = document.documentElement; h = de.scrollHeight - window.innerHeight; y = window.pageYOffset || de.scrollTop || 0;
      } else { h = el.scrollHeight - el.clientHeight; y = el.scrollTop; }
      bar.style.transform = 'scaleX(' + (h > 24 ? Math.max(0, Math.min(1, y / h)) : 0).toFixed(3) + ')';
      top.classList.toggle('mtsc', y > 8 && h > 24);
    }
    document.addEventListener('scroll', function (e) {
      var t = e.target;
      if (t !== document && !(t.clientHeight > window.innerHeight * .5)) return;
      el = t; if (!raf) raf = requestAnimationFrame(upd);
    }, { capture: true, passive: true });
    upd();

    top.addEventListener('pointerdown', function (e) {
      var b = e.target.closest ? e.target.closest('.ib') : null; if (!b || !top.contains(b)) return;
      var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6, s = document.createElement('span');
      s.className = 'mtrp'; s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
      b.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
    }, { passive: true });
    top.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('#th,.logo,.brand') : null; if (!t) return;
      var n = t.id === 'th' ? t : top.querySelector('.logo'), c = t.id === 'th' ? 'mtspin' : 'mtpop';
      if (!n) return; n.classList.remove(c); void n.offsetWidth; n.classList.add(c);
      setTimeout(function () { n.classList.remove(c); }, 700);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
