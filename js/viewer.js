// Scene, camera, framing and the three render styles (shaded / depth map / line drawing).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const stage = document.getElementById('stage');
// CAD axes (Z up, as in CAD programs) expressed in the scene, where up is +Y and the front faces +Z.
export const AXES = { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] };
export const afterDraw = []; // drawn after the main view, never in exported images
const frameEl = document.getElementById('frame');

// Everything that defines "the picture": saved with views, read by the export.
export const view = { focal: 50, ratio: 0, style: 'shaded', bg: 'grey', floor: false, colors: false, dir: [-.8, .35, 1] };
// Zoom and shift of the frame on the stage (Scene panel only; 1 and [0, 0] everywhere else). Images are not affected.
export const zoom2d = { k: 1, pan: [0, 0] };

export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
stage.prepend(renderer.domElement);

const GREY = new THREE.Color(0xe9e9e7), WHITE = new THREE.Color(0xffffff), BLACK = new THREE.Color(0x000000);
export const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6));
[[1, 1.6, 1.2, 1.6], [-1.2, .5, .4, .6], [-.3, 1, -1.4, .7]].forEach(([x, y, z, i]) => {
  const l = new THREE.DirectionalLight(0xffffff, i); l.position.set(x, y, z); scene.add(l);
});
// Reflections for metallic materials; only switched on with original colours.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = 0;
pmrem.dispose();

export const cam = new THREE.PerspectiveCamera(30, 1, .001, 100);
export const ctr = new OrbitControls(cam, renderer.domElement);
ctr.enableDamping = true; ctr.dampingFactor = .12; ctr.screenSpacePanning = true;
ctr.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
renderer.domElement.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); // no autoscroll on wheel click

