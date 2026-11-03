/* =========================================================================
   LIGHTS — layered, never one rigid key: a low warm sun (the shadow caster, moonlight at night), a sky /
   ground hemisphere fill, a cool rim from the opposite side, sky reflections (scene.environment), and a pool
   of warm local point lights placed by the world (plaza, gate, rides) that wake up as night falls.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { renderer, scene, Q, BOOT_TIER, onQuality } from './renderer.js';
import { MOOD, lookColor, lookNum, sunDir, nightness } from './mood.js';
import { SET, WX } from './settings.js';

function createLights() {
  const R = 112;
  const sun = new THREE.DirectionalLight(); sun.castShadow = true;
  // one fixed shadow box over the park: no shimmering as the camera moves
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 420 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.08; sun.shadow.radius = 3; sun.target.position.set(0, 0, -6);
  const hemi = new THREE.HemisphereLight(), rim = new THREE.DirectionalLight();
  scene.add(sun, sun.target, hemi, rim);
  const sizeShadow = () => { const s = Q.shadowMap; if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } renderer.shadowMap.needsUpdate = true; };
  sizeShadow(); onQuality(sizeShadow);

  // local lights: a fixed pool sized by the starting tier (changing the count would recompile every shader)
  const pool = [], max = CONFIG.quality[BOOT_TIER].lights;
  function addLocal(pos, color = '#FFC89A', intensity = 30, distance = 18) {
    if (pool.length >= max) return null;
    const p = new THREE.PointLight(color, 0, distance, 2); p.position.copy(pos); scene.add(p); pool.push({ p, base: intensity }); return p;
  }
  const _d = new THREE.Vector3();
  function apply() {
    sunDir(_d); const below = _d.y < 0.02;
    sun.position.copy(_d).multiplyScalar(260).add(sun.target.position); lookColor('sun.color', sun.color); sun.intensity = below ? 0 : lookNum('sun.intensity') * SET.light * WX.light * (1 - WX.cover * 0.55);
    lookColor('hemi.sky', hemi.color); lookColor('hemi.ground', hemi.groundColor); hemi.intensity = lookNum('hemi.intensity') * SET.light * (0.85 + WX.light * 0.15);
    rim.position.set(-_d.x, 0.45, -_d.z).multiplyScalar(200); lookColor('rim.color', rim.color); rim.intensity = lookNum('rim.intensity');
    scene.environmentIntensity = lookNum('env'); renderer.toneMappingExposure = lookNum('exposure');
    const n = nightness(); for (const l of pool) l.p.intensity = l.base * n * SET.light;
    renderer.shadowMap.needsUpdate = true;
  }
  apply();
  let frame = 0;
  return {
    sun, hemi, rim, addLocal, apply,
    update() { if (MOOD.changed || SET.changed) apply(); renderer.shadowMap.enabled = Q.shadowEvery > 0; if (Q.shadowEvery > 0 && ++frame % Q.shadowEvery === 0) renderer.shadowMap.needsUpdate = true; },   // (Low: no moon shadows)
  };
}

export { createLights };
