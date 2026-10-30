// Member navigation, laid out as in Ken's container prototype. A fixed sidebar on
// a desktop (`permanent`), a slide-out drawer on a phone.
import { CARD, BORDER, NAV_ITEMS, SLATE } from '../lib/constants.js';
import { logout } from '../lib/auth.js';

const ACCENT = '#3D6E58';
const ACCENT_SOFT = '#DAE7E0';

// `heading` is a label that isn't a page. `child` items sit indented under the
// item above. Every NAV_ITEMS key must appear here or it can't be reached.
const GROUPS = [
  [{ key: 'upnext' }, { key: 'strategy' }, { key: 'checkin_priorities', child: true }, { key: 'jots', child: true }],
  [{ heading: 'Primary Signals' }, { key: 'biosignals', child: true }, { key: 'dexa', child: true }, { key: 'risk_measures', child: true }, { key: 'context_signals', child: true }, { key: 'glucose_v2' }],
  [{ key: 'vault' }, { key: 'calendar' }],
  [{ key: 'library' }, { key: 'questions', child: true }, { key: 'membership' }, { key: 'account' }],
];

const withMy = (t) => String(t).split(/(My(?=[A-Z]))/).map((p, i) => (p === 'My' ? <em key={i}>My</em> : p));

export default function Drawer({ activePage, onSelect, onClose, permanent = false }) {
  const panel = (
    <div style={permanent
      ? { position: 'sticky', top: 0, height: '100vh', width: 264, flex: '0 0 264px', background: CARD, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }
      : { position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, maxWidth: '86vw', background: CARD, zIndex: 301, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 20px rgba(0,0,0,0.15)', overflowY: 'auto' }}>
      <div style={{ padding: '26px 24px 14px', fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 21, color: SLATE }}>
        <em>My</em>BioHealth
      </div>
      <nav aria-label="Main" style={{ flex: 1, padding: '0 12px 12px' }}>
        {GROUPS.map((g, gi) => (
          <div key={gi} style={{ marginTop: gi ? 18 : 0 }}>
            {g.map((it) => {
              if (it.heading) {
                return <div key={it.heading} style={{ padding: '9px 12px', fontSize: 15, color: SLATE }}>{withMy(it.heading)}</div>;
              }
              const item = NAV_ITEMS.find((n) => n.key === it.key);
              const active = activePage === it.key;
              return (
                <button key={it.key} type="button" aria-current={active ? 'page' : undefined}
                  onClick={() => { onSelect(it.key); onClose?.(); }}
                  style={{
                    width: '100%', display: 'block', minHeight: it.child ? 38 : 44, padding: it.child ? '8px 12px 8px 28px' : '10px 12px',
                    border: 0, borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    fontSize: it.child ? 14 : 15, fontWeight: active ? 600 : 400,
                    background: active ? ACCENT_SOFT : 'transparent', color: active ? ACCENT : SLATE,
                  }}>
                  {withMy(item.label)}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={{ padding: '10px 12px 18px', borderTop: `1px solid ${BORDER}` }}>
        <button type="button" onClick={() => logout(activePage)} style={{
          width: '100%', minHeight: 44, padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 8,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 15, color: '#58675F',
        }}>Log out</button>
      </div>
    </div>
  );
  if (permanent) return panel;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,45,61,0.5)', zIndex: 300 }} />
      {panel}
    </>
  );
}
