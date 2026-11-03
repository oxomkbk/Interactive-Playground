/* =========================================================================
   AMBIENT PARTICLES — all animated on the GPU (no per-particle CPU work):
   • cherry petals tumbling on the breeze • golden dust motes by day that become fireflies at night
   • dandelion seeds drifting high • sparkles that twinkle around the plaza
   • string lights: bulb spheres (one InstancedMesh) + soft twinkling halos (Points)
   • fountain jets: droplets on true parabolas
   Every system is fogged and tone-mapped like the scene; counts follow the quality tier.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { renderer, camera, Q, onQuality } from '../core/renderer.js';
import { nightness } from '../core/mood.js';
import { WX } from '../core/settings.js';
import { rand, R } from '../core/geo.js';

const PC = CONFIG.particles, SCALE = { value: 1 };
const resizeScale = () => { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); SCALE.value = v.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); };
resizeScale(); onQuality(resizeScale);
const TAIL = `#include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;
function points(n, attrs, uniforms, vs, fs, opts = {}) {
  const { thin: thinIt = true, ...o } = opts;
  const g = new THREE.BufferGeometry(); for (const [k, [arr, size]] of Object.entries(attrs)) g.setAttribute(k, new THREE.Float32BufferAttribute(arr, size));
  const m = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }, uniforms]), vertexShader: vs, fragmentShader: fs, fog: true, transparent: true, depthWrite: false, ...o });
  m.uniforms.uScale = SCALE; const p = new THREE.Points(g, m); p.frustumCulled = false;
  if (thinIt) { const thin = () => g.setDrawRange(0, Math.round(n * Q.particles)); thin(); onQuality(thin); }
  return p;
}

function createAmbient() {
  const root = new THREE.Group(); root.name = 'ambient-particles';
  const W = new THREE.Vector3(...PC.wind);

  // petals: fall through a cycle, drifting downwind, flutter-rotating; spawn upwind so they land in the park
  { const n = PC.petals, H = 22, pos = [], seed = [];
    for (let i = 0; i < n; i++) { const a = rand() * 6.283, r = Math.sqrt(rand()) * 80, fall = R(0.35, 0.8), drift = H / fall * 0.5; pos.push(Math.sin(a) * r - W.x * drift, rand() * H, Math.cos(a) * r - W.z * drift); seed.push((fall - 0.35) / 0.45, rand(), rand(), rand()); }
    root.add(points(n, { position: [pos, 3], aSeed: [seed, 4] }, { uH: { value: H }, uSize: { value: 0.13 }, uWind: { value: W }, uA: { value: new THREE.Color('#FFB3C6') }, uB: { value: new THREE.Color('#FFE3EC') } },
      /* glsl */`uniform float uTime, uH, uSize, uScale; uniform vec3 uWind; attribute vec4 aSeed; varying float vTint, vRot, vFade;
      #include <fog_pars_vertex>
      void main(){ float fall = 0.35 + aSeed.x * 0.45, u = fract(position.y / uH + uTime * fall / uH), age = u * uH / fall;
        vec3 p = vec3(position.x, uH * (1.0 - u), position.z); p.xz += uWind.xz * age + vec2(sin(uTime * 0.8 + aSeed.y * 6.28), cos(uTime * 0.6 + aSeed.y * 6.28)) * 0.8;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(uSize * uScale / -mvPosition.z, 0.0, 40.0);
        vRot = uTime * (1.0 + aSeed.z * 3.0) + aSeed.y * 6.28; vTint = aSeed.w; vFade = smoothstep(0.0, 0.5, p.y) * smoothstep(uH, uH - 3.0, p.y) * smoothstep(0.5, 2.5, -mvPosition.z);
        #include <fog_vertex>
      }`,
      /* glsl */`uniform vec3 uA, uB; uniform float uNight; varying float vTint, vRot, vFade;
      #include <fog_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), k = cos(vRot); c = mat2(k, -s, s, k) * c;
        float fl = 0.45 + 0.55 * abs(sin(vRot * 1.7)), d = length(vec2(c.x / (0.42 * fl), c.y / 0.27)), a = smoothstep(1.0, 0.72, d) * vFade; if (a < 0.06) discard;
        vec3 col = mix(uA, uB, vTint) * mix(0.8, 1.15, smoothstep(0.6, 0.0, d)) * (1.0 - uNight * 0.5); gl_FragColor = vec4(col, a);
        ${TAIL} }`)); }

  // dust motes by day → fireflies by night (same particles, low over the lawns and gardens)
  { const n = PC.fireflies + PC.dust, pos = [], seed = [];
    for (let i = 0; i < n; i++) { const a = rand() * 6.283, r = Math.sqrt(rand()) * 70; pos.push(Math.sin(a) * r, R(0.3, 6), Math.cos(a) * r); seed.push(rand(), rand(), rand(), rand()); }
    root.add(points(n, { position: [pos, 3], aSeed: [seed, 4] }, { uSize: { value: 0.07 }, uDay: { value: new THREE.Color('#FFE2A8') }, uFly: { value: new THREE.Color('#FFF2A0') }, uFly2: { value: new THREE.Color('#FFB0D6') } },
      /* glsl */`uniform float uTime, uSize, uScale, uNight; attribute vec4 aSeed; varying float vTw; varying vec4 vS;
      #include <fog_pars_vertex>
      void main(){ float t = uTime * (0.15 + aSeed.x * 0.25);
        vec3 p = position + vec3(sin(t + aSeed.y * 6.28) * 1.6, sin(t * 1.3 + aSeed.z * 6.28) * 0.6 + uNight * 0.4, cos(t * 0.8 + aSeed.w * 6.28) * 1.6);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(uSize * mix(1.0, 2.0, uNight) * uScale / -mvPosition.z, 0.0, 22.0);
        vTw = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed.x * 2.5) + aSeed.y * 40.0); vS = aSeed;
        #include <fog_vertex>
      }`,
      /* glsl */`uniform float uNight; uniform vec3 uDay, uFly, uFly2; varying float vTw; varying vec4 vS;
      #include <fog_pars_fragment>
      void main(){ float d = length(gl_PointCoord - 0.5), a = smoothstep(0.5, 0.0, d); vec3 col = mix(uDay, mix(uFly, uFly2, step(0.72, vS.w)) * 3.0, uNight);
        a *= mix(0.28 * (0.4 + 0.6 * vTw), pow(vTw, 2.0), uNight); gl_FragColor = vec4(col * a, a);
        ${TAIL} }`, { blending: THREE.AdditiveBlending })); }

  // dandelion seeds: tiny fluffy stars drifting high on the wind
  { const n = PC.seeds, pos = [], seed = [];
    for (let i = 0; i < n; i++) { pos.push(R(-80, 80), R(3, 16), R(-80, 80)); seed.push(rand(), rand(), rand(), rand()); }
    root.add(points(n, { position: [pos, 3], aSeed: [seed, 4] }, { uSize: { value: 0.12 }, uWind: { value: W } },
      /* glsl */`uniform float uTime, uSize, uScale; uniform vec3 uWind; attribute vec4 aSeed; varying float vA;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position; p.xz += uWind.xz * uTime * 0.6; p.x = mod(p.x + 80.0, 160.0) - 80.0; p.z = mod(p.z + 80.0, 160.0) - 80.0;
        p.y += sin(uTime * 0.4 + aSeed.x * 6.28) * 1.2; p.x += sin(uTime * 0.7 + aSeed.y * 6.28) * 0.6;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(uSize * uScale / -mvPosition.z, 0.0, 18.0); vA = 0.5 + aSeed.z * 0.5;
        #include <fog_vertex>
      }`,
      /* glsl */`varying float vA; uniform float uNight;
      #include <fog_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c), ang = atan(c.y, c.x);
        float star = smoothstep(0.5, 0.0, d) * (0.35 + 0.65 * pow(abs(cos(ang * 4.0)), 8.0)); float a = (star + smoothstep(0.12, 0.0, d)) * vA * 0.75 * (1.0 - uNight * 0.6); if (a < 0.02) discard;
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.95), a);
        ${TAIL} }`)); }

  // sparkles: star twinkles that hang around the plaza and fountain
  { const n = PC.sparkles, pos = [], seed = [];
    for (let i = 0; i < n; i++) { const a = rand() * 6.283, r = Math.sqrt(rand()) * 18; pos.push(Math.sin(a) * r, R(0.6, 7), Math.cos(a) * r); seed.push(rand(), rand(), rand(), rand()); }
    root.add(points(n, { position: [pos, 3], aSeed: [seed, 4] }, { uSize: { value: 0.22 } },
      /* glsl */`uniform float uTime, uSize, uScale; attribute vec4 aSeed; varying float vTw;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position + vec3(0.0, sin(uTime * 0.5 + aSeed.x * 6.28) * 0.4, 0.0); vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        vTw = pow(max(sin(uTime * (0.8 + aSeed.y * 1.5) + aSeed.z * 40.0), 0.0), 6.0); gl_PointSize = clamp(uSize * uScale / -mvPosition.z * (0.5 + vTw), 0.0, 30.0);
        #include <fog_vertex>
      }`,
      /* glsl */`varying float vTw; uniform float uNight;
      #include <fog_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float cross = max(smoothstep(0.06, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)), smoothstep(0.06, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
        float a = (cross + smoothstep(0.18, 0.0, d)) * vTw * (0.6 + uNight * 0.8); gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * a * 2.0, a);
        ${TAIL} }`, { blending: THREE.AdditiveBlending })); }

  return {
    object3D: root,
    update(dt, t) { const n = nightness(); W.set(...PC.wind).multiplyScalar(WX.wind); for (const p of root.children) { p.material.uniforms.uTime.value = t; p.material.uniforms.uNight.value = n; } },
  };
}

