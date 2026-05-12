// Plotly-driven biomarker history chart. Mirrors V1 history_page styling:
// zone shapes, threshold lines, line+markers, emoji-per-point keyed to zone,
// optional Reference target, Latest/Reference annotations, dynamic emoji
// legend, and dtick toggle buttons (Quarterly / Equal) above the chart.
// Everything driven by system_parm so V1 and V2 stay visually identical.
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadChartConfig } from '../lib/chartConfig.js';

function zoneFor(v, t) {
  if (v == null || isNaN(v)) return 'unknown';
  const { lower_optimal, upper_optimal, lower_drift, upper_drift, concern_direction, concern_threshold } = t;
  const higherIsBad = concern_direction === '>';
  if (higherIsBad) {
    if (concern_threshold != null && v >= concern_threshold) return 'concern';
    if (upper_drift != null && v > upper_drift) return 'driftPlus';
    if (upper_optimal != null && v > upper_optimal) return 'drift';
    if (lower_optimal != null && v < lower_optimal) return 'belowOptimal';
    return 'optimal';
  } else {
    if (concern_threshold != null && v <= concern_threshold) return 'concern';
    if (lower_drift != null && v < lower_drift) return 'driftPlus';
    if (lower_optimal != null && v < lower_optimal) return 'drift';
    if (upper_optimal != null && v > upper_optimal) return 'belowOptimal';
    return 'optimal';
  }
}

function fmtDate(d, format) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[dt.getMonth()];
  const y = dt.getFullYear();
  if (format === 'MMM-YYYY' || format === 'MMM YYYY') return `${m} ${y}`;
  if (format === 'YYYY') return String(y);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Available dtick toggle definitions; cfg.dtickButtons (e.g. 'QE') selects which to show
const DTICK_DEFS = {
  M: { label: 'Monthly',   axisType: 'date',     dtick: 'M1' },
  Q: { label: 'Quarterly', axisType: 'date',     dtick: 'M3' },
  A: { label: 'Auto',      axisType: 'date',     dtick: 'auto' },
  E: { label: 'Equal',     axisType: 'category', dtick: null },
};

