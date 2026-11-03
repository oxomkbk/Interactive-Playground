import * as THREE from 'three';
import { bev } from '../core/surface.js';
import { PI, TAU, V3, clamp, damp, hdr, yawTo } from '../core/utils.js';
import { panelTex, signTex, stripeTex } from '../core/textures.js';
import { LIGHTS, pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { Batcher, PAL_SPOOK, PAL_WARM, SB, addBox, addCircle, addInteract, addPool, boxGeo, cylBetween, makeBulbs, onUpdate, scaleUV, wallBox } from '../core/registry.js';
import { bigPumpkin } from './landscape.js';
import { coasterCarGeo, horseGeometries, lathe, merge, roundBox } from './props.js';
import { addMarker } from './attractions.js';
import { AU } from '../core/audio.js';
import { S, boardRide, keys } from '../game/play.js';
import { t } from '../core/i18n.js';

/* ---------- Carousel Macabre ---------- */
const RIDES = {};
function buildCarousel() {
  const X = 32, Z = 18;
  SB.add(new THREE.CylinderGeometry(8.8, 9.2, 0.5, 48), M.stone, X, 0.25, Z);
  addCircle(X, Z, 9.0);
  const rotor = new THREE.Group(); rotor.position.set(X, 0.5, Z); scene.add(rotor);
  const rb = new Batcher();
  rb.add(scaleUV(new THREE.CylinderGeometry(8.4, 8.4, 0.18, 48), 6, 1), M.wood, 0, 0.09, 0);
  rb.add(new THREE.CylinderGeometry(1.4, 1.4, 4.2, 16, 1, true), new THREE.MeshStandardMaterial({ map: panelTex(), emissiveMap: panelTex(), emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.4 }), 0, 2.1, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ map: stripeTex(['#5a1a7a', '#e06a10'], 16), side: THREE.DoubleSide, roughness: 0.7 });
  rb.add(new THREE.ConeGeometry(9.2, 2.6, 32, 1, true), canopyMat, 0, 5.5, 0);
  rb.add(new THREE.CylinderGeometry(9.2, 9.2, 0.7, 48, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex(['#e06a10', '#5a1a7a'], 32, false, true), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), 0, 3.9, 0);
  rb.add(new THREE.CylinderGeometry(0.3, 0.4, 1.2, 8), M.brass, 0, 7.2, 0);
  // gilded sweeps under the canopy, a turned cupola on top, and a mirrored rounding board with framed panels
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; cylBetween(new V3(0, 4.6, 0), new V3(Math.cos(a) * 9.0, 4.15, Math.sin(a) * 9.0), 0.07, M.brass, rb, 6);
    rb.add(new THREE.SphereGeometry(0.16, 12, 8), M.gold, Math.cos(a) * 9.25, 3.2, Math.sin(a) * 9.25);
    rb.add(new THREE.ConeGeometry(0.12, 0.42, 8), M.gold, Math.cos(a) * 9.25, 4.4, Math.sin(a) * 9.25); }
  rb.add(lathe([[0.001, 6.6], [1.5, 6.6], [1.6, 6.75], [1.2, 6.9], [1.25, 7.5], [1.0, 7.6], [0.7, 8.0], [0.25, 8.4], [0.001, 8.5]], 32), canopyMat, 0, 0, 0);
  rb.add(new THREE.TorusGeometry(1.55, 0.06, 6, 40), M.gold, 0, 6.7, 0, 0, { rx: PI / 2 });
  const mirror = new THREE.MeshPhysicalMaterial({ color: 0x8a7a9a, metalness: 1, roughness: 0.08, envMapIntensity: 2.2 });
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * TAU, x = Math.cos(a) * 9.18, z = Math.sin(a) * 9.18;
    rb.add(roundBox(0.9, 0.42, 0.04, 0.02, 1), mirror, x, 3.55, z, -a + PI / 2, { shadow: false });
    rb.add(roundBox(1.06, 0.56, 0.03, 0.02, 1), M.gold, x * 0.998, 3.55, z * 0.998, -a + PI / 2, { shadow: false }); }
  const horses = [], { body: hgeo, tack: tgeo } = horseGeometries();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, px = Math.cos(a) * 6.2, pz = -Math.sin(a) * 6.2;
    rb.add(new THREE.CylinderGeometry(0.05, 0.05, 4.1, 8), M.brass, px, 2.2, pz);
    const h = new THREE.Mesh(hgeo, i % 2 ? M.lacquerBone : M.lacquerBlack); h.castShadow = true; h.position.set(px, 1.3, pz); h.rotation.y = a + PI / 2; rotor.add(h);
    const tk = new THREE.Mesh(tgeo, i % 2 ? M.purple : M.brass); tk.castShadow = true; h.add(tk);
    for (const ez of [-0.085, 0.085]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), M.glowRed); e.position.set(1.02, 0.8, ez); h.add(e); }
    horses.push({ m: h, ph: i * 1.3 });
  }
  rb.build(rotor);
  const bp = []; for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; bp.push(new V3(Math.cos(a) * 9.25, 3.55, Math.sin(a) * 9.25)); }
  for (let s = 0; s < 16; s++) for (let k = 1; k <= 6; k++) { const a = s / 16 * TAU, r = 9.2 * (1 - k / 7); bp.push(new V3(Math.cos(a) * r, 4.2 + 2.6 * k / 7, Math.sin(a) * r)); }
  makeBulbs(rotor, bp, PAL_WARM, 0.08);
  bigPumpkin(rotor, 0, 8.2, 0, 0.7);
  pointLight('carousel', 0xffb070, 130, 24, X, 3.2, Z);
  addPool(X, Z, 13, 0xffa050, 0.6);
  const seat = new THREE.Object3D(); seat.position.set(0, 0.55, 0); seat.rotation.y = -PI / 2; horses[0].m.add(seat);
  const CAR = { rear: 0, ph: 0, spin: 0.42 };
  RIDES.carousel = { name: 'Carousel Macabre', seat, eye: 0.75, exit: [X - 10.5, Z + 6], exitYaw: yawTo(X - 10.5, Z + 6, X, Z), dur: 50,
    hint: 'W — gallop  ·  Space — rear up  ·  E — leave', done: 'The horses will miss you. They always do.',
    ctrl: () => { if (keys.Space && CAR.rear <= 0) { CAR.rear = 1; AU.whinny(horses[0].m.getWorldPosition(new V3())); } },
    shake: () => keys.KeyW ? 0.012 : 0 };
  addInteract({ x: X - 9.6, z: Z + 3.2, r: 3.4, label: 'Ride the Carousel Macabre', action: () => boardRide('carousel') });
  addMarker(X - 9.6, Z + 3.2, 'RIDE', 0xffc27a);
  onUpdate((dt, t) => {
    const riding = S.ride === RIDES.carousel; CAR.spin = damp(CAR.spin, riding ? 0.6 : 0.42, 1, dt); rotor.rotation.y += dt * CAR.spin;
    for (const h of horses) h.m.position.y = 1.35 + Math.sin(t * 1.7 + h.ph) * 0.38;
    if (riding) { const g = keys.KeyW; CAR.ph += dt * (g ? 6 : 1.7); horses[0].m.position.y = 1.35 + Math.sin(CAR.ph) * (g ? 0.6 : 0.38); }
    CAR.rear = Math.max(0, CAR.rear - dt * 0.9); horses[0].m.rotation.z = Math.sin(CAR.rear * PI) * 0.5;
  });
}

