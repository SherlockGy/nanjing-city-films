#!/usr/bin/env python3
"""《一笔画完南京》配乐：128 BPM 国潮电子（古筝拨弦 + 笛子 + 琵琶轮指 + 电子鼓 + 超锯齿和弦），
与画面事件逐拍对齐的音效（落笔、上色、砸字、贴纸、甩镜…）。全部程序化合成。
用法：.venv/bin/python short/tools/build_music.py"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from build_audio import pluck, flute, pad, drum, bell, noise, make_ir, reverb, env_ar, phase_of, mtof, nm, S, SR  # noqa: E402

EV = json.loads((ROOT / 'output/short/events.json').read_text())
BPM = EV['bpm']; BEAT = 60 / BPM; BAR = BEAT * 4
DUR = EV['duration'] + 3.0
N = int(DUR * SR)
rng = np.random.default_rng(11)
tb = lambda bar, beat=0: (bar + beat / 4) * BAR


class Bus:
    def __init__(self): self.x = np.zeros((2, N), np.float32)
    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
        a = S(t)
        if a < 0: sig = sig[:, -a:]; a = 0
        b = min(N, a + sig.shape[1])
        if b > a: self.x[:, a:b] += sig[:, :b - a] * gain


# ───────── 电子鼓与合成器 ─────────
def kick():
    n = S(.45); t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28)
    x = np.sin(phase_of(f)) * np.exp(-t * 6.5)
    x[:S(.003)] += rng.standard_normal(S(.003)) * .5
    return np.tanh(x * 1.8).astype(np.float32)


def clap():
    n = S(.3); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for k, d in enumerate([0, .011, .022]):
        a = S(d); m = n - a
        out[a:] += noise(m / SR, 900, 2600, 30 + k) * np.exp(-np.arange(m) / SR * (60 if k < 2 else 14))
    return out / np.abs(out).max()


def hat(open_=False):
    d = .35 if open_ else .07; n = S(d); t = np.arange(n) / SR
    x = noise(d, 7000, 13000, 40 + open_) * np.exp(-t * (9 if open_ else 55))
    return x / np.abs(x).max()


def snare():
    n = S(.25); t = np.arange(n) / SR
    x = noise(.25, 1200, 6000, 50) * np.exp(-t * 20) + .6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28)
    return x / np.abs(x).max()


def tom(f=110):
    return drum(f * 1.6, f, 9, .6, .25)


def sub(m, dur):
    n = S(dur); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * mtof(m) * t) + .25 * np.sin(4 * np.pi * mtof(m) * t)
    x *= env_ar(n, .005, .05)
    return np.tanh(x * 1.3).astype(np.float32)


def stab(midis, dur=.2):
    n = S(dur); t = np.arange(n) / SR; L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    for m in midis:
        for v in range(5):
            f0 = mtof(m) * (1 + (v - 2) * .006)
            sw = sum(np.sin(2 * np.pi * f0 * k * t + v) / k for k in range(1, 12) if f0 * k < 9000)
            pan = (v - 2) / 2.5; L += sw * (1 - pan); R += sw * (1 + pan)
    e = np.exp(-t * 9) * env_ar(n, .003, .03)
    out = np.vstack([L * e, R * e]); return out / np.abs(out).max()


def riser(dur, up=True):
    n = S(dur); t = np.arange(n) / SR; u = t / dur if up else 1 - t / dur
    x = rng.standard_normal(n).astype(np.float32)
    out = np.zeros(n, np.float32); hop = 2048
    for a in range(0, n, hop):  # 带通中心频率随时间上扫
        fc = 300 * (30 ** u[a]); b, aa = signal.butter(2, [max(50, fc * .7) * 2 / SR, min(.99, fc * 1.4 * 2 / SR)], 'band')
        out[a:a + hop] = signal.lfilter(b, aa, x[a:a + hop])
    sw = np.sin(phase_of(200 * (6 ** u))) * .3
    return (out * 2 + sw) * (u ** 2 if up else (1 - t / dur) ** .5)


def impact():
    n = S(3.5); t = np.arange(n) / SR
    boom = np.sin(phase_of(30 + 50 * np.exp(-t * 6))) * np.exp(-t * 1.6)
    crash = noise(3.5, 3000, None, 61) * np.exp(-t * 2.2) * .35
    return (boom + crash) / 1.2


def gong(f=90, dur=7):
    n = S(dur); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for r, a, d in [(1, 1, .5), (1.47, .6, .7), (2.09, .5, .9), (2.56, .35, 1.1), (3.2, .3, 1.3), (4.1, .2, 1.6), (5.3, .12, 2)]:
        out += a * np.sin(2 * np.pi * f * r * t * (1 + .002 * np.sin(2 * np.pi * 3 * t))) * np.exp(-t * d) * (1 - np.exp(-t * 12))
    return out / np.abs(out).max()


# ───────── 编曲 ─────────
CH = [['E3', 'B3', 'E4', 'G4'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3'], ['D3', 'A3', 'D4', 'F#4']]
ROOT_N = ['E2', 'C2', 'G2', 'D2']
HOOK = [(0, .5, 'E5'), (.5, .5, 'G5'), (1, 1, 'A5'), (2, 1.5, 'B5'), (3.5, .5, 'A5'),
        (4, 1, 'G5'), (5, 1, 'E5'), (6, 1, 'D5'), (7, 1, 'E5'),
        (8, .5, 'G5'), (8.5, .5, 'A5'), (9, 1, 'B5'), (10, 1, 'D6'), (11, 1, 'B5'),
        (12, 2, 'A5'), (14, .5, 'G5'), (14.5, .5, 'A5'), (15, 1, 'B5')]
HOOK2 = HOOK[:12] + [(12, 1, 'A5'), (13, .5, 'B5'), (13.5, .5, 'A5'), (14, 1, 'G5'), (15, 1, 'E5')]


def compose():
    dr, bs, pl, pd, ld, fx = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    K, C, Hc, Ho, Sn = kick(), clap(), hat(), hat(True), snare()
    kicks = []

    def groove(b0, b1, level=1.0, big=False):
        for b in range(b0, b1):
            for k in range(4):
                t = tb(b, k); dr.add(K, t, .9 * level); kicks.append(t)
                dr.add(Hc, t + BEAT / 2, .13 * level, pan=.25)
                if big: dr.add(Hc, t + BEAT / 4, .07 * level, pan=-.3); dr.add(Hc, t + BEAT * .75, .07 * level, pan=-.3)
            dr.add(C, tb(b, 1), .42 * level); dr.add(C, tb(b, 3), .42 * level)
            if big and b % 2 == 1: dr.add(Ho, tb(b, 3.5), .12 * level)
            if b % 4 == 3:  # 每四小节一次鼓花
                for j, f in enumerate([150, 130, 110, 90]): dr.add(tom(f), tb(b, 3) + j * BEAT / 4, .3 * level, pan=-.4 + j * .25)

    def bass(b0, b1, busy=False):
        for b in range(b0, b1):
            m = nm(ROOT_N[b % 4])
            pat = [(0, .45), (.75, .2), (1.5, .45), (2.5, .45), (3.25, .2), (3.5, .45)] if busy else [(0, .9), (1.5, .4), (2.5, .9), (3.5, .4)]
            for p, d in pat: bs.add(sub(m + (12 if busy and p in (.75, 3.25) else 0), d * BEAT), tb(b, p), .5)

    def arp(b0, b1, level=1.0, oct=12):
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        for b in range(b0, b1):
            tones = sorted(nm(x) + oct for x in CH[b % 4])
            for k in range(8):
                m = tones[pat[k] % 4]
                pl.add(pluck(mtof(m), 1.2, .75, 4.5), tb(b, k * .5), .13 * level * (1.1 if k % 2 == 0 else .8), pan=(-.35 if k % 2 else .35))

    def pads(b0, b1, level=1.0, bright=.4):
        for b in range(b0, b1): pd.add(pad([nm(x) + 12 for x in CH[b % 4]], BAR + .4, att=.25, rel=.4, bright=bright), tb(b), .1 * level)

    def lead(b0, theme, level=1.0, kind='dizi', tr=0):
        notes = [(tb(b0) + s * BEAT, d * BEAT * .96, nm(n) + tr) for s, d, n in theme]
        sig, ts = flute(notes, kind, vib=.012)
        ld.add(sig, ts, .22 * level)
        ld.add(sig, ts + BEAT * .75, .07 * level, pan=-.5); ld.add(sig, ts + BEAT * 1.5, .04 * level, pan=.5)  # 附点八分回声

    def stabs(b0, b1):
        for b in range(b0, b1):
            for k in [.5, 1.5, 2.5, 3.5]: pd.add(stab([nm(x) + 12 for x in CH[b % 4]]), tb(b, k), .09)

    def tremolo(b0, notes, level=1.0):
        for i, n in enumerate(notes):
            for j in range(16): pl.add(pluck(mtof(nm(n)), .3, .7, 9, kind='pipa'), tb(b0 + i // 2, (i % 2) * 2) + j * BEAT / 8, .05 * level * (0.6 + .4 * np.sin(j / 3)), pan=.4)

    # 开场：0–3 小节
    fx.add(impact(), 0, .5)
    arp(0, 4, .8)
    for b in (2, 3):
        for k in range(4): dr.add(K, tb(b, k), .55); kicks.append(tb(b, k))
    pads(0, 4, .7, .3)
    fx.add(riser(BAR, True), tb(3), .2)
    for j in range(16): dr.add(Sn, tb(3) + j * BEAT / 4, .05 + .2 * j / 16)
    # A 段：4–27
    groove(4, 28); bass(4, 28); arp(4, 28); pads(4, 28, .8)
    for b in (8, 20): lead(b, HOOK if b == 8 else HOOK2)
    lead(12, HOOK2, .9); tremolo(16, ['E5', 'G5', 'A5', 'B5', 'D6', 'B5', 'A5', 'G5'], .9); lead(24, HOOK, .9)
    # 中场：28–29
    fx.add(impact(), tb(28, 2), .45)
    pads(28, 30, 1.0, .25)
    fx.add(riser(BAR * 1.5, True), tb(28, 2), .26)
    for j in range(24): dr.add(Sn, tb(29) + j * BEAT / 6, .05 + .25 * j / 24)
    # B 段：30–53（更满）
    groove(30, 54, 1.05, big=True); bass(30, 54, busy=True); arp(30, 54, 1.0); pads(30, 54, .7, .5); stabs(30, 54)
    for b in (30, 38, 46): lead(b, HOOK, 1.0); lead(b + 4, HOOK2, 1.0)
    tremolo(42, ['B5', 'D6', 'E6', 'D6', 'B5', 'A5', 'G5', 'E5'], 1.0)
    # 片尾：54–55 拉远蓄力，56 爆点，56–61 全奏，62 收束
    pads(54, 56, 1.0, .3); arp(54, 56, .7)
    fx.add(riser(BAR * 2, True), tb(54), .28)
    for j in range(32): dr.add(Sn, tb(55) + j * BEAT / 8, .04 + .25 * j / 32)
    fx.add(impact(), tb(56), .6)
    groove(56, 62, 1.1, big=True); bass(56, 62, busy=True); arp(56, 62, 1.0); stabs(56, 62); pads(56, 62, .8, .5)
    lead(56, HOOK, 1.1, tr=0); lead(56, HOOK, .5, 'xiao', tr=-12); lead(60, HOOK2[:8], 1.0)
    fx.add(impact(), tb(62), .55); fx.add(gong(82, 7), tb(62), .45)
    pd.add(pad([nm(x) + 12 for x in CH[0]], BAR * 2.5, att=.05, rel=2.5, bright=.45), tb(62), .16)
    pl.add(pluck(mtof(nm('E6')), 4, .4, .8, kind='qin'), tb(62, 2), .25)
    return dr, bs, pl, pd, ld, fx, kicks


# ───────── 画面音效 ─────────
def sfx():
    b = Bus()
    def thump(f0=95, f1=45, d=.5): return drum(f0, f1, 8, d, .5)
    def pop():
        n = S(.12); t = np.arange(n) / SR; return np.sin(phase_of(500 + 900 * t / .12)) * np.exp(-t * 30)
    def whoosh(d=.55, seed=0):
        x = riser(d, True)[: S(d)]; return x * np.hanning(len(x))
    def scribble(d, soft=False, seed=0):
        n = S(d); t = np.arange(n) / SR
        x = noise(d, 2000, 7000, seed); r = np.random.default_rng(seed)
        am = np.repeat(r.random(int(d * 40) + 2), int(SR / 40) + 1)[:n]
        e = (.4 + .6 * am) * env_ar(n, .02, .08)
        return x * e * (.5 if soft else 1)
    def tick(f=2200):
        n = S(.04); t = np.arange(n) / SR; return np.sin(2 * np.pi * f * t) * np.exp(-t * 120)
    def page():
        x = noise(.35, 800, 6000, 77); t = np.arange(len(x)) / SR; return x * np.sin(np.pi * t / .35) ** 3
    def quack(t0):
        for k, dt in enumerate([0, .22]):
            n = S(.16); q = np.arange(n) / SR
            saw = signal.sawtooth(phase_of(560 - 240 * q / .16)) * np.exp(-q * 8)
            bb, aa = signal.butter(2, [900 * 2 / SR, 2600 * 2 / SR], 'band'); b.add(signal.lfilter(bb, aa, saw) * 2, t0 + dt, .12, pan=.4)
    for e in EV['events']:
        t, ty = e['t'], e['type']
        if ty == 'slam': b.add(thump(110, 48, .5), t, .45); b.add(noise(.15, 1500, 8000, 2) * np.exp(-np.arange(S(.15)) / SR * 30), t, .12)
        elif ty == 'slam2': b.add(thump(130, 60, .4), t, .35)
        elif ty == 'hit': b.add(tom(120 + e['n'] * 25), t, .35); b.add(pop(), t, .05)
        elif ty == 'whoosh': b.add(whoosh(.55, int(t * 10)), t - .25, .22)
        elif ty == 'scribble': b.add(scribble(e['dur'], e.get('soft'), int(t * 7)), t, .06)
        elif ty == 'pop':
            for j in range(4): b.add(pop(), t + j * .03, .09, pan=-.3 + j * .2)
        elif ty == 'type':
            for j in range(10): b.add(tick(3000 + (j % 3) * 400), t + j * e['dur'] / 10, .05)
        elif ty == 'stamp': b.add(thump(170, 80, .3), t, .3); b.add(noise(.2, 1500, 5000, 5) * np.exp(-np.arange(S(.2)) / SR * 25), t, .12)
        elif ty == 'tick': b.add(tick(1200 + e['n'] * 120), t, .2); b.add(bell(1400 + e['n'] * 90, .8) * .3, t, .08)
        elif ty == 'station':
            k, t4, t8 = e['key'], t + BEAT * 4, t + BEAT * 8
            if k == 'bridge':
                for j in range(8): b.add(thump(200, 150, .12), t4 + .3 + j * BEAT / 2, .05, pan=.3)
            if k == 'jiming': b.add(bell(mtof(nm('E5')), 3.5) * .5, t4, .14)
            if k == 'wall': b.add(drum(80, 40, 6, .6, .6), t4, .3)
            if k == 'sunyat':
                for j in range(16): b.add(tick(1600 + j * 40), t + j * BEAT / 4, .07)
            if k == 'meiling':
                for j in range(8): b.add(bell(2400 + j * 220, 1.0) * .4, t4 + j * .06, .06, pan=-.5 + j / 8)
            if k == 'elephant': b.add(signal.sawtooth(phase_of(np.linspace(300, 520, S(.4)))) * np.hanning(S(.4)) * .5, t4 + .2, .05)
            if k == 'museum':
                for j in range(4): b.add(pop(), t8 + j * BEAT / 2, .1)
            if k == 'qinhuai':
                x = noise(BAR * 3, 150, 1200, 9); tt = np.arange(len(x)) / SR; b.add(x * (.5 + .5 * np.sin(tt * 2.1)) * env_ar(len(x), .5, 1), t4, .05)
            if k == 'gate':
                for j in range(27): b.add(tick(900 + j * 30), t8 + j * BEAT * 4 / 27, .12)
            if k == 'food': quack(t + BEAT * 5); b.add(pop(), t + BEAT * 9, .12)
            if k == 'literature':
                for j in range(3): b.add(page(), t4 + j * .18, .1)
            if k == 'newcity':
                for j in range(6): b.add(bell(3000 + j * 300, .6) * .3, t4 + j * BEAT / 2, .05)
    return b


def sidechain(kicks):
    g = np.ones(N, np.float32)
    for t in kicks:
        a = S(t); n = min(N - a, S(BEAT))
        if n > 0: g[a:a + n] = np.minimum(g[a:a + n], 1 - .75 * np.exp(-np.arange(n) / SR * 14))
    return g


def main():
    print('编曲合成…', flush=True)
    dr, bs, pl, pd, ld, fx, kicks = compose()
    sc = sidechain(kicks)
    hall = make_ir(2.2, .02, 3); room = make_ir(.8, .01, 7, 1.5)
    music = dr.x * 1.0 + reverb(dr.x, room, .12) * .3
    music += bs.x * sc * 1.0
    music += reverb(pl.x, hall, .3) * (0.6 + .4 * sc)
    music += reverb(pd.x, hall, .35) * sc
    music += reverb(ld.x, hall, .3)
    music += reverb(fx.x, hall, .25)
    print('音效…', flush=True)
    sf = reverb(sfx().x, room, .2)
    mix = music * .55 + sf * .9
    t = np.arange(N) / SR
    mix *= np.clip((EV['duration'] + 2.5 - t) / 2.5, 0, 1)
    pk = np.abs(mix).max(); print('峰值', round(float(pk), 3))
    mix = np.tanh(mix / pk * 1.6) / np.tanh(1.6) * .95
    out = ROOT / 'output/short/music.wav'
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(out), '-t', f"{EV['duration'] + 0.5:.3f}", '-af', 'loudnorm=I=-14:TP=-1.0:LRA=9', '-ar', '48000',
                    '-c:a', 'aac', '-b:a', '256k', str(ROOT / 'output/short/music.m4a')], check=True)
    out.unlink()
    print('完成 output/short/music.m4a')


if __name__ == '__main__':
    main()
