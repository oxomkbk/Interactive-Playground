/* =========================================================================
   UI — the park's control center (DOM only; main.js supplies the handlers):
   • top bar: time of day, camera mode, atlas, world panel, sound, fullscreen, about
   • Atlas: every attraction, searchable, filterable by category, with live status and discovery
   • Console: the selected attraction's own controls — only what it really supports (start/stop, speed,
     ride view, next seat, play / secondary action, riddle & hint for the hunt, best scores)
   • World panel (tabs): atmosphere (weather, light, fog, bloom, particles) · camera (mode, speed, field of
     view) · audio (master, music, ambience, effects) · display (quality, language, stats)
   • Game HUDs (aim power meter, claw pad, rhythm lanes, timers and scores), ride-view pill, photo booth
     countdown / flash / strip, toasts, captions, loader.
   ========================================================================= */
import { t, setLang, getLang, onLang, applyStatic } from './i18n.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tr = v => (Array.isArray(v) ? t(v[0], v[1]) : t(v || ''));
let H = {}, ATTS = [], current = null, filter = 'all', query = '';
const discovered = new Set(); try { JSON.parse(localStorage.getItem('sweetheart-park-found') || '[]').forEach(id => discovered.add(id)); } catch (e) {}
const HUD = {
  ringToss: 'Move to aim · hold to wind up · release to throw', golf: 'Move to aim · hold to wind up · release to putt', fishing: 'Move to steer the hook · click to dip it',
  gallery: 'Click to shoot the moving targets', claw: 'Use the arrow keys or the pad, then GRAB', bumper: 'WASD or arrow keys to drive — bump into everyone!',
  stage: 'Hit ← ↓ ↑ → (or D F J K) as the arrows cross the line', observatory: 'Drag to sweep the sky · hold a constellation in the centre',
};

