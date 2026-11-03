/* =========================================================================
   CELESTIAL SKY — the park lives at night, so the sky is one of its attractions. Layers, back to front:
   • the night itself: a blue-black zenith over indigo, the last rose of twilight lingering in the west, the
     park's own warm light-dome rising off the horizon, and a faint green-then-red air-glow band (real night
     skies have it) that ripples slowly
   • the Milky Way arching overhead: a galactic frame with a bright, warm central bulge low in the south-west,
     blue-white star clouds along the arms, a forked dark rift and filaments of dust, rose emission nebulae
     strung along the band, and a dusting of unresolved stars that only the band carries; a faint spiral galaxy
     sits off to the side
   • a ringed planet ("Amoret") rising in the east: banded, lit as a gibbous crescent by the hidden sun, its
     rings tilted across it and passing behind the disc
   • a great comet over the western twilight: a green coma, a straight blue ion tail and a broad, curving cream
     dust tail, both streaming away from the sun below the horizon
   • the moon: maria, craters and ray systems, limb darkening, earthshine on the night side, a coloured
     diffraction corona when thin cloud crosses it and, rarely, a 22° halo
   • moonlit cloud: silver-rimmed on the moon's side, warmed rose-gold underneath by the park
   STARS are real points, not a lattice in the dome: ~9 000 of them (tier-scaled), concentrated toward the
   galactic plane, with a steep brightness distribution (a few brilliant, thousands faint), colour from the
   star's temperature, atmospheric extinction and reddening toward the horizon, scintillation that grows with
   air mass, diffraction spikes on the brightest, and each one dimmed by the same cloud field the dome draws.
   EVENTS: "The Waltzers", the park's own constellation of two dancers joined at the hand by one shared star,
   awakens now and then (or when you stand and gaze up): its stars brighten and a golden thread draws the
   figures across the sky, then fades.
   Image-based light (PMREM) is rendered from the dome so reflections carry the night sky.
   ========================================================================= */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { renderer, scene, camera, BOOT_TIER } from './renderer.js';
import { MOOD, lookColor, lookNum } from './mood.js';
import { SET, WX } from './settings.js';

