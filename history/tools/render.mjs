// 渲染竖屏成片：node short/tools/render.mjs [--workers 5] [--crf 18]
import { launch } from '../../tools/browser.mjs';
import { serve } from '../../tools/serve.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30, WORKERS = +arg('workers', 5), CRF = arg('crf', '18');
const OUT = path.join(ROOT, 'output/history/金陵2500.mp4'), TMP = path.join(ROOT, 'output/history/.segments');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const srv = await serve(8792);
const browser = await launch();
const probe = await browser.newPage(); await probe.goto('http://127.0.0.1:8792/history/index.html?render=1');
const DUR = await probe.evaluate(() => window.DURATION); await probe.close();
const total = Math.round(DUR * FPS), per = Math.ceil(total / WORKERS), t0 = Date.now(); let done = 0;
async function worker(k) {
  const a = k * per, b = Math.min(total, a + per); if (a >= b) return null;
  const seg = path.join(TMP, `seg_${k}.mp4`);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error(`[w${k}]`, e.message));
  await page.goto('http://127.0.0.1:8792/history/index.html?render=1'); await page.evaluate(() => window.ready);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    const url = await page.evaluate(T => window.grab(T, .95), f / FPS);
    if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 600 === 0) console.log(`${done}/${total} 帧 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close(); return seg;
}
const segs = (await Promise.all([...Array(WORKERS).keys()].map(worker))).filter(Boolean);
await browser.close(); srv.close();
fs.writeFileSync(path.join(TMP, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-i', path.join(ROOT, 'output/history/music.m4a'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-metadata', 'title=金陵 2500', '-shortest', OUT], { stdio: 'inherit' });
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`完成：${OUT}  用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
