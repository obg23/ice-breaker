import Phaser from 'phaser';
import { axialToPixel, getNeighbors } from '../utils/hexUtils.js';

const TURN_FACTOR = 0.55;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    // 게임 상태 초기화
    this.score = 0;
    this.combo = 0;
    this.comboTimer = null;
    this.turnsTotal = 0;
    this.turnsRemaining = 0;
    this.totalHP = 0;
    this.tiles = new Map(); // 타일 저장 (key: "q,r")
    this.isGameOver = false;
    this.winLoseCheckTimer = null;

    this.isTouch = this.sys.game.device.input.touch;

    // 게임 설정 (화면 크기 기반)
    this.updateLayoutConfig(this.scale.gameSize);
  }

  create() {
    const { width, height } = this.scale.gameSize;

    // 배경
    this.background = this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

    // UI 생성
    this.createUI();

    // 육각형 그리드 생성
    this.createHexGrid();

    // 초기 배치 및 리사이즈 핸들링
    this.onResize(this.scale.gameSize);
    this.scale.on('resize', this.onResize, this);
    this.events.on('shutdown', this.onShutdown, this);

    // 턴 초기화
    this.initializeTurns();
  }

  createUI() {
    // 점수 표시
    this.scoreText = this.add.text(0, 0, '점수: 0', {
      fontSize: '24px',
      fill: '#ffffff',
      fontStyle: 'bold'
    });

    // 턴 표시
    this.turnsText = this.add.text(0, 0, 'TURNS: 0 / 0', {
      fontSize: '24px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // 콤보 표시
    this.comboText = this.add.text(0, 0, '', {
      fontSize: '28px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(1, 0);
  }

  createHexGrid() {
    const { width, height } = this.scale.gameSize;
    this.gridCenter = { x: width / 2, y: height / 2 };

    // 육각형 그리드 생성 (axial coordinates)
    for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
      const r1 = Math.max(-this.gridRadius, -q - this.gridRadius);
      const r2 = Math.min(this.gridRadius, -q + this.gridRadius);

      for (let r = r1; r <= r2; r++) {
        this.createIceTile(q, r);
      }
    }
  }

  createIceTile(q, r) {
    const pos = axialToPixel(q, r, this.tileSize);
    const x = this.gridCenter.x + pos.x;
    const y = this.gridCenter.y + pos.y;

    // 랜덤 HP (1~5)
    const maxHp = Phaser.Math.Between(1, 5);

    // 육각형 그래픽 생성
    const hexagon = this.add.graphics();
    const color = this.getColorByHP(maxHp);
    this.drawHexagon(hexagon, 0, 0, this.tileSize, color);

    // 컨테이너로 육각형과 텍스트 묶기
    const container = this.add.container(x, y);
    container.add(hexagon);

    // HP 텍스트 (모바일 대응 폰트 크기)
    const hpText = this.add.text(0, 0, maxHp, {
      fontSize: `${this.getHpFontSize()}px`,
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(hpText);

    // 타일 데이터
    const tileData = {
      q,
      r,
      hp: maxHp,
      maxHp,
      container,
      hexagon,
      hpText,
      isBroken: false,
      relativePosition: { x: pos.x, y: pos.y },
      tileSize: this.tileSize
    };

    // 터치/클릭 이벤트 (모바일에서 더 큰 터치 영역)
    container.setSize(this.getTouchAreaSize(), this.getTouchAreaSize());
    container.setInteractive();
    container.on('pointerdown', () => this.onTileClick(tileData));

    // Map에 저장
    this.tiles.set(`${q},${r}`, tileData);
  }

  drawHexagon(graphics, x, y, size, color) {
    graphics.fillStyle(color, 1);
    graphics.lineStyle(2, 0xffffff, 1);

    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(
        x + size * Math.cos(angle),
        y + size * Math.sin(angle)
      );
    }

    graphics.beginPath();
    graphics.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      graphics.lineTo(points[i], points[i + 1]);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  getColorByHP(hp) {
    switch (hp) {
      case 5: return 0x0d47a1; // 진한 파랑 (최대 HP)
      case 4: return 0x1976d2; // 파랑
      case 3: return 0x4a90e2; // 중간 파랑
      case 2: return 0x7fb3d5; // 연한 파랑 (금 1단계)
      case 1: return 0xb0d4e8; // 아주 연한 파랑 (금 2단계)
      default: return 0xcccccc;
    }
  }

  onTileClick(tile) {
    if (this.isGameOver || tile.isBroken) return;

    this.consumeTurn();

    // HP 감소
    tile.hp -= 1;

    // 흔들림 효과
    this.tweens.add({
      targets: tile.container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      yoyo: true
    });

    if (tile.hp <= 0) {
      // 타일 파괴
      this.breakTile(tile, false);
    } else {
      // HP 업데이트
      tile.hpText.setText(tile.hp);
      const newColor = this.getColorByHP(tile.hp);
      tile.hexagon.clear();
      this.drawHexagon(tile.hexagon, 0, 0, this.tileSize, newColor);
    }

    this.scheduleWinLoseCheck();
  }

  breakTile(tile, isChain = false) {
    if (tile.isBroken) return;

    tile.isBroken = true;

    // 파괴 애니메이션
    this.tweens.add({
      targets: tile.container,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      onComplete: () => {
        tile.container.destroy();
      }
    });

    // 점수 계산
    const baseScore = 100;
    const chainBonus = isChain ? 50 : 0;
    const comboMultiplier = this.getComboMultiplier();
    const earnedScore = (baseScore + chainBonus) * comboMultiplier;

    this.score += earnedScore;
    this.scoreText.setText(`점수: ${this.score}`);

    // 콤보 증가
    this.increaseCombo();

    // 인접 타일에 데미지
    const neighbors = getNeighbors(tile.q, tile.r);
    neighbors.forEach(({ q, r }) => {
      const neighborTile = this.tiles.get(`${q},${r}`);
      if (neighborTile && !neighborTile.isBroken) {
        neighborTile.hp -= 1;

        if (neighborTile.hp <= 0) {
          // 연쇄 파괴
          this.time.delayedCall(100, () => {
            this.breakTile(neighborTile, true);
          });
        } else {
          // HP 업데이트
          neighborTile.hpText.setText(neighborTile.hp);
          const newColor = this.getColorByHP(neighborTile.hp);
          neighborTile.hexagon.clear();
          this.drawHexagon(neighborTile.hexagon, 0, 0, this.tileSize, newColor);
        }
      }
    });

    this.scheduleWinLoseCheck();
  }

  increaseCombo() {
    this.combo += 1;
    this.updateComboText();

    // 콤보 타이머 리셋
    if (this.comboTimer) {
      this.comboTimer.remove();
    }

    this.comboTimer = this.time.delayedCall(1500, () => {
      this.combo = 0;
      this.updateComboText();
    });
  }

  updateComboText() {
    if (this.combo > 1) {
      this.comboText.setText(`콤보 x${this.combo}`);
    } else {
      this.comboText.setText('');
    }
  }

  getComboMultiplier() {
    if (this.combo >= 7) return 2.0;
    if (this.combo >= 4) return 1.5;
    return 1.0;
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    const margin = 16;
    const baseFontSize = width <= 360 ? 16 : this.isTouch ? 18 : 24;
    const comboFontSize = baseFontSize + 6;

    this.updateLayoutConfig(gameSize);

    if (this.background) {
      this.background.setSize(width, height);
    }

    this.scoreText.setFontSize(baseFontSize);
    this.scoreText.setPosition(margin, margin);

    this.turnsText.setFontSize(baseFontSize);
    this.turnsText.setPosition(width / 2, margin);

    this.comboText.setFontSize(comboFontSize);
    this.comboText.setPosition(width - margin, margin);

    this.gridCenter = { x: width / 2, y: height / 2 };
    this.tiles.forEach((tile) => {
      const pos = axialToPixel(tile.q, tile.r, this.tileSize);
      tile.relativePosition = pos;

      tile.container.setPosition(
        this.gridCenter.x + pos.x,
        this.gridCenter.y + pos.y
      );

      if (tile.tileSize !== this.tileSize) {
        tile.tileSize = this.tileSize;
        const newColor = this.getColorByHP(tile.hp);
        tile.hexagon.clear();
        this.drawHexagon(tile.hexagon, 0, 0, this.tileSize, newColor);
        tile.hpText.setFontSize(this.getHpFontSize());
        tile.container.setSize(this.getTouchAreaSize(), this.getTouchAreaSize());
      }
    });
  }

  onShutdown() {
    this.scale.off('resize', this.onResize, this);
  }

  initializeTurns() {
    this.totalHP = this.calculateTotalHP();
    this.turnsTotal = this.calculateTurnsTotal(this.totalHP);
    this.turnsRemaining = this.turnsTotal;
    this.updateTurnsText();
  }

  calculateTotalHP() {
    let total = 0;
    this.tiles.forEach((tile) => {
      total += tile.maxHp;
    });
    return total;
  }

  calculateTurnsTotal(totalHP) {
    return Math.ceil(totalHP * TURN_FACTOR);
  }

  getRemainingTilesCount() {
    let remaining = 0;
    this.tiles.forEach((tile) => {
      if (!tile.isBroken) {
        remaining += 1;
      }
    });
    return remaining;
  }

  isAllTilesBroken() {
    return this.getRemainingTilesCount() === 0;
  }

  consumeTurn() {
    if (this.isGameOver) return;
    this.turnsRemaining = Math.max(0, this.turnsRemaining - 1);
    this.updateTurnsText();
  }

  updateTurnsText() {
    if (this.turnsText) {
      this.turnsText.setText(`TURNS: ${this.turnsRemaining} / ${this.turnsTotal}`);
    }
  }

  scheduleWinLoseCheck() {
    if (this.winLoseCheckTimer) {
      this.winLoseCheckTimer.remove(false);
    }

    this.winLoseCheckTimer = this.time.delayedCall(250, () => {
      this.winLoseCheckTimer = null;
      this.checkWinLose();
    });
  }

  checkWinLose() {
    if (this.isGameOver) return;

    if (this.isAllTilesBroken()) {
      this.endGame(true);
      return;
    }

    if (this.turnsRemaining <= 0) {
      this.endGame(false);
    }
  }

  endGame(isWin) {
    if (this.isGameOver) return;
    this.isGameOver = true;

    const resultData = {
      score: this.score,
      isWin: Boolean(isWin),
      turnsRemaining: this.turnsRemaining,
      turnsTotal: this.turnsTotal
    };

    // 게임 종료 후 결과 화면으로 이동
    this.time.delayedCall(500, () => {
      this.scene.start('ResultScene', resultData);
    });
  }

  updateLayoutConfig(gameSize) {
    const { width } = gameSize;
    let tileSize;
    let gridRadius;

    if (width <= 360) {
      tileSize = 24;
      gridRadius = 3;
    } else if (width <= 480) {
      tileSize = 28;
      gridRadius = 3;
    } else if (width <= 720) {
      tileSize = 34;
      gridRadius = 4;
    } else {
      tileSize = 40;
      gridRadius = 4;
    }

    this.tileSize = tileSize;
    if (!this.gridRadius) {
      this.gridRadius = gridRadius;
    }
  }

  getHpFontSize() {
    if (this.tileSize <= 24) return 14;
    if (this.tileSize <= 28) return this.isTouch ? 16 : 18;
    if (this.tileSize <= 34) return this.isTouch ? 18 : 20;
    return this.isTouch ? 20 : 22;
  }

  getTouchAreaSize() {
    return this.isTouch ? this.tileSize * 2.5 : this.tileSize * 2;
  }
}
