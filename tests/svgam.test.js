// Uji konverter SVG ke XML Alight Motion (public/js/svgam.js). Jalankan: npm test
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const S = require('../public/js/svgam.js');

const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) <= e, a + ' != ' + b);
const bb = (rings) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const R of rings) for (const p of R) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
const conv = (svg, o) => S.convert(svg, Object.assign({ canvas: 'custom', width: 100, height: 100 }, o));
const lcg = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const circ = (cx, cy, r, n = 720) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const nearEdge = (p, rings, e) => rings.some((R) => R.some((a, i) => dist(p, a, R[(i + 1) % R.length]) < e));
const eo = (p, rings) => rings.filter((R) => S.pip(p, R)).length % 2 === 1;

/* Mencocokkan hasil dengan wilayah referensi lewat titik acak (titik dekat tepi dilewati) */
function sameRegion(layer, ref, w, h, rule = eo, seed = 9) {
  const r = lcg(seed); let bad = 0, tot = 0;
  for (let k = 0; k < 8000; k++) {
    const p = [r() * w, r() * h];
    if (nearEdge(p, ref, 0.4)) continue;
    tot++;
    if (rule(p, ref) !== layer.rings.some((q) => S.pip(p, q))) bad++;
  }
  assert.ok(tot > 4000); assert.equal(bad, 0);
}
const circPath = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

test('penulis XML menghasilkan ulang malik-logo.xml persis sama (byte demi byte)', () => {
  const xml = fs.readFileSync(path.join(__dirname, 'fixtures', 'malik-logo.xml'), 'utf8');
  const root = S.parseXML(xml), scene = root.c[0], inner = scene.c[0].c.find((c) => c.t === 'scene'), CC = [768, 768];
  const pts = (d, o) => { const q = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1] + o[0], +m[2] + o[1]]); q.pop(); return q; };
  const layers = inner.c.map((el) => {
    if (el.t === 'shape') {
      const loc = el.c.find((c) => c.t === 'transform').c[0].a.value.split(',').map(Number);
      return { label: el.a.label, fill: el.c.find((c) => c.t === 'fillColor').a.value, rings: [pts(el.c.find((c) => c.t === 'path').a.d, loc)], on: true };
    }
    const sc = el.c.find((c) => c.t === 'scene');
    return { label: el.a.label, fill: sc.c[0].c.find((c) => c.t === 'fillColor').a.value, rings: sc.c.map((s) => pts(s.c.find((c) => c.t === 'path').a.d, CC)), on: true };
  });
  const out = S.toXML({ title: 'malik-logo', width: 1536, height: 1536, totalTime: 3000, fps: 30, layers }, { comment: 'Created by SML Verter\nBased on observed Alight Motion XML export structure' });
  assert.equal(out, xml);
});

test('XML hasil konversi punya struktur sama dengan contoh dan well-formed', () => {
  const r = S.convert(S.SAMPLE, { title: 'contoh' });
  const xml = S.toXML(r.model);
  const t = S.parseXML(xml).c[0];
  assert.equal(t.t, 'scene'); assert.equal(t.a.retime, 'freeze'); assert.equal(t.a.amplatform, 'android');
  const emb = t.c[0]; assert.equal(emb.t, 'embedScene'); assert.equal(emb.a.id, '100000000');
  const ids = [...xml.matchAll(/ id="(\d+)"/g)].map((m) => +m[1]);
  ids.forEach((v, i) => assert.equal(v, 100000000 + i));
  assert.match(xml, /<path d="M -?[\d.]+ -?[\d.]+(L -?[\d.]+ -?[\d.]+)+Z" \/>/);
  for (const m of xml.matchAll(/ d="([^"]+)"/g)) { const q = m[1].replace(/Z$/, '').split('L'); assert.equal(q[0].slice(2).trim(), q[q.length - 1].trim()); } // titik awal diulang sebelum Z
});

test('parser path: relatif, H/V, S, Q, T, arc, angka tanpa pemisah', () => {
  let s = S.parsePath('m10 10 20 0v20h-20z');
  assert.equal(s.length, 1); assert.equal(s[0].closed, true); assert.deepEqual(s[0].segs.map((x) => x.slice(1)), [[30, 10], [30, 30], [10, 30]]);
  s = S.parsePath('M0 0C10 0 20 10 20 20S30 40 40 40');
  assert.deepEqual(s[0].segs[1], ['C', 20, 30, 30, 40, 40, 40]);
  s = S.parsePath('M0 0Q10 0 10 10T20 20');
  assert.equal(s[0].segs.length, 2); near(s[0].segs[1][1], 10 + 2 / 3 * 0, 1e-9 + 1);
  s = S.parsePath('M0 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0'); // flag menempel angka berikutnya diperbolehkan
  assert.equal(s[0].segs.length, 4);
  s = S.parsePath('M10 10a5 5 0 00 10 0'); assert.ok(s[0].segs.length >= 1); // flag "00" menempel
  s = S.parsePath('M1.5.5L.5.5 3 3'); assert.deepEqual(s[0].segs.map((x) => x.slice(1)), [[0.5, 0.5], [3, 3]]);
  s = S.parsePath('M0 0L10 0 L10 10 xyz'); assert.equal(s[0].segs.length, 2); // rusak: berhenti di titik error
});

test('arc setengah lingkaran jatuh tepat di titik akhir dan radius benar', () => {
  const s = S.parsePath('M0 0A50 50 0 0 1 100 0')[0];
  const pts = S.flattenSub(s, [1, 0, 0, 1, 0, 0], 0.01);
  near(pts[pts.length - 1][0], 100, 1e-9); near(pts[pts.length - 1][1], 0, 1e-9);
  for (const p of pts) near(Math.hypot(p[0] - 50, p[1]), 50, 0.02);
  assert.ok(pts.some((p) => p[1] < -49)); // sweep=1 di sistem y-bawah melengkung ke atas
});

test('warna: nama, hex pendek, rgb, hsl, transparan, currentColor', () => {
  const eq = (s, r, g, b, a = 1) => { const c = S.parseColor(s, 'blue'); assert.deepEqual([c.r, c.g, c.b], [r, g, b], s); near(c.a, a, 0.01); };
  eq('red', 255, 0, 0); eq('#0f0', 0, 255, 0); eq('#00f8', 0, 0, 255, 0.53); eq('rgb(10, 20, 30)', 10, 20, 30);
  eq('rgb(100% 0% 0% / 50%)', 255, 0, 0, 0.5); eq('hsl(120, 100%, 50%)', 0, 255, 0); eq('currentColor', 0, 0, 255); eq('rebeccapurple', 102, 51, 153);
  assert.equal(S.parseColor('zzz'), null);
});

