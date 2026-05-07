// MBH Library — health literacy topics. Hardcoded; live FAQ wiring in Phase B.
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, AMBER_BG, AMBER_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const TOPICS = [
  { title: 'Why does a gap between meals matter?', tag: 'Glucose', linked: true },
  { title: 'The battery you never use — fat as fuel', tag: 'Glucose', linked: true },
  { title: 'What the signals are telling you', tag: 'Signals', linked: true },
  { title: 'How your signals talk to each other', tag: 'Signal Web', linked: true },
  { title: 'Understanding ApoB and atherogenic particles', tag: 'Cardiovascular', linked: false },
  { title: 'What GGT tells you about liver stress', tag: 'Liver', linked: false },
  { title: 'Visceral fat — why location matters', tag: 'Structural', linked: false },
  { title: 'How inflammation connects everything', tag: 'Inflammation', linked: false },
];

export default function LibraryPage() {
  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>MBH Library</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Health Literacy — in plain language</div>

      <div style={{ background: AMBER_BG, borderRadius: 12, padding: '14px 18px', marginBottom: 16, borderLeft: `3px solid ${AMBER}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: AMBER, marginBottom: 4 }}>Growing</div>
        <div style={{ fontSize: 13, color: AMBER_TEXT, lineHeight: 1.6 }}>The Library grows with your signal picture. Topics linked to your active priorities are highlighted.</div>
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {TOPICS.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < TOPICS.length - 1 ? `1px solid ${BORDER}` : 'none', opacity: t.linked ? 1 : 0.5 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: t.linked ? 600 : 400, color: SLATE, marginBottom: 3 }}>{t.title}</div>
              <span style={{ background: t.linked ? SAGE_BG : OFFWHITE, color: t.linked ? SAGE_TEXT : '#374151', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{t.tag}</span>
            </div>
            {t.linked
              ? <button style={{ background: SAGE_BG, border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 600, color: MBH_SAGE, cursor: 'pointer', flexShrink: 0 }}>Read →</button>
              : <span style={{ fontSize: 11, color: '#374151', flexShrink: 0 }}>Coming soon</span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}
