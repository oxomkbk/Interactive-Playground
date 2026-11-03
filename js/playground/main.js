/* =========================================================================
   MAIN — Sweetheart Park. Builds the world in stages behind the loader, then conducts every frame.
   You play a visitor: explore mode (third / first person, WASD, mouse look, sprint, jump) is home; walk up
   to anything and press E to open its console, ride it (ride camera) or play it, then step back out.
   Also: time of day, weather, camera director (cinematic orbit · focus · tour · ride view), the interaction
   system (walk-up prompts, crosshair / click picking, pointer routing to the active game), collectibles,
   quests and achievements, the HUD and minimap, attractions, effects, audio beds, post-processing. Every attraction is a module: create(config) → { object3D,
   update(dt, elapsed), … } (see attractions/base.js); main gives each one fx, sfx and ui hooks.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { renderer, scene, camera, Q, setQuality, setAutoQuality, autoQuality } from './core/renderer.js';
import { MOOD, setTime, timeName, updateMood, nightness, sunDir, lookColor, lookNum } from './core/mood.js';
import { SET, WX, set as setSetting, updateWeather } from './core/settings.js';
import { createSky } from './core/sky.js';
import { createLights } from './core/lights.js';
import { createPost } from './core/post.js';
import { createDirector } from './core/camera.js';
import { createPicker } from './core/picking.js';
import { updateMaterials, updateGlows, SUNVIEW, SUNCOL } from './core/materials.js';
import { createGround } from './world/ground.js';
import { createHorizon } from './world/horizon.js';
import { createSpectacle } from './world/spectacle.js';
import { createVegetation } from './world/vegetation.js';
import { createProps } from './world/props.js';
import { createPark } from './world/park.js';
import { createEntrance } from './world/entrance.js';
import { createShops } from './world/shops.js';
import { createCastle } from './world/castle.js';
import { createGarden } from './world/garden.js';
import { createAmbient, createStringLights, createJets } from './fx/particles.js';
import { createEffects } from './fx/effects.js';
import { createWeather } from './fx/weather.js';
import * as Ferris from './attractions/ferrisWheel.js';
import * as Carousel from './attractions/carousel.js';
import * as Teacups from './attractions/teacups.js';
import * as Coaster from './attractions/coaster.js';
import * as Swings from './attractions/swings.js';
import * as Bumper from './attractions/bumperCars.js';
import * as Train from './attractions/train.js';
import * as Balloons from './attractions/balloonRide.js';
import * as Pirate from './attractions/pirateShip.js';
import * as Drop from './attractions/dropTower.js';
import * as RingToss from './attractions/ringToss.js';
import * as Claw from './attractions/clawMachine.js';
import * as Fountain from './attractions/wishingFountain.js';
import * as Golf from './attractions/miniGolf.js';
import * as Fishing from './attractions/duckFishing.js';
import * as Gallery from './attractions/shootingGallery.js';
import * as Photo from './attractions/photoBooth.js';
import * as Treasure from './attractions/treasureHunt.js';
import * as Swans from './attractions/swanBoats.js';
import * as Observatory from './attractions/observatory.js';
import * as Stage from './attractions/festivalStage.js';
import { AU, initAudio, SFX, setMuted, setVolume, setLevel, setBeds } from './audio.js';
import * as UI from './ui.js';
import { nextFrame } from '../core/utils.js';
import { createCharacter } from './game/character.js';
import { createPlayer } from './game/player.js';
import { createWalkWorld } from './game/world.js';
import { createProgress } from './game/progress.js';
import { createLetters } from './game/letters.js';
import { createHUD } from './game/hud.js';
import { createGrass } from './game/grass.js';
import { cafe, lookout, musicalFountains, hedgeMaze, bistro } from './world/districts.js';
import { createEvents } from './game/events.js';
import { createSession } from './game/session.js';
import { addNightLight, patchScene, updateNightLights, bakeLightmap } from './core/nightlights.js';
import { WET } from './core/scans.js';
import { updateWater, skipInReflection, WATER_MATERIALS } from './core/water.js';
import { createCrowd } from './game/crowd.js';
import { createBulbs } from './core/bulbs.js';
import { createIllumination } from './world/illumination.js';
import { createMeteors } from './fx/meteors.js';
import { createGuide } from './game/guide.js';
import { createLanterns } from './fx/lanterns.js';

const L = CONFIG.layout, SYSTEMS = [], ATTS = [];
const add = (sys) => { if (sys.object3D && !sys.object3D.parent) scene.add(sys.object3D); SYSTEMS.push(sys); return sys; };
const at = (id) => { const [x, z] = L[id]; return { x, z }; };
const CATEGORY = { ferris: 'rides', carousel: 'rides', teacups: 'rides', swings: 'rides', balloons: 'rides', train: 'rides', swans: 'rides',
  coaster: 'thrills', drop: 'thrills', pirate: 'thrills', bumper: 'thrills',
  ringToss: 'games', claw: 'games', golf: 'games', fishing: 'games', gallery: 'games', stage: 'games',
  fountain: 'experiences', photo: 'experiences', treasure: 'experiences', observatory: 'experiences', fountainShow: 'experiences', maze: 'experiences', bistro: 'experiences', cafe: 'experiences', lookout: 'experiences' };
// extra words people might search for
const TAGS = { fountainShow: 'water show music jets', maze: 'hedge labyrinth roses puzzle', cafe: 'food drink restaurant coffee cake', lookout: 'gazebo view fireworks', golf: 'mini golf putt hole', fishing: 'duck fish hook', gallery: 'shooting targets aim', stage: 'dance rhythm music concert show', observatory: 'stars telescope constellations sky',
  photo: 'camera picture selfie', treasure: 'treasure secret hidden hearts riddle', swans: 'boat water pond lantern', ferris: 'wheel', coaster: 'roller coaster', drop: 'tower fall', pirate: 'ship boat swing',
  bumper: 'cars drive', claw: 'crane plush toys', ringToss: 'bottles rings', fountain: 'wish coin', train: 'railway steam', balloons: 'hot air', teacups: 'cups spin tea', carousel: 'horses merry-go-round', swings: 'chairs flying' };
let post, director, picker, fx, ambient, selected = null, lights, captureNext = null, stats = false;
let waterMeshes = [], skyLanterns, guide, bulbs, meteors, events, fountains, maze, crowd, grass, walk, hero, player, progress, letters, hud, treasure, mode = 'boot', view = 'first', near = null, zoneT = 0, walkAcc = 0;
const V3 = (a) => new THREE.Vector3(...a);

/* ---------------- interaction ---------------- */
const activeGame = () => ATTS.find(a => a.capturesPointer && a.capturesPointer());
function focusOf(a) { return a.focusTarget ? { ...a.focus, target: [a.focusTarget().x, a.focus.target[1], a.focusTarget().z] } : a.focus; }
const VERB = { ride: 'Ride', game: 'Play', experience: 'Visit', landmark: 'Visit' };
const verbOf = (a) => (a.id === 'fountain' ? 'Make a wish' : a.id === 'cafe' || a.id === 'bistro' ? 'Sit down' : a.id === 'lookout' ? 'Enjoy the view' : a.id === 'fountainShow' ? 'Watch the show' : a.id === 'maze' ? 'Explore' : a.id === 'photo' ? 'Take a photo' : a.id === 'observatory' ? 'Stargaze' : a.id === 'swans' ? 'Float a lantern' : VERB[a.kind] || 'Visit');
// every attraction visit goes through the session state machine (game/session.js)
let session;
function beginExplore() { director.setMode('player'); player.resume(director.controls.target.clone()); player.setView('first'); session.start(); }
function enterExplore() { if (session.state !== 'explore') session.exit(); }
// a click (or the atlas) on an attraction: its console
function select(a, hitPoint) {
  if (session.state === 'viewing') { session.S.a = a; UI.showCard(a); director.setMode('focus', { focus: focusOf(a) }); }
  else { if (session.state !== 'explore') session.exit(); session.view(a); }
  selected = a; picker.bounce(a); fx.sparkles(hitPoint || V3(a.focus.target), 26, 1.8); SFX.pop(); discover(a);
}
function discover(a) {
  progress.emit('discover', a.id); const n = UI.markDiscovered(a);
  if (n) { if (n === ATTS.length) { UI.toast('You found them all!', 'Every corner of the park is yours.', '🏆'); fx.show(10); } else UI.toast('New discovery!', ['{n} of {t} attractions found', { n, t: ATTS.length }], a.icon); }
}
function onPick(hit) {
  initAudio(); const a = hit.att;
  if (a.id === 'treasure') { if (a.onPick(hit)) progress.emit('heart', a.state().found); if (selected === a) UI.refreshCard(); return; }  // hearts are collected wherever they are
  if (session.state === 'playing' || session.state === 'riding') return;                                                                 // the active game owns the pointer
  if (a.id === 'fountain' && selected === a) { if (a.onPick(hit) !== false) progress.emit('wish'); UI.refreshCard(); return; }  // second click on the fountain = a coin
  if (a.kind !== 'landmark' && a.onPick && a.onPick(hit)) { if (selected !== a) select(a, hit.point); return; }
  select(a, hit.point);
}
function ride(a) { session.state === 'viewing' ? session.board(a) : session.state === 'explore' && session.board(a); }
function play(a) {
  initAudio();
  if (session.state === 'playing' && session.a === a) { a.play(); return; }        // Play again
  if (session.state === 'riding' && session.a === a && a.id === 'bumper') { a.play(); return; }
  if (a.id === 'swans' && (session.state === 'riding' || session.state === 'viewing')) { a.play(); return; } // float a lantern
  session.experience(a);
}
// walk-up interaction: E does what the attraction is for
function interact() { if (mode !== 'explore' || !near) return; session.experience(near); }
// guidance: a trail of light from where you stand to the attraction
function guideTo(a) { const sp = walk.standPoint(a); if (!sp || a.id === 'train') return; enterExplore(); guide.to(a, player.S.pos.clone(), sp); UI.toast('Follow the lights', a.name, '✨'); SFX.wish ? SFX.wish() : SFX.ding(); }
// fast travel (map, atlas): stand in front of it, facing it
function travel(a) { const sp = walk.standPoint(a); if (!sp) return; enterExplore(); player.teleport(sp.x, sp.z, sp.yaw); player.S.blend = 1; fx.sparkles(player.head(), 30, 1.2); SFX.whoosh && SFX.whoosh(); }
function cycleCamera() { initAudio();
  // first person only: C toggles between walking and the cinematic camera
  if (mode === 'explore') { view = 'first'; if (!session.toCinematic()) return; document.body.classList.add('cinematic'); post.S.dof = true; director.setMode('cinematic', { target: player.head(), dist: 6 }); UI.setCamPill('cinematic'); UI.toast('Cinematic camera', 'Drag to orbit · C or Esc to walk again', '🎬'); }
  else enterExplore(); }
