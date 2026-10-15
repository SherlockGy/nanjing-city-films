#!/usr/bin/env python3
"""配乐（古筝/古琴/箫/琵琶/弦乐/大鼓/编钟，全部程序化合成）+ 音效 + 旁白 → output/soundtrack.m4a
依赖 tools/layout.json（node tools/export_layout.mjs 生成）。
用法：.venv/bin/python tools/build_audio.py"""
import json, subprocess, wave
from pathlib import Path
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
LAY = json.loads((ROOT / 'tools/layout.json').read_text())
DUR = LAY['duration'] + 1.0
N = int(DUR * SR)
rng = np.random.default_rng(7)


def S(x): return int(round(x * SR))
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nm(s):
    """'F#4' → midi"""
    n = NOTE[s[0]]; i = 1
    while i < len(s) and s[i] in '#b':
        n += 1 if s[i] == '#' else -1; i += 1
    return n + 12 * (int(s[i:]) + 1)


class Bus:
    def __init__(self, n=N):
        self.x = np.zeros((2, n), np.float32)

    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
        a = S(t)
        if a < 0:
            sig = sig[:, -a:]; a = 0
        b = min(self.x.shape[1], a + sig.shape[1])
        if b > a:
            self.x[:, a:b] += sig[:, :b - a] * gain


# ───────────────────────── 乐器 ─────────────────────────
def env_ar(n, a, r, sus=1.0):
    e = np.ones(n, np.float32) * sus
    na, nr = min(n, S(a)), min(n, S(r))
    if na: e[:na] = np.linspace(0, sus, na) ** 1.5
    if nr: e[n - nr:] *= np.linspace(1, 0, nr) ** 1.6
    return e


def phase_of(f):
    return 2 * np.pi * np.cumsum(f) / SR


def pluck(freq, dur=3.0, bright=0.6, decay=1.2, pos=0.17, inharm=2e-4, bend=None, vib=0.0, kind='zheng'):
    """加法合成的拨弦：古筝/古琴/琵琶。bend=(起始半音偏移, 时长) 实现滑音（古琴吟猱、古筝按滑）。"""
    n = S(dur); t = np.arange(n) / SR
    f = np.full(n, freq, np.float32)
    if bend:
        semis, bt = bend
        f *= 2 ** ((semis * np.exp(-t / max(bt, 1e-3))) / 12)
    if vib:
        f *= 1 + vib * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) * 2, 0, 1)
    ph = phase_of(f)
    K = int(min(28, 9000 / freq))
    out = np.zeros(n, np.float32)
    for k in range(1, K + 1):
        amp = abs(np.sin(np.pi * k * pos)) / k ** (1.35 - bright * 0.6)
        dk = decay * (1 + 0.5 * (k - 1) ** 1.15 * (1.2 - bright))
        out += amp * np.exp(-t * dk) * np.sin(k * ph * np.sqrt(1 + inharm * k * k) + k * 0.7)
    # 拨弦瞬态
    nn = min(n, S(0.012))
    click = rng.standard_normal(nn) * np.exp(-np.arange(nn) / (SR * 0.002))
    b, a = signal.butter(2, [min(0.99, freq * 2 / SR * 2), min(0.99, 6000 * 2 / SR)], 'band')
    out[:nn] += signal.lfilter(b, a, click) * (0.6 if kind == 'pipa' else 0.3)
    out[:S(0.004)] *= np.linspace(0, 1, S(0.004))
    if kind == 'qin':  # 古琴：箱体低频共鸣
        b, a = signal.butter(2, 900 * 2 / SR); out = signal.lfilter(b, a, out) * 1.4
    return (out / max(1e-6, np.abs(out).max())).astype(np.float32)


def flute(notes, kind='xiao', vib=0.008):
    """notes：[(起始秒, 时长, midi)] 连奏的箫/笛子旋律（含滑音、颤音、气声）。返回 (信号, 起始时间)"""
    t0 = notes[0][0]; t1 = max(s + d for s, d, _ in notes) + 0.6
    n = S(t1 - t0); t = np.arange(n) / SR
    f = np.zeros(n, np.float32); amp = np.zeros(n, np.float32)
    for i, (s, d, m) in enumerate(notes):
        a, b = S(s - t0), min(n, S(s - t0 + d))
        f[a:] = mtof(m)
        e = np.ones(b - a, np.float32)
        att = min(len(e), S(0.09 if i else 0.25)); rel = min(len(e), S(0.18))
        e[:att] = np.linspace(0.35 if i else 0, 1, att); e[-rel:] *= np.linspace(1, 0.55, rel)
        amp[a:b] = np.maximum(amp[a:b], e * (0.85 + 0.15 * np.sin(np.linspace(0, np.pi, b - a))))
    # 音符间滑音
    f = signal.lfilter([0.0025], [1, -0.9975], f) / 1.0
    f[:S(0.05)] = mtof(notes[0][2])
    vibr = 1 + vib * np.sin(2 * np.pi * 5.0 * t + 0.3 * np.sin(2 * np.pi * 0.7 * t)) * np.clip(amp, 0, 1)
    ph = phase_of(f * vibr)
    h = [1, 0.18, 0.08, 0.03] if kind == 'xiao' else [1, 0.42, 0.22, 0.12, 0.06]
    tone = sum(hk * np.sin((k + 1) * ph) for k, hk in enumerate(h))
    breath = rng.standard_normal(n).astype(np.float32)
    b, a = signal.butter(2, [600 * 2 / SR, 4000 * 2 / SR], 'band'); breath = signal.lfilter(b, a, breath)
    sig = tone * amp * 0.8 + breath * amp * (0.09 if kind == 'xiao' else 0.06)
    if kind == 'dizi':  # 笛膜的嗡声
        sig += 0.05 * np.sign(np.sin(ph)) * amp
    rel = S(0.5); sig[-rel:] *= np.linspace(1, 0, rel)
    return sig.astype(np.float32), t0


