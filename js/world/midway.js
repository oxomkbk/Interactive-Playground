import * as THREE from 'three';
import { bev } from '../core/surface.js';
import { $, PI, TAU, V3, damp, hdr, lerp, pick, rand } from '../core/utils.js';
import { backdropTex, signTex, strikerTex, stripeTex, targetTex } from '../core/textures.js';
import { scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { SB, addBox, addCircle, addInteract, addPool, boxGeo, makeBulbs, onUpdate, wallBox } from '../core/registry.js';
import { roundBox } from './props.js';
import { AU } from '../core/audio.js';
import { GAME_SHOOT, S, SCORES, collide, startGallery, startStriker } from '../game/play.js';
import { showCard } from '../ui/ui.js';
import { t } from '../core/i18n.js';

/* ---------- Shooting gallery, high striker, fortune teller ---------- */
const GALLERY = { targets: [] };
function buildShootingGallery() {
  const x0 = 11, z = 50, w = 9, d = 6, back = x0 + d;
  SB.add(boxGeo(d, 0.25, w, 2), M.wood, x0 + d / 2, 0.12, z);
  wallBox(back, back + 0.2, 0, 3.6, z - w / 2, z + w / 2, M.wood, { collide: false });
  for (const s of [-1, 1]) wallBox(x0, back, 0, 3.6, z + s * w / 2 - 0.1, z + s * w / 2 + 0.1, M.wood, { collide: false });
  SB.add(roundBox(0.7, 1.1, w - 0.2, 0.04, 1.5), M.woodDark, x0 + 0.35, 0.55, z);
  SB.add(roundBox(d + 0.6, 0.2, w + 0.4, 0.06, 2), M.roof, x0 + d / 2, 3.7, z);
  SB.add(new THREE.PlaneGeometry(w - 0.4, 3.2), new THREE.MeshStandardMaterial({ map: backdropTex(), emissiveMap: backdropTex(), emissive: 0xffffff, emissiveIntensity: 1.3 }), back - 0.02, 1.9, z, -PI / 2, { shadow: false });
  for (const y of [1.3, 2.2]) SB.add(new THREE.CylinderGeometry(0.03, 0.03, w - 0.6, 6), M.brass, back - 1.1, y, z, 0, { rx: PI / 2 });
  const aw = new THREE.MeshStandardMaterial({ map: stripeTex(['#b02020', '#f0e0c0', '#b02020', '#140a10'], 8, true), roughness: 0.8 });
  SB.add(bev(1.8, 0.05, w + 0.4), aw, x0 - 0.75, 3.35, z, 0, { rz: 0.38 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6), new THREE.MeshBasicMaterial({ map: signTex('SPOOK SHOOT', { size: 130, color: '#ff5050', glow: '#ff0000', sub: 'ghosts 10 · pumpkins 15 · gold bats 50 · spare the cat!' }), transparent: true, color: hdr(0xffffff, 1.5), depthWrite: false }));
  sign.position.set(x0 - 0.2, 4.45, z); sign.rotation.y = -PI / 2; scene.add(sign);
  makeBulbs(scene, Array.from({ length: 24 }, (_, i) => new V3(x0 - 1.55, 2.95, z - w / 2 + i * w / 23)), [hdr(0xff3030, 5), hdr(0xffe0a0, 4)], 0.065);
  addPool(x0 - 1.6, z, 5, 0xff6040, 0.6); addBox(x0 - 0.1, back + 0.2, z - w / 2 - 0.1, z + w / 2 + 0.1);
  const kinds = { ghost: targetTex('ghost'), pumpkin: targetTex('pumpkin'), bat: targetTex('bat'), cat: targetTex('cat') };
  for (let i = 0; i < 10; i++) {
    const row = i % 2, piv = new THREE.Group(); piv.position.set(back - 1.15, row ? 2.2 : 1.3, z); scene.add(piv);
    const mat = new THREE.MeshStandardMaterial({ map: kinds.ghost, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: kinds.ghost, emissiveIntensity: 0.75 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7).translate(0, 0.37, 0), mat); m.rotation.y = -PI / 2; piv.add(m);
    GALLERY.targets.push({ piv, m, mat, row, off: i / 10, kind: 'ghost', up: 1, down: 0, kinds });
  }
  GALLERY.zmin = z - w / 2 + 0.8; GALLERY.zmax = z + w / 2 - 0.8; GALLERY.cam = new V3(x0 - 1.3, 1.62, z);
  addInteract({ x: x0 - 1.2, z, r: 2.6, label: () => t('Play Spook Shoot · best {n}', { n: SCORES.shoot }), action: startGallery });
  onUpdate((dt, t) => {
    for (const tg of GALLERY.targets) {
      const sp = (tg.row ? 0.11 : -0.08) * (S.game === GAME_SHOOT ? 1.6 : 1) * (tg.kind === 'bat' ? 2 : 1);
      tg.off = (tg.off + sp * dt + 1) % 1; tg.piv.position.z = lerp(GALLERY.zmin, GALLERY.zmax, tg.off);
      if (tg.down > 0) { tg.down -= dt; if (tg.down <= 0) { const r = rand(); tg.kind = r < 0.08 ? 'bat' : r < 0.2 ? 'cat' : r < 0.45 ? 'pumpkin' : 'ghost'; tg.mat.map = tg.mat.emissiveMap = tg.kinds[tg.kind]; tg.up = 1; } }
      tg.piv.rotation.z = damp(tg.piv.rotation.z, tg.up ? 0 : -PI / 2, 12, dt);
    }
  });
}
const STRIKER = {};
function buildStriker() {
  const x = -15, z = 50;
  SB.add(boxGeo(5, 0.3, 6, 2), M.wood, -13.5, 0.15, z);
  SB.add(boxGeo(0.5, 9, 0.5, 1), M.woodDark, x, 4.5, z); addBox(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 7.6), new THREE.MeshBasicMaterial({ map: strikerTex(), color: hdr(0xffffff, 1.15) })); board.position.set(x + 0.27, 4.6, z); board.rotation.y = PI / 2; scene.add(board);
  STRIKER.bell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10, 0, TAU, 0, PI / 2), M.brass); STRIKER.bell.position.set(x + 0.2, 9.1, z); scene.add(STRIKER.bell);
  STRIKER.bellGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: hdr(0xffd070, 0.3) })); STRIKER.bellGlow.position.set(x + 0.2, 9.15, z); scene.add(STRIKER.bellGlow);
  STRIKER.puck = new THREE.Mesh(boxGeo(0.35, 0.25, 0.35, 1), M.glowOrange); STRIKER.puck.position.set(x + 0.45, 0.9, z); scene.add(STRIKER.puck);
  SB.add(boxGeo(1.2, 0.3, 1.2, 1), M.rust, x + 1.3, 0.45, z); addBox(x + 0.7, x + 1.9, z - 0.6, z + 0.6);
  SB.add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), M.wood, x + 2.4, 0.65, z + 1.6, 0, { rz: 0.3 }); SB.add(boxGeo(0.5, 0.3, 0.3, 1), M.iron, x + 2.2, 1.3, z + 1.6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: signTex('TEST YOUR NERVE', { size: 110, color: '#ffd070', glow: '#ff8000' }), transparent: true, color: hdr(0xffffff, 1.5), depthWrite: false }));
  sign.position.set(-11.6, 4.2, z); sign.rotation.y = PI / 2; scene.add(sign);
  for (const s of [-1, 1]) SB.add(new THREE.CylinderGeometry(0.08, 0.08, 4.3, 6), M.woodDark, -11.6, 2.15, z + s * 2.6);
  STRIKER.bulbs = makeBulbs(scene, Array.from({ length: 22 }, (_, i) => new V3(x + 0.3, 0.6 + i * 0.38, z + 0.32)), [hdr(0xffc040, 4)], 0.06);
  addPool(-12.5, z, 5, 0xffb040, 0.6);
  STRIKER.cam = new V3(-11.4, 1.62, z);
  addInteract({ x: -11.6, z, r: 2.6, label: () => t('Test Your Nerve · best {n}%', { n: SCORES.striker }), action: startStriker });
}
function buildFortune() {
  const X = 15, Z = 33;
  SB.add(new THREE.CylinderGeometry(2.6, 2.6, 2.9, 20, 1, true, PI / 2 + 0.6, TAU - 1.2), new THREE.MeshStandardMaterial({ map: stripeTex(['#3a1458', '#100818'], 12), side: THREE.DoubleSide, roughness: 0.9 }), X, 1.45, Z);
  SB.add(new THREE.ConeGeometry(3.0, 2.6, 20), new THREE.MeshStandardMaterial({ map: stripeTex(['#3a1458', '#c08a30'], 20), roughness: 0.9 }), X, 4.2, Z);
  SB.add(new THREE.CylinderGeometry(0.7, 0.8, 0.9, 16), M.cloth, X + 0.3, 0.45, Z);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: 0x8a60ff, emissive: 0x9a6aff, emissiveIntensity: 2, roughness: 0.05, transparent: true, opacity: 0.85 }));
  ball.position.set(X + 0.3, 1.25, Z); scene.add(ball);
  addCircle(X, Z, 2.7); addPool(X - 2.5, Z, 3, 0xa070ff, 0.8);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: signTex('MADAME NOX', { size: 120, color: '#c79bff', glow: '#7a30ff', sub: 'fortunes · curses · refunds never' }), transparent: true, color: hdr(0xffffff, 1.4), depthWrite: false }));
  sign.position.set(X - 2.7, 3.4, Z); sign.rotation.y = -PI / 2; scene.add(sign);
  let flare = 0;
  addInteract({ x: X - 3.2, z: Z, r: 2.6, label: 'Ask Madame Nox your fortune', action: () => { flare = 1; AU.shimmer(ball.position); showCard('Madame Nox whispers…', pick(FORTUNES), 5200); } });
  onUpdate((dt, t) => { flare = Math.max(0, flare - dt * 0.3); ball.material.emissiveIntensity = 1.6 + Math.sin(t * 2) * 0.5 + flare * 8; ball.scale.setScalar(1 + flare * 0.15); });
}
const FORTUNES = [
  'A tall, dark stranger will follow you home. He is already behind you.', 'You will find what you seek at the centre of the bones.',
  'Your future holds great fortune… and at least three ghosts.', 'Do not trust the fourth horse on the carousel. It knows.',
  'You will ride the Eye, and the Eye will remember you.', 'Thirteen souls wait for you. One of them is your own.',
  'Beware the cat you spare. It never forgets a kindness.', 'The bell tolls for thee — but only if you ring it.',
  'You will live a long life. Your reflection will not.', 'Something in the Manor has been waiting for you specifically.',
];

export { GALLERY, buildShootingGallery, STRIKER, buildStriker, buildFortune, FORTUNES };
