// Glucose Summary V2 — the "measures and shows, never narrates" CGM cycle viewer.
// Reads a pre-computed cycle blob from glucose_cycle (built by the admin loader
// from a LibreView CSV) instead of hardcoded data. Palette harmonised with the
// rest of V2 (constants.js). The screen measures; people write the story in the
// three voice boxes. 24h median is a number, never a line.
import { useState, useMemo, useRef, useEffect } from 'react';
import { MBH_SAGE, SAGE_TEXT, AMBER, SLATE, OFFWHITE, CARD, SOFT_RED, TEAL } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { DEV_MEMBER } from '../lib/biomarkers.js';

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';

// Palette mapped onto V2's colours (sage/amber/clay/slate) so this reads as part
// of the app while keeping the viewer's calm, editorial structure.
const C = {
  paper: OFFWHITE, panel: CARD, ink: SLATE, inkSoft: '#4b5a4f', muted: '#8a93a5',
  hair: 'rgba(30,45,61,0.12)', hairSoft: 'rgba(30,45,61,0.07)',
  sage: MBH_SAGE, sageDeep: SAGE_TEXT, healthy: 'rgba(74,124,111,0.16)',
  amber: AMBER, clay: SOFT_RED, horizon: SLATE, slate: TEAL, box: 'rgba(30,45,61,0.13)',
};
// Match the rest of V2: DM Sans for text, DM Serif Display for big display numbers.
// (No monospace — V2 only uses it for tabular columns, which this page has none of.)
const SERIF = "'DM Serif Display',Georgia,serif";
const SANS = "'DM Sans',-apple-system,ui-sans-serif,system-ui,sans-serif";
const MONO = SANS;
const SAMPLES = 96, STEP = 15, TH_HI = 7.8, TH_VHI = 10;
const dWd = (c, i) => c.dates[i].wd, dDate = (c, i) => c.dates[i].d, dWk = (c, i) => c.dates[i].wknd;
const BAND = { src: 'MBH phenotype', on: [4.5, 5.5], day: [4.8, 6.0], floor: 3.9 };  // reference params

function daySlices(p) { const sl = new Array(SAMPLES).fill(null); for (const d of p) { const s = Math.round(d.t / STEP); if (s >= 0 && s < SAMPLES) sl[s] = { t: s * STEP, p25: d.g, p50: d.g, p75: d.g }; } return sl; }
const VB_W = 720, VB_H = 300, PAD_L = 34, PAD_R = 14, PAD_T = 22, PAD_B = 26;
const Y_MIN = 3, Y_MAX = 11.5; const yOf = g => PAD_T + (1 - (Math.min(Y_MAX, Math.max(Y_MIN, g)) - Y_MIN) / (Y_MAX - Y_MIN)) * (VB_H - PAD_T - PAD_B);
const raw = p => p.map((q, i) => `${i ? 'L' : 'M'} ${q.x} ${q.y}`).join(' ');
function Chevron({ dir }) { return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d={dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M6 3 L11 8 L6 13'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>); }
function MicIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>); }

function Chart({ slices, win }) {
  const [onLo, onHi] = BAND.on, [dLo, dHi] = BAND.day;
  const zoom = win === 'mid3';
  const dom = zoom ? [0, 180] : [0, 1440];
  const X = t => PAD_L + ((t - dom[0]) / (dom[1] - dom[0])) * (VB_W - PAD_L - PAD_R);
  const nSlot = (dom[1] - dom[0]) / STEP; const slotW = (VB_W - PAD_L - PAD_R) / nSlot;
  const inWin = t => win === 'all' ? true : win === 'overnight' ? (t < 6 * 60 || t >= 22 * 60) : win === 'daytime' ? (t >= 6 * 60 && t < 22 * 60) : (t < 180);
  const gridH = zoom ? [0, 1, 2, 3] : [0, 6, 12, 18, 24];
  const bars = slices.map((s, i) => { if (!s || s.p50 == null) return null; const t = i * STEP; if (zoom && (t < dom[0] || t >= dom[1])) return null;
    const cx = X(t) + slotW / 2, bw = Math.max(1.5, slotW * 0.62), dim = !zoom && !inWin(t);
    const yhi = yOf(s.p75), ylo = yOf(s.p25), ym = yOf(s.p50), boxH = Math.max(0, ylo - yhi);
    return (<g key={i} opacity={dim ? 0.16 : 1}>{boxH > 0.8 && <rect x={cx - bw / 2} y={yhi} width={bw} height={boxH} rx={1} fill={C.box} />}<line x1={cx - bw / 2} y1={ym} x2={cx + bw / 2} y2={ym} stroke={C.ink} strokeWidth={1.7} strokeLinecap="round" /></g>); });
  return (<svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Glucose by 15-minute slice">
    {zoom
      ? <rect x={X(0)} y={yOf(onHi)} width={X(180) - X(0)} height={yOf(onLo) - yOf(onHi)} fill={C.healthy} />
      : <>
        <rect x={X(0)} y={yOf(onHi)} width={X(6 * 60) - X(0)} height={yOf(onLo) - yOf(onHi)} fill={C.healthy} />
        <rect x={X(6 * 60)} y={yOf(dHi)} width={X(22 * 60) - X(6 * 60)} height={yOf(dLo) - yOf(dHi)} fill={C.healthy} />
        <rect x={X(22 * 60)} y={yOf(onHi)} width={X(24 * 60) - X(22 * 60)} height={yOf(onLo) - yOf(onHi)} fill={C.healthy} /></>}
    <text x={zoom ? X(90) : X(13 * 60)} y={yOf(zoom ? onHi : dHi) - 3} textAnchor={zoom ? 'middle' : 'start'} style={{ font: `400 8.5px ${MONO}`, fill: C.sageDeep }}>{zoom ? 'overnight band 4.5–5.5 (reference)' : 'healthy band (reference)'}</text>
    {gridH.map(h => (<line key={h} x1={X(h * 60)} y1={PAD_T} x2={X(h * 60)} y2={VB_H - PAD_B} stroke={C.hairSoft} />))}
    <line x1={PAD_L} y1={yOf(TH_VHI)} x2={VB_W - PAD_R} y2={yOf(TH_VHI)} stroke={C.clay} strokeWidth="1" strokeDasharray="2 4" opacity=".4" />
    <text x={PAD_L - 6} y={yOf(TH_VHI) + 3} textAnchor="end" style={{ font: `400 9px ${MONO}`, fill: C.muted }}>10</text>
    {bars}
    <line x1={PAD_L} y1={yOf(TH_HI)} x2={VB_W - PAD_R} y2={yOf(TH_HI)} stroke={C.horizon} strokeWidth="1.5" />
    <text x={PAD_L - 6} y={yOf(TH_HI) + 3} textAnchor="end" style={{ font: `600 9px ${MONO}`, fill: C.horizon }}>7.8</text>
    {zoom && <text x={(X(0) + X(180)) / 2} y={PAD_T - 8} textAnchor="middle" style={{ font: `600 9px ${MONO}`, fill: C.sageDeep }}>Midnight–3 AM · zoomed</text>}
    {gridH.map(h => (<text key={h} x={X(h * 60)} y={VB_H - 8} textAnchor="middle" style={{ font: `400 9px ${MONO}`, fill: C.muted }}>{String(h).padStart(2, '0')}:00</text>))}
  </svg>);
}

