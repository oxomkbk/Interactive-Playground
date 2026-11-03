import * as THREE from 'three';
import './core/fog.js';
import { $, V3, damp, nextFrame } from './core/utils.js';
import { FP, LIGHTS, MOON_DIR, Q, QUALITY, applyQuality, autoQuality, bloom, bokeh, camera, composer, gtao, initQuality, moon, perf, pointLight, raysPass, renderer, scene, updateLightPool } from './core/renderer.js';
import { M, buildMaterials, scanMaterials, HOLLOW_SETS } from './core/materials.js';
import { AS, loadAll } from './core/assets.js';
import { createStats, frameStart, frameEnd } from './core/stats.js';
import { U_TIME } from './core/shaders.js';
import { INTERACTS, SB, UPDATERS, _up, buildColliderGrid, nearColliders } from './core/registry.js';
import { ZONES, buildEnvironment, buildSky } from './world/sky.js';
import { buildDistant, buildFence, buildGround, buildTrees, makePumpkinGeo } from './world/landscape.js';
import { buildEntrance, buildStreet } from './world/gate-street.js';
import { buildPlaza } from './world/plaza.js';
import { COASTER, RIDES, buildCarousel, buildCoaster, buildFerris, buildSwing } from './world/rides.js';
import { buildBonfire } from './world/bonfire.js';
import { HOUSE, buildHouse } from './world/manor.js';
import { buildMaze } from './world/maze.js';
import { BUMP, DROP, GAME_BUMP, GAME_TOSS, GAME_WHACK, buildBumper, buildDrop, buildToss, buildWhack, markDone } from './world/attractions.js';
import { CANDY, LOOSE, buildAtmosphereProps, buildCandy, buildCrows, buildLoosePumpkins, buildScares, buildSpider, buildWitch } from './world/dressing.js';
import { buildInstanced } from './world/instanced.js';
import { GHOSTS, SOULS, buildBats, buildFireworks, buildGhosts, buildLeaves, buildMist, buildSearchlights, buildSouls, buildWisps, fireworksShow, spawnGhosts } from './world/atmosphere.js';
import { AU } from './core/audio.js';
import { GAME_SHOOT, GAME_STRIKER, S, SCORES, boardRide, buildInteractiveBits, exitRide, keys, player, startWitchingHour, updateBulbs, updateEvents, updateGallery, updatePlayer, updateRideCam, updateStriker } from './game/play.js';
import { startTour, titleStep, tourStep, updateTour } from './game/tour.js';
import { interact, jumpTo, togglePhoto, updateInteract, updatePhotoCam } from './game/photo.js';
import { drawMinimap, drawMinimapStatic, initUI, updateZone } from './ui/ui.js';
import './core/textures.js';
import './world/props.js';
import './world/midway.js';
import { initShowtime, updateShowCam } from './game/showtime.js';
import { unifyLook } from './core/artdirection.js';
import { PY, buildPyro } from './game/pyro.js';
import { buildLightShow } from './game/lightshow.js';
import { buildConductor } from './game/conductor.js';
import { buildFinish } from './world/finish.js';
import { EXPO } from './core/renderer.js';
import { loadSave } from './core/save.js';
import { updateGuide } from './ui/guide.js';
import { updateOnboarding } from './ui/onboarding.js';
import { pollGamepad } from './ui/touch.js';
import { showFatal, startLoadTips, stopLoadTips, titleReady } from './ui/ui.js';
import { buildCircus } from './world/circus.js';
import { buildCathedral } from './world/cathedral.js';
import { buildWitchwood } from './world/witchwood.js';
import { buildFields } from './world/fields.js';
import { buildLake } from './world/lake.js';
import { buildFlight } from './game/flight.js';
import { buildSkyShip } from './world/skyship.js';
import { t } from './core/i18n.js';

/* =========================================================================
   11. BOOT & MAIN LOOP
   ========================================================================= */
