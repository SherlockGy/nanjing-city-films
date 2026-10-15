/* 中式建筑构件库：曲面起翘屋顶（庑殿 / 攒尖 / 重檐）、瓦垄、斗拱、圆柱、须弥座、栏杆、台阶、拱门、匾额、牌坊。
 * 坐标：y 向上，-z 为建筑正面（朝向镜头）。返回值都是 drawMesh 可用的面数组。 */
(function (root) {
  const { PI, lerp, box, prism } = LIB;
  const add = (o, ...ms) => { for (const m of ms) for (const f of m) o.push(f); return o; };

  // 一坡曲面屋面：eave(u)/ridge(u) 给出檐口与屋脊上的点
  function slope(eave, ridge, nu, nv, o = {}) {
    const out = [], sag = o.sag ?? .13;
    const P = (u, v) => { const e = eave(u), r = ridge(u); return [lerp(e[0], r[0], v), lerp(e[1], r[1], v) - sag * Math.sin(PI * v) * (r[1] - e[1]), lerp(e[2], r[2], v)]; };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
      const f = { p: [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], tone: o.tone, noStroke: true, lines: [] };
      if (o.tiles !== false) for (const um of [u0 + (u1 - u0) * .25, u0 + (u1 - u0) * .75]) f.lines.push({ pts: [P(um, v0), P(um, v1)], w: .65, a: .75 });
      if (j === 0) f.lines.push({ pts: [P(u0, 0), P(u1, 0)], w: 2.4 });
      if (j === nv - 1 && o.ridge) f.lines.push({ pts: [P(u0, 1), P(u1, 1)], w: 3.2 });
      if (i === 0) f.lines.push({ pts: [P(0, v0), P(0, v1)], w: 2.6 });
      if (i === nu - 1) f.lines.push({ pts: [P(1, v0), P(1, v1)], w: 2.6 });
      out.push(f);
    }
    return out;
  }
  // 檐口：从角 A 到角 B，两端起翘、出翘
  function eaveFn(A, B, y0, nrm, lift, ext) {
    const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), ex = dx / L, ez = dz / L;
    return u => { const s = 2 * u - 1, w = Math.pow(Math.abs(s), 2.6), sg = Math.sign(s);
      return [A[0] + dx * u + nrm[0] * ext * w + ex * ext * .7 * w * sg, y0 + lift * w, A[1] + dz * u + nrm[1] * ext * w + ez * ext * .7 * w * sg]; };
  }
  // 庑殿顶（四坡五脊）
  function roofHip(cx, cz, w, d, y0, h, o = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, rw = Math.max(0, w / 2 - d / 2 * (o.hip ?? .85));
    const lift = (o.lift ?? .22) * h, ext = (o.ext ?? .05) * Math.min(w, d) + 6, Y = y0 + h;
    const Rl = [cx - rw, Y, cz], Rr = [cx + rw, Y, cz], nu = o.nu || 14, nv = o.nv || 5, ns = o.ns || 6;
    const seg = (A, B, n, R0, R1, k) => slope(eaveFn(A, B, y0, n, lift, ext), u => [lerp(R0[0], R1[0], u), Y, lerp(R0[2], R1[2], u)], k, nv, { ...o, ridge: true });
    return [].concat(seg([x0, z0], [x1, z0], [0, -1], Rl, Rr, nu), seg([x1, z0], [x1, z1], [1, 0], Rr, Rr, ns), seg([x1, z1], [x0, z1], [0, 1], Rr, Rl, nu), seg([x0, z1], [x0, z0], [-1, 0], Rl, Rl, ns));
  }
  // 攒尖顶（n 边）
  function roofPyr(cx, cz, r, y0, h, n, rot = 0, o = {}) {
    const lift = (o.lift ?? .25) * h, ext = (o.ext ?? .1) * r, apex = [cx, y0 + h, cz]; let out = [];
    for (let i = 0; i < n; i++) {
      const a0 = rot + 2 * PI * i / n, a1 = rot + 2 * PI * (i + 1) / n, am = (a0 + a1) / 2;
      const A = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], B = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      out = out.concat(slope(eaveFn(A, B, y0, [Math.cos(am), Math.sin(am)], lift, ext), () => apex, o.nu || 4, o.nv || 3, o));
    }
    if (o.finial !== false) out = out.concat(prism(cx, cz, r * .06, y0 + h, y0 + h + h * .45, 6, 0, r * .015, o.finialTone));
    return out;
  }
  // 斗拱带：沿矩形四周一圈小方块
  function dougong(cx, cz, w, d, y, sz, gap, tone) {
    const out = [], put = (x, z) => add(out, box(x - sz / 2, y, z - sz / 2, sz, sz * .8, sz, tone));
    for (let x = cx - w / 2; x <= cx + w / 2 + 1; x += gap) { put(x, cz - d / 2); put(x, cz + d / 2); }
    for (let z = cz - d / 2 + gap; z < cz + d / 2 - 1; z += gap) { put(cx - w / 2, z); put(cx + w / 2, z); }
    return out;
  }
  const col = (x, z, r, y0, y1, tone) => prism(x, z, r, y0, y1, 10, 0, r, tone, false);
  // 须弥座：三层收分
  function plinth(cx, cz, w, d, h, tone) {
    return add([], box(cx - w / 2, 0, cz - d / 2, w, h * .3, d, tone), box(cx - w / 2 + h * .25, h * .3, cz - d / 2 + h * .25, w - h * .5, h * .4, d - h * .5, tone), box(cx - w / 2 + h * .08, h * .7, cz - d / 2 + h * .08, w - h * .16, h * .3, d - h * .16, tone));
  }
  // 正面带拱门的墙体（拱洞画成暗色面 + 门券线）
  function archWall(cx, y0, cz, w, h, d, arches, tone, dark = '#2E2822') {
    const out = box(cx - w / 2, y0, cz - d / 2, w, h, d, tone);
    for (const a of arches) {
      const pts = [[a.x - a.w / 2, y0], [a.x - a.w / 2, y0 + a.h - a.w / 2]];
      for (let i = 0; i <= 12; i++) { const t = PI - PI * i / 12; pts.push([a.x + Math.cos(t) * a.w / 2, y0 + a.h - a.w / 2 + Math.sin(t) * a.w / 2]); }
      pts.push([a.x + a.w / 2, y0]);
      const z = cz - d / 2 - .6;
      out.push({ p: pts.map(([x, y]) => [x, y, z]), tone: dark, noHatch: true, bias: 40, lines: [{ pts: pts.map(([x, y]) => [x, y, z - .2]).map(([x, y, zz]) => [x, y, zz]), w: 2 }, { pts: pts.slice(1, -1).map(([x, y]) => [x + (x - a.x) * .14, y + (y - (y0 + a.h - a.w / 2)) * .14 * (y > y0 + a.h - a.w / 2 ? 1 : 0), z - .2]), w: 1.2 }] });
    }
    return out;
  }
  // 匾额（朝 -z 的竖直面，带字）
  function plaque(cx, cy, z, w, h, text, tone = '#2F4E78', color = '#E8C873', o = {}) {
    return [{ p: [[cx - w / 2, cy + h / 2, z], [cx + w / 2, cy + h / 2, z], [cx + w / 2, cy - h / 2, z], [cx - w / 2, cy - h / 2, z]], tone, noHatch: true, bias: 40, text: { s: text, color, font: o.font, sx: o.sx }, lines: [{ pts: [[cx - w / 2 + 6, cy + h / 2 - 6, z - .3], [cx + w / 2 - 6, cy + h / 2 - 6, z - .3], [cx + w / 2 - 6, cy - h / 2 + 6, z - .3], [cx - w / 2 + 6, cy - h / 2 + 6, z - .3], [cx - w / 2 + 6, cy + h / 2 - 6, z - .3]], w: 1.4 }] }];
  }
  function railing(x0, z0, x1, z1, y, h, gap, tone) {
    const out = [], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / gap));
    for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n); add(out, box(x - 4, y, z - 4, 8, h, 8, tone)); }
    const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    out.push({ p: [[x0, y + h, z0], [x1, y + h, z1], [x1, y + h - 6, z1], [x0, y + h - 6, z0]], tone, lines: [] });
    return out;
  }
  // 台阶（沿 +z 升高）
  function steps(cx, z0, w, n, rise, run, y0 = 0, tone) {
    const out = []; for (let i = 0; i < n; i++) add(out, box(cx - w / 2, y0, z0 + i * run, w, rise * (i + 1), run, tone)); return out;
  }
  // 殿：台基 + 檐柱 + 墙 + 斗拱 + 屋顶（可重檐）
  function hall(cx, cz, w, d, h, o = {}) {
    const out = [], base = o.base ?? 50, bt = o.baseTone, ct = o.colTone ?? '#B9483A';
    add(out, plinth(cx, cz, w + 90, d + 90, base, bt));
    const n = o.cols || 8;
    for (let i = 0; i < n; i++) { const x = cx - w / 2 + i * w / (n - 1); add(out, col(x, cz - d / 2, 11, base, base + h, ct)); if (o.backCols !== false) add(out, col(x, cz + d / 2, 11, base, base + h, ct)); }
    add(out, archWall(cx, base, cz + 10, w - 40, h, d - 40, o.arches || [], o.wallTone ?? '#E9DDC4'));
    add(out, box(cx - w / 2 - 14, base + h, cz - d / 2 - 14, w + 28, 16, d + 28, o.beamTone));
    if (o.dougong !== false) add(out, dougong(cx, cz, w + 10, d + 10, base + h + 16, 12, 34, o.beamTone));
    const ry = base + h + 26;
    if (o.double) {
      add(out, roofHip(cx, cz, w + 140, d + 130, ry, h * .32, { tone: o.roofTone, hip: 1.0, lift: .3, ns: 5 }));
      add(out, box(cx - w * .36, ry + h * .2, cz - d * .3, w * .72, h * .42, d * .6, o.wallTone ?? '#E9DDC4'));
      add(out, roofHip(cx, cz, w * .9, d * .8, ry + h * .62, h * .55, { tone: o.roofTone }));
    } else add(out, roofHip(cx, cz, w + 150, d + 140, ry, h * (o.roofH ?? .7), { tone: o.roofTone }));
    return out;
  }
  // 三间四柱三楼牌坊
  function paifang(cx, cz, W, H, o = {}) {
    const out = [], s = W * .06, ch = H * .74, stone = o.stone ?? '#E6DED0', roof = o.roof ?? '#86A9C9';
    const xs = [-W / 2, -W / 6, W / 6, W / 2].map(x => cx + x);
    for (const x of xs) { add(out, box(x - s / 2, 0, cz - s / 2, s, ch, s, stone)); add(out, box(x - s * .9, 0, cz - s * .9, s * 1.8, H * .14, s * 1.8, stone)); }
    add(out, box(cx - W / 2 - s * .4, ch - H * .17, cz - s * .45, W + s * .8, H * .05, s * .9, stone));
    add(out, box(cx - W / 2 - s * .4, ch, cz - s * .45, W + s * .8, H * .06, s * .9, stone));
    add(out, plaque(cx, ch - H * .06, cz - s * .5 - .5, W / 3 - s * 1.4, H * .09, o.text || '', o.plaqueTone ?? '#2F4E78', o.textColor ?? '#E8C873'));
    for (const sx of [-1, 1]) add(out, plaque(cx + sx * W / 3, ch - H * .06, cz - s * .5 - .5, W / 3 - s * 1.4, H * .1, '', stone, stone));
    const yc = ch + H * .06;
    add(out, dougong(cx, cz, W / 3 + s, s * .6, yc, s * .3, s * .6, stone));
    add(out, roofHip(cx, cz, W / 3 + s * 3.2, s * 3.2, yc + s * .26, H * .2, { tone: roof, hip: .7, lift: .35, ext: .1, nu: 12, ns: 4, nv: 4 }));
    for (const sx of [-1, 1]) add(out, roofHip(cx + sx * W / 3, cz, W / 3 + s * 1.6, s * 2.8, ch + H * .03, H * .15, { tone: roof, hip: .7, lift: .35, ext: .1, nu: 10, ns: 4, nv: 3 }));
    return out;
  }
  // 柏树（圆锥）
  const cypress = (x, z, h, r, tone = '#5E6B4E') => add([], prism(x, z, 8, 0, h * .15, 6, 0, 8, '#6B5A45', false), prism(x, z, r, h * .12, h, 8, 0, 4, tone));

  // 环形檐（宝塔中间层）：外檐起翘，向内收到上一层塔身
  function eaveRing(cx, cz, rOut, rIn, y0, h, n, rot = 0, o = {}) {
    const lift = (o.lift ?? .4) * h, ext = (o.ext ?? .12) * rOut; let out = [];
    for (let i = 0; i < n; i++) {
      const a0 = rot + 2 * PI * i / n, a1 = rot + 2 * PI * (i + 1) / n, am = (a0 + a1) / 2;
      const A = [cx + Math.cos(a0) * rOut, cz + Math.sin(a0) * rOut], B = [cx + Math.cos(a1) * rOut, cz + Math.sin(a1) * rOut];
      out = out.concat(slope(eaveFn(A, B, y0, [Math.cos(am), Math.sin(am)], lift, ext), u => { const a = lerp(a0, a1, u); return [cx + Math.cos(a) * rIn, y0 + h, cz + Math.sin(a) * rIn]; }, o.nu || 3, o.nv || 2, { ...o, ridge: false }));
    }
    return out;
  }
  // 多边形塔身某一面上的拱门（暗色面）
  function faceArch(cx, cz, r, a0, a1, y0, w, h, tone = '#3A3128') {
    const am = (a0 + a1) / 2, rr = r * Math.cos((a1 - a0) / 2) + .8, nx = Math.cos(am), nz = Math.sin(am), tx = -nz, tz = nx;
    const pts = [[-w / 2, 0], [-w / 2, h - w / 2]]; for (let i = 0; i <= 10; i++) { const t = PI - PI * i / 10; pts.push([Math.cos(t) * w / 2, h - w / 2 + Math.sin(t) * w / 2]); } pts.push([w / 2, 0]);
    return [{ p: pts.map(([u, v]) => [cx + nx * rr + tx * u, y0 + v, cz + nz * rr + tz * u]), tone, noHatch: true, bias: 20 }];
  }
  // 硬山/悬山两坡顶（沿 x 方向的长屋）
  function roofGable(x0, x1, cz, d, y0, h, o = {}) {
    const z0 = cz - d / 2, z1 = cz + d / 2, Y = y0 + h;
    return [].concat(slope(u => [lerp(x0, x1, u), y0, z0], u => [lerp(x0, x1, u), Y, cz], o.nu || 8, o.nv || 3, { ...o, ridge: true }),
      slope(u => [lerp(x1, x0, u), y0, z1], u => [lerp(x1, x0, u), Y, cz], o.nu || 8, o.nv || 3, { ...o, ridge: true }));
  }
  root.ARCH = { eaveRing, faceArch, roofGable, slope, roofHip, roofPyr, dougong, col, plinth, archWall, plaque, railing, steps, hall, paifang, cypress, add };
})(typeof window !== 'undefined' ? window : globalThis);
