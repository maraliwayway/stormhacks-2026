import Phaser from "phaser";
import { cameraPanel } from "../../input/cv/cameraPanel";
import { keyboard } from "../../input/defaultInput";
import { inputManager } from "../../input/inputManager";
import type { InputState } from "../../input/types";
import { EnemyField } from "../enemies";
import { gameEvents } from "../events";
import { FLIGHT, Flight } from "../flight";
import { BIRD_BOX, HazardField } from "../hazards";
import { levelAt } from "../levels";
import { MenuConfirm } from "../menuConfirm";
import { drawBackdrop } from "../rendering/backdrop";
import { ensureBirdTexture } from "../rendering/bird";
import { drawEnemies } from "../rendering/enemies";
import { drawHazards } from "../rendering/hazards";
import { bestScore } from "../storage";
import { installVfx } from "../vfx";
import { WormField, wormBalance } from "../worms";

const MAX_FRAME_MS = 50;
const SLOW_MOTION_FACTOR = 0.35;
const MILESTONE_METRES = 25;

const WORMS_ENABLED = import.meta.env.VITE_ENABLE_WORMS === "true";

export class GameScene extends Phaser.Scene {
  protected flight!: Flight;
  protected bird!: Phaser.GameObjects.Image;
  protected score!: Phaser.GameObjects.Text;
  protected backdrop!: Phaser.GameObjects.Graphics;
  protected badge!: Phaser.GameObjects.Text;
  protected hint!: Phaser.GameObjects.Text;
  protected started = 0;
  protected phase: "playing" | "dying" | "over" = "playing";
  private lastMilestone = 0;
  protected hazards!: HazardField;
  protected hazardArt!: Phaser.GameObjects.Graphics;
  protected enemies!: EnemyField;
  private enemyArt!: Phaser.GameObjects.Graphics;
  private runFlaps = 0;
  private overBaseline = 0;
  private confirm!: MenuConfirm;
  private level = levelAt(0);
  private levelHud!: Phaser.GameObjects.Text;
  private previousBest = 0;
  private bestAnnounced = false;
  private bestHud!: Phaser.GameObjects.Text;
  private slowUntil = 0;
  private worms!: WormField;
  private wormArt!: Phaser.GameObjects.Graphics;
  private wormHud!: Phaser.GameObjects.Text;

  constructor() {
    super("Game");
  }

  preload(): void {
    if (WORMS_ENABLED && !this.cache.audio.exists("worm-pickup")) {
      this.load.audio("worm-pickup", "assets/worm-pickup.wav");
    }
  }

  create(): void {
    cameraPanel.setMode("mini");
    this.resetRun();
    this.createWorld();
    this.createBird();
    this.createRunHud();
    this.createControlHud();
    installVfx(this, this.bird, this.score, () => {
      this.slowUntil = this.time.now + 200;
    });
  }

  private resetRun(): void {
    this.phase = "playing";
    this.started = this.time.now;
    this.lastMilestone = 0;
    this.runFlaps = 0;
    this.previousBest = bestScore.get();
    this.bestAnnounced = false;
    this.slowUntil = 0;
    this.confirm = new MenuConfirm(inputManager.getState());
    this.level = levelAt(0);
  }

  private createWorld(): void {
    this.hazards = new HazardField();
    this.hazardArt = this.add.graphics().setDepth(5);
    this.enemies = new EnemyField();
    this.enemyArt = this.add.graphics().setDepth(6);
    this.worms = new WormField();
    this.wormArt = this.add.graphics().setDepth(8);
    const input = inputManager.getState();
    this.flight = new Flight(input.flapCount, input);
    this.flight.velocity = -FLIGHT.impulse;
    this.cameras.main.setBackgroundColor("#f5dfb5");
    this.cameras.main.setScroll(0, 0);
    this.backdrop = this.add.graphics().setScrollFactor(0).setDepth(-10);
  }

  private createBird(): void {
    ensureBirdTexture(this);
    this.bird = this.add
      .image(this.flight.x, this.flight.y, "bird")
      .setDepth(10);
  }

