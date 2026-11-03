/* =========================================================================
   PARK — composes the world around the rides: plaza furniture (benches facing the fountain, a ring of lamps,
   flower beds), the boulevard's lamp-and-tree avenue with string lights overhead, lamps and benches around
   the promenade, trees and flowers filling every gap (kept clear of paths and rides), the perimeter hedge,
   and a low-poly forest across the far hills. Returns the string-light points for the fx layer.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rand, R, pick } from '../core/geo.js';
import { heightAt } from './ground.js';
import { keepClear } from './horizon.js';
import { fbm, smooth } from '../../core/utils.js';
import { BOOT_TIER } from '../core/renderer.js';

const L = CONFIG.layout, PI = Math.PI, TAU = PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
// footprints that trees and beds must keep out of: [x, z, radius]
function keepOut() {
  const ids = { ferris: 16, carousel: 12, teacups: 10, coaster: 0, swings: 13, bumper: 12, balloons: 12, pirate: 13, drop: 7, ringToss: 6, claw: 6, stage: 14, observatory: 9, golf: 12, fishing: 8, gallery: 7, photo: 4.5, maze: 9.5, fountainShow: 11 };
  const k = Object.entries(ids).filter(([, r]) => r).map(([id, r]) => [...L[id], r]);
  for (let z = -32; z <= 14; z += 4) k.push([L.coaster[0], L.coaster[1] + z, 10]);
  for (const [, x, z] of L.shops) k.push([x, z, 6.5]);
  k.push([L.garden.x, L.garden.z, 21]);
  return k;
}
function onPath(x, z) {
  const r = Math.hypot(x, z), b = L.boulevard, rp = L.ringPath;
  if (r < L.plaza.r + 1.5) return true;
  if (Math.abs(r - rp.r) < rp.w / 2 + 1.2) return true;
  if (Math.abs(x - b.x) < b.w / 2 + 1.5 && z > b.z0 - 2 && z < b.z1) return true;
  if (Math.abs(r - L.trainRadius) < 2.4) return true;
  if (Math.abs(x) < 5 && z < -20) return true; // the Castle Hill path
  for (const id of ['ferris', 'carousel', 'teacups', 'swings', 'bumper', 'balloons', 'pirate', 'drop', 'ringToss', 'claw', 'stage', 'observatory', 'golf', 'fishing', 'gallery']) { const [ax, az] = L[id], d = Math.hypot(ax, az), ux = ax / d, uz = az / d, along = x * ux + z * uz, across = Math.abs(-x * uz + z * ux); if (along > rp.r && along < d && across < 2.6) return true; }
  return false;
}

function createPark(veg, props, lights) {
  const bulbs = [], ko = keepOut(), clear = (x, z, pad = 0) => !onPath(x, z) && ko.every(([ax, az, r]) => (x - ax) ** 2 + (z - az) ** 2 > (r + pad) ** 2);

  // plaza: 8 benches facing the fountain, 8 lamps, 4 quarter flower beds with gaps for the paths
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + PI / 8, r = 10.2; props.bench(Math.sin(a) * r, Math.cos(a) * r, a + PI); }
  const plazaLamps = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, r = 13.6; plazaLamps.push(props.lamp(Math.sin(a) * r, Math.cos(a) * r, { light: k % 4 === 0, double: true, ry: a })); }
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; for (let j = -2; j <= 2; j++) { const aa = a + j * 0.075; veg.bed(Math.sin(aa) * 12.2, Math.cos(aa) * 12.2, 0.8, 16); } }
  // string lights from each plaza lamp to the fountain's crown, and lamp to lamp
  const crown = V(0, 7.2, 0);
  plazaLamps.forEach((h, i) => { const n = plazaLamps[(i + 1) % plazaLamps.length]; swag(h, n, 14, 0.7); swag(h, crown, 18, 1.4); });

  // boulevard avenue: lamps, round trees in planters, benches, string lights criss-crossing overhead
  const b = L.boulevard, heads = [];
  for (let z = b.z0 + 4; z < b.z1 - 6; z += 8) for (const s of [-1, 1]) {
    if (Math.abs(z - L.trainRadius) < 4) continue; // the railway crosses here
    heads.push([s, props.lamp(b.x + s * (b.w / 2 + 0.9), z, { light: s > 0 && (z - b.z0) % 24 < 8 })]);
    if ((z - b.z0) % 16 < 8) { props.planter(b.x + s * (b.w / 2 + 1.0), z + 4, 1.0); veg.tree((z / 16 | 0) % 2 ? 'cherry' : 'maple', b.x + s * (b.w / 2 + 1.0), z + 4, 0.7, 0.4); }
    else props.bench(b.x + s * (b.w / 2 + 0.9), z + 4, s > 0 ? -PI / 2 : PI / 2);
  }
  for (let i = 0; i + 3 < heads.length; i += 2) { swag(heads[i][1], heads[i + 3][1], 20, 1.2); swag(heads[i + 1][1], heads[i + 2][1], 20, 1.2); }

  // promenade: lamps every so often, benches between
  for (let k = 0; k < 20; k++) { const a = (k + 0.5) / 20 * TAU, r = L.ringPath.r + L.ringPath.w / 2 + 1.0, x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.abs(x) < b.w && z > 0) continue; if (k % 2) props.lamp(x, z, { ry: a }); else if (clear(x, z, -5)) props.bench(x, z, a + PI); }

  // fill the land: species by area, flower beds in clearings, tufts everywhere
  let placed = 0;
  for (let i = 0; i < 4000 && placed < 240; i++) {
    const a = rand() * TAU, r = Math.sqrt(R(0.06, 1)) * (L.parkRadius - 3), x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!clear(x, z, 2)) continue; placed++;
    const kind = z < -20 ? pick(['oak', 'pine', 'birch', 'maple', 'cypress', 'oak']) : x < 0 ? pick(['cherry', 'cherry', 'wisteria', 'birch', 'maple']) : pick(['cherry', 'oak', 'maple', 'birch', 'pine', 'cypress']);
    veg.tree(kind, x, z, R(0.85, 1.25)); if (rand() < 0.5) veg.bush(x + R(-2.5, 2.5), z + R(-2.5, 2.5), R(0.8, 1.3));
  }
  for (let i = 0; i < 2600; i++) { const a = rand() * TAU, r = Math.sqrt(rand()) * (L.parkRadius - 2), x = Math.sin(a) * r, z = Math.cos(a) * r; if (!clear(x, z, 0)) continue;
    if (i % 9 === 0) veg.bed(x, z, R(0.8, 1.6), 22); else veg.tuft(x, z, R(0.8, 1.3)); }
  // the edges of every path: low flower borders
  for (let k = 0; k < 140; k++) { const a = k / 140 * TAU; for (const rr of [L.ringPath.r - L.ringPath.w / 2 - 0.7, L.ringPath.r + L.ringPath.w / 2 + 0.6]) { const x = Math.sin(a) * rr, z = Math.cos(a) * rr; if (!(Math.abs(x) < b.w && z > 0) && ko.every(([ax, az, r]) => (x - ax) ** 2 + (z - az) ** 2 > r * r)) veg.bed(x, z, 0.4, 3); } }

  props.hedgeRing(L.parkRadius, 0.12, 0, [PI, 0.055]);
  // far forest on the hills and lavender mountains beyond
  // woods, not a scatter: trees gather where a low-frequency mask is high (with clearings and meadows between),
  // and stand close together inside a wood, so the hills read as forest edges, groves and open slopes
  const woodMask = (x, z) => fbm(x * 0.012 + 4.1, z * 0.012 - 2.7, 1e6, 3, 23);
  const FAR_N = { high: 3200, medium: 2400, low: 1400 }[BOOT_TIER] || 2400;
  for (let i = 0, placed = 0; i < FAR_N * 6 && placed < FAR_N; i++) { const a = rand() * TAU, r = R(L.parkRadius + 6, 440), x = Math.sin(a) * r, z = Math.cos(a) * r; if (Math.hypot(x - L.castle.x, z - L.castle.z) < 48 || (Math.abs(x) < 9 && z < 0 && z > L.castle.z)) continue; if (Math.abs(x) < 10 && z > 0 && z < 140) continue;
    if (keepClear(x, z) || rand() > smooth(0.42, 0.6, woodMask(x, z)) + 0.04) continue; placed++;
    veg.farTree(x, heightAt(x, z) - 0.3, z, R(2.2, 3.6) * (1 + r / 300)); }

  function swag(a, b2, n, sag) { for (let i = 1; i < n; i++) { const u = i / n, p = a.clone().lerp(b2, u); p.y -= sag * 4 * u * (1 - u); bulbs.push(p); } }
  return { bulbs, clear, onPath };
}

export { createPark };
