/* =========================================================================
   SWAN BOATS — four white swan boats with gold crowns glide a slow loop around the garden pond and under the
   arched bridge, their reflections rippling. Ride view puts you in the lead swan; "Float a lantern" sets a
   glowing paper lantern adrift on the water (they gather and drift, and light up the pond at night).
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { heartGeo, R } from '../core/geo.js';
import { paint, gold, lampGlass } from '../core/materials.js';
import { attraction, hitBox } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);

function swanGeo() {
  const P = (g, x, y, z, rx = 0) => g.rotateX(rx).translate(x, y, z).toNonIndexed();
  const hull = new THREE.SphereGeometry(1, 24, 14, 0, TAU, 0, PI / 2).rotateX(PI).scale(0.95, 0.55, 1.6);
  const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.1, 1.2), V(0, 0.9, 1.55), V(0, 1.7, 1.35), V(0, 1.85, 1.65)]), 16, 0.13, 8);
  const wing = (s) => new THREE.SphereGeometry(0.75, 16, 10).scale(0.35, 0.55, 1).rotateZ(s * 0.5).translate(s * 0.78, 0.35, -0.2).toNonIndexed();
  return { white: mergeGeometries([hull.toNonIndexed(), neck.toNonIndexed(), P(new THREE.SphereGeometry(0.2, 14, 10), 0, 1.88, 1.68), wing(-1), wing(1), P(new THREE.SphereGeometry(0.75, 16, 8, 0, TAU, 0, PI / 2).scale(1, 0.5, 1.2), 0, 0.12, -0.35)]),
    gold: mergeGeometries([P(new THREE.ConeGeometry(0.06, 0.25, 8), 0, 1.84, 1.95, PI / 2), P(new THREE.TorusGeometry(0.12, 0.03, 6, 12), 0, 2.08, 1.66, PI / 2), new THREE.TorusGeometry(0.97, 0.04, 6, 32).rotateX(PI / 2).scale(1, 1, 1.62).translate(0, 0.02, 0).toNonIndexed()]) };
}

export function create() {
  const { x: gx, z: gz } = CONFIG.layout.garden, root = new THREE.Group(); root.name = 'swans'; root.position.set(gx, 0.1, gz);
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 16 }, (_, i) => { const a = i / 16 * TAU; return V(Math.cos(a) * 7.0, 0, Math.sin(a) * 2.7); }), true, 'centripetal');
  const { white, gold: goldG } = swanGeo(), N = 4;
  const bodies = new THREE.InstancedMesh(white, paint('#FFFDF8', 0.35), N), trims = new THREE.InstancedMesh(goldG, gold(), N);
  for (const im of [bodies, trims]) { im.castShadow = true; im.frustumCulled = false; root.add(im); }
  // lanterns set adrift
  const LN = 30, lanterns = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(0.16, 0.2, 0.28, 8).toNonIndexed(), heartGeo(0.07, 0.03).translate(0, 0.22, 0)]), lampGlass('#FFC48A', 3), LN);
  lanterns.count = 0; lanterns.frustumCulled = false; root.add(lanterns); const L = [];
  const st = { u: 0 };
  const a = attraction({ id: 'swans', name: 'Swan Boats', icon: '🦢', zone: 'Fantasy Garden',
    desc: 'White swan boats glide around the koi pond and under the arched bridge. Ride in the lead swan, or set a paper lantern adrift on the water.',
    object3D: root, focus: { target: [gx, 1, gz], dist: 22, height: 9 } });
  a.hits = [hitBox(root, 18, 3, 12, -0.2)];
  a.playLabel = 'Float a lantern';
  a.play = () => { if (L.length >= LN) L.shift(); const p = path.getPointAt(((st.u % 1) + 1) % 1); L.push({ x: p.x * 0.7 + R(-1, 1), z: p.z * 0.7 + R(-1, 1), vx: R(-0.15, 0.15), vz: R(-0.15, 0.15), ph: R(0, TAU) }); a.sfx && a.sfx.splash && a.sfx.splash(); a.fx && a.fx.sparkles(V(p.x * 0.7, 0.6, p.z * 0.7).applyMatrix4(root.matrixWorld), 14, 0.6); };
  a.rideCam = (pos, look) => { const u = ((st.u % 1) + 1) % 1, p = path.getPointAt(u), tg = path.getTangentAt(u); root.localToWorld(pos.set(p.x - tg.x * 0.4, 1.35, p.z - tg.z * 0.4)); root.localToWorld(look.set(p.x + tg.x * 8, 0.6, p.z + tg.z * 8)); };
  a.update = (dt, t) => {
    st.u += dt * 0.012 * a.ease(dt);
    for (let k = 0; k < N; k++) { const u = (((st.u + k / N) % 1) + 1) % 1, p = path.getPointAt(u), tg = path.getTangentAt(u);
      _q.setFromEuler(_e.set(Math.sin(t * 1.3 + k) * 0.03, Math.atan2(tg.x, tg.z), Math.sin(t * 1.1 + k) * 0.04)); _m.compose(V(p.x, 0.25 + Math.sin(t * 1.6 + k) * 0.03, p.z), _q, _s.set(0.85, 0.85, 0.85)); bodies.setMatrixAt(k, _m); trims.setMatrixAt(k, _m); }
    bodies.instanceMatrix.needsUpdate = trims.instanceMatrix.needsUpdate = true;
    L.forEach((l, i) => { l.x += l.vx * dt; l.z += l.vz * dt; if ((l.x / 9) ** 2 + (l.z / 5.6) ** 2 > 1) { l.vx *= -1; l.vz *= -1; } lanterns.setMatrixAt(i, _m.compose(V(l.x, 0.12 + Math.sin(t * 1.5 + l.ph) * 0.03, l.z), _q.identity(), _s.set(1, 1, 1))); });
    lanterns.count = L.length; lanterns.instanceMatrix.needsUpdate = true;
  };
  return a;
}
