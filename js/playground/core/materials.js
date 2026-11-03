/* =========================================================================
   MATERIALS — a small library of surface types so nothing looks like default plastic:
   stone & cobbles, wood, roof shingles, striped fabric, plaster, painted metal, gold, glass, animated water,
   wind-swayed foliage, light bulbs, glowing windows and lamp glass. Glows (windows, lamps, bulbs) are
   registered here and brightened as night falls.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { paving, wood as woodTex, shingles, fabric as fabricTex, plaster as plasterTex, ripples } from './textures.js';
import { MOOD, lookNum, nightness } from './mood.js';
import { scanned, WET } from './scans.js';
import { waterMaterial } from './water.js';

const PAL = CONFIG.palette;
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const rep = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };
const WIND = { value: 0 }; // shared time uniform for everything that sways
const SUNVIEW = { value: new THREE.Vector3(0, 1, 0) }, SUNCOL = { value: new THREE.Color() }; // view-space sun and its colour: light glowing through leaves
const GLOWS = [];          // { m, key: 'windows'|'lamps'|'bulbs', base }

// architecture wears photo-scanned PBR surfaces (albedo · normal · AO/roughness), tinted to the palette
const lift = (c, k = 1.25) => new THREE.Color(c).multiplyScalar(k);                 // scans are darker than paint: brighten the tint
const stone = (r = 1, color = PAL.stone, kind = 'slabs') => once(`stone${r}${color}${kind}`, () => scanned(kind === 'cobble' ? 'cobblestone_floor_04' : 'castle_brick_07', { macro: kind === 'cobble' ? 1 : 0.5, dew: kind === 'cobble' ? 0.8 : 0, tint: lift(color, kind === 'cobble' ? 0.92 : 1.35), repeat: r * (kind === 'cobble' ? 1 : 1.5), normal: 1 }));
const wood = (color = PAL.wood, r = 1) => once(`wood${color}${r}`, () => scanned('wood_planks_dirt', { tint: lift(color, 1.7), repeat: r, normal: 0.9 }));
const shingle = (color = PAL.lavender, rx = 3, ry = 3) => once(`sh${color}${rx}${ry}`, () => { const m = scanned('roof_slates_02', { tint: lift(color, 1.45), repeat: Math.max(rx, ry) * 0.9, normal: 1.2, side: THREE.DoubleSide }); m.roughnessMap.repeat.set(rx * 0.9, ry * 0.9); for (const t of [m.map, m.normalMap, m.aoMap]) t.repeat.set(rx * 0.9, ry * 0.9); return m; });
const fabric = (c1 = PAL.sakura, c2 = PAL.cream, stripes = 8, rx = 1, ry = 1) => once(`fab${c1}${c2}${stripes}${rx}${ry}`, () => { const t = fabricTex(c1, c2, stripes);
  return new THREE.MeshPhysicalMaterial({ map: rep(t.map, rx, ry), normalMap: rep(t.normalMap, rx, ry), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6, side: THREE.DoubleSide }); });
const plaster = (color = PAL.cream, r = 1) => once(`pl${color}${r}`, () => scanned('white_plaster_02', { tint: lift(color, 1.08), repeat: r * 1.5, normal: 0.8 }));
void paving; void woodTex; void shingles; void plasterTex;
// painted and matte surfaces belong to a "family" (same shading, different colour): when batched, the colour is
// baked into vertex colours and the whole family merges into one draw call (see batch.js)
const rough10 = r => Math.round(r * 10) / 10;
const family = (kind, rough) => once(`fam${kind}${rough}`, () => kind === 'paint'
  ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: rough, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.35 })
  : new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: rough }));
const paint = (color, rough = 0.42) => once(`paint${color}${rough}`, () => { const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.35 }); m.userData.family = () => family('paint', rough10(rough)); return m; });
const matte = (color, rough = 0.75) => once(`matte${color}${rough}`, () => { const m = new THREE.MeshStandardMaterial({ color, roughness: rough }); m.userData.family = () => family('matte', rough10(rough)); return m; });
const gold = () => once('gold', () => new THREE.MeshStandardMaterial({ color: '#E9BE6A', metalness: 1, roughness: 0.28 }));
const silver = () => once('silver', () => new THREE.MeshStandardMaterial({ color: '#E6E2EE', metalness: 1, roughness: 0.25 }));
const glass = (tint = '#DDEBFF', opacity = 0.22) => once(`glass${tint}${opacity}`, () => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, metalness: 0, transparent: true, opacity, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }));

// emissive surfaces that wake up at night: lit windows (an interior painted into `map`), lamp glass, bulbs
function windowMat(map, color = '#FFD9A8', base = 1) { const m = new THREE.MeshStandardMaterial({ color: '#2a2030', map, emissive: color, emissiveMap: map, emissiveIntensity: 0, roughness: 0.25, metalness: 0.1 }); GLOWS.push({ m, key: 'windows', base }); return m; }
function lampGlass(color = '#FFD7A8', base = 2.2) { return once(`lamp${color}${base}`, () => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.3, transparent: true, opacity: 0.92 }); GLOWS.push({ m, key: 'lamps', base, floor: 0.35 }); return m; }); }
// a painted sign: readable by day, softly lit by night
function signMat(map, base = 0.9) { const m = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.1, roughness: 0.55, transparent: true, alphaTest: 0.05 }); GLOWS.push({ m, key: 'lamps', base, floor: 0.08 }); return m; }
// self-lit accents that glow at night (mushroom caps, neon trims)
function glow(color, base = 1.5, floor = 0.15) { return once(`glow${color}${base}${floor}`, () => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: floor, roughness: 0.4 }); GLOWS.push({ m, key: 'lamps', base, floor }); return m; }); }
function bulb(color = '#FFE2B8', base = 3) { return once(`bulb${color}${base}`, () => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); m.userData.base = new THREE.Color(color); GLOWS.push({ m, key: 'bulbs', base }); return m; }); }
function updateGlows() {
  const w = lookNum('windows'), l = lookNum('lamps'), n = nightness();
  for (const g of GLOWS) {
    if (g.key === 'bulbs') g.m.color.copy(g.m.userData.base).multiplyScalar(0.7 + g.base * n);
    else g.m.emissiveIntensity = Math.max(g.floor || 0, (g.key === 'windows' ? w : l) * g.base);
  }
}

// foliage that sways: wind displacement grows with height inside each instance, phase from its position
function foliage(color = PAL.leaf, rough = 0.85, amp = 0.06) {
  return once(`fol${color}${amp}`, () => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = WIND; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uSunView = SUNVIEW; sh.uniforms.uSunCol = SUNCOL;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunView, uSunCol;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float bl = pow(max(dot(-normalize(vViewPosition), uSunView), 0.0), 3.0);   // looking toward the sun through foliage
        totalEmissiveRadiance += diffuseColor.rgb * uSunCol * (bl * 0.55 + 0.04);`);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind, uAmp;').replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float k = uAmp * (0.6 + 0.4 * sin(uWind * 0.6 + ph * 0.5)) * max(position.y + 0.6, 0.0);
        transformed.x += sin(uWind * 1.7 + ph) * k; transformed.z += cos(uWind * 1.3 + ph * 1.3) * k * 0.6;`);
    };
    m.customProgramCacheKey = () => 'foliage';
    return m;
  });
}

// water: deep teal body, sky reflections (Fresnel from the physical model), a scrolling ripple normal and a sun glint
// water now lives in water.js (planar reflection + ripple shader); this keeps the old call sites working
function water(color = '#4FA3B8', scale = 4) { return waterMaterial(color, 0.6 + scale * 0.15); }
function oldWater(color = '#4FA3B8', scale = 4) {
  const n = ripples(), n2 = n.clone(); n.repeat.set(scale, scale); n2.repeat.set(scale * 0.7, scale * 0.7); n2.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05, clearcoatNormalMap: n2, clearcoatNormalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.4, transparent: true, opacity: 0.88 });
  m.userData.tick = (t) => { n.offset.set(t * 0.012, t * 0.008); n2.offset.set(-t * 0.009, t * 0.011); };
  WATERS.push(m); return m;
}
const WATERS = [];
// stronger wind = faster sway
function updateMaterials(dt, t, wind = 1) { WIND.value += dt * (0.5 + 0.5 * wind); for (const w of WATERS) w.userData.tick(t); if (MOOD.changed) updateGlows(); }

export { SUNVIEW, SUNCOL, stone, wood, shingle, fabric, plaster, paint, matte, gold, silver, glass, windowMat, lampGlass, signMat, glow, bulb, foliage, water, updateGlows, updateMaterials, WIND };
