import * as THREE from 'three';
import { $, PI, R, TAU, V3, clamp, damp, hdr, lerp, pick, rand, yawTo } from '../core/utils.js';
import { cnv, signTex, toTex } from '../core/textures.js';
import { FX_OBJECTS, camera, pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { waterMat } from '../core/shaders.js';
import { Batcher, PAL_SPOOK, PAL_WARM, PLATFORMS, SB, addBox, addCircle, addInteract, addPool, addPumpkin, addTomb, boxGeo, cylBetween, makeBulbs, onUpdate, scaleUV, wallBox } from '../core/registry.js';
import { PUMPKIN_GEO, bigPumpkin, groundAt } from './landscape.js';
import { RIDES } from './rides.js';
import { HOUSE } from './manor.js';
import { FW, fireworksShow } from './atmosphere.js';
import { AU } from '../core/audio.js';
import { S, SCORES, boardRide, endGame, keys, player, ray, saveScores } from '../game/play.js';
import { fade, floater, showCard, toast } from '../ui/ui.js';
import { t } from '../core/i18n.js';
import { saveNow } from '../core/save.js';
import { onDoneCount } from '../ui/onboarding.js';
import { mine, show } from '../game/pyro.js';

/* =========================================================================
   6b. MORE ATTRACTIONS — Gallows Drop, Coffin Cars, Grave Danger, Pumpkin Chuck
   ========================================================================= */
function makeSign(text, w, h, x, y, z, ry, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, o), transparent: true, color: hdr(0xffffff, 1.5), depthWrite: false }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}
// Floating "RIDE / PLAY / ENTER" markers + pulsing ground rings so every attraction is easy to find from afar
const MARKERS = [], _mkTex = {};
function markerTex(label, color) {
  const key = t(label) + color;
  if (!_mkTex[key]) { const [c, g] = cnv(256, 128), col = '#' + new THREE.Color(color).getHexString();
    g.fillStyle = 'rgba(10,6,14,.78)'; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.roundRect(28, 14, 200, 64, 32); g.fill(); g.stroke();
    g.fillStyle = col; g.font = '600 38px Palatino Linotype, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 14; g.fillText(t(label), 128, 47, 186);
    g.beginPath(); g.moveTo(108, 84); g.lineTo(148, 84); g.lineTo(128, 112); g.closePath(); g.fill(); _mkTex[key] = toTex(c, { repeat: false }); }
  return _mkTex[key];
}
function relabelMarkers() { for (const m of MARKERS) { m.sp.material.map = markerTex(m.label, m.color); m.sp.material.needsUpdate = true; } }
function addMarker(x, z, label, color) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex(label, color), color: hdr(0xffffff, 1.15), depthWrite: false, transparent: true })); sp.scale.set(1.9, 0.95, 1); scene.add(sp);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.set(x, 0.08 + groundAt(x, z), z); scene.add(ring); FX_OBJECTS.push(ring);
  MARKERS.push({ sp, ring, x, z, ph: rand() * 6, label, color });
}
function updateMarkers(dt, t) {
  const show = S.mode === 'roam' && S.markers !== false;
  for (const m of MARKERS) { const k = 0.5 + 0.5 * Math.sin(t * 3 + m.ph);
    m.sp.position.set(m.x, 3.0 + groundAt(m.x, m.z) + Math.sin(t * 2 + m.ph) * 0.15, m.z); m.sp.visible = show && camera.position.distanceTo(m.sp.position) > 3.2;
    m.ring.visible = show; m.ring.scale.setScalar(1 + k * 0.15); m.ring.material.opacity = 0.4 + k * 0.45; }
}
const ACTIVITIES = [['ferris', 'Ride The Eye'], ['carousel', 'Ride the Carousel Macabre'], ['swing', 'Ride Wraith Wind'], ['coaster', 'Ride the Nightmare Express'], ['drop', 'Survive the Gallows Drop'],
  ['bump', 'Coffin Cars'], ['shoot', 'Spook Shoot'], ['striker', 'Test Your Nerve'], ['whack', 'Grave Danger'], ['toss', 'Pumpkin Chuck'],
  ['manor', 'Escape Hollowmoor Manor'], ['maze', 'Reach the heart of the maze'], ['ghosts', 'Banish 5 ghosts'], ['witch', 'Ring the Bell of Souls'], ['fireworks', 'Light the fireworks'],
  ['circus', 'Watch the Phantom Circus'], ['cups', 'Spin the Cauldron Cups'], ['archery', 'Hex Archery'], ['skullroll', 'Skull Roll'], ['organ', 'Wake the Great Organ'],
  ['king', 'Awaken the Pumpkin King'], ['hayride', 'Ride the Haunted Hayride'], ['brew', "Brew the Witch's Potion"], ['flight', 'Win the broomstick Ring Race'],
  ['lanterns', 'Release the Lantern Festival'], ['ferry', 'Cross on the Styx Ferry'], ['galleon', 'Sail the Ghost Galleon'], ['fishing', 'Bob for Souls'],
  ['hunt', 'Survive the Ghost Hunt'], ['finale', 'Witness the Grand Finale']];
