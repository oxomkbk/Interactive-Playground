/* =========================================================================
   PICKING — hover and click on attractions. Each attraction offers a few invisible proxy shapes (`hits`),
   so the raycast is cheap; some also offer fine targets (teacups, bottles) through `pickables`.
   Hover: pointer cursor, outline glow, a soft scale-up. Click (a press without dragging): the attraction's
   own handler. A click on open sky reports the point so the park can launch fireworks there.
   ========================================================================= */
import * as THREE from 'three';
import { camera, renderer } from './renderer.js';
import { damp } from './mood.js';

function createPicker({ onHover, onPick, onSky, onMiss, route = () => false }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), targets = [], fine = [];
  const S = { hover: null, down: null, enabled: true, dirty: false, x: 0, y: 0 };
  const el = renderer.domElement;
  function register(att) { for (const h of att.hits || []) { h.userData.att = att; targets.push(h); } for (const p of att.pickables || []) { p.userData.att = att; fine.push(p); } }
  function cast(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const f = ray.intersectObjects(fine, false)[0]; if (f) return { att: f.object.userData.att, obj: f.object, point: f.point, fine: true };
    const h = ray.intersectObjects(targets, false)[0]; return h ? { att: h.object.userData.att, obj: h.object, point: h.point } : null;
  }
  const rayAt = (x, y) => { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray; };
  // an active game can claim the pointer (aim, putt, steer a hook, shoot): it gets move / down / up with a world ray
  el.addEventListener('pointermove', e => { S.x = e.clientX; S.y = e.clientY; if (route('move', rayAt(e.clientX, e.clientY))) { setHover(null); return; } S.dirty = true; });
  el.addEventListener('pointerleave', () => { S.dirty = false; setHover(null); });
  el.addEventListener('pointerdown', e => { if (route('down', rayAt(e.clientX, e.clientY))) { S.down = null; return; } S.down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', e => {
    if (route('up', rayAt(e.clientX, e.clientY))) { S.down = null; return; }
    const d = S.down; S.down = null; if (!d || !S.enabled) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return; // that was a drag
    const hit = cast(e.clientX, e.clientY);
    if (hit) { onPick(hit); return; }
    if (onMiss && onMiss(ray.ray)) return;
    if (ray.ray.direction.y > 0.08) onSky(ray.ray.origin.clone().addScaledVector(ray.ray.direction, 140));
  });
  function setHover(att) {
    if (att === S.hover) return; S.hover = att; el.style.cursor = att ? 'pointer' : ''; onHover(att);
  }
  return {
    S, register, cast, centerRay: () => rayAt(innerWidth / 2, innerHeight / 2),
    update(dt, atts) {
      if (S.dirty && S.enabled) { S.dirty = false; const h = cast(S.x, S.y); setHover(h ? h.att : null); }
      // no hover swell: in first person nothing should pulse or grow under the crosshair (only the click bounce remains)
      for (const a of atts) { if (!a.object3D || a.noScale) continue; const want = 1; a._hs = damp(a._hs ?? 1, want, 10, dt);
        const s = a._hs * (a._bounce ? 1 + Math.sin(a._bounce * 9) * 0.02 * a._bounce : 1); if (a._bounce) a._bounce = Math.max(0, a._bounce - dt * 1.6);
        if (Math.abs(a.object3D.scale.x - s) > 1e-4) a.object3D.scale.setScalar(s); }
    },
    bounce(att) { att._bounce = 1; },
  };
}

export { createPicker };
