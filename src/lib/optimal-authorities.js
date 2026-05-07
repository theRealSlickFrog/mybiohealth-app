// OPTIMAL_AUTHORITIES — clinical reference content (lab normal vs MBH optimal + rationale).
// Reference content, identical for every member. Ported verbatim from prototype.

export const OPTIMAL_AUTHORITIES = {
  'HOMA-IR': {
    labNormal: '< 2.5 (varies by lab)',
    mbhOptimal: '< 1.4',
    authority: 'Functional medicine consensus (HOMA-IR 1)',
    rationale: "HOMA-IR has no single guideline body. MBH's < 1.4 threshold is calibrated to align with the American Diabetes Association's normoglycemia bar (HbA1c < 5.7%, fasting glucose < 5.6 mmol/L) — the level of insulin sensitivity consistent with non-prediabetic glucose handling. MBH uses HOMA-IR 1, not HOMA-IR 2.",
    sources: ['American Diabetes Association · Standards of Care 2024', 'Matthews & Turner · HOMA-IR original methodology']
  },
  'ApoB': {
    labNormal: '< 1.20 g/L',
    mbhOptimal: '< 0.80 g/L',
    authority: 'Canadian Cardiovascular Society',
    rationale: 'The 2021 CCS Dyslipidemia Guidelines identify ApoB ≤ 0.80 g/L as the treatment threshold for individuals with diabetes, CKD, or other elevated cardiovascular risk. MBH adopts this as the optimal threshold for proactive primary prevention — the bar at which atherogenic particle burden is meaningfully managed, not merely flagged.',
    sources: ['2021 CCS Guidelines for the Management of Dyslipidemia for Prevention of CVD in Adults']
  },
  'GGT': {
    labNormal: '< 50 U/L (men) · < 35 U/L (women)',
    mbhOptimal: '< 25 U/L',
    authority: 'UK Biobank cohort + functional medicine consensus',
    rationale: "Lab 'normal' ranges for GGT (up to 50–70 U/L) were derived decades ago from population averages that included undiagnosed metabolic dysfunction. The UK Biobank prospective cohort (>400,000 participants) demonstrates that cardiovascular and all-cause mortality risk rises continuously from values well below the laboratory upper limit. MBH's < 25 U/L threshold reflects metabolic liver health, not merely the absence of disease.",
    sources: ['Kunutsor et al. · UK Biobank, Lancet eClinicalMedicine 2022', 'Optimal DX functional medicine reference']
  },
  'hs-CRP': {
    labNormal: '< 10 mg/L (acute)',
    mbhOptimal: '< 1.0 mg/L',
    authority: 'AHA / CDC Joint Statement',
    rationale: 'The 2003 AHA/CDC joint scientific statement established hs-CRP categories for cardiovascular risk: < 1.0 mg/L is low risk, 1.0–3.0 mg/L is moderate, > 3.0 mg/L is high. MBH adopts the < 1.0 mg/L threshold as optimal — the level at which systemic inflammation is not contributing to atherogenic risk.',
    sources: ['Pearson et al. · AHA/CDC Scientific Statement, Circulation 2003']
  },
  'eGFR': {
    labNormal: '> 60 mL/min/1.73m²',
    mbhOptimal: '> 90 mL/min/1.73m²',
    authority: 'KDIGO 2024',
    rationale: 'The lab threshold of > 60 marks the boundary above which CKD is not diagnosed — a floor, not a target. The 2024 KDIGO Clinical Practice Guideline uses 90–104 mL/min/1.73m² as the healthy reference group in CKD prognosis modelling. MBH adopts > 90 as optimal: kidney filtration consistent with the reference healthy population.',
    sources: ['KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD']
  },
  'Albumin': {
    labNormal: '35–50 g/L',
    mbhOptimal: '42–53 g/L',
    authority: 'Functional medicine reference',
    rationale: "Albumin in the upper portion of the lab range correlates with better protein status, lower all-cause mortality, and resilience under training load. The lab 'normal' floor of 35 g/L identifies frank hypoalbuminemia — a clinical concern, not an optimal target. MBH's 42–53 g/L range reflects the upper-quartile resilience zone observed in healthy active populations.",
    sources: ['Optimal DX · Albumin reference ranges', 'Multiple cohort analyses on albumin and all-cause mortality']
  }
};
