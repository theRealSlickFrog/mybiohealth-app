// Glucose Summary — live CGM cycles, 4-zone time-in-range (matching V1:
// Baseline <6.3 / Normal 6.3–7.8 / Spike 7.8–10 / Strong Spike >10). Cycle
// picker walks the member's real CGM_CYCLE records. Data via lib/glucose.js.
import { useEffect, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, SOFT_RED, SLATE, OFFWHITE, CARD, BORDER, AMBER_BG, AMBER_TEXT } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';
import { loadGlucose, loadGlucoseExtras } from '../lib/glucose.js';
import PersonalNote from '../components/PersonalNote.jsx';

const ZONE_COLOR = { baseline: '#6fa392', normal: MBH_SAGE, spike: AMBER, strong: SOFT_RED };
const exposureColor = (e) => (e === 'Low' ? MBH_SAGE : e === 'Moderate' ? AMBER : SOFT_RED);
const fmtNum = (v) => (v == null ? '—' : String(v));

function fmtDate(d, withYear) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
}

// 4-segment exposure bar (widths = TIR %). Min visual width so tiny zones show.
function ExposureBar({ zones }) {
  const total = zones.reduce((s, z) => s + (z.pct || 0), 0) || 100;
  return (
    <div style={{ display: 'flex', width: '100%', height: 14, borderRadius: 6, overflow: 'hidden', background: '#2a3a4a' }}>
      {zones.map((z) => (z.pct ? (
        <div key={z.key} title={`${z.label} · ${z.pct}%`} style={{ width: `${(z.pct / total) * 100}%`, background: ZONE_COLOR[z.key] }} />
      ) : null))}
    </div>
  );
}

function CycleView({ cycle }) {
  return (
    <>
      {/* Hero: Time Above Range */}
      <div style={{ background: SLATE, borderRadius: 14, padding: '22px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: exposureColor(cycle.exposure), marginBottom: 8 }}>
          Time Above Range — {cycle.exposure} Exposure
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 52, color: 'white', lineHeight: 1, letterSpacing: '-2px' }}>{fmtNum(cycle.tarHours)}</div>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>hrs / day</div>
            <div style={{ fontSize: 11, color: exposureColor(cycle.exposure), marginTop: 3, fontWeight: 600 }}>above 7.8 mmol/L · optimal &lt; 1 hr</div>
          </div>
        </div>
        <ExposureBar zones={cycle.zones} />
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
          {cycle.zones.map((z) => (
            <div key={z.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ZONE_COLOR[z.key], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>{z.label}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{z.pct != null ? z.pct + '%' : '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4 zone cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {cycle.zones.map((z) => (
          <div key={z.key} style={{ background: CARD, borderRadius: 12, padding: '14px 14px', borderTop: `3px solid ${ZONE_COLOR[z.key]}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: ZONE_COLOR[z.key], marginBottom: 6, lineHeight: 1.2 }}>{z.label}</div>
            <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>{z.range} mmol/L</div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: SLATE, lineHeight: 1 }}>
              {fmtNum(z.hours)}<span style={{ fontSize: 12, color: '#374151', marginLeft: 3 }}>hrs</span>
            </div>
            <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{z.pct != null ? z.pct + '% of day' : '—'}</div>
          </div>
        ))}
      </div>

      {/* Cycle metrics */}
      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 14 }}>Cycle Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Variability', value: cycle.metrics.cv, unit: '%' },
            { label: 'Avg Glucose', value: cycle.metrics.avg, unit: 'mmol/L' },
            { label: 'Median Daytime', value: cycle.metrics.day, unit: 'mmol/L' },
            { label: 'Median Overnight', value: cycle.metrics.night, unit: 'mmol/L' },
          ].map((m, i) => (
            <div key={m.label} style={{ paddingBottom: i < 2 ? 14 : 0, borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: 11, color: '#374151', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: SLATE, lineHeight: 1 }}>
                {fmtNum(m.value)}<span style={{ fontSize: 12, color: '#374151', marginLeft: 3 }}>{m.value != null ? m.unit : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinician note (CGM_NOTE) */}
      {cycle.note && (
        <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `3px solid ${MBH_SAGE}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 8 }}>
            <em style={{ fontStyle: 'normal' }}>My</em>BioHealth Note
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{cycle.note}</div>
        </div>
      )}
    </>
  );
}

// Collapsible side-panel dropdown — collapsed by default to avoid clutter.
function Dropdown({ title, count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: SAGE_BG, border: '1px solid #cfc8ba', borderRadius: open ? '8px 8px 0 0' : 8, padding: '12px 16px' }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: SAGE_TEXT }}>{title}{count != null ? ` (${count})` : ''}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: SLATE }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ border: '1px solid #cfc8ba', borderTop: 'none', borderRadius: '0 0 8px 8px', background: CARD, overflow: 'hidden' }}>{children}</div>}
    </div>
  );
}

