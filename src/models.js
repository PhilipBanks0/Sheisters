// SHEISTERS — CC0 models (KayKit by Kay Lousberg). Everything is fitted to a box the level already collides with.
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
const T = window.THREE, cache = new Map(), loader = new GLTFLoader();
const DIR = { car_: 'city', streetlight: 'city', firehydrant: 'city', dumpster: 'city', trash_: 'city', bench: 'city', box_: 'city', trafficlight_: 'city', watertower: 'city', bush: 'city' };
const url = name => 'assets/' + (Object.keys(DIR).find(k => name.startsWith(k)) ? 'city' : 'furniture') + '/' + name + '.gltf';
export function getModel(name) {
  if (!cache.has(name)) cache.set(name, new Promise(res => loader.load(url(name), g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material && o.material.map) o.material.map.anisotropy = 4; } });
    res(g.scene);
  }, undefined, () => res(null))));
  return cache.get(name);
}
// returns a group holding the model scaled to fit inside w × h × d, standing on y = 0 at the group's origin
export async function fitted(name, w, h, d, ry, stretch) {
  const tpl = await getModel(name); if (!tpl) return null;
  const m = tpl.clone(true), g = new T.Group(); m.rotation.y = ry || 0; g.add(m); g.updateMatrixWorld(true);
  const bb = new T.Box3().setFromObject(m), sz = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
  m.position.set(-c.x, -bb.min.y, -c.z);
  if (stretch) g.scale.set(w / sz.x, h / sz.y, d / sz.z); else g.scale.setScalar(Math.min(w / sz.x, h / sz.y, d / sz.z));
  const wrap = new T.Group(); wrap.add(g); return wrap;
}
