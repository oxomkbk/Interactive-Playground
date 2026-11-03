/* =========================================================================
   CHARACTER — the visitor you play. Two sources, one interface:
   1. A rigged glTF (assets/character/hero.glb) with clips named Idle / Walk / Run / Jump, when the file
      exists — drop one in and it is used automatically (AnimationMixer, cross-faded by speed).
   2. Otherwise the built-in TEMPORARY PLACEHOLDER: "Rosalind", a modular procedural figure (hips → spine →
      chest → neck → head, shoulders → upper arms → forearms → hands, thighs → shins → feet) with a sheen
      fabric dress, a long ponytail on a spring chain, a ribbon bow and a satchel. Every joint is a real
      transform animated procedurally: idle breathing and weight shift, walk and run cycles driven by
      ground speed, lean into acceleration and turns, a crouch-launch-tuck-land jump, blinking and glances.
   Interface: { object3D, update(dt, state), setOutfit(i), outfits, source: 'glb'|'placeholder', setHeadVisible }
   state = { speed (m/s), run 0..1, grounded, vy, turn (rad/s), accel }
   ========================================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PI = Math.PI, TAU = PI * 2, V = (x, y, z) => new THREE.Vector3(x, y, z);
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const OUTFITS = [
  { name: 'Rose Champagne', dress: '#D98FA6', trim: '#F7E3C8', bodice: '#F4E6DA', hair: '#5A3A2E', ribbon: '#C25A7C', shoes: '#7A4A3A' },
  { name: 'Lavender Dusk', dress: '#9C88C9', trim: '#F1E9FA', bodice: '#EDE6F5', hair: '#2F2430', ribbon: '#E8B04E', shoes: '#4A3A5E' },
  { name: 'Garden Mint', dress: '#7FB39A', trim: '#FFF4DE', bodice: '#F6F1E4', hair: '#A8714A', ribbon: '#E58FA8', shoes: '#6B4E3A' },
  { name: 'Midnight Blue', dress: '#3E5A8C', trim: '#E9D7A8', bodice: '#E9E4F0', hair: '#C9A16A', ribbon: '#E9BE6A', shoes: '#2E3550' },
];

function fabricMat(color) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.78, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffffff').lerp(new THREE.Color(color), 0.4) }); }
const skinMat = () => new THREE.MeshPhysicalMaterial({ color: '#F2CDB8', roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#FFB8A0'), sheenRoughness: 0.6 });
const capsule = (r, len, rs = 10) => new THREE.CapsuleGeometry(r, len, 4, rs).translate(0, -len / 2 - r * 0.6, 0); // hangs down from its joint

function joint(parent, x, y, z, name) { const j = new THREE.Group(); j.name = name; j.position.set(x, y, z); parent.add(j); return j; }
function mesh(parent, geo, mat, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; }

function buildPlaceholder() {
  const root = new THREE.Group(); root.name = 'player';
  const M = { skin: skinMat(), dress: fabricMat('#D98FA6'), trim: fabricMat('#F7E3C8'), bodice: fabricMat('#F4E6DA'),
    hair: new THREE.MeshPhysicalMaterial({ color: '#5A3A2E', roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#C08A6A'), sheenRoughness: 0.3 }),
    ribbon: fabricMat('#C25A7C'), shoes: new THREE.MeshStandardMaterial({ color: '#7A4A3A', roughness: 0.4, metalness: 0.05 }),
    eye: new THREE.MeshStandardMaterial({ color: '#2B1E22', roughness: 0.2 }), shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    blush: new THREE.MeshBasicMaterial({ color: '#F08FA0', transparent: true, opacity: 0.35, depthWrite: false }),
    leather: new THREE.MeshStandardMaterial({ color: '#8A5A3C', roughness: 0.6 }), gold: new THREE.MeshStandardMaterial({ color: '#E9BE6A', metalness: 1, roughness: 0.3 }) };
  const J = {};
  // hips at 0.9 m; the whole figure is ~1.66 m tall
  J.hips = joint(root, 0, 0.9, 0, 'hips');
  J.spine = joint(J.hips, 0, 0.06, 0, 'spine');
  J.chest = joint(J.spine, 0, 0.2, 0, 'chest');
  J.neck = joint(J.chest, 0, 0.24, 0, 'neck');
  J.head = joint(J.neck, 0, 0.08, 0.01, 'head');
  // torso: a lathe bodice (narrow waist, soft bust/shoulders) on the chest and spine joints
  const bod = [[0.001, -0.08], [0.115, -0.08], [0.105, 0.02], [0.118, 0.12], [0.135, 0.2], [0.13, 0.26], [0.09, 0.3], [0.04, 0.32], [0.001, 0.32]].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(J.spine, new THREE.LatheGeometry(bod, 24).scale(1, 1, 0.78), M.bodice);
  mesh(J.spine, new THREE.TorusGeometry(0.112, 0.012, 6, 28).rotateX(PI / 2).scale(1, 1, 0.78).translate(0, 0.0, 0), M.ribbon); // waist sash
  mesh(J.neck, new THREE.CylinderGeometry(0.038, 0.045, 0.1, 12).translate(0, 0.03, 0), M.skin);
  mesh(J.chest, new THREE.TorusGeometry(0.06, 0.012, 6, 20).rotateX(PI / 2.2).translate(0, 0.07, 0.01), M.trim); // collar
  // head: a softly egg-shaped skull and jaw, face details
  const headG = new THREE.SphereGeometry(0.105, 32, 24); { const p = headG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setY(i, y * 1.12); p.setZ(i, z * (y < 0 ? 0.92 : 1)); p.setX(i, p.getX(i) * (y < -0.04 ? 0.88 : 1)); } headG.computeVertexNormals(); }
  const head = mesh(J.head, headG.translate(0, 0.11, 0), M.skin);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(J.head, new THREE.SphereGeometry(0.016, 12, 10).scale(0.85, 1.25, 0.5).translate(s * 0.038, 0.115, 0.093), M.eye, false); eyes.push(e);
    mesh(J.head, new THREE.SphereGeometry(0.0045, 6, 5).translate(s * 0.034, 0.124, 0.1), M.shine, false);
    mesh(J.head, new THREE.CircleGeometry(0.018, 14).translate(s * 0.058, 0.082, 0.088).rotateY(s * 0.0), M.blush, false).rotation.set(0, s * 0.45, 0);
    mesh(J.head, new THREE.BoxGeometry(0.03, 0.005, 0.006).rotateZ(s * -0.18).translate(s * 0.039, 0.146, 0.095), M.hair, false); // brows
  }
  mesh(J.head, new THREE.SphereGeometry(0.008, 8, 6).translate(0, 0.095, 0.105), M.skin, false); // nose
  mesh(J.head, new THREE.TorusGeometry(0.012, 0.0028, 4, 10, PI).rotateZ(PI).translate(0, 0.066, 0.097), new THREE.MeshBasicMaterial({ color: '#B8566A' }), false); // smile
  // hair: a cap over the skull, side locks, fringe, and a ponytail on a spring chain
  const capG = new THREE.SphereGeometry(0.118, 32, 20, 0, TAU, 0, PI * 0.62); capG.scale(1.02, 1.12, 1.06).translate(0, 0.122, -0.008);
  mesh(J.head, capG, M.hair);
  for (const s of [-1, 1]) mesh(J.head, new THREE.CapsuleGeometry(0.03, 0.13, 4, 8).rotateZ(s * 0.12).translate(s * 0.095, 0.06, 0.02), M.hair);
  for (let i = 0; i < 5; i++) mesh(J.head, new THREE.SphereGeometry(0.035, 10, 8).scale(1, 0.55, 0.7).translate(-0.06 + i * 0.03, 0.19 - Math.abs(i - 2) * 0.008, 0.085), M.hair);
  const bow = joint(J.head, 0, 0.2, -0.1, 'bow');
  for (const s of [-1, 1]) { mesh(bow, new THREE.ConeGeometry(0.045, 0.08, 10).rotateZ(s * PI / 2).translate(s * 0.045, 0, 0), M.ribbon); mesh(bow, new THREE.BoxGeometry(0.02, 0.08, 0.008).rotateZ(s * 0.3).translate(s * 0.02, -0.06, 0), M.ribbon); }
  mesh(bow, new THREE.SphereGeometry(0.018, 10, 8), M.ribbon);
  const tail = []; let tp = joint(J.head, 0, 0.17, -0.12, 'tail0');
  for (let i = 0; i < 5; i++) { const r = 0.045 - i * 0.006; mesh(tp, new THREE.CapsuleGeometry(r, 0.07, 4, 10).translate(0, -0.055, 0), M.hair); tail.push(tp); tp = joint(tp, 0, -0.1, 0, 'tail' + (i + 1)); }
  // arms: puff sleeve, bare forearm, hand
  J.arms = [-1, 1].map(s => {
    const sh = joint(J.chest, s * 0.16, 0.2, -0.005, 'shoulder'), up = joint(sh, 0, 0, 0, 'upperArm');
    mesh(up, new THREE.SphereGeometry(0.06, 14, 10).scale(1, 0.9, 1).translate(0, -0.03, 0), M.trim);
    mesh(up, capsule(0.034, 0.17), M.skin);
    const fo = joint(up, 0, -0.27, 0, 'forearm'); mesh(fo, capsule(0.029, 0.16), M.skin);
    const ha = joint(fo, 0, -0.24, 0, 'hand'); mesh(ha, new THREE.SphereGeometry(0.035, 12, 10).scale(0.8, 1.15, 0.5).translate(0, -0.03, 0), M.skin);
    return { s, sh, up, fo, ha };
  });
  // legs under the skirt
  J.legs = [-1, 1].map(s => {
    const th = joint(J.hips, s * 0.075, -0.02, 0, 'thigh'); mesh(th, capsule(0.058, 0.34), M.skin);
    const sn = joint(th, 0, -0.43, 0, 'shin'); mesh(sn, capsule(0.045, 0.35), M.skin);
    const ft = joint(sn, 0, -0.42, 0, 'foot');
    mesh(ft, new THREE.CapsuleGeometry(0.043, 0.12, 4, 10).rotateX(PI / 2).scale(1, 0.62, 1).translate(0, -0.015, 0.045), M.shoes);
    mesh(ft, new THREE.TorusGeometry(0.035, 0.006, 4, 12, PI).rotateY(PI / 2).translate(0, 0.01, 0.03), M.shoes); // strap
    return { s, th, sn, ft };
  });
  // skirt: a flared lathe hung from the hips, with a trim band; its hem flares and trails with motion
  const sk = [[0.12, 0.06], [0.135, 0.0], [0.19, -0.14], [0.26, -0.3], [0.31, -0.42], [0.315, -0.45]].map(([r, y]) => new THREE.Vector2(r, y));
  const skirtJ = joint(J.hips, 0, 0.02, 0, 'skirt');
  const skirtG = new THREE.LatheGeometry(sk, 36, 0, TAU); skirtG.scale(1, 1, 0.9);
  // soft pleats
  { const p = skirtG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 12) * 0.035 * (-y / 0.45); p.setX(i, x * k); p.setZ(i, z * k); } skirtG.computeVertexNormals(); }
  const dressM = M.dress; dressM.side = THREE.DoubleSide;
  const skirt = mesh(skirtJ, skirtG, dressM);
  mesh(skirtJ, new THREE.TorusGeometry(0.312, 0.012, 6, 48).rotateX(PI / 2).scale(1, 0.9, 1).translate(0, -0.44, 0), M.trim);
  mesh(J.spine, new THREE.LatheGeometry([[0.11, -0.08], [0.12, -0.02], [0.125, 0.05]].map(([r, y]) => new THREE.Vector2(r, y)), 24).scale(1, 1, 0.8), dressM); // dress waist
  // satchel on a strap across the body
  const bag = joint(J.hips, 0.17, 0.0, 0.02, 'bag');
  mesh(bag, new THREE.BoxGeometry(0.06, 0.13, 0.15).translate(0.02, -0.04, 0), M.leather);
  mesh(bag, new THREE.SphereGeometry(0.012, 8, 6).translate(0.055, -0.01, 0), M.gold);
  mesh(J.chest, new THREE.TorusGeometry(0.2, 0.008, 4, 32, PI * 0.9).rotateY(PI / 2).rotateX(-0.75).translate(0.01, 0.04, 0), M.leather);
  // soft contact shadow under the feet (the real shadow map is coarse at this scale)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false,
    map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() }));
  blob.position.y = 0.02; blob.renderOrder = 1; root.add(blob);
  return { root, J, M, tail, eyes, skirt, skirtJ, bow, head, blob };
}

function createCharacter() {
  const P = buildPlaceholder(), J = P.J;
  const st = { phase: 0, run: 0, move: 0, air: 0, land: 0, lean: 0, bank: 0, blink: 3, glance: 0, glanceT: 4, t: 0, tailV: P.tail.map(() => new THREE.Vector2()), tailA: P.tail.map(() => new THREE.Vector2()), skirtF: 0, outfit: 0 };
  const api = { object3D: P.root, source: 'placeholder', outfits: OUTFITS, height: 1.66, glb: null };

  api.setOutfit = (i) => { const o = OUTFITS[(i + OUTFITS.length) % OUTFITS.length]; st.outfit = OUTFITS.indexOf(o);
    P.M.dress.color.set(o.dress); P.M.dress.sheenColor.set('#ffffff').lerp(new THREE.Color(o.dress), 0.4); P.M.trim.color.set(o.trim); P.M.bodice.color.set(o.bodice);
    P.M.hair.color.set(o.hair); P.M.ribbon.color.set(o.ribbon); P.M.shoes.color.set(o.shoes); return o; };
  api.setHeadVisible = (v) => { J.head.visible = v; };

  // try the rigged glTF; keep the placeholder if the file is absent or has no usable clips
  api.tryLoadGLB = (url = 'assets/character/hero.glb') => fetch(url, { method: 'HEAD' }).then(r => { if (!r.ok) return false;
    return new GLTFLoader().loadAsync(url).then(g => {
      const clips = {}; for (const c of g.animations) for (const k of ['Idle', 'Walk', 'Run', 'Jump']) if (c.name.toLowerCase().includes(k.toLowerCase()) && !clips[k]) clips[k] = c;
      if (!clips.Idle || !clips.Walk) return false;
      const model = g.scene; model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y; model.scale.setScalar(1.66 / h); model.position.y = -box.min.y * 1.66 / h;
      const mixer = new THREE.AnimationMixer(model), act = {}; for (const k in clips) { act[k] = mixer.clipAction(clips[k]); act[k].play(); act[k].weight = 0; }
      for (const c of [...P.root.children]) if (c !== P.blob) c.visible = false; P.root.add(model);
      api.glb = { mixer, act }; api.source = 'glb'; return true; });
  }).catch(() => false);

  const _e = new THREE.Euler();
  api.update = (dt, s) => {
    st.t += dt;
    const speed = s.speed, moveK = Math.min(1, speed / 1.2), runK = Math.max(0, Math.min(1, (speed - 2.2) / 2.6));
    st.move = damp(st.move, moveK, 10, dt); st.run = damp(st.run, runK, 8, dt);
    st.air = damp(st.air, s.grounded ? 0 : 1, s.grounded ? 18 : 10, dt);
    if (s.landed) st.land = 1; st.land = Math.max(0, st.land - dt * 4);
    st.lean = damp(st.lean, Math.max(-0.25, Math.min(0.3, s.accel * 0.03)) + st.run * 0.12, 6, dt);
    st.bank = damp(st.bank, Math.max(-0.25, Math.min(0.25, -s.turn * speed * 0.03)), 6, dt);
    if (api.glb) { const { mixer, act } = api.glb, w = { Idle: 1 - st.move, Walk: st.move * (1 - st.run), Run: st.move * st.run, Jump: 0 };
      if (act.Jump) { w.Jump = st.air; for (const k of ['Idle', 'Walk', 'Run']) w[k] *= 1 - st.air; }
      for (const k in act) act[k].weight = w[k] || 0; if (act.Walk) act.Walk.timeScale = Math.max(0.6, speed / 1.5); if (act.Run) act.Run.timeScale = Math.max(0.7, speed / 5); mixer.update(dt); return; }

    // gait: cadence rises with speed; stride length grows with speed
    const cadence = 1.6 + st.run * 1.1 + st.move * 0.3; st.phase += dt * TAU * cadence * Math.max(st.move, 0.001) * (speed > 0.05 ? 1 : 0);
    const ph = st.phase, sw = Math.sin(ph), cw = Math.cos(ph), m = st.move * (1 - st.air), stride = 0.42 + st.run * 0.38;
    // breathing & idle sway
    const br = Math.sin(st.t * 1.6), idle = 1 - st.move;
    J.hips.position.y = 0.9 - m * (0.02 + st.run * 0.03) * (1 - Math.abs(cw)) * 1.0 + m * 0.012 - st.land * 0.12 * (1 - st.air) - st.air * 0.02;
    J.hips.position.x = Math.sin(st.t * 0.5) * 0.01 * idle + sw * 0.012 * m;
    J.hips.rotation.set(0, sw * 0.12 * m, sw * 0.04 * m + Math.sin(st.t * 0.5) * 0.02 * idle);
    J.spine.rotation.set(st.lean + st.land * 0.25 + 0.02 * br * idle, -sw * 0.16 * m, st.bank * 0.6);
    J.chest.rotation.set(0.01 * br, -sw * 0.08 * m, 0); J.chest.scale.set(1, 1 + br * 0.008 * idle, 1);
    // head: steady gaze, gentle glances while idle
    if ((st.glanceT -= dt) < 0) { st.glanceT = 3 + Math.random() * 5; st.glance = (Math.random() - 0.5) * 1.2 * (idle > 0.5 ? 1 : 0.2); }
    J.neck.rotation.set(-st.lean * 0.6 - st.land * 0.15, damp(J.neck.rotation.y, st.glance, 3, dt), -st.bank * 0.4);
    J.head.rotation.set(Math.sin(st.t * 0.7) * 0.03 * idle, sw * 0.06 * m, 0);
    if ((st.blink -= dt) < 0) st.blink = 2.5 + Math.random() * 3; const bl = st.blink < 0.12 ? 0.15 : 1; for (const e of P.eyes) e.scale.y = bl;
    // legs: thigh swing + knee bend in the recovery phase; feet roll; jump tucks
    for (const L of J.legs) { const s = L.s, p = ph + (s > 0 ? PI : 0), a = Math.sin(p), knee = Math.max(0, Math.cos(p));
      L.th.rotation.set(-a * stride * m - st.air * (0.55 + s * 0.15) - st.land * 0.5, 0, s * 0.03);
      L.sn.rotation.set(knee * (0.5 + st.run * 0.7) * m + st.air * 1.0 + st.land * 0.9 + 0.02, 0, 0);
      L.ft.rotation.set(-Math.max(0, a) * 0.3 * m - st.air * 0.3 + st.land * -0.35, 0, 0); }
    // arms: counter-swing, elbows bend more when running, lift in the air, relaxed idle
    for (const A of J.arms) { const s = A.s, p = ph + (s > 0 ? 0 : PI), a = Math.sin(p);
      A.up.rotation.set(a * (0.35 + st.run * 0.45) * m - st.air * 0.9 + 0.04 * br * idle, 0, s * (0.12 + st.air * 0.6 + st.run * 0.08));
      A.fo.rotation.set(-(0.18 + st.run * 0.9 * m + Math.max(0, a) * 0.3 * m + st.air * 0.4), 0, 0);
      A.ha.rotation.set(-0.1, s * 0.3, 0); }
    // skirt: flares with speed and in the air, trails behind motion
    st.skirtF = damp(st.skirtF, st.run * 0.12 + st.air * 0.18 + m * 0.04, 6, dt);
    P.skirtJ.scale.set(1 + st.skirtF, 1 - st.skirtF * 0.3, 1 + st.skirtF); P.skirtJ.rotation.set(-st.lean * 0.5 - m * 0.06 - st.air * 0.1 + sw * 0.03 * m, -J.hips.rotation.y * 0.5, -st.bank * 0.3 + sw * 0.03 * m);
    // ponytail: a damped spring per segment, pushed by motion, gravity-straightened
    const push = new THREE.Vector2(-(st.lean + m * 0.25 + s.vy * 0.02) , st.bank + sw * 0.08 * m);
    P.tail.forEach((seg, i) => { const v = st.tailV[i], a = st.tailA[i], tx = push.x * (0.6 + i * 0.25) + 0.25, tz = push.y * (0.5 + i * 0.2);
      v.x += ((tx - a.x) * 60 - v.x * 8) * dt; v.y += ((tz - a.y) * 60 - v.y * 8) * dt; a.x += v.x * dt; a.y += v.y * dt;
      seg.rotation.set(i === 0 ? a.x + 0.2 : (a.x - st.tailA[i - 1].x) * 0.8 + 0.08, 0, i === 0 ? a.y : (a.y - st.tailA[i - 1].y) * 0.8); });
    P.bow.rotation.z = Math.sin(st.t * 3) * 0.04 * m;
    P.blob.material.opacity = 0.28 * (1 - st.air * 0.6);
    void _e;
  };
  api.setOutfit(0);
  return api;
}

export { createCharacter, OUTFITS };
