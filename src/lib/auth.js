// Auth helpers for the Netlify app.
// GUID arrives via ?guid= on first load (set by the Caspio redirector DataPage),
// then we stash it in sessionStorage and scrub the URL so it isn't shareable.
//
// login_log writes mirror what patient footer.js does on the Caspio side, so
// React-bound members produce the same audit rows Caspio-bound members do.

const API_BASE = 'https://kenises-api-proxy.netlify.app';
const GUID_KEY = 'mbh_user_guid';
const LOG_ID_KEY = 'mbh_login_log_id';

// Caspio Authentication login URL (e2j2rj) — must use the vanity domain so
// the auth cookie is set on the same origin as the destination DataPages.
// Using the legacy d2hct674.caspio.app domain causes a cross-subdomain bounce:
// auth succeeds, but redirect to a vanity-domain page finds no cookie there.
export const CASPIO_LOGIN_URL = 'https://mybiohealth.caspio.app/users/e2j2rj/login';

// Caspio logout URL — must match the domain the auth cookie was set on.
export const CASPIO_LOGOUT_URL = 'https://mybiohealth.caspio.app/users/e2j2rj/logout?redirect=https://mybiohealth.netlify.app';

export async function logout() {
  await logLogout();
  clearStoredGuid();
  sessionStorage.removeItem(LOG_ID_KEY);
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

  // Fresh guid arrived from the redirector → treat as a new login event.
  // Fire-and-forget; we don't want page render to wait on this.
  logLogin(guid);

  return guid;
}

export function getStoredGuid() {
  return sessionStorage.getItem(GUID_KEY) || null;
}

export function clearStoredGuid() {
  sessionStorage.removeItem(GUID_KEY);
}

// Write a new login_log row, then store its log_id for the logout PUT later.
async function logLogin(userGuid) {
  try {
    // Look up name + email from legal_entity (mirrors patient footer.js behavior)
    let userName = '';
    let userEmail = '';
    try {
      const userResp = await fetch(
        `${API_BASE}/rest/v2/tables/legal_entity/records?q.select=First_Name,Last_Name,Email&q.where=UserGUID='${userGuid}'`
      );
      if (userResp.ok) {
        const userData = await userResp.json();
        if (userData.Result && userData.Result.length > 0) {
          const u = userData.Result[0];
          userName = `${u.First_Name || ''} ${u.Last_Name || ''}`.trim();
          userEmail = u.Email || '';
        }
      }
    } catch (e) {
      console.warn('login_log: could not fetch user details');
    }

    const loginResp = await fetch(`${API_BASE}/rest/v2/tables/login_log/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legal_entity_id: userGuid,
        user_email: userEmail,
        user_name: userName,
        login_time: new Date().toISOString(),
        user_agent: navigator.userAgent,
        app_version: 'V2'
      })
    });

    if (!loginResp.ok && loginResp.status !== 201) {
      console.error('login_log: POST failed, status', loginResp.status);
      return;
    }

    // Caspio's POST response often doesn't include the new row's id, so query
    // back for the most recent row for this user.
    try {
      const qResp = await fetch(
        `${API_BASE}/rest/v2/tables/login_log/records?q.where=legal_entity_id='${userGuid}'&q.orderBy=log_id DESC&q.limit=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (qResp.ok) {
        const qData = await qResp.json();
        if (qData.Result && qData.Result.length > 0 && qData.Result[0].log_id) {
          sessionStorage.setItem(LOG_ID_KEY, String(qData.Result[0].log_id));
        }
      }
    } catch (qErr) {
      console.warn('login_log: could not retrieve log_id');
    }
  } catch (err) {
    console.error('login_log: unexpected error', err);
  }
}

// Update the stored login_log row with logout_time + logout_type.
// Caller must await this before navigating away — fetch+keepalive can survive
// the upcoming navigation but only if it's actually issued first.
async function logLogout() {
  const loginLogId = sessionStorage.getItem(LOG_ID_KEY);
  if (!loginLogId) return;

  try {
    await fetch(`${API_BASE}/rest/v2/tables/login_log/records?q.where=log_id=${loginLogId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        logout_time: new Date().toISOString(),
        logout_type: 'manual'
      })
    });
  } catch (err) {
    console.error('login_log: logout PUT failed', err);
  }
}
