import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useStore } from '../state/store';

export function ModelSwitcher() {
  const modelStatus = useStore((s) => s.modelStatus);
  const modelError = useStore((s) => s.modelError);
  const modelName = useStore((s) => s.modelName);
  const setModelSource = useStore((s) => s.setModelSource);

  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setModelSource({ kind: 'file', file });
    e.target.value = '';
  };

  const loadUrl = (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (u) setModelSource({ kind: 'url', url: u });
    setShowUrl(false);
  };

  return (
    <div className="switcher">
      <div className="switcher__status">
        {modelStatus === 'loading' && <span className="badge">loading model…</span>}
        {modelStatus === 'ready' && modelName && <span className="badge">{modelName}</span>}
        {modelStatus === 'error' && (
          <span className="badge badge--error">
            {modelError ?? 'failed to load'} — drop a .vrm
          </span>
        )}
        {modelStatus === 'empty' && <span className="badge">no model — drop a .vrm</span>}
      </div>

      <div className="switcher__actions">
        <button type="button" className="pill" onClick={() => fileRef.current?.click()}>
          Load .vrm
        </button>
        <button
          type="button"
          className={`pill${showUrl ? ' pill--on' : ''}`}
          aria-expanded={showUrl}
          onClick={() => setShowUrl((v) => !v)}
        >
          From URL
        </button>
        <input ref={fileRef} type="file" accept=".vrm" hidden onChange={onFile} />
      </div>

      {showUrl && (
        <form className="switcher__url" onSubmit={loadUrl}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/model.vrm"
            aria-label="VRM model URL"
            autoComplete="off"
          />
          <button type="submit" className="pill">
            Load
          </button>
        </form>
      )}
    </div>
  );
}
