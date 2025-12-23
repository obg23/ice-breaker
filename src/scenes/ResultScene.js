import Phaser from 'phaser';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data) {
    this.finalScore = data.score || 0;
    this.isTouch = this.sys.game.device.input.touch;
  }

  create() {
    const { width, height } = this.scale.gameSize;

    // 배경
    this.background = this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

    // 게임 오버 텍스트
    this.titleText = this.add.text(width / 2, height / 3, '게임 종료!', {
      fontSize: '48px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 최종 점수
    this.scoreText = this.add.text(width / 2, height / 2 - 20, `최종 점수: ${this.finalScore}`, {
      fontSize: '32px',
      fill: '#00ffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 최고 점수 (로컬 스토리지 사용)
    const highScore = this.getHighScore();
    if (this.finalScore > highScore) {
      this.saveHighScore(this.finalScore);
      this.newRecordText = this.add.text(width / 2, height / 2 + 30, '🎉 신기록! 🎉', {
        fontSize: '24px',
        fill: '#ffff00',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    this.highScoreText = this.add.text(width / 2, height / 2 + 70, `최고 점수: ${Math.max(highScore, this.finalScore)}`, {
      fontSize: '24px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // 재시작 버튼 (모바일에서 더 큰 터치 영역)
    this.restartButton = this.add.text(width / 2, height * 2 / 3, '다시 시작', {
      fontSize: '28px',
      fill: '#ffffff',
      backgroundColor: '#4a90e2',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    this.restartButton.setInteractive();
    this.restartButton.on('pointerover', () => {
      this.restartButton.setStyle({ backgroundColor: '#357abd' });
    });
    this.restartButton.on('pointerout', () => {
      this.restartButton.setStyle({ backgroundColor: '#4a90e2' });
    });
    this.restartButton.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    this.onResize(this.scale.gameSize);
    this.scale.on('resize', this.onResize, this);
    this.events.on('shutdown', this.onShutdown, this);
  }

  getHighScore() {
    const saved = localStorage.getItem('ice-breaker-highscore');
    return saved ? parseInt(saved, 10) : 0;
  }

  saveHighScore(score) {
    localStorage.setItem('ice-breaker-highscore', score.toString());
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    const isSmall = width <= 480;
    const titleFontSize = isSmall ? (width <= 360 ? 32 : 36) : 48;
    const scoreFontSize = isSmall ? (width <= 360 ? 22 : 24) : 32;
    const normalFontSize = isSmall ? (width <= 360 ? 18 : 20) : 24;
    const buttonFontSize = isSmall ? (width <= 360 ? 20 : 24) : 28;
    const buttonPadding = this.isTouch ? { x: 30, y: 15 } : { x: 20, y: 10 };

    if (this.background) {
      this.background.setSize(width, height);
    }

    this.titleText.setFontSize(titleFontSize);
    this.titleText.setPosition(width / 2, height / 3);

    this.scoreText.setFontSize(scoreFontSize);
    this.scoreText.setPosition(width / 2, height / 2 - 20);

    if (this.newRecordText) {
      this.newRecordText.setFontSize(normalFontSize);
      this.newRecordText.setPosition(width / 2, height / 2 + 30);
    }

    this.highScoreText.setFontSize(normalFontSize);
    this.highScoreText.setPosition(width / 2, height / 2 + 70);

    this.restartButton.setFontSize(buttonFontSize);
    this.restartButton.setPadding(buttonPadding.x, buttonPadding.y);
    this.restartButton.setPosition(width / 2, (height * 2) / 3);
  }

  onShutdown() {
    this.scale.off('resize', this.onResize, this);
  }
}
