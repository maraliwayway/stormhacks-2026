import { inputManager } from '../inputManager';
import { keyboard } from '../defaultInput';
import { createCvInput } from './cvInput';
import { getLatest } from './poseTracker';
import { createDebugOverlay } from './debugOverlay';
import { createCalibrationGuide } from './calibrationGuide';

// Dev-only page (/cv-test.html): shows the raw InputState the game reads.

const startBtn = document.getElementById('start') as HTMLButtonElement;
const kbBtn = document.getElementById('kb') as HTMLButtonElement;
const video = document.getElementById('video') as HTMLVideoElement;
const out = document.getElementById('out') as HTMLPreElement;
const stage = document.getElementById('stage')!;

let cv: ReturnType<typeof createCvInput> | null = null;

function begin() {
  startBtn.disabled = true;
  kbBtn.disabled = true;
  window.setInterval(() => {
    const s = inputManager.getState();
    const cam = getLatest();
    const f = (n: number) => n.toFixed(2);
    out.textContent = [
      cv ? `fps ${cam.fps.toFixed(1)} | inference ${cam.inferenceMs.toFixed(1)} ms` : 'keyboard source',
      `tracking ${s.tracking} | calibrated ${s.calibrated}`,
      `flapCount ${s.flapCount} | flapRate ${f(s.flapRate)}/s | flapping ${s.flapping} | flapVelocity ${f(s.flapVelocity)}`,
      `strafe ${f(s.strafe)} | left ${s.strafeLeft} | right ${s.strafeRight}`,
      `jump ${s.jump} | squat ${s.squat}`,
      `waves (selectCount) ${s.selectCount ?? 0}`,
    ].join('\n');
  }, 100);
}

startBtn.onclick = async () => {
  startBtn.textContent = 'Loading...';
  try {
    cv = createCvInput(video);
    await cv.start!();
  } catch (e) {
    startBtn.textContent = 'Error';
    out.textContent = String(e);
    console.error(e);
    return;
  }
  startBtn.textContent = 'Running';
  inputManager.setSource(cv);
  createDebugOverlay(stage);
  createCalibrationGuide(stage, () => cv!.getCalibration(), () => cv!.getPrompt());
  begin();
};

kbBtn.onclick = async () => {
  await keyboard.start();
  inputManager.setSource(keyboard);
  kbBtn.textContent = 'Keyboard: Space/arrows';
  begin();
};