test('transform, viewBox, dan ukuran kanvas dipetakan dengan benar', () => {
  // viewBox 100x50 ke kanvas 200x100: skala 2. rect 10..30 x 5..15 diputar 90 derajat di (50,25)
  const r = S.convert('<svg viewBox="0 0 100 50"><rect x="10" y="5" width="20" height="10" transform="rotate(90 50 25)"/></svg>', { canvas: '200x100' });
  const [a, b, c, d] = bb(r.model.layers[0].rings);
  // sebelum skala: titik (10,5) -> (70,-15)... lebar 10, tinggi 20 di x 60..70 (setelah rotasi), y 5..?, hitung lewat rumus
  const rot = (x, y) => [50 - (y - 25), 25 + (x - 50)];
  const P = [rot(10, 5), rot(30, 5), rot(30, 15), rot(10, 15)].map((p) => [p[0] * 2, p[1] * 2]);
  near(a, Math.min(...P.map((p) => p[0]))); near(c, Math.max(...P.map((p) => p[0]))); near(b, Math.min(...P.map((p) => p[1]))); near(d, Math.max(...P.map((p) => p[1])));
  assert.equal(r.model.width, 200); assert.equal(r.model.height, 100);
});

test('kanvas preset memusatkan SVG (pas ke kanvas) dan mode otomatis mengikuti SVG', () => {
  let r = S.convert('<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>', { canvas: '1080x1920' });
  let [a, b, c, d] = bb(r.model.layers[0].rings);
  near(a, 0); near(c, 1080); near(b, 420); near(d, 1500);
  r = S.convert('<svg viewBox="0 0 1536 1536"><rect width="1536" height="1536"/></svg>', { canvas: 'auto' });
  assert.deepEqual([r.model.width, r.model.height], [1536, 1536]);
  r = S.convert('<svg width="24" height="24"><rect width="24" height="24"/></svg>', { canvas: 'auto' });
  assert.equal(r.model.width, 1080); // ikon kecil diperbesar
  r = S.convert('<svg viewBox="0 0 8000 4000"><rect width="8000" height="4000"/></svg>', { canvas: 'auto' });
  assert.deepEqual([r.model.width, r.model.height], [4096, 2048]);
});

test('gaya: atribut, CSS kelas, style=, warisan, opacity, fill-opacity, display none', () => {
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#00ff00} #x{fill:blue}</style>
   <g fill="red"><rect width="10" height="10"/><rect class="a" x="20" width="10" height="10"/><rect id="x" class="a" x="40" width="10" height="10"/>
   <rect style="fill:#ffffff;fill-opacity:.5" x="60" width="10" height="10"/><rect x="80" width="10" height="10" opacity=".5" fill-opacity=".5"/>
   <rect x="0" y="50" width="10" height="10" display="none"/><rect x="0" y="60" width="10" height="10" visibility="hidden"/></g></svg>`;
  const f = conv(svg).model.layers.map((l) => l.fill);
  assert.deepEqual(f, ['#ffff0000', '#ff00ff00', '#ff0000ff', '#80ffffff', '#40ff0000']);
});

test('use, symbol, g bertransform bersarang, polygon/polyline/ellipse/rect rounded', () => {
  const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><rect id="r" width="10" height="10" fill="red"/></defs>
   <use xlink:href="#r" x="30" y="40"/><g transform="translate(5 5) scale(2)"><use href="#r"/></g>
   <polygon points="0,0 10,0 5,8" fill="blue"/><ellipse cx="50" cy="50" rx="10" ry="5"/><rect x="60" y="60" width="30" height="20" rx="5"/></svg>`;
  const L = conv(svg).model.layers, b0 = bb(L[0].rings), b1 = bb(L[1].rings);
  near(b0[0], 30); near(b0[1], 40); near(b0[2], 40); near(b0[3], 50);
  near(b1[0], 5); near(b1[2], 25);
  assert.equal(L.length, 5);
  const e = bb(L[3].rings); near(e[0], 40); near(e[2], 60); near(e[1], 45); near(e[3], 55);
  const rr = L[4].rings[0]; assert.ok(rr.length > 8); const rb = bb(L[4].rings); near(rb[2] - rb[0], 30); near(rb[3] - rb[1], 20);
});

test('fill-rule: evenodd membuat lubang, nonzero searah mengisi, berlawanan arah berlubang', () => {
  const two = (rev) => `<svg viewBox="0 0 100 100"><path ${rev === 'eo' ? 'fill-rule="evenodd"' : ''} d="M10 10H90V90H10Z M30 30${rev === 'opp' ? 'V70H70V30Z' : 'H70V70H30Z'}"/></svg>`;
  const area = (L) => L.rings.reduce((s, r) => s + Math.abs(S.area(r)), 0);
  const eoL = conv(two('eo')).model.layers[0], sameL = conv(two('same')).model.layers[0], oppL = conv(two('opp')).model.layers[0];
  assert.ok(eoL.rings.length >= 1); sameL.rings.forEach((r) => assert.ok(S.area(r) !== 0));
  const cover = (L, p) => L.rings.some((r) => S.pip(p, r));
  assert.equal(cover(eoL, [50, 50]), false); assert.equal(cover(eoL, [20, 20]), true);
  assert.equal(cover(sameL, [50, 50]), true);
  assert.equal(cover(oppL, [50, 50]), false);
  assert.equal(area(sameL) > 0, true);
});

test('donat: dua metode sama-sama menutup wilayah yang sama, tanpa lubang tersisa', () => {
  for (const holes of ['pecah', 'jembatan']) {
    const r = S.convert(S.SAMPLE, { holes, canvas: '512x512' }), L = r.model.layers[1];
    sameRegion(L, [circ(256, 256, 192), circ(256, 256, 112)], 512, 512);
    L.rings.forEach((R) => assert.ok(S.area(R) > 0 || S.area(R) < 0));
    if (holes === 'jembatan') assert.equal(L.rings.length, 1); else assert.ok(L.rings.length >= 2);
  }
});

test('metode pecah: bidang saling tumpang 1 px bila warna solid, tidak bila transparan', () => {
  const mk = (a) => `<svg viewBox="0 0 400 400"><path fill-rule="evenodd" fill="#fff" fill-opacity="${a}" d="M0 0H400V400H0Z${circPath(200, 200, 100)}"/></svg>`;
  const solid = S.convert(mk(1), { canvas: '400x400' }).model.layers[0], alpha = S.convert(mk(0.5), { canvas: '400x400' }).model.layers[0];
  const overlapArea = (L) => { let n = 0; const r = lcg(4); for (let k = 0; k < 40000; k++) { const p = [200 + (r() - .5) * 4, r() * 400]; if (L.rings.filter((q) => S.pip(p, q)).length > 1) n++; } return n; };
  assert.ok(overlapArea(solid) > 0); assert.equal(overlapArea(alpha), 0);
});

