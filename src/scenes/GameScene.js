import Phaser from 'phaser';
import { axialToPixel, getNeighbors } from '../utils/hexUtils.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    // 게임 상태 초기화
    this.score = 0;
    this.combo = 0;
    this.comboTimer = null;
    this.timeLeft = 60; // 60초 제한
    this.tiles = new Map(); // 타일 저장 (key: "q,r")
    this.isGameOver = false;

    // 게임 설정
    this.tileSize = 40; // 육각형 크기
    this.gridRadius = 4; // 그리드 반경
  }

  create() {
    const { width, height } = this.cameras.main;

    // 배경
    this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

    // UI 생성
    this.createUI();

    // 육각형 그리드 생성
    this.createHexGrid();

    // 타이머 시작
    this.startTimer();
  }

  createUI() {
    const { width } = this.cameras.main;

    // 점수 표시
    this.scoreText = this.add.text(20, 20, '점수: 0', {
      fontSize: '24px',
      fill: '#ffffff',
      fontStyle: 'bold'
    });

    // 시간 표시
    this.timeText = this.add.text(width / 2, 20, '시간: 60', {
      fontSize: '24px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // 콤보 표시
    this.comboText = this.add.text(width - 20, 20, '', {
      fontSize: '28px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(1, 0);
  }

  createHexGrid() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2 + 20;

    // 육각형 그리드 생성 (axial coordinates)
    for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
      const r1 = Math.max(-this.gridRadius, -q - this.gridRadius);
      const r2 = Math.min(this.gridRadius, -q + this.gridRadius);

      for (let r = r1; r <= r2; r++) {
        this.createIceTile(q, r, centerX, centerY);
      }
    }
  }

  createIceTile(q, r, centerX, centerY) {
    const pos = axialToPixel(q, r, this.tileSize);
    const x = centerX + pos.x;
    const y = centerY + pos.y;

    // 랜덤 HP (1~5)
    const maxHp = Phaser.Math.Between(1, 5);

    // 육각형 그래픽 생성
    const hexagon = this.add.graphics();
    const color = this.getColorByHP(maxHp);
    this.drawHexagon(hexagon, 0, 0, this.tileSize, color);

    // 컨테이너로 육각형과 텍스트 묶기
    const container = this.add.container(x, y);
    container.add(hexagon);

    // HP 텍스트
    const hpText = this.add.text(0, 0, maxHp, {
      fontSize: '20px',
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
      isBroken: false
    };

    // 클릭 이벤트
    container.setSize(this.tileSize * 2, this.tileSize * 2);
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

  startTimer() {
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeLeft -= 1;
        this.timeText.setText(`시간: ${this.timeLeft}`);

        if (this.timeLeft <= 0) {
          this.endGame();
        }
      },
      loop: true
    });
  }

  endGame() {
    this.isGameOver = true;

    // 게임 종료 후 결과 화면으로 이동
    this.time.delayedCall(500, () => {
      this.scene.start('ResultScene', { score: this.score });
    });
  }
}
