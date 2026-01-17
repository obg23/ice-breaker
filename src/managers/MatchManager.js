/**
 * MatchManager
 * 타일 매칭 로직 및 클러스터 찾기
 */
import { getNeighbors } from "../utils/hexUtils.js";

const MIN_MATCH_COUNT = 5;

export default class MatchManager {
  constructor(scene) {
    this.scene = scene;
  }

  // 회전으로 영향 받은 타일부터 시작해 전체 보드에서 동일 HP 클러스터 탐색
  findMatchingClusters(tiles, pivotTiles = []) {
    const visited = new Set();
    const clusters = [];

    // 회전된 타일을 시작점으로 삼고, 동일 HP가 이어지는 한 전체 맵을 따라간다
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

  // 시간 보너스 계산
  calculateTimeBonus(clusters, comboMultiplier) {
    let baseSeconds = 0;

    clusters.forEach((cluster) => {
      if (cluster.length >= 4) {
        baseSeconds += 0.8;
      } else if (cluster.length === 3) {
        baseSeconds += 0.5;
      } else if (cluster.length === 2) {
        baseSeconds += 0.2;
      }
    });

    return baseSeconds * comboMultiplier;
  }

  // 파괴된 타일 수 계산
  getTotalDestroyedCount(clusters) {
    return clusters.reduce((total, cluster) => total + cluster.length, 0);
  }

  destroy() {
    // 정리 작업
  }
}
