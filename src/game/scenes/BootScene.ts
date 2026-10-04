import Phaser from 'phaser';
import { inputManager } from '../../input/inputManager';
import { keyboard } from '../../input/defaultInput';
import { MenuConfirm } from '../menuConfirm';
import { cameraPanel } from '../../input/cv/cameraPanel';

export class BootScene extends Phaser.Scene {
  private badge!: Phaser.GameObjects.Text;
  private confirm!: MenuConfirm;
  private title!: Phaser.GameObjects.Text;
  private copy!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Text;
  private stage: 'menu' | 'controls' = 'menu';
  constructor() { super('Boot'); }

  create(): void {
    cameraPanel.setMode('large');
    this.stage = 'menu';
    this.confirm = new MenuConfirm(inputManager.getState());
    this.cameras.main.setBackgroundColor('#183e46');
    this.title = this.add.text(640, 230, 'FLAPPY ARMS', {
      fontFamily: 'Arial, sans-serif', fontSize: '72px', color: '#fff4dc', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.copy = this.add.text(640, 340, 'Your arms are the controller.\nKitchen, Dessert, Bird Heaven. Keep flying as the world loops.', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', color: '#b7dbd7', align: 'center',
    }).setOrigin(0.5);
    this.badge = this.add.text(36, 32, 'KEYBOARD MODE', { fontSize: '16px', color: '#b7dbd7' });
    this.button = this.add.text(640, 480, this.buttonText('START'), {
      fontSize: '26px', color: '#183e46', backgroundColor: '#ffd46b', align: 'center',
      padding: { x: 32, y: 18 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => this.advance());
  }

  private advance(): void {
    if (this.stage === 'controls') { this.scene.start('Game'); return; }
    this.stage = 'controls';
    this.title.setText('HOW TO FLY').setFontSize(60);
    this.copy.setText(this.cameraMode()
      ? 'Flap both arms to rise. The faster you flap, the higher you go.\nStop flapping and you sink slowly.\nTilt left or right to shift one lane.\nReturn upright before tilting again.\n\nSwipe your right arm to confirm.'
      : 'Flap both arms to rise.\nTilt to shift one lane, then return upright.\nJump to confirm. Squat is the down pose.\n\nKeyboard: Space to flap, tap left/right to shift lanes.');
    this.button.setText(this.buttonText('GOT IT!'));
  }

  private cameraMode(): boolean {
    return inputManager.getState() !== keyboard.getState();
  }

  private buttonText(label: string): string {
    if (!this.cameraMode()) return `${label}\nJump or press Enter`;
    return inputManager.getState().calibrated
      ? `${label}\nSwipe your right arm left to right`
      : 'Stand in the box\nto calibrate';
  }

  update(): void {
    const state = inputManager.getState();
    this.badge.setVisible(state === keyboard.getState());
    this.button.setText(this.buttonText(this.stage === 'menu' ? 'START' : 'GOT IT!'));
    if (this.confirm.read(state)) this.advance();
  }
}