function markDone(k) { if (!k || S.done.has(k)) return; const a = ACTIVITIES.find(x => x[0] === k); if (!a) return; S.done.add(k); saveNow();
  const ms = onDoneCount(S.done.size, ACTIVITIES.length); if (ms) setTimeout(() => { showCard(t('Rank earned · {r}', { r: t(ms[1]) }), ms[2], 5000); fireworksShow(6); AU.applause(null, 3); }, 3400);
  setTimeout(() => toast(t('Attraction complete · {a} / {b}', { a: S.done.size, b: ACTIVITIES.length }), a[1], 'soul'), 1600); }
function updateCounters() { $('#candyCount').textContent = S.candy; $('#ghostCount').textContent = S.ghosts; }

/* ---------- The Gallows Drop (free-fall tower) ---------- */
const DROP = {};
function buildDrop() {
  const X = 62, Z = 6, TOP = 34, c = [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]];
  SB.add(new THREE.CylinderGeometry(4.2, 4.6, 0.5, 32), M.stone, X, 0.25, Z); addCircle(X, Z, 4.4);
  for (const [dx, dz] of c) SB.add(new THREE.CylinderGeometry(0.14, 0.16, TOP, 8), M.rust, X + dx, TOP / 2, Z + dz);
  for (let y = 1.5; y < TOP - 1; y += 2.2) for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; cylBetween(new V3(X + a[0], y, Z + a[1]), new V3(X + b[0], y + 2.2, Z + b[1]), 0.05, M.rust); }
  SB.add(boxGeo(2.8, 1.2, 2.8, 1), M.iron, X, TOP + 0.6, Z); bigPumpkin(scene, X, TOP + 2.3, Z, 1.4);
  const bp = []; for (const [dx, dz] of c) for (let y = 1; y < TOP; y += 0.8) bp.push(new V3(X + dx * 1.15, y, Z + dz * 1.15));
  const strip = makeBulbs(scene, bp, [hdr(0xff3a20, 5), hdr(0xffb040, 5)], 0.08); strip.userData.chase = true;
  const car = new THREE.Group(); car.position.set(X, 0.8, Z); scene.add(car); const cb = new Batcher();
  cb.add(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 24, 1, true), M.iron, 0, 0, 0); cb.add(new THREE.TorusGeometry(2.2, 0.1, 6, 32), M.brass, 0, 0.25, 0, 0, { rx: PI / 2 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, ry = -a;
    cb.add(boxGeo(0.55, 0.1, 0.6, 1), i % 2 ? M.purple : M.orange, Math.cos(a) * 2.55, -0.2, Math.sin(a) * 2.55, ry);
    cb.add(boxGeo(0.08, 1.0, 0.6, 1), M.iron, Math.cos(a) * 2.3, 0.3, Math.sin(a) * 2.3, ry);
    cb.add(new THREE.TorusGeometry(0.24, 0.035, 6, 12, PI), M.brass, Math.cos(a) * 2.6, 0.55, Math.sin(a) * 2.6, ry + PI / 2); }
  cb.build(car);
  makeBulbs(car, Array.from({ length: 40 }, (_, i) => new V3(Math.cos(i / 40 * TAU) * 2.25, -0.3, Math.sin(i / 40 * TAU) * 2.25)), PAL_WARM, 0.07);
  const seat = new THREE.Object3D(); seat.position.set(-2.55, 0, 0); seat.rotation.y = PI / 2; car.add(seat);
  makeSign('THE GALLOWS DROP', 6, 1.5, X - 4.7, 4.2, Z, -PI / 2, { size: 110, color: '#ff6a3a', glow: '#ff0000', sub: '34 metres · no refunds' });
  Object.assign(DROP, { car, t: R(0, 30), TOP, phase: 'rest' });
  RIDES.drop = { name: 'The Gallows Drop', seat, eye: 0.85, exit: [X - 7, Z + 2], exitYaw: yawTo(X - 7, Z + 2, X, Z),
    hint: 'Hold on…  look down, if you dare  ·  E — chicken out', done: 'Your stomach will catch up with you shortly.',
    onBoard: () => { DROP.t = 2.5; }, progress: () => clamp((DROP.t - 2.5) / 22.5, 0, 1),
    fov: () => DROP.phase === 'drop' ? 16 : DROP.phase === 'hold' ? -6 : 0, shake: () => DROP.phase === 'drop' ? 0.05 : DROP.phase === 'brake' ? 0.12 : DROP.phase === 'hold' ? 0.008 : 0 };
  addInteract({ x: X - 5.6, z: Z, r: 3.4, label: 'Ride The Gallows Drop', action: () => boardRide('drop') });
  addMarker(X - 5.6, Z + 1.5, 'RIDE', 0xff5a3a); addPool(X, Z, 9, 0xff3a20, 0.4);
  onUpdate((dt) => {
    DROP.t = (DROP.t + dt) % 30; const t = DROP.t; let y;
    if (t < 3) { y = 0.8; DROP.phase = 'load'; }
    else if (t < 15) { const k = (t - 3) / 12; y = 0.8 + (TOP - 4.8) * (k * k * (3 - 2 * k)); DROP.phase = 'lift'; }
    else if (t < 19) { y = TOP - 4 + Math.sin((t - 15) * 9) * 0.03; DROP.phase = 'hold'; }
    else if (t < 21.2) { const tt = t - 19; y = Math.max(5, TOP - 4 - 0.5 * 9.8 * tt * tt); DROP.yb = y; DROP.phase = 'drop'; }
    else if (t < 23.5) { const k = (t - 21.2) / 2.3; y = lerp(DROP.yb ?? 5, 0.8, 1 - Math.pow(1 - k, 3)); DROP.phase = 'brake'; }
    else { y = 0.8; DROP.phase = 'rest'; }
    if (DROP.phase !== DROP.prev) { const riding = S.ride === RIDES.drop;
      if (DROP.phase === 'drop') { AU.whoosh(car.position); if (riding) AU.scream(null, 0.14); } if (DROP.phase === 'hold' && riding) { AU.creak(car.position); AU.heart(true); setTimeout(() => AU.heart(HOUSE.run), 4000); }
      if (DROP.phase === 'brake') AU.brake(car.position); DROP.prev = DROP.phase; }
    car.position.y = y;
  });
}

