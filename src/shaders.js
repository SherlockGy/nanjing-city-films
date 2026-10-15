/* GLSL 着色器：镜头渲染（取景/影调/水墨晕染/氛围）与最终合成（转场/文字/宣纸/颗粒） */
const GLSL_COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float sstep(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0., 1.); return t*t*(3.-2.*t); }
float fbm(vec2 p){ float s=0., a=.5; mat2 r=mat2(.8,-.6,.6,.8); for(int i=0;i<5;i++){ s+=a*vnoise(p); p=r*p*2.03+11.7; a*=.5; } return s/.97; }
const vec3 PAPER = vec3(.925,.900,.840);
const vec3 INKC  = vec3(.07,.07,.08);
`;

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*.5+.5; gl_Position = vec4(aPos,0.,1.); }`;

const FS_SHOT = GLSL_COMMON + `
in vec2 vUv; out vec4 o;
uniform sampler2D uImg, uInk, uFx, uPaperTex;
uniform vec4 uXf;          // 取景：宽高(纹理uv) + 中心
uniform float uLook;       // 0 photo 1 ink 2 bleed 3 paint 4 canvas
uniform float uBleed, uSeed, uLocal;
uniform float uMist, uSwirl, uGlow, uDark, uRipple, uLamp, uCity, uDrop, uDropT, uHasFx, uDawn;
uniform vec2 uDropC;

vec3 grade(vec3 c){
  float l = dot(c, vec3(.299,.587,.114));
  c = mix(vec3(l), c, .84);
  c = c*.93 + vec3(.04,.036,.03);
  c *= vec3(1.025, 1.0, .955);
  c = mix(c, smoothstep(vec3(0.), vec3(1.), c), .35);
  return c;
}
// 墨滴：在宣纸上落下、洇开
float inkBlob(vec2 uv, vec2 c, float t, float seed, float big){
  if (t <= 0.) return 0.;
  vec2 p = (uv - c) * vec2(uRes.x/uRes.y, 1.);
  float ang = atan(p.y, p.x);
  float r = length(p);
  float grow = (0.03 + big * (1. - exp(-t * 0.85))) ;
  float warp = (fbm(vec2(cos(ang), sin(ang)) * 1.6 + seed + t*.05) - .5) * .55 + (fbm(p*6. + seed) - .5) * .35;
  float edge = grow * (1. + warp);
  float core = sstep(edge, edge - .015 - grow*.25, r);
  float rim = exp(-pow((r - edge*.97)/(.012 + grow*.03), 2.)) * .35;
  float halo = sstep(edge*1.35, edge, r) * .12;
  // 飞溅的小墨点
  float sp = 0.;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float a = hash(vec2(fi, seed)) * 6.283;
    float d = grow * (1.1 + hash(vec2(seed, fi)) * .9);
    vec2 q = p - vec2(cos(a), sin(a)) * d;
    float rr = .004 + hash(vec2(fi*3.1, seed)) * .012 * min(1., t*3.);
    sp = max(sp, sstep(rr, rr*.4, length(q)));
  }
  float dens = core * (.62 + .38 * fbm(p*9. + seed)) + rim + halo + sp*.9;
  return clamp(dens * sstep(0., .08, t), 0., 1.);
}

void main(){
  vec2 uv = vUv;
  if (uSwirl > 0.) {
    float k = uSwirl * (.012 + uLocal * .0035);
    uv += k * vec2(fbm(uv*2.2 + vec2(0., uLocal*.09)) - .5, fbm(uv*2.2 + vec2(5.2, -uLocal*.08)) - .5);
  }
  if (uRipple > 0. && uv.y < .42) {
    float w = (.42 - uv.y) / .42;
    uv.x += sin(uv.y * 340. + uTime * 2.2) * .0011 * w * uRipple + (vnoise(vec2(uv.y*60., uTime*.8)) - .5) * .003 * w * uRipple;
  }
  vec2 iuv = uXf.zw + (uv - .5) * uXf.xy;
  vec3 col;
  vec3 photo = texture(uImg, iuv).rgb;
  if (uLook < .5) col = grade(photo);
  else if (uLook < 1.5) col = texture(uInk, iuv).rgb;
  else if (uLook < 2.5) {
    vec3 ink = texture(uInk, iuv).rgb;
    vec3 ph = grade(photo);
    // 色彩像水一样从画面中心偏下向四周洇开
    vec2 q = (uv - vec2(.5, .45)) * vec2(1.6, 1.);
    float g = .58 * length(q) + .42 * fbm(uv * vec2(4.2, 2.6) + uSeed);
    float th = uBleed * 1.3 - .12;
    float m = sstep(th, th - .1, g);
    float front = exp(-pow((g - th + .03) / .035, 2.)) * step(.001, uBleed) * step(uBleed, .999);
    col = mix(ink, ph, m);
    col = mix(col, col * vec3(.86, .84, .82), front * .7);   // 水渍边
  }
  else col = photo;  // paint / canvas
  if (uGlow > 0.) {
    vec3 b = textureLod(uImg, iuv, 5.).rgb;
    vec3 b2 = textureLod(uImg, iuv, 3.).rgb;
    col += (max(b - .45, 0.) * 1.4 + max(b2 - .55, 0.) * .9) * uGlow * vec3(1., .82, .55) * (.9 + .1 * sin(uTime * 3.));
  }
  if (uCity > 0.) {
    float l = dot(photo, vec3(.33));
    float tw = vnoise(uv * vec2(420., 240.) + uTime * 2.5);
    col += sstep(.55, .85, l) * (tw - .45) * .35 * uCity * vec3(1., .85, .6);
    col += max(textureLod(uImg, iuv, 4.).rgb - .5, 0.) * .8 * uCity * vec3(1., .8, .5);
  }
  if (uLamp > 0.) {
    float f = .5 + .5 * sin(uTime * 7.3) * .5 + .5 * vnoise(vec2(uTime * 6., 1.)) - .25;
    col *= 1. + uLamp * (f - .5) * .1;
    col += max(textureLod(uImg, iuv, 4.).rgb - .5, 0.) * uLamp * .9 * vec3(1., .75, .45);
  }
  if (uMist > 0.) {
    float n = fbm(uv * vec2(2.2, 5.) + vec2(uTime * .018, uTime * .004));
    float n2 = fbm(uv * vec2(4., 9.) - vec2(uTime * .03, 0.));
    float band = sstep(.0, .35, uv.y) * sstep(.9, .45, uv.y);
    float fog = sstep(.42, .82, n * .7 + n2 * .3) * band;
    col = mix(col, PAPER * 1.03, fog * .5 * uMist);
  }
  if (uDawn > 0.) {
    vec2 c = vec2(.82, .78);
    float d = length((uv - c) * vec2(1.78, 1.));
    col += vec3(1., .78, .45) * .28 * uDawn * exp(-d * 2.2);
  }
  if (uDrop > 0.) {
    float big = uDrop > 1.5 ? .34 : .24;
    float dens = inkBlob(uv, uDropC, uDropT, uSeed, big);
    col = mix(col, INKC + vec3(.03) * fbm(uv * 30.), dens * .93);
  }
  if (uHasFx > 0.) {
    vec4 fx = texture(uFx, vUv);
    col = col * (1. - fx.a) + fx.rgb;   // 预乘 alpha
  }
  // 宣纸纤维
  float pd = texture(uPaperTex, vUv * vec2(uRes.x / 2048., uRes.y / 2048.) * 1.0).r;
  float amt = uLook > 2.5 ? .14 : (uLook > .5 ? .12 : .05);
  col *= 1. + (pd - .5) * amt;
  col *= 1. - uDark;
  o = vec4(col, 1.);
}`;

