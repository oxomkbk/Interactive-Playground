/* =========================================================================
   TIME OF DAY — one dial: 0 = day, 1 = sunset, 2 = night. MOOD.v eases toward MOOD.target at a frame-rate
   independent rate; `look(path)` returns the blended value of any entry in CONFIG.times (colours, numbers,
   and the sun direction), so every system reads the same blend.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const T = CONFIG.times, KEYS = ['day', 'sunset', 'night'];
const MOOD = { v: 2, target: 2, changed: true };
const setTime = () => { MOOD.target = 2; }; // Nightfall: the park only ever lives at night
const timeName = () => KEYS[Math.round(MOOD.target)];

function updateMood(dt) {
  const d = MOOD.target - MOOD.v; MOOD.changed = Math.abs(d) > 1e-4;
  if (MOOD.changed) MOOD.v = Math.abs(d) < 0.002 ? MOOD.target : MOOD.v + d * (1 - Math.exp(-T.speed * dt));
}
const get = (o, path) => path.split('.').reduce((a, k) => a[k], o);
const span = () => { const i = Math.min(1, Math.floor(MOOD.v)), k = MOOD.v - i; return [T[KEYS[i]], T[KEYS[i + 1]], k]; };
const _a = new THREE.Color(), _b = new THREE.Color();
function lookColor(path, out = new THREE.Color()) { const [a, b, k] = span(); return out.copy(_a.set(get(a, path))).lerp(_b.set(get(b, path)), k); }
function lookNum(path) { const [a, b, k] = span(); return get(a, path) + (get(b, path) - get(a, path)) * k; }
const sunVec = (s, out) => { const el = THREE.MathUtils.degToRad(s.elevation), az = THREE.MathUtils.degToRad(s.azimuth); return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)); };
const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3();
function sunDir(out = new THREE.Vector3()) { const [a, b, k] = span(); return out.copy(sunVec(a.sun, _s1)).lerp(sunVec(b.sun, _s2), k).normalize(); }
// 0 → 1 as night falls (sunset counts a little), for lamps, windows and fireflies
const nightness = () => (MOOD.v <= 1 ? MOOD.v * 0.3 : 0.3 + (MOOD.v - 1) * 0.7);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export { MOOD, KEYS, setTime, timeName, updateMood, lookColor, lookNum, sunDir, nightness, damp };
