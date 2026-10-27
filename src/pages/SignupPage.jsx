// Public sign-up page at /signup: our header with the Caspio sign-up DataPage
// embedded beneath it, so a new member never lands on Caspio's hosted page.
// Caspio's skin can't be restyled from here; we only size and centre the embed.
//
// Two things live in Caspio, not in this file:
//   - the "statement" link inside the form (remove it in the DataPage designer;
//     the EULA/Privacy links on the consent checkbox already cover it)
//   - where the form goes after submit (set the DataPage's destination so a new
//     member ends up at the authenticated first-login page and the Welcome
//     modal fires)
import { useEffect, useRef, useState } from 'react';
import { CASPIO_LOGIN_URL, devBlockExternalLink } from '../lib/auth.js';
import './SignupPage.css';

const CONFIG = {
  // TODO: the sign-up DataPage's AppKey, i.e. the XXXXXXXX in
  // https://mybiohealth.caspio.app/dp/XXXXXXXX/emb (Caspio: DataPage > Deploy >
  // Embedded). Until it's set the page shows a placeholder instead of the form.
  DATAPAGE_KEY: '',
  CASPIO_HOST: 'https://mybiohealth.caspio.app',
};

export default function SignupPage() {
  const hostRef = useRef(null);
  const [status, setStatus] = useState(CONFIG.DATAPAGE_KEY ? 'loading' : 'unconfigured');

  useEffect(() => {
    document.title = 'Sign up — MyBioHealth';
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!CONFIG.DATAPAGE_KEY || !host) return;

    // Caspio's embed script document.write()s the form where the <script> tag
    // sits. A script added after page load can't do that, so while it runs,
    // route document.write into our container instead.
    const origWrite = document.write;
    document.write = (...html) => host.insertAdjacentHTML('beforeend', html.join(''));
    const restore = () => { document.write = origWrite; };

    const s = document.createElement('script');
    s.src = `${CONFIG.CASPIO_HOST}/dp/${CONFIG.DATAPAGE_KEY}/emb`;
    s.onload = () => { restore(); setStatus('ready'); };
    s.onerror = () => { restore(); setStatus('error'); };
    host.appendChild(s);

    return () => {
      restore();
      host.innerHTML = '';
    };
  }, []);

  return (
    <div className="signup-page">
      <nav className="signup-nav">
        <div className="signup-nav-inner">
          <a href="/" className="signup-logo">
            <span className="italic">My</span><span className="bold">BioHealth.ca</span>
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

        <div className="signup-card">
          {status === 'unconfigured' && (
            <p className="signup-msg">Sign-up form not configured yet (DataPage key missing).</p>
          )}
          {status === 'loading' && <p className="signup-msg">Loading the sign-up form…</p>}
          {status === 'error' && (
            <p className="signup-msg">The sign-up form didn't load. Please refresh, or try again later.</p>
          )}
          <div ref={hostRef} className="signup-embed" />
        </div>
      </main>
    </div>
  );
}
