// Public sign-up page at /signup: our header with Caspio's Flex sign-up form
// framed beneath it, so a new member never leaves our page to sign up.
// Caspio's skin can't be restyled from here; we only size and centre the frame.
//
// The Flex form is the one that creates a login: name, email, password and the
// EULA/Privacy consent, then a verification email that activates the account.
// (The older Bridge DataPage, d2hct674 /dp/a7ede0002b071fcc7d3a4ae3804a, only
// inserts a member row with no password, so a member made there can't sign in.)
//
// Where the form goes after Sign up is set in Caspio, not here.
import { useEffect, useState } from 'react';
import { CASPIO_LOGIN_URL, CASPIO_SIGNUP_URL, devBlockExternalLink } from '../lib/auth.js';
import './SignupPage.css';

export default function SignupPage() {
  const [loaded, setLoaded] = useState(false);

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

        <div className="signup-frame-wrap">
          {!loaded && <p className="signup-msg">Loading the sign-up form…</p>}
          <iframe
            className="signup-frame"
            src={CASPIO_SIGNUP_URL}
            title="Create your MyBioHealth account"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </main>
    </div>
  );
}
