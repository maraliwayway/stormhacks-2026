// Owner: Dev 1. Ticket: "Gesture-driven menu + start flow".
// Strafe moves the highlight; flap (or Enter) confirms. Same InputState as gameplay.

import Phaser from "phaser";
import { InputState, type Gesture } from "../../shared/InputState";
import type { LevelId } from "../../shared/events";
import { HEIGHT, WIDTH } from "../config";
import { LEVELS } from "../levels";

export class MenuScene extends Phaser.Scene {
  private options: LevelId[] = ["kitchen", "dessert"];
  private index = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private unsubscribe?: () => void;
  private lastFlapAt = 0;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.add.text(WIDTH / 2, 140, "FLAPPY ARMS", { fontSize: "96px", color: "#ffc107", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 80, "Strafe to choose  •  Flap twice to start  (keys: arrows / Enter)", {
      fontSize: "24px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.labels = this.options.map((id, i) =>
      this.add.text(WIDTH / 2 + (i === 0 ? -200 : 200), HEIGHT / 2, LEVELS[id].name, { fontSize: "48px", color: "#ffffff" }).setOrigin(0.5),
    );
    this.refresh();

    this.unsubscribe = InputState.on((g) => this.handle(g));
    this.events.once("shutdown", () => this.unsubscribe?.());
  }

  private handle(g: Gesture): void {
    if (g === "strafeLeft") this.index = 0;
    if (g === "strafeRight") this.index = 1;
    if (g === "select") return this.start();
    if (g === "flap") {
      // Require 2 flaps within 1 s so random arm movement does not select.
      const now = performance.now();
      if (now - this.lastFlapAt < 1000) return this.start();
      this.lastFlapAt = now;
    }
    this.refresh();
  }

  private refresh(): void {
    this.labels.forEach((t, i) => t.setColor(i === this.index ? "#ffc107" : "#888888").setScale(i === this.index ? 1.15 : 1));
  }

  private start(): void {
    this.scene.start("Calibration", { level: this.options[this.index] });
  }
}
