// Structural (DEXA) data layer. Source: member_info, feature='DEXA-scan',
// latest row by date_1. Field mapping + threshold profiles ported from the V1
// dexa_block.html so V1 and V2 stay consistent:
//   number_1 = VAT (g)  · number_2 = LMI (kg/m²) · number_3 = Total Lean Mass (kg)
//   number_4 = BMD (g/cm²) · number_5 = RMR (cal/day) · number_6 = Lean Mass (%)
//   text_box_1 = training note · text_box_2 = VAT note
import { DEV_MEMBER } from './biomarkers.js';

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const num = (v) => (v === '' || v == null || isNaN(parseFloat(v))) ? null : parseFloat(v);

// Display ranges + status thresholds (dir '>' = higher is worse, '<' = lower is worse).
export const THRESHOLDS = {
  VAT: { min: 219, lowerOpt: 219, upperOpt: 1300, lowerDrift: 1300, upperDrift: 2000, max: 4347, dir: '>' },
  LMI: { min: 10, lowerOpt: 17, upperOpt: 22, lowerDrift: 14, upperDrift: 17, max: 25, dir: '<' },
  TLM: { min: 30, lowerOpt: 50, upperOpt: 80, lowerDrift: 40, upperDrift: 50, max: 100, dir: '<' },
  BMD: { min: 0.7, lowerOpt: 1.0, upperOpt: 1.5, lowerDrift: 0.85, upperDrift: 1.0, max: 1.6, dir: '<' },
  // Lean Mass % — PLACEHOLDER ranges; confirm real zones with Ken before relying on the status/zone bar.
  LMP: { min: 40, lowerOpt: 75, upperOpt: 95, lowerDrift: 65, upperDrift: 75, max: 100, dir: '<' },
};

export function pctOf(v, t) {
  if (v == null || isNaN(v)) return 0;
  return Math.max(0, Math.min(100, ((v - t.min) / (t.max - t.min)) * 100));
}
export function statusOf(v, t) {
  if (v == null || isNaN(v)) return 'gap';
  if (t.dir === '>') {
    if (v <= t.upperOpt) return 'optimal';
    if (v <= t.upperDrift) return 'drift';
    return 'watch';
  }
  if (v >= t.lowerOpt) return 'optimal';
  if (v >= t.lowerDrift) return 'drift';
  return 'watch';
}

export { DEV_MEMBER };

export async function loadStructural(member) {
  const where = encodeURIComponent(`member_id='${member}' AND feature='DEXA-scan'`);
  const r = await fetch(`${API_BASE}/rest/v2/tables/member_info/records?q.where=${where}&q.limit=50`);
  if (!r.ok) throw new Error(`structural ${r.status}`);
  const rows = (await r.json()).Result || [];
  if (!rows.length) return null;
  rows.sort((a, b) => new Date(b.date_1) - new Date(a.date_1));
  const x = rows[0];
  return {
    scanDate: x.date_1,
    vat: num(x.number_1),
    lmi: num(x.number_2),
    tlm: num(x.number_3),
    bmd: num(x.number_4),
    rmr: num(x.number_5),
    lmPct: num(x.number_6),
    trainingNote: x.text_box_1 || '',
    vatNote: x.text_box_2 || '',
  };
}
