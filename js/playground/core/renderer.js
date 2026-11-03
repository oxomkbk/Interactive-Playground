/* =========================================================================
   RENDERER — antialiased WebGL renderer, sRGB output, ACES Filmic tone mapping, soft PCF shadows, the camera,
   quality tiers (pixel ratio, shadow map, shadow cadence, bloom, particles, foliage density, night lights)
   and an automatic step-down when frames run slow.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false; // the frame loop resets it, so stats include every pass of a frame

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, 0.3, 2400); // near 0.3: close enough for ride seats, and depth precision stays sound across the park

const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const TIERS = ['low', 'medium', 'high'];
const Q = { level: IS_MOBILE ? 'low' : 'high', auto: true, ...CONFIG.quality.high, listeners: [] };
try { const s = localStorage.getItem('sweetheart-park-quality'); if (TIERS.includes(s)) { Q.level = s; Q.auto = false; } } catch (e) {}
Object.assign(Q, CONFIG.quality[Q.level]);
const BOOT_TIER = Q.level; // things fixed at build time (point-light count, foliage density) use the starting tier

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); for (const f of Q.listeners) f('resize'); }
function setQuality(level, remember = false) {
  Object.assign(Q, CONFIG.quality[level], { level });
  if (remember) { Q.auto = false; try { localStorage.setItem('sweetheart-park-quality', level); } catch (e) {} }
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr)); resize(); for (const f of Q.listeners) f('quality');
}
function setAutoQuality() { Q.auto = true; try { localStorage.removeItem('sweetheart-park-quality'); } catch (e) {} setQuality(IS_MOBILE ? 'low' : 'high'); }
const onQuality = f => Q.listeners.push(f);
addEventListener('resize', resize);

// keeping the frame rate without ever making the park look worse: dynamic resolution first (the render scale eases
// down in 10 % steps to 80 % (never visibly soft) and climbs back when there is headroom — no shader recompiles, no effects switched off),
// and only if the frame rate stays very low at the lowest scale does the tier step down. Measuring starts well after
// boot and the intro (when shader compilation makes the first seconds unrepresentative), and every change waits out
// a cool-down so the scale settles instead of oscillating.
const AD = { t: 0, frames: 0, warm: 0, scale: 1, cool: 0, bad: 0 };
const applyScale = () => { renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr) * AD.scale); resize(); };
function autoQuality(rawDt) {
  if (!Q.auto || document.hidden || rawDt > 0.4) return;
  const c = CONFIG.quality.autoDegrade; AD.warm += rawDt; if (AD.warm < c.warmup) return;
  AD.t += rawDt; AD.frames++; AD.cool -= rawDt; if (AD.t < 2) return;
  const fps = AD.frames / AD.t; AD.t = 0; AD.frames = 0; if (AD.cool > 0) return;
  if (fps < 42 && AD.scale > 0.8) { AD.scale = Math.max(0.8, +(AD.scale - 0.1).toFixed(2)); AD.cool = 8; applyScale(); }
  else if (fps > 57 && AD.scale < 1) { AD.scale = Math.min(1, +(AD.scale + 0.1).toFixed(2)); AD.cool = 15; applyScale(); }
  else if (fps < c.minFps && AD.scale <= 0.8 && Q.level !== 'low' && ++AD.bad >= 3) { AD.bad = 0; AD.scale = 1; AD.cool = 8; setQuality(TIERS[TIERS.indexOf(Q.level) - 1]); console.info(`[park] ${fps.toFixed(0)} fps — quality lowered to ${Q.level}`); }
}

setQuality(Q.level);
export { renderer, scene, camera, Q, BOOT_TIER, IS_MOBILE, setQuality, setAutoQuality, onQuality, autoQuality, resize };
