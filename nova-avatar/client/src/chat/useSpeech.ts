import { lipSync } from '../avatar/useLipSync';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Owns a single AudioContext + AnalyserNode. TTS playback and microphone input
 * both feed that one analyser, which the lip-sync engine reads each frame.
 * First playback must follow a user gesture (browser autoplay policy) — call
 * resume() from a click/submit handler.
 */
class Speech {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio API is not supported in this browser');
      const ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      const gain = ctx.createGain();
      // analyser -> gain -> speakers. TTS routes through the analyser (heard +
      // analysed); the mic taps the analyser only (analysed, not played back).
      analyser.connect(gain);
      gain.connect(ctx.destination);
      this.ctx = ctx;
      this.analyser = analyser;
      lipSync.connect(analyser);
    }
    return this.ctx;
  }

  /** Resume the AudioContext from within a user gesture. */
  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  /** Fetch TTS audio, play it, and route it through the shared analyser. */
  async speak(text: string): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* a user gesture may still be required */
      }
    }

    const res = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(detail || `TTS failed (${res.status})`);
    }

    const audioBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
    this.stop(); // cut off any in-flight playback

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(this.analyser!);
    this.source = src;

    await new Promise<void>((resolve) => {
      src.onended = () => {
        if (this.source === src) this.source = null;
        resolve();
      };
      src.start();
    });
  }

  /** Stop TTS playback immediately. */
  stop(): void {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.source.disconnect();
      } catch {
        /* noop */
      }
      this.source = null;
    }
  }

  async enableMic(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if (this.micSource) return;
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micSource = ctx.createMediaStreamSource(this.micStream);
    // Tap the analyser only — never connect the mic to the destination (feedback).
    this.micSource.connect(this.analyser!);
  }

  disableMic(): void {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        /* noop */
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }
}

export const speech = new Speech();
