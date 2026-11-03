/* =========================================================================
   HUD — the explorer's screen: player card (level, ♥ points, stamina, collectibles), location banner,
   rotating minimap with attraction icons and a compass, quest tracker, the walk-up interaction prompt,
   control hints, the full park map (M — click an attraction to travel there), the progress page of the
   Command Center (quests, achievements) and love-letter reader. DOM lives in playground.html.
   ========================================================================= */
import { CONFIG } from '../config.js';
import { t, onLang } from '../i18n.js';

const L = CONFIG.layout, $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// world → map canvas: x ∈ [-112, 112], z ∈ [-176, 122]
const MX0 = -112, MZ0 = -176, MW = 224, MD = 298, PX = 4;

function zoneAt(x, z, atts) {
  const r = Math.hypot(x, z), cf = L.castle.z + 9;
  if (z < cf + 32 && z > cf - 2 && r > L.parkRadius - 4) return 'Castle Terrace';
  if (z < -L.parkRadius + 6 && Math.abs(x) < 6) return 'Castle Hill Path';
  if (z > L.gate.z - 5) return 'Sweetheart Gate';
  if (r < L.plaza.r + 1) return 'Fountain Plaza';
  if (Math.abs(x) < 7 && z > L.plaza.r) return 'Sweetheart Boulevard';
  if (Math.hypot(x - L.garden.x, z - L.garden.z) < 20) return 'Fantasy Garden';
  let best = null, bd = 15; for (const a of atts) { if (!a.zone || a.id === 'treasure' || a.id === 'train' || a.id === 'swans') continue; const p = a.object3D.position, d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = a; } }
  if (best) return best.zone;
  if (Math.abs(r - L.ringPath.r) < 4) return 'Promenade';
  return 'Blossom Meadows';
}

