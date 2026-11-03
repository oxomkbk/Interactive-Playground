/* =========================================================================
   CAMERA DIRECTOR — OrbitControls with damping, zoom and angle limits and a clamped pan, plus four modes:
   free (you drive) · overview (a slow, high cinematic orbit of the whole park) · focus (framed on one
   attraction, gently circling) · tour (glides between landmarks and rides). Every move is an eased flight,
   never a cut. After CONFIG.camera.idleSeconds without input the tour starts; any input hands control back.
   Ride view: an attraction exposes rideCam(pos, look) and the camera rides along, smoothed, with mouse look.
   Camera speed and field of view come from the world settings.
   ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config.js';
import { camera, renderer } from './renderer.js';
import { SET } from './settings.js';
import { damp } from './mood.js';

const C = CONFIG.camera;
const V = (a) => new THREE.Vector3(...a);
const ease = t => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep

function createDirector() {
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: C.damping, minDistance: C.minDistance, maxDistance: C.maxDistance, minPolarAngle: C.minPolar, maxPolarAngle: C.maxPolar,
    rotateSpeed: 0.55, zoomSpeed: 0.8, panSpeed: 0.7, screenSpacePanning: false, autoRotateSpeed: 0.35 });
  controls.target.copy(V(C.home.target)); camera.position.copy(V(C.home.pos));
  const S = { mode: 'free', flight: null, idle: 0, shots: [], shot: -1, shotT: 0, listeners: [], ride: null, hold: false, look: { yaw: 0, pitch: 0 } };
  const emit = () => S.listeners.forEach(f => f(S.mode));

  function flyTo(pos, target, seconds = 2.4, then) {
    S.flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), t: 0, d: seconds / Math.max(0.3, SET.cameraSpeed), then };
    controls.enabled = false; controls.autoRotate = false;
  }
  // a framed view of a point: from the plaza side, at a given distance and height
  function frame(target, dist, height, from = new THREE.Vector3(0, 0, 18)) {
    const dir = new THREE.Vector3(from.x - target.x, 0, from.z - target.z); if (dir.lengthSq() < 1) dir.set(0.4, 0, 1); dir.normalize();
    return target.clone().addScaledVector(dir, dist).add(new THREE.Vector3(0, height, 0));
  }
  function setMode(mode, opts = {}) {
    S.mode = mode; controls.autoRotate = false; S.shot = -1; if (mode !== 'ride') S.ride = null;
    if (mode === 'player') { S.flight = null; controls.enabled = false; emit(); return; }
    if (mode === 'cinematic' && opts.target) { const t = opts.target.clone(), p = camera.position.clone().sub(t).setLength(opts.dist || 7).add(t); p.y = Math.max(p.y, t.y + 1.2); S.mode = 'free'; flyTo(p, t, 1.4, () => { controls.autoRotate = true; controls.autoRotateSpeed = 0.5 * SET.cameraSpeed; }); emit(); return; }
    if (mode === 'overview') flyTo(new THREE.Vector3(150, 110, 150), new THREE.Vector3(0, 0, -6), 3.2, () => { controls.autoRotate = true; controls.autoRotateSpeed = 0.22 * SET.cameraSpeed; });
    else if (mode === 'focus' && opts.focus) { const f = opts.focus, t = V(f.target); flyTo(frame(t, f.dist, f.height), t, opts.seconds ?? 2.2, () => { controls.autoRotate = !opts.still; controls.autoRotateSpeed = 0.3 * SET.cameraSpeed; }); }
    else if (mode === 'tour') nextShot();
    else if (mode === 'home') { S.mode = 'free'; flyTo(V(C.home.pos), V(C.home.target), 2.6); }
    else if (mode === 'ride' && opts.ride) { // fly to the seat, then ride along
      S.ride = opts.ride; S.look.yaw = S.look.pitch = 0; const p = V([0, 0, 0]), l = V([0, 0, 0]); opts.ride.rideCam(p, l);
      _gaze.subVectors(l, p).normalize(); flyTo(p, l, 1.6, () => { controls.enabled = false; }); }
    emit();
  }
  function nextShot() {
    if (!S.shots.length) return; S.shot = (S.shot + 1) % S.shots.length; const f = S.shots[S.shot], t = V(f.target);
    S.shotT = f.hold || 9; flyTo(f.pos ? V(f.pos) : frame(t, f.dist, f.height, f.from ? V(f.from) : undefined), t, 4.2, () => { controls.autoRotate = true; controls.autoRotateSpeed = (f.spin ?? 0.4) * SET.cameraSpeed; });
    S.listeners.forEach(fn => fn(S.mode, f));
  }
  // any user input ends automatic modes (keeping the current view) and resets the idle clock
  // mouse look while riding
  let drag = null;
  renderer.domElement.addEventListener('pointerdown', e => { if (S.mode === 'ride' && !S.flight) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => { drag = null; });
  // with the mouse captured (pointer lock) the ride view follows it directly
  document.addEventListener('mousemove', e => { if (S.mode !== 'ride' || S.flight || !document.pointerLockElement) return; S.look.yaw -= e.movementX * 0.0022; S.look.pitch = Math.max(-1.1, Math.min(1.1, S.look.pitch - e.movementY * 0.0022)); });
  addEventListener('pointermove', e => { if (!drag) return; S.look.yaw -= (e.clientX - drag.x) * 0.004; S.look.pitch = Math.max(-1.1, Math.min(1.1, S.look.pitch - (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; });
  const wake = () => { S.idle = 0; if (S.mode === 'tour' || S.mode === 'overview') { S.flight = null; controls.enabled = true; controls.autoRotate = false; S.mode = 'free'; emit(); } };
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, wake, { passive: true });

  const panR = C.panLimit;
  const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _side = new THREE.Vector3(), _gaze = new THREE.Vector3(0, 0, -1);
  function update(dt) {
    if (SET.changed && Math.abs(camera.fov - SET.fov) > 0.01) { camera.fov = SET.fov; camera.updateProjectionMatrix(); }
    if (S.mode === 'player' && !S.flight) { S.idle = 0; return; }
    controls.rotateSpeed = 0.55 * SET.cameraSpeed; controls.zoomSpeed = 0.8 * SET.cameraSpeed; controls.panSpeed = 0.7 * SET.cameraSpeed;
    if (S.mode === 'ride' && S.ride && !S.flight) { // ride along: smoothed seat position, look-at + mouse look offset
      // the eye is bolted to the seat (any lag here reads as judder when the ride moves fast); only the gaze is smoothed
      S.ride.rideCam(_p, _l); camera.position.copy(_p);
      _d.subVectors(_l, _p).normalize().applyAxisAngle(_up, S.look.yaw); _side.crossVectors(_d, _up).normalize(); _d.applyAxisAngle(_side, S.look.pitch);
      _gaze.lerp(_d, 1 - Math.exp(-10 * dt)).normalize(); controls.target.copy(camera.position).add(_gaze); camera.lookAt(controls.target); S.idle = 0; return; }
    if (S.flight) {
      const f = S.flight; f.t = Math.min(1, f.t + dt / f.d); const k = ease(f.t);
      camera.position.lerpVectors(f.p0, f.p1, k); camera.position.y += Math.sin(k * Math.PI) * f.p0.distanceTo(f.p1) * 0.08; // a gentle arc, like a crane
      controls.target.lerpVectors(f.t0, f.t1, k); camera.lookAt(controls.target);
      if (f.t >= 1) { S.flight = null; controls.enabled = S.mode !== 'player'; if (controls.enabled) controls.update(); f.then && f.then(); }
      return;
    }
    // keep the orbit centre inside the park and above the ground
    const t = controls.target, r = Math.hypot(t.x, t.z); if (r > panR && t.z > -100) { t.x *= panR / r; t.z *= panR / r; } t.y = Math.max(0.5, Math.min(40, t.y));
    controls.update(dt);
    if (S.mode === 'tour' && (S.shotT -= dt) <= 0) nextShot();
    if ((S.mode === 'free' || S.mode === 'focus') && !S.hold) { S.idle += dt; if (S.idle > C.idleSeconds && S.shots.length) setMode('tour'); }
  }
  function intro(done, to, toTarget) {
    const I = C.intro; camera.position.copy(V(I.from)); controls.target.copy(V(I.fromTarget)); camera.lookAt(controls.target);
    flyTo(to || V(C.home.pos), toTarget || V(C.home.target), I.seconds, done);
  }
  return { controls, S, update, setMode, flyTo, frame, intro, nextShot, onChange: f => S.listeners.push(f), setShots: s => { S.shots = s; } };
}

export { createDirector };
