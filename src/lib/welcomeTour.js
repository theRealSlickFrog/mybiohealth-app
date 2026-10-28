// First-login welcome tour.
//
// Who sees it: a member who signed up for the new app and hasn't closed it yet.
// "Signed up" is either of:
//  - legal_entity.eula_version filled in: the old Caspio sign-up form set it
//    (to 'v1') when its consent box was ticked;
//  - a member_info row feature='WELCOME_TOUR', text_box_1='pending': our own
//    sign-up (the proxy's /signup) writes it, since that form no longer asks
//    for the EULA. The tour then asks for it as its first step.
// Every member who existed before the tour has neither, so they never see it.
//
// Once only: closing the tour inserts a member_info row, feature='WELCOME_TOUR',
// text_box_1='done'. Any such row suppresses the tour for good, whatever else
// is there.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const FEATURE = 'WELCOME_TOUR';

async function firstRow(table, where, select) {
  const sel = select ? `q.select=${select}&` : '';
  const r = await fetch(`${API_BASE}/rest/v2/tables/${table}/records?${sel}q.where=${encodeURIComponent(where)}&q.limit=1`);
  if (!r.ok) throw new Error(`load ${table} ${r.status}`);
  return ((await r.json()).Result || [])[0] || null;
}

// True only for a signed-up member who hasn't closed the tour yet.
export async function shouldShowTour(member) {
  const [me, pending, done] = await Promise.all([
    firstRow('legal_entity', `UserGUID='${member}'`, 'eula_version'),
    firstRow('member_info', `member_id='${member}' AND feature='${FEATURE}' AND text_box_1='pending'`),
    firstRow('member_info', `member_id='${member}' AND feature='${FEATURE}' AND text_box_1='done'`),
  ]);
  const signedUp = !!(me && (me.eula_version || '').trim()) || !!pending;
  return signedUp && !done;
}

export async function markTourDone(member) {
  const r = await fetch(`${API_BASE}/rest/v2/tables/member_info/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: member, feature: FEATURE, text_box_1: 'done' }),
  });
  if (!r.ok) throw new Error(`save ${r.status}`);
}
