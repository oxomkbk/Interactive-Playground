/* =========================================================================
   MAD TEA PARTY — six giant porcelain teacups (each its own colour, with gold rims and painted hearts) on
   saucers that ride a turning floor around a rose teapot, framed by little tea tables and lamp posts.
   The floor turns one way while each cup spins on its own; click a cup to give it a big spin.
   Draws: base, teapot & tables (merged) · floor · cups · saucers (instanced) · bulbs.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, canvasTex, R } from '../core/geo.js';
import { paint, gold, stone, bulb, lampGlass } from '../core/materials.js';
import { attraction, hitCylinder, hitSphere } from './base.js';
import { damp } from '../core/mood.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3();

const porcelain = () => canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); g.fillStyle = '#E9BE6A'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 10, w, 10);
  g.fillStyle = 'rgba(242,143,175,.85)'; g.font = '54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 10; i++) { g.fillText('♥', 50 + i * 102, 110 + (i % 2) * 60); }
  g.strokeStyle = 'rgba(200,162,232,.8)'; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, 50 + Math.sin(x / 30) * 10); g.stroke();
});

export function create({ x, z, radius: TR = 8, cups: N = 6, tableSpin = 0.3, lights } = {}) {
  const root = new THREE.Group(); root.name = 'teacups'; root.position.set(x, 0, z);
  const gd = gold(), rose = paint('#F28FAF', 0.35), cream = paint('#FFF5E1', 0.4), c = { cast: true };
  const B = createBatch('teacups');
  B.add(new THREE.CylinderGeometry(TR + 0.5, TR + 0.7, 0.4, 64), stone(3, '#E3D6C8'), [0, 0.2, 0], c);
  const pot = [[0, 0], [1.2, 0], [1.7, 0.5], [1.85, 1.1], [1.65, 1.8], [1.05, 2.2], [0.75, 2.25], [0, 2.25]].map(([a, b]) => new THREE.Vector2(a, b));
  B.add(new THREE.LatheGeometry(pot, 48), rose, [0, 0.5, 0], c);
  B.add(new THREE.SphereGeometry(0.85, 32, 12, 0, TAU, 0, PI / 2).scale(1, 0.55, 1), cream, [0, 2.75, 0], c);
  B.add(new THREE.SphereGeometry(0.2, 16, 10), gd, [0, 3.3, 0]);
  B.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(1.6, 1.2, 0), V(2.7, 1.5, 0), V(2.85, 2.6, 0)), 20, 0.17, 12), rose, [0, 0.5, 0], c);
  B.add(new THREE.TorusGeometry(0.62, 0.12, 10, 28, PI * 1.25), rose, [-1.6, 1.7, 0], { rot: [0, 0, PI * 0.38], cast: true });
  B.add(heartGeo(0.5, 0.15), gd, [0, 1.6, 1.82]); B.add(new THREE.TorusGeometry(1.86, 0.06, 6, 48).rotateX(PI / 2), gd, [0, 1.6, 0]);
  // tea tables and lamp posts around the outside
  const lampHeads = [];
  for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * TAU, tx = Math.sin(a) * (TR + 2.2), tz = Math.cos(a) * (TR + 2.2);
    if (k % 2) { B.add(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 24), cream, [tx, 0.95, tz], c); B.add(rodGeo(V(tx, 0, tz), V(tx, 0.95, tz), 0.06, 8), gd, null, c);
      B.add(new THREE.CylinderGeometry(0.12, 0.09, 0.14, 12), paint('#A0D8F1', 0.3), [tx + 0.2, 1.05, tz]); B.add(new THREE.SphereGeometry(0.18, 12, 8).scale(1, 0.8, 1), paint('#C8A2E8', 0.3), [tx - 0.2, 1.12, tz]); }
    else { B.add(rodGeo(V(tx, 0, tz), V(tx, 3.2, tz), 0.06, 8), paint('#4B3A5E', 0.5), null, c); lampHeads.push(V(tx, 3.4, tz)); } }
  for (const h of lampHeads) B.add(new THREE.SphereGeometry(0.28, 16, 12), lampGlass('#FFE0B5', 2.4), [h.x, h.y, h.z]);
  B.build(root);

  const floor = new THREE.Group(); floor.position.y = 0.42; root.add(floor);
  const FB = createBatch('tea-floor');
  FB.add(new THREE.RingGeometry(2.1, TR, 96).rotateX(-PI / 2), paint('#C9E9F2', 0.5), [0, 0.02, 0]);
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; FB.add(new THREE.CircleGeometry(0.25, 12).rotateX(-PI / 2), paint(k % 2 ? '#FFB3C6' : '#FFF5E1', 0.5), [Math.sin(a) * (TR - 0.6), 0.03, Math.cos(a) * (TR - 0.6)]); }
  FB.add(new THREE.TorusGeometry(TR, 0.08, 6, 96).rotateX(PI / 2), gd, [0, 0.04, 0]);
  FB.build(floor);
  const NB = 64, bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), bulb('#FFE2B8', 3), NB);
  for (let i = 0; i < NB; i++) { const a = i / NB * TAU; bl.setMatrixAt(i, _m.makeTranslation(Math.sin(a) * (TR + 0.05), 0.12, Math.cos(a) * (TR + 0.05))); } floor.add(bl);

  // cups: lathe porcelain with a handle, on saucers; each on its own pivot so picking can find it
  const prof = [[0, 0.15], [0.7, 0.15], [1.15, 0.38], [1.45, 0.85], [1.55, 1.35], [1.5, 1.38], [1.38, 0.92], [1.08, 0.45], [0.65, 0.25], [0, 0.25]].map(([a, b]) => new THREE.Vector2(a, b));
  const cupGeo = mergeGeometries([new THREE.LatheGeometry(prof, 48).toNonIndexed(), new THREE.TorusGeometry(0.36, 0.09, 10, 20, PI * 1.3).rotateZ(-PI * 0.65).translate(1.6, 0.85, 0).toNonIndexed()]);
  const cups = new THREE.InstancedMesh(cupGeo, new THREE.MeshPhysicalMaterial({ map: porcelain(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }), N);
  const saucers = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(1.85, 1.35, 0.14, 48).toNonIndexed(), new THREE.TorusGeometry(1.85, 0.05, 6, 48).rotateX(PI / 2).translate(0, 0.07, 0).toNonIndexed()]), paint('#FFFFFF', 0.25), N);
  const cols = ['#FFB3C6', '#C8A2E8', '#A8E6CF', '#A0D8F1', '#FFD68A', '#FFAD91'];
  for (let k = 0; k < N; k++) cups.setColorAt(k, new THREE.Color(cols[k % cols.length]).lerp(new THREE.Color('#ffffff'), 0.25));
  for (const im of [cups, saucers]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; floor.add(im); }
  const CR = (TR + 2.1) / 2 + 0.2, pivots = [];
  for (let k = 0; k < N; k++) { const o = new THREE.Object3D(), a = k / N * TAU; o.position.set(Math.sin(a) * CR, 0.1, Math.cos(a) * CR); floor.add(o);
    const pick = hitSphere(o, 1.7, V(0, 0.8, 0)); pick.userData.cup = k; pivots.push({ o, w: (k % 2 ? -1 : 1) * R(0.6, 1.0), boost: 0, pick }); }
  lights && lights.addLocal(V(x, 4.5, z), '#FFD8E4', 30, 16);

  const a = attraction({ id: 'teacups', name: 'Mad Tea Party', icon: '☕', zone: 'Romantic Rides',
    desc: 'Six giant porcelain teacups spinning around a rose teapot. Click any cup to give it an extra-dizzy spin!',
    object3D: root, focus: { target: [x, 1.5, z], dist: 19, height: 9 } });
  a.hits = [hitCylinder(root, TR + 0.6, 4, 0)]; a.pickables = pivots.map(p => p.pick);
  a.onPick = (hit) => { const k = hit.obj.userData.cup; if (k === undefined) return false; pivots[k].boost = Math.min(pivots[k].boost + 3.2, 7); a.fx && a.fx.sparkles(hit.point, 24, 1.6); a.sfx && a.sfx.whee && a.sfx.whee(); return true; };
  a.update = (dt) => {
    const d = a.ease(dt); floor.rotation.y -= tableSpin * d * dt;
    pivots.forEach((p, k) => { p.boost = damp(p.boost, 0, 0.35, dt); p.o.rotation.y += (p.w * d + Math.sign(p.w) * p.boost) * dt; p.o.updateMatrix();
      cups.setMatrixAt(k, p.o.matrix); saucers.setMatrixAt(k, _m.copy(p.o.matrix).multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0))); });
    cups.instanceMatrix.needsUpdate = saucers.instanceMatrix.needsUpdate = true;
  };
  // ride view: sitting in the first cup, looking across it
  a.rideCam = (pos, look) => { pivots[0].o.localToWorld(pos.set(0.6, 2.0, 0)); pivots[0].o.localToWorld(look.set(-4, 1.0, 0)); };
  a.rig = { floor, TR }; // the night-lighting rig (world/illumination.js)
  return a;
}
