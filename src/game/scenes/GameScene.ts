import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { cameraPanel } from "../../input/cv/cameraPanel";
import { inputManager } from "../../input/inputManager";
import type { InputState } from "../../input/types";
import { gameUi } from "../../ui/gameUi";
import { EnemyField, WARNING_SECONDS } from "../enemies";
import { gameEvents } from "../events";
import { FLIGHT, Flight } from "../flight";
import { BIRD_BOX, HazardField } from "../hazards";
import { levelAt } from "../levels";
import { MenuConfirm } from "../menuConfirm";
import { IllustratedBackdrop, drawBackdrop } from "../rendering/backdrop";
import { ensureBirdAnimation } from "../rendering/bird";
import { CatRenderer } from "../rendering/enemies";
import { HazardRenderer } from "../rendering/hazards";
import { bestScore } from "../storage";
import { installVfx } from "../vfx";
import { WormField, wormBalance } from "../worms";

const MAX_FRAME_MS = 50;
const SLOW_MOTION_FACTOR = 0.35;
const MILESTONE_METRES = 25;
const WORMS_ENABLED = import.meta.env.VITE_ENABLE_WORMS === "true";

export class GameScene extends Phaser.Scene {
  protected flight!: Flight;
  protected bird!: Phaser.GameObjects.Sprite;
  protected started = 0;
  protected phase: "playing" | "dying" | "over" = "playing";
  protected hazards!: HazardField;
  protected enemies!: EnemyField;
  private backdrop!: Phaser.GameObjects.Graphics;
  private illustratedBackdrop!: IllustratedBackdrop;
  private hazardRenderer!: HazardRenderer;
  private cat!: CatRenderer;
  private catAge: number | null = null;
  private lane = 1;
  private worms!: WormField;
  private wormArt!: Phaser.GameObjects.Graphics;
  private lastMilestone = 0;
  private runFlaps = 0;
  private confirm!: MenuConfirm;
  private level = levelAt(0);
  private previousBest = 0;
  private bestAnnounced = false;
  private slowUntil = 0;
  private hint = "";
  private reason = "fall";
  private paused = false;
  private pausedAt = 0;
  private pauseDuration = 0;
  private inputSource = inputManager.getSource();

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
    gameUi.showFlight();
    gameUi.showWorld(this.level.id);
    this.updateHud();
    this.drawBackdrop();
    gameEvents.emit("level_start", { level: this.level.id, altitude: 0 });
    installVfx(
      this,
      this.bird,
      () => gameUi.pulseAltitude(),
      () => {
        this.slowUntil = this.time.now + 200;
      },
    );
    const removeActions = [
      gameUi.onAction("pause", () => this.pauseRun()),
      gameUi.onAction("resume", () => this.resumeRun()),
      gameUi.onAction("retry", () => {
        if (this.phase === "over") {
          this.scene.restart();
        }
      }),
      gameUi.onAction("menu", () => this.scene.start("Boot")),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      removeActions.forEach((remove) => remove()),
    );
  }

  private resetRun(): void {
    this.phase = "playing";
    this.started = this.time.now;
    this.lastMilestone = 0;
    this.runFlaps = 0;
    this.previousBest = bestScore.get();
    this.bestAnnounced = false;
    this.slowUntil = 0;
    this.paused = false;
    this.pauseDuration = 0;
    this.inputSource = inputManager.getSource();
    this.confirm = new MenuConfirm(inputManager.getState());
    this.level = levelAt(0);
  }

  private createWorld(): void {
    this.hazards = new HazardField();
    this.hazardRenderer = new HazardRenderer(
      this,
      this.add.graphics().setDepth(4),
    );
    this.enemies = new EnemyField();
    this.cat = new CatRenderer(this, this.add.graphics().setDepth(6));
    this.catAge = null;
    this.worms = new WormField();
    this.wormArt = this.add.graphics().setDepth(8);
    const input = inputManager.getState();
    this.flight = new Flight(input.flapCount, input);
    this.flight.velocity = -FLIGHT.impulse;
    this.lane = this.flight.selectedLane;
    this.cameras.main.setScroll(0, 0);
    this.illustratedBackdrop = new IllustratedBackdrop(this);
    this.backdrop = this.add.graphics().setScrollFactor(0).setDepth(-10);
    if (this.previousBest > 0) {
      const y = FLIGHT.startY - this.previousBest * FLIGHT.pixelsPerMetre;
      const marker = this.add
        .graphics()
        .setDepth(2)
        .lineStyle(3, 0x24323a, 0.6);
      for (let x = 70; x < 1210; x += 40) {
        marker.lineBetween(x, y, x + 22, y);
      }
      this.add
        .text(82, y - 34, "your best", {
          fontFamily: '"Patrick Hand", sans-serif',
          fontSize: "24px",
          color: "#24323a",
          backgroundColor: "#fbf8ef",
          padding: { x: 10, y: 2 },
        })
        .setDepth(3);
    }
  }

  private createBird(): void {
    ensureBirdAnimation(this);
    this.bird = this.add
      .sprite(this.flight.x, this.flight.y, "pigeon-flight-1")
      .setOrigin(0.63, 0.53)
      .setDepth(10);
  }

  private pauseRun(): void {
    if (this.phase !== "playing" || this.paused) {
      return;
    }
    this.paused = true;
    this.pausedAt = this.time.now;
    this.bird.anims.pause();
    this.tweens.pauseAll();
    audio.duck(true);
    audio.play("pause");
    cameraPanel.setMode("hidden");
    gameUi.showPause();
  }

  private resumeRun(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.pauseDuration += this.time.now - this.pausedAt;
    this.flight.update({ ...inputManager.getState(), tracking: false }, 0);
    this.confirm = new MenuConfirm(inputManager.getState());
    this.bird.anims.resume();
    this.tweens.resumeAll();
    audio.duck(false);
    audio.play("resume");
    cameraPanel.setMode("mini");
    gameUi.hideDialog();
  }

  update(_time: number, deltaMs: number): void {
    const input = inputManager.getState();
    if (this.inputSource !== inputManager.getSource()) {
      this.inputSource = inputManager.getSource();
      this.flight.update({ ...input, tracking: false }, 0);
      this.confirm = new MenuConfirm(input);
    }
    gameUi.updateInput(input);
    const confirmed = this.confirm.read(input);
    if (this.phase === "over") {
      this.handleGameOverInput(confirmed);
      return;
    }
    if (this.paused) {
      // Consume input counts without movement; flaps behind the dialog cannot replay.
      this.flight.update({ ...input, tracking: false }, 0);
      if (confirmed) {
        this.resumeRun();
      }
      return;
    }
    if (this.phase !== "playing") {
      return;
    }
    const elapsedSeconds = Math.min(deltaMs, MAX_FRAME_MS) / 1000;
    const movementSeconds =
      elapsedSeconds *
      (this.time.now < this.slowUntil ? SLOW_MOTION_FACTOR : 1);
    this.updateFlight(input, movementSeconds, elapsedSeconds);
    this.updateScore();
    // The HUD stays quiet; threats set a hint only while the player must act.
    this.hint = "";
    this.updateLevel();
    this.drawBackdrop();
    // Every world, Heaven included, keeps its obstacles and cats through a map change.
    if (input.tracking && input.calibrated) {
      if (!this.updateThreats(elapsedSeconds)) {
        this.updateHud();
        return;
      }
      if (WORMS_ENABLED) {
        this.updateWorms();
      }
    }
    this.updateHud();
    if (this.flight.offscreen) {
      this.finishRun("fall");
    }
  }

  private handleGameOverInput(confirmed: boolean): void {
    if (confirmed) {
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
      this.bird.play("pigeon-flap");
      gameEvents.emit("flap", {
        x: this.flight.x,
        y: this.flight.y,
        count: flaps,
      });
    }
    if (this.flight.selectedLane !== this.lane) {
      this.lane = this.flight.selectedLane;
      gameEvents.emit("lane_change", { lane: this.lane });
    }
    this.bird.setPosition(this.flight.x, this.flight.y);
    this.bird.setAngle(Phaser.Math.Clamp(this.flight.velocity / 25, -18, 20));
    this.cameras.main.scrollY = this.flight.cameraY;
  }

  private updateScore(): void {
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

  private updateHud(): void {
    gameUi.updateHud(
      this.flight.altitude,
      Math.max(this.previousBest, this.flight.altitude),
      this.hint,
      WORMS_ENABLED ? wormBalance.get() : null,
    );
  }

  private updateLevel(): void {
    const nextLevel = levelAt(this.flight.altitude);
    if (nextLevel.start !== this.level.start) {
      this.level = nextLevel;
      this.flight.velocity = Math.min(this.flight.velocity, -FLIGHT.impulse);
      gameUi.showWorld(nextLevel.id);
      gameEvents.emit("level_start", {
        level: nextLevel.id,
        altitude: this.flight.altitude,
      });
    }
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
    this.hazards.advance(this.flight.cameraY, {
      birdY: this.flight.y,
      suppressObstacles: this.enemies.items.length > 0,
      levelId: this.level.id,
    });
    const hazardResult = this.hazards.check(birdBox);
    this.drawHazards();
    if (hazardResult.hit) {
      this.finishRun(hazardResult.hit.kind);
      return false;
    }
    this.emitNearMisses(hazardResult.misses.length);
    this.announceCat();
    const enemyResult = this.enemies.check(birdBox);
    this.drawEnemies();
    if (enemyResult.hit) {
      this.finishRun(enemyResult.hit.kind);
      return false;
    }
    this.emitNearMisses(enemyResult.misses.length);
    return true;
  }

  /** Tells listeners (sound, voice) when a cat appears and when its paw comes down. */
  private announceCat(): void {
    const cat = this.enemies.items[0];
    if (cat && (this.catAge === null || cat.age < this.catAge)) {
      gameEvents.emit("cat_warning", { lane: cat.lane });
    }
    if (
      cat &&
      this.catAge !== null &&
      this.catAge < WARNING_SECONDS &&
      cat.age >= WARNING_SECONDS
    ) {
      gameEvents.emit("cat_strike", { lane: cat.lane });
    }
    this.catAge = cat?.age ?? null;
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
    this.reason = reason;
    bestScore.set(Math.max(bestScore.get(), this.flight.altitude));
    const duration = (this.time.now - this.started - this.pauseDuration) / 1000;
    gameEvents.emit("death", {
      altitude: this.flight.altitude,
      duration,
      reason,
      flapCount: this.runFlaps,
      flapRate: inputManager.getState().flapRate,
    });
    gameEvents.emit("run_end", { altitude: this.flight.altitude, duration });
    this.bird.stop().setTint(0xe4ad81);
    this.tweens.add({
      targets: this.bird,
      y: this.bird.y + 28,
      angle: 55,
      duration: 600,
    });
    this.time.delayedCall(600, () => this.showGameOver());
  }

  private confetti(): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    for (let i = 0; i < 24; i++) {
      const bit = this.add
        .rectangle(
          430 + i * 18,
          80,
          6,
          12,
          [0x739b77, 0xd4b163, 0xcf7963][i % 3],
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
    audio.play("gameOver");
    this.confirm = new MenuConfirm(inputManager.getState());
    cameraPanel.setMode("hidden");
    gameUi.showResults(
      {
        altitude: this.flight.altitude,
        best: bestScore.get(),
        flaps: this.runFlaps,
        newBest:
          Math.floor(this.flight.altitude) > Math.floor(this.previousBest),
        reason: this.reason,
      },
      this.level.id,
    );
  }

  private drawHazards(): void {
    this.hazardRenderer.draw(
      this.hazards.items,
      this.flight.cameraY,
      this.level.id,
    );
  }

  private drawEnemies(): void {
    if (this.enemies.items.length > 0) {
      this.hint = "Cat! Get out of its lane";
    }
    this.cat.draw(this.enemies.items, this.flight.cameraY);
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
    this.illustratedBackdrop.update(this.flight.cameraY, this.level.id);
    drawBackdrop(this.backdrop, this.flight.cameraY, this.level.id);
  }
}
