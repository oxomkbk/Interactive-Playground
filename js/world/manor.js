import * as THREE from 'three';
import { $, PI, R, TAU, V3, damp, hdr, lerp, pick, rand } from '../core/utils.js';
import { clockTex, cnv, portraitTex, toTex, windowTex } from '../core/textures.js';
import { FP, FX_OBJECTS, LIGHTS, camera, lantern, pointLight, scene } from '../core/renderer.js';
import { M, TX } from '../core/materials.js';
import { ghostMat } from '../core/shaders.js';
import { Batcher, PLATFORMS, SB, addBox, addCircle, addInteract, addPumpkin, addTomb, boxGeo, onUpdate, scaleUV, wallBox } from '../core/registry.js';
import { balusterGeo, roundBox } from './props.js';
import { addMarker, markDone, updateCounters } from './attractions.js';
import { FW, GHOST_GEO, SOULS } from './atmosphere.js';
import { AU } from '../core/audio.js';
import { S, SCORES, collide, playOrgan, player, saveScores } from '../game/play.js';
import { fade, showCard, toast } from '../ui/ui.js';
import { t } from '../core/i18n.js';
import { isOpen } from '../ui/console.js';

/* ---------- Hollowmoor Manor: a seven-room walk-through scare attraction ----------
   Route: Foyer → (Portrait Gallery, optional) → Nursery → Library → Dining Hall → The Long Corridor (chase!)
          → Ritual Chamber → east exit into the moonlight.
   Two real-time lights travel with the visitor (current room + a dim glow in the next doorway), every scare is a
   one-shot beat stored in HOUSE.flags, and the whole run resets once you're back outside so it can be replayed. */
