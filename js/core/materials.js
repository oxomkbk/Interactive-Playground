import * as THREE from 'three';
import { fbm, hdr, smooth } from './utils.js';
import { AS } from './assets.js';
import { weather } from './surface.js';
import { HALLOW_WEATHER } from './artdirection.js';
import { windowTex, genCobble, genGround, genHedge, genRoof, genStone, genWallpaper, genWood, leafTex, pbrSet, pumpkinFaceTex, radialTex, rugTex, scareFaceTex, signTex, webTex } from './textures.js';

/* =========================================================================
   3. MATERIALS (filled in after textures are generated)
   ========================================================================= */
const M = {};
const TX = {};
function buildMaterials() {
  const cob = genCobble(), grd = genGround(), stn = genStone(), wd = genWood(), rf = genRoof(), hg = genHedge();
  const face = pumpkinFaceTex();
  Object.assign(TX, { face, pool: radialTex(128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [0.6, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]),
    glow: radialTex(64), leaf: leafTex(), scare: scareFaceTex(), web: webTex() });
  M.cobble = new THREE.MeshPhysicalMaterial({ ...cob, normalScale: new THREE.Vector2(1.25, 1.25), envMapIntensity: 1.5, clearcoat: 0.85, clearcoatRoughness: 0.16 }); // rain-slick stone (soft film: reflections without hard glare): rough rock under a thin water film
  M.ground = new THREE.MeshStandardMaterial({ ...grd, normalScale: new THREE.Vector2(1, 1) });
  M.stone = new THREE.MeshStandardMaterial({ ...stn, normalScale: new THREE.Vector2(1.4, 1.4) });
  M.stoneDark = new THREE.MeshStandardMaterial({ ...stn, color: 0x77708a, normalScale: new THREE.Vector2(1.4, 1.4) });
  M.wood = new THREE.MeshStandardMaterial({ ...wd });
  M.woodDark = new THREE.MeshStandardMaterial({ ...wd, color: 0x6a5a58 });
  M.roof = new THREE.MeshStandardMaterial({ ...rf, normalScale: new THREE.Vector2(1.5, 1.5) });
  M.hedge = new THREE.MeshStandardMaterial({ ...hg, roughness: 0.9, color: 0xc8e0c8, normalScale: new THREE.Vector2(1.6, 1.6) });
  M.iron = new THREE.MeshStandardMaterial({ color: 0x18171c, metalness: 0.85, roughness: 0.42 });
  M.rust = new THREE.MeshStandardMaterial({ color: 0x6a2216, metalness: 0.6, roughness: 0.48 });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xc89a4a, metalness: 1, roughness: 0.28 });
  M.bone = new THREE.MeshStandardMaterial({ color: 0xd9ceb4, roughness: 0.62 });
  M.black = new THREE.MeshStandardMaterial({ color: 0x0b0a0e, roughness: 0.35, metalness: 0.2 });
  M.cloth = new THREE.MeshPhysicalMaterial({ color: 0x3a1a4a, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0x9a70c0), sheenRoughness: 0.5 });
  M.straw = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 1 });
  M.leafPile = new THREE.MeshStandardMaterial({ color: 0x5a2a0e, roughness: 1 });
  M.wallpaper = new THREE.MeshStandardMaterial({ map: genWallpaper(), roughness: 0.85 });
  M.rug = new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 });
  M.pumpkinLit = new THREE.MeshPhysicalMaterial({ map: face.map, emissiveMap: face.emissiveMap, emissive: 0xff7a1a, emissiveIntensity: 2.4, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  M.pumpkin = new THREE.MeshPhysicalMaterial({ color: 0xc8560c, roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  M.stem = new THREE.MeshStandardMaterial({ color: 0x3a3a14, roughness: 0.9 });
  M.bark = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.95 });
  M.purple = new THREE.MeshStandardMaterial({ color: 0x3a1650, roughness: 0.5, metalness: 0.3 });
  M.orange = new THREE.MeshStandardMaterial({ color: 0xb0480c, roughness: 0.5, metalness: 0.3 });
  M.glass = new THREE.MeshBasicMaterial({ color: hdr(0xff9a40, 1.6) });
  M.glowGreen = new THREE.MeshBasicMaterial({ color: hdr(0x5aff9a, 2.2) });
  M.glowViolet = new THREE.MeshBasicMaterial({ color: hdr(0xb070ff, 2.2) });
  M.glowOrange = new THREE.MeshBasicMaterial({ color: hdr(0xff8a2a, 2.2) });
  M.glowRed = new THREE.MeshBasicMaterial({ color: hdr(0xff2010, 2.2) });
  M.candle = new THREE.MeshBasicMaterial({ color: hdr(0xffc070, 4) });
  M.wax = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 });
  M.dark = new THREE.MeshBasicMaterial({ color: 0x050407 });
  M.window = new THREE.MeshBasicMaterial({ map: windowTex(false), color: hdr(0xffa850, 1.8) });
  M.plate = new THREE.MeshStandardMaterial({ ...plateTex(), metalness: 0.85, roughness: 0.42 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x111014, roughness: 0.7 });
  M.zombie = new THREE.MeshStandardMaterial({ color: 0x6a8a52, roughness: 0.75 });
  M.gold = new THREE.MeshStandardMaterial({ color: 0xffc040, metalness: 1, roughness: 0.2, emissive: 0x402000 });
  M.ghostly = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.4, emissive: 0x8ab0c0, emissiveIntensity: 0.6 });
  M.books = [0x5a1414, 0x183a22, 0x3a2614, 0x1a2244, 0x4a3a18].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  M.velvet = new THREE.MeshPhysicalMaterial({ color: 0x4a0a14, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xc04050), sheenRoughness: 0.4 });
  M.flag = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
  M.lacquerBlack = new THREE.MeshPhysicalMaterial({ color: 0x100c14, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.lacquerBone = new THREE.MeshPhysicalMaterial({ color: 0xe2d6be, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12 });
  M.carPaint = new THREE.MeshPhysicalMaterial({ color: 0x2a1036, metalness: 0.5, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  M.candy = new THREE.MeshBasicMaterial({ color: 0xffffff });
  M.redText = new THREE.MeshBasicMaterial({ map: signTex('GET OUT', { size: 200, color: '#8a0a0a', glow: '#ff0000', bg: null }), transparent: true, color: hdr(0xffffff, 1.2), depthWrite: false });
}
function plateTex(N = 512) { // diamond-tread steel for the bumper-car floor
  const C = new Uint8ClampedArray(N * N * 4), H = new Float32Array(N * N), Rg = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * 16, v = (y / N) * 16, cu = u - Math.floor(u) - .5, cv = v - Math.floor(v) - .5, flip = (Math.floor(u) + Math.floor(v)) % 2;
    const a = flip ? cu + cv : cu - cv, b = flip ? cu - cv : cu + cv, tread = smooth(0.12, 0.06, Math.abs(a)) * smooth(0.36, 0.3, Math.abs(b));
    const sc = fbm(x / N * 6, y / N * 6, 6, 3, 41), i = y * N + x, k = 40 + 30 * sc + tread * 25;
    C[i * 4] = k; C[i * 4 + 1] = k; C[i * 4 + 2] = k * 1.08; C[i * 4 + 3] = 255; H[i] = tread; Rg[i] = 0.55 - tread * 0.2 + sc * 0.25;
  }
  return pbrSet(N, C, H, Rg, 8);
}

// scanned CC0 surfaces (Poly Haven) replace the procedural maps wherever they loaded — triplanar, world-scaled, then
// weathered with Hollowmoor's palette (soot grime, rain runs, wet moss). Missing sets keep the procedural material.
const HOLLOW_SETS = ['cobblestone_floor_04', 'leaves_forest_ground', 'castle_brick_07', 'wood_planks_dirt', 'rock_pitted_mossy', 'roof_slates_02', 'leafy_grass', 'bark_brown_02', 'metal_plate', 'white_plaster_02'];
function scanMaterials() {
  const use = (m, set, size, color, o = {}) => { const S = AS.sets[set]; if (!m || !S) return; m.map = m.normalMap = m.roughnessMap = m.aoMap = null; m.roughness = o.rough ?? 1; if (color !== undefined) m.color.setHex(color);
    weather(m, { ...HALLOW_WEATHER, ...o.w, tp: { diff: S.diff, nor: S.nor, arm: S.arm, scale: 1 / size, nScale: o.n ?? 1.2, rot: !!o.rot, far: 0.3, minR: o.minR } }); };
  use(M.cobble, 'cobblestone_floor_04', 2.0, 0x8c8492, { n: 1.3, w: { top: 0.1 } });
  use(M.ground, 'leaves_forest_ground', 3.2, 0x8e8078, { w: { grime: 0, streak: 0, top: 0 } });
  use(M.stone, 'castle_brick_07', 2.6, 0xaea6b8, { n: 1.4 }); use(M.stoneDark, 'castle_brick_07', 2.6, 0x6a647a, { n: 1.4 });
  use(M.wood, 'wood_planks_dirt', 1.5, 0xc4b2a2); use(M.woodDark, 'wood_planks_dirt', 1.5, 0x75665f);
  use(M.roof, 'roof_slates_02', 1.8, 0x6c6678, { n: 1.5 }); use(M.hedge, 'leafy_grass', 1.0, 0x6c8a6c, { n: 1.6, w: { streak: 0 } }); use(M.bark, 'bark_brown_02', 1.2, 0x5c4c46, { n: 1.6 });
  for (const k of ['iron', 'rust', 'plate']) use(M[k], 'metal_plate', 0.9, undefined, { n: 0.5, rough: 0.9, minR: 0.3 });
  use(M.bone, 'white_plaster_02', 0.8, 0xd8ccb2, { n: 0.5 });
}
export { M, TX, buildMaterials, plateTex , HOLLOW_SETS, scanMaterials};
