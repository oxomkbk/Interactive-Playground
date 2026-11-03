import * as THREE from 'three';
import { $, clamp } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { camera } from '../core/renderer.js';
import { ACTIVITIES } from '../world/attractions.js';
import { groundAt } from '../world/landscape.js';
import { S, player } from '../game/play.js';
import { SPOTS } from './console.js';
import { toast } from './ui.js';
import { SET, applySettings } from '../core/settings.js';

/* =========================================================================
   GUIDE — makes the park discoverable: a heading compass across the top, a "Next up" tracker naming the
   nearest unfinished attraction with live distance, and a waypoint diamond that sits on the target in
   the 3D view (or hugs the screen edge pointing to it). Auto-picks targets; the console can pin one.
   G toggles guidance; it re-targets automatically when an attraction is completed.
   ========================================================================= */
const SKIP = new Set(['ghosts', 'hunt', 'finale', 'witch']);
const GUIDE = { on: true, key: null, pinned: false, t: 0, idle: 0, lastPos: new THREE.Vector3() };
const TAU = Math.PI * 2, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const _v = new THREE.Vector3();
function buildCompass() {
  const strip = $('#compass .cp-strip'); let h = '';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = 0; d < 360; d += 15) h += names[d] !== undefined ? `<span data-b="${d}" class="${d % 90 ? '' : 'c'}">${names[d]}</span>` : `<i data-b="${d}"></i>`;
  strip.innerHTML = h;
}
function pickTarget() {
  if (GUIDE.pinned && GUIDE.key && !S.done.has(GUIDE.key)) return;
  GUIDE.pinned = false; let best = null, bd = 1e9; const p = player.pos;
  for (const [k] of ACTIVITIES) { if (S.done.has(k) || SKIP.has(k) || !SPOTS[k]) continue; const [x, z] = SPOTS[k], d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = k; } }
  GUIDE.key = best;
}
function pinTarget(k) { GUIDE.key = k; GUIDE.pinned = true; GUIDE.on = true; S.guide = true; toast(t('Guiding you to {a}', { a: t(ACTIVITIES.find(a => a[0] === k)[1]) }), 'Follow the green marker'); }
const nameOf = k => t((ACTIVITIES.find(a => a[0] === k) || [0, ''])[1]);
function updateGuide(dt) {
  const roam = S.mode === 'roam', on = S.guide !== false;
  const hud = $('#hud'); if (!hud || hud.classList.contains('hidden')) return;
  // compass ticks
  const span = 1.9; // radians visible across the strip
  $('#compass').querySelectorAll('[data-b]').forEach(el => { const b = -(+el.dataset.b) * Math.PI / 180, rel = wrap(b - S.camYaw), x = 50 - rel / span * 100;
    el.style.left = x + '%'; el.style.display = Math.abs(rel) < span * 0.55 ? '' : 'none'; });
  GUIDE.t -= dt; if (GUIDE.t <= 0) { GUIDE.t = 0.6; pickTarget(); }
  const nu = $('#nextup'), wp = $('#waypoint'), cwp = $('#compass .cp-wp');
  if (!on || !roam || !GUIDE.key) { nu.classList.add('hidden'); wp.classList.add('hidden'); cwp.classList.add('hidden'); return; }
  const [x, z] = SPOTS[GUIDE.key], dist = Math.hypot(x - player.pos.x, z - player.pos.z);
  nu.classList.remove('hidden'); nu.querySelector('.nu-n').textContent = nameOf(GUIDE.key); nu.querySelector('.nu-d').textContent = dist < 5 ? t('Here') : Math.round(dist) + ' m';
  // compass marker
  const bear = Math.atan2(-(x - player.pos.x), -(z - player.pos.z)), rel = wrap(bear - S.camYaw);
  cwp.classList.remove('hidden'); cwp.style.left = clamp(50 - rel / span * 100, 4, 96) + '%';
  // on-screen waypoint
  if (dist < 5) { wp.classList.add('hidden'); return; }
  _v.set(x, groundAt(x, z) + 2.6, z).project(camera); const behind = _v.z > 1;
  let sx = (_v.x * 0.5 + 0.5) * innerWidth, sy = (-_v.y * 0.5 + 0.5) * innerHeight; const m = 60;
  const off = behind || sx < m || sx > innerWidth - m || sy < m || sy > innerHeight - m;
  if (off) { // pin to the screen edge in the target's direction
    let dx = (_v.x) * (behind ? -1 : 1), dy = (-_v.y) * (behind ? -1 : 1); if (behind && Math.abs(dx) < 0.2) dx = rel > 0 ? -1 : 1;
    const k = Math.min((innerWidth / 2 - m) / Math.max(Math.abs(dx) * innerWidth / 2, 1e-3), (innerHeight / 2 - m) / Math.max(Math.abs(dy) * innerHeight / 2, 1e-3));
    sx = innerWidth / 2 + dx * innerWidth / 2 * k; sy = innerHeight / 2 + dy * innerHeight / 2 * k; }
  const z2 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
  wp.classList.remove('hidden'); wp.classList.toggle('edge', off); wp.style.left = (sx / z2) + 'px'; wp.style.top = (sy / z2) + 'px';
  wp.querySelector('span').textContent = off ? '' : nameOf(GUIDE.key) + ' · ' + Math.round(dist) + ' m';
  // idle nudge: standing around for a while → suggest the next thing
  if (player.pos.distanceTo(GUIDE.lastPos) > 3) { GUIDE.lastPos.copy(player.pos); GUIDE.idle = 0; } else if ((GUIDE.idle += dt) > 70) { GUIDE.idle = -120; toast(t('Try {a} next', { a: nameOf(GUIDE.key) }), t('{n} m away · follow the green marker', { n: Math.round(dist) }), 'soul'); }
}
function toggleGuide() { S.guide = S.guide === false; SET.guide = S.guide; applySettings(); toast(S.guide ? 'Guidance on' : 'Guidance off', S.guide ? 'Follow the green marker to the nearest attraction' : 'Press GUIDE to turn it back on'); return S.guide; }

export { GUIDE, buildCompass, updateGuide, pinTarget, toggleGuide };
