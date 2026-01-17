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
    // this.load.audio('crack', '/assets/crack.mp3');
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

    if (!this.loadingText) {
      this.loadingText = this.add
        .text(width / 2, height / 2 - 50, "濡쒕뵫 以?..", {
          fontSize: `${fontSize}px`,
          fill: "#ffffff",
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
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(
      width / 2 - barWidth / 2,
      height / 2,
      barWidth,
      barHeight
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
    this.progressBar.fillStyle(0x00ffff, 1);
    const innerBarWidth = barWidth - 20;
    const innerBarHeight = barHeight - 20;
    this.progressBar.fillRect(
      width / 2 - innerBarWidth / 2,
      height / 2 + 10,
      innerBarWidth * value,
      innerBarHeight
    );
  }

  onResize(gameSize) {
    this.updateLoadingLayout(gameSize);
  }

  onShutdown() {
    this.scale.off("resize", this.onResize, this);
  }
}
