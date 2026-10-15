/* 通用绘图库：3D 网格（雕版排线着色）、2D 路径描绘、光芒、粒子、火焰 */
(function (root) {
  const PI = Math.PI;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const eout = t => 1 - Math.pow(1 - clamp(t), 3);
  const eback = t => { t = clamp(t); const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

  // ───── 3D ─────
  function camera({ yaw = 0, pitch = .35, dist = 1600, f = 1400, cx = 960, cy = 600, tx = 0, ty = 0, tz = 0 }) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const view = ([x, y, z]) => { x -= tx; y -= ty; z -= tz; const X = x * cyw - z * syw, Z1 = x * syw + z * cyw; const Y = y * cp + Z1 * sp, Z = -y * sp + Z1 * cp; return [X, Y, Z]; };
    const proj = p => { const [X, Y, Z] = view(p); const s = f / (dist + Z); return [cx + X * s, cy - Y * s, Z]; };
    proj.view = view; return proj;
  }
  const quad = (a, b, c, d, tone) => ({ p: [a, b, c, d], tone });
  function box(x, y, z, w, h, d, tone) {
    const A = [x, y, z], B = [x + w, y, z], C = [x + w, y, z + d], D = [x, y, z + d];
    const E = [x, y + h, z], F = [x + w, y + h, z], G = [x + w, y + h, z + d], H = [x, y + h, z + d];
    return [quad(A, B, C, D, tone), quad(H, G, F, E, tone), quad(A, E, F, B, tone), quad(B, F, G, C, tone), quad(C, G, H, D, tone), quad(D, H, E, A, tone)];
  }
  // 正 n 棱台（r0 底半径，r1 顶半径）
  function prism(cx, cz, r0, y0, y1, n, rot = 0, r1 = r0, tone, caps = true) {
    const out = [], P = (r, y, i) => { const a = rot + 2 * PI * i / n; return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]; };
    for (let i = 0; i < n; i++) out.push(quad(P(r0, y0, i), P(r1, y1, i), P(r1, y1, i + 1), P(r0, y0, i + 1), tone));
    if (caps) { out.push({ p: Array.from({ length: n }, (_, i) => P(r1, y1, n - 1 - i)).reverse(), tone }); out.push({ p: Array.from({ length: n }, (_, i) => P(r0, y0, i)).reverse(), tone }); }
    return out;
  }
  // 庑殿顶
  function hipRoof(cx, cz, w, d, y0, h, tone) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, r = Math.min(w, d) * .38;
    const R0 = [cx - (w / 2 - r), y0 + h, cz], R1 = [cx + (w / 2 - r), y0 + h, cz];
    return [{ p: [[x0, y0, z0], R0, R1, [x1, y0, z0]], tone }, { p: [[x1, y0, z1], R1, R0, [x0, y0, z1]], tone },
      { p: [[x0, y0, z1], R0, [x0, y0, z0]], tone }, { p: [[x1, y0, z0], R1, [x1, y0, z1]], tone }];
  }
  const moveMesh = (m, dx, dy, dz) => m.map(f => ({ ...f, p: f.p.map(([x, y, z]) => [x + dx, y + dy, z + dz]) }));
  const rotMesh = (m, a, cx = 0, cz = 0) => m.map(f => ({ ...f, p: f.p.map(([x, y, z]) => { const X = x - cx, Z = z - cz; return [cx + X * Math.cos(a) - Z * Math.sin(a), y, cz + X * Math.sin(a) + Z * Math.cos(a)]; }) }));

  const hatchCache = {};
  function hatch(c, color, cross) {
    const k = color + cross; if (hatchCache[k]) return hatchCache[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = 9; const x = cv.getContext('2d');
    x.strokeStyle = color; x.lineWidth = 1.1; x.beginPath(); x.moveTo(-1, 10); x.lineTo(10, -1); if (cross) { x.moveTo(-1, -1); x.lineTo(10, 10); } x.stroke();
    return (hatchCache[k] = c.createPattern(cv, 'repeat'));
  }
  // 画网格：k 为生长进度（先描边、再上面）
  function drawMesh(c, mesh, P, o = {}) {
    const k = o.k ?? 1, dark = o.dark, L = o.light || [-.55, .7, -.45];
    const ln = Math.hypot(...L), lx = L[0] / ln, ly = L[1] / ln, lz = L[2] / ln;
    const faces = [];
    for (const f of mesh) {
      const pp = f.p.map(P); let z = 0; for (const q of pp) z += q[2]; z /= pp.length; z -= f.bias || 0;
      // 视空间法线（朝向镜头），光从左上前方来
      const [a, b, cc] = f.p.slice(0, 3).map(P.view); const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
      let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]; const nl = Math.hypot(nx, ny, nz) || 1;
      if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      const lam = clamp((nx * lx + ny * ly + nz * lz) / nl * .7 + .35);
      faces.push({ pp, z, lam, tone: f.tone });
    }
    faces.sort((a, b) => b.z - a.z);
    const ke = clamp(k / .55), kf = clamp((k - .3) / .45);
    const ink = o.ink || (dark ? '#E9C978' : '#2A221B');
    const base = o.fill || (dark ? '#14161C' : '#EDE2C8');
    const hp = hatch(c, dark ? 'rgba(233,201,120,.6)' : 'rgba(42,34,27,.5)', false), hx = hatch(c, dark ? 'rgba(233,201,120,.5)' : 'rgba(42,34,27,.42)', true);
    c.save(); c.lineJoin = 'round';
    if (dark) { c.shadowColor = 'rgba(233,190,100,.55)'; c.shadowBlur = 8; }
    for (const f of faces) {
      c.beginPath(); f.pp.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath();
      if (kf > 0) {
        c.save(); c.shadowBlur = 0;
        c.globalAlpha = kf * (o.fillAlpha ?? 1); c.fillStyle = f.tone || base; c.fill();
        // 只有窄面不受光的才排线（曲面屋顶会自然形成明暗渐变）
        const sh = 1 - f.lam; if (sh > .3 && !f.noHatch) { c.globalAlpha = kf * clamp((sh - .3) * 2.2) * .95; c.fillStyle = sh > .72 ? hx : hp; c.fill(); }
        c.restore();
      }
      if (ke > 0 && !f.noStroke) {
        let per = 0; for (let i = 0; i < f.pp.length; i++) { const a = f.pp[i], b = f.pp[(i + 1) % f.pp.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
        c.setLineDash(ke < 1 ? [per * ke, per] : []); c.strokeStyle = ink; c.lineWidth = (o.lw || 1.6) * 1.2; c.globalAlpha = o.alpha ?? 1; c.stroke(); c.setLineDash([]);
      }
      if (ke > 0 && f.lines) for (const ln of f.lines) {
        const pts = ln.pts.map(P); c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
        c.strokeStyle = ink; c.globalAlpha = (o.alpha ?? 1) * (ln.a ?? 1) * (ke < 1 ? ke : 1); c.lineWidth = (ln.w || .8) * (o.lw || 1.6) / 1.6; c.stroke();
      }
      if (kf > .6 && f.text) { // 匾额文字：把字贴到投影后的四边形上（仿射近似）
        const [p0, p1, , p3] = f.pp, t = f.text; c.save(); c.globalAlpha = clamp((kf - .6) / .4);
        c.transform(p1[0] - p0[0], p1[1] - p0[1], p3[0] - p0[0], p3[1] - p0[1], p0[0], p0[1]);
        c.fillStyle = t.color || '#C9A24E'; c.font = t.font || '900 100px NotoSerifSC'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const chs = [...t.s], n = chs.length; chs.forEach((ch, i) => { c.save(); c.translate((i + .5) / n, .54); c.scale(.82 / n / 100 * (t.sx || 1), .74 / 100); c.fillText(ch, 0, 0); c.restore(); });
        c.restore();
      }
    }
    c.restore();
  }
  function grid(c, P, size, step, color, alpha, y = 0) {
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = 1;
    for (let v = -size; v <= size; v += step) { let a = P([v, y, -size]), b = P([v, y, size]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); a = P([-size, y, v]); b = P([size, y, v]); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.restore();
  }
  function line3(c, P, pts, k = 1, o = {}) { drawPath(c, pts.map(P), k, o); }

  // ───── 2D ─────
  const q = (p0, cc, p1, n = 12) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * cc[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * cc[1] + t * t * p1[1]]); } return o; };
  const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const cat = (...ps) => ps.reduce((o, p) => o.concat(p), []);
  function drawPath(c, pts, k = 1, o = {}) {
    if (k <= 0 || pts.length < 2) return;
    let L = 0; const seg = [0]; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(L); }
    const target = L * clamp(k);
    c.save(); c.strokeStyle = o.color || '#2A221B'; c.lineWidth = o.lw || 2; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = o.alpha ?? 1;
    if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.blur || 10; }
    if (o.dash) c.setLineDash(o.dash);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      if (seg[i] <= target) c.lineTo(pts[i][0], pts[i][1]);
      else { const t = (target - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1]); c.lineTo(lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)); break; }
    }
    if (o.fill && k >= 1) { c.fillStyle = o.fill; c.fill(); }
    c.stroke(); c.restore();
  }
  function fillPath(c, pts, color, alpha = 1) { c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.restore(); }
  function rays(c, cx, cy, n, r0, r1, color, alpha, rot = 0) {
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = 1.2;
    for (let i = 0; i < n; i++) { const a = rot + 2 * PI * i / n, w = .6 + .4 * rnd(i, 3); c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1 * w, cy + Math.sin(a) * r1 * w); c.stroke(); }
    c.restore();
  }
  function dust(c, t, n, color, seed = 1, area = [0, 0, 1920, 1080]) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = area[0] + ((rnd(i, seed) * area[2] + t * (6 + rnd(i, seed + 1) * 14)) % area[2]), y = area[1] + ((rnd(i, seed + 2) * area[3] - t * (4 + rnd(i, seed + 3) * 10) + area[3] * 10) % area[3]);
      const a = .15 + .5 * Math.pow(Math.sin(t * (.6 + rnd(i, 5)) + i) * .5 + .5, 3);
      c.fillStyle = color.replace('A', a.toFixed(3)); c.beginPath(); c.arc(x, y, .6 + rnd(i, 6) * 1.6, 0, 2 * PI); c.fill();
    }
    c.restore();
  }
  function flame(c, x, y, s, t, alpha = 1) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha;
    for (let i = 0; i < 26; i++) {
      const life = .9 + rnd(i, 2) * .6, ph = ((t + rnd(i, 1) * life) % life) / life;
      const px = x + Math.sin(t * 6 + i) * 6 * s * (1 - ph) + (rnd(i, 3) - .5) * 14 * s * ph, py = y - ph * 120 * s;
      const r = (26 - ph * 22) * s * (.6 + rnd(i, 4) * .6);
      const g = c.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,${200 - ph * 120 | 0},${90 - ph * 80 | 0},${.5 * (1 - ph)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, 2 * PI); c.fill();
    }
    const g = c.createRadialGradient(x, y - 20 * s, 0, x, y - 20 * s, 160 * s); g.addColorStop(0, 'rgba(255,190,90,.35)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - 20 * s, 160 * s, 0, 2 * PI); c.fill();
    c.restore();
  }
  function sparks(c, x, y, t, n, spread = 260, seed = 4) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const life = 1.4 + rnd(i, seed) * 1.6, ph = ((t + rnd(i, seed + 1) * life) % life) / life;
      const px = x + (rnd(i, seed + 2) - .5) * spread * ph + Math.sin(t * 2 + i) * 10, py = y - ph * (200 + rnd(i, seed + 3) * 300);
      c.fillStyle = `rgba(255,${190 + rnd(i, 9) * 50 | 0},120,${(1 - ph) * .8})`; c.beginPath(); c.arc(px, py, 1 + rnd(i, 7) * 1.8, 0, 2 * PI); c.fill();
    }
    c.restore();
  }
  // 元宝
  function ingotPath(x, y, s) {
    return cat(q([x - 90 * s, y - 40 * s], [x - 70 * s, y + 30 * s], [x - 40 * s, y + 34 * s], 10), [[x + 40 * s, y + 34 * s]], q([x + 40 * s, y + 34 * s], [x + 70 * s, y + 30 * s], [x + 90 * s, y - 40 * s], 10),
      q([x + 90 * s, y - 40 * s], [x + 50 * s, y - 14 * s], [x + 30 * s, y - 22 * s], 8), q([x + 30 * s, y - 22 * s], [x, y - 70 * s], [x - 30 * s, y - 22 * s], 12), q([x - 30 * s, y - 22 * s], [x - 50 * s, y - 14 * s], [x - 90 * s, y - 40 * s], 8));
  }
  const LIB = { PI, clamp, lerp, eio, eout, eback, rnd, camera, box, prism, hipRoof, moveMesh, rotMesh, drawMesh, grid, line3, q, arc, cat, drawPath, fillPath, rays, dust, flame, sparks, ingotPath };
  if (typeof module !== 'undefined') module.exports = LIB; else root.LIB = LIB;
})(typeof window !== 'undefined' ? window : globalThis);
