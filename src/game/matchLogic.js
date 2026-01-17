/**
 * matchLogic.js
 * 타일 매칭 로직 - 순수 함수들
 */
import { getNeighbors } from "../utils/hexUtils.js";

const MIN_MATCH_COUNT = 5;

/**
 * BFS로 동일한 HP를 가진 타일 클러스터 찾기
 * @param {Map} tiles - 전체 타일 맵
 * @param {Array} pivotTiles - 시작점 타일들
 * @returns {Array} 클러스터 배열
 */
export function findMatchingClusters(tiles, pivotTiles = []) {
  const visited = new Set();
  const clusters = [];

  const seeds =
    pivotTiles.length > 0
      ? pivotTiles.filter((t) => t && !t.isBroken)
      : Array.from(tiles.values()).filter((t) => !t.isBroken);

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
        const neighbor = tiles.get(`${q},${r}`);
        if (!neighbor) return;
        if (!visited.has(`${neighbor.q},${neighbor.r}`)) {
          stack.push(neighbor);
        }
      });
    }

    if (cluster.length >= MIN_MATCH_COUNT) {
      clusters.push(cluster);
    }
  });

  return clusters;
}

/**
 * 회전 대상 타일 선택 (클릭한 타일 + 인접 2개)
 * @param {Object} centerTile - 클릭한 타일
 * @param {Map} tiles - 전체 타일 맵
 * @returns {Array|null} 회전 대상 타일 배열 또는 null
 */
export function getRotationTargets(centerTile, tiles) {
  if (!centerTile || centerTile.isBroken) return null;

  const neighbors = getNeighbors(centerTile.q, centerTile.r)
    .map(({ q, r }) => tiles.get(`${q},${r}`))
    .filter((tile) => tile && !tile.isBroken);

  if (neighbors.length < 2) return null;

  return [centerTile, neighbors[0], neighbors[1]];
}

/**
 * 회전 후 새 위치 계산
 * @param {Array} rotationTargets - 회전 대상 타일들
 * @returns {Array} 새 위치 정보 배열
 */
export function calculateRotationPositions(rotationTargets) {
  return rotationTargets.map((_, index) => {
    const sourceIndex = (index + 1) % rotationTargets.length;
    const targetTile = rotationTargets[sourceIndex];
    return {
      position: targetTile.relativePosition,
      qr: { q: targetTile.q, r: targetTile.r },
    };
  });
}
