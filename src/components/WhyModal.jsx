// Bottom-sheet modal that displays "The Why" body for a priority or microhabit.
// Mirrors the OptimalDrawer pattern. Body text supports paragraph breaks via
// double-newline; renders each chunk as a separate <p>.
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, CARD } from '../lib/constants.js';

export default function WhyModal({ title, body, eyebrow = 'The Why', onClose }) {
  if (!body) return null;
  const paragraphs = body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.6)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '88vh',
        background: CARD, borderRadius: '16px 16px 0 0', zIndex: 401,
        overflowY: 'auto', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db' }} />
        </div>
        <div style={{ padding: '6px 22px 28px', maxWidth: 740, margin: '0 auto' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
            color: MBH_SAGE, marginBottom: 6,
          }}>{eyebrow}</div>
          <h2 style={{
            fontFamily: "'DM Serif Display',serif", fontSize: 21, color: SLATE,
            lineHeight: 1.3, marginBottom: 18, fontWeight: 'normal',
          }}>{title}</h2>
          <div style={{ background: SAGE_BG, borderLeft: `3px solid ${MBH_SAGE}`, borderRadius: '0 10px 10px 0', padding: '14px 18px' }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{
                fontSize: 13.5, lineHeight: 1.7, color: SAGE_TEXT,
                margin: i === 0 ? 0 : '12px 0 0',
              }}>{p}</p>
            ))}
          </div>
          <button onClick={onClose} style={{
            marginTop: 18, width: '100%', background: SLATE, border: 'none', borderRadius: 24,
            padding: '11px 0', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer',
          }}>Close</button>
        </div>
      </div>
    </>
  );
}
