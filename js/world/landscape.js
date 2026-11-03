import * as THREE from 'three';
import { bev } from '../core/surface.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PI, R, TAU, V3, fbm, hdr, lerp, pick, setSeed, smooth } from '../core/utils.js';
import { scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { makePoints } from '../core/shaders.js';
import { Batcher, PLATFORMS, SB, TREES, addBox, addCircle, scaleUV } from '../core/registry.js';
import { chunkedInstances, merge, roundBox, taper } from './props.js';
import { mm } from '../ui/ui.js';
import { t } from '../core/i18n.js';

// ---------- Terrain & paths ----------
function terrainH(x, z) {
  const dx = Math.max(0, Math.abs(x) - 156), dz = Math.max(0, z > 0 ? z - 106 : -z - 197), d = Math.hypot(dx, dz);
  if (d <= 0) return 0;
  return smooth(0, 90, d) * (3 + fbm(x * 0.012, z * 0.012, 1e6, 4, 77) * 36) + d * 0.05;
}
function groundAt(x, z) { let h = 0; for (const p of PLATFORMS) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) h = Math.max(h, p.h); return h; }
const PATHS = [ // [x1,z1,x2,z2,width]
  [0, 104, 0, 20, 14], [0, -20, 0, -55, 8], [-18, -6, -36, -10, 7], [18, 8, 27, 14, 7], [18, -8, 30, -13, 7],
  [14, -18, 48, -36, 6], [-7, 40, -34, 33, 6], [-20, 8, -52, 22, 6],
  [27, 6, 57, 6, 6], [42, 24, 48, 53, 6], [48, 53, 66, 53, 6], [-14, -16, -25, -37, 5], [-8, 59, -18, 60, 5],
  // grand avenues out to the far districts
  [-52, 22, -94, 22, 7], [-80, 22, -92, 52, 5], [-82, 18, -104, -8, 5],                        // west: Circus, Cups, Archery
  [66, 53, 84, 46, 6], [57, 6, 80, -38, 6],                                                     // east: Fields, Lake pier
  [-22, -40, -24, -104, 6], [-24, -104, 0, -118, 7], [0, -96, 0, -122, 8], [22, -40, 24, -104, 6], [24, -104, 0, -118, 7],  // north: Cathedral boulevard
  [-24, -76, -48, -78, 5],                                                                       // Witchwood trailhead
];
function buildGround() {
  const g = new THREE.PlaneGeometry(1900, 1900, 260, 260); g.rotateX(-PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
  g.computeVertexNormals(); scaleUV(g, 300, 300);
  const ground = new THREE.Mesh(g, M.ground); ground.receiveShadow = true; scene.add(ground);
  PATHS.forEach(([x1, z1, x2, z2, w], i) => {
    const len = Math.hypot(x2 - x1, z2 - z1), pg = new THREE.PlaneGeometry(w, len); pg.rotateX(-PI / 2); scaleUV(pg, w / 3.2, len / 3.2);
    SB.add(pg, M.cobble, (x1 + x2) / 2, 0.02 + i * 0.002, (z1 + z2) / 2, Math.atan2(x2 - x1, z2 - z1), { shadow: false });
  });
  const pz = new THREE.CircleGeometry(25, 72); pz.rotateX(-PI / 2); const uv = pz.attributes.uv, pp = pz.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 3.2, pp.getZ(i) / 3.2);
  SB.add(pz, M.cobble, 0, 0.04, 0, 0, { shadow: false });
}

