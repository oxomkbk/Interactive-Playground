/* =========================================================================
   SURFACE — realism at the source, shared by both parks (each passes its own palette; no art direction lives here).

   weather(material, opts) injects world-space surface variation into any MeshStandard/Physical material:
     • macro variation: two octaves of 3D value noise modulate albedo (±value, slight hue drift) and roughness,
       so no surface reads as one flat colour and texture tiling disappears at distance;
     • ground grime: dirt and damp accumulate in the bottom metre of every object (darker, rougher, tinted);
     • rain streaks: soft vertical runs on walls (only on near-vertical faces), strongest under ledges;
     • top deposit: dust / moss / wetness on up-facing surfaces (palette-controlled);
     • edge wear: a cheap curvature proxy from screen-space normal derivatives brightens convex edges slightly
       (chipped paint, polished corners) so bevels catch light.
   bev(w, h, d) returns a bevelled box with world-scaled UVs — the replacement for every raw BoxGeometry, so no
   edge in either park is a mathematically sharp primitive.
   ========================================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const NOISE = `
float sv_h(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float sv_n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(sv_h(i),sv_h(i+vec3(1,0,0)),f.x),mix(sv_h(i+vec3(0,1,0)),sv_h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(sv_h(i+vec3(0,0,1)),sv_h(i+vec3(1,0,1)),f.x),mix(sv_h(i+vec3(0,1,1)),sv_h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float sv_f(vec3 p){ return sv_n(p)*.55+sv_n(p*2.13+7.1)*.3+sv_n(p*4.7+3.3)*.15; }`;
const DEFAULTS = { macro: 0.14, rough: 0.12, grime: 0.35, grimeH: 1.1, grimeCol: [0.18, 0.15, 0.12], streak: 0.18, top: 0, topCol: [0.3, 0.36, 0.22], topRough: 0, edge: 0.06, scale: 1 };
const seen = new WeakSet();
function weather(m, o = {}) {
  if (!m || !m.isMeshStandardMaterial || seen.has(m) || m.userData.noWeather) return m; seen.add(m);
  const P = { ...DEFAULTS, ...o }, prev = m.onBeforeCompile, hasPrev = prev && prev !== THREE.Material.prototype.onBeforeCompile;
  // keep any earlier shader patch's identity in the program key, so differently-patched materials never share a program
  const prevKey = m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.call(m) : (hasPrev ? prev.toString() : '');
  m.onBeforeCompile = (sh, r) => {
    if (hasPrev) prev.call(m, sh, r);
    sh.uniforms.svP = { value: new THREE.Vector4(P.macro, P.rough, P.grime, P.grimeH) }; sh.uniforms.svQ = { value: new THREE.Vector4(P.streak, P.top, P.edge, P.scale) };
    sh.uniforms.svG = { value: new THREE.Color(...P.grimeCol) }; sh.uniforms.svT = { value: new THREE.Color(...P.topCol) }; sh.uniforms.svTR = { value: P.topRough }; sh.uniforms.svWet = WET;
    if (P.tp && P.tp.alt) { const A = P.tp.alt; sh.uniforms.taD = { value: A.diff }; sh.uniforms.taN = { value: A.nor }; sh.uniforms.taA = { value: A.arm }; sh.uniforms.taS = { value: new THREE.Vector4(A.scale, A.lo, A.hi, A.h0) }; sh.uniforms.taH = { value: A.h1 }; }
    const TP = P.tp; if (TP) { sh.uniforms.tpD = { value: TP.diff }; sh.uniforms.tpN = { value: TP.nor }; sh.uniforms.tpA = { value: TP.arm }; sh.uniforms.tpS = { value: new THREE.Vector4(TP.scale, TP.nScale ?? 1, TP.far ?? 0.22, TP.ao ?? 1) }; }
    sh.vertexShader = 'varying vec3 svW; varying vec3 svN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec4 kw = vec4(transformed, 1.); vec3 kn = objectNormal;
        #ifdef USE_INSTANCING
          kw = instanceMatrix * kw; kn = mat3(instanceMatrix) * kn;
        #endif
        kw = modelMatrix * kw; svW = kw.xyz; svN = normalize(mat3(modelMatrix) * kn); }`);
    let fs = sh.fragmentShader;
    if (TP) { // world-space triplanar scanned surfaces: constant texel density on any geometry, no UV seams, distance-blended to kill tiling
      const sw = TP.rot ? '.yx' : '';
      fs = fs.replace('#include <map_fragment>', `
      vec3 tpNw = normalize(svN) * (gl_FrontFacing ? 1. : -1.); vec3 tpB = pow(abs(tpNw), vec3(5.)); tpB /= dot(tpB, vec3(1.));
      vec2 tpUx = (svW.zy * tpS.x)${sw}, tpUy = (svW.xz * tpS.x)${sw}, tpUz = (svW.xy * tpS.x)${sw};
      vec4 tpCol = texture2D(tpD, tpUx) * tpB.x + texture2D(tpD, tpUy) * tpB.y + texture2D(tpD, tpUz) * tpB.z;
      float tpDist = length(cameraPosition - svW), tpFar = smoothstep(12., 70., tpDist) * tpS.z;
      vec4 tpCol2 = texture2D(tpD, tpUx * .231) * tpB.x + texture2D(tpD, tpUy * .231) * tpB.y + texture2D(tpD, tpUz * .231) * tpB.z;
      tpCol.rgb = mix(tpCol.rgb, tpCol.rgb * (tpCol2.rgb / max(dot(tpCol2.rgb, vec3(.333)), .05)) * dot(tpCol.rgb, vec3(.333)) / max(dot(tpCol.rgb, vec3(.333)), .05), tpFar);
      diffuseColor *= tpCol;
      vec4 tpArm = texture2D(tpA, tpUx) * tpB.x + texture2D(tpA, tpUy) * tpB.y + texture2D(tpA, tpUz) * tpB.z;
      vec3 tX = texture2D(tpN, tpUx).xyz * 2. - 1., tY = texture2D(tpN, tpUy).xyz * 2. - 1., tZ = texture2D(tpN, tpUz).xyz * 2. - 1.;
      ${TP.rot ? 'tX.xy = tX.yx; tY.xy = tY.yx; tZ.xy = tZ.yx;' : ''}
      tX.xy *= tpS.y; tY.xy *= tpS.y; tZ.xy *= tpS.y;
      vec3 nX = vec3(tX.xy + tpNw.zy, abs(tX.z) * tpNw.x), nY = vec3(tY.xy + tpNw.xz, abs(tY.z) * tpNw.y), nZ = vec3(tZ.xy + tpNw.xy, abs(tZ.z) * tpNw.z);
      vec3 tpWN = normalize(nX.zyx * tpB.x + nY.xzy * tpB.y + nZ.xyz * tpB.z);
      ${TP.alt ? `{ // a second scanned surface takes over on steep slopes and high ground (rock breaking through turf), with a noisy edge
        float taK = clamp(smoothstep(taS.z, taS.y, tpNw.y) + smoothstep(taS.w, taH, svW.y), 0., 1.); taK = smoothstep(.35, .65, taK + (sv_f(svW * .15) - .5) * .6);
        if (taK > .001) { vec2 ax = svW.zy * taS.x, ay = svW.xz * taS.x, az = svW.xy * taS.x;
          vec4 aC = texture2D(taD, ax) * tpB.x + texture2D(taD, ay) * tpB.y + texture2D(taD, az) * tpB.z; vec4 aA = texture2D(taA, ax) * tpB.x + texture2D(taA, ay) * tpB.y + texture2D(taA, az) * tpB.z;
          vec3 aN = (texture2D(taN, ax).xyz * 2. - 1.) * tpB.x + (texture2D(taN, ay).xyz * 2. - 1.) * tpB.y + (texture2D(taN, az).xyz * 2. - 1.) * tpB.z;
          diffuseColor.rgb = mix(diffuseColor.rgb, aC.rgb * 1.15, taK); tpArm = mix(tpArm, aA, taK); tpWN = normalize(mix(tpWN, normalize(tpNw + vec3(aN.x, 0., aN.y) * .8), taK)); } }` : ''}`)
      .replace('#include <metalnessmap_fragment>', `roughnessFactor = clamp(roughnessFactor * tpArm.g, ${(TP.minR ?? 0.1).toFixed(3)}, 1.);   // scanned roughness, clamped after every other term (no mirror pixels)\n      #include <metalnessmap_fragment>`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n      metalnessFactor *= mix(1., tpArm.b, step(.5, metalness));')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n      normal = normalize((viewMatrix * vec4(tpWN, 0.)).xyz);')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n      { float tpAO = mix(1., tpArm.r, tpS.w); reflectedLight.indirectDiffuse *= tpAO; reflectedLight.indirectSpecular *= mix(1., tpAO, .7); }');
      fs = 'uniform sampler2D tpD, tpN, tpA; uniform vec4 tpS;\n' + (TP.alt ? 'uniform sampler2D taD, taN, taA; uniform vec4 taS; uniform float taH;\n' : '') + fs;
    }
    sh.fragmentShader = 'varying vec3 svW; varying vec3 svN; uniform vec4 svP, svQ; uniform vec3 svG, svT; uniform float svTR, svWet;\n' + NOISE + '\n' + fs
      .replace('#include <color_fragment>', `#include <color_fragment>
      float svM = sv_f(svW * .35 * svQ.w), svM2 = sv_f(svW * 1.7 * svQ.w + 11.);
      diffuseColor.rgb *= 1. + (svM - .5) * svP.x * 2. + (svM2 - .5) * svP.x * .8;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.04, 1., .95), (svM2 - .5) * svP.x * 2.);
      vec3 svNN = normalize(svN); float svUp = svNN.y, svVert = 1. - abs(svUp);
      float svGr = (1. - smoothstep(0., svP.w, svW.y)) * (.55 + .45 * sv_f(svW * 2.3)) * svP.z * (.25 + .75 * svVert);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * svG * 2.6, clamp(svGr, 0., 1.));
      float svSt = smoothstep(.55, .9, sv_n(vec3(svW.x * 3.1 + svW.z * 3.1, svW.y * .22, svW.z * 2.))) * svVert * svQ.x;
      diffuseColor.rgb *= 1. - svSt * .35;
      float svTp = smoothstep(.55, .95, svUp) * smoothstep(.35, .7, svM2) * svQ.y;
      diffuseColor.rgb = mix(diffuseColor.rgb, svT, clamp(svTp, 0., 1.));
      vec3 svDN = fwidth(svNN); float svEdge = clamp(length(svDN) * 3., 0., 1.) * svQ.z;
      diffuseColor.rgb += svEdge * .25 * (diffuseColor.rgb + .05);
      float svPud = smoothstep(.56, .7, sv_f(svW * .16 + 4.)) * smoothstep(.8, .97, svUp) * svWet;   // rain: darker, glossier surfaces and puddles on the flat
      diffuseColor.rgb *= 1. - svWet * (.22 + .18 * max(svUp, 0.)) - svPud * .2;`)
      .replace('#include <opaque_fragment>', `outgoingLight = min(outgoingLight, vec3(24.));   // firefly clamp: a sub-pixel sun glint can never sear (pre-exposed, so 24× white)
      #include <opaque_fragment>`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (svM - .5) * svP.y * 2. + svGr * .25 + svSt * .1 + svTp * svTR - svEdge * .15, .04, 1.);
      roughnessFactor = mix(roughnessFactor, mix(roughnessFactor * .4 + .04, .03, svPud / max(svWet, 1e-3)), svWet * (.35 + .65 * max(svUp, 0.)));`);
  };
  const keyP = { ...P, tp: P.tp ? { rot: !!P.tp.rot, alt: !!P.tp.alt, minR: P.tp.minR ?? 0.1 } : 0 }; m.customProgramCacheKey = () => 'sv' + JSON.stringify(keyP) + prevKey;
  m.needsUpdate = true; return m;
}
const WET = { value: 0 };   // global wetness 0..1 (rain), shared by every weathered material
function weatherScene(scene, opts, filter = () => true) { scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (filter(m, o)) weather(m, typeof opts === 'function' ? opts(m, o) : opts); }); }
// bevelled box with world-scaled UVs (1 texture tile = `tile` metres)
function bev(w, h, d, r, tile = 2) {
  // bevel detail follows size: sub-centimetre bevels are invisible (plain box), small parts get one rounding segment, large ones two
  const rr = r ?? Math.min(0.06, Math.min(w, h, d) * 0.18), big = Math.max(w, h, d);
  const g = rr < 0.009 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, rr > 0.035 && big > 1.2 ? 2 : 1, rr), uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax >= ay && ax >= az) uv.setXY(i, z / tile, y / tile); else if (ay >= az) uv.setXY(i, x / tile, z / tile); else uv.setXY(i, x / tile, y / tile); }
  return g;
}

export { WET, weather, weatherScene, bev };
