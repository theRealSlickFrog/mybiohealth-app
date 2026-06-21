// "Your habits this week" — weekly micro-habit check-in, V1 mechanic & look.
// Each active assignment (microhabit_x_member + microhabit catalog) is a row:
// name, Intended Weekly Frequency, and an Actual Weekly Frequency −/＋ count
// stepper (0–7). Save diffs the entered count against the week's rows in
// microhabit_x_member_log — POSTing logs on un-logged days / DELETing from the
// end — exactly like the V1 weekly check-in, restyled for V2. Week navigation.
import { useEffect, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, CARD, BORDER, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';

const API_BASE = 'https://kenises-api-proxy.netlify.app';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekStartOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon=0 .. Sun=6
  x.setDate(x.getDate() - dow);
  return x;
}
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const weekDays = (ws) => Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
// "3/7" -> 3 ; "daily" -> 7 ; "weekly" -> 1 ; else null
function freqTarget(freq) {
  const m = String(freq || '').match(/^(\d+)\s*\/\s*7$/);
  if (m) return parseInt(m[1], 10);
  const f = String(freq || '').toLowerCase();
  if (f.includes('daily')) return 7;
  if (f.includes('weekly')) return 1;
  return null;
}
function freqText(freq) {
  const t = freqTarget(freq);
  if (t === 7) return 'Daily';
  if (t === 1) return 'Weekly';
  if (t != null) return `${t}× / week`;
  return freq || '—';
}

