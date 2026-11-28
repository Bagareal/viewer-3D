// Product in a photo (Scene panel). The photo is the background. A square whose four corners are dragged
// onto a rectangle lying on a surface of the photo (worktop, table, tile) gives the camera: how it is turned
// and tilted and, when the square allows it, its focal length. The corners can go anywhere, also far
// outside the photo: the wheel zooms the view out (and in) and the view can be moved, so a surface seen
// close, or a portrait photo, still gets its whole rectangle. A magnifier shows the photo under a corner
// while it is dragged. The product always rests on that plane: it slides, turns around the vertical axis
// and changes size, it never lifts off. Export: the photo, the photo with the grey product, the grey
// product alone, its masks and a JSON.
import { THREE, view, zoom2d, cam, ctr, renderer, stand, sphere, frameSize, resize, setRatio, getPose, setPose, refreshLook, snapshot, invalidate, afterDraw, lock, ghost } from './viewer.js';
import { model, applyMaterials } from './model.js';
import { t } from './i18n.js';
import { zip } from './zip.js';

const $ = id => document.getElementById(id), stage = $('stage');
export const IMAGES = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp'];
const V3 = THREE.Vector3;

// ---------- state (kept while the page is open; the exported JSON brings it back)
const photo = { file: null, img: null, url: '', w: 0, h: 0, name: '', ext: 'jpg' };
// Corners 1 to 4 in fractions of the photo (they may go below 0 or above 1). Default: a surface seen from above.
const DEF = [[.4, .6], [.76, .66], [.7, .88], [.18, .76]];
const S = { corners: DEF.map(c => [...c]), auto: true, mm: 28, u: null, v: null, rot: null, size: 1, grid: true };
let active = false, wanted = false, saved = null, cam3 = null, hooks = { base: () => 'view', file: () => '', download: () => {} };
export const sceneActive = () => active;
export function bindScene(h) { hooks = h; }

// ---------- elements on the stage
// Under the product: the square and its grid, its sides carried on to where they meet, the horizon.
// Above it: the four corners. Bottom left of the stage: the view's zoom.
const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (tag, cls, parent) => { const e = document.createElementNS(SVG, tag); if (cls) e.setAttribute('class', cls); parent.append(e); return e; };
const photoEl = document.createElement('img'); photoEl.id = 'photo'; photoEl.alt = ''; photoEl.hidden = true;
const underEl = document.createElement('div'); underEl.id = 'gridLines'; underEl.hidden = true;
const under = svgEl('svg', '', underEl); under.setAttribute('preserveAspectRatio', 'none');
const extPath = svgEl('path', 'ext', under), fill = svgEl('path', 'fill', under), gridPath = svgEl('path', 'plane', under);
const edge = svgEl('path', 'edge', under), horizon = svgEl('path', 'horizon', under), horizonTag = svgEl('text', 'horizonTag', under);
const vps = [svgEl('circle', 'vp', under), svgEl('circle', 'vp', under)];
[extPath, gridPath, edge, horizon, ...vps].forEach(p => p.setAttribute('vector-effect', 'non-scaling-stroke'));
const topEl = document.createElement('div'); topEl.id = 'grid'; topEl.hidden = true;
const handles = [0, 1, 2, 3].map(i => { const b = document.createElement('b'); b.textContent = i + 1; topEl.append(b); return b; });
const loupe = document.createElement('div'); loupe.id = 'loupe'; loupe.hidden = true;
const bar = document.createElement('div'); bar.id = 'zoomBar'; bar.hidden = true;
bar.innerHTML = '<button data-z="-1" aria-label="−">−</button><span></span><button data-z="1" aria-label="+">+</button><button data-z="0" data-t="scFit"></button>';
// While exporting, the 3D view renders at the photo's size and would show stretched: a still picture of the
// view as it was covers it, with a small "Exporting" label.
const freeze = document.createElement('img'); freeze.id = 'freeze'; freeze.alt = ''; freeze.hidden = true;
const badge = document.createElement('div'); badge.id = 'exportBadge'; badge.hidden = true;
stage.prepend(photoEl, underEl); stage.append(topEl, loupe, bar, freeze, badge);

