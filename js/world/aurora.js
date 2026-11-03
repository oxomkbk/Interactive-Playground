/* =========================================================================
   AURORA — flowing ribbons of light, raymarched through a thin emissive layer high above the park.
   Rendered every other frame into a small HDR equirect texture (azimuth × elevation, 1024×320) so the
   expensive march costs a fraction of a full-screen pass; the sky dome samples it by view direction and
   the lake samples it by reflection direction, so the aurora shimmers in the water too.
   Look: folded curtains from layered triangle-wave noise (domain-warped, drifting), a crisp green lower edge,
   violet / magenta crowns fading upward, soft temporal undulation, horizon fade into the fog colour.
   ========================================================================= */
import * as THREE from 'three';
import { renderer } from '../core/renderer.js';
import { onUpdate } from '../core/registry.js';
import { S } from '../game/play.js';
import { t } from '../core/i18n.js';

const AUR = { rt: null, scene: null, cam: null, mat: null, tick: 0 };
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const FS = `
precision highp float; varying vec2 vUv; uniform float uTime, uI, uHue;
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float tri(float x){ return clamp(abs(fract(x) - .5), .01, .49); }
vec2 tri2(vec2 p){ return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x))); }
float triNoise(vec2 p, float spd){
  float z = 1.8, z2 = 2.5, rz = 0.; p *= rot(p.x * .06); vec2 bp = p;
  for (int i = 0; i < 5; i++){ vec2 dg = tri2(bp * 1.85) * .75; dg *= rot(uTime * spd); p -= dg / z2; bp *= 1.3; z2 *= .45; z *= .42;
    p *= 1.21 + (rz - 1.) * .02; rz += tri(p.x + tri(p.y)) * z; p *= -mat2(.95534, .29552, -.29552, .95534); }
  return clamp(1. / pow(rz * 29., 1.3), 0., .55);
}
float h21(vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
void main(){
  float az = (vUv.x - .5) * 6.2831853, el = vUv.y * 1.5707963;
  vec3 rd = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
  vec3 ro = vec3(0., 0., -6.7);
  vec4 col = vec4(0.), avg = vec4(0.);
  for (int i = 0; i < 42; i++){ float fi = float(i);
    float of = .006 * h21(gl_FragCoord.xy) * smoothstep(0., 15., fi);
    float pt = ((.8 + pow(fi, 1.4) * .002) - ro.y) / (rd.y * 2. + .4) - of;
    vec3 bp = ro + pt * rd; float rz = triNoise(bp.zx, .06);
    // colour runs green (low) → teal → violet → magenta (high); uHue rotates it gently over the show
    vec3 c = mix(vec3(.15, 1., .42), vec3(.25, .9, .85), smoothstep(6., 18., fi));
    c = mix(c, vec3(.55, .3, 1.), smoothstep(16., 30., fi)); c = mix(c, vec3(1., .35, .75), smoothstep(28., 41., fi) * (.6 + .4 * sin(uHue)));
    vec4 c2 = vec4(c * rz, rz); avg = mix(avg, c2, .5);
    col += avg * exp2(-fi * .065 - 2.5) * smoothstep(0., 5., fi);
  }
  col *= clamp(rd.y * 15. + .4, 0., 1.);
  vec3 cc = col.rgb * 1.5; float l = max(max(cc.r, cc.g), cc.b);
  cc *= pow(smoothstep(.16, .8, l), 1.7);                         // contrast: the glow between curtains falls to black, the folds stay crisp
  cc = cc / (1. + l * .6);                                        // soft shoulder: bright folds never flare
  gl_FragColor = vec4(cc * uI, 1.);
}`;
function buildAurora() {
  AUR.rt = new THREE.WebGLRenderTarget(1024, 320, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false });
  AUR.rt.texture.wrapS = THREE.RepeatWrapping;
  AUR.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uTime: { value: 0 }, uI: { value: 1 }, uHue: { value: 0 } }, depthTest: false, depthWrite: false });
  AUR.scene = new THREE.Scene(); AUR.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), AUR.mat)); AUR.cam = new THREE.Camera();
  onUpdate((dt, t) => {
    AUR.mat.uniforms.uTime.value = t * 0.9; AUR.mat.uniforms.uHue.value = t * 0.05;
    if ((AUR.tick++ & 1) && AUR.ready) return;               // every other frame is plenty for slow light
    const prev = renderer.getRenderTarget(), pa = renderer.autoClear; renderer.setRenderTarget(AUR.rt); renderer.autoClear = true;
    renderer.render(AUR.scene, AUR.cam); renderer.setRenderTarget(prev); renderer.autoClear = pa; AUR.ready = true;
  });
  return AUR.rt.texture;
}
// GLSL helper shared by the sky and the lake: sample the aurora by a world direction
const AURORA_GLSL = `vec3 auroraAt(sampler2D tx, vec3 d){ if (d.y <= 0.) return vec3(0.);
  float az = atan(d.x, -d.z), el = asin(clamp(d.y, 0., 1.)); return texture2D(tx, vec2(az / 6.2831853 + .5, el / 1.5707963)).rgb; }`;

export { AUR, buildAurora, AURORA_GLSL };
