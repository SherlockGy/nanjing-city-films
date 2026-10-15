import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const F = createRequire(import.meta.url)(path.join(ROOT, 'history/src/film.js'));
fs.mkdirSync(path.join(ROOT, 'output/history'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'output/history/scenes.json'), JSON.stringify({ bpm: F.BPM, duration: F.DURATION, scenes: F.SCENES.map(s => ({ id: s.id, t0: s.t0, dur: s.dur, b: s.b, bg: s.bg, key: s.key, mourn: !!s.mourn })) }, null, 1));
console.log(F.SCENES.length, 'scenes', F.DURATION.toFixed(2), 's');