// Photo and drawings sit exactly on the frame, which has the photo's proportions.
let drawnW = 0;
afterDraw.push(() => {
  if (!active) return;
  const { w, h, x, y } = frameSize(), box = { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' };
  [photoEl, underEl, topEl].forEach(el => Object.assign(el.style, box));
  if (w !== drawnW) drawGrid();
});

// ---------- the camera, from the square
// Image points are measured from the photo centre, in half long sides (y down), as homogeneous vectors.
const half = () => Math.max(photo.w, photo.h) / 2;
const hp = ([x, y]) => [(x - .5) * photo.w / half(), (y - .5) * photo.h / half(), 1];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const l = Math.hypot(...v); return l > 1e-12 ? v.map(x => x / l) : null; };
// The square's sides: 1-2 and 4-3 go one way, 4-1 and 3-2 the other way.
const sides = c => ({ a: [[c[0], c[1]], [c[3], c[2]]], b: [[c[3], c[0]], [c[2], c[1]]] });
// Where two opposite sides meet (homogeneous, unit length; third value 0 = parallel in the photo).
function vanish(pair) { const [a, b] = pair.map(([p, q]) => unit(cross(hp(p), hp(q)))); return a && b ? unit(cross(a, b)) : null; }
// Two directions at right angles: f² = -(x1 x2 + y1 y2) / (w1 w2), when both vanishing points are finite.
function focal2(p, q) {
  const c = p[2] * q[2]; if (Math.abs(c) < 1e-6) return null;
  const f2 = -(p[0] * q[0] + p[1] * q[1]) / c; return f2 > 0 ? f2 : null;
}
// The four corners turn the same way all round (no crossing, no dent).
function convex(c) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b, d] = [c[i], c[(i + 1) % 4], c[(i + 2) % 4]].map(hp);
    const z = (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]);
    if (Math.abs(z) < 1e-9 || (sign && Math.sign(z) !== sign)) return false;
    sign = Math.sign(z);
  }
  return true;
}
// Focal lengths are given like everywhere in the viewer: for a 36 x 24 sensor, on the photo's short side.
const toMm = f => 24 * f * half() / Math.min(photo.w, photo.h);
const toF = mm => mm * Math.min(photo.w, photo.h) / 24 / half();
const height = () => sphere.radius * 3; // camera height above the plane; the product's size in the photo is set with Size

function solve() {
  if (!convex(S.corners)) return null;
  const L = sides(S.corners), A = vanish(L.a), B = vanish(L.b);
  if (!A || !B) return null;
  const f2 = focal2(A, B), est = f2 ? toMm(Math.sqrt(f2)) : null, autoMm = est >= 8 && est <= 400 ? est : null;
  const mm = S.auto && autoMm ? autoMm : S.mm, f = toF(mm);
  // Directions of the two pairs of sides, pointing from corner 1 to 2 and from corner 4 to 1.
  const dir = (P, [p, q]) => {
    const d = new V3(P[0] / f, P[1] / f, P[2]).normalize(); [p, q] = [p, q].map(hp);
    const mx = (p[0] + q[0]) / 2 / f, my = (p[1] + q[1]) / 2 / f;
    if ((d.x - mx * d.z) * (q[0] - p[0]) + (d.y - my * d.z) * (q[1] - p[1]) < 0) d.negate();
    return d;
  };
  const r1 = dir(A, L.a[0]), r2 = dir(B, L.b[0]);
  if (Math.abs(r1.dot(r2)) > .94) return null;
  // made exactly perpendicular, sharing the difference equally
  const p = r1.clone().add(r2).normalize(), q = r1.clone().sub(r2).normalize();
  r1.copy(p).add(q).normalize(); r2.copy(p).sub(q).normalize();
  const r3 = new V3().crossVectors(r1, r2);
  // the square lies on the plane: its middle must be below the horizon, seen from above
  const o = S.corners.map(hp).reduce((s, x) => [s[0] + x[0] / 4, s[1] + x[1] / 4], [0, 0]);
  const dO = new V3(o[0] / f, o[1] / f, 1).normalize();
  if (r3.dot(dO) > 0) { r2.negate(); r3.negate(); }
  if (r3.dot(dO) > -.01) return null;
  const H0 = height(), tt = r3.clone().multiplyScalar(-H0); // the scene's origin, right under the camera
  // Scene axes: x = r1, up (y) = r3, z = -r2. Camera axes (three.js): x right, y up, z back = (x, -y, -z) of the photo.
  const m = new THREE.Matrix4().set(
    r1.x, r3.x, -r2.x, tt.x,
    -r1.y, -r3.y, r2.y, -tt.y,
    -r1.z, -r3.z, r2.z, -tt.z,
    0, 0, 0, 1).invert();
  const oFrac = [o[0] * half() / photo.w + .5, o[1] * half() / photo.h + .5];
  return { m, mm, autoMm, f, r1, r2, r3, tt, H0, oFrac, vp: [A, B] };
}

