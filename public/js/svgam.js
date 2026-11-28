/* SVGAM: konversi SVG ke XML Alight Motion. Jalan penuh di browser, tanpa dependensi.
   Struktur XML mengikuti contoh asli (malik-logo.xml): scene > embedScene > scene > shape/embedScene, path hanya M/L/Z.
   Dipakai tool "SVG ke XML Alight Motion" (public/js/tools.js). Diuji di tests/svgam.test.js. */
(function (G) {
'use strict';

const OVERLAP = 1;            // px tumpang tindih antar bidang agar tidak ada garis celah (sama seperti contoh)
const AM = { amver: '1028425', ffver: '106', am: 'com.alightcreative.motion/5.0.273.1028425', amplatform: 'android' };

/* ---------- angka ---------- */
const r4 = (v) => { const r = Math.round(v * 10000) / 10000; return r === 0 ? 0 : r; };
const num = (v) => String(r4(v));

/* ---------- parser XML ringan (toleran, tanpa DOMParser supaya hasilnya sama di mana saja) ---------- */
function decodeEnt(s) {
  return s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === '#') {
      const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(c); } catch (_) { return m; }
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
  });
}
const stripNs = (n) => { const k = n.indexOf(':'); return k < 0 ? n : n.slice(k + 1); };

function parseXML(src) {
  src = String(src).replace(/^\uFEFF/, '');
  const n = src.length, root = { t: '#root', a: {}, c: [], x: '', p: null };
  let top = root, i = 0;
  const attrRe = /\s*([^\s=\/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  while (i < n) {
    if (src.charCodeAt(i) !== 60) {
      const j = src.indexOf('<', i), e = j < 0 ? n : j;
      top.x += decodeEnt(src.slice(i, e)); i = e; continue;
    }
    if (src.startsWith('<!--', i)) { const j = src.indexOf('-->', i + 4); i = j < 0 ? n : j + 3; continue; }
    if (src.startsWith('<![CDATA[', i)) { const j = src.indexOf(']]>', i + 9); top.x += src.slice(i + 9, j < 0 ? n : j); i = j < 0 ? n : j + 3; continue; }
    if (src.startsWith('<?', i)) { const j = src.indexOf('?>', i + 2); i = j < 0 ? n : j + 2; continue; }
    if (src.startsWith('<!', i)) {
      let depth = 0, j = i + 2;
      while (j < n) {
        const ch = src[j];
        if (ch === '[') depth++; else if (ch === ']') depth--;
        else if (ch === '"' || ch === "'") { const q = src.indexOf(ch, j + 1); j = q < 0 ? n : q; }
        else if (ch === '>' && depth <= 0) break;
        j++;
      }
      i = j + 1; continue;
    }
    if (src[i + 1] === '/') {
      const j = src.indexOf('>', i), nm = stripNs(src.slice(i + 2, j < 0 ? n : j).trim());
      let k = top; while (k && k.t !== nm) k = k.p;
      if (k && k.p) top = k.p;
      i = j < 0 ? n : j + 1; continue;
    }
    const m = /^<([^\s\/>]+)/.exec(src.slice(i, i + 200));
    if (!m) { i++; continue; }
    const el = { t: stripNs(m[1]), a: {}, c: [], x: '', p: top };
    i += m[0].length;
    for (;;) {
      attrRe.lastIndex = i;
      const am = attrRe.exec(src);
      if (!am) break;
      i = attrRe.lastIndex;
      const nm = am[1];
      if (nm === 'xmlns' || nm.startsWith('xmlns:')) continue;
      const key = nm.indexOf(':') >= 0 ? (/^(xlink|svg):/.test(nm) ? stripNs(nm) : null) : nm;
      if (key) el.a[key] = decodeEnt(am[2] !== undefined ? am[2] : am[3]);
    }
    while (i < n && /\s/.test(src[i])) i++;
    let selfClose = false;
    if (src[i] === '/') { selfClose = true; i++; }
    while (i < n && src[i] !== '>') i++;
    i++;
    top.c.push(el);
    if (!selfClose) top = el;
  }
  return root;
}

/* ---------- warna ---------- */
const NAMED = {};
('aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,grey:808080,green:008000,greenyellow:adff2f,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32')
  .split(',').forEach((e) => { const k = e.split(':'); NAMED[k[0]] = k[1]; });

function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
/* hasil: {r,g,b,a(0..1)} | null (tidak dikenal) */
function parseColor(str, cur) {
  let s = String(str).trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s === 'currentcolor') return cur ? parseColor(cur, null) : { r: 0, g: 0, b: 0, a: 1 };
  if (NAMED[s]) s = '#' + NAMED[s];
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length === 6) h += 'ff';
    if (h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
  }
  if ((m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s))) {
    const parts = m[2].split(/[\s,\/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const pct = (v, mx) => (/%$/.test(v) ? parseFloat(v) / 100 * mx : parseFloat(v));
    let a = parts[3] !== undefined ? pct(parts[3], 1) : 1;
    if (!(a >= 0)) a = 1;
    let rgb;
    if (m[1][0] === 'r') rgb = [pct(parts[0], 255), pct(parts[1], 255), pct(parts[2], 255)];
    else rgb = hsl2rgb(parseFloat(parts[0]), Math.min(1, Math.max(0, parseFloat(parts[1]) / 100)), Math.min(1, Math.max(0, parseFloat(parts[2]) / 100)));
    if (rgb.some((v) => !(v === v))) return null;
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return { r: cl(rgb[0]), g: cl(rgb[1]), b: cl(rgb[2]), a: Math.max(0, Math.min(1, a)) };
  }
  return null;
}
const hex2 = (v) => (v < 16 ? '0' : '') + v.toString(16);
const ch8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const argb = (c, op) => '#' + hex2(ch8(c.a * op * 255)) + hex2(ch8(c.r)) + hex2(ch8(c.g)) + hex2(ch8(c.b));

/* ---------- matriks [a,b,c,d,e,f] ---------- */
const IDM = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function parseTransform(str) {
  let M = IDM;
  if (!str) return M;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(str))) {
    const v = m[2].split(/[\s,]+/).filter((x) => x !== '').map(parseFloat);
    if (v.some((x) => !(x === x))) continue;
    let T = null;
    switch (m[1]) {
      case 'matrix': if (v.length === 6) T = v; break;
      case 'translate': T = [1, 0, 0, 1, v[0] || 0, v[1] || 0]; break;
      case 'scale': T = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]; break;
      case 'rotate': {
        const a = (v[0] || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        T = [c, s, -s, c, 0, 0];
        if (v.length >= 3) T = mul(mul([1, 0, 0, 1, v[1], v[2]], T), [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case 'skewX': T = [1, 0, Math.tan((v[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
      case 'skewY': T = [1, Math.tan((v[0] || 0) * Math.PI / 180), 0, 1, 0, 0]; break;
    }
    if (T) M = mul(M, T);
  }
  return M;
}

/* ---------- path: d -> subpath (semua kurva jadi kubik) ---------- */
function arcToCubics(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) return [['L', x2, y2]];
  const phi = phiDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
  const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI; else if (fs && dth < 0) dth += 2 * Math.PI;
  const nseg = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9)), dl = dth / nseg, t = 4 / 3 * Math.tan(dl / 4);
  const mp = (ux, uy) => [cp * rx * ux - sp * ry * uy + cx, sp * rx * ux + cp * ry * uy + cy];
  const out = [];
  for (let k = 0; k < nseg; k++) {
    const a = th1 + k * dl, b = a + dl;
    const c1 = mp(Math.cos(a) - t * Math.sin(a), Math.sin(a) + t * Math.cos(a));
    const c2 = mp(Math.cos(b) + t * Math.sin(b), Math.sin(b) - t * Math.cos(b));
    const e = k === nseg - 1 ? [x2, y2] : mp(Math.cos(b), Math.sin(b));
    out.push(['C', c1[0], c1[1], c2[0], c2[1], e[0], e[1]]);
  }
  return out;
}

function parsePath(d) {
  const s = String(d), n = s.length, subs = [];
  let i = 0;
  const numRe = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  const skip = () => { while (i < n) { const c = s.charCodeAt(i); if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) i++; else break; } };
  const rn = () => { skip(); numRe.lastIndex = i; const m = numRe.exec(s); if (!m) return NaN; i = numRe.lastIndex; return parseFloat(m[0]); };
  const rf = () => { skip(); const c = s[i]; if (c === '0' || c === '1') { i++; return +c; } return NaN; };
  let cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, cur = null, prev = '', lcx = 0, lcy = 0;
  const ensure = () => { if (!cur || cur.closed) { cur = { x: cx, y: cy, segs: [], closed: false }; subs.push(cur); } };
  for (;;) {
    skip();
    if (i >= n) break;
    const ch = s[i];
    if (/[A-Za-z]/.test(ch)) {
      if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(ch)) break;
      cmd = ch; i++;
      if (cmd === 'Z' || cmd === 'z') { if (cur) { cur.closed = true; } cx = sx; cy = sy; prev = 'Z'; continue; }
    } else if (!cmd || cmd === 'Z' || cmd === 'z') break;
    const rel = cmd === cmd.toLowerCase(), U = cmd.toUpperCase();
    let x, y, ok = true;
    if (U === 'M') {
      x = rn(); y = rn(); if (!(x === x && y === y)) break;
      if (rel) { x += cx; y += cy; }
      cur = { x, y, segs: [], closed: false }; subs.push(cur);
      cx = sx = x; cy = sy = y; prev = 'M'; cmd = rel ? 'l' : 'L'; continue;
    }
    if (U === 'L') { x = rn(); y = rn(); if (rel) { x += cx; y += cy; } if (x === x && y === y) { ensure(); cur.segs.push(['L', x, y]); cx = x; cy = y; } else ok = false; prev = 'L'; }
    else if (U === 'H') { x = rn(); if (rel) x += cx; if (x === x) { ensure(); cur.segs.push(['L', x, cy]); cx = x; } else ok = false; prev = 'L'; }
    else if (U === 'V') { y = rn(); if (rel) y += cy; if (y === y) { ensure(); cur.segs.push(['L', cx, y]); cy = y; } else ok = false; prev = 'L'; }
    else if (U === 'C' || U === 'S') {
      let x1, y1;
      if (U === 'C') { x1 = rn(); y1 = rn(); if (rel) { x1 += cx; y1 += cy; } }
      else if (prev === 'C') { x1 = 2 * cx - lcx; y1 = 2 * cy - lcy; } else { x1 = cx; y1 = cy; }
      let x2 = rn(), y2 = rn(); x = rn(); y = rn();
      if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
      if ([x1, y1, x2, y2, x, y].every((v) => v === v)) { ensure(); cur.segs.push(['C', x1, y1, x2, y2, x, y]); lcx = x2; lcy = y2; cx = x; cy = y; } else ok = false;
      prev = 'C';
    } else if (U === 'Q' || U === 'T') {
      let qx, qy;
      if (U === 'Q') { qx = rn(); qy = rn(); if (rel) { qx += cx; qy += cy; } }
      else if (prev === 'Q') { qx = 2 * cx - lcx; qy = 2 * cy - lcy; } else { qx = cx; qy = cy; }
      x = rn(); y = rn(); if (rel) { x += cx; y += cy; }
      if ([qx, qy, x, y].every((v) => v === v)) {
        ensure();
        cur.segs.push(['C', cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y]);
        lcx = qx; lcy = qy; cx = x; cy = y;
      } else ok = false;
      prev = 'Q';
    } else if (U === 'A') {
      const rx = rn(), ry = rn(), rot = rn(), fa = rf(), fs = rf();
      x = rn(); y = rn(); if (rel) { x += cx; y += cy; }
      if ([rx, ry, rot, fa, fs, x, y].every((v) => v === v)) { ensure(); for (const sg of arcToCubics(cx, cy, rx, ry, rot, fa, fs, x, y)) cur.segs.push(sg); cx = x; cy = y; } else ok = false;
      prev = 'A';
    }
    if (!ok) break;
  }
  return subs;
}

/* ---------- bentuk dasar -> subpath ---------- */
const KAPPA = 0.5522847498307936;
function ellipseSub(cx, cy, rx, ry) {
  const kx = KAPPA * rx, ky = KAPPA * ry;
  return { x: cx + rx, y: cy, closed: true, segs: [
    ['C', cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry],
    ['C', cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
    ['C', cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry],
    ['C', cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy]] };
}
function rectSub(x, y, w, h, rx, ry) {
  if (!(rx > 0) && !(ry > 0)) return { x, y, closed: true, segs: [['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h]] };
  if (!(rx > 0)) rx = ry; if (!(ry > 0)) ry = rx;
  rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
  const kx = KAPPA * rx, ky = KAPPA * ry;
  return { x: x + rx, y, closed: true, segs: [
    ['L', x + w - rx, y], ['C', x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry],
    ['L', x + w, y + h - ry], ['C', x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h],
    ['L', x + rx, y + h], ['C', x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry],
    ['L', x, y + ry], ['C', x, y + ry - ky, x + rx - kx, y, x + rx, y]] };
}
function polySub(str, closed) {
  const v = String(str || '').split(/[\s,]+/).filter((q) => q !== '').map(parseFloat);
  if (v.length < 4 || v.some((q) => !(q === q))) return null;
  const sub = { x: v[0], y: v[1], closed, segs: [] };
  for (let k = 2; k + 1 < v.length; k += 2) sub.segs.push(['L', v[k], v[k + 1]]);
  return sub;
}

/* ---------- meratakan kurva (setelah transform, toleransi dalam px kanvas) ---------- */
function flattenCubic(p0, p1, p2, p3, tol, out) {
  const L = Math.max(Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]), Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]));
  const n = Math.max(1, Math.min(400, Math.ceil(Math.sqrt(6 * L / (8 * tol)))));
  for (let k = 1; k < n; k++) {
    const t = k / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  out.push(p3);
}
function flattenSub(sub, M, tol) {
  const tp = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  let p0 = tp(sub.x, sub.y);
  const P = [p0];
  for (const sg of sub.segs) {
    if (sg[0] === 'L') { p0 = tp(sg[1], sg[2]); P.push(p0); }
    else { const p1 = tp(sg[1], sg[2]), p2 = tp(sg[3], sg[4]), p3 = tp(sg[5], sg[6]); flattenCubic(p0, p1, p2, p3, tol, P); p0 = p3; }
  }
  return P;
}

/* ---------- geometri ---------- */
function cleanRing(P) {
  const out = [];
  for (const p of P) {
    const x = r4(p[0]), y = r4(p[1]), q = out[out.length - 1];
    if (!q || q[0] !== x || q[1] !== y) out.push([x, y]);
  }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}
/* penyederhanaan titik untuk jalur SVG: gabungkan titik yang terlalu rapat, buang titik yang sejajar.
   tol dalam px kanvas; bentuk bergeser paling jauh sekitar tol. tol 0 = mati. */
function thinRing(P, tol) {
  if (!(tol > 0) || P.length < 4) return P;
  const g2 = (tol / 2) * (tol / 2), A = [P[0]];
  for (let i = 1; i < P.length; i++) { const q = A[A.length - 1]; if ((P[i][0] - q[0]) ** 2 + (P[i][1] - q[1]) ** 2 >= g2) A.push(P[i]); }
  while (A.length > 1 && (A[0][0] - A[A.length - 1][0]) ** 2 + (A[0][1] - A[A.length - 1][1]) ** 2 < g2) A.pop();
  if (A.length < 3) return P;
  let S = A;
  if (A.length >= 6) S = simplifyRing(A, tol);
  else { S = A.filter((p, i) => distSeg(p, A[(i + A.length - 1) % A.length], A[(i + 1) % A.length]) >= tol); }
  if (S.length < 3) S = A;
  const a0 = area(P), a1 = area(S);
  if (!a1 || (a0 > 0) !== (a1 > 0) || Math.abs(a1 - a0) > Math.max(1, Math.abs(a0)) * 0.02) return P;
  return S;
}
function area(R) { let a = 0; for (let i = 0, n = R.length; i < n; i++) { const p = R[i], q = R[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function bboxOf(R) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of R) { if (p[0] < a) a = p[0]; if (p[0] > c) c = p[0]; if (p[1] < b) b = p[1]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; }
function orient(R, sign) { return (area(R) >= 0) === (sign > 0) ? R : R.slice().reverse(); }
function pip(pt, R) {
  let ins = false;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
    const a = R[i], b = R[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function onBoundary(p, R, eps) { for (let i = 0, n = R.length; i < n; i++) if (distSeg(p, R[i], R[(i + 1) % n]) < eps) return true; return false; }
/* apakah cincin A berada di dalam cincin B (A dan B tidak saling memotong) */
function ringInside(A, B) {
  const cand = [];
  for (let k = 0; k < Math.min(A.length, 6); k++) { const p = A[Math.floor(k * A.length / Math.min(A.length, 6))]; cand.push(p); }
  for (let k = 0; k < Math.min(A.length, 4); k++) { const p = A[k], q = A[(k + 1) % A.length]; cand.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); }
  for (const p of cand) if (!onBoundary(p, B, 1e-4)) return pip(p, B);
  return false;
}

const ori = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function properCross(a, b, c, d) {
  const E = 1e-7;
  const d1 = ori(c[0], c[1], d[0], d[1], a[0], a[1]), d2 = ori(c[0], c[1], d[0], d[1], b[0], b[1]);
  const d3 = ori(a[0], a[1], b[0], b[1], c[0], c[1]), d4 = ori(a[0], a[1], b[0], b[1], d[0], d[1]);
  return ((d1 > E && d2 < -E) || (d1 < -E && d2 > E)) && ((d3 > E && d4 < -E) || (d3 < -E && d4 > E));
}
/* deteksi perpotongan antar-cincin (mutual) dan dalam satu cincin (self), memakai grid */
function findCrossings(rings) {
  const segs = [];
  rings.forEach((R, k) => { for (let i = 0, n = R.length; i < n; i++) segs.push([R[i], R[(i + 1) % n], k, i, n]); });
  const N = segs.length;
  if (N < 4 || N > 400000) return { mutual: false, self: false, skipped: N > 400000 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segs) for (const p of [s[0], s[1]]) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const W = Math.max(x1 - x0, 1e-6), H = Math.max(y1 - y0, 1e-6);
  const cell = Math.max(Math.sqrt(W * H / N) * 2, Math.max(W, H) / 1024);
  const gx = Math.floor(W / cell) + 1, grid = new Map();
  segs.forEach((s, id) => {
    const ax = Math.floor((Math.min(s[0][0], s[1][0]) - x0) / cell), bx = Math.floor((Math.max(s[0][0], s[1][0]) - x0) / cell);
    const ay = Math.floor((Math.min(s[0][1], s[1][1]) - y0) / cell), by = Math.floor((Math.max(s[0][1], s[1][1]) - y0) / cell);
    for (let cy = ay; cy <= by; cy++) for (let cx = ax; cx <= bx; cx++) { const key = cy * gx + cx; let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(id); }
  });
  let mutual = false, self = false, budget = 6e6;
  for (const l of grid.values()) {
    if (l.length < 2) continue;
    for (let i = 0; i < l.length && budget > 0; i++) for (let j = i + 1; j < l.length; j++) {
      budget--;
      const a = segs[l[i]], b = segs[l[j]];
      if (a[2] === b[2]) {
        const di = Math.abs(a[3] - b[3]);
        if (di <= 1 || di === a[4] - 1) continue;
        if (!self && properCross(a[0], a[1], b[0], b[1])) self = true;
      } else if (!mutual && properCross(a[0], a[1], b[0], b[1])) mutual = true;
      if (mutual && self) return { mutual, self };
    }
    if (budget <= 0) return { mutual, self, skipped: true };
  }
  return { mutual, self };
}

/* kumpulan cincin + fill-rule -> daftar {outer, holes}. cincin berlubang dipisah mengikuti kaidah evenodd/nonzero */
function buildPWH(rings, rule, info) {
  const items = rings.map((r) => ({ r, a: area(r), bb: bboxOf(r) })).filter((it) => it.r.length >= 3 && Math.abs(it.a) > 1e-6);
  if (!items.length) return [];
  if (items.length === 1) return [{ outer: orient(items[0].r, 1), holes: [] }];
  const cr = findCrossings(items.map((it) => it.r));
  if (cr.skipped) info.skipped = true;
  if (cr.mutual) {
    info.crossed = true;
    return items.map((it) => ({ outer: orient(it.r, 1), holes: [] }));
  }
  if (cr.self) info.self = true;
  items.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  const N = items.length;
  for (let i = 0; i < N; i++) {
    const it = items[i];
    it.par = -1;
    for (let j = i - 1; j >= 0; j--) {
      const o = items[j];
      if (o.bb[0] > it.bb[0] + 1e-6 || o.bb[1] > it.bb[1] + 1e-6 || o.bb[2] < it.bb[2] - 1e-6 || o.bb[3] < it.bb[3] - 1e-6) continue;
      if (ringInside(it.r, o.r)) { it.par = j; break; }
    }
    const p = it.par >= 0 ? items[it.par] : null;
    it.depth = p ? p.depth + 1 : 1;
    it.wind = (p ? p.wind : 0) + (it.a > 0 ? 1 : -1);
    it.fill = rule === 'evenodd' ? it.depth % 2 === 1 : it.wind !== 0;
    it.pfill = p ? p.fill : false;
    it.edge = it.fill !== it.pfill;
  }
  const pieces = new Map();
  for (const it of items) if (it.edge && it.fill) pieces.set(it, { outer: orient(it.r, 1), holes: [] });
  for (const it of items) {
    if (!it.edge || it.fill) continue;
    let k = it.par;
    while (k >= 0 && !(items[k].edge && items[k].fill)) k = items[k].par;
    if (k >= 0) pieces.get(items[k]).holes.push(orient(it.r, -1));
  }
  return [...pieces.values()];
}

/* ---------- menutup lubang: jembatan (1 cincin) ---------- */
function segHitsRings(a, b, rings) {
  for (const R of rings) for (let i = 0, n = R.length; i < n; i++) if (properCross(a, b, R[i], R[(i + 1) % n])) return true;
  return false;
}
function findBridge(ring, hole, others) {
  const m = hole.length, cand = new Set();
  let ix = [0, 0, 0, 0];
  for (let k = 1; k < m; k++) {
    if (hole[k][0] < hole[ix[0]][0]) ix[0] = k; if (hole[k][0] > hole[ix[1]][0]) ix[1] = k;
    if (hole[k][1] < hole[ix[2]][1]) ix[2] = k; if (hole[k][1] > hole[ix[3]][1]) ix[3] = k;
  }
  ix.forEach((k) => cand.add(k));
  for (let k = 0; k < m; k += Math.max(1, Math.ceil(m / 8))) cand.add(k);
  const all = [ring, hole].concat(others);
  const tryPairs = (pairs) => {
    pairs.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < pairs.length && k < 4000; k++) {
      const hi = pairs[k][1], vi = pairs[k][2], a = hole[hi], b = ring[vi];
      if (segHitsRings(a, b, all)) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!pip(mid, ring) || pip(mid, hole) || others.some((o) => pip(mid, o))) continue;
      return [hi, vi];
    }
    return null;
  };
  // tahap cepat: tiap titik calon hanya dicoba dengan beberapa titik cincin terdekat
  const near = [];
  for (const hi of cand) {
    const best = [];
    for (let vi = 0; vi < ring.length; vi++) {
      const d = Math.hypot(hole[hi][0] - ring[vi][0], hole[hi][1] - ring[vi][1]);
      if (best.length < 8 || d < best[best.length - 1][0]) {
        best.push([d, hi, vi]);
        best.sort((p, q) => p[0] - q[0]);
        if (best.length > 8) best.pop();
      }
    }
    for (const x of best) near.push(x);
  }
  let r = tryPairs(near);
  if (r) return r;
  // tahap lengkap: semua pasangan
  const pairs = [];
  for (const hi of cand) for (let vi = 0; vi < ring.length; vi++) pairs.push([Math.hypot(hole[hi][0] - ring[vi][0], hole[hi][1] - ring[vi][1]), hi, vi]);
  return tryPairs(pairs);
}
function bridgeAll(outer, holes) {
  let ring = outer.slice();
  const rest = holes.slice().sort((p, q) => bboxOf(q)[2] - bboxOf(p)[2]), bad = [];
  while (rest.length) {
    const h = rest.shift(), res = findBridge(ring, h, rest);
    if (!res) { bad.push(h); continue; }
    const hi = res[0], vi = res[1], m = h.length, out = ring.slice(0, vi + 1);
    for (let k = 0; k <= m; k++) out.push(h[(hi + k) % m]);
    out.push(ring[vi]);
    ring = out.concat(ring.slice(vi + 1));
  }
  return { ring, bad };
}

/* ---------- memecah bentuk berlubang per bidang (potong vertikal) ---------- */
function clipHalf(rings, c, keepLeft) {
  const side = keepLeft ? (p) => p[0] < c : (p) => p[0] > c;
  const isect = (a, b) => { const t = (c - a[0]) / (b[0] - a[0]); return [c, a[1] + t * (b[1] - a[1])]; };
  const whole = [], chains = [], ev = [];
  for (const P of rings) {
    const n = P.length, ins = P.map(side);
    let cnt = 0; for (const b of ins) if (b) cnt++;
    if (cnt === n) { whole.push(P); continue; }
    if (cnt === 0) continue;
    let s = 0; for (let k = 0; k < n; k++) if (!ins[k] && ins[(k + 1) % n]) { s = k; break; }
    let cur = null;
    for (let e = 0; e < n; e++) {
      const i = (s + e) % n, j = (i + 1) % n, a = P[i], b = P[j];
      if (!ins[i] && ins[j]) { const X = isect(a, b); cur = { pts: [X, b], ey: X[1], next: null }; }
      else if (ins[i] && ins[j]) cur.pts.push(b);
      else if (ins[i] && !ins[j]) { const X = isect(a, b); cur.pts.push(X); chains.push(cur); ev.push({ y: cur.ey, k: 0, ch: cur }, { y: X[1], k: 1, ch: cur }); cur = null; }
    }
  }
  ev.sort((p, q) => p.y - q.y || p.k - q.k);
  for (let m = 0; m < ev.length; m += 2) {
    const a = ev[m], b = ev[m + 1];
    if (!b || a.k === b.k) throw new Error('pasangan potongan tidak konsisten');
    (a.k === 1 ? a : b).ch.next = (a.k === 0 ? a : b).ch;
  }
  const used = new Set(), loops = [];
  for (const ch of chains) {
    if (used.has(ch)) continue;
    const ring = []; let cur = ch, g = 0;
    do { used.add(cur); for (const p of cur.pts) ring.push(p); cur = cur.next; if (++g > chains.length + 2) throw new Error('rantai tidak menutup'); } while (cur && cur !== ch);
    if (cur !== ch) throw new Error('rantai terbuka');
    loops.push(ring);
  }
  return whole.concat(loops);
}
function sortedUnique(a) { a = a.slice().sort((p, q) => p - q); return a.filter((v, i) => !i || v - a[i - 1] > 1e-3); }
function splitSlabs(pwh, ov) {
  const rings = [pwh.outer].concat(pwh.holes);
  const vx = []; for (const R of rings) for (const p of R) vx.push(p[0]);
  vx.sort((p, q) => p - q);
  const near = (x) => { let lo = 0, hi = vx.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (vx[m] < x) lo = m + 1; else hi = m; } return Math.abs(vx[lo] - x) < 1e-4 || (lo > 0 && Math.abs(vx[lo - 1] - x) < 1e-4); };
  const clear = (x, dir) => { let g = 0; while (near(x) && g++ < 50) x += dir * 1.7e-4; return x; };
  const cuts = sortedUnique(pwh.holes.map((h) => { const b = bboxOf(h); return (b[0] + b[2]) / 2; })).map((x) => clear(x, 1));
  const out = [];
  for (let j = 0; j <= cuts.length; j++) {
    const lo = j === 0 ? -Infinity : clear(cuts[j - 1] - ov, -1), hi = j === cuts.length ? Infinity : cuts[j];
    let rs = rings;
    if (lo > -Infinity) rs = clipHalf(rs, lo, false);
    if (hi < Infinity) rs = clipHalf(rs, hi, true);
    const outers = [], holes = [];
    for (const R of rs) { const a = area(R); if (Math.abs(a) < 1e-6) continue; (a > 0 ? outers : holes).push(R); }
    const own = outers.map(() => []);
    for (const h of holes) {
      let best = -1, ba = Infinity;
      outers.forEach((o, k) => { const a = area(o); if (a < ba && ringInside(h, o)) { best = k; ba = a; } });
      if (best >= 0) own[best].push(h);
    }
    outers.forEach((o, k) => {
      if (!own[k].length) out.push(o);
      else { const b = bridgeAll(o, own[k]); out.push(b.ring); if (b.bad.length) throw new Error('lubang sisa tidak bisa dijembatani'); }
    });
  }
  if (!out.length) throw new Error('hasil kosong');
  return out;
}

/* ---------- gaya (atribut + CSS sederhana + style=) ---------- */
const PROPS = ['fill', 'fill-opacity', 'fill-rule', 'opacity', 'display', 'visibility', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'color', 'stop-color', 'stop-opacity', 'clip-path', 'mask', 'filter'];
const INH = { fill: 1, 'fill-opacity': 1, 'fill-rule': 1, visibility: 1, stroke: 1, 'stroke-width': 1, 'stroke-opacity': 1, 'stroke-linecap': 1, 'stroke-linejoin': 1, 'stroke-miterlimit': 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, color: 1 };
function parseDecls(s) {
  const o = {};
  String(s).split(';').forEach((d) => { const k = d.indexOf(':'); if (k > 0) o[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).replace(/!important/i, '').trim(); });
  return o;
}
function parseCSS(text, info) {
  const rules = [];
  text = String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[\w-]+[^{;]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, () => { info.css = true; return ''; }).replace(/@[^;{]*;/g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const decl = parseDecls(m[2]);
    m[1].split(',').forEach((sel) => {
      sel = sel.trim();
      const p = /^(\*|[A-Za-z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(sel);
      if (!p || !sel) { info.css = true; return; }
      const cls = [], id = [];
      (p[2].match(/[.#][\w-]+/g) || []).forEach((q) => (q[0] === '.' ? cls : id).push(q.slice(1)));
      rules.push({ tag: p[1] && p[1] !== '*' ? p[1] : '', cls, id: id[0] || '', decl, spec: id.length * 100 + cls.length * 10 + (p[1] && p[1] !== '*' ? 1 : 0), ord: rules.length });
    });
  }
  return rules;
}
function computeStyle(el, parent, rules) {
  const own = {};
  for (const p of PROPS) if (el.a[p] !== undefined) own[p] = String(el.a[p]).trim();
  if (rules.length) {
    const cls = (el.a['class'] || '').split(/\s+/).filter(Boolean);
    rules.filter((r) => (!r.tag || r.tag === el.t) && (!r.id || r.id === el.a.id) && r.cls.every((c) => cls.indexOf(c) >= 0))
      .sort((p, q) => p.spec - q.spec || p.ord - q.ord).forEach((r) => Object.assign(own, r.decl));
  }
  if (el.a.style) Object.assign(own, parseDecls(el.a.style));
  const st = {};
  for (const p of PROPS) {
    let v = own[p];
    if (v === 'inherit' || (v === undefined && INH[p])) v = parent ? parent[p] : undefined;
    if (v !== undefined) st[p] = v;
  }
  return st;
}

/* ---------- satuan panjang ---------- */
function len(v, base) {
  if (v === undefined || v === null || v === '') return NaN;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|rem|ex|%)?\s*$/.exec(String(v));
  if (!m) return NaN;
  const x = parseFloat(m[1]);
  switch (m[2]) {
    case 'pt': return x * 4 / 3; case 'pc': return x * 16; case 'mm': return x * 96 / 25.4; case 'cm': return x * 96 / 2.54;
    case 'in': return x * 96; case 'em': case 'rem': return x * 16; case 'ex': return x * 8; case '%': return base ? x * base / 100 : NaN;
    default: return x;
  }
}

/* ---------- membaca SVG -> daftar daun (bentuk berisi fill) ---------- */
const SKIP = { defs: 1, style: 1, script: 1, title: 1, desc: 1, metadata: 1, linearGradient: 1, radialGradient: 1, clipPath: 1, mask: 1, pattern: 1, marker: 1, filter: 1, symbol: 1, namedview: 1, 'color-profile': 1, font: 1, 'font-face': 1 };
const TEXTY = { text: 1, tspan: 1, textPath: 1 };
const SHAPES = { path: 1, rect: 1, circle: 1, ellipse: 1, polygon: 1, polyline: 1, line: 1 };

function readSVG(text, warn) {
  const tree = parseXML(text);
  let svg = null;
  (function find(n) { if (svg) return; for (const c of n.c) { if (c.t === 'svg') { svg = c; return; } find(c); } })(tree);
  if (!svg) throw new Error('Berkas ini bukan SVG yang valid.');
  const ids = {}, info = {};
  let css = '';
  (function idx(n) { for (const c of n.c) { if (c.a.id) ids[c.a.id] = c; if (c.t === 'style') css += '\n' + c.x; idx(c); } })(svg);
  const rules = css ? parseCSS(css, info) : [];
  if (info.css) warn('Sebagian aturan CSS di dalam SVG terlalu rumit dan diabaikan. Pakai warna langsung di tiap bentuk bila warnanya tidak sesuai.');
  return { svg, ids, rules };
}

function gradientColor(el, ids, rules, cur) {
  let node = el, stops = [], g = 0;
  while (node && g++ < 6) {
    stops = node.c.filter((c) => c.t === 'stop');
    if (stops.length) break;
    const h = node.a.href; node = h && h[0] === '#' ? ids[h.slice(1)] : null;
  }
  if (!stops.length) return null;
  let r = 0, gg = 0, b = 0, a = 0;
  for (const s of stops) {
    const st = computeStyle(s, null, rules);
    const col = parseColor(st['stop-color'] !== undefined ? st['stop-color'] : 'black', cur) || { r: 0, g: 0, b: 0, a: 1 };
    const so = st['stop-opacity'] !== undefined ? parseFloat(st['stop-opacity']) : 1;
    r += col.r; gg += col.g; b += col.b; a += col.a * (so === so ? so : 1);
  }
  const n = stops.length;
  return { r: Math.round(r / n), g: Math.round(gg / n), b: Math.round(b / n), a: a / n };
}


/* ---------- gradasi asli: dipecah jadi pita warna bertumpuk ---------- */
const GRAD_Q = { rendah: { lv: 12, max: 24 }, sedang: { lv: 5, max: 48 }, tinggi: { lv: 2.5, max: 96 } };
const GRAD_BUDGET = 1500;   // batas total pita untuk satu file agar Alight Motion tidak berat
function matInv(m) {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!(Math.abs(d) > 1e-12)) return null;
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
const mapPt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function gradAttr(el, ids, name) {
  let n = el, g = 0;
  while (n && g++ < 8) { if (n.a[name] !== undefined) return n.a[name]; const h = n.a.href; n = h && h[0] === '#' ? ids[h.slice(1)] : null; }
  return undefined;
}
// membaca definisi gradasi apa adanya (stop, geometri, satuan, transform); null bila bukan gradasi sungguhan
function gradSpec(el, ids, rules, cur, box) {
  let node = el, stops = [], g = 0;
  while (node && g++ < 8) {
    stops = node.c.filter((c) => c.t === 'stop');
    if (stops.length) break;
    const h = node.a.href; node = h && h[0] === '#' ? ids[h.slice(1)] : null;
  }
  if (stops.length < 2) return null;
  const S = []; let prev = 0;
  for (const s of stops) {
    const st = computeStyle(s, null, rules);
    const col = parseColor(st['stop-color'] !== undefined ? st['stop-color'] : 'black', cur) || { r: 0, g: 0, b: 0, a: 1 };
    let o = String(s.a.offset === undefined ? '0' : s.a.offset).trim();
    o = /%$/.test(o) ? parseFloat(o) / 100 : parseFloat(o);
    if (!(o === o)) o = 0;
    o = Math.max(prev, Math.min(1, Math.max(0, o))); prev = o;
    const so = st['stop-opacity'] !== undefined ? parseFloat(st['stop-opacity']) : 1;
    S.push({ o, c: { r: col.r, g: col.g, b: col.b, a: col.a * (so === so ? Math.max(0, Math.min(1, so)) : 1) } });
  }
  const radial = el.t === 'radialGradient';
  const units = gradAttr(el, ids, 'gradientUnits') === 'userSpaceOnUse' ? 'user' : 'bbox';
  const W = box ? box.w : 1, H = box ? box.h : 1, D = Math.sqrt((W * W + H * H) / 2);
  const val = (name, def, ax) => {
    let v = gradAttr(el, ids, name); if (v === undefined) v = def;
    v = String(v).trim();
    const f = parseFloat(v); if (!(f === f)) return parseFloat(def) / (/%$/.test(def) ? 100 : 1) * (units === 'user' && /%$/.test(def) ? (ax === 'x' ? W : ax === 'y' ? H : D) : 1);
    if (/%$/.test(v)) return f / 100 * (units === 'user' ? (ax === 'x' ? W : ax === 'y' ? H : D) : 1);
    return f;
  };
  const sp = gradAttr(el, ids, 'spreadMethod');
  const spec = { radial, units, stops: S, spread: sp === 'reflect' || sp === 'repeat' ? sp : 'pad', gt: parseTransform(gradAttr(el, ids, 'gradientTransform')) };
  if (radial) {
    spec.cx = val('cx', '50%', 'x'); spec.cy = val('cy', '50%', 'y'); spec.r = val('r', '50%', 'd');
    const fx = gradAttr(el, ids, 'fx'), fy = gradAttr(el, ids, 'fy');
    spec.focal = (fx !== undefined && Math.abs(val('fx', '50%', 'x') - spec.cx) > 1e-6) || (fy !== undefined && Math.abs(val('fy', '50%', 'y') - spec.cy) > 1e-6);
    if (!(spec.r > 0)) return { flat: S[S.length - 1].c };
  } else {
    spec.x1 = val('x1', '0%', 'x'); spec.y1 = val('y1', '0%', 'y'); spec.x2 = val('x2', '100%', 'x'); spec.y2 = val('y2', '0%', 'y');
    if (Math.abs(spec.x2 - spec.x1) < 1e-12 && Math.abs(spec.y2 - spec.y1) < 1e-12) return { flat: S[S.length - 1].c };
  }
  return spec;
}
function colorAt(spec, t) {
  if (spec.spread === 'repeat') t = t - Math.floor(t);
  else if (spec.spread === 'reflect') { const m = ((t % 2) + 2) % 2; t = m > 1 ? 2 - m : m; }
  const S = spec.stops;
  if (t <= S[0].o) return S[0].c;
  for (let i = 1; i < S.length; i++) {
    if (t <= S[i].o) {
      const a = S[i - 1], b = S[i], w = b.o - a.o > 1e-12 ? (t - a.o) / (b.o - a.o) : 1;
      return { r: a.c.r + (b.c.r - a.c.r) * w, g: a.c.g + (b.c.g - a.c.g) * w, b: a.c.b + (b.c.b - a.c.b) * w, a: a.c.a + (b.c.a - a.c.a) * w };
    }
  }
  return S[S.length - 1].c;
}
// gradasi -> fungsi t(titik kanvas), plus ukuran satu satuan t dalam piksel
function gradField(spec, lm, bb) {
  let U = IDM;
  if (spec.units === 'bbox') U = [bb.w, 0, 0, bb.h, bb.x, bb.y];
  const G = mul(lm, mul(U, spec.gt)), Gi = matInv(G);
  if (!Gi) return null;
  const det = Math.abs(G[0] * G[3] - G[1] * G[2]);
  if (!spec.radial) {
    const dx = spec.x2 - spec.x1, dy = spec.y2 - spec.y1, L2 = dx * dx + dy * dy;
    const A = (Gi[0] * dx + Gi[1] * dy) / L2, B = (Gi[2] * dx + Gi[3] * dy) / L2, C = ((Gi[4] - spec.x1) * dx + (Gi[5] - spec.y1) * dy) / L2;
    const n = Math.hypot(A, B);
    if (!(n > 0)) return null;
    return { G, Gi, t: (p) => A * p[0] + B * p[1] + C, unitPx: 1 / n };
  }
  return { G, Gi, t: (p) => { const q = mapPt(Gi, p[0], p[1]); return Math.hypot(q[0] - spec.cx, q[1] - spec.cy) / spec.r; }, unitPx: spec.r * Math.sqrt(det) };
}
// rentang t yang benar-benar dipakai bentuk (jangan membuang pita untuk bagian yang tidak terlihat)
function tRange(spec, fld, rings) {
  let lo = Infinity, hi = -Infinity;
  if (!spec.radial) {
    for (const R of rings) for (const p of R) { const t = fld.t(p); if (t < lo) lo = t; if (t > hi) hi = t; }
    return [lo, hi];
  }
  let inside = false, md = Infinity;
  for (const R of rings) {
    const Q = R.map((p) => { const q = mapPt(fld.Gi, p[0], p[1]); return [q[0] - spec.cx, q[1] - spec.cy]; });
    for (const q of Q) { const t = Math.hypot(q[0], q[1]) / spec.r; if (t > hi) hi = t; }
    if (pip([0, 0], Q)) inside = true;
    for (let i = 0; i < Q.length; i++) {
      const a = Q[i], b = Q[(i + 1) % Q.length], dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
      let u = l ? -(a[0] * dx + a[1] * dy) / l : 0; u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(a[0] + u * dx, a[1] + u * dy) / spec.r; if (d < md) md = d;
    }
  }
  return [inside ? 0 : md, hi];
}
// membagi rentang t jadi pita-pita; makin besar perubahan warna, makin banyak pita
function planBands(spec, t0, t1, unitPx, q, mult) {
  const lv = q.lv * mult, mx = Math.max(2, Math.floor(q.max / mult));
  const cuts = new Set([t0, t1]), add = (v) => { if (v > t0 + 1e-9 && v < t1 - 1e-9) cuts.add(v); };
  if (spec.spread === 'pad') { add(0); add(1); spec.stops.forEach((s) => add(s.o)); }
  else {
    if (t1 - t0 > 80) return null;
    for (let i = Math.floor(t0); i <= Math.ceil(t1); i++) { add(i); spec.stops.forEach((s) => { add(i + s.o); add(i + 1 - s.o); }); }
  }
  const pts = Array.from(cuts).sort((a, b) => a - b), out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], e = (b - a) * 0.001, ca = colorAt(spec, a + e), cb = colorAt(spec, b - e);
    const dl = Math.max(Math.abs(ca.r - cb.r), Math.abs(ca.g - cb.g), Math.abs(ca.b - cb.b), Math.abs(ca.a - cb.a) * 255);
    let n = Math.max(1, Math.min(mx, Math.ceil(dl / lv), Math.ceil((b - a) * unitPx / 1.5)));
    for (let k = 0; k < n; k++) {
      const x = a + (b - a) * k / n, y = a + (b - a) * (k + 1) / n, c = colorAt(spec, (x + y) / 2);
      const last = out[out.length - 1];
      if (last && Math.round(last.c.r) === Math.round(c.r) && Math.round(last.c.g) === Math.round(c.g) && Math.round(last.c.b) === Math.round(c.b) && Math.abs(last.c.a - c.a) < 0.004) last.b = y;
      else out.push({ a: x, b: y, c });
    }
  }
  return out;
}
// Sutherland-Hodgman: simpan bagian ring yang s(p) >= 0
function clipSide(ring, s) {
  const out = [], n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], da = s(a), db = s(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function keepRings(list) {
  const fin = [];
  for (const R of list) { if (R.length < 3) continue; const C = cleanRing(R); if (C.length >= 3 && Math.abs(area(C)) > 1e-3) fin.push(C); }
  return fin;
}
const clipRings = (rings, s) => keepRings(rings.map((R) => clipSide(R, s)));
function discPoly(spec, fld, rho) {
  const Rpx = rho * spec.r * Math.sqrt(Math.abs(fld.G[0] * fld.G[3] - fld.G[1] * fld.G[2]));
  const n = Rpx < 0.4 ? 16 : Math.max(16, Math.min(180, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.25 / Rpx)))));
  const P = [];
  for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(mapPt(fld.G, spec.cx + rho * spec.r * Math.cos(th), spec.cy + rho * spec.r * Math.sin(th))); }
  return P;
}
function clipDisc(rings, poly) {
  const sg = area(poly) >= 0 ? 1 : -1;
  let cur = rings;
  for (let i = 0; i < poly.length && cur.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1];
    cur = keepRings(cur.map((R) => clipSide(R, (p) => sg * (ex * (p[1] - a[1]) - ey * (p[0] - a[0])))));
  }
  return cur;
}

/* bentuk dasar -> daftar subjalur (ruang lokal) */
function shapeSubs(t, a) {
  let subs = [];
  if (t === 'path') subs = parsePath(a.d || '');
  else if (t === 'rect') {
    const w = len(a.width), h = len(a.height);
    if (w > 0 && h > 0) subs = [rectSub(len(a.x) || 0, len(a.y) || 0, w, h, len(a.rx), len(a.ry))];
  } else if (t === 'circle') { const r = len(a.r); if (r > 0) subs = [ellipseSub(len(a.cx) || 0, len(a.cy) || 0, r, r)]; }
  else if (t === 'ellipse') {
    let rx = len(a.rx), ry = len(a.ry);
    if (!(rx > 0)) rx = ry; if (!(ry > 0)) ry = rx;
    if (rx > 0 && ry > 0) subs = [ellipseSub(len(a.cx) || 0, len(a.cy) || 0, rx, ry)];
  } else if (t === 'polygon') { const s = polySub(a.points, true); if (s) subs = [s]; }
  else if (t === 'polyline') { const s = polySub(a.points, false); if (s) subs = [s]; }
  else if (t === 'line') { const x1 = len(a.x1) || 0, y1 = len(a.y1) || 0, x2 = len(a.x2) || 0, y2 = len(a.y2) || 0; subs = [{ x: x1, y: y1, closed: false, segs: [['L', x2, y2]] }]; }
  return subs;
}
/* clipPath -> { polys: [cincin cembung di ruang kanvas] } atau null bila belum didukung */
function buildClip(cp, M) {
  if (cp.a.clipPathUnits === 'objectBoundingBox') return null;
  const Mc = cp.a.transform ? mul(M, parseTransform(cp.a.transform)) : M, polys = [];
  for (const ch of cp.c) {
    if (ch.t === 'title' || ch.t === 'desc') continue;
    if (!SHAPES[ch.t] || ch.t === 'line' || ch.a['clip-path']) return null;
    if (/display\s*:\s*none/i.test(ch.a.style || '') || ch.a.display === 'none') continue;
    const Mk = ch.a.transform ? mul(Mc, parseTransform(ch.a.transform)) : Mc, rings = [];
    for (const sb of shapeSubs(ch.t, ch.a)) { const R = cleanRing(flattenSub(sb, Mk, 0.1)); if (R.length >= 3 && Math.abs(area(R)) > 1e-6) rings.push(R); }
    for (let i = 0; i < rings.length; i++) for (let j = 0; j < rings.length; j++) if (i !== j && ringInside(rings[i], rings[j])) return null;
    for (const R of rings) { const parts = convexParts(R); if (!parts) return null; for (const q of parts) polys.push(q); }
  }
  return { polys };
}
function applyClips(fin, clips) {
  for (const c of clips) {
    if (!fin.length) break;
    const out = [];
    for (const poly of c.polys) for (const R of clipDisc(fin, poly)) out.push(R);
    fin = out;
  }
  return fin;
}

function collect(doc, base, warn) {
  const { svg, ids, rules } = doc, leaves = [];
  const cnt = {};
  const note = (k) => { cnt[k] = (cnt[k] || 0) + 1; };
  function paint(st, ids2, key) {
    key = key || 'fill';
    const raw = st[key] === undefined ? 'black' : st[key];
    if (/^none$/i.test(raw)) return null;
    const u = /^url\(\s*['"]?#([^)'"]+)['"]?\s*\)\s*(.*)$/i.exec(raw);
    if (u) {
      const t = ids2[u[1]];
      if (t && (t.t === 'linearGradient' || t.t === 'radialGradient')) {
        const c = gradientColor(t, ids2, rules, st.color);
        if (c) {
          const sp = gradSpec(t, ids2, rules, st.color, intrinsic(svg));
          if (sp && sp.flat) return sp.flat;
          note('grad'); if (sp && sp.focal) note('fokus');
          return sp ? Object.assign({}, c, { gs: sp }) : c;
        }
      }
      note('pola');
      if (u[2]) { const f = parseColor(u[2], st.color); if (f) return f; }
      return null;
    }
    const c = parseColor(raw, st.color);
    return c || { r: 0, g: 0, b: 0, a: 1 };
  }
  function vbMap(vb, x, y, w, h) {
    const v = String(vb || '').split(/[\s,]+/).filter(Boolean).map(parseFloat);
    if (v.length !== 4 || !(v[2] > 0) || !(v[3] > 0) || !(w > 0) || !(h > 0)) return null;
    const s = Math.min(w / v[2], h / v[3]);
    return [s, 0, 0, s, x + (w - v[2] * s) / 2 - v[0] * s, y + (h - v[3] * s) / 2 - v[1] * s];
  }
  function kids(node, ctx) { for (const c of node.c) walk(c, ctx); }
  function walk(node, ctx) {
    if (ctx.depth > 40) return;
    const t = node.t;
    if (SKIP[t]) return;
    const st = computeStyle(node, ctx.st, rules);
    if (st.display === 'none') return;
    let M = ctx.m;
    if (node.a.transform) M = mul(M, parseTransform(node.a.transform));
    const op = ctx.op * (st.opacity !== undefined && parseFloat(st.opacity) === parseFloat(st.opacity) ? Math.max(0, Math.min(1, parseFloat(st.opacity))) : 1);
    let clips = ctx.clips;
    const cpv = st['clip-path'];
    if (cpv && cpv !== 'none') {
      const mm = /^url\(\s*['"]?#([^)'"]+)['"]?\s*\)$/i.exec(cpv.trim()), cel = mm && ids[mm[1]];
      const res = cel && cel.t === 'clipPath' ? buildClip(cel, M) : null;
      if (res) clips = clips.concat([res]); else note('clip');
    }
    if (st.mask && st.mask !== 'none') note('mask');
    if (st.filter && st.filter !== 'none') note('filter');
    const nctx = { m: M, st, op, depth: ctx.depth + 1, clips };
    if (t === 'g' || t === 'a' || t === 'switch') { kids(node, nctx); return; }
    if (t === 'svg') {
      if (ctx.depth === 0) { kids(node, nctx); return; }
      const x = len(node.a.x) || 0, y = len(node.a.y) || 0, w = len(node.a.width), h = len(node.a.height);
      const vm = node.a.viewBox ? vbMap(node.a.viewBox, x, y, w, h) : null;
      nctx.m = mul(M, vm || [1, 0, 0, 1, x, y]);
      kids(node, nctx); return;
    }
    if (t === 'use') {
      const h = node.a.href, tg = h && h[0] === '#' ? ids[h.slice(1)] : null;
      if (!tg) return;
      let UM = mul(M, [1, 0, 0, 1, len(node.a.x) || 0, len(node.a.y) || 0]);
      nctx.m = UM; nctx.depth = ctx.depth + 1;
      if (tg.t === 'symbol' || tg.t === 'svg') {
        const w = len(node.a.width !== undefined ? node.a.width : tg.a.width), hh = len(node.a.height !== undefined ? node.a.height : tg.a.height);
        const vm = tg.a.viewBox ? vbMap(tg.a.viewBox, 0, 0, w, hh) : null;
        if (vm) nctx.m = mul(UM, vm);
        const sst = computeStyle(tg, st, rules);
        nctx.st = sst;
        kids(tg, nctx);
      } else walk(tg, nctx);
      return;
    }
    if (TEXTY[t]) { note('teks'); return; }
    if (t === 'image' || t === 'foreignObject') { note('gambar'); return; }
    if (!SHAPES[t]) return;
    if (st.visibility === 'hidden' || st.visibility === 'collapse') return;
    const subs = shapeSubs(t, node.a);
    const fo = st['fill-opacity'] !== undefined && parseFloat(st['fill-opacity']) === parseFloat(st['fill-opacity']) ? Math.max(0, Math.min(1, parseFloat(st['fill-opacity']))) : 1;
    if (t !== 'line' && subs.length) {
      const col = paint(st, ids);
      if (col && col.a * op * fo > 0) leaves.push({ tag: t, subs, m: M, col, grad: col.gs || null, alpha: op * fo, rule: st['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero', clips });
    }
    const sk = st.stroke;
    if (sk !== undefined && !/^none$/i.test(sk) && subs.length) {
      let sw = st['stroke-width'] === undefined ? 1 : len(st['stroke-width']);
      if (!(sw >= 0)) sw = 1;
      if (sw > 0) {
        const so = st['stroke-opacity'] !== undefined && parseFloat(st['stroke-opacity']) === parseFloat(st['stroke-opacity']) ? Math.max(0, Math.min(1, parseFloat(st['stroke-opacity']))) : 1;
        const col = paint(st, ids, 'stroke');
        if (col && col.a * op * so > 0) {
          const cap = /^(round|square)$/.test(st['stroke-linecap']) ? st['stroke-linecap'] : 'butt';
          const join = /^(round|bevel)$/.test(st['stroke-linejoin']) ? st['stroke-linejoin'] : 'miter';
          let ml = parseFloat(st['stroke-miterlimit']); if (!(ml >= 1)) ml = 4;
          let dash = null;
          const da = st['stroke-dasharray'];
          if (da && !/^none$/i.test(da)) {
            const v = da.split(/[\s,]+/).filter(Boolean).map((q) => len(q));
            if (v.length && v.every((q) => q >= 0) && v.some((q) => q > 0)) dash = v.length % 2 ? v.concat(v) : v;
          }
          let doff = len(st['stroke-dashoffset']); if (!(doff === doff)) doff = 0;
          leaves.push({ tag: t, subs, m: M, col, grad: col.gs || null, alpha: op * so, rule: 'nonzero', clips, stroke: { w: sw, cap, join, ml, dash, dashOff: doff } });
        }
      }
    }
  }
  walk(svg, { m: base, st: null, op: 1, depth: 0, clips: [] });
  if (cnt.teks) warn('Teks tidak didukung (' + cnt.teks + ' elemen dilewati). Ubah teks menjadi outline di editor desain sebelum mengonversi.');
  if (cnt.gambar) warn('Gambar bitmap di dalam SVG tidak didukung (' + cnt.gambar + ' dilewati).');
  if (cnt.fokus) warn('Gradasi radial dengan titik fokus (fx/fy) dibuat dari titik tengahnya saja, bentuk fokusnya bisa sedikit berbeda.');
  leaves.grads = cnt.grad || 0; leaves.cnt = cnt;
  if (cnt.pola) warn('Pola (pattern) tidak didukung, ' + cnt.pola + ' bentuk dilewati atau memakai warna cadangan.');
  if (cnt.clip) warn('Clip-path pada ' + cnt.clip + ' elemen belum bisa dibaca (satuan objectBoundingBox, lubang, atau isi selain bentuk dasar), jadi bentuknya tidak terpotong.');
  if (cnt.mask) warn('Mask pada ' + cnt.mask + ' elemen diabaikan, bentuknya tidak tertutup mask.');
  if (cnt.filter) warn('Filter (blur, bayangan, dan sejenisnya) pada ' + cnt.filter + ' elemen diabaikan.');
  return leaves;
}

/* ---------- garis (stroke) -> bidang berisi ---------- */
/* Garis dihitung di ruang lokal (sebelum transform) lalu hasilnya ditransform, jadi skala tak seragam ikut benar.
   Satu garis terbuka = satu cincin (sisi kiri, tutup ujung, sisi kanan, tutup ujung). Garis tertutup = cincin luar + lubang.
   Di sambungan sisi dalam, jalur lewat titik sudutnya (cara Skia/Cairo) supaya isian nonzero tetap benar. */
const nrm = (d) => [-d.dy, d.dx];
function strokeJoin(out, p, d0, d1, hw, join, ml, tol) {
  const cr = d0.dx * d1.dy - d0.dy * d1.dx, dt = d0.dx * d1.dx + d0.dy * d1.dy;
  const n0 = nrm(d0), n1 = nrm(d1);
  const a = [p[0] + hw * n0[0], p[1] + hw * n0[1]], b = [p[0] + hw * n1[0], p[1] + hw * n1[1]];
  if (Math.abs(cr) < 1e-9 && dt > 0) { out.push(a); return; }
  const th = Math.atan2(Math.abs(cr), dt);
  const miterPt = () => { const k = hw / (1 + dt); return [p[0] + k * (n0[0] + n1[0]), p[1] + k * (n0[1] + n1[1])]; };
  if (cr > 1e-9) {                                  // sisi dalam
    const tanHalf = Math.abs(cr) / (1 + dt);
    if (hw * tanHalf <= Math.min(d0.l, d1.l)) out.push(miterPt()); else out.push(a, p.slice(), b);
    return;
  }
  if (th < 0.1 && 1 + dt > 1e-9) { out.push(miterPt()); return; }   // belokan sangat landai (kurva)
  if (join === 'round') {
    const step = hw > tol ? 2 * Math.acos(1 - tol / hw) : Math.PI, n = Math.max(1, Math.ceil(th / step));
    out.push(a);
    for (let k = 1; k < n; k++) {
      const ang = -th * k / n, c = Math.cos(ang), s = Math.sin(ang);
      out.push([p[0] + hw * (n0[0] * c - n0[1] * s), p[1] + hw * (n0[0] * s + n0[1] * c)]);
    }
    out.push(b); return;
  }
  if (join === 'miter' && 1 + dt > 1e-12 && Math.sqrt(2 / (1 + dt)) <= ml) { out.push(miterPt()); return; }
  out.push(a, b);
}
function strokeSide(P, closed, hw, join, ml, tol) {
  const n = P.length, ns = closed ? n : n - 1, S = [], out = [];
  for (let i = 0; i < ns; i++) { const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); S.push({ dx: dx / l, dy: dy / l, l }); }
  if (!closed) { const q = nrm(S[0]); out.push([P[0][0] + hw * q[0], P[0][1] + hw * q[1]]); }
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) strokeJoin(out, P[i], S[(i - 1 + ns) % ns], S[i % ns], hw, join, ml, tol);
  if (!closed) { const q = nrm(S[ns - 1]), e = P[n - 1]; out.push([e[0] + hw * q[0], e[1] + hw * q[1]]); }
  return { pts: out, dir: S[ns - 1] };
}
function strokeCap(out, p, d, hw, cap, tol) {
  const n = nrm(d);
  if (cap === 'square') { out.push([p[0] + hw * (n[0] + d.dx), p[1] + hw * (n[1] + d.dy)], [p[0] + hw * (-n[0] + d.dx), p[1] + hw * (-n[1] + d.dy)]); return; }
  if (cap !== 'round') return;
  const step = hw > tol ? 2 * Math.acos(1 - tol / hw) : Math.PI, m = Math.max(2, Math.ceil(Math.PI / step));
  for (let k = 1; k < m; k++) { const ang = -Math.PI * k / m, c = Math.cos(ang), s = Math.sin(ang); out.push([p[0] + hw * (n[0] * c - n[1] * s), p[1] + hw * (n[0] * s + n[1] * c)]); }
}
/* P: titik di ruang lokal. Hasil: { closed, rings:[...] } */
function strokePoly(P0, closed, w, cap, join, ml, tol) {
  const hw = w / 2, P = [];
  for (const p of P0) { const q = P[P.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9) P.push(p); }
  if (closed && P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 1e-9) P.pop();
  if (P.length === 0) return { closed: false, rings: [] };
  if (P.length === 1) {                              // titik tunggal: hanya tutup bulat atau kotak yang tampak
    const c = P[0];
    if (cap === 'round') { const step = hw > tol ? 2 * Math.acos(1 - tol / hw) : Math.PI, m = Math.max(8, Math.ceil(2 * Math.PI / step)); return { closed: false, rings: [Array.from({ length: m }, (_, i) => [c[0] + hw * Math.cos(2 * Math.PI * i / m), c[1] + hw * Math.sin(2 * Math.PI * i / m)])] }; }
    if (cap === 'square') return { closed: false, rings: [[[c[0] - hw, c[1] - hw], [c[0] + hw, c[1] - hw], [c[0] + hw, c[1] + hw], [c[0] - hw, c[1] + hw]]] };
    return { closed: false, rings: [] };
  }
  const R = P.slice().reverse();
  if (closed && P.length >= 2) {
    return { closed: true, area: area(P), rings: [strokeSide(P, true, hw, join, ml, tol).pts, strokeSide(R, true, hw, join, ml, tol).pts] };
  }
  const A = strokeSide(P, false, hw, join, ml, tol), B = strokeSide(R, false, hw, join, ml, tol), ring = A.pts.slice();
  strokeCap(ring, P[P.length - 1], A.dir, hw, cap, tol);
  for (const q of B.pts) ring.push(q);
  strokeCap(ring, P[0], B.dir, hw, cap, tol);
  return { closed: false, rings: [ring] };
}
/* garis putus-putus: potong polilinie jadi bagian "nyala" */
function dashPolys(P, closed, arr, off) {
  const pts = closed ? P.concat([P[0]]) : P;
  let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const sum = arr.reduce((s, v) => s + v, 0);
  if (!(total > 0) || !(sum > 0) || total / sum * arr.length > 8000) return null;
  let idx = 0, rem = arr[0], o = ((off % sum) + sum) % sum, guard = 0;
  while (o > 0 && guard++ < 1e5) { if (o >= rem) { o -= rem; idx++; rem = arr[idx % arr.length]; } else { rem -= o; o = 0; } }
  let on = idx % 2 === 0, cur = on ? [pts[0]] : null; const out = [];
  const flip = (p) => { if (on) { out.push(cur); cur = null; } else cur = [p]; on = !on; idx++; rem = arr[idx % arr.length]; };
  for (let g = 0; rem <= 1e-9 && g < 4; g++) flip(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(l > 0)) continue;
    let pos = 0;
    while (l - pos > rem + 1e-9) {
      pos += rem; const p = [a[0] + (b[0] - a[0]) * pos / l, a[1] + (b[1] - a[1]) * pos / l];
      if (on) cur.push(p); flip(p);
      for (let g = 0; rem <= 1e-9 && g < 4; g++) { if (on) cur.push(p); flip(p); }
    }
    rem -= l - pos;
    if (on) cur.push(b);
  }
  if (on && cur) out.push(cur);
  else if (!closed && !on && rem <= 1e-6 && arr[(idx + 1) % arr.length] === 0) out.push([pts[pts.length - 1]]);   // titik nol-panjang tepat di ujung
  if (closed && out.length > 1 && out[0][0] === pts[0] && out[out.length - 1][out[out.length - 1].length - 1] === pts[pts.length - 1]) {
    const last = out.pop(); out[0] = last.concat(out[0].slice(1));
  }
  return out.map((q) => ({ P: q, closed: false }));
}
/* semua bidang dari satu daun garis, sudah di ruang kanvas: [{outer, holes}] */
function strokePwhs(lf, o, tally) {
  const M = lf.m, sc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])), st = lf.stroke, res = [];
  if (!(sc > 1e-9)) return res;
  const tol = Math.max(1e-4, o.tol / sc), tp = (p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const fwd = (R) => R.map(tp);
  for (const s of lf.subs) {
    const P = flattenSub(s, IDM, tol);
    let parts = [{ P, closed: s.closed }];
    if (st.dash) { const d = dashPolys(P, s.closed, st.dash, st.dashOff); if (d) parts = d; else tally.dashSkip = (tally.dashSkip || 0) + 1; }
    for (const part of parts) {
      const r = strokePoly(part.P, part.closed, st.w, st.cap, st.join, st.ml, tol);
      if (!r.rings.length) continue;
      if (!r.closed) { for (const R of r.rings) { const C = cleanRing(fwd(R)); if (C.length >= 3) res.push({ outer: orient(C, 1), holes: [] }); } continue; }
      const sg = r.area >= 0 ? 1 : -1, A = r.rings[0], B = r.rings[1];
      const okA = (area(A) >= 0 ? 1 : -1) === sg, okB = (area(B) >= 0 ? -1 : 1) === sg;   // B ditelusuri terbalik
      const cand = [okA ? A : null, okB ? B : null].filter(Boolean);
      if (!cand.length) continue;
      cand.sort((p, q) => Math.abs(area(q)) - Math.abs(area(p)));
      const outer = cleanRing(fwd(cand[0])), inner = cand[1] ? cleanRing(fwd(cand[1])) : null;
      if (outer.length < 3) continue;
      if (inner && inner.length >= 3 && Math.abs(area(inner)) > 1e-6 && ringInside(inner, outer)) res.push({ outer: orient(outer, 1), holes: [orient(inner, -1)] });
      else res.push({ outer: orient(outer, 1), holes: [] });
    }
  }
  return res;
}

