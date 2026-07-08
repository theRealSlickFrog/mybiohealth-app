// Glucose Summary — live CGM cycles rendered in the M4 design.
// The system MEASURES and SHOWS; it does not narrate. No "elevated", no
// verdicts — numbers with their band, colour as ambient signal only. The story
// is written by people, in three free-text boxes (Member · MBH · Clinician),
// dictatable and saved to Caspio. Watched moments open with context.
// 24h median is a number, never a line (a line can hide a hot night under a
// cool day).
//
// Data: lib/glucoseCycle.js — one JSON blob per cycle from the cgm_cycle
// Caspio table (per member GUID); bands/medians computed client-side. A
// clearly-labeled sample cycle shows until the member has real rows.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getStoredGuid, isAdminSession } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';
import { loadGlucoseCycles, loadVoices, saveVoice, median, STEP, SAMPLES, TH_HI } from '../lib/glucoseCycle.js';
import { loadGlucoseExtras } from '../lib/glucose.js';
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE as APP_SLATE, CARD, BORDER, OFFWHITE } from '../lib/constants.js';
import PersonalNote from '../components/PersonalNote.jsx';

const C = { paper: '#EEEADD', panel: '#F6F3EA', ink: '#28302B', inkSoft: '#5A6359', muted: '#8C9387',
  hair: 'rgba(40,48,43,0.12)', hairSoft: 'rgba(40,48,43,0.07)', sage: '#8AA17F', sageDeep: '#5C7556',
  healthy: 'rgba(138,161,127,0.22)', amber: '#C8923F', clay: '#B05A3C', horizon: '#454E43', slate: '#6E7E86', box: 'rgba(110,126,134,0.22)' };
const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif";
const SANS = "-apple-system,'SF Pro Text',ui-sans-serif,system-ui,sans-serif";
const MONO = "'SF Mono','SFMono-Regular',ui-monospace,Menlo,monospace";
const TH_VHI = 10;
const dWd = (c, i) => c.dates[i].wd, dDate = (c, i) => c.dates[i].d, dWk = (c, i) => c.dates[i].wknd;

function daySlices(p) { const sl = new Array(SAMPLES).fill(null); for (const d of p) { const s = Math.round(d.t / STEP); if (s >= 0 && s < SAMPLES) sl[s] = { t: s * STEP, p25: d.g, p50: d.g, p75: d.g }; } return sl; }
const VB_W = 720, VB_H = 300, PAD_L = 34, PAD_R = 14, PAD_T = 22, PAD_B = 26;
const Y_MIN = 3, Y_MAX = 11.5; const yOf = g => PAD_T + (1 - (Math.min(Y_MAX, Math.max(Y_MIN, g)) - Y_MIN) / (Y_MAX - Y_MIN)) * (VB_H - PAD_T - PAD_B);
const raw = p => p.map((q, i) => `${i ? 'L' : 'M'} ${q.x} ${q.y}`).join(' ');
function Chevron({ dir }) { return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d={dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
function MicIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>); }