function ContextArc({ ev, cyc }) {
  const W = 340, Hh = 152, pl = 30, pr = 12, pt = 16, pb = 22;
  const grid = (cyc.days[ev.day] || []).slice().sort((a, b) => a.t - b.t);
  const b = ev.burst.slice().sort((a, b) => a.t - b.t);
  const isLow = ev.kind === 'LOW';
  const firstTap = b[0].t, lastTap = b[b.length - 1].t;
  const lT = firstTap - 90, rT = lastTap + 40;
  const leftC = grid.filter(p => p.t <= lT), rightC = grid.filter(p => p.t >= rT);
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
  const maxMin = Math.max(60, ...per.map(p => p.min));
  const sorted = per.map(p => p.min).slice().sort((a, b) => a - b);
  const med = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 / 60;
  const nGE1 = per.filter(p => p.min >= 60).length;
  const peak = per.reduce((a, p) => p.min > a.min ? p : a);
  const lbl = d => `${d.wd}-${d.d.split(' ')[1]}`;
  return (<div style={{ margin: '2px 0 14px', padding: '12px 14px', border: `1px solid ${C.hair}`, borderRadius: 10, background: C.paper }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>Time above 7.8 · by day</span>
      <span style={{ font: `400 10px ${MONO}`, color: C.inkSoft }}>{nGE1} of {per.length} days past the first hour · median {med.toFixed(1)} h · peak {lbl(peak.d)} {(peak.min / 60).toFixed(2)} h</span>
    </div>
    <div style={{ position: 'relative', height: 52 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(4, (60 / maxMin) * 48)}px`, background: C.healthy, borderRadius: 3, pointerEvents: 'none' }}><span style={{ position: 'absolute', right: 2, top: -11, font: `400 7.5px ${MONO}`, color: C.sageDeep }}>1 h</span></div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
        {per.map(p => { const h = Math.max(3, (p.min / maxMin) * 48), isPk = p.i === peak.i; const col = p.min >= 60 ? C.amber : p.min > 0 ? C.sage : C.hair;
          return (<div key={p.i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {isPk && <span style={{ font: `600 8.5px ${MONO}`, color: C.amber, marginBottom: 1 }}>{(p.min / 60).toFixed(1)}</span>}
            <div title={`${lbl(p.d)} · ${(p.min / 60).toFixed(2)} h`} style={{ width: '100%', maxWidth: 16, height: h, borderRadius: 2, background: col, opacity: isPk ? 1 : p.min > 0 ? 0.85 : 0.55, outline: isPk ? `1.5px solid ${C.ink}` : 'none' }} />
          </div>); })}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
      {per.map(p => (<span key={p.i} style={{ flex: 1, textAlign: 'center', font: `400 7.5px ${MONO}`, color: p.d.wknd ? C.slate : C.muted }}>{p.d.d.split(' ')[1]}</span>))}
    </div>
    <div style={{ font: `400 9.5px/1.5 ${MONO}`, color: C.muted, marginTop: 8 }}>one bar, one day. the shaded band is the first hour — a well-regulated day stays within it. the median ({med.toFixed(1)} h) is the middle day; a few days carry most of the total, which is why a median can read calmer than the fortnight was.</div>
  </div>);
}

function InfoDot({ onClick }) { return (<button className="gv2-info" onClick={e => { e.stopPropagation(); onClick(); }} aria-label="What does this mean?"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.6" r="0.95" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>); }

const GUIDE = [
  ['One cycle, one chart', "You're looking at a single 14-day cycle. The day is cut into 96 fifteen-minute slices, and every picture on this screen is built from those same slices — what changes is how many days feed them and which hours you look at."],
  ['The bars', 'Each bar is one 15-minute slice. The tick across it is the median — the middle level at that time of day across the days in view. The box around it is the middle half of the days (the 25th to 75th percentile): a tall box means the days disagreed at that time, a short box means they agreed.'],
  ['Median, not average', 'Every number here is a median. An average lets one unusual day pull the whole figure; a median reports the middle and stays steady. That is why a single busy day does not move the picture much — and why the bars describe a usual day rather than any one day.'],
  ['The four numbers', 'Time above 7.8 is a total — it adds every 15 minutes spent above 7.8 and takes the median across the days. The 24h median is a single middle level for the whole day, shown as a number on purpose. Overnight and daytime are the medians of those two stretches, each shown next to its reference band. Midnight–3 AM is a narrower window inside the night — the deep, food-free hours.'],
  ['The reference band', 'The shaded band is a reference range drawn from non-diabetic glucose data for this phenotype — a backdrop for the eye, not a target to reach and not a diagnosis. A reading outside it is described by its distance from the band, never given a label.'],
  ['Days and window', 'Two controls, one chart. Days choose which days feed every slice — all of them, weekdays, weekends, or one real day. Window chooses which hours you look at.'],
  ['Watched moments', 'These are moments you chose to watch as they happened, kept at full resolution rather than averaged away. Each opens with context — the reading before and after, not just the peak.'],
  ['Who writes the story', 'The screen measures and shows; it does not interpret. What the numbers mean is written by people — in the Member, MBH, and Clinician boxes.'],
];
const SAT = {
  tar: { title: 'Time above 7.8', body: 'This is a total, not a typical day. It adds up every 15 minutes that sat above 7.8, then takes the median across the days. The bars answer a different question — where a usual day sits — which can stay below 7.8 even when a few days spend time above it. The daily-spread strip shows exactly which ones. Note this median differs on purpose from a Libre/AGP report, which pools every reading into one average day — that pooled figure runs higher whenever a few days carry most of the load.', cta: 'Open the Days tab to see which days →', ctaKey: 'days' },
  chart: { title: 'Reading the chart', body: 'Each bar is one 15-minute slice. The tick is the median — the usual level at that time across the days in view. The box is the middle half of the days: tall means they disagreed, short means they agreed. The shaded band behind is a reference range, not a target.', cta: null },
  band: { title: 'The reference band', body: 'The shaded band is a reference drawn from non-diabetic glucose data for this phenotype — a backdrop for the eye, not a goal and not a diagnosis. A reading outside it is described by its distance from the band, never labelled.', cta: null },
  mid3: { title: 'Midnight–3 AM', body: 'The median of the deepest part of the night — midnight to 3 AM, before the pre-dawn rise. It is the body at rest with no food in play, so it reads the baseline the metabolism holds on its own. The useful comparison is against the daytime number: a midnight–3 AM that sits below the day suggests the daytime highs are about food; one that sits at or above the day points the other way. It is one window among several and never a diagnosis. The strip below shows each night on its own — a night with thin sensor coverage is dimmed, since a gap can read low without meaning it.', cta: null },
  watched: { title: 'Watched moments', body: 'These are moments you tapped to watch as they happened — surfaced when your checking clusters closely together. The drill-down shows the reading around each one in full detail: your taps, plus about ninety minutes before and forty after. Adding a note is what turns a watched moment into something you can learn from.', cta: null },
};
function InfoModal({ k, onClose, onRoute }) {
  if (!k) return null; const guide = k === 'guide'; const s = SAT[k];
  return (<div className="gv2-ovl" onClick={onClose}><div className="gv2-modal" onClick={e => e.stopPropagation()}>
    <div className="gv2-mhead"><span style={{ font: `400 17px ${SERIF}`, color: C.ink }}>{guide ? 'How to read your Glucose Summary' : s.title}</span><button className="gv2-x" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="gv2-mbody">
      {guide ? GUIDE.map(([h, b], i) => (<div key={i} style={{ marginBottom: 14 }}><div style={{ font: `600 11px ${SANS}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.sageDeep, marginBottom: 4 }}>{h}</div><div style={{ font: `400 13px/1.6 ${SANS}`, color: C.ink }}>{b}</div></div>))
        : (<><div style={{ font: `400 13.5px/1.6 ${SANS}`, color: C.ink }}>{s.body}</div>
          {s.cta && <button className="gv2-cta" onClick={() => onRoute(s.ctaKey)}>{s.cta}</button>}
          <button className="gv2-guidelink" onClick={() => onRoute('guide')}>Read the full guide →</button></>)}
    </div></div></div>);
}

