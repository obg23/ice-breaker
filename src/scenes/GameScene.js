import Phaser from "phaser";
import { axialToPixel } from "../utils/hexUtils.js";
import * as MatchLogic from "../game/matchLogic.js";
import * as ScoreSystem from "../game/scoreSystem.js";
import * as TileOps from "../game/tileOperations.js";

const TURN_FACTOR = 0.55;
const DEFAULT_UI_TOP = 60;
const PADDING = 16;
const QUEST_TARGET_PER_COLOR = 30;

// UI 색상 테마
const UI_COLORS = {
  bg: 0xF5E6D3,        // 베이지 배경
  cardBg: 0xFFFFFF,    // 흰색 카드
  accent: 0xE8D5C4,    // 연한 베이지
  textPrimary: 0x2C2C2C,  // 어두운 회색 텍스트
  textMuted: 0x8B7355,    // 갈색 음영 텍스트
  warning: 0xE74C3C,      // 빨간색 경고
  combo: 0xFF6B9D,        // 분홍색 콤보
  shadow: 0x000000,       // 그림자
};

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
      { id: 1, label: "보라", color: 0x5C4B8C },  // 부드러운 보라
      { id: 2, label: "회색", color: 0xB8B5A8 },  // 베이지 회색
      { id: 3, label: "초록", color: 0xA8C686 },  // 부드러운 연두
      { id: 4, label: "파랑", color: 0x6B9AC4 },  // 부드러운 파랑
      { id: 5, label: "노랑", color: 0xC8C67A },  // 부드러운 노랑
      { id: 6, label: "분홍", color: 0xE75A7C },  // 부드러운 분홍
    ];
    this.questRemaining = {};
    this.colorDefinitions.forEach((def) => {
      this.questRemaining[def.id] = QUEST_TARGET_PER_COLOR;
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
      .rectangle(0, 0, width, height, UI_COLORS.bg)
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
    const { width } = this.scale.gameSize;

    // 최고 점수 불러오기
    this.highScore = this.getHighScore();

    // 시간 컨테이너 (중앙 - 둥근 흰색 박스)
    this.timeContainer = this.add.container(0, 0).setDepth(100);

    // 시간 배경 (둥근 모서리 효과)
    this.timeBg = this.add.graphics();
    this.timeBg.fillStyle(UI_COLORS.cardBg, 1);
    this.timeBg.fillRoundedRect(-80, -25, 160, 50, 25);
    this.timeBg.lineStyle(2, UI_COLORS.accent, 0.3);
    this.timeBg.strokeRoundedRect(-80, -25, 160, 50, 25);

    // 그림자 효과
    this.timeShadow = this.add.graphics();
    this.timeShadow.fillStyle(UI_COLORS.shadow, 0.15);
    this.timeShadow.fillRoundedRect(-80, -23, 160, 50, 25);
    this.timeContainer.add(this.timeShadow);
    this.timeContainer.add(this.timeBg);

    this.timeLabelText = this.add.text(0, -12, "TIME", {
      fontSize: "10px",
      fill: "#8B7355",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    this.timeText = this.add.text(0, 0, "30.0", {
      fontSize: "24px",
      fill: "#2C2C2C",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    this.timeContainer.add([this.timeLabelText, this.timeText]);

    // 점수 컨테이너 (왼쪽 - 둥근 흰색 박스)
    this.scoreContainer = this.add.container(0, 0).setDepth(100);

    this.scoreBg = this.add.graphics();
    this.scoreBg.fillStyle(UI_COLORS.cardBg, 1);
    this.scoreBg.fillRoundedRect(-45, -25, 90, 50, 25);
    this.scoreBg.lineStyle(2, UI_COLORS.accent, 0.3);
    this.scoreBg.strokeRoundedRect(-45, -25, 90, 50, 25);

    this.scoreShadow = this.add.graphics();
    this.scoreShadow.fillStyle(UI_COLORS.shadow, 0.15);
    this.scoreShadow.fillRoundedRect(-45, -23, 90, 50, 25);
    this.scoreContainer.add(this.scoreShadow);
    this.scoreContainer.add(this.scoreBg);

    this.scoreLabelText = this.add.text(0, -12, "SCORE", {
      fontSize: "9px",
      fill: "#8B7355",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    this.scoreText = this.add.text(0, 0, "0", {
      fontSize: "20px",
      fill: "#2C2C2C",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    this.scoreContainer.add([this.scoreLabelText, this.scoreText]);

    // 최고 점수 (점수 컨테이너 아래)
    this.highScoreText = this.add.text(0, 0, `BEST ${this.highScore.toLocaleString()}`, {
      fontSize: "9px",
      fill: "#8B7355",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    // 콤보 컨테이너 (오른쪽 - 둥근 흰색 박스)
    this.comboContainer = this.add.container(0, 0).setDepth(100).setAlpha(0);

    this.comboBg = this.add.graphics();
    this.comboBg.fillStyle(UI_COLORS.cardBg, 1);
    this.comboBg.fillRoundedRect(-50, -25, 100, 50, 25);
    this.comboBg.lineStyle(2, 0xFF6B9D, 0.5);
    this.comboBg.strokeRoundedRect(-50, -25, 100, 50, 25);

    this.comboShadow = this.add.graphics();
    this.comboShadow.fillStyle(UI_COLORS.shadow, 0.15);
    this.comboShadow.fillRoundedRect(-50, -23, 100, 50, 25);
    this.comboContainer.add(this.comboShadow);
    this.comboContainer.add(this.comboBg);

    this.comboLabelText = this.add.text(0, -12, "COMBO", {
      fontSize: "10px",
      fill: "#8B7355",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    this.comboText = this.add.text(0, 0, "x2", {
      fontSize: "20px",
      fill: "#FF6B9D",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(101);

    this.comboContainer.add([this.comboLabelText, this.comboText]);
  }

  // localStorage에서 최고 점수 가져오기
  getHighScore() {
    const saved = localStorage.getItem('ice-breaker-top-scores');
    if (!saved) return 0;
    try {
      const scores = JSON.parse(saved);
      return scores[0] || 0;
    } catch {
      return 0;
    }
  }

  createQuestUIElements() {
    const { width } = this.scale.gameSize;

    this.questContainer = this.add.container(0, 0).setDepth(1000);

    this.questItems = new Map();
    this.colorDefinitions.forEach((def) => {
      const itemContainer = this.add.container(0, 0);

      // 둥근 칩 배경 (그림자 포함)
      const shadow = this.add.circle(0, 2, 16, UI_COLORS.shadow, 0.1);
      const chip = this.add
        .circle(0, 0, 16, def.color, 1)
        .setStrokeStyle(2, 0xffffff, 0.6);

      itemContainer.add([shadow, chip]);
      this.questContainer.add(itemContainer);
      this.questItems.set(def.id, { container: itemContainer, chip, shadow });
      this.updateQuestText(def.id);
    });
    this.layoutQuestUI(this.scale.gameSize);
  }

  layoutQuestUI(gameSize) {
    if (!this.questContainer) return;

    const { width } = gameSize;
    const isSmall = width <= 480;
    const chipRadius = isSmall ? 14 : 16;

    this.questBarHeight = chipRadius * 2 + 20;

    const totalWidth = this.colorDefinitions.length * (chipRadius * 2 + 12);
    const startX = (width - totalWidth) / 2;
    const itemY = this.uiTop || 100;

    this.colorDefinitions.forEach((def, index) => {
      const entry = this.questItems.get(def.id);
      if (!entry) return;

      const xPos = startX + index * (chipRadius * 2 + 12) + chipRadius;
      entry.container.setPosition(xPos, itemY);

      entry.chip.setRadius(chipRadius);
      entry.chip.setPosition(0, 0);
      entry.chip.setStrokeStyle(2, 0xffffff, 0.6);

      if (entry.shadow) {
        entry.shadow.setRadius(chipRadius);
        entry.shadow.setPosition(0, 2);
      }
    });
  }

  updateQuestText(colorId) {
    const entry = this.questItems?.get(colorId);
    const def = this.colorDefinitions.find((c) => c.id === colorId);
    if (!entry || !def) return;

    const remaining = this.questRemaining[colorId] ?? QUEST_TARGET_PER_COLOR;

    // 완료된 퀘스트는 투명도 조정
    if (remaining <= 0) {
      entry.chip.setAlpha(0.3);
      if (entry.shadow) entry.shadow.setAlpha(0.05);
    } else {
      entry.chip.setAlpha(1);
      if (entry.shadow) entry.shadow.setAlpha(0.1);
    }
  }

  applyQuestProgress(tile) {
    if (!tile) return;
    const colorId = tile.maxHp;
    if (this.questRemaining[colorId] === undefined) return;

    this.questRemaining[colorId] = Math.max(
      0,
      (this.questRemaining[colorId] ?? QUEST_TARGET_PER_COLOR) - 1,
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

    // 게임 그리드 배경 컨테이너 (둥근 모서리)
    this.gridBgContainer = this.add.container(this.gridCenter.x, this.gridCenter.y).setDepth(10);

    // 배경 그래픽 (나중에 크기 조정)
    this.gridBg = this.add.graphics().setDepth(10);
    this.gridBgShadow = this.add.graphics().setDepth(9);
    this.gridBgContainer.add([this.gridBgShadow, this.gridBg]);

    this.gridContainer = this.add.container(
      this.gridCenter.x,
      this.gridCenter.y,
    ).setDepth(20);

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
  createIceTile(q, r, skipClusterCheck = false) {
    const pos = axialToPixel(q, r, this.tileSize);
    const { x, y } = pos;

    // 클러스터 체크 없이 랜덤 HP 선택 (재생성 시)
    let maxHp;
    if (skipClusterCheck) {
      maxHp = Phaser.Math.Between(1, 6);
    } else {
      // 초기 생성 시: 5개 이상 클러스터가 생기지 않는 HP 선택
      maxHp = this.getSafeHp(q, r);
    }
    const textureKey = `tile_${maxHp - 1}`; // 개별 이미지 키

    // 육각 타일 스프라이트 생성
    const sprite = this.add.sprite(0, 0, textureKey);
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
    return tileData;
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
    return MatchLogic.getRotationTargets(centerTile, this.tiles);
  }

  // 회전 애니메이션 실행 후 좌표 스왑 적용
  playRotationAnimation(rotationTargets) {
    // 회전 효과음 재생
    this.sound.play("move");

    const nextPositions = MatchLogic.calculateRotationPositions(rotationTargets);

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
        }),
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
        }),
    );

    return Promise.all([...movementTweens, ...rotationTweens]).then(() => {
      this.applyRotationState(rotationTargets, nextPositions);
    });
  }

  // 회전 결과를 타일 좌표/맵에 반영
  applyRotationState(rotationTargets, nextPositions) {
    const updates = TileOps.createRotationUpdates(rotationTargets, nextPositions);

    // 기존 키 삭제
    updates.forEach(({ oldKey }) => {
      this.tiles.delete(oldKey);
    });

    // 타일 데이터 업데이트
    updates.forEach(({ tile, next }) => {
      TileOps.updateTileData(tile, next, this.tileSize);
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
      duration: 350,
      ease: "Back.easeIn",
      onComplete: () => {
        tile.container.destroy();
      },
    });

    this.scheduleWinLoseCheck();
  }

  // 회전으로 영향 받은 타일부터 시작해 전체 보드에서 동일 HP 3개 이상 클러스터 탐색
  findMatchingClusters(pivotTiles = []) {
    return MatchLogic.findMatchingClusters(this.tiles, pivotTiles);
  }

  // 찾은 클러스터를 순서대로 파괴
  destroyMatchedTiles(clusters) {
    if (!clusters || clusters.length === 0) return;

    // 파괴 효과음 재생
    this.sound.play("destroy");

    const now = this.time.now;
    this.combo = ScoreSystem.updateCombo(
      this.combo,
      this.lastMatchAt,
      now,
      this.comboWindowMs,
    );
    this.lastMatchAt = now;
    this.updateComboText();

    const comboMultiplier = ScoreSystem.getComboMultiplier(this.combo);
    const totalDestroyed = ScoreSystem.getTotalDestroyedCount(clusters);

    clusters.forEach((cluster, clusterIndex) => {
      cluster.forEach((tile) => {
        this.breakTile(tile, clusterIndex > 0);
      });
    });

    if (totalDestroyed > 0) {
      const earnedScore = ScoreSystem.calculateScore(
        totalDestroyed,
        comboMultiplier,
      );
      this.score += earnedScore;
      this.scoreText.setText(this.score.toLocaleString());

      // 최고 점수 갱신 시 표시 업데이트
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.highScoreText.setText(`BEST ${this.highScore.toLocaleString()}`);
        this.highScoreText.setFill("#00d4ff");
      }
    }

    const timeBonus = ScoreSystem.calculateTimeBonus(clusters, comboMultiplier);
    if (timeBonus > 0) {
      this.addTimeBonus(timeBonus);
    }
  }

  // 콤보 텍스트 갱신
  updateComboText() {
    if (this.combo > 1) {
      this.comboContainer?.setAlpha(1);
      this.comboText.setText(`x${this.combo}`);

      // 콤보 애니메이션
      this.tweens.add({
        targets: this.comboContainer,
        scale: { from: 1.2, to: 1 },
        duration: 150,
        ease: "Back.easeOut",
      });
    } else {
      this.comboContainer?.setAlpha(0);
      this.comboText.setText("x2");
    }
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
        const createdTiles = [];
        brokenTiles.forEach(({ q, r }) => {
          const tile = this.createIceTile(q, r, true); // 재생성 시 클러스터 체크 스킵
          if (tile) {
            createdTiles.push(tile);
          }
        });
        const clusters = this.findMatchingClusters(createdTiles);
        if (clusters.length > 0) {
          this.destroyMatchedTiles(clusters);
          this.updateBoardStateAfterMatches().then(resolve);
          return;
        }
        resolve();
      });
    });
  }

  // 화면 크기 변경 시 UI/그리드 재배치
  onResize(gameSize) {
    const { width, height } = gameSize;
    const isSmall = width <= 480;
    const isVerySmall = width <= 360;

    // 폰트 크기 계산
    const labelSize = isVerySmall ? 9 : isSmall ? 10 : 11;
    const scoreSize = isVerySmall ? 22 : isSmall ? 24 : 28;
    const timeSize = isVerySmall ? 26 : isSmall ? 28 : 32;
    const comboSize = isVerySmall ? 22 : isSmall ? 24 : 28;
    const bestSize = isVerySmall ? 8 : isSmall ? 9 : 10;

    // UI 바 높이
    const uiBarHeight = isVerySmall ? 65 : isSmall ? 70 : 80;

    this.updateLayoutConfig(gameSize);
    this.layoutQuestUI(gameSize);

    if (this.background) {
      this.background.setSize(width, height);
    }

    // 상단 UI 위치
    const topY = isVerySmall ? 30 : isSmall ? 35 : 40;
    const leftX = isVerySmall ? 65 : isSmall ? 70 : 80;
    const rightX = width - leftX;

    // 점수 컨테이너 (왼쪽)
    this.scoreContainer?.setPosition(leftX, topY);
    this.scoreLabelText?.setFontSize(isVerySmall ? 8 : labelSize - 1);
    this.scoreText?.setFontSize(isVerySmall ? 18 : isSmall ? 20 : 22);
    this.highScoreText?.setFontSize(bestSize).setPosition(leftX, topY + 35);

    // 시간 컨테이너 (중앙)
    this.timeContainer?.setPosition(width / 2, topY);
    this.timeLabelText?.setFontSize(isVerySmall ? 9 : labelSize);
    this.timeText?.setFontSize(isVerySmall ? 20 : isSmall ? 22 : 24);

    // 콤보 컨테이너 (오른쪽)
    this.comboContainer?.setPosition(rightX, topY);
    this.comboLabelText?.setFontSize(isVerySmall ? 9 : labelSize);
    this.comboText?.setFontSize(isVerySmall ? 18 : isSmall ? 20 : 22);

    this.uiTop = topY + 60;

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
            this.getTileDisplaySize(),
          );
        }
        tile.positionText.setFontSize(this.getHpFontSize());
        tile.container.setSize(
          this.getTouchAreaSize(),
          this.getTouchAreaSize(),
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
        1,
      );
      this.gridContainer.setScale(scale);
      this.gridContainer.setPosition(gridCenterX, gridCenterY);

      // 그리드 배경 그리기
      if (this.gridBg && this.gridBgShadow) {
        const padding = 30;
        const bgWidth = bounds.width * scale + padding * 2;
        const bgHeight = bounds.height * scale + padding * 2;
        const bgX = -bgWidth / 2;
        const bgY = -bgHeight / 2;
        const radius = 30;

        // 그림자
        this.gridBgShadow.clear();
        this.gridBgShadow.fillStyle(UI_COLORS.shadow, 0.15);
        this.gridBgShadow.fillRoundedRect(bgX, bgY + 5, bgWidth, bgHeight, radius);

        // 배경
        this.gridBg.clear();
        this.gridBg.fillStyle(UI_COLORS.bg, 1);
        this.gridBg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
        this.gridBg.lineStyle(3, UI_COLORS.accent, 0.3);
        this.gridBg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
      }

      if (this.gridBgContainer) {
        this.gridBgContainer.setPosition(gridCenterX, gridCenterY);
      }
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
        `TURNS: ${this.turnsRemaining} / ${this.turnsTotal}`,
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
    this.timeText.setText(this.timeLeft.toFixed(1));

    // 시간 경고 (10초 이하일 때 빨간색)
    if (this.timeLeft <= 10) {
      this.timeText.setFill("#ff6b6b");
    } else {
      this.timeText.setFill("#ffffff");
    }
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
        },
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
      tileSize = 36;
      gridRadius = 3;
    } else if (width <= 480) {
      tileSize = 42;
      gridRadius = 3;
    } else if (width <= 720) {
      tileSize = 51;
      gridRadius = 4;
    } else {
      tileSize = 60;
      gridRadius = 4;
    }

    this.tileDisplaySize = tileSize * 2;
    this.tileSize = this.tileDisplaySize / Math.sqrt(3);
    if (!this.gridRadius) {
      this.gridRadius = gridRadius;
    }
  }

  // 타일 크기와 터치 여부에 따른 HP 폰트 크기
  getHpFontSize() {
    const displaySize = this.tileDisplaySize;
    if (displaySize <= 48) return 14;
    if (displaySize <= 56) return this.isTouch ? 16 : 18;
    if (displaySize <= 68) return this.isTouch ? 18 : 20;
    return this.isTouch ? 20 : 22;
  }

  // 기어 스프라이트의 표시 지름
  getTileDisplaySize() {
    return this.tileDisplaySize;
  }

  // 터치 디바이스에 맞춘 터치 영역 크기
  getTouchAreaSize() {
    // 클릭/터치 영역을 줄여서 겹침 클릭을 방지
    return this.isTouch
      ? this.tileDisplaySize * 0.9
      : this.tileDisplaySize * 0.7;
  }

  // 5개 이상 클러스터가 생기지 않는 HP 값 선택
  getSafeHp(q, r) {
    const maxClusterSize = 4; // 4개까지만 허용
    const allHps = [1, 2, 3, 4, 5, 6];

    // 랜덤하게 섞어서 시도
    const shuffled = Phaser.Utils.Array.Shuffle([...allHps]);

    for (const hp of shuffled) {
      const clusterSize = MatchLogic.getClusterSizeIfPlaced(this.tiles, q, r, hp);
      if (clusterSize <= maxClusterSize) {
        return hp;
      }
    }

    // 모든 HP가 5개 이상 클러스터를 만든다면 가장 작은 클러스터를 만드는 HP 선택
    let minSize = Infinity;
    let bestHp = 1;
    for (const hp of allHps) {
      const clusterSize = MatchLogic.getClusterSizeIfPlaced(this.tiles, q, r, hp);
      if (clusterSize < minSize) {
        minSize = clusterSize;
        bestHp = hp;
      }
    }
    return bestHp;
  }

  // 타일의 z-순서를 일관되게 맞춰 겹침을 방지
  updateTileDepth(tile) {
    if (!tile || !tile.container) return;
    const depth = TileOps.calculateTileDepth(tile.q, tile.r, this.gridRadius);
    tile.container.setDepth(depth);
  }
}
