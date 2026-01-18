import Phaser from 'phaser';

const MAX_TOP_SCORES = 5;
const STORAGE_KEY = 'ice-breaker-top-scores';

// 색상 테마
const COLORS = {
  bg: 0x0f1923,
  cardBg: 0x1a2634,
  accent: 0x00d4ff,
  gold: 0xffd700,
  silver: 0xc0c0c0,
  bronze: 0xcd7f32,
  text: 0xffffff,
  textMuted: 0x6b7c8f,
  success: 0x4ade80,
  buttonBg: 0x2563eb,
  buttonHover: 0x1d4ed8,
};

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

    // 그라데이션 배경
    this.background = this.add.rectangle(0, 0, width, height, COLORS.bg).setOrigin(0);

    // 상단 장식 라인
    this.topLine = this.add.rectangle(width / 2, 0, width * 0.6, 4, COLORS.accent).setOrigin(0.5, 0);

    // 타이틀
    this.titleText = this.add.text(width / 2, height * 0.08, 'GAME OVER', {
      fontSize: '36px',
      fill: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // 점수 카드 배경
    this.scoreCard = this.add.rectangle(width / 2, height * 0.22, width * 0.8, 120, COLORS.cardBg, 0.8)
      .setOrigin(0.5)
      .setStrokeStyle(2, COLORS.accent, 0.5);

    // 점수 라벨
    this.scoreLabelText = this.add.text(width / 2, height * 0.17, 'YOUR SCORE', {
      fontSize: '14px',
      fill: '#6b7c8f',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // 점수 숫자
    this.scoreText = this.add.text(width / 2, height * 0.24, this.finalScore.toLocaleString(), {
      fontSize: '52px',
      fill: '#00d4ff',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // TOP 5에 추가하고 순위 확인
    const rank = this.addScoreAndGetRank(this.finalScore);

    // 신기록 뱃지
    if (rank === 1) {
      this.newRecordBadge = this.add.rectangle(width / 2, height * 0.32, 160, 32, COLORS.gold, 0.2)
        .setOrigin(0.5)
        .setStrokeStyle(2, COLORS.gold);
      this.newRecordText = this.add.text(width / 2, height * 0.32, 'NEW RECORD!', {
        fontSize: '16px',
        fill: '#ffd700',
        fontStyle: 'bold',
        fontFamily: 'Arial'
      }).setOrigin(0.5);
    } else if (rank > 0 && rank <= MAX_TOP_SCORES) {
      this.newRecordBadge = this.add.rectangle(width / 2, height * 0.32, 120, 32, COLORS.success, 0.2)
        .setOrigin(0.5)
        .setStrokeStyle(2, COLORS.success);
      this.newRecordText = this.add.text(width / 2, height * 0.32, `#${rank} RANK`, {
        fontSize: '16px',
        fill: '#4ade80',
        fontStyle: 'bold',
        fontFamily: 'Arial'
      }).setOrigin(0.5);
    }

    // 순위표
    this.createLeaderboard(width, height, rank);

    // 재시작 버튼
    this.createButton(width, height);

    this.onResize(this.scale.gameSize);
    this.scale.on('resize', this.onResize, this);
    this.events.on('shutdown', this.onShutdown, this);
  }

  createLeaderboard(width, height, currentRank) {
    const topScores = this.getTopScores();
    const startY = height * 0.42;
    const lineHeight = 40;
    const cardWidth = width * 0.75;

    // 순위표 컨테이너 배경
    this.leaderboardBg = this.add.rectangle(
      width / 2,
      startY + (MAX_TOP_SCORES * lineHeight) / 2 + 15,
      cardWidth,
      MAX_TOP_SCORES * lineHeight + 50,
      COLORS.cardBg,
      0.5
    ).setOrigin(0.5).setStrokeStyle(1, 0x2a3a4a);

    // 순위표 제목
    this.leaderboardTitle = this.add.text(width / 2, startY, 'LEADERBOARD', {
      fontSize: '14px',
      fill: '#6b7c8f',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // 순위표 항목들
    this.leaderboardItems = [];
    for (let i = 0; i < MAX_TOP_SCORES; i++) {
      const y = startY + 35 + (i * lineHeight);
      const score = topScores[i] || 0;
      const rankNum = i + 1;
      const isCurrentScore = (rankNum === currentRank);

      // 랭크 메달 색상
      let rankColor = '#6b7c8f';
      if (rankNum === 1) rankColor = '#ffd700';
      else if (rankNum === 2) rankColor = '#c0c0c0';
      else if (rankNum === 3) rankColor = '#cd7f32';

      // 현재 점수 하이라이트 배경
      let itemBg = null;
      if (isCurrentScore) {
        itemBg = this.add.rectangle(width / 2, y, cardWidth - 20, 34, COLORS.accent, 0.15)
          .setOrigin(0.5)
          .setStrokeStyle(1, COLORS.accent, 0.5);
      }

      // 랭크 번호
      const rankText = this.add.text(width / 2 - cardWidth / 2 + 30, y, `${rankNum}`, {
        fontSize: '18px',
        fill: rankColor,
        fontStyle: 'bold',
        fontFamily: 'Arial'
      }).setOrigin(0.5);

      // 점수
      const scoreColor = isCurrentScore ? '#00d4ff' : '#ffffff';
      const scoreText = this.add.text(width / 2 + cardWidth / 2 - 40, y, score > 0 ? score.toLocaleString() : '-', {
        fontSize: '18px',
        fill: scoreColor,
        fontStyle: isCurrentScore ? 'bold' : 'normal',
        fontFamily: 'Arial'
      }).setOrigin(1, 0.5);

      this.leaderboardItems.push({ itemBg, rankText, scoreText, rankNum, isCurrentScore });
    }
  }

  createButton(width, height) {
    // 버튼 배경
    this.buttonBg = this.add.rectangle(width / 2, height * 0.9, 200, 50, COLORS.buttonBg)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // 버튼 텍스트
    this.restartButton = this.add.text(width / 2, height * 0.9, 'PLAY AGAIN', {
      fontSize: '20px',
      fill: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.buttonBg.on('pointerover', () => {
      this.buttonBg.setFillStyle(COLORS.buttonHover);
      this.buttonBg.setScale(1.05);
      this.restartButton.setScale(1.05);
    });

    this.buttonBg.on('pointerout', () => {
      this.buttonBg.setFillStyle(COLORS.buttonBg);
      this.buttonBg.setScale(1);
      this.restartButton.setScale(1);
    });

    this.buttonBg.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }

  addScoreAndGetRank(score) {
    const topScores = this.getTopScores();
    topScores.push(score);
    topScores.sort((a, b) => b - a);
    const rank = topScores.indexOf(score) + 1;

    const newTopScores = topScores.slice(0, MAX_TOP_SCORES);
    this.saveTopScores(newTopScores);

    return rank <= MAX_TOP_SCORES ? rank : 0;
  }

  getTopScores() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }

  saveTopScores(scores) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  getHighScore() {
    const topScores = this.getTopScores();
    return topScores[0] || 0;
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    const isSmall = width <= 480;
    const isVerySmall = width <= 360;

    // 폰트 크기
    const titleSize = isVerySmall ? 28 : isSmall ? 32 : 36;
    const scoreSize = isVerySmall ? 36 : isSmall ? 44 : 52;
    const labelSize = isVerySmall ? 11 : isSmall ? 12 : 14;
    const badgeSize = isVerySmall ? 13 : isSmall ? 14 : 16;
    const leaderboardSize = isVerySmall ? 14 : isSmall ? 16 : 18;
    const buttonSize = isVerySmall ? 16 : isSmall ? 18 : 20;

    const cardWidth = Math.min(width * 0.85, 400);
    const lineHeight = isSmall ? 34 : 40;

    // 배경
    this.background?.setSize(width, height);
    this.topLine?.setPosition(width / 2, 0).setSize(width * 0.6, 4);

    // 타이틀
    this.titleText?.setFontSize(titleSize).setPosition(width / 2, height * 0.08);

    // 점수 카드
    const cardHeight = isSmall ? 100 : 120;
    this.scoreCard?.setPosition(width / 2, height * 0.22).setSize(cardWidth, cardHeight);
    this.scoreLabelText?.setFontSize(labelSize).setPosition(width / 2, height * 0.17);
    this.scoreText?.setFontSize(scoreSize).setPosition(width / 2, height * 0.24);

    // 뱃지
    if (this.newRecordBadge) {
      this.newRecordBadge.setPosition(width / 2, height * 0.32);
      this.newRecordText?.setFontSize(badgeSize).setPosition(width / 2, height * 0.32);
    }

    // 순위표
    const startY = height * 0.42;
    this.leaderboardBg?.setPosition(
      width / 2,
      startY + (MAX_TOP_SCORES * lineHeight) / 2 + 15
    ).setSize(cardWidth, MAX_TOP_SCORES * lineHeight + 50);

    this.leaderboardTitle?.setFontSize(labelSize).setPosition(width / 2, startY);

    this.leaderboardItems?.forEach((item, i) => {
      const y = startY + 35 + (i * lineHeight);
      item.itemBg?.setPosition(width / 2, y).setSize(cardWidth - 20, 34);
      item.rankText?.setFontSize(leaderboardSize).setPosition(width / 2 - cardWidth / 2 + 30, y);
      item.scoreText?.setFontSize(leaderboardSize).setPosition(width / 2 + cardWidth / 2 - 40, y);
    });

    // 버튼
    const buttonWidth = isSmall ? 160 : 200;
    const buttonHeight = isSmall ? 44 : 50;
    this.buttonBg?.setPosition(width / 2, height * 0.9).setSize(buttonWidth, buttonHeight);
    this.restartButton?.setFontSize(buttonSize).setPosition(width / 2, height * 0.9);
  }

  onShutdown() {
    this.scale.off('resize', this.onResize, this);
  }
}
