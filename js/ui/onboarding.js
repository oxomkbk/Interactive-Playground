import { $ } from '../core/utils.js';
import { t } from '../core/i18n.js';
import { S, player } from '../game/play.js';
import { FLAGS, saveNow } from '../core/save.js';
import { icon } from './icons.js';
import { toast } from './ui.js';
import { AU } from '../core/audio.js';

/* =========================================================================
   ONBOARDING — a five-step coach for first-time visitors that completes itself from what the player
   actually does (look, walk, follow the guide, interact, open the console). Skippable, shown once,
   adapted for touch. Also: milestone rewards and first-time contextual hints.
   ========================================================================= */
const touch = () => document.body.classList.contains('touch');
const STEPS = [
  { icon: 'eye', title: 'Look around', body: () => touch() ? 'Drag anywhere on the view to look around.' : 'Move the mouse to look. Click the view first if the cursor is visible.', done: c => c.look > 1.4 },
  { icon: 'walk', title: 'Take a walk', body: () => touch() ? 'Use the left stick to walk. Push it all the way to run.' : 'Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. Hold <kbd>Shift</kbd> to run.', done: c => c.walk > 8 },
  { icon: 'route', title: 'Follow the green marker', body: () => 'The diamond and the “Next up” card lead to the nearest attraction you haven’t tried.', done: c => c.prompt || c.t > 30 },
  { icon: 'hand', title: 'Interact', body: () => touch() ? 'When a prompt appears, tap the big ACT button.' : 'When a prompt appears, press <kbd>E</kbd> or click.', done: c => c.acted || c.t > 18 },
  { icon: 'sliders', title: 'Everything else', body: () => touch() ? 'The ☰ button opens the console: every district, show and setting.' : 'Press <kbd>Tab</kbd> any time for the Control Console: every district, show and setting.', done: c => c.console || c.t > 10 },
];
const OB = { i: -1, c: null };
function startOnboarding(force) {
  if (FLAGS.onboarded && !force) return; OB.i = -1; next();
}
function next() {
  OB.i++; const el = $('#coach');
  if (OB.i >= STEPS.length) { el.classList.add('hidden'); FLAGS.onboarded = true; saveNow(); toast('You’re ready', 'Thirteen lost souls are hidden in the park. Good luck.', 'soul'); AU.chime(); OB.i = -1; return; }
  const s = STEPS[OB.i]; OB.c = { look: 0, walk: 0, t: 0, prompt: false, acted: false, console: false, yaw: player.yaw, pitch: player.pitch, pos: player.pos.clone() };
  el.querySelector('.co-step').textContent = t('Step {a} of {b}', { a: OB.i + 1, b: STEPS.length });
  el.querySelector('.co-icon').innerHTML = icon(s.icon); el.querySelector('.co-t').textContent = t(s.title); el.querySelector('.co-b').innerHTML = t(s.body());
  el.querySelector('.co-bar i').style.width = (OB.i / STEPS.length * 100) + '%'; el.classList.remove('hidden', 'co-done'); void el.offsetWidth;
}
function updateOnboarding(dt) {
  if (OB.i < 0) return; const c = OB.c, el = $('#coach');
  el.classList.toggle('hidden', S.mode !== 'roam' || !!S.console || !!S.menu);
  if (S.mode !== 'roam' && OB.i !== 3) return;
  c.t += dt; c.look += Math.abs(player.yaw - c.yaw) + Math.abs(player.pitch - c.pitch); c.yaw = player.yaw; c.pitch = player.pitch;
  c.walk += Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.z); c.pos.copy(player.pos);
  c.prompt = c.prompt || !$('#prompt').classList.contains('hidden');
  if (STEPS[OB.i].done(c)) { OB.i += 0; el.classList.add('co-done'); el.querySelector('.co-bar i').style.width = ((OB.i + 1) / STEPS.length * 100) + '%'; AU.tone && AU.tone({ f: 880, dur: 0.18, vol: 0.05, type: 'triangle' }); const i = OB.i; OB.i = -2; setTimeout(() => { OB.i = i; next(); }, 650); }
}
const obEvent = k => { if (OB.c) OB.c[k] = true; };
function skipOnboarding() { OB.i = -1; $('#coach').classList.add('hidden'); FLAGS.onboarded = true; saveNow(); }
// ---- milestone rewards ----
const MILESTONES = [[3, 'Thrill-seeker', 'Three attractions down. The park has noticed you.'], [8, 'Regular', 'The ticket-taker nods as you pass.'], [16, 'Night Owl', 'Halfway through Hollowmoor. The dead are taking bets.'],
  [24, 'Carnival Ghoul', 'Few mortals get this far.'], [30, 'Keeper of Hollowmoor', 'Every attraction conquered. The park is yours — forever.']];
function onDoneCount(n, total) {
  const el = $('#actCount'); if (el) { el.textContent = n; const st = el.parentElement; st.classList.remove('bump'); void st.offsetWidth; st.classList.add('bump'); }
  const tot = $('#actTotal'); if (tot) tot.textContent = '/' + total;
  const m = MILESTONES.find(x => x[0] === n); return m;
}

export { STEPS, startOnboarding, updateOnboarding, obEvent, skipOnboarding, MILESTONES, onDoneCount };
