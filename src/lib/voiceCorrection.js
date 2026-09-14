// Voice term correction — pure, no React and no DOM, so it can be unit-tested
// and run over any transcript.
//
// Browser speech recognition handles numbers well but mangles biomarker names:
// "ApoB" comes back as "Capital AP o capital B", "visceral fat" as "Versail
// fat", "eGFR" as "Gfr". This repairs the mangling against a vocabulary the
// caller supplies at runtime.
//
// Two rules shape everything here:
//
//   1. Nothing changes silently. correct() returns every substitution it made
//      so the UI can show it and offer an undo. A wrong correction that still
//      reads as plausible English ("international units" -> "internal units")
//      is the dangerous case: the user proof-reading their own dictation skims
//      right past it. Visibility is the only defence.
//
//   2. Leaving a term uncorrected beats correcting it wrongly. Tolerance is
//      scaled to term length and short codes must match exactly — guessing
//      between ALT and AST would silently move the reading to a different
//      organ panel.

// Phrases the recogniser reliably mishears as ordinary English. These are not
// markers, so they stay hardcoded rather than coming from the server vocabulary.
// Applied before fuzzy matching: they are whole-phrase errors, and no amount of
// per-word edit distance recovers "interior in fact" -> "anterior infarct".
export const PHRASE_FIXES = [
  [/\binternal units\b/gi,            'international units'],
  [/\binterior in fact\b/gi,          'anterior infarct'],
  [/\banterior in fact\b/gi,          'anterior infarct'],
  [/\binterior infarct\b/gi,          'anterior infarct'],
  [/\bversail fat\b/gi,               'visceral fat'],
  [/\bvisceral fact\b/gi,             'visceral fat'],
  [/\bvisceral fed\b/gi,              'visceral fat'],
  [/\bA one C\b/gi,                   'A1c'],
  [/\bbe A1\b/gi,                     'HbA1c'],
  [/\bH be A1C\b/gi,                  'HbA1c'],
  [/\bage be A1C\b/gi,                'HbA1c'],
  [/\bdex a scan\b/gi,                'DEXA scan'],
  [/\bhome a I R\b/gi,                'HOMA-IR'],
  [/\bhoma ir\b/gi,                   'HOMA-IR'],
  [/\btime and range\b/gi,            'time in range'],
];

// Confirmed mishearings that resolve to a marker rather than to ordinary
// English. Kept separate from PHRASE_FIXES because they are only applied when
// the member's own vocabulary actually contains the target — the marker set is
// per-member, and injecting a marker someone doesn't have is its own error.
//
// "Gfr" needs an entry because it cannot be reached by fuzzy matching: eGFR
// normalises to four characters, where tolerance is deliberately zero. Relaxing
// that rule to catch it would also let three-letter panels match each other.
export const TERM_FIXES = [
  [/\bgfr\b/gi, 'eGFR'],
];

// Used only when loadBiomarkers() fails or returns nothing, so the page still
// demonstrates the idea offline. The real vocabulary is per-member and comes
// from the server — see VoiceTestPage.
export const FALLBACK_TERMS = [
  'ApoB', 'LDL', 'HDL', 'Non-HDL', 'Triglycerides', 'Total Cholesterol', 'Lp(a)',
  'HbA1c', 'HOMA-IR', 'Fasting Insulin', 'Fasting Glucose', 'Insulin', 'Glucose',
  'GGT', 'ALT', 'AST', 'Albumin',
  'eGFR', 'Creatinine', 'UACR', 'BUN',
  'hs-CRP', 'CRP',
  'Vitamin D', 'Vitamin B12',
  'Visceral Fat', 'Lean Mass Index', 'Total Lean Mass', 'Bone Mineral Density',
  'Lean Mass', 'Resting Metabolic Rate', 'DEXA',
  'Blood Pressure', 'Resting Heart Rate', 'Sleep Duration',
  'Time in Range', 'CGM',
  'anterior infarct', 'insulin resistance', 'international units',
  'systolic', 'diastolic',
];

// Recognition writes case out in words when it hears letters spelled aloud:
// "Capital AP o capital B". The case markers carry no meaning once the term is
// matched against the vocabulary, so drop them first.
function stripSpokenCase(s) {
  return s.replace(/\b(capital|caps|cap|uppercase|lowercase|small)\s+/gi, '');
}

