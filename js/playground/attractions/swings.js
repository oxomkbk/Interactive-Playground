/* =========================================================================
   STARLIT SWINGS — a flying swing ride: a fluted lavender tower, a rotating crown with a striped canopy,
   scalloped valance and bulbs, and twenty chair swings on long chains. The chains fly outward at the angle a
   real swing ride settles at (tan θ = ω²r / g); the crown leans and sways at speed. It runs in cycles:
   spin up, fly, slow down, rest — every change eased.
   Draws: tower (merged) · crown (merged) · bulbs · chains · seats (instanced).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rbox } from '../core/geo.js';
import { paint, gold, stone, fabric, bulb, silver } from '../core/materials.js';
import { attraction, hitCylinder } from './base.js';
import { damp } from '../core/mood.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export function create({ x, z, seats: N = 20, arm: RA = 4.6, chain: LC = 7, top: H = 9.2, lights } = {}) {
  const root = new THREE.Group(); root.name = 'swings'; root.position.set(x, 0, z);
  const tower = paint('#C8A2E8', 0.4), gd = gold(), cream = paint('#FFF5E1', 0.45), c = { cast: true };
  const B = createBatch('swing-tower');
  B.add(new THREE.CylinderGeometry(3.4, 3.8, 0.5, 48), stone(2, '#E3D6C8'), [0, 0.25, 0], c);
  B.add(new THREE.CylinderGeometry(0.9, 1.25, H, 24), tower, [0, H / 2, 0], c);
  for (const y of [1.0, 3.6, 6.2, 8.4]) B.add(new THREE.TorusGeometry(1.2 - y * 0.03, 0.09, 8, 32).rotateX(PI / 2), gd, [0, y, 0]);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; B.add(heartGeo(0.25, 0.08).rotateY(a), gd, [Math.sin(a) * 1.2, 2.2, Math.cos(a) * 1.2]); }
  B.build(root);
  const crown = new THREE.Group(); crown.position.y = H; root.add(crown);
  const C = createBatch('swing-crown');
  C.add(new THREE.ConeGeometry(RA + 1.0, 2.4, 48, 1, true), fabric('#FFB3C6', '#FFF5E1', 20, 4, 1), [0, 1.6, 0], c);
  C.add(new THREE.CylinderGeometry(RA + 1.0, RA + 1.0, 0.5, 48, 1, true), fabric('#C8A2E8', '#FFF5E1', 24, 3, 1), [0, 0.2, 0], c);
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; C.add(new THREE.CircleGeometry(0.4, 12, PI, PI).rotateY(a).translate(Math.sin(a) * (RA + 1.0), -0.05, Math.cos(a) * (RA + 1.0)), fabric('#F28FAF', '#F28FAF', 2), null, c); }
  C.add(new THREE.CylinderGeometry(RA, RA, 0.25, 48), cream, [0, 0.35, 0], c);
  C.add(new THREE.SphereGeometry(0.5, 16, 12), gd, [0, 3.0, 0]); C.add(heartGeo(0.55, 0.22), gd, [0, 3.8, 0]);
  C.build(crown);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), bulb('#FFE2B8', 3.2), 60);
  for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; bl.setMatrixAt(i, _m.makeTranslation(Math.sin(a) * (RA + 1.05), 0.45, Math.cos(a) * (RA + 1.05))); } crown.add(bl);
  // chains (one thin cylinder per swing, scaled to length) and seats, instanced and posed every frame
  const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).translate(0, -0.5, 0), silver(), N * 2);
  const seatG = rbox(0.62, 0.12, 0.55, 0.05); const seats = new THREE.InstancedMesh(seatG, paint('#ffffff', 0.35), N), backs = new THREE.InstancedMesh(rbox(0.62, 0.55, 0.08, 0.04).translate(0, 0.3, -0.24), paint('#ffffff', 0.35), N);
  const cols = ['#FFB3C6', '#A0D8F1', '#FFD68A', '#A8E6CF', '#C8A2E8'];
  for (let i = 0; i < N; i++) { const col = new THREE.Color(cols[i % cols.length]); seats.setColorAt(i, col); backs.setColorAt(i, col); }
  for (const im of [chains, seats, backs]) { im.castShadow = true; im.frustumCulled = false; crown.add(im); }
  lights && lights.addLocal(V(x, H - 1, z), '#FFC8DC', 30, 18);

  const st = { w: 0, phase: 'spin', t: 0, tilt: 0 };
  const a = attraction({ id: 'swings', name: 'Starlit Swings', icon: '🪁', zone: 'Thrill Corner',
    desc: 'Twenty chair swings fly out over the gardens as the crown spins faster and leans into the wind.',
    object3D: root, focus: { target: [x, 7, z], dist: 26, height: 4 } });
  a.hits = [hitCylinder(root, RA + 2.5, H + 4, 0)];
  a.update = (dt, t) => {
    const d = a.ease(dt); st.t += dt;
    // ride cycle: 4 s rest → 18 s flying → back to rest (the eased spin rate does the acceleration)
    if (st.phase === 'rest' && st.t > 4) { st.phase = 'spin'; st.t = 0; } else if (st.phase === 'spin' && st.t > 18) { st.phase = 'rest'; st.t = 0; }
    const target = st.phase === 'spin' ? 1.25 * d : 0; st.w = damp(st.w, target, 0.45, dt);
    crown.rotation.y += st.w * dt;
    st.tilt = damp(st.tilt, st.w > 0.6 ? 0.09 : 0, 0.6, dt); crown.rotation.x = Math.sin(t * 0.5) * st.tilt; crown.rotation.z = Math.cos(t * 0.5) * st.tilt;
    for (let i = 0; i < N; i++) {
      const ang = i / N * TAU, r0 = RA - 0.2, ax = Math.sin(ang) * r0, az = Math.cos(ang) * r0;
      // settle angle: tan θ = ω² r / g  (r grows as it swings out; one fixed-point step is plenty)
      let th = Math.atan(st.w * st.w * r0 / 9.81); th = Math.atan(st.w * st.w * (r0 + Math.sin(th) * LC) / 9.81) + Math.sin(t * 2 + i) * 0.02 * st.w;
      _q.setFromEuler(_e.set(0, ang, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -th)); // tilt outward (local +z of the arm points out)
      for (const sx of [-0.25, 0.25]) { const off = V(Math.cos(ang) * sx, 0, -Math.sin(ang) * sx); _m.compose(_p.set(ax + off.x, 0.3, az + off.z), _q, _s.set(1, LC, 1)); chains.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), _m); }
      const end = V(0, -LC, 0).applyQuaternion(_q); if (i === 0) a._seat0 = V(ax + end.x, 0.3 + end.y, az + end.z); _m.compose(_p.set(ax + end.x, 0.3 + end.y, az + end.z), _q, _s.set(1, 1, 1)); seats.setMatrixAt(i, _m); backs.setMatrixAt(i, _m);
    }
    chains.instanceMatrix.needsUpdate = seats.instanceMatrix.needsUpdate = backs.instanceMatrix.needsUpdate = true;
  };
  // ride view: from the first chair, flying outward
  a.rideCam = (pos, look) => { const s = a._seat0 || V(0, -LC, RA); crown.localToWorld(pos.copy(s).add(V(0, 1.1, 0))); crown.localToWorld(look.copy(s).add(V(9, -1.5, 3))); };
  a.rig = { crown, RA, H }; // the night-lighting rig (world/illumination.js)
  return a;
}
