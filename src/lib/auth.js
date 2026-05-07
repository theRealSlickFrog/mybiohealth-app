// Auth helpers for the Netlify app.
// GUID arrives via ?guid= on first load (set by the Caspio redirector DataPage),
// then we stash it in sessionStorage and scrub the URL so it isn't shareable.

const GUID_KEY = 'mbh_user_guid';

// Caspio Authentication login URL (e2j2rj) — hits this redirects to the
// post-login destination (the redirector DataPage) on successful auth.
export const CASPIO_LOGIN_URL = 'https://d2hct674.caspio.app/users/e2j2rj/login';

export function captureGuidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const guid = params.get('guid');
  if (!guid) return getStoredGuid();

  sessionStorage.setItem(GUID_KEY, guid);

  // Scrub guid from URL so users don't share it
  const url = new URL(window.location.href);
  url.searchParams.delete('guid');
  window.history.replaceState({}, '', url.toString());

  return guid;
}

export function getStoredGuid() {
  return sessionStorage.getItem(GUID_KEY) || null;
}

export function clearStoredGuid() {
  sessionStorage.removeItem(GUID_KEY);
}