// on-ride photos: the frame at the ride's peak, kept in an album (the last eight, for this visit)
const album = [];
function ridePhoto(a) { UI.flash(); SFX.coin && SFX.coin(); captureNext = (url) => { album.unshift({ url, name: a.name, icon: a.icon }); album.length = Math.min(album.length, 8);
  const el = document.getElementById('album'); el.innerHTML = album.map(p => `<a download="sweetheart-${Date.now()}.jpg" href="${p.url}" title="${p.name}"><img src="${p.url}" alt=""><span>${p.icon}</span></a>`).join('');
  UI.toast('Ride photo!', ['Saved to your album — {p}', { p: a.name }], '📸'); progress.emit('photo'); }; }
// Lovers' Lookout: night falls, the camera settles on the bench view and the sky erupts
function watchFireworks(lo) { initAudio(); const p = lo.object3D.position;
  director.flyTo(new THREE.Vector3(p.x + 1, p.y + 2.2, p.z + 1.5), new THREE.Vector3(0, 34, 10), 2.6, () => { director.controls.enabled = false; });
  setTimeout(() => fx.show(18, new THREE.Vector3(0, 46, -6)), 1800); progress.emit('watch'); UI.toast("Lovers' Lookout", 'Press Esc or E to walk again', '💞'); }
