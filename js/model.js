// The loaded model: materials, parts list, exploded view, orientation and picking.
import { THREE, AXES, view, holder, floor, sphere, place, invalidate, cam, renderer } from './viewer.js';
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
const greyMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbb, roughness: .6, metalness: 0, side: THREE.DoubleSide });
const hiMat = new THREE.MeshStandardMaterial({ color: 0xe8a030, emissive: 0x5a3000, roughness: .5, side: THREE.DoubleSide });

export let model = null;
export let picked = null; // last part clicked on the model (detail aimed by the camera moves)
let rootNode = null, homeQ = null, homeP = null;
const rows = [], meshRow = new Map(), lit = new Set();

// ---------- materials
const matOf = m => lit.has(m) ? hiMat : view.colors && m.userData.orig ? m.userData.orig : greyMat;
export function applyMaterials() { if (model) model.traverse(o => { if (o.isMesh) o.material = matOf(o); }); invalidate(); }
function highlight(meshes, on) { meshes.forEach(m => { on ? lit.add(m) : lit.delete(m); m.material = matOf(m); }); invalidate(); }

function dispose(obj) {
  const mats = new Set();
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    [o.material, o.userData.orig].flat().forEach(m => { if (m && m !== greyMat && m !== hiMat) mats.add(m); });
  });
  mats.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
}

// ---------- placing the model on the floor
function normalize() {
  holder.position.set(0, 0, 0); holder.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(holder), c = b.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -b.min.y, -c.z); holder.updateMatrixWorld(true);
  new THREE.Box3().setFromObject(holder).getBoundingSphere(sphere);
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error(t('empty'));
  floor.scale.setScalar(sphere.radius * 1.6);
}
const saveHome = () => { homeQ = model.quaternion.clone(); homeP = model.position.clone(); };

export function setModel(obj, tree, groups, name) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    o.userData.orig = o.userData.orig === null ? null : o.material;
  });
  const old = model;
  if (old) holder.remove(old);
  holder.add(obj);
  try { normalize(); } catch (e) { holder.remove(obj); dispose(obj); if (old) { holder.add(old); normalize(); } throw e; }
  if (old) dispose(old);
  model = obj; picked = null; lit.clear(); applyMaterials();
  buildParts(tree || treeFromObject(obj, groups)); saveHome();
  orientKey = name || null;
  const q = orientKey && storedOrientation(orientKey);
  if (q) orientTo(q);
  place(view.dir);
}

// ---------- parts tree  (node: {name, meshes:[Mesh], children:[node]}; a node's own meshes are one part)
// groups: lists of sibling meshes that form one part (see partGroups in loaders.js).
function treeFromObject(obj, groups = []) {
  const own = new Map(groups.map(g => [g[0].parent, g]));
  const walk = o => {
    const g = own.get(o), n = { name: o.name || '', meshes: g ? [...g] : o.isMesh ? [o] : [], children: [] };
    o.children.forEach(c => { if (g && g.includes(c)) return; const k = walk(c); if (k.meshes.length || k.children.length) n.children.push(k); });
    return n;
  };
  const r = walk(obj);
  while (!r.meshes.length && r.children.length === 1 && !r.children[0].meshes.length) Object.assign(r, r.children[0]);
  return r;
}
const allMeshes = n => n.all ??= [...n.meshes, ...n.children.flatMap(allMeshes)];
const countParts = n => n.nParts ??= (n.meshes.length ? 1 : 0) + n.children.reduce((s, c) => s + countParts(c), 0);

