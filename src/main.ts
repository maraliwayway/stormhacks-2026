import Phaser from "phaser";
import { audio } from "./audio/audio";
import { installGameSounds } from "./audio/gameSounds";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { bestScore } from "./game/storage";
import "./style.css";
import { mountCameraPanel } from "./input/cv/cameraPanel";
import type { CvInput } from "./input/cv/cvInput";
import { inputManager } from "./input/inputManager";
import { installDev3 } from "./net/installDev3";
import { installScoreSync } from "./net/scoreSync";
import { gameUi } from "./ui/gameUi";

const stopScoreSync = installScoreSync();
const host = document.getElementById("game")!;
gameUi.mount(host);
// Dev 3 hook: voice director, SFX, leaderboard and live roast. A no-op offline.
const stopDev3 = installDev3(host);
gameUi.showMenu(bestScore.get());
audio.init();
const stopSoundStatus = audio.onStatus((status) =>
  gameUi.setSoundStatus(status),
);
const stopGameSounds = installGameSounds();
const stopPrayerSounds = audio.watch(() => inputManager.getState());

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#fbf8ef",
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
let cameraPending = false;
let disposed = false;

/** The camera is the only controller, so it opens as soon as the page loads. */
async function enableCamera(): Promise<void> {
  if (cameraPending || cvSource) {
    return;
  }
  cameraPending = true;
  gameUi.setCameraStatus("loading");
  let source: CvInput | null = null;
  try {
    const { createCvInput } = await import("./input/cv/cvInput");
    if (disposed) {
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    source = createCvInput(video);
    await source.start();
    if (disposed) {
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
    // Some browsers allow audio once the camera is live; try before the first click.
    audio.unlock();
  } catch (error) {
    source?.stop();
    if (!disposed) {
      gameUi.setCameraStatus("error");
      console.warn("[cv] camera unavailable", error);
    }
  } finally {
    cameraPending = false;
  }
}

const removeActions = [
  gameUi.onAction("camera", () => {
    enableCamera();
  }),
  gameUi.onAction("recalibrate", () => cvSource?.recalibrate()),
  gameUi.onAction("sound", () => audio.toggleMute()),
  gameUi.onAction("fullscreen", () => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    request.catch((error) =>
      console.warn("[ui] fullscreen unavailable", error),
    );
  }),
];

// Automated checks drive a scripted pose source instead of a real webcam.
if (!new URLSearchParams(location.search).has("nocamera")) {
  enableCamera();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    stopScoreSync();
    stopDev3();
    stopSoundStatus();
    stopGameSounds();
    stopPrayerSounds();
    audio.destroy();
    stopCamera?.();
    removeActions.forEach((remove) => remove());
    game.destroy(true);
    gameUi.destroy();
  });
}
