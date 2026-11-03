/* =========================================================================
   ASSETS — loads the scanned CC0 surfaces (Poly Haven: albedo, OpenGL normal, AO/roughness/metal "ARM")
   and HDR skies with real progress reporting. A set that fails to load resolves to null so the caller can fall
   back to its procedural material — a missing file degrades the look, never breaks the page.
   ========================================================================= */
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const AS = { sets: {}, hdr: {}, failed: [], loaded: 0, total: 0, onProgress: null, aniso: 8 };
const bump = (url, ok) => { AS.loaded++; if (!ok) AS.failed.push(url); AS.onProgress && AS.onProgress(AS.loaded / Math.max(1, AS.total), url); };
const tl = new THREE.TextureLoader();
function tex(url, srgb) { AS.total++; return tl.loadAsync(url).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = AS.aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; bump(url, true); return t; }).catch(() => { bump(url, false); return null; }); }
async function loadSet(name) { const b = `assets/tex/${name}/`; const [diff, nor, arm] = await Promise.all([tex(b + 'diff.jpg', true), tex(b + 'nor.jpg', false), tex(b + 'arm.jpg', false)]);
  AS.sets[name] = diff && nor && arm ? { diff, nor, arm } : null; return AS.sets[name]; }
async function loadHDR(name, floatLinear) { AS.total++;
  try { const t = await new RGBELoader().setDataType(THREE.FloatType).loadAsync(`assets/hdri/${name}.hdr`); if (!floatLinear) t.minFilter = t.magFilter = THREE.NearestFilter; AS.hdr[name] = t; bump(name, true); return t; }
  catch (e) { AS.hdr[name] = null; bump(name, false); return null; } }
async function loadAll({ sets = [], hdris = [], floatLinear = true } = {}) { await Promise.all([...sets.map(loadSet), ...hdris.map(h => loadHDR(h, floatLinear))]); return AS; }

export { AS, loadAll, loadSet, loadHDR };
