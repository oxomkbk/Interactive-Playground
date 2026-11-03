/* =========================================================================
   MOONLIGHT STAGE — the festival district's open-air stage: a silver truss arch, velvet side curtains, a
   living LED wall (a shader that pulses to the beat), sweeping spotlight beams, speaker stacks and a neon heart.
   Two experiences:
   • Dance! — a rhythm game on the park's own music clock: arrows fall in four lanes; hit ← ↓ ↑ → (or D F J K)
     as they cross the line. Perfect / Good / Miss, combos, a score; the stage lights flash with every hit and
     throws confetti on big combos.
   • Light show — spotlights go wild and fireworks fill the sky above the stage.
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, R, rand } from '../core/geo.js';
import { paint, gold, silver, stone, fabric, matte, glow } from '../core/materials.js';
import { attraction, hitBox } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
const BEAT = 60 / 92, LANES = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'], ALT = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };

export function create({ x, z, lights } = {}) {
  const root = new THREE.Group(); root.name = 'stage'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const c = { cast: true }, B = createBatch('stage'), W = 14;
  B.add(rbox(W + 2, 1.2, 9, 0.12), stone(3, '#D9CBB9'), [0, 0.6, 0], c);
  B.add(rbox(W, 0.12, 8, 0.04), new THREE.MeshPhysicalMaterial({ color: '#2B2038', roughness: 0.15, clearcoat: 1 }), [0, 1.26, 0]);
  for (let i = 0; i < 4; i++) B.add(rbox(4, 0.2, 0.7, 0.05), stone(1, '#D9CBB9'), [0, 0.1 + i * 0.3, 4.9 + (3 - i) * 0.5]);
  // truss arch
  const tr = silver();
  for (const s of [-1, 1]) for (const dz of [-3.6, -2.8]) B.add(rodGeo(V(s * (W / 2 - 0.3), 1.2, dz), V(s * (W / 2 - 0.3), 9, dz), 0.1, 8), tr, null, c);
  for (const dz of [-3.6, -2.8]) B.add(rodGeo(V(-W / 2 + 0.3, 9, dz), V(W / 2 - 0.3, 9, dz), 0.1, 8), tr, null, c);
  for (let i = 0; i <= 14; i++) B.add(rodGeo(V(-W / 2 + 0.3 + i * (W - 0.6) / 14, 9, -3.6), V(-W / 2 + 0.3 + i * (W - 0.6) / 14, 9, -2.8), 0.04, 4), tr);
  // curtains & speakers
  for (const s of [-1, 1]) { B.add(new THREE.PlaneGeometry(2.2, 7.6, 10, 1).translate(s * (W / 2 - 1.3), 5.0, -2.4), fabric('#7A3E6E', '#68335E', 22, 1, 1), null, c);
    for (let k = 0; k < 2; k++) { B.add(rbox(1.4, 1.5, 1.2, 0.1), matte('#2B2038', 0.6), [s * (W / 2 + 0.2), 1.95 + k * 1.55, 2.6], c); B.add(new THREE.CircleGeometry(0.45, 24), matte('#4A3A5C', 0.4), [s * (W / 2 + 0.2), 1.95 + k * 1.55, 3.21]); } }
  B.add(heartGeo(0.9, 0.2), glow('#FF8FBF', 3, 0.6), [0, 10.2, -3.2]);
  B.build(root);
  // LED wall: pastel waves that pulse on every beat and flare on every hit
  const U = { uTime: { value: 0 }, uPulse: { value: 0 }, uHit: { value: 0 } };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W - 3, 6.5), new THREE.ShaderMaterial({ uniforms: U, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`uniform float uTime, uPulse, uHit; varying vec2 vUv;
      void main(){ vec2 g = floor(vUv * vec2(48.0, 24.0)) / vec2(48.0, 24.0); float w = sin(g.x * 9.0 + uTime * 1.3) * 0.5 + sin(g.y * 7.0 - uTime * 0.9 + g.x * 3.0) * 0.5;
        vec3 a = vec3(1.0, 0.55, 0.75), b = vec3(0.7, 0.55, 1.0), c = vec3(1.0, 0.85, 0.55); vec3 col = mix(mix(a, b, smoothstep(-0.6, 0.6, w)), c, smoothstep(0.7, 1.0, w));
        float px = smoothstep(0.5, 0.35, length(fract(vUv * vec2(48.0, 24.0)) - 0.5)); float heart = 0.0;
        gl_FragColor = vec4(col * px * (0.55 + uPulse * 0.6 + uHit * 1.4), 1.0); }` }));
  wall.position.set(0, 5.0, -3.15); root.add(wall);
  // spotlight beams (additive cones) hung from the truss
  const beamMat = new THREE.MeshBasicMaterial({ color: '#FFD9EC', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beams = [-5, -2.5, 0, 2.5, 5].map((bx, i) => { const g = new THREE.Group(); g.position.set(bx, 8.9, -3.2); root.add(g);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 24, 1, true).translate(0, -4.5, 0), beamMat.clone()); g.add(cone); return { g, cone, ph: i * 1.3 }; });
  const spot = lights && lights.addLocal(V(x, 7, z), '#FFB8E6', 40, 22);

  const S = { mode: 'idle', t0: 0, now: 0, notes: [], score: 0, combo: 0, best: 0, judge: '', judgeT: 0, show: 0, pulse: 0, hit: 0, beatI: 0 };
  const a = attraction({ id: 'stage', kind: 'game', name: 'Moonlight Stage', icon: '💃', zone: 'Festival District',
    desc: 'The festival stage. Dance! is a rhythm game set to the park’s waltz — hit the arrows on the beat. Or start a light show and fill the sky with fireworks.',
    object3D: root, focus: { target: [x, 4, z], dist: 24, height: 4 } });
  a.hits = [hitBox(root, W + 3, 11, 10, 0)];
  a.playLabel = 'Dance!';
  a.secondary = { label: 'Light show', run: () => { S.show = 14; a.fx && a.fx.show && a.fx.show(12, V(0, 30, -10).applyMatrix4(root.matrixWorld)); a.sfx && a.sfx.fanfare && a.sfx.fanfare(); } };
  a.state = () => ({ playing: S.mode === 'dance', score: S.score, combo: S.combo, judge: S.judgeT > 0 ? S.judge : '', notes: S.notes, now: S.now, best: a.best || 0, rhythm: true });
  a.play = () => { // a 40-beat routine: mostly quarter notes, some doubles and off-beats, a flurry at the end
    S.notes = []; let lastLane = 0;
    for (let b = 4; b < 44; b++) { if (rand() < 0.8) { let lane = Math.floor(rand() * 4); if (lane === lastLane && rand() < 0.6) lane = (lane + 1) % 4; lastLane = lane; S.notes.push({ t: b * BEAT, lane, hit: 0 }); }
      if (b > 30 && rand() < 0.45) S.notes.push({ t: (b + 0.5) * BEAT, lane: Math.floor(rand() * 4), hit: 0 }); }
    S.mode = 'dance'; S.now = -1.2; S.score = 0; S.combo = 0; S.maxCombo = 0; a.ui && a.ui.gameUpdate(a);
  };
  a.stop = () => { S.mode = 'idle'; S.notes = []; a.ui && a.ui.gameUpdate(a); };
  addEventListener('keydown', e => {
    if (S.mode !== 'dance') return; const lane = LANES.indexOf(e.code) >= 0 ? LANES.indexOf(e.code) : ALT[e.code]; if (lane === undefined) return; e.preventDefault();
    let best = null, bd = 9; for (const n of S.notes) { if (n.hit || n.lane !== lane) continue; const d = Math.abs(n.t - S.now); if (d < bd) { bd = d; best = n; } }
    if (best && bd < 0.2) { best.hit = bd < 0.09 ? 2 : 1; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.score += (best.hit === 2 ? 100 : 50) * (1 + Math.floor(S.combo / 10) * 0.5);
      S.judge = best.hit === 2 ? 'Perfect!' : 'Good'; S.judgeT = 0.5; S.hit = 1; a.sfx && a.sfx.pop && a.sfx.pop();
      if (S.combo % 10 === 0) a.fx && a.fx.hearts(V(0, 3, 0).applyMatrix4(root.matrixWorld), 30, 2.5); }
    else { S.combo = 0; S.judge = 'Miss'; S.judgeT = 0.5; }
  });
  a.update = (dt, t) => {
    U.uTime.value = t; S.judgeT -= dt;
    const beatPhase = (t % BEAT) / BEAT; S.pulse = Math.max(0, 1 - beatPhase * 3); U.uPulse.value = S.pulse; S.hit = Math.max(0, S.hit - dt * 3); U.uHit.value = S.hit;
    S.show = Math.max(0, S.show - dt); const wild = S.show > 0 || S.mode === 'dance';
    beams.forEach((b, i) => { const sp = wild ? 1.6 : 0.4; b.g.rotation.z = Math.sin(t * sp + b.ph) * (wild ? 0.6 : 0.3); b.g.rotation.x = Math.cos(t * sp * 0.8 + b.ph) * 0.35 + 0.25;
      b.cone.material.opacity = (wild ? 0.16 : 0.08) + S.hit * 0.15 + S.pulse * 0.04; b.cone.material.color.setHSL((0.9 + i * 0.05 + (wild ? t * 0.1 : 0)) % 1, 0.7, 0.85); });
    if (spot) spot.intensity = spot.intensity * 0.9 + (40 * (0.5 + S.hit + S.pulse * 0.5)) * 0.1;
    if (S.mode === 'dance') { S.now += dt;
      for (const n of S.notes) if (!n.hit && S.now - n.t > 0.2) { n.hit = -1; S.combo = 0; S.judge = 'Miss'; S.judgeT = 0.4; }
      a.ui && a.ui.rhythm && a.ui.rhythm(a.state());
      if (S.now > S.notes[S.notes.length - 1].t + 1.2) { S.mode = 'idle'; a.best = Math.max(a.best || 0, Math.round(S.score)); a.plays = (a.plays || 0) + 1;
        const hits = S.notes.filter(n => n.hit > 0).length, pct = Math.round(hits / S.notes.length * 100), grade = pct >= 95 ? 'S' : pct >= 85 ? 'A' : pct >= 70 ? 'B' : 'C';
        a.ui && (a.ui.toast(['Grade {g}!', { g: grade }], ['{p}% · {s} points · best combo {c}', { p: pct, s: Math.round(S.score), c: S.maxCombo }], '💃'), a.ui.gameUpdate(a, { result: pct >= 70 ? 'win' : 'lose' }));
        if (pct >= 85) { a.fx && a.fx.show && a.fx.show(6, V(0, 28, -10).applyMatrix4(root.matrixWorld)); a.sfx && a.sfx.fanfare && a.sfx.fanfare(); } } }
  };
  void R; void gold; void paint;
  a.rig = { root }; // the night-lighting rig (world/illumination.js)
  return a;
}
