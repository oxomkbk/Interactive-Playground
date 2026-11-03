import * as THREE from 'three';
import { PI, R, TAU, V3, damp, lerp, rand, setSeed } from '../core/utils.js';
import { chunkedInstances, lathe, merge, roundBox, taper } from './props.js';
import { Batcher, SB, addBox, addCircle, addInteract, addLamp, addPool, addPumpkin, onUpdate, scaleUV } from '../core/registry.js';
import { M, TX } from '../core/materials.js';
import { makeScarecrow } from './gate-street.js';
import { addMarker, makeSign, markDone } from './attractions.js';
import { FX_OBJECTS, LIGHTS, lantern, pointLight, scene } from '../core/renderer.js';
import { t } from '../core/i18n.js';
import { PUMPKIN_GEO } from './landscape.js';
import { LANTERN_PROFILE } from './lake.js';
import { flameMat } from '../core/shaders.js';
import { AU } from '../core/audio.js';
import { S, boardRide, keys } from '../game/play.js';
import { toast } from '../ui/ui.js';
import { FW } from './atmosphere.js';
import { RIDES } from './rides.js';
/* =========================================================================
   PUMPKIN FIELDS — an endless lantern-lit patch, rustling corn rows, a scarecrow army,
   the 23-metre PUMPKIN KING colossus (awaken him!) and the Hayride that tours it all.
   ========================================================================= */
