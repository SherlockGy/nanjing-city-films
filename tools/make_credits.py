#!/usr/bin/env python3
"""从 assets/web/credits.json 生成片尾署名（src/credits.js）与素材署名清单（output/素材署名.txt），只列片中实际用到的照片。"""
import json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
cred = json.loads((ROOT / 'assets/web/credits.json').read_text())
js = "const F=require('./src/script.js');const s=new Set();for(const b of F.beats)for(const x of b.shots||[])if(x.img)s.add(x.img);console.log(JSON.stringify([...s]))"
used = [k for k in json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT)) if k in cred]
names, lines = [], []
for k in used:
    c = cred[k]
    a = re.sub(r'\s+', ' ', c.get('author') or '佚名').strip()
    a = re.sub(r'\(talk\)|\[.*?\]', '', a).strip() or '佚名'
    if a not in names: names.append(a)
    lines.append(f"{k}\t{c['title'][5:]}\t作者：{a}\t授权：{c['license']}\t{c['source']}")
(ROOT / 'src/credits.js').write_text('window.CREDITS = ' + json.dumps(names, ensure_ascii=False) + ';\n')
(ROOT / 'output/素材署名.txt').write_text('《金陵 · 一卷未干的水墨》实景照片素材（Wikimedia Commons）\n\n' + '\n'.join(lines) + '\n')
print(len(used), '张照片，', len(names), '位作者')
