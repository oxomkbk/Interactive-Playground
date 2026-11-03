/* =========================================================================
   SKY BALLOONS — a slowly turning carousel of six hot-air balloons hanging from the arms of a cream-and-gold
   tower crowned with a giant balloon. Each balloon (striped envelope, wicker basket, ropes) rises and falls
   on its own rhythm; a cloud of little party balloons floats around the tower.
   Draws: tower (merged) · arms (merged) · envelopes · baskets · ropes · party balloons (instanced).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, R, pick } from '../core/geo.js';
import { paint, gold, stone, fabric, wood, bulb } from '../core/materials.js';
import { attraction, hitCylinder } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
// teardrop envelope profile (lathe), scale ~1
const envProfile = [[0, 0], [0.35, 0.05], [0.55, 0.25], [0.9, 0.75], [1.15, 1.35], [1.22, 1.95], [1.1, 2.5], [0.8, 2.9], [0.4, 3.1], [0, 3.15]].map(([a, b]) => new THREE.Vector2(a, b));

export function create({ x, z, arms: N = 6, reach: AR = 7, top: H = 12, spin = 0.16, lights } = {}) {
  const root = new THREE.Group(); root.name = 'balloons'; root.position.set(x, 0, z);
  const gd = gold(), cream = paint('#FFF5E1', 0.4), c = { cast: true };
  const T = createBatch('balloon-tower');
  T.add(new THREE.CylinderGeometry(4, 4.3, 0.5, 48), stone(2, '#E3D6C8'), [0, 0.25, 0], c);
  T.add(new THREE.CylinderGeometry(0.75, 1.1, H, 24), cream, [0, H / 2, 0], c);
  for (const y of [1.2, 4, 7, 10]) T.add(new THREE.TorusGeometry(1.0 - y * 0.02, 0.1, 8, 32).rotateX(PI / 2), gd, [0, y, 0]);
  // the crowning balloon
  T.add(new THREE.LatheGeometry(envProfile, 40).scale(1.6, 1.6, 1.6), fabric('#FFB3C6', '#FFF5E1', 16, 1, 1), [0, H + 1.6, 0], c);
  T.add(heartGeo(0.5, 0.2), gd, [0, H + 7, 0]);
  T.build(root);
  const hub = new THREE.Group(); hub.position.y = H - 0.6; root.add(hub);
  const A = createBatch('balloon-arms');
  for (let k = 0; k < N; k++) { const a = k / N * TAU, ex = Math.sin(a) * AR, ez = Math.cos(a) * AR;
    A.add(rodGeo(V(0, 0, 0), V(ex, 0.8, ez), 0.12, 10), paint('#C8A2E8', 0.4), null, c); A.add(rodGeo(V(0, -1.4, 0), V(ex * 0.6, 0.48, ez * 0.6), 0.06, 6), gd);
    A.add(new THREE.SphereGeometry(0.2, 12, 8), gd, [ex, 0.8, ez]); }
  A.add(new THREE.CylinderGeometry(1.2, 1.2, 0.8, 24), paint('#F28FAF', 0.35), [0, 0, 0], c);
  A.build(hub);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), bulb('#FFE2B8', 3), N * 10);
  for (let k = 0; k < N; k++) for (let i = 0; i < 10; i++) { const a = k / N * TAU, u = (i + 1) / 11; bl.setMatrixAt(k * 10 + i, _m.makeTranslation(Math.sin(a) * AR * u, 0.12 + 0.8 * u + 0.12, Math.cos(a) * AR * u)); }
  hub.add(bl);
  // hanging balloons: envelopes (striped, tinted per balloon), baskets, four ropes each
  const envM = fabric('#FFFFFF', '#EDE6F4', 14, 1, 1), envs = new THREE.InstancedMesh(new THREE.LatheGeometry(envProfile, 32), envM, N);
  const baskets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.5, 0.65, 16), wood('#B48A64', 1), N), ropes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 4).translate(0, 0.5, 0), paint('#6E4A33', 0.8), N * 4);
  const cols = ['#FFB3C6', '#A0D8F1', '#FFD68A', '#C8A2E8', '#A8E6CF', '#FFAD91'];
  for (let k = 0; k < N; k++) envs.setColorAt(k, new THREE.Color(cols[k % cols.length]));
  const lines = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5).translate(0, 0.5, 0), gd, N);
  for (const im of [envs, baskets, ropes, lines]) { im.castShadow = true; im.frustumCulled = false; hub.add(im); }
  // party balloons around the tower
  const party = Array.from({ length: 28 }, () => ({ a: R(0, TAU), r: R(2, 5), y: R(3, 11), ph: R(0, TAU), c: pick(cols) }));
  const pm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 14, 10).scale(1, 1.18, 1), new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, sheen: 0.4 }), party.length);
  party.forEach((p, i) => pm.setColorAt(i, new THREE.Color(p.c))); pm.castShadow = true; pm.frustumCulled = false; root.add(pm);
  lights && lights.addLocal(V(x, H, z), '#FFD6E6', 30, 18);

  const st = { a: 0 };
  const a = attraction({ id: 'balloons', name: 'Sky Balloons', icon: '🎈', zone: 'Romantic Rides',
    desc: 'Six little hot-air balloons drifting in a slow circle, rising and dipping like they are breathing.',
    object3D: root, focus: { target: [x, 8, z], dist: 28, height: 4 } });
  a.hits = [hitCylinder(root, AR + 2, H + 8, 0)];
  a.update = (dt, t) => {
    const d = a.ease(dt); st.a += spin * d * dt; hub.rotation.y = st.a;
    for (let k = 0; k < N; k++) { const ang = k / N * TAU, ex = Math.sin(ang) * AR, ez = Math.cos(ang) * AR, bob = Math.sin(t * 0.8 + k * 1.7) * 0.9 * (0.4 + 0.6 * d), sway = Math.sin(t * 0.9 + k) * 0.06;
      const by = -5.2 + bob; if (k === 0) a._by0 = by; _q.setFromEuler(_e.set(sway, 0, sway * 0.6));
      envs.setMatrixAt(k, _m.compose(_p.set(ex, by + 0.2, ez), _q, _s.set(1.15, 1.15, 1.15)));
      baskets.setMatrixAt(k, _m.compose(_p.set(ex, by - 0.6, ez), _q, _s.set(1, 1, 1)));
      for (let r = 0; r < 4; r++) { const ra = r / 4 * TAU + PI / 4, ox = Math.sin(ra) * 0.5, oz = Math.cos(ra) * 0.5; ropes.setMatrixAt(k * 4 + r, _m.compose(_p.set(ex + ox, by - 0.3, ez + oz), _q, _s.set(1, 0.7, 1))); }
      const topY = by + 0.2 + 3.15 * 1.15; lines.setMatrixAt(k, _m.compose(_p.set(ex, topY, ez), _q.identity(), _s.set(1, 0.8 - topY, 1))); // the line up to the arm
    }
    envs.instanceMatrix.needsUpdate = baskets.instanceMatrix.needsUpdate = ropes.instanceMatrix.needsUpdate = lines.instanceMatrix.needsUpdate = true;
    party.forEach((p, i) => pm.setMatrixAt(i, _m.makeTranslation(Math.sin(p.a + t * 0.05) * p.r, p.y + Math.sin(t * 1.1 + p.ph) * 0.3, Math.cos(p.a + t * 0.05) * p.r))); pm.instanceMatrix.needsUpdate = true;
  };
  // ride view: in the first balloon's basket
  a.rideCam = (pos, look) => { const by = a._by0 ?? -5.2; hub.localToWorld(pos.set(0, by + 0.1, AR)); hub.localToWorld(look.set(9, by - 2.5, AR + 5)); };
  a.rig = { hub, AR, H }; // the night-lighting rig (world/illumination.js)
  return a;
}
