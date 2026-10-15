// 生成 SRT 字幕：node tools/make_srt.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/timeline.json'), 'utf8'));
const ts = t => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const out = TL.subs.map((s, i) => `${i + 1}\n${ts(s.a)} --> ${ts(s.b)}\n${s.s}\n`).join('\n');
fs.writeFileSync(path.join(ROOT, 'output/金陵·一卷未干的水墨.srt'), out);
console.log('字幕条数', TL.subs.length);
