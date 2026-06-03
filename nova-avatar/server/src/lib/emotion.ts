export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed'] as const;
export type Emotion = (typeof EMOTIONS)[number];

const EMOTION_SET = new Set<string>(EMOTIONS);

export function isEmotion(x: string): x is Emotion {
  return EMOTION_SET.has(x);
}

/** Matches a leading `[[emotion:label]]` tag (with optional surrounding space). */
export const EMOTION_TAG_RE = /^\s*\[\[emotion:\s*([a-zA-Z]+)\s*\]\]\s*/;

/**
 * Incrementally strips a leading `[[emotion:...]]` tag from a token stream.
 * Emits the detected emotion exactly once and forwards the remaining text.
 * Built for SSE: feed deltas via push(); read emitted text/emotion via the
 * callbacks. Robust to the tag arriving split across chunks.
 */
export class EmotionStripper {
  private leading = true;
  private buffer = '';
  private emotionSent = false;

  constructor(
    private readonly onEmotion: (e: Emotion) => void,
    private readonly onText: (t: string) => void,
  ) {}

  private static readonly TAG = /^\[\[emotion:\s*([a-zA-Z]+)\s*\]\]/;

  private static couldBeTagPrefix(s: string): boolean {
    return '[[emotion:'.startsWith(s) || s.startsWith('[[emotion:');
  }

  push(chunk: string): void {
    if (!this.leading) {
      if (chunk) this.onText(chunk);
      return;
    }
    this.buffer += chunk;
    const trimmed = this.buffer.replace(/^\s+/, '');

    const m = trimmed.match(EmotionStripper.TAG);
    if (m) {
      this.emit(isEmotion(m[1].toLowerCase()) ? (m[1].toLowerCase() as Emotion) : 'neutral');
      this.leading = false;
      const rest = trimmed.slice(m[0].length);
      this.buffer = '';
      if (rest) this.onText(rest);
      return;
    }

    // If the buffer can no longer become a valid tag, give up and flush it.
    if (trimmed.length > 0 && !EmotionStripper.couldBeTagPrefix(trimmed)) {
      this.emit('neutral');
      this.leading = false;
      this.buffer = '';
      this.onText(trimmed);
    }
    // Otherwise keep buffering until the tag completes or breaks.
  }

  /** Flush any buffered text at end of stream. */
  end(): void {
    if (this.leading) {
      const trimmed = this.buffer.replace(/^\s+/, '');
      this.emit('neutral');
      this.leading = false;
      this.buffer = '';
      if (trimmed) this.onText(trimmed);
    }
  }

  private emit(e: Emotion): void {
    if (!this.emotionSent) {
      this.emotionSent = true;
      this.onEmotion(e);
    }
  }
}
