// BioSignals — primary biomarkers, vitals, structural. Mostly hardcoded for v1.
// Data wiring (live values from report_ready_result + member_info) comes in a follow-up commit.
import { useState } from 'react';
import { MBH_SAGE, AMBER, SAGE_TEXT, SLATE, OFFWHITE, CARD, BORDER, SOFT_RED } from '../lib/constants.js';
import OptimalDrawer from '../components/OptimalDrawer.jsx';
import SignalRow from '../components/SignalRow.jsx';

const PRIMARY = [
  { category: 'Metabolic Health', label: 'Insulin & Glucose Balance', signals: [
    { name: 'HOMA-IR', latest: null, unit: '', optimal: '< 1.8', status: 'estimated', trendDir: 'none', mhx: 'One glucose rest',
      note: 'Estimated optimal. Fasting glucose 5.4, HbA1c 5.6. Add fasting insulin to next draw.', history: [],
      subs: [
        { name: 'Fasting Insulin', latest: null, unit: 'µIU/mL', optimal: '< 8', status: 'gap', trendDir: 'none' },
        { name: 'Fasting Glucose', latest: '5.4', unit: 'mmol/L', optimal: '< 5.5', status: 'optimal', trendDir: 'down' },
        { name: 'HbA1c', latest: '5.6', unit: '%', optimal: '< 5.7', status: 'optimal', trendDir: 'down' },
      ],
    },
  ]},
  { category: 'Cardiovascular Health', label: 'Atherogenic Particle Burden', signals: [
    { name: 'ApoB', latest: '1.10', unit: 'g/L', optimal: '< 0.80', status: 'drift', trendDir: 'flat', mhx: 'One glucose rest',
      note: 'Drift zone ceiling, trending flat. Lp(a) is the logical next step.',
      history: [{ date: 'Mar 2019', value: '1.04' }, { date: 'Feb 2021', value: '1.13' }, { date: 'Jan 2025', value: '1.10' }],
      chartConfig: { optimalMax: 0.80, driftMax: 1.10, driftMin: 0, optimalMin: 0, higherIsBetter: false },
      subs: [
        { name: 'TG/HDL Ratio', latest: '0.60', unit: '', optimal: '< 0.87', status: 'optimal', trendDir: 'down' },
        { name: 'Non-HDL', latest: '3.3', unit: 'mmol/L', optimal: '< 3.4', status: 'optimal', trendDir: 'flat' },
        { name: 'Triglycerides', latest: '0.82', unit: 'mmol/L', optimal: '< 1.7', status: 'optimal', trendDir: 'down' },
        { name: 'Lp(a)', latest: null, unit: 'nmol/L', optimal: '< 75', status: 'gap', trendDir: 'none' },
      ],
    },
  ]},
  { category: 'Liver Health', label: 'Metabolic Liver Stress', signals: [
    { name: 'GGT', latest: '52', unit: 'U/L', optimal: '< 25', status: 'priority', trendDir: 'down', mhx: 'One glucose rest',
      note: 'Elevated but trending down: 87→70→59→52. Reduce TAR first.',
      history: [{ date: 'Mar 2017', value: '50' }, { date: 'Mar 2019', value: '70' }, { date: 'Feb 2021', value: '59' }, { date: 'Jan 2025', value: '52' }],
      chartConfig: { optimalMax: 25, driftMax: 40, driftMin: 0, optimalMin: 0, higherIsBetter: false },
      subs: [
        { name: 'ALT', latest: '29', unit: 'U/L', optimal: '< 25', status: 'watch', trendDir: 'down' },
        { name: 'AST', latest: null, unit: 'U/L', optimal: '< 30', status: 'gap', trendDir: 'none' },
      ],
    },
  ]},
  { category: 'Inflammation', label: 'Systemic Inflammatory Load', signals: [
    { name: 'hs-CRP', latest: '0.90', unit: 'mg/L', optimal: '< 1.0', status: 'optimal', trendDir: 'down',
      note: 'Now optimal. 1.5→1.4→1.1→0.9. Rules out inflammation as ApoB driver.',
      history: [{ date: 'Mar 2015', value: '1.50' }, { date: 'Mar 2019', value: '1.40' }, { date: 'Feb 2021', value: '1.10' }, { date: 'Jan 2025', value: '0.90' }],
      chartConfig: { optimalMax: 1.0, driftMax: 2.0, driftMin: 0, optimalMin: 0, higherIsBetter: false },
      subs: [],
    },
  ]},
  { category: 'Kidney Health', label: 'Filtration & Function', signals: [
    { name: 'eGFR', latest: '> 60', unit: 'mL/min/1.73m²', optimal: '> 90', status: 'gap', trendDir: 'none',
      note: 'MDRD GFR Estimate, Mount Sinai Jan 2025. Reported as > 60 — exact value masked by lab. KDIGO healthy reference group is 90–104. Add exact value to next draw to confirm against optimal.',
      history: [],
      subs: [
        { name: 'Creatinine Plasma', latest: '87', unit: 'µmol/L', optimal: '55–105', status: 'optimal', trendDir: 'none' },
        { name: 'UACR', latest: null, unit: 'mg/mmol', optimal: '< 2.0', status: 'gap', trendDir: 'none' },
      ],
    },
  ]},
  { category: 'Nutrition & Resilience', label: '', signals: [
    { name: 'Albumin', latest: '43.2', unit: 'g/L', optimal: '42–53', status: 'optimal', trendDir: 'flat',
      note: 'Optimal and stable. Consistent with good protein status and training load.',
      history: [{ date: 'Mar 2017', value: '42.9' }, { date: 'Mar 2019', value: '43.7' }, { date: 'Feb 2021', value: '41.5' }, { date: 'Jan 2025', value: '43.2' }],
      chartConfig: { optimalMin: 42, optimalMax: 53, driftMin: 35, driftMax: 42, higherIsBetter: false },
      subs: [
        { name: 'Vitamin D', latest: '108', unit: 'nmol/L', optimal: '75–150', status: 'optimal', trendDir: 'up' },
        { name: 'Vitamin B12', latest: '320', unit: 'pmol/L', optimal: '300–600', status: 'optimal', trendDir: 'up' },
      ],
    },
  ]},
];

