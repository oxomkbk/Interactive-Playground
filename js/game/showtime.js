import * as THREE from 'three';
import { $, PI, R, V3, clamp, damp, lerp, pick } from '../core/utils.js';
import { FX_OBJECTS, bokeh, camera, lantern, scene } from '../core/renderer.js';
import { ghostMat } from '../core/shaders.js';
import { t } from '../core/i18n.js';
import { AU } from '../core/audio.js';
import { onUpdate } from '../core/registry.js';
import { BATS, FW, GHOSTS, GHOST_GEO } from '../world/atmosphere.js';
import { markDone } from '../world/attractions.js';
import { organShow } from '../world/cathedral.js';
import { lanternFestival } from '../world/lake.js';
import { awakenKing } from '../world/fields.js';
import { SET } from '../core/settings.js';
import { launch, play } from './pyro.js';
import { S, SCORES, _e, collide, player, saveScores, startWitchingHour } from './play.js';
import { fade, showCard, toast } from '../ui/ui.js';

/* =========================================================================
   SHOWTIME — the GRAND FINALE: a choreographed ~70 s spectacle that wakes every district at once
   (Cathedral organ, Lantern Festival, the Pumpkin King, the blood moon, four waves of finale shells and a
   white-out climax) watched from a slow crane camera that circles the whole park. Any key / click returns control.
   Also: GHOST HUNT — a 90-second park-wide challenge (extra ghosts, fast respawns, best score saved).
   ========================================================================= */
const SHOW = { t: -1, a: 0, cue: 0, prev: 'roam', watch: true };
const SPOTS = [[0, -20], [-30, -40], [30, -40], [0, -85], [-60, -70], [60, -80], [0, 40], [-45, 10], [45, 0], [-90, 20], [100, 40], [110, -50], [0, -150]];
const salvo = (n, big, dur, spots = SPOTS) => { for (let i = 0; i < n; i++) setTimeout(() => { const [x, z] = pick(spots); FW.launch(x + R(-8, 8), z + R(-8, 8), big); }, (i / n) * dur * 1000 + R(0, 300)); };
const CUES = [
  [0.0, () => { toast('The Grand Finale', 'Every light in Hollowmoor answers at once.', 'soul'); S.lightShow = 'rainbow'; S.lightShowT = 70; S.shipBoost = true; S.aurora = 1.6; AU.choir(camera.position.clone(), 8); }],
  [2.0, () => organShow()],
  [5.0, () => lanternFestival()],
  [9.0, () => { awakenKing(); play('salvo', { site: 'fields', size: 1.4 }); }],
  [13.0, () => play('pumpkins', { site: 'plaza' })],
  [17.0, () => play('fan', { site: 'plaza', size: 1.6 })],
  [21.0, () => play('willows', { site: 'plaza' })],
  [24.0, () => { BATS.burst(new V3(0, 30, 0), 80); AU.flutter(new V3(0, 20, 0)); play('ringfire', { site: 'plaza', size: 1.5 }); }],
  [28.0, () => play('crescendo', { site: 'lake' })],
  [32.0, () => startWitchingHour(true)],
  [36.0, () => play('crescendo', { site: 'all', size: 1.8 })],
  [44.0, () => { play('salvo', { site: 'cathedral', type: 'kamuro', size: 2 }); play('salvo', { site: 'circus', type: 'palm', size: 1.8 }); }],
  [48.0, () => play('fan', { site: 'plaza', type: 'crossette', size: 2 })],
  [52.0, () => play('barrage', { site: 'all' })],
  [62.5, () => { for (let i = 0; i < 9; i++) setTimeout(() => launch({ site: 'plaza', x: -48 + i * 12, z: -30, type: 'kamuro', size: 2.8, h: 100 }), i * 90); }],
  [65.5, () => { S.flash = S.reduceFlash ? 0.2 : 0.7; S.flashCol.set(1, 0.85, 0.7); S.shake = 0.8; AU.thump(camera.position.clone(), 1.2); AU.thump(new V3(0, 30, -30), 1.6); }],
  [67.0, () => { showCard('Hollowmoor', 'The night bows. The dead applaud. Come back tomorrow.', 5000); AU.applause(camera.position.clone(), 5); markDone('finale'); }],
  [73.0, () => { S.shipBoost = false; S.aurora = SET.aurora; endFinale(true); }],
];
function startFinale(watch = true) {
  if (SHOW.t >= 0) return; if (document.pointerLockElement) document.exitPointerLock();
  SHOW.watch = watch; SHOW.cue = 0; SHOW.t = 0; SHOW.prev = S.mode === 'tour' || S.mode === 'title' ? 'roam' : S.mode;
  if (watch) fade(() => { if (S.mode === 'ride') S.ride = null; S.mode = 'show'; SHOW.a = Math.atan2(camera.position.z + 30, camera.position.x); $('#hud').classList.add('hidden'); $('#tourbar')?.classList.add('hidden');
    $('#letterbox').classList.add('on'); $('#showbar').classList.remove('hidden'); });
}
function endFinale(natural) {
  if (S.mode === 'show') { fade(() => { const p = camera.position; player.pos.set(clamp(p.x, -140, 140), 0, clamp(p.z, -185, 95)); collide(player.pos); _e.setFromQuaternion(camera.quaternion, 'YXZ'); player.yaw = _e.y; player.pitch = 0;
    S.mode = 'roam'; camera.fov = S.fov; camera.updateProjectionMatrix(); $('#hud').classList.remove('hidden'); $('#letterbox').classList.remove('on'); $('#showbar').classList.add('hidden'); }); }
  if (natural) SHOW.t = -1;
}
// leaving the crane camera does NOT stop the show — it keeps playing around you
function leaveShowCam() { if (S.mode === 'show') endFinale(false); }
const _c = new V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new V3(0, 1, 0);
function updateShowCam(dt) {
  SHOW.a += dt * 0.07; const k = clamp(SHOW.t / 73, 0, 1), r = lerp(150, 115, k), h = lerp(42, 62, Math.sin(k * PI));
  _c.set(Math.cos(SHOW.a) * r, h, -30 + Math.sin(SHOW.a) * r); camera.position.lerp(_c, 1 - Math.exp(-1.5 * dt));
  _m.lookAt(camera.position, new V3(0, 22 + Math.sin(SHOW.t * 0.2) * 6, -30), _up); _q.setFromRotationMatrix(_m); camera.quaternion.slerp(_q, 1 - Math.exp(-2 * dt));
  if (Math.abs(camera.fov - 54) > 0.05) { camera.fov = damp(camera.fov, 54, 2, dt); camera.updateProjectionMatrix(); }
  bokeh.uniforms.focus.value = 140; bokeh.uniforms.maxblur.value = 0; $('#showbar .sb-fill').style.width = (k * 100) + '%';
}


