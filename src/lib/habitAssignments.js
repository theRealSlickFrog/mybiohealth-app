// Keeping member_x_microhabit in step with the habits on a promoted strategy.
//
// Two places hold the member's habits and nothing kept them in step:
//   mystrategy_report_ready.mhx{n}_*  what was picked in the builder
//   member_x_microhabit               what "Your habits this week" and the
//                                     glucose page actually read
// A row there counts as active when start_dt is set and end_dt is empty
// (WeeklyCheckin.jsx, glucose.js). Promote wrote only the mhx columns, so a new
// version's habits never reached the check-in and the previous version's habits
// stayed active for ever.
//
// Caspio field types, confirmed Sep 2026: member_id, microhabit_id and frequency
// are all text; start_dt, end_dt and created_dt are Date/Time, written as
// 'YYYY-MM-DDT00:00:00' to match the existing rows. microhabit_id is compared as
// trimmed text everywhere below, so '4' and 4 can never both end up stored.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const TABLE = 'member_x_microhabit';

// microhabit_id is a text field: compare and send it as a trimmed string.
const idOf = (v) => (v == null ? '' : String(v).trim());

async function insert(body) {
  try {
    const r = await fetch(`${API_BASE}/rest/v2/tables/${TABLE}/records`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return r.ok;
  } catch (e) { return false; }
}

async function update(assignmentId, body) {
  try {
    const where = encodeURIComponent(`microhabit_x_member_id=${assignmentId}`);
    const r = await fetch(`${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${where}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return r.ok;
  } catch (e) { return false; }
}

/**
 * Bring the member's active assignments in line with the habits on the version
 * just promoted. Never throws — Promote has already written the new version, so
 * a problem here is reported and shown to the user, not raised.
 *
 * @param member_id      the member GUID
 * @param mhx            draft.mhx — the habit slots on the promoted version
 * @param effective_from the version's start date, 'YYYY-MM-DD'
 * @returns { added, kept, closed, skipped, failed, noPicks } — habit ids, except
 *          `skipped` (habit names with no catalog id) and `failed` (reasons).
 */
export async function syncHabitAssignments(member_id, mhx, effective_from) {
  const out = { added: [], kept: [], closed: [], skipped: [], failed: [], noPicks: false };
  const stamp = `${effective_from}T00:00:00`;

  // What this version asks for. A habit with no code can't be assigned: there is
  // no microhabit_id to write. That only happens for a habit carried over from a
  // row saved before mhx{n}_code existed and never re-picked in the wizard.
  const picks = [];
  for (const m of mhx || []) {
    if (!m || !m.name) continue;
    const id = idOf(m.code);
    if (!id) { out.skipped.push(m.name); continue; }
    if (!picks.some((p) => p.id === id)) picks.push({ id, frequency: m.frequency || '' });
  }

  // No habits on this version: leave the member's assignments alone rather than
  // closing every one. Promoting without ticking habits in the carry-over
  // chooser must not end a member's weekly check-in.
  if (!picks.length) { out.noPicks = true; return out; }

  let active = [];
  try {
    const where = encodeURIComponent(`member_id='${member_id}'`);
    const r = await fetch(`${API_BASE}/rest/v2/tables/${TABLE}/records?q.where=${where}&q.limit=500`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    active = ((await r.json()).Result || []).filter((a) => a.start_dt && !a.end_dt);
  } catch (e) {
    out.failed.push(`couldn't read the current habits (${e.message})`);
    return out;   // nothing written
  }

  // Add before closing: a half-finished sync leaves too many habits, never none.
  let addFailed = false;
  for (const p of picks) {
    const row = active.find((a) => idOf(a.microhabit_id) === p.id);
    if (row) {
      // Keep the existing row, and with it its microhabit_x_member_id — the ticks
      // already logged against it in microhabit_x_member_log stay attached.
      out.kept.push(p.id);
      if ((row.frequency || '') !== p.frequency) {
        if (!await update(row.microhabit_x_member_id, { frequency: p.frequency })) {
          out.failed.push(`couldn't update the frequency of habit ${p.id}`);
        }
      }
      continue;
    }
    // end_dt is deliberately not sent, so it stays null and the row reads as active.
    const ok = await insert({
      member_id, microhabit_id: p.id, frequency: p.frequency, start_dt: stamp, created_dt: stamp,
    });
    if (ok) out.added.push(p.id);
    else { addFailed = true; out.failed.push(`couldn't assign habit ${p.id}`); }
  }

  // If an add failed, close nothing: the member would be left with fewer habits
  // than this version asks for.
  if (addFailed) return out;

  for (const a of active) {
    const id = idOf(a.microhabit_id);
    if (picks.some((p) => p.id === id)) continue;
    if (await update(a.microhabit_x_member_id, { end_dt: stamp })) out.closed.push(id);
    else out.failed.push(`couldn't end habit ${id}`);
  }

  return out;
}
