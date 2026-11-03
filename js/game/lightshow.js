import * as THREE from 'three';
import { PI, TAU, V3, clamp, damp } from '../core/utils.js';
import { FX_OBJECTS, pointLight, scene } from '../core/renderer.js';
import { M } from '../core/materials.js';
import { coneMat } from '../core/shaders.js';
import { SB, onUpdate } from '../core/registry.js';
import { CATH } from '../world/cathedral.js';
import { BATS } from '../world/atmosphere.js';
import { SHIP } from '../world/skyship.js';
import { S } from './play.js';
import { t } from '../core/i18n.js';

/* =========================================================================
   LIGHT SHOW — the lighting half of the Nightly Spectacular.
   • 20 searchlight rigs mounted on the architecture: gate towers, a ring round the plaza, the cathedral spires
     and terrace, the Big Top's peak, the hub of The Eye, the lake shore and the fields. Each rig steers to a
     target direction (yaw/tilt, eased) chosen by the active pattern: idle wander, fan, synchronized sweep,
     scissor cross, ballyhoo figure-eights, a vertical "cathedral of light", strobe, or converge — every beam
     snapping onto the latest firework burst.
   • A laser fan from the clock tower's crown (fan sweeps, rotating tunnel, scanning sheet) for the big acts.
   • Coloured wash lights on the tower, cathedral, Big Top, The Eye, carousel and gate; cathedral windows and
     every bulb string in the park pulse and chase on the beat in the act's colours.
   Driven by conductor.js through setAct() and the shared beat (S.showBeat).
   ========================================================================= */
const LS = { groups: null, rigs: [], lasers: [], laserG: null, washes: [], pattern: 'idle', laserMode: 'off', cols: [new THREE.Color(0xff9a40), new THREE.Color(0xb070ff)], level: 0, lvl: 0,
  target: new V3(0, 80, -40), conv: 0, flash: 0 };