// ---------- Ghost Hunt ----------
const HUNT = { on: false, t: 0, n: 0, added: false };
function startHunt() {
  if (HUNT.on) return;
  if (!HUNT.added) { HUNT.added = true; // eight extra wanderers haunting the avenues
    [[0, 70, 8, 4, 0.25], [-70, 22, 14, 6, -0.2], [70, 30, 12, 5, 0.2], [0, -110, 14, 7, 0.18], [-90, -110, 16, 6, -0.15], [112, -50, 18, 6, 0.12], [110, 46, 14, 7, -0.2], [-110, 22, 12, 9, 0.22]]
      .forEach(([cx, cz, r, h, sp], i) => { const m = new THREE.Mesh(GHOST_GEO, ghostMat(i % 2 ? 0xc0a0ff : 0xb0ffe0, 20 + i)); m.scale.setScalar(R(1, 1.5)); scene.add(m); FX_OBJECTS.push(m); GHOSTS.push({ m, cx, cz, r, h, sp, ph: R(0, 6) }); }); }
  for (const g of GHOSTS) if (g.gone > 0) g.gone = 0.01;
  Object.assign(HUNT, { on: true, t: 90, n: 0 }); S.hunt = HUNT; S.lantern = true; lantern.intensity = 60; $('#gamepanel').classList.remove('hidden');
  toast('Ghost Hunt!', 'Lantern up (F). Banish as many ghosts as you can in 90 seconds.', 'soul'); AU.cackle(null);
}
function initShowtime() {
onUpdate((dt) => { if (SHOW.t < 0) return; SHOW.t += dt; while (SHOW.cue < CUES.length && SHOW.t >= CUES[SHOW.cue][0]) CUES[SHOW.cue++][1](); });
onUpdate((dt) => {
  if (!HUNT.on) return; if (!S.menu && S.mode === 'roam') HUNT.t -= dt;
  if (S.mode === 'roam') $('#gamepanel').innerHTML = `<div>${t('Banished')}<b>${HUNT.n}</b></div><div>${t('Time')}<b>${Math.max(0, HUNT.t).toFixed(0)}</b></div><div>${t('Best')}<b>${SCORES.hunt || 0}</b></div>`;
  if (HUNT.t <= 0) { HUNT.on = false; S.hunt = null; $('#gamepanel').classList.add('hidden'); const rec = HUNT.n > (SCORES.hunt || 0); if (rec) { SCORES.hunt = HUNT.n; saveScores(); }
    if (HUNT.n >= 5) markDone('hunt'); showCard(t('Ghost Hunt · {n} banished', { n: HUNT.n }), rec ? t('A new record! The spirits fear your lantern.') : t('The dead are still restless. Try again.'), 4500); AU.chime(); }
});
}

export { initShowtime, SHOW, startFinale, endFinale, leaveShowCam, updateShowCam, HUNT, startHunt };
