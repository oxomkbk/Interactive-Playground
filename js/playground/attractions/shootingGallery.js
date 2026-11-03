/* =========================================================================
   STARLIGHT GALLERY — a carnival shooting gallery: a velvet-lined booth with a scalloped marquee, three rails
   of tin targets (moons, hearts, stars) gliding back and forth, and a gold star that zips past now and then.
   Gameplay: 30 seconds, 20 shots. Click to fire; a hit flips the target down with sparkles; targets pop back
   up after a moment. Moon 1 · heart 2 · star 3 · golden star 10. 25+ wins a prize.
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R, rand } from '../core/geo.js';
import { paint, gold, wood, fabric, bulb, matte, signMat } from '../core/materials.js';
import { sign } from '../core/textures.js';
import { attraction, hitBox, HIT } from './base.js';
import { t, onLang } from '../i18n.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2, _mm = new THREE.Matrix4();

function shapeGeo(kind) {
  if (kind === 'heart') return heartGeo(0.26, 0.08);
  const s = new THREE.Shape();
  if (kind === 'star') { for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.13 : 0.3, ang = i / 10 * TAU + PI / 2; i ? s.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : s.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); } }
  else { s.absarc(0, 0, 0.28, 0, TAU, false); const h = new THREE.Path(); h.absarc(0.14, 0.08, 0.24, 0, TAU, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }); g.center(); return g;
}

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'gallery'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const c = { cast: true }, B = createBatch('gallery');
  B.add(rbox(8, 0.3, 4.6, 0.1), wood('#B48A64', 2), [0, 0.15, 0], c);
  B.add(rbox(7.6, 4.2, 0.3, 0.1), paint('#3E2E52', 0.7), [0, 2.4, -2.1], c);                    // deep plum backdrop
  for (const s of [-1, 1]) B.add(rbox(0.3, 4.2, 4.4, 0.1), paint('#F7D3DC', 0.6), [s * 3.95, 2.4, 0], c);
  B.add(rbox(8.2, 0.9, 0.6, 0.1), paint('#F7D3DC', 0.6), [0, 4.3, 2.0], c);
  B.add(rbox(7.6, 1.1, 0.5, 0.1), wood('#C99A72', 1), [0, 0.85, 2.0], c); B.add(rbox(7.8, 0.12, 0.7, 0.04), paint('#F28FAF', 0.4), [0, 1.45, 2.0]);
  const aw = fabric('#C8A2E8', '#FFF5E1', 16, 2, 1); B.add(new THREE.PlaneGeometry(8.4, 1.6).rotateX(-PI / 2 + 0.6), aw, [0, 4.75, 2.6], c);
  for (let i = 0; i < 16; i++) B.add(new THREE.CircleGeometry(0.27, 10, PI, PI), aw, [-3.9 + i * 0.52, 4.3, 3.2]);
  for (const y of [1.7, 2.6, 3.5]) B.add(rodGeo(V(-3.6, y, -1.6), V(3.6, y, -1.6), 0.04, 6), gold());
  B.build(root);
  const mk = () => sign(t('Starlight Gallery'), { w: 1024, h: 256, size: 110, fg: '#7A4FA8' }), sm = signMat(mk(), 1.2); onLang(() => { sm.map = sm.emissiveMap = mk(); sm.needsUpdate = true; });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), sm); board.position.set(0, 4.3, 2.32); root.add(board);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), bulb('#FFE2B8', 3), 30), m = new THREE.Matrix4(); for (let i = 0; i < 30; i++) bl.setMatrixAt(i, m.makeTranslation(-3.9 + i * 0.27, 3.86, 2.33)); root.add(bl);
  // targets on three rails (+ one golden star on its own fast track)
  const rows = [{ y: 1.7, kind: 'moon', n: 6, sp: 0.6, pts: 1, col: '#FFF5E1' }, { y: 2.6, kind: 'heart', n: 5, sp: -0.85, pts: 2, col: '#F28FAF' }, { y: 3.5, kind: 'star', n: 4, sp: 1.1, pts: 3, col: '#A0D8F1' }];
  const targets = [];
  // one instanced mesh per rail: each target is a transform (its Group, holding the hit proxy) copied into the instance
  const rails = [];
  for (const row of rows) { const geo = shapeGeo(row.kind), im = new THREE.InstancedMesh(geo, paint(row.col, 0.35), row.n); im.castShadow = true; im.frustumCulled = false; root.add(im); rails.push(im);
    for (let i = 0; i < row.n; i++) { const g = new THREE.Group(), mesh = new THREE.Object3D(); mesh.position.y = 0.32; g.add(mesh); root.add(g); mesh.userData.im = im; mesh.userData.idx = i;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), HIT); hit.position.y = 0.32; g.add(hit); targets.push({ g, mesh, hit, row, u: i / row.n, down: 0, pts: row.pts }); } }
  const gstar = new THREE.Group(), gm = new THREE.Mesh(shapeGeo('star'), gold()); gm.scale.setScalar(1.3); gstar.add(gm); const gh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), HIT); gstar.add(gh); root.add(gstar);
  const golden = { g: gstar, mesh: gm, hit: gh, row: { y: 4.0 }, u: 0, down: 0, pts: 10, golden: true, t: 0 }; targets.push(golden);
  targets.forEach(tg => { tg.hit.userData.target = tg; });

  const S = { playing: false, time: 0, shots: 0, score: 0 };
  const a = attraction({ id: 'gallery', kind: 'game', name: 'Starlight Gallery', icon: '🎯', zone: 'Carnival Lane',
    desc: 'Tin moons, hearts and stars glide along three rails. 20 shots, 30 seconds — and watch for the golden star. 25 points wins a prize.',
    object3D: root, focus: { target: [x, 2.6, z], dist: 9, height: 0.6 } });
  a.hits = [hitBox(root, 8.4, 5.4, 5, 0)];
  a.state = () => ({ playing: S.playing, score: S.score, time: Math.ceil(S.time), shots: 20 - S.shots, best: a.best || 0 });
  a.play = () => { S.playing = true; S.time = 30; S.shots = 0; S.score = 0; for (const tg of targets) tg.down = 0; a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { S.playing = false; a.ui && a.ui.gameUpdate(a); };
  a.capturesPointer = () => S.playing; a.crosshair = true; const rc = new THREE.Raycaster();
  a.pointer = (type, ray) => {
    if (!S.playing) return false; if (type !== 'down' || S.shots >= 20) return true;
    S.shots++; a.sfx && a.sfx.pop && a.sfx.pop();
    rc.ray.copy(ray); const hit = rc.intersectObjects(targets.filter(tg => tg.down <= 0 && tg.g.visible).map(tg => tg.hit), false)[0];
    if (hit) { const tg = hit.object.userData.target; tg.down = tg.golden ? 99 : 2.2; S.score += tg.pts; a.fx && a.fx.sparkles(hit.point, tg.golden ? 50 : 22, tg.golden ? 2 : 1); a.sfx && a.sfx.ding && a.sfx.ding();
      if (tg.golden) a.ui && a.ui.toast('Golden star!', '+10', '⭐'); }
    a.ui && a.ui.gameUpdate(a); if (S.shots >= 20) setTimeout(end, 600); return true;
  };
  a.onPick = () => S.playing;
  function end() { if (!S.playing) return; S.playing = false; a.best = Math.max(a.best || 0, S.score); a.plays = (a.plays || 0) + 1; const won = S.score >= 25;
    a.ui && (a.ui.toast(won ? 'You won a prize!' : 'Nice shooting!', won ? ['You won {p}!', { p: t('a golden star') }] : ['{n} points', { n: S.score }], '🎯'), a.ui.gameUpdate(a, { result: won ? 'win' : 'lose' }));
    if (won) { a.sfx && a.sfx.fanfare && a.sfx.fanfare(); a.fx && a.fx.hearts(V(0, 2.5, 1.5).applyMatrix4(root.matrixWorld), 36, 1.5); } }
  a.update = (dt) => {
    const d = a.ease(dt);
    if (S.playing) { S.time -= dt; if (Math.floor(S.time + dt) !== Math.floor(S.time)) a.ui && a.ui.gameUpdate(a); if (S.time <= 0) end(); }
    for (const tg of targets) {
      if (tg.golden) { tg.t += dt; const run = (tg.t % 9) / 2.2; tg.g.visible = run < 1 && tg.down <= 0; tg.g.position.set(-4 + run * 8, tg.row.y, -1.4); tg.mesh.rotation.z += dt * 6; if (tg.down > 0 && tg.t % 9 > 8.8) tg.down = 0; continue; }
      tg.u = (tg.u + tg.row.sp * dt * 0.12 * (0.4 + 0.6 * d) + 1) % 1; tg.g.position.set(-3.5 + tg.u * 7, tg.row.y, -1.55);
      tg.down = Math.max(-1, tg.down - dt); tg.mesh.rotation.x = tg.down > 0 ? Math.min(PI / 2, (2.2 - tg.down) * 8) : 0;
      tg.g.updateMatrix(); tg.mesh.updateMatrix(); tg.mesh.userData.im.setMatrixAt(tg.mesh.userData.idx, _mm.multiplyMatrices(tg.g.matrix, tg.mesh.matrix));
    }
    for (const im of rails) im.instanceMatrix.needsUpdate = true;
  };
  void rand; void R; void matte;
  return a;
}
