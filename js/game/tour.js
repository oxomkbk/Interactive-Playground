import * as THREE from 'three';
import { $, V3, clamp, damp, lerp } from '../core/utils.js';
import { bokeh, camera, canvas } from '../core/renderer.js';
import { _up } from '../core/registry.js';
import { t, onLang } from '../core/i18n.js';
import { S, _e, collide, player } from './play.js';
import { fade, hideMenu, toast } from '../ui/ui.js';

/* =========================================================================
   CINEMATIC TOUR — one continuous take through every district, fully under the viewer's control:
   play / pause, scrub the timeline, jump chapter to chapter, 0.25×–4× speed, five camera rigs
   (Cinematic, Drone, Orbit, Street, Glide), drag-to-look free camera, captions & letterbox toggles,
   and "Walk from here" to drop into the park at any instant. T re-enters at the nearest point of the path.
   Keyframes: [position, look-at, speed m/s, lens fov, caption, sub]. Path = centripetal Catmull-Rom traversed by arc length.
   ========================================================================= */
const TOUR = [
  [[0, 34, 132], [0, 10, 20], 11, 50, 'Hollowmoor', 'A Halloween Night Carnival'],
  [[14, 16, 110], [2, 7, 70], 9, 52],
  [[3, 5.5, 92], [0, 7, 60], 6, 55, 'The Gate', 'Abandon all sense, ye who enter'],
  [[0.8, 3.0, 77.5], [0, 3.6, 50], 4.5, 60],
  [[-1.4, 2.6, 60], [1, 4, 30], 4.2, 58, 'Lantern Row', 'Stalls, games and things that bite'],
  [[1.4, 2.8, 41], [0, 8, 10], 4.2, 56],
  [[6, 4.2, 27.5], [0, 14, 0], 5, 54],
  [[-13, 7, 22], [0, 16, 0], 6, 52, 'Clock of Souls', 'The Pumpkin King keeps the time'],
  [[-19, 22, -15], [0, 30, 0], 7, 48],
  [[2, 31, -25], [0, 34, 0], 7, 46],
  [[22, 26, -9], [6, 20, 6], 7, 48],
  [[21, 9, 27], [32, 4, 18], 6, 52],
  [[27, 3.2, 32], [32, 3, 18], 4, 56, 'Carousel Macabre', 'Round and round, forever'],
  [[42, 3.4, 27], [32, 3.5, 18], 4, 56],
  [[45, 4.5, 10], [36, 6, -12], 5, 54, 'Wraith Wind', 'The swings that never touch the ground'],
  [[52, 7, -2], [62, 16, 6], 5, 52, 'The Gallows Drop', 'Thirty-four metres straight down'],
  [[54, 22, 11], [62, 30, 6], 5.5, 50],
  [[58, 15, 27], [64, 1, 40], 6, 52, 'Coffin Cars', 'Bumper coffins. Bring a spare soul.'],
  [[72, 12, 56], [96, 4, 50], 8, 50],
  // ---- east: the Pumpkin Fields & the King ----
  [[88, 9, 64], [120, 14, 50], 8, 50, 'Pumpkin Fields', 'Home of the Pumpkin King'],
  [[100, 16, 70], [120, 19, 50], 7, 46],
  [[106, 24, 52], [120, 20, 50], 5, 42, 'The Pumpkin King', 'Twenty-three metres of carved fury'],
  [[104, 30, 32], [120, 14, 50], 7, 48],
  [[118, 34, 8], [116, 2, -40], 11, 50],
  // ---- the Lake of Lost Souls ----
  [[100, 14, -10], [112, 2, -50], 9, 50, 'Lake of Lost Souls', 'Where the lanterns go to drift'],
  [[96, 5, -34], [110, 2, -60], 6, 54],
  [[108, 4, -58], [124, 16, -70], 6, 52, 'The Lighthouse', 'It sweeps the park for wandering souls'],
  [[132, 10, -48], [124, 18, -70], 7, 50],
  [[110, 13, -92], [100, 4, -62], 9, 50],
  [[78, 17, -64], [48, 2, -56], 11, 50],
  [[58, 14, -40], [48, 0, -58], 7, 52, 'Boneyard Maze', 'Many enter. Some find the centre.'],
  [[34, 10, -38], [10, 6, -60], 7, 52],
  [[9, 6, -43], [0, 5, -62], 5, 54],
  [[2, 3.4, -50], [0, 4.5, -62], 3, 56, 'Hollowmoor Manor', 'Guests check in. The door decides the rest.'],
  [[0, 5.2, -53], [0, 9, -62], 2.5, 56],
  [[0, 15, -56], [0, 16, -80], 4, 54],
  // ---- north: the Cathedral of Echoes ----
  [[14, 22, -92], [0, 26, -140], 7, 48],
  [[4, 9, -112], [0, 16, -142], 6, 50, 'Cathedral of Echoes', 'The organ still plays at midnight'],
  [[0, 5, -124], [0, 14, -142], 4, 54],
  [[-1, 5.5, -140], [0, 8, -168], 3.5, 60, 'The Nave', 'Every window burns when the organ wakes'],
  [[-2, 8, -158], [0, 12, -172], 3, 58],
  [[-6, 30, -150], [-13, 42, -144], 5, 50],
  [[-30, 34, -128], [0, 40, -144], 8, 46],
  // ---- the Witchwood ----
  [[-62, 16, -108], [-104, 4, -136], 8, 50, 'Witchwood', 'Stay on the path'],
  [[-90, 7, -122], [-116, 4, -146], 6, 52],
  [[-104, 4.5, -136], [-116, 5, -146], 4, 54, "The Witch's Cottage", 'Brews, broomsticks and bad ideas'],
  [[-122, 10, -128], [-112, 2, -142], 5, 52],
  [[-100, 24, -90], [-60, 10, -40], 11, 50],
  [[-52, 14, -50], [-26, 2, -42], 8, 52],
  [[-31, 5, -33], [-26, 1.5, -42], 4.5, 56, 'Grave Danger', 'Whack the dead back down'],
  [[-22, 7, -17], [-40, 14, -16], 6, 52],
  [[-30, 12, -2], [-40, 16, -16], 6, 50, 'The Eye', 'A wheel that watches back'],
  [[-46, 18, 15], [-58, 14, -6], 7, 50, 'Nightmare Express', 'Keep your arms and soul inside the car'],
  // ---- west: the Circus of Horrors ----
  [[-72, 14, 30], [-118, 14, 22], 8, 50, 'Circus of Horrors', 'The Phantom Circus performs nightly'],
  [[-92, 4, 23], [-118, 6, 22], 5, 54],
  [[-108, 3.2, 22], [-118, 4, 22], 3.5, 62, 'The Big Top', 'Ladies, gentlemen and restless spirits…'],
  [[-122, 6, 14], [-118, 12, 22], 3, 58],
  [[-112, 12, 40], [-98, 2, 56], 5, 52, 'Cauldron Cups', 'Spin until the stars spin with you'],
  [[-80, 10, 50], [-40, 2, 32], 8, 52],
  [[-30, 4, 42], [-40, 1.5, 32], 4, 56, 'Ember Circle', 'Warm your bones by the bonfire'],
  [[-12, 4.5, 58.5], [-30, 1.2, 60], 4.5, 56, 'Pumpkin Chuck', 'Lob a gourd into the cauldron'],
  [[-9.5, 9.5, 61], [0, 9, 20], 6, 54],
  [[6, 16, 70], [0, 10, 10], 8, 52],
  [[-20, 28, 104], [0, 10, 30], 10, 50, 'Hollowmoor', 'Stay a while. Stay forever.'],
];
const CAMS = [
  { id: 'cinematic', name: 'Cinematic', key: '1' },
  { id: 'drone', name: 'Drone', key: '2' },
  { id: 'orbit', name: 'Orbit', key: '3' },
  { id: 'street', name: 'Street', key: '4' },
  { id: 'glide', name: 'Glide', key: '5' },
];
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];
const TS = { playing: true, speed: 1, cam: 'cinematic', captions: true, letterbox: true, look: { yaw: 0, pitch: 0, drag: false, hold: false }, orbitA: 0, chapters: [] };
let tourPos, tourLook, tourLen = 1, tourU = 0, tourCap = -1, tourRoll = 0, tourFov = 52, tourPrevYaw = null, tourSnap = true, titleSnap = true;
const _tl = new V3(), _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _tz = new THREE.Quaternion(), _tt = new V3(), _zAxis = new V3(0, 0, 1);
const _p = new V3(), _goal = new V3(), _look = new V3(), _off = new THREE.Quaternion(), _eo = new THREE.Euler(0, 0, 0, 'YXZ');
function initTourCurves() {
  if (tourPos) return;
  tourPos = new THREE.CatmullRomCurve3(TOUR.map(k => new V3(...k[0])), true, 'centripetal'); tourLook = new THREE.CatmullRomCurve3(TOUR.map(k => new V3(...k[1])), true, 'centripetal');
  tourPos.arcLengthDivisions = 8000; tourLen = tourPos.getLength();
  // chapter = captioned keyframe; its arc-length position u on the loop
  const L = tourPos.getLengths(), n = TOUR.length;
  TS.chapters = TOUR.map((k, i) => ({ i, u: L[Math.round(i / n * (L.length - 1))] / tourLen, name: k[4], sub: k[5] })).filter(c => c.name);
}
function tourKey(tt) { const n = TOUR.length, f = tt * n, i = Math.floor(f) % n, j = (i + 1) % n, k = f - Math.floor(f); return { i, j, s: k * k * (3 - 2 * k) }; }
// samples the path at the current u and returns the "cinematic" pose; other rigs derive from it
function sample(u) { const tt = tourPos.getUtoTmapping(u), k = tourKey(tt); tourPos.getPoint(tt, _p); tourLook.getPoint(tt, _tl); tourPos.getTangentAt(u, _tt); return k; }
function tourStep(dt, speedMul = 1, snap = false, advance = true) {
  initTourCurves();
  if (advance) { const k0 = tourKey(tourPos.getUtoTmapping(tourU)), spd = lerp(TOUR[k0.i][2], TOUR[k0.j][2], k0.s) * speedMul; tourU = ((tourU + spd * dt / tourLen) % 1 + 1) % 1; }
  const k = sample(tourU), cam = S.mode === 'tour' ? TS.cam : 'cinematic';
  const yaw = Math.atan2(_tt.x, _tt.z);
  if (tourPrevYaw !== null && dt > 0) { let dy = yaw - tourPrevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); tourRoll = damp(tourRoll, clamp(dy / dt * 0.1 * Math.sign(speedMul || 1), -0.1, 0.1), 1.2, dt); }
  tourPrevYaw = yaw;
  let roll = tourRoll, fov = lerp(TOUR[k.i][3], TOUR[k.j][3], k.s);
  _goal.copy(_p); _look.copy(_tl);
  if (cam === 'drone') { _goal.set(_p.x - _tt.x * 18, Math.max(_p.y, 8) + 26, _p.z - _tt.z * 18); _look.set(_tl.x, _tl.y * 0.4, _tl.z); fov = 50; roll *= 0.4; }
  else if (cam === 'orbit') { TS.orbitA += dt * 0.22; const r = 20 + _tl.y * 0.4; _goal.set(_tl.x + Math.cos(TS.orbitA) * r, Math.max(_tl.y, 3) + 9, _tl.z + Math.sin(TS.orbitA) * r); fov = 48; roll = 0; }
  else if (cam === 'street') { _goal.set(_p.x, 1.65, _p.z); _look.set(_tl.x, Math.max(_tl.y, 1.8), _tl.z); fov = Math.max(fov, 58); roll *= 0.3; }
  else if (cam === 'glide') { _look.copy(_p).addScaledVector(_tt, 12); _look.y -= 1.2; roll *= 2.2; fov = 64; }
  if (snap) camera.position.copy(_goal); else camera.position.lerp(_goal, 1 - Math.exp(-(cam === 'cinematic' ? 60 : 3.2) * dt));
  _tm.lookAt(camera.position, _look, _up); _tq.setFromRotationMatrix(_tm).multiply(_tz.setFromAxisAngle(_zAxis, roll));
  // free look: drag offsets the view; it eases back to the rig unless "hold" is on
  const L = TS.look; if (!L.drag && !L.hold) { L.yaw = damp(L.yaw, 0, 1.4, dt); L.pitch = damp(L.pitch, 0, 1.4, dt); }
  if (S.mode === 'tour' && (L.yaw || L.pitch)) _tq.multiply(_off.setFromEuler(_eo.set(L.pitch, L.yaw, 0)));
  if (snap) camera.quaternion.copy(_tq); else camera.quaternion.slerp(_tq, 1 - Math.exp(-(L.drag ? 14 : 2.6) * dt));
  tourFov = snap ? fov : damp(tourFov, fov, 1.2, dt);
  if (Math.abs(camera.fov - tourFov) > 0.01) { camera.fov = tourFov; camera.updateProjectionMatrix(); }
  bokeh.uniforms.focus.value = damp(bokeh.uniforms.focus.value, camera.position.distanceTo(_look), 2, dt); bokeh.uniforms.aperture.value = 0.00007; bokeh.uniforms.maxblur.value = (S.fwEnergy || 0) > 0.05 ? 0 : 0.0018;
  return k;
}
// ---------- entering / leaving ----------
function nearestU(pos) { initTourCurves(); let best = 0, bd = 1e9; for (let i = 0; i < 600; i++) { const u = i / 600; tourPos.getPointAt(u, _p); const d = (_p.x - pos.x) ** 2 + (_p.z - pos.z) ** 2 + ((_p.y - pos.y) * 0.3) ** 2; if (d < bd) { bd = d; best = u; } } return best; }
function startTour(opts = {}) {
  if (document.pointerLockElement) document.exitPointerLock();
  initTourCurves();
  fade(() => {
    if (opts.u !== undefined) tourU = opts.u; else if (opts.fromHere && S.mode !== 'title') tourU = nearestU(camera.position); else if (opts.restart) tourU = 0;
    if (S.mode === 'ride') S.ride = null;
    S.mode = 'tour'; tourCap = -1; tourSnap = true; TS.playing = true; TS.look.yaw = TS.look.pitch = 0;
    hideMenu(); $('#title').classList.add('hidden'); $('#hud').classList.add('hidden'); $('#letterbox').classList.toggle('on', TS.letterbox);
    $('#tourbar').classList.remove('hidden'); $('#tourbar').classList.add('wake'); syncBar();
  });
}
function exitTour(walk = true) {
  if (S.mode !== 'tour') return;
  $('#letterbox').classList.remove('on'); $('#caption').classList.remove('show'); $('#tourbar').classList.add('hidden'); camera.fov = S.fov; camera.updateProjectionMatrix();
  const p = camera.position; player.pos.set(p.x, 0, p.z); collide(player.pos); _e.setFromQuaternion(camera.quaternion, 'YXZ'); player.yaw = _e.y; player.pitch = clamp(_e.x, -0.6, 0.6);
  S.mode = 'roam'; $('#hud').classList.remove('hidden');
  if (walk) { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); toast('You step out of the tour', 'Press T to rejoin it from wherever you stand'); }
}
function updateTour(dt) {
  const k = tourStep(dt, TS.playing ? TS.speed : 0, tourSnap); tourSnap = false;
  if (k.i !== tourCap) { tourCap = k.i; const kf = TOUR[k.i]; if (kf[4] && TS.captions && TS.playing) showCaption(kf[4], kf[5]); }
  syncBar(true);
}
let capTimer;
function showCaption(a, b) { const c = $('#caption'); c.classList.remove('show'); clearTimeout(capTimer);
  capTimer = setTimeout(() => { c.querySelector('.c1').textContent = t(a); c.querySelector('.c2').textContent = t(b); c.classList.add('show'); capTimer = setTimeout(() => c.classList.remove('show'), 4800); }, 450); }
