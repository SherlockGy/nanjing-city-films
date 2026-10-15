/* 精修版镜头：用建筑构件库重建的地标模型 + 真实地理数据地图 + 明亮暖金主题下的当代镜头（覆盖 scenes.js 同名镜头） */
(function () {
  const L = LIB, A_ = ARCH, V = VIS;
  const REF = {}; for (const k of ['statue', 'zifeng', 'njnan']) { const im = new Image(); im.onload = () => REF[k] = im; im.src = `data/refs/ink_${k}.png`; }
  window.REF_READY = () => ['statue', 'zifeng', 'njnan'].every(k => REF[k]);
  // 以底边中点为锚点画线稿（h 为屏幕像素高度），k 为自下而上的描绘进度
  const bill = (c, im, x, yb, h, k = 1, alpha = 1, tint) => { if (!im) return; const w = h * im.width / im.height; c.save(); c.globalAlpha = alpha; c.beginPath(); c.rect(x - w / 2 - 2, yb - h * L.eout(k) - 2, w + 4, h * L.eout(k) + 4); c.clip();
    if (tint) { const o = bill.o || (bill.o = document.createElement('canvas')); o.width = Math.ceil(w); o.height = Math.ceil(h); const x2 = o.getContext('2d'); x2.clearRect(0, 0, o.width, o.height); x2.globalCompositeOperation = 'source-over'; x2.drawImage(im, 0, 0, o.width, o.height); x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = tint; x2.fillRect(0, 0, o.width, o.height); x2.globalCompositeOperation = 'source-over'; c.drawImage(o, x - w / 2, yb - h, w, h); }
    else c.drawImage(im, x - w / 2, yb - h, w, h); c.restore(); };
  const { PI, clamp, lerp, eio, eout, rnd, camera, box, prism, moveMesh, drawMesh, grid, line3, q, arc, drawPath, fillPath, flame, sparks } = L;
  const { roofHip, roofPyr, eaveRing, faceArch, roofGable, dougong, col, plinth, archWall, plaque, railing, steps, hall, paifang, cypress, add } = A_;
  const INK = '#2A221B', RED = '#A8231B', GOLD = '#E9C978', BLUE = '#86A9C9', YEL = '#E3C25E', GRAY = '#8C8F93';
  const grow = (lt, d, a = .05, b = .7) => eio((lt / d - a) / (b - a));
  const txt = (c, s, x, y, font, color, align = 'center', alpha = 1, ls = 0) => { c.save(); c.globalAlpha = alpha; c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; if (ls) c.letterSpacing = ls + 'px'; c.fillText(s, x, y); c.restore(); };
  const tone = A => A.mode === 'G' ? { ink: '#3E2A14', glow: 'rgba(255,170,60,.45)', acc: '#C26A1E', soft: 'rgba(62,42,20,A)' } : A.mode === 'D' ? { ink: GOLD, glow: 'rgba(255,200,90,.85)', acc: GOLD, soft: 'rgba(233,201,120,A)' } : { ink: INK, glow: null, acc: RED, soft: 'rgba(42,34,27,A)' };
  const label = (c, s, x, y, A, a = 1, align = 'left') => txt(c, s, x, y, '600 16px Cinzel', A.mode === 'D' ? 'rgba(233,224,204,.75)' : 'rgba(42,34,27,.78)', align, a, 5);
  const mesh = (c, m, P, A, o = {}) => drawMesh(c, m, P, { dark: A.mode === 'D', ink: A.mode === 'G' ? '#3E2A14' : undefined, fill: A.mode === 'G' ? '#F6EEDC' : undefined, ...o });
  const rain = (c, lt, n = 170, a = .2) => { c.save(); c.strokeStyle = `rgba(42,34,27,${a})`; c.lineWidth = 1; for (let i = 0; i < n; i++) { const x = (rnd(i, 1) * 2100 + lt * 260) % 2100 - 100, y = (rnd(i, 2) * 1200 + lt * 900) % 1200 - 100; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 9, y + 38); c.stroke(); } c.restore(); };
  const ridgeLine = (x0, x1, y, amp, seed, n = 120) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [lerp(x0, x1, t), y - amp * (Math.sin(t * PI) * .75 + .25 * Math.sin(t * 9 + seed) * Math.sin(t * PI) + .08 * Math.sin(t * 31 + seed * 2))]; });

  // 宝塔：塔身 + 环檐 + 拱门 + 塔刹
  function pagoda(cx, cz, tiers, r0, th, o = {}) {
    const out = [], n = o.n || 8, rot = PI / n; let y = o.y0 || 0, r = r0;
    if (o.base) add(out, prism(cx, cz, r0 * 1.35, y, y + th * .5, n, rot, r0 * 1.3, o.baseTone), prism(cx, cz, r0 * 1.2, y + th * .5, y + th * .7, n, rot, r0 * 1.2, o.baseTone)), y += th * .7;
    for (let i = 0; i < tiers; i++) {
      const bh = th * (i === 0 ? 1.15 : 1), rn = r * (o.taper || .9);
      add(out, prism(cx, cz, r, y, y + bh, n, rot, r * .98, o.body, false));
      for (let k = 0; k < n; k += 2) { const a0 = rot + 2 * PI * (k + (i % 2)) / n, a1 = a0 + 2 * PI / n; add(out, faceArch(cx, cz, r, a0, a1, y + bh * .12, r * .45, bh * .7)); }
      add(out, eaveRing(cx, cz, r * (o.eave || 1.6), rn * .98, y + bh, th * .32, n, rot, { tone: o.roof, nu: 3, nv: 2, lift: .45 }));
      y += bh + th * .32; r = rn;
    }
    add(out, roofPyr(cx, cz, r * 1.2, y, th * .9, n, rot, { tone: o.roof, nu: 2, nv: 2, finial: false }));
    const ys = y + th * .9;
    add(out, prism(cx, cz, r * .14, ys, ys + th * 1.8, 8, 0, r * .05, o.spire || '#C9A24E', false));
    for (let k = 0; k < 5; k++) add(out, prism(cx, cz, r * (.3 - k * .03), ys + th * (.25 + k * .25), ys + th * (.3 + k * .25), 8, 0, r * (.3 - k * .03), o.spire || '#C9A24E'));
    return out;
  }
  // 现代塔楼（带楼层线）
  function tower(x, z, w, d, h, tn, crown) {
    const out = box(x - w / 2, 0, z - d / 2, w, h, d, tn);
    for (const f of out.slice(2)) { f.lines = []; const [a, b, , dd] = f.p; for (let y = 30; y < h - 10; y += 34) f.lines.push({ pts: [[a[0], y, a[2]], [b[0], y, b[2]]], w: .5, a: .6 }); for (let k = 1; k < 5; k++) { const t = k / 5; f.lines.push({ pts: [[lerp(a[0], b[0], t), 0, lerp(a[2], b[2], t)], [lerp(a[0], b[0], t), h, lerp(a[2], b[2], t)]], w: .4, a: .5 }); } }
    if (crown) add(out, prism(x, z, Math.min(w, d) * .45, h, h + crown, 4, PI / 4, Math.min(w, d) * .1, tn));
    return out;
  }
  // 紫峰大厦：三角平面，逐层扭转、收分，顶部斜切 + 尖顶
  function zifeng(x, z, s, tn) {
    const out = [], N = 28;
    for (let i = 0; i < N; i++) add(out, prism(x, z, s * (1 - i / N * .5), i * s * .55, (i + 1) * s * .55, 3, -PI / 2 + i * .045, s * (1 - (i + 1) / N * .5), tn, false));
    add(out, prism(x, z, s * .5, N * s * .55, N * s * .55 + s * 1.6, 3, -PI / 2 + N * .045, s * .04, tn));
    return out;
  }

  // ───────── 序：楚国“郢爰”金版 ─────────
  V.ingot = (c, lt, d, A) => {
    for (let i = 0; i < 6; i++) drawPath(c, Array.from({ length: 81 }, (_, j) => { const x = 760 + 1100 * j / 80; return [x, 780 + i * 40 + Math.sin(x / (240 + i * 40) * 2 * PI + i) * (6 + i)]; }), clamp(lt / 1.3 - i * .08), { color: `rgba(233,201,120,${.32 - i * .04})`, lw: 1.2 });
    const k = eio(lt / (d * .85)), y = lerp(260, -120, k);
    const P = camera({ yaw: .5 + lt * .18, pitch: .55, dist: 1500, f: 1500, cx: 1320, cy: 640, ty: y });
    const g = c.createRadialGradient(1320, 600, 0, 1320, 600, 380); g.addColorStop(0, 'rgba(255,200,100,.35)'); g.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = g; c.fillRect(900, 200, 840, 800);
    const m = box(-230, 0, -160, 460, 22, 320, '#A87B26');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = -190 + i * 100, z = -110 + j * 95; m.push(...plaque(0, 0, 0, 0, 0, '')); m.pop(); m.push({ p: [[x, 22.5, z + 70], [x + 80, 22.5, z + 70], [x + 80, 22.5, z], [x, 22.5, z]], tone: '#7E5A17', noHatch: true, text: { s: '郢爰', color: '#F6DC8C', font: '900 100px NotoSerifSC' } }); }
    mesh(c, m, P, A, { k: clamp(lt / 1.1), lw: 1.6 });
    sparks(c, 1320, 620, lt, 30, 260);
    label(c, 'YING YUAN · GOLD OF CHU', 1320, 930, A, clamp(lt / 1), 'center');
  };

  // ───────── 乌衣巷：马头墙小巷 + 巷口匾 ─────────
  V.wuyi = (c, lt, d, A) => {
    const P = camera({ yaw: .3, pitch: .1, dist: 1450, f: 1200, cx: 1300, cy: 740, ty: 160, tz: 360 + lt * 60 });
    const m = [];
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const z = i * 230, x = side * 230, w = 160;
      add(m, box(x - (side < 0 ? w : 0), 0, z, w, 170, 210, '#F2EEE5'));
      add(m, roofGable(x - (side < 0 ? w : 0) - 10, x + (side < 0 ? 0 : w) + 10, z + 105, 230, 170, 60, { tone: '#55565A', nu: 4, nv: 2 }));
      const xf = side < 0 ? x : x; // 马头墙：朝巷子的阶梯山墙
      const pts = [[0, 0], [0, 210], [40, 210], [40, 240], [90, 240], [90, 262], [140, 262], [140, 240], [190, 240], [190, 210], [230, 210], [230, 0]];
      m.push({ p: pts.map(([u, v]) => [xf + side * -1, v, z - 10 + u]), tone: '#F4F1EA', lines: [{ pts: [[xf, 210, z - 10], [xf, 210, z + 30], [xf, 240, z + 30], [xf, 240, z + 80], [xf, 262, z + 80], [xf, 262, z + 130], [xf, 240, z + 130], [xf, 240, z + 180], [xf, 210, z + 180], [xf, 210, z + 220]], w: 3.2 }] });
      if (i % 2 === 0) m.push({ p: [[xf - side, 0, z + 80], [xf - side, 110, z + 80], [xf - side, 110, z + 130], [xf - side, 0, z + 130]], tone: '#4A3B30', noHatch: true });
    }
    // 巷口门楼与匾额
    add(m, box(-120, 0, -40, 40, 260, 40, '#EFEAE0'), box(80, 0, -40, 40, 260, 40, '#EFEAE0'), box(-150, 260, -50, 300, 30, 60, '#EFEAE0'));
    add(m, roofGable(-170, 170, -20, 110, 290, 50, { tone: '#55565A', nu: 6, nv: 2 }));
    add(m, plaque(0, 222, -42, 150, 50, '乌衣巷', '#2B2A2A', '#F2EEE5'));
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1.3 });
    for (let i = 0; i < 3; i++) { const u = clamp((lt - .5 - i * .3) / (d * .8)); if (u > 0) V._swallow(c, lerp(900, 1750, u) + i * 40, 300 + Math.sin(u * 6 + i) * 30 - u * 60 + i * 26, 1.2 - i * .2, Math.sin(lt * 14 + i)); }
  };

  // ───────── 栖霞山：舍利塔 + 千佛岩 ─────────
  V.qixia = (c, lt, d, A) => {
    const k = grow(lt, d, 0, .7);
    // 千佛岩：岩壁上的佛龛
    drawPath(c, [[1360, 980], [1372, 760], [1350, 600], [1395, 470], [1450, 400], [1530, 352], [1600, 372], [1660, 330], [1740, 352], [1800, 420], [1850, 520], [1872, 700], [1880, 980]], k, { color: INK, lw: 2.2, fill: 'rgba(214,198,166,.6)' });
    for (let r = 0; r < 7; r++) for (let i = 0; i < 6; i++) { const x = 1440 + i * 68 + (r % 2) * 30 + (rnd(r * 7 + i, 3) - .5) * 26, y = 430 + r * 75 + (rnd(r * 7 + i, 4) - .5) * 22; if (x > 1850 || rnd(r * 7 + i, 5) < .18) continue; drawPath(c, L.cat([[x - 18, y + 30]], arc(x, y + 12, 18, 18, PI, 2 * PI, 10), [[x + 18, y + 30], [x - 18, y + 30]]), clamp(k * 1.6 - .5 - (r * 6 + i) * .01), { color: INK, lw: 1.2, fill: 'rgba(80,64,48,.35)' }); }
    for (let i = 0; i < 14; i++) drawPath(c, Array.from({ length: 30 }, (_, j) => [1370 + j * 17, 400 + i * 42 + Math.sin(j * .7 + i) * 8 + (j * 17) * .05]), clamp(k * 1.4 - .4), { color: INK, lw: .7, alpha: .3 });
    const P = camera({ yaw: .3 + lt * .06, pitch: .1, dist: 1500, f: 2050, cx: 1080, cy: 960, ty: 300 });
    const m = [];
    add(m, prism(0, 0, 170, 0, 40, 8, PI / 8, 160, '#E4DCCB'), prism(0, 0, 140, 40, 110, 8, PI / 8, 140, '#EAE3D4'), prism(0, 0, 160, 110, 140, 8, PI / 8, 150, '#E4DCCB'));
    add(m, prism(0, 0, 100, 140, 250, 8, PI / 8, 100, '#EFE9DC', false));
    for (let k2 = 0; k2 < 8; k2 += 2) { const a0 = PI / 8 + k2 * PI / 4; add(m, faceArch(0, 0, 100, a0, a0 + PI / 4, 160, 40, 70)); }
    let y = 250, r = 100;
    for (let i = 0; i < 5; i++) { add(m, eaveRing(0, 0, r * 1.45, r * .9, y, 22, 8, PI / 8, { tone: '#CFC6B3', nu: 2, nv: 1, lift: .3 })); y += 22; add(m, prism(0, 0, r * .9, y, y + 28, 8, PI / 8, r * .88, '#EFE9DC', false)); y += 28; r *= .9; }
    add(m, roofPyr(0, 0, r * 1.3, y, 50, 8, PI / 8, { tone: '#CFC6B3', nu: 2, nv: 2, finial: false }), prism(0, 0, 14, y + 50, y + 150, 8, 0, 4, '#C9A24E'));
    grid(c, P, 600, 100, INK, .1);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .65), lw: 1.2 });
    for (let i = 0; i < 26; i++) { const x = 900 + (i * 97 % 1000) + Math.sin(lt * 1.2 + i) * 40, yy = ((i * 61 % 700) + lt * (50 + i % 4 * 14)) % 760 + 200; c.save(); c.globalAlpha = clamp(lt / .6) * .85; c.translate(x, yy); c.rotate(lt * 2 + i); c.fillStyle = ['#B8402A', '#D0712E', '#A8231B'][i % 3]; c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(9, 0, 0, 10); c.quadraticCurveTo(-9, 0, 0, -10); c.fill(); c.restore(); }
    label(c, 'SARIRA STUPA · THOUSAND BUDDHA CLIFF', 1060, 1000, A, k, 'center');
  };

  // ───────── 鸡鸣寺：药师塔 + 黄墙寺院 + 烟雨 ─────────
  V.jiming = (c, lt, d, A) => {
    const P = camera({ yaw: -.38 + lt * .03, pitch: .2, dist: 2000, f: 1650, cx: 1240, cy: 760, ty: 200, tz: 200 });
    const m = [];
    add(m, box(-700, 0, -300, 1400, 60, 900, '#D9CFBD'), box(-520, 60, -150, 1040, 70, 650, '#D9CFBD'), box(-300, 130, 0, 600, 70, 420, '#D9CFBD'));
    add(m, box(-700, 60, -300, 1400, 70, 26, YEL)); add(m, roofGable(-710, 710, -287, 46, 130, 16, { tone: '#5E6066', nu: 18, nv: 1 }));
    add(m, box(-520, 130, -150, 1040, 60, 24, YEL)); add(m, roofGable(-530, 530, -138, 44, 190, 14, { tone: '#5E6066', nu: 14, nv: 1 }));
    add(m, hall(-380, 120, 240, 120, 80, { cols: 5, base: 30, roofTone: '#5E6066', wallTone: YEL, colTone: '#B9483A', dougong: false }).map(f => ({ ...f, p: f.p.map(([x, y, z]) => [x, y + 130, z]) })));
    add(m, pagoda(80, 230, 7, 70, 62, { n: 8, taper: .9, body: '#F0E6CF', roof: '#5E6066', spire: '#C9A24E', y0: 200, eave: 1.65 }));
    grid(c, P, 1400, 140, INK, .08);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .7), lw: 1.15 });
    rain(c, lt, 190, .22);
    label(c, 'JIMING TEMPLE · MEDICINE BUDDHA PAGODA', 1240, 990, A, clamp(lt / .8), 'center');
  };

  // ───────── 大明：午门（凹字形门楼，五凤楼） ─────────
  V.ming = (c, lt, d, A) => {
    const P = camera({ yaw: -.42 + lt * .035, pitch: .26, dist: 2600, f: 1800, cx: 1240, cy: 700, ty: 220, tz: -200 });
    const m = [], wall = '#C8B9A0', red = '#A84A3A', roof = '#D9B45A';
    add(m, archWall(0, 0, 0, 1200, 240, 260, [{ x: 0, w: 110, h: 170 }, { x: -230, w: 80, h: 140 }, { x: 230, w: 80, h: 140 }], wall));
    for (const sx of [-1, 1]) { add(m, box(sx * 600 - (sx > 0 ? 160 : 0), 0, -830, 160, 240, 700, wall)); }
    add(m, hall(0, 0, 640, 170, 120, { cols: 9, base: 0, colTone: red, wallTone: '#B9483A', roofTone: roof, double: true }).map(f => ({ ...f, p: f.p.map(([x, y, z]) => [x, y + 240, z]) })));
    for (const sx of [-1, 1]) {
      add(m, box(sx * 520 - 50, 240, -780, 100, 70, 560, red)); add(m, roofHip(sx * 520, -500, 140, 600, 310, 60, { tone: roof, nu: 4, ns: 12, hip: .5 }));
      for (const z of [-820, -150]) { add(m, box(sx * 520 - 70, 240, z - 70, 140, 90, 140, red)); add(m, roofPyr(sx * 520, z, 120, 330, 110, 4, PI / 4, { tone: roof, nu: 3, nv: 2 })); }
    }
    grid(c, P, 1600, 160, INK, .08);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .7), lw: 1.15 });
    label(c, 'MERIDIAN GATE · MING PALACE', 1240, 990, A, clamp(lt / .8), 'center');
  };

  // ───────── 大报恩寺琉璃塔 ─────────
  V.tower = (c, lt, d, A) => {
    const P = camera({ yaw: lt * .22, pitch: .12, dist: 2300, f: 2150, cx: 1310, cy: 1020, ty: 120 });
    const m = pagoda(0, 0, 9, 120, 74, { n: 8, taper: .925, body: '#F6F2E8', roof: '#B9CC92', spire: '#D8B456', base: true, baseTone: '#E7DFCF', eave: 1.55 });
    grid(c, P, 800, 100, INK, .1);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .7), lw: 1.1 });
    label(c, '9 STOREYS · ≈ 78 M · WHITE PORCELAIN & GLAZED TILES', 1310, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 江南贡院：明远楼 + 一排排号舍 ─────────
  V.exam = (c, lt, d, A) => {
    const P = camera({ yaw: -.3, pitch: .36, dist: 1900, f: 1500, cx: 1300, cy: 640, tz: 300 + lt * 50 });
    const m = [];
    for (let r = 0; r < 9; r++) for (const sx of [-1, 1]) {
      const z = -300 + r * 150, x0 = sx < 0 ? -1100 : 180, x1 = sx < 0 ? -180 : 1100;
      const rowF = box(x0, 0, z, x1 - x0, 70, 50, '#E6DCC6');
      rowF[2].lines = []; for (let x = x0 + 14; x < x1 - 10; x += 34) rowF[2].lines.push({ pts: [[x, 0, z - .5], [x, 50, z - .5], [x + 20, 50, z - .5], [x + 20, 0, z - .5]], w: .8 });
      add(m, rowF, roofGable(x0 - 6, x1 + 6, z + 25, 70, 70, 18, { tone: '#6B6A66', nu: 10, nv: 1, tiles: false }));
    }
    add(m, plinth(0, 300, 260, 260, 40, '#D9CFBD'));
    let y = 40; for (let i = 0; i < 3; i++) { const w = 200 - i * 30; add(m, box(-w / 2, y, 300 - w / 2, w, 90, w, '#EADFCB')); add(m, roofHip(0, 300, w + 70, w + 70, y + 90, 44, { tone: '#6B6A66', nu: 8, ns: 8, nv: 3, hip: 1 })); y += 134; }
    add(m, plaque(0, 120, 300 - 101, 110, 34, '明远楼', '#2F4E78', '#E8C873'));
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1 });
    txt(c, Math.round(20644 * eout(clamp((lt - .3) / (d * .6)))).toLocaleString('en'), 1640, 930, '700 54px Cinzel', RED, 'center', clamp(lt / .4), 4);
    label(c, 'CELLS · 号舍', 1640, 985, A, clamp(lt / .4), 'center');
  };

  // ───────── 中山陵：博爱坊 → 陵门“天下为公” → 台阶 → 祭堂 ─────────
  V.sunyat = (c, lt, d, A) => {
    // 镜头从博爱坊前推进、穿过中门，正对高台上的陵门“天下为公”
    const u = eio(clamp((lt - .4) / (d - .4))), camZ = lerp(-1750, -330, u), P = camera({ yaw: 0, pitch: lerp(.0, -.06, u), dist: 1500, f: 1250, cx: 1280, cy: 650, ty: lerp(290, 200, u), tz: camZ + 1500 });
    drawPath(c, ridgeLine(560, 1880, 470, 200, 1.3), clamp(lt / .8), { color: INK, lw: 1.4, alpha: .45 });
    const m = [], H0 = 150;
    add(m, paifang(0, 0, 820, 600, { text: '博爱', roof: BLUE }));
    for (const sx of [-1, 1]) for (let z = 240; z < 1400; z += 170) add(m, cypress(sx * 420, z, 230, 46));
    add(m, box(-560, 0, 1380, 1120, H0, 700, '#E1DACB'), steps(0, 1240, 360, 6, H0 / 6, 24, 0, '#E7E1D6'));
    add(m, moveMesh([].concat(plinth(0, 1650, 860, 260, 50, '#E3DCCF'),
      archWall(0, 50, 1650, 760, 290, 180, [{ x: 0, w: 130, h: 220 }, { x: -225, w: 104, h: 186 }, { x: 225, w: 104, h: 186 }], '#ECE7DE'),
      plaque(0, 50 + 254, 1650 - 91, 300, 58, '天下为公', '#2F4E78', '#E8C873'),
      box(-400, 340, 1545, 800, 20, 210, '#D8D2C6'), dougong(0, 1650, 780, 200, 360, 14, 38, '#D8D2C6'),
      roofHip(0, 1650, 940, 340, 374, 160, { tone: BLUE })), 0, H0, 0));
    add(m, steps(0, 2050, 340, 16, 26, 44, H0, '#E7E1D6'));
    add(m, hall(0, 3000, 560, 280, 220, { cols: 6, base: 40, colTone: '#E2DCD0', wallTone: '#EEE9E0', roofTone: BLUE, arches: [{ x: 0, w: 76, h: 150 }, { x: -160, w: 64, h: 130 }, { x: 160, w: 64, h: 130 }] }).map(f => ({ ...f, p: f.p.map(([x, y, z]) => [x, y + H0 + 16 * 26 - 40, z]) })));
    grid(c, P, 2000, 160, INK, .08, 0);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .55), lw: 1.15 });
    label(c, '博爱坊 · 陵门 · 392 STEPS · 祭堂', 1180, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 紫金山天文台 ─────────
  V.observatory = (c, lt, d, A) => {
    const P = camera({ yaw: -.45 + lt * .05, pitch: .24, dist: 1900, f: 1700, cx: 1250, cy: 820, ty: 150 });
    const m = hall(0, 0, 420, 200, 120, { cols: 6, roofTone: '#7F9A86', wallTone: '#EAE2D2', colTone: '#B9483A' });
    const dome = (x, z, y0, R) => { const out = []; for (let j = 0; j < 6; j++) { const a0 = j / 6 * PI / 2, a1 = (j + 1) / 6 * PI / 2; for (let i = 0; i < 18; i++) { if (i === 4 && j < 5) continue; const b0 = i / 18 * 2 * PI, b1 = (i + 1) / 18 * 2 * PI; const p = (a, b) => [x + Math.cos(b) * Math.cos(a) * R, y0 + Math.sin(a) * R, z + Math.sin(b) * Math.cos(a) * R]; out.push({ p: [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)], tone: '#E9E5DA' }); } } return out; };
    for (const sx of [-1, 1]) { add(m, box(sx * 420 - 80, 0, -80, 160, 260, 160, '#E6DDCB'), dome(sx * 420, 0, 260, 100)); }
    grid(c, P, 900, 100, INK, .1);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1.15 });
    const kk = clamp((lt - .6) / (d * .5)), stars = Array.from({ length: 9 }, (_, i) => [1000 + rnd(i, 1) * 820, 170 + rnd(i, 2) * 230]);
    stars.forEach(([x, y], i) => { c.save(); c.globalAlpha = clamp(kk * 3 - i * .2); c.fillStyle = INK; c.beginPath(); c.arc(x, y, 4, 0, 2 * PI); c.fill(); c.restore(); });
    drawPath(c, stars.slice(0, 6), kk, { color: INK, lw: 1, alpha: .6, dash: [6, 6] });
  };

  // ───────── 1912 总统府门楼 ─────────
  V.republic = (c, lt, d, A) => {
    const P = camera({ yaw: -.28, pitch: .1, dist: 1800, f: 1700, cx: 1250, cy: 760, ty: 220 });
    const m = archWall(0, 0, 0, 900, 330, 90, [{ x: 0, w: 130, h: 230 }, { x: -230, w: 100, h: 190 }, { x: 230, w: 100, h: 190 }], '#E2D6BE');
    for (let i = 0; i < 8; i++) { const x = -385 + i * 110; add(m, col(x, -70, 15, 0, 300, '#ECE4D4'), box(x - 22, 300, -92, 44, 16, 44, '#E2D6BE'), box(x - 20, 0, -90, 40, 20, 40, '#E2D6BE')); }
    add(m, box(-470, 316, -100, 940, 40, 150, '#DCCFB4'), box(-230, 356, -60, 460, 80, 110, '#E2D6BE'));
    m.push({ p: [[0, 436, 0], [0, 600, 0], [4, 600, 0], [4, 436, 0]], tone: INK });
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1.2 });
    const tp = P([4, 600, 0]); if (lt > d * .45) fillPath(c, [[tp[0], tp[1]], [tp[0] + 110, tp[1] + 10 + Math.sin(lt * 4) * 6], [tp[0] + 110, tp[1] + 70 + Math.sin(lt * 4 + 1) * 6], [tp[0], tp[1] + 60]], RED, clamp((lt - d * .45) * 3));
  };

  // ───────── 国立中央大学大礼堂（1931）：古典柱廊 + 铜绿穹顶 ─────────
  V.ncu = (c, lt, d, A) => {
    const P = camera({ yaw: -.36 + lt * .04, pitch: .12, dist: 2000, f: 1750, cx: 1260, cy: 800, ty: 260 });
    const m = [], wall = '#E6DCC8', stone = '#ECE5D6', green = '#93B7A5';
    add(m, plinth(0, 40, 760, 500, 40, '#DCD2C0'));
    add(m, archWall(0, 40, 80, 640, 300, 380, [{ x: 0, w: 90, h: 170 }, { x: -150, w: 70, h: 150 }, { x: 150, w: 70, h: 150 }], wall));
    for (let i = 0; i < 6; i++) { const x = -250 + i * 100; add(m, col(x, -150, 18, 40, 320, stone), box(x - 26, 320, -176, 52, 18, 52, stone), box(x - 24, 40, -174, 48, 22, 48, stone)); }
    add(m, box(-300, 338, -190, 600, 46, 120, stone));
    m.push({ p: [[-300, 384, -190], [300, 384, -190], [0, 470, -190]], tone: wall, lines: [{ pts: [[-250, 392, -190.5], [250, 392, -190.5], [0, 456, -190.5], [-250, 392, -190.5]], w: 1 }] });
    m.push({ p: [[300, 384, -190], [300, 384, -70], [0, 470, -70], [0, 470, -190]], tone: '#D9CFBB' }, { p: [[-300, 384, -70], [-300, 384, -190], [0, 470, -190], [0, 470, -70]], tone: '#D9CFBB' });
    add(m, prism(0, 100, 200, 340, 430, 20, 0, 200, wall, false));
    const R = 205, dome = []; for (let j = 0; j < 7; j++) { const a0 = j / 7 * PI / 2, a1 = (j + 1) / 7 * PI / 2; for (let i = 0; i < 20; i++) { const b0 = i / 20 * 2 * PI, b1 = (i + 1) / 20 * 2 * PI, p = (a, b) => [Math.cos(b) * Math.cos(a) * R, 430 + Math.sin(a) * R * .9, 100 + Math.sin(b) * Math.cos(a) * R]; dome.push({ p: [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)], tone: green, noStroke: i % 2 === 1 }); } }
    add(m, dome, prism(0, 100, 36, 430 + R * .9 - 4, 430 + R * .9 + 60, 8, 0, 30, stone), prism(0, 100, 40, 430 + R * .9 + 60, 430 + R * .9 + 90, 8, 0, 8, green));
    grid(c, P, 1000, 100, INK, .09);
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1.15 });
    label(c, 'AUDITORIUM · NATIONAL CENTRAL UNIVERSITY · 1931', 1260, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 1968 南京长江大桥：桥头堡 + 三面红旗 + 玉兰灯 ─────────
  V.bridge = (c, lt, d, A) => {
    const P = camera({ yaw: -.72, pitch: .12, dist: 2500, f: 1500, cx: 1300, cy: 720, ty: 330, tx: 350 + lt * 40 });
    const m = [], stl = '#BFC3C2';
    add(m, box(-500, 0, -200, 420, 230, 400, '#E8DDC6'), box(-380, 230, -110, 180, 560, 220, '#EFE6D3'));
    const tw = m.slice(-6); tw[2].lines = []; for (let k = 1; k < 6; k++) tw[2].lines.push({ pts: [[-380 + k * 30, 240, -110.5], [-380 + k * 30, 780, -110.5]], w: .7 });
    add(m, box(-400, 790, -130, 220, 24, 260, '#E8DDC6'));
    for (let i = 0; i < 3; i++) { const bx = -340 + i * 60, sw = (u, v) => [bx + u * 160, 820 + v * 120 + Math.sin(u * 4 + lt * 3 + i) * 14, -20 + i * 20 + u * 20];
      const f = []; for (let a = 0; a < 6; a++) f.push({ p: [sw(a / 6, 0), sw((a + 1) / 6, 0), sw((a + 1) / 6, 1), sw(a / 6, 1)], tone: '#C0392B', noHatch: true, noStroke: true }); add(m, f, box(bx - 4, 790, -24 + i * 20, 8, 160, 8, '#8C2A20')); }
    add(m, box(-80, 300, -60, 2800, 18, 120, '#D2CCC0'), box(-80, 196, -60, 2800, 14, 120, '#C7C1B6'));
    for (let i = 0; i < 5; i++) add(m, box(260 + i * 560, -200, -70, 80, 400, 140, '#DCD2C0'));
    for (let x = 0; x < 2700; x += 140) add(m, box(x - 3, 318, -64, 6, 70, 6, '#7D7A72'), box(x - 10, 384, -70, 20, 12, 18, '#F2EDE1'));
    mesh(c, m, P, A, { k: grow(lt, d, 0, .5), lw: 1.2 });
    const kk = clamp((grow(lt, d, 0, .5) - .3) / .5); const tr = [];
    for (let x = -60; x < 2700; x += 70) tr.push([x, 210, -60], [x + 35, 300, -60]);
    line3(c, P, tr, kk, { color: INK, lw: 1.5 }); line3(c, P, tr.map(([x, y]) => [x, y, 60]), kk, { color: INK, lw: 1, alpha: .5 });
    for (let i = 0; i < 6; i++) drawPath(c, Array.from({ length: 81 }, (_, j) => { const x = 300 + 1600 * j / 80; return [x, 930 + i * 26 + Math.sin(x / 140 + lt * 2 + i) * 4]; }), kk, { color: INK, lw: 1, alpha: .45 });
    label(c, 'BRIDGEHEAD TOWER · RED FLAGS · MAGNOLIA LAMPS', 1240, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 新街口：孙中山铜像 + 环岛 + 高楼 ─────────
  V.xinjiekou = (c, lt, d, A) => {
    const T = tone(A), P = camera({ yaw: -.2 + lt * .06, pitch: .1, dist: 2300, f: 1500, cx: 1260, cy: 760, ty: 330 });
    const m = [];
    const B = [[-760, 380, 180, 160, 1150, 120, '#E9DDC4'], [-420, 760, 160, 160, 760, 0, '#EFE6D3'], [520, 520, 200, 170, 1300, 160, '#E6D9BF'], [860, 140, 150, 150, 700, 0, '#F1E8D6'], [320, 980, 190, 150, 980, 0, '#EADFC8'], [-1000, -100, 140, 140, 620, 0, '#F0E7D4']];
    for (const [x, z, w, dd, h, cr, tn] of B) add(m, tower(x, z, w, dd, h, tn, cr));
    add(m, prism(-420, 760, 95, 760, 820, 16, 0, 95, '#E2D6BE')); // 金陵饭店旋转餐厅
    add(m, prism(0, 0, 300, 0, 8, 28, 0, 300, '#DDD3BF'));
    mesh(c, m, P, A, { k: grow(lt, d, 0, .55), lw: 1.1 });
    // 铜像：由实拍照片描成的线稿，立在环岛中心
    const base = P([0, 0, 0]), topP = P([0, 760, 0]);
    bill(c, REF.statue, base[0], base[1] + 6, base[1] - topP[1], clamp((lt - .2) / 1.2), 1, A.mode === 'G' ? '#3E2A14' : null);
    label(c, 'DR. SUN YAT-SEN · XINJIEKOU', 1250, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 玄武湖畔：城墙 · 鸡鸣寺 · 紫峰大厦 ─────────
  V.xuanwu = (c, lt, d, A) => {
    const T = tone(A), P = camera({ yaw: -.08 + lt * .02, pitch: .06, dist: 2300, f: 1550, cx: 1180, cy: 720, ty: 520, tz: 1300 });
    const m = [];
    for (let x = -1600; x < 1600; x += 300) { const f = box(x, 0, 500, 300, 140, 70, '#CFC6B4'); f[2].lines = [{ pts: [[x, 70, 499.5], [x + 300, 70, 499.5]], w: .6, a: .6 }]; add(m, f); for (let k = 0; k < 300; k += 50) add(m, box(x + k, 140, 500, 30, 22, 26, '#CFC6B4')); }
    add(m, pagoda(-650, 900, 7, 55, 50, { n: 8, taper: .9, body: '#F0E6CF', roof: '#5E6066', y0: 140, eave: 1.6 }));
    add(m, box(-900, 140, 860, 520, 40, 120, YEL));
    for (const [x, z, w, h] of [[150, 2400, 120, 520], [800, 2300, 140, 680], [1050, 2600, 120, 460], [-200, 2600, 150, 400], [1300, 2200, 110, 560]]) add(m, tower(x, z, w, w, h, '#EAE6DD', 0));
    { const b = P([450, 0, 2350]), t = P([450, 1250, 2350]); bill(c, REF.zifeng, b[0], b[1], b[1] - t[1], clamp((lt - .2) / 1.4), 1, '#3E2A14'); }
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1.05 });
    for (let i = 0; i < 9; i++) drawPath(c, Array.from({ length: 101 }, (_, j) => { const x = 560 + 1360 * j / 100; return [x, 860 + i * 22 + Math.sin(x / 90 + lt * 1.5 + i) * 3]; }), clamp(lt / .8 - i * .05), { color: T.ink, lw: 1, alpha: .45 - i * .03 });
    for (const [x, y] of [[700, 840], [1700, 830]]) for (let j = 0; j < 9; j++) drawPath(c, q([x, y - 120], [x - 30 + j * 8, y - 90], [x - 40 + j * 10, y - 10 + (j % 3) * 8], 10), clamp(lt / .9), { color: T.ink, lw: 1, alpha: .7 });
    label(c, 'XUANWU LAKE · MING WALL · JIMING TEMPLE · ZIFENG', 1150, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 南京南站（实拍线稿）─────────
  V.njnan = (c, lt, d, A) => {
    const z = 1 + .05 * eio(lt / d), im = REF.njnan; if (!im) return;
    c.save(); c.translate(1260, 640); c.scale(z, z); c.translate(-1260, -640);
    const h = 640, w = h * im.width / im.height, x = 1260, yb = 1000;
    const k = clamp((lt - .1) / 1.3);
    c.save(); c.beginPath(); c.rect(x - w / 2, yb - h, w * eout(k), h); c.clip(); c.drawImage(im, x - w / 2, yb - h, w, h); c.restore();
    txt(c, '南 京 南 站', x, yb - h * .9, '900 40px NotoSerifSC', '#B5541A', 'center', clamp((lt - 1.2) / .4), 6);
    c.restore();
    label(c, 'NANJING SOUTH · HIGH-SPEED RAIL HUB', 1260, 1040, A, clamp(lt / .8), 'center');
  };

  // ───────── 南京都市圈（真实城市坐标）─────────
  V.dushiquan = (c, lt, d, A) => {
    const T = tone(A), pj = proj([960, 150, 880, 870], 117.55, 120.35, 30.75, 33.8), inb = ([x, y]) => x > 940 && x < 1860 && y > 150 && y < 1030;
    const k = grow(lt, d, 0, .5);
    for (const ln of GEO.rivers.yangtze) { const pts = ln.map(pj).filter(inb); if (pts.length > 1) drawPath(c, pts, k, { color: T.ink, lw: 3, alpha: .55 }); }
    const NJ = pj([118.80, 32.06]);
    for (let r = 1; r <= 3; r++) drawPath(c, arc(NJ[0], NJ[1], r * 150, r * 150, -PI / 2, 1.5 * PI, 90), clamp(k * 1.5 - r * .15), { color: T.ink, lw: 1, alpha: .35, dash: [6, 8] });
    const C = [[119.45, 32.20, '镇江'], [119.41, 32.39, '扬州'], [119.02, 33.61, '淮安'], [118.38, 31.33, '芜湖'], [118.51, 31.67, '马鞍山'], [118.32, 32.30, '滁州'], [118.76, 30.94, '宣城'], [119.58, 31.72, '金坛'], [119.48, 31.43, '溧阳']];
    C.forEach(([lo, la, n], i) => { const p = pj([lo, la]), kk = clamp((lt - .5 - i * .12) / .6); drawPath(c, [NJ, p], kk, { color: '#C26A1E', lw: 2.2 });
      if (kk > 0) { c.save(); c.globalAlpha = kk; c.fillStyle = '#C26A1E'; c.beginPath(); c.arc(p[0], p[1], 8, 0, 2 * PI); c.fill(); c.restore(); txt(c, n, p[0] + 16, p[1] - 4, '700 28px NotoSerifSC', T.ink, 'left', kk);
        const u = (lt * .7 + i * .13) % 1; c.fillStyle = 'rgba(194,106,30,.9)'; c.beginPath(); c.arc(lerp(NJ[0], p[0], u), lerp(NJ[1], p[1], u), 4, 0, 2 * PI); c.fill(); } });
    c.save(); c.fillStyle = '#B5541A'; c.shadowColor = 'rgba(255,170,60,.7)'; c.shadowBlur = 20; c.beginPath(); c.arc(NJ[0], NJ[1], 16, 0, 2 * PI); c.fill(); c.restore();
    txt(c, '南京', NJ[0] - 22, NJ[1] + 2, '900 40px NotoSerifSC', '#B5541A', 'right', clamp(lt / .5));
    label(c, 'JIANGSU · ANHUI', 1700, 980, A, clamp(lt / .8), 'center');
  };

  // ───────── 牛首山佛顶宫 ─────────
  V.niushou = (c, lt, d, A) => {
    const P = camera({ yaw: -.32 + lt * .05, pitch: .2, dist: 2300, f: 1700, cx: 1260, cy: 860, ty: 120 });
    drawPath(c, ridgeLine(600, 1880, 640, 220, 2.2), clamp(lt / .7), { color: tone(A).ink, lw: 1.4, alpha: .5 });
    const m = [], dome = (cx, cz, y0, rx, ry, rz, tn, nb = 24, na = 7, cut = 0) => { const out = []; for (let j = 0; j < na; j++) { const a0 = j / na * PI / 2, a1 = (j + 1) / na * PI / 2; for (let i = 0; i < nb; i++) { const b0 = i / nb * 2 * PI, b1 = (i + 1) / nb * 2 * PI; const p = (a, b) => [cx + Math.cos(b) * Math.cos(a) * rx, y0 + Math.sin(a) * ry, cz + Math.sin(b) * Math.cos(a) * rz]; out.push({ p: [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)], tone: tn }); } } return out; };
    add(m, box(-700, 0, -420, 1400, 50, 840, '#E3DACA'));
    add(m, dome(-60, 0, 50, 560, 260, 380, '#E7DCC6'));
    add(m, dome(150, -40, 230, 200, 210, 170, '#D8B456', 16, 6));
    add(m, pagoda(-900, 400, 9, 50, 40, { n: 4, taper: .93, body: '#EFE6D3', roof: '#7A6F60', eave: 1.6 }));
    mesh(c, m, P, A, { k: grow(lt, d, 0, .6), lw: 1.05 });
    label(c, 'USHNISHA PALACE · BUDDHA-TOP PAGODA', 1260, 1000, A, clamp(lt / .8), 'center');
  };

  // ───────── 明亮主题下的当代镜头 ─────────
  const _warp = V.warp, _train = V.train, _book = V.book, _network = V.network, _galaxy = V.galaxy, _ring = V.ring, _flame = V.flame;
  V.warp = (c, lt, d, A) => { if (A.mode !== 'G') return _warp(c, lt, d, A);
    for (let i = 0; i < 200; i++) { const a = rnd(i, 1) * 2 * PI, sp = .3 + rnd(i, 2), ph = (lt * sp * (.6 + lt * .4) + rnd(i, 3)) % 1; const r0 = 40 + ph * ph * 1200, r1 = r0 + 20 + ph * 180;
      c.strokeStyle = `rgba(${170 + rnd(i, 4) * 60 | 0},${90 + rnd(i, 5) * 50 | 0},30,${ph * .7})`; c.lineWidth = .6 + ph * 2.4; c.beginPath(); c.moveTo(1240 + Math.cos(a) * r0, 600 + Math.sin(a) * r0 * .7); c.lineTo(1240 + Math.cos(a) * r1, 600 + Math.sin(a) * r1 * .7); c.stroke(); }
    const g = c.createRadialGradient(1240, 600, 0, 1240, 600, 300); g.addColorStop(0, 'rgba(255,200,110,.55)'); g.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g; c.fillRect(900, 280, 700, 640); };
  const recolor = fn => (c, lt, d, A) => { if (A.mode !== 'G') return fn(c, lt, d, A);
    // 在暖色背景上用深色描线：先画到离屏，再整体着色
    const off = recolor.off || (recolor.off = Object.assign(document.createElement('canvas'), { width: 1920, height: 1080 })), o = off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, 1920, 1080); o.setTransform(c.getTransform()); fn(o, lt, d, { ...A, mode: 'D', dark: true });
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-atop'; o.fillStyle = '#6B3F12'; o.globalAlpha = .82; o.fillRect(0, 0, 1920, 1080); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(off, 0, 0); c.restore(); };
  V.train = recolor(_train); V.book = recolor(_book); V.network = recolor(_network); V.galaxy = recolor(_galaxy);
  V.ring = (c, lt, d, A) => { recolor(_ring)(c, lt, d, A); if (A.mode === 'G') { const g = c.createRadialGradient(960, 700, 0, 960, 700, 300); g.addColorStop(0, 'rgba(255,190,90,.55)'); g.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g; c.fillRect(600, 380, 720, 640); V._warmFlame(c, 960, 760, 1.0, lt); } };
  V.flame = (c, lt, d, A) => { if (A.mode !== 'G') return _flame(c, lt, d, A);
    c.save(); c.translate(960, 560); for (let i = 0; i < 4; i++) { c.strokeStyle = `rgba(160,90,30,${.3 - i * .06})`; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 360 + i * 70, 0, 2 * PI * clamp(lt / 2 - i * .1)); c.stroke(); } c.restore();
    const g = c.createRadialGradient(960, 620, 0, 960, 620, 620); g.addColorStop(0, 'rgba(255,190,90,.65)'); g.addColorStop(1, 'rgba(255,196,100,0)'); c.fillStyle = g; c.fillRect(300, 0, 1320, 1080);
    V._warmFlame(c, 960, 900, 1.5, lt); };
  V._warmFlame = (c, x, y, s, t) => { // 暖色背景上的火焰（不用加色混合）
    for (let i = 0; i < 30; i++) { const life = .9 + rnd(i, 2) * .6, ph = ((t + rnd(i, 1) * life) % life) / life, px = x + Math.sin(t * 6 + i) * 7 * s * (1 - ph), py = y - ph * 140 * s, r = (28 - ph * 22) * s * (.6 + rnd(i, 4) * .6);
      const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${230 - ph * 40 | 0},${110 - ph * 60 | 0},20,${.55 * (1 - ph)})`); g.addColorStop(1, 'rgba(220,90,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, 2 * PI); c.fill(); }
    const g = c.createRadialGradient(x, y - 10 * s, 0, x, y - 10 * s, 26 * s); g.addColorStop(0, 'rgba(255,250,220,.95)'); g.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y - 10 * s, 26 * s, 0, 2 * PI); c.fill(); };

  // ───────── 真实地理数据的地图 ─────────
  const proj = (box_, lon0, lon1, lat0, lat1) => ([lon, lat]) => [box_[0] + (lon - lon0) / (lon1 - lon0) * box_[2], box_[1] + (lat1 - lat) / (lat1 - lat0) * box_[3]];
  V.migrate = (c, lt, d, A) => {
    const k = grow(lt, d, 0, .5), pj = proj([820, 200, 1020, 820], 104, 123, 26, 41);
    for (const ln of GEO.cn) drawPath(c, ln.map(pj), k, { color: INK, lw: 1.4, alpha: .7 });
    for (const ln of GEO.rivers.yellow) drawPath(c, ln.map(pj), k, { color: INK, lw: 2.2 });
    for (const ln of GEO.rivers.yangtze) drawPath(c, ln.map(pj), k, { color: INK, lw: 2.6 });
    label(c, 'YELLOW RIVER', 990, 300, A, clamp(k * 2 - 1)); label(c, 'YANGTZE', 1020, 760, A, clamp(k * 2 - 1));
    const cities = [[108.94, 34.34, '长安'], [112.45, 34.62, '洛阳'], [118.8, 32.06, '建康']];
    cities.forEach(([lo, la, n], i) => { const [x, y] = pj([lo, la]), a = clamp(k * 2 - .4 - i * .2); c.save(); c.globalAlpha = a; c.fillStyle = i === 2 ? RED : INK; c.beginPath(); c.arc(x, y, i === 2 ? 11 : 7, 0, 2 * PI); c.fill(); c.restore(); txt(c, n, x, y - 30, '700 30px NotoSerifSC', i === 2 ? RED : INK, 'center', a); });
    const tgt = pj([118.8, 32.06]);
    [[110.5, 35.6], [112.5, 36.5], [114.4, 35.2], [116.5, 36.8], [117.2, 34.8], [113.5, 34.1]].forEach(([lo, la], i) => {
      const s = pj([lo, la]), path = q(s, [lerp(s[0], tgt[0], .4) + 40, lerp(s[1], tgt[1], .5) - 20], tgt, 30), kk = clamp((lt - .5 - i * .1) / (d * .5));
      drawPath(c, path, kk, { color: RED, lw: 2, dash: [10, 8] });
      if (kk > 0) for (let j = 0; j < 3; j++) { const p = path[Math.floor(((lt * .4 + j / 3 + i * .1) % 1) * kk * (path.length - 1))]; c.fillStyle = RED; c.beginPath(); c.arc(p[0], p[1], 3.5, 0, 2 * PI); c.fill(); }
    });
  };
  const _zh = V.zhenghe;
  V.zhenghe = (c, lt, d, A) => {
    const k = grow(lt, d, 0, .4), pj = proj([800, 300, 1060, 700], 36, 126, -12, 40);
    for (const ln of GEO.sea) drawPath(c, ln.map(pj), k, { color: INK, lw: 1.5 });
    for (let i = 1; i < 6; i++) drawPath(c, [[800, 300 + i * 117], [1860, 300 + i * 117]], k, { color: INK, lw: .6, alpha: .22 });
    for (let i = 1; i < 9; i++) drawPath(c, [[800 + i * 118, 300], [800 + i * 118, 1000]], k, { color: INK, lw: .6, alpha: .22 });
    const ROUTE = [[118.8, 32.05], [121.8, 31.3], [122.6, 29.5], [120.5, 25.4], [117, 22.3], [112, 18], [110, 12], [106.5, 7], [104.3, 1.4], [101.5, 2.6], [96.5, 6.2], [88, 6.2], [80.6, 5.6], [77, 7.8], [75.8, 11.2], [70, 16], [63, 22.6], [57.5, 25.3], [56.3, 26.6], [57.6, 23.4], [55, 15.8], [48, 12.6], [45.2, 11.6], [50.5, 9.5], [47.5, 4], [45.3, 1.8], [42.6, -.9], [40.2, -3.2]];
    const PORTS = [[118.8, 32.05, '南京'], [102.25, 2.2, '满剌加'], [75.78, 11.25, '古里'], [56.3, 27.1, '忽鲁谟斯'], [40.12, -3.22, '麻林']];
    const rk = clamp((lt - .5) / (d * .7)), rp = ROUTE.map(pj);
    drawPath(c, rp, rk, { color: RED, lw: 2.6, dash: [12, 8] });
    PORTS.forEach(([a, b, n], i) => { const [x, y] = pj([a, b]), al = clamp(rk * 6 - i * 1.2); c.save(); c.globalAlpha = al; c.fillStyle = RED; c.beginPath(); c.arc(x, y, 7, 0, 2 * PI); c.fill(); c.restore(); txt(c, n, x, y - 26, '700 24px NotoSerifSC', INK, 'center', al); });
    if (rk > 0 && rk < 1) { let S2 = 0; const sg = [0]; for (let i = 1; i < rp.length; i++) { S2 += Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]); sg.push(S2); } const tg = S2 * rk; let j = 1; while (j < sg.length - 1 && sg[j] < tg) j++; const u = (tg - sg[j - 1]) / (sg[j] - sg[j - 1]), x = lerp(rp[j - 1][0], rp[j][0], u), y = lerp(rp[j - 1][1], rp[j][1], u);
      c.save(); c.translate(x, y); c.strokeStyle = INK; c.lineWidth = 2; c.fillStyle = '#E9D7B4'; c.beginPath(); c.moveTo(-34, -4); c.quadraticCurveTo(0, 16, 34, -6); c.lineTo(28, -12); c.lineTo(-30, -12); c.closePath(); c.fill(); c.stroke();
      for (let mi = 0; mi < 5; mi++) { const mx = -22 + mi * 11, h = mi === 2 ? 44 : 32; c.beginPath(); c.moveTo(mx, -12); c.lineTo(mx, -12 - h); c.stroke(); c.fillStyle = 'rgba(168,35,27,.85)'; c.fillRect(mx - 6, -10 - h, 12, h * .6); for (let b = 0; b < 3; b++) { c.beginPath(); c.moveTo(mx - 6, -6 - h + b * h * .2); c.lineTo(mx + 6, -6 - h + b * h * .2); c.stroke(); } } c.restore(); }
  };
  // 尚未取到 OSM 城墙数据时沿用示意轮廓
  if (window.WALLGEO) { const _wm = V.wallmap; V.wallmap = (c, lt, d, A) => {
    const k = grow(lt, d, .05, .85), G = window.WALLGEO, pj = proj([1010, 150, 820, 863], G.bbox[0], G.bbox[2], G.bbox[1], G.bbox[3]);
    for (const lk of G.lakes) { fillPath(c, lk.map(pj), 'rgba(90,110,120,.22)', clamp(k * 3)); drawPath(c, lk.map(pj), clamp(k * 3), { color: INK, lw: 1.2 }); }
    for (const rv of G.rivers) drawPath(c, rv.map(pj), clamp(k * 3), { color: INK, lw: 1.6, alpha: .7 });
    for (const w of G.walls) drawPath(c, w.map(pj), k, { color: RED, lw: 4.5 });
    label(c, 'XUANWU LAKE', ...pj(G.labels.lake), A, clamp(k * 3 - 1));
    txt(c, `${(35.3 * k).toFixed(1)} KM`, 820, 900, '700 48px Cinzel', RED, 'center', clamp(lt / .4), 4); label(c, 'MING CITY WALL · OPENSTREETMAP', 820, 950, A, clamp(lt / .4), 'center');
  }; }
  V._swallow = V._swallow || ((c, x, y, s, f) => { c.save(); c.translate(x, y); c.rotate(-.3); c.scale(s, s); c.fillStyle = '#221C17'; c.beginPath(); c.moveTo(18, 0); c.quadraticCurveTo(4, -4, -10, -2); c.lineTo(-28, -10); c.lineTo(-14, 0); c.lineTo(-28, 10); c.lineTo(-10, 2); c.quadraticCurveTo(4, 4, 18, 0); c.fill(); c.beginPath(); c.moveTo(4, -1); c.quadraticCurveTo(-2, -24 * f, -22, -36 * f); c.quadraticCurveTo(-6, -14 * f, -6, 0); c.fill(); c.restore(); });
})();
