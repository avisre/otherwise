import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { useChat } from './useChat';
import { speech } from './useSpeech';

export default function ChatPanel() {
  const messages = useStore((s) => s.messages);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const { send, stop } = useChat();
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const busy = status === 'thinking' || status === 'streaming';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input;
    if (!text.trim()) return;
    setInput('');
    void speech.resume(); // unlock audio within the user gesture
    void send(text);
  };

  return (
    <section className="chat" aria-label="Chat with Nova">
      <div className="chat__log" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 && <p className="chat__hint">Say hello to Nova…</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble--${m.role}`}>
            {m.content || (m.pending ? <TypingDots /> : '')}
          </div>
        ))}
        {status === 'thinking' && (
          <div className="bubble bubble--assistant">
            <TypingDots />
          </div>
        )}
      </div>

      {error && (
        <div className="chat__error" role="alert">
          {error}
        </div>
      )}

      <form className="chat__form" onSubmit={onSubmit}>
        <input
          className="chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Nova…"
          aria-label="Message Nova"
          autoComplete="off"
        />
        {busy ? (
          <button type="button" className="btn btn--stop" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
    </section>
  );
}

function TypingDots() {
  return (
    <span className="dots" aria-label="Nova is thinking">
      <span />
      <span />
      <span />
    </span>
  );
}
