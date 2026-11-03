import * as THREE from 'three';
import { $, PI, R, V3, clamp, damp, hdr, pick, rand, yawTo } from '../core/utils.js';
import { C_HEMI_RED, C_TOWER, C_TOWER_RED, FOG_BASE, FOG_RED, FP, HEMI_SKY, LIGHTS, MOON_COL, MOON_RED, camera, hemi, lantern, moon, scene } from '../core/renderer.js';
import { M, TX } from '../core/materials.js';
import { U_TIME } from '../core/shaders.js';
import { BULBS, addCircle, addInteract, nearColliders, onUpdate } from '../core/registry.js';
import { skyMat } from '../world/sky.js';
import { PUMPKIN_GEO, groundAt } from '../world/landscape.js';
import { TOWER } from '../world/plaza.js';
import { RIDES } from '../world/rides.js';
import { FIRE } from '../world/bonfire.js';
import { HOUSE, objective } from '../world/manor.js';
import { GALLERY, STRIKER } from '../world/midway.js';
import { markDone } from '../world/attractions.js';
import { BOLT, FW, MISTS, fireworksShow, strike } from '../world/atmosphere.js';
import { AU } from '../core/audio.js';
import { fade, floater, showCard, toast } from '../ui/ui.js';
import { t } from '../core/i18n.js';
import { LAKEFX } from '../world/lake.js';

/* =========================================================================
   9. GAMEPLAY — state, player, rides, mini-games, events, tour, photo mode
   ========================================================================= */
const S = { mode: 'title', locked: false, souls: 0, lit: 0, candy: 0, candyPick: 0, ghosts: 0, kicks: 0, smashed: 0, done: new Set(), chase: false, ghostHint: false, rideSpeed: 0, witch: 0, witchT: -1, flash: 0, flashCol: new THREE.Vector3(), shake: 0, camYaw: 0, indoor: 0,
  fov: 62, timeScale: 1, potion: null, potionT: 0, speedMul: 1, gravMul: 1, lightShow: 'idle', lightShowT: 0, ride: null, game: null, filter: 0, lantern: false,
  photo: { focus: 12, aperture: 0.6, fov: 50, filter: 0, freeze: false, hide: false, prev: 'roam' } };
let SCORES = { shoot: 0, striker: 0, bump: 0, whack: 0, toss: 0, manor: 0 };
try { SCORES = Object.assign(SCORES, JSON.parse(localStorage.getItem('hollowmoor-scores') || '{}')); } catch (e) {}
const saveScores = () => { try { localStorage.setItem('hollowmoor-scores', JSON.stringify(SCORES)); } catch (e) {} };

const player = { pos: new V3(0, 0, 96), vel: new V3(), vy: 0, yaw: 0, pitch: 0, onGround: true, bob: 0, lastStep: 0 };
const keys = {};

