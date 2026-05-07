// DEXA & Structural — VAT, Lean Mass, Bone. Hardcoded for v1; live data wiring in Phase B.
import { useState } from 'react';
import { MBH_SAGE, AMBER, AMBER_TEXT, SAGE_TEXT, AMBER_BG, SAGE_BG, SOFT_RED, SLATE, OFFWHITE, CARD, BORDER, TEAL } from '../lib/constants.js';
import { SignalChip } from '../components/UI.jsx';

const BONE = '#8b7355';

const DATA = {
  scanDate: 'April 24, 2026',
  vatGrams: 984, vatStatus: 'optimal', vatPct: 18,
  vatContextNote: 'VAT is not the driver of the ApoB signal.',
  lmi: 17.84, lmiStatus: 'optimal', lmiPct: 71,
  totalLeanMassKg: 58.0, leanMassPct: 74,
  trainingNote: '> 250 active min/wk',
  rmr: 1594,
  boneDensity: 1.29, boneStatus: 'optimal', bonePct: 72,
  nextScanYear: 2027,
};

function ZBar({ pct, gradient, markerColor = SLATE }) {
  return (
    <div style={{ position: 'relative', height: 8, borderRadius: 4, background: gradient, overflow: 'visible' }}>
      <div style={{
        position: 'absolute', top: -4, left: `${Math.min(96, Math.max(4, pct))}%`,
        width: 16, height: 16, borderRadius: '50%', background: CARD,
        border: `2.5px solid ${markerColor}`, boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        transform: 'translateX(-50%)',
      }} />
    </div>
  );
}

function HLBlock({ label, accentColor = MBH_SAGE, children }) {
  const bg = accentColor === TEAL ? '#f0f8fa' : accentColor === BONE ? '#faf8f5' : '#f0f8f6';
  return (
    <div style={{ background: bg, borderLeft: `3px solid ${accentColor}`, borderRadius: '0 10px 10px 0', padding: '13px 16px', fontSize: 13.5, lineHeight: 1.65, color: '#374151' }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: accentColor, marginBottom: 6 }}>{label}</div>
      )}
      {children}
    </div>
  );
}

function StrategyList({ items, dotColor = MBH_SAGE }) {
  return items.map((s, i) => (
    <div key={s.title} style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      fontSize: 13.5, lineHeight: 1.55, color: '#4b5563', padding: '10px 0',
      borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, marginTop: 7, flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: SLATE, marginBottom: 2 }}>{s.title}</div>
        {s.detail}
      </div>
    </div>
  ));
}

function VATSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: CARD, borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c97b1a', marginBottom: 4 }}>Visceral Adipose Tissue</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 44, color: SLATE, lineHeight: 1, letterSpacing: '-1px' }}>
              {DATA.vatGrams.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: '#374151', marginLeft: 4 }}>g</span>
            </div>
          </div>
          <SignalChip status={DATA.vatStatus} />
        </div>
        <ZBar pct={DATA.vatPct} gradient="linear-gradient(to right,#4a7c6f 0%,#4a7c6f 26%,#84cc16 32%,#f59e0b 42%,#ef4444 58%,#991b1b 100%)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#374151' }}>
          <span>Low risk</span><span>Elevated</span><span>High</span><span>Very high</span>
        </div>
        <div style={{ height: 1, background: BORDER, margin: '16px 0' }} />
        <HLBlock label="What VAT tells you">
          Visceral fat surrounds the abdominal organs. It is metabolically active — releasing signals that drive insulin resistance, raise atherogenic particle count, and fuel systemic inflammation.
          {DATA.vatContextNote && <div style={{ marginTop: 8, fontWeight: 600, color: SLATE }}>{DATA.vatContextNote}</div>}
        </HLBlock>
      </div>
      <div style={{ background: CARD, borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 14 }}>Strategies to maintain VAT</div>
        <StrategyList items={[
          { title: 'Moderate insulin spikes', detail: 'Prioritise protein and fibre-rich carbohydrates. Both slow glucose absorption and reduce the insulin response that drives VAT accumulation.' },
          { title: 'Move after meals', detail: 'Even a 10-minute walk post-meal activates muscle glucose uptake independently of insulin, directly blunting the metabolic signal for fat storage.' },
          { title: 'Protect sleep quality', detail: 'Poor sleep elevates cortisol, which disproportionately drives VAT. Consistent sleep timing matters as much as duration.' },
        ]} />
      </div>
    </div>
  );
}

