import { $, yawTo } from '../core/utils.js';
import { t, LANGS, getLang, setLang, onLang } from '../core/i18n.js';
import { QAUTO, QNAME, setQualityChoice, perf, camera } from '../core/renderer.js';
import { SET, DEFAULTS, setSetting, resetSettings } from '../core/settings.js';
import { AU } from '../core/audio.js';
import { ZONES } from '../world/sky.js';
import { ACTIVITIES } from '../world/attractions.js';
import { fireworksShow } from '../world/atmosphere.js';
import { lanternFestival } from '../world/lake.js';
import { organShow } from '../world/cathedral.js';
import { awakenKing } from '../world/fields.js';
import { S, SCORES, startWitchingHour } from '../game/play.js';
import { TS, CAMS, SPEEDS, startTour, setCam, setSpeed, jumpChapter, initTourCurves } from '../game/tour.js';
import { jumpTo, togglePhoto } from '../game/photo.js';
import { startFinale, startHunt } from '../game/showtime.js';
import { lock } from './ui.js';
import { icon } from './icons.js';
import { GUIDE, pinTarget } from './guide.js';
import { obEvent, startOnboarding } from './onboarding.js';
import { resetProgress } from '../core/save.js';
import { PY, SEQ_NAMES, SITE_NAMES, TYPES, launch, play, setAuto, shellName } from '../game/pyro.js';
import { player } from '../game/play.js';
import { ACTS, SHOWLOOP, actProgress, nextAct } from '../game/conductor.js';

/* =========================================================================
   CONTROL CONSOLE — a slide-in command deck (Tab / ` / the ☰ button) organised in six tabs:
   Explore (every district + tour launch), Attractions (progress, records, go-to), Spectacles (events & shows),
   Graphics (preset + per-effect overrides), Controls & Audio, Interface. Language switch lives in the header.
   ========================================================================= */
