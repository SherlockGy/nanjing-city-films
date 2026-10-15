#!/usr/bin/env python3
"""用本机 codex CLI 的图像生成能力批量生成水墨画。
用法：.venv/bin/python tools/gen_images.py [key ...] [--jobs 4] [--force]
已存在的 assets/gen/<key>.png 会跳过（--force 重画）。"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / 'assets/gen'
cfg = json.loads((ROOT / 'tools/gen_prompts.json').read_text())
args = [a for a in sys.argv[1:] if not a.startswith('--')]
jobs = int(sys.argv[sys.argv.index('--jobs') + 1]) if '--jobs' in sys.argv else 4
if '--jobs' in sys.argv:
    args = [a for a in args if a != str(jobs)]
keys = args or list(cfg['items'])
force = '--force' in sys.argv


def run(key):
    out = GEN / f'{key}.png'
    if out.exists() and not force:
        return key, 'skip'
    prompt = cfg['items'][key] + ' ' + (cfg['_style'] if key != 'g_paper' else 'Photographic flat scan, no ink painting.')
    task = (f"Use your built-in image generation tool to create exactly ONE image. Prompt: \"{prompt}\" "
            f"Landscape orientation, the widest 16:9-like size available, highest quality. After it is generated, copy the PNG "
            f"into the current working directory named {key}.png (overwrite if exists). Do nothing else, do not ask questions.")
    for attempt in range(3):
        r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '-C', str(GEN), '--sandbox', 'workspace-write',
                            '-c', 'model_reasoning_effort="low"', task], capture_output=True, text=True, timeout=900)
        if out.exists():
            return key, 'ok'
    return key, 'FAIL ' + r.stdout[-400:] + r.stderr[-400:]


with ThreadPoolExecutor(jobs) as ex:
    for key, st in ex.map(run, keys):
        print(key, st, flush=True)