/* ---------- clip-path: gabungan bidang cembung ---------- */
function isConvex(R) {
  let s = 0;
  for (let i = 0, n = R.length; i < n; i++) {
    const a = R[i], b = R[(i + 1) % n], c = R[(i + 2) % n], z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) continue;
    if (!s) s = z > 0 ? 1 : -1; else if ((z > 0 ? 1 : -1) !== s) return false;
  }
  return true;
}
/* bidang cekung -> segitiga (ear clipping), lalu digabung selama masih cembung */
function convexParts(R0) {
  if (isConvex(R0)) return [R0];
  if (R0.length > 600) return null;
  const R = orient(R0, 1), idx = R.map((_, i) => i), tris = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p, a, b, c) => cross(a, b, p) >= -1e-9 && cross(b, c, p) >= -1e-9 && cross(c, a, p) >= -1e-9;
  let guard = 0;
  while (idx.length > 3 && guard++ < 20000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], a = R[i0], b = R[i1], c = R[i2];
      if (cross(a, b, c) <= 1e-9) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inTri(R[j], a, b, c))) continue;
      tris.push([a, b, c]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) return null;
  }
  if (idx.length === 3) tris.push([R[idx[0]], R[idx[1]], R[idx[2]]]);
  let parts = tris, merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const A = parts[i], B = parts[j];
      for (let p = 0; p < A.length; p++) {
        const a0 = A[p], a1 = A[(p + 1) % A.length];
        for (let q = 0; q < B.length; q++) {
          const b0 = B[q], b1 = B[(q + 1) % B.length];
          if (a0[0] === b1[0] && a0[1] === b1[1] && a1[0] === b0[0] && a1[1] === b0[1]) {
            const U = []; for (let k = 1; k <= A.length; k++) U.push(A[(p + k) % A.length]);
            for (let k = 2; k < B.length; k++) U.push(B[(q + k) % B.length]);
            const C = U.filter((pt, k) => Math.abs(cross(U[(k + U.length - 1) % U.length], pt, U[(k + 1) % U.length])) > 1e-9);
            if (C.length >= 3 && isConvex(C)) { parts.splice(j, 1); parts[i] = C; merged = true; break outer; }
          }
        }
      }
    }
  }
  return parts;
}

