#!/usr/bin/env python3
"""素材预处理：统一尺寸 → assets/proc/<key>.jpg；实景照片额外生成对齐的水墨版 <key>_ink.jpg；
宣纸纹理 → assets/proc/paper_detail.jpg。
用法：.venv/bin/python tools/prepare_assets.py [key ...] [--force]"""
import sys, json
from pathlib import Path
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / 'assets/proc'
PROC.mkdir(parents=True, exist_ok=True)
MAXW = 2560
PAPER = np.array([0.925, 0.900, 0.840], np.float32)  # 宣纸暖白（RGB）
INK = np.array([0.075, 0.075, 0.085], np.float32)


def load(p):
    im = cv2.imread(str(p), cv2.IMREAD_COLOR)
    return cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0


def save(p, rgb, q=93):
    cv2.imwrite(str(p), cv2.cvtColor(np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, q])


# 照片裁成 16:9 时的垂直取景中心（0 顶部，1 底部），默认 0.5
CROP_Y = {}
CROP_FILE = ROOT / 'tools/crop.json'
if CROP_FILE.exists():
    CROP_Y.update(json.loads(CROP_FILE.read_text()))


def crop169(im, key):
    """任意比例照片 → 16:9（太宽的居中裁左右，太高的按 CROP_Y 裁上下）。im 可以是 BGR 或 RGB。"""
    h, w = im.shape[:2]
    if w / h > 16 / 9:
        nw = round(h * 16 / 9); x = (w - nw) // 2
        return im[:, x:x + nw]
    nh = round(w * 9 / 16); cy = CROP_Y.get(key, 0.5)
    y = int(np.clip(cy * h - nh / 2, 0, h - nh))
    return im[y:y + nh]


def fit(rgb, painting=False):
    h, w = rgb.shape[:2]
    if painting and w < MAXW:  # AI 水墨画放大到 2560，Lanczos + 轻微锐化
        s = MAXW / w
        rgb = cv2.resize(rgb, (MAXW, round(h * s)), interpolation=cv2.INTER_LANCZOS4)
        blur = cv2.GaussianBlur(rgb, (0, 0), 1.6)
        rgb = np.clip(rgb + (rgb - blur) * 0.45, 0, 1)
    elif w > MAXW:
        s = MAXW / w
        rgb = cv2.resize(rgb, (MAXW, round(h * s)), interpolation=cv2.INTER_AREA)
    return rgb


def fbm(h, w, seed, scale=200.0, oct=4):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(oct):
        sh, sw = max(2, int(h / scale * 2 ** o)), max(2, int(w / scale * 2 ** o))
        n = rng.standard_normal((sh, sw)).astype(np.float32)
        acc += cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC) * amp
        tot += amp; amp *= 0.5
    acc /= tot
    return (acc - acc.mean()) / (acc.std() + 1e-6)


