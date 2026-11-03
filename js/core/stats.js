/* =========================================================================
   STATS — a measurable performance readout shared by both parks (F3, or the setting in each park's menu).
   FPS and frame time (mean and 1% worst, from a rolling window), GPU work submitted (draw calls, triangles,
   textures, programs), resolution scale and quality tier. Zero allocation per frame: a fixed ring buffer and
   one text update every half second.
   ========================================================================= */
const ST = { el: null, on: false, ring: new Float32Array(240), i: 0, n: 0, acc: 0, info: null, extra: () => '' };
function createStats(renderer, extra = () => '') {
  ST.info = renderer.info; renderer.info.autoReset = false; ST.extra = extra;
  const el = ST.el = document.createElement('pre'); el.id = 'perfstats';
  el.style.cssText = 'position:fixed;left:12px;top:50%;transform:translateY(-50%);z-index:50;margin:0;padding:10px 12px;border-radius:10px;background:rgba(14,12,24,.78);color:#e8e4f4;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none;display:none;white-space:pre;backdrop-filter:blur(6px)';
  document.body.appendChild(el);
  try { ST.on = localStorage.getItem('perf-stats') === '1'; } catch (e) {} el.style.display = ST.on ? 'block' : 'none';
  addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); setStats(!ST.on); } });
  return ST;
}
function setStats(on) { ST.on = on; if (ST.el) ST.el.style.display = on ? 'block' : 'none'; try { localStorage.setItem('perf-stats', on ? '1' : '0'); } catch (e) {} }
function frameStart() { if (ST.info) ST.info.reset(); }
function frameEnd(dtReal) {
  ST.ring[ST.i] = dtReal; ST.i = (ST.i + 1) % ST.ring.length; ST.n = Math.min(ST.n + 1, ST.ring.length); ST.acc += dtReal;
  if (!ST.on || ST.acc < 0.5) return; ST.acc = 0;
  let sum = 0, worst = 0; const k = Math.max(1, Math.floor(ST.n * 0.01)), tmp = [];
  for (let j = 0; j < ST.n; j++) { const v = ST.ring[j]; sum += v; if (v > worst) worst = v; }
  for (let j = 0; j < ST.n; j++) tmp.push(ST.ring[j]); tmp.sort((a, b) => b - a); const p1 = tmp[k - 1] || worst;
  const mean = sum / ST.n, r = ST.info.render, m = ST.info.memory;
  ST.el.textContent = `${(1 / mean).toFixed(0).padStart(3)} fps   ${(mean * 1000).toFixed(1)} ms\n1% low ${(1 / p1).toFixed(0)} fps   (${(p1 * 1000).toFixed(1)} ms)\ncalls  ${r.calls}\ntris   ${(r.triangles / 1000).toFixed(0)}k\ntex    ${m.textures}   geo ${m.geometries}\nprog   ${ST.info.programs ? ST.info.programs.length : '-'}\n${ST.extra()}`;
}
export { createStats, setStats, frameStart, frameEnd, ST as STATS };