const RIGS = [ // x, y, z, length, radius, group
  [-9, 13.6, 78, 170, 5, 'gate'], [9, 13.6, 78, 170, 5, 'gate'],
  ...Array.from({ length: 6 }, (_, i) => { const a = PI * 1.15 + i / 5 * PI * 0.7; return [Math.cos(a) * 24, 0.4, Math.sin(a) * 24 - 2, 180, 6, 'plaza']; }),
  [-13.2, 52.8, -144.2, 190, 6, 'cath'], [13.2, 52.8, -144.2, 190, 6, 'cath'], [-20, 2.8, -131, 160, 5, 'cath'], [20, 2.8, -131, 160, 5, 'cath'],
  [-118, 24.5, 22, 160, 5, 'circus'], [-40, 16, -14, 130, 4, 'eye'],
  [86, 0.4, -20, 170, 6, 'lake'], [86, 0.4, -82, 170, 6, 'lake'], [100, 0.4, 28, 160, 5, 'fields'], [142, 0.4, 72, 160, 5, 'fields'], [-60, 0.4, 60, 160, 5, 'west'], [60, 0.4, 60, 160, 5, 'east'],
];
const _d = new V3();
function aim(r, dx, dy, dz) { const l = Math.hypot(dx, dy, dz) || 1; r.wantT = Math.acos(clamp(dy / l, -1, 1)); r.wantY = Math.atan2(dx, dz); }
function buildLightShow() {
  RIGS.forEach(([x, y, z, len, rad, grp], i) => {
    if (y < 1) { SB.add(new THREE.CylinderGeometry(0.8, 1.0, 0.8, 14), M.iron, x, 0.4, z); }
    const yaw = new THREE.Group(); yaw.position.set(x, y + (y < 1 ? 0.6 : 0), z); scene.add(yaw); const tilt = new THREE.Group(); yaw.add(tilt);
    const mat = coneMat(0xffffff, 0, 14), geo = new THREE.ConeGeometry(rad, len, 28, 1, true).translate(0, -len / 2, 0).rotateX(PI);
    const beam = new THREE.Mesh(geo, mat); tilt.add(beam); FX_OBJECTS.push(beam); beam.visible = false;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 })); lens.position.y = 0.05; lens.material.userData.noGrade = true; tilt.add(lens);
    LS.rigs.push({ yaw, tilt, beam, mat, lens, i, grp, pos: new V3(x, y, z), curY: Math.atan2(-x, -40 - z), curT: 0.4, wantY: 0, wantT: 0.4, I: 0 });
  });
  // laser fan on the clock tower crown
  LS.laserG = new THREE.Group(); LS.laserG.position.set(0, 43, 0); scene.add(LS.laserG);
  for (let i = 0; i < 18; i++) { const piv = new THREE.Group(); LS.laserG.add(piv); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.32, 240, 6, 1, true).translate(0, 120, 0), coneMat(0x40ff90, 0, 4));
    piv.add(m); FX_OBJECTS.push(m); m.visible = false; LS.lasers.push({ piv, m }); }
  // coloured washes on the landmarks (logical lights — the light pool picks the ones that matter for the view)
  [[0, 16, 9, 'tower'], [0, 14, -124, 'cath'], [-92, 9, 22, 'circus'], [-40, 5, -6, 'eye'], [32, 9, 26, 'carousel'], [0, 9, 86, 'gate']].forEach(([x, y, z, n], i) => LS.washes.push({ L: pointLight('wash_' + n, 0xffffff, 0, 46, x, y, z), i }));
  onUpdate(update);
}
// act API (conductor): pattern name, two colours, level 0..4, laser mode
function setAct({ pattern, cols, level, lasers, groups }) { if (groups !== undefined) LS.groups = groups; if (pattern) LS.pattern = pattern; if (cols) { LS.cols[0].copy(cols[0]); LS.cols[1].copy(cols[1]); } if (level !== undefined) LS.level = level; if (lasers) LS.laserMode = lasers; }
function converge(p, dur = 1.2) { LS.target.copy(p); LS.conv = dur; }
function pulse(k = 1) { LS.flash = Math.max(LS.flash, k); }
const _c = new THREE.Color();
function update(dt, t) {
  LS.lvl = damp(LS.lvl, LS.level, 1.2, dt); const lvl = LS.lvl, beat = S.showBeat || 0, bp = beat - Math.floor(beat), bar = Math.floor(beat / 3);
  const kick = Math.exp(-bp * 5) * clamp(lvl - 1, 0, 1), on = lvl > 0.02;
  LS.flash = Math.max(0, LS.flash - dt * 3); LS.conv = Math.max(0, LS.conv - dt);
  const pat = LS.conv > 0 ? 'converge' : LS.pattern, n = LS.rigs.length;
  for (const r of LS.rigs) {
    const i = r.i, side = r.pos.x < -0.5 ? -1 : r.pos.x > 0.5 ? 1 : 0, live = on && (!LS.groups || LS.groups.includes(r.grp) || pat === 'up');
    r.beam.visible = live || r.mat.uniforms.uI.value > 0.003; if (!r.beam.visible) continue;
    const ax = Math.abs(r.pos.x) / 140;                                            // 0 at the stage centre-line → 1 at the park edge
    // default heading: over the show centre (north of the plaza, high)
    _d.set(0 - r.pos.x, 95 - r.pos.y, -45 - r.pos.z);
    switch (pat) {
      case 'idle': aim(r, _d.x + side * 25 * Math.sin(t * 0.25), _d.y, _d.z); break;
      case 'fan': aim(r, _d.x + side * (30 + 90 * ax) * (0.75 + 0.25 * Math.sin(t * 0.5)), _d.y, _d.z); break;
      case 'sweep': aim(r, _d.x + side * Math.sin(t * 0.8) * 90, _d.y * (0.85 + 0.15 * Math.cos(t * 0.8)), _d.z); break;
      case 'cross': aim(r, _d.x - side * (40 + 60 * Math.sin(t * 0.9)), _d.y, _d.z); break;
      case 'ballyhoo': { const ph = t * 1.1; aim(r, _d.x + side * Math.sin(ph) * 80, _d.y + Math.sin(ph * 2) * 30, _d.z + Math.cos(ph) * 25); break; }
      case 'up': aim(r, Math.sin(t * 0.3 + i) * 4, 100, Math.cos(t * 0.3 + i) * 4); break;
      case 'strobe': aim(r, _d.x + side * 50 * (bar % 2 ? 1 : -1), _d.y, _d.z); break;
      case 'converge': aim(r, LS.target.x - r.pos.x, LS.target.y - r.pos.y, LS.target.z - r.pos.z); break;
    }
    const sp = pat === 'converge' ? 6 : pat === 'strobe' ? 9 : 2.2;
    let dy = r.wantY - r.curY; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.curY += dy * (1 - Math.exp(-sp * dt)); r.curT = damp(r.curT, r.wantT, sp, dt);
    r.yaw.rotation.y = r.curY; r.tilt.rotation.x = r.curT;
    // intensity: level, beat pulse, strobe gating, burst flash
    let I = live ? (0.05 + 0.08 * Math.min(lvl, 3) / 3) * (0.8 + 0.4 * kick) + LS.flash * 0.05 : 0;
    if (pat === 'strobe') I *= (Math.floor(beat * 2) % 2) ? 1.5 : 0.08;
    if (pat === 'up') I *= 1.3;
    r.mat.uniforms.uI.value = damp(r.mat.uniforms.uI.value, I * (S.reduceFlash ? 0.6 : 1), 12, dt);
    const c = pat === 'up' ? _c.setRGB(1, 0.95, 0.85) : LS.cols[(S.showAccent || 0) > 0.3 ? 1 : 0]; r.mat.uniforms.uColor.value.lerp(c, 1 - Math.exp(-6 * dt));
    r.lens.material.color.copy(c).multiplyScalar(1 + r.mat.uniforms.uI.value * 25);
  }
  // lasers
  const lz = LS.laserMode !== 'off' && lvl > 2.2, k = clamp(lvl - 2.2, 0, 1);
  LS.lasers.forEach((L, i) => { L.m.visible = lz; if (!lz) return; const f = i / (LS.lasers.length - 1) - 0.5;
    if (LS.laserMode === 'fan') { L.piv.rotation.set(0.25 + 0.3 * Math.sin(t * 0.7), 0, f * (1.3 + 0.5 * Math.sin(t * 0.9))); LS.laserG.rotation.y = Math.sin(t * 0.35) * 0.9 + PI; }
    else if (LS.laserMode === 'tunnel') { const a = i / LS.lasers.length * TAU + t * 1.1; L.piv.rotation.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45); LS.laserG.rotation.y = 0; }
    else { L.piv.rotation.set(-0.9 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.4 + f)), 0, f * 1.8); LS.laserG.rotation.y = PI; }
    const u = L.m.material.uniforms; u.uI.value = (0.09 + 0.08 * kick) * k; u.uColor.value.copy(LS.cols[0]); });
  // washes, cathedral windows, bulbs
  LS.washes.forEach((w, i) => { const c = LS.cols[(S.showAccent || 0) > 0.3 ? 1 : 0]; w.L.color.lerp(c, 1 - Math.exp(-6 * dt)); w.L.intensity = lvl > 0.3 ? (40 + 140 * Math.min(1, lvl / 3)) * (0.55 + 0.45 * kick) + LS.flash * 120 : 0; });
  if (lvl > 1.2 && CATH.windows && CATH.show < 0) for (const wm of CATH.windows) wm.color.setScalar(1.3 + kick * 2.2 * Math.min(1, lvl - 1.2));
  const calm = clamp((lvl - 1) / 1.5, 0, 1);
  if (BATS.im) BATS.im.count = Math.round(220 - 170 * calm); if (SHIP.beam) SHIP.beam.visible = calm < 0.5;
  S.showCols = LS.cols; S.showKick = kick; if (lvl > 1) { S.lightShow = 'show'; } else if (S.lightShow === 'show') S.lightShow = 'idle';
}

export { LS, buildLightShow, setAct, converge, pulse };
