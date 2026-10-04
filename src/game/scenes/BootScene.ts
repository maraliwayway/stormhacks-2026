import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { cameraPanel } from "../../input/cv/cameraPanel";
import { inputManager } from "../../input/inputManager";
import { gameUi } from "../../ui/gameUi";
import { MenuConfirm } from "../menuConfirm";
import { loadGameArt } from "../rendering/assets";
import { ensureCatArt } from "../rendering/enemies";
import { ensureHeavenArt } from "../rendering/heavenArt";
import { DriftingClouds, SKY, addBackdropPigeons } from "../rendering/sky";
import { bestScore } from "../storage";

/** Title screen: clouds drift behind the player's bird until they put their palms together. */
export class BootScene extends Phaser.Scene {
  private confirm!: MenuConfirm;
  private artFailed = false;
  private inputSource = inputManager.getSource();
  private clouds?: DriftingClouds;

  constructor() {
    super("Boot");
  }

  preload(): void {
    this.artFailed = false;
    const showArtError = () => {
      this.artFailed = true;
      gameUi.setArtError();
    };
    this.load.once("loaderror", showArtError);
    this.load.once("complete", () => this.load.off("loaderror", showArtError));
    loadGameArt(this);
  }

  create(): void {
    cameraPanel.setMode("large");
    audio.setMusic("title");
    this.inputSource = inputManager.getSource();
    this.confirm = new MenuConfirm(inputManager.getState());
    this.cameras.main.setBackgroundColor(SKY);
    addBackdropPigeons(this);
    this.clouds = new DriftingClouds(this);
    if (!this.artFailed) {
      ensureHeavenArt(this);
      ensureCatArt(this);
    }
    gameUi.setArtReady(!this.artFailed);
    gameUi.showMenu(bestScore.get());
    const removeActions = [
      gameUi.onAction("advance", () => this.advance()),
      gameUi.onAction("warmup", () => gameUi.showWarmup()),
      gameUi.onAction("warmup-done", () => gameUi.hideWarmup()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      removeActions.forEach((remove) => remove()),
    );
  }

  private advance(): void {
    const input = inputManager.getState();
    if (this.artFailed || !input.tracking || !input.calibrated) {
      return;
    }
    this.scene.start("Game");
  }

  update(_time: number, deltaMs: number): void {
    this.clouds?.update(deltaMs);
    const input = inputManager.getState();
    if (this.inputSource !== inputManager.getSource()) {
      this.inputSource = inputManager.getSource();
      this.confirm = new MenuConfirm(input);
    }
    gameUi.updateInput(input);
    if (this.confirm.read(input)) {
      // Palms together on the warm-up card means "done", not "start".
      if (gameUi.currentView === "warmup") {
        gameUi.hideWarmup();
      } else {
        this.advance();
      }
    }
  }
}
