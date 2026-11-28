// Wires the interface to the viewer.
import { THREE, view, renderer, ctr, cam, sphere, place, resize, setFocal, setRatio, getPose, setPose, refreshLook, snapshot, invalidate, afterDraw, setCamera } from './viewer.js';
import { model, picked, setModel, applyMaterials, showAll, expandAll, filterParts, applyExplode, setExplodeMode, turn90, setFrontFromView, resetOrientation, spin, resetSpin, pick, pointAt, relabelParts, setPartOpacity, resetOpacity } from './model.js';
import { loadFile, extOf, isCad, STEP_LIMIT } from './loaders.js';
import { LANGS, t, getLang, setLang } from './i18n.js';
import { relabelCube } from './gizmo.js';
import { MOVES, goToKey, play, playing, stop, aimedPoints, keyFromCamera, toCustom, validMove } from './moves.js';
import { VIDEO_SIZES, recordMove, videoSupported } from './video.js';
import { zip } from './zip.js';
import { serverInfo, convertOnServer, explain, savedPass, savePass } from './remote.js';
import { IMAGES, sceneActive, setSceneMode, loadPhoto, applySceneJson, bindScene, drawControls } from './scene.js';

const $ = id => document.getElementById(id), side = $('side');
let fileName = '', expanded = false, longSide = 3000, axis = 'free', videoSide = 1920;

// ---------- small helpers
// A row of buttons where exactly one is on. items: [{v, key}] (translated) or [{v, label}] (fixed text).
function seg(id, items, current, onPick) {
  const el = $(id);
  items.forEach((it, i) => {
    const b = document.createElement('button');
    if (it.key) b.dataset.t = it.key; else if (it.preset != null) b.dataset.preset = it.preset; else b.textContent = it.label;
    b.classList.toggle('on', it.v === current || i === current);
    b.onclick = () => { mark(el, b); onPick(it.v); };
    b.value = JSON.stringify(it.v); el.append(b);
  });
}
const mark = (el, b) => [...el.children].forEach(c => c.classList.toggle('on', c === b));
const markValue = (id, v) => { const el = $(id); mark(el, [...el.children].find(c => c.value === JSON.stringify(v))); };
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const baseName = () => (fileName || t('view')).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

// ---------- overlays on the stage: drop zone, progress, error
function overlay(id, text) {
  ['drop', 'busy', 'fail'].forEach(k => $(k).hidden = k !== (id || (model ? '' : 'drop')));
  if (id === 'busy') $('busyText').textContent = text;
  if (id === 'fail') { $('failText').textContent = text; $('failClose').hidden = !model; }
  $('nav').hidden = !model || !!id;
}
$('failClose').onclick = () => overlay();
function confirmBig(file) {
  return new Promise(res => {
    $('bigText').textContent = t('bigSize').replace('{mb}', Math.round(file.size / 1048576)); $('big').hidden = false;
    $('bigGo').onclick = () => { $('big').hidden = true; res(true); };
    $('bigNo').onclick = () => { $('big').hidden = true; res(false); };
  });
}

