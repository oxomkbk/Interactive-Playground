import * as THREE from 'three';
import { PI, R, TAU, V3, pick, rand, setSeed } from '../core/utils.js';
import { M, TX } from '../core/materials.js';
import { PATHS } from './landscape.js';
import { chunkedInstances, merge, roundBox } from './props.js';
import { freeSpot } from './dressing.js';

/* =========================================================================
   FINISH PASS — the ground-level craftsmanship that stops the park reading as props on a plane:
   bevelled curbstones edging every path (skipping junctions), clumps of tall autumn grass in the
   verges, and drifts of fallen leaves along kerbs and under trees. All instanced & chunked.
   ========================================================================= */
const segDist = (x, z, [x1, z1, x2, z2]) => { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2)); return Math.hypot(x - x1 - dx * k, z - z1 - dz * k); };
const onPath = (x, z, pad = 0, skip = -1) => { if (Math.hypot(x, z) < 25.5 + pad) return true; for (let i = 0; i < PATHS.length; i++) if (i !== skip && segDist(x, z, PATHS[i]) < PATHS[i][4] / 2 + pad) return true; return false; };
function grassGeo() {
  const blades = [];
  for (let i = 0; i < 9; i++) { const h = R(0.35, 0.8), w = R(0.035, 0.06), g = new THREE.BufferGeometry();
    const lean = R(0.05, 0.25), a = i / 9 * TAU + R(-0.3, 0.3), r = R(0, 0.12);
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w * 0.4, h * 0.6, lean * 0.5, 0, h, lean], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.7, 0.6, 0.5, 1], 2)); g.computeVertexNormals();
    g.rotateY(a); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); blades.push(g); }
  return merge(blades);
}
function buildFinish() {
  setSeed(4242);
  // ---- curbstones: both edges of every path, every ~1.15 m, omitted where another path or the plaza crosses ----
  const curbs = [];
  PATHS.forEach(([x1, z1, x2, z2, w], pi) => { const len = Math.hypot(x2 - x1, z2 - z1), dx = (x2 - x1) / len, dz = (z2 - z1) / len, nx = -dz, nz = dx, ry = Math.atan2(dx, dz);
    for (let d = 0.6; d < len; d += 1.15) for (const s of [-1, 1]) { const x = x1 + dx * d + nx * s * (w / 2 + 0.12), z = z1 + dz * d + nz * s * (w / 2 + 0.12);
      if (onPath(x, z, 0.1, pi)) continue; curbs.push({ x, z, ry: ry + R(-0.03, 0.03), y: R(-0.02, 0.02) }); } });
  for (let i = 0; i < 220; i++) { const a = i / 220 * TAU; curbs.push({ x: Math.cos(a) * 25.15, z: Math.sin(a) * 25.15, ry: -a, y: 0, ring: true }); }
  const curbs2 = curbs.filter(c => c.ring ? !PATHS.some(p => segDist(c.x, c.z, p) < p[4] / 2 + 0.2) : true);
  chunkedInstances(roundBox(0.28, 0.17, 1.08, 0.05, 1), M.stoneDark, curbs2, (o, c) => { o.position.set(c.x, 0.07 + c.y, c.z); o.rotation.y = c.ry; }, { shadow: true, cell: 36 });
  // ---- tall autumn grass in the verges ----
  const tufts = [], gGeo = grassGeo();
  let tries = 0; while (tufts.length < 9000 && tries++ < 60000) { let cx, cz;
    if (rand() < 0.75) { const [x1, z1, x2, z2, w] = pick(PATHS), u = rand(), len = Math.hypot(x2 - x1, z2 - z1), s2 = pick([-1, 1]), off = w / 2 + R(0.7, 4.5); // verges beside the paths, where lamps light them
      cx = x1 + (x2 - x1) * u - (z2 - z1) / len * s2 * off; cz = z1 + (z2 - z1) * u + (x2 - x1) / len * s2 * off; }
    else { cx = R(-146, 146); cz = R(-188, 98); }
    if (onPath(cx, cz, 0.6) || !freeSpot(cx, cz, 0.4)) continue; const n = 1 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) { const x = cx + R(-0.7, 0.7), z = cz + R(-0.7, 0.7); if (!onPath(x, z, 0.4)) tufts.push({ x, z, s: R(0.7, 1.5), ry: R(0, TAU) }); } }
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7a7038, roughness: 0.88, side: THREE.DoubleSide });
  chunkedInstances(gGeo, grassMat, tufts, (o, g) => { o.position.set(g.x, 0, g.z); o.rotation.y = g.ry; o.scale.set(g.s * 1.2, g.s * R(1.0, 1.6), g.s * 1.2); }, { cell: 40 });
  // ---- fallen leaves drifted along the kerbs ----
  const leaves = [];
  for (const [x1, z1, x2, z2, w] of PATHS) { const len = Math.hypot(x2 - x1, z2 - z1), dx = (x2 - x1) / len, dz = (z2 - z1) / len;
    for (let d = 0; d < len; d += R(0.25, 0.7)) { const s = pick([-1, 1]), off = w / 2 - R(-0.4, 1.0) * (rand() < 0.75 ? 0.5 : 2.5);
      leaves.push({ x: x1 + dx * d - dz * s * off, z: z1 + dz * d + dx * s * off }); } }
  for (let i = 0; i < 2600; i++) { const x = R(-146, 146), z = R(-188, 98); if (freeSpot(x, z, 0.1)) leaves.push({ x, z }); }
  const leafMat = new THREE.MeshStandardMaterial({ map: TX.leaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: 0xffffff });
  const lg = new THREE.PlaneGeometry(0.32, 0.32).rotateX(-PI / 2);
  const ims = chunkedInstances(lg, leafMat, leaves, (o, l) => { o.position.set(l.x, 0.035 + rand() * 0.02, l.z); o.rotation.set(R(-0.25, 0.25), R(0, TAU), R(-0.25, 0.25)); o.scale.setScalar(R(0.7, 1.6)); }, { cell: 40 });
  const tones = [0xa8481a, 0xc8661e, 0x8a3c16, 0xd8862a, 0x9a5a24, 0xb87a30], c = new THREE.Color();
  for (const im of ims) { for (let i = 0; i < im.count; i++) im.setColorAt(i, c.setHex(pick(tones)).multiplyScalar(R(0.7, 1.1))); im.instanceColor.needsUpdate = true; }
}

export { buildFinish };
