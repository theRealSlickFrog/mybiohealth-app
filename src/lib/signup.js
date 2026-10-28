// Self sign-up through our own form, so a new member goes straight into the app
// with no activation email and no second login.
//
// The proxy does the Caspio work server-side (the REST credentials never reach
// the browser): it creates the member in the Caspio directory, activates them,
// tags the legal_entity row the way the Flex form did (app_preference='netlify',
// allowed_pages='all_pages') and hands back a one-time token — the same kind the
// Caspio minter sends after a normal login. The app then opens /app?t=<token>,
// and the existing exchange in AppShell (lib/auth.js exchangeHandoffToken) turns
// it into a session.
//
// Contract (POST /signup on the proxy — TODO: not built yet, see SignupPage):
//   request  { firstName, lastName, email, password }
//   200      { t }                          one-time handoff token
//   409      { error: 'email_taken' }
//   400      { error: 'invalid', message }  message is shown as-is
//   other    anything else -> generic error

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';

// TODO: match the Caspio directory's password policy once it's confirmed.
export const MIN_PASSWORD = 8;

export class SignupError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export async function signUp({ firstName, lastName, email, password }) {
  let r;
  try {
    r = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password }),
    });
  } catch {
    throw new SignupError('network');
  }
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.t) return d.t;
  if (r.status === 409 || d.error === 'email_taken') throw new SignupError('email_taken');
  if (r.status === 400 && d.message) throw new SignupError('invalid', d.message);
  throw new SignupError('failed');
}
