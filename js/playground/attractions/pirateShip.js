/* =========================================================================
   THE SWEET SEAHORSE — a swinging pirate ship in sugared pastels: a planked hull with a lavender band and
   gold portholes, a heart figurehead, rails, a mast with billowing cream sails and pink pennants, hung from
   a striped A-frame on a gold axle. It swings like a real pendulum (ω = √(g/L)); the amplitude builds over a
   few passes, holds at full swing, then eases back down to rest before the next ride.
   Draws: frame (merged) · ship (merged, swinging).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox } from '../core/geo.js';
import { paint, gold, stone, fabric, wood, bulb } from '../core/materials.js';
import { attraction, hitBox } from './base.js';
import { damp } from '../core/mood.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;

export function create({ x, z, axle: H = 12.5, arm: LA = 9, maxSwing = 1.15 } = {}) {
  const root = new THREE.Group(); root.name = 'pirate'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z); // broadside to the plaza (the hull runs along local x)
  const gd = gold(), c = { cast: true };
  const F = createBatch('ship-frame'), leg = fabric('#C8A2E8', '#FFF5E1', 6, 1, 6);
  F.add(rbox(16, 0.5, 9, 0.2), stone(3, '#E3D6C8'), [0, 0.25, 0], c);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) F.add(rodGeo(V(sx * 5.5, 0.5, sz * 3.6), V(0, H, sz * 2.3), 0.28, 12), leg, null, c);
  for (const sz of [-1, 1]) F.add(rodGeo(V(-3, 5, sz * 3.15), V(3, 5, sz * 3.15), 0.12, 8), paint('#FFF5E1', 0.4), null, c);
  F.add(rodGeo(V(0, H, -2.6), V(0, H, 2.6), 0.32, 16), gd, null, c);
  for (const sz of [-1, 1]) F.add(heartGeo(0.8, 0.3), gd, [0, H, sz * 2.75], c);
  F.build(root);

  const swing = new THREE.Group(); swing.position.y = H; root.add(swing);
  const S = createBatch('ship'), hullY = -LA;
  // hull: a side profile extruded across, with bevels for a rounded, toy-like shape
  const prof = new THREE.Shape(); prof.moveTo(-6.4, 1.6); prof.quadraticCurveTo(-6.2, -0.2, -4, -1.0); prof.quadraticCurveTo(0, -1.9, 4, -1.0); prof.quadraticCurveTo(6.2, -0.2, 6.6, 1.9); prof.lineTo(5.6, 1.2); prof.lineTo(-5.4, 1.0); prof.lineTo(-6.4, 1.6);
  const hull = new THREE.ExtrudeGeometry(prof, { depth: 3.0, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.35, bevelSegments: 4, curveSegments: 16 }); hull.translate(0, 0, -1.5);
  S.add(hull, wood('#C79A73', 1), [0, hullY, 0], c);
  S.add(new THREE.BoxGeometry(12.6, 0.35, 3.9), paint('#C8A2E8', 0.4), [0, hullY + 0.55, 0], c);
  for (let i = -4; i <= 4; i += 2) for (const s of [-1, 1]) S.add(new THREE.TorusGeometry(0.22, 0.06, 6, 16), gd, [i * 1.15, hullY + 0.0, s * 1.98]);
  S.add(rbox(11.4, 0.18, 3.2, 0.05), wood('#E2C3A0', 2), [0, hullY + 1.0, 0], c);
  for (let i = -5; i <= 5; i++) for (const s of [-1, 1]) S.add(rodGeo(V(i * 1.05, hullY + 1.05, s * 1.6), V(i * 1.05, hullY + 1.75, s * 1.6), 0.04, 6), gd);
  for (const s of [-1, 1]) S.add(rodGeo(V(-5.4, hullY + 1.75, s * 1.6), V(5.4, hullY + 1.75, s * 1.6), 0.05, 6), gd);
  for (let i = -4; i <= 4; i += 1.6) S.add(rbox(0.4, 0.5, 3.0, 0.08), paint('#F28FAF', 0.4), [i, hullY + 1.3, 0]);
  S.add(heartGeo(0.7, 0.3), gd, [6.9, hullY + 1.6, 0], { rotY: PI / 2, cast: true });
  // arms up to the axle
  for (const s of [-1, 1]) for (const sx of [-1, 1]) S.add(rodGeo(V(sx * 3.2, hullY + 1.0, s * 1.75), V(0, 0, s * 1.9), 0.12, 8), paint('#FFF5E1', 0.4), null, c);
  // mast, sails, pennants
  S.add(rodGeo(V(0, hullY + 1.0, 0), V(0, hullY + 7.2, 0), 0.13, 10), wood('#8A5A44', 1), null, c);
  const sail = (w, h, y, bulge) => { const g = new THREE.PlaneGeometry(w, h, 8, 6), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2); p.setZ(i, bulge * (1 - u * u) * (1 - v * v * 0.6)); } g.computeVertexNormals(); return g.rotateY(PI / 2).translate(0.18, y, 0); };
  const sm = fabric('#FFF5E1', '#FFE3EC', 2, 1, 1);
  S.add(sail(3.4, 2.2, hullY + 3.0, 0.5), sm, null, c); S.add(sail(2.6, 1.7, hullY + 5.2, 0.4), sm, null, c);
  S.add(heartGeo(0.5, 0.06).rotateY(PI / 2), paint('#F28FAF', 0.5), [0.75, hullY + 3.1, 0]);
  const pen = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.4, -0.25), new THREE.Vector2(0, -0.5)]);
  S.add(new THREE.ShapeGeometry(pen), fabric('#F28FAF', '#F28FAF', 2), [0, hullY + 7.2, 0], { cast: true });
  S.add(new THREE.ShapeGeometry(pen).scale(0.8, 0.8, 1), fabric('#A0D8F1', '#A0D8F1', 2), [-5.6, hullY + 3.0, 0]);
  S.add(rodGeo(V(-5.6, hullY + 1.6, 0), V(-5.6, hullY + 3.1, 0), 0.05, 6), wood('#8A5A44', 1));
  S.build(swing);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), bulb('#FFE2B8', 3), 24), m = new THREE.Matrix4();
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) bl.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m.makeTranslation(-5.4 + i * 0.98, hullY + 1.82, s * 1.6)); swing.add(bl);

  const st = { ph: 0, amp: 0, cycle: 0 }, w = Math.sqrt(9.81 / LA);
  const a = attraction({ id: 'pirate', name: 'The Sweet Seahorse', icon: '🏴‍☠️', zone: 'Thrill Corner',
    desc: 'A sugared-pastel pirate ship that swings higher and higher until your tummy flips — then glides gently home.',
    object3D: root, focus: { target: [x, 6, z], dist: 30, height: 4 } });
  a.hits = [hitBox(root, 16, H + 2, 9, 0)];
  a.update = (dt) => {
    const d = a.ease(dt); st.cycle = (st.cycle + dt) % 36; st.ph += w * dt;
    // 0–14 s build up, 14–24 s full swing, 24–32 s ease down, 32–36 s rest
    const target = (st.cycle < 14 ? maxSwing * st.cycle / 14 : st.cycle < 24 ? maxSwing : st.cycle < 32 ? maxSwing * (32 - st.cycle) / 8 : 0) * d;
    st.amp = damp(st.amp, target, 0.6, dt); swing.rotation.z = st.amp * Math.sin(st.ph);
  };
  // ride view: standing at the stern rail, looking along the deck to the bow
  a.rideCam = (pos, look) => { swing.localToWorld(pos.set(-4.6, hullY + 2.8, 0)); swing.localToWorld(look.set(7, hullY + 1.8, 0)); };
  a.rig = { swing, H, LA }; // the night-lighting rig (world/illumination.js)
  return a;
}