// where to stand for each attraction: [x, z, look-at x, look-at z]
const SPOTS = {
  ferris: [-37, -9, -40, -16], carousel: [20, 23, 32, 18], swing: [30, -11, 36, -16], coaster: [-47, 21, -56, 14], drop: [54, 6, 62, 6], bump: [64, 52, 64, 40],
  shoot: [8.5, 50, 17, 50], striker: [-9, 50, -18, 50], whack: [-26, -37, -26, -42], toss: [-16, 60, -28, 60], manor: [0, -44, 0, -66], maze: [48, -30, 48, -55],
  ghosts: [0, 22, 0, 0], witch: [0, 13, 0, 0], fireworks: [-12, 23, -12, 18], circus: [-92, 22, -118, 22], cups: [-86, 57, -98, 56], archery: [-111, -9.5, -130, -12],
  skullroll: [-92, 9, -92, 2], organ: [0, -156, 0, -170], king: [100, 52, 120, 50], hayride: [86, 31, 100, 22], brew: [-111.8, -141.8, -111.8, -138.5],
  flight: [-112, -136, -114.4, -140.8], lanterns: [100, -38, 112, -50], ferry: [98, -36.6, 110, -40], galleon: [93, 11, 102, 6], fishing: [96, -36.4, 96, -46],
  hunt: [0, 30, 0, 0], finale: [0, 44, 0, 0],
};
const AREAS = [['core', 'The Heart of the Park'], ['east', 'East · Fields & Lake'], ['north', 'North · Cathedral & Witchwood'], ['west', 'West · Circus Grounds']];
const TABS = [['explore', 'Explore', 'compass'], ['acts', 'Attractions', 'star'], ['show', 'Spectacles', 'spark'], ['fw', 'Fireworks', 'firework'], ['gfx', 'Graphics', 'eye'], ['ctrl', 'Controls', 'gamepad'], ['ui', 'Interface', 'access']];
let open = false, tab = 'explore', wasLocked = false, actFilter = 'all';

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
function buildConsole() {
  const root = el(`<aside id="console" class="hidden" aria-label="Control console">
    <header class="cx-head">
      <div class="cx-brand"><span class="cx-logo">HOLLOWMOOR</span><span class="cx-title" data-i18n="Control Console">Control Console</span></div>
      <div class="cx-lang">${Object.entries(LANGS).map(([k, v]) => `<button class="cx-pill" data-lang="${k}">${v}</button>`).join('')}</div>
      <button class="cx-x" data-cx="close" data-i18n-title="Close (Tab)">${icon('close')}</button>
    </header>
    <nav class="cx-tabs">${TABS.map(([id, n, ic]) => `<button class="cx-tab" data-tab="${id}">${icon(ic)}<span data-i18n="${n}">${n}</span></button>`).join('')}</nav>
    <div class="cx-body"></div>
    <footer class="cx-foot"><span class="cx-fps"></span><span class="cx-hint" data-i18n="Tab toggles the console · Esc closes">Tab toggles the console · Esc closes</span></footer>
  </aside>`);
  document.body.appendChild(root);
  const fab = el(`<button id="cxfab" class="hidden" data-i18n-title="Control console (Tab)">${icon('sliders')}<span data-i18n="Console">Console</span></button>`); document.body.appendChild(fab);
  fab.addEventListener('click', e => { e.stopPropagation(); toggleConsole(); });
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onInput);
  root.addEventListener('mousedown', e => e.stopPropagation()); root.addEventListener('wheel', e => e.stopPropagation());
  onLang(() => { if (open) render(); syncLang(); }); syncLang();
  setInterval(() => { if (open) { const f = root.querySelector('.cx-fps'); if (f) f.textContent = `${perf.fps ? perf.fps.toFixed(0) : '…'} fps · ${t(QNAME)}${QAUTO ? ' (' + t('Auto') + ')' : ''}`; } }, 500);
}
function syncLang() { document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === getLang())); }
function toggleConsole(force) {
  const want = force === undefined ? !open : force; if (want === open) return; open = want;
  const root = $('#console');
  if (open) { if (S.mode === 'title') { open = false; return; } wasLocked = S.locked; if (document.pointerLockElement) document.exitPointerLock(); S.menu = true; S.console = true; obEvent('console'); $('#menu').classList.add('hidden'); render(); root.classList.remove('hidden'); requestAnimationFrame(() => root.classList.add('open')); AU.click(); }
  else { root.classList.remove('open'); setTimeout(() => { if (!open) root.classList.add('hidden'); }, 260); S.console = false; S.menu = false; if (['roam', 'ride', 'game'].includes(S.mode) && wasLocked) lock(); }
}
const isOpen = () => open;
// ---------- rendering ----------
const row = (label, ctrl, hint = '') => `<div class="cx-row"><div class="cx-l"><span>${t(label)}</span>${hint ? `<small>${t(hint)}</small>` : ''}</div><div class="cx-c">${ctrl}</div></div>`;
const toggle = (k, v = SET[k]) => `<button class="cx-tog ${v ? 'on' : ''}" data-set="${k}" data-type="bool"><i></i></button>`;
const tri = k => `<div class="cx-seg">${[[null, 'Preset'], [true, 'On'], [false, 'Off']].map(([v, n]) => `<button class="${SET[k] === v ? 'on' : ''}" data-set="${k}" data-type="tri" data-v="${v}">${t(n)}</button>`).join('')}</div>`;
const slider = (k, min, max, step, fmt = v => (+v).toFixed(2)) => `<div class="cx-slide"><input type="range" min="${min}" max="${max}" step="${step}" value="${SET[k]}" data-set="${k}" data-type="num"><output>${fmt(SET[k])}</output></div>`;
const sec = (title, body) => `<section class="cx-sec"><h5>${t(title)}</h5>${body}</section>`;
function render() {
  const root = $('#console'); root.querySelectorAll('.cx-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const body = root.querySelector('.cx-body'); body.innerHTML = ({ explore, acts, show, fw, gfx, ctrl, ui })[tab](); body.scrollTop = 0;
}
function explore() {
  initTourCurves();
  const tour = sec('Cinematic Tour', `<div class="cx-btns">
      <button class="cx-btn primary" data-cx="tour-here">▶ ${t('Tour from here')}</button><button class="cx-btn" data-cx="tour-start">⟲ ${t('From the beginning')}</button></div>
    ${row('Camera rig', `<div class="cx-seg wrap">${CAMS.map(c => `<button class="${TS.cam === c.id ? 'on' : ''}" data-tcam="${c.id}">${t(c.name)}</button>`).join('')}</div>`)}
    ${row('Speed', `<div class="cx-seg">${SPEEDS.map(s => `<button class="${TS.speed === s ? 'on' : ''}" data-tspeed="${s}">${s}×</button>`).join('')}</div>`)}
    <div class="cx-chapters">${TS.chapters.map((c, i) => `<button class="cx-chip" data-chap="${i}"><b>${String(i + 1).padStart(2, '0')}</b>${t(c.name)}</button>`).join('')}</div>`);
  const groups = AREAS.map(([a, title]) => sec(title, `<div class="cx-zones">${ZONES.map((z, i) => ((z.area || 'core') === a ? `<button class="cx-zone" data-zone="${i}">
      <b>${t(z.name)}</b><small>${t(z.sub)}</small>${z.key ? `<kbd>${z.key}</kbd>` : ''}</button>` : '')).join('')}</div>`)).join('');
  return tour + groups + sec('Camera', `<div class="cx-btns"><button class="cx-btn" data-cx="photo">${icon('camera')} ${t('Photo Mode')}</button></div>`);
}
function acts() {
  const done = ACTIVITIES.filter(a => S.done.has(a[0])).length, pct = done / ACTIVITIES.length * 100;
  const best = { shoot: SCORES.shoot, striker: SCORES.striker && SCORES.striker + '%', bump: SCORES.bump, whack: SCORES.whack, toss: SCORES.toss, archery: SCORES.archery, skullroll: SCORES.skullroll, brew: SCORES.brew, fishing: SCORES.fishing, hunt: SCORES.hunt, flight: SCORES.flight && SCORES.flight.toFixed(1) + 's' };
  return `<div class="cx-progress"><div class="cx-pbar"><i style="width:${pct}%"></i></div><span>${t('{a} of {b} attractions complete', { a: done, b: ACTIVITIES.length })} · ${t('Souls {n}/13', { n: S.souls })}</span></div>` +
    `<div class="cx-stats"><div><b>${S.souls}</b><span>${t('Souls')}</span></div><div><b>${S.candy}</b><span>${t('Candy')}</span></div><div><b>${S.ghosts}</b><span>${t('Ghosts')}</span></div><div><b>${S.lit || 0}</b><span>${t('Lanterns')}</span></div></div>` +
    `<div class="cx-filter cx-seg">${[['all', 'All'], ['todo', 'To do'], ['done', 'Done']].map(([v, n]) => `<button class="${actFilter === v ? 'on' : ''}" data-af="${v}">${t(n)}</button>`).join('')}</div>` +
    `<div class="cx-acts">${ACTIVITIES.filter(([k]) => actFilter === 'all' || (actFilter === 'done') === S.done.has(k)).map(([k, n]) => `<div class="cx-act ${S.done.has(k) ? 'done' : ''}"><span class="cx-chk">${S.done.has(k) ? icon('check') : icon('pin')}</span><span class="cx-an">${t(n)}</span>
      ${best[k] ? `<span class="cx-best">${icon('trophy')} ${best[k]}</span>` : ''}${SPOTS[k] && !S.done.has(k) ? `<button class="cx-go guide ${GUIDE.key === k && GUIDE.pinned ? 'on' : ''}" data-guide="${k}" title="${t('Show the way')}">${icon('route')}</button>` : ''}${SPOTS[k] ? `<button class="cx-go" data-go="${k}">${t('Go')}</button>` : ''}</div>`).join('')}</div>`;
}
function show() {
  const card = (id, ic, name, sub, cls = '') => `<button class="cx-card ${cls}" data-ev="${id}">${icon(ic)}<b>${t(name)}</b><small>${t(sub)}</small></button>`;
  return sec('Spectacles', `<div class="cx-cards">
      ${card('finale', 'spark', 'Grand Finale', 'A 70-second show that wakes the whole park — watch from the crane camera', 'hero')}
      ${card('finale-here', 'firework', 'Grand Finale (stay here)', 'Same show, but you keep walking around inside it')}
      ${card('witch', 'moon', 'Witching Hour', 'Blood moon, thirteen tolls and lightning')}
      ${card('fireworks', 'firework', 'Fireworks', 'Eighteen seconds of shells over the park')}
      ${card('lanterns', 'lantern', 'Lantern Festival', 'Hundreds of lanterns rise from the lake')}
      ${card('king', 'crown', 'Awaken the Pumpkin King', 'Fire jets and a roar across the fields')}
      ${card('organ', 'music', 'Great Organ Show', 'The cathedral windows burn with music')}
      ${card('hunt', 'ghost', 'Ghost Hunt', '90-second park-wide lantern challenge')}</div>`) +
    sec('Light Show', `<div class="cx-seg">${[['idle', 'Warm'], ['rainbow', 'Rainbow'], ['blood', 'Blood']].map(([v, n]) => `<button class="${S.lightShow === v ? 'on' : ''}" data-ls="${v}">${t(n)}</button>`).join('')}</div>`) +
    sec('Sky', row('Aurora intensity', slider('aurora', 0, 2, 0.05))) +
    sec('Time Flow', `<div class="cx-seg">${[0.25, 0.5, 1, 1.5].map(v => `<button class="${S.timeScale === v ? 'on' : ''}" data-ts="${v}">${v}×</button>`).join('')}</div><p class="cx-note">${t('Slows or speeds every ride, ghost and firework. Gameplay timers are unaffected.')}</p>`);
}
function fw() {
  const O = PY.opts, A = PY.auto, seg = (key, list, cur) => `<div class="cx-seg wrap">${list.map(([v, n]) => `<button class="${cur === v ? 'on' : ''}" data-${key}="${v}">${t(n)}</button>`).join('')}</div>`;
  const sites = Object.entries(SITE_NAMES), cols = [['auto', 'Mixed'], ['amber', 'Amber'], ['gold', 'Gold'], ['violet', 'Violet'], ['ghost', 'Ghost green'], ['blood', 'Blood red'], ['silver', 'Silver'], ['azure', 'Azure'], ['rose', 'Rose'], ['lime', 'Lime'], ['teal', 'Teal'], ['magenta', 'Magenta'], ['copper', 'Copper']];
  const pr = actProgress();
  return sec('Nightly Spectacular', `<div class="cx-now"><div class="cx-now-k">${t(SHOWLOOP.on ? 'Now playing' : 'Show stopped')}</div><div class="cx-now-n">${SHOWLOOP.on ? t(pr.act.name) : '—'}</div>
        <div class="cx-acts-bar">${ACTS.map((a, i) => `<i class="${i === pr.i && SHOWLOOP.on ? 'on' : ''}" style="flex:${a.bars}"><b style="width:${i === pr.i ? pr.k * 100 : i < pr.i ? 100 : 0}%"></b></i>`).join('')}</div></div>` +
      row('Looping show', toggle('showLoop'), 'Fireworks, lights, music and aurora, cycling on their own') + row('Show intensity', slider('showDensity', 0.3, 1.6, 0.05)) +
      row('Music volume', slider('music', 0, 1, 0.01, v => Math.round(v * 100) + '%')) + row('Light show', toggle('lightShowOn')) + row('Lasers', toggle('lasersOn')) +
      `<div class="cx-btns"><button class="cx-btn" data-cx="next-act">${icon('next')} ${t('Skip to next act')}</button><button class="cx-btn" data-cx="fw-seat">${icon('eye')} ${t('Best seat in the park')}</button></div>`) +
    sec('Extra Fireworks', row(A.on ? 'Show running' : 'Show stopped', `<button class="cx-tog ${A.on ? 'on' : ''}" data-fwauto="1"><i></i></button>`, 'Plays on its own until you stop it') +
      row('Intensity', seg('fwlevel', [['gentle', 'Gentle'], ['standard', 'Standard'], ['spectacular', 'Spectacular']], A.level)) + row('Launch site', seg('fwasite', sites, A.site))) +
    sec('Manual Launch', row('Launch site', seg('fwsite', sites, O.site)) + row('Shell size', `<div class="cx-slide"><input type="range" min="0.6" max="2.6" step="0.1" value="${O.size}" data-fwsize="1"><output>${O.size.toFixed(1)}</output></div>`, 'Bigger shells fly higher and burst wider') +
      `<div class="cx-l" style="margin:12px 0 6px"><span>${t('Colour')}</span></div>${seg('fwcol', cols, O.color)}
      <div class="cx-shells">${TYPES.map(k => `<button class="cx-shell" data-fwtype="${k}"><i class="sw sw-${k}"></i><span>${shellName(k)}</span></button>`).join('')}<button class="cx-shell rnd" data-fwtype="random"><i class="sw"></i><span>${t('Surprise me')}</span></button></div>`) +
    sec('Sequences', `<div class="cx-cards">${Object.entries(SEQ_NAMES).map(([k, n]) => `<button class="cx-card ${k === 'barrage' ? 'hero' : ''}" data-fwseq="${k}">${icon(k === 'barrage' ? 'spark' : 'firework')}<b>${t(n)}</b><small>${t(SEQ_DESC[k])}</small></button>`).join('')}</div>`) +
    sec('Watch', `<div class="cx-btns"><button class="cx-btn primary" data-cx="fw-seat">${icon('eye')} ${t('Best seat in the park')}</button><button class="cx-btn" data-ts="${S.timeScale === 0.5 ? 1 : 0.5}">${t(S.timeScale === 0.5 ? 'Normal speed' : 'Slow motion')}</button></div>
      <p class="cx-note">${t('Tip: keep this panel open and launch while you watch. In the park, press K to fire a shell at the nearest launch site.')}</p>`);
}
const SEQ_DESC = { salvo: 'Five shells in quick succession', fan: 'Seven comets fanned across the sky', crescendo: 'Fourteen shells, faster and bigger', willows: 'A line of golden willows drifting down',
  ringfire: 'Twelve rings in a circle of fire', pumpkins: "Five jack-o'-lantern faces", barrage: 'Forty-two shells and three giant kamuro' };
function gfx() {
  return sec('Quality Preset', `<div class="cx-seg wrap">${['auto', 'low', 'medium', 'high', 'ultra'].map(q => `<button class="${(q === 'auto' ? QAUTO : !QAUTO && QNAME === q) ? 'on' : ''}" data-q="${q}">${t(q === 'auto' ? 'Auto' : q)}</button>`).join('')}</div>
      <p class="cx-note">${t('Auto picks a tier for your GPU and keeps tuning it from the real frame rate.')}</p>`) +
    sec('Look', row('Tone mapping', `<div class="cx-seg">${[['aces', 'Filmic'], ['agx', 'AgX'], ['neutral', 'Neutral']].map(([v, n]) => `<button class="${SET.tonemap === v ? 'on' : ''}" data-set="tonemap" data-type="str" data-v="${v}">${t(n)}</button>`).join('')}</div>`, 'How highlights roll off') +
      row('Colour harmony', slider('harmony', 0, 2, 0.05), 'Pulls every colour toward one grade')) +
    sec('Effects', row('Shadows', tri('shadows')) + row('Ambient occlusion', tri('ao'), 'Soft contact shadows (GTAO)') + row('Depth of field', tri('dof')) + row('Moon rays', tri('rays'), 'Screen-space god rays')) +
    sec('Image', row('Bloom', slider('bloom', 0, 2.5, 0.05)) + row('Exposure', slider('exposure', 0.5, 1.8, 0.02)) + row('Fog density', slider('fog', 0.2, 2.5, 0.05)) +
      row('Film grain', slider('grain', 0, 3, 0.1)) + row('Chromatic aberration', slider('ca', 0, 3, 0.1)) + row('Vignette', slider('vignette', 0, 2, 0.05)) + row('Sharpen', slider('sharpen', 0, 2, 0.05)) +
      row('Render scale', slider('scale', 0.5, 1.25, 0.05, v => Math.round(v * 100) + '%'), 'Lower = faster')) +
    `<div class="cx-btns"><button class="cx-btn" data-cx="reset-gfx">${t('Reset graphics')}</button></div>`;
}
function ctrl() {
  return sec('Camera', row('Field of view', slider('fov', 45, 100, 1, v => Math.round(v) + '°')) + row('Mouse sensitivity', slider('sens', 0.2, 3, 0.05)) + row('Invert Y', toggle('invertY')) + row('Head bob', toggle('headBob'))) +
    sec('Controller & Touch', `<p class="cx-note">${t('Gamepads work out of the box: left stick move, right stick look, A act, B jump, X lantern, Y tour, LB guide, Start menu, Back console. On touch screens a stick and buttons appear automatically.')}</p>`) +
    sec('Audio', row('Master volume', slider('volume', 0, 1, 0.01, v => Math.round(v * 100) + '%')) + row('Mute', toggle('muted'))) +
    sec('Keys', `<div class="cx-keys">${[['WASD', 'Move'], ['Shift', 'Run'], ['Space', 'Jump'], ['E / Click', 'Interact'], ['F', 'Lantern'], ['T', 'Tour from here'], ['G', 'Guide'], ['P', 'Photo Mode'], ['1–0', 'Quick travel'], ['Tab', 'Console'], ['M', 'Mute'], ['Esc', 'Menu']].map(([k, a]) => `<div><kbd>${k}</kbd><span>${t(a)}</span></div>`).join('')}</div>`);
}
function ui() {
  return sec('Heads-up Display', row('Guidance (Next up & waypoint)', toggle('guide')) + row('Compass', toggle('compass')) + row('Minimap', toggle('minimap')) + row('Key hints', toggle('keyHints')) + row('Zone titles', toggle('zoneTitles')) + row('Crosshair', toggle('crosshair')) + row('Attraction markers', toggle('markers')) + row('FPS counter', toggle('fps'))) +
    sec('Accessibility', row('Interface size', slider('uiScale', 0.8, 1.4, 0.05, v => Math.round(v * 100) + '%')) + row('High-contrast interface', toggle('highContrast')) +
      row('Reduce motion', toggle('reduceMotion'), 'No head bob, camera shake or UI animation') + row('Reduce flashing', toggle('reduceFlash'), 'Dims lightning, firework and finale flashes') + row('Tour captions', toggle('captions'))) +
    sec('Language', `<div class="cx-seg">${Object.entries(LANGS).map(([k, v]) => `<button class="${getLang() === k ? 'on' : ''}" data-lang="${k}">${v}</button>`).join('')}</div>`) +
    sec('Progress', `<div class="cx-btns"><button class="cx-btn" data-cx="tutorial">${icon('info')} ${t('Replay tutorial')}</button><button class="cx-btn" data-cx="reset-all">${icon('reset')} ${t('Reset all settings')}</button><button class="cx-btn danger" data-cx="wipe">${t('Erase progress')}</button></div><p class="cx-note">${t('Progress, high scores and settings are saved in this browser automatically.')}</p>`);
}
// ---------- events ----------
function goTo(x, z, tx, tz, name = '') { toggleConsole(false); jumpTo({ x, z, tx, tz, name, sub: '' }); setTimeout(lock, 420); }
function onClick(e) {
  const b = e.target.closest('button'); if (!b) return; AU.click();
  if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
  if (b.dataset.lang) { setLang(b.dataset.lang); return; }
  if (b.dataset.q) { setQualityChoice(b.dataset.q); render(); return; }
  if (b.dataset.af) { actFilter = b.dataset.af; render(); return; }
  if (b.dataset.fwtype) { launch({ type: b.dataset.fwtype }); b.classList.add('fired'); setTimeout(() => b.classList.remove('fired'), 300); return; }
  if (b.dataset.fwseq) { play(b.dataset.fwseq); return; }
  if (b.dataset.fwauto) { setAuto(!PY.auto.on); render(); return; }
  if (b.dataset.fwlevel) { setAuto(PY.auto.on, b.dataset.fwlevel); render(); return; }
  if (b.dataset.fwasite) { setAuto(PY.auto.on, null, b.dataset.fwasite); render(); return; }
  if (b.dataset.fwsite) { PY.opts.site = b.dataset.fwsite; render(); return; }
  if (b.dataset.fwcol) { PY.opts.color = b.dataset.fwcol; render(); return; }
  if (b.dataset.guide) { pinTarget(b.dataset.guide); toggleConsole(false); setTimeout(lock, 50); return; }
  if (b.dataset.set) { const k = b.dataset.set, ty = b.dataset.type; if (ty === 'str') setSetting(k, b.dataset.v); else if (ty === 'bool') setSetting(k, !SET[k]); else if (ty === 'tri') setSetting(k, b.dataset.v === 'null' ? null : b.dataset.v === 'true'); render(); return; }
  if (b.dataset.zone) { const z = ZONES[+b.dataset.zone]; toggleConsole(false); jumpTo(z); setTimeout(lock, 420); return; }
  if (b.dataset.go) { const [x, z, tx, tz] = SPOTS[b.dataset.go]; goTo(x, z, tx, tz); return; }
  if (b.dataset.tcam) { TS.cam = b.dataset.tcam; render(); if (S.mode === 'tour') setCam(TS.cam); return; }
  if (b.dataset.tspeed) { setSpeed(+b.dataset.tspeed); render(); return; }
  if (b.dataset.chap) { toggleConsole(false); startTour({ u: TS.chapters[+b.dataset.chap].u + 0.0005 }); return; }
  if (b.dataset.ls) { S.lightShow = b.dataset.ls; S.lightShowT = b.dataset.ls === 'rainbow' ? 1e9 : 0; render(); return; }
  if (b.dataset.ts) { S.timeScale = +b.dataset.ts; render(); return; }
  const ev = b.dataset.ev; if (ev) { toggleConsole(false);
    if (ev === 'finale') startFinale(true); else if (ev === 'finale-here') { startFinale(false); setTimeout(lock, 50); }
    else { setTimeout(lock, 50); ({ witch: () => startWitchingHour(false), fireworks: () => play('crescendo'), lanterns: lanternFestival, king: awakenKing, organ: organShow, hunt: startHunt })[ev](); }
    return; }
  const a = b.dataset.cx;
  if (a === 'close') toggleConsole(false);
  if (a === 'tour-here') { toggleConsole(false); startTour({ fromHere: true }); }
  if (a === 'tour-start') { toggleConsole(false); startTour({ restart: true }); }
  if (a === 'photo') { toggleConsole(false); togglePhoto(); }
  if (a === 'next-act') { nextAct(); setTimeout(render, 300); }
  if (a === 'fw-seat') { const st = PY.opts.site === 'all' ? 'plaza' : PY.opts.site, seat = { plaza: [0, 46, 0, -30], lake: [78, -36, 112, -55], fields: [86, 34, 122, 52], cathedral: [0, -108, 0, -160], circus: [-82, 28, -118, 22] }[st];
    jumpTo({ x: seat[0], z: seat[1], tx: seat[2], tz: seat[3], name: '', sub: '' }); setTimeout(() => { player.pitch = 0.42; }, 450); }
  if (a === 'reset-gfx') { for (const k of ['shadows', 'ao', 'dof', 'rays', 'bloom', 'grain', 'ca', 'vignette', 'sharpen', 'exposure', 'fog', 'scale']) SET[k] = DEFAULTS[k]; setSetting('scale', 1); render(); }
  if (a === 'reset-all') { resetSettings(); render(); }
  if (a === 'tutorial') { toggleConsole(false); setTimeout(lock, 50); setTimeout(() => startOnboarding(true), 600); }
  if (a === 'wipe') { if (confirm(t('Erase all progress and high scores?'))) resetProgress(); }
}
function onInput(e) {
  const i = e.target;
  if (i.dataset && i.dataset.fwsize) { PY.opts.size = +i.value; i.parentElement.querySelector('output').textContent = (+i.value).toFixed(1); return; } if (!i.dataset || !i.dataset.set || i.dataset.type !== 'num') return;
  const k = i.dataset.set, v = +i.value; const out = i.parentElement.querySelector('output');
  const fmt = { fov: x => Math.round(x) + '°', volume: x => Math.round(x * 100) + '%', scale: x => Math.round(x * 100) + '%' }[k] || (x => x.toFixed(2)); out.textContent = fmt(v);
  if (k === 'scale' && e.type === 'input') return; // re-allocating render targets on every drag tick is expensive: apply on release
  setSetting(k, v);
}

export { buildConsole, toggleConsole, isOpen, SPOTS };
