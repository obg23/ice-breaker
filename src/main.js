import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import ResultScene from './scenes/ResultScene.js';

const BASE_WIDTH = 720;
const BASE_HEIGHT = 1280;
const USE_ENVELOP_SCALE = false;

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scene: [BootScene, GameScene, ResultScene],
  scale: {
    // FIT keeps the entire game visible without cropping while maintaining aspect ratio
    mode: USE_ENVELOP_SCALE ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT
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

const handleResize = () => {
  game.scale.resize(BASE_WIDTH, BASE_HEIGHT);
  game.scale.refresh();
};

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);
