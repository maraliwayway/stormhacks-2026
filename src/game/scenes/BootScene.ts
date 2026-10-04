import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';
import { MenuConfirm } from '../menuConfirm';

export class BootScene extends Phaser.Scene {
  private badge!: Phaser.GameObjects.Text;
  private confirm!: MenuConfirm;
  private title!: Phaser.GameObjects.Text;
  private copy!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Text;
  private stage: 'menu' | 'controls' = 'menu';
  constructor() { super('Boot'); }

  create(): void {
    this.stage = 'menu';
    this.confirm = new MenuConfirm(inputManager.getState());
    this.cameras.main.setBackgroundColor('#183e46');
    this.title = this.add.text(640, 230, 'FLAPPY ARMS', {
      fontFamily: 'Arial, sans-serif', fontSize: '72px', color: '#fff4dc', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.copy = this.add.text(640, 340, 'Your arms are the controller.\nFly through the Kitchen and Dessert to Bird Heaven.', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#b7dbd7', align: 'center',
    }).setOrigin(0.5);
    this.badge = this.add.text(36, 32, 'KEYBOARD MODE', { fontSize: '16px', color: '#b7dbd7' });
    this.button = this.add.text(640, 480, 'START\nJump or press Enter', {
      fontSize: '26px', color: '#183e46', backgroundColor: '#ffd46b', align: 'center',
      padding: { x: 32, y: 18 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => this.advance());
  }

  private advance(): void {
    if (this.stage === 'controls') { this.scene.start('Game'); return; }
    this.stage = 'controls';
    this.title.setText('HOW TO FLY').setFontSize(60);
    this.copy.setText('Flap both arms to rise.\nLean left or right to change lane.\nJump to confirm. Squat is the down pose.\n\nKeyboard: Space to flap, arrows for poses.');
    this.button.setText('GOT IT!\nJump or press Enter');
  }

  update(): void {
    const state = inputManager.getState();
    this.badge.setVisible(state === keyboard.getState());
    if (this.confirm.read(state)) this.advance();
  }
}
