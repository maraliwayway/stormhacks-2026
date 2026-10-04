// Owner: Dev 2 (logic) + PM (layout). One flap restarts in under 2 s.
// TODO(Dev 3): 3-letter initials entry + POST /score when backend is up.

import Phaser from "phaser";
import { InputState } from "../../shared/InputState";
import type { RunStats } from "../../shared/events";
import { HEIGHT, TIMING, WIDTH } from "../config";

export class GameOverScene extends Phaser.Scene {
  private stats!: RunStats;
  private shownAt = 0;
  private unsubscribe?: () => void;

  constructor() {
    super("GameOver");
  }

  init(data: { stats: RunStats }): void {
    this.stats = data.stats;
  }

  create(): void {
    this.shownAt = this.time.now;
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    const s = this.stats;
    this.add.text(WIDTH / 2, 150, "LEGENDARY FLOP", { fontSize: "72px", color: "#ff5252", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 290, `${s.altitude} m`, { fontSize: "96px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 390, `Best ${s.best} m  •  Peak ${s.peakFlapRate} flaps/s`, { fontSize: "32px", color: "#cccccc" }).setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT - 100, "Flap to fly again  •  Squat for menu", { fontSize: "32px", color: "#ffc107" }).setOrigin(0.5);

    this.unsubscribe = InputState.on((g) => {
      if (this.time.now - this.shownAt < TIMING.restartLockoutMs) return;
      if (g === "flap" || g === "select") this.scene.start("Game", { level: s.level });
      if (g === "squat") this.scene.start("Menu");
    });
    this.events.once("shutdown", () => this.unsubscribe?.());
  }
}
