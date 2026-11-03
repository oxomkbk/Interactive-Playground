/* =========================================================================
   STARGAZER OBSERVATORY — a stone tower with a turning silver dome, a brass telescope through the slit, a
   balcony and a spiral of steps. "Stargaze" takes you to the eyepiece (main.js switches to night): drag to
   sweep the sky, and when one of six hidden constellations sits in the middle of your view for a moment its
   lines draw themselves in light and it's added to your sky journal (kept between visits).
   ========================================================================= */
import * as THREE from 'three';
import { createBatch } from '../core/batch.js';
import { heartGeo, rodGeo, rbox } from '../core/geo.js';
import { paint, gold, stone, silver, plaster, bulb } from '../core/materials.js';
import { camera } from '../core/renderer.js';
import { nightness } from '../core/mood.js';
import { attraction, hitCylinder } from './base.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), PI = Math.PI, TAU = PI * 2;
// constellations: [name, azimuth°, elevation°, points in a local 2D frame (degrees), line pairs]
const heart = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * TAU, x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [x / 16 * 6, y / 16 * 6]; });
const loop = (n) => Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);
const SKY = [
  ['The Lovers’ Heart', 200, 38, heart, loop(10)],
  ['The Crown', 140, 52, [[-6, 0], [-4, 4], [-2, 0], [0, 5], [2, 0], [4, 4], [6, 0], [-6, -2], [6, -2]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 7], [7, 8], [8, 6]]],
  ['The Swan', 260, 44, [[0, 6], [0, 2], [0, -2], [0, -6], [-6, 1], [-3, 1.5], [3, 1.5], [6, 1]], [[0, 1], [1, 2], [2, 3], [4, 5], [5, 1], [1, 6], [6, 7]]],
  ['The Key', 90, 34, [[-5, 2], [-3, 4], [-1, 2], [-3, 0], [1, 2], [6, 2], [6, 0], [4, 2], [4, 0.5]], [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6], [7, 8]]],
  ['The Little Carousel', 320, 30, [[-5, 0], [-3, 3], [0, 4], [3, 3], [5, 0], [0, 8], [-4, -3], [0, -3], [4, -3]], [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [0, 6], [2, 7], [4, 8]]],
  ['The Teacup', 30, 60, [[-4, 2], [4, 2], [3, -1], [-3, -1], [5.5, 1.5], [5.5, 0], [-6, -2.5], [6, -2.5]], [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 5], [5, 2], [6, 7]]],
];

