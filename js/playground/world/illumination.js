/* =========================================================================
   ILLUMINATION — the art direction of the park after dark, laid out with bulbs.js. Every ride has its own
   lighting identity rather than one pattern everywhere:
     Ferris wheel — rim rings chasing in rose/gold, every spoke traced in warm light, a lantern on each gondola,
       a breathing champagne hub
     Carousel — a gold crown of bulbs on the valance, chasing canopy ribs, warm column lights, a ring of floor lights
     Coaster — LEDs along both rails with a cyan → violet wave racing the length of the track, glowing supports
     Swings — a twinkling rim under the canopy, a crown ring that breathes
     Drop tower — four vertical strips chasing upward, a crown of cyan crystals
     Pirate ship — rigging lanterns along the arm, a gold deck line
     Teacups, balloons, games, stage, café, gazebo — each a different colour and rhythm
   Then the world: shop rooflines and doorframes, layered castle illumination (tower cornices, curtain-wall
   battlements, glowing spires), the gate's arch, light arches over the boulevard hung with crystal drops,
   path-edge lights in champagne and turquoise, fairy lights wound through a third of the trees, paper lanterns
   floating over the garden pond, and glowing heart and star sculptures in the plaza.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const L = CONFIG.layout, V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
const GOLD = '#FFD9A0', CHAMP = '#FFE8C8', ROSE = '#FF9EC0', LAV = '#C9A8FF', CYAN = '#7FE9FF', TEAL = '#5FD8C8', WARM = '#FFC98A', WHITE = '#FFF4E8';

function createIllumination({ B, atts, shops, castle, clumps, scene }) {
  const A = (id) => atts.find(a => a.id === id), world = scene;
  // ---------- rides ----------
  const fw = A('ferris'); if (fw && fw.rig) { const { wheel, Rw, N } = fw.rig;
    for (const z of [-1.3, 1.3]) { B.ring(wheel, V(0, 0, z), Rw + 0.45, 96, { color: ROSE, color2: GOLD, pattern: 'wave', speed: 1.6, waves: 6, size: 0.08 }); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; for (const z of [-1.25, 1.25]) B.line(wheel, V(0, 0, z), V(Math.sin(a) * Rw, -Math.cos(a) * Rw, z), 14, { color: CHAMP, pattern: 'chase', speed: 3, size: 0.06 }); }
    // (the wheel's rim is its local XY plane; gondolas hang from the rim)
    for (let k = 0; k < N; k++) { const a = k / N * TAU; B.add(wheel, V(Math.sin(a) * Rw, -Math.cos(a) * Rw - 0.15, 0), { color: [ROSE, GOLD, LAV, CYAN][k % 4], pattern: 'breathe', speed: 1.2, size: 0.22, phase: k / N }); }
    B.ring(wheel, V(0, 0, 1.45), 1.6, 24, { color: CHAMP, pattern: 'breathe', speed: 2, size: 0.1 }); B.ring(wheel, V(0, 0, -1.45), 1.6, 24, { color: CHAMP, pattern: 'breathe', speed: 2, size: 0.1 }); }
  const cr = A('carousel'); if (cr && cr.rig) { const { top, CR, H2 } = cr.rig;
    B.ring(top, V(0, H2 + 0.45, 0), CR + 0.95, 90, { color: GOLD, pattern: 'chase', speed: 2.4, waves: 9, size: 0.09 });
    B.ring(top, V(0, H2 + 2.6, 0), (CR + 0.9) * 0.45, 40, { color: CHAMP, pattern: 'twinkle', speed: 3, size: 0.07 });
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; B.line(top, V(Math.sin(a) * (CR + 0.85), H2 + 0.75, Math.cos(a) * (CR + 0.85)), V(Math.sin(a) * 0.5, H2 + 3.6, Math.cos(a) * 0.5), 10, { color: k % 2 ? ROSE : GOLD, pattern: 'chase', speed: 4, size: 0.06 }); }
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; B.line(top, V(Math.sin(a) * 2.3, 1, Math.cos(a) * 2.3), V(Math.sin(a) * 2.3, H2, Math.cos(a) * 2.3), 12, { color: WARM, pattern: 'steady', size: 0.06 }); }
    B.ring(cr.object3D, V(0, 0.55, 0), CR + 0.75, 64, { color: LAV, color2: ROSE, pattern: 'wave', speed: 0.8, waves: 2, size: 0.06 }); }
  const co = A('coaster'); if (co && co.rig) { const { samples, root } = co.rig;
    for (let i = 0; i < samples.length; i += 5) { const q = samples[i], u = i / samples.length;
      for (const s of [-1, 1]) B.add(root, q.p.clone().addScaledVector(q.side, s * 0.62).addScaledVector(q.up, 0.12), { color: CYAN, color2: LAV, pattern: 'wave', speed: 3, phase: u, waves: 14, size: 0.055 });
      if (i % 60 === 0 && q.p.y > 2) B.line(root, V(q.p.x, 0.3, q.p.z), V(q.p.x, q.p.y - 0.6, q.p.z), Math.max(2, Math.floor(q.p.y / 1.4)), { color: LAV, pattern: 'breathe', speed: 1, size: 0.05 }); } }
  const sw = A('swings'); if (sw && sw.rig) { const { crown, RA } = sw.rig;
    B.ring(crown, V(0, -0.15, 0), RA + 1.05, 72, { color: WHITE, pattern: 'twinkle', speed: 4, size: 0.07 });
    B.ring(crown, V(0, 2.9, 0), (RA + 1) * 0.3, 24, { color: ROSE, pattern: 'breathe', speed: 1.5, size: 0.1 }); }
  const dr = A('drop'); if (dr && dr.rig) { const { H } = dr.rig;
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4; B.line(dr.object3D, V(Math.sin(a) * 1.5, 2, Math.cos(a) * 1.5), V(Math.sin(a) * 1.4, H - 2, Math.cos(a) * 1.4), 60, { color: CYAN, color2: LAV, pattern: 'chase', speed: -5, waves: 3, size: 0.07 }); }
    for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; B.add(dr.object3D, V(Math.sin(a) * 2.2, H + 0.6 + Math.sin(k * 2.3) * 0.4, Math.cos(a) * 2.2), { color: CYAN, pattern: 'sparkle', speed: 1.3, size: 0.12 }); } }
  const ps = A('pirate'); if (ps && ps.rig) { const { swing, LA } = ps.rig;
    for (const z of [-0.8, 0.8]) B.line(swing, V(0, -0.5, z), V(0, -LA + 1, z), 16, { color: WARM, pattern: 'chase', speed: 2, size: 0.07 });
    B.line(swing, V(-6.5, -LA + 0.2, 2.6), V(6.5, -LA + 0.2, 2.6), 30, { color: GOLD, pattern: 'twinkle', speed: 3, size: 0.06 });
    B.line(swing, V(-6.5, -LA + 0.2, -2.6), V(6.5, -LA + 0.2, -2.6), 30, { color: GOLD, pattern: 'twinkle', speed: 3, size: 0.06 }); }
  const tc = A('teacups'); if (tc && tc.rig) B.ring(tc.rig.floor, V(0, 0.15, 0), tc.rig.TR + 0.45, 72, { color: TEAL, color2: ROSE, pattern: 'wave', speed: 1.2, waves: 6, size: 0.07 });
  const bl = A('balloons'); if (bl && bl.rig) { const { hub, AR } = bl.rig; B.ring(hub, V(0, 0, 0), AR, 48, { color: GOLD, pattern: 'chase', speed: 2, waves: 6, size: 0.08 }); B.ring(hub, V(0, 1.2, 0), 1.2, 16, { color: CHAMP, pattern: 'breathe', size: 0.1 }); }
  const tr = A('train'); if (tr && tr.rig) { B.add(tr.rig.loco, V(0, 2.6, 2.4), { color: WHITE, size: 0.18 }); B.line(tr.rig.loco, V(-1.1, 3.4, -2.5), V(-1.1, 3.4, 2.4), 10, { color: GOLD, pattern: 'chase', speed: 3, size: 0.05 }); B.line(tr.rig.loco, V(1.1, 3.4, -2.5), V(1.1, 3.4, 2.4), 10, { color: GOLD, pattern: 'chase', speed: 3, size: 0.05 }); }
  // games, booths, stage and the rest: a roofline traced from each one's bounds, each in its own colour and rhythm
  const STYLE = { ringToss: [ROSE, 'chase'], claw: [CYAN, 'wave', LAV], gallery: [GOLD, 'chase'], photo: [LAV, 'twinkle'], bumper: [CYAN, 'wave', ROSE], fishing: [TEAL, 'chase'],
    golf: [TEAL, 'breathe'], observatory: [LAV, 'twinkle'], stage: [ROSE, 'wave', CYAN], cafe: [WARM, 'twinkle'], lookout: [CHAMP, 'breathe'], fountainShow: [CYAN, 'wave', ROSE], maze: [WARM, 'twinkle'], fountain: [CHAMP, 'breathe'] };
  const box = new THREE.Box3(), inv = new THREE.Matrix4();
  for (const [id, [col, pat, col2]] of Object.entries(STYLE)) { const a = A(id); if (!a) continue; const o = a.object3D; o.updateWorldMatrix(true, true);
    box.makeEmpty(); inv.copy(o.matrixWorld).invert(); o.traverse(m => { if (m.isMesh && m.material && m.material.visible !== false && !m.isInstancedMesh && m.geometry) { m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld).applyMatrix4(inv); box.union(bb); } });
    if (box.isEmpty()) continue; const lowRoof = ['golf', 'fountainShow', 'maze', 'fountain'].includes(id), y = lowRoof ? (id === 'maze' ? 2.35 : 0.65) : box.max.y * 0.82;
    const round = ['fishing', 'observatory', 'fountain', 'lookout'].includes(id);
    if (round) B.ring(o, V((box.min.x + box.max.x) / 2, id === 'observatory' ? box.max.y * 0.6 : y, (box.min.z + box.max.z) / 2), Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 * (id === 'fountain' ? 0.95 : 1.02), 64, { color: col, color2: col2, pattern: pat, speed: 2.4, waves: 4, size: 0.07 });
    else B.rect(o, box.min.x, box.max.x, box.min.z, box.max.z, y, 0.6, { color: col, color2: col2, pattern: pat, speed: 2.4, waves: 4, size: 0.07 });
    if (id === 'stage') for (let k = 0; k < 7; k++) B.line(o, V(box.min.x + 1 + k * (box.max.x - box.min.x - 2) / 6, 0.4, box.max.z - 0.4), V(box.min.x + 1 + k * (box.max.x - box.min.x - 2) / 6, box.max.y * 0.8, box.max.z - 0.4), 16, { color: k % 2 ? ROSE : CYAN, pattern: 'chase', speed: -4, size: 0.06 }); }

  // ---------- shops: rooflines, door frames, a twinkle of window lights ----------
  if (shops) shops.children.forEach((g, i) => { box.setFromObject(g); inv.copy(g.matrixWorld).invert(); const b2 = box.clone().applyMatrix4(inv);
    const pal = [[GOLD, 'chase'], [ROSE, 'twinkle'], [CHAMP, 'steady'], [LAV, 'chase'], [TEAL, 'twinkle'], [WARM, 'breathe'], [ROSE, 'chase'], [GOLD, 'twinkle'], [LAV, 'breathe']][i % 9];
    B.rect(g, b2.min.x + 0.2, b2.max.x - 0.2, b2.min.z + 0.2, b2.max.z - 0.2, Math.min(b2.max.y - 0.3, 4.9), 0.45, { color: pal[0], pattern: pal[1], speed: 2.2, size: 0.06 });
    B.line(g, V(-1.4, 0.4, b2.max.z + 0.05), V(-1.4, 2.8, b2.max.z + 0.05), 8, { color: WARM, size: 0.05 }); B.line(g, V(1.4, 0.4, b2.max.z + 0.05), V(1.4, 2.8, b2.max.z + 0.05), 8, { color: WARM, size: 0.05 }); });

  // ---------- the castle: layered, from the battlements up to the spires ----------
  // the château is lit like architecture, not outlined: floodlights (nightlights.js) and its glowing windows do the
  // work; bulbs only mark the spire tips, a gold thread under each tower's eaves, and the terrace balustrade
  if (castle) { const cr = castle.rig || { towers: [], spires: [] };
    for (const [x, z, r, h] of cr.towers) B.ring(castle.object3D || castle, V(x, 0.6 + h - 0.1, z), r + 0.05, Math.round(r * 12), { color: GOLD, pattern: 'breathe', speed: 0.6, size: 0.06 });
    for (const [x, y, z] of cr.spires) B.add(castle.object3D || castle, V(x, y, z), { color: CHAMP, pattern: 'breathe', speed: 1, size: 0.16 });
    for (const s of [-1, 1]) B.line(castle.object3D || castle, V(s * 6.6, 1.75, 9.1), V(s * 28.5, 1.75, 9.1), 44, { color: WARM, pattern: 'steady', size: 0.045 }); }

  // ---------- the gate arch and the boulevard's light arches with crystal drops ----------
  const gz = L.gate.z;
  // the gatehouse: a thread of light around the great arch on both faces, the dome's lantern ring
  for (const s of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * (1 - i / 24); pts.push(V(Math.cos(a) * 3.38, 6.0 + Math.sin(a) * 3.38, gz + s * 2.75)); } B.curve(world, pts, 48, { color: CHAMP, pattern: 'steady', size: 0.045 }); }
  B.ring(world, V(0, 12.4 + 3.5 + 2.6 * 0.62, gz), 2.55, 36, { color: GOLD, pattern: 'breathe', speed: 0.8, size: 0.05 });
  const b = L.boulevard, archs = [];
  for (let z = b.z0 + 10; z < b.z1 - 8; z += 16) { if (Math.abs(z - L.trainRadius) < 6) continue; archs.push(z);
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, a = u * Math.PI; pts.push(V(-Math.cos(a) * (b.w / 2 + 0.4), 0.2 + Math.sin(a) * 6.2, z)); }
    B.curve(world, pts, 70, { color: GOLD, color2: ROSE, pattern: 'wave', speed: 1.5, waves: 2, size: 0.085 });
    for (let k = 0; k < 9; k++) { const x = -b.w / 2 + 0.8 + k * (b.w - 1.6) / 8, top = 0.2 + Math.sqrt(Math.max(0, 1 - (x / (b.w / 2 + 0.4)) ** 2)) * 6.2;
      for (let j = 1; j <= 3; j++) B.add(world, V(x, top - j * 0.32, z), { color: CYAN, pattern: 'sparkle', speed: 0.7 + k * 0.05, size: 0.06 + (j === 3 ? 0.04 : 0) }); } }

  // ---------- paths: champagne edge lights on the promenade, turquoise along the spurs, gold on the boulevard ----------
  const rp = L.ringPath; for (const r of [rp.r - rp.w / 2 - 0.15, rp.r + rp.w / 2 + 0.15]) { const n = Math.round(TAU * r / 1.1); for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (Math.abs(x) < b.w / 2 + 0.5 && z > 0) continue; B.add(world, V(x, 0.07, z), { color: CHAMP, color2: GOLD, pattern: 'wave', speed: 0.7, phase: i / n, waves: 5, size: 0.035 }); } }
  for (const s of [-1, 1]) B.line(world, V(s * (b.w / 2 + 0.3), 0.1, b.z0 + 1), V(s * (b.w / 2 + 0.3), 0.1, b.z1), Math.round((b.z1 - b.z0) / 1.2), { color: GOLD, pattern: 'chase', speed: -2.5, waves: 8, size: 0.04 });
  for (const id of ['ferris', 'carousel', 'teacups', 'swings', 'balloons', 'pirate', 'drop', 'ringToss', 'claw', 'stage', 'observatory', 'fishing', 'gallery']) { const [x, z] = L[id], d = Math.hypot(x, z), ux = x / d, uz = z / d, s0 = rp.r + rp.w / 2 + 0.5, s1 = d - 6;
    if (s1 <= s0) continue; for (const sd of [-1, 1]) B.line(world, V(ux * s0 - uz * 1.8 * sd, 0.08, uz * s0 + ux * 1.8 * sd), V(ux * s1 - uz * 1.8 * sd, 0.08, uz * s1 + ux * 1.8 * sd), Math.round((s1 - s0) / 1.4), { color: CHAMP, pattern: 'chase', speed: -1.5, waves: 3, size: 0.035 }); }
  // the castle path: lantern posts
  for (let z = -30; z > L.castle.z + 10; z -= 6) for (const s of [-1, 1]) B.add(world, V(s * 2.6, 1.0 + Math.max(0, (-z - 96)) * 0.12, z), { color: WARM, pattern: 'breathe', speed: 1.4, size: 0.07 });

  // ---------- fairy lights wound through about a third of the trees ----------
  if (clumps) clumps.forEach((c, i) => { if (c.kind === 'needle' || i % 4 !== 0 || Math.hypot(c.p.x, c.p.z) > L.parkRadius) return;
    const col = c.kind === 'blossom' ? [WHITE, ROSE][i % 2] : c.kind === 'wisteria' ? LAV : [WARM, WHITE, GOLD][i % 3];
    for (let k = 0; k < 3; k++) { const a = Math.random() * TAU, y = (Math.random() - 0.3) * 0.7, r = 0.75 * c.s.x; B.add(world, V(c.p.x + Math.cos(a) * r, c.p.y + y * c.s.y, c.p.z + Math.sin(a) * r), { color: col, pattern: 'twinkle', speed: 2 + Math.random() * 3, size: 0.045 }); } });

  // ---------- floating paper lanterns over the garden pond; plaza sculptures of light ----------
  const G = L.garden; for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()); B.add(world, V(G.x + Math.cos(a) * 9 * r, 2.6 + Math.random() * 2.2, G.z + Math.sin(a) * 6 * r), { color: [WARM, ROSE, GOLD][i % 3], pattern: 'breathe', speed: 0.8 + Math.random(), size: 0.15 }); }
  const heart = (cx, cz, s, y0, col) => { const pts = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * TAU; pts.push(V(cx + 16 * Math.pow(Math.sin(t), 3) * s / 16, y0 + (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s / 16, cz)); }
    for (let i = 0; i < pts.length - 1; i++) B.add(world, pts[i], { color: col, pattern: 'chase', speed: 2.5, phase: i / 64, waves: 2, size: 0.07 }); };
  for (const [x, z, col] of [[-6, 18.5, ROSE], [6, 18.5, GOLD]]) { heart(x, z, 1.2, 2.6, col); B.line(world, V(x, 0, z), V(x, 1.4, z), 6, { color: CHAMP, size: 0.05 }); }
  const star = (cx, cy, cz, R, col) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? R * 0.45 : R; pts.push(V(cx + Math.cos(a) * r, cy - Math.sin(a) * r, cz)); }
    for (let i = 0; i < 10; i++) B.line(world, pts[i], pts[i + 1], 8, { color: col, pattern: 'twinkle', speed: 3, size: 0.06 }); };
  for (const z of [32, 64]) for (const s of [-1, 1]) star(s * (b.w / 2 + 2.5), 3.4, z + 8, 0.9, s > 0 ? CYAN : GOLD);
  return { archs };
}

export { createIllumination };