export const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshLambertMaterial({ color: 0xd8d8d5 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
// stand: where the product stands in a photo (Scene panel); left untouched (identity) everywhere else.
export const stand = new THREE.Group(); scene.add(stand);
export const holder = new THREE.Group(); stand.add(holder);
export const sphere = new THREE.Sphere(); // bounding sphere of the model at rest

// ---------- render on demand
let dirty = true;
export const lock = { on: false }; // camera set from a photo (Scene panel): the orbit controls leave it alone
// Opacity of the product in the Scene panel's preview (1 = opaque). Never applied to captures: exports are always at 100%.
export const ghost = { k: 1 };
let capturing = false;
export const invalidate = () => { dirty = true; };
ctr.addEventListener('change', invalidate);

// ---------- framing
// The frame is the part of the stage that ends up in the image: the whole stage, or a centred box of the chosen ratio.
// x, y: its top left corner on the stage (moved by the Scene panel's zoom and shift).
export function frameSize() {
  const W = stage.clientWidth || 1, H = stage.clientHeight || 1;
  let w = W, h = H;
  if (view.ratio) { w = W * .94; h = w / view.ratio; if (h > H * .94) { h = H * .94; w = h * view.ratio; } }
  w *= zoom2d.k; h *= zoom2d.k;
  return { w, h, W, H, x: (W - w) / 2 + zoom2d.pan[0], y: (H - h) / 2 + zoom2d.pan[1] };
}
// Half vertical angle (as a tangent) of the frame: the focal length applies to the frame's short side, like a 36x24 sensor.
function frameTanV() { const { w, h } = frameSize(), s = 12 / view.focal; return w >= h ? s : s * h / w; }
function updateFov() {
  const { h, H } = frameSize();
  cam.fov = 2 * Math.atan(frameTanV() * H / h) * 180 / Math.PI; cam.updateProjectionMatrix();
}
export function fitDist() {
  const { w, h } = frameSize(), tv = frameTanV(), th = tv * w / h;
  return sphere.radius * 1.08 / Math.sin(Math.atan(Math.min(tv, th)));
}
export function resize() {
  const { w, h, W, H } = frameSize();
  const { x, y } = frameSize();
  renderer.setSize(W, H, false); cam.aspect = W / H; updateFov();
  // a shifted frame: the lens axis follows the frame's centre
  if (zoom2d.pan[0] || zoom2d.pan[1]) cam.setViewOffset(W, H, -zoom2d.pan[0], -zoom2d.pan[1], W, H); else cam.clearViewOffset();
  frameEl.hidden = !view.ratio;
  Object.assign(frameEl.style, { width: w + 'px', height: h + 'px', left: x + 'px', top: y + 'px' });
  invalidate();
}
export function place(dir) {
  view.dir = dir;
  const d = new THREE.Vector3(...dir).normalize();
  cam.position.copy(sphere.center).addScaledVector(d, fitDist()); ctr.target.copy(sphere.center);
  updateClip(); ctr.update(); invalidate();
}
function updateClip() { cam.near = sphere.radius / 100; cam.far = sphere.radius * 200; cam.updateProjectionMatrix(); }
// Puts the camera at an exact position, aimed at a point (used by the camera moves).
export function setCamera(pos, target) { cam.position.copy(pos); ctr.target.copy(target); updateClip(); ctr.update(); invalidate(); }
// Changing focal length or ratio keeps the product the same size on screen (the camera dollies).
function keepSize(change) {
  const d = cam.position.distanceTo(ctr.target), { h, H } = frameSize(), old = Math.tan(cam.fov * Math.PI / 360) * h / H;
  change(); resize();
  const f = frameSize(), now = Math.tan(cam.fov * Math.PI / 360) * f.h / f.H;
  const dir = cam.position.clone().sub(ctr.target).normalize();
  cam.position.copy(ctr.target).addScaledVector(dir, d * old / now); ctr.update(); invalidate();
}
export const setFocal = v => keepSize(() => { view.focal = v; });
export function setRatio(r) { view.ratio = r; resize(); }

// Camera pose relative to the model's size, so a saved view fits any product.
export function getPose() {
  const r = sphere.radius, rel = v => v.clone().sub(sphere.center).divideScalar(r).toArray().map(n => +n.toFixed(5));
  return { pos: rel(cam.position), target: rel(ctr.target), focal: view.focal, ratio: view.ratio };
}
export function setPose(p) {
  view.focal = p.focal || 50; view.ratio = p.ratio || 0; resize();
  const abs = a => new THREE.Vector3(...a).multiplyScalar(sphere.radius).add(sphere.center);
  cam.position.copy(abs(p.pos)); ctr.target.copy(abs(p.target)); updateClip(); ctr.update(); invalidate();
}

// ---------- render styles
const depthMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide, uniforms: { uNear: { value: 0 }, uFar: { value: 1 } },
  vertexShader: 'varying float vZ;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vZ=-mv.z;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform float uNear,uFar;varying float vZ;void main(){float d=clamp((vZ-uNear)/(uFar-uNear),0.,1.);gl_FragColor=vec4(vec3(1.-d*.92),1.);}' // near = white
});
const normalMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide, uniforms: { uNear: { value: 0 }, uFar: { value: 1 } },
  vertexShader: 'varying float vZ;varying vec3 vN;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vZ=-mv.z;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform float uNear,uFar;varying float vZ;varying vec3 vN;void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;gl_FragColor=vec4(n*.5+.5,clamp((vZ-uNear)/(uFar-uNear),0.,1.));}'
});
// Line drawing: outlines where the surface direction or the depth jumps between neighbouring pixels.
const edgeMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  uniforms: { tex: { value: null }, px: { value: new THREE.Vector2() }, uClear: { value: 0 }, uView: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `uniform sampler2D tex;uniform vec2 px;uniform float uClear,uView;varying vec2 vUv;
void main(){vec4 c=texture2D(tex,vUv),a=texture2D(tex,vUv+px),b=texture2D(tex,vUv-px),d=texture2D(tex,vUv+vec2(px.x,-px.y)),e=texture2D(tex,vUv+vec2(-px.x,px.y));
float dn=max(distance(a.rgb,b.rgb),distance(d.rgb,e.rgb)),dz=max(abs(a.a-b.a),abs(d.a-e.a));
float t=.012/max(abs(c.b*2.-1.),.15);
float edge=max(smoothstep(.2,.4,dn),smoothstep(t,t*2.5,dz));
gl_FragColor=uView>.5?vec4(vec3(.9)*edge,edge):uClear>.5?vec4(0.,0.,0.,edge):vec4(vec3(1.-edge),1.);}`
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMat); quad.frustumCulled = false;
const quadScene = new THREE.Scene(); quadScene.add(quad); const quadCam = new THREE.Camera();
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const _v2 = new THREE.Vector2(), _box = new THREE.Box3(), _b = new THREE.Box3(), _s = new THREE.Sphere();

