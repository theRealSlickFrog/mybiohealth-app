// Public landing at mybiohealth.netlify.app — the entry screen from Ken's
// onboarding prototype ("MBH Onboarding Near Final"): New Membership goes to our
// /signup page, Member Login to the Caspio login. Ken's site links here with
// ?start=new, which skips straight to /signup.
import { useEffect } from 'react';
import { CASPIO_LOGIN_URL, devBlockExternalLink } from '../lib/auth.js';
import './LandingPage.css';

const CONFIG = {
  // Calendly office hours, from the prototype.
  ZOOM_URL: 'https://calendly.com/ken-mybiohealth/mybiohealth-office-hours',
  // TODO: Book a Consult (paid) link — not given yet. The link stays hidden until set.
  CONSULT_URL: '',
};

export default function LandingPage() {
  const startNew = new URLSearchParams(window.location.search).get('start') === 'new';

  useEffect(() => {
    if (startNew) { window.location.replace('/signup'); return; }
    document.title = 'MyBioHealth.ca';
  }, [startNew]);

  if (startNew) return null;

  return (
    <div className="landing">
      <header className="landing-top">
        <p className="landing-brand"><em>My</em>BioHealth</p>
        <span className="landing-toplinks">
          {CONFIG.CONSULT_URL && <a href={CONFIG.CONSULT_URL} target="_blank" rel="noopener noreferrer">Book a Consult</a>}
          <a href={CONFIG.ZOOM_URL} target="_blank" rel="noopener noreferrer">Book a Zoom</a>
        </span>
      </header>

      <main className="landing-main">
        <p className="landing-eyebrow">Health literacy</p>
        <h1 className="landing-title">Measure what matters.<br />Have a plan.</h1>
        <p className="landing-sub">Clarity and confidence in a sea of health information, and misinformation.</p>
        <div className="landing-choices">
          <a className="landing-btn" href="/signup">New Membership</a>
          <a
            className="landing-btn alt"
            href={CASPIO_LOGIN_URL}
            onClick={devBlockExternalLink(CASPIO_LOGIN_URL, 'member login')}
          >
            Member Login
          </a>
        </div>
      </main>
    </div>
  );
}
