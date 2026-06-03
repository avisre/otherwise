import { useEffect, useState } from 'react';

// Phase 0 scaffold: a styled blank page that verifies the dev proxy reaches the
// server's /api/health. Replaced by the real app in later phases.
export default function App() {
  const [health, setHealth] = useState('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { ok?: boolean }) => setHealth(d.ok ? 'server: ok' : 'server: error'))
      .catch(() => setHealth('server: unreachable'));
  }, []);

  return (
    <div className="boot">
      <h1 className="boot__brand">NOVA</h1>
      <p className="boot__tagline">conversational 3d avatar</p>
      <span className="boot__status">{health}</span>
    </div>
  );
}