// Photo point (fractions) -> point of the plane in the scene, or null above the horizon.
function toPlane(u, v, c = cam3) {
  const [x, y] = hp([u, v]), d = new V3(x / c.f, y / c.f, 1), k = -c.H0 / c.r3.dot(d);
  if (!(k > 0) || k > c.H0 * 300) return null;
  const X = d.multiplyScalar(k).sub(c.tt);
  return new V3(X.dot(c.r1), 0, -X.dot(c.r2));
}

function update() {
  if (!active) return;
  const r = solve();
  $('scGridBad').hidden = !!r; underEl.classList.toggle('bad', !r);
  if (r) {
    cam3 = r;
    r.m.decompose(cam.position, cam.quaternion, new V3()); cam.updateMatrixWorld(true);
    cam.near = r.H0 / 100; cam.far = r.H0 * 600;
    view.focal = r.mm; setRatio(photo.w / photo.h); // sets the field of view for this focal length
    if (S.u == null) [S.u, S.v] = r.oFrac;
  }
  placeProduct(); drawGrid(); drawControls();
}

// ---------- the product on the plane: its base stays on the same point of the photo when the square changes
let foot = new V3();
function placeProduct() {
  if (!cam3) return;
  const P = toPlane(S.u, S.v); if (P) foot = P;
  if (S.rot == null) S.rot = Math.round(wrap(Math.atan2(-foot.x, -foot.z) * 180 / Math.PI)); // facing the camera
  stand.position.copy(foot); stand.rotation.set(0, S.rot * Math.PI / 180, 0); stand.scale.setScalar(S.size);
  stand.updateMatrixWorld(true); invalidate();
}
const wrap = a => ((a + 180) % 360 + 360) % 360 - 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const frac = e => { const r = photoEl.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
function setSize(s) { S.size = clamp(s, 1 / 16, 16); placeProduct(); drawControls(); }

// ---------- the view: wheel = zoom around the pointer, middle button or Space + drag = move
const ZMIN = .1, ZMAX = 8;
function setZoom(k, cx, cy) {
  const s = stage.getBoundingClientRect(), f = frameSize();
  if (cx == null) { cx = s.left + s.width / 2; cy = s.top + s.height / 2; }
  k = clamp(k, ZMIN, ZMAX);
  const u = (cx - s.left - f.x) / f.w, v = (cy - s.top - f.y) / f.h, r = k / zoom2d.k; // the point under the pointer stays put
  const w = f.w * r, h = f.h * r;
  zoom2d.k = k; zoom2d.pan = [cx - s.left - u * w - (f.W - w) / 2, cy - s.top - v * h - (f.H - h) / 2];
  resize(); drawZoom();
}
function fit() { zoom2d.k = 1; zoom2d.pan = [0, 0]; resize(); drawZoom(); }
function drawZoom() { bar.querySelector('span').textContent = Math.round(zoom2d.k * 100) + '%'; }
bar.querySelectorAll('button').forEach(b => b.onclick = () => { const z = +b.dataset.z; if (!z) fit(); else setZoom(zoom2d.k * (z > 0 ? 1.25 : .8)); });
stage.addEventListener('wheel', e => {
  if (!active) return;
  e.preventDefault(); setZoom(zoom2d.k * Math.exp(-e.deltaY * .0015), e.clientX, e.clientY);
}, { passive: false });
let space = false;
addEventListener('keydown', e => { if (active && e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName)) { space = true; stage.classList.add('panning'); e.preventDefault(); } });
addEventListener('keyup', e => { if (e.code === 'Space') { space = false; stage.classList.remove('panning'); } });