def pad(midis, dur, att=1.8, rel=2.0, bright=0.5, det=0.004):
    """弦乐铺底：多根轻微失谐的锯齿波（有限谐波）"""
    n = S(dur); t = np.arange(n) / SR
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    K = 10
    for j, m in enumerate(midis):
        for v in range(3):
            fq = mtof(m) * (1 + (v - 1) * det + 0.0007 * j)
            ph0 = rng.random() * 6.28
            s = np.zeros(n, np.float32)
            for k in range(1, K + 1):
                if fq * k > 7000: break
                s += (bright ** (k - 1)) / k * np.sin(2 * np.pi * fq * k * t + ph0 * k)
            s *= 1 + 0.15 * np.sin(2 * np.pi * (0.13 + 0.05 * v) * t + j)
            pan = (v - 1) * 0.6
            L += s * (1 - pan) * 0.5; R += s * (1 + pan) * 0.5
    e = env_ar(n, att, rel)
    out = np.vstack([L * e, R * e])
    return out / max(1e-6, np.abs(out).max())


def drum(f0=90, f1=46, dec=3.2, n_dur=2.2, slap=0.35):
    n = S(n_dur); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    body = np.sin(phase_of(f)) * np.exp(-t * dec)
    nz = rng.standard_normal(n) * np.exp(-t * 35)
    b, a = signal.butter(2, 1500 * 2 / SR); nz = signal.lfilter(b, a, nz)
    out = body + nz * slap
    return (out / np.abs(out).max()).astype(np.float32)


def bell(f, dur=6.0, kind='bianzhong'):
    n = S(dur); t = np.arange(n) / SR
    if kind == 'bianzhong':
        parts = [(1, 1, 0.9), (2.0, 0.45, 1.4), (2.76, 0.55, 1.8), (3.0, 0.25, 2.2), (4.07, 0.25, 2.8), (5.4, 0.15, 3.5), (6.8, 0.08, 4.5)]
    else:  # 寺钟：低沉悠长
        parts = [(0.5, 0.6, 0.35), (1, 1, 0.45), (1.19, 0.5, 0.6), (1.56, 0.35, 0.8), (2.0, 0.35, 0.9), (2.51, 0.22, 1.2), (3.0, 0.15, 1.5), (4.2, 0.08, 2.2)]
    out = np.zeros(n, np.float32)
    for r, a, d in parts:
        out += a * np.exp(-t * d) * np.sin(2 * np.pi * f * r * t * (1 + 0.0008 * np.sin(2 * np.pi * 0.9 * t)))
    out[:S(0.003)] *= np.linspace(0, 1, S(0.003))
    return out / np.abs(out).max()


def woodblock(f=880):
    n = S(0.25); t = np.arange(n) / SR
    out = np.sin(2 * np.pi * f * t) * np.exp(-t * 38) + 0.5 * np.sin(2 * np.pi * f * 2.3 * t) * np.exp(-t * 60)
    return out / np.abs(out).max()


def noise(dur, lo=None, hi=None, seed=0):
    x = np.random.default_rng(seed).standard_normal(S(dur)).astype(np.float32)
    if lo and hi: b, a = signal.butter(2, [lo * 2 / SR, hi * 2 / SR], 'band')
    elif hi: b, a = signal.butter(2, hi * 2 / SR)
    elif lo: b, a = signal.butter(2, lo * 2 / SR, 'high')
    else: return x
    return signal.lfilter(b, a, x).astype(np.float32)


