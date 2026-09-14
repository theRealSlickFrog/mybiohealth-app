// App shell — sticky top bar, hamburger drawer, page routing.
import { useCallback, useState, useEffect, useRef } from 'react';
import { SLATE, OFFWHITE, MBH_DROP_IMG, NAV_ITEMS } from '../lib/constants.js';
import { captureGuidFromUrl, exchangeHandoffToken, hasHandoffToken, logActivity, logout, isAdminSession, isSessionExpired, setSessionExpiredHandler, navigateExternal, REDIRECTOR_URL, CASPIO_LOGOUT_URL } from '../lib/auth.js';
import { isDraftDirty, setDraftDirty, DRAFT_LEAVE_MSG } from '../lib/strategyBuilder.js';
import { pageFromPath, pathForPage } from '../lib/routes.js';
import useIdleTimeout from '../lib/useIdleTimeout.js';
import { IdleWarningModal, SessionEndedScreen } from '../components/SessionTimeout.jsx';
import Drawer from '../components/Drawer.jsx';
import MyStrategyPage from './MyStrategyPage.jsx';
import BioSignalsPage from './BioSignalsPage.jsx';
import GlucoseSummaryV2Page from './GlucoseSummaryV2Page.jsx';
import DEXAPage from './DEXAPage.jsx';
import AccountPage from './AccountPage.jsx';
import VaultPage from './VaultPage.jsx';
import CalendarPage from './CalendarPage.jsx';
import LibraryPage from './LibraryPage.jsx';
import QuestionsPage from './QuestionsPage.jsx';
import CheckinPrioritiesPage from './CheckinPrioritiesPage.jsx';
import JotsPage from './JotsPage.jsx';
import UpNextPage from './UpNextPage.jsx';
import ContextSignalsPage from './ContextSignalsPage.jsx';
import RiskMeasuresPage from './RiskMeasuresPage.jsx';
import VoiceTestPage from './VoiceTestPage.jsx';

// Capture the GUID at module-load time, before any component renders. Doing
// it in a useEffect means child components mount + run their own effects
// (which read sessionStorage) BEFORE this would have run — React runs child
// effects before parent effects, so a useEffect here was too late.
captureGuidFromUrl();

