import * as THREE from 'three';
import { PI, R, TAU, V3, clamp, pick } from '../core/utils.js';
import { EXPO, FX_OBJECTS, QNAME, bloom, camera, pointLight, scene, shockPass } from '../core/renderer.js';
import { U_PSCALE } from '../core/shaders.js';
import { onUpdate } from '../core/registry.js';
import { AU } from '../core/audio.js';
import { t } from '../core/i18n.js';
import { S } from './play.js';
import { M } from '../core/materials.js';

/* =========================================================================
   PYRO — the fireworks engine, GPU-driven.

   STARS. Every star is written ONCE into a pooled ring buffer of instance attributes (spawn position, velocity,
   colour, birth time, lifetime, drag, gravity, size, behaviour, trail length). The vertex shader evaluates the
   exact solution of motion under gravity + linear air drag,
        p(t) = p0 + vT·t + (v0 − vT)(1 − e^(−k t)) / k ,   vT = g/k + wind      (terminal velocity)
   so stars decelerate, droop and fall naturally with zero CPU work per frame. Each star instance is drawn as K
   point samples taken at t, t−Δ, t−2Δ…: the head is a crisp core + soft halo; the samples behind it form a
   glowing trail that cools and thins. Stars are born white-hot, cool to their colour, then fade; per-behaviour
   shading adds strobe, glitter and end-of-life crackle. Points are depth-tested against the park, so roofs and
   spires occlude bursts, and dim with atmospheric distance.

   SHELLS. Comet climbs on a spark tail → burst at apex: core flash + main break (+ pistil) with a jittered,
   slightly elliptical, tilted spread; crossettes split mid-flight, multi-breaks fire secondary shells from
   their own stars, crackle shells fizz at the end. Twelve types.

   LIGHT & AIR. Pooled burst lights (brief strong flash, then a dim afterglow from the falling stars) light the
   ground and props; bloom swells with flash intensity (after the highlight roll-off, so it reads bright without
   clipping); big shells push a screen-space shockwave ring; every burst leaves smoke puffs that are lit from
   inside by the flash, drift on the wind, swell and dissipate.

   SOUND. Mortar thump, whistle or hiss on launch; boom delayed by distance at 343 m/s with air absorption;
   crackle and sizzle tails — all synthesized (audio.js fw*).

   PERFORMANCE. Fixed pools (stars, smoke, rockets, events, lights, shocks) — nothing is allocated per burst;
   only the written slice of each buffer is uploaded (addUpdateRange); the star ring is capped per quality tier,
   bursts thin out when the ring is busy, and trail samples drop on lower tiers via drawRange.
   ========================================================================= */
const PAL = {   // saturated stars (minor channels kept low) so hues survive the white-hot core, bloom and highlight roll-off
  amber: [3.2, 0.95, 0.12], gold: [3.0, 1.75, 0.35], violet: [1.5, 0.3, 3.4], ghost: [0.25, 3.0, 1.0], blood: [3.4, 0.22, 0.18],
  silver: [2.3, 2.35, 2.6], azure: [0.3, 1.1, 3.4], rose: [3.2, 0.45, 1.7],
  lime: [1.3, 3.1, 0.2], teal: [0.2, 2.5, 2.6], magenta: [3.0, 0.25, 2.7], white: [2.6, 2.55, 2.4], copper: [3.1, 1.2, 0.5],
};
// duo palettes for the show — main colour + pistil / colour-change partner
const THEMES = [['amber', 'violet'], ['ghost', 'gold'], ['blood', 'silver'], ['azure', 'rose'], ['violet', 'lime'], ['gold', 'blood'], ['teal', 'magenta'], ['copper', 'azure'], ['magenta', 'gold'], ['lime', 'violet'], ['white', 'blood'], ['rose', 'teal']];
const FAMILY = ['amber', 'gold', 'violet', 'ghost', 'blood', 'silver', 'azure', 'rose', 'lime', 'teal', 'magenta', 'copper'];
const TYPES = ['peony', 'peonycc', 'chrys', 'dahlia', 'willow', 'kamuro', 'brocade', 'palm', 'spider', 'horsetail', 'ring', 'dring', 'saturn', 'crossette', 'strobe', 'crackle', 'timerain', 'multi', 'heart', 'pumpkin'];
const TYPE_NAMES = { peonycc: 'Colour-change Peony', dahlia: 'Dahlia', brocade: 'Brocade Crown', spider: 'Spider', horsetail: 'Horsetail', dring: 'Double Ring', timerain: 'Time Rain', heart: 'Heart', peony: 'Peony', chrys: 'Chrysanthemum', willow: 'Willow', kamuro: 'Kamuro', palm: 'Palm', ring: 'Ring', saturn: 'Saturn', crossette: 'Crossette', strobe: 'Strobe', crackle: 'Crackle', multi: 'Multi-break', pumpkin: "Jack-o'-lantern" };
const SITES = {
  plaza: [[0, -22], [-22, -34], [22, -34], [0, -44]], lake: [[112, -50], [100, -72], [124, -30], [118, -62]], fields: [[122, 52], [104, 62], [136, 36]],
  cathedral: [[0, -150], [-22, -160], [22, -160]], circus: [[-118, 22], [-100, 44], [-132, 0]],
};
const SITE_NAMES = { all: 'Everywhere', plaza: 'Plaza', lake: 'Lake', fields: 'Fields', cathedral: 'Cathedral', circus: 'Circus' };
// behaviour codes (shader): 0 plain · 1 strobe · 2 glitter · 3 crackle · 4 core flash · 5 spark (no halo)
const K_TRAIL = 9, CAPS = { low: 7000, medium: 14000, high: 22000, ultra: 28000 }, MAXN = 28000, SMOKE_N = 1400;
const PY = { time: 0, stars: null, smoke: null, head: 0, sHead: 0, alive: 0, rockets: [], lights: [], li: 0, events: [], shocks: [], energy: 0, flash: 0,
  sky: new THREE.Color(), dirty: [1e9, -1], sDirty: [1e9, -1], spawned: 0,
  auto: { on: false, level: 'standard', site: 'all', next: 0, phrase: 0 }, opts: { size: 1.3, color: 'auto', site: 'all' } };