/* ---------- ukuran kanvas ---------- */
function intrinsic(svg) {
  const v = String(svg.a.viewBox || '').split(/[\s,]+/).filter(Boolean).map(parseFloat);
  if (v.length === 4 && v[2] > 0 && v[3] > 0) return { x: v[0], y: v[1], w: v[2], h: v[3] };
  const w = len(svg.a.width), h = len(svg.a.height);
  if (w > 0 && h > 0) return { x: 0, y: 0, w, h };
  return null;
}
function canvasSize(box, o) {
  if (o.canvas === 'custom' || /^\d+x\d+$/.test(String(o.canvas))) {
    let w, h;
    if (o.canvas === 'custom') { w = o.width; h = o.height; } else { const p = o.canvas.split('x'); w = +p[0]; h = +p[1]; }
    return { w: Math.max(16, Math.min(8192, Math.round(w))), h: Math.max(16, Math.min(8192, Math.round(h))), fit: true };
  }
  let w = box.w, h = box.h, s = 1;
  const big = Math.max(w, h);
  if (big < 512) s = 1080 / big; else if (big > 4096) s = 4096 / big;
  return { w: Math.max(16, Math.round(w * s)), h: Math.max(16, Math.round(h * s)), fit: false, s };
}

/* ---------- pembersih vektor dobel ---------- */
/* Dijalankan setelah semua layer jadi, sebelum XML ditulis. Tampilan akhir tidak berubah, hanya bentuk berlebih yang dibuang:
   1) titik kembar, titik sejajar, dan ujung "duri" tanpa lebar pada cincin; bidang kembar di satu layer
   2) layer opak yang bentuk dan warnanya persis sama (yang di bawah dibuang); layer transparan kembar yang bersebelahan digabung alfanya
   3) bidang yang tertutup penuh oleh satu bidang opak di atasnya
   4) bidang opak yang seluruhnya berada di dalam bidang sewarna di bawahnya tanpa ada warna lain di antaranya */
