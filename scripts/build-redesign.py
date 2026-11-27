#!/usr/bin/env python3
"""Sisipkan src/redesign.css (tanda § -> prefiks spesifisitas) ke akhir src/style.css lalu minify ke public/style.css."""
import pathlib, re, subprocess, sys
R = pathlib.Path(__file__).resolve().parent.parent
P = 'html' + ''.join(':not(#%s)' % ('_' * i) for i in range(1, 7)) + ':root' * 6
S, E = '/* ===== REDESIGN-START ===== */', '/* ===== REDESIGN-END ===== */'
css = (R / 'src' / 'style.css').read_text(encoding='utf8')
css = re.sub(re.escape(S) + '.*?' + re.escape(E) + r'\n?', '', css, flags=re.S)
src = (R / 'src' / 'redesign.css').read_text(encoding='utf8').replace('§', P)
(R / 'src' / 'style.css').write_text(css.rstrip('\n') + '\n' + S + '\n' + src + '\n' + E + '\n', encoding='utf8')
subprocess.run([sys.executable, str(R / 'scripts' / 'minify-css.py')], check=True)
