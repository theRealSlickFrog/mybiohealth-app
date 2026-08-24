// Priority/Strategy Builder — the "hub" that lets an admin (or the member on a
// call) assemble a MyStrategy live instead of editing the table by hand.
//
// Model (per the Aug 19 stand-up): build a WORKING DRAFT that is not a real
// strategy until "Promote". The draft lives in the browser (localStorage) so no
// intermediate edit ever touches mystrategy_report_ready or its change log.
// Promote then closes the current active row and inserts a new versioned row.
//
// The table is 114 flat columns but the human only fills a handful; everything
// else is copied from priority_library on pick, pulled from report_ready_result,
// or set by Promote. See flattenDraft() for the exact column mapping the front
// end (MyStrategyPage.unflattenRow) reads back.

// Dev routes /api/* through Vite (the proxy's CORS excludes localhost); prod
// calls the proxy directly. Mirrors auth.js.
const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const TABLE = 'mystrategy_report_ready';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Draft shape ────────────────────────────────────────────────────────────
// A plain, editable object. Slots are fixed-length arrays so the UI can render
// empty rows; empty slots are dropped on flatten.

export function emptyPriority() {
  return {
    priority_code: '', name: '', kind: 'chart', primary_marker: '',
    target_text: '', latest_value: '', unit: '', latest_date: '',
    next_text: '', rx_text: '', why_text: '', other_markers: '',
    donut_hr78: '', donut_hr10: '', donut_target_hr: '',
  };
}

export function emptyMhx() {
  return {
    name: '', frequency: '', end_game_kind: 'steady', end_game_signal: '',
    end_game_start: '', end_game_goal: '', renew_text: '', why_text: '',
    linked_priorities: [],   // e.g. [1,3]
  };
}

export function emptyDraft() {
  return {
    tagline: '',
    priorities: [emptyPriority(), emptyPriority(), emptyPriority()],
    mhx: [emptyMhx(), emptyMhx(), emptyMhx()],
    routines: { sleep: '', strength: '', cardio: '' },
    elements: {
      sx_label: 'Medically Directed Supplements', sx_items: '',
      lx_label: 'Medically Directed Lifestyle Advice', lx_items: '',
      sm_label: 'Member Elected Supplements', sm_items: '',
      rx_label: 'Prescriptions', rx_items: '',
    },
  };
}

// Convert a raw mystrategy_report_ready row into an editable draft (for "new
// version from the current strategy"). Unknown/blank columns become empty.
export function draftFromRow(row) {
  if (!row) return emptyDraft();
  const d = emptyDraft();
  d.tagline = row.tagline || '';
  for (let n = 1; n <= 3; n++) {
    const p = d.priorities[n - 1];
    p.name = row[`p${n}_name`] || '';
    p.kind = row[`p${n}_kind`] || 'chart';
    p.primary_marker = row[`p${n}_primary_marker`] || '';
    p.target_text = row[`p${n}_target_text`] || '';
    p.latest_value = row[`p${n}_latest_value`] || '';
    p.unit = row[`p${n}_unit`] || '';
    p.latest_date = row[`p${n}_latest_date`] || '';
    p.next_text = row[`p${n}_next_text`] || '';
    p.rx_text = row[`p${n}_rx_text`] || '';
    p.why_text = row[`p${n}_why_text`] || '';
    p.other_markers = row[`p${n}_other_markers`] || '';
    p.donut_hr78 = row[`p${n}_donut_hr78`] ?? '';
    p.donut_hr10 = row[`p${n}_donut_hr10`] ?? '';
    p.donut_target_hr = row[`p${n}_donut_target_hr`] ?? '';
  }
  for (let n = 1; n <= 3; n++) {
    const m = d.mhx[n - 1];
    m.name = row[`mhx${n}_name`] || '';
    m.frequency = row[`mhx${n}_frequency`] || '';
    m.end_game_kind = row[`mhx${n}_end_game_kind`] || 'steady';
    m.end_game_signal = row[`mhx${n}_end_game_signal`] || '';
    m.end_game_start = row[`mhx${n}_end_game_start`] || '';
    m.end_game_goal = row[`mhx${n}_end_game_goal`] || '';
    m.renew_text = row[`mhx${n}_renew_text`] || '';
    m.why_text = row[`mhx${n}_why_text`] || '';
    m.linked_priorities = (row[`mhx${n}_linked_priorities`] || '')
      .split(',').map((s) => parseInt(s.trim(), 10)).filter((x) => x >= 1 && x <= 3);
  }
  d.routines = {
    sleep: row.routine_sleep || '', strength: row.routine_strength || '', cardio: row.routine_cardio || '',
  };
  d.elements = {
    sx_label: row.sx_label || d.elements.sx_label, sx_items: row.sx_items || '',
    lx_label: row.lx_label || d.elements.lx_label, lx_items: row.lx_items || '',
    sm_label: row.sm_label || d.elements.sm_label, sm_items: row.sm_items || '',
    rx_label: row.rx_label || d.elements.rx_label, rx_items: row.rx_items || '',
  };
  return d;
}