// park events (scheduled by game/events.js, or started from the Command Center)
function runEvent(id) {
  const st = ATTS.find(a => a.id === 'stage');
  if (id === 'fountains') fountains.play();
  else if (id === 'fireworks') { fx.show(26, new THREE.Vector3(0, 52, L.castle.z + 30)); crowd.gather(0, 8, 12, 40, 70, true); progress.emit('event'); }
  else if (id === 'lights') { st.secondary.run(); crowd.gather(st.object3D.position.x, st.object3D.position.z + 12, 8, 30); progress.emit('event'); }
  else if (id === 'lanterns') { skyLanterns.release(70, 0, 0, 11); crowd.gather(0, 0, 13, 40, 70, true); progress.emit('event'); SFX.wish && SFX.wish(); }
  else if (id === 'parade') { crowd.parade(45); progress.emit('event'); }
  else if (id === 'meteors') meteors.shower(40, 15);
  hud.announce(null);
}
function fireworkAhead() { initAudio(); const f = director.controls.target.clone().sub(camera.position).setY(0).normalize(); fx.firework(camera.position.clone().addScaledVector(f, 120).setY(60 + Math.random() * 30)); progress.emit('firework'); }

/* ---------------- the explorer, every frame ---------------- */
function gameTick(dt) {
  player.update(dt);
  const p = player.S.pos;
  if (mode === 'explore') {
    const n = walk.nearestAttraction(p.x, p.z, 2.8); near = n ? n.a : null;
    if (!near) { const tr = ATTS.find(a => a.id === 'train'); if (tr && tr.hits[0]) { tr.hits[0].getWorldPosition(_tp); if (Math.hypot(_tp.x - p.x, _tp.z - p.z) < 5) near = tr; } } // the train: hop on beside the locomotive
    hud.prompt(near, near ? verbOf(near) : '');
    if (treasure.collectNear(p)) progress.emit('heart', treasure.state().found);
    walkAcc += player.S.speed * dt; if (walkAcc > 5) { progress.emit('walk', walkAcc); walkAcc = 0; }
    if (walk.onBridge(p.x, p.z) && p.y > 2.2) progress.emit('bridge');
    if (player.S.locked) { picker.S.x = innerWidth / 2; picker.S.y = innerHeight / 2; picker.S.dirty = true; } // outline whatever the crosshair rests on
  }
  letters.update(dt, 0, mode === 'explore' ? p : null);
  grass.update(dt, 0, mode === 'explore' ? p : camera.position);
  crowd.update(dt, 0, p); guide.update(dt, elapsed, mode === 'explore' ? p : null); events.update(dt); if (mode === 'explore') maze.track(p, dt);
  if (post.S.dof) post.S.focus = camera.position.distanceTo(player.head());
  if ((zoneT -= dt) < 0) { zoneT = 0.3; hud.setZone(hud.zoneAt(p.x, p.z)); if (nightness() > 0.8) progress.emit('night'); }
  hud.stamina(player.S.stamina, player.S.speed > 4);
  hud.update(dt, { x: mode === 'explore' ? p.x : camera.position.x, z: mode === 'explore' ? p.z : camera.position.z, camYaw: mode === 'explore' ? player.S.camYaw : Math.atan2(-(director.controls.target.x - camera.position.x), -(director.controls.target.z - camera.position.z)), yaw: player.S.yaw });
  progress.tick(dt);
}

