import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import './style.css';

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#183e46',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [BootScene],
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
