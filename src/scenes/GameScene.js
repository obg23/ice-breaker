import Phaser from "phaser";
import { axialToPixel } from "../utils/hexUtils.js";
import * as MatchLogic from "../game/matchLogic.js";
import * as ScoreSystem from "../game/scoreSystem.js";
import * as TileOps from "../game/tileOperations.js";

const TURN_FACTOR = 0.55;
const DEFAULT_UI_TOP = 60;
const PADDING = 16;
const QUEST_TARGET_PER_COLOR = 30;

// UI 색상 테마 (다크 모드)
const UI_COLORS = {
  bg: 0x1a1a2e,           // 다크 네이비 배경
  cardBg: 0x2d2d44,       // 어두운 카드 배경
  slotBg: 0x3d3d5c,       // 빈 슬롯 배경
  accent: 0x4a4a6a,       // 액센트 색상
  textPrimary: 0xFFFFFF,  // 흰색 텍스트
  textMuted: 0x9999aa,    // 연한 회색 텍스트
  warning: 0xff6b6b,      // 빨간색 경고
  combo: 0xFFD700,        // 골드 콤보
  shadow: 0x000000,       // 그림자
  highlight: 0x00d4ff,    // 하이라이트
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
    // 밝고 선명한 색상 (이미지 참조)
    this.colorDefinitions = [
      { id: 1, label: "빨강", color: 0xf85555 },   // 밝은 빨강
      { id: 2, label: "주황", color: 0xffa54f },   // 밝은 주황
      { id: 3, label: "노랑", color: 0xfff06b },   // 밝은 노랑
      { id: 4, label: "연두", color: 0xa6e55c },   // 밝은 연두
      { id: 5, label: "파랑", color: 0x5cb8e5 },   // 밝은 파랑
      { id: 6, label: "분홍", color: 0xf06bce },   // 밝은 분홍
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

  // 점수/턴/콤보 텍스트 UI 생성 (다크 테마)
  createUI() {
    const { width } = this.scale.gameSize;

    // 최고 점수 불러오기
    this.highScore = this.getHighScore();

    // 게임 타이틀
    this.titleText = this.add.text(width / 2, 20, "Ice Breaker!", {
      fontSize: "24px",
      fill: "#ffffff",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(100);

    // 트로피 아이콘 (텍스트로 대체)
    this.trophyIcon = this.add.text(0, 0, "🏆", {
      fontSize: "28px",
    }).setOrigin(0.5).setDepth(100);

    // 점수 (큰 숫자, 중앙)
    this.scoreText = this.add.text(width / 2, 55, "0", {
      fontSize: "48px",
      fill: "#ffffff",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0.5, 0).setDepth(100);

    // 일시정지 아이콘 (텍스트로 대체)
    this.pauseIcon = this.add.text(0, 0, "⏸", {
      fontSize: "28px",
    }).setOrigin(0.5).setDepth(100);

    // 정보 바 (BEST | TIME)
    this.infoBg = this.add.graphics().setDepth(99);

    this.infoContainer = this.add.container(width / 2, 120).setDepth(100);

    this.bestLabelText = this.add.text(-60, 0, `🏆 ${this.highScore.toLocaleString()}`, {
      fontSize: "14px",
      fill: "#9999aa",
      fontFamily: "Arial",
    }).setOrigin(0.5).setDepth(100);

    this.dividerText = this.add.text(0, 0, "|", {
      fontSize: "14px",
      fill: "#4a4a6a",
      fontFamily: "Arial",
    }).setOrigin(0.5).setDepth(100);

    this.timeIconText = this.add.text(60, 0, "⏱", {
      fontSize: "14px",
    }).setOrigin(0.5).setDepth(100);

    this.timeValueText = this.add.text(90, 0, "30.0", {
      fontSize: "14px",
      fill: "#ffffff",
      fontFamily: "Arial",
    }).setOrigin(0, 0.5).setDepth(100);

    this.infoContainer.add([this.bestLabelText, this.dividerText, this.timeIconText, this.timeValueText]);

    // 시간 컨테이너 (별 아이콘 스타일)
    this.timeContainer = this.add.container(width / 2, 155).setDepth(100);

    this.starIcon = this.add.text(-30, 0, "✦", {
      fontSize: "18px",
      fill: "#ffd700",
    }).setOrigin(0.5).setDepth(101);

    this.timeText = this.add.text(10, 0, "30.0", {
      fontSize: "18px",
      fill: "#ffffff",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0, 0.5).setDepth(101);

    this.timeContainer.add([this.starIcon, this.timeText]);

    // 콤보 컨테이너 (오른쪽 상단)
    this.comboContainer = this.add.container(0, 0).setDepth(100).setAlpha(0);

    this.comboBg = this.add.graphics();
    this.comboBg.fillStyle(0x2d2d44, 0.9);
    this.comboBg.fillRoundedRect(-45, -20, 90, 40, 20);
    this.comboBg.lineStyle(2, 0xffd700, 0.8);
    this.comboBg.strokeRoundedRect(-45, -20, 90, 40, 20);
    this.comboContainer.add(this.comboBg);

    this.comboText = this.add.text(0, 0, "x2", {
      fontSize: "22px",
      fill: "#ffd700",
      fontStyle: "bold",
      fontFamily: "Arial",
    }).setOrigin(0.5).setDepth(101);

    this.comboContainer.add(this.comboText);

    // 하단 버튼 컨테이너
    this.createBottomButtons();
  }

  // 하단 버튼 생성
  createBottomButtons() {
    const { width, height } = this.scale.gameSize;

    this.bottomButtonsContainer = this.add.container(width / 2, height - 80).setDepth(100);

    // 왼쪽 버튼 (셔플 기능)
    this.leftButtonBg = this.add.graphics();
    this.leftButtonBg.fillStyle(0x2d2d44, 1);
    this.leftButtonBg.fillRoundedRect(-130, -30, 120, 60, 15);
    this.leftButtonBg.lineStyle(2, 0x4a4a6a, 0.5);
    this.leftButtonBg.strokeRoundedRect(-130, -30, 120, 60, 15);

    this.leftButtonIcon = this.add.text(-95, -5, "🔄", {
      fontSize: "24px",
    }).setOrigin(0.5);

    this.leftButtonText = this.add.text(-55, -5, "👑", {
      fontSize: "16px",
    }).setOrigin(0.5);

    this.leftButtonValue = this.add.text(-30, -5, "100", {
      fontSize: "14px",
      fill: "#9999aa",
      fontFamily: "Arial",
    }).setOrigin(0, 0.5);

    // 오른쪽 버튼 (힌트 기능)
    this.rightButtonBg = this.add.graphics();
    this.rightButtonBg.fillStyle(0x2d2d44, 1);
    this.rightButtonBg.fillRoundedRect(10, -30, 120, 60, 15);
    this.rightButtonBg.lineStyle(2, 0x4a4a6a, 0.5);
    this.rightButtonBg.strokeRoundedRect(10, -30, 120, 60, 15);

    this.rightButtonIcon = this.add.text(45, -5, "↗", {
      fontSize: "24px",
      fill: "#ffffff",
    }).setOrigin(0.5);

    this.rightButtonText = this.add.text(85, -5, "👑", {
      fontSize: "16px",
    }).setOrigin(0.5);

    this.rightButtonValue = this.add.text(110, -5, "100", {
      fontSize: "14px",
      fill: "#9999aa",
      fontFamily: "Arial",
    }).setOrigin(0, 0.5);

    this.bottomButtonsContainer.add([
      this.leftButtonBg, this.leftButtonIcon, this.leftButtonText, this.leftButtonValue,
      this.rightButtonBg, this.rightButtonIcon, this.rightButtonText, this.rightButtonValue
    ]);
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

  // 단일 타일 생성 및 클릭 이벤트 연결 (둥근 모서리 정사각형)
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

    // 컨테이너로 타일 묶기
    const container = this.add.container(x, y);

    // 타일 색상 가져오기
    const colorDef = this.colorDefinitions[maxHp - 1];
    const tileColor = colorDef ? colorDef.color : 0xffffff;

    // 둥근 모서리 정사각형 타일 그리기
    const tileSize = this.getTileDisplaySize() * 0.85;
    const borderRadius = tileSize * 0.2;

    // 그림자 효과
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-tileSize / 2 + 2, -tileSize / 2 + 2, tileSize, tileSize, borderRadius);
    container.add(shadow);

    // 메인 타일 배경
    const tileGraphics = this.add.graphics();
    tileGraphics.fillStyle(tileColor, 1);
    tileGraphics.fillRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, borderRadius);

    // 하이라이트 효과 (상단)
    tileGraphics.fillStyle(0xffffff, 0.3);
    tileGraphics.fillRoundedRect(-tileSize / 2 + 4, -tileSize / 2 + 4, tileSize - 8, tileSize * 0.3, borderRadius * 0.5);

    container.add(tileGraphics);

    // 기존 스프라이트도 생성 (회전 애니메이션 호환성)
    const textureKey = `tile_${maxHp - 1}`;
    const sprite = this.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(tileSize, tileSize);
    sprite.setVisible(false); // 숨김 처리 (Graphics 사용)

    // 좌표 디버그 텍스트 (q,r 표기)
    const positionText = this.add
      .text(0, 0, `${q},${r}`, {
        fontSize: `${this.getHpFontSize()}px`,
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    // container.add(positionText); // 디버그용

    this.gridContainer.add(container);

    // 타일 데이터
    const tileData = {
      q,
      r,
      hp: maxHp,
      maxHp,
      container,
      sprite,
      tileGraphics,
      shadow,
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

    // 파괴 파티클 효과 (타일 색상 사용)
    const colorDef = this.colorDefinitions[tile.maxHp - 1];
    const tileColor = colorDef ? colorDef.color : 0xffffff;

    // 파괴 애니메이션
    this.tweens.add({
      targets: tile.container,
      alpha: 0,
      scale: 1.3,
      duration: 300,
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
        if (this.bestLabelText) {
          this.bestLabelText.setText(`🏆 ${this.highScore.toLocaleString()}`);
          this.bestLabelText.setFill("#00d4ff");
        }
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
    const titleSize = isVerySmall ? 20 : isSmall ? 22 : 24;
    const scoreSize = isVerySmall ? 36 : isSmall ? 42 : 48;
    const infoSize = isVerySmall ? 12 : isSmall ? 13 : 14;
    const timeSize = isVerySmall ? 16 : isSmall ? 17 : 18;
    const comboSize = isVerySmall ? 18 : isSmall ? 20 : 22;
    const iconSize = isVerySmall ? 24 : isSmall ? 26 : 28;

    this.updateLayoutConfig(gameSize);
    this.layoutQuestUI(gameSize);

    if (this.background) {
      this.background.setSize(width, height);
    }

    // 타이틀
    this.titleText?.setFontSize(titleSize).setPosition(width / 2, 20);

    // 트로피 & 일시정지 아이콘
    const iconY = isVerySmall ? 70 : isSmall ? 75 : 80;
    this.trophyIcon?.setFontSize(iconSize).setPosition(50, iconY);
    this.pauseIcon?.setFontSize(iconSize).setPosition(width - 50, iconY);

    // 점수 (큰 숫자)
    const scoreY = isVerySmall ? 50 : isSmall ? 55 : 55;
    this.scoreText?.setFontSize(scoreSize).setPosition(width / 2, scoreY);

    // 정보 바
    const infoY = isVerySmall ? 110 : isSmall ? 115 : 120;
    this.infoContainer?.setPosition(width / 2, infoY);
    this.bestLabelText?.setFontSize(infoSize);
    this.dividerText?.setFontSize(infoSize);
    this.timeIconText?.setFontSize(infoSize);
    this.timeValueText?.setFontSize(infoSize);

    // 시간 컨테이너 (별 아이콘)
    const starY = isVerySmall ? 145 : isSmall ? 150 : 155;
    this.timeContainer?.setPosition(width / 2, starY);
    this.starIcon?.setFontSize(timeSize);
    this.timeText?.setFontSize(timeSize);

    // 콤보 컨테이너
    const comboY = isVerySmall ? 145 : isSmall ? 150 : 155;
    this.comboContainer?.setPosition(width - 80, comboY);
    this.comboText?.setFontSize(comboSize);

    // 하단 버튼 위치
    this.bottomButtonsContainer?.setPosition(width / 2, height - 80);

    // UI 영역 높이 계산
    this.uiTop = starY + 40;
    const bottomPadding = 120; // 하단 버튼 영역

    const gridCenterX = width / 2;
    const gridCenterY = this.uiTop + (height - this.uiTop - bottomPadding) / 2;

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
      const availableH = height - this.uiTop - bottomPadding - PADDING * 2;
      const scale = Math.min(
        availableW / bounds.width,
        availableH / bounds.height,
        1,
      );
      this.gridContainer.setScale(scale);
      this.gridContainer.setPosition(gridCenterX, gridCenterY);

      // 그리드 배경 그리기 (다크 테마)
      if (this.gridBg && this.gridBgShadow) {
        const padding = 25;
        const bgWidth = bounds.width * scale + padding * 2;
        const bgHeight = bounds.height * scale + padding * 2;
        const bgX = -bgWidth / 2;
        const bgY = -bgHeight / 2;
        const radius = 20;

        // 그림자
        this.gridBgShadow.clear();
        this.gridBgShadow.fillStyle(UI_COLORS.shadow, 0.3);
        this.gridBgShadow.fillRoundedRect(bgX + 3, bgY + 3, bgWidth, bgHeight, radius);

        // 배경 (어두운 슬롯 색상)
        this.gridBg.clear();
        this.gridBg.fillStyle(UI_COLORS.cardBg, 1);
        this.gridBg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
        this.gridBg.lineStyle(2, UI_COLORS.accent, 0.5);
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

    // 정보 바의 시간도 업데이트
    if (this.timeValueText) {
      this.timeValueText.setText(this.timeLeft.toFixed(1));
    }

    // 시간 경고 (10초 이하일 때 빨간색)
    if (this.timeLeft <= 10) {
      this.timeText.setFill("#ff6b6b");
      if (this.timeValueText) this.timeValueText.setFill("#ff6b6b");
      if (this.starIcon) this.starIcon.setFill("#ff6b6b");
    } else {
      this.timeText.setFill("#ffffff");
      if (this.timeValueText) this.timeValueText.setFill("#ffffff");
      if (this.starIcon) this.starIcon.setFill("#ffd700");
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