// ---------- opening files
// Big STEP: if a conversion server answers, offer to convert there. Returns 'server', 'browser' or 'cancel'.
function askServer(file, info) {
  return new Promise(res => {
    const tooBig = file.size > info.max_bytes;
    $('srvText').textContent = tooBig ? t('srvTooLarge').replace('{mb}', Math.round(info.max_bytes / 1048576))
      : t('bigSize').replace('{mb}', Math.round(file.size / 1048576)) + ' ' + t('srvAsk');
    $('srvPassRow').hidden = !info.auth_required; $('srvPass').value = savedPass(); $('srvGo').hidden = tooBig;
    $('srvErr').textContent = ''; $('srv').hidden = false;
    const done = v => { $('srv').hidden = true; res(v); };
    $('srvGo').onclick = () => { if (info.auth_required && !$('srvPass').value) { $('srvErr').textContent = t('srvNeedPass'); return; } savePass($('srvPass').value); done('server'); };
    $('srvBrowser').onclick = () => done('browser');
    $('srvNo').onclick = () => done('cancel');
  });
}
async function openFile(file) {
  const ext = extOf(file.name);
  if (isCad(ext) && file.size > STEP_LIMIT) {
    const info = await serverInfo();
    if (info) {
      const choice = await askServer(file, info);
      if (choice === 'cancel') return;
      if (choice === 'server') {
        const ctl = new AbortController();
        overlay('busy', t('srvSend')); $('busyCancel').hidden = false; $('busyCancel').onclick = () => ctl.abort();
        try {
          const glb = await convertOnServer(file, savedPass(), s => overlay('busy', s), ctl.signal);
          $('busyCancel').hidden = true;
          return openFile(glb);
        } catch (e) {
          $('busyCancel').hidden = true;
          if (e.name === 'AbortError') { overlay(); return; }
          overlay('fail', explain(e)); return;
        }
      }
    } else if (!(await confirmBig(file))) return;
  }
  overlay('busy', t('opening') + file.name + '…');
  await new Promise(r => setTimeout(r, 60)); // lets the message paint before heavy work
  const inScene = panel === 'scene'; if (inScene) setSceneMode(false);
  try {
    const { obj, tree, groups } = await loadFile(file, s => overlay('busy', s));
    setModel(obj, tree, groups, file.name);
    fileName = file.name; side.classList.remove('nomodel'); expanded = false;
    labels(); overlay();
    if (panel === 'file') showPanel('model'); // next step once the file is open
  } catch (err) {
    const m = String(err.message || err), oom = /memory|allocation|abort/i.test(m) || (isCad(ext) && file.size > STEP_LIMIT);
    const text = oom ? t('oom') : m;
    overlay('fail', text.charAt(0).toUpperCase() + text.slice(1));
  } finally { if (inScene) setSceneMode(true); }
}
document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => $('file').click());
$('file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; $('veil').hidden = false; } });
addEventListener('dragleave', e => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('veil').hidden = true; } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; $('veil').hidden = true;
  if (e.dataTransfer.types.includes('text/x-frame')) return; // a keyframe moved inside the panel
  const f = e.dataTransfer.files[0]; if (!f) return;
  const ext = extOf(f.name);
  if (ext === 'json') importJson(f);
  else if (IMAGES.includes(ext)) { if (!model) { overlay('fail', t('scNeedModel')); return; } showPanel('scene'); loadPhoto(f); }
  else openFile(f);
});

// ---------- framing
const presets = [[0, .12, 1], [-.8, .35, 1], [.8, .35, 1], [1, .1, 0], [.3, 1.4, .8], [.5, -.05, 1], [0, .15, -1]];
seg('presets', presets.map((v, i) => ({ v, preset: i })), 1, v => place(v));
seg('focals', [24, 35, 50, 85, 105].map(v => ({ v, label: v + ' mm' })), view.focal, v => { setFocal(v); queueThumbs(); });
const ratios = [['ratioFree', 0], ['1:1', 1], ['4:5', 4 / 5], ['3:2', 3 / 2], ['16:9', 16 / 9], ['9:16', 9 / 16]];
seg('ratios', ratios.map(([l, v]) => v ? { v, label: l } : { v, key: l }), view.ratio, v => { setRatio(v); queueThumbs(); });
const clearPreset = () => mark($('presets'), null);
renderer.domElement.addEventListener('pointerdown', clearPreset); renderer.domElement.addEventListener('wheel', clearPreset, { passive: true });

