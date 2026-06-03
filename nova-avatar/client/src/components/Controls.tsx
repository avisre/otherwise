import { useStore } from '../state/store';
import { speech } from '../chat/useSpeech';

export function Controls() {
  const voiceEnabled = useStore((s) => s.voiceEnabled);
  const micEnabled = useStore((s) => s.micEnabled);
  const setVoiceEnabled = useStore((s) => s.setVoiceEnabled);
  const setMicEnabled = useStore((s) => s.setMicEnabled);

  const toggleVoice = async () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (next) {
      try {
        await speech.resume();
      } catch {
        /* gesture/permission issue — non-fatal */
      }
    } else {
      speech.stop();
    }
  };

  const toggleMic = async () => {
    if (!micEnabled) {
      try {
        await speech.enableMic();
        setMicEnabled(true);
      } catch (err) {
        console.warn('Microphone unavailable', err);
        setMicEnabled(false);
      }
    } else {
      speech.disableMic();
      setMicEnabled(false);
    }
  };

  return (
    <div className="controls">
      <button
        type="button"
        className={`pill${voiceEnabled ? ' pill--on' : ''}`}
        aria-pressed={voiceEnabled}
        onClick={toggleVoice}
      >
        {voiceEnabled ? '🔊' : '🔇'} Voice
      </button>
      <button
        type="button"
        className={`pill${micEnabled ? ' pill--on' : ''}`}
        aria-pressed={micEnabled}
        onClick={toggleMic}
        title="Drive lip-sync from your microphone"
      >
        🎙 Mic
      </button>
    </div>
  );
}
