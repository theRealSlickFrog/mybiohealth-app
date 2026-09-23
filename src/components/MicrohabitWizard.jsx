// MicrohabitWizard — guided modal for picking / adjusting micro-habits.
// Two steps:
//   choose    — explainer, live priority coverage, the priorities' "Why" behind a
//               toggle, the fewest-habits recommendation, optional AI guidance,
//               and the candidate list grouped by leverage
//   frequency — how often each chosen habit runs
import { useState, useMemo, useEffect } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';
import { getHabitGuidance } from '../lib/habitGuidance.js';
import { Chevron } from './UI.jsx';

const MAX = 3;
const SERIF = "'DM Serif Display',serif";
const STEPS = ['choose', 'frequency'];
const STEP_LABEL = { choose: 'Choose your habits', frequency: 'How often' };

export default function MicrohabitWizard({ priorities, habitCatalog, links, whyLib, initialHabits = [], onDone, onClose }) {
  const hasExisting = (initialHabits || []).length > 0;

  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState([]);   // seeded once the catalog loads
  const [freq, setFreq] = useState({});
  const [seeded, setSeeded] = useState(false);
  const [limitMsg, setLimitMsg] = useState(false);  // "three is the maximum" shown?
  const [showWhy, setShowWhy] = useState(false);    // "About your priorities" open?

  const stepKey = STEPS[step] || 'choose';

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

  // Match a stored habit name to a catalog candidate: exact (case-insensitive)
  // first, then by the text before the first comma — handles descriptive names
  // carried from older strategies (e.g. "Daily Glucose Rest, > 3 hours, …" vs
  // the catalog's "Daily Glucose Rest, > 3 hours during the daytime").
  const norm = (s) => (s || '').trim().toLowerCase();
  const firstSeg = (s) => norm(s).split(',')[0].trim();
  const matchCandidate = (name) =>
    candidates.find((c) => norm(c.name) === norm(name)) ||
    candidates.find((c) => firstSeg(c.name) && firstSeg(c.name) === firstSeg(name)) || null;

  // Resolve a stored habit to a catalog candidate: by microhabit_id (code) when
  // present — the reliable path — else fall back to name matching for legacy
  // rows that predate mhx{n}_code.
  const resolveHabit = (h) => (h.code != null && h.code !== '' && byId[h.code]) ? byId[h.code] : matchCandidate(h.name);

  const selCover = useMemo(() => { const s = new Set(); selected.forEach((id) => (byId[id]?.moves || []).forEach((n) => s.add(n))); return s; }, [selected, byId]);
  const allCovered = nP > 0 && activePriorities.every((p) => selCover.has(p.n));

  // Greedy set cover: the fewest habits that move every priority.
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

  // Seed once the catalog is in: the current habits when adjusting, the
  // fewest-habits recommendation when picking fresh.
  useEffect(() => {
    if (seeded || candidates.length === 0) return;
    if (hasExisting) {
      const ids = []; const f = {};
      (initialHabits || []).forEach((h) => {
        const c = resolveHabit(h);
        if (c && !ids.includes(c.id)) { ids.push(c.id); f[c.id] = h.frequency || ''; }
      });
      setSelected(ids.slice(0, MAX));
      setFreq((prev) => ({ ...f, ...prev }));
    } else {
      setSelected(minimal.picks.slice(0, MAX).map((c) => c.id));
    }
    setSeeded(true);
  }, [candidates, seeded, hasExisting, minimal]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Hard cap at MAX. A blocked pick says so rather than doing nothing.
  const toggle = (id) => {
    const on = selected.includes(id);
    if (!on && selected.length >= MAX) { setLimitMsg(true); return; }
    setLimitMsg(false);
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  // Habits grouped by how many priorities they move. Already-selected habits are
  // always shown even in related-only view, so a pre-selected one never hides.
  const groups = useMemo(() => {
    const base = showAll ? candidates : candidates.filter((c) => c.moves.length > 0 || selected.includes(c.id));
    const sorted = base.slice().sort((a, b) => (b.moves.length - a.moves.length) || a.name.localeCompare(b.name));
    const byN = {};
    sorted.forEach((c) => (byN[c.moves.length] = byN[c.moves.length] || []).push(c));
    return Object.keys(byN).map(Number).sort((a, b) => b - a).map((n) => ({ n, items: byN[n] }));
  }, [candidates, showAll, selected]);

  // First meaningful paragraph from the Why library for a priority code
  const whySnippet = (code) => {
    const txt = (whyLib || {})[code] || '';
    if (!txt) return null;
    const lines = txt.split(/\r?\n/);
    const firstPara = lines.filter((l) => l.trim() && !l.startsWith('##'))[0] || '';
    return firstPara.trim() || null;
  };

  const chip = (n) => (
    <span key={n} style={{ fontSize: 10, fontWeight: 700, color: SAGE_TEXT, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 6, padding: '1px 5px' }}>P{n}</span>
  );

  // The result handed back to the builder — unchanged shape.
  const picks = useMemo(() => selected.map((id) => byId[id]).filter(Boolean)
    .map((c) => ({ code: c.id, name: c.name, moves: c.moves, frequency: (freq[c.id] ?? c.frequency) || '' })), [selected, byId, freq]);

  // Null until wired to a model; the box is not rendered at all while it is.
  const guidance = useMemo(() => getHabitGuidance(activePriorities, picks), [activePriorities, picks]);

  function finish() { onDone(picks); }

  const atFirst = step === 0;
  const recommended = minimal.uncovered.length === 0 && minimal.picks.length > 0;
  const onRecommended = selected.join(',') === minimal.picks.map((c) => c.id).join(',');

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: OFFWHITE, borderRadius: 18, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>

        {/* header */}
        <div style={{ background: SLATE, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{hasExisting ? 'Adjust Micro-habits' : 'Pick Micro-habits'}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>{STEP_LABEL[stepKey]} · Step {step + 1} of {STEPS.length}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {/* step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 0' }}>
          {STEPS.map((_, i) => <div key={i} style={{ width: i === step ? 22 : 6, height: 6, borderRadius: 3, background: i === step ? MBH_SAGE : (i < step ? `${MBH_SAGE}88` : '#d1d5db'), transition: 'all .2s' }} />)}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 18px' }}>

          {/* ── Step 1 · Choose your habits ── */}
          {stepKey === 'choose' && (<>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: '0 0 14px' }}>
              You work on at most {MAX} micro-habits at a time. Habits that move the most of your priorities appear first — a habit marked ⭐ moves all {nP}. One habit that moves all three is better than three that each move one.
            </p>

            {/* live coverage */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {activePriorities.map((p) => {
                const on = selCover.has(p.n);
                return <span key={p.n} style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 8px', color: on ? SAGE_TEXT : '#9ca3af', background: on ? SAGE_BG : '#f3f4f6', border: `1px solid ${on ? MBH_SAGE + '55' : BORDER}` }}>P{p.n} {p.name || p.anchor} {on ? '✓' : '–'}</span>;
              })}
              {!allCovered && <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>— some priorities not yet covered</span>}
            </div>

            {/* the priorities' "Why", collapsed by default */}
            <button onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy}
              style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 12px', padding: 0, border: 'none', background: 'none', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Chevron open={showWhy} />About your priorities
            </button>
            {showWhy && activePriorities.map((p) => {
              const snippet = whySnippet(p.code);
              return (
                <div key={p.n} style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: CARD, padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: SLATE, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>P{p.n}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: SERIF, fontSize: 16, color: SLATE, lineHeight: 1.2 }}>{p.anchor}</div>
                      <div style={{ fontSize: 12, color: MBH_SAGE, fontWeight: 600 }}>{p.name}</div>
                    </div>
                  </div>
                  {p.target && <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', marginBottom: snippet ? 8 : 0, overflowWrap: 'anywhere' }}>→ {p.target}</div>}
                  {snippet && <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{snippet}</p>}
                </div>
              );
            })}

            {/* fewest-habits recommendation */}
            {recommended && (
              <div style={{ fontSize: 13, color: SLATE, background: SAGE_BG, border: `1px solid ${MBH_SAGE}55`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>💡 Fewest habits that cover all {nP}:</span> {minimal.picks.map((c) => c.name).join(' + ')}
                </span>
                {!onRecommended && (
                  <button onClick={() => { setLimitMsg(false); setSelected(minimal.picks.map((c) => c.id)); }}
                    style={{ flexShrink: 0, border: `1px solid ${MBH_SAGE}`, background: '#fff', color: SAGE_TEXT, borderRadius: 14, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Use recommended</button>
                )}
              </div>
            )}

            {/* AI guidance — rendered only when there is something to say */}
            {guidance && (
              <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>Guidance</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{guidance}</div>
              </div>
            )}

            {/* candidate list */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '4px 0 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#374151' }}>Habits</div>
              <button onClick={() => setShowAll((v) => !v)} style={{ flexShrink: 0, border: `1px solid ${BORDER}`, background: CARD, color: SLATE, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {showAll ? 'Related only' : 'Show all'}
              </button>
            </div>
            {limitMsg && (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#b45309', background: '#fef3e2', border: '1px solid #d97706', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                Three is the maximum. Remove one to add another.
              </div>
            )}
            {groups.length === 0 && <div style={{ fontSize: 13, color: '#6b7280' }}>No related habits — switch to "Show all".</div>}
            {groups.map((g) => (
              <div key={g.n} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: g.n >= nP && g.n > 0 ? MBH_SAGE : '#9ca3af', marginBottom: 6 }}>
                  {g.n === 0 ? 'Not linked to a priority' : g.n >= nP ? `Moves all ${g.n} ⭐` : `Moves ${g.n} of ${nP}`}
                </div>
                {g.items.map((c) => {
                  const on = selected.includes(c.id);
                  const blocked = !on && selected.length >= MAX;
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${on ? MBH_SAGE : BORDER}`, background: on ? SAGE_BG : CARD, marginBottom: 6, cursor: 'pointer', opacity: blocked ? 0.45 : 1 }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: SLATE, fontWeight: on ? 600 : 400, overflowWrap: 'anywhere' }}>{c.name}</span>
                      <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{c.moves.map((n) => chip(n))}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </>)}

          {/* ── Step 2 · How often ── */}
          {stepKey === 'frequency' && (<>
            <h2 style={{ fontFamily: SERIF, fontSize: 21, color: SLATE, margin: '0 0 6px', fontWeight: 'normal' }}>How often</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>How often should each habit run? Go Back to change which habits you picked.</p>
            {selected.length === 0
              ? <div style={{ fontSize: 13, color: '#6b7280' }}>None chosen — go back and pick your levers.</div>
              : selected.map((id) => { const c = byId[id]; if (!c) return null; return (
                <div key={id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: SLATE, overflowWrap: 'anywhere' }}>{c.name}</span>
                    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{c.moves.map((n) => chip(n))}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>Frequency</span>
                    <input value={freq[id] ?? c.frequency} onChange={(e) => setFreq((f) => ({ ...f, [id]: e.target.value }))}
                      placeholder="5/7 days" style={{ flex: '0 1 160px', minWidth: 0, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, color: SLATE, background: OFFWHITE, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
              ); })
            }
          </>)}
        </div>

        {/* footer nav */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: CARD }}>
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={atFirst}
            style={{ border: `1px solid ${BORDER}`, background: atFirst ? '#f3f4f6' : OFFWHITE, color: atFirst ? '#d1d5db' : SLATE, borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: atFirst ? 'default' : 'pointer', fontFamily: 'inherit' }}>← Back</button>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, textAlign: 'center' }}>{selected.length} of {MAX} chosen</span>
          {stepKey === 'choose'
            ? <button onClick={() => setStep(1)} style={{ border: 'none', background: SLATE, color: '#fff', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
            : <button onClick={finish} disabled={selected.length === 0} style={{ border: 'none', background: selected.length ? MBH_SAGE : '#e5e7eb', color: selected.length ? '#fff' : '#9ca3af', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: selected.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>Done ✓</button>}
        </div>
      </div>
    </div>
  );
}