  private createRunHud(): void {
    this.score = this.add
      .text(640, 32, "0 m", {
        fontSize: "44px",
        fontStyle: "bold",
        color: "#173e47",
        fontFamily: "Arial, sans-serif",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30);
    this.levelHud = this.add
      .text(640, 90, this.level.label, {
        fontSize: "20px",
        color: "#173e47",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30);
    gameEvents.emit("level_start", { level: this.level.id, altitude: 0 });
    this.bestHud = this.add
      .text(1248, 172, `BEST ${Math.floor(this.previousBest)} m`, {
        fontSize: "24px",
        color: "#173e47",
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(30);
    if (this.previousBest > 0) {
      const y = FLIGHT.startY - this.previousBest * FLIGHT.pixelsPerMetre;
      const marker = this.add.graphics().setDepth(2).lineStyle(3, 0x278b87);
      for (let x = 90; x < 1200; x += 40) {
        marker.lineBetween(x, y, x + 22, y);
      }
      this.add
        .text(90, y - 30, "BEST", { fontSize: "18px", color: "#237c79" })
        .setDepth(3);
    }
  }

  private createControlHud(): void {
    this.badge = this.add
      .text(30, 30, "KEYBOARD MODE", {
        fontSize: "16px",
        color: "#173e47",
      })
      .setScrollFactor(0)
      .setDepth(30);
    this.wormHud = this.add
      .text(30, 60, `WORMS ${wormBalance.get()}`, {
        fontSize: "20px",
        color: "#173e47",
      })
      .setScrollFactor(0)
      .setDepth(30)
      .setVisible(WORMS_ENABLED);
    this.hint = this.add
      .text(
        640,
        680,
        "Tap Space to flap   •   Tap left / right to change lane",
        {
          fontSize: "20px",
          color: "#173e47",
          backgroundColor: "#fff1d5",
          padding: { x: 16, y: 8 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);
  }

  update(_time: number, deltaMs: number): void {
    const input = inputManager.getState();
    this.badge.setVisible(input === keyboard.getState());
    const confirmed = this.confirm.read(input);
    if (this.phase === "over") {
      this.handleGameOverInput(input, confirmed);
      return;
    }
    if (this.phase !== "playing") {
      return;
    }

    // Movement can slow for near-miss effects; cat timers use active elapsed time.
    const elapsedSeconds = Math.min(deltaMs, MAX_FRAME_MS) / 1000;
    const movementSeconds =
      elapsedSeconds *
      (this.time.now < this.slowUntil ? SLOW_MOTION_FACTOR : 1);
    this.updateFlight(input, movementSeconds, elapsedSeconds);
    this.updateScore();
    this.updateControlHint(input);
    this.updateLevel();
    this.drawBackdrop();

    if (this.level.id === "heaven") {
      this.clearHeavenThreats();
    } else if (input.tracking && input.calibrated) {
      if (!this.updateThreats(elapsedSeconds)) {
        return;
      }
      if (WORMS_ENABLED) {
        this.updateWorms();
      }
    }
    if (this.flight.offscreen) {
      this.finishRun("fall");
    }
  }

  private handleGameOverInput(
    input: Readonly<InputState>,
    confirmed: boolean,
  ): void {
    if (confirmed) {
      this.scene.start("Boot");
      return;
    }
    if (input.menuConfirmMode === "swipe") {
      return;
    }
    if (input.flapCount < this.overBaseline) {
      this.overBaseline = input.flapCount;
    }
    if (
      input.tracking &&
      input.calibrated &&
      input.flapCount > this.overBaseline
    ) {
      this.scene.restart();
    }
  }

  private updateFlight(
    input: Readonly<InputState>,
    movementSeconds: number,
    elapsedSeconds: number,
  ): void {
    const flaps = this.flight.update(input, movementSeconds);
    this.runFlaps += flaps;
    if (input.tracking && input.calibrated) {
      this.enemies.advanceGrace(elapsedSeconds, flaps);
    }
    if (flaps > 0) {
      gameEvents.emit("flap", {
        x: this.flight.x,
        y: this.flight.y,
        count: flaps,
      });
    }
    this.bird.setPosition(this.flight.x, this.flight.y);
    this.bird.setAngle(Phaser.Math.Clamp(this.flight.velocity / 25, -18, 20));
    this.cameras.main.scrollY = this.flight.cameraY;
  }

  private updateScore(): void {
    this.score.setText(`${Math.floor(this.flight.altitude)} m`);
    this.bestHud.setText(
      `BEST ${Math.floor(Math.max(this.previousBest, this.flight.altitude))} m`,
    );
    if (!this.bestAnnounced && this.flight.altitude > this.previousBest + 0.1) {
      this.bestAnnounced = true;
      gameEvents.emit("new_best", {
        altitude: this.flight.altitude,
        previousBest: this.previousBest,
      });
      this.confetti();
    }
    const milestone =
      Math.floor(this.flight.altitude / MILESTONE_METRES) * MILESTONE_METRES;
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      gameEvents.emit("milestone", { altitude: milestone });
    }
  }

  private updateControlHint(input: Readonly<InputState>): void {
    if (!input.tracking || !input.calibrated) {
      this.hint.setText(
        "Tracking paused. Return to the camera or use keyboard mode.",
      );
    } else if (input === keyboard.getState()) {
      this.hint.setText(
        "Tap Space to flap   •   Tap left / right to change lane",
      );
    } else {
      this.hint.setText(
        "Flap to rise   •   Lean or swipe left/right to change lane",
      );
    }
  }

  private updateLevel(): void {
    const nextLevel = levelAt(this.flight.altitude);
    if (nextLevel.start !== this.level.start) {
      this.level = nextLevel;
      this.levelHud.setText(nextLevel.label);
      this.flight.velocity = Math.min(this.flight.velocity, -FLIGHT.impulse);
      gameEvents.emit("level_start", {
        level: nextLevel.id,
        altitude: this.flight.altitude,
      });
    }
  }

  private clearHeavenThreats(): void {
    // Consume skipped rows so they stay skipped when Kitchen resumes.
    this.hazards.advance(this.flight.cameraY, {
      birdY: this.flight.y,
      suppressObstacles: true,
    });
    this.hazards.items = [];
    this.enemies.items = [];
    this.worms.items = [];
    this.hazardArt.clear();
    this.enemyArt.clear();
    this.wormArt.clear();
  }

  /** Returns false when a collision has ended the run. */
  private updateThreats(elapsedSeconds: number): boolean {
    const birdBox = { x: this.flight.x, y: this.flight.y, ...BIRD_BOX };
    this.enemies.tick(
      this.flight.altitude,
      this.flight.cameraY,
      elapsedSeconds,
      undefined,
      birdBox,
    );
    // Cats reserve the map throughout warning, strike, and retreat.
    this.hazards.advance(this.flight.cameraY, {
      birdY: this.flight.y,
      suppressObstacles: this.enemies.items.length > 0,
    });
    const hazardResult = this.hazards.check(birdBox);
    this.drawHazards();
    if (hazardResult.hit) {
      this.finishRun(hazardResult.hit.kind);
      return false;
    }
    this.emitNearMisses(hazardResult.misses.length);

    const enemyResult = this.enemies.check(birdBox);
    this.drawEnemies();
    if (enemyResult.hit) {
      this.finishRun(enemyResult.hit.kind);
      return false;
    }
    this.emitNearMisses(enemyResult.misses.length);
    return true;
  }

  private emitNearMisses(count: number): void {
    for (let index = 0; index < count; index++) {
      gameEvents.emit("near_miss", {
        altitude: this.flight.altitude,
        x: this.flight.x,
        y: this.flight.y,
      });
    }
  }

  protected finishRun(reason: string): void {
    if (this.phase !== "playing") {
      return;
    }
    this.phase = "dying";
    bestScore.set(Math.max(bestScore.get(), this.flight.altitude));
    const duration = (this.time.now - this.started) / 1000;
    gameEvents.emit("death", {
      altitude: this.flight.altitude,
      duration,
      reason,
      flapCount: this.runFlaps,
      flapRate: inputManager.getState().flapRate,
    });
    gameEvents.emit("run_end", { altitude: this.flight.altitude, duration });
    this.bird.setTint(0xe87356);
    this.tweens.add({
      targets: this.bird,
      y: this.bird.y + 28,
      angle: 90,
      duration: 600,
    });
    this.time.delayedCall(600, () => this.showGameOver());
  }

  private confetti(): void {
    for (let i = 0; i < 24; i++) {
      const bit = this.add
        .rectangle(
          430 + i * 18,
          80,
          8,
          16,
          [0x62bdb5, 0xf0b949, 0xe77b66][i % 3],
        )
        .setScrollFactor(0)
        .setDepth(45);
      this.tweens.add({
        targets: bit,
        x: bit.x + (i - 12) * 14,
        y: 260 + (i % 4) * 30,
        angle: i * 40,
        alpha: 0,
        duration: 850,
        onComplete: () => bit.destroy(),
      });
    }
  }

  private showGameOver(): void {
    this.phase = "over";
    this.overBaseline = inputManager.getState().flapCount;
    this.confirm = new MenuConfirm(inputManager.getState());
    const retryHint =
      inputManager.getState().menuConfirmMode === "swipe"
        ? ""
        : "Flap to try again\n";
    this.add
      .rectangle(640, 360, 1280, 720, 0x183e46, 0.5)
      .setScrollFactor(0)
      .setDepth(39);
    this.add
      .text(
        640,
        320,
        `LEGENDARY FLOP\n${Math.floor(this.flight.altitude)} metres\n\n${retryHint}${this.confirmHint()} for main menu`,
        {
          fontSize: "36px",
          color: "#fff4dc",
          backgroundColor: "#183e46",
          align: "center",
          padding: { x: 40, y: 30 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);
    this.menuButton();
  }

  private confirmHint(): string {
    return inputManager.getState() === keyboard.getState()
      ? "Jump or Enter"
      : "Swipe one hand left to right";
  }

  private menuButton(): void {
    this.add
      .text(640, 580, "MAIN MENU", {
        fontSize: "24px",
        color: "#183e46",
        backgroundColor: "#ffd46b",
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(41)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("Boot"));
  }

  private drawHazards(): void {
    const upcoming = this.hazards.items.find((hazard) => !hazard.passed);
    if (upcoming) {
      const laneIndex = FLIGHT.lanes.findIndex((laneX) => laneX === upcoming.x);
      const laneName = ["left", "centre", "right"][laneIndex];
      this.hint.setText(`Obstacle ahead in the ${laneName} lane`);
    }
    drawHazards(
      this.hazardArt,
      this.hazards.items,
      this.flight.cameraY,
      this.level.id,
    );
  }

  private drawEnemies(): void {
    if (this.enemies.items.length > 0) {
      this.hint.setText("CAT! Leave the marked lane and keep flapping");
    }
    drawEnemies(this.enemyArt, this.enemies.items, this.flight.cameraY);
  }

  private updateWorms(): void {
    this.worms.advance(this.hazards.items, this.flight.cameraY);
    for (const worm of this.worms.collect({
      x: this.flight.x,
      y: this.flight.y,
      ...BIRD_BOX,
    })) {
      wormBalance.set(wormBalance.get() + 1);
      gameEvents.emit("pickup", {
        x: worm.x,
        y: worm.y,
        total: wormBalance.get(),
      });
      if (this.cache.audio.exists("worm-pickup")) {
        this.sound.play("worm-pickup", { volume: 0.25 });
      }
      const pop = this.add
        .text(worm.x, worm.y, "+1", {
          fontSize: "28px",
          color: "#9b3862",
          fontStyle: "bold",
        })
        .setDepth(20);
      this.tweens.add({
        targets: pop,
        y: worm.y - 60,
        alpha: 0,
        duration: 450,
        onComplete: () => pop.destroy(),
      });
    }
    this.wormHud.setText(`WORMS ${wormBalance.get()}`);
    const graphics = this.wormArt;
    graphics.clear();
    for (const worm of this.worms.items) {
      graphics
        .lineStyle(10, 0xd77496)
        .beginPath()
        .moveTo(worm.x - 15, worm.y + 4)
        .lineTo(worm.x - 5, worm.y - 5)
        .lineTo(worm.x + 6, worm.y + 5)
        .lineTo(worm.x + 16, worm.y - 4)
        .strokePath();
      graphics.fillStyle(0x173e47).fillCircle(worm.x + 16, worm.y - 6, 2);
    }
  }

  private drawBackdrop(): void {
    this.cameras.main.setBackgroundColor(
      this.level.id === "heaven" ? "#dceefa" : "#f5dfb5",
    );
    drawBackdrop(this.backdrop, this.flight.cameraY, this.level.id);
  }
}