function collide(p, r = 0.38) {
  for (let it = 0; it < 2; it++) for (const c of nearColliders(p.x, p.z, r + 1)) {
    if (c.off) continue;
    if (c.t === 0) { const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; } }
    else { if (p.x < c.x0 - r || p.x > c.x1 + r || p.z < c.z0 - r || p.z > c.z1 + r) continue;
      const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 > 1e-8) { if (d2 < r * r) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; } }
      else { const l = p.x - c.x0, rr2 = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr2, t, b);
        if (m === l) p.x = c.x0 - r; else if (m === rr2) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r; } }
  }
  p.x = clamp(p.x, -149.4, 149.4); p.z = clamp(p.z, -191.4, 102); if (p.z > 78.5) p.x = clamp(p.x, -30, 30);
}
function updatePlayer(dt) {
  const k = keys; let fx = 0, fz = 0;
  if (S.locked) { if (k.KeyW || k.ArrowUp) fz += 1; if (k.KeyS || k.ArrowDown) fz -= 1; if (k.KeyA || k.ArrowLeft) fx -= 1; if (k.KeyD || k.ArrowRight) fx += 1; }
  if (S.locked && S.joy && (S.joy.x || S.joy.y)) { fx += S.joy.x; fz += S.joy.y; } // touch stick / gamepad (analog)
  const run = k.ShiftLeft || k.ShiftRight, speed = (run ? 8.2 : 4.3) * S.speedMul;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw), len = Math.max(1, Math.hypot(fx, fz));
  const tx = (-sy * fz + cy * fx) / len * speed, tz = (-cy * fz - sy * fx) / len * speed;
  const acc = player.onGround ? 10 : 2.5;
  player.vel.x = damp(player.vel.x, (fx || fz) ? tx : 0, acc, dt); player.vel.z = damp(player.vel.z, (fx || fz) ? tz : 0, acc, dt);
  player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt; collide(player.pos);
  const g = groundAt(player.pos.x, player.pos.z);
  if (S.locked && k.Space && player.onGround) { player.vy = 5.2 * (S.gravMul < 1 ? 1.6 : 1); player.onGround = false; }
  player.vy -= 13 * S.gravMul * dt; player.pos.y += player.vy * dt;
  if (player.pos.y <= g) { if (!player.onGround && player.vy < -4) AU.step(false); player.pos.y = g; player.vy = 0; player.onGround = true; }
  const hs = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround) { player.bob += hs * dt * 1.55; const st = Math.floor(player.bob / PI); if (st !== player.lastStep) { player.lastStep = st; if (hs > 1) AU.step(HOUSE.inside); } }
  const bk = S.headBob === false || S.reduceMotion ? 0 : 1, bobY = Math.sin(player.bob * 2) * 0.045 * Math.min(1, hs / 4) * bk, bobX = Math.cos(player.bob) * 0.03 * Math.min(1, hs / 4) * bk;
  camera.position.set(player.pos.x + Math.cos(player.yaw) * bobX, player.pos.y + 1.68 + bobY, player.pos.z - Math.sin(player.yaw) * bobX);
  camera.rotation.set(player.pitch, player.yaw, -fx * 0.012 * Math.min(1, hs / 4));
}
// ---- Rides ----
const _qa = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new V3();
// Every ride: board at its station (E or click), ride a full cycle with its own controls, then get unloaded automatically.
const _qr = new THREE.Quaternion(), _tv = new V3(), _prevSeat = new V3();
function boardRide(name) {
  const r = RIDES[name]; r.key = name;
  fade(() => { S.mode = 'ride'; S.ride = r; r.t = 0; r.ending = false; r.leaving = false; r.onBoard && r.onBoard(); player.yaw = 0; player.pitch = -0.05; S.rideSpeed = 0;
    objective(r.name, r.hint || 'E — leave the ride', true); AU.click(); AU.boardBell(); });
}
function exitRide() {
  const r = S.ride; if (!r || r.leaving) return; r.leaving = true;
  fade(() => { r.onExit && r.onExit(); player.pos.set(r.exit[0], 0, r.exit[1]); collide(player.pos); player.yaw = r.exitYaw; player.pitch = 0;
    S.mode = 'roam'; S.ride = null; S.rideSpeed = 0; camera.fov = S.fov; camera.updateProjectionMatrix(); objective(null); });
}
function updateRideCam(dt) {
  const r = S.ride; if (!r) return; r.t += dt; if (r.ctrl) r.ctrl(dt);
  r.seat.updateWorldMatrix(true, false); r.seat.getWorldPosition(_v); r.seat.getWorldQuaternion(_qa);
  S.rideSpeed = r.t > 0.3 && dt > 0 ? damp(S.rideSpeed, _v.distanceTo(_prevSeat) / dt, 4, dt) : 0; _prevSeat.copy(_v);
  _e.set(player.pitch, player.yaw, 0); camera.quaternion.copy(_qa).multiply(_qr.setFromEuler(_e));
  camera.position.copy(_v).add(_tv.set(0, r.eye, 0).applyQuaternion(_qa));
  const sh = r.shake ? r.shake() : 0; if (sh) { camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh; }
  const fov = S.fov + (r.fov ? r.fov() : 0); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 5, dt); camera.updateProjectionMatrix(); }
  const prog = clamp(r.progress ? r.progress() : r.t / r.dur, 0, 1); $('#objective .ob i').style.width = (prog * 100) + '%';
  if (prog >= 1 && !r.ending) { r.ending = true; toast(t('{r} · ride complete', { r: t(r.name) }), r.done || ''); markDone(r.key); setTimeout(exitRide, 1200); }
}
// ---- Mini-game: Spook Shoot ----
const GAME_SHOOT = { name: 'shoot' }, GAME_STRIKER = { name: 'striker' };
function startGallery() {
  fade(() => { S.mode = 'game'; S.game = GAME_SHOOT; Object.assign(GAME_SHOOT, { score: 0, time: 30, shots: 0, hits: 0 }); player.yaw = -PI / 2; player.pitch = -0.02;
    GALLERY.targets.forEach(t => { t.up = 1; t.down = 0; }); $('#crosshair').classList.add('game'); $('#gamepanel').classList.remove('hidden'); toast('Spook Shoot', 'Click to fire · 30 seconds · spare the cat!'); });
}
function updateGallery(dt) {
  const G = GAME_SHOOT; if (!S.menu) G.time -= dt;
  player.yaw = clamp(player.yaw, -PI / 2 - 0.75, -PI / 2 + 0.75); player.pitch = clamp(player.pitch, -0.45, 0.4);
  camera.position.copy(GALLERY.cam); camera.rotation.set(player.pitch, player.yaw, 0);
  $('#gamepanel').innerHTML = `<div>${t('Score')}<b>${G.score}</b></div><div>${t('Time')}<b>${Math.max(0, G.time).toFixed(1)}</b></div><div>${t('Best')}<b>${SCORES.shoot}</b></div>`;
  if (G.time <= 0) endGame(t('Final score {n}', { n: G.score }), G.score > SCORES.shoot ? 'A new record! The ghosts will remember this.' : t('Accuracy {n}%', { n: G.shots ? Math.round(G.hits / G.shots * 100) : 0 }), () => { if (G.score > SCORES.shoot) { SCORES.shoot = G.score; saveScores(); } });
}
const ray = new THREE.Raycaster();
function shootGallery() {
  const G = GAME_SHOOT; AU.shot(); G.shots++; const ch = $('#crosshair'); ch.classList.add('kick'); setTimeout(() => ch.classList.remove('kick'), 80);
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = ray.intersectObjects(GALLERY.targets.filter(t => t.up).map(t => t.m));
  if (!hits.length) return;
  const tg = GALLERY.targets.find(t => t.m === hits[0].object), pts = { ghost: 10, pumpkin: 15, bat: 50, cat: -25 }[tg.kind];
  tg.up = 0; tg.down = R(1.2, 2.5); G.score = Math.max(0, G.score + pts); if (pts > 0) G.hits++;
  AU.hit(pts > 0); floater(hits[0].point, (pts > 0 ? '+' : '') + pts, pts < 0);
  FW.burst(hits[0].point, 30, pts > 0 ? new THREE.Color(3, 1.6, 0.4) : new THREE.Color(3, 0.3, 0.3), 2.5, 'soul');
  if (tg.kind === 'cat') toast('You shot the cat!', 'It will remember this. All nine lives of it.', 'blood');
}
// ---- Mini-game: Test Your Nerve (high striker) ----
function startStriker() {
  fade(() => { $('#meter .mlabel').textContent = t('Space / click to strike'); S.mode = 'game'; S.game = GAME_STRIKER; Object.assign(GAME_STRIKER, { tries: 3, best: 0, needle: 0, dir: 1, speed: 1.1, phase: 'aim', h: 0, t: 0 }); player.yaw = PI / 2; player.pitch = 0.32;
    $('#meter').classList.remove('hidden'); $('#gamepanel').classList.remove('hidden'); toast('Test Your Nerve', 'Strike when the needle hits the centre'); });
}
function updateStriker(dt) {
  const G = GAME_STRIKER; camera.position.copy(STRIKER.cam); player.pitch = clamp(player.pitch, -0.2, 0.75); player.yaw = clamp(player.yaw, PI / 2 - 0.5, PI / 2 + 0.5);
  camera.rotation.set(player.pitch, player.yaw, 0);
  if (G.phase === 'aim' && !S.menu) { G.needle += G.dir * G.speed * dt; if (G.needle > 1) { G.needle = 1; G.dir = -1; } if (G.needle < 0) { G.needle = 0; G.dir = 1; } }
  if (G.phase === 'fly') { G.t += dt; const top = G.power * 8.0; const k = G.t < 0.7 ? Math.sin(G.t / 0.7 * PI / 2) : Math.max(0, 1 - (G.t - 0.7) * 1.4);
    STRIKER.puck.position.y = 0.9 + top * k;
    if (G.t > 0.7 && !G.rang) { G.rang = true; if (G.power > 0.94) { AU.bell(STRIKER.bell.position, 660, 2.5, 0.8); STRIKER.bellGlow.material.color.copy(hdr(0xffd070, 12)); FW.burst(STRIKER.bell.position.clone().add(new V3(0, 1, 0)), 120, new THREE.Color(4, 2.5, 0.6), 7); S.lightShow = 'rainbow'; S.lightShowT = 3; }
      floater(STRIKER.puck.position.clone(), Math.round(G.power * 100) + '%', G.power < 0.5); }
    if (G.t > 1.6) { STRIKER.bellGlow.material.color.copy(hdr(0xffd070, 0.3)); G.tries--; G.phase = G.tries > 0 ? 'aim' : 'done'; G.speed *= 1.35; G.rang = false;
      if (G.phase === 'done') { const b = Math.round(G.best * 100); const rank = b > 94 ? 'DEMON KING' : b > 80 ? 'UNDEAD' : b > 65 ? 'FEARLESS' : b > 45 ? 'BRAVE' : b > 25 ? 'SKITTISH' : 'MORTAL';
        endGame(t('Rank: {r}', { r: t(rank) }), t('Best strike {n}%', { n: b }), () => { if (b > SCORES.striker) { SCORES.striker = b; saveScores(); } }); } } }
  $('#meter .needle').style.left = (G.needle * 100) + '%';
  $('#gamepanel').innerHTML = `<div>${t('Strikes left')}<b>${G.tries}</b></div><div>${t('Best')}<b>${Math.round(G.best * 100)}%</b></div><div>${t('Record')}<b>${SCORES.striker}%</b></div>`;
}
function strike2() { const G = GAME_STRIKER; if (G.phase !== 'aim') return; G.power = clamp(1 - Math.abs(G.needle - 0.5) * 2, 0, 1); G.power = Math.pow(G.power, 0.8); G.best = Math.max(G.best, G.power);
  G.phase = 'fly'; G.t = 0; AU.tone({ f: 150, f2: 60, dur: 0.25, vol: 0.6 }); AU.noise({ dur: 0.15, vol: 0.5, type: 'lowpass', f: 800 }); AU.tone({ f: 300, f2: 300 + G.power * 900, dur: 0.7, vol: 0.06, type: 'triangle' }); S.shake = 0.3; }
