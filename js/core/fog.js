import * as THREE from 'three';
import { $, clamp } from './utils.js';

/* ---------- Exponential HEIGHT FOG with moon in-scattering ----------
   Replaces three's fog chunks for every built-in material: fog pools in the low ground and
   thins with altitude (spires and the Eye rise out of it), and glows toward the moon. */
{
  const md = new THREE.Vector3(-0.36, 0.40, -0.84).normalize();
  const MD = `vec3(${md.x.toFixed(4)},${md.y.toFixed(4)},${md.z.toFixed(4)})`;
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorldPos;\n#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogWorldPos = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);\n#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorldPos;\n #ifdef FOG_EXP2\n  uniform float fogDensity;\n #else\n  uniform float fogNear; uniform float fogFar;\n #endif\n#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
   #ifdef FOG_EXP2
    vec3 fRay = vFogWorldPos - cameraPosition; float fDist = length(fRay);
    float fk = 0.12, fh0 = max(cameraPosition.y, 0.0), fdh = fRay.y;
    float fhf = abs(fdh) > 0.05 ? (exp(-fk*fh0) - exp(-fk*(fh0+fdh))) / (fk*fdh) : exp(-fk*fh0);
    float fd = fogDensity * fDist;
    float fogFactor = 1.0 - exp(-fd*fd*0.5 - fogDensity*fDist*1.6*fhf);
    float fmd = max(dot(fRay / max(fDist, 1e-3), ${MD}), 0.0);
    vec3 fCol = fogColor * (1.0 + 1.5*pow(fmd, 6.0) + 3.5*pow(fmd, 48.0));
   #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth); vec3 fCol = fogColor;
   #endif
   gl_FragColor.rgb = mix(gl_FragColor.rgb, fCol, clamp(fogFactor, 0.0, 1.0));
  #endif`;
}
