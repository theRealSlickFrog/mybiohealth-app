// First-login onboarding, inside the "Welcome to MyBioHealth" modal.
// Shown by AppShell to a signed-up member who hasn't finished it (see
// lib/welcomeTour.js); closing it by any route counts as done.
//
// Screens, wording, prices and look follow Ken's prototype ("MBH Onboarding
// Near Final"), minus what sign-up already covers: login and first/last name.
// The Member Agreement (EULA) comes first, before any personal details are
// asked, and only for a member who hasn't accepted it yet (members who signed
// up on the old Caspio form ticked it there). It can't be closed or skipped.
//
// Each step is saved to Caspio on Continue (lib/onboarding.js says where every
// answer lands) and loaded back on open, so a refresh resumes mid-flow.
// In dev, ?tour_preview opens it with no member: nothing is read or written.
//
// z-index 450 sits above the drawer (300/301) and WhyModal (400) but below
// IdleWarningModal (500), so an expiring session still shows over it.

import { useEffect, useRef, useState } from 'react';
import { STRIPE_CHECKOUT_URL } from '../lib/constants.js';
import {
  loadOnboarding, saveDoctorVisit, saveEulaAccepted, saveExpectations, saveGiftCode, saveGiftRecipient,
  saveGroupMembers, saveMemberDetails, saveMembershipType, saveStep,
} from '../lib/onboarding.js';
import { MAX_UPLOAD_BYTES, uploadDocument } from '../lib/vault.js';
import './WelcomeTour.css';

const CONFIG = {
  // Stripe hosted checkout per case (the prototype's CONFIG.payUrl).
  // TODO: group (member plus others: 1 x CA$500 + n x CA$400) and gift links —
  // not given yet. Until set, payment is off for those and the screen says so.
  PAY_URL: { member: STRIPE_CHECKOUT_URL, group: '', gift: '' },
  // TODO: booking link for the initial Orientation. "Book here" stays hidden until set.
  ORIENTATION_URL: '',
  // Calendly office hours, from the prototype.
  ZOOM_URL: 'https://calendly.com/ken-mybiohealth/mybiohealth-office-hours',
  MAX_OTHERS: 5,
  UPLOAD_ACCEPT: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  UPLOAD_DESCRIPTION: 'Labs (onboarding)',
};
// From the prototype: Member CA$500, each related person CA$400, then CA$125
// per person per quarter.
const PRICE = { member: 500, related: 400, quarterly: 125 };

const SUGGESTIONS = [
  'Understand which small changes will make an outsized difference to my health.',
  'Have a more informed conversation with my doctor.',
  'Know what deserves my attention, and what doesn’t.',
  'Get ahead of something I’ve been told to watch, such as cholesterol or A1C.',
  'Get ahead of what runs in my family.',
  'Something recent has my attention, such as a milestone birthday, a loss, or an illness.',
];
const MEMBERSHIP_TYPES = [
  ['one', 'One Membership'],
  ['one_plus', 'One + Memberships'],
  ['gift', 'Gift a Membership'],
];
const APPROACH = [['spoken', 'Already spoken with them'], ['contact', 'Please contact them'], ['advise', 'Not sure, suggest how']];
const COMMS = ['Email', 'Text', 'Both'];
const WHEN = [['week', 'This week', 7], ['two_weeks', 'Within two weeks', 14], ['month', 'Within a month', 30]];
const DOCTOR_DOCS = ['Lab requisition template', 'Physician explainer'];
// From the prototype: the plain-language summary of the agreement.
const TERMS = [
  ['Your health is yours.', 'We use your data to serve you. We will never sell information that identifies you to anyone, for any reason.'],
  ['We use anonymized data.', 'Once your personal identifiers are removed, we may use or share that data — including with researchers — to advance population health. Your name, contact details, and exact location are never part of that.'],
  ['We own the platform and co-authored content.', 'Notes, strategies, and consultation records created on MyBioHealth belong to MyBioHealth Inc. You have the right to view and print them while your account is active.'],
  ['Closing your account removes your access.', 'It does not immediately delete your data, which we retain for legitimate legal and business purposes.'],
  ['You are consenting to these terms.', 'Clicking ‘I Agree’ creates a binding agreement. The exact version of this agreement and the time of your acceptance are recorded.'],
];
const ACCEPT_TEXT = 'BY CLICKING “I AGREE” YOU CONFIRM THAT YOU HAVE READ AND UNDERSTOOD THIS AGREEMENT, THAT YOU ARE 18 YEARS OF AGE OR OLDER, AND THAT YOU CONSENT TO ITS TERMS INCLUDING THE USE OF YOUR ANONYMIZED DATA AS DESCRIBED IN SECTION 6.';
// Full agreement, served by this app (pages/LegalPage.jsx).
const EULA_URL = '/eula-v1';

