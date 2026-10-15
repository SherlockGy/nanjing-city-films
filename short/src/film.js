/* 《一笔画完南京》—— 竖屏 1080×1920，128 BPM，全片 64 小节（120 秒）。
 * 世界坐标：3 列 × 4 行的格子，每格 1080×1440，整张世界 3240×5760（恰好 9:16，最后拉远就是一张完整海报）。
 * 笔按“之”字形路线依次经过 12 站：第 0、2 行从左到右，第 1、3 行从右到左。
 * 每站 4 小节：0–4 拍画线条，4 拍上色，6 拍标题砸下，8 拍副标题，10 拍标签贴纸，14–16 拍笔甩向下一站。 */
(function (root) {
  const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
  const CW = 1080, CH = 1440, COLS = 3, ROWS = 4;
  const STATIONS = [
    { key: 'bridge', name: '南京长江大桥', line: '1968 · 中国人自己设计建造的第一座长江大桥', tag: '江边看日落', bg: '#F7D9BC', accent: '#C8372D' },
    { key: 'jiming', name: '鸡鸣寺', line: '南朝四百八十寺 · 樱花开成粉色的海', tag: '3月中下旬最美', bg: '#FADCE4', accent: '#D9567A' },
    { key: 'wall', name: '明城墙', line: '现存25公里 · 每块城砖都刻着工匠的名字', tag: '台城段 · 城墙徒步', bg: '#DDE5EA', accent: '#4C6A80' },
    { key: 'sunyat', name: '中山陵', line: '392级台阶 · 一步一步向上', tag: '紫金山 · 登高望远', bg: '#D8E6F3', accent: '#2F6DB0' },
    { key: 'meiling', name: '美龄宫', line: '秋天，紫金山戴上了一条金项链', tag: '11月中下旬 · 梧桐金黄', bg: '#294E3B', accent: '#D9A23A', dark: true },
    { key: 'elephant', name: '石象路', line: '明孝陵 · 世界文化遗产 · 守望600年', tag: '秋天的童话', bg: '#F5DCB4', accent: '#C9672A' },
    { key: 'museum', name: '南京博物院', line: '43万件藏品 · 一天根本逛不完', tag: '免费 · 记得提前预约', bg: '#EEDDC5', accent: '#9C6A2A' },
    { key: 'qinhuai', name: '秦淮河', line: '桨声灯影 · 夫子庙夜游', tag: '晚上7点以后去', bg: '#1F2B4A', accent: '#E0483A', dark: true },
    { key: 'gate', name: '中华门', line: '三道瓮城 · 27个藏兵洞', tag: '隔壁就是老门东', bg: '#E7DCC7', accent: '#8A5A2B' },
    { key: 'food', name: '鸭血粉丝汤', line: '没有一只鸭子，能活着游过南京', tag: '盐水鸭 · 小笼包 · 糖芋苗', bg: '#FCE3C2', accent: '#D0612B' },
    { key: 'literature', name: '世界文学之都', line: '中国第一座 · 联合国教科文组织认证', tag: '去书店坐一下午', bg: '#E2EBE3', accent: '#3E7B67' },
    { key: 'newcity', name: '河西 · 南京眼', line: '紫峰大厦450米 · 江边看日落', tag: '古都也很潮', bg: '#F9D3B8', accent: '#D2523A' },
  ];
  STATIONS.forEach((s, i) => {
    const r = Math.floor(i / 3), k = i % 3;
    s.i = i; s.r = r; s.c = r % 2 === 0 ? k : 2 - k; s.dir = r % 2 === 0 ? 1 : -1;
    s.x0 = s.c * CW; s.y0 = s.r * CH;
    s.bar = 4 + 4 * i + (i >= 6 ? 2 : 0);
    s.t0 = s.bar * BAR;
  });
  const SEC = { intro: [0, 4], half: [28, 30], outro: [54, 64] };
  const DURATION = 64 * BAR;
  const tb = (bar, beat = 0) => (bar + beat / 4) * BAR;

  // 音频事件（配乐脚本读取）
  function events() {
    const ev = [];
    const add = (t, type, extra = {}) => ev.push({ t: +t.toFixed(4), type, ...extra });
    add(0, 'slam'); add(BEAT, 'slam2');
    [4, 5, 6, 7].forEach(b => add(b * BEAT, 'hit', { n: b - 4 }));
    add(tb(2), 'whoosh'); add(tb(2, 1), 'scribble', { dur: BAR * 2 - BEAT });
    for (const s of STATIONS) {
      const t = s.t0;
      add(t - BEAT * 0.9, 'whoosh');
      add(t, 'scribble', { dur: BEAT * 4 });
      add(t + BEAT * 4, 'pop');
      add(t + BEAT * 6, 'slam');
      add(t + BEAT * 8, 'type', { dur: BEAT * 1.2 });
      add(t + BEAT * 10, 'stamp');
      add(t + BEAT * 14, 'scribble', { dur: BEAT * 2, soft: true });
      add(t, 'station', { key: s.key, i: s.i });
    }
    add(tb(28), 'whoosh'); add(tb(28, 2), 'slam'); add(tb(29, 2), 'whoosh');
    add(tb(54), 'whoosh'); add(tb(54), 'scribble', { dur: BAR * 2 });
    add(tb(56), 'impact');
    for (let i = 0; i < 12; i++) add(tb(56) + i * BAR * 1.5 / 12, 'tick', { n: i });
    add(tb(58), 'whoosh'); add(tb(58, 1), 'slam');
    add(tb(62), 'stamp'); add(tb(62), 'impact');
    return ev.sort((a, b) => a.t - b.t);
  }

  const FILM = { BPM, BEAT, BAR, CW, CH, COLS, ROWS, STATIONS, SEC, DURATION, tb, events, W: 1080, H: 1920 };
  if (typeof module !== 'undefined') module.exports = FILM; else root.FILM = FILM;
})(typeof window !== 'undefined' ? window : globalThis);