// ---------- saved views (kept in this browser; export / import to share)
const VKEY = 'viewer3d.views';
let views = []; try { views = JSON.parse(localStorage.getItem(VKEY)) || []; } catch (e) {}
const validView = v => v && typeof v.name === 'string' && [v.pos, v.target].every(a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite));
views = views.filter(validView);
function storeViews() { try { localStorage.setItem(VKEY, JSON.stringify(views)); } catch (e) {} drawViews(); }
function drawViews() {
  const box = $('views'); box.innerHTML = ''; box.dataset.empty = t('viewNone');
  views.forEach((v, i) => {
    const row = document.createElement('div'); row.className = 'viewrow';
    const go = document.createElement('button'); go.className = 'go'; go.textContent = v.name; go.title = v.name;
    go.onclick = () => { setPose(v); markValue('focals', view.focal); markValue('ratios', view.ratio); clearPreset(); };
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = del.ariaLabel = t('viewDel');
    del.onclick = () => { views.splice(i, 1); storeViews(); };
    row.append(go, del); box.append(row);
  });
  $('viewExport').hidden = !views.length;
}
$('viewSave').onclick = () => {
  if (!model) return;
  let name = $('viewName').value.trim();
  if (!name) { let n = views.length + 1; while (views.some(v => v.name === `${t('viewAuto')} ${n}`)) n++; name = `${t('viewAuto')} ${n}`; }
  views = views.filter(v => v.name !== name); views.push({ name, ...getPose() }); $('viewName').value = ''; storeViews();
};
$('viewName').onkeydown = e => { if (e.key === 'Enter') $('viewSave').click(); };
$('viewExport').onclick = () => download(new Blob([JSON.stringify({ viewer3d: 1, views }, null, 1)], { type: 'application/json' }), 'viewer3d_views.json');
$('viewImport').onclick = () => $('viewFile').click();
$('viewFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importViews(f); };
async function readJson(file) { try { return JSON.parse(await file.text()); } catch (e) { return null; } }
async function importViews(file) { addViews(await readJson(file)); }
function addViews(d, quiet) {
  const list = (d ? Array.isArray(d) ? d : d.views || [] : []).filter(validView);
  $('viewMsg').textContent = list.length || quiet ? '' : t('viewBad');
  if (!list.length) return false;
  list.forEach(v => { views = views.filter(o => o.name !== v.name); views.push({ name: v.name.slice(0, 40), pos: v.pos, target: v.target, focal: +v.focal || 50, ratio: +v.ratio || 0 }); });
  storeViews(); return true;
}
// A file dropped on the window: saved views and / or moves.
async function importJson(file) {
  const d = await readJson(file);
  if (applySceneJson(d)) { if (model) showPanel('scene'); return; }
  if (!addViews(d, true) && !addMoves(d)) $('viewMsg').textContent = t('viewBad');
}

// ---------- product position
document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => turn90(b.dataset.r));
$('setFront').onclick = setFrontFromView;
$('orientReset').onclick = resetOrientation;
seg('axes', [{ v: 'free', key: 'dragOrbit' }, { v: 'x', label: 'X' }, { v: 'y', label: 'Y' }, { v: 'z', label: 'Z' }], 'free', v => { axis = v; ctr.enableRotate = v === 'free'; });
$('rotReset').onclick = resetSpin;
const cv = renderer.domElement; let down = null, drag = null;
cv.addEventListener('pointerdown', e => {
  if (sceneActive()) { down = drag = null; return; } // the product is moved by scene.js
  down = { x: e.clientX, y: e.clientY, b: e.button };
  if (axis !== 'free' && e.button === 0 && model) { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); }
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
  spin(axis, (axis === 'x' ? dy : dx) * .01);
});
cv.addEventListener('pointerup', e => {
  drag = null;
  if (sceneActive()) { down = null; return; }
  if (picking && down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
    const p = pointAt(e.clientX, e.clientY); if (p) usePoint(p); down = null; return;
  }
  if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && pick(e.clientX, e.clientY)) { if (panel === 'help') showPanel('model'); drawMove(); }
  down = null;
});
cv.addEventListener('pointercancel', () => { drag = down = null; });

// ---------- parts
$('showAll').onclick = showAll;
$('expand').onclick = () => { expanded = !expanded; expandAll(expanded); labels(); };
$('partFilter').oninput = e => filterParts(e.target.value);
$('exp').oninput = applyExplode;
$('op').oninput = e => setPartOpacity(e.target.value / 100);
$('opReset').onclick = resetOpacity;
seg('expModes', [{ v: 'all', key: 'expAll' }, { v: 'sel', key: 'expSel' }], 'all', setExplodeMode);

