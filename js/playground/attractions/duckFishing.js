/* =========================================================================
   LUCKY DUCK POND — a round carnival trough under a scalloped canopy where rubber ducks bob around a current.
   Gameplay: 40 seconds. Move to steer the hook over the water (a line hangs from the rod), click to dip it.
   A duck under the hook is caught, lifted and turned over to show its number (1–5 points; golden ducks
   are worth 10). It's released back into the stream a moment later. 15+ points wins a prize.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R, rand, pick } from '../core/geo.js';
import { paint, gold, stone, fabric, water, wood, bulb, silver } from '../core/materials.js';
import { attraction, hitCylinder } from './base.js';
import { damp } from '../core/mood.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const R0 = 2.1, R1 = 4.1, WY = 0.85;                       // the channel between the island and the rim
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);

function duckGeo() {
  const P = (g, x, y, z, sx = 1, sy = 1, sz = 1) => g.scale(sx, sy, sz).translate(x, y, z).toNonIndexed();
  return { body: mergeGeometries([P(new THREE.SphereGeometry(0.22, 16, 12), 0, 0.12, 0, 1.15, 0.8, 1), P(new THREE.SphereGeometry(0.13, 14, 10), 0, 0.33, 0.13)]),
    beak: mergeGeometries([P(new THREE.ConeGeometry(0.05, 0.12, 10).rotateX(PI / 2), 0, 0.31, 0.29)]) };
}

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'fishing'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const c = { cast: true }, B = createBatch('duck-pond');
  B.add(new THREE.CylinderGeometry(R1 + 0.4, R1 + 0.5, 0.9, 48, 1, true), stone(2, '#E3D6C8'), [0, 0.45, 0], c);
  B.add(new THREE.TorusGeometry(R1 + 0.4, 0.14, 8, 64).rotateX(PI / 2), paint('#A0D8F1', 0.35), [0, 0.92, 0]);
  B.add(new THREE.CylinderGeometry(R0, R0 + 0.15, 1.2, 32), stone(1, '#D9CBB9'), [0, 0.6, 0], c);
  B.add(new THREE.CircleGeometry(R1 + 0.4, 48).rotateX(-PI / 2), paint('#2F6E7A', 0.6), [0, 0.3, 0]);
  // canopy on four posts, prizes on the island
  for (let k = 0; k < 4; k++) { const ang = k / 4 * TAU + PI / 4; B.add(rodGeo(V(Math.sin(ang) * (R1 + 0.9), 0, Math.cos(ang) * (R1 + 0.9)), V(Math.sin(ang) * (R1 + 0.9), 4.2, Math.cos(ang) * (R1 + 0.9)), 0.09, 8), gold(), null, c); }
  B.add(new THREE.ConeGeometry(R1 + 1.7, 1.8, 8, 1, true), fabric('#A0D8F1', '#FFF5E1', 16, 2, 1), [0, 5.0, 0], c);
  for (let i = 0; i < 32; i++) { const ang = i / 32 * TAU; B.add(new THREE.CircleGeometry(0.32, 10, PI, PI).rotateY(ang).translate(Math.sin(ang) * (R1 + 1.7), 4.1, Math.cos(ang) * (R1 + 1.7)), fabric('#FFB3C6', '#FFB3C6', 2), null, c); }
  B.add(heartGeo(0.4, 0.15), gold(), [0, 6.2, 0]);
  for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU; B.add(new THREE.SphereGeometry(0.26, 12, 10), paint(['#FFB3C6', '#C8A2E8', '#FFD68A'][i % 3], 0.8), [Math.sin(ang) * 1.3, 1.45, Math.cos(ang) * 1.3]); }
  // the rod, at the front rim
  B.add(rodGeo(V(0, 0.9, R1 + 1.2), V(0, 3.2, R1 - 0.2), 0.05, 6), wood('#8A5A44', 1), null, c);
  B.build(root);
  const pond = new THREE.Mesh(new THREE.RingGeometry(R0, R1 + 0.38, 64, 1).rotateX(-PI / 2), water('#6FC2D2', 2)); pond.position.y = WY; root.add(pond);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), bulb('#FFE2B8', 3), 32); for (let i = 0; i < 32; i++) { const ang = i / 32 * TAU; bl.setMatrixAt(i, _m.makeTranslation(Math.sin(ang) * (R1 + 1.7), 4.15, Math.cos(ang) * (R1 + 1.7))); } root.add(bl);
  // ducks
  const N = 14, { body, beak } = duckGeo(), ducks = Array.from({ length: N }, (_, i) => ({ a: i / N * TAU, r: R(R0 + 0.55, R1 - 0.45), ph: R(0, TAU), pts: rand() < 0.12 ? 10 : 1 + Math.floor(rand() * 5), caught: 0 }));
  const bodies = new THREE.InstancedMesh(body, paint('#ffffff', 0.3), N), beaks = new THREE.InstancedMesh(beak, paint('#F2A65A', 0.35), N);
  ducks.forEach((d, i) => bodies.setColorAt(i, new THREE.Color(d.pts === 10 ? '#FFD68A' : pick(['#FFE97A', '#FFE97A', '#FFB3C6', '#A0D8F1']))));
  for (const im of [bodies, beaks]) { im.castShadow = true; im.frustumCulled = false; root.add(im); }
  // hook and line
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16, PI * 1.5), silver()); root.add(hook);
  const lineG = new THREE.BufferGeometry().setFromPoints([V(0, 3.2, R1 - 0.2), V(0, 1, 0)]), line = new THREE.Line(lineG, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })); root.add(line);

  const S = { playing: false, time: 0, score: 0, hook: new THREE.Vector2(0, (R0 + R1) / 2), dip: 0, held: null };
  const a = attraction({ id: 'fishing', kind: 'game', name: 'Lucky Duck Pond', icon: '🦆', zone: 'Carnival Lane',
    desc: 'Rubber ducks bob around the stream. Steer the hook, click to dip and catch one — every duck hides a number. 20 points in 40 seconds wins a prize.',
    object3D: root, focus: { target: [x, 1.2, z], dist: 10, height: 6.5 } });
  a.hits = [hitCylinder(root, R1 + 1.8, 6.5, 0)];
  a.state = () => ({ playing: S.playing, score: S.score, time: Math.ceil(S.time), best: a.best || 0 });
  a.play = () => { S.playing = true; S.time = 40; S.score = 0; a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { S.playing = false; a.ui && a.ui.gameUpdate(a); };
  a.capturesPointer = () => S.playing;
  const plane = new THREE.Plane(), _h = new THREE.Vector3();
  a.pointer = (type, ray) => {
    if (!S.playing) return false;
    root.updateMatrixWorld(); plane.setFromNormalAndCoplanarPoint(V(0, 1, 0), V(0, WY, 0).applyMatrix4(root.matrixWorld));
    if (ray.intersectPlane(plane, _h)) { root.worldToLocal(_h); const r = Math.hypot(_h.x, _h.z), k = Math.max(R0 + 0.2, Math.min(R1 - 0.1, r)) / Math.max(r, 1e-4); S.hook.set(_h.x * k, _h.z * k); }
    if (type === 'down' && S.dip <= 0 && !S.held) { S.dip = 1; tryCatch(); } // the hook has to come back up before the next dip
    return true;
  };
  a.onPick = () => S.playing;
  const pos = (d) => V(Math.sin(d.a) * d.r, WY + Math.sin(d.ph) * 0.03, Math.cos(d.a) * d.r);
  function tryCatch() {
    let best = null, bd = 0.3; for (const d of ducks) { if (d.caught) continue; const p = pos(d), dist = Math.hypot(p.x - S.hook.x, p.z - S.hook.y); if (dist < bd) { bd = dist; best = d; } }
    if (!best) { a.sfx && a.sfx.splash && a.sfx.splash(); return; }
    best.caught = 1; S.held = best; S.score += best.pts; a.sfx && a.sfx.ding && a.sfx.ding();
    const wp = pos(best).applyMatrix4(root.matrixWorld); a.fx && a.fx.sparkles(wp.add(V(0, 0.6, 0)), 22, 1);
    a.ui && (a.ui.toast(best.pts === 10 ? 'Golden duck!' : 'Caught one!', ['+{n} points', { n: best.pts }], '🦆'), a.ui.gameUpdate(a));
  }
  a.update = (dt) => {
    const d = a.ease(dt);
    if (S.playing) { S.time -= dt; if (Math.floor(S.time + dt) !== Math.floor(S.time)) a.ui && a.ui.gameUpdate(a);
      if (S.time <= 0) { S.playing = false; a.best = Math.max(a.best || 0, S.score); a.plays = (a.plays || 0) + 1; const won = S.score >= 20;
        a.ui && (a.ui.toast(won ? 'You won a prize!' : 'Time!', won ? ['You won {p}!', { p: 'a mint dino' }] : ['{n} points', { n: S.score }], '🦆'), a.ui.gameUpdate(a, { result: won ? 'win' : 'lose' }));
        if (won) { a.sfx && a.sfx.fanfare && a.sfx.fanfare(); a.fx && a.fx.hearts(V(0, 2, 0).applyMatrix4(root.matrixWorld), 36, 1.4); } } }
    S.dip = Math.max(0, S.dip - dt * 1.4);
    ducks.forEach((dk, i) => {
      if (dk.caught) { dk.caught += dt; const lift = Math.min(1, dk.caught * 2), p = dk === S.held ? V(S.hook.x, WY + 0.2 + lift * 1.4, S.hook.y) : pos(dk);
        _q.setFromEuler(_e.set(lift * PI, dk.a, 0)); bodies.setMatrixAt(i, _m.compose(p, _q, _s)); beaks.setMatrixAt(i, _m);
        if (dk.caught > 1.6) { dk.caught = 0; if (S.held === dk) S.held = null; dk.a += PI; dk.pts = rand() < 0.12 ? 10 : 1 + Math.floor(rand() * 5); bodies.setColorAt(i, new THREE.Color(dk.pts === 10 ? '#FFD68A' : pick(['#FFE97A', '#FFB3C6', '#A0D8F1']))); bodies.instanceColor.needsUpdate = true; }
        return; }
      dk.a += dt * (0.25 + 0.15 * d) * (2.6 / dk.r); dk.ph += dt * 2.2;
      _q.setFromEuler(_e.set(Math.sin(dk.ph) * 0.08, dk.a + PI / 2, Math.cos(dk.ph) * 0.06)); bodies.setMatrixAt(i, _m.compose(pos(dk), _q, _s)); beaks.setMatrixAt(i, _m);
    });
    bodies.instanceMatrix.needsUpdate = beaks.instanceMatrix.needsUpdate = true;
    const hy = WY + 0.25 - S.dip * 0.3; hook.position.set(S.hook.x, hy, S.hook.y); hook.visible = S.playing;
    line.visible = S.playing; const lp = lineG.attributes.position; lp.setXYZ(1, S.hook.x, hy + 0.1, S.hook.y); lp.needsUpdate = true;
  };
  void damp;
  return a;
}
