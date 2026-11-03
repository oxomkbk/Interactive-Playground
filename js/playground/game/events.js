/* =========================================================================
   EVENTS — the park's schedule. Every few minutes something happens, chosen to suit the hour:
   the Musical Fountains' show, fireworks over the castle, the Moonlight Stage light show, a sky-lantern release
   from the plaza, a lantern parade around the promenade, a meteor shower. Each is announced 20 seconds ahead in the HUD
   with where to go; visitors drift over and gather; the event can also be started from the Command Center.
   Seeing events counts toward an achievement.
   ========================================================================= */
const EVENTS = {
  fountains: { name: 'Musical fountain show', where: 'the Musical Fountains, Sweetheart Boulevard', icon: '⛲', when: () => true },
  fireworks: { name: 'Fireworks over the castle', where: 'the plaza or the castle terrace', icon: '🎆', when: (n) => n > 0.25 },
  lights: { name: 'Light show at the Moonlight Stage', where: 'the Festival District', icon: '💡', when: (n) => n > 0.2 },
  lanterns: { name: 'Sky lantern release', where: 'Fountain Plaza', icon: '🏮', when: () => true },
  parade: { name: 'Lantern parade', where: 'the Promenade around the plaza', icon: '🎎', when: () => true },
  meteors: { name: 'Meteor shower', where: 'the sky — find a dark spot and look up', icon: '☄️', when: () => true },
};

function createEvents({ run, announce, nightness, every = 150 }) {
  const S = { t: every * 0.45, pending: null, lead: 0, last: null };
  function schedule(id, lead = 20) { const e = EVENTS[id]; if (!e) return; S.pending = id; S.lead = lead; announce(e, lead); }
  return {
    S, EVENTS,
    trigger: (id) => { S.pending = null; run(id); S.t = every; },          // start right now (Command Center)
    schedule,
    update(dt) {
      if (S.pending) { S.lead -= dt; if (S.lead <= 0) { const id = S.pending; S.pending = null; S.last = id; run(id); S.t = every; } return; }
      if ((S.t -= dt) > 0) return;
      const n = nightness(), opts = Object.keys(EVENTS).filter(k => EVENTS[k].when(n) && k !== S.last);
      schedule(opts[Math.floor(Math.random() * opts.length)] || 'fountains');
    },
  };
}

export { createEvents, EVENTS };
