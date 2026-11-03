/* =========================================================================
   ARCH — an architecture kit, so landmarks are assembled from real building parts rather than raw primitives:
   fluted columns with bases and capitals · balustrades with turned balusters · stone-framed windows (glowing
   arched glass, sill, keystone, optional pediment) · cornices and string courses · steep dormers · flared conical
   spires with eaves rings · ogee/onion domes with drums and lanterns · crenellations with corbels.
   Every function adds geometry to a batch B (core/batch.js) in the caller's local space.
   ========================================================================= */
import * as THREE from 'three';
import { rodGeo, rbox, heartGeo } from '../core/geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// an arched opening outline (unit width w, height h), as a flat shape facing +z
function archShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, PI, false); s.lineTo(-w / 2, 0); return s; }
function archPane(w, h) { const g = new THREE.ShapeGeometry(archShape(w, h), 12), uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h); return g; }

function createKit(M) {
  // M: { stone, trim, wall, roof, gold, glass (lit window), dark, metal }
  const K = {
    // a column: plinth, base torus, fluted shaft, capital with abacus
    column(B, x, y, z, h, r = 0.35, flutes = 16) {
      B.add(rbox(r * 2.6, r * 0.8, r * 2.6, r * 0.1, 1).translate(x, y + r * 0.4, z), M.stone, null, { cast: true });
      B.add(new THREE.TorusGeometry(r * 1.08, r * 0.18, 6, 24).rotateX(PI / 2).translate(x, y + r * 0.95, z), M.stone);
      const shaft = new THREE.CylinderGeometry(r * 0.9, r, h - r * 2.6, flutes * 2, 1); const p = shaft.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 - 0.05 * (0.5 + 0.5 * Math.cos(a * flutes)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } shaft.computeVertexNormals();
      B.add(shaft.translate(x, y + r * 1.1 + (h - r * 2.6) / 2, z), M.trim, null, { cast: true });
      B.add(lathe([[0.001, 0], [r * 0.95, 0], [r * 1.35, r * 0.6], [r * 1.5, r * 0.75], [0.001, r * 0.75]], 24).translate(x, y + h - r * 1.5, z), M.trim, null, { cast: true });
      B.add(rbox(r * 3.1, r * 0.35, r * 3.1, r * 0.06, 1).translate(x, y + h - r * 0.6, z), M.stone, null, { cast: true });
    },
    // a balustrade from a to b (top rail height hgt)
    balustrade(B, a, b, hgt = 1.0, gap = 0.32) {
      const d = b.clone().sub(a), len = d.length(), n = Math.max(2, Math.floor(len / gap)), ang = Math.atan2(d.x, d.z);
      const rail = (y, t) => B.add(rbox(t * 1.6, t, len, t * 0.2, 1).rotateY(ang).translate((a.x + b.x) / 2, y, (a.z + b.z) / 2), M.stone, null, { cast: true });
      rail(a.y + 0.08, 0.16); rail(a.y + hgt, 0.14);
      const bal = lathe([[0.001, 0], [0.07, 0], [0.05, 0.12], [0.09, hgt * 0.35], [0.045, hgt * 0.62], [0.06, hgt * 0.72], [0.06, hgt - 0.08], [0.001, hgt - 0.08]], 10);
      for (let i = 1; i < n; i++) { const p = a.clone().lerp(b, i / n); B.add(bal.clone().translate(p.x, p.y + 0.08, p.z), M.trim); }
    },
    // a window bay on a wall facing +z at (x, y, z): glowing arched glass, a stone frame, sill and keystone, an optional pediment
    window(B, x, y, z, w = 1.1, h = 2.2, { pediment = false, ry = 0 } = {}) {
      const T = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z), at = (g) => g.applyMatrix4(T);
      B.add(at(archPane(w, h).translate(0, 0, 0.02)), M.glass);
      const fr = 0.14; B.add(at(rbox(fr, h - w / 2, fr, 0.03, 1).translate(-w / 2 - fr / 2, (h - w / 2) / 2, 0.06)), M.trim); B.add(at(rbox(fr, h - w / 2, fr, 0.03, 1).translate(w / 2 + fr / 2, (h - w / 2) / 2, 0.06)), M.trim);
      B.add(at(new THREE.TorusGeometry(w / 2 + fr / 2, fr / 2, 6, 16, PI).translate(0, h - w / 2, 0.06)), M.trim);
      B.add(at(rbox(w + 0.5, 0.14, 0.32, 0.03, 1).translate(0, -0.07, 0.12)), M.stone); B.add(at(rbox(0.22, 0.3, 0.16, 0.03, 1).translate(0, h + 0.05, 0.09)), M.stone);
      B.add(at(rbox(0.04, h - w / 2, 0.04, 0.01, 1).translate(0, (h - w / 2) / 2, 0.05)), M.dark); B.add(at(rbox(w, 0.04, 0.04, 0.01, 1).translate(0, (h - w / 2) * 0.55, 0.05)), M.dark);
      if (pediment) { const s = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.35, 0), new THREE.Vector2(w / 2 + 0.35, 0), new THREE.Vector2(0, 0.55)]); B.add(at(new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false }).translate(0, h + 0.28, 0.02)), M.stone, null, { cast: true }); }
    },
    // a cornice band along x (from x0 to x1) at height y on a face at z (facing +z, rotated by ry)
    cornice(B, x0, x1, y, z, ry = 0, deep = 0.45) {
      const T = new THREE.Matrix4().makeRotationY(ry), L = x1 - x0, cx = (x0 + x1) / 2;
      B.add(rbox(L + deep, 0.22, deep, 0.05, 1).translate(cx, y, z + deep / 2 - 0.05).applyMatrix4(T), M.stone, null, { cast: true });
      B.add(rbox(L + deep * 0.6, 0.14, deep * 0.7, 0.04, 1).translate(cx, y - 0.18, z + deep * 0.35 - 0.05).applyMatrix4(T), M.trim);
    },
    // a steep dormer on a roof: front gable with a glowing window, small roof, finial
    dormer(B, x, y, z, ry = 0, s = 1) {
      const T = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z), at = (g) => g.applyMatrix4(T);
      B.add(at(rbox(1.3 * s, 1.6 * s, 1.4 * s, 0.05, 1).translate(0, 0.8 * s, 0)), M.wall, null, { cast: true });
      const gable = new THREE.Shape([new THREE.Vector2(-0.8 * s, 0), new THREE.Vector2(0.8 * s, 0), new THREE.Vector2(0, 1.1 * s)]);
      B.add(at(new THREE.ExtrudeGeometry(gable, { depth: 1.6 * s, bevelEnabled: false }).translate(0, 1.6 * s, -0.8 * s)), M.roof, null, { cast: true });
      B.add(at(archPane(0.6 * s, 1.0 * s).translate(0, 0.35 * s, 0.71 * s)), M.glass);
      B.add(at(rodGeo(V(0, 2.65 * s, 0.7 * s), V(0, 3.2 * s, 0.7 * s), 0.03 * s, 5)), M.gold);
    },
    // a round tower roof: a flared cone with an eaves ring, a band of tiny dormers and a finial
    spire(B, x, y, z, r, h, { dormers = 4, finial = true } = {}) {
      B.add(lathe([[r * 1.18, 0], [r * 1.05, h * 0.06], [r * 0.82, h * 0.2], [r * 0.5, h * 0.48], [r * 0.2, h * 0.78], [0.04, h]], 32).translate(x, y, z), M.roof, null, { cast: true });
      B.add(new THREE.TorusGeometry(r * 1.17, 0.07, 6, 40).rotateX(PI / 2).translate(x, y + 0.02, z), M.gold);
      for (let k = 0; k < dormers; k++) { const a = k / dormers * TAU + PI / dormers, dr = r * 0.78; K.dormer(B, x + Math.sin(a) * dr, y + h * 0.14, z + Math.cos(a) * dr, a, Math.max(0.35, r * 0.18)); }
      if (finial) { B.add(rodGeo(V(x, y + h - 0.1, z), V(x, y + h + 1.4, z), 0.05, 6), M.gold); B.add(new THREE.SphereGeometry(0.14, 12, 8).translate(x, y + h + 0.7, z), M.gold); }
    },
    // an onion / ogee dome on a drum, with a little lantern
    dome(B, x, y, z, r) {
      B.add(new THREE.CylinderGeometry(r * 0.9, r * 0.95, r * 0.6, 32).translate(x, y + r * 0.3, z), M.wall, null, { cast: true });
      B.add(lathe([[r, 0], [r * 1.06, r * 0.35], [r * 0.95, r * 0.8], [r * 0.6, r * 1.2], [r * 0.22, r * 1.5], [r * 0.08, r * 1.7], [0.001, r * 1.75]], 40).translate(x, y + r * 0.6, z), M.roof, null, { cast: true });
      B.add(new THREE.TorusGeometry(r * 0.96, 0.05, 6, 32).rotateX(PI / 2).translate(x, y + r * 0.62, z), M.gold);
      B.add(rodGeo(V(x, y + r * 2.3, z), V(x, y + r * 2.3 + 1.2, z), 0.05, 6), M.gold); B.add(heartGeo(0.3, 0.1).translate(x, y + r * 2.3 + 1.45, z), M.gold);
    },
    // crenellations with corbels along a straight wall top
    battlements(B, a, b, y, thick = 1.2) {
      const d = b.clone().sub(a), len = d.length(), ang = Math.atan2(d.x, d.z), n = Math.floor(len / 1.3);
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n);
        B.add(rbox(0.5, 0.35, thick * 0.35, 0.04, 1).rotateY(ang + PI / 2).translate(p.x, y - 0.25, p.z), M.stone);
        if (i % 2 === 0) B.add(rbox(0.75, 0.75, thick, 0.06, 1).rotateY(ang + PI / 2).translate(p.x, y + 0.38, p.z), M.wall, null, { cast: true }); }
    },
  };
  return K;
}

export { createKit, archPane, lathe };
