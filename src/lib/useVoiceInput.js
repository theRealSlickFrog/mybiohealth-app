// Dictation hook — wraps the browser SpeechRecognition API and runs every
// final transcript through the term-correction pass.
//
// Corrections are applied to final results only. Interim results are appended
// raw: recognition revises interim text continuously as it hears more, so
// correcting it makes words visibly flip back and forth while the user is
// still mid-sentence, and the change list fills with substitutions that were
// then re-heard differently a moment later.
//
// Every failure mode gets its own message. "Something went wrong" gives the
// user nothing to act on, and the fixes are all different: allow a permission,
// plug in a microphone, move to https, speak again.

import { useCallback, useEffect, useRef, useState } from 'react';
import { correct } from './voiceCorrection.js';

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// The microphone is a single shared resource, and the test screen has three
// dictation fields. Without this, tapping a second mic while the first is still
// running leaves two recognisers competing — and the first keeps writing into a
// field the user has already moved away from. Starting one stops any other.
let stopActive = null;

// SpeechRecognition error codes → what the user can actually do about it.
const ERROR_TEXT = {
  'not-allowed':         'Microphone access was blocked. Allow it from the icon in the address bar, then try again.',
  'service-not-allowed': 'Microphone access was blocked by the browser or your device settings.',
  'audio-capture':       'No microphone was found. Check that one is connected and not in use by another app.',
  'no-speech':           'Nothing was heard. Try again, a little closer to the microphone.',
  'network':             'Speech recognition could not reach the network. Check your connection and try again.',
  'language-not-supported': 'Speech recognition does not support this language on your browser.',
  'bad-grammar':         'Speech recognition rejected its grammar configuration.',
};

export const isSupported = () => Boolean(SR);

/**
 * @param {object}   options
 * @param {Array}    options.vocabulary  Terms to correct against; see voiceCorrection.
 * @param {Function} options.onText      Called with the full field text as it evolves.
 * @param {Function} options.getBaseText Current field text, read at start so
 *                                       dictation appends rather than replaces.
 * @returns {{ listening, toggle, stop, changes, error, supported, clearChanges, dropChange }}
 */
export default function useVoiceInput({ vocabulary, onText, getBaseText }) {
  const [listening, setListening] = useState(false);
  const [changes, setChanges] = useState([]);
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  // Latest values, read from inside recognition callbacks that were bound once.
  const vocabRef = useRef(vocabulary);
  const onTextRef = useRef(onText);
  const getBaseRef = useRef(getBaseText);
  useEffect(() => { vocabRef.current = vocabulary; }, [vocabulary]);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => { getBaseRef.current = getBaseText; }, [getBaseText]);

  // Text present when dictation started, plus everything finalised since.
  const baseRef = useRef('');
  const committedRef = useRef('');

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) { try { rec.stop(); } catch { /* already stopping */ } }
  }, []);

  // Abandoning the page mid-dictation must release the microphone.
  useEffect(() => () => {
    const rec = recRef.current;
    if (rec) { recRef.current = null; try { rec.abort(); } catch { /* gone */ } }
  }, []);

  const start = useCallback(() => {
    if (!SR) {
      setError('This browser does not support speech recognition. Open the app in Chrome or Edge.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('The microphone needs a secure page. Open this over https, or on localhost.');
      return;
    }
    if (recRef.current) return;

    let rec;
    try {
      rec = new SR();
    } catch {
      setError('Could not start speech recognition. Reload the page and try again.');
      return;
    }

    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    // Hand the microphone over from whichever field held it.
    const release = () => { try { rec.stop(); } catch { /* already stopping */ } };
    if (stopActive) { const prev = stopActive; stopActive = null; prev(); }
    stopActive = release;

    const existing = (getBaseRef.current && getBaseRef.current()) || '';
    baseRef.current = existing ? existing.replace(/\s+$/, '') + ' ' : '';
    committedRef.current = '';

    rec.onstart = () => { setListening(true); setError(null); };

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const { text, changes: made } = correct(chunk, vocabRef.current);
          committedRef.current += text;
          if (made.length) setChanges((prev) => prev.concat(made));
        } else {
          interim += chunk;
        }
      }
      if (onTextRef.current) {
        onTextRef.current(baseRef.current + committedRef.current + interim);
      }
    };

    rec.onerror = (e) => {
      // 'aborted' is what stop() produces on some browsers — not a failure.
      if (e.error === 'aborted') return;
      setError(ERROR_TEXT[e.error] || `Dictation stopped unexpectedly (${e.error}).`);
    };

    rec.onend = () => {
      if (stopActive === release) stopActive = null;
      recRef.current = null;
      setListening(false);
      // Drop the trailing space left by the last interim chunk.
      if (onTextRef.current) {
        onTextRef.current((baseRef.current + committedRef.current).replace(/\s+$/, ''));
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      if (stopActive === release) stopActive = null;
      setListening(false);
      setError('Could not start the microphone. It may already be in use — reload the page and try again.');
    }
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) stop(); else start();
  }, [start, stop]);

  const clearChanges = useCallback(() => setChanges([]), []);

  // Undo removes the row as well — the correction no longer stands, so leaving
  // it listed would misreport what the text actually contains.
  const dropChange = useCallback((index) => {
    setChanges((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    listening,
    toggle,
    stop,
    changes,
    error,
    supported: Boolean(SR),
    clearChanges,
    dropChange,
  };
}
