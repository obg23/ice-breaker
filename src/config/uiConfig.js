// UI 관련 공통 설정 모음
export const HP_COLORS = {
  6: 0xff006e, // 선명한 마젠타
  5: 0xffbe0b, // 노란 주황
  4: 0x3a86ff, // 선명한 블루
  3: 0x00b140, // 강한 그린
  2: 0xff595e, // 코랄 레드
  1: 0x8338ec, // 비비드 퍼플,
};

// HP 값에 따른 색상 반환
export function getColorByHP(hp) {
  return HP_COLORS[hp] ?? 0xcccccc;
}
