import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    this.add.text(640, 280, 'FLAPPY ARMS', {
      fontFamily: 'Arial, sans-serif', fontSize: '72px', color: '#fff4dc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(640, 370, 'Your arms are the controller.', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#b7dbd7',
    }).setOrigin(0.5);
  }
}
