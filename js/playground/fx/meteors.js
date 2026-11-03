/* =========================================================================
   METEORS — shooting stars and meteor showers, entirely on the GPU. 48 meteors, each a glowing head and a
   36-point fading trail drawn high on the sky dome. A shooting star crosses some part of the sky every few
   seconds; every couple of minutes a shower streams out of one radiant (dozens of meteors over ~15 s, varied
   speed, length and tint), and now and then a storm. Showers are announced so you know to look up.
   ========================================================================= */
import * as THREE from 'three';
import { camera } from '../core/renderer.js';
import { WX } from '../core/settings.js';

const M = 48, K = 64, DIST = 1200;
const R = (a, b) => a + (b - a) * Math.random();

function createMeteors({ onShower } = {}) {
  const n = M * K, g = new THREE.BufferGeometry(), aMK = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { aMK[i * 2] = Math.floor(i / K); aMK[i * 2 + 1] = (i % K) / (K - 1); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aMK', new THREE.BufferAttribute(aMK, 2));
  const A = Array.from({ length: M }, () => new THREE.Vector4(0, 1, 0, -99)), B = Array.from({ length: M }, () => new THREE.Vector4(1, 0, 0, 1)), C = Array.from({ length: M }, () => new THREE.Vector4(0.2, 0.05, 1, 0));
  const U = { uA: { value: A }, uB: { value: B }, uC: { value: C }, uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uVis: { value: 1 }, uPx: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      uniform vec4 uA[${M}], uB[${M}], uC[${M}]; uniform float uT, uPx; uniform vec3 uCam; attribute vec2 aMK; varying float vA; varying vec3 vCol; varying float vHead;
      void main(){
        int i = int(aMK.x); float k = aMK.y; vec4 a = uA[i], b = uB[i], c = uC[i];
        float p = (uT - a.w) / b.w;                                    // 0 → 1 over the meteor's life
        if (p < 0.0 || p > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
        float ang = c.x * p, tl = c.y * min(1.0, p * 4.0);            // the trail grows out of the head
        vec3 dir = normalize(a.xyz * cos(ang - tl * k) + b.xyz * sin(ang - tl * k));
        vec4 mv = modelViewMatrix * vec4(uCam + dir * ${DIST}.0, 1.0); gl_Position = projectionMatrix * mv;
        float fade = smoothstep(0.0, 0.08, p) * smoothstep(1.0, 0.7, p);
        vA = fade * pow(1.0 - k, 1.6) * c.z; vHead = 1.0 - smoothstep(0.0, 0.06, k);
        vCol = mix(vec3(1.0, 0.98, 0.95), c.w < 0.33 ? vec3(0.55, 0.85, 1.0) : c.w < 0.66 ? vec3(1.0, 0.7, 0.85) : vec3(1.0, 0.85, 0.55), smoothstep(0.0, 0.25, k));
        gl_PointSize = (mix(3.0, 9.0, vHead) * (0.6 + c.z * 0.4)) * uPx;
      }`,
    fragmentShader: `uniform float uVis; varying float vA; varying vec3 vCol; varying float vHead; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      float core = exp(-d * d * 40.0), glow = exp(-d * d * 8.0) * 0.5; gl_FragColor = vec4(vCol * (core + glow * vHead) * 2.2, vA * (core + glow) * uVis); }` });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = -5;
  let slot = 0, nextStar = R(3, 7), nextShower = R(60, 110), elapsed = 0; const queue = []; // shower meteors wait here until their moment, so slots are only taken by live meteors
  const S = { showers: 0, seen: 0 };
  // launch one meteor: from a direction, travelling along a tangent
  function launch(from, travel, { speed = R(0.12, 0.3), len = R(0.04, 0.12), bright = R(0.6, 1.2), hue = Math.random(), life = R(0.8, 1.8), delay = 0 } = {}) {
    const i = slot++ % M; const f = from.clone().normalize(), t = travel.clone().sub(f.clone().multiplyScalar(travel.dot(f))).normalize();
    A[i].set(f.x, f.y, f.z, elapsed + delay); B[i].set(t.x, t.y, t.z, life); C[i].set(speed, len, bright, hue); S.seen++;
  }
  const randomSkyDir = (minY = 0.25) => { const a = R(0, Math.PI * 2), y = R(minY, 0.9), r = Math.sqrt(1 - y * y); return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); };
  function shootingStar() { const f = randomSkyDir(0.3), t = new THREE.Vector3(R(-1, 1), R(-0.8, -0.2), R(-1, 1)); launch(f, t, { bright: R(0.9, 1.5), len: R(0.08, 0.16), speed: R(0.2, 0.38) }); }
  function shower(count = 40, seconds = 16, storm = false) {
    const radiant = randomSkyDir(0.5); S.showers++;
    for (let k = 0; k < count; k++) { const off = new THREE.Vector3(R(-0.6, 0.6), R(-0.4, 0.2), R(-0.6, 0.6)), f = radiant.clone().add(off.multiplyScalar(0.6)).normalize();
      if (f.y < 0.15) continue; const t = f.clone().sub(radiant).normalize().add(new THREE.Vector3(0, -0.25, 0));
      queue.push({ at: elapsed + R(0, seconds), f, t, o: { speed: R(0.15, 0.35), len: R(0.05, storm ? 0.2 : 0.14), bright: R(0.6, storm ? 1.8 : 1.3), life: R(0.7, 1.6) } }); }
    onShower && onShower(storm);
  }
  return {
    object3D: pts, S, shower, shootingStar,
    update(dt) {
      elapsed += dt; U.uT.value = elapsed; U.uCam.value.copy(camera.position); U.uVis.value = 1 - WX.cover * 0.9; U.uPx.value = Math.min(2, devicePixelRatio);
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= elapsed) { const q = queue.splice(i, 1)[0]; launch(q.f, q.t, q.o); }
      if ((nextStar -= dt) <= 0) { nextStar = R(4, 11); if (WX.cover < 0.7) shootingStar(); }
      if ((nextShower -= dt) <= 0) { nextShower = R(110, 170); if (WX.cover < 0.6) { const storm = Math.random() < 0.2; shower(storm ? 70 : 36, storm ? 20 : 15, storm); } }
    },
  };
}

export { createMeteors };
