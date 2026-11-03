import * as THREE from 'three';
import { $, V3, yawTo } from '../core/utils.js';
import { FP, QNAME, applyQuality, bokeh, camera, canvas, composer, renderer } from '../core/renderer.js';
import { INTERACTS } from '../core/registry.js';
import { AU } from '../core/audio.js';
import { S, _e, collide, exitRide, keys, player } from './play.js';
import { fade, showZone, toast } from '../ui/ui.js';
import { t } from '../core/i18n.js';

// ---- Photo mode ----
const FILTERS = ['Cinematic', 'Noir', 'Vintage', 'Spectral'];
function togglePhoto() {
  if (S.mode === 'photo') { // exit
    S.mode = S.photo.prev; S.timeScale = 1; camera.fov = S.fov; camera.updateProjectionMatrix(); $('#photoui').classList.add('hidden'); $('#hud').classList.remove('hidden');
    if (S.mode === 'tour') $('#letterbox').classList.add('on'); applyQuality(QNAME, true); return; }
  if (!['roam', 'ride', 'tour'].includes(S.mode)) return;
  S.photo.prev = S.mode; S.mode = 'photo'; _e.setFromQuaternion(camera.quaternion, 'YXZ'); S.photo.yaw = _e.y; S.photo.pitch = _e.x; S.photo.pos = camera.position.clone();
  $('#photoui').classList.remove('hidden'); $('#hud').classList.add('hidden'); $('#letterbox').classList.remove('on'); bokeh.enabled = true; updatePhotoUI();
  if (!document.pointerLockElement) canvas.requestPointerLock()?.catch?.(() => {});
}
function updatePhotoCam(dt) {
  const P = S.photo, k = keys, sp = (k.ShiftLeft ? 14 : 4) * dt; const f = new V3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)), r = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  if (S.locked) { if (k.KeyW) P.pos.addScaledVector(f, sp); if (k.KeyS) P.pos.addScaledVector(f, -sp); if (k.KeyD) P.pos.addScaledVector(r, sp); if (k.KeyA) P.pos.addScaledVector(r, -sp); if (k.KeyE) P.pos.y += sp; if (k.KeyQ) P.pos.y -= sp; }
  P.pos.y = Math.max(0.3, P.pos.y); camera.position.copy(P.pos); camera.rotation.set(P.pitch, P.yaw, 0);
  camera.fov = P.fov; camera.updateProjectionMatrix();
  bokeh.uniforms.focus.value = P.focus; bokeh.uniforms.aperture.value = P.aperture * 0.0012; bokeh.uniforms.maxblur.value = 0.012;
  S.timeScale = P.freeze ? 0 : 1; FP.uFilter.value = P.filter;
}
function updatePhotoUI() { const P = S.photo; $('#pf').textContent = P.focus.toFixed(1) + ' m'; $('#pa').textContent = P.aperture.toFixed(2); $('#pv').textContent = P.fov + '°'; $('#pg').textContent = t(FILTERS[P.filter]); $('#pt').textContent = t(P.freeze ? 'Frozen' : 'Flowing'); }
function capture() {
  composer.render(); const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = `hollowmoor-${Date.now()}.png`; a.click();
  S.flash = 1; S.flashCol.set(0.6, 0.6, 0.6); if (AU.ctx) AU.noise({ dur: 0.08, vol: 0.4, type: 'highpass', f: 2000 }); toast('Photo saved', 'Check your downloads folder');
}
// ---- Interaction prompt ----
let currentInteract = null;
function updateInteract() {
  const pr = $('#prompt');
  if (S.mode === 'ride') { currentInteract = 'exit'; pr.classList.remove('hidden'); pr.querySelector('span').textContent = t('Leave the ride'); return; }
  if (S.mode !== 'roam') { currentInteract = null; pr.classList.add('hidden'); $('#crosshair').classList.remove('live'); return; }
  let best = null, bs = 1e9; const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  for (const it of INTERACTS) { if (it.enabled && !it.enabled()) continue; const dx = it.x - player.pos.x, dz = it.z - player.pos.z, d = Math.hypot(dx, dz); if (d > it.r) continue;
    const dot = (dx * fx + dz * fz) / (d || 1); if (d > 1.3 && dot < 0.3) continue; const s = d - dot * 1.5; if (s < bs) { bs = s; best = it; } }
  if (best !== currentInteract) { currentInteract = best; if (best) { pr.classList.remove('hidden'); pr.style.animation = 'none'; void pr.offsetWidth; pr.style.animation = ''; } else pr.classList.add('hidden'); }
  if (best) pr.querySelector('span').textContent = t(typeof best.label === 'function' ? best.label() : best.label);
  $('#crosshair').classList.toggle('live', !!best);
}
function interact() {
  if (S.mode === 'ride') { exitRide(); return; }
  if (currentInteract && currentInteract !== 'exit') { currentInteract.action(); currentInteract = null; }
}
// ---- Zone quick-travel ----
function jumpTo(z) {
  fade(() => { if (S.mode === 'ride') S.ride = null; if (S.mode === 'tour') { $('#letterbox').classList.remove('on'); $('#hud').classList.remove('hidden'); }
    S.mode = 'roam'; player.pos.set(z.x, 0, z.z); player.vel.set(0, 0, 0); collide(player.pos); player.yaw = yawTo(z.x, z.z, z.tx, z.tz); player.pitch = -0.04; showZone(z, true); });
}

export { FILTERS, togglePhoto, updatePhotoCam, updatePhotoUI, capture, currentInteract, updateInteract, interact, jumpTo };
