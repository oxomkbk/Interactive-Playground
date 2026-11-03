/* =========================================================================
   TREES — a small botanical generator. Each species grows from rules (trunk height and girth, how many
   branches split off, how far they spread, whether they reach up, droop or whorl, leaf size and kind), and
   three individuals of every species are grown from different seeds, so neighbouring trees differ in
   silhouette as well as colour. A tree is a tapered, bending trunk-and-branch mesh plus "anchors": where
   foliage clusters sit (broad leaves, blossom, needles, or hanging strands for willows and wisteria).
   ========================================================================= */
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2, UP = V(0, 1, 0);

const SPECIES = {
  oak:      { h: 3.0, r: 0.34, depth: 3, kids: [3, 4], spread: 0.8, lenK: 0.62, up: 0.12, gnarl: 0.35, leaf: 1.55, kind: 'leaf', bark: '#6E5446', cols: ['#4F7F3F', '#5E8E45', '#6E9A4C', '#476F3A', '#7FA454'] },
  cherry:   { h: 2.1, r: 0.25, depth: 3, kids: [3, 3], spread: 1.0, lenK: 0.68, up: 0.02, gnarl: 0.4, leaf: 1.2, kind: 'blossom', bark: '#5E4038', cols: ['#F7B8CA', '#F2A2BA', '#FBD0DC', '#FFE4EC', '#EE94AE'] },
  maple:    { h: 2.8, r: 0.27, depth: 3, kids: [3, 3], spread: 0.65, lenK: 0.6, up: 0.18, gnarl: 0.3, leaf: 1.3, kind: 'leaf', bark: '#5E4A40', cols: ['#D9583A', '#E8873A', '#F2B544', '#C7402F', '#E36F3C'] },
  birch:    { h: 5.2, r: 0.14, depth: 2, kids: [4, 5], spread: 0.45, lenK: 0.42, up: 0.3, gnarl: 0.18, leaf: 0.95, kind: 'leaf', bark: '#EFEAE2', cols: ['#9BC46A', '#B4D27A', '#D2D57A', '#8DBB62'] },
  willow:   { h: 3.2, r: 0.32, depth: 2, kids: [6, 7], spread: 1.15, lenK: 0.55, up: 0.25, gnarl: 0.25, leaf: 1.1, kind: 'willow', bark: '#5C4A3E', cols: ['#9DBE6A', '#B0CC7A', '#8CB25E', '#C2D688'] },
  wisteria: { h: 2.5, r: 0.22, depth: 3, kids: [3, 3], spread: 0.95, lenK: 0.62, up: 0.05, gnarl: 0.45, leaf: 1.0, kind: 'wisteria', bark: '#5A4640', cols: ['#B9A0E6', '#9F86D8', '#D8C6F4', '#C6A8EC'] },
  pine:     { h: 7.0, r: 0.24, depth: 0, kids: [5, 6], spread: 0, lenK: 0, up: 0, gnarl: 0.05, leaf: 1.1, kind: 'needle', bark: '#5A4236', cols: ['#2F5E3E', '#3A6B47', '#294F37', '#41704A'], whorls: 6 },
  cypress:  { h: 0.9, r: 0.18, depth: 0, kids: [0, 0], spread: 0, lenK: 0, up: 0, gnarl: 0, leaf: 1.0, kind: 'needle', bark: '#5A4236', cols: ['#35583A', '#3E6342', '#2F4F36'], column: 7.5 },
};

// a tube that bends through `pts` and narrows from r0 to r1
function taperTube(pts, r0, r1, radial = 6, segs = 0) {
  const curve = new THREE.CatmullRomCurve3(pts), n = segs || Math.max(3, pts.length * 2), frames = curve.computeFrenetFrames(n, false);
  const pos = [], idx = [], nrm = [], uv = [];
  for (let i = 0; i <= n; i++) { const u = i / n, c = curve.getPointAt(u), r = r0 + (r1 - r0) * u, N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) { const a = j / radial * TAU, cx = Math.cos(a), sx = Math.sin(a);
      const nx = cx * N.x + sx * B.x, ny = cx * N.y + sx * B.y, nz = cx * N.z + sx * B.z;
      pos.push(c.x + nx * r, c.y + ny * r, c.z + nz * r); nrm.push(nx, ny, nz); uv.push(j / radial, u * curve.getLength() / 1.2); } }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// grow one individual: { geo (trunk + branches), anchors: [{ p, s, kind }] }