export default function AppShell() {
  // The URL is the source of truth for which page is showing — read it on the
  // first render so a reload or a deep link lands on the right page instead of
  // resetting to the default.
  const [activePage, setActivePage] = useState(pageFromPath);
  // Mirrors activePage for the navigation callbacks, which are bound once and
  // must read the current page without re-subscribing on every change.
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // If we arrived via the secure ?t= handoff, exchange it for a session before
  // rendering pages. The legacy ?guid= path boots immediately (booting=false).
  const [booting, setBooting] = useState(hasHandoffToken());

  useEffect(() => {
    if (hasHandoffToken()) exchangeHandoffToken().finally(() => setBooting(false));
  }, []);

  // Log a view event whenever the active page changes. The first fire of the
  // session is the 'login' (app just loaded); every change after is a 'pageview'.
  // A session flag (not a mount-only ref) means a browser refresh logs a
  // pageview rather than a duplicate login.
  useEffect(() => {
    if (booting) return;
    const sessionLogged = sessionStorage.getItem('mbh_activity_session');
    logActivity(sessionLogged ? 'pageview' : 'login', activePage);
    sessionStorage.setItem('mbh_activity_session', '1');
  }, [activePage, booting]);

  // ── Session end ─────────────────────────────────────────────────────────────
  // One path for every way a session can finish: the inactivity watchdog below,
  // a dead `exp`, or the proxy refusing the token. The session is torn down
  // locally and the user is parked on a terminal screen rather than bounced
  // straight to Caspio, so the reason they're back at a sign-in prompt is
  // legible. `expiredOnce` keeps that to one logout row no matter how many
  // things notice at once.
  //
  // Holds the reason once ended ('timeout' | 'jwt_expired' | 'unauthorized'),
  // null while the session is live — it drives both the screen and its copy.
  const [expiredReason, setExpiredReason] = useState(null);
  const expired = expiredReason !== null;
  const expiredOnce = useRef(false);

  const endSession = useCallback((reason) => {
    if (expiredOnce.current) return;
    expiredOnce.current = true;
    setExpiredReason(reason || 'timeout');
    // Fire-and-forget: logout() awaits the activity row internally, and the
    // screen below doesn't depend on it landing.
    logout(activePage, reason, { redirect: false });
  }, [activePage]);

  const handleIdleExpire = useCallback(() => endSession('timeout'), [endSession]);

  // Armed only once the ?t= handoff has resolved, so a slow exchange can't burn
  // part of the idle budget before the session exists.
  const { warning: idleWarning, msLeft: idleMsLeft, stayActive } = useIdleTimeout({
    enabled: !booting && !expired,
    onExpire: handleIdleExpire,
  });

  // Expiry the server decides, as opposed to inactivity we decide: the handoff
  // JWT is short-lived, and auth.js's fetch wrapper reports a dead `exp` or a
  // 401/403 into the same ended-session state the watchdog uses.
  useEffect(() => {
    setSessionExpiredHandler(endSession);
    return () => setSessionExpiredHandler(null);
  }, [endSession]);

  // Catch a token that expired while the tab was closed or asleep, before any
  // page has a chance to fetch with it. Re-runs on navigation, which costs
  // nothing and covers a session that lapses mid-visit without a request.
  useEffect(() => {
    if (booting || expired) return;
    if (isSessionExpired()) endSession('jwt_expired');
  }, [booting, expired, endSession]);

  // Guard navigation: an unpromoted strategy draft (StrategyBuilder) blocks
  // leaving until the user confirms — then it's discarded (nothing persisted).
  //
  // Reads the current page from a ref rather than from a state updater: under
  // StrictMode React double-invokes updaters in development, which would ask
  // for confirmation twice and push two history entries.
  const navigate = useCallback((page) => {
    const current = activePageRef.current;
    if (page === current) return;
    if (isDraftDirty() && !window.confirm(DRAFT_LEAVE_MSG)) return;
    setDraftDirty(false);
    window.history.pushState({}, '', pathForPage(page));
    activePageRef.current = page;
    setActivePage(page);
  }, []);

  // Back and Forward move between portal pages, so the draft guard has to cover
  // them too — without it, Back silently discards a draft that in-app
  // navigation explicitly protects. Declining puts the current page back on top
  // of the history stack, since a popstate cannot be cancelled outright.
  useEffect(() => {
    const onPop = () => {
      const next = pageFromPath();
      const current = activePageRef.current;
      if (next === current) return;
      if (isDraftDirty() && !window.confirm(DRAFT_LEAVE_MSG)) {
        window.history.pushState({}, '', pathForPage(current));
        return;
      }
      setDraftDirty(false);
      activePageRef.current = next;
      setActivePage(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Keep the address and the visible page in agreement: a bare /app, or a slug
  // we don't recognise, renders the default page, so rewrite the URL to say so.
  //
  // Rebuilds from the full URL rather than assigning a bare path because the
  // query string must survive — the ?t= handoff token is read out of it during
  // boot, and dropping it here would break sign-in. Held until booting finishes
  // for the same reason.
  useEffect(() => {
    if (booting) return;
    const want = pathForPage(activePage);
    if (window.location.pathname === want) return;
    const url = new URL(window.location.href);
    url.pathname = want;
    window.history.replaceState({}, '', url.toString());
  }, [booting, activePage]);

  const pageLabel = NAV_ITEMS.find((n) => n.key === activePage)?.label;
  const showLabel = activePage !== 'strategy';

  if (booting) {
    return <div style={{ fontFamily: "'DM Sans',sans-serif", background: OFFWHITE, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 14 }}>Signing you in…</div>;
  }

  // Terminal — the session is gone, so no page content may stay on screen.
  if (expired) {
    return (
      <SessionEndedScreen
        reason={expiredReason}
        onSignIn={() => { navigateExternal(CASPIO_LOGOUT_URL, 'sign-in'); }}
      />
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: OFFWHITE, minHeight: '100vh', color: SLATE }}>
      {idleWarning && (
        <IdleWarningModal msLeft={idleMsLeft} draftAtRisk={isDraftDirty()} onStayActive={stayActive} />
      )}

      {drawerOpen && <Drawer activePage={activePage} onSelect={navigate} onClose={() => setDrawerOpen(false)} />}

      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: SLATE, padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
          <div style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
          <div style={{ width: 20, height: 2, background: 'white', borderRadius: 1 }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <img src={MBH_DROP_IMG} alt="MyBioHealth" style={{ width: 24, height: 24, display: 'block', objectFit: 'contain' }} />
          <div style={{ color: 'white', fontSize: 13, fontWeight: 600, lineHeight: 1 }}>
            <em style={{ fontStyle: 'normal' }}>My</em>BioHealth
            {showLabel && <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}> · {pageLabel}</span>}
          </div>
        </div>
        {isAdminSession() && (
          <button onClick={() => { navigateExternal(REDIRECTOR_URL, 'redirector'); }} title="Switch client / experience" style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'white',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>Redirector</button>
        )}
      </div>

      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        {activePage === 'strategy'           && <MyStrategyPage />}
        {activePage === 'biosignals'         && <BioSignalsPage />}
        {activePage === 'glucose_v2'         && <GlucoseSummaryV2Page />}
        {activePage === 'dexa'               && <DEXAPage />}
        {activePage === 'account'            && <AccountPage />}
        {activePage === 'vault'              && <VaultPage />}
        {activePage === 'calendar'           && <CalendarPage />}
        {activePage === 'library'            && <LibraryPage />}
        {activePage === 'questions'          && <QuestionsPage />}
        {activePage === 'checkin_priorities' && <CheckinPrioritiesPage />}
        {activePage === 'jots'               && <JotsPage />}
        {activePage === 'upnext'             && <UpNextPage />}
        {activePage === 'context_signals'    && <ContextSignalsPage />}
        {activePage === 'risk_measures'      && <RiskMeasuresPage />}
        {activePage === 'voice_test'         && <VoiceTestPage />}
      </div>
    </div>
  );
}