test('banyak lubang, lubang bersarang, berdekatan, dan sangat kecil: wilayah tetap benar', () => {
  const R = lcg(5); let d = 'M0 0H1000V800H0Z'; const ref = [[[0, 0], [1000, 0], [1000, 800], [0, 800]]];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) { const r = 8 + R() * 14, cx = +(60 + i * 110 + R() * 10).toFixed(2), cy = +(60 + j * 130 + R() * 10).toFixed(2), rr = +r.toFixed(2); d += circPath(cx, cy, rr); ref.push(circ(cx, cy, rr, 180)); }
  for (const holes of ['pecah', 'jembatan']) {
    sameRegion(S.convert(`<svg viewBox="0 0 1000 800"><path fill-rule="evenodd" d="${d}"/></svg>`, { holes, canvas: '1000x800' }).model.layers[0], ref, 1000, 800, eo, 3);
    const nest = [380, 300, 220, 140, 60]; const dn = nest.map((r) => circPath(400, 400, r)).join('');
    sameRegion(S.convert(`<svg viewBox="0 0 800 800"><path fill-rule="evenodd" d="${dn}"/></svg>`, { holes, canvas: '800x800' }).model.layers[0], nest.map((r) => circ(400, 400, r, 360)), 800, 800, eo, 4);
    const dc = 'M0 0H400V400H0Z' + circPath(200, 200, 100) + circPath(305.5, 200, 5) + circPath(100, 100, 0.8) + circPath(250, 330, 1.2);
    sameRegion(S.convert(`<svg viewBox="0 0 400 400"><path fill-rule="evenodd" d="${dc}"/></svg>`, { holes, canvas: '400x400' }).model.layers[0], [[[0, 0], [400, 0], [400, 400], [0, 400]], circ(200, 200, 100), circ(305.5, 200, 5), circ(100, 100, 0.8, 24), circ(250, 330, 1.2, 24)], 400, 400, eo, 6);
  }
});

test('bentuk cekung (bintang) berlubang bintang, nonzero dengan arah berlawanan', () => {
  const star = (cx, cy, Ro, ri, n) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? ri : Ro; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
  const o = star(300, 300, 280, 120, 7), h = star(300, 300, 130, 50, 7).reverse();
  const f = (P) => 'M' + P.map((q) => q[0].toFixed(3) + ' ' + q[1].toFixed(3)).join('L') + 'Z';
  for (const holes of ['pecah', 'jembatan']) {
    const L = S.convert(`<svg viewBox="0 0 600 600"><path d="${f(o)}${f(h)}"/></svg>`, { holes, canvas: '600x600' }).model.layers[0];
    sameRegion(L, [o, h], 600, 600, eo, 8);
  }
});

test('peringatan: stroke, teks, gradasi, clip-path, filter, CSS rumit', () => {
  const svg = `<svg viewBox="0 0 100 100"><style>div p{fill:red}</style><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
   <rect width="10" height="10" fill="url(#g)"/><path d="M0 0L50 50" stroke="red" fill="none"/><text x="1" y="1">a</text><rect x="20" width="10" height="10" clip-path="url(#c)" filter="url(#f)"/></svg>`;
  const r = conv(svg, { grad: 'rata' }), w = r.warnings.join('|');
  assert.match(w, /Teks/); assert.match(w, /Gradasi/); assert.match(w, /Clip-path/); assert.match(w, /Filter/); assert.match(w, /CSS/);
  assert.equal(r.model.layers[0].fill, '#ff808080');
});

test('error yang jelas untuk file bukan SVG atau SVG tanpa bentuk berisi', () => {
  assert.throws(() => S.convert('halo dunia'), /bukan SVG/);
  assert.throws(() => S.convert('<svg viewBox="0 0 10 10"><path d="M0 0L10 10" fill="none"/></svg>'), /bentuk berisi warna/);
});

test('SVG tanpa viewBox dan ukuran memakai kotak isi, entitas XML dan DOCTYPE tidak merusak', () => {
  const svg = `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd" [ <!ENTITY ns "http://www.w3.org/2000/svg"> ]><svg xmlns="&ns;"><!-- k --><rect x="100" y="100" width="40" height="20" fill="&#35;ff0000"/></svg>`;
  const r = S.convert(svg, { canvas: 'auto' });
  assert.ok(r.warnings.some((x) => /viewBox/.test(x))); assert.equal(r.model.layers[0].fill, '#ffff0000');
});

test('XML dihasilkan ulang: layer dimatikan dilewati, id tetap berurutan, judul di-escape', () => {
  const r = S.convert(S.SAMPLE, { title: 'a&b "c"' });
  r.model.layers[1].on = false;
  const xml = S.toXML(r.model);
  assert.match(xml, /title="a&amp;b &quot;c&quot;"/); assert.ok(!xml.includes('Objek 2'));
  [...xml.matchAll(/ id="(\d+)"/g)].forEach((m, i) => assert.equal(+m[1], 100000000 + i));
});

test('durasi dan FPS masuk ke scene', () => {
  const r = S.convert(S.SAMPLE, { duration: 5.5, fps: 60 });
  const xml = S.toXML(r.model);
  assert.match(xml, /totalTime="5500" fps="60"/); assert.match(xml, /endTime="5500" outTime="5500"/);
});

/* ---------- foto (raster) ke bidang ---------- */
const mkImg = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y), p = (y * w + x) * 4; d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = c.length > 3 ? c[3] : 255; } return d; };
const layerAt = (model, pt) => { let hit = null; for (const l of model.layers) if (l.rings.some((R) => S.pip(pt, R))) hit = l; return hit; };
const hexRGB = (f) => [parseInt(f.slice(3, 5), 16), parseInt(f.slice(5, 7), 16), parseInt(f.slice(7, 9), 16)];
const photoOpt = (w, h, o) => Object.assign({ canvas: 'custom', width: w, height: h, srcW: w, srcH: h, ink: false }, o);