function VoiceBox({ label, value, onChange }) {
  const [listening, setListening] = useState(false); const recRef = useRef(null);
  const toggle = () => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setListening(l => !l); return; }
    try {
      if (listening && recRef.current) { recRef.current.stop(); setListening(false); return; }
      const r = new SR(); r.interimResults = false; r.continuous = true;
      r.onresult = e => { let s = ''; for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript; onChange((value ? value + ' ' : '') + s.trim()); };
      r.onend = () => setListening(false); recRef.current = r; r.start(); setListening(true);
    } catch (_) { setListening(l => !l); }
  };
  return (<div className="gv2-vb">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.inkSoft }}>{label}</span>
      <button className={'gv2-mic' + (listening ? ' on' : '')} onClick={toggle} aria-label={'Dictate ' + label}><MicIcon />{listening ? <span style={{ font: `500 10px ${SANS}` }}>listening…</span> : <span style={{ font: `500 10px ${SANS}` }}>dictate</span>}</button>
    </div>
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={`${label} — type or dictate. The system shows the data; the words are yours.`} rows={2} className="gv2-ta" />
  </div>);
}

function EventsList({ cyc, events, onOpen, openEvent }) {
  return (<div>
    <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.11em', textTransform: 'uppercase', color: C.muted, padding: '0 0 4px' }}>Events you watched</div>
    <div style={{ font: `400 10px/1.4 ${SANS}`, color: C.muted, paddingBottom: 8 }}>moments you tapped to watch unfold</div>
    {events.map((e, i) => { const sel = openEvent === e; return (<button key={i} onClick={() => onOpen(e)} className="gv2-row" style={{ alignItems: 'flex-start', background: sel ? 'rgba(30,45,61,0.05)' : 'transparent', borderLeft: `2px solid ${sel ? C.ink : 'transparent'}` }}>
      <span style={{ color: kColor(e.kind), font: `700 11px ${SANS}`, width: 12, flexShrink: 0, paddingTop: 1 }}>{kIcon(e.kind)}</span>
      <span style={{ minWidth: 0 }}><span style={{ font: `500 12px ${SANS}`, color: C.ink }}>{e.kind === 'LOW' ? `to ${e.lo}` : `to ${e.hi}`} mmol/L</span><span style={{ font: `400 11px ${SANS}`, color: C.muted }}> · {dWd(cyc, e.day)} {dDate(cyc, e.day)} {e.t0}</span></span>
    </button>); })}
  </div>);
}
function DayList({ cyc, scope, dayIdx, onPick }) {
  const noted = cyc.days.map((_, i) => i).filter(i => { const n = cyc.notes?.[i]; return Array.isArray(n) ? n.length > 0 : !!n; });
  return (<div>
    <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.11em', textTransform: 'uppercase', color: C.muted, padding: '0 0 8px' }}>Notes by day</div>
    {noted.length === 0 && <div style={{ font: `400 11px/1.5 ${SANS}`, color: C.muted, padding: '2px 0 8px' }}>No notes this cycle.</div>}
    {noted.map(i => { const wknd = dWk(cyc, i), sel = scope === 'one' && i === dayIdx, note = cyc.notes[i], list = Array.isArray(note) ? note : [{ time: null, text: note }];
      return (<button key={i} onClick={() => onPick(i)} className="gv2-row" style={{ alignItems: 'flex-start', borderLeft: `2px solid ${sel ? C.ink : 'transparent'}`, background: sel ? 'rgba(30,45,61,0.05)' : wknd ? 'rgba(15,125,140,0.06)' : 'transparent' }}>
        <span style={{ font: `400 12px ${MONO}`, color: wknd ? C.slate : C.inkSoft, width: 62, flexShrink: 0, textAlign: 'left', paddingTop: 1 }}>{dWd(cyc, i)} {dDate(cyc, i).replace(/[A-Za-z]+ /, '')}</span>
        <span style={{ font: `400 11px/1.5 ${SANS}`, color: C.ink, textAlign: 'left', whiteSpace: 'normal' }}>{list.map((n, k) => (<span key={k} style={{ display: 'block' }}>{n.text}</span>))}</span></button>); })}
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
  const lo = BAND.on[0], hi = BAND.on[1], floor = BAND.floor ?? 3.9;
  const md = a => { a = a.filter(x => x != null).sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2 * 100) / 100) : null; };
  const per = cyc.days.map((day, i) => { const v = day.filter(p => p.t < 180).map(p => p.g); const cov = v.length / 12; return { i, d: cyc.dates[i], m: v.length ? md(v) : null, ok: cov >= 0.5 }; });
  const valid = per.filter(p => p.m != null && p.ok);
  const inb = valid.filter(p => p.m >= lo && p.m <= hi);
  const lows = valid.filter(p => p.m < floor);
  const cyc3 = md(per.filter(p => p.m != null).map(p => p.m));
  const rng = inb.length ? [Math.min(...inb.map(p => p.m)), Math.max(...inb.map(p => p.m))] : null;
  const allM = per.filter(p => p.m != null).map(p => p.m);
  const gmin = Math.min(floor - 0.4, ...allM), gmax = Math.max(hi + 0.6, ...allM);
  const N = per.length, W = 340, H = 64, pl = 2, pr = 2, pt = 6, pb = 4, bw = (W - pl - pr) / N;
  const Y = g => pt + (1 - (g - gmin) / (gmax - gmin)) * (H - pt - pb);
  const col = m => m == null ? C.hair : m < floor ? C.slate : (m >= lo && m <= hi) ? C.sage : C.muted;
  const fmt = x => x == null ? '—' : x.toFixed(1);
  let note;
  if (inb.length >= 3) note = `On these nights the deep-night baseline is within band. Notes for those days, where present, are listed under Notes by day.`;
  else if (inb.length >= 1) note = `One or two nights are within band this cycle.`;
  else note = `No nights are within band this cycle.`;
  return (<div style={{ margin: '2px 0 14px', padding: '12px 14px', border: `1px solid ${C.hair}`, borderRadius: 10, background: C.paper }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
      <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>Midnight–3 AM · possible liver baseline {onInfo && <InfoDot onClick={onInfo} />}</span>
      <span style={{ font: `400 10px ${MONO}`, color: C.inkSoft }}>in range on {inb.length} of {N} nights{rng ? ` · in-range ran ${fmt(rng[0])}–${fmt(rng[1])}` : ''} · median {fmt(cyc3)}{lows.length ? ` · ${lows.length} below range` : ''}</span>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <rect x={pl} y={Y(hi)} width={W - pl - pr} height={Math.max(0, Y(lo) - Y(hi))} fill={C.sage} opacity="0.14" />
      {floor > gmin && floor < gmax && <line x1={pl} y1={Y(floor)} x2={W - pr} y2={Y(floor)} stroke={C.slate} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />}
      {per.map(p => { const x = pl + bw * p.i, yTop = p.m == null ? H - pb - 3 : Y(p.m), h = p.m == null ? 3 : Math.max(3, (H - pb) - Y(p.m));
        return <rect key={p.i} x={x + bw * 0.18} y={yTop} width={bw * 0.64} height={h} rx="1.5" fill={col(p.m)} opacity={p.m == null ? 0.3 : p.ok ? 0.92 : 0.3} />; })}
    </svg>
    <div style={{ display: 'flex', gap: 0, marginTop: 2 }}>
      {per.map(p => (<span key={p.i} style={{ flex: 1, textAlign: 'center', font: `400 7.5px ${MONO}`, color: p.d.wknd ? C.slate : C.muted }}>{p.d.d.split(' ')[1]}</span>))}
    </div>
    <div style={{ font: `400 9.5px/1.5 ${MONO}`, color: C.muted, marginTop: 8 }}>{note} <span style={{ color: C.sage }}>■</span> in band {lo}–{hi} · <span style={{ color: C.slate }}>■</span> below {floor} · dimmed = thin coverage</div>
  </div>);
}

