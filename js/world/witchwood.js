import * as THREE from 'three';
import { $, PI, R, TAU, V3, clamp, damp, hdr, pick, rand, setSeed } from '../core/utils.js';
import { treeGeometry } from './landscape.js';
import { Batcher, ROCKS, SB, _up, addBox, addCircle, addInteract, addLamp, onUpdate } from '../core/registry.js';
import { chunkedInstances, lathe, roundBox } from './props.js';
import { M } from '../core/materials.js';
import { addMarker, makeSign } from './attractions.js';
import { FX_OBJECTS, camera, pointLight, scene } from '../core/renderer.js';
import { flameMat, makePoints, waterMat } from '../core/shaders.js';
import { t } from '../core/i18n.js';
import { S, SCORES, endGame, player, ray, saveScores } from '../game/play.js';
import { startFlight } from '../game/flight.js';
import { fade, toast } from '../ui/ui.js';
import { AU, mtof } from '../core/audio.js';
import { FW } from './atmosphere.js';
/* =========================================================================
   WITCHWOOD — a dense, fog-choked forest of twisted trees and glowing toadstools, a winding lantern trail,
   the crooked Witch's Cottage, the "Witch's Brew" memory game and the launch pad for BROOM FLIGHT.
   ========================================================================= */
const WOOD = { x0: -148, x1: -62, z0: -190, z1: -92 };
const BREW = { jars: [] }, GAME_BREW = { name: 'brew' };
const COTTAGE = { x: -116, z: -146 };
function buildWitchwood() {
  setSeed(7171);
  const geos = [treeGeometry(101), treeGeometry(131), treeGeometry(171)], trees = [[], [], []];
  const trail = [[-48, -78], [-78, -100], [-96, -128], [-110, -136]];
  const nearTrail = (x, z) => { for (let i = 0; i < trail.length - 1; i++) { const [ax, az] = trail[i], [bx, bz] = trail[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, k = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    if (Math.hypot(x - ax - dx * k, z - az - dz * k) < 5) return true; } return false; };
  for (let i = 0; i < 300; i++) { const x = R(WOOD.x0 + 2, WOOD.x1), z = R(WOOD.z0 + 2, WOOD.z1);
    if (nearTrail(x, z) || Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 16 || (x > -86 && z > -110)) continue;
    trees[i % 3].push({ x, z, s: R(1.6, 2.8), ry: R(0, TAU) }); addCircle(x, z, 0.6); }
  trees.forEach((list, v) => chunkedInstances(geos[v], M.bark, list, (o, tr) => { o.position.set(tr.x, 0, tr.z); o.rotation.y = tr.ry; o.scale.setScalar(tr.s); }, { shadow: true, cell: 30 }));
  // bioluminescent toadstools clustered among the roots
  const cap = lathe([[0.001, 0.32], [0.18, 0.3], [0.3, 0.22], [0.34, 0.14], [0.2, 0.15], [0.05, 0.14], [0.001, 0.14]], 14), stem = lathe([[0.001, 0], [0.06, 0], [0.05, 0.16], [0.04, 0.3], [0.001, 0.3]], 8);
  const shrooms = []; for (let i = 0; i < 420; i++) { const cx = R(WOOD.x0, WOOD.x1), cz = R(WOOD.z0, WOOD.z1); for (let k = 0; k < 3; k++) shrooms.push({ x: cx + R(-0.8, 0.8), z: cz + R(-0.8, 0.8), s: R(0.5, 1.6), c: pick([0x40ffd0, 0x9a60ff, 0x60ff80]) }); }
  const capMesh = chunkedInstances(cap, new THREE.MeshBasicMaterial({ color: 0xffffff }), shrooms, (o, m) => { o.position.set(m.x, 0, m.z); o.scale.setScalar(m.s); o.rotation.y = m.x; });
  capMesh.forEach(im => { let i = 0; for (const m of shrooms) { if (i >= im.count) break; } });
  shrooms.forEach((m, i) => { m.col = new THREE.Color(m.c).multiplyScalar(R(1.2, 2.4)); });
  { let start = 0; const cells = new Map(); for (const m of shrooms) { const k = Math.floor(m.x / 40) + ',' + Math.floor(m.z / 40); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(m); }
    let ci = 0; for (const list of cells.values()) { const im = capMesh[ci++]; list.forEach((m, i) => im.setColorAt(i, m.col)); im.instanceColor.needsUpdate = true; } }
  chunkedInstances(stem, new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.8 }), shrooms, (o, m) => { o.position.set(m.x, 0, m.z); o.scale.setScalar(m.s); });
  for (const [x, z] of [[-60, -86], [-72, -96], [-84, -108], [-92, -120], [-100, -130], [-108, -134]]) addLamp(x, z, 4);
  makeSign('WITCHWOOD', 5.5, 1.4, -52, 4.6, -80, Math.atan2(1, 1) + PI / 2, { size: 140, color: '#7dffb0', glow: '#20ff80', sub: 'stay on the path' });
  buildCottage();
}
function buildCottage() {
  const { x: X, z: Z } = COTTAGE, g = new THREE.Group(); g.position.set(X, 0, Z); g.rotation.y = 0.5; scene.add(g); const b = new Batcher();
  // crooked walls, leaning chimney, steep sagging roof
  b.add(roundBox(7, 4.2, 6, 0.08, 2), M.stoneDark, 0, 2.1, 0, 0, { rz: 0.04 }); b.add(roundBox(7.2, 0.5, 6.2, 0.08, 2), M.woodDark, 0, 4.3, 0, 0, { rz: 0.04 });
  const roof = new THREE.ConeGeometry(5.6, 6.5, 4, 3); const rp = roof.attributes.position;
  for (let i = 0; i < rp.count; i++) { const y = rp.getY(i) + 3.25; rp.setX(i, rp.getX(i) + Math.pow(y / 6.5, 2) * 1.6); rp.setZ(i, rp.getZ(i) * (1 + 0.05 * Math.sin(y * 3))); }
  roof.computeVertexNormals(); b.add(roof, M.roof, 0.2, 7.6, 0, PI / 4);
  b.add(roundBox(1.1, 5, 1.1, 0.06, 1), M.stone, 2.4, 6.4, -1.6, 0, { rz: -0.12 });
  b.add(roundBox(1.4, 2.6, 0.12, 0.04, 1), M.woodDark, 0, 1.3, 3.02);
  b.build(g);
  for (const [x, y] of [[-2.2, 2.4], [2.2, 2.4], [0, 5.6]]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: hdr(0x7dff9a, 1.8) })); w.position.set(x, y, 3.03); g.add(w); }
  const smoke = makePoints(90), sd = []; for (let i = 0; i < 90; i++) sd.push({ t: R(0, 6) });
  const chimneyTop = new V3(2.7, 9.1, -1.6).applyAxisAngle(_up, 0.5).add(new V3(X, 0, Z));
  addBox(X - 4.5, X + 4.5, Z - 4, Z + 4);
  // cauldron & ingredient shelf for the Witch's Brew
  const CX = X + 4.2, CZ = Z + 7.5;
  const pot = new THREE.Mesh(lathe([[0, 0], [0.9, 0.1], [1.25, 0.6], [1.25, 1.2], [1.05, 1.45], [1.12, 1.5]], 28), new THREE.MeshStandardMaterial({ color: 0x0e0d12, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  pot.position.set(CX, 0.2, CZ); pot.castShadow = true; scene.add(pot);
  const brew = new THREE.Mesh(new THREE.CircleGeometry(1.05, 28).rotateX(-PI / 2), waterMat(new THREE.Color().setRGB(0.3, 2.2, 0.5), CX, CZ)); brew.position.set(CX, 1.55, CZ); scene.add(brew); BREW.brew = brew;
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ROCKS.push({ x: CX + Math.cos(a) * 1.4, z: CZ + Math.sin(a) * 1.4, s: 0.3 }); }
  addCircle(CX, CZ, 1.4);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3).translate(0, 0.6, 0), flameMat(0xffd070, 0xff3a00, 2.2)); fire.position.set(CX, 0, CZ); scene.add(fire); FX_OBJECTS.push(fire);
  SB.add(roundBox(5.4, 0.12, 0.7, 0.03, 1), M.woodDark, CX, 1.0, CZ + 3); for (const s of [-1, 1]) SB.add(roundBox(0.12, 1.0, 0.7, 0.03, 1), M.woodDark, CX + s * 2.6, 0.5, CZ + 3); addBox(CX - 2.8, CX + 2.8, CZ + 2.6, CZ + 3.4);
  const ING = [['Eye of Newt', 0x40ff60, 0], ['Bat Wing', 0x9a50ff, 2], ['Toad Wart', 0xff8a20, 4], ['Ghost Dust', 0xe0f0ff, 7], ['Dragon Blood', 0xff2020, 9]];
  ING.forEach(([name, col, semi], i) => { const m = new THREE.Mesh(lathe([[0.001, 0], [0.26, 0], [0.3, 0.3], [0.28, 0.6], [0.14, 0.7], [0.14, 0.82], [0.001, 0.82]], 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.3) }));
    m.position.set(CX - 2 + i, 1.06, CZ + 3); scene.add(m); BREW.jars.push({ m, name, col: new THREE.Color(col), semi }); });
  pointLight('cottage', 0x60ff90, 70, 24, CX, 3.5, CZ);
  BREW.cam = new V3(CX, 2.2, CZ - 2.6); GAME_BREW.exit = [CX, CZ - 3.2, PI];
  addInteract({ x: CX, z: CZ - 2, r: 2.6, label: () => t("Witch's Brew (memory game) · best {n}", { n: SCORES.brew || 0 }), action: startBrew }); addMarker(CX - 1.4, CZ - 2, 'PLAY', 0x7dffb0);
  addInteract({ x: X + 1.6, z: Z + 5.2, r: 2.8, label: 'Take the witch’s broom (Broom Flight & ring race)', action: () => startFlight() }); addMarker(X + 1.6, Z + 5.2, 'FLY', 0xb796ff);
  onUpdate((dt, t) => {
    for (let i = 0; i < 90; i++) { const d = sd[i]; d.t += dt; if (d.t > 6) d.t = 0; const k = d.t / 6;
      smoke.pos.set([chimneyTop.x + Math.sin(i + t * 0.3) * k * 1.5 + k * 2, chimneyTop.y + k * 9, chimneyTop.z + Math.cos(i * 1.7) * k * 1.5], i * 3);
      const a = (1 - k) * 0.25; smoke.col.set([a * 0.5, a * 0.6, a * 0.55], i * 3); smoke.size[i] = 0.8 + k * 3; }
    smoke.flag();
    if (S.game !== GAME_BREW) BREW.brew.material.uniforms.uBoost.value = damp(BREW.brew.material.uniforms.uBoost.value, 1, 3, dt);
  });
}
// ---- Witch's Brew: watch the cauldron's sequence of colours, then click the jars in the same order ----
function startBrew() {
  fade(() => { S.mode = 'game'; S.game = GAME_BREW; Object.assign(GAME_BREW, { round: 0, seq: [], input: 0, phase: 'show', t: 0, show: 0, ended: false }); player.yaw = 0; player.pitch = -0.32;
    $('#crosshair').classList.add('game'); $('#gamepanel').classList.remove('hidden'); toast("Witch's Brew", 'Watch the cauldron. Then click the ingredient jars in the same order.'); nextBrewRound(); });
}
function nextBrewRound() { const G = GAME_BREW; G.round++; G.seq.push(Math.floor(rand() * 5)); G.phase = 'show'; G.show = 0; G.t = -0.6; G.input = 0; }
function flashJar(i, dur = 0.4) { const J = BREW.jars[i]; J.flash = dur; BREW.brew.material.uniforms.uColor.value.copy(J.col).multiplyScalar(2); BREW.brew.material.uniforms.uBoost.value = 3.5;
  AU.tone({ f: mtof(60 + J.semi), type: 'triangle', dur: 0.5, vol: 0.12 }); AU.tone({ f: mtof(72 + J.semi), dur: 0.3, vol: 0.05 }); }
