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
  const r = conv(svg), w = r.warnings.join('|');
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
