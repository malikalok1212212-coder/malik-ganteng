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
    var g = '#f6d58a';
    return '<polygon class="mf" points="' + (cx - w * .7) + ',' + (top + 12) + ' ' + (cx + w * .7) + ',' + (top + 12) + ' ' + cx + ',' + top + '"/>'
      + '<rect class="mf" x="' + (cx - w * .4) + '" y="' + (top + 12) + '" width="' + (w * .8) + '" height="9"/>'
      + '<rect class="mf" x="' + (cx - w * .95) + '" y="' + (top + 21) + '" width="' + (w * 1.9) + '" height="4" rx="1"/>'
      + '<rect class="mf" x="' + (cx - w / 2) + '" y="' + (top + 25) + '" width="' + w + '" height="' + (140 - top - 25) + '"/>'
      + '<rect x="' + (cx - 1) + '" y="' + (top + 36) + '" width="2" height="9" rx="1" fill="' + g + '" style="opacity:var(--wo)"/>'
      + '<rect x="' + (cx - 1) + '" y="' + (top + 56) + '" width="2" height="9" rx="1" fill="' + g + '" style="opacity:var(--wo)"/>'
      + '<path class="mfs" d="M' + cx + ' ' + top + 'V' + (top - 7) + '" stroke-width="1.5" fill="none"/><circle cx="' + cx + '" cy="' + (top - 8) + '" r="1.8" fill="' + g + '"/>';
  }
  function arch(cx, y0, y1, w) {
    var r = w / 2; return '<path d="M' + (cx - r) + ' ' + y1 + 'V' + y0 + 'a' + r + ' ' + r + ' 0 0 1 ' + w + ' 0V' + y1 + 'Z" class="wn" style="animation-delay:-' + ((cx * 7) % 5) + 's" fill="#f6d58a" opacity=".9"/>';
  }
  var STARS = [[30, 18, 1.2], [70, 34, 1], [118, 16, 1.4], [160, 28, 1], [236, 22, 1.2], [270, 40, 1], [300, 14, 1.3], [380, 46, 1], [52, 62, 1], [18, 50, 1.1], [352, 72, 1], [200, 20, 1.1]];
  var ART = '<svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">'
    + '<defs><linearGradient id="sltsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--k1)"/><stop offset=".62" style="stop-color:var(--k2)"/><stop offset="1" style="stop-color:var(--k3)"/></linearGradient>'
    + '<radialGradient id="sltglow" cx=".5" cy="1" r=".62"><stop offset="0" style="stop-color:var(--acc,#e5232e)" stop-opacity=".5"/><stop offset="1" style="stop-color:var(--acc,#e5232e)" stop-opacity="0"/></radialGradient>'
    + '<mask id="sltmoon" maskUnits="userSpaceOnUse" x="-30" y="-30" width="60" height="60"><rect x="-30" y="-30" width="60" height="60" fill="#fff"/><circle cx="6" cy="-4" r="11.5" fill="#000"/></mask></defs>'
    + '<rect width="400" height="140" fill="url(#sltsky)"/><rect class="gl" width="400" height="140" fill="url(#sltglow)"/>'
    + '<g class="strs">' + STARS.map(function (s) { return '<circle class="tw" style="animation-delay:-' + ((s[0] * 3) % 7 / 2) + 's;animation-duration:' + (2.4 + (s[1] % 4) * .8) + 's" cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="#fff" opacity=".8"/>'; }).join('')
    + '<path class="ss" d="M262 30L284 20" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0"/></g>'
    + '<g class="bdy"><g class="moon"><circle class="mh" r="20" fill="#f6d58a" opacity=".07"/><circle r="14" fill="#f6d58a" mask="url(#sltmoon)"/></g>'
    + '<g class="sun"><circle r="22" style="fill:var(--bc)" opacity=".13"/><circle r="13" style="fill:var(--bc)"/></g></g>'
    + '<g class="cl1" fill="#fff"><ellipse cx="60" cy="98" rx="36" ry="5"/><ellipse cx="88" cy="93" rx="22" ry="4"/></g>'
    + '<g class="cl2" fill="#fff"><ellipse cx="300" cy="104" rx="40" ry="5"/><ellipse cx="270" cy="99" rx="24" ry="4"/></g>'
    + '<rect class="mf" y="124" width="400" height="16" opacity=".85"/>'
    + '<path class="mf" d="M0 124c0-10 22-10 22 0zM378 124c0-10 22-10 22 0z" opacity=".85"/>'
    + minaret(36, 74, 8) + minaret(364, 74, 8)
    + minaret(84, 44, 11) + minaret(316, 44, 11)
    + '<rect class="mf" x="100" y="112" width="42" height="28"/><path class="mf" d="M100 112C100 92 142 92 142 112Z"/>'
    + '<rect class="mf" x="258" y="112" width="42" height="28"/><path class="mf" d="M258 112C258 92 300 92 300 112Z"/>'
    + '<rect class="mf" x="140" y="92" width="120" height="48"/><rect class="mf" x="166" y="86" width="68" height="8" rx="2"/>'
    + '<path class="mf" d="M146 92C146 52 254 52 254 92Z"/><path class="mfs" d="M200 62V46" stroke-width="1.6" fill="none"/>'
    + '<rect class="mf" y="134" width="400" height="6"/>'
    + '<circle cx="200" cy="43" r="3.2" fill="#f6d58a"/>'
    + '<g style="opacity:var(--wo)">' + arch(176, 110, 132, 10) + arch(200, 106, 132, 12) + arch(224, 110, 132, 10) + arch(121, 122, 134, 9) + arch(279, 122, 134, 9) + '</g>'
    + '</svg>';
  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICONS = [
    '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 6v3M5.6 10.6l1.8 1.8M18.4 10.6l-1.8 1.8"/>',
    '<path d="M4 18h16M8 18a4 4 0 0 1 8 0M12 5v6M9.5 7.5L12 5l2.5 2.5"/>',
    '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    '<circle cx="12" cy="10" r="3.5"/><path d="M12 3v1.5M4.5 10H6M18 10h1.5M6.7 4.7l1 1M17.3 4.7l-1 1M5 19h14"/>',
    '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M9.5 6.5L12 9l2.5-2.5"/>',
    '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'];
  function modeOf(sec, t) {
    var m = sec / 60;
    return m < t[0] ? 'night' : m < t[1] ? 'dawn' : m < (t[1] + t[2]) / 2 ? 'morn' : m < t[3] ? 'day' : m < t[4] ? 'aft' : m < t[5] ? 'dusk' : 'night';
  }
  function css() {
    if (document.getElementById('sltcss')) return;
    var s = document.createElement('style'); s.id = 'sltcss';
    s.textContent = '.slt{margin:14px 0}'
      + '.sltc{position:relative;background:var(--s2,var(--panel));border:1px solid var(--line,var(--bd));border-radius:22px;padding:18px 16px 16px;color:var(--ink)}'
      + '.sltc::before{content:\"\";position:absolute;left:16px;top:0;width:34px;height:4px;border-radius:0 0 6px 6px;background:var(--acc);z-index:3}'
      + '.sltb{--k1:#090f1f;--k2:#16233d;--k3:#2b3452;--mf:#070b14;--co:.07;--so:1;--wo:1;--mo:1;--su:0;--bx:282px;--by:62px;--bc:#f6d58a;--go:.5;position:relative;height:176px;margin:-18px -16px 0;overflow:hidden;border-radius:21px 21px 0 0;background:var(--k1)}'
      + '.sltb[data-m=dawn]{--k1:#1a2547;--k2:#5d5388;--k3:#f0a27e;--mf:#0b1020;--co:.14;--so:.35;--wo:.8;--mo:0;--su:.95;--bx:318px;--by:104px;--bc:#ffd9a0;--go:.6}'
      + '.sltb[data-m=morn]{--k1:#3a86d6;--k2:#86c3ee;--k3:#fbe6b8;--mf:#10213d;--co:.5;--so:0;--wo:0;--mo:0;--su:1;--bx:296px;--by:70px;--bc:#fff3c4;--go:.15}'
      + '.sltb[data-m=day]{--k1:#1c68c9;--k2:#4fa0e6;--k3:#b4def6;--mf:#0e2140;--co:.6;--so:0;--wo:0;--mo:0;--su:1;--bx:240px;--by:52px;--bc:#fff6c8;--go:.1}'
      + '.sltb[data-m=aft]{--k1:#2f63ad;--k2:#e8a766;--k3:#f8d79a;--mf:#1a1f38;--co:.38;--so:0;--wo:.15;--mo:0;--su:1;--bx:296px;--by:78px;--bc:#ffe2a3;--go:.35}'
      + '.sltb[data-m=dusk]{--k1:#171a4a;--k2:#7b3f7e;--k3:#f0805c;--mf:#090b18;--co:.1;--so:.55;--wo:1;--mo:.85;--su:0;--bx:282px;--by:62px;--bc:#f6d58a;--go:.5}'
      + '.sltb>svg{display:block;width:100%;height:100%}'
      + '.sltb .mf{fill:var(--mf)}.sltb .mfs{stroke:var(--mf)}'
      + '.sltb .gl{opacity:var(--go)}.sltb .strs{opacity:var(--so)}.sltb .cl1,.sltb .cl2{opacity:var(--co)}'
      + '.sltb .bdy{transform:translate(var(--bx),var(--by))}.sltb .moon{opacity:var(--mo)}.sltb .sun{opacity:var(--su)}'
      + '.sltb::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:34px;background:linear-gradient(to bottom,transparent,var(--s2,var(--panel)))}'
      + '.slth{position:absolute;z-index:2;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6)}'
      + '.sltk{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:#fff;background:rgba(8,12,22,.55);border:1px solid rgba(255,255,255,.22);border-radius:99px;padding:3px 10px;white-space:nowrap;text-shadow:none;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}'
      + '.sltn{position:relative;z-index:1;display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:-8px 0 14px}'
      + '.sltn b{font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.02em;font-family:var(--f-ui,inherit)}'
      + '.sltp{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;padding:4px 11px;border-radius:99px;border:1px solid var(--line2,var(--bd));background:var(--s2,var(--panel))}'
      + '.sltr{border-radius:18px;padding:12px 12px 14px;color:#fff;background:linear-gradient(135deg,var(--acc),color-mix(in srgb,var(--acc) 62%,#000))}'
      + '.sltrl{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.9;margin:0 2px 8px}'
      + '.sltdg{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:4px}'
      + '.sltdg>div{background:rgba(255,255,255,.16);border-radius:13px;padding:8px 4px 6px;text-align:center}'
      + '.sltdg b{display:block;font-size:30px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.01em}'
      + '.sltdg small{display:block;margin-top:4px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.8}'
      + '.sltdg em{font-style:normal;font-size:22px;font-weight:800;opacity:.7;margin-top:-10px}'
      + '.sltpb{display:block;height:5px;border-radius:99px;background:rgba(255,255,255,.28);margin-top:12px;overflow:hidden}'
      + '.sltpb s{display:block;height:100%;width:0;border-radius:99px;background:#fff;text-decoration:none;transition:width .9s linear}'
      + '.sltm{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:14px 0 12px}'
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
      + '@keyframes sltmh{0%,100%{transform:scale(1);opacity:.06}50%{transform:scale(1.2);opacity:.13}}'
      + '@keyframes sltdr{from{transform:translateX(-50px)}to{transform:translateX(90px)}}'
      + '@keyframes sltss{0%,86%{opacity:0;transform:translate(0,0)}88%{opacity:.95}100%{opacity:0;transform:translate(-70px,32px)}}'
      + '.slt.sltz .sltb svg *{animation-play-state:paused!important}'
      + '@media (prefers-reduced-motion:reduce){.sltb .cl1,.sltb .cl2,.sltb .ss{animation:none!important}.sltb .tw{animation-duration:5s}.sltb .wn{animation-duration:7s}.sltb .mh{animation-duration:8s}.sltpb s{transition:none}}'
      + '.sltg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'
      + '.slti{border:1px solid var(--line,var(--bd));border-radius:14px;padding:9px 10px 10px;background:var(--s1,var(--field));min-width:0}'
      + '.sltit{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:3px}'
      + '.slti small{font-size:12px;color:var(--muted)}'
      + '.slti svg{width:17px;height:17px;flex:none;fill:none;stroke:var(--muted);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'
      + '.slti b{display:block;font-size:19px;line-height:1.2;font-weight:800;font-variant-numeric:tabular-nums}'
      + '.slti.on{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,var(--s1,var(--field)));box-shadow:0 0 0 1px color-mix(in srgb,var(--acc) 40%,transparent)}'
      + '.slti.on svg{stroke:var(--acc)}.slti.on small{color:var(--ink)}'
      + '.slti.past{opacity:.5}'
      + '.sltf{margin:10px 0 0;font-size:11.5px;line-height:1.4;color:var(--muted)}';
    document.head.appendChild(s);
  }
  function mount(host) {
    if (host.getAttribute('data-ok')) return;
    host.setAttribute('data-ok', '1'); css();
    var ci = cityIdx(), st = { key: '', target: 0, prev: 0 }, timer = 0, isOpen = false, act = 0, cur = [0, 0, 0, 0, 0, 0], curMode = '';
    host.innerHTML = '<div class=\"sltc\"><div class=\"sltb\" data-m=\"night\">' + ART + '<div class=\"slth\"><span>Waktu sholat berikutnya</span><span class=\"sltk\"><span data-k>--:--:--</span> WIB</span></div></div>'
      + '<div class=\"sltn\"><b data-n>-</b><span class=\"sltp\" data-p></span></div>'
      + '<div class=\"sltr\" role=\"timer\"><div class=\"sltrl\"><span>Tinggal</span></div><div class=\"sltdg\"><div><b data-rh>--</b><small>jam</small></div><em>:</em><div><b data-rm>--</b><small>menit</small></div><em>:</em><div><b data-rs>--</b><small>detik</small></div></div><i class=\"sltpb\"><s data-pb></s></i></div>'
      + '<div class=\"sltm\"><div class=\"sltd\" data-dd><div class=\"sltq\" data-t role=\"button\" tabindex=\"0\" aria-haspopup=\"listbox\" aria-expanded=\"false\" aria-label=\"Pilih kota\">' + PIN + '<span data-cn></span>' + CHEV + '</div><div class=\"sltl\" data-l role=\"listbox\" aria-label=\"Pilih kota\"></div></div><span data-d></span><span data-h></span></div>'
      + '<div class=\"sltg\" data-g></div>'
      + '<p class=\"sltf\">Dihitung otomatis untuk kota pilihanmu, acuan Kemenag RI (bisa selisih 1 sampai 2 menit).</p></div>';
    var q = function (a) { return host.querySelector('[data-' + a + ']'); },
      eK = q('k'), eN = q('n'), eP = q('p'), eRh = q('rh'), eRm = q('rm'), eRs = q('rs'), ePb = q('pb'), eD = q('d'), eH = q('h'), eG = q('g'), eT = q('t'), eL = q('l'), eDd = q('dd'), eCn = q('cn'), eB = host.querySelector('.sltb');
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
      var n = wib(0), c = CITIES[ci], today = calc(n.y, n.m, n.d, c[1], c[2]), sec = n.h * 3600 + n.i * 60 + n.s, idx = -1, k, tom = false, tmin, seq = [0, 2, 3, 4, 5];
      cur = today;
      for (k = 0; k < 6; k++) { if (k === 1) continue; if (today[k] * 60 > sec) { idx = k; break; } }
      if (idx < 0) { var t2 = wib(1); tmin = calc(t2.y, t2.m, t2.d, c[1], c[2])[0]; idx = 0; tom = true; st.target = 86400 + tmin * 60; st.prev = today[5] * 60; }
      else { tmin = today[idx]; st.target = tmin * 60; st.prev = idx === 0 ? (today[5] - 1440) * 60 : today[seq[seq.indexOf(idx) - 1]] * 60; }
      st.key = n.y + '-' + n.m + '-' + n.d + '-' + ci;
      eN.textContent = NAMES[idx]; eP.textContent = (tom ? 'besok ' : '') + hm(tmin);
      eD.textContent = n.d + ' ' + MON[n.m - 1] + ' ' + n.y; var hj = hijri(); eH.textContent = hj; eH.hidden = !hj;
      eG.innerHTML = NAMES.map(function (nm, i) {
        return '<div class=\"slti' + (i === idx && !tom ? ' on' : (tom && i === 0 ? ' on' : (!tom && i < idx ? ' past' : ''))) + '\"><div class=\"sltit\"><small>' + nm + '</small><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">' + ICONS[i] + '</svg></div><b>' + hm(today[i]) + '</b></div>';
      }).join('');
      tick();
    }
    function tick() {
      if (!document.body.contains(host)) { clearInterval(timer); document.removeEventListener('click', away); return; }
      var n = wib(0), sec = n.h * 3600 + n.i * 60 + n.s, left = st.target - sec;
      if (st.key !== n.y + '-' + n.m + '-' + n.d + '-' + ci || left <= 0) { paint(); return; }
      var m = modeOf(sec, cur); if (m !== curMode) { curMode = m; eB.setAttribute('data-m', m); }
      var span = st.target - st.prev, pct = span > 0 ? Math.max(0, Math.min(1, 1 - left / span)) : 0;
      eK.textContent = p2(n.h) + ':' + p2(n.i) + ':' + p2(n.s);
      eRh.textContent = p2(Math.floor(left / 3600)); eRm.textContent = p2(Math.floor(left % 3600 / 60)); eRs.textContent = p2(left % 60);
      ePb.style.width = (pct * 100).toFixed(1) + '%';
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
