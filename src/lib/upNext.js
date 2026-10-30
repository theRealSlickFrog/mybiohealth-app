// Up Next: the member's checklist, as designed in Ken's container prototype.
//
// The task list is fixed here for now (the prototype calls it server data; move
// it when a server decides per member). What the member has done is saved to
// Caspio as one member_info row, feature='UP_NEXT', text_box_2=JSON:
//   { tasks: {doctor: true}, subs: {'doctor.visit': true}, doneAt: {doctor: ISO},
//     plans: {'doctor.labwork': {mode, date}}, address: {home, shipTo} }
// The home address is also copied to physical_address so the Account page shows it.

const API_BASE = import.meta.env.DEV ? '/api' : 'https://kenises-api-proxy.netlify.app';
const FEATURE = 'UP_NEXT';

export const LINKS = {
  explainer: '/docs/physician-explainer.pdf',
  // TODO: orientation booking link from the client.
  orientation: '',
  cgmOrder: 'https://buy.stripe.com/8x2bJ14J81g6gAb80YbbG09',
  dexaBook: 'https://mybenchmarkhealth.janeapp.com/#/discipline/5/treatment/1',
};

// TODO: Canada Post AddressComplete key from the client. Blank: the address is typed by hand.
const ADDRESS_COMPLETE_KEY = '';
export const addressLookupOn = !!ADDRESS_COMPLETE_KEY;

export const UP_NEXT = [
  { id: 'start', type: 'group', title: 'Starting Point', desc: 'Doctor visit, CGM and DEXA scan.', items: [
    { id: 'doctor', title: 'Doctor visit and lab visit', desc: '', repeat: '3 months', subs: [
      { id: 'explainer', title: 'An explainer for your physician that includes a lab requisition.', link: { label: 'Download', url: LINKS.explainer } },
      { id: 'visit', title: 'Visit with your physician' },
      { id: 'labwork', type: 'plan', title: 'Lab visit', checkable: true },
    ] },
    { id: 'cgm', title: 'CGM - Continuous Glucose Monitor',
      info: 'A continuous glucose monitor is a small sensor worn on the skin, usually on the back of the upper arm. It measures glucose in the fluid beneath the skin every few minutes, day and night, for up to two weeks. The readings show how glucose moves through the day, which a single blood test cannot.',
      desc: 'Start your CGM when you are comfortable, or start it during an orientation meeting.',
      links: [{ label: 'Book an orientation', url: LINKS.orientation }, { label: 'Order a CGM', url: LINKS.cgmOrder }],
      subs: [{ id: 'cgmstatus', type: 'plan', title: 'CGM', opts: [['ordered', 'Ordered'], ['started', 'Started']], dateMode: 'started' }] },
    { id: 'dexa', title: 'DEXA scan', desc: 'Lean mass and visceral fat.', link: { label: 'Book a DEXA', url: LINKS.dexaBook } },
  ] },
  { id: 'address', type: 'task', title: 'Address', desc: 'Home address, and a Ship to address if different.', form: 'address' },
];

export const emptyState = () => ({ tasks: {}, subs: {}, doneAt: {}, plans: {}, address: null });

// A repeating task re-opens with fresh steps once its time is up. Doctor visit: 3 months.
const REPEAT_MONTHS = { doctor: 3 };
function reopenDue(state, now = new Date()) {
  const next = { ...state, tasks: { ...state.tasks }, subs: { ...state.subs }, plans: { ...state.plans }, doneAt: { ...state.doneAt } };
  let changed = false;
  for (const [id, months] of Object.entries(REPEAT_MONTHS)) {
    const at = next.doneAt[id] && new Date(next.doneAt[id]);
    if (!next.tasks[id] || !at) continue;
    at.setMonth(at.getMonth() + months);
    if (at > now) continue;
    next.tasks[id] = false;
    delete next.doneAt[id];
    for (const k of Object.keys(next.subs)) if (k.startsWith(`${id}.`)) delete next.subs[k];
    for (const k of Object.keys(next.plans)) if (k.startsWith(`${id}.`)) delete next.plans[k];
    changed = true;
  }
  return { state: next, changed };
}

const recordsUrl = (where) =>
  `${API_BASE}/rest/v2/tables/member_info/records${where ? `?q.where=${encodeURIComponent(where)}` : ''}`;
