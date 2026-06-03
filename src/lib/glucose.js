// Glucose Summary data layer — live CGM cycles from the proxy, mirroring the V1
// glucose_summary page: cycles from member_info (CGM_CYCLE), per-cycle metrics
// and 4-zone time-in-range from report_ready_result, clinician note (CGM_NOTE).
// Four zones (same as V1): Baseline <6.3, Normal 6.3–7.8, Spike 7.8–10,
// Strong Spike >10.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';

const num = (v) => (v === '' || v == null || isNaN(parseFloat(v))) ? null : parseFloat(v);
const dateKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

async function apiGet(table, where, limit) {
  const q = [];
  if (where) q.push(`q.where=${encodeURIComponent(where)}`);
  if (limit) q.push(`q.limit=${limit}`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/${table}/records${q.length ? '?' + q.join('&') : ''}`);
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

// ── Side panels (ported from V1 glucose_summary): Related Markers + MicroHabits.
// Related markers come from system_parm (glucose_summary/related_markers), a
// comma list with pipe fallbacks (e.g. HOMAIR|TGHDL = use whichever the member
// has data for). MicroHabits = the member's active assignments that are linked
// to any of those markers via marker_x_microhabit.
const norm = (c) => (c || '').toUpperCase().replace(/[\s\-/]/g, '');

export async function loadGlucoseExtras(member) {
  const cfg = await apiGet('system_parm', "parm_group='glucose_summary' AND parm_name='related_markers'", 5);
  const raw = (cfg[0] && cfg[0].value_two) || '';
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean); // ["HOMAIR|TGHDL","GGT",...]
  if (!entries.length) return { relatedMarkers: [], microHabits: [] };

  const allCodes = entries.flatMap((e) => e.split('|').map((s) => s.trim()));
  const inList = allCodes.map((c) => `'${c}'`).join(',');
  const [markerRows, nameRows, links, assignments] = await Promise.all([
    apiGet('report_ready_result', `member_id='${member}' AND marker_code IN (${inList})`, 1000),
    apiGet('reference_code_desc', `domain='MARKERS' AND code IN (${inList})`, 200),
    apiGet('marker_x_microhabit', null, 1000),
    apiGet('microhabit_x_member', `member_id='${member}'`, 500),
  ]);

  const hasData = (code) => markerRows.some((r) => norm(r.marker_code) === norm(code));
  const resolved = [];
  for (const e of entries) {
    if (e.includes('|')) {
      const found = e.split('|').map((s) => s.trim()).find(hasData);
      if (found) resolved.push(found);
    } else resolved.push(e);
  }

  const names = {};
  nameRows.forEach((n) => { names[norm(n.code)] = n.display_name || n.code; });

  const relatedMarkers = resolved.map((code) => {
    const rows = markerRows.filter((r) => norm(r.marker_code) === norm(code))
      .sort((a, b) => new Date(b.report_date) - new Date(a.report_date));
    const latest = rows[0], prev = rows[1];
    const unit = latest ? (latest.measurement || '') : '';
    let reference = '—';
    if (latest && latest.lower_optimal != null && latest.lower_optimal !== '' && latest.upper_optimal != null && latest.upper_optimal !== '') {
      reference = `${latest.lower_optimal}–${latest.upper_optimal}`;
    } else if (latest && latest.upper_optimal != null && latest.upper_optimal !== '') {
      reference = String(latest.upper_optimal);
    }
    return {
      code,
      name: names[norm(code)] || code,
      latest: latest ? latest.marker_value : null,
      previous: prev ? prev.marker_value : null,
      reference, unit,
    };
  });

  // MicroHabits: active assignments linked to any resolved related marker.
  const resolvedNorm = new Set(resolved.map(norm));
  const linkedIds = new Set(links.filter((l) => resolvedNorm.has(norm(l.marker_code))).map((l) => String(l.microhabit_id)));
  const active = assignments.filter((a) => a.start_dt && !a.end_dt);
  const wantedIds = [...new Set(active.map((a) => String(a.microhabit_id)).filter((id) => linkedIds.has(id)))];

  let microHabits = [];
  if (wantedIds.length) {
    const mh = await apiGet('microhabit', `microhabit_id IN (${wantedIds.join(',')})`, 200);
    microHabits = mh.map((m) => {
      const asg = active.find((a) => String(a.microhabit_id) === String(m.microhabit_id));
      return { name: m.microhabit_name, category: m.microhabit_category || '', frequency: (asg && asg.frequency) || m.default_frequency || '' };
    });
  }

  return { relatedMarkers, microHabits };
}
