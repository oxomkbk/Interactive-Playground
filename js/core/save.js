/* =========================================================================
   SAVE — visitor progress survives reloads: completed attractions, freed souls, collected candy,
   lit lanterns, banished-ghost count and the first-run flags. Autosaves every few seconds and on unload.
   (High scores and settings have their own stores: hollowmoor-scores / hollowmoor-settings.)
   ========================================================================= */
import { $ } from './utils.js';
import { S, UNLIT } from '../game/play.js';
import { SOULS } from '../world/atmosphere.js';
import { CANDY } from '../world/dressing.js';
import { updateCounters } from '../world/attractions.js';

const KEY = 'hollowmoor-save-v1';
const FLAGS = { onboarded: false, hintsSeen: {}, visits: 0, playSec: 0 };
function snapshot() {
  return { done: [...S.done], souls: SOULS.filter(s => s.got).map(s => s.i), candy: S.candy,
    candyGot: CANDY.list.map((c, i) => (c.got ? i : -1)).filter(i => i >= 0), lit: UNLIT.map((o, i) => (o.lit ? i : -1)).filter(i => i >= 0),
    ghosts: S.ghosts, smashed: S.smashed, flags: FLAGS, t: Date.now() };
}
let wiped = false;
function saveNow() { if (wiped) return; try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) {} }
function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
// call once the world is built
function loadSave() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (d) {
    (d.done || []).forEach(k => S.done.add(k));
    for (const i of d.souls || []) { const s = SOULS.find(x => x.i === i); if (s) { s.got = true; s.g.visible = false; } }
    S.souls = SOULS.filter(s => s.got).length; $('#soulCount').textContent = S.souls;
    for (const i of d.candyGot || []) { const c = CANDY.list[i]; if (c) { c.got = true; c.k = 0.0001; if (CANDY.sp) CANDY.sp.size[i] = 0; } }
    S.candyPick = (d.candyGot || []).length; S.candy = d.candy || 0;
    for (const i of d.lit || []) { const o = UNLIT[i]; if (o) o.lit = true; } S.lit = (d.lit || []).length;
    S.ghosts = d.ghosts || 0; S.smashed = d.smashed || 0; Object.assign(FLAGS, d.flags || {});
    if (CANDY.sp) CANDY.sp.flag(); updateCounters();
  }
  FLAGS.visits++;
  setInterval(() => { if (S.mode !== 'title') { FLAGS.playSec += 5; saveNow(); } }, 5000);
  addEventListener('pagehide', saveNow); document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  return !!d;
}
function resetProgress() { wiped = true; try { localStorage.removeItem(KEY); localStorage.removeItem('hollowmoor-scores'); } catch (e) {} location.reload(); }

export { FLAGS, saveNow, loadSave, hasSave, resetProgress };
