import type { VRM } from '@pixiv/three-vrm';

/** Randomized blinking via the VRM `blink` expression. */
export class Blinker {
  private timer = 0;
  private next = Blinker.schedule();
  private phase = 0;
  private blinking = false;

  private static schedule(): number {
    return 2 + Math.random() * 4; // 2–6s between blinks
  }

  update(dt: number, vrm: VRM, enabled = true): void {
    const em = vrm.expressionManager;
    if (!em) return;
    if (!enabled) {
      em.setValue('blink', 0);
      return;
    }

    if (this.blinking) {
      this.phase += dt;
      const dur = 0.13;
      const half = dur / 2;
      const v = this.phase < half ? this.phase / half : Math.max(0, 1 - (this.phase - half) / half);
      em.setValue('blink', v);
      if (this.phase >= dur) {
        this.blinking = false;
        this.phase = 0;
        em.setValue('blink', 0);
      }
    } else {
      this.timer += dt;
      if (this.timer >= this.next) {
        this.timer = 0;
        this.next = Blinker.schedule();
        this.blinking = true;
        this.phase = 0;
      }
    }
  }
}

/** Subtle idle bob/sway applied to the normalized hips bone. */
export class IdleMotion {
  private t = 0;
  private restY: number | null = null;

  update(dt: number, vrm: VRM, intensity = 1): void {
    this.t += dt;
    const hips = vrm.humanoid?.getNormalizedBoneNode('hips');
    if (!hips) return;
    if (this.restY === null) this.restY = hips.position.y;
    hips.position.y = this.restY + Math.sin(this.t * 1.6) * 0.008 * intensity;
    hips.rotation.z = Math.sin(this.t * 0.8) * 0.015 * intensity;
    hips.rotation.y = Math.sin(this.t * 0.5) * 0.03 * intensity;
  }
}
