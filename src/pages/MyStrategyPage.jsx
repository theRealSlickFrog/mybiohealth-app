// MyStrategy — fully driven by mystrategy_report_ready (the materialized
// read model, same naming convention as report_ready_result). Front end is
// dumb: read one row by member_id, render flat.
// Two external lookups per priority that has a primary marker:
//   1) marker history from report_ready_result (for the chart)
//   2) related markers from marker_x_marker (for the "Related: X" pills)
// Both are derived from a single bulk fetch each at load time.
import { useState, useEffect } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, AMBER_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';
import { OPTIMAL_AUTHORITIES } from '../lib/optimal-authorities.js';
import { getStoredGuid } from '../lib/auth.js';
import OptimalDrawer from '../components/OptimalDrawer.jsx';
import WhyModal from '../components/WhyModal.jsx';
import PlotlyChart from '../components/PlotlyChart.jsx';

const API_BASE = 'https://kenises-api-proxy.netlify.app';

function TARDonut({ hr78, hr10, target }) {
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

function RxDetail({ text }) {
  return (
    <div style={{ background: OFFWHITE, borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
      <strong style={{ color: SLATE }}>{text}.</strong>
    </div>
  );
}


// Pull priorities/mhx/strategy_elements out of the flat row into a shape
// the render code can map over.
function unflattenRow(row) {
  if (!row) return null;
  const priorities = [];
  for (let n = 1; n <= 3; n++) {
    if (!row[`p${n}_name`]) continue;
    priorities.push({
      n,
      name: row[`p${n}_name`],
      kind: row[`p${n}_kind`],
      primaryMarker: row[`p${n}_primary_marker`] || null,
      target: row[`p${n}_target_text`],
      latest: row[`p${n}_latest_value`],
      unit: row[`p${n}_unit`],
      latestDate: row[`p${n}_latest_date`],
      nextText: row[`p${n}_next_text`],
      rx: row[`p${n}_rx_text`],
      why: row[`p${n}_why_text`],
      hr78: row[`p${n}_donut_hr78`],
      hr10: row[`p${n}_donut_hr10`],
      targetHr: row[`p${n}_donut_target_hr`],
    });
  }
  const mhx = [];
  for (let n = 1; n <= 6; n++) {
    if (!row[`mhx${n}_name`]) continue;
    mhx.push({
      n,
      name: row[`mhx${n}_name`],
      frequency: row[`mhx${n}_frequency`],
      endGameKind: row[`mhx${n}_end_game_kind`],
      endGameSignal: row[`mhx${n}_end_game_signal`],
      endGameStart: row[`mhx${n}_end_game_start`],
      endGameGoal: row[`mhx${n}_end_game_goal`],
      renew: row[`mhx${n}_renew_text`],
      why: row[`mhx${n}_why_text`],
    });
  }
  const strategyElements = ['sx', 'lx', 'sm', 'rx']
    .filter((t) => row[`${t}_label`])
    .map((t) => ({
      type: t.toUpperCase().replace('S', 'S').replace('L', 'L'),
      typeLabel: t === 'sx' ? 'Sx' : t === 'lx' ? 'Lx' : t === 'sm' ? 'Sm' : 'Rx',
      label: row[`${t}_label`],
      items: (row[`${t}_items`] || '').split('\n').map((s) => s.trim()).filter(Boolean),
    }));
  return {
    version: row.version,
    tagline: row.tagline,
    effectiveTo: row.effective_to,
    priorities,
    mhx,
    routines: [
      { label: 'Sleep', value: row.routine_sleep },
      { label: 'Strength', value: row.routine_strength },
      { label: 'Cardio', value: row.routine_cardio },
    ],
    strategyElements,
  };
}

export default function MyStrategyPage() {
  const [optimalSignal, setOptimalSignal] = useState(null);
  const [openPriorities, setOpenPriorities] = useState({ 1: true, 2: true, 3: true });
  const [why, setWhy] = useState(null);   // { title, body } for the WhyModal
  const [rxOpen, setRxOpen] = useState(null);
  const togglePriority = (n) => setOpenPriorities((p) => ({ ...p, [n]: !p[n] }));

  const [strategy, setStrategy] = useState(null);
  const [labRows, setLabRows] = useState([]);
  const [relations, setRelations] = useState([]);
  const [state, setState] = useState('loading');     // loading | empty | ready

  useEffect(() => {
    let cancelled = false;
    const guid = getStoredGuid();
    if (!guid) { setState('empty'); return; }

    (async () => {
      try {
        const where = encodeURIComponent(`member_id='${guid}'`);
        const [stratResp, rrrResp, mxmResp] = await Promise.all([
          fetch(`${API_BASE}/rest/v2/tables/mystrategy_report_ready/records?q.where=${where}&q.orderBy=effective_from DESC&q.limit=1`),
          fetch(`${API_BASE}/rest/v2/tables/report_ready_result/records?q.where=${where}&q.limit=500`),
          fetch(`${API_BASE}/rest/v2/tables/marker_x_marker/records?q.where=relationship_type='related'&q.limit=200`),
        ]);
        if (!stratResp.ok) { if (!cancelled) setState('empty'); return; }
        const stratRow = ((await stratResp.json()).Result || [])[0];
        if (!stratRow) { if (!cancelled) setState('empty'); return; }
        const rrr = (rrrResp.ok ? (await rrrResp.json()).Result : []) || [];
        const mxm = (mxmResp.ok ? (await mxmResp.json()).Result : []) || [];
        if (cancelled) return;
        setStrategy(unflattenRow(stratRow));
        setLabRows(rrr);
        setRelations(mxm);
        setState('ready');
      } catch (e) {
        console.error('MyStrategy load error:', e);
        if (!cancelled) setState('empty');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build chart history + threshold profile for a marker_code from labRows
  function historyFor(markerCode) {
    if (!markerCode) return null;
    const rows = labRows
      .filter((r) => r.marker_code === markerCode)
      .sort((a, b) => (a.report_date || '').localeCompare(b.report_date || ''));
    if (rows.length === 0) return null;
    const sample = rows[rows.length - 1]; // use most recent row's thresholds
    return {
      history: rows.map((r) => ({
        date: r.report_date ? r.report_date.slice(0, 10) : '',  // ISO date for Plotly's date axis
        value: parseFloat(r.marker_value),
      })),
      thresholds: {
        display_min:       parseFloat(sample.display_min),
        display_max:       parseFloat(sample.display_max),
        lower_optimal:     parseFloat(sample.lower_optimal),
        upper_optimal:     parseFloat(sample.upper_optimal),
        lower_drift:       parseFloat(sample.lower_drift),
        upper_drift:       parseFloat(sample.upper_drift),
        concern_direction: sample.Concern_direction,
        concern_threshold: parseFloat(sample.concern_threshold),
      },
    };
  }

  // Related markers for a primary, with their latest values
  function relatedFor(markerCode) {
    if (!markerCode) return [];
    const codes = relations
      .filter((r) => r.marker_a === markerCode)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((r) => r.marker_b);
    return codes.map((code) => {
      const latest = labRows
        .filter((r) => r.marker_code === code)
        .sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''))[0];
      return {
        label: code,
        value: latest ? `${latest.marker_value} ${latest.measurement || ''}`.trim() : '—',
      };
    });
  }

  if (state === 'loading') {
    return <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading strategy…</div>;
  }
  if (state === 'empty' || !strategy) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        No active strategy on file yet.
      </div>
    );
  }

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      {optimalSignal && <OptimalDrawer signalName={optimalSignal} onClose={() => setOptimalSignal(null)} />}
      {why && <WhyModal title={why.title} body={why.body} onClose={() => setWhy(null)} />}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, fontWeight: 'normal' }}>
          <em style={{ fontStyle: 'normal' }}>My</em>Strategy
        </h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#374151' }}>v{strategy.version}</div>
          {strategy.effectiveTo && <div style={{ fontSize: 12, color: '#374151' }}>renews {strategy.effectiveTo.slice(0, 10)}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>{strategy.tagline}</div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10 }}>Priorities</div>
      {strategy.priorities.map((p) => {
        const isOpen = openPriorities[p.n];
        const hist = p.primaryMarker ? historyFor(p.primaryMarker) : null;
        const related = relatedFor(p.primaryMarker);
        return (
          <div key={p.n} style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 12 }}>
            <div onClick={() => togglePriority(p.n)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: isOpen ? 12 : 0, cursor: 'pointer' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: SLATE, color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>P{p.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: SLATE, lineHeight: 1.25, marginBottom: 3 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 12, color: MBH_SAGE, fontWeight: 600, fontFamily: 'monospace' }}>{'→'} {p.target}</div>
                  {p.primaryMarker && OPTIMAL_AUTHORITIES[p.primaryMarker] && (
                    <button onClick={(e) => { e.stopPropagation(); setOptimalSignal(p.primaryMarker); }} style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: MBH_SAGE, fontSize: 13, lineHeight: 1, fontWeight: 700 }}>{'ⓘ'}</button>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, lineHeight: 1, flexShrink: 0, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>{'▼'}</span>
            </div>

            {isOpen && (<>
              {p.kind === 'chart' && hist && hist.history.length > 0 && (
                <div style={{ background: OFFWHITE, borderRadius: 10, padding: '10px 6px 6px', marginBottom: 10 }}>
                  <PlotlyChart history={hist.history} thresholds={hist.thresholds} unit={p.unit} markerName={p.primaryMarker} />
                  <div style={{ fontSize: 11, color: '#374151', textAlign: 'right', paddingRight: 12, marginTop: -2 }}>
                    Latest: <strong style={{ color: SLATE, fontFamily: 'monospace' }}>{p.latest} {p.unit}</strong> · {p.latestDate}
                  </div>
                </div>
              )}

              {p.kind === 'donut' && p.hr78 != null && (
                <div style={{ background: OFFWHITE, borderRadius: 10, padding: '6px 10px 10px', marginBottom: 10 }}>
                  <TARDonut hr78={parseFloat(p.hr78)} hr10={parseFloat(p.hr10)} target={parseFloat(p.targetHr)} />
                  <div style={{ fontSize: 11, color: '#374151', borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 4 }}>{p.latestDate}{p.nextText ? ` · ${p.nextText}` : ''}</div>
                </div>
              )}

              {related.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151', marginRight: 2 }}>Related:</span>
                  {related.map((r) => (
                    <span key={r.label} style={{ background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '3px 10px', fontSize: 11, color: SLATE, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontWeight: 600 }}>{r.label}</span>
                      <span style={{ color: '#374151' }}>{r.value}</span>
                      {OPTIMAL_AUTHORITIES[r.label] && (
                        <button onClick={(e) => { e.stopPropagation(); setOptimalSignal(r.label); }} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 1, cursor: 'pointer', color: MBH_SAGE, fontSize: 11, lineHeight: 1, fontWeight: 700 }}>{'ⓘ'}</button>
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
              )}

              {p.rx && rxOpen === p.n && <RxDetail text={p.rx} />}

              {p.why && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setWhy({ title: p.name, body: p.why })} style={{ background: 'none', border: `1px solid ${MBH_SAGE}50`, borderRadius: 14, padding: '3px 11px', fontSize: 11, fontWeight: 600, color: MBH_SAGE, cursor: 'pointer' }}>
                    The Why →
                  </button>
                </div>
              )}
            </>)}
          </div>
        );
      })}

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10, marginTop: 8 }}>MicroHabits (MHx)</div>
      {strategy.mhx.map((m) => (
        <div key={m.n} style={{ background: CARD, borderRadius: 14, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MBH_SAGE, background: SAGE_BG, padding: '2px 8px', borderRadius: 10 }}>MHx ({m.n})</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: SLATE, lineHeight: 1.35 }}>{m.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {m.endGameKind === 'cadence' && (<>
              <span style={{ fontSize: 12.5, color: '#374151' }}>Start <strong style={{ color: SLATE }}>{m.endGameStart}</strong></span>
              <span style={{ fontSize: 12, color: '#374151' }}>{'→'}</span>
              <span style={{ fontSize: 12.5, color: '#374151' }}>Goal <strong style={{ color: MBH_SAGE }}>{m.endGameGoal}</strong></span>
            </>)}
            {m.endGameKind === 'steady' && (<>
              <span style={{ fontSize: 12.5, color: SLATE, fontWeight: 600 }}>{m.frequency}</span>
            </>)}
            {m.endGameKind === 'signal' && (<>
              <span style={{ fontSize: 12.5, color: SLATE, fontWeight: 600 }}>{m.frequency}</span>
              <span style={{ fontSize: 11, color: '#374151' }}>· until {'→'}</span>
              <span style={{ fontSize: 11.5, color: MBH_SAGE, fontWeight: 600, background: SAGE_BG, padding: '1px 7px', borderRadius: 8 }}>{m.endGameSignal} settles</span>
            </>)}
          </div>
          {m.renew && <div style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' }}>{m.renew}</div>}
          {m.why && (
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setWhy({ title: m.name, body: m.why })} style={{ background: 'none', border: `1px solid ${MBH_SAGE}50`, borderRadius: 14, padding: '3px 11px', fontSize: 11, fontWeight: 600, color: MBH_SAGE, cursor: 'pointer' }}>
                The Why →
              </button>
            </div>
          )}
        </div>
      ))}

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 12 }}>Routines</div>
        {strategy.routines.filter((r) => r.value).map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 13, color: SLATE, fontWeight: 500 }}>{r.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: MBH_SAGE }}>{r.value}</span>
          </div>
        ))}
      </div>

      {strategy.strategyElements.length > 0 && (
        <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 12 }}>Strategy Elements</div>
          {strategy.strategyElements.map((e) => (
            <div key={e.typeLabel} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ background: SLATE, color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{e.typeLabel}</span>
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
      )}

      <div style={{ padding: '13px 16px', background: '#eeeae4', borderRadius: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        <strong style={{ color: SLATE }}>About <em style={{ fontStyle: 'normal' }}>My</em>Strategy.</strong> A living plan — versioned, signal-linked, renewed on a cadence the member sets.
      </div>
    </div>
  );
}
