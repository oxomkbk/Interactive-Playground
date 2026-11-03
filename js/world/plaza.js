import * as THREE from 'three';
import { PI, R, TAU, V3, hdr, rand } from '../core/utils.js';
import { clockTex } from '../core/textures.js';
import { FX_OBJECTS, pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { coneMat, waterMat } from '../core/shaders.js';
import { PAL_SPOOK, PAL_WARM, SB, addBox, addCircle, addInteract, addLamp, addPool, addPumpkin, boxGeo, makeBulbs, onUpdate, scaleUV, stringLights } from '../core/registry.js';
import { bigPumpkin } from './landscape.js';
import { COL_PROFILE, addBench, lathe, roundBox } from './props.js';
import { markDone } from './attractions.js';
import { fireworksShow } from './atmosphere.js';
import { play } from '../game/pyro.js';
import { AU } from '../core/audio.js';
import { S, startWitchingHour } from '../game/play.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/ui.js';

/* ---------- Plaza & Clock of Souls ---------- */
const TOWER = {};
function buildPlaza() {
  SB.add(new THREE.CylinderGeometry(9.6, 9.9, 0.5, 48), M.stone, 0, 0.25, 0);
  SB.add(new THREE.TorusGeometry(9.2, 0.4, 8, 64), M.stone, 0, 0.55, 0, 0, { rx: PI / 2 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(9.0, 64).rotateX(-PI / 2), waterMat(new THREE.Color().setRGB(0.18, 1.0, 0.5), 0, 0)); water.position.y = 0.45; scene.add(water);
  TOWER.water = water;
  addCircle(0, 0, 10);
  SB.add(new THREE.CylinderGeometry(4.2, 4.6, 2.6, 8), M.stone, 0, 1.3, 0, PI / 8);
  SB.add(scaleUV(new THREE.CylinderGeometry(2.7, 3.1, 14, 8), 4, 5), M.stone, 0, 9.6, 0, PI / 8);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; SB.add(new THREE.CylinderGeometry(0.26, 0.3, 14, 6), M.stoneDark, Math.cos(a) * 3.05, 9.6, Math.sin(a) * 3.05); }
  SB.add(boxGeo(5.2, 5, 5.2, 2.5), M.stone, 0, 19.1, 0);
  SB.add(boxGeo(5.8, 0.5, 5.8, 2), M.stoneDark, 0, 16.7, 0);
  SB.add(boxGeo(5.8, 0.4, 5.8, 2), M.stoneDark, 0, 21.7, 0);
  // clock faces + animated hands
  const cmat = new THREE.MeshBasicMaterial({ map: clockTex(), color: hdr(0xffffff, 1.7) });
  TOWER.hands = [];
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2, g = new THREE.Group(); g.position.set(Math.sin(a) * 2.63, 19.1, Math.cos(a) * 2.63); g.rotation.y = a; scene.add(g);
    g.add(new THREE.Mesh(new THREE.CircleGeometry(1.95, 40), cmat));
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.04).translate(0, 0.5, 0.05), M.black);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.04).translate(0, 0.75, 0.08), M.black);
    g.add(hh, mh); TOWER.hands.push([hh, mh]);
  }
  // belfry with the Bell of Souls
  for (const [dx, dz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) { SB.add(lathe(COL_PROFILE, 16), M.stone, dx, 21.9, dz); SB.add(roundBox(0.55, 0.5, 0.55, 0.05, 1), M.stoneDark, dx * 1.18, 27.15, dz * 1.18); SB.add(new THREE.ConeGeometry(0.26, 1.6, 8), M.roof, dx * 1.18, 28.2, dz * 1.18); SB.add(new THREE.SphereGeometry(0.08, 10, 8), M.brass, dx * 1.18, 29.05, dz * 1.18); }
  SB.add(new THREE.CylinderGeometry(3.45, 3.65, 0.5, 8), M.stoneDark, 0, 2.75, 0, PI / 8);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; for (const y of [8.5, 12.5]) SB.add(new THREE.PlaneGeometry(0.34, 1.5), M.glass, Math.sin(a) * 2.95, y, Math.cos(a) * 2.95, a, { shadow: false }); }
  SB.add(boxGeo(6, 0.6, 6, 2), M.stoneDark, 0, 26.6, 0);
  const bellPts = [[0, 0], [1.25, 0.05], [1.1, 0.3], [0.85, 0.9], [0.75, 1.7], [0.55, 2.1], [0.0, 2.2]].map(([a, b]) => new THREE.Vector2(a, b));
  TOWER.bell = new THREE.Group(); TOWER.bell.position.set(0, 26.2, 0); scene.add(TOWER.bell);
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 32), M.brass); bell.position.y = -2.3; bell.castShadow = true; TOWER.bell.add(bell);
  SB.add(scaleUV(new THREE.ConeGeometry(3.9, 11, 8), 4, 4), M.roof, 0, 32.4, 0, PI / 8);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; SB.add(new THREE.ConeGeometry(0.6, 3, 6), M.roof, Math.sin(a + PI / 4) * 3.4, 28.3, Math.cos(a + PI / 4) * 3.4); }
  TOWER.pumpkin = bigPumpkin(scene, 0, 39.6, 0, 2.4, 0);
  pointLight('tower', 0xff7a20, 480, 0, 0, 46, 1.5);
  // belfry bulbs + uplight beams
  const bp = []; for (let i = 0; i < 4; i++) for (let k = 0; k <= 12; k++) { const a = i * PI / 2; const t = k / 12 * 6 - 3;
    bp.push(new V3(Math.cos(a) * 3.02 - Math.sin(a) * t, 26.95, Math.sin(a) * 3.02 + Math.cos(a) * t)); }
  for (let k = 0; k < 40; k++) { const t = k / 40; const a = t * TAU * 3; bp.push(new V3(Math.cos(a) * 3.25, 2.8 + t * 13.5, Math.sin(a) * 3.25)); }
  TOWER.bulbs = makeBulbs(scene, bp, PAL_SPOOK, 0.09);
  const upGeo = new THREE.ConeGeometry(2.2, 18, 24, 1, true).translate(0, -9, 0).rotateX(PI);
  const upMat = coneMat(0x9a60ff, 0.11);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, m = new THREE.Mesh(upGeo, upMat);
    m.position.set(Math.cos(a) * 4.8, 2.6, Math.sin(a) * 4.8); m.lookAt(Math.cos(a) * 2.2, 22, Math.sin(a) * 2.2); m.rotateX(PI / 2); scene.add(m); FX_OBJECTS.push(m); }
  // plaza ring lamps + maypole strings from the belfry
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8, x = Math.cos(a) * 21, z = Math.sin(a) * 21; addLamp(x, z, 4.4);
    makeBulbs(scene, stringLights(new V3(Math.cos(a) * 3.1, 26.4, Math.sin(a) * 3.1), new V3(x, 4.5, z), 2.2, null, 0.9), i % 2 ? PAL_SPOOK : PAL_WARM, 0.085);
    { const b = a + 0.2; addBench(Math.cos(b) * 17, Math.sin(b) * 17, Math.atan2(-Math.cos(b), -Math.sin(b))); }
    for (let k = 0; k < 4; k++) addPumpkin(Math.cos(a - 0.15) * 22.5 + R(-1, 1), 0, Math.sin(a - 0.15) * 22.5 + R(-1, 1), R(0.25, 0.5), rand() > 0.3);
  }
  pointLight('plazaA', 0xffa860, 45, 30, -14, 5, 12);
  addPool(0, 0, 14, 0x40ff90, 0.25);
  // fireworks lever cart
  SB.add(boxGeo(1.6, 1, 1, 1), M.rust, -12, 0.5, 19); SB.add(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 10), M.purple, -12.4, 1.6, 19, 0, { rx: 0.3 });
  SB.add(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 10), M.orange, -11.6, 1.6, 19, 0, { rx: -0.3 });
  TOWER.lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08).translate(0, 0.45, 0), M.brass); TOWER.lever.position.set(-11.2, 1, 19.5); scene.add(TOWER.lever);
  addBox(-12.8, -11.2, 18.5, 19.5);
  addInteract({ x: -12, z: 20.2, label: 'Light the fireworks', action: () => { TOWER.lever.rotation.x = -0.9; AU.lever(); toast('Fireworks over Hollowmoor', 'Look up.'); play('crescendo', { site: 'plaza' }); setTimeout(() => play('pumpkins', { site: 'plaza' }), 7000); markDone('fireworks'); setTimeout(() => TOWER.lever.rotation.x = 0, 2000); } });
  addInteract({ x: 0, z: 10.6, r: 3, label: () => S.witchT >= 0 ? 'The bell is still tolling…' : 'Ring the Bell of Souls', action: () => startWitchingHour(false), enabled: () => true });
  onUpdate((dt, t) => {
    const d = new Date(), hrs = d.getHours() % 12 + d.getMinutes() / 60, mins = d.getMinutes() + d.getSeconds() / 60;
    for (const [hh, mh] of TOWER.hands) { hh.rotation.z = -hrs / 12 * TAU; mh.rotation.z = -mins / 60 * TAU; }
    TOWER.pumpkin.rotation.y = Math.sin(t * 0.3) * 0.4;
    TOWER.bell.rotation.z = Math.sin(t * 2.4) * (TOWER.swing || 0); TOWER.swing = Math.max(0, (TOWER.swing || 0) - dt * 0.05);
  });
}

export { TOWER, buildPlaza };
