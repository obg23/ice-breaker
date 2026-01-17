/**
 * scoreSystem.js
 * 점수, 콤보, 시간 계산 로직 - 순수 함수들
 */

/**
 * 콤보 배수 계산
 * @param {number} combo - 현재 콤보 수
 * @returns {number} 배수
 */
export function getComboMultiplier(combo) {
  if (combo >= 6) return 1.4;
  if (combo >= 3) return 1.2;
  return 1.0;
}

/**
 * 콤보 업데이트 (증가 또는 리셋)
 * @param {number} currentCombo - 현재 콤보
 * @param {number} lastMatchTime - 마지막 매칭 시간
 * @param {number} currentTime - 현재 시간
 * @param {number} comboWindow - 콤보 윈도우 (ms)
 * @returns {number} 새 콤보 값
 */
export function updateCombo(currentCombo, lastMatchTime, currentTime, comboWindow = 1350) {
  if (currentTime - lastMatchTime <= comboWindow) {
    return currentCombo + 1;
  }
  return 1;
}

/**
 * 시간 보너스 계산
 * @param {Array} clusters - 클러스터 배열
 * @param {number} comboMultiplier - 콤보 배수
 * @returns {number} 추가될 시간 (초)
 */
export function calculateTimeBonus(clusters, comboMultiplier) {
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

/**
 * 점수 계산
 * @param {number} destroyedCount - 파괴된 타일 수
 * @param {number} comboMultiplier - 콤보 배수
 * @returns {number} 획득 점수
 */
export function calculateScore(destroyedCount, comboMultiplier) {
  return Math.round(destroyedCount * 100 * comboMultiplier);
}

/**
 * 파괴된 타일 총 개수 계산
 * @param {Array} clusters - 클러스터 배열
 * @returns {number} 총 개수
 */
export function getTotalDestroyedCount(clusters) {
  return clusters.reduce((total, cluster) => total + cluster.length, 0);
}