function titleStep(dt) { tourStep(dt, 0.55, titleSnap); titleSnap = false; }
// ---------- controls ----------
function seek(u) { tourU = ((u % 1) + 1) % 1; tourCap = -1; tourPrevYaw = null; tourSnap = TS.cam === 'cinematic'; syncBar(); }
function chapterIndex() { let idx = 0; TS.chapters.forEach((c, i) => { if (c.u <= tourU + 1e-4) idx = i; }); return idx; }
function jumpChapter(d) { const n = TS.chapters.length; let i = chapterIndex() + d;
  if (d < 0 && tourU - TS.chapters[chapterIndex()].u > 0.006) i = chapterIndex(); // first press rewinds to the chapter start
  const c = TS.chapters[(i % n + n) % n]; seek(c.u + 0.0005); if (TS.captions) showCaption(c.name, c.sub); }
function setSpeed(s) { TS.speed = s; syncBar(); }
function stepSpeed(d) { const i = SPEEDS.indexOf(TS.speed); setSpeed(SPEEDS[clamp((i < 0 ? 2 : i) + d, 0, SPEEDS.length - 1)]); }
function setCam(id) { TS.cam = id; syncBar(); toast(t('Camera: {c}', { c: t(CAMS.find(c => c.id === id).name) })); }
function togglePlay() { TS.playing = !TS.playing; syncBar(); }
function tourKey2(e) { // keyboard while touring; returns true if handled
  const c = e.code; $('#tourbar').classList.add('wake'); wakeT = 3;
  if (c === 'Space') togglePlay(); else if (c === 'ArrowRight') seek(tourU + (e.shiftKey ? 0.05 : 0.01)); else if (c === 'ArrowLeft') seek(tourU - (e.shiftKey ? 0.05 : 0.01));
  else if (c === 'ArrowUp') stepSpeed(1); else if (c === 'ArrowDown') stepSpeed(-1); else if (c === 'PageDown' || c === 'Period') jumpChapter(1); else if (c === 'PageUp' || c === 'Comma') jumpChapter(-1);
  else if (/^Digit[1-5]$/.test(c)) setCam(CAMS[+c.slice(5) - 1].id); else if (c === 'KeyV') setCam(CAMS[(CAMS.findIndex(x => x.id === TS.cam) + 1) % CAMS.length].id);
  else if (c === 'KeyC') { TS.captions = !TS.captions; if (!TS.captions) $('#caption').classList.remove('show'); syncBar(); }
  else if (c === 'KeyL') { TS.letterbox = !TS.letterbox; $('#letterbox').classList.toggle('on', TS.letterbox); syncBar(); }
  else if (c === 'KeyH') { TS.look.hold = !TS.look.hold; syncBar(); toast(TS.look.hold ? 'Free look held' : 'Free look eases back to the rig'); }
  else if (c === 'KeyR') { TS.look.yaw = TS.look.pitch = 0; }
  else if (c === 'Escape' || c === 'KeyT' || c === 'Enter') exitTour(true);
  else return false;
  return true;
}
// ---------- the tour bar (built once) ----------
let wakeT = 3;
function fmtU(u) { const s = Math.round(u * tourLen / 7); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function buildTourBar() {
  const bar = document.createElement('div'); bar.id = 'tourbar'; bar.className = 'hidden';
  bar.innerHTML = `
    <div class="tb-chapter"><span class="tb-cn"></span><span class="tb-cs"></span></div>
    <div class="tb-track"><div class="tb-fill"></div><div class="tb-ticks"></div><div class="tb-head"></div><div class="tb-tip"></div></div>
    <div class="tb-row">
      <div class="tb-group">
        <button class="tb-btn" data-tb="prev" data-i18n-title="Previous chapter (,)">⏮</button>
        <button class="tb-btn tb-play" data-tb="play" data-i18n-title="Play / pause (Space)">❚❚</button>
        <button class="tb-btn" data-tb="next" data-i18n-title="Next chapter (.)">⏭</button>
        <span class="tb-time"></span>
      </div>
      <div class="tb-group tb-speeds">${SPEEDS.map(s => `<button class="tb-chip" data-speed="${s}">${s}×</button>`).join('')}</div>
      <div class="tb-group tb-cams">${CAMS.map(c => `<button class="tb-chip" data-cam="${c.id}"><kbd>${c.key}</kbd><span data-i18n="${c.name}">${c.name}</span></button>`).join('')}</div>
      <div class="tb-group">
        <button class="tb-chip" data-tb="cap"><span data-i18n="Captions">Captions</span></button>
        <button class="tb-chip" data-tb="lb"><span data-i18n="Letterbox">Letterbox</span></button>
        <button class="tb-chip" data-tb="hold"><span data-i18n="Hold look">Hold look</span></button>
        <button class="tb-btn tb-exit" data-tb="exit"><span data-i18n="Walk from here">Walk from here</span> ⏏</button>
      </div>
    </div>
    <div class="tb-help" data-i18n="Drag to look around · Space pause · ←/→ scrub · ↑/↓ speed · 1–5 camera · ,/. chapters · Esc walk from here">Drag to look around · Space pause · ←/→ scrub · ↑/↓ speed · 1–5 camera · ,/. chapters · Esc walk from here</div>`;
  document.body.appendChild(bar);
  const track = bar.querySelector('.tb-track'), tip = bar.querySelector('.tb-tip');
  const uAt = e => { const r = track.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 0.9999); };
  let scrub = false, wasPlaying = true;
  track.addEventListener('pointerdown', e => { scrub = true; wasPlaying = TS.playing; TS.playing = false; track.setPointerCapture(e.pointerId); seek(uAt(e)); });
  track.addEventListener('pointermove', e => { const u = uAt(e); tip.style.left = (u * 100) + '%'; let near = TS.chapters[0];
    for (const c of TS.chapters) if (c.u <= u) near = c; tip.textContent = t(near.name) + ' · ' + fmtU(u); if (scrub) seek(u); });
  const end = () => { if (scrub) { scrub = false; TS.playing = wasPlaying; syncBar(); } };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    if (b.dataset.speed) setSpeed(+b.dataset.speed); if (b.dataset.cam) setCam(b.dataset.cam);
    const a = b.dataset.tb; if (a === 'play') togglePlay(); if (a === 'prev') jumpChapter(-1); if (a === 'next') jumpChapter(1);
    if (a === 'cap') tourKey2({ code: 'KeyC' }); if (a === 'lb') tourKey2({ code: 'KeyL' }); if (a === 'hold') tourKey2({ code: 'KeyH' }); if (a === 'exit') exitTour(true); });
  bar.addEventListener('pointermove', () => { wakeT = 3; bar.classList.add('wake'); });
  // drag anywhere on the canvas to look around while the tour keeps moving
  let lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => { if (S.mode !== 'tour') return; TS.look.drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (S.mode === 'tour') { wakeT = 3; bar.classList.add('wake'); } if (S.mode !== 'tour' || !TS.look.drag) return;
    TS.look.yaw = clamp(TS.look.yaw - (e.clientX - lx) * 0.004, -Math.PI, Math.PI); TS.look.pitch = clamp(TS.look.pitch - (e.clientY - ly) * 0.004, -1.2, 1.2); lx = e.clientX; ly = e.clientY; });
  const up = () => { TS.look.drag = false; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', () => { if (S.mode === 'tour') { TS.look.yaw = TS.look.pitch = 0; } });
  onLang(() => { buildTicks(); syncBar(); });
}
function buildTicks() { initTourCurves(); const tk = $('#tourbar .tb-ticks'); if (!tk) return;
  tk.innerHTML = TS.chapters.map((c, i) => `<i style="left:${c.u * 100}%" title="${t(c.name)}" data-ch="${i}"></i>`).join(''); }