// ---------- GPU star system ----------
const STAR_VS = `
attribute float aK; attribute vec3 iP0, iV0, iCol; attribute vec4 iA, iB, iC2;   // iA: t0, life, drag k, gravity · iB: size, kind, trailΔ, seed
uniform float uTime, uScale, uK; uniform vec3 uWind; varying vec3 vC; varying float vHalo;
void main(){
  float age = uTime - iA.x - aK * iB.z, life = iA.y, k = iA.z;
  if (age < 0. || age > life || (aK > .5 && iB.z <= 0.) || aK > uK + .5) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  vec3 vT = vec3(0., -9.8 * iA.w / k, 0.) + uWind;
  vec3 p = iP0 + vT * age + (iV0 - vT) * (1. - exp(-k * age)) / k;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float x = age / life, fade = (1. - smoothstep(.45, 1., x)) * (1. - .25 * x);
  float hot = exp(-age * 12.);                                                     // white-hot at birth, cooling to colour
  vec3 base = iC2.w > 0. ? mix(iCol, iC2.rgb, smoothstep(iC2.w, iC2.w + .05, x)) : iCol;   // colour-change stars
  vec3 c = mix(base, vec3(2.4, 2.25, 2.), hot * .85);
  float kind = iB.y, sd = iB.w;
  if (kind > .5 && kind < 1.5 && x > .3) c *= step(.55, fract(age * 9. + sd)) * 1.9;                    // strobe
  if (kind > 1.5 && kind < 2.5) c *= .55 + .65 * abs(sin(age * 38. + sd * 50.));                       // glitter
  if (kind > 2.5 && kind < 3.5 && x > .62) { float h = fract(sin(floor(age * 26.) * 12.99 + sd * 78.2) * 43758.5); c = h > .78 ? vec3(3.2, 2.9, 2.2) : c * .12; }  // crackle
  float tf = aK / max(uK, 1.), trail = aK > .5 ? .5 * pow(1. - tf, 1.7) : 1.;
  if (aK > .5) c = mix(c, vec3(c.r * 1.1 + .25, c.g * .75 + .1, c.b * .35), tf);                           // trail cools toward ember orange
  float size = iB.x * 1.7 * (aK > .5 ? mix(.75, .3, tf) : 1.) * (.65 + .35 * fade);
  if (kind > 3.5 && kind < 4.5) { size *= 1. + age * 4.; fade = exp(-age * 22.); }                         // core flash
  float d = -mv.z, px = size * uScale / max(d, .5), cl = clamp(px, 2.6, 90.);
  float energy = px < 2.6 ? .35 + .65 * px * px / 6.76 : 1.;                                     // sub-pixel stars keep their energy instead of shimmering
  vC = c * fade * trail * energy * mix(1., .5, smoothstep(90., 420., d));            // atmospheric extinction gives depth
  vHalo = kind > 4.5 ? .05 : (aK > .5 ? .18 : .34);
  gl_PointSize = cl; gl_Position = projectionMatrix * mv;
}`;
const STAR_FS = `varying vec3 vC; varying float vHalo;
void main(){ vec2 q = gl_PointCoord - .5; float r2 = dot(q, q) * 4.; if (r2 > 1.) discard;
  float a = exp(-r2 * 7.) * 1.6 + exp(-r2 * 2.2) * vHalo; gl_FragColor = vec4(vC * a, 1.); }`;
const SMOKE_VS = `
attribute vec3 iP0, iCol; attribute vec4 iA;                                   // iA: t0, life, size0, seed
uniform float uTime, uScale; uniform vec3 uWind, uAmb; varying vec4 vC; varying float vSeed;
void main(){
  float age = uTime - iA.x, life = iA.y, x = age / life;
  if (age < 0. || x > 1.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  vec3 p = iP0 + uWind * age * 1.4 + vec3(sin(iA.w * 7.), .55, cos(iA.w * 5.)) * age * .5 + vec3(0., -1.2, 0.) * (1. - exp(-age * .6));
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float size = iA.z * (1. + sqrt(age) * 1.3);
  float alpha = smoothstep(0., .5, age) * (1. - smoothstep(.35, 1., x)) * .16;
  vec3 lit = iCol * exp(-age * 2.6) * 1.6 + uAmb;                                 // lit from inside by the flash, then moonlit
  vC = vec4(lit, alpha); vSeed = iA.w;
  gl_PointSize = clamp(size * uScale / max(-mv.z, .5), 2., 600.); gl_Position = projectionMatrix * mv;
}`;
const SMOKE_FS = `varying vec4 vC; varying float vSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 17.) * 43758.5); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main(){ vec2 q = gl_PointCoord - .5; float r = length(q) * 2.; if (r > 1.) discard;
  float m = n(q * 4. + vSeed) * .6 + n(q * 9. - vSeed) * .4; float a = smoothstep(1., .2, r) * smoothstep(.25, .75, m + .3 * (1. - r));
  gl_FragColor = vec4(vC.rgb, vC.a * a); }`;
