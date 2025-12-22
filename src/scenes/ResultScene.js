import Phaser from 'phaser';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data) {
    this.finalScore = data.score || 0;
  }

  create() {
    const { width, height } = this.cameras.main;

    // 배경
    this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

    // 게임 오버 텍스트
    this.add.text(width / 2, height / 3, '게임 종료!', {
      fontSize: '48px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 최종 점수
    this.add.text(width / 2, height / 2 - 20, `최종 점수: ${this.finalScore}`, {
      fontSize: '32px',
      fill: '#00ffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 최고 점수 (로컬 스토리지 사용)
    const highScore = this.getHighScore();
    if (this.finalScore > highScore) {
      this.saveHighScore(this.finalScore);
      this.add.text(width / 2, height / 2 + 30, '🎉 신기록! 🎉', {
        fontSize: '24px',
        fill: '#ffff00',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    this.add.text(width / 2, height / 2 + 70, `최고 점수: ${Math.max(highScore, this.finalScore)}`, {
      fontSize: '24px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // 재시작 버튼
    const restartButton = this.add.text(width / 2, height * 2 / 3, '다시 시작', {
      fontSize: '28px',
      fill: '#ffffff',
      backgroundColor: '#4a90e2',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    restartButton.setInteractive();
    restartButton.on('pointerover', () => {
      restartButton.setStyle({ backgroundColor: '#357abd' });
    });
    restartButton.on('pointerout', () => {
      restartButton.setStyle({ backgroundColor: '#4a90e2' });
    });
    restartButton.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }

  getHighScore() {
    const saved = localStorage.getItem('ice-breaker-highscore');
    return saved ? parseInt(saved, 10) : 0;
  }

  saveHighScore(score) {
    localStorage.setItem('ice-breaker-highscore', score.toString());
  }
}
