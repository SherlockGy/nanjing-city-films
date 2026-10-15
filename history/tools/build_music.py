#!/usr/bin/env python3
"""《金陵 2500》配乐：96 BPM 史诗管弦（弦乐固定音型、铜管、定音鼓/太鼓、合唱垫、古筝、箫笛、编钟）+ 切镜音效。
全部程序化合成，切镜与“重拍”对齐。用法：.venv/bin/python history/tools/build_music.py"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from build_audio import pluck, flute, pad, drum, bell, noise, make_ir, reverb, env_ar, phase_of, mtof, nm, S, SR  # noqa: E402

SC = json.loads((ROOT / 'output/history/scenes.json').read_text())
BPM = SC['bpm']; BEAT = 60 / BPM
DUR = SC['duration'] + 4
N = int(DUR * SR)
B = {s['id']: round(s['t0'] / BEAT) for s in SC['scenes']}
bt = lambda b: b * BEAT
rng = np.random.default_rng(5)


class Bus:
    def __init__(self): self.x = np.zeros((2, N), np.float32)
    def add(self, sig, t, g=1.0, pan=0.0):
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
        a = S(t)
        if a < 0: sig = sig[:, -a:]; a = 0
        b = min(N, a + sig.shape[1])
        if b > a: self.x[:, a:b] += sig[:, :b - a] * g


def saw(f, n, harm=12, det=0.0):
    t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for k in range(1, harm + 1):
        if f * k > 9000: break
        out += np.sin(2 * np.pi * f * (1 + det) * k * t + k) / k
    return out


def spic(m, dur=.22, bright=10):
    """弦乐跳弓"""
    n = S(dur + .15); t = np.arange(n) / SR
    x = (saw(mtof(m), n, bright, -.003) + saw(mtof(m), n, bright, .003)) * .5
    return x * np.exp(-t * 9) * env_ar(n, .008, .05)


def brass(midis, dur, att=.25):
    n = S(dur); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    swell = np.clip(t / max(att, .01), 0, 1)
    for m in midis:
        f = mtof(m)
        for k in range(1, 14):
            if f * k > 8000: break
            amp = (1 / k) * (swell ** (1 + k * .25))  # 起音时高次谐波滞后 → 铜管的“开口”感
            out += amp * np.sin(2 * np.pi * f * k * t * (1 + .0015 * np.sin(2 * np.pi * 5 * t)))
    return out * env_ar(n, att * .6, .5) / max(1, len(midis))


def choir(midis, dur):
    x = pad(midis, dur, att=1.2, rel=1.5, bright=.6)
    out = np.zeros_like(x)
    for f0, q in ((700, 4), (1150, 5), (2600, 6)):
        b, a = signal.iirpeak(f0 / (SR / 2), q); out += signal.lfilter(b, a, x, axis=1)
    return out / np.abs(out).max()


def timp(m, dur=2.0):
    f = mtof(nm(m) if isinstance(m, str) else m); return drum(f * 1.4, f, 2.6, dur, .25)
def taiko(): return drum(95, 52, 5, 1.4, .7)
def boom():
    n = S(4); t = np.arange(n) / SR
    return (np.sin(phase_of(28 + 60 * np.exp(-t * 5))) * np.exp(-t * 1.3) + noise(4, 2500, None, 9) * np.exp(-t * 2.5) * .3) / 1.1
def swell(dur):
    n = S(dur); t = np.arange(n) / SR; return noise(dur, 3000, 14000, 21) * (t / dur) ** 3
def gliss(m0, m1, step=.035):
    return [(i * step, m) for i, m in enumerate(range(m0, m1)) if m % 12 in (2, 4, 7, 9, 11)]


CH = {
    'A': [['D3', 'A3', 'D4', 'F#4'], ['B2', 'F#3', 'B3', 'D4'], ['G2', 'D3', 'G3', 'B3'], ['A2', 'E3', 'A3', 'C#4']],
    'B': [['D3', 'A3', 'D4', 'F#4'], ['A2', 'E3', 'A3', 'C#4'], ['B2', 'F#3', 'B3', 'D4'], ['G2', 'D3', 'G3', 'B3']],
    'C': [['G2', 'D3', 'G3', 'B3'], ['D3', 'A3', 'D4', 'F#4'], ['A2', 'E3', 'A3', 'C#4'], ['B2', 'F#3', 'B3', 'D4']],
}
HOOK = [(0, 1, 'A4'), (1, .5, 'B4'), (1.5, .5, 'D5'), (2, 1, 'E5'), (3, 1, 'D5'), (4, 1.5, 'F#5'), (5.5, .5, 'E5'), (6, 1, 'D5'), (7, 1, 'B4'),
        (8, 1, 'A4'), (9, .5, 'B4'), (9.5, .5, 'D5'), (10, 1, 'E5'), (11, 1, 'A5'), (12, 2, 'F#5'), (14, 1, 'E5'), (15, 1, 'D5')]
HOOK2 = [(0, 1, 'D5'), (1, .5, 'E5'), (1.5, .5, 'F#5'), (2, 1, 'A5'), (3, 1, 'B5'), (4, 1.5, 'A5'), (5.5, .5, 'F#5'), (6, 1, 'E5'), (7, 1, 'D5'),
         (8, 1, 'B4'), (9, 1, 'D5'), (10, 1, 'E5'), (11, 1, 'F#5'), (12, 2, 'E5'), (14, 2, 'D5')]


def piano(m, dur=1.6, g=1.0):
    """钢琴感的拨奏：两根略失谐的弦 + 击弦噪声"""
    a = pluck(mtof(m), dur, .5, 1.3, inharm=4e-4, pos=.12) + .5 * pluck(mtof(m) * 1.0015, dur, .45, 1.5, inharm=4e-4, pos=.13)
    return a * g


def compose():
    st, br, pc, pl, ld, fx, ch = (Bus() for _ in range(7))
    def pads(b0, b1, key, g=.11, oct=12):
        prog = CH[key]; b = b0; i = 0
        while b < b1:
            d = min(4, b1 - b); st.add(pad([nm(x) + oct for x in prog[i % 4]], d * BEAT + .5, att=.4, rel=.6, bright=.42), bt(b), g); b += 4; i += 1
    def ostinato(b0, b1, key, g=.07, sub=2, oct=12):  # 钢琴分解和弦
        prog = CH[key]; pat = [0, 2, 1, 3, 2, 1, 3, 2]
        for b in range(b0, b1):
            c = sorted(nm(x) + oct for x in prog[((b - b0) // 4) % 4][1:]) + [nm(prog[((b - b0) // 4) % 4][1]) + oct + 12]
            for k in range(sub): pl.add(piano(c[pat[((b - b0) * sub + k) % 8] % 4], 1.2), bt(b) + k * BEAT / sub, g * (1.1 if k == 0 else .85), pan=(-.25 if k % 2 else .25))
    def bass(b0, b1, key, busy=False, g=.42):
        prog = CH[key]
        for b in range(b0, b1):
            r = nm(prog[((b - b0) // 4) % 4][0]) - 12
            hits = [(0, .45), (.5, .4)] if busy else [(0, .9)]
            for o, dd in hits: br.add(np.tanh(np.sin(2 * np.pi * mtof(r) * np.arange(S(dd * BEAT)) / SR) * 1.5) * env_ar(S(dd * BEAT), .005, .06), bt(b) + o * BEAT, g)
    def epic(b0, b1, g=1.0):  # 太鼓 + 低鼓
        for b in range(b0, b1):
            k = (b - b0) % 4
            if k == 0: pc.add(taiko(), bt(b), .55 * g)
            if k == 2: pc.add(taiko(), bt(b), .38 * g)
            if k == 3: pc.add(drum(130, 80, 9, .5, .5), bt(b) + BEAT / 2, .22 * g)
            pc.add(drum(170, 120, 14, .3, .6), bt(b) + BEAT / 2, .08 * g)
    def pop(b0, b1, g=1.0):  # 昂扬的流行史诗节奏：底鼓 + 拍手军鼓 + 沙锤
        for b in range(b0, b1):
            k = (b - b0) % 4
            if k in (0, 2): pc.add(drum(80, 45, 8, .5, .3), bt(b), .55 * g)
            if k == 2: pc.add(drum(80, 45, 8, .5, .3), bt(b) + BEAT * .75, .3 * g)
            if k in (1, 3): pc.add(noise(.18, 1200, 6000, b) * np.exp(-np.arange(S(.18)) / SR * 22) + drum(190, 150, 20, .18, .9) * .5, bt(b), .32 * g)
            for j in range(4): pc.add(noise(.04, 7000, 13000, b * 4 + j) * np.exp(-np.arange(S(.04)) / SR * 70), bt(b) + j * BEAT / 4, .05 * g * (1.3 if j % 2 else .8))
            if k == 0: pc.add(taiko(), bt(b), .3 * g)
    def theme(b0, th, kind='dizi', g=.2, tr=0):
        notes = [(bt(b0) + s0 * BEAT, d * BEAT * .96, nm(n) + tr) for s0, d, n in th]
        sig, ts = flute(notes, kind, vib=.009); ld.add(sig, ts, g); ld.add(sig, ts + BEAT * .75, g * .25, pan=-.5)
    def zheng(b, m0=62, m1=88, g=.12):
        for dt, m in gliss(m0, m1): pl.add(pluck(mtof(m), 2.5, .75, 1.6), bt(b) - .6 + dt, g * (.6 + .4 * (m - m0) / (m1 - m0)), pan=-.5 + (m - m0) / (m1 - m0))
    def hit(b, g=.6): pc.add(taiko(), bt(b), g * .8); pc.add(timp('D2', 3), bt(b), g * .5); fx.add(boom(), bt(b), g * .28)
    def roll(b, n=16, g=.22):
        for j in range(n): pc.add(drum(150, 100, 14, .25, .7), bt(b) + j * BEAT * 2 / n, .03 + g * j / n)

    # 序：暗场，钢琴动机 + 低音铺底，逐渐抬升
    st.add(pad([nm('D2'), nm('A2'), nm('D3')], bt(13) + 1, att=2, rel=1, bright=.3), 0, .2)
    for i, (b, m) in enumerate([(0, 'A4'), (1, 'D5'), (2, 'E5'), (3, 'F#5'), (5, 'A4'), (6, 'D5'), (7, 'E5'), (8, 'A5'), (9, 'F#5'), (10, 'E5'), (11, 'D5'), (12, 'E5')]): pl.add(piano(nm(m), 2.2), bt(b), .14 + i * .006)
    for b in range(4, 13): pc.add(timp('D2', 1.4), bt(b), .1 + b * .015)
    roll(11, 24, .3)
    # 标题
    hit(13, .75); zheng(13); pads(13, 20, 'A', .15); bass(13, 20, 'A', g=.35)
    theme(14, [(0, 2, 'A4'), (2, 1, 'D5'), (3, 1, 'E5'), (4, 2, 'F#5')], 'dizi', .18)
    # 六朝（20–57）：钢琴 + 弦乐 + 轻太鼓，笛子主题
    pads(20, 57, 'A', .1); ostinato(20, 57, 'A', .06); bass(20, 57, 'A', g=.3); epic(29, 57, .7)
    theme(29, HOOK, 'dizi', .17); theme(45, HOOK2, 'xiao', .16)
    # 繁华散尽 · 诗人（57–72）：收
    fx.add(boom(), bt(57), .3); pads(57, 72, 'C', .1); ostinato(57, 72, 'C', .05, sub=1)
    theme(62, [(0, 2, 'A4'), (2, 1, 'B4'), (3, 1, 'D5'), (4, 3, 'E5'), (8, 2, 'D5'), (10, 2, 'B4'), (12, 3, 'A4')], 'xiao', .15)
    roll(70, 16, .25)
    # 大明（72–114）：全开
    hit(72, .8); zheng(72); pads(72, 114, 'B', .12); ostinato(72, 114, 'B', .07); bass(72, 114, 'B', busy=True, g=.36); epic(72, 114, 1.1)
    theme(76, HOOK, 'dizi', .2); theme(92, HOOK2, 'dizi', .2); theme(100, HOOK, 'dizi', .2, tr=12)
    for b in range(76, 114, 8): pl.add(bell(mtof(nm('A5')), 3) * .5, bt(b), .1, pan=.3)
    # 近代（114–142）：保持推进，略收
    pads(114, 142, 'C', .11); ostinato(114, 142, 'C', .06); bass(114, 142, 'C', g=.3); epic(118, 138, .75)
    theme(122, HOOK2, 'dizi', .17); hit(131, .5); roll(140, 12, .15)
    # 1937（142–154）：极简
    pl.add(bell(52, 10, 'temple'), bt(142) + .1, .45)
    st.add(pad([nm('D3'), nm('A3'), nm('F#4')], bt(12), att=2, rel=2, bright=.25), bt(142), .08)
    for b, m in [(144, 'A4'), (146, 'F#4'), (148, 'D4'), (150, 'E4'), (152, 'A4')]: pl.add(piano(nm(m), 3), bt(b), .14)
    # 1968 大桥（154–160）：光回来了
    hit(154, .8); zheng(154); pads(154, 160, 'B', .14); ostinato(154, 160, 'B', .07); bass(154, 160, 'B', busy=True); epic(154, 160, 1.0); roll(158, 16, .28)
    # 当代（160–193）：昂扬的流行史诗律动
    hit(160, .7); pads(160, 193, 'A', .12); ostinato(160, 193, 'A', .07, sub=4, oct=24); bass(160, 193, 'A', busy=True, g=.4); pop(160, 193, 1.0)
    theme(164, HOOK, 'dizi', .2); theme(180, HOOK2, 'dizi', .21)
    roll(191, 16, .3)
    # 终章（193–214）
    hit(193, .9); zheng(193, 62, 93, .14); pads(193, 204, 'B', .16); ostinato(193, 204, 'B', .08, sub=4, oct=24); bass(193, 204, 'B', busy=True, g=.42); pop(193, 204, 1.15)
    theme(196, HOOK, 'dizi', .23); theme(196, HOOK, 'xiao', .12, tr=-12)
    roll(202, 16, .32)
    hit(204, 1.0); pl.add(bell(mtof(nm('D5')), 8), bt(204), .3)
    st.add(pad([nm('D4'), nm('F#4'), nm('A4'), nm('D5')], bt(10), att=.08, rel=3, bright=.5), bt(204), .2)
    br.add(np.tanh(np.sin(2 * np.pi * mtof(nm('D1')) * np.arange(S(5)) / SR) * 1.5) * env_ar(S(5), .01, 3), bt(204), .4)
    for j, m in enumerate(['D5', 'F#5', 'A5', 'D6']): pl.add(piano(nm(m), 4), bt(205) + j * BEAT / 2, .14)
    return st, br, pc, pl, ld, fx, ch


def sfx():
    b = Bus()
    for s in SC['scenes']:
        t = s['t0']
        if t > 0:
            d = .5; x = noise(d, 300 if s['bg'] == 'P' else 120, 5000 if s['bg'] == 'P' else 1800, int(t * 10)); e = np.sin(np.linspace(0, np.pi, len(x))) ** 2
            b.add(x * e, t - .28, .07 if s['bg'] == 'P' else .09)
        pass
    for sid in ('pi', 'wall', 'yongle', 'exam'):
        sc = next(x for x in SC['scenes'] if x['id'] == sid)
        for j in range(14):
            n = S(.03); tt = np.arange(n) / SR; b.add(np.sin(2 * np.pi * (2200 + j * 60) * tt) * np.exp(-tt * 150), sc['t0'] + .35 + j * sc['dur'] * .6 / 14, .05)
    return b


def main():
    print('合成配乐…', flush=True)
    st, br, pc, pl, ld, fx, ch = compose()
    hall = make_ir(3.0, .03, 2); room = make_ir(1.0, .01, 8, 1.4)
    mix = reverb(st.x, hall, .35) * 1.0 + br.x * .9 + reverb(pc.x, hall, .2) * 1.0 + reverb(pl.x, hall, .35) * 1.0
    mix += reverb(ld.x, hall, .4) * 1.0 + reverb(fx.x, hall, .2) * .45 + reverb(ch.x, hall, .45) * .9
    mix += reverb(sfx().x, room, .2) * .9
    t = np.arange(N) / SR
    mix *= np.clip((SC['duration'] + 2.5 - t) / 3.0, 0, 1)
    pk = np.abs(mix).max(); print('峰值', round(float(pk), 3))
    mix = np.tanh(mix / pk * 1.5) / np.tanh(1.5) * .95
    out = ROOT / 'output/history/music.wav'
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(out), '-t', f"{SC['duration'] + .5:.3f}", '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11', '-ar', '48000',
                    '-c:a', 'aac', '-b:a', '256k', str(ROOT / 'output/history/music.m4a')], check=True)
    out.unlink(); print('完成 output/history/music.m4a')


if __name__ == '__main__':
    main()
