import Phaser from "phaser";
import { cameraPanel } from "../../input/cv/cameraPanel";
import { keyboard } from "../../input/defaultInput";
import { inputManager } from "../../input/inputManager";
import { gameUi } from "../../ui/gameUi";
import { MenuConfirm } from "../menuConfirm";
import { loadGameArt } from "../rendering/assets";
import { bestScore } from "../storage";

export class BootScene extends Phaser.Scene {
  private confirm!: MenuConfirm;
  private stage: "menu" | "controls" = "menu";
  private artFailed = false;
  private inputSource = inputManager.getSource();

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
    this.stage = "menu";
    this.inputSource = inputManager.getSource();
    this.confirm = new MenuConfirm(inputManager.getState());
    gameUi.setArtReady(!this.artFailed);
    gameUi.showMenu(bestScore.get());
    const removeActions = [
      gameUi.onAction("advance", () => this.advance()),
      gameUi.onAction("back", () => this.back()),
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
    if (this.stage === "controls") {
      this.scene.start("Game");
      return;
    }
    this.stage = "controls";
    gameUi.showControls();
  }

  private back(): void {
    this.stage = "menu";
    this.confirm = new MenuConfirm(inputManager.getState());
    gameUi.showMenu(bestScore.get());
  }

  update(): void {
    const input = inputManager.getState();
    if (this.inputSource !== inputManager.getSource()) {
      this.inputSource = inputManager.getSource();
      this.confirm = new MenuConfirm(input);
    }
    gameUi.updateInput(input, input !== keyboard.getState());
    if (this.confirm.read(input)) {
      this.advance();
    }
  }
}
