// Auth helpers for the Netlify app.
// GUID arrives via ?guid= on first load (set by the Caspio redirector DataPage),
// then we stash it in sessionStorage and scrub the URL so it isn't shareable.
//
// Activity logging mirrors patient footer.js (V1): every login / pageview /
// logout is a plain INSERT into activity_log. No row updates, no log_id
// tracking. V2 is an SPA, so "pageview" is driven by view changes in AppShell,
// not document loads.

const API_BASE = 'https://kenises-api-proxy.netlify.app';
const GUID_KEY = 'mbh_user_guid';
const NAME_KEY = 'mbh_user_name';
const EMAIL_KEY = 'mbh_user_email';
const SESSION_KEY = 'mbh_activity_session';

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
  sessionStorage.removeItem(NAME_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = CASPIO_LOGOUT_URL;
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

// Shared activity writer — one INSERT per event into activity_log.
// eventType: 'login' | 'pageview' | 'logout'
// pageName:  the active view key (strategy, biosignals, ...)
// eventDetail: logout reason ('manual' / 'forced' / 'timeout'), else omitted
export async function logActivity(eventType, pageName, eventDetail) {
  const userGuid = getStoredGuid();
  if (!userGuid) return;

  // Resolve user name + email once per session, then cache (no lookup per view)
  let userName = sessionStorage.getItem(NAME_KEY);
  let userEmail = sessionStorage.getItem(EMAIL_KEY);
  if (userName === null || userEmail === null) {
    userName = '';
    userEmail = '';
    try {
      const r = await fetch(
        `${API_BASE}/rest/v2/tables/legal_entity/records?q.select=First_Name,Last_Name,Email&q.where=UserGUID='${userGuid}'`
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
    legal_entity_id: userGuid,
    user_email: userEmail,
    user_name: userName,
    event_type: eventType,
    event_time: new Date().toISOString(),
    page_name: pageName || '',
    event_detail: eventDetail || '',
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