GAME_BREW.update = (dt) => {
  const G = GAME_BREW; player.yaw = clamp(player.yaw, -0.6, 0.6); player.pitch = clamp(player.pitch, -0.6, 0.1); camera.position.copy(BREW.cam); camera.rotation.set(player.pitch, PI + player.yaw, 0);
  if (G.phase === 'show') { G.t += dt; const step = Math.max(0.35, 0.75 - G.round * 0.03); if (G.t > step) { G.t = 0; if (G.show < G.seq.length) flashJar(G.seq[G.show++], step * 0.7); else { G.phase = 'input'; } } }
  for (const J of BREW.jars) { J.flash = Math.max(0, (J.flash || 0) - dt); J.m.material.color.copy(J.col).multiplyScalar(1.3 + J.flash * 6); J.m.position.y = 1.06 + J.flash * 0.3; }
  $('#gamepanel').innerHTML = `<div>${t('Round')}<b>${G.round}</b></div><div>${t(G.phase === 'show' ? 'Watch…' : 'Your turn')}<b>${G.input}/${G.seq.length}</b></div><div>${t('Best')}<b>${SCORES.brew || 0}</b></div>`;
};
GAME_BREW.click = () => { const G = GAME_BREW; if (G.phase !== 'input') return;
  ray.setFromCamera(new THREE.Vector2(0, 0), camera); const hit = ray.intersectObjects(BREW.jars.map(j => j.m), false)[0]; if (!hit) return;
  const i = BREW.jars.findIndex(j => j.m === hit.object); flashJar(i, 0.3);
  if (i !== G.seq[G.input]) { G.phase = 'over'; AU.tone({ f: 110, f2: 55, type: 'sawtooth', dur: 0.8, vol: 0.2, lp: 800 }); FW.burst(BREW.brew.position, 60, new THREE.Color(3, 0.3, 0.2), 3, 'splat'); const score = G.round - 1;
    if (!G.ended) { G.ended = true; endGame(t("Witch's Brew · round {n}", { n: score }), score > (SCORES.brew || 0) ? t('A new record! The witch is almost impressed.') : t('Wrong ingredient! The brew explodes.'), () => { if (score > (SCORES.brew || 0)) { SCORES.brew = score; saveScores(); } }); } return; }
  G.input++; if (G.input >= G.seq.length) { G.phase = 'wait'; AU.chime(); FW.burst(BREW.brew.position.clone().setY(2), 40, new THREE.Color(0.6, 3, 0.8), 3, 'soul'); setTimeout(nextBrewRound, 900); } };

export { WOOD, BREW, GAME_BREW, COTTAGE, buildWitchwood, buildCottage, startBrew, nextBrewRound, flashJar };
