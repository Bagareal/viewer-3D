// Camera moves for AI video: each move is a list of keyframes around the product, exported as start / end frames.
// az: degrees around the vertical axis (0 = the Front quick view, 90 = right side, 180 = back)
// el: degrees above the aimed point (90 = straight down)
// d:  distance, 1 = the whole product fills the frame, like the quick views
// ty: height of the aimed point, 0 = base, .5 = middle, 1 = top; 'detail' = the last part clicked on the model
// tx: sideways shift of camera and aim, in product radii (positive = towards the right of the picture)
import { THREE, sphere, view, fitDist, setCamera } from './viewer.js';
import { model, picked } from './model.js';

export const MOVES = [
  { id: 'ORB-S', keys: [{ az: -30, el: 10 }, { az: 30, el: 10 }],
    prompt: 'The camera slowly orbits around the product from left to right, about 60 degrees, keeping the same distance and height.' },
  { id: 'ORB-34', keys: [{ az: 45, el: 12 }, { az: 0, el: 12 }],
    prompt: 'The camera orbits from a three-quarter view to the front view of the product, keeping the same distance and height.' },
  { id: 'ORB-180', keys: [{ az: 180, el: 12 }, { az: 90, el: 12 }, { az: 0, el: 12 }],
    prompt: 'The camera orbits 90 degrees around the product, moving towards its front, keeping the same distance and height.' },
  { id: 'PUSH', keys: [{ az: 20, el: 15 }, { az: 10, el: 12, d: .35, ty: 'detail' }],
    prompt: 'The camera slowly pushes in from the whole product to a close-up of the detail shown in the last frame.' },
  { id: 'PULL', keys: [{ az: 10, el: 12, d: .35, ty: 'detail' }, { az: 20, el: 15, d: 1.6 }],
    prompt: 'The camera slowly pulls back from a close-up of the detail to reveal the whole product in its setting.' },
  { id: 'CRANE', keys: [{ az: 15, el: 0, d: .6, ty: .15 }, { az: 15, el: 30, d: .6, ty: .85 }],
    prompt: 'The camera rises vertically along the product, from its base to its top, tilting slightly down as it climbs.' },
  { id: 'TOP', keys: [{ az: 0, el: 85 }, { az: 0, el: 35 }],
    prompt: 'The camera descends in an arc from a top-down view to a three-quarter high-angle view of the product.' },
  { id: 'TRUCK', keys: [{ az: 0, el: 15, d: .6, tx: -.6 }, { az: 0, el: 15, d: .6, tx: .6 }],
    prompt: 'The camera slides sideways along the product, parallel to it, at constant distance (lateral tracking shot).' },
  { id: 'HERO', keys: [{ az: 25, el: -5, d: 1.2 }, { az: 15, el: 8, d: .95 }],
    prompt: 'Low-angle hero shot: the camera slowly moves closer from slightly below the product and rises gently.' },
  { id: 'ARC', keys: [{ az: 60, el: 35, d: 1.1 }, { az: 20, el: 22 }, { az: -20, el: 10 }],
    prompt: 'The camera arcs around the product while descending from a high angle towards the height of the product.' },
];
const COMMON = 'The product and the room stay completely still: only the camera moves. Smooth, continuous camera movement with no cuts. The product stays exactly the same: same shape, proportions, colours and details.';

// Camera position in plain words, so the video model knows where the camera starts and ends.
const SIDES = [[0, 'the front'], [45, 'the front-right three-quarter view'], [90, 'the right side'], [135, 'the back-right three-quarter view'],
  [180, 'the back'], [-135, 'the back-left three-quarter view'], [-90, 'the left side'], [-45, 'the front-left three-quarter view']];
const norm = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
function words(key) {
  const k = K(key), az = norm(k.az);
  const side = SIDES.map(([a, w]) => [w, Math.abs(norm(az - a))]).sort((a, b) => a[1] - b[1])[0][0];
  const height = k.el >= 60 ? 'from directly above' : k.el >= 25 ? 'from a high angle' : k.el <= -3 ? 'from slightly below' : 'at product height';
  const dist = k.ty === 'detail' ? ', close-up on the detail' : k.d <= .5 ? ', close-up' : k.d >= 1.4 ? ', wide shot' : '';
  return k.el >= 60 ? height + dist : `${side}, ${height}${dist}`;
}