function refreshChecks() {
  rows.forEach(({ node, cb }) => { const ms = allMeshes(node), v = ms.filter(m => m.visible).length; cb.checked = v > 0; cb.indeterminate = v > 0 && v < ms.length; });
  invalidate();
}
function buildParts(root) {
  rootNode = root; rows.length = 0; meshRow.clear(); expSet.clear(); initExplode();
  const box = $('parts'); box.innerHTML = ''; $('partFilter').value = '';
  const mkNode = (node, depth) => {
    const el = document.createElement('div'), kids = node.children.length > 0;
    el.className = 'node' + (kids ? '' : ' leaf') + (depth > 0 ? ' closed' : '');
    const line = document.createElement('div'); line.className = 'line';
    const tw = document.createElement('span'); tw.className = 'tw';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
    const nm = document.createElement('span'); nm.className = 'nm';
    const name = node.name || node.meshes[0]?.name || '—';
    nm.textContent = name + (kids ? ` (${countParts(node)})` : ''); nm.title = nm.textContent;
    const so = document.createElement('button'); so.className = 'solo'; so.textContent = t('solo');
    const ex = document.createElement('button'); ex.className = 'ex'; ex.textContent = '✦'; ex.title = t('exMark');
    line.append(tw, cb, nm, so, ex); el.append(line);
    if (kids) {
      const k = document.createElement('div'); k.className = 'kids';
      node.children.forEach(c => k.append(mkNode(c, depth + 1))); el.append(k);
      tw.onclick = nm.ondblclick = () => el.classList.toggle('closed');
    }
    cb.onchange = () => { allMeshes(node).forEach(m => m.visible = cb.checked); refreshChecks(); };
    so.onclick = () => { const keep = new Set(allMeshes(node)); allMeshes(rootNode).forEach(m => m.visible = keep.has(m)); refreshChecks(); };
    line.onmouseenter = () => highlight(allMeshes(node), true);
    line.onmouseleave = () => highlight(allMeshes(node), false);
    ex.onclick = () => { const ms = allMeshes(node), on = !ms.every(m => expSet.has(m)); ms.forEach(m => on ? expSet.add(m) : expSet.delete(m)); refreshEx(); applyExplode(); };
    const row = { node, el, line, cb, ex, so, name: name.toLowerCase() }; rows.push(row);
    node.meshes.forEach(m => meshRow.set(m, row));
    return el;
  };
  let top = root.meshes.length ? [root] : root.children;
  if (top.length === 1 && !top[0].meshes.length) top = top[0].children;
  top.forEach(n => box.append(mkNode(n, 0)));
  $('partCount').textContent = countParts(root);
}
export function relabelParts() { rows.forEach(r => { r.so.textContent = t('solo'); r.ex.title = t('exMark'); }); }
export function showAll() { if (rootNode) { allMeshes(rootNode).forEach(m => m.visible = true); refreshChecks(); } }
export function expandAll(open) { document.querySelectorAll('#parts .node:not(.leaf)').forEach(n => n.classList.toggle('closed', !open)); }
export function filterParts(q) {
  q = q.trim().toLowerCase();
  const visit = el => {
    let hit = false;
    el.querySelectorAll(':scope>.kids>.node').forEach(k => { if (visit(k)) hit = true; });
    const row = rows.find(r => r.el === el), own = !q || row.name.includes(q);
    el.hidden = !(own || hit);
    if (q && hit) el.classList.remove('closed');
    return own || hit;
  };
  document.querySelectorAll('#parts>.node').forEach(visit);
}

// ---------- exploded view
// Whole parts move: all meshes of a part (one per colour) get the same offset, from the part's centre.
const expSet = new Set(); let expMode = 'all', expBase = new Map(), expUnits = [];
function initExplode() {
  expBase = new Map(); expUnits = [];
  if (!model) return;
  const seen = new Set();
  const add = ms => {
    const byParent = new Map();
    ms.forEach(m => { if (seen.has(m)) return; seen.add(m); const l = byParent.get(m.parent); l ? l.push(m) : byParent.set(m.parent, [m]); });
    byParent.forEach(l => expUnits.push(l));
  };
  const visit = n => { if (n.meshes.length) add(n.meshes); n.children.forEach(visit); };
  if (rootNode) visit(rootNode);
  model.traverse(o => { if (o.isMesh) { expBase.set(o, o.position.clone()); if (!seen.has(o)) add([o]); } });
  $('exp').value = 0; $('expVal').textContent = '0%';
}
function refreshEx() { rows.forEach(({ node, ex }) => { const ms = allMeshes(node); ex.classList.toggle('on', ms.length > 0 && ms.every(m => expSet.has(m))); }); }
const _ub = new THREE.Box3(), _mb = new THREE.Box3(), _off = new THREE.Vector3();
export function applyExplode() {
  if (!model) return;
  const f = $('exp').value / 100 * 1.5; $('expVal').textContent = $('exp').value + '%';
  expBase.forEach((p, m) => m.position.copy(p)); model.updateMatrixWorld(true); invalidate();
  if (f === 0) return;
  const C = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  expUnits.forEach(ms => {
    if (expMode === 'sel' && !ms.some(m => expSet.has(m))) return;
    _ub.makeEmpty(); ms.forEach(m => _ub.union(_mb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)));
    _ub.getCenter(_off).sub(C).multiplyScalar(f);
    ms.forEach(m => { const target = m.parent.localToWorld(expBase.get(m).clone()).add(_off); m.position.copy(m.parent.worldToLocal(target)); });
  });
  model.updateMatrixWorld(true);
}
export function setExplodeMode(m) { expMode = m; $('parts').classList.toggle('sel', m === 'sel'); applyExplode(); }