function makeInstanced(n, defs, baseVerts, baseAttr) {
  const g = new THREE.InstancedBufferGeometry(), base = new Float32Array(baseVerts * 3), k = new Float32Array(baseVerts);
  for (let i = 0; i < baseVerts; i++) k[i] = i;
  g.setAttribute('position', new THREE.BufferAttribute(base, 3)); if (baseAttr) g.setAttribute(baseAttr, new THREE.BufferAttribute(k, 1));
  const A = {}; for (const [name, size] of defs) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); A[name] = a; }
  g.instanceCount = n; return { g, A };
}
function buildStars() {
  const cap = CAPS[QNAME] || CAPS.high, { g, A } = makeInstanced(MAXN, [['iP0', 3], ['iV0', 3], ['iCol', 3], ['iA', 4], ['iB', 4], ['iC2', 4]], K_TRAIL, 'aK');
  const m = new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: U_PSCALE, uK: { value: K_TRAIL - 1 }, uWind: { value: new V3(1.2, 0, 0.4) } } });
  m.userData.noGrade = true;
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts); FX_OBJECTS.push(pts);
  for (let i = 0; i < MAXN; i++) A.iA.array[i * 4 + 1] = -1; // all slots start dead
  PY.stars = { pts, g, A, m, cap };
}
function buildSmoke() {
  const { g, A } = makeInstanced(SMOKE_N, [['iP0', 3], ['iCol', 3], ['iA', 4]], 1);
  const m = new THREE.ShaderMaterial({ vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uScale: U_PSCALE, uWind: PY.stars.m.uniforms.uWind, uAmb: { value: new THREE.Color(0.055, 0.055, 0.075) } } });
  m.userData.noGrade = true;
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts); FX_OBJECTS.push(pts);
  for (let i = 0; i < SMOKE_N; i++) A.iA.array[i * 4 + 1] = -1;
  PY.smoke = { pts, g, A, m };
}
const mark = (d, i) => { if (i < d[0]) d[0] = i; if (i > d[1]) d[1] = i; };
// write one star into the ring — plain indexed writes, no allocation
function star(px, py, pz, vx, vy, vz, c, life, size, k, grav, kind, trail, c2 = null, cAt = 0) {
  const S_ = PY.stars, i = PY.head; PY.head = (PY.head + 1) % S_.cap; const A = S_.A, p = A.iP0.array, v = A.iV0.array, cc = A.iCol.array, a = A.iA.array, b = A.iB.array, j3 = i * 3, j = i * 4;
  p[j3] = px; p[j3 + 1] = py; p[j3 + 2] = pz; v[j3] = vx; v[j3 + 1] = vy; v[j3 + 2] = vz; cc[j3] = c[0]; cc[j3 + 1] = c[1]; cc[j3 + 2] = c[2];
  a[j] = PY.time; a[j + 1] = life; a[j + 2] = k; a[j + 3] = grav; b[j] = size; b[j + 1] = kind; b[j + 2] = trail; b[j + 3] = Math.random();
  const q = A.iC2.array; if (c2) { q[j] = c2[0]; q[j + 1] = c2[1]; q[j + 2] = c2[2]; q[j + 3] = cAt; } else q[j + 3] = 0;
  mark(PY.dirty, i); PY.spawned++;
}
function puff(x, y, z, c, size, life) {
  const M = PY.smoke, i = PY.sHead; PY.sHead = (PY.sHead + 1) % SMOKE_N; const A = M.A, j = i * 4, j3 = i * 3, p = A.iP0.array, cc = A.iCol.array, a = A.iA.array;
  p[j3] = x; p[j3 + 1] = y; p[j3 + 2] = z; cc[j3] = c[0]; cc[j3 + 1] = c[1]; cc[j3 + 2] = c[2]; a[j] = PY.time; a[j + 1] = life; a[j + 2] = size; a[j + 3] = Math.random() * 10;
  mark(PY.sDirty, i);
}
function flush(sys, d) { if (d[1] < 0) return; for (const a of Object.values(sys.A)) { a.clearUpdateRanges(); a.addUpdateRange(d[0] * a.itemSize, (d[1] - d[0] + 1) * a.itemSize); a.needsUpdate = true; } d[0] = 1e9; d[1] = -1; }
// position of a star at age t (same closed form as the shader) — used for splits & secondary breaks
function starPos(out, p0, v0, k, grav, tt) { const w = PY.stars.m.uniforms.uWind.value, vTy = -9.8 * grav / k, e = (1 - Math.exp(-k * tt)) / k;
  return out.set(p0.x + w.x * tt + (v0.x - w.x) * e, p0.y + vTy * tt + (v0.y - vTy) * e, p0.z + w.z * tt + (v0.z - w.z) * e); }

