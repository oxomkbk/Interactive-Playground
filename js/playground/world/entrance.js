/* =========================================================================
   THE GRAND GATEHOUSE — the park's front door, in the manner of a triumphal arch:
   • one ivory stone mass pierced by a tall central arch and two lower side arches (an extruded façade with
     arched voids, so the passages have real depth), rusticated at the base
   • paired fluted columns on both faces, a full entablature carrying the lit park name, an attic with a working
     clock (it tells the real time) under a balustrade with flower urns, and a ribbed dome with a lantern
   • wrought-iron gates folded open against the piers, lanterns hanging in the central arch
   • glass ticket pavilions under verdigris domes, joined to the arch by curved colonnades
   • twin fountains on the forecourt outside, planters and lamps along the approach
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, canvasTex } from '../core/geo.js';
import { plaster, paint, gold, stone, signMat, windowMat, lampGlass } from '../core/materials.js';
import { sign } from '../core/textures.js';
import { t, onLang } from '../i18n.js';
import { createKit, archPane, lathe } from './arch.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;

// warm arched-window glow: a lit interior with mullions (also used by other buildings)
const archWindowTex = () => canvasTex(128, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#FFE6B8'); gr.addColorStop(1, '#FFB27A'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#5B3A4E'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, h * 0.45, w, 6); g.fillStyle = 'rgba(90,40,60,.25)'; g.fillRect(0, h * 0.75, w, h * 0.25);
}, false);
// an arch-topped window shape (unit size; scale to taste)
function archGeo(w = 1, h = 1.6) { return archPane(w, h); }
const arch = (s, w, h, x) => { const p = new THREE.Path(); p.moveTo(x - w / 2, 0); p.lineTo(x - w / 2, h - w / 2); p.absarc(x, h - w / 2, w / 2, PI, 0, true); p.lineTo(x + w / 2, 0); p.lineTo(x - w / 2, 0); s.holes.push(p); };

function createEntrance(veg, props, fx, lights) {
  const { x: gx, z: gz } = CONFIG.layout.gate, root = new THREE.Group(); root.name = 'entrance'; root.position.set(gx, 0, gz);
  const M = { stone: stone(2, '#E4DACE'), trim: plaster('#FFF6EA', 1), wall: plaster('#FBF0E2', 2), roof: paint('#6FA897', 0.45), gold: gold(), glass: windowMat(archWindowTex(), '#FFD9A8', 1.3), dark: paint('#2E2A36', 0.5) };
  const K = createKit(M), B = createBatch('gatehouse'), c = { cast: true }, iron = paint('#2B2733', 0.4), DEPTH = 5, HW = 7.6, HH = 12.4;

  // ---------- the arch: one stone mass with three arched passages ----------
  // the façade outline walks along the ground and up over each arch, so the passages are notches in one contour
  const face = new THREE.Shape(); face.moveTo(-HW, 0);
  for (const [x, w, h] of [[-5.35, 2.3, 5.0], [0, 6, 9.0], [5.35, 2.3, 5.0]]) { face.lineTo(x - w / 2, 0); face.lineTo(x - w / 2, h - w / 2); face.absarc(x, h - w / 2, w / 2, PI, 0, true); face.lineTo(x + w / 2, 0); }
  face.lineTo(HW, 0); face.lineTo(HW, HH); face.lineTo(-HW, HH); face.lineTo(-HW, 0); void arch;
  const mass = new THREE.ExtrudeGeometry(face, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 24 }).translate(0, 0, -DEPTH / 2);
  { const p = mass.attributes.position, uv = mass.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 3, p.getY(i) / 3); }
  B.add(mass, M.wall, null, c);
  for (const s of [-1, 1]) B.add(rbox(2 * HW + 0.5, 1.6, 0.4, 0.06, 1).translate(0, 0.8, s * (DEPTH / 2 + 0.1)), stone(2, '#D3C8BC'));        // rusticated base course
  for (const s of [-1, 1]) { const z = s * (DEPTH / 2 + 0.05);
    // archivolts and keystones
    B.add(new THREE.TorusGeometry(3.05, 0.22, 8, 32, PI).translate(0, 6.0, z), M.stone); B.add(new THREE.TorusGeometry(3.32, 0.07, 6, 32, PI).translate(0, 6.0, z + s * 0.08), M.gold);
    B.add(rbox(0.7, 1.1, 0.5, 0.06, 1).translate(0, 9.2, z), M.stone, null, c);
    for (const x of [-5.35, 5.35]) { B.add(new THREE.TorusGeometry(1.2, 0.14, 6, 24, PI).translate(x, 3.85, z), M.stone); K.window(B, x, 6.2, z, 1.0, 2.0, { ry: s > 0 ? 0 : PI }); }
    // paired columns on tall pedestals
    for (const x of [-3.9, 3.9, -7.1, 7.1]) { B.add(rbox(1.2, 1.6, 1.2, 0.06, 1).translate(x, 0.8, z + s * 0.6), M.stone, null, c); K.column(B, x, 1.6, z + s * 0.6, 8.0, 0.36); }
    K.cornice(B, -HW - 0.3, HW + 0.3, 9.95, s > 0 ? z : -z, s > 0 ? 0 : PI, 1.2);
    K.cornice(B, -HW - 0.3, HW + 0.3, 11.8, s > 0 ? z : -z, s > 0 ? 0 : PI, 0.9);
  }
  // attic, clock, balustrade, urns, dome
  B.add(rbox(10.5, 3.4, 4.2, 0.08, 1).translate(0, HH + 1.7, 0), M.wall, null, c);
  for (const s of [-1, 1]) { K.cornice(B, -5.25, 5.25, HH + 3.4, s > 0 ? 2.1 : 2.1, s > 0 ? 0 : PI, 0.5);
    K.balustrade(B, V(s * 5.3, HH, 2.3), V(s * HW, HH, 2.3), 0.8); K.balustrade(B, V(s * 5.3, HH, -2.3), V(s * HW, HH, -2.3), 0.8);
    for (const z of [-2.3, 2.3]) { B.add(lathe([[0.001, 0], [0.3, 0], [0.45, 0.25], [0.28, 0.55], [0.38, 0.7], [0.001, 0.75]], 16).translate(s * (HW - 0.2), HH + 0.1, z), M.stone, null, c); veg.bed(gx + s * (HW - 0.2), gz + z, 0.3, 10, ['#FFB3C6', '#FFF5E1', '#C8A2E8'], { y: HH + 0.8 }); } }
  for (const s of [-1, 1]) { const z = s * 2.13; B.add(new THREE.CircleGeometry(1.25, 48).rotateY(s > 0 ? 0 : PI).translate(0, HH + 1.8, z), paint('#FFF8E8', 0.3)); B.add(new THREE.TorusGeometry(1.3, 0.12, 8, 48).rotateY(s > 0 ? 0 : PI).translate(0, HH + 1.8, z + s * 0.03), M.gold);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; B.add(rbox(0.07, 0.24, 0.04, 0.01, 1).translate(Math.cos(a) * 1.05, HH + 1.8 + Math.sin(a) * 1.05, z + s * 0.02), M.dark); } }
  K.dome(B, 0, HH + 3.5, 0, 2.6);
  B.build(root);
  // the clock hands (real time)
  const hands = []; for (const s of [-1, 1]) { const hg = new THREE.Group(); hg.position.set(0, HH + 1.8, s * 2.2); hg.rotation.y = s > 0 ? 0 : PI; root.add(hg);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 0.03).translate(0, 0.28, 0), gold()), m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.03).translate(0, 0.42, 0.02), gold()); hg.add(h, m); hands.push({ h, m, s }); }
  // the park's name on the entablature, both faces
  const make = () => sign(t('Sweetheart Park'), { w: 1536, h: 256, size: 150, bg: '#FBF0E2', fg: '#9C6A3E', border: '#E3B865' });
  const sm = signMat(make(), 0.42);
  for (const s of [-1, 1]) { const board = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.6), sm); board.position.set(0, 10.85, s * (DEPTH / 2 + 0.62)); board.rotation.y = s > 0 ? 0 : PI; root.add(board); }
  onLang(() => { sm.map = sm.emissiveMap = make(); sm.needsUpdate = true; });
  // wrought-iron gates, folded open against the inner piers
  const G = createBatch('gates');
  for (const s of [-1, 1]) { const x0 = s * 3.0, z0 = DEPTH / 2 - 0.3, dirX = 0, dirZ = -1;
    for (let i = 0; i <= 10; i++) { const u = i / 10 * 2.9, top = 6.2 + Math.sin(i / 10 * PI) * 0.6; G.add(rodGeo(V(x0 - s * 0.15, 0, z0 + dirZ * u), V(x0 - s * 0.15, top, z0 + dirZ * u), 0.025, 5), iron); if (i % 2 === 0) G.add(new THREE.ConeGeometry(0.06, 0.25, 6).translate(x0 - s * 0.15, top + 0.12, z0 + dirZ * u), M.gold); }
    for (const y of [0.4, 3.1, 5.6]) G.add(rodGeo(V(x0 - s * 0.15, y, z0), V(x0 - s * 0.15, y, z0 - 2.9), 0.03, 5), iron);
    for (let k = 0; k < 3; k++) G.add(new THREE.TorusGeometry(0.35, 0.025, 6, 20).rotateY(PI / 2).translate(x0 - s * 0.15, 4.35, z0 - 0.5 - k * 0.95), M.gold); void dirX; }
  G.build(root);
  // lanterns in the central arch
  const lg = lampGlass('#FFD3A0', 2.8);
  for (const z of [-1.2, 1.2]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.6, 8), lg); l.position.set(0, 7.2, z); root.add(l); root.add(new THREE.Mesh(rodGeo(V(0, 7.5, z), V(0, 9.0, z), 0.02, 4), gold())); }

  // ---------- ticket pavilions under verdigris domes, joined by curved colonnades ----------
  const P = createBatch('pavilions');
  for (const s of [-1, 1]) { const px = s * 12.2, pz = 1.5, r = 2.3;
    P.add(new THREE.CylinderGeometry(r + 0.3, r + 0.4, 0.6, 8).translate(px, 0.3, pz), M.stone, null, c);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + PI / 8; P.add(rbox(0.22, 3.6, 0.22, 0.04, 1).translate(px + Math.sin(a) * r, 2.4, pz + Math.cos(a) * r), M.trim, null, c);
      P.add(archPane(1.5, 3.1).rotateY(a + PI / 8).translate(px + Math.sin(a + PI / 8) * r * 0.93, 0.7, pz + Math.cos(a + PI / 8) * r * 0.93), M.glass); }
    P.add(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.4, 8).translate(px, 4.3, pz), M.stone, null, c);
    K.dome(P, px, 4.45, pz, r * 0.95);
    // the colonnade: a quarter arc from the arch to the pavilion
    const pts = []; for (let k = 0; k <= 4; k++) { const a = k / 4 * PI / 2; pts.push(V(s * (HW + 0.6 + Math.sin(a) * 3.2), 0, -DEPTH / 2 + 1 + (1 - Math.cos(a)) * 0.2 + k * 0.9)); }
    for (const p of pts) K.column(P, p.x, 0, p.z, 4.2, 0.22, 12);
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], m = a.clone().lerp(b, 0.5), len = a.distanceTo(b); P.add(rbox(0.7, 0.45, len + 0.5, 0.05, 1).rotateY(Math.atan2(b.x - a.x, b.z - a.z)).translate(m.x, 4.4, m.z), M.stone, null, c); }
  }
  P.build(root);

  // ---------- the forecourt: twin fountains, planters and lamps ----------
  const fountains = [], base = M.stone;
  for (const s of [-1, 1]) { const fx0 = gx + s * 13, fz = gz + 9; const FB = createBatch('gate-fountain');
    FB.add(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 40, 1, true).translate(fx0 - gx, 0.35, fz - gz), base, null, c); FB.add(new THREE.TorusGeometry(3.25, 0.22, 8, 48).rotateX(PI / 2).translate(fx0 - gx, 0.72, fz - gz), base);
    FB.add(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 16).translate(fx0 - gx, 0.7, fz - gz), base, null, c); FB.add(new THREE.CylinderGeometry(1.1, 0.4, 0.3, 24).translate(fx0 - gx, 1.5, fz - gz), base, null, c);
    FB.build(root); fountains.push({ x: fx0, y: 1.6, z: fz, r: 3.1 });
    props.planter(fx0 + s * 5, fz - 3, 1.1); props.planter(fx0 - s * 1, fz + 5, 0.9); props.lamp(gx + s * 5.6, gz + 6, { light: s > 0, double: true }); }
  lights && lights.addLocal(V(gx, 7, gz + 4), '#FFC3A0', 40, 22);
  return { object3D: root, fountains, rig: { archR: 3.0, archY: 6.0, depth: DEPTH, attic: HH },
    update() { const d = new Date(), hr = (d.getHours() % 12 + d.getMinutes() / 60) / 12, mn = (d.getMinutes() + d.getSeconds() / 60) / 60;
      for (const { h, m } of hands) { h.rotation.z = -hr * TAU; m.rotation.z = -mn * TAU; } } };
}

export { createEntrance, archGeo, archWindowTex };
