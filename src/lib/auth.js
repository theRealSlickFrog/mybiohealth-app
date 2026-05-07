// Auth helpers for the Netlify app.
// GUID arrives via ?guid= on first load (set by the Caspio redirector DataPage),
// then we stash it in sessionStorage and scrub the URL so it isn't shareable.

const GUID_KEY = 'mbh_user_guid';

// TODO replace with the real Caspio login URL when ready.
// This is the slug of the Caspio Authentication's login DataPage.
export const CASPIO_LOGIN_URL = 'https://YOUR-CASPIO-ACCOUNT.caspio.com/dp/REPLACE_WITH_LOGIN_DATAPAGE_SLUG';

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