const TIDY_TOL = 5e-4;
const isOpaqueFill = (f) => String(f).slice(1, 3).toLowerCase() === 'ff';
function distLine(b, a, c) {
  const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy);
  if (l < 1e-9) return 0;                                  // a = c: b hanyalah ujung duri
  return Math.abs(dx * (b[1] - a[1]) - dy * (b[0] - a[0])) / l;
}
function tidyRing(P, tol) {
  const out = [], same = (p, q) => Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol;
  for (const p of P) {
    for (;;) {
      const n = out.length;
      if (n && same(out[n - 1], p)) break;
      if (n >= 2 && distLine(out[n - 1], out[n - 2], p) < tol) { out.pop(); continue; }
      out.push(p); break;
    }
  }
  for (let g = 0; g < 8 && out.length >= 3; g++) {
    const n = out.length;
    if (same(out[0], out[n - 1])) { out.pop(); continue; }
    if (distLine(out[n - 1], out[n - 2], out[0]) < tol) { out.pop(); continue; }
    if (distLine(out[0], out[n - 1], out[1]) < tol) { out.shift(); continue; }
    break;
  }
  return out.length >= 3 ? out : P;
}
const q2 = (v) => Math.round(v * 100);
function ringSig(R) {
  let P = R.map((p) => [q2(p[0]), q2(p[1])]);
  P = P.filter((p, i) => !i || p[0] !== P[i - 1][0] || p[1] !== P[i - 1][1]);
  while (P.length > 1 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P.pop();
  if (area(P) < 0) P.reverse();
  let s = 0;
  for (let i = 1; i < P.length; i++) if (P[i][0] < P[s][0] || (P[i][0] === P[s][0] && P[i][1] < P[s][1])) s = i;
  const t = []; for (let i = 0; i < P.length; i++) { const p = P[(s + i) % P.length]; t.push(p[0] + ',' + p[1]); }
  return t.join(' ');
}
const bbHas = (A, B, e) => A[0] <= B[0] + e && A[1] <= B[1] + e && A[2] >= B[2] - e && A[3] >= B[3] - e;
const bbHit = (A, B, e) => A[0] <= B[2] + e && A[2] >= B[0] - e && A[1] <= B[3] + e && A[3] >= B[1] - e;
/* beberapa titik yang pasti ada di dalam R (bukan di tepi), diambil dari garis mendatar yang memotong R */
function innerPoints(R, want) {
  const b = bboxOf(R), out = [], n = R.length;
  for (const f of [0.5, 0.37, 0.63, 0.25, 0.75, 0.43, 0.57]) {
    const y = b[1] + (b[3] - b[1]) * f, xs = [];
    for (let i = 0; i < n; i++) {
      const a = R[i], c = R[(i + 1) % n];
      if ((a[1] <= y) !== (c[1] <= y)) xs.push(a[0] + (y - a[1]) / (c[1] - a[1]) * (c[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1] - xs[k] < 1e-4) continue;
      const q = [(xs[k] + xs[k + 1]) / 2, y];
      if (pip(q, R) && !onBoundary(q, R, 1e-4)) { out.push(q); break; }
    }
    if (out.length >= want) break;
  }
  return out;
}
/* R seluruhnya berada di dalam (atau menempel di tepi) cincin H? Hati-hati: bila ragu, jawabannya tidak. */
function ringWithin(R, H, bg) {
  if (bg.n <= 0 || R.length * H.length > 400000) return false;
  bg.n -= R.length * H.length * 3;
  for (const p of R) if (!pip(p, H) && !onBoundary(p, H, 1e-3)) return false;
  for (let i = 0, n = R.length; i < n; i++) {
    const a = R[i], b = R[(i + 1) % n];
    for (let j = 0, m = H.length; j < m; j++) if (properCross(a, b, H[j], H[(j + 1) % m])) return false;
  }
  // lubang H (cincin berjembatan atau berputar ganda) yang seluruhnya ada di dalam R berarti R tidak tertutup penuh
  for (const q of H) if (pip(q, R) && !onBoundary(q, R, 1e-3)) return false;
  // semua titik sudut R boleh menempel di tepi H sementara isi R ada di luar H (mis. di dalam lubangnya), jadi isi R diperiksa juga
  const ip = innerPoints(R, 3);
  if (!ip.length) return false;
  for (const q of ip) if (!pip(q, H)) return false;
  return true;
}
function tidyLayers(layers, o, mode) {
  const st = { rings: 0, same: 0, hidden: 0, under: 0, pts: 0 };
  const bg = { n: mode === 'photo' ? 2e7 : 6e7 };
  const count = () => layers.reduce((s, l) => s + l.rings.reduce((a, r) => a + r.length, 0), 0);
  const p0 = count();
  // 1) cincin: titik berlebih dan bidang kembar dalam satu layer
  for (const L of layers) {
    const seen = new Set(), keep = [];
    for (const R0 of L.rings) {
      const R = mode === 'photo' || o.simp > 0 ? tidyRing(R0, TIDY_TOL) : R0;
      if (R.length < 3 || Math.abs(area(R)) <= 1e-3) { st.rings++; continue; }
      const k = ringSig(R);
      if (seen.has(k)) { st.rings++; continue; }
      seen.add(k); keep.push(R);
    }
    L.rings = keep;
  }
  const sigOf = (L) => L.rings.map(ringSig).sort().join('|');
  // 2) layer kembar: yang opak, yang di bawah dibuang; yang transparan bersebelahan digabung alfanya
  {
    const seen = new Set(), drop = new Set();
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i]; if (!L.rings.length || !isOpaqueFill(L.fill)) continue;
      const k = L.fill + '#' + sigOf(L);
      if (seen.has(k)) { drop.add(i); st.same++; } else seen.add(k);
    }
    if (drop.size) { const keep = layers.filter((l, i) => !drop.has(i)); layers.length = 0; keep.forEach((l) => layers.push(l)); }
    for (let i = layers.length - 1; i > 0; i--) {
      const a = layers[i - 1], b = layers[i];
      if (!a.rings.length || isOpaqueFill(a.fill) || isOpaqueFill(b.fill) || a.fill.slice(3).toLowerCase() !== b.fill.slice(3).toLowerCase()) continue;
      if (sigOf(a) !== sigOf(b)) continue;
      const al = 1 - (1 - parseInt(a.fill.slice(1, 3), 16) / 255) * (1 - parseInt(b.fill.slice(1, 3), 16) / 255);
      b.fill = '#' + hex2(ch8(al * 255)) + b.fill.slice(3);
      layers.splice(i - 1, 1); st.same++;
    }
  }
  // 3) bidang yang tertutup penuh oleh satu bidang opak di atasnya
  {
    const cov = [];
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i], keep = [];
      for (const R of L.rings) {
        const bb = bboxOf(R);
        if (cov.some((c) => bbHas(c.bb, bb, 1e-6) && ringWithin(R, c.R, bg))) st.hidden++; else keep.push(R);
      }
      L.rings = keep;
      if (isOpaqueFill(L.fill)) for (const R of keep) cov.push({ bb: bboxOf(R), R });
    }
  }
  // 4) bidang opak di dalam bidang sewarna yang ada di bawahnya, tanpa warna lain di antaranya
  {
    const LB = layers.map((L) => { let b = null; for (const R of L.rings) { const q = bboxOf(R); b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])] : q; } return b; });
    const RB = layers.map((L) => L.rings.map(bboxOf));
    const gone = layers.map((L) => new Set());
    for (let j = 0; j < layers.length; j++) {
      const Lj = layers[j]; if (!isOpaqueFill(Lj.fill)) continue;
      Lj.rings.forEach((U, u) => {
        const bu = RB[j][u];
        for (let i = j - 1; i >= 0 && bg.n > 0; i--) {
          const Li = layers[i]; if (!LB[i] || !bbHit(LB[i], bu, 1e-6)) continue;
          if (isOpaqueFill(Li.fill) && Li.fill === Lj.fill) {
            for (let h = 0; h < Li.rings.length; h++) if (!gone[i].has(h) && bbHas(RB[i][h], bu, 1e-6) && ringWithin(U, Li.rings[h], bg)) { gone[j].add(u); st.under++; return; }
            continue;
          }
          let blocked = false;
          for (let h = 0; h < Li.rings.length; h++) if (!gone[i].has(h) && bbHit(RB[i][h], bu, 1e-6)) { blocked = true; break; }
          if (blocked) return;
        }
      });
    }
    layers.forEach((L, j) => { if (gone[j].size) L.rings = L.rings.filter((R, u) => !gone[j].has(u)); });
  }
  // 5) layer kosong dibuang, nomor di nama layer dirapikan lagi
  { const keep = layers.filter((l) => l.rings.length); layers.length = 0; keep.forEach((l) => layers.push(l)); }
  const map = new Map(), cnt = {};
  for (const L of layers) {
    const m = /^(Objek|Garis|Warna) (\d+)(.*)$/.exec(L.label); if (!m) continue;
    const grp = mode === 'photo' ? m[1] : 'x', key = m[1] + ' ' + m[2];
    if (!map.has(key)) map.set(key, (cnt[grp] = (cnt[grp] || 0) + 1));
    L.label = m[1] + ' ' + map.get(key) + m[3];
  }
  layers.forEach((L, i) => { L.n = i + 1; });
  st.pts = Math.max(0, p0 - count());
  return st;
}
function tidyNote(st) {
  const bits = [];
  if (st.same) bits.push(st.same + ' layer kembar dibuang');
  if (st.hidden) bits.push(st.hidden + ' bidang yang tertutup penuh dibuang');
  if (st.under) bits.push(st.under + ' bidang sewarna yang menumpuk dibuang');
  if (st.rings) bits.push(st.rings + ' bidang kembar atau kosong dibuang');
  return bits.length ? 'Dirapikan otomatis, tampilannya tetap sama: ' + bits.join(', ') + '.' : '';
}

