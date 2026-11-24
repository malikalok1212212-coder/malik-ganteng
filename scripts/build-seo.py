#!/usr/bin/env python3
"""Buat halaman SEO per tool, sitemap.xml, dan robots.txt dari array TOOLS_FULL di public/js/tools.js.

Jalankan dari folder proyek setiap kali menambah atau mengubah tool:
    python3 scripts/build-seo.py
Hasil: public/tools/<id>.html (tampil di /tools/<id>), public/sitemap.xml, public/robots.txt
"""
import re, json, html, colorsys, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
SITE = 'https://www.maliktools.biz.id'
LASTMOD = '2026-11-22'
LASTMOD_ID = '22 November 2026'

src = (PUB / 'js' / 'tools.js').read_text(encoding='utf8')
start = src.index('const TOOLS_FULL=[')
un = lambda x: x.replace("\\'", "'").replace('\\\\', '\\')
tools, seen = [], set()
for m in re.finditer(r"\{id:'([a-z0-9-]+)',name:'((?:[^'\\]|\\.)*)',desc:'((?:[^'\\]|\\.)*)'", src[start:]):
    if m[1] not in seen:
        seen.add(m[1])
        tools.append((m[1], un(m[2]), un(m[3])))

# Warna aksen: ungu yang paling sering dipakai di style.css (fallback #8b5cf6)
accent = '#8b5cf6'
css_path = PUB / 'style.css'
if css_path.exists():
    cnt = collections.Counter(h.lower() for h in re.findall(r'#([0-9a-fA-F]{6})\b', css_path.read_text(encoding='utf8')))
    for h, _ in cnt.most_common():
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
        if 0.69 <= hue <= 0.80 and sat >= 0.4 and val >= 0.5:
            accent = '#' + h
            break

PAGE = """<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>@TITLE@</title>
<meta name="description" content="@DESC@">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0b0c0f">
<link rel="canonical" href="@URL@">
<link rel="icon" href="/favicon.ico?v=331" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=331">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Malik Tools">
<meta property="og:locale" content="id_ID">
<meta property="og:title" content="@TITLE@">
<meta property="og:description" content="@DESC@">
<meta property="og:url" content="@URL@">
<meta property="og:image" content="@SITE@/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">@LD@</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Montserrat:ital,wght@1,800&family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="/page.css?v=414">
<script>try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}</script>
</head>
<body>
<header class="bar"><div class="wrap"><a class="brand" href="/"><img src="/logo.jpg?v=331" alt="" width="34" height="34"><span>Malik Tools</span></a><button type="button" class="ib" id="th" aria-label="Ganti tema"><svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg></button><a class="go" href="/">Buka</a></div></header>
<main class="wrap">
<span class="tag">Tool gratis</span>
<h1>@NAME@</h1>
<p class="lead">@DESC@</p>
<a class="cta" href="/#@ID@">Buka @NAME@</a>
<p class="note">Gratis dipakai langsung di browser. Masuk dengan akun untuk memakai tool.</p>
<section class="cd"><h2>Tools lainnya</h2><ul class="tl">@LIST@</ul></section>
</main>
<div class="wrap"><footer><nav class="fl" aria-label="Informasi"><a href="/tentang">Tentang</a><a href="/privasi">Privasi</a><a href="/syarat">Syarat</a><a href="/bantuan">Bantuan</a></nav><p>Malik Tools, kumpulan tools gratis di browser.</p></footer></div>
<script>document.getElementById('th').onclick=function(){var r=document.documentElement,n=r.dataset.theme==='light'?'dark':'light';r.dataset.theme=n;try{localStorage.setItem('theme',n)}catch(e){}}</script>
</body>
</html>
"""

out = PUB / 'tools'
out.mkdir(exist_ok=True)
for f in out.glob('*.html'):
    f.unlink()


def short(d):
    d = d.strip()
    if len(d) > 150:
        d = d[:147].rsplit(' ', 1)[0].rstrip('.,;:') + '...'
    elif len(d) < 110:
        d = d.rstrip('.') + '. Gratis di Malik Tools.'
    return d