/* ---------- Wraith Wind swing ride ---------- */
function buildSwing() {
  const X = 36, Z = -16;
  SB.add(new THREE.CylinderGeometry(2.6, 2.9, 0.6, 24), M.stone, X, 0.3, Z);
  SB.add(scaleUV(new THREE.CylinderGeometry(0.55, 0.9, 12, 12), 2, 6), M.rust, X, 6, Z);
  addCircle(X, Z, 2.9);
  const hub = new THREE.Group(); hub.position.set(X, 11.6, Z); scene.add(hub);
  const hb = new Batcher();
  hb.add(new THREE.ConeGeometry(4.8, 2, 24, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex(['#2a7a5a', '#140a18'], 16), side: THREE.DoubleSide, roughness: 0.7 }), 0, 1, 0);
  hb.add(new THREE.CylinderGeometry(4.6, 4.6, 0.4, 32), M.rust, 0, -0.1, 0);
  hb.build(hub);
  const bp = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; bp.push(new V3(Math.cos(a) * 4.85, 0.0, Math.sin(a) * 4.85)); }
  makeBulbs(hub, bp, [hdr(0x50ff90, 5), hdr(0xb070ff, 5)], 0.09);
  const arms = [];
  const chainGeo = new THREE.CylinderGeometry(0.02, 0.02, 6.2, 4).translate(0, -3.1, 0);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, arm = new THREE.Group(); arm.rotation.y = a; hub.add(arm);
    const tilt = new THREE.Group(); tilt.position.x = 4.3; arm.add(tilt);
    for (const dz of [-0.25, 0.25]) { const c = new THREE.Mesh(chainGeo, M.iron); c.position.z = dz; tilt.add(c); }
    const chair = new THREE.Mesh(roundBox(0.6, 0.12, 0.62, 0.05, 1), i % 2 ? M.purple : M.orange); chair.position.y = -6.2; chair.castShadow = true; tilt.add(chair);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.62), M.iron); back.position.set(-0.3, -5.9, 0); tilt.add(back);
    arms.push(tilt);
  }
  const seat = new THREE.Object3D(); seat.position.set(0, -5.6, 0); arms[0].add(seat);
  const SW = { cyc: 20, w: 0 };
  RIDES.swing = { name: 'Wraith Wind', seat, eye: 0.6, exit: [X - 9, Z + 6], exitYaw: yawTo(X - 9, Z + 6, X, Z),
    hint: 'Hold Space — whip the swings faster  ·  E — leave', done: 'Your soul is still spinning somewhere up there.',
    onBoard: () => { SW.cyc = 0; }, progress: () => SW.cyc / 38, fov: () => SW.w * 4, shake: () => SW.w > 1.7 ? 0.02 : 0 };
  addInteract({ x: X - 4, z: Z + 2.5, r: 3.4, label: 'Ride the Wraith Wind', action: () => boardRide('swing') });
  addMarker(X - 4, Z + 2.5, 'RIDE', 0x7dffb0);
  addPool(X, Z, 12, 0x50ff90, 0.35);
  let theta = 0;
  onUpdate((dt, t) => {
    SW.cyc = (SW.cyc + dt) % 46; const cyc = SW.cyc; let target = cyc < 6 ? cyc / 6 * 1.55 : cyc < 30 ? 1.55 : cyc < 37 ? (37 - cyc) / 7 * 1.55 : 0;
    if (S.ride === RIDES.swing && keys.Space && cyc > 4 && cyc < 32) target += 0.65;
    SW.w = damp(SW.w, target, 1.5, dt); const w = SW.w; hub.rotation.y += w * dt;
    theta = damp(theta, Math.atan((w * w * (4.3 + 6 * Math.sin(theta))) / 9.8), 3, dt);
    hub.rotation.x = Math.sin(t * 0.5) * 0.08 * (w / 1.55); hub.rotation.z = Math.cos(t * 0.5) * 0.08 * (w / 1.55);
    for (const a of arms) a.rotation.z = theta;
  });
}

