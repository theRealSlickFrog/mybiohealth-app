// A textarea that can be dictated into, sized and styled entirely by its caller.
//
// The microphone sits inside the field's own top-right corner rather than in a
// column beside it. These fields are scattered across pages that already have
// their own layouts — a dark panel on MyStrategy, a two-column builder, a 38px
// note box — and a mic in its own column would have to be re-fitted at every
// one of them. Top-right and not bottom-right because `resize: vertical` puts
// the browser's drag grip in the bottom-right.
//
// The corrections list below the field is the point of this component, not a
// decoration. The correction layer can be wrong — "international units"
// misheard as "internal units" still reads as ordinary English, so someone
// proof-reading their own note skims straight past it. Showing every
// substitution as "was -> now" with its own undo is what makes that
// recoverable.

import { useCallback, useRef } from 'react';
import { BORDER, GAP_TEXT, MBH_SAGE, OFFWHITE, SOFT_RED, TEAL } from '../lib/constants.js';
import useVoiceInput from '../lib/useVoiceInput.js';
import useVocabulary from '../lib/useVocabulary.js';

function MicIcon({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, fill: 'currentColor', display: 'block' }} aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11Z" />
    </svg>
  );
}

// Room kept clear on the right of every field so dictated text never runs under
// the microphone.
const MIC = 26;
const MIC_INSET = 6;
const TEXT_GUTTER = MIC + MIC_INSET * 2;

/**
 * @param {string}   label  What is being dictated, for the button's accessible
 *                          name — "Dictate the Member Note", not "Dictate".
 * @param {boolean}  dark   For fields on a dark panel (WhyImHere).
 */
export default function VoiceTextarea({
  value, onChange, label, style, className, placeholder, rows, autoFocus = false, dark = false,
}) {
  const { vocabulary } = useVocabulary();

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

  const idle = dark
    ? { border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff' }
    : { border: `1px solid ${BORDER}`, background: '#fff', color: TEAL };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        autoFocus={autoFocus}
        className={className}
        placeholder={placeholder}
        // boxSizing first so a caller's own style still wins; paddingRight last
        // because it must survive a caller's `padding` shorthand.
        style={{ display: 'block', boxSizing: 'border-box', ...style, paddingRight: TEXT_GUTTER }}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        title={supported
          ? (listening ? 'Stop dictating' : `Dictate ${label}`)
          : 'Dictation needs Chrome or Edge'}
        aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
        aria-pressed={listening}
        style={{
          position: 'absolute', top: MIC_INSET, right: MIC_INSET,
          width: MIC, height: MIC, borderRadius: 6, padding: 0,
          display: 'grid', placeItems: 'center',
          cursor: supported ? 'pointer' : 'not-allowed',
          opacity: supported ? 1 : 0.35,
          ...(listening
            ? { border: `1px solid ${SOFT_RED}`, background: SOFT_RED, color: '#fff' }
            : idle),
        }}
      >
        <MicIcon />
      </button>

      {(listening || error) && (
        <div style={{ fontSize: 11.5, marginTop: 5, lineHeight: 1.45, color: SOFT_RED }}>
          {listening
            ? <span style={{ fontWeight: 600 }}>&#9679; Listening &mdash; tap the microphone again to stop</span>
            : error}
        </div>
      )}

      {changes.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : BORDER}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, color: dark ? 'rgba(255,255,255,0.65)' : GAP_TEXT }}>
            Corrections made ({changes.length})
          </div>
          {changes.map((c, i) => (
            <div key={`${c.from}-${c.to}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12, padding: '3px 0' }}>
              <span style={{ color: dark ? 'rgba(255,255,255,0.45)' : '#9aa2b4', textDecoration: 'line-through' }}>{c.from}</span>
              <span style={{ color: dark ? 'rgba(255,255,255,0.3)' : '#c3c9d6' }}>&rarr;</span>
              <span style={{ color: dark ? '#fff' : MBH_SAGE, fontWeight: 600 }}>{c.to}</span>
              <button
                type="button"
                onClick={() => undo(c, i)}
                style={{
                  marginLeft: 'auto', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
                  padding: '2px 8px', borderRadius: 5,
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.25)' : BORDER}`,
                  background: dark ? 'transparent' : OFFWHITE,
                  color: dark ? 'rgba(255,255,255,0.8)' : '#6b7280',
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
