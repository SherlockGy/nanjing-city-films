/* 《金陵 2500》渲染器：每帧是时间 T 的纯函数 */
(function () {
  const F = FILM, S = F.SCENES, W = F.W, H = F.H, BEAT = F.BEAT;
  const { clamp, lerp, eio, eout, rnd, rays, dust } = LIB;
  const cv = document.getElementById('c'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const bufA = mk(), bufB = mk();
  const INK = '#2A221B', RED = '#A8231B', GOLD = '#E9C978', CREAM = '#ECE5D4';

  // ───── 背景：羊皮纸 / 暗场 ─────
  function noiseField(w, h, scale, seed) {
    const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2, g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd(i, seed);
    return (x, y) => { const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c2 = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1]; return lerp(lerp(a, b, sx), lerp(c2, d, sx), sy); };
  }
  function makeBG(mode) {
    const dark = mode === 'D', gold = mode === 'G';
    const c = mk(), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data;
    const n1 = noiseField(W, H, 220, dark ? 3 : 1), n2 = noiseField(W, H, 60, dark ? 4 : 2), n3 = noiseField(W, H, 9, 5);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = (y * W + xx) * 4, dx = (xx - W / 2) / (W / 2), dy = (y - H * .45) / (H / 2), v = Math.min(1, dx * dx * .55 + dy * dy * .75);
      const blot = n1(xx, y) * .6 + n2(xx, y) * .3 + n3(xx, y) * .1, gr = (rnd(i, 7) - .5);
      if (gold) { // 明亮暖金：中心偏右一团日光
        const gx = (xx - W * .62) / W, gy = (y - H * .5) / H, sun = Math.exp(-(gx * gx + gy * gy) * 7);
        const l = 1 - v * .12 - (blot - .5) * .05 + gr * .02;
        D[i] = Math.min(255, (246 + sun * 9) * l); D[i + 1] = Math.min(255, (236 + sun * 8) * l); D[i + 2] = Math.min(255, (214 - sun * 20) * l);
      } else if (!dark) {
        const l = 1.03 - v * .2 - (blot - .5) * .11 + gr * .025;
        D[i] = Math.min(255, 232 * l); D[i + 1] = Math.min(255, 219 * l); D[i + 2] = Math.min(255, 188 * l);
      } else {
        const l = .9 - v * .55 + (blot - .5) * .25 + gr * .05;
        D[i] = 14 * l + 3; D[i + 1] = 16 * l + 3; D[i + 2] = 22 * l + 4;
      }
      D[i + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  const BG = { P: makeBG('P'), D: makeBG('D'), G: makeBG('G') };
  const grains = Array.from({ length: 4 }, (_, k) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = rnd(i, k + 11) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 13; } x.putImageData(im, 0, 0); return c; });

  // ───── 文字 ─────
  const yearStr = y => y < 0 ? `${-y} BC` : `AD ${y}`;
  function chars(c, s, x, y, font, color, t, stagger, opt = {}) {
    c.save(); c.font = font; c.textBaseline = 'alphabetic'; if (opt.ls) c.letterSpacing = opt.ls + 'px';
    let w = 0; const ws = [...s].map(ch => { const m = c.measureText(ch).width + (opt.ls || 0); w += m; return m; });
    let xx = opt.align === 'center' ? x - w / 2 : x;
    [...s].forEach((ch, i) => { const k = clamp((t - i * stagger) / (opt.dur || .3)); if (k > 0) {
      c.save(); c.globalAlpha = eout(k) * (opt.alpha ?? 1); const sc = lerp(opt.from || 1, 1, eout(k)); c.translate(xx + ws[i] / 2, y + (1 - eout(k)) * (opt.dy ?? 14)); c.scale(sc, sc);
      if (opt.glow) { c.shadowColor = opt.glow; c.shadowBlur = opt.blur || 30; }
      c.fillStyle = color; c.textAlign = 'center'; c.fillText(ch, 0, 0);
      if (opt.glow) { c.shadowBlur = (opt.blur || 30) * .4; c.fillText(ch, 0, 0); }
      c.restore(); }
      xx += ws[i]; });
    c.restore(); return w;
  }
  function drawText(c, s, lt) {
    const dark = s.bg === 'D', gold = s.bg === 'G', mourn = s.mourn;
    const leadCol = dark ? (mourn ? 'rgba(220,214,200,.85)' : CREAM) : INK;
    const keyCol = dark ? (mourn ? '#F1EBDD' : GOLD) : gold ? '#B5541A' : RED;
    const glow = dark ? (mourn ? 'rgba(255,255,255,.35)' : 'rgba(240,190,90,.75)') : gold ? 'rgba(255,190,90,.55)' : null;
    const capCol = dark ? 'rgba(233,224,204,.62)' : 'rgba(42,34,27,.62)';
    const keyFont = s.keyFont === 'cinzel' ? '700 112px Cinzel' : '900 112px NotoSerifSC';
    const out = 1 - clamp((lt - (s.dur - .18)) / .18) * 0;
    const pos = s.pos || 'L', tl = Math.max(0, lt - .08);
    if (pos === 'L') {
      const y0 = s.lead ? 220 : 280;
      if (s.lead) chars(c, s.lead, 140, y0, '900 60px NotoSerifSC', leadCol, tl, .035, { ls: 4, glow: dark ? 'rgba(255,240,210,.25)' : null, blur: 18 });
      chars(c, s.key, 136, y0 + 132, keyFont, keyCol, tl - (s.lead ? .28 : 0), .06, { ls: 6, from: 1.12, dy: 0, glow, blur: 34 });
      chars(c, s.cap, 146, y0 + 212, '600 19px Cinzel', capCol, tl - .6, .012, { ls: 7, dy: 0, dur: .2 });
    } else if (pos === 'C') {
      const y0 = s.id === 'fail' ? 320 : s.mourn ? 470 : 560;
      if (s.lead) chars(c, s.lead, 960, y0 - 130, '900 60px NotoSerifSC', leadCol, tl, .035, { ls: 4, align: 'center' });
      chars(c, s.key, 960, y0, s.id === 'come' ? '900 170px NotoSerifSC' : keyFont, keyCol, tl - (s.lead ? .28 : 0), .08, { ls: 8, from: 1.15, dy: 0, glow, blur: 40, align: 'center' });
      chars(c, s.cap, 960, y0 + 80, '600 20px Cinzel', capCol, tl - .7, .012, { ls: 8, dy: 0, align: 'center', dur: .2 });
    } else if (pos === 'TC') {
      chars(c, s.lead, 960, 190, '900 60px NotoSerifSC', leadCol, tl, .035, { ls: 4, align: 'center', glow: 'rgba(255,240,210,.25)', blur: 18 });
      chars(c, s.key, 960, 320, keyFont, keyCol, tl - .28, .07, { ls: 6, from: 1.12, dy: 0, glow, blur: 34, align: 'center' });
      chars(c, s.cap, 960, 385, '600 19px Cinzel', capCol, tl - .6, .012, { ls: 7, dy: 0, align: 'center', dur: .2 });
    } else if (pos === 'T') {
      chars(c, s.key, 960, 560, '900 250px NotoSerifSC', GOLD, tl - .2, .35, { ls: 30, from: 1.25, dy: 0, glow: 'rgba(255,190,80,.9)', blur: 60, align: 'center', dur: .7 });
      chars(c, s.cap, 960, 670, '600 24px Cinzel', 'rgba(233,224,204,.8)', tl - 1.2, .02, { ls: 12, dy: 0, align: 'center', dur: .25 });
    }
  }

  // ───── HUD ─────
  function hud(c, s, T, lt) {
    const dark = s.bg === 'D', col = dark ? 'rgba(233,224,204,.72)' : 'rgba(42,34,27,.72)', acc = dark ? GOLD : s.bg === 'G' ? '#C26A1E' : '#B3261E', dim = dark ? 'rgba(233,224,204,.35)' : 'rgba(42,34,27,.35)';
    c.save(); c.strokeStyle = dim; c.lineWidth = 1.5;
    for (const [x, y, sx, sy] of [[56, 56, 1, 1], [1864, 56, -1, 1], [56, 1024, 1, -1], [1864, 1024, -1, -1]]) { c.beginPath(); c.moveTo(x, y + sy * 28); c.lineTo(x, y); c.lineTo(x + sx * 28, y); c.stroke(); }
    const mono = (str, x, y, size, color, align = 'left', ls = 5, w = 500) => { c.font = `${w} ${size}px JetBrainsMono`; c.letterSpacing = ls + 'px'; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(str, x, y); };
    mono(F.CH[s.ch], 96, 86, 17, col, 'left', 5);
    mono('JINLING  MMD', 1824, 86, 17, col, 'right', 6);
    mono(`♩ = ${F.BPM}   ${String(Math.floor(T * 30)).padStart(5, '0')}`, 1824, 112, 12, dim, 'right', 4);
    // 年份（切镜时滚动）
    const prev = S[S.indexOf(s) - 1], py = prev ? prev.year : s.year, yr = Math.round(lerp(py, s.year, eout(lt / .45)));
    mono('ANNO', 96, 958, 11, dim, 'left', 6); mono(yearStr(yr), 96, 992, 30, col, 'left', 4, 600);
    // 时间轴
    const X = y => 634 + (y + 500) * 121 / 500;
    c.strokeStyle = dim; c.lineWidth = 1.2; c.beginPath(); c.moveTo(610, 1012); c.lineTo(1310, 1012); c.stroke();
    [[-500, '500 BC'], [0, '0'], [500, '500'], [1000, '1000'], [1500, '1500'], [2000, '2000']].forEach(([y, t]) => { const x = X(y); c.beginPath(); c.moveTo(x, 1006); c.lineTo(x, 1018); c.stroke(); mono(t, x, 994, 11, dim, 'center', 3); });
    mono('∞', 1310, 994, 12, dim, 'center', 0);
    const yx = X(Math.min(2100, yr)); c.strokeStyle = acc; c.lineWidth = 3; c.beginPath(); c.moveTo(610, 1012); c.lineTo(yx, 1012); c.stroke();
    c.fillStyle = acc; c.beginPath(); c.moveTo(yx - 7, 994 + 4); c.lineTo(yx + 7, 994 + 4); c.lineTo(yx, 1006); c.fill();
    // 十朝都会
    const pd = prev ? prev.dyn : s.dyn, dv = lerp(pd, s.dyn, eout(lt / .45));
    mono('十朝都会 · CAPITALS', 1824, 958, 11, dim, 'right', 4);
    mono(`${String(Math.round(dv)).padStart(2, '0')} / 10`, 1824, 992, 30, col, 'right', 4, 600);
    c.strokeStyle = dim; c.lineWidth = 1.2; c.beginPath(); c.moveTo(1564, 1012); c.lineTo(1824, 1012); c.stroke();
    for (let i = 0; i <= 10; i += 2.5) { const x = 1564 + i * 26; c.beginPath(); c.moveTo(x, 1006); c.lineTo(x, 1018); c.stroke(); }
    c.strokeStyle = acc; c.lineWidth = 3; c.beginPath(); c.moveTo(1564, 1012); c.lineTo(1564 + dv * 26, 1012); c.stroke();
    c.restore();
  }

  // ───── 单个镜头 ─────
  function drawScene(c, s, T) {
    const lt = T - s.t0, dark = s.bg === 'D';
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.drawImage(BG[s.bg], 0, 0);
    const z = 1 + .035 * (lt / s.dur);
    c.save(); c.translate(W * .6, H * .55); c.scale(z, z); c.translate(-W * .6, -H * .55);
    if (s.rays) rays(c, s.pos === 'C' ? 960 : 1280, s.pos === 'C' ? 560 : 640, 90, 60, 1200, dark ? GOLD : s.bg === 'G' ? '#D99A3A' : INK, dark ? .2 : s.bg === 'G' ? .28 : .13, lt * .03);
    const A = { dark, mode: s.bg };
    try { VIS[s.vis](c, lt, s.dur, A); } catch (e) { console.error(s.vis, e); }
    c.restore();
    if (s.dim) { c.fillStyle = `rgba(30,20,10,${.32 * clamp(lt / (s.dur * .6))})`; c.fillRect(0, 0, W, H); }
    drawText(c, s, lt);
    hud(c, s, T, lt);
  }
  const XF = .32;
  function render(T) {
    let i = S.findIndex(s => T < s.t0 + s.dur); if (i < 0) i = S.length - 1;
    const s = S[i], lt = T - s.t0;
    const xf = i > 0 && lt < XF ? XF : 0;
    if (xf) {
      const bx = bufA.getContext('2d'), by = bufB.getContext('2d');
      drawScene(bx, S[i - 1], T); drawScene(by, s, T);
      const k = eio(lt / XF);
      ctx.globalAlpha = 1; ctx.drawImage(bufA, 0, 0); ctx.globalAlpha = k; ctx.drawImage(bufB, 0, 0); ctx.globalAlpha = 1;
    } else drawScene(ctx, s, T);
    // 片尾淡出
    const end = clamp((T - (F.DURATION - 1.4)) / 1.2);
    if (end > 0) { ctx.globalAlpha = end; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // 开场从黑起
    if (T < .5) { ctx.globalAlpha = 1 - T / .5; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  window.ready = (async () => {
    await Promise.all(['900 60px NotoSerifSC', '600 20px Cinzel', '700 20px Cinzel', '500 17px JetBrainsMono', '600 17px JetBrainsMono', '40px MaShanZheng', '30px WenKai']
      .map(f => document.fonts.load(f, '金陵南京公元前年楚威王埋下了ANNO 0123456789十朝都会')));
    while (window.REF_READY && !window.REF_READY()) await new Promise(r => setTimeout(r, 50));
    return true;
  })();
  window.DURATION = F.DURATION;
  window.grab = async (T, q = .93) => { await window.ready; render(T); return cv.toDataURL('image/jpeg', q); };
  window.renderAt = async T => { await window.ready; render(T); };
  const Q = new URLSearchParams(location.search);
  if (!Q.has('render')) (async () => { await window.ready; const a = document.getElementById('a'), t0 = +(Q.get('t') || 0); render(t0);
    if (Q.has('play')) { a.currentTime = t0; a.play().catch(() => {}); const loop = () => { render(a.currentTime); requestAnimationFrame(loop); }; loop(); } })();
})();