function stepsFor(type, eulaAccepted) {
  return [
    ...(eulaAccepted ? [] : ['eula']), 'type', 'expectations', 'details', ...(type === 'gift' ? ['giftRecipient'] : []),
    'upload', 'doctor', type === 'gifted' ? 'claim' : 'pay', 'thanks',
  ];
}

const blankRow = () => ({ name: '', email: '', how: '' });
const emptyPerson = () => ({ first: '', last: '', email: '' });
const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim());
const mobileDigits = (v) => (v || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const fmtMobile = (v) => {
  const d = mobileDigits(v);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (v || '');
};
const money = (n) => n.toLocaleString('en-CA');
const byDateFor = (when) => {
  const days = WHEN.find((w) => w[0] === when)?.[2];
  return days ? new Date(Date.now() + days * 864e5) : null;
};

export default function WelcomeTour({ onClose, member }) {
  const preview = !member;
  const [loaded, setLoaded] = useState(preview);
  const [loadError, setLoadError] = useState(false);
  const [a, setA] = useState({
    email: preview ? 'preview@example.com' : '', type: '', group: [], giftRecipient: emptyPerson(),
    expectations: '', expectationsId: null, giftCode: '',
    mobile: '', comms: 'Both', dobText: '', doctorVisit: '', eulaAccepted: false,
  });
  const [step, setStep] = useState(preview ? 'eula' : 'type');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState([]); // { name, status: 'uploading'|'done'|'error', note? }
  const [sugOpen, setSugOpen] = useState(false);
  const [payOpened, setPayOpened] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const cardRef = useRef(null);

  const set = (patch) => { setA((prev) => ({ ...prev, ...patch })); setError(''); };
  const steps = stepsFor(a.type, a.eulaAccepted);
  const idx = Math.max(steps.indexOf(step), 0);

  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, []);

  // Load everything saved so far and resume at the saved step.
  useEffect(() => {
    if (preview || loaded) return;
    let live = true;
    loadOnboarding(member)
      .then((d) => {
        if (!live) return;
        const dob = d.dob && parseDob(d.dob);
        setA((prev) => ({
          ...prev,
          email: d.email, type: d.type || '',
          group: Array.isArray(d.group) ? d.group : [],
          giftRecipient: d.giftRecipient || prev.giftRecipient,
          expectations: d.expectations || '', expectationsId: d.expectationsId, giftCode: d.giftCode || '',
          mobile: fmtMobile(d.mobile), comms: d.comms || 'Both',
          dobText: dob ? fmtShort(dob.iso) : '', doctorVisit: d.doctorVisit || '',
          eulaAccepted: d.eulaAccepted,
        }));
        // Until the agreement is accepted, that's where it starts, whatever was saved.
        if (!d.eulaAccepted) setStep('eula');
        else if (d.step && stepsFor(d.type, true).includes(d.step)) setStep(d.step);
        setLoaded(true);
      })
      .catch((e) => { console.warn('Onboarding load failed:', e); if (live) setLoadError(true); });
    return () => { live = false; };
  }, [member, preview, loaded, loadError]);

  useEffect(() => { cardRef.current?.scrollTo?.({ top: 0 }); }, [step]);

  // Run `save` (if any), record `next` as the resume point, then show it.
  // Nothing advances until Caspio has the answer.
  async function advance(next, save) {
    setBusy(true); setError('');
    try {
      if (!preview) {
        if (save) await save();
        await saveStep(member, next);
      }
      setStep(next);
    } catch (e) {
      console.error('Onboarding save failed:', e);
      setError("Couldn't save that. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    const problem = validate(step, a, uploads);
    if (problem) { setError(problem); return; }
    advance(steps[idx + 1], () => saveCurrent(step, a, member, (id) => setA((p) => ({ ...p, expectationsId: id }))));
  }

  // I Agree. Once saved, the agreement drops out of the steps, so the next
  // screen is shown as the first one (no Back into the agreement).
  async function agree() {
    setBusy(true); setError('');
    try {
      if (!preview) {
        await saveEulaAccepted(member);
        await saveStep(member, 'type');
      }
      setA((p) => ({ ...p, eulaAccepted: true }));
      setStep('type');
    } catch (e) {
      console.error('Onboarding save failed:', e);
      setError("Couldn't save that. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  const goBack = () => { setError(''); setPayOpened(false); setCodeOpen(false); setHeld(false); setStep(steps[idx - 1]); };

  function chooseType(type) {
    set({ type, group: type === 'one_plus' && a.group.length === 0 ? [blankRow()] : a.group });
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      const ok = /\.(pdf|jpe?g|png)$/i.test(file.name);
      if (!ok || file.size > MAX_UPLOAD_BYTES) {
        setUploads((u) => [...u, { name: file.name, status: 'error', note: ok ? 'Too large (max 4.5 MB)' : 'PDF, JPG or PNG only' }]);
        continue;
      }
      setError('');
      setUploads((u) => [...u, { name: file.name, status: 'uploading' }]);
      const mark = (status) => setUploads((u) => u.map((x) => (x.name === file.name && x.status === 'uploading' ? { ...x, status } : x)));
      try {
        // user_document via the proxy's /upload (same path as MyVault).
        if (!preview) await uploadDocument({ file, category: '', description: CONFIG.UPLOAD_DESCRIPTION });
        mark('done');
      } catch (e) {
        console.error('Onboarding upload failed:', e);
        mark('error');
      }
    }
  }

  // Pay screen numbers: the member plus any others on a One + membership.
  const people = a.type === 'one_plus' ? 1 + a.group.length : 1;
  const payUrl = a.type === 'gift' ? CONFIG.PAY_URL.gift : people > 1 ? CONFIG.PAY_URL.group : CONFIG.PAY_URL.member;

  function openPayment() {
    if (!payUrl) return;
    window.open(payUrl, '_blank', 'noopener');
    setPayOpened(true);
  }

  // "Have an invitation?" — keep the code for MBH to check, then finish.
  function redeem(e) {
    e.preventDefault();
    if (!a.giftCode.trim()) { setError('Enter your code.'); return; }
    advance('thanks', () => saveGiftCode(member, a.giftCode.trim()));
  }

  const uploading = uploads.some((u) => u.status === 'uploading');

  let body;
  if (loadError) {
    body = (
      <>
        <p className="err">We couldn&rsquo;t load your details.</p>
        <div className="nav"><button className="btn" onClick={() => setLoadError(false)}>Try again</button></div>
      </>
    );
  } else if (!loaded) {
    body = <p className="quiet">Loading&hellip;</p>;
  } else {
    body = renderStep();
  }

  function renderStep() {
    switch (step) {
      case 'eula':
        return (
          <>
            <h2>Member Agreement (EULA)</h2>
            <ul className="terms">
              {TERMS.map(([lead, text]) => <li key={lead}><strong>{withMy(lead)}</strong> <span>{withMy(text)}</span></li>)}
            </ul>
            <p className="quiet"><a className="link accent" href={EULA_URL} target="_blank" rel="noopener noreferrer">Read the full agreement</a></p>
            <p className="legal">{ACCEPT_TEXT}</p>
          </>
        );

      case 'type':
        return (
          <>
            <h2>Membership type</h2>
            <fieldset className="q">
              <legend className="sr">Membership type</legend>
              {MEMBERSHIP_TYPES.map(([key, label]) => (
                <Opt key={key} name="mbh-type" checked={a.type === key} onChange={() => chooseType(key)}>{label}</Opt>
              ))}
              <div className="sep" role="separator" />
              <Opt name="mbh-type" checked={a.type === 'gifted'} onChange={() => chooseType('gifted')}>I was gifted a Membership</Opt>
            </fieldset>
            {a.type === 'one_plus' && (
              <div>
                {a.group.map((r, i) => (
                  <div key={i} className="rcp">
                    <input className="in" type="text" maxLength={30} autoComplete="off" placeholder="Name"
                      aria-label={`Name, person ${i + 1}`} value={r.name} onChange={(e) => updRow(i, 'name', e.target.value)} />
                    <input className="in" type="email" autoComplete="off" placeholder="Email"
                      aria-label={`Email, person ${i + 1}`} value={r.email} onChange={(e) => updRow(i, 'email', e.target.value)} />
                    <select className="in" aria-label={`How to approach person ${i + 1}`} value={r.how} onChange={(e) => updRow(i, 'how', e.target.value)}>
                      <option value="">How should they be approached?</option>
                      {APPROACH.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    {a.group.length > 1 && (
                      <button type="button" className="link" style={{ marginTop: 6 }}
                        onClick={() => set({ group: a.group.filter((_, j) => j !== i) })}>Remove</button>
                    )}
                  </div>
                ))}
                {a.group.length < CONFIG.MAX_OTHERS && (
                  <button type="button" className="pill add" onClick={() => set({ group: [...a.group, blankRow()] })}>+ Add another</button>
                )}
              </div>
            )}
          </>
        );

      case 'expectations':
        return (
          <>
            <h2>What are your expectations of <em className="my">My</em>BioHealth?</h2>
            <div className="fld">
              <label className="sr" htmlFor="mbh-expect">Expectations of MyBioHealth</label>
              <textarea id="mbh-expect" className="in box" rows={3} maxLength={300} placeholder="Write in your own words"
                value={a.expectations} onChange={(e) => set({ expectations: e.target.value })} />
              <div style={{ marginTop: 8 }}>
                <button type="button" className="link accent" aria-expanded={sugOpen} onClick={() => setSugOpen((o) => !o)}>
                  Perhaps&hellip; {sugOpen ? '▴' : '▾'}
                </button>
                {sugOpen && (
                  <ul className="sugglist">
                    {SUGGESTIONS.map((t) => (
                      <li key={t}><button type="button" className="sug" onClick={() => { set({ expectations: t }); setSugOpen(false); }}>{t}</button></li>
                    ))}
                  </ul>
                )}
              </div>
              {a.type === 'gifted' && (
                <input className="in" type="text" maxLength={120} style={{ marginTop: 8 }}
                  aria-label="Gifter email or invitation code" placeholder="Gifter's email or invitation code"
                  value={a.giftCode} onChange={(e) => set({ giftCode: e.target.value })} />
              )}
            </div>
          </>
        );

      case 'details': {
        const dob = parseDob(a.dobText);
        const showLong = dob && (dob.alt || a.dobText.trim() !== fmtShort(dob.iso));
        return (
          <>
            <h2>Details</h2>
            <div className="fld"><p className="loggedin" role="status">&#10003; {a.email}</p></div>
            <div className="fld">
              <label className="sr" htmlFor="mbh-mobile">Mobile</label>
              <input id="mbh-mobile" className="in" type="tel" autoComplete="tel" inputMode="tel" placeholder="Mobile"
                value={a.mobile} onChange={(e) => set({ mobile: e.target.value })}
                onBlur={() => set({ mobile: fmtMobile(a.mobile) })} />
            </div>
            <div className="fld comms" role="radiogroup" aria-labelledby="mbh-comms-l">
              <span id="mbh-comms-l" className="clabel">Comms</span>
              {COMMS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={a.comms === c} className="pill" onClick={() => set({ comms: c })}>{c}</button>
              ))}
            </div>
            <div className="fld">
              <label className="sr" htmlFor="mbh-dob">Date of birth</label>
              <input id="mbh-dob" className="in" type="text" autoComplete="bday" placeholder="Date of Birth"
                value={a.dobText} onChange={(e) => set({ dobText: e.target.value })}
                onBlur={() => { const d = parseDob(a.dobText); if (d && !d.alt) set({ dobText: fmtShort(d.iso) }); }} />
              {dob && (
                <p className="echo" aria-live="polite">
                  {showLong ? `${fmtLong(dob.iso)} · ` : ''}{ageOf(dob.iso)} years old
                  {dob.alt && (
                    <> <button type="button" className="link accent" onClick={() => set({ dobText: fmtShort(dob.alt) })}>
                      or {fmtLong(dob.alt).replace(/, \d{4}$/, '')}?
                    </button></>
                  )}
                </p>
              )}
            </div>
          </>
        );
      }

      case 'giftRecipient':
        return (
          <>
            <h2>Who is the gift for?</h2>
            <div className="row">
              <div className="fld"><input className="in" placeholder="First name" aria-label="First name" value={a.giftRecipient.first}
                onChange={(e) => set({ giftRecipient: { ...a.giftRecipient, first: e.target.value } })} /></div>
              <div className="fld"><input className="in" placeholder="Last name" aria-label="Last name" value={a.giftRecipient.last}
                onChange={(e) => set({ giftRecipient: { ...a.giftRecipient, last: e.target.value } })} /></div>
            </div>
            <div className="fld"><input className="in" type="email" placeholder="Email" aria-label="Email" value={a.giftRecipient.email}
              onChange={(e) => set({ giftRecipient: { ...a.giftRecipient, email: e.target.value } })} /></div>
          </>
        );

      case 'upload':
        return (
          <>
            <h2>Upload labs and medical reports.</h2>
            <p className="lead">From LifeLabs, Dynacare, Medcan, Cleveland Clinic, MyChart, etc.</p>
            <DropZone onFiles={uploadFiles} />
            {uploads.length > 0 && (
              <ul className="files" aria-live="polite">
                {uploads.map((u, i) => (
                  <li key={i} className="file">
                    <span className="name">{u.name}</span>
                    <span className={`state${u.status === 'error' ? ' bad' : ''}`}>
                      {u.status === 'uploading' ? 'Uploading…' : u.status === 'done' ? 'Uploaded' : (u.note || 'Failed')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="quiet">
              <button type="button" className="link" disabled={busy || uploading} onClick={() => advance(steps[idx + 1])}>
                I will return later to upload my labs
              </button>
            </p>
          </>
        );

      case 'doctor': {
        const by = byDateFor(a.doctorVisit);
        return (
          <>
            <h2>Take these to your doctor.</h2>
            <ul className="files">
              {DOCTOR_DOCS.map((d) => (
                <li key={d} className="file"><span className="name">{d}</span><span className="state">Docs will be emailed to you</span></li>
              ))}
            </ul>
            <fieldset className="q" style={{ marginTop: 32 }}>
              <legend>When will you see your doctor?</legend>
              {WHEN.map(([v, t]) => (
                <Opt key={v} name="mbh-when" checked={a.doctorVisit === v} onChange={() => set({ doctorVisit: v })}>{t}</Opt>
              ))}
              {by && <p className="echo" aria-live="polite">By {by.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}.</p>}
            </fieldset>
          </>
        );
      }

      case 'pay': {
        const due = PRICE.member + (people - 1) * PRICE.related;
        const others = people - 1;
        return (
          <>
            <h2>Complete membership.</h2>
            <p className="quiet" style={{ marginTop: 0 }}>
              {a.type === 'gift'
                ? 'Gift a Membership: pricing isn’t available online yet.'
                : people > 1
                  ? `You and ${others} ${others === 1 ? 'other' : 'others'}: CA$${money(due)} today, then CA$${money(PRICE.quarterly * people)} each quarter.`
                  : `Member: CA$${PRICE.member}, then CA$${PRICE.quarterly} each quarter.`}
            </p>
            {!payUrl && <p className="quiet">The payment link for this option isn&rsquo;t set up yet.</p>}
            {payOpened && (
              <p className="quiet">
                <button type="button" className="link accent" disabled={busy} onClick={() => advance('thanks')}>I have completed payment</button>
              </p>
            )}
          </>
        );
      }

      case 'claim':
        return (
          <>
            <h2>Gifted Membership.</h2>
            <p className="quiet" style={{ marginTop: 0 }}>
              {held
                ? 'The gift could not be matched yet. The request is held for review, and MBH will follow up by the preferred contact method.'
                : 'This Membership was gifted. The CGMs and DEXA are paid by the gifter. No payment is due.'}
            </p>
          </>
        );

      case 'thanks':
        return (
          <>
            <h2>Thank you.</h2>
            <p className="lead" style={{ marginTop: 0 }}>The first steps are:</p>
            <ol className="two">
              <li><i className="num" aria-hidden="true">1</i><span><b>Establish your baseline</b><small>Labs | CGM | DEXA</small><small>Visit your doctor</small></span></li>
              <li className="arrow" aria-hidden="true">&rarr;</li>
              <li><i className="num" aria-hidden="true">2</i><span><b>Create <em className="my">My</em>Strategy</b><small>3 Priorities | 3 MicroHabits</small><small>Check-in periodically</small></span></li>
            </ol>
            <p className="book">
              Book your initial Orientation. You will need your first CGM for the Orientation.
              {CONFIG.ORIENTATION_URL && <> <a className="link accent" href={CONFIG.ORIENTATION_URL} target="_blank" rel="noopener noreferrer">Book here</a></>}
            </p>
          </>
        );

      default:
        return null;
    }
  }

  function updRow(i, k, v) {
    set({ group: a.group.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  }

  // Bottom-right button for each screen.
  let primary = null;
  if (loaded && !loadError) {
    if (step === 'eula') primary = { label: busy ? 'Saving…' : 'I Agree', onClick: agree, disabled: busy };
    else if (step === 'pay') primary = { label: 'Continue to payment', onClick: openPayment, disabled: busy || !payUrl };
    else if (step === 'claim') {
      primary = held
        ? { label: 'Continue', onClick: () => advance('thanks'), disabled: busy }
        // There's no gift record to match against yet, so every claim is held for MBH to review.
        : { label: 'Claim Membership', onClick: () => setHeld(true), disabled: busy };
    } else if (step === 'thanks') primary = { label: 'Finish', onClick: onClose, disabled: false };
    else {
      primary = {
        label: busy ? 'Saving…' : step === 'doctor' ? 'I will do this' : 'Continue',
        onClick: goNext,
        disabled: busy || uploading,
      };
    }
  }
  const showBack = loaded && !loadError && idx > 0 && step !== 'thanks';

  return (
    <div className="mbh-onb" role="dialog" aria-modal="true" aria-labelledby="mbh-tour-title">
      {/* Focus lands on the card itself, not a button, so screen readers start
          at the dialog without a focus ring drawn on Continue for mouse users. */}
      <div className="card" ref={cardRef} tabIndex={-1}>
        <div className="top">
          <p className="brand" id="mbh-tour-title">Welcome to <em className="my">My</em>BioHealth</p>
          <a href={CONFIG.ZOOM_URL} target="_blank" rel="noopener noreferrer">Book a Zoom</a>
          {/* Closing counts as done, so it's not offered until the agreement is accepted. */}
          {step !== 'eula' && <button type="button" className="close" onClick={onClose} aria-label="Close">&times;</button>}
        </div>
        <div className="bar" aria-hidden="true"><i style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>

        {body}

        {error && <p className="err" role="alert">{error}</p>}

        {(primary || showBack) && (
          <div className="nav">
            {showBack ? <button type="button" className="link" onClick={goBack} disabled={busy}>Back</button> : <span />}
            {primary && <button type="button" className="btn" onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</button>}
          </div>
        )}

        {step === 'pay' && loaded && (
          <div className="quiet" style={{ marginTop: 40 }}>
            {!codeOpen ? (
              <button type="button" className="link" onClick={() => setCodeOpen(true)}>Have an invitation?</button>
            ) : (
              <form onSubmit={redeem}>
                <label className="sr" htmlFor="mbh-code">Invitation code</label>
                <input id="mbh-code" className="in" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  autoFocus placeholder="Invitation code" value={a.giftCode} onChange={(e) => set({ giftCode: e.target.value })} />
                <div className="nav">
                  <button type="button" className="link" onClick={() => { setCodeOpen(false); setError(''); }}>Cancel</button>
                  <button type="submit" className="btn" disabled={busy}>Continue</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// What each step needs before Continue. Returns the message to show, or ''.
function validate(step, a, uploads) {
  switch (step) {
    case 'type': {
      if (!a.type) return 'Choose one.';
      if (a.type !== 'one_plus') return '';
      const seen = new Set([(a.email || '').toLowerCase()]);
      for (let i = 0; i < a.group.length; i++) {
        const r = a.group[i];
        const who = a.group.length > 1 ? `Person ${i + 1}: ` : '';
        const em = r.email.trim().toLowerCase();
        if (!r.name.trim()) return `${who}Enter a name.`;
        if (!validEmail(em)) return `${who}Enter a valid email.`;
        if (seen.has(em)) return `${who}That email is already listed.`;
        seen.add(em);
        if (!r.how) return `${who}Choose how they should be approached.`;
      }
      return '';
    }
    case 'expectations':
      return a.type === 'gifted' && !a.giftCode.trim() ? 'Enter the gifter’s email or an invitation code.' : '';
    case 'details':
      if (!a.mobile.trim()) return 'Enter a mobile number.';
      if (mobileDigits(a.mobile).length !== 10) return 'Enter a 10-digit mobile number.';
      return parseDob(a.dobText) ? '' : dobMessage(a.dobText);
    case 'giftRecipient':
      return a.giftRecipient.first.trim() && a.giftRecipient.last.trim() && validEmail(a.giftRecipient.email)
        ? '' : 'Enter their first name, last name and a valid email.';
    case 'upload':
      return uploads.some((u) => u.status === 'done') ? '' : 'Add at least one lab report.';
    case 'doctor': return a.doctorVisit ? '' : 'Choose one.';
    default: return '';
  }
}

// Save the answer for one step. Upload saves as each file goes up, so it has
// nothing left to save here.
async function saveCurrent(step, a, member, onNoteId) {
  switch (step) {
    case 'type':
      await saveMembershipType(member, a.type);
      if (a.type === 'one_plus') {
        await saveGroupMembers(member, a.group.map((r) => ({ name: r.name.trim(), email: r.email.trim().toLowerCase(), how: r.how })));
      }
      break;
    case 'expectations':
      onNoteId(await saveExpectations(member, a.expectations.trim(), a.expectationsId));
      if (a.type === 'gifted') await saveGiftCode(member, a.giftCode.trim());
      break;
    case 'details':
      await saveMemberDetails(member, { mobile: `+1${mobileDigits(a.mobile)}`, comms: a.comms, dob: parseDob(a.dobText).iso });
      break;
    case 'giftRecipient': {
      const p = a.giftRecipient;
      await saveGiftRecipient(member, { first: p.first.trim(), last: p.last.trim(), email: p.email.trim() });
      break;
    }
    case 'doctor':
      await saveDoctorVisit(member, a.doctorVisit, byDateFor(a.doctorVisit).toISOString().slice(0, 10));
      break;
    default: break;
  }
}

// "MyBioHealth" with the My in italics, as everywhere else in the modal.
const withMy = (t) => String(t).split(/(My(?=[A-Z]))/).map((p, i) => (p === 'My' ? <em className="my" key={i}>My</em> : p));

function Opt({ name, checked, onChange, children }) {
  return (
    <label className="opt">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

function DropZone({ onFiles }) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`drop${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
    >
      <input type="file" multiple accept={CONFIG.UPLOAD_ACCEPT} onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <strong>Drop lab reports, or tap to choose</strong>
      <small>PDF, JPG or PNG</small>
    </label>
  );
}

// ── Date of birth, typed freely (from Ken's prototype) ────────────────────────
// Accepts "Sep 27 1970", "27 September 1970", "1970-09-27", "9/27/70" and so on.
// parseDob returns { iso, alt } or null; alt is set when day and month could be swapped.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtLong = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${cap(MONTHS[m - 1])} ${d}, ${y}`; };
const fmtShort = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${cap(MONTHS[m - 1].slice(0, 3))} ${d}, ${y}`; };
const pad2 = (n) => String(n).padStart(2, '0');
function ageOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date();
  let age = n.getFullYear() - y;
  if (n.getMonth() < m - 1 || (n.getMonth() === m - 1 && n.getDate() < d)) age--;
  return age;
}
function mkIso(y, m, d) {
  if (![y, m, d].every(Number.isInteger)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const now = new Date();
  if (dt > now || y < 1900 || now.getFullYear() - y > 120) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function yearOf(str) {
  if (str.length === 4) return Number(str);
  if (str.length === 2) { const n = Number(str); return n <= new Date().getFullYear() % 100 ? 2000 + n : 1900 + n; }
  return NaN;
}
const monthIdx = (w) => (w.length < 3 ? -1 : MONTHS.findIndex((m) => m.startsWith(w)));
function parseDob(input) {
  const s = (input || '').trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/\bof\b/g, ' ')
    .replace(/[,.]/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;
  let t, iso = null, alt = null;
  if ((t = s.match(/^(\d{4})[ \-/](\d{1,2})[ \-/](\d{1,2})$/))) iso = mkIso(+t[1], +t[2], +t[3]);
  else if ((t = s.match(/^(\d{4})(\d{2})(\d{2})$/))) iso = mkIso(+t[1], +t[2], +t[3]);
  else if ((t = s.match(/^([a-z]{3,9}) (\d{1,2}) (\d{2,4})$/)) && monthIdx(t[1]) >= 0) iso = mkIso(yearOf(t[3]), monthIdx(t[1]) + 1, +t[2]);
  else if ((t = s.match(/^(\d{1,2}) ([a-z]{3,9}) (\d{2,4})$/)) && monthIdx(t[2]) >= 0) iso = mkIso(yearOf(t[3]), monthIdx(t[2]) + 1, +t[1]);
  else if ((t = s.match(/^(\d{1,2})[ \-/](\d{1,2})[ \-/](\d{2,4})$/))) {
    const x = +t[1], y2 = +t[2], y = yearOf(t[3]);
    if (x > 12) iso = mkIso(y, y2, x);
    else if (y2 > 12) iso = mkIso(y, x, y2);
    else { iso = mkIso(y, x, y2); if (x !== y2) { const o = mkIso(y, y2, x); if (o && o !== iso) alt = o; } }
  }
  return iso ? { iso, alt } : null;
}
function dobMessage(text) {
  if (!String(text || '').trim()) return 'Enter your date of birth.';
  const off = (String(text).match(/\b\d{4}\b/g) || []).map(Number).some((n) => n < 1900 || n > new Date().getFullYear());
  return off ? 'Check the year.' : 'Try a format like Sep 27, 1970.';
}
