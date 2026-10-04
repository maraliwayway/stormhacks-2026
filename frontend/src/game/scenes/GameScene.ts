// Owner: Dev 2. Tickets: "Core vertical scroller", "Hazard spawner, collisions, death + instant restart".
// Minimal playable loop: flap to climb, strafe between 3 lanes, dodge hazards, fall = death.

import Phaser from "phaser";
import { EventBus } from "../../shared/EventBus";
import { InputState } from "../../shared/InputState";
import type { LevelId } from "../../shared/events";
import { HEIGHT, PHYSICS, SCORING, WIDTH } from "../config";
import { LEVELS } from "../levels";
import { Difficulty } from "../systems/Difficulty";
import { loadBest, saveBest } from "../storage";

export class GameScene extends Phaser.Scene {
  private level!: LevelId;
  private bird!: Phaser.Physics.Arcade.Sprite;
  private hazards!: Phaser.Physics.Arcade.Group;
  private difficulty = new Difficulty();
  private altitudeText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private startY = 0;
  private maxAltitude = 0;
  private best = 0;
  private startedAt = 0;
  private nextSpawnAt = 0;
  private nextMilestone = SCORING.milestoneEveryM;
  private peakFlapRate = 0;
  private nearMisses = 0;
  private dead = false;
  private beatBest = false;
  private unsubscribe?: () => void;

  constructor() {
    super("Game");
  }

  init(data: { level: LevelId }): void {
    this.level = data.level ?? "kitchen";
    this.dead = false;
    this.beatBest = false;
    this.maxAltitude = 0;
    this.peakFlapRate = 0;
    this.nearMisses = 0;
    this.nextMilestone = SCORING.milestoneEveryM;
    this.difficulty.reset();
  }

  create(): void {
    const cfg = LEVELS[this.level];
    this.cameras.main.setBackgroundColor(cfg.palette.sky);
    this.best = loadBest(this.level);

    this.startY = HEIGHT - 150;
    this.bird = this.physics.add.sprite(PHYSICS.laneX[1], this.startY, "bird");
    this.bird.setGravityY(PHYSICS.gravity).setMaxVelocity(0, PHYSICS.maxFallSpeed);
    this.bird.body!.setSize(this.bird.width * PHYSICS.hitboxScale, this.bird.height * PHYSICS.hitboxScale);

    this.hazards = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.bird, this.hazards, (_b, h) => this.die((h as Phaser.GameObjects.Sprite).texture.key));

    this.altitudeText = this.add.text(WIDTH / 2, 30, "0 m", { fontSize: "48px", color: "#222", fontStyle: "bold" }).setOrigin(0.5, 0).setScrollFactor(0);
    this.bestText = this.add.text(WIDTH - 24, 30, `BEST ${this.best} m`, { fontSize: "28px", color: "#222" }).setOrigin(1, 0).setScrollFactor(0);
    // TODO(Dev 2): dashed BEST ghost line in world space at the best altitude.
    // TODO(Dev 2): "keyboard mode" badge when InputState.source === "keyboard".

    this.unsubscribe = InputState.on((g) => {
      if (this.dead) return;
      if (g === "flap") {
        this.bird.setVelocityY(PHYSICS.flapImpulse);
        EventBus.emit({ type: "flap" });
        // TODO(Dev 2): feather burst + squash and stretch (juice pass).
      }
    });
    this.events.once("shutdown", () => this.unsubscribe?.());

    this.startedAt = this.time.now;
    this.nextSpawnAt = this.time.now + 1200;
    EventBus.emit({ type: "run_start", level: this.level });
  }

  update(time: number): void {
    if (this.dead) return;

    // Lane movement: eased towards target lane x.
    const targetX = PHYSICS.laneX[InputState.lane + 1];
    this.bird.x += (targetX - this.bird.x) * PHYSICS.laneLerp;

    // Camera follows upward only.
    const cam = this.cameras.main;
    const desiredScrollY = this.bird.y - HEIGHT * 0.55;
    if (desiredScrollY < cam.scrollY) cam.scrollY = desiredScrollY;

    // Score.
    const altitude = Math.max(0, Math.round((this.startY - this.bird.y) / SCORING.pxPerMetre));
    if (altitude > this.maxAltitude) {
      this.maxAltitude = altitude;
      this.altitudeText.setText(`${altitude} m`);
      if (!this.beatBest && this.best > 0 && altitude > this.best) {
        this.beatBest = true;
        EventBus.emit({ type: "new_best", altitude });
      }
      if (altitude >= this.nextMilestone) {
        EventBus.emit({ type: "milestone", altitude: this.nextMilestone });
        this.nextMilestone += SCORING.milestoneEveryM;
      }
    }
    this.peakFlapRate = Math.max(this.peakFlapRate, InputState.flapRate);

    // Difficulty + spawning.
    const params = this.difficulty.update((time - this.startedAt) / 1000, time);
    if (time >= this.nextSpawnAt) {
      this.spawnRow(params.gapWidth, params.hazardSpeed);
      this.nextSpawnAt = time + params.spawnIntervalMs;
    }
    this.hazards.getChildren().forEach((h) => {
      const s = h as Phaser.Physics.Arcade.Sprite;
      if (s.y > cam.scrollY + HEIGHT + 200) s.destroy();
    });
    // TODO(Dev 2): detect near misses (hazard passes within ~40 px) -> this.nearMisses++ and emit near_miss.

    // Fell below the screen.
    if (this.bird.y > cam.scrollY + HEIGHT + 40) this.die("fell");
  }

  /** Spawns hazards in every lane except `gap` free lanes. TODO(Dev 2): pattern table + enemy behaviours. */
  private spawnRow(gapWidth: number, speed: number): void {
    const hazards = LEVELS[this.level].hazards;
    const lanes = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(gapWidth);
    const y = this.cameras.main.scrollY - 80;
    for (const lane of lanes) {
      const key = Phaser.Utils.Array.GetRandom(hazards);
      const h = this.hazards.create(PHYSICS.laneX[lane], y, key) as Phaser.Physics.Arcade.Sprite;
      h.setVelocityY(speed);
      h.body!.setSize(h.width * PHYSICS.hitboxScale, h.height * PHYSICS.hitboxScale);
    }
  }

  private die(cause: string): void {
    if (this.dead) return;
    this.dead = true;
    this.physics.pause();
    this.cameras.main.shake(250, 0.01);

    const newBest = Math.max(this.best, this.maxAltitude);
    saveBest(this.level, newBest);
    const stats = {
      level: this.level,
      altitude: this.maxAltitude,
      best: newBest,
      durationS: Math.round((this.time.now - this.startedAt) / 100) / 10,
      peakFlapRate: Math.round(this.peakFlapRate * 10) / 10,
      nearMisses: this.nearMisses,
      causeOfDeath: cause,
    };
    EventBus.emit({ type: "death", stats });
    this.time.delayedCall(600, () => this.scene.start("GameOver", { stats }));
  }
}
