/* =========================================================================
   SUGARPLUM COASTER — a family coaster on a closed CatmullRomCurve3: a station with a striped roof, a chain
   lift, a curving first drop through a flowered tunnel, a camel hill and a banked turn home. Twin rails, a
   spine, ties and lattice supports; a train of four pastel cars oriented along the track (tangent, side, up),
   with a heart on the lead car. Real-ish physics: gravity along the slope, drag, a 2.6 m/s lift, station dwell.
   Draws: track & supports (merged + 2 instanced) · cars (instanced) · tunnel (merged).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R } from '../core/geo.js';
import { paint, gold, stone, fabric, wood, bulb } from '../core/materials.js';
import { attraction, hitBox } from './base.js';
import { damp } from '../core/mood.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, UP = V(0, 1, 0);

export function create({ x, z, lights } = {}) {
  const root = new THREE.Group(); root.name = 'coaster'; root.position.set(x, 0, z);
  const pts = [[5, 1.3, 16], [5, 1.3, 8], [5, 3.5, 2], [5, 9.8, -8], [3.5, 10.4, -13], [0, 9.4, -17.5], [-4.5, 6.6, -16], [-6, 2.0, -10], [-6.5, 1.4, -4], [-6, 5.2, 2.2], [-5, 2.6, 8], [-6.5, 3.6, 13], [-4, 5.4, 18], [0, 4.6, 20.5], [3.5, 2.4, 19]].map(p => V(...p));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5), L = curve.getLength();
  // sampled frames along the track
  const M = 1400, S = [];
  for (let i = 0; i < M; i++) { const u = i / M, p = curve.getPointAt(u), t = curve.getTangentAt(u), side = new THREE.Vector3().crossVectors(t, UP).normalize(), up = new THREE.Vector3().crossVectors(side, t).normalize(); S.push({ p, t, side, up }); }
  const near = (q) => { let b = 0, bd = 1e9; S.forEach((s, i) => { const d = s.p.distanceToSquared(q); if (d < bd) { bd = d; b = i; } }); return b; };
  const iStation0 = near(pts[0]), iStation1 = near(pts[1]), iLift0 = near(pts[2]), iLift1 = near(pts[3]);
  const inRange = (i, a, b) => (a <= b ? i >= a && i <= b : i >= a || i <= b);

  const rail = paint('#F28FAF', 0.35), spine = paint('#C8A2E8', 0.4), sup = paint('#FFF5E1', 0.45), gd = gold(), c = { cast: true };
  const B = createBatch('coaster');
  for (const off of [-0.48, 0.48]) B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(S.filter((_, i) => i % 4 === 0).map(s => s.p.clone().addScaledVector(s.side, off).addScaledVector(s.up, 0.05)), true), 700, 0.07, 6, true), rail, null, c);
  B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(S.filter((_, i) => i % 4 === 0).map(s => s.p.clone().addScaledVector(s.up, -0.35)), true), 700, 0.16, 8, true), spine, null, c);
  // ties and lattice supports, instanced
  const tieN = Math.floor(L / 0.7), ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.08, 0.16), wood('#B48A64', 1), tieN), m = new THREE.Matrix4(), mb = new THREE.Matrix4();
  for (let i = 0; i < tieN; i++) { const s = S[Math.floor(i / tieN * M)], side2 = new THREE.Vector3().crossVectors(s.up, s.t); mb.makeBasis(side2, s.up, s.t); m.copy(mb).setPosition(s.p.clone().addScaledVector(s.up, -0.06)); ties.setMatrixAt(i, m); }
  const supN = Math.floor(L / 2.6), cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.14, 1, 8).translate(0, 0.5, 0), sup, supN);
  for (let i = 0; i < supN; i++) { const s = S[Math.floor(i / supN * M)], h = s.p.y - 0.45; cols.setMatrixAt(i, m.compose(V(s.p.x, 0, s.p.z), new THREE.Quaternion(), V(1, Math.max(0.1, h), 1))); }
  for (const im of [ties, cols]) { im.castShadow = im.receiveShadow = true; root.add(im); }
  for (let i = 0; i < supN; i += 2) { const s = S[Math.floor(i / supN * M)]; if (s.p.y > 3) { const h = s.p.y - 0.5; B.add(rodGeo(V(s.p.x - 0.6, 0, s.p.z), V(s.p.x, h * 0.6, s.p.z), 0.05, 5), sup); B.add(rodGeo(V(s.p.x + 0.6, 0, s.p.z), V(s.p.x, h * 0.6, s.p.z), 0.05, 5), sup); } }
  // station: platform, striped roof on gold posts, bulbs along the eave
  const sp = S[Math.floor((iStation0 + iStation1) / 2)].p;
  B.add(rbox(3.2, 1.0, 10, 0.1), stone(2, '#E3D6C8'), [sp.x + 2.0, 0.5, sp.z], c);
  for (const dz of [-4.5, 0, 4.5]) for (const dx of [-0.6, 3.4]) B.add(rodGeo(V(sp.x + dx, 1.0, sp.z + dz), V(sp.x + dx, 4.2, sp.z + dz), 0.08, 8), gd, null, c);
  B.add(new THREE.CylinderGeometry(3.2, 3.2, 10.6, 3, 1, true, -PI / 2, PI).rotateX(PI / 2).rotateY(0).scale(0.8, 0.45, 1), fabric('#A0D8F1', '#FFF5E1', 14, 1, 3), [sp.x + 1.4, 4.2, sp.z], c);
  // tunnel over the low section: a run of flowered arches
  const iT = near(pts[8]);
  for (let k = -6; k <= 6; k++) { const s = S[(iT + k * 9 + M) % M], ang = Math.atan2(s.t.x, s.t.z);
    B.add(new THREE.TorusGeometry(1.6, 0.18, 8, 20, PI).rotateY(ang + PI / 2), paint(k % 2 ? '#C8A2E8' : '#FFB3C6', 0.5), [s.p.x, s.p.y - 0.5, s.p.z], c); }
  B.build(root);

  // the train
  const NC = 4, GAP = 2.05, bodies = new THREE.InstancedMesh(rbox(1.3, 0.62, 1.8, 0.24), paint('#ffffff', 0.32), NC), seats = new THREE.InstancedMesh(rbox(1.0, 0.5, 0.5, 0.15).translate(0, 0.35, -0.3), paint('#FFF5E1', 0.6), NC);
  ['#FFB3C6', '#C8A2E8', '#A0D8F1', '#A8E6CF'].forEach((col, i) => bodies.setColorAt(i, new THREE.Color(col)));
  for (const im of [bodies, seats]) { im.castShadow = true; im.frustumCulled = false; root.add(im); }
  const heart = new THREE.Mesh(heartGeo(0.32, 0.12), gold()); heart.castShadow = true; root.add(heart);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulb('#FFE2B8', 3), NC * 2); lamps.frustumCulled = false; root.add(lamps);
  lights && lights.addLocal(V(x + sp.x + 1, 4, z + sp.z), '#FFD2B0', 24, 14);

  const st = { s: iStation0 / M * L, v: 0, dwell: 2 };
  const sampleAt = (s) => S[Math.floor((((s % L) + L) % L) / L * M) % M];
  const a = attraction({ id: 'coaster', name: 'Sugarplum Coaster', icon: '🎢', zone: 'Thrill Corner',
    desc: 'A sweet little roller coaster: chain lift, a swooping drop through the flower tunnel and a camel hill. Hands up!',
    object3D: root, focus: { target: [x, 5, z], dist: 34, height: 12 } });
  a.hits = [hitBox(root, 16, 13, 44, 0)];
  a.update = (dt) => {
    a.ease(dt); const i = Math.floor((((st.s % L) + L) % L) / L * M) % M, s = S[i];
    if (inRange(i, iStation0, iStation1)) { // station: brake, dwell, then roll out (or stay parked when stopped)
      if (st.dwell > 0) { st.v = damp(st.v, 0, 3, dt); if (st.v < 0.15) { st.v = 0; if (a.running) st.dwell -= dt; } } else st.v = damp(st.v, 2.2, 1.5, dt);
    } else { st.dwell = R(2.5, 4);
      if (inRange(i, iLift0, iLift1)) st.v = damp(st.v, 2.6, 2, dt);
      else st.v = Math.max(1.6, st.v + (-9.81 * s.t.y - 0.025 * st.v * st.v) * dt); }
    st.s += st.v * dt;
    for (let k = 0; k < NC; k++) { const q = sampleAt(st.s - k * GAP), side2 = new THREE.Vector3().crossVectors(q.up, q.t); mb.makeBasis(side2, q.up, q.t);
      m.copy(mb).setPosition(q.p.clone().addScaledVector(q.up, 0.42)); bodies.setMatrixAt(k, m); seats.setMatrixAt(k, m);
      for (const sx of [-0.5, 0.5]) lamps.setMatrixAt(k * 2 + (sx > 0 ? 1 : 0), new THREE.Matrix4().makeTranslation(sx, 0.33, 0.9).premultiply(m));
      if (k === 0) { heart.position.copy(q.p).addScaledVector(q.up, 0.55).addScaledVector(q.t, 0.95); heart.quaternion.setFromRotationMatrix(mb); } }
    bodies.instanceMatrix.needsUpdate = seats.instanceMatrix.needsUpdate = lamps.instanceMatrix.needsUpdate = true;
  };
  // ride view: front row of the lead car
  a.rideCam = (pos, look) => { const q = sampleAt(st.s); root.localToWorld(pos.copy(q.p).addScaledVector(q.up, 1.45).addScaledVector(q.t, 0.5)); root.localToWorld(look.copy(q.p).addScaledVector(q.t, 12).addScaledVector(q.up, 0.4)); };
  a.rig = { samples: S, root }; // the night-lighting rig (world/illumination.js)
  return a;
}