test('foto: tiap warna jadi layer bertumpuk dan warna tiap titik cocok dengan fotonya (termasuk lubang)', () => {
  const W = 96, H = 96, BG = [30, 60, 200], RED = [220, 30, 30], WHT = [250, 250, 250], GRN = [30, 190, 60];
  const src = (x, y) => { const d = Math.hypot(x - 36, y - 40); if (d < 12) return WHT; if (d < 26) return RED; if (x > 64 && x < 90 && y > 60 && y < 90) return GRN; return BG; };
  const out = S.fromImage(mkImg(W, H, src), W, H, photoOpt(W, H, { colors: 4 }));
  assert.equal(out.model.layers.length, 4);
  assert.equal(out.model.width, 96);
  let bad = 0, tot = 0;
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
    const c = src(x, y);
    if ([[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => src(x + dx, y + dy).join() !== c.join())) continue;
    tot++;
    const l = layerAt(out.model, [x + 0.5, y + 0.5]);
    if (!l || hexRGB(l.fill).some((v, i) => Math.abs(v - c[i]) > 6)) bad++;
  }
  assert.ok(tot > 800); assert.equal(bad, 0);
});

test('foto: lapisan paling bawah menutup seluruh foto, XML-nya valid dan id berurutan', () => {
  const W = 64, H = 48, src = (x) => (x < 32 ? [200, 40, 40] : [40, 40, 200]);
  const out = S.fromImage(mkImg(W, H, src), W, H, photoOpt(W, H, { colors: 2 }));
  const base = out.model.layers[0];
  assert.equal(base.rings.length, 1); near(S.area(base.rings[0]), W * H, 1);
  const xml = S.toXML(out.model);
  [...xml.matchAll(/ id="(\d+)"/g)].forEach((m, i) => assert.equal(+m[1], 100000000 + i));
  assert.ok(S.parseXML(xml).c.length === 1);
});

test('foto: piksel transparan tidak ditutup layer apa pun', () => {
  const W = 80, H = 80, src = (x, y) => (Math.hypot(x - 40, y - 40) < 30 ? [220, 120, 20, 255] : [0, 0, 0, 0]);
  const out = S.fromImage(mkImg(W, H, src), W, H, photoOpt(W, H, { colors: 3 }));
  assert.equal(layerAt(out.model, [3, 3]), null); assert.equal(layerAt(out.model, [77, 77]), null);
  const mid = layerAt(out.model, [40, 40]); assert.ok(mid);
  assert.ok(hexRGB(mid.fill)[0] > 200);
});

test('foto: garis tipis diagonal 1 px ikut terbawa lewat layer garis', () => {
  const W = 120, H = 120, src = (x, y) => (Math.abs(x - y) <= 0 || Math.abs(x - y - 1) <= 0 && x > 200 ? [40, 30, 30] : [235, 215, 200]);
  const withInk = S.fromImage(mkImg(W, H, src), W, H, photoOpt(W, H, { colors: 4, ink: true }));
  assert.ok(withInk.model.layers.some((l) => /^Garis/.test(l.label)));
  let hit = 0, tot = 0;
  for (let k = 12; k < W - 12; k++) { tot++; const l = layerAt(withInk.model, [k + 0.5, k + 0.5]); if (l && hexRGB(l.fill)[0] < 120) hit++; }
  assert.ok(hit / tot > 0.9, 'garis tertangkap ' + hit + '/' + tot);
});

test('foto: versi async sama dengan versi sinkron dan melapor tiap tahap', async () => {
  const W = 50, H = 50, src = (x, y) => (x + y < 50 ? [250, 200, 0] : [10, 120, 90]);
  const img = mkImg(W, H, src), steps = [];
  const a = S.fromImage(img, W, H, photoOpt(W, H, { colors: 2 }));
  const b = await S.fromImageAsync(img, W, H, photoOpt(W, H, { colors: 2, onStep: (t) => steps.push(t) }));
  assert.deepEqual(b.stats, a.stats); assert.ok(steps.length >= 4);
  assert.equal(S.toXML(b.model), S.toXML(a.model));
});

test('foto: foto kosong atau data rusak ditolak dengan pesan jelas', () => {
  assert.throws(() => S.fromImage(mkImg(10, 10, () => [0, 0, 0, 0]), 10, 10, photoOpt(10, 10)), /transparan/);
  assert.throws(() => S.fromImage(new Uint8ClampedArray(8), 10, 10, photoOpt(10, 10)), /tidak valid/);
});

test('foto: ukuran kanvas otomatis dinaikkan ke 1080 untuk foto kecil dan hasil deterministik', () => {
  const W = 60, H = 40, src = (x) => (x < 30 ? [255, 0, 0] : [0, 0, 255]);
  const o = { srcW: W, srcH: H, ink: false, colors: 2 };
  const a = S.fromImage(mkImg(W, H, src), W, H, o), b = S.fromImage(mkImg(W, H, src), W, H, o);
  assert.equal(a.model.width, 1080); assert.equal(a.model.height, 720);
  assert.equal(S.toXML(a.model), S.toXML(b.model));
});

/* ---------- gradasi asli (pita warna bertumpuk) ---------- */
const topFill = (m, p) => { let c = null; for (const ly of m.layers) if (ly.rings.some((q) => S.pip(p, q))) c = ly.fill; return c; };
const rgbOf = (f) => [1, 2, 3].map((i) => parseInt(f.slice(2 * i + 1, 2 * i + 3), 16));
const closeTo = (f, exp, e) => { const h = rgbOf(f); exp.forEach((v, i) => assert.ok(Math.abs(h[i] - v) <= e, 'kanal ' + i + ': ' + h[i] + ' != ' + v)); };

test('gradasi linear mengikuti warna SVG (bukan rata-rata)', () => {
  const svg = '<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>';
  const r = conv(svg);
  assert.ok(r.model.layers.length > 10);
  for (const t of [0.05, 0.3, 0.5, 0.8, 0.95]) closeTo(topFill(r.model, [t * 100, 50]), [255 * (1 - t), 0, 255 * t], 6);
  assert.ok(r.warnings.some((w) => /pita warna/.test(w)));
});

test('gradasi radial dan 3 stop userSpaceOnUse', () => {
  const rad = conv('<svg viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>');
  for (const p of [[50, 50], [62, 50], [50, 25], [85, 50]]) { const t = Math.min(1, Math.hypot(p[0] - 50, p[1] - 50) / 50); closeTo(topFill(rad.model, p), [255 * (1 - t), 255 * (1 - t), 255 * (1 - t)], 8); }
  const l3 = conv('<svg viewBox="0 0 100 100"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0"><stop offset="0" stop-color="#ff0"/><stop offset=".5" stop-color="#0f0"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>');
  closeTo(topFill(l3.model, [50, 50]), [0, 255, 0], 6);
  closeTo(topFill(l3.model, [25, 50]), [128, 255, 0], 8);
});

