/* =========================================================================
   PROGRESS — quests, achievements and collectibles, fed by events from the rest of the park:
   emit('zone', name) · ('discover', id) · ('ride', id, cat) · ('play', id) · ('win', id) · ('heart', n)
   ('letter', n) · ('wish') · ('photo') · ('firework') · ('night') · ('walk', metres) · ('outfit')
   Quests run as a short story (three visible at a time); achievements unlock once each. Romance points
   (♥) are earned along the way and raise your level. Everything is saved in localStorage.
   ========================================================================= */
const KEY = 'sweetheart-progress';
const QUESTS = [
  { id: 'enter', title: 'Step through the gate', desc: 'Walk through the Sweetheart Gate into the park.', test: (s) => s.zones.has('Sweetheart Boulevard') || s.zones.has('Fountain Plaza'), pts: 10 },
  { id: 'fountain', title: 'Make a wish', desc: 'Walk up to the Wishing Fountain, press E and toss a coin.', test: (s) => s.wishes > 0, pts: 15 },
  { id: 'wheel', title: 'Up among the clouds', desc: 'Ride the Ferris Wheel in ride view.', test: (s) => s.rides.has('ferris'), pts: 20 },
  { id: 'hearts3', title: 'A trail of gold', desc: 'Find 3 golden hearts hidden around the park.', test: (s) => s.hearts >= 3, prog: (s) => [s.hearts, 3], pts: 25 },
  { id: 'prize', title: 'Win a prize', desc: 'Win any carnival game.', test: (s) => s.wins.size > 0, pts: 25 },
  { id: 'letters', title: 'Letters from a secret admirer', desc: 'Find 4 love letters tucked into quiet corners.', test: (s) => s.letters >= 4, prog: (s) => [s.letters, 4], pts: 30 },
  { id: 'castle', title: 'The castle on the hill', desc: 'Climb the path north of the plaza to the Castle Terrace.', test: (s) => s.zones.has('Castle Terrace'), pts: 20 },
  { id: 'thrills', title: 'Brave heart', desc: 'Ride 3 thrill rides.', test: (s) => [...s.rides].filter(id => s.cats[id] === 'thrills').length >= 3, prog: (s) => [[...s.rides].filter(id => s.cats[id] === 'thrills').length, 3], pts: 30 },
  { id: 'photo', title: 'A keepsake', desc: 'Take a photo strip at the Photo Booth.', test: (s) => s.photos > 0, pts: 15 },
  { id: 'meteor', title: 'Wish upon a star', desc: 'Look up during a meteor shower (they come every couple of minutes).', test: (s) => s.meteors > 0, pts: 20 },
  { id: 'fireworks', title: 'Light up the sky', desc: 'Launch 10 fireworks (press F, or click the sky).', test: (s) => s.fireworks >= 10, prog: (s) => [s.fireworks, 10], pts: 20 },
  { id: 'maze', title: 'Lost in the roses', desc: 'Find the golden rose at the heart of the Rose Hedge Maze.', test: (s) => s.maze, pts: 25 },
  { id: 'show', title: 'Showtime', desc: 'Catch a park event — fountains, fireworks, a light show or a petal shower.', test: (s) => s.events >= 1, pts: 15 },
  { id: 'lookout', title: 'Fireworks for two', desc: "Watch the fireworks from Lovers' Lookout on the castle terrace.", test: (s) => s.watched, pts: 30 },
  { id: 'all', title: 'Every corner', desc: 'Discover every attraction in the park.', test: (s) => s.found.size >= s.total, prog: (s) => [s.found.size, s.total], pts: 60 },
];
const ACHIEVEMENTS = [
  { id: 'steps', icon: '👣', title: 'First steps', desc: 'Walk 100 metres.', test: (s) => s.walked >= 100 },
  { id: 'wanderer', icon: '🧭', title: 'Wanderer', desc: 'Walk 2 kilometres.', test: (s) => s.walked >= 2000 },
  { id: 'explorer', icon: '🗺️', title: 'Explorer', desc: 'Discover 10 attractions.', test: (s) => s.found.size >= 10 },
  { id: 'cartographer', icon: '🏆', title: 'Cartographer', desc: 'Discover every attraction.', test: (s) => s.found.size >= s.total },
  { id: 'rider', icon: '🎡', title: 'Joyrider', desc: 'Ride 5 different rides.', test: (s) => s.rides.size >= 5 },
  { id: 'gamer', icon: '🎯', title: 'Carnival regular', desc: 'Play 5 different games.', test: (s) => s.played.size >= 5 },
  { id: 'champion', icon: '🧸', title: 'Champion', desc: 'Win 3 different games.', test: (s) => s.wins.size >= 3 },
  { id: 'goldheart', icon: '💛', title: 'Heart of gold', desc: 'Find all 12 golden hearts.', test: (s) => s.hearts >= 12 },
  { id: 'romantic', icon: '💌', title: 'Hopeless romantic', desc: 'Read all 8 love letters.', test: (s) => s.letters >= 8 },
  { id: 'wishes', icon: '🪙', title: 'Wishful', desc: 'Make 5 wishes.', test: (s) => s.wishes >= 5 },
  { id: 'owl', icon: '🌙', title: 'Night owl', desc: 'See the park at night.', test: (s) => s.night },
  { id: 'royal', icon: '🏰', title: 'Royal visit', desc: 'Reach the Castle Terrace.', test: (s) => s.zones.has('Castle Terrace') },
  { id: 'bridge', icon: '🌉', title: 'Moon bridge', desc: 'Cross the moon bridge in the Fantasy Garden.', test: (s) => s.bridge },
  { id: 'stylish', icon: '👗', title: 'Dressed for the day', desc: 'Change your outfit.', test: (s) => s.outfit },
  { id: 'pyro', icon: '🎆', title: 'Sky painter', desc: 'Launch 50 fireworks.', test: (s) => s.fireworks >= 50 },
  { id: 'mazerun', icon: '🌹', title: 'Maze runner', desc: 'Reach the heart of the maze in under 45 seconds.', test: (s) => s.mazeBest > 0 && s.mazeBest < 45 },
  { id: 'fan', icon: '🎭', title: 'Regular at the shows', desc: 'See 5 park events.', test: (s) => s.events >= 5 },
  { id: 'sweet', icon: '🧁', title: 'Sweet tooth', desc: 'Order 3 treats at the Rose Café.', test: (s) => s.treats >= 3 },
];

