// Account — contact info, doctor, and payment. Native V2 port of V1 Account.html,
// reading through the proxy + JWT (lib/account.js). Payment is a Stripe hosted-
// checkout link (the V1 page's approach); an embedded buy-button can come later.
import { useEffect, useState } from 'react';
import { MBH_SAGE, SAGE_BG, SLATE, CARD, BORDER, OFFWHITE, SOFT_RED } from '../lib/constants.js';
import { getStoredGuid } from '../lib/auth.js';
import { loadAccount, DEV_MEMBER } from '../lib/account.js';

const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/eVqaEX2B03oecjV80YbbG01';

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 96 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? SLATE : '#9ca3af', flex: 1 }}>{value || 'Not provided'}</span>
    </div>
  );
}

function AddressCard({ a }) {
  return (
    <div style={{ background: OFFWHITE, borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${a.mailing ? MBH_SAGE : '#c4a96e'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: SLATE }}>{a.type}</span>
        {a.mailing && <span style={{ fontSize: 10, fontWeight: 600, color: MBH_SAGE, background: SAGE_BG, padding: '2px 8px', borderRadius: 10 }}>✉️ Mailing</span>}
      </div>
      <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, color: SLATE }}>{a.line1}</div>
        {a.line2 && <div>{a.line2}</div>}
        <div>{[a.city, a.state].filter(Boolean).join(', ')} {a.postal}</div>
        {a.country && <div>{a.country}</div>}
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ background: CARD, borderRadius: 14, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function ContactBlock({ e, addresses }) {
  return (
    <>
      <Panel title="Primary Contact">
        <InfoRow label="Name" value={e.name} />
        <InfoRow label="Email" value={e.email} />
        {e.altEmail && <InfoRow label="Alt Email" value={e.altEmail} />}
        <InfoRow label="Phone" value={e.phone} />
        {e.altPhone && <InfoRow label="Alt Phone" value={e.altPhone} />}
      </Panel>
      <Panel title={`Addresses${addresses.length ? ` (${addresses.length})` : ''}`}>
        {addresses.length ? (
          <div style={{ display: 'grid', gap: 12 }}>{addresses.map((a, i) => <AddressCard key={i} a={a} />)}</div>
        ) : (
          <div style={{ fontSize: 12.5, color: '#9ca3af' }}>No addresses on file.</div>
        )}
      </Panel>
    </>
  );
}

export default function AccountPage() {
  const [d, setD] = useState(undefined); // undefined=loading, null=error, object=data
  const [tab, setTab] = useState('contact');

  useEffect(() => {
    let cancelled = false;
    loadAccount(getStoredGuid() || DEV_MEMBER)
      .then((x) => { if (!cancelled) setD(x); })
      .catch((e) => { console.warn('Account load failed:', e); if (!cancelled) setD(null); });
    return () => { cancelled = true; };
  }, []);

  const tabs = [
    { key: 'contact', label: 'Contact' },
    ...(d && d.doctor ? [{ key: 'doctor', label: 'Doctor' }] : []),
    { key: 'payment', label: 'Payment' },
  ];

  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>Account</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Contact, doctor, and payment</div>

      {d === undefined && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>}
      {d === null && <div style={{ padding: 40, textAlign: 'center', color: SOFT_RED }}>Couldn't load your account. Please try again.</div>}

      {d && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                background: tab === t.key ? SLATE : 'transparent', color: tab === t.key ? 'white' : '#374151',
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'contact' && <ContactBlock e={d.me} addresses={d.addresses} />}

          {tab === 'doctor' && d.doctor && (
            <>
              <Panel title="Your Doctor">
                <InfoRow label="Name" value={d.doctor.name} />
                <InfoRow label="Email" value={d.doctor.email || d.doctor.altEmail} />
                <InfoRow label="Phone" value={d.doctor.phone || d.doctor.altPhone} />
              </Panel>
              {d.doctorAddresses.length > 0 && (
                <Panel title={`Doctor Addresses (${d.doctorAddresses.length})`}>
                  <div style={{ display: 'grid', gap: 12 }}>{d.doctorAddresses.map((a, i) => <AddressCard key={i} a={a} />)}</div>
                </Panel>
              )}
            </>
          )}

          {tab === 'payment' && (
            <Panel title="Membership & Payment">
              <div style={{ fontSize: 14, color: SLATE, fontWeight: 600, marginBottom: 6 }}>MyBioHealth — Your Health, Your Data, Your Edge.</div>
              <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 16 }}>Secure checkout, powered by Stripe.</div>
              <a href={STRIPE_CHECKOUT_URL} target="_blank" rel="noopener" style={{
                display: 'inline-block', background: MBH_SAGE, color: 'white', textDecoration: 'none',
                borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600,
              }}>Subscribe — secure checkout ↗</a>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
