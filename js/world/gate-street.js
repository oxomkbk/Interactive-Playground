import * as THREE from 'three';
import { bev } from '../core/surface.js';
import { PI, R, V3, hdr, pick, rand } from '../core/utils.js';
import { signTex, stripeTex } from '../core/textures.js';
import { pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { Batcher, PAL_SPOOK, PAL_WARM, SB, addBox, addCircle, addLamp, addPool, addPumpkin, boxGeo, makeBulbs, stringLights, wallBox } from '../core/registry.js';
import { bigPumpkin } from './landscape.js';
import { POST_PROFILE, addBarrel, addBench, addCrate, lathe, roundBox } from './props.js';
import { buildFortune, buildShootingGallery, buildStriker } from './midway.js';
import { CANDY } from './dressing.js';
import { collide } from '../game/play.js';

// ---------- Entrance gate ----------
function buildEntrance() {
  for (const sx of [-1, 1]) {
    const x = sx * 9;
    wallBox(x - 2, x + 2, 0, 12.5, 76, 80, M.stone);
    SB.add(roundBox(4.6, 0.9, 4.6, 0.08, 2), M.stoneDark, x, 0.45, 78); SB.add(roundBox(4.3, 0.22, 4.3, 0.05, 2), M.stoneDark, x, 6.5, 78); SB.add(roundBox(4.5, 0.32, 4.5, 0.06, 2), M.stoneDark, x, 12.45, 78);
    for (let i = 0; i < 4; i++) for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) if (i === 0) SB.add(roundBox(0.8, 1, 0.8, 0.07, 1), M.stone, x + dx, 13, 78 + dz);
    SB.add(new THREE.ConeGeometry(2.6, 6, 4), M.roof, x, 16.5, 78, PI / 4);
    for (const [zf, r] of [[80.03, 0], [75.97, PI]]) { SB.add(new THREE.PlaneGeometry(0.8, 1.5), M.window, x, 9, zf, r, { shadow: false });
      const o = r ? -1 : 1; SB.add(roundBox(1.1, 0.14, 0.18, 0.04, 1), M.stoneDark, x, 8.18, zf + o * 0.05); SB.add(roundBox(1.0, 0.12, 0.14, 0.04, 1), M.stoneDark, x, 9.82, zf + o * 0.04);
      for (const sx2 of [-0.48, 0.48]) SB.add(roundBox(0.12, 1.7, 0.14, 0.03, 1), M.stoneDark, x + sx2, 9, zf + o * 0.04); }
    const bp = []; for (let i = 0; i < 18; i++) bp.push(new V3(x - sx * 2.05, 0.6 + i * 0.66, 80.05));
    makeBulbs(scene, bp, PAL_WARM, 0.08);
    // ticket booth
    const bx = sx * 5.2;
    wallBox(bx - 1.1, bx + 1.1, 0, 2.6, 83, 85, M.wood);
    SB.add(new THREE.ConeGeometry(1.9, 1.6, 4), M.roof, bx, 3.4, 84, PI / 4);
    SB.add(new THREE.PlaneGeometry(1.2, 0.8), M.window, bx, 1.6, 85.02, 0, { shadow: false }); SB.add(roundBox(1.5, 0.1, 0.4, 0.03, 1), M.woodDark, bx, 1.15, 85.15);
    addPool(bx, 86, 2.5, 0xffa040, 0.6);
    bigPumpkin(scene, x, 13.9, 78, 1.25, 0);
  }
  // arch beam & decorative half-ring
  SB.add(boxGeo(14, 1.2, 1.4, 2), M.stone, 0, 11.4, 78);
  const arch = new THREE.TorusGeometry(7, 0.32, 8, 48, PI); SB.add(arch, M.iron, 0, 4.2, 78);
  const ap = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * PI; ap.push(new V3(Math.cos(a) * 7, 4.2 + Math.sin(a) * 7, 78.35)); }
  for (let i = 0; i <= 24; i++) ap.push(new V3(-6.8 + i * 13.6 / 24, 10.7, 78.75));
  makeBulbs(scene, ap, PAL_SPOOK, 0.085);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.75), new THREE.MeshBasicMaterial({ map: signTex('HOLLOWMOOR', { sub: '~ NIGHT CARNIVAL ~' }), transparent: true, color: hdr(0xffffff, 1.6), depthWrite: false }));
  sign.position.set(0, 13.9, 78.8); scene.add(sign);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), new THREE.MeshBasicMaterial({ map: signTex('COME BACK SOON', { size: 110, color: '#b78cff', glow: '#7a30ff', sub: '…if you can' }), transparent: true, color: hdr(0xffffff, 1.4), depthWrite: false }));
  back.position.set(0, 13.6, 77.2); back.rotation.y = PI; scene.add(back);
  pointLight('gate', 0xff8a3a, 60, 34, 0, 8, 81);
  addPool(0, 80, 9, 0xff8a3a, 0.5);
  for (let i = 0; i < 4; i++) { addLamp(-6.5, 84 + i * 6); addLamp(6.5, 84 + i * 6); }
  for (let i = 0; i < 16; i++) addPumpkin(R(-12, 12) + (i % 2 ? 7 : -7) * 0, 0, R(80, 100), R(0.3, 0.6), rand() > 0.3);
  makeScarecrow(-14, 88, 0.4); makeScarecrow(15, 92, -0.5);
}
function makeScarecrow(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const b = new Batcher();
  b.add(new THREE.CylinderGeometry(0.07, 0.08, 3.2, 6), M.wood, 0, 1.6, 0);
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), M.wood, 0, 2.3, 0, 0, { rz: PI / 2 });
  b.add(new THREE.CylinderGeometry(0.38, 0.3, 1.0, 8), M.cloth, 0, 2.0, 0);
  b.add(new THREE.SphereGeometry(0.32, 12, 10), M.straw, 0, 2.85, 0);
  b.add(new THREE.ConeGeometry(0.45, 0.7, 10), M.black, 0, 3.35, 0);
  b.add(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 14), M.black, 0, 3.05, 0);
  b.build(g);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.glowOrange); eye.position.set(-0.1, 2.9, 0.28); g.add(eye);
  const eye2 = eye.clone(); eye2.position.x = 0.1; g.add(eye2);
  addCircle(x, z, 0.4);
}