function Chart({ slices, win, bp }) {
  // The viewBox width tracks the rendered width (ResizeObserver), so the chart
  // fills whatever space it's given at a constant 300px height and 1:1 scale —
  // wider screens get wider slices, not a proportionally blown-up SVG.
  const wrapRef = useRef(null);
  const [vbW, setVbW] = useState(VB_W);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setVbW(Math.max(680, Math.round(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [onLo, onHi] = bp.on, [dLo, dHi] = bp.day;
  const zoom = win === 'mid3';                                   // 3-hour window -> zoom, not dim
  const dom = zoom ? [0, 180] : [0, 1440];
  const X = t => PAD_L + ((t - dom[0]) / (dom[1] - dom[0])) * (vbW - PAD_L - PAD_R);
  const nSlot = (dom[1] - dom[0]) / STEP; const slotW = (vbW - PAD_L - PAD_R) / nSlot;
  const inWin = t => win === 'all' ? true : win === 'overnight' ? (t < 6 * 60 || t >= 22 * 60) : win === 'daytime' ? (t >= 6 * 60 && t < 22 * 60) : (t < 180);
  const gridH = zoom ? [0, 1, 2, 3] : [0, 6, 12, 18, 24];
  const bars = slices.map((s, i) => {
    if (!s || s.p50 == null) return null; const t = i * STEP; if (zoom && (t < dom[0] || t >= dom[1])) return null;
    const cx = X(t) + slotW / 2, bw = Math.max(1.5, slotW * 0.62), dim = !zoom && !inWin(t);
    const yhi = yOf(s.p75), ylo = yOf(s.p25), ym = yOf(s.p50), boxH = Math.max(0, ylo - yhi);
    return (<g key={i} opacity={dim ? 0.16 : 1}>{boxH > 0.8 && <rect x={cx - bw / 2} y={yhi} width={bw} height={boxH} rx={1} fill={C.box} />}<line x1={cx - bw / 2} y1={ym} x2={cx + bw / 2} y2={ym} stroke={C.ink} strokeWidth={1.7} strokeLinecap="round" /></g>);
  });
  return (<div ref={wrapRef} style={{ width: '100%' }}>
    <svg viewBox={`0 0 ${vbW} ${VB_H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Glucose by 15-minute slice">
      {zoom
        ? <rect x={X(0)} y={yOf(onHi)} width={X(180) - X(0)} height={yOf(onLo) - yOf(onHi)} fill={C.healthy} />
        : <React.Fragment><rect x={X(0)} y={yOf(onHi)} width={X(6 * 60) - X(0)} height={yOf(onLo) - yOf(onHi)} fill={C.healthy} />
          <rect x={X(6 * 60)} y={yOf(dHi)} width={X(22 * 60) - X(6 * 60)} height={yOf(dLo) - yOf(dHi)} fill={C.healthy} />
          <rect x={X(22 * 60)} y={yOf(onHi)} width={X(24 * 60) - X(22 * 60)} height={yOf(onLo) - yOf(onHi)} fill={C.healthy} /></React.Fragment>}
      <text x={zoom ? X(90) : X(13 * 60)} y={yOf(zoom ? onHi : dHi) - 3} textAnchor={zoom ? 'middle' : 'start'} style={{ font: `400 8.5px ${MONO}`, fill: C.sageDeep }}>{zoom ? `overnight band ${onLo}–${onHi} (reference)` : 'healthy band (reference)'}</text>
      {gridH.map(h => (<line key={h} x1={X(h * 60)} y1={PAD_T} x2={X(h * 60)} y2={VB_H - PAD_B} stroke={C.hairSoft} />))}
      <line x1={PAD_L} y1={yOf(TH_VHI)} x2={vbW - PAD_R} y2={yOf(TH_VHI)} stroke={C.clay} strokeWidth="1" strokeDasharray="2 4" opacity=".4" />
      <text x={PAD_L - 6} y={yOf(TH_VHI) + 3} textAnchor="end" style={{ font: `400 9px ${MONO}`, fill: C.muted }}>10</text>
      {bars}
      <line x1={PAD_L} y1={yOf(TH_HI)} x2={vbW - PAD_R} y2={yOf(TH_HI)} stroke={C.horizon} strokeWidth="1.5" />
      <text x={PAD_L - 6} y={yOf(TH_HI) + 3} textAnchor="end" style={{ font: `600 9px ${MONO}`, fill: C.horizon }}>7.8</text>
      {zoom && <text x={(X(0) + X(180)) / 2} y={PAD_T - 8} textAnchor="middle" style={{ font: `600 9px ${MONO}`, fill: C.sageDeep }}>Midnight–3 AM · zoomed</text>}
      {gridH.map(h => (<text key={h} x={X(h * 60)} y={VB_H - 8} textAnchor="middle" style={{ font: `400 9px ${MONO}`, fill: C.muted }}>{String(h).padStart(2, '0')}:00</text>))}
    </svg>
  </div>);
}

function ContextArc({ ev, cyc }) {
  const W = 340, Hh = 152, pl = 30, pr = 12, pt = 16, pb = 22;
  const grid = (cyc.days[ev.day] || []).slice().sort((a, b) => a.t - b.t);
  const b = ev.burst.slice().sort((a, b) => a.t - b.t);
  const isLow = ev.kind === 'LOW';
  const firstTap = b[0].t, lastTap = b[b.length - 1].t;
  const lT = firstTap - 90, rT = lastTap + 40;                       // fixed 90 pre / 40 post
  const leftC = grid.filter(p => p.t <= lT), rightC = grid.filter(p => p.t >= rT);   // step OUTWARD to a real slice
  const L = (leftC.length ? leftC[leftC.length - 1] : grid[0] || { t: Math.max(0, lT) }).t;
  const Rr = (rightC.length ? rightC[0] : grid[grid.length - 1] || { t: Math.min(1440, rT) }).t;
  const arc = grid.filter(p => p.t >= L && p.t <= Rr);
  const allG = [...arc.map(p => p.g), ...b.map(p => p.g)];
  const gmin = Math.min(...allG, isLow ? 3.7 : 7.4) - 0.3, gmax = Math.max(...allG, 8.2) + 0.4;
  const span = Math.max(1, Rr - L);
  const X = t => pl + ((t - L) / span) * (W - pl - pr), Y = g => pt + (1 - (g - gmin) / (gmax - gmin)) * (Hh - pt - pb);
  const arcPts = arc.map(p => ({ x: X(p.t), y: Y(p.g) })), burstPts = b.map(p => ({ x: X(p.t), y: Y(p.g) }));
  const peak = b.reduce((a, p) => p.g > a.g ? p : a), nad = b.reduce((a, p) => p.g < a.g ? p : a), mk = isLow ? nad : peak;
  const fmtT = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const leftHot = arc.length && arc[0].g > TH_HI, rightHot = arc.length && arc[arc.length - 1].g > TH_HI;
  const refs = isLow ? [[3.9, C.slate], [7.8, C.horizon]] : [[7.8, C.horizon], [10, C.clay]];
  return (<svg viewBox={`0 0 ${W} ${Hh}`} width="100%" style={{ display: 'block', maxWidth: 380 }}>
    {Y(TH_HI) > pt && <rect x={pl} y={pt} width={W - pl - pr} height={Math.max(0, Y(TH_HI) - pt)} fill={C.amber} opacity="0.05" />}
    <rect x={X(firstTap)} y={pt} width={Math.max(0, X(lastTap) - X(firstTap))} height={Hh - pt - pb} fill={C.ink} opacity="0.05" />
    <text x={(X(firstTap) + X(lastTap)) / 2} y={pt - 4} textAnchor="middle" style={{ font: `400 7.5px ${MONO}`, fill: C.muted }}>watched</text>
    {refs.map(([v, c]) => v > gmin && v < gmax ? <g key={v}><line x1={pl} y1={Y(v)} x2={W - pr} y2={Y(v)} stroke={c} strokeWidth="1" strokeDasharray={v === 7.8 ? '0' : '2 3'} opacity={v === 7.8 ? .7 : .4} /><text x={pl - 4} y={Y(v) + 3} textAnchor="end" style={{ font: `400 8px ${MONO}`, fill: C.muted }}>{v}</text></g> : null)}
    <path d={raw(arcPts)} fill="none" stroke={C.ink} strokeWidth="1.6" />
    {burstPts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="2" fill={C.ink} />))}
    <circle cx={X(mk.t)} cy={Y(mk.g)} r="4.5" fill="none" stroke={isLow ? C.slate : C.amber} strokeWidth="2" />
    <text x={X(mk.t)} y={Y(mk.g) - 8} textAnchor="middle" style={{ font: `600 10px ${SERIF}`, fill: isLow ? C.slate : C.amber }}>{mk.g}</text>
    <text x={pl} y={Hh - 6} style={{ font: `400 8px ${MONO}`, fill: C.muted }}>{fmtT(L)}</text>
    <text x={W - pr} y={Hh - 6} textAnchor="end" style={{ font: `400 8px ${MONO}`, fill: C.muted }}>{fmtT(Rr)}</text>
    {leftHot && <text x={pl + 2} y={pt + 9} style={{ font: `400 7px ${MONO}`, fill: C.muted }}>already above</text>}
    {rightHot && <text x={W - pr - 2} y={pt + 9} textAnchor="end" style={{ font: `400 7px ${MONO}`, fill: C.muted }}>still above</text>}
  </svg>);
}

function Measure({ label, value, unit, band, tone, onInfo, big }) {
  return (<div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 14 }}><span style={{ font: `600 ${big ? 10.5 : 10}px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>{label}</span>{onInfo && <InfoDot onClick={onInfo} />}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: big ? 6 : 4, height: big ? 42 : 28 }}><span style={{ font: `400 ${big ? 42 : 26}px/1 ${SERIF}`, color: tone || C.ink, fontFeatureSettings: '"tnum"' }}>{value}</span>{unit && <span style={{ font: `400 ${big ? 11 : 11}px/1 ${SANS}`, color: C.muted }}>{unit}</span>}</div>
    <div style={{ font: `400 9px ${MONO}`, color: C.muted, marginTop: 5, height: 11 }}>{band ? `band ${band[0]}–${band[1]}` : ''}</div></div>);
}
const sf = x => x == null ? '—' : x.toFixed(1);
const kIcon = k => k === 'HIGH' ? '▲' : k === 'LOW' ? '▼' : '●', kColor = k => k === 'HIGH' ? C.amber : k === 'LOW' ? C.slate : C.muted;

function DailyTARStrip({ cyc }) {
  const per = cyc.m.map((x, i) => ({ i, min: x.tar, d: cyc.dates[i] }));
  const n = per.length;
  const maxMin = Math.max(60, ...per.map(p => p.min));
  const sorted = per.map(p => p.min).slice().sort((a, b) => a - b);
  const med = (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) / 60;
  const nGE1 = per.filter(p => p.min >= 60).length;
  const peak = per.reduce((a, p) => p.min > a.min ? p : a);
  const lbl = d => `${d.wd}-${d.d.split(' ')[1]}`;
  return (<div style={{ margin: '2px 0 14px', padding: '12px 14px', border: `1px solid ${C.hair}`, borderRadius: 10, background: C.paper }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>Time above 7.8 · by day</span>
      <span style={{ font: `400 10px ${MONO}`, color: C.inkSoft }}>{nGE1} of {n} days past the first hour · median {med.toFixed(1)} h · peak {lbl(peak.d)} {(peak.min / 60).toFixed(2)} h</span>
    </div>
    <div style={{ position: 'relative', height: 52 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(4, (60 / maxMin) * 48)}px`, background: C.healthy, borderRadius: 3, pointerEvents: 'none' }}><span style={{ position: 'absolute', right: 2, top: -11, font: `400 7.5px ${MONO}`, color: C.sageDeep }}>1 h</span></div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
        {per.map(p => {
          const h = Math.max(3, (p.min / maxMin) * 48), isPk = p.i === peak.i;
          const col = p.min >= 60 ? C.amber : p.min > 0 ? C.sage : C.hair;
          return (<div key={p.i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {isPk && <span style={{ font: `600 8.5px ${MONO}`, color: C.amber, marginBottom: 1 }}>{(p.min / 60).toFixed(1)}</span>}
            <div title={`${lbl(p.d)} · ${(p.min / 60).toFixed(2)} h`} style={{ width: '100%', maxWidth: 16, height: h, borderRadius: 2, background: col, opacity: isPk ? 1 : p.min > 0 ? 0.85 : 0.55, outline: isPk ? `1.5px solid ${C.ink}` : 'none' }} />
          </div>);
        })}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
      {per.map(p => (<span key={p.i} style={{ flex: 1, textAlign: 'center', font: `400 7.5px ${MONO}`, color: p.d.wknd ? C.slate : C.muted }}>{p.d.d.split(' ')[1]}</span>))}
    </div>
    <div style={{ font: `400 9.5px/1.5 ${MONO}`, color: C.muted, marginTop: 8 }}>one bar, one day. the shaded band is the first hour — a well-regulated day stays within it. the median ({med.toFixed(1)} h) is the middle day; a few days carry most of the total, which is why a median can read calmer than the fortnight was.</div>
  </div>);
}

function InfoDot({ onClick }) { return (<button className="gcl-info" onClick={e => { e.stopPropagation(); onClick(); }} aria-label="What does this mean?"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.6" r="0.95" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>); }

// Teaching layer. Describe the math; assert no verdict. The anchor ('guide') is
// the canonical explainer; satellites are short and route up to it.
const GUIDE = [
  ['One cycle, one chart', "You're looking at a single 14-day cycle. The day is cut into 96 fifteen-minute slices, and every picture on this screen is built from those same slices — what changes is how many days feed them and which hours you look at."],
  ['The bars', 'Each bar is one 15-minute slice. The tick across it is the median — the middle level at that time of day across the days in view. The box around it is the middle half of the days (the 25th to 75th percentile): a tall box means the days disagreed at that time, a short box means they agreed.'],
  ['Median, not average', 'Every number here is a median. An average lets one unusual day pull the whole figure; a median reports the middle and stays steady. That is why a single busy day does not move the picture much — and why the bars describe a usual day rather than any one day.'],
  ['The four numbers', 'Time above 7.8 is a total — it adds every 15 minutes spent above 7.8 and takes the median across the days. The 24h median is a single middle level for the whole day, shown as a number on purpose: drawn as a line it could lay a calm middle over a day whose night and daytime differ. Overnight and daytime are the medians of those two stretches, each shown next to its reference band. Midnight–3 AM is a narrower window inside the night — the deep, food-free hours — read against the daytime number to tell a food pattern from a metabolic one.'],
  ['The reference band', 'The shaded band is a reference range drawn from non-diabetic glucose data for this phenotype — a backdrop for the eye, not a target to reach and not a diagnosis. Where it sits is a setting owned by MBH or the clinician, the same value travelling with every number. A reading outside it is described by its distance from the band, never given a label.'],
  ['Days and window', 'Two controls, one chart. Days choose which days feed every slice — all of them, weekdays, weekends, or one real day. Window chooses which hours you look at. The 15-minute slice itself never changes; only the days behind it and the hours in front of it.'],
  ['Watched moments', 'These are moments you chose to watch as they happened, kept at full resolution rather than averaged away. Each opens with context — the reading before and after, not just the peak — so the moment sits inside its lead-up and its recovery. A note is what turns it into something you can learn from.'],
  ['Who writes the story', 'The screen measures and shows; it does not interpret. What the numbers mean is written by people — in the Member, MBH, and Clinician boxes — so the reading is always attributed to whoever made it.'],
];
const SAT = {
  tar: { title: 'Time above 7.8', body: 'This is a total, not a typical day. It adds up every 15 minutes that sat above 7.8, then takes the median across the days of the cycle. The bars answer a different question — where a usual day sits — which can stay below 7.8 even when a few days spend time above it. Those few days are where this figure comes from. The daily-spread strip shows exactly which ones. Note this median differs on purpose from a Libre/AGP report, which pools every reading into one average day — that pooled figure runs higher whenever a few days carry most of the load.', cta: 'Open the Days tab to see which days →', ctaKey: 'days' },
  chart: { title: 'Reading the chart', body: 'Each bar is one 15-minute slice. The tick is the median — the usual level at that time across the days in view. The box is the middle half of the days: tall means they disagreed, short means they agreed. The shaded band behind is a reference range, not a target.', cta: null },
  band: { title: 'The reference band', body: 'The shaded band is a reference drawn from non-diabetic glucose data for this phenotype — a backdrop for the eye, not a goal and not a diagnosis. Where it sits is a setting owned by MBH or the clinician. A reading outside it is described by its distance from the band, never labelled.', cta: null },
  mid3: { title: 'Midnight–3 AM', body: "The median of the deepest part of the night — midnight to 3 AM, before the pre-dawn rise. It is the body at rest with no food in play, so it reads the baseline the metabolism holds on its own. The useful comparison is against the daytime number: a midnight–3 AM that sits below the day suggests the daytime highs are about food, with the overnight engine idling clean; one that sits at or above the day points the other way — the night itself is elevated. It is one window among several and never a diagnosis, but it is often where a metabolic pattern shows before anything else does. If the kitchen and bar are closed by roughly 8 PM, this deep-night window may sit far enough from the last meal to stand in for the liver's own baseline output — a consideration when thinking about hepatic insulin sensitivity, and a good thing to raise with a clinician. A possibility to weigh, never a conclusion. The strip below shows each night on its own: bars that settle into the band are the nights the baseline held. A lone in-range night is worth noting but not yet a pattern — and a night with thin sensor coverage is dimmed, since a gap can read low without meaning it. What you are looking for is repetition — several in-range nights say the body can do this when conditions line up, and the notes on those days are where the reason hides.", cta: null },
  watched: { title: 'Watched moments', body: 'These are moments you tapped to watch as they happened — surfaced when your checking clusters closely together. The drill-down shows the reading around each one in full detail: your taps, plus about ninety minutes before and forty after, so you can see where it came from and where it went. Adding a note is what turns a watched moment into something you can learn from.', cta: null },
};
function InfoModal({ k, onClose, onRoute }) {
  if (!k) return null; const guide = k === 'guide'; const s = SAT[k];
  return (<div className="gcl-ovl" onClick={onClose}><div className="gcl-modal" onClick={e => e.stopPropagation()}>
    <div className="gcl-mhead"><span style={{ font: `400 17px ${SERIF}`, color: C.ink }}>{guide ? 'How to read your Glucose Summary' : s.title}</span><button className="gcl-x" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="gcl-mbody">
      {guide ? GUIDE.map(([h, b], i) => (<div key={i} style={{ marginBottom: 14 }}><div style={{ font: `600 11px ${SANS}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.sageDeep, marginBottom: 4 }}>{h}</div><div style={{ font: `400 13px/1.6 ${SANS}`, color: C.ink }}>{b}</div></div>))
        : (<><div style={{ font: `400 13.5px/1.6 ${SANS}`, color: C.ink }}>{s.body}</div>
          {s.cta && <button className="gcl-cta" onClick={() => onRoute(s.ctaKey)}>{s.cta}</button>}
          <button className="gcl-guidelink" onClick={() => onRoute('guide')}>Read the full guide →</button></>)}
    </div></div></div>);
}

