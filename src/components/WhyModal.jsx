// "The Why" bottom-sheet modal, modeled on remixed-edc07ba6.html's
// HealthLiteracyPanel. Constrained max-width (600px), dark header,
// multi-page pagination based on `## Heading` markers in the body text,
// page dots, and back/next/done nav.
//
// Body text format (lives in mystrategy_report_ready.mhx{n}_why_text /
// p{n}_why_text):
//
//   ## First section heading
//   Paragraph one.
//
//   Paragraph two.
//
//   ## Second section heading
//   Paragraph.
//
// If no `## ` markers are present, the whole body renders as a single page
// using the parent's title as the heading.

import { useState, useEffect } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

// Parse `## Heading\nBody...` blocks. If no markers, returns one page using fallback heading.
function parseSections(body, fallbackHeading) {
  if (!body) return [];
  const trimmed = body.trim();
  if (!/^##\s/m.test(trimmed)) {
    return [{ heading: fallbackHeading, paragraphs: trimmed.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) }];
  }
  const sections = [];
  const lines = trimmed.split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { heading: m[1].trim(), buf: '' };
    } else if (cur) {
      cur.buf += line + '\n';
    }
  }
  if (cur) sections.push(cur);
  return sections.map((s) => ({
    heading: s.heading,
    paragraphs: s.buf.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
  }));
}

function PageDots({ total, current }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0 6px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 6, borderRadius: 3,
          background: i === current ? MBH_SAGE : '#d1d5db', transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

export default function WhyModal({ title, body, onClose }) {
  const [page, setPage] = useState(0);
  const sections = parseSections(body, title);
  const total = sections.length;

  // Reset page when body changes (different mhx/priority opened)
  useEffect(() => { setPage(0); }, [body]);

  if (total === 0) return null;
  const s = sections[Math.min(page, total - 1)];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.6)', zIndex: 400,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: OFFWHITE, borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 600, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Dark header */}
        <div style={{
          background: SLATE, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>The Why</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{title}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 30, height: 30, color: 'white', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} aria-label="Close">×</button>
        </div>

        {total > 1 && <PageDots total={total} current={page} />}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 22px 16px' }}>
          {total > 1 && (
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.09em',
              textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 6,
            }}>The Why · {page + 1} of {total}</div>
          )}
          <h2 style={{
            fontFamily: "'DM Serif Display',serif", fontSize: 22, color: SLATE,
            lineHeight: 1.3, marginBottom: 14, fontWeight: 'normal',
          }}>{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.75, marginBottom: 14 }}>{p}</p>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: CARD,
        }}>
          {total > 1 ? (
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{
              background: 'none', border: `1px solid ${BORDER}`, borderRadius: 20,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              color: page === 0 ? '#d1d5db' : SLATE,
              cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>← Back</button>
          ) : <span />}
          {total > 1 && <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{page + 1} / {total}</span>}
          {total > 1 ? (
            page < total - 1 ? (
              <button onClick={() => setPage((p) => p + 1)} style={{
                background: SLATE, border: 'none', borderRadius: 20,
                padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'white',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Next →</button>
            ) : (
              <button onClick={onClose} style={{
                background: MBH_SAGE, border: 'none', borderRadius: 20,
                padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'white',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Done ✓</button>
            )
          ) : (
            <button onClick={onClose} style={{
              background: MBH_SAGE, border: 'none', borderRadius: 20,
              padding: '8px 18px', fontSize: 13, fontWeight: 600, color: 'white',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Done ✓</button>
          )}
        </div>
      </div>
    </div>
  );
}
