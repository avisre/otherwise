import type { VRM } from '@pixiv/three-vrm';
import type { Emotion } from '../state/store';

// VRM 1.0 preset expression names. three-vrm maps VRM0 blendshape groups
// (joy/sorrow/angry/fun/surprised) onto these automatically.
const EMOTION_EXPRESSION: Record<Exclude<Emotion, 'neutral'>, string> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  relaxed: 'relaxed',
};

const ALL = Object.values(EMOTION_EXPRESSION);

const MAX_WEIGHT: Record<string, number> = {
  happy: 1.0,
  sad: 0.85,
  angry: 0.9,
  surprised: 0.9,
  relaxed: 0.8,
};

/**
 * Smoothly blends VRM emotion expressions toward a target each frame, decaying
 * to neutral when the target is `neutral`. Call update(vrm, target, dt) before
 * vrm.update(dt). Unknown expressions are a no-op in three-vrm, so models that
 * lack some presets degrade gracefully.
 */
export class ExpressionController {
  private weights: Record<string, number> = {};

  constructor() {
    this.reset();
  }

  reset(): void {
    for (const name of ALL) this.weights[name] = 0;
  }

  update(vrm: VRM, target: Emotion, dt: number): void {
    const em = vrm.expressionManager;
    if (!em) return;
    const targetExpr = target === 'neutral' ? null : EMOTION_EXPRESSION[target];
    const k = 1 - Math.exp(-dt * 6); // ~0.17s time constant
    for (const name of ALL) {
      const goal = name === targetExpr ? (MAX_WEIGHT[name] ?? 1) : 0;
      this.weights[name] += (goal - this.weights[name]) * k;
      em.setValue(name, this.weights[name]);
    }
  }
}
