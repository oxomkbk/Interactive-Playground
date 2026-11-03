/* =========================================================================
   GRAND CAROUSEL — a double-decker: two rings of galloping horses on the ground deck and one on the
   balcony deck above, gold-and-cream twisted poles, a painted centre drum with mirrors, a balustrade, a
   striped pastel roof with a scalloped valance and a crown of bulbs. Every horse has its own coat, mane and
   saddle colours, and rises and falls out of step with its neighbours.
   Draws: base · turning structure (merged) · bulbs · horse bodies · horse tack (instanced).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, canvasTex, rbox } from '../core/geo.js';
import { paint, gold, stone, fabric, bulb, wood } from '../core/materials.js';
import { attraction, hitCylinder } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();

// a galloping horse from capsules (nose toward +z), and its tack: mane, tail, saddle, bridle, hooves
function horse() {
  const P = (g, x, y, z, rx = 0, ry = 0, rz = 0) => g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1))).toNonIndexed();
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  const body = mergeGeometries([
    P(cap(0.3, 0.75), 0, 0, 0, PI / 2), P(cap(0.15, 0.48), 0, 0.42, 0.5, -0.65), P(cap(0.13, 0.36), 0, 0.72, 0.78, 1.15),
    P(cap(0.06, 0.42), 0.16, -0.32, 0.5, -1.15), P(cap(0.06, 0.4), -0.16, -0.38, 0.42, -0.35),   // front legs (one reaching, one tucked)
    P(cap(0.065, 0.42), 0.16, -0.42, -0.42, 0.55), P(cap(0.065, 0.42), -0.16, -0.36, -0.5, 1.0),  // hind legs
    P(new THREE.ConeGeometry(0.05, 0.15, 8), 0.07, 0.94, 0.66, -0.3), P(new THREE.ConeGeometry(0.05, 0.15, 8), -0.07, 0.94, 0.66, -0.3),
  ]);
  const tack = mergeGeometries([
    ...[0, 1, 2, 3, 4].map(i => P(new THREE.SphereGeometry(0.09, 10, 8), 0, 0.82 - i * 0.12, 0.62 - i * 0.1)),
    P(cap(0.09, 0.45), 0, 0.05, -0.62, -1.0),
    P(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 18, 1, true, -PI / 2, PI), 0, 0.06, -0.02, 0, 0, PI / 2),
    P(new THREE.TorusGeometry(0.13, 0.025, 6, 16), 0, 0.68, 0.86, 0.4),
    ...[[0.16, -0.32, 0.5, -1.15], [-0.16, -0.38, 0.42, -0.35], [0.16, -0.42, -0.42, 0.55], [-0.16, -0.36, -0.5, 1.0]].map(([x, y, z, rx]) => P(new THREE.SphereGeometry(0.075, 8, 6), x, y + Math.cos(rx) * -0.27, z + Math.sin(rx) * 0.27)),
  ]);
  return { body, tack };
}
const drumTex = () => canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#FFF5E1'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { const x = i * w / 8; g.fillStyle = i % 2 ? '#F7D3DC' : '#E4D6F5'; g.beginPath(); g.roundRect(x + 14, 26, w / 8 - 28, h - 52, 30); g.fill();
    g.strokeStyle = '#E3B865'; g.lineWidth = 6; g.stroke(); g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.ellipse(x + w / 16, h / 2, 28, 50, 0, 0, TAU); g.fill();
    g.fillStyle = '#E3B865'; g.font = '40px serif'; g.textAlign = 'center'; g.fillText('♥', x + w / 16, 60); } }, true);

export function create({ x, z, radius: CR = 7.2, spin = 0.32, lights } = {}) {
  const root = new THREE.Group(); root.name = 'carousel'; root.position.set(x, 0, z);
  const gd = gold(), cream = paint('#FFF5E1', 0.45), c = { cast: true };
  const base = createBatch('carousel-base');
  base.add(new THREE.CylinderGeometry(CR + 0.6, CR + 0.8, 0.5, 64), stone(3, '#E0D2C4'), [0, 0.25, 0], c);
  for (let i = 0; i < 3; i++) base.add(rbox(3, 0.16, 0.7, 0.05), stone(1, '#D7C8BA'), [0, 0.08 + i * 0.16, CR + 1.9 - i * 0.55]);
  base.build(root);

  const top = new THREE.Group(); top.position.y = 0.5; root.add(top);
  const T = createBatch('carousel-top'), H1 = 4.2, H2 = 8.0;
  T.add(new THREE.CylinderGeometry(CR, CR, 0.25, 64), wood('#C79A73', 3), [0, 0.12, 0], c);
  T.add(new THREE.TorusGeometry(CR, 0.08, 8, 96).rotateX(PI / 2), gd, [0, 0.25, 0]);
  T.add(new THREE.CylinderGeometry(2.2, 2.2, H2 + 0.8, 32, 1, true), paint('#FFFFFF', 0.3), [0, (H2 + 0.8) / 2, 0], c);
  T.add(new THREE.CylinderGeometry(2.25, 2.25, 2.6, 32, 1, true), new THREE.MeshStandardMaterial({ map: drumTex(), roughness: 0.4, metalness: 0.2 }), [0, 1.9, 0]);
  // balcony deck with balustrade
  T.add(new THREE.CylinderGeometry(CR - 0.4, CR - 0.4, 0.3, 64, 1), cream, [0, H1, 0], c);
  T.add(new THREE.TorusGeometry(CR - 0.4, 0.12, 8, 96).rotateX(PI / 2), gd, [0, H1 - 0.05, 0]);
  T.add(new THREE.TorusGeometry(CR - 0.45, 0.05, 6, 96).rotateX(PI / 2), gd, [0, H1 + 1.0, 0]);
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; T.add(new THREE.CylinderGeometry(0.035, 0.05, 0.85, 6), cream, [Math.sin(a) * (CR - 0.45), H1 + 0.57, Math.cos(a) * (CR - 0.45)]); }
  // roof: striped cone, scalloped valance, gold crown with a heart
  const roof = fabric('#FFB3C6', '#FFF5E1', 16, 4, 1);
  T.add(new THREE.ConeGeometry(CR + 0.9, 3.2, 64, 1, true), roof, [0, H2 + 2.2, 0], c);
  for (let i = 0; i < 56; i++) { const a = i / 56 * TAU; T.add(new THREE.CircleGeometry(0.42, 12, PI, PI).rotateY(a).translate(Math.sin(a) * (CR + 0.9), H2 + 0.62, Math.cos(a) * (CR + 0.9)), fabric('#C8A2E8', '#C8A2E8', 2), null, c); }
  T.add(new THREE.CylinderGeometry(CR + 0.9, CR + 0.9, 0.6, 64, 1, true), fabric('#F28FAF', '#FFF5E1', 32, 2, 1), [0, H2 + 0.9, 0], c);
  T.add(new THREE.TorusGeometry(CR + 0.92, 0.1, 6, 96).rotateX(PI / 2), gd, [0, H2 + 1.2, 0]);
  T.add(new THREE.CylinderGeometry(0.5, 0.7, 1.0, 16), gd, [0, H2 + 4.0, 0]); T.add(heartGeo(0.7, 0.3), gd, [0, H2 + 5.1, 0]);
  // twisted gold-and-cream poles for every horse
  const rings = [{ r: CR - 1.0, n: 12, y: 0.25, h: H1 - 0.25 }, { r: CR - 2.9, n: 8, y: 0.25, h: H1 - 0.25 }, { r: CR - 1.6, n: 10, y: H1 + 0.15, h: H2 - H1 - 0.15 }];
  const poleM = fabric('#E9BE6A', '#FFF5E1', 6, 1, 4);
  for (const R of rings) for (let k = 0; k < R.n; k++) { const a = k / R.n * TAU; T.add(new THREE.CylinderGeometry(0.06, 0.06, R.h, 10), poleM, [Math.sin(a) * R.r, R.y + R.h / 2, Math.cos(a) * R.r], c); }
  T.build(top);
  const NB = 96, bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), bulb('#FFE2B8', 3.4), NB + 40);
  for (let i = 0; i < NB; i++) { const a = i / NB * TAU; bl.setMatrixAt(i, _m.makeTranslation(Math.sin(a) * (CR + 0.98), H2 + 1.2, Math.cos(a) * (CR + 0.98))); }
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, k = i % 2 ? 0.55 : 0.25; bl.setMatrixAt(NB + i, _m.makeTranslation(Math.sin(a) * (CR + 0.9) * (1 - k * 0.8), H2 + 2.2 + k * 3.2 * 0.9 - 1.0, Math.cos(a) * (CR + 0.9) * (1 - k * 0.8))); }
  top.add(bl);

  // horses
  const { body, tack } = horse(), all = rings.flatMap((R, ri) => Array.from({ length: R.n }, (_, k) => ({ ri, k, r: R.r, a: k / R.n * TAU, base: R.y + R.h * 0.42 })));
  const coats = ['#FFF5E1', '#F7D3DC', '#E4D6F5', '#D7EEF8', '#FDE8C8', '#E7F6EE', '#FFFFFF'], tackC = ['#E9BE6A', '#F28FAF', '#C8A2E8', '#A0D8F1', '#FFAD91'];
  const bodies = new THREE.InstancedMesh(body, paint('#ffffff', 0.32), all.length), tacks = new THREE.InstancedMesh(tack, paint('#ffffff', 0.28), all.length);
  all.forEach((h, i) => { bodies.setColorAt(i, new THREE.Color(coats[i % coats.length])); tacks.setColorAt(i, new THREE.Color(tackC[(i * 3) % tackC.length])); });
  for (const im of [bodies, tacks]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; top.add(im); }
  lights && lights.addLocal(V(x, 5, z), '#FFD0A8', 45, 20);

  const st = { a: 0 };
  const a = attraction({ id: 'carousel', name: 'Grand Carousel', icon: '🎠', zone: 'Romantic Rides',
    desc: 'A double-decker carousel: thirty hand-painted horses on twisted gold poles, a mirrored drum and a crown of bulbs.',
    object3D: root, focus: { target: [x, 5, z], dist: 22, height: 5 } });
  a.hits = [hitCylinder(root, CR + 0.8, H2 + 6, 0)];
  a.update = (dt, t) => {
    const d = a.ease(dt); st.a += spin * d * dt; top.rotation.y = st.a;
    all.forEach((h, i) => { const ph = t * 1.7 * (0.25 + 0.75 * d) + i * 1.3, y = h.base + Math.sin(ph) * 0.35 * (0.3 + 0.7 * d);
      if (i === 0) a._h0y = y; _q.setFromEuler(_e.set(Math.sin(ph) * 0.1, h.a + PI / 2, 0)); _m.compose(_p.set(Math.sin(h.a) * h.r, y + 0.15, Math.cos(h.a) * h.r), _q, _s); bodies.setMatrixAt(i, _m); tacks.setMatrixAt(i, _m); });
    bodies.instanceMatrix.needsUpdate = tacks.instanceMatrix.needsUpdate = true;
  };
  // ride view: on the first horse, facing the way it gallops
  a.rideCam = (pos, look) => { const h = all[0], y = a._h0y ?? h.base; top.localToWorld(pos.set(Math.sin(h.a) * h.r, y + 1.35, Math.cos(h.a) * h.r));
    top.localToWorld(look.set(Math.sin(h.a) * h.r + Math.cos(h.a) * 8, y + 0.6, Math.cos(h.a) * h.r - Math.sin(h.a) * 8)); };
  a.rig = { top, CR, H2 }; // the night-lighting rig (world/illumination.js)
  return a;
}
