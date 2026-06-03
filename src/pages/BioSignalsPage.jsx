// BioSignals — primary biomarker history. Each marker is a collapsible card:
// a Plotly time-series (zone shading, per-point emojis, dtick toggles via the
// shared PlotlyChart), the marker explainer, and a 2-per-row grid of related
// markers, each its own collapsible mini-chart. Section titles, values,
// thresholds and zones all come from the member's report_ready_result; related
// markers from marker_x_marker — mirroring the V1 history page.
import { useEffect, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, AMBER_BG, AMBER_TEXT, GAP_BG, GAP_TEXT, GAP_BORDER, SOFT_RED, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { loadBiomarkers, markerZone, ZONE_LABEL, DEV_MEMBER } from '../lib/biomarkers.js';
import PlotlyChart from '../components/PlotlyChart.jsx';

// Zone → chip palette. Labels come from ZONE_LABEL (V1 vocabulary).
const ZONE_STYLE = {
  optimal:      { bg: SAGE_BG,   color: SAGE_TEXT },
  drift:        { bg: AMBER_BG,  color: AMBER_TEXT },
  driftPlus:    { bg: AMBER_BG,  color: AMBER_TEXT },
  belowOptimal: { bg: AMBER_BG,  color: AMBER_TEXT },
  concern:      { bg: '#fdecea', color: '#b3261e' },
  nodata:       { bg: GAP_BG,    color: GAP_TEXT },
};
function zoneColor(zone) {
  return zone === 'optimal' ? MBH_SAGE : zone === 'concern' ? SOFT_RED : zone === 'nodata' ? GAP_BORDER : AMBER;
}
function trendSymbol(dir) { return dir === 'up' ? '↗' : dir === 'down' ? '↘' : dir === 'flat' ? '→' : '·'; }

function ZoneChip({ zone }) {
  const s = ZONE_STYLE[zone] || ZONE_STYLE.nodata;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {ZONE_LABEL[zone]}
    </span>
  );
}
function Trend({ dir, zone }) {
  return <span style={{ color: zoneColor(zone), fontSize: 14, fontWeight: 700, width: 14, textAlign: 'center' }}>{trendSymbol(dir)}</span>;
}

function RelatedCard({ sub }) {
  const [open, setOpen] = useState(false);
  const zone = markerZone(sub.latest, sub.thresholds, sub.history);
  const hasChart = sub.history && sub.history.length > 1;
  return (
    <div style={{ background: OFFWHITE, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>{sub.name}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Optimal Zone {sub.optimal}{sub.unit ? ' · ' + sub.unit : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: zone === 'concern' ? SOFT_RED : SLATE }}>
            {sub.latest ?? '—'}{sub.latest && sub.unit ? ' ' + sub.unit : ''}
          </span>
          <Trend dir={sub.trendDir} zone={zone} />
          <ZoneChip zone={zone} />
          <span style={{ fontSize: 14, fontWeight: 700, color: SLATE }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {hasChart
            ? <PlotlyChart history={sub.history} thresholds={sub.thresholds} unit={sub.unit} markerName={sub.name} height={180} />
            : <div style={{ fontSize: 12, color: GAP_TEXT, fontStyle: 'italic', padding: '2px 2px 4px' }}>Not yet tested — add to next draw.</div>}
        </div>
      )}
    </div>
  );
}

function Related({ related }) {
  const [open, setOpen] = useState(false);
  if (!related || !related.length) return null;
  return (
    <div style={{ borderLeft: `3px solid ${MBH_SAGE}`, paddingLeft: 12, marginTop: 4 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', background: SAGE_BG, border: `1px solid #cfc8ba`, borderRadius: 8, padding: '10px 14px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: SAGE_TEXT }}>Related Markers ({related.length})</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: SLATE }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12, marginTop: 12 }}>
          {related.map((sub) => <RelatedCard key={sub.name} sub={sub} />)}
        </div>
      )}
    </div>
  );
}

function MarkerCard({ marker, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const zone = markerZone(marker.latest, marker.thresholds, marker.history);
  return (
    <div style={{ background: CARD, border: '1px solid #cfc8ba', borderRadius: 14, boxShadow: '0 2px 6px rgba(30,45,61,0.07)', marginBottom: 14, overflow: 'hidden' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>{(marker.header || '').replace('|', ' · ')}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: SLATE }}>{marker.name}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Optimal Zone {marker.optimal}{marker.unit ? ' · ' + marker.unit : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: zone === 'concern' ? SOFT_RED : SLATE }}>
            {marker.latest ?? '—'}{marker.latest && marker.unit ? ' ' + marker.unit : ''}
          </span>
          <Trend dir={marker.trendDir} zone={zone} />
          <ZoneChip zone={zone} />
          <span style={{ fontSize: 16, fontWeight: 700, color: SLATE }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 20px 18px' }}>
          {marker.history && marker.history.length > 1 && (
            <div style={{ background: OFFWHITE, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <PlotlyChart history={marker.history} thresholds={marker.thresholds} unit={marker.unit} markerName={marker.name} height={300} />
            </div>
          )}
          {marker.description && (
            <div style={{ background: '#f4f1ec', borderLeft: '3px solid #cfc8ba', borderRadius: '0 8px 8px 0', padding: '10px 14px', fontSize: 12.5, lineHeight: 1.6, color: '#5b5346', marginBottom: 12 }}>
              {marker.description}
            </div>
          )}
          <Related related={marker.related} />
        </div>
      )}
    </div>
  );
}

export default function BioSignalsPage() {
  const [markers, setMarkers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const member = getStoredGuid() || DEV_MEMBER;
    loadBiomarkers(member)
      .then((m) => { if (!cancelled) setMarkers(m); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>BioSignals</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 18 }}>Primary markers over time · tap any marker to expand its trend and related markers</div>

      {error && (
        <div style={{ background: AMBER_BG, border: `1px solid ${AMBER}`, borderRadius: 10, padding: '14px 16px', fontSize: 12.5, color: AMBER_TEXT, lineHeight: 1.6 }}>
          Couldn't load your biosignals ({error}). If you're viewing this locally, the data proxy only allows the deployed origins — open the deployed app to see live data.
        </div>
      )}
      {!markers && !error && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>}
      {markers && markers.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No biomarker history on record yet.</div>}
      {markers && markers.map((m, i) => <MarkerCard key={m.code} marker={m} defaultOpen={i < 2} />)}
    </div>
  );
}
