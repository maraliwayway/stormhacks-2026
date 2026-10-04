import { keyboard } from "../defaultInput";
import { inputManager } from "../inputManager";
import { createCalibrationGuide } from "./calibrationGuide";
import { createCvInput } from "./cvInput";
import { createDebugOverlay } from "./debugOverlay";
import { createHeadSteeringGuide } from "./headSteeringGuide";
import { getLatest } from "./poseTracker";

// Dev-only page (/cv-test.html): shows the raw InputState the game reads.

const startButton = document.getElementById("start") as HTMLButtonElement;
const keyboardButton = document.getElementById("kb") as HTMLButtonElement;
const video = document.getElementById("video") as HTMLVideoElement;
const output = document.getElementById("out") as HTMLPreElement;
const stage = document.getElementById("stage")!;

let cv: ReturnType<typeof createCvInput> | null = null;

function begin() {
  startButton.disabled = true;
  keyboardButton.disabled = true;
  window.setInterval(() => {
    const state = inputManager.getState();
    const camera = getLatest();
    const formatNumber = (value: number) => value.toFixed(2);
    output.textContent = [
      cv
        ? `fps ${camera.fps.toFixed(1)} | inference ${camera.inferenceMs.toFixed(1)} ms | ${camera.delegate ?? "loading"}`
        : "keyboard source",
      `pose latency ${camera.latencyMs.toFixed(1)} ms | skipped busy frames ${camera.droppedFrames}`,
      `tracking ${state.tracking} | calibrated ${state.calibrated}`,
      `flapCount ${state.flapCount} | flapRate ${formatNumber(state.flapRate)}/s | flapping ${state.flapping} | flapVelocity ${formatNumber(state.flapVelocity)}`,
      `strafe ${formatNumber(state.strafe)} | left ${state.strafeLeft} | right ${state.strafeRight}`,
      `head preview x ${state.headPosition == null ? "untracked" : formatNumber(state.headPosition)} | turns left ${state.turnLeftCount ?? 0} | right ${state.turnRightCount ?? 0}`,
      `jump ${state.jump} | squat ${state.squat}`,
      `prayer selections ${state.selectCount ?? 0} | swipes left ${state.swipeLeftCount ?? 0} | right ${state.swipeRightCount ?? 0}`,
    ].join("\n");
  }, 100);
}

startButton.onclick = async () => {
  startButton.textContent = "Loading...";
  try {
    cv = createCvInput(video);
    await cv.start();
  } catch (error) {
    startButton.textContent = "Error";
    output.textContent = String(error);
    console.error(error);
    return;
  }
  startButton.textContent = "Running";
  inputManager.setSource(cv);
  video.style.objectFit = "contain";
  createHeadSteeringGuide(stage, () => cv!.getState(), video);
  createDebugOverlay(stage, 640, 480, video);
  createCalibrationGuide(
    stage,
    () => cv!.getCalibration(),
    () => cv!.getPrompt(),
  );
  begin();
};

keyboardButton.onclick = async () => {
  await keyboard.start();
  inputManager.setSource(keyboard);
  keyboardButton.textContent = "Keyboard: Space/arrows";
  begin();
};