function grow(name, seed) {
  const sp = SPECIES[name], R = rng(seed), rr = (a, b) => a + (b - a) * R(), tubes = [], anchors = [];
  const jitter = () => V(rr(-1, 1), rr(-0.3, 0.3), rr(-1, 1));
  function branch(start, dir, len, rad, depth) {
    const segs = 4, pts = [start.clone()]; let p = start.clone(); const d = dir.clone();
    for (let i = 1; i <= segs; i++) {
      d.addScaledVector(jitter(), sp.gnarl * 0.35).addScaledVector(UP, sp.up * 0.4);
      if (sp.kind === 'willow' && depth > 0) d.y -= 0.18 * i;                            // willow limbs arch over
      d.normalize(); p = p.clone().addScaledVector(d, len / segs); pts.push(p);
    }
    tubes.push(taperTube(pts, rad, rad * (depth >= sp.depth ? 0.25 : 0.55), depth === 0 ? 7 : depth === 1 ? 5 : 4, depth >= 2 ? 4 : 0));
    if (depth >= sp.depth) { anchors.push({ p: p.clone(), s: sp.leaf * rr(0.85, 1.2), kind: sp.kind }); return; }
    const n = Math.floor(rr(sp.kids[0], sp.kids[1] + 0.999)), a0 = rr(0, TAU);
    for (let k = 0; k < n; k++) {
      const t = depth === 0 ? rr(0.55, 1) : rr(0.45, 1), at = new THREE.CatmullRomCurve3(pts).getPointAt(t);
      const ax = V(Math.cos(a0 + k / n * TAU), 0, Math.sin(a0 + k / n * TAU));
      const nd = d.clone().applyAxisAngle(V(-ax.z, 0, ax.x), sp.spread * rr(0.75, 1.15)).normalize();
      branch(at, nd, len * sp.lenK * rr(0.85, 1.15), rad * 0.62, depth + 1);
    }
    if (depth >= 1) anchors.push({ p: pts[2].clone(), s: sp.leaf * rr(0.7, 0.95), kind: sp.kind });   // fill the inside of the crown
  }
  if (sp.whorls) {                                                                         // conifer: straight trunk, rings of drooping limbs
    const pts = [V(0, 0, 0), V(rr(-0.1, 0.1), sp.h * 0.5, rr(-0.1, 0.1)), V(0, sp.h, 0)]; tubes.push(taperTube(pts, sp.r, sp.r * 0.15, 7));
    for (let w = 0; w < sp.whorls; w++) { const y = 1.3 + w * (sp.h - 1.3) / sp.whorls, reach = (1 - w / sp.whorls) * 2.1 + 0.4, n = Math.floor(rr(...sp.kids));
      for (let k = 0; k < n; k++) { const a = k / n * TAU + rr(-0.3, 0.3) + w, dx = Math.cos(a), dz = Math.sin(a), e = V(dx * reach, y - reach * 0.35, dz * reach);
        tubes.push(taperTube([V(0, y, 0), V(dx * reach * 0.5, y - reach * 0.08, dz * reach * 0.5), e], sp.r * 0.3, 0.02, 4));
        anchors.push({ p: e, s: sp.leaf * (0.75 + reach * 0.25), kind: 'needle' }, { p: V(dx * reach * 0.5, y, dz * reach * 0.5), s: sp.leaf * 0.85, kind: 'needle' }); } }
    anchors.push({ p: V(0, sp.h + 0.2, 0), s: 0.8, kind: 'needle' });
  } else if (sp.column) {                                                                  // cypress: a dense green flame
    tubes.push(taperTube([V(0, 0, 0), V(0, sp.h, 0)], sp.r, sp.r * 0.6, 6));
    for (let i = 0; i < 16; i++) { const u = i / 15, y = sp.h + u * sp.column, w = Math.sin(Math.min(1, u * 1.4 + 0.15) * Math.PI) * 0.75 + 0.2;
      for (let k = 0; k < 2; k++) { const a = rr(0, TAU); anchors.push({ p: V(Math.cos(a) * w * 0.35, y, Math.sin(a) * w * 0.35), s: 0.55 + w * 0.6, kind: 'needle' }); } }
  } else branch(V(0, 0, 0), V(rr(-0.12, 0.12), 1, rr(-0.12, 0.12)).normalize(), sp.h, sp.r, 0);
  // root flare
  tubes.push(new THREE.ConeGeometry(sp.r * 1.9, sp.r * 3, 8, 1, true).translate(0, sp.r * 1.2, 0));
  const geo = mergeAll(tubes);
  return { geo, anchors };
}

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const mergeAll = (arr) => mergeGeometries(arr.map(g => { const q = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }));

export { SPECIES, grow };
