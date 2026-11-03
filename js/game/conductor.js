import * as THREE from 'three';
import { R, pick } from '../core/utils.js';
import { QNAME } from '../core/renderer.js';
import { t } from '../core/i18n.js';
import { AU } from '../core/audio.js';
import { onUpdate } from '../core/registry.js';
import { $ } from '../core/utils.js';
import { MUS, SPB, BEATS, time, setSection, startMusic, stopMusic } from '../core/music.js';
import { PAL, THEMES, launch, mine } from './pyro.js';
import { LS, converge, pulse, setAct } from './lightshow.js';
import { SHOW } from './showtime.js';
import { S } from './play.js';

/* =========================================================================
   CONDUCTOR — the NIGHTLY SPECTACULAR: a continuous, self-cycling show that ties the score (music.js),
   the fireworks (pyro.js), the light show (lightshow.js) and the aurora together on one beat clock.

   Composition rules (what keeps it readable rather than busy):
   • ONE STAGE. Every shell bursts over a stage north of the plaza, on symmetric slots (centre, ±20, ±40, ±60)
     along a front line and a back line — the show has a centre of gravity and always mirrors left/right.
   • PHRASES. Music moves in 4-bar phrases; so does the show. A phrase holds one pattern and one shell type for
     three bars, then lands an ACCENT bar: the act's hero shell, a contrast colour, beams converging on it.
   • ONE PALETTE PER ACT. Each act draws a duo palette once: main colour for the phrase, partner for pistils
     and accents. A new loop draws new palettes.
   • LAYERS BY ACT. Each act opens a little more: lights, lasers, mines and density build toward the finale;
     the interlude lets the smoke clear.
   Five acts loop forever (~2.5 min): Overture → Danse Macabre → Witchfire → Grand Crescendo → Interlude.
   ========================================================================= */
