/* =========================================================================
   LOVE LETTERS — eight sealed envelopes from a secret admirer, floating in quiet corners of the park (the
   top of the moon bridge, behind the stage, outside the gate, on the castle terrace…). Walk into one to open
   it; each holds a short note. Collected letters are remembered between visits.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const L = CONFIG.layout;
const NOTES = [
  'I saw you laugh at the gate, and the whole park seemed to light up a little early.',
  'Meet me where the swans sleep under the bridge — I will be the one pretending to read the map.',
  'Every time the wheel reaches the top, I make the same wish. It is always you.',
  'The fireworks are lovely. I barely noticed them.',
  'If you find this, look up: the stars over the castle spell something only we can read.',
  'I hid this behind the music so you would hear my heart before you saw it.',
  'Some people collect prizes. I collect the moments you smile.',
  'Last letter. Turn around — the evening is yours, and so, if you like, am I.',
];

function createLetters({ world, onCollect }) {
  const G = L.garden, cf = L.castle.z + 9;
  const SPOTS = [[2.5, null, L.gate.z + 9], [G.x, 'bridge', G.z], [26, null, -55], [-84, null, 18], [60, null, -66], [-64, null, -40], [61, null, 61], [-17, null, cf + 7]];
  const root = new THREE.Group(); root.name = 'letters';
  const paper = new THREE.MeshStandardMaterial({ color: '#FFF4E4', roughness: 0.7, emissive: '#FFE2C4', emissiveIntensity: 0.25 });
  const seal = new THREE.MeshStandardMaterial({ color: '#C2385E', roughness: 0.35, metalness: 0.1, emissive: '#7A1E38', emissiveIntensity: 0.4 });
  const body = new THREE.BoxGeometry(0.36, 0.24, 0.02), flap = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.18, 0.12, 0.011), new THREE.Vector3(0.18, 0.12, 0.011), new THREE.Vector3(0, -0.02, 0.011)]);
  flap.computeVertexNormals();
  const halo = new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,170,.9)'); gr.addColorStop(1, 'rgba(255,180,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // the envelope art, painted once: blush-pink paper with a gold edge, a scalloped flap, tiny heart doodles
  const envTex = (back) => { const W = 512, H = 344, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#FFE9F0'); bg.addColorStop(1, '#FFD3E1'); g.fillStyle = bg; rr(6, 6, W - 12, H - 12, 26); g.fill();
    g.strokeStyle = '#F2B65C'; g.lineWidth = 6; rr(14, 14, W - 28, H - 28, 20); g.stroke();
    const heart = (x, y, sz, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + sz * 0.3); g.bezierCurveTo(x, y, x - sz * 0.5, y, x - sz * 0.5, y + sz * 0.3); g.bezierCurveTo(x - sz * 0.5, y + sz * 0.6, x, y + sz * 0.8, x, y + sz); g.bezierCurveTo(x, y + sz * 0.8, x + sz * 0.5, y + sz * 0.6, x + sz * 0.5, y + sz * 0.3); g.bezierCurveTo(x + sz * 0.5, y, x, y, x, y + sz * 0.3); g.fill(); };
    if (!back) { g.fillStyle = '#FFC2D6'; g.beginPath(); g.moveTo(20, 22); for (let i = 0; i <= 12; i++) { const u = i / 12, x = 20 + u * (W - 40), y = 22 + (1 - Math.abs(u - 0.5) * 2) * 168; g.lineTo(x, y); } g.lineTo(W - 20, 22); g.closePath(); g.fill();
      g.strokeStyle = '#F28FB0'; g.lineWidth = 5; g.beginPath(); for (let i = 0; i <= 24; i++) { const u = i / 24, x = 20 + u * (W - 40), y = 22 + (1 - Math.abs(u - 0.5) * 2) * 168 + Math.sin(i * Math.PI) * 4; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      for (const [x, y, sz] of [[70, 250, 26], [120, 290, 16], [420, 260, 22], [380, 300, 14], [458, 80, 14], [52, 80, 12]]) heart(x, y, sz, 'rgba(242,120,160,.55)'); }
    else { g.fillStyle = 'rgba(178,90,120,.45)'; for (let k = 0; k < 3; k++) g.fillRect(140, 150 + k * 40, 240 - k * 50, 6); heart(W / 2, 60, 36, 'rgba(242,120,160,.6)');
      g.font = 'italic 34px Georgia, serif'; g.fillStyle = '#B0496A'; g.textAlign = 'center'; g.fillText('for you', W / 2, 300); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const cardG = new THREE.PlaneGeometry(0.44, 0.3), front = envTex(false), backT = envTex(true);
  const cardM = new THREE.MeshStandardMaterial({ map: front, roughness: 0.6, emissive: '#FFFFFF', emissiveMap: front, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  cardM.onBeforeCompile = (sh) => { sh.uniforms.tBack = { value: backT }; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tBack;').replace('#include <map_fragment>', `#include <map_fragment>
      if (!gl_FrontFacing) { vec4 bk = texture2D(tBack, vec2(1.0 - vMapUv.x, vMapUv.y)); diffuseColor.rgb = bk.rgb * diffuse; }`); };
  const sealG = (() => { const sh = new THREE.Shape(); sh.moveTo(0, -0.03); sh.bezierCurveTo(-0.045, 0.0, -0.035, 0.035, 0, 0.018); sh.bezierCurveTo(0.035, 0.035, 0.045, 0.0, 0, -0.03);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 10 }); })();
  let got = new Set(); try { JSON.parse(localStorage.getItem('sweetheart-letters') || '[]').forEach(i => got.add(i)); } catch (e) {}
  const items = SPOTS.map(([x, mode, z], i) => {
    // nudge into open ground if something solid sits on the spot
    if (mode !== 'bridge') for (let k = 0; k < 40 && world.blocked(x, z, 0.8); k++) { x += Math.cos(k) * 0.6; z += Math.sin(k) * 0.6; }
    const y = world.groundAt(x, z) + 1.25;
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    // a little love letter: a painted card (front: the sealed flap; back: the address side) with a raised heart seal
    const e = new THREE.Group(); g.add(e); e.add(new THREE.Mesh(cardG, cardM)); const s = new THREE.Mesh(sealG, seal); s.position.set(0, 0.005, 0.012); e.add(s);
    const h = new THREE.Sprite(halo); h.scale.setScalar(1.3); g.add(h);
    e.traverse(o => { o.castShadow = true; });
    g.visible = !got.has(i);
    return { g, e, i, x, y, z, t: Math.random() * 6 };
  });
  return {
    object3D: root, total: SPOTS.length, NOTES,
    count: () => got.size,
    update(dt, elapsed, player) {
      for (const it of items) { if (!it.g.visible) continue; it.t += dt; it.e.rotation.y = it.t * 1.2; it.e.position.y = Math.sin(it.t * 1.8) * 0.08;
        if (it.out) { it.out += dt; it.g.position.y += dt * 1.5; it.g.scale.setScalar(Math.max(0, 1 - it.out * 1.4)); if (it.out > 0.7) it.g.visible = false; continue; }
        if (player && Math.hypot(player.x - it.x, player.z - it.z) < 1.1 && Math.abs(player.y + 1 - it.y) < 1.4) {
          got.add(it.i); try { localStorage.setItem('sweetheart-letters', JSON.stringify([...got])); } catch (e) {}
          it.out = 0.001; onCollect && onCollect(it.i, got.size, NOTES[it.i], new THREE.Vector3(it.x, it.y, it.z)); } }
    },
    reset() { got = new Set(); try { localStorage.removeItem('sweetheart-letters'); } catch (e) {} },
  };
}

export { createLetters };
