// Expandable row inside BioSignals. Tap to reveal history chart + note + sub-markers.
import { useState } from 'react';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, AMBER_BG, AMBER_TEXT, GAP_BG, GAP_TEXT, GAP_BORDER, SOFT_RED, SLATE, OFFWHITE, CARD, BORDER } from '../lib/constants.js';
import { OPTIMAL_AUTHORITIES } from '../lib/optimal-authorities.js';
import { SignalChip, TrendArrow, MHxChip, OptimalPill } from './UI.jsx';
import ZoneChart from './ZoneChart.jsx';

export default function SignalRow({ signal, isLast, onOpenOptimal }) {
  const [open, setOpen] = useState(false);
  const noteBg = signal.status === 'optimal' ? SAGE_BG
               : signal.status === 'priority' ? '#fff7ed'
               : signal.status === 'gap' ? GAP_BG
               : AMBER_BG;
  const noteBorder = signal.status === 'optimal' ? MBH_SAGE
                   : signal.status === 'priority' ? AMBER
                   : signal.status === 'gap' ? GAP_BORDER
                   : AMBER;
  const noteText = signal.status === 'optimal' ? SAGE_TEXT
                 : signal.status === 'priority' ? '#78350f'
                 : signal.status === 'gap' ? GAP_TEXT
                 : AMBER_TEXT;
  return (
    <div>
      <div onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', cursor: 'pointer',
        borderBottom: !open && !isLast ? `1px solid ${BORDER}` : 'none',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: SLATE }}>{signal.name}</span>
            {signal.mhx && <MHxChip text={signal.mhx} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <div style={{ fontSize: 11, color: '#374151' }}>
              optimal {signal.optimal}{signal.unit ? ' · ' + signal.unit : ''}
            </div>
            {OPTIMAL_AUTHORITIES[signal.name] && onOpenOptimal && (
              <OptimalPill signalName={signal.name} onOpen={onOpenOptimal} />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 14, fontWeight: 600,
            color: signal.status === 'priority' ? '#92400e' : signal.status === 'watch' ? SOFT_RED : SLATE,
          }}>
            {signal.latest ?? '—'}{signal.latest && signal.unit ? ' ' + signal.unit : ''}
          </span>
          <TrendArrow dir={signal.trendDir} status={signal.status} />
          <SignalChip status={signal.status} />
          <span style={{ fontSize: 12, color: '#d1d5db' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginBottom: 12 }}>
          {signal.history && signal.history.length > 1 && signal.chartConfig && (
            <div style={{ background: OFFWHITE, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <ZoneChart history={signal.history} unit={signal.unit} {...signal.chartConfig} />
            </div>
          )}
          {signal.note && (
            <div style={{
              background: noteBg, borderLeft: `3px solid ${noteBorder}`, borderRadius: '0 8px 8px 0',
              padding: '10px 14px', fontSize: 12.5, lineHeight: 1.6, color: noteText, marginBottom: 10,
            }}>{signal.note}</div>
          )}
          {signal.subs && signal.subs.length > 0 && (
            <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: '#374151', padding: '8px 14px', borderBottom: `1px solid ${BORDER}`,
              }}>Related</div>
              {signal.subs.map((sub, i) => (
                <div key={sub.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderBottom: i < signal.subs.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: SLATE, fontWeight: 500 }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: '#374151' }}>
                      optimal {sub.optimal}{sub.unit ? ' · ' + sub.unit : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: SLATE }}>
                      {sub.latest ?? '—'}{sub.latest && sub.unit ? ' ' + sub.unit : ''}
                    </span>
                    <TrendArrow dir={sub.trendDir || 'none'} status={sub.status} />
                    <SignalChip status={sub.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
