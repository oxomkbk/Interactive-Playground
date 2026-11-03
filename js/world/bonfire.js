import * as THREE from 'three';
import { PI, R, TAU, V3, damp, rand } from '../core/utils.js';
import { FX_OBJECTS, camera, pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { flameMat, makePoints, waterMat } from '../core/shaders.js';
import { ROCKS, SB, addCircle, addInteract, addPool, addPumpkin, cylBetween, onUpdate, scaleUV } from '../core/registry.js';
import { makeScarecrow } from './gate-street.js';
import { fireWish, stirCauldron } from '../game/play.js';
import { t } from '../core/i18n.js';

/* ---------- Ember Circle (bonfire + cauldron) ---------- */
const FIRE = {};
function buildBonfire() {
  const X = -40, Z = 32;
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; ROCKS.push({ x: X + Math.cos(a) * 1.9, z: Z + Math.sin(a) * 1.9, s: R(0.28, 0.42) }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; cylBetween(new V3(X + Math.cos(a) * 1.3, 0, Z + Math.sin(a) * 1.3), new V3(X + Math.cos(a) * 0.2, 2.1, Z + Math.sin(a) * 0.2), 0.14, M.bark); }
  addCircle(X, Z, 2.3);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; SB.add(scaleUV(new THREE.CylinderGeometry(0.34, 0.36, 3, 10), 1, 1.5), M.bark, X + Math.cos(a) * 5.4, 0.32, Z + Math.sin(a) * 5.4, -a, { rx: PI / 2, order: 'YXZ' });
    addCircle(X + Math.cos(a) * 5.4, Z + Math.sin(a) * 5.4, 0.8); }
  const flames = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.4), flameMat(0xffd070, 0xff3a00, i * 3.1)); m.position.set(X, 2.0, Z); m.rotation.y = i * PI / 3; scene.add(m); FX_OBJECTS.push(m); flames.push(m); }
  const core = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.2), flameMat(0xfff0b0, 0xff5a10, 7.7)); core.position.set(X, 2.4, Z); scene.add(core); FX_OBJECTS.push(core); flames.push(core);
  const L = pointLight('fire', 0xff7a2a, 150, 40, X, 1.8, Z);
  addPool(X, Z, 9, 0xff6a20, 0.9);
  const emb = makePoints(260); const ev = new Float32Array(260 * 4);
  for (let i = 0; i < 260; i++) ev[i * 4 + 3] = R(0, 3);
  // cauldron
  const CX = -33.5, CZ = 37.5;
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.7, 0.1], [0.95, 0.5], [0.95, 0.9], [0.8, 1.1], [0.85, 1.15]].map(([a, b]) => new THREE.Vector2(a, b)), 24), new THREE.MeshStandardMaterial({ color: 0x111014, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  pot.position.set(CX, 0.25, CZ); pot.castShadow = true; scene.add(pot);
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24).rotateX(-PI / 2), waterMat(new THREE.Color().setRGB(0.4, 2.6, 0.5), CX, CZ)); brew.position.set(CX, 1.25, CZ); scene.add(brew);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; cylBetween(new V3(CX + Math.cos(a) * 1.3, 0, CZ + Math.sin(a) * 1.3), new V3(CX, 2.6, CZ), 0.05, M.iron); }
  addCircle(CX, CZ, 1.2); addPool(CX, CZ, 2.6, 0x40ff60, 0.35);
  for (let i = 0; i < 30; i++) addPumpkin(X + R(-12, 12), 0, Z + R(-10, 12), R(0.25, 0.6), rand() > 0.5);
  makeScarecrow(-47, 25, 1.2);
  Object.assign(FIRE, { flames, L, boost: 1, hue: null, brew });
  addInteract({ x: X + 2.8, z: Z + 1.5, r: 3.2, label: 'Toss a cursed wish into the fire', action: fireWish });
  addInteract({ x: CX, z: CZ, r: 2.6, label: 'Stir the witch’s cauldron', action: stirCauldron });
  onUpdate((dt, t) => {
    FIRE.boost = damp(FIRE.boost, 1, 0.8, dt);
    const fl = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1) + 0.1 * Math.sin(t * 31);
    L.intensity = L.userData.base * fl * Math.min(FIRE.boost, 1.5);
    if (FIRE.hue && FIRE.boost < 1.05) { FIRE.hue = null; flames.forEach(f => { f.material.uniforms.uA.value.set(0xffd070); f.material.uniforms.uB.value.set(0xff3a00); }); L.color.set(0xff7a2a); }
    flames.forEach((f, i) => { f.material.uniforms.uBoost.value = FIRE.boost; if (i === 3) { f.quaternion.copy(camera.quaternion); } f.scale.y = 1 + (FIRE.boost - 1) * 0.35; });
    const col = FIRE.hue ? FIRE.hue : new THREE.Color(1, 0.45, 0.1);
    for (let i = 0; i < 260; i++) { let life = ev[i * 4 + 3] - dt * (0.8 + FIRE.boost * 0.3);
      if (life <= 0) { life = R(1.5, 3.5); emb.pos[i * 3] = X + R(-0.8, 0.8); emb.pos[i * 3 + 1] = R(0.5, 1.5); emb.pos[i * 3 + 2] = Z + R(-0.8, 0.8); ev[i * 4] = R(-0.4, 0.4); ev[i * 4 + 1] = R(1.5, 3.5) * FIRE.boost; ev[i * 4 + 2] = R(-0.4, 0.4); }
      ev[i * 4 + 3] = life; const k = i * 3;
      emb.pos[k] += (ev[i * 4] + Math.sin(t * 2 + i) * 0.6) * dt; emb.pos[k + 1] += ev[i * 4 + 1] * dt; emb.pos[k + 2] += (ev[i * 4 + 2] + Math.cos(t * 1.7 + i) * 0.6) * dt;
      const b = Math.min(1, life) * (Math.sin(t * 20 + i) > 0 ? 6 : 3.5); emb.col[k] = col.r * b; emb.col[k + 1] = col.g * b; emb.col[k + 2] = col.b * b; emb.size[i] = 0.08; }
    emb.flag();
  });
}

export { FIRE, buildBonfire };