// Nearest and farthest depth of what is visible, so the depth map uses the full black-to-white range.
function depthRange() {
  _box.makeEmpty();
  holder.traverseVisible(o => { if (o.isMesh && o.geometry.boundingBox) _box.union(_b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); });
  if (_box.isEmpty()) return [cam.near, cam.far];
  _box.getBoundingSphere(_s);
  const d = cam.position.distanceTo(_s.center);
  return [Math.max(cam.near, d - _s.radius), d + _s.radius];
}
// Makes the product's materials see-through for one render, then puts them back.
function fade(k) {
  const was = new Map();
  holder.traverse(o => { if (o.isMesh) [o.material].flat().forEach(m => { if (m && !was.has(m)) was.set(m, [m.transparent, m.opacity, m.depthWrite]); }); });
  was.forEach(([, op], m) => { m.transparent = true; m.opacity = op * k; m.depthWrite = false; });
  return () => was.forEach(([tr, op, dw], m) => { m.transparent = tr; m.opacity = op; m.depthWrite = dw; });
}
function draw() {
  const clear = view.bg === 'none';
  renderer.setRenderTarget(null);
  if (view.style === 'shaded') {
    // The view is always on the dark stage (CSS); the chosen background only goes into saved images, video and exports.
    floor.visible = view.floor && !clear; floor.material.color.setHex(capturing ? 0xd8d8d5 : 0x30343a);
    scene.background = clear || !capturing ? null : view.bg === 'white' ? WHITE : GREY;
    const undo = lock.on && !capturing && ghost.k < 1 ? fade(ghost.k) : null;
    try { renderer.render(scene, cam); } finally { if (undo) undo(); }
    return;
  }
  scene.updateMatrixWorld();
  const show = hideClear();
  try { drawGuide(); } finally { show(); }
}
// Depth map and line drawing: see-through parts are drawn as solid there, except those at 0%.
function drawGuide() {
  const clear = view.bg === 'none';
  const [n, f] = depthRange(), wasFloor = floor.visible; floor.visible = false;
  if (view.style === 'depth') {
    depthMat.uniforms.uNear.value = n; depthMat.uniforms.uFar.value = f;
    scene.overrideMaterial = depthMat; scene.background = BLACK; renderer.render(scene, cam);
  } else {
    renderer.getDrawingBufferSize(_v2);
    if (rt.width !== _v2.x || rt.height !== _v2.y) rt.setSize(_v2.x, _v2.y);
    normalMat.uniforms.uNear.value = n; normalMat.uniforms.uFar.value = f;
    scene.overrideMaterial = normalMat; scene.background = null;
    renderer.setClearColor(0x000000, 1); renderer.setRenderTarget(rt); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0);
    const k = Math.max(1, Math.max(_v2.x, _v2.y) / 1400); // line weight follows the image size
    edgeMat.uniforms.tex.value = rt.texture; edgeMat.uniforms.px.value.set(k / _v2.x, k / _v2.y); edgeMat.uniforms.uClear.value = clear ? 1 : 0; edgeMat.uniforms.uView.value = capturing ? 0 : 1;
    renderer.render(quadScene, quadCam);
  }
  scene.overrideMaterial = null; floor.visible = wasFloor;
}
export function refreshLook() {
  scene.environmentIntensity = view.colors ? .45 : 0;
  stage.classList.toggle('clear', view.bg === 'none' && view.style !== 'depth');
  invalidate();
}

// Capture: renders exactly what is inside the frame, at a size given by its long side.
// beginCapture -> drawCapture (as many times as needed) -> endCapture.
let capturePr = 1;
export function captureSize(longSide, even = false) {
  const { w, h } = frameSize(), r = w / h;
  const max = Math.min(renderer.capabilities.maxTextureSize, 8192), N = Math.min(longSide, max);
  const rnd = even ? x => 2 * Math.round(x / 2) : Math.round; // video encoders need even sizes
  return { W: rnd(r >= 1 ? N : N * r), H: rnd(r >= 1 ? N / r : N) };
}
export function beginCapture(longSide, even = false) {
  const { h, H } = frameSize(), { W, H: Hh } = captureSize(longSide, even);
  capturePr = renderer.getPixelRatio(); cam.clearViewOffset(); capturing = true; // the image is always the frame, centred
  cam.aspect = W / Hh; cam.fov = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * h / H) * 180 / Math.PI; cam.updateProjectionMatrix();
  renderer.setPixelRatio(1); renderer.setSize(W, Hh, false);
  return { W, H: Hh };
}
export function drawCapture() { draw(); return renderer.domElement; }
export function endCapture() { capturing = false; renderer.setPixelRatio(capturePr); resize(); draw(); }

