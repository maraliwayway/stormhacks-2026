import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { bestScore } from "./game/storage";
import "./style.css";
import { mountCameraPanel } from "./input/cv/cameraPanel";
import type { CvInput } from "./input/cv/cvInput";
import { keyboard } from "./input/defaultInput";
import { inputManager } from "./input/inputManager";
import { installDev3 } from "./net/installDev3";
import { installScoreSync } from "./net/scoreSync";
import { gameUi } from "./ui/gameUi";

keyboard.start();
inputManager.setSource(keyboard);
const stopScoreSync = installScoreSync();
const host = document.getElementById("game")!;
gameUi.mount(host);
// Dev 3 hook: voice director, SFX, leaderboard and live roast. A no-op offline.
const stopDev3 = installDev3(host);
gameUi.updateInput(keyboard.getState(), false);
gameUi.showMenu(bestScore.get());

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#f7f1e5",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [BootScene, GameScene],
});

/** Exposed for integration checks and the calibration action. */
export let cvSource: CvInput | null = null;
let stopCamera: (() => void) | null = null;
let cameraDesired = false;
let cameraPending = false;
let disposed = false;

function chooseKeyboard(): void {
  cameraDesired = false;
  stopCamera?.();
  stopCamera = null;
  cvSource = null;
  inputManager.setSource(keyboard);
  gameUi.setCameraStatus("idle");
  gameUi.updateInput(keyboard.getState(), false);
}

/** Camera permission and model initialization start only after the player chooses them. */
async function enableCamera(): Promise<void> {
  cameraDesired = true;
  gameUi.setCameraStatus("loading");
  if (cameraPending) {
    return;
  }
  cameraPending = true;
  let source: CvInput | null = null;
  try {
    const { createCvInput } = await import("./input/cv/cvInput");
    if (disposed || !cameraDesired) {
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    source = createCvInput(video);
    await source.start();
    if (disposed || !cameraDesired) {
      source.stop();
      return;
    }
    const panel = mountCameraPanel(source, video, host);
    inputManager.setSource(source);
    cvSource = source;
    stopCamera = () => {
      panel.destroy();
      source?.stop();
    };
    gameUi.setCameraStatus("ready");
    gameUi.updateInput(source.getState(), true);
  } catch (error) {
    source?.stop();
    if (!disposed && cameraDesired) {
      inputManager.setSource(keyboard);
      gameUi.setCameraStatus("error");
      gameUi.updateInput(keyboard.getState(), false);
      console.warn("[cv] camera unavailable, keyboard is ready", error);
    }
  } finally {
    cameraPending = false;
  }
}

const removeActions = [
  gameUi.onAction("keyboard", chooseKeyboard),
  gameUi.onAction("camera", () => {
    if (cvSource) {
      return;
    }
    enableCamera();
  }),
  gameUi.onAction("recalibrate", () => cvSource?.recalibrate()),
  gameUi.onAction("fullscreen", () => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : host.requestFullscreen();
    request.catch((error) =>
      console.warn("[ui] fullscreen unavailable", error),
    );
  }),
];

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    cameraDesired = false;
    stopScoreSync();
    stopDev3();
    stopCamera?.();
    removeActions.forEach((remove) => remove());
    keyboard.stop();
    game.destroy(true);
    gameUi.destroy();
  });
}
