/* =========================================================================
   VEGETATION — five tree species (cherry blossom, round fantasy oak, flowering tree, wisteria-lavender,
   tiered conifer), bushes, flower clusters and grass tufts, plus a low-poly forest on the far hills.
   Everything is instanced: one trunk mesh, one canopy mesh (all species, tinted per clump), one flower mesh,
   one tuft mesh — and the canopy, flowers and tufts sway in the wind (vertex shader, see materials.foliage).
   Call tree()/bush()/bed() while building the world, then build() once.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOOT_TIER } from '../core/renderer.js';
import { CONFIG } from '../config.js';
import { rand, R, pick } from '../core/geo.js';
import { foliage, matte } from '../core/materials.js';
import { scanned } from '../core/scans.js';
import { SPECIES as KINDS, grow } from './trees.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
const ALIAS = { round: ['oak', 'oak', 'birch'], flowering: ['maple', 'birch', 'oak'], conifer: ['pine', 'pine', 'cypress'] };
const SPECIES = {
  cherry: { trunk: 1, h: 3.3, clumps: [11, 15], spread: 1.9, size: [0.85, 1.35], cols: ['#FFB3C6', '#F7A1BC', '#FFC9D6', '#FDE2EA', '#F28FAF', '#FFD4E0'] },
  round: { trunk: 1.2, h: 4.2, clumps: [6, 8], spread: 1.5, size: [1.3, 1.9], cols: ['#6FAF6A', '#5E9E62', '#86BF73', '#4E8E5B', '#7DBA6E'] },
  flowering: { trunk: 1, h: 3.6, clumps: [7, 9], spread: 1.6, size: [1.0, 1.5], cols: ['#7DBA6E', '#8CC57A', '#6AA866'], flowers: ['#FFF5E1', '#FFB3C6', '#FFD68A'] },
  wisteria: { trunk: 1.1, h: 3.8, clumps: [9, 12], spread: 1.8, size: [0.9, 1.3], cols: ['#C8A2E8', '#B693DD', '#D9BFF0', '#A88AD8'] },
  conifer: { trunk: 0.8, h: 0, cols: ['#3F7F57', '#4A8B60', '#356F4C'] },
};

function createVegetation() {
  const trunks = [], clumps = [], cones = [], flowers = [], tufts = [], far = [], grown = {};
  const dens = CONFIG.quality[BOOT_TIER].foliage;
  const api = {
    // a grown tree: one of three individuals of its species, turned and scaled; its foliage clusters join the shared canopy meshes
    tree(type, x, z, s = R(0.85, 1.2), y = 0) {
      const name = KINDS[type] ? type : pick(ALIAS[type] || ['oak']), sp = KINDS[name], v = Math.floor(rand() * 3), key = name + v;
      if (!grown[key]) grown[key] = grow(name, 1000 + v * 7919 + name.length * 131);
      const ry = R(0, TAU), cs = Math.cos(ry), sn = Math.sin(ry), tint = R(-0.04, 0.04);
      trunks.push({ p: V(x, y, z), s: V(s, s, s), r: ry, key, sp: name });
      for (const an of grown[key].anchors) { const lx = an.p.x * s, lz = an.p.z * s, sz = an.s * s * R(0.9, 1.1);
        const c = new THREE.Color(pick(sp.cols)).offsetHSL(tint * 0.5, 0, tint);
        clumps.push({ p: V(x + lx * cs + lz * sn, y + an.p.y * s, z - lx * sn + lz * cs), s: V(sz, sz * 0.85, sz), r: R(0, TAU), c, kind: an.kind }); }
    },
    bush(x, z, s = 1, cols = ['#5E9E62', '#6FAF6A', '#4E8E5B'], y = 0) {
      const n = 3 + Math.floor(rand() * 3); for (let i = 0; i < n; i++) { const a = rand() * TAU, r = R(0, 0.6) * s, sz = R(0.45, 0.75) * s;
        clumps.push({ p: V(x + Math.sin(a) * r, y + sz * 0.6, z + Math.cos(a) * r), s: V(sz, sz * 0.8, sz), r: R(0, TAU), c: pick(cols), kind: 'leaf' }); }
      if (rand() < 0.5) for (let f = 0; f < 5; f++) flowers.push({ p: V(x + R(-0.6, 0.6) * s, y + R(0.5, 0.9) * s, z + R(-0.6, 0.6) * s), s: 0.9, c: pick(['#FFB3C6', '#FFF5E1', '#C8A2E8']), r: R(0, TAU) });
    },
    // a flower bed: blooms + leafy tufts scattered inside a circle (or a rectangle when w,d are given)
    bed(x, z, r, n = 60, cols = ['#FFB3C6', '#F28FAF', '#FFF5E1', '#C8A2E8', '#FFD68A', '#FFAD91'], { w = 0, d = 0, y = 0.05, rotY = 0 } = {}) {
      const cnt = Math.round(n * dens), cs = Math.cos(rotY), sn = Math.sin(rotY);
      for (let i = 0; i < cnt; i++) { let lx, lz; if (w) { lx = R(-w / 2, w / 2); lz = R(-d / 2, d / 2); } else { const a = rand() * TAU, rr = Math.sqrt(rand()) * r; lx = Math.sin(a) * rr; lz = Math.cos(a) * rr; }
        const px = x + lx * cs + lz * sn, pz = z - lx * sn + lz * cs;
        if (rand() < 0.62) flowers.push({ p: V(px, y + R(0.22, 0.42), pz), s: R(0.8, 1.25), c: pick(cols), r: R(0, TAU) }); else tufts.push({ p: V(px, y, pz), s: R(0.7, 1.3), r: R(0, TAU), c: pick(['#6FAF6A', '#86BF73', '#5E9E62']) }); }
    },
    tuft(x, z, s = 1) { tufts.push({ p: V(x, 0, z), s, r: R(0, TAU), c: pick(['#79B56A', '#8FC27A', '#6CA65E', '#A0CD86']) }); },
    farTree(x, y, z, s) { const t = rand(); far.push({ p: V(x, y, z), s: V(s, s * R(1.2, 1.7), s), r: R(0, TAU), t: t < 0.45 ? 0 : t < 0.85 ? 1 : 2, c: t < 0.45 ? pick(['#2F4A3E', '#2A4438', '#344F44']) : t < 0.85 ? pick(['#3E5A40', '#46603F', '#4F6A46', '#3A5546', '#55704A', '#41584A']) : pick(['#3A5A3E', '#456846']) }); },
    trunks, clumps,
    build() {
      const root = new THREE.Group(); root.name = 'vegetation';
      const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), col = new THREE.Color();
      const inst = (geo, mat, items, { cast = true, receive = true } = {}) => { if (!items.length) return null; const im = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach((it, i) => { im.setMatrixAt(i, _m.compose(it.p, _q.setFromEuler(_e.set(0, it.r, 0)), it.s.isVector3 ? it.s : V(it.s, it.s, it.s))); if (it.c) im.setColorAt(i, col.set(it.c)); });
        im.castShadow = cast; im.receiveShadow = receive; im.computeBoundingSphere(); root.add(im); return im; };
      // trunks: one instanced mesh per grown individual, in that species' bark
      const barkM = {}; const bark = (name) => barkM[name] || (barkM[name] = name === 'birch' ? scanned('white_plaster_02', { tint: '#F4F0E8', repeat: 1, normal: 1.2 }) : scanned('bark_brown_02', { tint: new THREE.Color(KINDS[name].bark).multiplyScalar(2.2), repeat: 1, normal: 1.4 }));
      for (const key of Object.keys(grown)) { const name = key.slice(0, -1); inst(grown[key].geo, bark(name), trunks.filter(t => t.key === key), { cast: false }); }  // (no moon shadows from trees: a big, constant cost for a faint effect at night)
      // canopy: a dense core plus a shell of crossed cards (leaves, blossom, needles) whose normals point out from the
      // cluster centre, so light wraps around each cluster; willows and wisteria hang curtains of strands instead
      const solid = clumps.filter(c => c.kind === 'leaf' || c.kind === 'needle');
      const core = new THREE.IcosahedronGeometry(0.34, 1); { const p = core.attributes.position, n = core.attributes.normal; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); } }
      inst(core, foliage('#6a6a6a', 0.95, 0.05), solid, { cast: false });   // a soft dark heart so the cards never look see-through (no shadow: moonlit canopies throw faint ones; trunks keep theirs)
      const cards = [], _eu = new THREE.Euler();
      for (let i = 0; i < 13; i++) { const q = new THREE.PlaneGeometry(1.05, 1.05).toNonIndexed(); q.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(_eu.set(R(0, TAU), R(0, TAU), R(0, TAU))));
        const u = V(R(-1, 1), R(-0.6, 1), R(-1, 1)).normalize().multiplyScalar(R(0.3, 0.62)); q.translate(u.x, u.y, u.z);
        const pp = q.attributes.position, nn = q.attributes.normal; for (let k = 0; k < pp.count; k++) { const n = V(pp.getX(k), pp.getY(k) + 0.25, pp.getZ(k)).normalize(); nn.setXYZ(k, n.x, n.y, n.z); }
        cards.push(q); }
      const cardG = mergeGeometries(cards);
      const strands = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + R(-0.2, 0.2), r = R(0.25, 0.55), h = R(1.6, 2.6); const q = new THREE.PlaneGeometry(0.42, h, 1, 3).translate(0, -h / 2 + 0.2, 0).rotateY(a + Math.PI / 2).translate(Math.cos(a) * r, 0, Math.sin(a) * r).toNonIndexed();
        const pp = q.attributes.position, nn = q.attributes.normal; for (let k = 0; k < pp.count; k++) { const n = V(pp.getX(k), 0.4, pp.getZ(k)).normalize(); nn.setXYZ(k, n.x, n.y, n.z); } strands.push(q); }
      const strandG = mergeGeometries(strands);
      // leaf cards: alpha-to-coverage on the MSAA target (soft, anti-aliased leaf edges instead of a jagged alpha
      // cut), and canopy depth shading — cards deep in a cluster sit in cool, dark shade, the outer tips catch warm
      // light, undersides are darker than tops — so every tree reads as a volume of foliage rather than flat cards
      const leafM = (key, tex) => { const m = foliage(key, 0.72, 0.05).clone(); m.map = tex; m.alphaTest = 0.4; m.alphaToCoverage = true; m.side = THREE.DoubleSide;
        const base = foliage(key, 0.72, 0.05).onBeforeCompile;
        m.onBeforeCompile = (sh, r) => { base(sh, r);
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vOcc; varying float vUpN;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vOcc = clamp((length(position) - 0.15) / 0.75, 0.0, 1.0); vUpN = normal.y;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vOcc; varying float vUpN;').replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb *= mix(0.4, 1.1, vOcc) * mix(0.68, 1.0, vUpN * 0.5 + 0.5);
            diffuseColor.rgb *= mix(vec3(0.86, 0.95, 1.06), vec3(1.07, 1.02, 0.9), vOcc);`); };
        m.customProgramCacheKey = () => 'foliage-cards-v2'; return m; };
      // (the cards don't cast shadows: the dense cores already throw the canopy's shadow, at a fraction of the cost)
      const noCast = { cast: false };
      inst(cardG, leafM('#fffffe', leafTex('leaf')), clumps.filter(c => c.kind === 'leaf'), noCast);
      inst(cardG, leafM('#fffffd', leafTex('blossom')), clumps.filter(c => c.kind === 'blossom'), noCast);
      inst(cardG, leafM('#fffffc', leafTex('needle')), clumps.filter(c => c.kind === 'needle'), noCast);
      inst(strandG, leafM('#fffffb', leafTex('strand')), clumps.filter(c => c.kind === 'willow'), noCast);
      inst(strandG, leafM('#fffffa', leafTex('blossomStrand')), clumps.filter(c => c.kind === 'wisteria'), noCast);
      void cones;
      // flowers, three kinds on real stems: a cupped eight-petal cosmos with a golden heart, a tulip cup, and a
      // layered rose head. Petal colours come from each bloom's instance colour; at night they glow faintly.
      const bloomM = (key) => { const m = foliage(key, 0.55, 0.02).clone(); m.onBeforeCompile = (sh, r) => { foliage(key, 0.55, 0.02).onBeforeCompile(sh, r);
          sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.22;'); }; m.customProgramCacheKey = () => 'bloom'; m.side = THREE.DoubleSide; return m; };
      const cupped = (g, k) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) + r * r * k); } g.computeVertexNormals(); return g; };
      const cosmos = []; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; cosmos.push(new THREE.PlaneGeometry(0.035, 0.085, 1, 2).rotateX(-Math.PI / 2).translate(0, 0, 0.055).rotateY(a).toNonIndexed()); }
      const cosmosG = cupped(mergeGeometries(cosmos), 6);
      const tulipG = new THREE.LatheGeometry([[0.001, -0.02], [0.03, -0.015], [0.045, 0.02], [0.05, 0.06], [0.04, 0.09]].map(([a, b]) => new THREE.Vector2(a, b)), 6); { const p = tulipG.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i); if (y > 0.07) p.setY(i, y + Math.max(0, Math.cos(a * 3)) * 0.022); } tulipG.computeVertexNormals(); }
      const roseG = mergeGeometries([0.025, 0.04, 0.055].map((r, k) => { const g = new THREE.LatheGeometry([[0.001, 0], [r * 0.6, 0.004], [r, 0.02 + k * 0.006], [r * 0.9, 0.035 + k * 0.004]].map(([a, b]) => new THREE.Vector2(a, b)), 10); const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), w = 1 + Math.sin(a * 5 + k) * 0.12; p.setX(i, p.getX(i) * w); p.setZ(i, p.getZ(i) * w); } return g.toNonIndexed().translate(0, -k * 0.012, 0); }));
      roseG.computeVertexNormals();
      flowers.forEach((f, i) => { f.kind = i % 7 < 3 ? 0 : i % 7 < 5 ? 1 : 2; });
      [cosmosG, tulipG, roseG].forEach((g, k) => inst(g, bloomM('#ffffff' + ['', 'f', 'e'][k].slice(0, 0)), flowers.filter(f => f.kind === k), { cast: false }));
      const heart = flowers.filter(f => f.kind === 0), center = heart.length ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), matte('#F2C14E', 0.5), heart.length) : null;
      if (center) { heart.forEach((f, i) => center.setMatrixAt(i, _m.compose(V(f.p.x, f.p.y + 0.02, f.p.z), _q.identity(), V(f.s, f.s * 0.6, f.s)))); root.add(center); }
      const stem = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(0.004, 0.006, 1, 4).translate(0, -0.5, 0).toNonIndexed(), new THREE.PlaneGeometry(0.03, 0.09).rotateZ(0.6).translate(0.025, -0.55, 0).toNonIndexed(), new THREE.PlaneGeometry(0.03, 0.09).rotateZ(-0.6).translate(-0.025, -0.7, 0).rotateY(1.7).toNonIndexed()]), foliage('#4E7E3E', 0.8, 0.02), flowers.length);
      flowers.forEach((f, i) => stem.setMatrixAt(i, _m.compose(f.p, _q.setFromEuler(_e.set(0, f.r, 0)), V(f.s, Math.max(0.05, f.p.y - (f.base ?? 0)), f.s)))); stem.material.side = THREE.DoubleSide; root.add(stem);
      const tuft = []; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; tuft.push(new THREE.ConeGeometry(0.035, R(0.3, 0.45), 3).translate(0, 0.17, 0).rotateZ(0.25).rotateY(a).toNonIndexed()); }
      inst(mergeGeometries(tuft), foliage('#ffffff', 0.85, 0.08), tufts, { cast: false });
      { // distant forest: firs, round broadleaf crowns (some turning gold and rust) and dark cypress spires
        const smooth = (parts) => { const g = mergeVertices(mergeGeometries(parts.map(q => { q.deleteAttribute('uv'); q.deleteAttribute('normal'); return q; }))); g.computeVertexNormals(); return g; };
        const lump = (r, y, ox = 0, oz = 0, det = 1) => { const q = new THREE.IcosahedronGeometry(r, det); const p = q.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 9.1 + p.getY(i) * 7.3) * 0.08; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } return q.translate(ox, y, oz); };
        const fir = smooth([new THREE.ConeGeometry(1, 1.6, 10, 2).translate(0, 1.6, 0), new THREE.ConeGeometry(0.8, 1.4, 10, 2).translate(0, 2.5, 0), new THREE.CylinderGeometry(0.15, 0.2, 0.9, 6).translate(0, 0.45, 0)]);
        const broad = mergeGeometries([lump(1.0, 1.9), lump(0.75, 2.3, 0.55, 0.2, 0), lump(0.7, 2.1, -0.5, -0.3, 0),   // side lumps at low detail: they're only ever seen at a distance
           new THREE.CylinderGeometry(0.12, 0.18, 1.3, 6).translate(0, 0.65, 0).toNonIndexed()].map(q => (q.index ? q.toNonIndexed() : q)));
        const spire = smooth([new THREE.CapsuleGeometry(0.45, 2.6, 4, 10).translate(0, 2.0, 0)]);
        const fm = matte('#ffffff', 0.95);
        [fir, broad, spire].forEach((g, k) => inst(g, fm, far.filter(f => f.t === k), { cast: false, receive: false })); }
      return root;
    },
  };
  return api;
}

// leaf-card textures (alpha): a spray of leaves, or of five-petal blossoms; greys so the instance colour tints them
// leaf textures, 512 px: shaded leaves with a midrib and side veins (lighter at the tip, darker at the stalk,
// drawn back to front so the ones behind sit in shade), five-petal sakura with notched petals, a blush toward the
// centre and golden stamens, plus buds; soft alpha edges feed alpha-to-coverage for clean anti-aliased cut-outs
function leafTex(kind) {
  const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
  const leaf = (x, y, a, l, w, v) => { g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(-l / 2, 0, l / 2, 0); gr.addColorStop(0, `rgb(${v * 0.7 | 0},${v * 0.72 | 0},${v * 0.66 | 0})`); gr.addColorStop(0.6, `rgb(${v},${v},${v * 0.95 | 0})`); gr.addColorStop(1, `rgb(${Math.min(255, v * 1.08) | 0},${Math.min(255, v * 1.08) | 0},${v * 0.92 | 0})`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(-l / 2, 0); g.bezierCurveTo(-l * 0.2, -w * 1.1, l * 0.25, -w * 0.9, l / 2, 0); g.bezierCurveTo(l * 0.25, w * 0.9, -l * 0.2, w * 1.1, -l / 2, 0); g.fill();
    g.strokeStyle = 'rgba(40,46,36,.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-l / 2, 0); g.lineTo(l / 2, 0); g.stroke();
    g.lineWidth = 0.9; g.strokeStyle = 'rgba(40,46,36,.22)'; for (let k = 1; k < 5; k++) { const t = -l / 2 + k * l / 5; g.beginPath(); g.moveTo(t, 0); g.lineTo(t + l * 0.12, -w * 0.62); g.moveTo(t, 0); g.lineTo(t + l * 0.12, w * 0.62); g.stroke(); }
    g.restore(); };
  if (kind === 'leaf') for (let i = 0; i < 120; i++) { const depth = i / 120; leaf(R(36, n - 36), R(36, n - 36), R(0, TAU), R(46, 72), R(15, 24), Math.floor(130 + depth * 120 + R(-10, 10))); }
  else if (kind === 'needle') for (let i = 0; i < 70; i++) { const x = R(40, n - 40), y = R(40, n - 40), a = R(0, TAU), v = Math.floor(R(140, 235));
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 3.2; g.lineCap = 'round'; for (let k = -7; k <= 7; k++) { const along = k * 4.6, bx = x + Math.cos(a) * along, by = y + Math.sin(a) * along;
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + sd * 1.05) * 24, by + Math.sin(a + sd * 1.05) * 24); g.stroke(); } } }
  else if (kind === 'strand' || kind === 'blossomStrand') { // hanging racemes: separate florets (or willow leaves) with gaps, tapering toward the tip
    const bl = kind === 'blossomStrand';
    for (let col = 0; col < 11; col++) { const x0 = 22 + col * 45 + R(-8, 8), len = R(0.6, 1) * n; let y = R(0, 24);
      while (y < len - 10) { const taper = 1 - y / len * 0.65, sz = (bl ? R(6, 9) : R(7, 11)) * taper, v = Math.floor(R(175, 255)), x = x0 + Math.sin(y * 0.025 + col) * 6;
        if (bl) for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + y; const gr = g.createRadialGradient(x + Math.cos(a) * sz * 0.5, y + Math.sin(a) * sz * 0.4, 0, x + Math.cos(a) * sz * 0.5, y + Math.sin(a) * sz * 0.4, sz * 0.75);
            gr.addColorStop(0, `rgb(255,${v},255)`); gr.addColorStop(1, `rgb(${v * 0.75 | 0},${v * 0.62 | 0},${v * 0.9 | 0})`); g.fillStyle = gr; g.beginPath(); g.ellipse(x + Math.cos(a) * sz * 0.5, y + Math.sin(a) * sz * 0.4, sz * 0.62, sz * 0.48, a, 0, TAU); g.fill(); }
        else { g.fillStyle = `rgb(${v},${v},${v * 0.92 | 0})`; g.beginPath(); g.ellipse(x + R(-3, 3), y, sz * 0.32, sz, R(-0.5, 0.5), 0, TAU); g.fill(); }
        y += sz * (bl ? 1.75 : 1.9); } } }
  else { // sakura: five notched petals, white at the tips blushing pink toward the centre, golden stamens; a few buds
    for (let i = 0; i < 95; i++) { const x = R(26, n - 26), y = R(26, n - 26), r = R(13, 21), a0 = R(0, TAU), v = R(0.82, 1), depth = i / 95;
      if (Math.random() < 0.12) { g.fillStyle = `rgb(${235 * v | 0},${150 * v | 0},${180 * v | 0})`; g.beginPath(); g.ellipse(x, y, r * 0.3, r * 0.42, a0, 0, TAU); g.fill(); continue; }
      for (let k = 0; k < 5; k++) { const a = a0 + k / 5 * TAU; g.save(); g.translate(x, y); g.rotate(a);
        const gr = g.createLinearGradient(0, 0, r, 0); gr.addColorStop(0, `rgb(${246 * v | 0},${168 * v | 0},${196 * v | 0})`); gr.addColorStop(0.55, `rgb(${255 * v | 0},${222 * v | 0},${234 * v | 0})`); gr.addColorStop(1, `rgb(${255 * v | 0},${246 * v | 0},${248 * v | 0})`);
        g.fillStyle = gr; g.globalAlpha = 0.75 + depth * 0.25; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(r * 0.35, -r * 0.42, r * 0.9, -r * 0.38, r, -r * 0.08); g.lineTo(r * 0.86, 0); g.lineTo(r, r * 0.08); g.bezierCurveTo(r * 0.9, r * 0.38, r * 0.35, r * 0.42, 0, 0); g.fill(); g.restore(); }
      g.globalAlpha = 1; g.fillStyle = 'rgb(255,214,140)'; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22, 1.6, 0, TAU); g.fill(); } } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export { createVegetation };