const HOUSE = { inside: false, t: 0, run: false, runT: 0, flags: {}, room: null, outsideT: 0, eyes: [], innerWins: [], libCandles: [], books: [], diners: [], plates: [] };
const DOORS = [];
const ROOMS = {
  foyer:    { x0: -5,  x1: 5,  z0: -66, z1: -58.5, L: [0, 3.9, -62],      c: 0xffb070, I: 68, next: 'nursery' },
  gallery:  { x0: -16, x1: -5, z0: -66, z1: -58.5, L: [-10.5, 3.7, -62],  c: 0xffa060, I: 48, next: 'foyer' },
  nursery:  { x0: 5,   x1: 16, z0: -66, z1: -58.5, L: [10.5, 3.6, -62],   c: 0x9ab4ff, I: 44, next: 'library' },
  library:  { x0: -3,  x1: 16, z0: -75, z1: -66,   L: [6.5, 3.7, -70.5],  c: 0xffc080, I: 64, next: 'dining' },
  dining:   { x0: -16, x1: -3, z0: -75, z1: -66,   L: [-9.5, 3.7, -70.5], c: 0xff9050, I: 60, next: 'corridor' },
  corridor: { x0: -16, x1: 4,  z0: -84, z1: -75,   L: [-6, 3.7, -79.5],   c: 0xff2a10, I: 9,  next: 'chamber' },
  chamber:  { x0: 4,   x1: 16, z0: -84, z1: -75,   L: [10, 3.7, -79.5],   c: 0xa060ff, I: 50, next: null },
};
const HOUSE_C = new V3(0, 2, -71), MB_POS = new V3(9.6, 1.1, -65.4);
function roomAt(x, z) { for (const k in ROOMS) { const r = ROOMS[k]; if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return k; } return null; }
function makeDoor(hx, hz, w, base, open, startOpen, col) {
  const g = new THREE.Group(); g.position.set(hx, 0.2, hz); g.rotation.y = base + (startOpen ? open : 0); scene.add(g);
  const m = new THREE.Mesh(boxGeo(w, 3.1, 0.12, 1), M.woodDark); m.position.set(w / 2, 1.55, 0); m.castShadow = true; g.add(m);
  const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.brass); k.position.set(w - 0.2, 1.4, 0.09); g.add(k);
  const d = { g, base, open, target: startOpen ? open : 0, col: addBox(...col) }; d.col.off = startOpen; DOORS.push(d); return d;
}
function setDoor(d, isOpen) { d.target = isOpen ? d.open : 0; d.col.off = isOpen; }
function housePortrait(x, y, z, ry, tex, eyes = true) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  const fr = new THREE.Mesh(boxGeo(1.5, 1.9, 0.08, 1), M.brass); g.add(fr);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.65), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })); p.position.z = 0.05; g.add(p);
  if (eyes) for (const dx of [-0.11, 0.11]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x000000 })); e.position.set(dx, 0.23, 0.08); g.add(e); HOUSE.eyes.push(e); }
  return p;
}
function candle(x, y, z, list) {
  SB.add(new THREE.CylinderGeometry(0.035, 0.04, 0.24, 6), M.wax, x, y + 0.12, z, 0, { shadow: false });
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.candle); f.position.set(x, y + 0.29, z); f.scale.y = 1.6; scene.add(f); if (list) list.push(f); return f;
}
function buildHouse() {
  const SD = M.stoneDark, WP = M.wallpaper, H = 10, CY = 4.4, HS = HOUSE;
  // ---- exterior shell: front door gap x∈[-1.3,1.3]; east exit gap z∈[-80.8,-78.2] ----
  wallBox(-16.5, -1.3, 0, H, -58.5, -58, SD); wallBox(1.3, 16.5, 0, H, -58.5, -58, SD); wallBox(-1.3, 1.3, 3.3, H, -58.5, -58, SD, { collide: false });
  wallBox(-16.5, 16.5, 0, H, -84.5, -84, SD);
  wallBox(-16.5, -16, 0, H, -84, -58.5, SD);
  wallBox(16, 16.5, 0, H, -84, -80.8, SD); wallBox(16, 16.5, 0, H, -78.2, -58.5, SD); wallBox(16, 16.5, 3.3, H, -80.8, -78.2, SD, { collide: false });
  wallBox(-16, 16, CY, CY + 0.3, -84, -58.5, M.woodDark, { collide: false });
  SB.add(boxGeo(32, 0.2, 25.5, 2), M.wood, 0, 0.1, -71.25);
  PLATFORMS.push({ x0: -16, x1: 16, z0: -84, z1: -58.5, h: 0.2 });
  // roof, gables, chimneys
  const rw = Math.hypot(16.8, 6), ra = Math.atan2(6, 16.8);
  for (const s of [-1, 1]) SB.add(boxGeo(rw + 0.5, 0.4, 27.4, 2.5), M.roof, s * 8.2, H + 2.95, -71.25, 0, { rz: -s * ra });
  const gable = new THREE.Shape([new THREE.Vector2(-16.5, 0), new THREE.Vector2(16.5, 0), new THREE.Vector2(0, 6)]);
  for (const z of [-58.25, -84.25]) SB.add(new THREE.ShapeGeometry(gable), SD, 0, H, z, z > -60 ? 0 : PI);
  for (const [x, z] of [[-8, -66], [7, -78]]) SB.add(boxGeo(1.4, 4, 1.4, 1), M.stone, x, H + 5, z);
  // tower + porch
  SB.add(scaleUV(new THREE.CylinderGeometry(2.8, 3, 17, 16), 3, 6), SD, 15, 8.5, -58.5); addCircle(15, -58.5, 3);
  SB.add(new THREE.ConeGeometry(3.4, 8, 16), M.roof, 15, 21, -58.5);
  SB.add(boxGeo(10, 0.35, 3.6, 2), M.wood, 0, 0.17, -56.2); PLATFORMS.push({ x0: -5, x1: 5, z0: -58, z1: -54.4, h: 0.3 });
  for (const x of [-4.6, -2, 2, 4.6]) { SB.add(new THREE.CylinderGeometry(0.16, 0.18, 3.4, 8), M.bone, x, 2, -54.7); addCircle(x, -54.7, 0.25); }
  SB.add(boxGeo(10.6, 0.25, 4, 2), M.roof, 0, 3.8, -56.1, 0, { rx: 0.12 });
  for (const [xa, xb] of [[-4.6, -2], [2, 4.6]]) { for (let x = xa + 0.16; x < xb - 0.08; x += 0.17) SB.add(balusterGeo(), M.bone, x, 0.34, -54.62);
    SB.add(roundBox(xb - xa, 0.08, 0.14, 0.03, 1), M.bone, (xa + xb) / 2, 1.08, -54.62); SB.add(roundBox(xb - xa, 0.06, 0.1, 0.02, 1), M.bone, (xa + xb) / 2, 0.37, -54.62); }
  for (let i = 0; i < 2; i++) SB.add(roundBox(4, 0.15, 0.4, 0.03, 1), M.stoneDark, 0, 0.075 + i * 0.15 - 0.15 * 0, -54.2 + i * -0.0 + (1 - i) * 0.4, 0, { sy: 1 });
  for (let z = -58.2; z > -84.3; z -= 0.6) SB.add(new THREE.ConeGeometry(0.035, 0.32, 5), M.iron, 0, 16.2, z, 0, { shadow: false });
  // exterior windows (some flicker, one has a watcher)
  const wG = new THREE.MeshBasicMaterial({ color: hdr(0x7dff9a, 1.7), map: windowTex(false) });
  const wA = new THREE.MeshBasicMaterial({ color: hdr(0xffa040, 1.8), map: windowTex(false) });
  const wS = new THREE.MeshBasicMaterial({ color: hdr(0xff6040, 2.0), map: windowTex(true) });
  HS.winMats = [wG, wA, wS];
  const ped = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.95, 0), new THREE.Vector2(0.95, 0), new THREE.Vector2(0, 0.36)]), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, 0, -0.08);
  const win = (x, y, z, ry, mat) => { const o = ry === 0 ? 1 : -1, fz = z + o * 0.06;
    SB.add(new THREE.PlaneGeometry(1.3, 1.9), mat, x, y, z, ry, { shadow: false });
    SB.add(roundBox(1.56, 0.12, 0.16, 0.03, 1), M.bone, x, y + 1.0, fz, ry); SB.add(roundBox(1.72, 0.1, 0.34, 0.03, 1), M.bone, x, y - 1.02, fz + o * 0.07, ry);
    for (const sd of [-1, 1]) { SB.add(roundBox(0.12, 1.92, 0.15, 0.03, 1), M.bone, x + sd * 0.72, y, fz, ry); SB.add(roundBox(0.5, 1.9, 0.05, 0.015, 1), M.woodDark, x + sd * 1.05, y, fz + o * 0.04, ry + sd * o * 0.18); }
    SB.add(boxGeo(1.3, 0.05, 0.05, 1), M.woodDark, x, y + 0.04, fz, ry); SB.add(boxGeo(0.05, 1.9, 0.05, 1), M.woodDark, x, y, fz, ry);
    SB.add(ped, M.bone, x, y + 1.06, fz, ry); };
  [[-11, 2.3, wA], [-5.5, 2.3, wG], [5.5, 2.3, wA], [11, 2.3, wG], [-12, 7.2, wG], [-6, 7.2, wS], [0, 7.2, wA], [6, 7.2, wG], [11, 7.2, wA]].forEach(([x, y, m]) => win(x, y, -57.96, 0, m));
  [[-11, 2.3], [-3, 2.3], [3, 7.2], [-10, 7.2], [12, 7.2]].forEach(([x, y]) => win(x, y, -84.54, PI, pick([wG, wA])));
  for (const s of [-1, 1]) for (const z of [-63, -71, -76]) for (const y of [7.2]) SB.add(new THREE.PlaneGeometry(1.3, 1.9), pick([wG, wA]), s * 16.54, y, z, s * PI / 2, { shadow: false });
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; SB.add(new THREE.PlaneGeometry(0.8, 1.4), wG, 15 + Math.sin(a) * 3.0, 12, -58.5 + Math.cos(a) * 3.0, a, { shadow: false }); }
  // doors: front (slams behind you), corridor (slams at the chase), east exit (locked until the curse breaks)
  HS.front = makeDoor(-1.3, -58.25, 2.6, 0, 1.7, true, [-1.3, 1.3, -58.4, -58.1]);
  HS.corDoor = makeDoor(-14, -75, 1.8, 0, -1.6, true, [-14, -12.2, -75.15, -74.85]);
  HS.exit = makeDoor(16.25, -80.8, 2.6, -PI / 2, 1.6, false, [16.05, 16.45, -80.8, -78.2]);
  pointLight('porch', 0x60ff90, 30, 16, 0, 3.2, -55.5);
  pointLight('roomA', 0xffb070, 0, 24, 0, 3.8, -62);
  pointLight('roomB', 0xffb070, 0, 20, 0, 3.8, -62);
  // ---- interior partitions (wallpaper) with doorways ----
  const iw = (x0, x1, z0, z1, mat = WP) => wallBox(x0, x1, 0.2, CY, z0, z1, mat);
  iw(-16, 11, -66.15, -65.85); iw(12.8, 16, -66.15, -65.85);          // row A | row B   (nursery → library at x≈12)
  iw(-16, -14, -75.15, -74.85); iw(-12.2, 16, -75.15, -74.85);         // row B | row C   (dining → corridor at x≈-13)
  iw(-5.15, -4.85, -66, -63.6); iw(-5.15, -4.85, -61.8, -58.5);        // gallery | foyer
  iw(4.85, 5.15, -66, -63.6); iw(4.85, 5.15, -61.8, -58.5);            // foyer | nursery
  iw(-3.15, -2.85, -75, -72.6); iw(-3.15, -2.85, -70.8, -66);          // dining | library
  iw(3.85, 4.15, -84, -80.4, SD); iw(3.85, 4.15, -78.6, -75, SD);      // corridor | chamber
  const sk = (x0, x1, z0, z1) => wallBox(x0, x1, 0.2, CY, z0, z1, WP, { collide: false });
  sk(-16, -1.3, -58.53, -58.5); sk(1.3, 16, -58.53, -58.5); sk(-16, 16, -84, -83.97); sk(-16, -15.97, -84, -58.5); sk(15.97, 16, -84, -80.8); sk(15.97, 16, -78.2, -58.5);
  // ---- FOYER: rug, grand stair, grandfather clock, swinging chandelier ----
  SB.add(new THREE.PlaneGeometry(4, 6), M.rug, 0, 0.22, -62.2, 0, { rx: -PI / 2, shadow: false });
  for (let i = 0; i < 10; i++) SB.add(boxGeo(2.2, 0.4 * (i + 1), 0.45, 1), M.woodDark, -3.6, 0.2 + 0.2 * (i + 1), -61.6 - i * 0.45);
  addBox(-4.8, -2.4, -66, -61.4);
  SB.add(boxGeo(0.8, 2.6, 0.5, 1), M.woodDark, 3.9, 1.5, -65.5); addBox(3.5, 4.3, -65.8, -65.2);
  const cf = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ map: clockTex(), color: hdr(0xffffff, 1.2) })); cf.position.set(3.9, 2.4, -65.24); scene.add(cf);
  HS.chand = new THREE.Group(); HS.chand.position.set(0, 4.35, -62); scene.add(HS.chand);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), M.iron); chain.position.y = -0.3; HS.chand.add(chain);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 24).rotateX(PI / 2), M.brass); ring.position.y = -0.6; HS.chand.add(ring);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.candle); f.position.set(Math.cos(a) * 0.8, -0.38, Math.sin(a) * 0.8); f.scale.y = 1.6; HS.chand.add(f); }
  // ---- PORTRAIT GALLERY (optional): eyes wake, the last portrait screams ----
  for (let i = 0; i < 4; i++) { housePortrait(-14 + i * 2.6, 2.6, -58.62, PI, portraitTex(i)); housePortrait(-13.2 + i * 2.6, 2.6, -65.78, 0, portraitTex(i + 1)); }
  HS.endPortrait = housePortrait(-15.88, 2.5, -62.2, PI / 2, portraitTex(2), false);
  for (let i = 0; i < 6; i++) candle(-15.4 + (i % 2) * 0.3, 0.2, -59.5 - i * 1.1);
  // ---- NURSERY: crib, rocking chair, music box, the doll ----
  const cribX = 13.6, cribZ = -63.6;
  SB.add(boxGeo(1.5, 0.1, 0.85, 1), M.bone, cribX, 0.75, cribZ); addBox(cribX - 0.8, cribX + 0.8, cribZ - 0.45, cribZ + 0.45);
  for (let i = 0; i <= 10; i++) for (const s of [-1, 1]) SB.add(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 4), M.bone, cribX - 0.72 + i * 0.144, 0.95, cribZ + s * 0.42);
  for (const [dx, dz] of [[-0.72, -0.4], [0.72, -0.4], [-0.72, 0.4], [0.72, 0.4]]) SB.add(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), M.bone, cribX + dx, 0.85, cribZ + dz);
  HS.rocker = new THREE.Group(); HS.rocker.position.set(7.4, 0.2, -60.4); HS.rocker.rotation.y = 2.4; scene.add(HS.rocker);
  { const rb = new Batcher(); rb.add(boxGeo(0.6, 0.06, 0.6, 1), M.woodDark, 0, 0.5, 0); rb.add(boxGeo(0.6, 0.9, 0.06, 1), M.woodDark, 0, 0.95, -0.3, 0, { rx: -0.15 });
    for (const sx of [-0.28, 0.28]) rb.add(new THREE.TorusGeometry(0.6, 0.025, 4, 16, 1.4), M.woodDark, sx, 0.62, 0, PI / 2, { rz: -PI / 2 - 0.7 }); rb.build(HS.rocker); }
  addCircle(7.4, -60.4, 0.5);
  SB.add(boxGeo(0.8, 0.7, 0.5, 1), M.woodDark, 9.6, 0.55, -65.4); SB.add(boxGeo(0.3, 0.16, 0.22, 1), M.brass, 9.6, 0.98, -65.4); addBox(9.2, 10, -65.7, -65.1);
  for (let i = 0; i < 12; i++) SB.add(boxGeo(0.16, 0.16, 0.16, 1), pick([M.orange, M.purple, M.bone, M.glowGreen]), R(6, 15), 0.28, R(-65.5, -59), R(0, 3));
  HS.doll = new THREE.Group(); HS.doll.position.set(15.2, 0.2, -59.4); scene.add(HS.doll);
  { const dh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), M.bone); dh.position.y = 0.62; HS.doll.add(dh); HS.dollHead = dh;
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 10), M.velvet); dress.position.y = 0.27; HS.doll.add(dress);
    for (const dx of [-0.04, 0.04]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.dark); e.position.set(dx, 0.02, 0.105); dh.add(e); } }
  const nw = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), new THREE.MeshBasicMaterial({ color: hdr(0x8ab0ff, 0.9), map: windowTex(false) })); nw.position.set(15.95, 2.3, -62); nw.rotation.y = -PI / 2; scene.add(nw); HS.innerWins.push(nw);
  // ---- LIBRARY: shelves of real books (they will fly), reading table with candles, storm window ----
  const shelf = (x0, x1, z, face) => { const w = x1 - x0, cx = (x0 + x1) / 2;
    SB.add(boxGeo(w, 3.6, 0.5, 2), M.woodDark, cx, 2.0, z); addBox(x0, x1, z - 0.25, z + 0.25);
    for (let r = 0; r < 5; r++) { const y = 0.55 + r * 0.7; let x = x0 + 0.1;
      while (x < x1 - 0.15) { const bw = R(0.05, 0.11), bh = R(0.24, 0.4); SB.add(boxGeo(bw, bh, 0.26, 1), pick(M.books), x + bw / 2, y + bh / 2, z + face * 0.13, 0, { rz: rand() < 0.08 ? 0.2 : 0 }); x += bw + 0.008; } } };
  shelf(-2.6, 10.6, -66.45, -1); shelf(13.1, 15.8, -66.45, -1); shelf(-2.6, 15.8, -74.6, 1);
  SB.add(boxGeo(3.4, 0.1, 1.2, 1), M.woodDark, 5, 0.9, -70.5); for (const [dx, dz] of [[-1.5, -0.5], [1.5, -0.5], [-1.5, 0.5], [1.5, 0.5]]) SB.add(boxGeo(0.1, 0.75, 0.1, 1), M.woodDark, 5 + dx, 0.5, -70.5 + dz);
  addBox(3.3, 6.7, -71.1, -69.9);
  for (let i = 0; i < 8; i++) candle(3.6 + i * 0.4, 0.95, -70.5 + (i % 2 ? 0.2 : -0.2), HS.libCandles);
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), new THREE.MeshBasicMaterial({ color: hdr(0x8ab0ff, 0.9), map: windowTex(false) })); lw.position.set(15.95, 2.3, -70.5); lw.rotation.y = -PI / 2; scene.add(lw); HS.innerWins.push(lw);
  for (let i = 0; i < 28; i++) { const b = new THREE.Mesh(boxGeo(0.24, 0.32, 0.07, 1), pick(M.books)); b.visible = false; b.castShadow = true; scene.add(b); HS.books.push({ m: b, v: new V3(), w: new V3(), on: false }); }
  // ---- DINING HALL: the dead are seated, plates rattle, the chandelier falls ----
  SB.add(boxGeo(7.2, 0.12, 1.7, 2), M.woodDark, -9.5, 0.95, -70.5); SB.add(boxGeo(7.4, 0.02, 1.9, 2), M.velvet, -9.5, 1.02, -70.5, 0, { shadow: false });
  for (const dx of [-3.3, 3.3]) for (const dz of [-0.7, 0.7]) SB.add(boxGeo(0.12, 0.85, 0.12, 1), M.woodDark, -9.5 + dx, 0.5, -70.5 + dz);
  addBox(-13.2, -5.8, -71.4, -69.6);
  [-12.4, -10.4, -8.6, -6.6].forEach((x, i) => { for (const s of [-1, 1]) { const z = -70.5 + s * 1.35;
    SB.add(boxGeo(0.55, 0.08, 0.55, 1), M.woodDark, x, 0.62, z); SB.add(boxGeo(0.55, 1.1, 0.07, 1), M.woodDark, x, 1.15, z + s * 0.27); addCircle(x, z, 0.35);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.03, 16), M.bone); pl.position.set(x, 1.05, -70.5 + s * 0.55); scene.add(pl); HS.plates.push({ m: pl, y: 1.05 });
    if ((i + (s > 0 ? 1 : 0)) % 2 === 0) { const gh = new THREE.Mesh(GHOST_GEO, ghostMat(0xc8e4ff, i * 2 + s)); gh.scale.setScalar(0.75); gh.position.set(x, 1.2, z); gh.rotation.y = s > 0 ? PI : 0; gh.userData.base = gh.rotation.y; gh.material.uniforms.uOpacity.value = 0.35; scene.add(gh); FX_OBJECTS.push(gh); HS.diners.push(gh); } } });
  for (const x of [-11.5, -7.5]) { SB.add(new THREE.CylinderGeometry(0.04, 0.12, 0.5, 8), M.brass, x, 1.27, -70.5); for (let k = -1; k <= 1; k++) candle(x + k * 0.18, 1.5, -70.5); }
  HS.dchand = new THREE.Group(); HS.dchand.position.set(-9.5, 3.7, -70.5); scene.add(HS.dchand);
  HS.dchand.add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 24).rotateX(PI / 2), M.brass));
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.candle); f.position.set(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9); f.scale.y = 1.6; HS.dchand.add(f); }
  HS.dchandRope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), M.iron); HS.dchandRope.position.set(-9.5, 4.05, -70.5); scene.add(HS.dchandRope);
  // ---- THE LONG CORRIDOR: darkness, pillars, chains, the writing on the wall, and something that hunts ----
  for (const [x, z] of [[-9.5, -77.6], [-4.5, -81.4], [0.2, -77.6]]) { SB.add(new THREE.CylinderGeometry(0.42, 0.5, 4.2, 10), M.stone, x, 2.3, z); addCircle(x, z, 0.5); }
  for (let i = 0; i < 9; i++) SB.add(new THREE.CylinderGeometry(0.02, 0.02, R(0.8, 2.2), 4), M.iron, R(-15, 3), 3.6, R(-83, -76), 0, { shadow: false });
  const gw = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), M.redText); gw.position.set(-7, 2.4, -83.94); scene.add(gw);
  for (let i = 0; i < 7; i++) candle(R(-15, 3), 0.2, R(-83.5, -76));
  HS.wraith = new THREE.Mesh(GHOST_GEO, ghostMat(0xff3020, 9.1)); HS.wraith.scale.set(1.4, 2.0, 1.4); HS.wraith.visible = false; scene.add(HS.wraith); FX_OBJECTS.push(HS.wraith);
  // ---- RITUAL CHAMBER: pentagram, candle ring, altar & crystal skull, the organ ----
  const [pc, px] = cnv(512); px.strokeStyle = '#fff'; px.lineWidth = 7; px.beginPath(); px.arc(256, 256, 240, 0, TAU); px.stroke(); px.beginPath(); px.arc(256, 256, 205, 0, TAU); px.stroke();
  px.beginPath(); for (let i = 0; i <= 5; i++) { const a = -PI / 2 + i * 4 * PI / 5; i ? px.lineTo(256 + Math.cos(a) * 205, 256 + Math.sin(a) * 205) : px.moveTo(256 + Math.cos(a) * 205, 256 + Math.sin(a) * 205); } px.stroke();
  px.font = '28px Georgia'; px.fillStyle = '#fff'; for (let i = 0; i < 24; i++) { px.save(); px.translate(256, 256); px.rotate(i / 24 * TAU); px.fillText('ᚱᚢᚾᛖ'[i % 4], -8, -214); px.restore(); }
  HS.penta = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: toTex(pc, { repeat: false }), color: hdr(0xa050ff, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  HS.penta.position.set(10, 0.23, -79.5); scene.add(HS.penta); FX_OBJECTS.push(HS.penta);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; candle(10 + Math.cos(a) * 3.3, 0.2, -79.5 + Math.sin(a) * 3.3); }
  SB.add(boxGeo(2.4, 1.1, 1.2, 1), M.stone, 10, 0.75, -82.6); addBox(8.8, 11.2, -83.2, -82);
  HS.skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x8060c0, emissive: 0x8a50ff, emissiveIntensity: 1.5, roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.88 }));
  HS.skull.scale.set(1, 1.1, 1.15); HS.skull.position.set(10, 1.62, -82.5); scene.add(HS.skull);
  for (const dx of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.dark); e.position.set(dx, 0.05, 0.22); HS.skull.add(e); }
  wallBox(12.6, 15.8, 0.2, 2.2, -83.9, -83, M.woodDark);
  for (let i = 0; i < 10; i++) { const h = 1.3 + Math.sin(i / 9 * PI) * 1.5; SB.add(new THREE.CylinderGeometry(0.09, 0.09, h, 8), M.brass, 12.9 + i * 0.32, 2.2 + h / 2, -83.5); }
  for (const [x, z] of [[6.2, -82.8], [14.9, -76.2]]) { SB.add(new THREE.ConeGeometry(0.55, 2.1, 10), M.black, x, 1.25, z); SB.add(new THREE.SphereGeometry(0.28, 12, 10), M.black, x, 2.35, z); addCircle(x, z, 0.55); }
  // ---- jump-scare face rides on the camera ----
  HS.face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: TX.scare, transparent: true, depthTest: false, color: hdr(0xffffff, 1.4) }));
  HS.face.position.set(0, 0, -0.55); HS.face.renderOrder = 999; HS.face.visible = false; camera.add(HS.face);
  // ---- front yard ----
  for (let i = 0; i < 12; i++) addTomb(pick([-1, 1]) * R(5.5, 13), R(-53, -45), R(-0.4, 0.4), R(0.8, 1.2));
  for (let i = 0; i < 10; i++) addPumpkin(pick([-1, 1]) * R(1.2, 4.4), 0.3, R(-57.8, -55), R(0.2, 0.35), true);
  addMarker(0, -53.4, 'ENTER', 0x7dff9a);
  addInteract({ x: 14.2, z: -82.2, r: 2.4, label: 'Play the organ', action: playOrgan, enabled: () => HOUSE.room === 'chamber' });
  addInteract({ x: 10, z: -81.2, r: 2.4, label: () => HOUSE.flags.won ? 'The skull is silent now' : 'Touch the crystal skull', action: skullScare, enabled: () => HOUSE.room === 'chamber' });
  onUpdate(updateHouse);
}
function objective(title, sub, bar) {
  const el = $('#objective'); if (!title) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.querySelector('.ot').textContent = t(title); el.querySelector('.os').textContent = t(sub || ''); el.querySelector('.ob').classList.toggle('hidden', !bar);
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function houseLightning() { HOUSE.lightning = 1; AU.thunder(R(60, 140)); }
function updateHouse(dt, t) {
  const H = HOUSE, F = H.flags, p = player.pos;
  const inBounds = S.mode !== 'ride' && p.x > -16 && p.x < 16 && p.z < -58.5 && p.z > -84;
  const room = inBounds ? roomAt(p.x, p.z) : null;
  H.inside = inBounds; H.t += dt;
  if (room && room !== H.room) enterRoom(room);
  if (room) H.room = room; else if (!inBounds) H.room = null;
  for (const d of DOORS) d.g.rotation.y = damp(d.g.rotation.y, d.base + d.target, d.target === 0 ? 16 : 2.2, dt);
  // --- lighting that travels with you ---
  const near = camera.position.distanceTo(HOUSE_C) < 42;
  const r = ROOMS[H.room || 'foyer'], nx = r.next ? ROOMS[r.next] : null;
  H.flicker = Math.max(0, (H.flicker || 0) - dt);
  const flick = H.flicker > 0 ? (Math.random() > 0.5 ? 1 : 0.04) : 0.86 + 0.14 * Math.sin(t * 9) * Math.sin(t * 4.3);
  const LA = LIGHTS.roomA, LB = LIGHTS.roomB;
  LA.position.set(...r.L); LB.position.set(...(nx ? nx.L : r.L));
  LA.color.set(F.won ? 0xffc890 : r.c); LB.color.set(nx ? nx.c : r.c);
  if (H.blackout > 0) { H.blackout -= dt; LA.intensity = LB.intensity = 0; }
  else {
    let ia = near ? r.I * flick * (H.room === 'library' && F.books ? 0.45 : 1) * (F.won ? 1.5 : 1) : 0;
    if (H.room === 'corridor' && F.chase && !F.chaseDone) ia = near ? (Math.random() > 0.12 ? 10 : 0.5) : 0;
    LA.intensity = ia; LB.intensity = near && nx ? nx.I * 0.3 : 0;
  }
  LIGHTS.porch.intensity = LIGHTS.porch.userData.base * (0.7 + 0.3 * Math.sin(t * 3.1) * Math.sin(t * 7.7));
  H.winMats[2].color.setHex(0xff6040).multiplyScalar(2.0 * (Math.sin(t * 0.7) > 0.6 ? 0.1 : 1));
  // storm through the windows while you're inside
  if (H.inside && H.run && Math.random() < dt / 14) houseLightning();
  H.lightning = Math.max(0, (H.lightning || 0) - dt * 2.2);
  const lk = H.lightning > 0.05 && Math.random() > 0.3 ? H.lightning : 0;
  for (const w of H.innerWins) w.material.color.setHex(0x8ab0ff).multiplyScalar(0.9 + lk * 9);
  // --- ambient animation ---
  H.chandSwing = Math.max(0, (H.chandSwing || 0) - dt * 0.05);
  H.chand.rotation.z = Math.sin(t * 1.3) * (0.03 + H.chandSwing); H.chand.rotation.x = Math.cos(t * 1.1) * (0.02 + H.chandSwing * 0.6);
  H.rocker.rotation.x = F.cribScare ? damp(H.rocker.rotation.x, 0, 3, dt) : Math.sin(t * 1.8) * 0.16;
  H.skull.rotation.y = Math.sin(t * 0.8) * 0.4; H.skull.material.emissiveIntensity = F.won ? 0.2 : 1.2 + Math.sin(t * 3) * 0.5;
  H.penta.material.color.setHex(F.won ? 0xffc060 : 0xa050ff).multiplyScalar(1.0 + Math.sin(t * 2) * 0.3 + (H.room === 'chamber' ? 0.5 : 0));
  if (H.run) { H.runT += dt; objective(t('Hollowmoor Manor · {t}', { t: fmtTime(H.runT) }), H.hint || 'Find a way out. Do not stop moving.'); }
  AU.musicBox(H.room === 'nursery' && !F.cribScare, MB_POS);
  // --- position-based scares ---
  if (!H.run && H.room === 'foyer' && p.z < -60.6) startManorRun();
  if (H.room === 'gallery' && p.x < -12.6 && !F.endPortrait) { F.endPortrait = 1; H.endPortrait.material.map = TX.scare; H.endPortrait.material.needsUpdate = true; AU.stinger(); H.flicker = 0.8; S.shake = 0.4; }
  if (H.room === 'nursery' && Math.hypot(p.x - 13.6, p.z + 63.6) < 2.6 && !F.cribScare) {
    F.cribScare = 1; H.blackout = 1.3; AU.giggle(new V3(13.6, 1, -63.6));
    setTimeout(() => { HOUSE.doll.position.set(13.6, 0.85, -63.6); HOUSE.doll.rotation.y = Math.atan2(player.pos.x - 13.6, player.pos.z + 63.6); AU.stinger(); HOUSE.flicker = 0.6; }, 1300);
  }
  if (H.room === 'library' && p.x < 7 && !F.books) {
    F.books = 1; AU.flutter(new V3(4, 2, -66.5)); houseLightning();
    H.books.forEach((b, i) => setTimeout(() => { b.on = true; b.m.visible = true; b.m.position.set(R(-2.4, 10.4), R(0.9, 3.6), -66.7); b.v.set(R(-1.5, 1.5), R(0.5, 2.5), -R(2.5, 6)); b.w.set(R(-8, 8), R(-8, 8), R(-8, 8)); }, i * 70));
    H.libCandles.forEach((c, i) => setTimeout(() => { c.visible = false; AU.noise({ dur: 0.25, vol: 0.12, type: 'bandpass', f: 900, q: 1 }); }, 900 + i * 260));
    H.hint = 'The candles are going out. Keep moving.';
  }
  for (const b of H.books) if (b.on) { b.v.y -= 9.8 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
    if (b.m.position.y < 0.26) { b.m.position.y = 0.26; if (b.v.y < -2) AU.thud(b.m.position, 0.25); b.v.multiplyScalar(0.25); b.v.y = Math.abs(b.v.y) * 0.3; b.w.multiplyScalar(0.3); if (b.v.lengthSq() < 0.05) b.on = false; } }
  if (F.dining && !F.chandDrop && Math.hypot(p.x + 9.5, p.z + 70.5) < 2.8) { F.chandDrop = 1; AU.creak(H.dchand.position); setTimeout(() => { HOUSE.fallV = 0; HOUSE.dchandRope.visible = false; }, 450); }
  if (H.fallV !== undefined && !F.crashed) { H.fallV += 9.8 * dt; H.dchand.position.y -= H.fallV * dt;
    if (H.dchand.position.y <= 1.12) { H.dchand.position.y = 1.12; H.dchand.rotation.z = 0.25; F.crashed = 1; AU.crash(H.dchand.position); S.shake = 0.9; H.flicker = 1; FW.burst(H.dchand.position, 80, new THREE.Color(0.6, 0.55, 0.5), 4, 'soul'); } }
  if (F.dining && !F.crashed) for (const pl of H.plates) pl.m.position.y = pl.y + (Math.random() < 0.3 ? Math.random() * 0.03 : 0);
  for (const g of H.diners) { const want = F.dining ? Math.atan2(p.x - g.position.x, p.z - g.position.z) : g.userData.base; let da = want - g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    g.rotation.y += da * Math.min(1, dt * 1.5); g.material.uniforms.uOpacity.value = damp(g.material.uniforms.uOpacity.value, F.dining ? (F.crashed ? 0 : 1.3) : 0.35, 2, dt); }
  if (F.chase && !F.chaseDone) updateChase(dt);
  // --- reset once the visitor is back outside ---
  if (!inBounds && H.run) { H.outsideT += dt; if (H.outsideT > 10) resetManor(); } else H.outsideT = 0;
  S.indoor = damp(S.indoor || 0, inBounds ? 1 : 0, 3, dt);
}
function startManorRun() {
  const H = HOUSE; H.run = true; H.runT = 0; H.hint = null; setDoor(H.front, false); AU.doorSlam(new V3(0, 1.5, -58)); H.flicker = 0.6; H.chandSwing = 0.22; AU.heart(true);
  toast('The door slams shut behind you…', 'There is no way back. Only through.', 'blood');
  for (let i = 0; i < 3; i++) setTimeout(() => AU.bell(new V3(3.9, 2.4, -65.5), 130, 3.5, 0.5), 3500 + i * 1700);
}
function enterRoom(k) {
  const H = HOUSE, F = H.flags; if (!H.run) return;
  if (k === 'gallery' && !F.gallery) { F.gallery = 1; H.eyes.forEach(e => e.material.color.copy(hdr(0xff1010, 8))); AU.whisper(new V3(-10, 2.6, -62)); H.hint = 'They are watching you. All of them.'; }
  if (k === 'nursery' && !F.nursery) { F.nursery = 1; H.hint = 'Someone is still playing in here…'; }
  if (k === 'library' && !F.library) { F.library = 1; H.hint = 'Shhh. The books are listening.'; }
  if (k === 'dining' && !F.dining) { F.dining = 1; AU.rattle(new V3(-9.5, 1, -70.5)); AU.whisper(new V3(-12, 1.4, -69)); H.hint = 'Dinner is served. You are the guest of honour.'; }
  if (k === 'corridor' && !F.chase) startChase();
  if (k === 'chamber' && !F.chamber) { F.chamber = 1; if (F.chase && !F.chaseDone) endChase(); H.hint = 'Touch the crystal skull to break the curse.'; AU.shimmer(new V3(10, 1.6, -82.5)); }
}
function startChase() {
  const H = HOUSE, F = H.flags; F.chase = 1; setDoor(H.corDoor, false); AU.doorSlam(new V3(-13, 1.5, -75));
  S.lantern = true; lantern.intensity = 60; S.chase = true; H.wraith.visible = true; H.wraith.position.set(-15.2, 1.7, -83.2); H.wraith.material.uniforms.uOpacity.value = 1.4; H.chaseDelay = 1.7;
  setTimeout(() => AU.stinger(), 300); toast('RUN.', 'Something is in the corridor with you. Hold Shift and run for the light.', 'blood'); H.hint = 'RUN — east, toward the violet light!';
}
function updateChase(dt) {
  const H = HOUSE, w = H.wraith, p = player.pos;
  w.position.y = 1.7 + Math.sin(H.t * 5) * 0.15; w.rotation.y = Math.atan2(p.x - w.position.x, p.z - w.position.z);
  if (H.chaseDelay > 0) { H.chaseDelay -= dt; return; }
  const dx = p.x - w.position.x, dz = p.z - w.position.z, d = Math.hypot(dx, dz), sp = 4.9 + (H.caught || 0) * -0.3;
  w.position.x += dx / d * sp * dt; w.position.z += dz / d * sp * dt;
  if (Math.random() < dt * 0.8) AU.whisper(w.position);
  if (d < 1.15 && !H.catching) { H.catching = true; H.caught = (H.caught || 0) + 1; H.face.visible = true; AU.jumpscare(); S.shake = 1.1; FP.uScare.value = 1;
    setTimeout(() => { H.face.visible = false; FP.uScare.value = 0;
      fade(() => { player.pos.set(-13.1, 0.2, -76.8); player.yaw = -PI / 2 - 0.3; w.position.set(-15.2, 1.7, -83.2); H.chaseDelay = 2.4; H.catching = false; toast('It caught you…', 'Try again. Do not walk — RUN.', 'blood'); }); }, 650); }
}
function endChase() { const H = HOUSE; H.flags.chaseDone = 1; S.chase = false; AU.scream(H.wraith.position, 0.25);
  const t0 = performance.now(); const fadeOut = () => { const k = (performance.now() - t0) / 900; H.wraith.material.uniforms.uOpacity.value = 1.4 * (1 - k); H.wraith.scale.y = 2 + k * 2; if (k < 1) requestAnimationFrame(fadeOut); else H.wraith.visible = false; }; fadeOut(); }
function skullScare() {
  const H = HOUSE, F = H.flags; if (F.won || H.scaring) return; H.scaring = true;
  AU.drone(1.4); H.blackout = 1.4; H.eyes.forEach(e => e.material.color.copy(hdr(0xff1010, 12)));
  setTimeout(() => {
    H.face.visible = true; H.face.scale.setScalar(0.5); AU.jumpscare(); S.shake = 1.2; FP.uScare.value = 1; S.flash = 0.8; S.flashCol.set(0.5, 0.02, 0.02);
    const t0 = performance.now(); const grow = () => { const k = (performance.now() - t0) / 160; H.face.scale.setScalar(lerp(0.5, 1.15, Math.min(1, k))); if (k < 1) requestAnimationFrame(grow); }; grow();
  }, 1400);
  setTimeout(() => {
    H.face.visible = false; FP.uScare.value = 0; F.won = 1; H.scaring = false; setDoor(H.exit, true); AU.heart(false); S.lantern = false; lantern.intensity = 0;
    SOULS[10].active = true; SOULS[10].g.visible = true;
    for (let i = 0; i < 6; i++) setTimeout(() => FW.burst(new V3(10 + R(-2.5, 2.5), R(0.6, 3), -79.5 + R(-2.5, 2.5)), 70, new THREE.Color(0.8, 3, 2), 3.5, 'soul'), i * 220);
    const tt = H.runT, best = SCORES.manor; if (!best || tt < best) { SCORES.manor = tt; saveScores(); }
    H.run = false; S.candy += 25; updateCounters(); markDone('manor'); AU.chime(); AU.shimmer(new V3(10, 2, -80));
    showCard('The curse is broken', t('You escaped Hollowmoor Manor in {t}{r}. +25 candy. The east door stands open.', { t: fmtTime(tt), r: !best || tt < best ? t(' — a new record!') : t(' (record {r})', { r: fmtTime(best) }) }), 6000);
    objective('The curse is broken', 'Walk out through the east door, into the moonlight.'); setTimeout(() => objective(null), 9000);
  }, 2300);
}
function resetManor() {
  const H = HOUSE; H.run = false; H.flags = {}; H.hint = null; H.outsideT = 0; H.caught = 0; S.chase = false; AU.heart(false); objective(null);
  setDoor(H.front, true); setDoor(H.corDoor, true); setDoor(H.exit, false); H.wraith.visible = false;
  H.eyes.forEach(e => e.material.color.set(0)); H.endPortrait.material.map = portraitTex(2); H.endPortrait.material.needsUpdate = true;
  H.doll.position.set(15.2, 0.2, -59.4); H.libCandles.forEach(c => c.visible = true); H.books.forEach(b => { b.on = false; b.m.visible = false; });
  H.dchand.position.set(-9.5, 3.7, -70.5); H.dchand.rotation.set(0, 0, 0); H.dchandRope.visible = true; H.fallV = undefined;
}

export { HOUSE, DOORS, ROOMS, HOUSE_C, MB_POS, roomAt, makeDoor, setDoor, housePortrait, candle, buildHouse, objective, fmtTime, houseLightning, updateHouse, startManorRun, enterRoom, startChase, updateChase, endChase, skullScare, resetManor };
