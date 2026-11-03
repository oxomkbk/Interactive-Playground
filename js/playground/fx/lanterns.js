/* =========================================================================
   SKY LANTERNS — paper lanterns released from the plaza: each a warm, glowing, slightly flickering lantern
   that rises on the night air, drifts with the wind and dwindles into a point of light among the stars.
   ========================================================================= */
import * as THREE from 'three';
import { WX } from '../core/settings.js';

const MAX = 90, R = (a, b) => a + (b - a) * Math.random();

function createLanterns() {
  // closed paper body (an open rim read as a dark ring from below) and tone-mapped colour, so a lantern overhead glows amber instead of blooming into a white disc
  const geo = new THREE.CylinderGeometry(0.26, 0.2, 0.5, 10, 1, false), mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true, side: THREE.DoubleSide, transparent: true });
  const im = new THREE.InstancedMesh(geo, mat, MAX); im.frustumCulled = false; im.count = 0;
  const L = [], _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), c = new THREE.Color(), base = [new THREE.Color(1.7, 0.78, 0.28), new THREE.Color(1.6, 0.6, 0.45), new THREE.Color(1.75, 0.95, 0.4)];
  for (let i = 0; i < MAX; i++) im.setColorAt(i, base[0]);
  return {
    object3D: im,
    release(n = 50, x = 0, z = 0, spread = 9) { for (let i = 0; i < n; i++) { if (L.length >= MAX) L.shift(); const a = R(0, Math.PI * 2), r = Math.sqrt(Math.random()) * spread;
      L.push({ p: new THREE.Vector3(x + Math.cos(a) * r, R(1.2, 2), z + Math.sin(a) * r), vy: R(0.7, 1.2), t: -R(0, 8), ph: R(0, 6), col: base[i % 3] }); } },
    update(dt, t) {
      let n = 0;
      for (let i = L.length - 1; i >= 0; i--) { const l = L[i]; l.t += dt; if (l.t < 0) continue; if (l.t > 90) { L.splice(i, 1); continue; } }
      for (const l of L) { if (l.t < 0) continue;
        l.p.y += l.vy * dt; l.p.x += (Math.sin(t * 0.3 + l.ph) * 0.15 + 0.25 * WX.wind) * dt; l.p.z += Math.cos(t * 0.27 + l.ph) * 0.15 * dt;
        const k = Math.max(0.15, 1 - l.p.y / 160); _m.compose(l.p, _q, _s.setScalar(k * (1 + l.p.y / 120)));
        im.setMatrixAt(n, _m); c.copy(l.col).multiplyScalar((0.75 + 0.25 * Math.sin(t * 9 + l.ph * 7)) * Math.min(1, l.t * 0.5) * k); im.setColorAt(n, c); n++; }
      im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    },
  };
}

export { createLanterns };
