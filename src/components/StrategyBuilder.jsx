// StrategyBuilder — the "Priority Builder" (Aug 19 stand-up). An inline panel on
// MyStrategy that lets an admin (or the member on a call) assemble a strategy:
// pick up to 3 priorities from priority_library (auto-fills name/marker + pulls
// the latest reading), write each "Why", set up to 3 shared micro-habits, then
// Promote to a new versioned mystrategy_report_ready row. The working draft is
// NOT persisted — it lives only in this component's state for the session.
// Leave without Promote and it's gone (with a warning first).
import { useEffect, useMemo, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER, SOFT_RED, AMBER } from '../lib/constants.js';
import {
  emptyDraft, emptyMhx, fetchPriorityCatalog, fetchMicrohabits, fetchPriorityWhys, fetchMarkerHabitLinks,
  applyLibraryPick, latestReadingFor,
  promoteDraft, draftHasContent, setDraftDirty, DRAFT_LEAVE_MSG,
} from '../lib/strategyBuilder.js';
import { loadNote, saveNote } from '../lib/notes.js';
import MicrohabitWizard from './MicrohabitWizard.jsx';

const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151', marginBottom: 4, display: 'block' };
const input = { width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: SLATE, background: OFFWHITE, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const area = { ...input, minHeight: 72, resize: 'vertical', lineHeight: 1.5 };

export default function StrategyBuilder({ member, initialDraft, previousDraft, labRows, currentActiveRow, onPromoted, onCancel }) {
  // Start from the prefill (a "new version from current strategy") or blank.
  // Nothing is loaded from storage — the draft is session-only.
  const [draft, setDraft] = useState(() => initialDraft || emptyDraft());
  const [library, setLibrary] = useState([]);
  const [whyLib, setWhyLib] = useState({});   // priority_code -> standard Why (markdown)
  const [habitCatalog, setHabitCatalog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // "From the Top" — the member's goal statement (a single per-member note,
  // strategy_why). Prefill from the existing note; saved on Promote.
  const [whyText, setWhyText] = useState('');
  const [whyOrig, setWhyOrig] = useState('');
  const [whyNoteId, setWhyNoteId] = useState(null);
  const [habitLinks, setHabitLinks] = useState([]);   // marker_x_microhabit, for the picker wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => { fetchPriorityCatalog().then(setLibrary); }, []);
  useEffect(() => { fetchPriorityWhys('EN').then(setWhyLib); }, []);
  useEffect(() => { fetchMicrohabits().then(setHabitCatalog); }, []);
  useEffect(() => { fetchMarkerHabitLinks().then(setHabitLinks); }, []);
  useEffect(() => {
    loadNote(member, 'strategy_why')
      .then((n) => { setWhyText(n.text || ''); setWhyOrig(n.text || ''); setWhyNoteId(n.id); })
      .catch(() => {});
  }, [member]);

  // The draft is not persisted. Keep the module-level "unpromoted draft" flag in
  // sync (so AppShell can block navigation) and warn on hard browser close/refresh
  // while there's real content. Always clear the flag on unmount.
  const dirty = draftHasContent(draft) || whyText !== whyOrig;
  useEffect(() => {
    setDraftDirty(dirty);
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => () => setDraftDirty(false), []);

  const libByCode = useMemo(() => {
    const m = {}; library.forEach((l) => { m[l.priority_code] = l; }); return m;
  }, [library]);
  const libCategories = useMemo(() => {
    const s = new Set(library.map((l) => l.category || 'Other'));
    return [...s].sort();
  }, [library]);

  // ── mutators ──────────────────────────────────────────────────────────────
  const setPriority = (i, patch) => setDraft((d) => {
    const priorities = d.priorities.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    return { ...d, priorities };
  });

  function pickLibrary(i, code) {
    if (!code) { setPriority(i, { priority_code: '', name: '', primary_marker: '', kind: 'chart' }); return; }
    const lib = libByCode[code];
    if (!lib) return;
    // If the pick matches what the previous version had (same slot first, else
    // any slot), restore THAT slot's details (target/why carry over) — but the
    // value/unit/date always refresh to the latest lab reading, so a new version
    // shows the current value, not the previous version's.
    const prevSlots = (previousDraft && previousDraft.priorities) || [];
    const same = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();
    const prev = (prevSlots[i] && same(prevSlots[i].name, lib.name))
      ? prevSlots[i]
      : prevSlots.find((s) => same(s.name, lib.name));
    if (prev && prev.name) {
      const marker = lib.primary_marker_code || prev.primary_marker;
      const reading = latestReadingFor(labRows, marker);
      setPriority(i, {
        ...prev, priority_code: code, anchor: lib.default_anchor_text || prev.anchor,
        name: lib.name || prev.name, kind: lib.render_kind || prev.kind, primary_marker: marker,
        latest_value: reading ? reading.value : prev.latest_value,
        unit: reading ? reading.unit : prev.unit,
        latest_date: reading ? reading.date : prev.latest_date,
      });
      return;
    }
    // Otherwise a fresh pick: library defaults + the latest reading from labs.
    // Always reset value/unit/date to the new marker's reading (or blank) — never
    // keep the previously-picked priority's value when switching.
    const applied = applyLibraryPick(draft.priorities[i], lib);
    const reading = latestReadingFor(labRows, lib.primary_marker_code);
    setPriority(i, {
      ...applied,
      latest_value: reading ? reading.value : '',
      unit: reading ? reading.unit : '',
      latest_date: reading ? reading.date : '',
      why_text: whyLib[code] || '',   // seed the standard Why for this priority (editable)
    });
  }

  // Wizard result → fill the 3 mhx slots. Each pick brings its name, default
  // frequency, and the priorities it moves (auto Serves-links). Editable after.
  function applyHabits(picks) {
    setDraft((d) => {
      const mhx = [emptyMhx(), emptyMhx(), emptyMhx()];
      picks.slice(0, 3).forEach((p, i) => {
        mhx[i] = { ...emptyMhx(), name: p.name, frequency: p.frequency || '', linked_priorities: (p.moves || []).slice() };
      });
      return { ...d, mhx };
    });
    setWizardOpen(false);
  }
  const currentHabitIds = () => draft.mhx.filter((m) => m.name)
    .map((m) => { const h = habitCatalog.find((x) => x.microhabit_name === m.name); return h ? h.microhabit_id : null; })
    .filter((x) => x != null);
  const anyPriority = draft.priorities.some((p) => p.name);

  async function promote() {
    if (!confirm('Promote this draft to a new live strategy version? The current version becomes a past version.')) return;
    setBusy(true); setError(null);
    try {
      await promoteDraft(draft, { member_id: member, currentActiveRow });
      try { await saveNote(member, 'strategy_why', whyText.trim(), whyNoteId); } catch (e) { /* note save is non-fatal */ }
      onPromoted && onPromoted();
    } catch (e) {
      setError(e.message || 'Promote failed.');
    } finally { setBusy(false); }
  }

  // Leaving the builder without promoting: warn only if there's real content.
  function discard() {
    if (dirty && !confirm(DRAFT_LEAVE_MSG)) return;
    setDraftDirty(false);
    onCancel && onCancel();
  }

  const isNewFromScratch = !currentActiveRow;

  return (
    <div style={{ background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 18px 16px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {wizardOpen && (
        <MicrohabitWizard
          priorities={draft.priorities}
          habitCatalog={habitCatalog}
          links={habitLinks}
          initialIds={currentHabitIds()}
          onDone={applyHabits}
          onClose={() => setWizardOpen(false)}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 20, color: SLATE }}>
          {isNewFromScratch ? 'Build strategy' : 'New strategy version'}
        </div>
        <button onClick={discard} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} aria-label="Close builder">×</button>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
        This draft isn’t saved — <strong>Promote</strong> it to a strategy, or it’s discarded when you leave.
      </div>

      {/* From the Top — the member's goal statement (strategy_why note) */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>From the Top <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(the member’s goal, shown at the top of the strategy)</span></label>
        <textarea style={area} value={whyText} onChange={(e) => setWhyText(e.target.value)}
          placeholder="In their words — what brings them here, and what they want to protect…" />
      </div>

      {/* Tagline */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Tagline <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(optional sub-header — shown only when filled in)</span></label>
        <input style={input} value={draft.tagline} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
          placeholder="Two habits. Three priorities. Signal-confirmed." />
      </div>

      {/* Priorities */}
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 8 }}>Priorities</div>
      {draft.priorities.map((p, i) => (
        <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: p.name ? 12 : 0, flexWrap: 'wrap' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: SLATE, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>P{i + 1}</span>
            <select style={{ ...input, width: 'auto', flex: '0 1 230px', background: CARD }} value={p.priority_code} onChange={(e) => pickLibrary(i, e.target.value)}>
              <option value="">— pick a priority —</option>
              {libCategories.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {library.filter((l) => (l.category || 'Other') === cat)
                    .map((l) => <option key={l.priority_code} value={l.priority_code}>{l.name}</option>)}
                </optgroup>
              ))}
            </select>
            {previousDraft && previousDraft.priorities[i] && previousDraft.priorities[i].name && (
              <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                Previous: <span style={{ color: '#6b7280', fontWeight: 600 }}>{previousDraft.priorities[i].name}</span>
              </span>
            )}
          </div>

          {p.name && (<>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={lbl}>Latest value</label>
                <input style={input} value={p.latest_value} onChange={(e) => setPriority(i, { latest_value: e.target.value })} placeholder="—" />
              </div>
              <div style={{ flex: '1 1 90px' }}>
                <label style={lbl}>Unit</label>
                <input style={input} value={p.unit} onChange={(e) => setPriority(i, { unit: e.target.value })} placeholder="g/L" />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={lbl}>Date</label>
                <input style={input} value={p.latest_date} onChange={(e) => setPriority(i, { latest_date: e.target.value })} placeholder="Jan 2025" />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Target <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(the "→ …" line)</span></label>
              <input style={input} value={p.target_text} onChange={(e) => setPriority(i, { target_text: e.target.value })} placeholder="Trending → < 0.80 g/L · re-test at 3 months" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>The Why</label>
              <textarea style={area} value={p.why_text} onChange={(e) => setPriority(i, { why_text: e.target.value })} placeholder="Why this priority matters, in plain words…" />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={lbl}>Rx pill <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(optional)</span></label>
                <input style={input} value={p.rx_text} onChange={(e) => setPriority(i, { rx_text: e.target.value })} placeholder="Statin started" />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label style={lbl}>Other markers <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(name|value|optimal, one per line)</span></label>
                <textarea style={{ ...area, minHeight: 38 }} value={p.other_markers} onChange={(e) => setPriority(i, { other_markers: e.target.value })} placeholder={'Visceral fat|984 g|< 1000'} />
              </div>
            </div>
            {p.kind === 'donut' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 90px' }}><label style={lbl}>Hrs 7.8–10</label><input style={input} value={p.donut_hr78} onChange={(e) => setPriority(i, { donut_hr78: e.target.value })} placeholder="4.5" /></div>
                <div style={{ flex: '1 1 90px' }}><label style={lbl}>Hrs &gt; 10</label><input style={input} value={p.donut_hr10} onChange={(e) => setPriority(i, { donut_hr10: e.target.value })} placeholder="0.4" /></div>
                <div style={{ flex: '1 1 90px' }}><label style={lbl}>Target hr/day</label><input style={input} value={p.donut_target_hr} onChange={(e) => setPriority(i, { donut_target_hr: e.target.value })} placeholder="1" /></div>
                <div style={{ flex: '1 1 160px' }}><label style={lbl}>Next text</label><input style={input} value={p.next_text} onChange={(e) => setPriority(i, { next_text: e.target.value })} placeholder="Next CGM cycle ~May 24" /></div>
              </div>
            )}
          </>)}
        </div>
      ))}

      {/* Micro-habits (shared, ≤3) — picked via the leverage wizard */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, margin: '6px 0 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151' }}>
          Micro-habits <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>— up to three shared levers</span>
        </div>
        <button onClick={() => anyPriority && setWizardOpen(true)} disabled={!anyPriority}
          style={{ border: `1px solid ${MBH_SAGE}`, background: anyPriority ? MBH_SAGE : '#e5e7eb', color: anyPriority ? '#fff' : '#9ca3af', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: anyPriority ? 'pointer' : 'default' }}>
          ✨ Pick Micro-habits
        </button>
      </div>
      {draft.mhx.every((m) => !m.name) && (
        <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
          No habits yet — use “Pick Micro-habits” to choose the levers that move your priorities.
        </div>
      )}

      {/* Routines */}
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', margin: '6px 0 8px' }}>Routines</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 120px' }}><label style={lbl}>Sleep</label><input style={input} value={draft.routines.sleep} onChange={(e) => setDraft((d) => ({ ...d, routines: { ...d.routines, sleep: e.target.value } }))} placeholder="7–7.5 hrs" /></div>
        <div style={{ flex: '1 1 120px' }}><label style={lbl}>Strength</label><input style={input} value={draft.routines.strength} onChange={(e) => setDraft((d) => ({ ...d, routines: { ...d.routines, strength: e.target.value } }))} placeholder="2–3 / 7" /></div>
        <div style={{ flex: '1 1 120px' }}><label style={lbl}>Cardio</label><input style={input} value={draft.routines.cardio} onChange={(e) => setDraft((d) => ({ ...d, routines: { ...d.routines, cardio: e.target.value } }))} placeholder="> 250 min/wk" /></div>
      </div>

      {/* Strategy elements */}
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', margin: '6px 0 8px' }}>
        Strategy elements <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>— one item per line</span>
      </div>
      {[['sx', 'Medically-directed supplements'], ['lx', 'Lifestyle advice'], ['sm', 'Member-elected supplements'], ['rx', 'Prescriptions']].map(([k, title]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <label style={lbl}>{title}</label>
          <textarea style={{ ...area, minHeight: 40 }} value={draft.elements[`${k}_items`]}
            onChange={(e) => setDraft((d) => ({ ...d, elements: { ...d.elements, [`${k}_items`]: e.target.value } }))}
            placeholder={k === 'rx' ? 'None current' : ''} />
        </div>
      ))}

      {/* Footer */}
      {error && <div style={{ color: SOFT_RED, fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
        <button onClick={discard} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Discard</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={promote} disabled={busy}
            style={{ border: 'none', background: busy ? '#e5e7eb' : MBH_SAGE, color: busy ? '#9ca3af' : '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Promoting…' : 'Promote →'}
          </button>
        </div>
      </div>
    </div>
  );
}
