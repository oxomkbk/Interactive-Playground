import * as THREE from 'three';
import { t } from '../core/i18n.js';
import { $, PI, R, TAU, V3, clamp, damp, hdr, pick, rand, yawTo } from '../core/utils.js';
import { GLSL_NOISE, U_TIME, coneMat } from '../core/shaders.js';
import { FOGU, FX_OBJECTS, MOON_DIR, camera, pointLight, scene } from '../core/renderer.js';
import { Batcher, PLATFORMS, ROCKS, SB, addBox, addCircle, addInteract, addLamp, addPool, cylBetween, makeBulbs, onUpdate, scaleUV } from '../core/registry.js';
import { M, TX } from '../core/materials.js';
import { addBarrel, chunkedInstances, lathe, merge, roundBox } from './props.js';
import { S, SCORES, boardRide, endGame, keys, player, saveScores } from '../game/play.js';
import { addMarker, makeSign, markDone } from './attractions.js';
import { AU } from '../core/audio.js';
import { fade, floater, toast } from '../ui/ui.js';
import { cnv, signTex, stripeTex, toTex } from '../core/textures.js';
import { SKEL, makeSkeleton } from './dressing.js';
import { RIDES } from './rides.js';
import { AUR, AURORA_GLSL } from './aurora.js';
import { FW } from './atmosphere.js';
import { PY } from '../game/pyro.js';
/* =========================================================================
   LAKE OF LOST SOULS — moonlit water with a glitter path, hundreds of drifting lanterns (and their reflections),
   an island lighthouse sweeping the park, the Styx Ferry, the Ghost Galleon swing ship, "Bob for Souls" fishing,
   and the Lantern Festival spectacle.
   ========================================================================= */
const LAKE = { cx: 112, cz: -50, rx: 28, rz: 40 };
const inLake = (x, z, m = 0) => ((x - LAKE.cx) / (LAKE.rx + m)) ** 2 + ((z - LAKE.cz) / (LAKE.rz + m)) ** 2 < 1;

