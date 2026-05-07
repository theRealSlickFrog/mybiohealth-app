// MyStrategy — priorities, MicroHabits, routines, strategy elements.
// All hardcoded from prototype: priorities/Rx/strategy elements aren't in DB yet.
import { useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, AMBER_TEXT, SLATE, OFFWHITE, CARD, BORDER, VERSION, RENEWAL } from '../lib/constants.js';
import { OPTIMAL_AUTHORITIES } from '../lib/optimal-authorities.js';
import OptimalDrawer from '../components/OptimalDrawer.jsx';
import ZoneChart from '../components/ZoneChart.jsx';

const MHX_LIST = [
  { name: 'Glucose rest', detail: '> 4 hours, 5/7 days', endGameKind: 'signal', endGameSignal: 'TAR', endGameNote: 'until TAR settles', renew: 'Next CGM cycle ~May 24' },
  { name: 'Protein-centric breakfast', detail: '5/7 days', endGameKind: 'steady', endGameNote: 'steady', renew: 'Next CGM cycle ~May 24' },
  { name: 'Deliberate nuts, seeds, legumes, fish — swap for refined carbs and sugars', detail: 'Start 2/7 days', endGameKind: 'cadence', endGameStart: '2/7', endGameGoal: '5/7', renew: 'Slow-burn pattern shift' },
];

const PRIORITIES = [
  {
    n: 1, name: 'Optimize ApoB', primarySignal: 'ApoB',
    target: 'Trending → < 0.80 g/L · re-test at 3 months',
    latest: '1.10', unit: 'g/L', latestDate: 'Jan 2025',
    history: [{ date: 'Mar 2019', value: '1.04' }, { date: 'Feb 2021', value: '1.13' }, { date: 'Mar 2023', value: '1.12' }, { date: 'Jan 2025', value: '1.10' }],
    chartConfig: { optimalMax: 0.80, driftMax: 1.20, driftMin: 0, optimalMin: 0, higherIsBetter: false },
    related: [{ label: 'LDL', value: '3.6 mmol/L' }, { label: 'non-HDL', value: '3.3 mmol/L' }],
    rx: 'Statin started', kind: 'chart',
  },
  {
    n: 2, name: 'Reduce TAR', primarySignal: null,
    target: '< 2 hr/day, then < 1 hr/day',
    latest: '4.9', unit: 'hr/day', latestDate: 'Cycle 1 · Apr 2026',
    next: 'Next CGM cycle ~May 24',
    related: [{ label: 'HOMA-IR', value: 'est. ok' }, { label: 'A1c', value: '5.5%' }],
    kind: 'donut', hr78: 4.0, hr10: 0.9, targetHr: 1,
  },
  {
    n: 3, name: 'Reduce Liver Stress', primarySignal: 'GGT',
    target: 'GGT < 35 → < 25 U/L',
    latest: '52', unit: 'U/L', latestDate: 'Jan 2025',
    history: [{ date: 'Mar 2017', value: '50' }, { date: 'Mar 2019', value: '70' }, { date: 'Feb 2021', value: '59' }, { date: 'Jan 2025', value: '52' }],
    chartConfig: { optimalMax: 25, driftMax: 50, driftMin: 0, optimalMin: 0, higherIsBetter: false },
    related: [{ label: 'ALT', value: '29 U/L' }, { label: 'AST', value: '—' }],
    kind: 'chart',
  },
];

function TARDonut({ hr78, hr10, target }) {
  // Simple SVG donut showing TAR breakdown
  const total = hr78 + hr10;
  const targetMet = total <= target;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 4px' }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={targetMet ? MBH_SAGE : '#c0483a'} strokeWidth="10"
          strokeDasharray={`${Math.min(total, 24) / 24 * 201} 201`} transform="rotate(-90 40 40)" />
        <text x="40" y="38" textAnchor="middle" fontFamily="monospace" fontSize="14" fontWeight="700" fill={SLATE}>{total.toFixed(1)}</text>
        <text x="40" y="52" textAnchor="middle" fontSize="9" fill="#6b7280">hrs/day</text>
      </svg>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
        <div>7.8–10: <strong>{hr78.toFixed(1)}h</strong></div>
        <div>&gt; 10: <strong>{hr10.toFixed(1)}h</strong></div>
        <div style={{ color: MBH_SAGE, marginTop: 4 }}>target &lt; {target} hr/day</div>
      </div>
    </div>
  );
}