/* ---------- Coffin Cars (drivable bumper cars with AI) ---------- */
const BUMP = { cars: [] }, GAME_BUMP = { name: 'bump' };
function coffinGeo() {
  const s = new THREE.Shape([[-0.42, -1.05], [0.42, -1.05], [0.7, 0.3], [0.5, 1.05], [-0.5, 1.05], [-0.7, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  g.rotateX(PI / 2); g.translate(0, 0.78, 0); g.computeVertexNormals(); return g;
}
function buildBumper() {
  const X = 64, Z = 40, HX = 12, HZ = 9; Object.assign(BUMP, { X, Z, HX, HZ });
  SB.add(boxGeo(HX * 2, 0.16, HZ * 2, 3), M.plate, X, 0.08, Z); PLATFORMS.push({ x0: X - HX, x1: X + HX, z0: Z - HZ, z1: Z + HZ, h: 0.16 });
  wallBox(X - HX - 0.4, X - HX, 0, 0.8, Z - HZ - 0.4, Z + HZ + 0.4, M.rust); wallBox(X + HX, X + HX + 0.4, 0, 0.8, Z - HZ - 0.4, Z + HZ + 0.4, M.rust);
  wallBox(X - HX, X + HX, 0, 0.8, Z - HZ - 0.4, Z - HZ, M.rust); wallBox(X - HX, X - 2, 0, 0.8, Z + HZ, Z + HZ + 0.4, M.rust); wallBox(X + 2, X + HX, 0, 0.8, Z + HZ, Z + HZ + 0.4, M.rust);
  SB.add(boxGeo(HX * 2, 0.25, 0.2, 1), M.rubber, X, 0.45, Z - HZ + 0.1); for (const sx of [-1, 1]) SB.add(boxGeo(0.2, 0.25, HZ * 2, 1), M.rubber, X + sx * (HX - 0.1), 0.45, Z);
  for (const [dx, dz] of [[-HX, -HZ], [HX, -HZ], [-HX, HZ], [HX, HZ]]) { SB.add(new THREE.CylinderGeometry(0.16, 0.2, 5.6, 8), M.iron, X + dx, 2.8, Z + dz); addCircle(X + dx, Z + dz, 0.35); }
  for (const z of [-HZ, HZ]) SB.add(boxGeo(HX * 2, 0.3, 0.3, 1), M.iron, X, 5.6, Z + z); for (const x of [-HX, HX]) SB.add(boxGeo(0.3, 0.3, HZ * 2, 1), M.iron, X + x, 5.6, Z);
  const net = []; for (let x = -HX; x <= HX; x += 1.5) net.push(new V3(X + x, 5.45, Z - HZ), new V3(X + x, 5.45, Z + HZ)); for (let z = -HZ; z <= HZ; z += 1.5) net.push(new V3(X - HX, 5.45, Z + z), new V3(X + HX, 5.45, Z + z));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(net), new THREE.LineBasicMaterial({ color: 0x2a2630 })));
  const bp = []; for (let i = 0; i <= 60; i++) { const t = i / 60; bp.push(new V3(X - HX + t * HX * 2, 5.8, Z - HZ), new V3(X - HX + t * HX * 2, 5.8, Z + HZ)); }
  for (let i = 0; i <= 44; i++) { const t = i / 44; bp.push(new V3(X - HX, 5.8, Z - HZ + t * HZ * 2), new V3(X + HX, 5.8, Z - HZ + t * HZ * 2)); }
  const bb = makeBulbs(scene, bp, PAL_SPOOK, 0.09); bb.userData.chase = true;
  makeSign('COFFIN CARS', 8, 2, X, 7.0, Z + HZ + 0.2, 0, { size: 130, color: '#c79bff', glow: '#7a30ff', sub: 'bump the dead · 60 seconds' });
  addPool(X, Z, 15, 0x9a60ff, 0.3); addPool(X, Z + HZ + 1.5, 4, 0xffa040, 0.6);
  const cols = [0xff6a10, 0x5a1a8a, 0x2a8a4a, 0xa01818, 0xd8ccb0, 0x18181c, 0x1a7a8a], cg = coffinGeo(), bg = new THREE.TorusGeometry(0.88, 0.13, 8, 32).rotateX(PI / 2).scale(1, 1, 1.35);
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); scene.add(g);
    const body = new THREE.Mesh(cg, new THREE.MeshPhysicalMaterial({ color: cols[i], metalness: 0.2, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 })); body.castShadow = true; g.add(body);
    const bumper = new THREE.Mesh(bg, M.rubber); bumper.position.y = 0.33; g.add(bumper);
    const seat = new THREE.Mesh(boxGeo(0.6, 0.5, 0.15, 1), M.velvet); seat.position.set(0, 1.0, -0.3); g.add(seat);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.6, 5), M.iron); pole.position.set(0, 3.1, -0.85); g.add(pole);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: hdr(0x9ad0ff, 4) })); spark.position.set(0, 5.4, -0.85); g.add(spark);
    for (const sx of [-0.25, 0.25]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), M.glass); hl.position.set(sx, 0.62, 1.07); g.add(hl); }
    if (i === 0) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.bone); sk.position.set(0, 0.92, 0.85); g.add(sk); }
    const a = i / 7 * TAU; BUMP.cars.push({ g, spark, x: X + Math.cos(a) * 6, z: Z + Math.sin(a) * 4, vx: 0, vz: 0, h: R(0, TAU), tT: 0, tgt: null, roll: 0 });
  }
  GAME_BUMP.exit = [X, Z + HZ + 2.6, 0];
  addInteract({ x: X, z: Z + HZ + 1.6, r: 3.4, label: () => t('Drive the Coffin Cars · best {n}', { n: SCORES.bump }), action: startBumper });
  addMarker(X, Z + HZ + 1.6, 'PLAY', 0xb070ff);
  onUpdate(updateBumper);
}
function updateBumper(dt) {
  if (dt <= 0) return; const B = BUMP, cars = B.cars, playing = S.game === GAME_BUMP;
  for (const c of cars) {
    let thr, steer;
    if (playing && c === cars[0]) { thr = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 0.7 : 0); steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
      if (keys.Space && GAME_BUMP.boost <= 0) { GAME_BUMP.boost = 3; c.vx += Math.sin(c.h) * 6; c.vz += Math.cos(c.h) * 6; AU.horn(); } }
    else { c.tT -= dt; if (c.tT <= 0 || !c.tgt) { c.tT = R(1.5, 3.5); c.tgt = playing && rand() < 0.45 ? cars[0] : { x: B.X + R(-B.HX + 2, B.HX - 2), z: B.Z + R(-B.HZ + 2, B.HZ - 2) }; }
      let da = Math.atan2(c.tgt.x - c.x, c.tgt.z - c.z) - c.h; da = Math.atan2(Math.sin(da), Math.cos(da)); steer = clamp(da * 2, -1, 1); thr = Math.abs(da) > 2.3 ? -0.5 : 0.7; }
    const fx = Math.sin(c.h), fz = Math.cos(c.h), vf = c.vx * fx + c.vz * fz;
    c.vx += fx * thr * 8 * dt; c.vz += fz * thr * 8 * dt;
    const lat = c.vx * fz - c.vz * fx, k = Math.min(1, 5 * dt); c.vx -= fz * lat * k; c.vz += fx * lat * k;
    const dr = Math.exp(-1.3 * dt); c.vx *= dr; c.vz *= dr;
    c.h += steer * 2.4 * dt * clamp(Math.abs(vf) / 2.5, 0.35, 1) * (vf < -0.2 ? -1 : 1);
    c.x += c.vx * dt; c.z += c.vz * dt;
    const x0 = B.X - B.HX + 1.05, x1 = B.X + B.HX - 1.05, z0 = B.Z - B.HZ + 1.05, z1 = B.Z + B.HZ - 1.05;
    if (c.x < x0 || c.x > x1) { if (Math.abs(c.vx) > 2) bumpFx(c, null, Math.abs(c.vx), c.x < x0 ? x0 - 1 : x1 + 1, c.z); c.x = clamp(c.x, x0, x1); c.vx = -c.vx * 0.5; }
    if (c.z < z0 || c.z > z1) { if (Math.abs(c.vz) > 2) bumpFx(c, null, Math.abs(c.vz), c.x, c.z < z0 ? z0 - 1 : z1 + 1); c.z = clamp(c.z, z0, z1); c.vz = -c.vz * 0.5; }
  }
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 1.95 && d > 1e-4) { const nx = dx / d, nz = dz / d, pen = (1.95 - d) / 2; a.x -= nx * pen; a.z -= nz * pen; b.x += nx * pen; b.z += nz * pen;
      const av = a.vx * nx + a.vz * nz, bv = -(b.vx * nx + b.vz * nz), rv = av + bv;
      if (rv > 0) { const jm = rv * 0.9; a.vx -= nx * jm; a.vz -= nz * jm; b.vx += nx * jm; b.vz += nz * jm; if (rv > 1.2) bumpFx(a, b, rv, a.x + nx * 0.97, a.z + nz * 0.97, av, bv); } } }
  if (S.mode === 'roam') for (const c of cars) { const dx = player.pos.x - c.x, dz = player.pos.z - c.z, d = Math.hypot(dx, dz); if (d < 1.4 && d > 1e-3) { player.pos.x = c.x + dx / d * 1.4; player.pos.z = c.z + dz / d * 1.4; } }
  for (const c of cars) { c.roll = damp(c.roll, 0, 5, dt); c.g.position.set(c.x, 0.16, c.z); c.g.rotation.set(0, c.h, c.roll); c.spark.visible = Math.random() < 0.35 + Math.hypot(c.vx, c.vz) * 0.08; }
}
function bumpFx(a, b, rv, x, z, av = 0, bv = 0) {
  AU.bump(new V3(x, 0.6, z), rv); FW.burst(new V3(x, 0.7, z), Math.floor(8 + rv * 4), new THREE.Color(4, 3, 1.2), 2 + rv * 0.4, 'spark');
  a.roll = (Math.random() - 0.5) * 0.08 * rv; if (b) b.roll = (Math.random() - 0.5) * 0.08 * rv;
  if (S.game !== GAME_BUMP) return; const G = GAME_BUMP, me = BUMP.cars[0];
  if (b && (a === me || b === me)) { const mine = a === me ? av : bv, theirs = a === me ? bv : av;
    if (mine >= theirs) { const pts = Math.round(rv * 6); G.score += pts; G.hits++; floater(new V3(x, 1.4, z), '+' + pts); S.shake = 0.25; } else { S.shake = 0.5; floater(new V3(x, 1.4, z), 'OOF', true); } }
  else if (!b && a === me) S.shake = 0.2;
}
function startBumper() {
  fade(() => { const c = BUMP.cars[0]; c.x = BUMP.X; c.z = BUMP.Z + BUMP.HZ - 2.5; c.vx = c.vz = 0; c.h = PI;
    S.mode = 'game'; S.game = GAME_BUMP; Object.assign(GAME_BUMP, { score: 0, time: 60, boost: 0, hits: 0, cam: new V3(c.x, 3, c.z + 5) }); player.yaw = 0; player.pitch = 0;
    $('#gamepanel').classList.remove('hidden'); AU.hum(true); toast('Coffin Cars', 'W/S drive · A/D steer · Space boost · ram the other coffins!'); });
}
GAME_BUMP.update = (dt) => {
  const G = GAME_BUMP, c = BUMP.cars[0]; if (!S.menu) G.time -= dt; G.boost -= dt;
  player.yaw = clamp(player.yaw, -1.2, 1.2); player.pitch = clamp(player.pitch, -0.4, 0.3);
  const ang = c.h + player.yaw; G.cam.x = damp(G.cam.x, c.x - Math.sin(ang) * 6.6, 5, dt); G.cam.z = damp(G.cam.z, c.z - Math.cos(ang) * 6.6, 5, dt); G.cam.y = damp(G.cam.y, 3.8 - player.pitch * 3, 5, dt);
  camera.position.copy(G.cam); camera.lookAt(c.x + Math.sin(c.h) * 2.5, 0.9, c.z + Math.cos(c.h) * 2.5);
  $('#gamepanel').innerHTML = `<div>${t('Bumps')}<b>${G.score}</b></div><div>${t('Time')}<b>${Math.max(0, G.time).toFixed(1)}</b></div><div>${t('Boost')}<b>${G.boost > 0 ? '…' : t('READY')}</b></div><div>${t('Best')}<b>${SCORES.bump}</b></div>`;
  if (G.time <= 0) endGame(t('Coffin Cars · {n} points', { n: G.score }), G.score > SCORES.bump ? 'New record! The dead are furious.' : t('{n} solid hits', { n: G.hits }), () => { if (G.score > SCORES.bump) { SCORES.bump = G.score; saveScores(); } });
};
GAME_BUMP.cleanup = () => AU.hum(false);

