/* =========================================================================
   TEXTURES — every surface is painted in code: a colour canvas plus a height canvas turned into a tangent-space
   normal map (Sobel), so stone, wood, shingles and fabric catch the low sun properly. All tile seamlessly
   (drawing wraps across the edges). Cached by key.
   ========================================================================= */
import * as THREE from 'three';
import { rand, R } from './geo.js';

const cache = new Map();
const mk = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
const tex = (c, srgb = true, rep = [1, 1]) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(...rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
// draw fn(g, n) at the 9 wrapped offsets so shapes crossing an edge continue on the other side
const wrapDraw = (g, n, x, y, fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(x + ox, y + oy); };

function normalFrom(h, strength = 2) {
  const n = h.width, src = h.getContext('2d').getImageData(0, 0, n, n).data, out = mk(n), g = out.getContext('2d'), img = g.createImageData(n, n), d = img.data;
  const H = (x, y) => src[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4; d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return out;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };

/* ---------- stone paving: irregular slabs (path) or concentric rings (plaza) ---------- */
function paving(key, base = '#E8DCCB', grout = '#9C8F86', n = 512, kind = 'slabs') {
  const id = `pave:${key}`; if (cache.has(id)) return cache.get(id);
  const c = mk(n), h = mk(n), g = c.getContext('2d'), gh = h.getContext('2d');
  g.fillStyle = grout; g.fillRect(0, 0, n, n); gh.fillStyle = '#000'; gh.fillRect(0, 0, n, n);
  const slab = (x, y, w, hh) => { const col = shade(base, R(-0.06, 0.05)), r = 6;
    wrapDraw(g, n, x, y, (X, Y) => { g.fillStyle = col; g.beginPath(); g.roundRect(X + 2, Y + 2, w - 4, hh - 4, r); g.fill();
      gh.fillStyle = `rgb(${200 + R(-30, 30)},0,0)`; gh.beginPath(); gh.roundRect(X + 3, Y + 3, w - 6, hh - 6, r); gh.fill(); }); };
  if (kind === 'cobble') { for (let y = 0; y < n; y += 32) { const off = (y / 32) % 2 ? 16 : 0; for (let x = -32; x < n; x += 32) slab(x + off + R(-2, 2), y, 32 + R(-3, 3), 32); } }
  else { for (let y = 0; y < n; y += 64) { let x = (y / 64) % 2 ? -40 : 0; while (x < n) { const w = 64 + Math.floor(rand() * 3) * 32; slab(x, y, w, 64); x += w; } } }
  // speckles & wear
  for (let i = 0; i < n * 6; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '90,70,80'},${R(0.03, 0.1)})`; g.fillRect(rand() * n, rand() * n, R(1, 3), R(1, 3)); }
  gh.filter = 'blur(1.5px)'; gh.drawImage(h, 0, 0); gh.filter = 'none';
  const out = { map: tex(c), normalMap: tex(normalFrom(h, 3), false) }; cache.set(id, out); return out;
}

/* ---------- wood planks with grain ---------- */
function wood(base = '#A8754F', n = 512, planks = 6) {
  const id = `wood:${base}`; if (cache.has(id)) return cache.get(id);
  const c = mk(n), h = mk(n), g = c.getContext('2d'), gh = h.getContext('2d'), pw = n / planks;
  for (let p = 0; p < planks; p++) { const col = shade(base, R(-0.06, 0.06)); g.fillStyle = col; g.fillRect(p * pw, 0, pw, n); gh.fillStyle = '#c8c8c8'; gh.fillRect(p * pw + 2, 0, pw - 4, n);
    for (let k = 0; k < 26; k++) { const x = p * pw + R(4, pw - 4), a = R(0.04, 0.12); g.strokeStyle = `rgba(60,30,15,${a})`; g.lineWidth = R(0.6, 2); g.beginPath();
      for (let y = 0; y <= n; y += 16) g.lineTo(x + Math.sin(y * 0.02 + k) * R(0.5, 2.5), y); g.stroke(); }
    g.fillStyle = 'rgba(40,20,10,.5)'; g.fillRect(p * pw, 0, 2, n); }
  const out = { map: tex(c), normalMap: tex(normalFrom(h, 2), false) }; cache.set(id, out); return out;
}

/* ---------- scalloped roof shingles ---------- */
function shingles(base = '#C8A2E8', n = 256) {
  const id = `shingle:${base}`; if (cache.has(id)) return cache.get(id);
  const c = mk(n), h = mk(n), g = c.getContext('2d'), gh = h.getContext('2d'), s = n / 8;
  g.fillStyle = shade(base, -0.15); g.fillRect(0, 0, n, n); gh.fillStyle = '#000'; gh.fillRect(0, 0, n, n);
  for (let row = 0; row < 9; row++) for (let col = -1; col < 9; col++) { const x = col * s + (row % 2 ? s / 2 : 0) + s / 2, y = row * s;
    wrapDraw(g, n, x, y, (X, Y) => { const gr = g.createLinearGradient(0, Y - s, 0, Y); gr.addColorStop(0, shade(base, -0.04 + R(-0.03, 0.03))); gr.addColorStop(1, shade(base, 0.06));
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y - s * 0.1, s * 0.52, 0, Math.PI); g.lineTo(X - s * 0.52, Y - s); g.lineTo(X + s * 0.52, Y - s); g.fill();
      const hg = gh.createLinearGradient(0, Y - s, 0, Y + s * 0.4); hg.addColorStop(0, '#333'); hg.addColorStop(1, '#eee'); gh.fillStyle = hg; gh.beginPath(); gh.arc(X, Y - s * 0.1, s * 0.5, 0, Math.PI); gh.lineTo(X - s * 0.5, Y - s); gh.lineTo(X + s * 0.5, Y - s); gh.fill(); }); }
  const out = { map: tex(c), normalMap: tex(normalFrom(h, 2.5), false) }; cache.set(id, out); return out;
}

/* ---------- fabric: stripes with a fine weave (awnings, canopies, flags) ---------- */
function fabric(c1 = '#FFB3C6', c2 = '#FFF5E1', stripes = 8, n = 256) {
  const id = `fab:${c1}${c2}${stripes}`; if (cache.has(id)) return cache.get(id);
  const c = mk(n), h = mk(n), g = c.getContext('2d'), gh = h.getContext('2d'), w = n / stripes;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * w, 0, w, n); }
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y += 2) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(0, y, n, 1); gh.fillStyle = y % 4 ? '#8a8a8a' : '#767676'; gh.fillRect(0, y, n, 1); }
  for (let x = 0; x < n; x += 2) { gh.fillStyle = 'rgba(0,0,0,.05)'; gh.fillRect(x, 0, 1, n); }
  const out = { map: tex(c), normalMap: tex(normalFrom(h, 1), false) }; cache.set(id, out); return out;
}

/* ---------- plaster / stucco walls with soft mottling ---------- */
function plaster(base = '#FFF5E1', n = 256) {
  const id = `plaster:${base}`; if (cache.has(id)) return cache.get(id);
  const c = mk(n), h = mk(n), g = c.getContext('2d'), gh = h.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, n, n); gh.fillStyle = '#808080'; gh.fillRect(0, 0, n, n);
  for (let i = 0; i < 700; i++) { const x = rand() * n, y = rand() * n, r = R(2, 14), a = R(0.02, 0.06);
    wrapDraw(g, n, x, y, (X, Y) => { g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '150,110,120'},${a})`; g.beginPath(); g.arc(X, Y, r, 0, 6.29); g.fill();
      gh.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},.08)`; gh.beginPath(); gh.arc(X, Y, r * 0.7, 0, 6.29); gh.fill(); }); }
  const out = { map: tex(c), normalMap: tex(normalFrom(h, 1.2), false) }; cache.set(id, out); return out;
}

/* ---------- grass: blade speckle with patchy tone ---------- */
function grass(base = '#8FC27A', n = 512) {
  const id = `grass:${base}`; if (cache.has(id)) return cache.get(id);
  const c = mk(n), h = mk(n), g = c.getContext('2d'), gh = h.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, n, n); gh.fillStyle = '#606060'; gh.fillRect(0, 0, n, n);
  for (let i = 0; i < 60; i++) { const x = rand() * n, y = rand() * n, r = R(30, 90); wrapDraw(g, n, x, y, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); const col = rand() < 0.5 ? '120,170,90' : '170,205,120'; gr.addColorStop(0, `rgba(${col},.25)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(X - r, Y - r, 2 * r, 2 * r); }); }
  for (let i = 0; i < n * 22; i++) { const x = rand() * n, y = rand() * n, l = R(2, 6), a = R(-0.5, 0.5); const col = ['#7DB468', '#A6D38A', '#6FA45E', '#B9DE98', '#94C47C'][i % 5];
    g.strokeStyle = col; g.globalAlpha = R(0.3, 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
    gh.strokeStyle = '#d0d0d0'; gh.beginPath(); gh.moveTo(x, y); gh.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); gh.stroke(); }
  g.globalAlpha = 1;
  const out = { map: tex(c), normalMap: tex(normalFrom(h, 1.5), false) }; cache.set(id, out); return out;
}

