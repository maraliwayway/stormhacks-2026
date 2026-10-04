import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import "./style.css";
import { mountCameraPanel } from "./input/cv/cameraPanel";
import { type CvInput, createCvInput } from "./input/cv/cvInput";
import { keyboard } from "./input/defaultInput";
import { inputManager } from "./input/inputManager";
import { installScoreSync } from "./net/scoreSync";

// Keyboard is always available as the fallback; the camera replaces it once it is running.
// Add ?kb to the URL to skip the camera entirely.
keyboard.start();
inputManager.setSource(keyboard);
const stopScoreSync = installScoreSync();

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#183e46",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [BootScene, GameScene],
});

/** Exposed so browser tests can drive the camera source. */
export let cvSource: CvInput | null = null;
let stopCamera: (() => void) | null = null;
if (!new URLSearchParams(location.search).has("kb")) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const cv = createCvInput(video);
  cv.start().then(
    () => {
      const panel = mountCameraPanel(
        cv,
        video,
        document.getElementById("game")!,
      );
      inputManager.setSource(cv);
      cvSource = cv;
      stopCamera = () => {
        panel.destroy();
        cv.stop();
      };
    },
    (error) =>
      console.warn("[cv] camera unavailable, staying on keyboard", error),
  );
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopScoreSync();
    stopCamera?.();
    keyboard.stop();
    game.destroy(true);
  });
}
