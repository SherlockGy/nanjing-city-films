/* 每个镜头的画面。签名 (c, lt, d, A)：lt 镜头内时间，d 镜头时长，A = { dark, ink, red, gold, L } */
(function (root) {
  const L = LIB, { PI, clamp, lerp, eio, eout, rnd, camera, box, prism, hipRoof, moveMesh, rotMesh, drawMesh, grid, line3, q, arc, cat, drawPath, fillPath, dust, flame, sparks, ingotPath } = L;
  const GOLD = '#E9C978', GOLDA = 'rgba(233,201,120,A)', INK = '#2A221B', RED = '#A8231B';
  const wave = (x0, x1, y, amp, len, ph = 0, n = 80) => Array.from({ length: n + 1 }, (_, i) => { const x = x0 + (x1 - x0) * i / n; return [x, y + Math.sin(x / len * 2 * PI + ph) * amp]; });
  const grow = (lt, d, a = .05, b = .7) => eio((lt / d - a) / (b - a));
  const txt = (c, s, x, y, font, color, align = 'center', alpha = 1, ls = 0) => { c.save(); c.globalAlpha = alpha; c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; if (ls) c.letterSpacing = ls + 'px'; c.fillText(s, x, y); c.restore(); };
  const label = (c, s, x, y, A, alpha = 1, align = 'left') => txt(c, s, x, y, '600 16px Cinzel', A.dark ? 'rgba(233,224,204,.75)' : 'rgba(42,34,27,.75)', align, alpha, 5);
  function swallow(c, x, y, s, flap, color = '#221C17', rot = -.3) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.fillStyle = color;
    c.beginPath(); c.moveTo(18, 0); c.quadraticCurveTo(4, -4, -10, -2); c.lineTo(-28, -10); c.lineTo(-14, 0); c.lineTo(-28, 10); c.lineTo(-10, 2); c.quadraticCurveTo(4, 4, 18, 0); c.fill();
    c.beginPath(); c.moveTo(4, -1); c.quadraticCurveTo(-2, -24 * flap, -22, -36 * flap); c.quadraticCurveTo(-6, -14 * flap, -6, 0); c.fill();
    c.beginPath(); c.moveTo(4, 1); c.quadraticCurveTo(-2, 18 * flap + 6, -18, 26 * flap + 8); c.quadraticCurveTo(-6, 12, -6, 0); c.fill(); c.restore();
  }
  // 宝塔网格
  function pagoda(cx, cz, tiers, r0, th, opt = {}) {
    let m = [], y = 0, r = r0;
    for (let i = 0; i < tiers; i++) {
      m = m.concat(prism(cx, cz, r, y, y + th, opt.n || 8, PI / 8, r, opt.body));
      m = m.concat(prism(cx, cz, r * 1.55, y + th, y + th + th * .28, opt.n || 8, PI / 8, r * 1.05, opt.roof));
      y += th * 1.28; r *= opt.taper || .9;
    }
    m = m.concat(prism(cx, cz, r * .35, y, y + th * 1.6, 6, 0, r * .05, opt.roof));
    return m;
  }
  function hall(cx, cz, w, d, h, opt = {}) {
    let m = box(cx - w / 2 - 30, 0, cz - d / 2 - 30, w + 60, 40, d + 60, opt.base);
    const n = opt.cols || 8;
    for (let i = 0; i < n; i++) { const x = cx - w / 2 + 12 + i * (w - 24) / (n - 1); m = m.concat(box(x - 9, 40, cz - d / 2 + 6, 18, h, 18, opt.col)); m = m.concat(box(x - 9, 40, cz + d / 2 - 24, 18, h, 18, opt.col)); }
    m = m.concat(box(cx - w / 2 + 30, 40, cz - d / 2 + 30, w - 60, h, d - 60, opt.wall));
    m = m.concat(hipRoof(cx, cz, w + 120, d + 110, 40 + h, h * .75, opt.roof));
    return m;
  }

  // 南京明城墙（示意轮廓，北在上）
  const WALL = [[180, 30], [262, 42], [318, 92], [352, 150], [418, 172], [468, 232], [490, 300], [470, 362], [482, 424], [458, 484], [418, 540], [360, 582], [300, 600], [250, 612], [198, 596], [150, 560], [112, 520], [92, 462], [70, 402], [62, 332], [82, 270], [62, 210], [82, 150], [122, 90], [180, 30]];
  // 郑和航线示意海岸线（经度, 纬度）
  const COAST = [[122.5, 37.4], [120.3, 36], [119.2, 34.6], [121, 32], [121.9, 30.9], [122, 29.9], [121, 28], [119.5, 26], [118, 24.5], [116.5, 23.3], [114, 22.3], [110.5, 21], [108, 21.5], [106.7, 20], [105.8, 18.9], [106.4, 17.5], [108.7, 15.2], [109.2, 12.5], [107, 10.4], [105, 8.6], [104.7, 10.4], [103.5, 10.5], [102.3, 12.2], [100.9, 13.4], [100, 12.5], [99.2, 10], [100.4, 7.2], [101.3, 6.9], [102.6, 6], [103.4, 4.4], [103.4, 2.5], [104.2, 1.4], [103.4, 1.3], [101.4, 2.8], [100.4, 4.6], [100.3, 6.4], [98.3, 8], [98.5, 10], [97.6, 16.5], [94.8, 16], [94.3, 18.9], [92.3, 20.7], [91.8, 22.4], [89, 21.8], [86.9, 20.8], [85, 19.4], [82.3, 16.6], [80.3, 15.5], [80.1, 13], [79.8, 10.3], [78, 8.9], [77.3, 8.1], [76.3, 9.5], [75, 12.5], [73.7, 16], [72.8, 19], [72.9, 21.1], [70, 22.5], [68.4, 23.6], [66.6, 25.4], [61.6, 25.2], [58.5, 25.6], [57, 27], [56.3, 26.2], [56.4, 24.6], [58.6, 23.6], [59.8, 22.5], [58.5, 20.5], [57.8, 19], [56.6, 18.6], [55, 17], [52.2, 15.6], [48.7, 14], [45, 12.8], [43.5, 12.7], [43.3, 11.8], [44, 10.4], [51.2, 11.8], [51, 10.4], [49.8, 7.5], [47.9, 4.5], [45.3, 2], [42.5, -.6], [40.9, -2.2], [39.7, -4], [39.2, -6.8], [39.5, -10], [40.5, -12]];
  const LANKA = [[79.9, 9.8], [81.2, 8.5], [81.8, 7.2], [81.3, 6.2], [80.1, 6], [79.8, 7.5], [79.9, 9.8]];
  const SUMATRA = [[95.3, 5.6], [97.5, 5.2], [100.4, 2.2], [104, -1], [106, -3], [105.8, -5.8], [104.5, -5.6], [102.3, -4], [100.3, -.8], [98.7, 1.7], [95.3, 5.6]];
  const ROUTE = [[118.8, 32.05], [120.5, 31.8], [121.8, 31.2], [122.3, 29.5], [120.5, 25.5], [117, 22.5], [112, 18], [110, 12], [106, 7], [103.8, 2], [100.5, 3.5], [96.5, 6.2], [88, 6.2], [80.5, 5.6], [77, 8], [75.8, 11.2], [70, 16], [63, 22.5], [57.5, 25.2], [56.3, 26.6], [57.5, 23], [55, 15.5], [48, 12.5], [45.2, 11.2], [50, 9], [47, 3], [45.3, 2], [42.5, -.8], [40.1, -3.2]];
  const PORTS = [[118.8, 32.05, '南京'], [102.2, 2.2, '满剌加'], [75.8, 11.25, '古里'], [56.3, 27.1, '忽鲁谟斯'], [40.1, -3.2, '麻林']];

  const V = {
    ingot(c, lt, d, A) {
      for (let i = 0; i < 6; i++) drawPath(c, wave(820, 1820, 760 + i * 42, 6 + i, 260 + i * 40, i), clamp(lt / 1.3 - i * .08), { color: `rgba(233,201,120,${.32 - i * .04})`, lw: 1.2 });
      const k = eio(lt / (d * .8)), y = lerp(380, 700, k);
      const g = c.createRadialGradient(1320, y, 0, 1320, y, 260); g.addColorStop(0, 'rgba(255,200,100,.35)'); g.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = g; c.fillRect(1000, y - 300, 640, 600);
      drawPath(c, ingotPath(1320, y, 1.7), clamp(lt / .9), { color: '#F6D98A', lw: 3, glow: 'rgba(255,200,90,.95)', blur: 24, fill: 'rgba(233,180,70,.3)' });
      sparks(c, 1320, y, lt, 26, 220);
    },
    wangqi(c, lt, d, A) {
      const k = grow(lt, d, 0, .6);
      const ridge = (y0, amp, ph, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, x = 700 + 1180 * t; const h = Math.sin(t * PI) * .7 + .3 * Math.sin(t * 7.3 + ph) * Math.sin(t * PI) + .12 * Math.sin(t * 23 + ph * 2) + .05 * Math.sin(t * 61 + ph); return [x, y0 - h * amp]; });
      for (let j = 3; j >= 0; j--) drawPath(c, ridge(860 - j * 50, 330 - j * 60, j * 1.7, 220), clamp(k * 1.25 - j * .12), { color: `rgba(233,201,120,${.95 - j * .2})`, lw: 2.4 - j * .4, glow: j === 0 ? 'rgba(255,200,90,.8)' : null, blur: 14 });
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) { const x = 820 + rnd(i, 3) * 1000, h = 300 + rnd(i, 4) * 400, a = clamp(lt / d * 2 - rnd(i, 5)) * (.2 + .14 * Math.sin(lt * 3 + i));
        const g = c.createLinearGradient(x, 700, x, 700 - h); g.addColorStop(0, `rgba(255,200,110,${a})`); g.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g; c.fillRect(x - 2, 700 - h, 4, h); }
      c.restore();
    },
    burst(c, lt, d, A) {
      drawPath(c, [[300, 820], [1620, 820]], 1, { color: 'rgba(233,201,120,.5)', lw: 1.4 });
      const k = eout(lt / (d * .5));
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(960, 820, 960, 820 - 900 * k); g.addColorStop(0, 'rgba(255,215,130,.9)'); g.addColorStop(1, 'rgba(255,215,130,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(960 - 14 - 60 * k, 820); c.lineTo(960 - 3, 820 - 900 * k); c.lineTo(960 + 3, 820 - 900 * k); c.lineTo(960 + 14 + 60 * k, 820); c.fill();
      c.restore();
      L.rays(c, 960, 820, 64, 30, 900 * k, GOLD, .25 * k, lt * .05);
      drawPath(c, ingotPath(960, 860, 1.1), 1, { color: '#F6D98A', lw: 2.5, glow: 'rgba(255,200,90,.95)', blur: 30 });
      sparks(c, 960, 820, lt, 60, 600, 9);
    },
    title(c, lt, d, A) {
      c.save(); c.translate(960, 500);
      for (let i = 0; i < 5; i++) {
        const r = 300 + i * 70, a = .35 - i * .05; c.strokeStyle = `rgba(233,201,120,${a})`; c.lineWidth = 1;
        c.beginPath(); c.arc(0, 0, r, 0, 2 * PI * clamp(lt / 1.5 - i * .1)); c.stroke();
        c.save(); c.rotate(lt * .06 * (i % 2 ? -1 : 1)); for (let j = 0; j < 72; j++) { const aa = j / 72 * 2 * PI; c.beginPath(); c.moveTo(Math.cos(aa) * r, Math.sin(aa) * r); c.lineTo(Math.cos(aa) * (r - (j % 6 ? 6 : 16)), Math.sin(aa) * (r - (j % 6 ? 6 : 16))); c.stroke(); } c.restore();
      }
      c.restore();
      flame(c, 960, 860, .8, lt, clamp(lt / .8));
      sparks(c, 960, 840, lt, 40, 300);
    },
    zhuge(c, lt, d, A) {
      const k = grow(lt, d, 0, .65);
      const dragon = Array.from({ length: 161 }, (_, i) => { const t = i / 160, x = 160 + t * 860; return [x, 760 - Math.sin(t * PI) * 170 - Math.sin(t * PI * 5) * 40 * Math.sin(t * PI)]; });
      drawPath(c, dragon, k, { color: INK, lw: 2.4 });
      for (let i = 4; i < 156; i += 6) { if (i / 160 > k) break; const [x, y] = dragon[i]; drawPath(c, [[x, y + 6], [x + 10, y + 26 + (i % 12 ? 0 : 14)]], 1, { color: INK, lw: 1.2, alpha: .7 }); }
      drawPath(c, dragon.map(([x, y]) => [x, y + 60]), k, { color: INK, lw: 1, alpha: .35 });
      const cliff = [[1120, 840], [1140, 640], [1210, 560], [1300, 520], [1420, 540], [1500, 600], [1560, 700], [1600, 840]];
      drawPath(c, cliff, k, { color: INK, lw: 2.4 });
      for (let i = 0; i < 9; i++) drawPath(c, [[1170 + i * 45, 840], [1180 + i * 40, 650 + (i % 3) * 30]], clamp(k * 1.5 - .4), { color: INK, lw: 1, alpha: .5 });
      drawPath(c, L.cat([[1230, 560]], ...Array.from({ length: 9 }, (_, i) => [[1240 + i * 30, 548], [1240 + i * 30, 532], [1256 + i * 30, 532], [1256 + i * 30, 548]]), [[1520, 548]]), clamp(k * 1.4 - .3), { color: INK, lw: 1.6 });
      for (let i = 0; i < 4; i++) drawPath(c, wave(140, 1760, 880 + i * 34, 5, 120 + i * 30, i), clamp(k * 1.4 - .2 - i * .08), { color: INK, lw: 1.2, alpha: .6 - i * .1 });
      label(c, '钟山 · ZHONGSHAN', 520, 520, A, clamp(k * 2 - 1)); label(c, '石头城 · STONE CITY', 1240, 470, A, clamp(k * 2 - 1));
    },
    jianye(c, lt, d, A) {
      const P = camera({ yaw: -.62 + lt * .05, pitch: .42, dist: 2000, f: 1550, cx: 1260, cy: 680 });
      grid(c, P, 1000, 100, INK, .12);
      let m = [];
      const W = 900, T2 = 56, HH = 130;
      for (const [x, z, w, dd] of [[-W / 2, -W / 2, W, T2], [-W / 2, W / 2 - T2, W, T2], [-W / 2, -W / 2, T2, W], [W / 2 - T2, -W / 2, T2, W]]) m = m.concat(box(x, 0, z, w, HH, dd));
      for (const [x, z] of [[-W / 2, -W / 2], [W / 2 - 80, -W / 2], [-W / 2, W / 2 - 80], [W / 2 - 80, W / 2 - 80]]) m = m.concat(box(x - 12, 0, z - 12, 104, HH + 40, 104));
      for (const [x, z] of [[-60, -W / 2 - 14], [-60, W / 2 - 70]]) { m = m.concat(box(x, HH, z, 120, 70, 84)); m = m.concat(hipRoof(x + 60, z + 42, 200, 140, HH + 70, 60)); }
      m = m.concat(hall(0, 40, 340, 180, 110, { cols: 7 }));
      drawMesh(c, m, P, { k: grow(lt, d, 0, .75) });
    },
    migrate(c, lt, d, A) {
      const k = grow(lt, d, 0, .55);
      const yellow = L.cat(q([860, 360], [1000, 250], [1120, 300], 20), q([1120, 300], [1180, 200], [1260, 240], 16), q([1260, 240], [1300, 380], [1420, 330], 16), q([1420, 330], [1560, 280], [1700, 300], 16));
      const yangtze = L.cat(q([860, 700], [1000, 640], [1150, 690], 20), q([1150, 690], [1300, 740], [1450, 680], 20), q([1450, 680], [1600, 640], [1760, 690], 20));
      drawPath(c, yellow, k, { color: INK, lw: 2.2 }); drawPath(c, yangtze, k, { color: INK, lw: 2.6 });
      label(c, 'YELLOW RIVER', 1500, 250, A, clamp(k * 2 - 1)); label(c, 'YANGTZE', 1560, 615, A, clamp(k * 2 - 1));
      const cities = [[1010, 370, '长安'], [1250, 330, '洛阳'], [1590, 660, '建康']];
      cities.forEach(([x, y, n], i) => { const a = clamp(k * 2 - .4 - i * .2); c.save(); c.globalAlpha = a; c.fillStyle = i === 2 ? RED : INK; c.beginPath(); c.arc(x, y, i === 2 ? 11 : 7, 0, 2 * PI); c.fill(); c.restore(); txt(c, n, x, y - 30, '700 30px NotoSerifSC', i === 2 ? RED : INK, 'center', a); });
      for (let i = 0; i < 6; i++) {
        const sx = 960 + i * 80, sy = 330 + (i % 2) * 40, path = q([sx, sy], [sx + 250 - i * 20, 560 + i * 10], [1580, 650], 30);
        const kk = clamp((lt - .5 - i * .12) / (d * .5));
        drawPath(c, path, kk, { color: RED, lw: 2, dash: [10, 8] });
        if (kk > 0) { for (let j = 0; j < 3; j++) { const u = ((lt * .4 + j / 3 + i * .1) % 1) * kk, p = path[Math.floor(u * (path.length - 1))]; c.fillStyle = RED; c.beginPath(); c.arc(p[0], p[1], 3.5, 0, 2 * PI); c.fill(); } }
      }
    },
    wuyi(c, lt, d, A) {
      const k = grow(lt, d, 0, .6);
      const roof = L.cat(q([980, 470], [1040, 500], [1120, 500], 10), [[1640, 500]], q([1640, 500], [1720, 500], [1780, 460], 10));
      drawPath(c, roof, k, { color: INK, lw: 2.6 });
      drawPath(c, [[1060, 498], [1180, 380], [1580, 380], [1700, 498]], k, { color: INK, lw: 2 });
      for (let i = 0; i < 30; i++) drawPath(c, [[1110 + i * 16, 498], [1190 + i * 13, 384]], clamp(k * 1.5 - .3 - i * .01), { color: INK, lw: 1, alpha: .6 });
      drawPath(c, [[1120, 500], [1120, 880], [1660, 880], [1660, 500]], clamp(k * 1.3 - .2), { color: INK, lw: 2 });
      drawPath(c, arc(1390, 690, 110, 110, 0, 2 * PI, 60), clamp(k * 1.4 - .4), { color: INK, lw: 2 });
      fillPath(c, [[1120, 500], [1120, 880], [1660, 880], [1660, 500]], '#EFE6D2', clamp(k * 2 - 1) * .5);
      for (let i = 0; i < 3; i++) { const u = clamp((lt - .4 - i * .3) / (d * .8)); if (u <= 0) continue; swallow(c, lerp(880, 1700, u) + i * 40, 300 + Math.sin(u * 6 + i) * 40 - u * 80 + i * 30, 1.3 - i * .2, Math.sin(lt * 14 + i)); }
    },
    pi(c, lt, d, A) {
      const cx = 1340, cy = 650, R = 250, k = grow(lt, d, 0, .3);
      drawPath(c, arc(cx, cy, R, R, -PI / 2, 1.5 * PI, 120), k, { color: INK, lw: 2.2 });
      const m = Math.min(12, Math.floor(clamp((lt - .5) / (d * .6)) * 12)), n = 6 * Math.pow(2, m);
      const pts = Array.from({ length: Math.min(n, 400) + 1 }, (_, i) => { const a = -PI / 2 + 2 * PI * i / Math.min(n, 400); return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
      if (lt > .5) drawPath(c, n <= 400 ? pts : pts, 1, { color: RED, lw: 1.8 });
      drawPath(c, [[cx, cy], [cx + R, cy]], k, { color: INK, lw: 1.2 }); c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 4, 0, 2 * PI); c.fill();
      txt(c, `n = ${n.toLocaleString('en')}`, cx, cy + R + 60, '600 26px Cinzel', INK, 'center', clamp(lt / .6), 4);
      txt(c, 'r', cx + R / 2, cy - 18, 'italic 600 26px Cinzel', INK, 'center', k);
      txt(c, '355 / 113', cx + R + 120, cy - R + 40, '700 30px Cinzel', RED, 'center', clamp((lt - 1.2) / .5), 3);
    },
    wenxin(c, lt, d, A) {
      const k = grow(lt, d, 0, .6), cx = 1300, cy = 650;
      const lp = L.cat(q([cx, 520], [cx - 220, 460], [cx - 440, 510], 20), [[cx - 440, 820]], q([cx - 440, 820], [cx - 220, 780], [cx, 850], 20), [[cx, 520]]);
      const rp = lp.map(([x, y]) => [2 * cx - x, y]);
      drawPath(c, lp, k, { color: INK, lw: 2.2, fill: '#EDE2C8' }); drawPath(c, rp, k, { color: INK, lw: 2.2, fill: '#EDE2C8' });
      for (let i = 0; i < 8; i++) { const y = 560 + i * 30; drawPath(c, q([cx - 400, y], [cx - 220, y - 36], [cx - 30, y + 14], 10), clamp(k * 1.6 - .5 - i * .04), { color: INK, lw: 1.2, alpha: .55 }); drawPath(c, q([cx + 30, y + 14], [cx + 220, y - 36], [cx + 400, y], 10), clamp(k * 1.6 - .6 - i * .04), { color: INK, lw: 1.2, alpha: .55 }); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI + lt * .2; const sp = Array.from({ length: 40 }, (_, j) => { const t = j / 39, r = 26 * (1 - t); return [cx + Math.cos(a) * 330 + Math.cos(t * 9 + a) * r, cy - 250 + Math.sin(a) * 60 + Math.sin(t * 9 + a) * r]; }); drawPath(c, sp, clamp(k * 1.5 - .4), { color: RED, lw: 1.6, alpha: .8 }); }
    },
    temples(c, lt, d, A) {
      const P = camera({ yaw: -.25, pitch: .2, dist: 2400, f: 1700, cx: 1250, cy: 760, tz: lt * 40 });
      let m = [];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { const x = -1100 + i * 520 + (r % 2) * 260, z = r * 700 - 200; m = m.concat(pagoda(x, z, 5 - (i + r) % 2, 50, 60, { n: 6, taper: .86 })); }
      grid(c, P, 2000, 200, INK, .1);
      drawMesh(c, m, P, { k: grow(lt, d, 0, .8), lw: 1.2 });
      c.save(); c.strokeStyle = 'rgba(42,34,27,.22)'; c.lineWidth = 1;
      for (let i = 0; i < 160; i++) { const x = (rnd(i, 1) * 2100 + lt * 300) % 2100 - 100, y = (rnd(i, 2) * 1200 + lt * 900) % 1200 - 100; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10, y + 40); c.stroke(); }
      c.restore();
    },
    fall(c, lt, d, A) {
      const P = camera({ yaw: .55, pitch: .28, dist: 1400, f: 1800, cx: 1180, cy: 820 });
      grid(c, P, 900, 100, INK, .1);
      const m = hall(0, 0, 560, 280, 150, { cols: 8 }).concat(hipRoof(0, 0, 380, 200, 300, 90));
      const t0 = d * .4;
      const mm = m.map((f, i) => { const tt = Math.max(0, lt - t0 - rnd(i, 3) * .6); const dy = -tt * tt * 900, rx = (rnd(i, 4) - .5) * tt * 200; return { ...f, p: f.p.map(([x, y, z]) => [x + rx, Math.max(-5, y + dy * (y > 40 ? 1 : .2)), z]) }; });
      drawMesh(c, mm, P, { k: grow(lt, d, 0, .35), alpha: 1 - clamp((lt - t0 - .4) / 1.2) * .7 });
      if (lt > t0) { c.save(); for (let i = 0; i < 80; i++) { const u = clamp((lt - t0) / 1.6), x = 1180 + (rnd(i, 1) - .5) * 900 * (.3 + u), y = 820 - rnd(i, 2) * 240 * u + u * 60; c.fillStyle = `rgba(90,70,50,${.4 * (1 - u)})`; c.beginPath(); c.arc(x, y, 2 + rnd(i, 3) * 5, 0, 2 * PI); c.fill(); } c.restore(); }
    },
    poet(c, lt, d, A) {
      const k = grow(lt, d, 0, .5);
      const house = [[1380, 860], [1380, 700], [1500, 610], [1620, 700], [1620, 860]];
      drawPath(c, house, k, { color: INK, lw: 2.2 }); drawPath(c, [[1340, 720], [1500, 590], [1660, 720]], k, { color: INK, lw: 2.4 });
      drawPath(c, [[1470, 860], [1470, 770], [1530, 770], [1530, 860]], clamp(k * 1.4 - .3), { color: INK, lw: 1.6 });
      for (let i = 0; i < 5; i++) drawPath(c, wave(1200, 1800, 870 + i * 6, 2, 40, i), clamp(k * 1.4 - .3), { color: INK, lw: 1, alpha: .4 });
      const roof = L.cat(q([700, 430], [760, 470], [860, 470], 10), [[1000, 470]], q([1000, 470], [1060, 470], [1100, 440], 8));
      drawPath(c, roof, k, { color: INK, lw: 2.2, alpha: .7 }); drawPath(c, [[760, 468], [820, 400], [1000, 400], [1060, 468]], k, { color: INK, lw: 1.6, alpha: .7 });
      const u = clamp((lt - .6) / (d * .75)); const x = lerp(900, 1480, eio(u)), y = lerp(430, 600, eio(u)) - Math.sin(u * PI) * 160;
      if (u > 0 && u < 1) swallow(c, x, y, 1.5, Math.sin(lt * 14), '#221C17', .2 + u * .3);
      const chs = [...'飞入寻常百姓家'];
      chs.forEach((ch, i) => txt(c, ch, 1760, 300 + i * 66, '52px MaShanZheng', INK, 'center', clamp((lt - .8 - i * .12) / .4)));
    },
    river(c, lt, d, A) {
      const k = grow(lt, d, 0, .5);
      drawPath(c, arc(1440, 360, 130, 130, -PI / 2, 1.5 * PI, 80), k, { color: INK, lw: 2, fill: 'rgba(240,232,210,.8)' });
      drawPath(c, L.cat(q([700, 640], [900, 560], [1080, 620], 16), q([1080, 620], [1300, 680], [1500, 600], 16), q([1500, 600], [1650, 560], [1840, 620], 16)), k, { color: INK, lw: 1.6, alpha: .5 });
      for (let i = 0; i < 9; i++) drawPath(c, wave(640, 1880, 700 + i * 34, 4 + i * .6, 140 + i * 18, -lt * (2 + i * .2)), clamp(k * 1.3 - i * .05), { color: INK, lw: 1.3, alpha: .75 - i * .06 });
      const bx = 900 + lt * 60, by = 760;
      drawPath(c, L.cat(q([bx - 70, by], [bx, by + 30], [bx + 70, by], 10), [[bx - 70, by]]), clamp(k * 2 - .6), { color: INK, lw: 2 }); drawPath(c, [[bx, by], [bx, by - 80]], clamp(k * 2 - .7), { color: INK, lw: 1.6 });
      label(c, '→ EAST', 1700, 960, A, k);
    },
    ming(c, lt, d, A) {
      const P = camera({ yaw: -.4 + lt * .035, pitch: .18, dist: 2100, f: 1800, cx: 1250, cy: 760 });
      grid(c, P, 1200, 100, INK, .1);
      let m = box(-560, 0, -130, 1120, 230, 260);
      m = m.concat(hall(0, 0, 640, 170, 110, { cols: 9 }).map(f => ({ ...f, p: f.p.map(([x, y, z]) => [x, y + 230, z]) })));
      m = m.concat(hipRoof(0, 0, 560, 170, 230 + 40 + 110 + 82, 70, '#C9B48E'));
      drawMesh(c, m, P, { k: grow(lt, d, 0, .7) });
      const kk = clamp((grow(lt, d, 0, .7) - .4) / .4);
      for (const x of [-300, -150, 0, 150, 300]) line3(c, P, L.cat([[x - 45, 0, -121]], arc(0, 0, 45, 45, PI, 0, 16).map(([u, v]) => [x + u, 130 - v, -121]), [[x + 45, 0, -121]]), kk, { color: INK, lw: 1.6 });
    },
    wallmap(c, lt, d, A) {
      const ox = 1080, oy = 300, s = 1.15, k = grow(lt, d, .05, .85);
      const tr = ([x, y]) => [ox + x * s, oy + y * s];
      fillPath(c, arc(560, 90, 70, 52, 0, 2 * PI, 40).map(tr), 'rgba(90,110,120,.25)', clamp(k * 3)); drawPath(c, arc(560, 90, 70, 52, 0, 2 * PI, 40).map(tr), clamp(k * 3), { color: INK, lw: 1.2 });
      label(c, 'XUANWU LAKE', ox + 560 * s, oy + 20, A, clamp(k * 3 - 1), 'center');
      drawPath(c, [[-80, 220], [60, 40], [160, -60]].map(tr), clamp(k * 3), { color: INK, lw: 1.4 }); drawPath(c, [[-110, 230], [30, 50], [130, -60]].map(tr), clamp(k * 3), { color: INK, lw: 1.4 });
      label(c, 'YANGTZE', ox - 40, oy + 80, A, clamp(k * 3 - 1));
      for (let i = 0; i < 3; i++) drawPath(c, [[600 + i * 50, 320], [630 + i * 50, 260], [660 + i * 50, 320]].map(tr), clamp(k * 3 - 1), { color: INK, lw: 1.4 });
      label(c, 'PURPLE MOUNTAIN', ox + 600 * s, oy + 400, A, clamp(k * 3 - 1));
      drawPath(c, wave(130, 440, 520, 14, 90, 1).map(tr), clamp(k * 3 - .5), { color: INK, lw: 1.2, alpha: .6 });
      drawPath(c, WALL.map(tr), k, { color: RED, lw: 4.5 });
      WALL.forEach((p, i) => { if (i % 2 || i / WALL.length > k) return; const [x, y] = tr(p); c.fillStyle = INK; c.beginPath(); c.arc(x, y, 5, 0, 2 * PI); c.fill(); });
      txt(c, `${(35.3 * k).toFixed(1)} KM`, ox + 250 * s, oy + 330 * s, '700 44px Cinzel', RED, 'center', clamp(lt / .4), 4);
    },
    bricks(c, lt, d, A) {
      const P = camera({ yaw: .5, pitch: .16, dist: 1400, f: 1600, cx: 1180, cy: 900 });
      let m = [];
      for (let r = 0; r < 6; r++) for (let i = 0; i < 6; i++) { if (r === 3 && i === 2) continue; m = m.concat(box(-420 + i * 142 + (r % 2) * 71, r * 62, 0, 136, 56, 70)); }
      const out = eout(clamp((lt - .6) / .7)) * 160;
      m = m.concat(box(-420 + 2 * 142 + 71, 3 * 62, -out, 136, 56, 70, '#E9D7B4'));
      drawMesh(c, m, P, { k: grow(lt, d, 0, .5) });
      const a = clamp((lt - 1.1) / .5); if (a > 0) {
        const p = P([-420 + 2 * 142 + 71 + 68, 3 * 62 + 28, -out]);
        c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(244,236,218,.92)'; c.strokeStyle = INK; c.lineWidth = 1.5; const bx = Math.min(1480, p[0] + 260), by = 470; c.beginPath(); c.roundRect(bx, by, 380, 170, 6); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(p[0] + 10, p[1] - 10); c.lineTo(bx, by + 120); c.stroke();
        txt(c, '袁州府 宜春县', bx + 190, by + 40, '700 30px WenKai', RED, 'center'); txt(c, '总甲 ××  甲首 ××', bx + 190, by + 85, '28px WenKai', INK, 'center'); txt(c, '窑匠 ×××  造砖人夫 ×××', bx + 190, by + 128, '28px WenKai', INK, 'center');
        c.restore();
      }
    },
    zhenghe(c, lt, d, A) {
      const X = lon => 800 + (lon - 36) / 90 * 1060, Y = lat => 330 + (40 - lat) / 54 * 680, tr = ([a, b]) => [X(a), Y(b)];
      const k = grow(lt, d, 0, .4);
      drawPath(c, COAST.map(tr), k, { color: INK, lw: 1.8 }); drawPath(c, LANKA.map(tr), k, { color: INK, lw: 1.6 }); drawPath(c, SUMATRA.map(tr), k, { color: INK, lw: 1.6 });
      for (let i = 1; i < 6; i++) drawPath(c, [[800, 330 + i * 120], [1860, 330 + i * 120]], k, { color: INK, lw: .6, alpha: .25 });
      for (let i = 1; i < 9; i++) drawPath(c, [[800 + i * 120, 330], [800 + i * 120, 1010]], k, { color: INK, lw: .6, alpha: .25 });
      const rk = clamp((lt - .5) / (d * .7)), rp = ROUTE.map(tr);
      drawPath(c, rp, rk, { color: RED, lw: 2.6, dash: [12, 8] });
      PORTS.forEach(([a, b, n], i) => { const [x, y] = tr([a, b]); const al = clamp(rk * 6 - i * 1.2); c.save(); c.globalAlpha = al; c.fillStyle = RED; c.beginPath(); c.arc(x, y, 7, 0, 2 * PI); c.fill(); c.restore(); txt(c, n, x + (i === 0 ? 0 : 0), y - 26, '700 24px NotoSerifSC', INK, 'center', al); });
      if (rk > 0 && rk < 1) { let Lsum = 0; const seg = [0]; for (let i = 1; i < rp.length; i++) { Lsum += Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]); seg.push(Lsum); } const tgt = Lsum * rk; let j = 1; while (j < seg.length - 1 && seg[j] < tgt) j++; const u = (tgt - seg[j - 1]) / (seg[j] - seg[j - 1]); const x = lerp(rp[j - 1][0], rp[j][0], u), y = lerp(rp[j - 1][1], rp[j][1], u);
        c.save(); c.translate(x, y); c.strokeStyle = INK; c.fillStyle = '#E9D7B4'; c.lineWidth = 2; c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(0, 14, 26, 0); c.closePath(); c.fill(); c.stroke();
        for (const mx of [-12, 0, 12]) { c.beginPath(); c.moveTo(mx, 0); c.lineTo(mx, -30); c.stroke(); c.fillStyle = 'rgba(168,35,27,.8)'; c.fillRect(mx - 7, -28, 14, 18); } c.restore(); }
    },
    library(c, lt, d, A) {
      const P = camera({ yaw: -.22, pitch: .1, dist: 900, f: 1000, cx: 1480, cy: 660, tz: 520 + lt * 120 });
      let m = [];
      for (let i = 0; i < 9; i++) { const z = i * 260; m = m.concat(box(-460, 0, z, 120, 520, 220)); m = m.concat(box(340, 0, z, 120, 520, 220)); }
      grid(c, P, 2400, 120, INK, .1);
      drawMesh(c, m, P, { k: grow(lt, d, 0, .55), lw: 1.3 });
      const kk = clamp((grow(lt, d, 0, .55) - .5) * 2);
      for (let i = 0; i < 9; i++) for (const sx of [-340, 340]) for (let sh = 0; sh < 5; sh++) {
        const y = 30 + sh * 100, z = i * 260; const pts = []; for (let j = 0; j < 14; j++) { const zz = z + 8 + j * 15; pts.push(P([sx, y, zz]), P([sx, y + 70 + (j % 3) * 8, zz]), null); }
        c.save(); c.strokeStyle = INK; c.globalAlpha = kk * .6; c.lineWidth = 1; c.beginPath(); for (let j = 0; j < pts.length; j += 3) { c.moveTo(pts[j][0], pts[j][1]); c.lineTo(pts[j + 1][0], pts[j + 1][1]); } c.stroke(); c.restore();
      }
    },
    tower(c, lt, d, A) {
      const P = camera({ yaw: lt * .25, pitch: .14, dist: 1900, f: 2050, cx: 1320, cy: 980 });
      const m = pagoda(0, 0, 9, 120, 70, { n: 8, taper: .92, body: '#F1EBDD', roof: '#C9D3A8' });
      grid(c, P, 700, 100, INK, .12);
      drawMesh(c, m, P, { k: grow(lt, d, 0, .7), lw: 1.3 });
      if (lt > d * .6) { c.save(); c.globalCompositeOperation = 'multiply'; c.restore(); }
    },
    exam(c, lt, d, A) {
      const P = camera({ yaw: -.28, pitch: .34, dist: 1300, f: 1400, cx: 1300, cy: 600, tz: lt * 60 });
      let m = [];
      for (let r = 0; r < 8; r++) for (let i = 0; i < 13; i++) m = m.concat(box(-380 + i * 100, 0, r * 200, 80, 90, 80));
      grid(c, P, 2000, 100, INK, .1);
      drawMesh(c, m, P, { k: grow(lt, d, 0, .6), lw: 1 });
      txt(c, Math.round(20644 * eout(clamp((lt - .3) / (d * .6)))).toLocaleString('en'), 1560, 930, '700 54px Cinzel', RED, 'center', clamp(lt / .4), 4);
      label(c, 'CELLS · 号舍', 1560, 985, A, clamp(lt / .4), 'center');
    },
    yunjin(c, lt, d, A) {
      const cx = 1300, cy = 640, k = grow(lt, d, 0, .6), rot = lt * .08;
      c.save(); c.translate(cx, cy); c.rotate(rot);
      const ring = (r, n, col, w) => drawPath(c, arc(0, 0, r, r, -PI / 2, 1.5 * PI, n), k, { color: col, lw: w });
      const petals = (n, r0, r1, wd, col, ph = 0) => { for (let i = 0; i < n; i++) { const a = ph + i / n * 2 * PI, ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(a + PI / 2), sp = Math.sin(a + PI / 2);
        const pts = L.cat(q([ca * r0, sa * r0], [ca * (r0 + r1) / 2 + cp * wd, sa * (r0 + r1) / 2 + sp * wd], [ca * r1, sa * r1], 10), q([ca * r1, sa * r1], [ca * (r0 + r1) / 2 - cp * wd, sa * (r0 + r1) / 2 - sp * wd], [ca * r0, sa * r0], 10));
        if (k > .4) fillPath(c, pts, col, clamp((k - .4) / .4)); drawPath(c, pts, clamp(k * 1.3 - i * .02), { color: INK, lw: 1.4 }); } };
      petals(16, 250, 330, 34, '#2E4C7D'); petals(12, 150, 250, 42, '#A8231B', PI / 12); petals(8, 60, 150, 36, '#C9A24E');
      ring(340, 120, INK, 2); ring(250, 100, INK, 1.4); ring(150, 80, INK, 1.4); ring(60, 50, INK, 1.4);
      if (k > .5) { c.globalAlpha = clamp((k - .5) * 2); c.fillStyle = '#3E7B67'; c.beginPath(); c.arc(0, 0, 58, 0, 2 * PI); c.fill(); c.globalAlpha = 1; }
      for (let i = 0; i < 48; i++) { const a = i / 48 * 2 * PI; drawPath(c, [[Math.cos(a) * 345, Math.sin(a) * 345], [Math.cos(a) * 372, Math.sin(a) * 372]], clamp(k * 1.5 - .5), { color: '#C9A24E', lw: 2 }); }
      c.restore();
    },
    novels(c, lt, d, A) {
      ['儒林外史', '桃花扇', '红楼梦'].forEach((t, i) => {
        const x = 1060 + i * 260, u = eout(clamp((lt - .2 - i * .35) / .6));
        if (u <= 0) return;
        const h = 560 * u;
        c.save(); c.fillStyle = '#EFE4CA'; c.strokeStyle = INK; c.lineWidth = 2; c.fillRect(x - 80, 300, 160, h); c.strokeRect(x - 80, 300, 160, h);
        c.fillStyle = '#5A4632'; c.fillRect(x - 96, 284, 192, 18); c.fillRect(x - 96, 300 + h, 192, 18);
        c.beginPath(); c.rect(x - 80, 300, 160, h); c.clip();
        [...t].forEach((ch, j) => txt(c, ch, x, 380 + j * 110, '84px MaShanZheng', INK, 'center'));
        c.fillStyle = RED; c.fillRect(x - 22, 300 + h - 80, 44, 44); txt(c, '印', x, 300 + h - 58, '30px MaShanZheng', '#F4EAD6', 'center');
        c.restore();
      });
    },
    treaty(c, lt, d, A) {
      const k = grow(lt, d, 0, .6);
      const hull = L.cat([[880, 760]], q([880, 760], [920, 860], [1060, 870], 10), [[1500, 870]], q([1500, 870], [1600, 860], [1660, 740], 10), [[880, 760]]);
      drawPath(c, hull, k, { color: INK, lw: 2.4, fill: '#E3D3B2' });
      for (let i = 0; i < 9; i++) drawPath(c, L.L ? [] : arc(980 + i * 60, 800, 9, 9, 0, 2 * PI, 12), clamp(k * 1.5 - .4), { color: INK, lw: 1.4 });
      for (const [x, h] of [[1060, 420], [1260, 470], [1460, 400]]) { drawPath(c, [[x, 760], [x, 760 - h]], k, { color: INK, lw: 2 }); for (let j = 0; j < 3; j++) { const y = 760 - h + 30 + j * (h / 3.3), w = 110 - j * 10; drawPath(c, L.cat(q([x - w, y], [x, y + 20], [x + w, y], 8), q([x + w, y], [x + w + 10, y + h / 4.5], [x + w - 10, y + h / 4], 6), q([x + w - 10, y + h / 4], [x, y + h / 4 + 24], [x - w + 10, y + h / 4], 8), q([x - w + 10, y + h / 4], [x - w - 10, y + h / 4.5], [x - w, y], 6)), clamp(k * 1.4 - .3 - j * .1), { color: INK, lw: 1.5, fill: 'rgba(240,230,205,.8)' }); } }
      c.save(); for (let i = 0; i < 6; i++) { const u = (lt * .3 + i / 6) % 1; c.fillStyle = `rgba(80,70,60,${.25 * (1 - u)})`; c.beginPath(); c.arc(1700 + u * 120, 640 - u * 260, 30 + u * 60, 0, 2 * PI); c.fill(); } c.restore();
    },
    tianjing(c, lt, d, A) {
      const k = grow(lt, d, 0, .6);
      drawPath(c, [[880, 880], [880, 560], [1720, 560], [1720, 880]], k, { color: INK, lw: 2.4, fill: '#D9C9A6' });
      drawPath(c, L.cat([[1230, 880]], arc(1300, 760, 70, 80, PI, 2 * PI, 20), [[1370, 880]]), k, { color: INK, lw: 2, fill: '#3A3028' });
      for (let i = 0; i < 14; i++) drawPath(c, [[900 + i * 60, 560], [900 + i * 60, 530], [930 + i * 60, 530], [930 + i * 60, 560]], clamp(k * 1.4 - .3), { color: INK, lw: 1.6 });
      drawPath(c, [[1120, 530], [1120, 420], [1480, 420], [1480, 530]], clamp(k * 1.3 - .2), { color: INK, lw: 2, fill: '#E6D6B4' });
      drawPath(c, L.cat(q([1060, 420], [1100, 440], [1150, 430]), [[1450, 430]], q([1450, 430], [1500, 440], [1540, 420]), [[1450, 360], [1150, 360], [1060, 420]]), clamp(k * 1.3 - .25), { color: INK, lw: 2.2, fill: '#B8A27C' });
      for (let i = 0; i < 6; i++) { const x = 960 + i * 130, ph = Math.sin(lt * 4 + i) * 8; drawPath(c, [[x, 530], [x, 400]], clamp(k * 1.5 - .5), { color: INK, lw: 2 }); if (k > .6) fillPath(c, [[x, 400], [x + 70, 420 + ph], [x, 448]], RED, clamp((k - .6) * 3)); }
    },
    republic(c, lt, d, A) {
      const k = grow(lt, d, 0, .6), x0 = 900, x1 = 1700;
      drawPath(c, [[x0, 880], [x0, 520], [x1, 520], [x1, 880]], k, { color: INK, lw: 2.4, fill: '#DCCDAE' });
      drawPath(c, [[x0 - 30, 520], [x0 - 30, 480], [x1 + 30, 480], [x1 + 30, 520]], k, { color: INK, lw: 2.2, fill: '#CDBB97' });
      drawPath(c, [[1150, 480], [1150, 400], [1450, 400], [1450, 480]], clamp(k * 1.3 - .2), { color: INK, lw: 2, fill: '#D6C6A3' });
      for (let i = 0; i < 8; i++) { const x = x0 + 40 + i * 103; drawPath(c, [[x, 880], [x, 540]], clamp(k * 1.5 - .3 - i * .03), { color: INK, lw: 3 }); drawPath(c, [[x - 14, 545], [x + 14, 545]], clamp(k * 1.5 - .3), { color: INK, lw: 2 }); }
      for (const cx of [1100, 1300, 1500]) drawPath(c, L.cat([[cx - 55, 880]], arc(cx, 720, 55, 60, PI, 2 * PI, 16), [[cx + 55, 880]]), clamp(k * 1.4 - .4), { color: INK, lw: 2, fill: '#40362C' });
      drawPath(c, [[1300, 400], [1300, 250]], clamp(k * 1.5 - .5), { color: INK, lw: 2 });
      if (k > .7) fillPath(c, [[1300, 252], [1300 + 90, 262 + Math.sin(lt * 4) * 6], [1300 + 90, 312 + Math.sin(lt * 4 + 1) * 6], [1300, 302]], RED, clamp((k - .7) * 3));
    },
    stairs(c, lt, d, A) {
      const P = camera({ yaw: -.25, pitch: .32, dist: 1700, f: 1350, cx: 1260, cy: 640, ty: 200, tz: 560 });
      let m = [];
      for (let i = 0; i < 22; i++) m = m.concat(box(-300 + i * 6, 0, i * 44, 600 - i * 12, (i + 1) * 18, 44));
      const zt = 22 * 44 + 40, yt = 22 * 18;
      m = m.concat(box(-260, yt, zt, 520, 170, 220, '#F2EEE6')).concat(hipRoof(0, zt + 110, 640, 300, yt + 170, 110, '#9DB3C9'));
      grid(c, P, 1300, 120, INK, .08);
      drawMesh(c, m, P, { k: grow(lt, d, 0, .65), lw: 1.2 });
      txt(c, String(Math.round(392 * eout(clamp((lt - .2) / (d * .6))))), 1700, 760, '700 64px Cinzel', RED, 'center', clamp(lt / .3), 2);
      label(c, 'STEPS', 1700, 815, A, clamp(lt / .3), 'center');
    },
    observatory(c, lt, d, A) {
      const P = camera({ yaw: -.4 + lt * .05, pitch: .28, dist: 1250, f: 1650, cx: 1250, cy: 880 });
      let m = box(-260, 0, -200, 520, 160, 400);
      const R = 190; for (let j = 0; j < 6; j++) { const a0 = j / 6 * PI / 2, a1 = (j + 1) / 6 * PI / 2; for (let i = 0; i < 16; i++) { const b0 = i / 16 * 2 * PI, b1 = (i + 1) / 16 * 2 * PI; const p = (a, b) => [Math.cos(b) * Math.cos(a) * R, 160 + Math.sin(a) * R, Math.sin(b) * Math.cos(a) * R]; if (i === 4 && j < 5) continue; m.push({ p: [p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1)] }); } }
      drawMesh(c, m, P, { k: grow(lt, d, 0, .6), lw: 1.2 });
      const kk = clamp((lt - .6) / (d * .5));
      const stars = Array.from({ length: 9 }, (_, i) => [900 + rnd(i, 1) * 950, 160 + rnd(i, 2) * 260]);
      stars.forEach(([x, y], i) => { c.save(); c.globalAlpha = clamp(kk * 3 - i * .2); c.fillStyle = INK; c.beginPath(); c.arc(x, y, 4, 0, 2 * PI); c.fill(); c.restore(); });
      drawPath(c, stars.slice(0, 6), kk, { color: INK, lw: 1, alpha: .6, dash: [6, 6] });
      drawPath(c, [P([60, 300, 0]), [1500, 260]], kk, { color: RED, lw: 1.5 });
    },
    candle(c, lt, d, A) {
      const a = clamp(lt / 1.5);
      c.save(); c.globalAlpha = a; c.strokeStyle = 'rgba(236,230,214,.85)'; c.lineWidth = 2.5; c.strokeRect(930, 740, 60, 230); c.beginPath(); c.moveTo(960, 740); c.lineTo(960, 722); c.stroke(); c.restore();
      flame(c, 960, 724, .6, lt, a);
    },
    dove(c, lt, d, A) {
      const k = grow(lt, d, 0, .6);
      for (let i = 0; i < 14; i++) { const ang = i / 14 * 2 * PI; drawPath(c, L.cat(q([560, 860], [560 + Math.cos(ang) * 60, 860 + Math.sin(ang) * 30], [560 + Math.cos(ang) * 110, 860 + Math.sin(ang) * 70], 8), q([560 + Math.cos(ang) * 110, 860 + Math.sin(ang) * 70], [560 + Math.cos(ang + .2) * 70, 860 + Math.sin(ang + .2) * 40], [560, 860], 8)), clamp(k * 1.4 - i * .03), { color: 'rgba(236,230,214,.9)', lw: 1.6 }); }
      drawPath(c, q([560, 900], [580, 980], [540, 1060], 10), k, { color: 'rgba(236,230,214,.7)', lw: 1.6 });
      const u = eout(clamp((lt - .4) / (d * .85))), x = lerp(1150, 1560, u), y = lerp(860, 560, u), f = Math.sin(lt * 6);
      c.save(); c.translate(x, y); c.rotate(-.25); c.scale(1.5, 1.5); c.strokeStyle = 'rgba(245,240,228,.95)'; c.fillStyle = 'rgba(245,240,228,.12)'; c.lineWidth = 1.6; c.shadowColor = 'rgba(255,255,255,.7)'; c.shadowBlur = 12; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(70, -14); c.quadraticCurveTo(84, -20, 92, -12); c.lineTo(102, -8); c.lineTo(90, -4); c.quadraticCurveTo(70, 18, 20, 18); c.quadraticCurveTo(-30, 18, -60, 4); c.lineTo(-104, 18); c.lineTo(-96, -4); c.lineTo(-108, -14); c.lineTo(-60, -8); c.quadraticCurveTo(-10, -20, 40, -14); c.quadraticCurveTo(60, -24, 70, -14); c.fill(); c.stroke();
      const wy = -90 * f; c.beginPath(); c.moveTo(30, -12); c.quadraticCurveTo(10, wy * .5 - 10, -40, wy - 6); c.quadraticCurveTo(-20, wy * .4, -30, -6); c.stroke();
      for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(-40 + j * 12, wy * (1 - j * .16) - 4); c.lineTo(-30 + j * 14, wy * (.5 - j * .08)); c.stroke(); }
      c.beginPath(); c.arc(80, -12, 2, 0, 2 * PI); c.stroke(); c.restore();
    },
    bridge(c, lt, d, A) {
      const P = camera({ yaw: -.7, pitch: .12, dist: 1900, f: 1400, cx: 1380, cy: 720, tx: lt * 30 });
      let m = [];
      m = m.concat(box(-300, 160, -40, 2600, 14, 80)).concat(box(-300, 260, -40, 2600, 10, 80));
      for (let i = 0; i < 4; i++) m = m.concat(box(200 + i * 600, -200, -50, 70, 360, 100));
      m = m.concat(box(-420, -200, -70, 140, 620, 140, '#EFE3CB'));
      drawMesh(c, m, P, { k: grow(lt, d, 0, .5), lw: 1.3 });
      const kk = clamp((grow(lt, d, 0, .5) - .3) / .5);
      const tr = []; for (let x = -280; x < 2280; x += 80) tr.push([x, 174, -40], [x + 40, 260, -40]);
      line3(c, P, tr, kk, { color: INK, lw: 1.4 });
      line3(c, P, tr.map(([x, y, z]) => [x, y, 40]), kk, { color: INK, lw: 1, alpha: .5 });
      for (let i = 0; i < 3; i++) { const p = P([-380 + i * 30, 420, 0]); if (kk > .5) { c.save(); c.globalAlpha = clamp((kk - .5) * 3); c.fillStyle = RED; c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[0] + 30, p[1] - 70, p[0] + 70, p[1] - 80 + Math.sin(lt * 3 + i) * 6); c.quadraticCurveTo(p[0] + 50, p[1] - 30, p[0] + 10, p[1] - 10); c.fill(); c.restore(); } }
      for (let i = 0; i < 5; i++) drawPath(c, wave(300, 1900, 900 + i * 30, 5, 140, lt * 2 + i), kk, { color: INK, lw: 1.1, alpha: .5 });
    },
    warp(c, lt, d, A) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 220; i++) { const a = rnd(i, 1) * 2 * PI, sp = .3 + rnd(i, 2), ph = (lt * sp * (.6 + lt * .4) + rnd(i, 3)) % 1; const r0 = 40 + ph * ph * 1200, r1 = r0 + 20 + ph * 160;
        c.strokeStyle = `rgba(255,${200 + rnd(i, 4) * 50 | 0},140,${ph * .8})`; c.lineWidth = .6 + ph * 2; c.beginPath(); c.moveTo(1240 + Math.cos(a) * r0, 600 + Math.sin(a) * r0 * .7); c.lineTo(1240 + Math.cos(a) * r1, 600 + Math.sin(a) * r1 * .7); c.stroke(); }
      const g = c.createRadialGradient(1240, 600, 0, 1240, 600, 260); g.addColorStop(0, 'rgba(255,210,130,.35)'); g.addColorStop(1, 'rgba(255,180,90,0)'); c.fillStyle = g; c.fillRect(900, 300, 700, 600);
      c.restore();
    },
    metro(c, lt, d, A) {
      const cx = 1380, cy = 680, k = grow(lt, d, 0, .75);
      const lines = [[[0, 0], [-240, -240], [-420, -240]], [[0, 0], [400, 0], [600, 200]], [[0, 0], [0, 380], [-200, 580]], [[0, 0], [-420, 120], [-640, 120]], [[0, 0], [260, -320], [260, -460]], [[0, 0], [300, 300], [600, 300]], [[-300, -300], [-300, 200], [-100, 400]]];
      const cols = ['#E9C978', '#F2B05E', '#E9D9A8', '#D9A441', '#F6E2A2', '#E0B864', '#C99A3C'];
      lines.forEach((ln, i) => { const pts = ln.map(([x, y]) => [cx + x, cy + y]); drawPath(c, pts, clamp(k * 1.3 - i * .07), { color: cols[i], lw: 5, glow: 'rgba(255,200,90,.7)', blur: 12 });
        pts.forEach((p, j) => { if (clamp(k * 1.3 - i * .07) > j / (pts.length - 1)) { c.save(); c.fillStyle = '#0E1015'; c.strokeStyle = cols[i]; c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], j === 0 ? 14 : 9, 0, 2 * PI); c.fill(); c.stroke(); c.restore(); } }); });
      dust(c, lt, 60, GOLDA, 3, [700, 100, 1200, 900]);
    },
    zifeng(c, lt, d, A) {
      const P = camera({ yaw: lt * .3, pitch: .08, dist: 2100, f: 1900, cx: 1250, cy: 1010 });
      const hk = eout(clamp(lt / (d * .7))); let m = [];
      const N = 26; for (let i = 0; i < N * hk; i++) { const r0 = 150 * (1 - i / N * .55), r1 = 150 * (1 - (i + 1) / N * .55); m = m.concat(prism(0, 0, r0, i * 30, (i + 1) * 30, 3, i * .07, r1, undefined, false)); }
      m = m.concat(prism(0, 0, 60, N * 30 * hk, N * 30 * hk + 160 * hk, 3, N * .07, 4, undefined, false));
      grid(c, P, 900, 100, GOLD, .12);
      drawMesh(c, m, P, { k: 1, dark: true, lw: 1.5 });
      const top = P([0, N * 30 * hk + 160 * hk, 0]); top[1] = Math.max(170, top[1]);
      drawPath(c, [[1600, 980], [1600, top[1]]], 1, { color: 'rgba(233,201,120,.6)', lw: 1.2 });
      txt(c, `${Math.round(450 * hk)} M`, 1680, top[1], '700 40px Cinzel', GOLD, 'left', 1, 3);
    },
    train(c, lt, d, A) {
      const k = grow(lt, d, 0, .5), x = 760 - eio(clamp(lt / d)) * 160; c.save(); c.translate(0, -40);
      const body = L.cat([[x, 720]], q([x, 720], [x + 50, 580], [x + 360, 566], 18), [[x + 1160, 566], [x + 1160, 740], [x, 740], [x, 720]]);
      drawPath(c, body, k, { color: GOLD, lw: 2.4, glow: 'rgba(255,200,90,.8)', blur: 14 });
      for (let i = 0; i < 14; i++) drawPath(c, [[x + 400 + i * 52, 610], [x + 438 + i * 52, 610], [x + 438 + i * 52, 645], [x + 400 + i * 52, 645], [x + 400 + i * 52, 610]], clamp(k * 1.5 - .4), { color: GOLD, lw: 1.2 });
      drawPath(c, [[x + 20, 690], [x + 900, 690]], k, { color: GOLD, lw: 1.2, alpha: .6 });
      c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const y = 560 + rnd(i, 1) * 200, len = 100 + rnd(i, 2) * 400, xx = (x + 950 + ((rnd(i, 3) * 900 + lt * 1400) % 900)); c.strokeStyle = `rgba(255,210,140,${.12 + rnd(i, 4) * .2})`; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + len, y); c.stroke(); } c.restore();
      const u = eio(clamp((lt - .3) / (d * .7)));
      drawPath(c, [[820, 900], [1780, 900]], 1, { color: 'rgba(233,201,120,.4)', lw: 1.4 });
      txt(c, '南京', 820, 860, '700 30px NotoSerifSC', GOLD, 'center'); txt(c, '上海', 1780, 860, '700 30px NotoSerifSC', GOLD, 'center');
      c.save(); c.fillStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 14; c.beginPath(); c.arc(lerp(820, 1780, u), 900, 9, 0, 2 * PI); c.fill(); c.restore();
      txt(c, `${Math.round(u * 60)} MIN`, lerp(820, 1780, u), 945, '600 22px Cinzel', GOLD, 'center', 1, 3); c.restore();
    },
    book(c, lt, d, A) {
      const k = grow(lt, d, 0, .5), cx = 1300, cy = 720;
      const lp = L.cat(q([cx, 600], [cx - 220, 540], [cx - 420, 590], 20), [[cx - 420, 860]], q([cx - 420, 860], [cx - 220, 820], [cx, 880], 20), [[cx, 600]]);
      drawPath(c, lp, k, { color: GOLD, lw: 2, glow: 'rgba(255,200,90,.8)', blur: 12 }); drawPath(c, lp.map(([x, y]) => [2 * cx - x, y]), k, { color: GOLD, lw: 2, glow: 'rgba(255,200,90,.8)', blur: 12 });
      const W = ['金陵', '秦淮', '春风', '江南', '六朝', '烟雨', '石头城', '燕', '诗', '月', '灯影', '钟山'];
      W.forEach((w, i) => { const ph = ((lt * .35 + i / W.length) % 1), x = cx + Math.sin(i * 2.4) * (60 + ph * 420), y = 640 - ph * 480; c.save(); c.globalAlpha = Math.sin(PI * ph) * clamp(lt / .6); c.shadowColor = GOLD; c.shadowBlur = 16; txt(c, w, x, y, `${34 + (i % 3) * 14}px MaShanZheng`, GOLD); c.restore(); });
      sparks(c, cx, 640, lt, 30, 500);
    },
    network(c, lt, d, A) {
      const N = 46, k = grow(lt, d, 0, .6), pts = Array.from({ length: N }, (_, i) => { const a = rnd(i, 1) * 2 * PI, r = Math.sqrt(rnd(i, 2)) * 360; return [1270 + Math.cos(a) * r * 1.3, 600 + Math.sin(a) * r * .9]; });
      const edges = []; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const dd = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (dd < 150) edges.push([i, j, dd]); }
      edges.forEach(([i, j], n) => drawPath(c, [pts[i], pts[j]], clamp(k * 1.6 - n / edges.length), { color: 'rgba(233,201,120,.55)', lw: 1 }));
      pts.forEach((p, i) => { const a = clamp(k * 2 - i / N); c.save(); c.globalAlpha = a; c.fillStyle = GOLD; c.shadowColor = GOLD; c.shadowBlur = 10; c.beginPath(); c.arc(p[0], p[1], 3 + (i % 5 === 0 ? 4 : 0), 0, 2 * PI); c.fill(); c.restore(); });
      c.save(); c.globalCompositeOperation = 'lighter'; edges.forEach(([i, j], n) => { if (n % 4) return; const u = (lt * .8 + n * .13) % 1; const x = lerp(pts[i][0], pts[j][0], u), y = lerp(pts[i][1], pts[j][1], u); c.fillStyle = `rgba(255,220,150,${k})`; c.beginPath(); c.arc(x, y, 2.5, 0, 2 * PI); c.fill(); }); c.restore();
    },
    galaxy(c, lt, d, A) {
      c.save(); c.translate(960, 560); c.rotate(lt * .12); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 900; i++) { const arm = i % 3, t = rnd(i, 1), r = 40 + t * 520, a = arm * 2 * PI / 3 + t * 5 + (rnd(i, 2) - .5) * .5; const al = clamp(lt / 1.2 - t * .6) * (.25 + .5 * rnd(i, 3));
        c.fillStyle = `rgba(255,${200 + rnd(i, 4) * 40 | 0},140,${al})`; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r * .45, .8 + rnd(i, 5) * 1.6, 0, 2 * PI); c.fill(); }
      c.restore();
    },
    ring(c, lt, d, A) {
      const cx = 960, cy = 690, R = 300;
      ICONS.forEach((ic, i) => { const a = -PI / 2 + i / ICONS.length * 2 * PI + lt * .08, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * .82; const al = clamp(lt * 2 - i * .12);
        c.save(); c.globalAlpha = al; c.strokeStyle = 'rgba(233,201,120,.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 52, 0, 2 * PI); c.stroke(); c.translate(x, y); ic(c); c.restore(); });
      c.save(); c.strokeStyle = 'rgba(233,201,120,.25)'; c.beginPath(); c.ellipse(cx, cy, R, R * .82, 0, 0, 2 * PI); c.stroke(); c.restore();
      flame(c, cx, cy + 60, .9, lt, 1); sparks(c, cx, cy + 40, lt, 40, 260);
    },
    flame(c, lt, d, A) {
      flame(c, 960, 860, 1.3, lt, 1); sparks(c, 960, 840, lt, 70, 500);
      c.save(); c.translate(960, 540); for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(233,201,120,${.18 - i * .05})`; c.beginPath(); c.arc(0, 0, 380 + i * 60, 0, 2 * PI * clamp(lt / 2)); c.stroke(); } c.restore();
    },
  };
  // 尾声光环里的小图标（金色线描）
  const G = (c, f) => { c.strokeStyle = GOLD; c.lineWidth = 2; c.shadowColor = 'rgba(255,200,90,.8)'; c.shadowBlur = 8; c.beginPath(); f(); c.stroke(); };
  const ICONS = [
    c => G(c, () => { const p = ingotPath(0, 6, .32); p.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); }),
    c => G(c, () => { for (let i = 0; i < 5; i++) { const w = 30 - i * 4, y = 26 - i * 13; c.moveTo(-w, y); c.lineTo(w, y); c.moveTo(-w * .6, y); c.lineTo(-w * .6, y - 9); c.moveTo(w * .6, y); c.lineTo(w * .6, y - 9); } c.moveTo(0, -40); c.lineTo(0, -28); }),
    c => G(c, () => { c.moveTo(-30, 10); c.quadraticCurveTo(0, 24, 30, 10); c.closePath(); for (const x of [-12, 0, 12]) { c.moveTo(x, 10); c.lineTo(x, -26); c.rect(x - 7, -24, 14, 14); } }),
    c => G(c, () => { c.arc(0, 0, 26, 0, 2 * PI); c.moveTo(-26, 0); c.lineTo(26, 0); c.moveTo(0, -26); c.lineTo(0, 26); }),
    c => G(c, () => { c.moveTo(-34, 6); c.lineTo(34, 6); c.moveTo(-34, -6); c.lineTo(34, -6); for (let x = -34; x < 34; x += 12) { c.moveTo(x, -6); c.lineTo(x + 6, 6); } c.moveTo(-20, 6); c.lineTo(-20, 26); c.moveTo(20, 6); c.lineTo(20, 26); }),
    c => G(c, () => { c.moveTo(-26, 0); c.quadraticCurveTo(0, -30, 26, 0); c.quadraticCurveTo(0, 20, -26, 0); c.moveTo(0, -15); c.lineTo(0, 20); }),
    c => G(c, () => { c.moveTo(-6, 30); c.lineTo(-10, -20); c.lineTo(0, -38); c.lineTo(10, -20); c.lineTo(6, 30); }),
    c => G(c, () => { c.arc(0, 0, 24, -PI / 2, 1.5 * PI); c.moveTo(18, -8); c.arc(6, -4, 16, 0, 2 * PI); }),
    c => G(c, () => { c.rect(-30, -10, 60, 34); c.moveTo(-12, 24); c.arc(0, 24, 12, PI, 0); c.moveTo(-36, -10); c.lineTo(0, -32); c.lineTo(36, -10); }),
    c => G(c, () => { c.moveTo(-20, 22); c.quadraticCurveTo(-30, -10, 0, -30); c.quadraticCurveTo(30, -10, 20, 22); c.closePath(); c.moveTo(-8, 0); c.lineTo(8, 0); }),
  ];
  root.VIS = V;
})(typeof window !== 'undefined' ? window : globalThis);
