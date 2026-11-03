/* =========================================================================
   GEO — shapes and small helpers for a soft, rounded world: palette materials (cached), puffy hearts, rounded
   boxes, rods between points, swept channels, and small canvas textures (candy stripes, speckle).
   ========================================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const PAL = CONFIG.palette;

// deterministic RNG so the park is identical on every visit
let _seed = CONFIG.seed;
function rand() { _seed = (_seed + 0x6D2B79F5) | 0; let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const R = (a = 0, b = 1) => a + (b - a) * rand();
const pick = a => a[Math.floor(rand() * a.length)];

/* ---------------- materials ---------------- */
// soft: matte pastel (rough .6–.8); gloss: clearcoat candy plastic; glow: emissive for bloom
const _mc = new Map();
function mat(color, o = {}) {
  const key = !o.map && color + JSON.stringify(o); if (key && _mc.has(key)) return _mc.get(key);
  const p = { color: new THREE.Color(color), roughness: o.rough ?? 0.68, metalness: o.metal ?? 0 };
  if (o.glow) { p.emissive = new THREE.Color(o.glowColor ?? color); p.emissiveIntensity = o.glow; }
  if (o.map) p.map = o.map; if (o.side) p.side = o.side; if (o.vc) p.vertexColors = true; if (o.flat) p.flatShading = true;
  if (o.transparent) Object.assign(p, { transparent: true, opacity: o.opacity ?? 0.5, depthWrite: false });
  const m = o.gloss ? new THREE.MeshPhysicalMaterial({ ...p, clearcoat: 0.7, clearcoatRoughness: 0.38, sheen: o.sheen ?? 0, sheenColor: new THREE.Color('#ffffff'), iridescence: o.irid ?? 0, iridescenceIOR: 1.3 })
    : new THREE.MeshStandardMaterial(p);
  if (key) _mc.set(key, m); return m;
}

/* ---------------- shapes ---------------- */
// the parametric heart: width ≈ 2s, height ≈ 1.8s, lobes toward +y, centred
function heartPts(s, n = 72) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    pts.push(new THREE.Vector2(x / 16 * s, (y / 16 + 0.15) * s)); }
  return pts;
}
const heartShape = (s, n) => new THREE.Shape(heartPts(s, n));
function heartGeo(s, depth = s * 0.5, n = 48) { // puffy, bevelled heart in the XY plane
  const g = new THREE.ExtrudeGeometry(heartShape(s, n), { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: s * 0.14, bevelSegments: 5, curveSegments: 4 });
  g.center(); g.computeVertexNormals(); return g;
}
function pip(pts, x, y) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
const rbox = (w, h, d, r = Math.min(w, h, d) * 0.3, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
// a rod from a to b (as geometry, already placed in world space)
function rodGeo(a, b, r, seg = 12, r2 = r) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r2, r, L, seg);
  const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m);
}
// sweep an open 2D profile along a curve, "up" kept near world up — slide chutes, rails
function sweep(curve, prof, segs = 80) {
  const pos = [], uv = [], idx = [], P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3(), L = curve.getLength();
  for (let i = 0; i <= segs; i++) { const u = i / segs; curve.getPointAt(u, P); curve.getTangentAt(u, T); S.crossVectors(T, UP).normalize(); N.crossVectors(S, T).normalize();
    prof.forEach((p, k) => { pos.push(P.x + S.x * p.x + N.x * p.y, P.y + S.y * p.x + N.y * p.y, P.z + S.z * p.x + N.z * p.y); uv.push(k / (prof.length - 1), u * L / 2); }); }
  const w = prof.length; for (let i = 0; i < segs; i++) for (let k = 0; k < w - 1; k++) { const a = i * w + k, b = a + w; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------------- textures ---------------- */
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const stripeTex = (c1 = PAL.rose, c2 = PAL.cream, n = 6) => canvasTex(64, 256, (g) => { g.fillStyle = c2; g.fillRect(0, 0, 64, 256); g.fillStyle = c1;
  for (let i = -2; i < n + 2; i++) { const y = i * 256 / n; g.beginPath(); g.moveTo(0, y); g.lineTo(64, y - 32); g.lineTo(64, y - 32 + 128 / n); g.lineTo(0, y + 128 / n); g.fill(); } });
const speckleTex = (base, flecks, n = 900, size = 256, rmax = 2.2) => canvasTex(size, size, (g) => { g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) { g.fillStyle = flecks[i % flecks.length]; g.globalAlpha = 0.3 + rand() * 0.5; g.beginPath(); g.arc(rand() * size, rand() * size, 0.6 + rand() * rmax, 0, TAU); g.fill(); } });
// soft round blob with a falloff — petal carpets, glows
const blobTex = (rgb = '255,200,220') => canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.55, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, false);

export { UP, TAU, PAL, rand, R, pick, mat, heartPts, heartShape, heartGeo, pip, rbox, rodGeo, sweep, canvasTex, stripeTex, speckleTex, blobTex };
