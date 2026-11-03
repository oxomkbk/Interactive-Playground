import * as THREE from 'three';
import { bev } from '../core/surface.js';
import { PI, R, TAU } from '../core/utils.js';
import { FX_OBJECTS, scene } from '../core/renderer.js';
import { M, TX } from '../core/materials.js';
import { coneMat } from '../core/shaders.js';
import { LAMPS, POOLS, PUMPKINS, ROCKS, TOMBS, WIRE_PTS, addCircle, addPool, onUpdate } from '../core/registry.js';
import { PUMPKIN_GEO, groundAt } from './landscape.js';
import { chunkedInstances, lampPostGeo, tombGeos } from './props.js';
import { t } from '../core/i18n.js';
import { FL } from '../game/flight.js';

/* ---------- Decorative instanced collections (lamps, pumpkins, tombs, light pools, rocks) ---------- */
function buildInstanced() {
  // Victorian lamp posts, lanterns and their light cones — chunked so culling & shadows only touch what's near
  if (LAMPS.length) {
    const coneM = coneMat(0xffb060, 0.065);
    chunkedInstances(lampPostGeo(), M.iron, LAMPS, (o, l) => o.position.set(l.x, 0, l.z), { shadow: true });
    chunkedInstances(bev(0.24, 0.5, 0.24), M.glass, LAMPS, (o, l) => o.position.set(l.x, 4.08, l.z));
    chunkedInstances(new THREE.ConeGeometry(1.7, 4.0, 20, 1, true).translate(0, -2.0, 0), coneM, LAMPS, (o, l) => o.position.set(l.x, 3.84, l.z)).forEach(m => FX_OBJECTS.push(m));
    LAMPS.forEach(l => { addPool(l.x, l.z, 4.2, 0xffa860, 0.65); addCircle(l.x, l.z, 0.3); });
  }
  for (const lit of [true, false]) { const list = PUMPKINS.filter(p => p.lit === lit); if (list.length)
    chunkedInstances(PUMPKIN_GEO, lit ? M.pumpkinLit : M.pumpkin, list, (o, p) => { o.position.set(p.x, p.y + p.s * 0.78, p.z); o.rotation.y = p.ry; o.scale.setScalar(p.s); }, { shadow: true }); }
  const tv = tombGeos();
  for (let v = 0; v < 3; v++) { const list = TOMBS.filter(t => t.v === v); if (list.length)
    chunkedInstances(tv[v], M.stone, list, (o, t) => { o.position.set(t.x, -0.04, t.z); o.rotation.set(t.tilt, t.ry, t.tilt * 0.5); o.scale.setScalar(t.s); }, { shadow: true }); }
  if (ROCKS.length) chunkedInstances(new THREE.DodecahedronGeometry(1, 1), M.stone, ROCKS, (o, r) => { o.position.set(r.x, r.s * 0.35, r.z); o.rotation.set(r.x * 3.1, r.z * 1.7, 0); o.scale.set(r.s * 1.2, r.s * 0.8, r.s); }, { shadow: true });
  // fake light pools: additive radial decals = cheap "bounce light" on the ground
  const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: TX.pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }), POOLS.length);
  const o = new THREE.Object3D();
  POOLS.forEach((p, i) => { o.position.set(p.x, 0.06 + groundAt(p.x, p.z), p.z); o.scale.set(p.r, 1, p.r); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); pm.setColorAt(i, p.c.clone().multiplyScalar(0.3)); });
  pm.renderOrder = 1; scene.add(pm); FX_OBJECTS.push(pm);
  // wires for all string lights
  const wg = new THREE.BufferGeometry().setFromPoints(WIRE_PTS);
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0a0806 })));
  // Halloween pennant bunting hanging from every string of lights (gently waving)
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.42, 0], 3)); tri.computeVertexNormals();
  const nF = Math.floor(WIRE_PTS.length / 2), fm = new THREE.InstancedMesh(tri, M.flag, nF), fo = new THREE.Object3D(), FL = [];
  for (let i = 0; i < nF; i++) { const a = WIRE_PTS[i * 2], b = WIRE_PTS[i * 2 + 1]; fo.position.lerpVectors(a, b, 0.5); fo.rotation.set(0, Math.atan2(-(b.z - a.z), b.x - a.x), 0, 'YXZ'); fo.updateMatrix(); fm.setMatrixAt(i, fo.matrix);
    fm.setColorAt(i, new THREE.Color([0xd8560c, 0x16101a, 0x5a1a8a][i % 3])); FL.push({ p: fo.position.clone(), ry: fo.rotation.y, ph: R(0, TAU) }); }
  scene.add(fm);
  onUpdate((dt, t) => { for (let i = 0; i < nF; i++) { const f = FL[i]; fo.position.copy(f.p); fo.rotation.set(Math.sin(t * 2.2 + f.ph) * 0.25, f.ry, 0, 'YXZ'); fo.updateMatrix(); fm.setMatrixAt(i, fo.matrix); } fm.instanceMatrix.needsUpdate = true; });
}

export { buildInstanced };
