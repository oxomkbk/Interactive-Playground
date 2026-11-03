/* =========================================================================
   FANTASY GARDEN — south-west of the plaza: a koi pond with lily pads and lotus blooms, an arched wooden
   bridge, stepping stones, a rose arch, mossy rocks, glowing mushrooms that light up at night, small stone
   lanterns, and cherry and wisteria trees all around.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBatch } from '../core/batch.js';
import { rodGeo, sweep, R, rand, pick } from '../core/geo.js';
import { stone, wood, water, glow, matte, lampGlass, paint } from '../core/materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;

function createGarden(veg, props, lights) {
  const { x: gx, z: gz } = CONFIG.layout.garden, root = new THREE.Group(); root.name = 'garden';
  const B = createBatch('garden'), c = { cast: true };
  // pond: an organic outline, sunk slightly, water surface + a stone rim of rounded rocks
  const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, r = 1 + Math.sin(a * 3 + 1) * 0.12 + Math.sin(a * 5) * 0.06; pts.push(new THREE.Vector2(Math.cos(a) * 10 * r, Math.sin(a) * 6.5 * r)); }
  const shape = new THREE.Shape(pts);
  B.add(new THREE.ShapeGeometry(shape, 24).rotateX(-PI / 2).translate(gx, -0.45, gz), matte('#1E3A44', 0.9)); // the pond bed, half a metre down in its basin
  const pond = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24).rotateX(-PI / 2).translate(gx, 0.1, gz), water('#5FA9B5', 3)); pond.receiveShadow = true; root.add(pond);
  const rocks = createBatch('rocks'), rockM = stone(1, '#CFC3B8');
  pts.forEach((p, i) => { if (i % 2) return; const g = new THREE.IcosahedronGeometry(R(0.45, 0.8), 1); g.scale(1.2, 0.55, 1); rocks.add(g, rockM, [gx + p.x * 1.03, 0.12, gz - p.y * 1.03], { rotY: R(0, TAU), cast: true }); });
  // lily pads with lotus blooms
  for (let i = 0; i < 22; i++) { const a = rand() * TAU, r = Math.sqrt(rand()) * 0.75, x = gx + Math.cos(a) * 10 * r, z = gz + Math.sin(a) * 6.5 * r; if (Math.abs(x - gx) < 2.2) continue;
    B.add(new THREE.CircleGeometry(R(0.35, 0.6), 16, 0.3, TAU - 0.5).rotateX(-PI / 2).rotateY(R(0, TAU)).translate(x, 0.13, z), matte('#5E9E62', 0.6));
    if (i % 3 === 0) veg.bed(x, z, 0.05, 1, ['#FFB3C6', '#FFF5E1'], { y: 0.0 }); }
  // the arched bridge (crosses the pond north–south at its middle)
  const span = new THREE.CatmullRomCurve3([V(gx, 0.15, gz + 8.5), V(gx, 2.1, gz + 3.5), V(gx, 2.75, gz), V(gx, 2.1, gz - 3.5), V(gx, 0.15, gz - 8.5)]); // a tall moon bridge, so swan boats glide under it
  const deck = [[-1.1, 0], [-1.1, 0.12], [1.1, 0.12], [1.1, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  B.add(sweep(span, deck, 40), wood('#B4875E', 2), null, c);
  for (let i = 0; i <= 14; i++) { const p = span.getPointAt(i / 14); for (const s of [-1.05, 1.05]) B.add(rodGeo(V(p.x + s, p.y + 0.1, p.z), V(p.x + s, p.y + 1.0, p.z), 0.05, 6), wood('#8A5A44'), null, c); }
  for (const s of [-1.05, 1.05]) { const rail = new THREE.CatmullRomCurve3(span.points.map(p => V(p.x + s, p.y + 1.0, p.z))); B.add(new THREE.TubeGeometry(rail, 40, 0.06, 6), wood('#8A5A44'), null, c); }
  // rose arch at the garden's path entrance, and stepping stones
  const archC = new THREE.Vector3(gx + 13, 0, gz - 9);
  for (let i = 0; i <= 12; i++) { const a = i / 12 * PI, x = archC.x + Math.cos(a) * 1.6, y = 0.2 + Math.sin(a) * 2.8; veg.bed(x, archC.z, 0.3, 7, ['#F28FAF', '#FFB3C6', '#FFF5E1'], { y: y - 0.2 }); veg.bush(x, archC.z, 0.6, ['#4E8E5B', '#5E9E62'], y - 0.3); }
  B.add(new THREE.TorusGeometry(1.6, 0.05, 6, 24, PI).scale(1, 1.75, 1).translate(archC.x, 0.2, archC.z), paint('#FFF5E1', 0.5), null, c);
  for (let i = 0; i < 9; i++) B.add(new THREE.CylinderGeometry(0.42, 0.45, 0.12, 10).translate(archC.x - 2 - i * 1.1, 0.06, archC.z + 2 + i * 0.5 + Math.sin(i) * 0.4), stone(1, '#D9CDBF'));
  // glowing mushrooms: cream stems, caps that light up at night
  const capCols = ['#C8A2E8', '#FFB3C6', '#A0D8F1'], stems = [], caps = { '#C8A2E8': [], '#FFB3C6': [], '#A0D8F1': [] };
  for (let i = 0; i < 34; i++) { const a = rand() * TAU, r = R(11.5, 17), x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r * 0.75, s = R(0.5, 1.4);
    stems.push(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 0.5 * s, 8).translate(x, 0.25 * s, z)); caps[pick(capCols)].push(new THREE.SphereGeometry(0.32 * s, 14, 8, 0, TAU, 0, PI / 2).scale(1, 0.7, 1).translate(x, 0.48 * s, z)); }
  stems.forEach(g => B.add(g, matte('#FFF5E1', 0.6)));
  for (const [col, list] of Object.entries(caps)) list.forEach(g => B.add(g, glow(col, 2.2, 0.12)));
  // stone lanterns
  for (const [x, z] of [[gx - 12, gz + 3], [gx + 11, gz + 4], [gx - 6, gz - 9.5], [gx + 4, gz + 9.5]]) {
    B.add(new THREE.CylinderGeometry(0.3, 0.4, 0.9, 6).translate(x, 0.45, z), stone(1, '#CFC3B8'), null, c); B.add(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 6).translate(x, 1.12, z), lampGlass('#FFD08E', 2.4));
    B.add(new THREE.ConeGeometry(0.55, 0.45, 6).translate(x, 1.55, z), stone(1, '#CFC3B8'), null, c); }
  lights && lights.addLocal(V(gx, 2.5, gz), '#FFB8D8', 22, 16);
  // trees and beds around the pond
  const kinds = ['willow', 'cherry', 'wisteria', 'willow', 'cherry', 'maple'];
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + R(-0.15, 0.15), r = R(15, 20), x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r * 0.8; if (Math.hypot(x - archC.x, z - archC.z) < 4) continue; veg.tree(kinds[i % kinds.length], x, z, R(0.95, 1.3)); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.3, x = gx + Math.cos(a) * 12.5, z = gz + Math.sin(a) * 8.6; veg.bed(x, z, 1.4, 34); }
  B.build(root); rocks.build(root);
  return { object3D: root, update() {} };
}

export { createGarden };
