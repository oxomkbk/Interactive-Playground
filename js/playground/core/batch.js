/* =========================================================================
   BATCH — draw-call control. Static parts are collected per material and merged into ONE mesh per material;
   repeated things go through `instanced()`. A whole bench row, a lamp ring or an attraction's frame costs
   one draw per material, however many pieces it has. Painted / matte materials go further: their colour is baked
   into vertex colours so every colour of the same finish shares a single draw.
   ========================================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();

// geometry → plain non-indexed position/normal/uv, so anything can merge with anything
function normalize(g, tint = null) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (tint) { const c = new Float32Array(n.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = tint.r; c[i + 1] = tint.g; c[i + 2] = tint.b; } n.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  if (!n.attributes.normal) n.computeVertexNormals();
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  n.morphAttributes = {}; n.clearGroups(); return n;
}

function createBatch(name = 'batch') {
  const groups = new Map(); // key: material uuid + shadow flag
  const api = {
    // add(geometry, material, [x, y, z] | Matrix4, { rotY, rot:[x,y,z], scale, cast })
    add(geo, material, at = null, o = {}) {
      const fam = material.userData.family && material.userData.family(), g = normalize(geo, fam ? material.color : null);
      if (fam) material = fam;
      if (at && at.isMatrix4) g.applyMatrix4(at);
      else if (at || o.rot || o.rotY || o.scale) {
        _e.set(...(o.rot || [0, o.rotY || 0, 0])); _q.setFromEuler(_e);
        const s = o.scale ?? 1; _s.set(...(Array.isArray(s) ? s : [s, s, s]));
        g.applyMatrix4(_m.compose(_p.set(...(at || [0, 0, 0])), _q, _s));
      }
      const cast = !!o.cast, key = material.uuid + (cast ? ':c' : '');
      if (!groups.has(key)) groups.set(key, { material, cast, geos: [] }); groups.get(key).geos.push(g); return api;
    },
    // merge everything into one mesh per material under a group
    build(parent) {
      const root = new THREE.Group(); root.name = name;
      for (const { material, cast, geos } of groups.values()) {
        const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose()); if (!merged) continue;
        merged.computeBoundingSphere(); const m = new THREE.Mesh(merged, material); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; root.add(m);
      }
      groups.clear(); if (parent) parent.add(root); return root;
    },
  };
  return api;
}

// instanced mesh from transforms [{ p:[x,y,z], r:[x,y,z], s:number|[x,y,z], c:color }]
function instanced(geo, material, items, { cast = false, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, material, Math.max(1, items.length));
  items.forEach((it, i) => {
    _e.set(...(it.r || [0, 0, 0])); _q.setFromEuler(_e); const s = it.s ?? 1; _s.set(...(Array.isArray(s) ? s : [s, s, s]));
    im.setMatrixAt(i, _m.compose(_p.set(...it.p), _q, _s)); if (it.c !== undefined) im.setColorAt(i, new THREE.Color(it.c));
  });
  im.count = items.length; im.castShadow = cast; im.receiveShadow = receive; im.computeBoundingSphere(); return im;
}

export { createBatch, instanced };
