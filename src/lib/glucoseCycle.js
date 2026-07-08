// Glucose Cycle data layer — one JSON blob per 14-day CGM cycle, stored in the
// cgm_cycle Caspio table and fetched through the proxy by member GUID. The
// pipeline uploads raw 15-minute readings + watched events + notes; every
// derived figure (percentile bands, per-day medians, time-above, weekday/
// weekend splits) is computed HERE, client-side, so Caspio stores data, not
// math. Payload contract + connection checklist: pipeline/CASPIO_CGM_API.md.
//
// The page currently runs on bundled MOCK DATA (glucoseSample.js) because the
// cgm_cycle table doesn't exist yet. No code change is needed to go live:
// every request below is already wired — grep "API-CONNECT" for the exact
// touchpoints — and the sample retires automatically once the member's first
// real row comes back from Caspio.
//
// Voices (Member / MBH / Clinician free text per cycle) live in member_info
// rows: feature = CGM_VOICE_* keyed by date_2 = cycle end date.

import { SAMPLE_META, SAMPLE_PAYLOAD } from './glucoseSample.js';

// API-CONNECT(proxy): every call goes through the Caspio REST proxy — the same
// one auth.js and the other data layers use. Dev traffic rides the Vite /api
// proxy (vite.config.js) to dodge the CORS allowlist; production calls it
// directly. The session JWT is attached globally by auth.js's fetch patch.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
  ? '/api' : 'https://kenises-api-proxy.netlify.app';

export const STEP = 15;          // minutes per slice
export const SAMPLES = 96;       // slices per day
export const TH_HI = 7.8;        // "time above" threshold (mmol/L)

// Reference band defaults (member→unit→phenotype→literature resolution happens
// upstream; a payload may override via its optional `band` object).
export const DEFAULT_BAND = { src: 'MBH phenotype', on: [4.5, 5.5], day: [4.8, 6.0], floor: 3.9 };