// ---------- Perimeter fence ----------
function buildFence() {
  const bar = mergeGeometries([new THREE.BoxGeometry(0.05, 2.3, 0.05).translate(0, 1.15, 0), new THREE.ConeGeometry(0.06, 0.22, 4).translate(0, 2.4, 0)]);
  const segs = [[-150, -192, 150, -192], [-150, -192, -150, 78], [150, -192, 150, 78], [-150, 78, -11.5, 78], [11.5, 78, 150, 78]];
  const mats = []; const m = new THREE.Matrix4();
  for (const [x1, z1, x2, z2] of segs) {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.floor(len / 0.32);
    for (let i = 0; i <= n; i++) { const t = i / n; mats.push(m.clone().makeTranslation(lerp(x1, x2, t), 0, lerp(z1, z2, t))); }
    const ang = Math.atan2(x2 - x1, z2 - z1);
    for (const y of [0.4, 1.9]) SB.add(bev(0.06, 0.07, len), M.iron, (x1 + x2) / 2, y, (z1 + z2) / 2, ang, { shadow: false });
    for (let i = 0; i <= len / 12; i++) { const t = Math.min(1, i * 12 / len); const px = lerp(x1, x2, t), pz = lerp(z1, z2, t); SB.add(roundBox(0.55, 2.7, 0.55, 0.05, 1), M.stoneDark, px, 1.35, pz); SB.add(roundBox(0.75, 0.16, 0.75, 0.04, 1), M.stoneDark, px, 2.78, pz); SB.add(new THREE.ConeGeometry(0.36, 0.34, 4), M.stoneDark, px, 3.03, pz, PI / 4); SB.add(new THREE.SphereGeometry(0.09, 10, 8), M.stoneDark, px, 3.25, pz); }
    addBox(Math.min(x1, x2) - 0.15, Math.max(x1, x2) + 0.15, Math.min(z1, z2) - 0.15, Math.max(z1, z2) + 0.15);
  }
  const im = new THREE.InstancedMesh(bar, M.iron, mats.length); mats.forEach((mm, i) => im.setMatrixAt(i, mm)); scene.add(im);
}

// ---------- Distant layered scenery: ridges, castle, village lights, forest ----------
function buildDistant() {
  const ridge = (radius, base, amp, freq, col, seed) => {
    const N = 360, pos = [];
    const top = a => base + amp * fbm(Math.cos(a) * freq + seed, Math.sin(a) * freq + seed, 1e6, 5, seed) + amp * 0.6 * Math.pow(Math.abs(Math.sin(a * 3 + seed)), 6);
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, t0 = top(a0), t1 = top(a1);
      const P = (a, y) => [Math.cos(a) * radius, y, Math.sin(a) * radius];
      pos.push(...P(a0, -40), ...P(a1, -40), ...P(a1, t1), ...P(a0, -40), ...P(a1, t1), ...P(a0, t0));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, fog: false, side: THREE.DoubleSide })); scene.add(mesh);
    return top;
  };
  ridge(820, 40, 170, 2.2, new THREE.Color().setRGB(0.034, 0.028, 0.052), 3);
  ridge(600, 20, 110, 3.1, new THREE.Color().setRGB(0.022, 0.018, 0.036), 7);
  const nearTop = ridge(420, 8, 62, 4.0, new THREE.Color().setRGB(0.012, 0.010, 0.02), 11);
  // Castle silhouette on the near ridge
  const ca = Math.atan2(-1, -0.12), cr = 418, cx = Math.cos(ca) * cr, cz = Math.sin(ca) * cr, cy = nearTop(ca) - 4;
  const sil = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.008, 0.007, 0.014), fog: false });
  const win = new THREE.MeshBasicMaterial({ color: hdr(0xffa040, 2.6), fog: false });
  const castle = new THREE.Group(); castle.position.set(cx, cy, cz); castle.lookAt(0, cy, 0); scene.add(castle);
  const cb = new Batcher();
  cb.add(new THREE.BoxGeometry(34, 16, 10), sil, 0, 8, 0);
  [[-17, 30, 3.4], [17, 26, 3], [-6, 40, 2.6], [8, 34, 2.4], [0, 22, 5]].forEach(([x, h, r]) => {
    cb.add(new THREE.CylinderGeometry(r, r * 1.1, h, 10), sil, x, h / 2, 0);
    cb.add(new THREE.ConeGeometry(r * 1.35, r * 3.2, 10), sil, x, h + r * 1.6, 0);
  });
  for (let i = 0; i < 18; i++) cb.add(new THREE.PlaneGeometry(0.9, 1.6), win, R(-18, 18), R(5, 30), 5.3, 0, { shadow: false });
  cb.build(castle);
  // Village lights scattered in the valley
  const vp = makePoints(140);
  for (let i = 0; i < 140; i++) { const a = R(0, TAU), r = R(300, 480); vp.pos.set([Math.cos(a) * r, terrainH(Math.cos(a) * r, Math.sin(a) * r) + R(0.5, 3), Math.sin(a) * r], i * 3);
    const c = hdr(pick([0xffa040, 0xffc070, 0xff7020]), R(1.5, 3.5)); vp.col.set([c.r, c.g, c.b], i * 3); vp.size[i] = R(0.8, 1.6); }
  vp.flag();
}
function treeGeometry(seed) {
  setSeed(seed); const parts = [new THREE.CylinderGeometry(0.3, 0.7, 0.9, 9).translate(0, 0.1, 0)];
  const branch = (start, dir, len, rad, depth) => {
    const mid = start.clone().addScaledVector(dir, len * 0.5), d2 = dir.clone().add(new V3(R(-0.25, 0.25), R(-0.05, 0.15), R(-0.25, 0.25))).normalize(), end = mid.clone().addScaledVector(d2, len * 0.5);
    parts.push(taper(start, mid, rad, rad * 0.8, depth > 2 ? 9 : 6), taper(mid, end, rad * 0.8, rad * 0.62, depth > 2 ? 9 : 6));
    if (depth > 0) { const n = depth > 2 ? 3 : 2;
      for (let i = 0; i < n; i++) { const nd = d2.clone().add(new V3(R(-0.9, 0.9), R(-0.1, 0.6), R(-0.9, 0.9))).normalize(); branch(end, nd, len * R(0.55, 0.78), rad * 0.62, depth - 1); } }
  };
  branch(new V3(0, -0.3, 0), new V3(R(-0.1, 0.1), 1, R(-0.1, 0.1)).normalize(), 3.2, 0.32, 4);
  return merge(parts);
}
function buildTrees() {
  const geos = [treeGeometry(11), treeGeometry(23), treeGeometry(57)];
  setSeed(9090);
  for (let i = 0; i < 520; i++) { const a = R(0, TAU), r = R(170, 330); const x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r - 50; if (Math.abs(x) < 158 && z > -200 && z < 86) continue;
    if (z > 80 && Math.abs(x) < 30) continue; TREES.push({ x, z, s: R(1.2, 2.6), ry: R(0, TAU), shadow: false }); }
  const inner = [[-70, 70], [-82, 60], [70, 66], [82, 40], [84, -10], [-84, -88], [80, -86], [25, -86], [-25, -88], [-20, -58], [24, -88], [64, -30], [-30, 60], [30, 72], [-58, 70], [56, 52], [-20, -36], [20, -50]];
  inner.forEach(([x, z]) => { TREES.push({ x, z, s: R(1.4, 2.1), ry: R(0, TAU), shadow: true }); addCircle(x, z, 0.5); });
  for (const shadow of [false, true]) for (let v = 0; v < 3; v++) {
    const list = TREES.filter((t, i) => t.shadow === shadow && i % 3 === v); if (!list.length) continue;
    chunkedInstances(geos[v], M.bark, list, (o, t) => { o.position.set(t.x, terrainH(t.x, t.z), t.z); o.rotation.y = t.ry; o.scale.setScalar(t.s); }, { shadow, cell: 60 });
  }
}

