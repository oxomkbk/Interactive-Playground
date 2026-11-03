import * as THREE from 'three';
import { setPCSS } from './pcss.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { $, PI, V3, clamp } from './utils.js';
import { U_PSCALE } from './shaders.js';
import { MISTS } from '../world/atmosphere.js';
import { S } from '../game/play.js';
import { toast } from '../ui/ui.js';
import { t } from './i18n.js';

/* =========================================================================
   2. RENDERER, SCENE, CAMERA, LIGHTS & POST-PROCESSING
   ========================================================================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCF honours shadow.radius (PCFSoft ignores it) — soft, distance-plausible penumbrae
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const FOG_BASE = new THREE.Color().setRGB(0.032, 0.024, 0.048);
const FOG_RED = new THREE.Color().setRGB(0.09, 0.012, 0.012);
scene.fog = new THREE.FogExp2(FOG_BASE.clone(), 0.0088);
scene.background = FOG_BASE.clone();
const FOGU = { value: 0.0088 }; // shared with custom shaders

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 2200);
camera.rotation.order = 'YXZ';
scene.add(camera);

const MOON_DIR = new V3(-0.36, 0.40, -0.84).normalize();
const hemi = new THREE.HemisphereLight(0x5a66b0, 0x2a1810, 1.0);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xa8b8ff, 1.6);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 420 }); // tight, texel-snapped follow frustum = crisp contact shadows
moon.shadow.bias = -0.0002; moon.shadow.normalBias = 0.045; moon.shadow.radius = 3; moon.shadow.blurSamples = 12;
scene.add(moon, moon.target);
const MOON_COL = new THREE.Color(0xa8b8ff), MOON_RED = new THREE.Color(0xff3020), HEMI_SKY = new THREE.Color(0x5a66b0), C_HEMI_RED = new THREE.Color(0xff3020), C_TOWER = new THREE.Color(0xff7a20), C_TOWER_RED = new THREE.Color(0xff1a00);

// Lantern (flashlight) carried by the player — F to toggle
const lantern = new THREE.SpotLight(0xffd7a0, 0, 40, 0.55, 0.6, 2);
lantern.position.set(0.25, -0.2, 0);
camera.add(lantern); camera.add(lantern.target); lantern.target.position.set(0, -0.3, -5);

// Real-time point lights are deliberately limited (~11). Everything else glows via emissive + bloom + light-pool decals.
const LIGHTS = {};
// Logical point lights live OUTSIDE the scene; a small pool of real lights (size per quality tier) is re-assigned every frame
// to whichever logical lights matter most for the current view, with short cross-fades. Fewer real lights = much cheaper
// fragment shading on every surface, with no visible difference nearby (far lights are dim anyway; emissives + light pools remain).
const LOGICAL = []; let LPOOL = [];
function pointLight(name, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z);
  l.userData.base = intensity; LIGHTS[name] = l; LOGICAL.push(l); return l;
}
function buildLightPool(n) {
  for (const p of LPOOL) scene.remove(p); for (const l of LOGICAL) l.userData.slot = null; LPOOL = [];
  for (let i = 0; i < n; i++) { const p = new THREE.PointLight(0xffffff, 0, 10, 2); p.userData.src = null; p.userData.w = 0; scene.add(p); LPOOL.push(p); }
}
const _want = [];
function updateLightPool(dt) {
  const cp = camera.position; _want.length = 0;
  for (const l of LOGICAL) { l.userData.score = 0; const I = l.intensity; if (I <= 0.01) continue;
    const range = l.distance > 0 ? l.distance : 90, d = l.position.distanceTo(cp); if (d > range * 2.5 + 30) continue;
    l.userData.score = I / Math.pow(Math.max(d - range * 0.3, 2), 2) * (l.userData.slot ? 1.4 : 1) * (l.userData.instant ? 50 : 1); _want.push(l); }
  _want.sort((x, y) => y.userData.score - x.userData.score); if (_want.length > LPOOL.length) _want.length = LPOOL.length;
  for (const p of LPOOL) { const src = p.userData.src; if (!src) continue;
    if (_want.includes(src)) p.userData.w = Math.min(1, p.userData.w + dt * 5);
    else { p.userData.w -= dt * 5; if (p.userData.w <= 0) { src.userData.slot = null; p.userData.src = null; p.userData.w = 0; } } }
  for (const l of _want) if (!l.userData.slot) { let free = LPOOL.find(p => !p.userData.src);
    if (!free && l.userData.instant) { free = LPOOL.reduce((m, p) => (p.userData.src.userData.score < m.userData.src.userData.score ? p : m)); free.userData.src.userData.slot = null; }
    if (!free) break; free.userData.src = l; free.userData.w = l.userData.instant ? 1 : 0; l.userData.slot = free; }
  for (const p of LPOOL) { const src = p.userData.src; if (!src) { p.intensity = 0; continue; }
    if (src.userData.instant) p.userData.w = 1; p.position.copy(src.position); p.color.copy(src.color); p.distance = src.distance; p.intensity = src.intensity * p.userData.w; }
}

// ---------- Post-processing stack ----------
// Quality tiers. Everything that costs GPU time scales here; "Auto" picks a tier from the GPU and then tunes it from real frame times.
const QUALITY = {
  low:    { pr: 0.75, shadow: 1024, shadowEvery: 3, ao: false, aoScale: 0.5, aoSamples: 8,  dof: false, dofScale: 0.5, msaa: 0, bloomRes: 0.35, rays: false, lights: 4,  mist: 2 },
  medium: { pr: 1.0,  shadow: 2048, shadowEvery: 2, ao: true,  aoScale: 0.5, aoSamples: 8,  dof: false, dofScale: 0.5, msaa: 2, bloomRes: 0.45, rays: true,  lights: 6,  mist: 3 },
  high:   { pr: Math.min(devicePixelRatio, 1.5), shadow: 4096, shadowEvery: 1, ao: true, aoScale: 0.5, aoSamples: 10, dof: true, dofScale: 0.5, msaa: 4, bloomRes: 0.5, rays: true, lights: 8, mist: 3 },
  ultra:  { pr: Math.min(devicePixelRatio, 2),   shadow: 4096, shadowEvery: 1, ao: true, aoScale: 1,   aoSamples: 16, dof: true, dofScale: 1,   msaa: 4, bloomRes: 0.6, rays: true, lights: 10, mist: 3 },
};
const QORDER = ['low', 'medium', 'high', 'ultra'];
let QAUTO = true, QDETECT = 'high', QCAP = 'ultra', GPU = '';
function detectQuality() {
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); GPU = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) {}
  const g = GPU.toLowerCase(); let q = 'high';
  if (/mobi|android|iphone|ipad/i.test(navigator.userAgent) || /swiftshader|llvmpipe|software|basic render/.test(g)) q = 'low';
  else if (/intel|uhd|iris|mali|adreno|powervr|vega [0-9] |radeon\(tm\) graphics/.test(g) || (navigator.hardwareConcurrency || 8) <= 4) q = 'medium';
  else if (/rtx|rx 6[7-9]|rx 7|apple m\d (pro|max|ultra)/.test(g)) q = 'ultra';
  QCAP = QORDER[Math.min(3, QORDER.indexOf(q) + 1)]; return q;
}
let QNAME = 'high', Q = QUALITY[QNAME];

const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const FX_OBJECTS = []; // additive/transparent effects hidden from the AO & DOF depth passes
function withFXHidden(pass) {
  const orig = pass.render.bind(pass);
  pass.render = (...a) => { for (const o of FX_OBJECTS) { o.userData._v = o.visible; o.visible = false; } orig(...a); for (const o of FX_OBJECTS) o.visible = o.userData._v; };
}
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.blendIntensity = 0.85;
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.5, scale: 1.0, samples: 12 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
withFXHidden(gtao);
composer.addPass(gtao);

const bokeh = new BokehPass(scene, camera, { focus: 14, aperture: 0.00004, maxblur: 0.0009 });
withFXHidden(bokeh);
composer.addPass(bokeh);

// Screen-space moon shafts: radial march toward the moon, only bright samples near the disc contribute,
// so trees, the tower and the Eye cut real-looking crepuscular rays through the haze.
const raysPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uMoonUV: { value: new THREE.Vector2(0.5, 0.8) }, uI: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uMoonUV; uniform float uI,uAspect; varying vec2 vUv;
    void main(){ vec3 base=texture2D(tDiffuse,vUv).rgb; if(uI<.002){ gl_FragColor=vec4(base,1.); return; }
      vec2 d=uMoonUV-vUv; vec2 st=d/40.; vec2 uv=vUv; vec3 acc=vec3(0.); float decay=1.;
      for(int i=0;i<40;i++){ uv+=st; vec2 q=(uv-uMoonUV)*vec2(uAspect,1.); vec3 s=texture2D(tDiffuse,clamp(uv,0.,1.)).rgb;
        float lum=dot(s,vec3(.3,.5,.2)); float sat=(max(max(s.r,s.g),s.b)-min(min(s.r,s.g),s.b))/max(lum,1e-3);
        float w=smoothstep(1.3,3.2,lum)*exp(-dot(q,q)*90.)*(1.-smoothstep(.15,.5,sat)); acc+=min(s,vec3(2.5))*w*decay; decay*=.972; }
      vec2 dd=d*vec2(uAspect,1.);
      gl_FragColor=vec4(base+acc/40.*uI*exp(-length(dd)*1.6)*vec3(.72,.8,1.),1.); }`,
});
composer.addPass(raysPass);

// Highlight roll-off: HDR values above a knee are compressed smoothly (shoulder) BEFORE bloom and tone mapping,
// so lamps, the moon and firework cores glow instead of clipping into blinding blobs.
const rolloffPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uKnee: { value: 1.4 }, uRange: { value: 2.6 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uKnee,uRange; varying vec2 vUv;
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float L=max(max(c.r,c.g),c.b);
      if(L>uKnee){ float e=L-uKnee; float Lc=uKnee+e/(1.+e/uRange); c*=Lc/L; c=mix(c,vec3(dot(c,vec3(.3,.5,.2))),clamp(e/(uRange*6.),0.,.25)); }
      gl_FragColor=vec4(c,1.); }`,
});
// Shockwave: up to four expanding refraction rings (screen space) for large firework bursts
const shockPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uS: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec4 uS[4]; uniform float uAspect; varying vec2 vUv;
    void main(){ vec2 uv=vUv; float lit=0.;
      for(int i=0;i<4;i++){ vec4 s=uS[i]; if(s.w<=0.) continue; vec2 d=(uv-s.xy)*vec2(uAspect,1.); float r=length(d), w=.01+s.z*.12;
        float band=exp(-pow((r-s.z)/w,2.)); uv-=d/max(r,1e-4)/vec2(uAspect,1.)*band*s.w*.01; lit+=band*s.w; }
      gl_FragColor=vec4(texture2D(tDiffuse,uv).rgb*(1.+lit*.04),1.); }`,
});
composer.addPass(shockPass);
composer.addPass(rolloffPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.42, 0.62, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Final grade: chromatic aberration, split-tone, contrast, filters, vignette, grain, flashes, letterbox
const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
    uVignette: { value: 0.6 }, uCA: { value: 0.7 }, uGrain: { value: 0.03 }, uSharp: { value: 0.5 }, uFlash: { value: new THREE.Vector3() },
    uRed: { value: 0 }, uUnify: { value: 0.6 }, uFilter: { value: 0 }, uScare: { value: 0 }, uLetterbox: { value: 0 }, uFade: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uVignette,uCA,uGrain,uRed,uUnify,uFilter,uScare,uLetterbox,uSharp; uniform vec2 uRes; uniform vec3 uFlash;
    varying vec2 vUv;
    float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    void main(){
      vec2 uv=vUv; vec2 d=uv-.5;
      uv += vec2(sin(uTime*47.+uv.y*40.),cos(uTime*39.+uv.x*30.))*uScare*0.012;
      float r2=dot(d,d); vec2 off=d*r2*uCA*0.025;
      vec3 col=vec3(texture2D(tDiffuse,uv+off).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-off).b);
      vec2 px=1./uRes; vec3 nb=texture2D(tDiffuse,uv+vec2(px.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(px.x,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,px.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,px.y)).rgb;
      col=max(col+(col-nb*.25)*uSharp,0.);
      float l=dot(col,vec3(.2126,.7152,.0722));
      col=mix(col,col*vec3(.86,.98,1.14),(1.-smoothstep(0.,.45,l))*.4);   // cool shadows
      col=mix(col,col*vec3(1.08,.98,.86),smoothstep(.35,1.,l)*.35);       // warm highlights
      col=mix(col,col*col*(3.-2.*col),.22);                                // gentle S-curve
      { vec3 ch=col-vec3(l); float cm=length(ch); col=vec3(l)+ch/(1.+cm*uUnify*1.6);       // colour harmony: soft-clip neon chroma
        col=mix(col,col*mix(vec3(.92,.9,1.08),vec3(1.06,.98,.9),smoothstep(.05,.6,l)),uUnify*.35); } // one shared shadow/highlight tint
      if(uFilter>.5&&uFilter<1.5){ float g=pow(l,.92); col=clamp((vec3(g)*vec3(1.02,1.,.95)-.5)*1.3+.5,0.,1.); }
      else if(uFilter>1.5&&uFilter<2.5){ col=vec3(dot(col,vec3(.393,.769,.189)),dot(col,vec3(.349,.686,.168)),dot(col,vec3(.272,.534,.131)))*vec3(1.,.9,.78); }
      else if(uFilter>2.5){ col=vec3(l*.3,l*1.3,l*1.05)+vec3(0.,.025,.035); }
      col=mix(col,vec3(l*1.35,l*.22,l*.18),uRed);
      float vig=smoothstep(1.05,.25,length(d*vec2(1.,.82))*1.3);
      col*=mix(1.,vig,uVignette);
      col+=(h12(uv*uRes+fract(uTime*7.3)*331.)-.5)*uGrain*(1.-l*.6);
      col+=uFlash;
      if(abs(d.y)>.5-uLetterbox) col=vec3(0.);
      gl_FragColor=vec4(col,1.);
    }`,
});
composer.addPass(finalPass);
const FP = finalPass.uniforms;

function setQualityButtons() {
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === 'auto' ? QAUTO : b.dataset.q === QNAME));
  document.querySelectorAll('.qinfo').forEach(el => { el.textContent = `${QAUTO ? t('Auto') + ' → ' : ''}${t(QNAME)} · ${perf.fps ? perf.fps.toFixed(0) + ' fps' : '…'}${GPU ? ' · ' + GPU.replace(/^ANGLE \(|\)$/g, '').slice(0, 52) : ''}`; });
}
function setQualityChoice(q) {
  if (q === 'auto') { QAUTO = true; perf.downs = 0; try { localStorage.removeItem('hollowmoor-quality'); } catch (e) {} applyQuality(QDETECT); return; }
  QAUTO = false; try { localStorage.setItem('hollowmoor-quality', q); } catch (e) {} applyQuality(q);
}
// Console overrides: null = follow the quality preset, otherwise forced on/off or scaled. Persisted by the console.
// exposure = artistic base × a slow "eye adaptation" factor (eased down during bright events like barrages)
const EXPO = { base: 1, adapt: 1, bloom: 0.42 };
const OVR = { tonemap: 'aces', harmony: 1, shadows: null, ao: null, dof: null, rays: null, bloom: 1, grain: 1, ca: 1, vignette: 1, sharpen: 1, exposure: 1, fog: 1, scale: 1 };
const ovr = (o, q) => (o === null || o === undefined ? q : o);
function applyOverrides() {
  renderer.shadowMap.enabled = ovr(OVR.shadows, true); moon.castShadow = renderer.shadowMap.enabled;
  gtao.enabled = ovr(OVR.ao, Q.ao); bokeh.enabled = ovr(OVR.dof, Q.dof) || S.mode === 'photo'; raysPass.enabled = ovr(OVR.rays, Q.rays);
  EXPO.bloom = 0.42 * OVR.bloom; bloom.strength = EXPO.bloom; bloom.enabled = OVR.bloom > 0.01;
  FP.uGrain.value = 0.03 * OVR.grain; FP.uCA.value = 0.7 * OVR.ca; FP.uVignette.value = 0.6 * OVR.vignette; FP.uSharp.value = 0.5 * OVR.sharpen;
  renderer.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[OVR.tonemap] || THREE.ACESFilmicToneMapping; FP.uUnify.value = 0.6 * OVR.harmony;
  EXPO.base = (OVR.tonemap === 'agx' ? 1.35 : OVR.tonemap === 'neutral' ? 0.85 : 1.0) * OVR.exposure; renderer.toneMappingExposure = EXPO.base * EXPO.adapt; scene.fog.density = 0.0088 * OVR.fog; FOGU.value = scene.fog.density;
  renderer.shadowMap.needsUpdate = true;
}
function applyQuality(name, silent) {
  QNAME = name; Q = QUALITY[name];
  renderer.setPixelRatio(Q.pr * OVR.scale); moon.shadow.mapSize.set(Q.shadow, Q.shadow); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
  gtao.updateGtaoMaterial({ samples: Q.aoSamples }); applyOverrides();
  setPCSS(Q.ao, Q.ao ? { k: 0.05, maxUV: 0.006, minUV: 0.00025, samples: name === 'ultra' ? 24 : 16 } : undefined, scene);   // moonlight: contact-hardening soft shadows on High/Ultra
  if (LPOOL.length !== Q.lights) buildLightPool(Q.lights);
  MISTS.forEach((m, i) => { m.visible = i < Q.mist; });
  for (const t of [composer.renderTarget1, composer.renderTarget2]) { if (t.samples !== Q.msaa) { t.samples = Q.msaa; t.dispose(); } }
  renderer.shadowMap.needsUpdate = true; onResize(); setQualityButtons(); if (!silent) toast(t('Quality: {q}', { q: t(name) }), QAUTO ? 'Auto mode' : 'Manual override');
}
function onResize() {
  const w = innerWidth, h = innerHeight; camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setPixelRatio(Q.pr * OVR.scale); composer.setSize(w, h);
  gtao.setSize(Math.round(w * Q.pr * OVR.scale * Q.aoScale), Math.round(h * Q.pr * OVR.scale * Q.aoScale));               // AO & DOF depth can run below full res with no visible loss
  bokeh.renderTargetDepth.setSize(Math.round(w * Q.pr * OVR.scale * Q.dofScale), Math.round(h * Q.pr * OVR.scale * Q.dofScale));
  bloom.resolution.set(w * Q.bloomRes, h * Q.bloomRes); FP.uRes.value.set(w * Q.pr * OVR.scale, h * Q.pr * OVR.scale);
  U_PSCALE.value = h * Q.pr * OVR.scale / (2 * Math.tan(camera.fov * PI / 360));
}
addEventListener('resize', onResize);
const perf = { frames: 0, t0: 0, low: 0, high: 0, downs: 0, fps: 0 };
function autoQuality() {
  const now = performance.now(); if (!perf.t0) { perf.t0 = now; return; } perf.frames++;
  if (now - perf.t0 < 2000) return;
  perf.fps = perf.frames * 1000 / (now - perf.t0); perf.frames = 0; perf.t0 = now; setQualityButtons();
  if (!QAUTO || S.mode === 'photo' || document.hidden) return;
  const i = QORDER.indexOf(QNAME);
  if (perf.fps < 42) { perf.high = 0; if (++perf.low >= 2 && i > 0) { perf.low = 0; perf.downs++; applyQuality(QORDER[i - 1], true); toast(t('Quality → {q}', { q: t(QORDER[i - 1]) }), t('auto-tuned ({n} fps)', { n: perf.fps.toFixed(0) })); } }
  else if (perf.fps > 57) { perf.low = 0; if (++perf.high >= 4 && perf.downs === 0 && i < QORDER.indexOf(QCAP)) { perf.high = 0; applyQuality(QORDER[i + 1], true); toast(t('Quality → {q}', { q: t(QORDER[i + 1]) }), 'auto-tuned: headroom detected'); } }
  else { perf.low = 0; perf.high = 0; }
}
function initQuality() {
  QDETECT = detectQuality(); let saved = null; try { saved = localStorage.getItem('hollowmoor-quality'); } catch (e) {}
  if (saved && QUALITY[saved]) { QAUTO = false; applyQuality(saved, true); } else applyQuality(QDETECT, true);
}

export { EXPO, rolloffPass, shockPass, OVR, applyOverrides, canvas, renderer, scene, FOG_BASE, FOG_RED, FOGU, camera, MOON_DIR, hemi, moon, MOON_COL, MOON_RED, HEMI_SKY, C_HEMI_RED, C_TOWER, C_TOWER_RED, lantern, LIGHTS, LOGICAL, pointLight, buildLightPool, _want, updateLightPool, QUALITY, QORDER, QAUTO, QDETECT, QCAP, GPU, detectQuality, QNAME, Q, rt, composer, renderPass, FX_OBJECTS, withFXHidden, gtao, bokeh, raysPass, bloom, finalPass, FP, setQualityButtons, setQualityChoice, applyQuality, onResize, perf, autoQuality, initQuality };
