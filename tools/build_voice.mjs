// 配音（只合成改动过的句子）+ 生成时间轴 tools/timeline.json
// 用法：node tools/build_voice.mjs [--force]
import { tts } from './minimax.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILM = createRequire(import.meta.url)(path.join(ROOT, 'src/script.js'));
const VDIR = path.join(ROOT, 'assets/voice');
fs.mkdirSync(VDIR, { recursive: true });
const manifestPath = path.join(VDIR, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const force = process.argv.includes('--force');

const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();

// 去掉首尾静音后的有效区间
function trimInfo(f) {
  const out = execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'silencedetect=n=-45dB:d=0.12', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
    + '';
  return out;
}

const jobs = FILM.beats.filter(b => b.say);
let i = 0;
async function work() {
  while (i < jobs.length) {
    const b = jobs[i++];
    const vs = FILM.voices[b.v];
    const hash = crypto.createHash('md5').update(JSON.stringify([b.say, vs])).digest('hex').slice(0, 10);
    const mp3 = path.join(VDIR, `${b.id}.mp3`);
    if (!force && manifest[b.id]?.hash === hash && fs.existsSync(mp3)) continue;
    await tts(b.say, mp3, { voice: vs.voice, speed: vs.speed, emotion: vs.emotion });
    manifest[b.id] = { hash };
    console.log('合成', b.id, b.say.slice(0, 24));
  }
}
await Promise.all([work(), work(), work()]);

// 统一转 wav 并测量（去掉首尾静音，便于精准卡点）
for (const b of jobs) {
  const mp3 = path.join(VDIR, `${b.id}.mp3`), wav = path.join(VDIR, `${b.id}.wav`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse',
    '-ar', '44100', '-ac', '1', wav]);
  manifest[b.id].dur = +dur(wav).toFixed(3);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

// ── 时间轴 ──
const strip = s => s.replace(/<#[\d.]+#>/g, '');
// 把一句话按标点切成字幕块，并按“字数 + 停顿”估算每块时间
function chunks(b, t0, d) {
  const raw = b.say;
  const parts = []; let buf = '', w = 0;
  const tokens = raw.split(/(<#[\d.]+#>)/).filter(Boolean);
  const units = []; // {ch, w}
  for (const tk of tokens) {
    const m = tk.match(/^<#([\d.]+)#>$/);
    if (m) { units.push({ pause: +m[1] }); continue; }
    for (const ch of tk) units.push({ ch, w: /[，。、；：！？—…“”《》（）]/.test(ch) ? 0.45 : 1 });
  }
  const tot = units.reduce((s, u) => s + (u.pause ? u.pause * 4.2 : u.w), 0);
  let acc = 0, start = 0;
  const marks = [];
  for (const u of units) {
    if (u.pause) { acc += u.pause * 4.2; continue; }
    if (!buf) start = acc;
    buf += u.ch; acc += u.w;
    marks.push({ ch: u.ch, t: t0 + (acc / tot) * d });
    if (/[，。；：！？]/.test(u.ch) && buf.length >= 8 || /[。！？]/.test(u.ch)) {
      parts.push({ s: buf, a: t0 + (start / tot) * d, b: t0 + (acc / tot) * d }); buf = '';
    }
  }
  if (buf) parts.push({ s: buf, a: t0 + (start / tot) * d, b: t0 + d });
  return { parts, marks };
}

let t = 0;
const out = { beats: [], subs: [], voice: [], music: [], sfx: [] };
for (const b of FILM.beats) {
  const vd = b.say ? manifest[b.id].dur : 0;
  const pre = b.say ? (b.pre ?? 0.5) : 0, post = b.say ? (b.post ?? 0.6) : 0;
  const d = b.dur ?? (pre + vd + post);
  const beat = { id: b.id, start: +t.toFixed(3), dur: +d.toFixed(3) };
  if (b.say) {
    const vs = t + pre;
    beat.voice = { start: +vs.toFixed(3), dur: vd };
    out.voice.push({ id: b.id, file: `assets/voice/${b.id}.wav`, start: +vs.toFixed(3), dur: vd, v: b.v });
    const { parts, marks } = chunks(b, vs, vd);
    beat.marks = marks.map(m => [m.ch, +m.t.toFixed(3)]);
    if (b.sub !== false) {
      if (b.t && strip(b.t) !== strip(b.say)) out.subs.push({ s: b.t.replace(/[。]$/, ''), a: +vs.toFixed(3), b: +(vs + vd + 0.3).toFixed(3) });
      else for (const p of parts) out.subs.push({ s: p.s.replace(/[，。；：]$/, ''), a: +p.a.toFixed(3), b: +(p.b + 0.25).toFixed(3) });
    }
  }
  if (b.music) out.music.push({ id: b.music, t: +t.toFixed(3) });
  if (b.sfx) out.sfx.push({ type: b.sfx, t: +(t + pre).toFixed(3), beat: b.id });
  out.beats.push(beat);
  t += d;
}
// 字幕块之间不重叠
for (let k = 0; k + 1 < out.subs.length; k++) out.subs[k].b = Math.min(out.subs[k].b, out.subs[k + 1].a - 0.05);
out.duration = +t.toFixed(3);
fs.writeFileSync(path.join(ROOT, 'tools/timeline.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(ROOT, 'src/timeline.js'), 'window.TL = ' + JSON.stringify(out) + ';\n');
console.log(`时间轴：${out.beats.length} 段，总长 ${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`);
