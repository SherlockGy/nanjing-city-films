// 导出镜头/文字/配音的绝对时间，供音频脚本使用 → tools/layout.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const FILM = require(path.join(ROOT, 'src/script.js'));
const layout = require(path.join(ROOT, 'src/layout.js'));
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/timeline.json'), 'utf8'));
const L = layout(FILM, TL);
const shots = L.shots.map(s => ({ idx: s.idx, img: s.img || s.k, beat: s.beat, tr: s.tr || 'ink', start: s.start, end: s.end, td: s.td, vis0: s.vis0, vis1: s.vis1, fx: s.fx || [], season: s.season || null, label: s.label || null }));
const texts = L.texts.map(t => ({ k: t.k, beat: t.beat, bs: t.bs, bd: t.bd, voice: t.voice || null, at: t.at ?? null }));
fs.writeFileSync(path.join(ROOT, 'tools/layout.json'), JSON.stringify({ duration: L.duration, shots, texts, dark: L.dark, voice: TL.voice, music: TL.music, sfx: TL.sfx, beats: TL.beats.map(b => ({ id: b.id, start: b.start, dur: b.dur, voice: b.voice || null })) }, null, 1));
console.log('layout.json：', shots.length, '个镜头，', L.duration.toFixed(1), 's');
