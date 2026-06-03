import type { VRM } from '@pixiv/three-vrm';

const GAIN = 1.8; // scales RMS amplitude into the [0,1] expression range
const ATTACK = 24; // smoothing rate when the mouth is opening
const RELEASE = 11; // smoothing rate when the mouth is closing

/**
 * The single lip-sync engine. One AnalyserNode is connected here; both TTS
 * playback and microphone input feed the same node, so lip-sync is never
 * re-implemented per source. The render loop calls update(dt) then
 * applyTo(vrm, t) each frame, before vrm.update(dt) commits the weights.
 */
class LipSync {
  private analyser: AnalyserNode | null = null;
  private timeData = new Uint8Array(0);
  /** Smoothed mouth-open level in [0, 1]. */
  level = 0;

  connect(analyser: AnalyserNode): void {
    this.analyser = analyser;
    this.timeData = new Uint8Array(analyser.fftSize);
  }

  disconnect(): void {
    this.analyser = null;
  }

  get connected(): boolean {
    return this.analyser !== null;
  }

  /** Sample the analyser and smooth the level. Call once per frame. */
  update(dt: number): void {
    let target = 0;
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.timeData);
      let sumSq = 0;
      for (let i = 0; i < this.timeData.length; i++) {
        const v = (this.timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / this.timeData.length);
      target = Math.min(1, rms * GAIN);
    }
    const rate = target > this.level ? ATTACK : RELEASE;
    const k = 1 - Math.exp(-dt * rate);
    this.level += (target - this.level) * k;
  }

  /** Apply the current level to the VRM mouth visemes. */
  applyTo(vrm: VRM, t: number): void {
    const em = vrm.expressionManager;
    if (!em) return;
    const aa = this.level;
    em.setValue('aa', aa);
    // Small secondary visemes for natural-looking variation.
    em.setValue('ih', aa * 0.18 * (0.5 + 0.5 * Math.sin(t * 9)));
    em.setValue('ou', aa * 0.14 * (0.5 + 0.5 * Math.sin(t * 6 + 1.3)));
  }
}

/** Singleton — imported by useSpeech (audio side) and Avatar (render side). */
export const lipSync = new LipSync();
