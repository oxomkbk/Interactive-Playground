/* =========================================================================
   PROPS — street furniture that fills the park: ornamental lamps (painted posts, gold scrolls, glowing
   lantern glass), wood-and-iron benches, stone planters overflowing with flowers, the perimeter hedge, and
   the anchor points for string lights. All merged per material (a few draw calls for hundreds of pieces).
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBatch } from '../core/batch.js';
import { rbox, rodGeo, R } from '../core/geo.js';
import { paint, gold, wood, stone, lampGlass, foliage } from '../core/materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;

function createProps(veg, lights) {
  const B = createBatch('props'), glassG = [], heads = [], lit = [];
  const post = paint('#4B3A5E', 0.5), g = gold(), glass = lampGlass('#FFD9A8', 2.4), bench = wood('#B07C55', 1), iron = paint('#3F3350', 0.55), planterM = stone(1, '#E6D9CA');
  const c = { cast: true };
  const tf = (x, z, ry = 0, y = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));

  const api = {
    // a Victorian-fairytale lamp: fluted post, gold collar & scrolls, a lantern with a heart finial
    lamp(x, z, { light = false, double = false, ry = 0 } = {}) {
      const m = tf(x, z, ry), at = (geo) => geo.applyMatrix4(m); api.posts.push({ x, z });
      B.add(at(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 12).translate(0, 0.17, 0)), post, null, c);
      B.add(at(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 10).translate(0, 2.0, 0)), post, null, c);
      B.add(at(new THREE.TorusGeometry(0.12, 0.03, 6, 16).rotateX(PI / 2).translate(0, 1.2, 0)), g);
      const arms = double ? [-1, 1] : [0];
      for (const s of arms) { const ox = s * 0.55, top = 3.75;
        if (s) B.add(at(new THREE.TorusGeometry(0.3, 0.025, 6, 18, PI).rotateY(s > 0 ? 0 : PI).translate(s * 0.28, top - 0.05, 0)), g);
        B.add(at(new THREE.ConeGeometry(0.22, 0.2, 6).translate(ox, top + 0.42, 0)), post, null, c);
        B.add(at(new THREE.SphereGeometry(0.05, 8, 6).translate(ox, top + 0.56, 0)), g);
        glassG.push(at(new THREE.CylinderGeometry(0.17, 0.12, 0.42, 6).translate(ox, top + 0.13, 0)));
        B.add(at(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 6).translate(ox, top - 0.1, 0)), g);
        heads.push(V(x + Math.cos(ry) * ox, top + 0.13, z - Math.sin(ry) * ox)); }
      if (light && lights) lit.push(lights.addLocal(V(x, 3.9, z), '#FFC994', 26, 16));
      return heads[heads.length - 1];
    },
    // bench facing direction ry (its seat looks along local +z)
    bench(x, z, ry = 0) {
      const m = tf(x, z, ry), at = (geo) => geo.applyMatrix4(m); api.benches.push({ x, z, ry });
      for (let i = 0; i < 4; i++) B.add(at(rbox(1.9, 0.05, 0.13, 0.02, 2).translate(0, 0.5, -0.24 + i * 0.16)), bench, null, c);
      for (let i = 0; i < 3; i++) B.add(at(rbox(1.9, 0.12, 0.04, 0.02, 2).translate(0, 0.72 + i * 0.16, -0.32 - i * 0.03)), bench, null, c);
      for (const s of [-1, 1]) { B.add(at(new THREE.TorusGeometry(0.3, 0.035, 6, 16, PI).rotateY(PI / 2).translate(s * 0.88, 0.42, 0)), iron, null, c);
        B.add(at(rodGeo(V(s * 0.88, 0, -0.3), V(s * 0.88, 1.12, -0.38), 0.035, 6)), iron, null, c); B.add(at(rodGeo(V(s * 0.88, 0, 0.28), V(s * 0.88, 0.5, 0.25), 0.035, 6)), iron, null, c);
        B.add(at(new THREE.SphereGeometry(0.05, 8, 6).translate(s * 0.88, 1.14, -0.38)), g); }
    },
    planter(x, z, r = 0.9, h = 0.6) {
      B.add(new THREE.CylinderGeometry(r, r * 0.8, h, 16).translate(x, h / 2, z), planterM, null, c);
      B.add(new THREE.TorusGeometry(r, 0.06, 6, 24).rotateX(PI / 2).translate(x, h, z), planterM);
      veg.bed(x, z, r * 0.85, 22, undefined, { y: h - 0.05 }); veg.bush(x, z, r * 0.9, undefined, h - 0.25);
    },
    hedgeRing(r, gapAngle = 0.12, gapAt = 0, gap2 = null) {
      const n = Math.floor(TAU * r / 1.4); const items = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU, d = Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt)); if (Math.abs(d) < gapAngle) continue; if (gap2 && Math.abs(Math.atan2(Math.sin(a - gap2[0]), Math.cos(a - gap2[0]))) < gap2[1]) continue; items.push(a); }
      // clipped box hedge: a dense leaf texture (and a bump from it) so it reads as clipped foliage, not painted plastic
      const hedgeM = foliage('#5E9E62', 0.9, 0.01).clone(); hedgeM.onBeforeCompile = foliage('#5E9E62', 0.9, 0.01).onBeforeCompile; hedgeM.customProgramCacheKey = () => 'hedge';
      { const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'); g.fillStyle = '#3c3c3c'; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 1400; i++) { const x = Math.random() * n, y = Math.random() * n, l = 5 + Math.random() * 7, v = 90 + Math.random() * 165 | 0; g.save(); g.translate(x, y); g.rotate(Math.random() * 6.28);
          g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(0, 0, l, l * 0.45, 0, 0, 6.28); g.fill(); g.restore(); }
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.anisotropy = 8;
        hedgeM.map = t; hedgeM.bumpMap = t; hedgeM.bumpScale = 2.5; hedgeM.roughness = 1; }
      const hedge = new THREE.InstancedMesh(rbox(1.6, 1.3, 1.0, 0.35, 2), hedgeM, items.length), mm = new THREE.Matrix4(), col = new THREE.Color();
      items.forEach((a, i) => { hedge.setMatrixAt(i, mm.compose(V(Math.sin(a) * r, 0.62, Math.cos(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a + PI / 2, 0)), V(1, R(0.9, 1.1), 1))); hedge.setColorAt(i, col.set(['#5E9E62', '#64A566', '#579660'][i % 3])); });
      hedge.castShadow = hedge.receiveShadow = true; api.extra.push(hedge);
    },
    extra: [], heads, lit, posts: [], benches: [],
    build(parent) {
      const root = B.build(parent);
      if (glassG.length) { const gm = new THREE.Mesh(mergeAll(glassG), glass); gm.castShadow = false; root.add(gm); }
      for (const e of api.extra) root.add(e);
      return root;
    },
  };
  return api;
}

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const mergeAll = (arr) => mergeGeometries(arr.map(g => (g.index ? g.toNonIndexed() : g)));

export { createProps };
