// Wires the interface to the viewer.
import { THREE, view, renderer, ctr, cam, sphere, place, resize, setFocal, setRatio, getPose, setPose, refreshLook, snapshot, invalidate, afterDraw, setCamera } from './viewer.js';
import { model, picked, setModel, applyMaterials, showAll, expandAll, filterParts, applyExplode, setExplodeMode, turn90, setFrontFromView, resetOrientation, spin, resetSpin, pick, pointAt, relabelParts } from './model.js';
import { loadFile, extOf, isCad, STEP_LIMIT } from './loaders.js';
import { LANGS, t, getLang, setLang } from './i18n.js';
import { relabelCube } from './gizmo.js';
import { MOVES, goToKey, play, playing, stop, seedanceText, focus, zoom, dists, aimsInBox, aimedPoints, toBox, keyFromCamera, toCustom, validMove } from './moves.js';
import { VIDEO_SIZES, recordMove, videoSupported } from './video.js';

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
async function openFile(file) {
  const ext = extOf(file.name);
  if (isCad(ext) && file.size > STEP_LIMIT && !(await confirmBig(file))) return;
  overlay('busy', t('opening') + file.name + '…');
  await new Promise(r => setTimeout(r, 60)); // lets the message paint before heavy work
  try {
    const { obj, tree, groups } = await loadFile(file, s => overlay('busy', s));
    setModel(obj, tree, groups, file.name);
    fileName = file.name; side.classList.remove('nomodel'); expanded = false; focus.start = focus.end = zoom.start = zoom.end = null;
    labels(); overlay();
    if (panel === 'file') showPanel('frame'); // next step once the file is open
  } catch (err) {
    const m = String(err.message || err), oom = /memory|allocation|abort/i.test(m) || (isCad(ext) && file.size > STEP_LIMIT);
    const text = oom ? t('oom') : m;
    overlay('fail', text.charAt(0).toUpperCase() + text.slice(1));
  }
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
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (extOf(f.name) === 'json') importJson(f); else openFile(f);
});

// ---------- framing
const presets = [[0, .12, 1], [-.8, .35, 1], [.8, .35, 1], [1, .1, 0], [.3, 1.4, .8], [.5, -.05, 1], [0, .15, -1]];
seg('presets', presets.map((v, i) => ({ v, preset: i })), 1, v => place(v));
seg('focals', [24, 35, 50, 85, 105].map(v => ({ v, label: v + ' mm' })), view.focal, setFocal);
const ratios = [['ratioFree', 0], ['1:1', 1], ['4:5', 4 / 5], ['3:2', 3 / 2], ['16:9', 16 / 9], ['9:16', 9 / 16]];
seg('ratios', ratios.map(([l, v]) => v ? { v, label: l } : { v, key: l }), view.ratio, setRatio);
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
  if (picking && down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
    const p = pointAt(e.clientX, e.clientY); if (p) usePoint(p); down = null; return;
  }
  if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && pick(e.clientX, e.clientY)) { if (panel === 'help' || !panel) showPanel('parts'); drawMove(); }
  down = null;
});
cv.addEventListener('pointercancel', () => { drag = down = null; });

// ---------- parts
$('showAll').onclick = showAll;
$('expand').onclick = () => { expanded = !expanded; expandAll(expanded); labels(); };
$('partFilter').oninput = e => filterParts(e.target.value);
$('exp').oninput = applyExplode;
seg('expModes', [{ v: 'all', key: 'expAll' }, { v: 'sel', key: 'expSel' }], 'all', setExplodeMode);

// ---------- look
function lookChanged() {
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

// ---------- camera moves for AI video: keyframes exported as first / last frames, with the prompts
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
  const n = move.keys.length, keys = $('moveKeys'); keys.innerHTML = '';
  move.keys.forEach((k, i) => { const b = document.createElement('button'); b.textContent = i + 1; b.onclick = () => toKey(i); b.classList.toggle('on', i === sel); keys.append(b); });
  $('moveDesc').textContent = t(move.custom ? 'mvd_custom' : 'mvd_' + move.id);
  $('moveInfo').textContent = n < 2 ? t('keyFew') : t('moveInfo').replace('{n}', n).replace('{c}', n - 1);
  $('moveDetail').hidden = move.custom || !!focus.end || !move.keys.some(k => k.ty === 'detail');
  $('moveDetail').textContent = t('moveDetail') + (picked ? picked.name || t('movePart') : t('moveCentre'));
  $('focusField').hidden = $('zoomField').hidden = move.custom; $('editField').hidden = !move.custom; $('mvCopy').hidden = move.custom;
  ['keyUpdate', 'keyDel'].forEach(id => $(id).disabled = sel < 0);
  ['movePlay', ...exportButtons].forEach(id => $(id).disabled = n < 2);
  drawFocus(); drawZoom(); invalidate();
}
function toKey(i) { stopMove(); clearPreset(); sel = i; mark($('moveKeys'), $('moveKeys').children[i]); ['keyUpdate', 'keyDel'].forEach(id => $(id).disabled = false); if (model) goToKey(move, i); drawZoom(); }
function stopMove() { stop(); $('movePlay').textContent = t('movePlay'); invalidate(); }
function playMove() {
  if (!model || move.keys.length < 2) return;
  stopPicking(); clearPreset(); sel = -1; mark($('moveKeys'), null); $('movePlay').textContent = t('moveStop'); play(move, stopMove);
}

