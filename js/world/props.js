import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PI, V3, lerp } from '../core/utils.js';
import { scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { SB, _up, addCircle, scaleUV } from '../core/registry.js';
import { t } from '../core/i18n.js';

/* =========================================================================
   6d. CRAFTED PROP GEOMETRY — bevelled boxes, turned (lathe) profiles, carved tombstones, Victorian lamps,
       park benches, barrels, carousel horses, coaster cars. Shared/cached so instancing stays cheap.
   ========================================================================= */
// Rounded (bevelled) box with world-scaled UVs per face, so textures keep their real-world density
function roundBox(w, h, d, r = 0.05, tile = 2, seg = 1) {
  const g = new RoundedBoxGeometry(w, h, d, seg, r), uv = g.attributes.uv, per = uv.count / 6, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < per; k++) { const i = f * per + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
const lathe = (profile, seg = 16) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function taper(a, b, r0, r1, seg = 8) { // tapered cylinder from a (radius r0) to b (radius r1)
  const dir = new V3().subVectors(b, a), len = dir.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1); g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize())); g.translate(a.x, a.y, a.z); return g;
}
const nonIdx = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const merge = list => mergeGeometries(list.map(nonIdx));
const COL_PROFILE = [[0.001, 0], [0.42, 0], [0.42, 0.25], [0.31, 0.35], [0.27, 0.5], [0.24, 3.9], [0.3, 4.05], [0.42, 4.15], [0.42, 4.4], [0.001, 4.4]];
const POST_PROFILE = [[0.001, 0], [0.1, 0], [0.1, 0.12], [0.07, 0.18], [0.06, 0.5], [0.08, 0.6], [0.055, 0.7], [0.05, 2.9], [0.075, 3.0], [0.06, 3.1], [0.07, 3.3], [0.001, 3.3]];
// Victorian cast-iron lamp post: turned base, fluted collar, glazed lantern cage, pyramid hood and finial
function lampPostGeo() {
  const parts = [lathe([[0.001, 0], [0.27, 0], [0.27, 0.07], [0.22, 0.1], [0.21, 0.26], [0.16, 0.32], [0.14, 0.46], [0.1, 0.52], [0.095, 0.6], [0.075, 0.68], [0.065, 3.3], [0.085, 3.35], [0.085, 3.42], [0.06, 3.48], [0.1, 3.58], [0.19, 3.66], [0.19, 3.72], [0.001, 3.74]], 16)];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5).translate(x * 0.135, 4.05, z * 0.135));
  parts.push(new THREE.CylinderGeometry(0.2, 0.17, 0.05, 4).rotateY(PI / 4).translate(0, 4.38, 0), new THREE.ConeGeometry(0.25, 0.32, 4).rotateY(PI / 4).translate(0, 4.56, 0));
  parts.push(new THREE.SphereGeometry(0.045, 10, 8).translate(0, 4.75, 0), new THREE.ConeGeometry(0.02, 0.12, 6).translate(0, 4.84, 0));
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; parts.push(new THREE.TorusGeometry(0.12, 0.012, 5, 12, PI * 1.2).rotateY(a).translate(Math.cos(a) * 0.1, 3.5, -Math.sin(a) * 0.1)); }
  return merge(parts);
}
// Carved headstones: arched stele, ringed cross, shouldered slab — bevelled extrusions on bevelled plinths
let TOMB_GEOS;
function tombGeos() {
  if (TOMB_GEOS) return TOMB_GEOS;
  const ex = (shape, depth, bev = 0.03) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 16 }); g.translate(0, 0, -depth / 2); return g; };
  const plinth = (w, d) => roundBox(w, 0.14, d, 0.035, 1).translate(0, 0.07, 0);
  const a = new THREE.Shape(); a.moveTo(-0.38, 0); a.lineTo(0.38, 0); a.lineTo(0.38, 0.78); a.absarc(0, 0.78, 0.38, 0, PI, false); a.lineTo(-0.38, 0);
  const c = new THREE.Shape([[-0.08, 0], [0.08, 0], [0.08, 0.9], [0.34, 0.9], [0.34, 1.06], [0.08, 1.06], [0.08, 1.38], [-0.08, 1.38], [-0.08, 1.06], [-0.34, 1.06], [-0.34, 0.9], [-0.08, 0.9]].map(([x, y]) => new THREE.Vector2(x, y)));
  const s = new THREE.Shape(); s.moveTo(-0.34, 0); s.lineTo(0.34, 0); s.lineTo(0.34, 0.56); s.quadraticCurveTo(0.34, 0.66, 0.22, 0.68); s.quadraticCurveTo(0.14, 0.78, 0, 0.8); s.quadraticCurveTo(-0.14, 0.78, -0.22, 0.68); s.quadraticCurveTo(-0.34, 0.66, -0.34, 0.56); s.lineTo(-0.34, 0);
  TOMB_GEOS = [merge([plinth(0.98, 0.38), ex(a, 0.14).translate(0, 0.14, 0)]),
    merge([plinth(0.6, 0.4), ex(c, 0.12, 0.022).translate(0, 0.14, 0), new THREE.TorusGeometry(0.2, 0.026, 8, 28).translate(0, 1.12, 0)]),
    merge([plinth(0.86, 0.42), ex(s, 0.2).translate(0, 0.14, 0)])];
  return TOMB_GEOS;
}
// Slatted park bench with cast-iron frame
let BENCH;
function addBench(x, z, ry) {
  if (!BENCH) { const w = [], f = [];
    for (let i = 0; i < 3; i++) w.push(roundBox(1.9, 0.045, 0.12, 0.018, 1).translate(0, 0.46, -0.16 + i * 0.15));
    for (let i = 0; i < 3; i++) w.push(roundBox(1.9, 0.11, 0.035, 0.015, 1).rotateX(-0.22).translate(0, 0.62 + i * 0.14, -0.31 - i * 0.03));
    for (const sx of [-0.82, 0.82]) { const P = (y, zz) => new V3(sx, y, zz);
      f.push(taper(P(0, 0.2), P(0.45, 0.18), 0.03, 0.025, 6), taper(P(0, -0.26), P(0.45, -0.27), 0.03, 0.025, 6), taper(P(0.45, -0.27), P(1.0, -0.38), 0.025, 0.02, 6),
        taper(P(0.43, -0.3), P(0.43, 0.24), 0.022, 0.022, 6), taper(P(0.45, 0.18), P(0.66, 0.22), 0.02, 0.02, 6), taper(P(0.68, -0.33), P(0.66, 0.26), 0.022, 0.022, 6));
      f.push(new THREE.SphereGeometry(0.036, 8, 6).translate(sx, 0.665, 0.27), new THREE.CylinderGeometry(0.05, 0.06, 0.03, 8).translate(sx, 0.015, 0.2), new THREE.CylinderGeometry(0.05, 0.06, 0.03, 8).translate(sx, 0.015, -0.26)); }
    BENCH = [merge(w), merge(f)]; }
  SB.add(BENCH[0], M.wood, x, 0, z, ry); SB.add(BENCH[1], M.iron, x, 0, z, ry); addCircle(x, z, 0.75);
}
// Coopered barrel with iron hoops
let BARREL;
function addBarrel(x, z, s = 1, ry = 0) {
  if (!BARREL) { const prof = [[0.001, 0], [0.27, 0], [0.3, 0.12], [0.33, 0.42], [0.3, 0.72], [0.27, 0.84], [0.25, 0.84], [0.25, 0.8], [0.001, 0.8]];
    BARREL = [scaleUV(lathe(prof, 20), 3, 1), merge([0.1, 0.3, 0.54, 0.74].map(y => new THREE.TorusGeometry(y < 0.2 || y > 0.7 ? 0.295 : 0.33, 0.014, 5, 24).rotateX(PI / 2).translate(0, y, 0)))]; }
  SB.add(BARREL[0], M.wood, x, 0, z, ry, { s }); SB.add(BARREL[1], M.iron, x, 0, z, ry, { s }); addCircle(x, z, 0.36 * s);
}
function addCrate(x, y, z, s = 0.6, ry = 0) { SB.add(roundBox(s, s, s, 0.025, 0.6, 1), M.wood, x, y + s / 2, z, ry); for (const k of [-1, 1]) SB.add(roundBox(s + 0.02, 0.07, 0.04, 0.012, 1), M.woodDark, x, y + s / 2 + k * s * 0.3, z, ry, { shadow: false }); if (y < 0.1) addCircle(x, z, s * 0.6); }
// Carousel horse: sculpted from smooth primitives — barrel, chest, rump, arched neck, tapered head, galloping legs; tack is gilded
function horseGeometries() {
  const B = [], T = [], M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
  const sph = (r, m, list = B, ws = 22, hs = 16) => list.push(new THREE.SphereGeometry(r, ws, hs).applyMatrix4(m));
  sph(0.5, M4(0, 0, 0, 0, 0, 0, 1.2, 0.6, 0.52)); sph(0.34, M4(0.44, 0.07, 0, 0, 0, 0, 1.05, 1.08, 0.95)); sph(0.35, M4(-0.47, 0.04, 0, 0, 0, 0, 1.08, 1.0, 1.0));
  B.push(taper(new V3(0.5, 0.18, 0), new V3(0.86, 0.78, 0), 0.24, 0.13, 18)); sph(0.15, M4(0.9, 0.82, 0, 0, 0, 0, 1.1, 1, 0.82));
  B.push(taper(new V3(0.92, 0.8, 0), new V3(1.26, 0.56, 0), 0.12, 0.085, 16)); sph(0.1, M4(1.27, 0.55, 0, 0, 0, 0, 1.15, 0.9, 0.9));
  for (const s of [-1, 1]) B.push(new THREE.ConeGeometry(0.035, 0.15, 8).applyMatrix4(M4(0.86, 0.99, s * 0.06, s * 0.25, 0, 0.35)));
  const leg = (hx, hz, a1, a2) => { const hip = new V3(hx, -0.08, hz), knee = hip.clone().add(new V3(Math.sin(a1) * 0.42, -Math.cos(a1) * 0.42, 0)), hoof = knee.clone().add(new V3(Math.sin(a2) * 0.4, -Math.cos(a2) * 0.4, 0));
    B.push(taper(hip, knee, 0.1, 0.06, 12), taper(knee, hoof, 0.045, 0.04, 10)); sph(0.055, M4(knee.x, knee.y, knee.z), B, 12, 8);
    T.push(new THREE.CylinderGeometry(0.05, 0.065, 0.08, 12).applyMatrix4(M4(hoof.x, hoof.y - 0.02, hoof.z, 0, 0, a2))); };
  leg(0.45, 0.13, 0.95, -0.55); leg(0.45, -0.13, 0.35, -0.1); leg(-0.47, 0.13, -0.55, -0.15); leg(-0.47, -0.13, -0.15, 0.35);
  for (let i = 0; i < 9; i++) { const t = i / 8; T.push(new THREE.SphereGeometry(0.075, 10, 8).applyMatrix4(M4(lerp(0.52, 0.9, t), lerp(0.42, 0.98, t), 0, 0, 0, -0.9, 1.4, 0.75, 0.42))); }
  T.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-0.78, 0.12, 0), new V3(-0.98, 0.05, 0), new V3(-1.08, -0.25, 0), new V3(-1.02, -0.55, 0)]), 16, 0.055, 8));
  T.push(roundBox(0.5, 0.07, 0.62, 0.03, 1).translate(0, 0.3, 0), roundBox(0.18, 0.12, 0.42, 0.04, 1).translate(-0.22, 0.38, 0), roundBox(0.12, 0.1, 0.3, 0.04, 1).translate(0.2, 0.36, 0));
  T.push(new THREE.TorusGeometry(0.11, 0.015, 6, 16).applyMatrix4(M4(1.12, 0.66, 0, 0, PI / 2, -0.6)));
    return { body: merge(B), tack: merge(T) };
}
// Coaster car body: bevelled extruded side profile with a nose cowl and seat well
function coasterCarGeo() {
  const s = new THREE.Shape([[-1.05, 0], [1.0, 0], [1.18, 0.22], [1.08, 0.62], [0.72, 0.66], [0.55, 0.42], [-0.15, 0.42], [-0.3, 0.7], [-0.98, 0.74], [-1.08, 0.45]].map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 8 });
  g.rotateY(-PI / 2); g.translate(0.65, 0.1, 0); return g;
}
// Turned baluster for porch railings
let BALUSTER;
const balusterGeo = () => BALUSTER || (BALUSTER = lathe([[0.001, 0], [0.045, 0], [0.045, 0.06], [0.03, 0.1], [0.05, 0.25], [0.025, 0.42], [0.04, 0.5], [0.025, 0.6], [0.045, 0.66], [0.045, 0.72], [0.001, 0.72]], 10));
// Spatially chunked instancing: one InstancedMesh per 40 m cell so frustum + shadow culling skip what's off-view
function chunkedInstances(geo, mat, items, setMatrix, { shadow = false, cell = 40 } = {}) {
  const cells = new Map(); for (const it of items) { const k = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
  const o = new THREE.Object3D(), out = [];
  for (const list of cells.values()) { const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.setScalar(1); setMatrix(o, it); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); out.push(im); }
  return out;
}

export { roundBox, lathe, taper, nonIdx, merge, COL_PROFILE, POST_PROFILE, lampPostGeo, TOMB_GEOS, tombGeos, BENCH, addBench, BARREL, addBarrel, addCrate, horseGeometries, coasterCarGeo, BALUSTER, balusterGeo, chunkedInstances };
