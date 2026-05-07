import { useEffect, useState } from 'react';

export default function App() {
  const [guid, setGuid] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('guid');
    if (g) {
      setGuid(g);
      // Scrub the GUID from the URL so it isn't shareable/bookmarkable
      const url = new URL(window.location.href);
      url.searchParams.delete('guid');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 32,
          fontWeight: 'normal',
          marginBottom: 12,
        }}>
          <em style={{ fontStyle: 'italic', fontWeight: 400 }}>My</em>
          <strong style={{ fontWeight: 700 }}>BioHealth</strong>
        </h1>
        <p style={{ color: '#5e564b', fontSize: 14, marginBottom: 32 }}>
          Pipeline placeholder. App coming soon.
        </p>
        <div style={{
          background: 'white',
          border: '1px solid #ede9e3',
          borderRadius: 12,
          padding: 20,
          fontSize: 13,
          color: '#5e564b',
          fontFamily: 'ui-monospace, monospace',
          textAlign: 'left',
        }}>
          {guid
            ? <>Authenticated as <code style={{ color: '#1e2d3d' }}>{guid.slice(0, 8)}…</code></>
            : 'No GUID in URL — will resolve via redirector once wired in.'}
        </div>
      </div>
    </div>
  );
}
