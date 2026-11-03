import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { $, PI, R, TAU, V3, clamp, hdr, pick, rand, smooth } from '../core/utils.js';
import { FX_OBJECTS, LIGHTS, camera, scene } from '../core/renderer.js';
import { M, TX } from '../core/materials.js';
import { U_TIME, coneMat, ghostMat, makePoints, mistMat } from '../core/shaders.js';
import { SB, addCircle, onUpdate } from '../core/registry.js';
import { groundAt } from './landscape.js';
import { banishGhost } from './dressing.js';
import { AU } from '../core/audio.js';
import { S, startWitchingHour } from '../game/play.js';
import { showCard, toast } from '../ui/ui.js';
import { fwd } from '../main.js';
import { t } from '../core/i18n.js';
import { burst, launch as pyroLaunch, show as pyroShow } from '../game/pyro.js';

/* =========================================================================
   7. ATMOSPHERE — ghosts, bats, leaves, wisps, mist, searchlights, souls, fireworks, lightning
   ========================================================================= */
let GHOST_GEO;
const GHOSTS = [];
function buildGhosts() {
  const prof = [[0, 1.05], [0.18, 1.02], [0.34, 0.92], [0.45, 0.75], [0.5, 0.5], [0.5, 0.2], [0.53, -0.1], [0.58, -0.45], [0.66, -0.8]].map(([x, y]) => new THREE.Vector2(x, y));
  GHOST_GEO = new THREE.LatheGeometry(prof, 32);
}
function spawnGhosts() {
  const paths = [[0, 0, 27, 6, 0.12], [0, -66, 17, 8, -0.18], [48, -55, 13, 4.5, 0.22], [0, 50, 6, 6.5, 0.3], [-40, 32, 9, 5, -0.25], [-40, -16, 18, 12, 0.1], [32, 18, 13, 7, -0.15]];
  paths.forEach(([cx, cz, r, h, sp], i) => {
    const m = new THREE.Mesh(GHOST_GEO, ghostMat(i % 3 === 2 ? 0x9ab8ff : 0xb0ffe0, i * 1.7)); m.scale.setScalar(R(0.9, 1.4)); scene.add(m); FX_OBJECTS.push(m);
    GHOSTS.push({ m, cx, cz, r, h, sp, ph: R(0, TAU) });
  });
  const gv = new V3(), cBase = new THREE.Color(0xb0ffe0), cRed = new THREE.Color(0xff5040), cW = new THREE.Color(0xffffff);
  onUpdate((dt, t) => {
    for (const g of GHOSTS) {
      if (g.gone > 0) { g.gone -= dt; g.m.visible = false; if (g.gone <= 0) { g.m.visible = true; g.stun = 0; g.fade = 0; } continue; }
      g.fade = Math.min(1, (g.fade ?? 1) + dt * 0.4); g.stun = g.stun || 0; g.tt = (g.tt || 0) + dt * (g.stun > 0.05 ? 0.15 : 1);
      const a = g.ph + g.tt * g.sp * 1.4, x = g.cx + Math.cos(a) * g.r * (1 + 0.3 * Math.sin(a * 2.3)), z = g.cz + Math.sin(a) * g.r, a2 = a + 0.05 * Math.sign(g.sp);
      const nx = g.cx + Math.cos(a2) * g.r * (1 + 0.3 * Math.sin(a2 * 2.3)), nz = g.cz + Math.sin(a2) * g.r, sh = g.stun > 0.05 ? (Math.random() - 0.5) * 0.15 * g.stun : 0;
      g.m.position.set(x + sh, g.h + Math.sin(t * 1.3 + g.ph) * 0.6, z + sh); g.m.rotation.y = Math.atan2(nx - x, nz - z); g.m.rotation.z = Math.sin(t * 2 + g.ph) * 0.1;
      // the lantern beam stuns & banishes ghosts
      let lit = false;
      if (S.lantern && S.mode === 'roam') { gv.subVectors(g.m.position, camera.position); const d = gv.length(); if (d < 32) lit = gv.dot(fwd) / d > Math.cos(0.16 + 0.9 / d); }
      g.stun = lit ? g.stun + dt : Math.max(0, g.stun - dt * 0.5);
      if (lit && Math.random() < dt * 5) AU.noise({ dur: 0.15, vol: 0.03 + g.stun * 0.05, type: 'bandpass', f: 1000 + g.stun * 1600, q: 6 });
      if (g.stun > 1.6) { banishGhost(g); continue; }
      if (!S.ghostHint && S.mode === 'roam' && camera.position.distanceTo(g.m.position) < 16) { S.ghostHint = true; toast('A wandering ghost!', 'Press F to raise your lantern — hold the beam on a ghost to banish it.', 'soul'); }
      const u = g.m.material.uniforms; u.uColor.value.lerpColors(cBase, cRed, S.witch); if (g.stun > 0) u.uColor.value.lerp(cW, Math.min(1, g.stun / 1.6));
      u.uOpacity.value = (S.potion === 'spectral' ? 2.5 : 1) * g.fade * (1 + g.stun * 1.4);
    }
  });
}
const BATS = {};
function buildBats() {
  const N = 220;
  const wing = [0, 0, 0.1, 0.65, 0, 0.28, 1.0, 0, 0.0, 0, 0, 0.1, 1.0, 0, 0.0, 0.7, 0, -0.18, 0, 0, 0.1, 0.7, 0, -0.18, 0.45, 0, -0.05, 0, 0, 0.1, 0.45, 0, -0.05, 0, 0, -0.15];
  const pos = []; for (let i = 0; i < wing.length; i += 3) pos.push(wing[i], wing[i + 1], wing[i + 2]); for (let i = 0; i < wing.length; i += 3) pos.push(-wing[i], wing[i + 1], wing[i + 2]);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const body = new THREE.SphereGeometry(0.12, 6, 4).scale(0.8, 0.8, 1.6).toNonIndexed(); body.deleteAttribute('normal'); body.deleteAttribute('uv');
  const geo = mergeGeometries([wg, body]);
  const ph = new Float32Array(N); for (let i = 0; i < N; i++) ph[i] = R(0, TAU);
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uTime: U_TIME },
    vertexShader: `attribute float aPhase; uniform float uTime; void main(){ vec3 p=position; float w=abs(p.x); p.y+=w*w*sin(uTime*19.+aPhase)*.9; p.x*=.85+.15*cos(uTime*19.+aPhase);
      gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(p,1.); }`,
    fragmentShader: `void main(){ gl_FragColor=vec4(.008,.006,.01,1.); }` });
  const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; scene.add(im); FX_OBJECTS.push(im);
  const bats = [];
  for (let i = 0; i < N; i++) { const grp = i % 4;
    const c = grp === 0 ? [0, 34, 0] : grp === 1 ? [0, 22, -66] : grp === 2 ? [-120, 70, -260] : [R(-60, 60), 28, R(-60, 60)];
    bats.push({ c: new V3(...c), r: grp === 2 ? R(20, 60) : R(10, 34), w: R(0.25, 0.6) * (rand() > 0.5 ? 1 : -1), a: R(0, TAU), y: R(-4, 6), s: R(0.6, 1.1), burst: 0, bv: new V3(), bp: new V3() }); }
  const o = new THREE.Object3D(), p = new V3(), q = new V3();
  Object.assign(BATS, { im, burst(at, n) { let k = 0; for (const b of bats) { if (k >= n) break; if (b.burst > 0) continue; b.burst = 4; b.bp.copy(at); b.bv.set(R(-6, 6), R(5, 11), R(-6, 6)); k++; } } });
  onUpdate((dt, t) => {
    for (let i = 0; i < N; i++) { const b = bats[i]; b.a += b.w * dt * (1 + S.witch * 1.5);
      const r = b.r * (S.witch > 0.3 && i % 4 < 2 ? 0.6 : 1), cy = b.c.y + (S.witch > 0.3 && i % 4 === 1 ? 12 : 0);
      p.set(b.c.x + Math.cos(b.a) * r, cy + b.y + Math.sin(b.a * 2.3) * 3, b.c.z + Math.sin(b.a) * r);
      if (S.witch > 0.3 && i % 4 < 2) p.set(Math.cos(b.a) * r * 0.9, 30 + b.y + Math.sin(b.a * 3) * 4, Math.sin(b.a) * r * 0.9);
      if (b.burst > 0) { b.burst -= dt; b.bp.addScaledVector(b.bv, dt); b.bv.y -= dt * 1.5; const k = smooth(4, 2, b.burst); p.lerpVectors(b.bp, p, k); }
      q.set(b.c.x + Math.cos(b.a + 0.1 * Math.sign(b.w)) * r, p.y, b.c.z + Math.sin(b.a + 0.1 * Math.sign(b.w)) * r);
      o.position.copy(p); o.lookAt(q); o.scale.setScalar(b.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    im.instanceMatrix.needsUpdate = true;
  });
}
function buildLeaves() {
  const N = 420, mat = new THREE.MeshStandardMaterial({ map: TX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2), mat, N); im.frustumCulled = false; scene.add(im);
  const L = []; for (let i = 0; i < N; i++) { L.push({ p: new V3(R(-30, 30), R(0, 22), R(-30, 30)), v: R(0.5, 1.1), s: R(0.6, 1.5), ph: R(0, TAU), sp: R(1, 3) });
    im.setColorAt(i, new THREE.Color(pick([0x9a3a0a, 0xc06010, 0x6a2008, 0xa08020, 0x501808]))); }
  const o = new THREE.Object3D();
  onUpdate((dt, t) => { const c = camera.position;
    for (let i = 0; i < N; i++) { const l = L[i]; l.p.y -= l.v * dt; l.p.x += (Math.sin(t * l.sp * 0.5 + l.ph) * 0.8 + 0.6) * dt; l.p.z += Math.cos(t * 0.4 + l.ph) * 0.5 * dt;
      let wx = l.p.x - c.x, wz = l.p.z - c.z; if (wx > 30) l.p.x -= 60; if (wx < -30) l.p.x += 60; if (wz > 30) l.p.z -= 60; if (wz < -30) l.p.z += 60;
      const gy = l.p.y < 0.02 ? 0.02 : l.p.y; if (l.p.y < -6) { l.p.y = 22 + R(0, 4); }
      o.position.set(l.p.x, Math.max(0.03, gy), l.p.z); o.rotation.set(l.p.y > 0.05 ? t * l.sp + l.ph : -PI / 2, l.ph + (l.p.y > 0.05 ? t * l.sp * 0.7 : 0), 0); o.scale.setScalar(l.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    im.instanceMatrix.needsUpdate = true; });
}
function buildWisps() {
  const N = 320, w = makePoints(N), data = [];
  const spots = [[0, 50, 12], [0, 0, 26], [48, -55, 18], [0, -66, 14], [-40, 32, 12], [32, 18, 12], [-40, -16, 16], [22, -33, 10], [0, 88, 12], [-68, -20, 30]];
  for (let i = 0; i < N; i++) { const [cx, cz, r] = pick(spots), a = R(0, TAU), rr = Math.sqrt(rand()) * r;
    data.push({ x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr, y: R(0.4, 3.5), ph: R(0, TAU), sp: R(0.2, 0.7), c: pick([[0.4, 1.6, 0.9], [1.6, 0.8, 0.2], [1.0, 0.5, 1.8], [1.4, 1.3, 0.6]]), s: R(0.06, 0.14) }); }
  onUpdate((dt, t) => { for (let i = 0; i < N; i++) { const d = data[i], k = i * 3;
      w.pos[k] = d.x + Math.sin(t * d.sp + d.ph) * 1.6; w.pos[k + 1] = d.y + Math.sin(t * d.sp * 1.7 + d.ph * 2) * 0.6; w.pos[k + 2] = d.z + Math.cos(t * d.sp * 0.8 + d.ph) * 1.6;
      const b = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 + d.ph * 3), 3) * 2.5 + 0.2; w.col[k] = d.c[0] * b; w.col[k + 1] = d.c[1] * b; w.col[k + 2] = d.c[2] * b; w.size[i] = d.s; }
    w.flag(); });
}
const MISTS = [];
function buildMist() {
  [[0.35, 0.1, 0.035, 1], [0.9, 0.07, 0.022, 0.7], [1.9, 0.04, 0.015, 0.5]].forEach(([y, a, s, sp]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(820, 820).rotateX(-PI / 2), mistMat(a, s, sp)); m.position.set(0, y, -55); m.renderOrder = 2; scene.add(m); FX_OBJECTS.push(m); MISTS.push(m); });
}
function buildSearchlights() {
  const beams = [];
  const geo = new THREE.ConeGeometry(7, 170, 32, 1, true).translate(0, -85, 0).rotateX(PI);
  [[-22, 92, 0xb080ff], [22, 92, 0xff9040], [-60, -186, 0x60ffb0], [60, -186, 0xb080ff], [144, -120, 0xff9040], [-144, 70, 0x60ffb0], [144, 72, 0xb080ff], [-144, -60, 0xff9040]].forEach(([x, z, c], i) => {
    SB.add(new THREE.CylinderGeometry(0.7, 0.9, 1, 12), M.iron, x, 0.5, z); addCircle(x, z, 0.9);
    const yaw = new THREE.Group(); yaw.position.set(x, 1.1, z); scene.add(yaw); const tilt = new THREE.Group(); yaw.add(tilt);
    const m = new THREE.Mesh(geo, coneMat(c, 0.085, 18)); tilt.add(m); FX_OBJECTS.push(m);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(8) })); lens.rotation.x = -PI / 2; lens.position.y = 0.05; tilt.add(lens);
    beams.push({ yaw, tilt, ph: i * 1.3, sp: 0.12 + i * 0.02 }); });
  onUpdate((dt, t) => { for (const b of beams) { b.tilt.visible = S.lightShow !== 'show'; b.yaw.rotation.y = t * b.sp + b.ph; b.tilt.rotation.z = 0.35 + 0.22 * Math.sin(t * 0.37 + b.ph) + (S.witch > 0.5 ? 0.3 * Math.sin(t * 3 + b.ph) : 0); } });
}
// ---- Collectible lost souls ----
const SOUL_SPOTS = [[16, 86], [-16.5, 58], [18.5, 42], [0, -11.5], [43, 26], [-40, -8.5], [-61, -3], [-50, 41], [48, -55], [32, -71], [10, -80.4], [-14.6, -59.6], [46, -25]];
const SOULS = [];
function buildSouls() {
  const coreG = new THREE.SphereGeometry(0.16, 16, 12), ringG = new THREE.TorusGeometry(0.42, 0.015, 6, 48);
  const coreM = new THREE.MeshBasicMaterial({ color: hdr(0xb8ffe8, 4.5) }), ringM = new THREE.MeshBasicMaterial({ color: hdr(0x60ffc0, 2.6) });
  SOUL_SPOTS.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 1.35 + groundAt(x, z) + (i === 10 ? 0.6 : 0), z); scene.add(g);
    g.add(new THREE.Mesh(coreG, coreM));
    const r1 = new THREE.Mesh(ringG, ringM), r2 = new THREE.Mesh(ringG, ringM); r2.rotation.x = PI / 2; g.add(r1, r2);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, color: hdr(0x50ffb0, 1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.setScalar(2.2); g.add(halo);
    SOULS.push({ g, r1, r2, i, got: false, active: i !== 10, base: g.position.y });
    if (i === 10) g.visible = false;
  });
  onUpdate((dt, t) => {
    for (const s of SOULS) { if (s.got || !s.active) continue;
      s.g.position.y = s.base + Math.sin(t * 2 + s.i) * 0.18; s.r1.rotation.y += dt * 1.8; s.r2.rotation.z += dt * 1.2; s.r1.rotation.x = Math.sin(t + s.i) * 0.6;
      if (camera.position.distanceTo(s.g.position) < 1.7 && (S.mode === 'roam' || S.mode === 'ride')) collectSoul(s); }
  });
}
function collectSoul(s) {
  s.got = true; s.g.visible = false; S.souls++; FW.burst(s.g.position, 90, new THREE.Color(0.5, 2.5, 1.6), 5, 'soul'); AU.chime();
  $('#soulCount').textContent = S.souls; const el = $('#souls'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  const lines = ['A child who lost her balloon', 'A clown who never stopped laughing', 'The carousel’s first rider', 'A ticket-taker from 1888', 'A juggler of skulls', 'The ringmaster’s shadow', 'A runaway bride', 'An unlucky coaster tester', 'The lantern-maker', 'A cat with eight more lives', 'The Manor’s last guest', 'A forgotten fortune-teller', 'The swing that flew too high'];
  toast(t('Soul freed · {n} / 13', { n: S.souls }), lines[s.i], 'soul');
  if (S.souls === 13) setTimeout(() => { showCard('The Pumpkin King awakens', 'All thirteen souls are free. Hollowmoor thanks you… and will never let you leave.', 6000); startWitchingHour(true); }, 1500);
}
// ---- Fireworks particle system ----
const FW = {}, C_TRAIL = new THREE.Color(2.5, 1.4, 0.6);
function buildFireworks() {
  const N = 6000, P = makePoints(N), vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), base = new Float32Array(N * 3), drag = new Float32Array(N), grav = new Float32Array(N), fl = new Uint8Array(N);
  let idx = 0; const rockets = [];
  const spawn = (p, v, c, l, sz, dr = 0.985, g = 1, f = 0) => { FW.dirty = true; const i = idx; idx = (idx + 1) % N; P.pos[i * 3] = p.x; P.pos[i * 3 + 1] = p.y; P.pos[i * 3 + 2] = p.z;
    vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z; base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b; life[i] = max[i] = l; P.size[i] = sz; drag[i] = dr; grav[i] = g; fl[i] = f; };
  const v = new V3();
  FW.burst = (p, n, col, speed, type = 'peony') => {
    for (let k = 0; k < n; k++) { v.set(R(-1, 1), R(-1, 1), R(-1, 1)); if (v.lengthSq() > 1) { k--; continue; }
      if (type === 'ring') { const a = k / n * TAU; v.set(Math.cos(a), Math.sin(a) * 0.15, Math.sin(a)); }
      v.normalize().multiplyScalar(speed * (type === 'ring' ? 1 : R(0.7, 1)));
      const willow = type === 'willow';
      const T = { willow: [2.8, 3.6, 0.32, 0.965, 0.6], soul: [0.8, 1.4, 0.12, 0.975, -0.2], splat: [0.5, 1.0, 0.1, 0.94, 1.6], spark: [0.25, 0.5, 0.06, 0.92, 0.8] }[type] || [1.6, 2.4, 0.45, 0.975, 0.35];
      spawn(p, v, col, R(T[0], T[1]), T[2], T[3], T[4], type === 'crackle' ? 1 : 0); }
  };
  // big > 1 = finale shells: launched higher, wider bursts, a second colour break
  FW.launch = (x, z, big = 1, type) => { pyroLaunch({ x, z, size: clamp(big, 0.8, 3), type: { peony: 'peony', ring: 'ring', willow: 'willow', crackle: 'crackle' }[type] || 'random' }); };
  FW.launchOld = (x, z, big = 1, type) => { const cols = [[4, 1.2, 0.2], [2.4, 0.6, 5], [0.6, 4, 1.4], [5, 2.4, 0.6], [4.5, 0.4, 0.4], [3.6, 3.6, 3.2]]; const c = pick(cols);
    rockets.push({ p: new V3(x, 0.5, z), v: new V3(R(-2, 2), R(27, 34) * Math.sqrt(big), R(-2, 2)), fuse: R(1.3, 1.8) * Math.sqrt(big), col: new THREE.Color(...c), big, type: type || pick(['peony', 'peony', 'ring', 'willow', 'crackle']) });
    AU.launch(new V3(x, 1, z)); };
  onUpdate((dt) => {
    for (let r = rockets.length - 1; r >= 0; r--) { const k = rockets[r]; k.v.y -= 9.8 * 0.5 * dt; k.p.addScaledVector(k.v, dt); k.fuse -= dt;
      spawn(k.p, v.set(R(-.5, .5), R(-1, 0), R(-.5, .5)), C_TRAIL, 0.5, 0.18, 0.95, 0.2);
      if (k.fuse <= 0) { const col = k.type === 'willow' ? new THREE.Color(4, 2.4, 0.7) : k.col, B = k.big || 1; FW.burst(k.p, Math.round((k.type === 'ring' ? 120 : 180) * Math.min(B, 2.2)), col, (k.type === 'willow' ? 11 : 15) * Math.sqrt(B), k.type);
        if (B > 1) { FW.burst(k.p, 90, new THREE.Color(pick([[3.6, 3.6, 3.2], [0.6, 2.4, 5], [5, 0.8, 2.6]])[0], 2.6, 2), 9 * Math.sqrt(B), 'ring'); FW.burst(k.p, 50, new THREE.Color(4, 3, 1.2), 4, 'crackle'); }
        else if (rand() > 0.5) FW.burst(k.p, 60, new THREE.Color(3.5, 3.5, 3), 6, 'peony');
        LIGHTS.flash.position.copy(k.p); LIGHTS.flash.color.setRGB(col.r / 5, col.g / 5, col.b / 5); S.fwFlash = 1; AU.boom(k.p.clone()); rockets.splice(r, 1); } }
    S.fwFlash = Math.max(0, (S.fwFlash || 0) - dt * 2.5); LIGHTS.flash.intensity = S.fwFlash * 3000;
    if (!FW.dirty) return; let alive = 0;
    for (let i = 0; i < N; i++) { if (life[i] <= 0) { if (P.size[i]) P.size[i] = 0; continue; } alive++;
      life[i] -= dt; const k = i * 3, d = Math.pow(drag[i], dt * 60);
      vel[k] *= d; vel[k + 1] = vel[k + 1] * d - 9.8 * grav[i] * dt; vel[k + 2] *= d;
      P.pos[k] += vel[k] * dt; P.pos[k + 1] += vel[k + 1] * dt; P.pos[k + 2] += vel[k + 2] * dt;
      let f = Math.max(0, life[i] / max[i]); f = f * f; if (fl[i] && life[i] < max[i] * 0.5) f *= Math.random() > 0.5 ? 2.5 : 0;
      P.col[k] = base[k] * f; P.col[k + 1] = base[k + 1] * f; P.col[k + 2] = base[k + 2] * f; if (life[i] <= 0) P.size[i] = 0; }
    FW.dirty = alive > 0; P.flag();
  });
}
function fireworksShow(dur = 18) {
  toast('Fireworks over Hollowmoor', 'Look up.', ''); S.lightShow = 'rainbow'; S.lightShowT = dur; pyroShow(dur); return;
  const spots = [[-30, -40], [30, -40], [0, -85], [-60, -70], [60, -80], [0, 40], [-45, 10], [45, 0]];
  const n = Math.floor(dur * 1.6);
  for (let i = 0; i < n; i++) setTimeout(() => { const [x, z] = pick(spots); FW.launch(x + R(-6, 6), z + R(-6, 6)); }, (i / n) * dur * 1000 + R(0, 400));
  for (let i = 0; i < 6; i++) setTimeout(() => { const [x, z] = pick(spots); FW.launch(x, z); }, dur * 1000 + i * 120);
}
// ---- Lightning ----
let BOLT;
function strike() {
  if (BOLT) { scene.remove(BOLT); BOLT.geometry.dispose(); }
  const a = R(-PI, 0) + R(-0.6, 0.6), d = R(140, 260), x = Math.cos(a) * d + camera.position.x, z = Math.sin(a) * d + camera.position.z;
  const path = new THREE.CurvePath(); let p = new V3(x, 150, z);
  while (p.y > 25) { const n = p.clone().add(new V3(R(-8, 8), -R(6, 14), R(-8, 8))); path.add(new THREE.LineCurve3(p, n)); p = n; }
  BOLT = new THREE.Mesh(new THREE.TubeGeometry(path, path.curves.length * 2, 0.7, 4, false), new THREE.MeshBasicMaterial({ color: hdr(0xd0c0ff, 14), fog: false, transparent: true }));
  scene.add(BOLT); FX_OBJECTS.push(BOLT); S.flash = 1; S.flashCol.set(0.25, 0.22, 0.4);
  setTimeout(() => AU.thunder(d), 300 + d * 4);
}

export { GHOST_GEO, GHOSTS, buildGhosts, spawnGhosts, BATS, buildBats, buildLeaves, buildWisps, MISTS, buildMist, buildSearchlights, SOUL_SPOTS, SOULS, buildSouls, collectSoul, FW, C_TRAIL, buildFireworks, fireworksShow, BOLT, strike };
