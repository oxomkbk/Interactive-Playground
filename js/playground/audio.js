/* =========================================================================
   AUDIO — all synthesized. One waltz in F major, arranged three ways and cross-faded with the time of day:
   DAY — bright celesta melody, plucked chords, a warm bass, 92 BPM · SUNSET — slower (80 BPM), the melody an
   octave down over warm detuned string pads · NIGHT — 70 BPM, a high music box over harp arpeggios and pads.
   A brighter "show" arrangement plays during fountain shows. Ambience: birdsong by day, crickets at night, a
   crowd murmur that follows how many visitors are near you, wind with the weather, rain, the fountain, and a
   band organ that swells as you approach the carousel. Rides add their own rush of wind.
   Places have their own sound: a busker's fiddle plays a harmony to the waltz beside the plaza juggler, water
   laps along Moonmere's shore, and the coaster rumbles over the trees as you near Thrill Corner.
   ========================================================================= */
const AU = { ctx: null, master: null, vol: 0.8, night: 0, mood: 1, show: 0, organ: 0, levels: { music: 0.55, ambience: 0.8, sfx: 0.8 } };
try { Object.assign(AU.levels, JSON.parse(localStorage.getItem('sweetheart-levels') || '{}')); } catch (e) {}
try { const v = parseFloat(localStorage.getItem('sweetheart-vol')); if (v >= 0 && v <= 1) AU.vol = v; } catch (e) {}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// melody as [midi, beats]; 3/4 at 92 BPM, sixteen bars, then it loops
const MEL = [[69, 2], [72, 1], [77, 2], [76, 1], [74, 1], [72, 1], [69, 1], [72, 3], [70, 2], [74, 1], [79, 2], [77, 1], [76, 1], [74, 1], [70, 1], [72, 3],
  [69, 1], [72, 1], [77, 1], [81, 2], [79, 1], [77, 1], [76, 1], [74, 1], [72, 2], [69, 1], [70, 1], [74, 1], [79, 1], [77, 1], [76, 1], [79, 1], [77, 3], [0, 3]];
const CH = [[41, 57, 60], [38, 57, 62], [34, 58, 62], [36, 60, 64], [43, 58, 62], [36, 60, 64], [36, 58, 64], [41, 57, 60],
  [41, 57, 60], [45, 60, 64], [38, 57, 62], [41, 57, 60], [43, 58, 62], [36, 60, 64], [41, 57, 60], [41, 57, 60]];
let BEAT = 60 / 92;
const bpmFor = (m) => (m < 1 ? 92 - 12 * m : 80 - 10 * (m - 1));
const W = () => { const m = AU.mood; return { day: Math.max(0, 1 - m), sunset: 1 - Math.min(1, Math.abs(m - 1)), night: Math.max(0, m - 1) }; };