const whereRow = (member) => `member_id='${String(member).replace(/'/g, "''")}' AND feature='${FEATURE}'`;

export async function loadUpNext(member) {
  const r = await fetch(recordsUrl(whereRow(member)));
  if (!r.ok) throw new Error(`load up next ${r.status}`);
  const row = ((await r.json()).Result || [])[0];
  if (!row) return emptyState();
  let saved;
  try { saved = { ...emptyState(), ...JSON.parse(row.text_box_2 || '{}') }; } catch { return emptyState(); }
  const { state, changed } = reopenDue(saved);
  if (changed) saveUpNext(member, state).catch(() => {});
  return state;
}

// Date of the member's latest lab results, and when the next are due (quarterly).
export async function loadLabDates(member) {
  const where = `member_id='${String(member).replace(/'/g, "''")}'`;
  const r = await fetch(`${API_BASE}/rest/v2/tables/report_ready_result/records?q.select=report_date&q.where=${encodeURIComponent(where)}&q.limit=1000`);
  if (!r.ok) throw new Error(`load labs ${r.status}`);
  const dates = ((await r.json()).Result || []).map((x) => (x.report_date || '').slice(0, 10)).filter(Boolean).sort();
  if (!dates.length) return null;
  const last = dates[dates.length - 1];
  const [y, m, d] = last.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1 + 3, d)).toISOString().slice(0, 10);
  return { last, next };
}

// Best effort: Up Next already holds the address, so a failure here only means
// the Account page doesn't show it yet.
export async function saveMailingAddress(member, home) {
  const url = `${API_BASE}/rest/v2/tables/physical_address/records`;
  const where = `legal_entity_id='${String(member).replace(/'/g, "''")}' AND mailing_address=1`;
  const body = {
    address_line1: home.line1, address_line2: home.unit, city: home.city, state: home.province,
    postal_code: home.postalCode, country: 'Canada', mailing_address: true,
  };
  const found = await fetch(`${url}?q.where=${encodeURIComponent(where)}&q.limit=1`);
  if (!found.ok) throw new Error(`load address ${found.status}`);
  const exists = ((await found.json()).Result || []).length > 0;
  const r = exists
    ? await fetch(`${url}?q.where=${encodeURIComponent(where)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    : await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ legal_entity_id: member, ...body }) });
  if (!r.ok) throw new Error(`save address ${r.status}`);
}

// Canada Post AddressComplete, from the prototype. Not yet run against a live key.
const POST_BASE = 'https://ws1.postescanada-canadapost.ca/AddressComplete/Interactive';
export async function lookupAddress(term, lastId) {
  const u = `${POST_BASE}/Find/v2.10/json3ex.ws?Key=${encodeURIComponent(ADDRESS_COMPLETE_KEY)}&SearchTerm=${encodeURIComponent(term)}&LastId=${encodeURIComponent(lastId || '')}&Country=CA&MaxResults=10&LanguagePreference=en`;
  const j = await (await fetch(u)).json();
  return (j.Items || []).filter((i) => !i.Error).map((i) => ({ id: i.Id, text: i.Text, description: i.Description, next: i.Next }));
}
export async function retrieveAddress(id) {
  const u = `${POST_BASE}/Retrieve/v2.11/json3ex.ws?Key=${encodeURIComponent(ADDRESS_COMPLETE_KEY)}&Id=${encodeURIComponent(id)}`;
  const a = ((await (await fetch(u)).json()).Items || [])[0] || {};
  return { line1: a.Line1 || '', city: a.City || '', province: a.ProvinceCode || '', postalCode: a.PostalCode || '' };
}

// Saves run one at a time, so two quick ticks can't each insert a row.
let queue = Promise.resolve();
export function saveUpNext(member, state) {
  const run = async () => {
    const body = { text_box_2: JSON.stringify(state) };
    const check = await fetch(recordsUrl(whereRow(member)));
    if (!check.ok) throw new Error(`save up next ${check.status}`);
    const row = ((await check.json()).Result || [])[0];
    const r = row
      ? await fetch(recordsUrl(`member_info_id=${row.member_info_id}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      : await fetch(recordsUrl(), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member, feature: FEATURE, ...body }),
        });
    if (!r.ok) throw new Error(`save up next ${r.status}`);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}
