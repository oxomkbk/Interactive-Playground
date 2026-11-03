import * as THREE from 'three';
import { $, PI, V3, clamp, damp, hdr } from '../core/utils.js';
import { camera, scene } from '../core/renderer.js';
import { Batcher } from '../core/registry.js';
import { M } from '../core/materials.js';
import { U_TIME, makePoints } from '../core/shaders.js';
import { fade, showCard, toast } from '../ui/ui.js';
import { S, SCORES, collide, keys, player, saveScores } from './play.js';
import { FW, fireworksShow } from '../world/atmosphere.js';
import { AU } from '../core/audio.js';
import { markDone } from '../world/attractions.js';
import { t } from '../core/i18n.js';
/* =========================================================================
   BROOM FLIGHT — free flight over the whole park on the witch's broom, plus the Ring Race:
   thread 16 glowing rings strung across every district against the clock.
   W / S thrust · mouse steer · Space climb · Ctrl dive · Shift boost · R restart race · E land
   ========================================================================= */
const GAME_FLIGHT = { name: 'flight' };
const RING_PATH = [[-116, 14, -132], [-80, 18, -150], [-30, 22, -160], [0, 30, -150], [30, 20, -120], [48, 12, -60], [86, 14, -60], [118, 22, -34], [124, 24, 10],
  [118, 16, 48], [80, 12, 60], [40, 10, 26], [0, 18, 6], [-40, 22, -16], [-70, 16, 10], [-100, 14, -40]];
