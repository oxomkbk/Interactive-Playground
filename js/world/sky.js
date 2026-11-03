import * as THREE from 'three';
import { $, R, TAU, V3, clamp, fbm, hdr, lerp, pick } from '../core/utils.js';
import { FX_OBJECTS, MOON_DIR, camera, renderer, rt, scene } from '../core/renderer.js';
import { GLSL_NOISE, U_TIME } from '../core/shaders.js';
import { onUpdate } from '../core/registry.js';
import { AURORA_GLSL, buildAurora } from './aurora.js';

/* =========================================================================
   6. WORLD BUILDERS
   ========================================================================= */
const ZONES = [
  { key: '1', name: 'The Gate', sub: 'Abandon all sense, ye who enter', x: 0, z: 92, tx: 0, tz: 0, r: 16, cz: 88 },
  { key: '2', name: 'Lantern Row', sub: 'Main street of stalls & games', x: 0, z: 66, tx: 0, tz: 0, r: 20, cz: 50 },
  { key: '3', name: 'Clock of Souls', sub: 'The plaza beneath the Pumpkin King', x: 9, z: 26, tx: 0, tz: 0, r: 24, cz: 0, cx: 0 },
  { key: '4', name: 'Carousel Macabre', sub: 'Round and round, forever', x: 22, z: 31, tx: 32, tz: 18, r: 13, cx: 32, cz: 18 },
  { key: '5', name: 'The Eye', sub: 'A wheel that watches back', x: -24, z: 4, tx: -40, tz: -16, r: 16, cx: -40, cz: -16 },
  { key: '6', name: 'Nightmare Express', sub: 'Keep your arms and soul inside the car', x: -46, z: 24, tx: -62, tz: 12, r: 26, cx: -68, cz: -10 },
  { key: '7', name: 'Ember Circle', sub: 'Warm your bones by the bonfire', x: -28, z: 42, tx: -40, tz: 32, r: 13, cx: -40, cz: 32 },
  { key: '8', name: 'Boneyard Maze', sub: 'Many enter. Some find the centre.', x: 48, z: -28, tx: 48, tz: -55, r: 24, cx: 48, cz: -55 },
  { key: '9', name: 'Hollowmoor Manor', sub: 'Guests check in. The door decides the rest.', x: 0, z: -44, tx: 0, tz: -66, r: 22, cx: 0, cz: -70 },
  { key: '0', name: 'Wraith Wind', sub: 'The swings that never touch the ground', x: 24, z: -4, tx: 36, tz: -16, r: 12, cx: 36, cz: -16 },
  { key: '', name: 'Coffin Cars', sub: 'Bumper coffins. Bring a spare soul.', x: 64, z: 56, tx: 64, tz: 40, r: 15, cx: 64, cz: 40 },
  { key: '', name: 'The Gallows Drop', sub: 'Thirty-four metres straight down', x: 52, z: 9, tx: 62, tz: 6, r: 9, cx: 62, cz: 6 },
  { key: '', name: 'Grave Danger', sub: 'Whack the dead back down', x: -24, z: -34, tx: -26, tz: -42, r: 8, cx: -26, cz: -42 },
  { key: '', name: 'Pumpkin Chuck', sub: 'Lob a gourd into the cauldron', x: -15, z: 60, tx: -28, tz: 60, r: 9, cx: -26, cz: 60 },
  { key: '', name: 'Circus of Horrors', sub: 'The Phantom Circus performs nightly', x: -84, z: 24, tx: -118, tz: 22, r: 30, cx: -112, cz: 22, area: 'west' },
  { key: '', name: 'Cauldron Cups', sub: 'Spin until the stars spin with you', x: -84, z: 58, tx: -98, tz: 56, r: 11, cx: -98, cz: 56, area: 'west' },
  { key: '', name: 'Hex Archery', sub: 'Draw, lead, loose', x: -106, z: -6, tx: -130, tz: -12, r: 8, cx: -112, cz: -12, area: 'west' },
  { key: '', name: 'Cathedral of Echoes', sub: 'The organ still plays at midnight', x: 0, z: -112, tx: 0, tz: -150, r: 34, cx: 0, cz: -150, area: 'north' },
  { key: '', name: 'Witchwood', sub: 'Stay on the path', x: -60, z: -84, tx: -96, tz: -128, r: 34, cx: -100, cz: -130, area: 'north' },
  { key: '', name: "The Witch's Cottage", sub: 'Brews, broomsticks and bad ideas', x: -104, z: -128, tx: -116, tz: -146, r: 14, cx: -114, cz: -142, area: 'north' },
  { key: '', name: 'Pumpkin Fields', sub: 'Home of the Pumpkin King', x: 80, z: 46, tx: 120, tz: 50, r: 34, cx: 115, cz: 46, area: 'east' },
  { key: '', name: 'The Pumpkin King', sub: 'Twenty-three metres of carved fury', x: 104, z: 50, tx: 120, tz: 50, r: 12, cx: 120, cz: 50, area: 'east' },
  { key: '', name: 'Lake of Lost Souls', sub: 'Where the lanterns go to drift', x: 78, z: -38, tx: 112, tz: -50, r: 40, cx: 112, cz: -50, area: 'east' },
];