let lastSync = 0;
function syncBar(throttle) {
  const bar = $('#tourbar'); if (!bar) return; const now = performance.now(); if (throttle && now - lastSync < 60) return; lastSync = now;
  if (!bar.querySelector('.tb-ticks i')) buildTicks();
  bar.querySelector('.tb-fill').style.width = (tourU * 100) + '%'; bar.querySelector('.tb-head').style.left = (tourU * 100) + '%';
  const ch = TS.chapters[chapterIndex()]; if (ch) { bar.querySelector('.tb-cn').textContent = t(ch.name); bar.querySelector('.tb-cs').textContent = t(ch.sub || ''); }
  bar.querySelector('.tb-time').textContent = fmtU(tourU) + ' / ' + fmtU(0.99999);
  bar.querySelector('.tb-play').textContent = TS.playing ? '❚❚' : '▶';
  bar.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === TS.speed));
  bar.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === TS.cam));
  bar.querySelector('[data-tb="cap"]').classList.toggle('on', TS.captions); bar.querySelector('[data-tb="lb"]').classList.toggle('on', TS.letterbox); bar.querySelector('[data-tb="hold"]').classList.toggle('on', TS.look.hold);
  if (throttle) { wakeT -= 0.06; if (wakeT <= 0 && TS.playing && !TS.look.drag) bar.classList.remove('wake'); }
  bar.classList.toggle('paused', !TS.playing);
}
const tourProgress = () => tourU;

export { TOUR, CAMS, SPEEDS, TS, initTourCurves, tourKey, tourStep, startTour, updateTour, exitTour, titleStep, seek, jumpChapter, setSpeed, setCam, togglePlay, tourKey2, buildTourBar, nearestU, tourProgress, syncBar };
