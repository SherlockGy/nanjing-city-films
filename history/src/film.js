/* 《金陵 2500》—— 16:9，96 BPM。每个镜头的时长以拍为单位（1 拍 = 0.625 秒）。
 * bg: P 羊皮纸 / D 暗场鎏金；year: 负数为公元前；cap: 小号档案字幕；ch: 左上角章节；dyn: 十朝都会计数 */
(function (root) {
  const BPM = 96, BEAT = 60 / BPM;
  const CH = { chu: 'I · 楚', six: 'II · 六朝', tang: 'III · 唐 · 南唐', ming: 'IV · 大明', qing: 'V · 明清', modern: 'VI · 近代', now: 'VII · 当代', end: 'VIII · 金陵' };
  const SCENES = [
    { id: 'ingot', b: 5, bg: 'D', year: -333, ch: 'chu', dyn: 0, lead: '公元前333年，楚威王', key: '埋下了金。', cap: 'KING WEI OF CHU · 333 BC', vis: 'ingot' },
    { id: 'wangqi', b: 4, bg: 'D', year: -333, ch: 'chu', dyn: 0, lead: '他想镇住', key: '王气。', cap: 'TO SEAL THE ROYAL AURA', vis: 'wangqi' },
    { id: 'fail', b: 4, bg: 'D', year: -333, ch: 'chu', dyn: 0, lead: '', key: '他没能做到。', cap: 'HE FAILED', vis: 'burst', pos: 'C' },
    { id: 'title', b: 7, bg: 'D', year: -333, ch: 'chu', dyn: 0, lead: '', key: '金陵', cap: 'JINLING · NANJING · 2500 YEARS', vis: 'title', pos: 'T' },
    { id: 'zhuge', b: 5, bg: 'P', year: 211, ch: 'six', dyn: 0, lead: '诸葛亮说：', key: '钟山龙蟠，石城虎踞。', cap: 'ZHUGE LIANG · c. AD 211', vis: 'zhuge' },
    { id: 'jianye', b: 4, bg: 'P', year: 229, ch: 'six', dyn: 1, lead: '公元229年，孙权', key: '建都。', cap: 'JIANYE · CAPITAL OF EASTERN WU · AD 229', vis: 'jianye' },
    { id: 'migrate', b: 5, bg: 'P', year: 317, ch: 'six', dyn: 2, lead: '北方战火，', key: '衣冠南渡。', cap: 'THE GREAT MIGRATION SOUTH · AD 317', vis: 'migrate' },
    { id: 'wuyi', b: 4, bg: 'P', year: 380, ch: 'six', dyn: 2, lead: '乌衣巷里，', key: '王谢风流。', cap: 'WUYI LANE · HOUSES OF WANG & XIE', vis: 'wuyi' },
    { id: 'pi', b: 5, bg: 'P', year: 480, ch: 'six', dyn: 4, lead: '祖冲之算出', key: '3.1415926', cap: 'ZU CHONGZHI · 3.1415926 < π < 3.1415927', vis: 'pi', keyFont: 'cinzel' },
    { id: 'qixia', b: 5, bg: 'P', year: 489, ch: 'six', dyn: 4, lead: '栖霞山，', key: '千佛岩。', cap: 'QIXIA TEMPLE · THOUSAND BUDDHA CLIFF · SINCE AD 489', vis: 'qixia' },
    { id: 'wenxin', b: 4, bg: 'P', year: 501, ch: 'six', dyn: 4, lead: '刘勰写下', key: '文心雕龙。', cap: 'LIU XIE · THE LITERARY MIND · c. AD 501', vis: 'wenxin' },
    { id: 'jiming', b: 5, bg: 'P', year: 527, ch: 'six', dyn: 5, lead: '南朝四百八十寺，', key: '烟雨中。', cap: 'JIMING TEMPLE · FIRST TEMPLE OF THE SOUTHERN DYNASTIES', vis: 'jiming' },
    { id: 'fall', b: 5, bg: 'P', year: 589, ch: 'six', dyn: 6, lead: '公元589年，', key: '繁华散尽。', cap: 'JIANKANG RAZED BY SUI · AD 589', vis: 'fall', dim: true },
    { id: 'poet', b: 5, bg: 'P', year: 826, ch: 'tang', dyn: 6, lead: '可诗人记得——', key: '旧时王谢堂前燕。', cap: 'LIU YUXI · WUYI LANE · c. AD 826', vis: 'poet' },
    { id: 'liyu', b: 5, bg: 'P', year: 975, ch: 'tang', dyn: 7, lead: '南唐后主：', key: '一江春水向东流。', cap: 'LI YU · SOUTHERN TANG · AD 975', vis: 'river' },
    { id: 'ming', b: 5, bg: 'P', year: 1368, ch: 'ming', dyn: 8, lead: '1368年，', key: '大明。', cap: 'MERIDIAN GATE · MING PALACE · YINGTIAN', vis: 'ming', rays: true },
    { id: 'wall', b: 5, bg: 'P', year: 1393, ch: 'ming', dyn: 8, lead: '我们筑城', key: '35公里。', cap: 'MING CITY WALL · 1366–1393', vis: 'wallmap' },
    { id: 'bricks', b: 4, bg: 'P', year: 1393, ch: 'ming', dyn: 8, lead: '每一块砖，', key: '都有名字。', cap: 'INSCRIBED BRICKS · MAKER · KILN · OVERSEER', vis: 'bricks' },
    { id: 'zhenghe', b: 5, bg: 'P', year: 1405, ch: 'ming', dyn: 8, lead: '1405年，', key: '郑和下西洋。', cap: 'ZHENG HE · 7 VOYAGES · 1405–1433', vis: 'zhenghe' },
    { id: 'yongle', b: 4, bg: 'P', year: 1408, ch: 'ming', dyn: 8, lead: '《永乐大典》', key: '22877卷。', cap: 'YONGLE ENCYCLOPEDIA · 1403–1408', vis: 'library' },
    { id: 'tower', b: 5, bg: 'P', year: 1431, ch: 'ming', dyn: 8, lead: '大报恩寺琉璃塔，', key: '世界奇迹。', cap: 'PORCELAIN TOWER OF NANJING · 1412–1431', vis: 'tower', rays: true },
    { id: 'exam', b: 5, bg: 'P', year: 1700, ch: 'qing', dyn: 8, lead: '江南贡院，', key: '两万间号舍。', cap: 'JIANGNAN EXAMINATION HALL · 20,644 CELLS', vis: 'exam' },
    { id: 'yunjin', b: 4, bg: 'P', year: 1720, ch: 'qing', dyn: 8, lead: '江宁织造，', key: '寸锦寸金。', cap: 'YUNJIN BROCADE · UNESCO INTANGIBLE HERITAGE', vis: 'yunjin' },
    { id: 'novels', b: 5, bg: 'P', year: 1760, ch: 'qing', dyn: 8, lead: '这座城，', key: '写进了小说。', cap: 'THE SCHOLARS · PEACH BLOSSOM FAN · RED CHAMBER', vis: 'novels' },
    { id: 'treaty', b: 4, bg: 'P', year: 1842, ch: 'modern', dyn: 8, lead: '1842年，', key: '国门洞开。', cap: 'TREATY OF NANKING · 1842', vis: 'treaty', dim: true },
    { id: 'tianjing', b: 4, bg: 'P', year: 1853, ch: 'modern', dyn: 9, lead: '1853年，太平天国', key: '定都天京。', cap: 'TAIPING HEAVENLY KINGDOM · 1853–1864', vis: 'tianjing' },
    { id: 'republic', b: 4, bg: 'P', year: 1912, ch: 'modern', dyn: 10, lead: '1912年，', key: '共和。', cap: 'REPUBLIC OF CHINA FOUNDED IN NANJING · 1912', vis: 'republic' },
    { id: 'ncu', b: 5, bg: 'P', year: 1928, ch: 'modern', dyn: 10, lead: '1928年，', key: '国立中央大学。', cap: 'NATIONAL CENTRAL UNIVERSITY · LINEAGE OF NANJING UNIVERSITY', vis: 'ncu' },
    { id: 'sunyat', b: 7, bg: 'P', year: 1929, ch: 'modern', dyn: 10, lead: '中山陵，', key: '天下为公。', cap: 'SUN YAT-SEN MAUSOLEUM · BO\'AI ARCH · MAUSOLEUM GATE · 1929', vis: 'sunyat' },
    { id: 'observatory', b: 4, bg: 'P', year: 1934, ch: 'modern', dyn: 10, lead: '紫金山上，', key: '仰望星空。', cap: 'PURPLE MOUNTAIN OBSERVATORY · 1934', vis: 'observatory' },
    { id: 'y1937', b: 7, bg: 'D', year: 1937, ch: 'modern', dyn: 10, lead: '1937年冬。', key: '三十万。', cap: 'IN MEMORY OF THE VICTIMS · DECEMBER 13', vis: 'candle', mourn: true, pos: 'C' },
    { id: 'remember', b: 5, bg: 'D', year: 1937, ch: 'modern', dyn: 10, lead: '我们铭记，', key: '为了和平。', cap: 'REMEMBRANCE · PEACE', vis: 'dove', mourn: true, pos: 'C' },
    { id: 'bridge', b: 6, bg: 'P', year: 1968, ch: 'modern', dyn: 10, lead: '1968年，我们自己', key: '架起长江大桥。', cap: 'NANJING YANGTZE RIVER BRIDGE · 1968', vis: 'bridge', rays: true },
    { id: 'xinjiekou', b: 5, bg: 'G', year: 1996, ch: 'now', dyn: 10, lead: '新街口，', key: '中华第一商圈。', cap: 'XINJIEKOU · STATUE OF DR. SUN YAT-SEN', vis: 'xinjiekou' },
    { id: 'xuanwu', b: 5, bg: 'G', year: 2010, ch: 'now', dyn: 10, lead: '玄武湖畔，', key: '古今同框。', cap: 'XUANWU LAKE · MING WALL · JIMING TEMPLE · ZIFENG TOWER 450 M', vis: 'xuanwu' },
    { id: 'njnan', b: 5, bg: 'G', year: 2011, ch: 'now', dyn: 10, lead: '南京南站，', key: '亚洲最大高铁站。', cap: 'NANJING SOUTH RAILWAY STATION · OPENED 2011', vis: 'njnan' },
    { id: 'niushou', b: 5, bg: 'G', year: 2015, ch: 'now', dyn: 10, lead: '牛首山上，', key: '佛顶宫。', cap: 'USHNISHA PALACE · NIUSHOU MOUNTAIN · 2015', vis: 'niushou' },
    { id: 'literature', b: 4, bg: 'G', year: 2019, ch: 'now', dyn: 10, lead: '2019年，', key: '世界文学之都。', cap: 'UNESCO CITY OF LITERATURE · FIRST IN CHINA', vis: 'book' },
    { id: 'dushiquan', b: 5, bg: 'G', year: 2021, ch: 'now', dyn: 10, lead: '南京都市圈，全国首个', key: '国家级都市圈。', cap: 'NANJING METROPOLITAN AREA · 2021 · 8 CITIES · 2 PROVINCES', vis: 'dushiquan' },
    { id: 'campus', b: 4, bg: 'G', year: 2023, ch: 'now', dyn: 10, lead: '50余所高校，', key: '无数个明天。', cap: 'UNIVERSITIES · LABORATORIES · DREAMS', vis: 'network' },
    { id: 'years', b: 5, bg: 'G', year: 2026, ch: 'end', dyn: 10, lead: '', key: '2500年。', cap: '472 BC — AD 2026', vis: 'galaxy', pos: 'C', rays: true },
    { id: 'light', b: 6, bg: 'G', year: 2026, ch: 'end', dyn: 10, lead: '金陵的光，', key: '从未熄灭。', cap: 'THE LIGHT OF JINLING STILL BURNS', vis: 'ring', pos: 'TC' },
    { id: 'come', b: 8, bg: 'G', year: 2026, ch: 'end', dyn: 10, lead: '', key: '来南京。', cap: 'NANJING · 南京', vis: 'flame', pos: 'C', rays: true },
  ];
  let t = 0;
  for (const s of SCENES) { s.t0 = t; s.dur = s.b * BEAT; t += s.dur; }
  const DURATION = t + 1.2;
  const FILM = { BPM, BEAT, SCENES, CH, DURATION, W: 1920, H: 1080 };
  if (typeof module !== 'undefined') module.exports = FILM; else root.FILM = FILM;
})(typeof window !== 'undefined' ? window : globalThis);
