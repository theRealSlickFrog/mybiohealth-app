// Plotly-driven biomarker history chart. Mirrors the V1 history_page styling:
// zone shapes, threshold lines, line+markers, emoji-per-point keyed to zone.
// Skips range slider / range selector / trend line / target connector since
// those are turned off in system_parm.
import { useEffect, useRef, useState } from 'react';
import { loadChartConfig } from '../lib/chartConfig.js';

// Map a value to a zone label given thresholds + concern direction
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
  if (format === 'MMM-YYYY' || format === 'MMM YYYY') return `${m}-${y}`;
  if (format === 'YYYY') return String(y);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function PlotlyChart({ history, thresholds, unit, markerName }) {
  const ref = useRef(null);
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadChartConfig().then((c) => { if (!cancelled) setCfg(c); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cfg || !ref.current || !window.Plotly || !history || history.length === 0) return;

    // Limit to last N periods per system_parm.number_periods_displayed
    const sliced = history.slice(-cfg.numberPeriodsDisplayed);

    const dates = sliced.map((h) => h.date);
    const values = sliced.map((h) => parseFloat(h.value));
    const t = thresholds || {};

    // Y-axis range
    const allNumeric = [...values, t.display_min, t.display_max, t.lower_optimal, t.upper_optimal, t.lower_drift, t.upper_drift]
      .map((n) => parseFloat(n)).filter((n) => !isNaN(n));
    let yMin = Math.min(...allNumeric);
    let yMax = Math.max(...allNumeric);
    const pad = (yMax - yMin) * 0.12 || 1;
    yMin = Math.max(0, yMin - pad);
    yMax = yMax + pad;

    // X-axis range with one period of padding on each side
    const dt0 = new Date(dates[0]);
    const dtN = new Date(dates[dates.length - 1]);
    const span = dtN - dt0 || (90 * 24 * 60 * 60 * 1000);
    const xMin = new Date(dt0.getTime() - span * 0.1).toISOString().split('T')[0];
    const xMax = new Date(dtN.getTime() + span * 0.1).toISOString().split('T')[0];

    // Zone shapes (rectangles)
    const shapes = [];
    if (t.lower_optimal != null && t.upper_optimal != null) {
      shapes.push({ type:'rect', xref:'paper', yref:'y', x0:0, x1:1, y0:t.lower_optimal, y1:t.upper_optimal, fillcolor: cfg.optimalColor, line:{width:0} });
    }
    if (t.lower_drift != null && t.upper_optimal != null && parseFloat(t.upper_optimal) !== parseFloat(t.upper_drift)) {
      shapes.push({ type:'rect', xref:'paper', yref:'y', x0:0, x1:1, y0:t.upper_optimal, y1:t.upper_drift, fillcolor: cfg.driftColor, line:{width:0} });
    }

    // Threshold lines
    const lineFor = (yval, conf) => yval == null ? null : ({
      type:'line', xref:'paper', yref:'y', x0:0, x1:1, y0:yval, y1:yval,
      line:{ color: 'rgba(0,0,0,0.45)', width: conf?.thickness || 1, dash: conf?.style === 'solid' ? 'solid' : 'dash' },
    });
    [
      lineFor(t.lower_optimal, cfg.zoneLines.optimal_lower),
      lineFor(t.upper_optimal, cfg.zoneLines.optimal_upper),
      lineFor(t.upper_drift,   cfg.zoneLines.drift_upper),
      lineFor(t.concern_threshold, cfg.zoneLines.concern),
    ].forEach((s) => s && shapes.push(s));

    // Emoji per point
    const emojiSymbols = values.map((v) => {
      const z = zoneFor(v, t);
      return ({
        optimal: cfg.emojis.optimal, drift: cfg.emojis.drift, driftPlus: cfg.emojis.driftPlus,
        concern: cfg.emojis.concern, belowOptimal: cfg.emojis.belowOptimal,
      }[z]) || '';
    });
    const hoverText = values.map((v, i) => {
      const z = zoneFor(v, t);
      const zlabel = ({ optimal:'Optimal', drift:'Drift', driftPlus:'Drift+', concern:'Concern', belowOptimal:'Below optimal' }[z]) || z;
      return `<b>${fmtDate(dates[i], cfg.dateFormat)}</b><br>${v}${unit ? ' '+unit : ''}<br>${zlabel}`;
    });

    const traces = [
      // Line + markers (data dots)
      {
        x: dates, y: values, mode: 'lines+markers', type: 'scatter',
        line: { color: '#1e2d3d', width: 1.5 },
        marker: { color: '#1e2d3d', size: 6 },
        hovertext: hoverText, hoverinfo: 'text',
        showlegend: false,
      },
      // Emoji layer over points
      {
        x: dates, y: values, mode: 'text', type: 'scatter',
        text: emojiSymbols, textfont: { size: 14 }, textposition: 'middle center',
        hoverinfo: 'skip', showlegend: false,
      },
    ];

    const layout = {
      title: { text: '', font: { size: cfg.titleFontSize } },
      xaxis: {
        type: 'date',
        showgrid: true, gridcolor: '#ede9e3',
        tickfont: { size: cfg.textFontSize - 2 },
        range: [xMin, xMax],
        tickformat: '%b %Y',
        dtick: 'M3',
      },
      yaxis: {
        showgrid: true, gridcolor: '#ede9e3',
        tickfont: { size: cfg.textFontSize - 2 },
        range: [yMin, yMax],
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'transparent',
      margin: { l: 40, r: 16, t: 16, b: 30 },
      shapes,
      showlegend: false,
      hoverlabel: { bgcolor: 'white', bordercolor: '#9ca3af', font: { color: '#1e2d3d', size: 12 } },
    };

    window.Plotly.newPlot(ref.current, traces, layout, { displayModeBar: false, responsive: true });

    return () => {
      if (ref.current && window.Plotly) {
        try { window.Plotly.purge(ref.current); } catch (e) {}
      }
    };
  }, [cfg, history, thresholds, unit]);

  if (!history || history.length === 0) return null;
  return <div ref={ref} style={{ width: '100%', height: 200 }} aria-label={`Chart for ${markerName || 'marker'}`} />;
}
