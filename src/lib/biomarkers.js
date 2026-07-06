// Biomarker data layer — fetches the logged-in member's history from the proxy
// and shapes it for the BioSignals charts page. Mirrors the V1 history page:
// report_ready_result (markers, values, thresholds, section titles via
// display_header, ordering via display_order), marker_x_marker (related
// markers), reference_code_desc (display names + descriptions).

// In dev, go through the Vite proxy (/api) to dodge the proxy's CORS allowlist;
// in production, call the deployed proxy directly. See vite.config.js.
const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
// Dev fallback only — used when no member GUID is in session (e.g. localhost,
// where the Caspio ?guid= handoff hasn't run). Real members come from auth.
export const DEV_MEMBER = '758645A00B0847708AA9313E75C80398';

const numOrNull = (v) => (v === '' || v == null || isNaN(parseFloat(v))) ? null : parseFloat(v);

export function thresholdsFromRow(r) {
  return {
    lower_optimal: numOrNull(r.lower_optimal),
    upper_optimal: numOrNull(r.upper_optimal),
    lower_drift:   numOrNull(r.lower_drift),
    upper_drift:   numOrNull(r.upper_drift),
    concern_direction: (r.Concern_direction || r.concern_direction || '').trim(),
    concern_threshold: numOrNull(r.concern_threshold),
    display_min: numOrNull(r.display_min),
    display_max: numOrNull(r.display_max),
  };
}

// Zone resolution — identical rules to PlotlyChart.zoneFor and V1.
export function zoneFor(v, t) {
  if (v == null || isNaN(v) || !t) return 'nodata';
  const { lower_optimal, upper_optimal, lower_drift, upper_drift, concern_direction, concern_threshold } = t;
  if (concern_direction === '>') {
    if (concern_threshold != null && v >= concern_threshold) return 'concern';
    if (upper_drift != null && v > upper_drift) return 'driftPlus';
    if (upper_optimal != null && v > upper_optimal) return 'drift';
    if (lower_optimal != null && v < lower_optimal) return 'belowOptimal';
    return 'optimal';
  } else {
    if (concern_threshold != null && v <= concern_threshold) return 'concern';
    if (lower_drift != null && v < lower_drift) return 'driftPlus';
    if (lower_optimal != null && v < lower_optimal) return 'drift';
    if (upper_optimal != null && v > upper_optimal) return 'belowOptimal';
    return 'optimal';
  }
}

// V1's zone vocabulary — keep verbatim.
export const ZONE_LABEL = { optimal: 'Optimal', drift: 'Drift Zone', driftPlus: 'Drift Zone+', concern: 'Concern Zone', belowOptimal: 'Below Optimal', nodata: 'No data' };

export function markerZone(latest, thresholds, history) {
  const v = latest != null ? parseFloat(latest)
          : (history && history.length ? parseFloat(history[history.length - 1].value) : NaN);
  return zoneFor(v, thresholds);
}

