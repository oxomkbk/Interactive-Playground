/* =========================================================================
   CLAW ARCADE — a little pavilion with two claw machines (glass cases, glowing marquees, pastel cabinets)
   full of plush bears and bunnies. The left machine is playable: press Play, steer the claw with the arrow
   keys / WASD or the on-screen pad, press GRAB (or Space). The claw drops, closes, lifts — a good grab
   carries the plush to the prize chute and it pops out to you with hearts. Three tries per game.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R, rand, pick, canvasTex } from '../core/geo.js';
import { paint, gold, silver, glass, fabric, bulb, signMat } from '../core/materials.js';
import { sign } from '../core/textures.js';
import { attraction, hitBox } from './base.js';
import { damp } from '../core/mood.js';
import { t, onLang } from '../i18n.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
const PLUSH = [['bunny', '#FFB3C6'], ['bear', '#C9A27E'], ['bear', '#C8A2E8'], ['bunny', '#FFF5E1'], ['bear', '#A0D8F1'], ['bunny', '#A8E6CF'], ['bear', '#FFD68A']];
function plushGeo() { // a sitting plush: body, head, ears (bunny ears are tall; we scale per instance kind via two geometries)
  const P = (g, x, y, z, sx = 1, sy = 1, sz = 1) => g.scale(sx, sy, sz).translate(x, y, z).toNonIndexed();
  const base = [P(new THREE.SphereGeometry(0.12, 12, 10), 0, 0.12, 0, 1, 1.05, 0.95), P(new THREE.SphereGeometry(0.1, 12, 10), 0, 0.3, 0.01), P(new THREE.SphereGeometry(0.04, 8, 6), 0.08, 0.06, 0.06), P(new THREE.SphereGeometry(0.04, 8, 6), -0.08, 0.06, 0.06)];
  return { bear: mergeGeometries([...base, P(new THREE.SphereGeometry(0.035, 8, 6), 0.07, 0.39, 0), P(new THREE.SphereGeometry(0.035, 8, 6), -0.07, 0.39, 0)]),
    bunny: mergeGeometries([...base, P(new THREE.SphereGeometry(0.03, 8, 6), 0.045, 0.45, 0, 1, 3, 1), P(new THREE.SphereGeometry(0.03, 8, 6), -0.045, 0.45, 0, 1, 3, 1)]) };
}

function machine(root, ox, color, marqueeText) {
  const g = new THREE.Group(); g.position.set(ox, 0, 0); root.add(g);
  const B = createBatch('claw-machine'), c = { cast: true }, gd = gold();
  B.add(rbox(1.7, 1.2, 1.7, 0.12), paint(color, 0.35), [0, 0.9, 0], c);
  B.add(rbox(1.75, 0.08, 1.75, 0.03), gd, [0, 1.52, 0]);
  B.add(new THREE.BoxGeometry(1.55, 0.06, 1.55), paint('#FFF5E1', 0.6), [0, 1.53, 0]);
  B.add(rbox(1.7, 0.45, 1.7, 0.1), paint(color, 0.35), [0, 3.35, 0], c);
  for (const sx of [-0.82, 0.82]) for (const sz of [-0.82, 0.82]) B.add(rodGeo(V(sx, 1.5, sz), V(sx, 3.15, sz), 0.035, 6), gd);
  B.add(rbox(0.5, 0.5, 0.5, 0.05), paint('#FFFFFF', 0.4), [0.5, 1.8, 0.5]); // prize chute
  B.add(new THREE.PlaneGeometry(0.4, 0.3), paint('#2A1B3D', 0.6), [0.5, 0.75, 0.86]);
  B.add(rbox(0.6, 0.1, 0.3, 0.04), paint('#FFF5E1', 0.4), [-0.3, 1.45, 0.95]); B.add(new THREE.SphereGeometry(0.06, 10, 8), paint('#F28FAF', 0.3), [-0.4, 1.56, 0.95]); B.add(new THREE.SphereGeometry(0.05, 10, 8), paint('#FFD68A', 0.3), [-0.15, 1.53, 0.95]);
  B.build(g);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.6, 1.62), glass('#E8F2FF', 0.16)); gl.position.y = 2.36; g.add(gl);
  const mk = () => sign(t(marqueeText), { w: 1024, h: 256, size: 110, fg: '#7A4FA8', bg: '#FFF5E1' }), mm = signMat(mk(), 0.9);
  const mq = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.37), mm); mq.position.set(0, 3.36, 0.86); g.add(mq); onLang(() => { mm.map = mm.emissiveMap = mk(); mm.needsUpdate = true; });
  // claw rig
  const rig = new THREE.Group(); rig.position.set(0, 3.05, 0); g.add(rig);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, -0.5, 0), silver()); rig.add(cable);
  const head = new THREE.Group(); rig.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), gold()));
  const prongs = [0, 1, 2].map(k => { const p = new THREE.Group(); p.rotation.y = k / 3 * TAU; head.add(p); const arm = new THREE.Mesh(rodGeo(V(0, 0, 0), V(0, -0.2, 0.09), 0.015, 5).toNonIndexed(), silver()); const tip = new THREE.Mesh(rodGeo(V(0, -0.2, 0.09), V(0, -0.27, 0.02), 0.015, 5), silver()); const hinge = new THREE.Group(); hinge.add(arm, tip); p.add(hinge); return hinge; });
  return { g, rig, cable, head, prongs };
}

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'claw'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const c = { cast: true }, gd = gold(), B = createBatch('arcade');
  B.add(rbox(6.4, 0.25, 4.6, 0.08), new THREE.MeshPhysicalMaterial({ map: checker(), roughness: 0.3, clearcoat: 0.8 }), [0, 0.13, 0], c);
  for (const sx of [-3, 3]) for (const sz of [-2.1, 2.1]) B.add(rodGeo(V(sx, 0.25, sz), V(sx, 4.2, sz), 0.08, 8), gd, null, c);
  B.add(new THREE.ConeGeometry(4.7, 1.6, 4, 1, true).rotateY(PI / 4).scale(1, 1, 0.75), fabric('#C8A2E8', '#FFF5E1', 12, 2, 1), [0, 5.0, 0], c);
  B.add(new THREE.BoxGeometry(6.4, 0.3, 4.6), paint('#FFF5E1', 0.5), [0, 4.25, 0], c);
  B.add(heartGeo(0.5, 0.2), gd, [0, 6.0, 0]);
  B.build(root);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), bulb('#FFE2B8', 3), 40);
  for (let i = 0; i < 40; i++) { const u = i / 40, side = Math.floor(u * 4), f = (u * 4) % 1, p = [[-3.2 + f * 6.4, 2.3], [3.2, 2.3 - f * 4.6], [3.2 - f * 6.4, -2.3], [-3.2, -2.3 + f * 4.6]][side]; bl.setMatrixAt(i, _m.makeTranslation(p[0], 4.05, p[1])); }
  root.add(bl);
  const A = machine(root, -1.15, '#F7A8C4', 'Claw of Love'), Bm = machine(root, 1.15, '#A9C8F2', 'Lucky Paws');
  // plush piles in both cases
  const geos = plushGeo(), plush = [];
  const fill = (M, n) => { for (let i = 0; i < n; i++) { const [kind, col] = pick(PLUSH); plush.push({ M, kind, col, p: V(R(-0.62, 0.3), 1.56 + R(0, 0.12), R(-0.62, 0.3)), r: R(0, TAU), alive: true }); } };
  fill(A, 16); fill(Bm, 16);
  const ims = {}; for (const kind of ['bear', 'bunny']) { const list = plush.filter(p => p.kind === kind); const im = new THREE.InstancedMesh(geos[kind], paint('#ffffff', 0.85), list.length); list.forEach((p, i) => { p.im = im; p.i = i; im.setColorAt(i, new THREE.Color(p.col)); }); im.castShadow = true; im.frustumCulled = false; root.add(im); ims[kind] = im; }
  const place = (p) => { _m.compose(V(p.M.g.position.x + p.p.x, p.p.y, p.p.z), _q.setFromEuler(_e.set(0, p.r, 0)), p.alive ? _s.set(1, 1, 1) : V(0, 0, 0)); p.im.setMatrixAt(p.i, _m); p.im.instanceMatrix.needsUpdate = true; };
  plush.forEach(place);

  const S = { playing: false, tries: 0, phase: 'idle', t: 0, held: null, cx: -0.3, cz: -0.3, drop: 0, open: 1, input: { x: 0, z: 0 }, wins: 0 };
  const a = attraction({ id: 'claw', kind: 'game', name: 'Claw Arcade', icon: '🧸', zone: 'Carnival Corner',
    desc: 'Two glowing claw machines full of plush bunnies and bears. Steer the claw, grab a cutie, and take it home!',
    object3D: root, focus: { target: [x, 2.2, z], dist: 6.5, height: 1.2 } });
  a.hits = [hitBox(root, 6.6, 5, 4.8, 0)];
  a.input = S.input;
  a.state = () => ({ playing: S.playing, tries: S.tries, phase: S.phase, wins: S.wins });
  a.play = () => { S.playing = true; S.tries = 3; S.phase = 'move'; a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { S.playing = false; S.phase = 'idle'; a.ui && a.ui.gameUpdate(a); };
  a.grab = () => { if (S.playing && S.phase === 'move') { S.phase = 'drop'; S.t = 0; a.sfx && a.sfx.whir && a.sfx.whir(); } };
  const keyset = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] }, held = new Set();
  addEventListener('keydown', e => { if (!S.playing) return; if (keyset[e.code]) { held.add(e.code); e.preventDefault(); } if (e.code === 'Space') { e.preventDefault(); a.grab(); } });
  addEventListener('keyup', e => held.delete(e.code));

  a.update = (dt, time) => {
    const M = A; let kx = S.input.x, kz = S.input.z; for (const k of held) { kx += keyset[k][0]; kz += keyset[k][1]; }
    if (S.phase === 'move') { S.cx = Math.max(-0.65, Math.min(0.65, S.cx + kx * 0.7 * dt)); S.cz = Math.max(-0.65, Math.min(0.65, S.cz + kz * 0.7 * dt)); S.open = damp(S.open, 1, 6, dt); }
    else if (S.phase === 'drop') { S.drop = Math.min(1.25, S.drop + dt * 0.9); if (S.drop >= 1.25) { S.phase = 'close'; S.t = 0; } }
    else if (S.phase === 'close') { S.t += dt; S.open = damp(S.open, 0, 6, dt);
      if (S.t > 0.6) { // did we catch something? closer to a plush's centre = better odds
        let best = null, bd = 9; for (const p of plush) if (p.M === M && p.alive) { const d = Math.hypot(p.p.x - S.cx, p.p.z - S.cz); if (d < bd) { bd = d; best = p; } }
        S.held = best && bd < 0.2 && rand() < (bd < 0.09 ? 0.85 : 0.55) ? best : null; S.phase = 'lift'; S.t = 0; } }
    else if (S.phase === 'lift') { S.drop = Math.max(0, S.drop - dt * 0.8); if (S.held && S.drop < 0.6 && rand() < dt * 0.25) { S.held = null; a.sfx && a.sfx.clink && a.sfx.clink(); } if (S.drop <= 0) { S.phase = S.held ? 'carry' : 'back'; S.t = 0; } }
    else if (S.phase === 'carry') { S.cx = damp(S.cx, 0.5, 3, dt); S.cz = damp(S.cz, 0.5, 3, dt); if (Math.hypot(S.cx - 0.5, S.cz - 0.5) < 0.03) { S.phase = 'release'; S.t = 0; } }
    else if (S.phase === 'release') { S.t += dt; S.open = damp(S.open, 1, 5, dt); if (S.t > 0.5 && S.held) { const p = S.held; p.alive = false; place(p); S.held = null; S.wins++;
        const wp = V(M.g.position.x + 0.5, 1.0, 1.1).applyMatrix4(root.matrixWorld); a.fx && (a.fx.hearts(wp, 36, 1.2), a.fx.sparkles(wp, 30, 1.5)); a.sfx && a.sfx.fanfare && a.sfx.fanfare();
        a.ui && a.ui.toast('You caught one!', ['A {c} {k} is yours!', { c: t(colorName(p.col)), k: t(p.kind) }]); }
      if (S.t > 1.0) { S.phase = 'back'; } }
    else if (S.phase === 'back') { S.open = damp(S.open, 1, 6, dt); S.tries--; S.phase = S.tries > 0 ? 'move' : 'idle'; if (S.tries <= 0) { S.playing = false; a.ui && a.ui.toast('Game over', 'Thanks for playing!'); } a.ui && a.ui.gameUpdate(a); }
    // idle drift for the decorative machine and an idle playable one
    if (!S.playing && S.phase === 'idle') { S.cx = Math.sin(time * 0.4) * 0.5; S.cz = Math.cos(time * 0.3) * 0.5; }
    pose(M, S.cx, S.cz, S.drop, S.open); pose(Bm, Math.sin(time * 0.5 + 2) * 0.5, Math.cos(time * 0.35) * 0.5, Math.max(0, Math.sin(time * 0.6)) * 0.4, 0.6 + 0.4 * Math.sin(time));
    if (S.held) { S.held.p.set(S.cx, Math.max(1.56, 2.47 - S.drop), S.cz); place(S.held); } // dangling under the claw head
  };
  function pose(M, cx, cz, drop, open) { M.rig.position.set(cx, 3.05, cz); M.cable.scale.y = 0.08 + drop * 1.0; M.head.position.y = -(0.08 + drop * 1.0) - 0.05; for (const h of M.prongs) h.rotation.x = -0.15 - open * 0.55; }
  return a;
}
const colorName = (c) => ({ '#FFB3C6': 'pink', '#C9A27E': 'honey', '#C8A2E8': 'lavender', '#FFF5E1': 'cream', '#A0D8F1': 'sky-blue', '#A8E6CF': 'mint', '#FFD68A': 'golden' }[c] || 'cuddly');
const checker = () => { const tx = canvasTex(256, 256, (g, n) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#FFF5E1' : '#F7C6D6'; g.fillRect(x * 32, y * 32, 32, 32); } }); tx.repeat.set(3, 2); return tx; };
