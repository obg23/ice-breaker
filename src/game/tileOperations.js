/**
 * tileOperations.js
 * 타일 생성, 파괴 관련 유틸리티 함수들
 */
import { axialToPixel } from "../utils/hexUtils.js";

/**
 * 타일 깊이 계산 (z-sorting)
 * @param {number} q - 타일 q 좌표
 * @param {number} r - 타일 r 좌표
 * @param {number} gridRadius - 그리드 반경
 * @returns {number} 깊이 값
 */
export function calculateTileDepth(q, r, gridRadius) {
  return (r + gridRadius * 2) * 1000 + (q + gridRadius * 2);
}

/**
 * 빈 타일 위치 찾기
 * @param {Map} tiles - 타일 맵
 * @param {number} gridRadius - 그리드 반경
 * @returns {Array} 빈 위치 배열 [{q, r}, ...]
 */
export function findEmptyPositions(tiles, gridRadius) {
  const emptyPositions = [];

  for (let q = -gridRadius; q <= gridRadius; q++) {
    const r1 = Math.max(-gridRadius, -q - gridRadius);
    const r2 = Math.min(gridRadius, -q + gridRadius);

    for (let r = r1; r <= r2; r++) {
      const existing = tiles.get(`${q},${r}`);
      if (!existing || existing.isBroken) {
        emptyPositions.push({ q, r });
      }
    }
  }

  return emptyPositions;
}

/**
 * 회전 상태 적용을 위한 업데이트 데이터 생성
 * @param {Array} rotationTargets - 회전 대상 타일들
 * @param {Array} nextPositions - 새 위치들
 * @returns {Array} 업데이트 정보 배열
 */
export function createRotationUpdates(rotationTargets, nextPositions) {
  return rotationTargets.map((tile, index) => ({
    tile,
    oldKey: `${tile.q},${tile.r}`,
    next: nextPositions[index],
  }));
}

/**
 * 타일 데이터 업데이트 (회전 후)
 * @param {Object} tile - 타일 객체
 * @param {Object} next - 새 위치 정보 {position, qr}
 * @param {number} tileSize - 타일 크기
 */
export function updateTileData(tile, next, tileSize) {
  tile.q = next.qr.q;
  tile.r = next.qr.r;
  tile.relativePosition = next.position;
  tile.positionText.setText(`${tile.q},${tile.r}`);
}