// ---------- Sky dome: gradient, stars, drifting moonlit clouds, detailed moon, halo ----------
let skyMat;
function buildSky() {
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: U_TIME, uMoon: { value: MOON_DIR }, uRed: { value: 0 }, uFlash: { value: 0 }, uFogC: { value: scene.fog.color }, uAurora: { value: 0.85 }, uAur: { value: buildAurora() }, uFw: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `${GLSL_NOISE}
      uniform vec3 uMoon,uFogC,uFw; uniform float uTime,uRed,uFlash,uAurora; uniform sampler2D uAur; varying vec3 vDir;
      ${AURORA_GLSL}
      float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d=normalize(vDir); float h=d.y;
        vec3 zen=vec3(.002,.004,.014), mid=vec3(.018,.014,.045), hor=vec3(.075,.04,.065);
        vec3 col=mix(hor,mid,smoothstep(-.02,.25,h)); col=mix(col,zen,smoothstep(.2,.9,h));
        float md=max(dot(d,uMoon),0.);
        col+=vec3(.06,.08,.15)*pow(md,6.)+vec3(.16,.18,.3)*pow(md,48.);
        // stars
        vec3 sp=d*420.; vec3 cell=floor(sp); float sh=h3(cell);
        if(sh>.9962){ vec3 c=cell+.5+(vec3(h3(cell+1.7),h3(cell+3.1),h3(cell+5.3))-.5)*.6; float sd=length(sp-c);
          float tw=.55+.45*sin(uTime*(1.5+sh*40.)+sh*100.); col+=vec3(.8,.85,1.)*smoothstep(.4,0.,sd)*tw*smoothstep(.03,.3,h)*3.*(1.-pow(md,4.)); }
        // moon
        float ang=acos(clamp(dot(d,uMoon),-1.,1.)); float Rm=.042;
        if(ang<Rm*1.02){ vec3 rt=normalize(cross(uMoon,vec3(0,1,0))); vec3 u2=cross(rt,uMoon);
          vec2 mp=vec2(dot(d,rt),dot(d,u2))/Rm; float limb=sqrt(max(0.,1.-dot(mp,mp)));
          float m=fbm(mp*3.+4.)*.6+fbm(mp*9.)*.4; float maria=smoothstep(.45,.62,fbm(mp*2.2+1.3));
          float crater=smoothstep(.06,.0,abs(fbm(mp*6.)-.5))*.15;
          vec3 mc=vec3(1.,.95,.86)*(.72+.38*m-crater)*(1.-maria*.38)*(.5+.5*limb);
          col=mix(col,mc*2.3,smoothstep(Rm,Rm*.965,ang)); }
        col+=vec3(.35,.38,.55)*exp(-ang*13.)*.4+vec3(.14,.12,.22)*exp(-ang*3.5)*.22;
        // raymarched aurora (aurora.js) — behind the clouds, fading into the horizon fog
        vec3 aur=auroraAt(uAur,d)*uAurora*1.1; col+=aur*smoothstep(.0,.12,h);
        // clouds
        if(h>0.){ vec2 cp=d.xz/(h+.12)*1.5+vec2(uTime*.005,uTime*.002);
          float c=smoothstep(.46,.86,fbm(cp*1.3)); c*=.55+.6*fbm(cp*4.+vec2(uTime*.01,0.));
          vec3 cc=mix(vec3(.02,.018,.04),vec3(.2,.2,.28),pow(md,5.))+hor*.35+vec3(.7,.72,.9)*pow(md,38.);
          cc+=uFw*.3*c;
          col=mix(col,cc,c*smoothstep(0.,.14,h)*.88); }
        col+=uFw*mix(.05,.01,clamp(h,0.,1.));
        col=mix(col,uFogC,smoothstep(.07,-.03,h));
        if(uRed>0.){ float l=dot(col,vec3(.3,.5,.2)); vec3 red=vec3(l*2.6,l*.22,l*.16)+vec3(.09,0.,.008)*smoothstep(.35,0.,h); col=mix(col,red,uRed); }
        col+=uFlash*vec3(.55,.55,.9)*(.4+.6*max(h,0.));
        gl_FragColor=vec4(col,1.);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky); FX_OBJECTS.push(sky);
  onUpdate(() => sky.position.copy(camera.position));
}
// Environment map for reflections on wet stone (PMREM of a tiny procedural sky with warm park glows)
function buildEnvironment() {
  const es = new THREE.Scene(), g = new THREE.SphereGeometry(50, 32, 16), cols = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 50;
    const c = y < 0 ? new THREE.Color().setRGB(0.02, 0.015, 0.015) : new THREE.Color().setRGB(lerp(0.12, 0.01, Math.pow(y, 0.5)), lerp(0.07, 0.015, Math.pow(y, 0.5)), lerp(0.1, 0.045, Math.pow(y, 0.5)));
    cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const blob = (dir, r, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: col })); m.position.copy(dir).multiplyScalar(44); es.add(m); };
  blob(MOON_DIR, 3, hdr(0xfff0e0, 5));
  for (let i = 0; i < 14; i++) { const a = R(0, TAU); blob(new V3(Math.cos(a), R(0.02, 0.2), Math.sin(a)).normalize(), R(1, 2.4), hdr(pick([0xff8a2a, 0xffb060, 0x9a50ff]), 5)); }
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.01).texture; scene.environmentIntensity = 0.45;
}

export { ZONES, skyMat, buildSky, buildEnvironment };