export function create({ x, z } = {}) {
  const root = new THREE.Group(); root.name = 'observatory'; root.position.set(x, 0, z); root.rotation.y = Math.atan2(-x, -z);
  const c = { cast: true }, B = createBatch('observatory');
  B.add(new THREE.CylinderGeometry(4.6, 5.0, 0.6, 32), stone(2, '#D8CABD'), [0, 0.3, 0], c);
  B.add(new THREE.CylinderGeometry(3.6, 3.9, 6.0, 32), plaster('#F3E8F7', 2), [0, 3.6, 0], c);
  B.add(new THREE.TorusGeometry(3.75, 0.12, 8, 48).rotateX(PI / 2), gold(), [0, 6.55, 0]);
  B.add(new THREE.CylinderGeometry(4.3, 4.3, 0.25, 32), stone(1, '#D8CABD'), [0, 6.7, 0], c);              // balcony
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; B.add(rodGeo(V(Math.sin(a) * 4.15, 6.8, Math.cos(a) * 4.15), V(Math.sin(a) * 4.15, 7.6, Math.cos(a) * 4.15), 0.03, 4), gold()); }
  B.add(new THREE.TorusGeometry(4.15, 0.04, 6, 64).rotateX(PI / 2), gold(), [0, 7.6, 0]);
  for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 1.6 + PI * 0.2, y = 0.6 + i * 0.34; B.add(rbox(1.3, 0.14, 0.6, 0.04), stone(1, '#D8CABD'), [Math.sin(a) * 4.5, y, Math.cos(a) * 4.5], { rotY: a, cast: true }); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; B.add(rbox(0.6, 1.0, 0.1, 0.05), new THREE.MeshStandardMaterial({ color: '#2a2030', emissive: '#FFD9A8', emissiveIntensity: 0.6, roughness: 0.3 }), [Math.sin(a) * 3.66, 4.2, Math.cos(a) * 3.66], { rotY: a }); }
  B.build(root);
  // the dome: two shells leaving a slit, turning slowly; the telescope points out of the slit
  const dome = new THREE.Group(); dome.position.y = 6.8; root.add(dome);
  const D = createBatch('dome'), slit = 0.32;
  D.add(new THREE.SphereGeometry(3.5, 40, 16, slit / 2, PI - slit, 0, PI / 2), silver(), null, c); D.add(new THREE.SphereGeometry(3.5, 40, 16, PI + slit / 2, PI - slit, 0, PI / 2), silver(), null, c);
  D.add(new THREE.TorusGeometry(3.5, 0.08, 6, 48).rotateX(PI / 2), gold());
  D.add(heartGeo(0.35, 0.14), gold(), [0, 3.75, 0]);
  const tube = new THREE.CylinderGeometry(0.42, 0.55, 5.2, 20).rotateX(PI / 2).translate(0, 0, 1.2).rotateX(-0.85);
  D.add(tube, paint('#B98A4E', 0.3), [0, 1.2, 0], c); D.add(new THREE.TorusGeometry(0.46, 0.06, 6, 20).translate(0, 0, 3.8).rotateX(-0.85), gold(), [0, 1.2, 0]);
  D.build(dome);
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulb('#FFE2B8', 3), 40), m = new THREE.Matrix4(); for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; bl.setMatrixAt(i, m.makeTranslation(Math.sin(a) * 4.15, 7.65, Math.cos(a) * 4.15)); } root.add(bl);

  // constellations in the sky (world space, far away): bright stars always; lines once discovered
  const sky = new THREE.Group(); sky.name = 'constellations';
  let journal = new Set(); try { JSON.parse(localStorage.getItem('sweetheart-stars') || '[]').forEach(n => journal.add(n)); } catch (e) {}
  const starMat = new THREE.PointsMaterial({ color: '#FFF6E8', size: 3.2, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const cons = SKY.map(([name, az, el, pts, lines]) => {
    const dir = new THREE.Vector3(Math.sin(az * PI / 180) * Math.cos(el * PI / 180), Math.sin(el * PI / 180), Math.cos(az * PI / 180) * Math.cos(el * PI / 180)).normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const world = pts.map(([px, py]) => dir.clone().add(right.clone().multiplyScalar(Math.tan(px * PI / 180))).add(up.clone().multiplyScalar(Math.tan(py * PI / 180))).normalize().multiplyScalar(900));
    const sp = new THREE.Points(new THREE.BufferGeometry().setFromPoints(world), starMat); sp.frustumCulled = false; sky.add(sp);
    const lg = new THREE.BufferGeometry().setFromPoints(lines.flatMap(([i, j]) => [world[i], world[j]]));
    const lm = new THREE.LineBasicMaterial({ color: new THREE.Color('#FFD1E4').multiplyScalar(2.4), transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    const ln = new THREE.LineSegments(lg, lm); ln.frustumCulled = false; sky.add(ln);
    return { name, dir, ln, gaze: 0, found: journal.has(name) };
  });
  const S = { gazing: false };
  const a = attraction({ id: 'observatory', kind: 'experience', name: 'Stargazer Observatory', icon: '🔭', zone: 'Northern Heights',
    desc: 'Climb to the telescope and sweep the night sky. Six constellations are hidden up there — hold one in the centre of your view to trace it in light.',
    object3D: root, focus: { target: [x, 5, z], dist: 22, height: 4 } });
  a.hits = [hitCylinder(root, 5, 11, 0)]; a.sky = sky;
  a.playLabel = 'Stargaze';
  a.state = () => ({ playing: S.gazing, found: cons.filter(c2 => c2.found).length, total: cons.length });
  a.play = () => { S.gazing = true; a.onStargaze && a.onStargaze(true); a.ui && a.ui.gameUpdate(a); };
  a.stop = () => { S.gazing = false; a.onStargaze && a.onStargaze(false); a.ui && a.ui.gameUpdate(a); };
  // the eyepiece: high on the balcony, looking up the telescope's line
  a.rideCam = (pos, look) => { root.localToWorld(pos.set(0, 9.5, 0)); look.copy(pos).add(new THREE.Vector3(0, 0.8, 1).applyQuaternion(root.quaternion).multiplyScalar(10)); };
  const fwd = new THREE.Vector3();
  a.update = (dt, t) => {
    dome.rotation.y += dt * 0.05 * a.ease(dt);
    const n = nightness(); starMat.opacity = Math.max(S.gazing ? 1 : 0, Math.min(1, n * 1.2));
    camera.getWorldDirection(fwd);
    for (const c2 of cons) {
      if (S.gazing && !c2.found) { const ang = fwd.angleTo(c2.dir) * 180 / PI; c2.gaze = ang < 7 ? c2.gaze + dt : Math.max(0, c2.gaze - dt * 2);
        if (c2.gaze > 1.1) { c2.found = true; journal.add(c2.name); try { localStorage.setItem('sweetheart-stars', JSON.stringify([...journal])); } catch (e) {}
          a.sfx && a.sfx.wish && a.sfx.wish(); a.ui && (a.ui.toast('Constellation found!', c2.name, '✨'), a.ui.gameUpdate(a));
          if (cons.every(q => q.found)) a.ui && a.ui.toast('Your sky journal is complete', 'Every constellation, traced in light.', '🔭'); } }
      const want = c2.found ? (S.gazing ? 1 : 0.55 * n) : Math.min(0.25, c2.gaze * 0.25);
      c2.ln.material.opacity += (want - c2.ln.material.opacity) * Math.min(1, dt * 2.5);
    }
    void t;
  };
  return a;
}
