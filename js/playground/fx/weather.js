/* =========================================================================
   WEATHER — the visible half of the weather system (the dials live in core/settings.js): GPU rain streaks in
   a box that follows the camera (no per-drop CPU work), a soft drizzle mist near the ground, and splash
   rings on the paving. Strength follows WX.rain, so rain fades in and out as the weather eases.
   ========================================================================= */
import * as THREE from 'three';
import { camera, Q, onQuality } from '../core/renderer.js';
import { WX } from '../core/settings.js';
import { nightness } from '../core/mood.js';
import { rand, R } from '../core/geo.js';
import { SCALE } from './particles.js';

function createWeather() {
  const root = new THREE.Group(); root.name = 'weather';
  const N = 9000, B = 70, H = 40, pos = [], seed = [];
  for (let i = 0; i < N; i++) { pos.push(R(-B, B), rand() * H, R(-B, B)); seed.push(rand()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const U = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uNight: { value: 0 }, uScale: SCALE };
  const rain = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`uniform float uTime, uScale, uRain; uniform vec3 uCam; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position; p.y = mod(p.y - uTime * (16.0 + aSeed * 6.0), ${H.toFixed(1)});
        p.x = mod(p.x - uCam.x + ${B.toFixed(1)} + uTime * 1.5, ${(2 * B).toFixed(1)}) - ${B.toFixed(1)} + uCam.x;   // a box that follows the camera
        p.z = mod(p.z - uCam.z + ${B.toFixed(1)}, ${(2 * B).toFixed(1)}) - ${B.toFixed(1)} + uCam.z;
        p.y += max(uCam.y - 20.0, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(0.5 * uScale / -mv.z, 0.0, 34.0);
        vA = step(aSeed, uRain) * smoothstep(0.0, 4.0, -mv.z) * (1.0 - smoothstep(20.0, ${B.toFixed(1)}, -mv.z));
      }`,
    fragmentShader: /* glsl */`uniform float uNight; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = (1.0 - smoothstep(0.0, 0.07, abs(c.x))) * (1.0 - smoothstep(0.1, 0.5, abs(c.y))) * vA * 0.6; if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(0.85, 0.88, 0.95), vec3(0.55, 0.6, 0.85), uNight), a); }`,
  }));
  rain.frustumCulled = false; root.add(rain);
  const thin = () => g.setDrawRange(0, Math.round(N * Math.max(0.35, Q.particles))); thin(); onQuality(thin);
  // splash rings: a handful of expanding circles that keep reappearing around the camera
  const RN = 160, rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }), RN);
  const rs = Array.from({ length: RN }, () => ({ x: 0, z: 0, t: rand() })), m = new THREE.Matrix4(); rings.frustumCulled = false; root.add(rings);
  return {
    object3D: root,
    update(dt, t) {
      const k = WX.rain; root.visible = k > 0.01; if (!root.visible) return;
      U.uTime.value = t; U.uCam.value.copy(camera.position); U.uRain.value = k; U.uNight.value = nightness();
      rings.material.opacity = 0.22 * k;
      rs.forEach((r, i) => { r.t += dt * 1.8; if (r.t > 1) { r.t = 0; r.x = camera.position.x + R(-30, 30); r.z = camera.position.z + R(-30, 30); }
        const s = 0.05 + r.t * 0.35; rings.setMatrixAt(i, m.makeScale(s, 1, s).setPosition(r.x, 0.08, r.z)); });
      rings.instanceMatrix.needsUpdate = true;
    },
  };
}

export { createWeather };
