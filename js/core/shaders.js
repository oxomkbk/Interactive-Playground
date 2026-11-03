import * as THREE from 'three';
import { $, clamp, fbm, vnoise } from './utils.js';
import { FOGU, FX_OBJECTS, scene } from './renderer.js';

/* =========================================================================
   4. FX SHADERS — flames, volumetric cones, mist, ghosts, spectral water, particles
   ========================================================================= */
const GLSL_NOISE = `
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=.5; } return v; }
  float fbm3(vec2 p){ float v=0.,a=.5; for(int i=0;i<3;i++){ v+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=.5; } return v*1.11; }`;
const U_TIME = { value: 0 };

function fxMat(opts) { return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...opts }); }

function flameMat(colA, colB, seed) {
  return fxMat({
    side: THREE.DoubleSide,
    uniforms: { uTime: U_TIME, uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) }, uSeed: { value: seed }, uBoost: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `${GLSL_NOISE} uniform float uTime,uSeed,uBoost; uniform vec3 uA,uB; varying vec2 vUv;
      void main(){ vec2 uv=vUv; float t=uTime*1.6+uSeed;
        float n=fbm(vec2(uv.x*3.+uSeed,uv.y*2.2-t*2.2));
        float x=abs(uv.x-.5)*2.; float w=(1.-uv.y)*.85+.06;
        float s=1.-smoothstep(.0,1.,x/w+(n-.5)*.9);
        s*=smoothstep(0.,.12,uv.y)*smoothstep(1.,.35,uv.y+(n-.5)*.5);
        s=clamp(s,0.,1.); vec3 c=mix(uB,uA,pow(s,1.5));
        gl_FragColor=vec4(c*s*2.6*mix(1.,uBoost,.55),1.); }`,
  });
}
// Volumetric-looking light cone (lamps, searchlights, uplights). Works with InstancedMesh.
function coneMat(color, intensity = 0.15, near = 3) {
  return fxMat({
    side: THREE.DoubleSide,
    uniforms: { uTime: U_TIME, uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uFog: FOGU, uNear: { value: near } },
    vertexShader: `varying float vY; varying vec3 vN,vV,vW;
      void main(){ vec4 lp=vec4(position,1.); vec3 nn=normal;
        #ifdef USE_INSTANCING
          lp=instanceMatrix*lp; nn=mat3(instanceMatrix)*nn;
        #endif
        vec4 wp=modelMatrix*lp; vW=wp.xyz; vN=normalize(mat3(modelMatrix)*nn); vV=cameraPosition-wp.xyz; vY=uv.y;
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `${GLSL_NOISE} uniform vec3 uColor; uniform float uI,uTime,uFog,uNear; varying float vY; varying vec3 vN,vV,vW;
      void main(){ float d=length(vV); float f=pow(abs(dot(normalize(vN),vV/d)),1.6);
        float n=.65+.35*vnoise(vW.xz*.25+vW.y*.15+vec2(0.,uTime*.35));
        float fog=exp(-pow(uFog*d*.6,2.));
        gl_FragColor=vec4(uColor*f*pow(clamp(vY,0.,1.),1.3)*uI*n*fog*smoothstep(uNear*.15,uNear,d),1.); }`,
  });
}
function ghostMat(color, seed) {
  return fxMat({
    uniforms: { uTime: U_TIME, uColor: { value: new THREE.Color(color) }, uSeed: { value: seed }, uOpacity: { value: 1 }, uFog: FOGU },
    vertexShader: `uniform float uTime,uSeed; varying vec3 vN,vV,vObj;
      void main(){ vec3 p=position; float hem=smoothstep(.2,-.8,p.y); float a=atan(p.x,p.z);
        p.xz*=1.+hem*.18*sin(a*7.+uTime*4.+uSeed); p.y+=hem*.08*sin(a*5.-uTime*5.+uSeed); p.z-=hem*hem*.35;
        vObj=p; vec4 wp=modelMatrix*vec4(p,1.); vN=normalize(mat3(modelMatrix)*normal); vV=cameraPosition-wp.xyz;
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity,uFog; varying vec3 vN,vV,vObj;
      void main(){ float d=length(vV); float fr=pow(clamp(1.-abs(dot(normalize(vN),vV/d)),0.,1.),2.2);
        float hem=smoothstep(-.85,-.1,vObj.y); float body=(.16+fr*1.5)*hem;
        float front=smoothstep(.15,.35,vObj.z);
        float e=length(vec2(abs(vObj.x)-.17,(vObj.y-.62)*.8)); float m=length(vec2(vObj.x*1.3,(vObj.y-.36)*.9));
        float hole=max(smoothstep(.1,.07,e),smoothstep(.1,.08,m))*front;
        gl_FragColor=vec4(uColor*body*(1.-hole*.95)*uOpacity*exp(-pow(uFog*d*.8,2.)),1.); }`,
  });
}
function waterMat(color, cx, cz) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U_TIME, uColor: { value: new THREE.Color(color) }, uC: { value: new THREE.Vector2(cx, cz) }, uBoost: { value: 1 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `${GLSL_NOISE} uniform float uTime,uBoost; uniform vec3 uColor; uniform vec2 uC; varying vec3 vW;
      void main(){ vec2 p=vW.xz-uC; float r=length(p); float w=pow(clamp(sin(r*3.2-uTime*2.2)*.5+.5,0.,1.),8.);
        float n=fbm(p*.7+uTime*.12); vec3 c=uColor*(.2+.9*w*n+.45*n)*uBoost; gl_FragColor=vec4(c,1.); }`,
  });
}
// Ground mist: layered noise planes with zone-weighted density
const MIST_ZONES = [new THREE.Vector4(48, -55, 26, 1.6), new THREE.Vector4(0, -66, 26, 1.2), new THREE.Vector4(-68, -40, 30, 0.6), new THREE.Vector4(-105, -130, 55, 2.2), new THREE.Vector4(112, -50, 42, 1.4), new THREE.Vector4(0, -155, 40, 1.0)];
function mistMat(alpha, scale, speed) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U_TIME, uA: { value: alpha }, uS: { value: scale }, uSp: { value: speed }, uColor: { value: new THREE.Color().setRGB(0.065, 0.06, 0.09) }, uZ: { value: MIST_ZONES }, uRed: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `${GLSL_NOISE} uniform float uTime,uA,uS,uSp,uRed; uniform vec3 uColor; uniform vec4 uZ[6]; varying vec3 vW;
      void main(){ vec2 p=vW.xz*uS; float n=fbm3(p+vec2(uTime*.02,uTime*.013)*uSp); float n2=fbm3(p*2.3-vec2(uTime*.03,0.)*uSp);
        float m=smoothstep(.3,.85,n*.6+n2*.5); float b=1.;
        for(int i=0;i<6;i++) b+=uZ[i].w*smoothstep(uZ[i].z,0.,distance(vW.xz,uZ[i].xy));
        float d=length(cameraPosition-vW); float a=m*uA*b*smoothstep(1.5,9.,d)*(.35+.65*exp(-d*.01))*mix(1.,.3,smoothstep(3.,30.,cameraPosition.y));
        vec3 c=mix(uColor,vec3(.16,.03,.03),uRed); gl_FragColor=vec4(c,clamp(a,0.,.85)); }`,
  });
}
// Generic additive point sprites (embers, wisps, fireworks)
const U_PSCALE = { value: 600 };
function pointsMat() {
  return fxMat({
    uniforms: { uScale: U_PSCALE },
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uScale;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/max(-mv.z,.1); gl_Position=projectionMatrix*mv; vC=aColor; }`,
    fragmentShader: `varying vec3 vC; void main(){ float r=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,r); gl_FragColor=vec4(vC*a*a,1.); }`,
  });
}
function makePoints(n) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const p = new THREE.Points(g, pointsMat()); p.frustumCulled = false; scene.add(p); FX_OBJECTS.push(p);
  return { p, pos, col, size, g, flag() { g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = true; } };
}

export { GLSL_NOISE, U_TIME, fxMat, flameMat, coneMat, ghostMat, waterMat, MIST_ZONES, mistMat, U_PSCALE, pointsMat, makePoints };
