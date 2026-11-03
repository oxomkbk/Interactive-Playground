/* =========================================================================
   HORIZON — the world beyond the park wall, so the night has a place in it:
   • Moonmere, a lake on the moon's side of the park. Its surface is rippled by travelling waves; the sky and
     the moon reflect in it with a Fresnel falloff, and the moon lays a glittering path across it toward the
     promenade. An arched stone footbridge strung with lanterns crosses its narrows, and rowing boats with a
     lantern at the bow drift slowly over it (each lantern draws its own wavering streak on the water).
   • hamlets on the hillsides: cottages and a belfry each, plaster walls under slate roofs, windows lit warm at
     random (no two hamlets alike, a few lights going on and off through the night), a soft glow over each
   • lamp-lit roads winding from the park over the hills to every hamlet
   Everything is instanced (a handful of draw calls for the whole horizon) and nothing allocates per frame.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { heightAt } from './ground.js';
import { scene, renderer } from '../core/renderer.js';
import { waterMaterial } from '../core/water.js';
import { addNightLight } from '../core/nightlights.js';

const L = CONFIG.layout, TAU = Math.PI * 2;
const rnd = (() => { let s = 7331; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const R = (a, b) => a + (b - a) * rnd();
const MOON = (() => { const m = CONFIG.times.night.sun, d = Math.PI / 180; return new THREE.Vector3(Math.sin(m.azimuth * d) * Math.cos(m.elevation * d), Math.sin(m.elevation * d), Math.cos(m.azimuth * d) * Math.cos(m.elevation * d)).normalize(); })();

// keep the far forest out of the lake and the hamlets
function keepClear(x, z) {
  const lk = L.lake; if (lk && Math.hypot((x - lk.x) / lk.rx, (z - lk.z) / lk.rz) < 1.12) return true;
  for (const [vx, vz, n] of L.villages || []) if (Math.hypot(x - vx, z - vz) < 9 + n * 1.2) return true;
  for (const [x0, z0, x1, z1] of L.pools || []) if (x > x0 - 9 && x < x1 + 9 && z > z0 - 9 && z < z1 + 9) return true;
  return false;
}

// warm points of light (lamps, lanterns, glows) sized in metres and attenuated with distance
function lightPoints(list, { size = 1, flicker = 0.15 } = {}) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(list.length * 3), aL = new Float32Array(list.length * 3);
  list.forEach((l, i) => { pos.set([l.x, l.y, l.z], i * 3); aL.set([l.s ?? 1, l.k ?? rnd(), l.w ?? 0], i * 3); });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aL', new THREE.BufferAttribute(aL, 3));
  const U = { uT: { value: 0 }, uPx: { value: 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`uniform float uT, uPx; attribute vec3 aL; varying float vA; varying float vW;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z;
        vA = (1.0 - ${flicker.toFixed(2)} + ${flicker.toFixed(2)} * sin(uT * (6.0 + aL.y * 9.0) + aL.y * 60.0)) * exp(-d * 0.0007); vW = aL.z;
        gl_PointSize = clamp(${size.toFixed(2)} * aL.x * 900.0 / d, 1.5, 64.0) * uPx; }`,
    fragmentShader: /* glsl */`varying float vA; varying float vW; void main(){ float r = length(gl_PointCoord - 0.5); float a = exp(-r * r * 40.0) + exp(-r * r * 9.0) * 0.35;
      vec3 c = mix(vec3(1.0, 0.72, 0.4), vec3(1.0, 0.86, 0.64), vW); gl_FragColor = vec4(c * a * vA * 1.6, 1.0); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return { object: p, U };
}

function createHorizon() {
  const root = new THREE.Group(); root.name = 'horizon';
  const updaters = [];

  // ---------- hamlets ----------
  const houses = [], belfries = [], glows = [], lamps = [];
  for (const [vx, vz, n] of L.villages) {
    const face = Math.atan2(-vx, -vz);   // the hamlet turns toward the park
    for (let k = 0; k < n; k++) { const a = R(0, TAU), r = Math.sqrt(rnd()) * (6 + n * 1.2), x = vx + Math.cos(a) * r, z = vz + Math.sin(a) * r;
      if (houses.some(h => Math.hypot(h.x - x, h.z - z) < 7)) continue;
      houses.push({ x, z, y: heightAt(x, z), w: R(4.5, 7.5), h: R(3.6, 6.2), d: R(4.2, 6), ry: face + R(-0.4, 0.4) + (rnd() < 0.5 ? 0 : Math.PI / 2), seed: rnd() * 100 }); }
    const bx = vx + Math.sin(face) * 3, bz = vz + Math.cos(face) * 3; belfries.push({ x: bx, z: bz, y: heightAt(bx, bz), ry: face });
    glows.push({ x: vx, y: heightAt(vx, vz) + 9, z: vz, s: 9, w: 0, k: 0.3 });
    glows.push({ x: bx, y: heightAt(bx, bz) + 13.5, z: bz, s: 1.1, w: 1 });   // the lamp in the belfry
  }
  // walls with lit windows: the window grid is laid out in metres on each wall from the instance's size
  const wallM = new THREE.MeshStandardMaterial({ color: '#e9dfcf', roughness: 0.9 });
  wallM.onBeforeCompile = (sh) => {
    sh.uniforms.uT = { value: 0 }; updaters.push((t) => { sh.uniforms.uT.value = t; });
    sh.vertexShader = 'attribute vec4 aWin; varying vec3 vLoc; varying vec3 vLN; varying vec4 vWin;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLoc = position; vLN = normal; vWin = aWin;');
    sh.fragmentShader = 'uniform float uT; varying vec3 vLoc; varying vec3 vLN; varying vec4 vWin;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (abs(vLN.y) < 0.5) {
        float u = (abs(vLN.x) > 0.5 ? vLoc.z * vWin.z : vLoc.x * vWin.x), v = vLoc.y * vWin.y;
        vec2 cell = vec2(floor(u / 2.1), floor((v - 0.7) / 2.5)); vec2 f = vec2(fract(u / 2.1), fract((v - 0.7) / 2.5));
        float win = step(0.3, f.x) * step(f.x, 0.7) * step(0.22, f.y) * step(f.y, 0.72) * step(0.7, v) * step(v, vWin.y - 0.6);
        float id = wh(cell + vec2(vWin.w, sign(vLN.x + vLN.z * 2.0) * 7.0)), slot = floor(uT / 40.0 + id * 9.0);
        float lit = step(0.42, wh(vec2(id * 13.0, slot)));                                  // a few lights go on and off through the night
        vec3 wc = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.82, 0.55), wh(cell + 3.1)) * (0.6 + 0.4 * wh(cell + 9.7));
        totalEmissiveRadiance += wc * win * lit * 2.6; diffuseColor.rgb *= 1.0 - win * 0.85;
      }`);
  };
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const roofG = (() => { const g = new THREE.BufferGeometry(), v = [-0.58, 0, -0.56, 0.58, 0, -0.56, 0, 0.62, -0.56, -0.58, 0, 0.56, 0.58, 0, 0.56, 0, 0.62, 0.56];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]); const f = g.toNonIndexed(); f.computeVertexNormals(); return f; })();
  const all = [...houses, ...belfries.map(b => ({ ...b, w: 4, h: 10, d: 5.5, seed: rnd() * 100, belfry: true }))];
  const aWin = new Float32Array(all.length * 4); box.setAttribute('aWin', new THREE.InstancedBufferAttribute(aWin, 4));
  const walls = new THREE.InstancedMesh(box, wallM, all.length), roofs = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ color: '#4a4f66', roughness: 0.7, metalness: 0.1 }), all.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  all.forEach((h, i) => { o.position.set(h.x, h.y - 0.4, h.z); o.rotation.set(0, h.ry, 0); o.scale.set(h.w, h.h + 0.4, h.d); o.updateMatrix(); walls.setMatrixAt(i, o.matrix);
    aWin.set([h.w, h.h + 0.4, h.d, h.seed], i * 4); walls.setColorAt(i, col.setHSL(0.08 + rnd() * 0.06, 0.22, 0.42 + rnd() * 0.14));
    o.position.y = h.y + h.h; o.scale.set(h.w, h.belfry ? 4.5 : h.w * R(0.42, 0.6), h.d); o.updateMatrix(); roofs.setMatrixAt(i, o.matrix); roofs.setColorAt(i, col.setHSL(0.62 + rnd() * 0.08, 0.15, 0.24 + rnd() * 0.1)); });
  for (const m of [walls, roofs]) { m.receiveShadow = false; m.castShadow = false; root.add(m); }

  // ---------- roads of light: the park to every hamlet ----------
  for (const [vx, vz] of L.villages) {
    const a = Math.atan2(vx, vz), sx = Math.sin(a) * (L.parkRadius + 6), sz = Math.cos(a) * (L.parkRadius + 6), mx = (sx + vx) / 2 + Math.cos(a) * R(-40, 40), mz = (sz + vz) / 2 - Math.sin(a) * R(-40, 40);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sx, 0, sz), new THREE.Vector3(mx, 0, mz), new THREE.Vector3(vx, 0, vz)]), len = curve.getLength();
    for (let d = 6; d < len - 8; d += 13) { const p = curve.getPointAt(d / len); const lk = L.lake; if (lk && Math.hypot((p.x - lk.x) / lk.rx, (p.z - lk.z) / lk.rz) < 1.05) continue;
      lamps.push({ x: p.x, y: heightAt(p.x, p.z) + 3.2, z: p.z, s: 0.5, w: 0.2 }); }
  }

  // ---------- Moonmere ----------
  const lk = L.lake;
  const waterU = { uT: { value: 0 }, uMoon: { value: MOON }, uFogC: { value: new THREE.Color() }, uFogD: { value: 0.001 }, uLights: { value: [] }, uNL: { value: 0 } };
  const lakeM = new THREE.ShaderMaterial({ uniforms: waterU, transparent: false, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uT, uFogD; uniform vec3 uMoon, uFogC; uniform vec4 uLights[12]; uniform int uNL; varying vec3 vW;
      float sq(float x){ return x * x; }
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      vec2 slope(vec2 p){ vec2 s = vec2(0.0); float a = 0.09, f = 0.35; for (int i = 0; i < 5; i++){ vec2 q = p * f + vec2(uT * 0.25 * f, uT * 0.17 * f) * (1.0 + float(i) * 0.3);
          float e = 0.01; s += a * vec2(vn(q + vec2(e, 0.0)) - vn(q - vec2(e, 0.0)), vn(q + vec2(0.0, e)) - vn(q - vec2(0.0, e))) / (2.0 * e) * f; p = mat2(0.8, 0.6, -0.6, 0.8) * p; a *= 0.6; f *= 2.1; } return s; }
      void main(){
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        // ripples flatten with distance (no sub-pixel sparkle)
        vec2 sl = slope(vW.xz) * mix(0.55, 0.12, smoothstep(30.0, 260.0, dist)); vec3 N = normalize(vec3(-sl.x, 1.0, -sl.y));
        vec3 Rf = reflect(-V, N); float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // the reflected night: indigo near the horizon, deep blue overhead, the park's warm dome low down
        float ry = max(Rf.y, 0.0); vec3 sky = mix(vec3(0.06, 0.05, 0.12), vec3(0.008, 0.014, 0.045), smoothstep(0.0, 0.4, ry)) + vec3(0.2, 0.1, 0.08) * exp(-ry * 18.0) * 0.5;
        // the far shore: hills and forest stand between the water and the sky, so low reflected rays see them, dark
        float az = atan(Rf.z, Rf.x), ridge = 0.035 + 0.03 * vn(vec2(az * 6.0, 1.3)) + 0.015 * vn(vec2(az * 23.0, 4.1));
        sky = mix(vec3(0.004, 0.006, 0.012), sky, smoothstep(ridge - 0.004, ridge + 0.004, ry));
        float mu = max(dot(Rf, uMoon), 0.0);
        vec3 moon = vec3(0.85, 0.88, 1.0) * (pow(mu, 3000.0) * 40.0 + pow(mu, 260.0) * 2.2);
        // the moon path: a column of glints under the moon's azimuth, widening toward the viewer, twinkling as the
        // ripples tilt facets toward the moon and away again
        vec3 toP = normalize(vW - cameraPosition); float daz = atan(toP.x, toP.z) - atan(uMoon.x, uMoon.z); daz = atan(sin(daz), cos(daz));
        float dep = clamp(-toP.y, 0.0, 1.0), wPath = 0.035 + dep * 0.5, path = exp(-daz * daz / (wPath * wPath));
        float gn = vn(vW.xz * 1.7 + vec2(uT * 0.9, uT * 0.55)) * vn(vW.xz * 4.3 - vec2(uT * 0.6, -uT * 0.4)), glint = smoothstep(0.44, 0.68, gn);
        float core = exp(-sq((dep - uMoon.y) / 0.12));                          // brightest where the flat-water reflection of the moon would be
        vec3 mpath = vec3(0.8, 0.85, 1.0) * path * (0.025 + 0.06 * core + glint * (0.3 + 0.8 * core));
        vec3 col = vec3(0.003, 0.006, 0.014) + (sky + moon) * F + mpath;
        // lantern and bridge lights: each draws a wavering vertical streak toward the viewer
        for (int i = 0; i < 12; i++) { if (i >= uNL) break; vec4 L = uLights[i]; vec3 Ld = L.xyz - vW; vec3 h = normalize(normalize(Ld) + V);
          float sp = pow(max(dot(N, h), 0.0), 400.0) * 1.2 + pow(max(dot(N, h), 0.0), 60.0) * 0.03; col += vec3(1.0, 0.7, 0.4) * sp * L.w * 6.0 / (1.0 + dot(Ld, Ld) * 0.02); }
        float fg = 1.0 - exp(-sq(uFogD * dist)); col = mix(col, uFogC, clamp(fg, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), lakeM); lake.scale.set(lk.rx * 1.12, 1, lk.rz * 1.12); lake.position.set(lk.x, lk.y, lk.z); root.add(lake);

  // the footbridge across the narrows (the lake's short axis): an arched stone deck with a parapet and lanterns
  const span = lk.rz * 2.5, bridge = new THREE.Group(), rise = 5.5;
  const sh = new THREE.Shape(); sh.moveTo(-span / 2, -1); for (let i = 0; i <= 40; i++) { const u = i / 40, x = -span / 2 + u * span; sh.lineTo(x, Math.sin(u * Math.PI) * rise + 0.6); }
  sh.lineTo(span / 2, -1); for (let i = 40; i >= 0; i--) { const u = i / 40, x = -span / 2 + u * span; sh.lineTo(x, Math.max(-1, Math.sin(u * Math.PI) * rise - 1.3)); }
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -1.6), new THREE.MeshStandardMaterial({ color: '#7d7686', roughness: 0.85 }));
  bridge.add(deck);
  const bLights = [];
  for (let i = 1; i < 10; i++) { const u = i / 10, x = -span / 2 + u * span, y = Math.sin(u * Math.PI) * rise + 0.6; for (const zz of [-1.7, 1.7]) bLights.push({ x, y: y + 1.3, z: zz }); }
  bridge.position.set(lk.x - 8, lk.y, lk.z); bridge.rotation.y = Math.PI / 2; root.add(bridge); bridge.updateMatrixWorld(true);
  const _v = new THREE.Vector3();
  for (const b of bLights) { _v.set(b.x, b.y, b.z).applyMatrix4(bridge.matrixWorld); lamps.push({ x: _v.x, y: _v.y, z: _v.z, s: 0.3, w: 0.6 }); }
  // posts for the bridge lanterns
  { const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 6).translate(0, 0.65, 0), new THREE.MeshStandardMaterial({ color: '#3a3446', roughness: 0.6 }), bLights.length);
    bLights.forEach((b, i) => { o.position.set(b.x, b.y - 1.3, b.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }); bridge.add(posts); }

  // rowing boats with a lantern at the bow, drifting in slow loops
  const hullG = new THREE.SphereGeometry(1, 16, 8, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1.0, 0.45, 2.3);
  const boatM = new THREE.MeshStandardMaterial({ color: '#7a5034', roughness: 0.7 });
  const boats = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(hullG, boatM); m.rotation.x = Math.PI; root.add(m); boats.push({ m, a: R(0, TAU), r: R(0.25, 0.75), sp: R(0.006, 0.014) * (rnd() < 0.5 ? -1 : 1), bob: R(0, TAU) }); }
  const boatLights = lightPoints(boats.map(() => ({ x: 0, y: 0, z: 0, s: 0.55, w: 0.3 })), { size: 1, flicker: 0.25 });
  root.add(boatLights.object);

  const lampPts = lightPoints(lamps, { size: 1, flicker: 0.06 }), glowPts = lightPoints(glows, { size: 1, flicker: 0.04 });
  root.add(lampPts.object, glowPts.object);
  // the lights the water reflects: the nearest bridge lanterns and every boat lantern
  const reflL = bLights.filter((_, i) => i % 3 === 0).slice(0, 7).map(b => { _v.set(b.x, b.y, b.z).applyMatrix4(bridge.matrixWorld); return new THREE.Vector4(_v.x, _v.y, _v.z, 0.6); });
  const boatV = boats.map(() => new THREE.Vector4(0, 0, 0, 1)); waterU.uLights.value = [...reflL, ...boatV]; while (waterU.uLights.value.length < 12) waterU.uLights.value.push(new THREE.Vector4()); waterU.uNL.value = reflL.length + boatV.length;
  const bpos = boatLights.object.geometry.attributes.position;

  // ---------- the Mirror Pools before the castle ----------
  // still water at the park's reflection plane (so the château, its lights and the sky mirror in it), a dressed-stone
  // coping with a moulded edge, lantern posts along the long sides and a pair of low jets at each far end
  { const copeM = new THREE.MeshStandardMaterial({ color: '#d8cfc4', roughness: 0.75 }), postM = new THREE.MeshStandardMaterial({ color: '#2f2a3a', roughness: 0.5, metalness: 0.4 });
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.7), toneMapped: true });
    for (const [x0, z0, x1, z1] of L.pools) { const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), waterMaterial('#1C2E52', 1)); water.position.set(cx, 0.25, cz); root.add(water);
      for (const [px, pz, sx, sz] of [[cx, z0 - 0.35, w + 1.4, 0.7], [cx, z1 + 0.35, w + 1.4, 0.7], [x0 - 0.35, cz, 0.7, d], [x1 + 0.35, cz, 0.7, d]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.55, sz), copeM); c.position.set(px, 0.2, pz); c.receiveShadow = true; root.add(c); }
      for (let k = 0; k <= 4; k++) for (const pz of [z0 - 0.35, z1 + 0.35]) { const px = x0 + (w * k) / 4;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), postM); post.position.set(px, 1.55, pz); root.add(post);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), lampM); lamp.position.set(px, 2.75, pz); root.add(lamp);
        if (k % 2 === 0) addNightLight(new THREE.Vector3(px, 2.6, pz), 9, '#FFC98A', 3.5); } } }

  return {
    object3D: root, keepClear,
    update(dt, t) {
      for (const f of updaters) f(t);
      for (const P of [lampPts, glowPts, boatLights]) { P.U.uT.value = t; P.U.uPx.value = renderer.getPixelRatio(); }
      waterU.uT.value = t; if (scene.fog) { waterU.uFogC.value.copy(scene.fog.color); waterU.uFogD.value = scene.fog.density; }
      boats.forEach((b, i) => { b.a += b.sp * dt; const x = lk.x + Math.cos(b.a) * lk.rx * b.r * 0.9, z = lk.z + Math.sin(b.a) * lk.rz * b.r * 0.9;
        b.m.position.set(x, lk.y + 0.12 + Math.sin(t * 1.3 + b.bob) * 0.05, z); b.m.rotation.set(Math.PI + Math.sin(t * 1.1 + b.bob) * 0.04, b.a + (b.sp > 0 ? 0 : Math.PI), 0, 'YXZ');
        const fx = -Math.sin(b.m.rotation.y) * 1.9, fz = -Math.cos(b.m.rotation.y) * 1.9; bpos.setXYZ(i, x + fx, lk.y + 1.3, z + fz); boatV[i].set(x + fx, lk.y + 1.3, z + fz, 1); });
      bpos.needsUpdate = true;
    },
  };
}

export { createHorizon, keepClear };
