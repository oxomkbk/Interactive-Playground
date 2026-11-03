import * as THREE from 'three';
import { $, PI, R, TAU, clamp, fbm, hash2i, lerp, rand, smooth } from './utils.js';
import { t } from './i18n.js';

/* =========================================================================
   1. PROCEDURAL TEXTURES (Canvas) — PBR sets: albedo + normal + roughness
   ========================================================================= */
function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16; return t;
}
function normalFromHeight(H, N, s) {
  const [c, x] = cnv(N); const im = x.createImageData(N, N); const d = im.data;
  for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) {
    const l = H[y * N + (X - 1 + N) % N], r = H[y * N + (X + 1) % N], u = H[((y - 1 + N) % N) * N + X], dn = H[((y + 1) % N) * N + X];
    const nx = (l - r) * s, ny = (dn - u) * s, il = 1 / Math.hypot(nx, ny, 1), i = (y * N + X) * 4;
    d[i] = (nx * il * .5 + .5) * 255; d[i + 1] = (ny * il * .5 + .5) * 255; d[i + 2] = (il * .5 + .5) * 255; d[i + 3] = 255;
  }
  x.putImageData(im, 0, 0); return toTex(c, { srgb: false });
}
function pbrSet(N, C, H, Rg, ns) {
  const [c, x] = cnv(N); x.putImageData(new ImageData(C, N, N), 0, 0);
  const out = { map: toTex(c), normalMap: normalFromHeight(H, N, ns) };
  if (Rg) {
    const [c2, x2] = cnv(N); const C2 = new Uint8ClampedArray(N * N * 4);
    for (let i = 0; i < N * N; i++) { const v = Rg[i] * 255; C2[i * 4] = C2[i * 4 + 1] = C2[i * 4 + 2] = v; C2[i * 4 + 3] = 255; }
    x2.putImageData(new ImageData(C2, N, N), 0, 0); out.roughnessMap = toTex(c2, { srgb: false });
  }
  return out;
}
// Wet cobblestones: tileable Voronoi stones, mud joints, mirror-like puddles
function genCobble(N = 1024) {
  const cells = 9, F = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) F.push([(i + .2 + .6 * rand()) / cells, (j + .2 + .6 * rand()) / cells, rand()]);
  const C = new Uint8ClampedArray(N * N * 4), H = new Float32Array(N * N), Rg = new Float32Array(N * N), Wt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) { const v = y / N; for (let x = 0; x < N; x++) { const u = x / N;
    const ci = Math.floor(u * cells), cj = Math.floor(v * cells); let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, wi = (ii + cells) % cells, wj = (jj + cells) % cells, f = F[wj * cells + wi];
      const dd = Math.hypot(u - (f[0] + (ii - wi) / cells), v - (f[1] + (jj - wj) / cells));
      if (dd < f1) { f2 = f1; f1 = dd; id = wj * cells + wi; } else if (dd < f2) f2 = dd;
    }
    const edge = f2 - f1, stone = smooth(0.004, 0.03, edge), cr = F[id][2];
    const det = fbm(u * 24, v * 24, 24, 3, 3), pud = smooth(0.56, 0.68, fbm(u * 3, v * 3, 3, 3, 11));
    let h = stone * (0.55 + 0.25 * cr + 0.2 * smooth(0, .05, edge)) + det * 0.12; h = lerp(h, 0.45, pud * 0.85);
    const i = y * N + x; H[i] = h;
    const k = 0.7 + 0.55 * det; let r = lerp(58, 96, cr) * k, g = lerp(54, 86, cr) * k, b = lerp(60, 84, cr) * k;
    const gap = 1 - stone; r = lerp(r, 26, gap); g = lerp(g, 22, gap); b = lerp(b, 20, gap);
    const dk = 1 - pud * 0.5; C[i * 4] = r * dk; C[i * 4 + 1] = g * dk; C[i * 4 + 2] = b * dk * 1.05; C[i * 4 + 3] = 255;
    Rg[i] = lerp(lerp(0.5 + cr * 0.25, 0.95, gap), 0.04, pud);
    Wt[i] = clamp(pud * 1.1 + gap * 0.3 + 0.1, 0, 1); // wetness → clear-coat water film
  } }
  const out = pbrSet(N, C, H, Rg, 12);
  const [cw, xw] = cnv(N), Cw = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) { const v = Wt[i] * 255; Cw[i * 4] = Cw[i * 4 + 1] = Cw[i * 4 + 2] = v; Cw[i * 4 + 3] = 255; }
  xw.putImageData(new ImageData(Cw, N, N), 0, 0); out.clearcoatMap = toTex(cw, { srgb: false });
  return out;
}
function genGround(N = 1024) {
  const C = new Uint8ClampedArray(N * N * 4), H = new Float32Array(N * N), Rg = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, n = fbm(u * 8, v * 8, 8, 5, 21), m = fbm(u * 3, v * 3, 3, 3, 5), sp = hash2i(x, y, 9);
    const i = y * N + x; const leaf = sp > 0.965 && m > 0.45 ? 1 : 0;
    let r = lerp(20, 44, m) * (0.7 + 0.6 * n), g = lerp(26, 31, m) * (0.7 + 0.6 * n), b = lerp(16, 22, m) * (0.7 + 0.6 * n);
    if (leaf) { r = 92 * (0.6 + sp * 0.4); g = 40; b = 14; }
    C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = b; C[i * 4 + 3] = 255;
    H[i] = n * 0.7 + leaf * 0.2 + sp * 0.1; Rg[i] = 0.92 - smooth(0.6, 0.8, m) * 0.35;
  }
  return pbrSet(N, C, H, Rg, 6);
}
// Rough-hewn stone blocks with moss — tower, manor, gate
function genStone(N = 1024) {
  const rows = 8, rh = N / rows, RB = [];
  for (let r = 0; r < rows; r++) { const xs = [0]; let acc = 0; while (acc < N) { acc += Math.round(R(0.8, 1.6) * rh * 1.4); xs.push(Math.min(acc, N)); }
    RB.push({ xs, off: Math.floor(R(0, N)), c: xs.map(() => rand()) }); }
  const C = new Uint8ClampedArray(N * N * 4), H = new Float32Array(N * N), Rg = new Float32Array(N * N);
  for (let y = 0; y < N; y++) { const row = Math.floor(y / rh), ly = y - row * rh, rb = RB[row];
    for (let x = 0; x < N; x++) {
      const xx = (x + rb.off) % N; let k = 0; while (rb.xs[k + 1] <= xx) k++;
      const lx = xx - rb.xs[k], bw = rb.xs[k + 1] - rb.xs[k], e = Math.min(lx, bw - lx, ly, rh - ly), bev = smooth(0, N / 85, e), cr = rb.c[k];
      const u = x / N, v = y / N, det = fbm(u * 16, v * 16, 16, 4, 7), moss = smooth(.52, .72, fbm(u * 4, v * 4, 4, 3, 9));
      const i = y * N + x; H[i] = bev * (.7 + .3 * cr) + det * .25;
      const k2 = (0.65 + 0.5 * cr) * (0.75 + 0.5 * det); let r = 56 * k2, g = 52 * k2, b = 62 * k2;
      r = lerp(r, 30, moss * .55); g = lerp(g, 44, moss * .55); b = lerp(b, 28, moss * .55);
      const mo = 1 - bev; r = lerp(r, 20, mo); g = lerp(g, 18, mo); b = lerp(b, 22, mo);
      C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = b; C[i * 4 + 3] = 255; Rg[i] = 0.82 + 0.15 * mo - 0.1 * cr;
    } }
  return pbrSet(N, C, H, Rg, 10);
}
function genWood(N = 512) {
  const planks = 4, pw = N / planks, C = new Uint8ClampedArray(N * N * 4), H = new Float32Array(N * N), Rg = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const p = Math.floor(x / pw), lx = x - p * pw, u = x / N, v = y / N, cr = hash2i(p, 3, 4);
    const g = Math.sin((lx * 0.35 + fbm(u * 4 + p * 7, v * 1.5, 1e6, 3, 2) * 10) * 2.2) * .5 + .5;
    const gap = (lx < 1.5 || lx > pw - 1.5) ? 1 : 0, i = y * N + x, k = 0.75 + 0.5 * cr;
    C[i * 4] = gap ? 14 : lerp(46, 82, g * .6 + cr * .4) * k; C[i * 4 + 1] = gap ? 10 : lerp(28, 52, g * .6 + cr * .4) * k;
    C[i * 4 + 2] = gap ? 8 : lerp(20, 34, g * .6 + cr * .4) * k; C[i * 4 + 3] = 255;
    H[i] = gap ? 0 : 0.6 + g * 0.15; Rg[i] = gap ? 1 : 0.7 + 0.15 * g;
  }
  return pbrSet(N, C, H, Rg, 7);
}
function genRoof(N = 512) {
  const rows = 10, rh = N / rows, sw = N / 8, C = new Uint8ClampedArray(N * N * 4), H = new Float32Array(N * N), Rg = new Float32Array(N * N);
  for (let y = 0; y < N; y++) { const r = Math.floor(y / rh), ly = y - r * rh;
    for (let x = 0; x < N; x++) {
      const off = (r % 2) * sw / 2, si = Math.floor((x + off) / sw), lx = (x + off) % sw, dx = (lx / sw - .5) * 2;
      const scallop = rh * (0.72 + 0.28 * (1 - dx * dx)), inS = ly < scallop, cr = hash2i(si, r, 5), i = y * N + x;
      const h = inS ? ly / rh : 0.05, edge = Math.min(lx, sw - lx) < 1.5 ? 0.5 : 1;
      const k = (0.6 + 0.5 * cr) * edge * (inS ? 1 : 0.4) * (0.7 + 0.5 * ly / rh);
      C[i * 4] = 44 * k; C[i * 4 + 1] = 38 * k; C[i * 4 + 2] = 52 * k; C[i * 4 + 3] = 255; H[i] = h; Rg[i] = 0.6 + 0.3 * cr;
    } }
  return pbrSet(N, C, H, Rg, 6);
}
function genHedge(N = 512) {
  const [c, x] = cnv(N); x.fillStyle = '#0e1a0e'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 12000; i++) {
    const px = R(0, N), py = R(0, N), rr = R(3, 10), a = R(0, PI);
    x.fillStyle = `hsl(${R(90, 140)},${R(28, 55)}%,${R(10, 34)}%)`;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.ellipse(px + ox, py + oy, rr, rr * 0.55, a, 0, TAU); x.fill(); }
  }
  const d = x.getImageData(0, 0, N, N).data, H = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) H[i] = (d[i * 4] + d[i * 4 + 1]) / 120;
  return { map: toTex(c), normalMap: normalFromHeight(H, N, 2.5) };
}
function genWallpaper(N = 256) {
  const [c, x] = cnv(N); x.fillStyle = '#6a2230'; x.fillRect(0, 0, N, N);
  x.strokeStyle = 'rgba(120,60,40,.45)'; x.lineWidth = 2;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = i * 64 + (j % 2) * 32 + 16, cy = j * 64 + 32;
    x.beginPath(); x.ellipse(cx, cy, 12, 22, 0, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(cx, cy - 26); x.quadraticCurveTo(cx + 18, cy, cx, cy + 26); x.quadraticCurveTo(cx - 18, cy, cx, cy - 26); x.stroke();
    x.fillStyle = 'rgba(160,90,40,.3)'; x.beginPath(); x.arc(cx, cy, 3, 0, TAU); x.fill();
  }
  for (let i = 0; i < 9; i++) { const sx = R(0, N), sy = R(0, N), g = x.createRadialGradient(sx, sy, 0, sx, sy, R(20, 70));
    g.addColorStop(0, 'rgba(10,4,0,.28)'); g.addColorStop(1, 'rgba(10,4,0,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N); }
  return toTex(c);
}
function stripeTex(colors, n = 8, horizontal = false, scallop = false) {
  const [c, x] = cnv(256, 256);
  for (let i = 0; i < n; i++) { x.fillStyle = colors[i % colors.length];
    if (horizontal) x.fillRect(0, i * 256 / n, 256, 256 / n + 1); else x.fillRect(i * 256 / n, 0, 256 / n + 1, 256); }
  if (scallop) { // transparent scalloped lower edge (for valances)
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) { x.beginPath(); x.arc((i + .5) * 256 / n, 256 + 256 / n * .25, 256 / n * .62, 0, TAU); x.fill(); }
    x.globalCompositeOperation = 'source-over';
  }
  const t = toTex(c); return t;
}
function signTex(text, { w = 1024, h = 256, color = '#ff9a3a', glow = '#ff4a00', size = 150, sub = '', subColor = '#c79bff', font = 'Palatino Linotype, Georgia, serif', bg = null } = {}) {
  const [c, x] = cnv(w, h); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const ty = sub ? h * 0.42 : h * 0.52;
  x.font = `600 ${size}px ${font}`; const tw = x.measureText(text).width; if (tw > w * 0.9) { size *= w * 0.9 / tw; x.font = `600 ${size}px ${font}`; }
  for (let i = 0; i < 3; i++) { x.shadowColor = glow; x.shadowBlur = 30 - i * 10; x.fillStyle = color; x.fillText(text, w / 2, ty); }
  x.shadowBlur = 0; x.fillStyle = '#fff4dc'; x.globalAlpha = 0.45; x.fillText(text, w / 2, ty); x.globalAlpha = 1;
  if (sub) { x.font = `italic ${size * 0.34}px ${font}`; x.shadowColor = subColor; x.shadowBlur = 16; x.fillStyle = subColor; x.fillText(sub, w / 2, h * 0.82); }
  const t = toTex(c, { repeat: false }); return t;
}
function radialTex(N = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]) {
  const [c, x] = cnv(N); const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, N, N); return toTex(c, { repeat: false });
}
// Jack-o'-lantern face mapped at sphere u=0.25 (which is +Z on SphereGeometry)
function pumpkinFaceTex() {
  const W = 512, Hh = 256; const [ce, e] = cnv(W, Hh); const [cc, c] = cnv(W, Hh);
  const grd = c.createLinearGradient(0, 0, 0, Hh); grd.addColorStop(0, '#8a3a08'); grd.addColorStop(.5, '#e0670f'); grd.addColorStop(1, '#7a2e06');
  c.fillStyle = grd; c.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${R(80, 140)},${R(30, 50)},0,.18)`; c.fillRect(R(0, W), 0, R(1, 4), Hh); }
  c.fillStyle = '#4a4a1c'; c.fillRect(0, 0, W, 5); // stem band (stem UVs point here)
  e.fillStyle = '#000'; e.fillRect(0, 0, W, Hh);
  const face = (ctx, col) => {
    ctx.fillStyle = col; const cx = 128;
    ctx.beginPath(); ctx.moveTo(cx - 52, 108); ctx.lineTo(cx - 22, 108); ctx.lineTo(cx - 36, 74); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 52, 108); ctx.lineTo(cx + 22, 108); ctx.lineTo(cx + 36, 74); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 8, 128); ctx.lineTo(cx + 8, 128); ctx.lineTo(cx, 114); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 74, 140);
    const teeth = [[-56, 156], [-46, 146], [-32, 164], [-18, 150], [0, 168], [18, 150], [32, 164], [46, 146], [56, 156], [74, 140]];
    for (const [dx, y] of teeth) ctx.lineTo(cx + dx, y);
    ctx.quadraticCurveTo(cx + 40, 196, cx, 198); ctx.quadraticCurveTo(cx - 40, 196, cx - 74, 140); ctx.fill();
  };
  face(c, '#1c0700');
  e.shadowColor = '#ffb040'; e.shadowBlur = 10; face(e, '#ffcc66');
  return { map: toTex(cc, { repeat: false }), emissiveMap: toTex(ce, { repeat: false }) };
}
function clockTex() {
  const N = 256; const [c, x] = cnv(N); x.fillStyle = '#120a06'; x.fillRect(0, 0, N, N);
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 126); g.addColorStop(0, '#ffdca0'); g.addColorStop(.8, '#d99a48'); g.addColorStop(1, '#3a1c08');
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 124, 0, TAU); x.fill();
  x.strokeStyle = '#2a1206'; x.lineWidth = 5; x.beginPath(); x.arc(128, 128, 112, 0, TAU); x.stroke();
  x.fillStyle = '#2a1206'; x.font = 'bold 26px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((s, i) => {
    const a = i / 12 * TAU - PI / 2; x.fillText(s, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); });
  return toTex(c, { repeat: false });
}
function portraitTex(seed) {
  const [c, x] = cnv(192, 256); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#2a1a12'); g.addColorStop(1, '#0a0605');
  x.fillStyle = g; x.fillRect(0, 0, 192, 256);
  x.fillStyle = ['#3a2a22', '#2a2a36', '#302018'][seed % 3]; x.beginPath(); x.ellipse(96, 250, 80, 90, 0, PI, 0); x.fill();
  x.fillStyle = '#b8a48a'; x.beginPath(); x.ellipse(96, 110, 40, 52, 0, 0, TAU); x.fill();
  x.fillStyle = '#1a0e08'; x.beginPath(); x.ellipse(96, 70, 46, 30, 0, PI, 0); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.ellipse(80, 104, 8, 6, 0, 0, TAU); x.ellipse(112, 104, 8, 6, 0, 0, TAU); x.fill();
  x.strokeStyle = '#4a2a20'; x.lineWidth = 3; x.beginPath(); x.moveTo(84, 140); x.quadraticCurveTo(96, 134, 108, 140); x.stroke();
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 192, 256);
  return toTex(c, { repeat: false });
}
function scareFaceTex() {
  const [c, x] = cnv(512); const g = x.createRadialGradient(256, 230, 20, 256, 256, 250);
  g.addColorStop(0, '#e9e4dc'); g.addColorStop(.55, '#9a958c'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(256, 250, 190, 245, 0, 0, TAU); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.ellipse(180, 210, 50, 70, -.2, 0, TAU); x.ellipse(332, 210, 50, 70, .2, 0, TAU); x.fill();
  x.fillStyle = '#ff2020'; x.shadowColor = '#f00'; x.shadowBlur = 20; x.beginPath(); x.arc(184, 220, 7, 0, TAU); x.arc(328, 220, 7, 0, TAU); x.fill(); x.shadowBlur = 0;
  x.fillStyle = '#050000'; x.beginPath(); x.ellipse(256, 380, 70, 105, 0, 0, TAU); x.fill();
  x.fillStyle = '#d8d0b8'; for (let i = 0; i < 9; i++) { x.beginPath(); const tx = 196 + i * 15; x.moveTo(tx, 300); x.lineTo(tx + 7, 330); x.lineTo(tx + 14, 300); x.fill(); }
  x.strokeStyle = 'rgba(40,0,0,.6)'; x.lineWidth = 2; for (let i = 0; i < 30; i++) { x.beginPath(); x.moveTo(R(100, 412), R(60, 460)); x.lineTo(R(100, 412), R(60, 460)); x.stroke(); }
  return toTex(c, { repeat: false });
}
function webTex() {
  const [c, x] = cnv(256); x.strokeStyle = 'rgba(230,230,240,.55)'; x.lineWidth = 1.2;
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 256, Math.sin(a) * 256); x.stroke(); }
  for (let r = 24; r < 256; r += 22) { x.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2, rr = r + Math.sin(i * 2) * 3;
    i ? x.quadraticCurveTo(Math.cos(a - .1) * rr * .92, Math.sin(a - .1) * rr * .92, Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); }
  return toTex(c, { repeat: false });
}
function leafTex() {
  const [c, x] = cnv(64); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 2);
  for (let i = 1; i <= 10; i++) { const a = -PI / 2 + i / 10 * TAU, r = i % 2 ? 30 : 14; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.fill(); x.fillRect(31, 32, 2, 30); return toTex(c, { repeat: false });
}
function targetTex(kind) {
  const [c, x] = cnv(128); x.lineWidth = 5; x.strokeStyle = '#1a0a04';
  if (kind === 'ghost') { x.fillStyle = '#f2efe6'; x.beginPath(); x.moveTo(20, 120); x.lineTo(20, 56); x.arc(64, 56, 44, PI, 0); x.lineTo(108, 120);
    for (let i = 0; i < 4; i++) { x.lineTo(97 - i * 22, 106); x.lineTo(86 - i * 22, 120); } x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(48, 58, 8, 12, 0, 0, TAU); x.ellipse(80, 58, 8, 12, 0, 0, TAU); x.ellipse(64, 86, 8, 10, 0, 0, TAU); x.fill(); }
  if (kind === 'pumpkin') { x.fillStyle = '#ff7a10'; x.beginPath(); x.ellipse(64, 70, 54, 46, 0, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = '#3a6a10'; x.fillRect(58, 14, 12, 16); x.fillStyle = '#ffe080';
    x.beginPath(); x.moveTo(36, 66); x.lineTo(54, 66); x.lineTo(45, 48); x.fill(); x.beginPath(); x.moveTo(74, 66); x.lineTo(92, 66); x.lineTo(83, 48); x.fill();
    x.beginPath(); x.moveTo(30, 82); x.lineTo(98, 82); x.lineTo(80, 100); x.lineTo(48, 100); x.fill(); }
  if (kind === 'bat') { x.fillStyle = '#ffd040'; x.beginPath(); x.moveTo(64, 50); x.quadraticCurveTo(30, 20, 4, 50); x.quadraticCurveTo(20, 62, 22, 80);
    x.quadraticCurveTo(40, 66, 64, 90); x.quadraticCurveTo(88, 66, 106, 80); x.quadraticCurveTo(108, 62, 124, 50); x.quadraticCurveTo(98, 20, 64, 50); x.fill(); x.stroke(); }
  if (kind === 'cat') { x.fillStyle = '#16121c'; x.beginPath(); x.ellipse(64, 80, 40, 38, 0, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(30, 60); x.lineTo(36, 20); x.lineTo(56, 46); x.fill(); x.beginPath(); x.moveTo(98, 60); x.lineTo(92, 20); x.lineTo(72, 46); x.fill();
    x.fillStyle = '#b8ff40'; x.beginPath(); x.ellipse(50, 74, 8, 10, 0, 0, TAU); x.ellipse(78, 74, 8, 10, 0, 0, TAU); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(6, 6, 116, 116); x.fillStyle = '#ff5050'; x.font = 'bold 18px Georgia'; x.textAlign = 'center'; x.fillText('NO!', 64, 120); }
  return toTex(c, { repeat: false });
}
function backdropTex() {
  const [c, x] = cnv(512, 256); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#0a0a24'); g.addColorStop(1, '#3a1430');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#ffe9b0'; x.shadowColor = '#ffd080'; x.shadowBlur = 30; x.beginPath(); x.arc(390, 70, 36, 0, TAU); x.fill(); x.shadowBlur = 0;
  x.fillStyle = '#100610'; x.beginPath(); x.moveTo(0, 256); for (let i = 0; i <= 16; i++) x.lineTo(i * 32, 180 - Math.sin(i * 1.3) * 26 - (i % 3) * 8); x.lineTo(512, 256); x.fill();
  for (let i = 0; i < 9; i++) { const tx = 20 + i * 56; x.fillRect(tx, 200, 18, 40); x.beginPath(); x.arc(tx + 9, 200, 9, PI, 0); x.fill(); }
  return toTex(c, { repeat: false });
}
function strikerTex() {
  const [c, x] = cnv(128, 1024); const g = x.createLinearGradient(0, 1024, 0, 0);
  g.addColorStop(0, '#3a0a08'); g.addColorStop(.5, '#a8360c'); g.addColorStop(.85, '#ffb030'); g.addColorStop(1, '#fff0c0');
  x.fillStyle = g; x.fillRect(0, 0, 128, 1024);
  x.fillStyle = '#1a0804'; x.font = 'bold 22px Georgia'; x.textAlign = 'center';
  ['DEMON KING', 'UNDEAD', 'FEARLESS', 'BRAVE', 'SKITTISH', 'MORTAL'].forEach((s, i) => { const y = 70 + i * 170; x.fillRect(10, y + 18, 108, 3); x.fillText(s, 64, y); });
  return toTex(c, { repeat: false });
}
function panelTex() { // carousel centre column: ornate mirrors
  const [c, x] = cnv(512, 256); x.fillStyle = '#1a0a14'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 8; i++) { const px = i * 64 + 8;
    const g = x.createLinearGradient(px, 0, px + 48, 256); g.addColorStop(0, '#5a3a6a'); g.addColorStop(.5, '#d8b8ff'); g.addColorStop(1, '#3a2050');
    x.fillStyle = g; x.beginPath(); x.moveTo(px, 230); x.lineTo(px, 50); x.arc(px + 24, 50, 24, PI, 0); x.lineTo(px + 48, 230); x.fill();
    x.strokeStyle = '#e0a040'; x.lineWidth = 4; x.stroke(); }
  return toTex(c);
}
function windowTex(silhouette) {
  const [c, x] = cnv(128, 192); const g = x.createRadialGradient(64, 130, 8, 64, 110, 130); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#d8c8b0'); g.addColorStop(1, '#5a4636');
  x.fillStyle = g; x.fillRect(0, 0, 128, 192);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(30,18,10,${Math.random() * 0.12})`; x.fillRect(Math.random() * 128, Math.random() * 192, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  for (const s of [0, 1]) { const cg = x.createLinearGradient(s ? 128 : 0, 0, s ? 96 : 32, 0); cg.addColorStop(0, 'rgba(40,6,10,.95)'); cg.addColorStop(1, 'rgba(90,20,24,0)'); x.fillStyle = cg;
    x.beginPath(); x.moveTo(s ? 128 : 0, 0); x.lineTo(s ? 92 : 36, 0); x.quadraticCurveTo(s ? 100 : 28, 100, s ? 118 : 10, 192); x.lineTo(s ? 128 : 0, 192); x.fill(); }
  if (silhouette) { x.fillStyle = '#000'; x.beginPath(); x.ellipse(64, 70, 16, 20, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(30, 192); x.quadraticCurveTo(34, 96, 64, 92); x.quadraticCurveTo(94, 96, 98, 192); x.fill(); }
  x.fillStyle = '#0a0606'; x.fillRect(60, 0, 8, 192); x.fillRect(0, 92, 128, 8); x.lineWidth = 10; x.strokeStyle = '#0a0606'; x.strokeRect(0, 0, 128, 192);
  return toTex(c, { repeat: false });
}
function rugTex() {
  const [c, x] = cnv(256, 512); x.fillStyle = '#3a0810'; x.fillRect(0, 0, 256, 512);
  x.strokeStyle = '#b07a30'; x.lineWidth = 6; x.strokeRect(14, 14, 228, 484); x.lineWidth = 2; x.strokeRect(30, 30, 196, 452);
  x.fillStyle = 'rgba(176,122,48,.5)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(128, 70 + i * 92, 50, 30, 0, 0, TAU); x.fill(); }
  return toTex(c, { repeat: false });
}

export { cnv, toTex, normalFromHeight, pbrSet, genCobble, genGround, genStone, genWood, genRoof, genHedge, genWallpaper, stripeTex, signTex, radialTex, pumpkinFaceTex, clockTex, portraitTex, scareFaceTex, webTex, leafTex, targetTex, backdropTex, strikerTex, panelTex, windowTex, rugTex };
