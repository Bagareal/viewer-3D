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
export const holder = new THREE.Group(); scene.add(holder);
export const sphere = new THREE.Sphere(); // bounding sphere of the model at rest

// ---------- render on demand
let dirty = true;
export const invalidate = () => { dirty = true; };
ctr.addEventListener('change', invalidate);

// ---------- framing
// The frame is the part of the stage that ends up in the image: the whole stage, or a centred box of the chosen ratio.
export function frameSize() {
  const W = stage.clientWidth || 1, H = stage.clientHeight || 1;
  if (!view.ratio) return { w: W, h: H, W, H };
  let w = W * .94, h = w / view.ratio;
  if (h > H * .94) { h = H * .94; w = h * view.ratio; }
  return { w, h, W, H };
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
  renderer.setSize(W, H, false); cam.aspect = W / H; updateFov();
  frameEl.hidden = !view.ratio;
  Object.assign(frameEl.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px' });
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
  uniforms: { tex: { value: null }, px: { value: new THREE.Vector2() }, uClear: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `uniform sampler2D tex;uniform vec2 px;uniform float uClear;varying vec2 vUv;
void main(){vec4 c=texture2D(tex,vUv),a=texture2D(tex,vUv+px),b=texture2D(tex,vUv-px),d=texture2D(tex,vUv+vec2(px.x,-px.y)),e=texture2D(tex,vUv+vec2(-px.x,px.y));
float dn=max(distance(a.rgb,b.rgb),distance(d.rgb,e.rgb)),dz=max(abs(a.a-b.a),abs(d.a-e.a));
float t=.012/max(abs(c.b*2.-1.),.15);
float edge=max(smoothstep(.2,.4,dn),smoothstep(t,t*2.5,dz));
gl_FragColor=uClear>.5?vec4(0.,0.,0.,edge):vec4(vec3(1.-edge),1.);}`
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
function draw() {
  const clear = view.bg === 'none';
  renderer.setRenderTarget(null);
  if (view.style === 'shaded') {
    floor.visible = view.floor && !clear; scene.background = clear ? null : view.bg === 'white' ? WHITE : GREY;
    renderer.render(scene, cam); return;
  }
  scene.updateMatrixWorld();
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
    edgeMat.uniforms.tex.value = rt.texture; edgeMat.uniforms.px.value.set(k / _v2.x, k / _v2.y); edgeMat.uniforms.uClear.value = clear ? 1 : 0;
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
  capturePr = renderer.getPixelRatio();
  cam.aspect = W / Hh; cam.fov = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * h / H) * 180 / Math.PI; cam.updateProjectionMatrix();
  renderer.setPixelRatio(1); renderer.setSize(W, Hh, false);
  return { W, H: Hh };
}
export function drawCapture() { draw(); return renderer.domElement; }
export function endCapture() { renderer.setPixelRatio(capturePr); resize(); draw(); }

// The frame at the requested size, as an image blob.
export async function snapshot(longSide) {
  const { W, H } = beginCapture(longSide);
  let blob;
  try {
    drawCapture();
    const png = view.style !== 'shaded' || view.bg === 'none';
    blob = await new Promise(res => renderer.domElement.toBlob(res, png ? 'image/png' : 'image/jpeg', .95));
  } finally { endCapture(); }
  return { blob, W, H };
}

addEventListener('resize', resize);
new ResizeObserver(resize).observe(stage);
(function loop() { requestAnimationFrame(loop); ctr.update(); if (dirty) { dirty = false; draw(); afterDraw.forEach(f => f()); } })();