test('gradasi pada bentuk berlubang tidak menutup lubangnya', () => {
  const r = conv('<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#f0f"/><stop offset="1" stop-color="#0ff"/></linearGradient></defs><path fill-rule="evenodd" fill="url(#g)" d="M0 0H100V100H0Z M30 30V70H70V30Z"/></svg>');
  assert.equal(topFill(r.model, [50, 50]), null);
  assert.ok(topFill(r.model, [10, 10]));
});

test('mode warna rata-rata dan gradasi radial transparan memakai satu warna', () => {
  const g = '<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>';
  const r = conv(g, { grad: 'rata' });
  assert.equal(r.model.layers.length, 1);
  assert.ok(r.warnings.some((w) => /rata-rata/.test(w)));
  const t = conv('<svg viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>');
  assert.equal(t.model.layers.length, 1);
  assert.ok(t.warnings.some((w) => /radial yang transparan/.test(w)));
});

test('foto mode bersih: warna peralihan di tepi tidak jadi layer sendiri', () => {
  const w = 80, h = 80, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, t = Math.max(0, Math.min(1, (x - 39) / 2));   // tepi antialias hitam -> kuning selebar 2 px
    d[i] = 16 + t * 225; d[i + 1] = 15 + t * 162; d[i + 2] = 10 + t * 14; d[i + 3] = 255;
  }
  const r = S.fromImage(d, w, h, { colors: 8, canvas: 'custom', width: 80, height: 80, bersih: true, ink: false });
  assert.equal(r.model.layers.length, 2);
});

test('penyederhanaan titik: titik sejajar dibuang, bentuk tetap, bisa dimatikan', () => {
  let d = 'M0 0'; for (let i = 1; i <= 200; i++) d += 'L' + i * 5 + ' 0'; for (let i = 1; i <= 100; i++) d += 'L1000 ' + i * 10; for (let i = 199; i >= 0; i--) d += 'L' + i * 5 + ' 1000'; d += 'Z';
  const svg = '<svg viewBox="0 0 1000 1000"><path fill="#123456" d="' + d + '"/></svg>';
  const off = conv(svg, { simp: 0, canvas: 'custom', width: 1000, height: 1000 }), on = conv(svg, { canvas: 'custom', width: 1000, height: 1000 });
  assert.equal(off.stats.points, off.stats.rawPoints);
  assert.equal(on.stats.points, 4);
  assert.equal(on.stats.rawPoints, off.stats.rawPoints);
  near(Math.abs(S.area(on.model.layers[0].rings[0])), 1e6, 1);
});

test('penyederhanaan titik: lengkungan jadi lebih ringan dengan luas nyaris sama', () => {
  const svg = '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="#00f"/><path fill="#f00" d="M20 100C20 40 80 20 100 20S180 40 180 100 140 180 100 180 20 160 20 100Z"/></svg>';
  const big = { canvas: 'custom', width: 1000, height: 1000 }, off = conv(svg, Object.assign({ simp: 0 }, big)), on = conv(svg, big);
  assert.ok(on.stats.points < off.stats.points * 0.7, on.stats.points + ' vs ' + off.stats.points);
  const A = (r) => r.model.layers.reduce((s, l) => s + l.rings.reduce((a, q) => a + Math.abs(S.area(q)), 0), 0);
  assert.ok(Math.abs(A(on) - A(off)) / A(off) < 0.002);
  const r = S.thinRing([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]], 0.2);
  assert.equal(r.length, 4);
});

/* ---------- garis (stroke), clip-path, dan mode otomatis ---------- */
const wn = (p, rings) => { let w = 0; for (const R of rings) for (let i = 0, n = R.length; i < n; i++) { const a = R[i], b = R[(i + 1) % n]; if (a[1] <= p[1]) { if (b[1] > p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) > 0) w++; } else if (b[1] <= p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) < 0) w--; } return w; };
const covered = (model, p) => model.layers.some((l) => l.rings.some((R) => wn(p, [R]) !== 0));
const polyDist = (p, pts) => Math.min(...pts.slice(1).map((q, i) => dist(p, pts[i], q)));
const sv = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;

test('garis: ujung dan sambungan bulat sama dengan jarak ke garis tengah', () => {
  const pts = [[20, 20], [80, 30], [50, 80], [15, 70]];
  const r = conv(sv('<path d="M20 20L80 30L50 80L15 70" fill="none" stroke="#f00" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'));
  assert.equal(r.model.layers.length, 1); assert.equal(r.model.layers[0].label, 'Garis 1');
  const rnd = lcg(5); let bad = 0, tot = 0;
  for (let k = 0; k < 9000; k++) {
    const p = [rnd() * 100, rnd() * 100], d = polyDist(p, pts);
    if (Math.abs(d - 5) < 0.5) continue;
    tot++; if (covered(r.model, p) !== d < 5) bad++;
  }
  assert.ok(tot > 6000); assert.equal(bad, 0);
});

test('garis: butt, square, dan jenis sambungan miter, bevel, round', () => {
  const g = (a) => conv(sv(`<path d="M10 50H50V10" fill="none" stroke="#000" stroke-width="10" ${a}/>`)).model;
  assert.ok(covered(g('stroke-linejoin="miter"'), [54.5, 54.5]));           // ujung miter
  assert.ok(!covered(g('stroke-linejoin="bevel"'), [54.5, 54.5]));
  assert.ok(!covered(g('stroke-linejoin="round"'), [54.5, 54.5]));
  assert.ok(covered(g('stroke-linejoin="round"'), [53.5, 53.5]));
  assert.ok(!covered(g('stroke-linejoin="miter" stroke-miterlimit="1.2"'), [54.5, 54.5]));   // melebihi batas -> bevel
  assert.ok(!covered(g(''), [50, 4]) && covered(g(''), [50, 11]));                           // butt
  assert.ok(covered(g('stroke-linecap="square"'), [50, 6]) && covered(g('stroke-linecap="square"'), [6, 50]));
  assert.ok(covered(g('stroke-linecap="round"'), [50, 6]) && !covered(g('stroke-linecap="round"'), [46, 5.2]));
});

test('garis tertutup (rect, lingkaran) berlubang di tengah dan luasnya tepat', () => {
  const a = conv(sv('<rect x="20" y="20" width="60" height="60" fill="none" stroke="#00f" stroke-width="10"/>')).model;
  assert.ok(!covered(a, [50, 50]) && covered(a, [20, 50]) && covered(a, [16, 16]) && !covered(a, [12, 50]) && !covered(a, [30, 50]));
  const sum = (m) => m.layers.reduce((t, l) => t + l.rings.reduce((u, R) => u + Math.abs(S.area(R)), 0), 0);
  near(sum(a), 70 * 70 - 50 * 50, 60);
  const c = conv(sv('<circle cx="50" cy="50" r="30" fill="none" stroke="#000" stroke-width="8"/>'), { holes: 'jembatan' }).model;
  assert.ok(!covered(c, [50, 50]) && covered(c, [80, 50]) && covered(c, [50, 80]) && !covered(c, [50, 90]));
  near(c.layers[0].rings.reduce((t, R) => t + S.area(R), 0), Math.PI * (34 * 34 - 26 * 26), 25);
});

