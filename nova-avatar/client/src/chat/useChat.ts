import { useCallback, useRef } from 'react';
import { useStore, type Emotion } from '../state/store';
import { speech } from './useSpeech';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const MAX_TURNS = 12;

const EMOTIONS: readonly Emotion[] = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'relaxed',
];
const isEmotion = (x: unknown): x is Emotion =>
  typeof x === 'string' && (EMOTIONS as readonly string[]).includes(x);

/**
 * Streaming chat client. Reads the server's SSE stream, appending text deltas
 * to the live assistant message, applying the emotion tag, and — when voice is
 * enabled — speaking the completed reply (which drives lip-sync).
 */
export function useChat() {
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    speech.stop();
    const { status, setStatus } = useStore.getState();
    if (status === 'thinking' || status === 'streaming' || status === 'speaking') setStatus('idle');
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const store = useStore.getState();
    if (store.status === 'thinking' || store.status === 'streaming') return;

    store.setError(null);
    store.addUserMessage(trimmed);

    const history = useStore
      .getState()
      .messages.slice(-MAX_TURNS * 2)
      .map((m) => ({ role: m.role, content: m.content }))
      .filter((m) => m.content.length > 0);

    store.setStatus('thinking');
    const controller = new AbortController();
    abortRef.current = controller;

    let assistantId: string | null = null;
    let fullText = '';

    const handleFrame = (frame: string) => {
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      const dataStr = dataLines.join('\n');

      if (eventName === 'emotion') {
        try {
          const { emotion } = JSON.parse(dataStr) as { emotion?: unknown };
          if (isEmotion(emotion)) useStore.getState().setEmotion(emotion);
        } catch {
          /* ignore malformed frame */
        }
      } else if (eventName === 'error') {
        let msg = 'Chat error';
        try {
          msg = (JSON.parse(dataStr) as { error?: string }).error ?? msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      } else if (eventName === 'done') {
        /* finalized after the read loop */
      } else {
        try {
          const { text: delta } = JSON.parse(dataStr) as { text?: string };
          if (typeof delta === 'string' && delta) {
            if (assistantId === null) {
              assistantId = useStore.getState().startAssistantMessage();
              useStore.getState().setStatus('streaming');
            }
            fullText += delta;
            useStore.getState().appendToMessage(assistantId, delta);
          }
        } catch {
          /* ignore malformed frame */
        }
      }
    };

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || `Chat failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (frame.trim()) handleFrame(frame);
        }
      }
      if (buffer.trim()) handleFrame(buffer);

      if (assistantId !== null) useStore.getState().finalizeMessage(assistantId);

      if (fullText.trim() && useStore.getState().voiceEnabled) {
        useStore.getState().setStatus('speaking');
        try {
          await speech.speak(fullText);
        } catch (err) {
          console.warn('TTS failed', err);
        }
      }
      // Decay emotion to neutral once Nova has finished speaking.
      useStore.getState().setEmotion('neutral');
      if (useStore.getState().status !== 'error') useStore.getState().setStatus('idle');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (assistantId !== null) useStore.getState().finalizeMessage(assistantId);
        useStore.getState().setStatus('idle');
        return;
      }
      console.error(err);
      if (assistantId !== null) useStore.getState().finalizeMessage(assistantId);
      useStore.getState().setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      abortRef.current = null;
    }
  }, []);

  return { send, stop };
}