// ---------- look
function lookChanged() {
  queueThumbs();
  $('colorField').classList.toggle('off', view.style !== 'shaded');
  $('bgField').classList.toggle('off', view.style === 'depth');
  [...$('bgs').children].forEach(b => b.classList.toggle('off', view.style === 'lines' && b.value === '"grey"'));
  $('floorLabel').classList.toggle('off', view.style !== 'shaded' || view.bg === 'none');
  refreshLook();
}
seg('styles', [{ v: 'shaded', key: 'stShaded' }, { v: 'depth', key: 'stDepth' }, { v: 'lines', key: 'stLines' }], view.style, v => { view.style = v; lookChanged(); });
seg('colors', [{ v: false, key: 'colGrey' }, { v: true, key: 'colOrig' }], view.colors, v => { view.colors = v; applyMaterials(); lookChanged(); });
seg('bgs', [{ v: 'grey', key: 'bgGrey' }, { v: 'white', key: 'bgWhite' }, { v: 'none', key: 'bgNone' }], view.bg, v => { view.bg = v; lookChanged(); });
$('floor').onchange = e => { view.floor = e.target.checked; lookChanged(); };

// ---------- camera moves for AI video: keyframes exported as first / last frames, with their masks
// move: a ready-made move from MOVES, or a move made by hand ({ custom, name, keys, from }) being edited:
// a copy, saved to "My moves" with Save. sel: the keyframe shown last (edited by Update / Delete).
const exportButtons = ['expFrames', 'expVideo', 'expEvery'];
let move = MOVES[0], sel = -1, picking = '';
seg('moves', MOVES.map((m, i) => ({ v: i, key: 'mv_' + m.id })), 0, i => { setMove(MOVES[i]); playMove(); });
const moveId = m => m.custom ? (m.name || 'custom').replace(/[^\w-]+/g, '_') : m.id;
const lastKey = () => move.keys.length - 1;
function setMove(m) {
  stopMove(); stopPicking(); sel = -1;
  const custom = !MOVES.includes(m);
  move = custom ? { custom, name: m.name, from: m.name, keys: m.keys.map(k => ({ ...k, t: [...k.t] })) } : m;
  if (custom) mark($('moves'), null);
  $('mvName').value = move.custom ? move.name : '';
  drawMove(); drawMine(); invalidate();
}
function drawMove() {
  const n = move.keys.length, box = $('frames'); box.innerHTML = '';
  move.keys.forEach((k, i) => {
    const b = document.createElement('button'), im = document.createElement('img'), l = document.createElement('span');
    b.className = 'frame'; b.onclick = () => toKey(i); b.classList.toggle('on', i === sel);
    b.draggable = true; // drag a frame onto another to move it
    b.ondragstart = e => { e.dataTransfer.setData('text/x-frame', String(i)); e.dataTransfer.effectAllowed = 'move'; };
    b.ondragover = e => { if (e.dataTransfer.types.includes('text/x-frame')) { e.preventDefault(); b.classList.add('over'); } };
    b.ondragleave = () => b.classList.remove('over');
    b.ondrop = e => {
      b.classList.remove('over');
      const from = +e.dataTransfer.getData('text/x-frame'); if (!Number.isInteger(from) || from === i) return;
      e.preventDefault(); e.stopPropagation();
      editKeys(() => { const [k] = move.keys.splice(from, 1); move.keys.splice(i, 0, k); sel = i; }, () => [0, lastKey()]);
    };
    if (thumbs[i]) im.src = thumbs[i]; im.alt = ''; im.draggable = false;
    l.textContent = i === 0 ? t('focusStart') : i === n - 1 ? t('focusEnd') : i + 1;
    b.append(im, l); box.append(b);
  });
  $('moveDesc').textContent = t(move.custom ? 'mvd_custom' : 'mvd_' + move.id);
  $('moveInfo').textContent = n < 2 ? t('keyFew') : t('moveInfo').replace('{n}', n).replace('{c}', n - 1);
  $('moveDetail').hidden = move.custom || !move.keys.some(k => k.ty === 'detail');
  $('moveDetail').textContent = t('moveDetail') + (picked ? picked.name || t('movePart') : t('moveCentre'));
  $('saveRow').hidden = !move.custom;
  markFrame();
  ['movePlay', ...exportButtons].forEach(id => $(id).disabled = n < 2);
  queueThumbs(); invalidate();
}
// Small pictures of the keyframes: the camera goes to each one, takes a snapshot and comes back.
let thumbs = [], thumbTimer = 0, thumbBusy = false, thumbAgain = false, thumbSig = '';
// What the pictures depend on: when none of it changed they are not drawn again.
const thumbKey = () => JSON.stringify([model && model.uuid, move.keys, move.keys.some(k => k.ty === 'detail') ? picked?.uuid || '' : '', view.focal, view.ratio, view.style, view.colors, view.bg, view.floor]);
// While they are drawn the canvas is covered by a still picture of the view, so nothing flickers.
const thumbFreeze = Object.assign(document.createElement('img'), { id: 'thumbFreeze', alt: '', hidden: true });
$('stage').append(thumbFreeze);
function queueThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(makeThumbs, 250); }
async function makeThumbs() {
  if (panel !== 'video' || !model) return;
  if (thumbBusy) { thumbAgain = true; return; }
  if (playing() || picking) { queueThumbs(); return; }
  const key = thumbKey(), m = move, keys = m.keys.length;
  if (key === thumbSig && thumbs.length === keys) return;
  thumbBusy = true;
  const pos = cam.position.clone(), tg = ctr.target.clone(), urls = [];
  try {
    thumbFreeze.src = renderer.domElement.toDataURL('image/png'); await thumbFreeze.decode();
    thumbFreeze.hidden = false; $('stage').classList.add('thumbing');
    for (let i = 0; i < keys; i++) {
      if (playing() || m !== move || keys !== move.keys.length) break;
      goToKey(m, i);
      const { blob } = await snapshot(220);
      urls.push(URL.createObjectURL(blob));
    }
  } finally {
    if (!playing()) setCamera(pos, tg);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    $('stage').classList.remove('thumbing'); thumbFreeze.hidden = true; thumbBusy = false;
  }
  if (urls.length === keys && m === move && keys === move.keys.length) {
    thumbs.forEach(u => URL.revokeObjectURL(u)); thumbs = urls; thumbSig = key;
    [...$('frames').querySelectorAll('.frame')].forEach((b, i) => { if (thumbs[i]) b.firstChild.src = thumbs[i]; });
  } else urls.forEach(u => URL.revokeObjectURL(u));
  if (thumbAgain) { thumbAgain = false; queueThumbs(); }
}
const markFrame = () => { [...$('frames').querySelectorAll('.frame')].forEach((b, i) => b.classList.toggle('on', i === sel)); ['keyUpdate', 'keyDel'].forEach(id => $(id).disabled = sel < 0 || (id === 'keyDel' && move.keys.length <= 2)); };
function toKey(i) { stopMove(); clearPreset(); sel = i; markFrame(); if (model) goToKey(move, i); }
function stopMove() { stop(); $('movePlay').textContent = t('movePlay'); queueThumbs(); invalidate(); }
// Plays the clips from keyframe a to keyframe b (the whole move by default); each frame flashes as the camera reaches it.
function playRange(a = 0, b = lastKey()) {
  if (!model || move.keys.length < 2) return;
  stopMove(); clearPreset(); $('movePlay').textContent = t('moveStop');
  let reached = a;
  play(move, stopMove, a, b, pos => { const k = Math.floor(pos + 1e-4); if (k > reached) { reached = k; flashFrame(k); } });
}
function flashFrame(k) { const f = $('frames').querySelectorAll('.frame')[k]; if (!f) return; f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); }
function playMove() { stopPicking(); sel = -1; drawMove(); playRange(); }

