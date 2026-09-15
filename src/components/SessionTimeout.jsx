// Session inactivity UI: the pre-expiry warning, and the terminal screen shown
// once a session has actually ended.
//
// z-index sits above the drawer (300/301) and WhyModal (400) — an expiring
// session has to be readable over whatever the user left on screen.

import { BORDER, CARD, MBH_DROP_IMG, OFFWHITE, SLATE, SOFT_RED } from '../lib/constants.js';

function formatLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} second${s === 1 ? '' : 's'}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Warning raised before an idle session is ended.
 * `draftAtRisk` adds the unsaved-work line; `onStayActive` resets the clock.
 */
export function IdleWarningModal({ msLeft, draftAtRisk, onStayActive }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mbh-idle-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.6)', zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: CARD, borderRadius: 16, width: '100%', maxWidth: 420,
        overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{ background: SLATE, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={MBH_DROP_IMG} alt="" style={{ width: 24, height: 24, display: 'block', objectFit: 'contain' }} />
          <div id="mbh-idle-title" style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>
            Still there?
          </div>
        </div>

        <div style={{ padding: '18px 22px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: SLATE, lineHeight: 1.6 }}>
            You&rsquo;ve been inactive for a while. For your privacy we&rsquo;ll sign you
            out in <strong>{formatLeft(msLeft)}</strong>.
          </p>

          {draftAtRisk && (
            <p style={{
              margin: '0 0 10px', padding: '10px 12px', background: '#fdf0ee',
              borderLeft: `3px solid ${SOFT_RED}`, borderRadius: 6,
              fontSize: 12.5, color: SOFT_RED, lineHeight: 1.55,
            }}>
              You have an unsaved MyStrategy draft. If the session ends it will be lost.
            </p>
          )}

          <button
            onClick={onStayActive}
            style={{
              width: '100%', background: SLATE, border: 'none', borderRadius: 999,
              padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'white',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Keep me signed in
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Terminal state — the session is already gone locally. The button completes
 * the Caspio sign-out, which clears the identity-provider cookie and lands the
 * user back on the app.
 */
export function SessionEndedScreen({ onSignIn }) {
  return (
    <div style={{
      fontFamily: "'DM Sans',sans-serif", background: OFFWHITE, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: SLATE,
    }}>
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
        maxWidth: 420, width: '100%', padding: '30px 26px', textAlign: 'center',
      }}>
        <img src={MBH_DROP_IMG} alt="MyBioHealth" style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 14 }} />
        <h1 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>Your session has ended</h1>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>
          We signed you out after a period of inactivity to keep your health
          information private. Any unsaved changes were not kept.
        </p>
        <button
          onClick={onSignIn}
          style={{
            width: '100%', background: SLATE, border: 'none', borderRadius: 999,
            padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'white',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Sign in again
        </button>
      </div>
    </div>
  );
}
