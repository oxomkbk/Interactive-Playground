/* =========================================================================
   SESSION — the attraction lifecycle as one explicit state machine, so you can never get stuck:

     explore ──E──▶ entering ──(camera reaches the seat)──▶ riding ──(lap ends · Esc · E)──▶ exiting ──▶ explore
        │                                                                                     ▲
        ├──E──▶ playing (games: the attraction's own controls; Play again / Exit)  ───────────┤
        ├──E──▶ viewing (an info console, the Lookout bench) ─────────────────────────────────┤
        └──C──▶ cinematic / tour ─────────────────────────────────────────────────────────────┘

   Only the transitions in ALLOWED can happen; anything else is refused (and logged). Entering and exiting each
   have a watchdog, so a camera flight that never reports back can't trap you. Exiting always puts you back on
   your feet at a safe spot in front of the attraction (outside its footprint, inside the park), visible, with
   movement, mouse look and the walk-up prompt restored.
   Rides run for a lap (RIDE_TIME seconds, shown as a progress bar) and then let you off by themselves.
   ========================================================================= */
const ALLOWED = {
  explore: ['entering', 'playing', 'viewing', 'cinematic', 'tour'],
  entering: ['riding', 'exiting'],
  riding: ['exiting'],
  playing: ['riding', 'exiting'],
  viewing: ['entering', 'playing', 'exiting'],
  exiting: ['explore'],
  cinematic: ['exiting', 'explore'], tour: ['exiting', 'explore'],
};
const RIDE_TIME = { ferris: 80, carousel: 50, teacups: 45, swings: 45, balloons: 60, train: 75, swans: 60, coaster: 55, drop: 40, pirate: 45, bumper: 60, observatory: 0, fountainShow: 0 };
// on-ride photos: what to watch for and how big it has to get (speed in km/h or height in m), per ride
const PHOTO = { coaster: ['speed', 38], drop: ['height', 24], ferris: ['height', 24], swings: ['speed', 22], pirate: ['height', 12], balloons: ['height', 10], teacups: ['speed', 8], carousel: ['speed', 6], train: ['speed', 12], swans: ['speed', 2] };
const HINTS = { teacups: 'Space to spin your cup', ferris: 'Tab for another gondola', bumper: 'W A S D to drive — bump everyone!', observatory: 'Drag to sweep the sky' };