function init() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  const ctx = AU.ctx = new C();
  const master = AU.master = ctx.createGain(); master.gain.value = AU.muted ? 0 : AU.vol;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination);
  // a soft "room": two feedback delays, low-passed
  const wet = AU.wet = ctx.createGain(); wet.gain.value = 0.35;
  for (const [dt, fb] of [[0.23, 0.32], [0.37, 0.28]]) { const d = ctx.createDelay(1), g = ctx.createGain(), lp = ctx.createBiquadFilter(); d.delayTime.value = dt; g.gain.value = fb; lp.type = 'lowpass'; lp.frequency.value = 2600;
    wet.connect(d); d.connect(lp); lp.connect(g); g.connect(d); lp.connect(master); }
  AU.music = ctx.createGain(); AU.music.gain.value = AU.levels.music; AU.music.connect(master); AU.music.connect(wet);
  AU.sfx = ctx.createGain(); AU.sfx.gain.value = AU.levels.sfx; AU.sfx.connect(master); AU.sfx.connect(wet);
  AU.amb = ctx.createGain(); AU.amb.gain.value = AU.levels.ambience; AU.amb.connect(master);
  // looping beds: rain (low-passed noise) and the fountain (band-passed noise), faded by setBeds()
  const bed = (f, q, type) => { const len = 2, b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(AU.amb); s.start(); return g; };
  AU.rainBed = bed(1400, 0.4, 'lowpass'); AU.waterBed = bed(1800, 0.8, 'bandpass');
  AU.crowdBed = bed(520, 0.6, 'bandpass'); AU.windBed = bed(380, 0.3, 'lowpass'); AU.rushBed = bed(900, 0.5, 'bandpass');
  AU.organOut = ctx.createGain(); AU.organOut.gain.value = 0; AU.organOut.connect(AU.music);
  { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.7; AU.buskOut = ctx.createGain(); AU.buskOut.gain.value = 0; AU.buskOut.connect(lp); lp.connect(AU.music); lp.connect(AU.wet); }
  AU.lakeBed = bed(320, 0.9, 'lowpass'); AU.rumbleBed = bed(110, 1.2, 'lowpass');
  scheduler();
}
function tone(f, t0, dur, { type = 'sine', gain = 0.2, attack = 0.005, out = AU.music, partials = null, detune = 0 } = {}) {
  const ctx = AU.ctx, g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); g.connect(out);
  for (const [mul, a] of partials || [[1, 1]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; o.detune.value = detune; og.gain.value = a; o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + dur + 0.05); }
}
const bell = (m, t0, g = 0.16, d = 1.6) => tone(mtof(m), t0, d, { gain: g, partials: [[1, 1], [2, 0.32], [3.01, 0.12], [4.2, 0.05]] });
// warm string pad: three detuned saws per note through a soft low-pass, slow attack
function pad(notes, t0, dur, gain) { const ctx = AU.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.4;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35); g.gain.linearRampToValueAtTime(0, t0 + dur); f.connect(g); g.connect(AU.music);
  for (const m of notes) for (const dt of [-7, 0, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12); o.detune.value = dt; o.connect(f); o.start(t0); o.stop(t0 + dur + 0.05); } }
const pluck = (m, t0, g = 0.06) => tone(mtof(m), t0, 0.9, { type: 'triangle', gain: g, attack: 0.008 });

