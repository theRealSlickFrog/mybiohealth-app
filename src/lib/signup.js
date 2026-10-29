// Self sign-up through our own form: no activation email to wait for.
//
// Our Netlify function (netlify/functions/signup.mjs) does the Caspio work
// server-side, so the API credentials never reach the browser: it creates the
// member in the Caspio directory (tagged app_preference='netlify',
// allowed_pages='all_pages', as the Flex form did), adds the member_info
// WELCOME_TOUR='pending' row that opens the Welcome popup (lib/welcomeTour.js),
// and activates them without the email. What comes back is Caspio's activation
// link; the browser goes straight there, the member sets a password, then signs
// in once.
//
// Contract (POST /.netlify/functions/signup):
//   request  { firstName, lastName, email, website }   website = honeypot, always ''
//   200      { activationUrl }
//   409      { error: 'email_taken' }
//   400      { error: 'invalid', message }  message is shown as-is
//   other    anything else -> generic error

const ENDPOINT = '/.netlify/functions/signup';

// The link must be Caspio's, never anywhere else.
const isCaspioUrl = (u) => {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && /(^|\.)caspio\.(app|com)$/.test(hostname);
  } catch { return false; }
};

export class SignupError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export async function signUp({ firstName, lastName, email, website = '' }) {
  let r;
  try {
    r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, website }),
    });
  } catch {
    throw new SignupError('network');
  }
  const d = await r.json().catch(() => ({}));
  if (r.ok && isCaspioUrl(d.activationUrl)) return d.activationUrl;
  if (r.status === 409 || d.error === 'email_taken') throw new SignupError('email_taken');
  if (r.status === 400 && d.message) throw new SignupError('invalid', d.message);
  throw new SignupError('failed');
}
