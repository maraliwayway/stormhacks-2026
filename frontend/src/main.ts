import Phaser from "phaser";
import { VoiceDirector } from "./audio/VoiceDirector";
import { attachKeyboardInput } from "./input/KeyboardInput";
import { Socket } from "./net/Socket";
import { HEIGHT, WIDTH } from "./game/config";
import { BootScene } from "./game/scenes/BootScene";
import { CalibrationScene } from "./game/scenes/CalibrationScene";
import { GameOverScene } from "./game/scenes/GameOverScene";
import { GameScene } from "./game/scenes/GameScene";
import { MenuScene } from "./game/scenes/MenuScene";

attachKeyboardInput();

const voice = new VoiceDirector();
void voice.init();
new Socket(voice).connect();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#111111",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [BootScene, MenuScene, CalibrationScene, GameScene, GameOverScene],
});
