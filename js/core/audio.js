import * as THREE from 'three';
import { R, TAU, V3, clamp, pick } from './utils.js';
import { camera } from './renderer.js';
import { COASTER, RIDES } from '../world/rides.js';
import { FIRE } from '../world/bonfire.js';
import { S } from '../game/play.js';
import { t } from './i18n.js';
import { launch } from '../game/pyro.js';

/* =========================================================================
   8. AUDIO — everything synthesized with the Web Audio API
   ========================================================================= */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const AU = {
  ctx: null, vol: 0.8, muted: false,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.rev = ctx.createConvolver(); this.rev.buffer = this.ir(3.6); this.revIn = ctx.createGain(); this.revIn.gain.value = 0.55; this.revIn.connect(this.rev); this.rev.connect(this.master);
    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate); const w = this.white.getChannelData(0); for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate); const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.ambience();
  },
  ir(sec) { const ctx = this.ctx, n = ctx.sampleRate * sec, buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.8); } return buf; },
  // a destination node, optionally positioned in the world (distance attenuation + stereo pan + distance reverb)
  bus(pos = null, vol = 1, wet = 0.25) {
    if (!this.ctx) return null; const ctx = this.ctx, g = ctx.createGain(); let pan = 0;
    if (pos) { const dx = pos.x - camera.position.x, dy = pos.y - camera.position.y, dz = pos.z - camera.position.z, d = Math.hypot(dx, dy, dz);
      vol *= 1 / (1 + Math.pow(d / 12, 1.7)); pan = clamp((dx * Math.cos(S.camYaw) - dz * Math.sin(S.camYaw)) / (d + 0.01), -1, 1) * 0.85; wet = Math.min(0.95, wet + d / 90); }
    g.gain.value = vol; const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.master);
    const s = ctx.createGain(); s.gain.value = wet; p.connect(s); s.connect(this.revIn); return g;
  },
  tone({ f = 440, f2 = 0, type = 'sine', t = 0, dur = 0.5, a = 0.01, vol = 0.3, out, vib = 0, vibRate = 5, lp = 0, curve = 'exp' }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f, t0); if (f2) (curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(f2, t0 + dur) : o.frequency.linearRampToValueAtTime(f2, t0 + dur));
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let n = o; if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    n.connect(g); g.connect(out || this.master); o.start(t0); o.stop(t0 + dur + 0.05); return o;
  },
  noise({ t = 0, dur = 0.3, vol = 0.3, type = 'lowpass', f = 1000, f2 = 0, q = 1, a = 0.005, out, brown = false }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + t, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = brown ? this.brown : this.white; fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(out || this.master); s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.05);
  },
  loopNoise(brown, type, f, q, vol, out) { const ctx = this.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = brown ? this.brown : this.white; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol; s.connect(fl); fl.connect(g); g.connect(out); s.start(); return { g, fl }; },
  ambience() {
    const ctx = this.ctx;
    const wind = this.loopNoise(true, 'bandpass', 480, 0.6, 0.22, this.master); wind.g.connect(this.revIn);
    const l1 = ctx.createOscillator(), l1g = ctx.createGain(); l1.frequency.value = 0.07; l1g.gain.value = 260; l1.connect(l1g); l1g.connect(wind.fl.frequency); l1.start();
    const l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = 0.045; l2g.gain.value = 0.1; l2.connect(l2g); l2g.connect(wind.g.gain); l2.start();
    // dark drone pad
    this.droneG = ctx.createGain(); this.droneG.gain.value = 0.045; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360;
    [55, 82.41, 110.3, 164.8, 130.8].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = R(-9, 9); o.connect(lp); o.start(); });
    const l3 = ctx.createOscillator(), l3g = ctx.createGain(); l3.frequency.value = 0.03; l3g.gain.value = 160; l3.connect(l3g); l3g.connect(lp.frequency); l3.start();
    lp.connect(this.droneG); this.droneG.connect(this.master); this.droneG.connect(this.revIn);
    // witching-hour choir cluster
    this.witchG = ctx.createGain(); this.witchG.gain.value = 0; const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 900;
    [73.4, 77.8, 110, 116.5, 146.8, 220, 233].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = R(-12, 12); o.connect(wl); o.start(); });
    wl.connect(this.witchG); this.witchG.connect(this.master); this.witchG.connect(this.revIn);
    this.callG = ctx.createGain(); this.callG.gain.value = 0; this.callG.connect(this.master); const cs = ctx.createGain(); cs.gain.value = 0.4; this.callG.connect(cs); cs.connect(this.revIn);
    this.fireG = ctx.createGain(); this.fireG.gain.value = 0; this.fireG.connect(this.master);
    this.rumble = this.loopNoise(true, 'lowpass', 140, 0.7, 0, this.master);
    this.heartG = ctx.createGain(); this.heartG.gain.value = 0; this.heartG.connect(this.master);
    this.rideWind = this.loopNoise(false, 'bandpass', 900, 0.6, 0, this.master);
    this.nextMeasure = ctx.currentTime + 0.5; this.measure = 0; this.nextBeat = 0; this.nextAmb = ctx.currentTime + 8; this.nextClack = 0; this.nextHeart = 0;
  },
  // per-frame: distance-mixed loops and schedulers
  update(dt) {
    if (!this.ctx) return; const ctx = this.ctx, now = ctx.currentTime, cp = camera.position;
    const dCar = Math.hypot(cp.x - 32, cp.z - 18); this.callG.gain.setTargetAtTime(0.9 / (1 + Math.pow(dCar / 14, 2)), now, 0.3);
    if (this.nextMeasure < now + 0.3) this.scheduleMeasure();
    const dFire = Math.hypot(cp.x + 40, cp.z - 32); this.fireG.gain.setTargetAtTime(1 / (1 + Math.pow(dFire / 7, 2)) * (0.7 + FIRE.boost * 0.3), now, 0.2);
    if (Math.random() < dt * 14) this.noise({ dur: R(0.02, 0.08), vol: R(0.1, 0.5), type: 'highpass', f: R(1500, 4000), out: this.fireG });
    if (Math.random() < dt * 2) this.noise({ dur: 0.4, vol: 0.15, type: 'lowpass', f: 300, brown: true, out: this.fireG });
    const dC = COASTER.cars ? camera.position.distanceTo(COASTER.cars[0].position) : 999, riding = S.mode === 'ride' && S.ride === RIDES.coaster;
    this.rumble.g.gain.setTargetAtTime((riding ? 0.5 : 0.6 / (1 + Math.pow(dC / 10, 2))) * COASTER.v / 16, now, 0.1);
    if (COASTER.lift && now > this.nextClack && dC < 70) { this.nextClack = now + 0.16; this.noise({ dur: 0.03, vol: riding ? 0.25 : 0.25 / (1 + dC / 8), type: 'bandpass', f: 2200, q: 4 }); }
    if (riding && COASTER.v > 15 && !COASTER.screamed) { COASTER.screamed = true; this.scream(null, 0.12); } if (COASTER.v < 8) COASTER.screamed = false;
    if (this.heartOn && now > this.nextHeart) { this.nextHeart = now + (S.chase ? 0.48 : 0.95); this.tone({ f: 58, f2: 40, dur: 0.18, vol: 0.6, out: this.heartG }); this.tone({ f: 52, f2: 38, t: 0.24, dur: 0.2, vol: 0.45, out: this.heartG }); }
    this.heartG.gain.setTargetAtTime(this.heartOn ? 0.5 : 0, now, 0.5);
    this.witchG.gain.setTargetAtTime(S.witch * 0.06 + (S.chase ? 0.05 : 0), now, 0.8);
    this.rideWind.g.gain.setTargetAtTime(S.mode === 'ride' ? clamp((S.rideSpeed - 2) / 25, 0, 0.45) : 0, now, 0.15);
    if (this.mbOn && this.mbPos) { if (!this.mbNext || this.mbNext < now) this.mbNext = now + 0.05;
      while (this.mbNext < now + 0.25) { const MB = [76, 79, 83, 81, 79, 76, 74, 76, 79, 83, 86, 84, 83, 79, 76, 72]; this.mbI = (this.mbI || 0) + 1; const n = MB[this.mbI % MB.length], o = this.bus(this.mbPos, 0.9, 0.6), tt = this.mbNext - now;
        this.tone({ f: mtof(n), t: tt, dur: 0.9, a: 0.004, vol: 0.06, out: o }); this.tone({ f: mtof(n + 12), t: tt, dur: 0.4, a: 0.004, vol: 0.02, out: o }); this.mbNext += 0.38; } }
    this.droneG.gain.setTargetAtTime(0.045 + S.indoor * 0.04, now, 1);
    if (now > this.nextAmb) { this.nextAmb = now + R(14, 30); const a = R(0, TAU), p = new V3(cp.x + Math.cos(a) * 60, 10, cp.z + Math.sin(a) * 60); pick([() => this.owl(p), () => this.howl(p), () => this.crow(p), () => this.owl(p)])(); }
  },
  scheduleMeasure() {
    const MEL = [[[69, 1], [72, 1], [76, 1]], [[74, 2], [72, 1]], [[71, 1], [74, 1], [77, 1]], [[76, 3]], [[72, 1], [76, 1], [81, 1]], [[80, 2], [76, 1]], [[77, 1], [76, 1], [74, 1]], [[72, 1], [71, 1], [69, 1]],
      [[69, 1], [72, 1], [76, 1]], [[79, 2], [77, 1]], [[76, 1], [74, 1], [72, 1]], [[71, 3]], [[72, 1], [71, 1], [69, 1]], [[68, 1], [71, 1], [74, 1]], [[72, 1.5], [71, 0.5], [68, 1]], [[69, 3]]];
    const BASS = [45, 50, 52, 45, 45, 52, 50, 45, 45, 48, 45, 52, 45, 52, 52, 45];
    const beat = 0.42, m = this.measure % 16, t0 = this.nextMeasure - this.ctx.currentTime, root = BASS[m];
    const tri = root === 52 || root === 48 ? [0, 4, 7] : [0, 3, 7];
    this.tone({ f: mtof(root), type: 'triangle', t: t0, dur: 0.38, vol: 0.12, out: this.callG });
    for (const b of [1, 2]) for (const iv of tri) this.tone({ f: mtof(root + 12 + iv), type: 'square', t: t0 + b * beat, dur: 0.16, vol: 0.018, lp: 1800, out: this.callG });
    let acc = 0; for (const [n, d] of MEL[m]) { this.tone({ f: mtof(n), type: 'square', t: t0 + acc * beat, dur: d * beat * 0.95, vol: 0.035, vib: 5, vibRate: 5.5, lp: 2600, out: this.callG });
      this.tone({ f: mtof(n + 12), type: 'sine', t: t0 + acc * beat, dur: d * beat * 0.9, vol: 0.025, out: this.callG }); acc += d; }
    this.measure++; this.nextMeasure += beat * 3;
  },
  // ---- one-shots ----
  bell(pos, base = 110, dur = 6, vol = 0.5) { const o = this.bus(pos, vol, 0.6);
    [[0.5, 0.5], [1, 1], [1.19, 0.5], [1.56, 0.4], [2, 0.35], [2.51, 0.25], [3.01, 0.18], [4.1, 0.1]].forEach(([r, a], i) => this.tone({ f: base * r, dur: dur / (1 + i * 0.35), a: 0.003, vol: a * 0.35, out: o }));
    this.noise({ dur: 0.08, vol: 0.3, type: 'bandpass', f: 2500, out: o }); },
  chime() { const o = this.bus(null, 0.6, 0.6); [76, 79, 83, 88, 91].forEach((n, i) => { this.tone({ f: mtof(n), type: 'triangle', t: i * 0.07, dur: 1.4, vol: 0.12, out: o }); this.tone({ f: mtof(n + 24), t: i * 0.07, dur: 0.8, vol: 0.03, out: o }); }); },
  shimmer(pos) { const o = this.bus(pos, 0.7, 0.8); for (let i = 0; i < 14; i++) this.tone({ f: mtof(pick([72, 75, 79, 82, 84, 87, 91])), t: i * 0.06, dur: 1.2, vol: 0.05, out: o }); },
  click() { if (!this.ctx) return; this.tone({ f: 1400, dur: 0.05, vol: 0.04 }); },
  lever() { this.noise({ dur: 0.12, vol: 0.4, type: 'bandpass', f: 1600, q: 3 }); this.tone({ f: 200, f2: 120, dur: 0.1, type: 'square', vol: 0.08 }); },
  whoosh(pos) { const o = this.bus(pos, 1, 0.3); this.noise({ dur: 1.0, vol: 0.5, type: 'bandpass', f: 300, f2: 2400, q: 1.5, a: 0.2, out: o }); this.noise({ dur: 1.4, vol: 0.4, type: 'lowpass', f: 200, brown: true, a: 0.1, out: o }); },
  step(wood) { if (!this.ctx) return; this.noise({ dur: 0.08, vol: wood ? 0.06 : 0.05, type: 'bandpass', f: wood ? R(250, 400) : R(500, 900), q: 1.2 });
    if (wood && Math.random() < 0.08) this.tone({ f: 140, f2: 95, type: 'sawtooth', dur: 0.45, vol: 0.02, lp: 600 }); },
  shot() { this.noise({ dur: 0.12, vol: 0.5, type: 'highpass', f: 900 }); this.tone({ f: 140, f2: 40, dur: 0.16, vol: 0.3 }); },
  hit(good = true) { this.noise({ dur: 0.08, vol: 0.4, type: 'bandpass', f: 700, q: 2 }); if (good) { this.tone({ f: 1320, type: 'triangle', dur: 0.4, vol: 0.12, t: 0.03 }); this.tone({ f: 1760, type: 'triangle', dur: 0.4, vol: 0.08, t: 0.09 }); } else this.tone({ f: 220, f2: 110, type: 'sawtooth', dur: 0.4, vol: 0.1, lp: 900 }); },
  doorSlam(pos) { const o = this.bus(pos, 1.4, 0.5); this.noise({ dur: 0.45, vol: 1, type: 'lowpass', f: 420, brown: true, out: o }); this.tone({ f: 70, f2: 38, dur: 0.6, vol: 0.8, out: o }); this.noise({ t: 0.04, dur: 0.25, vol: 0.25, type: 'bandpass', f: 2000, q: 3, out: o }); },
  whisper(pos) { const o = this.bus(pos, 1.2, 0.7); for (let i = 0; i < 9; i++) this.noise({ t: i * 0.22 + R(0, 0.1), dur: R(0.15, 0.35), vol: 0.18, type: 'bandpass', f: R(2500, 5000), q: 2.5, a: 0.05, out: o }); },
  scream(pos, vol = 0.3) { if (!this.ctx) return; const o = this.bus(pos, vol * 3, 0.5), ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(650, t0); osc.frequency.exponentialRampToValueAtTime(1350, t0 + 0.18); osc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.9); osc.frequency.exponentialRampToValueAtTime(520, t0 + 1.6);
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 7; lg.gain.value = 45; l.connect(lg); lg.connect(osc.frequency);
    const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 1500; b1.Q.value = 3; const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 3000; b2.Q.value = 5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.05); g.gain.setValueAtTime(0.5, t0 + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.7);
    osc.connect(b1); osc.connect(b2); b1.connect(g); b2.connect(g); g.connect(o); osc.start(t0); l.start(t0); osc.stop(t0 + 1.8); l.stop(t0 + 1.8);
    this.noise({ dur: 1.4, vol: 0.12, type: 'bandpass', f: 2500, q: 1, a: 0.05, out: o }); },
  jumpscare() { const o = this.bus(null, 1.2, 0.3); [37, 38, 43, 44, 61, 62].forEach(n => this.tone({ f: mtof(n), type: 'sawtooth', dur: 1.6, a: 0.005, vol: 0.12, out: o }));
    this.noise({ dur: 0.8, vol: 0.9, type: 'lowpass', f: 3000, out: o }); this.tone({ f: 60, f2: 30, dur: 1, vol: 0.9, out: o }); this.scream(null, 0.5); },
  drone(dur) { const o = this.bus(null, 0.8, 0.6); this.tone({ f: 41, f2: 82, dur, a: dur * 0.9, vol: 0.4, type: 'sawtooth', lp: 400, out: o, curve: 'lin' }); this.noise({ dur, vol: 0.2, a: dur * 0.9, type: 'bandpass', f: 400, f2: 3000, out: o }); },
  heart(on) { this.heartOn = on; },
  cackle(pos) { const o = this.bus(pos, 1.4, 0.5); for (let i = 0; i < 8; i++) { const t = i * 0.14, f = 520 - i * 22; this.tone({ f, f2: f * 0.8, type: 'sawtooth', t, dur: 0.11, vol: 0.12, lp: 1800, vib: 30, vibRate: 30, out: o }); } },
  thunder(d) { if (!this.ctx) return; const o = this.bus(null, clamp(1.6 - d / 300, 0.4, 1.4), 0.5); this.noise({ dur: 0.3, vol: 0.5, type: 'highpass', f: 900, out: o }); this.noise({ dur: 4.5, vol: 1, type: 'lowpass', f: 260, f2: 60, brown: true, a: 0.05, out: o });
    this.noise({ t: 0.6, dur: 3, vol: 0.6, type: 'lowpass', f: 160, brown: true, a: 0.3, out: o }); },
  owl(p) { const o = this.bus(p, 0.9, 0.6); this.tone({ f: 420, f2: 380, dur: 0.35, a: 0.06, vol: 0.12, out: o }); this.tone({ f: 400, f2: 350, t: 0.5, dur: 0.7, a: 0.08, vol: 0.12, out: o }); },
  howl(p) { if (!this.ctx) return; const o = this.bus(p, 0.7, 0.8), ctx = this.ctx, t0 = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t0); osc.frequency.linearRampToValueAtTime(600, t0 + 1); osc.frequency.linearRampToValueAtTime(540, t0 + 2.6); osc.frequency.linearRampToValueAtTime(380, t0 + 3.6);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.5); g.gain.setValueAtTime(0.12, t0 + 2.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.8);
    osc.connect(g); g.connect(o); osc.start(t0); osc.stop(t0 + 3.9); },
  crow(p) { const o = this.bus(p, 0.8, 0.5); for (let i = 0; i < 3; i++) this.tone({ f: 900, f2: 560, type: 'sawtooth', t: i * 0.35, dur: 0.22, vol: 0.08, lp: 1500, out: o }); },
  launch(p) { const o = this.bus(p, 1, 0.4); this.tone({ f: 400, f2: 1600, dur: 1.4, a: 0.1, vol: 0.05, out: o }); this.noise({ dur: 1.2, vol: 0.12, type: 'highpass', f: 3000, out: o }); },
  boom(p) { const d = p.distanceTo(camera.position), delay = d / 340;
    setTimeout(() => { const o = this.bus(p, 3.5, 0.6); this.noise({ dur: 1.8, vol: 0.9, type: 'lowpass', f: 380, brown: true, out: o }); this.tone({ f: 70, f2: 30, dur: 0.9, vol: 0.6, out: o });
      for (let i = 0; i < 16; i++) this.noise({ t: 0.3 + R(0, 1.2), dur: 0.03, vol: 0.2, type: 'highpass', f: 3000, out: o }); }, delay * 1000); },
  organ(notes, t, dur, vol = 0.07) { const o = this.bus(new V3(14.3, 3, -83.5), 1.6, 0.85); for (const n of notes) { this.tone({ f: mtof(n), type: 'sawtooth', t, dur, a: 0.03, vol, lp: 2200, out: o }); this.tone({ f: mtof(n - 12), type: 'square', t, dur, a: 0.03, vol: vol * 0.6, lp: 1200, out: o }); } },
  gulp() { for (let i = 0; i < 3; i++) this.tone({ f: 320, f2: 140, t: i * 0.28, dur: 0.2, vol: 0.15 }); for (let i = 0; i < 6; i++) this.tone({ f: R(300, 900), t: 0.9 + i * 0.08, dur: 0.06, vol: 0.06 }); },
  candy(n) { const f = mtof(84 + Math.min(n - 1, 12)); this.tone({ f, type: 'triangle', dur: 0.18, vol: 0.08 }); this.tone({ f: f * 2, dur: 0.1, vol: 0.03, t: 0.04 }); },
  banish(pos) { const o = this.bus(pos, 1, 0.7); this.noise({ dur: 1.2, vol: 0.3, type: 'bandpass', f: 400, f2: 4000, q: 2, a: 0.9, out: o }); [79, 83, 86, 91].forEach((n, i) => this.tone({ f: mtof(n), t: 1 + i * 0.05, dur: 1, vol: 0.06, out: o })); },
  kick(pos) { const o = this.bus(pos, 1, 0.2); this.tone({ f: 120, f2: 60, dur: 0.15, vol: 0.5, out: o }); this.noise({ dur: 0.08, vol: 0.4, type: 'lowpass', f: 900, out: o }); },
  thud(pos, v = 0.4) { const o = this.bus(pos, v, 0.2); this.tone({ f: 90, f2: 50, dur: 0.12, vol: 0.4, out: o }); },
  splat(pos) { const o = this.bus(pos, 1.2, 0.3); this.noise({ dur: 0.35, vol: 0.7, type: 'lowpass', f: 1400, f2: 200, out: o }); this.tone({ f: 160, f2: 50, dur: 0.25, vol: 0.4, out: o }); for (let i = 0; i < 6; i++) this.noise({ t: 0.05 + i * 0.04, dur: 0.05, vol: 0.15, type: 'bandpass', f: R(600, 1600), q: 3, out: o }); },
  crash(pos) { const o = this.bus(pos, 1.6, 0.5); this.noise({ dur: 1.2, vol: 1, type: 'lowpass', f: 2500, f2: 300, out: o }); this.tone({ f: 55, f2: 30, dur: 0.8, vol: 0.8, out: o }); for (let i = 0; i < 18; i++) this.tone({ f: R(2000, 5000), t: R(0, 0.9), dur: R(0.1, 0.4), vol: 0.04, type: 'triangle', out: o }); },
  giggle(pos) { const o = this.bus(pos, 1.3, 0.7); for (let i = 0; i < 5; i++) this.tone({ f: 980 - i * 30, f2: 820 - i * 30, type: 'triangle', t: i * 0.13, dur: 0.1, vol: 0.09, vib: 40, vibRate: 22, out: o }); },
  stinger() { const o = this.bus(null, 1, 0.5); [49, 50, 55, 56, 61, 62, 68].forEach(n => this.tone({ f: mtof(n), type: 'sawtooth', dur: 2.2, a: 0.02, vol: 0.05, lp: 3000, out: o })); this.noise({ dur: 0.5, vol: 0.4, type: 'highpass', f: 2000, out: o }); },
  rattle(pos) { const o = this.bus(pos, 1.2, 0.3); for (let i = 0; i < 14; i++) this.noise({ t: i * 0.035 + R(0, 0.02), dur: 0.03, vol: 0.3, type: 'bandpass', f: R(1500, 3500), q: 6, out: o }); },
  flutter(pos) { const o = this.bus(pos, 1, 0.4); for (let i = 0; i < 20; i++) this.noise({ t: i * 0.06, dur: 0.05, vol: 0.18, type: 'bandpass', f: R(800, 2200), q: 1.5, out: o }); },
  creak(pos) { const o = this.bus(pos, 1, 0.5); this.tone({ f: 160, f2: 110, type: 'sawtooth', dur: 1.1, vol: 0.06, lp: 700, vib: 12, vibRate: 9, out: o }); },
  brake(pos) { const o = this.bus(pos, 1.2, 0.3); this.noise({ dur: 1.6, vol: 0.4, type: 'bandpass', f: 1800, f2: 600, q: 4, out: o }); },
  hiss(pos) { const o = this.bus(pos, 1.2, 0.3); this.noise({ dur: 1.3, vol: 0.4, type: 'highpass', f: 3000, a: 0.05, out: o }); this.noise({ t: 0.2, dur: 0.9, vol: 0.25, type: 'bandpass', f: 5000, q: 2, out: o }); },
  bump(pos, v) { const o = this.bus(pos, clamp(v / 4, 0.3, 1.4), 0.2); this.tone({ f: 110, f2: 55, dur: 0.2, vol: 0.5, out: o }); this.noise({ dur: 0.12, vol: 0.4, type: 'lowpass', f: 1200, out: o }); this.noise({ t: 0.02, dur: 0.15, vol: 0.12, type: 'highpass', f: 5000, out: o }); },
  horn() { [64, 67].forEach(n => this.tone({ f: mtof(n), type: 'square', dur: 0.35, vol: 0.06, lp: 2000 })); },
  hum(on) { if (!this.ctx) return; if (!this.humN) { const ctx = this.ctx; this.humN = ctx.createGain(); this.humN.gain.value = 0; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; o.connect(lp); lp.connect(this.humN); this.humN.connect(this.master); o.start(); }
    this.humN.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.3); },
  whinny(pos) { const o = this.bus(pos, 1, 0.4); this.tone({ f: 700, f2: 1100, type: 'sawtooth', dur: 0.3, vol: 0.06, lp: 2400, vib: 60, vibRate: 18, out: o }); this.tone({ f: 1050, f2: 500, type: 'sawtooth', t: 0.28, dur: 0.8, vol: 0.06, lp: 2400, vib: 70, vibRate: 16, out: o }); },
  bonk(pos) { const o = this.bus(pos, 1, 0.2); this.tone({ f: 420, f2: 160, dur: 0.18, vol: 0.4, type: 'triangle', out: o }); this.noise({ dur: 0.06, vol: 0.4, type: 'bandpass', f: 900, out: o }); },
  throwIt() { this.noise({ dur: 0.35, vol: 0.25, type: 'bandpass', f: 600, f2: 1800, q: 1.2 }); },
  boardBell() { this.tone({ f: 1320, dur: 0.6, vol: 0.06, type: 'triangle' }); this.tone({ f: 990, t: 0.15, dur: 0.8, vol: 0.06, type: 'triangle' }); },
  musicBox(on, pos) { this.mbOn = on; this.mbPos = pos; },
  // crowd of phantom hands: hundreds of tiny band-passed clicks with a swelling envelope
  applause(pos, sec = 3.5) { const o = this.bus(pos, 1.3, 0.5); if (!o) return;
    for (let i = 0; i < sec * 60; i++) { const k = i / (sec * 60), env = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - Math.pow(k, 3));
      this.noise({ t: k * sec + R(0, 0.02), dur: 0.025, vol: 0.14 * env + 0.02, type: 'bandpass', f: R(900, 2600), q: 2.5, out: o }); }
    this.noise({ dur: sec, vol: 0.06, type: 'bandpass', f: 1400, q: 0.7, a: 0.4, out: o }); },
  // eerie choir: stacked detuned "ah" voices through a formant-ish lowpass
  choir(pos, sec = 6) { const o = this.bus(pos, 1.4, 0.8); if (!o) return;
    [[57, 64, 69], [55, 62, 67], [53, 60, 69], [52, 59, 64, 68]].forEach((ch, i) => ch.forEach(n => { for (const d of [-6, 6])
      this.tone({ f: mtof(n) * Math.pow(2, d / 1200), type: 'sawtooth', t: i * sec / 4, dur: sec / 4 + 0.8, a: 0.6, vol: 0.022, lp: 1100, vib: 3, vibRate: 5, out: o }); })); },
  // colossal roar: low growl sweep + breathy noise
  roar(pos) { const o = this.bus(pos, 2.2, 0.6); if (!o) return;
    this.tone({ f: 70, f2: 38, type: 'sawtooth', dur: 2.4, a: 0.15, vol: 0.5, lp: 420, vib: 9, vibRate: 13, out: o });
    this.tone({ f: 104, f2: 52, type: 'square', dur: 2.0, a: 0.2, vol: 0.18, lp: 600, vib: 14, vibRate: 7, out: o });
    this.noise({ dur: 2.4, vol: 0.5, type: 'lowpass', f: 900, f2: 200, a: 0.12, brown: true, out: o }); },
  // ---- fireworks: an output chain modelled on outdoor propagation — 1/(1+d/70) loudness, air absorption (lowpass
  // falling with distance), stereo pan, more reverb far away; returns the node plus the sound-travel delay (343 m/s)
  fwOut(pos, vol = 1) {
    if (!this.ctx) return null; const ctx = this.ctx, dx = pos.x - camera.position.x, dy = pos.y - camera.position.y, dz = pos.z - camera.position.z, d = Math.hypot(dx, dy, dz);
    const g = ctx.createGain(); g.gain.value = vol / (1 + d / 70); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380 + 15000 * Math.exp(-d / 110);
    const pn = ctx.createStereoPanner(); pn.pan.value = clamp((dx * Math.cos(S.camYaw) - dz * Math.sin(S.camYaw)) / (d + 0.01), -1, 1) * 0.8;
    g.connect(lp); lp.connect(pn); pn.connect(this.master); const w = ctx.createGain(); w.gain.value = Math.min(0.9, 0.25 + d / 260); pn.connect(w); w.connect(this.revIn);
    setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (d / 343 + 9) * 1000); return { o: g, delay: d / 343 };
  },
  fwLaunch(pos, whistle) { const b = this.fwOut(pos, 1.1); if (!b) return; const { o, delay: t } = b;
    this.tone({ f: 95, f2: 38, dur: 0.22, vol: 0.55, t, out: o }); this.noise({ dur: 0.18, vol: 0.5, type: 'lowpass', f: 700, t, out: o });          // mortar thump
    if (whistle) { this.tone({ f: R(800, 1100), f2: R(2300, 3000), dur: 1.7, a: 0.08, vol: 0.09, t: t + 0.05, vib: 45, vibRate: 7, out: o, curve: 'lin' }); this.noise({ dur: 1.6, vol: 0.05, type: 'bandpass', f: 2600, q: 3, t, out: o }); }
    else this.noise({ dur: 1.5, vol: 0.12, type: 'bandpass', f: 900, f2: 3800, q: 0.8, a: 0.05, t, out: o });                                               // rising rocket hiss
  },
  fwBoom(pos, size = 1) { const b = this.fwOut(pos, 1.6 * Math.min(size, 2.4)); if (!b) return; const { o, delay: t } = b, L = 1.1 + size * 0.6;
    this.noise({ dur: 0.05, vol: 0.9, type: 'highpass', f: 1800, t, out: o });                                                                              // the crack
    this.noise({ dur: L, vol: 1.0, type: 'lowpass', f: 1400, f2: 90, brown: true, t, out: o });                                                              // the body
    this.tone({ f: 62, f2: 24, dur: L * 0.8, vol: 0.7, t, out: o }); this.tone({ f: 120, f2: 40, dur: 0.35, vol: 0.25, type: 'triangle', t, out: o });
    this.noise({ dur: L * 1.6, vol: 0.18, type: 'lowpass', f: 300, f2: 60, brown: true, t: t + 0.25, a: 0.2, out: o });                                        // rolling echo off the hills
  },
  fwPop(pos) { const b = this.fwOut(pos, 0.7); if (!b) return; this.noise({ dur: 0.06, vol: 0.7, type: 'bandpass', f: R(900, 1600), q: 1.5, t: b.delay, out: b.o }); this.tone({ f: 180, f2: 70, dur: 0.12, vol: 0.2, t: b.delay, out: b.o }); },
  fwCrackle(pos, start, dur, n = 60) { const b = this.fwOut(pos, 0.9); if (!b) return;
    for (let i = 0; i < n; i++) { const tt = b.delay + start + Math.pow(Math.random(), 0.7) * dur; this.noise({ dur: R(0.008, 0.022), vol: R(0.15, 0.55), type: 'bandpass', f: R(2200, 6500), q: R(2, 6), t: tt, out: b.o }); } },
  fwSizzle(pos, start, dur) { const b = this.fwOut(pos, 0.6); if (!b) return; this.noise({ dur, vol: 0.12, type: 'highpass', f: 5200, a: 0.4, t: b.delay + start, out: b.o }); },
  thump(pos, k = 1) { const o = this.bus(pos, 2 * k, 0.7); if (!o) return; this.tone({ f: 60, f2: 24, dur: 1.6, vol: 0.7, out: o }); this.noise({ dur: 1.4, vol: 0.5, type: 'lowpass', f: 500, f2: 80, brown: true, out: o }); },
};

export { mtof, AU };
