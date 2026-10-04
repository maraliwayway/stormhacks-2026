import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import './style.css';
import { keyboard } from './input/defaultInput';
import { inputManager } from './input/inputManager';
import { installScoreSync } from './net/scoreSync';

void keyboard.start();
inputManager.setSource(keyboard);
const stopScoreSync = installScoreSync();

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
  scene: [BootScene, GameScene],
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => { stopScoreSync(); keyboard.stop(); game.destroy(true); });
}