/* ---------- Grave Danger (whack-a-zombie) ---------- */
const WHACK = { heads: [] }, GAME_WHACK = { name: 'whack' };
function buildWhack() {
  const X = -26, Z = -42;
  SB.add(boxGeo(7, 0.7, 5.2, 2), M.woodDark, X, 0.35, Z); SB.add(boxGeo(6.7, 0.04, 4.9, 1.5), M.ground, X, 0.72, Z, 0, { shadow: false }); addBox(X - 3.5, X + 3.5, Z - 2.6, Z + 2.6);
  SB.add(boxGeo(7.4, 3.2, 0.3, 2), M.woodDark, X, 1.6, Z - 2.8);
  makeSign('GRAVE DANGER', 6.4, 1.6, X, 4.1, Z - 2.6, 0, { size: 120, color: '#9aff7a', glow: '#20ff40', sub: 'zombies 10 · golden skulls 40 · spare grandma!' });
  makeBulbs(scene, Array.from({ length: 30 }, (_, i) => new V3(X - 3.6 + i * 7.2 / 29, 3.25, Z - 2.62)), [hdr(0x50ff60, 5), hdr(0xffa020, 5)], 0.07);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const hx = X + (i - 1) * 1.9, hz = Z - 0.3 + (j - 1) * 1.45;
    SB.add(new THREE.CircleGeometry(0.42, 20), M.dark, hx, 0.745, hz, 0, { rx: -PI / 2, shadow: false });
    SB.add(new THREE.TorusGeometry(0.46, 0.09, 6, 16), M.leafPile, hx, 0.74, hz, 0, { rx: PI / 2 });
    const g = new THREE.Group(); g.position.set(hx, 0.1, hz); scene.add(g);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), M.zombie); head.castShadow = true; head.scale.set(1, 1.1, 1); g.add(head);
    for (const sx of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.glowRed); e.position.set(sx, 0.07, 0.27); head.add(e); }
    const jaw = new THREE.Mesh(boxGeo(0.22, 0.07, 0.1, 1), M.dark); jaw.position.set(0, -0.12, 0.25); head.add(jaw);
    for (const sx of [-0.38, 0.38]) { const hand = new THREE.Mesh(boxGeo(0.12, 0.3, 0.08, 1), M.zombie); hand.position.set(sx, -0.05, 0.1); hand.rotation.z = -sx; g.add(hand); }
    WHACK.heads.push({ g, head, up: 0, t: 0, kind: 'zombie' });
  }
  for (let i = 0; i < 8; i++) addTomb(X + R(-5, 5), Z - R(3.6, 6), R(-0.3, 0.3), R(0.7, 1));
  WHACK.cam = new V3(X, 1.95, Z + 3.7);
  WHACK.mallet = new THREE.Group(); const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6), M.wood); mh.position.y = 0.35;
  const mhd = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 12), M.rust); mhd.rotation.z = PI / 2; mhd.position.y = 0.72;
  WHACK.mallet.add(mh, mhd); WHACK.mallet.position.set(0.55, -0.62, -0.8); WHACK.mallet.rotation.set(-0.25, 0, -0.55); WHACK.mallet.visible = false; camera.add(WHACK.mallet);
  GAME_WHACK.exit = [X, Z + 4.4, 0];
  addInteract({ x: X, z: Z + 3.6, r: 3, label: () => t('Play Grave Danger · best {n}', { n: SCORES.whack }), action: startWhack }); addMarker(X + 1.5, Z + 3.6, 'PLAY', 0x7dff9a);
  addPool(X, Z + 3, 4, 0x60ff70, 0.45); pointLight('whack', 0xc0ff90, 35, 14, X, 3.4, Z + 1.6);
  onUpdate((dt, t) => { for (const h of WHACK.heads) { h.g.position.y = damp(h.g.position.y, h.up ? 0.98 : 0.1, h.up ? 16 : 10, dt); h.head.rotation.y = Math.sin(t * 6 + h.g.position.x) * 0.3 * h.up; } });
}
function startWhack() {
  fade(() => { S.mode = 'game'; S.game = GAME_WHACK; Object.assign(GAME_WHACK, { score: 0, time: 30, next: 0.6, swing: 0 }); WHACK.heads.forEach(h => h.up = 0);
    player.yaw = 0; player.pitch = 0; WHACK.mallet.visible = true; $('#crosshair').classList.add('game'); $('#gamepanel').classList.remove('hidden'); toast('Grave Danger', 'Click to whack the zombies back into their graves!'); });
}
GAME_WHACK.update = (dt) => {
  const G = GAME_WHACK; if (!S.menu) G.time -= dt; const prog = 1 - Math.max(0, G.time) / 30;
  player.yaw = clamp(player.yaw, -0.6, 0.6); player.pitch = clamp(player.pitch, -0.35, 0.3);
  camera.position.copy(WHACK.cam); camera.rotation.set(-0.5 + player.pitch, player.yaw, 0);
  G.next -= dt;
  if (G.next <= 0 && G.time > 0) { G.next = lerp(0.85, 0.38, prog) * R(0.7, 1.2); const free = WHACK.heads.filter(h => !h.up);
    if (free.length) { const h = pick(free), r = rand(); h.kind = r < 0.08 ? 'gold' : r < 0.22 ? 'ghost' : 'zombie'; h.head.material = h.kind === 'gold' ? M.gold : h.kind === 'ghost' ? M.ghostly : M.zombie; h.up = 1; h.t = lerp(1.25, 0.6, prog);
      if (h.kind === 'zombie' && Math.random() < 0.35) AU.tone({ f: 120, f2: 80, type: 'sawtooth', dur: 0.4, vol: 0.05, lp: 500 }); } }
  for (const h of WHACK.heads) if (h.up) { h.t -= dt; if (h.t <= 0) h.up = 0; }
  G.swing = Math.max(0, G.swing - dt * 5); WHACK.mallet.rotation.x = -0.25 - Math.sin(G.swing * PI) * 1.5; WHACK.mallet.rotation.z = -0.55 + Math.sin(G.swing * PI) * 0.35;
  $('#gamepanel').innerHTML = `<div>${t('Score')}<b>${G.score}</b></div><div>${t('Time')}<b>${Math.max(0, G.time).toFixed(1)}</b></div><div>${t('Best')}<b>${SCORES.whack}</b></div>`;
  if (G.time <= 0) endGame(t('Grave Danger · {n}', { n: G.score }), G.score > SCORES.whack ? 'New record! The graveyard is quiet… for now.' : 'The dead keep rising.', () => { if (G.score > SCORES.whack) { SCORES.whack = G.score; saveScores(); } });
};
GAME_WHACK.click = () => {
  const G = GAME_WHACK; G.swing = 1; AU.whoosh(null);
  ray.setFromCamera(new THREE.Vector2(0, 0), camera); const ups = WHACK.heads.filter(h => h.up && h.g.position.y > 0.55); const hit = ray.intersectObjects(ups.map(h => h.head), false)[0];
  if (!hit) return; const h = ups.find(x => x.head === hit.object), pts = { zombie: 10, gold: 40, ghost: -20 }[h.kind]; h.up = 0; G.score = Math.max(0, G.score + pts);
  AU.bonk(hit.point); floater(hit.point, (pts > 0 ? '+' : '') + pts, pts < 0); S.shake = 0.15;
  FW.burst(hit.point, 30, h.kind === 'gold' ? new THREE.Color(4, 3, 0.6) : h.kind === 'ghost' ? new THREE.Color(2.5, 2.5, 3) : new THREE.Color(0.8, 2.6, 0.5), 3, 'splat');
  if (h.kind === 'ghost') toast('You whacked Grandma!', 'She is very disappointed in you.', 'blood');
};
GAME_WHACK.cleanup = () => { WHACK.mallet.visible = false; };