function VoiceBox({ label, value, onChange, status, readOnly }) {
  const [listening, setListening] = useState(false); const recRef = useRef(null);
  const toggle = () => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setListening(l => !l); return; } // mock pulse where API absent
    try {
      if (listening && recRef.current) { recRef.current.stop(); setListening(false); return; }
      const r = new SR(); r.interimResults = false; r.continuous = true;
      r.onresult = e => { let s = ''; for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript; onChange((value ? value + ' ' : '') + s.trim()); };
      r.onend = () => setListening(false); recRef.current = r; r.start(); setListening(true);
    } catch (_) { setListening(l => !l); }
  };
  const statusText = status === 'saving' ? 'saving…' : status === 'saved' ? 'saved' : status === 'pending' ? '…'
    : status === 'error' ? "couldn't save" : status === 'local' ? 'sample — not saved' : '';
  return (<div className="gcl-vb">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.inkSoft }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {statusText && <span style={{ font: `400 9.5px ${MONO}`, color: status === 'error' ? C.clay : C.muted }}>{statusText}</span>}
        {!readOnly && <button className={'gcl-mic' + (listening ? ' on' : '')} onClick={toggle} aria-label={'Dictate ' + label}><MicIcon />{listening ? <span style={{ font: `500 10px ${SANS}` }}>listening…</span> : <span style={{ font: `500 10px ${SANS}` }}>dictate</span>}</button>}
      </span>
    </div>
    {readOnly
      ? (value
        ? <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink, whiteSpace: 'pre-wrap', padding: '2px 0' }}>{value}</div>
        : <div style={{ font: `400 12px/1.5 ${SANS}`, color: C.muted, fontStyle: 'italic', padding: '2px 0' }}>Nothing written this cycle.</div>)
      : <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={`${label} — type or dictate. The system shows the data; the words are yours.`} rows={2} className="gcl-ta" />}
  </div>);
}

