// First-login welcome tour.
//
// Who sees it: members whose legal_entity.eula_version is filled in. Only the
// sign-up form sets that field (to 'v1'), and every member who existed before
// the tour has it blank, so they can never see it.
//
// Once only: closing the tour inserts a member_info row, feature='WELCOME_TOUR',
// text_box_1='done'. Any such row suppresses the tour for good. Nothing else
// ever writes the feature, so there is no 'pending' state to manage.

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
  const [me, done] = await Promise.all([
    firstRow('legal_entity', `UserGUID='${member}'`, 'eula_version'),
    firstRow('member_info', `member_id='${member}' AND feature='${FEATURE}' AND text_box_1='done'`),
  ]);
  return !!(me && (me.eula_version || '').trim()) && !done;
}

export async function markTourDone(member) {
  const r = await fetch(`${API_BASE}/rest/v2/tables/member_info/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: member, feature: FEATURE, text_box_1: 'done' }),
  });
  if (!r.ok) throw new Error(`save ${r.status}`);
}
