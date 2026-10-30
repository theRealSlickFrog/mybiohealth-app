// First-login onboarding, inside the "Welcome to MyBioHealth" modal.
// Shown by AppShell to a signed-up member who hasn't finished it (see
// lib/welcomeTour.js); closing it by any route counts as done.
//
// Screens, wording, prices and look follow Ken's prototype ("MBH Onboarding
// Near Final"), minus what /signup already covers: login, first/last name and,
// normally, membership type and expectations (asked here only if this browser
// doesn't have those answers). The Member Agreement (EULA) follows Details, only
// for a member who hasn't accepted it yet. It can't be closed or skipped.
// Finishing leaves the member on Up Next, behind the popup.
//
// Each step is saved to Caspio on Continue (lib/onboarding.js says where every
// answer lands) and loaded back on open, so a refresh resumes mid-flow.
// In dev, ?tour_preview opens it with no member: nothing is read or written.
//
// z-index 450 sits above the drawer (300/301) and WhyModal (400) but below
// IdleWarningModal (500), so an expiring session still shows over it.

import { useEffect, useRef, useState } from 'react';
import { STRIPE_CHECKOUT_URL, STRIPE_GIFTED_URL, STRIPE_OTHER_URL } from '../lib/constants.js';
import AgreementText from './AgreementText.jsx';
import { LINKS } from '../lib/upNext.js';
import {
  EXPECTATION_SUGGESTIONS as SUGGESTIONS, MEMBERSHIP_TYPES, clearPreSignup, loadOnboarding, loadPreSignup, saveEulaAccepted, saveExpectations, saveGiftCode, saveGiftRecipient,
  saveGroupMembers, saveMemberDetails, saveMembershipType, saveStep,
} from '../lib/onboarding.js';
import { MAX_UPLOAD_BYTES, uploadDocument } from '../lib/vault.js';
import './WelcomeTour.css';

const CONFIG = {
  // Stripe hosted checkout per case (the prototype's CONFIG.payUrl). A group uses
  // the member link; the quantity of others is set inside Stripe.
  PAY_URL: { member: STRIPE_CHECKOUT_URL, group: STRIPE_CHECKOUT_URL, gift: STRIPE_OTHER_URL },
  MAX_OTHERS: 5,
  UPLOAD_ACCEPT: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  UPLOAD_DESCRIPTION: 'Labs (onboarding)',
};
// From the prototype: Member CA$500, each related person CA$400, per year.
const PRICE = { member: 500, related: 400 };

const APPROACH = [['spoken', 'Already spoken with them'], ['contact', 'Please contact them'], ['advise', 'Not sure, suggest how'], ['wrap', 'Send me something I can wrap']];
const COMMS = ['Email', 'Text', 'Both'];
// From the prototype: the plain-language summary of the agreement.
const TERMS = [
  ['Your health. Your decisions.', 'MyBioHealth helps you understand your health information and prepare for more informed conversations with your physician. It is an educational platform, not a substitute for medical care.'],
  ['Your data. Protected and put to work.', 'Your health data remains yours. Our data repository is hosted in Canada. We never sell information that identifies you. We may use or share de-identified data for research and improving the platform. MyBioHealth owns its platform, methodologies, and content created through its services; you can access and download your own records and reports.'],
  ['Your agreement. Your choice.', 'Your membership is governed by the full Member Agreement, which includes our Privacy Policy. Your data may be retained after you close your account, as described there. Selecting “I Agree” confirms your acceptance, and we record the agreement version and timestamp.'],
];
const ACCEPT_TEXT = 'BY CLICKING “I AGREE” YOU CONFIRM THAT YOU HAVE READ AND UNDERSTOOD THIS AGREEMENT, THAT YOU ARE 18 YEARS OF AGE OR OLDER, AND THAT YOU CONSENT TO ITS TERMS INCLUDING THE USE OF YOUR DE-IDENTIFIED DATA AS DESCRIBED IN SECTION 10.';

