// SVG line chart with optimal/drift zone shading. Ported from prototype.
import { MBH_SAGE, AMBER, SOFT_RED, OFFWHITE, SLATE } from '../lib/constants.js';

export default function ZoneChart({ history, optimalMin, optimalMax, driftMin, driftMax, unit, higherIsBetter = false }) {
  if (!history || history.length < 1) return null;

  const W = 300, H = 110;
  const PAD = { top: 12, right: 14, bottom: 26, left: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const vals = history.map(h => parseFloat(h.value));
  const allVals = [...vals, optimalMin, optimalMax, driftMin, driftMax].filter(v => v != null && !isNaN(v));
  if (allVals.length === 0) return null;

  const dMin = Math.min(...allVals);
  const dMax = Math.max(...allVals);
  const yPad = (dMax - dMin) * 0.2 || 1;
  const yMin = Math.max(0, dMin - yPad);
  const yMax = dMax + yPad;
  const yR = yMax - yMin;

  const toY = (v) => PAD.top + plotH - (((v - yMin) / yR) * plotH);
  const toX = (i) => PAD.left + (history.length === 1 ? plotW / 2 : (i / (history.length - 1)) * plotW);

  const ptStatus = vals.map(v =>
    higherIsBetter
      ? (v >= (optimalMin || 0) ? 'optimal' : v >= (driftMin || 0) ? 'drift' : 'watch')
      : (v <= (optimalMax || 999) ? 'optimal' : v <= (driftMax || 999) ? 'drift' : 'watch')
  );
  const ptColor = (s) => s === 'optimal' ? MBH_SAGE : s === 'drift' ? AMBER : SOFT_RED;
  const linePts = history.map((_, i) => `${toX(i)},${toY(vals[i])}`).join(' ');

  // Zone bands
  const optimalY1 = optimalMax != null ? toY(optimalMax) : null;
  const optimalY2 = optimalMin != null ? toY(optimalMin) : null;
  const driftY1   = driftMax   != null ? toY(driftMax)   : null;
  const driftY2   = driftMin   != null ? toY(driftMin)   : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* drift band */}
      {driftY1 != null && driftY2 != null && (
        <rect x={PAD.left} y={Math.min(driftY1, driftY2)} width={plotW}
              height={Math.abs(driftY1 - driftY2)} fill={AMBER} fillOpacity="0.08" />
      )}
      {/* optimal band */}
      {optimalY1 != null && optimalY2 != null && (
        <rect x={PAD.left} y={Math.min(optimalY1, optimalY2)} width={plotW}
              height={Math.abs(optimalY1 - optimalY2)} fill={MBH_SAGE} fillOpacity="0.12" />
      )}
      {/* line */}
      {history.length > 1 && <polyline points={linePts} fill="none" stroke={SLATE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
      {/* points */}
      {history.map((h, i) => (
        <circle key={i} cx={toX(i)} cy={toY(vals[i])} r="4" fill={ptColor(ptStatus[i])} stroke="#fff" strokeWidth="1.5" />
      ))}
      {/* x labels */}
      {history.map((h, i) => (
        <text key={i} x={toX(i)} y={H - 8} fontSize="9" fill="#6b7280" textAnchor="middle">{h.date}</text>
      ))}
      {/* y axis labels */}
      <text x={PAD.left - 4} y={PAD.top + 4} fontSize="9" fill="#9ca3af" textAnchor="end">{yMax.toFixed(1)}</text>
      <text x={PAD.left - 4} y={H - PAD.bottom} fontSize="9" fill="#9ca3af" textAnchor="end">{yMin.toFixed(1)}</text>
    </svg>
  );
}