// Click on the model: the next click picks a point of the surface instead of a part.
function startPicking(kind) {
  if (!model) return;
  const again = picking === kind; stopPicking(); if (again) return;
  stopMove(); picking = kind; $('stage').classList.add('picking');
  $('aimPick').classList.add('on');
}
function stopPicking() { picking = ''; $('stage').classList.remove('picking'); document.querySelectorAll('button.pick.on').forEach(b => b.classList.remove('on')); }
function usePoint(p) {
  const kind = picking; stopPicking();
  setCamera(cam.position.clone(), p); clearPreset(); // the camera turns towards the point
}
addEventListener('keydown', e => { if (e.key === 'Escape' && picking) stopPicking(); });

// Moves made by hand: keyframes taken from the camera as it is in the viewer.
const unwrap = keys => keys.forEach((k, i) => { if (i) k.az += Math.round((keys[i - 1].az - k.az) / 360) * 360; });
// A ready-made move becomes a move of your own as soon as one of its frames is changed.
function ensureCustom() {
  if (move.custom) return;
  const name = t('mv_' + move.id), keys = toCustom(move), s = sel;
  setMove({ name: '', keys }); $('mvName').value = name; sel = s;
}
// After an edit the clips around the changed frame are played, to see what changed.
const around = i => [Math.max(0, i - 1), Math.min(lastKey(), i + 1)];
function editKeys(change, range = () => around(sel)) {
  if (!model) return; stopMove(); stopPicking(); ensureCustom(); change(); unwrap(move.keys);
  drawMove(); playRange(...range());
}
$('mvNew').onclick = () => setMove({ name: '', keys: [] });
$('keyAdd').onclick = () => editKeys(() => {
  const i = sel >= 0 ? sel + 1 : move.keys.length;
  move.keys.splice(i, 0, keyFromCamera(move.keys[i - 1])); sel = i;
});
$('keyUpdate').onclick = () => editKeys(() => { if (sel >= 0) move.keys[sel] = keyFromCamera(move.keys[sel - 1]); });
$('keyDel').onclick = () => editKeys(() => { if (sel < 0 || move.keys.length <= 2) return; move.keys.splice(sel, 1); sel = Math.min(sel, lastKey()); });
$('aimPick').onclick = () => startPicking('aim');

