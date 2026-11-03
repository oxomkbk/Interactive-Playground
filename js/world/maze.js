import * as THREE from 'three';
import { PI, R, TAU, V3, damp, hdr, pick, rand, setSeed } from '../core/utils.js';
import { signTex } from '../core/textures.js';
import { pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { SB, addBox, addInteract, addPool, addTomb, boxGeo, onUpdate } from '../core/registry.js';
import { tombGeos } from './props.js';
import { BATS } from './atmosphere.js';
import { AU } from '../core/audio.js';
import { mm, showCard } from '../ui/ui.js';

/* ---------- Boneyard Maze & graveyard ---------- */
let MAZE_CELLS;
function buildMaze() {
  const C = 9, CS = 4, X0 = 30, Z0 = -73;
  const vis = Array.from({ length: C }, () => Array(C).fill(false));
  const hW = Array.from({ length: C + 1 }, () => Array(C).fill(true)), vW = Array.from({ length: C }, () => Array(C + 1).fill(true));
  setSeed(4242); const stack = [[4, 8]]; vis[8][4] = true;
  while (stack.length) { const [i, j] = stack[stack.length - 1];
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < C && b < C && !vis[b][a]);
    if (!nb.length) { stack.pop(); continue; }
    const [a, b] = pick(nb); vis[b][a] = true;
    if (a !== i) vW[j][Math.max(a, i)] = false; else hW[Math.max(b, j)][i] = false;
    stack.push([a, b]); }
  hW[C][4] = false; // entrance
  const segH = boxGeo(4.8, 2.6, 0.8, 2), segV = boxGeo(0.8, 2.6, 4.8, 2), mats = { h: [], v: [] }, m = new THREE.Matrix4();
  for (let j = 0; j <= C; j++) for (let i = 0; i < C; i++) if (hW[j][i]) { const x = X0 + i * CS + 2, z = Z0 + j * CS; mats.h.push(m.clone().makeTranslation(x, 1.3, z)); addBox(x - 2.4, x + 2.4, z - 0.4, z + 0.4); }
  for (let j = 0; j < C; j++) for (let i = 0; i <= C; i++) if (vW[j][i]) { const x = X0 + i * CS, z = Z0 + j * CS + 2; mats.v.push(m.clone().makeTranslation(x, 1.3, z)); addBox(x - 0.4, x + 0.4, z - 2.4, z + 2.4); }
  for (const [k, g] of [['h', segH], ['v', segV]]) { const im = new THREE.InstancedMesh(g, M.hedge, mats[k].length); mats[k].forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = im.receiveShadow = true; scene.add(im); }
  setSeed(777);
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { if ((i === 4 && j === 4) || rand() < 0.35) continue;
    const cx = X0 + i * CS + 2 + pick([-1.25, 1.25]), cz = Z0 + j * CS + 2 + pick([-1.25, 1.25]); addTomb(cx, cz, R(-0.5, 0.5), R(0.7, 1));
    if (rand() > 0.6) { SB.add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), M.wax, cx + 0.4, 0.15, cz, 0, { shadow: false }); SB.add(new THREE.SphereGeometry(0.045, 6, 4), M.candle, cx + 0.4, 0.34, cz, 0, { shadow: false }); addPool(cx + 0.4, cz, 1.6, 0xffa040, 0.5); } }
  // centre: ring of candles
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, x = 48 + Math.cos(a) * 1.3, z = -55 + Math.sin(a) * 1.3;
    SB.add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), M.wax, x, 0.2, z, 0, { shadow: false }); SB.add(new THREE.SphereGeometry(0.045, 6, 4), M.candle, x, 0.44, z, 0, { shadow: false }); }
  pointLight('maze', 0x70ffd0, 110, 40, 48, 6, -55); addPool(48, -55, 5, 0x60ffc0, 0.8);
  // entrance arch
  for (const sx of [-1, 1]) { SB.add(boxGeo(1, 3.6, 1, 1), M.stone, 48 + sx * 2.5, 1.8, -36.6); SB.add(new THREE.SphereGeometry(0.45, 12, 8), M.bone, 48 + sx * 2.5, 3.9, -36.6); addBox(48 + sx * 2.5 - 0.5, 48 + sx * 2.5 + 0.5, -37.1, -36.1); }
  SB.add(new THREE.TorusGeometry(2.5, 0.08, 6, 24, PI), M.iron, 48, 3.6, -36.6);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTex('BONEYARD', { size: 150, color: '#a6ffdc', glow: '#20ff90' }), transparent: true, color: hdr(0xffffff, 1.4), depthWrite: false }));
  sg.position.set(48, 4.6, -36.5); scene.add(sg);
  // graveyard field between plaza and maze
  setSeed(31337);
  for (let i = 0; i < 26; i++) { const x = R(14, 30), z = R(-44, -24); if (Math.abs((z + 18) + (x - 14) * 22 / 34) < 3) continue; addTomb(x, z, R(-0.4, 0.4), R(0.8, 1.3)); }
  const epitaphs = [
    [16, -30, 'Here lies Jack O’Lantern — he carved too deep.'], [18.5, -40, 'R.I.P. Mortimer Bones. “I told you I was sick.”'],
    [26, -27, 'Betty B. — still waiting for the last bus home.'], [28, -41, 'The guest who skipped the gift shop. Never again.']];
  epitaphs.forEach(([x, z, text]) => { const m = new THREE.Mesh(tombGeos()[0], M.stone); m.position.set(x, 0, z); m.scale.setScalar(1.3); m.castShadow = m.receiveShadow = true; scene.add(m);
    addBox(x - 0.6, x + 0.6, z - 0.2, z + 0.2); addPool(x, z + 0.8, 1.5, 0x80ffd0, 0.4);
    addInteract({ x, z: z + 1, r: 2.2, label: 'Read the epitaph', action: () => { showCard('Epitaph', text, 4200); AU.whisper(new V3(x, 1, z)); } }); });
  // the restless coffin
  const cx = 22, cz = -33;
  SB.add(boxGeo(1, 0.5, 2.2, 1), M.woodDark, cx, 0.25, cz); addBox(cx - 0.55, cx + 0.55, cz - 1.15, cz + 1.15);
  const lid = new THREE.Group(); lid.position.set(cx - 0.5, 0.5, cz); scene.add(lid);
  const lm = new THREE.Mesh(boxGeo(1.05, 0.1, 2.25, 1), M.woodDark); lm.position.x = 0.5; lm.castShadow = true; lid.add(lm);
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), M.bone); sk.position.set(cx, 0.1, cz - 0.6); scene.add(sk);
  let open = 0;
  addInteract({ x: cx + 1.2, z: cz, r: 2.5, label: () => open ? 'Best leave it be…' : 'Knock on the coffin', action: () => { if (open) return; open = 1; lid.rotation.z = 0;
    setTimeout(() => { lid.userData.t = 1.9; AU.cackle(new V3(cx, 1, cz)); BATS.burst(new V3(cx, 1, cz), 40); }, 700);
    setTimeout(() => { lid.userData.t = 0; open = 0; }, 12000); } });
  onUpdate((dt) => { lid.rotation.z = damp(lid.rotation.z, lid.userData.t || 0, 6, dt); sk.position.y = damp(sk.position.y, (lid.userData.t ? 0.7 : 0.1), 4, dt); });
  MAZE_CELLS = { X0, Z0, C, CS };
}

export { MAZE_CELLS, buildMaze };