test('garis: tikungan tajam dan tebal tetap cocok dengan jarak ke garis tengah (tanpa lubang di sisi dalam)', () => {
  const pts = [[10, 90], [50, 20], [90, 90], [60, 95]];
  const m = conv(sv('<path d="M10 90L50 20L90 90L60 95" fill="none" stroke="#000" stroke-width="30" stroke-linejoin="round" stroke-linecap="round"/>')).model;
  const rnd = lcg(11); let bad = 0, tot = 0;
  for (let k = 0; k < 9000; k++) {
    const p = [rnd() * 100, rnd() * 100], d = polyDist(p, pts);
    if (Math.abs(d - 15) < 0.6) continue;
    tot++; if (covered(m, p) !== d < 15) bad++;
  }
  assert.ok(tot > 6000); assert.equal(bad, 0);
});

test('garis: fill dan stroke bersamaan, stroke ada di atas fill, opasitas dibaca', () => {
  const r = conv(sv('<circle cx="50" cy="50" r="30" fill="#0f0" stroke="#f00" stroke-opacity=".5" stroke-width="6"/>'), { holes: 'jembatan' });
  assert.equal(r.model.layers.length, 2); assert.equal(r.model.layers[0].fill, '#ff00ff00');
  assert.equal(r.model.layers[1].fill, '#80ff0000'); assert.equal(r.model.layers[1].label, 'Garis 2');
});

test('garis: elemen line dan polyline, stroke diwariskan dari grup', () => {
  const r = conv(sv('<g stroke="#123456" stroke-width="4"><line x1="10" y1="10" x2="90" y2="10"/><polyline points="10,30 50,60 90,30" fill="none"/></g>'));
  assert.equal(r.model.layers.length, 2); assert.equal(r.model.layers[0].fill, '#ff123456');
  assert.ok(covered(r.model, [50, 10]) && !covered(r.model, [50, 14]));
});

test('garis: stroke-width 0 atau stroke none tidak membuat layer, lebar mengikuti skala transform', () => {
  assert.throws(() => conv(sv('<path d="M0 0L90 90" stroke="red" stroke-width="0" fill="none"/>')), /bentuk berisi/);
  const m = conv(sv('<g transform="scale(2 1)"><path d="M10 50H40" stroke="#000" stroke-width="10" fill="none"/></g>')).model, b = bb(m.layers[0].rings);
  near(b[2] - b[0], 60, 0.01); near(b[3] - b[1], 10, 0.01);      // x dilebarkan 2x, tebal vertikal tetap 10
});

test('garis putus-putus: jumlah potongan, offset, dan titik (panjang 0 + ujung bulat)', () => {
  const m1 = conv(sv('<path d="M10 50H90" stroke="#000" stroke-width="4" stroke-dasharray="10 10" fill="none"/>')).model;
  assert.equal(m1.layers[0].rings.length, 4);
  assert.ok(covered(m1, [15, 50]) && !covered(m1, [25, 50]) && covered(m1, [35, 50]));
  const m2 = conv(sv('<path d="M10 50H90" stroke="#000" stroke-width="4" stroke-dasharray="10 10" stroke-dashoffset="10" fill="none"/>')).model;
  assert.ok(!covered(m2, [15, 50]) && covered(m2, [25, 50]));
  const m3 = conv(sv('<path d="M10 50H90" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 20" fill="none"/>')).model;
  assert.equal(m3.layers[0].rings.length, 5); assert.ok(covered(m3, [30, 50]) && !covered(m3, [20, 50]));
  assert.equal(S.dashPolys([[0, 0], [10, 0]], false, [3, 3], 0).length, 2);
});

test('garis bergradasi dipecah per pita seperti fill', () => {
  const r = conv(sv('<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="10" y1="0" x2="90" y2="0"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><path d="M10 50H90" stroke="url(#g)" stroke-width="20" fill="none"/>'));
  assert.ok(r.model.layers.length > 4); assert.match(r.warnings.join('|'), /Gradasi/);
});

test('clip-path: rect, lingkaran, dan clip bersarang memotong bentuk', () => {
  const r = conv(sv('<defs><clipPath id="c"><rect x="0" y="0" width="50" height="100"/></clipPath></defs><circle cx="50" cy="50" r="30" fill="#f00" clip-path="url(#c)"/>'));
  const b = bb(r.model.layers[0].rings); near(b[0], 20, 0.2); near(b[2], 50, 0.01);
  assert.ok(!r.warnings.some((x) => /Clip/.test(x))); assert.deepEqual(r.unsupported, []);
  const r2 = conv(sv('<defs><clipPath id="a"><circle cx="50" cy="50" r="20"/></clipPath><clipPath id="b"><rect x="50" y="0" width="50" height="100"/></clipPath></defs><g clip-path="url(#a)"><rect width="100" height="100" fill="#0f0" clip-path="url(#b)"/></g>'));
  const b2 = bb(r2.model.layers[0].rings); near(b2[0], 50, 0.01); near(b2[2], 70, 0.2);
  const r3 = conv(sv('<defs><clipPath id="c"><rect x="200" y="200" width="5" height="5"/></clipPath></defs><rect width="100" height="100" fill="#0f0" clip-path="url(#c)"/><rect width="10" height="10" fill="#00f"/>'));
  assert.equal(r3.model.layers.length, 1); assert.equal(r3.model.layers[0].fill, '#ff0000ff');
});

test('clip-path berbentuk cekung (L) dipecah jadi bidang cembung dengan luas tepat', () => {
  const r = conv(sv('<defs><clipPath id="c"><path d="M0 0H100V40H40V100H0Z"/></clipPath></defs><rect width="100" height="100" fill="#f00" clip-path="url(#c)"/>'), { holes: 'jembatan' });
  const total = r.model.layers[0].rings.reduce((t, R) => t + Math.abs(S.area(R)), 0);
  near(total, 100 * 40 + 40 * 60, 1);
  assert.ok(covered(r.model, [10, 90]) && covered(r.model, [90, 20]) && !covered(r.model, [70, 70]));
  const parts = S.convexParts([[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]]);
  assert.equal(parts.length, 2);
});

