# 金陵 · 一卷未干的水墨

南京城市宣传片，时长 6 分 52 秒，1920×1080、30fps，有中文旁白、配乐和字幕。

- 成片：`output/金陵·一卷未干的水墨.mp4`
- 字幕：`output/金陵·一卷未干的水墨.srt`
- 照片署名：`output/素材署名.txt`

## 下载成片

三部作品及主片母版统一放在 [Releases](../../releases) 页面，视频未纳入 Git 仓库。

| 作品 | Release 文件名 | 大小（约） |
|---|---|---|
| 金陵 · 一卷未干的水墨 | `jinling-ink-scroll.mp4` | 412 MB |
| 主片高码率母版 | `jinling-ink-scroll-master.mp4` | 1.25 GB |
| 一笔画完南京（竖屏） | `nanjing-one-stroke.mp4` | 197 MB |
| 金陵 2500 | `jinling-2500.mp4` | 98 MB |

Release 同时提供主片字幕、照片署名清单和三部作品的 M4A 音轨。仓库保留源码、素材、封面和网页所需音轨；本地成片路径对应上方列出的 `output/` 文件。

![金陵 · 一卷未干的水墨封面](output/封面.jpg)

## 素材署名与字体

- 照片来源、作者及授权记录见 [assets/web/credits.json](assets/web/credits.json)，主片照片署名清单见 [output/素材署名.txt](output/素材署名.txt)。
- 字体自带元数据均标明 SIL Open Font License 1.1，随仓库附带的各字体原始许可证见 [assets/fonts/licenses](assets/fonts/licenses)。
- 地图数据来源沿用下方“金陵 2500”的说明。

## 创意

整部片子是一卷慢慢展开的水墨长卷。开场一滴墨落在宣纸上，化成钟山、石头城和整座城市。

片中的实景地标先以水墨画出现，颜色再像水一样从画里洇出来，变成真实的照片。墨里画的是两千五百年的南京，洇出来的是今天的南京。这些水墨版由 Codex 图生图生成，构图与原照片逐像素对齐，所以晕染时不会错位。

结尾用一笔圆相圈住“南京”，旁白收在“下一笔，等你来写”。

## 章节

| 时间 | 章节 | 内容 |
|---|---|---|
| 0:00 | 序 · 一滴墨 | 钟山龙蟠、石城虎踞；“金陵”得名；秣陵、建业、建康、江宁、应天 |
| 0:59 | 壹 · 六朝烟水 | 孙权建都、乌衣巷王谢、《文心雕龙》《文选》、南朝四百八十寺、台城 |
| 1:57 | 贰 · 大明城垣 | 明孝陵、明城墙与城砖铭文、中华门、郑和宝船、大报恩寺琉璃塔、石象路 |
| 2:53 | 叁 · 文枢秦淮 | 秦淮河、天下文枢、江南贡院、《儒林外史》、《红楼梦》、云锦、李白凤凰台、世界文学之都 |
| 4:05 | 肆 · 山河铭记 | 总统府、中山陵、1937 与国家公祭、和平、南京长江大桥 |
| 5:01 | 伍 · 人间烟火 | 老门东、四季花事、梧桐与美龄宫、鸭血粉丝汤、“阿要辣油啊”、“多大事啊” |
| 5:51 | 陆 · 江城新章 | 南京眼、紫峰大厦、高校、南京南站、灯会、青奥中心、夜景 |
| 6:20 | 终 · 卷未终 | 手卷回望两千五百年，圆相落款“南京” |

## 制作方式

- **画面**：自写的 WebGL 渲染器（`src/engine.js`、`src/shaders.js`），每一帧都只由时间决定，可以多进程并行渲染。它负责这些效果：
  - 水墨晕染、宣纸洗淡、横扫一笔、手卷展开四种转场
  - 水墨到实景的洇色
  - 墨滴洇开，以及雾、雨、樱花、燕子、白鹭、灯笼、金粉、香灰等氛围粒子
  - 书法字逐字书写，时间点对齐旁白里每个字的位置
  - 印章盖下
- **素材**：
  - 25 幅原创水墨画由 Codex 图像生成，另有宣纸、横笔、圆相 3 张纹理（提示词见 `tools/gen_prompts.json`）
  - 43 张实景照片来自 Wikimedia Commons，均为 CC0 / CC BY / CC BY-SA 授权，署名见片尾和 `output/素材署名.txt`
- **旁白**：MiniMax 语音合成，共四个音色：
  - 电台男主播：旁白
  - 阅历姐姐：吟诵古诗
  - 热心大婶：说“阿要辣油啊”
  - 南方小哥：说“多大事啊”
- **配乐与音效**：`tools/build_audio.py` 用 numpy 程序化合成古琴、古筝、箫、笛、琵琶、弦乐、大鼓、编钟和寺钟。每卷有各自的调式和情绪，旋律只在旁白的间隙出现，旁白时配乐自动压低。墨滴、笔刷、印章、雨、燕鸣、远处的防空警报等音效都跟画面事件对齐。MiniMax 的音乐接口不对新用户开放，所以没有使用。

