// First-login onboarding, inside the "Welcome to MyBioHealth" modal.
// Shown by AppShell to a signed-up member who hasn't finished it (see
// lib/welcomeTour.js); closing it by any route counts as done.
//
// Each step is saved to Caspio on Continue (lib/onboarding.js says where every
// answer lands) and loaded back on open, so a refresh resumes mid-flow.
// In dev, ?tour_preview opens it with no member: nothing is read or written.
//
// z-index 450 sits above the drawer (300/301) and WhyModal (400) but below
// IdleWarningModal (500), so an expiring session still shows over it.

import { useEffect, useRef, useState } from 'react';
import { BORDER, CARD, MBH_DROP_IMG, MBH_SAGE, OFFWHITE, SAGE_BG, SAGE_TEXT, SLATE, SOFT_RED, STRIPE_CHECKOUT_URL } from '../lib/constants.js';
import {
  loadOnboarding, saveDoctorVisit, saveExpectations, saveGiftCode, saveGiftRecipient,
  saveGroupMembers, saveMemberDetails, saveMembershipType, saveStep,
} from '../lib/onboarding.js';
import { MAX_UPLOAD_BYTES, uploadDocument } from '../lib/vault.js';

const CONFIG = {
  // Price line and Stripe link per membership type. Only the single membership
  // is confirmed. TODO: One + and Gift prices and their checkout links — until
  // they're set, the summary says pricing isn't available online and payment is off.
  PRICES: {
    one:      { summary: 'Member: CA$500, then CA$125 each quarter.', checkoutUrl: STRIPE_CHECKOUT_URL },
    one_plus: null,
    gift:     null,
  },
  EXPECTATION_SUGGESTIONS: [
    'Something recent has my attention, such as a milestone birthday, a loss, or an illness.',
    'Understand which small changes will make an outsized difference to my health.',
  ],
  UPLOAD_ACCEPT: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
  UPLOAD_DESCRIPTION: 'Labs (onboarding)',
};

const MEMBERSHIP_TYPES = [
  { key: 'one',      label: 'One Membership' },
  { key: 'one_plus', label: 'One + Memberships' },
  { key: 'gift',     label: 'Gift a Membership' },
  { key: 'gifted',   label: 'I was gifted a Membership' },
];
const COMMS = ['Email', 'Text', 'Both'];
const DOCTOR_VISIT = [
  { key: 'week',      label: 'This week' },
  { key: 'two_weeks', label: 'Within two weeks' },
  { key: 'month',     label: 'Within a month' },
];
const DOCTOR_DOCS = ['Lab requisition template', 'Physician explainer'];

// "One Membership" goes straight from details to upload; the other three get a
// step of their own in between.
const BRANCH_STEP = { one_plus: 'group', gift: 'giftRecipient', gifted: 'giftCode' };
function stepsFor(type) {
  return ['expectations', 'type', 'details', ...(BRANCH_STEP[type] ? [BRANCH_STEP[type]] : []), 'upload', 'doctor', 'summary'];
}

const emptyPerson = () => ({ first: '', last: '', email: '' });
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