// ---------- Lantern Row (main street): stalls, string lights, games ----------
function buildStall({ x0, z, face, w = 6, d = 4, name, c1, c2, goods }) {
  const back = x0 - face * d, cx = x0 - face * d / 2;
  const signColor = { CANDY: '#ff9a3a', POTIONS: '#7dffb0', MASKS: '#c79bff' };
  SB.add(boxGeo(d, 0.25, w, 2), M.wood, cx, 0.12, z);
  wallBox(Math.min(back, back - face * 0.2), Math.max(back, back - face * 0.2), 0, 3.3, z - w / 2, z + w / 2, M.wood, { collide: false });
  for (const sz of [-1, 1]) wallBox(Math.min(x0, back), Math.max(x0, back), 0, 3.3, z + sz * w / 2 - 0.1, z + sz * w / 2 + 0.1, M.wood, { collide: false });
  SB.add(roundBox(0.7, 1.1, w - 0.2, 0.04, 1.5), M.woodDark, x0 - face * 0.35, 0.55, z);
  SB.add(boxGeo(0.06, 0.8, w - 0.4, 6), new THREE.MeshStandardMaterial({ map: stripeTex([c1, c2], 10), roughness: 0.7 }), x0 + face * 0.02, 0.6, z);
  SB.add(roundBox(d + 0.6, 0.2, w + 0.4, 0.06, 2), M.roof, cx, 3.4, z);
  const aw = new THREE.MeshStandardMaterial({ map: stripeTex([c1, c2, c1, '#120a10'], 8, true), roughness: 0.8, side: THREE.DoubleSide });
  SB.add(bev(1.8, 0.05, w + 0.4), aw, x0 + face * 0.75, 3.05, z, 0, { rz: -face * 0.38 });
  for (const sz of [-1, 1]) SB.add(lathe(POST_PROFILE, 12), M.woodDark, x0, 0, z + sz * (w / 2 - 0.1));
  SB.add(roundBox(0.9, 0.06, w + 0.1, 0.025, 1), M.wood, x0 - face * 0.38, 1.13, z);
  { const v = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, 0.38), new THREE.MeshStandardMaterial({ map: stripeTex([c1, c2], 14, false, true), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
    v.position.set(x0 + face * 1.6, 2.53, z); v.rotation.y = face > 0 ? PI / 2 : -PI / 2; scene.add(v); }
  // shelves of glowing goods
  for (let s = 0; s < 2; s++) { SB.add(boxGeo(0.5, 0.06, w - 0.6, 1), M.woodDark, back + face * 0.35, 1.3 + s * 0.6, z);
    for (let i = 0; i < Math.floor(w * 1.6); i++) { const gz = z - w / 2 + 0.5 + i * (w - 1) / (Math.floor(w * 1.6) - 1);
      if (goods === 'potions') SB.add(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 8), pick([M.glowGreen, M.glowViolet, M.glowOrange]), back + face * 0.35, 1.48 + s * 0.6, gz, 0, { shadow: false });
      else if (goods === 'masks') SB.add(new THREE.SphereGeometry(0.15, 10, 8), pick([M.bone, M.purple, M.orange, M.black]), back + face * 0.35, 1.5 + s * 0.6, gz, 0, { sz: 0.6 });
      else if (i % 2) addPumpkin(back + face * 0.35, 1.45 + s * 0.6, gz, 0.13, true, face > 0 ? PI / 2 : -PI / 2);
      else SB.add(new THREE.SphereGeometry(0.1, 8, 6), pick([M.glowOrange, M.orange, M.purple]), back + face * 0.35, 1.44 + s * 0.6, gz, 0, { shadow: false });
    } }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.2), new THREE.MeshBasicMaterial({ map: signTex(name, { size: 130, color: signColor[name] || '#ff9a3a' }), transparent: true, color: hdr(0xffffff, 1.5), depthWrite: false }));
  sign.position.set(x0 + face * 0.2, 4.0, z); sign.rotation.y = face > 0 ? PI / 2 : -PI / 2; scene.add(sign);
  const bp = []; for (let i = 0; i <= w * 2; i++) bp.push(new V3(x0 + face * 1.55, 2.72, z - w / 2 - 0.1 + i * (w + 0.2) / (w * 2)));
  makeBulbs(scene, bp, PAL_WARM, 0.06);
  addPool(x0 + face * 1.5, z, w * 0.55, 0xffa050, 0.5);
  addBox(Math.min(x0, back) - 0.1, Math.max(x0, back) + 0.1, z - w / 2 - 0.1, z + w / 2 + 0.1);
}
function buildStreet() {
  buildStall({ x0: 11, z: 66, face: -1, name: 'CANDY', c1: '#d8560c', c2: '#1a0a10' });
  buildStall({ x0: -11, z: 66, face: 1, name: 'POTIONS', c1: '#3a8a4a', c2: '#140a18', goods: 'potions' });
  buildStall({ x0: -11, z: 34, face: 1, name: 'MASKS', c1: '#6a2a9a', c2: '#120a14', goods: 'masks' });
  // lamps + string lights zig-zagging across the street
  const zs = [74, 62, 50, 38, 26];
  zs.forEach(z => { addLamp(-7.5, z); addLamp(7.5, z); });
  for (let i = 0; i < zs.length; i++) {
    makeBulbs(scene, stringLights(new V3(-7.5, 4.3, zs[i]), new V3(7.5, 4.3, zs[i]), 1.2), PAL_SPOOK, 0.07);
    if (i < zs.length - 1) makeBulbs(scene, stringLights(new V3(-7.5, 4.3, zs[i]), new V3(7.5, 4.3, zs[i + 1]), 1.6), PAL_WARM, 0.07);
  }
  pointLight('street', 0xffa860, 50, 32, 0, 5.5, 50);
  // decor: hay bales, barrels, pumpkin clusters
  for (let i = 0; i < 14; i++) { const sx = i % 2 ? 1 : -1, z = 24 + i * 3.6; if (Math.abs(z - 50) < 6) continue;
    if (rand() > 0.5) { SB.add(roundBox(1.1, 0.6, 0.6, 0.1, 1), M.straw, sx * R(8.4, 9.4), 0.3, z, R(-0.4, 0.4)); addCircle(sx * 8.9, z, 0.5); }
    for (let k = 0; k < 3; k++) addPumpkin(sx * R(8.2, 9.8), 0, z + R(-1, 1), R(0.2, 0.45), rand() > 0.35); }
  for (const z of [44, 56]) { addBench(-6.0, z, PI / 2); addBench(6.0, z, -PI / 2); }
  addBarrel(12.4, 61.9); addBarrel(13.2, 61.6, 0.9, 1); addBarrel(-12.5, 70.3); addBarrel(-12.6, 29.8, 1.05); addCrate(12.6, 0, 70.5); addCrate(12.6, 0.6, 70.5, 0.5, 0.4); addCrate(-12.8, 0, 61.6, 0.7, 0.3);
  buildShootingGallery();
  buildStriker();
  buildFortune();
}

export { buildEntrance, makeScarecrow, buildStall, buildStreet };
