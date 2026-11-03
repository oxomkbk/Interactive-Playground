/* =========================================================================
   GUIDE — "show me the way": pick an attraction (its console, the atlas or the park map) and a ribbon of
   drifting golden motes rises from the paths and flows toward it, with a column of light over the destination.
   The route follows the park's path graph (the same one the visitors walk), is recomputed if you wander off
   it, and dissolves with a chime when you arrive.
   ========================================================================= */
import * as THREE from 'three';

const MAXP = 1600;

function createGuide({ nodes, walk, onArrive }) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(MAXP * 3), aU = new Float32Array(MAXP * 2);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aU', new THREE.BufferAttribute(aU, 2)); g.setDrawRange(0, 0);
  const U = { uT: { value: 0 }, uLen: { value: 1 }, uFade: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uT, uLen; attribute vec2 aU; varying float vB; varying float vU;
      void main(){ float u = aU.x, r = aU.y; vec3 p = position; p.y += 0.25 + sin(uT * 2.0 + r * 30.0) * 0.12 + r * 0.25; p.x += sin(uT * 1.3 + r * 50.0) * 0.12; p.z += cos(uT * 1.1 + r * 40.0) * 0.12;
        float wave = pow(0.5 + 0.5 * sin(u * 0.6 - uT * 4.0), 6.0); vB = 0.25 + wave * 1.6; vU = u / uLen;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (90.0 + wave * 120.0) * (0.6 + r * 0.6) / -mv.z; }`,
    fragmentShader: `uniform float uFade; varying float vB; varying float vU; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      vec3 c = mix(vec3(1.0, 0.85, 0.55), vec3(0.55, 0.95, 1.0), vU); gl_FragColor = vec4(c * vB * 2.0, exp(-d * d * 14.0) * uFade); }` });
  const motes = new THREE.Points(g, mat); motes.frustumCulled = false;
  // the beacon: a soft column of light and a turning ring
  const bm = new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uFade: U.uFade }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uFade; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * (0.6 + 0.4 * sin(vUv.y * 20.0 - uT * 3.0)); gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * 1.6, a * 0.35 * uFade); }` });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 34, 24, 1, true).translate(0, 17, 0), bm);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.0, 1.2), transparent: true, opacity: 0.8 })); ring.position.y = 0.15;
  const root = new THREE.Group(); root.add(motes, beacon, ring); root.visible = false; root.name = 'guide';
  const S = { target: null, dest: null, route: [], check: 0 };

  function nearestNode(p) { let b = 0, bd = 1e9; nodes.forEach((n, i) => { const d = Math.hypot(n.p.x - p.x, n.p.z - p.z); if (d < bd) { bd = d; b = i; } }); return b; }
  function shortest(a, b) {                                       // Dijkstra over ~80 nodes
    const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = new Set(); dist[a] = 0;
    while (done.size < nodes.length) { let u = -1, ud = Infinity; dist.forEach((d, i) => { if (!done.has(i) && d < ud) { ud = d; u = i; } }); if (u < 0 || u === b) break; done.add(u);
      for (const v of nodes[u].n) { const w = ud + nodes[u].p.distanceTo(nodes[v].p); if (w < dist[v]) { dist[v] = w; prev[v] = u; } } }
    const path = []; for (let v = b; v >= 0; v = prev[v]) path.unshift(v); return path[0] === a ? path : [a, b];
  }
  function build(from) {
    const d = S.dest, start = nearestNode(from); let end = nodes.findIndex(n => n.tag === S.target); if (end < 0) end = nearestNode(d);
    const pts = [from.clone(), ...shortest(start, end).map(i => nodes[i].p.clone()), d.clone()];
    // drop a first node that lies behind us
    if (pts.length > 2 && pts[1].distanceTo(pts[2]) > from.distanceTo(pts[2])) pts.splice(1, 1);
    S.route = pts; let n = 0, acc = 0;
    for (let i = 0; i < pts.length - 1 && n < MAXP; i++) { const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
      for (let s = 0; s < len && n < MAXP; s += 0.55) { const k = s / len; pos[n * 3] = a.x + (b.x - a.x) * k; pos[n * 3 + 1] = walk.groundAt(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k); pos[n * 3 + 2] = a.z + (b.z - a.z) * k; aU[n * 2] = acc + s; aU[n * 2 + 1] = Math.random(); n++; }
      acc += len; }
    U.uLen.value = acc; g.setDrawRange(0, n); g.attributes.position.needsUpdate = g.attributes.aU.needsUpdate = true; g.computeBoundingSphere();
  }
  const distToRoute = (p) => { let best = Infinity; for (let i = 0; i < S.route.length - 1; i++) { const a = S.route[i], b = S.route[i + 1], ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6))); best = Math.min(best, a.clone().addScaledVector(ab, t).setY(p.y).distanceTo(p)); } return best; };
  return {
    object3D: root, S,
    to(att, from, standPoint) { S.target = att; S.dest = new THREE.Vector3(standPoint.x, walk.groundAt(standPoint.x, standPoint.z), standPoint.z); build(from);
      beacon.position.copy(S.dest); ring.position.set(S.dest.x, S.dest.y + 0.15, S.dest.z); root.visible = true; },
    clear() { S.target = null; },
    update(dt, t, p) {
      U.uT.value = t; ring.rotation.y = t;
      U.uFade.value += ((S.target ? 1 : 0) - U.uFade.value) * Math.min(1, dt * 3); root.visible = U.uFade.value > 0.01; if (!S.target || !p) return;
      if (Math.hypot(p.x - S.dest.x, p.z - S.dest.z) < 3.5) { const a = S.target; S.target = null; onArrive && onArrive(a); return; }
      if ((S.check -= dt) <= 0) { S.check = 1; if (distToRoute(p) > 7) build(p.clone()); }
    },
  };
}

export { createGuide };
