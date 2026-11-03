/* =========================================================================
   GOLDEN HEART HUNT — twelve small golden hearts hidden in nooks all over the park (under the garden bridge,
   on the castle balcony, behind the toy shop, inside the coaster's flower tunnel…). They glint and turn;
   click one to collect it. Progress is kept between visits; the card shows a riddle for the next heart and
   finding them all sets off a fireworks show. Every heart is registered with the picker as a fine target.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { heartGeo } from '../core/geo.js';
import { attraction, HIT } from './base.js';

const L = CONFIG.layout, V = (x, y, z) => new THREE.Vector3(x, y, z);
// [x, y, z, riddle]
const SPOTS = [
  [L.garden.x + 0.6, 0.55, L.garden.z + 1.5, 'Where swans glide under wooden planks.'],
  [6, -1, L.castle.z + 14, 'On the castle terrace, where the princess waves from above.'],
  [L.coaster[0] - 6.4, 1.1, L.coaster[1] - 4.2, 'Inside a tunnel made of flowers.'],
  [12.3, 0.4, 33.4, 'Behind the shop that sells teddy bears.'],
  [0, 0.9, 7.4, 'On the rim of the wishing fountain, facing the boulevard.'],
  [L.ferris[0] - 6.6, 1.3, L.ferris[1] + 4.4, 'Where tickets for the wheel are sold.'],
  [L.stage[0] + 6, 0.6, L.stage[1] - 2, 'Backstage, behind the speakers.'],
  [L.observatory[0] + 3.4, 0.5, L.observatory[1] + 3.5, "At the foot of the stargazers' tower."],
  [L.golf[0] + 2, 0.7, L.golf[1] - 4.5, 'Beside the little scoreboard on the green.'],
  [L.balloons[0] + 4.6, 0.6, L.balloons[1] + 0.3, 'Tied where the sky balloons are moored.'],
  [-L.gate.x - 9.2, 0.6, L.gate.z - 3.4, "Guarding the gate, at the foot of the colonnade."],
  [L.drop[0] - 4.1, 0.45, L.drop[1] + 0.4, 'Under the fence of the tallest tower.'],
];

export function create() {
  const root = new THREE.Group(); root.name = 'treasure';
  const geo = heartGeo(0.22, 0.1), mat = new THREE.MeshStandardMaterial({ color: '#FFD68A', metalness: 1, roughness: 0.22, emissive: '#FFB35A', emissiveIntensity: 0.45 });
  let found = new Set(); try { JSON.parse(localStorage.getItem('sweetheart-hearts') || '[]').forEach(i => found.add(i)); } catch (e) {}
  const save = () => { try { localStorage.setItem('sweetheart-hearts', JSON.stringify([...found])); } catch (e) {} };
  const hearts = SPOTS.map(([x, y, z, hint], i) => { const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); const pick = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), HIT); g.add(pick); pick.userData.heart = i;
    g.visible = !found.has(i); return { g, m, pick, hint, i }; });
  const a = attraction({ id: 'treasure', kind: 'experience', name: 'Golden Heart Hunt', icon: '💛', zone: 'All around the park',
    desc: 'Twelve little golden hearts are hidden all over the park. Follow the riddles, click a heart when you spot it, and find them all for a fireworks surprise.',
    object3D: root, focus: { target: [0, 3, 0], dist: 70, height: 50 } });
  a.noScale = true; a.hits = []; a.pickables = hearts.map(h => h.pick);
  a.state = () => ({ found: found.size, total: SPOTS.length, hint: (hearts.find(h => !found.has(h.i)) || {}).hint });
  a.nextHint = () => { const h = hearts.find(h => !found.has(h.i)); return h ? h.hint : null; };
  a.hintFocus = () => { const h = hearts.find(h => !found.has(h.i)); return h ? { target: [h.g.position.x, h.g.position.y, h.g.position.z], dist: 16, height: 7 } : null; };
  a.onPick = (hit) => { const i = hit.obj.userData.heart; if (i === undefined || found.has(i)) return false;
    found.add(i); save(); const h = hearts[i]; h.collect = 1; a.sfx && a.sfx.ding && a.sfx.ding(); a.fx && (a.fx.sparkles(hit.point, 40, 1.4), a.fx.hearts(hit.point, 16, 0.8));
    a.ui && a.ui.toast('Golden heart found!', ['{n} of {t}', { n: found.size, t: SPOTS.length }], '💛');
    if (found.size === SPOTS.length) { a.ui && a.ui.toast('Every heart found!', 'The park is putting on a show just for you.', '🎆'); a.fx && a.fx.show && a.fx.show(14); a.sfx && a.sfx.fanfare && a.sfx.fanfare(); }
    a.ui && a.ui.refresh && a.ui.refresh(); return true; };
  a.spots = () => hearts.map(h => h.g);
  // walk into a heart to pick it up
  a.collectNear = (p, r = 1.3) => { for (const h of hearts) { if (found.has(h.i) || !h.g.visible) continue; const q = h.g.position; if (Math.hypot(q.x - p.x, q.z - p.z) < r && Math.abs(q.y - p.y - 0.8) < 1.6) return a.onPick({ obj: h.pick, point: q.clone() }); } return false; };
  a.reset = () => { found = new Set(); save(); hearts.forEach(h => { h.g.visible = true; h.collect = 0; h.g.scale.setScalar(1); }); };
  a.update = (dt, t) => { for (const h of hearts) { if (!h.g.visible) continue; h.m.rotation.y = t * 1.6 + h.i; h.m.position.y = Math.sin(t * 2 + h.i) * 0.06;
    if (h.collect) { h.collect += dt * 2.5; h.g.position.y += dt * 2; h.g.scale.setScalar(Math.max(0, 1.6 - h.collect)); if (h.collect > 1.6) h.g.visible = false; } } };
  return a;
}