/* ---------- konversi utama ---------- */
function convert(text, opt) {
  const o = Object.assign({ title: 'svg', duration: 3, fps: 30, canvas: 'auto', width: 1080, height: 1080, holes: 'pecah', tol: 0.05, simp: 0.2, grad: 'sedang', tidy: true }, opt || {});
  const warns = [], warn = (m) => { if (warns.indexOf(m) < 0) warns.push(m); };
  const doc = readSVG(text, warn);
  let box = intrinsic(doc.svg);
  let pre = null;
  if (!box) {
    // tanpa viewBox dan tanpa ukuran: pakai kotak isi
    pre = collect(doc, IDM, () => {});
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const lf of pre) for (const s of lf.subs) for (const p of flattenSub(s, lf.m, 0.5)) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    if (!(x1 > x0 && y1 > y0)) throw new Error('SVG ini tidak punya bentuk berisi warna yang bisa dikonversi.');
    box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    warn('SVG tidak punya viewBox atau ukuran, jadi kanvas mengikuti ukuran isinya.');
  }
  const cs = canvasSize(box, o);
  const sc = cs.fit ? Math.min(cs.w / box.w, cs.h / box.h) : cs.w / box.w;
  const base = [sc, 0, 0, sc, (cs.w - box.w * sc) / 2 - box.x * sc, (cs.h - box.h * sc) / 2 - box.y * sc];
  const leaves = collect(doc, base, warn);

  const layers = [], gradLeaves = [];
  const gmode = o.grad === 'rata' || o.grad === 'rendah' || o.grad === 'tinggi' ? o.grad : 'sedang', GQ = GRAD_Q[gmode] || GRAD_Q.sedang;
  const tally = { crossed: 0, self: 0, fallback: 0, many: 0 };
  let objek = 0, rawPts = 0;
  for (const lf of leaves) {
    let pwhs;
    if (lf.stroke) pwhs = strokePwhs(lf, o, tally);
    else {
      const rings = [];
      for (const s of lf.subs) { const R0 = cleanRing(flattenSub(s, lf.m, o.tol)); if (R0.length >= 3) { rawPts += R0.length; rings.push(thinRing(R0, o.simp)); } }
      if (!rings.length) continue;
      const info = {};
      pwhs = buildPWH(rings, lf.rule, info);
      if (info.crossed) tally.crossed++;
      if (info.self) tally.self++;
    }
    if (!pwhs.length) continue;
    const opaque = lf.alpha * lf.col.a >= 0.999;
    const pieces = [];
    for (const p of pwhs) {
      if (!p.holes.length) { pieces.push(p.outer); continue; }
      if (o.holes === 'jembatan') {
        const b = bridgeAll(p.outer, p.holes);
        pieces.push(b.ring); if (b.bad.length) tally.fallback++;
        continue;
      }
      try { for (const r of splitSlabs(p, opaque ? OVERLAP : 0)) pieces.push(r); }
      catch (e) { const b = bridgeAll(p.outer, p.holes); pieces.push(b.ring); tally.fallback++; }
    }
    let fin = [];
    for (const R of pieces) { const C = cleanRing(R); if (C.length >= 3 && Math.abs(area(C)) > 1e-3) fin.push(C); }
    if (fin.length && lf.clips && lf.clips.length) fin = applyClips(fin, lf.clips);
    if (!fin.length) continue;
    objek++;
    lf.fin = fin; lf.n = objek;
    if (lf.grad && gmode !== 'rata') {
      let bb = null;
      if (lf.grad.units === 'bbox') {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const s of lf.subs) for (const pt of flattenSub(s, IDM, 0.5)) { x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]); }
        if (x1 > x0 && y1 > y0) bb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      } else bb = { x: 0, y: 0, w: 1, h: 1 };
      const fld = bb && gradField(lf.grad, lf.m, bb);
      if (fld) { const rg = tRange(lf.grad, fld, fin); if (rg[1] > rg[0]) { lf.fld = fld; lf.rg = rg; gradLeaves.push(lf); } }
    }
    layers.push({ n: objek, label: (lf.stroke ? 'Garis ' : 'Objek ') + objek, fill: argb(lf.col, lf.alpha), rings: fin, on: true, lf });
  }
  // gradasi: rencanakan pita warna, hemat bila totalnya terlalu banyak
  let gradLayers = 0, gradShapes = 0, gradFlat = 0, gradTrans = 0;
  if (gradLeaves.length) {
    let mult = 1, plans;
    for (let it = 0; it < 12; it++) {
      let tot = 0;
      plans = gradLeaves.map((lf) => { const pl = planBands(lf.grad, lf.rg[0], lf.rg[1], lf.fld.unitPx, GQ, mult); if (pl) tot += pl.length; return pl; });
      if (tot <= GRAD_BUDGET) break;
      mult *= Math.max(1.25, tot / GRAD_BUDGET);
    }
    if (mult > 1) warn('Gradasi banyak sekali, jadi pitanya dikurangi agar hasilnya tidak berat. Pilih bagian gradasi lain atau kurangi bentuk bila ingin lebih halus.');
    gradLeaves.forEach((lf, gi) => {
      const bands = plans[gi], sp = lf.grad, fld = lf.fld, fin = lf.fin;
      const ly = layers.find((l) => l.lf === lf);
      if (!bands || bands.length < 2) {
        if (bands && bands.length === 1) { ly.fill = argb(bands[0].c, lf.alpha); }
        gradFlat++; return;
      }
      const trans = bands.some((b) => b.c.a * lf.alpha < 0.999);
      if (trans && sp.radial) { gradTrans++; return; }
      const out = [];
      const add = (b, rings, k) => { if (rings.length) out.push({ n: lf.n, label: (lf.stroke ? 'Garis ' : 'Objek ') + lf.n + ' \u00b7 gradasi ' + (k + 1), fill: argb(b.c, lf.alpha), rings, on: true }); };
      const N = bands.length;
      if (!sp.radial) {
        for (let k = 0; k < N; k++) {
          let rs = fin;
          if (k > 0) rs = clipRings(rs, (p) => fld.t(p) - bands[k].a);
          if (trans && k < N - 1) rs = clipRings(rs, (p) => bands[k].b - fld.t(p));
          add(bands[k], rs, k);
        }
      } else {
        for (let j = N - 1; j >= 0; j--) add(bands[j], j === N - 1 ? fin : clipDisc(fin, discPoly(sp, fld, bands[j].b)), j);
      }
      if (!out.length) { gradFlat++; return; }
      const at = layers.indexOf(ly);
      layers.splice(at, 1, ...out);
      gradShapes++; gradLayers += out.length;
    });
  }
  layers.forEach((l) => { delete l.lf; });
  let tidySt = null;
  if (o.tidy !== false) { tidySt = tidyLayers(layers, o, 'svg'); const tn = tidyNote(tidySt); if (tn) warn(tn); }
  if (gradShapes) warn('Gradasi pada ' + gradShapes + ' bentuk dibuat dari ' + gradLayers + ' lapisan pita warna bertumpuk, jadi warnanya mengikuti SVG. Bila terasa berat di Alight Motion, pilih gradasi Ringan.');
  if (gradTrans) warn('Gradasi radial yang transparan pada ' + gradTrans + ' bentuk belum bisa dipecah tanpa tumpang tindih, jadi dipakai satu warna rata-rata. Gradasi linear transparan tetap dibuat per pita.');
  if (gmode === 'rata' && leaves.grads) warn('Gradasi diganti satu warna rata-rata pada ' + leaves.grads + ' bentuk (mode Warna rata-rata).');
  if (!layers.length) throw new Error('SVG ini tidak punya bentuk berisi warna atau garis yang bisa dikonversi. Pastikan bentuknya punya fill atau stroke (bukan hanya teks).');
  if (tally.crossed) warn('Ada ' + tally.crossed + ' bentuk dengan bagian yang saling menimpa. Tiap bagian dijadikan bidang sendiri, hasilnya bisa berbeda dari SVG bila fill-rule evenodd atau arah putarnya berlawanan.');
  if (tally.self) warn('Ada ' + tally.self + ' bentuk yang garisnya menyilang diri sendiri. Periksa hasilnya di preview.');
  if (tally.dashSkip) warn('Garis putus-putus pada ' + tally.dashSkip + ' bentuk terlalu rapat (lebih dari 8.000 potongan), jadi dibuat sebagai garis utuh.');
  if (tally.fallback) warn('Ada ' + tally.fallback + ' bentuk berlubang yang dikerjakan dengan metode jembatan karena pemecahan per bidang gagal.');
  const total = layers.reduce((s, l) => s + l.rings.length, 0);
  if (o.holes !== 'jembatan' && total > 400) warn('Hasilnya ' + total + ' bidang. Bila terasa berat di Alight Motion, coba metode Jembatan (1 layer per bentuk).');

  const model = { title: o.title, width: cs.w, height: cs.h, totalTime: Math.max(100, Math.round(o.duration * 1000)), fps: Math.max(1, Math.round(o.fps)), layers };
  let pts = 0; layers.forEach((l) => l.rings.forEach((r) => { pts += r.length; }));
  const un = ['teks', 'gambar', 'pola', 'clip', 'mask', 'filter'].filter((k) => leaves.cnt && leaves.cnt[k]);
  return { model, warnings: warns, unsupported: un, stats: { layers: layers.length, pieces: total, points: pts, rawPoints: rawPts, width: cs.w, height: cs.h, tidy: tidySt } };
}