function fmtVal(v) {
  if (v == null || v === '' || isNaN(parseFloat(v))) return null;
  const n = parseFloat(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
export function optimalText(t) {
  const d = t.concern_direction;
  if (d === '>' && t.upper_optimal != null) return '< ' + t.upper_optimal;
  if (d === '<' && t.lower_optimal != null) return '> ' + t.lower_optimal;
  if (t.lower_optimal != null && t.upper_optimal != null) return t.lower_optimal + '–' + t.upper_optimal;
  if (t.upper_optimal != null) return '< ' + t.upper_optimal;
  return '—';
}
function trendOf(grp) {
  if (!grp || grp.length < 2) return 'none';
  const a = parseFloat(grp[grp.length - 2].marker_value);
  const b = parseFloat(grp[grp.length - 1].marker_value);
  if (isNaN(a) || isNaN(b)) return 'none';
  return b > a ? 'up' : b < a ? 'down' : 'flat';
}
function groupRows(rows) {
  const g = {};
  for (const x of rows) (g[x.marker_code] = g[x.marker_code] || []).push(x);
  for (const k in g) g[k].sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
  return g;
}
function historyOf(grp) {
  return grp.map((r) => ({ date: (r.report_date || '').slice(0, 10), value: parseFloat(r.marker_value) }))
            .filter((h) => h.date && !isNaN(h.value));
}
const nameOf = (code, names) => (names[code] && names[code].display_name) || code;

function buildRelatedFor(code, g, relMap, names, refs) {
  return (relMap[code] || []).map((rc) => {
    const ref = refs[(rc.code || '').toUpperCase()] || null;
    const sg = g[rc.code];
    if (!sg || !sg.length) {
      return { code: rc.code, name: nameOf(rc.code, names), unit: '', latest: null, optimal: '—', trendDir: 'none', thresholds: null, history: [], reference: ref };
    }
    const last = sg[sg.length - 1];
    const t = thresholdsFromRow(last);
    return {
      code: rc.code,
      name: nameOf(rc.code, names),
      unit: last.measurement || '',
      latest: fmtVal(last.marker_value),
      optimal: optimalText(t),
      trendDir: trendOf(sg),
      thresholds: t,
      history: historyOf(sg),
      reference: ref,
    };
  });
}

export function buildMarkers(rows, relMap, names, refs = {}) {
  const g = groupRows(rows);
  const mains = Object.values(g)
    .filter((grp) => grp[0].display_order != null)
    .sort((a, b) => a[0].display_order - b[0].display_order);
  return mains.map((grp) => {
    const last = grp[grp.length - 1];
    const code = last.marker_code;
    const t = thresholdsFromRow(last);
    const meta = names[code] || {};
    return {
      code,
      name: meta.display_name || code,
      header: last.display_header || '',
      unit: last.measurement || '',
      latest: fmtVal(last.marker_value),
      optimal: optimalText(t),
      trendDir: trendOf(grp),
      thresholds: t,
      history: historyOf(grp),
      description: (meta.display_text || '').split(/\r?\n/)[0],
      reference: refs[(code || '').toUpperCase()] || null,
      related: buildRelatedFor(code, g, relMap, names, refs),
    };
  });
}

async function apiGet(table, where, limit) {
  const q = [];
  if (where) q.push('q.where=' + encodeURIComponent(where));
  if (limit) q.push('q.limit=' + limit);
  const r = await fetch(`${API_BASE}/rest/v2/tables/${table}/records${q.length ? '?' + q.join('&') : ''}`);
  if (!r.ok) throw new Error(`${table} ${r.status}`);
  return (await r.json()).Result || [];
}
function relMapFrom(rows) {
  const m = {};
  rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  for (const r of rows) {
    const a = (r.marker_a || '').trim().toUpperCase(), b = (r.marker_b || '').trim().toUpperCase();
    if (!a || !b) continue;
    (m[a] = m[a] || []).push({ code: b, color: (r.color || '').trim() });
  }
  return m;
}
function namesFrom(rows) {
  const m = {};
  for (const n of rows) {
    const c = (n.code || '').trim().toUpperCase();
    if (!c) continue;
    m[c] = { display_name: n.display_name || c, description: n.description || '', display_text: n.display_text || '' };
  }
  return m;
}
// Reference/target points keyed by marker code, from member_info rows whose
// feature is '<MARKER>-reference' (number_1=value, date_1=date, text_box_1=direction).
// Same source MyStrategy uses, so both pages render the reference identically.
function refsMapFrom(rows) {
  const m = {};
  for (const r of rows) {
    const code = (r.feature || '').replace(/-reference$/i, '').trim().toUpperCase();
    if (!code) continue;
    m[code] = { value: r.number_1, date: r.date_1, direction: (r.text_box_1 || '').trim() };
  }
  return m;
}

// Fetch + build the member's markers. Throws on network/CORS failure.
export async function loadBiomarkers(member) {
  const [rows, rel, names, refRows] = await Promise.all([
    apiGet('report_ready_result', `member_id='${member}'`, 1000),
    apiGet('marker_x_marker', "relationship_type='related'", 500),
    apiGet('reference_code_desc', "domain='MARKERS'", 500),
    // reference targets — non-fatal (charts still render if this fails)
    apiGet('member_info', `member_id='${member}' AND feature LIKE '%-reference'`, 100).catch(() => []),
  ]);
  return buildMarkers(rows, relMapFrom(rel), namesFrom(names), refsMapFrom(refRows));
}
