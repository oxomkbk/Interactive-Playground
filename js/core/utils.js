import * as THREE from 'three';

/* =========================================================================
   0. UTILITIES
   ========================================================================= */
const V3 = THREE.Vector3;
const PI = Math.PI, TAU = Math.PI * 2;
let _seed = 20261031;
function rand() { // mulberry32 — deterministic so the park is identical every visit
  _seed = (_seed + 0x6D2B79F5) | 0; let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const R = (a = 0, b = 1) => a + (b - a) * rand();
const pick = a => a[Math.floor(rand() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 60); }); // timer fallback keeps loading in background tabs
const $ = s => document.querySelector(s);
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

// tileable hash value-noise (CPU) used by the texture generators and terrain
function hash2i(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295;
}
function vnoise(x, y, per = 1e6, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), m = a => ((a % per) + per) % per;
  const a = hash2i(m(xi), m(yi), s), b = hash2i(m(xi + 1), m(yi), s), c = hash2i(m(xi), m(yi + 1), s), d = hash2i(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, per = 1e6, oct = 4, s = 0) {
  let f = 0, amp = 0.5, fr = 1, norm = 0;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, per * fr, s + i * 13); norm += amp; amp *= 0.5; fr *= 2; }
  return f / norm;
}

function setSeed(v) { _seed = v; }

export { V3, PI, TAU, _seed, rand, R, pick, clamp, lerp, smooth, damp, hdr, nextFrame, $, yawTo, hash2i, vnoise, fbm, setSeed };
