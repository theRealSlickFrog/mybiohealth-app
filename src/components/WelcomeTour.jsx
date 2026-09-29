// First-login welcome tour: a short run of screenshots of the main pages.
// Shown by AppShell to a signed-up member who hasn't seen it yet (see
// lib/welcomeTour.js); closing it by any route counts as seen.
//
// z-index 450 sits above the drawer (300/301) and WhyModal (400) but below
// IdleWarningModal (500), so an expiring session still shows over the tour.

import { useEffect, useRef, useState } from 'react';
import { BORDER, CARD, MBH_DROP_IMG, OFFWHITE, SLATE } from '../lib/constants.js';
import strategyImg from '../assets/tour/strategy.png';
import biosignalsImg from '../assets/tour/biosignals.png';
import glucoseImg from '../assets/tour/glucose.png';
import checkinImg from '../assets/tour/checkin.png';
import vaultImg from '../assets/tour/vault.png';

const STEPS = [
  { title: 'MyStrategy',        img: strategyImg,   caption: 'Your priorities, habits and progress, all in one place.' },
  { title: 'BioSignals',        img: biosignalsImg, caption: 'Your key markers over time, with related markers grouped together.' },
  { title: 'Glucose Summary',   img: glucoseImg,    caption: 'Your CGM cycle: time above range, daily pattern and overnight levels.' },
  { title: 'Priorities & MHx',  img: checkinImg,    caption: 'Check in each week and keep your strategy up to date.' },
  { title: 'MyVault',           img: vaultImg,      caption: 'Your documents and results, kept together securely.' },
];

export default function WelcomeTour({ onClose }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const { title, img, caption } = STEPS[step];
  const cardRef = useRef(null);

  // Fetch every screenshot up front so Next never waits on an image, and move
  // focus into the dialog.
  useEffect(() => {
    STEPS.forEach((s) => { new Image().src = s.img; });
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mbh-tour-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.6)', zIndex: 450,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* Focus lands on the card itself, not a button, so screen readers start
          at the dialog without a focus ring drawn on Next for mouse users. */}
      <div ref={cardRef} tabIndex={-1} style={{
        background: CARD, borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90dvh',
        overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', outline: 'none',
      }}>
        <div style={{ background: SLATE, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={MBH_DROP_IMG} alt="" style={{ width: 24, height: 24, display: 'block', objectFit: 'contain' }} />
          <div id="mbh-tour-title" style={{ color: 'white', fontSize: 13, fontWeight: 600, flex: 1 }}>
            Welcome to MyBioHealth
          </div>
          <button
            onClick={onClose}
            aria-label="Close tour"
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20,
              lineHeight: 1, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 }}>
            Here&rsquo;s a quick look at the main pages.
          </p>

          {/* Fixed 16:10 frame, so the card doesn't jump between screenshots. */}
          <div style={{
            aspectRatio: '16 / 10', background: OFFWHITE, border: `1px solid ${BORDER}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <img src={img} alt={`${title} page`} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
          </div>

          <div style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: SLATE }}>{title}</div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55, minHeight: '3.1em' }}>
            {caption}
          </p>

          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '14px 0 16px' }}>
            {STEPS.map((s, i) => (
              <span key={s.title} style={{
                width: i === step ? 18 : 6, height: 6, borderRadius: 3,
                background: i === step ? SLATE : BORDER, transition: 'width 0.2s',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} style={secondaryBtn}>Back</button>
            ) : (
              <button onClick={onClose} style={secondaryBtn}>Skip</button>
            )}
            <button
              onClick={() => (last ? onClose() : setStep(step + 1))}
              style={{
                flex: 1, background: SLATE, border: 'none', borderRadius: 999,
                padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'white',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {last ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const secondaryBtn = {
  background: 'none', border: `1px solid ${BORDER}`, borderRadius: 999,
  padding: '12px 20px', fontSize: 13.5, fontWeight: 600, color: SLATE,
  cursor: 'pointer', fontFamily: 'inherit',
};
