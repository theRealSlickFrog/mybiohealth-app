// MicrohabitWizard — guided, one-priority-at-a-time modal for picking the
// strategy's micro-habits. Walks P1 → P2 → P3, showing each priority's name +
// description and the habits that MOVE it (via marker_x_microhabit), tagged with
// which OTHER priorities each also moves. Habits are shared: up to 3 total, and
// a habit picked for one priority that also covers others shows as "covering"
// on their steps. Ends on a Review step that sets frequency and applies.
import { useState, useMemo } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const MAX = 3;

export default function MicrohabitWizard({ priorities, habitCatalog, links, initialIds, onDone, onClose }) {
  // Active priorities (have a name + marker), 1-based n preserved.
  const activePriorities = useMemo(
    () => priorities.map((p, i) => ({ n: i + 1, name: p.name, marker: p.primary_marker, anchor: p.anchor, target: p.target_text }))
                    .filter((p) => p.name && p.marker),
    [priorities]
  );

  const [step, setStep] = useState(0);            // 0..len-1 = priority steps; len = review
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(() => (initialIds || []).slice(0, MAX));
  const [freq, setFreq] = useState({});           // habit id -> frequency string

  const habitMarkers = useMemo(() => {
    const m = {};
    for (const l of (links || [])) (m[String(l.microhabit_id)] = m[String(l.microhabit_id)] || new Set()).add(l.marker_code);
    return m;
  }, [links]);

  const candidates = useMemo(() => (habitCatalog || []).map((h) => {
    const markers = habitMarkers[String(h.microhabit_id)] || new Set();
    return {
      id: h.microhabit_id, name: h.microhabit_name, frequency: h.default_frequency || '',
      moves: activePriorities.filter((p) => markers.has(p.marker)).map((p) => p.n),
    };
  }), [habitCatalog, habitMarkers, activePriorities]);

  const byId = useMemo(() => { const m = {}; candidates.forEach((c) => { m[c.id] = c; }); return m; }, [candidates]);
  const isReview = step >= activePriorities.length;
  const cur = activePriorities[step];

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : (s.length >= MAX ? s : [...s, id]));

  function finish() {
    const picks = selected.map((id) => byId[id]).filter(Boolean)
      .map((c) => ({ name: c.name, moves: c.moves, frequency: (freq[c.id] ?? c.frequency) || '' }));
    onDone(picks);
  }

  // Rows for the current priority step
  const rows = useMemo(() => {
    if (isReview || !cur) return [];
    const base = showAll ? candidates : candidates.filter((c) => c.moves.includes(cur.n));
    return base.slice().sort((a, b) => (b.moves.length - a.moves.length) || a.name.localeCompare(b.name));
  }, [isReview, cur, showAll, candidates]);

  const coveredBy = !isReview && cur ? selected.map((id) => byId[id]).filter((c) => c && c.moves.includes(cur.n)) : [];
  const nP = activePriorities.length;
  const chip = (n) => <span key={n} style={{ fontSize: 10, fontWeight: 700, color: SAGE_TEXT, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 6, padding: '1px 5px' }}>P{n}</span>;

  // Priorities covered by the current selection, and the greedy fewest-habits
  // set that covers all active priorities (<= MAX) — the "these N cover all" tip.
  const selCover = useMemo(() => { const s = new Set(); selected.forEach((id) => (byId[id]?.moves || []).forEach((n) => s.add(n))); return s; }, [selected, byId]);
  const allCovered = activePriorities.length > 0 && activePriorities.every((p) => selCover.has(p.n));
  const minimal = useMemo(() => {
    const need = new Set(activePriorities.map((p) => p.n));
    const chosen = []; const pool = candidates.filter((c) => c.moves.length);
    while (need.size && chosen.length < MAX) {
      let best = null, gain = 0;
      for (const c of pool) { if (chosen.includes(c)) continue; const g = c.moves.filter((n) => need.has(n)).length; if (g > gain) { gain = g; best = c; } }
      if (!best) break; chosen.push(best); best.moves.forEach((n) => need.delete(n));
    }
    return { picks: chosen, uncovered: [...need] };
  }, [candidates, activePriorities]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: OFFWHITE, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ background: SLATE, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Pick Micro-habits</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              {isReview ? 'Review' : `Priority ${step + 1} of ${nP}`} · {selected.length}/{MAX} chosen
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontSize: 16, cursor: 'pointer' }} aria-label="Close">×</button>
        </div>

        {/* step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 2px' }}>
          {Array.from({ length: nP + 1 }).map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? MBH_SAGE : (i < step ? `${MBH_SAGE}88` : '#d1d5db'), transition: 'all .2s' }} />
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 14px' }}>
          {!isReview && cur && (<>
            <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 21, color: SLATE, margin: '4px 0 2px', fontWeight: 'normal' }}>{cur.name}</h2>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{[cur.anchor, cur.target].filter(Boolean).join('  ·  ')}</div>

            {coveredBy.length > 0 && (
              <div style={{ fontSize: 12, color: SAGE_TEXT, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                ✓ Already covered by <strong>{coveredBy.map((c) => c.name).join(', ')}</strong>. Add more only if you want to.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151' }}>Habits that move this</div>
              <button onClick={() => setShowAll((v) => !v)} style={{ border: `1px solid ${BORDER}`, background: CARD, color: SLATE, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {showAll ? 'Show related only' : 'Show all habits'}
              </button>
            </div>

            {rows.length === 0 && <div style={{ fontSize: 13, color: '#6b7280', padding: '8px 2px' }}>No habits linked to this priority — “Show all habits” to pick one anyway.</div>}
            {rows.map((c) => {
              const on = selected.includes(c.id);
              const blocked = !on && selected.length >= MAX;
              const others = c.moves.filter((n) => n !== cur.n);
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: `1px solid ${on ? MBH_SAGE : BORDER}`, background: on ? SAGE_BG : CARD, marginBottom: 6, cursor: blocked ? 'default' : 'pointer', opacity: blocked ? 0.5 : 1 }}>
                  <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(c.id)} />
                  <span style={{ flex: 1, fontSize: 13.5, color: SLATE }}>
                    {c.name} {c.moves.length >= nP && nP > 1 && <span title="moves all priorities">⭐</span>}
                  </span>
                  {others.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>also</span>{others.map(chip)}
                    </span>
                  )}
                </label>
              );
            })}
          </>)}

          {isReview && (<>
            <h2 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 21, color: SLATE, margin: '4px 0 10px', fontWeight: 'normal' }}>Your micro-habits</h2>

            {/* coverage of the current selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Covers:</span>
              {activePriorities.map((p) => {
                const on = selCover.has(p.n);
                return <span key={p.n} style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 7px', color: on ? SAGE_TEXT : '#9ca3af', background: on ? SAGE_BG : '#f3f4f6', border: `1px solid ${on ? MBH_SAGE + '55' : BORDER}` }}>P{p.n} {p.name}</span>;
              })}
              <span style={{ fontSize: 12, fontWeight: 600, color: allCovered ? SAGE_TEXT : '#b45309' }}>{allCovered ? '✓ all covered' : '— gaps remain'}</span>
            </div>

            {/* fewest-habits suggestion (set-cover) */}
            {minimal.uncovered.length === 0 && minimal.picks.length > 0 && (
              <div style={{ fontSize: 12.5, color: SLATE, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                💡 Fewest habits that cover all {nP}: <strong>{minimal.picks.map((c) => c.name).join(' + ')}</strong>
                <button onClick={() => setSelected(minimal.picks.map((c) => c.id))} style={{ marginLeft: 8, border: `1px solid ${MBH_SAGE}`, background: '#fff', color: SAGE_TEXT, borderRadius: 14, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Use this set</button>
              </div>
            )}

            {/* AI-generated guidance (Phase 2: Claude via a Netlify function) */}
            <div style={{ background: '#fff', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>Guidance</div>
              <div style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>AI generated text goes here</div>
            </div>

            {selected.length === 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>None chosen yet — go back and pick the levers that move your priorities.</div>}
            {selected.map((id) => { const c = byId[id]; if (!c) return null; return (
              <div key={id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: SLATE }}>{c.name}</span>
                  <span style={{ display: 'flex', gap: 4 }}>{c.moves.length ? c.moves.map(chip) : <span style={{ fontSize: 10, color: '#9ca3af' }}>serves none</span>}</span>
                  <button onClick={() => toggle(id)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>remove</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Frequency</span>
                  <input value={freq[id] ?? c.frequency} onChange={(e) => setFreq((f) => ({ ...f, [id]: e.target.value }))}
                    placeholder="5/7 days" style={{ flex: '0 1 160px', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, color: SLATE, background: OFFWHITE, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
            ); })}
          </>)}
        </div>

        {/* footer nav */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: CARD }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            style={{ border: `1px solid ${BORDER}`, background: step === 0 ? '#f3f4f6' : OFFWHITE, color: step === 0 ? '#d1d5db' : SLATE, borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer' }}>← Back</button>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{selected.length} of {MAX}</span>
          {isReview
            ? <button onClick={finish} style={{ border: 'none', background: MBH_SAGE, color: '#fff', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done ✓</button>
            : <button onClick={() => setStep((s) => s + 1)} style={{ border: 'none', background: SLATE, color: '#fff', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{step === nP - 1 ? 'Review →' : 'Next →'}</button>}
        </div>
      </div>
    </div>
  );
}
