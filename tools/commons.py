#!/usr/bin/env python3
"""Wikimedia Commons 素材检索/下载小工具（只取开放授权图片，自动记录署名）。

用法（项目根目录下，用 .venv/bin/python 运行）：
  tools/commons.py search "Nanjing Yangtze River Bridge" [--n 20] [--minw 1600] [--portrait]
      → 打印候选列表，并生成联系表 output/.commons/<slug>.jpg（每格左上角是编号）
  tools/commons.py get "<同一个查询>" <编号> <输出名>
      → 下载 2560px 宽版本到 assets/web/<输出名>.jpg，并把作者/授权写进 assets/web/credits.json
"""
import json, re, sys, io, time, hashlib
from pathlib import Path
import requests
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'output/.commons'
WEB = ROOT / 'assets/web'
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'NanjingCityFilm/1.0 (personal non-commercial video project)'}
OK_LIC = re.compile(r'^(cc0|public domain|pd|cc by(-sa)? ?[1-4]\.0|cc by(-sa)?[ -]?[1-4]\.0|cc-by|attribution)', re.I)


def slug(q):
    return re.sub(r'[^a-zA-Z0-9]+', '_', q)[:40] + '_' + hashlib.md5(q.encode()).hexdigest()[:6]


def strip(html):
    return re.sub(r'<[^>]+>', '', html or '').strip()


def search(q, n=20, minw=1600, portrait=False):
    params = dict(action='query', format='json', generator='search', gsrsearch=f'{q} filetype:bitmap', gsrnamespace=6,
                  gsrlimit=50, prop='imageinfo', iiprop='url|size|extmetadata|mime', iiurlwidth=420)
    r = requests.get(API, params=params, headers=UA, timeout=30).json()
    pages = sorted(r.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
    out = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        w, h = ii.get('width', 0), ii.get('height', 0)
        if ii.get('mime') not in ('image/jpeg', 'image/png', 'image/webp', 'image/tiff'):
            continue
        if w < minw or (not portrait and w < h * 1.1):
            continue
        md = ii.get('extmetadata', {})
        lic = strip(md.get('LicenseShortName', {}).get('value', ''))
        if not OK_LIC.search(lic):
            continue
        out.append(dict(title=p['title'], w=w, h=h, thumb=ii.get('thumburl'), page=ii.get('descriptionurl'),
                        license=lic, artist=strip(md.get('Artist', {}).get('value', ''))[:80]))
        if len(out) >= n:
            break
    return out


def contact(q, items):
    CACHE.mkdir(parents=True, exist_ok=True)
    cols, cw, ch = 4, 420, 260
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, max(1, rows) * ch), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 28)
    except Exception:
        font = ImageFont.load_default()
    for i, it in enumerate(items):
        try:
            im = Image.open(io.BytesIO(requests.get(it['thumb'], headers=UA, timeout=30).content)).convert('RGB')
            im.thumbnail((cw - 6, ch - 6))
            x, y = (i % cols) * cw, (i // cols) * ch
            sheet.paste(im, (x + 3, y + 3))
            d.rectangle([x + 3, y + 3, x + 44, y + 36], fill=(200, 30, 30))
            d.text((x + 8, y + 4), str(i), fill='white', font=font)
        except Exception as e:
            print('thumb fail', i, e)
        time.sleep(0.05)
    p = CACHE / f'{slug(q)}.jpg'
    sheet.save(p, quality=85)
    return p


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); return
    cmd, q = a[0], a[1]
    CACHE.mkdir(parents=True, exist_ok=True)
    cj = CACHE / f'{slug(q)}.json'
    if cmd == 'search':
        n = int(a[a.index('--n') + 1]) if '--n' in a else 20
        minw = int(a[a.index('--minw') + 1]) if '--minw' in a else 1600
        items = search(q, n, minw, '--portrait' in a)
        cj.write_text(json.dumps(items, ensure_ascii=False, indent=1))
        for i, it in enumerate(items):
            print(f"[{i}] {it['w']}x{it['h']} {it['license']} | {it['title'][5:90]}")
        if items:
            print('联系表:', contact(q, items))
        else:
            print('没有符合条件的结果')
    elif cmd == 'get':
        idx, name = int(a[2]), a[3]
        it = json.loads(cj.read_text())[idx]
        r = requests.get(API, params=dict(action='query', format='json', titles=it['title'], prop='imageinfo',
                                          iiprop='url', iiurlwidth=2560), headers=UA, timeout=30).json()
        ii = list(r['query']['pages'].values())[0]['imageinfo'][0]
        url = ii.get('thumburl') if it['w'] > 2560 else ii['url']
        data = requests.get(url, headers=UA, timeout=120).content
        im = Image.open(io.BytesIO(data)).convert('RGB')
        WEB.mkdir(parents=True, exist_ok=True)
        out = WEB / f'{name}.jpg'
        im.save(out, quality=93)
        cf = WEB / 'credits.json'
        credits = json.loads(cf.read_text()) if cf.exists() else {}
        credits[name] = dict(title=it['title'], author=it['artist'], license=it['license'], source=it['page'])
        cf.write_text(json.dumps(credits, ensure_ascii=False, indent=1))
        print('已保存', out, im.size)


if __name__ == '__main__':
    main()
