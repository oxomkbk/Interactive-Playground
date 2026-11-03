/* =========================================================================
   GRASS — a field of real blades around wherever you are: one instanced, tapered, three-triangle blade
   repeated tens of thousands of times in a square that travels with the camera (each blade wraps to the
   far side as you walk, so the field never ends). A top-down mask keeps it off paths, plazas, ride pads,
   water and buildings; blades shrink away at the edge of the patch, lean in the wind (gusts roll across
   the lawn), and take light, shadows and fog like everything else.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { WIND } from '../core/materials.js';
import { Q, BOOT_TIER } from '../core/renderer.js';
import { SET } from '../core/settings.js';

const L = CONFIG.layout;
// mask covers x ∈ [-112, 112], z ∈ [-112, 122] (the park and the gate approach); white = grass
const MX = -112, MZ = -112, MW = 224, MD = 234;

function paintMask(world) {
  const S = 4, c = document.createElement('canvas'); c.width = MW * S; c.height = MD * S;
  const g = c.getContext('2d'), X = (x) => (x - MX) * S, Z = (z) => (z - MZ) * S;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(X(0), Z(0), (L.parkRadius - 1) * S, 0, 7); g.fill(); g.fillRect(X(-30), Z(L.parkRadius - 8), 60 * S, 40 * S);
  g.fillStyle = '#000'; g.strokeStyle = '#000';
  g.beginPath(); g.arc(X(0), Z(0), (L.plaza.r + 1.2) * S, 0, 7); g.fill();
  g.lineWidth = (L.ringPath.w + 0.8) * S; g.beginPath(); g.arc(X(0), Z(0), L.ringPath.r * S, 0, 7); g.stroke();
  g.lineWidth = 3 * S; g.beginPath(); g.arc(X(0), Z(0), L.trainRadius * S, 0, 7); g.stroke();
  const b = L.boulevard; g.fillRect(X(-b.w / 2 - 0.6), Z(b.z0 - 1), (b.w + 1.2) * S, (b.z1 + 30 - b.z0) * S);
  g.fillRect(X(-2.6), Z(-L.parkRadius - 4), 5.2 * S, (L.parkRadius - 20) * S);                 // the castle path
  g.lineWidth = 3.8 * S;
  const pads = { ferris: 15, carousel: 11, teacups: 9.5, swings: 11.5, balloons: 10.5, pirate: 11, drop: 7, ringToss: 5.5, claw: 5.5, stage: 13, observatory: 8, fishing: 7.5, gallery: 6 };
  for (const [id, pr] of Object.entries(pads)) { const [x, z] = L[id], d = Math.hypot(x, z);
    g.beginPath(); g.arc(X(x), Z(z), (pr + 0.5) * S, 0, 7); g.fill();
    g.beginPath(); g.moveTo(X(x / d * L.ringPath.r), Z(z / d * L.ringPath.r)); g.lineTo(X(x), Z(z)); g.stroke(); }
  g.beginPath(); g.ellipse(X(L.garden.x), Z(L.garden.z), 11 * S, 7.5 * S, 0, 0, 7); g.fill();
  for (const s of world.shapes) { if (s.tag === 'tree' || s.tag === 'soft' || s.tag === 'probe') continue;
    if (s.type === 'circle') { g.beginPath(); g.arc(X(s.x), Z(s.z), (s.r + 0.3) * S, 0, 7); g.fill(); }
    else { g.save(); g.translate(X(s.x), Z(s.z)); g.rotate(-Math.atan2(s.s, s.c)); g.fillRect(-(s.hw + 0.3) * S, -(s.hd + 0.3) * S, (s.hw + 0.3) * 2 * S, (s.hd + 0.3) * 2 * S); g.restore(); } }
  g.filter = 'blur(3px)'; g.drawImage(c, 0, 0); g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}

function createGrass(world) {
  const tier = { high: [90000, 44], medium: [44000, 36], low: [16000, 26] }[BOOT_TIER], [N, SIZE] = tier;
  // one blade: base → mid → tip, gently curved, normals pointing up (soft, sky-lit look)
  const W = 0.032, H = 1;
  const pos = [-W, 0, 0, W, 0, 0, -W * 0.7, H * 0.55, 0.03, W * 0.7, H * 0.55, 0.03, 0, H, 0.1];
  const col = [], base = new THREE.Color('#2E5524'), mid = new THREE.Color('#5C8C3A'), tip = new THREE.Color('#A9C86E');
  for (const c of [base, base, mid, mid, tip]) col.push(c.r, c.g, c.b);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(15).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0.55, 1, 0.55, 0.5, 1], 2));
  geo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  const off = new Float32Array(N * 4); for (let i = 0; i < N; i++) { off[i * 4] = Math.random() * SIZE; off[i * 4 + 1] = Math.random() * SIZE; off[i * 4 + 2] = Math.random(); off[i * 4 + 3] = Math.random(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); geo.instanceCount = N;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const U = { uCenter: { value: new THREE.Vector2() }, uSize: { value: SIZE }, uMask: { value: paintMask(world) }, uWind: WIND, uMaskRect: { value: new THREE.Vector4(MX, MZ, MW, MD) } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 aOff; uniform vec2 uCenter; uniform float uSize, uWind; uniform sampler2D uMask; uniform vec4 uMaskRect; varying float vShade;`)
      .replace('#include <begin_vertex>', `
      vec2 wp = uCenter + mod(aOff.xy - uCenter + uSize * 0.5, uSize) - uSize * 0.5;
      vec2 muv = (wp - uMaskRect.xy) / uMaskRect.zw;
      float m = (muv.x < 0.0 || muv.y < 0.0 || muv.x > 1.0 || muv.y > 1.0) ? 0.0 : texture2D(uMask, muv).r;
      float fade = smoothstep(uSize * 0.5, uSize * 0.5 - 7.0, length(wp - uCenter));
      float h = (0.2 + aOff.w * 0.34) * smoothstep(0.35, 0.75, m) * fade;
      float a = aOff.z * 6.2831;
      vec3 transformed = vec3(position.x * cos(a) - position.z * sin(a), position.y * h, position.x * sin(a) + position.z * cos(a));
      transformed.x *= 0.6 + 0.6 * aOff.w;
      float gust = sin(uWind * 1.6 + wp.x * 0.21 + wp.y * 0.13) * 0.5 + sin(uWind * 2.7 + wp.x * 0.6) * 0.25;
      float bend = position.y * position.y * (0.12 + 0.18 * gust);
      transformed.x += bend * 0.9; transformed.z += bend * 0.4;
      transformed += vec3(wp.x, 0.0, wp.y);
      vShade = 0.75 + 0.5 * aOff.w;`)
      .replace('#include <project_vertex>', `vec4 mvPosition = viewMatrix * vec4(transformed, 1.0); gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', `vec4 worldPosition = vec4(transformed, 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;').replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vShade;');
  };
  mat.customProgramCacheKey = () => 'grass-blades';
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'grass';
  return {
    object3D: mesh,
    update(dt, t, focus) { if (focus) U.uCenter.value.set(focus.x, focus.z); mesh.visible = SET.grass !== false; void Q; },
  };
}

export { createGrass };
