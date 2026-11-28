// Conversion on a server, for STEP files too big for the browser. The file is sent in pieces, converted to GLB
// by STEP2GLB on the server, and the GLB comes back and is opened like any other file.
// The server is the one that serves this page (same address). To use a server at another address, set
// window.STEP2GLB_SERVER = 'https://…' before the modules load.
import { t } from './i18n.js';

const BASE = (window.STEP2GLB_SERVER || '').replace(/\/+$/, '');
const api = p => BASE + '/api' + p;
const PASS_KEY = 'step2glb.pass';

export const savedPass = () => { try { return sessionStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; } };
export const savePass = v => { try { sessionStorage.setItem(PASS_KEY, v); } catch (e) {} };

class ServerError extends Error {
  constructor(code, message, detail = {}) { super(message); this.code = code; this.detail = detail; }
}
const abortError = () => new DOMException('Aborted', 'AbortError');
const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(abortError());
  const id = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); rej(abortError()); }, { once: true });
});

// The server's info, or null when there is no server (page not served by it, or it is off): then nothing changes.
export async function serverInfo() {
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(api('/health'), { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.service === 'step2glb' ? j : null;
  } catch (e) { return null; }
}

function failure(status, text) {
  let d = {}; try { d = JSON.parse(text).detail || {}; } catch (e) {}
  return new ServerError(d.code || 'http' + status, d.message || 'HTTP ' + status, d);
}

async function call(path, opts = {}, pass = '') {
  const headers = { ...(opts.headers || {}) };
  if (pass) headers['X-Passphrase'] = pass;
  let r;
  try { r = await fetch(api(path), { ...opts, headers }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new ServerError('network', 'network'); }
  if (!r.ok) throw failure(r.status, await r.text());
  return r;
}

// One piece of the file, with progress (fetch cannot report upload progress, XMLHttpRequest can).
function put(path, blob, pass, signal, onProgress) {
  return new Promise((res, rej) => {
    if (signal?.aborted) return rej(abortError());
    const x = new XMLHttpRequest();
    x.open('PUT', api(path));
    if (pass) x.setRequestHeader('X-Passphrase', pass);
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded); };
    x.onload = () => x.status < 300 ? res() : rej(failure(x.status, x.responseText));
    x.onerror = () => rej(new ServerError('network', 'network'));
    x.onabort = () => rej(abortError());
    signal?.addEventListener('abort', () => x.abort(), { once: true });
    x.send(blob);
  });
}

async function putChunk(id, n, blob, pass, signal, onProgress) {
  for (let attempt = 0; ; attempt++) {
    try { return await put(`/upload/${id}/${n}`, blob, pass, signal, onProgress); }
    catch (e) {
      const retry = e instanceof ServerError && e.code === 'network';
      if (!retry || attempt >= 3) throw e;
      await sleep(1500 * (attempt + 1), signal);
    }
  }
}

const KEYS = { auth: 'srvAuth', too_large: 'srvTooLarge', busy: 'srvBusy', rate: 'srvRate', disk: 'srvDisk', bad_file: 'srvBadFile',
  network: 'srvNetwork', incomplete: 'srvNetwork', crashed: 'srvCrashed', timeout: 'srvTimeout' };
// An error as a sentence for the person (in the interface language).
export function explain(e) {
  const k = KEYS[e.code];
  if (!k) return e.message || String(e);
  return t(k).replace('{mb}', e.detail?.max_bytes ? Math.round(e.detail.max_bytes / 1048576) : '');
}

function describe(s) {
  if (s.status === 'queued') return s.ahead > 0 ? t('srvQueue').replace('{n}', s.ahead) : t('srvWait');
  if (s.phase === 'mesh') return t('srvMesh') + (s.fraction != null ? ' ' + Math.round(100 * s.fraction) + '%' : '');
  if (s.phase === 'write') return t('srvWrite');
  return t('srvRead');
}

// Sends the STEP, waits for the conversion and returns the GLB as a File. status(text) is called with what is going on.
// signal: an AbortSignal to cancel (the job is deleted on the server).
export async function convertOnServer(file, pass, status, signal) {
  const t0 = Date.now();
  const clock = () => { const s = Math.floor((Date.now() - t0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let id = null;
  try {
    const start = await (await call('/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size }), signal }, pass)).json();
    id = start.id;
    let sent = 0;
    for (let n = 0; n < start.chunks; n++) {
      const blob = file.slice(n * start.chunk_bytes, (n + 1) * start.chunk_bytes);
      await putChunk(id, n, blob, pass, signal, loaded => status(t('srvUp').replace('{pct}', Math.floor(100 * (sent + loaded) / file.size))));
      sent += blob.size;
    }
    await call(`/upload/${id}/complete`, { method: 'POST', signal }, pass);
    for (;;) {
      const s = await (await call(`/jobs/${id}`, { signal }, pass)).json();
      if (s.status === 'done') break;
      if (s.status === 'error') throw new ServerError(s.code || 'convert', s.error || 'error');
      status(describe(s) + ' · ' + clock());
      await sleep(2000, signal);
    }
    const r = await call(`/jobs/${id}/glb`, { signal }, pass);
    const total = Number(r.headers.get('Content-Length')) || 0, reader = r.body.getReader(), parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      status(t('srvDown').replace('{pct}', total ? Math.floor(100 * got / total) : '…'));
    }
    return new File(parts, file.name.replace(/\.[^.]+$/, '') + '.glb', { type: 'model/gltf-binary' });
  } finally {
    // free the server's disk (and stop the conversion when cancelled): best effort
    if (id) fetch(api('/jobs/' + id), { method: 'DELETE', headers: pass ? { 'X-Passphrase': pass } : {} }).catch(() => {});
  }
}