/* ---------- penulis XML (mengikuti contoh malik-logo.xml persis) ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function pathD(R, ox, oy) {
  const q = R.map((p) => [num(p[0] - ox), num(p[1] - oy)]);
  q.push(q[0]);
  return 'M ' + q[0][0] + ' ' + q[0][1] + q.slice(1).map((p) => 'L ' + p[0] + ' ' + p[1]).join('') + 'Z';
}
function toXML(model, opt) {
  const o = Object.assign({ comment: 'Created by Malik Tools\nBased on observed Alight Motion XML export structure' }, opt || {});
  const W = model.width, H = model.height, T = model.totalTime, CX = W / 2, CY = H / 2;
  const sceneAttrs = (title, retime) => 'title="' + esc(title) + '" width="' + W + '" height="' + H + '" exportWidth="' + W + '" exportHeight="' + H + '" precompose="dynamicResolution" bgcolor="#00000000" totalTime="' + T + '" fps="' + model.fps + '" modifiedTime="0" amver="' + AM.amver + '" ffver="' + AM.ffver + '" am="' + AM.am + '" amplatform="' + AM.amplatform + '" retime="' + retime + '" retimeAdaptFPS="false"';
  let id = 100000000;
  const L = [];
  L.push("<?xml version='1.0' encoding='UTF-8' ?>", '<!--', o.comment, '-->');
  L.push('<scene ' + sceneAttrs(model.title, 'freeze') + '>');
  L.push('  <embedScene id="' + (id++) + '" label="' + esc(model.title) + '" startTime="0" endTime="' + T + '" outTime="' + T + '" fillType="intrinsic" mediaFillMode="fill">');
  L.push('    <transform>', '      <location value="' + num(CX) + ',' + num(CY) + ',0" />', '    </transform>');
  L.push('    <fillColor value="#ff000000" />');
  L.push('    <scene ' + sceneAttrs('', 'off') + '>');
  const shape = (ind, label, fill, lx, ly, d) => {
    const p = ' '.repeat(ind);
    L.push(p + '<shape id="' + (id++) + '" label="' + esc(label) + '" startTime="0" endTime="' + T + '" fillType="color" mediaFillMode="fill">');
    L.push(p + '  <transform>', p + '    <location value="' + num(lx) + ',' + num(ly) + ',0" />', p + '  </transform>');
    L.push(p + '  <fillColor value="' + fill + '" />', p + '  <path d="' + d + '" />', p + '</shape>');
  };
  for (const ly of model.layers) {
    if (ly.on === false) continue;
    if (ly.rings.length === 1) {
      const bb = bboxOf(ly.rings[0]), cx = r4((bb[0] + bb[2]) / 2), cy = r4((bb[1] + bb[3]) / 2);
      shape(6, ly.label, ly.fill, cx, cy, pathD(ly.rings[0], cx, cy));
      continue;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const R of ly.rings) { const b = bboxOf(R); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const gx = r4((x0 + x1) / 2), gy = r4((y0 + y1) / 2);
    L.push('      <embedScene id="' + (id++) + '" label="' + esc(ly.label) + '" startTime="0" endTime="' + T + '" outTime="' + T + '" fillType="intrinsic" mediaFillMode="fill">');
    L.push('        <transform>', '          <location value="' + num(gx) + ',' + num(gy) + ',0" />', '        </transform>');
    L.push('        <fillColor value="#ff000000" />');
    L.push('        <scene ' + sceneAttrs('', 'off') + '>');
    ly.rings.forEach((R, k) => shape(10, ly.label + ' \u00b7 bidang ' + (k + 1), ly.fill, 2 * CX - gx, 2 * CY - gy, pathD(R, CX, CY)));
    L.push('        </scene>', '      </embedScene>');
  }
  L.push('    </scene>', '  </embedScene>', '</scene>');
  return L.join('\n') + '\n';
}

/* ---------- pratinjau di kanvas ---------- */
function draw(ctx, model, scale) {
  ctx.save();
  ctx.scale(scale, scale);
  for (const ly of model.layers) {
    if (ly.on === false) continue;
    const a = parseInt(ly.fill.slice(1, 3), 16) / 255;
    ctx.fillStyle = 'rgba(' + parseInt(ly.fill.slice(3, 5), 16) + ',' + parseInt(ly.fill.slice(5, 7), 16) + ',' + parseInt(ly.fill.slice(7, 9), 16) + ',' + a + ')';
    for (const R of ly.rings) {
      ctx.beginPath();
      R.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill('nonzero');
    }
  }
  ctx.restore();
}

const SAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#12161c"/><path fill="#4fd69a" fill-rule="evenodd" d="M256 64a192 192 0 1 0 0 384a192 192 0 1 0 0-384zM256 144a112 112 0 1 1 0 224a112 112 0 1 1 0-224z"/><path fill="#ffc83d" d="M256 190l20 42 46 6-34 32 9 46-41-23-41 23 9-46-34-32 46-6z"/></svg>';

/* ---------- foto (raster) ke bidang berwarna: kuantisasi warna + kontur bertumpuk ---------- */
/* Cara kerja: foto dihaluskan (bilateral), warnanya dikelompokkan jadi K warna (k-means di ruang Lab),
   bercak kecil dirapikan, lalu tiap warna dibuat satu layer BERTUMPUK: layer ke-i berisi semua piksel
   berwarna ke-i dan warna yang lebih kecil di atasnya. Karena bertumpuk, tidak ada celah antar warna
   dan lubang jauh lebih sedikit. Kontur diambil dengan marching squares (halus sampai sub-piksel). */
const PHOTO_DETAIL = {
  rendah: { side: 512, tol: 0.4, sm: 2.6, speck: 15000, sigma: 26 },
  sedang: { side: 768, tol: 0.28, sm: 2.2, speck: 40000, sigma: 20 },
  tinggi: { side: 1024, tol: 0.22, sm: 1.8, speck: 90000, sigma: 14 }
};

function srgbToLab(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = f(r), G = f(g), B = f(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B, Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = h(X), fy = h(Y), fz = h(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* penghalus yang menjaga tepi: bercak JPEG hilang, garis tegas tetap */
function bilateral(src, w, h, sigmaR) {
  const out = new Uint8ClampedArray(src);
  const R = 2, sp = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) sp.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * 1.6 * 1.6))]);
  const lut = new Float32Array((3 * 255 * 255 >> 3) + 2), k = 1 / (2 * sigmaR * sigmaR);
  for (let i = 0; i < lut.length; i++) lut[i] = Math.exp(-(i * 8) * k);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (src[p + 3] < 128) continue;
    const r0 = src[p], g0 = src[p + 1], b0 = src[p + 2];
    let sr = 0, sg = 0, sb = 0, sw = 0;
    for (let t = 0; t < sp.length; t++) {
      const xx = x + sp[t][0], yy = y + sp[t][1];
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = (yy * w + xx) * 4;
      if (src[q + 3] < 128) continue;
      const dr = src[q] - r0, dg = src[q + 1] - g0, db = src[q + 2] - b0;
      const wt = sp[t][2] * lut[(dr * dr + dg * dg + db * db) >> 3];
      sr += src[q] * wt; sg += src[q + 1] * wt; sb += src[q + 2] * wt; sw += wt;
    }
    out[p] = sr / sw; out[p + 1] = sg / sw; out[p + 2] = sb / sw;
  }
  return out;
}

/* piksel di tepi tegas (garis tipis, kontur) diberi bobot lebih supaya warna garisnya ikut jadi layer sendiri */
const EDGE_T = 40;
function edgeWeights(px, w, h, boost) {
  const N = w * h, Y = new Float32Array(N), out = new Float32Array(N).fill(1);
  for (let i = 0; i < N; i++) Y[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  if (!(boost > 0)) return out;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x, c = Y[p];
    const g = Math.max(Math.abs(c - Y[p - 1]), Math.abs(c - Y[p + 1]), Math.abs(c - Y[p - w]), Math.abs(c - Y[p + w]));
    out[p] = 1 + boost * Math.min(1, g / (EDGE_T));
  }
  return out;
}

