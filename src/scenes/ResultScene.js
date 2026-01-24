import Phaser from 'phaser';

const MAX_TOP_SCORES = 5;
const STORAGE_KEY = 'ice-breaker-top-scores';

// 색상 테마
const COLORS = {
  bg: 0xF5E6D3,        // 베이지 배경
  cardBg: 0xFFFFFF,    // 흰색 카드
  accent: 0xE8D5C4,    // 연한 베이지
  gold: 0xFFD700,      // 금색
  silver: 0xC0C0C0,    // 은색
  bronze: 0xCD7F32,    // 동색
  text: 0x2C2C2C,      // 어두운 회색 텍스트
  textMuted: 0x8B7355, // 갈색 음영 텍스트
  success: 0x4ADE80,   // 초록색
  buttonBg: 0xE75A7C,  // 분홍색 버튼
  buttonHover: 0xD14768, // 진한 분홍색
  shadow: 0x000000,    // 그림자
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
      fill: '#2C2C2C',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // 점수 카드 배경 (둥근 모서리)
    this.scoreCardContainer = this.add.container(width / 2, height * 0.22);
    this.scoreCardBg = this.add.graphics();
    this.scoreCardShadow = this.add.graphics();
    this.scoreCardContainer.add([this.scoreCardShadow, this.scoreCardBg]);

    // 점수 라벨
    this.scoreLabelText = this.add.text(width / 2, height * 0.17, 'YOUR SCORE', {
      fontSize: '14px',
      fill: '#8B7355',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // 점수 숫자
    this.scoreText = this.add.text(width / 2, height * 0.24, this.finalScore.toLocaleString(), {
      fontSize: '52px',
      fill: '#E75A7C',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // TOP 5에 추가하고 순위 확인
    const rank = this.addScoreAndGetRank(this.finalScore);

    // 신기록 뱃지
    if (rank === 1) {
      this.newRecordBadgeContainer = this.add.container(width / 2, height * 0.32);
      this.newRecordBadgeBg = this.add.graphics();
      this.newRecordBadgeBg.fillStyle(COLORS.gold, 0.2);
      this.newRecordBadgeBg.fillRoundedRect(-80, -16, 160, 32, 16);
      this.newRecordBadgeBg.lineStyle(2, COLORS.gold);
      this.newRecordBadgeBg.strokeRoundedRect(-80, -16, 160, 32, 16);
      this.newRecordBadgeContainer.add(this.newRecordBadgeBg);

      this.newRecordText = this.add.text(width / 2, height * 0.32, 'NEW RECORD!', {
        fontSize: '16px',
        fill: '#FFD700',
        fontStyle: 'bold',
        fontFamily: 'Arial'
      }).setOrigin(0.5);
    } else if (rank > 0 && rank <= MAX_TOP_SCORES) {
      this.newRecordBadgeContainer = this.add.container(width / 2, height * 0.32);
      this.newRecordBadgeBg = this.add.graphics();
      this.newRecordBadgeBg.fillStyle(COLORS.success, 0.2);
      this.newRecordBadgeBg.fillRoundedRect(-60, -16, 120, 32, 16);
      this.newRecordBadgeBg.lineStyle(2, COLORS.success);
      this.newRecordBadgeBg.strokeRoundedRect(-60, -16, 120, 32, 16);
      this.newRecordBadgeContainer.add(this.newRecordBadgeBg);

      this.newRecordText = this.add.text(width / 2, height * 0.32, `#${rank} RANK`, {
        fontSize: '16px',
        fill: '#4ADE80',
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

    // 순위표 컨테이너 배경 (둥근 모서리)
    this.leaderboardBgContainer = this.add.container(
      width / 2,
      startY + (MAX_TOP_SCORES * lineHeight) / 2 + 15
    );
    this.leaderboardBg = this.add.graphics();
    this.leaderboardShadow = this.add.graphics();
    this.leaderboardBgContainer.add([this.leaderboardShadow, this.leaderboardBg]);

    // 순위표 제목
    this.leaderboardTitle = this.add.text(width / 2, startY, 'LEADERBOARD', {
      fontSize: '14px',
      fill: '#8B7355',
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

      // 현재 점수 하이라이트 배경 (둥근 모서리)
      let itemBgContainer = null;
      let itemBg = null;
      if (isCurrentScore) {
        itemBgContainer = this.add.container(width / 2, y);
        itemBg = this.add.graphics();
        itemBg.fillStyle(0xE75A7C, 0.15);
        itemBg.fillRoundedRect(-(cardWidth - 20) / 2, -17, cardWidth - 20, 34, 17);
        itemBg.lineStyle(2, 0xE75A7C, 0.5);
        itemBg.strokeRoundedRect(-(cardWidth - 20) / 2, -17, cardWidth - 20, 34, 17);
        itemBgContainer.add(itemBg);
      }

      // 랭크 번호
      const rankText = this.add.text(width / 2 - cardWidth / 2 + 30, y, `${rankNum}`, {
        fontSize: '18px',
        fill: rankColor,
        fontStyle: 'bold',
        fontFamily: 'Arial'
      }).setOrigin(0.5);

      // 점수
      const scoreColor = isCurrentScore ? '#E75A7C' : '#2C2C2C';
      const scoreText = this.add.text(width / 2 + cardWidth / 2 - 40, y, score > 0 ? score.toLocaleString() : '-', {
        fontSize: '18px',
        fill: scoreColor,
        fontStyle: isCurrentScore ? 'bold' : 'normal',
        fontFamily: 'Arial'
      }).setOrigin(1, 0.5);

      this.leaderboardItems.push({ itemBgContainer, itemBg, rankText, scoreText, rankNum, isCurrentScore });
    }
  }

  createButton(width, height) {
    // 버튼 배경 (둥근 모서리)
    this.buttonContainer = this.add.container(width / 2, height * 0.9);
    this.buttonBg = this.add.graphics();
    this.buttonShadow = this.add.graphics();

    this.drawButton(false);

    // 버튼 텍스트 생성 (컨테이너 내부 좌표 0, 0)
    this.restartButton = this.add.text(0, 0, 'PLAY AGAIN', {
      fontSize: '20px',
      fill: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    // 컨테이너에 모든 요소 추가
    this.buttonContainer.add([this.buttonShadow, this.buttonBg, this.restartButton]);

    // 컨테이너를 인터랙티브하게 설정
    this.buttonContainer.setSize(200, 50);
    this.buttonContainer.setInteractive(
      new Phaser.Geom.Rectangle(-100, -25, 200, 50),
      Phaser.Geom.Rectangle.Contains
    );

    this.buttonContainer.on('pointerover', () => {
      this.drawButton(true);
      this.buttonContainer.setScale(1.05);
    });

    this.buttonContainer.on('pointerout', () => {
      this.drawButton(false);
      this.buttonContainer.setScale(1);
    });

    this.buttonContainer.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }

  drawButton(isHover) {
    const color = isHover ? COLORS.buttonHover : COLORS.buttonBg;

    this.buttonShadow.clear();
    this.buttonShadow.fillStyle(COLORS.shadow, 0.2);
    this.buttonShadow.fillRoundedRect(-100, -23, 200, 50, 25);

    this.buttonBg.clear();
    this.buttonBg.fillStyle(color);
    this.buttonBg.fillRoundedRect(-100, -25, 200, 50, 25);
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
    this.scoreCardContainer?.setPosition(width / 2, height * 0.22);

    if (this.scoreCardBg && this.scoreCardShadow) {
      const halfWidth = cardWidth / 2;
      const halfHeight = cardHeight / 2;

      this.scoreCardShadow.clear();
      this.scoreCardShadow.fillStyle(COLORS.shadow, 0.15);
      this.scoreCardShadow.fillRoundedRect(-halfWidth, -halfHeight + 3, cardWidth, cardHeight, 20);

      this.scoreCardBg.clear();
      this.scoreCardBg.fillStyle(COLORS.cardBg);
      this.scoreCardBg.fillRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 20);
      this.scoreCardBg.lineStyle(2, COLORS.accent, 0.3);
      this.scoreCardBg.strokeRoundedRect(-halfWidth, -halfHeight, cardWidth, cardHeight, 20);
    }

    this.scoreLabelText?.setFontSize(labelSize).setPosition(width / 2, height * 0.17);
    this.scoreText?.setFontSize(scoreSize).setPosition(width / 2, height * 0.24);

    // 뱃지
    if (this.newRecordBadgeContainer) {
      this.newRecordBadgeContainer.setPosition(width / 2, height * 0.32);
      this.newRecordText?.setFontSize(badgeSize).setPosition(width / 2, height * 0.32);
    }

    // 순위표
    const startY = height * 0.42;
    const leaderboardHeight = MAX_TOP_SCORES * lineHeight + 50;

    this.leaderboardBgContainer?.setPosition(
      width / 2,
      startY + (MAX_TOP_SCORES * lineHeight) / 2 + 15
    );

    if (this.leaderboardBg && this.leaderboardShadow) {
      const halfWidth = cardWidth / 2;
      const halfHeight = leaderboardHeight / 2;

      this.leaderboardShadow.clear();
      this.leaderboardShadow.fillStyle(COLORS.shadow, 0.15);
      this.leaderboardShadow.fillRoundedRect(-halfWidth, -halfHeight + 3, cardWidth, leaderboardHeight, 20);

      this.leaderboardBg.clear();
      this.leaderboardBg.fillStyle(COLORS.cardBg, 0.9);
      this.leaderboardBg.fillRoundedRect(-halfWidth, -halfHeight, cardWidth, leaderboardHeight, 20);
      this.leaderboardBg.lineStyle(2, COLORS.accent, 0.3);
      this.leaderboardBg.strokeRoundedRect(-halfWidth, -halfHeight, cardWidth, leaderboardHeight, 20);
    }

    this.leaderboardTitle?.setFontSize(labelSize).setPosition(width / 2, startY);

    this.leaderboardItems?.forEach((item, i) => {
      const y = startY + 35 + (i * lineHeight);

      if (item.itemBgContainer) {
        item.itemBgContainer.setPosition(width / 2, y);
      }

      item.rankText?.setFontSize(leaderboardSize).setPosition(width / 2 - cardWidth / 2 + 30, y);
      item.scoreText?.setFontSize(leaderboardSize).setPosition(width / 2 + cardWidth / 2 - 40, y);
    });

    // 버튼
    const buttonWidth = isSmall ? 160 : 200;
    const buttonHeight = isSmall ? 44 : 50;
    this.buttonContainer?.setPosition(width / 2, height * 0.9);
    this.restartButton?.setFontSize(buttonSize);
  }

  onShutdown() {
    this.scale.off('resize', this.onResize, this);
  }
}