/* ---------------- frame loop ---------------- */
const clock = new THREE.Clock(); let elapsed = 0, fpsT = 0, fpsN = 0;
const fountainPos = new THREE.Vector3(0, 2, 0), _lastCam = new THREE.Vector3(), _tp = new THREE.Vector3();
function frame() { requestAnimationFrame(frame); step(clock.getDelta()); }
function step(raw) {
  const dt = Math.min(raw, 0.05); elapsed += dt;
  renderer.info.reset(); WET.value += ((WX.rain > 0.3 ? 1 : 0) - WET.value) * Math.min(1, dt * (WX.rain > 0.3 ? 0.25 : 0.04)); updateMood(dt); sunDir(SUNVIEW.value).transformDirection(camera.matrixWorldInverse); lookColor('sun.color', SUNCOL.value).multiplyScalar(lookNum('sun.intensity') * 0.35 * (1 - WX.cover * 0.7)); updateWeather(dt); updateMaterials(dt, elapsed, WX.wind);
  if (MOOD.changed) SFX.setNight(nightness() > 0.6 ? 1 : 0);
  const g = activeGame(), playing = ATTS.some(a => a.state && a.state().playing);
  director.S.hold = playing || mode !== 'tour'; // the idle tour only runs when you asked for it
  director.update(dt);
  if (g) director.controls.enabled = false; else if (!director.S.flight && director.S.mode !== 'ride' && director.S.mode !== 'player') director.controls.enabled = true;
  if (player) { session.update(dt); gameTick(dt); }
  updateNightLights(dt, elapsed); bulbs && bulbs.update(elapsed, camera, renderer.domElement.height);
  for (const s of SYSTEMS) s.update(s.speed !== undefined ? dt * s.speed : dt, elapsed);
  picker.update(dt, ATTS);
  updateWater(elapsed, waterMeshes);
  post.render(dt, elapsed);
  if (captureNext) { const res = captureNext; captureNext = null; res(renderer.domElement.toDataURL('image/jpeg', 0.92)); } // read the frame we just drew
  autoQuality(raw);
  { // the soundscape follows you: visitors nearby, the carousel's organ, wind, the rush of a ride, the time of day
    const cp = camera.position, car = ATTS.find(a => a.id === 'carousel'), coasterAtt = ATTS.find(a => a.id === 'coaster'), camSpeed = _lastCam.distanceTo(cp) / Math.max(dt, 1e-3); _lastCam.copy(cp);
    setBeds(WX.rain, Math.max(0, 1 - cp.distanceTo(fountainPos) / 40), { crowd: crowd ? crowd.nearby(cp.x, cp.z, 18) / 10 : 0, wind: 0.15 + Math.max(0, WX.wind - 1) * 0.5,
      organ: car && car.running ? Math.max(0, 1 - car.object3D.position.distanceTo(cp) / 30) : 0, rush: mode === 'riding' ? Math.min(1, camSpeed / 14) : 0, mood: MOOD.v, show: fountains && fountains.state().playing ? 1 : 0,
      busk: crowd ? Math.max(0, 1 - crowd.fiddler().distanceTo(cp) / 22) : 0, lake: Math.max(0, 1 - Math.max(0, Math.hypot((cp.x - L.lake.x) / L.lake.rx, (cp.z - L.lake.z) / L.lake.rz) - 1) * L.lake.rx / 70),
      rumble: coasterAtt && coasterAtt.running !== false ? Math.max(0, 1 - coasterAtt.object3D.position.distanceTo(cp) / 50) : 0 }); }
  SET.changed = false;
  fpsT += raw; fpsN++; if (fpsT > 0.5) { const fps = fpsN / fpsT; fpsT = fpsN = 0; if (stats) { const i = renderer.info.render; document.getElementById('perf').textContent = `${fps.toFixed(0)} fps · ${i.calls} draws · ${(i.triangles / 1e6).toFixed(2)}M tris · ${Q.level}${Q.auto ? ' (auto)' : ''} · dpr ${renderer.getPixelRatio()}`; } }
}
// keyboard shortcuts (ignored while typing in the search box or while a keyboard game is on)
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || mode === 'boot') return;
  const g = ATTS.find(a => a.state && a.state().playing && (a.id === 'claw' || a.id === 'bumper' || a.id === 'stage'));
  const panels = ['#world', '#atlas', '#bigmap', '#letter', '#about'].filter(id => !document.querySelector(id).classList.contains('hidden'));
  if (e.code === 'Escape') {
    if (panels.length) { for (const id of panels) document.querySelector(id).classList.add('hidden'); return; }
    if (mode !== 'explore') enterExplore(); return; }   // (rides, games and views are left through the session's own key handler)
  if (g || e.metaKey || e.ctrlKey) return;
  if (e.code === 'F3') { e.preventDefault(); stats = !stats; document.getElementById('perf').classList.toggle('hidden', !stats); document.getElementById('tStats').checked = stats; }
  else if (e.code === 'Tab') { e.preventDefault(); player.unlock(); document.querySelector('#world').classList.toggle('hidden'); }
  else if (e.code === 'KeyJ') { player.unlock(); document.querySelector('#atlas').classList.toggle('hidden'); }
  else if (e.code === 'KeyM') { player.unlock(); hud.toggleMap(); }
  else if (e.code === 'KeyF') fireworkAhead();
});
const crosshair = document.getElementById('crosshair');
addEventListener('pointermove', e => { crosshair.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; });

