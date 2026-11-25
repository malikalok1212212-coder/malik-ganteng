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
  assert.match(w, /Garis \(stroke\)/); assert.match(w, /Teks/); assert.match(w, /Gradasi/); assert.match(w, /Clip-path/); assert.match(w, /Filter/); assert.match(w, /CSS/);
  assert.equal(r.model.layers[0].fill, '#ff808080');
});

test('error yang jelas untuk file bukan SVG atau SVG tanpa bentuk berisi', () => {
  assert.throws(() => S.convert('halo dunia'), /bukan SVG/);
  assert.throws(() => S.convert('<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="red"/></svg>'), /bentuk berisi warna/);
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