// ---------- mouse on the photo: move the view, slide or turn the product
const cv = renderer.domElement;
let drag = null;
cv.addEventListener('pointerdown', e => {
  if (!active) return;
  if (e.button === 1 || (e.button === 0 && space)) { e.preventDefault(); drag = { pan: true, x: e.clientX, y: e.clientY }; }
  else if (!cam3) return;
  else if (e.button === 0) drag = { move: true, at: frac(e), u: S.u, v: S.v };
  else if (e.button === 2) drag = { turn: true, x: e.clientX };
  else return;
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!drag || !active) return;
  if (drag.pan) {
    zoom2d.pan = [zoom2d.pan[0] + e.clientX - drag.x, zoom2d.pan[1] + e.clientY - drag.y]; drag.x = e.clientX; drag.y = e.clientY;
    resize(); return;
  }
  if (drag.move) {
    const [x, y] = frac(e), u = drag.u + x - drag.at[0], v = drag.v + y - drag.at[1];
    if (!toPlane(u, v)) return; // not above the horizon
    S.u = u; S.v = v;
  } else { S.rot = wrap(S.rot + (e.clientX - drag.x) * .5); drag.x = e.clientX; }
  placeProduct(); drawControls();
});
const endDrag = () => { drag = null; };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });
cv.addEventListener('mousedown', e => { if (active && e.button === 1) e.preventDefault(); });

// ---------- the corners: drag them anywhere; a magnifier shows the photo under the corner
let held = -1;
handles.forEach((b, i) => {
  b.onpointerdown = e => {
    if (e.button !== 0 || space) return;
    e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); held = i; b.classList.add('on'); topEl.classList.add('dragging'); showLoupe(S.corners[i], e);
  };
  b.onpointermove = e => {
    if (held !== i) return;
    S.corners[i] = frac(e); showLoupe(S.corners[i], e); update();
  };
  b.onpointerup = b.onpointercancel = () => { held = -1; b.classList.remove('on'); topEl.classList.remove('dragging'); loupe.hidden = true; };
});
const LOUPE = 140, ZOOM = 4;
function showLoupe([u, v], e) {
  const r = photoEl.getBoundingClientRect(), s = stage.getBoundingClientRect(), W = r.width * ZOOM, H = r.height * ZOOM;
  Object.assign(loupe.style, { backgroundImage: `url("${photo.url}")`, backgroundSize: `${W}px ${H}px`, backgroundPosition: `${LOUPE / 2 - u * W}px ${LOUPE / 2 - v * H}px` });
  // above the pointer, on the side with room
  let x = e.clientX - s.left + 30, y = e.clientY - s.top - LOUPE - 30;
  if (x + LOUPE > s.width - 8) x = e.clientX - s.left - LOUPE - 30;
  if (y < 8) y = e.clientY - s.top + 30;
  Object.assign(loupe.style, { left: x + 'px', top: y + 'px' }); loupe.hidden = false;
}

