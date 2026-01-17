/**
 * ScoreManager
 * 점수, 콤보, 시간 관리
 */
export default class ScoreManager {
  constructor(scene) {
    this.scene = scene;
    this.score = 0;
    this.combo = 0;
    this.comboWindowMs = 1350;
    this.lastMatchAt = 0;
    this.timeLeft = 30.0;
    this.timeMax = 90.0;
    this.timeEvent = null;
  }

  // 타이머 시작
  startTimer() {
    this.timeEvent = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: this.updateTimer,
      callbackScope: this,
    });
  }

  // 타이머 업데이트
  updateTimer() {
    this.timeLeft = Math.max(0, this.timeLeft - 0.1);

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.stopTimer();
      // 게임 오버 콜백 호출
      if (this.onGameOver) {
        this.onGameOver();
      }
    }
  }

  // 타이머 정지
  stopTimer() {
    if (this.timeEvent) {
      this.timeEvent.destroy();
      this.timeEvent = null;
    }
  }

  // 시간 추가
  addTime(seconds) {
    this.timeLeft = Math.min(this.timeMax, this.timeLeft + seconds);
  }

  // 점수 추가 (콤보 적용)
  addScore(baseScore) {
    const multiplier = this.getComboMultiplier();
    const finalScore = Math.floor(baseScore * multiplier);
    this.score += finalScore;
    return finalScore;
  }

  // 콤보 증가
  incrementCombo() {
    const now = Date.now();

    // 콤보 윈도우 체크
    if (now - this.lastMatchAt > this.comboWindowMs) {
      this.combo = 1;
    } else {
      this.combo++;
    }

    this.lastMatchAt = now;
  }

  // 콤보 리셋
  resetCombo() {
    this.combo = 0;
  }

  // 콤보 배수 계산
  getComboMultiplier() {
    if (this.combo <= 2) return 1.0;
    if (this.combo <= 5) return 1.2;
    return 1.4;
  }

  // 현재 점수 반환
  getScore() {
    return this.score;
  }

  // 현재 콤보 반환
  getCombo() {
    return this.combo;
  }

  // 남은 시간 반환
  getTimeLeft() {
    return this.timeLeft;
  }

  // 게임 오버 콜백 설정
  setGameOverCallback(callback) {
    this.onGameOver = callback;
  }

  destroy() {
    this.stopTimer();
  }
}