/* ---------- water ripples (normal map only) ---------- */
function ripples(n = 256) {
  if (cache.has('ripples')) return cache.get('ripples');
  const h = mk(n), gh = h.getContext('2d'); gh.fillStyle = '#808080'; gh.fillRect(0, 0, n, n);
  for (let i = 0; i < 260; i++) { const x = rand() * n, y = rand() * n, r = R(4, 26); wrapDraw(gh, n, x, y, (X, Y) => { const gr = gh.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(255,255,255,${R(0.05, 0.18)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); gh.fillStyle = gr; gh.fillRect(X - r, Y - r, 2 * r, 2 * r); }); }
  const out = tex(normalFrom(h, 2.5), false); cache.set('ripples', out); return out;
}

/* ---------- signage: a painted board with lettering (sRGB, used as map + emissive) ---------- */
function sign(text, { w = 1024, h = 256, bg = '#FFF5E1', fg = '#C8577E', border = '#FFD68A', font = 'Pacifico', size = 120, sub = '' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, h * 0.45); g.fill(); g.lineWidth = 12; g.strokeStyle = border; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${size}px ${font}, "PingFang SC", cursive`; g.fillText(text, w / 2, h / 2 + (sub ? -h * 0.1 : h * 0.03), w - 80);
  if (sub) { g.font = `600 ${size * 0.32}px Quicksand, sans-serif`; g.fillStyle = border; g.fillText(sub, w / 2, h * 0.78, w - 120); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export { paving, wood, shingles, fabric, plaster, grass, ripples, sign, shade };