/* k-means berbobot pada histogram warna (6 bit per kanal), awal deterministik (titik terjauh) */
function quantize(px, N, K, wgt, merge) {
  const SH = 2, hist = new Float64Array(1 << 18), map = new Int32Array(1 << 18).fill(-1);
  const sr = new Float64Array(1 << 18), sg = new Float64Array(1 << 18), sb = new Float64Array(1 << 18);
  const binOf = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (px[i * 4 + 3] < 128) continue;
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], bi = ((r >> SH) << 12) | ((g >> SH) << 6) | (b >> SH);
    const wt = wgt ? wgt[i] : 1;
    binOf[i] = bi; hist[bi] += wt; sr[bi] += r * wt; sg[bi] += g * wt; sb[bi] += b * wt;
  }
  const ids = []; for (let bi = 0; bi < hist.length; bi++) if (hist[bi] > 0) { map[bi] = ids.length; ids.push(bi); }
  const nb = ids.length;
  if (!nb) return null;
  const L = new Float64Array(nb), A = new Float64Array(nb), B = new Float64Array(nb), Wt = new Float64Array(nb);
  for (let j = 0; j < nb; j++) { const bi = ids[j], c = hist[bi], lab = srgbToLab(sr[bi] / c, sg[bi] / c, sb[bi] / c); L[j] = lab[0]; A[j] = lab[1]; B[j] = lab[2]; Wt[j] = c; }
  const k = Math.min(K, nb), cen = [];
  let first = 0; for (let j = 1; j < nb; j++) if (Wt[j] > Wt[first]) first = j;
  cen.push([L[first], A[first], B[first]]);
  const md = new Float64Array(nb).fill(Infinity);
  while (cen.length < k) {
    const c = cen[cen.length - 1];
    let best = -1, bs = 0;
    for (let j = 0; j < nb; j++) {
      const d = (L[j] - c[0]) ** 2 + (A[j] - c[1]) ** 2 + (B[j] - c[2]) ** 2;
      if (d < md[j]) md[j] = d;
      const s = md[j] * Math.pow(Wt[j], 0.6);
      if (s > bs) { bs = s; best = j; }
    }
    if (best < 0) break;
    cen.push([L[best], A[best], B[best]]);
  }
  const lab = new Int16Array(nb);
  for (let it = 0; it < 14; it++) {
    let moved = 0;
    for (let j = 0; j < nb; j++) {
      let bd = Infinity, bc = 0;
      for (let c = 0; c < cen.length; c++) { const d = (L[j] - cen[c][0]) ** 2 + (A[j] - cen[c][1]) ** 2 + (B[j] - cen[c][2]) ** 2; if (d < bd) { bd = d; bc = c; } }
      if (lab[j] !== bc || it === 0) { if (lab[j] !== bc) moved++; lab[j] = bc; }
    }
    const s = cen.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < nb; j++) { const q = s[lab[j]]; q[0] += L[j] * Wt[j]; q[1] += A[j] * Wt[j]; q[2] += B[j] * Wt[j]; q[3] += Wt[j]; }
    s.forEach((q, c) => { if (q[3] > 0) cen[c] = [q[0] / q[3], q[1] / q[3], q[2] / q[3]]; });
    if (!moved && it > 0) break;
  }
  // gabungkan klaster yang warnanya nyaris sama (selisih Lab < merge): mencegah satu warna terpecah jadi bercak-bercak
  let remap = null, count = cen.length;
  if (merge > 0 && cen.length > 1) {
    const wt = cen.map(() => 0); for (let j = 0; j < nb; j++) wt[lab[j]] += Wt[j];
    const tot = wt.reduce((a, b) => a + b, 0) || 1, top3 = wt.slice().sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / tot;
    const thr = top3 > 0.9 ? Math.max(merge, 14) : merge * 0.45;   // line art / logo: gabung kuat; foto: gabung ringan
    const alive = cen.map((_, i) => i), par = cen.map((_, i) => i), m2 = thr * thr;
    for (;;) {
      let bi = -1, bj = -1, bd = Infinity;
      for (let x = 0; x < alive.length; x++) for (let y = x + 1; y < alive.length; y++) {
        const a = cen[alive[x]], b = cen[alive[y]], d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (d < bd) { bd = d; bi = x; bj = y; }
      }
      if (bd >= m2 || bi < 0) break;
      const a = alive[bi], b = alive[bj], tw = wt[a] + wt[b] || 1;
      cen[a] = [0, 1, 2].map((k) => (cen[a][k] * wt[a] + cen[b][k] * wt[b]) / tw);
      wt[a] = tw; par[b] = a; alive.splice(bj, 1);
    }
    const id = new Int16Array(cen.length).fill(-1); alive.forEach((c, i) => { id[c] = i; });
    const root = (c) => { while (par[c] !== c) c = par[c]; return c; };
    remap = new Int16Array(cen.length); for (let c = 0; c < cen.length; c++) remap[c] = id[root(c)];
    count = alive.length;
  }
  const out = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (binOf[i] >= 0) { const l = lab[map[binOf[i]]]; out[i] = remap ? remap[l] : l; }
  return { lab: out, count };
}

/* bercak yang lebih kecil dari minArea dilebur ke tetangga yang paling banyak bersentuhan.
   Konektivitas 8 arah dan bercak memanjang (garis tipis) dipertahankan supaya garis diagonal tidak hilang. */
function cleanSpecks(lab, w, h, minArea) {
  const N = w * h, DX = [-1, 1, 0, 0, -1, 1, -1, 1], DY = [0, 0, -1, 1, -1, -1, 1, 1];
  for (let pass = 0; pass < 3; pass++) {
    const comp = new Int32Array(N).fill(-1), order = new Int32Array(N), start = [], size = [], ext = [];
    let top = 0, nc = 0;
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0 || lab[s] < 0) continue;
      const Lb = lab[s], c = nc++, st = top;
      let x0 = w, x1 = 0, y0 = h, y1 = 0;
      comp[s] = c; order[top++] = s;
      for (let q = st; q < top; q++) {
        const p = order[q], x = p % w, y = (p - x) / w;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let k = 0; k < 8; k++) {
          const xx = x + DX[k], yy = y + DY[k];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const n = yy * w + xx;
          if (comp[n] < 0 && lab[n] === Lb) { comp[n] = c; order[top++] = n; }
        }
      }
      start.push(st); size.push(top - st); ext.push(Math.max(x1 - x0, y1 - y0) + 1);
    }
    const small = []; for (let c = 0; c < nc; c++) if (size[c] < minArea && ext[c] < 10) small.push(c);
    if (!small.length) return;
    small.sort((a, b) => size[a] - size[b]);
    const cnt = new Map(); let changed = 0;
    for (const c of small) {
      cnt.clear();
      const st = start[c], en = st + size[c], own = lab[order[st]];
      for (let q = st; q < en; q++) {
        const p = order[q], x = p % w, y = (p - x) / w;
        for (let k = 0; k < 4; k++) {
          const xx = x + DX[k], yy = y + DY[k];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const l = lab[yy * w + xx];
          if (l >= 0 && l !== own) cnt.set(l, (cnt.get(l) || 0) + 1);
        }
      }
      let best = -1, bn = 0; for (const [l, n] of cnt) if (n > bn) { bn = n; best = l; }
      if (best < 0) continue;
      for (let q = st; q < en; q++) lab[order[q]] = best;
      changed++;
    }
    if (!changed) return;
  }
}

/* marching squares: topeng 0/1 -> daftar kontur tertutup (piksel kerja). Kontur luar berputar positif, lubang negatif. */
function blurMask(mask, w, h, sig, out, tmp) {
  const rad = Math.max(1, Math.ceil(sig * 2.6)), K = new Float32Array(2 * rad + 1); let sk = 0;
  for (let k = -rad; k <= rad; k++) { const v = Math.exp(-(k * k) / (2 * sig * sig)); K[k + rad] = v; sk += v; }
  for (let k = 0; k < K.length; k++) K[k] /= sk;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let k = -rad; k <= rad; k++) { let xx = x + k; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; a += mask[o + xx] * K[k + rad]; }
      tmp[o + x] = a;
    }
  }
  const NX = w + 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let k = -rad; k <= rad; k++) { let yy = y + k; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; a += tmp[yy * w + x] * K[k + rad]; }
    out[(y + 1) * NX + x + 1] = a;
  }
}
/* marching squares pada medan hasil blur Gaussian topeng 0/1: kontur sub-piksel yang mulus dan konsisten antar layer. */
function contours(mask, w, h, S, lv, sig) {
  const NX = w + 2, NY = h + 2, f = S.f, nxt = S.nxt, T = lv || 0.5, SAD = T * 0.7;
  f.fill(0);
  if (!S.tmp || S.tmp.length < w * h) S.tmp = new Float32Array(w * h);
  blurMask(mask, w, h, sig || 1.1, f, S.tmp);
  const starts = [];
  const link = (a, b) => { nxt[a] = b; starts.push(a); };
  for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
    const a = f[j * NX + i], b = f[j * NX + i + 1], c = f[(j + 1) * NX + i + 1], d = f[(j + 1) * NX + i];
    const cs = (a >= T ? 8 : 0) | (b >= T ? 4 : 0) | (c >= T ? 2 : 0) | (d >= T ? 1 : 0);
    if (cs === 0 || cs === 15) continue;
    const eT = 2 * (j * NX + i), eB = 2 * ((j + 1) * NX + i), eL = 2 * (j * NX + i) + 1, eR = 2 * (j * NX + i + 1) + 1;
    switch (cs) {
      case 1: link(eL, eB); break;
      case 2: link(eB, eR); break;
      case 3: link(eL, eR); break;
      case 4: link(eR, eT); break;
      case 5: if ((a + b + c + d) / 4 >= SAD) { link(eL, eT); link(eR, eB); } else { link(eR, eT); link(eL, eB); } break;
      case 6: link(eB, eT); break;
      case 7: link(eL, eT); break;
      case 8: link(eT, eL); break;
      case 9: link(eT, eB); break;
      case 10: if ((a + b + c + d) / 4 >= SAD) { link(eT, eR); link(eB, eL); } else { link(eT, eL); link(eB, eR); } break;
      case 11: link(eT, eR); break;
      case 12: link(eR, eL); break;
      case 13: link(eR, eB); break;
      case 14: link(eB, eL); break;
    }
  }
  const pt = (e) => {
    const id = e >> 1, i = id % NX, j = (id / NX) | 0;
    if (!(e & 1)) { const fa = f[id], fb = f[id + 1]; return [i + (T - fa) / (fb - fa) - 0.5, j - 0.5]; }
    const fa = f[id], fb = f[id + NX]; return [i - 0.5, j + (T - fa) / (fb - fa) - 0.5];
  };
  const loops = [];
  for (const s of starts) {
    if (nxt[s] < 0) continue;
    const pts = []; let e = s, g = 0;
    do { pts.push(pt(e)); const n = nxt[e]; nxt[e] = -1; e = n; } while (e !== s && e >= 0 && ++g < 4e6);
    if (pts.length >= 3 && e === s) loops.push(pts);
  }
  for (const s of starts) nxt[s] = -1;
  return loops;
}

function smoothRing(P, it) {
  for (let k = 0; k < it; k++) {
    const n = P.length, Q = new Array(n);
    for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n]; Q[i] = [0.25 * a[0] + 0.5 * b[0] + 0.25 * c[0], 0.25 * a[1] + 0.5 * b[1] + 0.25 * c[1]]; }
    P = Q;
  }
  return P;
}
/* merapikan kontur: sampel ulang dengan jarak seragam (titik tidak menumpuk), haluskan dengan gaussian sepanjang kontur
   (gerigi piksel hilang, lengkung jadi mulus), lalu sederhanakan dengan toleransi kecil. */
function resampleRing(P, step) {
  const n = P.length; let L = 0; const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum[i + 1] = L; }
  const m = Math.max(8, Math.round(L / step)), out = new Array(m); let j = 0;
  for (let k = 0; k < m; k++) {
    const d = (k / m) * L;
    while (j < n - 1 && cum[j + 1] < d) j++;
    const a = P[j], b = P[(j + 1) % n], seg = cum[j + 1] - cum[j], t = seg > 0 ? (d - cum[j]) / seg : 0;
    out[k] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  return out;
}
function gaussRing(P, sigma) {
  const n = P.length, rad = Math.min(Math.ceil(sigma * 3), (n >> 1) - 1);
  if (rad < 1) return P;
  const wk = []; let sw = 0;
  for (let k = -rad; k <= rad; k++) { const v = Math.exp(-(k * k) / (2 * sigma * sigma)); wk.push(v); sw += v; }
  const Q = new Array(n);
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0;
    for (let k = -rad; k <= rad; k++) { const q = P[(i + k + n * 4) % n], v = wk[k + rad]; x += q[0] * v; y += q[1] * v; }
    Q[i] = [x / sw, y / sw];
  }
  return Q;
}
/* sudut tajam (mis. pertemuan dua bentuk) ditandai supaya tidak ikut membulat saat dihaluskan */
function findCorners(R, k, ang) {
  const n = R.length, c = [];
  const turn = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = R[(i - k + n) % n], b = R[i], d = R[(i + k) % n];
    const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = d[0] - b[0], v2y = d[1] - b[1];
    const l = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    turn[i] = l > 0 ? Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / l))) : 0;
  }
  const th = ang * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    if (turn[i] < th) continue;
    let ok = true;
    for (let j = -k; j <= k && ok; j++) if (j && turn[(i + j + n) % n] > turn[i]) ok = false;
    if (ok) c.push(i);
  }
  return c;
}
function gaussOpen(P, sigma) {
  const n = P.length, rad = Math.min(Math.ceil(sigma * 3), n - 1);
  if (rad < 1 || n < 3) return P;
  const wk = []; let sw = 0;
  for (let k = -rad; k <= rad; k++) { const v = Math.exp(-(k * k) / (2 * sigma * sigma)); wk.push(v); sw += v; }
  const at = (i) => {
    if (i < 0) return [2 * P[0][0] - P[Math.min(-i, n - 1)][0], 2 * P[0][1] - P[Math.min(-i, n - 1)][1]];
    if (i >= n) { const j = Math.max(2 * (n - 1) - i, 0); return [2 * P[n - 1][0] - P[j][0], 2 * P[n - 1][1] - P[j][1]]; }
    return P[i];
  };
  const Q = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) { Q[i] = P[i]; continue; }
    let x = 0, y = 0;
    for (let k = -rad; k <= rad; k++) { const q = at(i + k), v = wk[k + rad]; x += q[0] * v; y += q[1] * v; }
    Q[i] = [x / sw, y / sw];
  }
  return Q;
}
function refineRing(P, tol, sigma, adapt) {
  if (P.length < 12) return simplifyRing(P, tol);
  const A = area(P);
  let R = resampleRing(P, 1);
  const n = R.length;
  // bentuk besar dihaluskan lebih kuat (goyangan tangan hilang), bentuk kecil tetap rinci
  const sg = adapt ? Math.max(sigma, Math.min(12, n / 70)) : sigma;
  const corners = findCorners(R, Math.max(3, Math.round(sg * 0.8)), adapt ? 38 : 60);
  if (corners.length >= 2) {
    const out = [];
    for (let c = 0; c < corners.length; c++) {
      const s = corners[c], e = corners[(c + 1) % corners.length], seg = [];
      for (let i = s; ; i = (i + 1) % n) { seg.push(R[i]); if (i === e) break; }
      const sm = gaussOpen(gaussOpen(seg, sg), sg * 0.6);
      for (let i = 0; i < sm.length - 1; i++) out.push(sm[i]);
    }
    R = out;
  } else {
    R = gaussRing(gaussRing(R, sg), sg * 0.6);
  }
  const A2 = area(R);
  if (A2 !== 0 && A / A2 > 0 && Math.abs(A) > 40) {
    let cx = 0, cy = 0; for (const p of R) { cx += p[0]; cy += p[1]; } cx /= R.length; cy /= R.length;
    const k = Math.min(1.02, Math.sqrt(A / A2));
    if (isFinite(k) && k > 1) R = R.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
  }
  return simplifyRing(R, tol);
}
function simplifyRing(P, tol) {
  const n = P.length;
  if (n < 6) return P;
  let far = 1, fd = -1;
  for (let i = 1; i < n; i++) { const d = (P[i][0] - P[0][0]) ** 2 + (P[i][1] - P[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = 1; keep[far] = 1;
  const st = [[0, far], [far, n]], t2 = tol * tol;
  while (st.length) {
    const [a, b] = st.pop(), A = P[a], B = P[b % n], dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const p = P[i]; let d;
      if (l2 === 0) d = (p[0] - A[0]) ** 2 + (p[1] - A[1]) ** 2;
      else { const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2)), qx = A[0] + t * dx - p[0], qy = A[1] + t * dy - p[1]; d = qx * qx + qy * qy; }
      if (d > md) { md = d; mi = i; }
    }
    if (md > t2 && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(P[i]);
  return out;
}

/* garis tipis: piksel yang jadi lembah gelap sempit (lebar 1 sampai 2 px) dibanding sekitarnya.
   Garis 1 px hasil antialias sering terputus-putus kalau hanya mengandalkan pengelompokan warna. */
/* v496: perapihan titik hasil foto. Titik yang menumpuk di sudut/ujung lancip digabung jadi satu (diambil yang paling runcing),
   lalu titik di sisi lurus dibuang. Toleransi dalam piksel foto; dibatasi relatif terhadap ukuran bentuk supaya bentuk kecil tetap rinci. */
function mergeNear(R, r) {
  let P = R.slice();
  for (let pass = 0; pass < 3 && P.length > 3; pass++) {
    const n = P.length, r2 = r * r, grp = new Int32Array(n).fill(-1);
    let g = 0, changed = false;
    for (let i = 0; i < n; i++) {
      if (grp[i] >= 0) continue;
      grp[i] = g; let j = i;
      while (j + 1 < n && (P[j + 1][0] - P[j][0]) ** 2 + (P[j + 1][1] - P[j][1]) ** 2 <= r2) { j++; grp[j] = g; }
      g++;
    }
    if (g > 1 && grp[n - 1] === g - 1 && grp[0] === 0 && (P[0][0] - P[n - 1][0]) ** 2 + (P[0][1] - P[n - 1][1]) ** 2 <= r2) { for (let i = 0; i < n; i++) if (grp[i] === g - 1) grp[i] = 0; g--; }
    if (g < 3) break;
    const runs = []; for (let k = 0; k < g; k++) runs.push([]);
    for (let i = 0; i < n; i++) runs[grp[i]].push(i);
    const rep = runs.map((ix) => {
      if (ix.length === 1) return P[ix[0]];
      changed = true;
      const f = ix[0], l = ix[ix.length - 1], a = P[(f - 1 + n) % n], b = P[(l + 1) % n];
      let best = P[f], bd = -1;
      for (const i of ix) { const d = distSeg(P[i], a, b); if (d > bd) { bd = d; best = P[i]; } }
      return best;
    });
    P = rep;
    if (!changed) break;
  }
  return P;
}
function tidyPhotoRing(R, tolPx) {
  if (R.length < 5) return R;
  const a = Math.abs(area(R)), sz = Math.sqrt(a);
  const tol = Math.max(0.15, Math.min(tolPx, 0.03 * sz)), rad = Math.max(1, Math.min(0.09 * sz, 3 * tolPx + 4));
  let P = mergeNear(R, rad);
  if (P.length >= 6) P = simplifyRing(P, tol);
  P = mergeNear(P, rad);
  return P.length >= 3 ? P : R;
}
function inkPixels(px, w, h, T) {
  const N = w * h, Y = new Float32Array(N), out = new Uint8Array(N);
  for (let i = 0; i < N; i++) Y[i] = px[i * 4 + 3] < 128 ? 255 : 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const D = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const p = y * w + x, v = Y[p];
    if (v > 205 || px[p * 4 + 3] < 128) continue;
    for (let k = 0; k < 4; k++) {
      const dx = D[k][0], dy = D[k][1], o1 = dy * w + dx;
      if (v > Y[p - o1] || v > Y[p + o1]) continue;
      if (Y[p - 2 * o1] - v > T && Y[p + 2 * o1] - v > T) { out[p] = 1; break; }
    }
  }
  return out;
}
/* tutup celah 1 sampai 2 px pada topeng (dilasi lalu erosi 3x3) supaya garis tidak putus-putus */
function closeMask(m, w, h) {
  const N = w * h, d = new Uint8Array(N), e = new Uint8Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    d[p] = (m[p] | m[p - 1] | m[p + 1] | m[p - w] | m[p + w] | m[p - w - 1] | m[p - w + 1] | m[p + w - 1] | m[p + w + 1]) ? 1 : 0;
  }
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const p = y * w + x;
    e[p] = (d[p] & d[p - 1] & d[p + 1] & d[p - w] & d[p + w] & d[p - w - 1] & d[p - w + 1] & d[p + w - 1] & d[p + w + 1]) ? 1 : 0;
  }
  for (let p = 0; p < N; p++) m[p] = m[p] | e[p];
}
/* buang gugus kecil pada topeng 0/1 (konektivitas 8 arah) */
function dropSmall(mask, w, h, minSize) {
  const N = w * h, seen = new Uint8Array(N), q = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!mask[s] || seen[s]) continue;
    let a = 0, b = 0; q[b++] = s; seen[s] = 1;
    while (a < b) {
      const p = q[a++], x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const n = yy * w + xx;
        if (mask[n] && !seen[n]) { seen[n] = 1; q[b++] = n; }
      }
    }
    if (b < minSize) for (let t = 0; t < b; t++) mask[q[t]] = 0;
  }
}


