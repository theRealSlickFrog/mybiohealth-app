// POST /.netlify/functions/signup — self sign-up from our own /signup form.
//
// Creates the member in the Caspio directory and activates them without the
// activation email: Caspio hands back the activation link instead, and the
// browser goes straight to it, where the member sets their password. So there
// is no inbox step; the member then signs in once.
//
// Why there's no password on our form: the Caspio API can't set a directory
// user's password (REST v4: create takes directory fields only, and the
// password is set through the activation link). Checked against the account's
// Swagger, Oct 2026.
//
// Steps:
//   1. token      POST {base}/oauth/token (client credentials)
//   2. existing?  GET  v4 /directories/{dir}/users?Where=Email=N'…'
//                 Active (or locked etc.) -> 409 email_taken. Pending or expired
//                 activation -> skip to 4 and hand out a fresh link.
//   3. create     POST v4 /directories/{dir}/users?echo=true
//                 {Email, First_Name, Last_Name, app_preference, allowed_pages}
//                 The directory's user table is legal_entity, so these land
//                 there, tagged the way the Flex sign-up form tagged them.
//   4. activate   POST v4 /directories/{dir}/users/{guid}/activate?sendEmail=false
//                 -> { data: { activationUrl } }
//   5. welcome    POST v3 /tables/member_info/records
//                 {member_id, feature:'WELCOME_TOUR', text_box_1:'pending'}
//                 so the Welcome popup (EULA first) opens after the first login.
//   -> 200 { activationUrl }
//
// Environment (Netlify site settings; never in the repo):
//   CASPIO_BASE_URL        https://d2hct674.caspio.com
//   CASPIO_CLIENT_ID       } from a Caspio Web Services profile with access to
//   CASPIO_CLIENT_SECRET   } the member directory and the member_info table
//   CASPIO_DIRECTORY_ID    6-character id of the member directory

const FIELDS = {
  email: 'Email',
  first: 'First_Name',
  last: 'Last_Name',
};
// Same tags the Flex sign-up form set, so the post-login redirector sends the
// member into this app with every page open.
const TAGS = { app_preference: 'netlify', allowed_pages: 'all_pages' };
const ACTIVE_STATES = new Set(['Active', 'Locked', 'Suspended', 'PasswordExpired', 'Inactive']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const sqlStr = (s) => `N'${String(s).replace(/'/g, "''")}'`;

class CaspioError extends Error {
  constructor(step, status, detail) {
    super(`${step} ${status}`);
    this.step = step;
    this.status = status;
    this.detail = detail;
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const env = {
    base: (process.env.CASPIO_BASE_URL || '').replace(/\/+$/, ''),
    id: process.env.CASPIO_CLIENT_ID,
    secret: process.env.CASPIO_CLIENT_SECRET,
    dir: process.env.CASPIO_DIRECTORY_ID,
  };
  if (!env.base || !env.id || !env.secret || !env.dir) {
    console.error('signup: Caspio environment variables are not set');
    return json(503, { error: 'not_configured' });
  }

  let input;
  try { input = await req.json(); } catch { return json(400, { error: 'invalid', message: 'Please fill in the form.' }); }
  // Honeypot: a field people never see. Bots fill it; pretend all went well.
  if (input.website) return json(200, { activationUrl: '' });

  const first = String(input.firstName || '').trim().slice(0, 50);
  const last = String(input.lastName || '').trim().slice(0, 50);
  const email = String(input.email || '').trim().toLowerCase().slice(0, 254);
  if (!first || !last) return json(400, { error: 'invalid', message: 'Enter your first and last name.' });
  if (!EMAIL_RE.test(email)) return json(400, { error: 'invalid', message: 'Enter a valid email address.' });

  try {
    const token = await getToken(env);
    const api = caspio(env, token);

    const existing = (await api('find user', 'GET',
      `/integrations/rest/v4/directories/${env.dir}/users?Select=UserGUID,_status&Where=${encodeURIComponent(`${FIELDS.email}=${sqlStr(email)}`)}&Limit=1`,
    )).data?.[0];

    let guid;
    if (existing) {
      if (ACTIVE_STATES.has(existing._status)) return json(409, { error: 'email_taken' });
      guid = existing.UserGUID; // signed up before but never set a password
    } else {
      const created = await api('create user', 'POST',
        `/integrations/rest/v4/directories/${env.dir}/users?echo=true`,
        { [FIELDS.email]: email, [FIELDS.first]: first, [FIELDS.last]: last, ...TAGS });
      guid = created.data?.[0]?.UserGUID;
      if (!guid) throw new CaspioError('create user', 200, 'no UserGUID in response');
      await api('welcome row', 'POST', '/integrations/rest/v3/tables/member_info/records',
        { member_id: guid, feature: 'WELCOME_TOUR', text_box_1: 'pending' });
    }

    const activated = await api('activate', 'POST',
      `/integrations/rest/v4/directories/${env.dir}/users/${encodeURIComponent(guid)}/activate?sendEmail=false`);
    const activationUrl = activated.data?.activationUrl;
    if (!activationUrl) throw new CaspioError('activate', 200, 'no activationUrl in response');

    return json(200, { activationUrl });
  } catch (e) {
    // Never echo Caspio's response to the browser; it's in the function log.
    console.error('signup failed:', e.step || '', e.status || '', e.detail || e.message);
    return json(502, { error: 'failed' });
  }
};

async function getToken(env) {
  const r = await fetch(`${env.base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.id, client_secret: env.secret }),
  });
  if (!r.ok) throw new CaspioError('token', r.status, await r.text().catch(() => ''));
  const d = await r.json();
  if (!d.access_token) throw new CaspioError('token', r.status, 'no access_token');
  return d.access_token;
}

function caspio(env, token) {
  return async (step, method, path, body) => {
    const r = await fetch(`${env.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok) throw new CaspioError(step, r.status, text.slice(0, 500));
    try { return text ? JSON.parse(text) : {}; } catch { return {}; }
  };
}
