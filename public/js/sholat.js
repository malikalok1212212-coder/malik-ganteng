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
  function css() {
    if (document.getElementById('sltcss')) return;
    var s = document.createElement('style'); s.id = 'sltcss';
    s.textContent = '.slt{margin:14px 0}'
      + '.sltc{position:relative;overflow:hidden;background:var(--s2,var(--panel));border:1px solid var(--line,var(--bd));border-radius:18px;padding:18px 16px 16px;color:var(--ink)}'
      + '.sltc::before{content:"";position:absolute;left:16px;top:0;width:34px;height:4px;border-radius:0 0 6px 6px;background:var(--acc)}'
      + '.slth{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:var(--muted)}'
      + '.sltk{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink);background:var(--s3,var(--field));border:1px solid var(--line,var(--bd));border-radius:99px;padding:3px 10px;white-space:nowrap}'
      + '.sltn{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:10px 0 12px}'
      + '.sltn b{font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.02em;font-family:var(--f-ui,inherit)}'
      + '.sltp{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;padding:4px 11px;border-radius:99px;border:1px solid var(--line2,var(--bd))}'
      + '.sltr{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--acc);color:#fff;border-radius:14px;padding:12px 16px;font-size:14px;font-weight:600}'
      + '.sltr b{font-size:28px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.01em}'
      + '.sltm{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0}'
      + '.sltm>*{font-size:12px;line-height:1.2;border:1px solid var(--line2,var(--bd));border-radius:99px;padding:6px 10px;color:var(--muted);background:transparent;white-space:nowrap}'
      + '.slt .sltq{position:relative;display:inline-flex;align-items:center;gap:6px;margin:0!important;color:var(--ink)!important;font-weight:600}'
      + '.slt .sltq select{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;opacity:0!important;pointer-events:auto!important;border:0!important;box-shadow:none!important;background:transparent!important;font-size:16px!important;cursor:pointer}'
      + '.sltq svg{width:12px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}'
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
    var ci = cityIdx(), st = { key: '', target: 0 }, timer = 0;
    host.innerHTML = '<div class="sltc"><div class="slth"><span>Waktu sholat berikutnya</span><span class="sltk"><span data-k>--:--:--</span> WIB</span></div>'
      + '<div class="sltn"><b data-n>-</b><span class="sltp" data-p></span></div>'
      + '<div class="sltr" role="timer"><span>Tinggal</span><b data-r>--:--:--</b></div>'
      + '<div class="sltm"><label class="sltq dd"><span data-cn>' + CITIES[ci][0] + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg><select data-c aria-label="Pilih kota">' + CITIES.map(function (c, i) { return '<option value="' + i + '"' + (i === ci ? ' selected' : '') + '>' + c[0] + '</option>'; }).join('') + '</select></label><span data-d></span><span data-h></span></div>'
      + '<div class="sltg" data-g></div>'
      + '<p class="sltf">Dihitung otomatis untuk kota pilihanmu, acuan Kemenag RI (bisa selisih 1 sampai 2 menit).</p></div>';
    var q = function (a) { return host.querySelector('[data-' + a + ']'); },
      eK = q('k'), eN = q('n'), eP = q('p'), eR = q('r'), eD = q('d'), eH = q('h'), eG = q('g'), eC = q('c'), eCn = q('cn');
    function paint() {
      var n = wib(0), c = CITIES[ci], today = calc(n.y, n.m, n.d, c[1], c[2]), sec = n.h * 3600 + n.i * 60 + n.s, idx = -1, k, tom = false, tmin;
      for (k = 0; k < 6; k++) { if (k === 1) continue; if (today[k] * 60 > sec) { idx = k; break; } }
      if (idx < 0) { var t2 = wib(1); tmin = calc(t2.y, t2.m, t2.d, c[1], c[2])[0]; idx = 0; tom = true; st.target = 86400 + tmin * 60; }
      else { tmin = today[idx]; st.target = tmin * 60; }
      st.key = n.y + '-' + n.m + '-' + n.d + '-' + ci;
      eN.textContent = NAMES[idx]; eP.textContent = (tom ? 'besok ' : '') + hm(tmin);
      eD.textContent = n.d + ' ' + MON[n.m - 1] + ' ' + n.y; var hj = hijri(); eH.textContent = hj; eH.hidden = !hj;
      eG.innerHTML = NAMES.map(function (nm, i) {
        return '<div class="slti' + (i === idx && !tom ? ' on' : (tom && i === 0 ? ' on' : (!tom && i < idx ? ' past' : ''))) + '"><small>' + nm + '</small><b>' + hm(today[i]) + '</b></div>';
      }).join('');
      tick();
    }
    function tick() {
      if (!document.body.contains(host)) { clearInterval(timer); return; }
      var n = wib(0), sec = n.h * 3600 + n.i * 60 + n.s, left = st.target - sec;
      if (st.key !== n.y + '-' + n.m + '-' + n.d + '-' + ci || left <= 0) { paint(); return; }
      eK.textContent = p2(n.h) + ':' + p2(n.i) + ':' + p2(n.s);
      eR.textContent = p2(Math.floor(left / 3600)) + ':' + p2(Math.floor(left % 3600 / 60)) + ':' + p2(left % 60);
    }
    eC.addEventListener('change', function () { ci = +eC.value || 0; eCn.textContent = CITIES[ci][0]; try { localStorage.setItem(KEY, CITIES[ci][0]); } catch (e) { } paint(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    paint(); timer = setInterval(tick, 1000);
  }
  function scan() { var l = document.querySelectorAll('[data-sholat]:not([data-ok])'); for (var i = 0; i < l.length; i++) mount(l[i]); }
  function boot() {
    var m = document.getElementById('main'); if (!m) return;
    scan(); new MutationObserver(scan).observe(m, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
