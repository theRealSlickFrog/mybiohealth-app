// CarryOverChooser — shown when starting a NEW strategy while one already exists.
// Lets the admin opt in (all unticked by default) to carrying individual pieces
// of the current strategy forward: From the Top, each priority, each micro-habit,
// tagline, routines, and strategy elements. Returns the set of chosen keys; the
// caller (MyStrategyPage) builds the seed draft from them.
import { useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const SERIF = "'DM Serif Display',serif";

export default function CarryOverChooser({ activeRow, carryNote, onStart, onCancel }) {
  const [sel, setSel] = useState(() => new Set());
  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const row = activeRow || {};
  // Build the list of carryable items, only including what the old strategy has.
  const groups = [];

  if (carryNote && carryNote.trim()) {
    groups.push({ title: 'From the Top', items: [{ key: 'fromtop', label: 'Carry the discussion', sub: carryNote.trim().slice(0, 90) + (carryNote.trim().length > 90 ? '…' : '') }] });
  }

  const prioItems = [1, 2, 3]
    .filter((n) => row[`p${n}_name`])
    .map((n) => ({ key: `p${n}`, label: row[`p${n}_name`], sub: row[`p${n}_anchor`] || '' }));
  if (prioItems.length) groups.push({ title: 'Priorities', items: prioItems });

  const mhxItems = [1, 2, 3]
    .filter((n) => row[`mhx${n}_name`])
    .map((n) => ({ key: `m${n}`, label: row[`mhx${n}_name`], sub: row[`mhx${n}_frequency`] || '' }));
  if (mhxItems.length) groups.push({ title: 'Micro-habits', items: mhxItems });

  const other = [];
  if (row.tagline) other.push({ key: 'tagline', label: 'Tagline', sub: row.tagline });
  if (row.routine_sleep || row.routine_strength || row.routine_cardio) {
    other.push({ key: 'routines', label: 'Routines', sub: [row.routine_sleep, row.routine_strength, row.routine_cardio].filter(Boolean).join(' · ') });
  }
  if (row.sx_items || row.lx_items || row.sm_items || row.rx_items) {
    other.push({ key: 'elements', label: 'Strategy elements', sub: 'Supplements, lifestyle, prescriptions…' });
  }
  if (other.length) groups.push({ title: 'Other', items: other });

  const nothingToCarry = groups.length === 0;

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: OFFWHITE, borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>

        <div style={{ background: SLATE, padding: '16px 20px' }}>
          <div style={{ color: '#fff', fontFamily: SERIF, fontSize: 18 }}>New <em style={{ fontStyle: 'italic' }}>My</em>Strategy</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 }}>Carry anything over from your current strategy?</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 18px' }}>
          {nothingToCarry ? (
            <div style={{ fontSize: 13, color: '#6b7280', padding: '10px 0' }}>Nothing to carry over — you’ll start with a clean slate.</div>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: '#6b7280', margin: '0 0 14px' }}>
                You’re creating a new <em style={{ fontStyle: 'italic' }}>My</em>Strategy. You can copy elements from your current strategy into it — tick the ones to bring across below. Anything you leave unticked starts fresh.
                <span style={{ display: 'block', marginTop: 6, color: '#9ca3af' }}>Carried priorities pull your latest lab value.</span>
              </p>
              {groups.map((g) => (
                <div key={g.title} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>{g.title}</div>
                  {g.items.map((it) => {
                    const on = sel.has(it.key);
                    return (
                      <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, border: `1px solid ${on ? MBH_SAGE : BORDER}`, background: on ? SAGE_BG : CARD, marginBottom: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(it.key)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13.5, color: SLATE, fontWeight: on ? 600 : 500 }}>{it.label}</span>
                          {it.sub && <span style={{ display: 'block', fontSize: 11.5, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: CARD }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!nothingToCarry && <span style={{ fontSize: 12, color: '#6b7280' }}>{sel.size} selected</span>}
            <button onClick={() => onStart(sel)} style={{ border: 'none', background: MBH_SAGE, color: '#fff', borderRadius: 20, padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Start new strategy →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