const ACTS = [
  { id: 'overture', name: 'Overture', sub: 'The park wakes', bars: 16, music: 'overture', light: ['fan', 'sweep'], groups: ['plaza'], level: 1.6, lasers: 'off', aurora: 0.9, density: 0.6,
    patterns: ['single', 'pair', 'waltz'], shells: ['peony', 'ring', 'chrys'], hero: 'dahlia', size: [1.2, 1.7] },
  { id: 'danse', name: 'Danse Macabre', sub: 'Everybody dance — the dead insist', bars: 24, music: 'danse', light: ['sweep', 'cross', 'ballyhoo'], groups: ['plaza', 'gate', 'west', 'east'], level: 2.6, lasers: 'off', aurora: 0.45, density: 0.9,
    patterns: ['waltz', 'chase', 'pair', 'fan'], shells: ['peony', 'chrys', 'crossette', 'strobe'], hero: 'peonycc', size: [1.1, 1.6] },
  { id: 'witch', name: 'Witchfire', sub: 'The sky remembers older magic', bars: 16, music: 'witch', light: ['ballyhoo', 'cross'], groups: ['plaza', 'cath'], level: 2.9, lasers: 'off', aurora: 1.7, density: 0.75,
    patterns: ['pair', 'waltz', 'single'], shells: ['willow', 'horsetail', 'peonycc', 'saturn'], hero: 'spider', size: [1.3, 1.9] },
  { id: 'finale', name: 'Grand Crescendo', sub: 'Every light in Hollowmoor at once', bars: 24, music: 'finale', light: ['sweep', 'ballyhoo', 'strobe'], groups: null, level: 4, lasers: 'scan', aurora: 0.5, density: 1,
    patterns: ['fan', 'chase', 'cake', 'mines'], shells: ['peony', 'crossette', 'crackle', 'dahlia', 'ring'], hero: 'brocade', size: [1.4, 2.1] },
  { id: 'interlude', name: 'Interlude', sub: 'Smoke drifts. The ghosts catch their breath.', bars: 8, music: 'interlude', light: ['fan'], groups: ['plaza'], level: 0.8, lasers: 'off', aurora: 1.25, density: 0.3,
    patterns: ['single'], shells: ['willow', 'kamuro'], hero: 'kamuro', size: [1.6, 2.0] },
];
const LOOP_BARS = ACTS.reduce((a, b) => a + b.bars, 0);
const SHOWLOOP = { on: true, startBar: 0, planned: -1, queue: [], act: -1, cycle: 0, themes: [], phrase: null, density: 1, cols: [new THREE.Color(), new THREE.Color()] };
// the stage: symmetric slots on a front and a back line, centred north of the plaza
const FZ = -36, BZ = -70, H_FRONT = 52, H_BACK = 72;
const barTime = b => b * BEATS * SPB;
function actAt(bar) { let b = ((bar - SHOWLOOP.startBar) % LOOP_BARS + LOOP_BARS) % LOOP_BARS; for (let i = 0; i < ACTS.length; i++) { if (b < ACTS[i].bars) return { i, local: b }; b -= ACTS[i].bars; } return { i: 0, local: 0 }; }
function themeFor(i) { const k = SHOWLOOP.themes[i] || (SHOWLOOP.themes[i] = pick(THEMES)); return [PAL[k[0]], PAL[k[1]]]; }
// ---------- one bar of a pattern → events [beat-in-bar, kind, params]; every layout is mirror-symmetric ----------
function patternBar(name, ph, A, ai, k) {
  const [c1, c2] = themeFor(ai), E = [], s = ph.size;
  const shell = (beat, x, z, o = {}) => E.push([beat, 'shell', { x, z, type: o.type || ph.shell, size: o.size || s, col: o.col || c1, col2: o.col2 || c2, h: o.h || (z === BZ ? H_BACK : H_FRONT), accent: o.accent }]);
  const pairAt = (beat, x, z, o) => { shell(beat, -x, z, o); shell(beat, x, z, o); };
  switch (name) {
    case 'single': shell(0, 0, FZ); break;
    case 'pair': pairAt(0, 30, FZ); break;
    case 'waltz': shell(0, 0, FZ); shell(1, -40, FZ, { size: s * 0.8 }); shell(2, 40, FZ, { size: s * 0.8 }); break;
    case 'chase': { const d = k % 2 ? -1 : 1; [-50, 0, 50].forEach((x, b) => shell(b, x * d, FZ)); break; }    // left→right, then right→left
    case 'fan': shell(0, 0, FZ); pairAt(1, 30, FZ, { size: s * 0.9 }); pairAt(2, 60, FZ, { size: s * 0.8 }); break;
    case 'cake': for (let b = 0; b < 3; b++) pairAt(b, 15 + b * 22, FZ + 6, { type: 'peony', size: 0.9, h: 44 }); break;
    case 'mines': E.push([0, 'mine', { x: -26, z: -28, col: c1, col2: c2 }], [0, 'mine', { x: 26, z: -28, col: c1, col2: c2 }], [2, 'mine', { x: 0, z: -30, col: c2, col2: c1 }]); shell(1, 0, FZ); break;
  }
  return E;
}
// the accent bar that closes every phrase: the act's hero shell, centred and high, in the contrast colour
function accentBar(A, ai, local) {
  const [c1, c2] = themeFor(ai), E = [], big = Math.min(2.6, A.size[1] + 0.4);
  E.push([0, 'shell', { x: 0, z: BZ, type: A.hero, size: big, col: c2, col2: c1, h: H_BACK + 14, accent: true }]);
  if (A.id === 'danse' || A.id === 'finale') E.push([1.5, 'shell', { x: -40, z: FZ, type: 'strobe', size: 1, col: c1, col2: c1, h: H_FRONT }], [1.5, 'shell', { x: 40, z: FZ, type: 'strobe', size: 1, col: c1, col2: c1, h: H_FRONT }]);
  if (A.id === 'finale') E.push([0, 'mine', { x: -26, z: -28, col: c2, col2: c1 }], [0, 'mine', { x: 26, z: -28, col: c2, col2: c1 }]);
  return E;
}
// the last two bars of the finale are written out: a line of mines, then five crowns under vertical light
function finaleClose(local, A) {
  const [c1, c2] = themeFor(3), E = [], line = [-60, -40, -20, 0, 20, 40, 60];
  if (local === A.bars - 2) { line.forEach((x, k) => E.push([Math.abs(x) / 60, 'mine', { x, z: -28, col: k % 2 ? c1 : c2, col2: PAL.white }]));
    line.forEach(x => E.push([1 + Math.abs(x) / 60, 'shell', { x, z: FZ, type: 'peony', size: 1.6, col: c1, col2: c2, h: H_FRONT }])); }
  if (local === A.bars - 1) { [-60, -30, 0, 30, 60].forEach(x => E.push([0, 'shell', { x, z: BZ, type: 'brocade', size: 2.8, h: 100, col: PAL.gold, col2: c1, accent: x === 0 }])); E.push([0, 'light', { pattern: 'up' }]); }
  return E;
}
function planBar(bar) {
  const { i: ai, local } = actAt(bar), A = ACTS[ai];
  if (local === 0 && ai === 0 && bar > SHOWLOOP.startBar) { SHOWLOOP.cycle++; SHOWLOOP.themes = []; }        // new loop → new palettes
  const inPhrase = local % 4;
  if (inPhrase === 0) { // a new phrase: one pattern, one shell type, one size — held for three bars
    const dens = A.density * SHOWLOOP.density * (QNAME === 'low' ? 0.6 : 1);
    SHOWLOOP.phrase = { pattern: Math.random() < dens ? pick(A.patterns) : null, shell: pick(A.shells), size: R(A.size[0], A.size[1]) };
    if (ai !== SHOWLOOP.lightAct || inPhrase === 0) SHOWLOOP.lightPattern = A.light[(local / 4) % A.light.length];
  }
  const ph = SHOWLOOP.phrase || { pattern: null, shell: A.shells[0], size: A.size[0] };
  let E;
  if (A.id === 'finale' && local >= A.bars - 2) E = finaleClose(local, A);
  else if (inPhrase === 3) E = accentBar(A, ai, local);
  else E = ph.pattern ? patternBar(ph.pattern, ph, A, ai, inPhrase) : [];
  const t0 = barTime(bar);
  for (const [beat, kind, p] of E) { const at = t0 + beat * SPB, fuse = kind === 'shell' ? 1.7 + (p.size || 1) * 0.3 : 0; SHOWLOOP.queue.push({ at, launchAt: at - fuse, kind, p, bar, local }); }
  if (inPhrase === 0) SHOWLOOP.queue.push({ at: t0, launchAt: t0, kind: 'phrase', p: { pattern: SHOWLOOP.lightPattern } });
  SHOWLOOP.queue.sort((a, b) => a.launchAt - b.launchAt);
}
const _p = new THREE.Vector3();
let cardTimer;
function titleCard(A) { // a quiet act title in the lower third instead of a toast
  if (!['roam', 'show'].includes(S.mode) || A.id === 'interlude') return; const c = $('#caption'); clearTimeout(cardTimer);
  c.querySelector('.c1').textContent = t(A.name); c.querySelector('.c2').textContent = t(A.sub); c.classList.add('show', 'act'); cardTimer = setTimeout(() => c.classList.remove('show', 'act'), 4200);
}
function enterAct(ai) {
  const A = ACTS[ai]; SHOWLOOP.act = ai; const [c1, c2] = themeFor(ai);
  SHOWLOOP.cols[0].setRGB(c1[0], c1[1], c1[2]).multiplyScalar(1 / Math.max(...c1)); SHOWLOOP.cols[1].setRGB(c2[0], c2[1], c2[2]).multiplyScalar(1 / Math.max(...c2));
  setAct({ pattern: A.light[0], cols: SHOWLOOP.cols, level: S.lightShowOn === false ? 0 : A.level, lasers: S.lasersOn === false ? 'off' : A.lasers, groups: A.groups });
  S.auroraShow = A.aurora; titleCard(A);
}
function update() {
  const L = SHOWLOOP;
  if (!L.on) { if (MUS.running) stopMusic(); if (LS.level) setAct({ level: 0 }); S.auroraShow = 1; return; }
  if (AU.ctx && !MUS.running && S.mode !== 'title') startMusic();
  const now = time(), bar = Math.floor(now / (BEATS * SPB));
  S.showBeat = now / SPB;
  if (L.planned < bar) L.planned = bar;
  while (barTime(L.planned + 1) < now + 4.2) { L.planned++; planBar(L.planned); }
  const ahead = actAt(Math.floor((now + 0.2) / (BEATS * SPB))); if (MUS.section !== ACTS[ahead.i].music) setSection(ACTS[ahead.i].music);
  const cur = actAt(bar); if (cur.i !== L.act) enterAct(cur.i);
  // fire due events — shells get exactly the remaining time as their fuse, so they burst on the beat
  const paused = SHOW.t >= 0;
  while (L.queue.length && L.queue[0].launchAt <= now) { const e = L.queue.shift(); if (e.at < now - 0.5) continue;
    if (e.kind === 'shell') { if (paused) continue; launch({ ...e.p, fuse: e.at - now });
      if (e.p.accent) setTimeout(() => { _p.set(e.p.x, e.p.h || 70, e.p.z); converge(_p, 1.6); pulse(1); S.showAccent = 1; }, Math.max(0, (e.at - now) * 1000)); }
    else if (e.kind === 'mine') { if (!paused) mine(e.p.x, e.p.z, e.p.col, 60, 0.32, 30, e.p.col2); pulse(0.5); }
    else if (e.kind === 'phrase') { if (LS.pattern !== 'up' || cur.local === 0) setAct({ pattern: e.p.pattern }); }
    else if (e.kind === 'light') setAct({ pattern: e.p.pattern }); }
  S.showAccent = Math.max(0, (S.showAccent || 0) - 1 / 90);
}
function setShowLoop(on) { SHOWLOOP.on = on; SHOWLOOP.queue.length = 0; SHOWLOOP.act = -1; if (on) { const bar = Math.floor(time() / (BEATS * SPB)) + 1; SHOWLOOP.startBar = bar; SHOWLOOP.planned = bar - 1; SHOWLOOP.themes = []; } }
function nextAct() { const bar = Math.floor(time() / (BEATS * SPB)) + 1, { i, local } = actAt(bar); SHOWLOOP.startBar -= ACTS[i].bars - local; SHOWLOOP.queue.length = 0; SHOWLOOP.planned = bar - 1; }
function actProgress() { const now = time(), bar = now / (BEATS * SPB), { i } = actAt(Math.floor(bar)); let b = ((bar - SHOWLOOP.startBar) % LOOP_BARS + LOOP_BARS) % LOOP_BARS, start = 0; for (let k = 0; k < i; k++) start += ACTS[k].bars; return { act: ACTS[i], i, k: (b - start) / ACTS[i].bars }; }
function buildConductor() { setShowLoop(S.showLoop !== false); onUpdate(update); }

export { ACTS, SHOWLOOP, buildConductor, setShowLoop, nextAct, actProgress };
