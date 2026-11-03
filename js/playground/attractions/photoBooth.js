/* =========================================================================
   PHOTO BOOTH — a little rose-and-cream cabin by the plaza: velvet curtain, a bulb-lit marquee, a giant
   heart frame out front. "Take photos" runs a real sequence: the camera glides to four of the park's best
   views, counts down 3-2-1, flashes and captures each frame from the renderer, then composes a dated photo
   strip (with the park's name, a pastel border and a little heart) that you can download.
   main.js injects `camera` (flyTo) and `capture()`; the UI shows the countdown, flash and finished strip.
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox } from '../core/geo.js';
import { paint, gold, fabric, bulb, signMat, plaster } from '../core/materials.js';
import { sign } from '../core/textures.js';
import { attraction, hitBox } from './base.js';
import { t, onLang } from '../i18n.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI;
const SHOTS = [
  { name: 'The Wishing Fountain', pos: [14, 6, 22], target: [0, 4, 0] },
  { name: 'The Castle', pos: [10, 14, -70], target: [0, 26, -150] },
  { name: 'The Starlight Wheel', pos: [12, 8, -16], target: [36, 15, -38] },
  { name: 'The Grand Carousel', pos: [-18, 5, 8], target: [-31, 4, -2] },
];

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'photo'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z) + PI; // faces the boulevard
  const c = { cast: true }, B = createBatch('photo-booth');
  B.add(rbox(2.4, 2.9, 2.0, 0.15), plaster('#FFE4EC', 1), [0, 1.45, 0], c);
  B.add(rbox(2.6, 0.5, 2.2, 0.12), paint('#F28FAF', 0.4), [0, 3.1, 0], c);
  B.add(new THREE.PlaneGeometry(1.3, 2.0, 8, 1).translate(0, 1.2, 1.02), fabric('#C8577E', '#B04A70', 18, 1, 1), null, c);   // velvet curtain
  B.add(rodGeo(V(-0.75, 2.25, 1.05), V(0.75, 2.25, 1.05), 0.03, 6), gold());
  B.add(heartGeo(0.35, 0.14), gold(), [0, 3.65, 0]);
  // the big heart frame to pose in
  const hs = new THREE.Shape(); { const pts = []; for (let i = 0; i < 64; i++) { const a = i / 64 * PI * 2, hx = 16 * Math.sin(a) ** 3, hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); pts.push(new THREE.Vector2(hx / 16 * 1.1, (hy / 16 + 0.15) * 1.1)); } hs.setFromPoints(pts); const hole = new THREE.Path(pts.map(p => p.clone().multiplyScalar(0.82)).reverse()); hs.holes.push(hole); }
  B.add(new THREE.ExtrudeGeometry(hs, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), paint('#FFB3C6', 0.35), [2.4, 1.9, 0.6], c);
  B.add(rodGeo(V(2.4, 0, 0.66), V(2.4, 0.9, 0.66), 0.05, 6), gold());
  B.build(root);
  const mk = () => sign(t('Photo Booth'), { w: 1024, h: 256, size: 120 }), sm = signMat(mk(), 1.2); onLang(() => { sm.map = sm.emissiveMap = mk(); sm.needsUpdate = true; });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), sm); board.position.set(0, 3.1, 1.12); root.add(board);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), bulb('#FFE2B8', 3), 18), m = new THREE.Matrix4(); for (let i = 0; i < 18; i++) bl.setMatrixAt(i, m.makeTranslation(-1.25 + i * 0.147, 3.4, 1.13)); root.add(bl);
  const flash = new THREE.PointLight('#ffffff', 0, 12, 2); flash.position.set(0, 2.2, 1.6); root.add(flash);

  const S = { busy: false, n: 0 };
  const a = attraction({ id: 'photo', kind: 'experience', name: 'Photo Booth', icon: '📸', zone: 'Central Plaza',
    desc: 'Step behind the velvet curtain: the booth takes four snapshots around the park — 3, 2, 1, flash! — and prints you a keepsake photo strip.',
    object3D: root, focus: { target: [x, 1.8, z], dist: 8, height: 1.5 } });
  a.hits = [hitBox(root, 5.6, 4, 2.6, 0)];
  a.playLabel = 'Take photos';
  a.state = () => ({ playing: S.busy, shot: S.n });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  a.play = async () => {
    if (S.busy || !a.camera || !a.capture) return; S.busy = true; const frames = [];
    for (let i = 0; i < SHOTS.length; i++) { S.n = i + 1; const s = SHOTS[i];
      a.camera.flyTo(V(...s.pos), V(...s.target), 2.0); await wait(2300);
      for (const n of [3, 2, 1]) { a.ui && a.ui.countdown(n); a.sfx && a.sfx.pop && a.sfx.pop(); await wait(650); }
      a.ui && a.ui.flash(); flash.intensity = 60; a.sfx && a.sfx.ding && a.sfx.ding(); frames.push({ url: await a.capture(), name: s.name }); await wait(250); flash.intensity = 0; }
    S.busy = false; S.n = 0; a.plays = (a.plays || 0) + 1;
    a.ui && a.ui.photos(await compose(frames)); a.camera.flyTo(V(x + 6, 4, z + 9), V(x, 1.8, z), 2.0);
  };
  return a;
}

// the printed strip: four frames on cream card stock with the park's name and the date
async function compose(frames) {
  const W = 420, FH = 280, pad = 22, cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = pad + frames.length * (FH + pad) + 90;
  const g = cv.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, cv.height); grd.addColorStop(0, '#FFF5E1'); grd.addColorStop(1, '#FBE3EC'); g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < frames.length; i++) { const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = frames[i].url; });
    const y = pad + i * (FH + pad), sw = img.width, sh = img.height, k = Math.max(W / sw, FH / sh), cw = W / k, ch = FH / k;
    g.save(); g.beginPath(); g.roundRect(pad, y, W, FH, 10); g.clip(); g.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, pad, y, W, FH); g.restore();
    g.strokeStyle = 'rgba(242,143,175,.55)'; g.lineWidth = 3; g.beginPath(); g.roundRect(pad, y, W, FH, 10); g.stroke(); }
  g.fillStyle = '#C8577E'; g.textAlign = 'center'; g.font = '34px Pacifico, cursive'; g.fillText(t('Sweetheart Park'), cv.width / 2, cv.height - 46);
  g.fillStyle = '#9A6B88'; g.font = '600 14px Quicksand, sans-serif'; g.fillText('♥  ' + new Date().toLocaleDateString() + '  ♥', cv.width / 2, cv.height - 18);
  return cv.toDataURL('image/png');
}
