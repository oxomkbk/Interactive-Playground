/* =========================================================================
   DREAMLAND EXPRESS — a miniature steam train circling the whole park on its own railway: a rose
   locomotive with a gold dome, flared stack (puffing real smoke), cab, cowcatcher and a heart headlamp,
   pulling three canopy carriages. Two little stations; the train eases in, waits, and pulls away.
   Draws: rails & ties · stations (merged) · four vehicles (merged each).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R } from '../core/geo.js';
import { paint, gold, stone, fabric, wood, silver, glass, lampGlass, shingle, plaster, glow } from '../core/materials.js';
import { attraction, hitBox } from './base.js';
import { damp } from '../core/mood.js';
import { CONFIG } from '../config.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;

export function create({ radius: TR = CONFIG.layout.trainRadius, lights } = {}) {
  const root = new THREE.Group(); root.name = 'train';
  const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, r = TR + Math.sin(a * 3) * 1.2; pts.push(V(Math.sin(a) * r, 0.18, Math.cos(a) * r)); }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'), L = curve.getLength();
  const gd = gold(), c = { cast: true };
  // track: two steel rails on a gravel bed, ties instanced
  const B = createBatch('railway'), rail = silver();
  for (const off of [-0.55, 0.55]) { const rp = []; for (let i = 0; i < 400; i++) { const u = i / 400, p = curve.getPointAt(u), t = curve.getTangentAt(u), s = V(t.z, 0, -t.x).normalize(); rp.push(p.clone().addScaledVector(s, off).setY(0.2)); }
    B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp, true), 800, 0.05, 5, true), rail); }
  const bed = []; for (let i = 0; i <= 400; i++) { const u = i / 400, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1), s = V(t.z, 0, -t.x).normalize(); bed.push(p.clone().addScaledVector(s, -1.1).setY(0.05), p.clone().addScaledVector(s, 1.1).setY(0.05)); }
  const bedG = new THREE.BufferGeometry().setFromPoints(bed), idx = []; for (let i = 0; i < 400; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } bedG.setIndex(idx); bedG.computeVertexNormals();
  { const uv = []; for (let i = 0; i <= 400; i++) uv.push(0, i * 1.0, 1, i * 1.0); bedG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); }
  B.add(bedG, stone(1, '#CDBFB4', 'cobble'));
  const tieN = Math.floor(L / 0.75), ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.1, 0.22), wood('#8A5A44', 1), tieN), m = new THREE.Matrix4();
  for (let i = 0; i < tieN; i++) { const u = i / tieN, p = curve.getPointAt(u), t = curve.getTangentAt(u); ties.setMatrixAt(i, m.compose(V(p.x, 0.12, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(t.x, t.z), 0)), V(1, 1, 1))); }
  ties.receiveShadow = true; root.add(ties);
  // stations: platform, ivory walls, shingle roof, clock & lamp
  const stations = [0.5, 0.72];
  for (const u of stations) { const p = curve.getPointAt(u), t = curve.getTangentAt(u), s = V(t.z, 0, -t.x).normalize(), out = p.clone().setY(0).normalize().dot(s) > 0 ? 1 : -1;
    const g = new THREE.Group(); g.position.copy(p.clone().addScaledVector(s, out * 3.6).setY(0)); g.rotation.y = Math.atan2(t.x, t.z) + (out > 0 ? -PI / 2 : PI / 2); root.add(g);
    const S = createBatch('station');
    S.add(rbox(10, 0.7, 3.4, 0.1), stone(2, '#E3D6C8'), [0, 0.35, -0.4], c);
    S.add(new THREE.BoxGeometry(5, 3.2, 3), plaster('#FFF5E1', 1), [0, 2.3, -2.6], c);
    S.add(new THREE.ConeGeometry(4.2, 2.2, 4).rotateY(PI / 4).scale(1.3, 1, 0.8), shingle('#A8E6CF', 4, 2), [0, 4.9, -2.2], c);
    for (const x of [-4, 4]) S.add(rodGeo(V(x, 0.7, 1), V(x, 3.6, 1), 0.08, 8), gd, null, c);
    S.add(new THREE.BoxGeometry(10, 0.15, 3.2), fabric('#F28FAF', '#FFF5E1', 14, 2, 1), [0, 3.7, -0.3], c);
    S.add(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24).rotateX(PI / 2), paint('#FFFFFF', 0.3), [0, 3.3, -1.05]); S.add(new THREE.TorusGeometry(0.5, 0.06, 6, 24), gd, [0, 3.3, -1.0]);
    S.add(new THREE.PlaneGeometry(1.4, 1.6), glass('#FFE7C4', 0.5), [-1.6, 2.2, -1.08]); S.add(new THREE.PlaneGeometry(1.4, 1.6), glass('#FFE7C4', 0.5), [1.6, 2.2, -1.08]);
    S.build(g); }
  B.build(root);

  // vehicles (local +z forward)
  const veh = [];
  const loco = new THREE.Group(), LB = createBatch('loco'), rose = paint('#F28FAF', 0.32), cream = paint('#FFF5E1', 0.4), lav = paint('#C8A2E8', 0.4), dark = paint('#3E2E52', 0.5);
  LB.add(rbox(1.7, 0.4, 4.2, 0.1), dark, [0, 0.75, 0], c);
  LB.add(new THREE.CylinderGeometry(0.68, 0.68, 2.6, 24).rotateX(PI / 2), rose, [0, 1.6, 0.55], c);
  for (const zz of [-0.4, 0.55, 1.5]) LB.add(new THREE.TorusGeometry(0.7, 0.05, 6, 24), gd, [0, 1.6, zz]);
  LB.add(new THREE.CylinderGeometry(0.36, 0.2, 0.95, 16), dark, [0, 2.55, 1.4], c); LB.add(new THREE.TorusGeometry(0.36, 0.06, 6, 16).rotateX(PI / 2), gd, [0, 3.02, 1.4]);
  LB.add(new THREE.SphereGeometry(0.32, 16, 10, 0, TAU, 0, PI / 2), gd, [0, 2.25, 0.4]);
  LB.add(rbox(1.7, 1.7, 1.4, 0.12), cream, [0, 1.95, -1.25], c); LB.add(rbox(1.95, 0.18, 1.8, 0.06), lav, [0, 2.9, -1.25], c);
  for (const s of [-1, 1]) LB.add(new THREE.PlaneGeometry(0.9, 0.7), glass('#FFE7C4', 0.6), [s * 0.86, 2.1, -1.25], { rotY: s * PI / 2 });
  LB.add(new THREE.ConeGeometry(0.85, 0.7, 4, 1).rotateX(PI / 2).rotateZ(PI / 4).scale(1, 0.6, 1), gd, [0, 0.75, 2.4], c);
  for (const s of [-1, 1]) for (const zz of [-1.2, 0.1, 1.2]) LB.add(new THREE.TorusGeometry(zz === 0.1 ? 0.42 : 0.3, 0.07, 8, 20).rotateY(PI / 2), gd, [s * 0.9, zz === 0.1 ? 0.6 : 0.48, zz]);
  LB.add(heartGeo(0.25, 0.1), glow('#FFE2B8', 3, 0.5), [0, 1.65, 1.95]);
  LB.build(loco); root.add(loco); veh.push({ g: loco, off: 0, loco: true });
  const cols = [['#A0D8F1', '#FFF5E1'], ['#FFD68A', '#FFF5E1'], ['#A8E6CF', '#FFF5E1']];
  cols.forEach(([c1, c2], i) => { const g = new THREE.Group(), CB = createBatch('car');
    CB.add(rbox(1.6, 0.7, 3.0, 0.15), paint(c1, 0.35), [0, 0.95, 0], c); CB.add(rbox(1.7, 0.12, 3.1, 0.05), gd, [0, 1.32, 0]);
    for (const zz of [-0.8, 0.6]) CB.add(rbox(1.3, 0.5, 0.3, 0.1), cream, [0, 1.45, zz]);
    for (const sx of [-0.72, 0.72]) for (const zz of [-1.35, 1.35]) CB.add(rodGeo(V(sx, 1.3, zz), V(sx, 2.7, zz), 0.04, 6), gd);
    CB.add(rbox(1.9, 0.14, 3.3, 0.06), fabric(c1, c2, 10, 1, 1), [0, 2.75, 0], c);
    for (const s of [-1, 1]) for (const zz of [-1, 1]) CB.add(new THREE.TorusGeometry(0.3, 0.06, 8, 18).rotateY(PI / 2), gd, [s * 0.85, 0.48, zz]);
    CB.build(g); root.add(g); veh.push({ g, off: 4.2 + i * 3.6 }); });
  const lampLight = lights && lights.addLocal(V(0, 2, 0), '#FFE2B8', 18, 12);
  const hit = hitBox(loco, 2.4, 3.6, 5.4, 0);

  const st = { s: stations[0] * L, v: 0, dwell: 3, smokeT: 0, leaving: false };
  const a = attraction({ id: 'train', name: 'Dreamland Express', icon: '🚂', zone: 'All around the park',
    desc: 'A little steam train puffing its way around the whole park, stopping at two storybook stations.',
    object3D: root, focus: { target: [0, 2, 0], dist: 16, height: 6 }, rate: 0.8 });
  a.hits = [hit];
  const next = () => { const u = ((st.s / L) % 1 + 1) % 1; let best = null; for (const su of stations) { let d = su - u; if (d < 0) d += 1; if (best === null || d < best) best = d; } return best * L; };
  a.update = (dt) => {
    a.ease(dt); const toStop = next();
    if (st.dwell > 0) { st.v = damp(st.v, 0, 3, dt); if (a.running) { st.dwell -= dt; if (st.dwell <= 0) st.leaving = true; } }
    else { // pull away, cruise, then brake smoothly into the next station (v² = 2·a·d)
      if (st.leaving && toStop > 3) st.leaving = false;
      const want = (st.leaving ? 5.2 : Math.min(5.2, Math.sqrt(Math.max(0, toStop) * 2 * 0.9) + 0.3)) * a.drive; st.v = damp(st.v, want, 0.8, dt);
      if (!st.leaving && toStop < 0.25) st.dwell = R(4, 6); }
    st.s += st.v * dt;
    for (const vv of veh) { const u = (((st.s - vv.off) / L) % 1 + 1) % 1, p = curve.getPointAt(u), t = curve.getTangentAt(u); vv.g.position.set(p.x, 0.2, p.z); vv.g.rotation.y = Math.atan2(t.x, t.z); }
    // the focus follows the locomotive
    a.focus.target = [loco.position.x, 2, loco.position.z];
    if (lampLight) lampLight.position.copy(loco.position).add(V(0, 2.2, 0));
    st.smokeT -= dt; if (st.v > 0.2 && st.smokeT <= 0 && a.fx) { st.smokeT = 0.18 / Math.max(0.4, st.v / 3); a.fx.smoke(V(0, 3.1, 1.4).applyMatrix4(loco.matrixWorld)); }
  };
  a.focusTarget = () => loco.position;
  // ride view: from the locomotive's cab
  a.rideCam = (pos, look) => { loco.localToWorld(pos.set(0, 2.85, -0.7)); loco.localToWorld(look.set(0, 2.2, 14)); };
  a.rig = { loco }; // the night-lighting rig (world/illumination.js)
  return a;
}