const K = k => ({ az: 0, el: 10, d: 1, ty: .5, tx: 0, ...k });
const box = new THREE.Box3();
const refresh = () => { if (model) box.setFromObject(model); };

// The aimed point before the sideways shift.
function aim(k) {
  if (k.ty === 'detail' && picked) return new THREE.Box3().setFromObject(picked).getCenter(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3()), ty = k.ty === 'detail' ? .5 : k.ty;
  c.y = box.min.y + ty * (box.max.y - box.min.y); return c;
}
// Catmull-Rom: smooth curve through p1 (f = 0) and p2 (f = 1), shaped by the keyframes before and after.
const cr = (p0, p1, p2, p3, f) => .5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
// Keyframes joined by a smooth curve at s (0 = first keyframe, keys.length - 1 = last). It passes exactly
// through every keyframe, without the sudden change of direction and speed at the middle ones that a
// straight line between keyframes gives. With two keyframes it is the same straight path as before.
function at(keys, s) {
  const P = keys.map(k => { const c = K(k), t = aim(c); return [c.az, c.el, c.d, c.tx, t.x, t.y, t.z]; });
  const n = P.length - 1, i = Math.min(Math.floor(s), n - 1), f = s - i;
  const mirror = (a, b) => a.map((v, j) => 2 * v - b[j]); // imaginary keyframe beyond each end
  const p0 = P[i - 1] || mirror(P[i], P[i + 1]), p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || mirror(P[i + 1], P[i]);
  const v = p1.map((_, j) => cr(p0[j], p1[j], p2[j], p3[j], f));
  return { az: v[0], el: v[1], d: v[2], tx: v[3], target: new THREE.Vector3(v[4], v[5], v[6]) };
}
function apply({ az, el, d, tx, target }) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  const dir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
  const right = new THREE.Vector3(dir.z, 0, -dir.x); // right of the picture
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  target.addScaledVector(right.normalize(), tx * sphere.radius);
  setCamera(target.clone().addScaledVector(dir, d * fitDist()), target);
}

export function goToKey(move, i) { refresh(); apply(at(move.keys, i)); }

// Same easing as the preview: slow start and end.
const ease = p => p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
// Camera at progress p (0..1) of the whole move.
export function moveAt(move, p) {
  if (p === 0) refresh();
  apply(at(move.keys, ease(p) * (move.keys.length - 1)));
}

let raf = 0;
export const playing = () => raf !== 0;
export function stop() { cancelAnimationFrame(raf); raf = 0; }
// Preview of the whole move in the viewer, about 2 s per clip.
export function play(move, done) {
  stop(); refresh();
  const n = move.keys.length - 1, T = 2200 * n, t0 = performance.now();
  const step = now => {
    const p = Math.min((now - t0) / T, 1);
    apply(at(move.keys, ease(p) * n));
    if (p < 1) raf = requestAnimationFrame(step); else { raf = 0; done?.(); }
  };
  raf = requestAnimationFrame(step);
}

// Text file exported with the frames: one first frame -> last frame clip per pair of keyframes, prompts in English.
export function seedanceText(move, names, product, video) {
  const clips = names.slice(1).map((n, i) => `Clip ${i + 1}\n  First frame: ${names[i]}\n  Last frame:  ${n}\n  Prompt: ${move.prompt} The camera starts at ${words(move.keys[i])}, and ends at ${words(move.keys[i + 1])}. ${COMMON}`);
  const head = [`Camera move: ${move.id}`, `Product: ${product}`, `Focal length in the viewer: ${view.focal} mm`, `Frames: ${names.join(', ')}`];
  if (video) head.push(`Reference video of the camera move: ${video.name} (${video.W} x ${video.H}, ${video.fps} fps, ${video.seconds} s)`);
  return head.join('\n') + '\n\n' + clips.join('\n\n') + '\n';
}
