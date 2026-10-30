// Public legal pages (EULA / Privacy Policy). No auth. Reachable at /eula,
// /privacy, or a version-pinned path like /eula-v1 — the Caspio signup consent
// checkbox links to /eula-v1 and /privacy-v1. The privacy policy is section 8 of
// the Member Agreement, so both show the one document.
import { useEffect } from 'react';
import AgreementText from '../components/AgreementText.jsx';

const DOCS = {
  eula:    { title: 'Member Agreement' },
  privacy: { title: 'Member Agreement and Privacy Policy' },
};

export default function LegalPage({ doc }) {
  const d = DOCS[doc];

  useEffect(() => {
    document.title = d ? `${d.title} — MyBioHealth` : 'Not found — MyBioHealth';
  }, [d]);

  const wrap = {
    minHeight: '100vh', background: '#FAFAF7', color: '#1a1612',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    WebkitFontSmoothing: 'antialiased',
  };
  const inner = { maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' };

  if (!d) {
    return (
      <div style={wrap}><div style={inner}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400 }}>Not found</h1>
        <p><a href="/" style={{ color: '#1a1612' }}>Return home</a></p>
      </div></div>
    );
  }

  return (
    <div style={wrap}>
      <div style={inner}>
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}>← MyBioHealth</a>
        <AgreementText />
      </div>
    </div>
  );
}