// "A P O B" / "a. p. o. b." / "D e x a" -> "APOB" / "DEXA".
// Bounded at 8 letters so ordinary prose ("I a m") isn't swallowed.
function collapseSpelling(s) {
  return s.replace(/\b(?:[A-Za-z][.\s]+){1,7}[A-Za-z]\b/g, (m) => {
    const letters = m.replace(/[.\s]/g, '');
    return letters.length >= 2 && letters.length <= 8 ? letters : m;
  });
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Levenshtein, short-circuited on length gap — only near misses matter here.
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Tolerance scales with length. Four characters or fewer must match exactly:
// at that size a single edit reaches a different marker entirely (ALT/AST,
// BUN/BMI), and a confidently wrong organ panel is worse than no correction.
export function tolerance(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

// Build the matchable vocabulary once per correct() call. Accepts plain strings
// or marker objects, so callers can pass loadBiomarkers() output directly.
function buildVocab(vocabulary) {
  const seen = new Set();
  const out = [];
  for (const entry of vocabulary || []) {
    const term = typeof entry === 'string' ? entry : (entry && (entry.name || entry.code));
    if (!term || typeof term !== 'string') continue;
    const key = norm(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ term, key });
  }
  return out;
}

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// Casing carries meaning in an acronym (DEXA, eGFR, HbA1c, ApoB) but not in an
// ordinary word, so only single-token acronyms are re-cased to the canonical
// spelling. Re-casing "insulin" to "Insulin" would fill the corrections list
// with rows that tell the user nothing, and noise there is not free: it is the
// list they have to actually read to catch a wrong substitution.
function canonicalCase(term) {
  if (/\s/.test(term)) return false;
  return /[A-Z]/.test(term.slice(1)) || /[0-9]/.test(term);
}

// Match a run of words against the vocabulary: exact first, then nearest
// within tolerance.
function lookup(phrase, vocab) {
  const key = norm(phrase);
  if (!key) return null;
  for (const v of vocab) if (v.key === key) return { term: v.term, exact: true };

  const phraseWords = wordCount(phrase);
  let best = null, bestD = 99;
  for (const v of vocab) {
    // A fuzzy match may not add or drop a word. Without this, "no anterior
    // infarct" sits within edit distance 2 of "anterior infarct" — inside the
    // tolerance for a term that long — and the negation silently disappears,
    // inverting the clinical meaning. Absorbing a whole word is never a
    // mishearing worth repairing.
    if (wordCount(v.term) !== phraseWords) continue;
    const d = dist(key, v.key);
    if (d < bestD && d <= tolerance(v.key.length)) { bestD = d; best = v; }
  }
  return best ? { term: best.term, exact: false } : null;
}

/**
 * Repair a transcript against a vocabulary.
 *
 * @param {string} text        Raw transcript from recognition.
 * @param {Array}  vocabulary  Strings, or marker objects with .name/.code.
 * @returns {{ text: string, changes: Array<{from: string, to: string}> }}
 *          changes lists every substitution, in the order applied, for display
 *          and undo. An empty list means the text was left exactly as heard.
 */
export function correct(text, vocabulary) {
  const changes = [];
  if (typeof text !== 'string' || !text) return { text: text || '', changes };

  const vocab = buildVocab(vocabulary);
  let working = collapseSpelling(stripSpokenCase(text));

  // Whole-phrase repairs first — these outrank anything fuzzy matching would do.
  for (const [re, to] of PHRASE_FIXES) {
    working = working.replace(re, (m) => {
      if (m.toLowerCase() !== to.toLowerCase()) changes.push({ from: m, to });
      return to;
    });
  }

  // Marker mishearings, gated on the member actually having that marker.
  for (const [re, to] of TERM_FIXES) {
    if (!vocab.some((v) => v.key === norm(to))) continue;
    working = working.replace(re, (m) => {
      if (m !== to) changes.push({ from: m, to });
      return to;
    });
  }

  // Split keeping whitespace, so the user's spacing survives the round trip.
  const words = working.split(/(\s+)/);
  const out = [];
  let i = 0;

  while (i < words.length) {
    if (/^\s+$/.test(words[i])) { out.push(words[i]); i++; continue; }

    let matched = false;
    // Longest run first, so "visceral fat" wins over a bare "visceral".
    for (let span = 3; span >= 1 && !matched; span--) {
      const parts = [];
      let j = i, taken = 0;
      while (j < words.length && taken < span) {
        if (!/^\s+$/.test(words[j])) taken++;
        parts.push(words[j]); j++;
      }
      if (taken < span) continue;

      const phrase = parts.join('');
      const lead = phrase.match(/^[^A-Za-z0-9]*/)[0];
      const tail = phrase.match(/[^A-Za-z0-9]*$/)[0];
      const core = phrase.slice(lead.length, phrase.length - tail.length);
      if (!core) continue;

      const hit = lookup(core, vocab);
      if (hit) {
        const differsBeyondCase = hit.term.toLowerCase() !== core.toLowerCase();
        // "D e x a" collapses to "Dexa", which matches DEXA exactly once
        // normalised — so the only thing left to repair is the casing.
        const recase = !differsBeyondCase && hit.term !== core && canonicalCase(hit.term);
        if (differsBeyondCase || recase) {
          out.push(lead + hit.term + tail);
          changes.push({ from: core, to: hit.term });
        } else {
          out.push(phrase);
        }
        i = j; matched = true;
      }
    }

    if (!matched) { out.push(words[i]); i++; }
  }

  return { text: out.join(''), changes };
}

/**
 * Vocabulary from loadBiomarkers() output: display names and codes, including
 * related markers. Falls back to the built-in list when the fetch fails or the
 * member has no markers on record.
 */
export function vocabularyFromMarkers(markers) {
  if (!Array.isArray(markers) || markers.length === 0) return FALLBACK_TERMS.slice();
  const terms = [];
  for (const m of markers) {
    if (m && m.name) terms.push(m.name);
    if (m && m.code) terms.push(m.code);
    for (const r of (m && m.related) || []) {
      if (r && r.name) terms.push(r.name);
      if (r && r.code) terms.push(r.code);
    }
  }
  // Clinical phrases are mishearings of ordinary English rather than markers,
  // so they are appended regardless of what the server returned.
  for (const t of FALLBACK_TERMS) {
    if (/[a-z] [a-z]/i.test(t) && !/^[A-Z-]+$/.test(t)) terms.push(t);
  }
  return terms.length ? terms : FALLBACK_TERMS.slice();
}
