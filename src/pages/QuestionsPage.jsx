// Questions & Suggestions — submit + log. Stays hardcoded until backend table exists.
import { useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER_BG, AMBER_TEXT, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const LOG = [
  { type: 'question', text: 'Is there a way to track my supplement intake in the app?', date: 'Apr 15, 2026', status: 'Received' },
  { type: 'suggest', text: "I'd love a Health Literacy page on sleep and glucose.", date: 'Apr 10, 2026', status: 'Noted — on the list' },
];

export default function QuestionsPage() {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState('suggest');

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>Questions &amp; Suggestions</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Your voice to MBH — questions, ideas, topic requests</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[{ key: 'suggest', label: 'Suggest a topic' }, { key: 'question', label: 'Ask a question' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
            background: tab === t.key ? SLATE : 'transparent',
            color: tab === t.key ? 'white' : '#374151',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: SLATE, marginBottom: 10 }}>
          {tab === 'suggest' ? 'Suggest a Health Literacy topic' : 'Ask MBH a question'}
        </div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setSent(false); }}
          placeholder={tab === 'suggest' ? "What would you like explained? e.g. 'Why does sleep affect glucose?'" : "What's on your mind?"}
          style={{ width: '100%', minHeight: 80, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: SLATE, background: OFFWHITE, resize: 'vertical', lineHeight: 1.55, outline: 'none', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          {sent && <span style={{ fontSize: 11, color: MBH_SAGE, marginRight: 10, alignSelf: 'center' }}>Sent ✓</span>}
          <button onClick={() => { if (text.trim()) { setSent(true); setText(''); } }}
            style={{ background: SLATE, border: 'none', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer' }}>
            Send to MBH
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10 }}>Your Log</div>
      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {LOG.map((l, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: i < LOG.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ background: l.type === 'suggest' ? SAGE_BG : AMBER_BG, color: l.type === 'suggest' ? SAGE_TEXT : AMBER_TEXT, fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                {l.type === 'suggest' ? 'Topic suggestion' : 'Question'}
              </span>
              <span style={{ fontSize: 12, color: '#374151' }}>{l.date}</span>
            </div>
            <div style={{ fontSize: 13, color: SLATE, lineHeight: 1.55, marginBottom: 4 }}>{l.text}</div>
            <div style={{ fontSize: 11, color: MBH_SAGE, fontWeight: 500 }}>↳ {l.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
