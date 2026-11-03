/* =========================================================================
   ART DIRECTION — one pass over every material once the park is built, so models made in different
   modules read as one world:
   • Lit surfaces: albedo hue pulled toward the park palette, saturation and value kept inside one band
     (no pure whites, no neon paint), roughness/metalness clamped to a shared PBR range, reflections
     scaled by material class, every surface fogged.
   • Glows (unlit emissive meshes, sprites, bulbs): hue snapped to the four light families —
     ember amber, witch violet, ghost green, blood red (+ moonlight) — and brightness normalised into
     one HDR band, so bloom responds the same everywhere.
   ========================================================================= */
import * as THREE from 'three';
import { weather } from './surface.js';
import { clamp, lerp } from './utils.js';
import { scene } from './renderer.js';

// light families (hue 0..1) — everything that glows belongs to one of these
const GLOW_HUES = [0.075, 0.115, 0.42, 0.76, 0.0, 0.62];
// palette anchors for lit surfaces: bruised violet, rust/pumpkin, bone, moss, night blue
const SURF_HUES = [0.78, 0.06, 0.1, 0.3, 0.63];
const _h = {};
const nearestHue = (h, set) => { let best = set[0], bd = 9; for (const c of set) { const d = Math.min(Math.abs(h - c), 1 - Math.abs(h - c)); if (d < bd) { bd = d; best = c; } } return best; };
const mixHue = (a, b, k) => { let d = b - a; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return (a + d * k + 1) % 1; };

function gradeSurface(c, isMetal) {
  c.getHSL(_h); const lum = _h.l;
  if (_h.s > 0.08) _h.h = mixHue(_h.h, nearestHue(_h.h, SURF_HUES), 0.3);
  _h.s = Math.min(_h.s, isMetal ? 0.5 : 0.62) * 0.92;
  _h.l = clamp(lum, 0.025, 0.78);
  c.setHSL(_h.h, _h.s, _h.l);
}
function gradeGlow(c, band) {
  const max = Math.max(c.r, c.g, c.b); if (max <= 0) return;
  const base = c.clone().multiplyScalar(1 / max); base.getHSL(_h);
  if (_h.s > 0.25) _h.h = mixHue(_h.h, nearestHue(_h.h, GLOW_HUES), 0.65);
  c.setHSL(_h.h, Math.min(1, _h.s * 1.05), _h.l).multiplyScalar(clamp(max, band[0], band[1]));
}
const seen = new WeakSet();
const STATS = { surfaces: 0, glows: 0 };
function unifyMaterial(m) {
  if (!m || seen.has(m) || m.userData.noGrade) return; seen.add(m);
  if (m.isMeshStandardMaterial) {
    const metal = m.metalness > 0.5;
    if (m.color) gradeSurface(m.color, metal);
    m.roughness = metal ? clamp(m.roughness, 0.22, 0.7) : clamp(m.roughness, m.clearcoat > 0.5 ? 0.25 : 0.38, 0.96);
    if (m.envMapIntensity === 1) m.envMapIntensity = metal ? 1.15 : 0.65;
    if (m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05 && !m.emissiveMap) { const e = m.emissive.clone(); gradeGlow(e, [0, 1]); m.emissive.copy(e); }
    m.fog = true; m.needsUpdate = true; STATS.surfaces++;
  } else if (m.isMeshBasicMaterial || m.isSpriteMaterial) {
    if (m.fog === false) return; // lightning & sky-like effects keep their own look
    const c = m.color, max = Math.max(c.r, c.g, c.b);
    if (max > 1.05) { gradeGlow(c, [1.35, 3.6]); STATS.glows++; }          // HDR glow
    else if (!m.map && max > 0.02) { gradeSurface(c, false); }           // flat-coloured prop: treat as a surface
    m.needsUpdate = true;
  }
}
const seenC = new WeakSet();
function unifyInstanceColors(mesh) {
  if (Array.isArray(mesh.userData.base)) for (const c of mesh.userData.base) if (c.isColor && !seenC.has(c)) { seenC.add(c); if (Math.max(c.r, c.g, c.b) > 1.05) gradeGlow(c, [1.35, 3.6]); }
  if (!mesh.isInstancedMesh || !mesh.instanceColor || mesh.userData.noGrade) return; const c = new THREE.Color(), a = mesh.instanceColor;
  for (let i = 0; i < mesh.count; i++) { c.fromArray(a.array, i * 3); if (Math.max(c.r, c.g, c.b) > 1.05) gradeGlow(c, [1.35, 3.6]); else gradeSurface(c, false); c.toArray(a.array, i * 3); }
  a.needsUpdate = true;
}
// Hollowmoor weathering palette (realism at the source): soot-dark grime climbing every wall, rain runs, wet moss on
// up-facing ledges (darker and glossier), worn edges — applied to every lit, opaque, non-glowing surface.
const HALLOW_WEATHER = { macro: 0.16, rough: 0.14, grime: 0.5, grimeH: 1.4, grimeCol: [0.13, 0.12, 0.11], streak: 0.26, top: 0.26, topCol: [0.11, 0.14, 0.08], topRough: -0.1, edge: 0.05 };
function weatherable(m) { if (!m.isMeshStandardMaterial || m.transparent || m.userData.noWeather) return false;
  const e = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) : 0; return e < 0.6 && !m.emissiveMap; }
function unifyLook(scene) {
  scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { unifyMaterial(m); if (weatherable(m)) weather(m, m.metalness > 0.6 ? { ...HALLOW_WEATHER, top: 0.12, streak: 0.34, edge: 0.1 } : HALLOW_WEATHER); } unifyInstanceColors(o); });
  return STATS;
}

export { HALLOW_WEATHER, GLOW_HUES, SURF_HUES, unifyLook, unifyMaterial, gradeGlow, gradeSurface };
