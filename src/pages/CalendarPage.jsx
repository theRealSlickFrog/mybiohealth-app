// Calendar — upcoming events. Hardcoded; see prototype_data_inventory for what's derivable later.
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, AMBER, SOFT_RED, TEAL, SLATE, CARD, BORDER } from '../lib/constants.js';

const UPCOMING = [
  { icon: '🩸', title: 'Blood Draw', date: '~Early June 2026', desc: 'Add Lp(a), Fasting Insulin, UACR, ApoB retest', color: SOFT_RED },
  { icon: '📱', title: 'CGM Cycle 2 — Start', date: '~Early June 2026', desc: '14-day wear. Timed to blood draw.', color: MBH_SAGE },
  { icon: '🌱', title: 'MHx Renew — Glucose Rest', date: 'May 24, 2026', desc: 'Continue, Adjust, or Abandon. 30-day cadence.', color: AMBER },
  { icon: '🌱', title: 'MHx Renew — Protein Breakfast', date: 'May 24, 2026', desc: 'Continue, Adjust, or Abandon. 30-day cadence.', color: AMBER },
  { icon: '📋', title: 'MyStrategy Renewal', date: 'Jul 23, 2026', desc: 'v26.04.24.a expires. Review priorities and signals.', color: TEAL },
  { icon: '🦴', title: 'Next DEXA Scan', date: 'April 2027', desc: 'Annual cadence. Member decides.', color: '#8b7355' },
];

export default function CalendarPage() {
  return (
    <div style={{ padding: '22px 16px 80px' }}>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, color: SLATE, marginBottom: 4, fontWeight: 'normal' }}>Calendar</h1>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 20 }}>Your MBH timeline — upcoming events and bookings</div>

      <div style={{ background: SAGE_BG, borderRadius: 12, padding: '14px 18px', marginBottom: 16, borderLeft: `3px solid ${MBH_SAGE}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: MBH_SAGE, marginBottom: 6 }}>Book a session with MBH</div>
        <div style={{ fontSize: 13, color: SAGE_TEXT, lineHeight: 1.6, marginBottom: 10 }}>CGM Debrief · MyStrategy Review · General Consult</div>
        <a href="https://calendly.com/ken-mybiohealth/mybiohealth-office-hours" target="_blank" rel="noopener"
          style={{ display: 'inline-block', background: MBH_SAGE, border: 'none', borderRadius: 20, padding: '9px 20px', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', textDecoration: 'none' }}>
          📅 Book via Calendly
        </a>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#374151', marginBottom: 12 }}>Upcoming</div>
      <div style={{ background: CARD, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {UPCOMING.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: i < UPCOMING.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${e.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>{e.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>{e.title}</div>
                <div style={{ fontSize: 11, color: e.color, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{e.date}</div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{e.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
