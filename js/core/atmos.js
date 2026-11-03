/* =========================================================================
   ATMOSPHERE — physically based height fog with sun in-scattering, evaluated in every lit material.
   Replaces three's distance fog with the analytic integral of an exponential-height participating medium along
   the view ray: optical depth τ = a·e^(−b·h_cam)·d·(1 − e^(−b·Δy))/(b·Δy); transmittance T = e^(−τ).
   In-scattered light = ambient sky radiance (the horizon colour) + sun radiance × Henyey–Greenstein phase, so
   the air glows toward the sun, valleys fill with haze and distance gains real depth.
   It lives in the material shaders, so it is part of the raw render (no post pass).
   ========================================================================= */
import * as THREE from 'three';

const ATM = { u: { uAtmSun: { value: new THREE.Color() }, uAtmDir: { value: new THREE.Vector3(0, 1, 0) }, uAtmH: { value: new THREE.Vector4(0.0009, 0.018, 0, 0.62) } } };
const FRAG = `#ifdef USE_FOG
  { vec3 rd = vAtmW - cameraPosition; float dist = length( rd ); vec3 dir = rd / max( dist, 1e-3 );
    float a = uAtmH.x, b = uAtmH.y, dy = rd.y, bd = b * dy;
    float od = a * exp( -b * ( cameraPosition.y - uAtmH.z ) ) * dist * ( abs( bd ) > 1e-4 ? ( 1. - exp( -bd ) ) / bd : 1. );
    float T = exp( -od ), g = uAtmH.w, ct = dot( dir, uAtmDir ), ph = ( 1. - g * g ) / ( 12.566371 * pow( max( 1. + g * g - 2. * g * ct, 1e-4 ), 1.5 ) );
    gl_FragColor.rgb = gl_FragColor.rgb * T + ( fogColor + uAtmSun * ph ) * ( 1. - T ); }
#endif`;
function patchFog(m) {
  if (!m || !m.fog || m.isShaderMaterial || m.isRawShaderMaterial || m.userData.atm) return; m.userData.atm = true;
  const prev = m.onBeforeCompile, hasPrev = prev && prev !== THREE.Material.prototype.onBeforeCompile;
  const prevKey = m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null, prevSrc = hasPrev ? prev.toString() : '';
  m.onBeforeCompile = (sh, r) => { if (hasPrev) prev.call(m, sh, r); Object.assign(sh.uniforms, ATM.u);
    sh.vertexShader = sh.vertexShader.replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\n#ifdef USE_FOG\nvarying vec3 vAtmW;\n#endif')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n#ifdef USE_FOG\nvAtmW = mvPosition.xyz * mat3( viewMatrix ) + cameraPosition;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\n#ifdef USE_FOG\nvarying vec3 vAtmW; uniform vec3 uAtmSun, uAtmDir; uniform vec4 uAtmH;\n#endif')
      .replace('#include <fog_fragment>', FRAG); };
  m.customProgramCacheKey = () => 'atm|' + (prevKey ? prevKey() : prevSrc); m.needsUpdate = true;
}
function patchSceneFog(scene) { scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) patchFog(m); }); }
// density a (1/m at the base), falloff b (1/m), base height h0, anisotropy g; sunRad: pre-exposed sun term (colour × illuminance × scattering albedo)
function setAtmosphere({ a, b, h0, g, sunDir, sunRad }) { const h = ATM.u.uAtmH.value; if (a !== undefined) h.x = a; if (b !== undefined) h.y = b; if (h0 !== undefined) h.z = h0; if (g !== undefined) h.w = g;
  if (sunDir) ATM.u.uAtmDir.value.copy(sunDir); if (sunRad) ATM.u.uAtmSun.value.copy(sunRad); }
export { ATM, patchFog, patchSceneFog, setAtmosphere };