function initUI(handlers) {
  H = handlers; applyStatic();
  $$('[data-time]').forEach(b => b.addEventListener('click', () => H.setTime(b.dataset.time)));
  $$('[data-cam]').forEach(b => b.addEventListener('click', () => H.setCam(b.dataset.cam)));
  $$('[data-weather]').forEach(b => b.addEventListener('click', () => { H.setWeather(b.dataset.weather); syncChips(); }));
  $$('[data-q]').forEach(b => b.addEventListener('click', () => { H.quality(b.dataset.q); syncChips(); }));
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => { $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); $$('.tabpane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab)); }));
  $$('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; $$('[data-filter]').forEach(x => x.classList.toggle('on', x === b)); renderList(); }));
  $('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderList(); });
  // sliders: data-set="key" → H.setting(key, value); data-level="channel" → H.level(channel, value)
  $$('[data-set]').forEach(r => { r.value = H.getSetting(r.dataset.set); r.addEventListener('input', () => { H.setting(r.dataset.set, parseFloat(r.value)); out(r); }); out(r); });
  $$('[data-level]').forEach(r => { r.value = H.getLevel(r.dataset.level); r.addEventListener('input', () => { H.level(r.dataset.level, parseFloat(r.value)); out(r); }); out(r); });
  const syncLang = () => $$('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === getLang()));
  syncLang(); onLang(() => { syncLang(); renderList(); if (current) showCard(current); });
  $('#bAtlas').addEventListener('click', () => toggle('#atlas'));
  $('#bWorld').addEventListener('click', () => toggle('#world'));
  $('#bInfo').addEventListener('click', () => $('#about').classList.remove('hidden'));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest(b.dataset.close).classList.add('hidden')));
  $('#bSound').addEventListener('click', () => $('#bSound').classList.toggle('off', !H.toggleSound()));
  $('#tParticles').addEventListener('change', e => H.particles(e.target.checked));
  $('#tStats').addEventListener('change', e => H.stats(e.target.checked));
  $('#bHome').addEventListener('click', () => { H.setCam('first'); $('#world').classList.add('hidden'); });
  // command center: world, camera, player, progress, graphics
  $('#bAllStart').addEventListener('click', () => { for (const a of ATTS) if (a.kind === 'ride' && !a.running) a.setRunning(true); renderList(); toast('Every ride is running', '', '🎡'); });
  $('#bAllStop').addEventListener('click', () => { for (const a of ATTS) if (a.kind === 'ride' && a.running) a.setRunning(false); renderList(); toast('Every ride has stopped', '', '⏸'); });
  $('#bFireworks').addEventListener('click', () => H.event('fireworks'));
  $$('[data-event]').forEach(b => b.addEventListener('click', () => { H.event(b.dataset.event); $('#world').classList.add('hidden'); }));
  for (const id of ['#bMap', '#bMap2']) $(id).addEventListener('click', () => { $('#world').classList.add('hidden'); H.showMap(); });
  $('#tInvert').checked = !!H.getSetting('invertY'); $('#tInvert').addEventListener('change', e => H.setting('invertY', e.target.checked));
  $('#tDof').checked = H.getSetting('dof') !== false; $('#tDof').addEventListener('change', e => H.setting('dof', e.target.checked));
  $('#tAO').checked = H.getSetting('ao') !== false; $('#tAO').addEventListener('change', e => H.setting('ao', e.target.checked));
  $('#tGrass').checked = H.getSetting('grass') !== false; $('#tGrass').addEventListener('change', e => H.setting('grass', e.target.checked));
  const syncOutfit = (i) => $$('[data-outfit]').forEach(b => b.classList.toggle('on', +b.dataset.outfit === i));
  $$('[data-outfit]').forEach(b => b.addEventListener('click', () => { H.outfit(+b.dataset.outfit); syncOutfit(+b.dataset.outfit); })); syncOutfit(H.getOutfit());
  $('#bReset').addEventListener('click', () => { if (confirm(t('Reset all quests, achievements and collectibles?'))) H.resetProgress(); });
  $('#bFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); });
  // console actions
  $('#cClose').addEventListener('click', () => { hideCard(); H.closeCard(); });
  $('#cRun').addEventListener('click', () => { if (current) { H.toggleRun(current); refreshCard(); } });
  $('#cSpeed').addEventListener('input', e => { if (current) { current.speed = parseFloat(e.target.value); out(e.target); } });
  $('#cRide').addEventListener('click', () => current && H.ride(current));
  $('#cSeat').addEventListener('click', () => { if (current && current.cycleSeat) { const n = current.cycleSeat(); $('#cSeat span').textContent = `${t(current.seatName || 'Seat')} ${n}`; } });
  $('#cPlay').addEventListener('click', () => current && H.play(current));
  $('#cAlt').addEventListener('click', () => current && current.secondary && current.secondary.run());
  $('#cFocus').addEventListener('click', () => current && H.focus(current));
  $('#cGuide').addEventListener('click', () => current && H.guide(current));
  $('#cHint').addEventListener('click', () => current && current.hintFocus && H.focusOn(current.hintFocus()));
  // claw pad
  $$('[data-pad]').forEach(b => { const [dx, dz] = b.dataset.pad.split(',').map(Number);
    const on = e => { e.preventDefault(); current && current.input && (current.input.x = dx, current.input.z = dz); }, off = () => { current && current.input && (current.input.x = 0, current.input.z = 0); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); });
  $('#gGrab').addEventListener('click', () => current && current.grab && current.grab());
  $('#gAgain').addEventListener('click', () => current && H.play(current));
  $('#gExit').addEventListener('click', () => current && H.exitGame(current));
  $('#rideExit').addEventListener('click', () => H.exitRide());
  $('#phClose').addEventListener('click', () => $('#photos').classList.add('hidden'));
  document.addEventListener('click', e => { const p = $('#world'); if (!p.classList.contains('hidden') && !p.contains(e.target) && !e.target.closest('#bWorld') ) p.classList.add('hidden'); });
  $('#bSound').classList.toggle('off', !H.soundOn()); syncChips();
}
function out(r) { const o = r.parentElement.querySelector('output'); if (o) o.textContent = r.dataset.fmt === '%' ? Math.round(r.value * 100) + '%' : r.dataset.fmt === '°' ? Math.round(r.value) + '°' : (+r.value).toFixed(2).replace(/0$/, '') + (r.dataset.fmt || ''); }
function toggle(sel) { $(sel).classList.toggle('hidden'); }
function syncChips() { const q = H.getQuality(), w = H.getSetting('weather'); $$('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === q)); $$('[data-weather]').forEach(b => b.classList.toggle('on', b.dataset.weather === w)); }
function setLoad(p, msg) { $('#loadbar i').style.transform = `scaleX(${Math.max(0.02, Math.min(1, p)).toFixed(3)})`; if (msg) $('#loadtxt').textContent = t(msg); }   // transform, not width: animates on the compositor
function loaded() { $('#loader').classList.add('done'); setTimeout(() => $('#loader').classList.add('hidden'), 1400); $('#ui').classList.remove('hidden'); }
const setTimePill = (name) => $$('[data-time]').forEach(b => b.classList.toggle('on', b.dataset.time === name));
const setCamPill = (mode) => $$('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === mode));

/* ---------------- atlas ---------------- */
function setAttractions(list) { ATTS = list; renderList(); }
function renderList() {
  const ul = $('#attrList'); ul.innerHTML = '';
  const shown = ATTS.filter(a => (filter === 'all' || a.cat === filter) && (!query || [t(a.name), t(a.zone), a.name, a.tags || ''].some(s => s.toLowerCase().includes(query))));
  for (const a of shown) { const li = document.createElement('button'); li.className = 'att' + (discovered.has(a.id) ? ' found' : '') + (a === current ? ' sel' : ''); li.dataset.id = a.id;
    const status = a.kind === 'ride' ? (a.running ? 'on' : 'off') : 'idle';
    li.innerHTML = `<span class="ai">${a.icon}</span><span class="an"><b>${esc(t(a.name))}</b><small>${esc(t(a.zone))}</small></span><span class="dot ${status}"></span>`;
    li.addEventListener('click', () => { H.select(a); if (innerWidth < 900) $('#atlas').classList.add('hidden'); }); ul.appendChild(li); }
  if (!shown.length) ul.innerHTML = `<div class="empty">${esc(t('Nothing matches — try another word.'))}</div>`;
  $('#foundCount').textContent = `${discovered.size} / ${ATTS.length}`;
}
function markDiscovered(a) { if (discovered.has(a.id)) return false; discovered.add(a.id); try { localStorage.setItem('sweetheart-park-found', JSON.stringify([...discovered])); } catch (e) {} renderList(); return discovered.size; }

/* ---------------- console ---------------- */
function showCard(a) {
  if (current !== a && !(a.state && a.state().playing)) hideGame(); // a different attraction: its own HUD, not the last one's
  current = a; const c = $('#card');
  c.querySelector('.ci').textContent = a.icon; c.querySelector('.cn').textContent = t(a.name); c.querySelector('.cz').textContent = t(a.zone); c.querySelector('.cd').textContent = t(a.desc);
  $('#cSpeed').value = a.speed ?? 1; out($('#cSpeed')); $('#cSeat span').textContent = `${t(a.seatName || 'Seat')} ${(a.seat ?? 0) + 1}`;
  c.classList.remove('hidden', 'pop-in'); void c.offsetWidth; c.classList.add('pop-in'); refreshCard(); renderList();
}
function refreshCard() {
  const a = current; if (!a) return; const ride = a.kind === 'ride', st = a.state ? a.state() : {};
  const pill = $('#card .cs'); pill.textContent = t(ride ? (a.running ? 'Running' : 'Paused') : st.playing ? 'In play' : 'Open'); pill.classList.toggle('off', ride && !a.running);
  $('#cRunRow').classList.toggle('hidden', !ride); $('#cRun span').textContent = t(a.running ? 'Stop' : 'Start'); $('#cRun').classList.toggle('stopped', !a.running);
  $('#cRide').classList.toggle('hidden', !a.rideCam || a.id === 'observatory'); $('#cSeat').classList.toggle('hidden', !a.cycleSeat);
  $('#cPlay').classList.toggle('hidden', !a.play); $('#cPlay span').textContent = t(a.playLabel || (a.id === 'fountain' ? 'Make a wish' : 'Play'));
  $('#cAlt').classList.toggle('hidden', !a.secondary); if (a.secondary) $('#cAlt span').textContent = t(a.secondary.label);
  const facts = [];
  if (a.best) facts.push(`${t('Best')}: ${a.best}${a.id === 'golf' ? ' ' + t('strokes') : ''}`);
  if (a.plays) facts.push(`${t('Played')} ×${a.plays}`);
  if (a.wishes) facts.push(`${t('Wishes made')}: ${a.wishes}`);
  if (st.total) facts.push(`${t('Found')}: ${st.found} / ${st.total}`);
  $('#card .cx').textContent = facts.join(' · ');
  const hunt = a.id === 'treasure'; $('#cHunt').classList.toggle('hidden', !hunt); $('#cHint').classList.toggle('hidden', !hunt);
  if (hunt) { $('#cHunt .bar i').style.width = (st.found / st.total * 100) + '%'; $('#cRiddle').textContent = st.hint ? '“' + t(st.hint) + '”' : t('Every heart found!'); $('#cHint').classList.toggle('hidden', !st.hint); }
  $$(`.att[data-id="${a.id}"] .dot`).forEach(d => { d.classList.toggle('on', !ride || a.running); d.classList.toggle('off', ride && !a.running); });
}
function hideCard() { $('#card').classList.add('hidden'); current = null; hideGame(); renderList(); }

/* ---------------- game HUD ---------------- */
function gameUpdate(a, extra = {}) {
  if (a !== current) return; const s = a.state(), g = $('#game'); g.classList.remove('hidden'); g.dataset.kind = a.id; document.body.classList.toggle('gaming', !!s.playing);
  document.body.classList.toggle('aiming', !!(s.playing && a.crosshair));
  $('#gTitle').textContent = t(HUD[a.id] || '');
  const dots = (n, max, on = '●', offc = '○') => `${on.repeat(Math.max(0, n))}<i>${offc.repeat(Math.max(0, max - n))}</i>`, stat = (k, v) => `<span>${esc(t(k))} <b>${v}</b></span>`;
  let html = '';
  if (a.id === 'ringToss') html = stat('Rings', dots(s.rings, 5)) + stat('Ringers', s.score);
  else if (a.id === 'claw') html = stat('Tries', dots(s.tries, 3, '♥', '♡'));
  else if (a.id === 'golf') html = stat('Strokes', s.strokes) + stat('Par', 3);
  else if (a.id === 'fishing' || a.id === 'bumper') html = stat('Time', s.time + 's') + stat(a.id === 'bumper' ? 'Bumps' : 'Points', s.score);
  else if (a.id === 'gallery') html = stat('Time', s.time + 's') + stat('Shots', s.shots) + stat('Points', s.score);
  else if (a.id === 'stage') html = stat('Score', Math.round(s.score)) + stat('Combo', s.combo);
  else if (a.id === 'observatory') html = stat('Constellations', `${s.found} / ${s.total}`);
  if (s.best && !s.playing) html += stat('Best', s.best);
  $('#gStats').innerHTML = html;
  $('#gPower').classList.toggle('hidden', !(s.playing && (a.id === 'ringToss' || a.id === 'golf')));
  $('#gPad').classList.toggle('hidden', !(a.id === 'claw' && s.playing));
  $('#gLanes').classList.toggle('hidden', !(a.id === 'stage' && s.playing)); $('#gJudge').classList.toggle('hidden', a.id !== 'stage');
  $('#gAgain').classList.toggle('hidden', !!s.playing || a.id === 'observatory'); $('#gAgain').textContent = t(a.id === 'stage' ? 'Dance again' : 'Play again');
  if (extra.result) { g.classList.remove('win', 'lose'); void g.offsetWidth; g.classList.add(extra.result); }
  refreshCard();
}
function hideGame() { $('#game').classList.add('hidden'); document.body.classList.remove('gaming', 'aiming'); }
function power(p) { $('#gPower i').style.width = Math.round(p * 100) + '%'; }
// rhythm lanes: notes fall toward the hit line; the judge flashes Perfect / Good / Miss
const laneEls = [];
function rhythm(s) {
  const box = $('#gLanes'); if (!laneEls.length) for (let i = 0; i < 4; i++) { const l = document.createElement('div'); l.className = 'lane'; l.innerHTML = `<span class="key">${['←', '↓', '↑', '→'][i]}</span>`; box.appendChild(l); laneEls.push(l); }
  laneEls.forEach(l => l.querySelectorAll('.note').forEach(n => n.remove()));
  for (const n of s.notes) { const dt = n.t - s.now; if (dt > 2.2 || dt < -0.3 || n.hit > 0) continue; const el = document.createElement('i'); el.className = 'note' + (n.hit < 0 ? ' miss' : ''); el.textContent = ['←', '↓', '↑', '→'][n.lane];
    el.style.top = `calc(${Math.max(0, 100 - dt / 2.2 * 100)}% - 34px)`; laneEls[n.lane].appendChild(el); }
  const j = $('#gJudge'); if (s.judge !== j.dataset.v) { j.dataset.v = s.judge; j.textContent = t(s.judge || ''); j.className = s.judge ? 'show ' + s.judge.replace(/\W/g, '').toLowerCase() : ''; }
  $('#gStats').innerHTML = `<span>${esc(t('Score'))} <b>${Math.round(s.score)}</b></span><span>${esc(t('Combo'))} <b>${s.combo}</b></span>`;
}

/* ---------------- ride view, photos ---------------- */
function rideView(on, a, hint) { $('#ridepill').classList.toggle('hidden', !on); if (on && a) { $('#rideName').textContent = `${a.icon} ${t(a.name)}`; $('#rideHint').textContent = hint ? ' · ' + t(hint) : ''; rideProgress(0); $('#rideBar').classList.toggle('hidden', a.id === 'bumper' || a.id === 'observatory'); } document.body.classList.toggle('riding', on); }
function rideStats(kmh, m) { const e = $('#rideStats'); if (e) e.textContent = `${Math.round(kmh)} km/h · ${Math.round(m)} m`; }
function rideProgress(k) { $('#rideBar em').style.width = `${Math.min(100, k * 100)}%`; }
function countdown(n) { const c = $('#countdown'); c.textContent = n; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); }
function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function photos(url) { $('#phImg').src = url; $('#phSave').href = url; $('#phSave').download = `sweetheart-park-${Date.now()}.png`; $('#photos').classList.remove('hidden'); }

function toast(title, body, icon = '♥') {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span class="th">${icon}</span><div><div class="tt"></div><div class="tb"></div></div>`; el.querySelector('.tt').textContent = tr(title); el.querySelector('.tb').textContent = tr(body);
  $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 4300); setTimeout(() => el.remove(), 4900); while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function caption(text) { const c = $('#caption'); if (!text) { c.classList.remove('show'); return; } c.innerHTML = `<small>${esc(t('Now showing'))}</small>${esc(t(text))}`; c.classList.add('show'); }

export { initUI, setLoad, loaded, setTimePill, setCamPill, setAttractions, renderList, markDiscovered, showCard, refreshCard, hideCard, gameUpdate, hideGame, power, rhythm, rideView, rideProgress, rideStats, countdown, flash, photos, toast, caption, discovered };