// Masks of the frame, same camera, framing and size as the image, always PNG. Antialiasing: the mask
// is drawn as if at twice the size, in 4 tiles of the image's own size (the camera's view split in
// four, so the projection is exactly the image's and the canvas keeps its size), then every 2 x 2
// pixels are averaged: edge pixels get in-between values that follow how much of them the product
// covers. Openings stay background.
// mask: product opaque, background transparent (alpha = coverage). bw: the same in black on white.
// Parts made see-through in the Parts panel count as solid there (a part at 0% is left out).
// alpha: only when some part is see-through; the same mask, where each part covers as much as its
// opacity (a part at 30% with nothing behind it: alpha 30%; an opaque part behind it stays opaque).
const maskMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
const opOf = o => o.userData.op ?? 1;
// Hides the parts set to 0% for one render (they are see-through, not hidden: the colour render keeps them).
function hideClear() {
  const off = [];
  holder.traverse(o => { if (o.isMesh && o.visible && opOf(o) <= 0) { o.visible = false; off.push(o); } });
  return () => off.forEach(o => { o.visible = true; });
}
// Each mesh drawn in black at its own opacity, the opaque ones first (three.js draws transparent ones last).
function opacityMaterials() {
  const was = new Map(), mats = new Map();
  holder.traverse(o => {
    if (!o.isMesh) return;
    was.set(o, o.material);
    const op = Math.max(0, Math.min(1, opOf(o)));
    if (op >= 1) { o.material = maskMat; return; }
    let m = mats.get(op);
    if (!m) mats.set(op, m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, transparent: true, opacity: op, depthWrite: false }));
    o.material = m;
  });
  return () => { was.forEach((m, o) => { o.material = m; }); mats.forEach(m => m.dispose()); };
}
// Coverage of the frame, 0 = product, 255 = background, antialiased (see above).
function coverage(W, H, g) {
  const S = 2, sum = new Uint16Array(W * H);
  for (let ty = 0; ty < S; ty++) for (let tx = 0; tx < S; tx++) {
    cam.setViewOffset(W * S, H * S, tx * W, ty * H, W, H);
    renderer.render(scene, cam);
    g.drawImage(renderer.domElement, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) {
      const out = ((ty * H + y) >> 1) * W, row = y * W * 4;
      for (let x = 0; x < W; x++) sum[out + ((tx * W + x) >> 1)] += d[row + x * 4];
    }
  }
  return sum.map(v => Math.round(v / (S * S)));
}
async function maskBlobs(W, H) {
  const wasFloor = floor.visible, bg = scene.background;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  let see = false; holder.traverse(o => { if (o.isMesh && o.visible && opOf(o) < 1) see = true; });
  let full, part = null;
  renderer.setRenderTarget(null); floor.visible = false; scene.background = WHITE;
  try {
    const show = hideClear(); scene.overrideMaterial = maskMat;
    try { full = coverage(W, H, g); } finally { scene.overrideMaterial = null; show(); }
    if (see) { const undo = opacityMaterials(); try { part = coverage(W, H, g); } finally { undo(); } }
  } finally { cam.clearViewOffset(); scene.background = bg; floor.visible = wasFloor; }
  const png = () => new Promise(res => c.toBlob(res, 'image/png'));
  const alphaOf = cov => { const a = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < cov.length; i++) a[i * 4 + 3] = 255 - cov[i]; return new ImageData(a, W, H); };
  const img = g.createImageData(W, H), d = img.data;
  for (let i = 0, j = 0; i < full.length; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = full[i]; d[j + 3] = 255; }
  g.putImageData(img, 0, 0); const bw = await png();
  g.clearRect(0, 0, W, H); g.putImageData(alphaOf(full), 0, 0); const mask = await png();
  let alpha = null;
  if (part) { g.clearRect(0, 0, W, H); g.putImageData(alphaOf(part), 0, 0); alpha = await png(); }
  return { mask, bw, alpha };
}

// The frame at the requested size, as an image blob; withMask: also its masks.
export async function snapshot(longSide, withMask = false) {
  const { W, H } = beginCapture(longSide);
  let blob, mask = null, bw = null, alpha = null;
  try {
    drawCapture();
    const png = view.style !== 'shaded' || view.bg === 'none';
    blob = await new Promise(res => renderer.domElement.toBlob(res, png ? 'image/png' : 'image/jpeg', .95));
    if (withMask) ({ mask, bw, alpha } = await maskBlobs(W, H));
  } finally { endCapture(); }
  return { blob, mask, bw, alpha, W, H };
}

addEventListener('resize', resize);
new ResizeObserver(resize).observe(stage);
(function loop() { requestAnimationFrame(loop); if (!lock.on) ctr.update(); if (dirty) { dirty = false; draw(); afterDraw.forEach(f => f()); } })();
