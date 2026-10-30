// Public sign-up page at /signup.
//
// Two versions while we move off Caspio's form:
//  - Our own form (CONFIG.OWN_FORM): membership type and expectations first (kept
//    in this browser and saved at first login), then name and email, posted to the API proxy's
//    /signup (lib/signup.js). The member is created and goes straight to
//    Caspio's set-password page, then signs in once: no activation email. No
//    password here (the Caspio API can't set one) and no EULA (it's the first
//    step of the Welcome popup).
//  - Until the proxy update is deployed: Caspio's Flex sign-up form in a
//    frame. Its skin can't be restyled from here, and it ends in an activation email.
// In dev, ?own_form previews our form whatever the flag says.
import { useEffect, useState } from 'react';
import { CASPIO_LOGIN_URL, CASPIO_SIGNUP_URL, devBlockExternalLink } from '../lib/auth.js';
import { EXPECTATION_SUGGESTIONS, MEMBERSHIP_TYPES, loadPreSignup, savePreSignup } from '../lib/onboarding.js';
import { SignupError, signUp } from '../lib/signup.js';
import './SignupPage.css';

const CONFIG = {
  // TODO: turn on once the proxy update with /signup is deployed and a test
  // sign-up has gone through.
  OWN_FORM: true,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const ownForm = CONFIG.OWN_FORM
    || (import.meta.env.DEV && new URLSearchParams(window.location.search).has('own_form'));

  const [introDone, setIntroDone] = useState(false);

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
        <p className="signup-sub">
          {ownForm
            ? (introDone ? 'Your name and email. Next you’ll choose a password, then sign in.' : 'A couple of quick questions first.')
            : 'Start with your name, email and a password. The rest comes after you sign in.'}
        </p>
        {ownForm ? (introDone ? <SignupForm /> : <IntroSteps onDone={() => setIntroDone(true)} />) : <CaspioFrame />}
      </main>
    </div>
  );
}

function IntroSteps({ onDone }) {
  const saved = loadPreSignup() || {};
  const [part, setPart] = useState(0);
  const [type, setType] = useState(saved.type || '');
  const [expectations, setExpectations] = useState(saved.expectations || '');
  const [giftCode, setGiftCode] = useState(saved.giftCode || '');
  const [sugOpen, setSugOpen] = useState(false);
  const [err, setErr] = useState('');

  function next() {
    if (part === 0) {
      if (!type) { setErr('Choose one.'); return; }
      setErr('');
      setPart(1);
      return;
    }
    if (type === 'gifted' && !giftCode.trim()) { setErr('Enter the gifter’s email or an invitation code.'); return; }
    savePreSignup({ type, expectations: expectations.trim(), giftCode: giftCode.trim() });
    onDone();
  }
  const opt = (key, label) => (
    <label key={key} className="signup-opt">
      <input type="radio" name="su-type" checked={type === key} onChange={() => { setType(key); setErr(''); }} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="signup-form">
      {part === 0 ? (
        <>
          <h2 className="signup-step-title">Membership type</h2>
          <fieldset className="signup-opts">
            <legend className="signup-hp">Membership type</legend>
            {MEMBERSHIP_TYPES.map(([k, l]) => opt(k, l))}
            <div className="signup-sep" role="separator" />
            {opt('gifted', 'I was gifted a Membership')}
          </fieldset>
        </>
      ) : (
        <>
          <h2 className="signup-step-title">What are your expectations of <em>My</em>BioHealth?</h2>
          <textarea className="signup-text" rows={3} maxLength={300} placeholder="Write in your own words" aria-label="Expectations of MyBioHealth"
            value={expectations} onChange={(e) => setExpectations(e.target.value)} />
          <button type="button" className="signup-linkbtn" aria-expanded={sugOpen} onClick={() => setSugOpen((o) => !o)}>Perhaps… {sugOpen ? '▴' : '▾'}</button>
          {sugOpen && (
            <ul className="signup-sugs">
              {EXPECTATION_SUGGESTIONS.map((t) => (
                <li key={t}><button type="button" className="signup-sug" onClick={() => { setExpectations(t); setSugOpen(false); }}>{t}</button></li>
              ))}
            </ul>
          )}
          {type === 'gifted' && (
            <input className="signup-input" type="text" maxLength={120} aria-label="Gifter email or invitation code" placeholder="Gifter's email or invitation code"
              value={giftCode} onChange={(e) => { setGiftCode(e.target.value); setErr(''); }} />
          )}
        </>
      )}
      {err && <p className="signup-err" role="alert">{err}</p>}
      <div className="signup-stepnav">
        {part > 0 ? <button type="button" className="signup-linkbtn" onClick={() => { setErr(''); setPart(0); }}>Back</button> : <span />}
        <button type="button" className="signup-submit" onClick={next}>Continue</button>
      </div>
    </div>
  );
}

function SignupForm() {
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', website: '' });
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
      const url = await signUp({
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim().toLowerCase(),
        website: f.website,
      });
      // Caspio's set-password page. Busy stays on until the browser leaves.
      window.location.assign(url);
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
      {/* Honeypot for bots: off-screen, skipped by keyboard and screen readers. */}
      <input className="signup-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={f.website} onChange={set('website')} />

      {formError && <p className="signup-err signup-form-err" role="alert">{formError}</p>}

      <button type="submit" className="signup-submit" disabled={busy}>
        {busy ? 'Creating your account…' : 'Continue'}
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
