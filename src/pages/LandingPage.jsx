import { useState, useEffect } from 'react';
import { CASPIO_LOGIN_URL } from '../lib/auth.js';
import './LandingPage.css';

// Hosted on Cloudinary (same source the Caspio header uses via system_parm.header.logo_url).
const LOGO_URL = 'https://res.cloudinary.com/dai0low65/image/upload/v1763491944/logo_pp70kv.png';
const CALENDLY_URL = 'https://calendly.com/ken-mybiohealth/mybiohealth-office-hours';

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "MyBioHealth.ca — It's in you to know, live life";
  }, []);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pickAndScroll(id) {
    setMenuOpen(false);
    scrollTo(id);
  }

  return (
    <div className="landing">
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo" onClick={() => scrollTo('hero')}>
            <span className="italic">My</span><span className="bold">BioHealth.ca</span>
          </div>
          <div className="nav-links">
            <button onClick={() => scrollTo('what')}>What This Is</button>
            <button onClick={() => scrollTo('recognition')}>Recognition</button>
            <button onClick={() => scrollTo('participation')}>Participation</button>
            <button onClick={() => scrollTo('cost')}>Cost</button>
            <button onClick={() => scrollTo('fit')}>Who This Fits</button>
            <button onClick={() => scrollTo('myconsult')}>MyConsult</button>
            <a className="nav-login" href={CASPIO_LOGIN_URL}>Member Login</a>
            <a className="nav-cta" href={CALENDLY_URL} target="_blank" rel="noopener">Book a Call</a>
          </div>
          <button
            className={`hamburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
        <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          <button onClick={() => pickAndScroll('what')}>What This Is</button>
          <button onClick={() => pickAndScroll('recognition')}>Recognition</button>
          <button onClick={() => pickAndScroll('positioning')}>What It Is / Is Not</button>
          <button onClick={() => pickAndScroll('participation')}>Participation</button>
          <button onClick={() => pickAndScroll('cost')}>Cost</button>
          <button onClick={() => pickAndScroll('fit')}>Who This Fits</button>
          <button onClick={() => pickAndScroll('myconsult')}>MyConsult</button>
          <a className="nav-login" href={CASPIO_LOGIN_URL}>Member Login</a>
          <a className="nav-cta" href={CALENDLY_URL} target="_blank" rel="noopener">Book a Call</a>
        </div>
      </nav>

      <section id="hero" className="section-hero">
        <div className="section-inner">
          <div className="container-narrow center">
            <img className="hero-logo" src={LOGO_URL} alt="MyBioHealth.ca — It's in you to know, live life" />
            <div className="eyebrow">The Founding Cohort</div>
            <h1 className="hero">We're building a Founding Cohort of motivated members.</h1>
            <p className="subhead">Focused on prevention, emerging conditions, and your health's trajectory.</p>
            <p className="body" style={{ maxWidth: 580, margin: '0 auto 16px' }}>
              You're in your 30s to 60s, somewhere in middle-age and middle-health. The 'middle middle.'
            </p>
            <p className="body" style={{ maxWidth: 580, margin: '0 auto 36px' }}>
              You want to bend your health trajectory with small actions, and to be more literate, more proactive, with greater agency.
            </p>
            <p className="hero-fineprint">
              The cost is less than $2.40 a day — less than your double-double at Tim's. No sugar added.
            </p>
            <a className="cta-button" href={CALENDLY_URL} target="_blank" rel="noopener">
              Book an information call with the Founder →
            </a>
          </div>
        </div>
      </section>

      <section id="what">
        <div className="section-inner">
          <div className="two-col">
            <div>
              <div className="eyebrow">What This Is</div>
              <h2>A platform for Members and their Doctors.</h2>
            </div>
            <div>
              <p className="body">
                MyBioHealth provides plain-language literacy so you can confidently know which markers matter — six blood-based markers and six other markers like visceral fat, lean mass, blood pressure, and resting heart rate. Your Doctor sees and advises on the rest.
              </p>
              <p className="body">
                Our central value: <strong style={{ color: '#1a1612' }}>purposeful small actions that are traceable</strong> — actions tied to the signals that bend your health's trajectory.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="recognition" className="section-alt">
        <div className="section-inner">
          <div className="two-col">
            <div>
              <div className="eyebrow">Recognition</div>
              <h2>Most people receive blood results but don't know what matters.</h2>
            </div>
            <div>
              <p className="body">
                You may have seen results flagged as high/low or normal/abnormal — without a clear sense of what they mean or which markers matter most.
              </p>
              <p className="body">
                Signals like insulin sensitivity, cardiovascular risk, liver health, and visceral fat are often present, but rarely ranked or acted on — long before they become a diagnosis or an event.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="positioning">
        <div className="section-inner">
          <div className="pos-grid">
            <div>
              <div className="eyebrow">What This Is Not</div>
              <h2 className="medium">Not a treatment program. Not a diagnostic service. We don't replace your physician.</h2>
            </div>
            <div>
              <div className="eyebrow">What It Is</div>
              <h2 className="medium">A structured, complementary layer that maximizes the Doctor / Patient relationship.</h2>
              <p className="body">
                MyBioHealth organizes your signals, tracks your trajectory, and prepares you — and your doctor — for a better conversation with clear prioritization.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="participation" className="section-alt">
        <div className="section-inner">
          <div className="two-col">
            <div>
              <div className="eyebrow">Participation</div>
              <h2>What participation in the Founding Cohort involves.</h2>
            </div>
            <div>
              <p className="body" style={{ marginBottom: 16 }}>Participants agree to:</p>
              <ul className="dash-list">
                <li>Quarterly blood work; yes, till the Primary six and the six structural and contextual (i.e. Blood Pressure, resting heart rate, lean mass) signals are understood and trending well.</li>
                <li>Two CGM cycles (14 days each)</li>
                <li>One DEXA scan</li>
                <li>Micro-Habits — small, specific actions linked to your signals that merit your focus.</li>
                <li>MyConsult — a structured summary prepared for your physician</li>
              </ul>
              <p className="body">Additional inputs: ~2 years of prior blood results, if available.</p>
              <p className="body">
                <strong style={{ color: '#1a1612' }}>Structure:</strong> 20-minute orientation + onboarding. Initial structured phase (~90 days). Details discussed during the orientation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="cost">
        <div className="section-inner">
          <div className="container-narrow center">
            <div className="eyebrow">Cost</div>
            <h2>Less than $2.40 a day. No sugar added.</h2>
            <div className="price-display">
              <div className="price-big">~$875</div>
              <div className="price-label">year one</div>
              <div className="price-tagline">Less than your double-double at Tim's.</div>
            </div>
            <div className="cost-table">
              <div className="cost-row">
                <div className="label">Membership</div>
                <div className="price">$500/yr</div>
                <div className="note">50% upfront, quarterly after</div>
              </div>
              <div className="cost-row">
                <div className="label">CGM × 2</div>
                <div className="price">$250</div>
                <div className="note">Two 14-day cycles</div>
              </div>
              <div className="cost-row">
                <div className="label">DEXA scan</div>
                <div className="price">$125</div>
                <div className="note"></div>
              </div>
              <div className="cost-total">
                <div className="label">Year one, all in</div>
                <div className="price">$875</div>
                <div></div>
              </div>
            </div>
            <p className="cost-fine">
              Included: One CGM debrief. Three additional sessions ($75/session waived). And one jointly prepared <strong style={{ color: '#1a1612' }}>MyConsult</strong> — a doctor-facing, actionable summary for your next appointment.
            </p>
            <p className="cost-fine">Additional family members $350/year for the Membership.</p>
          </div>
        </div>
      </section>

      <section id="fit" className="section-alt">
        <div className="section-inner">
          <div className="two-col">
            <div>
              <div className="eyebrow">Who This Fits</div>
              <h2>You believe in prevention over treatment.</h2>
            </div>
            <div>
              <p className="body">You want a compounding health plan, like a compounding retirement plan.</p>
              <p className="body">
                You've been told to keep an eye on something — inflammation, A1c, lipids, liver, muscle — and you want a way to actually do it.
              </p>
              <p className="body">
                Best suited for those willing to engage with their data, make small consistent changes, and focus on their long-term health trajectory — informed by what matters and in consultation with their Doctor.
              </p>
              <p className="body">
                MyBioHealth is not a biohacking or diet platform — in fact, rather the opposite philosophy. Our intent is to provide peace of mind, knowing that what matters most is understood.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="myconsult">
        <div className="section-inner">
          <div className="container-medium">
            <div className="center" style={{ marginBottom: 56 }}>
              <div className="eyebrow">MyConsult</div>
              <h2>MyConsult — a prepared, concise summary for you and your Doctor.</h2>
            </div>
            <p className="body center" style={{ maxWidth: 720, margin: '0 auto 16px' }}>
              The MyConsult document is perhaps the most valuable tool for Members. A prepared brief for any visit — routine or urgent. If a signal like ApoB is on fire but not yet clinical, you'll know, and you'll have what you need to act.
            </p>
            <p className="body center" style={{ maxWidth: 720, margin: '0 auto 48px' }}>
              Your signals are graphed over time, so trends are visible at a glance — for you and your Doctor.
            </p>
            <div className="feature-grid">
              <div className="feature">
                <div className="feature-title">Head-to-toe symptom questionnaire</div>
                <div className="feature-text">The things that get forgotten in a 15-minute visit.</div>
              </div>
              <div className="feature">
                <div className="feature-title">Your topics</div>
                <div className="feature-text">Specific questions, carried forward, signal-informed.</div>
              </div>
              <div className="feature">
                <div className="feature-title">Your MBH data, curated for a clinical reader</div>
                <div className="feature-text">Sleep, RHR, active MicroHabits, and a graphical presentation of your signals over time — your trajectory.</div>
              </div>
              <div className="feature">
                <div className="feature-title">Your supplement & Rx stack</div>
                <div className="feature-text">Doctor-endorsed, member-elected.</div>
              </div>
            </div>
            <div className="center" style={{ marginTop: 48 }}>
              <p className="myconsult-quote">The Member arrives prepared. The Doctor arrives informed.</p>
              <p className="myconsult-tagline">MyConsult. Because 15 minutes with the right preparation is worth 45.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="apply" className="section-cta">
        <div className="section-inner">
          <div className="container-narrow center">
            <div className="eyebrow">Apply</div>
            <h1 className="hero">Apply to participate.</h1>
            <p className="body" style={{ maxWidth: 560, margin: '0 auto 16px' }}>
              A 2–3 minute intake. We review every application and reach out to selected participants.
            </p>
            <p className="body" style={{ maxWidth: 560, margin: '0 auto 16px' }}>
              As a Founding Member, you'll be invited to live Q&amp;A sessions, and you can suggest, vote, and offer criticism on what MyBioHealth builds next.
            </p>
            <p className="body" style={{ maxWidth: 560, margin: '0 auto 48px' }}>
              No spam. No endless promotion. MyBioHealth is a serious service.
            </p>
            <a className="cta-button large" href={CALENDLY_URL} target="_blank" rel="noopener">
              Book an information call with the Founder →
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-mark">
          <span style={{ fontStyle: 'italic', fontWeight: 400 }}>My</span>
          <span style={{ fontWeight: 700 }}>BioHealth.ca</span>
        </div>
        <div className="footer-tag">It's in you to know, live life</div>
      </footer>
    </div>
  );
}