// ---------- pooled timed events (crossette splits, secondary breaks) ----------
for (let i = 0; i < 200; i++) PY.events.push({ on: false, at: 0, type: '', p: new V3(), v: new V3(), c: [0, 0, 0], k: 0, g: 0, s: 1 });
function event(at, type, p, v, c, k, g, s) { const e = PY.events.find(x => !x.on); if (!e) return; e.on = true; e.at = PY.time + at; e.type = type; e.p.copy(p); e.v.copy(v); e.c[0] = c[0]; e.c[1] = c[1]; e.c[2] = c[2]; e.k = k; e.g = g; e.s = s; }
const _a = new V3(), _b = new V3(), _d = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), WHITE = [2.6, 2.4, 2.0], SECOND = { type: 'peony', size: 1, col: null, col2: null, secondary: true };
function runEvent(e) {
  if (e.type === 'split') { const tt = 0.62; starPos(_a, e.p, e.v, e.k, e.g, tt); const ex = Math.exp(-e.k * tt), vy0 = -9.8 * e.g / e.k;
    const vx = e.v.x * ex, vz = e.v.z * ex, vy = vy0 + (e.v.y - vy0) * ex, base = Math.random() * TAU;
    for (let i = 0; i < 4; i++) { const an = base + i * PI / 2, sp = 10 * e.s; star(_a.x, _a.y, _a.z, vx * 0.4 + Math.cos(an) * sp, vy * 0.4 + R(-2, 3), vz * 0.4 + Math.sin(an) * sp, e.c, R(1.2, 1.6), 0.44, 1.7, 0.5, 0, 0.035); }
    star(_a.x, _a.y, _a.z, 0, 0, 0, WHITE, 0.09, 1.2, 1, 0, 4, 0); if (Math.random() < 0.35) AU.fwPop(_a); }
  else if (e.type === 'break') { starPos(_d, e.p, e.v, e.k, e.g, 0.5); SECOND.type = pick(['peony', 'ring', 'crackle']); SECOND.size = e.s; SECOND.col = e.c; SECOND.col2 = PAL.silver; burst(SECOND, _d); }
}

