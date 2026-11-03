/* =========================================================================
   GROUND — the land and everything you walk on: a meadow inside the park that rolls into hills and a ring of
   lavender mountains, the castle's hill, the central plaza with an inlaid compass-rose floor, the stone
   boulevard, the circular promenade, paths out to every ride and paved pads under them.
   All of it receives shadows; none of it casts.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { fbm, smooth } from '../../core/utils.js';
import { stone, matte } from '../core/materials.js';
import { grass as grassTex } from '../core/textures.js';
import { canvasTex } from '../core/geo.js';
import { scanned } from '../core/scans.js';

const L = CONFIG.layout, PAL = CONFIG.palette, PI = Math.PI;

// the land before lakes and hamlets are cut into it (used to seat each hamlet on its hillside)
function heightBase(x, z) { const r = Math.hypot(x, z); return smooth(L.parkRadius + 4, 170, r) * (fbm(x * 0.008, z * 0.008, 1e6, 4, 7) * 34 - 6) + smooth(320, 760, r) * (24 + fbm(x * 0.004, z * 0.004, 1e6, 4, 11) * 120); }
// terrain height: flat park, gentle swells outside it, the castle hill, far mountains
function heightAt(x, z) {
  const r = Math.hypot(x, z), c = L.castle;
  let h = smooth(L.parkRadius + 4, 170, r) * (fbm(x * 0.008, z * 0.008, 1e6, 4, 7) * 34 - 6);
  if (z > 0) h *= Math.max(smooth(12, 36, Math.abs(x)), smooth(150, 200, z)); // the approach to the gate stays level
  h += smooth(320, 760, r) * (24 + fbm(x * 0.004, z * 0.004, 1e6, 4, 11) * 120); // a soft blue range, low enough for the sun to set over
  const dc = Math.hypot(x - c.x, z - c.z); h = Math.max(h, c.h * smooth(48, 14, dc));
  // the lake basin: shores ease down to the water and the bed drops a few metres beneath it
  const lk = L.lake; if (lk) { const e = Math.hypot((x - lk.x) / lk.rx, (z - lk.z) / lk.rz); if (e < 1.6) { const m = smooth(1.45, 0.92, e); h = h * (1 - m) + (lk.y - 0.4 - 2.6 * smooth(1.0, 0.35, e)) * m; } }
  // the Mirror Pools: basins cut below the park's water plane, with a level stone surround
  for (const [x0, z0, x1, z1] of L.pools || []) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz); if (d < 6) { const m = smooth(6, 1.2, d); h = h * (1 - m) + (d < 0.01 ? -0.6 : 0.42) * m; if (d < 0.01) h = -0.6; } }
  // level platforms for the hamlets
  for (const [vx, vz, n] of L.villages || []) { const dv = Math.hypot(x - vx, z - vz), r0 = 10 + n * 1.3; if (dv < r0 + 30) { const m = smooth(r0 + 30, r0, dv); h = h * (1 - m * 0.75) + heightBase(vx, vz) * m * 0.75; } }
  return h;
}

// the plaza floor: concentric bands, a compass rose of hearts and stars, painted once at 2048 px
function plazaTex() {
  return canvasTex(2048, 2048, (g, n) => {
    const c = n / 2; g.fillStyle = '#E9DDCD'; g.fillRect(0, 0, n, n);
    const ring = (r0, r1, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r1, 0, PI * 2); g.arc(c, c, r0, 0, PI * 2, true); g.fill(); };
    ring(0, c, '#E6D8C6'); ring(c * 0.9, c * 0.97, '#C9B3A8'); ring(c * 0.62, c * 0.66, '#B7A0B8'); ring(c * 0.4, c * 0.43, '#D7A9B9');
    // radial slab joints
    g.strokeStyle = 'rgba(120,100,95,.35)'; g.lineWidth = 3;
    for (let k = 0; k < 48; k++) { const a = k / 48 * PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.43, c + Math.sin(a) * c * 0.43); g.lineTo(c + Math.cos(a) * c * 0.97, c + Math.sin(a) * c * 0.97); g.stroke(); }
    for (const rr of [0.5, 0.56, 0.72, 0.8]) { g.beginPath(); g.arc(c, c, c * rr, 0, PI * 2); g.stroke(); }
    // compass rose: eight petals in lavender and rose, a gold star between them
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; g.save(); g.translate(c, c); g.rotate(a);
      g.fillStyle = k % 2 ? '#C9A6DD' : '#EBA3BD'; g.beginPath(); g.moveTo(0, -c * 0.44); g.quadraticCurveTo(c * 0.07, -c * 0.53, 0, -c * 0.62); g.quadraticCurveTo(-c * 0.07, -c * 0.53, 0, -c * 0.44); g.fill();
      g.fillStyle = '#E8C47E'; g.font = `${c * 0.06}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(PI / 8); g.fillText('✦', 0, -c * 0.85); g.fillText('♥', 0, -c * 0.53); g.restore(); }
    // stone speckle and wear
    for (let i = 0; i < 60000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,70,80'},${0.03 + Math.random() * 0.07})`; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
  }, false);
}

// the plaza's luminous inlays: gold rings, a compass of stars and hearts that glow from within at night
function plazaGlow() {
  return canvasTex(1024, 1024, (g, n) => { const c = n / 2; g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
    const ring = (r, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(c, c, r, 0, PI * 2); g.stroke(); };
    ring(c * 0.935, 5, '#C9934A'); ring(c * 0.64, 3, '#8F6AB8'); ring(c * 0.415, 4, '#C9934A'); ring(c * 0.53, 2, '#4A9FA8');
    g.font = `${c * 0.07}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 8; k++) { g.save(); g.translate(c, c); g.rotate(k / 8 * PI * 2 + PI / 8); g.fillStyle = '#D9A55A'; g.fillText('✦', 0, -c * 0.85); g.fillStyle = '#C46A8E'; g.fillText('♥', 0, -c * 0.53); g.restore(); }
    for (let i = 0; i < 260; i++) { const a = Math.random() * PI * 2, r = c * (0.43 + Math.random() * 0.5); g.fillStyle = `rgba(255,${200 + Math.random() * 40},${150 + Math.random() * 60},${0.3 + Math.random() * 0.5})`; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.2 + Math.random() * 1.8, 0, PI * 2); g.fill(); }
  });
}

// under the Castle Hill path and terrace the lawn mesh (6 m triangles) is lowered a little, so the finely draped
// paving above it stays on top however the coarse triangles interpolate the hill
const TERRAIN_SINK = (x, z) => { const cf = L.castle.z + 9, G = L.garden; const onPath = Math.abs(x) < 7 && z < L.balloons[1] - 4 && z > cf - 6, onTer = z > cf - 6 && Math.hypot(x, (z - cf) * 25 / 19) < 30;
  if (Math.hypot((x - G.x) / 10, (z - G.z) / 6.5) < 1.05) return 0.7;                                   // the garden pond has a real basin
  return onPath || onTer ? 0.3 : 0; };

function createGround() {
  const root = new THREE.Group(); root.name = 'ground';
  const flat = (m) => { m.receiveShadow = true; m.castShadow = false; root.add(m); return m; };

  // terrain with vertex colours: park lawn → meadow → wooded hills → lavender mountains
  const g = new THREE.PlaneGeometry(2000, 2000, 320, 320).rotateX(-PI / 2), p = g.attributes.position, col = [], c = new THREE.Color();
  const lawn = new THREE.Color('#ffffff'), meadow = new THREE.Color('#A9BC8E'), wood = new THREE.Color('#4E6249'), far = new THREE.Color('#4A5856'), peak = new THREE.Color('#878596');
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z), r = Math.hypot(x, z); p.setY(i, h - TERRAIN_SINK(x, z));
    c.copy(lawn).lerp(meadow, smooth(L.parkRadius - 4, 110, r)).lerp(wood, smooth(110, 260, r) * 0.8).lerp(far, smooth(300, 650, r)).lerp(peak, smooth(120, 240, h)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const gm = scanned('leafy_grass', { tint: '#AFCB8E', repeat: 560, normal: 1.2, vertexColors: true, wet: 0.35, macro: 0.8 }); void grassTex; // Poly Haven scan, ~3.6 m tiles
  flat(new THREE.Mesh(g, gm));

  // ---- paving. One cobblestone material with world-space UVs for every path, pad and promenade, merged into a
  // single mesh at one height: where pieces overlap they are identical, so nothing can flicker between them.
  // Paving is lifted 4 cm and drawn with a polygon offset, so the lawn never wins the depth test at any distance.
  const decal = (m, k = 1) => { m.polygonOffset = true; m.polygonOffsetFactor = -1 * k; m.polygonOffsetUnits = -4 * k; return m; };
  const worldUV = (g) => { const pp = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 4, pp.getZ(i) / 4); return g; };
  const PY = 0.04, pave = decal(scanned('cobblestone_floor_04', { tint: '#CFC3C2', repeat: 2, normal: 1.15, macro: 1, dew: 0.85 }));   // weathered grey-rose cobbles, dewy after dark
  const pieces = [];
  // plaza: the inlaid floor and a darker stone band around it (a ring, not a second disc underneath)
  const pl = L.plaza;
  flat(new THREE.Mesh(new THREE.RingGeometry(pl.r - 0.02, pl.r + 0.8, 128, 1).rotateX(-PI / 2).translate(pl.x, PY + 0.01, pl.z), decal(stone(6, '#D8C7B6'), 2)));
  flat(new THREE.Mesh(new THREE.CircleGeometry(pl.r, 128).rotateX(-PI / 2).translate(pl.x, PY + 0.01, pl.z), decal(new THREE.MeshStandardMaterial({ map: plazaTex(), color: '#9C93A2', roughness: 0.32, metalness: 0.05, emissive: '#ffffff', emissiveMap: plazaGlow(), emissiveIntensity: 2.2 }), 2)));
  // promenade ring and the boulevard
  const rp = L.ringPath; pieces.push(new THREE.RingGeometry(rp.r - rp.w / 2, rp.r + rp.w / 2, 160, 1).rotateX(-PI / 2).translate(0, PY, 0));
  const b = L.boulevard, bl = b.z1 - b.z0;
  pieces.push(new THREE.PlaneGeometry(b.w, bl + 14).rotateX(-PI / 2).translate(b.x, PY, (b.z0 + b.z1 + 14) / 2));
  for (const s of [-1, 1]) flat(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, bl).translate(b.x + s * (b.w / 2 + 0.1), 0.06, (b.z0 + b.z1) / 2), matte('#C9B9D6', 0.7)));
  // paths from the promenade to each attraction, and paved pads under them
  const pads = [['ferris', 15], ['carousel', 11], ['teacups', 9.5], ['swings', 11.5], ['bumper', 0], ['balloons', 10.5], ['pirate', 11], ['drop', 7], ['ringToss', 5.5], ['claw', 5.5], ['stage', 13], ['observatory', 8], ['golf', 0], ['fishing', 7.5], ['gallery', 6]];
  for (const [id, pr] of pads) { const [x, z] = L[id]; const d = Math.hypot(x, z), ux = x / d, uz = z / d;
    if (pr) pieces.push(new THREE.CircleGeometry(pr, 64).rotateX(-PI / 2).translate(x, PY, z));
    const s0 = rp.r + rp.w / 2 - 0.3, s1 = d - Math.max(pr, 4) + 0.5; if (s1 <= s0) continue;
    const len = s1 - s0; pieces.push(new THREE.PlaneGeometry(3.2, len).rotateX(-PI / 2).rotateY(Math.atan2(ux, uz)).translate(ux * (s0 + len / 2), PY, uz * (s0 + len / 2))); }
  // the Castle Hill path and the castle terrace, draped on the terrain (the lawn is sunk beneath them: see TERRAIN_SINK)
  const cf = L.castle.z + 9, hz0 = L.balloons[1] - 11, hl = hz0 - cf;
  const hill = new THREE.PlaneGeometry(4.2, hl, 1, 64).rotateX(-PI / 2).translate(0, 0, (hz0 + cf) / 2);
  { const pp = hill.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, heightAt(pp.getX(i), pp.getZ(i)) + 0.06); hill.computeVertexNormals(); } pieces.push(hill);
  const ter = new THREE.CircleGeometry(1, 64, PI, PI).rotateX(-PI / 2).scale(25, 1, 19).translate(0, 0, cf);
  { const pp = ter.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, heightAt(pp.getX(i), pp.getZ(i)) + 0.06); ter.computeVertexNormals(); } pieces.push(ter);
  flat(new THREE.Mesh(worldUV(mergeAll(pieces)), pave));
  return { object3D: root, update() {}, heightAt };
}

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const mergeAll = (arr) => mergeGeometries(arr.map(g => g.index ? g.toNonIndexed() : g));

export { createGround, heightAt };
