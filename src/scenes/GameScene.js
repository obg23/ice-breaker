import Phaser from "phaser";
import { axialToPixel, getNeighbors } from "../utils/hexUtils.js";

const TURN_FACTOR = 0.55;
const DEFAULT_UI_TOP = 60;
const PADDING = 16;
const QUEST_TARGET_PER_COLOR = 30;

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
    this.comboWindowMs = 1350;
    this.lastMatchAt = 0;
    this.turnsTotal = 0;
    this.turnsRemaining = 0;
    this.totalHP = 0;
    this.tiles = new Map(); // 타일 저장 (key: "q,r")
    this.isGameOver = false;
    this.winLoseCheckTimer = null;
    this.isInputBlocked = false;
    this.uiTop = DEFAULT_UI_TOP;
    this.questBarHeight = 72;
    this.timeLeft = 30.0;
    this.timeMax = 90.0;
    this.timeEvent = null;
    // HP 값과 실제 타일 색 순서를 맞춘 정의 (frame = hp - 1)
    this.colorDefinitions = [
      { id: 1, label: "보라", color: 0x8338ec },
      { id: 2, label: "회색", color: 0x8c8c8c },
      { id: 3, label: "초록", color: 0x00b140 },
      { id: 4, label: "파랑", color: 0x3a86ff },
      { id: 5, label: "노랑", color: 0xffbe0b },
      { id: 6, label: "분홍", color: 0xff006e },
    ];
    this.questRemaining = {};
    this.colorDefinitions.forEach((def) => {
      this.questRemaining[def.id] = QUEST_TARGET_PER_COLOR;
    });

    this.load.spritesheet("gearTiles", "assets/gear-tile.png", {
      frameWidth: 128,
      frameHeight: 128,
    });

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
    this.startTimer();
  }

  // 점수/턴/콤보 텍스트 UI 생성
  createUI() {
    // 점수 표시
    this.scoreText = this.add.text(0, 0, "점수: 0", {
      fontSize: "24px",
      fill: "#ffffff",
      fontStyle: "bold",
    });

    // 시간 표시
    this.timeText = this.add
      .text(0, 0, "TIME: 30.0", {
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

    this.createQuestUIElements();
  }

  createQuestUIElements() {
    const { width } = this.scale.gameSize;
    const bgWidth = Math.max(200, width - PADDING * 2);

    this.questContainer = this.add.container(0, 0).setDepth(1000);
    this.questBg = this.add
      .rectangle(PADDING, PADDING, bgWidth, this.questBarHeight, 0x0d2030, 0.75)
      .setOrigin(0, 0);
    this.questTitle = this.add
      .text(PADDING + 10, PADDING + 8, "색깔별로 30개 파괴", {
        fontSize: "18px",
        fill: "#cce7ff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.questContainer.add([this.questBg, this.questTitle]);

    this.questItems = new Map();
    this.colorDefinitions.forEach((def) => {
      const itemContainer = this.add.container(0, 0);
      const chip = this.add
        .circle(0, 0, 9, def.color, 1)
        .setStrokeStyle(1, 0xffffff, 0.8);
      const text = this.add
        .text(0, 0, "", {
          fontSize: "16px",
          fill: this.toHexColor(def.color),
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      itemContainer.add([chip, text]);
      this.questContainer.add(itemContainer);
      this.questItems.set(def.id, { container: itemContainer, chip, text });
      this.updateQuestText(def.id);
    });
    this.layoutQuestUI(this.scale.gameSize);
  }

  layoutQuestUI(gameSize) {
    if (!this.questContainer || !this.questBg) return;

    const { width } = gameSize;
    const isSmall = width <= 480;
    const questFontSize = isSmall ? 14 : 16;
    const questTitleSize = isSmall ? 16 : 18;
    const chipRadius = isSmall ? 7 : 9;
    const bgWidth = Math.max(220, width - PADDING * 2);

    this.questBarHeight = questTitleSize + questFontSize + 22;

    this.questBg.setSize(bgWidth, this.questBarHeight);
    this.questBg.setPosition(PADDING, PADDING);

    this.questTitle.setFontSize(questTitleSize);
    this.questTitle.setPosition(PADDING + 10, PADDING + 8);

    const slotWidth = bgWidth / this.colorDefinitions.length;
    const itemY = PADDING + this.questBarHeight - questFontSize - 6;

    this.colorDefinitions.forEach((def, index) => {
      const entry = this.questItems.get(def.id);
      if (!entry) return;

      entry.container.setPosition(
        PADDING + slotWidth * index + 6,
        itemY
      );

      entry.chip.setRadius(chipRadius);
      entry.chip.setPosition(0, 0);
      entry.chip.setStrokeStyle(1, 0xffffff, 0.8);

      entry.text.setFontSize(questFontSize);
      entry.text.setColor(this.toHexColor(def.color));
      entry.text.setPosition(chipRadius * 2 + 6, 0);

      this.updateQuestText(def.id);
    });
  }

  updateQuestText(colorId) {
    const entry = this.questItems?.get(colorId);
    const def = this.colorDefinitions.find((c) => c.id === colorId);
    if (!entry || !def) return;

    const remaining = this.questRemaining[colorId] ?? QUEST_TARGET_PER_COLOR;
    entry.text.setText(`${def.label} ${remaining}/${QUEST_TARGET_PER_COLOR}`);
  }

  applyQuestProgress(tile) {
    if (!tile) return;
    const colorId = tile.maxHp;
    if (this.questRemaining[colorId] === undefined) return;

    this.questRemaining[colorId] = Math.max(
      0,
      (this.questRemaining[colorId] ?? QUEST_TARGET_PER_COLOR) - 1
    );
    this.updateQuestText(colorId);
  }

  toHexColor(intColor) {
    return `#${intColor.toString(16).padStart(6, "0")}`;
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
  createIceTile(q, r) {
    const pos = axialToPixel(q, r, this.tileSize);
    const { x, y } = pos;

    // 랜덤 HP (1~6)
    const maxHp = Phaser.Math.Between(1, 6);
    const frame = maxHp - 1; // gearTiles spritesheet frame index

    // 육각 기어 스프라이트 생성
    const sprite = this.add.sprite(0, 0, "gearTiles", frame);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(this.getTileDisplaySize(), this.getTileDisplaySize());

    // 컨테이너로 육각형과 텍스트 묶기
    const container = this.add.container(x, y);
    container.add(sprite);

    // 좌표 디버그 텍스트 (q,r 표기)
    const positionText = this.add
      .text(0, 0, `${q},${r}`, {
        fontSize: `${this.getHpFontSize()}px`,
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    // container.add(positionText);
    this.gridContainer.add(container);

    // 타일 데이터
    const tileData = {
      q,
      r,
      hp: maxHp,
      maxHp,
      container,
      sprite,
      positionText,
      isBroken: false,
      relativePosition: { x: pos.x, y: pos.y },
      tileSize: this.tileSize,
    };
    this.updateTileDepth(tileData);

    // 터치/클릭 이벤트 (모바일에서 더 큰 터치 영역)
    container.setSize(this.getTouchAreaSize(), this.getTouchAreaSize());
    container.setInteractive();
    container.on("pointerdown", () => this.onTileClick(tileData));

    // Map에 저장
    this.tiles.set(`${q},${r}`, tileData);
  }

  // 타일 클릭 시 회전 후 매칭 검사
  async onTileClick(tile) {
    if (this.isGameOver || tile.isBroken || this.isInputBlocked) return;

    const rotationTargets = this.getRotationTargets(tile);
    if (!rotationTargets) {
      return;
    }

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

    const movementTweens = rotationTargets.map(
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

    const rotationTweens = rotationTargets.map(
      (tile) =>
        new Promise((resolve) => {
          if (!tile.sprite) {
            resolve();
            return;
          }

          this.tweens.add({
            targets: tile.sprite,
            rotation: tile.sprite.rotation + Phaser.Math.DegToRad(120),
            duration: 250,
            ease: "Sine.easeInOut",
            onComplete: resolve,
          });
        })
    );

    return Promise.all([...movementTweens, ...rotationTweens]).then(() => {
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
      tile.positionText.setText(`${tile.q},${tile.r}`);
      tile.container.setPosition(next.position.x, next.position.y);
      this.updateTileDepth(tile);
      this.tiles.set(`${tile.q},${tile.r}`, tile);
    });
  }

  // 타일 파괴 및 점수/콤보 처리
  breakTile(tile, isChain = false) {
    if (tile.isBroken) return;

    tile.isBroken = true;
    this.applyQuestProgress(tile);

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

    this.scheduleWinLoseCheck();
  }

  // 회전으로 영향 받은 타일부터 시작해 전체 보드에서 동일 HP 3개 이상 클러스터 탐색
  findMatchingClusters(pivotTiles = []) {
    const visited = new Set();
    const clusters = [];

    // 회전된 타일을 시작점으로 삼고, 동일 HP가 이어지는 한 전체 맵을 따라간다
    const seeds =
      pivotTiles.length > 0
        ? pivotTiles.filter((t) => t && !t.isBroken)
        : Array.from(this.tiles.values()).filter((t) => !t.isBroken);

    seeds.forEach((tile) => {
      const startKey = `${tile.q},${tile.r}`;
      if (visited.has(startKey)) return;

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
          const neighbor = this.tiles.get(`${q},${r}`);
          if (!neighbor) return;
          if (!visited.has(`${neighbor.q},${neighbor.r}`)) {
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

    const now = this.time.now;
    this.updateComboOnMatch(now);
    const comboMultiplier = this.getComboMultiplier();
    let totalDestroyed = 0;
    let baseSeconds = 0;

    clusters.forEach((cluster, clusterIndex) => {
      totalDestroyed += cluster.length;
      if (cluster.length >= 4) {
        baseSeconds += 0.8;
      } else if (cluster.length === 3) {
        baseSeconds += 0.5;
      } else if (cluster.length === 2) {
        baseSeconds += 0.2;
      }

      cluster.forEach((tile) => {
        this.breakTile(tile, clusterIndex > 0);
      });
    });

    if (totalDestroyed > 0) {
      const earnedScore = Math.round(totalDestroyed * 100 * comboMultiplier);
      this.score += earnedScore;
      this.scoreText.setText(`점수: ${this.score}`);
    }

    const addSeconds = baseSeconds * comboMultiplier;
    if (addSeconds > 0) {
      this.addTimeBonus(addSeconds);
    }
  }

  
  // 콤보 갱신 (매칭 확정 시에만 처리)
  updateComboOnMatch(now) {
    if (now - this.lastMatchAt <= this.comboWindowMs) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }
    this.lastMatchAt = now;
    this.updateComboText();
  }

  // 콤보 텍스트 갱신
  updateComboText() {
    if (this.combo > 1) {
      this.comboText.setText(`COMBO: x${this.combo}`);
    } else {
      this.comboText.setText("");
    }
  }

  // 콤보 배수 계산
  getComboMultiplier() {
    if (this.combo >= 6) return 1.4;
    if (this.combo >= 3) return 1.2;
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
    this.layoutQuestUI(gameSize);

    if (this.background) {
      this.background.setSize(width, height);
    }

    const statsY = (this.questBarHeight || DEFAULT_UI_TOP) + PADDING + 6;

    this.scoreText.setFontSize(baseFontSize);
    this.scoreText.setPosition(PADDING, statsY);

    this.timeText.setFontSize(baseFontSize);
    this.timeText.setPosition(width / 2, statsY);

    this.comboText.setFontSize(comboFontSize);
    this.comboText.setPosition(width - PADDING, statsY);

    this.uiTop = statsY + baseFontSize + 12;

    const gridCenterX = width / 2;
    const gridCenterY = this.uiTop + (height - this.uiTop) / 2;

    if (this.gridContainer) {
      this.gridContainer.setPosition(gridCenterX, gridCenterY);
    }

    this.tiles.forEach((tile) => {
      const pos = axialToPixel(tile.q, tile.r, this.tileSize);
      tile.relativePosition = pos;

      tile.container.setPosition(pos.x, pos.y);

      if (tile.tileSize !== this.tileSize) {
        tile.tileSize = this.tileSize;
        if (tile.sprite) {
          tile.sprite.setDisplaySize(
            this.getTileDisplaySize(),
            this.getTileDisplaySize()
          );
        }
        tile.positionText.setFontSize(this.getHpFontSize());
        tile.container.setSize(
          this.getTouchAreaSize(),
          this.getTouchAreaSize()
        );
        this.updateTileDepth(tile);
      }
    });

    if (this.gridContainer) {
      const bounds = this.gridContainer.getBounds();
      const availableW = width - PADDING * 2;
      const availableH = height - this.uiTop - PADDING * 2;
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
    if (this.timeEvent) {
      this.timeEvent.remove(false);
      this.timeEvent = null;
    }
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

  // 시간 종료 시 게임 종료
  checkWinLose() {
    if (this.isGameOver) return;

    if (this.timeLeft <= 0) {
      this.endGame(false);
    }
  }

  // 결과 데이터를 넘기며 결과 씬 전환
  endGame(isWin) {
    if (this.isGameOver) return;
    this.isGameOver = true;

    if (this.timeEvent) {
      this.timeEvent.remove(false);
      this.timeEvent = null;
    }

    const resultData = {
      score: this.score,
    };

    // 게임 종료 후 결과 화면으로 이동
    this.time.delayedCall(500, () => {
      this.scene.start("ResultScene", resultData);
    });
  }


  startTimer() {
    if (this.timeEvent) {
      this.timeEvent.remove(false);
    }

    this.updateTimeText();
    this.timeEvent = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this.isGameOver) return;
        this.timeLeft = Math.max(0, this.timeLeft - 0.1);
        this.updateTimeText();

        if (this.timeLeft <= 0) {
          this.endGame(false);
        }
      },
    });
  }

  updateTimeText() {
    if (!this.timeText) return;
    this.timeText.setText(`TIME: ${this.timeLeft.toFixed(1)}`);
  }

  addTimeBonus(addSeconds) {
    this.timeLeft = Math.min(this.timeMax, this.timeLeft + addSeconds);
    this.updateTimeText();
    this.playTimeBonusFeedback(addSeconds);
  }

  playTimeBonusFeedback(addSeconds) {
    if (!this.timeText) return;

    this.timeText.setScale(1);
    this.tweens.add({
      targets: this.timeText,
      scale: 1.15,
      duration: 100,
      yoyo: true,
      ease: "Sine.easeOut",
    });

    const gainText = this.add
      .text(
        this.timeText.x + 36,
        this.timeText.y + 4,
        `+${addSeconds.toFixed(1)}s`,
        {
          fontSize: "18px",
          fill: "#00ff99",
          fontStyle: "bold",
        }
      )
      .setOrigin(0, 0.5);

    this.tweens.add({
      targets: gainText,
      y: this.timeText.y - 18,
      alpha: 0,
      duration: 600,
      ease: "Sine.easeOut",
      onComplete: () => gainText.destroy(),
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

  // 기어 스프라이트의 표시 지름
  getTileDisplaySize() {
    return this.tileSize * 2;
  }

  // 터치 디바이스에 맞춘 터치 영역 크기
  getTouchAreaSize() {
    // 클릭/터치 영역을 줄여서 겹침 클릭을 방지
    return this.isTouch ? this.tileSize * 1.8 : this.tileSize * 1.4;
  }

  // 타일의 z-순서를 일관되게 맞춰 겹침을 방지
  updateTileDepth(tile) {
    if (!tile || !tile.container) return;
    // r을 우선, q를 보조로 깊이를 정렬해 아래줄이 위로 덮이지 않도록 고정
    const depth =
      (tile.r + this.gridRadius * 2) * 1000 + (tile.q + this.gridRadius * 2);
    tile.container.setDepth(depth);
  }
}
