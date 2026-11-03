import * as THREE from 'three';
import { $, PI, TAU, V3, clamp, damp, hdr, lerp, setSeed, yawTo } from '../core/utils.js';
import { stripeTex, targetTex } from '../core/textures.js';
import { Batcher, PAL_SPOOK, PAL_WARM, SB, addBox, addCircle, addInteract, addLamp, addPool, cylBetween, makeBulbs, onUpdate } from '../core/registry.js';
import { M } from '../core/materials.js';
import { FX_OBJECTS, LIGHTS, camera, pointLight, scene } from '../core/renderer.js';
import { t } from '../core/i18n.js';
import { addMarker, makeSign, markDone } from './attractions.js';
import { lathe, roundBox } from './props.js';
import { FW, GHOST_GEO } from './atmosphere.js';
import { coneMat, ghostMat } from '../core/shaders.js';
import { S, SCORES, boardRide, endGame, keys, player, saveScores } from '../game/play.js';
import { fade, floater, toast } from '../ui/ui.js';
import { AU } from '../core/audio.js';
import { bigPumpkin } from './landscape.js';
import { RIDES } from './rides.js';
/* =========================================================================
   CIRCUS OF HORRORS — a colossal striped Big Top you can walk into (the PHANTOM CIRCUS performs inside),
   the Cauldron Cups spinning ride, Hex Archery and Skull Roll on the midway.
   ========================================================================= */