function EventsList({ cyc, events, onOpen, openEvent }) {
  return (<div>
    <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.11em', textTransform: 'uppercase', color: C.muted, padding: '0 0 4px' }}>Events you watched</div>
    <div style={{ font: `400 10px/1.4 ${SANS}`, color: C.muted, paddingBottom: 8 }}>moments you tapped to watch unfold</div>
    {events.map((e, i) => {
      const sel = openEvent === e; return (<button key={i} onClick={() => onOpen(e)} className="gcl-row" style={{ alignItems: 'flex-start', background: sel ? 'rgba(40,48,43,0.05)' : 'transparent', borderLeft: `2px solid ${sel ? C.ink : 'transparent'}` }}>
        <span style={{ color: kColor(e.kind), font: `700 11px ${SANS}`, width: 12, flexShrink: 0, paddingTop: 1 }}>{kIcon(e.kind)}</span>
        <span style={{ minWidth: 0 }}><span style={{ font: `500 12px ${SANS}`, color: C.ink }}>{e.kind === 'LOW' ? `to ${e.lo}` : `to ${e.hi}`} mmol/L</span><span style={{ font: `400 11px ${SANS}`, color: C.muted }}> · {dWd(cyc, e.day)} {dDate(cyc, e.day)} {e.t0}</span></span>
      </button>);
    })}
  </div>);
}
function DayList({ cyc, scope, dayIdx, onPick }) {
  const noted = cyc.days.map((_, i) => i).filter(i => { const n = cyc.notes?.[i]; return Array.isArray(n) ? n.length > 0 : !!n; });
  return (<div>
    <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.11em', textTransform: 'uppercase', color: C.muted, padding: '0 0 8px' }}>Notes by day</div>
    {noted.length === 0 && <div style={{ font: `400 11px/1.5 ${SANS}`, color: C.muted, padding: '2px 0 8px' }}>No notes this cycle.</div>}
    {noted.map(i => {
      const wknd = dWk(cyc, i), sel = scope === 'one' && i === dayIdx, note = cyc.notes[i], list = Array.isArray(note) ? note : [{ time: null, text: note }];
      return (<button key={i} onClick={() => onPick(i)} className="gcl-row" style={{ alignItems: 'flex-start', borderLeft: `2px solid ${sel ? C.ink : 'transparent'}`, background: sel ? 'rgba(40,48,43,0.05)' : wknd ? 'rgba(110,126,134,0.06)' : 'transparent' }}>
        <span style={{ font: `400 12px ${MONO}`, color: wknd ? C.slate : C.inkSoft, width: 62, flexShrink: 0, textAlign: 'left', paddingTop: 1 }}>{dWd(cyc, i)} {dDate(cyc, i).replace(/[A-Za-z]+ /, '')}</span>
        <span style={{ font: `400 11px/1.5 ${SANS}`, color: C.ink, textAlign: 'left', whiteSpace: 'normal' }}>{list.map((n, k) => (<span key={k} style={{ display: 'block' }}>{n.text}</span>))}</span></button>);
    })}
    <div style={{ font: `400 10px/1.5 ${SANS}`, color: C.muted, paddingTop: 10, borderTop: `1px solid ${C.hairSoft}`, marginTop: 6 }}>Sensor active {cyc.sensor}% · historic only</div>
  </div>);
}

const dayNotes = (cyc, d) => { const n = cyc.notes?.[d]; if (!n) return []; return Array.isArray(n) ? n : [{ time: null, text: n }]; };
function DayJournal({ cyc, dayIdx, nudge }) {
  const notes = dayNotes(cyc, dayIdx);
  if (notes.length === 0) {
    if (!nudge) return null;
    return (<div style={{ marginTop: 12, padding: '11px 13px', border: `1px dashed ${C.hair}`, borderRadius: 10 }}>
      <div style={{ font: `400 12px/1.55 ${SANS}`, color: C.muted }}>Notes are filed to the day. This day has none.</div>
    </div>);
  }
  return (<div style={{ marginTop: 12, padding: '11px 13px', border: `1px solid ${C.hair}`, borderRadius: 10, background: C.paper }}>
    <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Notes this day</div>
    {notes.map((n, i) => (<div key={i} style={{ display: 'flex', gap: 10, paddingTop: i ? 8 : 0, borderTop: i ? `1px solid ${C.hairSoft}` : 'none', marginTop: i ? 8 : 0 }}>
      {n.time && <span style={{ font: `400 10px ${MONO}`, color: C.muted, flexShrink: 0, paddingTop: 2, minWidth: 62 }}>logged ~{n.time}</span>}
      <span style={{ font: `400 13px/1.55 ${SANS}`, color: C.ink }}>{n.text}</span>
    </div>))}
  </div>);
}

