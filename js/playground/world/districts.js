/* =========================================================================
   DISTRICTS — two new places to spend time, both walk-up interactive:
   • Rose Café — a timber terrace beside the boulevard near the gate: a counter kiosk under a scalloped
     awning, round bistro tables with chairs and parasols, planters, a lantern string overhead. Press E to
     order (a different treat each time; a sip restores your sprint stamina).
   • Lovers' Lookout — an open gazebo with a lavender dome at the edge of the castle terrace, benches facing
     back over the whole park: the fireworks viewing spot. Press E to sit and watch a show (night falls first).
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox } from '../core/geo.js';
import { paint, gold, wood, stone, fabric, shingle, plaster, lampGlass } from '../core/materials.js';
void 0;
import { attraction, hitBox, hitCylinder } from '../attractions/base.js';
import { heightAt } from './ground.js';
import { scanned } from '../core/scans.js';
import { waterMaterial } from '../core/water.js';
import { WIND } from '../core/materials.js';
import { nightness } from '../core/mood.js';

const L = CONFIG.layout, V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
const TREATS = ['a rose-petal latte', 'a strawberry macaron tower', 'a lavender honey cake', 'a glass of pink lemonade', 'a warm cinnamon heart', 'a peach & cream parfait'];

function cafe(lights) {
  const cx = -17.5, cz = 72, root = new THREE.Group(); root.name = 'cafe'; root.position.set(cx, 0, cz);
  const B = createBatch('cafe'), c = { cast: true }, deck = wood('#B98A62', 4), cream = plaster('#FFF4E6', 1), g = gold();
  B.add(rbox(13, 0.3, 11, 0.06, 2).translate(0, 0.15, 0), deck, null, c);
  for (let i = -6; i <= 6; i += 1.5) for (const s of [-1, 1]) if (Math.abs(i) < 6.1) B.add(rbox(0.12, 0.9, 0.12, 0.03, 1).translate(i, 0.75, s * 5.4), paint('#FFF5E1', 0.5), null, c); // balustrade posts
  for (const s of [-1, 1]) B.add(rbox(13, 0.1, 0.16, 0.03, 1).translate(0, 1.2, s * 5.4), paint('#FFF5E1', 0.5), null, c);
  // kiosk: cream walls, scalloped striped awning, counter, menu board, heart sign
  B.add(rbox(4.8, 3.2, 2.6, 0.12, 2).translate(-3.6, 1.9, -3.6), cream, null, c);
  B.add(rbox(5.2, 0.24, 3.0, 0.08, 2).translate(-3.6, 3.6, -3.6), paint('#E8A1B5', 0.5), null, c);
  B.add(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 8).rotateZ(PI / 2).translate(-3.6, 3.0, -2.2), g);
  B.add(new THREE.PlaneGeometry(5.2, 1.2, 1, 1).rotateX(-0.9).translate(-3.6, 2.9, -1.75), fabric('#F2A7BC', '#FFF5E1', 10, 1, 1), null, c);
  for (let i = 0; i < 9; i++) B.add(new THREE.CircleGeometry(0.29, 12, PI, PI).translate(-5.92 + i * 0.58, 2.42, -1.33), fabric('#F2A7BC', '#F2A7BC', 2), null, c);
  B.add(rbox(4.4, 1.05, 0.7, 0.06, 2).translate(-3.6, 0.82, -2.0), wood('#8A5A44', 1), null, c);
  B.add(rbox(4.5, 0.08, 0.8, 0.03, 1).translate(-3.6, 1.38, -2.0), stone(1, '#F1E6DA'), null, c);
  B.add(heartGeo(0.42, 0.14).translate(-3.6, 4.15, -2.15), g);
  // bistro sets: table, two chairs, a parasol
  const sets = [[1.4, -2.6], [4.4, -2.6], [1.4, 1.4], [4.4, 1.4], [-3.4, 2.2]];
  for (const [x, z] of sets) {
    B.add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20).translate(x, 1.05, z), stone(1, '#FBF4EA'), null, c);
    B.add(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 8).translate(x, 0.68, z), paint('#3F3350', 0.5), null, c);
    B.add(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 12).translate(x, 0.32, z), paint('#3F3350', 0.5));
    for (const s of [-1, 1]) { const chx = x + s * 0.78; B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14).translate(chx, 0.75, z), paint('#E9BE6A', 0.45), null, c);
      B.add(rbox(0.05, 0.5, 0.42, 0.02, 1).translate(chx + s * 0.2, 1.02, z), paint('#E9BE6A', 0.45), null, c);
      for (const q of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) B.add(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 5).translate(chx + q[0], 0.52, z + q[1]), paint('#3F3350', 0.5)); }
    B.add(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6).translate(x, 2.1, z), g);
    B.add(new THREE.ConeGeometry(1.35, 0.55, 12, 1, true).translate(x, 3.1, z), fabric('#FFF5E1', '#A8D8C8', 12, 1, 1), null, c);
  }
  B.build(root);
  // lantern string from the kiosk to the far corner
  const lantern = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), lampGlass('#FFD9A8', 2.4), 22), m = new THREE.Matrix4();
  for (let i = 0; i < 22; i++) { const u = i / 21, sag = Math.sin(u * PI) * 0.7; m.makeTranslation(-1.2 + u * 7.2, 3.9 - sag, -3.2 + u * 6.4 * (i % 2 ? 1 : 0.92)); lantern.setMatrixAt(i, m); }
  root.add(lantern); lights && lights.addLocal(V(cx + 2, 3.4, cz), '#FFC994', 22, 14);
  let n = 0;
  const a = attraction({ id: 'cafe', kind: 'experience', name: 'Rose Café', icon: '☕', zone: 'Sweetheart Boulevard', object3D: root,
    desc: 'A sunny terrace for two beside the boulevard: pastries, pink lemonade and the best people-watching in the park. Order something sweet — it puts the spring back in your step.',
    focus: { target: [cx, 1.6, cz], dist: 13, height: 6 } });
  a.hits = [hitBox(root, 13, 4.2, 11, 0)]; a.platform = (w) => w.platform({ type: 'box', x: cx, z: cz, hw: 6.5, hd: 5.5, c: 1, s: 0, top: 0.3 }); a.solid = (w) => { w.box(cx - 3.6, cz - 3.6, 4.8, 2.8, 0, 4, 'shop'); for (const [x, z] of sets) w.circle(cx + x, cz + z, 0.55, 1.2, 'soft'); };
  a.playLabel = 'Order a treat';
  a.play = () => { const tr = TREATS[n++ % TREATS.length]; a.ui && a.ui.toast('Bon appétit!', ['You enjoy {p}.', { p: tr }], '☕'); a.sfx && a.sfx.clink && a.sfx.clink(); a.fx && a.fx.hearts(V(cx - 3.6, 2, cz - 1.6), 14, 0.6); a.onTreat && a.onTreat(); };
  a.noScale = true;
  return a;
}

function lookout(lights) {
  const cf = L.castle.z + 9, gx = -15, gz = cf + 17, gy = heightAt(gx, gz), root = new THREE.Group(); root.name = 'lookout'; root.position.set(gx, gy, gz);
  const B = createBatch('lookout'), c = { cast: true }, white = paint('#FFF8EE', 0.45), g = gold();
  B.add(new THREE.CylinderGeometry(4.2, 4.5, 0.6, 8).translate(0, 0.1, 0), stone(2, '#EDE3D6'), null, c);
  B.add(new THREE.CylinderGeometry(3.5, 3.5, 0.12, 8).translate(0, 0.46, 0), wood('#B98A62', 3), null, c);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + PI / 8, x = Math.sin(a) * 3.6, z = Math.cos(a) * 3.6;
    B.add(new THREE.CylinderGeometry(0.13, 0.16, 3.4, 10).translate(x, 2.1, z), white, null, c);
    B.add(new THREE.TorusGeometry(0.2, 0.05, 6, 14).rotateX(PI / 2).translate(x, 3.75, z), g);
    if (k !== 4) { const b = (k + 0.5) / 8 * TAU + PI / 8; // lattice rail between posts (open toward the park)
      B.add(rbox(2.7, 0.08, 0.08, 0.02, 1).rotateY(b).translate(Math.sin(b) * 3.35, 1.25, Math.cos(b) * 3.35), white, null, c); } }
  B.add(new THREE.CylinderGeometry(4.1, 4.1, 0.3, 8).translate(0, 3.95, 0), white, null, c);
  B.add(new THREE.LatheGeometry([[0, 0], [4.3, 0], [4.0, 0.7], [3.0, 1.7], [1.4, 2.6], [0.3, 3.1], [0, 3.2]].map(([a, b]) => new THREE.Vector2(a, b)), 8).translate(0, 4.1, 0), shingle('#BBA6E2', 6, 3), null, c);
  B.add(rodGeo(V(0, 7.2, 0), V(0, 8.2, 0), 0.05, 6), g); B.add(heartGeo(0.38, 0.14).translate(0, 8.5, 0), g);
  // a curved bench facing the park (south)
  for (let i = 0; i < 7; i++) { const a = -1.05 + i * 0.35; B.add(rbox(0.86, 0.07, 0.42, 0.02, 1).rotateY(a).translate(Math.sin(a) * 2.5, 0.98, Math.cos(a) * 2.5), wood('#A8754F', 1), null, c);
    B.add(rbox(0.86, 0.5, 0.06, 0.02, 1).rotateY(a).translate(Math.sin(a) * 2.75, 1.25, Math.cos(a) * 2.75), wood('#A8754F', 1), null, c); }
  B.build(root);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), lampGlass('#FFD9A8', 1.6)); lamp.position.set(0, 3.5, 0); root.add(lamp);
  lights && lights.addLocal(V(gx, gy + 3.3, gz), '#FFC994', 26, 16);
  const a = attraction({ id: 'lookout', kind: 'landmark', name: "Lovers' Lookout", icon: '💞', zone: 'Castle Terrace', object3D: root,
    desc: 'An open gazebo on the castle terrace, looking back over every light in the park. The best seat for the fireworks — come at night, or press Watch and the sky will oblige.',
    focus: { target: [gx, gy + 2, gz], dist: 14, height: 6 } });
  a.hits = [hitCylinder(root, 4.4, 8.6, 0)]; a.platform = (w) => w.platform({ type: 'circle', x: gx, z: gz, r: 4.3, top: gy + 0.52 }); a.solid = (w) => { for (let k = 0; k < 8; k++) { const ang = k / 8 * TAU + PI / 8; w.circle(gx + Math.sin(ang) * 3.6, gz + Math.cos(ang) * 3.6, 0.25, gy + 4, 'soft'); } };
  a.playLabel = 'Watch the fireworks';
  a.play = () => a.onWatch && a.onWatch();
  a.noScale = true;
  return a;
}


/* ---------- Musical Fountains: a reflecting pool with 21 choreographed jets ---------- */
function musicalFountains() {
  const fx0 = L.fountainShow[0], fz0 = L.fountainShow[1], W = 18, D = 7, NJ = 21, PER = 170, root = new THREE.Group(); root.name = 'fountains'; root.position.set(fx0, 0, fz0);
  const B = createBatch('fountains'), c = { cast: true }, rim = stone(1, '#EFE4D6');
  for (const s of [-1, 1]) { B.add(rbox(W + 1.2, 0.6, 0.6, 0.08, 2).translate(0, 0.3, s * (D / 2 + 0.3)), rim, null, c); B.add(rbox(0.6, 0.6, D + 1.2, 0.08, 2).translate(s * (W / 2 + 0.3), 0.3, 0), rim, null, c); }
  B.add(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2).translate(0, 0.08, 0), paint('#2C5F6E', 0.6));
  for (let i = 0; i < NJ; i++) B.add(new THREE.CylinderGeometry(0.09, 0.12, 0.25, 10).translate(-W / 2 + 1 + i * (W - 2) / (NJ - 1), 0.2, 0), gold());
  for (const s of [-1, 1]) for (const e of [-1, 1]) { B.add(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 12).translate(s * (W / 2 + 0.3), 0.8, e * (D / 2 + 0.3)), rim, null, c); B.add(heartGeo(0.3, 0.12).translate(s * (W / 2 + 0.3), 1.85, e * (D / 2 + 0.3)), gold()); }
  B.build(root);
  const wm = waterMaterial('#2E7C8E', 1.1);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 1, 1).rotateX(-Math.PI / 2), wm); surf.position.y = 0.42; root.add(surf);
  // the jets: GPU particles; each knows its jet, its phase in the arc and its spray angle
  const H = new Float32Array(NJ).fill(0.6), Ht = new Float32Array(NJ).fill(0.6), JC = Array.from({ length: NJ }, () => new THREE.Color('#ffffff'));
  const n = NJ * PER, g = new THREE.BufferGeometry(), at = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { at[i * 4] = Math.floor(i / PER); at[i * 4 + 1] = Math.random(); at[i * 4 + 2] = Math.random() * Math.PI * 2; at[i * 4 + 3] = Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aJet', new THREE.BufferAttribute(at, 4)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  const U = { uT: { value: 0 }, uH: { value: H }, uC: { value: JC }, uNight: { value: 0 }, uW: { value: W } };
  const pm = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT, uH[${NJ}], uW; uniform vec3 uC[${NJ}]; attribute vec4 aJet; varying vec3 vC; varying float vA;
      void main(){ int j = int(aJet.x); float h = uH[j]; float v0 = sqrt(2.0 * 9.8 * max(h, 0.05)), T = 2.0 * v0 / 9.8;
        float u = fract(aJet.y + uT / max(T, 0.3)), tt = u * T; float y = 0.3 + v0 * tt - 4.9 * tt * tt;
        float spread = 0.05 + aJet.w * 0.12 * u; vec3 p = vec3(-uW * 0.5 + 1.0 + aJet.x * (uW - 2.0) / ${NJ - 1}.0 + cos(aJet.z) * spread * tt * 2.0, y, sin(aJet.z) * spread * tt * 2.0);
        vC = uC[j]; vA = (1.0 - u * 0.7) * smoothstep(0.05, 0.3, h);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (150.0 + aJet.w * 150.0) / -mv.z; }`,
    fragmentShader: `uniform float uNight; varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      gl_FragColor = vec4(vC * mix(0.9, 2.2, uNight), vA * (1.0 - d * 2.0) * mix(0.55, 0.9, uNight)); }` });
  const pts = new THREE.Points(g, pm); pts.frustumCulled = false; root.add(pts);
  const PAL = ['#FFB3C6', '#FFD68A', '#C8A2E8', '#A0D8F1', '#FFFFFF'], _c = new THREE.Color();
  const st = { show: 0, total: 48, beat: 0 };
  const a = attraction({ id: 'fountainShow', kind: 'experience', name: 'Musical Fountains', icon: '⛲', zone: 'Sweetheart Boulevard', object3D: root,
    desc: 'A reflecting pool of twenty-one jets that dance to the music box — waves, ripples, crossing arcs and a soaring finale, lit in rose and gold after dark. Shows run through the day; press E to start one.',
    focus: { target: [fx0, 2.5, fz0], dist: 20, height: 7 } });
  a.hits = [hitBox(root, W + 1.6, 2, D + 1.6, 0)]; a.noScale = true; a.playLabel = 'Start the show';
  a.solid = (w) => w.box(fx0, fz0, W + 1.2, D + 1.2, 0, 0.6, 'pond');
  a.play = () => { st.show = st.total; a.onShow && a.onShow(); a.sfx && a.sfx.fanfare && a.sfx.fanfare(); };
  a.state = () => ({ playing: st.show > 0 });
  a.update = (dt, t) => {
    U.uT.value = t; U.uNight.value = nightness();
    const s = st.show > 0 ? st.total - st.show : -1; if (st.show > 0) st.show -= dt;
    for (let j = 0; j < NJ; j++) { const x = j / (NJ - 1);
      let h = 0.5 + Math.sin(t * 0.8 + j * 0.5) * 0.15;                                          // idle: a gentle ripple
      if (s >= 0) { const ph = Math.floor(s / 8) % 6, k = s % 8;
        h = ph === 0 ? 1 + 3.2 * Math.max(0, Math.sin(t * 3 - x * 9))                             // waves
          : ph === 1 ? (j % 2 === Math.floor(t * 2) % 2 ? 4.5 : 0.4)                                // alternating
          : ph === 2 ? 1 + 5 * Math.exp(-Math.pow((x - 0.5) * 6 - Math.sin(t * 1.7) * 2.5, 2))     // a travelling peak
          : ph === 3 ? 0.6 + 4.6 * Math.abs(Math.sin(t * 2.2 + Math.abs(x - 0.5) * 8))             // mirrored ripples
          : ph === 4 ? 1 + k * 0.7 * (1 - Math.abs(x - 0.5) * 1.4)                                    // rising arch
          : 2 + 5.5 * (0.6 + 0.4 * Math.sin(t * 6 + j)); }                                           // finale
      Ht[j] = h; H[j] += (Ht[j] - H[j]) * Math.min(1, dt * 6);
      JC[j].copy(_c.set(PAL[(j + Math.floor(t * (s >= 0 ? 2 : 0.3))) % PAL.length])); }
  };
  return a;
}

/* ---------- Hedge Maze: walk it, find the golden rose at its heart ---------- */
function hedgeMaze() {
  const mx = -36, mz = 63, C = 5, S = 2.4, size = C * S, root = new THREE.Group(); root.name = 'maze'; root.position.set(mx, 0, mz);
  // recursive-backtracker maze (fixed seed: the same maze every visit)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wallsH = Array.from({ length: C + 1 }, () => Array(C).fill(true)), wallsV = Array.from({ length: C }, () => Array(C + 1).fill(true)), seen = new Set(), stack = [[0, 0]]; seen.add('0,0');
  while (stack.length) { const [i, j] = stack[stack.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < C && b < C && !seen.has(a + ',' + b));
    if (!nb.length) { stack.pop(); continue; } const [ni, nj] = nb[Math.floor(rnd() * nb.length)];
    if (ni !== i) wallsV[j][Math.max(i, ni)] = false; else wallsH[Math.max(j, nj)][i] = false; seen.add(ni + ',' + nj); stack.push([ni, nj]); }
  wallsH[C][2] = false;                                                                  // the entrance faces the boulevard (+z)
  const segs = [], x0 = -size / 2, z0 = -size / 2;
  for (let j = 0; j <= C; j++) for (let i = 0; i < C; i++) if (wallsH[j][i]) segs.push([x0 + (i + 0.5) * S, z0 + j * S, S + 0.5, 0.7]);
  for (let j = 0; j < C; j++) for (let i = 0; i <= C; i++) if (wallsV[j][i]) segs.push([x0 + i * S, z0 + (j + 0.5) * S, 0.7, S + 0.5]);
  const hedgeM = scanned('leafy_grass', { tint: '#6F9A5A', repeat: 1, normal: 1.6 }), Hh = 2.3;
  const geo = [], tops = [];
  for (const [x, z, w, d] of segs) { geo.push(rbox(w, Hh, d, 0.25, 2).translate(x, Hh / 2, z).toNonIndexed()); for (let k = 0; k < 3; k++) tops.push([x + (Math.random() - 0.5) * w * 0.8, z + (Math.random() - 0.5) * d * 0.8]); }
  const hg = mergeAll(geo); { const p = hg.attributes.position, uv = hg.attributes.uv, nn = hg.attributes.normal; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 2.5 * (Math.abs(nn.getY(i)) > 0.5 ? 1 : 1), p.getY(i) / 2.5 + (Math.abs(nn.getY(i)) > 0.5 ? p.getZ(i) / 2.5 : 0)); }
  const hedge = new THREE.Mesh(hg, hedgeM); hedge.castShadow = hedge.receiveShadow = true; root.add(hedge);
  // flowering climbers along the tops
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.6 }), tops.length), _m = new THREE.Matrix4(), col = new THREE.Color();
  tops.forEach(([x, z], i) => { fl.setMatrixAt(i, _m.makeTranslation(x, Hh + 0.05, z)); fl.setColorAt(i, col.set(['#FFB3C6', '#FFF1D6', '#C8A2E8', '#F28FAF'][i % 4])); }); root.add(fl);
  // the heart of the maze: a little rose pavilion with a golden rose
  const B = createBatch('mazeHeart'); B.add(new THREE.CylinderGeometry(0.42, 0.48, 0.35, 16).translate(0, 0.17, 0), stone(1, '#EFE4D6'), null, { cast: true });
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.78; B.add(rodGeo(V(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), V(Math.cos(a) * 0.55, 2.4, Math.sin(a) * 0.55), 0.04, 6), gold()); }
  B.add(new THREE.TorusGeometry(0.55, 0.04, 6, 24).rotateX(Math.PI / 2).translate(0, 2.4, 0), gold()); B.build(root);
  const rose = new THREE.Mesh(new THREE.TorusKnotGeometry(0.12, 0.05, 48, 8, 2, 5), new THREE.MeshStandardMaterial({ color: '#F2C46A', metalness: 1, roughness: 0.25, emissive: '#C9822E', emissiveIntensity: 0.4 }));
  rose.position.y = 1.15; root.add(rose);
  const a = attraction({ id: 'maze', kind: 'experience', name: 'Rose Hedge Maze', icon: '🌹', zone: 'Fantasy Garden', object3D: root,
    desc: 'Tall hedges hung with climbing roses and only one way to the middle. Find the golden rose at its heart — your best time is remembered.',
    focus: { target: [mx, 1, mz], dist: 22, height: 16 } });
  a.hits = [hitBox(root, size + 1, Hh, size + 1, 0)]; a.noScale = true;
  a.solid = (w) => { for (const [x, z, ww, d] of segs) w.box(mx + x, mz + z, ww, d, 0, Hh, 'hedge'); w.circle(mx, mz, 0.45, 0.4, 'soft'); };
  let best = 0; try { best = +localStorage.getItem('sweetheart-maze') || 0; } catch (e) {}
  const st = { inT: null, done: false };
  a.state = () => ({ best });
  a.track = (p, dt) => { // timing: from the first step inside to the golden rose
    const inside = Math.abs(p.x - mx) < size / 2 && Math.abs(p.z - mz) < size / 2;
    if (inside && st.inT === null) { st.inT = 0; st.done = false; } if (st.inT !== null && !st.done) st.inT += dt; if (!inside && Math.abs(p.z - mz) > size / 2 + 3) st.inT = null;
    if (!st.done && st.inT !== null && Math.hypot(p.x - mx, p.z - mz) < 1.8) { st.done = true; const tm = st.inT; if (!best || tm < best) { best = tm; try { localStorage.setItem('sweetheart-maze', String(best.toFixed(1))); } catch (e) {} }
      a.onSolve && a.onSolve(tm, best); }
  };
  a.update = (dt, t) => { rose.rotation.y = t * 0.8; rose.position.y = 1.15 + Math.sin(t * 1.6) * 0.06; };
  return a;
}

/* ---------- Moonlight Bistro: a glass conservatory restaurant on the castle terrace ---------- */
const DISHES = ['candlelit strawberry soufflé for two', 'rose-petal risotto', 'a starlight sundae with gold leaf', 'lavender crème brûlée', 'moonberry tart and two spoons', 'a pot of jasmine tea under the stars'];
function bistro() {
  const cf = L.castle.z + 9, bx = 16, bz = cf + 15, by = heightAt(bx, bz), root = new THREE.Group(); root.name = 'bistro'; root.position.set(bx, by, bz);
  const B = createBatch('bistro'), c = { cast: true }, frame = paint('#FFF8EE', 0.4), gl = new THREE.MeshPhysicalMaterial({ color: '#FFE9CF', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.22, emissive: '#FFB878', emissiveIntensity: 0.08, side: THREE.DoubleSide, depthWrite: false });
  B.add(new THREE.CylinderGeometry(6.6, 6.9, 0.6, 8).translate(0, 0.1, 0), stone(2, '#EDE3D6'), null, c);
  B.add(new THREE.CylinderGeometry(4.2, 4.2, 0.12, 8).translate(0, 0.46, 0), wood('#9A6A48', 3), null, c);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; B.add(rbox(0.16, 3.4, 0.16, 0.04).translate(Math.sin(a) * 4.2, 2.2, Math.cos(a) * 4.2), frame, null, c); }
  B.add(new THREE.TorusGeometry(4.25, 0.1, 6, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8).translate(0, 3.9, 0), gold());
  B.add(new THREE.LatheGeometry([[0, 0], [4.3, 0], [3.9, 1.0], [2.9, 2.0], [1.5, 2.7], [0.3, 3.0], [0, 3.05]].map(([a, b2]) => new THREE.Vector2(a, b2)), 8).rotateY(Math.PI / 8).translate(0, 3.95, 0), frame, null, c);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.PI / 8; B.add(rodGeo(V(Math.sin(a) * 4.2, 3.95, Math.cos(a) * 4.2), V(0, 7.0, 0), 0.05, 5), gold()); }
  B.add(heartGeo(0.4, 0.14).translate(0, 7.5, 0), gold());
  for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [0, 1.6]]) { B.add(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 18).translate(x, 1.2, z), paint('#FFFFFF', 0.5), null, c); B.add(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 6).translate(x, 0.85, z), gold()); }
  for (const [x, z] of [[-5.3, 2.8], [5.3, 2.8], [-5.3, -2.4], [5.3, -2.4]]) { B.add(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16).translate(x, 1.18, z), paint('#FFF5E1', 0.5), null, c); B.add(new THREE.CylinderGeometry(0.04, 0.06, 0.72, 6).translate(x, 0.83, z), paint('#3F3350', 0.5)); }
  B.build(root);
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 3.3, 8, 1, true).rotateY(Math.PI / 8).translate(0, 2.2, 0), gl); root.add(walls);
  const a = attraction({ id: 'bistro', kind: 'experience', name: 'Moonlight Bistro', icon: '🕯️', zone: 'Castle Terrace', object3D: root,
    desc: 'A glass conservatory on the castle terrace where every table has a candle and a view of the whole lit park. Sit down for dinner by moonlight.',
    focus: { target: [bx, by + 2, bz], dist: 15, height: 6 } });
  a.hits = [hitCylinder(root, 6.8, 7, 0)]; a.noScale = true; a.playLabel = 'Dine by moonlight';
  a.platform = (w) => w.platform({ type: 'circle', x: bx, z: bz, r: 6.6, top: by + 0.42 });
  a.solid = (w) => { for (let k = 0; k < 8; k++) { const ang = k / 8 * TAU + Math.PI / 8; w.circle(bx + Math.sin(ang) * 4.2, bz + Math.cos(ang) * 4.2, 0.25, by + 4, 'soft'); } };
  let n = 0; a.play = () => { const d = DISHES[n++ % DISHES.length]; a.ui && a.ui.toast('Dinner by moonlight', ['You share {p}.', { p: d }], '🕯️'); a.sfx && a.sfx.clink && a.sfx.clink(); a.fx && a.fx.hearts(V(bx, by + 2, bz), 18, 0.8); a.onTreat && a.onTreat(); };
  return a;
}

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const mergeAll = (arr) => mergeGeometries(arr.map(g => (g.index ? g.toNonIndexed() : g)));

export { cafe, lookout, musicalFountains, hedgeMaze, bistro };
