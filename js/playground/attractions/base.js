/* =========================================================================
   ATTRACTION BASE — the contract every ride and game follows:
   create(config) → { id, kind, name, icon, desc, object3D, hits, pickables, focus, running, setRunning,
                      update(dt, elapsed), onPick?(hit), play?() }
   `drive` eases between 0 (stopped) and 1 (running) so every start and stop accelerates smoothly.
   ========================================================================= */
import * as THREE from 'three';
import { damp } from '../core/mood.js';

const HIT = new THREE.MeshBasicMaterial({ visible: false });

function attraction(o) {
  const a = { kind: 'ride', running: true, drive: 1, rate: 0.55, update() {}, ...o };
  a.setRunning = (b) => { a.running = b; a.onRunning && a.onRunning(b); };
  a.ease = (dt) => (a.drive = damp(a.drive, a.running ? 1 : 0, a.rate, dt));
  return a;
}
// invisible proxy shapes for the picker
function hitCylinder(parent, r, h, y = 0) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), HIT); m.position.y = y + h / 2; parent.add(m); return m; }
function hitBox(parent, w, h, d, y = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), HIT); m.position.y = y + h / 2; parent.add(m); return m; }
function hitSphere(parent, r, pos) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), HIT); m.position.copy(pos); parent.add(m); return m; }

export { attraction, hitCylinder, hitBox, hitSphere, HIT };
