// Auth helpers for the Netlify app.
// GUID arrives via ?guid= on first load (set by the Caspio redirector DataPage),
// then we stash it in sessionStorage and scrub the URL so it isn't shareable.
//
// Activity logging mirrors patient footer.js (V1): every login / pageview /
// logout is a plain INSERT into activity_log. No row updates, no log_id
// tracking. V2 is an SPA, so "pageview" is driven by view changes in AppShell,
// not document loads.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const GUID_KEY = 'mbh_user_guid';
const JWT_KEY = 'mbh_jwt';
const NAME_KEY = 'mbh_user_name';
const EMAIL_KEY = 'mbh_user_email';
const SESSION_KEY = 'mbh_activity_session';

const isProxyUrl = (url) => url.startsWith('/api') || url.includes('kenises-api-proxy.netlify.app');

// The handoff exchange is the one proxy call that legitimately runs without a
// valid session, and a stale one-time token makes it fail. Reading that as an
// expiry would raise the ended-session screen in the middle of signing in.
const isSessionExchange = (url) => /\/session(\?|$)/.test(url);

// Attach the session JWT to every proxy request, in one place, so no individual
// fetch site can be missed when the proxy enforces auth. Only proxy URLs get the
// header; everything else (CDNs, fonts) is untouched. Harmless while enforcement
// is off (the proxy just ignores it).
//
// The same choke point detects a session that has ended server-side: an `exp`
// already in the past on the way out, or a 401/403 on the way back. Before this,
// nothing checked either — an expired JWT simply produced generic fetch errors
// on every page and the user was never told to sign in again.
if (typeof window !== 'undefined' && !window.__mbhFetchPatched) {
  window.__mbhFetchPatched = true;
  const _fetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    let url = '';
    try {
      url = typeof input === 'string' ? input : (input && input.url) || '';
    } catch (e) { /* treat as non-proxy */ }

    const watched = isProxyUrl(url) && !isSessionExchange(url);

    try {
      const tok = sessionStorage.getItem(JWT_KEY);
      if (tok && isProxyUrl(url)) {
        init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${tok}` } };
      }
      // Report before sending, but still send: the caller keeps its normal
      // response or rejection, so this stays a pure observer of the request.
      if (watched && isSessionExpired()) reportSessionExpired('jwt_expired');
    } catch (e) { /* never let the patch break a request */ }

    const res = _fetch(input, init);
    if (!watched) return res;
    // The proxy refusing our credentials is authoritative, whatever the local
    // clock thinks. Rejections pass straight through untouched.
    return res.then((r) => {
      if ((r.status === 401 || r.status === 403) && hasSession()) {
        reportSessionExpired('unauthorized');
      }
      return r;
    });
  };
}

// ── Session expiry ────────────────────────────────────────────────────────────
// auth.js lives outside React, so the UI registers a handler here and the fetch
// wrapper reports into it.

let sessionExpiredHandler = null;
let sessionExpiredFired = false;
let pendingExpiredReason = null;

export function setSessionExpiredHandler(fn) {
  sessionExpiredHandler = fn;
  // A 401 can land before the handler is registered: React runs child effects
  // before parent effects, so a page's fetch fires before AppShell's
  // registration effect. Replay an early report rather than dropping it.
  if (fn && pendingExpiredReason) {
    const reason = pendingExpiredReason;
    pendingExpiredReason = null;
    fn(reason);
  }
}

// Announce that the session is over. Idempotent per page load — many in-flight
// requests can 401 at once, and that must produce one ended session, not one
// per response. Deliberately does NOT clear storage: the handler logs the
// logout row first, and logActivity resolves the member from the stored GUID.
export function reportSessionExpired(reason) {
  if (sessionExpiredFired) return;
  sessionExpiredFired = true;
  if (sessionExpiredHandler) sessionExpiredHandler(reason);
  else pendingExpiredReason = reason;
}

export function hasSession() {
  return !!(getStoredGuid() || getSessionToken());
}

// Decode a JWT payload (base64url, unverified — the proxy is what verifies).
// Returns null for a missing or malformed token.
function jwtPayload() {
  try {
    const tok = sessionStorage.getItem(JWT_KEY);
    if (!tok) return null;
    let b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    return JSON.parse(atob(b));
  } catch (e) {
    return null;
  }
}

// True only when a JWT exists AND its exp has passed. A legacy ?guid= session
// carries no token and so can never be "expired" here — that path has no
// client-visible expiry at all.
export function isSessionExpired() {
  const p = jwtPayload();
  if (!p || typeof p.exp !== 'number') return false;
  return p.exp * 1000 <= Date.now();
}

// ── Leaving the app ───────────────────────────────────────────────────────────
// Every URL below is a production Caspio endpoint, so following one in dev
// drops you out of the local server and into the live app — losing the dev
// session and whatever you were testing.
//
// The guard is `import.meta.env.DEV`, which Vite substitutes as a literal at
// build time: in a production bundle the condition is `false`, the branch is
// eliminated, and what ships is the bare assignment that was there before.
// Deliberately not a hostname or NODE_ENV check — either of those is evaluated
// at runtime and can therefore be wrong in a real build.

function logSuppressed(label, url) {
  console.info(
    `[mbh] dev: suppressed the ${label} redirect. In production this would navigate to ${url}`,
  );
}

/**
 * Navigate out of the SPA to an external URL.
 * @returns {boolean} whether navigation happened — always true in production.
 */
export function navigateExternal(url, label) {
  if (import.meta.env.DEV) {
    logSuppressed(label, url);
    return false;
  }
  window.location.href = url;
  return true;
}

/**
 * onClick for an <a href> pointing at one of these URLs. Returns undefined in
 * production, so the anchor keeps its plain default behaviour and nothing is
 * added to the click path; in dev it cancels the navigation instead. The href
 * itself is left intact either way, so "copy link" and middle-click still give
 * the real destination while developing.
 */
export function devBlockExternalLink(url, label) {
  if (!import.meta.env.DEV) return undefined;
  return (e) => {
    e.preventDefault();
    logSuppressed(label, url);
  };
}

// Caspio Authentication login URL (e2j2rj) — must use the vanity domain so
// the auth cookie is set on the same origin as the destination DataPages.
// Using the legacy d2hct674.caspio.app domain causes a cross-subdomain bounce:
// auth succeeds, but redirect to a vanity-domain page finds no cookie there.
export const CASPIO_LOGIN_URL = 'https://mybiohealth.caspio.app/users/e2j2rj/login';

// Caspio logout URL — must match the domain the auth cookie was set on.
export const CASPIO_LOGOUT_URL = 'https://mybiohealth.caspio.app/users/e2j2rj/logout?redirect=https://mybiohealth.netlify.app';

// Drop every trace of the session from this tab. Split out of logout() so the
// inactivity watchdog can end a session without also driving the navigation.
export function clearSession() {
  clearStoredGuid();
  sessionStorage.removeItem(JWT_KEY);
  sessionStorage.removeItem(NAME_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

// `reason` is the activity_log event_detail: 'manual' (the drawer button),
// 'timeout' (inactivity watchdog), 'forced'.
//
// `redirect` exists because a timed-out session shows its own "session ended"
// screen instead of bouncing straight to Caspio — the screen's button carries
// the user on to CASPIO_LOGOUT_URL. Note that suppressing the redirect leaves
// the Caspio auth cookie alive until then: this tab is signed out, the identity
// provider is not.
export async function logout(currentPage, reason = 'manual', { redirect = true } = {}) {
  // Log the logout event before navigating away. Awaited so the row lands
  // first; keepalive is the safety net. Must run before clearSession(), since
  // logActivity resolves the member from the stored GUID.
  await logActivity('logout', currentPage || '', reason);
  clearSession();
  if (redirect) navigateExternal(CASPIO_LOGOUT_URL, 'logout');
}

// ── Token handoff (new, secure path) ──────────────────────────────────────
// The Caspio "minter" redirects here with ?t=<one-time token>. We exchange it
// once for a short-lived session JWT (the proxy derives the member server-side),
// store the JWT + resolved GUID, and scrub the URL. The legacy ?guid= path
// (captureGuidFromUrl) still works during the transition.
export function hasHandoffToken() {
  return new URLSearchParams(window.location.search).has('t');
}

export function getSessionToken() {
  return sessionStorage.getItem(JWT_KEY) || null;
}

export async function exchangeHandoffToken() {
  const t = new URLSearchParams(window.location.search).get('t');
  if (!t) return getStoredGuid();
  try {
    const r = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.token) sessionStorage.setItem(JWT_KEY, d.token);
      if (d.member_id) sessionStorage.setItem(GUID_KEY, d.member_id);
    } else {
      console.warn(`session exchange failed: ${r.status}`);
    }
  } catch (e) {
    console.error('session exchange error:', e);
  }
  // Scrub the one-time token from the URL so it can't be re-shared.
  const url = new URL(window.location.href);
  url.searchParams.delete('t');
  window.history.replaceState({}, '', url.toString());
  return getStoredGuid();
}

export function captureGuidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const guid = params.get('guid');
  if (!guid) return getStoredGuid();

  sessionStorage.setItem(GUID_KEY, guid);

  // Scrub guid from URL so users don't share it
  const url = new URL(window.location.href);
  url.searchParams.delete('guid');
  window.history.replaceState({}, '', url.toString());

  // Note: login/pageview events are logged by AppShell's view-change effect,
  // not here — so a refresh logs a pageview, not a duplicate login.
  return guid;
}

export function getStoredGuid() {
  return sessionStorage.getItem(GUID_KEY) || null;
}

export function clearStoredGuid() {
  sessionStorage.removeItem(GUID_KEY);
}

// Returns the acting admin's GUID when this is an admin "view as client"
// impersonation session (the handoff JWT carries the actor in `act`), else null.
// Used to attribute impersonated activity to the admin (as an 'admin_view'
// event) instead of polluting the client's own activity_log.
export function impersonatingActor() {
  const p = jwtPayload();
  return (p && p.act) || null;
}

// Post-login redirector — the Caspio Flex page that routes by App_Preference
// and, for admins with a blank preference, shows the client picker.
export const REDIRECTOR_URL = 'https://mybiohealth.caspio.app/mybiohealth/patient/redirector';

// True when an admin is driving this session — either logged in as an admin
// (JWT role 'admin') or impersonating a client via "view as" (act present).
// Gates the admin-only shortcuts in the top bar: Redirector, and the button
// to the voice test screen that is kept out of the member-facing drawer.
export function isAdminSession() {
  const p = jwtPayload();
  if (!p) return false;
  return p.role === 'admin' || !!p.act;
}

// Shared activity writer — one INSERT per event into activity_log.
// eventType: 'login' | 'pageview' | 'logout'
// pageName:  the active view key (strategy, biosignals, ...)
// eventDetail: logout reason ('manual' / 'forced' / 'timeout'), else omitted
export async function logActivity(eventType, pageName, eventDetail) {
  const memberGuid = getStoredGuid();
  if (!memberGuid) return;

  // Admin "view as client": attribute the row to the acting admin (the subject),
  // as an 'admin_view' event tagged with the client viewed (as:<clientGuid>).
  // This keeps the client's own activity_log clean while still recording who
  // viewed whom. Normal sessions log as themselves, unchanged.
  const actor = impersonatingActor();
  const subjectGuid = actor || memberGuid;
  const evType = actor ? 'admin_view' : eventType;
  const evDetail = actor ? `as:${memberGuid}` : (eventDetail || '');

  // Resolve subject name + email once per session, then cache (no lookup per view)
  let userName = sessionStorage.getItem(NAME_KEY);
  let userEmail = sessionStorage.getItem(EMAIL_KEY);
  if (userName === null || userEmail === null) {
    userName = '';
    userEmail = '';
    try {
      const r = await fetch(
        `${API_BASE}/rest/v2/tables/legal_entity/records?q.select=First_Name,Last_Name,Email&q.where=UserGUID='${subjectGuid}'`
      );
      if (r.ok) {
        const d = await r.json();
        if (d.Result && d.Result.length > 0) {
          const u = d.Result[0];
          userName = `${u.First_Name || ''} ${u.Last_Name || ''}`.trim();
          userEmail = u.Email || '';
        }
      }
    } catch (e) { /* name/email stay blank */ }
    sessionStorage.setItem(NAME_KEY, userName);
    sessionStorage.setItem(EMAIL_KEY, userEmail);
  }

  const payload = {
    legal_entity_id: subjectGuid,
    user_email: userEmail,
    user_name: userName,
    event_type: evType,
    event_time: new Date().toISOString(),
    page_name: pageName || '',
    event_detail: evDetail,
    user_agent: navigator.userAgent,
    app_version: 'V2'
  };

  try {
    const resp = await fetch(`${API_BASE}/rest/v2/tables/activity_log/records`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`activity_log: ${eventType} (${pageName}) — status ${resp.status}`);
  } catch (e) {
    console.error(`activity_log: ${eventType} POST failed`, e);
  }
}
