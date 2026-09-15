// Voice input test screen.
//
// A place for the client to try dictation against their own marker set and
// report back what it still gets wrong. The three fields mirror the real
// MyStrategy use case — reasoning, the note to the physician, and
// prescriptions/supplements — because term accuracy depends on what is being
// dictated, and a generic scratch box would not surface the same failures.
//
// The vocabulary is the member's own markers, fetched at runtime and shared
// with every other dictation field in the app (see lib/useVocabulary.js). It is
// never hardcoded: the marker set is per-member and server-driven, so a
// baked-in list would be stale for everyone and wrong for some. The built-in
// fallback exists only so the page still demonstrates the idea when the fetch
// fails.

import { useState } from 'react';
import { AMBER, AMBER_BG, AMBER_TEXT, BORDER, CARD, SLATE, TEAL } from '../lib/constants.js';
import useVocabulary from '../lib/useVocabulary.js';
import VoiceField from '../components/VoiceField.jsx';

const TRY_LINES = [
  '"ApoB one point four, visceral fat two point seven kilograms."',
  '"HbA1c five point six, eGFR ninety two."',
  '"Vitamin D five thousand international units daily."',
  '"DEXA showed no anterior infarct."',
];

export default function VoiceTestPage() {
  const { vocabulary, usingFallback } = useVocabulary();

  const [reasoning, setReasoning] = useState('');
  const [physicianNote, setPhysicianNote] = useState('');
  const [prescriptions, setPrescriptions] = useState('');

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>
        Voice Input Test
      </h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 18 }}>
        Dictation with biomarker term correction · a test screen, nothing here is saved
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.65, color: '#374151' }}>
        <p style={{ margin: '0 0 10px' }}>
          Dictate into the fields below exactly the way you normally would — same pace, same
          wording, no special effort to enunciate. Speech recognition gets numbers right but
          mangles biomarker names, so this corrects them against your own marker list and
          shows you every change it made.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          <strong>Please check each correction.</strong> Every change appears under the field
          as "was → now" with an Undo. Some mistakes still read as perfectly normal English —
          "international units" coming back as "internal units" — so they are easy to miss on
          a quick read. Anything it gets wrong, or any term it should know and doesn't, please
          report back.
        </p>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Things to try
          </div>
          {TRY_LINES.map((line) => (
            <div key={line} style={{ color: TEAL, marginBottom: 3 }}>{line}</div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11.5, color: '#6b7280' }}>
          Chrome or Edge only. The microphone needs the page served over https or localhost.
          {vocabulary && ` Vocabulary loaded: ${vocabulary.length} terms${usingFallback ? ' (built-in fallback)' : ' from your marker set'}.`}
        </div>
      </div>

      {usingFallback && (
        <div style={{ background: AMBER_BG, border: `1px solid ${AMBER}`, borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: AMBER_TEXT, lineHeight: 1.6, marginBottom: 16 }}>
          Couldn't load your marker list, so correction is running on the built-in fallback
          vocabulary. Terms specific to you may not be recognised. If you're viewing this
          locally, the data proxy only allows the deployed origins.
        </div>
      )}

      <VoiceField
        label="Why this priority matters to me"
        hint="The reasoning you'd want your physician to understand."
        value={reasoning}
        onChange={setReasoning}
        rows={5}
      />

      <VoiceField
        label="Note to my physician"
        hint="Anything you want raised at the next consultation."
        value={physicianNote}
        onChange={setPhysicianNote}
        rows={5}
      />

      <VoiceField
        label="Prescriptions & supplements"
        hint="Names, doses and units — this is where wrong units matter most, so read the corrections carefully."
        value={prescriptions}
        onChange={setPrescriptions}
        rows={4}
      />
    </div>
  );
}