const FL = { rings: [], vel: new V3(), q: new THREE.Quaternion(), yaw: 0, pitch: 0, roll: 0 };
function buildFlight() {
  const rg = new THREE.TorusGeometry(3.4, 0.22, 10, 48), lit = new THREE.MeshBasicMaterial({ color: hdr(0xb070ff, 2.6) });
  RING_PATH.forEach(([x, y, z], i) => { const n = RING_PATH[(i + 1) % RING_PATH.length], m = new THREE.Mesh(rg, lit.clone()); m.position.set(x, y, z); m.lookAt(n[0], n[1], n[2]); m.visible = false; scene.add(m); FL.rings.push(m); });
  const broom = new THREE.Group(); const b = new Batcher();
  b.add(new THREE.CylinderGeometry(0.025, 0.03, 1.6, 8), M.woodDark, 0, 0, -0.3, 0, { rx: PI / 2 });
  b.add(new THREE.ConeGeometry(0.16, 0.5, 14, 1, true), M.straw, 0, 0, 0.62, 0, { rx: -PI / 2 });
  b.add(new THREE.TorusGeometry(0.035, 0.012, 6, 12), M.iron, 0, 0, 0.36);
  b.build(broom); broom.position.set(0, -0.62, -0.2); broom.visible = false; camera.add(broom); FL.broom = broom;
  FL.trail = makePoints(160); FL.td = Array.from({ length: 160 }, () => ({ t: 0 })); FL.ti = 0;
}
function startFlight() {
  fade(() => {
    const p = camera.position; S.mode = 'game'; S.game = GAME_FLIGHT; FL.pos = new V3(p.x, Math.max(p.y + 2, 6), p.z); FL.vel.set(0, 0, 0); FL.yaw = player.yaw; FL.pitch = 0.1; FL.roll = 0;
    Object.assign(GAME_FLIGHT, { racing: false, next: 0, time: 0, exit: null }); FL.broom.visible = true; $('#gamepanel').classList.remove('hidden');
    FL.rings.forEach(r => r.visible = true); resetRace(); toast('Broom Flight', 'W thrust · mouse steer · Space climb · Shift boost · fly through the first ring to start the race · E to land', 'soul');
  });
}
function resetRace() { GAME_FLIGHT.racing = false; GAME_FLIGHT.next = 0; GAME_FLIGHT.time = 0; FL.rings.forEach((r, i) => { r.material.color.copy(hdr(i === 0 ? 0x60ffb0 : 0xb070ff, i === 0 ? 3.4 : 1.6)); r.scale.setScalar(1); }); }
GAME_FLIGHT.update = (dt) => {
  const G = GAME_FLIGHT, k = keys;
  FL.yaw = player.yaw; FL.pitch = clamp(player.pitch, -1.2, 1.2);
  const fwdV = new V3(-Math.sin(FL.yaw) * Math.cos(FL.pitch), Math.sin(FL.pitch), -Math.cos(FL.yaw) * Math.cos(FL.pitch));
  const boost = k.ShiftLeft || k.ShiftRight, thrust = (k.KeyW ? 1 : 0) - (k.KeyS ? 0.6 : 0);
  FL.vel.addScaledVector(fwdV, thrust * (boost ? 34 : 18) * dt);
  if (k.Space) FL.vel.y += 12 * dt; if (k.ControlLeft || k.KeyC) FL.vel.y -= 12 * dt;
  FL.vel.multiplyScalar(Math.exp(-0.9 * dt)); FL.vel.y -= 1.2 * dt;
  FL.pos.addScaledVector(FL.vel, dt); FL.pos.x = clamp(FL.pos.x, -220, 220); FL.pos.z = clamp(FL.pos.z, -260, 160); FL.pos.y = clamp(FL.pos.y, 2.2, 120);
  const spd = FL.vel.length(); S.rideSpeed = spd;
  const lat = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0); FL.roll = damp(FL.roll, clamp((G.lastYaw !== undefined ? (FL.yaw - G.lastYaw) / Math.max(dt, 1e-3) : 0) * 0.25 + lat * 0.3, -0.6, 0.6), 4, dt); G.lastYaw = FL.yaw;
  if (lat) FL.vel.addScaledVector(new V3(Math.cos(FL.yaw), 0, -Math.sin(FL.yaw)), -lat * 10 * dt);
  camera.position.copy(FL.pos).add(new V3(0, Math.sin(U_TIME.value * 2) * 0.05, 0)); camera.rotation.set(FL.pitch, FL.yaw, FL.roll);
  const fov = S.fov + clamp(spd - 10, 0, 30) * 0.6; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
  FL.broom.rotation.z = -FL.roll * 0.4; FL.broom.position.y = -0.62 + Math.sin(U_TIME.value * 3) * 0.02;
  // sparkle trail behind the broom
  const tr = FL.trail; FL.ti = (FL.ti + 1) % 160; const back = FL.pos.clone().addScaledVector(fwdV, -1.4).add(new V3(0, -0.7, 0)); FL.td[FL.ti].t = 1.2; tr.pos.set([back.x, back.y, back.z], FL.ti * 3);
  for (let i = 0; i < 160; i++) { const d = FL.td[i]; d.t = Math.max(0, d.t - dt); const a = d.t * (spd > 4 ? 1.6 : 0.4); tr.col.set([a * 0.9, a * 0.5, a * 1.8], i * 3); tr.size[i] = 0.12 + (1.2 - d.t) * 0.2; } tr.flag();
  // rings: pass through in order
  const r = FL.rings[G.next];
  if (r) { const local = r.worldToLocal(FL.pos.clone()); if (Math.abs(local.z) < 1.2 && Math.hypot(local.x, local.y) < 3.4) {
      if (!G.racing && G.next === 0) { G.racing = true; G.time = 0; toast('Ring Race!', 'Follow the glowing rings — 16 to go.'); }
      if (G.racing) { r.material.color.copy(hdr(0x404040, 0.5)); FW.burst(r.position, 40, new THREE.Color(1.6, 0.8, 3), 4, 'soul'); AU.candy(G.next + 1); G.next++;
        if (G.next >= FL.rings.length) { const tt = G.time; AU.chime(); fireworksShow(6); markDone('flight'); const best = SCORES.flight; if (!best || tt < best) { SCORES.flight = tt; saveScores(); }
          showCard(t('Ring Race complete!'), t('Time {a}{b}', { a: tt.toFixed(1) + 's', b: !best || tt < best ? t(' — a new record!') : t(' (record {r})', { r: best.toFixed(1) + 's' }) }), 5000); resetRace(); }
        else { const nr = FL.rings[G.next]; nr.material.color.copy(hdr(0x60ffb0, 3.4)); } } } }
  if (G.racing) G.time += dt;
  FL.rings.forEach((m, i) => { if (G.racing && i === G.next) m.scale.setScalar(1 + Math.sin(U_TIME.value * 5) * 0.06); });
  $('#gamepanel').innerHTML = G.racing ? `<div>${t('Ring')}<b>${G.next}/${FL.rings.length}</b></div><div>${t('Time')}<b>${G.time.toFixed(1)}</b></div><div>${t('Record')}<b>${SCORES.flight ? SCORES.flight.toFixed(1) : '—'}</b></div>`
    : `<div>${t('Speed')}<b>${spd.toFixed(0)}</b></div><div>${t('Altitude')}<b>${FL.pos.y.toFixed(0)}</b></div><div>${t('Race')}<b>${t('first ring')}</b></div>`;
};
GAME_FLIGHT.key = (c) => { if (c === 'KeyE') landBroom(); if (c === 'KeyR') { resetRace(); toast('Race reset', 'Fly back through the first ring.'); } };
function landBroom() { const G = GAME_FLIGHT; G.exit = [FL.pos.x, FL.pos.z, FL.yaw]; S.game = 'ending';
  fade(() => { GAME_FLIGHT.cleanup(); $('#gamepanel').classList.add('hidden'); S.mode = 'roam'; S.game = null; player.pos.set(G.exit[0], 0, G.exit[1]); collide(player.pos); player.yaw = G.exit[2]; player.pitch = 0; camera.fov = S.fov; camera.updateProjectionMatrix(); S.rideSpeed = 0; }); }
GAME_FLIGHT.cleanup = () => { FL.broom.visible = false; FL.rings.forEach(r => r.visible = false); for (let i = 0; i < 160; i++) FL.trail.size[i] = 0; FL.trail.flag(); };

export { GAME_FLIGHT, RING_PATH, FL, buildFlight, startFlight, resetRace, landBroom };
