/* =========================================================================
   SCANS — photo-scanned CC0 PBR surfaces from Poly Haven (assets/tex/<set>/diff · nor · arm), shared with
   Hollowmoor: albedo (sRGB), OpenGL normal, and ARM (R = ambient occlusion, G = roughness, B = metalness).
   Textures stream in after the material exists; until then the material shows its tint.
   ========================================================================= */
import * as THREE from 'three';
import { renderer } from './renderer.js';

const WET = { value: 0 }; // 0 dry … 1 soaked
const tl = new THREE.TextureLoader(), cache = new Map(), CLONES = new Map(); // texture → clones waiting for its image
function set(name) {
  if (cache.has(name)) return cache.get(name);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ld = (f, srgb) => { const t = tl.load(`assets/tex/${name}/${f}.jpg`, () => { for (const c of CLONES.get(t) || []) c.needsUpdate = true; }); CLONES.set(t, []); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const s = { diff: ld('diff', true), nor: ld('nor', false), arm: ld('arm', false) }; cache.set(name, s); return s;
}
// a scanned material: tint multiplies the albedo; repeat is in texture tiles across the UV range.
// macro (0–1): breaks up the tiling the way real paving and turf weather — large-scale tone variation in world
// space, a second rotated sample of the albedo at a different scale, and darker, mossier patches where the
// low-frequency field dips. dew (0–1): the evening dew that settles on paving after dark — the tops turn
// faintly glossy, so lamps and the lit rides glint and pool on the stones instead of lying on a matte carpet.
function scanned(name, { tint = '#ffffff', repeat = 1, normal = 1, rough = 1, side, vertexColors = false, wet = 1, macro = 0, dew = 0 } = {}) {
  const s = set(name), rep = (t) => { const c = t.clone(); c.repeat.set(repeat, repeat); if (t.image) c.needsUpdate = true; else CLONES.get(t).push(c); return c; };
  const m = new THREE.MeshStandardMaterial({ color: tint, map: rep(s.diff), normalMap: rep(s.nor), normalScale: new THREE.Vector2(normal, normal), roughnessMap: rep(s.arm), aoMap: rep(s.arm), aoMapIntensity: 0.9, roughness: rough, metalness: 0, vertexColors });
  if (side) m.side = side;
  const detail = macro > 0 || dew > 0;
  m.onBeforeCompile = (sh) => { sh.uniforms.uWet = WET;
    if (detail) sh.vertexShader = 'varying vec3 vSWP;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        vSWP = (modelMatrix * wp).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;' + (detail ? `\nvarying vec3 vSWP;
      float sHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sHash(i), sHash(i + vec2(1, 0)), f.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), f.x), f.y); }` : ''));
    if (detail) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float mN = sNoise(vSWP.xz * 0.06) * 0.55 + sNoise(vSWP.xz * 0.23 + 7.1) * 0.3 + sNoise(vSWP.xz * 0.9 + 3.3) * 0.15;
      #ifdef USE_MAP
        vec3 t2 = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.37 + 0.21).rgb;
        diffuseColor.rgb *= mix(1.0, clamp(dot(t2, vec3(0.333)) * 2.1, 0.6, 1.4), 0.4 * ${macro.toFixed(2)});
      #endif
      diffuseColor.rgb *= mix(1.0, 0.7 + 0.55 * mN, ${macro.toFixed(2)});
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.84, 0.7), smoothstep(0.38, 0.2, mN) * 0.5 * ${macro.toFixed(2)});`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float upK = smoothstep(0.35, 0.85, dot(normalize(vNormal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
        float wetK = uWet * ${wet.toFixed(2)} * upK; // surfaces facing the sky
        roughnessFactor = mix(roughnessFactor, 0.08, wetK * 0.85); diffuseColor.rgb *= 1.0 - wetK * 0.35;` + (dew > 0 ? `
        float dewK = ${dew.toFixed(2)} * upK * (0.55 + 0.45 * mN) * (1.0 - wetK);
        roughnessFactor = mix(roughnessFactor, 0.3, dewK * 0.75); diffuseColor.rgb *= 1.0 - dewK * 0.12;` : '')); };
  m.customProgramCacheKey = () => 'scan-wet' + wet + '|m' + macro + '|d' + dew;
  return m;
}

export { scanned, WET };
