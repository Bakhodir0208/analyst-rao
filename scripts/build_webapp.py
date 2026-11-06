"""
Собирает WebApp.html — однофайловую версию приложения для Apps Script
(HtmlService), чтобы РАО открывался прямо по ссылке веб-приложения
без GitHub Pages. Запуск из папки проекта:  python3 scripts/build_webapp.py
"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css  = (root / 'index.css').read_text(encoding='utf-8')
js   = (root / 'app.js').read_text(encoding='utf-8')

# 1) Убрать регистрацию service worker (в HtmlService не работает)
html = re.sub(r"\s*<script>\s*if \('serviceWorker' in navigator\).*?</script>", "", html, count=1, flags=re.S)
# 2) Убрать manifest / иконки (относительные пути там недоступны)
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="icon"[^>]*>', '', html)
# 3) CSS и JS — внутрь файла
html = html.replace('<link rel="stylesheet" href="index.css">', '<style>\n' + css + '\n</style>', 1)
assert '<script src="app.js"></script>' in html
html = html.replace('<script src="app.js"></script>', '<script>\n' + js.replace('</script>', '<\\/script>') + '\n</script>', 1)

(root / 'WebApp.html').write_text(html, encoding='utf-8')
print('WebApp.html:', len(html), 'bytes; serviceWorker left:', 'serviceWorker.register' in html)