test('clip-path yang belum didukung (objectBoundingBox) memberi catatan; mask dan teks ditandai tidak didukung', () => {
  const r = conv(sv('<defs><clipPath id="c" clipPathUnits="objectBoundingBox"><rect width=".5" height="1"/></clipPath></defs><rect width="100" height="100" fill="#f00" clip-path="url(#c)"/><text>a</text>'));
  assert.match(r.warnings.join('|'), /Clip-path/); assert.deepEqual(r.unsupported.sort(), ['clip', 'teks']);
  const m = conv(sv('<mask id="m"><rect width="50" height="100" fill="#fff"/></mask><rect width="100" height="100" fill="#f00" mask="url(#m)"/>'));
  assert.deepEqual(m.unsupported, ['mask']); assert.match(m.warnings.join('|'), /Mask/);
  assert.deepEqual(conv(sv('<rect width="10" height="10" stroke="#000"/>')).unsupported, []);
});

/* ---------- pembersih vektor dobel ---------- */
function paint(model, W = 120, H = 120) {
  const sx = model.width / W, sy = model.height / H, out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = [(x + 0.5) * sx + 0.137, (y + 0.5) * sy + 0.071]; let c = [0, 0, 0, 0];
    for (const L of model.layers) {
      if (!L.rings.some((R) => S.pip(p, R))) continue;
      const a = parseInt(L.fill.slice(1, 3), 16) / 255, rgb = [1, 2, 3].map((k) => parseInt(L.fill.slice(1 + 2 * k, 3 + 2 * k), 16)), ao = a + c[3] * (1 - a);
      c = ao ? [0, 1, 2].map((k) => (rgb[k] * a + c[k] * c[3] * (1 - a)) / ao).concat([ao]) : [0, 0, 0, 0];
    }
    out.push(c);
  }
  return out;
}
function sameLook(a, b) {
  const A = paint(a), B = paint(b); let bad = 0;
  for (let i = 0; i < A.length; i++) if (Math.max(...[0, 1, 2].map((k) => Math.abs(A[i][k] - B[i][k])), Math.abs(A[i][3] - B[i][3]) * 255) > 2.5) bad++;
  assert.equal(bad, 0);
}
const wrap = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + inner + '</svg>';

test('rapikan: layer opak yang kembar persis tinggal satu, tampilan tidak berubah', () => {
  const svg = wrap('<rect width="100" height="100" fill="#123"/><circle cx="50" cy="50" r="30" fill="#e33"/><circle cx="50" cy="50" r="30" fill="#e33"/><circle cx="50" cy="50" r="30" fill="#e33"/>');
  const a = conv(svg, { tidy: false }), b = conv(svg);
  assert.equal(a.model.layers.length, 4); assert.equal(b.model.layers.length, 2);
  assert.equal(b.stats.tidy.same, 2);
  assert.ok(b.warnings.some((w) => /Dirapikan/.test(w)));
  sameLook(a.model, b.model);
});

test('rapikan: bentuk yang tertutup penuh bentuk opak di atasnya dibuang, yang sebagian tertutup dipertahankan', () => {
  const svg = wrap('<rect x="40" y="40" width="10" height="10" fill="#0f0"/><rect x="5" y="5" width="30" height="30" fill="#0f0"/><rect x="30" y="30" width="30" height="30" fill="#00f"/><rect x="20" y="20" width="60" height="60" fill="#f00"/>');
  const a = conv(svg, { tidy: false }), b = conv(svg);
  assert.equal(a.model.layers.length, 4);
  assert.equal(b.model.layers.length, 2);            // hijau kecil dan biru tertutup penuh oleh merah; hijau besar hanya sebagian, jadi tetap
  assert.deepEqual(b.model.layers.map((l) => l.fill), ['#ff00ff00', '#ffff0000']);
  assert.equal(b.stats.tidy.hidden, 2);
  sameLook(a.model, b.model);
});

test('rapikan: bentuk di dalam bentuk sewarna dibuang hanya bila tak ada warna lain di antaranya', () => {
  const free = wrap('<rect x="10" y="10" width="80" height="80" fill="#f80"/><rect x="30" y="30" width="20" height="20" fill="#f80"/>');
  assert.equal(conv(free).model.layers.length, 1);
  const blocked = wrap('<rect x="10" y="10" width="80" height="80" fill="#f80"/><rect x="20" y="20" width="60" height="60" fill="#00f"/><rect x="30" y="30" width="20" height="20" fill="#f80"/>');
  const a = conv(blocked, { tidy: false }), b = conv(blocked);
  assert.equal(b.model.layers.length, 3);             // oranye kecil menimpa biru, tidak boleh dibuang
  sameLook(a.model, b.model);
});

test('rapikan: layer transparan kembar yang bersebelahan digabung dengan alfa gabungan, bukan dibuang', () => {
  const svg = wrap('<circle cx="50" cy="50" r="30" fill="#00f" fill-opacity=".4"/><circle cx="50" cy="50" r="30" fill="#00f" fill-opacity=".4"/>');
  const a = conv(svg, { tidy: false }), b = conv(svg);
  assert.equal(b.model.layers.length, 1);
  near(parseInt(b.model.layers[0].fill.slice(1, 3), 16), Math.round((1 - 0.6 * 0.6) * 255), 2);
  sameLook(a.model, b.model);
  // transparan kembar yang dipisah layer lain tidak digabung (urutan tumpukan ikut menentukan warna)
  const sep = wrap('<circle cx="50" cy="50" r="30" fill="#00f" fill-opacity=".4"/><rect width="100" height="100" fill="#f00" fill-opacity=".5"/><circle cx="50" cy="50" r="30" fill="#00f" fill-opacity=".4"/>');
  assert.equal(conv(sep).model.layers.length, 3);
});

test('rapikan: bidang kembar di satu layer dan titik sejajar atau duri dibuang', () => {
  const svg = wrap('<path fill="#0a0" d="M10 10L10 10L50 10L90 10L90 90L50 90L10 90zM10 10L50 10L90 10L90 90L10 90z"/>');
  const a = conv(svg, { tidy: false, simp: 0.2 }), b = conv(svg, { simp: 0.2 });
  assert.ok(b.stats.points < a.stats.points);
  b.model.layers.forEach((l) => l.rings.forEach((R) => assert.equal(R.length, 4)));   // persegi bersih: 4 titik
  const R = S.cleanRing([[0, 0], [10, 0], [10, 10], [10, 4], [0, 10]]);               // ujung duri (10,10) menjorok lalu kembali
  assert.ok(R.length >= 4);
  sameLook(a.model, b.model);
});

