// 导出音频事件 → output/short/events.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const F = createRequire(import.meta.url)(path.join(ROOT, 'short/src/film.js'));
fs.mkdirSync(path.join(ROOT, 'output/short'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'output/short/events.json'), JSON.stringify({ bpm: F.BPM, bars: 64, duration: F.DURATION, events: F.events(), stations: F.STATIONS.map(s => ({ key: s.key, t0: s.t0, bar: s.bar })) }, null, 1));
console.log('events', F.events().length);