def make_ir(rt=3.0, pre=0.02, seed=1, damp=1.0):
    n = S(rt * 1.4); t = np.arange(n) / SR
    out = []
    for ch in range(2):
        r = np.random.default_rng(seed + ch)
        x = r.standard_normal(n).astype(np.float32)
        bands = [(None, 600, rt), (600, 3000, rt * 0.75 / damp), (3000, None, rt * 0.45 / damp)]
        ir = np.zeros(n, np.float32)
        for lo, hi, T60 in bands:
            if lo and hi: b, a = signal.butter(2, [lo * 2 / SR, hi * 2 / SR], 'band')
            elif hi: b, a = signal.butter(2, hi * 2 / SR)
            else: b, a = signal.butter(2, lo * 2 / SR, 'high')
            ir += signal.lfilter(b, a, x) * np.exp(-6.9 * t / T60)
        ir[:S(pre)] = 0
        ir /= np.sqrt((ir ** 2).sum())
        out.append(ir)
    return out


def reverb(stereo, ir, wet=0.3):
    out = np.zeros_like(stereo)
    for ch in range(2):
        out[ch] = signal.fftconvolve(stereo[ch], ir[ch])[:stereo.shape[1]]
    return stereo * (1 - wet * 0.5) + out * wet


# ───────────────────────── 作曲 ─────────────────────────
VOICE = [(v['start'], v['start'] + v['dur']) for v in LAY['voice']]
def gaps(t0, t1, minlen=2.0):
    """[t0,t1] 之间没有旁白的空隙（旋律乐器在这里出声）"""
    out, cur = [], t0
    for a, b in VOICE:
        if b < t0 or a > t1: continue
        if a - cur >= minlen: out.append((cur, a))
        cur = max(cur, b)
    if t1 - cur >= minlen: out.append((cur, t1))
    return out


THEME = [(0, 2, 'A4'), (2, 1, 'B4'), (3, 1, 'D5'), (4, 3, 'E5'), (7, 1, 'D5'), (8, 2, 'B4'), (10, 1, 'A4'), (11, 1, 'F#4'), (12, 4, 'E4'),
         (16, 2, 'A4'), (18, 1, 'B4'), (19, 1, 'D5'), (20, 2, 'F#5'), (22, 1, 'E5'), (23, 1, 'D5'), (24, 1.5, 'B4'), (25.5, .5, 'D5'), (26, 2, 'E5'), (28, 4, 'D5')]
PENTA = {'D': ['D', 'E', 'F#', 'A', 'B'], 'G': ['G', 'A', 'B', 'D', 'E'], 'F': ['F', 'G', 'A', 'C', 'D'], 'B': ['B', 'D', 'E', 'F#', 'A']}


def scale_midis(key, lo, hi):
    pcs = {NOTE[p[0]] + (1 if '#' in p else 0) for p in PENTA[key]}
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]


def melody_phrase(t, beat, key, transpose=0, seed=0, length=None, theme=THEME):
    """主题（或其片段）→ [(秒, 时长, midi)]"""
    ph = theme if length is None else [x for x in theme if x[0] < length]
    return [(t + s * beat, d * beat * 0.98, nm(n) + transpose) for s, d, n in ph]


class Score:
    def __init__(self):
        self.mel = Bus(); self.pl = Bus(); self.pad = Bus(); self.perc = Bus(); self.low = Bus()

    # 古筝刮奏
    def gliss(self, t, key, lo=62, hi=86, up=True, step=0.045, gain=0.22):
        ms = scale_midis(key, lo, hi)
        if not up: ms = ms[::-1]
        for i, m in enumerate(ms):
            self.pl.add(pluck(mtof(m), 2.5, 0.75, 1.6), t + i * step, gain * (0.6 + 0.4 * i / len(ms)), pan=-0.5 + i / len(ms))

    def arps(self, t0, t1, chords, beat, key, pattern=(0, 2, 1, 3, 2, 1), sub=2, gain=0.12, kind='zheng', octave=0, decay=1.4):
        t = t0; ci = 0
        bar = beat * 4
        while t < t1 - 0.05:
            ch = chords[ci % len(chords)]
            tones = sorted(nm(x) + octave for x in ch)
            k = 0
            tb = t
            while tb < min(t + bar, t1) - 1e-3:
                m = tones[pattern[k % len(pattern)] % len(tones)]
                self.pl.add(pluck(mtof(m), 2.6, 0.55, decay, kind=kind), tb, gain * (1 if k % sub == 0 else 0.7), pan=((k % 4) - 1.5) * 0.25)
                tb += beat / sub; k += 1
            t += bar; ci += 1

    def pads(self, t0, t1, chords, bar, gain=0.16, bright=0.45, octave=0):
        t = t0; ci = 0
        while t < t1 - 0.1:
            ch = [nm(x) + octave for x in chords[ci % len(chords)]]
            d = min(bar, t1 - t) + 2.0
            self.pad.add(pad(ch, d, att=min(1.6, bar * 0.4), rel=2.2, bright=bright), t, gain)
            t += bar; ci += 1

    def flute_in_gaps(self, t0, t1, beat, key, kind='xiao', gain=0.2, transpose=0, minlen=3.0, seed=0, theme=THEME):
        r = np.random.default_rng(seed)
        for a, b in gaps(t0, t1, minlen):
            L = b - a - 0.8
            nbeats = int(L / beat)
            if nbeats < 3: continue
            start = int(r.integers(0, 4)) * 4
            ph = [x for x in theme if start <= x[0] < start + nbeats - 1]
            if not ph: ph = [x for x in theme if x[0] < nbeats - 1]
            base = ph[0][0]
            notes = [(a + 0.4 + (s - base) * beat, d * beat * 0.98, nm(n) + transpose) for s, d, n in ph]
            sig, ts = flute(notes, kind)
            self.mel.add(sig, ts, gain, pan=0.1)

    def drums(self, times, gain=0.5, **kw):
        d = drum(**kw)
        for t in times: self.perc.add(d, t, gain)