const TENT = { x: -118, z: 22, r: 22, acts: [], spots: [], inside: false };
function buildCircus() {
  setSeed(9191);
  const { x: X, z: Z, r: RT } = TENT, WALL = 8.5, PEAK = 21;
  const stripe = new THREE.MeshStandardMaterial({ map: stripeTex(['#5a1478', '#e8641a'], 32), side: THREE.DoubleSide, roughness: 0.85 });
  const gap = 0.32; // entrance opening (radians) facing the plaza (+x)
  SB.add(new THREE.CylinderGeometry(RT, RT, WALL, 64, 1, true, PI / 2 + gap, TAU - gap * 2), stripe, X, WALL / 2, Z);
  SB.add(new THREE.ConeGeometry(RT + 1.2, PEAK - WALL, 64, 4, true), stripe, X, WALL + (PEAK - WALL) / 2, Z);
  SB.add(new THREE.CylinderGeometry(RT + 1.25, RT + 1.25, 1.4, 64, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex(['#e8641a', '#5a1478'], 48, false, true), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), X, WALL - 0.3, Z);
  for (let i = 0; i < 46; i++) { const a = i / 46 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < gap + 0.05) continue; addCircle(X + Math.cos(a) * RT, Z - Math.sin(a) * RT, 1.6); }
  SB.add(new THREE.CylinderGeometry(0.35, 0.45, PEAK + 3, 12), M.iron, X, (PEAK + 3) / 2, Z); addCircle(X, Z, 0.6);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; SB.add(new THREE.CylinderGeometry(0.22, 0.28, 16, 10), M.iron, X + Math.cos(a) * 9, 8, Z + Math.sin(a) * 9); addCircle(X + Math.cos(a) * 9, Z + Math.sin(a) * 9, 0.4); }
  const flag = new THREE.MeshStandardMaterial({ color: 0xe8641a, side: THREE.DoubleSide, roughness: 0.8 });
  const flags = []; for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1, 6, 1).translate(0.9, 0, 0), i % 2 ? M.purple : flag); const a = i / 5 * TAU;
    f.position.set(X + (i ? Math.cos(a) * 9 : 0), i ? 17 : PEAK + 2.6, Z + (i ? Math.sin(a) * 9 : 0)); scene.add(f); flags.push(f); }
  const bp = []; for (let s = 0; s < 16; s++) { const a = s / 16 * TAU; for (let k = 0; k <= 14; k++) { const t = k / 14, r = (RT + 1.2) * (1 - t); bp.push(new V3(X + Math.cos(a) * r, WALL + (PEAK - WALL) * t, Z + Math.sin(a) * r)); } }
  for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; bp.push(new V3(X + Math.cos(a) * (RT + 1.3), WALL - 1, Z + Math.sin(a) * (RT + 1.3))); }
  const tb = makeBulbs(scene, bp, PAL_WARM, 0.11); tb.userData.chase = true;
  makeSign('CIRCUS OF HORRORS', 10, 2.5, X + RT + 1.4, 11.6, Z, PI / 2, { size: 100, color: '#ffb050', glow: '#ff3a00', sub: 'the Phantom Circus performs nightly' });
  // inside: sawdust ring, bleachers, trapeze rigging, spotlights, phantom performers
  SB.add(new THREE.CircleGeometry(RT - 0.5, 64).rotateX(-PI / 2), M.straw, X, 0.03, Z, 0, { shadow: false });
  SB.add(new THREE.TorusGeometry(7.5, 0.3, 10, 64), new THREE.MeshPhysicalMaterial({ color: 0x8a1010, roughness: 0.4, clearcoat: 0.8 }), X, 0.25, Z, 0, { rx: PI / 2 });
  for (let row = 0; row < 5; row++) { const r0 = RT - 1.2 - row * 1.0; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < gap + 0.25) continue;
    SB.add(roundBox(3.4, 0.4, 0.9, 0.04, 1), M.woodDark, X + Math.cos(a) * r0, 0.25 + (4 - row) * 0.5, Z - Math.sin(a) * r0, a + PI / 2); } }
  for (const s of [-1, 1]) { cylBetween(new V3(X - 6, 0, Z + s * 5), new V3(X - 6, 15, Z + s * 5), 0.1, M.iron); cylBetween(new V3(X + 6, 0, Z + s * 5), new V3(X + 6, 15, Z + s * 5), 0.1, M.iron); cylBetween(new V3(X - 6, 15, Z + s * 5), new V3(X + 6, 15, Z + s * 5), 0.08, M.iron); }
  for (let i = 0; i < 3; i++) { const piv = new THREE.Group(); piv.position.set(X - 3 + i * 3, 15, Z); scene.add(piv);
    const bar = new Batcher(); bar.add(new THREE.CylinderGeometry(0.015, 0.015, 6, 4), M.iron, -0.5, -3, 0); bar.add(new THREE.CylinderGeometry(0.015, 0.015, 6, 4), M.iron, 0.5, -3, 0); bar.add(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), M.brass, 0, -6, 0, 0, { rz: PI / 2 }); bar.build(piv);
    const gh = new THREE.Mesh(GHOST_GEO, ghostMat(0xd0f0ff, i * 2.3)); gh.position.y = -7.2; gh.rotation.x = PI; gh.scale.setScalar(0.9); piv.add(gh); FX_OBJECTS.push(gh); TENT.acts.push({ piv, gh, ph: i * 2.1 }); }
  TENT.juggler = new THREE.Mesh(GHOST_GEO, ghostMat(0xffd0a0, 7.7)); TENT.juggler.position.set(X, 1.6, Z); scene.add(TENT.juggler); FX_OBJECTS.push(TENT.juggler);
  TENT.balls = []; for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: hdr([0xff7a20, 0x9a50ff, 0x50ff90][i % 3], 2.4) })); scene.add(b); TENT.balls.push(b); }
  for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(X + Math.cos(i * PI / 2) * 14, 14, Z + Math.sin(i * PI / 2) * 14); scene.add(g);
    const c = new THREE.Mesh(new THREE.ConeGeometry(2.2, 15, 24, 1, true).translate(0, -7.5, 0), coneMat([0xffe0b0, 0xb090ff, 0xffb070, 0x90ffd0][i], 0.12, 4)); g.add(c); FX_OBJECTS.push(c); TENT.spots.push(g); }
  pointLight('circus', 0xffc080, 0, 30, X, 9, Z);
  pointLight('circusFront', 0xffa060, 220, 34, X + RT + 7, 5, Z); addPool(X + RT + 5, Z, 14, 0xff9a40, 0.7); // warm floodlight on the entrance façade
  for (const [x, z] of [[X + RT + 4, Z - 6], [X + RT + 4, Z + 6]]) addLamp(x, z, 4.5);
  onUpdate((dt, t) => {
    const p = player.pos, inside = S.mode === 'roam' && Math.hypot(p.x - X, p.z - Z) < RT - 0.5;
    if (inside && !TENT.inside) { toast('The Phantom Circus', 'Ladies, gentlemen and restless spirits… the show begins!', 'soul'); markDone('circus'); AU.applause(new V3(X, 3, Z)); }
    TENT.inside = inside; const near = camera.position.distanceTo(new V3(X, 4, Z)) < 40;
    LIGHTS.circus.intensity = near ? (inside ? 150 : 50) : 0;
    TENT.acts.forEach(a => { a.piv.rotation.z = Math.sin(t * 1.1 + a.ph) * 0.9; a.gh.rotation.z = Math.sin(t * 2.2 + a.ph) * 0.5; });
    TENT.juggler.rotation.y = t * 0.6; TENT.juggler.position.y = 1.6 + Math.sin(t * 2) * 0.1;
    TENT.balls.forEach((b, i) => { const ph = (t * 1.6 + i / 5) % 1, side = Math.floor(t * 1.6 + i / 5) % 2 ? 1 : -1; b.position.set(X + side * lerp(-0.6, 0.6, ph) * 1, 2.6 + Math.sin(ph * PI) * 2.4, Z + 0.4); });
    TENT.spots.forEach((s, i) => { s.lookAt(X + Math.sin(t * 0.7 + i * 1.7) * 7, 0, Z + Math.cos(t * 0.6 + i) * 7); s.rotateX(PI / 2); });
    flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2 + i) * 0.3; });
  });
  buildCups(); buildArchery(); buildSkullRoll();
}
/* ---------- Cauldron Cups: spinning cauldrons on a turning floor (hold A/D to spin yours) ---------- */
const CUPS = { spin: 0, mine: 0 };
function buildCups() {
  const X = -98, Z = 56;
  SB.add(new THREE.CylinderGeometry(8.6, 9, 0.5, 48), M.stone, X, 0.25, Z); addCircle(X, Z, 8.8);
  const floor = new THREE.Group(); floor.position.set(X, 0.5, Z); scene.add(floor); const fb = new Batcher();
  fb.add(new THREE.CylinderGeometry(8.2, 8.2, 0.12, 48), new THREE.MeshStandardMaterial({ map: stripeTex(['#1a3a20', '#2a0a2a'], 16), roughness: 0.6 }), 0, 0.06, 0); fb.build(floor);
  bigPumpkin(floor, 0, 1.4, 0, 1.4);
  const potG = lathe([[0.001, 0], [0.9, 0.06], [1.25, 0.45], [1.3, 0.9], [1.12, 1.15], [1.2, 1.2], [1.14, 1.24], [1.0, 0.95], [0.001, 0.95]], 32);
  const cups = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, piv = new THREE.Group(); piv.position.set(Math.cos(a) * 5.4, 0.12, Math.sin(a) * 5.4); floor.add(piv);
    const cup = new THREE.Group(); piv.add(cup);
    const pot = new THREE.Mesh(potG, new THREE.MeshPhysicalMaterial({ color: [0x1a1a22, 0x3a1450, 0x14381a][i % 3], metalness: 0.6, roughness: 0.35, clearcoat: 0.7, side: THREE.DoubleSide })); pot.castShadow = true; cup.add(pot);
    for (let k = 0; k < 3; k++) { const b = k / 3 * TAU; const leg = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), M.iron); leg.position.set(Math.cos(b) * 0.8, -0.05, Math.sin(b) * 0.8); leg.rotation.x = PI; cup.add(leg); }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.06, 8, 32).rotateX(PI / 2), M.brass); lip.position.y = 1.2; cup.add(lip);
    cups.push({ cup, ph: i * 1.1 }); }
  const bp = []; for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; bp.push(new V3(Math.cos(a) * 8.6, 0.6, Math.sin(a) * 8.6)); }
  makeBulbs(floor, bp, PAL_SPOOK, 0.09);
  const seat = new THREE.Object3D(); seat.position.set(0, 0.55, 0); cups[0].cup.add(seat);
  RIDES.cups = { name: 'Cauldron Cups', seat, eye: 0.8, exit: [X + 11, Z - 2], exitYaw: yawTo(X + 11, Z - 2, X, Z), dur: 40,
    hint: 'Hold A or D to spin your cauldron faster!  ·  E — climb out', done: 'The world keeps spinning. That is normal. Probably.',
    ctrl: (dt) => { const f = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); CUPS.mine = clamp(CUPS.mine + f * 3 * dt, -6, 6); }, fov: () => Math.abs(CUPS.mine) * 1.2, shake: () => Math.abs(CUPS.mine) > 4 ? 0.01 : 0,
    onBoard: () => { CUPS.mine = 0; } };
  addInteract({ x: X + 9.8, z: Z, r: 3, label: 'Ride the Cauldron Cups', action: () => boardRide('cups') }); addMarker(X + 9.8, Z, 'RIDE', 0x7dffb0);
  makeSign('CAULDRON CUPS', 6, 1.5, X, 6.5, Z + 9.2, PI, { size: 120, color: '#7dffb0', glow: '#20ff60' });
  onUpdate((dt, t) => { floor.rotation.y += dt * 0.5; CUPS.mine = damp(CUPS.mine, 0, 0.25, dt);
    cups.forEach((c, i) => { c.cup.rotation.y += dt * (i === 0 && S.ride === RIDES.cups ? 1.2 + CUPS.mine : 1.4 * Math.sin(t * 0.3 + c.ph)); }); });
}
/* ---------- Hex Archery: draw the bow, lead your target, loose! ---------- */
const ARCH = { targets: [], arrows: [] }, GAME_ARCH = { name: 'archery' };
function buildArchery() {
  const X = -112, Z = -12;
  SB.add(roundBox(4, 1.1, 1.2, 0.05, 1), M.woodDark, X + 2.5, 0.55, Z); addBox(X + 0.5, X + 4.5, Z - 0.6, Z + 0.6);
  for (let i = 0; i < 4; i++) SB.add(roundBox(0.14, 2.6, 0.14, 0.03, 1), M.woodDark, X + 1 + i * 1.1, 1.3, Z + 0.7);
  makeSign('HEX ARCHERY', 5.5, 1.4, X + 2.5, 3.6, Z + 0.75, PI, { size: 130, color: '#ffd070', glow: '#ff8000', sub: 'ghosts · pumpkins · golden bats' });
  for (let i = 0; i < 6; i++) { const ty = i % 3, m = new THREE.Mesh(ty === 2 ? new THREE.SphereGeometry(0.45, 16, 12) : new THREE.CircleGeometry(0.75, 28), ty === 0 ? new THREE.MeshStandardMaterial({ map: targetTex('ghost'), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: targetTex('ghost'), emissiveIntensity: 0.5 }) : ty === 1 ? new THREE.MeshStandardMaterial({ map: targetTex('pumpkin'), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: targetTex('pumpkin'), emissiveIntensity: 0.5 }) : M.gold);
    m.position.set(X - 18 - i * 3, 2, Z); m.rotation.y = PI / 2; scene.add(m); ARCH.targets.push({ m, ty, ph: i * 1.3, dist: 16 + i * 3.5, down: 0, pts: [10, 15, 40][ty] }); }
  for (let i = 0; i < 8; i++) { const a = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5).rotateX(PI / 2), M.woodDark); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6).rotateX(-PI / 2), M.iron); tip.position.z = -0.5;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.16), M.flag); fl.position.z = 0.4; a.add(shaft, tip, fl); a.visible = false; scene.add(a); ARCH.arrows.push({ g: a, v: new V3(), on: false }); }
  const bow = new THREE.Group(); const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 6, 24, PI * 0.9), M.woodDark); arc.rotation.z = PI / 2 + PI * 0.05; bow.add(arc);
  const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0.55, 0), new V3(0, 0, 0.1), new V3(0, -0.55, 0)]), new THREE.LineBasicMaterial({ color: 0xd0d0c0 })); bow.add(str); ARCH.str = str;
  bow.position.set(0.12, -0.25, -0.75); bow.visible = false; camera.add(bow); ARCH.bow = bow;
  ARCH.cam = new V3(X + 0.2, 1.75, Z); GAME_ARCH.exit = [X + 1, Z + 2.2, PI / 2];
  addInteract({ x: X + 0.8, z: Z + 1.2, r: 2.6, label: () => t('Hex Archery · best {n}', { n: SCORES.archery || 0 }), action: startArchery }); addMarker(X + 1, Z + 1.6, 'PLAY', 0xffd070);
  onUpdate((dt, t) => { for (const tg of ARCH.targets) { const lat = tg.ty === 2 ? Math.sin(t * 1.9 + tg.ph) * 6 : Math.sin(t * 0.7 + tg.ph) * 4; tg.m.position.set(X - tg.dist, (tg.ty === 2 ? 4 + Math.sin(t * 2.6 + tg.ph) : 1.8) + (tg.down > 0 ? -5 : 0), Z + lat);
      tg.down = Math.max(0, tg.down - dt); } });
}
function startArchery() { fade(() => { S.mode = 'game'; S.game = GAME_ARCH; Object.assign(GAME_ARCH, { score: 0, left: 12, draw: 0, drawing: false, ended: false }); player.yaw = PI / 2; player.pitch = 0.02; ARCH.bow.visible = true;
  $('#crosshair').classList.add('game'); $('#gamepanel').classList.remove('hidden'); toast('Hex Archery', 'Hold the mouse to draw, release to loose. Lead the moving targets. 12 arrows.'); }); }
