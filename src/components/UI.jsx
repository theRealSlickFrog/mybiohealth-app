// Small shared UI primitives — ported from remixed-edc07ba6.html
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER_BG, AMBER_TEXT, GAP_BG, GAP_TEXT, GAP_BORDER, AMBER, SOFT_RED, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';
import { OPTIMAL_AUTHORITIES } from '../lib/optimal-authorities.js';

export function Divider() {
  return <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />;
}

export function SignalChip({ status }) {
  const map = {
    optimal:   { bg: SAGE_BG,    color: SAGE_TEXT,  label: 'Optimal' },
    watch:     { bg: '#fdf0ee',  color: SOFT_RED,   label: 'Watch' },
    drift:     { bg: AMBER_BG,   color: AMBER_TEXT, label: 'Drift' },
    gap:       { bg: GAP_BG,     color: GAP_TEXT,   label: 'Not tested' },
    priority:  { bg: '#fff1e6',  color: '#92400e',  label: 'Priority' },
    estimated: { bg: '#f0f4ff',  color: '#3b4f8c',  label: 'Estimated' },
  };
  const s = map[status] || map.gap;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

export function TrendArrow({ dir, status }) {
  const color = status === 'optimal' ? MBH_SAGE
              : status === 'gap'      ? GAP_BORDER
              : status === 'priority' ? '#92400e'
              : SOFT_RED;
  const symbol = dir === 'up' ? '↗' : dir === 'down' ? '↘' : dir === 'flat' ? '→' : '·';
  return (
    <span style={{ color, fontSize: 14, fontWeight: 700, lineHeight: 1, width: 14, textAlign: 'center' }}>
      {symbol}
    </span>
  );
}

export function MHxChip({ text }) {
  return (
    <span style={{
      background: SAGE_BG, color: MBH_SAGE,
      fontSize: 10.5, fontWeight: 600, padding: '2px 8px',
      borderRadius: 10, whiteSpace: 'nowrap',
    }}>🌱 {text}</span>
  );
}

export function PullQuote({ children, color = MBH_SAGE }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      paddingLeft: 14, fontSize: 14, color: SLATE, fontStyle: 'italic',
      lineHeight: 1.5, margin: '12px 0',
    }}>{children}</div>
  );
}

export function MetaphorCard({ icon, title, body, accentColor = MBH_SAGE }) {
  return (
    <div style={{
      background: OFFWHITE, borderRadius: 10, padding: '14px 16px',
      borderLeft: `3px solid ${accentColor}`, marginBottom: 12,
    }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: SLATE, fontSize: 13.5, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

export function SignalCallout({ label, value, note }) {
  return (
    <div style={{ background: OFFWHITE, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: SLATE }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: SLATE }}>{value}</span>
      </div>
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55 }}>{note}</div>
    </div>
  );
}

export function PageDots({ total, current }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i === current ? MBH_SAGE : '#d1d5db',
        }} />
      ))}
    </div>
  );
}

export function OptimalPill({ signalName, onOpen }) {
  if (!OPTIMAL_AUTHORITIES[signalName]) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); onOpen(signalName); }} style={{
      background: 'none', border: `1px solid ${MBH_SAGE}50`, borderRadius: 20,
      padding: '3px 9px', fontSize: 12, fontWeight: 600, color: MBH_SAGE,
      cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em', lineHeight: 1.2,
    }}>Optimal v Normal</button>
  );
}