function stepsFor(type, eulaAccepted, introDone) {
  return [
    ...(introDone ? [] : ['type', 'expectations']), 'details', ...(eulaAccepted ? [] : ['eula']),
    ...(type === 'gift' ? ['giftRecipient'] : []), 'upload', 'doctor', ...(type === 'one_plus' ? ['others'] : []),
    type === 'gifted' ? 'claim' : 'pay',
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

export default function WelcomeTour({ onClose, member }) {
  const preview = !member;
  const [loaded, setLoaded] = useState(preview);
  const [loadError, setLoadError] = useState(false);
  const [a, setA] = useState({
    email: preview ? 'preview@example.com' : '', type: '', group: [], giftRecipient: emptyPerson(),
    expectations: '', expectationsId: null, giftCode: '',
    firstName: preview ? 'Preview' : '', lastName: preview ? 'Member' : '',
    mobile: '', comms: 'Both', dobText: '', eulaAccepted: false,
  });
  const [introDone, setIntroDone] = useState(false);
  const [step, setStep] = useState('type');
  const [fullAgreement, setFullAgreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState([]); // { name, status: 'uploading'|'done'|'error', note? }
  const [sugOpen, setSugOpen] = useState(false);
  const [payOpened, setPayOpened] = useState(false);
  const cardRef = useRef(null);

  const set = (patch) => { setA((prev) => ({ ...prev, ...patch })); setError(''); };
  const steps = stepsFor(a.type, a.eulaAccepted, introDone);
  const idx = Math.max(steps.indexOf(step), 0);

  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, []);

  // Load everything saved so far and resume at the saved step.
  useEffect(() => {
    if (preview || loaded) return;
    let live = true;
    (async () => {
      const d = await loadOnboarding(member);
      // Answers given on /signup, before there was an account to save them to.
      const pre = loadPreSignup();
      if (pre?.type && !d.type) {
        await saveMembershipType(member, pre.type);
        d.expectationsId = await saveExpectations(member, pre.expectations || '', d.expectationsId);
        if (pre.giftCode) await saveGiftCode(member, pre.giftCode);
        Object.assign(d, { type: pre.type, expectations: pre.expectations || '', giftCode: pre.giftCode || '' });
      }
      clearPreSignup();
      return d;
    })()
      .then((d) => {
        if (!live) return;
        const dob = d.dob && parseDob(d.dob);
        setA((prev) => ({
          ...prev,
          email: d.email, firstName: d.firstName, lastName: d.lastName, type: d.type || '',
          group: Array.isArray(d.group) ? d.group : [],
          giftRecipient: d.giftRecipient || prev.giftRecipient,
          expectations: d.expectations || '', expectationsId: d.expectationsId, giftCode: d.giftCode || '',
          mobile: fmtMobile(d.mobile), comms: d.comms || 'Both',
          dobText: dob ? fmtShort(dob.iso) : '',
          eulaAccepted: d.eulaAccepted,
        }));
        // Type and expectations already answered: they drop out of the steps.
        const intro = !!d.type;
        const list = stepsFor(d.type, d.eulaAccepted, intro);
        setIntroDone(intro);
        setStep(d.step && list.includes(d.step) ? d.step : list[0]);
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

  useEffect(() => {
    if (step === 'others' && a.group.length === 0) setA((p) => ({ ...p, group: [blankRow()] }));
  }, [step, a.group.length]);

  function goNext() {
    const problem = validate(step, a, uploads);
    if (problem) { setError(problem); return; }
    advance(steps[idx + 1], () => saveCurrent(step, a, member, (id) => setA((p) => ({ ...p, expectationsId: id }))));
  }

  // I Agree. Once saved, the agreement drops out of the steps (no Back into it).
  async function agree() {
    setBusy(true); setError('');
    try {
      if (!preview) {
        await saveEulaAccepted(member);
        await saveStep(member, steps[idx + 1]);
      }
      setA((p) => ({ ...p, eulaAccepted: true }));
      setStep(steps[idx + 1]);
    } catch (e) {
      console.error('Onboarding save failed:', e);
      setError("Couldn't save that. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  const goBack = () => { setError(''); setPayOpened(false); setStep(steps[idx - 1]); };

  function chooseType(type) {
    set({ type });
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

  // The reference and email let a payment be matched back to this member.
  function openStripe(url) {
    const email = (a.email || '').trim().toLowerCase();
    const ref = a.type === 'gifted' ? a.giftCode.trim() : member;
    const params = new URLSearchParams();
    if (ref) params.set('client_reference_id', ref.replace(/[^\w-]/g, '_'));
    if (email) params.set('prefilled_email', email);
    window.open(`${url}?${params}`, '_blank', 'noopener');
    setPayOpened(true);
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
            <p className="quiet">
              <button type="button" className="link accent" aria-expanded={fullAgreement} onClick={() => setFullAgreement((o) => !o)}>
                {fullAgreement ? 'Hide the full agreement' : 'Read the full agreement'}
              </button>
            </p>
            {fullAgreement && <div className="full-agreement"><AgreementText showTitle={false} /></div>}
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
          </>
        );

      case 'others':
        return (
          <>
            <h2>Who else is joining?</h2>
            <p className="lead">Your own Membership is set. Add the people joining with you, up to {CONFIG.MAX_OTHERS}.</p>
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
            <div className="fld"><p className="loggedin" role="status">&#10003; {[a.firstName, a.lastName].filter(Boolean).join(' ')}{(a.firstName || a.lastName) ? ' · ' : ''}{a.email}</p></div>
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
            <p className="lead">From LifeLabs, Dynacare, Medcan, Cleveland Clinic, MyChart, etc. Also CGM data and DEXA reports.</p>
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

      case 'doctor':
        return (
          <>
            <h2>See your physician.</h2>
            <p className="lead">The explainer for your physician, with the lab requisition attached.</p>
            <p><a className="btn alt" href={LINKS.explainer} target="_blank" rel="noopener noreferrer">Download the explainer</a></p>
          </>
        );

      case 'pay': {
        const due = PRICE.member + (people - 1) * PRICE.related;
        const others = people - 1;
        return (
          <>
            <h2>Complete membership.</h2>
            <p className="quiet" style={{ marginTop: 0 }}>
              {a.type === 'gift'
                ? 'Gift a Membership: the amount is shown at checkout.'
                : people > 1
                  ? `You and ${others} ${others === 1 ? 'other' : 'others'}: CA$${money(due)} per year, renews annually.`
                  : `Member: CA$${PRICE.member} per year, renews annually.`}
            </p>
            <p className="quiet">Card details are entered on Stripe, never on this page.</p>
            {payOpened && (
              <p className="quiet">
                <button type="button" className="link accent" onClick={onClose}>I have completed payment</button>
              </p>
            )}
          </>
        );
      }

      case 'claim':
        return (
          <>
            <h2>Gifted Membership.</h2>
            <p className="quiet" style={{ marginTop: 0 }}>This Membership was gifted. The CGMs and DEXA are paid by the gifter. No payment is due.</p>
            {payOpened && (
              <p className="quiet">
                <button type="button" className="link accent" onClick={onClose}>I have claimed my Membership</button>
              </p>
            )}
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
    else if (step === 'pay') primary = { label: 'Continue to payment', onClick: () => openStripe(payUrl), disabled: busy };
    else if (step === 'claim') primary = { label: 'Claim Membership', onClick: () => openStripe(STRIPE_GIFTED_URL), disabled: busy };
    else {
      primary = {
        label: busy ? 'Saving…' : 'Continue',
        onClick: goNext,
        disabled: busy || uploading,
      };
    }
  }
  const showBack = loaded && !loadError && idx > 0;

  return (
    <div className="mbh-onb" role="dialog" aria-modal="true" aria-labelledby="mbh-tour-title">
      {/* Focus lands on the card itself, not a button, so screen readers start
          at the dialog without a focus ring drawn on Continue for mouse users. */}
      <div className="card" ref={cardRef} tabIndex={-1}>
        <div className="top">
          <p className="brand" id="mbh-tour-title">Welcome to <em className="my">My</em>BioHealth</p>
          {/* Closing counts as done, so it's not offered until the agreement is accepted. */}
          {a.eulaAccepted && <button type="button" className="close" onClick={onClose} aria-label="Close">&times;</button>}
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

      </div>
    </div>
  );
}

// What each step needs before Continue. Returns the message to show, or ''.
function validate(step, a, uploads) {
  switch (step) {
    case 'type': {
      return a.type ? '' : 'Choose one.';
    }
    case 'others': {
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
    default: return '';
  }
}

// Save the answer for one step. Upload saves as each file goes up, so it has
// nothing left to save here.
async function saveCurrent(step, a, member, onNoteId) {
  switch (step) {
    case 'type':
      await saveMembershipType(member, a.type);
      break;
    case 'others':
      await saveGroupMembers(member, a.group.map((r) => ({ name: r.name.trim(), email: r.email.trim().toLowerCase(), how: r.how })));
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
