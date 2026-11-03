/* =========================================================================
   SHOPS — the boulevard's storefronts, each with its own architecture, sign, awning, lit display window and
   rooftop sculpture: Cotton Candy (round kiosk under a candy-floss roof), Ice Cream (mint cottage with a giant
   cone), Bubble Tea (rounded modern box with a boba cup), Balloon Shop (striped tent with balloon bunches),
   Gift Shop (two-storey timber-frame house with a bay window), Toy Shop (house with a turret and a teddy),
   Popcorn (striped wagon on gold wheels). Built facing local +z, then turned to face the boulevard.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox, canvasTex, R, pick, TAU } from '../core/geo.js';
import { plaster, shingle, paint, gold, stone, wood, fabric, glass, signMat, windowMat, matte, glow } from '../core/materials.js';
import { sign } from '../core/textures.js';
import { t, onLang } from '../i18n.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
const NAMES = { flowerShop: 'Flower Shop', patisserie: 'Pâtisserie', cottonCandy: 'Cotton Candy', iceCream: 'Ice Cream', bubbleTea: 'Bubble Tea', balloonShop: 'Balloons', giftShop: 'Gift Shop', toyShop: 'Toy Shop', popcorn: 'Popcorn' };

// a lit shop interior painted on canvas: wall, shelves and little product silhouettes in that shop's colours
function interior(kind) {
  const items = { cottonCandy: ['#FFB3C6', '#C8A2E8', '#A0D8F1'], iceCream: ['#FFF5E1', '#FFB3C6', '#A8E6CF', '#C9875A'], bubbleTea: ['#E6C8A0', '#C8A2E8', '#7A5040'], balloonShop: ['#F28FAF', '#A0D8F1', '#FFD68A'],
    giftShop: ['#F28FAF', '#C8A2E8', '#FFD68A', '#A8E6CF'], flowerShop: ['#F28FAF', '#FFF5E1', '#C8A2E8', '#7FB36A', '#FFD68A'], patisserie: ['#F7C6D6', '#C9E7D8', '#E8C8A0', '#C8A2E8', '#FFF0D6'], toyShop: ['#C98B6B', '#F28FAF', '#A0D8F1', '#FFD68A'], popcorn: ['#FFE9A8', '#F2D16B'] }[kind];
  return canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#FFE3C0'); gr.addColorStop(1, '#F7B98E'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const lamp = g.createRadialGradient(w / 2, 20, 0, w / 2, 20, w * 0.6); lamp.addColorStop(0, 'rgba(255,255,230,.7)'); lamp.addColorStop(1, 'rgba(255,255,230,0)'); g.fillStyle = lamp; g.fillRect(0, 0, w, h);
    for (const sy of [90, 170]) { g.fillStyle = '#8A5A44'; g.fillRect(10, sy, w - 20, 7);
      for (let x = 24; x < w - 24; x += 26) { g.fillStyle = pick(items); const kindShape = Math.floor(Math.random() * 3);
        if (kindShape === 0) { g.beginPath(); g.arc(x, sy - 12, 10, 0, TAU); g.fill(); } else if (kindShape === 1) g.fillRect(x - 8, sy - 26, 16, 26); else { g.beginPath(); g.moveTo(x - 9, sy); g.lineTo(x + 9, sy); g.lineTo(x, sy - 28); g.fill(); } } }
    g.fillStyle = 'rgba(70,40,50,.25)'; g.fillRect(0, h - 40, w, 40);
  }, false);
}
// a flat four-cornered panel (glass roofs)
function quad(a, b, c, d) { const g = new THREE.BufferGeometry().setFromPoints([a, b, c, a, c, d]); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); g.computeVertexNormals(); return g; }
// common pieces
function awning(B, w, depth, y, z, c1, c2) { // a sloped striped awning with a scalloped valance
  const m = fabric(c1, c2, 10, Math.max(1, Math.round(w / 2)), 1);
  B.add(new THREE.PlaneGeometry(w, depth).rotateX(-PI / 2 + 0.42).translate(0, y, z + depth * 0.45), m, null, { cast: true });
  for (let i = 0; i < Math.round(w / 0.5); i++) B.add(new THREE.CircleGeometry(0.25, 10, PI, PI).translate(-w / 2 + 0.25 + i * 0.5, y - depth * 0.4, z + depth * 0.9), m);
}
function storefront(B, w, h, z, kind, y0 = 0.3) { // display window with a gold frame and a door
  const win = windowMat(interior(kind), '#FFD9A8', 1.1), gl = glass('#FFFFFF', 0.12);
  B.add(new THREE.PlaneGeometry(w * 0.62, h * 0.55).translate(-w * 0.12, y0 + h * 0.42, z + 0.02), win); B.add(new THREE.PlaneGeometry(w * 0.62, h * 0.55).translate(-w * 0.12, y0 + h * 0.42, z + 0.06), gl);
  B.add(rbox(w * 0.66, 0.1, 0.18, 0.04, 2).translate(-w * 0.12, y0 + h * 0.13, z + 0.08), gold()); B.add(rbox(w * 0.66, 0.08, 0.14, 0.03, 2).translate(-w * 0.12, y0 + h * 0.71, z + 0.08), gold());
  B.add(rbox(w * 0.2, h * 0.62, 0.1, 0.05, 2).translate(w * 0.34, y0 + h * 0.31, z + 0.05), wood('#8A5A44'), null, { cast: true });
  B.add(new THREE.SphereGeometry(0.05, 8, 6).translate(w * 0.28, y0 + h * 0.3, z + 0.12), gold());
}
function signBoard(root, text, w, y, z, colors = {}) {
  const make = () => sign(t(text), { w: 1024, h: 256, size: 130, bg: colors.bg || '#FFF5E1', fg: colors.fg || '#C8577E', border: colors.border || '#E3B865' });
  const m = signMat(make(), 1.3), board = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), m); board.position.set(0, y, z); root.add(board);
  onLang(() => { m.map = m.emissiveMap = make(); m.needsUpdate = true; });
}

const BUILD = {
  // a Victorian glasshouse full of flowers, buckets of blooms out front and hanging baskets
  flowerShop(B, root) {
    const frame = paint('#FFFFFF', 0.4), gl = glass('#E6FFF4', 0.18), base = stone(1, '#E3D3C3');
    B.add(rbox(6.2, 0.5, 5.2, 0.1).translate(0, 0.25, 0), base, null, { cast: true });
    B.add(rbox(5.6, 0.9, 4.6, 0.06).translate(0, 0.9, 0), plaster('#E9F2E6'), null, { cast: true });
    for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) for (const z of [-2.3, 2.3]) B.add(rbox(0.12, 2.6, 0.12, 0.03).translate(x, 2.65, z), frame, null, { cast: true });
    for (const z of [-2.3, 2.3]) B.add(rbox(5.7, 0.12, 0.14, 0.03).translate(0, 3.95, z), frame);
    for (const x of [-2.8, 2.8]) B.add(rbox(0.14, 0.12, 4.7, 0.03).translate(x, 3.95, 0), frame);
    B.add(new THREE.BoxGeometry(5.5, 2.6, 4.5).translate(0, 2.65, 0), gl);
    for (const s of [-1, 1]) { B.add(quad(V(-2.8, 3.95, s * 2.3), V(2.8, 3.95, s * 2.3), V(2.8, 5.9, 0), V(-2.8, 5.9, 0)), gl);
      for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) B.add(rodGeo(V(x, 3.95, s * 2.3), V(x, 5.9, 0), 0.05, 6), frame); }
    B.add(rodGeo(V(-2.8, 5.9, 0), V(2.8, 5.9, 0), 0.07, 6), frame); B.add(heartGeo(0.35, 0.12).translate(0, 6.35, 0), gold());
    const win = windowMat(interior('flowerShop'), '#FFE8C8', 1.0); B.add(new THREE.PlaneGeometry(4.6, 1.9).translate(0, 2.4, -2.2), win);
    storefront(B, 3.6, 2.8, 2.36, 'flowerShop', 0.6);
    const fl = ['#F28FAF', '#FFF5E1', '#C8A2E8', '#FFD68A', '#FF9E8A', '#A0D8F1'];
    for (let i = 0; i < 7; i++) { const x = -2.6 + i * 0.85; B.add(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12).translate(x, 0.75, 3.0), paint(['#C9A27E', '#7FA8C9', '#E3D3C3'][i % 3], 0.5), null, { cast: true });
      for (let k = 0; k < 9; k++) B.add(new THREE.IcosahedronGeometry(R(0.09, 0.14), 1).translate(x + R(-0.2, 0.2), 1.1 + R(0, 0.35), 3.0 + R(-0.2, 0.2)), matte(pick(fl), 0.6)); }
    for (const x of [-2.2, 2.2]) { B.add(rodGeo(V(x, 3.95, 2.4), V(x, 3.4, 2.9), 0.02, 4), gold()); B.add(new THREE.SphereGeometry(0.35, 12, 8, 0, TAU, PI / 2, PI / 2).translate(x, 3.35, 2.9), wood('#8A5A44'));
      for (let k = 0; k < 10; k++) B.add(new THREE.IcosahedronGeometry(0.1, 1).translate(x + R(-0.3, 0.3), 3.35 + R(-0.05, 0.15), 2.9 + R(-0.3, 0.3)), matte(pick(fl), 0.6)); }
    signBoard(root, NAMES.flowerShop, 3.2, 3.55, 2.45, { fg: '#4E8A5A', border: '#E3B865' });
  },
  // a Parisian pâtisserie: cream walls, a slate mansard with dormers, an arched window of cakes, a macaron on the roof
  patisserie(B, root) {
    B.add(rbox(6.2, 0.4, 5.4, 0.1).translate(0, 0.2, 0), stone(1, '#E3D3C3'), null, { cast: true });
    B.add(new THREE.BoxGeometry(5.6, 4.0, 4.8).translate(0, 2.4, 0), plaster('#FFF1E2'), null, { cast: true });
    B.add(rbox(5.9, 0.25, 5.1, 0.08).translate(0, 4.5, 0), stone(1, '#F1E6DA'), null, { cast: true });
    const roof = shingle('#5E6A8C', 6, 3); const mans = new THREE.CylinderGeometry(2.3, 3.3, 1.9, 4, 1).rotateY(PI / 4).scale(1, 1, 0.85).translate(0, 5.55, 0); B.add(mans, roof, null, { cast: true });
    for (const x of [-1.5, 1.5]) { B.add(rbox(0.9, 1.0, 0.6, 0.06).translate(x, 5.6, 1.7), plaster('#FFF1E2'), null, { cast: true }); B.add(new THREE.ConeGeometry(0.62, 0.6, 4).rotateY(PI / 4).translate(x, 6.4, 1.7), roof);
      B.add(new THREE.PlaneGeometry(0.55, 0.65).translate(x, 5.55, 2.01), windowMat(interior('patisserie'), '#FFD9A8', 1.2)); }
    storefront(B, 4.4, 3.4, 2.42, 'patisserie', 0.4);
    awning(B, 4.6, 1.2, 3.55, 2.42, '#7FA8C9', '#FFF5E1');
    // the macaron
    B.add(new THREE.SphereGeometry(0.8, 24, 12, 0, TAU, 0, PI / 2).scale(1, 0.45, 1).translate(0, 7.25, 0), paint('#F7B8CA', 0.6), null, { cast: true });
    B.add(new THREE.CylinderGeometry(0.72, 0.72, 0.18, 24).translate(0, 7.12, 0), paint('#FFF5E1', 0.5));
    B.add(new THREE.SphereGeometry(0.8, 24, 12, 0, TAU, PI / 2, PI / 2).scale(1, 0.45, 1).translate(0, 7.0, 0), paint('#F7B8CA', 0.6), null, { cast: true });
    B.add(rodGeo(V(0, 6.5, 0), V(0, 6.85, 0), 0.05, 6), gold());
    for (const x of [-2.5, 2.5]) { B.add(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 12).translate(x, 0.75, 3.1), stone(1, '#EFE4D6')); B.add(new THREE.IcosahedronGeometry(0.42, 2).translate(x, 1.35, 3.1), matte('#5E8E52', 0.9), null, { cast: true }); }
    signBoard(root, NAMES.patisserie, 3.4, 4.05, 2.95, { fg: '#5E6A8C', border: '#E3B865' });
  },
  cottonCandy(B, root) {
    B.add(new THREE.CylinderGeometry(3.1, 3.3, 0.4, 32).translate(0, 0.2, 0), stone(1, '#E3D3C3'), null, { cast: true });
    B.add(new THREE.CylinderGeometry(2.8, 2.8, 3.2, 32, 1, true, -PI * 0.75, PI * 1.5).rotateY(PI).translate(0, 2.0, 0), plaster('#FFE4EC'), null, { cast: true });
    storefront(B, 3.6, 3.2, 2.75, 'cottonCandy', 0.4);
    B.add(new THREE.ConeGeometry(3.6, 1.6, 32).translate(0, 4.4, 0), paint('#FFC4D6', 0.6), null, { cast: true });
    const puffs = ['#FFB3C6', '#C8A2E8', '#A0D8F1', '#FFD6E2'];
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, r = 2.9 + (i % 2) * 0.3; B.add(new THREE.IcosahedronGeometry(0.75, 2).translate(Math.sin(a) * r, 3.75 + (i % 3) * 0.12, Math.cos(a) * r), matte(puffs[i % 4], 0.95), null, { cast: true }); }
    B.add(rodGeo(V(0, 4.6, 0), V(0, 7.2, 0), 0.08, 8), matte('#FFF5E1', 0.6));
    for (let i = 0; i < 14; i++) B.add(new THREE.IcosahedronGeometry(R(0.5, 0.8), 2).translate(R(-0.7, 0.7), 7.6 + R(-0.5, 0.6), R(-0.7, 0.7)), matte(i % 2 ? '#FFB3C6' : '#FFC9DA', 0.95), null, { cast: true });
    awning(B, 3.8, 1.3, 3.25, 2.6, '#F28FAF', '#FFF5E1');
    signBoard(root, NAMES.cottonCandy, 3.4, 3.95, 3.12);
  },
  iceCream(B, root) {
    B.add(rbox(6.2, 0.4, 5.4, 0.1).translate(0, 0.2, 0), stone(1, '#E3D3C3'), null, { cast: true });
    B.add(new THREE.BoxGeometry(5.6, 3.6, 4.8).translate(0, 2.2, 0), plaster('#E6F7EE'), null, { cast: true });
    const gable = new THREE.Shape([new THREE.Vector2(-3.2, 0), new THREE.Vector2(3.2, 0), new THREE.Vector2(0, 2.6)]);
    for (const zz of [-2.45, 2.45]) B.add(new THREE.ShapeGeometry(gable).translate(0, 4.0, zz), plaster('#E6F7EE'), null, { cast: true });
    const slope = Math.hypot(3.3, 2.6), ang = Math.atan2(2.6, 3.3);
    for (const s of [-1, 1]) B.add(new THREE.PlaneGeometry(slope, 5.6).rotateX(-PI / 2).rotateZ(-s * ang).translate(s * 1.6, 5.3, 0), shingle('#A8E6CF', 3, 3), null, { cast: true });
    storefront(B, 5.6, 3.6, 2.42, 'iceCream');
    awning(B, 5.4, 1.5, 3.55, 2.4, '#FFB3C6', '#FFF5E1');
    // giant cone on the ridge
    B.add(new THREE.ConeGeometry(0.7, 2.0, 24).rotateX(PI).translate(0, 7.4, 0), paint('#D89A5E', 0.7), null, { cast: true });
    [['#FFF5E1', 8.6], ['#FFB3C6', 9.3], ['#A8E6CF', 9.95]].forEach(([cc, y], i) => B.add(new THREE.SphereGeometry(0.82 - i * 0.12, 24, 16).translate(0, y, 0), paint(cc, 0.55), null, { cast: true }));
    B.add(new THREE.SphereGeometry(0.2, 12, 8).translate(0, 10.6, 0), paint('#D3405F', 0.25));
    signBoard(root, NAMES.iceCream, 4.2, 4.65, 2.48, { fg: '#3F8F72' });
  },
  bubbleTea(B, root) {
    B.add(rbox(6, 0.4, 5.2, 0.1).translate(0, 0.2, 0), stone(1, '#E3D3C3'), null, { cast: true });
    B.add(rbox(5.6, 4.2, 4.8, 0.6).translate(0, 2.5, 0), paint('#D8C2F0', 0.5), null, { cast: true });
    B.add(rbox(5.8, 0.25, 5.0, 0.1).translate(0, 4.65, 0), paint('#FFF5E1', 0.5), null, { cast: true });
    storefront(B, 5.6, 4.0, 2.42, 'bubbleTea', 0.4);
    B.add(rbox(5.3, 0.12, 0.1, 0.04).translate(0, 4.2, 2.45), glow('#FFB3C6', 2.2, 0.3)); // neon trim
    // the boba cup
    B.add(new THREE.CylinderGeometry(1.1, 0.85, 2.6, 28).translate(0, 6.2, 0), glass('#F1DCC0', 0.55));
    B.add(new THREE.CylinderGeometry(1.0, 0.82, 1.8, 28).translate(0, 5.85, 0), matte('#E3C29C', 0.4), null, { cast: true });
    for (let i = 0; i < 16; i++) { const a = R(0, TAU), r = R(0, 0.65); B.add(new THREE.SphereGeometry(0.13, 10, 8).translate(Math.sin(a) * r, 5.15 + R(0, 0.25), Math.cos(a) * r), paint('#3B2622', 0.2)); }
    B.add(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 28).translate(0, 7.55, 0), paint('#FFFFFF', 0.3));
    B.add(rodGeo(V(0.2, 7.0, 0), V(0.55, 9.2, 0.2), 0.12, 10), paint('#F28FAF', 0.4), null, { cast: true });
    signBoard(root, NAMES.bubbleTea, 4.2, 3.55, 2.47, { fg: '#7A4FA8', bg: '#FDF7FF' });
  },
  balloonShop(B, root, extra) {
    B.add(new THREE.CylinderGeometry(3.2, 3.3, 0.35, 8).translate(0, 0.17, 0), wood('#B48A64', 2), null, { cast: true });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + PI / 8; B.add(rodGeo(V(Math.sin(a) * 3, 0.3, Math.cos(a) * 3), V(Math.sin(a) * 3, 3.2, Math.cos(a) * 3), 0.07, 8), gold(), null, { cast: true }); }
    B.add(new THREE.ConeGeometry(3.6, 2.4, 8, 1, true).translate(0, 4.4, 0), fabric('#A0D8F1', '#FFF5E1', 16, 2, 1), null, { cast: true });
    B.add(new THREE.CylinderGeometry(3.55, 3.55, 0.6, 8, 1, true).translate(0, 3.0, 0), fabric('#A0D8F1', '#FFF5E1', 16, 2, 1), null, { cast: true });
    B.add(rbox(4.0, 1.1, 1.0, 0.1).translate(0, 0.85, 1.9), wood('#C99A72', 1), null, { cast: true });
    B.add(heartGeo(0.4, 0.15).translate(0, 6.0, 0), gold());
    // balloon bunches (instanced, gently bobbing)
    const cols = ['#F28FAF', '#FFB3C6', '#C8A2E8', '#A0D8F1', '#FFD68A', '#A8E6CF'], items = [];
    for (const [bx, bz] of [[-2.2, 2.4], [2.2, 2.4], [0, 3.2]]) for (let i = 0; i < 9; i++) items.push({ base: V(bx, 0, bz), off: V(R(-0.7, 0.7), R(3.0, 4.4), R(-0.6, 0.6)), c: pick(cols), ph: R(0, 6) });
    const bal = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 16, 12).scale(1, 1.18, 1), new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, sheen: 0.4 }), items.length);
    items.forEach((it, i) => bal.setColorAt(i, new THREE.Color(it.c))); bal.castShadow = true; root.add(bal);
    const strG = new THREE.BufferGeometry(), sp = new Float32Array(items.length * 6); strG.setAttribute('position', new THREE.BufferAttribute(sp, 3)); root.add(new THREE.LineSegments(strG, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })));
    const m = new THREE.Matrix4();
    extra.update = (dt, e) => { items.forEach((it, i) => { const x = it.base.x + it.off.x + Math.sin(e * 0.9 + it.ph) * 0.08, y = it.off.y + Math.sin(e * 1.3 + it.ph) * 0.06, z = it.base.z + it.off.z;
      bal.setMatrixAt(i, m.makeTranslation(x, y, z)); sp.set([it.base.x, 1.3, it.base.z, x, y - 0.38, z], i * 6); }); bal.instanceMatrix.needsUpdate = true; strG.attributes.position.needsUpdate = true; };
    signBoard(root, NAMES.balloonShop, 3.2, 2.15, 2.42, { fg: '#3E7FB0' });
  },
  giftShop(B, root) {
    B.add(rbox(6.4, 0.4, 5.6, 0.1).translate(0, 0.2, 0), stone(1, '#E3D3C3'), null, { cast: true });
    B.add(new THREE.BoxGeometry(6, 3.4, 5).translate(0, 2.1, 0), plaster('#FFF0F3'), null, { cast: true });
    B.add(new THREE.BoxGeometry(6.4, 2.8, 5.4).translate(0, 5.2, 0), plaster('#FFF8EE'), null, { cast: true });
    // timber framing on the upper storey
    const tm = wood('#7A4E36', 1);
    for (const x of [-3.15, -1.05, 1.05, 3.15]) B.add(new THREE.BoxGeometry(0.18, 2.8, 0.12).translate(x, 5.2, 2.74), tm, null, { cast: true });
    for (const y of [3.85, 6.55]) B.add(new THREE.BoxGeometry(6.5, 0.2, 0.14).translate(0, y, 2.74), tm);
    for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.14, 2.6, 0.1).rotateZ(s * 0.6).translate(s * 2.1, 5.2, 2.76), tm);
    for (const x of [-2.1, 0, 2.1]) B.add(new THREE.PlaneGeometry(1.2, 1.2).translate(x, 5.35, 2.72), windowMat(interior('giftShop'), '#FFD9A8', 1));
    // steep rose shingle roof and a chimney
    const slope = Math.hypot(3.5, 3.4), ang = Math.atan2(3.4, 3.5);
    for (const s of [-1, 1]) B.add(new THREE.PlaneGeometry(slope, 6.2).rotateX(-PI / 2).rotateZ(-s * ang).translate(s * 1.7, 8.3, 0), shingle('#F28FAF', 3, 3), null, { cast: true });
    const gable = new THREE.Shape([new THREE.Vector2(-3.25, 0), new THREE.Vector2(3.25, 0), new THREE.Vector2(0, 3.3)]);
    for (const zz of [-2.7, 2.7]) B.add(new THREE.ShapeGeometry(gable).translate(0, 6.6, zz), plaster('#FFF8EE'), null, { cast: true });
    B.add(rbox(0.9, 2.4, 0.9, 0.1).translate(1.8, 9.2, -1), stone(1, '#C9B3A8'), null, { cast: true });
    // bay window on the ground floor
    B.add(rbox(3.4, 2.2, 1.0, 0.12).translate(-0.9, 1.9, 2.8), paint('#FFFFFF', 0.4), null, { cast: true });
    B.add(new THREE.PlaneGeometry(3.0, 1.7).translate(-0.9, 1.95, 3.31), windowMat(interior('giftShop'), '#FFD9A8', 1.2)); B.add(new THREE.PlaneGeometry(3.0, 1.7).translate(-0.9, 1.95, 3.33), glass('#FFFFFF', 0.12));
    B.add(rbox(3.6, 0.2, 1.2, 0.08).translate(-0.9, 3.1, 2.85), shingle('#C8A2E8', 2, 1), null, { cast: true });
    B.add(rbox(1.1, 2.6, 0.12, 0.05).translate(1.95, 1.6, 2.53), wood('#8A5A44'), null, { cast: true });
    signBoard(root, NAMES.giftShop, 3.8, 3.55, 2.57, { fg: '#B04A78' });
  },
  toyShop(B, root) {
    B.add(rbox(6.6, 0.4, 5.6, 0.1).translate(0, 0.2, 0), stone(1, '#E3D3C3'), null, { cast: true });
    B.add(new THREE.BoxGeometry(5.6, 4.6, 5).translate(-0.3, 2.7, 0), plaster('#FFF3D6'), null, { cast: true });
    for (const s of [-1, 1]) B.add(new THREE.PlaneGeometry(Math.hypot(3.1, 2.4), 5.6).rotateX(-PI / 2).rotateZ(-s * Math.atan2(2.4, 3.1)).translate(-0.3 + s * 1.5, 6.2, 0), shingle('#A0D8F1', 3, 3), null, { cast: true });
    const gable = new THREE.Shape([new THREE.Vector2(-2.95, 0), new THREE.Vector2(2.95, 0), new THREE.Vector2(0, 2.35)]);
    for (const zz of [-2.5, 2.5]) B.add(new THREE.ShapeGeometry(gable).translate(-0.3, 5.0, zz), plaster('#FFF3D6'), null, { cast: true });
    // corner turret
    B.add(new THREE.CylinderGeometry(1.25, 1.25, 6.4, 20).translate(2.6, 3.4, 2.1), plaster('#FFE0E9'), null, { cast: true });
    B.add(new THREE.ConeGeometry(1.55, 2.8, 20).translate(2.6, 8.0, 2.1), shingle('#C8A2E8', 3, 2), null, { cast: true });
    B.add(rodGeo(V(2.6, 9.4, 2.1), V(2.6, 10.2, 2.1), 0.04, 6), gold()); B.add(heartGeo(0.25, 0.1).translate(2.6, 10.4, 2.1), gold());
    for (const y of [2.4, 4.6]) B.add(new THREE.PlaneGeometry(0.8, 1.0).translate(0, 0, 1.27).rotateY(0.6).translate(2.6, y, 2.1), windowMat(interior('toyShop'), '#FFD9A8', 1));
    storefront(B, 5.0, 3.8, 2.52, 'toyShop');
    awning(B, 4.6, 1.4, 3.7, 2.5, '#A0D8F1', '#FFF5E1');
    signBoard(root, NAMES.toyShop, 3.6, 4.45, 2.55, { fg: '#3E7FB0' });
    // a big teddy on the sign bracket
    const fur = matte('#C98B6B', 0.95), cream = matte('#F5E1C8', 0.95);
    for (const [r, x, y, z, m] of [[0.45, -2.6, 5.2, 2.7, fur], [0.35, -2.6, 5.85, 2.75, fur], [0.13, -2.92, 6.15, 2.7, fur], [0.13, -2.28, 6.15, 2.7, fur], [0.14, -2.6, 5.78, 3.05, cream], [0.25, -2.6, 5.15, 3.0, cream]]) B.add(new THREE.SphereGeometry(r, 16, 12).translate(x, y, z), m, null, { cast: true });
  },
  popcorn(B, root, extra) {
    const rw = fabric('#F28FAF', '#FFF5E1', 10, 1, 1);
    B.add(rbox(3.4, 1.9, 2.0, 0.15).translate(0, 1.55, 0), rw, null, { cast: true });
    B.add(rbox(3.6, 0.15, 2.2, 0.06).translate(0, 2.55, 0), gold());
    for (const [x, z] of [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9]]) B.add(rodGeo(V(x, 2.6, z), V(x, 3.9, z), 0.04, 6), gold());
    B.add(new THREE.ConeGeometry(2.3, 0.9, 4, 1).rotateY(PI / 4).scale(1.1, 1, 0.75).translate(0, 4.3, 0), fabric('#FFD68A', '#FFF5E1', 12, 1, 1), null, { cast: true });
    B.add(new THREE.BoxGeometry(2.4, 1.0, 1.4).translate(0, 3.1, 0), glass('#FFF6E0', 0.25));
    for (let i = 0; i < 40; i++) B.add(new THREE.IcosahedronGeometry(0.1, 0).translate(R(-1, 1), 2.7 + R(0, 0.4), R(-0.55, 0.55)), matte('#FFF1C2', 0.8));
    B.add(new THREE.CylinderGeometry(0.75, 0.55, 1.2, 4, 1).rotateY(PI / 4).translate(0, 5.3, 0), fabric('#F28FAF', '#FFF5E1', 8, 1, 1), null, { cast: true });
    for (let i = 0; i < 18; i++) B.add(new THREE.IcosahedronGeometry(R(0.14, 0.22), 0).translate(R(-0.5, 0.5), 6.0 + R(0, 0.3), R(-0.5, 0.5)), matte('#FFF1C2', 0.8), null, { cast: true });
    const wheels = new THREE.Group(); root.add(wheels);
    for (const [x, z] of [[-1.2, -1.05], [1.2, -1.05], [-1.2, 1.05], [1.2, 1.05]]) { const w = new THREE.Group(); w.position.set(x, 0.55, z); wheels.add(w);
      const tb = createBatch('wheel'); tb.add(new THREE.TorusGeometry(0.5, 0.06, 8, 24), gold(), null, { cast: true }); for (let k = 0; k < 6; k++) tb.add(rodGeo(V(0, 0, 0), V(Math.sin(k / 6 * TAU) * 0.48, Math.cos(k / 6 * TAU) * 0.48, 0), 0.025, 4), gold()); tb.build(w); }
    signBoard(root, NAMES.popcorn, 2.4, 2.0, 1.05, { fg: '#D3405F' });
    extra.update = () => {};
  },
};

function createShops(veg, props) {
  const root = new THREE.Group(), updaters = []; root.name = 'shops';
  for (const [kind, x, z, f] of CONFIG.layout.shops) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = f > 0 ? PI / 2 : -PI / 2; root.add(g);
    const B = createBatch(kind), extra = {}; BUILD[kind](B, g, extra); B.build(g); if (extra.update) updaters.push(extra.update);
    // a planter and a lamp between neighbours, flower boxes at the front
    if (kind !== 'popcorn') { veg.bed(x + f * 3.4, z + 3.6, 0.8, 14); veg.bush(x - f * 3.2, z - 3.4, 0.9); }
  }
  return { object3D: root, update(dt, e) { for (const u of updaters) u(dt, e); } };
}

export { createShops, interior };
