import * as THREE from 'three';
import { cnv, toTex } from '../core/textures.js';
import { PI, R, TAU, V3, hdr, pick, rand, setSeed } from '../core/utils.js';
import { Batcher, PLATFORMS, SB, addBox, addCircle, addInteract, addLamp, addTomb, boxGeo, onUpdate } from '../core/registry.js';
import { COL_PROFILE, balusterGeo, lathe, roundBox } from './props.js';
import { M } from '../core/materials.js';
import { FX_OBJECTS, LIGHTS, pointLight, scene } from '../core/renderer.js';
import { coneMat } from '../core/shaders.js';
import { candle } from './manor.js';
import { addMarker, makeSign, markDone } from './attractions.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/ui.js';
import { AU } from '../core/audio.js';
import { BATS, fireworksShow } from './atmosphere.js';
/* =========================================================================
   CATHEDRAL OF ECHOES — a gothic cathedral on a raised necropolis terrace: twin spired towers, a blazing rose window,
   flying buttresses, lancet windows of stained glass, a walk-in nave with pews and pillars, and the GREAT ORGAN SHOW.
   ========================================================================= */
const CATH = { windows: [], beams: [], show: -1 };
function stainedTex(rose) {
  const [c, x] = cnv(512); x.fillStyle = '#05030a'; x.fillRect(0, 0, 512, 512);
  const cols = ['#ff3a2a', '#ffb030', '#3a7aff', '#8a3aff', '#30ff9a', '#ff5ab0'];
  if (rose) { for (let ring = 0; ring < 4; ring++) for (let i = 0; i < 16; i++) { const a0 = i / 16 * TAU, a1 = (i + 1) / 16 * TAU, r0 = 30 + ring * 55, r1 = r0 + 50;
      x.fillStyle = cols[(i + ring * 2) % 6]; x.beginPath(); x.arc(256, 256, r1, a0 + 0.03, a1 - 0.03); x.arc(256, 256, r0, a1 - 0.03, a0 + 0.03, true); x.fill(); }
    x.fillStyle = '#ffd070'; x.beginPath(); x.arc(256, 256, 26, 0, TAU); x.fill(); x.strokeStyle = '#05030a'; x.lineWidth = 10; x.beginPath(); x.arc(256, 256, 250, 0, TAU); x.stroke(); }
  else { for (let y = 0; y < 512; y += 64) for (let xx = 0; xx < 512; xx += 64) { x.fillStyle = cols[((xx + y) / 64 | 0) % 6]; x.fillRect(xx + 4, y + 4, 56, 56); }
    x.fillStyle = '#05030a'; for (let i = 0; i < 7; i++) x.fillRect(0, i * 73, 512, 6); x.fillRect(250, 0, 12, 512); }
  return toTex(c, { repeat: false });
}
function lancetShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w * 0.8); s.quadraticCurveTo(w / 2, h - w * 0.15, 0, h); s.quadraticCurveTo(-w / 2, h - w * 0.15, -w / 2, h - w * 0.8); s.lineTo(-w / 2, 0); return s; }
function buildCathedral() {
  setSeed(8181);
  const TY = 2.4, T = { x0: -30, x1: 30, z0: -178, z1: -130 };
  // terrace + grand stair
  SB.add(roundBox(T.x1 - T.x0, TY, T.z1 - T.z0, 0.15, 3), M.stoneDark, 0, TY / 2, (T.z0 + T.z1) / 2); PLATFORMS.push({ x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1, h: TY });
  for (let i = 0; i < 8; i++) { const h = (i + 1) * TY / 8, z = T.z1 + 7.5 - i; SB.add(roundBox(13, h, 1.02, 0.04, 2), M.stone, 0, h / 2, z); PLATFORMS.push({ x0: -6.5, x1: 6.5, z0: z - 0.5, z1: z + 0.5, h }); }
  for (const s of [-1, 1]) { SB.add(roundBox(1.2, 3.6, 9, 0.08, 2), M.stoneDark, s * 7.1, 1.8, T.z1 + 4); addBox(s * 7.1 - 0.6, s * 7.1 + 0.6, T.z1, T.z1 + 8.5);
    SB.add(new THREE.SphereGeometry(0.5, 14, 10), M.stone, s * 7.1, 3.9, T.z1 + 8.2); }
  addBox(T.x0 - 0.4, T.x0, T.z0, T.z1); addBox(T.x1, T.x1 + 0.4, T.z0, T.z1); addBox(T.x0, T.x1, T.z0 - 0.4, T.z0); addBox(T.x0, -6.5, T.z1, T.z1 + 0.4); addBox(6.5, T.x1, T.z1, T.z1 + 0.4);
  for (let x = T.x0; x <= T.x1; x += 2.2) if (Math.abs(x) > 7) { SB.add(balusterGeo(), M.stone, x, TY, T.z1 - 0.2, 0, { s: 1.3 }); }
  SB.add(roundBox(T.x1 - T.x0, 0.14, 0.4, 0.04, 1), M.stone, 0, TY + 0.98, T.z1 - 0.2);
  // nave walls (with a portal and lancet windows), towers, spires, roof
  const NX = 10, NZ0 = -172, NZ1 = -142, H = 16, Y0 = TY;
  const cw = (x0, x1, y0, y1, z0, z1, mat = M.stone, col = true) => { SB.add(boxGeo(x1 - x0, y1 - y0, z1 - z0, 2.5), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); if (col) addBox(x0, x1, z0, z1); };
  cw(-NX, NX, Y0, Y0 + H, NZ0 - 0.8, NZ0); cw(-NX - 0.8, -NX, Y0, Y0 + H, NZ0, NZ1); cw(NX, NX + 0.8, Y0, Y0 + H, NZ0, NZ1);
  cw(-NX, -2.4, Y0, Y0 + H, NZ1, NZ1 + 0.8); cw(2.4, NX, Y0, Y0 + H, NZ1, NZ1 + 0.8); cw(-2.4, 2.4, Y0 + 6.2, Y0 + H, NZ1, NZ1 + 0.8, M.stone, false);
  const ra = Math.atan2(8, NX + 1); for (const s of [-1, 1]) SB.add(boxGeo(Math.hypot(NX + 1, 8) + 0.4, 0.5, NZ1 - NZ0 + 1.4, 2.5), M.roof, s * (NX + 1) / 2, Y0 + H + 4, (NZ0 + NZ1) / 2, 0, { rz: -s * ra });
  const gable = new THREE.Shape([new THREE.Vector2(-NX - 1, 0), new THREE.Vector2(NX + 1, 0), new THREE.Vector2(0, 8)]);
  for (const z of [NZ1 + 0.4, NZ0 - 0.4]) SB.add(new THREE.ExtrudeGeometry(gable, { depth: 0.8, bevelEnabled: false }).translate(0, 0, -0.4), M.stone, 0, Y0 + H, z);
  for (let z = NZ0; z <= NZ1; z += 0.8) SB.add(new THREE.ConeGeometry(0.06, 0.6, 5), M.iron, 0, Y0 + H + 8.2, z, 0, { shadow: false });
  // gothic portal
  const portal = new THREE.ExtrudeGeometry(lancetShape(5.6, 7.4), { depth: 0.5, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 });
  SB.add(portal, M.stoneDark, 0, Y0, NZ1 + 0.9); SB.add(new THREE.ShapeGeometry(lancetShape(4.6, 6.4)), M.dark, 0, Y0, NZ1 + 1.42, 0, { shadow: false });
  // rose window
  const roseMat = new THREE.MeshBasicMaterial({ map: stainedTex(true), color: hdr(0xffffff, 1.6) });
  const rose = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), roseMat); rose.position.set(0, Y0 + 11.4, NZ1 + 0.82); scene.add(rose); CATH.windows.push(roseMat);
  SB.add(new THREE.TorusGeometry(3.75, 0.3, 10, 48), M.stoneDark, 0, Y0 + 11.4, NZ1 + 0.9);
  const roseIn = rose.clone(); roseIn.rotation.y = PI; roseIn.position.z = NZ1 - 0.02; scene.add(roseIn);
  // lancet windows down both sides (outside + inside faces) and flying buttresses
  const winMat = new THREE.MeshBasicMaterial({ map: stainedTex(false), color: hdr(0xffffff, 1.3), side: THREE.DoubleSide }); CATH.windows.push(winMat);
  const lg = new THREE.ShapeGeometry(lancetShape(2.2, 8)); const uvA = lg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (uvA.getX(i) + 1.1) / 2.2, uvA.getY(i) / 8);
  for (let z = NZ0 + 4; z < NZ1 - 2; z += 5) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(lg, winMat); w.position.set(s * (NX + 0.82), Y0 + 4.5, z); w.rotation.y = s * PI / 2; scene.add(w);
    const wi = new THREE.Mesh(lg, winMat); wi.position.set(s * (NX - 0.02), Y0 + 4.5, z); wi.rotation.y = -s * PI / 2; scene.add(wi);
    SB.add(roundBox(1.6, 14, 2.2, 0.1, 2), M.stoneDark, s * (NX + 4.2), Y0 + 7, z + 2.5); addBox(s * (NX + 4.2) - 0.8, s * (NX + 4.2) + 0.8, z + 1.4, z + 3.6);
    SB.add(new THREE.ConeGeometry(0.7, 3, 4), M.roof, s * (NX + 4.2), Y0 + 15.5, z + 2.5, PI / 4);
    SB.add(new THREE.TorusGeometry(3.4, 0.35, 8, 20, PI / 2), M.stoneDark, s * (NX + 0.8), Y0 + 10, z + 2.5, s > 0 ? 0 : PI);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.8, 22, 20, 1, true).translate(0, -11, 0), coneMat(0xd0b0ff, 0.0, 6)); beam.position.set(s * (NX + 0.9), Y0 + 9, z); beam.rotation.z = s * 1.0; scene.add(beam); FX_OBJECTS.push(beam); CATH.beams.push(beam); }
  // twin towers with spires and pinnacles
  for (const s of [-1, 1]) { const tx = s * 13.2, tz = NZ1 - 2.2;
    cw(tx - 3.2, tx + 3.2, Y0, Y0 + 30, tz - 3.2, tz + 3.2, M.stone);
    for (const y of [Y0 + 10, Y0 + 20, Y0 + 29.6]) SB.add(roundBox(7.2, 0.5, 7.2, 0.08, 2), M.stoneDark, tx, y, tz);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { SB.add(roundBox(0.9, 3, 0.9, 0.08, 1), M.stone, tx + dx * 3, Y0 + 31.4, tz + dz * 3); SB.add(new THREE.ConeGeometry(0.55, 4.2, 8), M.roof, tx + dx * 3, Y0 + 35, tz + dz * 3); }
    SB.add(new THREE.ConeGeometry(3.4, 20, 8), M.roof, tx, Y0 + 40, tz, PI / 8);
    SB.add(new THREE.SphereGeometry(0.3, 12, 10), M.gold, tx, Y0 + 50.2, tz);
    for (const y of [Y0 + 14, Y0 + 23]) { const tw = new THREE.Mesh(new THREE.ShapeGeometry(lancetShape(1.6, 5)), winMat); tw.position.set(tx, y, tz + 3.22); scene.add(tw); } }
  // nave interior: pillars, pews, altar, candles, the Great Organ
  for (let z = NZ0 + 5; z < NZ1 - 3; z += 5) for (const s of [-1, 1]) { SB.add(lathe(COL_PROFILE, 16), M.stone, s * 5.6, Y0, z, 0, { sx: 1.6, sy: 3.4, sz: 1.6 }); addCircle(s * 5.6, z, 0.75); }
  for (let z = NZ0 + 9; z < NZ1 - 4; z += 1.6) for (const s of [-1, 1]) { SB.add(roundBox(3.6, 0.1, 0.5, 0.03, 1), M.woodDark, s * 2.8, Y0 + 0.5, z); SB.add(roundBox(3.6, 0.7, 0.08, 0.02, 1), M.woodDark, s * 2.8, Y0 + 0.75, z + 0.28); addBox(s * 2.8 - 1.8, s * 2.8 + 1.8, z - 0.25, z + 0.3); }
  SB.add(roundBox(4, 1.2, 1.6, 0.06, 1), M.stone, 0, Y0 + 0.6, NZ0 + 5.5); addBox(-2, 2, NZ0 + 4.7, NZ0 + 6.3);
  for (let i = 0; i < 14; i++) candle(-1.8 + (i % 7) * 0.6, Y0 + 1.2, NZ0 + 5.1 + (i < 7 ? 0 : 0.8));
  const organ = new Batcher(); organ.add(roundBox(10, 3, 2, 0.08, 2), M.woodDark, 0, Y0 + 1.5, NZ0 + 1.2);
  for (let i = 0; i < 25; i++) { const x = -6 + i * 0.5, h = 5 + Math.sin(i / 24 * PI) * 8 + (i % 2) * 1.2; organ.add(new THREE.CylinderGeometry(0.18, 0.18, h, 10), M.brass, x, Y0 + 3 + h / 2, NZ0 + 0.9); organ.add(new THREE.ConeGeometry(0.18, 0.4, 10), M.brass, x, Y0 + 3 + h + 0.2, NZ0 + 0.9); }
  organ.build(scene); addBox(-5.2, 5.2, NZ0, NZ0 + 2.3);
  for (let i = 0; i < 4; i++) { const ch = new THREE.Group(); ch.position.set(0, Y0 + 11, NZ0 + 6 + i * 6); scene.add(ch);
    ch.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 28).rotateX(PI / 2), M.brass)); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.candle); f.position.set(Math.cos(a) * 1.4, 0.15, Math.sin(a) * 1.4); ch.add(f); } }
  pointLight('cathedral', 0xb090ff, 90, 34, 0, Y0 + 10, -157);
  // necropolis terraces: tombs, mausolea, candles
  for (let i = 0; i < 60; i++) { const x = pick([-1, 1]) * R(17.5, 28.5), z = R(T.z0 + 2, T.z1 - 2); addTomb(x, z, R(-0.3, 0.3) + (x > 0 ? -PI / 2 : PI / 2) * 0, R(0.8, 1.2)); if (rand() < 0.3) candle(x + 0.5, TY, z); }
  for (const [x, z] of [[-24, -170], [24, -170], [-24, -140], [24, -140]]) { const m = new Batcher(); m.add(roundBox(5, 0.5, 6, 0.06, 2), M.stone, 0, 0.25, 0); m.add(roundBox(4, 3.6, 5, 0.06, 2), M.stoneDark, 0, 2.3, 0);
    for (const sx of [-1.6, 1.6]) m.add(lathe(COL_PROFILE, 12), M.stone, sx, 0.5, 2.8, 0, { sx: 0.6, sy: 0.85, sz: 0.6 });
    m.add(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-2.4, 0), new THREE.Vector2(2.4, 0), new THREE.Vector2(0, 1.4)]), { depth: 6, bevelEnabled: false }).translate(0, 0, -3), M.roof, 0, 4.25, 0);
    const g = new THREE.Group(); g.position.set(x, TY, z); g.rotation.y = x > 0 ? -PI / 2 : PI / 2; scene.add(g); m.build(g); addBox(x - 3, x + 3, z - 3, z + 3); }
  for (const [x, z] of [[-6, -124], [6, -124], [-20, -133], [20, -133]]) addLamp(x, z, 4);
  makeSign('CATHEDRAL OF ECHOES', 9, 2.2, 0, 4.2, T.z1 + 9.5, 0, { size: 100, color: '#c7a0ff', glow: '#7a30ff', sub: 'the organ still plays at midnight' });
  addInteract({ x: 0, z: NZ0 + 7.2, r: 3, label: () => CATH.show >= 0 ? 'The organ thunders…' : 'Play the Great Organ (organ show)', action: organShow }); addMarker(0, NZ0 + 7.6, 'PLAY', 0xc7a0ff);
  onUpdate((dt, t) => {
    let k = 0; if (CATH.show >= 0) { CATH.show += dt; k = Math.min(1, CATH.show / 2) * (CATH.show < 34 ? 1 : Math.max(0, 1 - (CATH.show - 34) / 4)); if (CATH.show > 38) CATH.show = -1; }
    const pulse = k * (0.5 + 0.5 * Math.pow(Math.abs(Math.sin(t * 2.4)), 3));
    for (const w of CATH.windows) w.color.setScalar(1.3 + pulse * 3.5 + Math.sin(t * 0.7) * 0.08);
    for (const b of CATH.beams) b.material.uniforms.uI.value = 0.03 + pulse * 0.22;
    LIGHTS.cathedral.intensity = 90 + pulse * 260; LIGHTS.cathedral.color.setHSL((t * 0.05) % 1 * k + 0.72 * (1 - k), 0.7, 0.6);
  });
}
function organShow() {
  if (CATH.show >= 0) return; CATH.show = 0; markDone('organ'); toast('The Great Organ wakes', 'Every window burns. The dead are listening.', 'soul');
  const seq = [[[81, 69, 57], 0, 0.16], [[79, 67, 55], 0.16, 0.16], [[81, 69, 57], 0.32, 1.2], [[79, 67], 1.9, 0.12], [[77, 65], 2.02, 0.12], [[76, 64], 2.14, 0.12], [[74, 62], 2.26, 0.12], [[73, 61], 2.38, 0.6], [[74, 62], 3.0, 1.4],
    [[69, 57], 4.8, 0.16], [[67, 55], 4.96, 0.16], [[69, 57], 5.12, 1.0], [[64, 52], 6.3, 0.16], [[65, 53], 6.46, 0.16], [[61, 49], 6.62, 0.5], [[62, 50], 7.2, 1.6],
    [[45, 33, 57], 9.2, 3.0], [[61, 64, 67, 70], 9.6, 1.4], [[62, 65, 69, 74], 11.2, 2.4], [[58, 62, 65, 70], 13.8, 2.0], [[57, 61, 64, 69], 15.9, 2.0], [[50, 57, 62, 65, 69, 74], 18.2, 5]];
  for (const [n, t0, d] of seq) setTimeout(() => AU.organ(n, 0, d, 0.08, new V3(0, 8, -168)), t0 * 1000);
  setTimeout(() => { BATS.burst(new V3(-13, 34, -144), 60); BATS.burst(new V3(13, 34, -144), 60); AU.flutter(new V3(0, 30, -144)); }, 9300);
  setTimeout(() => fireworksShow(8), 18000);
}

export { CATH, stainedTex, lancetShape, buildCathedral, organShow };