/* ---------------- string lights: bulbs + halos ---------------- */
function createStringLights(list) {
  const n = list.length, root = new THREE.Group(); root.name = 'string-lights';
  const tints = ['#FFDCB4', '#FFA6CC', '#F1DCFF', '#FFE9A0'].map(c => new THREE.Color(c));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), n), m4 = new THREE.Matrix4();
  list.forEach((p, i) => { bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); bulbs.setColorAt(i, tints[i % 4]); }); bulbs.computeBoundingSphere(); root.add(bulbs);
  const pos = [], col = [], seed = []; list.forEach((p, i) => { pos.push(p.x, p.y, p.z); const c = tints[i % 4]; col.push(c.r, c.g, c.b); seed.push(rand()); });
  const halos = points(n, { position: [pos, 3], color: [col, 3], aSeed: [seed, 1] }, { uSize: { value: 0.7 }, uLevel: { value: 0.3 } },
    /* glsl */`uniform float uTime, uSize, uScale; attribute float aSeed; varying float vTw, vNear; varying vec3 vCol;
    #include <fog_pars_vertex>
    void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(uSize * uScale / -mvPosition.z, 0.0, 64.0);
      vTw = 0.75 + 0.25 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 50.0); vCol = color; vNear = smoothstep(1.5, 6.0, -mvPosition.z);
      #include <fog_vertex>
    }`,
    /* glsl */`uniform float uLevel; varying float vTw, vNear; varying vec3 vCol;
    #include <fog_pars_fragment>
    void main(){ float d = length(gl_PointCoord - 0.5), a = pow(smoothstep(0.5, 0.0, d), 2.2) * uLevel * vTw * vNear; gl_FragColor = vec4(vCol * a, a);
      ${TAIL} }`, { blending: THREE.AdditiveBlending, vertexColors: true, thin: false });
  root.add(halos);
  return { object3D: root, update(dt, t) { const k = nightness(); halos.material.uniforms.uTime.value = t; halos.material.uniforms.uLevel.value = 0.12 + k * 0.85; bulbs.material.color.setScalar(0.9 + k * 3.2); } };
}