function endGame(title, sub, onDone) {
  const g = S.game; S.game = 'ending'; onDone && onDone(); showCard(title, sub, 3500); AU.chime(); markDone(g.name);
  setTimeout(() => { fade(() => { $('#crosshair').classList.remove('game'); $('#meter').classList.add('hidden'); $('#gamepanel').classList.add('hidden'); g.cleanup && g.cleanup();
    S.mode = 'roam'; S.game = null; camera.fov = S.fov; camera.updateProjectionMatrix();
    if (g.exit) { player.pos.set(g.exit[0], 0, g.exit[1]); collide(player.pos); player.yaw = g.exit[2]; } else player.yaw = g === GAME_SHOOT ? -PI / 2 : PI / 2; player.pitch = 0; }); }, 2200);
}
// ---- Interactions: bonfire, cauldron, organ, stalls, pumpkins ----
function fireWish() { const cols = [[0x80ff60, 0x10a020], [0xc080ff, 0x5010ff], [0x80d0ff, 0x1050ff], [0xff80c0, 0xff1040]]; const [a, b] = pick(cols);
  FIRE.flames.forEach(f => { f.material.uniforms.uA.value.set(a); f.material.uniforms.uB.value.set(b); }); FIRE.L.color.set(b); FIRE.hue = new THREE.Color(a).multiplyScalar(1.2); FIRE.boost = 2.2;
  AU.whoosh(new V3(-40, 2, 32)); toast('The fire takes your wish', pick(['…and laughs.', '…it tastes of regret.', '…granted, with conditions.', '…the flames whisper your name.'])); }
