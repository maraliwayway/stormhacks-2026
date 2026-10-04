import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';
import { Flight, FLIGHT } from '../flight';
import { gameEvents } from '../events';

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

  constructor() { super('Game'); }

  create(): void {
    this.phase = 'playing';
    this.started = this.time.now;
    this.lastMilestone = 0;
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
    if (this.phase !== 'playing') return;
    const dt = Math.min(delta, 50) / 1000;
    const flaps = this.flight.update(input, dt);
    if (flaps > 0) gameEvents.emit('flap', { x: this.flight.x, y: this.flight.y, count: flaps });
    this.bird.setPosition(this.flight.x, this.flight.y);
    this.bird.setAngle(Phaser.Math.Clamp(this.flight.velocity / 25, -18, 20));
    this.cameras.main.scrollY = this.flight.cameraY;
    this.score.setText(`${Math.floor(this.flight.altitude)} m`);
    const milestone = Math.floor(this.flight.altitude / 25) * 25;
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      gameEvents.emit('milestone', { altitude: milestone });
    }
    this.hint.setText(input.tracking && input.calibrated
      ? 'Tap Space to flap   •   Left / right to change lane'
      : 'Tracking paused. Return to the camera or use keyboard mode.');
    this.drawBackdrop();
    if (this.flight.offscreen) this.finishRun('fall');
  }

  protected finishRun(_reason: string): void {
    if (this.phase !== 'playing') return;
    this.phase = 'over';
    this.add.text(640, 320, 'FLIGHT OVER\nPress Enter or flap to restart', {
      fontSize: '36px', color: '#fff4dc', backgroundColor: '#183e46',
      align: 'center', padding: { x: 40, y: 30 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(40);
    const baseline = inputManager.getState().flapCount;
    const restart = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      const input = inputManager.getState();
      if (input.flapCount > baseline || input.select) { restart.remove(); this.scene.restart(); }
    } });
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