async function apiGet(table, where, limit) {
  const q = [];
  if (where) q.push(`q.where=${encodeURIComponent(where)}`);
  if (limit) q.push(`q.limit=${limit}`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/${table}/records${q.length ? '?' + q.join('&') : ''}`);
  if (!r.ok) throw new Error(`${table} ${r.status}`);
  return (await r.json()).Result || [];
}

// ── Math (matches the design's semantics exactly) ──────────────────────────
const q2 = (x) => Math.round(x * 100) / 100;

// Linear-interpolation quantile (numpy default), rounded to 2 dp.
function quantile(sorted, q) {
  const n = sorted.length;
  if (!n) return null;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return q2(sorted[lo]);
  return q2(sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]));
}

export function median(values) {
  const a = values.filter((v) => v != null && !isNaN(v)).slice().sort((x, y) => x - y);
  return a.length ? quantile(a, 0.5) : null;
}

// ── Payload normalisation ───────────────────────────────────────────────────
// Series points arrive either as [t, g] pairs (the documented compact form)
// or {t, g} objects. Normalise to sorted {t, g}.
function normSeries(list) {
  const pts = [];
  for (const p of list || []) {
    const t = Array.isArray(p) ? p[0] : p.t;
    const g = Array.isArray(p) ? p[1] : p.g;
    if (typeof t === 'number' && typeof g === 'number' && t >= 0 && t < 1440) pts.push({ t, g });
  }
  return pts.sort((a, b) => a.t - b.t);
}

function normEvent(e) {
  const burst = [];
  for (const p of e.burst || []) {
    const t = Array.isArray(p) ? p[0] : p.t;
    const g = Array.isArray(p) ? p[1] : p.g;
    if (typeof t === 'number' && typeof g === 'number') burst.push({ t, g });
  }
  return { ...e, burst: burst.sort((a, b) => a.t - b.t) };
}

// ── Dates ───────────────────────────────────────────────────────────────────
const parseLocal = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};

function buildDates(startISO, nDays) {
  const s = parseLocal(startISO);
  return Array.from({ length: nDays }, (_, i) => {
    if (!s) return { wd: '', d: `Day ${i + 1}`, wknd: false };
    const dt = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
    return {
      wd: dt.toLocaleDateString('en-US', { weekday: 'short' }),
      d: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      wknd: dt.getDay() === 0 || dt.getDay() === 6,
    };
  });
}

function defaultLabel(startISO, endISO) {
  const s = parseLocal(startISO), e = parseLocal(endISO);
  if (!s || !e) return '';
  const f = (d, y) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}) });
  return `${f(s)} – ${f(e, true)}`;
}

// ── Per-day + per-slice statistics ──────────────────────────────────────────
// Overnight = 22:00–06:00; daytime = 06:00–22:00; tar = minutes at/above 7.8.
function dayStats(day) {
  const on = [], dt = [];
  let above = 0;
  for (const p of day) {
    (p.t < 360 || p.t >= 1320 ? on : dt).push(p.g);
    if (p.g >= TH_HI) above++;
  }
  return { overnight: median(on), daytime: median(dt), median: median(day.map((p) => p.g)), tar: above * STEP };
}

// Band = per-15-min-slice p25/p50/p75 across the selected days.
function buildBand(maps, idxs) {
  const out = [];
  for (let s = 0; s < SAMPLES; s++) {
    const t = s * STEP;
    const vals = [];
    for (const i of idxs) {
      const g = maps[i].get(t);
      if (g != null) vals.push(g);
    }
    vals.sort((a, b) => a - b);
    out.push(vals.length
      ? { t, p25: quantile(vals, 0.25), p50: quantile(vals, 0.5), p75: quantile(vals, 0.75) }
      : { t, p25: null, p50: null, p75: null });
  }
  return out;
}

// ── Cycle builder — payload + row meta → everything the page renders ────────
export function buildCycle({ number, start, end, label, payload, sample }) {
  const days = (payload.days || []).map(normSeries);
  const nDays = days.length;
  const dates = (payload.dates && payload.dates.length === nDays) ? payload.dates : buildDates(start, nDays);
  const maps = days.map((d) => { const m = new Map(); for (const p of d) m.set(p.t, p.g); return m; });

  const all = days.map((_, i) => i);
  const wkI = all.filter((i) => !dates[i].wknd);
  const weI = all.filter((i) => dates[i].wknd);

  const m = days.map(dayStats);
  const medOf = (idxs, key) => median(idxs.map((i) => m[i][key]));
  const tarOf = (idxs) => { const v = median(idxs.map((i) => m[i].tar)); return v == null ? null : q2(v / 60); };

  const readings = days.reduce((s, d) => s + d.length, 0);

  return {
    number: number ?? null,
    start, end,
    endKey: String(end || '').slice(0, 10),
    cycleLabel: label || defaultLabel(start, end),
    dates, days, m,
    band: buildBand(maps, all),
    bandWk: buildBand(maps, wkI),
    bandWe: buildBand(maps, weI),
    events: (payload.events || []).map(normEvent),
    notes: payload.notes || {},
    bandParams: { ...DEFAULT_BAND, ...(payload.band || {}) },
    overnight: medOf(all, 'overnight'), daytime: medOf(all, 'daytime'), median24: medOf(all, 'median'),
    tarHrs: tarOf(all), wkTar: tarOf(wkI), weTar: tarOf(weI),
    wkOn: medOf(wkI, 'overnight'), weOn: medOf(weI, 'overnight'),
    wkDt: medOf(wkI, 'daytime'), weDt: medOf(weI, 'daytime'),
    sensor: payload.sensor != null ? payload.sensor : (nDays ? Math.round((100 * readings) / (nDays * SAMPLES)) : 0),
    sample: !!sample,
  };
}

function rowToCycle(r) {
  let payload;
  try { payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload; }
  catch (e) { console.warn('cgm_cycle: bad payload JSON, skipping row', e); return null; }
  if (!payload || !Array.isArray(payload.days)) return null;
  return buildCycle({
    number: r.cycle_number ?? null,
    start: r.start_date ? String(r.start_date).slice(0, 10) : null,
    end: r.end_date ? String(r.end_date).slice(0, 10) : null,
    label: r.label || '',
    payload,
  });
}

export function sampleCycle() {
  return buildCycle({ ...SAMPLE_META, payload: SAMPLE_PAYLOAD, sample: true });
}

// API-CONNECT(cycles): the page's main data source.
//
//   GET {proxy}/rest/v2/tables/cgm_cycle/records
//       ?q.where=member_id='<UserGUID>'&q.limit=100
//
// Expects Caspio's usual envelope { Result: [row, …] } where each row has
// member_id, cycle_number, start_date, end_date, label, payload (JSON string —
// see pipeline/CASPIO_CGM_API.md §2). To connect: create the cgm_cycle table,
// allow GET for it in the proxy, and upload rows built by
// pipeline/build_payload.py. Nothing here changes when that happens — the
// mock below is only reached while the request errors (table missing) or
// returns no rows for this member.
export async function loadGlucoseCycles(member) {
  let rows = [];
  try {
    rows = await apiGet('cgm_cycle', `member_id='${member}'`, 100);
  } catch (e) {
    console.warn('cgm_cycle fetch failed — showing sample cycle:', e.message);
  }
  const cycles = rows.map(rowToCycle).filter(Boolean)
    .sort((a, b) => (b.number || 0) - (a.number || 0) || new Date(b.end) - new Date(a.end));
  // MOCK DATA fallback — the bundled M4 sample (flagged sample:true, shown with
  // an amber banner). Delete nothing to go live; real rows above win.
  return cycles.length ? cycles : [sampleCycle()];
}

// ── Voices — Member / MBH / Clinician, one member_info row per cycle ────────
export const VOICES = [
  { key: 'member',    feature: 'CGM_VOICE_MEMBER',    label: 'Member' },
  { key: 'mbh',       feature: 'CGM_VOICE_MBH',       label: 'MBH' },
  { key: 'clinician', feature: 'CGM_VOICE_CLINICIAN', label: 'Clinician' },
];

const dateKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// API-CONNECT(voices-read): loads the three boxes for one cycle.
//
//   GET {proxy}/rest/v2/tables/member_info/records
//       ?q.where=member_id='<UserGUID>' AND feature IN ('CGM_VOICE_MEMBER',
//                'CGM_VOICE_MBH','CGM_VOICE_CLINICIAN')
//
// member_info already exists and is GET-readable through the proxy today —
// rows just need to be written (by saveVoice below, or by MBH/clinician
// tooling). Matched to the cycle client-side on date_2 = cycle end date.
export async function loadVoices(member, endKey) {
  const out = {};
  for (const v of VOICES) out[v.key] = { text: '', exists: false };
  try {
    const feats = VOICES.map((v) => `'${v.feature}'`).join(',');
    const rows = await apiGet('member_info', `member_id='${member}' AND feature IN (${feats})`, 500);
    for (const r of rows) {
      if (dateKey(r.date_2) !== endKey) continue;
      const v = VOICES.find((x) => x.feature === r.feature);
      if (v) out[v.key] = { text: r.text_box_1 || '', exists: true };
    }
  } catch (e) { console.warn('voices load failed:', e.message); }
  return out;
}

// API-CONNECT(voices-write): autosave for the three boxes (update-then-insert).
//
//   PUT  {proxy}/rest/v2/tables/member_info/records?q.where=member_id='…'
//        AND feature='CGM_VOICE_*' AND date_2='YYYY-MM-DD'   body {text_box_1}
//   POST {proxy}/rest/v2/tables/member_info/records          (row didn't exist)
//
// To connect: confirm the proxy passes PUT through for member_info (POST is
// already used elsewhere, e.g. activity_log). date_2 must be stored date-only
// or the PUT's where-clause never matches — see CASPIO_CGM_API.md §3. Note
// saves are skipped entirely while the mock sample cycle is showing (the page
// marks them "sample — not saved").
export async function saveVoice(member, endKey, voiceKey, text, exists) {
  const v = VOICES.find((x) => x.key === voiceKey);
  if (!v) throw new Error(`unknown voice '${voiceKey}'`);
  if (exists) {
    const where = `member_id='${member}' AND feature='${v.feature}' AND date_2='${endKey}'`;
    const r = await fetch(`${API_BASE}/rest/v2/tables/member_info/records?q.where=${encodeURIComponent(where)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_box_1: text }),
    });
    if (!r.ok) throw new Error(`save ${r.status}`);
    const d = await r.json().catch(() => ({}));
    if ((d.RecordsAffected ?? 1) > 0) return;
  }
  const r2 = await fetch(`${API_BASE}/rest/v2/tables/member_info/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: member, feature: v.feature, date_2: endKey, text_box_1: text }),
  });
  if (!r2.ok) throw new Error(`save ${r2.status}`);
}