// ── Priority catalog (the picker source) ────────────────────────────────────
// The LIVE catalog is the `priority` table (populated June 2026), NOT the
// never-imported priority_library seed. Normalize its columns to the shape the
// builder + applyLibraryPick expect: { priority_code, name, primary_marker_code,
// render_kind, default_anchor_text, category }.
export async function fetchPriorityCatalog() {
  try {
    const r = await fetch(`${API_BASE}/rest/v2/tables/priority/records?q.orderBy=priority_number&q.limit=500`);
    if (!r.ok) return [];
    const rows = (await r.json()).Result || [];
    return rows.map((p) => ({
      priority_code: p.priority_code || '',
      name: p.Priority || p.priority || p.name || '',            // "Lower Apo B"
      primary_marker_code: p.primary_marker_code || '',
      render_kind: (p.render_kind || 'chart').trim() || 'chart',
      // domain/anchor line used to seed the target (e.g. "Cardiovascular Health")
      default_anchor_text: [p.default_anchor_text, p.anchor_text_extra]
        .map((x) => (x || '').trim()).filter(Boolean).join(' · '),
      category: p.Category || p.category || 'Other',
      priority_number: p.priority_number,
    })).filter((p) => p.name);
  } catch (e) { return []; }
}

// Does a saved draft hold real content? Used so a stale, autosaved EMPTY draft
// doesn't shadow the prefill when opening "Create New Version" from a strategy.
export function draftHasContent(d) {
  if (!d) return false;
  return !!(d.tagline || (d.priorities || []).some((p) => p && p.name) || (d.mhx || []).some((m) => m && m.name));
}

// The microhabit catalog (the "acceptable habits" list Ken maintains) — the
// dropdown source for each habit slot. Active habits only, sorted by name.
export async function fetchMicrohabits() {
  try {
    const r = await fetch(`${API_BASE}/rest/v2/tables/microhabit/records?q.limit=500`);
    if (!r.ok) return [];
    const rows = (await r.json()).Result || [];
    const isActive = (v) => !(v === false || v === 0 || v === '0' || v === 'false' || v === 'No');
    return rows.filter((m) => isActive(m.is_active))
      .sort((a, b) => (a.microhabit_name || '').localeCompare(b.microhabit_name || ''));
  } catch (e) { return []; }
}

// Apply a picked priority_library row onto a priority slot: copies name / kind /
// marker and seeds the target text from default_anchor_text (all editable after).
export function applyLibraryPick(priority, lib) {
  return {
    ...priority,
    priority_code: lib.priority_code || '',
    name: lib.name || '',
    kind: lib.render_kind || 'chart',
    primary_marker: lib.primary_marker_code || '',
    target_text: priority.target_text || lib.default_anchor_text || '',
  };
}

// ── Auto-pull latest reading from report_ready_result (already loaded by the
// page as labRows) — returns { value, unit, date } for a marker code. ─────────
export function latestReadingFor(labRows, markerCode) {
  if (!markerCode) return null;
  const rows = (labRows || [])
    .filter((r) => r.marker_code === markerCode)
    .sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));
  if (!rows.length) return null;
  const r = rows[0];
  return {
    value: r.marker_value != null ? String(r.marker_value) : '',
    unit: r.measurement || '',
    date: fmtMonthYear(r.report_date),
  };
}

function fmtMonthYear(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m] = s.split('-').map(Number);
  if (!y || !m) return s;
  return `${MONTHS[m - 1]} ${y}`;
}

// ── localStorage draft persistence (per member) ────────────────────────────
const draftKey = (member) => `mbh_strategy_draft_${member}`;

