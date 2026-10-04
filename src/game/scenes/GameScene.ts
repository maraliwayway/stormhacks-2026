import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';
import { Flight, FLIGHT } from '../flight';
import { gameEvents } from '../events';
import { BIRD_BOX, HazardField } from '../hazards';
import { bestScore } from '../storage';
import { EnemyField, WARNING_SECONDS, STRIKE_SECONDS, RETREAT_SECONDS } from '../enemies';
import { installVfx } from '../vfx';
import { WormField, wormBalance } from '../worms';
import { MenuConfirm } from '../menuConfirm';
import { levelAt } from '../levels';
import { cameraPanel } from '../../input/cv/cameraPanel';

const WORMS_ENABLED = import.meta.env.VITE_ENABLE_WORMS === 'true';

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

  constructor() { super('Game'); }

  preload(): void {
    if (WORMS_ENABLED && !this.cache.audio.exists('worm-pickup')) {
      this.load.audio('worm-pickup', 'assets/worm-pickup.wav');
    }
  }

  create(): void {
    cameraPanel.setMode('mini');
    this.phase = 'playing';
    this.started = this.time.now;
    this.lastMilestone = 0;
    this.runFlaps = 0;
    this.previousBest = bestScore.get();
    this.bestAnnounced = false;
    this.slowUntil = 0;
    this.confirm = new MenuConfirm(inputManager.getState());
    this.level = levelAt(0);
    this.hazards = new HazardField();
    this.hazardArt = this.add.graphics().setDepth(5);
    this.enemies = new EnemyField();
    this.enemyArt = this.add.graphics().setDepth(6);
    this.worms = new WormField();
    this.wormArt = this.add.graphics().setDepth(8);
    const input = inputManager.getState();
    this.flight = new Flight(input.flapCount);
    this.flight.velocity = -FLIGHT.impulse;
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
    this.levelHud = this.add.text(640, 90, this.level.label, {
      fontSize: '20px', color: '#173e47', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);
    gameEvents.emit('level_start', { level: this.level.id, altitude: 0 });
    this.bestHud = this.add.text(1248, 172, `BEST ${Math.floor(this.previousBest)} m`, {
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
    this.wormHud = this.add.text(30, 60, `WORMS ${wormBalance.get()}`, {
      fontSize: '20px', color: '#173e47',
    }).setScrollFactor(0).setDepth(30).setVisible(WORMS_ENABLED);
    this.hint = this.add.text(640, 680, 'Tap Space to flap   •   Tap left / right to change lane', {
      fontSize: '20px', color: '#173e47', backgroundColor: '#fff1d5', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
    installVfx(this, this.bird, this.score, () => { this.slowUntil = this.time.now + 200; });
  }

  update(_time: number, delta: number): void {
    const input = inputManager.getState();
    this.badge.setVisible(input === keyboard.getState());
    const confirmed = this.confirm.read(input);
    if (this.phase === 'over') {
      if (confirmed) { this.scene.start('Boot'); return; }
      if (input.flapCount < this.overBaseline) this.overBaseline = input.flapCount;
      if (this.phase === 'over' && input.tracking && input.calibrated && input.flapCount > this.overBaseline) this.scene.restart();
      return;
    }
    if (this.phase !== 'playing') return;
    const dt = Math.min(delta, 50) / 1000 * (this.time.now < this.slowUntil ? 0.35 : 1);
    const flaps = this.flight.update(input, dt);
    this.runFlaps += flaps;
    if (input.tracking && input.calibrated) this.enemies.advanceGrace(Math.min(delta, 50) / 1000, flaps);
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
    this.hint.setText(!input.tracking || !input.calibrated
      ? 'Tracking paused. Return to the camera or use keyboard mode.'
      : input === keyboard.getState()
        ? 'Tap Space to flap   •   Tap left / right to change lane'
        : 'Flap both arms to rise   •   Tilt to change lane, then return upright');
    const nextLevel = levelAt(this.flight.altitude);
    if (nextLevel.start !== this.level.start) {
      this.level = nextLevel;
      this.levelHud.setText(nextLevel.label);
      this.flight.velocity = Math.min(this.flight.velocity, -FLIGHT.impulse);
      gameEvents.emit('level_start', { level: nextLevel.id, altitude: this.flight.altitude });
    }
    this.drawBackdrop();
    if (this.level.id === 'heaven') {
      // Consume Heaven's rows so they cannot reappear on returning to Kitchen.
      // Keep the same world, seed, run, and adaptive difficulty across every lap.
      this.hazards.advance(this.flight.cameraY);
      this.hazards.items = [];
      this.enemies.items = [];
      this.worms.items = [];
      this.hazardArt.clear();
      this.enemyArt.clear();
      this.wormArt.clear();
    } else if (input.tracking && input.calibrated) {
      const birdBox = { x: this.flight.x, y: this.flight.y, ...BIRD_BOX };
      this.enemies.tick(this.flight.altitude, this.flight.cameraY, Math.min(delta, 50) / 1000, undefined, birdBox);
      // A cat beat clears all map obstacles so only one threat is active.
      this.hazards.advance(this.flight.cameraY, this.enemies.items.length ? this.flight.y : undefined);
      const result = this.hazards.check({ x: this.flight.x, y: this.flight.y, ...BIRD_BOX });
      this.drawHazards();
      if (result.hit) { this.finishRun(result.hit.kind); return; }
      for (const _miss of result.misses) {
        gameEvents.emit('near_miss', { altitude: this.flight.altitude, x: this.flight.x, y: this.flight.y });
      }
      const enemyResult = this.enemies.check({ x: this.flight.x, y: this.flight.y, ...BIRD_BOX });
      this.drawEnemies();
      if (enemyResult.hit) { this.finishRun(enemyResult.hit.kind); return; }
      for (const _miss of enemyResult.misses) {
        gameEvents.emit('near_miss', { altitude: this.flight.altitude, x: this.flight.x, y: this.flight.y });
      }
      if (WORMS_ENABLED) this.updateWorms();
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
        [0x62bdb5, 0xf0b949, 0xe77b66][i % 3]).setScrollFactor(0).setDepth(45);
      this.tweens.add({ targets: bit, x: bit.x + (i - 12) * 14, y: 260 + (i % 4) * 30,
        angle: i * 40, alpha: 0, duration: 850, onComplete: () => bit.destroy() });
    }
  }

  private showGameOver(): void {
    this.phase = 'over';
    this.overBaseline = inputManager.getState().flapCount;
    this.confirm = new MenuConfirm(inputManager.getState());
    this.add.rectangle(640, 360, 1280, 720, 0x183e46, 0.5).setScrollFactor(0).setDepth(39);
    this.add.text(640, 320, `LEGENDARY FLOP\n${Math.floor(this.flight.altitude)} metres\n\nFlap to try again\n${this.confirmHint()} for main menu`, {
      fontSize: '36px', color: '#fff4dc', backgroundColor: '#183e46',
      align: 'center', padding: { x: 40, y: 30 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(40);
    this.menuButton();
  }

  private confirmHint(): string {
    return inputManager.getState() === keyboard.getState() ? 'Jump or Enter' : 'Wave one raised hand';
  }

  private menuButton(): void {
    this.add.text(640, 580, 'MAIN MENU', {
      fontSize: '24px', color: '#183e46', backgroundColor: '#ffd46b', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(41).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Boot'));
  }

  private drawHazards(): void {
    const g = this.hazardArt;
    g.clear();
    for (const h of this.hazards.items) {
      if (this.level.id === 'dessert') {
        g.fillStyle(h.kind === 'pot' ? 0xe77b96 : h.kind === 'knife' ? 0x8c5c49 : 0xeab75c)
          .fillRoundedRect(h.x - h.width / 2, h.y - h.height / 2, h.width, h.height, 14);
        g.lineStyle(4, 0x173e47).strokeRoundedRect(h.x - h.width / 2, h.y - h.height / 2, h.width, h.height, 14);
        g.fillStyle(0xfff2d6);
        for (let x = h.x - h.width / 2 + 12; x < h.x + h.width / 2; x += 28) g.fillCircle(x, h.y - 5, 5);
        continue;
      }
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
    if (this.enemies.items.length) this.hint.setText('CAT! Leave the marked lane and keep flapping');
    for (const e of this.enemies.items) {
      const warning = e.age < WARNING_SECONDS;
      const strike = e.age < WARNING_SECONDS + STRIKE_SECONDS;
      const top = this.flight.cameraY;
      const x = e.x;
      const y = top + e.faceOffset;
      const alpha = warning || strike ? 1 : Math.max(0, 1 -
        (e.age - WARNING_SECONDS - STRIKE_SECONDS) / RETREAT_SECONDS);
      g.fillStyle(warning ? 0xffd46b : 0xe77b66, warning ? 0.18 : 0.28 * alpha)
        .fillRect(x - 130, top, 260, FLIGHT.height);
      g.lineStyle(4, warning ? 0xb7782e : 0xba5a55, alpha);
      g.lineBetween(x - 130, top, x - 130, top + FLIGHT.height);
      g.lineBetween(x + 130, top, x + 130, top + FLIGHT.height);
      if (warning) {
        // Face and ears disappear completely when the paw arrives.
        g.fillStyle(0xd79b61).fillTriangle(x - 70, y - 20, x - 68, y - 95, x - 20, y - 48)
          .fillTriangle(x + 70, y - 20, x + 68, y - 95, x + 20, y - 48);
        g.fillEllipse(x, y, 150, 120);
        g.lineStyle(4, 0x173e47).strokeEllipse(x, y, 150, 120);
        g.fillStyle(0xf8d3ba).fillTriangle(x - 58, y - 47, x - 58, y - 77, x - 34, y - 49)
          .fillTriangle(x + 58, y - 47, x + 58, y - 77, x + 34, y - 49);
        g.fillStyle(0xfff3db).fillEllipse(x - 27, y - 12, 30, 36).fillEllipse(x + 27, y - 12, 30, 36);
        g.fillStyle(0x173e47).fillEllipse(x - 27, y - 12, 8, 26).fillEllipse(x + 27, y - 12, 8, 26);
        g.fillStyle(0xba5a55).fillTriangle(x - 9, y + 12, x + 9, y + 12, x, y + 23);
        g.lineStyle(3, 0x173e47).lineBetween(x, y + 23, x, y + 32);
        for (const side of [-1, 1]) {
          g.lineBetween(x + side * 35, y + 18, x + side * 85, y + 8);
          g.lineBetween(x + side * 35, y + 29, x + side * 85, y + 35);
        }
        // The ring fills during the full warning period.
        g.lineStyle(6, 0xb7782e).beginPath().arc(x, y, 90, -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * Math.min(1, e.age / WARNING_SECONDS), false).strokePath();
      } else {
        g.fillStyle(0xd79b61, alpha).fillRoundedRect(x - 48, top - 40, 96, e.faceOffset + 40, 25);
        g.fillEllipse(x, y + 12, 172, 140);
        for (const dx of [-60, -20, 20, 60]) g.fillEllipse(x + dx, y - 48, 45, 60);
        g.lineStyle(4, 0x173e47, alpha).strokeEllipse(x, y + 12, 172, 140);
        g.fillStyle(0xe6a6a0, alpha).fillEllipse(x, y + 26, 80, 60);
        for (const dx of [-60, -20, 20, 60]) g.fillEllipse(x + dx, y - 45, 22, 28);
      }
    }
  }

  private updateWorms(): void {
    this.worms.advance(this.hazards.items, this.flight.cameraY);
    for (const worm of this.worms.collect({ x: this.flight.x, y: this.flight.y, ...BIRD_BOX })) {
      wormBalance.set(wormBalance.get() + 1);
      gameEvents.emit('pickup', { x: worm.x, y: worm.y, total: wormBalance.get() });
      if (this.cache.audio.exists('worm-pickup')) this.sound.play('worm-pickup', { volume: 0.25 });
      const pop = this.add.text(worm.x, worm.y, '+1', { fontSize: '28px', color: '#9b3862', fontStyle: 'bold' }).setDepth(20);
      this.tweens.add({ targets: pop, y: worm.y - 60, alpha: 0, duration: 450, onComplete: () => pop.destroy() });
    }
    this.wormHud.setText(`WORMS ${wormBalance.get()}`);
    const g = this.wormArt;
    g.clear();
    for (const w of this.worms.items) {
      g.lineStyle(10, 0xd77496).beginPath().moveTo(w.x - 15, w.y + 4)
        .lineTo(w.x - 5, w.y - 5).lineTo(w.x + 6, w.y + 5).lineTo(w.x + 16, w.y - 4).strokePath();
      g.fillStyle(0x173e47).fillCircle(w.x + 16, w.y - 6, 2);
    }
  }

  private drawBackdrop(): void {
    const g = this.backdrop;
    g.clear();
    if (this.level.id === 'heaven') {
      this.cameras.main.setBackgroundColor('#dceefa');
      g.fillStyle(0xc6e4f4).fillRect(70, 0, 1140, 720);
      // A golden halo and layered clouds make Heaven a playable sky map.
      g.fillStyle(0xfff3c9, 0.65).fillCircle(1010, 160, 100);
      g.lineStyle(5, 0xe7bd67, 0.8).strokeEllipse(1010, 160, 140, 46);
      for (let layer = 0; layer < 2; layer++) {
        const offset = ((-this.flight.cameraY * (0.2 + layer * 0.15)) % 260 + 260) % 260;
        for (let row = -1; row < 4; row++) {
          const y = row * 260 + offset;
          for (let col = 0; col < 3; col++) {
            const x = 220 + col * 370 + (row % 2) * 60;
            g.fillStyle(0xffffff, layer === 0 ? 0.45 : 0.9)
              .fillEllipse(x, y + layer * 65, 210, 52)
              .fillCircle(x - 45, y + layer * 65 - 18, 34)
              .fillCircle(x + 10, y + layer * 65 - 30, 46)
              .fillCircle(x + 65, y + layer * 65 - 12, 30);
          }
        }
      }
      g.lineStyle(2, 0xe7bd67, 0.7);
      for (let i = 0; i < 9; i++) {
        const x = 150 + i * 120;
        const y = ((i * 83 - this.flight.cameraY * 0.1) % 650 + 650) % 650 + 30;
        g.lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5);
      }
      return;
    }
    this.cameras.main.setBackgroundColor('#f5dfb5');
    g.fillStyle(this.level.id === 'dessert' ? 0xf7c4d5 : 0xe7c99b).fillRect(70, 0, 1140, 720);
    g.lineStyle(2, this.level.id === 'dessert' ? 0xda86a5 : 0xdbc08f, 0.6);
    for (let x = 100; x < 1280; x += 120) g.lineBetween(x, 0, x, 720);
    const offset = ((-this.flight.cameraY * 0.5) % 240 + 240) % 240;
    for (let y = offset - 240; y < 720; y += 240) {
      g.lineBetween(70, y, 1210, y);
      g.fillStyle(this.level.id === 'dessert' ? 0xb97596 : 0xc29664).fillRoundedRect(100, y + 150, 1080, 18, 6);
    }
    g.fillStyle(0x183e46, 0.06);
    for (const x of FLIGHT.lanes) g.fillRect(x - 2, 0, 4, 720);
  }
}
