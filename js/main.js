// Wires the interface to the viewer.
import { THREE, view, renderer, ctr, sphere, place, resize, setFocal, setRatio, getPose, setPose, refreshLook, snapshot } from './viewer.js';
import { model, picked, setModel, applyMaterials, showAll, expandAll, filterParts, applyExplode, setExplodeMode, turn90, setFrontFromView, resetOrientation, spin, resetSpin, pick, relabelParts } from './model.js';
import { loadFile, extOf, isCad, STEP_LIMIT } from './loaders.js';
import { LANGS, t, getLang, setLang } from './i18n.js';
import { relabelCube } from './gizmo.js';
import { MOVES, goToKey, play, playing, stop, seedanceText } from './moves.js';
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
    fileName = file.name; side.classList.remove('nomodel'); expanded = false;
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
  if (extOf(f.name) === 'json') importViews(f); else openFile(f);
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
async function importViews(file) {
  let list = [];
  try { const d = JSON.parse(await file.text()); list = (Array.isArray(d) ? d : d.views || []).filter(validView); } catch (e) {}
  $('viewMsg').textContent = list.length ? '' : t('viewBad');
  if (!list.length) return;
  list.forEach(v => { views = views.filter(o => o.name !== v.name); views.push({ name: v.name.slice(0, 40), pos: v.pos, target: v.target, focal: +v.focal || 50, ratio: +v.ratio || 0 }); });
  storeViews();
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
let move = MOVES[0];
seg('moves', MOVES.map((m, i) => ({ v: i, key: 'mv_' + m.id })), 0, i => { stopMove(); move = MOVES[i]; drawMove(); playMove(); });
function drawMove() {
  const n = move.keys.length, keys = $('moveKeys'); keys.innerHTML = '';
  move.keys.forEach((k, i) => { const b = document.createElement('button'); b.textContent = i + 1; b.onclick = () => toKey(i); keys.append(b); });
  $('moveDesc').textContent = t('mvd_' + move.id);
  $('moveInfo').textContent = t('moveInfo').replace('{n}', n).replace('{c}', n - 1);
  $('moveDetail').hidden = !move.keys.some(k => k.ty === 'detail');
  $('moveDetail').textContent = t('moveDetail') + (picked ? picked.name || t('movePart') : t('moveCentre'));
}
function toKey(i) { stopMove(); clearPreset(); mark($('moveKeys'), $('moveKeys').children[i]); if (model) goToKey(move, i); }
function stopMove() { stop(); $('movePlay').textContent = t('movePlay'); }
function playMove() {
  if (!model) return;
  clearPreset(); mark($('moveKeys'), null); $('movePlay').textContent = t('moveStop'); play(move, stopMove);
}
$('movePlay').onclick = () => { if (playing()) stopMove(); else playMove(); };
renderer.domElement.addEventListener('pointerdown', () => { if (playing()) stopMove(); });
renderer.domElement.addEventListener('wheel', () => { if (playing()) stopMove(); }, { passive: true });
// Three buttons: the keyframes (with the prompt file), the reference video alone, or everything.
seg('videoSizes', VIDEO_SIZES, videoSide, v => { videoSide = v; });
const gap = () => new Promise(r => setTimeout(r, 400)); // browsers drop downloads fired too close together
const exportButtons = ['expFrames', 'expVideo', 'expEvery'];
async function exportMove(wantFrames, wantVideo) {
  if (!model) return;
  stopMove(); exportButtons.forEach(id => $(id).disabled = true);
  try {
    const names = [];
    if (wantFrames) for (let i = 0; i < move.keys.length; i++) {
      toKey(i);
      const { blob } = await snapshot(longSide);
      const name = `${baseName()}_${move.id}_${i + 1}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
      download(blob, name); names.push(name);
      await gap();
    }
    let video = null;
    if (wantVideo && videoSupported()) {
      const msg = p => { $('moveMsg').textContent = t('moveVideo').replace('{p}', Math.round(p * 100)); };
      msg(0);
      try {
        const r = await recordMove(move, videoSide, msg);
        if (r) { video = { ...r, name: `${baseName()}_${move.id}_video.mp4` }; download(r.blob, video.name); await gap(); }
      } catch (e) { console.error(e); }
    }
    if (wantFrames) download(new Blob([seedanceText(move, names, fileName, video)], { type: 'text/plain' }), `${baseName()}_${move.id}_seedance.txt`);
    const key = !wantFrames ? (video ? 'xVideoDone' : 'xNoVideo') : !wantVideo ? 'xFramesDone' : video ? 'moveDone' : 'moveNoVideo';
    $('moveMsg').textContent = t(key).replace('{n}', names.length);
  } finally { exportButtons.forEach(id => $(id).disabled = false); }
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
    const { blob, W, H } = await snapshot(longSide);
    const tag = { shaded: 'POV', depth: 'depth', lines: 'lines' }[view.style];
    const name = `${baseName()}_${tag}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
    download(blob, name); $('savemsg').textContent = `${t('savedMsg')}${name} (${W} × ${H} px)`;
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
  $('moveMsg').textContent = t('moveHint');
  railButtons.forEach(b => b.title = t(b.dataset.title));
  relabelParts(); drawViews(); relabelCube(); drawMove(); showPanel(panel);
}

// ---------- start
labels(); lookChanged(); overlay(); resize();
new THREE.Box3(new THREE.Vector3(-.1, 0, -.1), new THREE.Vector3(.1, .3, .1)).getBoundingSphere(sphere);
place(view.dir);
