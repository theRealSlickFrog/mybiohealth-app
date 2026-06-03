// Reusable per-page personal note ("MyNote"). Drop <PersonalNote noteKey="..."/>
// on any page; it loads/saves the member's note for that page via lib/notes.js.
import { useEffect, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, CARD, BORDER, OFFWHITE, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';
import { loadNote, saveNote } from '../lib/notes.js';

export default function PersonalNote({ noteKey }) {
  const [note, setNote] = useState({ id: null, text: '', loaded: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const member = getStoredGuid() || DEV_MEMBER;

  useEffect(() => {
    let cancelled = false;
    loadNote(member, noteKey)
      .then((n) => { if (!cancelled) setNote({ id: n.id, text: n.text, loaded: true }); })
      .catch((e) => { if (!cancelled) { setNote((s) => ({ ...s, loaded: true })); setError(e.message); } });
    return () => { cancelled = true; };
  }, [noteKey]);

  const startEdit = () => { setDraft(note.text); setError(null); setEditing(true); };
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const text = draft.trim();
      const id = await saveNote(member, noteKey, text, note.id);
      setNote((s) => ({ ...s, id: id ?? s.id, text }));
      setEditing(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const btn = (primary) => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: primary ? 'none' : `1px solid ${BORDER}`,
    background: primary ? MBH_SAGE : 'transparent',
    color: primary ? 'white' : '#5e564b',
  });

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: MBH_SAGE }}>
          <em style={{ fontStyle: 'normal' }}>My</em>Note
        </div>
        {!editing && note.loaded && (
          <button onClick={startEdit} style={{ background: SAGE_BG, color: SAGE_TEXT, border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {note.text ? 'Edit' : '+ Add note'}
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            placeholder="Write a personal note for this page…"
            style={{ width: '100%', minHeight: 90, boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: SLATE, resize: 'vertical', outline: 'none', background: OFFWHITE }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setEditing(false)} disabled={saving} style={btn(false)}>Cancel</button>
            <button onClick={save} disabled={saving} style={btn(true)}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {note.text
            ? <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.text}</div>
            : <div style={{ fontSize: 12.5, color: '#9ca3af', fontStyle: 'italic' }}>{note.loaded ? 'No note yet — add a personal note for this page.' : 'Loading…'}</div>}
        </div>
      )}

      {error && <div style={{ fontSize: 11, color: SOFT_RED, marginTop: 8 }}>Couldn’t save your note ({error}). Try again.</div>}
    </div>
  );
}