// ---- The viewer proper — only mounts once a cycle blob is loaded ----
function GlucoseCycleView({ cyc, cycleIdx, cycleCount, onCycle }) {
  const events = cyc.events || [];
  const DAYS = cyc.dates.length;
  const wkCount = cyc.dates.filter(d => !d.wknd).length, weCount = cyc.dates.filter(d => d.wknd).length;
  const [scope, setScope] = useState('all'); const [win, setWin] = useState('all'); const [dayIdx, setDayIdx] = useState(0);
  const [tab, setTab] = useState('days'); const [openEvent, setOpenEvent] = useState(null);
  const [infoKey, setInfoKey] = useState(null);
  const routeInfo = k => { if (k === 'days') { setTab('days'); setInfoKey(null); } else setInfoKey(k); };
  const [mTxt, setM] = useState(''); const [oTxt, setO] = useState(''); const [cTxt, setCx] = useState('');
  const slices = useMemo(() => scope === 'one' ? daySlices(cyc.days[dayIdx]) : scope === 'weekday' ? cyc.bandWk : scope === 'weekend' ? cyc.bandWe : cyc.band, [cyc, scope, dayIdx]);
  const openFromList = e => { setScope('one'); setDayIdx(e.day); setOpenEvent(e); setTab('watched'); };
  // The header pager does double duty: in "One day" it steps days within the cycle;
  // otherwise it steps between cycles (newest → oldest).
  const step = d => {
    if (scope === 'one') { setDayIdx(a => (a + d + DAYS) % DAYS); setOpenEvent(null); }
    else { const ni = cycleIdx + d; if (ni >= 0 && ni < cycleCount) onCycle(ni); }
  };
  const [onLo, onHi] = BAND.on, [dLo, dHi] = BAND.day;
  const ab = (v, top) => v > top ? C.amber : C.ink;
  const md = a => { a = a.filter(x => x != null).sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2 * 100) / 100) : null; };
  const mid3PerDay = useMemo(() => cyc.days.map(day => { const v = day.filter(p => p.t < 180).map(p => p.g); return v.length ? md(v) : null; }), [cyc]);
  const wkI = cyc.dates.map((x, i) => x.wknd ? null : i).filter(i => i != null), weI = cyc.dates.map((x, i) => x.wknd ? i : null).filter(i => i != null);
  const mid3 = scope === 'one' ? mid3PerDay[dayIdx] : scope === 'weekday' ? md(wkI.map(i => mid3PerDay[i])) : scope === 'weekend' ? md(weI.map(i => mid3PerDay[i])) : md(mid3PerDay.slice());
  const iv = scope === 'one' ? { lab: `${dWd(cyc, dayIdx)} ${dDate(cyc, dayIdx)}`, on: cyc.m[dayIdx].overnight, dt: cyc.m[dayIdx].daytime, m24: cyc.m[dayIdx].median, tar: cyc.m[dayIdx].tar / 60 }
    : scope === 'weekday' ? { lab: 'weekdays combined', on: cyc.wkOn, dt: cyc.wkDt, m24: cyc.median24, tar: cyc.wkTar }
      : scope === 'weekend' ? { lab: 'weekends combined', on: cyc.weOn, dt: cyc.weDt, m24: cyc.median24, tar: cyc.weTar }
        : { lab: 'all days combined', on: cyc.overnight, dt: cyc.daytime, m24: cyc.median24, tar: cyc.tarHrs };
  const scopeWord = scope === 'weekday' ? 'weekday' : scope === 'weekend' ? 'weekend' : '';
  const nDays = scope === 'weekday' ? wkCount : scope === 'weekend' ? weCount : DAYS;

  return (<div className="gv2-wrap">
    <style>{`
      .gv2-wrap{background:${C.paper};font-family:${SANS};color:${C.ink};padding:18px 16px 60px;box-sizing:border-box;-webkit-font-smoothing:antialiased;}
      .gv2-card{max-width:1060px;margin:0 auto;background:${C.panel};border:1px solid ${C.hair};border-radius:14px;overflow:hidden;box-shadow:0 8px 30px -22px rgba(30,45,61,.5);}
      .gv2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 0;flex-wrap:wrap;}
      .gv2-pager{display:flex;align-items:center;gap:4px;}.gv2-ic{width:30px;height:30px;border-radius:8px;border:1px solid ${C.hair};background:${C.panel};color:${C.ink};display:grid;place-items:center;cursor:pointer;}
      .gv2-ic:hover{background:rgba(30,45,61,.05);}.gv2-ic:disabled{opacity:.3;cursor:default;}
      .gv2-ctrls{display:flex;gap:16px;flex-wrap:wrap;padding:12px 20px 0;align-items:center;}
      .gv2-ctrl{display:flex;align-items:center;gap:8px;}.gv2-ctrl .cl{font:600 9px ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${C.muted};}
      .gv2-seg{display:inline-flex;background:rgba(30,45,61,.06);border-radius:9px;padding:3px;gap:2px;}
      .gv2-seg button{border:0;background:transparent;font:600 11.5px ${SANS};color:${C.inkSoft};padding:6px 11px;border-radius:7px;cursor:pointer;}
      .gv2-seg button[aria-pressed=true]{background:${C.ink};color:${C.panel};}
      .gv2-body{display:flex;}.gv2-main{flex:1 1 auto;min-width:0;padding:14px 20px 18px;}
      .gv2-side{flex:0 0 244px;padding:14px 14px 18px;border-left:1px solid ${C.hair};background:${C.paper};}
      .gv2-row{display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;text-align:left;padding:6px 8px;cursor:pointer;border-radius:6px;transition:opacity .15s;}
      .gv2-row:hover{background:rgba(30,45,61,.05)!important;}
      .gv2-measures{display:flex;gap:22px;flex-wrap:wrap;align-items:stretch;margin:8px 0 12px;padding:14px 16px;border:1px solid ${C.hair};border-radius:10px;background:${C.paper};}
      .gv2-lead{display:flex;align-items:center;padding-right:22px;border-right:1px solid ${C.hair};flex:0 0 auto;}
      .gv2-grid4{flex:1 1 320px;display:grid;grid-template-columns:1fr 1fr;gap:12px 28px;align-content:center;}
      .gv2-method{font:400 10px/1.5 ${MONO};color:${C.muted};margin:12px 0;padding:8px 12px;border-radius:8px;background:rgba(30,45,61,.04);}
      .gv2-moment{margin-top:13px;padding:13px 15px;background:${C.paper};border:1px solid ${C.hair};border-radius:11px;}
      .gv2-sidetab{display:inline-flex;background:rgba(30,45,61,.06);border-radius:8px;padding:3px;gap:2px;margin-bottom:10px;}
      .gv2-sidetab button{border:0;background:transparent;font:600 10.5px ${SANS};color:${C.inkSoft};padding:5px 10px;border-radius:6px;cursor:pointer;}
      .gv2-sidetab button[aria-pressed=true]{background:${C.ink};color:${C.panel};}
      .gv2-vb{border:1px solid ${C.hair};border-radius:10px;background:${C.paper};padding:10px 12px;}
      .gv2-mic{display:inline-flex;align-items:center;gap:5px;border:1px solid ${C.hair};background:${C.panel};border-radius:7px;padding:3px 8px;color:${C.inkSoft};cursor:pointer;}
      .gv2-mic.on{border-color:${C.clay};color:${C.clay};}
      .gv2-ta{width:100%;box-sizing:border-box;border:1px solid ${C.hair};border-radius:8px;background:${C.panel};padding:8px 10px;font:400 13px/1.5 ${SANS};color:${C.ink};resize:vertical;}
      .gv2-foot{font:400 11px/1.6 ${SANS};color:${C.muted};padding:0 20px 16px;}
      .gv2-info{display:inline-grid;place-items:center;border:0;background:transparent;color:${C.muted};cursor:pointer;padding:0;width:15px;height:15px;flex-shrink:0;}
      .gv2-info:hover{color:${C.sageDeep};}
      .gv2-guide{display:inline-flex;align-items:center;gap:5px;border:1px solid ${C.hair};background:${C.panel};border-radius:8px;padding:5px 10px;font:600 10.5px ${SANS};color:${C.inkSoft};cursor:pointer;}
      .gv2-guide:hover{border-color:${C.sageDeep};color:${C.sageDeep};}
      .gv2-ovl{position:fixed;inset:0;background:rgba(30,45,61,.34);display:grid;place-items:center;padding:20px;z-index:1000;}
      .gv2-modal{background:${C.panel};border:1px solid ${C.hair};border-radius:14px;max-width:540px;width:100%;max-height:84vh;display:flex;flex-direction:column;box-shadow:0 24px 60px -20px rgba(30,45,61,.6);}
      .gv2-mhead{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid ${C.hair};}
      .gv2-x{border:0;background:transparent;font:400 15px ${SANS};color:${C.muted};cursor:pointer;width:28px;height:28px;border-radius:7px;}.gv2-x:hover{background:rgba(30,45,61,.06);}
      .gv2-mbody{padding:16px 18px;overflow:auto;}
      .gv2-cta{display:block;margin-top:14px;border:0;background:${C.ink};color:${C.panel};border-radius:9px;padding:9px 14px;font:600 12.5px ${SANS};cursor:pointer;}
      .gv2-guidelink{display:block;margin-top:10px;border:0;background:transparent;color:${C.sageDeep};font:600 12px ${SANS};cursor:pointer;padding:4px 0;}
      @media (max-width:720px){.gv2-body{flex-direction:column;}.gv2-side{flex-basis:auto;border-left:0;border-top:1px solid ${C.hair};}
        .gv2-lead{border-right:0;border-bottom:1px solid ${C.hair};padding-right:0;padding-bottom:12px;width:100%;}.gv2-grid4{flex-basis:100%;}}
    `}</style>
    <div className="gv2-card">
      <div className="gv2-head">
        <div>
          <div style={{ font: `400 11px ${SANS}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted }}>glucose · cycle</div>
          <div style={{ font: `400 21px/1.1 ${SERIF}`, marginTop: 3 }}>{cyc.cycleLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}><span style={{ font: `400 10px ${MONO}`, color: C.muted }}>reference band · {BAND.src} · overnight {onLo}–{onHi} · daytime {dLo}–{dHi}</span><InfoDot onClick={() => setInfoKey('band')} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button className="gv2-guide" onClick={() => setInfoKey('guide')}><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.6" r="0.95" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>How to read this</button>
          <div className="gv2-pager"><span style={{ font: `400 11px ${MONO}`, color: C.muted, marginRight: 6 }}>{scope === 'one' ? `${dWd(cyc, dayIdx)} ${dDate(cyc, dayIdx)} · day ${dayIdx + 1}/${DAYS}` : `cycle ${cycleIdx + 1} of ${cycleCount}`}</span>
            <button className="gv2-ic" onClick={() => step(-1)} disabled={scope === 'one' ? false : cycleIdx === 0} aria-label={scope === 'one' ? 'Previous day' : 'Newer cycle'}><Chevron dir="left" /></button>
            <button className="gv2-ic" onClick={() => step(1)} disabled={scope === 'one' ? false : cycleIdx === cycleCount - 1} aria-label={scope === 'one' ? 'Next day' : 'Older cycle'}><Chevron dir="right" /></button>
          </div>
        </div>
      </div>

      <div className="gv2-ctrls">
        <div className="gv2-ctrl"><span className="cl">Days</span><div className="gv2-seg" role="group" aria-label="Day scope">
          {[['all', `All ${DAYS}`], ['weekday', 'Weekdays'], ['weekend', 'Weekends'], ['one', 'One day']].map(([k, l]) => (<button key={k} aria-pressed={scope === k} onClick={() => { setScope(k); if (k !== 'one') setOpenEvent(null); }}>{l}</button>))}</div></div>
        <div className="gv2-ctrl"><span className="cl">Window</span><div className="gv2-seg" role="group" aria-label="Time window">
          {[['all', 'Full day'], ['daytime', 'Daytime'], ['overnight', 'Overnight'], ['mid3', 'Midnight–3 AM']].map(([k, l]) => (<button key={k} aria-pressed={win === k} onClick={() => setWin(k)}>{l}</button>))}</div></div>
      </div>

      <div className="gv2-body">
        <div className="gv2-main">
          <div className="gv2-measures">
            <div className="gv2-lead"><Measure big label="Time above 7.8" value={sf(iv.tar)} unit={scope === 'one' ? 'hrs · this day' : scope === 'weekday' ? 'hrs · median weekday' : scope === 'weekend' ? 'hrs · median weekend' : 'hrs · median day'} tone={iv.tar > 1 ? C.amber : C.ink} onInfo={() => setInfoKey('tar')} /></div>
            <div className="gv2-grid4">
              <Measure label="24h median" value={sf(iv.m24)} unit="mmol/L" tone={C.ink} />
              <Measure label="Daytime" value={sf(iv.dt)} unit="mmol/L" band={BAND.day} tone={ab(iv.dt, dHi)} />
              <Measure label="Overnight" value={sf(iv.on)} unit="mmol/L" band={BAND.on} tone={ab(iv.on, onHi)} />
              <Measure label="Midnight–3 AM" value={sf(mid3)} unit="mmol/L" band={BAND.on} tone={ab(mid3, onHi)} onInfo={() => setInfoKey('mid3')} />
            </div>
          </div>
          {scope !== 'one' && <DailyTARStrip cyc={cyc} />}
          {scope !== 'one' && <Midnight3Strip cyc={cyc} onInfo={() => setInfoKey('mid3')} />}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '0 0 8px' }}>
            <div style={{ font: `400 12px/1.55 ${SANS}`, color: C.inkSoft, flex: 1 }}>
              {scope === 'one'
                ? <>One real day — {dDate(cyc, dayIdx)}, 15-minute readings as ticks.</>
                : <>A <b>typical {scopeWord} day</b> built from {nDays} days. Each bar is one 15-minute slice — the <b>tick</b> is the usual level, the <b>box</b> is how much it varied across days.</>}
            </div>
            <div style={{ paddingTop: 1 }}><InfoDot onClick={() => setInfoKey('chart')} /></div>
          </div>
          <Chart slices={slices} win={win} />
          <div className="gv2-method">method · historic readings, de-duplicated · median of daily medians · overnight 22:00–06:00 · midnight–3 AM 00:00–03:00 · band {onLo}–{onHi} · 24h median shown as a number, not a line · time above 7.8 = median day (not the AGP pooled average) — see daily spread</div>

          {scope === 'one' && <DayJournal cyc={cyc} dayIdx={dayIdx} nudge />}
        </div>
        <div className="gv2-side">
          <div className="gv2-sidetab" role="group" aria-label="Side panel">
            {[['days', 'Notes by day'], ['watched', 'Watched']].map(([k, l]) => (<button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>))}
          </div>
          {tab === 'days' ? <DayList cyc={cyc} scope={scope} dayIdx={dayIdx} onPick={i => { setScope('one'); setDayIdx(i); setOpenEvent(null); }} />
            : <EventsList cyc={cyc} events={events} onOpen={openFromList} openEvent={openEvent} />}
          {openEvent && (<div className="gv2-moment">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: kColor(openEvent.kind), font: `700 12px ${SANS}` }}>{kIcon(openEvent.kind)}</span>
              <span style={{ font: `600 10px ${SANS}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>{dWd(cyc, openEvent.day)} {dDate(cyc, openEvent.day)} {openEvent.t0}</span></div>
            <ContextArc ev={openEvent} cyc={cyc} />
            <DayJournal cyc={cyc} dayIdx={openEvent.day} nudge />
          </div>)}
        </div>
      </div>
      <div style={{ padding: '4px 20px 4px' }}>
        <div style={{ font: `600 10px ${SANS}`, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, margin: '6px 0 4px' }}>The three voices · this cycle</div>
        <div style={{ font: `400 11px/1.5 ${SANS}`, color: C.muted, marginBottom: 10 }}>The screen shows the data; what it means is written here, by people, attributed to who said it.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
          <VoiceBox label="Member" value={mTxt} onChange={setM} />
          <VoiceBox label="MBH" value={oTxt} onChange={setO} />
          <VoiceBox label="Clinician" value={cTxt} onChange={setCx} />
        </div>
      </div>
      <div className="gv2-foot">The system measures and shows; it does not narrate. Numbers are given with their reference band and coloured only as an ambient signal — no verdicts. Interpretation lives in the three voices above.</div>
    </div>
    <InfoModal k={infoKey} onClose={() => setInfoKey(null)} onRoute={routeInfo} />
  </div>);
}

