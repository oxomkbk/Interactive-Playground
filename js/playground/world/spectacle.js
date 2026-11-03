/* =========================================================================
   SPECTACLE — the layer that makes the park read as an enchanted night festival from every angle:
   • a sky of floating paper lanterns: hundreds of warm lanterns hanging over the park at every height,
     bobbing and drifting on the air, brighter at the bottom where the flame is (and mirrored in the water)
   • searchlight beams: six soft shafts of champagne, lavender and rose light rising from the castle terrace
     and the gate, sweeping slowly across the sky like an opening night
   • a canopy of festoon lights: eight gilded masts round the plaza strung across with sagging catenaries of
     bulbs in a star, so the fountain sits under a tent of light; zigzag festoons hung the length of the
     boulevard between the shopfronts
   • fairy lights in every tree: each canopy in the park is wound with tiny twinkling lights on its outer
     shell, warm white and gold, rose in the blossom trees
   • glowing flower carpets: drifts of luminous blooms in rose, lavender, aqua and gold across the lawns,
     breathing slowly
   Everything is point sprites sized in metres (a handful of draw calls for tens of thousands of lights);
   nothing allocates per frame.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { renderer, camera, BOOT_TIER } from '../core/renderer.js';
import { nightness } from '../core/mood.js';
import { heightAt } from './ground.js';

const L = CONFIG.layout, TAU = Math.PI * 2;
const R = (a, b) => a + (b - a) * Math.random(), pick = (a) => a[Math.floor(Math.random() * a.length)];
const TIER = { high: 1, medium: 0.65, low: 0.35 }[BOOT_TIER] || 0.65;

// point lights drawn as sprites: per-point colour, size (m), phase; `shape` 0 = soft bulb, 1 = paper lantern
function glowPoints(list, { shape = 0, twinkle = 0.3, drift = 0, gain = 1, maxPx = 90, near = 0 } = {}) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), aP = new Float32Array(n * 2);
  list.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); col.set([p.c.r, p.c.g, p.c.b], i * 3); aP.set([p.s, Math.random() * 100], i * 2); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aP', new THREE.BufferAttribute(aP, 2));
  const U = { uT: { value: 0 }, uScale: { value: 500 }, uNight: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexColors: true,
    vertexShader: /* glsl */`uniform float uT, uScale, uNight; attribute vec2 aP; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; float ph = aP.y;
        p += vec3(sin(uT * 0.07 + ph) * 2.2, sin(uT * 0.31 + ph * 1.7) * 0.6, cos(uT * 0.05 + ph * 0.6) * 2.2) * ${drift.toFixed(2)};
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = max(-mv.z, 0.5);
        float tw = 1.0 - ${twinkle.toFixed(2)} * (0.5 + 0.5 * sin(uT * (1.3 + fract(ph) * 3.7) + ph * 6.0));
        // a light smaller than two pixels is drawn at two pixels and dimmed in proportion, so distant lights fade
        // smoothly instead of popping on and off between pixels (a classic source of shimmer)
        float px = aP.x * uScale / d, sub = clamp(px / 2.0, 0.0, 1.0);
        vC = color * tw * uNight * ${gain.toFixed(2)} * sub * sub; vA = clamp(1.0 - d / 900.0, 0.0, 1.0)${near > 0 ? ` * smoothstep(${(near * 0.4).toFixed(1)}, ${near.toFixed(1)}, d)` : ''};
        gl_PointSize = clamp(px, 2.0, ${maxPx.toFixed(1)}); }`,
    fragmentShader: /* glsl */`varying vec3 vC; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p);
        ${shape === 1 ? `vec2 q = p * vec2(1.6, 1.15); float e = dot(q, q), a = exp(-e * 22.0) * (0.75 + 0.5 * (p.y + 0.5)) + exp(-e * 5.0) * 0.12;
        vec3 c = vC * a;`
        : `float a = exp(-r * r * 30.0) + exp(-r * r * 6.0) * 0.22; vec3 c = vC * a;`}
        if (a < 0.01) discard; gl_FragColor = vec4(c * vA, 1.0); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return { object: pts, U };
}

// a soft shaft of light: an open cone, brightest through its core and fading with height
function beam(color) {
  const H = 300, g = new THREE.CylinderGeometry(13, 0.35, H, 32, 1, true).translate(0, H / 2, 0);
  const U = { uC: { value: new THREE.Color(color) }, uK: { value: 0.1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; vY = position.y / ${H}.0; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float a = core * pow(1.0 - vY, 1.8) * smoothstep(0.0, 0.015, vY) * uK; gl_FragColor = vec4(uC * a, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; return { mesh, U };
}

function createSpectacle({ veg, park }) {
  const root = new THREE.Group(); root.name = 'spectacle';
  const systems = [], col = (h) => new THREE.Color(h);

  // ---------- the lantern sky ----------
  const LANT = ['#FF9A3C', '#FFAE52', '#FF8A4C', '#FFB866', '#FF7A5C', '#FFA24A'], lanterns = [];
  for (let i = 0; i < Math.round(520 * TIER); i++) { const a = R(0, TAU), r = Math.pow(Math.random(), 0.7) * 120, x = Math.sin(a) * r, z = Math.cos(a) * r - 10;
    lanterns.push({ x, y: R(13, 48) + (r < 40 ? 0 : R(0, 10)), z, s: R(0.75, 1.15), c: col(pick(LANT)).multiplyScalar(R(0.9, 1.35)) }); }
  // lanterns stay small warm points even when one drifts close overhead (no swollen white discs), and fade as they pass near
  const lantSys = glowPoints(lanterns, { shape: 1, twinkle: 0.08, drift: 1, gain: 1, maxPx: 26, near: 22 }); root.add(lantSys.object); systems.push(lantSys);

  // ---------- searchlights ----------
  const cs = L.castle.scale || 1, beams = [];
  for (const [x, y, z, c, ph] of [[-30 * cs, 10, L.castle.z + 2, '#FFE2B8', 0], [30 * cs, 10, L.castle.z + 2, '#FFE2B8', 2.1], [-12 * cs, 9, L.castle.z + 12, '#C9A8FF', 4.2], [12 * cs, 9, L.castle.z + 12, '#FFA8CF', 1.3],
    [-13, 2, L.gate.z + 2, '#FFC8E0', 3.1], [13, 2, L.gate.z + 2, '#D6C2FF', 5.0]]) { const b = beam(c); b.mesh.position.set(x, y, z); b.ph = ph; root.add(b.mesh); beams.push(b); }

  // ---------- the festoon canopy over the plaza and the boulevard ----------
  const bulbs = [], wires = [], WARM = ['#FFD9A0', '#FFC77E', '#FFDDB0', '#FFCF96', '#FFB0C8'];
  const swag = (a, b, sag, step = 0.55) => { const n = Math.max(2, Math.round(a.distanceTo(b) / step)); let prev = null;
    for (let i = 0; i <= n; i++) { const u = i / n, p = a.clone().lerp(b, u); p.y -= sag * 4 * u * (1 - u); if (i > 0 && i < n) bulbs.push({ x: p.x, y: p.y, z: p.z, s: 0.11, c: col(pick(WARM)).multiplyScalar(1.35) }); if (prev) wires.push(prev, p.clone()); prev = p.clone(); } };
  const MR = 16.8, MH = 10.5, masts = [];
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; masts.push(new THREE.Vector3(Math.sin(a) * MR, heightAt(Math.sin(a) * MR, Math.cos(a) * MR) + MH, Math.cos(a) * MR)); }
  for (let k = 0; k < 8; k++) { swag(masts[k], masts[(k + 3) % 8], 2.6); swag(masts[k], masts[(k + 1) % 8], 1.1); }
  { const mastG = new THREE.CylinderGeometry(0.09, 0.16, MH, 10).translate(0, MH / 2, 0), gold = new THREE.MeshStandardMaterial({ color: '#d8b46a', metalness: 0.85, roughness: 0.3 });
    const fin = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.5, 1.5), toneMapped: false });
    for (const m of masts) { const p = new THREE.Mesh(mastG, gold); p.position.set(m.x, m.y - MH, m.z); p.castShadow = true; root.add(p);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), fin); f.position.copy(m).y += 0.3; root.add(f); } }
  const b = L.boulevard, hw = b.w / 2 + 1.6;
  for (let z = b.z0 + 4; z < b.z1 - 4; z += 7) { swag(new THREE.Vector3(-hw, 6.4, z), new THREE.Vector3(hw, 6.4, z + 3.5), 0.9); swag(new THREE.Vector3(hw, 6.4, z + 3.5), new THREE.Vector3(-hw, 6.4, z + 7), 0.9); }
  const wireG = new THREE.BufferGeometry().setFromPoints(wires); root.add(new THREE.LineSegments(wireG, new THREE.LineBasicMaterial({ color: '#2a2333', transparent: true, opacity: 0.55 })));

  // ---------- fairy lights in every tree ----------
  // a fixed budget spread over every canopy in the park (so it never balloons with the tree count)
  const inPark = (veg.clumps || []).filter(c => c.kind !== 'needle' && Math.hypot(c.p.x, c.p.z) < L.parkRadius + 4), BUDGET = Math.round(16000 * TIER), PERF = BUDGET / Math.max(1, inPark.length);
  const BLOSSOM = ['#FFC8DC', '#FFE6F0', '#FFD9A8'], FAIRY = ['#FFE9C2', '#FFD58C', '#FFF4E0', '#FFE0A8'], _d = new THREE.Vector3();
  for (const c of inPark) { const PER = Math.floor(PERF) + (Math.random() < PERF % 1 ? 1 : 0); const pinkish = c.c && new THREE.Color(c.c).r > 0.85 && new THREE.Color(c.c).b > 0.6;
    for (let k = 0; k < PER; k++) { _d.set(R(-1, 1), R(-0.6, 1), R(-1, 1)).normalize().multiplyScalar(R(0.85, 1.08));
      bulbs.push({ x: c.p.x + _d.x * c.s.x, y: c.p.y + _d.y * c.s.y, z: c.p.z + _d.z * c.s.z, s: 0.07, c: col(pick(pinkish ? BLOSSOM : FAIRY)).multiplyScalar(R(0.9, 1.6)) }); } }
  const bulbSys = glowPoints(bulbs, { twinkle: 0.14, gain: 1, maxPx: 22 });   // a bulb overhead stays a bulb, never a glowing ball root.add(bulbSys.object); systems.push(bulbSys);

  // ---------- glowing flower carpets on the lawns ----------
  const FLOW = ['#FF7FB0', '#C59BFF', '#7FE6E0', '#FFD27A', '#FF9ED0', '#A9B8FF'], blooms = [];
  const NF = Math.round(4200 * TIER);
  for (let i = 0, tries = 0; i < NF && tries < NF * 8; tries++) { const a = R(0, TAU), r = Math.sqrt(Math.random()) * (L.parkRadius - 3), x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!park.clear(x, z, 0.5)) continue;
    const drift = Math.sin(x * 0.11 + Math.cos(z * 0.07) * 2.0) * Math.cos(z * 0.09 - x * 0.03); if (drift < 0.15 && Math.random() > 0.15) continue;   // drifts, not an even sprinkle
    i++; blooms.push({ x, y: heightAt(x, z) + R(0.12, 0.5), z, s: R(0.07, 0.13), c: col(pick(FLOW)).multiplyScalar(R(0.8, 1.4)) }); }
  const bloomSys = glowPoints(blooms, { twinkle: 0.2, gain: 1 }); root.add(bloomSys.object); systems.push(bloomSys);

  // ---------- the drone light show above the castle ----------
  // a few hundred lights hanging in a vertical plane over the château, facing the boulevard, morphing every nine
  // seconds between formations (each sampled evenly along its outlines), every drone easing to its new place with a
  // small delay by index so each change sweeps across the formation like a wave
  const ND = Math.round(360 * Math.max(0.6, TIER)), DC = new THREE.Vector3(0, 84, L.castle.z + 14);
  const sampleLines = (lines) => { const segs = []; let tot = 0; for (const ln of lines) for (let i = 0; i < ln.length - 1; i++) { const a = ln[i], b = ln[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, l]); tot += l; }
    const out = []; for (let k = 0; k < ND; k++) { let d = (k + 0.5) / ND * tot; for (const [a, b, l] of segs) { if (d <= l) { const u = d / l; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); break; } d -= l; } if (out.length <= k) out.push([0, 0]); } return out; };
  const circle = (r, n = 64, cx = 0, cy = 0, a0 = 0, a1 = TAU) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const heartL = (sc = 1, cx = 0, cy = 0) => Array.from({ length: 81 }, (_, i) => { const t = i / 80 * TAU; return [cx + 16 * Math.sin(t) ** 3 * sc, cy + (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * sc]; });
  const starL = (R1, R2, cx = 0, cy = 0) => Array.from({ length: 11 }, (_, i) => { const a = Math.PI / 2 + i / 10 * TAU, r = i % 2 ? R2 : R1; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const FORMS = [
    { lines: [[[-20, -13], [20, -13], [20, 13], [-20, 13], [-20, -13]], [[-20, 13], [0, -1], [20, 13]], heartL(0.22, 0, -4)], cols: ['#FFB3CF', '#FFE2EC', '#FF7FAE'] },   // a love letter
    { lines: [heartL(1.25)], cols: ['#FF6F9E', '#FFA6C4'] },
    { lines: [starL(22, 9)], cols: ['#FFD27A', '#FFF0C8'] },
    { lines: [circle(19), circle(3, 20), ...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU; return [[Math.cos(a) * 3, Math.sin(a) * 3], [Math.cos(a) * 19, Math.sin(a) * 19]]; })], cols: ['#C9A8FF', '#FFC0E0', '#FFE3A8'] },   // the Starlight Wheel
    { lines: [[[-24, -12], [-24, 2], [-20, 9], [-16, 2], [-16, -2], [-8, -2], [-8, 6], [-4, 14], [0, 22], [4, 14], [8, 6], [8, -2], [16, -2], [16, 2], [20, 9], [24, 2], [24, -12], [-24, -12]]], cols: ['#FFE6B8', '#B9C8FF'] },   // the castle
    { lines: [circle(14, 48, 0, 0, Math.PI * 0.3, Math.PI * 1.7), circle(11, 40, 5, 0, Math.PI * 0.42, Math.PI * 1.58).reverse(), starL(3.5, 1.4, 14, 12), starL(2.6, 1, 19, -3), starL(2.2, 0.9, -18, 14)], cols: ['#E8F0FF', '#FFE7A8'] },   // crescent and stars
    { lines: [circle(22, 80), circle(15, 60), circle(8, 40)], cols: ['#7FE6FF', '#C59BFF', '#FF9ED0'] },
    { lines: [Array.from({ length: 140 }, (_, i) => { const t = i / 139 * 3.2 * TAU, r = 1.5 + t * 1.0; return [Math.cos(t) * r, Math.sin(t) * r * 0.75]; })], cols: ['#FFD9F0', '#C9B8FF', '#FFE9B8'] },   // a spiral galaxy
  ].map(f => ({ pts: sampleLines(f.lines), cols: f.cols.map(c => new THREE.Color(c)) }));
  const dPos = new Float32Array(ND * 3), dCol = new Float32Array(ND * 3), dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dg.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  const DU = { uScale: { value: 500 }, uNight: { value: 1 } };
  const dm = new THREE.ShaderMaterial({ uniforms: DU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexColors: true,
    vertexShader: `uniform float uScale, uNight; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float px = 0.55 * uScale / -mv.z; vC = color * uNight * clamp(px / 2.0, 0.0, 1.0); gl_PointSize = clamp(px, 2.0, 16.0); }`,
    fragmentShader: `varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5); float a = exp(-r * r * 26.0) + exp(-r * r * 6.0) * 0.15; if (a < 0.01) discard; gl_FragColor = vec4(vC * a * 1.6, 1.0); }` });
  const drones = new THREE.Points(dg, dm); drones.frustumCulled = false; root.add(drones);
  const DS = { form: 0, t: 0 }, _ca = new THREE.Color(), _cb = new THREE.Color();
  function stepDrones(dt, t) { DS.t += dt; if (DS.t > 9) { DS.t = 0; DS.form = (DS.form + 1) % FORMS.length; }
    const A = FORMS[(DS.form + FORMS.length - 1) % FORMS.length], B = FORMS[DS.form];
    for (let i = 0; i < ND; i++) { const u = THREE.MathUtils.smoothstep(DS.t - (i / ND) * 1.2, 0, 2.2), pa = A.pts[i], pb = B.pts[i];
      const x = pa[0] + (pb[0] - pa[0]) * u, y = pa[1] + (pb[1] - pa[1]) * u, bob = Math.sin(t * 1.3 + i * 0.7) * 0.15;
      dPos[i * 3] = DC.x + x; dPos[i * 3 + 1] = DC.y + y + bob; dPos[i * 3 + 2] = DC.z + Math.sin(u * Math.PI) * 4 * Math.sin(i);
      _ca.copy(A.cols[i % A.cols.length]).lerp(_cb.copy(B.cols[i % B.cols.length]), u); const tw = 0.85 + 0.15 * Math.sin(t * 3 + i);
      dCol[i * 3] = _ca.r * tw; dCol[i * 3 + 1] = _ca.g * tw; dCol[i * 3 + 2] = _ca.b * tw; }
    dg.attributes.position.needsUpdate = true; dg.attributes.color.needsUpdate = true; }

  // ---------- laser fans from the castle towers ----------
  const lasers = []; const LC = ['#FF6FAE', '#B48CFF', '#6FE3FF', '#FFD27A'];
  for (let k = 0; k < 8; k++) { const H = 260, g = new THREE.CylinderGeometry(0.9, 0.06, H, 6, 1, true).translate(0, H / 2, 0), U = { uC: { value: new THREE.Color(LC[k % 4]) }, uK: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying float vY; void main(){ vY = position.y / ${H}.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uC; uniform float uK; varying float vY; void main(){ gl_FragColor = vec4(uC * uK * pow(1.0 - vY, 2.0), 1.0); }` });
    const mesh = new THREE.Mesh(g, m); mesh.position.set((k < 4 ? -1 : 1) * 13 * cs, 8 + 30 * cs, L.castle.z + 6); mesh.frustumCulled = false; root.add(mesh); lasers.push({ mesh, U, k }); }

  return {
    object3D: root,
    update(dt, t) {
      stepDrones(dt, t);
      // the lasers fan open and close in a slow choreography, brightest while the drones change formation
      { const pulse = 0.5 + 0.5 * Math.sin(t * 0.35), change = 1 - THREE.MathUtils.smoothstep(DS.t, 0, 3);
        for (const L2 of lasers) { const side = L2.k < 4 ? -1 : 1, j = L2.k % 4, fan = (j - 1.5) * (0.22 + 0.18 * pulse);
          L2.mesh.rotation.set(-0.35 + Math.sin(t * 0.5 + j) * 0.12, 0, side * (0.15 + fan) * -1 + Math.sin(t * 0.7 + L2.k) * 0.08); L2.U.uK.value = (0.035 + 0.06 * change) * Math.max(0, (nightness() - 0.25) / 0.75); } }
      const night = Math.max(0, (nightness() - 0.25) / 0.75), scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      for (const s of systems) { s.U.uT.value = t; s.U.uScale.value = scale; s.U.uNight.value = night; }
      DU.uScale.value = scale; DU.uNight.value = night;
      for (const bm of beams) { const az = t * 0.11 + bm.ph, tilt = 0.32 + 0.16 * Math.sin(t * 0.17 + bm.ph * 1.3); bm.mesh.rotation.set(Math.sin(az) * tilt, 0, Math.cos(az) * tilt); bm.U.uK.value = 0.05 * night; }
    },
  };
}

export { createSpectacle };
