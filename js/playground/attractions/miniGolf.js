/* =========================================================================
   PETAL PUTT — a mini-golf hole on the western lawn: a velvet-green fairway in carved wooden rails, a
   lavender windmill whose sails sweep across the tunnel, two mushroom bumpers, a little bridge, and a cup with
   a pennant. Gameplay: move to aim (a dotted guide shows the line), hold to wind up, release to putt.
   2D ball physics in the course's plane: rolling friction, wall reflections, bumpers, the windmill (its sails
   block the tunnel when they're down), and the cup (sinks if you're slow enough). Par 3; best score kept.
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R, canvasTex } from '../core/geo.js';
import { paint, gold, wood, stone, fabric, matte, bulb } from '../core/materials.js';
import { attraction, hitBox } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const W = 18, D = 7.5, Y = 0.36;                                   // fairway size (local x along the hole, z across)
const TEE = new THREE.Vector2(-7.5, 0), CUP = new THREE.Vector2(7.6, 1.6), BR = 0.07, CUP_R = 0.13;
const BUMPERS = [{ x: 4.2, z: -1.4, r: 0.45 }, { x: 5.3, z: 2.4, r: 0.4 }];
const MILL = { x: -0.5, half: 1.3, tunnel: 0.7 };                   // windmill house spans x ±half, tunnel |z| < tunnel

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'golf'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z) + PI / 2; // the hole runs across the view
  const c = { cast: true }, B = createBatch('golf');
  const felt = canvasTex(256, 256, (g, n) => { g.fillStyle = '#5FA86E'; g.fillRect(0, 0, n, n); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '20,60,30'},.06)`; g.fillRect(Math.random() * n, Math.random() * n, 1, 2); } });
  felt.repeat.set(6, 3);
  B.add(rbox(W + 1.4, 0.3, D + 1.4, 0.1), stone(2, '#DCCDBD'), [0, 0.15, 0], c);
  B.add(new THREE.PlaneGeometry(W, D).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 }), [0, Y, 0]);
  const rail = wood('#B48A64', 1);
  for (const s of [-1, 1]) { B.add(rbox(W + 0.5, 0.28, 0.25, 0.08), rail, [0, Y + 0.12, s * (D / 2 + 0.12)], c); B.add(rbox(0.25, 0.28, D, 0.08), rail, [s * (W / 2 + 0.12), Y + 0.12, 0], c); }
  // windmill: house with an arched tunnel, a cone roof; the sails are a separate spinning group
  const mill = paint('#C8A2E8', 0.45);
  for (const s of [-1, 1]) B.add(rbox(2.6, 2.4, (D / 2 - MILL.tunnel) - 0.1, 0.1), mill, [MILL.x, Y + 1.2, s * (MILL.tunnel + (D / 2 - MILL.tunnel) / 2)], c);
  B.add(rbox(2.6, 1.0, D - 0.2, 0.1), mill, [MILL.x, Y + 2.9, 0], c);
  B.add(new THREE.ConeGeometry(2.2, 2.2, 4).rotateY(PI / 4).scale(0.9, 1, 2.0), fabric('#FFB3C6', '#FFF5E1', 10, 2, 1), [MILL.x, Y + 4.5, 0], c);
  B.add(heartGeo(0.3, 0.12).rotateY(PI / 2), gold(), [MILL.x, Y + 5.8, 0]);
  // mushroom bumpers, cup rim, flag
  for (const b of BUMPERS) { B.add(new THREE.CylinderGeometry(b.r * 0.55, b.r * 0.7, 0.5, 16), matte('#FFF5E1', 0.6), [b.x, Y + 0.25, b.z], c); B.add(new THREE.SphereGeometry(b.r, 18, 10, 0, TAU, 0, PI / 2), paint('#F28FAF', 0.35), [b.x, Y + 0.45, b.z], c); }
  B.add(new THREE.RingGeometry(CUP_R, CUP_R + 0.05, 24).rotateX(-PI / 2), paint('#FFFFFF', 0.5), [CUP.x, Y + 0.005, CUP.y]);
  B.add(new THREE.CircleGeometry(CUP_R, 24).rotateX(-PI / 2), matte('#1E1A22', 0.9), [CUP.x, Y + 0.004, CUP.y]);
  B.add(rodGeo(V(CUP.x, Y, CUP.y), V(CUP.x, Y + 1.6, CUP.y), 0.02, 6), gold());
  B.add(new THREE.CircleGeometry(0.3, 3).scale(1.2, 0.8, 1), paint('#F28FAF', 0.5), [CUP.x + 0.35, Y + 1.45, CUP.y]);
  B.add(new THREE.CircleGeometry(0.25, 20).rotateX(-PI / 2), paint('#FFF5E1', 0.6), [TEE.x, Y + 0.004, TEE.y]);
  // a scoreboard
  B.add(rbox(2.4, 1.6, 0.15, 0.05), wood('#8A5A44', 1), [-W / 2 + 1.5, 1.6, -D / 2 - 1.2], c); B.add(rodGeo(V(-W / 2 + 1.5, 0, -D / 2 - 1.2), V(-W / 2 + 1.5, 0.8, -D / 2 - 1.2), 0.06, 6), wood('#8A5A44', 1));
  B.build(root);
  const sails = new THREE.Group(); sails.position.set(MILL.x + 1.35, Y + 2.6, 0); root.add(sails);
  const SB = createBatch('sails'); for (let k = 0; k < 4; k++) { SB.add(rbox(0.12, 2.2, 0.6, 0.04).translate(0, 1.2, 0.25).rotateX(k / 4 * TAU), fabric('#FFF5E1', '#F7D3DC', 6, 1, 1), null, c); } SB.add(new THREE.SphereGeometry(0.2, 12, 8), gold(), [0, 0, 0]); SB.build(sails);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 16, 12), paint('#FFFFFF', 0.25)); ball.castShadow = true; root.add(ball);
  const guide = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.05).translate(0.5, 0, 0).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD68A').multiplyScalar(1.6), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false })); guide.visible = false; root.add(guide);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulb('#FFE2B8', 3), 40), m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { const u = i / 40, per = 2 * (W + D), d = u * per; const [bx, bz] = d < W ? [-W / 2 + d, -D / 2 - 0.12] : d < W + D ? [W / 2 + 0.12, -D / 2 + d - W] : d < 2 * W + D ? [W / 2 - (d - W - D), D / 2 + 0.12] : [-W / 2 - 0.12, D / 2 - (d - 2 * W - D)]; bl.setMatrixAt(i, m.makeTranslation(bx, Y + 0.32, bz)); } root.add(bl);

  const S = { playing: false, p: TEE.clone(), v: new THREE.Vector2(), strokes: 0, aim: new THREE.Vector2(1, 0), charging: false, power: 0, chargeT: 0, sunk: false, mill: 0 };
  const a = attraction({ id: 'golf', kind: 'game', name: 'Petal Putt', icon: '⛳', zone: 'Garden Games',
    desc: 'A mini-golf hole past a turning windmill. Aim with the mouse, hold to wind up, release to putt — and time your shot through the sails. Par 3.',
    object3D: root, focus: { target: [x, 0.5, z], dist: 12, height: 17 } });
  a.hits = [hitBox(root, W + 2, 5, D + 2, 0)];
  a.state = () => ({ playing: S.playing, strokes: S.strokes, power: S.power, par: 3, best: a.best || 0 });
  a.play = () => { S.playing = true; S.p.copy(TEE); S.v.set(0, 0); S.strokes = 0; S.sunk = false; a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { S.playing = false; guide.visible = false; a.ui && a.ui.gameUpdate(a); };
  a.capturesPointer = () => S.playing;
  const plane = new THREE.Plane(), _h = new THREE.Vector3();
  a.pointer = (type, ray) => {
    if (!S.playing) return false;
    root.updateMatrixWorld(); plane.setFromNormalAndCoplanarPoint(V(0, 1, 0), V(0, Y, 0).applyMatrix4(root.matrixWorld));
    if (ray.intersectPlane(plane, _h)) { root.worldToLocal(_h); const d = new THREE.Vector2(_h.x - S.p.x, _h.z - S.p.y); if (d.lengthSq() > 1e-4) S.aim.copy(d.normalize()); }
    const still = S.v.lengthSq() < 1e-4 && !S.sunk;
    if (type === 'down' && still) { S.charging = true; S.chargeT = 0; }
    if (type === 'up' && S.charging) { S.charging = false; S.v.copy(S.aim).multiplyScalar(0.6 + S.power * 8.5); S.strokes++; S.power = 0; a.sfx && a.sfx.clink && a.sfx.clink(); a.ui && a.ui.gameUpdate(a); }
    return true;
  };
  a.onPick = () => S.playing;
  function collide() {
    const p = S.p, v = S.v, hx = W / 2 - BR, hz = D / 2 - BR;
    if (Math.abs(p.x) > hx) { p.x = Math.sign(p.x) * hx; v.x *= -0.7; } if (Math.abs(p.y) > hz) { p.y = Math.sign(p.y) * hz; v.y *= -0.7; }
    for (const b of BUMPERS) { const dx = p.x - b.x, dz = p.y - b.z, d = Math.hypot(dx, dz), r = b.r + BR; if (d < r) { const nx = dx / d, nz = dz / d, dot = v.x * nx + v.y * nz; p.set(b.x + nx * r, b.z + nz * r); if (dot < 0) { v.x -= 2 * dot * nx * 0.9; v.y -= 2 * dot * nz * 0.9; } a.sfx && a.sfx.pop && a.sfx.pop(); } }
    // windmill: solid house outside the tunnel; inside the tunnel, a lowered sail is a wall
    const inX = Math.abs(p.x - MILL.x) < MILL.half + BR;
    if (inX) { const blocked = Math.abs(p.y) > MILL.tunnel - BR || Math.cos(S.mill * 4) > 0.75;
      if (blocked) { const fromLeft = v.x > 0 ? -1 : 1; p.x = MILL.x + fromLeft * (MILL.half + BR + 0.01); v.x *= -0.6; v.y *= 0.8; } }
  }
  a.update = (dt, t) => {
    S.mill += dt * 0.9 * a.ease(dt); sails.rotation.x = S.mill;
    if (S.charging) { S.chargeT += dt; S.power = 0.5 - 0.5 * Math.cos(S.chargeT * 2.2); a.ui && a.ui.power && a.ui.power(S.power); }
    // integrate in small steps so a hard putt can't tunnel through walls
    const n = Math.ceil(S.v.length() * dt / 0.03) || 1;
    for (let i = 0; i < n; i++) { const h = dt / n; S.p.addScaledVector(S.v, h); const sp = S.v.length(); if (sp > 0) S.v.multiplyScalar(Math.max(0, sp - 1.6 * h) / sp); collide();
      const dc = S.p.distanceTo(CUP); if (!S.sunk && dc < CUP_R && S.v.length() < 3.2) { S.sunk = true; S.v.set(0, 0); finish(); } }
    ball.position.set(S.p.x, Y + BR - (S.sunk ? 0.12 : 0), S.p.y);
    guide.visible = S.playing && S.v.lengthSq() < 1e-4 && !S.sunk; if (guide.visible) { guide.position.set(S.p.x, Y + 0.01, S.p.y); guide.rotation.y = -Math.atan2(S.aim.y, S.aim.x); guide.scale.x = 1 + S.power * 3; }
    void t;
  };
  function finish() {
    const s = S.strokes, word = s === 1 ? 'Hole in one!' : s < 3 ? 'Birdie!' : s === 3 ? 'Par' : 'Bogey', wp = V(CUP.x, Y + 0.4, CUP.y).applyMatrix4(root.matrixWorld);
    a.best = a.best ? Math.min(a.best, s) : s; a.plays = (a.plays || 0) + 1; S.playing = false;
    a.fx && (a.fx.sparkles(wp, 40, 1.5), s <= 3 && a.fx.hearts(wp, 30, 1)); a.sfx && (s <= 3 ? a.sfx.fanfare && a.sfx.fanfare() : a.sfx.ding && a.sfx.ding());
    a.ui && (a.ui.toast(word, ['{n} strokes · par 3', { n: s }], '⛳'), a.ui.gameUpdate(a, { result: s <= 3 ? 'win' : 'lose' }));
  }
  return a;
}
