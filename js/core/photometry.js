/* =========================================================================
   PHOTOMETRY — real light units for the whole renderer (shared by any park that opts in).

   Every light is authored in physical units and the camera exposes the scene like a real camera:
     • the sun in lux (illuminance), sky light as an environment normalised to a target illuminance,
     • practical lamps in candela with true inverse-square falloff (distance 0 = no artificial cut-off),
     • emissive surfaces in nits (cd/m²) — a lit shop window ~60, a lantern globe ~400, a bulb ~800.
   Exposure is computed like an incident-light meter (EV100 = log2(E / 2.5)) from what actually lights the
   viewer, eases toward it like an eye adapting, and keeps nights a little darker than "correct" so they read
   as night. Everything is PRE-EXPOSED (light × exposure before shading), so half-float buffers never overflow,
   and tone mapping only has to roll highlights off gently.
   ========================================================================= */
import * as THREE from 'three';

const PH = {
  ev: 12, evTarget: 12, comp: 0, pre: 1 / (1.2 * 4096),   // EV100, its target, user compensation (stops), pre-exposure factor
  lamps: [], glows: [], basics: [],                      // registries re-scaled whenever exposure changes
  u: { uPre: { value: 1 }, uAmb: { value: 1 } },          // for custom shaders: pre-exposure, and ambient sky radiance (pre-exposed)
};
// colour temperature (Kelvin) → linear RGB, normalised so the brightest channel is 1
function kelvin(K, out = new THREE.Color()) {
  const t = K / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = v => Math.min(255, Math.max(0, v)) / 255; out.setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
  const m = Math.max(out.r, out.g, out.b); return out.multiplyScalar(1 / m);
}
// direct-normal sun illuminance from elevation (Meinel air-mass model, ~105 lm/W, reddening reduces efficacy)
function sunLux(elDeg) { if (elDeg <= -0.8) return 0; const e = Math.max(elDeg, 0.5) * Math.PI / 180, am = 1 / (Math.sin(e) + 0.50572 * Math.pow(elDeg + 6.07995, -1.6364));
  const W = 1353 * Math.pow(0.7, Math.pow(am, 0.678)); return W * 98 * THREE.MathUtils.smoothstep(elDeg, -0.8, 1.5); }
// diffuse sky illuminance on a horizontal plane (measured twilight curves, interpolated in log space)
const SKY_T = [[-9, 0.3], [-6, 3.4], [-4, 18], [-2, 80], [0, 420], [2, 1300], [5, 3600], [10, 7200], [20, 12000], [40, 18000]];
function skyLux(elDeg) { const T = SKY_T; if (elDeg <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (elDeg <= T[i][0]) { const [a, la] = T[i - 1], [b, lb] = T[i], k = (elDeg - a) / (b - a); return Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * k); } return T[T.length - 1][1]; }
// sun colour temperature through the atmosphere
function sunKelvin(elDeg) { return THREE.MathUtils.clamp(1850 + 210 * Math.max(elDeg, 0) + 30 * Math.max(elDeg, 0) ** 1.5, 1850, 5800); }

// a practical lamp: candela + colour (a hex or a temperature). Returns the logical light.
function lampCd(light, cd) { light.userData.cd = cd; PH.lamps.push(light); light.intensity = cd * PH.pre; return light; }
// an emissive standard material that glows at a real luminance
function glow(mat, nits) { mat.userData.nits = nits; PH.glows.push(mat); mat.emissiveIntensity = nits * PH.pre; return mat; }
function setGlow(mat, nits) { mat.userData.nits = nits; mat.emissiveIntensity = nits * PH.pre; }
// an unlit material (bulbs, sparks) whose colour is a luminance in nits
function glowBasic(mat, nits, color = 0xffffff) { mat.userData.nits = nits; mat.userData.hue = new THREE.Color(color); PH.basics.push(mat); mat.color.copy(mat.userData.hue).multiplyScalar(nits * PH.pre); return mat; }

// incident-meter exposure: E (lux at the viewer) → EV100; nights keep ~1.3 stops of "darkness" so they read as night
function evFor(E) { const ev = Math.log2(Math.max(E, 0.05) / 2.5); return ev + THREE.MathUtils.clamp((6 - ev) * 0.22, 0, 1.3); }
function setExposureTarget(E) { PH.evTarget = evFor(E); }
function adapt(dt, snap = false) {
  const gap = Math.abs(PH.evTarget - PH.ev), k = snap ? 1 : 1 - Math.exp(-dt * ((PH.evTarget < PH.ev ? 0.9 : 1.6) + gap * gap * 0.35));   // eyes open to the dark slower than they close to light; big shocks resolve fast
  PH.ev += (PH.evTarget - PH.ev) * k; PH.pre = 1 / (1.2 * Math.pow(2, PH.ev - PH.comp)); PH.u.uPre.value = PH.pre;
  for (const l of PH.lamps) l.intensity = l.userData.cd * PH.pre;
  for (const m of PH.glows) m.emissiveIntensity = m.userData.nits * PH.pre;
  for (const m of PH.basics) m.color.copy(m.userData.hue).multiplyScalar(m.userData.nits * PH.pre);
}

export { PH, kelvin, sunLux, skyLux, sunKelvin, lampCd, glow, setGlow, glowBasic, evFor, setExposureTarget, adapt };
