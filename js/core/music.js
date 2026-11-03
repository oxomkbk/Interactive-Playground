/* =========================================================================
   MUSIC — the score of the Nightly Spectacular, synthesized live: a dark-carnival waltz in D minor
   (108 BPM, 3/4) whose arrangement follows the show's acts — music-box overture, oom-pah-pah Danse Macabre,
   witchy arpeggios and choir, a brass-and-timpani finale, a hushed interlude.
   It owns the show clock: time() is the AudioContext clock when music runs (sample-accurate), otherwise
   performance time, so fireworks and lights can be planned onto future beats and land exactly on them.
   ========================================================================= */
import { AU, mtof } from './audio.js';
import { t } from './i18n.js';

const BPM = 108, BEATS = 3, SPB = 60 / BPM;
// 16-bar progression: [root midi, quality]  m = minor, M = major, 7 = dominant seventh
const PROG = [[50, 'm'], [50, 'm'], [55, 'm'], [50, 'm'], [57, '7'], [57, '7'], [50, 'm'], [50, 'm'], [58, 'M'], [55, 'm'], [50, 'm'], [57, '7'], [50, 'm'], [55, 'm'], [57, '7'], [50, 'm']];
const IV = { m: [0, 3, 7], M: [0, 4, 7], 7: [0, 4, 7, 10] };
const CONTOUR = [[2, 1, 0], [0, 2, 4], [4, 3, 2], [1, 2, 3], [3, 2, 1], [2, 4, 5], [5, 4, 2], [0, 1, 2]];
const MUS = { running: false, start: 0, perf0: performance.now() / 1000, beat: 0, next: 0, section: 'overture', vol: 0.55, bus: null, timer: null, pad: null };
function time() { return MUS.running && AU.ctx ? AU.ctx.currentTime - MUS.start : performance.now() / 1000 - MUS.perf0; }
const beatTime = i => i * SPB;                          // show-clock time of beat i
const nowBeat = () => time() / SPB;
function setSection(s) { MUS.section = s; }
function setMusicVolume(v) { MUS.vol = v; if (MUS.bus) MUS.bus.gain.setTargetAtTime(v, AU.ctx.currentTime, 0.3); }
function startMusic() {
  if (MUS.running || !AU.ctx) return; const ctx = AU.ctx;
  // continue the show clock seamlessly from performance time onto the audio clock
  const t = time(); MUS.start = ctx.currentTime - t; MUS.running = true;
  MUS.bus = ctx.createGain(); MUS.bus.gain.value = MUS.vol; MUS.bus.connect(AU.master);
  const wet = ctx.createGain(); wet.gain.value = 0.35; MUS.bus.connect(wet); wet.connect(AU.revIn);
  MUS.next = Math.ceil(t / SPB);
  MUS.timer = setInterval(schedule, 25);
}
function stopMusic() { if (!MUS.running) return; const t = time(); clearInterval(MUS.timer); MUS.running = false; MUS.perf0 = performance.now() / 1000 - t; if (MUS.bus) MUS.bus.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.2); }
function schedule() {
  const ctx = AU.ctx; if (!ctx || ctx.state !== 'running') return;
  while (beatTime(MUS.next) < time() + 0.12) { playBeat(MUS.next, MUS.start + beatTime(MUS.next) - ctx.currentTime); MUS.next++; }
}
const o = () => MUS.bus;
const T = (f, opt) => AU.tone({ f, out: o(), ...opt });
const Nz = opt => AU.noise({ out: o(), ...opt });
function chordNotes(bar) { const [r, q] = PROG[bar % 16]; return IV[q].map(i => r + i); }
function playBeat(i, t) {
  if (t < -0.05) return; t = Math.max(0, t);
  const bar = Math.floor(i / BEATS), b = i % BEATS, sec = MUS.section, ch = chordNotes(bar), root = PROG[bar % 16][0];
  const tones = [...ch.map(n => n + 12), ...ch.map(n => n + 24)], cont = CONTOUR[(bar * 3 + (bar >> 2)) % CONTOUR.length], mel = tones[Math.min(tones.length - 1, cont[b])];
  const L = { overture: 1, danse: 2, witch: 3, finale: 4, interlude: 0 }[sec] ?? 1;
  // pad: sustained chord each bar (all sections)
  if (b === 0) for (const n of ch) for (const d of [-5, 5]) T(mtof(n) * Math.pow(2, d / 1200), { type: 'sawtooth', t, dur: SPB * 3.1, a: 0.4, vol: L === 0 ? 0.012 : 0.016, lp: L >= 3 ? 1400 : 900 });
  if (L === 0) { if (b === 0) T(mtof(mel + 12), { type: 'sine', t, dur: 1.6, vol: 0.05 }); return; }               // interlude: music box only
  if (L === 1) { T(mtof(mel + 12), { type: 'sine', t, dur: 1.2, vol: 0.06 }); T(mtof(mel + 24), { type: 'sine', t, dur: 0.6, vol: 0.015 });   // overture: celesta
    if (b === 0) T(mtof(root - 12), { type: 'triangle', t, dur: SPB * 2.5, vol: 0.1, lp: 500 }); return; }
  // waltz body: bass on 1, chord stabs on 2 & 3, calliope melody, kick & hats
  if (b === 0) { T(mtof(root - 12), { type: 'triangle', t, dur: SPB * 0.9, vol: 0.22, lp: 700 }); T(120, { f2: 42, t, dur: 0.24, vol: 0.32 }); }
  else { for (const n of ch) T(mtof(n + 12), { type: 'square', t, dur: SPB * 0.45, vol: 0.022, lp: 1700 }); Nz({ t, dur: 0.04, vol: 0.035, type: 'highpass', f: 7000 }); }
  T(mtof(mel), { type: 'square', t, dur: SPB * 0.85, vol: 0.035, lp: 2600, vib: 5, vibRate: 6 }); T(mtof(mel + 12), { type: 'triangle', t, dur: SPB * 0.8, vol: 0.02 });
  if (L >= 3) { for (let k = 0; k < 2; k++) T(mtof(tones[(b * 2 + k + bar) % tones.length]), { type: 'sawtooth', t: t + k * SPB / 2, dur: SPB * 0.45, vol: 0.02, lp: 2200 });   // witch: arpeggios
    if (b === 0 && bar % 2 === 0) { T(70, { f2: 58, type: 'triangle', t, dur: 1.2, vol: 0.18 }); Nz({ t, dur: 0.5, vol: 0.08, type: 'lowpass', f: 300, brown: true }); } }
  if (L >= 4) { if (b === 0) for (const n of ch) for (const d of [-8, 0, 8]) T(mtof(n) * Math.pow(2, d / 1200), { type: 'sawtooth', t, dur: SPB * 0.7, a: 0.03, vol: 0.02, lp: 2400 });   // brass stabs
    if (bar % 8 === 7) for (let k = 0; k < 12; k++) T(66, { f2: 60, type: 'triangle', t: t + k * SPB / 4, dur: 0.18, vol: 0.06 + k * 0.008 });                              // timpani roll
    if (bar % 8 === 0 && b === 0) Nz({ t, dur: 2.6, vol: 0.12, type: 'highpass', f: 4000, a: 0.005 }); }                                                                 // crash
}

export { MUS, BPM, BEATS, SPB, time, beatTime, nowBeat, setSection, setMusicVolume, startMusic, stopMusic };