/* ---------- The Eye (Ferris wheel) ---------- */
let GONDOLA = null, GONDOLA_MATS = null;
function gondolaGeos() {
  const L = (prof, seg = 28) => lathe(prof, seg);
  const dome = L([[0.001, -0.5], [0.12, -0.52], [0.18, -0.6], [0.32, -0.72], [0.7, -0.84], [1.08, -0.94], [1.22, -1.0], [1.18, -1.04], [0.001, -1.04]], 32);
  const finial = merge([new THREE.SphereGeometry(0.1, 12, 8).translate(0, -0.42, 0), new THREE.ConeGeometry(0.05, 0.22, 8).translate(0, -0.27, 0)]);
  const bowl = L([[0.001, -3.0], [0.62, -3.0], [0.92, -2.92], [1.08, -2.72], [1.14, -2.42], [1.12, -2.12], [1.18, -2.04], [1.1, -2.0], [1.0, -2.08], [1.02, -2.4], [0.96, -2.72], [0.6, -2.88], [0.001, -2.88]], 32);
  const floor = new THREE.CylinderGeometry(0.85, 0.85, 0.06, 24).translate(0, -2.86, 0);
  const bars = [], rims = [], val = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, c = Math.cos(a), s2 = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([new V3(c * 1.12, -2.02, s2 * 1.12), new V3(c * 1.24, -1.5, s2 * 1.24), new V3(c * 1.16, -1.02, s2 * 1.16)]);
    bars.push(new THREE.TubeGeometry(curve, 10, 0.022, 5)); }
  rims.push(new THREE.TorusGeometry(1.15, 0.035, 6, 40).rotateX(PI / 2).translate(0, -2.02, 0), new THREE.TorusGeometry(1.2, 0.035, 6, 40).rotateX(PI / 2).translate(0, -1.0, 0), new THREE.TorusGeometry(0.78, 0.03, 6, 32).rotateX(PI / 2).translate(0, -2.97, 0));
  for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; val.push(new THREE.SphereGeometry(0.13, 10, 6, 0, TAU, 0, PI / 2).rotateX(PI).scale(1, 1.3, 0.35).rotateY(-a + PI / 2).translate(Math.cos(a) * 1.2, -1.04, Math.sin(a) * 1.2)); }
  GONDOLA = { dome, finial, bowl, floor, bars: merge(bars), rims: merge(rims), valance: merge(val) };
  GONDOLA_MATS = [new THREE.MeshPhysicalMaterial({ color: 0x3a1650, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
    new THREE.MeshPhysicalMaterial({ color: 0xb0480c, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide })];
}
function buildFerris() {
  if (!GONDOLA) gondolaGeos();
  const X = -40, Z = -16, HY = 16, RAD = 13;
  for (const [dx, dz] of [[-7, -3.4], [7, -3.4], [-7, 3.4], [7, 3.4]]) { cylBetween(new V3(X + dx, 0, Z + dz), new V3(X, HY, Z + Math.sign(dz) * 1.9), 0.3, M.rust); addCircle(X + dx, Z + dz, 0.6); }
  SB.add(boxGeo(7, 0.6, 7, 2), M.wood, X, 0.3, Z); addBox(X - 3.5, X + 3.5, Z - 3.5, Z - 1.5);
  const wheel = new THREE.Group(); wheel.position.set(X, HY, Z); scene.add(wheel);
  const wb = new Batcher();
  for (const z of [-1.4, 1.4]) { wb.add(new THREE.TorusGeometry(RAD, 0.18, 8, 120), M.rust, 0, 0, z); wb.add(new THREE.TorusGeometry(RAD * 0.55, 0.1, 6, 80), M.rust, 0, 0, z); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, c = Math.cos(a), s = Math.sin(a);
    for (const z of [-1.4, 1.4]) cylBetween(new V3(0, 0, z * 0.6), new V3(c * RAD, s * RAD, z), 0.08, M.rust, wb, 6);
    wb.add(new THREE.CylinderGeometry(0.07, 0.07, 2.8, 6), M.rust, c * RAD, s * RAD, 0, 0, { rx: PI / 2 }); }
  wb.add(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 24), M.iron, 0, 0, 0, 0, { rx: PI / 2 });
  wb.build(wheel);
  for (const z of [-1.85, 1.85]) { const f = bigPumpkin(wheel, 0, 0, z, 1.25, z > 0 ? 0 : PI); f.rotation.x = 0; }
  const bp = []; for (const z of [-1.45, 1.45]) { for (let i = 0; i < 100; i++) { const a = i / 100 * TAU; bp.push(new V3(Math.cos(a) * (RAD + 0.25), Math.sin(a) * (RAD + 0.25), z)); }
    for (let i = 0; i < 16; i++) for (let k = 1; k <= 8; k++) { const a = i / 16 * TAU, r = RAD * k / 9; bp.push(new V3(Math.cos(a) * r, Math.sin(a) * r, z * (0.6 + 0.4 * k / 9) + Math.sign(z) * 0.12)); } }
  const fb = makeBulbs(wheel, bp, PAL_SPOOK, 0.09); fb.userData.chase = true;
  const gondolas = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, piv = new THREE.Group(); piv.position.set(Math.cos(a) * RAD, Math.sin(a) * RAD, 0); wheel.add(piv);
    const g = new THREE.Group(); piv.add(g); const gb = new Batcher(); const mat = GONDOLA_MATS[i % 2];
    // Victorian birdcage car: turned bowl, curved bars, onion-dome canopy with scalloped valance, gilded rims
    gb.add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), M.iron, 0, -0.27, 0);
    gb.add(GONDOLA.dome, mat, 0, 0, 0); gb.add(GONDOLA.finial, M.brass, 0, 0, 0);
    gb.add(GONDOLA.bowl, mat, 0, 0, 0); gb.add(GONDOLA.floor, M.woodDark, 0, 0, 0);
    gb.add(GONDOLA.bars, M.brass, 0, 0, 0); gb.add(GONDOLA.rims, M.brass, 0, 0, 0); gb.add(GONDOLA.valance, mat, 0, 0, 0);
    gb.add(roundBox(1.5, 0.12, 0.5, 0.04, 1), M.velvet, 0, -2.55, 0.45); gb.add(roundBox(1.5, 0.12, 0.5, 0.04, 1), M.velvet, 0, -2.55, -0.45);
    gb.add(new THREE.SphereGeometry(0.11, 12, 8), M.glass, 0, -1.12, 0, 0, { shadow: false });
    gb.build(g); gondolas.push({ g, ph: i * 0.7 });
  }
  const seat = new THREE.Object3D(); seat.position.set(-0.5, -2.75, 0); seat.rotation.y = -PI / 2; gondolas[0].g.add(seat);
  const FE = { rock: 0, rockV: 0, gd: gondolas[0], speed: 0.085 };
  RIDES.ferris = { name: 'The Eye', seat, eye: 1.25, exit: [X + 6, Z + 7], exitYaw: yawTo(X + 6, Z + 7, X, Z), dur: 62,
    hint: 'A / D — rock the gondola  ·  look around: the whole park is below  ·  E — leave', done: 'The Eye closes. For now.',
    onBoard: () => { let lo = 1e9; const v = new V3(); for (const gd of gondolas) { gd.g.getWorldPosition(v); if (v.y < lo) { lo = v.y; FE.gd = gd; } } FE.gd.g.add(seat); },
    ctrl: (dt) => { const f = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); FE.rockV += (f * 1.6 - FE.rock * 2.2) * dt - FE.rockV * 0.4 * dt; FE.rock += FE.rockV * dt; if (Math.abs(FE.rockV) > 0.5 && Math.random() < dt * 3) AU.creak(seat.getWorldPosition(new V3())); } };
  addInteract({ x: X + 1, z: Z + 4.6, r: 3.4, label: 'Board The Eye', action: () => boardRide('ferris') });
  addMarker(X + 1, Z + 4.6, 'RIDE', 0xb796ff);
  addPool(X, Z, 10, 0xb070ff, 0.35);
  onUpdate((dt, t) => {
    const riding = S.ride === RIDES.ferris; FE.speed = damp(FE.speed, riding ? 0.104 : 0.085, 1, dt); wheel.rotation.z += dt * FE.speed;
    if (!riding) FE.rock = damp(FE.rock, 0, 1, dt);
    for (const gd of gondolas) gd.g.rotation.z = -wheel.rotation.z + Math.sin(t * 0.9 + gd.ph) * 0.04 + (gd === FE.gd ? FE.rock * 0.35 : 0);
  });
}

