// Public sign-up page at /signup.
//
// Two versions while we move off Caspio's form:
//  - Our own form (CONFIG.OWN_FORM): name, email, password, posted to the proxy's
//    /signup (lib/signup.js). The member is created and signed in in one go and
//    lands in the app: no activation email, no second login. The EULA is no
//    longer asked here.
//  - Until the proxy endpoint exists: Caspio's Flex sign-up form in a frame.
//    Its skin can't be restyled from here, and it ends in an activation email.
// In dev, ?own_form previews our form whatever the flag says.
import { useEffect, useState } from 'react';
import { CASPIO_LOGIN_URL, CASPIO_SIGNUP_URL, devBlockExternalLink } from '../lib/auth.js';
import { MIN_PASSWORD, SignupError, signUp } from '../lib/signup.js';
import './SignupPage.css';

const CONFIG = {
  // TODO: turn on once the proxy's POST /signup is live.
  OWN_FORM: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const ownForm = CONFIG.OWN_FORM
    || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('own_form'));

  useEffect(() => {
    document.title = 'Sign up — MyBioHealth';
  }, []);

  return (
    <div className="signup-page">
      <nav className="signup-nav">
        <div className="signup-nav-inner">
          <a href="/" className="signup-logo">
            <em>My</em>BioHealth
          </a>
          <a
            className="signup-login-link"
            href={CASPIO_LOGIN_URL}
            onClick={devBlockExternalLink(CASPIO_LOGIN_URL, 'member login')}
          >
            Member Login
          </a>
        </div>
      </nav>

      <main className="signup-main">
        <h1 className="signup-title">Create your account</h1>
        <p className="signup-sub">Start with your name, email and a password. The rest comes after you sign in.</p>
        {ownForm ? <SignupForm /> : <CaspioFrame />}
      </main>
    </div>
  );
}

function SignupForm() {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: '' });
  };

  function validate() {
    const e = {};
    if (!f.firstName.trim()) e.firstName = 'Enter your first name.';
    if (!f.lastName.trim()) e.lastName = 'Enter your last name.';
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (f.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
    else if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    setFormError('');
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const t = await signUp({
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim().toLowerCase(),
        password: f.password,
      });
      window.location.assign(`/app?t=${encodeURIComponent(t)}`);
    } catch (err) {
      setBusy(false);
      const code = err instanceof SignupError ? err.code : 'failed';
      if (code === 'email_taken') {
        setErrors({ email: 'There is already an account with this email. Use Member Login instead.' });
      } else if (code === 'invalid') {
        setFormError(err.message);
      } else if (code === 'network') {
        setFormError("We couldn't reach the server. Check your connection and try again.");
      } else {
        setFormError('Something went wrong creating your account. Please try again.');
      }
    }
  }

  const field = (k, label, props = {}) => (
    <div className="signup-field">
      <label htmlFor={`su-${k}`}>{label}</label>
      <input
        id={`su-${k}`}
        value={f[k]}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `su-${k}-err` : undefined}
        {...props}
      />
      {errors[k] && <p id={`su-${k}-err`} className="signup-err">{errors[k]}</p>}
    </div>
  );

  return (
    <form className="signup-form" onSubmit={submit} noValidate>
      <div className="signup-row">
        {field('firstName', 'First name', { autoComplete: 'given-name' })}
        {field('lastName', 'Last name', { autoComplete: 'family-name' })}
      </div>
      {field('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
      <div className="signup-pw">
        {field('password', 'Password', { type: showPw ? 'text' : 'password', autoComplete: 'new-password' })}
        <button type="button" className="signup-show" onClick={() => setShowPw(!showPw)}>
          {showPw ? 'Hide' : 'Show'}
        </button>
      </div>
      {field('confirm', 'Confirm password', { type: showPw ? 'text' : 'password', autoComplete: 'new-password' })}

      {formError && <p className="signup-err signup-form-err" role="alert">{formError}</p>}

      <button type="submit" className="signup-submit" disabled={busy}>
        {busy ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}

// Caspio's Flex sign-up form in a frame (see the top of this file).
function CaspioFrame() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="signup-frame-wrap">
      {!loaded && <p className="signup-msg">Loading the sign-up form…</p>}
      <iframe
        className="signup-frame"
        src={CASPIO_SIGNUP_URL}
        title="Create your MyBioHealth account"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
