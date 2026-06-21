// Fetches the MyStrategy page's system_parm rows once and caches them.
// Group 'mystrategy_page' — lets Ken tune cosmetic bits of the page without a
// code change, the same pattern as chartConfig.js (group 'history_page').
//
// Parms read here:
//   subtitle_text          -> the line under the MyStrategy title. When set it
//                             overrides the per-member tagline; blank falls back
//                             to mystrategy_report_ready.tagline.
//   priority_target_colour -> colour of the "→ {target}" line under each
//                             priority name (any CSS colour). Default black.
//   lever_rx_colour / lever_sx_colour / lever_mhx_colour
//                          -> "Served by" chip colours. main_value = background,
//                             value_two = text colour. Default to the design hues.

const API_BASE = 'https://kenises-api-proxy.netlify.app';

export const DEFAULTS = {
  subtitle: '',                    // '' => fall back to the per-member tagline
  priorityTargetColour: '#000000', // colour of the "→ {target}" line
  // "Why I'm here" card. Heading + caption are fixed copy from system_parm;
  // the body in between is the member's editable note (notes.js key 'strategy_why').
  whyHeading: "Why I'm here",
  whyCaption: "Free-form, in my words — the goal everything below serves.",
  // "Served by" lever chip colours (bg + text) — Rx blue, Sx purple, MHx green.
  leverColours: {
    Rx:  { bg: '#eef2fb', color: '#33508f' },
    Sx:  { bg: '#f3eefb', color: '#5b3f8c' },
    MHx: { bg: '#e8f2ef', color: '#1f4d42' }, // = SAGE_BG / SAGE_TEXT
  },
};

let cached = null;
let inflight = null;

export async function loadStrategyConfig() {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = JSON.parse(JSON.stringify(DEFAULTS));  // deep clone (nested leverColours)
    try {
      const where = encodeURIComponent("parm_group='mystrategy_page'");
      const r = await fetch(`${API_BASE}/rest/v2/tables/system_parm/records?q.where=${where}&q.limit=200`);
      if (!r.ok) throw new Error('strategy cfg fetch failed');
      const rows = (await r.json()).Result || [];
      for (const row of rows) {
        const k = row.parm_name;
        const v = (row.main_value || '').trim();   // background colour for lever_* parms
        const v2 = (row.value_two || '').trim();   // text colour for lever_* parms
        switch (k) {
          case 'subtitle_text':          if (v) cfg.subtitle = v; break;
          case 'priority_target_colour': if (v) cfg.priorityTargetColour = v; break;
          case 'why_heading':            if (v) cfg.whyHeading = v; break;
          case 'why_caption':            if (v) cfg.whyCaption = v; break;
          case 'lever_rx_colour':        if (v) cfg.leverColours.Rx.bg = v;  if (v2) cfg.leverColours.Rx.color = v2;  break;
          case 'lever_sx_colour':        if (v) cfg.leverColours.Sx.bg = v;  if (v2) cfg.leverColours.Sx.color = v2;  break;
          case 'lever_mhx_colour':       if (v) cfg.leverColours.MHx.bg = v; if (v2) cfg.leverColours.MHx.color = v2; break;
          default: break;
        }
      }
    } catch (e) {
      console.warn('strategy config load failed, using defaults:', e);
    }
    cached = cfg;
    return cfg;
  })();
  return inflight;
}