GAME_ARCH.update = (dt) => { const G = GAME_ARCH; player.yaw = clamp(player.yaw, PI / 2 - 0.6, PI / 2 + 0.6); player.pitch = clamp(player.pitch, -0.3, 0.5);
  camera.position.copy(ARCH.cam); camera.rotation.set(player.pitch, player.yaw, 0);
  if (G.drawing) { G.draw = Math.min(1, G.draw + dt / 0.9); $('#meter .needle').style.left = (G.draw * 100) + '%'; }
  ARCH.str.geometry.setFromPoints([new V3(0, 0.55, 0), new V3(0, 0, 0.1 + G.draw * 0.35), new V3(0, -0.55, 0)]);
  for (const a of ARCH.arrows) { if (!a.on) continue; a.v.y -= 9.8 * dt; const prev = a.g.position.clone(); a.g.position.addScaledVector(a.v, dt); a.g.lookAt(a.g.position.clone().sub(a.v));
    for (const tg of ARCH.targets) { if (tg.down > 0) continue; if (a.g.position.distanceTo(tg.m.position) < (tg.ty === 2 ? 0.6 : 0.8)) { a.on = false; tg.down = 2.5; G.score += tg.pts; AU.hit(true); floater(tg.m.position.clone(), '+' + tg.pts); FW.burst(tg.m.position, 40, tg.ty === 2 ? new THREE.Color(4, 3, 0.6) : new THREE.Color(3, 1.5, 0.4), 3, 'splat'); break; } }
    if (a.on && (a.g.position.y < 0.05 || a.g.position.x < ARCH.cam.x - 50)) { a.on = false; AU.thud(a.g.position, 0.3); a.g.position.y = Math.max(a.g.position.y, 0.05); } }
  $('#gamepanel').innerHTML = `<div>${t('Score')}<b>${G.score}</b></div><div>${t('Arrows')}<b>${G.left}</b></div><div>${t('Best')}<b>${SCORES.archery || 0}</b></div>`;
  if (G.left <= 0 && !ARCH.arrows.some(a => a.on) && !G.ended) { G.ended = true; endGame(t('Hex Archery · {n}', { n: G.score }), G.score > (SCORES.archery || 0) ? t('A new record, sharpshooter!') : t('The targets live to haunt another day.'), () => { if (G.score > (SCORES.archery || 0)) { SCORES.archery = G.score; saveScores(); } }); } };
