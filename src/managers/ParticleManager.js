/**
 * ParticleManager
 * 파티클 효과 생성 및 관리
 */
export default class ParticleManager {
  constructor(scene) {
    this.scene = scene;
  }

  // 파티클 효과 생성 (얼음 파편 이미지 사용)
  createEffect(x, y, color) {
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 150, max: 400 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 8,
      gravityY: 300,
      rotate: { min: 0, max: 360 },
      tint: color,
    });

    // 파티클 이펙트 후 자동 제거
    this.scene.time.delayedCall(900, () => {
      particles.destroy();
    });
  }

  destroy() {
    // 정리 작업이 필요하면 여기에 추가
  }
}
