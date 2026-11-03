/* =========================================================================
   MOONDROP TOWER — a 38 m fantasy drop tower: a lavender column ringed with gold, four vertical light strips
   that chase upward on the lift and flash on the drop, a crescent-moon crown, and a ring of twelve seats.
   The cycle: rest → slow eased lift → a breath at the top (with a tiny wobble) → free fall (y = h − ½gt²) →
   magnetic brakes ease it to a stop → rest.
   Draws: tower (merged) · light strips (instanced, recoloured each frame) · gondola (merged).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox } from '../core/geo.js';
import { paint, gold, stone, bulb } from '../core/materials.js';
import { attraction, hitCylinder } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const smoother = t => t * t * (3 - 2 * t);

export function create({ x, z, height: H = 38, top: TOPY = 32, low: LOWY = 1.4, lights } = {}) {
  const root = new THREE.Group(); root.name = 'drop'; root.position.set(x, 0, z);
  const gd = gold(), c = { cast: true };
  const T = createBatch('drop-tower');
  T.add(new THREE.CylinderGeometry(4.2, 4.5, 0.5, 48), stone(2, '#E3D6C8'), [0, 0.25, 0], c);
  T.add(new THREE.CylinderGeometry(1.3, 1.6, H, 24), paint('#C8A2E8', 0.4), [0, H / 2, 0], c);
  for (let y = 4; y < H; y += 5) T.add(new THREE.TorusGeometry(1.42 - y * 0.004, 0.08, 6, 32).rotateX(PI / 2), gd, [0, y, 0]);
  // crown: a gold collar, a cone, a crescent moon and a heart
  T.add(new THREE.CylinderGeometry(2.1, 1.5, 1.2, 24), paint('#FFF5E1', 0.4), [0, H + 0.6, 0], c);
  T.add(new THREE.ConeGeometry(2.0, 3.6, 24), paint('#F28FAF', 0.35), [0, H + 3.0, 0], c);
  const moon = new THREE.Shape(); moon.absarc(0, 0, 1.3, 0, TAU, false); const hole = new THREE.Path(); hole.absarc(0.55, 0.25, 1.1, 0, TAU, true); moon.holes.push(hole);
  T.add(new THREE.ExtrudeGeometry(moon, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }).translate(0, 0, -0.15), gd, [0, H + 6.2, 0], c);
  T.add(heartGeo(0.45, 0.2), gd, [0, H + 4.9, 0]);
  // fence around the base
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; T.add(rodGeo(V(Math.sin(a) * 4, 0.5, Math.cos(a) * 4), V(Math.sin(a) * 4, 1.5, Math.cos(a) * 4), 0.04, 6), gd); }
  T.add(new THREE.TorusGeometry(4, 0.05, 6, 64).rotateX(PI / 2), gd, [0, 1.5, 0]);
  T.build(root);
  // light strips: 4 columns × 34 bulbs, colours rewritten each frame for the chase
  const per = 34, strips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), bulb('#FFFFFF', 3.4), per * 4), m = new THREE.Matrix4(), col = new THREE.Color();
  for (let s = 0; s < 4; s++) for (let i = 0; i < per; i++) { const a = s / 4 * TAU + PI / 4, y = 2 + i / per * (H - 3), r = 1.62 - y * 0.008; strips.setMatrixAt(s * per + i, m.makeTranslation(Math.sin(a) * r, y, Math.cos(a) * r)); }
  for (let i = 0; i < per * 4; i++) strips.setColorAt(i, col.set('#FFD6E6'));
  root.add(strips);
  // gondola ring with twelve seats facing out
  const gond = new THREE.Group(); root.add(gond);
  const G = createBatch('drop-gondola');
  G.add(new THREE.TorusGeometry(2.3, 0.35, 10, 48).rotateX(PI / 2), paint('#FFF5E1', 0.4), null, c);
  G.add(new THREE.TorusGeometry(2.3, 0.08, 6, 48).rotateX(PI / 2), gd, [0, 0.35, 0]);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, sx = Math.sin(a), sz = Math.cos(a), col2 = ['#FFB3C6', '#A0D8F1', '#FFD68A', '#A8E6CF'][k % 4];
    G.add(rbox(0.7, 1.2, 0.25, 0.1).translate(0, 0.3, 0).rotateY(a), paint(col2, 0.35), [sx * 2.55, 0, sz * 2.55], c);
    G.add(rbox(0.7, 0.15, 0.6, 0.06).rotateY(a), paint(col2, 0.35), [sx * 2.85, -0.25, sz * 2.85], c);
    G.add(new THREE.TorusGeometry(0.28, 0.05, 6, 14, PI).rotateY(a + PI / 2).rotateX(0), gd, [sx * 2.9, 0.55, sz * 2.9]); }
  G.build(gond);
  lights && lights.addLocal(V(x, 6, z), '#C8B8FF', 30, 18);

  const st = { phase: 'rest', t: 0, y: LOWY, v: 0 };
  const a = attraction({ id: 'drop', name: 'Moondrop Tower', icon: '🌙', zone: 'Thrill Corner',
    desc: 'Rise slowly to the moon, hold your breath at the top… and drop! The lights chase you all the way up and down.',
    object3D: root, focus: { target: [x, 18, z], dist: 44, height: -6 } });
  a.hits = [hitCylinder(root, 3.5, H + 7, 0)];
  a.update = (dt, time) => {
    a.ease(dt); st.t += dt; let mode = 0; // 0 idle glow, 1 chase up, 2 flash
    if (st.phase === 'rest') { st.y = LOWY; if (st.t > 4 && a.running) { st.phase = 'lift'; st.t = 0; } }
    else if (st.phase === 'lift') { const k = Math.min(1, st.t / 9); st.y = LOWY + (TOPY - LOWY) * smoother(k); mode = 1; if (k >= 1) { st.phase = 'hold'; st.t = 0; } }
    else if (st.phase === 'hold') { st.y = TOPY + Math.sin(st.t * 18) * 0.04 * Math.max(0, 1 - st.t / 2.6); mode = 1; if (st.t > 2.6) { st.phase = 'drop'; st.t = 0; st.v = 0; } }
    else if (st.phase === 'drop') { st.v += 9.81 * dt; st.y -= st.v * dt; mode = 2; if (st.y <= 11) { st.phase = 'brake'; st.t = 0; } }
    else if (st.phase === 'brake') { const decel = st.v * st.v / (2 * Math.max(0.5, st.y - LOWY)); st.v = Math.max(0, st.v - decel * dt); st.y = Math.max(LOWY, st.y - st.v * dt); mode = 2; if (st.v < 0.05 || st.y <= LOWY + 0.01) { st.phase = 'rest'; st.t = 0; st.y = LOWY; } }
    gond.position.y = st.y; gond.rotation.y += dt * 0.15;
    for (let s = 0; s < 4; s++) for (let i = 0; i < per; i++) { const u = i / per; let k;
      if (mode === 1) k = 0.25 + 0.75 * Math.max(0, Math.sin((u * 10 - time * 6) )) ** 4; else if (mode === 2) k = (Math.sin(time * 30) > 0 ? 1 : 0.35); else k = 0.35 + 0.25 * Math.sin(time * 1.2 + u * 6);
      col.setHSL((0.88 + u * 0.25 + s * 0.05) % 1, 0.7, 0.72).multiplyScalar(k); strips.setColorAt(s * per + i, col); }
    strips.instanceColor.needsUpdate = true;
  };
  // ride view: strapped into a seat, facing out over the park
  a.rideCam = (pos, look) => { gond.localToWorld(pos.set(0, 1.0, 3.0)); gond.localToWorld(look.set(0, -2.5, 16)); };
  a.rig = { H, gond }; // the night-lighting rig (world/illumination.js)
  return a;
}