GAME_ARCH.click = () => { const G = GAME_ARCH; if (G.left <= 0) return; G.drawing = true; G.draw = 0; $('#meter').classList.remove('hidden'); $('#meter .mlabel').textContent = t('Release to loose the arrow'); AU.creak(camera.position); };
GAME_ARCH.release = () => { const G = GAME_ARCH; if (!G.drawing) return; G.drawing = false; $('#meter').classList.add('hidden'); const a = ARCH.arrows.find(x => !x.on); if (!a) return;
  const d = new V3(); camera.getWorldDirection(d); a.g.position.copy(camera.position).addScaledVector(d, 0.8); a.v.copy(d).multiplyScalar(14 + G.draw * 34); a.on = true; a.g.visible = true; G.left--; G.draw = 0;
  AU.tone({ f: 180, f2: 90, type: 'triangle', dur: 0.2, vol: 0.25 }); AU.noise({ dur: 0.2, vol: 0.15, type: 'bandpass', f: 1200, f2: 300 }); };
GAME_ARCH.cleanup = () => { ARCH.bow.visible = false; ARCH.arrows.forEach(a => { a.on = false; a.g.visible = false; }); };
/* ---------- Skull Roll: bowl skulls up the ramp into the scoring rings (aim with the mouse, hold for power) ---------- */
const SKR = { balls: [], holes: [] }, GAME_SKR = { name: 'skullroll' };
function buildSkullRoll() {
  const X = -92, Z = 2;
  const lane = new Batcher(); lane.add(roundBox(2.4, 0.3, 10, 0.05, 1), M.wood, 0, 0.6, 0);
  for (const s of [-1, 1]) lane.add(roundBox(0.2, 0.6, 10, 0.05, 1), M.woodDark, s * 1.3, 0.9, 0);
  lane.add(roundBox(2.4, 3, 0.3, 0.05, 1), M.woodDark, 0, 2.2, -5.4);
  const g = new THREE.Group(); g.position.set(X, 0, Z); scene.add(g); lane.build(g); addBox(X - 1.4, X + 1.4, Z - 5.6, Z + 5);
  [[0, 2.4, 100, 0.22], [-0.7, 1.6, 50, 0.3], [0.7, 1.6, 50, 0.3], [0, 1.0, 30, 0.34], [-0.75, 0.5, 20, 0.36], [0.75, 0.5, 20, 0.36], [0, 0.15, 10, 0.5]].forEach(([hx, hy, pts, r]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: hdr(pts >= 50 ? 0xffc040 : 0xff7a20, 2) })); ring.position.set(X + hx, 1.0 + hy, Z - 5.2); scene.add(ring); SKR.holes.push({ p: ring.position, r, pts, ring }); });
  makeSign('SKULL ROLL', 4.6, 1.15, X, 4.4, Z - 5.2, 0, { size: 130, color: '#ffd070', glow: '#ff8000', sub: 'roll a skull into a ring' });
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), M.bone); b.visible = false; b.castShadow = true; scene.add(b); SKR.balls.push({ m: b, on: false, v: new V3() }); }
  SKR.cam = new V3(X, 1.9, Z + 5.6); GAME_SKR.exit = [X + 2, Z + 6, 0];
  addInteract({ x: X, z: Z + 5.8, r: 2.4, label: () => t('Skull Roll · best {n}', { n: SCORES.skullroll || 0 }), action: startSkullRoll }); addMarker(X + 1.6, Z + 5.8, 'PLAY', 0xffd070);
}
function startSkullRoll() { fade(() => { S.mode = 'game'; S.game = GAME_SKR; Object.assign(GAME_SKR, { score: 0, left: 9, charging: false, power: 0, ended: false }); player.yaw = 0; player.pitch = -0.12;
  $('#crosshair').classList.add('game'); $('#gamepanel').classList.remove('hidden'); toast('Skull Roll', 'Aim with the mouse, hold to charge, release to roll. 9 skulls.'); }); }
