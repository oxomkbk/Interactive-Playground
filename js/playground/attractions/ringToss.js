/* =========================================================================
   RING TOSS — a carnival stall: wooden counter, candy-striped awning with a scalloped valance and bulbs,
   a glowing sign, shelves of plush prizes, and a stepped stand of fifteen coloured glass bottles.
   Game: press Play, then click a bottle to throw a ring at it. Five rings per round; front-row bottles are
   easier than the back. A ringer drops onto the neck; a miss clatters onto the stand. Three ringers wins
   a plush — with a burst of hearts.
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R, rand, pick } from '../core/geo.js';
import { paint, gold, wood, fabric, bulb, plaster, signMat, matte } from '../core/materials.js';
import { sign } from '../core/textures.js';
import { attraction, hitBox, hitSphere } from './base.js';
import { t, onLang } from '../i18n.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const PRIZES = ['a pink bunny', 'a lavender bear', 'a mint dino', 'a golden star', 'a heart pillow'];

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'ringToss'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const gd = gold(), c = { cast: true }, B = createBatch('ring-booth');
  B.add(rbox(6.4, 0.3, 4.6, 0.1), wood('#B48A64', 2), [0, 0.15, 0], c);
  B.add(rbox(6, 1.1, 0.5, 0.1), wood('#C99A72', 1), [0, 0.85, 2.0], c); B.add(rbox(6.2, 0.12, 0.7, 0.04), paint('#F28FAF', 0.4), [0, 1.45, 2.0]);
  B.add(rbox(6, 3.6, 0.3, 0.1), plaster('#FFE4EC', 1), [0, 2.1, -2.1], c);
  for (const sx of [-2.9, 2.9]) for (const sz of [-2.0, 2.0]) B.add(rodGeo(V(sx, 0.3, sz), V(sx, 3.8, sz), 0.08, 8), gd, null, c);
  const aw = fabric('#F28FAF', '#FFF5E1', 14, 2, 1);
  B.add(new THREE.PlaneGeometry(6.6, 4.8).rotateX(-PI / 2 + 0.18), aw, [0, 4.0, 0], c);
  for (let i = 0; i < 13; i++) B.add(new THREE.CircleGeometry(0.26, 10, PI, PI), aw, [-3.1 + i * 0.52, 3.55, 2.42]);
  // prize shelves with plush
  for (const y of [1.6, 2.6]) B.add(rbox(5.4, 0.1, 0.5, 0.03), wood('#8A5A44', 1), [0, y, -1.8]);
  const plushCols = ['#FFB3C6', '#C8A2E8', '#A8E6CF', '#FFD68A', '#A0D8F1'];
  for (const y of [1.65, 2.65]) for (let i = 0; i < 7; i++) { const px = -2.3 + i * 0.77, col = plushCols[(i + y * 3) % 5 | 0], m = matte(col, 0.95);
    B.add(new THREE.SphereGeometry(0.22, 12, 10), m, [px, y + 0.24, -1.75]); B.add(new THREE.SphereGeometry(0.17, 12, 10), m, [px, y + 0.56, -1.72]);
    for (const s of [-1, 1]) B.add(new THREE.SphereGeometry(0.06, 8, 6), m, [px + s * 0.11, y + 0.72, -1.72]); }
  // stepped bottle stand
  for (let r = 0; r < 4; r++) B.add(rbox(3.6 - r * 0.6, 0.3, 0.6, 0.05), paint('#FFF5E1', 0.5), [0, 0.95 + r * 0.32, 0.1 - r * 0.5], c);
  B.build(root);
  const st0 = () => sign(t('Ring Toss'), { w: 1024, h: 256, size: 130, fg: '#C8577E' }), sm = signMat(st0(), 1.4);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), sm); board.position.set(0, 4.55, 2.35); board.rotation.x = -0.18; root.add(board);
  onLang(() => { sm.map = sm.emissiveMap = st0(); sm.needsUpdate = true; });
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), bulb('#FFE2B8', 3), 26), mm = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) bl.setMatrixAt(i, mm.makeTranslation(-3.2 + i * 0.256, 3.62, 2.46)); root.add(bl);
  // bottles: 5 + 4 + 3 + 2 + 1 rows on the steps
  const bottleGeo = mergeBottle(), slots = [];
  for (let r = 0; r < 4; r++) { const n = 5 - r; for (let i = 0; i < n; i++) slots.push({ p: V((i - (n - 1) / 2) * 0.62, 1.1 + r * 0.32, 0.1 - r * 0.5), row: r }); }
  slots.push({ p: V(0, 1.1 + 4 * 0.32, 0.1 - 4 * 0.5 + 0.2), row: 4 });
  const bottles = new THREE.InstancedMesh(bottleGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.05, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1, envMapIntensity: 1.6 }), slots.length);
  const bc = ['#A8E6CF', '#A0D8F1', '#FFB3C6', '#C8A2E8', '#FFD68A'];
  slots.forEach((s, i) => { bottles.setMatrixAt(i, mm.makeTranslation(s.p.x, s.p.y, s.p.z)); bottles.setColorAt(i, new THREE.Color(bc[i % 5])); s.pick = hitSphere(root, 0.28, s.p.clone().add(V(0, 0.4, 0))); s.pick.userData.bottle = i; });
  bottles.castShadow = true; root.add(bottles);
  // the rings in play
  const ringGeo = new THREE.TorusGeometry(0.17, 0.035, 8, 24).rotateX(PI / 2), rings = [];
  const ringMats = [paint('#F28FAF', 0.3), gold(), paint('#A0D8F1', 0.3)];

  const S = { playing: false, left: 0, score: 0, flying: [] };
  const a = attraction({ id: 'ringToss', kind: 'game', name: 'Ring Toss', icon: '💍', zone: 'Carnival Corner',
    desc: 'Aim at a bottle, hold to wind up, release at the right power. Front bottles want a gentle toss, the back row a strong one. Three ringers wins a plush!',
    object3D: root, focus: { target: [x, 1.4, z], dist: 9, height: 2.6 } });
  a.hits = [hitBox(root, 6.6, 4.6, 4.8, 0)]; a.pickables = slots.map(s => s.pick);
  a.state = () => ({ playing: S.playing, rings: S.left, score: S.score, power: S.power, best: a.best || 0 });
  a.play = () => { for (const r of rings) root.remove(r); rings.length = 0; S.playing = true; S.left = 5; S.score = 0; a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { S.playing = false; a.ui && a.ui.gameUpdate(a); };
  // aiming: a glowing reticle rides a vertical plane just in front of the bottles
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.17, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD68A').multiplyScalar(2), transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
  reticle.renderOrder = 10; reticle.visible = false; root.add(reticle);
  const aimPlane = new THREE.Plane(), _n = new THREE.Vector3(), _hit = new THREE.Vector3(), aim = V(0, 1.6, -0.4);
  S.power = 0; S.charging = false; S.chargeT = 0;
  a.capturesPointer = () => S.playing;
  a.pointer = (type, ray) => {
    if (!S.playing) return false;
    root.updateMatrixWorld(); _n.set(0, 0, 1).transformDirection(root.matrixWorld); aimPlane.setFromNormalAndCoplanarPoint(_n, V(0, 0, 0.6).applyMatrix4(root.matrixWorld));
    if (ray.intersectPlane(aimPlane, _hit)) { root.worldToLocal(_hit); aim.set(Math.max(-1.6, Math.min(1.6, _hit.x)), Math.max(1.0, Math.min(2.8, _hit.y)), 0.6); reticle.position.copy(aim); reticle.visible = true; }
    if (type === 'down' && S.left > 0 && !S.flying.length) { S.charging = true; S.chargeT = 0; }
    if (type === 'up' && S.charging) { S.charging = false; throwRing(); }
    return true;
  };
  // the reticle's height picks the row (higher = further back); power decides how far the ring flies
  function throwRing() {
    const depth = Math.max(0, Math.min(1, (aim.y - 1.1) / 1.6)), wantZ = 0.1 - depth * 2.0;              // the row you're aiming at
    const ideal = 0.35 + depth * 0.45, err = S.power - ideal, landZ = wantZ - err * 2.6, landX = aim.x + R(-0.06, 0.06);
    let best = null, bd = 9; for (const sl of slots) { const d = Math.hypot(sl.p.x - landX, sl.p.z - landZ); if (d < bd) { bd = d; best = sl; } }
    const ok = bd < 0.17, ring = new THREE.Mesh(ringGeo, pick(ringMats)); ring.castShadow = true; root.add(ring); rings.push(ring);
    const from = V(aim.x * 0.4, 1.7, 3.2), to = ok ? best.p.clone().add(V(0, 0.32, 0)) : V(landX, best ? best.p.y + 0.05 : 1.0, landZ);
    S.flying.push({ ring, from, to, mid: from.clone().lerp(to, 0.5).add(V(0, 0.9 + S.power * 1.2, 0)), t: 0, ok, slot: best, power: S.power }); S.left--; S.power = 0;
    a.sfx && a.sfx.whoosh && a.sfx.whoosh(); a.ui && a.ui.gameUpdate(a);
  }
  a.onPick = () => S.playing; // while playing, clicks belong to the throw (handled in pointer)
  a.update = (dt, time) => {
    if (S.charging) { S.chargeT += dt; S.power = 0.5 - 0.5 * Math.cos(S.chargeT * 2.6); a.ui && a.ui.power && a.ui.power(S.power); } // the meter swings: release at the right moment
    reticle.visible = S.playing; if (S.playing) reticle.lookAt(reticle.getWorldPosition(new THREE.Vector3()).add(V(0, 0, 1).transformDirection(root.matrixWorld)));
    for (let i = S.flying.length - 1; i >= 0; i--) { const f = S.flying[i]; f.t = Math.min(1, f.t + dt / 0.75); const u = f.t, p = new THREE.Vector3();
      p.copy(f.from).multiplyScalar((1 - u) ** 2).addScaledVector(f.mid, 2 * u * (1 - u)).addScaledVector(f.to, u * u); f.ring.position.copy(p); f.ring.rotation.set(Math.sin(u * 9) * 0.5, u * 14, 0);
      if (f.t >= 1) { S.flying.splice(i, 1); f.ring.rotation.set(f.ok ? 0 : R(0.6, 1.2), 0, f.ok ? 0 : R(-0.4, 0.4));
        const wp = f.to.clone().applyMatrix4(root.matrixWorld);
        if (f.ok) { S.score++; a.fx && a.fx.sparkles(wp, 26, 1.2); a.sfx && a.sfx.ding && a.sfx.ding(); a.ui && a.ui.toast('Ringer!', ['{n} of 5', { n: S.score }]); } else a.sfx && a.sfx.clink && a.sfx.clink();
        a.ui && a.ui.gameUpdate(a);
        if (S.left === 0 && !S.flying.length) setTimeout(() => finish(), 700); } }
    void time;
  };
  function finish() {
    const won = S.score >= 3, wp = V(0, 2.4, 1.5).applyMatrix4(root.matrixWorld); S.playing = false; a.best = Math.max(a.best || 0, S.score); a.plays = (a.plays || 0) + 1;
    if (won) { const prize = pick(PRIZES); a.fx && (a.fx.hearts(wp, 40, 1.4), a.fx.sparkles(wp, 40, 2)); a.sfx && a.sfx.fanfare && a.sfx.fanfare(); a.ui && a.ui.toast('You won a prize!', ['You won {p}!', { p: t(prize) }]); a.wins = (a.wins || 0) + 1; }
    else a.ui && a.ui.toast('So close!', ['{n} ringers — try again!', { n: S.score }]);
    a.ui && a.ui.gameUpdate(a, { result: won ? 'win' : 'lose' });
  }
  return a;
}

function mergeBottle() {
  const prof = [[0, 0], [0.16, 0], [0.18, 0.05], [0.18, 0.32], [0.12, 0.42], [0.06, 0.48], [0.06, 0.62], [0.075, 0.64], [0, 0.65]].map(([a, b]) => new THREE.Vector2(a, b));
  return new THREE.LatheGeometry(prof, 18);
}
