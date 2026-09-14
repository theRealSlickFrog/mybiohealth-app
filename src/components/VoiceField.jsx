// A textarea with dictation, plus the record of what dictation changed.
//
// The corrections list is the point of this component, not a decoration. The
// correction layer can be wrong — "international units" mis-heard as "internal
// units" still reads as ordinary English, so a user proof-reading their own
// note skims straight past it. Showing every substitution as "was → now" with
// its own undo is what makes that recoverable.

import { useCallback, useRef } from 'react';
import { BORDER, CARD, GAP_TEXT, MBH_SAGE, OFFWHITE, SLATE, SOFT_RED, TEAL } from '../lib/constants.js';
import useVoiceInput from '../lib/useVoiceInput.js';

function MicIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, fill: 'currentColor', display: 'block' }} aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11Z" />
    </svg>
  );
}

export default function VoiceField({ label, hint, value, onChange, vocabulary, rows = 5 }) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const getBaseText = useCallback(() => valueRef.current || '', []);
  const { listening, toggle, changes, error, supported, dropChange } =
    useVoiceInput({ vocabulary, onText: onChange, getBaseText });

  // Undo rewrites the corrected term back to what was actually heard. Only the
  // first occurrence goes back: the same term may have been dictated more than
  // once and the user is undoing this row, not every instance of the word.
  const undo = (change, index) => {
    const current = valueRef.current || '';
    const at = current.indexOf(change.to);
    if (at !== -1) {
      onChange(current.slice(0, at) + change.from + current.slice(at + change.to.length));
    }
    dropChange(index);
  };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: SLATE, marginBottom: 2 }}>{label}</label>
      {hint && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder="Type here, or use the microphone"
          style={{
            flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.6,
            color: SLATE, padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 8,
            background: '#fff', resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={toggle}
          disabled={!supported}
          title={supported ? (listening ? 'Stop dictating' : 'Dictate this field') : 'Dictation needs Chrome or Edge'}
          aria-label={listening ? 'Stop dictating' : 'Dictate this field'}
          aria-pressed={listening}
          style={{
            flex: '0 0 auto', width: 42, height: 42, borderRadius: 8, cursor: supported ? 'pointer' : 'not-allowed',
            display: 'grid', placeItems: 'center', opacity: supported ? 1 : 0.4,
            border: `1px solid ${listening ? SOFT_RED : BORDER}`,
            background: listening ? SOFT_RED : '#fff',
            color: listening ? '#fff' : TEAL,
          }}
        >
          <MicIcon />
        </button>
      </div>

      <div style={{ minHeight: 18, marginTop: 7, fontSize: 12 }}>
        {listening && <span style={{ color: SOFT_RED, fontWeight: 600 }}>● Listening — tap the microphone again to stop</span>}
        {!listening && error && <span style={{ color: SOFT_RED }}>{error}</span>}
      </div>

      {changes.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: GAP_TEXT, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>
            Corrections made ({changes.length})
          </div>
          {changes.map((c, i) => (
            <div key={`${c.from}-${c.to}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, padding: '4px 0' }}>
              <span style={{ color: '#9aa2b4', textDecoration: 'line-through' }}>{c.from}</span>
              <span style={{ color: '#c3c9d6' }}>→</span>
              <span style={{ color: MBH_SAGE, fontWeight: 600 }}>{c.to}</span>
              <button
                type="button"
                onClick={() => undo(c, i)}
                style={{
                  marginLeft: 'auto', fontFamily: 'inherit', fontSize: 11.5, cursor: 'pointer',
                  border: `1px solid ${BORDER}`, background: OFFWHITE, color: '#6b7280',
                  padding: '2px 9px', borderRadius: 5,
                }}
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