## 重新生成

需要 macOS、Node 22+、ffmpeg、`.venv`（numpy / opencv / scipy / pillow），以及环境变量 `MINIMAX_API_KEY`。

```bash
.venv/bin/python tools/gen_images.py        # Codex 生成水墨画（已有的跳过）
.venv/bin/python tools/gen_inks.py          # Codex 把照片转成对齐的水墨版
.venv/bin/python tools/prepare_assets.py    # 裁切与预处理
node tools/build_voice.mjs                  # 配音与时间轴（只合成改动过的句子）
node tools/export_layout.mjs                # 镜头时间表
.venv/bin/python tools/build_audio.py       # 配乐、音效与混音
.venv/bin/python tools/make_credits.py      # 片尾署名
node tools/make_srt.mjs                     # 字幕
node tools/render.mjs                       # 渲染 MP4（约 10 分钟）
```

所有内容都写在剧本 `src/script.js` 里，包括旁白、镜头、转场、粒子和画面文字。改完剧本按上面的顺序重跑即可。单帧检查用 `node tools/snap.mjs 秒数 …`。

---

# 一笔画完南京（竖屏短视频版）

竖屏 1080×1920，时长 2 分钟，无旁白，配乐 128 BPM，画面全部由 Canvas 代码绘制，不用生成图。

- 成片：`output/short/一笔画完南京.mp4`
- 封面：`output/short/封面_开场.jpg`（开场钩子）、`output/short/封面_海报.jpg`（整张路线海报）

![一笔画完南京路线海报](output/short/封面_海报.jpg)

## 概念

一支笔从“南京到底有多好逛？”开始，按“之”字形路线依次画出 12 个地标。每站固定 4 小节，节奏如下：

1. 线描
2. 上色
3. 标题砸下
4. 副标题
5. 贴纸
6. 红色虚线把画面甩向下一站

画到一半时拉远，提示“画了一半”。最后镜头拉远，12 站拼成一张完整的南京 citywalk 路线海报，红点沿路线巡游一遍，然后弹出“收藏这张图 / 你最想去第几站？”。结尾就是一张适合截图收藏的海报，用来引导收藏和评论。

12 站依次是：

| 序号 | 地标 | 序号 | 地标 | 序号 | 地标 |
|---|---|---|---|---|---|
| 01 | 长江大桥 | 05 | 美龄宫 | 09 | 中华门 |
| 02 | 鸡鸣寺 | 06 | 石象路 | 10 | 鸭血粉丝汤 |
| 03 | 明城墙 | 07 | 南京博物院 | 11 | 世界文学之都 |
| 04 | 中山陵 | 08 | 秦淮河 | 12 | 河西 · 南京眼 |

## 文件

```
short/src/film.js    节拍时间轴、12 站文案与配色、音效事件
short/src/art.js     12 幅线描插画（全部是代码生成的路径）
short/src/engine.js  镜头、连续笔迹、上色、动态文字、进度条、片尾海报
short/tools/         build_music.py（配乐与音效）、render.mjs、snap.mjs、export_events.mjs
```

## 重新生成

```bash
node short/tools/export_events.mjs
.venv/bin/python short/tools/build_music.py
node short/tools/render.mjs        # 约 3 分钟
```

---

# 金陵 2500（档案风格版）

16:9 横屏，时长 2 分 14 秒，无旁白，配乐 96 BPM。风格参照 Prometheus 式的“文明档案”：做旧羊皮纸、铜版雕刻线稿、红色关键词，加上年份、时间轴、“十朝都会 x/10”组成的档案 HUD。只有开场“埋金”和 1937 两处用暗场，其余为羊皮纸或明亮暖金色调。

- 成片：`output/history/金陵2500.mp4`
- 剧本（43 个镜头）：`history/src/film.js`

![金陵 2500 中山陵封面](output/history/封面_中山陵.jpg)

## 准确性的来源

- **建筑**：由构件库 `history/src/arch.js` 拼出，包括起翘曲面屋顶、瓦垄、斗拱、须弥座、牌坊、拱门、匾额。
- **地标**：午门（凹字形）、琉璃塔、鸡鸣寺、栖霞舍利塔、明远楼、中山陵（博爱坊、陵门“天下为公”、祭堂）、中央大学大礼堂、长江大桥桥头堡与三面红旗都是 3D 建模。
- **地图**：明城墙、玄武湖、秦淮河取自 OpenStreetMap；海岸线、长江、黄河取自 Natural Earth；南京都市圈各城市使用真实经纬度。
- **孙中山铜像、紫峰大厦、南京南站**：先用 Wikimedia Commons 的实拍照片，再由 Codex 描成与全片一致的雕版线稿，造型与比例来自真实照片。照片署名见 `assets/web/credits.json` 中的 `w_ref_*`。

## 重新生成

```bash
node history/tools/export_events.mjs
.venv/bin/python history/tools/build_music.py
node history/tools/render.mjs          # 约 2 分钟
node history/tools/snap.mjs 84 105     # 抽帧检查
```