const FS_COMP = GLSL_COMMON + `
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB, uText;
uniform float uP, uType, uSeed, uMood, uFadeBlack, uTwo;
uniform vec2 uOrigin;
vec3 sampleA(vec2 uv){ return texture(uA, uv).rgb; }
vec3 sampleB(vec2 uv){ return texture(uB, uv).rgb; }
void main(){
  vec2 uv = vUv;
  vec3 col;
  if (uTwo < .5) col = sampleA(uv);
  else {
    float p = uP;
    vec3 A = sampleA(uv), B = sampleB(uv);
    if (uType < .5) col = p < .5 ? A : B;                              // cut
    else if (uType < 1.5) {                                           // ink：墨晕开，新画面从墨中显出
      vec2 q = (uv - uOrigin) * vec2(uRes.x/uRes.y, 1.);
      float g = .55 * length(q) / 1.25 + .45 * fbm(uv * vec2(5.5, 3.2) + uSeed);
      float ti = p * 1.55 - .1, tr = p * 1.55 - .42;
      float inkM = sstep(ti, ti - .05, g);
      float revM = sstep(tr, tr - .2, g);
      vec3 inkc = mix(INKC, vec3(.28,.27,.27), fbm(uv * 14. + uSeed) * .8);
      col = mix(A, inkc, inkM * (1. - revM) * .92);
      col = mix(col, B, revM);
    }
    else if (uType < 2.5) {                                           // wash：旧画面被水洗淡，新画面洇出
      float n = fbm(uv * vec2(3.2, 2.1) + uSeed);
      float a = sstep(p * 1.6 - .15, p * 1.6 - .45, n);
      float b = sstep((p - .35) * 1.7, (p - .35) * 1.7 - .3, 1. - n);
      vec3 washed = mix(A, PAPER, .25 + .75 * sstep(0., .6, p));
      col = mix(A, washed, a);
      col = mix(col, B, clamp(b, 0., 1.));
    }
    else if (uType < 3.5) {                                           // brush：一笔横扫（右→左），带飞白
      float streak = fbm(vec2(uv.y * 38., uv.x * 1.5 + uSeed));
      float g = (1. - uv.x) + (streak - .5) * .22 + (fbm(uv * 3. + uSeed) - .5) * .1;
      float th = p * 1.4 - .15;
      float rev = sstep(th, th - .03, g);
      float band = exp(-pow((g - th + .05) / .07, 2.)) * sstep(.25, .75, streak + .2);
      col = mix(A, B, rev);
      col = mix(col, INKC, band * .85 * (1. - sstep(.85, 1., p)));
    }
    else if (uType < 4.5) col = mix(A, B, sstep(0., 1., p));     // fade
    else if (uType < 5.5) col = B * sstep(0., 1., p);            // black
    else {                                                            // scroll：手卷向左展开（画面整体右移）
      float s = sstep(0., 1., p);
      if (uv.x < s) col = sampleB(vec2(uv.x + 1. - s, uv.y));
      else col = sampleA(vec2(uv.x - s, uv.y));
      float d = abs(uv.x - s);
      col *= 1. - .35 * exp(-d * 60.) * step(.001, s) * step(s, .999);
    }
  }
  // 情绪：至暗时刻褪色
  float l = dot(col, vec3(.299,.587,.114));
  col = mix(col, vec3(l) * vec3(.98, .98, 1.), uMood * .85);
  col *= 1. - uMood * .18;
  // 暗角
  vec2 d = uv - .5;
  col *= 1. - .32 * pow(length(d * vec2(1.05, 1.25)) * 1.25, 2.6);
  // 文字层（预乘）
  vec4 tx = texture(uText, uv);
  col = col * (1. - tx.a) + tx.rgb;
  // 胶片颗粒
  col += (hash(uv * uRes + fract(uTime * 7.13) * 100.) - .5) * .022;
  col *= 1. - uFadeBlack;
  o = vec4(clamp(col, 0., 1.), 1.);
}`;
