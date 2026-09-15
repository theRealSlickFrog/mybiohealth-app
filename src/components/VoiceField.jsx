// A labelled card around a dictating textarea — the test screen's presentation.
//
// The dictation itself, and the corrections list that goes with it, live in
// VoiceTextarea so the real pages can drop them into their own layouts. What is
// left here is the card, the label and the hint, which only the test screen
// wants.

import { BORDER, CARD, SLATE } from '../lib/constants.js';
import VoiceTextarea from './VoiceTextarea.jsx';

export default function VoiceField({ label, hint, value, onChange, rows = 5 }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: SLATE, marginBottom: 2 }}>{label}</label>
      {hint && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>}
      <VoiceTextarea
        label={`"${label}"`}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder="Type here, or use the microphone"
        style={{
          width: '100%', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.6,
          color: SLATE, padding: '10px 12px', border: `1px solid ${BORDER}`,
          borderRadius: 8, background: '#fff', resize: 'vertical', outline: 'none',
        }}
      />
    </div>
  );
}
