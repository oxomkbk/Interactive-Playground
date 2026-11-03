import * as THREE from 'three';
import { bev } from './surface.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, V3, hdr, rand } from './utils.js';
import { collide } from '../game/play.js';
import { t } from './i18n.js';

/* =========================================================================
   5. WORLD REGISTRIES — static batching, colliders, interactables, updaters
   ========================================================================= */
// Static batcher: merges every static mesh per material into one draw call.
class Batcher {
  constructor(chunk = 0) { this.groups = new Map(); this._o = new THREE.Object3D(); this.chunk = chunk; }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, o = {}) {
    const d = this._o; d.position.set(x, y, z); d.rotation.set(o.rx || 0, ry, o.rz || 0, o.order || 'XYZ');
    const s = o.s || 1; d.scale.set(o.sx || s, o.sy || s, o.sz || s); d.updateMatrix();
    this.addMatrix(geo, mat, d.matrix, o.shadow !== false);
  }
  addMatrix(geo, mat, matrix, shadow = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(matrix);
    let cell = ''; // world batches are split into spatial chunks so frustum & shadow culling can skip them
    if (this.chunk) { g.computeBoundingBox(); const bb = g.boundingBox; cell = Math.floor((bb.min.x + bb.max.x) / 2 / this.chunk) + ',' + Math.floor((bb.min.z + bb.max.z) / 2 / this.chunk); }
    const key = mat.uuid + (shadow ? 's' : 'n') + cell;
    if (!this.groups.has(key)) this.groups.set(key, { mat, shadow, geos: [] });
    this.groups.get(key).geos.push(g);
  }
  build(parent) {
    for (const { mat, shadow, geos } of this.groups.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = shadow && !mat.isMeshBasicMaterial; m.receiveShadow = !mat.isMeshBasicMaterial;
      parent.add(m); geos.forEach(g => g.dispose());
    }
    this.groups.clear();
  }
}
const SB = new Batcher(36);
const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _up = new V3(0, 1, 0);
// every built box is bevelled (no mathematically sharp edges to catch light wrongly) with world-scaled UVs
const boxGeo = (w, h, d, tile = 2) => bev(w, h, d, undefined, tile);
function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
function cylBetween(a, b, r, mat, target = SB, seg = 8) {
  const dir = new V3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1); g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(_up, dir.normalize()); _m4.compose(a, _q, new V3(1, 1, 1)); target.addMatrix(g, mat, _m4);
}

const COLLIDERS = [];
const addBox = (x0, x1, z0, z1) => { const c = { t: 1, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }; COLLIDERS.push(c); return c; };
const addCircle = (x, z, r) => { const c = { t: 0, x, z, r }; COLLIDERS.push(c); return c; };
// Uniform-grid spatial hash so collision / focus queries only test nearby colliders (instead of all ~1000)
let CGRID = null; const CG = 8, _near = new Set();
function buildColliderGrid() { CGRID = new Map(); for (const c of COLLIDERS) { const x0 = c.t ? c.x0 : c.x - c.r, x1 = c.t ? c.x1 : c.x + c.r, z0 = c.t ? c.z0 : c.z - c.r, z1 = c.t ? c.z1 : c.z + c.r;
  for (let i = Math.floor(x0 / CG); i <= Math.floor(x1 / CG); i++) for (let j = Math.floor(z0 / CG); j <= Math.floor(z1 / CG); j++) { const k = i * 1000 + j; if (!CGRID.has(k)) CGRID.set(k, []); CGRID.get(k).push(c); } } }
function nearColliders(x, z, r) { if (!CGRID) return COLLIDERS; _near.clear();
  for (let i = Math.floor((x - r) / CG); i <= Math.floor((x + r) / CG); i++) for (let j = Math.floor((z - r) / CG); j <= Math.floor((z + r) / CG); j++) { const a = CGRID.get(i * 1000 + j); if (a) for (const c of a) _near.add(c); }
  return _near; }
const PLATFORMS = []; // walkable raised floors {x0,x1,z0,z1,h}
function wallBox(x0, x1, y0, y1, z0, z1, mat, { tile = 2.5, collide = true, shadow = true } = {}) {
  SB.add(boxGeo(x1 - x0, y1 - y0, z1 - z0, tile), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, { shadow });
  if (collide && y0 < 1.8) addBox(x0, x1, z0, z1);
}

const INTERACTS = [];
function addInteract(o) { INTERACTS.push(Object.assign({ r: 2.6, y: 1 }, o)); return o; }
const UPDATERS = [];
const onUpdate = fn => UPDATERS.push(fn);

// Deferred instanced collections (built in one go at the end)
const POOLS = [], LAMPS = [], PUMPKINS = [], TOMBS = [], TREES = [], ROCKS = [];
const addPool = (x, z, r, color, k = 1) => POOLS.push({ x, z, r, c: new THREE.Color(color).multiplyScalar(k) });
const addLamp = (x, z, h = 4) => LAMPS.push({ x, z, h });
const addPumpkin = (x, y, z, s = 0.45, lit = true, ry = R(-0.6, 0.6)) => PUMPKINS.push({ x, y, z, s, lit, ry });
const addTomb = (x, z, ry = 0, s = 1) => { TOMBS.push({ x, z, ry, s, v: Math.floor(rand() * 3), tilt: R(-0.12, 0.12) }); addCircle(x, z, 0.45 * s); };

// Bulb strings: instanced emissive spheres with animated light-show colours
const BULBS = [];
const BULB_GEO = new THREE.SphereGeometry(1, 8, 6);
const BULB_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const PAL_WARM = [hdr(0xffb050, 3.2), hdr(0xff7a20, 3.2), hdr(0xffd890, 2.6)];
const PAL_SPOOK = [hdr(0xff7a20, 3.2), hdr(0x9a50ff, 3.2), hdr(0x50ff90, 2.6)];
function makeBulbs(parent, pts, palette = PAL_WARM, r = 0.07) {
  const mesh = new THREE.InstancedMesh(BULB_GEO, BULB_MAT, pts.length); const base = [];
  const m = new THREE.Matrix4();
  pts.forEach((p, i) => { m.makeScale(r, r, r).setPosition(p); mesh.setMatrixAt(i, m); const c = palette[i % palette.length]; base.push(c); mesh.setColorAt(i, c); });
  mesh.userData.base = base; parent.add(mesh); BULBS.push(mesh); return mesh;
}
function catenary(a, b, sag, step = 0.7) {
  const n = Math.max(2, Math.round(a.distanceTo(b) / step)), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const p = new V3().lerpVectors(a, b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  return pts;
}
const WIRE_PTS = [];
function stringLights(a, b, sag, palette, step = 0.7) {
  const pts = catenary(a, b, sag, step);
  for (let i = 0; i < pts.length - 1; i++) WIRE_PTS.push(pts[i], pts[i + 1]);
  return pts;
}

export { Batcher, SB, _q, _m4, _up, boxGeo, scaleUV, cylBetween, COLLIDERS, addBox, addCircle, CGRID, buildColliderGrid, nearColliders, PLATFORMS, wallBox, INTERACTS, addInteract, UPDATERS, onUpdate, POOLS, LAMPS, PUMPKINS, TOMBS, TREES, ROCKS, addPool, addLamp, addPumpkin, addTomb, BULBS, BULB_GEO, BULB_MAT, PAL_WARM, PAL_SPOOK, makeBulbs, catenary, WIRE_PTS, stringLights };
