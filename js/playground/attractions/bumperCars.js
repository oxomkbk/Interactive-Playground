/* =========================================================================
   BUMPER BONANZA — an open-sided pavilion: a glossy plum floor with a painted grid, a padded rose bumper
   wall on gold posts, a striped canopy roof with rows of bulbs and the classic electric ceiling. Eight
   chubby pastel cars wander with steering noise, avoid the walls, collide properly (circle–circle, mass
   exchange along the contact normal), spin a little and hop when they bump — with a sparkle on impact.
   Draws: pavilion (merged) · bulbs · car bodies · rubber rings · poles (instanced).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, canvasTex, R, rand } from '../core/geo.js';
import { paint, gold, stone, fabric, bulb, silver, matte } from '../core/materials.js';
import { attraction, hitBox } from './base.js';
import { damp } from '../core/mood.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const floorTex = () => canvasTex(512, 512, (g, n) => { g.fillStyle = '#3A2850'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(255,200,230,.25)'; g.lineWidth = 3;
  for (let i = 0; i <= n; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); }
  g.fillStyle = 'rgba(255,214,138,.5)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 2.5, 0, TAU); g.fill(); } });

export function create({ x, z, w: AW = 18, d: AD = 13, cars: N = 8, lights } = {}) {
  const root = new THREE.Group(); root.name = 'bumper'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const gd = gold(), c = { cast: true }, H = 5.2;
  const B = createBatch('bumper');
  B.add(rbox(AW + 2, 0.4, AD + 2, 0.15), stone(3, '#E3D6C8'), [0, 0.2, 0], c);
  const fm = new THREE.MeshPhysicalMaterial({ map: floorTex(), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }); fm.map.repeat.set(3, 2);
  B.add(new THREE.PlaneGeometry(AW, AD).rotateX(-PI / 2), fm, [0, 0.42, 0]);
  // padded bumper wall on posts, with an opening at the front
  const pad = paint('#F28FAF', 0.6);
  for (const [sx, sz, len, rot] of [[0, -AD / 2, AW, 0], [-AW / 2, 0, AD, PI / 2], [AW / 2, 0, AD, PI / 2], [-AW / 4 - 1, AD / 2, AW / 2 - 2, 0], [AW / 4 + 1, AD / 2, AW / 2 - 2, 0]])
    B.add(rbox(len, 0.55, 0.4, 0.18), pad, [sx, 0.75, sz], { rotY: rot, cast: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(rodGeo(V(sx * (AW / 2 + 0.4), 0.4, sz * (AD / 2 + 0.4)), V(sx * (AW / 2 + 0.4), H, sz * (AD / 2 + 0.4)), 0.14, 12), gd, null, c);
  for (const sx of [-1, 0, 1]) B.add(rodGeo(V(sx * AW / 3, 0.4, -(AD / 2 + 0.4)), V(sx * AW / 3, H, -(AD / 2 + 0.4)), 0.1, 10), gd, null, c);
  // roof: striped hip canopy, ceiling grid
  B.add(new THREE.ConeGeometry(Math.hypot(AW, AD) / 2 + 1.2, 3.2, 4, 1, true).rotateY(PI / 4).scale(1, 1, AD / AW), fabric('#C8A2E8', '#FFF5E1', 12, 2, 1), [0, H + 1.6, 0], c);
  B.add(new THREE.BoxGeometry(AW + 1.2, 0.35, AD + 1.2), paint('#FFF5E1', 0.5), [0, H, 0], c);
  for (let i = -3; i <= 3; i++) B.add(new THREE.BoxGeometry(0.04, 0.04, AD), silver(), [i * AW / 7, H - 0.25, 0]);
  B.add(heartGeo(0.8, 0.3), gd, [0, H + 3.6, 0]);
  B.build(root);
  const NB = 70, bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), bulb('#FFE2B8', 3.2), NB);
  for (let i = 0; i < NB; i++) { const u = i / NB, per = 2 * (AW + AD), d = u * per; let px, pz;
    if (d < AW) { px = -AW / 2 + d; pz = -AD / 2 - 0.62; } else if (d < AW + AD) { px = AW / 2 + 0.62; pz = -AD / 2 + d - AW; } else if (d < 2 * AW + AD) { px = AW / 2 - (d - AW - AD); pz = AD / 2 + 0.62; } else { px = -AW / 2 - 0.62; pz = AD / 2 - (d - 2 * AW - AD); }
    bl.setMatrixAt(i, _m.makeTranslation(px, H - 0.1, pz)); } root.add(bl);

  // cars
  const body = rbox(1.5, 0.6, 2.0, 0.28).translate(0, 0.55, 0), ring = new THREE.TorusGeometry(1.15, 0.16, 8, 32).rotateX(PI / 2).scale(0.82, 1, 1.05).translate(0, 0.35, 0), pole = new THREE.CylinderGeometry(0.035, 0.035, H - 1.0, 5).translate(0, (H - 1.0) / 2 + 0.6, -0.75);
  const bodies = new THREE.InstancedMesh(body, paint('#ffffff', 0.25), N), rings = new THREE.InstancedMesh(ring, matte('#3A2F4A', 0.6), N), poles = new THREE.InstancedMesh(pole, silver(), N);
  const cols = ['#FFB3C6', '#A0D8F1', '#A8E6CF', '#FFD68A', '#C8A2E8', '#FFAD91', '#F7D3DC', '#B9E0F5'];
  for (let i = 0; i < N; i++) bodies.setColorAt(i, new THREE.Color(cols[i]));
  for (const im of [bodies, rings, poles]) { im.castShadow = true; im.frustumCulled = false; root.add(im); }
  const cars = Array.from({ length: N }, (_, i) => ({ p: new THREE.Vector2(R(-AW / 2 + 2, AW / 2 - 2), R(-AD / 2 + 2, AD / 2 - 2)), v: new THREE.Vector2(), h: R(0, TAU), spin: 0, hop: 0, steer: R(0, TAU), i }));
  lights && lights.addLocal(V(x, H - 1, z), '#FFB8E0', 30, 16);

  const a = attraction({ id: 'bumper', name: 'Bumper Bonanza', icon: '🚗', zone: 'Carnival Corner',
    desc: 'Eight chubby pastel bumper cars zipping around a sparkly floor. Watch them bump, bounce and spin!',
    object3D: root, focus: { target: [x, 1, z], dist: 22, height: 13 } });
  a.hits = [hitBox(root, AW + 2, H + 3, AD + 2, 0)];
  const CR = 1.05, wall = V(AW / 2 - CR, 0, AD / 2 - CR), w2 = new THREE.Vector2();
  a.update = (dt, t) => {
    const d = a.ease(dt), speed = 3.2 * d;
    for (const car of cars) {
      const me = P.driving && car.i === 0;
      if (me) { const th = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 0.6 : 0), st2 = (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) - (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0);
        car.h += st2 * 2.4 * dt + car.spin * dt; car.spin = damp(car.spin, 0, 2, dt); w2.set(Math.sin(car.h), Math.cos(car.h)).multiplyScalar(th * 5.2); }
      else { car.steer += R(-1.2, 1.2) * dt; car.h += Math.sin(car.steer) * 1.4 * dt * d + car.spin * dt; car.spin = damp(car.spin, 0, 2, dt);
      w2.set(Math.sin(car.h), Math.cos(car.h)).multiplyScalar(speed); } car.v.lerp(w2, 1 - Math.exp(-1.6 * dt)); car.p.addScaledVector(car.v, dt);
      if (Math.abs(car.p.x) > wall.x) { car.p.x = Math.sign(car.p.x) * wall.x; car.v.x *= -0.6; car.h = Math.atan2(car.v.x, car.v.y) + R(-0.5, 0.5); car.hop = 1; }
      if (Math.abs(car.p.y) > wall.z) { car.p.y = Math.sign(car.p.y) * wall.z; car.v.y *= -0.6; car.h = Math.atan2(car.v.x, car.v.y) + R(-0.5, 0.5); car.hop = 1; }
      car.hop = Math.max(0, car.hop - dt * 3);
    }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const A = cars[i], Bc = cars[j], dx = Bc.p.x - A.p.x, dz = Bc.p.y - A.p.y, dist = Math.hypot(dx, dz);
      if (dist < CR * 2 && dist > 1e-4) { const nx = dx / dist, nz = dz / dist, over = CR * 2 - dist; A.p.x -= nx * over / 2; A.p.y -= nz * over / 2; Bc.p.x += nx * over / 2; Bc.p.y += nz * over / 2;
        const rel = (A.v.x - Bc.v.x) * nx + (A.v.y - Bc.v.y) * nz;
        if (rel > 0) { const k = rel * 0.95; A.v.x -= k * nx; A.v.y -= k * nz; Bc.v.x += k * nx; Bc.v.y += k * nz; A.spin += R(-3, 3); Bc.spin += R(-3, 3); A.hop = Bc.hop = 1;
          if (P.driving && (A.i === 0 || Bc.i === 0) && rel > 0.8) { P.score++; a.sfx && a.sfx.clink && a.sfx.clink(); a.ui && a.ui.gameUpdate(a); }
          if (rel > 1.2 && a.fx) { const wp = V(A.p.x + nx * CR, 1, A.p.y + nz * CR).applyMatrix4(root.matrixWorld); a.fx.sparkles(wp, 10, 1.2); } } } }
    cars.forEach((car, i) => { const hop = Math.sin(car.hop * PI) * 0.12; _m.compose(_p.set(car.p.x, 0.42 + hop, car.p.y), _q.setFromEuler(_e.set(hop * 0.4, car.h, 0)), _s); bodies.setMatrixAt(i, _m); rings.setMatrixAt(i, _m);
      poles.setMatrixAt(i, _m.compose(_p, _q.setFromEuler(_e.set(0, car.h, 0)), _s)); });
    bodies.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = poles.instanceMatrix.needsUpdate = true;
  };
  // Drive: take the wheel of the pink car for 60 seconds; every solid bump scores
  const P = { driving: false, score: 0, time: 0 }, held = new Set(), keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  addEventListener('keydown', e => { if (P.driving && keys.includes(e.code)) { held.add(e.code); e.preventDefault(); } });
  addEventListener('keyup', e => held.delete(e.code));
  a.playLabel = 'Drive';
  a.state = () => ({ playing: P.driving, score: P.score, time: Math.ceil(P.time), best: a.best || 0 });
  a.play = () => { P.driving = true; P.score = 0; P.time = 60; a.setRunning(true); a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { P.driving = false; held.clear(); a.ui && a.ui.gameUpdate(a); };
  const baseUpdate = a.update;
  a.update = (dt, t) => { baseUpdate(dt, t); if (!P.driving) return; P.time -= dt; if (Math.floor(P.time + dt) !== Math.floor(P.time)) a.ui && a.ui.gameUpdate(a);
    if (P.time <= 0) { P.driving = false; held.clear(); a.best = Math.max(a.best || 0, P.score); a.plays = (a.plays || 0) + 1; a.ui && (a.ui.toast('Time!', ['{n} bumps — nice driving!', { n: P.score }]), a.ui.gameUpdate(a, { result: P.score >= 8 ? 'win' : 'lose' })); if (P.score >= 8) a.sfx && a.sfx.fanfare && a.sfx.fanfare(); } };
  // ride view: a chase camera behind (and above) the pink car
  a.rideCam = (pos, look) => { const c = cars[0], fx = Math.sin(c.h), fz = Math.cos(c.h); root.localToWorld(pos.set(c.p.x - fx * 4.2, 2.6, c.p.y - fz * 4.2)); root.localToWorld(look.set(c.p.x + fx * 3, 0.8, c.p.y + fz * 3)); };
  return a;
}
