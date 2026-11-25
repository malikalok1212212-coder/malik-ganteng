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
const argb = (c, op) => '#' + hex2(Math.max(0, Math.min(255, Math.round(c.a * op * 255)))) + hex2(c.r) + hex2(c.g) + hex2(c.b);

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
const PROPS = ['fill', 'fill-opacity', 'fill-rule', 'opacity', 'display', 'visibility', 'stroke', 'stroke-width', 'color', 'stop-color', 'stop-opacity', 'clip-path', 'mask', 'filter'];
const INH = { fill: 1, 'fill-opacity': 1, 'fill-rule': 1, visibility: 1, stroke: 1, 'stroke-width': 1, color: 1 };
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

function collect(doc, base, warn) {
  const { svg, ids, rules } = doc, leaves = [];
  const cnt = {};
  const note = (k) => { cnt[k] = (cnt[k] || 0) + 1; };
  function paint(st, ids2) {
    const raw = st.fill === undefined ? 'black' : st.fill;
    if (/^none$/i.test(raw)) return null;
    const u = /^url\(\s*['"]?#([^)'"]+)['"]?\s*\)\s*(.*)$/i.exec(raw);
    if (u) {
      const t = ids2[u[1]];
      if (t && (t.t === 'linearGradient' || t.t === 'radialGradient')) { const c = gradientColor(t, ids2, rules, st.color); if (c) { note('grad'); return c; } }
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
    if ((st['clip-path'] && st['clip-path'] !== 'none') || (st.mask && st.mask !== 'none')) note('clip');
    if (st.filter && st.filter !== 'none') note('filter');
    const nctx = { m: M, st, op, depth: ctx.depth + 1 };
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
    const a = node.a;
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
    else if (t === 'line') subs = [];
    const sw = st['stroke-width'] === undefined ? 1 : len(st['stroke-width']);
    if (st.stroke !== undefined && !/^none$/i.test(st.stroke) && sw !== 0) note('stroke');
    if (t === 'line' || !subs.length) return;
    const fo = st['fill-opacity'] !== undefined && parseFloat(st['fill-opacity']) === parseFloat(st['fill-opacity']) ? Math.max(0, Math.min(1, parseFloat(st['fill-opacity']))) : 1;
    const col = paint(st, ids);
    if (!col || col.a * op * fo <= 0) return;
    leaves.push({ tag: t, subs, m: M, col, alpha: op * fo, rule: st['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero' });
  }
  walk(svg, { m: base, st: null, op: 1, depth: 0 });
  if (cnt.stroke) warn('Garis (stroke) pada ' + cnt.stroke + ' bentuk tidak ikut diubah. Ubah ke outline dulu di editor desain (Stroke to Path / Outline Stroke), lalu konversi lagi.');
  if (cnt.teks) warn('Teks tidak didukung (' + cnt.teks + ' elemen dilewati). Ubah teks menjadi outline di editor desain sebelum mengonversi.');
  if (cnt.gambar) warn('Gambar bitmap di dalam SVG tidak didukung (' + cnt.gambar + ' dilewati).');
  if (cnt.grad) warn('Gradasi diganti satu warna rata-rata pada ' + cnt.grad + ' bentuk.');
  if (cnt.pola) warn('Pola (pattern) tidak didukung, ' + cnt.pola + ' bentuk dilewati atau memakai warna cadangan.');
  if (cnt.clip) warn('Clip-path atau mask pada ' + cnt.clip + ' elemen diabaikan, bentuknya tidak terpotong.');
  if (cnt.filter) warn('Filter (blur, bayangan, dan sejenisnya) pada ' + cnt.filter + ' elemen diabaikan.');
  return leaves;
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

/* ---------- konversi utama ---------- */
function convert(text, opt) {
  const o = Object.assign({ title: 'svg', duration: 3, fps: 30, canvas: 'auto', width: 1080, height: 1080, holes: 'pecah', tol: 0.05 }, opt || {});
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

  const layers = [];
  const tally = { crossed: 0, self: 0, fallback: 0, many: 0 };
  let objek = 0;
  for (const lf of leaves) {
    const rings = [];
    for (const s of lf.subs) { const R = cleanRing(flattenSub(s, lf.m, o.tol)); if (R.length >= 3) rings.push(R); }
    if (!rings.length) continue;
    const info = {};
    const pwhs = buildPWH(rings, lf.rule, info);
    if (info.crossed) tally.crossed++;
    if (info.self) tally.self++;
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
    const fin = [];
    for (const R of pieces) { const C = cleanRing(R); if (C.length >= 3 && Math.abs(area(C)) > 1e-3) fin.push(C); }
    if (!fin.length) continue;
    objek++;
    layers.push({ n: objek, label: 'Objek ' + objek, fill: argb(lf.col, lf.alpha), rings: fin, on: true });
  }
  if (!layers.length) throw new Error('SVG ini tidak punya bentuk berisi warna yang bisa dikonversi. Pastikan bentuknya punya fill (bukan hanya garis atau teks).');
  if (tally.crossed) warn('Ada ' + tally.crossed + ' bentuk dengan bagian yang saling menimpa. Tiap bagian dijadikan bidang sendiri, hasilnya bisa berbeda dari SVG bila fill-rule evenodd atau arah putarnya berlawanan.');
  if (tally.self) warn('Ada ' + tally.self + ' bentuk yang garisnya menyilang diri sendiri. Periksa hasilnya di preview.');
  if (tally.fallback) warn('Ada ' + tally.fallback + ' bentuk berlubang yang dikerjakan dengan metode jembatan karena pemecahan per bidang gagal.');
  const total = layers.reduce((s, l) => s + l.rings.length, 0);
  if (o.holes !== 'jembatan' && total > 400) warn('Hasilnya ' + total + ' bidang. Bila terasa berat di Alight Motion, coba metode Jembatan (1 layer per bentuk).');

  const model = { title: o.title, width: cs.w, height: cs.h, totalTime: Math.max(100, Math.round(o.duration * 1000)), fps: Math.max(1, Math.round(o.fps)), layers };
  let pts = 0; layers.forEach((l) => l.rings.forEach((r) => { pts += r.length; }));
  return { model, warnings: warns, stats: { layers: layers.length, pieces: total, points: pts, width: cs.w, height: cs.h } };
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

const API = { convert, toXML, draw, parseXML, parsePath, parseColor, parseTransform, flattenSub, buildPWH, splitSlabs, bridgeAll, clipHalf, findCrossings, area, pip, cleanRing, SAMPLE, num };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
G.SVGAM = API;
})(typeof window !== 'undefined' ? window : globalThis);
