// "Your habits this week" — weekly micro-habit check-in. Mechanic copied from
// the V1 weekly check-in: active assignments from microhabit_x_member (+ the
// microhabit catalog for names), one completed day = one row in
// microhabit_x_member_log. Look follows the June 20 design (per-day toggles +
// vote count), restyled for V2. Week navigation; a Save writes the diff
// (POST new days / DELETE un-checked days). Replaces the old MicroHabits list.
import { useEffect, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, CARD, BORDER, OFFWHITE, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';

const API_BASE = 'https://kenises-api-proxy.netlify.app';
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Monday of the week containing d (local time, midnight).
function weekStartOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon=0 .. Sun=6
  x.setDate(x.getDate() - dow);
  return x;
}
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// "3/7" -> 3 ; "daily" -> 7 ; "weekly" -> 1 ; else null
function freqTarget(freq) {
  const m = String(freq || '').match(/^(\d+)\s*\/\s*7$/);
  if (m) return parseInt(m[1], 10);
  const f = String(freq || '').toLowerCase();
  if (f.includes('daily')) return 7;
  if (f.includes('weekly')) return 1;
  return null;
}

async function fetchLogs(habits) {
  if (!habits.length) return [];
  const where = habits.map((h) => `microhabit_x_member_id=${h.assignmentId}`).join(' OR ');
  const r = await fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member_log/records?q.where=${encodeURIComponent(where)}&q.limit=2000`);
  return (r.ok ? (await r.json()).Result : []) || [];
}

export default function WeeklyCheckin({ habitLinks = [] }) {
  const member = getStoredGuid() || DEV_MEMBER;
  const [habits, setHabits] = useState(null);   // [{assignmentId, microhabitId, name, frequency, target}]
  const [logs, setLogs] = useState([]);          // raw microhabit_x_member_log rows
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [pending, setPending] = useState({});    // `${aid}|${iso}` -> desired boolean (override)
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

  // Load logs once habits are known.
  useEffect(() => {
    if (!habits) return;
    let cancelled = false;
    fetchLogs(habits).then((rows) => { if (!cancelled) setLogs(rows); }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [habits]);

  if (habits === null) {
    return <div style={{ padding: '20px 4px', color: '#9ca3af', fontSize: 13 }}>Loading habits…</div>;
  }
  if (habits.length === 0) {
    return <div style={{ padding: '16px 4px', color: '#9ca3af', fontSize: 13 }}>No active micro-habits assigned yet.</div>;
  }

  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
  const weekEnd = days[6];
  const key = (aid, iso) => `${aid}|${iso}`;
  const existingLog = (aid, iso) => logs.find((l) => String(l.microhabit_x_member_id) === String(aid) && l.log_dt && String(l.log_dt).slice(0, 10) === iso);
  const isOn = (aid, iso) => { const k = key(aid, iso); return k in pending ? pending[k] : !!existingLog(aid, iso); };
  const toggle = (aid, iso) => { const k = key(aid, iso); setPending((p) => ({ ...p, [k]: !isOn(aid, iso) })); };
  const linkedFor = (name) => (habitLinks.find((h) => h.name === name) || {}).linked || [];

  const weekLabel = weekEnd.getMonth() === weekStart.getMonth()
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}`
    : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
  const shiftWeek = (dir) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + dir * 7); setWeekStart(d); setPending({}); };
  const dirty = Object.keys(pending).some((k) => {
    const [aid, iso] = k.split('|');
    return pending[k] !== !!existingLog(aid, iso);
  });

  async function save() {
    setSaving(true); setError(null);
    try {
      const ops = [];
      for (const [k, want] of Object.entries(pending)) {
        const [aid, iso] = k.split('|');
        const ex = existingLog(aid, iso);
        if (want && !ex) {
          const habit = habits.find((h) => String(h.assignmentId) === String(aid));
          ops.push(fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member_log/records`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ microhabit_x_member_id: Number(aid), member_id: member, microhabit_id: habit ? habit.microhabitId : null, log_dt: iso, completion_dt: iso, completion_status: 'completed', notes: 'Weekly check-in' }),
          }));
        } else if (!want && ex) {
          ops.push(fetch(`${API_BASE}/rest/v2/tables/microhabit_x_member_log/records?q.where=microhabit_x_member_log_id=${ex.microhabit_x_member_log_id}`, { method: 'DELETE' }));
        }
      }
      await Promise.all(ops);
      setLogs(await fetchLogs(habits));
      setPending({});
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

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

      {habits.map((h) => {
        const serves = linkedFor(h.name);
        const count = days.reduce((n, d) => n + (isOn(h.assignmentId, isoDate(d)) ? 1 : 0), 0);
        const met = h.target != null && count >= h.target;
        return (
          <div key={h.assignmentId} style={{ background: CARD, borderRadius: 14, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: SLATE, lineHeight: 1.35 }}>🌱 {h.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {h.target != null && <span style={{ fontSize: 10.5, fontWeight: 700, color: SAGE_TEXT, background: SAGE_BG, borderRadius: 10, padding: '2px 8px' }}>Aim {h.target}/7</span>}
              {serves.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: '#374151' }}>Serves {serves.length > 1 ? 'priorities' : 'priority'} {serves.join(' & ')}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {days.map((d, i) => {
                const on = isOn(h.assignmentId, isoDate(d));
                return (
                  <button key={i} onClick={() => toggle(h.assignmentId, isoDate(d))}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1.5px solid ${on ? MBH_SAGE : BORDER}`, background: on ? MBH_SAGE : CARD, color: on ? '#fff' : '#9ca3af', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <span>{DAY_LABELS[i]}</span>
                    {on && <span style={{ fontSize: 8 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{met ? 'This week leaned yes — a vote for who you’re becoming' : (h.target != null ? `Aiming for ${h.target} · ${Math.max(0, h.target - count)} to go` : 'Tap the days you did it')}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: met ? MBH_SAGE : count > 0 ? '#d97706' : '#9ca3af' }}>{count} / 7</span>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
        {error && <span style={{ fontSize: 11, color: SOFT_RED }}>Couldn’t save ({error}).</span>}
        <button onClick={save} disabled={!dirty || saving}
          style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', border: 'none', cursor: dirty && !saving ? 'pointer' : 'default', background: dirty && !saving ? MBH_SAGE : '#e5e7eb', color: dirty && !saving ? '#fff' : '#9ca3af' }}>
          {saving ? 'Saving…' : 'Save week'}
        </button>
      </div>
    </div>
  );
}