async function fetchLogs(habits) {
  if (!habits.length) return [];
  const where = habits.map((h) => `microhabit_x_member_id=${h.assignmentId}`).join(' OR ');
  const r = await fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member_log/records?q.where=${encodeURIComponent(where)}&q.limit=2000`);
  return (r.ok ? (await r.json()).Result : []) || [];
}
const logsForWeek = (logs, aid, days) => {
  const isoSet = days.map(isoDate);
  return logs.filter((l) => String(l.microhabit_x_member_id) === String(aid) && l.log_dt && isoSet.includes(String(l.log_dt).slice(0, 10)));
};

export default function WeeklyCheckin() {
  const member = getStoredGuid() || DEV_MEMBER;
  const [habits, setHabits] = useState(null);   // [{assignmentId, microhabitId, name, frequency, target}]
  const [logs, setLogs] = useState([]);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [counts, setCounts] = useState({});      // assignmentId -> current stepper value
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load active assignments + catalog names once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [axResp, catResp] = await Promise.all([
          fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member/records?q.where=${encodeURIComponent(`member_id='${member}'`)}&q.limit=100`),
          fetch(`${API_BASE}/rest/v2/tables/microhabit/records?q.limit=500`),
        ]);
        const ax = (axResp.ok ? (await axResp.json()).Result : []) || [];
        const cat = (catResp.ok ? (await catResp.json()).Result : []) || [];
        const catMap = {};
        cat.forEach((c) => { catMap[c.microhabit_id] = c; });
        const active = ax.filter((a) => a.start_dt && !a.end_dt).map((a) => ({
          assignmentId: a.microhabit_x_member_id,
          microhabitId: a.microhabit_id,
          name: (catMap[a.microhabit_id] || {}).microhabit_name || 'Microhabit',
          frequency: a.frequency,
          target: freqTarget(a.frequency),
        }));
        if (!cancelled) setHabits(active);
      } catch (e) { if (!cancelled) { setHabits([]); setError(e.message); } }
    })();
    return () => { cancelled = true; };
  }, [member]);

  // Load logs once habits known.
  useEffect(() => {
    if (!habits) return;
    let cancelled = false;
    fetchLogs(habits).then((rows) => { if (!cancelled) setLogs(rows); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [habits]);

  // (Re)seed the stepper values from this week's logs whenever week/logs change.
  // V1 behaviour: show the logged count; if none yet, pre-fill the intended target.
  useEffect(() => {
    if (!habits) return;
    const days = weekDays(weekStart);
    const next = {};
    habits.forEach((h) => {
      const logged = logsForWeek(logs, h.assignmentId, days).length;
      next[h.assignmentId] = logged > 0 ? logged : (h.target != null ? h.target : 0);
    });
    setCounts(next);
  }, [habits, logs, weekStart]);

  if (habits === null) return <div style={{ padding: '20px 4px', color: '#9ca3af', fontSize: 13 }}>Loading habits…</div>;
  if (habits.length === 0) return <div style={{ padding: '16px 4px', color: '#9ca3af', fontSize: 13 }}>No active micro-habits assigned yet.</div>;

  const days = weekDays(weekStart);
  const weekEnd = days[6];
  const weekLabel = weekEnd.getMonth() === weekStart.getMonth()
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}`
    : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
  const loggedCount = (aid) => logsForWeek(logs, aid, days).length;
  const setCount = (aid, v) => setCounts((c) => ({ ...c, [aid]: Math.max(0, Math.min(7, v)) }));
  const dirty = habits.some((h) => (counts[h.assignmentId] ?? 0) !== loggedCount(h.assignmentId));
  const shiftWeek = (dir) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + dir * 7); setWeekStart(d); };

  async function save() {
    setSaving(true); setError(null);
    try {
      const ops = [];
      for (const h of habits) {
        const aid = h.assignmentId;
        const existing = logsForWeek(logs, aid, days);
        const have = existing.length;
        const want = counts[aid] ?? 0;
        if (want > have) {
          const loggedIso = new Set(existing.map((l) => String(l.log_dt).slice(0, 10)));
          let toAdd = want - have;
          for (let i = 0; i < 7 && toAdd > 0; i++) {
            const iso = isoDate(days[i]);
            if (loggedIso.has(iso)) continue;
            ops.push(fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member_log/records`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ microhabit_x_member_id: Number(aid), member_id: member, microhabit_id: h.microhabitId, log_dt: iso, completion_dt: iso, completion_status: 'completed', notes: 'Weekly check-in' }),
            }));
            toAdd--;
          }
        } else if (want < have) {
          const sorted = [...existing].sort((a, b) => String(b.log_dt).localeCompare(String(a.log_dt)));
          for (let i = 0; i < have - want; i++) {
            ops.push(fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member_log/records?q.where=microhabit_x_member_log_id=${sorted[i].microhabit_x_member_log_id}`, { method: 'DELETE' }));
          }
        }
      }
      await Promise.all(ops);
      setLogs(await fetchLogs(habits));
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const stepBtn = { width: 28, height: 28, border: `1px solid ${BORDER}`, borderRadius: 6, background: '#f7f5f0', color: SLATE, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Your habits this week</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" style={{ border: `1px solid ${BORDER}`, background: CARD, color: SLATE, borderRadius: 8, width: 26, height: 24, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', minWidth: 96, textAlign: 'center' }}>{weekLabel}</span>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" style={{ border: `1px solid ${BORDER}`, background: CARD, color: SLATE, borderRadius: 8, width: 26, height: 24, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>›</button>
        </div>
      </div>

      <div style={{ background: CARD, borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {habits.map((h, i) => {
          const logged = loggedCount(h.assignmentId);
          const val = counts[h.assignmentId] ?? 0;
          const saved = logged > 0 && val === logged;
          return (
            <div key={h.assignmentId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < habits.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: SLATE, lineHeight: 1.3 }}>{h.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Intended: {freqText(h.frequency)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setCount(h.assignmentId, val - 1)} style={stepBtn} aria-label="Decrease">−</button>
                <span style={{ width: 26, textAlign: 'center', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: saved ? SLATE : '#9ca3af', fontStyle: saved ? 'normal' : 'italic' }}>{val}</span>
                <button onClick={() => setCount(h.assignmentId, val + 1)} style={stepBtn} aria-label="Increase">+</button>
                {saved && <span style={{ fontSize: 10, fontWeight: 700, color: MBH_SAGE, background: SAGE_BG, borderRadius: 10, padding: '2px 7px' }}>Saved</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
        {error && <span style={{ fontSize: 11, color: SOFT_RED }}>Couldn’t save ({error}).</span>}
        <button onClick={save} disabled={!dirty || saving}
          style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', border: 'none', cursor: dirty && !saving ? 'pointer' : 'default', background: dirty && !saving ? MBH_SAGE : '#e5e7eb', color: dirty && !saving ? '#fff' : '#9ca3af' }}>
          {saving ? 'Saving…' : 'Save week'}
        </button>
      </div>
    </div>
  );
}
