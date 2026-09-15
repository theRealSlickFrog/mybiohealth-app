// The member's dictation vocabulary, fetched once and shared by every field.
//
// Dictation now sits on a dozen fields spread across MyStrategy, the strategy
// builder, DEXA, Questions and the glucose three-voices — several of which
// render on the same page at the same time. A per-field fetch would mean the
// same request repeated across one page load, and worse, would let two fields
// on that page correct against different vocabularies when one request failed
// and another succeeded. Every caller awaits one shared promise instead.

import { useEffect, useState } from 'react';
import { getStoredGuid } from './auth.js';
import { loadBiomarkers, DEV_MEMBER } from './biomarkers.js';
import { vocabularyFromMarkers, FALLBACK_TERMS } from './voiceCorrection.js';

// The in-flight or settled fetch. Module scope, not React state: it has to
// outlive any one component so a field mounted later reuses the answer.
let pending = null;

/** Resolves to { terms, fallback } — fallback true when it is the built-in list. */
export function loadVocabulary() {
  if (!pending) {
    const member = getStoredGuid() || DEV_MEMBER;
    pending = loadBiomarkers(member)
      .then((markers) => ({
        terms: vocabularyFromMarkers(markers),
        fallback: !Array.isArray(markers) || markers.length === 0,
      }))
      .catch(() => {
        // Don't cache a failure as the session's answer. The proxy may have
        // been briefly unreachable, and every field opened for the rest of the
        // session would otherwise be stuck on the generic fallback list.
        pending = null;
        return { terms: FALLBACK_TERMS.slice(), fallback: true };
      });
  }
  return pending;
}

/**
 * Vocabulary for a dictation field. Null until it arrives — useVoiceInput reads
 * it through a ref at each result, so a field dictated into before the fetch
 * lands starts correcting the moment it does rather than missing out.
 */
export default function useVocabulary() {
  const [state, setState] = useState({ vocabulary: null, usingFallback: false });

  useEffect(() => {
    let cancelled = false;
    loadVocabulary().then(({ terms, fallback }) => {
      if (!cancelled) setState({ vocabulary: terms, usingFallback: fallback });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}