function RxDetail() {
  return (
    <div style={{ background: OFFWHITE, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
      <strong style={{ color: SLATE }}>Statin started — Rosuvastatin 5mg.</strong> Recheck ApoB and full lipid panel at 3 months.
    </div>
  );
}

function NotesPair() {
  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10, marginTop: 4 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Notes pair (clinician + member) — coming soon</div>
    </div>
  );
}

export default function MyStrategyPage() {
  const [optimalSignal, setOptimalSignal] = useState(null);
  const [rxOpen, setRxOpen] = useState(null);

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      {optimalSignal && <OptimalDrawer signalName={optimalSignal} onClose={() => setOptimalSignal(null)} />}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, fontWeight: 'normal' }}>
          <em style={{ fontStyle: 'normal' }}>My</em>Strategy
        </h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#374151' }}>v{VERSION}</div>
          <div style={{ fontSize: 12, color: '#374151' }}>renews {RENEWAL}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Two habits. Three priorities. Signal-confirmed.</div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10 }}>Priorities</div>
      {PRIORITIES.map((p) => (
        <div key={p.n} style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: SLATE, color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>P{p.n}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: SLATE, lineHeight: 1.25, marginBottom: 3 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 12, color: MBH_SAGE, fontWeight: 600, fontFamily: 'monospace' }}>→ {p.target}</div>
                {p.primarySignal && OPTIMAL_AUTHORITIES[p.primarySignal] && (
                  <button onClick={() => setOptimalSignal(p.primarySignal)} style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: MBH_SAGE, fontSize: 13, lineHeight: 1, fontWeight: 700 }}>ⓘ</button>
                )}
              </div>
            </div>
          </div>

          {p.kind === 'chart' && p.history && (
            <div style={{ background: OFFWHITE, borderRadius: 10, padding: '10px 6px 6px', marginBottom: 10 }}>
              <ZoneChart history={p.history} unit={p.unit} {...p.chartConfig} />
              <div style={{ fontSize: 11, color: '#374151', textAlign: 'right', paddingRight: 12, marginTop: -2 }}>
                Latest: <strong style={{ color: SLATE, fontFamily: 'monospace' }}>{p.latest} {p.unit}</strong> · {p.latestDate}
              </div>
            </div>
          )}

          {p.kind === 'donut' && (
            <div style={{ background: OFFWHITE, borderRadius: 10, padding: '6px 10px 10px', marginBottom: 10 }}>
              <TARDonut hr78={p.hr78} hr10={p.hr10} target={p.targetHr} />
              <div style={{ fontSize: 11, color: '#374151', borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 4 }}>{p.latestDate} · {p.next}</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', marginRight: 2 }}>Related:</span>
            {p.related.map((r) => (
              <span key={r.label} style={{ background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '3px 10px', fontSize: 11, color: SLATE, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span style={{ color: '#374151' }}>{r.value}</span>
                {OPTIMAL_AUTHORITIES[r.label] && (
                  <button onClick={(e) => { e.stopPropagation(); setOptimalSignal(r.label); }} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 1, cursor: 'pointer', color: MBH_SAGE, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>ⓘ</button>
                )}
              </span>
            ))}
            {p.rx && (
              <button onClick={() => setRxOpen(rxOpen === p.n ? null : p.n)} style={{ background: SAGE_BG, border: `1px solid ${MBH_SAGE}40`, borderRadius: 14, padding: '3px 10px', fontSize: 11, color: SAGE_TEXT, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'baseline', gap: 5, cursor: 'pointer' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rx</span>
                <span>{p.rx}</span>
                <span style={{ opacity: 0.6, fontSize: 11 }}>{rxOpen === p.n ? '▲' : '▼'}</span>
              </button>
            )}
          </div>

          {p.rx && rxOpen === p.n && <RxDetail />}
          <NotesPair />
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10, marginTop: 8 }}>MicroHabits (MHx)</div>
      {MHX_LIST.map((mhx, i) => (
        <div key={i} style={{ background: CARD, borderRadius: 14, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MBH_SAGE, background: SAGE_BG, padding: '2px 8px', borderRadius: 10 }}>MHx ({i + 1})</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: SLATE, lineHeight: 1.35 }}>{mhx.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {mhx.endGameKind === 'cadence' && (<>
              <span style={{ fontSize: 12.5, color: '#374151' }}>Start <strong style={{ color: SLATE }}>{mhx.endGameStart}</strong></span>
              <span style={{ fontSize: 12, color: '#374151' }}>→</span>
              <span style={{ fontSize: 12.5, color: '#374151' }}>Goal <strong style={{ color: MBH_SAGE }}>{mhx.endGameGoal}</strong></span>
            </>)}
            {mhx.endGameKind === 'steady' && (<>
              <span style={{ fontSize: 12.5, color: SLATE, fontWeight: 600 }}>{mhx.detail}</span>
              <span style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>· steady, no escalation</span>
            </>)}
            {mhx.endGameKind === 'signal' && (<>
              <span style={{ fontSize: 12.5, color: SLATE, fontWeight: 600 }}>{mhx.detail}</span>
              <span style={{ fontSize: 11, color: '#374151' }}>· until →</span>
              <span style={{ fontSize: 11.5, color: MBH_SAGE, fontWeight: 600, background: SAGE_BG, padding: '1px 7px', borderRadius: 8 }}>{mhx.endGameSignal} settles</span>
            </>)}
          </div>
          <div style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>{mhx.renew}</div>
        </div>
      ))}

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 12 }}>Routines</div>
        {[{ label: 'Sleep', value: '7–7.5 hrs' }, { label: 'Strength', value: '2–3 / 7' }, { label: 'Cardio', value: '> 250 min/wk' }].map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 13, color: SLATE, fontWeight: 500 }}>{r.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: MBH_SAGE }}>{r.value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 12 }}>Strategy Elements</div>
        {[
          { type: 'Sx', label: 'Medically Directed Supplements', items: ['Vitamin D daily with fat', 'Omega 3 daily', 'B12'] },
          { type: 'Lx', label: 'Medically Directed Lifestyle Advice', items: ['CGM cycle timed to blood draw', 'Glucose rest · start 2/7 · goal 5/7'] },
          { type: 'Sm', label: 'Member elected Supplements', items: ['AG1 daily · explains elevated B12', 'Magnesium glycinate'] },
          { type: 'Rx', label: 'Prescriptions', items: ['None current'] },
        ].map((e) => (
          <div key={e.type} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: SLATE, color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{e.type}</span>
              <span style={{ fontSize: 11, color: '#374151' }}>{e.label}</span>
            </div>
            {e.items.map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 12, color: '#374151' }}>·</span>
                <span style={{ fontSize: 13, color: SLATE }}>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '13px 16px', background: '#eeeae4', borderRadius: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        <strong style={{ color: SLATE }}>About <em style={{ fontStyle: 'normal' }}>My</em>Strategy.</strong> A living plan — versioned, signal-linked, renewed on a cadence the member sets. v{VERSION} renews {RENEWAL}.
      </div>
    </div>
  );
}
