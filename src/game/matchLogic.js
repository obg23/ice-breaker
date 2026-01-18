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

/**
 * 특정 위치에 특정 HP 타일을 놓았을 때 형성되는 클러스터 크기 계산
 * @param {Map} tiles - 현재 타일 맵
 * @param {number} q - 타일 q 좌표
 * @param {number} r - 타일 r 좌표
 * @param {number} hp - 확인할 HP 값
 * @returns {number} 클러스터 크기
 */
export function getClusterSizeIfPlaced(tiles, q, r, hp) {
  const visited = new Set();
  const stack = [{ q, r }];
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    const key = `${current.q},${current.r}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // 현재 위치가 새로 놓을 타일인 경우
    if (current.q === q && current.r === r) {
      count++;
    } else {
      // 기존 타일인 경우
      const tile = tiles.get(key);
      if (!tile || tile.isBroken || tile.hp !== hp) continue;
      count++;
    }

    // 인접 타일 확인
    getNeighbors(current.q, current.r).forEach((neighbor) => {
      const neighborKey = `${neighbor.q},${neighbor.r}`;
      if (visited.has(neighborKey)) return;

      // 인접 타일이 같은 HP인지 확인
      if (neighbor.q === q && neighbor.r === r) {
        stack.push(neighbor);
      } else {
        const neighborTile = tiles.get(neighborKey);
        if (neighborTile && !neighborTile.isBroken && neighborTile.hp === hp) {
          stack.push(neighbor);
        }
      }
    });
  }

  return count;
}