function createSession(d) {
  const S = { state: 'boot', a: null, t: 0, left: 0, total: 0, cool: 0, stargazePrev: null, listeners: [] };
  const log = (...m) => console.info('[session]', ...m);
  function go(to) {
    const from = S.state;
    if (from !== 'boot' && !(ALLOWED[from] || []).includes(to)) { console.warn(`[session] refused ${from} → ${to}`); return false; }
    S.state = to; S.t = 0; document.body.dataset.session = to; for (const f of S.listeners) f(to, from, S.a); return true;
  }
  const busy = () => S.cool > 0 || S.state === 'entering' || S.state === 'exiting';

  // ---------- entry points ----------
  // E in front of an attraction: do the thing it's for
  function experience(a) {
    if ((S.state !== 'explore' && S.state !== 'viewing') || busy() || !a) return;
    d.initAudio(); d.discover(a);
    if (a.id === 'fountain') { a.onPick({}); d.progress.emit('wish'); d.UI.toast('A coin for luck', 'Your wish is safe with the fountain.', '🪙'); return; }
    if (a.id === 'cafe' || a.id === 'bistro') { a.play(); return; }
    if (a.id === 'lookout') return S.state === 'viewing' ? a.play() : view(a, { watch: true });
    if (a.id === 'fountainShow') { if (S.state === 'viewing') return a.play(); view(a, { watch: true }); d.director.setMode('focus', { focus: a.focus, still: true }); return; }
    if (a.id === 'observatory') return stargaze(a);
    if (a.id === 'bumper') return playGame(a, { drive: true });
    if (a.rideCam && a.kind === 'ride') return board(a);
    if (a.play && (a.kind === 'game' || a.id === 'photo' || a.id === 'swans' || a.startShow)) return a.id === 'swans' ? board(a) : playGame(a);
    return view(a);
  }
  // board a ride: the camera flies to the seat, the lap timer starts when you're in
  function board(a) {
    if (!a.rideCam || !go('entering')) return;
    S.a = a; d.player.suspend(); d.hero.object3D.visible = false; a.setRunning && !a.running && a.setRunning(true);
    d.UI.hideCard(); d.director.setMode('ride', { ride: a }); d.UI.rideView(true, a, HINTS[a.id]); d.SFX.ride && d.SFX.ride();
    S.total = S.left = RIDE_TIME[a.id] ?? 50; d.progress.emit('ride', a.id, a.cat); S.tele = { last: null, v: 0, metric: 0, rising: false, shot: false }; d.audio && d.audio.ride(a.id, true); log('board', a.id);
  }
  function playGame(a, { drive = false } = {}) {
    if (!go('playing')) return;
    S.a = a; d.player.suspend(); d.player.unlock(); d.UI.showCard(a); d.progress.emit('play', a.id);
    if (a.id === 'photo') { d.director.setMode('free'); d.UI.hideGame(); document.body.classList.add('shooting');
      a.play().then(() => { document.body.classList.remove('shooting'); d.progress.emit('photo'); if (S.a === a && S.state === 'playing') exit(); }); return; }
    a.play();
    if (drive) { go('riding'); d.hero.object3D.visible = false; d.director.setMode('ride', { ride: a }); d.UI.rideView(true, a, HINTS[a.id]); S.total = S.left = 0; d.progress.emit('ride', a.id, a.cat); d.player.lock(); return; }
    d.director.setMode('focus', { focus: a.focus, still: true }); log('play', a.id);
  }
  function view(a, { watch = false } = {}) {
    if (!go('viewing')) return;
    S.a = a; d.player.suspend(); d.player.unlock();
    if (watch) { a.play(); return; }
    d.UI.showCard(a); d.director.setMode('focus', { focus: d.focusOf(a) });
  }
  // stargazing: night falls, the eyepiece view; leaving restores the sky you had
  function stargaze(obs) {
    if (!go('playing')) return; S.a = obs; d.player.suspend(); d.UI.showCard(obs); d.progress.emit('play', obs.id);
    S.stargazePrev = d.timeName(); d.setTime('night'); obs.play();
    go('riding'); d.hero.object3D.visible = false; d.director.setMode('ride', { ride: obs }); d.UI.rideView(true, obs, HINTS.observatory); S.total = S.left = 0; d.player.lock();
  }

  // ---------- leaving, from anywhere ----------
  function exit(reason = 'exit') {
    if (S.state === 'explore' || S.state === 'exiting' || S.state === 'boot') return;
    const a = S.a; if (!go('exiting')) return;
    if (a) { if (a.state && a.state().playing && a.stop) a.stop(); d.audio && d.audio.ride(a.id, false); }
    if (S.stargazePrev) { d.setTime(S.stargazePrev); S.stargazePrev = null; }
    d.UI.rideView(false); d.UI.hideGame(); d.UI.hideCard(); document.body.classList.remove('shooting', 'cinematic');
    // back on your feet, in front of the attraction if you were on it
    if (a && (reason === 'complete' || d.hero.object3D.visible === false)) { const sp = d.walk.standPoint(a); if (sp) d.player.teleport(sp.x, sp.z, sp.yaw); }
    d.hero.object3D.visible = true; d.director.setMode('player'); d.player.resume(d.director.controls.target.clone());
    if (reason === 'complete' && a) d.UI.toast('Thanks for riding!', a.name, a.icon);
    S.a = null; S.cool = 0.5; log('exit', a && a.id, reason);
    go('explore');
  }
  function toCinematic() { if (S.state !== 'explore' || !go('cinematic')) return false; d.player.suspend(); d.player.unlock(); return true; }
  function toTour() { if (S.state !== 'explore') exit(); if (!go('tour')) return false; d.player.suspend(); d.player.unlock(); return true; }

  // ---------- keys while on an attraction ----------
  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (S.state === 'riding' || S.state === 'entering') {
      if (e.code === 'KeyE' || e.code === 'Escape') { e.stopImmediatePropagation(); exit(); }
      else if (e.code === 'Tab' && S.a && S.a.cycleSeat) { e.preventDefault(); e.stopImmediatePropagation(); const n = S.a.cycleSeat(); d.UI.toast(`${S.a.seatName || 'Seat'} ${n}`, '', S.a.icon); }
      else if (e.code === 'Space' && S.a && S.a.id === 'teacups') { e.preventDefault(); e.stopImmediatePropagation(); S.a.onPick({ obj: { userData: { cup: 0 } } }); d.SFX.whir && d.SFX.whir(); }
    } else if ((S.state === 'viewing' || S.state === 'cinematic' || S.state === 'tour') && (e.code === 'KeyE' || e.code === 'Escape' || (e.code === 'KeyC' && S.state === 'cinematic'))) { e.stopImmediatePropagation(); exit(); }
    else if (S.state === 'playing' && e.code === 'Escape') { e.stopImmediatePropagation(); exit(); }
  }, true);

  return {
    S, go, experience, board, playGame, view, stargaze, exit, toCinematic, toTour, onChange: (f) => S.listeners.push(f),
    get state() { return S.state; }, get a() { return S.a; },
    start() { S.state = 'boot'; go('explore'); },
    update(dt) {
      S.t += dt; S.cool = Math.max(0, S.cool - dt);
      if (S.state === 'entering' && (!d.director.S.flight || S.t > 5)) { go('riding'); d.player.lock(); }   // in the seat (or the watchdog says so)
      if (S.state === 'riding' && S.total > 0) { S.left -= dt; d.UI.rideProgress(1 - S.left / S.total); if (S.left <= 0) exit('complete'); }
      // live telemetry, and a photo at the ride's best moment (a peak in speed or height past its threshold)
      if (S.state === 'riding' && S.tele && dt > 0) { const T = S.tele, cp = d.camera.position;
        if (T.last) { const v = T.last.distanceTo(cp) / dt * 3.6; T.v += (v - T.v) * Math.min(1, dt * 4); } T.last = (T.last || cp.clone()).copy(cp);
        const height = Math.max(0, cp.y - d.walk.groundAt(cp.x, cp.z)); d.UI.rideStats(T.v, height);
        const P = PHOTO[S.a.id]; if (P && !T.shot && S.t > 3) { const m = P[0] === 'speed' ? T.v : height;
          if (m > P[1] && m < T.metric - (P[0] === 'speed' ? 1.5 : 0.25) && T.rising) { T.shot = true; d.ridePhoto && d.ridePhoto(S.a); }
          T.rising = m >= T.metric ? true : T.rising; if (m > T.metric) T.metric = m; } }
      if (S.state === 'exiting' && S.t > 3) go('explore');
      if ((S.state === 'riding' || S.state === 'entering') && d.director.S.mode !== 'ride') exit();      // something else took the camera
    },
  };
}

export { createSession, RIDE_TIME };
