import * as THREE from 'three';
import { $, TAU, clamp } from '../core/utils.js';
import { cnv } from '../core/textures.js';
import { camera, canvas, lantern, perf, setQualityButtons, setQualityChoice } from '../core/renderer.js';
import { ZONES } from '../world/sky.js';
import { PATHS } from '../world/landscape.js';
import { COASTER } from '../world/rides.js';
import { fmtTime } from '../world/manor.js';
import { ACTIVITIES } from '../world/attractions.js';
import { kickPumpkin } from '../world/dressing.js';
import { AU } from '../core/audio.js';
import { GAME_SHOOT, GAME_STRIKER, S, SCORES, keys, player, shootGallery, startWitchingHour, strike2 } from '../game/play.js';
import { buildTourBar, exitTour, startTour, tourKey2 } from '../game/tour.js';
import { buildConsole, isOpen, toggleConsole } from './console.js';
import { leaveShowCam, startFinale } from '../game/showtime.js';
import { SET, applySettings, setSetting } from '../core/settings.js';
import { applyStatic, onLang, setLang } from '../core/i18n.js';
import { relabelMarkers } from '../world/attractions.js';
import { capture, currentInteract, interact, jumpTo, togglePhoto, updatePhotoUI } from '../game/photo.js';
import { t } from '../core/i18n.js';
import { icon } from './icons.js';
import { GUIDE, buildCompass, toggleGuide } from './guide.js';
import { obEvent, skipOnboarding, startOnboarding } from './onboarding.js';
import { initTouch } from './touch.js';
import { SITES, launch as pyroLaunch, show } from '../game/pyro.js';
import { FLAGS, hasSave, resetProgress } from '../core/save.js';

/* =========================================================================
   10. UI — toasts, cards, floaters, zone names, minimap, menus
   ========================================================================= */