// Aimed point of the first and last keyframe of the ready-made moves: height slider, or a click on the model.
const focusRows = [...document.querySelectorAll('#focusField .focus')];
function drawFocus() {
  const A = model && move.keys.length ? aimsInBox(move) : null;
  focusRows.forEach(row => {
    const end = row.dataset.end, a = A && A[end === 'start' ? 0 : A.length - 1], v = a ? Math.round(a[1] * 100) : 50;
    row.querySelector('input').value = v;
    row.querySelector('.val').textContent = (focus[end] ? '' : t('focusAuto') + ' · ') + v + '%';
    row.classList.toggle('isauto', !focus[end]);
  });
}
const focusKey = end => end === 'start' ? 0 : lastKey();
function setFocus(end, value) { focus[end] = value; if (model) toKey(focusKey(end)); drawMove(); }
focusRows.forEach(row => {
  const end = row.dataset.end;
  row.querySelector('input').oninput = e => {
    if (!model) return;
    const a = aimsInBox(move)[focusKey(end)]; // keeps the point's depth and sides, changes its height
    setFocus(end, [a[0], e.target.value / 100, a[2]]);
  };
  row.querySelector('.pick').onclick = () => startPicking(end);
  row.querySelector('.auto').onclick = () => setFocus(end, null);
});

// Distance of the first and last keyframe of the ready-made moves; of the chosen keyframe in moves made by hand.
const zoomRows = [...document.querySelectorAll('#zoomField .focus')], pct = d => Math.round(d * 100) + '%';
function drawZoom() {
  const D = dists(move);
  zoomRows.forEach(row => {
    const end = row.dataset.end, d = D.length ? D[end === 'start' ? 0 : D.length - 1] : 1;
    row.querySelector('input').value = Math.round(d * 100);
    row.querySelector('.val').textContent = (zoom[end] == null ? t('focusAuto') + ' · ' : '') + pct(d);
    row.classList.toggle('isauto', zoom[end] == null);
  });
  const k = move.custom && move.keys[sel], kz = $('keyZoom');
  kz.classList.toggle('off', !k); kz.querySelector('input').value = Math.round((k ? k.d : 1) * 100);
  kz.querySelector('.val').textContent = k ? pct(k.d) : '';
}
function setZoom(end, value) { zoom[end] = value; if (model) toKey(focusKey(end)); drawMove(); }
zoomRows.forEach(row => {
  const end = row.dataset.end;
  row.querySelector('input').oninput = e => setZoom(end, e.target.value / 100);
  row.querySelector('.auto').onclick = () => setZoom(end, null);
});
$('keyZoom').querySelector('input').oninput = e => {
  const k = move.custom && move.keys[sel]; if (!k || !model) return;
  k.d = e.target.value / 100; goToKey(move, sel); drawZoom();
};

// Click on the model: the next click picks a point of the surface instead of a part.
function startPicking(kind) {
  if (!model) return;
  const again = picking === kind; stopPicking(); if (again) return;
  stopMove(); picking = kind; $('stage').classList.add('picking');
  document.querySelectorAll('button.pick').forEach(b => b.classList.toggle('on', (b.closest('.focus')?.dataset.end || 'aim') === kind));
}
function stopPicking() { picking = ''; $('stage').classList.remove('picking'); document.querySelectorAll('button.pick.on').forEach(b => b.classList.remove('on')); }
function usePoint(p) {
  const kind = picking; stopPicking();
  if (kind === 'aim') { setCamera(cam.position.clone(), p); clearPreset(); return; } // the camera turns towards the point
  setFocus(kind, toBox(p));
}
addEventListener('keydown', e => { if (e.key === 'Escape' && picking) stopPicking(); });