// ---------- drawing (in photo pixels; outside the photo too)
// Homography taking the unit square (centred on 0) to the four corners, for the grid inside the square.
const SQ = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
function homography(dst) {
  const A = [], b = [];
  SQ.forEach(([u, v], i) => {
    const [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  });
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j < 8; j++) A[r][j] -= k * A[c][j]; b[r] -= k * b[c]; }
  }
  return [...b.map((v, i) => v / A[i][i]), 1];
}
const project = (H, u, v) => { const w = H[6] * u + H[7] * v + H[8]; return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w]; };
// A line through two points, cut to a box (pixels).
function clipLine(P, Q, box) {
  const d = [Q[0] - P[0], Q[1] - P[1]]; let lo = -1e9, hi = 1e9;
  for (let a = 0; a < 2; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (P[a] < box[a] || P[a] > box[a + 2]) return null; continue; }
    const t1 = (box[a] - P[a]) / d[a], t2 = (box[a + 2] - P[a]) / d[a];
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
  }
  return lo < hi ? [[P[0] + d[0] * lo, P[1] + d[1] * lo], [P[0] + d[0] * hi, P[1] + d[1] * hi]] : null;
}
const M = (a, b) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
function drawGrid() {
  if (!photo.img) return;
  const f = frameSize(), px = photo.w / f.w; drawnW = f.w; // photo pixels per screen pixel
  under.setAttribute('viewBox', `0 0 ${photo.w} ${photo.h}`);
  underEl.classList.toggle('off', !S.grid);
  const P = S.corners.map(([u, v]) => [u * photo.w, v * photo.h]);
  S.corners.forEach(([u, v], i) => Object.assign(handles[i].style, { left: u * 100 + '%', top: v * 100 + '%' }));
  // the visible part of the stage, in photo pixels (the drawings may cover all of it)
  const box = [-f.x * px, -f.y * px, (f.W - f.x) * px, (f.H - f.y) * px];
  const poly = 'M' + P.map(p => p.map(n => n.toFixed(1)).join(' ')).join('L') + 'Z';
  edge.setAttribute('d', poly); fill.setAttribute('d', poly);
  // sides carried on, dotted, towards where they meet
  let ex = '';
  [[0, 1], [3, 2], [3, 0], [2, 1]].forEach(([i, j]) => { const c = clipLine(P[i], P[j], box); if (c) ex += M(...c); });
  extPath.setAttribute('d', ex);
  // grid inside the square
  const H = convex(S.corners) && homography(P);
  let g = '';
  if (H) for (let i = 1; i < 8; i++) {
    const k = -.5 + i / 8;
    g += M(project(H, k, -.5), project(H, k, .5)) + M(project(H, -.5, k), project(H, .5, k));
  }
  gridPath.setAttribute('d', g);
  // where the sides meet, and the horizon through those two points
  let hd = ''; horizonTag.style.display = 'none';
  vps.forEach(c => c.style.display = 'none');
  if (cam3 && H) {
    const pts = cam3.vp.map(V => Math.abs(V[2]) > 1e-6 ? [V[0] / V[2] * half() + photo.w / 2, V[1] / V[2] * half() + photo.h / 2] : null);
    pts.forEach((p, i) => { if (!p) return; vps[i].setAttribute('cx', p[0]); vps[i].setAttribute('cy', p[1]); vps[i].setAttribute('r', 6 * px); vps[i].style.display = ''; });
    const n = cam3.r3, fo = cam3.f, s = half();
    if (Math.abs(n.y) > 1e-6) {
      const y = x => -(n.x * x + n.z * fo) / n.y, at = x => [x, y((x - photo.w / 2) / s) * s + photo.h / 2];
      hd = M(at(box[0]), at(box[2]));
      const T = at(Math.max(box[0], 0) + 12 * px);
      if (T[1] > box[1] + 16 * px && T[1] < box[3]) {
        horizonTag.style.display = '';
        horizonTag.setAttribute('x', T[0]); horizonTag.setAttribute('y', T[1] - 7 * px); horizonTag.setAttribute('font-size', 11 * px);
      }
    }
  }
  horizon.setAttribute('d', hd);
}

// ---------- entering and leaving: the viewer goes back exactly as it was
export function setSceneMode(on) {
  wanted = on;
  on = on && !!model && !!photo.img;
  if (on === active) return;
  if (on) {
    saved = { pose: getPose(), bg: view.bg, style: view.style, colors: view.colors };
    active = lock.on = true; ctr.enabled = false; drag = null;
    view.bg = 'none'; view.style = 'shaded'; view.colors = false; applyMaterials(); refreshLook();
    stage.classList.add('scene');
    zoom2d.k = 1; zoom2d.pan = [0, 0]; drawZoom();
    setRatio(photo.w / photo.h); update();
  } else {
    active = false; drag = null; loupe.hidden = true; space = false; stage.classList.remove('panning');
    stand.position.set(0, 0, 0); stand.rotation.set(0, 0, 0); stand.scale.setScalar(1); stand.updateMatrixWorld(true);
    Object.assign(view, { bg: saved.bg, style: saved.style, colors: saved.colors }); applyMaterials(); refreshLook();
    stage.classList.remove('scene');
    zoom2d.k = 1; zoom2d.pan = [0, 0];
    lock.on = false; ctr.enabled = true;
    setPose(saved.pose); // also brings back the focal length and the image format
  }
  photoEl.hidden = underEl.hidden = topEl.hidden = bar.hidden = !active; invalidate();
}

