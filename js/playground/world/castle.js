/* =========================================================================
   CHÂTEAU DE LUMIÈRE — the landmark on the northern hill, in the French Renaissance fairytale manner:
   • a rusticated stone terrace with a grand double stair and balustrades
   • the corps de logis: three storeys of pilastered bays (arched windows on the ground floor, pedimented
     windows on the piano nobile, smaller ones above), string courses and a crowning cornice, under a steep
     blue-slate hip roof with a row of dormers, gilded ridge cresting and tall chimneys
   • a projecting central pavilion: paired columns flanking a gilded portal, a balcony, a rose window, a
     gabled front, and behind it the clock-and-belfry tower rising into a needle spire
   • four round corner towers with machicolations and flared slate spires ringed with tiny dormers, slender
     bartizan turrets, and forward wings with arcaded galleries ending in domed pavilions
   Windows glow warm at night; the night-lighting rig (rig.*) tells illumination.js where the spires are.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBatch } from '../core/batch.js';
import { rbox, rodGeo, heartGeo, canvasTex } from '../core/geo.js';
import { plaster, shingle, gold, stone, windowMat, fabric, paint } from '../core/materials.js';
import { heightAt } from './ground.js';
import { nightness } from '../core/mood.js';
import { createKit, archPane, lathe } from './arch.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;

// a lit interior seen through glass: warm light, the suggestion of curtains and a chandelier
const castleGlass = () => canvasTex(128, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#FFE9C2'); gr.addColorStop(1, '#F5B27A'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(150,70,90,.35)'; g.fillRect(0, 0, w * 0.18, h); g.fillRect(w * 0.82, 0, w * 0.18, h);
  const ch = g.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, w * 0.4); ch.addColorStop(0, 'rgba(255,255,235,.9)'); ch.addColorStop(1, 'rgba(255,255,235,0)'); g.fillStyle = ch; g.fillRect(0, 0, w, h);
}, false);

function createCastle(veg) {
  const { x: cx, z: cz, h: base } = CONFIG.layout.castle, root = new THREE.Group(); root.name = 'castle'; root.position.set(cx, base, cz + (CONFIG.layout.castle.front || 0) * (1 - (CONFIG.layout.castle.scale || 1))); root.scale.setScalar(CONFIG.layout.castle.scale || 1);
  const M = { stone: stone(2, '#E6DDD2'), trim: plaster('#FFF6EA', 1), wall: plaster('#FBF1E6', 3), roof: shingle('#56607E', 8, 4), gold: gold(), glass: windowMat(castleGlass(), '#FFCF9A', 1.5), dark: paint('#3A3346', 0.6) };
  const K = createKit(M), B = createBatch('chateau'), c = { cast: true }, rig = { spires: [], towers: [], tip: null };
  const rusticated = stone(3, '#D9CFC4');
  // ---------- architectural light, painted into the stone ----------
  // Real floodlighting, the way a palace is lit at night: champagne uplight washing each bay from the terrace and
  // fading as it climbs (scalloped bay by bay, brightest between the pilasters), lavender and rose accent light
  // catching the towers and spires higher up, and a gold glow along the base. The wash is masked to the castle by
  // world position, so the shared stone and plaster materials stay untouched everywhere else in the park.
  const WASH = { value: 0 }, CX = cx.toFixed(1), CZ = cz.toFixed(1), BASE = base.toFixed(2);
  const wash = (m, k) => { if (m.userData.wash) return; m.userData.wash = true; const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey && m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (sh, r) => { prev && prev.call(m, sh, r); sh.uniforms.uWashN = WASH;
      sh.vertexShader = 'varying vec3 vWashP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWashP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uWashN; varying vec3 vWashP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float mask = 1.0 - smoothstep(42.0, 56.0, length(vWashP.xz - vec2(${CX}, ${CZ}))); float hy = vWashP.y - ${BASE};
          if (mask > 0.0 && uWashN > 0.0) {
            float bay = 0.45 + 0.55 * pow(abs(cos(vWashP.x * 3.14159 / 6.2)), 1.5), up = exp(-max(hy, 0.0) / 8.5) * bay;
            vec3 champ = vec3(1.0, 0.8, 0.56) * up * 0.85;
            float hi = smoothstep(13.0, 30.0, hy); vec3 accent = mix(vec3(0.62, 0.48, 1.0), vec3(1.0, 0.52, 0.72), 0.5 + 0.5 * sin(vWashP.x * 0.21 + vWashP.z * 0.13)) * hi * 0.38;
            vec3 foot = vec3(1.0, 0.72, 0.42) * exp(-pow(max(hy + 1.5, 0.0) / 1.6, 2.0)) * 0.5;
            totalEmissiveRadiance += diffuseColor.rgb * (champ + accent + foot) * ${k.toFixed(2)} * mask * uWashN;
            diffuseColor.rgb *= 1.0 - 0.4 * mask * uWashN;   // less flat moon/ambient fill, so the floodlight gradient reads
          } }`); };
    m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|wash'; m.needsUpdate = true; };
  wash(M.wall, 1); wash(M.stone, 1); wash(M.trim, 1.1); wash(rusticated, 0.9); wash(M.roof, 0.55); wash(M.gold, 0.6);

  // ---------- the terrace and the grand stair ----------
  B.add(rbox(58, 5, 27, 0.2, 2).translate(0, -1.9, -4.5), rusticated, null, c);
  for (let i = 0; i < 9; i++) B.add(rbox(13 - i * 0.2, 0.18, 0.55, 0.03, 1).translate(0, 0.6 - (i + 1) * 0.15, 9.3 + i * 0.5), M.stone, null, c);   // the stair down to the terrace
  for (const s of [-1, 1]) { K.balustrade(B, V(s * 6.6, 0.6, 9), V(s * 6.8, -0.75, 13.4), 0.9); B.add(rbox(1.0, 1.4, 1.0, 0.08, 1).translate(s * 6.7, -0.4, 13.6), M.stone, null, c);
    B.add(lathe([[0.001, 0], [0.35, 0], [0.5, 0.3], [0.32, 0.6], [0.42, 0.75], [0.001, 0.8]], 16).translate(s * 6.7, 0.3, 13.6), M.stone);
    K.balustrade(B, V(s * 6.6, 0.6, 9), V(s * 28.5, 0.6, 9), 0.95); }

  // ---------- corps de logis: x ∈ [−15, 15], z ∈ [−9, 3], 15 m of wall ----------
  const W = 30, D = 12, Z0 = -3, FRONT = Z0 + D / 2, H = 15, Y0 = 0.6;
  B.add(new THREE.BoxGeometry(W, H, D).translate(0, Y0 + H / 2, Z0), M.wall, null, c);
  B.add(rbox(W + 0.4, 1.4, D + 0.4, 0.06, 1).translate(0, Y0 + 0.7, Z0), rusticated, null, c);                       // plinth course
  for (const [y, k] of [[4.6, 0.35], [9.0, 0.35], [Y0 + H, 0.6]]) for (const [z, ry] of [[FRONT, 0], [Z0 - D / 2, PI]]) K.cornice(B, -W / 2, W / 2, y, ry ? -z : z, ry, k + 0.1);
  const bays = []; for (let x = -12.9; x <= 12.9; x += 3.45) if (Math.abs(x) > 5.6) bays.push(x);
  for (const x of bays) { const z = FRONT + 0.01; K.window(B, x, 2.2, z, 1.25, 2.4); K.window(B, x, 5.9, z, 1.15, 2.5, { pediment: true }); K.window(B, x, 10.4, z, 1.0, 1.9); }
  // the back façade's windows (facing −z)
  for (const x of bays) { const z = Z0 - D / 2 - 0.01; K.window(B, x, 2.2, z, 1.25, 2.4, { ry: PI }); K.window(B, x, 5.9, z, 1.15, 2.5, { ry: PI, pediment: true }); K.window(B, x, 10.4, z, 1.0, 1.9, { ry: PI }); }
  for (let x = -14.6; x <= 14.6; x += 3.45) if (Math.abs(x) > 5.4) B.add(rbox(0.5, H - 1.6, 0.25, 0.05, 1).translate(x + 1.72, Y0 + 1.4 + (H - 1.6) / 2, FRONT + 0.1), M.trim, null, c);   // pilasters
  // the roof: a steep slate hip, dormers on both slopes, gilded cresting, chimneys
  const roofG = new THREE.CylinderGeometry(Math.SQRT2 / 2, Math.SQRT2 / 2, 1, 4, 1).rotateY(PI / 4); { const p = roofG.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.75); p.setZ(i, p.getZ(i) * 0.12); } roofG.computeVertexNormals(); }
  B.add(roofG.scale(W + 1.2, 8.5, D + 1.2).translate(0, Y0 + H + 4.25, Z0), M.roof, null, c);
  for (const x of bays) { K.dormer(B, x, Y0 + H + 0.2, FRONT - 1.2, 0, 1.15); K.dormer(B, x, Y0 + H + 0.2, Z0 - D / 2 + 1.2, PI, 1.15); }
  for (let x = -10.5; x <= 10.5; x += 0.7) B.add(heartGeo(0.12, 0.04).translate(x, Y0 + H + 8.7, Z0), M.gold);
  B.add(rodGeo(V(-11, Y0 + H + 8.5, Z0), V(11, Y0 + H + 8.5, Z0), 0.05, 6), M.gold);
  for (const x of [-11.5, -7.5, 7.5, 11.5]) { B.add(rbox(1.0, 5.2, 1.0, 0.06, 1).translate(x, Y0 + H + 5.4, Z0 - 2.2), M.wall, null, c); B.add(rbox(1.3, 0.25, 1.3, 0.05, 1).translate(x, Y0 + H + 8.1, Z0 - 2.2), M.stone); }

  // ---------- the central pavilion (front face at z = 9, the castle's gate) ----------
  const PW = 11, PZ0 = -3, PZ1 = 9, PH = 18;
  B.add(new THREE.BoxGeometry(PW, PH, PZ1 - PZ0).translate(0, Y0 + PH / 2, (PZ0 + PZ1) / 2), M.wall, null, c);
  B.add(rbox(PW + 0.4, 1.4, PZ1 - PZ0 + 0.4, 0.06, 1).translate(0, Y0 + 0.7, (PZ0 + PZ1) / 2), rusticated, null, c);
  for (const s of [-1, 1]) for (const x of [3.0, 4.4]) K.column(B, s * x, Y0, PZ1 + 0.5, 7.6, 0.32);
  K.cornice(B, -PW / 2 - 0.2, PW / 2 + 0.2, Y0 + 7.9, PZ1 + 0.4, 0, 0.9);
  B.add(archPane(3.6, 6.6).translate(0, Y0, PZ1 + 0.02), paint('#6A4A2E', 0.4));                                           // the portal and its gilded doors
  for (const s of [-1, 1]) for (let r = 0; r < 4; r++) B.add(rbox(1.4, 0.06, 0.05, 0.01, 1).translate(s * 0.9, Y0 + 1 + r * 1.3, PZ1 + 0.06), M.gold);
  B.add(new THREE.TorusGeometry(2.0, 0.22, 8, 24, PI).translate(0, Y0 + 4.8, PZ1 + 0.1), M.stone); B.add(new THREE.TorusGeometry(2.25, 0.07, 6, 24, PI).translate(0, Y0 + 4.8, PZ1 + 0.18), M.gold);
  B.add(rbox(7.4, 0.3, 1.8, 0.06, 1).translate(0, Y0 + 8.45, PZ1 + 0.9), M.stone, null, c); K.balustrade(B, V(-3.6, Y0 + 8.6, PZ1 + 1.7), V(3.6, Y0 + 8.6, PZ1 + 1.7), 0.95);
  for (const x of [-1.6, 0, 1.6]) K.window(B, x, Y0 + 8.9, PZ1 + 0.02, 1.1, 2.9);
  // rose window with gold tracery
  B.add(new THREE.CircleGeometry(1.7, 40).translate(0, Y0 + 14.0, PZ1 + 0.02), M.glass); B.add(new THREE.TorusGeometry(1.75, 0.16, 8, 40).translate(0, Y0 + 14.0, PZ1 + 0.06), M.stone);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; B.add(rodGeo(V(0, Y0 + 14, PZ1 + 0.06), V(Math.cos(a) * 1.65, Y0 + 14 + Math.sin(a) * 1.65, PZ1 + 0.06), 0.035, 4), M.gold); }
  B.add(new THREE.TorusGeometry(0.6, 0.05, 6, 24).translate(0, Y0 + 14, PZ1 + 0.07), M.gold);
  K.cornice(B, -PW / 2, PW / 2, Y0 + PH, PZ1, 0, 0.6);
  const gable = new THREE.Shape([new THREE.Vector2(-PW / 2 - 0.2, 0), new THREE.Vector2(PW / 2 + 0.2, 0), new THREE.Vector2(0, 4.2)]);
  B.add(new THREE.ExtrudeGeometry(gable, { depth: 4, bevelEnabled: false }).translate(0, Y0 + PH + 0.1, PZ1 - 4), M.wall, null, c);
  B.add(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-PW / 2 - 0.5, -0.1), new THREE.Vector2(PW / 2 + 0.5, -0.1), new THREE.Vector2(0, 4.5)]), { depth: 0.4, bevelEnabled: false }).translate(0, Y0 + PH + 0.1, PZ1 - 0.1), M.roof, null, c);
  B.add(heartGeo(0.5, 0.18).translate(0, Y0 + PH + 4.9, PZ1 + 0.1), M.gold);
  // bartizans on the pavilion's front corners
  for (const s of [-1, 1]) { const bx = s * (PW / 2 + 0.2), bz = PZ1 + 0.2; B.add(lathe([[0.001, 0], [0.3, 0.3], [0.85, 1.4], [0.85, 1.5]], 16).translate(bx, Y0 + 12.5, bz), M.stone, null, c);
    B.add(new THREE.CylinderGeometry(0.85, 0.85, 4.2, 16).translate(bx, Y0 + 16.1, bz), M.wall, null, c); K.spire(B, bx, Y0 + 18.2, bz, 0.85, 3.6, { dormers: 0 }); rig.spires.push([bx, Y0 + 18.2 + 3.6 + 1.5, bz]); }
  // the clock-and-belfry tower behind the gable, and its needle spire
  const TZ = 2;
  B.add(new THREE.BoxGeometry(7, 9, 7).translate(0, Y0 + PH + 4.5, TZ), M.wall, null, c); K.cornice(B, -3.5, 3.5, Y0 + PH + 9, TZ + 3.5, 0, 0.5);
  B.add(new THREE.CircleGeometry(1.5, 48).translate(0, Y0 + PH + 6.2, TZ + 3.52), paint('#FFF8E8', 0.3)); B.add(new THREE.TorusGeometry(1.55, 0.14, 8, 48).translate(0, Y0 + PH + 6.2, TZ + 3.56), M.gold);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; B.add(rbox(0.08, 0.28, 0.04, 0.01, 1).translate(Math.cos(a) * 1.25, Y0 + PH + 6.2 + Math.sin(a) * 1.25, TZ + 3.57), M.dark); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) B.add(lathe([[0.4, 0], [0.4, 1.2], [0.001, 3.2]], 8).translate(s * 3.2, Y0 + PH + 9.2, TZ + t * 3.2), M.roof, null, c);   // pinnacles
  B.add(new THREE.CylinderGeometry(2.6, 2.8, 6, 8).translate(0, Y0 + PH + 12, TZ), M.wall, null, c);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + PI / 8; B.add(archPane(1.0, 2.8).rotateY(a).translate(Math.sin(a) * 2.62, Y0 + PH + 10.4, TZ + Math.cos(a) * 2.62), M.glass); }
  K.spire(B, 0, Y0 + PH + 15, TZ, 2.7, 17, { dormers: 4 }); rig.tip = [cx, base + Y0 + PH + 32.6, cz + TZ];

  // ---------- four corner towers with machicolations and flared spires ----------
  for (const [tx, tz] of [[-15.5, 3.2], [15.5, 3.2], [-15.5, -9.2], [15.5, -9.2]]) { const r = 3.6, th = 22;
    B.add(new THREE.CylinderGeometry(r * 1.06, r * 1.1, 1.4, 32).translate(tx, Y0 + 0.7, tz), rusticated, null, c);
    B.add(new THREE.CylinderGeometry(r, r * 1.04, th, 32).translate(tx, Y0 + th / 2, tz), M.wall, null, c);
    for (const y of [5, 10, 15]) B.add(new THREE.TorusGeometry(r * 1.02, 0.12, 6, 40).rotateX(PI / 2).translate(tx, Y0 + y, tz), M.stone);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + (tz > 0 ? 0.4 : PI + 0.4); for (const y of [6.3, 11.3, 16.3]) B.add(archPane(0.9, 2.0).rotateY(a).translate(tx + Math.sin(a) * (r + 0.02), Y0 + y, tz + Math.cos(a) * (r + 0.02)), M.glass); }
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU; B.add(rbox(0.36, 0.7, 0.5, 0.04, 1).rotateY(a).translate(tx + Math.sin(a) * (r + 0.2), Y0 + th - 0.4, tz + Math.cos(a) * (r + 0.2)), M.stone); }   // corbels
    B.add(new THREE.CylinderGeometry(r + 0.45, r + 0.45, 1.3, 32, 1, true).translate(tx, Y0 + th + 0.6, tz), M.wall, null, c);
    K.spire(B, tx, Y0 + th + 1.2, tz, r + 0.3, 12.5, { dormers: 4 }); rig.towers.push([tx, tz, r + 0.45, th + 1.2]); rig.spires.push([tx, Y0 + th + 1.2 + 12.5 + 1.5, tz]); }

  // ---------- forward wings: arcaded galleries to domed pavilions ----------
  for (const s of [-1, 1]) {
    const x0 = s * 19, x1 = s * 25.5, wz = 4.5;
    B.add(new THREE.BoxGeometry(Math.abs(x1 - x0), 8, 5).translate((x0 + x1) / 2, Y0 + 4, wz - 1), M.wall, null, c);
    for (let k = 0; k < 4; k++) { const x = x0 + (x1 - x0) * (k + 0.5) / 4; B.add(archPane(1.2, 3.2).translate(x, Y0 + 0.2, wz + 1.52), M.glass); K.window(B, x, Y0 + 4.6, wz + 1.51, 0.9, 1.8); }
    for (let k = 0; k <= 4; k++) K.column(B, x0 + (x1 - x0) * k / 4, Y0, wz + 2.2, 3.8, 0.2, 12);
    B.add(rbox(Math.abs(x1 - x0) + 0.6, 0.35, 1.4, 0.05, 1).translate((x0 + x1) / 2, Y0 + 4.0, wz + 2.0), M.stone, null, c);
    K.balustrade(B, V(x0, Y0 + 8.05, wz + 1.5), V(x1, Y0 + 8.05, wz + 1.5), 0.8);
    const roofW = new THREE.CylinderGeometry(Math.SQRT2 / 2, Math.SQRT2 / 2, 1, 4, 1).rotateY(PI / 4); { const p = roofW.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.6); p.setZ(i, p.getZ(i) * 0.1); } roofW.computeVertexNormals(); }
    B.add(roofW.scale(Math.abs(x1 - x0) + 0.8, 3, 5.6).translate((x0 + x1) / 2, Y0 + 9.5, wz - 1.6), M.roof, null, c);
    const px = s * 28.5, pz = 5;
    B.add(new THREE.BoxGeometry(7, 12, 7).translate(px, Y0 + 6, pz), M.wall, null, c); B.add(rbox(7.4, 1.4, 7.4, 0.06, 1).translate(px, Y0 + 0.7, pz), rusticated, null, c);
    for (const [fz, ry] of [[pz + 3.51, 0], [pz - 3.51, PI]]) { K.window(B, px, Y0 + 1.6, fz, 1.3, 2.8, { ry }); K.window(B, px, Y0 + 6.6, fz, 1.2, 2.6, { ry, pediment: true }); }
    for (const [fx, ry] of [[px + 3.51, PI / 2], [px - 3.51, -PI / 2]]) { K.window(B, fx, Y0 + 1.6, pz, 1.3, 2.8, { ry }); K.window(B, fx, Y0 + 6.6, pz, 1.2, 2.6, { ry, pediment: true }); }
    K.cornice(B, px - 3.5, px + 3.5, Y0 + 12, pz + 3.5, 0, 0.5); K.dome(B, px, Y0 + 12.2, pz, 3.0); rig.spires.push([px, Y0 + 12.2 + 3 * 2.3 + 1.3, pz]);
  }
  B.build(root);
  // banners from the balcony
  const fm = fabric('#5E6A9C', '#E9C97A', 3, 1, 1);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5.5, 1, 6), fm); f.position.set(s * 2.4, Y0 + 14.2, PZ1 + 0.2); root.add(f); }
  // a garden at its feet
  for (let i = 0; i < 18; i++) { const a = PI * (0.15 + 0.7 * i / 17), r = 26 + (i % 3) * 3; const tx = cx + Math.cos(a) * r * 1.4, tz = cz + Math.sin(a) * r * 0.5 + 16; if (Math.hypot(tx + 15, tz - (cz + 26)) < 10 || Math.hypot(tx - 16, tz - (cz + 24)) < 10 || Math.abs(tx) < 8) continue; veg.tree(i % 4 === 0 ? 'cypress' : i % 2 ? 'oak' : 'cherry', tx, tz, 1.2, heightAt(tx, tz) - 0.2); }
  return { object3D: root, update() { WASH.value = Math.max(0, (nightness() - 0.3) / 0.7); }, rig };
}

export { createCastle };
