/**
 * 육각형 그리드 유틸리티 함수들
 * Axial 좌표계 사용 (q, r)
 */

/**
 * Axial 좌표를 픽셀 좌표로 변환 (flat-top 육각형)
 * @param {number} q - 축 q 좌표
 * @param {number} r - 축 r 좌표
/**
 * Axial 좌표를 픽셀 좌표로 변환 (pointy-top 육각형)
 * @param {number} q - 축 q 좌표
 * @param {number} r - 축 r 좌표
 * @param {number} size - 육각형 크기
 * @param {number} spacing - 타일 간격 배율 (기본값 1.0: 빈틈 없음)
 * @returns {{x: number, y: number}} 픽셀 좌표
 */
export function axialToPixel(q, r, size, spacing = 1.0) {
  const scaled = size * spacing;
  const x = scaled * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = scaled * ((3 / 2) * r);
  return { x, y };
}

/**
 * 픽셀 좌표를 Axial 좌표로 변환
 * @param {number} x - 픽셀 x 좌표
 * @param {number} y - 픽셀 y 좌표
 * @param {number} size - 육각형 크기
 * @returns {{q: number, r: number}} Axial 좌표
 */
export function pixelToAxial(x, y, size) {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return axialRound(q, r);
}

/**
 * Axial 좌표 반올림 (가장 가까운 육각형 찾기)
 * @param {number} q - 축 q 좌표
 * @param {number} r - 축 r 좌표
 * @returns {{q: number, r: number}} 반올림된 Axial 좌표
 */
export function axialRound(q, r) {
  const s = -q - r;

  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

/**
 * 인접한 6개 육각형의 좌표 반환
 * @param {number} q - 축 q 좌표
 * @param {number} r - 축 r 좌표
 * @returns {Array<{q: number, r: number}>} 인접 육각형 좌표 배열
 */
export function getNeighbors(q, r) {
  const directions = [
    { q: 1, r: 0 }, // 오른쪽
    { q: 1, r: -1 }, // 오른쪽 위
    { q: 0, r: -1 }, // 왼쪽 위
    { q: -1, r: 0 }, // 왼쪽
    { q: -1, r: 1 }, // 왼쪽 아래
    { q: 0, r: 1 }, // 오른쪽 아래
  ];

  return directions.map((dir) => ({
    q: q + dir.q,
    r: r + dir.r,
  }));
}

/**
 * 두 육각형 사이의 거리 계산
 * @param {number} q1 - 첫 번째 육각형 q 좌표
 * @param {number} r1 - 첫 번째 육각형 r 좌표
 * @param {number} q2 - 두 번째 육각형 q 좌표
 * @param {number} r2 - 두 번째 육각형 r 좌표
 * @returns {number} 거리
 */
export function hexDistance(q1, r1, q2, r2) {
  return (
    (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2
  );
}