let next = 0, mi = 0, beatInMel = 0, bar = 0, beatInBar = 0;
function scheduler() {
  const ctx = AU.ctx; next = ctx.currentTime + 0.1;
  setInterval(() => {
    while (next < ctx.currentTime + 0.25) {
      // melody: one note may span several beats
      const w = W(), show = AU.show > 0 ? 1 : 0; BEAT = 60 / (bpmFor(AU.mood) + show * 18);
      if (beatInMel === 0) { const [m, b] = MEL[mi];
        if (m) { const d = b * BEAT;
          if (w.day + show > 0.02) bell(m, next, 0.13 * Math.min(1, w.day + show), d + 1.2);
          if (w.sunset > 0.02 && !show) bell(m - 12, next, 0.12 * w.sunset, d + 1.8);
          if (w.night > 0.02 && !show) tone(mtof(m + 12), next, d + 1.4, { gain: 0.07 * w.night, partials: [[1, 1], [3.01, 0.25], [5.2, 0.08]] });   // music box
          if (AU.organ > 0.02) tone(mtof(m), next, d * 0.9, { type: 'square', gain: 0.025, attack: 0.01, out: AU.organOut, partials: [[1, 1], [2, 0.5], [4, 0.25]] });
          if (AU.busk > 0.02) { const v = (Math.random() - 0.5) * 14; tone(mtof(m - 5), next, d * 0.97 + 0.15, { type: 'sawtooth', gain: 0.02, attack: 0.07, out: AU.buskOut, detune: v, partials: [[1, 1], [2, 0.35], [3, 0.12]] }); } }   // the busker's fiddle, a fourth below
        beatInMel = b; mi = (mi + 1) % MEL.length; }
      const ch = CH[bar % CH.length];
      if (beatInBar === 0) { tone(mtof(ch[0]), next, BEAT * 2.6, { gain: 0.12 * (1 - w.night * 0.4), attack: 0.02, partials: [[1, 1], [2, 0.2]] });
        if (w.sunset + w.night > 0.05 && !show) pad(ch, next, BEAT * 3.3, 0.035 * (w.sunset + w.night * 0.8)); }
      else if (w.night > 0.4 && !show) { [ch[1], ch[2], ch[1] + 12].forEach((m, i) => tone(mtof(m + 12), next + i * BEAT / 3, 1.4, { type: 'triangle', gain: 0.04 * w.night, attack: 0.004 })); }   // harp
      else { const g = 0.06 * (1 - w.night) * (1 + show * 0.4); pluck(ch[1], next, g); pluck(ch[2], next + 0.012, g); if (show) pluck(ch[2] + 12, next + BEAT / 2, g); }
      beatInMel--; next += BEAT; if (++beatInBar === 3) { beatInBar = 0; bar++; }
      ambience(next);
    }
  }, 60);
}
let birdT = 0, crickT = 0;
function ambience(t) {
  const ctx = AU.ctx;
  if (t > birdT && AU.night < 0.5) { birdT = t + 1.5 + Math.random() * 4;
    const f0 = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.11; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), s + 0.07);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09); o.connect(g); g.connect(AU.amb); o.start(s); o.stop(s + 0.12); } }
  if (t > crickT && AU.night > 0.5) { crickT = t + 0.6 + Math.random() * 1.2;
    for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 200, t + i * 0.05, 0.035, { gain: 0.012, out: AU.amb }); }
}

