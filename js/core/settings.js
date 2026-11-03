/* =========================================================================
   SETTINGS — every console option lives here, is persisted to localStorage and pushed into the
   renderer overrides, camera, input and HUD through applySettings().
   ========================================================================= */
import { $ } from './utils.js';
import { OVR, applyOverrides, applyQuality, onResize, QNAME } from './renderer.js';
import { AU } from './audio.js';
import { S } from '../game/play.js';
import { TS } from '../game/tour.js';
import { setMusicVolume } from './music.js';
import { SHOWLOOP, setShowLoop } from '../game/conductor.js';

const DEFAULTS = {
  // graphics overrides (null = follow the preset)
  shadows: null, ao: null, dof: null, rays: null,
  tonemap: 'aces', harmony: 1, bloom: 1, grain: 1, ca: 1, vignette: 1, sharpen: 1, exposure: 1, fog: 1, scale: 1,
  // camera & input
  aurora: 0.85,
  // the Nightly Spectacular
  showLoop: true, music: 0.55, showDensity: 1, lightShowOn: true, lasersOn: true,
  fov: 62, sens: 1, invertY: false, headBob: true,
  // audio
  volume: 0.8, muted: false,
  // interface
  guide: true, compass: true, uiScale: 1, highContrast: false, reduceMotion: false, reduceFlash: false, captions: true,
  minimap: true, keyHints: true, zoneTitles: true, crosshair: true, fps: false, markers: true,
};
const SET = { ...DEFAULTS };
try { Object.assign(SET, JSON.parse(localStorage.getItem('hollowmoor-settings') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('hollowmoor-settings', JSON.stringify(SET)); } catch (e) {} };

function applySettings(changed) {
  for (const k of ['tonemap', 'harmony', 'shadows', 'ao', 'dof', 'rays', 'bloom', 'grain', 'ca', 'vignette', 'sharpen', 'exposure', 'fog', 'scale']) OVR[k] = SET[k];
  if (changed === 'scale') applyQuality(QNAME, true); else applyOverrides();
  S.aurora = SET.aurora; S.showLoop = SET.showLoop; S.lightShowOn = SET.lightShowOn; S.lasersOn = SET.lasersOn; setMusicVolume(SET.music);
  if (SHOWLOOP.on !== SET.showLoop && SHOWLOOP.act !== undefined) setShowLoop(SET.showLoop); SHOWLOOP.density = SET.showDensity; if (SHOWLOOP.act >= 0) SHOWLOOP.act = -1; S.fov = SET.fov; S.sens = SET.sens; S.markers = SET.markers; S.invertY = SET.invertY; S.headBob = SET.headBob;
  AU.vol = SET.volume; AU.muted = SET.muted; if (AU.master) AU.master.gain.value = AU.muted ? 0 : AU.vol;
  const hud = $('#hud'); if (hud) { hud.classList.toggle('no-minimap', !SET.minimap); hud.classList.toggle('no-keys', !SET.keyHints); hud.classList.toggle('no-zone', !SET.zoneTitles); hud.classList.toggle('no-cross', !SET.crosshair); }
  S.guide = SET.guide; S.reduceMotion = SET.reduceMotion; S.reduceFlash = SET.reduceFlash;
  if (hud) { hud.classList.toggle('no-guide', !SET.guide); hud.classList.toggle('no-compass', !SET.compass); }
  document.documentElement.style.setProperty('--ui', SET.uiScale); document.body.classList.toggle('high-contrast', SET.highContrast); document.body.classList.toggle('reduce-motion', SET.reduceMotion);
  TS.captions = SET.captions;
  const f = $('#fpsmeter'); if (f) f.classList.toggle('hidden', !SET.fps);
  if (changed === 'fov') onResize();
  save();
}
function setSetting(k, v) { SET[k] = v; applySettings(k); }
function resetSettings() { Object.assign(SET, DEFAULTS); applySettings('scale'); }

export { DEFAULTS, SET, applySettings, setSetting, resetSettings };
