/* =========================================================================
   STARLIGHT WHEEL — a 13 m pastel Ferris wheel facing the plaza: lavender A-frame legs with gold collars, a
   rose hub with a gold heart, twin rims, a lattice of spokes and cross-braces, 144 warm bulbs that turn with
   it, and sixteen gondolas in four designs (dome, heart finial, scalloped canopy, lantern top) that stay
   level and sway gently. A boarding deck with stairs and a ticket kiosk sits at its foot.
   Draws: frame & deck (merged) · wheel (merged) · bulbs · gondola bodies · gondola tops (instanced).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox } from '../core/geo.js';
import { paint, gold, stone, bulb, fabric, glass } from '../core/materials.js';
import { nightness } from '../core/mood.js';
import { attraction, hitBox } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();

export function create({ x, z, radius: Rw = 13, hub: H = 16, gondolas: N = 16, spin = 0.11, lights } = {}) {
  const root = new THREE.Group(); root.name = 'ferris'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z); // faces the plaza
  const leg = paint('#B9A2E0', 0.45), gd = gold(), rose = paint('#F28FAF', 0.4), cream = paint('#FFF5E1', 0.5), c = { cast: true };
  const F = createBatch('ferris-frame');
  for (const sz of [-1, 1]) { for (const sx of [-1, 1]) F.add(rodGeo(V(sx * 5.5, 0, sz * 2.6), V(0, H, sz * 1.25), 0.24, 12), leg, null, c);
    for (const y of [4, 8.5]) { const k = y / H, w = 5.5 * (1 - k); F.add(rodGeo(V(-w, y, sz * (2.6 - 1.35 * k)), V(w, y, sz * (2.6 - 1.35 * k)), 0.09, 8), leg, null, c); F.add(new THREE.TorusGeometry(0.3, 0.06, 6, 16).rotateY(PI / 2).translate(0, y, sz * (2.6 - 1.35 * k)), gd); }
    F.add(new THREE.CylinderGeometry(0.75, 0.75, 0.4, 20).rotateX(PI / 2).translate(0, H, sz * 1.35), gd); }
  F.add(rodGeo(V(0, H, -1.6), V(0, H, 1.6), 0.32, 16), cream, null, c);
  F.add(rbox(10, 0.6, 7, 0.15).translate(0, 0.3, 3.0), stone(2, '#E3D6C8'), null, c);
  for (let i = 0; i < 4; i++) F.add(rbox(3, 0.15, 0.8, 0.05).translate(0, 0.08 + i * 0.15, 6.9 - i * 0.6 + 0.2), stone(1, '#D9CBB9'));
  for (const sx of [-1, 1]) for (const zz of [0.2, 5.8]) { F.add(rodGeo(V(sx * 4.6, 0.6, zz), V(sx * 4.6, 1.6, zz), 0.05, 6), gd); }
  for (const sx of [-1, 1]) F.add(rodGeo(V(sx * 4.6, 1.6, 0.2), V(sx * 4.6, 1.6, 5.8), 0.05, 6), gd);
  // ticket kiosk
  F.add(rbox(2.2, 2.4, 2.2, 0.2).translate(-6.8, 1.2, 4.2), paint('#FFD6E2', 0.5), null, c);
  F.add(new THREE.ConeGeometry(1.9, 1.2, 4).rotateY(PI / 4).translate(-6.8, 3.0, 4.2), fabric('#C8A2E8', '#FFF5E1', 8), null, c);
  F.add(new THREE.PlaneGeometry(1.4, 0.9).translate(-6.8, 1.5, 5.32), glass('#FFE9C8', 0.5));
  F.build(root);

  // the wheel
  const wheel = new THREE.Group(); wheel.position.y = H; root.add(wheel);
  const W = createBatch('ferris-wheel');
  for (const sz of [-1.25, 1.25]) { W.add(new THREE.TorusGeometry(Rw, 0.17, 10, 160), rose, [0, 0, sz], c); W.add(new THREE.TorusGeometry(Rw * 0.62, 0.09, 8, 120), cream, [0, 0, sz]);
    W.add(new THREE.TorusGeometry(Rw * 0.25, 0.14, 8, 60), gd, [0, 0, sz]);
    for (let k = 0; k < N; k++) { const a = k / N * TAU, b = (k + 0.5) / N * TAU;
      W.add(rodGeo(V(0, 0, sz * 0.6), V(Math.sin(a) * Rw, -Math.cos(a) * Rw, sz), 0.06, 6), cream, null, c);
      W.add(rodGeo(V(Math.sin(a) * Rw * 0.62, -Math.cos(a) * Rw * 0.62, sz), V(Math.sin(b) * Rw, -Math.cos(b) * Rw, sz), 0.04, 5), cream); } }
  for (let k = 0; k < N; k++) { const a = k / N * TAU; W.add(rodGeo(V(Math.sin(a) * Rw, -Math.cos(a) * Rw, -1.35), V(Math.sin(a) * Rw, -Math.cos(a) * Rw, 1.35), 0.07, 6), gd); }
  W.add(new THREE.CylinderGeometry(1.3, 1.3, 2.8, 32).rotateX(PI / 2), rose, null, c);
  for (const sz of [-1, 1]) W.add(heartGeo(1.1, 0.4).translate(0, 0, sz * 1.6), gd);
  W.build(wheel);
  const NB = 72, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), bulb('#FFE2B8', 3.2), NB * 2 + N * 2);
  let bi = 0; for (const sz of [-1.25, 1.25]) for (let i = 0; i < NB; i++) { const a = i / NB * TAU; bulbs.setMatrixAt(bi++, _m.makeTranslation(Math.sin(a) * (Rw + 0.24), -Math.cos(a) * (Rw + 0.24), sz)); }
  for (const sz of [-1.25, 1.25]) for (let k = 0; k < N; k++) { const a = (k + 0.5) / N * TAU; bulbs.setMatrixAt(bi++, _m.makeTranslation(Math.sin(a) * Rw * 0.62, -Math.cos(a) * Rw * 0.62, sz)); }
  wheel.add(bulbs);

  // gondolas: a rounded cabin body (tinted per car) + one of four tops, merged into one "top" geometry per style
  const body = mergeGeometries([new THREE.CylinderGeometry(0.95, 0.8, 1.15, 24, 1, true).translate(0, -1.95, 0).toNonIndexed(), new THREE.CircleGeometry(0.8, 24).rotateX(PI / 2).translate(0, -2.52, 0).toNonIndexed(),
    new THREE.TorusGeometry(0.95, 0.06, 6, 24).rotateX(PI / 2).translate(0, -1.38, 0).toNonIndexed()]);
  const hanger = (g) => mergeGeometries([g.index ? g.toNonIndexed() : g, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6).translate(0, -0.45, 0).toNonIndexed()]);
  const tops = [
    hanger(new THREE.SphereGeometry(1.05, 24, 10, 0, TAU, 0, PI / 2).scale(1, 0.6, 1).translate(0, -1.15, 0)),
    hanger(mergeGeometries([new THREE.SphereGeometry(1.05, 24, 10, 0, TAU, 0, PI / 2).scale(1, 0.45, 1).translate(0, -1.15, 0).toNonIndexed(), heartGeo(0.3, 0.12).translate(0, -0.55, 0)])),
    hanger(new THREE.ConeGeometry(1.2, 0.8, 12, 1).translate(0, -0.95, 0)),
    hanger(mergeGeometries([new THREE.CylinderGeometry(0.4, 1.05, 0.6, 16).translate(0, -1.05, 0).toNonIndexed(), new THREE.SphereGeometry(0.22, 12, 8).translate(0, -0.6, 0).toNonIndexed()])),
  ];
  const cols = ['#FFB3C6', '#C8A2E8', '#A8E6CF', '#A0D8F1', '#FFD68A', '#FFAD91', '#F7D3DC', '#B9A2E0'];
  const bodies = new THREE.InstancedMesh(body, paint('#ffffff', 0.35), N); bodies.material.side = THREE.DoubleSide;
  const topMeshes = tops.map((g, i) => new THREE.InstancedMesh(g, i % 2 ? gold() : paint('#FFF5E1', 0.4), Math.ceil(N / 4)));
  for (let k = 0; k < N; k++) bodies.setColorAt(k, new THREE.Color(cols[k % cols.length]));
  for (const im of [bodies, ...topMeshes]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; wheel.add(im); }
  lights && lights.addLocal(V(x, H, z), '#FFC2D8', 60, 30);

  const st = { theta: 0 };
  const a = attraction({ id: 'ferris', name: 'Starlight Wheel', icon: '🎡', zone: 'Romantic Rides',
    desc: 'Sixteen pastel gondolas and 160 warm bulbs, turning slowly over the whole park. From the top you can see the castle and the sea of blossoms.',
    object3D: root, focus: { target: [x, H, z], dist: 46, height: 6 } });
  a.hits = [hitBox(root, Rw * 2 + 2, H + Rw + 2, 4, 0)];
  // after dark the rim bulbs chase in rose, gold and lavender; the spokes breathe
  const CH = [new THREE.Color('#FFB3C6'), new THREE.Color('#FFD68A'), new THREE.Color('#C8A2E8'), new THREE.Color('#FFF1D6')], _bc = new THREE.Color();
  const chase = (t) => { const n = nightness(); if (n < 0.25) return; for (let i = 0; i < NB * 2 + N * 2; i++) { const k = i % NB, w = (Math.sin(k / NB * TAU * 4 - t * 3) + 1) / 2;
      _bc.copy(CH[Math.floor((k / NB * 8 + t * 0.5) % 4)]).lerp(CH[3], i >= NB * 2 ? 0.5 + 0.5 * Math.sin(t * 2) : 1 - w); bulbs.setColorAt(i, _bc.multiplyScalar(0.5 + w * 0.8)); }
    bulbs.instanceColor.needsUpdate = true; };
  for (let i = 0; i < NB * 2 + N * 2; i++) bulbs.setColorAt(i, CH[3]);
  a.update = (dt, t) => { chase(t);
    const d = a.ease(dt); st.theta += spin * d * dt; wheel.rotation.z = st.theta;
    for (let k = 0; k < N; k++) { const ang = k / N * TAU, sway = Math.sin(t * 1.1 + k) * 0.05 * (0.3 + d) + Math.sin(st.theta * 3 + k) * 0.02;
      _p.set(Math.sin(ang) * Rw, -Math.cos(ang) * Rw, 0); _q.setFromEuler(_e.set(sway * 0.4, 0, -st.theta + sway));
      _m.compose(_p, _q, _s); bodies.setMatrixAt(k, _m); topMeshes[k % 4].setMatrixAt(Math.floor(k / 4), _m); }
    bodies.instanceMatrix.needsUpdate = true; for (const tm of topMeshes) tm.instanceMatrix.needsUpdate = true;
  };
  // ride view: sit in any gondola (cycle with Next seat), looking out over the park
  a.seat = 0; a.seatName = 'Gondola'; a.cycleSeat = () => { a.seat = (a.seat + 1) % N; return a.seat + 1; };
  const ZA = new THREE.Vector3(0, 0, 1);
  a.rideCam = (pos, look) => { const ang = a.seat / N * TAU; _p.set(Math.sin(ang) * Rw, -Math.cos(ang) * Rw, 0).applyAxisAngle(ZA, st.theta);
    root.localToWorld(pos.set(_p.x, H + _p.y - 0.9, 0.55)); root.localToWorld(look.set(_p.x * 0.7, H + _p.y - 2.6, 18)); };
  a.rig = { wheel, Rw, N, H }; // the night-lighting rig (world/illumination.js)
  return a;
}