const KING = { awake: 0, t: -1, jets: [] };
const HAY = {};
function cornStalkGeo() {
  const parts = [new THREE.CylinderGeometry(0.018, 0.035, 2.4, 5).translate(0, 1.2, 0)];
  for (let i = 0; i < 6; i++) { const lf = new THREE.PlaneGeometry(0.1, 0.8); lf.translate(0, 0.4, 0); lf.rotateZ(0.8 + R(-0.2, 0.3)); lf.rotateY(i * 2.1); lf.translate(0, 0.5 + i * 0.28, 0); parts.push(lf); }
  parts.push(new THREE.CylinderGeometry(0.03, 0.05, 0.28, 6).translate(0.05, 1.5, 0).rotateZ(-0.3));
  return merge(parts);
}
function buildFields() {
  setSeed(6060);
  const F = { x0: 84, x1: 146, z0: 16, z1: 76 };
  SB.add(new THREE.PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0).rotateX(-PI / 2), M.leafPile, (F.x0 + F.x1) / 2, 0.015, (F.z0 + F.z1) / 2, 0, { shadow: false });
  // Hayride track (closed loop round the field)
  const track = new THREE.CatmullRomCurve3([[90, 22], [112, 19], [136, 22], [143, 40], [140, 64], [118, 72], [94, 70], [86, 50]].map(([x, z]) => new V3(x, 0, z)), true, 'centripetal');
  HAY.track = track; HAY.L = track.getLength();
  const tp = track.getSpacedPoints(200);
  for (let i = 0; i < 200; i++) { const a = tp[i], b = tp[(i + 1) % 200], len = a.distanceTo(b); const g = new THREE.PlaneGeometry(2.6, len + 0.1).rotateX(-PI / 2); scaleUV(g, 1, len / 3);
    SB.add(g, M.ground, (a.x + b.x) / 2, 0.03, (a.z + b.z) / 2, Math.atan2(b.x - a.x, b.z - a.z), { shadow: false }); }
  const nearTrack = (x, z, m) => tp.some(p => Math.hypot(p.x - x, p.z - z) < m);
  // the patch: hundreds of pumpkins of every size, a fifth of them carved and glowing
  const PK = { x: 120, z: 50 };
  for (let i = 0; i < 520; i++) { const x = R(F.x0 + 1, F.x1 - 14), z = R(F.z0 + 1, F.z1 - 1);
    if (nearTrack(x, z, 2.6) || Math.hypot(x - PK.x, z - PK.z) < 11) continue;
    const big = rand() < 0.06; addPumpkin(x, 0, z, big ? R(0.9, 1.5) : R(0.22, 0.6), rand() < 0.2, R(0, TAU)); if (big) addCircle(x, z, 1.1); }
  // corn rows along the eastern edge
  const corn = []; for (let x = F.x1 - 12; x < F.x1 - 0.8; x += 1.25) for (let z = F.z0 + 1; z < F.z1 - 1; z += 0.9) { if (nearTrack(x, z, 2.4)) continue; corn.push({ x: x + R(-0.2, 0.2), z: z + R(-0.2, 0.2), s: R(0.85, 1.15) }); }
  chunkedInstances(cornStalkGeo(), new THREE.MeshStandardMaterial({ color: 0x8a7034, roughness: 1, side: THREE.DoubleSide }), corn, (o, c) => { o.position.set(c.x, 0, c.z); o.rotation.y = c.x * 7.3; o.scale.setScalar(c.s); }, { shadow: true, cell: 30 });
  addBox(F.x1 - 12.4, F.x1, F.z0, F.z1 - 0);
  // scarecrow army
  for (let i = 0; i < 9; i++) { const x = R(F.x0 + 3, F.x1 - 16), z = R(F.z0 + 3, F.z1 - 3); if (nearTrack(x, z, 3) || Math.hypot(x - PK.x, z - PK.z) < 12) continue; makeScarecrow(x, z, R(0, TAU)); }
  // fence & gate
  for (let x = F.x0; x <= F.x1; x += 2.5) { SB.add(roundBox(0.12, 1.1, 0.12, 0.03, 1), M.woodDark, x, 0.55, F.z0 - 0.3); }
  SB.add(roundBox(F.x1 - F.x0, 0.08, 0.06, 0.02, 1), M.woodDark, (F.x0 + F.x1) / 2, 0.9, F.z0 - 0.3);
  for (const z of [30, 46, 62]) addLamp(F.x0 - 1, z, 4);
  makeSign('PUMPKIN FIELDS', 7, 1.7, F.x0 - 1.2, 5.2, 46, -PI / 2, { size: 120, color: '#ffb050', sub: 'home of the Pumpkin King' });
  buildPumpkinKing(PK.x, PK.z); buildHayride();
}
/* ---------- The Pumpkin King: sculpted colossus with a jack-o'-lantern head, crown, lantern and scythe ---------- */
function buildPumpkinKing(X, Z) {
  const g = new THREE.Group(); g.position.set(X, 0, Z); g.rotation.y = -PI / 2; scene.add(g); KING.g = g;   // faces west, towards the park
  const b = new Batcher();
  b.add(lathe([[0.001, 0], [7.2, 0], [7.2, 0.6], [6.4, 0.8], [6.4, 1.6], [5.6, 1.9], [5.6, 2.6], [0.001, 2.6]], 40), M.stoneDark, 0, 0, 0);
  // robe with deep folds
  const robe = lathe([[3.6, 0], [3.4, 1.5], [2.9, 4], [2.5, 7], [2.2, 9.5], [2.4, 10.6], [2.0, 11.6], [0.001, 11.8]], 48), rp = robe.attributes.position;
  for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), z = rp.getZ(i), y = rp.getY(i), a = Math.atan2(z, x), f = 1 + 0.07 * Math.sin(a * 9) * (1 - y / 12) + 0.03 * Math.sin(a * 23); rp.setX(i, x * f); rp.setZ(i, z * f); }
  robe.computeVertexNormals(); b.add(robe, M.cloth, 0, 2.6, 0);
  b.add(new THREE.SphereGeometry(1, 28, 18), M.cloth, 0, 13.6, 0, 0, { sx: 3.1, sy: 1.3, sz: 1.9 });
  for (let i = 0; i < 9; i++) { const a = PI * 0.15 + i / 8 * PI * 0.7; b.add(new THREE.ConeGeometry(0.35, 2.6, 6), M.cloth, Math.cos(a) * 2.6, 15.2, -Math.sin(a) * 1.4 - 0.4, 0, { rx: -0.35, rz: Math.cos(a) * 0.4 }); }
  // arms: left holds a lantern forward, right grips a scythe
  const arm = (s, el, hd) => { const sh = new V3(s * 2.8, 13.6, 0); b.addMatrix(taper(sh, el, 0.75, 0.55, 14), M.cloth, new THREE.Matrix4()); b.addMatrix(taper(el, hd, 0.5, 0.36, 14), M.cloth, new THREE.Matrix4());
    b.add(new THREE.SphereGeometry(0.62, 16, 12), M.cloth, el.x, el.y, el.z); b.add(new THREE.SphereGeometry(0.55, 16, 12), M.lacquerBlack, hd.x, hd.y, hd.z, 0, { sy: 1.2 }); };
  arm(1, new V3(3.6, 10.6, 1.6), new V3(2.6, 9.6, 4.0)); arm(-1, new V3(-3.8, 10.8, 0.8), new V3(-3.4, 10.4, 2.6));
  b.addMatrix(taper(new V3(-3.4, 1.4, 2.8), new V3(-3.4, 19.5, 2.5), 0.16, 0.12, 10), M.woodDark, new THREE.Matrix4());
  const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.quadraticCurveTo(3.4, 1.4, 5.2, -1.6); blade.quadraticCurveTo(3.2, 0.2, 0, -0.55); blade.lineTo(0, 0);
  b.add(new THREE.ExtrudeGeometry(blade, { depth: 0.08, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 24 }), M.iron, -3.4, 19.2, 2.45, PI / 2);
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), M.iron, 2.6, 8.6, 4.0);
  b.add(taper(new V3(0, 14.3, 0), new V3(0, 15.8, 0.2), 1.0, 0.7, 16), M.cloth, 0, 0, 0);
  // creeping vines spiralling up the robe
  for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * TAU * 1.6 + k * 2.1, r = lerp(3.7, 2.3, t); pts.push(new V3(Math.cos(a) * r, 2.7 + t * 10, Math.sin(a) * r)); }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.12, 6), M.stem, 0, 0, 0); }
  b.build(g);
  // the head: a colossal carved pumpkin with its own glowing material, and a thorny golden crown
  KING.faceMat = new THREE.MeshPhysicalMaterial({ map: TX.face.map, emissiveMap: TX.face.emissiveMap, emissive: 0xff7a1a, emissiveIntensity: 2.2, roughness: 0.55, clearcoat: 0.35 });
  const head = new THREE.Mesh(PUMPKIN_GEO, KING.faceMat); head.scale.setScalar(3.6); head.position.set(0, 19.4, 0.3); head.castShadow = true; g.add(head); KING.head = head;
  const crown = new THREE.Group(); crown.position.set(0, 22.1, 0.3); g.add(crown);
  crown.add(new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 8, 40).rotateX(PI / 2), M.gold));
  for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, c = new THREE.Mesh(new THREE.ConeGeometry(0.22, i % 2 ? 1.1 : 1.8, 8), M.gold); c.position.set(Math.cos(a) * 1.9, i % 2 ? 0.55 : 0.9, Math.sin(a) * 1.9); crown.add(c);
    if (i % 2 === 0) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), M.glowRed); gem.position.set(Math.cos(a) * 1.95, 0.25, Math.sin(a) * 1.95); crown.add(gem); } }
  const lantern = new THREE.Mesh(lathe(LANTERN_PROFILE, 14), M.glass); lantern.scale.setScalar(4); lantern.position.set(2.6, 6.2, 4.0); g.add(lantern); KING.lantern = lantern;
  pointLight('king', 0xff7a20, 260, 60, X - 4, 17, Z);
  addCircle(X, Z, 7.4); addPool(X, Z, 16, 0xff7a20, 0.5);
  // fire jets that erupt when he wakes
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, jx = X + Math.cos(a) * 10, jz = Z + Math.sin(a) * 10;
    SB.add(new THREE.CylinderGeometry(0.5, 0.7, 0.6, 12), M.iron, jx, 0.3, jz); addCircle(jx, jz, 0.7);
    const f = new THREE.Group(); f.position.set(jx, 0.6, jz); scene.add(f); f.scale.set(1, 0.001, 1); f.visible = false;
    for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 9).translate(0, 4.5, 0), flameMat(0xffe0a0, 0xff3000, i * 1.3 + k)); m.rotation.y = k * PI / 2; f.add(m); FX_OBJECTS.push(m); }
    KING.jets.push(f); }
  addInteract({ x: X - 8.2, z: Z, r: 3.4, label: () => KING.t >= 0 ? 'The King is awake…' : 'Awaken the Pumpkin King', action: awakenKing });
  addMarker(X - 8.2, Z + 2, 'AWAKEN', 0xff8a2a);
  onUpdate((dt, t) => {
    const k = KING; k.lantern.material = M.glass;
    if (k.t >= 0) { k.t += dt; const up = k.t < 18; k.awake = damp(k.awake, up ? 1 : 0, up ? 1.2 : 0.6, dt);
      if (k.t > 22) { k.t = -1; } }
    else k.awake = damp(k.awake, 0, 0.6, dt);
    k.faceMat.emissiveIntensity = 2.2 + k.awake * 10 + Math.sin(t * 9) * 0.25 * (1 + k.awake * 4);
    k.head.rotation.y = Math.sin(t * 0.25) * 0.15 + k.awake * Math.sin(t * 0.8) * 0.5; k.head.position.y = 19.4 + k.awake * Math.sin(t * 6) * 0.05;
    LIGHTS.king.intensity = 260 * (1 + k.awake * 4);
    k.jets.forEach((j, i) => { const on = k.awake > 0.3 && Math.sin(t * 3 + i * 0.9) > -0.6; j.visible = k.awake > 0.05; j.scale.y = damp(j.scale.y, on ? k.awake * (0.9 + 0.3 * Math.sin(t * 11 + i)) : 0.001, 8, dt); });
  });
}
function awakenKing() {
  if (KING.t >= 0) return; KING.t = 0; markDone('king'); AU.roar(KING.head.getWorldPosition(new V3())); S.shake = 1.4;
  toast('The Pumpkin King awakens!', 'Fire walks the fields. Bow, mortal.', 'blood');
  setTimeout(() => { for (let i = 0; i < 14; i++) setTimeout(() => FW.launch(KING.g.position.x + R(-14, 14), KING.g.position.z + R(-14, 14)), i * 380); }, 1800);
  setTimeout(() => AU.roar(KING.head.getWorldPosition(new V3())), 9000);
}
/* ---------- Hayride: a rusty tractor hauls a hay wagon around the patch ---------- */
function buildHayride() {
  const tractor = new THREE.Group(), wagon = new THREE.Group(); scene.add(tractor, wagon); const tb = new Batcher(), wb = new Batcher();
  const red = new THREE.MeshPhysicalMaterial({ color: 0x7a1c10, roughness: 0.55, metalness: 0.3, clearcoat: 0.4 });
  tb.add(roundBox(1.3, 0.9, 2.4, 0.15, 1), red, 0, 1.1, 0.2); tb.add(roundBox(1.1, 0.6, 1.0, 0.1, 1), red, 0, 1.6, 1.0);
  tb.add(roundBox(1.2, 1.2, 0.08, 0.03, 1), M.iron, 0, 2.2, -0.7); tb.add(roundBox(1.3, 0.08, 1.3, 0.03, 1), M.iron, 0, 2.8, -0.4);
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.62, -0.18]) tb.add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), M.iron, sx, 2.2, sz);
  for (const sx of [-0.85, 0.85]) { tb.add(new THREE.CylinderGeometry(0.75, 0.75, 0.42, 22), M.rubber, sx, 0.75, -0.55, 0, { rz: PI / 2 }); tb.add(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), M.rubber, sx * 0.85, 0.42, 1.3, 0, { rz: PI / 2 }); }
  tb.add(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), M.iron, 0.4, 2.1, 1.3); tb.build(tractor);
  for (const sx of [-0.35, 0.35]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M.glass); hl.position.set(sx, 1.25, 1.42); tractor.add(hl); }
  wb.add(roundBox(2.0, 0.2, 3.6, 0.05, 1), M.wood, 0, 0.8, 0);
  for (const s of [-1, 1]) wb.add(roundBox(0.08, 0.5, 3.6, 0.03, 1), M.woodDark, s * 1.0, 1.15, 0);
  for (const z of [-1.1, 0, 1.1]) wb.add(roundBox(1.6, 0.42, 0.6, 0.12, 1), M.straw, 0, 1.12, z);
  for (const sx of [-0.8, 0.8]) for (const sz of [-1.1, 1.1]) wb.add(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16), M.woodDark, sx * 1.15, 0.4, sz, 0, { rz: PI / 2 });
  wb.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), M.woodDark, 0.95, 1.6, 1.7); wb.build(wagon);
  const wl = new THREE.Mesh(lathe(LANTERN_PROFILE, 10), M.glass); wl.position.set(0.95, 2.35, 1.7); wagon.add(wl);
  const seat = new THREE.Object3D(); seat.position.set(0, 1.35, -0.6); wagon.add(seat);
  HAY.u = 0.1; HAY.tractor = tractor; HAY.wagon = wagon;
  RIDES.hayride = { name: 'Haunted Hayride', seat, eye: 0.85, exit: [86.5, 30], exitYaw: -PI / 2,
    hint: 'Space — honk the horn  ·  watch the scarecrows…  ·  E — hop off', done: 'Straw in your hair. Fear in your heart.',
    onBoard: () => { HAY.u = 0.92; HAY.lap = 0; HAY.scares = 0; }, progress: () => HAY.lap / HAY.L,
    ctrl: () => { if (keys.Space && !HAY.honk) { HAY.honk = true; AU.horn(); } if (!keys.Space) HAY.honk = false; }, shake: () => 0.008 };
  addInteract({ x: 87.5, z: 28, r: 3, label: 'Ride the Haunted Hayride', action: () => boardRide('hayride') }); addMarker(87.5, 28, 'RIDE', 0xffb050);
  const tmp = new V3(), tng = new V3();
  onUpdate((dt, t) => {
    const riding = S.ride === RIDES.hayride, sp = riding ? 4.2 : 3.2; HAY.u = (HAY.u + sp * dt / HAY.L) % 1; if (riding) HAY.lap += sp * dt;
    const place = (obj, u, y) => { HAY.track.getPointAt(u, tmp); HAY.track.getTangentAt(u, tng); obj.position.set(tmp.x, y + Math.sin(t * 7 + u * 40) * 0.02, tmp.z); obj.lookAt(tmp.x + tng.x, obj.position.y, tmp.z + tng.z); };
    place(tractor, HAY.u, 0); place(wagon, (HAY.u - 4.6 / HAY.L + 1) % 1, 0);
    if (riding && Math.random() < dt * 0.12) { const p = wagon.position; AU.cackle(new V3(p.x + R(-6, 6), 1.5, p.z + R(-6, 6))); S.shake = 0.25; }
  });
}

export { KING, HAY, cornStalkGeo, buildFields, buildPumpkinKing, awakenKing, buildHayride };
