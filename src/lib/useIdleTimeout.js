// Inactivity watchdog for the authenticated session.
//
// Two stages. After IDLE_WARNING_MS with no interaction the hook raises
// `warning` with IDLE_GRACE_MS left on the clock; if that grace period also
// elapses, `onExpire` fires (IDLE_TIMEOUT_MS idle in total).
//
// Once the warning is up, ordinary activity no longer resets the clock — only
// the explicit keep-alive does. Otherwise a stray mousemove the user never
// noticed making would silently cancel the countdown, which makes both the
// warning and its button pointless.

import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE_GRACE_MS, IDLE_WARNING_MS } from './constants.js';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

// mousemove and scroll fire continuously; collapse resets to one per second so
// we aren't tearing down and rebuilding timers hundreds of times a second.
const RESET_THROTTLE_MS = 1000;

/**
 * @param {object}   options
 * @param {boolean}  options.enabled  Arm the watchdog. Keep false until the
 *                                    session actually exists (e.g. while the
 *                                    ?t= handoff is still being exchanged).
 * @param {Function} options.onExpire Called once when the grace period runs out.
 * @returns {{ warning: boolean, msLeft: number, stayActive: Function }}
 */
export default function useIdleTimeout({ enabled, onExpire }) {
  const [warning, setWarning] = useState(false);
  const [msLeft, setMsLeft] = useState(IDLE_GRACE_MS);

  const warnTimer = useRef(null);
  const expireTimer = useRef(null);
  const lastReset = useRef(0);
  const deadline = useRef(0);

  // Both read through refs so that a new onExpire identity (it closes over the
  // active page) or a warning flip does not re-arm the timers or re-subscribe
  // the listeners.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const warningRef = useRef(false);
  warningRef.current = warning;

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
    warnTimer.current = null;
    expireTimer.current = null;
  }, []);

  // (Re)start the full idle clock from now.
  const arm = useCallback(() => {
    clearTimers();
    setWarning(false);
    setMsLeft(IDLE_GRACE_MS);
    warnTimer.current = setTimeout(() => {
      deadline.current = Date.now() + IDLE_GRACE_MS;
      setWarning(true);
      setMsLeft(IDLE_GRACE_MS);
      expireTimer.current = setTimeout(() => {
        clearTimers();
        if (onExpireRef.current) onExpireRef.current();
      }, IDLE_GRACE_MS);
    }, IDLE_WARNING_MS);
  }, [clearTimers]);

  const stayActive = useCallback(() => {
    lastReset.current = Date.now();
    arm();
  }, [arm]);

  // Arm on enable, tear down on disable/unmount.
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return undefined;
    }
    arm();
    return clearTimers;
  }, [enabled, arm, clearTimers]);

  // Activity listeners. Passive, and frozen while the warning is showing.
  useEffect(() => {
    if (!enabled) return undefined;
    const onActivity = () => {
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastReset.current < RESET_THROTTLE_MS) return;
      lastReset.current = now;
      arm();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
  }, [enabled, arm]);

  // Countdown for the warning copy. Derived from a wall-clock deadline rather
  // than by subtracting a fixed step, so a throttled background tab shows the
  // true remaining time instead of drifting.
  useEffect(() => {
    if (!warning) return undefined;
    const tick = () => setMsLeft(Math.max(0, deadline.current - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [warning]);

  return { warning, msLeft, stayActive };
}
