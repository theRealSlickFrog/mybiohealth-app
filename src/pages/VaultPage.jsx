// MyVault — documents + message log. Hardcoded for v1; live wiring in Phase B.
import { useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER_BG, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';

const FILES = {
  labs: [
    { name: 'Blood Draw — Jan 28, 2025', date: 'Jan 28, 2025', lab: 'Mount Sinai Hospital', type: 'PDF' },
    { name: 'Blood Draw — Feb 8, 2021', date: 'Feb 8, 2021', lab: 'Cleveland Clinic', type: 'PDF' },
  ],
  dexa: [{ name: 'DEXA Scan — April 24, 2026', date: 'Apr 24, 2026', lab: 'MBH Scan Centre', type: 'PDF' }],
  cgm: [
    { name: 'CGM Cycle 1 — April 2026', date: 'Apr 10–24, 2026', lab: 'Libre · 14-day', type: 'CSV' },
    { name: 'CGM Cycle 1 — Report', date: 'Apr 24, 2026', lab: 'MBH Analysis', type: 'PDF' },
  ],
  other: [{ name: 'Fibroscan Report — 2024', date: '2024', lab: 'Liver Imaging', type: 'PDF' }],
};

const MESSAGES = [
  { from: 'MBH', text: 'Your DEXA results are ready. Scan summary has been added to your dashboard.', date: 'Apr 24, 2026' },
  { from: 'Member', text: 'When should I schedule my next blood draw?', date: 'Apr 20, 2026' },
  { from: 'MBH', text: 'Based on your MyStrategy renewal on May 24, we recommend scheduling your draw in early June — ideally 14 days before your next CGM cycle.', date: 'Apr 20, 2026' },
];

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState('labs');
  const tabs = [{ key: 'labs', label: 'Labs' }, { key: 'dexa', label: 'DEXA Reports' }, { key: 'cgm', label: 'CGM' }, { key: 'other', label: 'Other' }];

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>MyVault</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Your documents — private and secure</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
            background: activeTab === t.key ? SLATE : 'transparent',
            color: activeTab === t.key ? 'white' : '#374151',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
        {(FILES[activeTab] || []).map((f, i, arr) => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: f.type === 'CSV' ? SAGE_BG : AMBER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>{f.type === 'CSV' ? '📊' : '📄'}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: SLATE, marginBottom: 2 }}>{f.name}</div>
              <div style={{ fontSize: 11, color: '#374151' }}>{f.date} · {f.lab} · {f.type}</div>
            </div>
            <button style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', cursor: 'pointer', flexShrink: 0 }}>View</button>
          </div>
        ))}
      </div>

      <button style={{ width: '100%', background: SAGE_BG, border: `1.5px dashed ${MBH_SAGE}40`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <span style={{ fontSize: 24 }}>⬆️</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: MBH_SAGE }}>Upload a document</span>
        <span style={{ fontSize: 11, color: '#374151' }}>PDF, CSV, images — any format</span>
      </button>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 10 }}>Message Log</div>
        <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {MESSAGES.map((m, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.from === 'MBH' ? MBH_SAGE : SLATE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'white' }}>
                {m.from === 'MBH' ? 'M' : 'Me'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: m.from === 'MBH' ? MBH_SAGE : SLATE }}>{m.from === 'MBH' ? 'MyBioHealth' : 'You'}</span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{m.date}</span>
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>{m.text}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <input placeholder="Send a message to MBH…" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '9px 16px', fontSize: 13, color: SLATE, background: OFFWHITE, outline: 'none' }} />
            <button style={{ background: MBH_SAGE, border: 'none', borderRadius: 20, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