/* ilustrasi bersih: warna peralihan (antialias) di tepi bentuk dibuang. Klaster yang tipis (hampir semua pikselnya di batas)
   dan warnanya terletak di antara dua tetangga utamanya dilebur ke tetangga terdekat, jadi tidak ada pinggiran warna aneh. */
function dropBlend(lab, rgba, w, h) {
  const N = w * h, DX = [-1, 1, 0, 0], DY = [0, 0, -1, 1];
  const st = new Map();
  for (let i = 0; i < N; i++) {
    const l = lab[i]; if (l < 0) continue;
    let a = st.get(l); if (!a) st.set(l, a = { n: 0, r: 0, g: 0, b: 0, bd: 0, nb: new Map() });
    a.n++; a.r += rgba[i * 4]; a.g += rgba[i * 4 + 1]; a.b += rgba[i * 4 + 2];
    const x = i % w, y = (i - x) / w; let edge = false;
    for (let k = 0; k < 4; k++) {
      const xx = x + DX[k], yy = y + DY[k]; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const m = lab[yy * w + xx]; if (m >= 0 && m !== l) { edge = true; a.nb.set(m, (a.nb.get(m) || 0) + 1); }
    }
    if (edge) a.bd++;
  }
  const cen = (a) => [a.r / a.n, a.g / a.n, a.b / a.n], drop = new Set();
  for (const [l, a] of st) {
    if (a.n > N * 0.03 || a.bd < a.n * 0.7 || a.nb.size < 2) continue;
    const top = [...a.nb.entries()].sort((p, q) => q[1] - p[1]).slice(0, 2), A = cen(st.get(top[0][0])), B = cen(st.get(top[1][0])), C = cen(a);
    const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    if (l2 < 900) continue;
    const t = ((C[0] - A[0]) * ab[0] + (C[1] - A[1]) * ab[1] + (C[2] - A[2]) * ab[2]) / l2;
    if (t < 0.06 || t > 0.94) continue;
    const d = Math.hypot(C[0] - (A[0] + t * ab[0]), C[1] - (A[1] + t * ab[1]), C[2] - (A[2] + t * ab[2]));
    if (d < 45) drop.add(l);
  }
  if (!drop.size) return 0;
  // isi ulang piksel yang dibuang dari tetangga yang tersisa (perambatan dari batas, jadi tepinya jatuh di tengah)
  const q = new Int32Array(N); let a0 = 0, b0 = 0;
  for (let i = 0; i < N; i++) if (lab[i] >= 0 && !drop.has(lab[i])) q[b0++] = i;
  const out = Int16Array.from(lab);
  for (let i = 0; i < N; i++) if (drop.has(lab[i])) out[i] = -2;
  while (a0 < b0) {
    const i = q[a0++], x = i % w, y = (i - x) / w;
    for (let k = 0; k < 4; k++) {
      const xx = x + DX[k], yy = y + DY[k]; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const n = yy * w + xx; if (out[n] === -2) { out[n] = out[i]; q[b0++] = n; }
    }
  }
  for (let i = 0; i < N; i++) lab[i] = out[i] === -2 ? -1 : out[i];
  return drop.size;
}

function* photoGen(rgba, w, h, opt) {
  const o = Object.assign({ title: 'foto', duration: 3, fps: 30, canvas: 'auto', width: 1080, height: 1080, colors: 24, detail: 'sedang', holes: 'jembatan', edge: 5, ink: true, bersih: false, srcW: w, srcH: h }, opt || {});
  const D = PHOTO_DETAIL[o.detail] || PHOTO_DETAIL.sedang, N = w * h;
  const K = Math.max(2, Math.min(128, Math.round(o.colors) || 24));
  if (!(w > 1 && h > 1) || rgba.length < N * 4) throw new Error('Data foto tidak valid.');
  const warns = [], warn = (m) => { if (warns.indexOf(m) < 0) warns.push(m); };
  let clear = 0; for (let i = 0; i < N; i++) if (rgba[i * 4 + 3] < 128) clear++;
  if (clear === N) throw new Error('Foto ini kosong atau transparan penuh.');

  yield 'Menghaluskan foto...';
  const px = bilateral(rgba, w, h, D.sigma);
  yield 'Mengelompokkan warna...';
  const q = quantize(px, N, K, edgeWeights(px, w, h, o.bersih ? 0 : o.edge), o.bersih ? 10 : 4), lab = q.lab;
  if (o.bersih) for (let it = 0; it < 3; it++) if (!dropBlend(lab, rgba, w, h)) break;
  yield 'Merapikan bercak kecil...';
  cleanSpecks(lab, w, h, Math.max(3, Math.round(N / D.speck)));

  const acc = new Map();
  for (let i = 0; i < N; i++) { const l = lab[i]; if (l < 0) continue; let a = acc.get(l); if (!a) acc.set(l, a = [0, 0, 0, 0]); a[0] += rgba[i * 4]; a[1] += rgba[i * 4 + 1]; a[2] += rgba[i * 4 + 2]; a[3]++; }
  const cl = [...acc.entries()].map(([id, a]) => ({ id, n: a[3], r: Math.round(a[0] / a[3]), g: Math.round(a[1] / a[3]), b: Math.round(a[2] / a[3]) })).sort((p, r) => r.n - p.n);
  const M = cl.length, ord = new Int16Array(q.count + 1).fill(-1);
  cl.forEach((c, i) => { ord[c.id] = i; });
  const oi = new Int16Array(N); for (let i = 0; i < N; i++) oi[i] = lab[i] < 0 ? -1 : ord[lab[i]];

  const box = { x: 0, y: 0, w: o.srcW, h: o.srcH };
  let cs;
  if (o.canvas === 'custom' || /^\d+x\d+$/.test(String(o.canvas))) cs = canvasSize(box, o);
  else { const big = Math.max(box.w, box.h), s = big < 1080 ? 1080 / big : big > 2160 ? 2160 / big : 1; cs = { w: Math.max(16, Math.round(box.w * s)), h: Math.max(16, Math.round(box.h * s)), fit: false }; }
  const sc = cs.fit ? Math.min(cs.w / box.w, cs.h / box.h) : cs.w / box.w;
  const ox = (cs.w - box.w * sc) / 2, oy = (cs.h - box.h * sc) / 2, kx = sc * o.srcW / w, ky = sc * o.srcH / h;
  const tr = (R) => R.map((p) => [p[0] * kx + ox, p[1] * ky + oy]);

  const S = { f: new Float32Array((w + 2) * (h + 2)), nxt: new Int32Array(2 * (w + 2) * (h + 2)).fill(-1) };
  const mask = new Uint8Array(N), layers = [], tally = { fallback: 0, lost: 0 };
  const ringsOf = (lv, tol, sg, smoothed) => {
    const outers = [], holes = [];
    for (const lp of contours(mask, w, h, S, lv, sg)) {
      const R0 = smoothed ? refineRing(lp, tol || D.tol, D.sm, false) : simplifyRing(lp, tol || D.tol), R = tidyPhotoRing(R0, Math.max(0.5, 0.9 / Math.max(kx, 1e-6))), a = area(R);
      if (R.length < 3 || Math.abs(a) < 0.8) continue;
      (a > 0 ? outers : holes).push({ R, a, bb: bboxOf(R), own: [] });
    }
    outers.sort((p, r) => p.a - r.a);
    for (const hl of holes) {
      let par = null;
      for (const ot of outers) { if (ot.bb[0] <= hl.bb[0] && ot.bb[1] <= hl.bb[1] && ot.bb[2] >= hl.bb[2] && ot.bb[3] >= hl.bb[3] && pip(hl.R[0], ot.R)) { par = ot; break; } }
      if (par) par.own.push(hl.R); else tally.lost++;
    }
    const rings = [];
    for (const ot of outers) {
      if (!ot.own.length) { rings.push(ot.R); continue; }
      if (o.holes === 'pecah') {
        try { for (const r of splitSlabs({ outer: ot.R, holes: ot.own }, 0)) rings.push(r); continue; } catch (e) { /* lanjut ke jembatan */ }
      }
      const b = bridgeAll(ot.R, ot.own);
      if (b.bad.length) {
        try { for (const r of splitSlabs({ outer: ot.R, holes: ot.own }, 0)) rings.push(r); tally.fallback++; continue; } catch (e) { /* biarkan */ }
        tally.lost += b.bad.length;
      }
      rings.push(b.ring);
    }
    return rings.map(tr);
  };
  const hex = (r, g, b) => {
    if (r >= 238 && g >= 238 && b >= 238) { r = g = b = 255; } else if (r <= 22 && g <= 22 && b <= 22) { r = g = b = 0; }   // putih/hitam murni
    return '#ff' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const push = (label, fill, rings) => {
    const fin = [];
    for (const R of rings) { const C = cleanRing(R); if (C.length >= 3 && Math.abs(area(C)) > 1e-3) fin.push(C); }
    if (fin.length) layers.push({ n: layers.length + 1, label, fill, rings: fin, on: true });
  };
  for (let i = 0; i < M; i++) {
    yield 'Membentuk layer ' + (i + 1) + ' dari ' + M + '...';
    const c = cl[i];
    if (i === 0 && !clear) { push('Warna 1', hex(c.r, c.g, c.b), [tr([[0, 0], [w, 0], [w, h], [0, h]])]); continue; }
    for (let p = 0; p < N; p++) mask[p] = oi[p] >= i ? 1 : 0;
    push('Warna ' + (layers.length + 1), hex(c.r, c.g, c.b), ringsOf(undefined, undefined, undefined, true));
  }
  let inkN = 0;
  if (o.ink) {
    yield 'Mencari garis tipis...';
    const flag = inkPixels(rgba, w, h, 24);
    closeMask(flag, w, h);
    dropSmall(flag, w, h, 6);
    const tmp = new Uint8ClampedArray(N * 4); let nf = 0;
    for (let p = 0; p < N; p++) if (flag[p]) { tmp[p * 4] = rgba[p * 4]; tmp[p * 4 + 1] = rgba[p * 4 + 1]; tmp[p * 4 + 2] = rgba[p * 4 + 2]; tmp[p * 4 + 3] = 255; nf++; }
    if (nf >= 12) {
      const qi = quantize(tmp, N, 3), sum = new Map();
      const lum = (p) => rgba[p * 4] + rgba[p * 4 + 1] + rgba[p * 4 + 2], ls = new Map();
      for (let p = 0; p < N; p++) { const l = qi.lab[p]; if (l < 0) continue; let a = ls.get(l); if (!a) ls.set(l, a = [0, 0]); a[0] += lum(p); a[1]++; }
      for (let p = 0; p < N; p++) { const l = qi.lab[p]; if (l < 0) continue; const m = ls.get(l); if (lum(p) > m[0] / m[1]) continue; let a = sum.get(l); if (!a) sum.set(l, a = [0, 0, 0, 0]); a[0] += rgba[p * 4]; a[1] += rgba[p * 4 + 1]; a[2] += rgba[p * 4 + 2]; a[3]++; }
      const inks = [...sum.entries()].map(([id, a]) => ({ id, r: Math.round(a[0] / a[3]), g: Math.round(a[1] / a[3]), b: Math.round(a[2] / a[3]), n: a[3] })).sort((p, r) => (p.r + p.g + p.b) - (r.r + r.g + r.b));
      for (const ink of inks) {
        if (ink.n < 12) continue;
        for (let p = 0; p < N; p++) mask[p] = qi.lab[p] === ink.id ? 1 : 0;
        const before = layers.length;
        push('Garis ' + (++inkN), hex(ink.r, ink.g, ink.b), ringsOf(0.3, 0.3, 0.8));
        if (layers.length === before) inkN--;
      }
    }
  }
  if (o.tidy !== false && layers.length) { yield 'Merapikan vektor dobel...'; const tn = tidyNote(tidyLayers(layers, o, 'photo')); if (tn) warn(tn); }
  if (!layers.length) throw new Error('Tidak ada bentuk yang bisa dibuat dari foto ini.');
  if (tally.fallback) warn(tally.fallback + ' bentuk berlubang dikerjakan dengan cara lain karena penyambungan lubang gagal.');
  if (tally.lost) warn('Ada ' + tally.lost + ' lubang kecil yang tidak bisa dibuat. Warna di area itu bisa sedikit berbeda dari foto.');
  const total = layers.reduce((s, l) => s + l.rings.length, 0);
  let pts = 0; layers.forEach((l) => l.rings.forEach((r) => { pts += r.length; }));
  if (pts > 150000) warn('Hasilnya ' + pts + ' titik, XML cukup besar dan bisa berat di Alight Motion. Kurangi jumlah warna atau turunkan detail.');
  const model = { title: o.title, width: cs.w, height: cs.h, totalTime: Math.max(100, Math.round(o.duration * 1000)), fps: Math.max(1, Math.round(o.fps)), layers };
  return { model, warnings: warns, stats: { layers: layers.length, pieces: total, points: pts, width: cs.w, height: cs.h } };
}
function fromImage(rgba, w, h, opt) {
  const g = photoGen(rgba, w, h, opt);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
async function fromImageAsync(rgba, w, h, opt) {
  const g = photoGen(rgba, w, h, opt), step = (opt && opt.onStep) || null;
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    if (step) step(r.value);
    await new Promise((k) => setTimeout(k, 0));
  }
}

const API = { strokePoly, dashPolys, convexParts, convert, toXML, draw, parseXML, parsePath, parseColor, parseTransform, flattenSub, buildPWH, splitSlabs, bridgeAll, clipHalf, findCrossings, area, pip, cleanRing, thinRing, SAMPLE, num, fromImage, fromImageAsync, PHOTO_DETAIL };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
G.SVGAM = API;
})(typeof window !== 'undefined' ? window : globalThis);
