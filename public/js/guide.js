/* Pemandu Malik: maskot kucing interaktif.
   - Ketuk maskot: bantuan sesuai halaman (beranda, tool, halaman lain).
   - Tur singkat dengan sorotan (spotlight) ke menu, pencarian, tema, dan navigasi.
   - Sapaan pertama kali dan saran singkat saat membuka tool baru (bisa dimatikan).
   Semua preferensi disimpan di perangkat (localStorage), tidak dikirim ke server. */
(function () {
  'use strict';
  if (window.mtGuide) return;
  var D = document, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ls = {
    g: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    s: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var q = function (s, r) { return (r || D).querySelector(s); };
  var E = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var T = function () { return typeof tools !== 'undefined' && Array.isArray(tools) ? tools : []; };
  var hid = function () { return location.hash.slice(1); };
  var tool = function (id) { return T().find(function (t) { return t.id === id; }); };
  var go = function (id) { location.hash = id ? '#' + id : ''; };

  var kind = function (id) {
    if (/spotify|anime|komik/.test(id)) return 'search';
    if (/(^|-)dl2?$|tiktok|^ig-|youtube|mediafire|dailymotion|soundcloud/.test(id)) return 'link';
    if (/foto|gambar|upscale|background|watermark|kolase|avatar|kompres|swhd|sticker|filter/.test(id)) return 'image';
    if (/kalkulator|hitung|persen|konversi|pengubah|terbilang|romawi|split|umur/.test(id)) return 'calc';
    return 'any';
  };
  var STEPS = {
    link: ['Salin link dari aplikasinya', 'Tempel di kolom, atau ketuk ikon tempel', 'Tekan tombol, lalu pilih format dan Unduh'],
    image: ['Pilih foto dari galeri', 'Atur pilihan yang tersedia', 'Tekan tombol proses, lalu unduh hasilnya'],
    calc: ['Isi angka di kolom yang tersedia', 'Hasil tampil langsung di bawah', 'Ketuk Salin hasil bila perlu'],
    search: ['Ketik judul atau kata kunci', 'Tekan tombol cari', 'Pilih hasil yang kamu mau'],
    any: ['Isi kolom yang tersedia', 'Tekan tombol utama', 'Salin atau unduh hasilnya']
  };
  var greet = function () {
    var h = new Date().getHours();
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  };
  var short = function (s) { s = String(s || ''); var m = s.match(/^[^.!?]{10,140}[.!?]?/); return m ? m[0].trim() : s.slice(0, 120); };

  /* ---------- CSS ---------- */
  var HV = 'html:not(#_):not(#__):not(#___):not(#____):not(#_____):root:root:root:root:root ';
  function css() {
    if (q('#mgcss')) return;
    var R = [
      ['.mg', 'position:fixed;left:14px;bottom:calc(82px + env(safe-area-inset-bottom,0px));z-index:6;font-family:inherit;color:#f5f5f6;-webkit-tap-highlight-color:transparent'],
      ['.mg[hidden]', 'display:none'],
      ['.mgf', 'position:relative;width:58px;height:58px;min-height:0;padding:0;margin:0;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:radial-gradient(circle at 30% 25%,#242426,#0b0b0d);box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 2px rgba(227,38,46,.38);cursor:pointer;display:grid;place-items:center;transition:transform .15s,opacity .25s;touch-action:none'],
      ['.mg.mgq .mgf', 'opacity:.3'],
      ['.mg.mgD .mgb', 'bottom:auto;top:72px;transform-origin:22px 0'],
      ['.mg.mgD .mgb:after', 'bottom:auto;top:-7px;transform:rotate(225deg)'],
      ['.mgf:active', 'transform:scale(.94)'],
      ['.mgf img', 'width:42px;height:42px;object-fit:contain;pointer-events:none;transform-origin:50% 90%;animation:mgw 7s ease-in-out infinite'],
      ['.mgf.talk img', 'animation:mgt .45s ease 2'],
      ['.mgf.new:before', 'content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid #e3262e;animation:mgp 1.6s ease-out infinite'],
      ['.mgb', 'position:absolute;left:0;bottom:72px;width:min(304px,calc(100vw - 28px));padding:14px 14px 12px;border-radius:18px;background:linear-gradient(180deg,#1a1a1d,#141416);border:1px solid rgba(255,255,255,.1);box-shadow:0 2px 8px rgba(0,0,0,.4);transform-origin:22px 100%;animation:mgi .22s ease both'],
      ['.mgb[hidden]', 'display:none'],
      ['.mgb:after', 'content:"";position:absolute;left:var(--mgt,23px);bottom:-7px;width:13px;height:13px;background:#141416;border:solid rgba(255,255,255,.1);border-width:0 1px 1px 0;transform:rotate(45deg)'],
      ['.mgt', 'margin:0 24px 0 0;min-height:21px;font-size:14px;line-height:1.5;color:#f5f5f6'],
      ['.mgl', 'margin:11px 0 0;padding:0;list-style:none;display:grid;gap:8px;counter-reset:mgs'],
      ['.mgl li', 'display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.4;color:#d4d4d8;counter-increment:mgs;animation:mgi .25s ease both'],
      ['.mgl li:before', 'content:counter(mgs);flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:rgba(227,38,46,.22);color:#ff5b62;font-size:11.5px;font-weight:700'],
      ['.mga', 'display:flex;flex-wrap:wrap;gap:7px;margin-top:12px'],
      ['.mgc', 'min-height:0;height:34px;margin:0;padding:0 13px;border-radius:99px;border:1px solid rgba(255,255,255,.13);background:#242426;color:#f5f5f6;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;box-shadow:none;text-transform:none;letter-spacing:0;animation:mgi .25s ease both'],
      ['.mgc.p', 'border:0;color:#fff;background:#e3262e'],
      ['.mgx', 'position:absolute;right:8px;top:8px;width:28px;height:28px;min-height:0;padding:0;margin:0;border-radius:50%;border:0;background:#242426;color:#a1a1a9;font-size:16px;line-height:1;cursor:pointer;display:grid;place-items:center'],
      ['.mgo,.mgh', 'display:block;min-height:0;height:auto;margin:11px 0 0;padding:0;border:0;background:none;color:#6b6b73;font-family:inherit;font-size:11.5px;text-decoration:underline;cursor:pointer;box-shadow:none'],
      ['.mgo + .mgh', 'margin-top:7px'],
      ['.mgn', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:82;max-width:calc(100vw - 28px);box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:99px;background:#1a1a1d;border:1px solid rgba(255,255,255,.12);box-shadow:0 2px 8px rgba(0,0,0,.4);color:#f5f5f6;font-size:13px;line-height:1.4;animation:mgi .22s ease both'],
      ['.mgn button', 'min-height:0;height:30px;margin:0;padding:0 12px;border-radius:99px;border:0;background:#e3262e;color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;flex:none'],
      ['.mgsr', 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)'],
      /* tur */
      ['.mgk', 'position:fixed;inset:0;z-index:79;background:transparent'],
      ['.mgk.dim', 'background:rgba(5,6,10,.76)'],
      ['.mgs', 'position:fixed;z-index:80;border-radius:16px;pointer-events:none;box-shadow:0 0 0 9999px rgba(5,6,10,.76),0 0 0 2px #e3262e;transition:left .3s ease,top .3s ease,width .3s ease,height .3s ease'],
      ['.mgtc', 'position:fixed;z-index:81;left:50%;transform:translateX(-50%);width:min(344px,calc(100vw - 24px));box-sizing:border-box;padding:14px;display:grid;grid-template-columns:48px 1fr;gap:6px 12px;border-radius:20px;background:linear-gradient(180deg,#1a1a1d,#141416);border:1px solid rgba(255,255,255,.12);box-shadow:0 2px 10px rgba(0,0,0,.45);color:#f5f5f6'],
      ['.mgtc.top', 'top:calc(72px + env(safe-area-inset-top,0px))'],
      ['.mgtc.bot', 'bottom:calc(20px + env(safe-area-inset-bottom,0px))'],
      ['.mgtc img', 'width:48px;height:48px;padding:6px;box-sizing:border-box;border-radius:50%;background:#0b0b0d;border:1px solid rgba(255,255,255,.14);object-fit:contain;grid-row:span 2'],
      ['.mgtc p', 'margin:0;font-size:14px;line-height:1.5'],
      ['.mgtn', 'display:flex;align-items:center;justify-content:space-between;gap:8px'],
      ['.mgd', 'display:flex;gap:5px'],
      ['.mgd i', 'width:6px;height:6px;border-radius:50%;background:#3a3a3e'],
      ['.mgd i.on', 'width:16px;border-radius:99px;background:#e3262e'],
      ['.mgtb', 'display:flex;gap:6px'],
      ['.mgtb .mgc', 'height:32px;padding:0 12px']
    ];
    var s = D.createElement('style'); s.id = 'mgcss';
    s.textContent = R.map(function (x) {
      return x[0].split(',').map(function (a) { return HV + a.trim(); }).join(',') + '{' + x[1] + '}';
    }).join('\n') +
      '\n@keyframes mgw{0%,86%,100%{transform:rotate(0)}89%{transform:rotate(-9deg)}92%{transform:rotate(8deg)}95%{transform:rotate(-5deg)}}' +
      '@keyframes mgt{0%,100%{transform:translateY(0)}40%{transform:translateY(-5px) scale(1.06)}}' +
      '@keyframes mgp{from{transform:scale(.9);opacity:.9}to{transform:scale(1.35);opacity:0}}' +
      '@keyframes mgi{from{opacity:0;transform:translateY(6px) scale(.97)}}' +
      '@media(prefers-reduced-motion:reduce){.mgf img,.mgf.talk img,.mgf.new:before,.mgb,.mgl li,.mgc{animation:none!important}.mgs{transition:none}}';
    D.head.appendChild(s);
  }

  /* ---------- Elemen dasar ---------- */
  var root, fab, bub, txt, sr, lst, acts, tw = 0, autoT = 0, tourEls = null, dragged = false;

  function build() {
    css();
    root = D.createElement('div'); root.className = 'mg'; root.id = 'mg';
    root.innerHTML =
      '<div class="mgb" role="dialog" aria-label="Pemandu Malik" hidden>' +
      '<button type="button" class="mgx" aria-label="Tutup pemandu">&times;</button>' +
      '<p class="mgt" aria-hidden="true"></p><span class="mgsr" role="status" aria-live="polite"></span>' +
      '<ol class="mgl" hidden></ol><div class="mga"></div>' +
      '<button type="button" class="mgo"></button><button type="button" class="mgh">Sembunyikan pemandu</button></div>' +
      '<button type="button" class="mgf" aria-label="Buka pemandu Malik" aria-expanded="false"><img src="/pemandu.png?v=461" alt="" width="42" height="42"></button>';
    D.body.appendChild(root);
    fab = q('.mgf', root); bub = q('.mgb', root); txt = q('.mgt', root); sr = q('.mgsr', root);
    lst = q('.mgl', root); acts = q('.mga', root);
    fab.onclick = function () { if (dragged) { dragged = false; return; } if (bub.hidden) menu(); else close(); };
    drag(); fade();
    q('.mgx', root).onclick = function () { close(); };
    q('.mgo', root).onclick = function () {
      ls.s('mt_guide_off', ls.g('mt_guide_off') === '1' ? '0' : '1'); optLabel();
    };
    q('.mgh', root).onclick = function () { setHidden(true, true); };
    bub.onclick = function (e) { if (e.target === txt) skip(); };
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (tourEls) endTour(true); else if (!bub.hidden) close(); } });
    optLabel();
  }

  /* ---------- Geser maskot, posisi gelembung, memudar saat scroll ---------- */
  function clampPos(x, y) {
    var w = root.offsetWidth || 58, h = root.offsetHeight || 58;
    return [Math.max(6, Math.min(innerWidth - w - 6, x)), Math.max(6, Math.min(innerHeight - h - 6, y))];
  }
  function applyPos(x, y) { var p = clampPos(x, y); root.style.left = p[0] + 'px'; root.style.bottom = p[1] + 'px'; }
  function drag() {
    var sv = ls.g('mt_guide_pos');
    if (sv) { try { var o = JSON.parse(sv); if (isFinite(o.x) && isFinite(o.y)) applyPos(o.x, o.y); } catch (e) {} }
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false, mv = false;
    fab.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      var r = root.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = innerHeight - r.bottom; on = true; mv = false;
      try { fab.setPointerCapture(e.pointerId); } catch (x) {}
    });
    fab.addEventListener('pointermove', function (e) {
      if (!on) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!mv && Math.hypot(dx, dy) < 8) return;
      if (!mv) { mv = true; close(); }
      applyPos(ox + dx, oy - dy);
    });
    var end = function () {
      if (!on) return; on = false;
      if (mv) {
        dragged = true; setTimeout(function () { dragged = false; }, 400);
        var r = root.getBoundingClientRect(); ls.s('mt_guide_pos', JSON.stringify({ x: Math.round(r.left), y: Math.round(innerHeight - r.bottom) }));
      }
    };
    fab.addEventListener('pointerup', end); fab.addEventListener('pointercancel', end);
    addEventListener('resize', function () { var r = root.getBoundingClientRect(); if (root.style.left) applyPos(r.left, innerHeight - r.bottom); });
  }
  function fade() {
    var qt = 0;
    D.addEventListener('scroll', function () {
      if (!root || !bub.hidden) return;
      root.classList.add('mgq'); clearTimeout(qt); qt = setTimeout(function () { root.classList.remove('mgq'); }, 700);
    }, { capture: true, passive: true });
  }
  function placeBub() {
    var r = root.getBoundingClientRect(), W = Math.min(304, innerWidth - 28);
    var left = Math.max(8, Math.min(innerWidth - 8 - W, r.left)), off = left - r.left;
    bub.style.left = off + 'px'; bub.style.setProperty('--mgt', (23 - off) + 'px');
    root.classList.toggle('mgD', r.top < 330);
  }
  function optLabel() { q('.mgo', root).textContent = ls.g('mt_guide_off') === '1' ? 'Nyalakan saran otomatis' : 'Matikan saran otomatis'; }

  var full = '', pend = null;
  function showActs() {
    if (!pend) return;
    var p = pend; pend = null;
    if (p.list && p.list.length) { lst.innerHTML = p.list.map(function (x, i) { return '<li style="animation-delay:' + (i * 70) + 'ms">' + E(x) + '</li>'; }).join(''); lst.hidden = false; }
    acts.innerHTML = '';
    (p.acts || []).forEach(function (a, i) {
      var b = D.createElement('button'); b.type = 'button'; b.className = 'mgc' + (i === 0 && a.p !== false ? ' p' : '');
      b.textContent = a.t; b.style.animationDelay = (120 + i * 60) + 'ms';
      b.onclick = function () { a.fn(); }; acts.appendChild(b);
    });
  }
  function skip() { clearTimeout(tw); txt.textContent = full; showActs(); }
  function say(text, o) {
    o = o || {}; clearTimeout(tw); clearTimeout(autoT);
    full = text; pend = { list: o.list, acts: o.acts };
    sr.textContent = text; txt.textContent = ''; lst.hidden = true; lst.innerHTML = ''; acts.innerHTML = '';
    placeBub(); root.classList.remove('mgq');
    bub.hidden = false; fab.setAttribute('aria-expanded', 'true'); fab.classList.remove('new');
    if (!calm) { fab.classList.remove('talk'); void fab.offsetWidth; fab.classList.add('talk'); }
    if (calm) { txt.textContent = text; showActs(); }
    else {
      var i = 0, step = function () { i += 2; txt.textContent = text.slice(0, i); if (i < text.length) tw = setTimeout(step, 22); else showActs(); };
      step();
    }
    if (o.auto) autoT = setTimeout(close, o.auto + text.length * 22);
  }
  function close() {
    clearTimeout(tw); clearTimeout(autoT); pend = null;
    if (bub) { bub.hidden = true; fab.setAttribute('aria-expanded', 'false'); }
  }

  /* ---------- Konten kontekstual ---------- */
  function homeHelp() {
    var quick = [['tiktok-dl2', 'Unduh TikTok'], ['qr-code', 'Buat QR'], ['kompres-gambar', 'Kompres foto'], ['kalkulator-cicilan', 'Hitung cicilan']]
      .filter(function (x) { return tool(x[0]); }).slice(0, 3).map(function (x) { return { t: x[1], p: false, fn: function () { close(); go(x[0]); } }; });
    say(greet() + '! Aku Malik, pemandu kamu. Mau kutunjukkan cara pakainya, atau langsung cari tool?', {
      acts: [{ t: 'Tur singkat', fn: tour }, { t: 'Cari tool', p: false, fn: focusSearch }].concat(quick)
    });
  }
  function toolHelp(t) {
    var id = t.id, m = (typeof META !== 'undefined' && META[id]) || {}, d = short(t.desc);
    var txtv = 'Ini ' + t.name + '.' + (d ? ' ' + d : '');
    if (m.note && /koin/i.test(m.note)) txtv += ' Memakai ' + m.note.toLowerCase() + ' tiap pemakaian, saldo ada di tab Koin.';
    var k = kind(id), sim = T().filter(function (x) { return x.id !== id && kind(x.id) === k && k !== 'any'; }).slice(0, 2)
      .map(function (x) { return { t: x.name, p: false, fn: function () { close(); go(x.id); } }; });
    say(txtv, { list: STEPS[k], acts: [{ t: 'Ke beranda', p: false, fn: function () { close(); go(''); } }].concat(sim) });
  }
  function pageHelp() {
    say('Butuh bantuan? Aku bisa antar ke beranda, buka halaman Bantuan, atau tunjukkan tur singkat.', {
      acts: [{ t: 'Ke beranda', fn: function () { close(); go(''); } }, { t: 'Bantuan', p: false, fn: function () { location.href = '/bantuan'; } }, { t: 'Tur singkat', p: false, fn: tour }]
    });
  }
  function menu() { var id = hid(), t = tool(id); if (t) toolHelp(t); else if (!id) homeHelp(); else pageHelp(); }
  function focusSearch() {
    close(); if (hid()) go('');
    setTimeout(function () { var s = q('#hq'); if (s) { s.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' }); s.focus(); } }, 450);
  }

  /* ---------- Tur dengan sorotan ---------- */
  var TOUR = [
    { s: '#mn', t: 'Ini tombol menu. Dari sini kamu bisa buka akun, riwayat, dan pengaturan.' },
    { s: '#hq', t: 'Cari tool lewat sini. Ketik nama tool atau kebutuhanmu, misalnya "qr" atau "unduh".' },
    { s: '.top .pill', t: 'Lampu status ini menunjukkan apakah semua layanan sedang normal.' },
    { s: '#th', t: 'Ganti tema terang atau gelap di sini, sesuai nyamanmu.' },
    { s: '#bnav', t: 'Navigasi bawah: Beranda, Riwayat, Chat, Koin, dan Profil.' },
    { s: null, t: 'Sudah! Pilih satu tool dan coba. Ketuk aku kapan saja kalau butuh bantuan.' }
  ];
  function vis(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function tour() {
    close();
    var start = function () {
      var steps = TOUR.filter(function (x) { return !x.s || vis(q(x.s)); });
      if (steps.length < 2) { say('Tur belum bisa dimulai di halaman ini. Coba dari beranda ya.', { acts: [{ t: 'Ke beranda', fn: function () { close(); go(''); } }] }); return; }
      var bk = D.createElement('div'); bk.className = 'mgk';
      var sp = D.createElement('div'); sp.className = 'mgs';
      var cd = D.createElement('div'); cd.className = 'mgtc bot'; cd.setAttribute('role', 'dialog'); cd.setAttribute('aria-label', 'Tur singkat');
      cd.innerHTML = '<img src="/pemandu.png?v=461" alt=""><p class="mgp" aria-live="polite"></p><div class="mgtn"><div class="mgd"></div><div class="mgtb"></div></div>';
      D.body.append(bk, sp, cd);
      tourEls = { bk: bk, sp: sp, cd: cd, steps: steps, i: 0 };
      root.hidden = true;
      var re = function () { place(); };
      tourEls.re = re; addEventListener('resize', re); addEventListener('scroll', re, true);
      show(0);
    };
    if (hid()) { go(''); setTimeout(start, 650); } else start();
  }
  function place() {
    if (!tourEls) return;
    var st = tourEls.steps[tourEls.i], el = st.s && q(st.s), sp = tourEls.sp, cd = tourEls.cd, bk = tourEls.bk;
    if (!el || !vis(el)) { sp.style.display = 'none'; bk.classList.add('dim'); cd.className = 'mgtc bot'; return; }
    var r = el.getBoundingClientRect(), p = 6; sp.style.display = ''; bk.classList.remove('dim');
    sp.style.left = (r.left - p) + 'px'; sp.style.top = (r.top - p) + 'px';
    sp.style.width = (r.width + p * 2) + 'px'; sp.style.height = (r.height + p * 2) + 'px';
    cd.className = 'mgtc ' + ((r.top + r.height / 2) > innerHeight * 0.5 ? 'top' : 'bot');
  }
  function show(i) {
    var te = tourEls, st = te.steps[i], n = te.steps.length; te.i = i;
    q('.mgp', te.cd).textContent = st.t;
    q('.mgd', te.cd).innerHTML = te.steps.map(function (_, j) { return '<i' + (j === i ? ' class="on"' : '') + '></i>'; }).join('');
    var tb = q('.mgtb', te.cd); tb.innerHTML = '';
    var mk = function (t, fn, p) { var b = D.createElement('button'); b.type = 'button'; b.className = 'mgc' + (p ? ' p' : ''); b.textContent = t; b.onclick = fn; tb.appendChild(b); return b; };
    if (i === 0) mk('Lewati', function () { endTour(true); });
    else mk('Kembali', function () { show(i - 1); });
    var nx = mk(i === n - 1 ? 'Selesai' : 'Lanjut', function () { if (i === n - 1) endTour(false); else show(i + 1); }, true);
    var el = st.s && q(st.s);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
    place(); setTimeout(place, 120); nx.focus({ preventScroll: true });
  }
  function endTour(skipped) {
    if (!tourEls) return;
    removeEventListener('resize', tourEls.re); removeEventListener('scroll', tourEls.re, true);
    tourEls.bk.remove(); tourEls.sp.remove(); tourEls.cd.remove(); tourEls = null;
    ls.s('mt_guide', '1'); root.hidden = false; onRoute(true);
    if (!skipped) say('Mantap, tur selesai. Mau langsung cari tool?', { acts: [{ t: 'Cari tool', fn: focusSearch }, { t: 'Nanti saja', p: false, fn: close }] });
  }

  /* ---------- Sembunyikan / tampilkan maskot ---------- */
  var isHid = function () { return ls.g('mt_guide_hide') === '1'; };
  var note = null, noteT = 0;
  function dropNote() { clearTimeout(noteT); if (note) { note.remove(); note = null; } }
  function toast(msg, label, fn) {
    dropNote();
    note = D.createElement('div'); note.className = 'mgn'; note.setAttribute('role', 'status');
    var sp = D.createElement('span'); sp.textContent = msg; note.appendChild(sp);
    if (label) { var b = D.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = function () { dropNote(); fn(); }; note.appendChild(b); }
    D.body.appendChild(note); noteT = setTimeout(dropNote, 6000);
  }
  function setHidden(h, tell) {
    ls.s('mt_guide_hide', h ? '1' : '0');
    if (!root) return;
    close(); dropNote();
    if (tourEls) endTour(true);
    onRoute(true);
    if (h && tell) toast('Pemandu disembunyikan. Munculkan lagi lewat Info.', 'Urungkan', function () { setHidden(false); });
    try { D.dispatchEvent(new CustomEvent('mtguide', { detail: { hidden: h } })); } catch (e) {}
  }

  /* ---------- Otomatis: sapaan pertama dan saran tool baru ---------- */
  var HIDE = /^(chat|dev|admin)/;
  function onRoute(silent) {
    if (!root) return;
    var id = hid(); root.hidden = !!tourEls || HIDE.test(id) || isHid();
    if (tourEls) return;
    close();
    var t = tool(id);
    if (silent === true || !t || ls.g('mt_guide_off') === '1' || ls.g('mt_guide') !== '1') return;
    var seen; try { seen = JSON.parse(ls.g('mt_guide_seen') || '[]'); } catch (e) { seen = []; }
    if (!Array.isArray(seen) || seen.indexOf(id) > -1 || seen.length >= 5) return;
    seen.push(id); ls.s('mt_guide_seen', JSON.stringify(seen));
    setTimeout(function () {
      if (hid() !== id || tourEls || !bub.hidden) return;
      say('Pertama kali pakai ' + t.name + '? Ketuk aku kalau butuh panduan singkat.', { auto: 5200, acts: [{ t: 'Cara pakai', fn: function () { toolHelp(t); } }] });
    }, 1100);
  }
  function firstVisit() {
    if (ls.g('mt_guide')) return;
    var tries = 0, wait = setInterval(function () {
      tries++;
      if (!D.getElementById('ld') || tries > 40) {
        clearInterval(wait);
        setTimeout(function () {
          if (tourEls || !bub.hidden || ls.g('mt_guide') || root.hidden) return;
          fab.classList.add('new');
          say('Halo, aku Malik! Mau kupandu keliling sebentar? Cuma sekitar 30 detik.', {
            acts: [{ t: 'Mulai tur', fn: tour }, { t: 'Nanti saja', p: false, fn: function () { ls.s('mt_guide', '1'); close(); } }]
          });
        }, 1800);
      }
    }, 400);
  }

  function boot() {
    if (!D.body) return;
    build();
    addEventListener('hashchange', function () { onRoute(); });
    onRoute(true); firstVisit();
    window.mtGuide = { open: function () { if (isHid()) setHidden(false); menu(); }, tour: function () { if (isHid()) setHidden(false); tour(); }, close: close, hide: function () { setHidden(true); }, show: function () { setHidden(false); }, setHidden: function (h) { setHidden(!!h); }, isHidden: isHid };
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
