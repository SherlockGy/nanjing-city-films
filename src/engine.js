/* 渲染引擎：每一帧都是时间 T 的纯函数（可随机跳转、可多进程并行渲染） */
(function () {
  const W = 1920, H = 1080;
  const Q = new URLSearchParams(location.search);
  const L = layout(FILM, TL);
  window.L = L;
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('需要 WebGL2');

  // ───────────── GL 基础 ─────────────
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n')); return s; }
  function prog(fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  const PS = prog(FS_SHOT), PC = prog(FS_COMP);
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  function tex(src, mip) {
    gl.activeTexture(gl.TEXTURE7); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }
  function upload(t, src) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
  function fbo() {
    gl.activeTexture(gl.TEXTURE7); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { f, t };
  }
  const FB = [fbo(), fbo()];
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const textCv = mk(), tctx = textCv.getContext('2d');
  const fxCv = [mk(), mk()], fxTex = fxCv.map(c => tex(c, false));
  const textTex = tex(textCv, false);
  const srcCv = [mk(), mk()], srcTex = srcCv.map(c => tex(c, false)); // 程序绘制的镜头（手卷、片尾）

  // ───────────── 素材 ─────────────
  const cache = new Map(); // key → {tex, w, h, lum}
  function loadImg(url) {
    return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { console.warn('缺素材', url); res(null); }; im.src = url; });
  }
  function lumGrid(im) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 27; const x = c.getContext('2d');
    x.drawImage(im, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data; const g = new Float32Array(48 * 27);
    for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) / 255;
    return g;
  }
  async function getAsset(key) {
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      const im = await loadImg(`assets/proc/${key}.jpg`);
      if (!im) return null;
      return { tex: tex(im, true), w: im.naturalWidth, h: im.naturalHeight, lum: lumGrid(im) };
    })();
    cache.set(key, p);
    const v = await p; cache.set(key, v); return v;
  }
  const PAPER_IMG = loadImg('assets/proc/paper_detail.jpg');
  const BRUSH = {}; ['g_stroke', 'g_enso'].forEach(k => loadImg(`assets/proc/${k}.png`).then(im => BRUSH[k] = im));
  let paperTex = null, paperLum = null;
  const needKeys = s => s.k === 'scroll' ? s.imgs : s.img ? (/^(bleed|ink)$/.test(s.look) ? [s.img, s.img + '_ink'] : [s.img]) : [];
  async function ensure(T) {
    const want = new Set();
    for (const s of L.shots) if (s.vis0 - 2.5 < T && T < s.vis1 + 0.5) needKeys(s).forEach(k => want.add(k));
    for (const k of [...cache.keys()]) if (!want.has(k)) { const v = cache.get(k); if (v && v.tex) gl.deleteTexture(v.tex); cache.delete(k); }
    await Promise.all([...want].map(getAsset));
    for (const s of L.shots) if (s.k === 'scroll' && s.vis0 - 2.5 < T && T < s.vis1) for (const k of s.imgs) if (!scrollImgs[k]) scrollImgs[k] = await loadImg(`assets/proc/${k}.jpg`);
  }
  const scrollImgs = {};

  // ───────────── 工具 ─────────────
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIO = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const FONTS = { ma: 'MaShanZheng', xing: 'ZhiMangXing', cao: 'LiuJianMaoCao', long: 'LongCang', kai: 'WenKai', serif: 'NotoSerifSC' };
  const INK = '#171615', LIGHT = '#f6f1e6', RED = '#b02a20';

  // 取景：Ken Burns
  function xform(s, a, T) {
    const u = easeIO((T - s.vis0) / (s.vis1 - s.vis0));
    const m = s.move || [[1.06, .5, .5], [1.0, .5, .5]];
    const sc = lerp(m[0][0], m[1][0], u), cx = lerp(m[0][1], m[1][1], u), cy = lerp(m[0][2], m[1][2], u);
    const ia = a ? a.w / a.h : W / H, sa = W / H;
    let fw = 1, fh = 1;
    if (ia > sa) fw = sa / ia; else fh = ia / sa;
    fw /= sc; fh /= sc;
    const x = clamp(cx, fw / 2, 1 - fw / 2), y = clamp(1 - cy, fh / 2, 1 - fh / 2);
    return [fw, fh, x, y];
  }
  const bleedP = (s, T) => { const d = s.end - s.start, b = s.bleed || [0, 1]; return easeIO((T - (s.start + b[0] * d)) / Math.max(0.01, (b[1] - b[0]) * d)); };

  // 某一屏幕区域的亮度（决定文字用墨色还是白色）
  function lumAt(T, rx, ry, rw, rh) {
    const s = activeShots(T).slice(-1)[0]; if (!s) return 0.8;
    if (!s.img) return 0.85;
    const a = cache.get(s.img); if (!a || !a.lum) return 0.7;
    const ai = /^(bleed|ink)$/.test(s.look) ? cache.get(s.img + '_ink') : null;
    const xf = xform(s, a, T);
    let sum = 0, n = 0;
    const m = s.look === 'ink' ? 0 : s.look === 'bleed' ? bleedP(s, T) : 1;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const sx = rx + rw * (i + .5) / 5, sy = ry + rh * (j + .5) / 5;
      const u = xf[2] + (sx - .5) * xf[0], v = 1 - (xf[3] + ((1 - sy) - .5) * xf[1]);
      const gi = Math.min(47, Math.max(0, Math.floor(u * 48))) + 48 * Math.min(26, Math.max(0, Math.floor(v * 27)));
      const lc = a.lum[gi], li = ai && ai.lum ? ai.lum[gi] : lc;
      sum += lerp(li, lc, m); n++;
    }
    let l = sum / n;
    if (s.dark) l *= 1 - s.dark;
    return l;
  }

  function activeShots(T) {
    const r = [];
    for (const s of L.shots) if (s.vis0 <= T && T < s.vis1) r.push(s);
    return r.slice(-2);
  }

  // ───────────── 粒子与氛围（画在镜头自己的 2D 层上） ─────────────
  const SHADER_FX = { mist: 'uMist', swirl: 'uSwirl', glow: 'uGlow', ripple: 'uRipple', waves: 'uRipple', lamp: 'uLamp', citylights: 'uCity', candles: 'uLamp', dawn: 'uDawn' };
  const FX = {
    rain(c, t, sd) {
      c.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const sp = 1500 + rnd(i, sd) * 900, len = 26 + rnd(i, sd + 1) * 50;
        const y = ((rnd(i, sd + 2) * (H + 200) + t * sp) % (H + 200)) - 100;
        const x = rnd(i, sd + 3) * (W + 300) - y * .18;
        c.strokeStyle = `rgba(235,235,240,${.07 + rnd(i, sd + 4) * .16})`; c.lineWidth = .8 + rnd(i, sd + 5) * 1.3;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * .18, y + len); c.stroke();
      }
    },
    petals(c, t, sd) {
      for (let i = 0; i < 70; i++) {
        const sp = 50 + rnd(i, sd) * 70, y = ((rnd(i, sd + 1) * (H + 100) + t * sp) % (H + 100)) - 50;
        const x = (rnd(i, sd + 2) * (W + 200) - 100 + Math.sin(t * (.6 + rnd(i, sd + 3)) + i) * 60 + t * 30) % (W + 100);
        const r = 5 + rnd(i, sd + 4) * 7, rot = t * (1 + rnd(i, sd + 5) * 2) + i;
        c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, .55 + .45 * Math.sin(t * 2 + i));
        c.fillStyle = `rgba(248,${190 + rnd(i, 9) * 30 | 0},${200 + rnd(i, 8) * 30 | 0},${.75 + rnd(i, 7) * .25})`;
        c.beginPath(); c.ellipse(0, 0, r, r * .62, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
    },
    snow(c, t, sd) {
      for (let i = 0; i < 170; i++) {
        const z = rnd(i, sd), sp = 30 + z * 70, y = ((rnd(i, sd + 1) * (H + 40) + t * sp) % (H + 40)) - 20;
        const x = (rnd(i, sd + 2) * W + Math.sin(t * .8 + i) * 25 * z + W) % W;
        c.fillStyle = `rgba(255,255,255,${.35 + z * .55})`; c.beginPath(); c.arc(x, y, 1 + z * 3.2, 0, Math.PI * 2); c.fill();
      }
    },
    leaves(c, t, sd) {
      const cols = ['200,80,40', '214,128,46', '178,52,36', '226,160,60'];
      for (let i = 0; i < 34; i++) {
        const sp = 60 + rnd(i, sd) * 70, y = ((rnd(i, sd + 1) * (H + 120) + t * sp) % (H + 120)) - 60;
        const x = (rnd(i, sd + 2) * W + Math.sin(t * (.5 + rnd(i, 4)) + i) * 90 + t * 20) % W;
        const r = 8 + rnd(i, sd + 3) * 9;
        c.save(); c.translate(x, y); c.rotate(t * (.8 + rnd(i, 6)) + i); c.scale(1, .4 + .6 * Math.abs(Math.sin(t * 1.5 + i)));
        c.fillStyle = `rgba(${cols[i % 4]},.9)`;
        c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * .8, 0, 0, r); c.quadraticCurveTo(-r * .8, 0, 0, -r); c.fill(); c.restore();
      }
    },
    swallows(c, t, sd) {
      for (let i = 0; i < 3; i++) {
        const tt = t * .11 + i * .13 - .05;
        const x = lerp(W * .15, W * 1.15, tt) + Math.sin(tt * 9 + i) * 40, y = lerp(H * .62, H * .12, tt) + Math.sin(tt * 14 + i * 2) * 50 + i * 60;
        const s = 1.25 - i * .25, f = Math.sin(t * 13 + i * 2);
        c.save(); c.translate(x, y); c.rotate(-.35); c.scale(s, s); c.fillStyle = 'rgba(20,20,22,.9)';
        c.beginPath();
        c.moveTo(18, 0); c.quadraticCurveTo(4, -4, -10, -2); c.lineTo(-26, -9); c.lineTo(-14, 0); c.lineTo(-26, 9); c.lineTo(-10, 2); c.quadraticCurveTo(4, 4, 18, 0); c.fill();
        c.beginPath(); c.moveTo(4, -1); c.quadraticCurveTo(-2, -22 * f, -20, -34 * f); c.quadraticCurveTo(-6, -14 * f, -6, 0); c.fill();
        c.beginPath(); c.moveTo(4, 1); c.quadraticCurveTo(-2, 22 * f * .6 + 6, -18, 30 * f * .6 + 8); c.quadraticCurveTo(-6, 12, -6, 0); c.fill();
        c.restore();
      }
    },
    egrets(c, t, sd) {
      for (let i = 0; i < 5; i++) {
        const tt = t * .045 + rnd(i, sd) * .3;
        const x = lerp(W * 1.05, -W * .1, tt) + rnd(i, 2) * 200, y = H * (.25 + rnd(i, 3) * .2) + Math.sin(t * .7 + i) * 12;
        const s = .7 + rnd(i, 4) * .6, f = Math.sin(t * 4 + i * 1.7);
        c.save(); c.translate(x, y); c.scale(-s, s); c.fillStyle = 'rgba(250,250,248,.95)'; c.strokeStyle = 'rgba(60,60,60,.5)'; c.lineWidth = 1;
        c.beginPath(); c.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-10, -26 * f, -34, -30 * f); c.quadraticCurveTo(-16, -8 * f, 6, 0); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(14, -1); c.lineTo(26, -6); c.stroke();
        c.restore();
      }
    },
    lanterns(c, t, sd) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const sp = 10 + rnd(i, sd) * 22, y = H - ((rnd(i, sd + 1) * (H + 200) + t * sp) % (H + 200)) + 100;
        const x = rnd(i, sd + 2) * W + Math.sin(t * .4 + i) * 20;
        const r = 10 + rnd(i, sd + 3) * 34, fl = .55 + .45 * Math.sin(t * (3 + rnd(i, 5) * 4) + i);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,190,110,${.32 * fl})`); g.addColorStop(.4, `rgba(255,120,50,${.12 * fl})`); g.addColorStop(1, 'rgba(255,90,30,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    },
    gold(c, t, sd) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 90; i++) {
        const y = H - ((rnd(i, sd) * H + t * (12 + rnd(i, 1) * 25)) % H);
        const x = rnd(i, sd + 2) * W + Math.sin(t * .5 + i) * 15;
        const tw = Math.pow(Math.max(0, Math.sin(t * (1.5 + rnd(i, 3) * 3) + i * 2.1)), 3);
        const r = 1 + rnd(i, 4) * 2.4;
        c.fillStyle = `rgba(255,214,130,${.15 + .7 * tw})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        if (tw > .7) { c.strokeStyle = `rgba(255,230,170,${(tw - .7) * 1.5})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r * 5, y); c.lineTo(x + r * 5, y); c.moveTo(x, y - r * 5); c.lineTo(x, y + r * 5); c.stroke(); }
      }
      c.globalCompositeOperation = 'source-over';
    },
    ash(c, t, sd) {
      for (let i = 0; i < 110; i++) {
        const sp = 18 + rnd(i, sd) * 30, y = ((rnd(i, sd + 1) * (H + 40) + t * sp) % (H + 40)) - 20;
        const x = (rnd(i, sd + 2) * W + Math.sin(t * .6 + i) * 30 + W) % W;
        const r = 1.2 + rnd(i, 3) * 2.8;
        c.fillStyle = `rgba(${200 + rnd(i, 4) * 40 | 0},${200 + rnd(i, 4) * 40 | 0},${200 + rnd(i, 4) * 40 | 0},${.25 + rnd(i, 5) * .45})`;
        c.save(); c.translate(x, y); c.rotate(t + i); c.fillRect(-r, -r * .6, r * 2, r * 1.2); c.restore();
      }
    },
    steam(c, t, sd) {
      for (let i = 0; i < 16; i++) {
        const life = 4.5, ph = (t + rnd(i, sd) * life) % life, k = ph / life;
        const x = W * (.44 + rnd(i, 2) * .14) + Math.sin(ph * 1.3 + i) * 40 * k, y = H * .62 - k * H * .55;
        const r = 40 + k * 180, a = Math.sin(Math.PI * k) * .13;
        const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    },
    dust(c, t, sd) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 90; i++) {
        const x = (rnd(i, sd) * W + t * (8 + rnd(i, 1) * 14) + Math.sin(t * .3 + i) * 30) % W, y = (rnd(i, sd + 2) * H + Math.sin(t * .5 + i * 3) * 30);
        const a = .12 + .25 * Math.pow(Math.sin(t * (.4 + rnd(i, 3)) + i) * .5 + .5, 2);
        c.fillStyle = `rgba(255,235,200,${a})`; c.beginPath(); c.arc(x, y, .8 + rnd(i, 4) * 2, 0, Math.PI * 2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    },
    sunbeam(c, t) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        c.save(); c.translate(W * (.55 + i * .09), -60); c.rotate(.42 + i * .025);
        const a = .045 + .035 * Math.sin(t * .6 + i * 1.3);
        const g = c.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(.5, `rgba(255,236,190,${a})`); g.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = g; c.fillRect(-60 - i * 6, 0, 120 + i * 12, H * 1.6); c.restore();
      }
      c.globalCompositeOperation = 'source-over';
    },
  };

  function drawFx(ctx, s, T) {
    ctx.clearRect(0, 0, W, H);
    let any = false;
    for (const f of s.fx || []) if (FX[f]) { FX[f](ctx, T - s.vis0, s.idx * 7 + 3); any = true; }
    return any;
  }

  // ───────────── 程序绘制的镜头：手卷回望 / 片尾字幕 ─────────────
  function drawScroll(ctx, s, T) {
    const u = (T - s.vis0) / (s.vis1 - s.vis0);
    ctx.fillStyle = '#ece5d6'; ctx.fillRect(0, 0, W, H);
    const imgs = s.imgs.map(k => scrollImgs[k]).filter(Boolean);
    if (!imgs.length) return;
    const ph = 600, pw = ph * 16 / 9, ov = 140, step = pw - ov;
    const total = step * (imgs.length - 1) + pw;
    const z = lerp(H / ph * 1.0, 1, easeIO(u / .16));                   // 先从全屏拉远，露出整幅手卷
    const pan = easeIO((u - .1) / .9) * (total - pw);                     // 再向历史深处平移
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    const y0 = (H - ph) / 2, x0 = (W - pw) / 2 + pan;                      // 第 0 张在最右，后面的依次向左
    // 装裱：天头地头
    ctx.fillStyle = '#d9d2c2'; ctx.fillRect(-4000, y0 - 46, 12000, ph + 92);
    ctx.fillStyle = '#b9b2a0'; ctx.fillRect(-4000, y0 - 50, 12000, 3); ctx.fillRect(-4000, y0 + ph + 47, 12000, 3);
    const off = document.createElement('canvas'); off.width = Math.ceil(pw); off.height = ph; const o = off.getContext('2d');
    imgs.forEach((im, i) => {
      const x = x0 - i * step;
      if (x > W + 200 || x + pw < -200) return;
      o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, pw, ph);
      o.drawImage(im, 0, 0, pw, ph);
      o.globalCompositeOperation = 'destination-in';
      const g = o.createLinearGradient(0, 0, pw, 0);
      g.addColorStop(0, i === imgs.length - 1 ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)'); g.addColorStop(ov / pw, 'rgba(0,0,0,1)');
      g.addColorStop(1 - ov / pw, 'rgba(0,0,0,1)'); g.addColorStop(1, i === 0 ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)');
      o.fillStyle = g; o.fillRect(0, 0, pw, ph);
      ctx.drawImage(off, x, y0);
    });
    ctx.restore();
  }
  function drawCredits(ctx, s, T) {
    const t = T - s.vis0;
    ctx.fillStyle = '#ece6d8'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const a = ss(0.2, 1.0, t);
    ctx.globalAlpha = a;
    ctx.fillStyle = INK; ctx.font = `64px ${FONTS.ma}`; ctx.fillText('金陵 · 一卷未干的水墨', W / 2, 200);
    ctx.font = `30px ${FONTS.kai}`; ctx.fillStyle = '#3a3733';
    const lines = [['导演 · 剪辑 · 视觉', 'Claude'], ['旁白', 'MiniMax 语音合成'], ['水墨绘画', 'Codex 图像生成'], ['配乐 · 音效', '程序化合成'], ['实景照片', 'Wikimedia Commons 贡献者（CC BY / CC BY-SA）']];
    lines.forEach(([k, v], i) => { ctx.textAlign = 'right'; ctx.fillText(k, W / 2 - 30, 330 + i * 56); ctx.textAlign = 'left'; ctx.fillText(v, W / 2 + 30, 330 + i * 56); });
    ctx.textAlign = 'center'; ctx.font = `20px ${FONTS.kai}`; ctx.fillStyle = '#6a655c';
    const names = (window.CREDITS || []).join('  ·  ');
    const words = names.split('  ·  '); let line = '', y = 660;
    for (const w of words) { const tl = line ? line + '  ·  ' + w : w; if (ctx.measureText(tl).width > 1500) { ctx.fillText(line, W / 2, y); y += 32; line = w; } else line = tl; }
    if (line) ctx.fillText(line, W / 2, y);
    ctx.globalAlpha = 1;
  }

  // ───────────── 书法文字 ─────────────
  const glyphCache = new Map();
  function glyph(ch, font, size, color) {
    const k = ch + font + size + color;
    if (glyphCache.has(k)) return glyphCache.get(k);
    const pad = Math.ceil(size * .35), c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * 1.3 + pad * 2);
    const x = c.getContext('2d'); x.font = `${size}px ${FONTS[font] || font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color;
    x.fillText(ch, c.width / 2, c.height / 2 + size * .04);
    glyphCache.set(k, c); return c;
  }
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 900; const tx2 = tmp.getContext('2d');
  // 单字：k=书写进度（自上而下显出 + 墨晕），a=整体透明度
  function inkChar(ctx, ch, x, y, size, font, style, k, a = 1, halo = 1) {
    if (k <= 0 || a <= 0) return;
    const color = style === 'light' ? LIGHT : style === 'red' ? RED : INK;
    const g = glyph(ch, font, size, color), gw = g.width;
    let src = g;
    if (k < 1) {
      tx2.clearRect(0, 0, gw, gw); tx2.globalCompositeOperation = 'source-over'; tx2.drawImage(g, 0, 0);
      tx2.globalCompositeOperation = 'destination-in';
      const e = easeOut(k), y1 = gw * (e * 1.25 - .05);
      const gr = tx2.createLinearGradient(0, y1 - gw * .3, 0, y1);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      tx2.fillStyle = gr; tx2.fillRect(0, 0, gw, gw);
      tx2.globalCompositeOperation = 'source-over';
      src = tmp;
    }
    ctx.save();
    ctx.globalAlpha = a;
    if (halo > 0) {
      ctx.shadowColor = style === 'light' ? `rgba(0,0,0,${.5 * halo})` : `rgba(250,246,236,${.4 * halo})`;
      ctx.shadowBlur = size * (style === 'light' ? .22 : .4);
    }
    ctx.drawImage(src, 0, 0, gw, gw, x - gw / 2, y - gw / 2, gw, gw);
    ctx.shadowBlur = 0;
    if (k < 1) { ctx.globalAlpha = a * (1 - k) * .55; ctx.filter = `blur(${(size * .06 * (1 - k) + 1).toFixed(1)}px)`; ctx.drawImage(src, 0, 0, gw, gw, x - gw / 2, y - gw / 2, gw, gw); ctx.filter = 'none'; }
    ctx.restore();
  }
  function plain(ctx, str, x, y, size, font, color, opt = {}) {
    ctx.save(); ctx.font = `${size}px ${FONTS[font] || font}`; ctx.textAlign = opt.align || 'center'; ctx.textBaseline = 'middle';
    if (opt.spacing) ctx.letterSpacing = opt.spacing + 'px';
    ctx.globalAlpha = opt.a ?? 1; ctx.fillStyle = color;
    ctx.shadowColor = opt.shadow || (color === INK || color === RED ? 'rgba(250,246,236,.85)' : 'rgba(0,0,0,.7)'); ctx.shadowBlur = opt.blur ?? size * .3;
    ctx.fillText(str, x, y); ctx.restore();
  }
  function vplain(ctx, str, x, y, size, font, color, opt = {}) {
    [...str].forEach((ch, i) => plain(ctx, ch === '·' ? '︙' : ch, x, y + i * size * (opt.lh || 1.18), size, font, color, opt));
  }
  // 印章
  function seal(ctx, cx, cy, size, text, a = 1, born = 1, rot = -.04) {
    if (a <= 0) return;
    const k = easeOut(born), sc = lerp(1.5, 1, k);
    ctx.save(); ctx.globalAlpha = a * clamp(born * 2.5); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
    const h = size / 2;
    ctx.fillStyle = 'rgba(176,38,30,.94)';
    ctx.beginPath();
    const seed = text.charCodeAt(0);
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, side = Math.floor(t * 4), f = (t * 4) % 1, j = (rnd(i, seed) - .5) * size * .025;
      const pts = [[-h + f * 2 * h, -h], [h, -h + f * 2 * h], [h - f * 2 * h, h], [-h, h - f * 2 * h]][side % 4];
      i ? ctx.lineTo(pts[0] + j, pts[1] + j) : ctx.moveTo(pts[0] + j, pts[1] + j);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8efe2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const chs = [...text];
    if (chs.length === 1) { ctx.font = `${size * .7}px ${FONTS.ma}`; ctx.fillText(chs[0], 0, size * .03); }
    else if (chs.length === 2) { ctx.font = `${size * .42}px ${FONTS.ma}`; ctx.fillText(chs[0], 0, -size * .2); ctx.fillText(chs[1], 0, size * .24); }
    else { ctx.font = `${size * .38}px ${FONTS.ma}`; [[.22, -.2], [.22, .24], [-.22, -.2], [-.22, .24]].forEach(([px, py], i) => chs[i] && ctx.fillText(chs[i], px * size, py * size)); }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(0,0,0,${.25 + rnd(i, seed + 1) * .5})`; ctx.beginPath(); ctx.arc((rnd(i, seed + 2) - .5) * size, (rnd(i, seed + 3) - .5) * size, rnd(i, seed + 4) * size * .025 + .5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  const autoStyle = (T, x, y, w, h) => lumAt(T, x, y, w, h) > 0.44 ? 'ink' : 'light';
  const styleColor = st => st === 'light' ? LIGHT : st === 'red' ? RED : INK;

  // 句中某个字被念到的时刻
  function markTime(tx, str, from = 0) {
    const m = tx.marks; if (!m.length) return null;
    for (let i = from; i < m.length; i++) {
      let ok = true;
      for (let j = 0; j < str.length; j++) if (!m[i + j] || m[i + j][0] !== str[j]) { ok = false; break; }
      if (ok) return { t: m[i][1], i };
    }
    return null;
  }

  function drawTexts(ctx, T) {
    ctx.clearRect(0, 0, W, H);
    for (const tx of L.texts) {
      const t0 = tx.bs, t1 = tx.bs + tx.bd;
      if (T < t0 - .5 || T > t1 + 1.2) continue;
      const out = 1 - ss(t1 - .7, t1 + .1, T);
      const R = TEXT[tx.k]; if (R) R(ctx, tx, T, out);
    }
    // 镜头地名 / 季节印
    for (const s of activeShots(T)) {
      const a = ss(s.start + .5, s.start + 1.3, T) * (1 - ss(s.end - .6, s.end + .2, T));
      if (s.label && a > 0) {
        const [main, sub] = s.label.split(' · ');
        const st = autoStyle(T, .03, .07, .08, .4);
        const col = styleColor(st);
        seal(ctx, 118, 96, 26, '印', a, 1, 0);
        vplain(ctx, main, 118, 148, 38, 'kai', col, { a, lh: 1.15, blur: 16 });
        if (sub) vplain(ctx, sub, 72, 160, 24, 'kai', col, { a: a * .9, lh: 1.2, blur: 12 });
      }
      if (s.season) {
        const b = clamp((T - s.start - .25) / .3), a2 = 1 - ss(s.end - .4, s.end + .1, T);
        seal(ctx, 170, 170, 120, s.season, a2, b, -.06);
      }
    }
    // 字幕
    for (const sb of TL.subs) {
      if (T < sb.a - .2 || T > sb.b + .2) continue;
      const a = ss(sb.a - .12, sb.a + .08, T) * (1 - ss(sb.b - .16, sb.b + .02, T));
      ctx.save(); ctx.font = `44px ${FONTS.kai}`; ctx.letterSpacing = '3px';
      const tw = ctx.measureText(sb.s).width + 260;
      ctx.translate(W / 2, H - 74); ctx.scale(tw / 2, 58);
      const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); bg.addColorStop(0, `rgba(10,9,8,${.42 * a})`); bg.addColorStop(.6, `rgba(10,9,8,${.25 * a})`); bg.addColorStop(1, 'rgba(10,9,8,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      plain(ctx, sb.s, W / 2, H - 74, 44, 'kai', '#fbf7ef', { a, spacing: 3, shadow: 'rgba(0,0,0,.85)', blur: 10 });
      plain(ctx, sb.s, W / 2, H - 74, 44, 'kai', '#fbf7ef', { a: a * .9, spacing: 3, shadow: 'rgba(0,0,0,.6)', blur: 3 });
    }
  }

  const NAME_POS = [[.26, .32], [.66, .26], [.42, .62], [.78, .6], [.2, .7]];
  const NAME_FONTS = ['xing', 'ma', 'cao', 'long', 'xing'];
  const TEXT = {
    chapter(ctx, tx, T, out) {
      const st0 = tx.bs + .5, end = tx.voice ? tx.voice.start + 1.8 : tx.bs + tx.bd - .6;
      if (T < st0 || T > end + 1) return;
      const a = 1 - ss(end, end + .9, T);
      const st = autoStyle(T, .74, .12, .24, .62);
      seal(ctx, 1770, 160, 92, tx.n, a, clamp((T - st0) / .35));
      [...tx.a].forEach((ch, i) => inkChar(ctx, ch, 1690, 300 + i * 150, 132, 'ma', st, clamp((T - st0 - .3 - i * .35) / .7), a));
      [...tx.b].forEach((ch, i) => inkChar(ctx, ch, 1540, 380 + i * 96, 82, 'xing', st, clamp((T - st0 - 1.0 - i * .3) / .6), a));
    },
    poem(ctx, tx, T, out) {
      const size = tx.size || 90, cols = tx.cols, n = cols.length, gap = size * 1.5;
      const maxLen = Math.max(...cols.map(c => c.length)), lh = size * 1.12;
      const cx = (tx.x ?? .5) * W, y0 = H / 2 - (maxLen - 1) * lh / 2 - 20;
      const st = tx.dark ? 'ink' : autoStyle(T, (tx.x ?? .5) - .12, .15, .24, .7);
      let from = 0, last = tx.bs;
      cols.forEach((col, ci) => {
        const x = cx + ((n - 1) / 2 - ci) * gap;
        const mt = markTime(tx, col, from);
        let tc = mt ? mt.t : tx.bs + (tx.at ?? 0) * tx.bd + ci * 1.2;
        if (mt) from = mt.i + col.length;
        [...col].forEach((ch, i) => {
          const tci = mt && tx.marks[mt.i + i] ? tx.marks[mt.i + i][1] - .25 : tc + i * .28;
          last = Math.max(last, tci);
          inkChar(ctx, ch, x, y0 + i * lh, size, tx.font || 'xing', st, clamp((T - tci) / .55), out);
        });
      });
      if (tx.by) {
        const a = clamp((T - last - .3) / .8) * out;
        const bx = cx - (n - 1) / 2 * gap - size * 1.05, by = y0 + (maxLen - 1) * lh - tx.by.length * 30 + 10;
        vplain(ctx, tx.by, bx, by, 26, 'kai', styleColor(st), { a, lh: 1.15, blur: 10 });
        seal(ctx, bx, by + tx.by.length * 30 + 22, 30, '吟', a, 1, 0);
      }
    },
    names(ctx, tx, T, out) {
      let from = 0;
      tx.list.forEach((nm, i) => {
        const mt = markTime(tx, nm, from); if (mt) from = mt.i + nm.length;
        const t0 = (mt ? mt.t : tx.bs + (tx.at ?? 0) * tx.bd + i * .8) - .2;
        if (tx.stay) {
          const st = autoStyle(T, .7, .2, .25, .6);
          [...nm].forEach((ch, j) => inkChar(ctx, ch, 1700 - i * 120, 330 + j * 96, 84, 'xing', st, clamp((T - t0 - j * .12) / .5), out));
        } else {
          const [px, py] = NAME_POS[i % NAME_POS.length];
          const life = 1 - ss(t0 + 1.4, t0 + 2.2, T);
          const st = autoStyle(T, px - .1, py - .1, .2, .2);
          [...nm].forEach((ch, j) => inkChar(ctx, ch, px * W + (j - (nm.length - 1) / 2) * 175, py * H, 160, NAME_FONTS[i % 5], st, clamp((T - t0 - j * .15) / .6), life * out));
        }
      });
    },
    pop(ctx, tx, T, out) {
      const t0 = tx.bs + tx.at * tx.bd, k = clamp((T - t0) / .55);
      if (k <= 0) return;
      const end = tx.stay ? tx.bs + tx.stay * tx.bd + 1.2 : tx.bs + tx.bd;
      const a = (1 - ss(end - .6, end, T)) * out;
      const size = tx.size || 110, chs = [...tx.s];
      const st = tx.red ? 'red' : tx.style || autoStyle(T, tx.x - .15, tx.y - .08, .3, .16);
      ctx.save(); const sc = lerp(1.16, 1, easeOut(k));
      ctx.translate(tx.x * W, tx.y * H); ctx.scale(sc, sc); ctx.translate(-tx.x * W, -tx.y * H);
      chs.forEach((ch, i) => inkChar(ctx, ch, tx.x * W + (i - (chs.length - 1) / 2) * size * 1.05, tx.y * H, size, tx.font || 'ma', st, clamp(k * 1.6 - i * .08), a));
      ctx.restore();
      if (tx.sub2) plain(ctx, tx.sub2, tx.x * W, tx.y * H + size * .9, 30, 'serif', styleColor(st === 'red' ? 'ink' : st), { a: a * clamp(k * 2 - .6), spacing: 6 });
    },
    note(ctx, tx, T, out) {
      const t0 = tx.bs + tx.at * tx.bd;
      const sib = L.texts.filter(o => o.k === 'note' && o.beat === tx.beat && o.at > tx.at).map(o => o.bs + o.at * o.bd);
      const end = sib.length ? Math.min(...sib) - .1 : tx.bs + tx.bd;
      if (T < t0 || T > end + .5) return;
      const a = ss(t0, t0 + .5, T) * (1 - ss(end - .3, end + .2, T)) * out;
      const st = autoStyle(T, tx.x - .05, tx.y, .1, .5);
      const chs = [...tx.s.replace(/[《》]/g, '')];
      chs.forEach((ch, i) => inkChar(ctx, ch, tx.x * W, tx.y * H + i * 78, 68, 'ma', st, clamp((T - t0 - i * .12) / .5), a));
      const yb = tx.y * H - 62, ye = tx.y * H + (chs.length - 1) * 78 + 62;
      ctx.save(); ctx.globalAlpha = a * .8; ctx.strokeStyle = styleColor(st); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx.x * W - 48, yb); ctx.lineTo(tx.x * W + 48, yb); ctx.moveTo(tx.x * W - 48, ye); ctx.lineTo(tx.x * W + 48, ye); ctx.stroke(); ctx.restore();
    },
    title(ctx, tx, T, out) {
      const t0 = (tx.voice ? tx.voice.start : tx.bs) - .15;
      const im = BRUSH.g_stroke;
      if (im) {
        const k = easeOut(clamp((T - t0 + .5) / 1.1)), w = 1500, h = w * im.height / im.width;
        const x = W / 2 - w / 2 + 40, y = H * .43 - h / 2 + 30;
        ctx.save(); ctx.globalAlpha = .26 * out; ctx.beginPath(); ctx.rect(x, y - 50, w * k, h + 100); ctx.clip();
        ctx.drawImage(im, x, y, w, h); ctx.restore();
      }
      const chs = [...tx.s], size = 290;
      chs.forEach((ch, i) => inkChar(ctx, ch, W / 2 + (i - .5) * size * 1.12, H * .43, size, 'ma', 'ink', clamp((T - t0 - i * .45) / .9), out, 0));
      seal(ctx, W / 2 + size * 1.25, H * .43 + size * .42, 84, '南京', out, clamp((T - t0 - 1.5) / .3));
      plain(ctx, tx.sub2, W / 2, H * .68, 46, 'kai', INK, { a: ss(t0 + 2.0, t0 + 3.0, T) * out, spacing: 22 });
    },
    final(ctx, tx, T, out) {
      const t0 = tx.bs + tx.at, size = 230;
      const im = BRUSH.g_enso;
      if (im) {
        const k = clamp((T - t0 + .9) / 1.5), e = 1 - Math.pow(1 - k, 2.2), D = 700, cx = W / 2, cy = H * .44;
        const a0 = Math.PI * .75;
        ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, D, a0, a0 + Math.PI * 2 * e * 1.04); ctx.closePath(); ctx.clip();
        ctx.globalAlpha = .92; ctx.drawImage(im, cx - D / 2 * im.width / im.height, cy - D / 2, D * im.width / im.height, D); ctx.restore();
      }
      ['南', '京'].forEach((ch, i) => inkChar(ctx, ch, W / 2 + (i - .5) * size * 1.06, H * .44, size, 'ma', 'ink', clamp((T - t0 - .5 - i * .55) / 1.0), 1, 0));
      seal(ctx, W / 2 + 330, H * .66, 86, '金陵', 1, clamp((T - t0 - 2.1) / .3));
      plain(ctx, '一卷金陵  ·  欢迎落笔', W / 2, H * .855, 46, 'kai', INK, { a: ss(t0 + 2.8, t0 + 3.8, T), spacing: 10, blur: 0 });
      plain(ctx, 'NANJING  ·  UNESCO CITY OF LITERATURE', W / 2, H * .915, 22, 'serif', '#4a4640', { a: ss(t0 + 3.4, t0 + 4.4, T), spacing: 8, blur: 0 });
    },
  };

  // ───────────── 每帧渲染 ─────────────
  function setTex(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  function renderShot(s, T, slot) {
    const P = PS, u = P.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB[slot].f); gl.viewport(0, 0, W, H); gl.useProgram(P.p);
    gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uTime, T); gl.uniform1f(u.uLocal, T - s.vis0);
    let look = { photo: 0, ink: 1, bleed: 2, paint: 3 }[s.look] ?? 3, a = null, ai = null;
    if (s.k === 'scroll' || s.k === 'credits') {
      const c = srcCv[slot].getContext('2d');
      s.k === 'scroll' ? drawScroll(c, s, T) : drawCredits(c, s, T);
      upload(srcTex[slot], srcCv[slot]); setTex(0, srcTex[slot], u.uImg); look = 4;
      gl.uniform4f(u.uXf, 1, 1, .5, .5);
    } else {
      a = cache.get(s.img); ai = cache.get(s.img + '_ink');
      setTex(0, a ? a.tex : paperTex, u.uImg);
      gl.uniform4fv(u.uXf, xform(s, a, T));
    }
    setTex(1, (ai || a || {}).tex || paperTex, u.uInk);
    setTex(3, paperTex, u.uPaperTex);
    gl.uniform1f(u.uLook, look);
    gl.uniform1f(u.uBleed, s.look === 'bleed' ? bleedP(s, T) : 0);
    gl.uniform1f(u.uSeed, (s.idx * 13.37) % 50);
    const fxv = { uMist: 0, uSwirl: 0, uGlow: 0, uRipple: 0, uLamp: 0, uCity: 0, uDawn: 0 };
    for (const f of s.fx || []) if (SHADER_FX[f]) fxv[SHADER_FX[f]] = 1;
    for (const k in fxv) gl.uniform1f(u[k], fxv[k]);
    gl.uniform1f(u.uDark, s.dark || 0);
    // 墨滴
    let drop = 0, dropT = 0;
    if ((s.fx || []).includes('inkdrop')) { drop = 1; dropT = T - s.start - 1.6; }
    if ((s.fx || []).includes('inkdrop_end')) { drop = 2; dropT = T - s.start - 0.15; }
    gl.uniform1f(u.uDrop, drop); gl.uniform1f(u.uDropT, dropT); gl.uniform2f(u.uDropC, .5, drop === 2 ? .56 : .5);
    const has = drawFx(fxCv[slot].getContext('2d'), s, T);
    if (has) upload(fxTex[slot], fxCv[slot]);
    setTex(2, fxTex[slot], u.uFx); gl.uniform1f(u.uHasFx, has ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  const TYPE = { cut: 0, ink: 1, wash: 2, brush: 3, fade: 4, black: 5, scroll: 6 };
  function render(T) {
    const act = activeShots(T);
    act.forEach((s, i) => renderShot(s, T, i));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    const P = PC, u = P.u; gl.useProgram(P.p);
    gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uTime, T);
    setTex(0, FB[0].t, u.uA); setTex(1, FB[act.length > 1 ? 1 : 0].t, u.uB);
    let two = 0, p = 1, type = 4, seed = 0, origin = [.5, .5];
    const s1 = act[act.length - 1];
    if (act.length > 1) { two = 1; p = clamp((T - s1.vis0) / Math.max(.01, s1.vis1 > 0 ? s1.td : 1)); type = TYPE[s1.tr || 'ink'] ?? 1; seed = (s1.idx * 7.7) % 40; origin = s1.origin || [.3 + rnd(s1.idx, 1) * .4, .35 + rnd(s1.idx, 2) * .3]; }
    else if (s1 && s1.tr === 'black' && T < s1.start + s1.td) { two = 1; p = (T - s1.start) / s1.td; type = 5; setTex(1, FB[0].t, u.uB); }
    gl.uniform1f(u.uTwo, two); gl.uniform1f(u.uP, p); gl.uniform1f(u.uType, type); gl.uniform1f(u.uSeed, seed); gl.uniform2f(u.uOrigin, origin[0], origin[1]);
    let mood = 0; for (const [a, b] of L.dark) mood = Math.max(mood, ss(a - .4, a + 1.4, T) * (1 - ss(b - 1.2, b + .4, T)));
    gl.uniform1f(u.uMood, mood);
    gl.uniform1f(u.uFadeBlack, ss(L.duration - 1.6, L.duration, T));
    drawTexts(tctx, T); upload(textTex, textCv); setTex(2, textTex, u.uText);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ───────────── 对外接口 ─────────────
  window.ready = (async () => {
    const fams = Object.values(FONTS);
    await Promise.all(fams.map(f => document.fonts.load(`40px ${f}`, '金陵南京一卷水墨六朝')));
    const pim = await PAPER_IMG; paperTex = tex(pim, false);
    gl.bindTexture(gl.TEXTURE_2D, paperTex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return true;
  })();
  window.grab = async (T, q = .93) => { await window.ready; await ensure(T); render(T); return canvas.toDataURL('image/jpeg', q); };
  window.renderAt = async T => { await window.ready; await ensure(T); render(T); };
  window.DURATION = L.duration;

  if (!Q.has('render')) {
    const audio = document.getElementById('a');
    const t0 = +(Q.get('t') || 0);
    (async () => {
      await window.renderAt(t0);
      if (Q.has('play')) {
        audio.currentTime = t0; audio.play().catch(() => {});
        const loop = async () => { await window.renderAt(audio.currentTime); requestAnimationFrame(loop); };
        loop();
      }
    })();
  }
})();
