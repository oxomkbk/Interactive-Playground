/* =========================================================================
   NIGHT LIGHTS — the park's illumination after dark, without hundreds of real lights. Every attraction,
   lamp, the gate and the castle floodlights register a light (position, radius, colour); each quarter second
   the 32 that matter most around the camera are chosen, moved into view space, and every PBR material in the
   scene adds their warm light in its fragment shader (smooth falloff, wrapped diffuse, a touch of specular).
   They fade in with nightness, so dusk and night share one system, and pulse gently where asked.
   BAKED LIGHT: every static light in the park is also painted once, at boot, into a top-down light map
   (1024² over 340 m) with the same falloff. Every lit material samples it at its world position (weighted toward
   surfaces that face up, fading with height above the ground), so all the lamps, rides and shopfronts light
   the paths and plazas from the very first frame and from any distance — nothing switches on as you approach,
   and the cost is one texture read. The live slots then add only what a map can't: the glint of each nearby
   light on the surfaces around you, plus full light from the big movers (castle floods, firework flashes).
   ========================================================================= */
import * as THREE from 'three';
import { scene, camera } from './renderer.js';
import { nightness } from './mood.js';

const N = 16, FADE = 4; // the last FADE slots ease in and out, so the active set never switches abruptly
const U = { uNLp: { value: Array.from({ length: N }, () => new THREE.Vector4()) }, uNLc: { value: Array.from({ length: N }, () => new THREE.Color(0, 0, 0)) }, uNLk: { value: 0 }, uLM: { value: null }, uLMinv: { value: new THREE.Matrix4() }, uLMo: { value: new THREE.Vector2(0, -35) }, uLMs: { value: 340 }, uLMk: { value: 0 } };
const LMAX = 8;   // light map stores colour × intensity / LMAX in 8 bits
const all = [];
const _v = new THREE.Vector3();

function addNightLight(pos, radius = 14, color = '#FFC27A', intensity = 2, { pulse = 0, always = 0 } = {}) {
  const l = { p: pos.clone(), r: radius, c: new THREE.Color(color).multiplyScalar(intensity), pulse, always, ph: Math.random() * 6 }; all.push(l); return l;
}

const FRAG = /* glsl */`
  #if NUM_NL > 0
  if (uNLk > 0.001) { vec3 nlN = normalize(normal); vec3 nlV = normalize(vViewPosition);
    if (uLMk > 0.0) { vec3 wP = (uLMinv * vec4(-vViewPosition, 1.0)).xyz; vec2 lmUV = (wP.xz - uLMo) / uLMs + 0.5;
      if (lmUV.x > 0.0 && lmUV.x < 1.0 && lmUV.y > 0.0 && lmUV.y < 1.0) {
        float up = dot(nlN, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)) * 0.5 + 0.5;
        vec3 lm = texture2D(uLM, lmUV).rgb * uLMk * 0.8;
        lm /= 1.0 + dot(lm, vec3(0.333)) * 0.55;   // where many lights overlap they roll off softly instead of burning out
        lm *= exp(-max(wP.y - 0.3, 0.0) / 4.5) * (0.35 + 0.65 * up);
        reflectedLight.directDiffuse += diffuseColor.rgb * lm * uNLk; } }
    for (int i = 0; i < NUM_NL; i++) { vec4 lp = uNLp[i]; if (lp.w == 0.0) continue;
      bool specOnly = lp.w < 0.0; float rad = abs(lp.w);
      vec3 L = lp.xyz + vViewPosition; float d = length(L); if (d > rad) continue; L /= d;
      float att = 1.0 - d / rad; att *= att;
      float ndl = max(dot(nlN, L) * 0.65 + 0.35, 0.0);
      // specular follows the surface: dewy paving and glazed paint catch tight bright glints, matte stone a broad sheen
      vec3 H = normalize(L + nlV); float nlR = clamp(material.roughness, 0.05, 1.0), sp = pow(max(dot(nlN, H), 0.0), mix(220.0, 10.0, nlR)) * mix(1.6, 0.12, nlR);
      if (!specOnly) reflectedLight.directDiffuse += diffuseColor.rgb * uNLc[i] * att * ndl * uNLk;
      reflectedLight.directSpecular += uNLc[i] * att * sp * uNLk; } }
  #endif`;

