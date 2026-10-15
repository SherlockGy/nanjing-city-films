/* 由剧本 + 配音时间轴计算每个镜头/文字的绝对时间（浏览器渲染器与 node 音频脚本共用） */
(function (root) {
  const TD = { ink: 1.5, wash: 1.3, brush: 1.1, fade: 1.2, cut: 0, black: 2.0, scroll: 1.5 };
  function layout(FILM, TL) {
    const shots = [], texts = [];
    FILM.beats.forEach((b, i) => {
      const tb = TL.beats[i];
      if (tb.id !== b.id) throw new Error('时间轴与剧本不一致：' + b.id + ' / ' + tb.id + '，请重新运行 build_voice');
      if (b.shots) {
        const tot = b.shots.reduce((s, x) => s + (x.w ?? 1), 0);
        let t = tb.start;
        for (const s of b.shots) {
          const d = tb.dur * (s.w ?? 1) / tot;
          if (shots.length) shots[shots.length - 1].end = t;
          shots.push({ ...s, start: t, end: t + d, beat: b.id, mood: b.mood, idx: shots.length });
          t += d;
        }
      } else if (shots.length) shots[shots.length - 1].end = tb.start + tb.dur;
      for (const x of b.text || []) texts.push({ ...x, beat: b.id, bs: tb.start, bd: tb.dur, marks: tb.marks || [], voice: tb.voice });
    });
    shots.forEach((s, i) => {
      const prev = shots[i - 1];
      let td = TD[s.tr || 'ink'] ?? 1.2;
      if (s.tr === 'black') td = TD.black;
      else if (prev) td = Math.min(td, (s.end - s.start) * 0.55, (prev.end - prev.start) * 0.55);
      s.td = td;
      s.vis0 = s.tr === 'black' || !prev ? s.start : s.start - td / 2;
    });
    shots.forEach((s, i) => { const n = shots[i + 1]; s.vis1 = n ? (n.tr === 'black' ? n.start : n.start + n.td / 2) : s.end; });
    const dark = FILM.beats.map((b, i) => b.mood === 'dark' ? [TL.beats[i].start, TL.beats[i].start + TL.beats[i].dur] : null).filter(Boolean);
    return { shots, texts, dark, duration: TL.duration };
  }
  if (typeof module !== 'undefined') module.exports = layout; else root.layout = layout;
})(typeof window !== 'undefined' ? window : globalThis);
