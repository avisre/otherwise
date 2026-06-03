import { useEffect } from 'react';
import Avatar from './avatar/Avatar';
import ChatPanel from './chat/ChatPanel';
import { Controls } from './components/Controls';
import { ModelSwitcher } from './components/ModelSwitcher';
import { useStore } from './state/store';

const DEFAULT_MODEL_URL = import.meta.env.VITE_DEFAULT_MODEL_URL ?? '/models/nova.vrm';

export default function App() {
  const modelSource = useStore((s) => s.modelSource);
  const modelStatus = useStore((s) => s.modelStatus);
  const setModelSource = useStore((s) => s.setModelSource);

  // Load the default model once on mount (Avatar's store subscription picks it up).
  useEffect(() => {
    if (!modelSource) setModelSource({ kind: 'url', url: DEFAULT_MODEL_URL, name: 'nova' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">NOVA</span>
          <span className="app__sub">conversational avatar</span>
        </div>
        <Controls />
      </header>

      <main className="app__main">
        <div className="app__stage">
          <Avatar />
          {(modelStatus === 'empty' || modelStatus === 'error') && (
            <div className="stage__empty">
              <p>Drag a <code>.vrm</code> onto the stage to bring Nova to life.</p>
            </div>
          )}
          <ModelSwitcher />
        </div>
        <ChatPanel />
      </main>
    </div>
  );
}
