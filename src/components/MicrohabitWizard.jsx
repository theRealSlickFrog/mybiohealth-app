// MicrohabitWizard — guided 3-step modal for picking micro-habits.
// Step 0: Intro — "here are your priorities and what they mean"
// Step 1: Pick — habits grouped by how many priorities each moves
// Step 2: Review — coverage, set-cover tip, AI placeholder, frequency
import { useState, useMemo } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const MAX = 3;
const SERIF = "'DM Serif Display',serif";

export default function MicrohabitWizard({ priorities, habitCatalog, links, whyLib, onDone, onClose }) {
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  // Always start fresh — never carry over the previous strategy's habits.
  const [selected, setSelected] = useState([]);
  const [freq, setFreq] = useState({});

  const activePriorities = useMemo(
    () => priorities.map((p, i) => ({ n: i + 1, name: p.name, marker: p.primary_marker, anchor: p.anchor, target: p.target_text, code: p.priority_code }))
                    .filter((p) => p.name && p.marker),
    [priorities]
  );
  const nP = activePriorities.length;

  const habitMarkers = useMemo(() => {
    const m = {};
    for (const l of (links || [])) (m[String(l.microhabit_id)] = m[String(l.microhabit_id)] || new Set()).add(l.marker_code);
    return m;
  }, [links]);

  const candidates = useMemo(() => (habitCatalog || []).map((h) => {
    const markers = habitMarkers[String(h.microhabit_id)] || new Set();
    return { id: h.microhabit_id, name: h.microhabit_name, frequency: h.default_frequency || '', moves: activePriorities.filter((p) => markers.has(p.marker)).map((p) => p.n) };
  }), [habitCatalog, habitMarkers, activePriorities]);

  const byId = useMemo(() => { const m = {}; candidates.forEach((c) => { m[c.id] = c; }); return m; }, [candidates]);

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : (s.length >= MAX ? s : [...s, id]));

  const selCover = useMemo(() => { const s = new Set(); selected.forEach((id) => (byId[id]?.moves || []).forEach((n) => s.add(n))); return s; }, [selected, byId]);
  const allCovered = nP > 0 && activePriorities.every((p) => selCover.has(p.n));

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

  // Habits grouped by how many priorities they move (for the pick step)
  const groups = useMemo(() => {
    const base = showAll ? candidates : candidates.filter((c) => c.moves.length > 0);
    const sorted = base.slice().sort((a, b) => (b.moves.length - a.moves.length) || a.name.localeCompare(b.name));
    const byN = {};
    sorted.forEach((c) => (byN[c.moves.length] = byN[c.moves.length] || []).push(c));
    return Object.keys(byN).map(Number).sort((a, b) => b - a).map((n) => ({ n, items: byN[n] }));
  }, [candidates, showAll]);

  // First meaningful paragraph from the Why library for a priority code
  const whySnippet = (code) => {
    const txt = (whyLib || {})[code] || '';
    if (!txt) return null;
    const lines = txt.split(/\r?\n/);
    const firstPara = lines.filter((l) => l.trim() && !l.startsWith('##'))[0] || '';
    return firstPara.trim() || null;
  };

  const chip = (n, opts = {}) => (
    <span key={n} style={{ fontSize: 10, fontWeight: 700, color: opts.muted ? '#9ca3af' : SAGE_TEXT, background: opts.muted ? '#f3f4f6' : SAGE_BG, border: `1px solid ${opts.muted ? BORDER : MBH_SAGE + '55'}`, borderRadius: 6, padding: '1px 5px' }}>P{n}</span>
  );

  function finish() {
    const picks = selected.map((id) => byId[id]).filter(Boolean)
      .map((c) => ({ name: c.name, moves: c.moves, frequency: (freq[c.id] ?? c.frequency) || '' }));
    onDone(picks);
  }

  const STEPS = ['Priorities', 'Choose habits', 'Review'];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: OFFWHITE, borderRadius: 18, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>

        {/* header */}
        <div style={{ background: SLATE, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Pick Micro-habits</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>{STEPS[step]} · {selected.length} of {MAX} chosen</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        {/* step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 0' }}>
          {STEPS.map((_, i) => <div key={i} style={{ width: i === step ? 22 : 6, height: 6, borderRadius: 3, background: i === step ? MBH_SAGE : (i < step ? `${MBH_SAGE}88` : '#d1d5db'), transition: 'all .2s' }} />)}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 18px' }}>

          {/* ── Step 0: Intro ── */}
          {step === 0 && (<>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>You have set {nP} {nP === 1 ? 'priority' : 'priorities'} for this strategy. Before picking habits, here's what each one means — and why it matters.</p>
            {activePriorities.map((p) => {
              const snippet = whySnippet(p.code);
              return (
                <div key={p.n} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: CARD, padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: SLATE, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>P{p.n}</span>
                    <div>
                      <div style={{ fontFamily: SERIF, fontSize: 16, color: SLATE, lineHeight: 1.2 }}>{p.anchor}</div>
                      <div style={{ fontSize: 12, color: MBH_SAGE, fontWeight: 600 }}>{p.name}</div>
                    </div>
                  </div>
                  {p.target && <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', marginBottom: snippet ? 8 : 0 }}>→ {p.target}</div>}
                  {snippet && <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{snippet}</p>}
                </div>
              );
            })}
            <p style={{ fontSize: 13, color: '#374151', margin: '14px 0 0' }}>On the next step you'll see habits ranked by how many of these priorities each one moves — pick up to {MAX}. One habit that moves all three is better than three that each move one.</p>
          </>)}

          {/* ── Step 1: Pick ── */}
          {step === 1 && (<>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Habits that move the most of your priorities appear first. A habit marked ⭐ moves all {nP}.</p>
              <button onClick={() => setShowAll((v) => !v)} style={{ flexShrink: 0, marginLeft: 10, border: `1px solid ${BORDER}`, background: CARD, color: SLATE, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {showAll ? 'Related only' : 'Show all'}
              </button>
            </div>
            {groups.length === 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>No related habits — switch to "Show all".</div>}
            {groups.map((g) => (
              <div key={g.n} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: g.n >= nP && g.n > 0 ? MBH_SAGE : '#9ca3af', marginBottom: 6 }}>
                  {g.n === 0 ? 'Not linked to a priority' : g.n >= nP ? `Moves all ${g.n} ⭐` : `Moves ${g.n} of ${nP}`}
                </div>
                {g.items.map((c) => {
                  const on = selected.includes(c.id);
                  const blocked = !on && selected.length >= MAX;
                  const others = c.moves.filter((n) => !activePriorities.map((p) => p.n).includes(n) || true); // all moves
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${on ? MBH_SAGE : BORDER}`, background: on ? SAGE_BG : CARD, marginBottom: 6, cursor: blocked ? 'default' : 'pointer', opacity: blocked ? 0.45 : 1 }}>
                      <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(c.id)} style={{ cursor: blocked ? 'default' : 'pointer' }} />
                      <span style={{ flex: 1, fontSize: 13.5, color: SLATE, fontWeight: on ? 600 : 400 }}>{c.name}</span>
                      <span style={{ display: 'flex', gap: 4 }}>{c.moves.map((n) => chip(n))}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </>)}

          {/* ── Step 2: Review ── */}
          {step === 2 && (<>
            <h2 style={{ fontFamily: SERIF, fontSize: 21, color: SLATE, margin: '0 0 6px', fontWeight: 'normal' }}>Your three levers</h2>

            {/* coverage */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {activePriorities.map((p) => {
                const on = selCover.has(p.n);
                return <span key={p.n} style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 8px', color: on ? SAGE_TEXT : '#9ca3af', background: on ? SAGE_BG : '#f3f4f6', border: `1px solid ${on ? MBH_SAGE + '55' : BORDER}` }}>P{p.n} {p.name} {on ? '✓' : '–'}</span>;
              })}
              {!allCovered && <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>— some priorities not yet covered</span>}
            </div>

            {/* set-cover tip */}
            {minimal.uncovered.length === 0 && minimal.picks.length > 0 && (
              <div style={{ fontSize: 13, color: SLATE, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <span style={{ fontWeight: 600 }}>💡 Fewest habits that cover all {nP}:</span> {minimal.picks.map((c) => c.name).join(' + ')}
                {selected.join(',') !== minimal.picks.map((c) => c.id).join(',') && (
                  <button onClick={() => setSelected(minimal.picks.map((c) => c.id))} style={{ marginLeft: 10, border: `1px solid ${MBH_SAGE}`, background: '#fff', color: SAGE_TEXT, borderRadius: 14, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Use this set</button>
                )}
              </div>
            )}

            {/* AI narrative placeholder */}
            <div style={{ background: '#fff', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>Guidance</div>
              <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>AI generated text goes here</div>
            </div>

            {/* chosen habits */}
            {selected.length === 0
              ? <div style={{ fontSize: 13, color: '#6b7280' }}>None chosen — go back and pick your levers.</div>
              : selected.map((id) => { const c = byId[id]; if (!c) return null; return (
                <div key={id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: SLATE }}>{c.name}</span>
                    <span style={{ display: 'flex', gap: 4 }}>{c.moves.map((n) => chip(n))}</span>
                    <button onClick={() => { toggle(id); setStep(1); }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>change</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Frequency</span>
                    <input value={freq[id] ?? c.frequency} onChange={(e) => setFreq((f) => ({ ...f, [id]: e.target.value }))}
                      placeholder="5/7 days" style={{ flex: '0 1 160px', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, color: SLATE, background: OFFWHITE, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
              ); })
            }
          </>)}
        </div>

        {/* footer nav */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: CARD }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            style={{ border: `1px solid ${BORDER}`, background: step === 0 ? '#f3f4f6' : OFFWHITE, color: step === 0 ? '#d1d5db' : SLATE, borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer' }}>← Back</button>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{selected.length} of {MAX}</span>
          {step < 2
            ? <button onClick={() => setStep((s) => s + 1)} style={{ border: 'none', background: SLATE, color: '#fff', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{step === 1 ? 'Review →' : 'Next →'}</button>
            : <button onClick={finish} disabled={selected.length === 0} style={{ border: 'none', background: selected.length ? MBH_SAGE : '#e5e7eb', color: selected.length ? '#fff' : '#9ca3af', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: selected.length ? 'pointer' : 'default' }}>Done ✓</button>}
        </div>
      </div>
    </div>
  );
}
