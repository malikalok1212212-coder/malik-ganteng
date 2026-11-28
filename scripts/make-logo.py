#!/usr/bin/env python3
"""Buat ulang semua logo/ikon situs dari src/logo-source.png (logo putih di latar hitam). Jalankan: python3 scripts/make-logo.py"""
import pathlib, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
R = pathlib.Path(__file__).resolve().parent.parent; P = R / 'public'
src = Image.open(R / 'src' / 'logo-source.png').convert('RGB')    # logo asli berwarna (putih + mata merah) di latar hitam
a = np.array(src); lum = a.astype(int).sum(axis=2) / 3
ys, xs = np.where(lum > 40); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
mark = src.crop((x0, y0, x1, y1))                                    # piksel logo apa adanya (tanpa diwarnai ulang)
mw, mh = mark.size
sub_rgb = a[y0:y1, x0:x1].astype(int)
white = (sub_rgb.min(axis=2) > 128)                                   # badan putih
red = (sub_rgb[:, :, 0] > 150) & (sub_rgb[:, :, 1] < 140) & (sub_rgb[:, :, 2] < 140)   # mata merah
RED_HEX = '#%02x%02x%02x' % tuple(int(v) for v in sub_rgb[red].mean(axis=0)) if red.any() else '#ff4444'
mask = white
def tile(size, pad, shape='square', alpha=False):
    s = size * 4
    bg = Image.new('RGBA', (s, s), (0, 0, 0, 255))
    k = s * (1 - 2 * pad) / max(mw, mh)
    m = mark.resize((round(mw * k), round(mh * k)), Image.LANCZOS)
    bg.paste(m.convert('RGBA'), ((s - m.width) // 2, (s - m.height) // 2))
    if shape == 'circle':
        mk = Image.new('L', (s, s), 0); ImageDraw.Draw(mk).ellipse((0, 0, s - 1, s - 1), fill=255); bg.putalpha(mk)
    elif shape == 'round':
        mk = Image.new('L', (s, s), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 5, fill=255); bg.putalpha(mk)
    out = bg.resize((size, size), Image.LANCZOS)
    return out if alpha else out.convert('RGB')
tile(64, .10, 'round', True).save(P / 'favicon.png')
tile(16, .04, 'square', True).save(P / 'favicon-16.png')
tile(32, .06, 'square', True).save(P / 'favicon-32.png')
tile(48, .08).save(P / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)]) if False else None
ico = tile(256, .08, 'square'); ico.save(P / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
tile(192, .16, 'square', True).save(P / 'icon-192.png')
tile(512, .16, 'square', True).save(P / 'icon-512.png')
tile(512, .30).save(P / 'icon-maskable-512.png')
tile(180, .16).save(P / 'apple-touch-icon.png')
tile(256, .16).save(P / 'logo.jpg', quality=93)
tile(480, .16).save(P / 'intro.jpg', quality=92)
tile(256, .16, 'circle', True).save(P / 'pemandu.png')
# vektor
def contour_d(m, eps):
    cs, hier = cv2.findContours((m * 255).astype('uint8'), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    d = ''
    for c in cs:
        ap = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(ap) >= 3: d += 'M' + ' '.join('%d %d' % (x, y) for x, y in ap) + 'Z'
    return d
d = contour_d(white, 1.6); dr = contour_d(red, 0.8)
def path(box, pad):
    k = box * (1 - 2 * pad) / max(mw, mh); tx = (box - mw * k) / 2; ty = (box - mh * k) / 2
    return '<g transform="translate(%.2f %.2f) scale(%.5f)"><path fill="#fff" fill-rule="evenodd" d="%s"/><path fill="%s" fill-rule="evenodd" d="%s"/></g>' % (tx, ty, k, d, RED_HEX, dr)
(P / 'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#000"/>%s</svg>' % path(512, .2))
(P / 'logo-malik-tools.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="96" fill="#000"/>%s</svg>' % path(512, .16))
g = '<g transform="translate(24 24)">%s</g>' % path(252, .0)
(P / 'logo-malik-tools-wordmark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1117 300" width="1117" height="300"><rect width="1117" height="300" rx="40" fill="#0b0b0d"/><rect x="24" y="24" width="252" height="252" rx="48" fill="#000"/><g transform="translate(24 24)">%s</g><text x="320" y="176" font-family="Plus Jakarta Sans,Inter,Arial,sans-serif" font-size="108" font-weight="800" fill="#f5f5f6" letter-spacing="-3">Malik Tools</text><rect x="324" y="206" width="84" height="8" rx="4" fill="#e3262e"/></svg>' % path(252, .16))
# og
def font(sz, b=True):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if b else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        return ImageFont.truetype(f, sz)
og = Image.new('RGB', (1200, 630), (11, 11, 13)); dr = ImageDraw.Draw(og)
glow = Image.new('RGB', (1200, 630), (11, 11, 13)); ImageDraw.Draw(glow).ellipse((600, -300, 1500, 400), fill=(60, 12, 14))
og = Image.blend(og, glow, .8); dr = ImageDraw.Draw(og)
og.paste(tile(300, .16, 'round', True).convert('RGBA'), (90, 165), tile(300, .16, 'round', True))
dr.text((430, 215), 'Malik Tools', font=font(88), fill=(245, 245, 246))
dr.rectangle((434, 330, 520, 338), fill=(227, 38, 46))
dr.text((432, 365), 'Tools gratis di browser:', font=font(34, False), fill=(161, 161, 169))
dr.text((432, 412), 'downloader, maker, dan utilitas.', font=font(34, False), fill=(161, 161, 169))
og.save(P / 'og.jpg', quality=92); og.save(P / 'og.png')
print('selesai; path svg', len(d), 'byte')
