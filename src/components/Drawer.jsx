// Slide-out left navigation drawer.
import { MBH_SAGE, SAGE_BG, SAGE_TEXT, SLATE, CARD, BORDER, MBH_DROP_IMG, NAV_ITEMS, VERSION, RENEWAL } from '../lib/constants.js';
import { logout } from '../lib/auth.js';

export default function Drawer({ activePage, onSelect, onClose }) {
  const groups = [
    { label: null,     keys: ['strategy', 'biosignals', 'glucose', 'dexa'] },
    { label: 'Member', keys: ['vault', 'calendar'] },
    { label: 'MBH',    keys: ['library', 'questions'] },
  ];
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.5)', zIndex: 300,
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: CARD, zIndex: 301,
        display: 'flex', flexDirection: 'column', boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
        overflowY: 'auto',
      }}>
        <div style={{ background: SLATE, padding: '16px 20px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img src={MBH_DROP_IMG} alt="MyBioHealth" style={{ width: 28, height: 28, display: 'block', objectFit: 'contain' }} />
          <div>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>
              <em style={{ fontStyle: 'normal' }}>My</em>BioHealth
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic' }}>it's in you to know</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && (
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#374151', padding: '12px 20px 4px' }}>
                  {g.label}
                </div>
              )}
              {gi > 0 && <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />}
              {NAV_ITEMS.filter((n) => g.keys.includes(n.key)).map((item) => {
                const active = activePage === item.key;
                return (
                  <button key={item.key} onClick={() => { onSelect(item.key); onClose(); }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 20px', border: 'none', cursor: 'pointer',
                    background: active ? SAGE_BG : 'transparent',
                    borderLeft: active ? `3px solid ${MBH_SAGE}` : '3px solid transparent',
                    textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? SAGE_TEXT : SLATE }}>
                      {item.label}
                    </span>
                    {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: MBH_SAGE }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button
            onClick={logout}
            style={{
              width: '100%', background: 'transparent', border: `1px solid ${BORDER}`,
              borderRadius: 999, padding: '10px 16px', fontSize: 13, fontWeight: 500,
              color: '#5e564b', cursor: 'pointer', marginBottom: 14, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#f5f0e8'; }}
            onMouseOut={(e)  => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            <span>Log out</span>
          </button>
          <div style={{ fontSize: 12, color: '#374151' }}>v{VERSION} · renews {RENEWAL}</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 8, fontStyle: 'italic', opacity: 0.7 }}>
            Built with Claude · Anthropic
          </div>
        </div>
      </div>
    </>
  );
}