function stirCauldron() { AU.gulp(); FIRE.brew.material.uniforms.uBoost.value = 4; setTimeout(() => FIRE.brew.material.uniforms.uBoost.value = 1, 1500); FW.burst(new V3(-33.5, 1.6, 37.5), 60, new THREE.Color(0.6, 3, 0.6), 2.5, 'soul'); S.wobble = 2.5; toast('Bubble, bubble…', 'You feel strangely… lighter.'); }
let organBusy = false;
function playOrgan() { if (organBusy) return; organBusy = true; setTimeout(() => organBusy = false, 7000);
  const seq = [[[81, 69], 0, 0.14], [[79, 67], 0.14, 0.14], [[81, 69], 0.28, 1.0], [[79, 67], 1.6, 0.11], [[77, 65], 1.71, 0.11], [[76, 64], 1.82, 0.11], [[74, 62], 1.93, 0.11], [[73, 61], 2.04, 0.5], [[74, 62], 2.54, 1.3],
    [[45, 33], 4.2, 2.6], [[61, 64, 67, 70], 4.4, 1.2], [[62, 65, 69, 74], 5.7, 2.2]];
  for (const [n, t, d] of seq) AU.organ(n, t, d); HOUSE.flicker = 2.5; }
function candyStall() { if (rand() < 0.5) { AU.chime(); toast('Treat!', pick(['A caramel apple that whispers sweet nothings.', 'Candy corn — the good kind. Allegedly.', 'A chocolate skull. Still warm.'])); }
  else { AU.cackle(null); S.flash = 0.6; S.flashCol.set(0.3, 0.0, 0.3); toast('Trick!', pick(['Your teeth feel loose.', 'The candy was a spider. It left.', 'Somewhere, a witch is laughing.']), 'blood'); } }