const handlers = {
  setTime: (n) => { if (session && session.S.stargazePrev) session.S.stargazePrev = n; setTime(n); UI.setTimePill(n); initAudio(); UI.toast(n === 'night' ? 'Good evening!' : n === 'day' ? 'Good morning!' : 'Golden hour', n === 'night' ? 'The lanterns are lit.' : n === 'day' ? 'A bright, breezy day.' : 'The sun is setting pink and gold.', n === 'night' ? '🌙' : n === 'day' ? '☀️' : '🌇'); },
  setCam: (m) => { initAudio();
    if (m === 'third' || m === 'first') { view = 'first'; enterExplore(); player.setView('first'); UI.setCamPill('first'); return; }
    if (m === 'cinematic') { enterExplore(); view = 'first'; cycleCamera(); return; }
    if (session.toTour()) { director.setMode(m); UI.setCamPill(m); } },
  setWeather: (w) => { setSetting('weather', w); UI.toast(w === 'rain' ? 'Rain is rolling in' : w === 'misty' ? 'A soft mist settles' : w === 'breezy' ? 'The wind picks up' : 'Clear skies', ['Weather: {w}', { w: w }], w === 'rain' ? '🌧️' : w === 'misty' ? '🌫️' : w === 'breezy' ? '🍃' : '☀️'); },
  setting: (k, v) => { if (k === 'bloom') { post.S.bloomScale = v; setSetting('bloom', v); } else setSetting(k, v); },
  getSetting: (k) => (k === 'bloom' ? (SET.bloom ?? 1) : SET[k]),
  level: (ch, v) => { if (ch === 'master') setVolume(v); else setLevel(ch, v); }, getLevel: (ch) => (ch === 'master' ? AU.vol : AU.levels[ch]),
  toggleSound: () => { initAudio(); setMuted(!AU.muted); return !AU.muted; }, soundOn: () => !AU.muted,
  particles: (on) => { ambient.object3D.visible = on; }, stats: (on) => { stats = on; document.getElementById('perf').classList.toggle('hidden', !on); },
  quality: (q) => (q === 'auto' ? setAutoQuality() : setQuality(q, true)), getQuality: () => (Q.auto ? 'auto' : Q.level),
  select: (a) => select(a), focus: (a) => travel(a), guide: (a) => guideTo(a), focusOn: (f) => f && director.setMode('focus', { focus: f }), travel,
  toggleRun: (a) => { a.setRunning(!a.running); UI.toast(a.running ? 'Started' : 'Stopped', a.name, a.icon); UI.renderList(); },
  ride, exitRide: () => session.exit(), play, exitGame: () => session.exit(), closeCard: () => { selected = null; enterExplore(); },
  outfit: (i) => { const o = hero.setOutfit(i); progress.emit('outfit'); try { localStorage.setItem('sweetheart-outfit', String(i)); } catch (e) {} return o; }, getOutfit: () => +(localStorage.getItem('sweetheart-outfit') || 0),
  event: (id) => events.trigger(id),
  resetProgress: () => { treasure.reset(); letters.reset(); progress.reset(); }, fireworks: () => fireworkAhead(), showMap: () => hud.toggleMap(true), setTimeValue: (v) => { MOOD.target = v; UI.setTimePill(['day', 'sunset', 'night'][Math.round(v)]); },
  getTimeValue: () => MOOD.target,
};