// "My moves", kept in this browser like the saved views; export / import to share.
const MKEY = 'viewer3d.moves';
let mine = []; try { mine = JSON.parse(localStorage.getItem(MKEY)) || []; } catch (e) {}
mine = mine.filter(validMove);
function storeMine() { try { localStorage.setItem(MKEY, JSON.stringify(mine)); } catch (e) {} drawMine(); }
function drawMine() {
  const box = $('myMoves'); box.innerHTML = ''; box.dataset.empty = t('mvNone');
  mine.forEach((m, i) => {
    const row = document.createElement('div'); row.className = 'viewrow';
    const go = document.createElement('button'); go.className = 'go'; go.textContent = go.title = m.name;
    go.classList.toggle('on', move.custom && move.from === m.name);
    go.onclick = () => { setMove(m); playMove(); };
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕'; del.title = del.ariaLabel = t('viewDel');
    del.onclick = () => { mine.splice(i, 1); if (move.from === m.name) move.from = null; storeMine(); };
    row.append(go, del); box.append(row);
  });
  $('mvExport').hidden = !mine.length;
}
$('mvSave').onclick = () => {
  if (!move.custom) return;
  if (move.keys.length < 2) { $('mvMsg').textContent = t('keyFew'); return; }
  let name = $('mvName').value.trim();
  if (!name) { let n = mine.length + 1; while (mine.some(m => m.name === `${t('mvAuto')} ${n}`)) n++; name = `${t('mvAuto')} ${n}`; }
  move.name = move.from = name; $('mvName').value = name; $('mvMsg').textContent = '';
  mine = mine.filter(m => m.name !== name); mine.push({ name, keys: move.keys.map(k => ({ ...k, t: [...k.t] })) }); storeMine();
};
$('mvName').onkeydown = e => { if (e.key === 'Enter') $('mvSave').click(); };
$('mvExport').onclick = () => download(new Blob([JSON.stringify({ viewer3d: 1, moves: mine }, null, 1)], { type: 'application/json' }), 'viewer3d_moves.json');
$('mvImport').onclick = () => $('mvFile').click();
$('mvFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) addMoves(await readJson(f)); };
// Adds the moves found in an exported file; true when there were some.
function addMoves(d) {
  const list = (d && (Array.isArray(d.moves) ? d.moves : [])).filter(validMove);
  $('mvMsg').textContent = list.length ? '' : t('mvBad');
  list.forEach(m => { const name = m.name.trim().slice(0, 40); mine = mine.filter(o => o.name !== name); mine.push({ name, keys: m.keys.map(({ az, el, d, t }) => ({ az, el, d, t })) }); });
  if (list.length) storeMine();
  return list.length > 0;
}

// Markers on the stage: where the camera aims at each keyframe (never in the exported images).
function drawMarks() {
  const box = $('marks'), show = model && panel === 'video' && !playing() && move.keys.length;
  box.hidden = !show; if (!show) return;
  const W = $('stage').clientWidth, H = $('stage').clientHeight, pts = aimedPoints(move);
  while (box.children.length > pts.length) box.lastChild.remove();
  while (box.children.length < pts.length) box.append(document.createElement('b'));
  pts.forEach((p, i) => {
    const b = box.children[i], v = p.project(cam);
    b.hidden = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
    b.textContent = i + 1; b.className = i === 0 ? 'first' : i === pts.length - 1 ? 'last' : '';
    b.style.left = (v.x + 1) / 2 * W + 'px'; b.style.top = (1 - v.y) / 2 * H + 'px';
  });
}
afterDraw.push(drawMarks);
$('movePlay').onclick = () => { if (playing()) stopMove(); else playMove(); };
renderer.domElement.addEventListener('pointerdown', () => { if (playing()) stopMove(); });
renderer.domElement.addEventListener('wheel', () => { if (playing()) stopMove(); }, { passive: true });
// Three buttons: the keyframes (with their masks), the reference video alone, or everything; always in one .zip.
seg('videoSizes', VIDEO_SIZES, videoSide, v => { videoSide = v; });
async function exportMove(wantFrames, wantVideo) {
  if (!model || move.keys.length < 2) return;
  stopMove(); exportButtons.forEach(id => $(id).disabled = true);
  try {
    const names = [], files = [], base = `${baseName()}_${moveId(move)}`;
    if (wantFrames) for (let i = 0; i < move.keys.length; i++) {
      toKey(i);
      const { blob, mask, bw, alpha } = await snapshot(longSide, true);
      const stem = `${base}_${i + 1}`, name = `${stem}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
      files.push({ name, blob }, { name: `${stem}_mask.png`, blob: mask }, { name: `${stem}_mask_bw.png`, blob: bw }); names.push(name);
      if (alpha) files.push({ name: `${stem}_mask_alpha.png`, blob: alpha });
    }
    let video = null;
    if (wantVideo && videoSupported()) {
      const msg = p => { $('moveMsg').textContent = t('moveVideo').replace('{p}', Math.round(p * 100)); };
      msg(0);
      try {
        const r = await recordMove(move, videoSide, msg);
        if (r) { video = { ...r, name: `${base}_video.mp4` }; files.push({ name: video.name, blob: r.blob }); }
      } catch (e) { console.error(e); }
    }
    let archive = '';
    if (files.length) { archive = `${base}_${wantFrames ? wantVideo ? 'all' : 'frames' : 'video'}.zip`; download(await zip(files), archive); }
    const key = !wantFrames ? (video ? 'xVideoDone' : 'xNoVideo') : !wantVideo ? 'xFramesDone' : video ? 'moveDone' : 'moveNoVideo';
    $('moveMsg').textContent = t(key).replace('{n}', names.length) + (archive ? ` (${archive})` : '');
  } finally { exportButtons.forEach(id => $(id).disabled = false); sel = -1; drawMove(); }
}
$('expFrames').onclick = () => exportMove(true, false);
$('expVideo').onclick = () => exportMove(false, true);
$('expEvery').onclick = () => exportMove(true, true);

// ---------- saving the image
seg('sizes', [2000, 3000, 4000].map(v => ({ v, label: v + ' px' })), longSide, v => { longSide = v; });
$('save').onclick = async () => {
  if (!model) return;
  $('save').disabled = true;
  try {
    const { blob, mask, bw, alpha, W, H } = await snapshot(longSide, true);
    const tag = { shaded: 'POV', depth: 'depth', lines: 'lines' }[view.style], stem = `${baseName()}_${tag}`;
    const files = [{ name: `${stem}.${blob.type === 'image/png' ? 'png' : 'jpg'}`, blob }, { name: `${stem}_mask.png`, blob: mask }, { name: `${stem}_mask_bw.png`, blob: bw }];
    if (alpha) files.push({ name: `${stem}_mask_alpha.png`, blob: alpha });
    download(await zip(files), `${stem}.zip`);
    $('savemsg').textContent = `${t('savedMsg')}${stem}.zip (${W} × ${H} px)`;
  } finally { $('save').disabled = false; }
};

// ---------- tabs: Model (look, position, parts) and Create (image, video, in a photo); help on the side
let panel = 'file'; // 'file' (no model yet), 'model', 'photo' | 'video' | 'scene' (the Create modes) or 'help'
let mode = 'photo'; // the Create mode last used
const TAB = { file: '', model: 'model', photo: 'create', video: 'create', scene: 'create', help: 'help' };
const tabButtons = [...document.querySelectorAll('[data-tab]')], modeButtons = [...document.querySelectorAll('#modes button')];
function showPanel(id) {
  if (id === 'create') id = mode;
  if (['photo', 'video', 'scene'].includes(id)) mode = id;
  panel = id; setSceneMode(id === 'scene');
  const shown = id === 'model' ? ['look', 'product', 'parts'] : [id];
  document.querySelectorAll('#scroll .pane').forEach(p => p.hidden = !shown.includes(p.id.slice(2)));
  if (id === 'photo' || id === 'video') $('p-' + id).prepend($('framing')); // the framing block is shared by both modes
  tabButtons.forEach(b => b.classList.toggle('on', b.dataset.tab === TAB[id]));
  modeButtons.forEach(b => b.classList.toggle('on', b.dataset.mode === id));
  $('modes').hidden = TAB[id] !== 'create';
  side.dataset.tab = TAB[id]; side.dataset.mode = id; if (id === 'video') queueThumbs(); $('scroll').scrollTop = 0;
  invalidate();
}
tabButtons.forEach(b => b.onclick = () => showPanel(b.dataset.tab === 'help' && panel === 'help' ? (model ? 'model' : 'file') : b.dataset.tab));
modeButtons.forEach(b => b.onclick = () => showPanel(b.dataset.mode));
Object.entries(LANGS).forEach(([k, n]) => $('lang').add(new Option(n, k)));
$('lang').onchange = e => { setLang(e.target.value); labels(); };
function labels() {
  document.documentElement.lang = getLang(); $('lang').value = getLang();
  document.querySelectorAll('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
  document.querySelectorAll('[data-tp]').forEach(e => e.placeholder = t(e.dataset.tp));
  document.querySelectorAll('[data-preset]').forEach(b => b.textContent = t('presets')[b.dataset.preset]);
  $('name').textContent = fileName || t('noModel');
  $('load').textContent = t(model ? 'loadOther' : 'load');
  $('expand').textContent = t(expanded ? 'collapse' : 'expand');
  $('parts').dataset.empty = t('partsEmpty');
  $('help').innerHTML = t('help');
  $('savemsg').textContent = t('saveHint'); $('viewMsg').textContent = '';
  $('moveMsg').textContent = t('moveHint'); $('mvMsg').textContent = '';
  $('helpBtn').title = t('tabHelp');
  relabelParts(); drawViews(); drawMine(); relabelCube(); drawMove(); drawControls(); showPanel(panel);
}

// ---------- start
bindScene({ base: baseName, file: () => fileName, download });
labels(); lookChanged(); overlay(); resize();
new THREE.Box3(new THREE.Vector3(-.1, 0, -.1), new THREE.Vector3(.1, .3, .1)).getBoundingSphere(sphere);
place(view.dir);
