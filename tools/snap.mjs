// 抽帧检查：node tools/snap.mjs 12.5 30 61.2 ...  或  node tools/snap.mjs --every 4 [--from 0 --to 60]
// 输出 output/snaps/*.jpg 与联系表 output/snaps/sheet.jpg
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output/snaps'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? +a[i + 1] : d; };
const srv = await serve(8778);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await page.goto('http://127.0.0.1:8778/index.html?render=1');
await page.evaluate(() => window.ready);
const dur = await page.evaluate(() => window.DURATION);
let times = a.filter((x, i) => !x.startsWith('--') && !(a[i - 1] || '').startsWith('--')).map(Number);
if (a.includes('--every')) { const e = arg('every', 4); for (let t = arg('from', 0); t < Math.min(dur, arg('to', dur)); t += e) times.push(+t.toFixed(2)); }
const t0 = Date.now();
for (const t of times) {
  const url = await page.evaluate(t => window.grab(t, .9), t);
  fs.writeFileSync(path.join(OUT, `t_${String(t.toFixed(2)).padStart(7, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
}
console.log(`${times.length} 帧，平均 ${((Date.now() - t0) / times.length).toFixed(0)} ms/帧，总长 ${dur.toFixed(1)}s`);
if (errs.length) console.log('页面报错：\n' + [...new Set(errs)].slice(0, 20).join('\n'));
await browser.close(); srv.close();
const files = fs.readdirSync(OUT).filter(f => f.startsWith('t_')).sort();
if (files.length > 1) {
  const cols = files.length > 9 ? 4 : 3;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-pattern_type', 'glob', '-i', path.join(OUT, 't_*.jpg'), '-vf', `scale=640:-1,drawtext=text='%{metadata\\:lavf.image2dec.source_basename}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.5,tile=${cols}x${Math.ceil(files.length / cols)}`, '-frames:v', '1', path.join(OUT, 'sheet.jpg')]);
}
