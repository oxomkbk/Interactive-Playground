/* =========================================================================
   EFFECTS — event-driven particles from one pooled sprite system (per-particle colour, size and shape):
   • fireworks, built like real pyrotechnic shells: a rocket climbing on a spark trail, then one of nine shell
     types — peony (a solid sphere of colour), chrysanthemum (every star trails sparks), gold willow (long
     drooping trails that hang and fall), palm (a few heavy comets), double ring, crossette (stars that split
     again in mid-air), glitter (a crackling cloud of flashes), a two-colour pistil and, rarely, a heart.
     Saturated pyrotechnic colours rather than pastel white; every burst lights the park around it for a moment
     (pooled night lights that flare and decay), and the whole system allocates nothing per frame
   • heart & sparkle bursts for feedback (rewards, clicks, wishes)
   • soft smoke puffs (the train) • shooting stars streaking across the night sky now and then
   Only live particles are simulated; the buffers are small and fixed.
   ========================================================================= */
import * as THREE from 'three';
import { nightness } from '../core/mood.js';
import { R, rand, pick } from '../core/geo.js';
import { SCALE } from './particles.js';
import { addNightLight } from '../core/nightlights.js';

const N = 14000, G = -6.5;
// pyrotechnic colours: strontium red-rose, barium emerald, copper aqua, violet, sodium gold, titanium champagne
const PY = { rose: '#FF4F8E', red: '#FF4458', gold: '#FFB648', amber: '#FF8A3A', violet: '#A76BFF', aqua: '#4FD8FF', emerald: '#4CFFA0', champ: '#FFE7BE', lilac: '#D59BFF' };
const PALETTES = [[PY.rose, PY.gold], [PY.violet, PY.champ], [PY.aqua, PY.violet], [PY.gold, PY.amber], [PY.emerald, PY.gold], [PY.rose, PY.lilac], [PY.red, PY.champ], [PY.aqua, PY.rose]];
// (no flat ring shells: from the ground they read as hollow glowing circles, not fireworks)
const KINDS = ['peony', 'peony', 'chrysanthemum', 'chrysanthemum', 'chrysanthemum', 'willow', 'palm', 'crossette', 'glitter', 'pistil', 'pistil', 'heart'];

