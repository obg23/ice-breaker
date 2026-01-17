/**
 * TileManager
 * 타일 생성, 회전, 파괴, 재생성 관리
 */
import Phaser from "phaser";
import { axialToPixel, getNeighbors } from "../utils/hexUtils.js";

const TURN_FACTOR = 0.55;

export default class TileManager {
  constructor(scene, gridRadius, tileSize, colorDefinitions) {
    this.scene = scene;
    this.gridRadius = gridRadius;
    this.tileSize = tileSize;
    this.colorDefinitions = colorDefinitions;
    this.tiles = new Map();
    this.gridContainer = null;
    this.gridCenter = null;
    this.isTouch = this.scene.sys.game.device.input.touch;
  }

  // 그리드 컨테이너 초기화
  initializeGrid() {
    const { width, height } = this.scene.scale.gameSize;
    this.gridCenter = { x: width / 2, y: height / 2 };
    this.gridContainer = this.scene.add.container(
      this.gridCenter.x,
      this.gridCenter.y,
    );
  }

  // 육각형 그리드 생성
  createHexGrid(onClickHandler) {
    this.initializeGrid();

    for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
      const r1 = Math.max(-this.gridRadius, -q - this.gridRadius);
      const r2 = Math.min(this.gridRadius, -q + this.gridRadius);

      for (let r = r1; r <= r2; r++) {
        this.createTile(q, r, onClickHandler);
      }
    }
  }

  // 단일 육각 타일 생성
  createTile(q, r, onClickHandler) {
    const pos = axialToPixel(q, r, this.tileSize);
    const { x, y } = pos;

    // 랜덤 HP (1~6)
    const maxHp = Phaser.Math.Between(1, 6);
    const textureKey = `tile_${maxHp - 1}`;

    // 육각 타일 스프라이트 생성
    const sprite = this.scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5);
    sprite.setDisplaySize(this.getTileDisplaySize(), this.getTileDisplaySize());

    // 컨테이너로 육각형과 텍스트 묶기
    const container = this.scene.add.container(x, y);
    container.add(sprite);

    // 좌표 디버그 텍스트 (필요시 활성화)
    const positionText = this.scene.add
      .text(0, 0, `${q},${r}`, {
        fontSize: `${this.getHpFontSize()}px`,
        fill: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

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

    // 터치/클릭 이벤트 - 콜백으로 받은 핸들러 사용
    container.setSize(this.getTouchAreaSize(), this.getTouchAreaSize());
    container.setInteractive();

    if (onClickHandler) {
      container.on("pointerdown", () => onClickHandler(tileData));
    }

    // Map에 저장
    this.tiles.set(`${q},${r}`, tileData);
    return tileData;
  }

  // 타일 파괴
  breakTile(tile) {
    if (tile.isBroken) return;

    tile.isBroken = true;

    // 파괴 애니메이션
    this.scene.tweens.add({
      targets: tile.container,
      alpha: 0,
      scale: 1.5,
      duration: 350,
      ease: "Back.easeIn",
      onComplete: () => {
        tile.container.destroy();
      },
    });
  }

  // 회전 대상 타일 선택 (클릭한 타일 + 시계방향 인접 2개)
  getRotationTargets(tile) {
    const neighbors = getNeighbors(tile.q, tile.r);
    const validNeighbors = neighbors
      .map(({ q, r }) => this.tiles.get(`${q},${r}`))
      .filter((n) => n && !n.isBroken);

    if (validNeighbors.length < 2) return null;

    return [tile, validNeighbors[0], validNeighbors[1]];
  }

  // 회전 애니메이션 실행
  playRotationAnimation(rotationTargets) {
    return new Promise((resolve) => {
      const duration = 200;
      const [t0, t1, t2] = rotationTargets;

      const newPositions = [t1.relativePosition, t2.relativePosition, t0.relativePosition];

      rotationTargets.forEach((tile, i) => {
        this.scene.tweens.add({
          targets: tile.container,
          x: newPositions[i].x,
          y: newPositions[i].y,
          angle: tile.container.angle + 120,
          duration,
          ease: "Cubic.easeInOut",
          onComplete: () => {
            if (i === 0) resolve();
          },
        });
      });
    });
  }

  // 회전 후 타일 데이터 업데이트
  applyRotationState(rotationTargets) {
    const [t0, t1, t2] = rotationTargets;

    // 기존 Map에서 제거
    this.tiles.delete(`${t0.q},${t0.r}`);
    this.tiles.delete(`${t1.q},${t1.r}`);
    this.tiles.delete(`${t2.q},${t2.r}`);

    // 좌표 순환: t0 → t2 위치, t1 → t0 위치, t2 → t1 위치
    const [q0, r0] = [t0.q, t0.r];
    const [q1, r1] = [t1.q, t1.r];
    const [q2, r2] = [t2.q, t2.r];

    t0.q = q2;
    t0.r = r2;
    t0.relativePosition = axialToPixel(q2, r2, this.tileSize);

    t1.q = q0;
    t1.r = r0;
    t1.relativePosition = axialToPixel(q0, r0, this.tileSize);

    t2.q = q1;
    t2.r = r1;
    t2.relativePosition = axialToPixel(q1, r1, this.tileSize);

    // 다시 Map에 추가
    this.tiles.set(`${t0.q},${t0.r}`, t0);
    this.tiles.set(`${t1.q},${t1.r}`, t1);
    this.tiles.set(`${t2.q},${t2.r}`, t2);
  }

  // 매칭 후 타일 재생성
  updateBoardStateAfterMatches(onClickHandler, onComplete) {
    this.scene.time.delayedCall(500, () => {
      const emptyPositions = [];

      for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
        const r1 = Math.max(-this.gridRadius, -q - this.gridRadius);
        const r2 = Math.min(this.gridRadius, -q + this.gridRadius);
        for (let r = r1; r <= r2; r++) {
          const existing = this.tiles.get(`${q},${r}`);
          if (!existing || existing.isBroken) {
            emptyPositions.push({ q, r });
          }
        }
      }

      const createdTiles = [];
      emptyPositions.forEach(({ q, r }) => {
        const oldTile = this.tiles.get(`${q},${r}`);
        if (oldTile) {
          this.tiles.delete(`${q},${r}`);
        }
        const newTile = this.createTile(q, r, onClickHandler);
        if (newTile) {
          createdTiles.push(newTile);
        }
      });

      if (onComplete) {
        onComplete(createdTiles);
      }
    });
  }

  // 타일 깊이 업데이트 (z-sorting)
  updateTileDepth(tile) {
    const depth = (tile.r + this.gridRadius * 2) * 1000 + (tile.q + this.gridRadius * 2);
    tile.container.setDepth(depth);
  }

  // 타일 표시 크기 계산
  getTileDisplaySize() {
    return this.tileSize * 2 * TURN_FACTOR;
  }

  // HP 폰트 크기 계산
  getHpFontSize() {
    return Math.max(12, Math.floor(this.tileSize * 0.45));
  }

  // 터치 영역 크기 계산
  getTouchAreaSize() {
    const base = this.getTileDisplaySize();
    return this.isTouch ? base * 0.9 : base * 0.7;
  }

  // 그리드 컨테이너 반환
  getGridContainer() {
    return this.gridContainer;
  }

  // 타일 맵 반환
  getTiles() {
    return this.tiles;
  }

  // 레이아웃 설정 업데이트
  updateLayout(gridRadius, tileSize) {
    this.gridRadius = gridRadius;
    this.tileSize = tileSize;
  }

  destroy() {
    this.tiles.clear();
    this.gridContainer?.destroy();
  }
}
