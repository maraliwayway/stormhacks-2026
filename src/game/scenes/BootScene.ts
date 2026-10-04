import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';

export class BootScene extends Phaser.Scene {
  private badge!: Phaser.GameObjects.Text;
  constructor() { super('Boot'); }

  create(): void {
    this.add.text(640, 280, 'FLAPPY ARMS', {
      fontFamily: 'Arial, sans-serif', fontSize: '72px', color: '#fff4dc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 370, 'Your arms are the controller.', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#b7dbd7',
    }).setOrigin(0.5);
    this.badge = this.add.text(36, 32, 'KEYBOARD MODE', {
      fontSize: '16px', color: '#b7dbd7',
    });
    this.add.text(640, 450, 'Space: flap   •   Arrows: move   •   Enter: select', {
      fontSize: '22px', color: '#fff4dc',
    }).setOrigin(0.5);
  }

  update(): void {
    this.badge.setVisible(inputManager.getState() === keyboard.getState());
  }
}
