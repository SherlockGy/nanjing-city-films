/* 渲染器：Canvas 2D，每帧是时间 T 的纯函数 */
(function () {
  const F = FILM, { ART, xiangyun, q, wave, cat } = ARTLIB;
  const W = F.W, H = F.H, BEAT = F.BEAT, BAR = F.BAR, tb = F.tb;
  const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d');
  const INK = '#1D1D1F', PAPER = '#F4ECDD', RED = '#C8372D';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const eout = t => 1 - Math.pow(1 - clamp(t), 3);
  const eback = t => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const hexMix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };

  // ───────── 路径：把所有站点与连接线拼成一条笔迹 ─────────
  const GY = 965; // 地面线（连接线所在高度）
  // up[i] = true 表示第 i-1→i 段是“提笔”移动（不出墨，走得快）
  function measure(pts, up) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * (up && up[i] ? .18 : 1)); return L; }
  function seg(pts, t0, t1, kind, st, up) { const L = measure(pts, up); return { pts, up, L, len: L[L.length - 1], t0, t1, kind, st }; }
  // 贪心排序笔画：每次接最近的一笔（必要时反向），减少跳跃
  function orderStrokes(strokes, start) {
    const left = strokes.slice(), out = []; let cur = start;
    while (left.length) {
      let best = 0, bd = 1e18, rev = false;
      left.forEach((p, i) => { const a = Math.hypot(p[0][0] - cur[0], p[0][1] - cur[1]), b = Math.hypot(p[p.length - 1][0] - cur[0], p[p.length - 1][1] - cur[1]); if (a < bd) { bd = a; best = i; rev = false; } if (b < bd) { bd = b; best = i; rev = true; } });
      let p = left.splice(best, 1)[0]; if (rev) p = p.slice().reverse();
      out.push(p); cur = p[p.length - 1];
    }
    return out;
  }
  const S = F.STATIONS;
  const badge = s => [s.x0 + 540, s.y0 + 1010];
  S.forEach(s => {
    const a = ART[s.key](); s.art = a;
    const strokes = a.strokes.map(p => p.map(([x, y]) => [x + s.x0, y + s.y0]));
    const B = badge(s);
    const pts = [B], up = [false];
    for (const p of orderStrokes(strokes, B)) {
      const last = pts[pts.length - 1], d = Math.hypot(p[0][0] - last[0], p[0][1] - last[1]);
      p.forEach((pt, j) => { pts.push(pt); up.push(j === 0 ? d > 36 : false); });
    }
    pts.push(B); up.push(true);
    s.seg = seg(pts, s.t0, s.t0 + BEAT * 4, 'station', s, up);
  });
  const segs = [];
  // 开场笔花：祥云 → 沿左边缘下到第一站的编号
  const s0 = S[0];
  const intro = cat(xiangyun(700, 130, .62), [[560, 96], [30, 96], [30, 1010], badge(s0)]);
  segs.push(seg(intro, tb(2, 1), tb(4), 'intro'));
  const route = [];
  S.forEach((s, i) => {
    segs.push(s.seg);
    const n = S[i + 1]; if (!n) return;
    const A = badge(s), Bn = badge(n);
    let pts;
    if (n.r === s.r) pts = wave(A[0], Bn[0], A[1], 9, 360);
    else { const x = s.x0 + (s.dir > 0 ? 1058 : 22); pts = cat([A], q([x - (s.dir > 0 ? 40 : -40), A[1]], [x, A[1]], [x, A[1] + 60], 6), [[x, Bn[1] - 60]], q([x, Bn[1] - 60], [x, Bn[1]], [x - (s.dir > 0 ? 40 : -40), Bn[1]], 6), [Bn]); }
    const t0 = i === 5 ? tb(27, 2) : s.t0 + BEAT * 14;
    const sg = seg(pts, t0, n.t0, 'conn', s); segs.push(sg); route.push(...(route.length ? pts.slice(1) : pts));
  });
  const ROUTE = seg(route, 0, 1, 'route');
  const last = S[11];
  const border = [badge(last), [20, badge(last)[1]], [20, 5740], [3220, 5740], [3220, 20], [20, 20], [20, 5740]];
  segs.push(seg(border, tb(54), tb(56), 'border'));
  window.SEGS = segs;

  function penAt(sg, T) {
    const u = sg.kind === 'station' ? eio((T - sg.t0) / (sg.t1 - sg.t0)) : clamp((T - sg.t0) / (sg.t1 - sg.t0)) ** 1.1;
    return u * sg.len;
  }
  function pointAt(sg, d) {
    const L = sg.L; let lo = 0, hi = L.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; }
    const t = (d - L[lo]) / Math.max(1e-6, L[hi] - L[lo]);
    return { i: lo, x: lerp(sg.pts[lo][0], sg.pts[hi][0], t), y: lerp(sg.pts[lo][1], sg.pts[hi][1], t) };
  }
  function strokeSeg(c, sg, d, color, width) {
    if (d <= 0) return null;
    const p = pointAt(sg, Math.min(d, sg.len));
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
    const up = sg.up;
    c.beginPath(); c.moveTo(sg.pts[0][0], sg.pts[0][1]);
    for (let i = 1; i <= p.i; i++) up && up[i] ? c.moveTo(sg.pts[i][0], sg.pts[i][1]) : c.lineTo(sg.pts[i][0], sg.pts[i][1]);
    up && up[p.i + 1] ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); c.stroke();
    return p;
  }

  // ───────── 镜头 ─────────
  const POSTER = { x: 1620, y: 2880, z: 1 / 3 };
  const view = s => ({ x: s.x0 + 540, y: s.y0 + 740, z: 1 });
  function camAt(T) {
    // 开场
    if (T < S[0].t0 + BEAT * 14) { const v = view(S[0]); return { x: v.x, y: v.y, z: 1 + .035 * clamp((T - tb(2)) / (BAR * 6)) }; }
    for (let i = 0; i < 12; i++) {
      const s = S[i], n = S[i + 1], v = view(s);
      const holdEnd = i === 5 ? tb(27, 2) : i === 11 ? tb(53, 2) : s.t0 + BEAT * 14;
      if (T < holdEnd) return { x: v.x, y: v.y, z: 1 + .035 * clamp((T - s.t0) / (BAR * 3.5)) };
      if (i === 5) { // 中场拉远
        const a = view(s), b = view(n);
        if (T < tb(28, 2)) { const u = eio((T - tb(27, 2)) / BAR); return { x: lerp(a.x, POSTER.x, u), y: lerp(a.y, POSTER.y, u), z: 1 / lerp(1 / 1.035, 1 / POSTER.z, u) }; }
        if (T < tb(29, 2)) return { ...POSTER, z: POSTER.z * (1 + .02 * (T - tb(28, 2)) / BAR) };
        if (T < n.t0) { const u = eio((T - tb(29, 2)) / (n.t0 - tb(29, 2))); return { x: lerp(POSTER.x, b.x, u), y: lerp(POSTER.y, b.y, u), z: 1 / lerp(1 / (POSTER.z * 1.02), 1, u) }; }
        continue;
      }
      if (i === 11) { // 片尾拉远成海报
        const a = view(s), u = eio((T - tb(53, 2)) / (tb(55, 2) - tb(53, 2)));
        const z = 1 / lerp(1 / 1.035, 1 / POSTER.z, u);
        const zz = T > tb(56) ? z * (1 + .015 * Math.sin(clamp((T - tb(56)) / (BAR * 8)) * Math.PI / 2)) : z;
        return { x: lerp(a.x, POSTER.x, u), y: lerp(a.y, POSTER.y, u), z: zz };
      }
      if (T < n.t0) { // 甩镜到下一站
        const a = view(s), b = view(n), u = eio((T - holdEnd) / (n.t0 - holdEnd));
        return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(1.035, 1, u) * (1 - .1 * Math.sin(Math.PI * u)) };
      }
    }
    return POSTER;
  }
  const whipping = T => { for (let i = 0; i < 11; i++) { const s = S[i], n = S[i + 1]; const a = i === 5 ? tb(29, 2) : s.t0 + BEAT * 14; if (T > a && T < n.t0) return true; } return false; };
  function shake(T) {
    let m = 0;
    for (const s of S) { const d = T - (s.t0 + BEAT * 6); if (d >= 0 && d < .2) m = Math.max(m, (1 - d / .2) * 9); }
    for (const t of [tb(28, 2), tb(56), tb(62)]) { const d = T - t; if (d >= 0 && d < .3) m = Math.max(m, (1 - d / .3) * 14); }
    return [Math.sin(T * 91) * m, Math.cos(T * 77) * m];
  }

  // ───────── 宣纸 ─────────
  const paper = document.createElement('canvas'); paper.width = paper.height = 512;
  (() => { const p = paper.getContext('2d'); p.fillStyle = PAPER; p.fillRect(0, 0, 512, 512); const d = p.getImageData(0, 0, 512, 512);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < d.data.length; i += 4) { const n = (r() - .5) * 14; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n * .8; }
    p.putImageData(d, 0, 0); p.globalAlpha = .06; p.strokeStyle = '#8a7b60';
    for (let i = 0; i < 160; i++) { const x = r() * 512, y = r() * 512, a = r() * Math.PI; p.beginPath(); p.moveTo(x, y); p.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); p.stroke(); } })();
  const paperPat = ctx.createPattern(paper, 'repeat'), paperPat2 = octx.createPattern(paper, 'repeat');

  // ───────── 世界里的每一站 ─────────
  function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
  function drawFill(c, f, k, s) {
    const a = eout(k); if (a <= 0) return;
    c.save();
    c.translate(7, 7);
    let cx, cy;
    if (f.circle) [cx, cy] = f.circle; else [cx, cy] = centroid(f.pts);
    const sc = .82 + .18 * eback(k); c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
    c.globalAlpha = a;
    c.beginPath();
    if (f.circle) c.arc(f.circle[0], f.circle[1], f.circle[2], 0, Math.PI * 2);
    else { c.moveTo(f.pts[0][0], f.pts[0][1]); for (const p of f.pts) c.lineTo(p[0], p[1]); c.closePath(); }
    if (f.grad) { const g = c.createLinearGradient(0, f.circle[1] - f.circle[2], 0, f.circle[1] + f.circle[2]); g.addColorStop(0, f.grad[0]); g.addColorStop(1, f.grad[1]); c.fillStyle = g; }
    else c.fillStyle = f.color;
    c.fill();
    if (f.pattern === 'brick') {
      c.clip(); c.strokeStyle = 'rgba(70,64,56,.35)'; c.lineWidth = 2;
      for (let y = 520; y < 880; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke(); for (let x = (y / 30) % 2 ? 0 : 35; x < 1080; x += 70) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); } }
    }
    c.restore();
  }
  function stationLocal(c, s, T) {
    const lt = T - s.t0, tf = s.t0 + BEAT * 4, kf = clamp((T - tf) / .3);
    // 背景圆
    if (T > tf - .05) {
      const r = 430 * eback(clamp((T - tf + .05) / .35));
      c.fillStyle = s.bg; c.beginPath(); c.arc(540, 520, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = s.accent; c.globalAlpha = .5; c.lineWidth = 3; c.setLineDash([2, 14]); c.beginPath(); c.arc(540, 520, r + 26, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    const fills = s.art.fills;
    const order = fills.filter(f => f.under).concat(fills.filter(f => !f.under));
    order.forEach((f, j) => drawFill(c, f, clamp((T - tf - j * .022) / .26), s));
    return { lt, kf };
  }
  function stationText(c, s, T) {
    const t6 = s.t0 + BEAT * 6, t8 = s.t0 + BEAT * 8, t10 = s.t0 + BEAT * 10, tf = s.t0 + BEAT * 4;
    // 编号
    if (T > tf) {
      const k = eback(clamp((T - tf) / .3));
      c.save(); c.translate(540, 1010); c.scale(k, k);
      c.fillStyle = s.accent; c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FFF'; c.font = '900 44px NotoSerifSC'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(s.i + 1).padStart(2, '0'), 0, 3);
      c.restore();
    }
    // 标题砸下
    if (T > t6) {
      const k = clamp((T - t6) / .28), sc = lerp(1.7, 1, eback(k));
      c.save(); c.translate(540, 1125); c.scale(sc, sc); c.globalAlpha = clamp(k * 3);
      c.font = '900 118px NotoSerifSC'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = s.accent; c.fillText(s.name, 5, 6);
      c.fillStyle = INK; c.fillText(s.name, 0, 0);
      c.restore();
      const b = (T - t6) / .35;
      if (b < 1) { c.save(); c.strokeStyle = s.accent; c.lineWidth = 6; c.lineCap = 'round'; c.globalAlpha = 1 - b;
        for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2, r0 = 330 + b * 80, r1 = r0 + 50; c.beginPath(); c.moveTo(540 + Math.cos(a) * r0, 1125 + Math.sin(a) * r0 * .3); c.lineTo(540 + Math.cos(a) * r1, 1125 + Math.sin(a) * r1 * .3); c.stroke(); }
        c.restore(); }
    }
    // 副标题：从左到右扫出
    if (T > t8) {
      const k = eout((T - t8) / .45);
      c.save(); c.font = '700 40px NotoSansSC'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(s.line).width;
      c.beginPath(); c.rect(540 - w / 2 - 10, 1180, (w + 20) * k, 70); c.clip();
      c.fillStyle = '#3A3936'; c.fillText(s.line, 540, 1215);
      c.restore();
      c.fillStyle = s.accent; c.fillRect(540 - w / 2 + (w * k) - 2, 1192, 4, 46 * (k < 1 ? 1 : 0));
    }
    // 标签贴纸
    if (T > t10) {
      const k = clamp((T - t10) / .22);
      c.save(); c.translate(540, 1300); c.rotate(-.045); const sc = lerp(1.45, 1, eout(k)); c.scale(sc, sc); c.globalAlpha = clamp(k * 2.5);
      c.font = '900 36px NotoSansSC'; const tw = c.measureText(s.tag).width;
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.roundRect(-tw / 2 - 52 + 6, -36 + 6, tw + 104, 72, 36); c.fill();
      c.fillStyle = s.accent; c.beginPath(); c.roundRect(-tw / 2 - 52, -36, tw + 104, 72, 36); c.fill();
      c.fillStyle = '#FFF'; c.beginPath(); c.arc(-tw / 2 - 22, -6, 12, Math.PI, 0); c.lineTo(-tw / 2 - 22, 16); c.closePath(); c.fill();
      c.fillStyle = s.accent; c.beginPath(); c.arc(-tw / 2 - 22, -6, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.tag, 14, 2);
      c.restore();
    }
  }

  function drawWorld(c, T, cam) {
    const [sx, sy] = shake(T);
    c.save();
    c.translate(W / 2 + sx, H / 2 + sy); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
    // 纸
    c.fillStyle = c === ctx ? paperPat : paperPat2;
    const vw = W / cam.z, vh = H / cam.z;
    c.fillRect(cam.x - vw / 2 - 50, cam.y - vh / 2 - 50, vw + 100, vh + 100);
    const vis = s => !(s.x0 > cam.x + vw / 2 + 50 || s.x0 + 1080 < cam.x - vw / 2 - 50 || s.y0 > cam.y + vh / 2 + 50 || s.y0 + 1440 < cam.y - vh / 2 - 50);
    let pen = null;
    // 路线：红色虚线把各站编号连起来
    for (const sg of segs) if (sg.kind === 'conn' && T > sg.t0) {
      c.save(); c.setLineDash([22, 16]); const p = strokeSeg(c, sg, penAt(sg, T), RED, 7); c.restore();
      if (p && T < sg.t1) pen = p;
    }
    for (const s of S) {
      if (!vis(s) || T < s.t0 - .1) continue;
      c.save(); c.translate(s.x0, s.y0);
      const { lt, kf } = stationLocal(c, s, T);
      if (s.art.extra && T > s.t0 + BEAT * 4) { c.save(); s.art.extra(c, lt, kf, F); c.restore(); }
      c.restore();
      const col = s.art.lineAfter ? hexMix('#1D1D1F', s.art.lineAfter, kf) : INK;
      const p = strokeSeg(c, s.seg, penAt(s.seg, T), col, 5);
      if (p && T < s.seg.t1) pen = p;
      c.save(); c.translate(s.x0, s.y0); stationText(c, s, T); c.restore();
    }
    for (const sg of segs) if (sg.kind !== 'station' && sg.kind !== 'conn' && T > sg.t0) {
      const p = strokeSeg(c, sg, penAt(sg, T), INK, sg.kind === 'border' ? 9 : 5);
      if (p && T < sg.t1) pen = p;
    }
    // 片尾：路线巡游
    if (T > tb(56) && T < tb(58, 2)) {
      const u = clamp((T - tb(56)) / (BAR * 1.5)), f = u * 11;
      const { x, y } = pointAt(ROUTE, eio(u) * ROUTE.len);
      c.fillStyle = RED; c.beginPath(); c.arc(x, y, 70, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(200,55,45,.45)'; c.lineWidth = 26; c.beginPath(); c.arc(x, y, 120 + 30 * Math.sin(T * 20), 0, Math.PI * 2); c.stroke();
      S.forEach((s, j) => { const d = f - j; if (d > 0 && d < .6) { c.strokeStyle = s.accent; c.lineWidth = 10; c.globalAlpha = 1 - d / .6; c.beginPath(); c.arc(s.x0 + 540, s.y0 + 1010, 60 + d * 200, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; } });
    }
    // 笔尖
    if (pen) {
      c.fillStyle = RED; c.beginPath(); c.arc(pen.x, pen.y, 11 / Math.max(.4, cam.z), 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(200,55,45,.35)'; c.lineWidth = 6 / cam.z; c.beginPath(); c.arc(pen.x, pen.y, (22 + 6 * Math.sin(T * 30)) / Math.max(.4, cam.z), 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  // ───────── 屏幕层：开场钩子、进度条、中场、片尾 ─────────
  function text(c, s, x, y, font, color, opt = {}) {
    c.save(); c.translate(x, y); if (opt.rot) c.rotate(opt.rot); if (opt.sc) c.scale(opt.sc, opt.sc);
    c.globalAlpha = opt.a ?? 1; c.font = font; c.textAlign = opt.align || 'center'; c.textBaseline = 'middle';
    if (opt.shadow) { c.fillStyle = opt.shadow; c.fillText(s, 6, 7); }
    c.fillStyle = color; c.fillText(s, 0, 0); c.restore();
  }
  const slam = (T, t0, dur = .25, from = 1.6) => { const k = clamp((T - t0) / dur); return { a: clamp(k * 3), sc: lerp(from, 1, eback(k)), on: T >= t0 }; };
  function overlay(c, T) {
    // 开场
    if (T < tb(2, 2)) {
      const out = clamp((T - tb(2)) / (BEAT * 1.5)), dy = -eio(out) * 400, fa = 1 - out;
      c.save(); c.translate(0, dy); c.globalAlpha = fa;
      let k = slam(T, -.12, .3, 1.25); text(c, '南京', 540, 640, '900 270px NotoSerifSC', RED, { sc: k.sc, a: k.a, shadow: 'rgba(29,29,31,.9)' });
      k = slam(T, BEAT); if (k.on) text(c, '到底有多好逛？', 540, 860, '900 100px NotoSansSC', INK, { sc: k.sc, a: k.a });
      k = slam(T, BEAT * 2, .2); if (k.on) text(c, '2500年古都 · 12个地标', 540, 980, '700 44px NotoSansSC', '#5A564E', { a: k.a });
      k = slam(T, BEAT * 4); if (k.on) text(c, '我只用', 340, 1230, '800 72px NotoSansSC', INK, { sc: k.sc, a: k.a });
      k = slam(T, BEAT * 5, .25, 2.2); if (k.on) {
        text(c, '1', 600, 1240, '900 300px NotoSerifSC', RED, { sc: k.sc, a: k.a });
        const u = clamp((T - BEAT * 5.3) / .4); c.strokeStyle = INK; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.ellipse(600, 1240, 150, 170, -.2, -Math.PI * .6, -Math.PI * .6 + Math.PI * 2.1 * eout(u)); c.stroke();
      }
      k = slam(T, BEAT * 6); if (k.on) text(c, '笔', 820, 1260, '900 150px NotoSerifSC', INK, { sc: k.sc, a: k.a });
      k = slam(T, BEAT * 7); if (k.on) text(c, '画完整座城', 540, 1480, '900 92px NotoSansSC', INK, { sc: k.sc, a: k.a });
      k = slam(T, BEAT * 2.5, .2, 1.8); if (k.on) {
        c.save(); c.translate(860, 470); c.rotate(.12); c.scale(k.sc, k.sc); c.globalAlpha = k.a;
        c.fillStyle = RED; c.beginPath(); c.roundRect(-130, -46, 260, 92, 18); c.fill();
        c.fillStyle = '#FFF'; c.font = '900 50px ZCOOLQingKeHuangYou'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('一笔画挑战', 0, 4); c.restore();
      }
      c.restore();
    }
    // 进度条
    if (T > S[0].t0 - BEAT && T < tb(55)) {
      const a = clamp((T - S[0].t0 + BEAT) / .4) * (1 - clamp((T - tb(54)) / BAR)) * (T > tb(27, 3) && T < tb(29, 3) ? 0 : 1);
      let done = 0, cur = 0; S.forEach((s, i) => { if (T > s.t0 + BEAT * 6) done = i + 1; if (T > s.t0 - BEAT) cur = i; });
      c.save(); c.globalAlpha = a;
      c.fillStyle = 'rgba(244,236,221,.86)'; c.beginPath(); c.roundRect(50, 196, 980, 84, 42); c.fill();
      text(c, `第 ${String(cur + 1).padStart(2, '0')} 站`, 110, 238, '900 38px NotoSansSC', RED, { align: 'left' });
      for (let i = 0; i < 12; i++) { const x = 300 + i * 58; c.fillStyle = i < done ? S[i].accent : 'rgba(29,29,31,.14)'; c.beginPath(); c.roundRect(x, 228, 48, 20, 10); c.fill(); }
      c.restore();
    }
    // 中场
    if (T > tb(28, 2) - .05 && T < tb(29, 3)) {
      const k = slam(T, tb(28, 2), .3, 1.8), out = clamp((T - tb(29, 2)) / (BEAT * .8));
      c.save(); c.globalAlpha = (1 - out); c.translate(540, 960); c.scale(k.sc, k.sc); c.globalAlpha *= k.a;
      c.fillStyle = 'rgba(29,29,31,.88)'; c.beginPath(); c.roundRect(-400, -230, 800, 460, 40); c.fill();
      text(c, '画了一半！', 0, -110, '900 110px NotoSerifSC', '#F4ECDD');
      text(c, '6 / 12', 0, 40, '900 120px NotoSerifSC', '#F2C14E');
      text(c, '还剩 6 站，继续 ↓', 0, 160, '700 46px NotoSansSC', '#F4ECDD');
      c.restore();
    }
    // 片尾 CTA
    if (T > tb(58, 1) - .05 && T < tb(61, 2)) {
      const k = slam(T, tb(58, 1), .3, 1.5), out = eio((T - tb(61)) / (BEAT * 2));
      c.save(); c.translate(540, 960 + out * 1400); c.scale(k.sc, k.sc); c.globalAlpha = k.a;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.roundRect(-430 + 14, -330 + 18, 860, 660, 44); c.fill();
      c.fillStyle = '#F7F0E3'; c.beginPath(); c.roundRect(-430, -330, 860, 660, 44); c.fill();
      c.strokeStyle = RED; c.lineWidth = 6; c.beginPath(); c.roundRect(-406, -306, 812, 612, 32); c.stroke();
      text(c, '南京 citywalk', 0, -210, '900 92px NotoSerifSC', INK);
      text(c, '12 站 · 一张图', 0, -100, '900 64px NotoSansSC', RED);
      c.fillStyle = 'rgba(29,29,31,.2)'; c.fillRect(-330, -40, 660, 3);
      text(c, '收藏这张图，下次照着逛', 0, 40, '700 48px NotoSansSC', INK);
      text(c, '你最想去第几站？', 0, 130, '900 56px NotoSansSC', INK);
      text(c, '评论区告诉我 ↓', 0, 215, '700 44px NotoSansSC', '#5A564E');
      c.restore();
    }
    // 结尾大印
    if (T > tb(62) - .02) {
      c.fillStyle = `rgba(244,236,221,${.35 * clamp((T - tb(62)) / .4)})`; c.fillRect(0, 0, W, H);
      const k = clamp((T - tb(62)) / .2), sc = lerp(2.2, 1, eout(k));
      c.save(); c.translate(540, 960); c.rotate(-.06); c.scale(sc, sc); c.globalAlpha = clamp(k * 3) * .96;
      c.fillStyle = RED; c.beginPath(); c.roundRect(-150, -150, 300, 300, 18); c.fill();
      c.strokeStyle = '#F7F0E3'; c.lineWidth = 8; c.beginPath(); c.roundRect(-128, -128, 256, 256, 10); c.stroke();
      c.fillStyle = '#F7F0E3'; c.font = '200px MaShanZheng'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '112px MaShanZheng'; c.fillText('南', 0, -52); c.fillText('京', 0, 66);
      c.restore();
      const ba = clamp((T - tb(62, 2)) / .3);
      c.save(); c.globalAlpha = ba; c.fillStyle = 'rgba(29,29,31,.9)'; c.beginPath(); c.roundRect(150, 1200, 780, 120, 60); c.fill(); c.restore();
      text(c, '一笔画完南京 · 收藏备用', 540, 1262, '900 50px NotoSansSC', '#F4ECDD', { a: ba });
    }
    // 暗角
    const g = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,40,20,.18)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  // 底鼓脉冲：有鼓的小节里，镜头随每拍轻轻一“跳”
  function pulse(T) {
    const bar = T / BAR, on = (bar >= 4 && bar < 28) || (bar >= 30 && bar < 54) || (bar >= 56 && bar < 62);
    if (!on) return 0; const ph = (T / BEAT) % 1; return Math.exp(-ph * 9);
  }
  function frame(c, T) { const cam = camAt(T); cam.z *= 1 + .006 * pulse(T); drawWorld(c, T, cam); overlay(c, T); }
  function render(T) {
    if (whipping(T)) { // 运动模糊：多个子帧求平均
      const n = 5;
      for (let j = 0; j < n; j++) { octx.setTransform(1, 0, 0, 1, 0, 0); frame(octx, T - (n - 1 - j) * (1 / 30) / n); ctx.globalAlpha = 1 / (j + 1); ctx.drawImage(off, 0, 0); }
      ctx.globalAlpha = 1;
    } else frame(ctx, T);
  }

  window.ready = (async () => {
    const fams = ['900 40px NotoSerifSC', '700 40px NotoSansSC', '900 40px NotoSansSC', '40px MaShanZheng', '40px ZCOOLQingKeHuangYou', '40px WenKai'];
    await Promise.all(fams.map(f => document.fonts.load(f, '南京一笔画完整座城市鸭血粉丝汤阿要辣油')));
    return true;
  })();
  window.DURATION = F.DURATION;
  window.grab = async (T, q = .92) => { await window.ready; render(T); return canvas.toDataURL('image/jpeg', q); };
  window.renderAt = async T => { await window.ready; render(T); };
  const Q = new URLSearchParams(location.search);
  if (!Q.has('render')) (async () => {
    await window.ready; const audio = document.getElementById('a'); const t0 = +(Q.get('t') || 0);
    render(t0);
    if (Q.has('play')) { audio.currentTime = t0; audio.play().catch(() => {}); const loop = () => { render(audio.currentTime); requestAnimationFrame(loop); }; loop(); }
  })();
})();
