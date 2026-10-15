// MiniMax 语音合成 / 音乐生成（同步 HTTP 接口）。只从环境变量读取 MINIMAX_API_KEY，不打印密钥。
import fs from 'node:fs';
const HOSTS = [process.env.MINIMAX_API_HOST, 'https://api.minimaxi.com', 'https://api.minimax.cn'].filter(Boolean);
// 多音字/生僻字读音
export const TONE = ['刘勰/(liu2)(xie2)', '秣陵/(mo4)(ling2)', '罹难/(li2)(nan4)', '天堑/(tian1)(qian4)', '十二钗/(shi2)(er4)(chai1)',
  '龙蟠/(long2)(pan2)', '虎踞/(hu3)(ju4)', '阿要/(a1)(yao4)', '还在/(hai2)(zai4)', '一卷/(yi1)(juan4)', '曾被/(ceng2)(bei4)'];

function key() {
  const k = process.env.MINIMAX_API_KEY;
  if (!k) throw new Error('没有找到环境变量 MINIMAX_API_KEY');
  return k;
}

async function post(path, body, retryable = 6) {
  let lastErr;
  for (const host of HOSTS) {
    for (let attempt = 0; attempt < retryable; attempt++) {
      try {
        const r = await fetch(`${host}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json();
        if (j?.base_resp?.status_code !== 0 || !j?.data?.audio) throw new Error(`MiniMax 返回错误：${j?.base_resp?.status_code} ${j?.base_resp?.status_msg}`);
        return j;
      } catch (e) {
        lastErr = e;
        if (/1004|1008|2013|2049|invalid api key|鉴权|balance/i.test(e.message)) break;
        await new Promise(r => setTimeout(r, /1002|rate limit/i.test(e.message) ? 20000 : 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export async function tts(text, out, { voice, model = 'speech-2.8-hd', speed = 0.95, pitch = 0, vol = 1, emotion } = {}) {
  const j = await post('/v1/t2a_v2', {
    model, text, stream: false,
    voice_setting: { voice_id: voice, speed, vol, pitch, ...(emotion ? { emotion } : {}) },
    pronunciation_dict: { tone: TONE },
    audio_setting: { sample_rate: 44100, bitrate: 128000, format: 'mp3', channel: 1 },
  });
  fs.writeFileSync(out, Buffer.from(j.data.audio, 'hex'));
  return j.extra_info;
}

export async function music(prompt, out, { model = 'music-3.0' } = {}) {
  const j = await post('/v1/music_generation', {
    model, prompt, is_instrumental: true, output_format: 'hex',
    audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
  }, 3);
  fs.writeFileSync(out, Buffer.from(j.data.audio, 'hex'));
  return j.extra_info;
}