for tid, name, desc in tools:
    url = f'{SITE}/tools/{tid}'
    d = short(desc)
    ld = json.dumps([
        {'@context': 'https://schema.org', '@type': 'SoftwareApplication', 'name': name, 'description': d,
         'url': url, 'applicationCategory': 'UtilitiesApplication', 'operatingSystem': 'Web',
         'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'IDR'}},
        {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Malik Tools', 'item': SITE + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': name, 'item': url}]},
    ], ensure_ascii=False).replace('</', '<\\/')
    items = ''.join(f'<li><a href="/tools/{i}">{html.escape(n)}</a></li>' for i, n, _ in tools if i != tid)
    page = (PAGE.replace('@TITLE@', html.escape(f'{name} gratis online | Malik Tools'))
            .replace('@DESC@', html.escape(d, quote=True)).replace('@URL@', url).replace('@SITE@', SITE)
            .replace('@LD@', ld).replace('@ACCENT@', accent).replace('@NAME@', html.escape(name))
            .replace('@ID@', tid).replace('@LIST@', items))
    (out / f'{tid}.html').write_text(page, encoding='utf8')

# ---- Halaman informasi (kepercayaan): /tentang /privasi /syarat /bantuan ----
INFO = re.sub(r'<main class="wrap">.*?</main>', '<main class="wrap prose">@BODY@</main>', PAGE, flags=re.S)
assert '@BODY@' in INFO


def cards(body, label):
    body = body.replace('<h1>', f'<span class="tag">{label}</span>\n<h1>', 1)
    head, *secs = re.split(r'(?=<h2>)', body)
    ctas, out = [], []
    for sec in secs:
        for m in re.findall(r'<p><a class="cta".*?</a></p>', sec, flags=re.S):
            ctas.append(m)
            sec = sec.replace(m, '')
        out.append('<section class="cd">' + sec.strip() + '</section>')
    return head + '\n'.join(out) + '\n' + ''.join(c.replace('<p>', '').replace('</p>', '') for c in ctas)