// Moves made by hand: keyframes taken from the camera as it is in the viewer.
const unwrap = keys => keys.forEach((k, i) => { if (i) k.az += Math.round((keys[i - 1].az - k.az) / 360) * 360; });
function editKeys(change) { if (!model || !move.custom) return; stopMove(); stopPicking(); change(); unwrap(move.keys); drawMove(); }
$('mvNew').onclick = () => setMove({ name: '', keys: [] });
$('mvCopy').onclick = () => {
  if (!model || move.custom) return;
  const name = t('mv_' + move.id), keys = toCustom(move);
  setMove({ name: '', keys }); $('mvName').value = name; toKey(0);
};
$('keyAdd').onclick = () => editKeys(() => {
  const i = sel >= 0 ? sel + 1 : move.keys.length;
  move.keys.splice(i, 0, keyFromCamera(move.keys[i - 1])); sel = i;
});
$('keyUpdate').onclick = () => editKeys(() => { if (sel >= 0) move.keys[sel] = keyFromCamera(move.keys[sel - 1]); });
$('keyDel').onclick = () => editKeys(() => { if (sel < 0) return; move.keys.splice(sel, 1); sel = Math.min(sel, lastKey()); });
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
  const box = $('marks'), show = model && panel === 'frame' && !playing() && move.keys.length;
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
// Three buttons: the keyframes (with the prompt file), the reference video alone, or everything.
seg('videoSizes', VIDEO_SIZES, videoSide, v => { videoSide = v; });
const gap = () => new Promise(r => setTimeout(r, 400)); // browsers drop downloads fired too close together
async function exportMove(wantFrames, wantVideo) {
  if (!model || move.keys.length < 2) return;
  stopMove(); exportButtons.forEach(id => $(id).disabled = true);
  try {
    const names = [];
    if (wantFrames) for (let i = 0; i < move.keys.length; i++) {
      toKey(i);
      const { blob, mask } = await snapshot(longSide, true);
      const stem = `${baseName()}_${moveId(move)}_${i + 1}`, name = `${stem}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
      download(blob, name); names.push(name);
      await gap();
      download(mask, `${stem}_mask.png`); await gap();
    }
    let video = null;
    if (wantVideo && videoSupported()) {
      const msg = p => { $('moveMsg').textContent = t('moveVideo').replace('{p}', Math.round(p * 100)); };
      msg(0);
      try {
        const r = await recordMove(move, videoSide, msg);
        if (r) { video = { ...r, name: `${baseName()}_${moveId(move)}_video.mp4` }; download(r.blob, video.name); await gap(); }
      } catch (e) { console.error(e); }
    }
    if (wantFrames) download(new Blob([seedanceText(move, names, fileName, video)], { type: 'text/plain' }), `${baseName()}_${moveId(move)}_seedance.txt`);
    const key = !wantFrames ? (video ? 'xVideoDone' : 'xNoVideo') : !wantVideo ? 'xFramesDone' : video ? 'moveDone' : 'moveNoVideo';
    $('moveMsg').textContent = t(key).replace('{n}', names.length);
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
    const { blob, mask, W, H } = await snapshot(longSide, true);
    const tag = { shaded: 'POV', depth: 'depth', lines: 'lines' }[view.style], stem = `${baseName()}_${tag}`;
    const name = `${stem}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
    download(blob, name); await gap(); download(mask, `${stem}_mask.png`);
    $('savemsg').textContent = `${t('savedMsg')}${name}, ${stem}_mask.png (${W} × ${H} px)`;
  } finally { $('save').disabled = false; }
};

// ---------- icon bar: one panel at a time; clicking the open one again hides the panel for a bigger view
let panel = 'file';
const railButtons = [...document.querySelectorAll('#rail button')];
function showPanel(id) {
  panel = id;
  railButtons.forEach(b => b.classList.toggle('on', b.dataset.panel === id));
  document.querySelectorAll('#panel .pane').forEach(p => p.hidden = p.id !== 'p-' + id);
  $('panel').hidden = !id;
  const b = railButtons.find(b => b.dataset.panel === id);
  if (b) $('panelTitle').textContent = t(b.dataset.title);
  invalidate();
}
railButtons.forEach(b => b.onclick = () => showPanel(panel === b.dataset.panel ? '' : b.dataset.panel));
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
  railButtons.forEach(b => b.title = t(b.dataset.title));
  relabelParts(); drawViews(); drawMine(); relabelCube(); drawMove(); showPanel(panel);
}

// ---------- start
labels(); lookChanged(); overlay(); resize();
new THREE.Box3(new THREE.Vector3(-.1, 0, -.1), new THREE.Vector3(.1, .3, .1)).getBoundingSphere(sphere);
place(view.dir);
