/* =========================================================================
   WALKABLE WORLD — what the player collides with and stands on, kept 2D (+ a height per shape) so it's cheap:
   • colliders: circles and oriented boxes in a spatial hash (attraction footprints from their hit proxies,
     shops, the gate towers, the castle, tree trunks, lamp posts, benches, the garden pond's rim)
   • bounds: the park inside the hedge, the approach outside the gate, the path up Castle Hill and the castle
     terrace (a viewpoint over the whole park)
   • groundAt(x, z): terrain height, plus the arched moon bridge over the garden pond
   • boom(from, to): how far a camera boom can reach before something solid is in the way
   • nearest interactive attraction (signed distance to its footprint) for the walk-up prompt
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { heightAt } from '../world/ground.js';

const L = CONFIG.layout, CELL = 8;
const key = (i, j) => i * 4096 + j;

function createWalkWorld() {
  const shapes = [], grid = new Map();
  function insert(s) {
    const r = s.type === 'circle' ? s.r : Math.hypot(s.hw, s.hd);
    s.bound = r; shapes.push(s);
    for (let i = Math.floor((s.x - r) / CELL); i <= Math.floor((s.x + r) / CELL); i++) for (let j = Math.floor((s.z - r) / CELL); j <= Math.floor((s.z + r) / CELL); j++) {
      const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
    return s;
  }
  const circle = (x, z, r, h = 4, tag) => insert({ type: 'circle', x, z, r, h, tag });
  const box = (x, z, w, d, rot = 0, h = 4, tag) => insert({ type: 'box', x, z, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot), h, tag });
  const near = (x, z) => { const out = new Set(); const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const c = grid.get(key(i, j)); if (c) for (const s of c) out.add(s); } return out; };

  // signed distance from a point to a shape's outline (negative inside), plus the outward normal
  const _n = { x: 0, z: 0 };
  function sdf(s, x, z) {
    const dx = x - s.x, dz = z - s.z;
    if (s.type === 'circle') { const d = Math.hypot(dx, dz) || 1e-6; _n.x = dx / d; _n.z = dz / d; return d - s.r; }
    // into the box frame (rotation about y: local x = c·dx − s·dz, local z = s·dx + c·dz)
    const lx = s.c * dx - s.s * dz, lz = s.s * dx + s.c * dz, qx = Math.abs(lx) - s.hw, qz = Math.abs(lz) - s.hd;
    let nx, nz, d;
    if (qx > 0 || qz > 0) { const ox = Math.max(qx, 0), oz = Math.max(qz, 0); d = Math.hypot(ox, oz); nx = Math.sign(lx) * ox / (d || 1); nz = Math.sign(lz) * oz / (d || 1); }
    else if (qx > qz) { d = qx; nx = Math.sign(lx); nz = 0; } else { d = qz; nx = 0; nz = Math.sign(lz); }
    _n.x = s.c * nx + s.s * nz; _n.z = -s.s * nx + s.c * nz; return d;
  }

  // where you may walk: inside the hedge, the gate approach, the castle path and terrace
  const castleFront = L.castle.z + 9; // the castle's gate face
  function inBounds(x, z) {
    const r = Math.hypot(x, z);
    if (r < L.parkRadius - 2.6) return true;
    if (Math.abs(x) < 6.5 && z > 0 && z < L.gate.z + 24) return true;                       // through the gate
    if (Math.abs(x) < 3.6 && z < 0 && z > castleFront - 2) return true;                       // Castle Hill path
    if (Math.hypot(x - L.castle.x, (z - (castleFront + 13)) * 1.35) < 26 && z > castleFront) return true; // the castle terrace
    return false;
  }

  // the moon bridge: an arch over the garden pond, walkable along its deck
  const G = L.garden;
  const onBridge = (x, z) => Math.abs(x - G.x) < 1.05 && Math.abs(z - G.z) < 8.6;
  const bridgeH = (z) => { const t = Math.min(1, Math.abs(z - G.z) / 8.5); return 0.27 + 2.6 * (1 - t * t); };
  // raised floors you can step onto (café deck, gazebo)
  const plats = [];
  const platform = (p) => plats.push(p);
  const platTop = (x, z) => { let h = -1e9; for (const p of plats) if (sdf(p, x, z) < 0) h = Math.max(h, p.top); return h; };
  const groundAt = (x, z) => Math.max(onBridge(x, z) ? Math.max(heightAt(x, z), bridgeH(z)) : heightAt(x, z), plats.length ? platTop(x, z) : -1e9);

  // push a circle (radius r at height y) out of everything it overlaps; returns true if it touched something
  function resolve(p, r, y = 0) {
    let hit = false;
    for (let it = 0; it < 3; it++) { let moved = false;
      for (const s of near(p.x, p.z)) { if (y > s.h + 0.05) continue; if (s.tag === 'pond' && onBridge(p.x, p.z)) continue;
        const d = sdf(s, p.x, p.z); if (d < r) { p.x += _n.x * (r - d); p.z += _n.z * (r - d); moved = hit = true; } }
      if (!moved) break; }
    return hit;
  }
  // first solid point along a segment (for the camera boom): fraction 0..1
  function boom(from, to, pad = 0.35) {
    const len = from.distanceTo(to), n = Math.ceil(len / 0.2);
    for (let i = 1; i <= n; i++) { const k = i / n, x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k, z = from.z + (to.z - from.z) * k;
      if (y < groundAt(x, z) + 0.25) return Math.max(0, (i - 1) / n - pad / len);
      for (const s of near(x, z)) if (y < s.h && s.tag !== 'pond' && s.tag !== 'soft' && s.tag !== 'tree' && sdf(s, x, z) < 0.25) return Math.max(0, (i - 1) / n - pad / len); }
    return 1;
  }

  // ------- build from the scene -------
  const _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

  function shapeOf(mesh) {
    mesh.updateWorldMatrix(true, false); mesh.matrixWorld.decompose(_w, _q, _s); const ry = _e.setFromQuaternion(_q, 'YXZ').y, gp = mesh.geometry.parameters;
    const h = _w.y + (gp.height || 4) * _s.y / 2;
    if (mesh.geometry.type === 'CylinderGeometry') return { type: 'circle', x: _w.x, z: _w.z, r: gp.radiusTop * _s.x, h };
    if (mesh.geometry.type === 'BoxGeometry') return { type: 'box', x: _w.x, z: _w.z, hw: gp.width * _s.x / 2, hd: gp.depth * _s.z / 2, c: Math.cos(ry), s: Math.sin(ry), h };
    return null;
  }
  const atts = []; // { a, shapes } — solid footprints block you; the others only answer "how near am I?"
  function addAttraction(a, solid = true) {
    const list = (a.hits || []).map(shapeOf).filter(Boolean);
    for (const s of list) { s.tag = solid ? 'att' : 'probe'; if (solid) insert(s); }
    atts.push({ a, shapes: list });
  }
  function addStatic({ trunks = [], posts = [], benches = [] } = {}) {
    // shops (body ~5.6 × 4.8, rotated to face the boulevard) and the popcorn cart
    for (const [kind, x, z, f] of L.shops) box(x, z, kind === 'popcorn' ? 3.2 : 6.2, kind === 'popcorn' ? 2.8 : 5.4, f > 0 ? Math.PI / 2 : -Math.PI / 2, 5, 'shop');
    // gate towers and their bases
    // the gatehouse: its piers (the central and side arches stay open) and the ticket pavilions
    for (const s of [-1, 1]) { box(L.gate.x + s * 3.6, L.gate.z, 1.3, 6.4, 0, 18, 'gate'); box(L.gate.x + s * 7.1, L.gate.z, 1.2, 6.4, 0, 18, 'gate'); circle(L.gate.x + s * 12.2, L.gate.z + 1.5, 2.7, 9, 'gate'); }
    // castle: keep, curtain walls and towers, all behind the gate face
    const cz = L.castle.z, cy = L.castle.h;
    const cs = L.castle.scale || 1, cz0 = cz + (L.castle.front || 0) * (1 - cs);
    box(0, cz0 - 4.5 * cs, 58 * cs, 27 * cs, 0, cy + 52 * cs, 'castle');                                                   // the château on its terrace (the stair in front stays walkable)
    // the garden pond (an ellipse-ish ring of circles; the bridge deck is exempt)
    for (let i = 0; i < 9; i++) { const u = (i / 8 - 0.5) * 2; circle(G.x + u * 7.2, G.z, 5.6 - Math.abs(u) * 2.4, 0.4, 'pond'); }
    for (const t of trunks) circle(t.x, t.z, t.r, 6, 'tree');
    for (const p of posts) circle(p.x, p.z, 0.22, 4, 'soft');
    for (const b of benches) box(b.x, b.z, 1.9, 0.7, b.ry, 0.9, 'soft');
  }

  // the nearest attraction you can walk up to (within `reach` metres of its footprint)
  function nearestAttraction(x, z, reach = 2.6) {
    let best = null, bd = reach;
    for (const { a, shapes: ss } of atts) for (const s of ss) { const d = sdf(s, x, z); if (d < bd) { bd = d; best = a; } }
    return best ? { a: best, d: bd } : null;
  }
  // a good place to stand in front of an attraction (toward the plaza), for fast travel
  function standPoint(a) {
    const e = atts.find(o => o.a === a); if (!e || !e.shapes.length) return null; const s = e.shapes[0];
    let dx = -s.x, dz = -s.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const p = { x: s.x, z: s.z }; for (let k = 0; k < 80; k++) { p.x = s.x + dx * k * 0.5; p.z = s.z + dz * k * 0.5; if (sdf(s, p.x, p.z) > 1.6 && inBounds(p.x, p.z) && !blocked(p.x, p.z, 0.5)) break; }
    return { x: p.x, z: p.z, yaw: Math.atan2(-dx, -dz) };
  }
  const blocked = (x, z, r) => { for (const s of near(x, z)) if (sdf(s, x, z) < r) return true; return false; };

  return { shapes, circle, box, platform, resolve, inBounds, groundAt, boom, addAttraction, addStatic, nearestAttraction, standPoint, blocked, sdf, onBridge };
}

export { createWalkWorld };