GAME_SKR.update = (dt) => { const G = GAME_SKR; player.yaw = clamp(player.yaw, -0.25, 0.25); player.pitch = clamp(player.pitch, -0.4, 0.2); camera.position.copy(SKR.cam); camera.rotation.set(player.pitch, player.yaw, 0);
  if (G.charging) { G.power = Math.min(1, G.power + dt / 1.1); $('#meter .needle').style.left = (G.power * 100) + '%'; }
  for (const b of SKR.balls) { if (!b.on) continue; b.v.y -= 9.8 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x -= dt * 12;
    if (b.m.position.y < 0.92 && b.v.y < 0 && b.m.position.z > SKR.cam.z - 10.4) { b.m.position.y = 0.92; b.v.y = Math.abs(b.v.y) * 0.25; }
    b.m.position.x = clamp(b.m.position.x, SKR.cam.x - 1.05, SKR.cam.x + 1.05);
    if (b.m.position.z < SKR.cam.z - 10.7) { let best = null; for (const h of SKR.holes) { const d = Math.hypot(b.m.position.x - h.p.x, b.m.position.y - h.p.y); if (d < h.r + 0.1 && (!best || h.pts > best.pts)) best = h; }
      b.on = false; b.m.visible = false; if (best) { G.score += best.pts; AU.chime(); floater(best.p.clone(), '+' + best.pts); FW.burst(best.p, 30, new THREE.Color(4, 2.4, 0.5), 2.5, 'spark'); best.ring.scale.setScalar(1.6); setTimeout(() => best.ring.scale.setScalar(1), 300); } else AU.thud(b.m.position, 0.4); } }
  $('#gamepanel').innerHTML = `<div>${t('Score')}<b>${G.score}</b></div><div>${t('Skulls')}<b>${G.left}</b></div><div>${t('Best')}<b>${SCORES.skullroll || 0}</b></div>`;
  if (G.left <= 0 && !SKR.balls.some(b => b.on) && !G.ended) { G.ended = true; endGame(t('Skull Roll · {n}', { n: G.score }), G.score > (SCORES.skullroll || 0) ? t('A new record! Bones everywhere.') : t('Roll again — the skulls insist.'), () => { if (G.score > (SCORES.skullroll || 0)) { SCORES.skullroll = G.score; saveScores(); } }); } };
GAME_SKR.click = () => { const G = GAME_SKR; if (G.left <= 0 || G.charging) return; G.charging = true; G.power = 0; $('#meter').classList.remove('hidden'); $('#meter .mlabel').textContent = t('Release to roll'); };
GAME_SKR.release = () => { const G = GAME_SKR; if (!G.charging) return; G.charging = false; $('#meter').classList.add('hidden'); const b = SKR.balls.find(x => !x.on); if (!b) return;
  b.m.position.set(SKR.cam.x, 0.95, SKR.cam.z - 0.8); const sp = 5 + G.power * 7.5; b.v.set(-Math.sin(player.yaw) * sp * 0.5, 2.2 + G.power * 3.2, -sp); b.on = true; b.m.visible = true; G.left--; AU.noise({ dur: 0.6, vol: 0.2, type: 'lowpass', f: 400, brown: true }); };
GAME_SKR.key = c => { if (c === 'Space') GAME_SKR.click(); }; GAME_SKR.keyUp = c => { if (c === 'Space') GAME_SKR.release(); };

export { TENT, buildCircus, CUPS, buildCups, ARCH, GAME_ARCH, buildArchery, startArchery, SKR, GAME_SKR, buildSkullRoll, startSkullRoll };