/* ---------- Pumpkin Chuck (ballistic pumpkin toss) ---------- */
const TOSS = { targets: [], balls: [] }, GAME_TOSS = { name: 'toss' };
function buildToss() {
  const SX = -19.5, Z = 60;
  SB.add(boxGeo(1.6, 1.0, 2.6, 1), M.woodDark, SX - 0.9, 0.5, Z); addBox(SX - 1.7, SX - 0.1, Z - 1.3, Z + 1.3);
  for (let i = 0; i < 7; i++) addPumpkin(SX - 0.9 + R(-0.5, 0.5), 1.0, Z + R(-1, 1), R(0.14, 0.2), false);
  for (const s of [-1, 1]) { for (let x = -21; x > -39; x -= 2.4) SB.add(boxGeo(0.12, 1.0, 0.12, 1), M.woodDark, x, 0.5, Z + s * 4.6);
    SB.add(boxGeo(18, 0.1, 0.08, 2), M.woodDark, -30, 0.85, Z + s * 4.6); addBox(-39, -21, Z + s * 4.6 - 0.1, Z + s * 4.6 + 0.1); }
  const T = [{ x: -26, z: 59.0, r: 0.55, h: 1.0, pts: 10, kind: 'barrel' }, { x: -31, z: 61.6, r: 0.72, h: 1.15, pts: 25, kind: 'cauldron' }, { x: -36.5, z: 58.4, r: 0.5, h: 0.62, pts: 50, kind: 'coffin' }];
  for (const t of T) {
    if (t.kind === 'barrel') { SB.add(scaleUV(new THREE.CylinderGeometry(t.r, t.r * 0.9, t.h, 20, 1, true), 2, 1), M.wood, t.x, t.h / 2, t.z); SB.add(new THREE.CircleGeometry(t.r * 0.95, 20), M.dark, t.x, t.h - 0.25, t.z, 0, { rx: -PI / 2 }); }
    if (t.kind === 'cauldron') { const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.55, 0.08], [0.78, 0.5], [0.76, 0.95], [0.66, 1.1], [0.72, 1.15]].map(([a, b]) => new THREE.Vector2(a, b)), 24), new THREE.MeshStandardMaterial({ color: 0x111014, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
      pot.position.set(t.x, 0, t.z); pot.castShadow = true; scene.add(pot);
      const brew = new THREE.Mesh(new THREE.CircleGeometry(0.66, 24).rotateX(-PI / 2), waterMat(new THREE.Color().setRGB(1.6, 0.4, 2.4), t.x, t.z)); brew.position.set(t.x, 1.0, t.z); scene.add(brew); }
    if (t.kind === 'coffin') { const w = 0.55, l = 1.5; SB.add(boxGeo(w * 2, 0.05, l, 1), M.woodDark, t.x, 0.03, t.z);
      for (const sx of [-1, 1]) SB.add(boxGeo(0.06, t.h, l, 1), M.woodDark, t.x + sx * w, t.h / 2, t.z); for (const sz of [-1, 1]) SB.add(boxGeo(w * 2, t.h, 0.06, 1), M.woodDark, t.x, t.h / 2, t.z + sz * l / 2);
      const lid = new THREE.Mesh(boxGeo(w * 2, 0.06, l, 1), M.woodDark); lid.position.set(t.x - w - 0.1, 0.5, t.z); lid.rotation.z = 1.2; scene.add(lid); }
    t.ring = new THREE.Mesh(new THREE.TorusGeometry(t.r, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: hdr(0xffa040, 4) })); t.ring.rotation.x = PI / 2; t.ring.position.set(t.x, t.h + 0.02, t.z); scene.add(t.ring);
    makeSign(String(t.pts), 1.0, 0.5, t.x, t.h + 0.9, t.z, PI / 2, { size: 200, color: '#ffd070', glow: '#ff8000', w: 256, h: 128 });
    addCircle(t.x, t.z, t.r + 0.05); addPool(t.x, t.z, 2, 0xffa040, 0.5); TOSS.targets.push(t);
  }
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(PUMPKIN_GEO, M.pumpkinLit); m.scale.setScalar(0.17); m.visible = false; m.castShadow = true; scene.add(m); TOSS.balls.push({ m, p: new V3(), v: new V3(), on: false, prevY: 0 }); }
  for (const s of [-1, 1]) { SB.add(new THREE.CylinderGeometry(0.1, 0.1, 4, 6), M.woodDark, -17.2, 2, Z + s * 3.2); addCircle(-17.2, Z + s * 3.2, 0.2); }
  makeSign('PUMPKIN CHUCK', 6, 1.5, -17.2, 4.1, Z, PI / 2, { size: 120, color: '#ff9a3a', sub: 'hold to charge · release to throw' });
  makeBulbs(scene, Array.from({ length: 26 }, (_, i) => new V3(-17.2, 3.3, Z - 3.2 + i * 6.4 / 25)), PAL_WARM, 0.07);
  TOSS.cam = new V3(-18.8, 1.7, Z); GAME_TOSS.exit = [-17.6, Z, PI / 2];
  addInteract({ x: -18.6, z: Z, r: 2.8, label: () => t('Play Pumpkin Chuck · best {n}', { n: SCORES.toss }), action: startToss }); addMarker(-17.6, Z + 1.8, 'PLAY', 0xff8a2a);
  onUpdate(updateTossBalls);
}
function updateTossBalls(dt) {
  for (const b of TOSS.balls) { if (!b.on) continue; b.prevY = b.p.y; b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt); b.m.position.copy(b.p); b.m.rotation.x += dt * 6; b.m.rotation.z += dt * 4;
    for (const t of TOSS.targets) if (b.prevY > t.h && b.p.y <= t.h && Math.hypot(b.p.x - t.x, b.p.z - t.z) < t.r) { b.on = false; b.m.visible = false; tossScore(t, b.p); break; }
    if (b.on && b.p.y < 0.18) { b.on = false; b.m.visible = false; FW.burst(b.p, 50, new THREE.Color(3, 1.1, 0.15), 3, 'splat'); AU.splat(b.p); }
    if (b.on) for (const t of TOSS.targets) if (b.p.y < t.h && Math.hypot(b.p.x - t.x, b.p.z - t.z) < t.r + 0.15) { b.v.x *= -0.4; b.v.z *= -0.4; AU.thud(b.p, 0.5); } }
}
function tossScore(t, p) { const G = GAME_TOSS; G.score += t.pts; G.made++; floater(p.clone().setY(t.h + 0.5), '+' + t.pts); AU.chime(); FW.burst(new V3(t.x, t.h + 0.2, t.z), 60, new THREE.Color(4, 2.4, 0.5), 4, 'peony'); t.flash = 1; if (t.kind === 'cauldron') AU.gulp(); }
function startToss() {
  fade(() => { S.mode = 'game'; S.game = GAME_TOSS; Object.assign(GAME_TOSS, { score: 0, left: 10, made: 0, charging: false, power: 0, ended: false }); player.yaw = 0; player.pitch = 0.12;
    $('#crosshair').classList.add('game'); $('#gamepanel').classList.remove('hidden'); toast('Pumpkin Chuck', 'Hold the mouse (or Space) to charge, release to throw. 10 pumpkins.'); });
}
GAME_TOSS.update = (dt) => {
  const G = GAME_TOSS; player.yaw = clamp(player.yaw, -0.45, 0.45); player.pitch = clamp(player.pitch, -0.25, 0.65);
  camera.position.copy(TOSS.cam); camera.rotation.set(player.pitch, PI / 2 + player.yaw, 0);
  if (G.charging) { G.power = Math.min(1, G.power + dt / 1.1); $('#meter .needle').style.left = (G.power * 100) + '%'; }
  for (const t of TOSS.targets) { t.flash = Math.max(0, (t.flash || 0) - dt * 2); t.ring.material.color.setHex(0xffa040).multiplyScalar(2.6 + t.flash * 8); }
  $('#gamepanel').innerHTML = `<div>${t('Score')}<b>${G.score}</b></div><div>${t('Pumpkins')}<b>${G.left}</b></div><div>${t('Best')}<b>${SCORES.toss}</b></div>`;
  if (G.left <= 0 && !TOSS.balls.some(b => b.on) && !G.ended) { G.ended = true; endGame(t('Pumpkin Chuck · {n}', { n: G.score }), G.score > SCORES.toss ? 'New record! The scarecrows are impressed.' : t('{n} / 10 landed', { n: G.made }), () => { if (G.score > SCORES.toss) { SCORES.toss = G.score; saveScores(); } }); }
};
GAME_TOSS.click = () => { const G = GAME_TOSS; if (G.left <= 0 || G.charging) return; G.charging = true; G.power = 0; $('#meter').classList.remove('hidden'); $('#meter .mlabel').textContent = t('Release to throw'); };
GAME_TOSS.release = () => { const G = GAME_TOSS; if (!G.charging) return; G.charging = false; $('#meter').classList.add('hidden'); const b = TOSS.balls.find(x => !x.on); if (!b) return;
  const d = new V3(); camera.getWorldDirection(d); b.p.copy(camera.position).addScaledVector(d, 0.6).add(new V3(0, -0.2, 0)); b.v.copy(d).multiplyScalar(5 + G.power * 12).add(new V3(0, 2.2, 0)); b.on = true; b.m.visible = true; G.left--; AU.throwIt(); };
GAME_TOSS.key = (c) => { if (c === 'Space') GAME_TOSS.click(); }; GAME_TOSS.keyUp = (c) => { if (c === 'Space') GAME_TOSS.release(); };

export { markerTex, relabelMarkers, makeSign, MARKERS, _mkTex, addMarker, updateMarkers, ACTIVITIES, markDone, updateCounters, DROP, buildDrop, BUMP, GAME_BUMP, coffinGeo, buildBumper, updateBumper, bumpFx, startBumper, WHACK, GAME_WHACK, buildWhack, startWhack, TOSS, GAME_TOSS, buildToss, updateTossBalls, tossScore, startToss };