/* ---------- Nightmare Express roller coaster ---------- */
const COASTER = {};
function buildCoaster() {
  const cps = [[-58, 4, 30], [-58, 4, 14], [-58, 9, 4], [-58, 19, -9], [-58.5, 21, -15], [-60, 6, -30], [-62, 12, -44], [-65, 5, -57], [-71, 9, -72], [-81, 8, -70],
    [-85, 6, -56], [-80, 13, -40], [-76, 6, -25], [-82, 8, -8], [-78, 14, 8], [-81, 7, 24], [-78, 6, 42], [-70, 5, 50], [-62, 4.5, 45]];
  const curve = new THREE.CatmullRomCurve3(cps.map(p => new V3(...p)), true, 'centripetal');
  const N = 700, L = curve.getLength(); COASTER.curve = curve; COASTER.L = L;
  const pts = curve.getSpacedPoints(N), left = [], right = [], spine = [];
  for (let i = 0; i < N; i++) { const t = curve.getTangentAt(i / N), side = new V3(t.z, 0, -t.x).normalize();
    left.push(pts[i].clone().addScaledVector(side, 0.55)); right.push(pts[i].clone().addScaledVector(side, -0.55)); spine.push(pts[i].clone().add(new V3(0, -0.38, 0))); }
  const tube = (arr, r, mat) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arr, true), N * 2, r, 6, true), mat); m.castShadow = true; scene.add(m); };
  tube(left, 0.07, M.rust); tube(right, 0.07, M.rust); tube(spine, 0.16, M.iron);
  const o = new THREE.Object3D(), ties = [], sups = [], lights = [];
  for (let d = 0; d < L; d += 1) { const u = d / L, p = curve.getPointAt(u), t = curve.getTangentAt(u);
    o.position.copy(p).y -= 0.12; o.lookAt(o.position.clone().add(t)); o.updateMatrix(); ties.push(o.matrix.clone()); }
  for (let d = 0; d < L; d += 5.5) { const u = d / L, p = curve.getPointAt(u); if (p.y < 2.5) continue;
    const h = p.y - 0.45; o.position.set(p.x, 0, p.z); o.rotation.set(0, 0, 0); o.scale.set(1, h, 1); o.updateMatrix(); sups.push(o.matrix.clone()); o.scale.set(1, 1, 1);
    addCircle(p.x, p.z, 0.35); }
  for (let d = 0; d < L; d += 2.6) { const u = d / L, p = curve.getPointAt(u), t = curve.getTangentAt(u), side = new V3(t.z, 0, -t.x).normalize();
    lights.push(p.clone().addScaledVector(side, 0.75).add(new V3(0, -0.15, 0)), p.clone().addScaledVector(side, -0.75).add(new V3(0, -0.15, 0))); }
  const ti = new THREE.InstancedMesh(bev(1.5, 0.1, 0.24), M.woodDark, ties.length); ties.forEach((m, i) => ti.setMatrixAt(i, m)); ti.castShadow = true; scene.add(ti);
  const si = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 10).translate(0, 0.5, 0), M.woodDark, sups.length); sups.forEach((m, i) => si.setMatrixAt(i, m)); si.castShadow = true; scene.add(si);
  const cl = makeBulbs(scene, lights, [hdr(0xff6a10, 5), hdr(0xff6a10, 5), hdr(0x9a50ff, 5), hdr(0x9a50ff, 5)], 0.07); cl.userData.chase = true;
  // station platform & stairs
  wallBox(-56.6, -52.4, 0, 3.7, 12, 32, M.stoneDark);
  SB.add(boxGeo(5, 0.15, 21, 2), M.wood, -54.5, 3.75, 22);
  for (const z of [12.5, 31.5]) for (const x of [-56.3, -52.7]) SB.add(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), M.iron, x, 5.35, z);
  SB.add(boxGeo(6.5, 0.25, 21, 2), M.roof, -55.5, 7.05, 22, 0, { rz: 0.12 });
  for (let i = 0; i < 8; i++) SB.add(boxGeo(1.6, 0.46, 0.5, 1), M.stone, -51.6, 0.23 + i * 0.46, 22 - 4 + i * 0.5, 0, { sy: 1 + i * 0.0 });
  const st = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: signTex('NIGHTMARE EXPRESS', { size: 92, color: '#ff5a3a', glow: '#ff0000' }), transparent: true, color: hdr(0xffffff, 1.6), depthWrite: false }));
  st.position.set(-52.2, 7.9, 22); st.rotation.y = PI / 2; scene.add(st);
  makeBulbs(scene, Array.from({ length: 30 }, (_, i) => new V3(-52.3, 6.8, 11.5 + i * 0.72)), PAL_SPOOK, 0.07);
  addPool(-51, 22, 5, 0xff5a3a, 0.5);
  // the train
  const cars = [], carMat = new THREE.MeshStandardMaterial({ color: 0x24102e, metalness: 0.6, roughness: 0.35 });
  for (let k = 0; k < 3; k++) {
    const car = new THREE.Group(); scene.add(car); const b = new Batcher();
    b.add(coasterCarGeo(), M.carPaint, 0, 0, 0);
    b.add(roundBox(1.1, 0.13, 0.62, 0.05, 1), M.velvet, 0, 0.55, 0.2); b.add(roundBox(1.1, 0.5, 0.12, 0.05, 1), M.velvet, 0, 0.8, -0.12, 0, { rx: -0.15 });
    b.add(new THREE.TorusGeometry(0.42, 0.03, 8, 20, PI), M.brass, 0, 0.62, 0.5, 0, { rx: -0.5 });
    b.add(roundBox(1.25, 0.16, 1.7, 0.04, 1), M.iron, 0, 0.03, 0); for (const sx of [-0.62, 0.62]) for (const sz of [-0.62, 0.62]) b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), M.iron, sx, -0.06, sz, 0, { rz: PI / 2 });
    if (k === 0) { b.add(boxGeo(1.2, 0.18, 0.2, 1), M.brass, 0, 0.5, 1.12); b.add(new THREE.SphereGeometry(0.09, 8, 6), M.glass, -0.45, 0.45, 1.2, 0, { shadow: false }); b.add(new THREE.SphereGeometry(0.09, 8, 6), M.glass, 0.45, 0.45, 1.2, 0, { shadow: false }); }
    b.build(car); cars.push(car);
  }
  const seat = new THREE.Object3D(); seat.position.set(0, 1.05, 0.1); seat.rotation.y = PI; cars[0].add(seat);
  const lamp = new THREE.SpotLight(0xffd0a0, 80, 55, 0.42, 0.55, 1.6); lamp.position.set(0, 0.6, 1.2); lamp.target.position.set(0, -0.6, 8); cars[0].add(lamp, lamp.target); LIGHTS.trainLamp = lamp;
  RIDES.coaster = { name: 'Nightmare Express', seat, eye: 0.55, exit: [-50, 24], exitYaw: yawTo(-50, 24, -40, 20),
    hint: 'Hold Space — hands up & scream!  ·  E — bail out', done: 'Please collect your soul from the bin on the left.',
    onBoard: () => { COASTER.u = COASTER.stationU; COASTER.v = 3; COASTER.lap = 0; },
    progress: () => COASTER.lap / (COASTER.L - 3),
    ctrl: () => { if (keys.Space && !COASTER.armsUp) { COASTER.armsUp = true; AU.scream(null, 0.14); } if (!keys.Space) COASTER.armsUp = false; },
    fov: () => clamp((COASTER.v - 5) * 1.1, 0, 18) + (keys.Space ? 5 : 0), shake: () => COASTER.v > 9 ? (COASTER.v - 9) * 0.004 : 0 };
  addInteract({ x: -50.3, z: 20, r: 3.4, label: 'Ride the Nightmare Express', action: () => boardRide('coaster') });
  addMarker(-50.3, 20, 'RIDE', 0xff5a3a);
  // per-sample section classification (station / chain lift / free run)
  const cls = new Uint8Array(N); let Hmax = 0;
  for (let i = 0; i < N; i++) { const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u); Hmax = Math.max(Hmax, p.y);
    cls[i] = (p.x > -61 && p.z > 9 && p.z < 33 && p.y < 5) ? 1 : (p.x > -61 && p.z < 10 && p.z > -15 && t.y > 0.08) ? 2 : 0; }
  let stI = 0; for (let i = 1; i < N; i++) if (cls[i] === 1 && cls[i - 1] !== 1) { stI = i; break; }
  Object.assign(COASTER, { u: 0.02, v: 4, cars, cls, N, Hmax, screamed: false, stationU: stI / N, lap: 0 });
  const tmp = new V3(), t2 = new V3();
  onUpdate((dt) => {
    const C = COASTER, i = Math.floor(C.u * N) % N, p = curve.getPointAt(C.u), c = C.cls[i];
    const target = c === 1 ? 3.2 : c === 2 ? 4.5 : Math.sqrt(2 * 9.8 * Math.max(0.4, C.Hmax + 1.2 - p.y)) * 0.93 + 2;
    C.v = damp(C.v, target, c ? 2.5 : 8, dt); C.u = (C.u + C.v * dt / L) % 1; C.lap += C.v * dt;
    C.lift = c === 2;
    cars.forEach((car, k) => { const uk = (C.u - k * 2.35 / L + 1) % 1; const pk = curve.getPointAt(uk); curve.getTangentAt(uk, tmp); curve.getTangentAt((uk + 0.006) % 1, t2);
      car.position.copy(pk); car.lookAt(pk.x + tmp.x, pk.y + tmp.y, pk.z + tmp.z);
      const kk = tmp.x * t2.z - tmp.z * t2.x; car.rotateZ(clamp(kk * C.v * 0.35, -0.5, 0.5)); });
  });
}

export { RIDES, buildCarousel, buildSwing, buildFerris, COASTER, buildCoaster };