const SFX = {
  setNight(v) { AU.night = v; },
  letter() { if (!AU.ctx) return; const t = AU.ctx.currentTime; [72, 76, 79, 84, 88].forEach((m, i) => bell(m, t + i * 0.07, 0.12, 1.2)); },
  ride() { if (!AU.ctx) return; const t = AU.ctx.currentTime; [79, 84].forEach((m, i) => bell(m, t + i * 0.09, 0.1, 0.8)); },
  wish() { if (!AU.ctx) return; const t = AU.ctx.currentTime; for (let i = 0; i < 4; i++) tone(mtof(84), t + i * 0.55, 3, { gain: 0.14 - i * 0.025, partials: [[1, 1], [2.76, 0.4], [5.4, 0.15]], out: AU.sfx }); [65, 69, 72, 77].forEach((m, i) => bell(m + 12, t + 0.3 + i * 0.12, 0.08, 2.5)); },
  slide() { if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime, len = 2.2, b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1600, t + len * 0.7);
    g.gain.value = 0.18; s.connect(f); f.connect(g); g.connect(AU.sfx); s.start(t); },
  pop() { if (!AU.ctx) return; const t = AU.ctx.currentTime; bell(84, t, 0.07, 0.4); },
  coin() { if (!AU.ctx) return; const t = AU.ctx.currentTime; bell(91, t, 0.08, 0.5); bell(96, t + 0.08, 0.06, 0.6); },
  splash() { noise(0.6, 900, 2400, 0.12, 0.8); },
  whoosh() { noise(0.4, 600, 2200, 0.1, 1.5); },
  whee() { noise(0.7, 500, 1800, 0.06, 1.2); if (AU.ctx) { const t = AU.ctx.currentTime; [76, 79, 84].forEach((m, i) => bell(m, t + i * 0.06, 0.05, 0.6)); } },
  ding() { if (!AU.ctx) return; const t = AU.ctx.currentTime; bell(88, t, 0.12, 1.4); bell(95, t + 0.1, 0.08, 1.4); },
  clink() { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(2400, t, 0.12, { type: 'triangle', gain: 0.04, out: AU.sfx }); tone(3100, t + 0.05, 0.1, { type: 'triangle', gain: 0.03, out: AU.sfx }); },
  whir() { if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(90, t + 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 1.3); o.connect(g); g.connect(AU.sfx); o.start(t); o.stop(t + 1.4); },
  launch() { noise(0.9, 1800, 5000, 0.05, 1.0); },
  boom() { if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime + 0.25, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); o.connect(g); g.connect(AU.sfx); o.start(t); o.stop(t + 1.3);
    noise(1.4, 300, 900, 0.18, 0.3, 0.25); [0.4, 0.55, 0.7, 0.8].forEach(d => noise(0.08, 3000, 6000, 0.03, 1, 0.25 + d)); },
  fanfare() { if (!AU.ctx) return; const t = AU.ctx.currentTime; [[65, 0], [69, 0.15], [72, 0.3], [77, 0.45], [81, 0.75], [84, 1.05]].forEach(([m, d]) => bell(m, t + d, 0.14, 2.2)); [53, 57, 60].forEach(m => tone(mtof(m), t + 1.05, 3, { gain: 0.07, out: AU.sfx })); },
};
// a filtered noise burst: duration, band from f0 to f1, gain, Q, delay
function noise(len, f0, f1, gain, q = 1, delay = 0) {
  if (!AU.ctx) return; const ctx = AU.ctx, t = ctx.currentTime + delay, b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f1, t + len);
  g.gain.value = gain; s.connect(f); f.connect(g); g.connect(AU.sfx); s.start(t);
}
// independent channel levels (music, ambience, effects), saved per visitor
function setLevel(ch, v) { AU.levels[ch] = v; const node = { music: AU.music, ambience: AU.amb, sfx: AU.sfx }[ch]; if (node) node.gain.value = v; try { localStorage.setItem('sweetheart-levels', JSON.stringify(AU.levels)); } catch (e) {} }
// ambience beds follow the world: rain strength and how close the camera is to the fountain
function setBeds(rain, water, { crowd = 0, wind = 0, organ = 0, rush = 0, mood = AU.mood, show = 0, busk = 0, lake = 0, rumble = 0 } = {}) { if (!AU.ctx) return; const t = AU.ctx.currentTime;
  AU.busk = busk; AU.buskOut.gain.setTargetAtTime(busk, t, 0.6); AU.lakeBed.gain.setTargetAtTime(lake * (0.05 + 0.03 * Math.sin(t * 0.7) * Math.sin(t * 1.9)), t, 0.5); AU.rumbleBed.gain.setTargetAtTime(rumble * 0.22, t, 0.25);
  AU.rainBed.gain.setTargetAtTime(rain * 0.22, t, 0.4); AU.waterBed.gain.setTargetAtTime(water * 0.09, t, 0.3);
  AU.crowdBed.gain.setTargetAtTime(Math.min(1, crowd) * 0.05 * (1 - Math.max(0, mood - 1) * 0.5), t, 0.8); AU.windBed.gain.setTargetAtTime(wind * 0.05, t, 1); AU.rushBed.gain.setTargetAtTime(rush * 0.16, t, 0.3);
  AU.organ = organ; AU.organOut.gain.setTargetAtTime(organ, t, 0.5); AU.mood = mood; AU.show = show; }
function setMuted(m) { AU.muted = m; if (AU.master) AU.master.gain.value = m ? 0 : AU.vol; try { localStorage.setItem('sweetheart-muted', m ? '1' : '0'); } catch (e) {} }
try { AU.muted = localStorage.getItem('sweetheart-muted') === '1'; } catch (e) {}
function setVolume(v) { AU.vol = v; if (AU.master && !AU.muted) AU.master.gain.value = v; try { localStorage.setItem('sweetheart-vol', String(v)); } catch (e) {} }

export { AU, init as initAudio, SFX, setVolume, setMuted, setLevel, setBeds };
