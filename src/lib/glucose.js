// Glucose Summary data layer — live CGM cycles from the proxy, mirroring the V1
// glucose_summary page: cycles from member_info (CGM_CYCLE), per-cycle metrics
// and 4-zone time-in-range from report_ready_result, clinician note (CGM_NOTE).
// Four zones (same as V1): Baseline <6.3, Normal 6.3–7.8, Spike 7.8–10,
// Strong Spike >10.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';

const num = (v) => (v === '' || v == null || isNaN(parseFloat(v))) ? null : parseFloat(v);
const dateKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

async function apiGet(table, where, limit) {
  const q = [`q.where=${encodeURIComponent(where)}`];
  if (limit) q.push(`q.limit=${limit}`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/${table}/records?${q.join('&')}`);
  if (!r.ok) throw new Error(`${table} ${r.status}`);
  return (await r.json()).Result || [];
}

const ZONE_DEFS = [
  { key: 'baseline', label: 'Baseline',     range: '< 6.3',   code: 'TIR_LT63' },
  { key: 'normal',   label: 'Normal',       range: '6.3–7.8', code: 'TIR_63_75' },
  { key: 'spike',    label: 'Spike',        range: '7.8–10',  code: 'TIR_75_10' },
  { key: 'strong',   label: 'Strong Spike', range: '> 10',    code: 'TIR_GT10' },
];

export async function loadGlucose(member) {
  const [infoRows, cgmRows] = await Promise.all([
    apiGet('member_info', `member_id='${member}' AND feature IN ('CGM_CYCLE','CGM_NOTE')`, 200),
    apiGet('report_ready_result', `member_id='${member}' AND marker_code IN ('CGM_CV','CGM_AVG','CGM_DAY','CGM_NIGHT','TIR_LT63','TIR_63_75','TIR_75_10','TIR_GT10')`, 1000),
  ]);

  // dataMap[cycleEndKey][marker_code] = value (last non-null wins, matching V1)
  const dataMap = {};
  for (const r of cgmRows) {
    const k = dateKey(r.report_date);
    if (!dataMap[k]) dataMap[k] = {};
    const v = num(r.marker_value);
    if (v != null || !(r.marker_code in dataMap[k])) dataMap[k][r.marker_code] = v;
  }

  const noteMap = {};
  infoRows.filter((c) => c.feature === 'CGM_NOTE').forEach((n) => { noteMap[dateKey(n.date_2)] = n.text_box_1 || ''; });

  const cycles = infoRows.filter((c) => c.feature === 'CGM_CYCLE')
    .sort((a, b) => (b.number_1 || 0) - (a.number_1 || 0) || new Date(b.date_2) - new Date(a.date_2));

  return cycles.map((c) => {
    const endKey = dateKey(c.date_2);
    const v = dataMap[endKey] || {};
    const zones = ZONE_DEFS.map((z) => {
      const pct = num(v[z.code]);
      return { ...z, pct, hours: pct != null ? Math.round((pct / 100) * 24 * 10) / 10 : null };
    });
    const tar = Math.round(((zones[2].hours || 0) + (zones[3].hours || 0)) * 10) / 10;
    const exposure = tar <= 1 ? 'Low' : tar <= 2 ? 'Moderate' : 'High';
    return {
      label: c.text_box_1 || 'Cycle',
      number: c.number_1,
      startDate: c.date_1,
      endDate: c.date_2,
      endKey,
      metrics: { cv: num(v.CGM_CV), avg: num(v.CGM_AVG), day: num(v.CGM_DAY), night: num(v.CGM_NIGHT) },
      zones,
      tarHours: tar,
      exposure,
      note: noteMap[endKey] || '',
    };
  });
}