const VITALS = [{ category: 'Vitals', label: 'Cycle-based averages', signals: [
  { name: 'Blood Pressure', latest: '—', unit: '', optimal: '< 120/80', status: 'gap', trendDir: 'none', note: '2–3 drugstore reads per CGM cycle.', history: [], subs: [] },
  { name: 'Resting Heart Rate', latest: '65', unit: 'bpm', optimal: '50–60', status: 'watch', trendDir: 'flat', note: 'At 65 bpm, just above optimal. Training load should bring this lower over time.', history: [], subs: [] },
  { name: 'Sleep Duration', latest: '7–7.5', unit: 'hrs', optimal: '7–8', status: 'optimal', trendDir: 'flat', note: 'Consistent. Within optimal range.', history: [], subs: [] },
  { name: 'Active Minutes', latest: '> 250', unit: 'min/wk', optimal: '> 250', status: 'optimal', trendDir: 'flat', note: 'Active minutes comfortably exceed the 250 min/week threshold.', history: [], subs: [] },
]}];

const STRUCTURAL = [{ category: 'Structural', label: 'DEXA · April 24, 2026', signals: [
  { name: 'Lean Mass Index', latest: '17.84', unit: 'kg/m²', optimal: 'Increase', status: 'optimal', trendDir: 'up', note: 'Optimal for training load.', history: [], subs: [] },
  { name: 'Visceral Fat', latest: '984', unit: 'g', optimal: 'Decrease', status: 'optimal', trendDir: 'down', note: 'Optimal. Not the driver of ApoB signal.', history: [], subs: [] },
  { name: 'Bone Mineral Density', latest: '1.29', unit: 'g/cm²', optimal: 'Maintain', status: 'optimal', trendDir: 'flat', note: 'Normal-to-good. Training load is the maintenance lever.', history: [], subs: [] },
]}];

export default function BioSignalsPage() {
  const [activeTab, setActiveTab] = useState('primary');
  const [openOptimal, setOpenOptimal] = useState(null);
  const tabs = [{ key: 'primary', label: 'Primary' }, { key: 'vitals', label: 'Vitals' }, { key: 'structural', label: 'Structural' }];
  const groups = activeTab === 'primary' ? PRIMARY : activeTab === 'vitals' ? VITALS : STRUCTURAL;

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      {openOptimal && <OptimalDrawer signalName={openOptimal} onClose={() => setOpenOptimal(null)} />}
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>BioSignals</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 18 }}>Signal Registry · Jan 2025 draw · tap any signal to expand</div>

      <div style={{ background: '#fff7ed', borderRadius: 12, padding: '14px 18px', marginBottom: 16, borderLeft: `3px solid ${AMBER}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: AMBER, marginBottom: 8 }}>Active Priorities</div>
        {[{ n: 1, signal: 'TAR', value: '4.9 hrs/day', optimal: '< 1' }, { n: 2, signal: 'GGT', value: '52 U/L', optimal: '< 25' }, { n: 3, signal: 'ApoB', value: '1.10 g/L', optimal: '< 0.80' }].map((p) => (
          <div key={p.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: SLATE, color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{p.n}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>
                {p.signal} <span style={{ fontFamily: 'monospace', fontWeight: 400, color: '#374151', fontSize: 12 }}>· {p.value} → {p.optimal}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{ fontSize: 11 }}>🌱</span>
                <span style={{ fontSize: 11, color: SAGE_TEXT }}>One glucose rest</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
            background: activeTab === t.key ? SLATE : 'transparent',
            color: activeTab === t.key ? 'white' : '#374151',
          }}>{t.label}</button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.category} style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 2 }}>{g.category}</div>
          {g.label && <div style={{ fontSize: 11, color: '#374151', marginBottom: 12, fontStyle: 'italic' }}>{g.label}</div>}
          {g.signals.map((s, i) => (
            <SignalRow key={s.name} signal={s} isLast={i === g.signals.length - 1} onOpenOptimal={setOpenOptimal} />
          ))}
        </div>
      ))}

      <div style={{ background: SLATE, borderRadius: 14, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Next Draw</div>
        {[
          { icon: '🩸', text: 'Add Lp(a)', sub: 'ApoB drift zone — determine if driver is genetic.' },
          { icon: '🩸', text: 'Add Fasting Insulin', sub: 'Calculate HOMA-IR directly.' },
          { icon: '🩸', text: 'Add UACR', sub: 'Creatinine confirmed optimal. UACR completes kidney panel.' },
          { icon: '🩸', text: 'Retest ApoB in ~3 months', sub: 'Same draw as Lp(a).' },
        ].map((item, i, arr) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            paddingBottom: i < arr.length - 1 ? 10 : 0,
            borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            marginBottom: i < arr.length - 1 ? 10 : 0,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{item.text}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 1.5 }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
