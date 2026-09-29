import { useEffect } from 'react';
import { CASPIO_LOGIN_URL, CASPIO_SIGNUP_URL, devBlockExternalLink } from '../lib/auth.js';
import './LandingPage.css';

export default function LandingPage() {
  useEffect(() => {
    document.title = "MyBioHealth.ca";
  }, []);

  return (
    <div className="landing">
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <span className="italic">My</span><span className="bold">BioHealth.ca</span>
          </div>
        </div>
      </nav>

      <main className="hero-center">
        <a
          className="cta-login"
          href={CASPIO_LOGIN_URL}
          onClick={devBlockExternalLink(CASPIO_LOGIN_URL, 'member login')}
        >
          Member Login
        </a>
        <a
          className="cta-signup"
          href={CASPIO_SIGNUP_URL}
          onClick={devBlockExternalLink(CASPIO_SIGNUP_URL, 'sign up')}
        >
          Sign Up
        </a>
      </main>
    </div>
  );
}
