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
  // Sign-up DataPage (Caspio: DataPage > Deploy > Embedded). DataPage embeds are
  // served from the account's legacy host; mybiohealth.caspio.app is the Flex
  // app and doesn't serve /dp/ scripts.
  DATAPAGE_KEY: 'a7ede0002b071fcc7d3a4ae3804a',
  CASPIO_HOST: 'https://d2hct674.caspio.com',
};

export default function SignupPage() {
  const hostRef = useRef(null);
  const [status, setStatus] = useState(CONFIG.DATAPAGE_KEY ? 'loading' : 'unconfigured');

  useEffect(() => {
    document.title = 'Sign up — MyBioHealth';
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    // Already loaded: StrictMode runs this effect twice in dev, and a second
    // script would embed a second copy of the form.
    if (!CONFIG.DATAPAGE_KEY || !host || host.querySelector('script')) return;

    // Caspio's async embed finds its own <script> tag, puts an anchor <div>
    // right after it, and renders the form into that.
    const s = document.createElement('script');
    s.src = `${CONFIG.CASPIO_HOST}/dp/${CONFIG.DATAPAGE_KEY}/emb`;
    s.onload = () => setStatus('ready');
    s.onerror = () => setStatus('error');
    host.appendChild(s);
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
        <p className="signup-sub">Start with your name and email. The rest comes after you sign in.</p>

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