/* ---------------- boot ---------------- */
async function boot() {
  window.__PG_LOADING = true;
  UI.initUI(handlers); UI.setTimePill(timeName());
  try { await Promise.race([document.fonts.load('120px Pacifico'), new Promise(r => setTimeout(r, 1800))]); } catch (e) {}
  let veg, props, park, entrance, sky, shopsObj, castleObj;
  const fxRef = { sparkles: (...a) => fx.sparkles(...a), hearts: (...a) => fx.hearts(...a), smoke: (p) => fx.smoke(p), show: (...a) => fx.show(...a) };
  const ui = { toast: UI.toast, gameUpdate: (a, o) => { if (o && o.result === 'win') progress.emit('win', a.id); return UI.gameUpdate(a, o); }, power: UI.power, rhythm: UI.rhythm, countdown: UI.countdown, flash: UI.flash, photos: UI.photos, refresh: UI.refreshCard };
  const attraction = (mod, cfg) => { const a = mod.create({ ...cfg, lights }); a.fx = fxRef; a.sfx = SFX; a.ui = ui; a.cat = CATEGORY[a.id] || 'experiences'; a.tags = TAGS[a.id] || ''; if (a.kind === 'ride' && a.speed === undefined) a.speed = 1; ATTS.push(a); add(a); return a; };
  const steps = [
    ['Painting the sky…', () => { sky = add(createSky({ onEvent: () => { crowd && crowd.stargaze(new THREE.Vector3(-0.42, 0, -0.9), 22); hud && hud.announce({ icon: '✨', name: 'The Waltzers are dancing', where: 'the sky — look up, south-west' }, 0); setTimeout(() => hud && hud.announce(null), 18000); } })); lights = add(createLights()); post = createPost(); post.S.bloomScale = SET.bloom ?? 1; director = createDirector(); fx = add(createEffects({ sfx: SFX })); fx.festival(true); add(createWeather()); }],
    ['Laying the stone paths…', () => { add(createGround()); add(createHorizon()); veg = createVegetation(); props = createProps(veg, lights); }],
    ['Planting the gardens…', () => { park = createPark(veg, props, lights); add(createGarden(veg, props, lights)); }],
    ['Building the shopping street…', () => { entrance = add(createEntrance(veg, props, { bulbs: park.bulbs }, lights)); shopsObj = add(createShops(veg, props)); }],
    ['Raising the castle…', () => { castleObj = add(createCastle(veg)); }],
    ['Assembling the rides…', () => { attraction(Fountain, { x: 0, z: 0 }); attraction(Ferris, { ...at('ferris'), radius: 17, hub: 20.5, gondolas: 20 }); attraction(Carousel, at('carousel')); attraction(Teacups, at('teacups')); attraction(Swings, at('swings')); attraction(Balloons, at('balloons')); }],
    ['Assembling the rides…', () => { attraction(Coaster, at('coaster')); attraction(Bumper, at('bumper')); attraction(Train, {}); attraction(Pirate, at('pirate')); attraction(Drop, at('drop')); attraction(Swans, {}); }],
    ['Setting up the games…', () => { attraction(RingToss, at('ringToss')); attraction(Claw, at('claw')); attraction(Golf, at('golf')); attraction(Fishing, at('fishing')); attraction(Gallery, at('gallery')); attraction(Stage, at('stage')); }],
    ['Hiding the golden hearts…', () => {
      attraction(Photo, at('photo')); attraction(Treasure, {});
      const obs = attraction(Observatory, at('observatory')); scene.add(obs.sky); obs.onStargaze = () => {}; // the session runs stargazing
      const cf = attraction({ create: () => cafe(lights) }, {}); cf.onTreat = () => { player.S.stamina = 1; progress.emit('treat'); };
      const lo = attraction({ create: () => lookout(lights) }, {}); lo.onWatch = () => watchFireworks(lo);
      fountains = attraction({ create: () => musicalFountains() }, {}); fountains.onShow = () => { crowd && crowd.gather(L.fountainShow[0], L.fountainShow[1] + 7, 6, 48); progress && progress.emit('event'); };
      const bi = attraction({ create: () => bistro() }, {}); bi.onTreat = () => { player.S.stamina = 1; progress.emit('treat'); };
      maze = attraction({ create: () => hedgeMaze() }, {}); maze.onSolve = (tm, best) => { UI.toast('The heart of the maze!', `${tm.toFixed(1)} s · best ${best.toFixed(1)} s`, '🌹'); SFX.fanfare && SFX.fanfare(); fx.hearts(new THREE.Vector3(L.maze[0], 1.5, L.maze[1]), 40, 1.2); progress.emit('maze', tm); };
      const photo = ATTS.find(a => a.id === 'photo'); photo.camera = { flyTo: (p, t, s) => director.flyTo(p, t, s) }; photo.capture = () => new Promise(res => { captureNext = res; });
    }],
    ['Lighting the lanterns…', () => {
      scene.add(veg.build()); props.build(scene); add(createStringLights(park.bulbs)); add(createSpectacle({ veg, park }));
      add(createJets(entrance.fountains.flatMap(f => [{ x: f.x, y: f.y, z: f.z, up: 4.6, out: 0.3, n: 260 }, { x: f.x, y: 0.75, z: f.z, up: 2.6, out: 1.2, n: 200, ring: 2.8 }])));
      ambient = add(createAmbient()); updateGlows();
      skyLanterns = add(createLanterns());
      bulbs = createBulbs(); createIllumination({ B: bulbs, atts: ATTS, shops: shopsObj.object3D, castle: castleObj, clumps: veg.clumps, scene }); bulbs.build();
      meteors = add(createMeteors({ onShower: (storm) => { hud && hud.announce({ icon: '☄️', name: storm ? 'A meteor storm!' : 'Meteor shower', where: 'the sky — look up' }, 0); setTimeout(() => hud && hud.announce(null), 9000); progress && progress.emit('meteors'); crowd && crowd.stargaze(new THREE.Vector3(Math.random() - 0.5, 0, -1), storm ? 30 : 18); } }));
    }],
  ];
  steps.push(['Waking the visitors…', () => {
    walk = createWalkWorld(); scene.updateMatrixWorld(true);
    for (const a of ATTS) { walk.addAttraction(a, !['train', 'treasure', 'swans', 'cafe', 'lookout', 'maze', 'fountainShow', 'bistro'].includes(a.id)); a.solid && a.solid(walk); a.platform && a.platform(walk); }
    walk.addStatic({ trunks: veg.trunks.filter(t => Math.hypot(t.p.x, t.p.z) < 140).map(t => ({ x: t.p.x, z: t.p.z, r: 0.28 * t.s.x })), posts: props.posts, benches: props.benches });
    treasure = ATTS.find(a => a.id === 'treasure');
    for (const g of treasure.spots()) { const q = g.position; for (let k = 0; k < 60 && walk.blocked(q.x, q.z, 0.6); k++) { q.x += Math.sin(k * 2.4) * 0.5; q.z += Math.cos(k * 2.4) * 0.5; } if (q.y < 0) q.y = walk.groundAt(q.x, q.z) + 0.6; else if (q.y < 2) q.y = Math.max(q.y, walk.groundAt(q.x, q.z) + 0.5); }
    hero = createCharacter(); scene.add(hero.object3D);
    // first person only: the walker's body is never drawn (it still carries the player's position for the systems that use it)
    Object.defineProperty(hero.object3D, 'visible', { get: () => false, set: () => {} }); hero.setOutfit(handlers.getOutfit()); hero.tryLoadGLB().then(ok => ok && console.info('[park] rigged character loaded'));
    player = createPlayer({ character: hero, world: walk, camera, dom: renderer.domElement, onInteract: interact, onCycleCamera: cycleCamera, onJump: () => SFX.whoosh && SFX.whoosh() });
    player.teleport(0, L.gate.z + 15, Math.PI); player.suspend();
    progress = createProgress({ total: ATTS.length,
      onQuest: (q) => { UI.toast('Quest complete!', q.title, '📜'); SFX.fanfare && SFX.fanfare(); hud && hud.renderQuests(); },
      onAchievement: (a) => { UI.toast('Achievement unlocked', a.title, a.icon); SFX.ding && SFX.ding(); },
      onDaily: (d) => { UI.toast('Daily challenge complete!', d.title, '🌟'); SFX.fanfare && SFX.fanfare(); },
      onChange: () => hud && hud.renderQuests() });
    for (const id of UI.discovered) progress.S.found.add(id);
    letters = createLetters({ world: walk, onCollect: (i, n, text, pos) => { progress.emit('letter', n); hud.letter(i, n, text); fx.hearts(pos, 24, 1); fx.sparkles(pos, 30, 1); SFX.wish ? SFX.wish() : SFX.ding(); player.unlock(); } });
    scene.add(letters.object3D);
    hud = createHUD({ world: walk, atts: ATTS, progress, onTravel: (a) => guideTo(a) });
    session = createSession({ director, player, hero, walk, UI, progress, SFX, initAudio, discover, focusOf, camera, ridePhoto, setTime: (n) => { setTime(n); UI.setTimePill(n); }, timeName });
    session.onChange((to) => { mode = to; document.body.classList.toggle('exploring', to === 'explore'); if (to !== 'explore') hud.prompt(null);
      if (to === 'explore') { UI.setCamPill(view); post.S.dof = false; post.setOutlined([]); document.body.classList.remove('cinematic'); selected = null; } });
    grass = createGrass(walk); scene.add(grass.object3D);
    crowd = createCrowd({ walk, attractions: ATTS, benches: props.benches, player: null }); scene.add(crowd.object3D);
    guide = createGuide({ nodes: crowd.nodes, walk, onArrive: (a) => { UI.toast('You have arrived', a.name, a.icon); SFX.ding(); progress.emit('arrive'); } }); scene.add(guide.object3D);
    events = createEvents({ run: runEvent, announce: (e, lead) => hud.announce(e, lead), nightness });
  }]);
  for (let i = 0; i < steps.length; i++) { UI.setLoad((i + 0.5) / (steps.length + 1), steps[i][0]); await nextFrame(); steps[i][1](); }
  UI.setLoad(0.96, 'Almost there…'); await nextFrame();

  picker = createPicker({ onHover: (a) => post.setOutlined(a ? [a.object3D] : []), onPick, onSky: (p) => { initAudio(); fx.firework(p); progress.emit('firework'); },
    onMiss: () => { if (mode === 'explore') { initAudio(); player.lock(); return true; } return false; },
    route: (type, ray) => { const g = activeGame(); return g ? g.pointer(type, ray) : false; } });
  for (const a of ATTS) picker.register(a);
  UI.setAttractions(ATTS);
  const shots = [{ name: 'Sweetheart Park', target: [0, 6, 30], pos: [0, 14, 120], hold: 9, spin: 0.15 }, { name: 'Wishing Fountain', target: [0, 3, 0], dist: 22, height: 8 }];
  for (const a of ATTS) if (!['fountain', 'train', 'treasure', 'photo'].includes(a.id)) shots.push({ name: a.name, ...a.focus });
  shots.push({ name: 'Sweetheart Park', target: [0, 24, L.castle.z], pos: [30, 20, L.castle.z + 64], hold: 10, spin: 0.12 });
  director.setShots(shots);
  director.onChange((m, shot) => { if (m === 'tour' || m === 'overview') UI.setCamPill(m); UI.caption(m === 'tour' && shot ? shot.name : ''); });
  // while the pointer is captured, a click acts on what the crosshair rests on (or launches fireworks at the sky)
  renderer.domElement.addEventListener('mousedown', (e) => { if (mode !== 'explore' || !player.S.locked || e.button !== 0) return;
    const h = picker.cast(innerWidth / 2, innerHeight / 2); if (h && h.point.distanceTo(camera.position) < 40) { onPick(h); return; }
    const r = picker.centerRay(); if (r.direction.y > 0.12) { fx.firework(r.origin.clone().addScaledVector(r.direction, 140)); progress.emit('firework'); } });

  UI.setLoad(0.97, 'Lighting the park for the night…');
  // the park after dark: a warm light per attraction, every lamp, the gate, floodlights on the castle
  const NLC = { rides: '#FFC27A', thrills: '#FFB2C4', games: '#FFD68A', experiences: '#F2D2FF' }, _box = new THREE.Box3(), _c = new THREE.Vector3(), _sz = new THREE.Vector3();
  for (const a of ATTS) { if (['treasure', 'train'].includes(a.id) || !a.object3D) continue; _box.setFromObject(a.object3D); _box.getCenter(_c); _box.getSize(_sz);
    addNightLight(new THREE.Vector3(_c.x, Math.min(_c.y, 4) + 1.5, _c.z), THREE.MathUtils.clamp(Math.max(_sz.x, _sz.z) * 0.85, 10, 28), NLC[a.cat] || '#FFC27A', ['lookout', 'bistro', 'cafe', 'photo'].includes(a.id) ? 0.9 : 2.4, { pulse: a.kind === 'ride' ? 0.15 : 0 }); }
  for (const h of props.heads) addNightLight(h, 9, '#FFC994', 1.7);
  addNightLight(new THREE.Vector3(0, 3, 0), 22, '#FFC6A8', 2.6, { pulse: 0.1 });
  for (const sx of [-1, 1]) addNightLight(new THREE.Vector3(sx * 7.4, 9, L.gate.z + 3), 16, '#FFD9A8', 2.8);
  // the castle, floodlit in layers (always among the active lights, so it glows from anywhere in the park)
  // the castle's own floodlight wash (castle.js) lights the façade; these only add a soft warm spill on the terrace and lawn
  for (const x of [-28, 0, 28]) addNightLight(new THREE.Vector3(x, L.castle.h + 1, L.castle.z + 22), 30, '#FFD2A8', 2.2, { always: 1 });
  // every ornamental lamp throws a warm pool of light on the paving around it (the nearest are live as you walk)
  for (const p of props.posts) addNightLight(new THREE.Vector3(p.x, 3.4, p.z), 12, '#FFC985', 4.6);
  { const cs = L.castle.scale || 1;   for (const x of [-13, 13]) addNightLight(new THREE.Vector3(x * cs, L.castle.h + 26 * cs, L.castle.z + 14), 26, '#C9A8FF', 2.6, { always: 1 });
  addNightLight(new THREE.Vector3(0, L.castle.h + 40 * cs, L.castle.z + 10), 34, '#FFB8D8', 4, { always: 1, pulse: 0.2 }); }
  bakeLightmap();   // every static light, painted once: the whole park is lit from the first frame
  patchScene();
  // the big water (pond, duck pond, fountain pool) drives the mirror; small fountain bowls just reuse it
  scene.traverse(o => { if (o.isMesh && WATER_MATERIALS.includes(o.material)) { waterMeshes.push(o); o.geometry.computeBoundingSphere(); o.userData.mirror = o.geometry.boundingSphere.radius > 3.5; } });
  skipInReflection(grass.object3D, scene.getObjectByName('vegetation'), crowd.object3D);
  UI.setLoad(0.98, 'Hanging the sky…'); await sky.ready;
  renderer.shadowMap.needsUpdate = true;
  // compile every shader up front, including things that start hidden (sky events, effects, ride props), so
  // nothing stalls the first time it appears
  { const hidden = []; scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn(e); }
    for (const o of hidden) o.visible = false; }
  UI.setLoad(1, 'Opening the gates…');
  mode = 'intro';
  director.intro(() => { beginExplore(); UI.toast('Welcome to Sweetheart Park', 'Click the view to look around · WASD to walk · E to interact', '💗'); }, new THREE.Vector3(0.4, 2.6, L.gate.z + 19.6), new THREE.Vector3(0, 1.6, L.gate.z + 9));
  frame();
  // the loading screen stays up until the park has really drawn a few frames (first-frame allocations, the shadow
  // map and the reflection all happen behind it), then dissolves — no black or half-built frames on reveal
  await Promise.race([(async () => { for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r)); })(), new Promise(r => setTimeout(r, 1500))]);   // (a background tab never fires frames: don't wait forever)
  window.__PG_BOOTED = true; UI.loaded();
}
boot();
window.PARK = { THREE, scene, camera, renderer, MOOD, Q, SET, WX, SYSTEMS, ATTS, setQuality, setTime, handlers, get player() { return player; }, get walk() { return walk; }, get progress() { return progress; }, get hud() { return hud; }, get mode() { return mode; }, get session() { return session; }, get crowd() { return crowd; }, get events() { return events; }, get meteors() { return meteors; }, get bulbs() { return bulbs; }, tick: (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt); }, enterExplore: () => enterExplore(), interact: () => interact(), get director() { return director; }, get fx() { return fx; }, get post() { return post; } };
