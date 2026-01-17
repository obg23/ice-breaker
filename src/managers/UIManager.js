/**
 * UIManager
 * UI 요소 생성, 업데이트 및 레이아웃 관리
 */

const PADDING = 16;
const DEFAULT_UI_TOP = 60;

export default class UIManager {
  constructor(scene, colorDefinitions) {
    this.scene = scene;
    this.colorDefinitions = colorDefinitions;
    this.questBarHeight = 72;
  }

  // UI 요소 생성
  createUI() {
    // 점수 표시
    this.scoreText = this.scene.add.text(0, 0, "점수: 0", {
      fontSize: "24px",
      fill: "#ffffff",
      fontStyle: "bold",
    });

    // 시간 표시
    this.timeText = this.scene.add
      .text(0, 0, "TIME: 30.0", {
        fontSize: "24px",
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    // 콤보 표시
    this.comboText = this.scene.add
      .text(0, 0, "", {
        fontSize: "28px",
        fill: "#ffff00",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);
  }

  // 퀘스트 UI 생성 (현재 숨김)
  createQuestUIElements(questRemaining) {
    const { width } = this.scene.scale.gameSize;
    const bgWidth = Math.max(200, width - PADDING * 2);

    this.questContainer = this.scene.add.container(0, 0).setDepth(1000);
    this.questBg = this.scene.add
      .rectangle(PADDING, PADDING, bgWidth, this.questBarHeight, 0x0d2030, 0.75)
      .setOrigin(0, 0);
    this.questTitle = this.scene.add
      .text(PADDING + 10, PADDING + 8, "색깔별로 30개 파괴", {
        fontSize: "18px",
        fill: "#cce7ff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.questContainer.add([this.questBg, this.questTitle]);

    this.questItems = new Map();
    this.colorDefinitions.forEach((def) => {
      const itemContainer = this.scene.add.container(0, 0);
      const chip = this.scene.add
        .circle(0, 0, 9, def.color, 1)
        .setStrokeStyle(1, 0xffffff, 0.8);
      const text = this.scene.add
        .text(0, 0, "", {
          fontSize: "16px",
          fill: this.toHexColor(def.color),
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
      itemContainer.add([chip, text]);
      this.questContainer.add(itemContainer);
      this.questItems.set(def.id, { container: itemContainer, chip, text });
      this.updateQuestText(def.id, questRemaining);
    });
    this.layoutQuestUI(this.scene.scale.gameSize);
  }

  // 퀘스트 UI 레이아웃 조정
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

      entry.container.setPosition(PADDING + slotWidth * index + 6, itemY);

      entry.chip.setRadius(chipRadius);
      entry.chip.setPosition(0, 0);
      entry.chip.setStrokeStyle(1, 0xffffff, 0.8);

      entry.text.setFontSize(questFontSize);
      entry.text.setColor(this.toHexColor(def.color));
      entry.text.setPosition(chipRadius * 2 + 6, 0);
    });
  }

  // 퀘스트 텍스트 업데이트
  updateQuestText(colorId, questRemaining) {
    const entry = this.questItems?.get(colorId);
    if (!entry) return;
    const remaining = questRemaining[colorId] ?? 0;
    entry.text.setText(`${remaining}`);
  }

  // 점수 업데이트
  updateScore(score) {
    this.scoreText.setText(`점수: ${score}`);
  }

  // 시간 업데이트
  updateTime(timeLeft) {
    this.timeText.setText(`TIME: ${timeLeft.toFixed(1)}`);
  }

  // 콤보 업데이트
  updateCombo(combo) {
    if (combo > 1) {
      this.comboText.setText(`${combo} COMBO!`);
    } else {
      this.comboText.setText("");
    }
  }

  // 리사이즈 처리
  onResize(gameSize) {
    const { width, height } = gameSize;
    const isSmall = width <= 480;
    const fontSize = isSmall ? (width <= 360 ? 18 : 20) : 24;
    const comboFontSize = isSmall ? (width <= 360 ? 22 : 24) : 28;

    const uiTop = this.questBarHeight || DEFAULT_UI_TOP;
    const statsY = uiTop + PADDING + 6;

    // 점수 위치 (좌상단)
    this.scoreText.setPosition(PADDING, statsY);
    this.scoreText.setFontSize(fontSize);

    // 시간 위치 (중앙 상단)
    this.timeText.setPosition(width / 2, statsY);
    this.timeText.setFontSize(fontSize);

    // 콤보 위치 (우상단)
    this.comboText.setPosition(width - PADDING, statsY);
    this.comboText.setFontSize(comboFontSize);

    // 퀘스트 UI 레이아웃 조정
    if (this.questContainer) {
      this.layoutQuestUI(gameSize);
    }
  }

  // 색상을 hex 문자열로 변환
  toHexColor(color) {
    return "#" + color.toString(16).padStart(6, "0");
  }

  destroy() {
    // UI 요소 정리
    this.scoreText?.destroy();
    this.timeText?.destroy();
    this.comboText?.destroy();
    this.questContainer?.destroy();
  }
}