def compose():
    sc = Score()
    cues = LAY['music'] + [{'id': 'end', 't': LAY['duration']}]
    B = {b['id']: b for b in LAY['beats']}
    T = {c['id']: c['t'] for c in cues}
    end = LAY['duration']
    # ── m1 序章：古琴与箫，空灵 ──
    t0, t1 = 0.0, T['m1b']
    sc.low.add(pad([nm('D2'), nm('A2')], t1 - t0 + 3, att=4, rel=4, bright=0.3), t0 + 1.5, 0.22)
    sc.pads(t0 + 6, t1, [['D3', 'A3', 'E4'], ['B2', 'F#3', 'D4'], ['G2', 'D3', 'A3', 'B3'], ['A2', 'E3', 'B3']], 8.0, 0.11, 0.35)
    for i, (tt, m) in enumerate([(1.6, 'D3'), (5.6, 'A3'), (9.5, 'D4'), (13.5, 'E4'), (17.4, 'A3'), (21.4, 'B3')]):
        sc.pl.add(pluck(mtof(nm(m)), 6, 0.35, 0.55, kind='qin', bend=(1.0 if i % 2 else -0.6, 0.18), vib=0.004), tt, 0.32, pan=-0.2)
    sc.flute_in_gaps(6, t1 - 1, 1.0, 'D', 'xiao', 0.2, seed=1)
    # 金陵 标题：古筝刮奏 + 编钟
    tt = B['L5b']['voice']['start'] - 0.2
    sc.gliss(tt - 0.7, 'D', 62, 88, True, 0.035, 0.2)
    sc.perc.add(bell(mtof(nm('D4')), 7), tt, 0.32)
    sc.drums([tt], 0.4, dec=2.2)
    # ── m1b 第一卷 六朝：烟雨，古筝分解 + 弦乐 ──
    t0, t1 = T['m1b'], T['m2']
    sc.gliss(t0 + 0.3, 'D', 57, 81, True, 0.05, 0.18)
    sc.pads(t0, t1, [['D3', 'A3', 'F#4'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3'], ['A2', 'E3', 'A3', 'B3']], 8.0, 0.13, 0.4)
    sc.arps(t0 + 4, t1 - 2, [['D4', 'A4', 'E5', 'F#5'], ['B3', 'F#4', 'D5', 'A4'], ['G3', 'D4', 'B4', 'A4'], ['A3', 'E4', 'B4', 'D5']], 1.0, 'D', gain=0.07, sub=2)
    sc.flute_in_gaps(t0 + 2, t1, 1.0, 'D', 'xiao', 0.2, seed=2)
    # ── m2 第二卷 大明：大鼓、编钟、雄浑 ──
    t0, t1 = T['m2'], T['m3']
    beat = 60 / 76
    sc.drums([t0 + 0.4], 0.75, f0=80, f1=40, dec=1.6, n_dur=4)
    sc.perc.add(bell(mtof(nm('A3')), 7), t0 + 0.45, 0.3)
    sc.pads(t0, t1, [['D3', 'A3', 'D4', 'F#4'], ['A2', 'E3', 'A3', 'C#4'], ['B2', 'F#3', 'B3', 'D4'], ['G2', 'D3', 'G3', 'B3']], beat * 8, 0.17, 0.6)
    sc.low.add(pad([nm('D2')], t1 - t0, att=3, rel=3, bright=0.5), t0, 0.2)
    bars = np.arange(t0 + beat * 8, t1 - 1, beat * 4)
    sc.drums(list(bars), 0.38, f0=85, f1=44, dec=3.5)
    sc.drums(list(bars + beat * 2.5), 0.22, f0=120, f1=70, dec=7, slap=0.6)
    # 低音弦乐固定音型
    for b0 in bars:
        for k in range(8):
            m = nm('D3') if k % 4 != 3 else nm('A2')
            sc.low.add(pluck(mtof(m), 1.2, 0.5, 3.5, kind='pipa'), b0 + k * beat / 2, 0.1)
    sc.flute_in_gaps(t0 + 2, t1, beat, 'D', 'dizi', 0.17, seed=3, transpose=0)
    for tb in np.arange(t0 + beat * 16, t1 - 2, beat * 16):
        sc.perc.add(bell(mtof(nm('D4')), 6), tb, 0.16)
    # ── m3 第三卷 秦淮：琵琶轮指、古筝、昆笛 ──
    t0, t1 = T['m3'], T['m4']
    beat = 60 / 70
    sc.gliss(t0 + 0.2, 'G', 55, 79, True, 0.05, 0.17)
    sc.pads(t0, t1, [['G2', 'D3', 'B3', 'A4'], ['E2', 'B2', 'G3', 'D4'], ['C3', 'G3', 'E4', 'B4'], ['D3', 'A3', 'E4', 'F#4']], beat * 8, 0.12, 0.4)
    sc.arps(t0 + 2, t1 - 2, [['G3', 'D4', 'B4', 'A4'], ['E3', 'B3', 'G4', 'D5'], ['C4', 'G4', 'E5', 'D5'], ['D4', 'A4', 'E5', 'B4']], beat, 'G', gain=0.08, sub=2, kind='pipa', decay=2.2)
    # 琵琶轮指点缀
    for a, b in gaps(t0, t1, 2.5):
        m = nm('D5') if int(a) % 2 else nm('B4')
        for k in range(int(min(b - a, 1.6) * 14)):
            sc.mel.add(pluck(mtof(m), 0.5, 0.65, 6, kind='pipa'), a + 0.3 + k / 14, 0.05 * (0.6 + 0.4 * np.sin(k / 3)), pan=0.3)
    sc.flute_in_gaps(t0 + 3, t1, beat, 'G', 'dizi', 0.15, seed=4, transpose=-2)
    # ── m4 第四卷 山河：大提琴、钢琴单音、静默，然后希望 ──
    t0, t1 = T['m4'], T['m5']
    sc.pads(t0, B['L32']['start'], [['B1', 'F#2', 'D3'], ['G1', 'D2', 'B2']], 7.0, 0.16, 0.5)
    for i, tt in enumerate(np.arange(t0 + 1, B['L32']['start'], 3.2)):
        sc.pl.add(pluck(mtof(nm(['F#4', 'D4', 'B3', 'A3'][i % 4])), 4, 0.3, 0.9, kind='qin'), tt, 0.16)
    # 至暗时刻：寺钟一声 + 极低的长音
    tb = B['L32']['start'] + 0.3
    sc.perc.add(bell(55, 12, 'temple'), tb, 0.55)
    sc.low.add(pad([nm('B1'), nm('F#2')], B['L33']['start'] + B['L33']['dur'] - tb, att=3, rel=3, bright=0.25), tb, 0.14)
    # 和平：弦乐缓缓升起
    tp = B['L34']['start']
    sc.pads(tp, t1, [['D3', 'A3', 'F#4'], ['G2', 'D3', 'B3', 'A4'], ['B2', 'F#3', 'D4', 'A4'], ['A2', 'E3', 'C#4', 'B4']], 5.5, 0.17, 0.5)
    sc.flute_in_gaps(tp, t1, 0.9, 'D', 'xiao', 0.2, seed=5, minlen=2.4)
    sc.arps(B['L35']['start'], t1 - 1, [['D4', 'A4', 'F#5'], ['G3', 'D4', 'B4'], ['B3', 'F#4', 'D5'], ['A3', 'E4', 'C#5']], 0.9, 'D', gain=0.06)
    # ── m5 第五卷 烟火：轻快 ──
    t0, t1 = T['m5'], T['m6']
    beat = 60 / 100
    sc.pads(t0, t1, [['F3', 'C4', 'A4'], ['D3', 'A3', 'F4'], ['A#2', 'F3', 'D4'], ['C3', 'G3', 'E4']], beat * 8, 0.09, 0.4)
    for k, tt in enumerate(np.arange(t0 + 0.5, t1 - 1, beat)):
        bar = int(k / 4) % 4
        root = ['F3', 'D3', 'A#2', 'C3'][bar]
        m = nm(root) + [0, 7, 12, 7][k % 4]
        sc.pl.add(pluck(mtof(m), 0.8, 0.45, 5.5, kind='pipa'), tt, 0.1, pan=-0.3)
        if k % 2 == 1: sc.perc.add(woodblock(1100 if k % 4 == 1 else 820), tt, 0.07, pan=0.4)
    sc.arps(t0 + beat * 8, t1 - 1, [['F4', 'A4', 'C5', 'D5'], ['D4', 'F4', 'A4', 'C5'], ['A#3', 'D4', 'F4', 'G4'], ['C4', 'E4', 'G4', 'A4']], beat, 'F', gain=0.06, sub=2, pattern=(0, 2, 3, 1))
    PLAY = [(0, .5, 'C5'), (.5, .5, 'D5'), (1, 1, 'F5'), (2, .5, 'G5'), (2.5, .5, 'F5'), (3, 1, 'D5'), (4, .5, 'C5'), (4.5, .5, 'A4'), (5, 1, 'C5'), (6, 2, 'D5'),
            (8, .5, 'F5'), (8.5, .5, 'G5'), (9, 1, 'A5'), (10, .5, 'G5'), (10.5, .5, 'F5'), (11, 1, 'D5'), (12, 1, 'C5'), (13, 1, 'D5'), (14, 2, 'F5')]
    sc.flute_in_gaps(t0 + 1, t1, beat, 'F', 'dizi', 0.15, seed=6, minlen=2.0, theme=PLAY)
    # ── m6 第六卷 新章 + 尾声 ──
    t0 = T['m6']; tend = B['L49']['start']
    beat = 60 / 88
    sc.gliss(t0 + 0.2, 'D', 62, 86, True, 0.035, 0.2)
    sc.drums([t0 + 0.5], 0.6, f0=80, f1=40, dec=1.8, n_dur=4)
    ch6 = [['D3', 'A3', 'E4', 'F#4'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'F#4'], ['A2', 'E3', 'C#4', 'A4']]
    sc.pads(t0, tend + 3, ch6, beat * 8, 0.16, 0.6)
    sc.arps(t0 + beat * 4, tend, [['D4', 'A4', 'E5', 'F#5'], ['B3', 'F#4', 'D5', 'A5'], ['G3', 'D4', 'B4', 'F#5'], ['A3', 'E4', 'C#5', 'A5']], beat, 'D', gain=0.075, sub=4, pattern=(0, 1, 2, 3, 2, 1))
    bars = np.arange(t0 + beat * 8, tend - 1, beat * 4)
    sc.drums(list(bars), 0.32, f0=85, f1=44, dec=3.5)
    sc.drums(list(bars[len(bars) // 2:] + beat * 2), 0.2, f0=110, f1=60, dec=6, slap=0.6)
    sc.low.add(pad([nm('D2')], tend - t0, att=4, rel=3, bright=0.5), t0, 0.18)
    sc.flute_in_gaps(t0 + 2, tend, beat, 'D', 'dizi', 0.17, seed=7)
    # 高潮落点：L48 结束的一声大鼓 + 编钟
    tb = B['L48']['start'] + B['L48']['dur'] - 1.8
    sc.drums([tb], 0.6, f0=75, f1=38, dec=1.5, n_dur=4); sc.perc.add(bell(mtof(nm('D4')), 8), tb, 0.3)
    # 尾声：回到主题，箫 + 古琴，最后一声泛音
    t0 = B['L49']['start']
    sc.pads(t0, end, [['D3', 'A3', 'F#4', 'E4'], ['G2', 'D3', 'B3', 'A4'], ['B2', 'F#3', 'D4', 'A4'], ['D3', 'A3', 'F#4', 'A4']], 6.0, 0.15, 0.45)
    notes = melody_phrase(t0 + 0.6, 0.62, 'D', 0, length=16)
    sig, ts = flute(notes, 'xiao'); sc.mel.add(sig, ts, 0.13)
    tf = B['L52']['start']
    sc.pl.add(pluck(mtof(nm('D6')), 8, 0.2, 0.35, kind='qin'), tf + 0.2, 0.25)
    sc.perc.add(bell(mtof(nm('D4')), 9), tf + 1.3, 0.25)
    sc.gliss(tf + 1.3, 'D', 69, 93, True, 0.04, 0.12)
    sc.low.add(pad([nm('D2'), nm('A2'), nm('D3'), nm('F#3')], end - tf, att=2, rel=4, bright=0.35), tf, 0.2)
    return sc


# ───────────────────────── 音效 ─────────────────────────
def sfx_bus():
    fx = Bus()
    for s in LAY['shots']:
        tr, t = s['tr'], s['start'] - s['td'] / 2
        if s['idx'] == 0: continue
        if tr == 'ink':
            x = noise(s['td'] + 0.8, 80, 900, s['idx']); e = np.sin(np.linspace(0, np.pi, len(x))) ** 2
            fx.add(x * e, t, 0.05)
        elif tr == 'brush':
            x = noise(0.9, 1200, 7000, s['idx']); tt = np.linspace(0, 1, len(x))
            e = np.exp(-((tt - 0.3) / 0.18) ** 2) * (0.6 + 0.4 * np.abs(np.sin(tt * 90)))
            fx.add(x * e, t + s['td'] * 0.25, 0.09, pan=0.3)
        elif tr == 'scroll':
            x = noise(s['td'] + 0.4, 300, 5000, s['idx']); tt = np.linspace(0, 1, len(x))
            e = np.sin(np.pi * tt) * (0.5 + 0.5 * np.abs(np.sin(tt * 40 + np.sin(tt * 13) * 3)))
            fx.add(x * e, t, 0.06)
        elif tr == 'wash':
            x = noise(s['td'] + 1.0, 200, 2500, s['idx']); e = np.sin(np.linspace(0, np.pi, len(x))) ** 3
            fx.add(x * e, t, 0.035)
        for f in s['fx']:
            d = s['vis1'] - s['vis0']
            if f == 'rain':
                x = noise(d, 800, 9000, 11 + s['idx']) + 0.6 * noise(d, 150, 700, 12); e = env_ar(len(x), 1.2, 1.2)
                b2, a2 = signal.butter(2, 5000 * 2 / SR); x = signal.lfilter(b2, a2, x)
                fx.add(x * e, s['vis0'], 0.02)
            if f in ('ripple', 'waves', 'lanterns') and 'ripple' in s['fx'] or f == 'waves':
                x = noise(d, 100, 900, 21 + s['idx']); tt = np.arange(len(x)) / SR
                x *= (0.6 + 0.4 * np.sin(tt * 1.7) * np.sin(tt * 0.6 + 1)); fx.add(x * env_ar(len(x), 1, 1), s['vis0'], 0.045)
            if f == 'swallows':
                for k in range(6):
                    tt = s['vis0'] + 1.2 + k * 0.9 + rng.random() * 0.4
                    n = S(0.12); q = np.arange(n) / SR
                    ch = np.sin(2 * np.pi * (4200 + 2500 * np.sin(q * 70)) * q) * np.exp(-q * 30)
                    fx.add(ch, tt, 0.03, pan=-0.4 + k * 0.15)
            if f == 'steam':
                fx.add(noise(d, 1500, 6000, 31) * env_ar(S(d), 0.6, 1.0) * 0.4, s['vis0'], 0.012)
            if f == 'gold':
                for k in range(10):
                    fx.add(bell(2000 + rng.random() * 3000, 1.2) * 0.2, s['vis0'] + 0.5 + k * d / 11, 0.05, pan=rng.random() - 0.5)
            if f == 'dawn':  # 鸽子扑翅
                for k in range(7):
                    fl = noise(0.12, 200, 2500, 40 + k) * np.hanning(S(0.12)); fx.add(fl, s['vis0'] + 1.0 + k * 0.16, 0.12 * (1 - k / 9))
        if s['img'] == 'w_metro':
            x = noise(2.4, 100, 3000, 51); tt = np.linspace(0, 1, len(x)); fx.add(x * np.sin(np.pi * tt) ** 2, s['start'] - 0.3, 0.06)
        if s['img'] == 'g_ducks':  # 嘎
            for k, tq in enumerate([1.0, 1.35, 2.6]):
                n = S(0.16); q = np.arange(n) / SR
                f0 = 520 - 260 * q / 0.16
                saw = signal.sawtooth(phase_of(np.full(n, 1.0) * f0)) * np.exp(-q * 9)
                b, a = signal.butter(2, [900 * 2 / SR, 2600 * 2 / SR], 'band')
                fx.add(signal.lfilter(b, a, saw) * 2, s['start'] + tq, 0.05, pan=0.2 * k)
    # 印章落下：闷响 + 纸声
    stamp = drum(160, 80, 25, 0.4, 0.8) * 0.8 + noise(0.4, 1500, 6000, 3) * np.exp(-np.arange(S(0.4)) / (SR * 0.03)) * 0.5
    for x in LAY['texts']:
        if x['k'] == 'chapter': fx.add(stamp, x['bs'] + 0.55, 0.22)
        if x['k'] == 'title' and x['voice']: fx.add(stamp, x['voice']['start'] - 0.15 + 1.55, 0.18)
        if x['k'] == 'final':
            fx.add(stamp, x['bs'] + (x['at'] or 0) + 2.15, 0.2)
            br = noise(1.7, 900, 6500, 99); tt = np.linspace(0, 1, len(br))
            br *= np.sin(np.pi * tt) ** 0.7 * (0.55 + 0.45 * np.abs(np.sin(tt * 70))) * np.exp(-tt * 1.2)
            fx.add(br, x['bs'] + (x['at'] or 0) - 0.9, 0.11, pan=-0.2)
    for s in LAY['shots']:
        if s['season']: fx.add(stamp, s['start'] + 0.3, 0.16)
    # 开场与结尾的墨滴
    def drop():
        n = S(0.5); q = np.arange(n) / SR
        plip = np.sin(phase_of(1400 + 1800 * np.exp(-q * 40))) * np.exp(-q * 22)
        return plip + drum(70, 38, 4, 0.5, 0.2) * 0.6 * np.exp(-q * 3)
    sh0 = LAY['shots'][0]
    fx.add(drop(), sh0['start'] + 1.55, 0.35)
    fx.add(noise(5.5, 60, 400, 77) * env_ar(S(5.5), 2, 2), 0.0, 0.03)
    for s in LAY['shots']:
        if 'inkdrop_end' in s['fx']: fx.add(drop(), s['start'] + 0.1, 0.32)
    # 防空警报（远处、克制）
    for e in LAY['sfx']:
        if e['type'] == 'siren':
            v = next(v for v in LAY['voice'] if v['id'] == e['beat'])
            t = v['start'] + v['dur'] * 0.3
            d = 9.0; n = S(d); q = np.arange(n) / SR
            f = 330 + 330 * np.clip(q / 3.0, 0, 1) - 120 * np.clip((q - 6.5) / 2.5, 0, 1)
            sir = np.sin(phase_of(f)) + 0.4 * np.sin(2 * phase_of(f))
            b, a = signal.butter(2, 1500 * 2 / SR); sir = signal.lfilter(b, a, sir)
            fx.add(sir * env_ar(n, 2.0, 2.5), t, 0.035)
    return fx


# ───────────────────────── 旁白 ─────────────────────────
def read_wav(p):
    with wave.open(str(p)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2: x = x.reshape(-1, 2).mean(1)
    return x


def voice_bus():
    vb = Bus(); env = np.zeros(N, np.float32)
    for v in LAY['voice']:
        x = read_wav(ROOT / v['file'])
        x = x / (np.sqrt(np.mean(x ** 2)) + 1e-6) * 0.1   # 粗略统一响度
        g = {'P': 0.95, 'A': 0.95, 'S': 0.95}.get(v['v'], 1.0)
        vb.add(x, v['start'], g, pan=0.0)
        a = S(v['start']); env[a:a + len(x)] = 1
    return vb, env


def smooth_env(e, att=0.08, rel=0.6):
    out = np.zeros_like(e); a = np.exp(-1 / (SR * att)); r = np.exp(-1 / (SR * rel))
    # 下采样处理再插值，避免逐样本 Python 循环
    hop = 441; es = e[::hop]; o = np.zeros_like(es); y = 0.0
    aa, rr = a ** hop, r ** hop
    for i, v in enumerate(es):
        y = v + (y - v) * (aa if v > y else rr); o[i] = y
    return np.interp(np.arange(len(e)), np.arange(len(es)) * hop, o).astype(np.float32)


def main():
    print('作曲与合成配乐…', flush=True)
    sc = compose()
    hall = make_ir(3.4, 0.03, 1); room = make_ir(1.2, 0.01, 5, 1.5)
    music = sc.pad.x * 1.0 + sc.low.x * 1.0
    music = reverb(music, hall, 0.35)
    music += reverb(sc.pl.x, hall, 0.45) + reverb(sc.mel.x, hall, 0.5) + reverb(sc.perc.x, hall, 0.4)
    # 情绪：至暗时刻配乐退到最低
    t = np.arange(N) / SR
    mood = np.ones(N, np.float32)
    for a, b in LAY['dark']:
        mood *= 1 - 0.55 * np.clip((t - a) / 1.5, 0, 1) * np.clip((b + 0.5 - t) / 1.5, 0, 1)
    print('音效…', flush=True)
    fx = sfx_bus()
    fxw = reverb(fx.x, room, 0.25)
    print('旁白与混音…', flush=True)
    vb, venv = voice_bus()
    duck = 1 - 0.58 * smooth_env(venv, 0.12, 0.9)
    voice = reverb(vb.x, room, 0.08)
    mb = music * (0.6 * duck * mood)
    vm = venv > 0.5
    def db(x, m): return 10 * np.log10(np.mean(x[:, m] ** 2) + 1e-12)
    print(f'电平  旁白 {db(voice, vm):.1f} dB | 配乐(有旁白) {db(mb, vm):.1f} | 配乐(无旁白) {db(mb, ~vm):.1f} | 音效 {db(fxw, vm | ~vm):.1f}')
    mix = mb + fxw * 1.0 + voice * 1.0
    # 片头片尾淡入淡出
    fade = np.clip(t / 0.8, 0, 1) * np.clip((LAY['duration'] + 0.6 - t) / 2.5, 0, 1)
    mix *= fade
    peak = np.abs(mix).max(); print('峰值', round(float(peak), 3))
    mix = np.tanh(mix / max(peak, 1e-6) * 1.4) / np.tanh(1.4) * 0.95
    out = ROOT / 'output/soundtrack.wav'
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
    # 只要配乐（调试用）
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(out), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k',
                    str(ROOT / 'output/soundtrack.m4a')], check=True)
    print('完成 output/soundtrack.m4a')


if __name__ == '__main__':
    main()
