/* =========================================================================
   CROWD — the park's other visitors. Each body part is one InstancedMesh shared by everybody (torso, head,
   hair, skirt, two legs, two arms, shoes, balloons on strings), so the whole crowd costs about a dozen
   draw calls; every frame each visitor's skeleton is posed on the CPU (walk cycle, idle sway, sitting).
   Variety: adults and children, skirts or trousers, skin tones, hair colours and lengths, outfit palettes,
   walking pace, a few balloons.
   After dark the balloons glow like paper lanterns. A street juggler works the plaza.
   Behaviour: visitors stroll a path graph (promenade ring, plaza, boulevard, the spurs to every ride), keep to
   their own lane, stop to watch rides and games, sit on benches for a while, step around you, and gather
   when the park puts on a show (gather(point)).
   SOCIAL LIFE — nobody here is a lone mannequin unless they choose to be:
   • couples walk side by side holding hands, sit together on one bench, stop and turn toward each other, and
     take turns photographing one another
   • friends go round in threes, stopping in a loose circle and talking with their hands
   • children stay at a parent's side
   • the big rides (wheel, coaster, carousel, tower, teacups) keep real queues: people join the back, shuffle
     forward as the line moves, fidget, and leave from the front
   • when the sky puts on a show (meteors, the Waltzers) or fireworks go up, people stop, tip their heads back
     and point
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { BOOT_TIER } from '../core/renderer.js';
import { patch } from '../core/nightlights.js';

const L = CONFIG.layout, TAU = Math.PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z), UPV = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
const R = (a, b) => a + (b - a) * Math.random(), pick = (a) => a[Math.floor(Math.random() * a.length)];
const SKIN = ['#F4D2BE', '#EBC1A4', '#D9A27E', '#B98260', '#8E5C40', '#F7DCCB'];
const HAIR = ['#2B1E1A', '#4A3226', '#6E4B34', '#A0703F', '#D8B072', '#1C1C24', '#8C3A2E', '#E8D6B8'];
const TOPS = ['#F2B7C4', '#C9B6E6', '#A8D8C8', '#FFF1D6', '#F6D28A', '#9FC3E6', '#E8A0A0', '#FFFFFF', '#7FA8C9', '#D6C2A8'];
const BOTTOMS = ['#4B5A7A', '#6E5A4A', '#2E3448', '#C9B6E6', '#F2B7C4', '#E9DCC4', '#7D8F6A', '#3C3C46'];
const BALLOON = ['#FF8FB0', '#FFD36E', '#9FD6FF', '#C7A6FF', '#FF9E7A'];

function createCrowd({ walk, attractions, benches, player }) {
  const N = { high: 170, medium: 110, low: 50 }[BOOT_TIER];
  // ---------- the path graph ----------
  const nodes = [], link = (a, b) => { if (a !== b && !nodes[a].n.includes(b)) { nodes[a].n.push(b); nodes[b].n.push(a); } };
  const node = (x, z, tag = null) => { nodes.push({ p: V(x, walk.groundAt(x, z), z), n: [], tag }); return nodes.length - 1; };
  const ring = []; for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; ring.push(node(Math.sin(a) * L.ringPath.r, Math.cos(a) * L.ringPath.r)); }
  ring.forEach((n, k) => link(n, ring[(k + 1) % ring.length]));
  const plaza = []; for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; plaza.push(node(Math.sin(a) * 12.6, Math.cos(a) * 12.6, 'plaza')); }
  plaza.forEach((n, k) => { link(n, plaza[(k + 1) % 8]); const a = (k + 0.5) / 8 * TAU, ri = Math.round(a / TAU * 28) % 28; link(n, ring[ri]); });
  let prev = ring[0]; for (let z = L.boulevard.z0 + 6; z <= L.boulevard.z1 - 2; z += 9) { const n = node(0, z, 'boulevard'); link(prev, n); prev = n; }
  const gateN = prev;
  for (const a of attractions) {
    if (['treasure', 'train', 'fountain', 'lookout'].includes(a.id)) continue;
    const sp = walk.standPoint(a); if (!sp || Math.hypot(sp.x, sp.z) > L.parkRadius - 4) continue;
    const n = node(sp.x, sp.z, a); let best = ring[0], bd = 1e9; for (const r of ring) { const d = nodes[r].p.distanceTo(nodes[n].p); if (d < bd) { bd = d; best = r; } }
    if (bd > 9) { const m = node((nodes[n].p.x + nodes[best].p.x) / 2, (nodes[n].p.z + nodes[best].p.z) / 2); link(best, m); link(m, n); } else link(best, n);
  }
  const seats = benches.map(b => ({ x: b.x + Math.sin(b.ry) * 0.05, z: b.z + Math.cos(b.ry) * 0.05, yaw: b.ry, used: false }));

  // ---------- the people ----------
  const people = [];
  for (let i = 0; i < N; i++) {
    const kid = Math.random() < 0.22, skirt = Math.random() < 0.55, start = Math.floor(Math.random() * nodes.length);
    const p = nodes[start].p.clone().add(V(R(-1, 1), 0, R(-1, 1)));
    people.push({ p, yaw: R(0, TAU), at: start, to: pick(nodes[start].n.length ? nodes[start].n : [start]), from: start, lane: R(-0.9, 0.9), speed: kid ? R(1.1, 1.5) : R(0.85, 1.35),
      scale: kid ? R(0.6, 0.72) : R(0.92, 1.07), skirt, kid, phase: R(0, TAU), state: 'walk', t: 0, wait: 0, seat: null, look: null, gather: null,
      skin: pick(SKIN), hair: pick(HAIR), top: pick(TOPS), bottom: pick(BOTTOMS), long: skirt ? R(0.9, 1.5) : R(0.7, 1.0), balloon: kid && Math.random() < 0.6 ? pick(BALLOON) : (Math.random() < 0.06 ? pick(BALLOON) : null) });
  }

  // ---------- social units: couples, friends in threes, children with a parent ----------
  // a follower walks at its leader's pace, holding a slot beside it (off.x to the leader's side, off.y behind)
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const solo = shuffle(people.slice(1).filter(h => !h.kid)), kids = people.slice(1).filter(h => h.kid);
  const follow = (f, l, ox, oy) => { f.lead = l; f.off = { x: ox, y: oy }; f.speed = l.speed; f.p.copy(l.p).add(V(ox, 0, -oy)); (l.unit = l.unit || []).push(f); };
  let k = 0;
  for (let c = Math.floor(solo.length * 0.36 / 2); c > 0 && k + 1 < solo.length; c--) { const a = solo[k++], b = solo[k++]; follow(b, a, 0.6, 0); a.partner = b; b.partner = a; }
  for (let g = Math.floor(solo.length * 0.12 / 3); g > 0 && k + 2 < solo.length; g--) { const a = solo[k++]; follow(solo[k++], a, 0.75, 0.25); follow(solo[k++], a, -0.75, 0.3); a.friends = true; }
  const parents = solo.slice(k); for (const kd of kids) { if (Math.random() < 0.7 && parents.length) { const pa = parents[Math.floor(Math.random() * parents.length)]; if ((pa.unit || []).length < 2) follow(kd, pa, (pa.unit ? -0.55 : 0.55), 0.05); } }
  const leaders = people.filter(h => !h.lead), followers = people.filter(h => h.lead);

  // ---------- queues at the big rides ----------
  const queues = new Map();
  for (const a of attractions) {
    if (!['ferris', 'coaster', 'carousel', 'drop', 'teacups'].includes(a.id)) continue;
    const sp = walk.standPoint(a); if (!sp) continue; const c = a.object3D.position, dx = sp.x - c.x, dz = sp.z - c.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    const slots = []; for (let i = 0; i < 12 && slots.length < 9; i++) { const x = sp.x + ux * 1.15 * i - uz * Math.sin(i * 0.8) * 0.3, z = sp.z + uz * 1.15 * i + ux * Math.sin(i * 0.8) * 0.3; if (walk.inBounds(x, z) && !walk.blocked(x, z, 0.35)) slots.push({ x, z }); }
    if (slots.length > 3) queues.set(a, { slots, occ: slots.map(() => null), timer: R(3, 7), face: Math.atan2(-ux, -uz), ux, uz });
  }
  function joinQueue(h, q) { const i = q.occ.indexOf(null); if (i < 0 || q.occ.slice(i).some(Boolean)) return false; q.occ[i] = h; h.q = q; h.qi = i; h.state = 'queue'; return true; }
  function stepQueues(dt) { for (const q of queues.values()) { if ((q.timer -= dt) > 0) continue; q.timer = R(4.5, 9);
    const f = q.occ[0]; if (f) { f.q = null; f.state = 'walk'; const nd = nodes[f.at]; f.from = f.at; f.to = pick(nd.n.length ? nd.n : [f.at]); }
    for (let i = 0; i < q.occ.length - 1; i++) { q.occ[i] = q.occ[i + 1]; if (q.occ[i]) q.occ[i].qi = i; } q.occ[q.occ.length - 1] = null; } }
  // open with lines already formed, so the park is busy from the first frame
  { const pool = shuffle(leaders.filter(h => h !== people[0])); let pi = 0;
    for (const [a, q] of queues) { const at = nodes.findIndex(n => n.tag === a); for (let i = 0; i < Math.min(q.slots.length - 2, 6) && pi < pool.length; i++) { const h = pool[pi++]; if (at >= 0) { h.at = h.from = h.to = at; }
      if (joinQueue(h, q)) { h.p.set(q.slots[h.qi].x, walk.groundAt(q.slots[h.qi].x, q.slots[h.qi].z), q.slots[h.qi].z); for (const f of h.unit || []) f.p.copy(h.p).add(V(q.ux * 0.55, 0, q.uz * 0.55)); } } } }

  // ---------- body parts ----------
  const mat = () => { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 }); patch(m); return m; };
  const torsoG = new THREE.LatheGeometry([[0.001, 0], [0.13, 0], [0.12, 0.12], [0.135, 0.3], [0.15, 0.42], [0.09, 0.5], [0.001, 0.52]].map(([r, y]) => new THREE.Vector2(r, y)), 14).scale(1, 1, 0.75);
  const parts = {
    torso: torsoG, head: new THREE.SphereGeometry(0.105, 14, 10).scale(1, 1.12, 1), hair: new THREE.SphereGeometry(0.118, 14, 10, 0, TAU, 0, Math.PI * 0.62).translate(0, 0.012, -0.01),
    tail: new THREE.CapsuleGeometry(0.05, 0.18, 3, 8).translate(0, -0.1, 0),
    skirt: new THREE.LatheGeometry([[0.13, 0.02], [0.2, -0.16], [0.29, -0.42], [0.3, -0.45]].map(([r, y]) => new THREE.Vector2(r, y)), 18),
    leg: new THREE.CapsuleGeometry(0.055, 0.72, 3, 8).translate(0, -0.42, 0), arm: new THREE.CapsuleGeometry(0.042, 0.5, 3, 8).translate(0, -0.29, 0),
    shoe: new THREE.CapsuleGeometry(0.045, 0.1, 3, 8).rotateX(Math.PI / 2).scale(1, 0.6, 1).translate(0, -0.84, 0.04),
    balloon: new THREE.SphereGeometry(0.22, 14, 12).scale(1, 1.15, 1), string: new THREE.CylinderGeometry(0.004, 0.004, 1.1, 3).translate(0, -0.55, 0),
  };
  const counts = { torso: N, head: N, hair: N, tail: N, skirt: N, leg: N * 2, arm: N * 2, shoe: N * 2, balloon: N, string: N };
  const IM = {}; const root = new THREE.Group(); root.name = 'crowd';
  // an evenly glowing paper-lantern balloon: no sheen rim (seen from below a sheen rim around a darker centre read as a glowing ring)
  const lanternM = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.7 });
  lanternM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.55;'); }; // balloons glow softly like paper lanterns (not white-hot)
  for (const [k, g] of Object.entries(parts)) { const m = new THREE.InstancedMesh(g, k === 'balloon' ? lanternM : mat(), counts[k]);
    if (k === 'balloon') patch(m.material); m.castShadow = ['torso', 'skirt', 'leg'].includes(k); m.receiveShadow = true; m.frustumCulled = false; IM[k] = m; root.add(m); }
  const col = new THREE.Color();
  people.forEach((h, i) => {
    IM.torso.setColorAt(i, col.set(h.top)); IM.head.setColorAt(i, col.set(h.skin)); IM.hair.setColorAt(i, col.set(h.hair)); IM.tail.setColorAt(i, col.set(h.hair));
    IM.skirt.setColorAt(i, col.set(h.skirt ? h.bottom : h.top)); IM.balloon.setColorAt(i, col.set(h.balloon || '#fff')); IM.string.setColorAt(i, col.set('#ffffff'));
    for (const s of [0, 1]) { IM.leg.setColorAt(i * 2 + s, col.set(h.skirt ? h.skin : h.bottom)); IM.arm.setColorAt(i * 2 + s, col.set(Math.random() < 0.5 ? h.top : h.skin)); IM.shoe.setColorAt(i * 2 + s, col.set(pick(['#3A2A2A', '#F4F0E8', '#7A4A3A', '#2E3448']))); }
  });

  // ---------- behaviour ----------
  const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const _tg = new THREE.Vector3(), target = (h) => { const a = nodes[h.from].p, b = nodes[h.to].p, dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return _tg.set(b.x - dz / l * h.lane, b.y, b.z + dx / l * h.lane); };
  function arrive(h) {
    const nd = nodes[h.to]; h.at = h.to;
    if (nd.tag && queues.has(nd.tag) && Math.random() < 0.5 && joinQueue(h, queues.get(nd.tag))) return;
    if (nd.tag && typeof nd.tag === 'object' && Math.random() < 0.55) { h.state = 'watch'; h.t = R(5, 14); h.photo = Math.random() < (h.partner ? 0.6 : 0.35); const c = nd.tag.object3D.position; h.look = Math.atan2(c.x - h.p.x, c.z - h.p.z); return; }
    if (nd.tag === 'plaza' && Math.random() < 0.35) { h.state = 'watch'; h.t = R(4, 10); h.look = Math.atan2(-h.p.x, -h.p.z); return; }
    if (Math.random() < 0.18) { const free = seats.filter(s => !s.used && Math.hypot(s.x - h.p.x, s.z - h.p.z) < 9); if (free.length) { h.seat = pick(free); h.seat.used = true; h.state = 'toSeat'; return; } }
    const opts = nd.n.filter(n => n !== h.from); h.from = h.to; h.to = pick(opts.length ? opts : nd.n); h.lane = R(-0.9, 0.9);
  }
  function stepPerson(h, dt) {
    h.t -= dt;
    if (h.gaze && h.state !== 'sit' && h.state !== 'queue') { if ((h.gaze.t -= dt) <= 0) h.gaze = null; else { h.yaw = damp(h.yaw, h.gaze.face, dt); return 'idle'; } }
    if (h.state === 'queue') { const q = h.q, s = q.slots[h.qi]; if (Math.hypot(s.x - h.p.x, s.z - h.p.z) > 0.2) { moveTo(h, s.x, s.z, dt, 0.7); return 'walk'; } h.yaw = damp(h.yaw, q.face + Math.sin(el * 0.4 + h.phase) * 0.35, dt * 0.5); return 'idle'; }
    if (h.gather && h.state !== 'sit') { const g = h.gather; if ((g.t -= dt) <= 0) h.gather = null; else { const d = Math.hypot(g.x - h.p.x, g.z - h.p.z); if (d > 1.2) { moveTo(h, g.x, g.z, dt, 1.25); return 'walk'; } h.yaw = damp(h.yaw, g.face, dt); return 'idle'; } }
    if (h.state === 'watch') { h.yaw = damp(h.yaw, h.look, dt); if (h.t <= 0) { h.state = 'walk'; const nd = nodes[h.at]; h.from = h.at; h.to = pick(nd.n); } return 'idle'; }
    if (h.state === 'toSeat') { const s = h.seat; if (Math.hypot(s.x - h.p.x, s.z - h.p.z) > 0.25) { moveTo(h, s.x, s.z, dt, 1); return 'walk'; } h.state = 'sit'; h.t = R(12, 30); h.p.set(s.x, h.p.y, s.z); h.yaw = s.yaw; return 'sit'; }
    if (h.state === 'sit') { if (h.t <= 0 && !(h.partner && h.t > -25)) { h.seat.used = false; h.seat = null; h.state = 'walk'; const nd = nodes[h.at]; h.from = h.at; h.to = pick(nd.n.length ? nd.n : [h.at]); } return 'sit'; }
    const tg = target(h); if (Math.hypot(tg.x - h.p.x, tg.z - h.p.z) < 0.5) arrive(h); else moveTo(h, tg.x, tg.z, dt, 1);
    return 'walk';
  }
  // a follower mirrors its leader: walks at its side, sits beside it, queues behind it, stops when it stops
  function stepFollower(h, dt) {
    const l = h.lead, ly = l.yaw, rx = Math.cos(ly), rz = -Math.sin(ly), fx = Math.sin(ly), fz = Math.cos(ly);
    if (h.gaze) { if ((h.gaze.t -= dt) <= 0) h.gaze = null; else if (l.mode !== 'walk') { h.yaw = damp(h.yaw, h.gaze.face, dt); return 'idle'; } }
    if (l.state === 'sit' && l.seat) { const sx = l.seat.x + rx * h.off.x * 0.95, sz = l.seat.z + rz * h.off.x * 0.95;
      if (h.state !== 'sit' && Math.hypot(sx - h.p.x, sz - h.p.z) > 0.25) { moveTo(h, sx, sz, dt, 1); return 'walk'; } h.state = 'sit'; h.p.set(sx, l.p.y, sz); h.yaw = ly; return 'sit'; }
    h.state = 'walk';
    let tx = l.p.x + rx * h.off.x - fx * h.off.y, tz = l.p.z + rz * h.off.x - fz * h.off.y;
    if (l.state === 'queue') { tx = l.p.x + l.q.ux * 0.6 + rx * h.off.x * 0.3; tz = l.p.z + l.q.uz * 0.6 + rz * h.off.x * 0.3; }
    const d = Math.hypot(tx - h.p.x, tz - h.p.z);
    if (d > 0.18) { moveTo(h, tx, tz, dt, d > 1.2 ? 1.35 : l.mode === 'walk' ? 1 + (d - 0.3) * 0.5 : 0.7); return 'walk'; }
    if (l.mode === 'walk') { h.yaw = damp(h.yaw, ly, dt); return 'walk'; }
    // standing together: couples turn a little toward each other, friends face the middle of their circle
    const face = h.partner ? Math.atan2(l.p.x - h.p.x, l.p.z - h.p.z) * 0.45 + (l.look ?? ly) * 0.55 : Math.atan2(l.p.x - h.p.x, l.p.z - h.p.z);
    h.yaw = damp(h.yaw, l.state === 'queue' ? l.yaw : face, dt * 0.7); return 'idle';
  }
  const damp = (a, b, dt) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, dt * 4);
  function moveTo(h, x, z, dt, k) {
    let dx = x - h.p.x, dz = z - h.p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // step around the player
    if (player) { const px = player.x - h.p.x, pz = player.z - h.p.z, pd = Math.hypot(px, pz); if (pd < 1.6 && pd > 0.01 && px * dx + pz * dz > 0) { const sgn = (px * dz - pz * dx) > 0 ? 1 : -1; dx += -dz * sgn * 0.9; dz += dx * sgn * 0.9; const l2 = Math.hypot(dx, dz); dx /= l2; dz /= l2; } }
    const sp = h.speed * k; h.p.x += dx * sp * dt; h.p.z += dz * sp * dt; h.p.y = walk.groundAt(h.p.x, h.p.z); h.yaw = damp(h.yaw, Math.atan2(dx, dz), dt * 1.5);
  }
  // pose one part: person matrix × pivot × rotation × part
  const put = (im, i, pivot, rx = 0, rz = 0, extra = null) => { _l.makeRotationFromEuler(_e.set(rx, 0, rz)).setPosition(pivot); _b.multiplyMatrices(_m, _l); if (extra) _b.multiply(extra); im.setMatrixAt(i, _b); };
  const _p = new THREE.Vector3(), _x = new THREE.Matrix4();
  function pose(h, i, mode, t) {
    _q.setFromAxisAngle(UPV, h.yaw); _m.compose(h.p, _q, _s.setScalar(h.scale));
    const walkK = mode === 'walk' ? 1 : 0, sit = mode === 'sit', ph = h.phase, sw = Math.sin(ph) * 0.55 * walkK, bob = Math.abs(Math.cos(ph)) * 0.03 * walkK;
    const hipY = sit ? 0.52 : 0.92 - bob + 0.015, breathe = Math.sin(t * 1.7 + i) * 0.006;
    put(IM.torso, i, _p.set(0, hipY, 0), sit ? -0.08 : 0.04 * walkK + breathe);
    const watchSky = mode !== 'walk' && (h.gaze || (h.gather && h.gather.up) || (h.lead && h.lead.gather && h.lead.gather.up));
    h.up = (h.up || 0) + ((watchSky ? 0.62 : 0) - (h.up || 0)) * 0.05;   // heads tip back to watch the sky
    const nod = -h.up + (h.partner && mode === 'idle' ? Math.sin(t * 0.6 + i) * 0.04 : 0);
    put(IM.head, i, _p.set(Math.sin(t * 0.5 + i) * 0.01, hipY + 0.64, 0.01), nod, Math.sin(t * 0.7 + i * 3) * 0.05 + (h.partner && mode !== 'walk' ? (h.lead ? -0.08 : 0.08) : 0));
    put(IM.hair, i, _p.set(0, hipY + 0.645, 0), nod, 0, _x.makeScale(1, 1, 1));
    if (h.long > 1.05) put(IM.tail, i, _p.set(0, hipY + 0.69, -0.1), 0.25 + sw * 0.1, 0, _x.makeScale(1, h.long, 1)); else IM.tail.setMatrixAt(i, ZERO);
    if (h.skirt) put(IM.skirt, i, _p.set(0, hipY + 0.02, 0), sit ? -0.6 : sw * 0.05, 0, _x.makeScale(1, sit ? 0.6 : 1, 1)); else IM.skirt.setMatrixAt(i, ZERO);
    for (const s of [0, 1]) { const sg = s ? 1 : -1, a = sit ? -1.45 : sw * sg;
      put(IM.leg, i * 2 + s, _p.set(sg * 0.08, hipY, sit ? 0.02 : 0), a); put(IM.shoe, i * 2 + s, _p.set(sg * 0.08, hipY, sit ? 0.02 : 0), sit ? -1.45 : a);
      // hands: a couple holds hands on the inside (the leader's +x side, the follower's −x side); friends talk with
      // their hands; stargazers point; photographers raise the camera
      const pt = h.partner, holding = pt && !sit && Math.hypot(pt.p.x - h.p.x, pt.p.z - h.p.z) < 0.95 && pt.state !== 'sit' && h.state !== 'queue', inner = holding && (h.lead ? s === 0 : s === 1);
      const chat = mode === 'idle' && (h.friends || (h.lead && h.lead.friends)) && s === 1 && Math.sin(t * 0.7 + i * 1.7) > 0.2, point = h.gaze && mode !== 'walk' && s === 1 && (i % 3 === 0);
      let arm = h.perform === 'violin' ? (s === 0 ? -1.45 : -1.05 + Math.sin(t * 2.6) * 0.3) : h.perform ? -1.6 + Math.sin(t * 7 + s * Math.PI) * 0.45 : point ? -2.5 : inner ? -0.12 : chat ? -0.7 + Math.sin(t * 2.3 + i) * 0.3 : mode === 'idle' && h.photo && h.state === 'watch' ? -1.5 : h.balloon && s ? -2.4 : sit ? -0.5 : -sw * sg * 0.8;
      if (h.state === 'queue' && s === 0 && Math.sin(t * 0.5 + i) > 0.6) arm = -0.3;   // fidgeting in line
      put(IM.arm, i * 2 + s, _p.set(sg * 0.19, hipY + 0.46, 0), arm, h.perform === 'violin' ? (s === 0 ? 0.75 : -0.55 + Math.sin(t * 2.6) * 0.2) : sg * (inner ? 0.3 : 0.1)); }
    if (h.perform === 'violin') { _l.makeRotationFromEuler(_e.set(-0.25, 0.5, 0.35)).setPosition(_p.set(-0.08, hipY + 0.58, 0.12)); violin.matrix.multiplyMatrices(_m, _l); violin.matrixWorldNeedsUpdate = true; }
    if (h.balloon) { const bx = 0.19 + Math.sin(t * 1.3 + i) * 0.05, top = hipY + 0.46 + 0.5 + 1.0;
      put(IM.balloon, i, _p.set(bx, top + 0.25, -0.05 + Math.cos(t + i) * 0.05)); put(IM.string, i, _p.set(bx, top + 0.02, -0.04)); }
    else { IM.balloon.setMatrixAt(i, ZERO); IM.string.setMatrixAt(i, ZERO); }
  }

  // the street juggler: a fixed performer on the plaza with three glowing balls in the air
  const jug = people[0]; Object.assign(jug, { perform: true, state: 'perform', p: V(-8.2, 0, -15.6), yaw: Math.atan2(8.2, 15.6), balloon: null, skirt: false, top: '#C8577E', kid: false, scale: 1 });
  IM.torso.setColorAt(0, col.set('#C8577E')); IM.skirt.setColorAt(0, col.set('#5B3A6E')); for (const s of [0, 1]) IM.leg.setColorAt(s, col.set('#3E2A4A'));
  // the violinist: plays by the fountain ring for whoever stops; a violin under the chin, the bow arm sawing slowly
  const fid = people[1]; if (fid.lead) { const l = fid.lead; l.unit = (l.unit || []).filter(f => f !== fid); followers.splice(followers.indexOf(fid), 1); leaders.push(fid); fid.lead = null; l.partner = null; }
  for (const f of fid.unit || []) { f.lead = null; f.partner = null; followers.splice(followers.indexOf(f), 1); leaders.push(f); } fid.unit = []; fid.partner = null;
  if (fid.q) { fid.q.occ[fid.qi] = null; fid.q = null; }
  Object.assign(fid, { perform: 'violin', state: 'perform', p: V(10.8, 0, 9.6), yaw: Math.atan2(-10.8, -9.6), balloon: null, skirt: true, kid: false, scale: 1 });
  fid.p.y = walk.groundAt(fid.p.x, fid.p.z); IM.torso.setColorAt(1, col.set('#2E2440')); IM.skirt.setColorAt(1, col.set('#1E1A2A')); IM.hair.setColorAt(1, col.set('#2B1E1A'));
  const violin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.36).translate(0, 0, 0.12), new THREE.MeshStandardMaterial({ color: '#7A3E1E', roughness: 0.4 })); violin.matrixAutoUpdate = false; root.add(violin);
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), toneMapped: false }), 3); balls.frustumCulled = false; root.add(balls);
  const _bm = new THREE.Matrix4(), _bp = new THREE.Vector3(), _bq = new THREE.Quaternion();
  // a lantern parade: a dozen visitors take up glowing lanterns and walk the promenade in procession
  const parade = { t: 0, members: [], a0: 0 };
  function stepParade(dt) { if (parade.t <= 0) return; parade.t -= dt; const a = parade.a0 + (40 - parade.t) * 0.06;
    parade.members.forEach((h, k) => { const ak = a - k * 0.11, r = L.ringPath.r + (k % 2 ? 0.8 : -0.8); h.gather = { x: Math.sin(ak) * r, z: Math.cos(ak) * r, t: 0.5, face: ak + Math.PI / 2 }; });
    if (parade.t <= 0) parade.members.forEach(h => { h.balloon = h.prevBalloon; h.gather = null; }); }
  let el = 0, audT = 6, audK = 0;
  const api = {
    object3D: root, people, nodes,
    update(dt, t, pl) {
      el += dt; if (pl) player = pl;
      stepParade(dt);
      { const hp = jug.p; for (let k = 0; k < 3; k++) { const ph = (el * 1.3 + k / 3) % 1, x = Math.cos(ph * Math.PI * 2) * 0.35, y = 1.9 + Math.abs(Math.sin(ph * Math.PI * 2)) * 0.9;
        _bp.set(x, y, 0.35).applyAxisAngle(UPV, jug.yaw).add(hp); balls.setMatrixAt(k, _bm.compose(_bp, _bq, ONE)); } balls.instanceMatrix.needsUpdate = true; }
      stepQueues(dt); const ddt = Math.min(dt, 0.1);
      for (const h of leaders) h.mode = h.perform ? 'idle' : stepPerson(h, ddt);
      for (const h of followers) h.mode = stepFollower(h, ddt);
      // performers draw a small crowd now and then: passers-by stop in a loose ring to watch
      if ((audT -= dt) <= 0) { audT = R(28, 46); const pf = (audK++ % 2) ? jug.p : fid.p; api.gather(pf.x, pf.z, 3.6, R(20, 32), 26); }
      people.forEach((h, i) => { if (h.mode === 'walk') h.phase += dt * h.speed * (h.kid ? 7.5 : 6); pose(h, i, h.mode, el); });
      for (const im of Object.values(IM)) im.instanceMatrix.needsUpdate = true;
    },
    // the park calls everyone nearby over to watch something
    gather(x, z, radius = 10, seconds = 40, reach = 70, up = false) {
      for (const h of leaders) { if (h.state === 'sit' || h.state === 'queue' || h.perform || Math.hypot(h.p.x - x, h.p.z - z) > reach || Math.random() < 0.25) continue;
        const a = R(0, TAU), r = R(radius * 0.5, radius); const gx = x + Math.cos(a) * r, gz = z + Math.sin(a) * r;
        if (walk.blocked(gx, gz, 0.4) || !walk.inBounds(gx, gz)) continue; h.gather = { x: gx, z: gz, t: seconds, face: Math.atan2(x - gx, z - gz), up }; }
    },
    // the sky is putting on a show: a share of the park stops where it stands and looks up toward it
    stargaze(dir, seconds = 20) { const face = Math.atan2(dir.x, dir.z);
      for (const h of leaders) { if (h.perform || Math.random() < 0.4) continue; const g = { t: seconds * R(0.6, 1), face: face + R(-0.5, 0.5) }; for (const f of [h, ...(h.unit || [])]) f.gaze = { ...g }; } },
    parade(seconds = 40) { parade.t = seconds; parade.a0 = Math.random() * Math.PI * 2; parade.members = people.filter(h => !h.perform && h.state !== 'sit').slice(0, 14);
      parade.members.forEach((h, k) => { h.prevBalloon = h.balloon; h.balloon = ['#FFC98A', '#FF9EC0', '#FFE0A8'][k % 3]; IM.balloon.setColorAt(people.indexOf(h), new THREE.Color(h.balloon)); }); IM.balloon.instanceColor.needsUpdate = true; },
    juggler: () => jug.p, fiddler: () => fid.p,
    nearby(x, z, r = 15) { let n = 0; for (const h of people) if (Math.abs(h.p.x - x) < r && Math.abs(h.p.z - z) < r) n++; return n; },
  };
  return api;
}

export { createCrowd };