function createHUD({ world, atts, progress, onTravel }) {
  // ---------- base map, painted once ----------
  const base = document.createElement('canvas'); base.width = MW * PX; base.height = MD * PX;
  const g = base.getContext('2d'), W = (x) => (x - MX0) * PX, Z = (z) => (z - MZ0) * PX;
  g.fillStyle = '#2E3B33'; g.fillRect(0, 0, base.width, base.height);
  g.fillStyle = '#5F7F5A'; g.beginPath(); g.arc(W(0), Z(0), L.parkRadius * PX, 0, 7); g.fill();
  g.fillStyle = '#56744F'; g.beginPath(); g.ellipse(W(0), Z(L.castle.z + 22), 27 * PX, 20 * PX, 0, 0, 7); g.fill();
  g.strokeStyle = '#3F5A3E'; g.lineWidth = 2.4 * PX; g.beginPath(); g.arc(W(0), Z(0), L.parkRadius, 0, 7); g.stroke();
  const pave = '#D9CBB8';
  g.fillStyle = pave; g.strokeStyle = pave;
  g.lineWidth = L.ringPath.w * PX; g.beginPath(); g.arc(W(0), Z(0), L.ringPath.r * PX, 0, 7); g.stroke();
  g.beginPath(); g.arc(W(0), Z(0), (L.plaza.r + 0.8) * PX, 0, 7); g.fill();
  g.fillRect(W(-L.boulevard.w / 2), Z(L.boulevard.z0), L.boulevard.w * PX, (L.boulevard.z1 + 14 - L.boulevard.z0) * PX);
  g.fillRect(W(-3), Z(L.castle.z + 9), 6 * PX, (-(L.castle.z + 9) - L.ringPath.r) * PX);
  g.lineWidth = 3.2 * PX; for (const id of ['ferris', 'carousel', 'teacups', 'swings', 'balloons', 'pirate', 'drop', 'ringToss', 'claw', 'stage', 'observatory', 'fishing', 'gallery']) { const [x, z] = L[id], d = Math.hypot(x, z); g.beginPath(); g.moveTo(W(x / d * L.ringPath.r), Z(z / d * L.ringPath.r)); g.lineTo(W(x), Z(z)); g.stroke(); }
  g.strokeStyle = 'rgba(120,90,70,.6)'; g.lineWidth = 1.2 * PX; g.setLineDash([2 * PX, 2 * PX]); g.beginPath(); g.arc(W(0), Z(0), L.trainRadius * PX, 0, 7); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#6FA7B8'; g.beginPath(); g.ellipse(W(L.garden.x), Z(L.garden.z), 10 * PX, 6.5 * PX, 0, 0, 7); g.fill();
  g.fillStyle = '#C9A06A'; g.fillRect(W(L.garden.x - 1.1), Z(L.garden.z - 8.5), 2.2 * PX, 17 * PX);
  g.fillStyle = 'rgba(244,234,220,.85)';
  for (const s of world.shapes) { if (s.tag === 'tree' || s.tag === 'soft' || s.tag === 'pond') continue;
    g.fillStyle = s.tag === 'castle' ? '#E9D9E6' : s.tag === 'shop' ? '#F2C9C9' : s.tag === 'gate' ? '#E9D9E6' : 'rgba(250,240,228,.55)';
    if (s.type === 'circle') { g.beginPath(); g.arc(W(s.x), Z(s.z), s.r * PX, 0, 7); g.fill(); }
    else { g.save(); g.translate(W(s.x), Z(s.z)); g.rotate(-Math.atan2(s.s, s.c)); g.fillRect(-s.hw * PX, -s.hd * PX, s.hw * 2 * PX, s.hd * 2 * PX); g.restore(); } }
  g.fillStyle = 'rgba(40,70,40,.55)'; for (const s of world.shapes) if (s.tag === 'tree') { g.beginPath(); g.arc(W(s.x), Z(s.z), 1.6 * PX, 0, 7); g.fill(); }

  // ---------- minimap ----------
  const mm = $('#minimap canvas'), mg = mm.getContext('2d'), R = mm.width / 2, VIEW = 42, sc = R / VIEW;
  const icons = atts.filter(a => !['treasure', 'train'].includes(a.id)).map(a => ({ a, x: a.object3D.position.x, z: a.object3D.position.z }));
  function drawMini(px, pz, camYaw, faceYaw) {
    mg.clearRect(0, 0, mm.width, mm.height); mg.save(); mg.beginPath(); mg.arc(R, R, R - 2, 0, 7); mg.clip();
    mg.translate(R, R); mg.rotate(camYaw); mg.drawImage(base, -W(px) * sc / PX, -Z(pz) * sc / PX, base.width * sc / PX, base.height * sc / PX); mg.setTransform(1, 0, 0, 1, 0, 0);
    const c = Math.cos(camYaw), s = Math.sin(camYaw), toS = (x, z) => { const dx = (x - px) * sc, dz = (z - pz) * sc; return [R + dx * c - dz * s, R + dx * s + dz * c]; };
    mg.font = '15px system-ui'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
    for (const ic of icons) { const [x, y] = toS(ic.x, ic.z); if ((x - R) ** 2 + (y - R) ** 2 > (R - 10) ** 2) continue; const seen = progress.S.found.has(ic.a.id);
      mg.fillStyle = seen ? 'rgba(255,248,240,.9)' : 'rgba(40,30,50,.55)'; mg.beginPath(); mg.arc(x, y, 10, 0, 7); mg.fill(); mg.globalAlpha = seen ? 1 : 0.6; mg.fillText(seen ? ic.a.icon : '?', x, y + 1); mg.globalAlpha = 1; }
    // player arrow
    const fa = faceYaw, ax = Math.sin(fa), az = Math.cos(fa), sx = ax * c - az * s, sy = ax * s + az * c;
    mg.save(); mg.translate(R, R); mg.rotate(Math.atan2(sy, sx) + Math.PI / 2); mg.fillStyle = '#FFD68A'; mg.strokeStyle = '#3A2238'; mg.lineWidth = 2;
    mg.beginPath(); mg.moveTo(0, -9); mg.lineTo(6.5, 7); mg.lineTo(0, 3.5); mg.lineTo(-6.5, 7); mg.closePath(); mg.fill(); mg.stroke(); mg.restore();
    mg.restore();
    // compass N on the rim
    const nx = R + (-0 * c - (-1) * s) * (R - 12), ny = R + (0 * s + (-1) * c) * (R - 12);
    mg.fillStyle = '#FFD68A'; mg.font = '700 12px Quicksand, system-ui'; mg.fillText('N', nx, ny);
  }

  // ---------- full map (M) ----------
  const big = $('#bigmap'), bc = $('#bigmap canvas'), bg = bc.getContext('2d'); let bigOn = false, bigHits = [];
  function drawBig(px, pz, faceYaw) {
    const w = bc.clientWidth, h = bc.clientHeight; bc.width = w * devicePixelRatio; bc.height = h * devicePixelRatio; bg.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const k = Math.min(w / base.width, h / base.height), ox = (w - base.width * k) / 2, oy = (h - base.height * k) / 2;
    bg.clearRect(0, 0, w, h); bg.drawImage(base, ox, oy, base.width * k, base.height * k);
    const S = (x, z) => [ox + W(x) * k, oy + Z(z) * k]; bigHits = [];
    bg.textAlign = 'center'; bg.textBaseline = 'middle';
    for (const ic of icons) { const [x, y] = S(ic.x, ic.z), seen = progress.S.found.has(ic.a.id); bg.fillStyle = seen ? 'rgba(255,248,240,.95)' : 'rgba(40,30,50,.6)'; bg.beginPath(); bg.arc(x, y, 14, 0, 7); bg.fill();
      bg.font = '17px system-ui'; bg.fillText(seen ? ic.a.icon : '?', x, y + 1); bg.font = '600 11px Quicksand, system-ui'; bg.fillStyle = '#FFF4EA'; bg.fillText(seen ? t(ic.a.name) : '???', x, y + 24); bigHits.push({ x, y, a: ic.a }); }
    for (const [name, x, z] of [['Sweetheart Gate', 0, L.gate.z + 8], ['Castle Terrace', 0, L.castle.z + 24], ['Fantasy Garden', L.garden.x, L.garden.z + 12], ['Fountain Plaza', 0, 8]]) { const [sx, sy] = S(x, z); bg.font = 'italic 600 14px "Cormorant Garamond", serif'; bg.fillStyle = 'rgba(255,236,214,.95)'; bg.fillText(t(name), sx, sy); }
    const [x, y] = S(px, pz); bg.save(); bg.translate(x, y); bg.rotate(-faceYaw); bg.fillStyle = '#FFD68A'; bg.strokeStyle = '#3A2238'; bg.lineWidth = 2; bg.beginPath(); bg.moveTo(0, 11); bg.lineTo(8, -8); bg.lineTo(0, -4); bg.lineTo(-8, -8); bg.closePath(); bg.fill(); bg.stroke(); bg.restore();
  }
  bc.addEventListener('click', (e) => { const r = bc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; const h = bigHits.find(b => (b.x - x) ** 2 + (b.y - y) ** 2 < 18 * 18); if (h) { toggleMap(false); onTravel && onTravel(h.a); } });
  $('#bigmap .x').addEventListener('click', () => toggleMap(false));
  function toggleMap(on = !bigOn) { bigOn = on; big.classList.toggle('hidden', !on); }

  // ---------- panels ----------
  let zone = '', zoneT = 0;
  function setZone(z) { if (z === zone) return; zone = z; const el = $('#hudLoc'); el.querySelector('b').textContent = t(z); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); zoneT = 4; $('#hudPlace').textContent = t(z); progress.emit('zone', z); }
  function renderQuests() {
    $('#daily').innerHTML = progress.daily().map(d => `<li class="${d.done ? 'got' : ''}"><span>${d.done ? '✓' : '◇'}</span><b>${esc(t(d.title))}</b><small>${d.key === 'walk' ? Math.round(d.have) + ' / 1000 m' : d.have + ' / ' + d.n}</small></li>`).join('');
    $('#quests ul').innerHTML = progress.active().map(q => { const p = q.prog ? q.prog(progress.S) : null;
      return `<li><b>${esc(t(q.title))}</b><span>${esc(t(q.desc))}</span>${p ? `<em><i style="width:${Math.min(100, p[0] / p[1] * 100)}%"></i></em><small>${Math.min(p[0], p[1])} / ${p[1]}</small>` : ''}</li>`; }).join('') || `<li><b>${esc(t('Every story told'))}</b><span>${esc(t('All quests complete — the park is yours.'))}</span></li>`;
    const lv = progress.level(); $('#pLevel').textContent = lv.lv; $('#pXP i').style.width = `${lv.k * 100}%`; $('#pPts').textContent = progress.S.points;
    $('#cHearts').textContent = `${progress.S.hearts}/12`; $('#cLetters').textContent = `${progress.S.letters}/8`; $('#cFound').textContent = `${progress.S.found.size}/${progress.S.total}`;
    renderProgressPage();
  }
  function renderProgressPage() {
    const P = progress, list = $('#achList'); if (!list) return;
    list.innerHTML = P.ACHIEVEMENTS.map(a => `<li class="${P.S.ach.has(a.id) ? 'got' : ''}"><span>${a.icon}</span><div><b>${esc(t(a.title))}</b><small>${esc(t(a.desc))}</small></div></li>`).join('');
    $('#questLog').innerHTML = P.QUESTS.map(q => `<li class="${P.S.quests.has(q.id) ? 'got' : ''}"><span>${P.S.quests.has(q.id) ? '✓' : '○'}</span><div><b>${esc(t(q.title))}</b><small>${esc(t(q.desc))}</small></div></li>`).join('');
    $('#achCount').textContent = `${P.S.ach.size}/${P.ACHIEVEMENTS.length}`;
  }
  function prompt(a, verb) {
    const el = $('#prompt'); if (!a) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); el.querySelector('.pv').textContent = t(verb); el.querySelector('.pn').textContent = `${a.icon} ${t(a.name)}`;
  }
  // event banner: what, where, and a countdown
  let evT = 0, evE = null;
  function announce(e, lead = 0) { const el = $('#eventBanner'); if (!e) { el.classList.add('hidden'); evE = null; return; } evE = e; evT = lead;
    el.querySelector('.ei').textContent = e.icon; el.querySelector('b').textContent = t(e.name); el.querySelector('.ew').textContent = `${t('at')} ${t(e.where)}`; el.classList.remove('hidden'); }
  function stamina(k, sprinting) { const el = $('#pStam'); el.style.setProperty('--k', k); el.classList.toggle('low', k < 0.2); el.classList.toggle('on', sprinting || k < 0.99); }
  function letter(i, n, text) { const m = $('#letter'); m.querySelector('.ln').textContent = `${t('Love letter')} ${n} / 8`; m.querySelector('p').textContent = t(text); m.classList.remove('hidden'); }
  $('#letter .x').addEventListener('click', () => $('#letter').classList.add('hidden'));
  renderQuests(); onLang(() => { renderQuests(); const z = zone; zone = ''; if (z) { setZone(z); } });
  let miniT = 0;
  return {
    zoneAt: (x, z) => zoneAt(x, z, atts), setZone, announce, renderQuests, prompt, stamina, letter, toggleMap, get mapOpen() { return bigOn; },
    update(dt, p) {
      if ((zoneT -= dt) < 0 && zoneT > -1) $('#hudLoc').classList.remove('show');
      if (evE) { evT = Math.max(0, evT - dt); $('#eventBanner .ec').textContent = evT > 0 ? `${Math.ceil(evT)} s` : t('now'); }
      if ((miniT += dt) > 1 / 30) { miniT = 0; drawMini(p.x, p.z, p.camYaw, p.yaw); if (bigOn) drawBig(p.x, p.z, p.yaw); }
    },
  };
}

export { createHUD, zoneAt };
