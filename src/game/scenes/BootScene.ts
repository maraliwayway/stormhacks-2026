import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';

export class BootScene extends Phaser.Scene {
  private badge!: Phaser.GameObjects.Text;
  private baseline = 0;
  private selectBaseline = 0;
  constructor() { super('Boot'); }

  create(): void {
    this.baseline = inputManager.getState().flapCount;
    this.selectBaseline = inputManager.getState().selectCount ?? 0;
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
    this.add.text(640, 450, 'Flap or press Enter to fly', {
      fontSize: '22px', color: '#fff4dc',
    }).setOrigin(0.5);
  }

  update(): void {
    const state = inputManager.getState();
    this.badge.setVisible(state === keyboard.getState());
    if (state.flapCount > this.baseline || state.select || (state.selectCount ?? 0) > this.selectBaseline) {
      this.scene.start('Game');
    }
  }
}