// ---------- orientation
// How the product was straightened is remembered per file name, in this browser only,
// so the same file opens upright next time.
const OKEY = 'viewer3d.orient.';
let orientKey = null;
function storedOrientation(name) {
  try {
    const a = JSON.parse(localStorage.getItem(OKEY + name));
    return Array.isArray(a) && a.length === 4 && a.every(Number.isFinite) ? new THREE.Quaternion().fromArray(a) : null;
  } catch (e) { return null; }
}
// Puts the model in orientation q (from its straightened position, any free turn is dropped),
// back on the floor, and remembers it.
function orientTo(q) {
  expBase.forEach((p, m) => m.position.copy(p));
  model.quaternion.copy(homeQ); model.position.copy(homeP);
  model.position.applyQuaternion(q.clone().multiply(homeQ.clone().invert())); model.quaternion.copy(q);
  normalize(); saveHome();
  if (orientKey) try { localStorage.setItem(OKEY + orientKey, JSON.stringify(model.quaternion.toArray())); } catch (e) {}
}
// Quarter turn around a world axis; the model is then put back on the floor and the view reframed.
export function turn90(ax) {
  if (!model) return;
  orientTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...AXES[ax]), Math.PI / 2).multiply(homeQ));
  place(view.dir); applyExplode();
}
// "This is the front": what the camera shows now becomes the front, and the top of the picture the top.
// Both are rounded to the product's own axes, so it never ends up tilted.
export function setFrontFromView() {
  if (!model) return;
  const toModel = model.quaternion.clone().invert();
  const look = cam.getWorldDirection(new THREE.Vector3()).negate().applyQuaternion(toModel); // product -> camera
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion).applyQuaternion(toModel);
  const snap = (v, not) => {
    const k = ['x', 'y', 'z'].filter(a => a !== not).reduce((b, c) => Math.abs(v[c]) > Math.abs(v[b]) ? c : b);
    const r = new THREE.Vector3(); r[k] = Math.sign(v[k]) || 1; return [r, k];
  };
  const [f, fk] = snap(look), [u] = snap(up, fk), w = new THREE.Vector3().crossVectors(u, f);
  // rotation taking the product's axes w, u, f to the scene's right, up and front
  orientTo(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(w, u, f).transpose()));
  place([0, .12, 1]); applyExplode();
}
// Back to the orientation of the file, and forget the one remembered.
export function resetOrientation() {
  if (!model) return;
  if (orientKey) try { localStorage.removeItem(OKEY + orientKey); } catch (e) {}
  const key = orientKey; orientKey = null; orientTo(new THREE.Quaternion()); orientKey = key;
  place(view.dir); applyExplode();
}
// Free turn around one axis through the middle of the product (used while dragging).
export function spin(ax, angle) {
  if (!model) return;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...AXES[ax]), angle);
  const C = holder.worldToLocal(sphere.center.clone());
  model.position.sub(C).applyQuaternion(q).add(C); model.quaternion.premultiply(q); invalidate();
}
// Turn applied on top of the product's straightened position (shown by the orientation cube).
const _sq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
export const spinQuat = () => model && homeQ ? _sq.copy(model.quaternion).multiply(_hq.copy(homeQ).invert()) : _sq.identity();
export function resetSpin() { if (model) { model.quaternion.copy(homeQ); model.position.copy(homeP); invalidate(); } }

// ---------- picking: click a part on the model to find it in the list
const ray = new THREE.Raycaster(); let flash = 0;
export function pick(clientX, clientY) {
  if (!model) return false;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), cam);
  const hit = ray.intersectObject(model, true).find(h => h.object.isMesh && h.object.visible), row = hit && meshRow.get(hit.object);
  document.querySelectorAll('#parts .line.picked').forEach(l => l.classList.remove('picked'));
  if (!row) return false;
  picked = hit.object;
  for (let p = row.el.parentElement; p && p.id !== 'parts'; p = p.parentElement) { p.classList.remove('closed'); p.hidden = false; }
  row.el.hidden = false; row.line.classList.add('picked'); row.line.scrollIntoView({ block: 'nearest' });
  const ms = [...lit]; highlight(ms, false); clearTimeout(flash);
  const part = row.node.meshes.includes(hit.object) ? row.node.meshes : [hit.object];
  highlight(part, true); flash = setTimeout(() => highlight(part, false), 900);
  return true;
}
