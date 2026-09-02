// MicrohabitWizard — modal picker for the strategy's micro-habits, ranked by
// how many of the picked priorities each habit MOVES (via marker_x_microhabit).
// Highest-leverage habits ("moves all 3 ⭐") surface at the top. A Related/All
// toggle switches between "habits tied to a priority marker" and every habit.
// Pick up to 3; each pick's Serves-links auto-derive from what it moves.
import { useState, useMemo } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const MAX = 3;

export default function MicrohabitWizard({ priorities, habitCatalog, links, initialIds, onDone, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(() => (initialIds || []).slice(0, MAX));

  // Priorities that are actually set (have a marker), 1-based index preserved.
  const activePriorities = useMemo(
    () => priorities.map((p, i) => ({ n: i + 1, name: p.name, marker: p.primary_marker }))
                    .filter((p) => p.name && p.marker),
    [priorities]
  );

  // habit id -> Set(marker_code)
  const habitMarkers = useMemo(() => {
    const m = {};
    for (const l of (links || [])) {
      const id = String(l.microhabit_id);
      (m[id] = m[id] || new Set()).add(l.marker_code);
    }
    return m;
  }, [links]);

  // Candidate habits, each tagged with which priority numbers it moves.
  const candidates = useMemo(() => (habitCatalog || []).map((h) => {
    const markers = habitMarkers[String(h.microhabit_id)] || new Set();
    return {
      id: h.microhabit_id,
      name: h.microhabit_name,
      frequency: h.default_frequency || '',
      moves: activePriorities.filter((p) => markers.has(p.marker)).map((p) => p.n),
    };
  }), [habitCatalog, habitMarkers, activePriorities]);

  const visible = showAll ? candidates : candidates.filter((c) => c.moves.length > 0);

  // Group by count moved (desc); in All mode a "0" group can appear.
  const groups = useMemo(() => {
    const byN = {};
    for (const c of visible) (byN[c.moves.length] = byN[c.moves.length] || []).push(c);
    return Object.keys(byN).map(Number).sort((a, b) => b - a)
      .map((n) => ({ n, items: byN[n].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [visible]);

  const nP = activePriorities.length;
  const groupLabel = (n) => n === 0 ? 'Not linked to a priority'
    : (n >= nP ? `Moves all ${n} ⭐` : `Moves ${n}`);

  const toggle = (id) => setSelected((s) =>
    s.includes(id) ? s.filter((x) => x !== id) : (s.length >= MAX ? s : [...s, id]));

  const done = () => onDone(selected.map((id) => candidates.find((c) => c.id === id)).filter(Boolean));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: OFFWHITE, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: SLATE, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Pick Micro-habits</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>The fewest levers that move the most — up to {MAX}.</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontSize: 16, cursor: 'pointer' }} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px 6px' }}>
          <div style={{ display: 'inline-flex', border: `1px solid ${BORDER}`, borderRadius: 20, overflow: 'hidden' }}>
            {[['Related', false], ['All', true]].map(([label, val]) => (
              <button key={label} onClick={() => setShowAll(val)}
                style={{ border: 'none', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: showAll === val ? MBH_SAGE : CARD, color: showAll === val ? '#fff' : SLATE }}>{label}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{showAll ? 'All active habits' : 'Habits tied to your priorities'}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 12px' }}>
          {groups.length === 0 && <div style={{ fontSize: 13, color: '#6b7280', padding: '16px 6px' }}>No related habits — switch to “All”.</div>}
          {groups.map((g) => (
            <div key={g.n} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: (g.n >= nP && g.n > 0) ? MBH_SAGE : '#9ca3af', margin: '6px 4px' }}>{groupLabel(g.n)}</div>
              {g.items.map((c) => {
                const on = selected.includes(c.id);
                const blocked = !on && selected.length >= MAX;
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: `1px solid ${on ? MBH_SAGE : BORDER}`, background: on ? SAGE_BG : CARD, marginBottom: 6, cursor: blocked ? 'default' : 'pointer', opacity: blocked ? 0.5 : 1 }}>
                    <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(c.id)} />
                    <span style={{ flex: 1, fontSize: 13.5, color: SLATE }}>{c.name}</span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      {c.moves.map((n) => <span key={n} style={{ fontSize: 10, fontWeight: 700, color: SAGE_TEXT, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 6, padding: '1px 5px' }}>P{n}</span>)}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: CARD }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{selected.length} of {MAX} selected</span>
          <button onClick={done} style={{ border: 'none', background: MBH_SAGE, color: '#fff', borderRadius: 20, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done ✓</button>
        </div>
      </div>
    </div>
  );
}
