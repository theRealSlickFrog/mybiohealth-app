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

// Attach the session JWT to every proxy request, in one place, so no individual
// fetch site can be missed when the proxy enforces auth. Only proxy URLs get the
// header; everything else (CDNs, fonts) is untouched. Harmless while enforcement
// is off (the proxy just ignores it).
if (typeof window !== 'undefined' && !window.__mbhFetchPatched) {
  window.__mbhFetchPatched = true;
  const _fetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const tok = sessionStorage.getItem(JWT_KEY);
      if (tok && (url.startsWith('/api') || url.includes('kenises-api-proxy.netlify.app'))) {
        init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${tok}` } };
      }
    } catch (e) { /* never let the patch break a request */ }
    return _fetch(input, init);
  };
}

// Caspio Authentication login URL (e2j2rj) — must use the vanity domain so
// the auth cookie is set on the same origin as the destination DataPages.
// Using the legacy d2hct674.caspio.app domain causes a cross-subdomain bounce:
// auth succeeds, but redirect to a vanity-domain page finds no cookie there.
export const CASPIO_LOGIN_URL = 'https://mybiohealth.caspio.app/users/e2j2rj/login';

// Caspio logout URL — must match the domain the auth cookie was set on.
export const CASPIO_LOGOUT_URL = 'https://mybiohealth.caspio.app/users/e2j2rj/logout?redirect=https://mybiohealth.netlify.app';

export async function logout(currentPage) {
  // Log the logout event before navigating away. Awaited so the row lands
  // first; keepalive is the safety net.
  await logActivity('logout', currentPage || '', 'manual');
  clearStoredGuid();
  sessionStorage.removeItem(JWT_KEY);
  sessionStorage.removeItem(NAME_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = CASPIO_LOGOUT_URL;
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
  try {
    const tok = sessionStorage.getItem(JWT_KEY);
    if (!tok) return null;
    let b = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    const payload = JSON.parse(atob(b));
    return payload.act || null;
  } catch (e) { return null; }
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
