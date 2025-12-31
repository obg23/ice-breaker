import Phaser from "phaser";
import { axialToPixel, getNeighbors } from "../utils/hexUtils.js";
import { getColorByHP } from "../config/uiConfig.js";

const TURN_FACTOR = 0.55;
const UI_TOP = 60;
const PADDING = 16;

export default class GameScene extends Phaser.Scene {
  // 씬 키 등록
  constructor() {
    super({ key: "GameScene" });
  }

  // 게임 상태 및 UI 관련 변수 초기화
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
    this.isInputBlocked = false;

    this.isTouch = this.sys.game.device.input.touch;

    // 게임 설정 (화면 크기 기반)
    this.updateLayoutConfig(this.scale.gameSize);
  }

  // 배경, UI, 그리드 생성 및 초기 턴 세팅
  create() {
    const { width, height } = this.scale.gameSize;

    // 배경
    this.background = this.add
      .rectangle(0, 0, width, height, 0x1a1a2e)
      .setOrigin(0);

    // UI 생성
    this.createUI();

    // 육각형 그리드 생성
    this.createHexGrid();

    // 초기 배치 및 리사이즈 핸들링
    this.onResize(this.scale.gameSize);
    this.scale.on("resize", this.onResize, this);
    this.events.on("shutdown", this.onShutdown, this);

    // 턴 초기화
    this.initializeTurns();
  }

  // 점수/턴/콤보 텍스트 UI 생성
  createUI() {
    // 점수 표시
    this.scoreText = this.add.text(0, 0, "점수: 0", {
      fontSize: "24px",
      fill: "#ffffff",
      fontStyle: "bold",
    });

    // 턴 표시
    this.turnsText = this.add
      .text(0, 0, "TURNS: 0 / 0", {
        fontSize: "24px",
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    // 콤보 표시
    this.comboText = this.add
      .text(0, 0, "", {
        fontSize: "28px",
        fill: "#ffff00",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);
  }

  // 화면 크기에 맞춰 육각형 보드 생성
  createHexGrid() {
    const { width, height } = this.scale.gameSize;
    this.gridCenter = { x: width / 2, y: height / 2 };
    this.gridContainer = this.add.container(
      this.gridCenter.x,
      this.gridCenter.y
    );

    // 육각형 그리드 생성 (axial coordinates)
    for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
      const r1 = Math.max(-this.gridRadius, -q - this.gridRadius);
      const r2 = Math.min(this.gridRadius, -q + this.gridRadius);

      for (let r = r1; r <= r2; r++) {
        this.createIceTile(q, r);
      }
    }
  }

  // 단일 육각 타일 생성 및 클릭 이벤트 연결
  // 단일 육각 타일 생성 및 클릭 이벤트 연결
  createIceTile(q, r) {
    const pos = axialToPixel(q, r, this.tileSize);
    const { x, y } = pos;

    // 랜덤 HP (1~6)
    const maxHp = Phaser.Math.Between(1, 6);

    // 육각형 그래픽 생성
    const hexagon = this.add.graphics();
    const color = getColorByHP(maxHp);
    this.drawHexagon(hexagon, 0, 0, this.tileSize, color);

    // 컨테이너로 육각형과 텍스트 묶기
    const container = this.add.container(x, y);
    container.add(hexagon);

    // HP 텍스트 (모바일 대응 폰트 크기)
    /**
    const hpText = this.add
      .text(0, 0, maxHp, {
        fontSize: `${this.getHpFontSize()}px`,
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add(hpText);
    /**/
    this.gridContainer.add(container);

    // 타일 데이터
    const tileData = {
      q,
      r,
      hp: maxHp,
      maxHp,
      container,
      hexagon,
      // hpText,
      isBroken: false,
      relativePosition: { x: pos.x, y: pos.y },
      tileSize: this.tileSize,
    };

    // 터치/클릭 이벤트 (모바일에서 더 큰 터치 영역)
    container.setSize(this.getTouchAreaSize(), this.getTouchAreaSize());
    container.setInteractive();
    container.on("pointerdown", () => this.onTileClick(tileData));

    // Map에 저장
    this.tiles.set(`${q},${r}`, tileData);
  }

  // 육각형 도형을 그리는 유틸
  drawHexagon(graphics, x, y, size, color) {
    graphics.fillStyle(color, 1);
    graphics.lineStyle(2, 0xffffff, 1);

    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(x + size * Math.cos(angle), y + size * Math.sin(angle));
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

  // 타일 클릭 시 회전 후 매칭 검사
  async onTileClick(tile) {
    if (this.isGameOver || tile.isBroken || this.isInputBlocked) return;

    const rotationTargets = this.getRotationTargets(tile);
    if (!rotationTargets) {
      return;
    }

    this.consumeTurn();
    this.isInputBlocked = true;

    try {
      await this.playRotationAnimation(rotationTargets);
      const clusters = this.findMatchingClusters(rotationTargets);

      if (clusters.length > 0) {
        this.destroyMatchedTiles(clusters);
        await this.updateBoardStateAfterMatches();
      }

      this.checkWinLose();
    } finally {
      this.isInputBlocked = false;
    }
  }

  // 클릭된 타일과 인접 두 개를 회전 대상으로 선택
  getRotationTargets(centerTile) {
    if (!centerTile || centerTile.isBroken) return null;

    const neighbors = getNeighbors(centerTile.q, centerTile.r)
      .map(({ q, r }) => this.tiles.get(`${q},${r}`))
      .filter((tile) => tile && !tile.isBroken);

    if (neighbors.length < 2) {
      return null;
    }

    return [centerTile, neighbors[0], neighbors[1]];
  }

  // 회전 애니메이션 실행 후 좌표 스왑 적용
  playRotationAnimation(rotationTargets) {
    const nextPositions = rotationTargets.map((_, index) => {
      const sourceIndex = (index + 1) % rotationTargets.length;
      const targetTile = rotationTargets[sourceIndex];
      return {
        position: targetTile.relativePosition,
        qr: { q: targetTile.q, r: targetTile.r },
      };
    });

    const tweens = rotationTargets.map(
      (tile, index) =>
        new Promise((resolve) => {
          this.tweens.add({
            targets: tile.container,
            x: nextPositions[index].position.x,
            y: nextPositions[index].position.y,
            duration: 250,
            ease: "Sine.easeInOut",
            onComplete: resolve,
          });
        })
    );

    return Promise.all(tweens).then(() => {
      this.applyRotationState(rotationTargets, nextPositions);
    });
  }

  // 회전 결과를 타일 좌표/맵에 반영
  applyRotationState(rotationTargets, nextPositions) {
    const updates = rotationTargets.map((tile, index) => ({
      tile,
      oldKey: `${tile.q},${tile.r}`,
      next: nextPositions[index],
    }));

    updates.forEach(({ oldKey }) => {
      this.tiles.delete(oldKey);
    });

    updates.forEach(({ tile, next }) => {
      tile.q = next.qr.q;
      tile.r = next.qr.r;
      tile.relativePosition = next.position;
      tile.container.setPosition(next.position.x, next.position.y);
      this.tiles.set(`${tile.q},${tile.r}`, tile);
    });
  }

  // 타일 파괴 및 점수/콤보 처리
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
      },
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

    this.scheduleWinLoseCheck();
  }

  // 회전 타일과 인접 타일만으로 동일 HP 3개 이상 클러스터 탐색
  findMatchingClusters(pivotTiles = []) {
    const visited = new Set();
    const clusters = [];

    // 검사 후보: 회전된 3개 + 그 인접 타일만
    const candidates = new Map();
    const addCandidate = (tile) => {
      if (tile && !tile.isBroken) {
        candidates.set(`${tile.q},${tile.r}`, tile);
      }
    };

    pivotTiles.forEach((tile) => {
      addCandidate(tile);
      getNeighbors(tile.q, tile.r).forEach(({ q, r }) => {
        addCandidate(this.tiles.get(`${q},${r}`));
      });
    });

    // 후보 집합 내에서만 연결성을 탐색
    candidates.forEach((tile, key) => {
      if (visited.has(key)) return;

      const targetHp = tile.hp;
      const cluster = [];
      const stack = [tile];

      while (stack.length > 0) {
        const current = stack.pop();
        const currentKey = `${current.q},${current.r}`;

        if (visited.has(currentKey)) continue;
        if (current.isBroken || current.hp !== targetHp) continue;

        visited.add(currentKey);
        cluster.push(current);

        getNeighbors(current.q, current.r).forEach(({ q, r }) => {
          const neighbor = candidates.get(`${q},${r}`);
          if (!neighbor) return;
          const neighborKey = `${neighbor.q},${neighbor.r}`;
          if (!visited.has(neighborKey)) {
            stack.push(neighbor);
          }
        });
      }

      if (cluster.length >= 3) {
        clusters.push(cluster);
      }
    });

    return clusters;
  }

  // 찾은 클러스터를 순서대로 파괴
  destroyMatchedTiles(clusters) {
    if (!clusters || clusters.length === 0) return;

    clusters.forEach((cluster, clusterIndex) => {
      cluster.forEach((tile) => {
        this.breakTile(tile, clusterIndex > 0);
      });
    });
  }

  // 콤보 카운트 증가 및 타이머 리셋
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

  // 콤보 텍스트 갱신
  updateComboText() {
    if (this.combo > 1) {
      this.comboText.setText(`콤보 x${this.combo}`);
    } else {
      this.comboText.setText("");
    }
  }

  // 콤보 배수 계산
  getComboMultiplier() {
    if (this.combo >= 7) return 2.0;
    if (this.combo >= 4) return 1.5;
    return 1.0;
  }

  // 파괴된 타일을 맵에서 제거하고 일정 시간 후 새 타일 생성
  async updateBoardStateAfterMatches() {
    const brokenTiles = [];

    // 파괴된 타일 수집 후 맵에서 제거
    this.tiles.forEach((tile, key) => {
      if (tile.isBroken) {
        brokenTiles.push({ q: tile.q, r: tile.r });
        this.tiles.delete(key);
      }
    });

    if (brokenTiles.length === 0) return;

    // 빈 자리에 새 타일 생성
    return new Promise((resolve) => {
      this.time.delayedCall(500, () => {
        brokenTiles.forEach(({ q, r }) => {
          this.createIceTile(q, r);
        });
        resolve();
      });
    });
  }

  // 화면 크기 변경 시 UI/그리드 재배치
  onResize(gameSize) {
    const { width, height } = gameSize;
    const baseFontSize = width <= 360 ? 16 : this.isTouch ? 18 : 24;
    const comboFontSize = baseFontSize + 6;

    this.updateLayoutConfig(gameSize);

    if (this.background) {
      this.background.setSize(width, height);
    }

    this.scoreText.setFontSize(baseFontSize);
    this.scoreText.setPosition(PADDING, PADDING);

    this.turnsText.setFontSize(baseFontSize);
    this.turnsText.setPosition(width / 2, PADDING);

    this.comboText.setFontSize(comboFontSize);
    this.comboText.setPosition(width - PADDING, PADDING);

    const gridCenterX = width / 2;
    const gridCenterY = UI_TOP + (height - UI_TOP) / 2;

    if (this.gridContainer) {
      this.gridContainer.setPosition(gridCenterX, gridCenterY);
    }

    this.tiles.forEach((tile) => {
      const pos = axialToPixel(tile.q, tile.r, this.tileSize);
      tile.relativePosition = pos;

      tile.container.setPosition(pos.x, pos.y);

      if (tile.tileSize !== this.tileSize) {
        tile.tileSize = this.tileSize;
        const newColor = getColorByHP(tile.hp);
        tile.hexagon.clear();
        this.drawHexagon(tile.hexagon, 0, 0, this.tileSize, newColor);
        tile.hpText.setFontSize(this.getHpFontSize());
        tile.container.setSize(
          this.getTouchAreaSize(),
          this.getTouchAreaSize()
        );
      }
    });

    if (this.gridContainer) {
      const bounds = this.gridContainer.getBounds();
      const availableW = width - PADDING * 2;
      const availableH = height - UI_TOP - PADDING * 2;
      const scale = Math.min(
        availableW / bounds.width,
        availableH / bounds.height,
        1
      );
      this.gridContainer.setScale(scale);
      this.gridContainer.setPosition(gridCenterX, gridCenterY);
    }
  }

  // 씬 종료 시 리스너 정리
  onShutdown() {
    this.scale.off("resize", this.onResize, this);
  }

  // 총 HP 기반으로 턴 수 초기화
  initializeTurns() {
    this.totalHP = this.calculateTotalHP();
    this.turnsTotal = this.calculateTurnsTotal(this.totalHP);
    this.turnsRemaining = this.turnsTotal;
    this.updateTurnsText();
  }

  // 현재 보드의 총 HP 합산
  calculateTotalHP() {
    let total = 0;
    this.tiles.forEach((tile) => {
      total += tile.maxHp;
    });
    return total;
  }

  // 총 HP 대비 턴 수 계산
  calculateTurnsTotal(totalHP) {
    return Math.ceil(totalHP * TURN_FACTOR);
  }

  // 깨지지 않은 타일 개수 반환
  getRemainingTilesCount() {
    let remaining = 0;
    this.tiles.forEach((tile) => {
      if (!tile.isBroken) {
        remaining += 1;
      }
    });
    return remaining;
  }

  // 모든 타일 파괴 여부 확인
  isAllTilesBroken() {
    return this.getRemainingTilesCount() === 0;
  }

  // 턴 1 소모 후 UI 갱신
  consumeTurn() {
    if (this.isGameOver) return;
    this.turnsRemaining = Math.max(0, this.turnsRemaining - 1);
    this.updateTurnsText();
  }

  // 턴 텍스트 업데이트
  updateTurnsText() {
    if (this.turnsText) {
      this.turnsText.setText(
        `TURNS: ${this.turnsRemaining} / ${this.turnsTotal}`
      );
    }
  }

  // 승패 체크 예약
  scheduleWinLoseCheck() {
    if (this.winLoseCheckTimer) {
      this.winLoseCheckTimer.remove(false);
    }

    this.winLoseCheckTimer = this.time.delayedCall(250, () => {
      this.winLoseCheckTimer = null;
      this.checkWinLose();
    });
  }

  // 남은 타일/턴으로 승패 판정
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

  // 결과 데이터를 넘기며 결과 씬 전환
  endGame(isWin) {
    if (this.isGameOver) return;
    this.isGameOver = true;

    const resultData = {
      score: this.score,
      isWin: Boolean(isWin),
      turnsRemaining: this.turnsRemaining,
      turnsTotal: this.turnsTotal,
    };

    // 게임 종료 후 결과 화면으로 이동
    this.time.delayedCall(500, () => {
      this.scene.start("ResultScene", resultData);
    });
  }

  // 화면 크기에 따라 타일 크기/그리드 반경 결정
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

  // 타일 크기와 터치 여부에 따른 HP 폰트 크기
  getHpFontSize() {
    if (this.tileSize <= 24) return 14;
    if (this.tileSize <= 28) return this.isTouch ? 16 : 18;
    if (this.tileSize <= 34) return this.isTouch ? 18 : 20;
    return this.isTouch ? 20 : 22;
  }

  // 터치 디바이스에 맞춘 터치 영역 크기
  getTouchAreaSize() {
    // 클릭/터치 영역을 줄여서 겹침 클릭을 방지
    return this.isTouch ? this.tileSize * 1.8 : this.tileSize * 1.4;
  }
}
