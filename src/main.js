import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import ResultScene from './scenes/ResultScene.js';

// 모바일 감지
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

// 화면 크기에 따른 게임 크기 설정
const gameWidth = isMobile ? Math.min(window.innerWidth, 480) : 800;
const gameHeight = isMobile ? Math.min(window.innerHeight, 800) : 600;

const config = {
  type: Phaser.AUTO,
  width: gameWidth,
  height: gameHeight,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scene: [BootScene, GameScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: gameWidth,
    height: gameHeight
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  // 모바일 최적화 설정
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    transparent: false
  },
  // 터치 입력 최적화
  input: {
    activePointers: 3,
    smoothFactor: 0.2
  }
};

const game = new Phaser.Game(config);