// ---------- Pumpkin geometry ----------
let PUMPKIN_GEO;
function makePumpkinGeo() {
  const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const phi = Math.atan2(z, x), lat = Math.sqrt(Math.max(0, 1 - y * y));
    const rib = 0.86 + 0.14 * Math.pow(Math.abs(Math.cos(phi * 5)), 0.35), lump = 1 + 0.025 * Math.sin(phi * 3 + y * 4) + 0.012 * Math.sin(phi * 11 - y * 7);
    const f = lerp(1, rib, Math.pow(lat, 0.8)) * lump; x *= f; z *= f; y *= 0.8;
    if (y > 0.62) y -= (y - 0.62) * 0.75; if (y < -0.7) y += (-0.7 - y) * 0.6;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const st = new THREE.CylinderGeometry(0.05, 0.11, 0.42, 10, 8), sp = st.attributes.position, suv = st.attributes.uv;   // curved, tapering stem
  for (let i = 0; i < sp.count; i++) { const y = sp.getY(i) + 0.21; sp.setXYZ(i, sp.getX(i) * (1 - y * 0.3) + y * y * 0.55, y + 0.58, sp.getZ(i) * (1 - y * 0.3)); suv.setXY(i, 0.5, 0.995); }
  st.computeVertexNormals();
  PUMPKIN_GEO = mergeGeometries([g, st]);
}
function bigPumpkin(parent, x, y, z, s, ry = 0, lit = true) {
  const m = new THREE.Mesh(PUMPKIN_GEO, lit ? M.pumpkinLit : M.pumpkin); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.y = ry; m.castShadow = true;
  parent.add(m); return m;
}

export { terrainH, groundAt, PATHS, buildGround, buildFence, buildDistant, treeGeometry, buildTrees, PUMPKIN_GEO, makePumpkinGeo, bigPumpkin };