export function loadDraft(member) {
  try {
    const raw = localStorage.getItem(draftKey(member));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function saveDraft(member, draft) {
  try { localStorage.setItem(draftKey(member), JSON.stringify(draft)); return true; }
  catch (e) { return false; }
}
export function clearDraft(member) {
  try { localStorage.removeItem(draftKey(member)); } catch (e) { /* ignore */ }
}

// ── Version label — date-based, matching the existing convention (YY.MM.DD.a) ─
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function nextVersionLabel() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  return `${yy}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.a`;
}

// ── Flatten a draft into the 114-column row. Only non-empty scalars are
// included so Caspio Number/Date columns aren't sent empty strings. ──────────
export function flattenDraft(draft, { member_id, version, effective_from }) {
  const row = { member_id, version, minor_version: 'a', effective_from };
  put(row, 'tagline', draft.tagline);

  draft.priorities.forEach((p, i) => {
    if (!p.name) return;               // empty slot → skip entirely
    const n = i + 1;
    put(row, `p${n}_name`, p.name);
    put(row, `p${n}_kind`, p.kind);
    put(row, `p${n}_primary_marker`, p.primary_marker);
    put(row, `p${n}_target_text`, p.target_text);
    put(row, `p${n}_latest_value`, p.latest_value);
    put(row, `p${n}_unit`, p.unit);
    put(row, `p${n}_latest_date`, p.latest_date);
    put(row, `p${n}_next_text`, p.next_text);
    put(row, `p${n}_rx_text`, p.rx_text);
    put(row, `p${n}_why_text`, p.why_text);
    put(row, `p${n}_other_markers`, p.other_markers);
    putNum(row, `p${n}_donut_hr78`, p.donut_hr78);
    putNum(row, `p${n}_donut_hr10`, p.donut_hr10);
    putNum(row, `p${n}_donut_target_hr`, p.donut_target_hr);
  });

  draft.mhx.forEach((m, i) => {
    if (!m.name) return;
    const n = i + 1;
    put(row, `mhx${n}_name`, m.name);
    put(row, `mhx${n}_frequency`, m.frequency);
    put(row, `mhx${n}_end_game_kind`, m.end_game_kind);
    put(row, `mhx${n}_end_game_signal`, m.end_game_signal);
    put(row, `mhx${n}_end_game_start`, m.end_game_start);
    put(row, `mhx${n}_end_game_goal`, m.end_game_goal);
    put(row, `mhx${n}_renew_text`, m.renew_text);
    put(row, `mhx${n}_why_text`, m.why_text);
    put(row, `mhx${n}_linked_priorities`, (m.linked_priorities || []).join(','));
  });

  put(row, 'routine_sleep', draft.routines.sleep);
  put(row, 'routine_strength', draft.routines.strength);
  put(row, 'routine_cardio', draft.routines.cardio);

  const e = draft.elements;
  if (e.sx_items) { put(row, 'sx_label', e.sx_label); put(row, 'sx_items', e.sx_items); }
  if (e.lx_items) { put(row, 'lx_label', e.lx_label); put(row, 'lx_items', e.lx_items); }
  if (e.sm_items) { put(row, 'sm_label', e.sm_label); put(row, 'sm_items', e.sm_items); }
  if (e.rx_items) { put(row, 'rx_label', e.rx_label); put(row, 'rx_items', e.rx_items); }

  return row;
}

function put(row, key, val) {
  const v = (val == null ? '' : String(val)).trim();
  if (v !== '') row[key] = v;
}
function putNum(row, key, val) {
  const v = (val == null ? '' : String(val)).trim();
  if (v === '') return;
  const n = Number(v);
  if (!Number.isNaN(n)) row[key] = n;
}

// ── Promote — the only step that writes to mystrategy_report_ready ──────────
// 1) close the current active row (effective_to = today), if one exists
// 2) insert the new versioned row (effective_from = today, effective_to = null)
// 3) clear the browser draft
// currentActiveRow: the raw row whose effective_to is null (or null if first).
export async function promoteDraft(draft, { member_id, currentActiveRow }) {
  const version = nextVersionLabel();
  const effective_from = todayISO();
  const row = flattenDraft(draft, { member_id, version, effective_from });

  if (!Object.keys(row).some((k) => /^p1_name$/.test(k))) {
    throw new Error('Add at least Priority 1 before promoting.');
  }

  // 1) close the current active row
  if (currentActiveRow && currentActiveRow.mystrategy_report_ready_id != null) {
    const id = currentActiveRow.mystrategy_report_ready_id;
    const put = await fetch(
      `${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${encodeURIComponent(`mystrategy_report_ready_id=${id}`)}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ effective_to: effective_from }) }
    );
    if (!put.ok) throw new Error(`Couldn't close the current version (HTTP ${put.status}).`);
  }

  // 2) insert the new row
  const post = await fetch(`${API_BASE}/rest/v2/tables/${TABLE}/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row),
  });
  if (!post.ok) {
    const detail = await post.text().catch(() => '');
    throw new Error(`Couldn't create the new version (HTTP ${post.status}). ${detail.slice(0, 160)}`);
  }

  // 3) clear the draft
  clearDraft(member_id);
  return { version, effective_from };
}
