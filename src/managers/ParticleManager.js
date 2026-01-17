/**
 * ParticleManager
 * 파티클 효과 생성 및 관리
 */
export default class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.init();
  }

  init() {
    this.createParticleTexture();
  }

  // 파티클용 텍스처 생성
  createParticleTexture() {
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('particle', 16, 16);
    graphics.destroy();
  }

  // 파티클 효과 생성
  createEffect(x, y, color) {
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 15,
      blendMode: 'ADD',
      tint: color,
    });

    // 파티클 이펙트 후 자동 제거
    this.scene.time.delayedCall(700, () => {
      particles.destroy();
    });
  }

  destroy() {
    // 정리 작업이 필요하면 여기에 추가
  }
}