function Midnight3Strip({ cyc, onInfo }) {
  const bp = cyc.bandParams;
  const lo = bp.on[0], hi = bp.on[1], floor = bp.floor ?? 3.9;   // resolved band + floor
  const per = cyc.days.map((day, i) => { const v = day.filter(p => p.t < 180).map(p => p.g); const cov = v.length / 12; return { i, d: cyc.dates[i], m: v.length ? median(v) : null, ok: cov >= 0.5 }; });
  const N = per.length;
  const valid = per.filter(p => p.m != null && p.ok);
  const inb = valid.filter(p => p.m >= lo && p.m <= hi);
  const lows = valid.filter(p => p.m < floor);
  const cyc3 = median(per.filter(p => p.m != null).map(p => p.m));
  const rng = inb.length ? [Math.min(...inb.map(p => p.m)), Math.max(...inb.map(p => p.m))] : null;
  const allM = per.filter(p => p.m != null).map(p => p.m);
  const gmin = Math.min(floor - 0.4, ...allM), gmax = Math.max(hi + 0.6, ...allM);
  const W = 340, H = 64, pl = 2, pr = 2, pt = 6, pb = 4, bw = (W - pl - pr) / N;
  const Y = g => pt + (1 - (g - gmin) / (gmax - gmin)) * (H - pt - pb);
  const col = m => m == null ? C.hair : m < floor ? C.slate : (m >= lo && m <= hi) ? C.sage : C.muted;
  const fmt = x => x == null ? '—' : x.toFixed(1);
  let note;
  if (inb.length >= 3) note = 'On these nights the deep-night baseline is within band. Notes for those days, where present, are listed under Notes by day.';
  else if (inb.length >= 1) note = 'One or two nights are within band this cycle.';
  else note = 'No nights are within band this cycle.';
  return (<div style={{ margin: '2px 0 14px', padding: '12px 14px', border: `1px solid ${C.hair}`, borderRadius: 10, background: C.paper }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
      <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>Midnight–3 AM · possible liver baseline {onInfo && <InfoDot onClick={onInfo} />}</span>
      <span style={{ font: `400 10px ${MONO}`, color: C.inkSoft }}>in range on {inb.length} of {N} nights{rng ? ` · in-range ran ${fmt(rng[0])}–${fmt(rng[1])}` : ''} · median {fmt(cyc3)}{lows.length ? ` · ${lows.length} below range` : ''}</span>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <rect x={pl} y={Y(hi)} width={W - pl - pr} height={Math.max(0, Y(lo) - Y(hi))} fill={C.sage} opacity="0.14" />
      {floor > gmin && floor < gmax && <line x1={pl} y1={Y(floor)} x2={W - pr} y2={Y(floor)} stroke={C.slate} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />}
      {per.map(p => {
        const x = pl + bw * p.i, yTop = p.m == null ? H - pb - 3 : Y(p.m), h = p.m == null ? 3 : Math.max(3, (H - pb) - Y(p.m));
        return <rect key={p.i} x={x + bw * 0.18} y={yTop} width={bw * 0.64} height={h} rx="1.5" fill={col(p.m)} opacity={p.m == null ? 0.3 : p.ok ? 0.92 : 0.3} />;
      })}
    </svg>
    <div style={{ display: 'flex', gap: 0, marginTop: 2 }}>
      {per.map(p => (<span key={p.i} style={{ flex: 1, textAlign: 'center', font: `400 7.5px ${MONO}`, color: p.d.wknd ? C.slate : C.muted }}>{p.d.d.split(' ')[1]}</span>))}
    </div>
    <div style={{ font: `400 9.5px/1.5 ${MONO}`, color: C.muted, marginTop: 8 }}>{note} <span style={{ color: C.sage }}>■</span> in band {lo}–{hi} · <span style={{ color: C.slate }}>■</span> below {floor} · dimmed = thin coverage</div>
  </div>);
}

// ── Extras kept from the previous Glucose page: Related Markers + MicroHabits
// dropdowns (data via lib/glucose.js loadGlucoseExtras). Collapsed by default.
function Dropdown({ title, count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: SAGE_BG, border: '1px solid #cfc8ba', borderRadius: open ? '8px 8px 0 0' : 8, padding: '12px 16px' }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: SAGE_TEXT }}>{title}{count != null ? ` (${count})` : ''}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: APP_SLATE }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ border: '1px solid #cfc8ba', borderTop: 'none', borderRadius: '0 0 8px 8px', background: CARD, overflow: 'hidden' }}>{children}</div>}
    </div>
  );
}

function RelatedMarkers({ items }) {
  const cols = '1.6fr 1fr 1fr 1.2fr';
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '8px 16px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', borderBottom: `1px solid ${BORDER}` }}>
        <span>Marker</span><span style={{ textAlign: 'right' }}>Latest</span><span style={{ textAlign: 'right' }}>Previous</span><span style={{ textAlign: 'right' }}>Reference</span>
      </div>
      {items.map((m, i) => (
        <div key={m.code} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 16px', fontSize: 12.5, alignItems: 'center', borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
          <span style={{ color: APP_SLATE, fontWeight: 600 }}>{m.name}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', color: APP_SLATE }}>{m.latest ?? '—'}{m.latest && m.unit ? ` ${m.unit}` : ''}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>{m.previous ?? '—'}</span>
          <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>{m.reference}</span>
        </div>
      ))}
    </div>
  );
}

function MicroHabits({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
      {items.map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: OFFWHITE, borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${MBH_SAGE}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: APP_SLATE }}>{h.name}</div>
            {h.category && <div style={{ fontSize: 11, color: '#6b7280' }}>{h.category}</div>}
          </div>
          {h.frequency && <span style={{ fontSize: 11, fontWeight: 600, color: SAGE_TEXT, background: SAGE_BG, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>{h.frequency}</span>}
        </div>
      ))}
    </div>
  );
}

const EMPTY_VOICES = () => ({ member: { text: '', exists: false }, mbh: { text: '', exists: false }, clinician: { text: '', exists: false } });