function potionStall() {
  const P = [['featherfall', 'Featherfall', 'Gravity loosens its grip on you.'], ['quicksilver', 'Quicksilver', 'Your feet barely touch the stones.'], ['spectral', 'Spectral Sight', 'You can see what was always there.']];
  const [id, name, sub] = pick(P); S.potion = id; S.potionT = 25; AU.gulp(); toast(t('Potion: {p}', { p: t(name) }), sub, 'soul');
}
const UNLIT = [];
function buildInteractiveBits() {
  addInteract({ x: 9.4, z: 66, r: 2.6, label: 'Trick or treat?', action: candyStall });
  addInteract({ x: -9.4, z: 66, r: 2.6, label: 'Drink a mysterious potion', action: potionStall });
  addInteract({ x: -9.4, z: 34, r: 2.6, label: 'Try on a mask', action: () => { toast('You put on a mask', pick(['It fits a little too well.', 'Now it won’t come off.', 'Your reflection keeps it on even after you remove it.'])); AU.cackle(null); } });
  const spots = [[4.5, 82], [-4.5, 72], [5.4, 58], [-5.4, 44], [5.4, 30], [-15, 2], [12, -20], [-3.2, -48], [32, 8.5], [-30, 26], [42, -34], [-46, -6]];
  spots.forEach(([x, z]) => {
    const m = new THREE.Mesh(PUMPKIN_GEO, new THREE.MeshStandardMaterial({ map: TX.face.map, emissiveMap: TX.face.emissiveMap, emissive: 0xff7a1a, emissiveIntensity: 0, roughness: 0.6 }));
    m.position.set(x, 0.42, z); m.scale.setScalar(0.55); m.rotation.y = yawTo(x, z, 0, 0) + PI; m.rotation.y = Math.atan2(-x, -z) + 0; m.castShadow = true; scene.add(m); addCircle(x, z, 0.5);
    const o = { m, lit: false, k: 0 }; UNLIT.push(o);
    addInteract({ x, z, r: 2.2, label: 'Light the jack-o’-lantern', enabled: () => !o.lit, action: () => { o.lit = true; S.lit++; AU.whoosh(m.position); FW.burst(m.position.clone().add(new V3(0, 0.6, 0)), 25, new THREE.Color(3, 1.3, 0.3), 2);
      toast(t('Lantern lit · {a} / {b}', { a: S.lit, b: spots.length }), S.lit === spots.length ? 'Every path in Hollowmoor glows. The dead approve.' : 'The darkness recedes a little.'); if (S.lit === spots.length) fireworksShow(10); } });
  });
  onUpdate((dt, t) => { for (const o of UNLIT) { o.k = damp(o.k, o.lit ? 1 : 0, 2, dt); o.m.material.emissiveIntensity = o.k * (3 + Math.sin(t * 9 + o.m.position.x) * 0.5); } });
}
// ---- Global events: Witching Hour ----
function startWitchingHour(finale) {
  if (S.witchT >= 0) return; markDone('witch'); S.witchT = 0; S.witchDur = finale ? 60 : 42; S.nextBolt = 2.5;
  TOWER.swing = 0.35; for (let i = 0; i < 13; i++) setTimeout(() => AU.bell(new V3(0, 26, 0), 98, 5, 0.9), i * 1500);
  toast('The Witching Hour', 'Thirteen tolls. The moon bleeds. Something stirs in Hollowmoor.', 'blood'); S.lightShow = 'blood';
}
function updateEvents(dt) {
  if (S.witchT >= 0) { S.witchT += dt; const target = S.witchT < S.witchDur - 5 ? 1 : 0; S.witch = damp(S.witch, target, 0.9, dt);
    S.nextBolt -= dt; if (S.nextBolt <= 0) { S.nextBolt = R(2.5, 6); strike(); }
    if (S.witchT > S.witchDur) { S.witchT = -1; S.lightShow = 'idle'; fireworksShow(14); toast('The Witching Hour has passed', 'For now.', ''); } }
  else S.witch = damp(S.witch, 0, 0.9, dt);
  S.flash = Math.max(0, S.flash - dt * 3.5); if (BOLT) { BOLT.material.opacity = Math.max(0, S.flash * 1.2) * (S.reduceFlash ? 0.3 : 1); BOLT.visible = S.flash > 0.02; }
  if (S.potion) { S.potionT -= dt; if (S.potionT <= 0) { toast('The potion wears off', ''); S.potion = null; } }
  S.speedMul = S.potion === 'quicksilver' ? 1.85 : 1; S.gravMul = S.potion === 'featherfall' ? 0.35 : 1;
  if (S.lightShowT > 0) { S.lightShowT -= dt; if (S.lightShowT <= 0 && S.lightShow === 'rainbow') S.lightShow = S.witchT >= 0 ? 'blood' : 'idle'; }
  // apply witch blend to the world
  const w = S.witch;
  skyMat.uniforms.uRed.value = w; FP.uRed.value = w * 0.42; skyMat.uniforms.uFlash.value = S.flash * (S.reduceFlash ? 0.2 : 1);
  skyMat.uniforms.uAurora.value = damp(skyMat.uniforms.uAurora.value, (S.aurora ?? 0.85) * (S.auroraShow ?? 1) * (1 - w * 0.8) + (S.auroraBoost || 0) * 1.6, 0.8, dt);
  if (LAKEFX.water) LAKEFX.water.material.uniforms.uAI.value = skyMat.uniforms.uAurora.value;
  scene.fog.color.lerpColors(FOG_BASE, FOG_RED, w); scene.background.copy(scene.fog.color);
  moon.color.lerpColors(MOON_COL, MOON_RED, w);
  hemi.intensity = (1.15 + S.flash * (S.reduceFlash ? 0.8 : 4)) * (1 - S.indoor * 0.6); hemi.color.lerpColors(HEMI_SKY, C_HEMI_RED, w);
  if (S.fwTint) { const ft = S.reduceFlash ? 0.25 : 1; hemi.color.r += S.fwTint.r * 3 * ft; hemi.color.g += S.fwTint.g * 3 * ft; hemi.color.b += S.fwTint.b * 3 * ft; skyMat.uniforms.uFw.value.copy(S.fwTint).multiplyScalar(ft); }
  MISTS.forEach(m => m.material.uniforms.uRed.value = w);
  TOWER.water.material.uniforms.uBoost.value = 1 + w * 2;
  const fl = S.flash * 0.3 * (S.reduceFlash ? 0.2 : 1); FP.uFlash.value.set(S.flashCol.x * fl * 2, S.flashCol.y * fl * 2, S.flashCol.z * fl * 2);
  LIGHTS.tower.color.lerpColors(C_TOWER, C_TOWER_RED, w); LIGHTS.tower.intensity = 480 * (1 + w * 0.8 + Math.sin(U_TIME.value * 3) * 0.08);
  M.pumpkinLit.emissiveIntensity = 2.3 + Math.sin(U_TIME.value * 8.1) * 0.3 + Math.sin(U_TIME.value * 13.7) * 0.2 + w;
}
// light show patterns across every bulb string
const _c = new THREE.Color();
function updateBulbs(t) {
  const mode = S.lightShow;
  for (const mesh of BULBS) { const base = mesh.userData.base, n = base.length, chase = mesh.userData.chase;
    for (let i = 0; i < n; i++) {
      if (mode === 'show' && S.showCols) { const bt = S.showBeat || 0, wave = Math.pow(Math.max(0, Math.cos((i * 0.12 - bt * 1.5) * PI)), 8), cc = S.showCols[(i >> 3) % 2];
        _c.copy(cc).multiplyScalar(1.1 + 2.6 * wave + 1.4 * (S.showKick || 0)); }
      else if (mode === 'blood') { const k = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(t * 6 - i * 0.35), 3); _c.setRGB(3.4 * k, 0.18 * k, 0.1 * k); }
      else if (mode === 'rainbow') { _c.setHSL((i * 0.03 + t * 0.4) % 1, 1, 0.5).multiplyScalar(3.6); }
      else { const k = chase ? 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 3 - i * 0.25), 4) : 0.8 + 0.2 * Math.sin(t * 2.3 + i * 1.7); _c.copy(base[i]).multiplyScalar(k); }
      mesh.setColorAt(i, _c); }
    mesh.instanceColor.needsUpdate = true; }
}

export { S, SCORES, saveScores, player, keys, collide, updatePlayer, _qa, _e, _v, _qr, _tv, _prevSeat, boardRide, exitRide, updateRideCam, GAME_SHOOT, GAME_STRIKER, startGallery, updateGallery, ray, shootGallery, startStriker, updateStriker, strike2, endGame, fireWish, stirCauldron, organBusy, playOrgan, candyStall, potionStall, UNLIT, buildInteractiveBits, startWitchingHour, updateEvents, _c, updateBulbs };