function createEffects({ sfx } = {}) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), shape = new Float32Array(N);
  const P = Array.from({ length: N }, () => ({ life: 0, max: 1, v: new THREE.Vector3(), drag: 0, grav: 0, size: 1, twinkle: 0, c: new THREE.Color(), shape: 0, fade: 1, trail: 0 }));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('aShape', new THREE.BufferAttribute(shape, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: SCALE }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`uniform float uScale; attribute vec3 aColor; attribute float aSize, aAlpha, aShape; varying vec3 vC; varying float vA, vS;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uScale / -mv.z, 0.0, 90.0); vC = aColor; vA = aAlpha; vS = aShape; }`,
    fragmentShader: /* glsl */`varying vec3 vC; varying float vA, vS;
      void main(){ vec2 c = gl_PointCoord - 0.5; c.y = -c.y; float a;
        if (vS > 1.5) { vec2 h = c * 2.6; h.y -= 0.18; float q = pow(h.x * h.x + h.y * h.y - 0.35, 3.0) - h.x * h.x * h.y * h.y * h.y; a = smoothstep(0.02, -0.03, q); }   // heart
        else if (vS > 0.5) { float d = length(c); a = smoothstep(0.5, 0.0, d) * 0.6 + max(smoothstep(0.05, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)), smoothstep(0.05, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x))); } // star
        else { a = smoothstep(0.5, 0.0, length(c)); a *= a; }                                                                      // soft dot
        a *= vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  // smoke needs normal blending, so it gets its own small system
  const smoke = smokeSystem();
  const root = new THREE.Group(); root.name = 'effects'; root.add(pts, smoke.object3D);
  let head = 0, live = 0;
  function spawn(p, v, o) { const i = head; head = (head + 1) % N; const q = P[i]; q.life = q.max = o.life ?? 1.5; q.v.copy(v); q.drag = o.drag ?? 1.2; q.grav = o.grav ?? G; q.size = o.size ?? 0.5; q.twinkle = o.twinkle ?? 0; q.c.set(o.color ?? '#ffffff').multiplyScalar(o.bright ?? 2.5); q.shape = o.shape ?? 0; q.trail = o.trail ?? 0; pos.set([p.x, p.y, p.z], i * 3); live = Math.max(live, 1); return q; }

  const rockets = [], _v = new THREE.Vector3(), _p = new THREE.Vector3();
  // the park lights up under a burst: three pooled lights that flare and decay
  const FLASH = [0, 1, 2].map(() => ({ l: addNightLight(new THREE.Vector3(0, -999, 0), 140, '#000000', 0, { always: 1 }), t: 0, c: new THREE.Color() })); let flashI = 0;
  const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const crossettes = [];
  function burst(at, kind = pick(KINDS), pal = pick(PALETTES), quiet = false) {
    if (kind === 'ring' || kind === 'sphere') kind = 'chrysanthemum';
    const sp = R(22, 30), c0 = pal[0], c1 = pal[1] || pal[0];
    const star = (v, o) => spawn(at, v, o);
    if (kind === 'heart') { _q.setFromUnitVectors(Z, _d.set(R(-1, 1), R(-0.2, 0.3), R(-1, 1)).normalize());
      for (let i = 0; i < 200; i++) { const t = i / 200 * Math.PI * 2, hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        star(_v.set(hx / 16, hy / 16 + 0.2, R(-0.05, 0.05)).applyQuaternion(_q).multiplyScalar(sp * 0.9), { life: R(1.8, 2.4), drag: 1.1, grav: -2.5, size: 1.1, color: i % 2 ? c0 : PY.rose, twinkle: 0, shape: 0 }); } }
    // rings burst tilted well off face-on (a flat ring seen square-on reads as a strange circle, not a firework)
    else if (kind === 'ring') { for (const [k, cc] of [[1, c0], [0.62, c1]]) { _q.setFromUnitVectors(Z, _d.set(R(-1, 1), R(0.9, 1.6), R(-1, 1)).normalize());
        for (let i = 0; i < 160; i++) { const t = i / 160 * Math.PI * 2; star(_v.set(Math.cos(t), Math.sin(t), 0).applyQuaternion(_q).multiplyScalar(sp * k), { life: R(1.8, 2.3), drag: 1.0, grav: -2.6, size: 1.05, color: cc, shape: 0 }); } } }
    else if (kind === 'palm') { for (let i = 0; i < 9; i++) { _v.set(R(-1, 1), R(0.1, 1), R(-1, 1)).normalize().multiplyScalar(sp * 1.1); star(_v, { life: 2.8, drag: 0.9, grav: -4, size: 2.0, color: PY.gold, trail: 2, shape: 0 }); } }
    else if (kind === 'willow') { for (let i = 0; i < 260; i++) star(_v.set(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(sp * (0.3 + 0.65 * Math.cbrt(rand()))), { life: R(3.4, 4.4), drag: 1.7, grav: -3.2, size: 0.9, color: PY.gold, bright: 1.8, trail: 1, shape: 0 }); }
    else if (kind === 'glitter') { for (let i = 0; i < 380; i++) star(_v.set(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(sp * R(0.3, 1)), { life: R(1.4, 2.6), drag: 1.5, grav: -2.5, size: 0.75, color: rand() < 0.5 ? PY.champ : c0, twinkle: 2, shape: 1 }); }
    else if (kind === 'crossette') { for (let i = 0; i < 16; i++) { _v.set(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(sp * 0.8); const id = head; spawn(at, _v, { life: 1.1, drag: 1.2, grav: -3, size: 1.5, color: c0, trail: 2, shape: 0 }); crossettes.push({ i: id, c: c1 }); } }
    else { const n = 420, chrys = kind === 'chrysanthemum', pist = kind === 'pistil';
      for (let i = 0; i < n; i++) { const inner = pist && i < n * 0.3; _v.set(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(sp * (inner ? R(0.2, 0.45) : 0.35 + 0.65 * Math.cbrt(rand())));   // stars fill the burst's volume (a thin shell reads as a hollow ring from below)
        star(_v, { life: R(1.8, 2.6), drag: 1.05, grav: -2.8, size: chrys ? 0.95 : 1.1, color: inner ? c1 : (i % 5 === 0 ? c1 : c0), twinkle: chrys ? 0 : (rand() < 0.25 ? 1 : 0), trail: chrys ? 1 : 0, shape: 0 }); } }
    for (let i = 0; i < 46; i++) spawn(at, _v.set(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(R(1, 4)), { life: 0.45, size: 2.6, color: '#FFF0D8', bright: 3.4, drag: 3, grav: 0 }); // the flash
    const f = FLASH[flashI++ % 3]; f.l.p.copy(at); f.t = 1; f.c.set(c0); f.k = quiet ? 0.3 : 0.6;
    if (!quiet) sfx && sfx.boom && sfx.boom(at);
  }
  // the festival programme: fireworks all night over the park's skyline — a shell every second or two, mostly
  // behind the castle and over the lake side so they frame the view up the boulevard, and every 40–55 s a grand
  // finale (a dozen shells in quick succession). Distant shells boom softly; only finales get every boom.
  const FEST = { on: false, next: 2, finale: 45, salvo: 0, salvoT: 0 };
  const _ft = new THREE.Vector3();
  // finale shells burst right over the castle (framing the drone show); routine shells range round the skyline
  function festShell(big) {
    if (big) { _ft.set(R(-45, 45), R(70, 105), -150 + R(-25, 15)); api.firework(_ft, undefined, rand() < 0.4); return; }
    const a = Math.PI + R(-1.1, 1.1) + (rand() < 0.2 ? Math.PI : 0), r = R(85, 150);
    _ft.set(Math.sin(a) * r, R(50, 82), Math.cos(a) * r - 20); api.firework(_ft, undefined, rand() < 0.6); }
  function stepFestival(dt) { if (!FEST.on) return;
    if (FEST.salvo > 0 && (FEST.salvoT -= dt) <= 0) { festShell(true); FEST.salvo--; FEST.salvoT = R(0.15, 0.35); }
    if ((FEST.next -= dt) <= 0) { festShell(false); FEST.next = R(0.6, 1.5); }
    if ((FEST.finale -= dt) <= 0) { FEST.finale = R(32, 45); FEST.salvo = 16; FEST.salvoT = 0; } }
  const api = {
    object3D: root,
    festival(on = true) { FEST.on = on; },
    // launch a firework that bursts at `target`
    firework(target, kind, quiet = false) { const from = new THREE.Vector3(target.x * 0.6, 0.5, target.z * 0.6); rockets.push({ p: from, to: target.clone(), t: 0, d: R(1.1, 1.5), kind, quiet }); if (!quiet) sfx && sfx.launch && sfx.launch(); },
    show(n = 6, center = new THREE.Vector3(0, 40, -40)) { for (let i = 0; i < n; i++) setTimeout(() => api.firework(center.clone().add(new THREE.Vector3(R(-30, 30), R(-6, 12), R(-15, 15)))), i * R(260, 520)); },
    hearts(at, n = 24, spread = 1.5) { for (let i = 0; i < n; i++) spawn(at, _v.set(R(-1, 1) * spread, R(1.5, 3.5), R(-1, 1) * spread), { life: R(1.4, 2.4), drag: 1.4, grav: 0.6, size: R(0.35, 0.6), color: pick(['#FF7FA8', '#FFB3C6', '#F28FAF', '#FFD1E0']), bright: 1.8, shape: 2 }); },
    sparkles(at, n = 30, spread = 2) { for (let i = 0; i < n; i++) spawn(at, _v.set(R(-1, 1), R(-0.2, 1.4), R(-1, 1)).multiplyScalar(spread), { life: R(0.6, 1.2), drag: 2.5, grav: -1, size: R(0.25, 0.45), color: pick(['#FFD68A', '#FFFFFF', '#FFE3F0']), shape: 1, twinkle: 1 }); },
    smoke: (p) => smoke.emit(p),
    update(dt, t) {
      stepFestival(dt);
      // rockets: ease up to the target leaving a sparkling trail, then burst
      for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; r.t += dt / r.d; const k = 1 - (1 - Math.min(1, r.t)) ** 2; _p.copy(r.p).lerp(r.to, k);
        for (let j = 0; j < 2; j++) spawn(_p, _v.set(R(-0.4, 0.4), R(-1.8, -0.5), R(-0.4, 0.4)), { life: R(0.4, 0.8), size: 0.4, color: '#FFD9A0', bright: 2.2, drag: 2, grav: -2, twinkle: 1 }); if (r.t >= 1) { burst(r.to, r.kind, undefined, r.quiet); rockets.splice(i, 1); } }
      // crossette stars split in four as they slow
      for (let i = crossettes.length - 1; i >= 0; i--) { const cr = crossettes[i], q = P[cr.i]; if (q.life > 0.42 && q.life > 0) continue; crossettes.splice(i, 1); if (q.life <= 0) continue;
        _p.set(pos[cr.i * 3], pos[cr.i * 3 + 1], pos[cr.i * 3 + 2]); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; spawn(_p, _v.set(Math.cos(a) * 7, R(-1, 2), Math.sin(a) * 7), { life: 1.3, drag: 1.4, grav: -3, size: 1.0, color: cr.c, trail: 1 }); } q.life = 0; }
      for (const f of FLASH) { if (f.t <= 0) { f.l.c.setRGB(0, 0, 0); continue; } f.t = Math.max(0, f.t - dt * 1.6); f.l.c.copy(f.c).multiplyScalar(f.t * f.t * 10 * (f.k ?? 1)); }
      if (live) { let n = 0;
        for (let i = 0; i < N; i++) { const q = P[i]; if (q.life <= 0) { if (alpha[i]) alpha[i] = 0; continue; } n++;
          q.life -= dt; const k = Math.max(0, q.life / q.max), d = Math.exp(-q.drag * dt); q.v.multiplyScalar(d); q.v.y += q.grav * dt;
          pos[i * 3] += q.v.x * dt; pos[i * 3 + 1] += q.v.y * dt; pos[i * 3 + 2] += q.v.z * dt;
          const tw = q.twinkle === 2 ? (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 24 + i * 1.7))) : q.twinkle ? (0.55 + 0.45 * Math.sin(t * 30 + i)) : 1;   // twinkle 2 = glitter crackle
          alpha[i] = Math.min(1, k * 1.6) * tw; size[i] = q.size * (0.6 + 0.4 * k); shape[i] = q.shape;
          col[i * 3] = q.c.r; col[i * 3 + 1] = q.c.g; col[i * 3 + 2] = q.c.b;
          if (q.trail && rand() < (q.trail === 2 ? 0.7 : 0.25)) spawn(_p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), _v.set(R(-0.2, 0.2), -0.5, R(-0.2, 0.2)), { life: q.trail === 2 ? 0.9 : 0.7, size: q.size * 0.55, color: '#FFC97A', bright: 1.5 * k + 0.3, drag: 1.2, grav: -1.2 }); }
        live = n; for (const a of [g.attributes.position, g.attributes.aColor, g.attributes.aSize, g.attributes.aAlpha, g.attributes.aShape]) a.needsUpdate = true; }
      smoke.update(dt);
      stars.update(dt, t);
    },
  };
  const stars = shootingStars(root);
  return api;
}

function smokeSystem() {
  const n = 220, pos = new Float32Array(n * 3), a = new Float32Array(n), s = new Float32Array(n), P = Array.from({ length: n }, () => ({ life: 0, v: new THREE.Vector3() }));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), fog: true, transparent: true, depthWrite: false,
    vertexShader: `uniform float uScale; attribute float aA, aS; varying float vA;
      #include <fog_pars_vertex>
      void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(aS * uScale / -mvPosition.z, 0.0, 200.0); vA = aA;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying float vA;
      #include <fog_pars_fragment>
      void main(){ float d = length(gl_PointCoord - 0.5), a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.97, 0.95, 1.0), a);
      #include <fog_fragment>
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }` });
  m.uniforms.uScale = SCALE;
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; let head = 0;
  return { object3D: pts,
    emit(p) { const i = head; head = (head + 1) % n; P[i].life = 1; P[i].v.set(R(-0.3, 0.3), R(1.2, 1.8), R(-0.3, 0.3)); pos.set([p.x, p.y, p.z], i * 3); },
    update(dt) { for (let i = 0; i < n; i++) { const q = P[i]; if (q.life <= 0) { a[i] = 0; continue; } q.life -= dt * 0.45; pos[i * 3] += q.v.x * dt; pos[i * 3 + 1] += q.v.y * dt; pos[i * 3 + 2] += q.v.z * dt; q.v.multiplyScalar(Math.exp(-0.8 * dt));
      a[i] = Math.max(0, q.life) * 0.55; s[i] = 0.6 + (1 - q.life) * 2.4; } g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aS.needsUpdate = true; } };
}

// thin glowing streaks with a fading tail, only when it is dark
function shootingStars(root) {
  const geo = new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0), streaks = [];
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uA: { value: 1 } }, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0) * smoothstep(0.5, 0.0, abs(vUv.y - 0.5)) * uA; gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * 2.5 * a, a); }` });
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(geo, mat.clone()); m.visible = false; m.frustumCulled = false; root.add(m); streaks.push({ m, t: 0, d: 1, from: new THREE.Vector3(), dir: new THREE.Vector3() }); }
  let next = 4;
  return { update(dt) {
    const night = nightness(); next -= dt;
    if (night > 0.6 && next <= 0) { next = R(3, 9); const s = streaks.find(s => !s.m.visible); if (s) { const a = R(0, Math.PI * 2); s.from.set(Math.sin(a) * 600, R(260, 420), Math.cos(a) * 600); s.dir.set(R(-1, 1), R(-0.5, -0.25), R(-1, 1)).normalize(); s.t = 0; s.d = R(0.8, 1.4); s.m.visible = true; } }
    for (const s of streaks) { if (!s.m.visible) continue; s.t += dt / s.d; if (s.t >= 1) { s.m.visible = false; continue; }
      const p = s.from.clone().addScaledVector(s.dir, s.t * 380); s.m.position.copy(p); s.m.lookAt(p.clone().add(new THREE.Vector3(0, 0, 1)));
      s.m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), s.dir); s.m.scale.set(70, 1.4, 1); s.m.material.uniforms.uA.value = Math.sin(s.t * Math.PI) * night; }
  } };
}

export { createEffects };
