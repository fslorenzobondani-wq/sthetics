#!/usr/bin/env python3
"""
STHETICS // ARCHAEOLOGY — scarica le immagini da Wikimedia Commons.

Per ogni reperto e ogni slot (moda, design, materiale, spazio) in data.json:
  1. cerca su Commons con il campo "query" (oppure usa "commons_file", se lo scrivi tu);
  2. tiene solo file con licenza CC0, pubblico dominio, CC BY o CC BY-SA (scarta NC e ND);
  3. converte in bianco e nero, non ritaglia (lato lungo max 1400), salva in assets/ (circa 100-200 KB);
  4. scrive in data.json la provenienza (titolo, autore, licenza, link) che il sito mostra nel dossier.

Uso (dalla cartella del progetto):
    pip install pillow
    python3 tools/fetch_images.py --list          # mostra i candidati senza scaricare
    python3 tools/fetch_images.py                 # scarica le immagini mancanti
    python3 tools/fetch_images.py --only 004-design --force

Se un risultato non ti piace, scrivi in data.json il titolo esatto del file di Commons in "commons_file"
(es. "File:Ball Chair.jpg") oppure cambia "query", poi rilancia con --only e --force.
Nota: le licenze CC BY / BY-SA richiedono di citare l'autore. Il sito lo fa nella sezione Provenienza.
Le immagini in bianco e nero sono opere derivate: con BY-SA vale la stessa licenza.
"""
import argparse
import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = 'https://commons.wikimedia.org/w/api.php'
# Wikimedia chiede uno User-Agent descrittivo. Se ricevi errori 403, aggiungi un tuo contatto qui.
USER_AGENT = 'STHETICS-ARCHAEOLOGY/1.0 (personal art archive; python-urllib)'
MIN_WIDTH = 900
MAX_SIDE = 1400  # lato lungo massimo; le proporzioni originali restano
PAUSE = 1.0              # secondi tra una richiesta e l'altra


def license_ok(name):
    """True per CC0, pubblico dominio, CC BY e CC BY-SA. False per NC, ND e licenze sconosciute."""
    tokens = re.split(r'[\s\-_/]+', (name or '').lower())
    if 'nc' in tokens or 'nd' in tokens:
        return False
    if 'cc0' in tokens or 'pd' in tokens or ('public' in tokens and 'domain' in tokens):
        return True
    return 'cc' in tokens and 'by' in tokens


def strip_html(text):
    return html.unescape(re.sub(r'<[^>]+>', '', text or '')).strip()


def api_get(params):
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


IMAGEINFO = {
    'prop': 'imageinfo',
    'iiprop': 'url|size|mime|extmetadata',
    'iiurlwidth': 1400,
    'format': 'json',
}


def search_pages(query):
    data = api_get({
        'action': 'query', 'generator': 'search', 'gsrnamespace': 6, 'gsrlimit': 20,
        'gsrsearch': f'{query} filetype:bitmap', **IMAGEINFO,
    })
    pages = list((data.get('query') or {}).get('pages', {}).values())
    return sorted(pages, key=lambda p: p.get('index', 0))


def title_pages(title):
    data = api_get({'action': 'query', 'titles': title, **IMAGEINFO})
    return list((data.get('query') or {}).get('pages', {}).values())


def describe(page):
    """Estrae dalla risposta dell'API i dati utili di un candidato, oppure None se non è utilizzabile."""
    infos = page.get('imageinfo') or []
    if not infos:
        return None
    ii = infos[0]
    meta = ii.get('extmetadata') or {}
    lic = (meta.get('LicenseShortName') or {}).get('value', '')
    return {
        'title': page.get('title', ''),
        'width': ii.get('width', 0),
        'mime': ii.get('mime', ''),
        'license': lic,
        'author': strip_html((meta.get('Artist') or {}).get('value', '')),
        'page_url': ii.get('descriptionurl', ''),
        'file_url': ii.get('thumburl') or ii.get('url', ''),
    }


def usable(c):
    return (c and c['mime'] in ('image/jpeg', 'image/png') and c['width'] >= MIN_WIDTH
            and license_ok(c['license']) and c['file_url'])


def pick(pages):
    for p in pages:
        c = describe(p)
        if usable(c):
            return c
    return None


def to_archive_jpeg(raw):
    """Bianco e nero, contrasto normalizzato, nessun ritaglio, JPEG leggero. Restituisce (bytes, (w, h))."""
    from PIL import Image, ImageOps
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img).convert('RGB')
    img = ImageOps.autocontrast(ImageOps.grayscale(img), cutoff=1)
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, 'JPEG', quality=82, optimize=True)
    return out.getvalue(), img.size


def main(argv=None):
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--data', default=str(root / 'data.json'))
    ap.add_argument('--only', help='solo questo slot, es. 004-design')
    ap.add_argument('--force', action='store_true', help='riscarica anche se il file esiste')
    ap.add_argument('--list', action='store_true', help='mostra i candidati senza scaricare')
    args = ap.parse_args(argv)

    data_path = Path(args.data)
    items = json.loads(data_path.read_text(encoding='utf-8'))
    done = skipped = failed = 0

    for it in items:
        for im in it.get('images', []):
            tag = f"{it['id']}-{im['slot']}"
            if args.only and args.only != tag:
                continue
            target = root / im['file']
            if target.exists() and not args.force and not args.list:
                skipped += 1
                continue
            try:
                if im.get('commons_file'):
                    pages = title_pages(im['commons_file'])
                else:
                    pages = search_pages(im['query'])
                time.sleep(PAUSE)

                if args.list:
                    print(f'\n[{tag}] {im["query"]}')
                    shown = 0
                    for p in pages:
                        c = describe(p)
                        if not c:
                            continue
                        flag = 'OK ' if usable(c) else '-- '
                        print(f'  {flag}{c["title"]} | {c["width"]}px | {c["license"] or "licenza?"}')
                        shown += 1
                        if shown == 6:
                            break
                    continue

                c = pick(pages)
                if not c:
                    print(f'[{tag}] nessun candidato con licenza adatta per "{im["query"]}"')
                    failed += 1
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                data, size = to_archive_jpeg(fetch_bytes(c['file_url']))
                target.write_bytes(data)
                im.update({'local': True, 'w': size[0], 'h': size[1]})
                im['credit'] = {
                    'title': c['title'].replace('File:', ''),
                    'author': c['author'],
                    'license': c['license'],
                    'url': c['page_url'],
                }
                print(f'[{tag}] {c["title"]} ({c["license"]})')
                done += 1
                time.sleep(PAUSE)
            except Exception as err:  # una foto che fallisce non ferma le altre
                print(f'[{tag}] errore: {err}')
                failed += 1

    if not args.list:
        data_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'\nScaricate: {done} · già presenti: {skipped} · da rivedere: {failed}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
