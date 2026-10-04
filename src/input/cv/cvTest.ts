import { startTracker, getLatest } from './poseTracker';
import { L } from './landmarks';
import { createDebugOverlay } from './debugOverlay';

const btn = document.getElementById('start') as HTMLButtonElement;
const video = document.getElementById('video') as HTMLVideoElement;
const out = document.getElementById('out') as HTMLPreElement;

btn.onclick = async () => {
  btn.disabled = true;
  btn.textContent = 'Loading...';
  try {
    await startTracker(video);
  } catch (e) {
    btn.textContent = 'Error';
    out.textContent = String(e);
    console.error(e);
    return;
  }
  btn.textContent = 'Running';
  createDebugOverlay(document.getElementById('stage')!);

  setInterval(() => {
    const s = getLatest();
    const lm = s.landmarks;
    if (!lm) {
      out.textContent = `fps ${s.fps.toFixed(1)} | inference ${s.inferenceMs.toFixed(1)} ms\nNO BODY DETECTED`;
      return;
    }
    const shoulderY = (lm[L.SHOULDER_L].y + lm[L.SHOULDER_R].y) / 2;
    const shoulderW = Math.abs(lm[L.SHOULDER_L].x - lm[L.SHOULDER_R].x);
    out.textContent = [
      `fps ${s.fps.toFixed(1)} | inference ${s.inferenceMs.toFixed(1)} ms`,
      `landmarks: ${lm.length}`,
      `shoulder width: ${shoulderW.toFixed(3)}`,
      `L wrist y - shoulder y: ${(lm[L.WRIST_L].y - shoulderY).toFixed(3)}`,
      `R wrist y - shoulder y: ${(lm[L.WRIST_R].y - shoulderY).toFixed(3)}`,
    ].join('\n');
  }, 200);
};
