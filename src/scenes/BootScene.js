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

    // 배경
    if (!this.background) {
      this.background = this.add.rectangle(0, 0, width, height, 0xF5E6D3).setOrigin(0);
    } else {
      this.background.setSize(width, height);
    }

    if (!this.loadingText) {
      this.loadingText = this.add
        .text(width / 2, height / 2 - 50, "로딩중..", {
          fontSize: `${fontSize}px`,
          fill: "#2C2C2C",
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
    this.progressBox.fillStyle(0xE8D5C4, 1);
    this.progressBox.fillRoundedRect(
      width / 2 - barWidth / 2,
      height / 2,
      barWidth,
      barHeight,
      10
    );
    this.progressBox.lineStyle(2, 0xD0BFA8, 0.5);
    this.progressBox.strokeRoundedRect(
      width / 2 - barWidth / 2,
      height / 2,
      barWidth,
      barHeight,
      10
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
    this.progressBar.fillStyle(0xE75A7C, 1);
    const innerBarWidth = barWidth - 20;
    const innerBarHeight = barHeight - 20;
    this.progressBar.fillRoundedRect(
      width / 2 - innerBarWidth / 2,
      height / 2 + 10,
      innerBarWidth * value,
      innerBarHeight,
      8
    );
  }

  onResize(gameSize) {
    this.updateLoadingLayout(gameSize);
  }

  onShutdown() {
    this.scale.off("resize", this.onResize, this);
  }
}
