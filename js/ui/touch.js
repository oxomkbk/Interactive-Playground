import { $, clamp } from '../core/utils.js';
import { t, onLang } from '../core/i18n.js';
import { canvas, lantern } from '../core/renderer.js';
import { AU } from '../core/audio.js';
import { S, keys, player } from '../game/play.js';
import { interact, togglePhoto } from '../game/photo.js';
import { startTour } from '../game/tour.js';
import { icon } from './icons.js';
import { showMenu, hideMenu } from './ui.js';
import { toggleConsole } from './console.js';
import { toggleGuide } from './guide.js';
import { obEvent } from './onboarding.js';

/* =========================================================================
   TOUCH & GAMEPAD — phones/tablets get a virtual stick, drag-to-look and big action buttons; any
   standard gamepad works too (left stick move, right stick look, A act, B jump, X lantern, Y tour,
   LB guide, Start menu, Back console, L3/LT run). Both feed the same S.joy / player.yaw path as mouse+keys.
   ========================================================================= */
const TOUCH = { on: false, stickId: null, lookId: null, sx: 0, sy: 0, lx: 0, ly: 0, run: false };

function act(down) { // the context action: interact in the world, "click" in mini-games
  if (S.mode === 'roam' || S.mode === 'ride') { if (down) { interact(); obEvent('acted'); } return; }
  if (S.mode === 'game' && S.game) { if (down) { if (S.game.click) S.game.click(); else if (S.game.key) S.game.key('Space'); } else if (S.game.release) S.game.release(); }
}
function lanternToggle() { S.lantern = !S.lantern; lantern.intensity = S.lantern ? 60 : 0; AU.click(); }
function enableTouch() {
  if (TOUCH.on) return; TOUCH.on = true; S.touchMode = true; document.body.classList.add('touch');
  const ui = document.createElement('div'); ui.id = 'touchui'; ui.className = 'on';
  ui.innerHTML = `<div class="tu-stick"><div class="tu-knob"></div></div>
    <div class="tu-top"><button class="tu-b" data-t="menu">${icon('menu')}</button><button class="tu-b" data-t="console">${icon('sliders')}</button><button class="tu-b" data-t="tour">${icon('eye')}</button><button class="tu-b" data-t="guide">${icon('route')}</button><button class="tu-b" data-t="photo">${icon('camera')}</button></div>
    <div class="tu-btns"><button class="tu-b" data-t="jump">${icon('arrow')}<span data-i18n="Jump">Jump</span></button><button class="tu-b main" data-t="act">${icon('hand')}<span data-i18n="Act">Act</span></button>
      <button class="tu-b" data-t="lantern">${icon('lantern')}<span data-i18n="Lantern">Lantern</span></button></div>`;
  document.body.appendChild(ui); ui.querySelectorAll('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n)); onLang(() => ui.querySelectorAll('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n)));
  const stick = ui.querySelector('.tu-stick'), knob = ui.querySelector('.tu-knob');
  stick.addEventListener('pointerdown', e => { TOUCH.stickId = e.pointerId; stick.setPointerCapture(e.pointerId); const r = stick.getBoundingClientRect(); TOUCH.sx = r.left + r.width / 2; TOUCH.sy = r.top + r.height / 2; moveStick(e); });
  const moveStick = e => { if (e.pointerId !== TOUCH.stickId) return; let dx = (e.clientX - TOUCH.sx) / 60, dy = (e.clientY - TOUCH.sy) / 60; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    S.joy.x = dx; S.joy.y = -dy; TOUCH.run = m > 1.15; keys.ShiftLeft = TOUCH.run; knob.style.transform = `translate(${dx * 42}px,${dy * 42}px)`; };
  stick.addEventListener('pointermove', moveStick);
  const endStick = e => { if (e.pointerId !== TOUCH.stickId) return; TOUCH.stickId = null; S.joy.x = S.joy.y = 0; keys.ShiftLeft = false; knob.style.transform = ''; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  ui.querySelectorAll('.tu-b').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); const k = b.dataset.t; AU.init();
      if (k === 'act') act(true); if (k === 'jump') keys.Space = true; if (k === 'lantern') lanternToggle();
      if (k === 'menu') { if (S.menu) { hideMenu(); S.locked = true; } else { S.locked = false; showMenu(); } } if (k === 'console') toggleConsole(); if (k === 'tour') startTour({ fromHere: true }); if (k === 'guide') toggleGuide(); if (k === 'photo') togglePhoto(); });
    const up = () => { b.classList.remove('on'); const k = b.dataset.t; if (k === 'act') act(false); if (k === 'jump') keys.Space = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
  // drag anywhere on the view to look (tour has its own drag-look)
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || S.mode === 'tour' || TOUCH.lookId !== null) return; TOUCH.lookId = e.pointerId; TOUCH.lx = e.clientX; TOUCH.ly = e.clientY; });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== TOUCH.lookId) return; const dx = e.clientX - TOUCH.lx, dy = e.clientY - TOUCH.ly; TOUCH.lx = e.clientX; TOUCH.ly = e.clientY;
    const s = 0.0055 * (S.sens || 1), my = dy * (S.invertY ? -1 : 1);
    if (S.mode === 'photo') { S.photo.yaw -= dx * s; S.photo.pitch = clamp(S.photo.pitch - my * s, -1.5, 1.5); } else { player.yaw -= dx * s; player.pitch = clamp(player.pitch - my * s, -1.45, 1.45); } });
  const endLook = e => { if (e.pointerId === TOUCH.lookId) TOUCH.lookId = null; };
  canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
  S.locked = S.mode !== 'title';
}
// ---------- gamepad ----------
const PAD = { prev: [] };
function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; const gp = [...pads].find(p => p && p.connected); if (!gp) return;
  if (!PAD.seen) { PAD.seen = true; document.body.classList.add('gamepad'); }
  const dz = v => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85), a = gp.axes, b = i => gp.buttons[i] && gp.buttons[i].pressed;
  const pressed = i => b(i) && !PAD.prev[i];
  if (S.mode !== 'title') { if (!TOUCH.on) { S.joy.x = dz(a[0]); S.joy.y = -dz(a[1]); }
    const lx = dz(a[2] || 0), ly = dz(a[3] || 0), s = 2.6 * dt * (S.sens || 1);
    if (S.mode === 'photo') { S.photo.yaw -= lx * s; S.photo.pitch = clamp(S.photo.pitch - ly * s * (S.invertY ? -1 : 1), -1.5, 1.5); }
    else if (S.mode !== 'tour') { player.yaw -= lx * s; player.pitch = clamp(player.pitch - ly * s * (S.invertY ? -1 : 1), -1.45, 1.45); }
    const run = b(10) || (gp.buttons[6] && gp.buttons[6].value > 0.4); if (run !== !!PAD.run) { PAD.run = run; keys.ShiftLeft = run || TOUCH.run; } if (b(1) !== !!PAD.prev[1]) keys.Space = b(1);
    if (pressed(0)) act(true); else if (!b(0) && PAD.prev[0]) act(false);
    if (pressed(2)) lanternToggle(); if (pressed(3)) startTour({ fromHere: true }); if (pressed(4)) toggleGuide();
    if (pressed(9)) { if (S.menu) { hideMenu(); S.locked = true; } else { S.locked = false; showMenu(); } } if (pressed(8)) toggleConsole();
    if (!S.menu && !document.pointerLockElement && S.mode === 'roam') S.locked = true; }
  PAD.prev = gp.buttons.map(x => x.pressed);
}
function initTouch() {
  S.joy = { x: 0, y: 0 };
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) enableTouch();
  addEventListener('touchstart', () => enableTouch(), { once: true, passive: true });
  addEventListener('gamepadconnected', () => toastPad());
}
let padToasted = false;
function toastPad() { if (padToasted) return; padToasted = true; import('./ui.js').then(m => m.toast('Controller connected', 'Left stick move · right stick look · A act · B jump · X lantern · Y tour')); }

export { TOUCH, enableTouch, initTouch, pollGamepad, act };