/* ---------------- fountain jets: droplets on parabolas ---------------- */
// jets: [{ x, y, z, up (m/s), out (m/s), n, ring (radius of the nozzle ring, 0 = single nozzle), dir? (fixed heading, radians) }]
function createJets(jets) {
  const pos = [], seed = [], vel = [];
  for (const j of jets) for (let i = 0; i < j.n; i++) { const a = rand() * 6.283, ring = j.ring ? j.ring : 0; pos.push(j.x + Math.sin(a) * ring, j.y, j.z + Math.cos(a) * ring);
    const outA = j.dir !== undefined ? j.dir + R(-0.06, 0.06) : j.ring ? a : rand() * 6.283, o = j.out * R(0.85, 1.15); vel.push(Math.sin(outA) * o, j.up * R(0.9, 1.08), Math.cos(outA) * o); seed.push(rand()); }
  const p = points(pos.length / 3, { position: [pos, 3], aVel: [vel, 3], aSeed: [seed, 1] }, { uSize: { value: 0.09 } },
    /* glsl */`uniform float uTime, uSize, uScale; attribute vec3 aVel; attribute float aSeed; varying float vA;
    #include <fog_pars_vertex>
    void main(){ float T = 2.0 * aVel.y / 9.81, t = fract(uTime / T * 0.9 + aSeed) * T;
      vec3 p = position + aVel * t + vec3(0.0, -4.905 * t * t, 0.0); vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = clamp(uSize * uScale / -mvPosition.z, 0.0, 14.0); vA = smoothstep(0.0, 0.08, t / T) * smoothstep(1.0, 0.85, t / T);
      #include <fog_vertex>
    }`,
    /* glsl */`varying float vA; uniform float uNight;
    #include <fog_pars_fragment>
    void main(){ float d = length(gl_PointCoord - 0.5), a = smoothstep(0.5, 0.1, d) * vA * 0.85; if (a < 0.02) discard;
      vec3 col = mix(vec3(0.92, 0.97, 1.0), vec3(1.0, 0.8, 0.9) * 0.85, uNight); gl_FragColor = vec4(col, a * mix(1.0, 0.7, uNight));
      ${TAIL} }`);
  return { object3D: p, update(dt, t) { p.material.uniforms.uTime.value = t; p.material.uniforms.uNight.value = nightness(); } };
}

export { createAmbient, createStringLights, createJets, SCALE };
