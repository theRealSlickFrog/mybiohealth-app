// Fetches the chart-related system_parm rows once and caches them.
// Mirrors V1's history_page chart configuration so V1 and V2 stay visually identical.
// Settings turned off in system_parm (range slider, trend line, target connector)
// are honored — V2 just doesn't render them.

const API_BASE = 'https://kenises-api-proxy.netlify.app';

const DEFAULTS = {
  optimalColor: 'rgba(60, 179, 113, 0.28)',
  optimalColorFuture: 'rgba(60, 179, 113, 0.12)',
  driftColor: 'rgba(255, 140, 0, 0.22)',
  driftColorFuture: 'rgba(255, 140, 0, 0.1)',
  titleFontSize: 20,
  textFontSize: 13,
  numberPeriodsDisplayed: 4,
  dateFormat: 'MMM-YYYY',
  showRangeSlider: false,
  emojis: {
    optimal: '🟢',
    drift: '🔶',
    driftPlus: '⚠️',
    concern: '⚠️⚠️',
    belowOptimal: '🔶',
    target: '◯',
  },
  zoneLines: {
    optimal_lower: { style: 'dash', thickness: 2 },
    optimal_upper: { style: 'dash', thickness: 2 },
    drift_upper:   { style: 'dash', thickness: 2 },
    concern:       { style: 'dash', thickness: 2 },
  },
};

let cached = null;
let inflight = null;

export async function loadChartConfig() {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      const where = encodeURIComponent("parm_group='history_page'");
      const r = await fetch(`${API_BASE}/rest/v2/tables/system_parm/records?q.where=${where}&q.limit=200`);
      if (!r.ok) throw new Error('chart cfg fetch failed');
      const rows = (await r.json()).Result || [];
      for (const row of rows) {
        const k = row.parm_name;
        const v = (row.main_value || '').trim();
        const v2 = (row.value_two || '').trim();
        switch (k) {
          case 'optimal_colour':         if (v) cfg.optimalColor = v; break;
          case 'optimal_colour_future':  if (v) cfg.optimalColorFuture = v; break;
          case 'drift_colour':           if (v) cfg.driftColor = v; break;
          case 'drift_colour_future':    if (v) cfg.driftColorFuture = v; break;
          case 'title_font_size':        if (v) cfg.titleFontSize = parseInt(v) || cfg.titleFontSize; break;
          case 'text_font_size':         if (v) cfg.textFontSize  = parseInt(v) || cfg.textFontSize;  break;
          case 'number_periods_displayed':
            if (v) cfg.numberPeriodsDisplayed = parseInt(v) || cfg.numberPeriodsDisplayed; break;
          case 'date_format':            if (v) cfg.dateFormat = v; break;
          case 'show_range_slider':      cfg.showRangeSlider = /^(Y|YES|TRUE|1)$/i.test(v); break;
          case 'emoji_optimal':          if (v) cfg.emojis.optimal = v; break;
          case 'emoji_drift':            if (v) cfg.emojis.drift = v; break;
          case 'emoji_drift_plus':       if (v) cfg.emojis.driftPlus = v; break;
          case 'emoji_concern':          if (v) cfg.emojis.concern = v; break;
          case 'emoji_below_optimal':    if (v) cfg.emojis.belowOptimal = v; break;
          case 'emoji_target':           if (v) cfg.emojis.target = v; break;
          case 'zone_line_optimal_lower':
            cfg.zoneLines.optimal_lower = { style: v.toLowerCase(), thickness: parseInt(v2) || 1 }; break;
          case 'zone_line_optimal_upper':
            cfg.zoneLines.optimal_upper = { style: v.toLowerCase(), thickness: parseInt(v2) || 1 }; break;
          case 'zone_line_drift_upper':
            cfg.zoneLines.drift_upper   = { style: v.toLowerCase(), thickness: parseInt(v2) || 1 }; break;
          case 'zone_line_concern':
            cfg.zoneLines.concern       = { style: v.toLowerCase(), thickness: parseInt(v2) || 1 }; break;
          default: break;
        }
      }
    } catch (e) {
      console.warn('chart config load failed, using defaults:', e);
    }
    cached = cfg;
    return cfg;
  })();
  return inflight;
}