// daily challenges: three a day, chosen by the date, counted from what you actually do
const DAILY = [
  { id: 'rides3', title: 'Ride 3 different rides', key: 'rides', n: 3 }, { id: 'games2', title: 'Play 2 different games', key: 'games', n: 2 },
  { id: 'letter1', title: 'Find a love letter', key: 'letter', n: 1 }, { id: 'meteor1', title: 'See a meteor shower', key: 'meteors', n: 1 },
  { id: 'walk1k', title: 'Walk 1 kilometre', key: 'walk', n: 1000 }, { id: 'treat1', title: 'Treat yourself at the café or bistro', key: 'treat', n: 1 },
  { id: 'event2', title: 'Catch 2 park events', key: 'event', n: 2 }, { id: 'guide1', title: 'Follow the lights to an attraction', key: 'arrive', n: 1 },
  { id: 'fw5', title: 'Launch 5 fireworks', key: 'firework', n: 5 }, { id: 'wish1', title: 'Make a wish at the fountain', key: 'wish', n: 1 },
];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const pickDaily = (key) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const pool = DAILY.slice(), out = []; while (out.length < 3) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); } return out; };

function createProgress({ total, onQuest, onAchievement, onChange, onDaily }) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const S = { zones: new Set(saved.zones || []), found: new Set(saved.found || []), rides: new Set(saved.rides || []), played: new Set(saved.played || []), wins: new Set(saved.wins || []),
    cats: saved.cats || {}, hearts: saved.hearts || 0, letters: saved.letters || 0, wishes: saved.wishes || 0, photos: saved.photos || 0, fireworks: saved.fireworks || 0,
    night: !!saved.night, watched: !!saved.watched, meteors: saved.meteors || 0, maze: !!saved.maze, mazeBest: saved.mazeBest || 0, events: saved.events || 0, treats: saved.treats || 0, bridge: !!saved.bridge, outfit: !!saved.outfit, walked: saved.walked || 0, points: saved.points || 0,
    quests: new Set(saved.quests || []), ach: new Set(saved.ach || []), total };
  const day = today(); S.daily = saved.daily && saved.daily.date === day ? { ...saved.daily, rides: new Set(saved.daily.rides || []), games: new Set(saved.daily.games || []) } : { date: day, rides: new Set(), games: new Set(), c: {}, done: [] };
  const dailyCount = (d) => (d.key === 'rides' ? S.daily.rides.size : d.key === 'games' ? S.daily.games.size : S.daily.c[d.key] || 0);
  function trackDaily(type, a) {
    if (type === 'ride') S.daily.rides.add(a); else if (type === 'play') S.daily.games.add(a); else if (type === 'walk') S.daily.c.walk = (S.daily.c.walk || 0) + a; else S.daily.c[type] = (S.daily.c[type] || 0) + 1;
    for (const d of pickDaily(day)) if (!S.daily.done.includes(d.id) && dailyCount(d) >= d.n) { S.daily.done.push(d.id); S.points += 30; onDaily && onDaily(d); }
  }
  let dirty = false, saveT = 0;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...S, daily: { ...S.daily, rides: [...S.daily.rides], games: [...S.daily.games] }, zones: [...S.zones], found: [...S.found], rides: [...S.rides], played: [...S.played], wins: [...S.wins], quests: [...S.quests], ach: [...S.ach], total: undefined })); } catch (e) {} };
  function check() {
    for (const q of QUESTS) if (!S.quests.has(q.id) && q.test(S)) { S.quests.add(q.id); S.points += q.pts; onQuest && onQuest(q); }
    for (const a of ACHIEVEMENTS) if (!S.ach.has(a.id) && a.test(S)) { S.ach.add(a.id); S.points += 20; onAchievement && onAchievement(a); }
    dirty = true; onChange && onChange();
  }
  const api = {
    S, QUESTS, ACHIEVEMENTS,
    emit(type, a, b) {
      if (['ride', 'play', 'letter', 'meteors', 'walk', 'treat', 'event', 'arrive', 'firework', 'wish'].includes(type)) trackDaily(type, a);
      switch (type) {
        case 'zone': if (S.zones.has(a)) return; S.zones.add(a); break;
        case 'discover': if (S.found.has(a)) return; S.found.add(a); break;
        case 'ride': S.rides.add(a); if (b) S.cats[a] = b; break;
        case 'play': S.played.add(a); break;
        case 'win': S.wins.add(a); S.points += 10; break;
        case 'heart': S.hearts = Math.max(S.hearts, a); break;
        case 'letter': S.letters = Math.max(S.letters, a); break;
        case 'wish': S.wishes++; break;
        case 'photo': S.photos++; break;
        case 'firework': S.fireworks++; break;
        case 'night': if (S.night) return; S.night = true; break;
        case 'bridge': if (S.bridge) return; S.bridge = true; break;
        case 'outfit': S.outfit = true; break;
        case 'treat': S.treats++; break;
        case 'watch': S.watched = true; break;
        case 'maze': S.maze = true; S.mazeBest = S.mazeBest ? Math.min(S.mazeBest, a) : a; break;
        case 'event': S.events++; break;
        case 'meteors': S.meteors++; break;
        case 'walk': S.walked += a; if (Math.floor(S.walked / 25) === Math.floor((S.walked - a) / 25)) { dirty = true; return; } break;
      }
      check();
    },
    daily: () => pickDaily(day).map(d => ({ ...d, have: Math.min(d.n, dailyCount(d)), done: S.daily.done.includes(d.id) })),
    active: () => QUESTS.filter(q => !S.quests.has(q.id)).slice(0, 3),
    level: () => { const lv = Math.floor(Math.sqrt(S.points / 40)) + 1, lo = (lv - 1) ** 2 * 40, hi = lv ** 2 * 40; return { lv, k: (S.points - lo) / (hi - lo) }; },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); },
    tick(dt) { if (dirty && (saveT += dt) > 2) { saveT = 0; dirty = false; save(); } },
  };
  setTimeout(check, 0);
  return api;
}

export { createProgress, QUESTS, ACHIEVEMENTS };