export default function GlucoseSummaryV2Page() {
  // All of the member's cycles, newest first (each is a parsed blob). The header
  // pager steps between them. undefined=loading, null=error, []=none.
  const [cycles, setCycles] = useState(undefined);
  const [cycleIdx, setCycleIdx] = useState(0);
  useEffect(() => {
    const member = getStoredGuid() || DEV_MEMBER;
    let cancelled = false;
    const where = encodeURIComponent(`member_id='${member}'`);
    fetch(`${API_BASE}/rest/v2/tables/glucose_cycle/records?q.where=${where}&q.sort=cycle_start_dt DESC&q.limit=50`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        if (cancelled) return;
        const parsed = (j.Result || []).map((row) => {
          try { const d = JSON.parse(row.blob); return { ...d, mem: { notes: d.notes } }; }
          catch (e) { console.warn('glucose_cycle blob parse failed', e); return null; }
        }).filter(Boolean);
        setCycles(parsed);
      })
      .catch((e) => { if (!cancelled) { console.warn('glucose_cycle load failed', e); setCycles(null); } });
    return () => { cancelled = true; };
  }, []);

  if (cycles === undefined) return <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading your glucose cycles…</div>;
  if (cycles === null) return <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Couldn't load your glucose cycles.</div>;
  if (!cycles.length) return <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No glucose cycle on file yet.</div>;
  const idx = Math.min(cycleIdx, cycles.length - 1);
  // key={idx} remounts on cycle switch → fresh scope/day state for the new cycle.
  return <GlucoseCycleView key={idx} cyc={cycles[idx]} cycleIdx={idx} cycleCount={cycles.length} onCycle={setCycleIdx} />;
}
