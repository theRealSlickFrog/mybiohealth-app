// Membership and Gifting: a signed-in member gifts a Membership. The gift is saved
// (lib/membership.js), then payment happens at Stripe, where the CGMs and DEXA are chosen.
import { useState } from 'react';
import { getStoredGuid } from '../lib/auth.js';
import { STRIPE_OTHER_URL } from '../lib/constants.js';
import { saveGift } from '../lib/membership.js';
import './UpNextPage.css';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const blank = { name: '', email: '', phone: '', note: '', anon: false };

export default function MembershipPage({ onNavigate }) {
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [giftRef, setGiftRef] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrs({ ...errs, [k]: '' }); };

  async function submit(e) {
    e.preventDefault();
    const er = {};
    const digits = f.phone.replace(/\D/g, '');
    if (!f.name.trim()) er.name = "Enter the recipient's name.";
    if (!EMAIL_RE.test(f.email.trim())) er.email = 'Enter a valid email address.';
    if (f.phone.trim() && digits.length !== 10) er.phone = 'Enter a 10-digit phone number, or leave it blank.';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    setSaveErr(false);
    try {
      setGiftRef(await saveGift(getStoredGuid(), {
        name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: digits ? `+1${digits}` : '',
        communication: f.note.trim(), anonymous: f.anon,
      }));
    } catch (x) {
      console.error('Gift save failed:', x);
      setSaveErr(true);
    } finally {
      setBusy(false);
    }
  }

  const head = (
    <div className="un-head">
      <h1>Membership and Gifting</h1>
      <p className="un-lead">Your contact details and plan are under <button type="button" className="un-link" style={{ minHeight: 0 }} onClick={() => onNavigate?.('account')}>Account</button>.</p>
    </div>
  );

  if (giftRef) {
    return (
      <div className="un-page">
        {head}
        <p>The gift for {f.name.trim()} is recorded. Payment is the next step, where the CGMs and DEXA are selected.</p>
        <div className="un-acts">
          <a className="un-btn" style={{ textDecoration: 'none' }} target="_blank" rel="noopener noreferrer"
            href={`${STRIPE_OTHER_URL}?client_reference_id=${encodeURIComponent(giftRef)}`}>Continue to payment</a>
          <button type="button" className="un-link" onClick={() => { setF(blank); setGiftRef(''); }}>Gift another Membership</button>
        </div>
      </div>
    );
  }

  const input = (k, placeholder, type = 'text', max) => (
    <>
      <input id={`gift-${k}`} type="text" inputMode={type === 'text' ? undefined : type} autoComplete="off" maxLength={max}
        aria-label={`Recipient ${placeholder}`} placeholder={placeholder} aria-invalid={!!errs[k]} value={f[k]} onChange={set(k)} />
      {errs[k] && <p className="un-err" role="alert">{errs[k]}</p>}
    </>
  );
  return (
    <div className="un-page">
      {head}
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 600 }}>Gift a Membership</h2>
        <p className="un-note" style={{ fontSize: '0.95rem' }}>$400, plus $125 for 1 DEXA. 1 to 4 CGMs are added at payment.</p>
      </div>
      <form className="un-addr" onSubmit={submit} noValidate style={{ paddingTop: 0 }}>
        <fieldset>
          <legend>To</legend>
          {input('name', 'Name', 'text', 30)}
          {input('email', 'Email', 'email')}
          {input('phone', 'Phone (optional)', 'tel')}
        </fieldset>
        <textarea maxLength={1000} rows={4} aria-label="Communication and other comments" style={{ width: '100%', padding: '10px 12px', font: 'inherit', border: '1px solid var(--un-line)', borderRadius: 6, background: 'var(--un-surface)', color: 'var(--un-ink)' }}
          placeholder="Explain how MyBioHealth should communicate with the new Member. Other comments?" value={f.note} onChange={set('note')} />
        <div className="un-plan" role="group" aria-label="Anonymous">
          <span className="un-pl">Anonymous</span>
          <button type="button" className="un-chip" aria-pressed={!f.anon} onClick={() => setF({ ...f, anon: false })}>No</button>
          <button type="button" className="un-chip" aria-pressed={f.anon} onClick={() => setF({ ...f, anon: true })}>Yes</button>
        </div>
        {saveErr && <p className="un-err" role="alert">The gift could not be saved. Try again.</p>}
        <div className="un-acts"><button type="submit" className="un-btn" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button></div>
      </form>
    </div>
  );
}