WA = 'https://wa.me/6285772295147'
CH = 'https://whatsapp.com/channel/0029VbEOTvX6GcGLFkDqfv22'
N = len(tools)
LABELS = {'tentang': 'Tentang', 'privasi': 'Privasi', 'syarat': 'Syarat', 'bantuan': 'Bantuan'}
info_pages = [
('tentang', 'Tentang Malik Tools', 'Malik Tools adalah kumpulan tools gratis yang dipakai langsung dari browser di HP, tanpa pasang aplikasi.', f'''
<h1>Tentang Malik Tools</h1>
<p class="lead">Malik Tools adalah kumpulan tools gratis yang dipakai langsung dari browser di HP, tanpa memasang aplikasi.</p>
<h2>Isinya</h2>
<p>Saat ini ada {N} tool. Sebagian besar untuk mengunduh video dan audio (TikTok, Instagram, YouTube, MediaFire, SoundCloud, Dailymotion), membuat gambar dan video pendek (Brat, fake chat, quote card), dan mengolah gambar (hapus background, perbesar resolusi, konversi format). Ada juga QR Code, cek situs, screenshot website, suara dari teks, dan tool Alight Motion.</p>
<h2>Cara kerjanya</h2>
<p>Kamu memasukkan tautan, teks, atau foto. Permintaan itu diproses lewat penyedia API pihak ketiga, lalu hasilnya dikirim ke browser kamu. Karena bergantung pada penyedia, sebuah tool kadang bisa gangguan. Saat itu terjadi, halaman tool menampilkan pesan gangguan sampai diaktifkan lagi.</p>
<h2>Kenapa perlu masuk akun</h2>
<p>Akun dipakai untuk membatasi penyalahgunaan dan menghitung jatah pemakaian harian per akun. Kamu bisa masuk dengan Google, atau daftar dengan email dan kata sandi.</p>
<h2>Gratis dan role</h2>
<p>Tool bisa dipakai gratis. Untuk tool yang punya batas harian, role Premium dan VIP memberi jatah lebih besar. Role dibeli lewat chat developer.</p>
<h2>Pembuat</h2>
<p>Dibuat dan dikelola oleh Malik. Pertanyaan dan laporan error ada di halaman <a href="/bantuan">Bantuan</a>.</p>
<p><a class="cta" href="/">Buka Malik Tools</a></p>'''),
('privasi', 'Kebijakan Privasi', 'Data apa yang disimpan Malik Tools, untuk apa, pihak ketiga yang terlibat, dan cara meminta data dihapus.', f'''
<h1>Kebijakan Privasi</h1>
<p class="upd">Diperbarui {LASTMOD_ID}</p>
<p class="lead">Halaman ini menjelaskan data apa yang disimpan Malik Tools, untuk apa, dan bagaimana kamu bisa memintanya dihapus.</p>
<h2>Data yang kami simpan</h2>
<ul>
<li>Akun: email, nama, dan foto profil (jika masuk dengan Google), atau username dan email (jika daftar manual). Kata sandi disimpan sebagai hash, bukan teks asli.</li>
<li>Aktivitas akun: role, status blokir, jumlah masuk, waktu terakhir aktif, dan sisa jatah pemakaian harian.</li>
<li>Global Chat: pesan, nama, foto profil, dan badge role yang tampil publik. Sistem menyimpan 200 pesan terakhir.</li>
<li>Foto di chat: disimpan di penyimpanan file dan bisa dibuka oleh siapa pun yang punya tautannya. Foto ikut terhapus saat pesannya dihapus atau terpotong dari 200 pesan terakhir.</li>
<li>Catatan aktivitas developer, misalnya pemberian role atau pemblokiran, untuk keperluan pengelolaan.</li>
</ul>
<h2>Data di perangkatmu</h2>
<p>Tema, tool favorit, statistik pemakaian, dan pengaturan profil disimpan di browser perangkat kamu. Sesi masuk memakai cookie yang tidak bisa dibaca oleh skrip halaman.</p>
<h2>Data yang kamu masukkan ke tool</h2>
<p>Tautan, teks, atau foto yang kamu kirim diteruskan ke penyedia layanan pihak ketiga untuk diproses. Foto yang kamu unggah dijadikan tautan sementara agar bisa diproses, lalu dibersihkan otomatis secara berkala. Jangan memasukkan data yang kamu anggap rahasia.</p>
<h2>Pihak ketiga yang terlibat</h2>
<ul>
<li>Google, untuk masuk dengan akun Google.</li>
<li>Vercel, untuk hosting dan penyimpanan file.</li>
<li>Upstash, untuk basis data akun, chat, dan saldo koin.</li>
<li>Penyedia API tool (GenCipta dan api-cloud), yang menerima tautan, teks, atau foto yang kamu kirim lewat tool.</li>
<li>Penyedia email (SMTP), untuk mengirim kode verifikasi.</li>
</ul>
<p>Masing-masing punya kebijakan privasinya sendiri.</p>
<h2>Penjualan data</h2>
<p>Kami tidak menjual data pengguna.</p>
<h2>Menghapus data</h2>
<p>Untuk menghapus akun atau data kamu, hubungi developer lewat <a href="{WA}" rel="noopener">WhatsApp</a> dan sebutkan email akunmu.</p>
<h2>Perubahan</h2>
<p>Kebijakan ini bisa diperbarui. Tanggal pembaruan terbaru ada di bagian atas halaman.</p>'''),
('syarat', 'Syarat Penggunaan', 'Aturan memakai Malik Tools: pemakaian yang wajar, akun, batas harian, dan batas tanggung jawab layanan.', f'''
<h1>Syarat Penggunaan</h1>
<p class="upd">Diperbarui {LASTMOD_ID}</p>
<p class="lead">Dengan memakai Malik Tools, kamu setuju dengan syarat berikut.</p>
<h2>Pemakaian yang wajar</h2>
<ul>
<li>Pakai tool untuk konten milikmu atau konten yang kamu berhak memakainya. Kamu bertanggung jawab atas hak cipta dan hukum yang berlaku untuk konten yang kamu unduh, buat, atau bagikan.</li>
<li>Dilarang membuat spam, memakai skrip atau otomatisasi massal, menghindari batas harian, atau mengganggu layanan.</li>
<li>Di Global Chat, dilarang melecehkan orang lain, menyebar konten ilegal, atau menyamar sebagai orang lain.</li>
</ul>
<h2>Akun</h2>
<p>Kamu bertanggung jawab menjaga akun dan kata sandimu. Akun yang menyalahgunakan layanan bisa diperingatkan atau diblokir.</p>
<h2>Batas harian dan role</h2>
<p>Tool tertentu punya batas pemakaian harian. Jatahnya bergantung pada role akun. Pembelian role dilakukan lewat chat developer, dan ketentuannya disepakati saat pembelian.</p>
<h2>Layanan apa adanya</h2>
<p>Tool bergantung pada penyedia API pihak ketiga, jadi hasil dan ketersediaannya tidak dijamin. Tool bisa berubah, dinonaktifkan sementara, atau dihentikan tanpa pemberitahuan sebelumnya.</p>
<h2>Konten pihak ketiga</h2>
<p>Malik Tools tidak memiliki video, audio, atau gambar yang diunduh lewat tool. Hak atas konten itu tetap ada pada pemiliknya.</p>
<h2>Perubahan syarat</h2>
<p>Syarat ini bisa diperbarui. Memakai layanan setelah pembaruan berarti kamu menerima syarat yang baru. Pertanyaan bisa dikirim lewat halaman <a href="/bantuan">Bantuan</a>.</p>'''),
('bantuan', 'Bantuan', 'Jawaban pertanyaan umum soal Malik Tools: gratis atau tidak, login, tool error, beli role, dan cara menghubungi developer.', f'''
<h1>Bantuan</h1>
<p class="lead">Jawaban untuk pertanyaan yang paling sering muncul.</p>
<h2>Apakah Malik Tools gratis?</h2>
<p>Ya, tool bisa dipakai gratis. Tool yang punya batas harian bisa dinaikkan jatahnya dengan role Premium atau VIP.</p>
<h2>Kenapa harus masuk akun?</h2>
<p>Untuk membatasi penyalahgunaan dan menghitung jatah harian per akun. Kamu bisa masuk dengan Google atau email.</p>
<h2>Tool-nya error atau tidak mau jalan, harus bagaimana?</h2>
<p>Coba lagi beberapa menit kemudian. Banyak tool bergantung pada penyedia pihak ketiga yang kadang gangguan. Kalau terus berlanjut, kirim laporan lewat menu Feedback di aplikasi atau chat developer.</p>
<h2>Bagaimana cara membeli role Premium atau VIP?</h2>
<p>Buka menu Beli Role di aplikasi, lalu chat developer lewat WhatsApp. Kalau punya kode redeem, masukkan di halaman Beli Role atau Profil.</p>
<h2>Lupa kata sandi?</h2>
<p>Di layar masuk pilih Lupa kata sandi. Kode reset dikirim ke email akunmu.</p>
<h2>Bagaimana data saya diperlakukan?</h2>
<p>Lihat <a href="/privasi">Kebijakan Privasi</a>.</p>
<h2>Hubungi developer</h2>
<ul>
<li><a href="{WA}" rel="noopener">Chat developer</a></li>
<li><a href="{CH}" rel="noopener">Saluran WhatsApp</a></li>
</ul>'''),
]
for slug, title, d, body in info_pages:
    url = f'{SITE}/{slug}'
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'WebPage', 'name': title, 'description': d, 'url': url,
                     'inLanguage': 'id', 'isPartOf': {'@type': 'WebSite', 'name': 'Malik Tools', 'url': SITE + '/'}},
                    ensure_ascii=False).replace('</', '<\\/')
    (PUB / f'{slug}.html').write_text(
        INFO.replace('@TITLE@', html.escape(f'{title} | Malik Tools')).replace('@DESC@', html.escape(d, quote=True))
        .replace('@URL@', url).replace('@SITE@', SITE).replace('@LD@', ld).replace('@ACCENT@', accent)
        .replace('@BODY@', cards(body, LABELS.get(slug, 'Info')))
        .replace(f'<a href="/{slug}">', f'<a href="/{slug}" aria-current="page">'), encoding='utf8')

urls = [(SITE + '/', '1.0')] + [(f'{SITE}/tools/{t[0]}', '0.8') for t in tools] + [(f'{SITE}/{p[0]}', '0.5') for p in info_pages]
(PUB / 'sitemap.xml').write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + ''.join(f'  <url><loc>{u}</loc><lastmod>{LASTMOD}</lastmod><priority>{p}</priority></url>\n' for u, p in urls)
    + '</urlset>\n', encoding='utf8')
(PUB / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {SITE}/sitemap.xml\n', encoding='utf8')
print(f'{len(tools)} tool, aksen {accent}')