export async function loadPhoto(file) {
  const url = URL.createObjectURL(file), img = new Image();
  try { img.src = url; await img.decode(); if (!img.naturalWidth) throw new Error(); }
  catch (e) { URL.revokeObjectURL(url); $('scMsg').textContent = t('scBadPhoto'); return false; }
  if (photo.url) URL.revokeObjectURL(photo.url);
  const e2 = file.name.split('.').pop().toLowerCase();
  Object.assign(photo, { file, img, url, w: img.naturalWidth, h: img.naturalHeight, name: file.name, ext: IMAGES.includes(e2) ? e2 : 'jpg' });
  photoEl.src = url; $('scMsg').textContent = '';
  if (active) { fit(); setRatio(photo.w / photo.h); update(); } else setSceneMode(wanted);
  drawControls(); return true;
}

// ---------- panel
const focalRow = $('scFocal'), rotRow = $('scRot'), sizeRow = $('scSize');
$('scLoad').onclick = () => $('scFile').click();
$('scFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadPhoto(f); };
$('scShowGrid').onchange = e => { S.grid = e.target.checked; drawGrid(); };
$('scGridReset').onclick = () => { S.corners = DEF.map(c => [...c]); fit(); update(); };
focalRow.querySelector('input').oninput = e => { S.auto = false; S.mm = +e.target.value; update(); };
focalRow.querySelector('.auto').onclick = () => { S.auto = true; update(); };
rotRow.querySelector('input').oninput = e => { S.rot = +e.target.value; placeProduct(); drawControls(); };
rotRow.querySelector('.auto').onclick = () => { S.rot = null; placeProduct(); drawControls(); };
// size slider: steps of 2^(1/100), from 1/16 to 16 times
sizeRow.querySelector('input').oninput = e => setSize(2 ** (e.target.value / 100));
sizeRow.querySelector('.auto').onclick = () => setSize(1);
$('scCentre').onclick = () => { if (cam3) [S.u, S.v] = cam3.oFrac; placeProduct(); };
// Opacity: preview only (the exports are always at 100%, see viewer.js)
const opacityRow = $('scOpacity');
opacityRow.querySelector('input').oninput = e => { ghost.k = e.target.value / 100; drawControls(); invalidate(); };
opacityRow.querySelector('.auto').onclick = () => { ghost.k = 1; drawControls(); invalidate(); };
$('scExport').onclick = exportScene;

export function drawControls() {
  const has = !!photo.img;
  $('scLoad').textContent = t(has ? 'scLoadOther' : 'scLoad');
  $('scPhotoInfo').textContent = has ? `${photo.name} · ${photo.w} × ${photo.h} px` : t('scNoPhoto');
  document.querySelectorAll('#p-scene .needphoto').forEach(el => el.classList.toggle('off', !has));
  $('scShowGrid').checked = S.grid;
  const auto = S.auto && cam3 && cam3.autoMm, mm = cam3 ? cam3.mm : S.mm;
  focalRow.querySelector('input').value = Math.round(mm);
  focalRow.querySelector('.val').textContent = (S.auto ? (auto ? t('focusAuto') + ' · ' : t('scFocalNo')) : '') + Math.round(mm) + ' mm';
  focalRow.classList.toggle('isauto', !!S.auto);
  rotRow.querySelector('input').value = S.rot ?? 0;
  rotRow.querySelector('.val').textContent = Math.round(S.rot ?? 0) + '°';
  sizeRow.querySelector('input').value = Math.round(Math.log2(S.size) * 100);
  sizeRow.querySelector('.val').textContent = Math.round(S.size * 100) + '%';
  opacityRow.querySelector('input').value = Math.round(ghost.k * 100);
  opacityRow.querySelector('.val').textContent = Math.round(ghost.k * 100) + '%';
  horizonTag.textContent = t('scHorizon'); bar.querySelector('[data-z="0"]').textContent = t('scFit');
}

// ---------- export: everything at the photo's size, in one ZIP
const r5 = n => +n.toFixed(5);
function sceneData(W, H) {
  const fpx = cam3.f * half(); // in pixels of the photo
  return {
    viewer3d: 1,
    scene: {
      photo: { name: photo.name, width: photo.w, height: photo.h }, corners: S.corners.map(c => c.map(r5)),
      focal: { auto: S.auto, mm: r5(S.mm) }, product: { u: r5(S.u), v: r5(S.v), rotation: r5(S.rot), size: r5(S.size) }, file: hooks.file()
    },
    camera: { focal_mm: r5(cam3.mm), focal_auto: !!(S.auto && cam3.autoMm), fov_vertical_deg: r5(2 * Math.atan(photo.h / 2 / fpx) * 180 / Math.PI),
      matrix_world: cam.matrixWorld.toArray().map(r5), product_radius: r5(sphere.radius * S.size) },
    export: { width: W, height: H }
  };
}
async function exportScene() {
  if (!active || !cam3) return;
  const btn = $('scExport'), msg = $('scMsg'); btn.disabled = true; msg.textContent = t('scWorking');
  freeze.src = renderer.domElement.toDataURL(); await freeze.decode().catch(() => {});
  freeze.hidden = false; badge.textContent = t('scWorking'); badge.hidden = false; stage.classList.add('exporting');
  try {
    const { blob: grey, mask, bw, alpha, W, H } = await snapshot(Math.max(photo.w, photo.h), true);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(photo.img, 0, 0, W, H);
    const same = W === photo.w && H === photo.h;
    const photoBlob = same ? photo.file : await new Promise(r => c.toBlob(r, 'image/jpeg', .95));
    const gb = await createImageBitmap(grey); g.drawImage(gb, 0, 0, W, H); gb.close();
    const comp = await new Promise(r => c.toBlob(r, 'image/jpeg', .95));
    const base = `${hooks.base()}_SCENE`;
    const files = [
      { name: `${base}_photo.${same ? photo.ext : 'jpg'}`, blob: photoBlob },
      { name: `${base}_composite.jpg`, blob: comp },
      { name: `${base}_grey.png`, blob: grey },
      { name: `${base}_mask.png`, blob: mask },
      { name: `${base}_mask_bw.png`, blob: bw },
      { name: `${base}.json`, blob: new Blob([JSON.stringify(sceneData(W, H), null, 1)], { type: 'application/json' }) }
    ];
    if (alpha) files.splice(5, 0, { name: `${base}_mask_alpha.png`, blob: alpha });
    hooks.download(await zip(files), `${base}.zip`);
    msg.textContent = t('scDone').replace('{name}', `${base}.zip`).replace('{w}', W).replace('{h}', H) + (same ? '' : t('scSmaller'));
  } catch (e) { console.error(e); msg.textContent = String(e.message || e); }
  finally { btn.disabled = false; stage.classList.remove('exporting'); freeze.hidden = badge.hidden = true; freeze.removeAttribute('src'); }
}

// ---------- a scene JSON dropped on the window or imported: square, focal length and product back
const isPt = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const isPair = pair => Array.isArray(pair) && pair.length === 2 && pair.every(l => Array.isArray(l) && l.length === 2 && l.every(isPt));
// where two lines (each through two points) cross, or null
function meet([p, q], [r, s]) {
  const h = cross(cross([...p, 1], [...q, 1]), cross([...r, 1], [...s, 1]));
  return Math.abs(h[2]) > 1e-9 ? [h[0] / h[2], h[1] / h[2]] : null;
}
export function applySceneJson(d) {
  const sc = d && d.scene; if (!sc) return false;
  let C = Array.isArray(sc.corners) && sc.corners.length === 4 && sc.corners.every(isPt) ? sc.corners : null;
  const L = sc.lines;
  if (!C && L && isPair(L.a) && isPair(L.b)) { // v14 files: the red and blue lines give the square's sides
    C = [meet(L.a[0], L.b[0]), meet(L.a[0], L.b[1]), meet(L.a[1], L.b[1]), meet(L.a[1], L.b[0])];
    if (!C.every(Boolean)) C = null;
  }
  if (!C) return false;
  S.corners = C.map(c => [...c]);
  if (sc.focal) { S.auto = !!sc.focal.auto; if (Number.isFinite(sc.focal.mm)) S.mm = clamp(sc.focal.mm, 8, 400); }
  const p = sc.product || {};
  if (Number.isFinite(p.u) && Number.isFinite(p.v)) { S.u = p.u; S.v = p.v; } else S.u = S.v = null;
  if (Number.isFinite(p.rotation)) S.rot = wrap(p.rotation); if (Number.isFinite(p.size)) S.size = clamp(p.size, 1 / 16, 16);
  $('scMsg').textContent = t(photo.img ? 'scJsonDone' : 'scJsonNoPhoto');
  if (active) update(); else drawControls();
  return true;
}