// ---------- shells ----------
const colOf = name => (name === 'rainbow' || name === 'auto' || !PAL[name] ? PAL[pick(FAMILY)] : PAL[name]);
const fib = (i, n, out) => { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996323; return out.set(Math.cos(a) * r, y, Math.sin(a) * r); };
// one break: n stars over a jittered, slightly squashed and tilted sphere — real shells are never perfect spheres
function sphere(p, n, R0, c, life, size, k, grav, kind, trail, inh, c2 = null, cAt = 0, upOnly = 0) {
  _e.set(R(-0.5, 0.5), R(0, TAU), R(-0.5, 0.5)); _q.setFromEuler(_e); const sx = R(0.86, 1.12), sy = R(0.82, 1.08), sz = R(0.86, 1.12);
  for (let i = 0; i < n; i++) { fib(i, n, _b); _b.x += R(-0.09, 0.09); _b.y += R(-0.09, 0.09); _b.z += R(-0.09, 0.09); _b.normalize(); if (upOnly) { _b.y = Math.abs(_b.y) * 0.8 + upOnly; _b.normalize(); } else { _b.set(_b.x * sx, _b.y * sy, _b.z * sz).applyQuaternion(_q); }
    const sp = R0 * k * R(0.84, 1.07), dud = Math.random() < 0.05 ? 0.55 : 1;
    star(p.x, p.y, p.z, _b.x * sp + inh.x, _b.y * sp + inh.y, _b.z * sp + inh.z, c, life * R(0.85, 1.12) * dud, size * R(0.85, 1.15), k, grav, kind, trail, c2, cAt); }
}
const ZERO = new V3(), TINT = [0, 0, 0];
function burst(sh, p, inh = ZERO) {
  const s = sh.size, Rr = 13 + 15 * s, c = sh.col, c2 = sh.col2, nb = Math.min(1.9, Math.pow(s, 0.8)), busy = PY.alive > PY.stars.cap * 0.75 ? 0.5 : 1;
  const N = x => Math.max(8, Math.round(x * nb * busy));
  star(p.x, p.y, p.z, 0, 0, 0, [1.6, 1.5, 1.3], 0.1 + 0.03 * s, 0.9 + 0.5 * s, 1, 0, 4, 0);                               // core flash (brief, tight)
  switch (sh.type) {
    case 'peony': sphere(p, N(150), Rr, c, R(2.4, 3.0), 0.5, 1.9, 0.55, 0, 0.016, inh); sphere(p, N(45), Rr * 0.45, c2, 1.9, 0.42, 1.9, 0.55, 0, 0.012, inh); break;
    case 'peonycc': sphere(p, N(160), Rr, c, R(2.8, 3.3), 0.5, 1.9, 0.5, 0, 0.016, inh, c2, 0.42); sphere(p, N(45), Rr * 0.45, c2, 2.2, 0.42, 1.9, 0.5, 0, 0.012, inh, c, 0.5); break;
    case 'dahlia': sphere(p, N(70), Rr * 1.05, c, R(3.2, 3.8), 0.95, 1.6, 0.5, 0, 0.03, inh); sphere(p, N(24), Rr * 0.35, c2, 2.4, 0.6, 1.6, 0.5, 2, 0.02, inh); break;
    case 'brocade': sphere(p, N(170), Rr * 1.05, PAL.gold, R(4.4, 5.2), 0.46, 2.2, 0.48, 2, 0.095, inh); sphere(p, N(40), Rr * 0.55, c, 3.0, 0.5, 2.0, 0.45, 0, 0.02, inh, c2, 0.5); AU.fwSizzle(p, 0.7, 3.8); break;
    case 'spider': sphere(p, N(95), Rr * 1.3, R(0, 1) < 0.5 ? PAL.gold : PAL.silver, R(1.6, 2.1), 0.36, 1.0, 0.7, 2, 0.065, inh); break;
    case 'horsetail': sphere(p, N(120), Rr * 0.55, PAL.gold, R(4.4, 5.0), 0.42, 1.2, 1.0, 2, 0.1, inh, null, 0, 0.6); AU.fwSizzle(p, 0.5, 4); break;
    case 'timerain': sphere(p, N(120), Rr * 0.85, [2.8, 1.9, 0.6], R(3.8, 4.4), 0.38, 2.6, 0.3, 3, 0.02, inh); AU.fwCrackle(p, 2.3, 1.8, 110); AU.fwSizzle(p, 0.6, 3.4); break;
    case 'dring': { for (let r2 = 0; r2 < 2; r2++) { _e.set(r2 ? PI / 2 : R(-0.4, 0.4), R(0, TAU), r2 ? R(-0.3, 0.3) : 0); _q.setFromEuler(_e); const n = N(90), cc = r2 ? c2 : c;
        for (let i = 0; i < n; i++) { const an = i / n * TAU; _b.set(Math.cos(an), 0, Math.sin(an)).applyQuaternion(_q).multiplyScalar(Rr * 1.85); star(p.x, p.y, p.z, _b.x, _b.y, _b.z, cc, R(2.4, 2.8), 0.48, 1.9, 0.45, 0, 0.014); } } break; }
    case 'heart': { const f = _a.subVectors(camera.position, p).setY(0).normalize(), rx = -f.z, rz = f.x, sp = Rr * 0.11;
      for (let i = 0; i < 110; i++) { const u = i / 110 * TAU, hx = 16 * Math.pow(Math.sin(u), 3), hy = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
        star(p.x, p.y, p.z, rx * hx * sp, hy * sp, rz * hx * sp, PAL.rose, 3.0, 0.55, 1.6, 0.12, 0, 0.02, PAL.magenta, 0.6); } break; }
    case 'chrys': sphere(p, N(130), Rr, c, R(2.6, 3.2), 0.46, 1.8, 0.55, 2, 0.05, inh); break;
    case 'willow': sphere(p, N(110), Rr * 0.85, PAL.gold, R(4.6, 5.6), 0.44, 2.4, 0.42, 2, 0.085, inh); AU.fwSizzle(p, 0.8, 3.5); break;
    case 'kamuro': sphere(p, N(150), Rr * 0.9, [2.5, 1.85, 0.8], R(4.2, 5.0), 0.38, 2.3, 0.38, 2, 0.075, inh); sphere(p, N(30), Rr * 0.4, [2.6, 2.3, 1.6], 2.4, 0.4, 2, 0.5, 2, 0.04, inh); AU.fwSizzle(p, 0.6, 3.2); break;
    case 'palm': { const n = 8 + Math.round(s * 3); for (let i = 0; i < n; i++) { const an = i / n * TAU + R(-0.1, 0.1); _b.set(Math.cos(an), R(0.15, 0.65), Math.sin(an)).normalize().multiplyScalar(Rr * 1.5 * R(0.9, 1.05));
        star(p.x, p.y, p.z, _b.x + inh.x, _b.y + inh.y, _b.z + inh.z, PAL.gold, R(3.0, 3.6), 0.95, 1.5, 0.5, 2, 0.08); }
      sphere(p, N(40), Rr * 0.3, c, 1.8, 0.45, 1.8, 0.5, 0, 0.015, inh); break; }
    case 'ring': case 'saturn': { _e.set(R(-1, 1), R(0, TAU), R(-0.6, 0.6)); _q.setFromEuler(_e); const n = N(100);
      for (let i = 0; i < n; i++) { const an = i / n * TAU; _b.set(Math.cos(an), R(-0.03, 0.03), Math.sin(an)).applyQuaternion(_q).multiplyScalar(Rr * 1.9 * R(0.96, 1.02)); star(p.x, p.y, p.z, _b.x, _b.y, _b.z, c, R(2.3, 2.8), 0.5, 1.9, 0.45, 0, 0.014); }
      if (sh.type === 'saturn') sphere(p, N(90), Rr * 0.55, c2, 2.4, 0.46, 1.9, 0.5, 0, 0.014, inh); else sphere(p, N(20), Rr * 0.18, c2, 1.5, 0.4, 1.9, 0.4, 0, 0.01, inh); break; }
    case 'crossette': { const n = 10 + Math.round(s * 2); for (let i = 0; i < n; i++) { fib(i, n, _b).multiplyScalar(Rr * 1.7 * R(0.92, 1.05)); _b.add(inh);
        star(p.x, p.y, p.z, _b.x, _b.y, _b.z, c, 0.62, 0.62, 1.7, 0.5, 0, 0.04); event(0.62, 'split', p, _b, c, 1.7, 0.5, Math.sqrt(s)); } break; }
    case 'strobe': sphere(p, N(120), Rr * 0.9, PAL.silver, R(3.2, 3.8), 0.4, 2.3, 0.35, 1, 0.012, inh); break;
    case 'crackle': sphere(p, N(140), Rr, PAL.gold, R(2.4, 2.8), 0.42, 1.9, 0.5, 3, 0.03, inh); AU.fwCrackle(p, 1.5, 1.4, 70 + Math.round(40 * s)); break;
    case 'multi': { sphere(p, N(100), Rr, c, 2.2, 0.48, 1.9, 0.55, 0, 0.02, inh); if (sh.secondary) break; const n = 5 + Math.round(s * 2);
      for (let i = 0; i < n; i++) { fib(i, n, _b).multiplyScalar(Rr * 1.9 * 0.9); event(0.5 + R(0, 0.12), 'break', p, _b, c2, 1.9, 0.5, s * 0.45); star(p.x, p.y, p.z, _b.x, _b.y, _b.z, WHITE, 0.5, 0.7, 1.9, 0.5, 2, 0.04); } break; }
    case 'pumpkin': { // the Hollowmoor signature: a jack-o'-lantern face that always turns to face the viewer
      const f = _a.subVectors(camera.position, p).setY(0).normalize(), rx = -f.z, rz = f.x, sp = Rr * 1.6;
      const add = (x, y, col) => star(p.x, p.y, p.z, rx * x * sp, y * sp, rz * x * sp, col, 3.0, 0.55, 1.6, 0.12, 0, 0.02);
      for (let i = 0; i < 80; i++) { const an = i / 80 * TAU; add(Math.cos(an) * 1.05, Math.sin(an) * 0.9, PAL.amber); }
      for (let i = 0; i < 8; i++) add(R(-0.06, 0.06), 0.95 + i * 0.035, [0.6, 2.1, 0.5]);
      for (const sx of [-1, 1]) for (let i = 0; i < 16; i++) { const u = i / 16; add(sx * (0.22 + 0.32 * u), 0.15 + (u < 0.5 ? u : 1 - u) * 0.6, PAL.ghost); add(sx * (0.22 + 0.32 * u), 0.15, PAL.ghost); }
      for (let i = 0; i <= 28; i++) { const u = i / 28 - 0.5; add(u * 1.1, -0.36 - Math.abs(Math.sin(u * PI * 3)) * 0.18 - (0.25 - u * u), PAL.amber); } break; }
  }
  // light, sky tint, smoke, shockwave, sound
  light(p, c, s); PY.energy = Math.min(3, PY.energy + 0.4 * s); _c.setRGB(c[0], c[1], c[2]).multiplyScalar(0.0035 * Math.min(s, 2)); PY.sky.add(_c);
  const m = Math.max(PY.sky.r, PY.sky.g, PY.sky.b); if (m > 0.02) PY.sky.multiplyScalar(0.02 / m);
  TINT[0] = c[0] * 0.09; TINT[1] = c[1] * 0.09; TINT[2] = c[2] * 0.09; const np = sh.secondary ? 3 : 7 + Math.round(5 * s);
  for (let i = 0; i < np; i++) { _b.set(R(-1, 1), R(-0.7, 0.7), R(-1, 1)).multiplyScalar(Rr * 0.5); puff(p.x + _b.x, p.y + _b.y, p.z + _b.z, TINT, 5 + 3 * s, R(9, 14)); }
  if (s >= 1.5 && !sh.secondary) shock(p, s);
  AU.fwBoom(p, sh.secondary ? s * 0.6 : s);
}
// ---------- light & shockwave ----------
function light(p, c, s) { const L = PY.lights[PY.li++ % PY.lights.length], m = Math.max(c[0], c[1], c[2]);
  L.position.copy(p); L.color.setRGB(0.35 + 0.65 * c[0] / m, 0.35 + 0.65 * c[1] / m, 0.35 + 0.65 * c[2] / m); L.userData.t = 0; L.userData.I = 7000 * Math.min(s, 2.4) * (S.reduceFlash ? 0.35 : 1); }
