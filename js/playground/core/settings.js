/* =========================================================================
   SETTINGS — the world-level dials the control center drives, read by sky, lights, fog, camera, particles:
   lighting intensity, atmosphere (fog) density, camera speed, field of view, and the current weather blend.
   Anything that changes sets `changed`, so systems that only re-apply on change pick it up the same frame.
   Weather eases between presets (CONFIG.weather) so a storm rolls in rather than switching on.
   ========================================================================= */
import { CONFIG } from '../config.js';

const saved = (() => { try { return JSON.parse(localStorage.getItem('sweetheart-park-settings-v2') || '{}'); } catch (e) { return {}; } })();
const SET = { light: 1, fog: 1, cameraSpeed: 1, fov: CONFIG.camera.fov, weather: 'clear', sens: 1, walk: 1, invertY: false, dof: true, ao: true, grass: true, ...saved, changed: true };
const WX = { ...CONFIG.weather.clear };                // the live, eased weather values
const persist = () => { try { const { changed, ...keep } = SET; localStorage.setItem('sweetheart-park-settings-v2', JSON.stringify(keep)); } catch (e) {} };
function set(key, value) { SET[key] = value; SET.changed = true; persist(); }
function updateWeather(dt) {
  const target = CONFIG.weather[SET.weather] || CONFIG.weather.clear, k = 1 - Math.exp(-0.45 * dt); let moving = false;
  for (const key of Object.keys(WX)) { const d = target[key] - WX[key]; if (Math.abs(d) > 1e-3) { WX[key] += d * k; moving = true; } else WX[key] = target[key]; }
  if (moving) SET.changed = true;
}

export { SET, WX, set, updateWeather };
