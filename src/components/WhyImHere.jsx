// "Why I'm here" — the member's free-form goal statement at the top of
// MyStrategy. Heading + caption are fixed copy (from system_parm, passed in);
// the body in between is the member's editable note, stored exactly like the
// other notes (member_info, feature='PAGE_NOTE', key 'strategy_why').
import { useEffect, useState } from 'react';
import { SLATE, MBH_SAGE, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';
import { loadNote, saveNote } from '../lib/notes.js';

const NOTE_KEY = 'strategy_why';
const SERIF = "'DM Serif Display',serif";

export default function WhyImHere({ heading, caption }) {
  const [note, setNote] = useState({ id: null, text: '', loaded: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const member = getStoredGuid() || DEV_MEMBER;

  useEffect(() => {
    let cancelled = false;
    loadNote(member, NOTE_KEY)
      .then((n) => { if (!cancelled) setNote({ id: n.id, text: n.text, loaded: true }); })
      .catch((e) => { if (!cancelled) { setNote((s) => ({ ...s, loaded: true })); setError(e.message); } });
    return () => { cancelled = true; };
  }, []);

  const startEdit = () => { setDraft(note.text); setError(null); setEditing(true); };
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const text = draft.trim();
      const id = await saveNote(member, NOTE_KEY, text, note.id);
      setNote((s) => ({ ...s, id: id ?? s.id, text }));
      setEditing(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: SLATE, borderRadius: 16, padding: 22, margin: '16px 0 20px', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'rgba(255,255,255,.5)' }}>{heading}</div>
        {!editing && note.loaded && (
          <button onClick={startEdit} style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {note.text ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            placeholder="In your words — what brings you here, and what you want to protect…"
            style={{ width: '100%', minHeight: 130, boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '12px 14px', fontFamily: SERIF, fontSize: 16, lineHeight: 1.55, color: '#fff', background: 'rgba(255,255,255,.06)', resize: 'vertical', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => setEditing(false)} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,255,255,.25)', background: 'transparent', color: 'rgba(255,255,255,.8)' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: MBH_SAGE, color: '#fff' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (<>
        {note.text
          ? <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.55, color: '#fff' }}>{note.text}</p>
          : <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.55, color: 'rgba(255,255,255,.5)' }}>{note.loaded ? 'Add a few words about what brings you here.' : 'Loading…'}</p>}
        {caption && <div style={{ fontSize: 11, color: '#fff', fontStyle: 'italic', marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.15)' }}>{caption}</div>}
      </>)}

      {error && <div style={{ fontSize: 11, color: SOFT_RED, marginTop: 8 }}>Couldn’t save your note ({error}). Try again.</div>}
    </div>
  );
}
