/* =========================================================================
   PLAYER — the third-person controller and its cameras.
   Movement: W A S D relative to the camera, Shift to sprint (a stamina bar refills when you walk), Space to
   jump; speed eases in and out (acceleration / deceleration), the body turns smoothly toward where it moves,
   gravity, landing, terrain height, the moon bridge, collisions (walk world) and park bounds.
   Look: the mouse (pointer lock — click the view to capture it, Esc releases it), or drag when not locked.
   Cameras: third person (shoulder boom that pulls in instead of clipping through walls, scroll to zoom) and
   first person (eye height, head hidden). Cinematic, focus and ride cameras live in the director.
   ========================================================================= */
import * as THREE from 'three';
import { SET } from '../core/settings.js';

const PI = Math.PI, TAU = PI * 2;
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const angDamp = (a, b, r, dt) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * (1 - Math.exp(-r * dt)); };
const WALK = 2.1, RUN = 5.6, ACCEL = 9, DECEL = 11, GRAV = 22, JUMP = 6.4, RADIUS = 0.32, EYE = 1.58;

function createPlayer({ character, world, camera, dom, onInteract, onCycleCamera, onJump }) {
  const S = {
    pos: new THREE.Vector3(0, 0, CONFIG_START.z), vel: new THREE.Vector2(), vy: 0, yaw: PI, grounded: true, landed: false,
    camYaw: 0, camPitch: 0.24, camDist: 4.6, camDistNow: 4.6, view: 'first', enabled: true, locked: false,
    stamina: 1, distance: 0, run: 0, blend: 0, blendFrom: new THREE.Vector3(), blendLook: new THREE.Vector3(), keys: new Set(), turn: 0, accel: 0, speed: 0,
  };
  const obj = character.object3D;
  // ---------- input ----------
  const isTyping = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', (e) => {
    if (isTyping(e) || !S.enabled) return;
    S.keys.add(e.code);
    if (e.code === 'Space') { e.preventDefault(); if (S.grounded) { S.vy = JUMP; S.grounded = false; onJump && onJump(); } }
    if (e.code === 'KeyE') onInteract && onInteract();
    if (e.code === 'KeyC') onCycleCamera && onCycleCamera();
  });
  addEventListener('keyup', (e) => S.keys.delete(e.code));
  addEventListener('blur', () => S.keys.clear());
  const sens = () => 0.0022 * (SET.sens ?? 1);
  document.addEventListener('pointerlockchange', () => { S.locked = document.pointerLockElement === dom; document.body.classList.toggle('locked', S.locked); });
  document.addEventListener('mousemove', (e) => {
    if (!S.enabled) return;
    if (S.locked) look(e.movementX, e.movementY);
    else if (drag) { look(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; }
  });
  let drag = null;
  dom.addEventListener('pointerdown', (e) => { if (S.enabled && !S.locked && (e.button === 2 || e.button === 1)) drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => { drag = null; });
  dom.addEventListener('contextmenu', (e) => { if (S.enabled) e.preventDefault(); });
  dom.addEventListener('wheel', (e) => { if (!S.enabled || S.view !== 'third') return; S.camDist = Math.max(1.6, Math.min(10, S.camDist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: true });
  function look(dx, dy) {
    S.camYaw -= dx * sens(); const inv = SET.invertY ? -1 : 1;
    S.camPitch = Math.max(S.view === 'first' ? -1.2 : -0.45, Math.min(S.view === 'first' ? 1.3 : 1.25, S.camPitch + dy * sens() * inv));
  }
  const lock = () => { if (!S.locked && dom.requestPointerLock) { try { const p = dom.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch (e) {} } };
  const unlock = () => { if (document.pointerLockElement) document.exitPointerLock(); };

  // ---------- simulation ----------
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), pivot = new THREE.Vector3(), want = new THREE.Vector3(), lookAt = new THREE.Vector3(), tmp = { x: 0, z: 0 };
  function step(dt) {
    const k = S.keys, ix = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0), iz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const moving = S.enabled && (ix || iz), sprint = moving && (k.has('ShiftLeft') || k.has('ShiftRight')) && S.stamina > 0.02;
    S.stamina = Math.max(0, Math.min(1, S.stamina + (sprint ? -dt / 9 : dt / 5)));
    // camera-relative wish direction
    const cy = Math.cos(S.camYaw), sy = Math.sin(S.camYaw);
    let wx = 0, wz = 0;
    // (camera looks along −(sin yaw, cos yaw); right is (cos yaw, −sin yaw))
    if (moving) { wx = -sy * iz + cy * ix; wz = -cy * iz - sy * ix; const l = Math.hypot(wx, wz); wx /= l; wz /= l; }
    const target = moving ? (sprint ? RUN : WALK) * (SET.walk ?? 1) : 0, air = S.grounded ? 1 : 0.35;
    const before = S.vel.length();
    const rate = (target > before ? ACCEL : DECEL) * air;
    S.vel.x = damp(S.vel.x, wx * target, rate, dt); S.vel.y = damp(S.vel.y, wz * target, rate, dt);
    const sp = S.vel.length(); S.accel = (sp - before) / Math.max(dt, 1e-4); S.speed = sp;
    // face the direction of travel
    const prevYaw = S.yaw; if (sp > 0.15) S.yaw = angDamp(S.yaw, Math.atan2(S.vel.x, S.vel.y), 11, dt);
    S.turn = Math.atan2(Math.sin(S.yaw - prevYaw), Math.cos(S.yaw - prevYaw)) / Math.max(dt, 1e-4);
    // move, collide, keep inside the park
    const ox = S.pos.x, oz = S.pos.z; tmp.x = ox + S.vel.x * dt; tmp.z = oz + S.vel.y * dt;
    world.resolve(tmp, RADIUS, S.pos.y - world.groundAt(tmp.x, tmp.z));
    if (!world.inBounds(tmp.x, tmp.z)) { if (world.inBounds(tmp.x, oz)) tmp.z = oz; else if (world.inBounds(ox, tmp.z)) tmp.x = ox; else { tmp.x = ox; tmp.z = oz; } S.vel.multiplyScalar(0.5); }
    // a steep rise (more than a step) stops you, unless you're jumping over it
    const g1 = world.groundAt(tmp.x, tmp.z); if (g1 - S.pos.y > 0.6) { tmp.x = ox; tmp.z = oz; }
    const moved = Math.hypot(tmp.x - ox, tmp.z - oz); S.distance += moved; S.pos.x = tmp.x; S.pos.z = tmp.z;
    // vertical: gravity, landing, stick to slopes and the bridge when walking down
    const g = world.groundAt(S.pos.x, S.pos.z); S.landed = false;
    if (S.grounded) { if (S.pos.y - g < 0.6) S.pos.y = g; else { S.grounded = false; S.vy = 0; } }
    if (!S.grounded) { S.vy -= GRAV * dt; S.pos.y += S.vy * dt; if (S.pos.y <= g) { S.pos.y = g; S.landed = S.vy < -4; S.vy = 0; S.grounded = true; } }
  }

  function cameraUpdate(dt) {
    const first = S.view === 'first';
    character.setHeadVisible(!first);
    fwd.set(-Math.sin(S.camYaw) * Math.cos(S.camPitch), -Math.sin(S.camPitch), -Math.cos(S.camYaw) * Math.cos(S.camPitch));
    if (first) {
      want.set(S.pos.x, S.pos.y + EYE, S.pos.z).addScaledVector(new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw)), 0.12);
      lookAt.copy(want).add(fwd);
    } else {
      pivot.set(S.pos.x, S.pos.y + 1.45, S.pos.z);
      right.set(Math.cos(S.camYaw), 0, -Math.sin(S.camYaw));
      want.copy(pivot).addScaledVector(fwd, -S.camDist).addScaledVector(right, 0.38).y += 0.1;
      const f = world.boom(pivot, want);                                   // pull in before a wall, never through it
      const d = S.camDist * f; S.camDistNow = d < S.camDistNow ? damp(S.camDistNow, d, d < S.camDistNow - 1.2 ? 30 : 14, dt) : damp(S.camDistNow, d, 3, dt);
      want.copy(pivot).addScaledVector(fwd, -S.camDistNow).addScaledVector(right, 0.38 * Math.min(1, S.camDistNow / 2));
      want.y = Math.max(want.y, world.groundAt(want.x, want.z) + 0.3);
      lookAt.copy(pivot).addScaledVector(fwd, 6);
    }
    if (S.blend < 1) { S.blend = Math.min(1, S.blend + dt / 1.1); const e = S.blend * S.blend * (3 - 2 * S.blend);
      camera.position.lerpVectors(S.blendFrom, want, e); const l = new THREE.Vector3().lerpVectors(S.blendLook, lookAt, e); camera.lookAt(l); }
    else { camera.position.copy(want); camera.lookAt(lookAt); }
  }

  return {
    S, lock, unlock,
    update(dt) {
      if (S.enabled) step(dt); else { S.vel.multiplyScalar(Math.exp(-10 * dt)); S.speed = S.vel.length(); S.accel = 0; S.turn = 0; }
      obj.position.copy(S.pos); obj.rotation.y = S.yaw;
      character.update(dt, { speed: S.speed, grounded: S.grounded, vy: S.vy, turn: S.turn, accel: S.accel, landed: S.landed });
      if (S.enabled) cameraUpdate(dt);
    },
    // hand the camera back to the player, easing from wherever it is now
    resume(fromLook) { S.enabled = true; S.blend = 0; S.blendFrom.copy(camera.position); S.blendLook.copy(fromLook || pivot); S.keys.clear(); },
    suspend() { S.enabled = false; S.keys.clear(); },
    setView(v) { v = 'first'; S.view = v; S.blend = 0; S.blendFrom.copy(camera.position); S.blendLook.copy(lookAt); if (v === 'first') S.camPitch = Math.min(S.camPitch, 0.6); },
    teleport(x, z, yaw) { S.pos.set(x, world.groundAt(x, z), z); S.vel.set(0, 0); S.vy = 0; S.grounded = true; if (yaw !== undefined) { S.yaw = yaw; S.camYaw = yaw + PI; } },
    head: () => new THREE.Vector3(S.pos.x, S.pos.y + 1.5, S.pos.z),
    forward: () => new THREE.Vector3(-Math.sin(S.camYaw), 0, -Math.cos(S.camYaw)),
  };
}
const CONFIG_START = { z: 112 };

export { createPlayer };
