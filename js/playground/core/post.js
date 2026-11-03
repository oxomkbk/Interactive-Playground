/* =========================================================================
   POST — MSAA half-float render (with a depth texture) → Lens (screen-space ambient occlusion from the real depth
   buffer, so grass blades and alpha-cut leaves occlude correctly; depth of field for the cinematic camera) → Outline (hover/selection glow) → Unreal Bloom (only HDR-bright things:
   bulbs, lanterns, windows, the sun) → a finishing pass (deep-purple lift in the shadows, warm highlights,
   soft vignette, film grain, a whisper of chromatic aberration at the edges) → OutputPass (ACES + sRGB).
   The Low tier renders straight to the screen.
   ========================================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from '../config.js';
import { renderer, scene, camera, Q, onQuality } from './renderer.js';
import { lookNum, lookColor, sunDir } from './mood.js';
import { WX } from './settings.js';
const _sd = new THREE.Vector3(), _sp = new THREE.Vector3();
import { SET } from './settings.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const P = CONFIG.post;
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uLift: { value: new THREE.Color(P.lift) }, uWarm: { value: new THREE.Color(P.warm) }, uShadow: { value: new THREE.Color(1, 1, 1) }, uHigh: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: P.vignette }, uGrain: { value: P.grain }, uCA: { value: P.aberration }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec3 uLift, uWarm, uShadow, uHigh; uniform float uSat, uContrast; uniform float uVignette, uGrain, uCA, uTime; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 off = d * uCA * r2 * 4.0;                                               // aberration grows toward the corners
      vec4 c = texture2D(tDiffuse, vUv); c.r = texture2D(tDiffuse, vUv + off).r; c.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb *= mix(uShadow, uHigh, smoothstep(0.02, 0.9, l));                      // split tone: the mood's shadow and highlight colours
      c.rgb = max(0.18 * pow(max(c.rgb, 0.0) / 0.18, vec3(uContrast)), 0.0);      // contrast around mid-grey
      l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, uSat);
      { float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), s0 = (mx - mn) / max(mx, 1e-4); c.rgb = mix(vec3(l), c.rgb, 1.0 + 0.4 * (1.0 - s0)); }   // vibrance: muted colours gain the most
      c.rgb += uLift * (1.0 - smoothstep(0.0, 0.2, l)) * 0.03;
      c.rgb *= 1.0 - r2 * uVignette;
      c.rgb += (hash(vUv * 1013.0 + fract(uTime) * 91.0) - 0.5) * uGrain * (0.35 + l * 0.5);
      gl_FragColor = c;
    }`,
};

// one full-screen pass: depth-only SSAO (12 taps, view space, range-checked) and a golden-spiral bokeh DOF
const LensShader = {
  uniforms: { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 0.2 }, uFar: { value: 2400 }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
    uRes: { value: new THREE.Vector2(1, 1) }, uAO: { value: 1 }, uRadius: { value: 0.9 }, uDof: { value: 0 }, uFocus: { value: 6 }, uAperture: { value: 0.02 }, uMaxBlur: { value: 9 },
    uSunUV: { value: new THREE.Vector2() }, uRays: { value: 0 }, uRayColor: { value: new THREE.Color() }, uSunView: { value: new THREE.Vector3() }, uScatter: { value: 0 }, uScatterColor: { value: new THREE.Color() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uAO, uRadius, uDof, uFocus, uAperture, uMaxBlur, uRays, uScatter; uniform vec2 uSunUV; uniform vec3 uRayColor, uSunView, uScatterColor; uniform mat4 uProj, uInvProj; uniform vec2 uRes; varying vec2 vUv;
    float viewZ(vec2 uv){ return perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
    vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = uInvProj * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float cocAt(float z){ return clamp(abs(z - uFocus) / max(z, 0.1) * uAperture * 60.0, 0.0, 1.0); }
    void main(){
      vec4 col = texture2D(tColor, vUv); float d0 = texture2D(tDepth, vUv).x;
      if (uAO > 0.0 && d0 < 0.9999 && -perspectiveDepthToViewZ(d0, uNear, uFar) < 160.0) {
        vec3 P = viewPos(vUv); vec3 N = normalize(cross(dFdx(P), dFdy(P)));
        float rad = uRadius * uProj[1][1] / max(-P.z, 0.5) * 0.5, occ = 0.0, a0 = 0.0;  // fixed spiral: no per-pixel noise to crawl over surfaces as the camera moves
        for (int i = 0; i < 8; i++) { float fi = float(i) + 0.5, r = sqrt(fi / 8.0) * rad, a = a0 + fi * 2.39996;
          vec2 suv = vUv + vec2(cos(a), sin(a)) * r * vec2(uRes.y / uRes.x, 1.0); vec3 S = viewPos(suv), v = S - P; float l = length(v);
          occ += max(dot(N, v / max(l, 1e-4)) - 0.08, 0.0) * smoothstep(uRadius * 2.2, uRadius * 0.4, l); }
        float ao = clamp(1.0 - occ / 8.0 * 1.1 * uAO, 0.0, 1.0);
        col.rgb *= mix(1.0, ao, smoothstep(160.0, 40.0, -P.z));                      // fades out with distance
      }
      // aerial perspective: distant surfaces pick up light scattered from the sun's side of the sky
      if (uScatter > 0.0 && d0 < 0.9999) { vec3 P = viewPos(vUv); float dist = length(P), mu = max(dot(normalize(P), uSunView), 0.0);
        col.rgb += uScatterColor * (pow(mu, 5.0) * 0.9 + 0.1) * (1.0 - exp(-dist * 0.0035)) * uScatter; }
      // god rays: march toward the sun through the depth buffer; only open, bright sky lets light through
      if (uRays > 0.0) { vec2 dl = (uSunUV - vUv) / 20.0; vec2 p = vUv; float acc = 0.0, w = 1.0;
        for (int i = 0; i < 20; i++) { p += dl; if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) break;
          float sky = step(0.99995, texture2D(tDepth, p).x); vec3 sc = texture2D(tColor, p).rgb;
          acc += sky * (0.25 + 0.75 * smoothstep(0.6, 3.0, dot(sc, vec3(0.3, 0.59, 0.11)))) * w; w *= 0.955; }
        float fall = 1.0 - smoothstep(0.0, 0.85, length((vUv - uSunUV) * vec2(uRes.x / uRes.y, 1.0)));
        col.rgb += uRayColor * acc / 20.0 * fall * uRays; }
      if (uDof > 0.0) {
        float z = -viewZ(vUv), coc = cocAt(z) * uDof;
        if (coc > 0.02) { vec3 acc = col.rgb; float w = 1.0;
          for (int i = 0; i < 24; i++) { float fi = float(i) + 0.5, r = sqrt(fi / 24.0) * coc * uMaxBlur, a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * r / uRes; vec3 c = texture2D(tColor, vUv + o).rgb; float zs = -viewZ(vUv + o);
            float k = zs < z ? cocAt(zs) : 1.0; acc += c * k; w += k; }
          col.rgb = acc / w; }
      }
      gl_FragColor = col;
    }`,
};
// the first pass: the scene is drawn once into its own 4× MSAA target (with a depth texture), then the lens
// shader reads the resolved colour and depth and writes into the composer's plain (non-multisampled) buffers.
// Only this one target pays for multisampling and its resolve; every later pass works on single-sample images.
class LensPass extends Pass {
  constructor() { super(); this.mat = new THREE.ShaderMaterial({ ...LensShader, uniforms: THREE.UniformsUtils.clone(LensShader.uniforms) }); this.quad = new FullScreenQuad(this.mat); this.U = this.mat.uniforms;
    this.target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }); this.target.depthTexture = new THREE.DepthTexture(2, 2); }
  setSize(w, h) { this.target.setSize(w, h); }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.target); renderer.clear(); renderer.render(scene, camera);
    const U = this.U, T = this.target; U.tColor.value = T.texture; U.tDepth.value = T.depthTexture; U.uNear.value = camera.near; U.uFar.value = camera.far;
    U.uProj.value.copy(camera.projectionMatrix); U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uRes.value.set(T.width, T.height);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
}

// bloom as a mip chain: bright-pass + 13-tap downsample to ½, four more downsamples, then tent-filtered
// upsamples accumulating back up, added onto the image. A dozen tiny passes, a few hundred microseconds.
const QV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
class GlowPass extends Pass {
  constructor() { super(); this.needsSwap = false; this.strength = 0.6; this.threshold = 1.0; this.radius = 0.8; this.levels = 5; this.mips = [];
    for (let i = 0; i < this.levels; i++) this.mips.push(new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false }));
    // the upsample chain writes into its own targets: never into a texture the same chain just read (on some GPU
    // drivers that read-after-write on one texture forces a stall that costs far more than the blur itself)
    this.ups = []; for (let i = 0; i < this.levels - 1; i++) this.ups.push(new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false }));
    this.down = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, texel: { value: new THREE.Vector2() }, uTh: { value: 1 }, uFirst: { value: 1 } }, vertexShader: QV, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t; uniform vec2 texel; uniform float uTh, uFirst; varying vec2 vUv;
        // first pass: every sample is soft-compressed before averaging (a Karis-style firefly guard), so one ultra-
        // bright bulb pixel can't spread into a large bloom disc with ringing at its edge
        vec3 s(vec2 o){ vec3 x = texture2D(t, vUv + o * texel).rgb; return uFirst > 0.5 ? x / (1.0 + max(x.r, max(x.g, x.b)) * 0.25) : x; }
        void main(){ vec3 c = s(vec2(0)) * 0.125 + (s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1))) * 0.125
          + (s(vec2(-2,0)) + s(vec2(2,0)) + s(vec2(0,-2)) + s(vec2(0,2))) * 0.0625 + (s(vec2(-2,-2)) + s(vec2(2,-2)) + s(vec2(-2,2)) + s(vec2(2,2))) * 0.03125;
          if (uFirst > 0.5) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uTh * 0.55, uTh * 0.9, l); c = min(c, vec3(3.0)); }
          gl_FragColor = vec4(c, 1.0); }` });
    this.up = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, tSame: { value: null }, texel: { value: new THREE.Vector2() }, uR: { value: 1 } }, vertexShader: QV, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t, tSame; uniform vec2 texel; uniform float uR; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(t, vUv + o * texel * uR).rgb; }
        void main(){ vec3 c = (s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1))) * 0.0625 + (s(vec2(-1,0)) + s(vec2(1,0)) + s(vec2(0,-1)) + s(vec2(0,1))) * 0.125 + s(vec2(0)) * 0.25;
          gl_FragColor = vec4(c + texture2D(tSame, vUv).rgb, 1.0); }` });
    this.add = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, uS: { value: 1 } }, vertexShader: QV, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t; uniform float uS; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * uS, 1.0); }` });
    this.quad = new FullScreenQuad(null);
  }
  setSize(w, h) { this.mips.forEach((m, i) => m.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1)))); this.ups.forEach((m, i) => m.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1)))); }
  render(renderer, writeBuffer, readBuffer) {
    const q = this.quad, auto = renderer.autoClear; renderer.autoClear = false;
    let src = readBuffer.texture, sw = readBuffer.width, sh = readBuffer.height;
    q.material = this.down; this.down.uniforms.uTh.value = this.threshold;
    for (let i = 0; i < this.levels; i++) { this.down.uniforms.t.value = src; this.down.uniforms.texel.value.set(1 / sw, 1 / sh); this.down.uniforms.uFirst.value = i === 0 ? 1 : 0;
      renderer.setRenderTarget(this.mips[i]); renderer.clear(); q.render(renderer); src = this.mips[i].texture; sw = this.mips[i].width; sh = this.mips[i].height; }
    q.material = this.up; this.up.uniforms.uR.value = this.radius;
    let small = this.mips[this.levels - 1];
    for (let i = this.levels - 1; i > 0; i--) { this.up.uniforms.t.value = small.texture; this.up.uniforms.tSame.value = this.mips[i - 1].texture; this.up.uniforms.texel.value.set(1 / small.width, 1 / small.height);
      renderer.setRenderTarget(this.ups[i - 1]); q.render(renderer); small = this.ups[i - 1]; }
    q.material = this.add; this.add.uniforms.t.value = small.texture; this.add.uniforms.uS.value = this.strength;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer); q.render(renderer); renderer.autoClear = auto;
  }
}

function createPost() {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType });   // single-sample: post passes only
  const composer = new EffectComposer(renderer, rt);
  const lens = new LensPass(); composer.addPass(lens); void RenderPass;
  const outline = new OutlinePass(new THREE.Vector2(innerWidth, innerHeight), scene, camera);
  Object.assign(outline, { edgeStrength: 4, edgeGlow: 0.6, edgeThickness: 1.6, pulsePeriod: 2.4 });
  outline.visibleEdgeColor.set('#FFD1E4'); outline.hiddenEdgeColor.set('#C8A2E8');
  composer.addPass(outline);
  const bloom = new GlowPass(); bloom.threshold = P.bloomThreshold; composer.addPass(bloom); void UnrealBloomPass;
  const finish = new ShaderPass(FinishShader); composer.addPass(finish);
  composer.addPass(new OutputPass());
  const size = () => { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); outline.enabled = Q.outline; };
  size(); onQuality(size);
  const S = { bloomScale: 1, dof: false, focus: 6 }; // the UI's bloom slider; depth of field (cinematic camera) and its focus distance
  return {
    outline, bloom, S, lens,
    setOutlined(list) { outline.selectedObjects = list; },
    render(dt, elapsed) {
      if (!Q.bloom) { renderer.render(scene, camera); return; }
      bloom.strength = lookNum('bloom') * S.bloomScale; finish.uniforms.uTime.value = elapsed;
      outline.enabled = Q.outline && outline.selectedObjects.length > 0;
      // the mood's grade, rays and scattering
      const F = finish.uniforms; lookColor('grade.shadow', F.uShadow.value); lookColor('grade.high', F.uHigh.value); F.uSat.value = lookNum('grade.sat'); F.uContrast.value = lookNum('grade.contrast');
      sunDir(_sd); const below = _sd.y < -0.02; _sp.copy(camera.position).addScaledVector(_sd, 1000).project(camera);
      const onScreen = _sp.z < 1 && Math.abs(_sp.x) < 1.6 && Math.abs(_sp.y) < 1.6, vis = onScreen && !below ? (1 - Math.max(0, Math.max(Math.abs(_sp.x), Math.abs(_sp.y)) - 1) / 0.6) * (1 - WX.cover * 0.8) : 0;
      lens.U.uSunUV.value.set(_sp.x * 0.5 + 0.5, _sp.y * 0.5 + 0.5); lens.U.uRays.value = lookNum('grade.rays') * vis * (SET.rays !== false ? 1 : 0); lookColor('grade.rayColor', lens.U.uRayColor.value);
      lens.U.uSunView.value.copy(_sd).transformDirection(camera.matrixWorldInverse); lens.U.uScatter.value = lookNum('grade.scatter') * (1 - WX.cover * 0.6); lookColor('grade.rayColor', lens.U.uScatterColor.value);
      const L = lens.U; L.uAO.value = SET.ao !== false ? (Q.level === 'high' ? 1 : 0.8) : 0; L.uDof.value += ((S.dof && SET.dof !== false ? 1 : 0) - L.uDof.value) * Math.min(1, dt * 3); L.uFocus.value = S.focus;
      // (the lens pass also draws the scene, so it always runs; its effects switch off through their uniforms)
      composer.render(dt);
    },
  };
}

export { createPost };