function shock(p, s) { const sh = PY.shocks.find(x => !x.on) || PY.shocks[0]; sh.on = true; sh.t = 0; sh.p.copy(p); sh.s = Math.min(1, (s - 1.2) * 0.6) * (S.reduceMotion ? 0.3 : 1); }
const _sv = new V3();
function updateShocks(dt) {
  const U = shockPass.uniforms.uS.value; shockPass.uniforms.uAspect.value = camera.aspect; const tanF = Math.tan(camera.fov * PI / 360);
  PY.shocks.forEach((sh, i) => { const u = U[i]; if (!sh.on) { u.w = 0; return; } sh.t += dt; if (sh.t > 0.9) { sh.on = false; u.w = 0; return; }
    _sv.copy(sh.p).project(camera); const d = camera.position.distanceTo(sh.p); if (_sv.z > 1) { u.w = 0; return; }
    u.x = _sv.x * 0.5 + 0.5; u.y = _sv.y * 0.5 + 0.5; u.z = (sh.t * 140) / d / tanF * 0.5; u.w = sh.s * (1 - sh.t / 0.9) * Math.min(1, 160 / d); });
}
// ---------- rockets (pooled) ----------
for (let i = 0; i < 48; i++) PY.rockets.push({ on: false, p: new V3(), v: new V3(), fuse: 0, sh: { type: 'peony', size: 1, col: PAL.amber, col2: PAL.gold, secondary: false }, acc: 0, wob: 0 });
PY.rockets.active = 0;
function launch(opts = {}) {
  const r = PY.rockets.find(x => !x.on); if (!r) return;
  const site = opts.site && opts.site !== 'all' ? opts.site : pick(Object.keys(SITES)), sp = pick(SITES[site]);
  const x = (opts.x ?? sp[0]) + R(-5, 5), z = (opts.z ?? sp[1]) + R(-5, 5), size = clamp(opts.size ?? PY.opts.size, 0.5, 3), type = opts.type && opts.type !== 'random' ? opts.type : pick(TYPES);
  const cn = opts.color || PY.opts.color; r.sh.type = type; r.sh.size = size; r.sh.col = opts.col || colOf(cn); r.sh.col2 = opts.col2 || colOf(cn === 'auto' || cn === 'rainbow' ? 'auto' : pick(FAMILY));
  const h = (opts.h ?? (42 + 20 * size)) * R(0.94, 1.05), vy = 38 + size * 5, g = 4.9, tA = (vy - Math.sqrt(Math.max(1, vy * vy - 2 * g * h))) / g, tilt = opts.tilt || 0, dir = opts.dir ?? R(0, TAU);
  let fuse = tA, vY = vy; if (opts.fuse) { fuse = Math.max(0.6, opts.fuse); vY = (h - 0.8 + 2.45 * fuse * fuse) / fuse; }   // beat-exact: burst exactly `fuse` seconds after launch
  r.on = true; r.p.set(x, 0.8, z); r.v.set(Math.cos(dir) * tilt * vY + R(-1, 1), vY, Math.sin(dir) * tilt * vY + R(-1, 1)); r.fuse = fuse; r.acc = 0; r.wob = R(0, 10);
  puff(x, 1.5, z, [0.12, 0.08, 0.05], 3, 6); AU.fwLaunch(r.p, Math.random() < (type === 'willow' || type === 'kamuro' ? 0.2 : 0.45));
}
// ---------- mines: a fountain of stars shot straight from the ground ----------
function mine(x, z, col, n = 70, spread = 0.38, speed = 30, col2 = null) {
  const p = _d.set(x, 0.6, z);
  for (let i = 0; i < n; i++) { const th = Math.random() * spread, ph = Math.random() * TAU, sp = speed * R(0.65, 1.1);
    star(x, 0.6, z, Math.sin(th) * Math.cos(ph) * sp, Math.cos(th) * sp, Math.sin(th) * Math.sin(ph) * sp, col, R(1.6, 2.4), 0.48, 1.3, 0.9, i % 3 ? 0 : 2, 0.05, col2, col2 ? 0.55 : 0); }
  star(x, 1.5, z, 0, 0, 0, WHITE, 0.15, 3, 1, 0, 4, 0); _b.set(x, 3, z); light(_b, col, 0.9);
  for (let i = 0; i < 4; i++) puff(x + R(-2, 2), 1.5 + i, z + R(-2, 2), [col[0] * 0.06, col[1] * 0.06, col[2] * 0.06], 3.5, R(6, 9));
  AU.fwPop(p); AU.fwSizzle(p, 0, 1.4);
}
// ---------- sequences ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const SEQ = {
  single: o => launch(o),
  salvo: async o => { for (let i = 0; i < 5; i++) { launch(o); await wait(280); } },
  fan: async o => { const site = o.site && o.site !== 'all' ? o.site : pick(Object.keys(SITES)), sp = SITES[site][0], face = Math.atan2(camera.position.z - sp[1], camera.position.x - sp[0]) + PI / 2;
    for (let i = 0; i < 7; i++) { launch({ ...o, site, x: sp[0], z: sp[1], tilt: Math.abs(i - 3) * 0.09, dir: face + (i < 3 ? PI : 0) }); await wait(150); } },
  crescendo: async o => { for (let i = 0; i < 14; i++) { launch({ ...o, size: (o.size ?? PY.opts.size) * (0.7 + i * 0.05) }); await wait(Math.max(130, 720 - i * 45)); } },
  willows: async o => { const site = o.site && o.site !== 'all' ? o.site : 'plaza', [cx, cz] = SITES[site][0]; for (let i = -4; i <= 4; i++) { launch({ ...o, site, type: 'willow', x: cx + i * 11, z: cz, h: 62 }); await wait(40); } },
  ringfire: async o => { const site = o.site && o.site !== 'all' ? o.site : 'plaza', [cx, cz] = SITES[site][0];
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; launch({ ...o, site, type: 'ring', x: cx + Math.cos(an) * 36, z: cz + Math.sin(an) * 36, h: 62 }); await wait(75); } },
  pumpkins: async o => { for (let i = 0; i < 5; i++) { launch({ ...o, type: 'pumpkin', size: 1.6 }); await wait(700); } },
  barrage: async o => { for (let i = 0; i < 42; i++) { launch({ ...o, size: R(0.9, 2.0), type: 'random' }); await wait(R(90, 210)); } await wait(500); for (let i = 0; i < 3; i++) launch({ ...o, type: 'kamuro', size: 2.6, h: 95 }); },
};
const SEQ_NAMES = { salvo: 'Salvo', fan: 'Fan', crescendo: 'Crescendo', willows: 'Willow Curtain', ringfire: 'Ring of Fire', pumpkins: 'Pumpkin Parade', barrage: 'Finale Barrage' };
function play(name, o = {}) { return SEQ[name]({ size: PY.opts.size, color: PY.opts.color, site: PY.opts.site, ...o }); }
// ---------- automatic show ----------
const LEVELS = { gentle: [3.5, 6, ['single', 'single', 'salvo']], standard: [2.4, 4.5, ['single', 'salvo', 'fan', 'single', 'pumpkins']], spectacular: [1.2, 2.6, ['salvo', 'fan', 'crescendo', 'willows', 'ringfire', 'salvo']] };
function setAuto(on, level, site) { const A = PY.auto; A.on = on; if (level) A.level = level; if (site) A.site = site; A.next = 0.5; A.phrase = 0;
  if (on) { S.lightShow = 'rainbow'; S.lightShowT = 1e9; } else if (S.lightShowT > 1e8) { S.lightShow = 'idle'; S.lightShowT = 0; } }
