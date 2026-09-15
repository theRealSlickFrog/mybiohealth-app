import { useEffect } from 'react';
import { CASPIO_LOGIN_URL, devBlockExternalLink } from '../lib/auth.js';
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
      </main>
    </div>
  );
}
