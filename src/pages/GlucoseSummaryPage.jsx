// Glucose Summary — CGM cycle metrics, time-above-range, exposure bands.
// Hardcoded data for now; live cycle/marker fetch comes in a follow-up commit.
import { useState } from 'react';
import { MBH_SAGE, AMBER, SOFT_RED, SLATE, CARD, BORDER } from '../lib/constants.js';
import { SignalChip } from '../components/UI.jsx';

function ExposureBar() {
  const h = 14, VW = 1000, greenEnd = 130, gapStart = 133, gapEnd = 158, amberEnd = 570;
  return (
    <div style={{ position: 'relative', width: '100%', height: h, borderRadius: 6, overflow: 'hidden' }}>
      <svg width="100%" height={h} viewBox={`0 0 ${VW} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs><clipPath id="bc"><rect x="0" y="0" width={VW} height={h} rx="6" /></clipPath></defs>
        <g clipPath="url(#bc)">
          <rect x={amberEnd} y="0" width={VW - amberEnd} height={h} fill={SOFT_RED} />
          <rect x={gapEnd} y="0" width={amberEnd - gapEnd + 2} height={h} fill={AMBER} />
          <rect x="0" y="0" width={greenEnd} height={h} fill={MBH_SAGE} />
          <rect x={gapStart} y="0" width={gapEnd - gapStart} height={h} fill="rgba(30,45,61,0.95)" />
        </g>
      </svg>
    </div>
  );
}

export default function GlucoseSummaryPage() {
  const [cycle, setCycle] = useState(1);
  const ZONES = [
    { label: 'Low Exposure', range: '< 6.3', pct: 58.6, hrs: 14.1, color: MBH_SAGE },
    { label: 'Moderate Exposure', range: '6.3–7.8', pct: 20.9, hrs: 5.0, color: AMBER },
    { label: 'High Exposure', range: '> 7.8', pct: 20.6, hrs: 4.9, color: SOFT_RED },
  ];

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, fontWeight: 'normal' }}>Glucose Summary</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
          <button onClick={() => setCycle((c) => Math.max(1, c - 1))} disabled={cycle <= 1} style={{ background: 'none', border: 'none', fontSize: 16, color: cycle <= 1 ? '#d1d5db' : SLATE, cursor: cycle <= 1 ? 'default' : 'pointer', padding: '0 2px', fontWeight: 700, lineHeight: 1 }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, whiteSpace: 'nowrap' }}>Cycle {cycle} · Apr 24, 2026</div>
            <div style={{ fontSize: 12, color: '#374151', textAlign: 'center' }}>{cycle} / 1</div>
          </div>
          <button onClick={() => setCycle((c) => Math.min(1, c + 1))} disabled={cycle >= 1} style={{ background: 'none', border: 'none', fontSize: 16, color: cycle >= 1 ? '#d1d5db' : SLATE, cursor: cycle >= 1 ? 'default' : 'pointer', padding: '0 2px', fontWeight: 700, lineHeight: 1 }}>›</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>14-day CGM cycle · 15-min intervals</div>

      <div style={{ background: SLATE, borderRadius: 14, padding: '22px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: SOFT_RED, marginBottom: 8 }}>Time Above Range — High Exposure</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 52, color: 'white', lineHeight: 1, letterSpacing: '-2px' }}>4.9</div>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>hrs / day</div>
            <div style={{ fontSize: 11, color: SOFT_RED, marginTop: 3, fontWeight: 600 }}>above 7.8 mmol/L · optimal &lt; 1 hr</div>
          </div>
        </div>
        <ExposureBar />
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: MBH_SAGE, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Low Exposure</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>(not to scale)</span>
          </div>
          {[{ label: 'Moderate Exposure', color: AMBER, pct: '20.9%' }, { label: 'High Exposure', color: SOFT_RED, pct: '20.6%' }].map((z) => (
            <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{z.label}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{z.pct}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {ZONES.map((z) => (
          <div key={z.label} style={{ background: CARD, borderRadius: 12, padding: '14px 16px', borderTop: `3px solid ${z.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: z.color, marginBottom: 6 }}>{z.label}</div>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>{z.range} mmol/L</div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: SLATE, lineHeight: 1 }}>
              {z.hrs}<span style={{ fontSize: 12, color: '#374151', marginLeft: 3 }}>hrs</span>
            </div>
            <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{z.pct}% of day</div>
          </div>
        ))}
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 14 }}>Cycle Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Avg Glucose', value: '~6.14', unit: 'mmol/L', note: 'Influenced by High Exposure hours' },
            { label: 'Median Daytime', value: '7.6', unit: 'mmol/L', note: 'Running adjacent to the 7.8 threshold — a protracted baseline, not a spike pattern.', noteColor: AMBER },
            { label: 'Median Overnight', value: '5.3', unit: 'mmol/L', note: 'Clean — fasting metabolism optimal' },
          ].map((m, i) => (
            <div key={m.label} style={{ paddingBottom: i < 2 ? 14 : 0, borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: 11, color: '#374151', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: m.noteColor || SLATE, lineHeight: 1 }}>
                {m.value}<span style={{ fontSize: 12, color: '#374151', marginLeft: 3 }}>{m.unit}</span>
              </div>
              <div style={{ fontSize: 11, color: m.noteColor || '#6b7280', marginTop: 4, lineHeight: 1.4 }}>{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16, background: '#f0f8f6', borderLeft: `3px solid ${SOFT_RED}`, borderRadius: '0 10px 10px 0', padding: '13px 16px', fontSize: 13.5, lineHeight: 1.65, color: '#374151' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: SOFT_RED, marginBottom: 6 }}>What High Exposure hours mean</div>
        Glucose above 7.8 mmol/L for 4.9 hours per day is a sustained metabolic load — particularly striking given optimal fasting glucose, HbA1c, and a clean overnight. The exposure is happening between meals.
        <div style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic', color: '#6b7280' }}>Your overnight is clean. Your fasting is clean. The window between meals is where the exposure accumulates.</div>
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `3px solid ${MBH_SAGE}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 8 }}>MBH Note</div>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>
          Your overnight glucose is clean — fasting metabolism is working. The exposure is entirely in the daytime windows between meals. GGT at 52 U/L confirms the liver is carrying a sustained sugar load. Two priorities: close the longest meal gap, and start the day with protein rather than carbohydrates.
        </div>
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10 }}>Cycle History</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>Cycle 1 · April 2026</div>
            <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>14-day wear · baseline established</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: SOFT_RED }}>4.9 hrs TAR</span>
            <SignalChip status="watch" />
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#374151', fontStyle: 'italic' }}>Cycle 2 will appear here. Newest on top.</div>
      </div>

      <div style={{ background: SLATE, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Next Recommended CGM Cycle</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>📅</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'white', lineHeight: 1.3 }}>~Early June 2026</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.5 }}>Timed to your next blood draw. Start wear ~14 days before.</div>
          </div>
        </div>
        <div style={{ paddingTop: 12, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
          The MBH rhythm: CGM + blood draw together, sliding toward quarterly, until your signals are consistently optimal.
        </div>
      </div>

      <div style={{ padding: '13px 16px', background: '#eeeae4', borderRadius: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        <strong style={{ color: SLATE }}>About CGM cycles.</strong> A CGM cycle is a 14-day continuous glucose snapshot. This is Cycle 1.
      </div>
    </div>
  );
}