function tickAuto(dt) { const A = PY.auto; if (!A.on) return; A.next -= dt; if (A.next > 0) return;
  const [lo, hi, list] = LEVELS[A.level]; A.phrase++; const name = A.level === 'spectacular' && A.phrase % 9 === 0 ? 'barrage' : pick(list);
  play(name, { site: A.site, size: A.level === 'gentle' ? R(0.8, 1.3) : R(1, 1.9) }); A.next = R(lo, hi) + (name === 'barrage' ? 9 : name === 'crescendo' ? 5 : 0); }
function show(dur = 18) { const n = Math.floor(dur * 1.4); for (let i = 0; i < n; i++) setTimeout(() => launch({ size: R(0.9, 1.8) }), (i / n) * dur * 1000 + R(0, 300)); setTimeout(() => play('salvo', { size: 2 }), dur * 1000); }

// ---------- build & per-frame ----------
function buildPyro() {
  buildStars(); buildSmoke();
  for (let i = 0; i < 4; i++) { const L = pointLight('fw' + i, 0xffffff, 0, 260, 0, 30, 0); L.userData.instant = true; L.userData.t = 9; L.userData.I = 0; PY.lights.push(L); }
  for (let i = 0; i < 4; i++) PY.shocks.push({ on: false, t: 0, p: new V3(), s: 0 });
  const geo = PY.stars.g;
  onUpdate((dt) => {
    PY.time += dt; PY.stars.m.uniforms.uTime.value = PY.time; PY.smoke.m.uniforms.uTime.value = PY.time;
    const k = { low: 4, medium: 6 }[QNAME] || K_TRAIL; PY.stars.m.uniforms.uK.value = k - 1;  // fewer trail samples on lower tiers
    geo.setDrawRange(0, k);
    // rockets: climb with a slight wobble, shed a spark tail, burst at apex
    let active = 0;
    for (const r of PY.rockets) { if (!r.on) continue; active++; r.v.y -= 4.9 * dt; r.wob += dt * 9; r.v.x += Math.sin(r.wob) * 0.6 * dt; r.p.addScaledVector(r.v, dt); r.fuse -= dt;
      r.acc += dt * 70; while (r.acc > 1) { r.acc--; star(r.p.x, r.p.y, r.p.z, R(-1.2, 1.2) - r.v.x * 0.05, R(-4, -1.5), R(-1.2, 1.2) - r.v.z * 0.05, [2.4, 1.15, 0.35], R(0.4, 0.8), R(0.16, 0.26), 2.6, 0.6, 5, 0); }
      star(r.p.x, r.p.y, r.p.z, 0, 0, 0, [2.8, 2.2, 1.4], 0.05, 0.42, 1, 0, 0, 0);
      if (r.fuse <= 0) { r.on = false; _a.copy(r.v).multiplyScalar(0.25); burst(r.sh, r.p, _a); } }
    PY.rockets.active = active;
    for (const e of PY.events) if (e.on && PY.time >= e.at) { e.on = false; runEvent(e); }
    flush(PY.stars, PY.dirty); flush(PY.smoke, PY.sDirty);
    // light: a sharp flash that falls off in ~0.3 s, then a dim afterglow while the stars fall
    let flash = 0;
    for (const L of PY.lights) { L.userData.t += dt; const tt = L.userData.t, f = Math.exp(-tt * 9) + 0.12 * Math.exp(-tt * 1.1); L.intensity = tt < 5 ? L.userData.I * f : 0; flash += tt < 5 ? f * L.userData.I / 7000 : 0; }
    PY.flash = flash; bloom.strength = EXPO.bloom * (1 + Math.min(0.9, flash * 0.45));             // bloom swells with the flash; the roll-off keeps it from clipping
    updateShocks(dt);
    PY.energy *= Math.exp(-dt * 0.9); PY.sky.multiplyScalar(Math.exp(-dt * 2.6)); S.fwTint = PY.sky; S.fwEnergy = PY.energy;
    // live-star estimate (spawn rate × mean life) for the burst budget
    PY.alive = PY.alive * Math.exp(-dt / 2.8) + PY.spawned; PY.spawned = 0;
    tickAuto(dt);
  });
}
const shellName = k => t(TYPE_NAMES[k] || k);

export { THEMES, mine, star, PY, PAL, FAMILY, TYPES, TYPE_NAMES, SITES, SITE_NAMES, SEQ, SEQ_NAMES, LEVELS, buildPyro, launch, burst, play, setAuto, show, shellName, starPos };
