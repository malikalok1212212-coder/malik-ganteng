#!/usr/bin/env python3
"""Minify src/style.css -> public/style.css (tanpa dependensi). Jalankan setiap selesai mengubah src/style.css.
Aman: hanya membuang komentar dan spasi di sekitar { } : ; , dan baris baru; isi string dan url() tidak disentuh."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
css = (ROOT / 'src' / 'style.css').read_text(encoding='utf8')
keep = []
def stash(m): keep.append(m.group(0)); return '\0%d\0' % (len(keep) - 1)
css = re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|url\([^)]*\)', stash, css)   # string dan url() disimpan dulu
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'\s+', ' ', css)
css = re.sub(r'\s*([{};,>])\s*', r'\1', css)
css = re.sub(r':\s+', ':', css)
css = css.replace(';}', '}').strip()
css = re.sub(r'\0(\d+)\0', lambda m: keep[int(m.group(1))], css)
out = ROOT / 'public' / 'style.css'
out.write_text(css, encoding='utf8')
print('style.css: %d -> %d byte' % (len((ROOT / 'src' / 'style.css').read_bytes()), len(css.encode())))
