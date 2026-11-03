/* =========================================================================
   WISHING FOUNTAIN — the heart of the plaza: a carved three-tier fountain with a scalloped stone basin,
   two overflowing bowls, a ring of arcing jets, a tall centre plume, a gold heart-and-crown finial,
   coins glinting under animated water, and an underwater glow that blooms at night.
   Click it to toss a coin and make a wish: the coin arcs in, splashes, and your wish rises in hearts.
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, R, rand, pick } from '../core/geo.js';
import { stone, gold, water, glow } from '../core/materials.js';
import { createJets } from '../fx/particles.js';
import { attraction, hitCylinder } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const WISHES = ['May every day feel like sunset.', 'May we ride the Ferris wheel forever.', 'A lifetime of cotton candy.', 'May someone special hold your hand tonight.', 'May all your dreams bloom like cherry trees.', 'More fireworks, more laughter, more us.'];

export function create({ x = 0, z = 0, lights } = {}) {
  const root = new THREE.Group(); root.name = 'fountain'; root.position.set(x, 0, z);
  const st = stone(2, '#E9DDCD'), st2 = stone(1, '#DCCDBD'), gd = gold(), c = { cast: true };
  const B = createBatch('fountain');
  // basin wall: a lathe with a rounded lip, plus scallops around the rim
  const basin = [[5.7, 0], [6.25, 0], [6.3, 0.55], [6.45, 0.7], [6.4, 0.85], [6.0, 0.88], [5.85, 0.75], [5.8, 0.2]].map(([a, b]) => new THREE.Vector2(a, b));
  B.add(new THREE.LatheGeometry(basin, 96), st, null, c);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; B.add(new THREE.SphereGeometry(0.32, 14, 10, 0, TAU, 0, PI / 2).scale(1, 0.6, 1).rotateZ(PI / 2).rotateY(a + PI / 2), st2, [Math.sin(a) * 6.45, 0.45, Math.cos(a) * 6.45]); }
  B.add(new THREE.CircleGeometry(5.85, 64).rotateX(-PI / 2), st2, [0, 0.06, 0]);
  // pedestal and bowls
  const ped = [[0, 0], [1.3, 0], [1.1, 0.4], [0.75, 0.9], [0.6, 1.9], [0.85, 2.3], [0, 2.3]].map(([a, b]) => new THREE.Vector2(a, b));
  B.add(new THREE.LatheGeometry(ped, 48), st, null, c);
  const bowl = (r, y, d) => [[0, y - d], [r * 0.3, y - d], [r * 0.85, y - d * 0.45], [r, y], [r * 1.04, y + 0.12], [r * 0.95, y + 0.14], [r * 0.82, y + 0.02], [0, y + 0.02]].map(([a, b]) => new THREE.Vector2(a, b));
  B.add(new THREE.LatheGeometry(bowl(2.8, 2.6, 0.7), 64), st, null, c);
  B.add(new THREE.LatheGeometry([[0, 2.6], [0.45, 2.6], [0.32, 3.4], [0.5, 4.3], [0, 4.3]].map(([a, b]) => new THREE.Vector2(a, b)), 32), st, null, c);
  B.add(new THREE.LatheGeometry(bowl(1.3, 4.55, 0.4), 48), st, null, c);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; B.add(heartGeo(0.18, 0.08).rotateY(a), gd, [Math.sin(a) * 2.88, 2.68, Math.cos(a) * 2.88]); }
  // finial: column, crown, heart
  B.add(rodGeo(V(0, 4.6, 0), V(0, 5.6, 0), 0.14, 12), st);
  B.add(new THREE.CylinderGeometry(0.45, 0.3, 0.35, 8, 1, true), gd, [0, 5.75, 0]);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; B.add(new THREE.ConeGeometry(0.07, 0.22, 6), gd, [Math.sin(a) * 0.43, 6.02, Math.cos(a) * 0.43]); }
  B.add(heartGeo(0.55, 0.25), gd, [0, 6.65, 0], c);
  // coins on the basin floor
  for (let i = 0; i < 70; i++) { const a = rand() * TAU, r = R(1.5, 5.6); B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 10).rotateX(R(-0.3, 0.3)), gd, [Math.sin(a) * r, 0.08, Math.cos(a) * r]); }
  // underwater glow ring (wakes at night)
  B.add(new THREE.TorusGeometry(5.5, 0.06, 6, 96).rotateX(PI / 2), glow('#9FE3FF', 1.1, 0.1), [0, 0.12, 0]);
  B.build(root);
  const wm = water('#7EC6D8', 2.5);
  for (const [r, y] of [[5.85, 0.62], [2.62, 2.66], [1.2, 4.6]]) { const w = new THREE.Mesh(new THREE.CircleGeometry(r, 64).rotateX(-PI / 2), wm); w.position.y = y; w.receiveShadow = true; root.add(w); }
  // overflowing veils from the two bowls (translucent, scrolling)
  const veil = new THREE.MeshPhysicalMaterial({ color: '#CFEFFF', transparent: true, opacity: 0.32, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 });
  for (const [r0, r1, y0, y1] of [[2.88, 3.3, 2.7, 0.62], [1.35, 1.6, 4.65, 2.66]]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, y0 - y1, 64, 1, true), veil); v.position.y = (y0 + y1) / 2; root.add(v); }
  // jets: centre plume, a crown on the top bowl, a ring of arcs from the basin rim inward
  const jets = createJets([
    { x: 0, y: 6.9, z: 0, up: 6.5, out: 0.35, n: 420 },
    { x: 0, y: 4.62, z: 0, up: 2.4, out: 1.1, n: 220, ring: 0.9 },
    ...Array.from({ length: 16 }, (_, i) => { const a = i / 16 * TAU; return { x: Math.sin(a) * 5.7, y: 0.75, z: Math.cos(a) * 5.7, up: 4.2, out: 1.9, n: 70, dir: a + PI }; }), // arcing inward
  ]);
  root.add(jets.object3D);
  lights && lights.addLocal(V(x, 3, z), '#CFE6FF', 12, 16);

  const coins = [];
  const a = attraction({ id: 'fountain', kind: 'landmark', name: 'Wishing Fountain', icon: '⛲', zone: 'Central Plaza',
    desc: 'Toss a coin, make a wish. They say every wish made at sunset comes true by the next full moon.',
    object3D: root, focus: { target: [x, 3, z], dist: 20, height: 4 } });
  a.hits = [hitCylinder(root, 6.5, 7.5, 0)];
  a.wishes = 0;
  a.onPick = () => { // toss a coin
    const from = V(R(-3, 3), 3.5, 9).applyMatrix4(root.matrixWorld), to = V(R(-4, 4), 0.7, R(-4, 4)).applyMatrix4(root.matrixWorld);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), gd); coin.castShadow = true; root.parent.add(coin);
    coins.push({ coin, from, to, mid: from.clone().lerp(to, 0.5).add(V(0, 3, 0)), t: 0 }); a.sfx && a.sfx.coin && a.sfx.coin(); return true; };
  a.update = (dt, t) => {
    jets.update(dt, t);
    for (let i = coins.length - 1; i >= 0; i--) { const k = coins[i]; k.t = Math.min(1, k.t + dt / 0.9); const u = k.t;
      k.coin.position.copy(k.from).multiplyScalar((1 - u) ** 2).addScaledVector(k.mid, 2 * u * (1 - u)).addScaledVector(k.to, u * u); k.coin.rotation.set(u * 20, u * 7, 0);
      if (k.t >= 1) { coins.splice(i, 1); k.coin.parent.remove(k.coin); a.wishes++;
        a.fx && (a.fx.sparkles(k.to.clone().add(V(0, 0.3, 0)), 30, 1.4), a.fx.hearts(k.to.clone().add(V(0, 0.6, 0)), 22, 1.0)); a.sfx && a.sfx.splash && a.sfx.splash();
        a.ui && a.ui.toast('Your wish is on its way', pick(WISHES)); } }
  };
  return a;
}
