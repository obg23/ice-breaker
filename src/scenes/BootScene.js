import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.loadingProgress = 0;
    this.updateLoadingLayout(this.scale.gameSize);

    this.scale.on("resize", this.onResize, this);
    this.events.on("shutdown", this.onShutdown, this);

    this.load.on("progress", (value) => {
      this.updateProgressBar(value);
    });

    this.load.on("complete", () => {
      this.progressBar?.destroy();
      this.progressBox?.destroy();
      this.loadingText?.destroy();
    });

    // 개별 타일 이미지 6개 로드
    this.load.image("tile_0", "assets/tiles/tile_1.png");
    this.load.image("tile_1", "assets/tiles/tile_2.png");
    this.load.image("tile_2", "assets/tiles/tile_3.png");
    this.load.image("tile_3", "assets/tiles/tile_4.png");
    this.load.image("tile_4", "assets/tiles/tile_5.png");
    this.load.image("tile_5", "assets/tiles/tile_6.png");

    // 파티클 이미지 로드
    this.load.image("particle", "assets/tiles/particle.png");

    // 효과음 로드
    this.load.audio("move", "assets/sounds/move.mp3");
    this.load.audio("destroy", "assets/sounds/destroy.mp3");
  }

  create() {
    this.scene.start("GameScene");
  }

  updateLoadingLayout(gameSize) {
    this.lastGameSize = gameSize;
    const { width, height } = gameSize;
    const isSmallWidth = width <= 480;

    const fontSize = isSmallWidth ? (width <= 360 ? 18 : 20) : 24;
    const barWidth = isSmallWidth ? Math.min(width - 80, 280) : 320;
    const barHeight = isSmallWidth ? 40 : 50;

    this.loadingDimensions = { barWidth, barHeight, fontSize };

    // 배경 (다크 네이비)
    if (!this.background) {
      this.background = this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);
    } else {
      this.background.setSize(width, height);
    }

    // 타이틀
    if (!this.titleText) {
      this.titleText = this.add
        .text(width / 2, height / 2 - 100, "Ice Breaker!", {
          fontSize: `${fontSize + 8}px`,
          fill: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    } else {
      this.titleText.setFontSize(fontSize + 8);
      this.titleText.setPosition(width / 2, height / 2 - 100);
    }

    if (!this.loadingText) {
      this.loadingText = this.add
        .text(width / 2, height / 2 - 50, "로딩중..", {
          fontSize: `${fontSize}px`,
          fill: "#9999aa",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    } else {
      this.loadingText.setFontSize(fontSize);
      this.loadingText.setPosition(width / 2, height / 2 - 50);
    }

    if (!this.progressBox) {
      this.progressBox = this.add.graphics();
    }
    this.progressBox.clear();
    this.progressBox.fillStyle(0x2d2d44, 1);
    this.progressBox.fillRoundedRect(
      width / 2 - barWidth / 2,
      height / 2,
      barWidth,
      barHeight,
      15
    );
    this.progressBox.lineStyle(2, 0x4a4a6a, 0.5);
    this.progressBox.strokeRoundedRect(
      width / 2 - barWidth / 2,
      height / 2,
      barWidth,
      barHeight,
      15
    );

    if (!this.progressBar) {
      this.progressBar = this.add.graphics();
    }
    this.updateProgressBar(this.loadingProgress);
  }

  updateProgressBar(value) {
    this.loadingProgress = value;
    if (!this.progressBar || !this.loadingDimensions || !this.lastGameSize)
      return;

    const { width, height } = this.lastGameSize;
    const { barWidth, barHeight } = this.loadingDimensions;

    this.progressBar.clear();
    // 그라데이션 효과를 위한 밝은 색상
    this.progressBar.fillStyle(0x00d4ff, 1);
    const innerBarWidth = barWidth - 16;
    const innerBarHeight = barHeight - 16;
    const progressWidth = Math.max(innerBarHeight, innerBarWidth * value);
    this.progressBar.fillRoundedRect(
      width / 2 - innerBarWidth / 2,
      height / 2 + 8,
      progressWidth,
      innerBarHeight,
      12
    );
  }

  onResize(gameSize) {
    this.updateLoadingLayout(gameSize);
  }

  onShutdown() {
    this.scale.off("resize", this.onResize, this);
  }
}