const RAD = Math.PI / 180;
const dirFrom = (az, el, out = new THREE.Vector3()) => out.set(Math.sin(az * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), Math.cos(az * RAD) * Math.cos(el * RAD)).normalize();
// the galactic frame: the band rises out of the west-south-west horizon and arches over the castle (north) at about
// 48°, so it fills the view whenever you look up the boulevard toward the château, not only straight overhead
const MW_A = dirFrom(255, 2), MW_B = dirFrom(180, 48);
const GN = new THREE.Vector3().crossVectors(MW_A, MW_B).normalize();
const GC = (() => { const v = MW_A.clone().addScaledVector(MW_B, 0.3); return v.sub(GN.clone().multiplyScalar(v.dot(GN))).normalize(); })();
const GY = new THREE.Vector3().crossVectors(GN, GC);
const v3 = (v) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`;

// shared GLSL: hashes, value noise, fbm and the cloud field (the stars read the same field so cloud hides them)
const NOISE = /* glsl */`
  float sq(float x){ return x * x; }   // (pow(x, 2.0) is undefined for negative x and turns into NaN, i.e. black, on many GPUs)
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7); a *= 0.5; } return s; }
  float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return s; }
  // cloud cover along a view direction: x = density, y = rim (thin edge, for moonlit silver linings)
  vec2 cloudAt(vec3 d, float cover, vec2 wind, float t){
    if (d.y < 0.005) return vec2(0.0);
    vec2 p = d.xz / (d.y + 0.08) * 1.4 + wind * t * 6.0;
    float n = fbm(p * 0.45) * 0.75 + fbm(p * 1.8 + 7.0) * 0.25; n = clamp((n - 0.47) * 2.6 + 0.5, 0.0, 1.0);
    float th = 0.82 - cover * 0.6;
    return vec2(smoothstep(th, th + 0.2, n) * smoothstep(0.0, 0.12, d.y), smoothstep(th, th + 0.07, n) - smoothstep(th + 0.07, th + 0.24, n));
  }`;

function createSky({ onEvent } = {}) {
  const N = CONFIG.times.night.sky, ms = CONFIG.times.night.sun;
  const U = {
    uTime: { value: 0 }, uMoon: { value: dirFrom(ms.azimuth, ms.elevation) }, uCover: { value: N.cover }, uWet: { value: 0 }, uWind: { value: new THREE.Vector2(0.006, 0.0025) },
    uPlanet: { value: dirFrom(96, 17) }, uComet: { value: dirFrom(286, 23) }, uSunLow: { value: dirFrom(250, -16) }, uTwilight: { value: dirFrom(250, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uCover, uWet; uniform vec3 uMoon, uPlanet, uComet, uSunLow, uTwilight; uniform vec2 uWind; varying vec3 vDir;
      ${NOISE}
      const vec3 GN = ${v3(GN)}, GC = ${v3(GC)}, GY = ${v3(GY)};
      // a tangent frame on the sphere around direction c (for discs and tails drawn on the sky)
      vec2 tangentUV(vec3 d, vec3 c, float r){ vec3 t1 = normalize(cross(c, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, c); vec3 v = d - c; return vec2(dot(v, t1), dot(v, t2)) / r; }
      vec3 milkyWay(vec3 d, out float band){
        float lat = asin(clamp(dot(d, GN), -1.0, 1.0)), lon = atan(dot(d, GY), dot(d, GC));
        float bulge = exp(-lon * lon / 0.55), w = 0.085 + 0.11 * bulge + 0.02 * n3(d * 3.0);
        band = exp(-lat * lat / (w * w));
        float clouds = fbm3(d * 5.5 + 2.0) * 0.6 + fbm3(d * 15.0 + 8.0) * 0.4; clouds = pow(clouds, 2.6) * 3.2;   // knotted star clouds, not an even wash
        // the dark rift: a forked lane down the band's spine, frayed by noise, strongest toward the bulge
        float wob = (n3(d * 4.0 + 1.0) - 0.5) * 0.05, spine = lat - 0.012 * sin(lon * 2.7) - wob;
        float rift = exp(-sq(spine / (0.018 + 0.03 * bulge))) * smoothstep(-2.4, -0.2, lon) * smoothstep(1.6, 0.2, lon);
        float fork = exp(-sq((spine + 0.05 * smoothstep(-0.4, 0.8, lon)) / 0.016)) * smoothstep(-0.2, 0.8, lon) * smoothstep(1.4, 0.6, lon);
        float dust = smoothstep(0.4, 0.68, fbm3(d * 12.0 + 31.0)) * exp(-lat * lat / (w * w * 0.5));
        float lum = band * (0.2 + 0.8 * exp(-lon * lon / 2.2)) * (0.12 + clouds) * (1.0 - 0.82 * clamp(max(rift, fork) * 0.9 + dust * 0.7, 0.0, 1.0));
        vec3 col = mix(vec3(0.6, 0.7, 1.0), vec3(1.0, 0.85, 0.64), bulge);
        float neb = smoothstep(0.74, 0.88, fbm3(d * 19.0 + 5.0)) * exp(-lat * lat / (w * w * 0.35));      // rose emission nebulae strung along the band
        // unresolved stars: a fine grain only the band carries
        vec3 q = d * 900.0; float g = h3(floor(q)); float grain = step(0.86, g) * smoothstep(0.32, 0.0, length(fract(q) - 0.5)) * (g - 0.86) * 7.0;
        return col * lum * 0.3 + vec3(1.0, 0.36, 0.6) * neb * band * 0.18 + vec3(0.92, 0.9, 1.0) * grain * band * 0.6;
      }
      void main(){
        vec3 d = normalize(vDir); float y = d.y, h = max(y, 0.0);
        vec3 m = normalize(uMoon); float cm = dot(d, m), mu = max(cm, 0.0);
        vec2 cld = cloudAt(d, uCover, uWind, uTime);
        // ---- the night: gradient, twilight remnant, the park's light-dome, air-glow
        // royal blue overhead, midnight indigo, lavender-violet toward a rose horizon: deep, never black
        vec3 zen = vec3(0.013, 0.026, 0.1), mid = vec3(0.038, 0.045, 0.16), hor = vec3(0.17, 0.1, 0.25);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.32, h)); c = mix(c, zen, smoothstep(0.28, 0.95, h));
        vec2 dxz = normalize(d.xz + 1e-5), mxz = normalize(m.xz + 1e-5), wxz = normalize(uTwilight.xz); float mw = max(dot(dxz, mxz), 0.0), ww = max(dot(dxz, wxz), 0.0);
        c += vec3(0.07, 0.09, 0.2) * pow(mw, 2.0) * exp(-h * 3.5);                                   // moonlit side of the sky
        c += (vec3(0.34, 0.12, 0.2) * exp(-h * 9.0) + vec3(0.18, 0.1, 0.24) * exp(-h * 3.0) * 0.4) * pow(ww, 3.0);   // the last of the twilight, rose to violet
        c += vec3(0.32, 0.17, 0.12) * exp(-h * 20.0) * 0.75;                                          // the park's warm light-dome
        c += vec3(0.26, 0.08, 0.16) * exp(-h * 12.0) * (0.45 + 0.55 * pow(ww, 2.0));                  // a rose band all round the horizon, deepest in the west
        float ag = 0.65 + 0.35 * n2(vec2(atan(d.z, d.x) * 5.0, uTime * 0.02)) * n2(vec2(atan(d.z, d.x) * 13.0 - uTime * 0.05, h * 20.0));
        c += (vec3(0.015, 0.075, 0.035) * exp(-sq((h - 0.1) / 0.05)) + vec3(0.06, 0.012, 0.02) * exp(-sq((h - 0.2) / 0.06))) * ag;   // air-glow
        // ---- what lies beyond the air: hidden by cloud, extinguished toward the horizon
        float vis = smoothstep(0.0, 0.16, y) * (1.0 - cld.x) * (1.0 - uCover * 0.55);
        float band; vec3 gal = milkyWay(d, band);
        c += gal * vis * (1.0 - pow(mu, 40.0));
        // distant nebulae: three soft formations away from the band, rose, violet and teal
        { float nb = fbm3(d * 2.6 + 17.0), nf = fbm3(d * 7.0 + 3.0);
          float r1 = exp(-sq(length(d - normalize(vec3(0.55, 0.5, 0.65))) / 0.32)), r2 = exp(-sq(length(d - normalize(vec3(-0.7, 0.45, 0.2))) / 0.3)), r3 = exp(-sq(length(d - normalize(vec3(0.1, 0.62, 0.78))) / 0.22));
          float m = smoothstep(0.48, 0.78, nb) * (0.6 + 0.4 * nf);
          c += (vec3(0.5, 0.14, 0.34) * r1 + vec3(0.26, 0.14, 0.5) * r2 + vec3(0.07, 0.28, 0.34) * r3) * m * 0.045 * vis; }
        // the aurora: curtains low over the northern hills (behind the castle). Each curtain hangs from a folded
        // ribbon that drifts slowly; its foot is a sharp teal-green edge, it fades upward through rose to violet,
        // and fine vertical rays shimmer along it
        { float az = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0));
          float span = smoothstep(1.45, 0.6, abs(az));
          float fold = sin(az * 3.1 + uTime * 0.035) * 0.05 + sin(az * 7.3 - uTime * 0.06) * 0.025 + (n2(vec2(az * 2.0, uTime * 0.02)) - 0.5) * 0.06;
          float ACC = 0.0; vec3 AC = vec3(0.0);
          for (int k = 0; k < 2; k++) { float fk = float(k), base = 0.16 + fk * 0.07 + fold * (1.0 - fk * 0.4), hgt = el - base;
            float curtain = smoothstep(-0.008, 0.012, hgt) * exp(-max(hgt, 0.0) / (0.11 + fk * 0.05));
            float rays = 0.45 + 0.55 * pow(n2(vec2(az * 60.0 + fk * 13.0, uTime * 0.25 + fk)), 2.0) * (0.6 + 0.4 * n2(vec2(az * 9.0, uTime * 0.05)));
            float w = curtain * rays * (1.0 - fk * 0.35);
            AC += mix(vec3(0.12, 0.95, 0.62), mix(vec3(1.0, 0.36, 0.7), vec3(0.55, 0.32, 1.0), smoothstep(0.06, 0.2, hgt)), smoothstep(0.0, 0.07, hgt)) * w; }
          c += AC * span * 0.17 * smoothstep(0.0, 0.05, y) * (1.0 - cld.x * 0.7) * (0.75 + 0.25 * sin(uTime * 0.07)); }
        // celestial dust: a fine, slowly twinkling glitter across the whole sky
        { vec3 q = d * 1700.0; float g = h3(floor(q)); float tw = 0.5 + 0.5 * sin(uTime * (0.6 + g * 2.0) + g * 90.0);
          c += vec3(0.85, 0.82, 1.0) * step(0.993, g) * smoothstep(0.4, 0.0, length(fract(q) - 0.5)) * tw * 0.22 * vis; }
        { vec2 g = tangentUV(d, normalize(vec3(-0.3, 0.72, 0.62)), 0.03); g = mat2(0.8, 0.6, -0.6, 0.8) * g; g.y *= 3.0; float r = length(g);   // a faint spiral galaxy
          c += vec3(0.75, 0.75, 1.0) * (exp(-r * r * 3.0) * 0.05 + exp(-r * r * 60.0) * 0.08) * vis; }
        // ---- the ringed planet, Amoret
        { float R = 0.036; vec2 uv = tangentUV(d, uPlanet, R); float rr = dot(uv, uv);
          vec3 t1 = normalize(cross(uPlanet, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, uPlanet); vec3 sl = normalize(vec3(dot(uSunLow, t1), dot(uSunLow, t2), dot(uSunLow, uPlanet) + 0.35));
          float tilt = 0.42, inc = 0.28; vec2 rv = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * uv; vec2 ru = vec2(rv.x, rv.y / inc); float rl = length(ru);
          float ringA = smoothstep(1.35, 1.4, rl) * smoothstep(2.3, 2.22, rl) * (0.55 + 0.45 * sin(rl * 38.0)) * (1.0 - 0.75 * smoothstep(1.78, 1.82, rl) * smoothstep(1.9, 1.86, rl));
          vec3 ringC = vec3(0.95, 0.86, 0.78) * ringA * (0.35 + 0.65 * smoothstep(-1.2, 1.4, dot(normalize(ru + 1e-4), sl.xy) * 2.0 + 0.5));
          bool back = rv.y > 0.0;
          if (back) c += ringC * 0.55 * vis;
          if (rr < 1.0) { vec3 n = vec3(uv, sqrt(1.0 - rr)); float lit = smoothstep(-0.12, 0.3, dot(n, sl)), lat = uv.y * cos(tilt) - uv.x * sin(tilt);
            vec3 bands = mix(vec3(0.95, 0.74, 0.66), vec3(0.78, 0.55, 0.6), 0.5 + 0.5 * sin(lat * 15.0 + n2(vec2(lat * 9.0, uv.x * 2.0)) * 3.0));
            bands *= 0.75 + 0.25 * n2(uv * 14.0 + vec2(uTime * 0.01, 0.0));
            // the night side takes the sky's colour, so the planet is a lit crescent in the sky, not a black disc
            vec3 pc = mix(c * 0.85, bands * (0.35 + 0.65 * pow(n.z, 0.4)) * 0.85, lit);
            c = mix(c, pc, smoothstep(1.0, 0.96, rr) * (1.0 - cld.x * 0.9)); }
          if (!back) c += ringC * 0.65 * vis;
          c += vec3(0.8, 0.6, 0.65) * exp(-max(rr - 1.0, 0.0) * 3.0) * 0.02 * vis; }
        // ---- the great comet over the western twilight
        { vec3 cc = uComet, anti = -uSunLow; vec3 td = normalize(anti - cc * dot(anti, cc)), side = normalize(cross(cc, td)); vec3 v = d - cc;
          float al = dot(v, td), pe = length(v - td * al), r2 = dot(v, v);
          float ion = al > 0.0 ? exp(-pe * pe / sq(0.0025 + max(al, 0.0) * 0.012)) * exp(-al * 3.2) * (0.75 + 0.25 * n2(vec2(al * 40.0 - uTime * 0.4, pe * 300.0))) : 0.0;
          float pd = length(v - td * al - side * al * al * 0.9);
          float dustT = al > 0.0 ? exp(-pd * pd / sq(0.006 + max(al, 0.0) * 0.07)) * exp(-al * 2.4) : 0.0;
          vec3 comet = vec3(0.5, 0.75, 1.0) * ion * 0.32 + vec3(1.0, 0.9, 0.74) * dustT * 0.22 + vec3(0.6, 1.0, 0.8) * exp(-r2 / 0.00045) * 0.22 + vec3(1.0) * exp(-r2 / 0.000012) * 1.6;
          c += comet * vis; }
        // ---- the moon
        float R = 0.019;
        c += vec3(0.42, 0.48, 0.7) * (pow(mu, 14.0) * 0.1 + pow(mu, 160.0) * 0.3 + pow(mu, 1500.0) * 0.7) * (1.0 - cld.x * 0.4);   // scattered glare
        { float th = acos(clamp(cm, -1.0, 1.0));
          // a diffraction corona in thin cloud: rings of colour close to the moon
          float thin = cld.x * (1.0 - cld.x) * 4.0;
          c += vec3(0.9, 0.6, 1.0) * exp(-sq((th - 0.05) / 0.012)) * 0.08 * thin + vec3(0.6, 0.9, 1.0) * exp(-sq((th - 0.08) / 0.014)) * 0.06 * thin + vec3(1.0, 0.8, 0.6) * exp(-th * th / 0.0016) * 0.25 * thin;
          c += vec3(0.75, 0.8, 1.0) * exp(-sq((th - 0.384) / 0.01)) * 0.03 * smoothstep(0.2, 0.6, uCover) * (0.5 + 0.5 * sin(uTime * 0.01)); }   // the 22° halo
        if (cm > cos(R)) {
          vec2 uv = tangentUV(d, m, sin(R)); float rr = dot(uv, uv); vec3 nrm = vec3(uv, sqrt(max(1.0 - rr, 0.0)));
          float maria = smoothstep(0.42, 0.62, fbm(uv * 2.0 + 3.0)), crater = smoothstep(0.6, 0.72, fbm(uv * 8.0 + 9.0)) * 0.3, rays = smoothstep(0.8, 0.95, n2(uv * 30.0)) * 0.1;
          float lit = smoothstep(-0.25, 0.25, dot(nrm, normalize(vec3(0.38, 0.22, 0.9))));
          vec3 alb = vec3(1.0, 0.97, 0.9) * (1.0 - maria * 0.38 - crater + rays) * (0.5 + 0.5 * pow(nrm.z, 0.6));
          // the unlit limb shows the sky behind it, faintly brightened by earthshine (never a dark disc against the glare)
          vec3 moon = mix(c * 0.85 + alb * 0.03, alb * 3.4, lit);
          c = mix(c, moon, smoothstep(1.0, 0.95, rr) * (1.0 - cld.x * 0.85));
        }
        // ---- moonlit cloud
        if (cld.x > 0.001) {
          // night cloud is only a little brighter than the sky behind it: grey-blue bodies, thin silver rims near the moon
          // soft lavender bodies; edges lit rose-pink away from the moon and silver-blue toward it; undersides warmed by the park
          vec3 cc = c * 0.62 + mix(vec3(0.016, 0.012, 0.03), vec3(0.03, 0.026, 0.055), 0.35 + 0.65 * pow(mw, 2.0));
          vec3 rimC = mix(vec3(0.55, 0.26, 0.48), vec3(0.45, 0.52, 0.75), pow(mu, 4.0));
          cc += rimC * cld.y * (0.07 + pow(mu, 8.0) * 1.1);
          cc += vec3(0.14, 0.055, 0.08) * exp(-h * 7.0) + vec3(0.08, 0.025, 0.06) * pow(ww, 3.0) * exp(-h * 4.0);
          c = mix(c, cc, cld.x * 0.88);
        }
        if (y < 0.0) c = mix(hor * 1.1, hor * 0.45, smoothstep(0.0, -0.3, y));
        c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))) * vec3(0.8, 0.82, 0.9), uWet * 0.4);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const root = new THREE.Group(); root.name = 'sky';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 96, 48), mat); dome.renderOrder = -10; dome.frustumCulled = false; root.add(dome);

  // ---------- the stars ----------
  const NS = { high: 15000, medium: 11000, low: 7000 }[BOOT_TIER] || 11000;
  const LAYOUT = [ // The Waltzers: two figures (A left, B right) joined at the hand by star 2; units ≈ 2.3°
    [-3, 6.2], [-3, 4.6], [0, 5.6], [-5.6, 6.3], [-3.3, 2.2], [-4.6, 0], [-1.9, 0.3],
    [3, 6.9], [2.8, 5.1], [4.8, 3.7], [3, 2.7], [4.3, 0.2], [1.5, 0.9], [-0.1, 7.6]];
  const LINES = [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6], [7, 8], [8, 2], [8, 9], [8, 10], [10, 11], [10, 12]];
  const cAt = dirFrom(205, 52), cT1 = new THREE.Vector3().crossVectors(cAt, new THREE.Vector3(0, 1, 0)).normalize(), cT2 = new THREE.Vector3().crossVectors(cT1, cAt);
  const conDir = LAYOUT.map(([u, v]) => cAt.clone().addScaledVector(cT1, u * 0.04).addScaledVector(cT2, (v - 3.5) * 0.04).normalize());
  const PLANETS = [[dirFrom(250, 11), 2.6], [dirFrom(165, 33), 2.1]];   // an evening star low in the west, a golden planet over the castle
  const total = NS + conDir.length + PLANETS.length, pos = new Float32Array(total * 3), aS = new Float32Array(total * 4);
  const TEMPS = [[0.1, [0.66, 0.76, 1.0]], [0.35, [0.86, 0.9, 1.0]], [0.65, [1.0, 0.96, 0.9]], [0.9, [1.0, 0.83, 0.64]], [1.01, [1.0, 0.66, 0.46]]];
  const _d = new THREE.Vector3();
  for (let i = 0; i < total; i++) {
    let b, con = i >= NS;
    if (i >= NS + conDir.length) { const [pd, pb] = PLANETS[i - NS - conDir.length]; _d.copy(pd); b = pb; con = false; }
    else if (con) { _d.copy(conDir[i - NS]); b = [2.4, 1.6, 3.0, 1.3, 1.5, 1.2, 1.2, 2.2, 1.6, 1.3, 1.5, 1.2, 1.2, 0.9][i - NS]; }
    else {
      if (Math.random() < 0.42) { const lat = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16, lon = (Math.random() * 2 - 1) * Math.PI;   // along the galactic plane
        _d.copy(GC).multiplyScalar(Math.cos(lat) * Math.cos(lon)).addScaledVector(GY, Math.cos(lat) * Math.sin(lon)).addScaledVector(GN, Math.sin(lat)); }
      else { const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z); _d.set(Math.cos(a) * s, z, Math.sin(a) * s); }
      if (_d.y < -0.03) _d.y = -_d.y;
      b = 0.06 + 3.4 * Math.pow(Math.random(), 11) + 0.5 * Math.pow(Math.random(), 4);   // a brilliant field: many clearly visible stars, a few dazzling   // a steep magnitude distribution: thousands faint, a handful brilliant
    }
    _d.normalize(); pos.set([_d.x * 1400, _d.y * 1400, _d.z * 1400], i * 3);
    const tr = Math.random(), col = TEMPS.find(t => tr < t[0])[1]; aS.set([b, Math.round(col[0] * 255) * 65536 + Math.round(col[1] * 255) * 256 + Math.round(col[2] * 255), Math.random() * 100, con ? 1 : 0], i * 4);   // colour packed as 24-bit RGB (exact in a float)
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(aS, 4));
  const SU = { uTime: U.uTime, uCover: U.uCover, uWind: U.uWind, uMoon: U.uMoon, uPx: { value: 1 }, uWake: { value: 0 } };
  const starMat = new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      uniform float uTime, uCover, uPx, uWake; uniform vec3 uMoon; uniform vec2 uWind; attribute vec4 aS; varying vec3 vC; varying float vA; varying float vSpike;
      ${NOISE}
      void main(){
        vec3 d = normalize(position); float b = aS.x, ph = aS.z, con = aS.w;
        float pc = aS.y; vC = vec3(floor(pc / 65536.0), mod(floor(pc / 256.0), 256.0), mod(pc, 256.0)) / 255.0;
        float am = 1.0 / max(d.y + 0.025, 0.03);                                     // air mass
        float ext = exp(-0.11 * (am - 1.0)); vC *= mix(vec3(1.0, 0.55, 0.35), vec3(1.0), ext);      // extinction reddens and dims toward the horizon
        float sc = clamp(0.035 * am, 0.03, 0.28);                                       // scintillation grows with air mass
        float tw = 1.0 + sc * (sin(uTime * (3.1 + fract(ph) * 7.0) + ph) * 0.6 + sin(uTime * (11.0 + fract(ph * 7.3) * 9.0) + ph * 3.0) * 0.4);
        vec2 cl = cloudAt(d, uCover, uWind, uTime); float moonGlare = 1.0 - smoothstep(0.996, 0.9998, dot(d, normalize(uMoon))) ;
        float wake = con * uWake;
        float L = b * ext * tw * (1.0 - cl.x) * (1.0 - uCover * 0.5) * moonGlare * smoothstep(-0.01, 0.06, d.y) * (1.0 + wake * 1.6);
        vA = L; vSpike = smoothstep(1.4, 3.0, b * ext) + wake * 0.6;
        if (con > 0.5) vC = mix(vC, vec3(1.0, 0.86, 0.6), uWake);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.25 + 2.4 * sqrt(L) + vSpike * 14.0) * uPx;
        if (L < 0.01) gl_PointSize = 0.0;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; varying float vA; varying float vSpike;
      void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p);
        float s = 1.0 + vSpike * 7.0;                                                // spiked stars use a larger sprite: keep the core the same size
        float core = exp(-r * r * 30.0 * s * s), halo = exp(-r * r * 9.0 * s) * 0.12;
        float spikes = vSpike * (exp(-abs(p.x) * 160.0) * exp(-abs(p.y) * 9.0) + exp(-abs(p.y) * 160.0) * exp(-abs(p.x) * 9.0)) * 0.55;
        float a = core * vA + (halo + spikes) * min(vA, 1.6); if (a < 0.003) discard;   // the halo never swells past a soft glow
        a = mix(min(a, 1.15), min(a, 3.0), step(0.5, vSpike));                       // only the brilliant few may bloom
        gl_FragColor = vec4(vC * a * 1.2, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; stars.renderOrder = -9; root.add(stars);

  // ---------- the Waltzers' golden thread ----------
  const lp = new Float32Array(LINES.length * 2 * 3), lk = new Float32Array(LINES.length * 2);
  LINES.forEach(([a, b], k) => { lp.set([conDir[a].x * 1390, conDir[a].y * 1390, conDir[a].z * 1390, conDir[b].x * 1390, conDir[b].y * 1390, conDir[b].z * 1390], k * 6); lk[k * 2] = k / LINES.length; lk[k * 2 + 1] = (k + 1) / LINES.length; });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aK', new THREE.BufferAttribute(lk, 1));
  const LU = { uDraw: { value: 0 }, uFade: { value: 0 } };
  const lineMat = new THREE.ShaderMaterial({ uniforms: LU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute float aK; varying float vK; void main(){ vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uDraw, uFade; varying float vK; void main(){ float on = smoothstep(uDraw, uDraw - 0.04, vK); gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * on * uFade * 0.9, 1.0); }` });
  const lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; lines.renderOrder = -8; lines.visible = false; root.add(lines);
  const EV = { t: 0, next: 150 + Math.random() * 120, gaze: 0, phase: 0, count: 0 };
  function wake() { if (EV.phase) return; EV.phase = 1; EV.t = 0; EV.count++; lines.visible = true; onEvent && onEvent('waltzers'); }
  const _f = new THREE.Vector3();
  function stepEvent(dt) {
    camera.getWorldDirection(_f); const lookUp = _f.y > 0.45;
    EV.gaze = lookUp ? EV.gaze + dt : Math.max(0, EV.gaze - dt * 2);
    if (!EV.phase) { EV.next -= dt; if (EV.next <= 0 || (EV.gaze > 4 && EV.next < 200)) { EV.next = 320 + Math.random() * 200; wake(); } return; }
    EV.t += dt; const t = EV.t;   // 0–3 s stars brighten · 2–9 s the thread draws · hold to 20 s · fade to 26 s
    SU.uWake.value = Math.min(1, t / 3) * (1 - THREE.MathUtils.smoothstep(t, 20, 26));
    LU.uDraw.value = THREE.MathUtils.clamp((t - 2) / 7, 0, 1.05); LU.uFade.value = Math.min(1, (t - 2) / 1.5) * (1 - THREE.MathUtils.smoothstep(t, 18, 26));
    if (t > 26) { EV.phase = 0; lines.visible = false; SU.uWake.value = 0; }
  }

  scene.add(root);
  scene.fog = new THREE.FogExp2(0xffffff, 0.001);
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(dome.geometry, mat));
  let envRT = null, coverAt = -9;
  const refreshEnv = () => { const t = U.uTime.value; U.uTime.value = 0; const old = envRT; envRT = pmrem.fromScene(envScene, 0, 1, 3000); scene.environment = envRT.texture; old && old.dispose(); coverAt = WX.cover; U.uTime.value = t; };
  const _grey = new THREE.Color();
  function apply() {
    U.uCover.value = Math.min(1, N.cover + WX.cover * 0.85); U.uWet.value = WX.rain;
    lookColor('fog.color', scene.fog.color); scene.fog.color.lerp(_grey.setRGB(0.12, 0.13, 0.17), WX.cover * 0.5);
    scene.fog.density = lookNum('fog.density') * SET.fog * WX.fog;
  }
  apply(); refreshEnv();
  return {
    object3D: root, uniforms: U, ready: Promise.resolve(), events: EV, wake,
    update(dt, elapsed) {
      U.uTime.value = elapsed; root.position.copy(camera.position);
      SU.uPx.value = renderer.getPixelRatio() * Math.min(1.2, Math.max(0.7, innerHeight / 1000));
      U.uWind.value.set(0.006, 0.0025).multiplyScalar(0.6 + WX.wind * 0.4);
      if (MOOD.changed || SET.changed) apply();
      if (Math.abs(WX.cover - coverAt) > (SET.changed ? 0.2 : 1e-3)) refreshEnv();
      stepEvent(dt);
    },
  };
}

export { createSky };
