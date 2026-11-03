import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { $, PI, R, TAU, V3, clamp, damp, lerp, pick, rand, setSeed } from '../core/utils.js';
import { FX_OBJECTS, MOON_DIR, camera, scene } from '../core/renderer.js';
import { M, TX } from '../core/materials.js';
import { U_TIME, coneMat, makePoints } from '../core/shaders.js';
import { Batcher, COLLIDERS, SB, TOMBS, _up, addCircle, addPumpkin, addTomb, boxGeo, cylBetween, nearColliders, onUpdate } from '../core/registry.js';
import { PATHS, PUMPKIN_GEO, groundAt } from './landscape.js';
import { markDone, updateCounters, updateMarkers } from './attractions.js';
import { FW } from './atmosphere.js';
import { AU } from '../core/audio.js';
import { S, player } from '../game/play.js';
import { showCard, toast } from '../ui/ui.js';
import { t } from '../core/i18n.js';
import { inLake } from './lake.js';

/* =========================================================================
   6c. HALLOWEEN DRESSING & LIVING WORLD — lantern-lined paths, corn, gallows, crows,
       a witch across the moon, a gate spider, pop-up skeletons, candy, kickable pumpkins
   ========================================================================= */
let SKEL;
function makeSkeleton() {
  const b = new Batcher(), B = M.bone;
  b.add(new THREE.SphereGeometry(0.13, 14, 10), B, 0, 1.68, 0, 0, { sy: 1.12 }); b.add(boxGeo(0.13, 0.05, 0.1, 1), B, 0, 1.55, 0.03);
  cylBetween(new V3(0, 0.95, -0.02), new V3(0, 1.52, -0.03), 0.025, B, b, 6);
  for (let i = 0; i < 4; i++) b.add(new THREE.TorusGeometry(0.14 - i * 0.012, 0.013, 4, 14), B, 0, 1.42 - i * 0.07, 0, 0, { rx: PI / 2, sy: 0.7 });
  b.add(boxGeo(0.28, 0.1, 0.12, 1), B, 0, 0.95, 0); cylBetween(new V3(-0.2, 1.46, 0), new V3(0.2, 1.46, 0), 0.02, B, b, 5);
  for (const s of [-1, 1]) {
    cylBetween(new V3(s * 0.2, 1.46, 0), new V3(s * 0.34, 1.7, 0.08), 0.022, B, b, 5); cylBetween(new V3(s * 0.34, 1.7, 0.08), new V3(s * 0.4, 1.98, 0.16), 0.018, B, b, 5);
    b.add(new THREE.SphereGeometry(0.04, 6, 4), B, s * 0.41, 2.02, 0.17);
    cylBetween(new V3(s * 0.1, 0.92, 0), new V3(s * 0.12, 0.5, 0.02), 0.025, B, b, 5); cylBetween(new V3(s * 0.12, 0.5, 0.02), new V3(s * 0.12, 0.06, 0), 0.02, B, b, 5);
    b.add(boxGeo(0.08, 0.04, 0.16, 1), B, s * 0.12, 0.03, 0.05);
  }
  SKEL = new THREE.Group(); b.build(SKEL);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), M.glowRed); e.position.set(s * 0.045, 1.7, 0.11); SKEL.add(e); }
}
const GALLOWS = [];
function buildAtmosphereProps() {
  makeSkeleton();
  // jack-o'-lanterns lining every path
  for (const [x1, z1, x2, z2, w] of PATHS) { const len = Math.hypot(x2 - x1, z2 - z1), dx = (x2 - x1) / len, dz = (z2 - z1) / len;
    for (let d = 2; d < len - 1; d += 3.4) for (const s of [-1, 1]) { const x = x1 + dx * d - dz * s * (w / 2 - 0.35), z = z1 + dz * d + dx * s * (w / 2 - 0.35);
      if (Math.hypot(x, z) < 26) continue; addPumpkin(x, 0, z, R(0.16, 0.26), rand() > 0.15, Math.atan2(dz * s, -dx * s) + R(-0.3, 0.3)); } }
  // corn-stalk shocks
  const o = new THREE.Object3D();
  const parts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, g = new THREE.CylinderGeometry(0.015, 0.035, 2.3, 4); g.translate(0, 1.15, 0); g.rotateZ(0.12 * Math.cos(a)); g.rotateX(0.12 * Math.sin(a)); g.translate(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12); parts.push(g.toNonIndexed());
    const lf = new THREE.PlaneGeometry(0.12, 0.9); lf.translate(0, 0.45, 0); lf.rotateZ(0.9); lf.rotateY(a); lf.translate(Math.cos(a) * 0.15, R(0.8, 1.6), Math.sin(a) * 0.15); parts.push(lf.toNonIndexed()); }
  parts.push(new THREE.TorusGeometry(0.17, 0.03, 4, 10).rotateX(PI / 2).translate(0, 0.9, 0).toNonIndexed());
  const corn = [[-13, 84], [13, 84], [-8.6, 71], [8.6, 71], [-9, 47], [9, 40], [-44, 26], [-35, 41], [-47, 37], [21, 9], [-20, 12], [12, -24], [-7, -47], [7, -47], [44, -34], [52, -34], [24, -40], [-22, -40], [58, 30], [70, 52], [-22, 55], [-22, 65], [56, 12], [-31, -45], [17, 28], [-17, 24]];
  const cm = new THREE.InstancedMesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 1, side: THREE.DoubleSide }), corn.length);
  corn.forEach(([x, z], i) => { o.position.set(x, 0, z); o.rotation.set(0, R(0, TAU), 0); o.scale.setScalar(R(0.9, 1.2)); o.updateMatrix(); cm.setMatrixAt(i, o.matrix); addCircle(x, z, 0.3); }); o.scale.setScalar(1);
  cm.castShadow = true; scene.add(cm);
  // gallows with swinging skeletons
  const gallows = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); const b = new Batcher();
    b.add(boxGeo(0.25, 4.6, 0.25, 1), M.woodDark, 0, 2.3, 0); b.add(boxGeo(2.2, 0.22, 0.22, 1), M.woodDark, 1.0, 4.5, 0); b.add(boxGeo(0.15, 1.4, 0.15, 1), M.woodDark, 0.45, 3.85, 0, 0, { rz: -0.8 }); b.add(boxGeo(1.6, 0.3, 1.2, 1), M.woodDark, 0.6, 0.15, 0);
    b.build(g); const piv = new THREE.Group(); piv.position.set(1.9, 4.4, 0); g.add(piv);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), M.straw); rope.position.y = -0.35; piv.add(rope);
    const sk = SKEL.clone(); sk.position.y = -2.17; sk.scale.setScalar(0.95); piv.add(sk); addCircle(x, z, 0.3); GALLOWS.push({ piv, ph: rand() * 6 }); };
  gallows(-20, 88, 0.3); gallows(-11.5, -48.5, -0.4); gallows(31, -29, 1.2); gallows(-50, 44, 2.2); gallows(44, 63, -0.8);
  onUpdate((dt, t) => { for (const g of GALLOWS) { g.piv.rotation.z = Math.sin(t * 0.9 + g.ph) * 0.12; g.piv.rotation.x = Math.sin(t * 0.7 + g.ph * 2) * 0.06; g.piv.rotation.y = Math.sin(t * 0.3 + g.ph) * 0.5; } });
  // tombstones crowding the park edges
  for (let i = 0; i < 60; i++) { const east = i % 2; const x = east ? R(143, 148) * (i % 4 < 2 ? 1 : -1) : R(-60, 140), z = east ? R(-180, 70) : R(-189.5, -186.5); if (!east && x > -32 && x < 32) continue; addTomb(x, z, R(-0.4, 0.4), R(0.8, 1.3)); }
  // cobwebs on stall corners, gate and porch
  const wm = new THREE.MeshBasicMaterial({ map: TX.web, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0x8a8aa0 });
  [[11, 3.3, 69, 0], [11, 3.3, 63, PI / 2], [-11, 3.3, 69, -PI / 2], [-11, 3.3, 63, PI], [-11, 3.3, 37, 0], [-11, 3.3, 31, PI / 2], [-7, 11, 78.8, 0], [7, 11, 78.8, PI / 2], [-5, 3.7, -54.7, PI / 2], [5, 3.7, -54.7, 0], [-58, 6.9, 12.5, 0], [76, 5.5, 31, PI]].forEach(([x, y, z, r]) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8).translate(0.9, -0.9, 0), wm); w.position.set(x, y, z); w.rotation.set(0, r, 0); scene.add(w); });
  // the lantern beam you carry (volumetric cone)
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 24, 1, true).translate(0, -8, 0).rotateX(PI / 2), coneMat(0xffd7a0, 0.07)); beam.position.set(0.25, -0.25, 0); camera.add(beam); FX_OBJECTS.push(beam);
  onUpdate(() => { beam.visible = S.lantern && S.mode !== 'photo'; });
  onUpdate(updateMarkers);
  onUpdate(() => { if (!S.done.has('maze') && S.mode === 'roam' && Math.hypot(player.pos.x - 48, player.pos.z + 55) < 2.2) { markDone('maze'); showCard('The heart of the Boneyard', 'You found the centre. Somewhere, the dead applaud — slowly.', 4000); } });
}
// ---- Crows: perched everywhere, burst into the sky when you get close, return later ----
function buildCrows() {
  const per = [];
  for (let i = 0; i < 14; i++) per.push([pick([-1, 1]) * R(13, 40), 2.45, 78]);
  for (let i = 0; i < 8; i++) per.push([R(-12, 12), 16.05, -71.25]);
  for (const [x, z] of [[13, 66], [-13, 66], [-13, 34], [14, 50]]) for (let k = 0; k < 2; k++) per.push([x + R(-1, 1), 3.52, z + R(-2, 2)]);
  TOMBS.slice(0, 14).forEach(t => per.push([t.x, [1.33, 1.54, 0.97][t.v] * t.s, t.z]));
  const N = per.length, wing = [0, 0, 0.12, 0.5, 0, 0.06, 0.28, 0, -0.12, 0, 0, 0.12, 0.28, 0, -0.12, 0, 0, -0.05], pos = [];
  for (let i = 0; i < wing.length; i += 3) pos.push(wing[i] + 0.06, wing[i + 1], wing[i + 2]); for (let i = 0; i < wing.length; i += 3) pos.push(-wing[i] - 0.06, wing[i + 1], wing[i + 2]);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const strip = g => { for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); return g; };
  const body = strip(new THREE.SphereGeometry(0.09, 8, 6).scale(0.8, 0.85, 1.8).toNonIndexed()), head = strip(new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.07, 0.17).toNonIndexed());
  const beak = strip(new THREE.ConeGeometry(0.02, 0.08, 4).rotateX(PI / 2).translate(0, 0.06, 0.25).toNonIndexed()), tail = strip(new THREE.ConeGeometry(0.05, 0.18, 3).rotateX(-PI / 2).translate(0, 0, -0.22).toNonIndexed());
  const geo = mergeGeometries([wg, body, head, beak, tail]);
  const flap = new Float32Array(N), ph = new Float32Array(N); for (let i = 0; i < N; i++) ph[i] = R(0, TAU);
  geo.setAttribute('aFlap', new THREE.InstancedBufferAttribute(flap, 1).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: U_TIME },
    vertexShader: `attribute float aFlap, aPhase; uniform float uTime; void main(){ vec3 p=position; float w=max(abs(p.x)-.07,0.);
      p.x=sign(p.x)*(min(abs(p.x),.07)+w*mix(.12,1.,aFlap)); p.y+=w*w*sin(uTime*17.+aPhase)*2.6*aFlap+w*.15*(1.-aFlap);
      gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.); }`,
    fragmentShader: `void main(){ gl_FragColor=vec4(.012,.01,.016,1.); }` });
  const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; scene.add(im); FX_OBJECTS.push(im);
  const crows = per.map(([x, y, z]) => ({ home: new V3(x, y, z), p: new V3(x, y, z), v: new V3(), mode: 0, t: 0, yaw: R(0, TAU) }));
  const o = new THREE.Object3D(), tgt = new V3(); let lastCaw = 0;
  onUpdate((dt, t) => {
    for (let i = 0; i < N; i++) { const c = crows[i];
      if (c.mode === 0) { if (Math.random() < dt * 0.3) c.yaw += R(-1, 1);
        if (S.mode === 'roam' && Math.hypot(player.pos.x - c.p.x, player.pos.z - c.p.z) < 5.5 && Math.abs(player.pos.y + 1.6 - c.p.y) < 8) {
          for (const d of crows) if (d.mode === 0 && d.p.distanceTo(c.p) < 7) { d.mode = 1; d.t = 0; const ax = d.p.x - player.pos.x, az = d.p.z - player.pos.z, l = Math.hypot(ax, az) || 1; d.v.set(ax / l * R(3, 5), R(4, 6), az / l * R(3, 5)); }
          if (t - lastCaw > 1.2) { lastCaw = t; AU.crow(c.p); AU.flutter(c.p); } } }
      else if (c.mode === 1) { c.t += dt; c.v.y -= dt * 1.2; c.v.multiplyScalar(Math.exp(-0.3 * dt)); c.p.addScaledVector(c.v, dt);
        if (c.t > 2.5) { const a = t * 0.5 + i; tgt.set(c.home.x + Math.cos(a) * 10, c.home.y + 14, c.home.z + Math.sin(a) * 10); c.v.lerp(tgt.sub(c.p).multiplyScalar(0.6), dt * 1.5); }
        if (c.t > 16 && Math.hypot(player.pos.x - c.home.x, player.pos.z - c.home.z) > 11) { c.mode = 2; c.t = 0; } }
      else { c.t += dt; tgt.subVectors(c.home, c.p); const d = tgt.length(); c.v.lerp(tgt.multiplyScalar(Math.min(6, d * 1.5) / (d || 1)), dt * 3); c.p.addScaledVector(c.v, dt); if (d < 0.1) { c.mode = 0; c.p.copy(c.home); c.v.set(0, 0, 0); } }
      flap[i] = c.mode ? 1 : 0; o.position.copy(c.p);
      if (c.mode) { tgt.copy(c.p).add(c.v); o.lookAt(tgt); } else o.rotation.set(0, c.yaw, 0);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    im.instanceMatrix.needsUpdate = true; geo.attributes.aFlap.needsUpdate = true;
  });
}
// ---- A witch crosses the moon every so often ----
const WITCH = { t: -25 };
function buildWitch() {
  const g = new THREE.Group(), b = new Batcher(), K = new THREE.MeshBasicMaterial({ color: 0x020103, fog: false });
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), K, 0, 0, 0, 0, { rx: PI / 2 }); b.add(new THREE.ConeGeometry(0.28, 0.8, 8), K, 0, 0, -1.45, 0, { rx: -PI / 2 });
  b.add(new THREE.ConeGeometry(0.35, 1.1, 8), K, 0, 0.45, 0.1, 0, { rx: -0.4 }); b.add(new THREE.SphereGeometry(0.17, 8, 6), K, 0, 1.05, 0.35);
  b.add(new THREE.ConeGeometry(0.22, 0.75, 8), K, 0, 1.5, 0.25, 0, { rx: -0.5 }); b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12), K, 0, 1.18, 0.33);
  b.add(new THREE.PlaneGeometry(0.9, 1.0), K, 0, 0.5, -0.45, 0, { rx: 0.6 }); b.build(g); g.scale.setScalar(6); g.visible = false; scene.add(g);
  const side = new V3().crossVectors(MOON_DIR, _up).normalize(), p = new V3();
  onUpdate((dt) => { WITCH.t += dt; if (WITCH.t > 75) WITCH.t = 0; const k = WITCH.t / 16; g.visible = k >= 0 && k <= 1;
    if (!g.visible) { WITCH.cackled = false; return; }
    p.copy(MOON_DIR).multiplyScalar(320).addScaledVector(side, lerp(-280, 280, k)); p.y += Math.sin(k * PI * 3) * 8 - 4; p.x += camera.position.x * 0.9; p.z += camera.position.z * 0.9;
    g.position.copy(p); g.lookAt(p.x + side.x, p.y + side.y, p.z + side.z); if (!WITCH.cackled && k > 0.45) { WITCH.cackled = true; AU.cackle(null); } });
}
// ---- The gate spider: drops on its thread when you walk under the arch ----
const SPIDER = { cd: 0, t: 0 };
function buildSpider() {
  const g = new THREE.Group(), b = new Batcher(), K = M.black;
  b.add(new THREE.SphereGeometry(0.42, 14, 10), K, 0, 0, 0); b.add(new THREE.SphereGeometry(0.62, 14, 10), K, 0, 0.1, -0.85, 0, { sy: 0.85 });
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.45, p0 = new V3(s * 0.3, 0, Math.sin(a) * 0.3), p1 = new V3(s * 1.1, 0.55, Math.sin(a) * 1.1 + 0.1), p2 = new V3(s * 1.7, -0.6, Math.sin(a) * 1.6 + 0.2);
    cylBetween(p0, p1, 0.05, K, b, 5); cylBetween(p1, p2, 0.04, K, b, 5); }
  b.build(g);
  for (const s of [-1, 1]) for (const k of [0, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.glowRed); e.position.set(s * (0.1 + k * 0.1), 0.15 + k * 0.08, 0.36); g.add(e); }
  const hg = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), M.glowRed); hg.scale.set(1, 0.3, 1.4); hg.position.set(0, -0.35, -0.85); g.add(hg);
  g.position.set(0, 10.3, 79.1); g.rotation.x = PI / 2; scene.add(g);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0xc0c0d0 })); thread.position.set(0, 10.8, 79.1); scene.add(thread);
  const web = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: TX.web, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xa0a0b8 })); web.position.set(-4.2, 8.2, 78.95); web.rotation.z = PI / 2; scene.add(web);
  onUpdate((dt, t) => { SPIDER.cd -= dt;
    if (SPIDER.t <= 0 && SPIDER.cd <= 0 && S.mode === 'roam' && player.pos.z < 83 && player.pos.z > 76 && Math.abs(player.pos.x) < 5) { SPIDER.t = 3.2; SPIDER.cd = 35; AU.hiss(g.position); }
    SPIDER.t -= dt; const down = SPIDER.t > 0; g.position.y = damp(g.position.y, down ? 3.6 : 10.3, down ? 7 : 1.4, dt);
    g.rotation.z = down ? Math.sin(t * 14) * 0.15 : Math.sin(t * 0.7) * 0.05; thread.scale.y = Math.max(0.01, 10.8 - g.position.y); });
}
// ---- Pop-up skeletons hiding in fresh graves along the paths ----
const SCARES = [];
function buildScares() {
  [[9.6, 72], [-9.6, 44.5], [17.5, -27], [33.5, -39.5], [-23, 16], [-31, 43], [5.5, -48], [27, 10.5], [-30, -27], [55, 24], [-17.5, 63.5], [-21, -36.5]].forEach(([x, z]) => {
    const g = SKEL.clone(); g.position.set(x, -2.1, z); g.visible = false; scene.add(g);
    SB.add(boxGeo(1.2, 0.08, 1.2, 1), M.leafPile, x, 0.04, z, R(0, 3), { shadow: false }); SCARES.push({ g, x, z, t: 0, cd: 0 }); });
  onUpdate((dt) => { for (const s of SCARES) { s.cd -= dt;
      if (s.t <= 0 && s.cd <= 0 && S.mode === 'roam' && Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 3.3) {
        s.t = 2.6; s.cd = 28; s.g.visible = true; s.g.rotation.y = Math.atan2(player.pos.x - s.x, player.pos.z - s.z); const at = new V3(s.x, 1.4, s.z);
        AU.rattle(at); (rand() < 0.5 ? AU.cackle(at) : AU.scream(at, 0.2)); S.shake = 0.35; }
      if (s.t > 0) { s.t -= dt; const up = s.t > 0.6; s.g.position.y = damp(s.g.position.y, up ? 0 : -2.1, up ? 14 : 4, dt); s.g.rotation.z = Math.sin(s.t * 18) * 0.05; if (s.t <= 0) s.g.visible = false; } } });
}
// ---- Candy: 150+ wrapped sweets scattered through every corner of the park ----
const CANDY = { list: [] };
function freeSpot(x, z, r = 0.5) {
  for (const c of COLLIDERS) if (c.t === 0 ? Math.hypot(x - c.x, z - c.z) < c.r + r : (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r)) return false;
  return x > -148 && x < 148 && z > -190 && z < 100 && !(typeof inLake === 'function' && inLake(x, z, 2));
}
function buildCandy() {
  setSeed(8080); const pts = [], tryAdd = (x, z) => { if (freeSpot(x, z)) pts.push([x, z]); };
  for (const [x1, z1, x2, z2, w] of PATHS) { const len = Math.hypot(x2 - x1, z2 - z1); for (let d = 3; d < len; d += R(5, 9)) { const t = d / len; tryAdd(lerp(x1, x2, t) + R(-w / 3, w / 3), lerp(z1, z2, t) + R(-w / 3, w / 3)); } }
  [[0, 0, 24, 14], [48, -55, 17, 24], [-40, 32, 10, 8], [32, 18, 14, 6], [-40, -16, 12, 6], [64, 40, 11, 6], [62, 6, 8, 4], [0, -71, 15, 16], [20, -34, 9, 8], [-26, -42, 7, 4], [-28, 60, 9, 5], [0, 88, 12, 6], [-68, 0, 20, 8], [-15, 50, 3, 3], [16, 42, 3, 3]]
    .forEach(([cx, cz, r, n]) => { for (let i = 0; i < n; i++) { const a = R(0, TAU), rr = Math.sqrt(rand()) * r; tryAdd(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr); } });
  const N = pts.length, body = new THREE.SphereGeometry(0.075, 10, 8).scale(1.5, 1, 1).toNonIndexed();
  const e1 = new THREE.ConeGeometry(0.06, 0.09, 6).rotateZ(PI / 2).translate(0.15, 0, 0).toNonIndexed(), e2 = new THREE.ConeGeometry(0.06, 0.09, 6).rotateZ(-PI / 2).translate(-0.15, 0, 0).toNonIndexed();
  const im = new THREE.InstancedMesh(mergeGeometries([body, e1, e2]), M.candy, N), sp = makePoints(N), cols = [0xff5a2a, 0xb060ff, 0x50ff90, 0xffd040, 0xff4080, 0x40c0ff];
  pts.forEach(([x, z], i) => { const c = new THREE.Color(pick(cols)), y = 0.55 + groundAt(x, z); im.setColorAt(i, c.clone().multiplyScalar(1.1)); CANDY.list.push({ x, z, y, ph: R(0, TAU), got: false, k: 0 });
    sp.col.set([c.r * 0.7, c.g * 0.7, c.b * 0.7], i * 3); sp.pos.set([x, y, z], i * 3); sp.size[i] = 0.35; });
  im.frustumCulled = false; scene.add(im); sp.flag(); CANDY.N = N; CANDY.sp = sp;
  const o = new THREE.Object3D(); let combo = 0, comboT = 0;
  onUpdate((dt, t) => { comboT -= dt; if (comboT <= 0) combo = 0;
    for (let i = 0; i < N; i++) { const c = CANDY.list[i];
      if (c.got) { if (c.k > 0) { c.k = Math.max(0, c.k - dt * 4); o.position.set(c.x, c.y + (1 - c.k) * 1.2, c.z); o.scale.setScalar(c.k); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } continue; }
      const y = c.y + Math.sin(t * 2.5 + c.ph) * 0.08; o.position.set(c.x, y, c.z); o.rotation.set(0.3, t * 2 + c.ph, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      sp.pos[i * 3 + 1] = y; sp.size[i] = 0.3 + Math.sin(t * 4 + c.ph) * 0.08;
      if (S.mode === 'roam' && Math.abs(player.pos.x - c.x) < 1.15 && Math.abs(player.pos.z - c.z) < 1.15 && Math.abs(player.pos.y + 0.55 - c.y) < 1.4) {
        c.got = true; c.k = 1; sp.size[i] = 0; S.candy++; S.candyPick++; combo++; comboT = 1.3; AU.candy(combo); updateCounters();
        if (S.candyPick === N) toast('Every last sweet!', 'Your dentist just felt a chill.', 'soul'); else if (S.candyPick % 25 === 0) toast(t('{a} / {b} sweets found', { a: S.candyPick, b: N }), 'Your pockets rattle with sugar.'); } }
    im.instanceMatrix.needsUpdate = true; sp.flag(); });
}
// ---- Loose pumpkins: shove them by walking, kick them with a click, smash them against walls ----
const LOOSE = [];
function buildLoosePumpkins() {
  setSeed(5150); const spots = [];
  [[0, 0, 23], [0, 50, 6], [0, 90, 9], [-40, 32, 9], [32, 18, 13], [20, -32, 8], [-28, 52, 6], [62, 54, 6], [-26, -35, 4], [0, -50, 5], [48, -32, 5], [-60, 20, 6]].forEach(([cx, cz, r]) => {
    for (let k = 0; k < 3; k++) for (let tries = 0; tries < 30; tries++) { const a = R(0, TAU), rr = R(r * 0.4, r), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; if (freeSpot(x, z, 0.7)) { spots.push([x, z]); break; } } });
  spots.forEach(([x, z], i) => { const m = new THREE.Mesh(PUMPKIN_GEO, i % 2 ? M.pumpkin : M.pumpkinLit); m.scale.setScalar(0.4); m.castShadow = true; m.rotation.y = R(0, TAU); scene.add(m);
    LOOSE.push({ m, p: new V3(x, 0.32, z), v: new V3(), home: new V3(x, 0.32, z), r: 0.36, gone: 0 }); });
  const ax = new V3();
  onUpdate((dt) => { if (dt <= 0) return;
    for (const L of LOOSE) {
      if (L.gone > 0) { L.gone -= dt; if (L.gone <= 0) { L.p.copy(L.home); L.v.set(0, 0, 0); L.m.visible = true; L.m.scale.setScalar(0.01); } continue; }
      if (L.m.scale.x < 0.4) L.m.scale.setScalar(Math.min(0.4, L.m.scale.x + dt * 0.8));
      if (S.mode === 'roam') { const dx = L.p.x - player.pos.x, dz = L.p.z - player.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.8 && d > 1e-3 && L.p.y < 1.2) { const spd = Math.hypot(player.vel.x, player.vel.z); L.v.x += dx / d * (1.5 + spd * 1.2) * dt * 8; L.v.z += dz / d * (1.5 + spd * 1.2) * dt * 8; L.p.x = player.pos.x + dx / d * 0.8; L.p.z = player.pos.z + dz / d * 0.8; } }
      const air = L.p.y > L.r + 0.01 || L.v.y > 0; if (air) L.v.y -= 9.8 * dt;
      L.p.addScaledVector(L.v, dt);
      if (L.p.y < L.r) { L.p.y = L.r; if (L.v.y < -3) { L.v.y = -L.v.y * 0.38; AU.thud(L.p, 0.4); } else L.v.y = 0; }
      if (L.p.y <= L.r + 0.01) { const f = Math.exp(-2.4 * dt); L.v.x *= f; L.v.z *= f; }
      const n = ballCollide(L.p, L.r);
      if (n) { const vn = L.v.x * n.x + L.v.z * n.z; if (vn < 0) { const spd = Math.hypot(L.v.x, L.v.z); if (spd > 7) { smashPumpkin(L); continue; } L.v.x -= 1.6 * vn * n.x; L.v.z -= 1.6 * vn * n.z; if (spd > 2) AU.thud(L.p, 0.3); } }
      const spd = Math.hypot(L.v.x, L.v.z); if (spd > 0.02) { ax.set(L.v.z, 0, -L.v.x).normalize(); L.m.rotateOnWorldAxis(ax, spd * dt / L.r); }
      L.m.position.copy(L.p);
    } });
}
function ballCollide(p, r) {
  let nx = 0, nz = 0, hit = false;
  for (const c of nearColliders(p.x, p.z, r + 1)) { if (c.off) continue;
    if (c.t === 0) { const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; nx += dx / d; nz += dz / d; hit = true; } }
    else { if (p.x < c.x0 - r || p.x > c.x1 + r || p.z < c.z0 - r || p.z > c.z1 + r) continue; const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; nx += dx / d; nz += dz / d; hit = true; } } }
  if (p.x < -149 || p.x > 149) { nx += p.x < 0 ? 1 : -1; p.x = clamp(p.x, -149, 149); hit = true; } if (p.z < -191 || p.z > 101) { nz += p.z < 0 ? 1 : -1; p.z = clamp(p.z, -191, 101); hit = true; }
  if (!hit) return null; const l = Math.hypot(nx, nz) || 1; return { x: nx / l, z: nz / l };
}
function kickPumpkin() {
  let best = null, bd = 2.6; const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  for (const L of LOOSE) { if (L.gone > 0) continue; const dx = L.p.x - player.pos.x, dz = L.p.z - player.pos.z, d = Math.hypot(dx, dz); if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.4) { bd = d; best = L; } }
  if (!best) return false; const up = clamp(0.35 + player.pitch, 0.15, 1.0);
  best.v.set(fx * R(9, 11.5), 4 + up * 4, fz * R(9, 11.5)); best.p.y = Math.max(best.p.y, best.r + 0.02); AU.kick(best.p); S.kicks++;
  if (S.kicks === 1) toast('Nice kick!', 'Boot a pumpkin hard into a wall and it splatters.'); return true;
}
function smashPumpkin(L) { L.gone = 14; L.m.visible = false; FW.burst(L.p, 70, new THREE.Color(3, 1.1, 0.15), 4, 'splat'); FW.burst(L.p, 25, new THREE.Color(1.6, 1.6, 0.4), 2.5, 'splat'); AU.splat(L.p); S.smashed++; }
function banishGhost(g) {
  g.gone = S.hunt ? 4 : 40; g.stun = 0; if (S.hunt) S.hunt.n++; FW.burst(g.m.position, 140, new THREE.Color(1.4, 3.2, 2.6), 6, 'soul'); AU.banish(g.m.position); S.ghosts++; updateCounters();
  toast(t('Ghost banished · {n}', { n: S.ghosts }), pick(['It dissolves into a long sigh.', 'Sent back to wherever it came from.', 'It will be back. They always are.', 'The lantern wins this round.'])); if (S.ghosts === 5) markDone('ghosts');
}

export { SKEL, makeSkeleton, GALLOWS, buildAtmosphereProps, buildCrows, WITCH, buildWitch, SPIDER, buildSpider, SCARES, buildScares, CANDY, freeSpot, buildCandy, LOOSE, buildLoosePumpkins, ballCollide, kickPumpkin, smashPumpkin, banishGhost };
