// 用 MiniMax 音乐模型生成各章节配乐（纯器乐）。已存在的文件跳过。
// 用法：node tools/build_music.mjs [id ...]
import { music } from './minimax.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets/music');
export const TRACKS = {
  m1_ink: '中国风电影配乐，纯器乐，水墨山水意境。古琴独奏开场，洞箫悠远吹出主旋律，古筝泛音如雨滴，大量留白与呼吸感，慢板约60BPM，中段弦乐铺底渐起，空灵、悠远、禅意、怀古，六朝烟雨，诗意而克制，没有人声。',
  m2_ming: '恢弘的中国风史诗电影配乐，纯器乐。低沉的大鼓与编钟开场，弦乐与圆号层层推进，中国笛子吹出坚毅的主题，庄严、雄浑、壮阔，像古城墙与远航的船队，约80BPM，结尾归于钟声余韵，没有人声。',
  m3_qinhuai: '江南丝竹风格的电影配乐，纯器乐。琵琶轮指与古筝交织，昆曲韵味的笛子旋律，轻柔弦乐托底，像夜晚秦淮河上的桨声灯影，婉约、优雅、温柔流动、书卷气，约72BPM，没有人声。',
  m4_memory: '肃穆克制的电影配乐，纯器乐。大提琴低吟与钢琴单音，二胡如泣如诉，长长的停顿与静默，哀思、追思、庄重；后半段弦乐缓缓升起，转为温暖、坚定、充满希望的和平主题，约60BPM，没有人声。',
  m5_life: '轻快温暖的中国风城市生活配乐，纯器乐。琵琶拨弦与竹笛跳跃，木鱼与轻打击乐，尤克里里般轻松的节奏，市井烟火气，俏皮、幽默、惬意、阳光，约100BPM，没有人声。',
  m6_future: '现代中国风史诗电影配乐，纯器乐。古筝与钢琴琶音开场，弦乐与电子氛围逐渐展开，大鼓推进到辉煌开阔的高潮，明亮、自信、充满希望，像古老城市在夜色中点亮灯火；尾声渐弱，回到一声古琴泛音，安静收束，约90BPM，没有人声。',
};

fs.mkdirSync(DIR, { recursive: true });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TRACKS);
for (const id of ids) {
  const out = path.join(DIR, `${id}.mp3`);
  if (fs.existsSync(out)) { console.log(id, '已存在'); continue; }
  try {
    const info = await music(TRACKS[id], out);
    console.log(id, 'ok', info?.music_duration, 'ms');
  } catch (e) {
    console.log(id, 'music-3.0 失败：', e.message, '→ 改用 free 模型');
    try { const info = await music(TRACKS[id], out, { model: 'music-3.0-free' }); console.log(id, 'ok(free)', info?.music_duration, 'ms'); }
    catch (e2) { console.log(id, '失败：', e2.message); }
  }
}