function toast(title, sub = '', kind = '') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = `<div class="tt">${t(title)}</div>${sub ? `<div class="ts">${t(sub)}</div>` : ''}`;
  const box = $('#toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4700);
}
let cardTimer;
function showCard(ti, b, ms = 4000) { const c = $('#card'); c.querySelector('.ct').textContent = t(ti); c.querySelector('.cb').textContent = t(b); c.classList.remove('hidden'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; clearTimeout(cardTimer); cardTimer = setTimeout(() => c.classList.add('hidden'), ms); }
function floater(p, text, neg) { const v = p.clone().project(camera); const el = document.createElement('div'); el.className = 'floater' + (neg ? ' neg' : ''); el.textContent = text;
  el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px'; $('#floaters').appendChild(el); setTimeout(() => el.remove(), 1000); }
function fade(cb) { const f = $('#fade'); f.style.opacity = 1; setTimeout(() => { cb(); f.style.opacity = 0; }, 380); }
let lastZone = null;
function showZone(z, force) { if (z === lastZone && !force) return; lastZone = z; const el = $('#zone'); el.classList.remove('show');
  setTimeout(() => { el.querySelector('.zname').textContent = t(z.name); el.querySelector('.zsub').textContent = t(z.sub); el.classList.add('show'); }, 300);
  clearTimeout(showZone.t); showZone.t = setTimeout(() => el.classList.remove('show'), 5500); }
function updateZone() { if (S.mode !== 'roam') return; const p = player.pos; let best = null, bd = 1e9;
  for (const z of ZONES) { const cx = z.cx ?? z.x, cz = z.cz ?? z.z, d = Math.hypot(p.x - cx, p.z - cz); if (d < z.r && d < bd) { bd = d; best = z; } }
  if (best) showZone(best); }
// minimap: static layer drawn once, player arrow redrawn
const mm = $('#minimap'), mctx = mm.getContext('2d'); let mmStatic;
const MMS = 1.3, mmX = x => 500 + x * MMS, mmY = z => 500 + (z + 55) * MMS;
function drawMinimapStatic() {
  const [c, x] = cnv(1000); mmStatic = c;
  x.fillStyle = '#0b0810'; x.fillRect(0, 0, 1000, 1000);
  x.strokeStyle = 'rgba(255,170,90,.25)'; x.lineWidth = 2; x.strokeRect(mmX(-150), mmY(-192), 300 * MMS, 270 * MMS);
  x.strokeStyle = 'rgba(190,170,150,.35)'; x.lineCap = 'round';
  for (const [x1, z1, x2, z2, w] of PATHS) { x.lineWidth = w * MMS * 0.8; x.beginPath(); x.moveTo(mmX(x1), mmY(z1)); x.lineTo(mmX(x2), mmY(z2)); x.stroke(); }
  x.fillStyle = 'rgba(190,170,150,.3)'; x.beginPath(); x.arc(mmX(0), mmY(0), 25 * MMS, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(255,120,40,.5)'; x.lineWidth = 2; x.beginPath(); const cp = COASTER.curve.getSpacedPoints(120); cp.forEach((p, i) => i ? x.lineTo(mmX(p.x), mmY(p.z)) : x.moveTo(mmX(p.x), mmY(p.z))); x.closePath(); x.stroke();
  x.fillStyle = 'rgba(60,110,70,.5)'; x.fillRect(mmX(30), mmY(-73), 36 * MMS, 36 * MMS);
  x.fillStyle = 'rgba(120,90,140,.6)'; x.fillRect(mmX(-16), mmY(-84), 32 * MMS, 26 * MMS); x.fillStyle = 'rgba(150,110,200,.35)'; x.fillRect(mmX(52), mmY(31), 24 * MMS, 18 * MMS);
  // far districts: lake, fields, witchwood, cathedral terrace, big top
  x.fillStyle = 'rgba(40,70,110,.55)'; x.beginPath(); x.ellipse(mmX(112), mmY(-50), 28 * MMS, 40 * MMS, 0, 0, TAU); x.fill();
  x.fillStyle = 'rgba(150,80,20,.32)'; x.fillRect(mmX(84), mmY(16), 62 * MMS, 60 * MMS);
  x.fillStyle = 'rgba(40,80,50,.4)'; x.fillRect(mmX(-148), mmY(-190), 86 * MMS, 98 * MMS);
  x.fillStyle = 'rgba(120,100,150,.45)'; x.fillRect(mmX(-30), mmY(-178), 60 * MMS, 48 * MMS);
  x.fillStyle = 'rgba(160,70,170,.4)'; x.beginPath(); x.arc(mmX(-118), mmY(22), 22 * MMS, 0, TAU); x.fill();
  const dot = (px, pz, col, r = 5) => { x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8; x.beginPath(); x.arc(mmX(px), mmY(pz), r, 0, TAU); x.fill(); x.shadowBlur = 0; };
  const AC = { core: '#ffb060', east: '#ff8a2a', north: '#b796ff', west: '#ff6ab0' };
  for (const z of ZONES) dot(z.cx ?? z.tx, z.cz ?? z.tz, AC[z.area || 'core'], z.r > 25 ? 7 : 5);
}
function drawMinimap() {
  const x = mctx; x.save(); x.clearRect(0, 0, 360, 360); x.beginPath(); x.arc(180, 180, 178, 0, TAU); x.clip();
  const p = S.mode === 'roam' ? player.pos : camera.position;
  x.translate(180, 180); x.translate(-(mmX(p.x) - 180), -(mmY(p.z) - 180)); x.drawImage(mmStatic, 0, 0); x.restore();
  x.save(); x.translate(180, 180); x.rotate(-S.camYaw); x.fillStyle = '#fff2dc'; x.shadowColor = '#ff8a2a'; x.shadowBlur = 12;
  x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.fill(); x.restore();
  if (GUIDE.key && S.guide !== false && SPOTS_REF.s) { const sp = SPOTS_REF.s[GUIDE.key]; if (sp) { let dx = (sp[0] - p.x) * MMS, dz = (sp[1] - p.z) * MMS; const d = Math.hypot(dx, dz); if (d > 160) { dx *= 160 / d; dz *= 160 / d; }
    x.save(); x.translate(180 + dx, 180 + dz); x.rotate(Math.PI / 4); x.fillStyle = '#9fffd6'; x.shadowColor = '#9fffd6'; x.shadowBlur = 12; x.fillRect(-6, -6, 12, 12); x.restore(); } }
  x.save(); x.fillStyle = 'rgba(255,194,122,.9)'; x.font = '600 26px sans-serif'; x.textAlign = 'center'; x.fillText('N', 180, 34); x.restore();
}
const SPOTS_REF = { s: null };
function showMenu() { if (S.mode === 'title') return; S.menu = true; $('#menu').classList.remove('hidden');
  $('#stats').textContent = t('Souls {a}/13 · Candy {b} · Ghosts banished {c} · Lanterns {d}/12 · Pumpkins smashed {e} · Manor record {f}', { a: S.souls, b: S.candy, c: S.ghosts, d: S.lit || 0, e: S.smashed, f: SCORES.manor ? fmtTime(SCORES.manor) : '—' });
  $('#acts').innerHTML = ACTIVITIES.map(([k, n]) => `<span class="act ${S.done.has(k) ? 'done' : ''}">${S.done.has(k) ? icon('check') : ''}${t(n)}</span>`).join(''); }
function hideMenu() { S.menu = false; $('#menu').classList.add('hidden'); }
function lock() { if (S.touchMode) { S.locked = true; hideMenu(); return; } const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); }
function quickLaunch() { let best = 'plaza', bd = 1e9; for (const [k, list] of Object.entries(SITES)) for (const [x, z] of list) { const d = Math.hypot(x - player.pos.x, z - player.pos.z); if (d < bd) { bd = d; best = k; } }
  pyroLaunch({ site: best }); }
function showFatal(title, body) { const el = $('#fatal'); el.querySelector('h2').textContent = title; el.querySelector('p').textContent = body; el.querySelector('button').textContent = t('Reload'); el.classList.remove('hidden'); }
// loading screen tips
const TIPS = ['Hold your <b>lantern</b> (F) on a ghost to banish it.', 'Press <b>T</b> anywhere to join the cinematic tour from where you stand.', 'The <b>green diamond</b> always points to an attraction you haven’t tried.',
  'Kick pumpkins into walls. They <b>splatter</b>.', 'Thirteen <b>lost souls</b> drift around the park. Free them all.', 'The <b>Grand Finale</b> wakes every district at once.', 'In the tour, <b>drag</b> to look around and press <b>1–5</b> to change camera.',
  'Your progress is <b>saved automatically</b>.', 'Press <b>K</b> to fire a shell at the nearest launch site — or open the <b>Fireworks</b> tab for a full show.', 'Press <b>Tab</b> for the Control Console: districts, shows and settings.', 'Ring the <b>Bell of Souls</b> in the plaza… if you dare.'];
let tipTimer;
function startLoadTips() { let i = Math.floor(Math.random() * TIPS.length); const el = $('#loadtip'); const show = () => { el.style.opacity = 0; setTimeout(() => { el.innerHTML = t(TIPS[i++ % TIPS.length]); el.style.opacity = 1; }, 400); }; show(); tipTimer = setInterval(show, 4200); }
function stopLoadTips() { clearInterval(tipTimer); }
function titleReady(resumed) {
  const n = S.done.size, note = $('#savenote');
  if (resumed && (n || S.souls || S.candy)) { $('#bEnter span').textContent = t('Continue'); $('#bEnter span').dataset.i18n = 'Continue';
    note.innerHTML = `${t('Welcome back · {a} of {b} attractions · {c} souls freed', { a: n, b: ACTIVITIES.length, c: S.souls })}<button data-reset>${t('Start over')}</button>`; note.classList.remove('hidden');
    note.querySelector('[data-reset]').addEventListener('click', e => { e.stopPropagation(); if (confirm(t('Erase all progress and high scores?'))) resetProgress(); }); }
  $('#actCount').textContent = n; $('#actTotal').textContent = '/' + ACTIVITIES.length;
}

// ---- Input: all DOM wiring happens in initUI() (called from boot) so module load order never matters ----
function initUI() {
// ---- Input ----
addEventListener('keydown', e => {
  keys[e.code] = true; if (e.code === 'Tab') e.preventDefault();
  if (S.mode === 'title') return;
  if (e.code === 'Tab' || e.code === 'Backquote') { if (!e.repeat) toggleConsole(); return; }
  if (isOpen()) { if (e.code === 'Escape') toggleConsole(false); return; }
  if (S.mode === 'show') { if (!e.repeat && !['ShiftLeft', 'ShiftRight', 'MetaLeft', 'AltLeft', 'ControlLeft'].includes(e.code)) leaveShowCam(); return; }
  if (S.mode === 'tour') { if (e.code === 'KeyP') togglePhoto(); else if (tourKey2(e)) e.preventDefault(); return; }
  if (S.mode === 'photo') { const P = S.photo;
    if (e.code === 'KeyP') togglePhoto(); else if (e.code === 'Enter') capture(); else if (e.code === 'KeyC') P.filter = (P.filter + 1) % 4; else if (e.code === 'KeyX') P.freeze = !P.freeze;
    else if (e.code === 'BracketLeft') P.aperture = Math.max(0, P.aperture - 0.1); else if (e.code === 'BracketRight') P.aperture = Math.min(3, P.aperture + 0.1);
    else if (e.code === 'Minus') P.fov = Math.min(100, P.fov + 5); else if (e.code === 'Equal') P.fov = Math.max(15, P.fov - 5); else if (e.code === 'KeyH') $('#photoui').classList.toggle('hidden');
    updatePhotoUI(); return; }
  if (e.code === 'KeyM') { AU.muted = !AU.muted; if (AU.master) AU.master.gain.value = AU.muted ? 0 : AU.vol; toast(AU.muted ? 'Sound muted' : 'Sound on'); }
  if (S.menu) return;
  if (S.mode === 'game') { if (S.game === GAME_STRIKER && e.code === 'Space') strike2(); else if (S.game && S.game.key && !e.repeat) S.game.key(e.code); return; }
  if (e.code === 'KeyE') { interact(); obEvent('acted'); }
  if (e.code === 'KeyG') toggleGuide();
  if (e.code === 'KeyK' && !e.repeat) quickLaunch();
  if (e.code === 'KeyF') { S.lantern = !S.lantern; lantern.intensity = S.lantern ? 60 : 0; AU.click(); }
  if (e.code === 'KeyT') startTour({ fromHere: true });
  if (e.code === 'KeyP') togglePhoto();
  const z = ZONES.find(z => z.key && 'Digit' + z.key === e.code); if (z) jumpTo(z);
});
addEventListener('keyup', e => { keys[e.code] = false; if (S.mode === 'game' && S.game && S.game.keyUp) S.game.keyUp(e.code); });
addEventListener('mousemove', e => {
  if (!S.locked) return; const s = 0.0022 * (S.sens || 1), my = e.movementY * (S.invertY ? -1 : 1);
  if (S.mode === 'photo') { S.photo.yaw -= e.movementX * s; S.photo.pitch = clamp(S.photo.pitch - my * s, -1.5, 1.5); return; }
  player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - my * s, -1.45, 1.45);
});
addEventListener('wheel', e => { if (S.mode === 'photo') { S.photo.focus = clamp(S.photo.focus * (e.deltaY > 0 ? 1.08 : 0.926), 0.5, 300); updatePhotoUI(); } });
canvas.addEventListener('mousedown', () => {
  if (S.mode === 'show') { leaveShowCam(); return; }
  if (S.mode === 'title' || S.mode === 'tour' || isOpen()) return;
  if (!S.locked) { lock(); return; }
  if (S.mode === 'roam') { if (currentInteract && currentInteract !== 'exit') { interact(); obEvent('acted'); } else kickPumpkin(); }
  if (S.mode === 'game') { if (S.game === GAME_SHOOT) shootGallery(); else if (S.game === GAME_STRIKER) strike2(); else if (S.game && S.game.click) S.game.click(); }
});
addEventListener('mouseup', () => { if (S.mode === 'game' && S.game && S.game.release) S.game.release(); });
document.addEventListener('pointerlockchange', () => {
  S.locked = document.pointerLockElement === canvas;
  if (S.locked) { hideMenu(); if (isOpen()) toggleConsole(false); } else if (['roam', 'ride', 'game', 'photo'].includes(S.mode) && !isOpen()) showMenu();
});
$('#menu').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; AU.click();
  if (b.dataset.q) { setQualityChoice(b.dataset.q); return; }
  const a = b.dataset.a;
  if (a === 'resume') lock(); if (a === 'tour') startTour({ fromHere: true }); if (a === 'console') { hideMenu(); toggleConsole(true); } if (a === 'finale') { hideMenu(); startFinale(true); } if (a === 'photo') { hideMenu(); togglePhoto(); } if (a === 'witch') { startWitchingHour(false); lock(); }
  if (b.dataset.z) { jumpTo(ZONES[+b.dataset.z]); lock(); }
});
const zoneBtns = () => { $('#zoneBtns').innerHTML = ZONES.map((z, i) => `<button class="btn" data-z="${i}"><kbd>${z.key || '·'}</kbd>${t(z.name)}</button>`).join(''); };
zoneBtns(); onLang(() => { zoneBtns(); if (S.menu && !isOpen()) showMenu(); relabelMarkers(); setQualityButtons(); });
buildTourBar(); buildConsole(); applySettings(); applyStatic(); buildCompass(); initTouch();
import('./console.js').then(m => { SPOTS_REF.s = m.SPOTS; });
const fillIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(e => { if (!e.firstElementChild) e.innerHTML = icon(e.dataset.icon); });
fillIcons();
$('#coach .co-skip').addEventListener('click', e => { e.stopPropagation(); skipOnboarding(); });
document.querySelectorAll('#title [data-lang]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setLang(b.dataset.lang); }));
const fps = document.createElement('div'); fps.id = 'fpsmeter'; fps.className = SET.fps ? '' : 'hidden'; document.body.appendChild(fps);
setInterval(() => { fps.textContent = (perf.fps ? perf.fps.toFixed(0) : '…') + ' FPS'; $('#cxfab').classList.toggle('hidden', S.mode === 'title' || S.mode === 'show' || S.mode === 'tour'); }, 500);
document.querySelectorAll('#title [data-q]').forEach(b => b.addEventListener('click', () => setQualityChoice(b.dataset.q)));
$('#vol').value = SET.volume; $('#vol').addEventListener('input', e => setSetting('volume', +e.target.value));
$('#bEnter').addEventListener('click', () => { AU.init(); fade(() => { $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden'); S.mode = 'roam'; camera.fov = S.fov; camera.updateProjectionMatrix(); showZone(ZONES[0], true); setTimeout(() => startOnboarding(), 1800); }); lock(); });
$('#bTour').addEventListener('click', () => { AU.init(); startTour({ restart: true }); });
$('#bFinale')?.addEventListener('click', () => { AU.init(); $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden'); S.mode = 'roam'; startFinale(true); });
document.addEventListener('visibilitychange', () => { if (!AU.ctx) return; document.hidden ? AU.ctx.suspend() : AU.ctx.resume(); });
}

export { showFatal, startLoadTips, stopLoadTips, titleReady, toast, cardTimer, showCard, floater, fade, lastZone, showZone, updateZone, mm, mctx, MMS, mmX, mmY, drawMinimapStatic, drawMinimap, showMenu, hideMenu, lock, initUI };