export default function GlucoseSummaryPage() {
  const member = getStoredGuid() || DEV_MEMBER;
  const admin = isAdminSession();
  const [cycles, setCycles] = useState(null);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [extras, setExtras] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // API-CONNECT(cycles): GET cgm_cycle by member GUID (lib/glucoseCycle.js).
    // Serves the bundled MOCK cycle (amber "Sample cycle" banner) until the
    // Caspio table exists and this member has rows — no code change to go live.
    loadGlucoseCycles(member)
      .then((cs) => { if (!cancelled) setCycles(cs); })
      .catch((e) => { console.error('glucose cycles failed:', e); if (!cancelled) setCycles([]); });
    // Already live: Related Markers + MicroHabits from the existing tables
    // (system_parm, report_ready_result, marker_x_microhabit, …).
    loadGlucoseExtras(member)
      .then((x) => { if (!cancelled) setExtras(x); })
      .catch((e) => { console.warn('Glucose extras failed:', e); });
    return () => { cancelled = true; };
  }, []);

  const cyc = cycles && cycles[cycleIdx];
  const events = cyc ? cyc.events : [];
  const nDays = cyc ? cyc.days.length : 14;

  const [scope, setScope] = useState('all'); const [win, setWin] = useState('all'); const [dayIdx, setDayIdx] = useState(0);
  const [tab, setTab] = useState('days'); const [openEvent, setOpenEvent] = useState(null);
  const [infoKey, setInfoKey] = useState(null);
  const routeInfo = k => { if (k === 'days') { setTab('days'); setInfoKey(null); } else setInfoKey(k); };
  useEffect(() => { setDayIdx(0); setOpenEvent(null); setScope('all'); }, [cycleIdx]);

  // Voices — loaded per cycle, autosaved (debounced, serialized) to member_info.
  const [voices, setVoices] = useState(null);
  const [vStatus, setVStatus] = useState({});
  const voicesRef = useRef(null); voicesRef.current = voices;
  const timers = useRef({}); const queues = useRef({});
  useEffect(() => {
    if (!cyc) return;
    let cancelled = false;
    setVoices(null); setVStatus({});
    // API-CONNECT(voices-read): GET member_info CGM_VOICE_* rows for this
    // cycle (lib/glucoseCycle.js). While the MOCK sample cycle is showing,
    // the boxes stay local-only — nothing is fetched or written.
    if (cyc.sample) { setVoices(EMPTY_VOICES()); return; }
    loadVoices(member, cyc.endKey).then((v) => { if (!cancelled) setVoices(v); });
    return () => { cancelled = true; };
  }, [cyc && cyc.endKey]);
  useEffect(() => () => { for (const k in timers.current) clearTimeout(timers.current[k]); }, []);

  // API-CONNECT(voices-write): debounced autosave → saveVoice() PUTs/POSTs the
  // member_info row (lib/glucoseCycle.js). Requires the proxy to pass PUT for
  // member_info; skipped (status "sample — not saved") on the MOCK cycle.
  const editVoice = (key, text) => {
    setVoices((v) => v ? { ...v, [key]: { ...v[key], text } } : v);
    if (cyc.sample) { setVStatus((s) => ({ ...s, [key]: 'local' })); return; }
    setVStatus((s) => ({ ...s, [key]: 'pending' }));
    clearTimeout(timers.current[key]);
    const endKey = cyc.endKey;
    timers.current[key] = setTimeout(() => {
      queues.current[key] = (queues.current[key] || Promise.resolve()).then(async () => {
        setVStatus((s) => ({ ...s, [key]: 'saving' }));
        try {
          const exists = !!(voicesRef.current && voicesRef.current[key] && voicesRef.current[key].exists);
          await saveVoice(member, endKey, key, text, exists);
          setVoices((v) => v ? { ...v, [key]: { ...v[key], exists: true } } : v);
          setVStatus((s) => ({ ...s, [key]: 'saved' }));
        } catch (e) { console.error('voice save failed:', e); setVStatus((s) => ({ ...s, [key]: 'error' })); }
      });
    }, 1200);
  };

  const slices = useMemo(() => {
    if (!cyc) return [];
    return scope === 'one' ? daySlices(cyc.days[dayIdx]) : scope === 'weekday' ? cyc.bandWk : scope === 'weekend' ? cyc.bandWe : cyc.band;
  }, [cyc, scope, dayIdx]);

  const mid3PerDay = useMemo(() => cyc ? cyc.days.map(day => { const v = day.filter(p => p.t < 180).map(p => p.g); return v.length ? median(v) : null; }) : [], [cyc]);

  if (!cycles) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Loading…</div>;
  }
  if (!cyc) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No CGM cycles on record yet.</div>;
  }

  const bp = cyc.bandParams;
  const [onLo, onHi] = bp.on, [dLo, dHi] = bp.day;
  const ab = (v, top) => v != null && v > top ? C.amber : C.ink;
  const wkI = cyc.dates.map((x, i) => x.wknd ? null : i).filter(i => i != null), weI = cyc.dates.map((x, i) => x.wknd ? i : null).filter(i => i != null);
  const mid3 = scope === 'one' ? mid3PerDay[dayIdx] : scope === 'weekday' ? median(wkI.map(i => mid3PerDay[i])) : scope === 'weekend' ? median(weI.map(i => mid3PerDay[i])) : median(mid3PerDay.slice());
  const iv = scope === 'one' ? { lab: `${dWd(cyc, dayIdx)} ${dDate(cyc, dayIdx)}`, on: cyc.m[dayIdx].overnight, dt: cyc.m[dayIdx].daytime, m24: cyc.m[dayIdx].median, tar: cyc.m[dayIdx].tar / 60 }
    : scope === 'weekday' ? { lab: 'weekdays combined', on: cyc.wkOn, dt: cyc.wkDt, m24: cyc.median24, tar: cyc.wkTar }
      : scope === 'weekend' ? { lab: 'weekends combined', on: cyc.weOn, dt: cyc.weDt, m24: cyc.median24, tar: cyc.weTar }
        : { lab: `all ${nDays} days combined`, on: cyc.overnight, dt: cyc.daytime, m24: cyc.median24, tar: cyc.tarHrs };
  const scopeWord = scope === 'weekday' ? 'weekday' : scope === 'weekend' ? 'weekend' : '';
  const nScope = scope === 'weekday' ? wkI.length : scope === 'weekend' ? weI.length : nDays;
  const shownEvent = (scope === 'one' && openEvent && openEvent.day === dayIdx) ? openEvent : null;
  const noteCount = Object.values(cyc.notes || {}).reduce((a, n) => a + (Array.isArray(n) ? n.length : 1), 0);

  const openFromList = e => { setScope('one'); setDayIdx(e.day); setOpenEvent(e); setTab('watched'); };
  // Chevrons: in one-day scope they walk the days; otherwise they walk cycles
  // (left = older). Cycles are sorted newest first, so older = higher index.
  const step = d => {
    if (scope === 'one') { setDayIdx(a => (a + d + nDays) % nDays); setOpenEvent(null); }
    else setCycleIdx(i => Math.max(0, Math.min(cycles.length - 1, i - d)));
  };
  const stepDisabled = d => scope !== 'one' && (cycles.length < 2 || (d < 0 ? cycleIdx >= cycles.length - 1 : cycleIdx <= 0));

  return (<div className="gcl-wrap">
    <style>{`
      .gcl-wrap{background:${C.paper};min-height:100vh;font-family:${SANS};color:${C.ink};padding:18px;box-sizing:border-box;-webkit-font-smoothing:antialiased;}
      .gcl-card{width:100%;background:${C.panel};border:1px solid ${C.hair};border-radius:14px;overflow:hidden;box-shadow:0 8px 30px -22px rgba(40,48,43,.5);}
      .gcl-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 0;flex-wrap:wrap;}
      .gcl-pager{display:flex;align-items:center;gap:4px;}.gcl-ic{width:30px;height:30px;border-radius:8px;border:1px solid ${C.hair};background:${C.panel};color:${C.ink};display:grid;place-items:center;cursor:pointer;}
      .gcl-ic:hover{background:rgba(40,48,43,.05);}.gcl-ic:disabled{opacity:.3;cursor:default;}
      .gcl-ctrls{display:flex;gap:16px;flex-wrap:wrap;padding:12px 20px 0;align-items:center;}
      .gcl-ctrl{display:flex;align-items:center;gap:8px;}.gcl-ctrl .cl{font:600 9px ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${C.muted};}
      .gcl-seg{display:inline-flex;background:rgba(40,48,43,.06);border-radius:9px;padding:3px;gap:2px;}
      .gcl-seg button{border:0;background:transparent;font:600 11.5px ${SANS};color:${C.inkSoft};padding:6px 11px;border-radius:7px;cursor:pointer;}
      .gcl-seg button[aria-pressed=true]{background:${C.ink};color:${C.panel};}
      .gcl-banner{display:flex;align-items:center;gap:10px;margin:12px 20px 0;padding:9px 12px;border:1px solid ${C.hair};border-radius:10px;background:${C.paper};cursor:pointer;}
      .gcl-sample{display:flex;align-items:center;gap:10px;margin:12px 20px 0;padding:9px 12px;border:1px solid ${C.amber};border-radius:10px;background:rgba(200,146,63,0.08);font:500 12px ${SANS};color:${C.ink};}
      .gcl-body{display:flex;}.gcl-main{flex:1 1 auto;min-width:0;padding:14px 20px 18px;}
      .gcl-side{flex:0 0 244px;padding:14px 14px 18px;border-left:1px solid ${C.hair};background:${C.paper};}
      .gcl-row{display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;text-align:left;padding:6px 8px;cursor:pointer;border-radius:6px;transition:opacity .15s;}
      .gcl-row:hover{background:rgba(40,48,43,.05)!important;}
      .gcl-measures{display:flex;gap:22px;flex-wrap:wrap;align-items:stretch;margin:8px 0 12px;padding:14px 16px;border:1px solid ${C.hair};border-radius:10px;background:${C.paper};}
      .gcl-lead{display:flex;align-items:center;padding-right:22px;border-right:1px solid ${C.hair};flex:0 0 auto;}
      .gcl-grid4{flex:1 1 320px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 28px;align-content:center;}
      .gcl-method{font:400 10px/1.5 ${MONO};color:${C.muted};margin:12px 0;padding:8px 12px;border-radius:8px;background:rgba(40,48,43,.04);}
      .gcl-moment{margin-top:13px;padding:13px 15px;background:${C.paper};border:1px solid ${C.hair};border-radius:11px;}
      .gcl-sidetab{display:inline-flex;background:rgba(40,48,43,.06);border-radius:8px;padding:3px;gap:2px;margin-bottom:10px;}
      .gcl-sidetab button{border:0;background:transparent;font:600 10.5px ${SANS};color:${C.inkSoft};padding:5px 10px;border-radius:6px;cursor:pointer;}
      .gcl-sidetab button[aria-pressed=true]{background:${C.ink};color:${C.panel};}
      .gcl-voices{margin-top:16px;display:flex;flex-direction:column;gap:10px;}
      .gcl-vb{border:1px solid ${C.hair};border-radius:10px;background:${C.paper};padding:10px 12px;}
      .gcl-mic{display:inline-flex;align-items:center;gap:5px;border:1px solid ${C.hair};background:${C.panel};border-radius:7px;padding:3px 8px;color:${C.inkSoft};cursor:pointer;}
      .gcl-mic.on{border-color:${C.clay};color:${C.clay};}
      .gcl-ta{width:100%;box-sizing:border-box;border:1px solid ${C.hair};border-radius:8px;background:${C.panel};padding:8px 10px;font:400 13px/1.5 ${SANS};color:${C.ink};resize:vertical;}
      .gcl-foot{font:400 11px/1.6 ${SANS};color:${C.muted};padding:0 20px 16px;}
      .gcl-info{display:inline-grid;place-items:center;border:0;background:transparent;color:${C.muted};cursor:pointer;padding:0;width:15px;height:15px;flex-shrink:0;}
      .gcl-info:hover{color:${C.sageDeep};}
      .gcl-guide{display:inline-flex;align-items:center;gap:5px;border:1px solid ${C.hair};background:${C.panel};border-radius:8px;padding:5px 10px;font:600 10.5px ${SANS};color:${C.inkSoft};cursor:pointer;}
      .gcl-guide:hover{border-color:${C.sageDeep};color:${C.sageDeep};}
      .gcl-ovl{position:fixed;inset:0;background:rgba(40,48,43,.34);display:grid;place-items:center;padding:20px;z-index:50;}
      .gcl-modal{background:${C.panel};border:1px solid ${C.hair};border-radius:14px;max-width:540px;width:100%;max-height:84vh;display:flex;flex-direction:column;box-shadow:0 24px 60px -20px rgba(40,48,43,.6);}
      .gcl-mhead{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid ${C.hair};}
      .gcl-x{border:0;background:transparent;font:400 15px ${SANS};color:${C.muted};cursor:pointer;width:28px;height:28px;border-radius:7px;}.gcl-x:hover{background:rgba(40,48,43,.06);}
      .gcl-mbody{padding:16px 18px;overflow:auto;}
      .gcl-cta{display:block;margin-top:14px;border:0;background:${C.ink};color:${C.panel};border-radius:9px;padding:9px 14px;font:600 12.5px ${SANS};cursor:pointer;}
      .gcl-guidelink{display:block;margin-top:10px;border:0;background:transparent;color:${C.sageDeep};font:600 12px ${SANS};cursor:pointer;padding:4px 0;}
      .gcl-extras{width:100%;margin:16px auto 0;}
      @media (max-width:720px){.gcl-body{flex-direction:column;}.gcl-side{flex-basis:auto;border-left:0;border-top:1px solid ${C.hair};}
        .gcl-lead{border-right:0;border-bottom:1px solid ${C.hair};padding-right:0;padding-bottom:12px;width:100%;}.gcl-grid4{flex-basis:100%;}}
      .gcl-wrap button:focus-visible,.gcl-ta:focus-visible{outline:2px solid ${C.sageDeep};outline-offset:2px;}
      @media (prefers-reduced-motion:reduce){*{transition:none!important;}}
    `}</style>
    <div className="gcl-card">
      <div className="gcl-head">
        <div>
          <div style={{ font: `400 11px ${SANS}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted }}>glucose · cycle {cycleIdx + 1} of {cycles.length}</div>
          <div style={{ font: `400 21px/1.1 ${SERIF}`, marginTop: 3 }}>{cyc.cycleLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}><span style={{ font: `400 10px ${MONO}`, color: C.muted }}>reference band · {bp.src} · overnight {onLo}–{onHi} · daytime {dLo}–{dHi}</span><InfoDot onClick={() => setInfoKey('band')} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button className="gcl-guide" onClick={() => setInfoKey('guide')}><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.6" r="0.95" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>How to read this</button>
          <div className="gcl-pager"><span style={{ font: `400 11px ${MONO}`, color: C.muted, marginRight: 6 }}>{scope === 'one' ? `${dWd(cyc, dayIdx)} ${dDate(cyc, dayIdx)} · day ${dayIdx + 1}/${nDays}` : `cycle ${cycleIdx + 1} / ${cycles.length}`}</span>
            <button className="gcl-ic" onClick={() => step(-1)} disabled={stepDisabled(-1)} aria-label="Previous"><Chevron dir="left" /></button>
            <button className="gcl-ic" onClick={() => step(1)} disabled={stepDisabled(1)} aria-label="Next"><Chevron dir="right" /></button>
          </div>
        </div>
      </div>

      {cyc.sample && (<div className="gcl-sample">
        <span style={{ font: `700 12px ${SANS}`, color: C.amber }}>◈</span>
        <span>Sample cycle — your live CGM cycles will appear here automatically once they're on record.</span>
      </div>)}

      <div className="gcl-banner" onClick={() => setTab('days')} role="button">
        <span style={{ font: `700 12px ${SANS}`, color: C.sageDeep }}>✎</span>
        <span style={{ font: `500 12.5px ${SANS}`, color: C.ink }}>{noteCount} Notes this Cycle</span>
      </div>

      <div className="gcl-ctrls">
        <div className="gcl-ctrl"><span className="cl">Days</span><div className="gcl-seg" role="group" aria-label="Day scope">
          {[['all', `All ${nDays}`], ['weekday', 'Weekdays'], ['weekend', 'Weekends'], ['one', 'One day']].map(([k, l]) => (<button key={k} aria-pressed={scope === k} onClick={() => { setScope(k); if (k !== 'one') setOpenEvent(null); }}>{l}</button>))}</div></div>
      </div>

      <div className="gcl-body">
        <div className="gcl-main">
          <div className="gcl-measures">
            <div className="gcl-lead"><Measure big label="Time above 7.8" value={sf(iv.tar)} unit={scope === 'one' ? 'hrs · this day' : scope === 'weekday' ? 'hrs · median weekday' : scope === 'weekend' ? 'hrs · median weekend' : 'hrs · median day'} tone={iv.tar > 1 ? C.amber : C.ink} onInfo={() => setInfoKey('tar')} /></div>
            <div className="gcl-grid4">
              <Measure label="24h median" value={sf(iv.m24)} unit="mmol/L" tone={C.ink} />
              <Measure label="Daytime" value={sf(iv.dt)} unit="mmol/L" band={bp.day} tone={ab(iv.dt, dHi)} />
              <Measure label="Overnight" value={sf(iv.on)} unit="mmol/L" band={bp.on} tone={ab(iv.on, onHi)} />
              <Measure label="Midnight–3 AM" value={sf(mid3)} unit="mmol/L" band={bp.on} tone={ab(mid3, onHi)} onInfo={() => setInfoKey('mid3')} />
            </div>
          </div>
          {scope !== 'one' && <DailyTARStrip cyc={cyc} />}
          {scope !== 'one' && <Midnight3Strip cyc={cyc} onInfo={() => setInfoKey('mid3')} />}
          {/* Window control lives with the plot it changes, not in the header. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ font: `400 12px/1.55 ${SANS}`, color: C.inkSoft, flex: 1 }}>
                {scope === 'one'
                  ? <>One real day — {dDate(cyc, dayIdx)}, 15-minute readings as ticks.</>
                  : <>A <b>typical {scopeWord} day</b> built from {nScope} days. Each bar is one 15-minute slice — the <b>tick</b> is the usual level, the <b>box</b> is how much it varied across days.</>}
              </div>
              <div style={{ paddingTop: 1 }}><InfoDot onClick={() => setInfoKey('chart')} /></div>
            </div>
            <div className="gcl-ctrl" style={{ flexShrink: 0 }}><span className="cl">Window</span><div className="gcl-seg" role="group" aria-label="Time window">
              {[['all', 'Full day'], ['daytime', 'Daytime'], ['overnight', 'Overnight'], ['mid3', 'Midnight–3 AM']].map(([k, l]) => (<button key={k} aria-pressed={win === k} onClick={() => setWin(k)}>{l}</button>))}</div></div>
          </div>
          <Chart slices={slices} win={win} bp={bp} />
          <div className="gcl-method">method · historic readings, de-duplicated · median of daily medians · overnight 22:00–06:00 · midnight–3 AM 00:00–03:00 · band {onLo}–{onHi} · 24h median shown as a number, not a line · time above 7.8 = median day (not the AGP pooled average) — see daily spread</div>

          {scope === 'one' && !shownEvent && <DayJournal cyc={cyc} dayIdx={dayIdx} nudge />}

          {shownEvent && (<div className="gcl-moment">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: kColor(shownEvent.kind), font: `700 12px ${SANS}` }}>{kIcon(shownEvent.kind)}</span>
              <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>Watched moment · {dWd(cyc, shownEvent.day)} {dDate(cyc, shownEvent.day)} {shownEvent.t0}</span></div>
            <ContextArc ev={shownEvent} cyc={cyc} />
            <div style={{ font: `400 11px/1.5 ${SANS}`, color: C.muted, marginTop: 8 }}>The reading around this moment — your taps in full detail, with about 90 minutes before and 40 after for context. The shaded stretch is the part you watched.</div>
            <DayJournal cyc={cyc} dayIdx={shownEvent.day} nudge />
          </div>)}
        </div>
        <div className="gcl-side">
          <div className="gcl-sidetab" role="group" aria-label="Side panel">
            {[['days', 'Notes by day'], ...(events.length ? [['watched', 'Watched']] : [])].map(([k, l]) => (<button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>))}
          </div>
          {tab === 'days' ? <DayList cyc={cyc} scope={scope} dayIdx={dayIdx} onPick={i => { setScope('one'); setDayIdx(i); setOpenEvent(null); }} />
            : <EventsList cyc={cyc} events={events} onOpen={openFromList} openEvent={openEvent} />}
        </div>
      </div>
      <div style={{ padding: '4px 20px 4px' }}>
        <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, margin: '6px 0 4px' }}>The three voices · this cycle</div>
        <div style={{ font: `400 11px/1.5 ${SANS}`, color: C.muted, marginBottom: 10 }}>The screen shows the data; what it means is written here, by people, attributed to who said it.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
          {voices
            ? (<>
              <VoiceBox label="Member" value={voices.member.text} onChange={t => editVoice('member', t)} status={vStatus.member} />
              <VoiceBox label="MBH" value={voices.mbh.text} onChange={t => editVoice('mbh', t)} status={vStatus.mbh} readOnly={!admin} />
              <VoiceBox label="Clinician" value={voices.clinician.text} onChange={t => editVoice('clinician', t)} status={vStatus.clinician} readOnly={!admin} />
            </>)
            : <div style={{ font: `400 11px ${SANS}`, color: C.muted, padding: '8px 0' }}>Loading voices…</div>}
        </div>
      </div>
      <div className="gcl-foot">The system measures and shows; it does not narrate. Numbers are given with their reference band and coloured only as an ambient signal — no verdicts. Interpretation lives in the three voices above. Historic CGM readings reconciled to the 15-minute grid; dictation uses the browser's speech input where available.</div>
    </div>

    <div className="gcl-extras">
      {extras && extras.relatedMarkers.length > 0 && (
        <Dropdown title="Related Markers" count={extras.relatedMarkers.length}>
          <RelatedMarkers items={extras.relatedMarkers} />
        </Dropdown>
      )}
      {extras && extras.microHabits.length > 0 && (
        <Dropdown title="MicroHabits" count={extras.microHabits.length}>
          <MicroHabits items={extras.microHabits} />
        </Dropdown>
      )}
      <PersonalNote noteKey="glucose" />
    </div>

    <InfoModal k={infoKey} onClose={() => setInfoKey(null)} onRoute={routeInfo} />
  </div>);
}