export default function PlotlyChart({ history, thresholds, reference, unit, markerName, height = 260 }) {
  const ref = useRef(null);
  const [cfg, setCfg] = useState(null);
  const [activeDtick, setActiveDtick] = useState(null);
  const [legend, setLegend] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadChartConfig().then((c) => { if (!cancelled) setCfg(c); });
    return () => { cancelled = true; };
  }, []);

  const dtickButtons = useMemo(() => {
    if (!cfg) return [];
    return cfg.dtickButtons.split('').filter((c) => DTICK_DEFS[c]).map((c) => ({ code: c, ...DTICK_DEFS[c] }));
  }, [cfg]);

  // Default to the LAST button (matches V1 behavior — last button is active by default)
  useEffect(() => {
    if (dtickButtons.length > 0 && activeDtick === null) {
      setActiveDtick(dtickButtons[dtickButtons.length - 1].code);
    }
  }, [dtickButtons, activeDtick]);

  useEffect(() => {
    if (!cfg || !ref.current || !window.Plotly || !history || history.length === 0) return;

    const sliced = history.slice(-cfg.numberPeriodsDisplayed);
    const dates = sliced.map((h) => h.date);
    const values = sliced.map((h) => parseFloat(h.value));
    const t = thresholds || {};

    // Append reference point if we have one
    const hasRef = !!(reference && reference.value != null && !isNaN(parseFloat(reference.value)));
    const refValue = hasRef ? parseFloat(reference.value) : null;
    const refDate  = hasRef ? (reference.date ? reference.date.slice(0, 10) : null) : null;
    const refDirection = hasRef ? (reference.direction || '') : '';

    const allNumeric = [...values, refValue, t.display_min, t.display_max, t.lower_optimal, t.upper_optimal, t.lower_drift, t.upper_drift]
      .map((n) => parseFloat(n)).filter((n) => !isNaN(n));
    let yMin = Math.min(...allNumeric);
    let yMax = Math.max(...allNumeric);
    const pad = (yMax - yMin) * 0.12 || 1;
    yMin = Math.max(0, yMin - pad);
    yMax = yMax + pad;

    // X-axis range with padding
    const allDates = [...dates, refDate].filter(Boolean).map((d) => new Date(d));
    const dt0 = new Date(Math.min(...allDates));
    const dtN = new Date(Math.max(...allDates));
    const span = (dtN - dt0) || (90 * 24 * 60 * 60 * 1000);
    const xMin = new Date(dt0.getTime() - span * 0.08).toISOString().split('T')[0];
    const xMax = new Date(dtN.getTime() + span * 0.08).toISOString().split('T')[0];

    // Zone shapes
    const shapes = [];
    if (t.lower_optimal != null && t.upper_optimal != null) {
      shapes.push({ type:'rect', xref:'paper', yref:'y', x0:0, x1:1, y0:t.lower_optimal, y1:t.upper_optimal, fillcolor: cfg.optimalColor, line:{width:0} });
    }
    if (t.upper_optimal != null && t.upper_drift != null && parseFloat(t.upper_optimal) !== parseFloat(t.upper_drift)) {
      shapes.push({ type:'rect', xref:'paper', yref:'y', x0:0, x1:1, y0:t.upper_optimal, y1:t.upper_drift, fillcolor: cfg.driftColor, line:{width:0} });
    }

    const dashFor = (style) => ({ solid: 'solid', dot: 'dot', dash: 'dash', dashdot: 'dashdot' }[style] || 'dash');
    const lineFor = (yval, conf) => {
      if (yval == null) return null;
      if (!conf || conf.style === 'off' || !conf.style) return null;  // honor 'off'
      return {
        type:'line', xref:'paper', yref:'y', x0:0, x1:1, y0:yval, y1:yval,
        line:{ color: '#9ca3af', width: conf.thickness || 1, dash: dashFor(conf.style) },
      };
    };
    [
      lineFor(t.lower_optimal, cfg.zoneLines.optimal_lower),
      lineFor(t.upper_optimal, cfg.zoneLines.optimal_upper),
      lineFor(t.upper_drift,   cfg.zoneLines.drift_upper),
      lineFor(t.concern_threshold, cfg.zoneLines.concern),
    ].forEach((s) => s && shapes.push(s));

    // Trend line / target connector — honor 'off' from system_parm
    const trendOn = cfg.trendLine && cfg.trendLine.style !== 'off';
    const targetConnectorOn = cfg.targetConnectorLine && cfg.targetConnectorLine.style !== 'off';

    // Emojis per data point
    const emojiSymbolsAll = values.map((v) => {
      const z = zoneFor(v, t);
      return ({ optimal: cfg.emojis.optimal, drift: cfg.emojis.drift, driftPlus: cfg.emojis.driftPlus, concern: cfg.emojis.concern, belowOptimal: cfg.emojis.belowOptimal }[z]) || '';
    });
    const hoverText = values.map((v, i) => {
      const z = zoneFor(v, t);
      const zlabel = ({ optimal:'Optimal', drift:'Drift', driftPlus:'Drift+', concern:'Concern', belowOptimal:'Below optimal' }[z]) || z;
      return `<b>${fmtDate(dates[i], cfg.dateFormat)}</b><br>${v}${unit ? ' '+unit : ''}<br>${zlabel}`;
    });

    const traces = [
      {
        x: dates, y: values, mode: trendOn ? 'lines+markers' : 'markers', type: 'scatter',
        line: trendOn ? { color: '#1e2d3d', width: cfg.trendLine.thickness || 1.5, dash: dashFor(cfg.trendLine.style) } : undefined,
        marker: { color: '#1e2d3d', size: 6 },
        hovertext: hoverText, hoverinfo: 'text', showlegend: false,
      },
      {
        x: dates, y: values, mode: 'text', type: 'scatter',
        text: emojiSymbolsAll, textfont: { size: 14 }, textposition: 'middle center',
        hoverinfo: 'skip', showlegend: false,
      },
    ];

    // Reference marker + optional connector
    if (hasRef && refDate) {
      if (targetConnectorOn && dates.length > 0) {
        traces.push({
          x: [dates[dates.length - 1], refDate], y: [values[values.length - 1], refValue],
          mode: 'lines', type: 'scatter',
          line: { color: 'orange', width: cfg.targetConnectorLine.thickness || 2, dash: dashFor(cfg.targetConnectorLine.style) },
          hoverinfo: 'skip', showlegend: false,
        });
      }
      traces.push({
        x: [refDate], y: [refValue], mode: 'text', type: 'scatter',
        text: [cfg.emojis.target], textfont: { size: 16 }, textposition: 'middle center',
        hovertext: [`<b>Reference</b><br>${refValue}${unit ? ' '+unit : ''}`],
        hoverinfo: 'text', showlegend: false,
      });
    }

    // Dynamic legend items — rendered as React DOM below the chart (see return)
    const present = new Set(emojiSymbolsAll);
    const legendData = [];
    if (present.has(cfg.emojis.optimal))   legendData.push({ emoji: cfg.emojis.optimal, label: 'Optimal' });
    if (present.has(cfg.emojis.drift))     legendData.push({ emoji: cfg.emojis.drift, label: 'Drift Zone' });
    if (present.has(cfg.emojis.driftPlus)) legendData.push({ emoji: cfg.emojis.driftPlus, label: 'Drift Zone+' });
    if (present.has(cfg.emojis.concern))   legendData.push({ emoji: cfg.emojis.concern, label: 'Concern', color: '#c0483a' });
    if (hasRef) {
      const refLabelVal = refDirection ? `${refDirection} ${refValue}` : refValue;
      legendData.push({ emoji: cfg.emojis.target, label: `Reference ${refLabelVal}${unit ? ' '+unit : ''}` });
    }
    setLegend(legendData);

    const annotations = [];

    const def = (activeDtick && DTICK_DEFS[activeDtick]) || DTICK_DEFS.Q;
    const xaxis = def.axisType === 'category'
      ? {
          type: 'category',
          showgrid: true, gridcolor: '#ede9e3',
          tickfont: { size: cfg.textFontSize - 2 },
          tickmode: 'array', tickvals: dates,
          ticktext: dates.map((d) => fmtDate(d, cfg.dateFormat)),
        }
      : {
          type: 'date',
          showgrid: true, gridcolor: '#ede9e3',
          tickfont: { size: cfg.textFontSize - 2 },
          range: [xMin, xMax],
          tickformat: '%b %Y',
          tickmode: 'linear',
          dtick: def.dtick === 'auto' ? undefined : def.dtick,
        };

    const layout = {
      title: { text: '', font: { size: cfg.titleFontSize } },
      xaxis,
      yaxis: {
        showgrid: true, gridcolor: '#ede9e3',
        tickfont: { size: cfg.textFontSize - 2 },
        range: [yMin, yMax],
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'transparent',
      margin: { l: 44, r: 28, t: 12, b: 36 },
      shapes,
      showlegend: false,
      annotations,
      hoverlabel: { bgcolor: 'white', bordercolor: '#9ca3af', font: { color: '#1e2d3d', size: 12 } },
    };

    window.Plotly.newPlot(ref.current, traces, layout, { displayModeBar: false, responsive: true });

    return () => {
      if (ref.current && window.Plotly) {
        try { window.Plotly.purge(ref.current); } catch (e) {}
      }
    };
  }, [cfg, history, thresholds, reference, unit, activeDtick]);

  if (!history || history.length === 0) return null;

  const showButtons = dtickButtons.length > 1;
  return (
    <div>
      {showButtons && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, paddingLeft: 4 }}>
          {dtickButtons.map((b) => (
            <button key={b.code} onClick={() => setActiveDtick(b.code)} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 500,
              border: `1px solid ${activeDtick === b.code ? '#1e2d3d' : '#d1d5db'}`,
              background: activeDtick === b.code ? '#1e2d3d' : 'white',
              color: activeDtick === b.code ? 'white' : '#374151',
              borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            }}>{b.label}</button>
          ))}
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height }} aria-label={`Chart for ${markerName || 'marker'}`} />
      {legend.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12,
          marginTop: 6, paddingLeft: 4,
          fontSize: 11, color: '#374151', lineHeight: 1.4,
        }}>
          {legend.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: item.color || '#374151', fontWeight: item.color ? 600 : 400 }}>
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
