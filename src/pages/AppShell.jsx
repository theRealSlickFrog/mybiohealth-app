import { useEffect, useState } from 'react';
import { captureGuidFromUrl } from '../lib/auth.js';

// Placeholder app shell. Will become the page selector
// (MyStrategy, BioSignals, GlucoseSummary, DEXA, Vault, etc.) once the
// prototype is ported page by page.

export default function AppShell() {
  const [guid, setGuid] = useState(null);

  useEffect(() => {
    setGuid(captureGuidFromUrl());
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
          App shell — pages coming next.
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
            : 'No GUID — use the Caspio redirector to land here, or append ?guid=test for a smoke test.'}
        </div>
      </div>
    </div>
  );
}