test('rapikan: tidy false mematikan semuanya, dan titik apa adanya dihormati saat penyederhanaan mati', () => {
  const svg = wrap('<rect width="100" height="100" fill="#123"/><circle cx="50" cy="50" r="30" fill="#e33"/><circle cx="50" cy="50" r="30" fill="#e33"/>');
  assert.equal(conv(svg, { tidy: false }).model.layers.length, 3);
  assert.equal(conv(svg, { tidy: false }).stats.tidy, null);
  const off = conv(wrap('<path fill="#0a0" d="M10 10L50 10L90 10L90 90L10 90z"/>'), { simp: 0 });
  assert.equal(off.model.layers[0].rings[0].length, 5);   // titik sejajar tetap ada bila penyederhanaan Mati
});

test('rapikan: nama layer dinomori ulang berurutan setelah ada yang dibuang', () => {
  const svg = wrap('<rect width="100" height="100" fill="#123"/><rect x="10" y="10" width="10" height="10" fill="#0f0"/><rect x="5" y="5" width="40" height="40" fill="#f00"/><circle cx="70" cy="70" r="20" fill="#ff0"/>');
  const b = conv(svg);
  assert.deepEqual(b.model.layers.map((l) => l.label), ['Objek 1', 'Objek 2', 'Objek 3']);
});

test('rapikan: 40 SVG acak penuh bentuk kembar dan bertumpuk tampil sama persis sebelum dan sesudah', () => {
  const pal = ['#e33', '#3e3', '#33e', '#ee3', '#fff', '#222'];
  let removed = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = lcg(seed * 7919), els = [], n = 8 + Math.floor(r() * 30);
    for (let i = 0; i < n; i++) {
      const c = pal[Math.floor(r() * pal.length)], op = r() < 0.25 ? ' fill-opacity="' + (0.3 + r() * 0.5).toFixed(2) + '"' : '', k = r(), x = r() * 70, y = r() * 70, w = 8 + r() * 40, h = 8 + r() * 40;
      let el;
      if (k < 0.3) el = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${op}/>`;
      else if (k < 0.55) el = `<circle cx="${x + 15}" cy="${y + 15}" r="${6 + r() * 15}" fill="${c}"${op}/>`;
      else if (k < 0.75) el = `<path fill="${c}"${op} fill-rule="evenodd" d="M${x} ${y}h${w}v${h}h${-w}zM${x + w * .25} ${y + h * .25}h${w * .5}v${h * .5}h${-w * .5}z"/>`;
      else el = `<polygon fill="${c}"${op} points="${x},${y} ${x + w},${y + h * .3} ${x + w * .4},${y + h}"/>`;
      els.push(el); if (r() < 0.3) els.push(el);
    }
    for (const holes of ['pecah', 'jembatan']) {
      const svg = wrap(els.join('')), a = conv(svg, { tidy: false, holes }), b = conv(svg, { holes });
      removed += a.stats.pieces - b.stats.pieces;
      sameLook(a.model, b.model);
    }
  }
  assert.ok(removed > 100);
});

test('rapikan: mode foto juga dirapikan tanpa mengubah tampilan', () => {
  const W = 120, H = 120, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; let c = [240, 240, 235];
    if ((x - 40) ** 2 + (y - 60) ** 2 < 900) c = [220, 50, 50];
    if (Math.abs(y - 100) < 1.5) c = [10, 10, 10];
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  const a = S.fromImage(px, W, H, { tidy: false, bersih: false, ink: true }), b = S.fromImage(px, W, H, { bersih: false, ink: true });
  assert.ok(b.model.layers.length <= a.model.layers.length && b.stats.points <= a.stats.points);
  sameLook(a.model, b.model);
});

test('rapikan: bentuk di dalam lubang (garis bingkai, donat) tidak dianggap tertutup, walau sudutnya menempel di tepi lubang', () => {
  const frame = wrap('<rect x="15" y="15" width="30" height="30" fill="#f00"/><rect x="10" y="10" width="80" height="80" fill="none" stroke="#0a0" stroke-width="10"/>');
  const donut = wrap('<circle cx="50" cy="50" r="12" fill="#00f"/><path fill="#fa0" fill-rule="evenodd" d="M10 10h80v80h-80zM25 25h50v50h-50z"/>');
  for (const holes of ['pecah', 'jembatan']) for (const svg of [frame, donut]) {
    const a = conv(svg, { tidy: false, holes }), b = conv(svg, { holes });
    assert.equal(b.model.layers.length, a.model.layers.length, holes);
    sameLook(a.model, b.model);
  }
});

test('rapikan: gradasi bertumpuk, garis, clip-path, dan use yang kembar tampil sama persis (acak, termasuk Jembatan)', () => {
  const pal = ['#e33', '#3e3', '#33e', '#ee3', '#fff', '#222', '#f80'];
  const defs = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient><clipPath id="c"><circle cx="60" cy="60" r="45"/></clipPath><g id="u"><rect width="30" height="30" fill="#e33"/></g></defs>';
  for (const seed of [4, 30, 42, 47, 60]) {
    const r = lcg(seed * 104729), els = [], n = 8 + Math.floor(r() * 25);
    for (let i = 0; i < n; i++) {
      const k = r(), c = pal[Math.floor(r() * pal.length)], x = r() * 120, y = r() * 120, w = 10 + r() * 60, h = 10 + r() * 60;
      const fill = r() < 0.2 ? 'url(#g)' : c, op = r() < 0.2 ? ' opacity=".6"' : '';
      const stroke = r() < 0.3 ? ` stroke="${pal[Math.floor(r() * pal.length)]}" stroke-width="${1 + r() * 6}" stroke-linejoin="round"` : '';
      let el;
      if (k < 0.3) el = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke}${op}/>`;
      else if (k < 0.55) el = `<circle cx="${x}" cy="${y}" r="${5 + r() * 30}" fill="${fill}"${stroke}${op}/>`;
      else if (k < 0.7) el = `<path fill="${fill}" fill-rule="evenodd"${stroke} d="M${x} ${y}h${w}v${h}h${-w}zM${x + w * .25} ${y + h * .25}h${w * .5}v${h * .5}h${-w * .5}z"/>`;
      else if (k < 0.8) el = `<use href="#u" transform="translate(${x} ${y}) rotate(${r() * 90})"/>`;
      else el = `<g clip-path="url(#c)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/></g>`;
      els.push(el); if (r() < 0.3) els.push(el);
    }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' + defs + els.join('') + '</svg>';
    for (const holes of ['pecah', 'jembatan']) { const a = conv(svg, { tidy: false, holes }), b = conv(svg, { holes }); sameLook(a.model, b.model); }
  }
});
