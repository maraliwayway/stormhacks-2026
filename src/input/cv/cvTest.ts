import { inputManager } from '../inputManager';
import { createMenuInput } from '../menuInput';
import { createKeyboardInput } from '../keyboardInput';
import { createCvInput } from './cvInput';
import { getLatest } from './poseTracker';
import { createDebugOverlay } from './debugOverlay';
import { createCalibrationGuide } from './calibrationGuide';

// Dev-only page. Exercises the same API the game uses: inputManager.getState() + menu events.

const startBtn = document.getElementById('start') as HTMLButtonElement;
const kbBtn = document.getElementById('kb') as HTMLButtonElement;
const video = document.getElementById('video') as HTMLVideoElement;
const out = document.getElementById('out') as HTMLPreElement;
const eventsEl = document.getElementById('events') as HTMLPreElement;
const stage = document.getElementById('stage')!;

const menu = createMenuInput(() => inputManager.getState());
const eventLog: string[] = [];
let cv: ReturnType<typeof createCvInput> | null = null;
let timer = 0;

function begin() {
  startBtn.disabled = true;
  kbBtn.disabled = true;
  // Menu events: poll once per frame, like a Phaser scene's update().
  const loop = () => {
    for (const ev of menu.poll()) {
      eventLog.unshift(`${new Date().toLocaleTimeString()}  ${ev}`);
      eventLog.length = Math.min(eventLog.length, 6);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  timer = window.setInterval(() => {
    const s = inputManager.getState();
    const cam = getLatest();
    const f = (n: number) => n.toFixed(2);
    out.textContent = [
      cv ? `fps ${cam.fps.toFixed(1)} | inference ${cam.inferenceMs.toFixed(1)} ms` : 'keyboard source',
      `tracking ${s.tracking} | calibrated ${s.calibrated}`,
      `flapCount ${s.flapCount} | flapRate ${f(s.flapRate)}/s | flapping ${s.flapping} | flapVelocity ${f(s.flapVelocity)}`,
      `strafe ${f(s.strafe)} | left ${s.strafeLeft} | right ${s.strafeRight}`,
      `jump ${s.jump} | squat ${s.squat}`,
      `menu confirm progress ${f(menu.confirmProgress())}`,
    ].join('\n');
    eventsEl.textContent = 'menu events:\n' + eventLog.join('\n');
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
  const kb = createKeyboardInput();
  await kb.start!();
  inputManager.setSource(kb);
  kbBtn.textContent = 'Keyboard: Space/arrows/WASD';
  begin();
};