def ink(rgb, seed=1):
    """把照片变成对齐的水墨画：保边平滑成墨块 → 分层墨染 + 水渍边 → 主要轮廓勾线 → 淡彩。"""
    h, w = rgb.shape[:2]
    hw, hh = w // 2, h // 2
    small = cv2.resize(rgb, (hw, hh), interpolation=cv2.INTER_AREA)
    u8 = cv2.cvtColor((small * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    ms = cv2.pyrMeanShiftFiltering(u8, 10, 22)
    ms = cv2.edgePreservingFilter(ms, flags=cv2.RECURS_FILTER, sigma_s=50, sigma_r=0.4)
    sm = cv2.cvtColor(ms, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    L = cv2.cvtColor(sm, cv2.COLOR_RGB2GRAY)
    lo, hi = np.percentile(L, 1.5), np.percentile(L, 99.5)
    L = np.clip((L - lo) / max(hi - lo, 1e-3), 0, 1)
    if L.mean() < 0.38:  # 夜景：提亮，让天空回到纸色
        L = L ** (np.log(0.5) / np.log(max(L.mean(), 0.05)) * 0.8)
    d = 1 - L
    d = np.clip((d - 0.12) / 0.8, 0, 1)
    d = d * d * (3 - 2 * d)
    q = np.zeros_like(d)
    for a in (0.2, 0.42, 0.66, 0.86):
        q += 0.25 / (1 + np.exp(-(d - a) * 14))
    wash = 0.45 * d + 0.55 * q
    wash = cv2.GaussianBlur(wash, (0, 0), 1.6)
    # 水渍边：墨在色块边缘淤积
    pool = np.clip(wash - cv2.GaussianBlur(wash, (0, 0), 6), 0, 1)
    wash = np.clip(wash * 0.92 + pool * 0.9, 0, 1)
    # 宣纸洇化：不均匀的轻微扩散
    n = fbm(hh, hw, seed, 120) * 0.5 + 0.5
    wash = wash * (1 - 0.35 * n) + cv2.GaussianBlur(wash, (0, 0), 4) * (0.35 * n)
    wash = cv2.resize(wash, (w, h), interpolation=cv2.INTER_CUBIC)
    # 勾线：只取主要轮廓
    gg = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gg = cv2.bilateralFilter(gg, 9, 0.12, 6)
    s1 = cv2.GaussianBlur(gg, (0, 0), 1.4); s2 = cv2.GaussianBlur(gg, (0, 0), 1.4 * 1.6)
    dog = s1 - 0.99 * s2
    edge = np.clip(-dog * 26, 0, 1).astype(np.float32)
    edge = np.where(edge > 0.18, edge, 0).astype(np.float32)
    edge = cv2.morphologyEx(edge, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    edge = cv2.GaussianBlur(edge, (0, 0), 0.9)
    dens = np.clip(np.maximum(wash, edge * 0.8), 0, 1)
    dens = np.clip(dens * (0.94 + 0.12 * fbm(h, w, seed + 3, 30, 3) * 0.3), 0, 1)
    out = PAPER[None, None] * (1 - dens[..., None]) + INK[None, None] * dens[..., None]
    # 淡彩
    hsv = cv2.cvtColor(cv2.resize(sm, (w, h)), cv2.COLOR_RGB2HSV)
    hsv[..., 1] = np.clip(hsv[..., 1] * 0.35, 0, 0.35); hsv[..., 2] = 1.0
    tint = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    out = out * (0.82 + 0.18 * tint)
    return np.clip(out, 0, 1)


def paper_detail():
    src = ROOT / 'assets/gen/g_paper.png'
    rgb = load(src)
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    g = cv2.resize(g, (2048, round(2048 * g.shape[0] / g.shape[1])), interpolation=cv2.INTER_CUBIC)
    hp = g / (cv2.GaussianBlur(g, (0, 0), 24) + 1e-3)
    hp = np.clip((hp - 1) * 2.2 + 0.5, 0, 1)
    # 做成可平铺：与偏移版本交叉淡化
    h, w = hp.shape
    rolled = np.roll(np.roll(hp, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.minimum(np.minimum(xx, w - xx) / (w * 0.25), np.minimum(yy, h - yy) / (h * 0.25)).clip(0, 1)
    tile = hp * m + rolled * (1 - m)
    cv2.imwrite(str(PROC / 'paper_detail.jpg'), (tile * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])


def brush_alpha(key):
    """白底笔触 → 带透明通道的墨迹 PNG"""
    rgb = load(ROOT / f'assets/gen/{key}.png')
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    a = np.clip((0.93 - lum) / 0.8, 0, 1)
    col = np.clip(rgb * 0.6, 0, 1)
    rgba = np.dstack([col, a])
    cv2.imwrite(str(PROC / f'{key}.png'), cv2.cvtColor((rgba * 255).astype(np.uint8), cv2.COLOR_RGBA2BGRA))


def main():
    for k in ('g_stroke', 'g_enso'):
        if (ROOT / f'assets/gen/{k}.png').exists() and not (PROC / f'{k}.png').exists():
            brush_alpha(k); print('brush', k)
    force = '--force' in sys.argv
    keys = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not (PROC / 'paper_detail.jpg').exists() or 'paper' in keys:
        paper_detail(); print('paper_detail')
    srcs = sorted((ROOT / 'assets/gen').glob('g_*.png')) + sorted((ROOT / 'assets/web').glob('w_*.jpg'))
    meta_f = PROC / 'meta.json'
    meta = json.loads(meta_f.read_text()) if meta_f.exists() else {}
    for p in srcs:
        key = p.stem
        if keys and key not in keys:
            continue
        out, ink_out = PROC / f'{key}.jpg', PROC / f'{key}_ink.jpg'
        is_web = key.startswith('w_')
        codex_ink = ROOT / f'assets/inkgen/ink_{key}.png'
        stale = not out.exists() or out.stat().st_mtime < p.stat().st_mtime
        if is_web:
            stale = stale or not ink_out.exists() or (codex_ink.exists() and ink_out.stat().st_mtime < codex_ink.stat().st_mtime)
        if not stale and not force:
            continue
        rgb = load(p)
        if is_web:
            rgb = crop169(rgb, key)
        rgb = fit(rgb, painting=not is_web)
        save(out, rgb)
        info = dict(w=rgb.shape[1], h=rgb.shape[0])
        if is_web:
            if codex_ink.exists():
                ik = cv2.resize(load(codex_ink), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LANCZOS4)
                save(ink_out, ik); info['ink'] = 'codex'
            else:
                save(ink_out, ink(rgb, seed=abs(hash(key)) % 1000)); info['ink'] = 'filter'
        meta[key] = info
        print(key, info, flush=True)
    meta_f.write_text(json.dumps(meta, indent=1))


if __name__ == '__main__':
    main()
