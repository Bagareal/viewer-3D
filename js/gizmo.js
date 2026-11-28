// Orientation cube with the X / Y / Z axes, top right of the stage. It turns with the view;
// clicking a face, an edge or a corner moves the camera to look from that side.
import { THREE, AXES, cam, ctr, invalidate, afterDraw } from './viewer.js';
import { model, spinQuat } from './model.js';
import { t } from './i18n.js';

const canvas = document.getElementById('gizmo');
const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
r.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const gcam = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, .1, 10);
scene.add(new THREE.AmbientLight(0xffffff, 1.7));
const light = new THREE.DirectionalLight(0xffffff, 1.3); light.position.set(.4, .7, 1); gcam.add(light); scene.add(gcam);
const cube = new THREE.Group(); scene.add(cube);

// ---------- the cube: 6 faces, 12 edges and 8 corners, each one a clickable block
const E = .22, BASE = 0xdadcdf, HOVER = 0xe8b04a, regions = [];
for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
  if (!i && !j && !k) continue;
  const s = v => v ? E : 1 - 2 * E;
  const m = new THREE.Mesh(new THREE.BoxGeometry(s(i), s(j), s(k)), new THREE.MeshLambertMaterial({ color: BASE }));
  m.position.set(i, j, k).multiplyScalar(.5 - E / 2);
  m.userData.dir = new THREE.Vector3(i, j, k).normalize();
  cube.add(m); regions.push(m);
}
cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x777c84 })));

// Face names. In the scene the front is +Z and up is +Y (shown as Z, as in CAD programs).
const faces = [['front', [0, 0, 1], [0, 0, 0]], ['back', [0, 0, -1], [0, Math.PI, 0]], ['right', [1, 0, 0], [0, Math.PI / 2, 0]],
  ['left', [-1, 0, 0], [0, -Math.PI / 2, 0]], ['top', [0, 1, 0], [-Math.PI / 2, 0, 0]], ['bottom', [0, -1, 0], [Math.PI / 2, 0, 0]]];
const labels = faces.map(([key, n, rot]) => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.94, .94), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  p.position.set(...n).multiplyScalar(.503); p.rotation.set(...rot); p.raycast = () => {}; p.userData.key = key;
  cube.add(p); return p;
});
export function relabelCube() {
  const names = t('cube');
  labels.forEach(p => {
    const c = p.material.map.image, g = c.getContext('2d'), txt = names[p.userData.key].toUpperCase();
    g.clearRect(0, 0, 256, 256);
    let f = 60; do { g.font = `700 ${f}px system-ui,"Segoe UI",sans-serif`; f -= 2; } while (g.measureText(txt).width > 226 && f > 18);
    g.fillStyle = '#2b2f35'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 132);
    p.material.map.needsUpdate = true;
  });
  render();
}

// ---------- the axes, starting from the cube's front-left-bottom corner
const COLORS = { x: '#e5484d', y: '#2f9e5b', z: '#3a78f2' }, UP = new THREE.Vector3(0, 1, 0);
const triad = new THREE.Group(); triad.position.set(-.53, -.53, .53); cube.add(triad);
for (const [k, d] of Object.entries(AXES)) {
  const dir = new THREE.Vector3(...d), mat = new THREE.MeshBasicMaterial({ color: COLORS[k] }), L = .95;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, L, 10), mat);
  shaft.position.copy(dir).multiplyScalar(L / 2); shaft.quaternion.setFromUnitVectors(UP, dir);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.085, .2, 16), mat);
  tip.position.copy(dir).multiplyScalar(L + .1); tip.quaternion.copy(shaft.quaternion);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.font = '800 44px system-ui,"Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(k.toUpperCase(), 32, 34); g.fillStyle = COLORS[k]; g.fillText(k.toUpperCase(), 32, 34);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); sp.scale.setScalar(.32); sp.renderOrder = 2;
  sp.position.copy(dir).multiplyScalar(L + .3);
  triad.add(shaft, tip, sp);
}

// ---------- follow the main camera (and the product, when it is turned on one axis)
function render() {
  canvas.hidden = !model; if (!model) return;
  const w = canvas.clientWidth, h = canvas.clientHeight, size = r.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) r.setSize(w, h, false);
  cube.quaternion.copy(spinQuat());
  gcam.quaternion.copy(cam.quaternion); gcam.position.set(0, 0, 5).applyQuaternion(cam.quaternion);
  r.render(scene, gcam);
}
afterDraw.push(render);

// ---------- hover and click
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hover = null, down = null, anim = 0;
function hit(e) {
  const b = canvas.getBoundingClientRect();
  ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(ndc, gcam);
  return ray.intersectObjects(regions, false)[0]?.object || null;
}
function setHover(m) {
  if (m === hover) return;
  if (hover) hover.material.color.setHex(BASE);
  hover = m; if (m) m.material.color.setHex(HOVER);
  canvas.style.cursor = m ? 'pointer' : ''; render();
}
canvas.addEventListener('pointermove', e => setHover(hit(e)));
canvas.addEventListener('pointerleave', () => setHover(null));
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  const click = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5; down = null;
  const m = click && hit(e); if (m) goTo(m.userData.dir.clone().applyQuaternion(cube.quaternion));
});

// Moves the camera around the current centre of the view to look along -dir, keeping the distance.
export function goTo(dir) {
  const target = ctr.target.clone(), d = cam.position.distanceTo(target);
  const end = dir.clone().normalize();
  if (Math.abs(end.y) > .999) end.set(0, Math.sign(end.y), .002).normalize(); // straight above/below: keep the front at the bottom
  const start = cam.position.clone().sub(target).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(start, end), id = new THREE.Quaternion(), qt = new THREE.Quaternion();
  document.querySelectorAll('#presets .on').forEach(b => b.classList.remove('on'));
  const t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
  cancelAnimationFrame(anim);
  const step = now => {
    const k = dur ? Math.min(1, (now - t0) / dur) : 1, s = k < .5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2;
    qt.slerpQuaternions(id, q, s);
    cam.position.copy(start).applyQuaternion(qt).multiplyScalar(d).add(target); ctr.target.copy(target); ctr.update(); invalidate();
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
