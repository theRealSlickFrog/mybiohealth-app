// Bottom-sheet drawer that explains "Optimal v Normal" for a signal.
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, OFFWHITE, CARD, BORDER, SLATE } from '../lib/constants.js';
import { OPTIMAL_AUTHORITIES } from '../lib/optimal-authorities.js';

export default function OptimalDrawer({ signalName, onClose }) {
  const data = OPTIMAL_AUTHORITIES[signalName];
  if (!data) return null;
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
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 6 }}>
            Optimal v Normal · {signalName}
          </div>
          <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 21, color: SLATE, lineHeight: 1.3, marginBottom: 16, fontWeight: 'normal' }}>
            Why MBH's bar is higher than the lab's
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div style={{ background: OFFWHITE, borderRadius: 10, padding: '12px 14px', borderTop: '3px solid #374151' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', marginBottom: 4 }}>Threshold (Lab)</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: SLATE, lineHeight: 1.3 }}>{data.labNormal}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 6, fontStyle: 'italic' }}>Absence of disease</div>
            </div>
            <div style={{ background: SAGE_BG, borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${MBH_SAGE}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 4 }}>Optimal (Authority)</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: SAGE_TEXT, lineHeight: 1.3 }}>{data.mbhOptimal}</div>
              <div style={{ fontSize: 12, color: SAGE_TEXT, marginTop: 6, fontStyle: 'italic' }}>Active health</div>
            </div>
          </div>
          <div style={{ background: OFFWHITE, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', marginBottom: 6 }}>Authority</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: SLATE }}>{data.authority}</div>
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 18 }}>{data.rationale}</div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 8 }}>Sources</div>
            {data.sources.map((s, i) => (
              <div key={i} style={{ fontSize: 11.5, color: '#6b7280', lineHeight: 1.55, marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, color: MBH_SAGE }}>·</span>{s}
              </div>
            ))}
          </div>
          <div style={{ background: '#eeeae4', borderRadius: 8, padding: '10px 14px', fontSize: 11.5, color: '#6b7280', lineHeight: 1.6, fontStyle: 'italic' }}>
            MBH's optimal thresholds are gathered from authoritative guidelines and peer-reviewed cohort evidence. They reflect the bar set by proactive, engaged members — not the boundary at which a lab flags disease.
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
