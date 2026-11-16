// Reads a file chosen by the user and returns {obj, tree} ready for the viewer. Nothing leaves the browser.
import { THREE } from './viewer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { t } from './i18n.js';

export const STEP_LIMIT = 100 * 1024 * 1024;
export const extOf = name => name.split('.').pop().toLowerCase();
export const isCad = ext => ['stp', 'step', 'igs', 'iges'].includes(ext);

function loadCad(buf, ext, status) {
  return new Promise((res, rej) => {
    const w = new Worker('js/step-worker.js');
    w.onmessage = e => {
      const d = e.data;
      if (d.status) { status(t(d.status)); return; }
      w.terminate(); // frees the converter's memory
      if (d.error) { rej(new Error(d.error)); return; }
      const meshes = d.meshes.map(m => {
        if (!m.pos.length || m.pos.some(v => !Number.isFinite(v))) return null;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
        if (m.nor && m.nor.length === m.pos.length) geo.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
        if (m.idx) geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
        const me = new THREE.Mesh(geo); me.name = m.name;
        if (m.color) me.material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(m.color[0], m.color[1], m.color[2], THREE.SRGBColorSpace), roughness: .6, metalness: 0, side: THREE.DoubleSide });
        else me.userData.orig = null; // no colour in the file: stays neutral grey
        return me;
      });
      if (!meshes.some(Boolean)) { rej(new Error(t('empty'))); return; }
      const g = new THREE.Group(); meshes.forEach(m => m && g.add(m));
      g.rotation.x = -Math.PI / 2; // CAD is Z-up
      const obj = new THREE.Group(); obj.add(g);
      const all = n => [...n.meshes, ...n.children.flatMap(all)];
      const conv = n => ({ name: n.name || '', meshes: (n.meshes || []).map(i => meshes[i]).filter(Boolean), children: (n.children || []).map(conv).filter(c => all(c).length) });
      res({ obj, tree: d.root ? conv(d.root) : null });
    };
    w.onerror = e => { w.terminate(); rej(new Error(e.message || 'worker error')); };
    w.postMessage({ buf, iges: ext === 'igs' || ext === 'iges' }, [buf]);
  });
}

export async function loadFile(file, status) {
  const ext = extOf(file.name), buf = await file.arrayBuffer();
  if (isCad(ext)) return loadCad(buf, ext, status);
  if (ext === 'glb' || ext === 'gltf') {
    if (ext === 'gltf' && /"uri"\s*:\s*"(?!data:)/.test(new TextDecoder().decode(buf))) throw new Error(t('gltfExt'));
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    return { obj: await new Promise((res, rej) => loader.parse(buf, '', g => res(g.scene), rej)), tree: null };
  }
  if (ext === 'obj') return { obj: new OBJLoader().parse(new TextDecoder().decode(buf)), tree: null };
  if (ext === 'stl') {
    const m = new THREE.Mesh(new STLLoader().parse(buf)); m.name = file.name; m.userData.orig = null;
    m.rotation.x = -Math.PI / 2; // STL is usually Z-up
    const obj = new THREE.Group(); obj.add(m); return { obj, tree: null };
  }
  throw new Error(t('unsup'));
}
