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

const API_BASE = 'https://kenises-api-proxy.netlify.app';

export const DEFAULTS = {
  subtitle: '',                    // '' => fall back to the per-member tagline
  priorityTargetColour: '#000000', // colour of the "→ {target}" line
  // "Why I'm here" card. Heading + caption are fixed copy from system_parm;
  // the body in between is the member's editable note (notes.js key 'strategy_why').
  whyHeading: "Why I'm here",
  whyCaption: "Free-form, in my words — the goal everything below serves.",
};

let cached = null;
let inflight = null;

export async function loadStrategyConfig() {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const cfg = { ...DEFAULTS };
    try {
      const where = encodeURIComponent("parm_group='mystrategy_page'");
      const r = await fetch(`${API_BASE}/rest/v2/tables/system_parm/records?q.where=${where}&q.limit=200`);
      if (!r.ok) throw new Error('strategy cfg fetch failed');
      const rows = (await r.json()).Result || [];
      for (const row of rows) {
        const k = row.parm_name;
        const v = (row.main_value || '').trim();
        switch (k) {
          case 'subtitle_text':          if (v) cfg.subtitle = v; break;
          case 'priority_target_colour': if (v) cfg.priorityTargetColour = v; break;
          case 'why_heading':            if (v) cfg.whyHeading = v; break;
          case 'why_caption':            if (v) cfg.whyCaption = v; break;
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