function RelatedMarkers({ items }) {
  const cols = '1.6fr 1fr 1fr 1.2fr';
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '8px 16px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', borderBottom: `1px solid ${BORDER}` }}>
        <span>Marker</span><span style={{ textAlign: 'right' }}>Latest</span><span style={{ textAlign: 'right' }}>Previous</span><span style={{ textAlign: 'right' }}>Reference</span>
      </div>
      {items.map((m, i) => (
        <div key={m.code} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 16px', fontSize: 12.5, alignItems: 'center', borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
          <span style={{ color: SLATE, fontWeight: 600 }}>{m.name}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', color: SLATE }}>{m.latest ?? '—'}{m.latest && m.unit ? ` ${m.unit}` : ''}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>{m.previous ?? '—'}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>{m.reference}</span>
        </div>
      ))}
    </div>
  );
}

function MicroHabits({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
      {items.map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: OFFWHITE, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${MBH_SAGE}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>{h.name}</div>
            {h.category && <div style={{ fontSize: 11, color: '#6b7280' }}>{h.category}</div>}
          </div>
          {h.frequency && <span style={{ fontSize: 11, fontWeight: 600, color: SAGE_TEXT, background: SAGE_BG, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>{h.frequency}</span>}
        </div>
      ))}
    </div>
  );
}

export default function GlucoseSummaryPage() {
  const [cycles, setCycles] = useState(null);
  const [extras, setExtras] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0); // 0 = newest

  useEffect(() => {
    let cancelled = false;
    const member = getStoredGuid() || DEV_MEMBER;
    loadGlucose(member)
      .then((c) => { if (!cancelled) setCycles(c); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load'); });
    loadGlucoseExtras(member)
      .then((x) => { if (!cancelled) setExtras(x); })
      .catch((e) => { console.warn('Glucose extras failed:', e); });
    return () => { cancelled = true; };
  }, []);

  const cycle = cycles && cycles[idx];

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, fontWeight: 'normal' }}>Glucose Summary</h1>
        {cycles && cycles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
            <button onClick={() => setIdx((i) => Math.min(cycles.length - 1, i + 1))} disabled={idx >= cycles.length - 1}
              style={{ background: 'none', border: 'none', fontSize: 16, color: idx >= cycles.length - 1 ? '#d1d5db' : SLATE, cursor: idx >= cycles.length - 1 ? 'default' : 'pointer', padding: '0 2px', fontWeight: 700, lineHeight: 1 }}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, whiteSpace: 'nowrap' }}>{cycle.label} · {fmtDate(cycle.endDate, true)}</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{idx + 1} / {cycles.length}</div>
            </div>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx <= 0}
              style={{ background: 'none', border: 'none', fontSize: 16, color: idx <= 0 ? '#d1d5db' : SLATE, cursor: idx <= 0 ? 'default' : 'pointer', padding: '0 2px', fontWeight: 700, lineHeight: 1 }}>›</button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>
        {cycle ? `14-day CGM cycle · ${fmtDate(cycle.startDate)} – ${fmtDate(cycle.endDate, true)}` : '14-day CGM cycle'}
      </div>

      {error && (
        <div style={{ background: AMBER_BG, border: `1px solid ${AMBER}`, borderRadius: 10, padding: '14px 16px', fontSize: 12.5, color: AMBER_TEXT, lineHeight: 1.6 }}>
          Couldn't load glucose data ({error}). If you're viewing locally, the proxy only allows the deployed origins — open the deployed app for live data.
        </div>
      )}
      {!cycles && !error && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>}
      {cycles && cycles.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No CGM cycles on record yet.</div>}
      {cycle && <CycleView cycle={cycle} />}

      {extras && extras.relatedMarkers.length > 0 && (
        <Dropdown title="Related Markers" count={extras.relatedMarkers.length}>
          <RelatedMarkers items={extras.relatedMarkers} />
        </Dropdown>
      )}
      {extras && extras.microHabits.length > 0 && (
        <Dropdown title="MicroHabits" count={extras.microHabits.length}>
          <MicroHabits items={extras.microHabits} />
        </Dropdown>
      )}

      {cycles && <PersonalNote noteKey="glucose" />}

      <div style={{ padding: '13px 16px', background: '#eeeae4', borderRadius: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginTop: 16 }}>
        <strong style={{ color: SLATE }}>About CGM cycles.</strong> A CGM cycle is a 14-day continuous glucose snapshot. Zones: Baseline &lt; 6.3, Normal 6.3–7.8, Spike 7.8–10, Strong Spike &gt; 10 mmol/L. Time Above Range is the daily hours above 7.8 (Spike + Strong Spike).
      </div>
    </div>
  );
}
