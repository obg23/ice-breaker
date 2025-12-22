import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // 로딩 화면 표시
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 모바일 감지
    const isMobile = this.sys.game.device.os.android ||
                     this.sys.game.device.os.iOS ||
                     this.sys.game.device.os.windowsPhone ||
                     width <= 768;

    // 모바일에 맞는 폰트 크기 설정
    const fontSize = isMobile ? (width <= 360 ? 18 : 20) : 24;
    const barWidth = isMobile ? Math.min(width - 80, 280) : 320;
    const barHeight = isMobile ? 40 : 50;

    const loadingText = this.add.text(width / 2, height / 2 - 50, '로딩 중...', {
      fontSize: `${fontSize}px`,
      fill: '#ffffff'
    });
    loadingText.setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - barWidth / 2, height / 2, barWidth, barHeight);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ffff, 1);
      const innerBarWidth = barWidth - 20;
      const innerBarHeight = barHeight - 20;
      progressBar.fillRect(width / 2 - innerBarWidth / 2, height / 2 + 10, innerBarWidth * value, innerBarHeight);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // 여기에 추후 에셋 로드 추가
    // this.load.image('ice-tile', 'assets/ice-tile.png');
    // this.load.audio('crack', 'assets/crack.mp3');
  }

  create() {
    this.scene.start('GameScene');
  }
}