function LeanSection() {
  const LM_GRAD = 'linear-gradient(to right,#ef4444,#f59e0b 30%,#10b981 55%,#059669)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: CARD, borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEAL, marginBottom: 14 }}>Lean Mass — healthspan asset</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          {[{ label: 'Lean Mass Index', value: DATA.lmi, unit: 'kg/m²', pct: DATA.lmiPct }, { label: 'Total Lean Mass', value: DATA.totalLeanMassKg, unit: 'kg', pct: DATA.leanMassPct }].map((m, i) => (
            <div key={m.label} style={{ borderRight: i === 0 ? `1px solid ${BORDER}` : 'none', paddingRight: i === 0 ? 16 : 0 }}>
              <div style={{ fontSize: 11, color: '#374151', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: TEAL, lineHeight: 1 }}>
                {m.value}<span style={{ fontSize: 11, color: '#374151', marginLeft: 3 }}>{m.unit}</span>
              </div>
              <div style={{ marginTop: 10 }}><ZBar pct={m.pct} gradient={LM_GRAD} markerColor={TEAL} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9, color: '#374151' }}>
                <span>Low</span><span>Adequate</span><span>Strong</span>
              </div>
              <div style={{ marginTop: 8 }}><SignalChip status={DATA.lmiStatus} /></div>
            </div>
          ))}
        </div>
        <HLBlock label="Lean mass is your most durable healthspan investment" accentColor={TEAL}>
          Muscle is your largest metabolic organ. At your sustained training load ({DATA.trainingNote}), your lean mass is a product of consistent, high-quality stimulus.
        </HLBlock>
      </div>
      <div style={{ background: OFFWHITE, borderRadius: 14, padding: '16px 20px', border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>Resting Metabolic Rate</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: SLATE }}>
              {DATA.rmr.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 3 }}>cal/day</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', maxWidth: 180, textAlign: 'right', lineHeight: 1.5 }}>
            RMR is driven primarily by lean mass — protecting muscle directly supports metabolic health.
          </div>
        </div>
      </div>
    </div>
  );
}

function BoneSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: CARD, borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: BONE, marginBottom: 14 }}>Bone Mineral Density</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 44, color: BONE, lineHeight: 1, letterSpacing: '-1px' }}>
              {DATA.boneDensity}<span style={{ fontSize: 14, fontWeight: 400, color: '#374151', marginLeft: 4 }}>g/cm²</span>
            </div>
            <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>Goal: Maintain</div>
          </div>
          <SignalChip status={DATA.boneStatus} />
        </div>
        <ZBar pct={DATA.bonePct} gradient="linear-gradient(to right,#ef4444 0%,#f59e0b 22%,#10b981 50%,#059669 100%)" markerColor={BONE} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#374151' }}>
          <span>Osteoporosis</span><span>Osteopenia</span><span>Normal</span><span>Strong</span>
        </div>
        <div style={{ height: 1, background: BORDER, margin: '16px 0' }} />
        <HLBlock label="What bone density tells you" accentColor={BONE}>
          Bone mineral density measures the concentration of minerals in bone tissue — primarily calcium. It is a proxy for structural resilience and fracture risk over decades. Bone is living tissue that responds to mechanical load: resistance exercise is the most powerful modifiable lever for maintaining density.
          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>This scan is a non-diagnostic assessment.</div>
        </HLBlock>
      </div>
      <div style={{ background: CARD, borderRadius: 14, padding: '22px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 14 }}>Strategies to maintain bone density</div>
        <StrategyList dotColor={BONE} items={[
          { title: 'Resistance training', detail: 'Mechanical load is the most effective stimulus for bone remodelling. Multi-joint, weight-bearing movements are highest leverage.' },
          { title: 'Adequate calcium intake', detail: 'Dietary calcium is the raw material for bone mineralisation. Prioritise whole food sources; supplement where intake is insufficient.' },
          { title: 'Vitamin D', detail: 'Essential for calcium absorption. Most people in northern latitudes are deficient without supplementation, especially in winter.' },
        ]} />
      </div>
    </div>
  );
}

export default function DEXAPage() {
  const [activeSection, setActiveSection] = useState('vat');
  const tabs = [{ key: 'vat', label: 'Metabolic Fat' }, { key: 'lean', label: 'Lean Mass' }, { key: 'bone', label: 'Bone' }];

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>DEXA &amp; Structural</h1>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>{DATA.scanDate}</div>

      <div style={{ background: SLATE, borderRadius: 14, padding: '18px 20px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { label: 'Visceral Fat', value: DATA.vatGrams, unit: 'g', status: DATA.vatStatus, sub: 'Goal: Maintain' },
          { label: 'Lean Mass Index', value: DATA.lmi, unit: 'kg/m²', status: DATA.lmiStatus, sub: 'Goal: Increase' },
          { label: 'Bone Density', value: DATA.boneDensity, unit: 'g/cm²', status: DATA.boneStatus, sub: 'Goal: Maintain' },
        ].map((m, i) => (
          <div key={m.label} style={{
            borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            paddingRight: i < 2 ? 12 : 0,
          }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: 'white', lineHeight: 1 }}>
              {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
              <span style={{ fontSize: 9, fontWeight: 300, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>{m.unit}</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SignalChip status={m.status} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{m.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveSection(t.key)} style={{
            padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
            background: activeSection === t.key ? SLATE : 'transparent',
            color: activeSection === t.key ? 'white' : '#374151',
          }}>{t.label}</button>
        ))}
      </div>

      {activeSection === 'vat' && <VATSection />}
      {activeSection === 'lean' && <LeanSection />}
      {activeSection === 'bone' && <BoneSection />}

      <div style={{ marginTop: 16, padding: '13px 16px', background: '#eeeae4', borderRadius: 10, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        <strong style={{ color: SLATE }}>About DEXA frequency.</strong> Annual scanning is sufficient for most members. Suggested next scan: April {DATA.nextScanYear}. Member decides.
      </div>
    </div>
  );
}
