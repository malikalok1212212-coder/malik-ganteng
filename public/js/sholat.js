/* Waktu sholat + jam real-time WIB di beranda (di bawah "Apa itu Malik Tools?").
   Jadwal dihitung langsung di browser (tanpa API/internet): Subuh 20°, Isya 18°, Ashar mazhab Syafi'i,
   ihtiyath +2 menit (acuan Kemenag RI). Selisih dengan jadwal resmi bisa 1 sampai 2 menit.
   Semua waktu memakai WIB (UTC+7) apa pun zona waktu HP. Tanpa animasi/efek berat.
   Tidak ada const/let tingkat atas (lingkup global dipakai bersama), semua di dalam IIFE. */
(function () {
  'use strict';
  var CITIES = [['Jakarta', -6.2088, 106.8456], ['Bogor', -6.5971, 106.806], ['Bandung', -6.9175, 107.6191], ['Semarang', -6.9667, 110.4167], ['Yogyakarta', -7.7956, 110.3695], ['Surabaya', -7.2575, 112.7521], ['Malang', -7.9666, 112.6326], ['Medan', 3.5952, 98.6722], ['Palembang', -2.9761, 104.7754], ['Padang', -0.9471, 100.4172], ['Pekanbaru', 0.5071, 101.4478], ['Pontianak', -0.0263, 109.3425], ['Bandar Lampung', -5.4292, 105.261], ['Banda Aceh', 5.5483, 95.3238]];
  var NAMES = ['Subuh', 'Terbit', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HMON = ['Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jumadilawal', 'Jumadilakhir', 'Rajab', 'Syakban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah'];
  var TZ = 7, KEY = 'mt_sholat_city';
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function sin(d) { return Math.sin(d * D2R); }
  function cos(d) { return Math.cos(d * D2R); }
  function tan(d) { return Math.tan(d * D2R); }
  function asin(x) { return Math.asin(x) * R2D; }
  function acos(x) { return Math.acos(x) * R2D; }
  function fix(a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }
  function jd(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPos(j) {
    var D = j - 2451545.0, g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360),
      L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360), e = 23.439 - 0.00000036 * D,
      RA = fix(Math.atan2(cos(e) * sin(L), cos(L)) * R2D / 15, 24);
    return { d: asin(sin(e) * sin(L)), eq: q / 15 - RA };
  }
  /* Menit sejak 00:00 WIB untuk [Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya] */
  function calc(y, m, d, lat, lng) {
    var J = jd(y, m, d) - lng / (15 * 24);
    function mid(t) { return fix(12 - sunPos(J + t).eq, 24); }
    function ang(a, t, ccw) {
      var dec = sunPos(J + t).d, v = (-sin(a) - sin(dec) * sin(lat)) / (cos(dec) * cos(lat));
      if (v > 1) v = 1; if (v < -1) v = -1;
      var h = acos(v) / 15;
      return mid(t) + (ccw ? -h : h);
    }
    function asr(t) {
      var dec = sunPos(J + t).d, a = -Math.atan(1 / (1 + tan(Math.abs(lat - dec)))) * R2D;
      return ang(a, t, false);
    }
    var t = { f: 5, r: 6, z: 12, a: 13, m: 18, i: 18 }, k;
    for (k = 0; k < 2; k++) {
      t = { f: ang(20, t.f / 24, true), r: ang(0.833, t.r / 24, true), z: mid(t.z / 24), a: asr(t.a / 24), m: ang(0.833, t.m / 24, false), i: ang(18, t.i / 24, false) };
    }
    var off = TZ - lng / 15, ih = 2;
    return [t.f + off, t.r + off, t.z + off, t.a + off, t.m + off, t.i + off].map(function (h, i) {
      return Math.round(h * 60 + (i === 1 ? -ih : ih));
    });
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { min = ((min % 1440) + 1440) % 1440; return p2(Math.floor(min / 60)) + ':' + p2(min % 60); }
  function wib(offDays) {
    var n = new Date(Date.now() + TZ * 3600000 + (offDays || 0) * 864e5);
    return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate(), h: n.getUTCHours(), i: n.getUTCMinutes(), s: n.getUTCSeconds() };
  }
  function hijri() {
    try {
      var f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jakarta' }), o = {};
      f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      var y = parseInt(o.relatedYear || o.year, 10), mo = parseInt(o.month, 10), d = parseInt(o.day, 10);
      if (!y || !mo || !d || mo > 12) return '';
      return d + ' ' + HMON[mo - 1] + ' ' + y + ' H';
    } catch (e) { return ''; }
  }
  function cityIdx() {
    var v = ''; try { v = localStorage.getItem(KEY) || ''; } catch (e) { }
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i][0] === v) return i;
    return 0;
  }
  function minaret(cx, top, w) {
    var f = '#070b14', g = '#f6d58a';
    return '<polygon points="' + (cx - w * .7) + ',' + (top + 12) + ' ' + (cx + w * .7) + ',' + (top + 12) + ' ' + cx + ',' + top + '" fill="' + f + '"/>'
      + '<rect x="' + (cx - w * .4) + '" y="' + (top + 12) + '" width="' + (w * .8) + '" height="9" fill="' + f + '"/>'
      + '<rect x="' + (cx - w * .95) + '" y="' + (top + 21) + '" width="' + (w * 1.9) + '" height="4" rx="1" fill="' + f + '"/>'
      + '<rect x="' + (cx - w / 2) + '" y="' + (top + 25) + '" width="' + w + '" height="' + (140 - top - 25) + '" fill="' + f + '"/>'
      + '<rect x="' + (cx - 1) + '" y="' + (top + 36) + '" width="2" height="9" rx="1" fill="' + g + '" opacity=".9"/>'
      + '<rect x="' + (cx - 1) + '" y="' + (top + 56) + '" width="2" height="9" rx="1" fill="' + g + '" opacity=".75"/>'
      + '<path d="M' + cx + ' ' + top + 'V' + (top - 7) + '" stroke="' + f + '" stroke-width="1.5"/><circle cx="' + cx + '" cy="' + (top - 8) + '" r="1.8" fill="' + g + '"/>';
  }
  function arch(cx, y0, y1, w) {
    var r = w / 2; return '<path d="M' + (cx - r) + ' ' + y1 + 'V' + y0 + 'a' + r + ' ' + r + ' 0 0 1 ' + w + ' 0V' + y1 + 'Z" class="wn" style="animation-delay:-' + ((cx * 7) % 5) + 's" fill="#f6d58a" opacity=".9"/>';
  }
  var STARS = [[30, 18, 1.2], [70, 34, 1], [118, 16, 1.4], [160, 28, 1], [236, 22, 1.2], [270, 40, 1], [300, 14, 1.3], [380, 46, 1], [52, 62, 1], [18, 50, 1.1], [352, 72, 1], [200, 20, 1.1]];
  var ART = '<svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">'
    + '<defs><linearGradient id="sltsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090f1f"/><stop offset=".62" stop-color="#16233d"/><stop offset="1" stop-color="#2b3452"/></linearGradient>'
    + '<radialGradient id="sltglow" cx=".5" cy="1" r=".62"><stop offset="0" style="stop-color:var(--acc,#e5232e)" stop-opacity=".5"/><stop offset="1" style="stop-color:var(--acc,#e5232e)" stop-opacity="0"/></radialGradient>'
    + '<mask id="sltmoon" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="140"><rect width="400" height="140" fill="#fff"/><circle cx="288" cy="58" r="11.5" fill="#000"/></mask></defs>'
    + '<rect width="400" height="140" fill="url(#sltsky)"/><rect width="400" height="140" fill="url(#sltglow)"/>'
    + STARS.map(function (s) { return '<circle class="tw" style="animation-delay:-' + ((s[0] * 3) % 7 / 2) + 's;animation-duration:' + (2.4 + (s[1] % 4) * .8) + 's" cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="#fff" opacity=".8"/>'; }).join('')
    + '<circle class="mh" cx="282" cy="62" r="24" fill="#f6d58a" opacity=".12"/>'
    + '<path class="ss" d="M262 30L284 20" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0"/>'
    + '<g class="cl1" fill="#fff" opacity=".07"><ellipse cx="60" cy="98" rx="36" ry="5"/><ellipse cx="88" cy="93" rx="22" ry="4"/></g>'
    + '<g class="cl2" fill="#fff" opacity=".06"><ellipse cx="300" cy="104" rx="40" ry="5"/><ellipse cx="270" cy="99" rx="24" ry="4"/></g>'
    + '<circle cx="282" cy="62" r="14" fill="#f6d58a" mask="url(#sltmoon)"/>'
    + '<rect y="124" width="400" height="16" fill="#0d1424"/>'
    + '<path d="M0 124c0-10 22-10 22 0zM378 124c0-10 22-10 22 0z" fill="#0d1424"/>'
    + minaret(36, 74, 8) + minaret(364, 74, 8)
    + minaret(84, 44, 11) + minaret(316, 44, 11)
    + '<g fill="#070b14">'
    + '<rect x="100" y="112" width="42" height="28"/><path d="M100 112C100 92 142 92 142 112Z"/>'
    + '<rect x="258" y="112" width="42" height="28"/><path d="M258 112C258 92 300 92 300 112Z"/>'
    + '<rect x="140" y="92" width="120" height="48"/><rect x="166" y="86" width="68" height="8" rx="2"/>'
    + '<path d="M146 92C146 52 254 52 254 92Z"/><path d="M200 62V46" stroke="#070b14" stroke-width="1.6"/>'
    + '<rect y="134" width="400" height="6"/></g>'
    + '<circle cx="200" cy="43" r="3.2" fill="#f6d58a"/>'
    + arch(176, 110, 132, 10) + arch(200, 106, 132, 12) + arch(224, 110, 132, 10)
    + arch(121, 122, 134, 9) + arch(279, 122, 134, 9)
    + '</svg>';
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function css() {
    if (document.getElementById('sltcss')) return;
    var s = document.createElement('style'); s.id = 'sltcss';
    s.textContent = '.slt{margin:14px 0}'
      + '.sltc{position:relative;background:var(--s2,var(--panel));border:1px solid var(--line,var(--bd));border-radius:18px;padding:18px 16px 16px;color:var(--ink)}'
      + '.sltc::before{content:\"\";position:absolute;left:16px;top:0;width:34px;height:4px;border-radius:0 0 6px 6px;background:var(--acc);z-index:3}'
      + '.sltb{position:relative;height:176px;margin:-18px -16px 0;overflow:hidden;border-radius:17px 17px 0 0;background:#10192b}'
      + '.sltb>svg{display:block;width:100%;height:100%}'
      + '.sltb::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:34px;background:linear-gradient(to bottom,transparent,var(--s2,var(--panel)))}'
      + '.slth{position:absolute;z-index:2;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#e8eefc;text-shadow:0 1px 6px rgba(0,0,0,.75)}'
      + '.sltk{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;background:rgba(8,12,22,.62);border:1px solid rgba(255,255,255,.2);border-radius:99px;padding:3px 10px;white-space:nowrap;text-shadow:none}'
      + '.sltn{position:relative;z-index:1;display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:-8px 0 12px}'
      + '.sltn b{font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.02em;font-family:var(--f-ui,inherit)}'
      + '.sltp{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;padding:4px 11px;border-radius:99px;border:1px solid var(--line2,var(--bd));background:var(--s2,var(--panel))}'
      + '.sltr{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--acc);color:#fff;border-radius:14px;padding:12px 16px;font-size:14px;font-weight:600}'
      + '.sltr b{font-size:28px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.01em}'
      + '.sltm{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0}'
      + '.sltm>span,.sltq{font-size:12px;line-height:1.2;border:1px solid var(--line2,var(--bd));border-radius:99px;padding:6px 10px;color:var(--muted);background:transparent;white-space:nowrap}'
      + '.sltd{position:relative}'
      + '.sltq{display:inline-flex;align-items:center;gap:6px;color:var(--ink);font-weight:600;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:border-color .15s,background .15s}'
      + '.sltq:focus-visible{outline:2px solid var(--acc);outline-offset:2px}'
      + '.sltd.open .sltq{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent)}'
      + '.sltq svg{width:13px;height:13px;flex:none;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}'
      + '.sltq .chev{width:12px;height:12px;transition:transform .15s}'
      + '.sltd.open .chev{transform:rotate(180deg)}'
      + '.sltl{display:none;position:absolute;z-index:30;top:calc(100% + 8px);left:0;min-width:210px;max-height:252px;overflow-y:auto;overscroll-behavior:contain;padding:6px;background:var(--s2,var(--panel));border:1px solid var(--line2,var(--bd));border-radius:16px;box-shadow:0 18px 40px -10px rgba(0,0,0,.55);scrollbar-width:thin}'
      + '.sltd.up .sltl{top:auto;bottom:calc(100% + 8px)}'
      + '.sltd.open .sltl{display:block;animation:sltin .14s ease-out}'
      + '@keyframes sltin{from{opacity:0;transform:translateY(-4px)}}'
      + '.slto{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:11px;font-size:14px;font-weight:600;color:var(--ink);cursor:pointer;-webkit-tap-highlight-color:transparent}'
      + '.slto svg{width:15px;height:15px;flex:none;fill:none;stroke:var(--acc);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0}'
      + '.slto.on{background:color-mix(in srgb,var(--acc) 14%,transparent)}'
      + '.slto.on svg{opacity:1}'
      + '.slto.act{background:color-mix(in srgb,var(--ink) 9%,transparent)}'
      + '.slto.on.act{background:color-mix(in srgb,var(--acc) 22%,transparent)}'
      + '.sltb svg *{transform-box:fill-box}'
      + '.sltb .tw{animation:sltw 3s ease-in-out infinite}'
      + '.sltb .wn{animation:sltwn 4s ease-in-out infinite}'
      + '.sltb .mh{transform-origin:center;animation:sltmh 5s ease-in-out infinite}'
      + '.sltb .cl1{animation:sltdr 46s linear infinite alternate}'
      + '.sltb .cl2{animation:sltdr 58s linear -20s infinite alternate-reverse}'
      + '.sltb .ss{animation:sltss 9s ease-in 2s infinite}'
      + '@keyframes sltw{0%,100%{opacity:.85}50%{opacity:.15}}'
      + '@keyframes sltwn{0%,100%{opacity:.95}50%{opacity:.62}}'
      + '@keyframes sltmh{0%,100%{transform:scale(1);opacity:.12}50%{transform:scale(1.18);opacity:.22}}'
      + '@keyframes sltdr{from{transform:translateX(-50px)}to{transform:translateX(90px)}}'
      + '@keyframes sltss{0%,86%{opacity:0;transform:translate(0,0)}88%{opacity:.95}100%{opacity:0;transform:translate(-70px,32px)}}'
      + '.slt.sltz .sltb svg *{animation-play-state:paused!important}'
      + '@media (prefers-reduced-motion:reduce){.sltb .cl1,.sltb .cl2,.sltb .ss{animation:none!important}.sltb .tw{animation-duration:5s}.sltb .wn{animation-duration:7s}.sltb .mh{animation-duration:8s}}'
      + '.sltg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'
      + '.slti{border:1px solid var(--line,var(--bd));border-radius:12px;padding:9px 10px;background:var(--s1,var(--field));min-width:0}'
      + '.slti small{display:block;font-size:12px;color:var(--muted);margin-bottom:2px}'
      + '.slti b{font-size:18px;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums}'
      + '.slti.on{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,var(--s1,var(--field)))}'
      + '.slti.past{opacity:.55}'
      + '.sltf{margin:10px 0 0;font-size:11.5px;line-height:1.4;color:var(--muted)}';
    document.head.appendChild(s);
  }
  function mount(host) {
    if (host.getAttribute('data-ok')) return;
    host.setAttribute('data-ok', '1'); css();
    var ci = cityIdx(), st = { key: '', target: 0 }, timer = 0, isOpen = false, act = 0;
    host.innerHTML = '<div class=\"sltc\"><div class=\"sltb\">' + ART + '<div class=\"slth\"><span>Waktu sholat berikutnya</span><span class=\"sltk\"><span data-k>--:--:--</span> WIB</span></div></div>'
      + '<div class=\"sltn\"><b data-n>-</b><span class=\"sltp\" data-p></span></div>'
      + '<div class=\"sltr\" role=\"timer\"><span>Tinggal</span><b data-r>--:--:--</b></div>'
      + '<div class=\"sltm\"><div class=\"sltd\" data-dd><div class=\"sltq\" data-t role=\"button\" tabindex=\"0\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-label=\"Pilih kota\">' + PIN + '<span data-cn></span>' + CHEV + '</div><div class=\"sltl\" data-l role=\"listbox\" aria-label=\"Pilih kota\"></div></div><span data-d></span><span data-h></span></div>'
      + '<div class=\"sltg\" data-g></div>'
      + '<p class=\"sltf\">Dihitung otomatis untuk kota pilihanmu, acuan Kemenag RI (bisa selisih 1 sampai 2 menit).</p></div>';
    var q = function (a) { return host.querySelector('[data-' + a + ']'); },
      eK = q('k'), eN = q('n'), eP = q('p'), eR = q('r'), eD = q('d'), eH = q('h'), eG = q('g'), eT = q('t'), eL = q('l'), eDd = q('dd'), eCn = q('cn');
    function renderList() {
      eCn.textContent = CITIES[ci][0];
      eL.innerHTML = CITIES.map(function (c, i) {
        return '<div class=\"slto' + (i === ci ? ' on' : '') + '\" role=\"option\" data-i=\"' + i + '\" aria-selected=\"' + (i === ci) + '\"><span>' + c[0] + '</span>' + CHECK + '</div>';
      }).join('');
    }
    function mark() {
      var o = eL.children, i;
      for (i = 0; i < o.length; i++) o[i].classList.toggle('act', i === act);
      if (o[act]) { var t = o[act].offsetTop, h = o[act].offsetHeight; if (t < eL.scrollTop) eL.scrollTop = t - 6; else if (t + h > eL.scrollTop + eL.clientHeight) eL.scrollTop = t + h - eL.clientHeight + 6; }
    }
    function setOpen(v) {
      isOpen = v; eT.setAttribute('aria-expanded', v ? 'true' : 'false'); eDd.classList.toggle('open', v);
      if (!v) return;
      var r = eT.getBoundingClientRect(), room = window.innerHeight - r.bottom;
      eDd.classList.toggle('up', room < 270 && r.top > room);
      act = ci; var o = eL.children[ci]; if (o) eL.scrollTop = Math.max(0, o.offsetTop - eL.clientHeight / 2 + o.offsetHeight / 2); mark();
    }
    function pick(i) {
      ci = i; try { localStorage.setItem(KEY, CITIES[ci][0]); } catch (e) { }
      renderList(); setOpen(false); paint();
    }
    function paint() {
      var n = wib(0), c = CITIES[ci], today = calc(n.y, n.m, n.d, c[1], c[2]), sec = n.h * 3600 + n.i * 60 + n.s, idx = -1, k, tom = false, tmin;
      for (k = 0; k < 6; k++) { if (k === 1) continue; if (today[k] * 60 > sec) { idx = k; break; } }
      if (idx < 0) { var t2 = wib(1); tmin = calc(t2.y, t2.m, t2.d, c[1], c[2])[0]; idx = 0; tom = true; st.target = 86400 + tmin * 60; }
      else { tmin = today[idx]; st.target = tmin * 60; }
      st.key = n.y + '-' + n.m + '-' + n.d + '-' + ci;
      eN.textContent = NAMES[idx]; eP.textContent = (tom ? 'besok ' : '') + hm(tmin);
      eD.textContent = n.d + ' ' + MON[n.m - 1] + ' ' + n.y; var hj = hijri(); eH.textContent = hj; eH.hidden = !hj;
      eG.innerHTML = NAMES.map(function (nm, i) {
        return '<div class=\"slti' + (i === idx && !tom ? ' on' : (tom && i === 0 ? ' on' : (!tom && i < idx ? ' past' : ''))) + '\"><small>' + nm + '</small><b>' + hm(today[i]) + '</b></div>';
      }).join('');
      tick();
    }
    function tick() {
      if (!document.body.contains(host)) { clearInterval(timer); document.removeEventListener('click', away); return; }
      var n = wib(0), sec = n.h * 3600 + n.i * 60 + n.s, left = st.target - sec;
      if (st.key !== n.y + '-' + n.m + '-' + n.d + '-' + ci || left <= 0) { paint(); return; }
      eK.textContent = p2(n.h) + ':' + p2(n.i) + ':' + p2(n.s);
      eR.textContent = p2(Math.floor(left / 3600)) + ':' + p2(Math.floor(left % 3600 / 60)) + ':' + p2(left % 60);
    }
    function away(e) { if (isOpen && !eDd.contains(e.target)) setOpen(false); }
    eT.addEventListener('click', function () { setOpen(!isOpen); });
    eT.addEventListener('keydown', function (e) {
      var k = e.key, len = CITIES.length;
      if (k === 'Escape') { if (isOpen) { e.preventDefault(); setOpen(false); } return; }
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); if (!isOpen) { setOpen(true); return; } act = (act + (k === 'ArrowDown' ? 1 : len - 1)) % len; mark(); return; }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); if (isOpen) pick(act); else setOpen(true); }
    });
    eL.addEventListener('click', function (e) {
      var o = e.target.closest ? e.target.closest('.slto') : null;
      if (o) { pick(+o.getAttribute('data-i') || 0); eT.focus(); }
    });
    document.addEventListener('click', away);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) setOpen(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { host.classList.toggle('sltz', !en[0].isIntersecting); }).observe(host);
    renderList(); paint(); timer = setInterval(tick, 1000);
  }
  function scan() { var l = document.querySelectorAll('[data-sholat]:not([data-ok])'); for (var i = 0; i < l.length; i++) mount(l[i]); }
  function boot() {
    var m = document.getElementById('main'); if (!m) return;
    scan(); new MutationObserver(scan).observe(m, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