// Adaptive tuning from real frame times: step down when struggling, step up once when there is clear headroom
const clock = new THREE.Clock(); let wt = 0, lastMM = 0;
let frameN = 0, shadowMoved = true; const _lastSC = new V3();
const fwd = new V3(), _mv = new V3(), _sc = new V3(), _lx = new V3(), _ly = new V3(), _lz = new V3();
function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta(), rdt = Math.min(rawDt, 0.05), dt = rdt * S.timeScale; frameStart(); wt += dt; U_TIME.value = wt; FP.uTime.value += rdt;
  for (const u of UPDATERS) u(dt, wt);
  pollGamepad(rdt);
  updateEvents(rdt);
  if (S.mode === 'title') titleStep(rdt); // the title screen floats along the tour path
  else if (S.mode === 'roam') updatePlayer(rdt);
  else if (S.mode === 'ride') updateRideCam(rdt);
  else if (S.mode === 'tour') updateTour(rdt);
  else if (S.mode === 'photo') updatePhotoCam(rdt);
  else if (S.mode === 'show') updateShowCam(rdt);
  else if (S.mode === 'game') { if (S.game === GAME_SHOOT) updateGallery(rdt); else if (S.game === GAME_STRIKER) updateStriker(rdt); else if (S.game && S.game.update) S.game.update(rdt); else camera.updateMatrixWorld(); }
  // camera shake / cauldron wobble
  const mk = S.reduceMotion ? 0.15 : 1;
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - rdt * 1.8); camera.position.x += (Math.random() - 0.5) * S.shake * 0.12 * mk; camera.position.y += (Math.random() - 0.5) * S.shake * 0.12 * mk; }
  if (S.wobble > 0) { S.wobble = Math.max(0, S.wobble - rdt); camera.rotation.z += Math.sin(wt * 3) * 0.05 * S.wobble * mk; }
  camera.getWorldDirection(fwd); S.camYaw = Math.atan2(-fwd.x, -fwd.z);
  // shadow camera follows the viewer (snapped to reduce shimmering)
  // shadow frustum follows the viewer, snapped to whole shadow-map texels in light space (no shimmering edges)
  _sc.set(camera.position.x + fwd.x * 22, 0, camera.position.z + fwd.z * 22); const tex = 100 / moon.shadow.mapSize.x;
  _lz.copy(MOON_DIR).negate(); _lx.crossVectors(_up, _lz).normalize(); _ly.crossVectors(_lz, _lx);
  const la = Math.round(_sc.dot(_lx) / tex) * tex, lb = Math.round(_sc.dot(_ly) / tex) * tex, lc = _sc.dot(_lz);
  _sc.copy(_lx).multiplyScalar(la).addScaledVector(_ly, lb).addScaledVector(_lz, lc);
  moon.target.position.copy(_sc); moon.position.copy(_sc).addScaledVector(MOON_DIR, 200); moon.target.updateMatrixWorld();
  if (_sc.distanceToSquared(_lastSC) > 1e-6) { shadowMoved = true; _lastSC.copy(_sc); }
  // moon shafts: project the moon to screen space
  _mv.copy(camera.position).addScaledVector(MOON_DIR, 900).project(camera);
  const onS = _mv.z < 1 && Math.abs(_mv.x) < 1.1 && Math.abs(_mv.y) < 1.1; raysPass.uniforms.uMoonUV.value.set(_mv.x * 0.5 + 0.5, _mv.y * 0.5 + 0.5); raysPass.uniforms.uAspect.value = camera.aspect;
  raysPass.uniforms.uI.value = damp(raysPass.uniforms.uI.value, onS && Q.rays ? 1.4 * (1 - S.indoor) * (1 - S.witch * 0.5) / (1 + (S.fwEnergy || 0) * 4) : 0, 4, rdt);
  if (S.mode !== 'photo') { FP.uFilter.value = S.potion === 'spectral' ? 3 : 0; if (Q.dof && S.mode !== 'tour' && S.mode !== 'show') autoFocus(); }
  FP.uLetterbox.value = 0;
  if (Math.floor(wt * 20) !== Math.floor((wt - dt) * 20)) updateBulbs(wt);
  if (S.mode !== 'title') { updateInteract(); updateZone(); AU.update(rdt); updateGuide(rdt); updateOnboarding(rdt); }
  if (performance.now() - lastMM > 66 && S.mode !== 'title') { lastMM = performance.now(); drawMinimap(); }
  // eye adaptation: ease exposure down while the sky is full of bursts or lightning, back up afterwards
  EXPO.adapt = damp(EXPO.adapt, 1 / (1 + (S.fwEnergy || 0) * 0.16 + S.flash * 0.25), 1.6, rdt); renderer.toneMappingExposure = EXPO.base * EXPO.adapt;
  updateLightPool(rdt); autoQuality();
  if (Q.shadowEvery <= 1 || shadowMoved || frameN % Q.shadowEvery === 0) renderer.shadowMap.needsUpdate = true; frameN++; shadowMoved = false;
  composer.render(rdt); frameEnd(rawDt);
}
// cheap auto-focus: march the view ray against colliders + ground instead of raycasting merged geometry
let focusSm = 14, focusTick = 0;
function autoFocus() {
  if ((focusTick++ & 3) === 0) { const o = camera.position; let d = 60;
    for (let s = 0.6; s < 60; s *= 1.12) { const x = o.x + fwd.x * s, y = o.y + fwd.y * s, z = o.z + fwd.z * s; if (y < 0) { d = s; break; }
      let hit = false; for (const c of nearColliders(x, z, 0.6)) { if (c.off) continue; if (c.t === 0 ? (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r : (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)) { hit = y < 6; if (hit) break; } }
      if (hit) { d = s; break; } }
    focusSm = d; }
  bokeh.uniforms.focus.value = damp(bokeh.uniforms.focus.value, focusSm, 4, 0.016); bokeh.uniforms.aperture.value = 0.00004;
  // never blur the sky: looking up or with shells in the air, depth of field stands down so bursts stay crisp
  const skyward = fwd.y > 0.12 || (S.fwEnergy || 0) > 0.05 || PY.rockets.active > 0; bokeh.uniforms.maxblur.value = skyward ? 0 : Math.min(0.0009, bokeh.uniforms.maxblur.value + 0.00005);
}

async function boot() {
  initUI();
  const bar = $('#loadbar i'), txt = $('#loadtxt');
  const steps = [
    ['Carving the textures from moonlight…', () => { buildMaterials(); scanMaterials(); makePumpkinGeo(); buildGhosts(); }],
    ['Painting the night sky…', () => { buildSky(); buildEnvironment(); }],
    ['Laying wet cobblestones…', () => { buildGround(); buildFence(); }],
    ['Raising distant hills and a castle…', () => { buildDistant(); buildTrees(); }],
    ['Opening the gate…', buildEntrance], ['Stocking the stalls…', buildStreet],
    ['Winding the Clock of Souls…', buildPlaza], ['Oiling the carousel…', () => { buildCarousel(); buildSwing(); }],
    ['Hoisting The Eye…', buildFerris], ['Laying track for the Nightmare Express…', buildCoaster],
    ['Kindling the bonfire…', buildBonfire], ['Haunting the manor…', buildHouse], ['Growing the hedge maze…', buildMaze],
    ['Releasing ghosts and bats…', () => { spawnGhosts(); buildBats(); buildLeaves(); buildWisps(); buildMist(); buildSearchlights(); }],
    ['Hiding thirteen lost souls…', () => { buildSouls(); buildFireworks(); buildPyro(); buildLightShow(); buildConductor(); buildInteractiveBits(); pointLight('flash', 0xffffff, 0, 0, 0, 40, 0).userData.instant = true; }],
    ['Opening new attractions…', () => { buildDrop(); buildBumper(); buildWhack(); buildToss(); }],
    ['Raising the Big Top…', buildCircus], ['Consecrating the Cathedral of Echoes…', buildCathedral],
    ['Growing the Witchwood…', buildWitchwood], ['Ripening the Pumpkin Fields…', buildFields],
    ['Filling the Lake of Lost Souls…', buildLake], ['Raising the Wandering Galleon…', buildSkyShip], ['Charming a broomstick…', () => { buildFlight(); initShowtime(); }],
    ['Dressing the park for Halloween…', () => { buildAtmosphereProps(); buildCrows(); buildWitch(); buildSpider(); buildScares(); }],
    ['Scattering candy and pumpkins…', () => { buildCandy(); buildLoosePumpkins(); }], ['Edging paths and raking leaves…', buildFinish],
    ['Batching geometry…', () => { buildInstanced(); SB.build(scene); drawMinimapStatic(); }],
  ];
  window.__HM_LOADING = true; const pct = $('#loadpct'); startLoadTips();
  { const pct0 = $('#loadpct'); AS.onProgress = p => { bar.style.width = (p * 30) + '%'; if (pct0) pct0.textContent = Math.round(p * 30) + '%'; }; txt.textContent = t('Unpacking the stone and the slate…'); await loadAll({ sets: HOLLOW_SETS }); }
  for (let i = 0; i < steps.length; i++) { txt.textContent = t(steps[i][0]); const k = 30 + (i + 0.5) / steps.length * 62; bar.style.width = k + '%'; pct.textContent = Math.round(k) + '%'; await nextFrame(); steps[i][1](); }
  unifyLook(scene); // one art direction across every module's materials
  txt.textContent = t('Compiling shaders…'); bar.style.width = '100%';
  // pick a starting preset from the GPU hint
  initQuality();
  camera.position.set(0, 30, 110); camera.lookAt(0, 14, 0);
  buildColliderGrid();
  const hidden = []; scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const key in m) { const v = m[key]; if (v && v.isTexture) renderer.initTexture(v); } });
  createStats(renderer, () => `fps(auto) ${perf.fps ? perf.fps.toFixed(0) : "-"}`);
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn(e); }
  hidden.forEach(o => { o.visible = false; });
  const resumed = loadSave(); pct.textContent = '100%'; stopLoadTips(); window.__HM_BOOTED = true;
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); showFatal(t('The graphics device was reset'), t('Your GPU dropped the 3D context (driver reset or memory pressure). Your progress is saved — reload to continue. Lowering the quality preset can help.')); });
  $('#loadwrap').classList.add('hidden'); $('#startwrap').classList.remove('hidden'); titleReady(resumed);
  frame();
}
boot();
// handy for live tweaking from the devtools console
window.HOLLOWMOOR = { THREE, scene, camera, renderer, composer, S, player, LIGHTS, M, QUALITY, applyQuality, jumpTo, ZONES, startWitchingHour, fireworksShow, FP, bloom, gtao, bokeh, INTERACTS, RIDES, COASTER, HOUSE, SOULS, keys, startTour, togglePhoto, boardRide, exitRide, interact, GAME_BUMP, GAME_WHACK, GAME_TOSS, BUMP, DROP, LOOSE, CANDY, GHOSTS, raysPass, markDone, SCORES, LPOOL: () => LPOOL, perf, tourStep };

/* =========================================================================
   TODO / ideas for further iteration
   - Planar reflections (Reflector) for the plaza puddles on Ultra
   - Jack-o'-lantern shaped firework burst; more coaster banking/loops
   - Wandering NPC skeletons with crowd animation
   - Persist collected souls between visits (localStorage) and add an achievements page
   - Gamepad support and touch controls
   ========================================================================= */

export { clock, frameN, shadowMoved, fwd, _mv, _sc, _lx, _ly, _lz, frame, focusSm, focusTick, autoFocus, boot };
