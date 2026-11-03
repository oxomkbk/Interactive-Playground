import * as THREE from 'three';
import { bev } from '../core/surface.js';
import { PI, R, TAU, V3, clamp, damp, hdr } from '../core/utils.js';
import { FX_OBJECTS, camera, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { coneMat, makePoints } from '../core/shaders.js';
import { Batcher, onUpdate } from '../core/registry.js';
import { hullGeo, LANTERN_PROFILE } from './lake.js';
import { lathe } from './props.js';
import { AU } from '../core/audio.js';
import { S } from '../game/play.js';
import { t } from '../core/i18n.js';

/* =========================================================================
   THE WANDERING GALLEON — a 30-metre spectral ship that sails the sky above Hollowmoor on a slow loop:
   lofted hull with keel, stern castle and gallery windows, three masts with yards and billowing glowing sails
   (vertex-animated), rigging, a lantern at every rail, a searching beam from the bow and a trail of ghost-fire.
   ========================================================================= */
const SHIP = { a: 0, g: null, sails: [], trail: null, td: [] };
function sailGeo(w, h, segW = 12, segH = 8) { const g = new THREE.PlaneGeometry(w, h, segW, segH); g.userData.base = g.attributes.position.array.slice(); return g; }
function buildSkyShip() {
  const g = new THREE.Group(); scene.add(g); SHIP.g = g; const b = new Batcher();
  const wood = M.woodDark;
  // hull: lofted shell + deck + keel + stern castle + bow rise
  const hull = new THREE.Mesh(hullGeo(28, 7.2, 4.2, 2.6, 40, 18), new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap, color: 0x4a3c3a, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x0a2a1a, emissiveIntensity: 0.6 }));
  hull.castShadow = false; g.add(hull);
  b.add(bev(6.6, 0.25, 25), wood, 0, -0.2, 0);
  b.add(bev(0.4, 1.2, 27), wood, 0, -4.6, 0);
  b.add(bev(6.4, 3.2, 6.5), wood, 0, 1.3, 10.4); b.add(bev(6.8, 0.3, 7), wood, 0, 3.0, 10.4);
  b.add(bev(5.4, 1.6, 4), wood, 0, 0.6, -11);
  for (const s of [-1, 1]) for (let z = -10; z <= 13; z += 1.4) b.add(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 5), wood, s * 3.25, 0.8 + (z > 7 ? 2.6 : 0) * 0, z);
  for (const s of [-1, 1]) b.add(bev(0.16, 0.14, 24), wood, s * 3.25, 1.35, 0);
  // masts, yards, crow's nest
  const MASTS = [[-7, 22], [1.5, 26], [9, 18]];
  for (const [z, h] of MASTS) { b.add(new THREE.CylinderGeometry(0.22, 0.34, h, 10), wood, 0, h / 2, z);
    for (const y of [h * 0.45, h * 0.72, h * 0.94]) b.add(new THREE.CylinderGeometry(0.12, 0.12, h * 0.42 * (1.15 - y / h * 0.6), 6), wood, 0, y, z, 0, { rz: PI / 2 });
    b.add(new THREE.CylinderGeometry(0.9, 0.7, 0.6, 12, 1, true), wood, 0, h * 0.8, z); }
  b.add(new THREE.CylinderGeometry(0.12, 0.2, 12, 8), wood, 0, 1.8, -18, 0, { rx: -1.2 }); // bowsprit
  b.build(g);
  // stern gallery windows + lanterns
  const win = new THREE.MeshBasicMaterial({ color: hdr(0x6dffb0, 2.6) });
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), win); w.position.set(-2.2 + i * 1.1, 1.4, 13.66); g.add(w); }
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(lathe(LANTERN_PROFILE, 10), win); l.scale.setScalar(2.2); l.position.set(s * 3.4, 1.5, -9 + i * 3.6); g.add(l); }
  // sails: glowing, tattered, double-sided, vertex-animated
  const sailMat = new THREE.MeshBasicMaterial({ color: hdr(0x9affd0, 0.9), transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [z, h] of MASTS) for (const [y0, y1] of [[0.47, 0.7], [0.74, 0.92]]) {
    const w = h * 0.4 * (1.15 - (y0 + y1) / 2 * 0.6), sh = (y1 - y0) * h, geo = sailGeo(w, sh), m = new THREE.Mesh(geo, sailMat);
    m.position.set(0, h * (y0 + y1) / 2, z - 0.3); g.add(m); FX_OBJECTS.push(m); SHIP.sails.push({ m, geo, ph: R(0, TAU) }); }
  // rigging
  const rig = []; for (const [z, h] of MASTS) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) rig.push(new V3(s * 3.3, 1.4, z - 1.5 + k), new V3(0, h * 0.94, z));
  rig.push(new V3(0, 26, 1.5), new V3(0, 6, -23), new V3(0, 22, -7), new V3(0, 18, 9));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rig), new THREE.LineBasicMaterial({ color: 0x2a5a48, transparent: true, opacity: 0.7 })));
  // bow searchlight
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 70, 24, 1, true).translate(0, -35, 0), coneMat(0x9affd0, 0.07, 6)); beam.position.set(0, 2, -16); g.add(beam); FX_OBJECTS.push(beam); SHIP.beam = beam;
  g.scale.setScalar(0.9);
  SHIP.trail = makePoints(260); for (let i = 0; i < 260; i++) SHIP.td.push({ t: 0 }); SHIP.ti = 0;
  const p = new V3(), q = new V3(), back = new V3();
  onUpdate((dt, t) => {
    SHIP.a += dt * 0.022 * (S.shipBoost ? 2.4 : 1);
    const a = SHIP.a, RX = 130, RZ = 105, CZ = -45, Y = 58 + Math.sin(a * 3) * 6;
    p.set(Math.cos(a) * RX, Y, CZ + Math.sin(a) * RZ); q.set(Math.cos(a + 0.01) * RX, Y, CZ + Math.sin(a + 0.01) * RZ);
    g.position.copy(p); g.lookAt(q); g.rotateY(PI); // hull is built bow toward −z
    g.rotateZ(Math.sin(t * 0.5) * 0.04 + 0.08); g.rotateX(Math.sin(t * 0.37) * 0.03);
    for (const s of SHIP.sails) { const pa = s.geo.attributes.position, base = s.geo.userData.base, w = s.geo.parameters.width, h = s.geo.parameters.height;
      for (let i = 0; i < pa.count; i++) { const x = base[i * 3], y = base[i * 3 + 1], u = x / w + 0.5, v = y / h + 0.5;
        pa.setZ(i, -Math.sin(u * PI) * (1.6 + 0.3 * Math.sin(t * 2 + s.ph + v * 3)) * (0.6 + 0.4 * v) + Math.sin(t * 3 + u * 9 + s.ph) * 0.12); }
      pa.needsUpdate = true; }
    SHIP.beam.rotation.x = -0.5 + Math.sin(t * 0.4) * 0.35; SHIP.beam.rotation.z = Math.sin(t * 0.27) * 0.5;
    // ghost-fire wake
    const tr = SHIP.trail; SHIP.ti = (SHIP.ti + 1) % 260; back.set(R(-2, 2), R(-3, 1), 14).applyMatrix4(g.matrixWorld); SHIP.td[SHIP.ti].t = 3;
    tr.pos.set([back.x, back.y, back.z], SHIP.ti * 3);
    for (let i = 0; i < 260; i++) { const d = SHIP.td[i]; if (d.t <= 0) { tr.size[i] = 0; continue; } d.t -= dt; const k = d.t / 3; tr.pos[i * 3 + 1] -= dt * 0.6;
      tr.col.set([0.4 * k, 2.6 * k, 1.5 * k], i * 3); tr.size[i] = 0.6 + (1 - k) * 2.4; }
    tr.flag();
    if (Math.random() < dt * 0.05 && camera.position.distanceTo(p) < 120) AU.creak(p);
  });
}

export { SHIP, buildSkyShip };
