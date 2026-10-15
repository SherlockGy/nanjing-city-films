#!/usr/bin/env python3
"""用 codex 图生图把实景照片转成“构图完全对齐”的水墨版，供“水墨→实景”晕染镜头使用。
先把照片裁成 16:9（与渲染用的 assets/proc/<key>.jpg 一致），再交给 codex。
用法：.venv/bin/python tools/gen_inks.py [key ...] [--jobs 4] [--force]
不带 key 时自动处理剧本里 look 为 bleed/ink 且照片已下载的镜头。"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import cv2

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'assets/inkgen'
DIR.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools'))
from prepare_assets import crop169  # noqa: E402

PROMPT = ("Use your built-in image generation tool in EDIT mode with the attached photo as the input image. "
          "Transform the photo into a traditional Chinese ink wash painting (shui-mo) on warm-white xuan rice paper: keep EXACTLY the same "
          "composition, framing, perspective, horizon line and the position, size and silhouette of every building, tree, wall, bridge, "
          "statue, person and boat, so it can be overlaid pixel-for-pixel on the original photo. Masterful brushwork, rich ink gradations, "
          "soft wet washes, sky as mostly empty paper with pale washes, very light muted color tints that echo the photo's colors. "
          "{extra}No text, no seal, no border. Output landscape, same aspect ratio as the input. Save the result in the current directory "
          "as ink_{key}.png (overwrite). Do nothing else, do not ask questions.")
EXTRA = {
    'w_qinhuai_night': 'It is a night scene: paint the night sky with soft diluted ink, keep the lanterns as small warm cinnabar dots. ',
    'w_bridge_night': 'It is a night scene: paint the night sky with soft diluted ink, lights as small warm dots. ',
}


def wanted():
    js = "const F=require('./src/script.js');const s=new Set();for(const b of F.beats)for(const x of b.shots||[])if(x.img&&/^(bleed|ink)$/.test(x.look||''))s.add(x.img);console.log(JSON.stringify([...s]))"
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT).decode())


def run(key):
    out = DIR / f'ink_{key}.png'
    src = ROOT / f'assets/web/{key}.jpg'
    if out.exists() and '--force' not in sys.argv:
        return key, 'skip'
    if not src.exists():
        return key, '缺照片'
    im = crop169(cv2.imread(str(src)), key)
    cv2.imwrite(str(DIR / f'src_{key}.jpg'), cv2.resize(im, (1672, 941), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 92])
    task = PROMPT.format(key=key, extra=EXTRA.get(key, ''))
    for _ in range(3):
        subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', str(DIR), '--sandbox', 'workspace-write',
                        '-c', 'model_reasoning_effort="low"', task, '-i', f'src_{key}.jpg'],
                       stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=900)
        if out.exists():
            return key, 'ok'
    return key, 'FAIL'


if __name__ == '__main__':
    keys = [a for a in sys.argv[1:] if not a.startswith('--') and not a.isdigit()] or wanted()
    jobs = int(sys.argv[sys.argv.index('--jobs') + 1]) if '--jobs' in sys.argv else 4
    with ThreadPoolExecutor(jobs) as ex:
        for k, st in ex.map(run, keys):
            print(k, st, flush=True)