// patch one material (keeps any patch it already has)
function patch(m) {
  if (!m || m.userData.nl || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
  m.userData.nl = true; const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey && m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev && prev.call(m, sh, r);
    Object.assign(sh.uniforms, { uNLp: U.uNLp, uNLc: U.uNLc, uNLk: U.uNLk, uLM: U.uLM, uLMinv: U.uLMinv, uLMo: U.uLMo, uLMs: U.uLMs, uLMk: U.uLMk });
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n#define NUM_NL ${N}\nuniform vec4 uNLp[NUM_NL]; uniform vec3 uNLc[NUM_NL]; uniform float uNLk; uniform sampler2D uLM; uniform mat4 uLMinv; uniform vec2 uLMo; uniform float uLMs, uLMk;`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FRAG);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|nl';
  m.needsUpdate = true;
}
function patchScene(root = scene) { root.traverse(o => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(patch); }); }

// paint every static light into the light map, once (call after the world has registered its lights)
function bakeLightmap() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'lighter';
  const o = U.uLMo.value, size = U.uLMs.value, stops = [[0, 1], [0.2, 0.64], [0.4, 0.36], [0.6, 0.16], [0.8, 0.04], [1, 0]];
  let n = 0;
  for (const l of all) { if (l.always) continue; l.baked = true; n++;
    const px = ((l.p.x - o.x) / size + 0.5) * S, py = ((l.p.z - o.y) / size + 0.5) * S, pr = l.r / size * S, hk = Math.exp(-Math.max(l.p.y - 3.5, 0) / 8);
    const k = hk / LMAX, gr = g.createRadialGradient(px, py, 0, px, py, pr);
    for (const [u, a] of stops) { const r = Math.min(255, l.c.r * k * a * 255), gg = Math.min(255, l.c.g * k * a * 255), b = Math.min(255, l.c.b * k * a * 255); gr.addColorStop(u, `rgb(${r | 0},${gg | 0},${b | 0})`); }
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.flipY = false;
  U.uLM.value = t; U.uLMk.value = LMAX; return n;
}

let pickT = 0, chosen = [];
function updateNightLights(dt, t) {
  const n = nightness(); U.uNLk.value = Math.max(0, (n - 0.15) / 0.85); U.uLMinv.value.copy(camera.matrixWorld);
  if ((pickT -= dt) <= 0) { pickT = 0.25; const cp = camera.position;
    const ranked = all.filter(l => l.always || U.uNLk.value > 0).map(l => ({ l, s: l.always ? -1e4 + l.p.distanceTo(cp) : l.p.distanceTo(cp) - l.r * 1.5 })).sort((a, b) => a.s - b.s);
    const cut = ranked[N - FADE] ? ranked[N - FADE].s : Infinity, end = ranked[N] ? ranked[N].s : cut + 20;
    for (const o of ranked) o.l.want = o.s <= cut ? 1 : Math.max(0, 1 - (o.s - cut) / Math.max(1, end - cut));
    chosen = ranked.slice(0, N).map(o => o.l); for (const o of ranked.slice(N)) o.l.want = 0; }
  for (const l of all) l.w = (l.w ?? 0) + ((l.want ?? 0) - (l.w ?? 0)) * Math.min(1, dt * 3);   // ease every light's weight
  for (let i = 0; i < N; i++) { const l = chosen[i], p = U.uNLp.value[i];
    if (!l || l.w < 0.002) { p.w = 0; continue; }
    _v.copy(l.p).applyMatrix4(camera.matrixWorldInverse); p.set(_v.x, _v.y, _v.z, l.baked ? -l.r : l.r);   // baked lights add only their glint here
    U.uNLc.value[i].copy(l.c).multiplyScalar(l.w * (l.pulse ? 1 - l.pulse * 0.5 + Math.sin(t * 2 + l.ph) * l.pulse * 0.5 : 1)); }
}

export { addNightLight, patchScene, patch, updateNightLights, bakeLightmap };
