/* =========================================================================
   WATER — real reflections, not a tinted mirror. One planar reflection is rendered for the whole park (the
   ponds and pools all sit within a metre of the same height): a mirrored camera with an oblique near plane
   (so nothing below the water leaks in), at reduced resolution and every other frame, skipping the grass,
   leaf cards and small props that wouldn't read in a ripple. Every water surface uses one shader:
   • the reflection, distorted by two layers of travelling ripples (analytic waves + noise), so the lights of
     the rides shimmer and stretch across the water
   • Fresnel: looking down you see into the water (a deep teal-to-ink depth colour), at grazing angles it mirrors
   • crisp moon glints on the wavelets, a faint caustic shimmer near the edges, fog like everything else
   ========================================================================= */
import * as THREE from 'three';
import { renderer, scene, camera, Q } from './renderer.js';
import { sunDir } from './mood.js';

const PLANE_Y = 0.25;
const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
const mirror = new THREE.PerspectiveCamera();
const U = { tRefl: { value: rt.texture }, uTexM: { value: new THREE.Matrix4() }, uT: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) } };
const MATS = [], skip = []; const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _s = new THREE.Sphere();
let frame = 0, active = false;

function waterMaterial(color = '#2E6E7E', scale = 1) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uDeep: { value: new THREE.Color(color).multiplyScalar(0.18) }, uShallow: { value: new THREE.Color(color).multiplyScalar(0.55) }, uScale: { value: scale },
      fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
    transparent: true, fog: true,
    vertexShader: /* glsl */`
      uniform mat4 uTexM; varying vec4 vRefl; varying vec3 vWorld; varying vec3 vView;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vRefl = uTexM * wp; vView = cameraPosition - wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tRefl; uniform float uT, uScale; uniform vec3 uDeep, uShallow, uSun; varying vec4 vRefl; varying vec3 vWorld; varying vec3 vView;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      // the water's slope: a few travelling waves plus drifting noise
      // the water's slope: long swells, a cross-chop and three octaves of drifting noise for the fine ripples that
      // break reflections into shimmering streaks
      vec2 slope(vec2 p){ vec2 s = vec2(0.0);
        s += vec2(cos(p.x * 0.9 + uT * 1.1), 0.0) * 0.035 + vec2(0.0, cos(p.y * 1.2 - uT * 0.9)) * 0.03;
        s += vec2(cos(dot(p, vec2(1.3, 0.9)) * 2.6 + uT * 2.2)) * vec2(1.3, 0.9) * 0.016;
        float e = 0.05, a = 0.3; vec2 q = p * 2.4 + vec2(uT * 0.3, -uT * 0.22);
        for (int i = 0; i < 3; i++) { s += vec2(n(q + vec2(e, 0)) - n(q - vec2(e, 0)), n(q + vec2(0, e)) - n(q - vec2(0, e))) * a; q = q * 2.1 + vec2(3.1, 1.7) + uT * 0.15; a *= 0.55; }
        return s * uScale; }
      void main(){
        vec2 sl = slope(vWorld.xz); vec3 N = normalize(vec3(-sl.x, 1.0, -sl.y)); vec3 V = normalize(vView);
        float dist = length(vView), fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // reflections stretch vertically on rippled water (lights become long wavering streaks), less so far away
        vec2 uv = vRefl.xy / vRefl.w + vec2(sl.x * 0.035, sl.y * 0.11) * mix(1.0, 0.45, smoothstep(10.0, 80.0, dist));
        vec3 refl = texture2D(tRefl, clamp(uv, 0.002, 0.998)).rgb;
        // the body of the water: deep ink-indigo with teal where light gets in, lighter toward grazing views
        float depthK = 0.55 + 0.45 * n(vWorld.xz * 0.3);
        vec3 body = mix(uDeep, uShallow, (1.0 - max(dot(N, V), 0.0)) * 0.5 * depthK) * 0.8;
        vec3 c = mix(body, refl, clamp(fres * 1.15 + 0.12, 0.0, 0.96));
        vec3 H = normalize(normalize(uSun) + V); c += vec3(0.85, 0.9, 1.0) * pow(max(dot(N, H), 0.0), 600.0) * 4.0 * step(0.0, uSun.y);   // moon glints
        c += uShallow * 0.25 * pow(n(vWorld.xz * 2.5 + uT * 0.6) * n(vWorld.xz * 3.1 - uT * 0.5), 3.0);                                   // shimmer
        gl_FragColor = vec4(c, 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // fog uniforms come from the scene
  m.onBeforeRender = () => { if (scene.fog) { m.uniforms.fogColor.value.copy(scene.fog.color); m.uniforms.fogDensity.value = scene.fog.density; } };
  m.defines = { USE_FOG: '', FOG_EXP2: '' };
  MATS.push(m); return m;
}

// things the reflection doesn't need (registered by the world): grass, leaf cards, crowd, small props
function skipInReflection(...objs) { skip.push(...objs); }

const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0), _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q = new THREE.Vector4(), _look = new THREE.Vector3();
const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
function updateWater(t, waterMeshes) {
  U.uT.value = t; sunDir(U.uSun.value);
  if (!MATS.length) return;
  // only when some water is in view and nearby
  // only when a sizeable stretch of water is close and actually on screen; refreshed every third frame
  _frustum.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  active = waterMeshes.some(m => { if (!m.visible || !m.userData.mirror) return false; if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); _s.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
    return _s.center.distanceTo(camera.position) - _s.radius < 140 && _frustum.intersectsSphere(_s); });
  // crisp, current reflections, refreshed every other frame (ripples hide the half-frame lag; the frame time stays flat)
  if (!active || (++frame % 2)) return;
  const k = Q.level === 'high' ? 0.42 : Q.level === 'medium' ? 0.36 : 0.28, w = Math.max(2, Math.round(renderer.domElement.width * k)), h = Math.max(2, Math.round(renderer.domElement.height * k));
  if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
  // mirror the camera across y = PLANE_Y
  mirror.copy(camera); mirror.position.copy(camera.position); mirror.position.y = 2 * PLANE_Y - camera.position.y;
  camera.getWorldDirection(_look); _t.copy(camera.position).add(_look); _t.y = 2 * PLANE_Y - _t.y;
  mirror.up.set(0, 1, 0);   // any up works: the water looks the image up through the same mirrored matrices
  mirror.lookAt(_t); mirror.updateMatrixWorld(); mirror.projectionMatrix.copy(camera.projectionMatrix);
  // oblique near plane: clip everything below the water
  _plane.setFromNormalAndCoplanarPoint(_n, _p.set(0, PLANE_Y, 0)); _plane.applyMatrix4(mirror.matrixWorldInverse);
  _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
  const pm = mirror.projectionMatrix, e = pm.elements;
  _q.x = (Math.sign(_clip.x) + e[8]) / e[0]; _q.y = (Math.sign(_clip.y) + e[9]) / e[5]; _q.z = -1; _q.w = (1 + e[10]) / e[14];
  _clip.multiplyScalar(2 / _clip.dot(_q)); e[2] = _clip.x; e[6] = _clip.y; e[10] = _clip.z + 1; e[14] = _clip.w;
  U.uTexM.value.copy(BIAS).multiply(camera.projectionMatrix).multiply(mirror.matrixWorldInverse);
  // render, without the water itself and the clutter
  const hidden = []; for (const o of [...skip, ...waterMeshes]) if (o.visible) { o.visible = false; hidden.push(o); }
  const prevRT = renderer.getRenderTarget(), shadowAuto = renderer.shadowMap.autoUpdate, shadowNeed = renderer.shadowMap.needsUpdate; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, mirror); renderer.setRenderTarget(prevRT);
  renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeed; for (const o of hidden) o.visible = true;
}

export { waterMaterial, updateWater, skipInReflection, MATS as WATER_MATERIALS };