export default function WelcomeTour({ onClose, member }) {
  const preview = !member;
  const [loaded, setLoaded] = useState(preview);
  const [loadError, setLoadError] = useState(false);
  const [a, setA] = useState({
    email: preview ? 'preview@example.com' : '', mobile: '', expectations: '', expectationsId: null,
    type: '', comms: 'Both', dob: '', group: [emptyPerson()], giftRecipient: emptyPerson(),
    giftCode: '', doctorVisit: '',
  });
  const [step, setStep] = useState('expectations');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState([]); // { name, status: 'uploading'|'done'|'error', note? }
  const cardRef = useRef(null);

  const set = (patch) => { setA((prev) => ({ ...prev, ...patch })); setError(''); };
  const steps = stepsFor(a.type);
  const idx = Math.max(steps.indexOf(step), 0);

  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, []);

  // Load everything saved so far and resume at the saved step.
  useEffect(() => {
    if (preview || loaded) return;
    let live = true;
    loadOnboarding(member)
      .then((d) => {
        if (!live) return;
        setA((prev) => ({
          ...prev,
          email: d.email, mobile: d.mobile, expectations: d.expectations || '', expectationsId: d.expectationsId,
          type: d.type || '', comms: d.comms || 'Both', dob: d.dob || '',
          group: d.group?.length ? d.group : prev.group,
          giftRecipient: d.giftRecipient || prev.giftRecipient,
          giftCode: d.giftCode || '', doctorVisit: d.doctorVisit || '',
        }));
        if (d.step && stepsFor(d.type).includes(d.step)) setStep(d.step);
        setLoaded(true);
      })
      .catch((e) => { console.warn('Onboarding load failed:', e); if (live) setLoadError(true); });
    return () => { live = false; };
  }, [member, preview, loaded, loadError]);

  useEffect(() => { cardRef.current?.scrollTo?.({ top: 0 }); }, [step]);

  // Check the current step, save it, then move to `next` and record that as the
  // resume point. Nothing advances until Caspio has the answer.
  async function saveAndGo(next) {
    const problem = validate(step, a);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      if (!preview) {
        await saveCurrent(step, a, member, (id) => setA((prev) => ({ ...prev, expectationsId: id })));
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

  const goNext = () => saveAndGo(steps[idx + 1]);
  const goBack = () => { setError(''); setStep(steps[idx - 1]); };

  // "Have an invitation?" — switch to the gifted path and ask for the code.
  async function useInvitation() {
    setBusy(true); setError('');
    try {
      if (!preview) { await saveMembershipType(member, 'gifted'); await saveStep(member, 'giftCode'); }
      setA((prev) => ({ ...prev, type: 'gifted' }));
      setStep('giftCode');
    } catch (e) {
      console.error('Onboarding save failed:', e);
      setError("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      const ok = /\.(pdf|jpe?g|png)$/i.test(file.name);
      if (!ok || file.size > MAX_UPLOAD_BYTES) {
        setUploads((u) => [...u, { name: file.name, status: 'error', note: ok ? 'Too large (max 4.5 MB)' : 'PDF, JPG or PNG only' }]);
        continue;
      }
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

  function pay() {
    const price = CONFIG.PRICES[a.type];
    if (!price?.checkoutUrl) return;
    window.open(price.checkoutUrl, '_blank', 'noopener');
    onClose();
  }

  const uploading = uploads.some((u) => u.status === 'uploading');

  let body;
  if (loadError) {
    body = (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ ...lead, color: SOFT_RED }}>We couldn&rsquo;t load your details.</p>
        <button onClick={() => setLoadError(false)} style={secondaryBtn}>Try again</button>
      </div>
    );
  } else if (!loaded) {
    body = <p style={{ ...lead, textAlign: 'center', padding: '24px 0' }}>Loading&hellip;</p>;
  } else {
    body = renderStep();
  }

  function renderStep() {
    switch (step) {
      case 'expectations':
        return (
          <>
            <Heading>What are your expectations of MyBioHealth?</Heading>
            <select
              value=""
              onChange={(e) => e.target.value && set({ expectations: e.target.value })}
              style={{ ...input, marginBottom: 10 }}
              aria-label="Suggestions"
            >
              <option value="">Perhaps&hellip;</option>
              {CONFIG.EXPECTATION_SUGGESTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea
              value={a.expectations}
              onChange={(e) => set({ expectations: e.target.value })}
              rows={5}
              placeholder="In your own words"
              style={{ ...input, resize: 'vertical', lineHeight: 1.5 }}
            />
          </>
        );

      case 'type':
        return (
          <>
            <Heading>Which membership is this?</Heading>
            <RadioGroup name="mbh-type" options={MEMBERSHIP_TYPES} value={a.type} onChange={(type) => set({ type })} />
          </>
        );

      case 'details':
        return (
          <>
            <Heading>Your details</Heading>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: SAGE_BG, color: SAGE_TEXT,
              borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13.5, minWidth: 0,
            }}>
              <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
              <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{a.email || 'Your email'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>Confirmed</span>
            </div>
            <Field label="Mobile number">
              <input type="tel" autoComplete="tel" value={a.mobile} onChange={(e) => set({ mobile: e.target.value })} style={input} />
            </Field>
            <Field label="Comms preference">
              <RadioGroup name="mbh-comms" inline options={COMMS.map((c) => ({ key: c, label: c }))} value={a.comms} onChange={(comms) => set({ comms })} />
            </Field>
            <Field label="Date of birth">
              <input type="date" autoComplete="bday" value={a.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ dob: e.target.value })} style={input} />
            </Field>
          </>
        );

      case 'group':
        return (
          <>
            <Heading>Who else is joining?</Heading>
            <p style={lead}>Add each person who&rsquo;ll share your membership.</p>
            {a.group.map((p, i) => (
              <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>Member {i + 2}</span>
                  {a.group.length > 1 && (
                    <button
                      onClick={() => set({ group: a.group.filter((_, j) => j !== i) })}
                      style={{ ...linkBtn, marginLeft: 'auto' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <PersonFields value={p} onChange={(v) => set({ group: a.group.map((x, j) => (j === i ? v : x)) })} />
              </div>
            ))}
            <button onClick={() => set({ group: [...a.group, emptyPerson()] })} style={linkBtn}>+ Add another member</button>
          </>
        );

      case 'giftRecipient':
        return (
          <>
            <Heading>Who is the gift for?</Heading>
            <PersonFields value={a.giftRecipient} onChange={(v) => set({ giftRecipient: v })} />
          </>
        );

      case 'giftCode':
        return (
          <>
            <Heading>Your invitation or gift code</Heading>
            <Field label="Code">
              <input value={a.giftCode} onChange={(e) => set({ giftCode: e.target.value })} autoComplete="off" style={input} />
            </Field>
          </>
        );

      case 'upload':
        return (
          <>
            <Heading>Upload labs and medical reports</Heading>
            <p style={lead}>From LifeLabs, Dynacare, Medcan, Cleveland Clinic, MyChart, etc.</p>
            <DropZone onFiles={uploadFiles} />
            {uploads.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {uploads.map((u, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${BORDER}`, minWidth: 0 }}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', color: SLATE }}>{u.name}</span>
                    <span style={{ whiteSpace: 'nowrap', color: u.status === 'error' ? SOFT_RED : u.status === 'done' ? MBH_SAGE : '#6b7280' }}>
                      {u.status === 'uploading' ? 'Uploading…' : u.status === 'done' ? 'Uploaded' : (u.note || 'Failed')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => saveAndGo(steps[idx + 1])} disabled={busy || uploading} style={{ ...linkBtn, marginTop: 14 }}>
              I will return later to upload my labs
            </button>
          </>
        );

      case 'doctor':
        return (
          <>
            <Heading>Take these to your doctor</Heading>
            {DOCTOR_DOCS.map((d) => (
              <div key={d} style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', padding: '12px 14px',
                background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 8,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: SLATE, flex: 1, minWidth: 160 }}>{d}</span>
                <span style={{ fontSize: 12.5, color: '#6b7280' }}>Docs will be emailed to you</span>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <Field label="When will you see your doctor?">
                <RadioGroup name="mbh-doctor" options={DOCTOR_VISIT} value={a.doctorVisit} onChange={(doctorVisit) => set({ doctorVisit })} />
              </Field>
            </div>
          </>
        );

      case 'summary':
        return renderSummary();

      default:
        return null;
    }
  }

  function renderSummary() {
    const typeLabel = MEMBERSHIP_TYPES.find((t) => t.key === a.type)?.label || '';
    const price = CONFIG.PRICES[a.type];
    return (
      <>
        <Heading>Complete membership</Heading>
        <div style={{ background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: SLATE }}>{typeLabel}</div>
          {a.type === 'one_plus' && (
            <div style={summaryLine}>You plus {a.group.length} other member{a.group.length === 1 ? '' : 's'}</div>
          )}
          {a.type === 'gift' && (
            <div style={summaryLine}>For {`${a.giftRecipient.first} ${a.giftRecipient.last}`.trim()}</div>
          )}
          {a.type === 'gifted' ? (
            <div style={summaryLine}>Code {a.giftCode}. No payment needed.</div>
          ) : price ? (
            <div style={summaryLine}>{price.summary}</div>
          ) : (
            <div style={summaryLine}>Pricing for this option isn&rsquo;t available online yet.</div>
          )}
        </div>
        {a.type !== 'gifted' && (
          <button onClick={useInvitation} disabled={busy} style={linkBtn}>Have an invitation?</button>
        )}
      </>
    );
  }

  // Bottom-right button: Continue, then the summary's own action.
  let primary;
  if (!loaded || loadError) primary = null;
  else if (step !== 'summary') primary = { label: busy ? 'Saving…' : 'Continue', onClick: goNext, disabled: busy || uploading };
  else if (a.type === 'gifted') primary = { label: 'Finish', onClick: onClose, disabled: busy };
  else primary = { label: 'Continue to payment', onClick: pay, disabled: busy || !CONFIG.PRICES[a.type]?.checkoutUrl };

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
          at the dialog without a focus ring drawn on Continue for mouse users. */}
      <div ref={cardRef} tabIndex={-1} style={{
        background: CARD, borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90dvh',
        overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', outline: 'none',
      }}>
        <div style={{ background: SLATE, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={MBH_DROP_IMG} alt="" style={{ width: 24, height: 24, display: 'block', objectFit: 'contain' }} />
          <div id="mbh-tour-title" style={{ color: 'white', fontSize: 13, fontWeight: 600, flex: 1 }}>
            Welcome to MyBioHealth
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 20,
              lineHeight: 1, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px 20px' }}>
          {loaded && !loadError && (
            <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '0 0 16px' }}>
              {steps.map((s, i) => (
                <span key={s} style={{
                  width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
                  background: i <= idx ? SLATE : BORDER, transition: 'width 0.2s',
                }} />
              ))}
            </div>
          )}

          {body}

          {error && <div role="alert" style={{ marginTop: 12, fontSize: 13, color: SOFT_RED }}>{error}</div>}

          {primary && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 18 }}>
              {idx > 0 && <button onClick={goBack} disabled={busy} style={secondaryBtn}>Back</button>}
              <button
                onClick={primary.onClick}
                disabled={primary.disabled}
                style={{
                  flex: '1 1 160px', background: SLATE, border: 'none', borderRadius: 999,
                  padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'white',
                  cursor: primary.disabled ? 'default' : 'pointer', opacity: primary.disabled ? 0.55 : 1, fontFamily: 'inherit',
                }}
              >
                {primary.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// What each step needs before Continue. Returns the message to show, or ''.
function validate(step, a) {
  switch (step) {
    case 'type': return a.type ? '' : 'Please choose a membership.';
    case 'details':
      if (!a.mobile.trim()) return 'Please add your mobile number.';
      if (!a.dob) return 'Please add your date of birth.';
      return '';
    case 'group':
      return a.group.every((p) => p.first.trim() && p.last.trim() && looksLikeEmail(p.email))
        ? '' : 'Please add a first name, last name and valid email for each member.';
    case 'giftRecipient':
      return a.giftRecipient.first.trim() && a.giftRecipient.last.trim() && looksLikeEmail(a.giftRecipient.email)
        ? '' : 'Please add their first name, last name and a valid email.';
    case 'giftCode': return a.giftCode.trim() ? '' : 'Please enter your code.';
    case 'doctor': return a.doctorVisit ? '' : 'Please choose when you will see your doctor.';
    default: return '';
  }
}

// Save the answer for one step. Upload saves as each file goes up, so it has
// nothing left to save here.
async function saveCurrent(step, a, member, onNoteId) {
  const trimPerson = (p) => ({ first: p.first.trim(), last: p.last.trim(), email: p.email.trim() });
  switch (step) {
    case 'expectations': onNoteId(await saveExpectations(member, a.expectations, a.expectationsId)); break;
    case 'type':          await saveMembershipType(member, a.type); break;
    case 'details':       await saveMemberDetails(member, { mobile: a.mobile.trim(), comms: a.comms, dob: a.dob }); break;
    case 'group':         await saveGroupMembers(member, a.group.map(trimPerson)); break;
    case 'giftRecipient': await saveGiftRecipient(member, trimPerson(a.giftRecipient)); break;
    case 'giftCode':      await saveGiftCode(member, a.giftCode.trim()); break;
    case 'doctor':        await saveDoctorVisit(member, a.doctorVisit); break;
    default: break;
  }
}

function Heading({ children }) {
  return <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600, color: SLATE, lineHeight: 1.35 }}>{children}</h2>;
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function PersonFields({ value, onChange }) {
  const upd = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
      <div style={{ flex: '1 1 140px', minWidth: 0 }}>
        <Field label="First name"><input value={value.first} onChange={upd('first')} style={input} /></Field>
      </div>
      <div style={{ flex: '1 1 140px', minWidth: 0 }}>
        <Field label="Last name"><input value={value.last} onChange={upd('last')} style={input} /></Field>
      </div>
      <div style={{ flex: '1 1 100%', minWidth: 0 }}>
        <Field label="Email"><input type="email" value={value.email} onChange={upd('email')} style={input} /></Field>
      </div>
    </div>
  );
}

function RadioGroup({ name, options, value, onChange, inline }) {
  return (
    <div role="radiogroup" style={{ display: 'flex', flexDirection: inline ? 'row' : 'column', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <label key={o.key} style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: SLATE,
            border: `1px solid ${on ? SLATE : BORDER}`, background: on ? OFFWHITE : CARD,
            borderRadius: 10, padding: '11px 14px', flex: inline ? '1 1 80px' : undefined, minWidth: 0,
          }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(o.key)} style={{ margin: 0, accentColor: SLATE }} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

function DropZone({ onFiles }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      style={{
        border: `1.5px dashed ${over ? SLATE : '#c9c3b8'}`, background: over ? OFFWHITE : CARD,
        borderRadius: 12, padding: '26px 16px', textAlign: 'center', cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: SLATE }}>Drop files here or tap to choose</div>
      <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>PDF, JPG or PNG, up to 4.5 MB each</div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={CONFIG.UPLOAD_ACCEPT}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

const lead = { margin: '0 0 14px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.6 };
const summaryLine = { fontSize: 13.5, color: '#374151', marginTop: 4, lineHeight: 1.5 };

const input = {
  display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit',
  color: SLATE, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px',
};

const linkBtn = {
  background: 'none', border: 'none', padding: 0, color: SLATE, fontSize: 13.5, fontWeight: 600,
  textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit',
};

const secondaryBtn = {
  background: 'none', border: `1px solid ${BORDER}`, borderRadius: 999,
  padding: '12px 20px', fontSize: 13.5, fontWeight: 600, color: SLATE,
  cursor: 'pointer', fontFamily: 'inherit',
};
