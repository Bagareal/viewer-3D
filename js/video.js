// Reference video of a camera move, for AI video models. Rendered frame by frame (always smooth,
// whatever the computer), encoded to H.264 MP4 in the browser with WebCodecs: nothing is uploaded.
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer/mp4-muxer.mjs';
import { view, captureSize, beginCapture, drawCapture, endCapture } from './viewer.js';
import { moveAt } from './moves.js';

// Long side, and the most pixels: browsers encode up to the pixels of 4K UHD (3840 x 2160),
// so a square or 4:3 "4K" video has those pixels, not a 3840 px side.
export const VIDEO_SIZES = [{ v: 1920, label: '1080p' }, { v: 3840, label: '4K' }];
const MAX_PIXELS = 3840 * 2160;
export const FPS = 30, CLIP_SECONDS = 5; // one clip = from one keyframe to the next
// H.264 High, Main, then Baseline profile, level 5.1 (enough for 4K)
const CODECS = ['avc1.640033', 'avc1.4d0033', 'avc1.42e033'];

export const videoSupported = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

// Generous bitrate (about 0.25 bit per pixel per frame: ~60 Mbit/s in 4K, ~15 in 1080p), then lower
// ones if this computer's encoder refuses it, so the picture stays sharp and even from start to end.
async function pickConfig(width, height) {
  const ideal = Math.min(80e6, Math.max(12e6, width * height * FPS * .25));
  for (const bitrate of [ideal, ideal * .6, 12e6])
    for (const codec of CODECS) {
      const c = { codec, width, height, bitrate, framerate: FPS, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(c)).supported) return c; } catch (e) { /* next one */ }
    }
  return null;
}

// Video size for the frame on screen: within MAX_PIXELS, then smaller steps if this computer's
// encoder still refuses it. Returns { side, W, H, config } or null.
export async function chooseSize(longSide) {
  if (!videoSupported()) return null;
  let side = longSide, size = captureSize(side, true);
  while (size.W * size.H > MAX_PIXELS) { side -= 2; size = captureSize(side, true); }
  let config = await pickConfig(size.W, size.H);
  for (let i = 0; i < 5 && !config; i++) {
    side = Math.floor(side * .9); size = captureSize(side, true); config = await pickConfig(size.W, size.H);
  }
  return config ? { side, ...size, config } : null;
}

// Returns { blob, W, H, fps, seconds }, or null when this browser cannot encode the video.
export async function recordMove(move, longSide, onProgress) {
  const chosen = await chooseSize(longSide);
  if (!chosen) return null;
  const { side, config } = chosen;
  const bg = view.bg;
  if (bg === 'none') view.bg = 'white'; // MP4 has no transparency
  const { W, H } = beginCapture(side, true);
  try {
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
    let failure = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
    enc.configure(config);
    const n = (move.keys.length - 1) * CLIP_SECONDS * FPS + 1, dt = 1e6 / FPS;
    for (let i = 0; i < n; i++) {
      if (failure) throw failure;
      moveAt(move, i / (n - 1));
      const frame = new VideoFrame(drawCapture(), { timestamp: Math.round(i * dt), duration: Math.round(dt) });
      // Only the first frame is a key frame: a key frame every 2 s made the quality pulse at each one.
      enc.encode(frame, { keyFrame: i === 0 });
      frame.close();
      while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5));
      if (i % 15 === 0) { onProgress?.(i / n); await new Promise(r => setTimeout(r, 0)); }
    }
    await enc.flush();
    enc.close();
    if (failure) throw failure;
    muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), W, H, fps: FPS, seconds: (n - 1) / FPS };
  } finally { endCapture(); view.bg = bg; }
}
