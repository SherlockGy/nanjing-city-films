/* 12 站的线描插画：全部由代码生成。
 * 每站返回 { strokes, fills, extra?, lineAfter? }，坐标是格子内的本地坐标（1080×1440，画面区约 y 80–900）。
 * strokes 会被依次连成一条连续的线（“一笔画”）；fills 是线画完后弹出的平涂色块。 */
(function (root) {
  const PI = Math.PI;
  const q = (p0, c, p1, n = 12) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return o; };
  const cb = (p0, p1, p2, p3, n = 18) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return o; };
  const ln = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const arc = (cx, cy, rx, ry, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const circ = (cx, cy, r, n = 40) => arc(cx, cy, r, r, -PI / 2, 1.5 * PI, n);
  const cat = (...ps) => ps.reduce((o, p) => o.concat(o.length && p.length && o[o.length - 1][0] === p[0][0] && o[o.length - 1][1] === p[0][1] ? p.slice(1) : p), []);
  const wave = (x0, x1, y, amp, len, ph = 0) => { const o = []; const n = Math.max(8, Math.round(Math.abs(x1 - x0) / 10)); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; o.push([x, y + Math.sin((x / len) * 2 * PI + ph) * amp]); } return o; };
  const blob = (cx, cy, r, bumps = 7, depth = .16, rot = 0, n = 70) => Array.from({ length: n + 1 }, (_, i) => { const a = rot - PI / 2 + 2 * PI * i / n; const rr = r * (1 + depth * Math.pow(Math.abs(Math.sin(a * bumps / 2)), .55)); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
  const T = (pts, dx, dy, s = 1, flip = false, ox = 0) => pts.map(([x, y]) => [dx + (flip ? (ox - x) : x) * s, dy + y * s]);
  // 中式屋顶（正立面）：y 为檐口，h 为屋高，两端起翘
  function roof(cx, y, w, h, curl = .32, ridge = .56) {
    const l = cx - w / 2, r = cx + w / 2, c = h * curl, rw = w * ridge / 2;
    const tipL = [l - w * .03, y - c], tipR = [r + w * .03, y - c], eL = [l + w * .17, y], eR = [r - w * .17, y];
    const rL = [cx - rw, y - h], rR = [cx + rw, y - h];
    return cat(q(tipL, [l + w * .07, y + 2], eL, 8), [eL, eR], q(eR, [r - w * .07, y + 2], tipR, 8),
      q(tipR, [r - w * .13, y - h * .42], rR, 10), [[rR[0] + 7, rR[1] - 13], [rR[0] - 3, rR[1]], [rL[0] + 3, rL[1]], [rL[0] - 7, rL[1] - 13], rL],
      q(rL, [l + w * .13, y - h * .42], tipL, 10));
  }
  const door = (cx, base, w, h) => cat([[cx - w / 2, base], [cx - w / 2, base - h + w / 2]], arc(cx, base - h + w / 2, w / 2, w / 2, PI, 2 * PI, 16), [[cx + w / 2, base - h + w / 2], [cx + w / 2, base]]);
  const zig = (x0, x1, yTop, yBot, step) => { const o = []; let up = true; for (let x = x0; x <= x1 + .1; x += step / 2) { o.push([x, up ? yTop : yBot]); up = !up; } return o; };
  const crenel = (x0, x1, y, h, mw, gap) => { const o = [[x0, y]]; let x = x0; while (x + mw + gap <= x1) { o.push([x, y - h], [x + mw, y - h], [x + mw, y], [x + mw + gap, y]); x += mw + gap; } o.push([x1, y]); return o; };
  const lantern = (cx, cy, r) => cat(arc(cx, cy, r * .8, r, -PI / 2, 1.5 * PI, 18), [[cx, cy + r], [cx, cy + r * 1.7]]);
  const ELE = [[10, 72], [38, 30], [100, 14], [160, 22], [198, 18], [226, 44], [236, 92], [232, 150], [222, 188], [236, 196], [214, 198], [210, 150], [208, 112], [194, 122], [192, 198], [160, 198], [162, 140], [110, 146], [100, 198], [68, 198], [60, 128], [24, 104], [10, 72]];
  const EAR = [[148, 40], [186, 48], [188, 102], [158, 108], [148, 78]];
  // 小鸭（朝左）：身体、头、翅膀、尾巴
  const DUCK_BODY = cat(q([-30, 10], [-80, 40], [-60, 90]), q([-60, 90], [10, 130], [90, 80]), [[120, 40]], q([120, 40], [90, 60], [70, 40]), q([70, 40], [20, 0], [-30, 10]));
  const DUCK_HEAD = arc(-55, -25, 40, 40, 0, 2 * PI, 30);
  const DUCK_WING = q([0, 50], [40, 30], [70, 70], 8);

  const ART = {
    bridge() {
      const s = [];
      s.push(circ(790, 360, 95));
      s.push([[70, 640], [70, 470], [86, 470], [86, 380], [102, 380], [102, 300], [172, 300], [172, 380], [188, 380], [188, 470], [204, 470], [204, 640]]);
      for (let k = 0; k < 3; k++) { const bx = 112 + k * 26; s.push(cat([[bx, 300], [bx + 8, 186]], q([bx + 8, 186], [bx + 50, 170], [bx + 84, 196], 8), q([bx + 84, 196], [bx + 60, 222], [bx + 9, 232], 8))); }
      s.push(ln(204, 470, 1080, 470)); s.push(zig(240, 1080, 470, 600, 64)); s.push(ln(204, 600, 1080, 600)); s.push(ln(204, 640, 1080, 640));
      s.push(rect(430, 640, 54, 170)); s.push(rect(800, 640, 54, 170));
      s.push(wave(0, 1080, 830, 7, 90)); s.push(wave(1080, 120, 870, 6, 70, 1)); s.push(wave(200, 900, 905, 5, 60, 2));
      return {
        strokes: s,
        fills: [
          { circle: [790, 360, 95], color: '#F08A4B' },
          { pts: [[0, 812], [1080, 812], [1080, 940], [0, 940]], color: '#3E6E92' },
          { pts: [[70, 640], [70, 470], [86, 470], [86, 380], [102, 380], [102, 300], [172, 300], [172, 380], [188, 380], [188, 470], [204, 470], [204, 640]], color: '#EFE2CB' },
          ...[0, 1, 2].map(k => { const bx = 112 + k * 26; return { pts: cat([[bx + 8, 186]], q([bx + 8, 186], [bx + 50, 170], [bx + 84, 196], 8), q([bx + 84, 196], [bx + 60, 222], [bx + 9, 232], 8)), color: '#D2382B' }; }),
          { pts: rect(430, 640, 54, 170), color: '#9C978D' }, { pts: rect(800, 640, 54, 170), color: '#9C978D' },
          { pts: [[204, 455], [1080, 455], [1080, 470], [204, 470]], color: '#C8372D' },
        ],
        extra(c, lt, k) { // 火车穿过桁架，桥面车流
          if (k <= 0) return;
          const x = -500 + ((lt * 520) % 2100);
          c.fillStyle = '#2B3A4A';
          for (let j = 0; j < 7; j++) { const xx = x + j * 74; if (xx > 200 && xx < 1080) { c.fillRect(xx, 556, 68, 40); c.fillStyle = '#FFD36B'; c.fillRect(xx + 10, 564, 12, 10); c.fillRect(xx + 34, 564, 12, 10); c.fillStyle = '#2B3A4A'; } }
          for (let j = 0; j < 6; j++) { const xx = 1080 - ((lt * 300 + j * 190) % 900); c.fillStyle = ['#C8372D', '#F2C14E', '#3E6E92'][j % 3]; c.fillRect(xx, 440, 34, 14); }
        },
      };
    },
    jiming() {
      const s = [], f = [];
      s.push(cat([[60, 860], [60, 720]], roof(540, 720, 1000, 46, .4, .9), [[1020, 720], [1020, 860]]));
      f.push({ pts: [[60, 860], [60, 720], [1020, 720], [1020, 860]], color: '#E9B53B' });
      f.push({ pts: roof(540, 720, 1000, 46, .4, .9), color: '#59606A' });
      // 药师塔七层
      let y = 674; const cx = 660;
      for (let k = 0; k < 7; k++) {
        const bw = 128 - k * 11, bh = 44 - k * 2, rw = bw + 78;
        s.push(rect(cx - bw / 2, y - bh, bw, bh)); f.push({ pts: rect(cx - bw / 2, y - bh, bw, bh), color: '#F3E7D1' });
        s.push(door(cx, y, 22, 34));
        const r = roof(cx, y - bh, rw, 30, .5, .5); s.push(r); f.push({ pts: r, color: '#4A5562' });
        y -= bh + 26;
      }
      s.push(cat([[cx, y + 4], [cx, y - 70]], circ(cx, y - 24, 10, 14)));
      // 樱花树
      s.push(cat(q([170, 860], [150, 700], [240, 600]), q([240, 600], [290, 520], [330, 440])));
      s.push(q([240, 600], [170, 540], [110, 470])); s.push(q([300, 500], [380, 470], [450, 380]));
      const bl = [[110, 450, 70], [210, 380, 80], [330, 400, 75], [450, 350, 70], [380, 300, 60], [120, 560, 55]];
      for (const [x, yy, r] of bl) { const b = blob(x, yy, r, 9, .14, x); s.push(b); f.push({ pts: b, color: '#F6B8C8' }); }
      return {
        strokes: s, fills: f,
        extra(c, lt, k) {
          if (k <= 0) return;
          for (let i = 0; i < 40; i++) {
            const sp = 40 + (i * 37 % 50), x = (i * 97 % 900) + 60 + Math.sin(lt * 1.3 + i) * 40 + lt * 25, yy = ((i * 53 % 700) + lt * sp) % 760 + 120;
            c.save(); c.translate(x % 1080, yy); c.rotate(lt * 2 + i); c.fillStyle = i % 3 ? '#F7A9BE' : '#FBD3DE';
            c.beginPath(); c.ellipse(0, 0, 9, 5, 0, 0, PI * 2); c.fill(); c.restore();
          }
        },
      };
    },
    wall() {
      const s = [], f = [];
      const top = crenel(40, 1040, 520, 40, 46, 30);
      s.push(cat([[40, 870]], top, [[1040, 870]]));
      f.push({ pts: cat([[40, 870]], top, [[1040, 870]]), color: '#9D998F', pattern: 'brick' });
      for (const [x, w, h] of [[300, 112, 210], [540, 150, 260], [780, 112, 210]]) { const d = door(x, 870, w, h); s.push(d); f.push({ pts: d, color: '#34383C' }); }
      // 城楼
      s.push(cat([[380, 480], [380, 400]], roof(540, 400, 400, 80), [[700, 400], [700, 480]]));
      f.push({ pts: [[380, 480], [380, 400], [700, 400], [700, 480]], color: '#B83A2E' });
      f.push({ pts: roof(540, 400, 400, 80), color: '#3F4650' });
      for (const x of [430, 490, 590, 650]) s.push(ln(x, 400, x, 480));
      s.push(cat([[440, 322], [440, 296]], roof(540, 296, 270, 62), [[640, 296], [640, 322]]));
      f.push({ pts: roof(540, 296, 270, 62), color: '#3F4650' });
      // 柳
      s.push(cat(q([990, 940], [1000, 760], [960, 640])));
      for (let j = 0; j < 6; j++) s.push(q([960 - j * 22, 640 + j * 8], [930 - j * 30, 700], [940 - j * 26, 820 + j * 10], 8));
      s.push(wave(40, 1040, 900, 6, 80)); s.push(wave(1040, 120, 935, 5, 60, 1));
      f.push({ pts: [[0, 885], [1080, 885], [1080, 960], [0, 960]], color: '#6F9DB4' });
      return {
        strokes: s, fills: f,
        extra(c, lt, k, S) { // 放大镜看城砖铭文
          const a = Math.min(1, Math.max(0, (lt - S.BEAT * 8) / .35)); if (a <= 0) return;
          const x = 190, y = 680, r = 104 * (0.6 + .4 * a);
          c.save(); c.globalAlpha = a;
          c.fillStyle = '#C9C1B0'; c.beginPath(); c.arc(x, y, r, 0, PI * 2); c.fill();
          c.strokeStyle = '#1D1D1F'; c.lineWidth = 7; c.stroke();
          c.beginPath(); c.moveTo(x + r * .7, y + r * .7); c.lineTo(x + r * 1.15, y + r * 1.15); c.lineWidth = 14; c.stroke();
          c.fillStyle = '#4A3F33'; c.font = `bold ${26 * a + 4}px WenKai`; c.textAlign = 'center';
          c.fillText('××府 ××县', x, y - 18); c.fillText('窑匠 ×××', x, y + 22); c.fillText('洪武年造', x, y + 60);
          c.restore();
        },
      };
    },
    sunyat() {
      const s = [], f = [];
      const N = 16, yT = 540, yB = 900;
      const L = y => 440 + (180 - 440) * (y - yT) / (yB - yT), R = y => 640 + (900 - 640) * (y - yT) / (yB - yT);
      s.push([[L(yB), yB], [L(yT), yT], [R(yT), yT], [R(yB), yB]]);
      f.push({ pts: [[L(yB), yB], [L(yT), yT], [R(yT), yT], [R(yB), yB]], color: '#E6DDCB' });
      for (let k = 1; k < N; k++) { const y = yT + (yB - yT) * Math.pow(k / N, 1.35); s.push(k % 2 ? ln(L(y), y, R(y), y) : ln(R(y), y, L(y), y)); }
      s.push(rect(380, 410, 320, 130)); f.push({ pts: rect(380, 410, 320, 130), color: '#F6F3EC' });
      for (const x of [460, 540, 620]) s.push(door(x, 540, 46, 82));
      const r = roof(540, 410, 440, 110); s.push(r); f.push({ pts: r, color: '#2F6DB0' });
      for (const [x, h] of [[210, 300], [300, 240], [780, 240], [870, 300]]) {
        const t = cat([[x, 760]], [[x - 46, 760], [x - 16, 760 - h * .45], [x - 36, 760 - h * .45], [x, 760 - h], [x + 36, 760 - h * .45], [x + 16, 760 - h * .45], [x + 46, 760]], [[x, 760]]);
        s.push(t); f.push({ pts: t, color: '#2F5D45' });
      }
      return {
        strokes: s, fills: f,
        extra(c, lt, k, S) { // 台阶计数 0→392
          const p = Math.min(1, Math.max(0, (lt - .2) / (S.BEAT * 4))); if (p <= 0) return;
          const n = Math.round(392 * (1 - Math.pow(1 - p, 2)));
          c.save(); c.textAlign = 'right'; c.fillStyle = '#C8372D'; c.font = '900 120px NotoSerifSC'; c.fillText(String(n), 1005, 360);
          c.font = '700 34px NotoSansSC'; c.fillStyle = '#2B2B2B'; c.fillText('级台阶', 1005, 410); c.restore();
        },
      };
    },
    meiling() {
      const s = [], f = [];
      const cx = 540, cy = 480, R = 290;
      s.push(circ(cx, cy, R + 34, 80)); s.push(circ(cx, cy, R - 34, 80));
      for (let k = 0; k < 30; k++) {
        const a = -PI / 2 + 2 * PI * k / 30; if (Math.abs(Math.sin(a) - 1) < .02) continue;
        const b = blob(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 30, 6, .2, a, 30); s.push(b); f.push({ pts: b, color: k % 3 ? '#E8B53C' : '#F2CB5E' });
      }
      // 吊坠：美龄宫俯视
      s.push(ln(cx, cy + R + 34, cx, 820));
      const p = [[cx - 90, 820], [cx + 90, 820], [cx + 90, 920], [cx - 90, 920], [cx - 90, 820]];
      s.push(p); f.push({ pts: p, color: '#3E8E6E' });
      s.push([[cx - 90, 820], [cx - 40, 870], [cx + 40, 870], [cx + 90, 820]]); s.push([[cx - 90, 920], [cx - 40, 870]]); s.push([[cx + 40, 870], [cx + 90, 920]]);
      return {
        strokes: s, fills: f, lineAfter: '#F5D27A',
        extra(c, lt, k) {
          if (k <= 0) return;
          for (let i = 0; i < 26; i++) { // 金叶闪烁 + 飘落
            const a = i * 2.39, rr = R + Math.sin(i * 7.1) * 28;
            const tw = Math.pow(Math.max(0, Math.sin(lt * 3 + i * 1.7)), 6);
            c.fillStyle = `rgba(255,236,170,${tw})`; c.beginPath(); c.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6 + 6 * tw, 0, PI * 2); c.fill();
          }
          for (let i = 0; i < 18; i++) {
            const x = (i * 131 % 960) + 60 + Math.sin(lt + i) * 30, y = ((i * 71 % 800) + lt * (50 + i % 5 * 12)) % 860 + 60;
            c.save(); c.translate(x, y); c.rotate(lt * 2 + i); c.fillStyle = i % 2 ? '#F2C14E' : '#E39B2D';
            c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(9, 0, 0, 10); c.quadraticCurveTo(-9, 0, 0, -10); c.fill(); c.restore();
          }
        },
      };
    },
    elephant() {
      const s = [], f = [];
      s.push([[400, 940], [525, 560], [555, 560], [680, 940]]); f.push({ pts: [[400, 940], [525, 560], [555, 560], [680, 940]], color: '#E5D3AE' });
      for (const [x, y, r, col] of [[150, 400, 95, '#E07B33'], [370, 330, 80, '#E8B53C'], [710, 330, 80, '#E8B53C'], [930, 400, 95, '#C9532A']]) {
        s.push(cat([[x, 700]], [[x, y + r * .8]])); const b = blob(x, y, r, 8, .15, x); s.push(b); f.push({ pts: b, color: col });
      }
      const sc = 1.32, L = T(ELE, 70, 580, sc), Rr = T(ELE, 693, 580, sc, true, 240);
      for (const [e, er, dx] of [[L, T(EAR, 70, 580, sc), 70], [Rr, T(EAR, 693, 580, sc, true, 240), 693]]) {
        s.push(e); s.push(er); f.push({ pts: e, color: '#BDB6A6' });
        const ped = rect(dx - 10, 842, 340, 44); s.push(ped); f.push({ pts: ped, color: '#9E978A' });
      }
      return {
        strokes: s, fills: f,
        extra(c, lt, k) {
          if (k <= 0) return;
          for (let i = 0; i < 30; i++) {
            const x = (i * 113 % 1000) + 40 + Math.sin(lt * 1.2 + i) * 50, y = ((i * 67 % 800) + lt * (60 + i % 4 * 15)) % 880 + 60;
            c.save(); c.translate(x, y); c.rotate(lt * 2.4 + i); c.fillStyle = ['#D9572B', '#E8A23A', '#B8402A'][i % 3];
            c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(10, 0, 0, 11); c.quadraticCurveTo(-10, 0, 0, -11); c.fill(); c.restore();
          }
        },
      };
    },
    museum() {
      const s = [], f = [];
      const pl = rect(110, 770, 860, 80); s.push(pl); f.push({ pts: pl, color: '#DCD2C0' });
      s.push(rect(440, 770, 200, 80)); for (let k = 1; k < 5; k++) s.push(ln(440, 770 + k * 16, 640, 770 + k * 16));
      s.push(rect(200, 570, 680, 200)); f.push({ pts: rect(200, 570, 680, 200), color: '#F2E7D3' });
      for (let k = 0; k < 8; k++) { const x = 236 + k * 87; s.push(rect(x, 590, 22, 180)); f.push({ pts: rect(x, 590, 22, 180), color: '#B5352A' }); }
      s.push(wave(200, 880, 560, 7, 28));
      const r = roof(540, 556, 900, 200, .3, .5); s.push(r); f.push({ pts: r, color: '#B4822F' });
      return {
        strokes: s, fills: f,
        extra(c, lt, k, S) { // 文物图标依次弹出
          const items = [[130, 260, 'ding'], [950, 250, 'vase'], [180, 430, 'bi'], [900, 430, 'cup']];
          items.forEach(([x, y, kind], i) => {
            const a = Math.min(1, Math.max(0, (lt - S.BEAT * (8 + i * .5)) / .25)); if (a <= 0) return;
            c.save(); c.translate(x, y); const sc = .6 + .4 * a + .15 * Math.sin(Math.min(1, a) * PI); c.scale(sc, sc); c.globalAlpha = a;
            c.strokeStyle = '#1D1D1F'; c.lineWidth = 5; c.fillStyle = ['#7E8C6E', '#3E6E92', '#7FB3A2', '#C9A24E'][i];
            c.beginPath();
            if (kind === 'ding') { c.moveTo(-50, -20); c.lineTo(50, -20); c.quadraticCurveTo(48, 35, 0, 40); c.quadraticCurveTo(-48, 35, -50, -20); c.moveTo(-30, 35); c.lineTo(-38, 70); c.moveTo(30, 35); c.lineTo(38, 70); c.moveTo(-40, -20); c.lineTo(-40, -45); c.moveTo(40, -20); c.lineTo(40, -45); }
            if (kind === 'vase') { c.moveTo(-12, -60); c.lineTo(12, -60); c.quadraticCurveTo(55, -30, 30, 50); c.lineTo(-30, 50); c.quadraticCurveTo(-55, -30, -12, -60); }
            if (kind === 'bi') { c.arc(0, 0, 48, 0, PI * 2); c.moveTo(16, 0); c.arc(0, 0, 16, 0, PI * 2, true); }
            if (kind === 'cup') { c.moveTo(-40, -40); c.lineTo(40, -40); c.lineTo(28, 30); c.lineTo(-28, 30); c.closePath(); }
            c.fill('evenodd'); c.stroke(); c.restore();
          });
        },
      };
    },
    qinhuai() {
      const s = [], f = [];
      s.push(q([20, 200], [540, 330], [1060, 210], 30)); s.push(q([1060, 330], [700, 420], [380, 360], 20));
      const lan = [[160, 252], [300, 282], [440, 298], [580, 300], [720, 290], [860, 268], [980, 240], [520, 380], [640, 384], [780, 372]];
      for (const [x, y] of lan) { const l = lantern(x, y + 30, 22); s.push(cat([[x, y], [x, y + 8]], l)); f.push({ circle: [x, y + 30, 22], color: '#E0483A', glow: true }); }
      for (const x of [330, 440, 640, 750]) s.push(ln(x, 650, x, 400));
      s.push(ln(330, 470, 750, 470)); s.push(rect(480, 410, 120, 44));
      for (const [x, y, w, h] of [[540, 400, 320, 76], [385, 450, 170, 56], [695, 450, 170, 56]]) { const r = roof(x, y, w, h); s.push(r); f.push({ pts: r, color: '#2A3242' }); }
      f.push({ pts: rect(480, 410, 120, 44), color: '#E9C46A' });
      const hull = cat([[260, 700]], q([260, 700], [320, 770], [430, 772]), [[650, 772]], q([650, 772], [760, 770], [820, 700]), [[260, 700]]);
      s.push(hull); f.push({ pts: hull, color: '#8A5A3B' });
      s.push(rect(360, 620, 360, 80)); f.push({ pts: rect(360, 620, 360, 80), color: '#C9A06A' });
      for (const x of [400, 460, 520, 580, 640, 700]) s.push(rect(x - 18, 638, 36, 44));
      const rr = roof(540, 620, 420, 52); s.push(rr); f.push({ pts: rr, color: '#3A2E2A' });
      s.push(wave(20, 1060, 820, 7, 90)); s.push(wave(1060, 60, 870, 6, 70, 1)); s.push(wave(80, 1000, 915, 5, 60, 2));
      f.push({ pts: [[0, 660], [1080, 660], [1080, 960], [0, 960]], color: '#22325A', under: true });
      return {
        strokes: s, fills: f, lineAfter: '#F3D08B',
        extra(c, lt, k) {
          if (k <= 0) return;
          c.save(); c.globalCompositeOperation = 'lighter';
          for (const [x, y] of lan) { // 灯笼倒影在水里抖动
            for (let j = 0; j < 6; j++) {
              const yy = 800 + j * 22 + (y - 250) * .3, w = 26 - j * 3 + Math.sin(lt * 5 + j + x) * 6;
              c.fillStyle = `rgba(255,${120 + j * 10},60,${.35 - j * .05})`; c.fillRect(x - w / 2 + Math.sin(lt * 3 + j * 1.3 + x) * 8, yy, w, 6);
            }
            const g = c.createRadialGradient(x, y + 30, 0, x, y + 30, 70); g.addColorStop(0, `rgba(255,150,80,${.35 + .1 * Math.sin(lt * 6 + x)})`); g.addColorStop(1, 'rgba(255,120,60,0)');
            c.fillStyle = g; c.beginPath(); c.arc(x, y + 30, 70, 0, PI * 2); c.fill();
          }
          c.restore();
          c.fillStyle = '#F7E7B5'; c.beginPath(); c.arc(900, 130, 44, 0, PI * 2); c.fill();
          c.fillStyle = '#2A2A2A'; c.font = 'bold 26px MaShanZheng'; c.textAlign = 'center'; c.fillText('天下文枢', 540, 441);
        },
      };
    },
    gate() {
      const s = [], f = [];
      const o = rect(250, 110, 580, 790), i2 = rect(292, 280, 496, 578);
      s.push(o); s.push(i2);
      f.push({ pts: o, color: '#9A958A' }); f.push({ pts: i2, color: '#EFE6D2' });
      for (const y of [430, 580, 730]) { s.push(rect(292, y - 20, 210, 40)); s.push(rect(578, y - 20, 210, 40)); f.push({ pts: rect(292, y - 20, 210, 40), color: '#9A958A' }); f.push({ pts: rect(578, y - 20, 210, 40), color: '#9A958A' }); }
      s.push(rect(502, 858, 76, 42)); f.push({ pts: rect(502, 858, 76, 42), color: '#EFE6D2' });
      s.push(rect(470, 120, 140, 60)); s.push([[470, 120], [510, 150], [570, 150], [610, 120]]); s.push([[470, 180], [510, 150]]); s.push([[570, 150], [610, 180]]);
      f.push({ pts: rect(470, 120, 140, 60), color: '#B83A2E' });
      for (const sx of [-1, 1]) { const x0 = sx < 0 ? 250 : 830; s.push([[x0, 880], [x0 + sx * 90, 700], [x0 + sx * 90, 300], [x0, 140]]); }
      return {
        strokes: s, fills: f,
        extra(c, lt, k, S) { // 27 个藏兵洞依次点亮
          const t0 = S.BEAT * 8, n = Math.max(0, Math.min(27, Math.floor((lt - t0) / (S.BEAT * 4 / 27))));
          for (let j = 0; j < 27; j++) {
            const row = Math.floor(j / 9), col = j % 9, x = 312 + col * 52, y = 196 + row * 26;
            c.fillStyle = j < n ? '#3A2E26' : 'rgba(58,46,38,.15)'; c.fillRect(x, y, 40, 18);
          }
          if (n > 0) { c.save(); c.fillStyle = '#C8372D'; c.font = '900 110px NotoSerifSC'; c.textAlign = 'center'; c.fillText(String(n), 960, 520); c.font = '700 32px NotoSansSC'; c.fillStyle = '#2B2B2B'; c.fillText('个藏兵洞', 960, 566); c.restore(); }
        },
      };
    },
    food() {
      const s = [], f = [];
      const cx = 500, ry = 70;
      const rim = arc(cx, 560, 300, ry, 0, 2 * PI, 60);
      const body = cat([[cx - 300, 560]], q([cx - 300, 560], [cx - 280, 800], [cx - 110, 820]), [[cx + 110, 820]], q([cx + 110, 820], [cx + 280, 800], [cx + 300, 560]));
      s.push(body); s.push(rim); s.push(rect(cx - 90, 820, 180, 30));
      f.push({ pts: cat(body, [[cx - 300, 560]]), color: '#F7F4EE' }); f.push({ pts: rim, color: '#E7BE73' });
      f.push({ pts: rect(cx - 90, 820, 180, 30), color: '#E9E4DA' });
      s.push(wave(cx - 250, cx + 250, 700, 10, 60)); s.push(wave(cx + 230, cx - 230, 740, 8, 50, 1));
      for (const [x, y] of [[cx - 160, 545], [cx - 40, 580], [cx + 120, 540]]) { const r = rect(x - 26, y - 22, 52, 44); s.push(r); f.push({ pts: r, color: '#7B2121' }); }
      for (const [x, y] of [[cx - 90, 590], [cx + 50, 530], [cx + 190, 575]]) { const b = blob(x, y, 26, 5, .12, x, 30); s.push(b); f.push({ pts: b, color: '#E3A64B' }); }
      for (const [x, y] of [[cx - 220, 565], [cx + 10, 520], [cx + 235, 552]]) { const lf = cat(q([x, y], [x + 20, y - 30], [x + 40, y]), q([x + 40, y], [x + 20, y + 14], [x, y])); s.push(lf); f.push({ pts: lf, color: '#4F9D5D' }); }
      s.push(ln(640, 480, 900, 230)); s.push(ln(672, 488, 932, 252));
      const dx = 900, dy = 690, db = T(DUCK_BODY, dx, dy), dh = T(DUCK_HEAD, dx, dy);
      s.push(db); s.push(dh); s.push(T(DUCK_WING, dx, dy)); f.push({ pts: db, color: '#F4CF4F' }); f.push({ pts: dh, color: '#F4CF4F' });
      const beak = T([[-92, -32], [-128, -20], [-92, -12], [-92, -32]], dx, dy); s.push(beak); f.push({ pts: beak, color: '#E97A2B' });
      s.push(circ(dx - 62, dy - 36, 6, 10));
      return {
        strokes: s, fills: f,
        extra(c, lt, k, S) {
          if (k > 0) for (let i = 0; i < 5; i++) { // 热气
            const ph = (lt * .6 + i / 5) % 1, x = cx - 120 + i * 60 + Math.sin(lt * 2 + i) * 14, y = 470 - ph * 300;
            c.strokeStyle = `rgba(120,110,100,${.5 * Math.sin(PI * ph)})`; c.lineWidth = 6; c.beginPath();
            for (let j = 0; j < 12; j++) { const yy = y - j * 10; const xx = x + Math.sin(yy / 18 + lt * 3) * 10; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
          }
          if (k > 0) { c.fillStyle = '#4FA3D9'; const sw = (lt * 2) % 1; c.globalAlpha = 1 - sw; c.beginPath(); c.ellipse(dx - 10, dy - 80 + sw * 30, 8, 12, 0, 0, PI * 2); c.fill(); c.globalAlpha = 1; }
          const a = Math.min(1, Math.max(0, (lt - S.BEAT * 9) / .22)); if (a <= 0) return;
          c.save(); c.translate(200, 300); c.scale(.7 + .3 * a, .7 + .3 * a); c.globalAlpha = a; c.rotate(-.05);
          c.fillStyle = '#FFFFFF'; c.strokeStyle = '#1D1D1F'; c.lineWidth = 6;
          c.beginPath(); c.roundRect(-170, -70, 340, 120, 40); c.moveTo(60, 50); c.lineTo(110, 110); c.lineTo(110, 50); c.fill(); c.stroke();
          c.fillStyle = '#C8372D'; c.font = '900 52px ZCOOLQingKeHuangYou'; c.textAlign = 'center'; c.fillText('阿要辣油啊？', 0, 6);
          c.font = '500 24px NotoSansSC'; c.fillStyle = '#555'; c.fillText('南京话：要不要辣油', 0, 40); c.restore();
        },
      };
    },
    literature() {
      const s = [], f = [];
      const cover = [[200, 610], [540, 640], [880, 610], [880, 830], [540, 860], [200, 830], [200, 610]];
      s.push(cover); f.push({ pts: cover, color: '#C8372D' });
      const lp = cat(q([540, 620], [380, 560], [220, 600]), [[220, 600], [220, 805]], q([220, 805], [380, 765], [540, 830]), [[540, 620]]);
      const rp = cat(q([540, 620], [700, 560], [860, 600]), [[860, 600], [860, 805]], q([860, 805], [700, 765], [540, 830]), [[540, 620]]);
      s.push(lp); s.push(rp); f.push({ pts: lp, color: '#FBF6EA' }); f.push({ pts: rp, color: '#FBF6EA' });
      for (let k = 0; k < 5; k++) { const y = 640 + k * 30; s.push(q([270, y], [400, y - 28], [510, y + 8], 6)); s.push(q([810, y], [680, y - 28], [570, y + 8], 6)); }
      return {
        strokes: s, fills: f,
        extra(c, lt, k) { // 字从书里飞出来
          if (k <= 0) return;
          const W = ['金陵', '秦淮', '春风', '江南', '六朝', '烟雨', '燕', '诗', '石头城', '乌衣巷', '桨声', '灯影', '钟山', '书'];
          W.forEach((w, i) => {
            const ph = (lt * .32 + i / W.length) % 1, x = 540 + Math.sin(i * 2.3) * (80 + ph * 380), y = 600 - ph * 520;
            c.save(); c.globalAlpha = Math.sin(PI * ph); c.fillStyle = i % 4 ? '#1D1D1F' : '#C8372D';
            c.font = `${36 + (i % 3) * 14}px MaShanZheng`; c.textAlign = 'center'; c.fillText(w, x, y); c.restore();
          });
        },
      };
    },
    newcity() {
      const s = [], f = [];
      s.push(circ(700, 380, 160)); f.push({ circle: [700, 380, 160], color: '#F4955A', grad: ['#F7B267', '#E9573F'] });
      const towers = [[120, 640, 50], [180, 540, 80], [400, 420, 70], [480, 520, 60], [560, 380, 80], [650, 560, 50], [720, 460, 80], [820, 600, 80], [910, 520, 60]];
      for (const [x, y, w] of towers) { const r = rect(x, y, w, 820 - y); s.push(r); f.push({ pts: r, color: ['#2C4A6E', '#3A5F86', '#26405F'][x % 3], windows: true }); }
      const zf = [[300, 820], [304, 400], [318, 300], [344, 236], [362, 252], [376, 330], [382, 820]];
      s.push(cat(zf, [[344, 236], [348, 160]])); f.push({ pts: zf, color: '#1F3550', windows: true });
      s.push(ln(60, 860, 1020, 860)); s.push(q([160, 860], [540, 360], [920, 860], 36));
      for (let k = 1; k < 10; k++) { const t = k / 10, x = 160 + 760 * t, y = (1 - t) * (1 - t) * 860 + 2 * (1 - t) * t * 360 + t * t * 860; s.push(ln(x, y, x + (540 - x) * .12, 860)); }
      s.push(wave(0, 1080, 900, 6, 80)); s.push(wave(1080, 60, 935, 5, 60, 1));
      f.push({ pts: [[0, 875], [1080, 875], [1080, 960], [0, 960]], color: '#3E6A8C' });
      return {
        strokes: s, fills: f,
        extra(c, lt, k) {
          if (k <= 0) return;
          for (const [x, y, w] of towers.concat([[300, 300, 80]])) {
            for (let yy = y + 20; yy < 800; yy += 26) for (let xx = x + 8; xx < x + w - 10; xx += 18) {
              const on = Math.sin(xx * 12.9 + yy * 78.2 + Math.floor(lt * 3 + xx) * 3.1) > .35;
              if (on) { c.fillStyle = 'rgba(255,214,120,.9)'; c.fillRect(xx, yy, 8, 12); }
            }
          }
          for (let i = 0; i < 4; i++) { const x = (lt * 90 + i * 140) % 1200 - 100, y = 200 + i * 30 + Math.sin(lt * 3 + i) * 8; c.strokeStyle = '#2B2B2B'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 12, y - 6); c.quadraticCurveTo(x - 6, y, x, y); c.quadraticCurveTo(x + 6, y, x + 12, y - 6); c.stroke(); }
        },
      };
    },
  };
  // 开场的祥云笔花
  function xiangyun(cx, cy, s) {
    return cat(arc(cx, cy, 40 * s, 40 * s, PI, 2.6 * PI, 30), q([cx + 30 * s, cy + 26 * s], [cx + 120 * s, cy + 40 * s], [cx + 150 * s, cy - 10 * s]),
      arc(cx + 170 * s, cy - 10 * s, 26 * s, 26 * s, PI, 2.7 * PI, 24), q([cx + 150 * s, cy + 18 * s], [cx - 40 * s, cy + 90 * s], [cx - 160 * s, cy + 40 * s]),
      arc(cx - 160 * s, cy + 10 * s, 30 * s, 30 * s, PI * .5, -PI * 1.2, 24));
  }
  const ARTLIB = { ART, xiangyun, q, cb, rect, circ, wave, cat };
  if (typeof module !== 'undefined') module.exports = ARTLIB; else root.ARTLIB = ARTLIB;
})(typeof window !== 'undefined' ? window : globalThis);
