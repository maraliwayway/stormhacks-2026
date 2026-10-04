// Owner: Dev 1. Ticket: "Calibration screen".
// Starts the webcam, captures a 2 s baseline, then hands off to the game.
// If the camera fails or the player presses Enter, continue in keyboard mode.

import Phaser from "phaser";
import { PoseSession } from "../../cv/PoseSession";
import { InputState } from "../../shared/InputState";
import type { LevelId } from "../../shared/events";
import { HEIGHT, WIDTH } from "../config";

export class CalibrationScene extends Phaser.Scene {
  private level!: LevelId;
  private status!: Phaser.GameObjects.Text;
  private unsubscribe?: () => void;
  private done = false;

  constructor() {
    super("Calibration");
  }

  init(data: { level: LevelId }): void {
    this.level = data.level;
    this.done = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0f3460);
    this.add.text(WIDTH / 2, 100, "Stand in the box", { fontSize: "56px", color: "#ffffff" }).setOrigin(0.5);
    this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 20, 320, 440).setStrokeStyle(6, 0xffffff);
    this.status = this.add.text(WIDTH / 2, HEIGHT - 70, "Starting camera...", { fontSize: "28px", color: "#ffffff" }).setOrigin(0.5);

    this.unsubscribe = InputState.on((g, source) => {
      if (source === "keyboard" && g === "select") this.proceed();
    });
    this.events.once("shutdown", () => this.unsubscribe?.());

    void PoseSession.start().then(() => {
      if (PoseSession.state === "failed") {
        this.status.setText("Camera unavailable: press Enter to play with the keyboard");
        return;
      }
      PoseSession.beginCalibration(() => this.proceed());
    });
  }

  update(): void {
    if (PoseSession.state === "calibrating") {
      const pct = Math.round(PoseSession.calibrationProgress * 100);
      this.status.setText(pct > 0 ? `Hold still... ${pct}%` : "Step back until your whole body is visible  (Enter = keyboard mode)");
    }
    // TODO(Dev 1): draw PoseSession.latestLandmarks as a skeleton and turn the box green when visible.
  }

  private proceed(): void {
    if (this.done) return;
    this.done = true;
    this.scene.start("Game", { level: this.level });
  }
}
