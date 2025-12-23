import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import ResultScene from './scenes/ResultScene.js';

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scene: [BootScene, GameScene, ResultScene],
  scale: {
    // ENVELOP fills the screen aggressively (edges may be cropped on extreme aspect ratios)
    mode: Phaser.Scale.ENVELOP,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600
    // Alternative: use FIT for no cropping at the expense of potential letterboxing
    // mode: Phaser.Scale.FIT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    transparent: false
  },
  input: {
    activePointers: 3,
    smoothFactor: 0.2
  }
};

// eslint-disable-next-line no-unused-vars
const game = new Phaser.Game(config);