// Lofted boat hull: half-elliptic sections narrowing to bow & stern with an upswept sheer line (open top, double-sided)
function hullGeo(L = 4.4, W = 1.6, D = 0.9, sheer = 0.35, segL = 28, segR = 14) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= segL; i++) { const t = i / segL, z = (t - 0.5) * L, e = Math.abs(t - 0.5) * 2;
    const w = W / 2 * Math.sqrt(Math.max(0, 1 - Math.pow(e, 2.4))) + 0.002, d = D * (1 - 0.35 * e * e), top = sheer * e * e;
    for (let j = 0; j <= segR; j++) { const a = j / segR * PI; pos.push(-Math.cos(a) * w, top - Math.sin(a) * d, z); uv.push(j / segR * 2, t * L / 2); } }
  for (let i = 0; i < segL; i++) for (let j = 0; j < segR; j++) { const a = i * (segR + 1) + j, b = a + segR + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const LANTERN_PROFILE = [[0.001, 0], [0.08, 0], [0.16, 0.07], [0.19, 0.19], [0.16, 0.31], [0.08, 0.37], [0.001, 0.38]];

function lakeWaterMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U_TIME, uMoon: { value: MOON_DIR }, uFogC: { value: scene.fog.color }, uFog: FOGU, uRed: { value: 0 }, uAur: { value: AUR.rt ? AUR.rt.texture : null }, uAI: { value: 0.85 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `${GLSL_NOISE} ${AURORA_GLSL} uniform float uTime,uFog,uRed,uAI; uniform vec3 uMoon,uFogC; uniform sampler2D uAur; varying vec3 vW;
      float hgt(vec2 q){ return fbm3(q*.32+vec2(uTime*.05,uTime*.03))+.5*fbm3(q*1.1-vec2(uTime*.07,-uTime*.04)); }
      void main(){
        vec2 p=vW.xz; float e=.35, h=hgt(p), hx=hgt(p+vec2(e,0.)), hz=hgt(p+vec2(0.,e));
        vec3 n=normalize(vec3(-(hx-h)/e*.55,1.,-(hz-h)/e*.55));
        vec3 V=normalize(cameraPosition-vW), Rf=reflect(-V,n);
        float fres=.02+.98*pow(1.-max(dot(n,V),0.),5.);
        vec3 sky=mix(vec3(.075,.045,.07),vec3(.008,.012,.035),smoothstep(0.,.45,Rf.y));
        float md=max(dot(Rf,uMoon),0.);
        vec3 col=vec3(.003,.005,.01)+sky*fres*1.5+vec3(1.,.94,.84)*(pow(md,700.)*40.+pow(md,50.)*.35)*(.4+.6*fres);
        col+=auroraAt(uAur,Rf)*uAI*(.25+.75*fres);                            // the aurora shimmers on the water
        col=mix(col,vec3(col.r*1.6+.02,col.g*.3,col.b*.3),uRed);
        float d=length(cameraPosition-vW), fd=uFog*d; float f=1.-exp(-fd*fd*.5-uFog*d*1.6*exp(-.12*max(cameraPosition.y,0.)));
        gl_FragColor=vec4(mix(col,uFogC,clamp(f,0.,1.)),1.); }`,
  });
}
const LAKEFX = { lanterns: [], sky: [], festival: -1 };
function buildLake() {
  const { cx, cz, rx, rz } = LAKE;
  // water + reed-and-rock shoreline (rocks double as the collision ring; a gap is left for the pier)
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 128).rotateX(-PI / 2), lakeWaterMat()); water.scale.set(rx, 1, rz); water.position.set(cx, 0.06, cz); scene.add(water); LAKEFX.water = water;
  SB.add(new THREE.RingGeometry(0.97, 1.07, 128).rotateX(-PI / 2), M.stoneDark, cx, 0.07, cz, 0, { sx: rx, sz: rz, shadow: false });
  for (let i = 0; i < 90; i++) { const a = i / 90 * TAU, x = cx + Math.cos(a) * (rx + 1), z = cz + Math.sin(a) * (rz + 1);
    if (Math.abs(z + 38) < 2.6 && x < cx) continue;
    ROCKS.push({ x, z, s: R(0.35, 0.8) }); addCircle(x, z, 1.9); }
  const reed = merge(Array.from({ length: 7 }, (_, k) => new THREE.CylinderGeometry(0.008, 0.02, R(1, 1.8), 4).translate(0, 0.6, 0).rotateZ(R(-0.25, 0.25)).rotateX(R(-0.25, 0.25)).translate(R(-0.2, 0.2), 0, R(-0.2, 0.2))));
  const reeds = []; for (let i = 0; i < 140; i++) { const a = R(0, TAU), k = R(0.92, 1.02); reeds.push({ x: cx + Math.cos(a) * rx * k, z: cz + Math.sin(a) * rz * k }); }
  chunkedInstances(reed, new THREE.MeshStandardMaterial({ color: 0x3a3a1c, roughness: 1 }), reeds, (o, r) => { o.position.set(r.x, 0, r.z); o.rotation.y = r.x; });
  // pier with railings, lamps and a dock bell
  const PZ = -38, PX0 = 81, PX1 = 104;
  SB.add(roundBox(PX1 - PX0, 0.25, 3.2, 0.04, 2), M.wood, (PX0 + PX1) / 2, 0.42, PZ); PLATFORMS.push({ x0: PX0, x1: PX1, z0: PZ - 1.6, z1: PZ + 1.6, h: 0.55 });
  for (let x = PX0 + 1; x <= PX1; x += 2.2) for (const s of [-1, 1]) { SB.add(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 8), M.woodDark, x, 0, PZ + s * 1.55); SB.add(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), M.woodDark, x, 1.05, PZ + s * 1.55); }
  for (const s of [-1, 1]) { SB.add(roundBox(PX1 - PX0 - 2, 0.08, 0.1, 0.03, 1), M.woodDark, (PX0 + PX1) / 2 + 1, 1.5, PZ + s * 1.55); addBox(PX0 + 2, PX1, PZ + s * 1.55 - 0.1, PZ + s * 1.55 + 0.1); }
  addBox(PX1, PX1 + 0.3, PZ - 1.6, PZ + 1.6);
  for (const x of [88, 96, 103]) addLamp(x, PZ - 1.35, 4);
  // drifting lake lanterns + their reflection streaks
  const N = 380, lg = lathe(LANTERN_PROFILE, 10), lm = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lan = new THREE.InstancedMesh(lg, lm, N), refl = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 2.8).rotateX(-PI / 2).translate(0, 0, 1.2), new THREE.MeshBasicMaterial({ map: TX.pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), N);
  for (let i = 0; i < N; i++) { let x, z; do { x = cx + R(-rx, rx); z = cz + R(-rz, rz); } while (!inLake(x, z, -3) || (Math.abs(z - PZ) < 3 && x < PX1 + 2));
    const c = new THREE.Color(pick([0xffa040, 0xff8030, 0xffc070, 0xff6a30])).multiplyScalar(R(1.6, 2.6)); lan.setColorAt(i, c); refl.setColorAt(i, c.clone().multiplyScalar(0.35));
    LAKEFX.lanterns.push({ x, z, ph: R(0, TAU), vx: R(-0.15, 0.15), vz: R(-0.15, 0.15) }); }
  lan.frustumCulled = refl.frustumCulled = false; scene.add(lan, refl); FX_OBJECTS.push(refl);
  // sky lanterns for the festival (hidden until released)
  const SN = 640, sky = new THREE.InstancedMesh(lg, lm, SN); sky.frustumCulled = false; sky.count = 0; scene.add(sky);
  for (let i = 0; i < SN; i++) { sky.setColorAt(i, new THREE.Color(pick([0xffa040, 0xffc070, 0xff7a30])).multiplyScalar(R(2, 3.2))); LAKEFX.sky.push({ x: 0, y: -10, z: 0, v: R(1.2, 2.3), ph: R(0, TAU), t0: R(0, 28) }); }
  const o = new THREE.Object3D();
  onUpdate((dt, t) => {
    for (let i = 0; i < N; i++) { const L = LAKEFX.lanterns[i]; L.x += (L.vx + Math.sin(t * 0.1 + L.ph) * 0.05) * dt; L.z += (L.vz + Math.cos(t * 0.08 + L.ph) * 0.05) * dt;
      if (!inLake(L.x, L.z, -3)) { L.vx = (cx - L.x) * 0.006; L.vz = (cz - L.z) * 0.006; }
      const y = 0.12 + Math.sin(t * 1.3 + L.ph) * 0.03; o.position.set(L.x, y, L.z); o.rotation.set(Math.sin(t + L.ph) * 0.06, L.ph, 0); o.scale.setScalar(1.6); o.updateMatrix(); lan.setMatrixAt(i, o.matrix);
      o.position.set(L.x, 0.08, L.z); o.rotation.set(0, Math.atan2(camera.position.x - L.x, camera.position.z - L.z), 0); o.scale.set(1, 1, 1 + Math.sin(t * 2 + L.ph) * 0.15); o.updateMatrix(); refl.setMatrixAt(i, o.matrix); }
    lan.instanceMatrix.needsUpdate = refl.instanceMatrix.needsUpdate = true;
    if (LAKEFX.festival >= 0) { LAKEFX.festival += dt; let alive = 0;
      for (let i = 0; i < SN; i++) { const s = LAKEFX.sky[i]; if (LAKEFX.festival < s.t0) { o.position.set(0, -50, 0); o.scale.setScalar(0.001); }
        else { if (s.y < -5) { let x, z; do { x = cx + R(-rx, rx); z = cz + R(-rz, rz); } while (!inLake(x, z, -2)); s.x = x; s.z = z; s.y = 0.3; }
          s.y += s.v * dt; s.x += Math.sin(t * 0.4 + s.ph) * 0.4 * dt + 0.25 * dt; s.z += Math.cos(t * 0.3 + s.ph) * 0.4 * dt;
          o.position.set(s.x, s.y, s.z); o.rotation.set(Math.sin(t * 0.7 + s.ph) * 0.15, s.ph, 0); o.scale.setScalar(s.y > 150 ? 0.001 : 3.4); if (s.y < 150) alive++; }
        o.updateMatrix(); sky.setMatrixAt(i, o.matrix); }
      sky.count = SN; sky.instanceMatrix.needsUpdate = true;
      if (LAKEFX.festival > 32 && alive === 0) { LAKEFX.festival = -1; sky.count = 0; S.auroraBoost = 0; } }
    water.material.uniforms.uRed.value = S.witch;
  });
  buildLighthouse(); buildFerry(); buildGalleon(); buildFishing();
  addInteract({ x: 102.6, z: PZ, r: 2.6, label: () => LAKEFX.festival >= 0 ? 'The lanterns are rising…' : 'Release a lantern (Lantern Festival)', action: lanternFestival });
  addMarker(102.6, PZ - 1, 'MAKE A WISH', 0xffc070);
}
function lanternFestival() {
  if (LAKEFX.festival >= 0) return; LAKEFX.festival = 0; S.auroraBoost = 1; markDone('lanterns'); AU.choir(new V3(110, 4, -50), 9);
  toast('The Lantern Festival', 'Six hundred wishes rise over the Lake of Lost Souls.', 'soul');
  for (const sx of LAKEFX.sky) { sx.y = -10; }
}
/* ---------- Lighthouse on the island: turned tower, lantern room, two sweeping beams ---------- */
function buildLighthouse() {
  const X = 124, Z = -70;
  for (let i = 0; i < 16; i++) { const a = R(0, TAU), r = R(1, 6); ROCKS.push({ x: X + Math.cos(a) * r, z: Z + Math.sin(a) * r, s: R(0.8, 2.2) }); }
  SB.add(new THREE.CylinderGeometry(6.5, 7.5, 1.2, 24), M.stoneDark, X, 0.4, Z);
  const stripes = new THREE.MeshStandardMaterial({ map: stripeTex(['#1a1418', '#d8ccb4'], 6, true), roughness: 0.7 });
  SB.add(scaleUV(lathe([[0.001, 0], [2.6, 0], [2.6, 0.8], [2.3, 1.0], [1.7, 15], [2.1, 15.3], [2.1, 15.6], [0.001, 15.6]], 32), 1, 1), stripes, X, 1, Z);
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; SB.add(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), M.iron, X + Math.cos(a) * 2.05, 17.1, Z + Math.sin(a) * 2.05); }
  SB.add(new THREE.TorusGeometry(2.05, 0.04, 6, 36), M.iron, X, 17.6, Z, 0, { rx: PI / 2 });
  SB.add(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 16, 1, true), M.glass, X, 17.7, Z, 0, { shadow: false });
  SB.add(lathe([[1.5, 0], [1.5, 0.15], [1.2, 0.6], [0.4, 1.4], [0.15, 1.6], [0.08, 2.2], [0.001, 2.25]], 24), M.iron, X, 18.8, Z);
  pointLight('lighthouse', 0xffd8a0, 260, 70, X, 17.7, Z);
  const rot = new THREE.Group(); rot.position.set(X, 17.7, Z); scene.add(rot);
  const geo = new THREE.ConeGeometry(6, 140, 32, 1, true).translate(0, -70, 0).rotateX(PI).rotateZ(-PI / 2 + 0.05);
  for (const s of [0, PI]) { const m = new THREE.Mesh(geo, coneMat(0xffe0b0, 0.12, 10)); m.rotation.y = s; rot.add(m); FX_OBJECTS.push(m); }
  onUpdate((dt) => { rot.rotation.y += dt * 0.55; });
  addCircle(X, Z, 7);
}
/* ---------- Styx Ferry: the ferryman rows you around the lake ---------- */
const FERRY = { th: 0 };
function buildFerry() {
  const boat = new THREE.Group(); scene.add(boat);
  const hull = new THREE.Mesh(hullGeo(5.2, 1.9, 0.75, 0.5), new THREE.MeshStandardMaterial({ ...M.wood, map: M.wood.map, normalMap: M.wood.normalMap, roughnessMap: M.wood.roughnessMap, side: THREE.DoubleSide, color: 0x6a5a50 }));
  hull.position.y = 0.55; hull.castShadow = true; boat.add(hull);
  const b = new Batcher();
  for (const z of [-1.1, 0.4]) b.add(roundBox(1.6, 0.08, 0.4, 0.03, 1), M.woodDark, 0, 0.2, z);
  b.add(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), M.woodDark, 0.4, 1.4, 2.1, 0, { rz: -0.2 });
  b.add(new THREE.TorusGeometry(0.18, 0.02, 6, 16), M.iron, 0.75, 2.85, 2.1);
  b.build(boat);
  const lamp = new THREE.Mesh(lathe(LANTERN_PROFILE, 10), M.glass); lamp.position.set(0.75, 2.5, 2.1); boat.add(lamp);
  if (!SKEL) makeSkeleton(); const fm = SKEL.clone(); fm.position.set(0, 0.25, 1.8); fm.rotation.y = PI; boat.add(fm);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 12, 1, true), M.cloth); robe.position.set(0, 0.95, 1.8); boat.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, TAU, 0, PI * 0.6), M.cloth); hood.position.set(0, 1.78, 1.8); boat.add(hood);
  const seat = new THREE.Object3D(); seat.position.set(0, 0.28, -0.4); boat.add(seat);
  const pos = th => new V3(LAKE.cx + Math.cos(th) * (LAKE.rx - 9), 0, LAKE.cz + Math.sin(th) * (LAKE.rz - 12));
  const dockTh = Math.PI; // west-most point, right by the pier
  RIDES.ferry = { name: 'Styx Ferry', seat, eye: 0.95, exit: [99, -36.6], exitYaw: -PI / 2,
    hint: 'Space — ring the ferry bell  ·  look out over the lanterns  ·  E — leave', done: 'The ferryman nods. Your coin was accepted.',
    onBoard: () => { FERRY.th = dockTh; FERRY.lap = 0; }, progress: () => FERRY.lap / TAU,
    ctrl: () => { if (keys.Space && !FERRY.rung) { FERRY.rung = true; AU.bell(boat.position, 520, 2, 0.4); } if (!keys.Space) FERRY.rung = false; } };
  addInteract({ x: 101, z: -36.8, r: 2.6, label: 'Board the Styx Ferry', action: () => boardRide('ferry') });
  addMarker(100, -36, 'RIDE', 0x7dffb0);
  onUpdate((dt, t) => {
    const sp = S.ride === RIDES.ferry ? 0.1 : 0.07; FERRY.th += sp * dt; if (S.ride === RIDES.ferry) FERRY.lap += sp * dt;
    const p = pos(FERRY.th), n = pos(FERRY.th + 0.02); boat.position.set(p.x, Math.sin(t * 1.1) * 0.05, p.z); boat.lookAt(n.x, boat.position.y, n.z); boat.rotateZ(Math.sin(t * 0.9) * 0.025);
    fm.rotation.x = Math.sin(t * 1.2) * 0.12;
  });
}
/* ---------- Ghost Galleon: a pendulum pirate ship with tattered sails ---------- */
const GALLEON = { a: 0, amp: 0, t: 0 };
function buildGalleon() {
  const X = 102, Z = 6, PY = 12.5;
  for (const sz of [-3.6, 3.6]) for (const sx of [-6, 6]) cylBetween(new V3(X + sx, 0, Z + sz), new V3(X, PY + 0.4, Z + sz * 0.8), 0.32, M.rust);
  for (const sz of [-3.6, 3.6]) for (const sx of [-6, 6]) addCircle(X + sx, Z + sz, 0.6);
  SB.add(new THREE.CylinderGeometry(0.4, 0.4, 7.6, 16), M.iron, X, PY, Z, 0, { rx: PI / 2 });
  SB.add(roundBox(14, 0.4, 7, 0.08, 2), M.wood, X, 0.2, Z); addBox(X - 7, X + 7, Z - 3.5, Z + 3.5);
  const piv = new THREE.Group(); piv.position.set(X, PY, Z); scene.add(piv);
  const ship = new THREE.Group(); ship.position.y = -9.6; piv.add(ship);
  const hull = new THREE.Mesh(hullGeo(11, 3.8, 2.2, 1.6, 36, 16), new THREE.MeshStandardMaterial({ map: M.wood.map, normalMap: M.wood.normalMap, color: 0x4a3830, roughness: 0.8, side: THREE.DoubleSide }));
  hull.rotation.y = PI / 2; hull.castShadow = true; ship.add(hull);
  const sb = new Batcher();
  sb.add(roundBox(10, 0.12, 3.2, 0.04, 2), M.woodDark, 0, -0.5, 0);
  for (let i = -4; i <= 4; i++) sb.add(roundBox(0.5, 0.1, 3.0, 0.03, 1), M.velvet, i, -0.3, 0);
  for (const s of [-1, 1]) sb.add(roundBox(10.6, 0.14, 0.14, 0.05, 1), M.brass, 0, 0.35, s * 1.75);
  sb.add(new THREE.CylinderGeometry(0.16, 0.22, 9, 10), M.woodDark, 0, 4.2, 0);
  sb.add(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 8), M.woodDark, 0, 6.8, 0, 0, { rx: PI / 2 });
  sb.add(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), M.woodDark, 0, 3.4, 0, 0, { rx: PI / 2 });
  sb.add(new THREE.SphereGeometry(0.55, 16, 12), M.bone, 5.9, 1.2, 0, 0, { sy: 1.15 });
  sb.build(ship);
  const [sc, sx] = cnv(256); sx.fillStyle = '#d8ccb0'; sx.fillRect(0, 0, 256, 256); sx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 14; i++) { sx.beginPath(); sx.arc(R(0, 256), R(0, 256), R(6, 26), 0, TAU); sx.fill(); } sx.beginPath(); sx.moveTo(0, 256); for (let i = 0; i <= 12; i++) sx.lineTo(i * 21.3, 256 - R(0, 40)); sx.lineTo(256, 256); sx.fill();
  const sail = new THREE.MeshStandardMaterial({ map: toTex(sc, { repeat: false }), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: 0x8a8070 });
  for (const [y, w, h] of [[5.3, 4.2, 2.8], [2.6, 3.2, 1.8]]) { const sm = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 8, 4), sail); sm.rotation.y = PI / 2; sm.position.y = y; ship.add(sm); }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({ map: signTex('☠', { w: 128, h: 80, size: 70, color: '#ffffff', glow: '#000', bg: '#0a0a0a' }), side: THREE.DoubleSide })); flag.position.set(0.6, 8.9, 0); ship.add(flag);
  const lp = []; for (let i = 0; i <= 26; i++) { const x = -5.3 + i * 10.6 / 26; for (const s of [-1, 1]) lp.push(new V3(x, 0.5, s * 1.8)); }
  makeBulbs(ship, lp, [hdr(0x50ff90, 3), hdr(0xff7a20, 3)], 0.07);
  makeSign('GHOST GALLEON', 7, 1.75, X - 7.2, 5, Z, -PI / 2, { size: 120, color: '#7dffb0', glow: '#20ff80', sub: 'the sea took her. the sky wants her back' });
  const seat = new THREE.Object3D(); seat.position.set(4.2, -0.2, 0.6); seat.rotation.y = PI / 2; ship.add(seat);
  RIDES.galleon = { name: 'Ghost Galleon', seat, eye: 0.85, exit: [X - 8.5, Z + 4], exitYaw: yawTo(X - 8.5, Z + 4, X, Z),
    hint: 'Hold Space at the bottom of each swing to pump higher!  ·  E — abandon ship', done: 'You survived the Ghost Galleon. Mostly.',
    onBoard: () => { GALLEON.t = 0; }, progress: () => GALLEON.t / 44, fov: () => Math.abs(GALLEON.w || 0) * 7, shake: () => Math.abs(GALLEON.a) > 1 ? 0.02 : 0 };
  addInteract({ x: X - 7.6, z: Z + 2.5, r: 3, label: 'Board the Ghost Galleon', action: () => boardRide('galleon') });
  addMarker(X - 7.6, Z + 2.5, 'RIDE', 0x7dffb0); addPool(X, Z, 12, 0x50ff90, 0.3);
  onUpdate((dt, t) => {
    const riding = S.ride === RIDES.galleon; GALLEON.t += dt;
    const cyc = riding ? GALLEON.t : (t % 46); const target = cyc < 30 ? Math.min(1.15, cyc / 12) : Math.max(0, 1.15 - (cyc - 30) / 10);
    GALLEON.amp = damp(GALLEON.amp, target + (riding && keys.Space && Math.abs(GALLEON.a) < 0.3 ? 0.35 : 0), 0.6, dt);
    const prev = GALLEON.a; GALLEON.a = GALLEON.amp * Math.sin(t * 1.02); GALLEON.w = (GALLEON.a - prev) / Math.max(dt, 1e-3);
    piv.rotation.z = GALLEON.a; sail.color.setScalar(0.5 + Math.abs(GALLEON.a) * 0.2);
    if (riding && Math.abs(GALLEON.a) > 0.95 && Math.abs(GALLEON.w) < 0.3 && !GALLEON.yelled) { GALLEON.yelled = true; AU.whoosh(ship.getWorldPosition(new V3())); } if (Math.abs(GALLEON.a) < 0.4) GALLEON.yelled = false;
  });
}
/* ---------- Bob for Souls: cast, wait for the bite, strike, then keep the line tension in the green ---------- */
const FISH = {}, GAME_FISH = { name: 'fishing' };
const CATCHES = [['Glimmer Carp', 10, 0.5], ['Bone Eel', 25, 0.28], ['Lantern Angler', 50, 0.15], ['The Drowned Crown', 150, 0.07]];
function buildFishing() {
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: hdr(0xff4040, 2) })); bob.visible = false; scene.add(bob); FISH.bob = bob;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0xc0c0c0, transparent: true, opacity: 0.6 })); line.visible = false; line.frustumCulled = false; scene.add(line); FISH.line = line;
  const rod = new THREE.Group(); const rm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 1.6, 6).translate(0, 0.8, 0), M.woodDark); rod.add(rm);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), M.brass); reel.rotation.z = PI / 2; reel.position.y = 0.25; rod.add(reel);
  rod.position.set(0.32, -0.45, -0.5); rod.rotation.set(-0.9, 0, -0.2); rod.visible = false; camera.add(rod); FISH.rod = rod;
  FISH.cam = new V3(96, 2.2, -39.1);
  SB.add(roundBox(0.6, 0.45, 0.4, 0.05, 1), M.woodDark, 96.5, 0.78, -37); for (let i = 0; i < 3; i++) addBarrel(93.5 + i * 0.7, -36.9, 0.55);
  GAME_FISH.exit = [96, -37, 0];
  addInteract({ x: 96, z: -37.6, r: 2.4, label: () => t('Bob for Souls (fishing) · best {n}', { n: SCORES.fishing || 0 }), action: startFishing });
  addMarker(95, -36.6, 'PLAY', 0x7dffb0);
}
function startFishing() {
  fade(() => { S.mode = 'game'; S.game = GAME_FISH; Object.assign(GAME_FISH, { score: 0, time: 75, phase: 'idle', tension: 0.5, prog: 0, wait: 0, fish: null, caught: 0 });
    player.yaw = 0; player.pitch = -0.32; FISH.rod.visible = true; $('#gamepanel').classList.remove('hidden'); toast('Bob for Souls', 'Click to cast. When the float dips — click! Then hold to reel, keeping the needle in the light.'); });
}
GAME_FISH.update = (dt) => {
  const G = GAME_FISH; if (!S.menu) G.time -= dt; player.yaw = clamp(player.yaw, -0.5, 0.5); player.pitch = clamp(player.pitch, -0.7, 0.1);
  camera.position.copy(FISH.cam); camera.rotation.set(player.pitch, player.yaw, 0);
  const tip = FISH.rod.localToWorld(new V3(0, 1.6, 0)), b = FISH.bob, tt = U_TIME.value;
  if (G.phase === 'cast') { G.ct += dt; const k = Math.min(1, G.ct / 0.8); b.position.lerpVectors(tip, G.target, k); b.position.y += Math.sin(k * PI) * 2; if (k >= 1) { G.phase = 'wait'; G.wait = R(1.5, 5); AU.splat(G.target); } }
  if (G.phase === 'wait') { G.wait -= dt; b.position.y = 0.12 + Math.sin(tt * 2.4) * 0.02; if (G.wait <= 0) { G.phase = 'bite'; G.bt = 0.75; AU.tone({ f: 300, f2: 120, dur: 0.15, vol: 0.2 }); } }
  if (G.phase === 'bite') { G.bt -= dt; b.position.y = 0.12 - 0.12 * Math.abs(Math.sin(tt * 30)); if (G.bt <= 0) { G.phase = 'idle'; toast('It got away…', 'Strike faster when the float dips.'); b.visible = false; } }
  if (G.phase === 'reel') { const pull = Math.sin(tt * (1.3 + G.fish[1] / 60)) * (0.35 + G.fish[1] / 300) + (Math.random() - 0.5) * 0.3;
    G.tension = clamp(G.tension + ((G.reeling ? 0.9 : -0.7) + pull) * dt, 0, 1); $('#meter .needle').style.left = (G.tension * 100) + '%';
    if (G.tension > 0.32 && G.tension < 0.68) { G.prog += dt / (2.2 + G.fish[1] / 60); if (Math.random() < dt * 8) AU.tone({ f: 1800, dur: 0.02, vol: 0.03 }); } else G.prog = Math.max(0, G.prog - dt * 0.15);
    if (G.tension >= 0.99 || G.tension <= 0.01) { G.phase = 'idle'; $('#meter').classList.add('hidden'); b.visible = false; toast(G.tension > 0.5 ? 'Snap! The line broke.' : 'It slipped the hook.', 'Keep the needle inside the light.'); }
    b.position.lerp(new V3(FISH.cam.x, 0.12, FISH.cam.z - 1.5), dt * 0.25 * G.prog);
    if (G.prog >= 1) { G.phase = 'idle'; $('#meter').classList.add('hidden'); b.visible = false; G.score += G.fish[1]; G.caught++; AU.chime(); FW.burst(b.position, 50, new THREE.Color(0.6, 2.4, 2), 3, 'soul');
      floater(b.position.clone().setY(1), '+' + G.fish[1]); toast(t('Caught: {f}', { f: t(G.fish[0]) }), t('+{n} points', { n: G.fish[1] }), 'soul'); } }
  if (b.visible) FISH.line.geometry.setFromPoints([tip, b.position]); FISH.line.visible = b.visible;
  $('#gamepanel').innerHTML = `<div>${t('Score')}<b>${G.score}</b></div><div>${t('Time')}<b>${Math.max(0, G.time).toFixed(0)}</b></div><div>${t('Catches')}<b>${G.caught}</b></div><div>${t('Best')}<b>${SCORES.fishing || 0}</b></div>`;
  if (G.time <= 0 && G.phase !== 'reel' && !G.ended) { G.ended = true; endGame(t('Bob for Souls · {n}', { n: G.score }), t('{n} souls hooked', { n: G.caught }), () => { if (G.score > (SCORES.fishing || 0)) { SCORES.fishing = G.score; saveScores(); } }); }
};
GAME_FISH.click = () => { const G = GAME_FISH, b = FISH.bob;
  if (G.phase === 'idle') { G.phase = 'cast'; G.ct = 0; b.visible = true; const d = new V3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); G.target = FISH.cam.clone().addScaledVector(d, R(6, 11)).setY(0.12); if (inLake(G.target.x, G.target.z, -1) === false) G.target.set(97, 0.12, -45); AU.throwIt(); }
  else if (G.phase === 'bite') { const r = rand(); let acc = 0; G.fish = CATCHES[CATCHES.length - 1]; for (const c of CATCHES) { acc += c[2]; if (r < acc) { G.fish = c; break; } }
    G.phase = 'reel'; G.tension = 0.5; G.prog = 0; G.reeling = true; $('#meter').classList.remove('hidden'); $('#meter .mlabel').textContent = t('Hold to reel · keep the needle in the light'); AU.splat(b.position); }
  else if (G.phase === 'reel') G.reeling = true; };
GAME_FISH.release = () => { GAME_FISH.reeling = false; };
GAME_FISH.cleanup = () => { FISH.rod.visible = false; FISH.bob.visible = false; FISH.line.visible = false; $('#meter').classList.add('hidden'); };

export { LAKE, inLake, hullGeo, LANTERN_PROFILE, lakeWaterMat, LAKEFX, buildLake, lanternFestival, buildLighthouse, FERRY, buildFerry, GALLEON, buildGalleon, FISH, GAME_FISH, CATCHES, buildFishing, startFishing };
