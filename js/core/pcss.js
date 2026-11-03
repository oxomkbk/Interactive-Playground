/* =========================================================================
   PCSS — percentage-closer soft shadows for the directional key light (shared by both parks).
   Real shadows are sharp where an object touches the ground and widen with distance from the occluder, because
   the light source has an angular size. A blocker search in the shadow map finds the average occluder depth,
   the penumbra is sized from (receiver − blocker) × tan(angular radius of the light), and a rotated Poisson
   PCF filters at exactly that width. Contact-hardening at the source — no post-processing involved.
   Swapped in through three's shadow-map shader chunk; switching it on/off recompiles materials once.
   ========================================================================= */
import * as THREE from 'three';

const BASE = THREE.ShaderChunk.shadowmap_pars_fragment;
const PCSS_STATE = { on: false };
// k = (shadow camera depth range, m) × tan(light angular radius) / (shadow frustum width, m) — converts depth difference to UV penumbra
function chunk({ k = 0.05, maxUV = 0.006, minUV = 0.00025, samples = 16 } = {}) {
  // a Vogel (golden-angle) disk, generated once here and baked into the shader as constants; each fragment rotates it
  // by one random angle (one sin/cos pair instead of sixteen, and no per-fragment array writes)
  const disk = []; for (let i = 0; i < samples; i++) { const r = Math.sqrt((i + 0.5) / samples), a = i * 2.39996323; disk.push(`vec2(${(Math.cos(a) * r).toFixed(5)}, ${(Math.sin(a) * r).toFixed(5)})`); }
  const PCSS = `
  #define PCSS_N ${samples}
  const vec2 pcssDisk[PCSS_N] = vec2[PCSS_N]( ${disk.join(', ')} );
  float pcssSoft( sampler2D shadowMap, vec4 c ) {
    vec2 uv = c.xy; float zr = c.z, ang = rand( floor( uv * 4096. ) * .01 ) * PI2; mat2 rot = mat2( cos( ang ), sin( ang ), -sin( ang ), cos( ang ) );
    float sum = 0., n = 0.;
    for ( int i = 0; i < PCSS_N; i ++ ) { float d = unpackRGBAToDepth( texture2D( shadowMap, uv + rot * pcssDisk[ i ] * ${maxUV.toFixed(5)} ) ); if ( d < zr ) { sum += d; n += 1.; } }
    // no blocker anywhere in the widest possible penumbra → fully lit; blockers everywhere in it → fully in umbra
    if ( n < .5 ) return 1.;
    if ( n > float( PCSS_N ) - .5 ) return 0.;
    float zb = sum / n, rad = clamp( ( zr - zb ) * ${k.toFixed(5)}, ${minUV.toFixed(5)}, ${maxUV.toFixed(5)} ), lit = 0.;
    for ( int i = 0; i < PCSS_N; i ++ ) { vec2 o = rot * pcssDisk[ i ] * rad;
      lit += step( zr, unpackRGBAToDepth( texture2D( shadowMap, uv + o ) ) ); lit += step( zr, unpackRGBAToDepth( texture2D( shadowMap, uv - o.yx ) ) ); }
    return lit / float( 2 * PCSS_N ); }
`;
  return BASE.replace('#ifdef USE_SHADOWMAP', '#ifdef USE_SHADOWMAP\n' + PCSS).replace('#if defined( SHADOWMAP_TYPE_PCF )', 'return mix( 1., pcssSoft( shadowMap, shadowCoord ), shadowIntensity );\n\t\t#if defined( SHADOWMAP_TYPE_PCF )');
}
// on/off; pass the scene to recompile its materials when the setting changes at runtime
function setPCSS(on, opts, scene) {
  if (on === PCSS_STATE.on && !opts) return; PCSS_STATE.on = on; THREE.ShaderChunk.shadowmap_pars_fragment = on ? chunk(opts) : BASE;
  if (scene) scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { m.defines = Object.assign(m.defines || {}, { PCSS_ON: on ? 1 : 0 }); m.needsUpdate = true; } });   // the define changes the program key, so cached programs are rebuilt
}
export { setPCSS, PCSS_STATE };
