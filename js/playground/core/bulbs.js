/* =========================================================================
   BULBS — the park's decorative lighting: every outline bulb, LED strip, fairy light, path light and
   lantern. Bulbs are gathered per parent object (the static world, or a ride part that moves, such as the
   Ferris wheel or the carousel top) into one InstancedMesh each, and animated entirely in the vertex shader,
   so tens of thousands of lights cost a few draw calls. Each bulb carries two colours, a pattern, a phase and
   a speed:
     steady · chase (a pulse running along the string) · twinkle (fairy-light sparkle) · breathe ·
     wave (cross-fades between its two colours) · sparkle (rare crisp flashes, for crystals)
   Each bulb is one point sprite: a crisp round filament core inside a soft halo, sized in metres so it shrinks
   naturally with distance — always round, never a faceted blob. Output is HDR, so bulbs bloom; they never light
   the surfaces themselves (nightlights.js does that).
   ========================================================================= */
import * as THREE from 'three';
import { scene } from './renderer.js';

const PAT = { steady: 0, chase: 1, twinkle: 2, breathe: 3, wave: 4, sparkle: 5 };
const U = { uT: { value: 0 }, uK: { value: 3.2 }, uPx: { value: 800 } };
const mat = new THREE.ShaderMaterial({ uniforms: U, toneMapped: false, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute vec3 aCol, aCol2; attribute vec4 aP; attribute float aSize; uniform float uT, uK, uPx; varying vec3 vC;
    void main(){
      float pat = aP.x, ph = aP.y, sp = aP.z, b = 1.0; vec3 col = aCol;
      if (pat < 0.5) b = 0.97 + 0.03 * sin(uT * 3.0 + ph * 40.0);
      else if (pat < 1.5) b = 0.22 + 0.78 * pow(0.5 + 0.5 * sin(ph * 6.2832 * aP.w - uT * sp), 5.0);
      else if (pat < 2.5) b = 0.5 + 0.5 * pow(0.5 + 0.5 * sin(uT * sp * 0.6 + ph * 97.0), 3.0);
      else if (pat < 3.5) b = 0.55 + 0.45 * sin(uT * sp + ph * 6.2832);
      else if (pat < 4.5) { col = mix(aCol, aCol2, 0.5 + 0.5 * sin(uT * sp + ph * 6.2832 * aP.w)); }
      else b = 0.45 + 0.9 * pow(max(0.0, sin(uT * sp * 0.5 + ph * 211.0)), 12.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      // the sprite spans the halo, five times the bulb; a bulb passing right overhead is capped in size and fades,
      // so it never swells into a white disc
      float dist = -mv.z; vC = col * b * uK * smoothstep(1.5, 6.0, dist);
      gl_PointSize = clamp(aSize * 5.0 * uPx / dist, 1.5, 28.0);
    }`,
  fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
      float core = smoothstep(0.26, 0.14, d), halo = exp(-d * d * 5.0) * 0.28;
      gl_FragColor = vec4(min(vC * (core + halo), vec3(5.0)), 1.0); }` });

function createBulbs() {
  const groups = new Map(); // parent → { items: [] }
  const _c = new THREE.Color(), _c2 = new THREE.Color();
  function add(parent, p, { color = '#FFD9A8', color2, pattern = 'steady', phase = Math.random(), speed = 2, size = 0.09, waves = 1 } = {}) {
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push({ p: p.clone(), c: color, c2: color2 || color, pat: PAT[pattern] ?? 0, ph: phase, sp: speed, s: size, w: waves });
  }
  const api = {
    add,
    // a string along points (phase runs 0 → 1 along it, so chases flow)
    line(parent, a, b, n, o = {}) { for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0.5; add(parent, a.clone().lerp(b, u), { ...o, phase: (o.phase0 || 0) + u }); } },
    ring(parent, center, radius, n, o = {}) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; add(parent, new THREE.Vector3(center.x + Math.sin(a) * radius, center.y, center.z + Math.cos(a) * radius), { ...o, phase: i / n }); } },
    curve(parent, pts, n, o = {}) { const cv = new THREE.CatmullRomCurve3(pts); for (let i = 0; i < n; i++) { const u = i / Math.max(1, n - 1); add(parent, cv.getPointAt(u), { ...o, phase: u }); } },
    // a rectangle (in the parent's space) at height y
    rect(parent, minX, maxX, minZ, maxZ, y, spacing, o = {}) { const P = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ], [minX, minZ]]; let acc = 0, total = 2 * ((maxX - minX) + (maxZ - minZ));
      for (let k = 0; k < 4; k++) { const [ax, az] = P[k], [bx, bz] = P[k + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / spacing));
        for (let i = 0; i < n; i++) { const u = i / n; add(parent, new THREE.Vector3(ax + (bx - ax) * u, y, az + (bz - az) * u), { ...o, phase: (acc + len * u) / total }); } acc += len; } },
    count: () => { let n = 0; for (const v of groups.values()) n += v.length; return n; },
    build() {
      const meshes = [];
      for (const [parent, items] of groups) {
        const g = new THREE.BufferGeometry(), n = items.length, pos = new Float32Array(n * 3), c1 = new Float32Array(n * 3), c2 = new Float32Array(n * 3), pp = new Float32Array(n * 4), sz = new Float32Array(n);
        items.forEach((it, i) => { it.p.toArray(pos, i * 3); _c.set(it.c).toArray(c1, i * 3); _c2.set(it.c2).toArray(c2, i * 3); pp.set([it.pat, it.ph, it.sp, it.w], i * 4); sz[i] = it.s; });
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(c1, 3)); g.setAttribute('aCol2', new THREE.BufferAttribute(c2, 3)); g.setAttribute('aP', new THREE.BufferAttribute(pp, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
        const im = new THREE.Points(g, mat); im.frustumCulled = false; im.renderOrder = 2; im.name = 'bulbs'; (parent || scene).add(im); meshes.push(im);
      }
      groups.clear(); return meshes;
    },
    update(t, cam, height) { U.uT.value = t; if (cam) U.uPx.value = height * cam.projectionMatrix.elements[5] / 2; },
    U,
  };
  return api;
}

export { createBulbs };
