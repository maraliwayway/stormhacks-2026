import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';
import { Flight, FLIGHT } from '../flight';
import { gameEvents } from '../events';
import { BIRD_BOX, HazardField } from '../hazards';
import { bestScore } from '../storage';
import { EnemyField, WARNING_SECONDS } from '../enemies';

export class GameScene extends Phaser.Scene {
  protected flight!: Flight;
  protected bird!: Phaser.GameObjects.Image;
  protected score!: Phaser.GameObjects.Text;
  protected backdrop!: Phaser.GameObjects.Graphics;
  protected badge!: Phaser.GameObjects.Text;
  protected hint!: Phaser.GameObjects.Text;
  protected started = 0;
  protected phase: 'playing' | 'dying' | 'over' = 'playing';
  private lastMilestone = 0;
  protected hazards!: HazardField;
  protected hazardArt!: Phaser.GameObjects.Graphics;
  protected enemies!: EnemyField;
  private enemyArt!: Phaser.GameObjects.Graphics;
  private runFlaps = 0;
  private overBaseline = 0;
  private overSelectCount = 0;
  private selectHeld = false;
  private previousBest = 0;
  private bestAnnounced = false;
  private bestHud!: Phaser.GameObjects.Text;

  constructor() { super('Game'); }

  create(): void {
    this.phase = 'playing';
    this.started = this.time.now;
    this.lastMilestone = 0;
    this.runFlaps = 0;
    this.previousBest = bestScore.get();
    this.bestAnnounced = false;
    this.selectHeld = Boolean(inputManager.getState().select);
    this.hazards = new HazardField();
    this.hazardArt = this.add.graphics().setDepth(5);
    this.enemies = new EnemyField();
    this.enemyArt = this.add.graphics().setDepth(6);
    const input = inputManager.getState();
    this.flight = new Flight(input.flapCount);
    this.flight.velocity = -200;
    this.cameras.main.setBackgroundColor('#f5dfb5');
    this.cameras.main.setScroll(0, 0);
    this.backdrop = this.add.graphics().setScrollFactor(0).setDepth(-10);
    if (!this.textures.exists('bird')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x143d48).fillEllipse(48, 39, 82, 62);
      g.fillStyle(0x69c8c1).fillEllipse(46, 34, 74, 55);
      g.fillStyle(0xfff2d6).fillEllipse(53, 42, 44, 36);
      g.fillStyle(0xeeb856).fillTriangle(78, 26, 96, 36, 78, 45);
      g.fillStyle(0x153d46).fillCircle(66, 25, 5);
      g.fillStyle(0x3a9299).fillEllipse(29, 37, 34, 20);
      g.generateTexture('bird', 96, 72);
      g.destroy();
    }
    this.bird = this.add.image(this.flight.x, this.flight.y, 'bird').setDepth(10);
    this.score = this.add.text(640, 32, '0 m', {
      fontSize: '44px', fontStyle: 'bold', color: '#173e47',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);
    this.bestHud = this.add.text(1248, 32, `BEST ${Math.floor(this.previousBest)} m`, {
      fontSize: '24px', color: '#173e47', fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
    if (this.previousBest > 0) {
      const y = FLIGHT.startY - this.previousBest * FLIGHT.pixelsPerMetre;
      const marker = this.add.graphics().setDepth(2).lineStyle(3, 0x278b87);
      for (let x = 90; x < 1200; x += 40) marker.lineBetween(x, y, x + 22, y);
      this.add.text(90, y - 30, 'BEST', { fontSize: '18px', color: '#237c79' }).setDepth(3);
    }
    this.badge = this.add.text(30, 30, 'KEYBOARD MODE', {
      fontSize: '16px', color: '#173e47',
    }).setScrollFactor(0).setDepth(30);
    this.hint = this.add.text(640, 680, 'Tap Space to flap   •   Left / right to change lane', {
      fontSize: '20px', color: '#173e47', backgroundColor: '#fff1d5', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
  }

  update(_time: number, delta: number): void {
    const input = inputManager.getState();
    this.badge.setVisible(input === keyboard.getState());
    const selected = Boolean(input.select) && !this.selectHeld;
    this.selectHeld = Boolean(input.select);
    if (this.phase === 'over') {
      if (input.flapCount < this.overBaseline) this.overBaseline = input.flapCount;
      const confirmations = input.selectCount ?? 0;
      if (confirmations < this.overSelectCount) this.overSelectCount = confirmations;
      if (input.flapCount > this.overBaseline || selected || confirmations > this.overSelectCount) this.scene.restart();
      return;
    }
    if (this.phase !== 'playing') return;
    const dt = Math.min(delta, 50) / 1000;
    const flaps = this.flight.update(input, dt);
    this.runFlaps += flaps;
    if (flaps > 0) gameEvents.emit('flap', { x: this.flight.x, y: this.flight.y, count: flaps });
    this.bird.setPosition(this.flight.x, this.flight.y);
    this.bird.setAngle(Phaser.Math.Clamp(this.flight.velocity / 25, -18, 20));
    this.cameras.main.scrollY = this.flight.cameraY;
    this.score.setText(`${Math.floor(this.flight.altitude)} m`);
    this.bestHud.setText(`BEST ${Math.floor(Math.max(this.previousBest, this.flight.altitude))} m`);
    if (!this.bestAnnounced && this.flight.altitude > this.previousBest + 0.1) {
      this.bestAnnounced = true;
      gameEvents.emit('new_best', { altitude: this.flight.altitude, previousBest: this.previousBest });
      this.confetti();
    }
    const milestone = Math.floor(this.flight.altitude / 25) * 25;
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      gameEvents.emit('milestone', { altitude: milestone });
    }
    this.hint.setText(input.tracking && input.calibrated
      ? 'Tap Space to flap   •   Left / right to change lane'
      : 'Tracking paused. Return to the camera or use keyboard mode.');
    this.drawBackdrop();
    if (input.tracking && input.calibrated) {
      this.hazards.advance(this.flight.cameraY);
      const result = this.hazards.check({ x: this.flight.x, y: this.flight.y, ...BIRD_BOX });
      this.drawHazards();
      if (result.hit) { this.finishRun(result.hit.kind); return; }
      for (const _miss of result.misses) {
        gameEvents.emit('near_miss', { altitude: this.flight.altitude, x: this.flight.x, y: this.flight.y });
      }
      this.enemies.tick(this.flight.altitude, this.flight.cameraY, dt);
      const enemyResult = this.enemies.check({ x: this.flight.x, y: this.flight.y, ...BIRD_BOX });
      this.drawEnemies();
      if (enemyResult.hit) { this.finishRun(enemyResult.hit.kind); return; }
      for (const _miss of enemyResult.misses) {
        gameEvents.emit('near_miss', { altitude: this.flight.altitude, x: this.flight.x, y: this.flight.y });
      }
    }
    if (this.flight.offscreen) this.finishRun('fall');
  }

  protected finishRun(reason: string): void {
    if (this.phase !== 'playing') return;
    this.phase = 'dying';
    bestScore.set(Math.max(bestScore.get(), this.flight.altitude));
    const duration = (this.time.now - this.started) / 1000;
    gameEvents.emit('death', {
      altitude: this.flight.altitude, duration, reason,
      flapCount: this.runFlaps, flapRate: inputManager.getState().flapRate,
    });
    gameEvents.emit('run_end', { altitude: this.flight.altitude, duration });
    this.bird.setTint(0xe87356);
    this.tweens.add({ targets: this.bird, y: this.bird.y + 28, angle: 90, duration: 600 });
    this.time.delayedCall(600, () => this.showGameOver());
  }

  private confetti(): void {
    for (let i = 0; i < 24; i++) {
      const bit = this.add.rectangle(430 + i * 18, 80, 8, 16,
        [0x62bdb5, 0xf0b949, 0xe77b66][i % 3]).setScrollFactor(0).setDepth(35);
      this.tweens.add({ targets: bit, x: bit.x + (i - 12) * 14, y: 260 + (i % 4) * 30,
        angle: i * 40, alpha: 0, duration: 850, onComplete: () => bit.destroy() });
    }
  }

  private showGameOver(): void {
    this.phase = 'over';
    this.overBaseline = inputManager.getState().flapCount;
    this.overSelectCount = inputManager.getState().selectCount ?? 0;
    this.selectHeld = Boolean(inputManager.getState().select);
    this.add.rectangle(640, 360, 1280, 720, 0x183e46, 0.5).setScrollFactor(0).setDepth(39);
    this.add.text(640, 320, `LEGENDARY FLOP\n${Math.floor(this.flight.altitude)} metres\n\nFlap or press Enter to try again`, {
      fontSize: '36px', color: '#fff4dc', backgroundColor: '#183e46',
      align: 'center', padding: { x: 40, y: 30 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(40);
  }

  private drawHazards(): void {
    const g = this.hazardArt;
    g.clear();
    for (const h of this.hazards.items) {
      const left = h.x - h.width / 2;
      const top = h.y - h.height / 2;
      g.fillStyle(h.kind === 'knife' ? 0x7893a0 : h.kind === 'pin' ? 0xb17148 : 0x517783);
      g.fillRoundedRect(left, top, h.width, h.height, h.kind === 'knife' ? 4 : 14);
      g.lineStyle(4, 0x173e47).strokeRoundedRect(left, top, h.width, h.height, 8);
      if (h.kind === 'pot') {
        g.strokeRect(left - 10, top + 18, 10, 15);
        g.strokeRect(left + h.width, top + 18, 10, 15);
        g.lineBetween(left - 5, top, left + h.width + 5, top);
      } else if (h.kind === 'knife') {
        g.fillStyle(0x173e47).fillRect(left, top, h.width * 0.3, h.height);
      } else {
        g.fillStyle(0x825738).fillRect(left - 18, h.y - 8, 18, 16);
        g.fillRect(left + h.width, h.y - 8, 18, 16);
      }
    }
  }

  private drawEnemies(): void {
    const g = this.enemyArt;
    g.clear();
    for (const e of this.enemies.items) {
      const warning = e.age < WARNING_SECONDS;
      g.fillStyle(warning ? 0xffd46b : e.kind === 'diver' ? 0xba5a55 : 0x965477, warning ? 0.65 : 1);
      g.fillEllipse(e.x, e.y, e.width, e.height);
      g.fillStyle(0xfff3db).fillCircle(e.x - 14, e.y - 6, 10).fillCircle(e.x + 14, e.y - 6, 10);
      g.fillStyle(0x193c45).fillCircle(e.x - 14, e.y - 4, 4).fillCircle(e.x + 14, e.y - 4, 4);
      if (warning) {
        g.lineStyle(3, 0xb7782e, 0.7).strokeCircle(e.x, e.y, 58);
        g.lineBetween(e.x, e.y - 94, e.x, e.y - 76);
        g.fillStyle(0xb7782e).fillCircle(e.x, e.y - 68, 3);
      }
    }
  }

  private drawBackdrop(): void {
    const g = this.backdrop;
    g.clear();
    g.fillStyle(0xe7c99b).fillRect(70, 0, 1140, 720);
    g.lineStyle(2, 0xdbc08f, 0.6);
    for (let x = 100; x < 1280; x += 120) g.lineBetween(x, 0, x, 720);
    const offset = ((-this.flight.cameraY * 0.5) % 240 + 240) % 240;
    for (let y = offset - 240; y < 720; y += 240) {
      g.lineBetween(70, y, 1210, y);
      g.fillStyle(0xc29664).fillRoundedRect(100, y + 150, 1080, 18, 6);
    }
    g.fillStyle(0x183e46, 0.06);
    for (const x of FLIGHT.lanes) g.fillRect(x - 2, 0, 4, 720);
  }
}
